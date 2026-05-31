let activeEnv = {};

const MODEL_PRICE_DEFAULTS = {
  "gpt-5.2": {
    inputUsdPer1M: 1.75,
    cachedInputUsdPer1M: 0.175,
    outputUsdPer1M: 14
  },
  "gpt-4.1": {
    inputUsdPer1M: 2,
    cachedInputUsdPer1M: 0.5,
    outputUsdPer1M: 8
  }
};

const DEFAULT_COST_CONTROL = {
  krwPerUsd: 1500,
  monthlyWarnUsd: 10,
  monthlyStopUsd: 50,
  dailyCallLimit: 30,
  pricingDate: "2026-05-30"
};

export function createApi(env = {}) {
  activeEnv = env || {};

  return {
    getHealthStatus,
    handleSearch,
    handleAnalyze
  };
}

function getHealthStatus() {
  return {
    ok: true,
    keys: {
      lawOpenApi: hasUsableValue(getLawOpenApiKey()),
      koreanLawMcp: hasUsableValue(getKoreanLawMcpBaseUrl()),
      publicData: hasUsableValue(activeEnv.PUBLIC_DATA_API_KEY),
      openAi: hasUsableValue(activeEnv.OPENAI_API_KEY),
      scourt: hasUsableValue(activeEnv.SCOUT_API_KEY),
      nanet: hasUsableValue(activeEnv.NANET_API_KEY)
    }
  };
}

async function handleSearch(requestUrl) {
  const question = cleanText(requestUrl.searchParams.get("q") || "");
  const topic = cleanText(requestUrl.searchParams.get("topic") || "general");
  const laws = parseList(requestUrl.searchParams.get("laws"));
  const keywords = parseList(requestUrl.searchParams.get("keywords"));

  if (!question) {
    return { error: "질문이 비어 있습니다." };
  }

  const lawQueries = buildLawQueries({ laws, question, topic, keywords });
  const safetyContext = buildSafetyContext(question, keywords, topic);
  const lawOpenApiKey = getLawOpenApiKey();
  const koreanLawMcpBaseUrl = getKoreanLawMcpBaseUrl();
  const publicDataKey = activeEnv.PUBLIC_DATA_API_KEY;
  const hasKoreanLawMcp = hasUsableValue(koreanLawMcpBaseUrl);
  const officialQuery = buildOfficialSourceQuery({ question, topic, keywords, lawQueries });

  const [lawResults, interpretationResults, disasterResults, materialResults] = await Promise.all([
    searchLawsWithPreferredSource({ lawOpenApiKey, lawQueries, hasKoreanLawMcp, keywords }),
    searchInterpretationsWithPreferredSource({ lawOpenApiKey, question: officialQuery, hasKoreanLawMcp }),
    hasUsableValue(publicDataKey) ? searchDisasterCases(publicDataKey, safetyContext) : missingKey("PUBLIC_DATA_API_KEY"),
    hasUsableValue(publicDataKey) ? searchSafetyMaterials(publicDataKey) : missingKey("PUBLIC_DATA_API_KEY")
  ]);

  return {
    query: question,
    topic,
    generatedAt: new Date().toISOString(),
    verification: buildVerificationSummary(),
    status: getHealthStatus().keys,
    results: {
      laws: lawResults.items,
      interpretations: interpretationResults.items,
      safetyDisasters: disasterResults.items,
      safetyMaterials: materialResults.items
    },
    notices: [
      ...lawResults.notices,
      ...interpretationResults.notices,
      ...disasterResults.notices,
      ...materialResults.notices
    ].filter(uniqueString).slice(0, 8)
  };
}

async function handleAnalyze(requestUrl) {
  const question = cleanText(requestUrl.searchParams.get("q") || "");
  const topic = cleanText(requestUrl.searchParams.get("topic") || "general");
  const role = cleanText(requestUrl.searchParams.get("role") || "auto");
  const mode = cleanText(requestUrl.searchParams.get("mode") || "intake");
  const caseId = cleanText(requestUrl.searchParams.get("caseId") || "");
  const openAiKey = activeEnv.OPENAI_API_KEY;

  if (!question) {
    return { error: "질문이 비어 있습니다." };
  }

  if (!hasUsableValue(openAiKey)) {
    return {
      error: "OPENAI_API_KEY 값이 없어 AI 사안 분석을 사용할 수 없습니다.",
      fallback: true
    };
  }

  const primaryModel = cleanText(activeEnv.OPENAI_MODEL || "gpt-5.2");
  const fallbackModel = cleanText(activeEnv.OPENAI_FALLBACK_MODEL || "gpt-4.1");
  const models = [...new Set([primaryModel, fallbackModel].filter(Boolean))];
  const errors = [];

  for (const model of models) {
    try {
      const aiResult = await callOpenAiLegalAnalysis(openAiKey, {
        model,
        question,
        topic,
        role,
        mode
      });

      return {
        ok: true,
        caseId,
        engine: "openai-responses-structured",
        model,
        generatedAt: new Date().toISOString(),
        analysis: aiResult.analysis,
        usage: aiResult.usage,
        billing: aiResult.billing,
        costControl: getCostControlSettings(activeEnv)
      };
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
      if (!isRetryableOpenAiError(error)) {
        break;
      }
    }
  }

  return {
    error: "AI 사안 분석 호출에 실패했습니다.",
    fallback: true,
    notices: errors.slice(0, 3)
  };
}

async function callOpenAiLegalAnalysis(openAiKey, payload) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openAiKey}`
    },
    body: JSON.stringify({
      model: payload.model,
      instructions: getLegalAnalysisInstructions(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                currentDate: "2026-05-30",
                servicePurpose: "특성화고 학생, 교사, 학부모, 학교 관리자를 위한 법률정보 안내",
                topic: payload.topic,
                role: payload.role,
                mode: payload.mode,
                question: payload.question
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "gyo6_legal_intake_analysis",
          strict: true,
          schema: getLegalAnalysisSchema()
        },
        verbosity: "medium"
      },
      max_output_tokens: 5600
    }),
    signal: AbortSignal.timeout(25000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenAI API 오류 ${response.status}`);
    error.status = response.status;
    error.code = data?.error?.code || data?.error?.type || "";
    throw error;
  }

  const text = extractOpenAiText(data);
  if (!text) {
    throw new Error("AI 분석 결과가 비어 있습니다.");
  }

  try {
    const analysis = JSON.parse(text);
    const usage = normalizeOpenAiUsage(data.usage);
    return {
      analysis,
      usage,
      billing: estimateOpenAiBilling(usage, payload.model, activeEnv)
    };
  } catch (error) {
    throw new Error(`AI 분석 JSON 파싱 실패: ${error.message}`);
  }
}

function getLegalAnalysisInstructions() {
  return [
    "당신은 한국 특성화고·직업계고 현장실습, 취업지도, 학교 민원 사안을 다루는 법률정보 분석 도우미입니다.",
    "목표는 법률 자문이나 사건 판단이 아니라, 사용자의 질문을 정확히 이해하고 필요한 공식자료 확인 방향과 다음 조치를 정리하는 것입니다.",
    "절대 원문에 없는 사실을 끼워 넣지 마세요. 이전 사례, 예시, 흔한 사례를 현재 질문의 사실처럼 쓰면 안 됩니다.",
    "질문에 '청소'만 있으면 '재료 운반'을 추가하지 마세요. 질문에 '재료'가 없으면 재료라는 말을 쓰지 마세요.",
    "질문에 부상, 진단서, 사고, 교육청 보고 요청이 없으면 그런 절차를 기본 결론으로 만들지 마세요.",
    "먼저 사용자가 실제로 말한 사실과 아직 모르는 사실을 분리하세요.",
    "1차 결과는 긴 보고서가 아니라 상황 파악과 대처 방안 중심의 간편 보고서 초안으로 쓰일 예정입니다. 한 번에 모든 것을 처리하려 하지 말고 우선순위를 좁히세요.",
    "추가 질문은 미리 정한 문항을 나열하지 말고, 이 사안 판단에 꼭 필요한 1~3개만 생성하세요. 모르거나 민감하면 비워도 되는 질문으로 작성하세요.",
    "증빙자료는 필수 1~2개와 권고 1~2개 위주로 제한하세요. 실제 법적 필수 자료가 불명확하면 필수라고 과장하지 마세요.",
    "주체별 조치사항은 현재 사안에 직접 관련된 주체 2~3개만 정리하세요.",
    "법령은 조문을 단정하기보다 우선 확인해야 할 공식자료와 검색어를 제시하세요. 조문을 말할 때는 확인 필요 상태로 표현하세요.",
    "교사·학생·학부모의 일반 상담이라도 폭행, 상해, 협박, 명예훼손, 모욕, 성폭력, 아동학대, 개인정보 유출, 손해배상, 고소·고발·소송 가능성이 보이면 legalConsequenceAssessment.applies를 true로 설정하세요.",
    "형사 사건 또는 민사 사건으로 발전할 가능성이 있으면 형량·벌금·손해배상 범위, 감경·감량 또는 책임 완화에 필요한 행동과 증거를 별도 섹션으로 정리하세요.",
    "다만 형량, 벌금, 과태료, 징역 기간, 손해배상 범위는 officialSources의 원문 조문·판례·해석례에 근거가 있을 때만 구체적으로 쓰세요. 원문이 없으면 '원문 확인 필요'라고 표시하고 sourceSearchQueries에 확인할 법령·판례 검색어를 넣으세요.",
    "감경·감량 자료는 필수, 권고, 선택으로 구분하고, 반성문처럼 무조건 유리하다고 단정하지 말고 실제로 필요한 조치와 증거 보전 중심으로 안내하세요.",
    "단순 안내, 경미한 민원, 학부모 전달로 끝날 가능성이 큰 사안에는 legalConsequenceAssessment.applies를 false로 두고 형사·민사 위험을 과장하지 마세요.",
    "중대한 위험, 보복, 성희롱, 폭행, 산재, 해고, 소송 가능성이 보일 때만 전문가 상담 단계를 올리세요.",
    "출력은 반드시 요청한 JSON 스키마만 따르세요."
  ].join("\n");
}

function getLegalAnalysisSchema() {
  const stringArray = {
    type: "array",
    items: { type: "string" }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "issueType",
      "situationSummary",
      "coreFinding",
      "confidence",
      "knownFacts",
      "mustNotAssume",
      "missingFacts",
      "clarifyingQuestions",
      "keyIssues",
      "immediateActions",
      "stakeholderActions",
      "evidencePlan",
      "legalConsequenceAssessment",
      "expertReferral",
      "sourceSearchQueries",
      "informationNotice"
    ],
    properties: {
      title: { type: "string" },
      issueType: { type: "string" },
      situationSummary: { type: "string" },
      coreFinding: { type: "string" },
      confidence: {
        type: "string",
        enum: ["높음", "보통", "낮음"]
      },
      knownFacts: stringArray,
      mustNotAssume: stringArray,
      missingFacts: stringArray,
      clarifyingQuestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "why", "answerType"],
          properties: {
            question: { type: "string" },
            why: { type: "string" },
            answerType: { type: "string" }
          }
        }
      },
      keyIssues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "analysis", "sourceFocus"],
          properties: {
            title: { type: "string" },
            analysis: { type: "string" },
            sourceFocus: stringArray
          }
        }
      },
      immediateActions: stringArray,
      stakeholderActions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["actor", "actions"],
          properties: {
            actor: { type: "string" },
            actions: stringArray
          }
        }
      },
      evidencePlan: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["priority", "item", "why", "how"],
          properties: {
            priority: {
              type: "string",
              enum: ["필수", "권고", "선택"]
            },
            item: { type: "string" },
            why: { type: "string" },
            how: { type: "string" }
          }
        }
      },
      legalConsequenceAssessment: {
        type: "object",
        additionalProperties: false,
        required: [
          "applies",
          "riskLevel",
          "summary",
          "criminalIssues",
          "civilIssues",
          "mitigationPlan",
          "sourceSearchQueries",
          "caution"
        ],
        properties: {
          applies: { type: "boolean" },
          riskLevel: {
            type: "string",
            enum: ["해당 없음", "낮음", "보통", "높음", "즉시 상담"]
          },
          summary: { type: "string" },
          criminalIssues: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["issue", "legalBasis", "potentialConsequence", "sourceStatus", "requiredFacts"],
              properties: {
                issue: { type: "string" },
                legalBasis: { type: "string" },
                potentialConsequence: { type: "string" },
                sourceStatus: {
                  type: "string",
                  enum: ["원문 확인", "원문 확인 필요", "판례 확인 필요"]
                },
                requiredFacts: stringArray
              }
            }
          },
          civilIssues: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["issue", "legalBasis", "possibleClaim", "sourceStatus", "requiredFacts"],
              properties: {
                issue: { type: "string" },
                legalBasis: { type: "string" },
                possibleClaim: { type: "string" },
                sourceStatus: {
                  type: "string",
                  enum: ["원문 확인", "원문 확인 필요", "판례 확인 필요"]
                },
                requiredFacts: stringArray
              }
            }
          },
          mitigationPlan: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["priority", "action", "evidence", "why", "legalBasis"],
              properties: {
                priority: {
                  type: "string",
                  enum: ["필수", "권고", "선택"]
                },
                action: { type: "string" },
                evidence: { type: "string" },
                why: { type: "string" },
                legalBasis: { type: "string" }
              }
            }
          },
          sourceSearchQueries: stringArray,
          caution: { type: "string" }
        }
      },
      expertReferral: {
        type: "object",
        additionalProperties: false,
        required: ["level", "reason", "suggestedMessage"],
        properties: {
          level: {
            type: "string",
            enum: ["내부확인", "교육청문의", "노무사상담", "변호사상담", "즉시상향"]
          },
          reason: { type: "string" },
          suggestedMessage: { type: "string" }
        }
      },
      sourceSearchQueries: stringArray,
      informationNotice: { type: "string" }
    }
  };
}

function extractOpenAiText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  const chunks = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function normalizeOpenAiUsage(usage = {}) {
  const inputTokens = readNumber(usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens);
  const outputTokens = readNumber(usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens);
  const totalTokens = readNumber(usage.total_tokens ?? usage.totalTokens) || inputTokens + outputTokens;
  const cachedInputTokens = readNumber(
    usage.input_tokens_details?.cached_tokens ??
    usage.prompt_tokens_details?.cached_tokens ??
    usage.cached_input_tokens ??
    usage.cachedInputTokens
  );

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens
  };
}

function estimateOpenAiBilling(usage, model, env = {}) {
  const price = getModelPrice(model, env);
  const costControl = getCostControlSettings(env);
  const cachedInputTokens = Math.min(usage.cachedInputTokens || 0, usage.inputTokens || 0);
  const regularInputTokens = Math.max((usage.inputTokens || 0) - cachedInputTokens, 0);
  const inputUsd = regularInputTokens / 1_000_000 * price.inputUsdPer1M;
  const cachedInputUsd = cachedInputTokens / 1_000_000 * price.cachedInputUsdPer1M;
  const outputUsd = (usage.outputTokens || 0) / 1_000_000 * price.outputUsdPer1M;
  const estimatedUsd = inputUsd + cachedInputUsd + outputUsd;

  return {
    model,
    pricingDate: costControl.pricingDate,
    inputUsdPer1M: price.inputUsdPer1M,
    cachedInputUsdPer1M: price.cachedInputUsdPer1M,
    outputUsdPer1M: price.outputUsdPer1M,
    estimatedUsd: roundMoney(estimatedUsd, 6),
    estimatedKrw: Math.max(1, Math.round(estimatedUsd * costControl.krwPerUsd)),
    krwPerUsd: costControl.krwPerUsd,
    note: "OpenAI API 토큰 단가 기준의 추정값입니다. 실제 청구액은 OpenAI 대시보드가 최종 기준입니다."
  };
}

function getModelPrice(model = "", env = {}) {
  const normalizedModel = String(model || "").trim().toLowerCase();
  const defaults = Object.entries(MODEL_PRICE_DEFAULTS)
    .find(([key]) => normalizedModel.includes(key))?.[1] || MODEL_PRICE_DEFAULTS["gpt-5.2"];

  return {
    inputUsdPer1M: readNumber(env.OPENAI_INPUT_PRICE_PER_1M) || defaults.inputUsdPer1M,
    cachedInputUsdPer1M: readNumber(env.OPENAI_CACHED_INPUT_PRICE_PER_1M) || defaults.cachedInputUsdPer1M,
    outputUsdPer1M: readNumber(env.OPENAI_OUTPUT_PRICE_PER_1M) || defaults.outputUsdPer1M
  };
}

function getCostControlSettings(env = {}) {
  return {
    krwPerUsd: readNumber(env.OPENAI_KRW_PER_USD) || DEFAULT_COST_CONTROL.krwPerUsd,
    monthlyWarnUsd: readNumber(env.OPENAI_MONTHLY_WARN_USD) || DEFAULT_COST_CONTROL.monthlyWarnUsd,
    monthlyStopUsd: readNumber(env.OPENAI_MONTHLY_STOP_USD) || DEFAULT_COST_CONTROL.monthlyStopUsd,
    dailyCallLimit: Math.round(readNumber(env.OPENAI_DAILY_CALL_LIMIT) || DEFAULT_COST_CONTROL.dailyCallLimit),
    pricingDate: cleanText(env.OPENAI_COST_PRICING_DATE || DEFAULT_COST_CONTROL.pricingDate)
  };
}

function readNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function roundMoney(value, decimals = 6) {
  return Number((Number(value) || 0).toFixed(decimals));
}

function isRetryableOpenAiError(error) {
  return [400, 404].includes(error.status) || /model|모델|not found|does not exist/i.test(error.message);
}

function getLawOpenApiKey() {
  return activeEnv.LAW_OPEN_API_OC || activeEnv.LAW_OPEN_API_KEY;
}

function getKoreanLawMcpBaseUrl() {
  return cleanUrl(activeEnv.KOREAN_LAW_MCP_BASE_URL || activeEnv.KOREAN_LAW_MCP_URL || "");
}

function isMcpResearchEnabled() {
  return String(activeEnv.KOREAN_LAW_MCP_RESEARCH_ENABLED || "false").toLowerCase() === "true";
}

function buildVerificationSummary() {
  return {
    mode: "live-source-first",
    sourceRule: "공식 원문과 승인된 API 결과만 사용합니다.",
    noSourceRule: "원문 근거가 없으면 단정하지 않고 확인 필요로 표시합니다.",
    checkedAt: new Date().toISOString()
  };
}

function missingKey(name) {
  return Promise.resolve({
    items: [],
    notices: [`${name} 값이 없어 해당 출처는 건너뛰었습니다.`]
  });
}

function buildLawQueries({ laws = [], question = "", topic = "", keywords = [] } = {}) {
  const provided = normalizeProvidedLawQueries(laws);
  if (provided.length) {
    return provided.slice(0, 4);
  }

  const text = normalizeMatchText([topic, question, ...keywords].filter(Boolean).join(" "));
  const candidates = [];

  if (hasAnyTerm(text, ["폭행", "상해", "협박", "감금", "강요", "공갈", "고소", "고발", "형사", "벌금", "합의"])) {
    candidates.push("형법");
  }
  if (hasAnyTerm(text, ["명예훼손", "모욕", "비방", "허위사실", "사이버", "인스타그램", "단체채팅", "단톡", "카카오톡", "온라인"])) {
    candidates.push("형법", "정보통신망 이용촉진 및 정보보호 등에 관한 법률");
  }
  if (hasAnyTerm(text, ["손해배상", "민사", "치료비", "위자료", "불법행위", "배상", "합의금"])) {
    candidates.push("민법");
  }
  if (hasAnyTerm(text, ["아동학대", "정서학대", "생활지도 신고"])) {
    candidates.push("아동학대범죄의 처벌 등에 관한 특례법", "아동복지법");
  }
  if (hasAnyTerm(text, ["성폭력", "성추행", "성희롱", "성적", "불법촬영"])) {
    candidates.push("성폭력범죄의 처벌 등에 관한 특례법", "양성평등기본법", "남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률");
  }
  if (hasAnyTerm(text, ["스토킹", "지속적 연락", "따라다님", "접근금지"])) {
    candidates.push("스토킹범죄의 처벌 등에 관한 법률");
  }
  if (hasAnyTerm(text, ["개인정보", "민감정보", "상담내용", "유출", "누설"])) {
    candidates.push("개인정보 보호법");
  }
  if (hasAnyTerm(text, ["현장실습", "실습생", "직업계고", "특성화고", "취업", "도제", "일학습병행"])) {
    candidates.push("직업교육훈련 촉진법");
  }
  if (hasAnyTerm(text, ["도제", "일학습병행", "산학일체형"])) {
    candidates.push("산업현장 일학습병행 지원에 관한 법률");
  }
  if (hasAnyTerm(text, ["근로", "직원", "기간제", "계약", "해고", "직장내괴롭힘", "상급자", "야근", "임금", "연차", "재계약"])) {
    candidates.push("근로기준법", "기간제 및 단시간근로자 보호 등에 관한 법률");
  }
  if (hasAnyTerm(text, ["안전", "위험", "기계", "사고", "재해", "중대재해", "산재", "추락", "끼임", "골절"])) {
    candidates.push("산업안전보건법");
  }
  if (hasAnyTerm(text, ["중대재해", "사망"])) {
    candidates.push("중대재해 처벌 등에 관한 법률");
  }
  if (hasAnyTerm(text, ["학교폭력", "학폭", "괴롭힘", "단체채팅", "욕설", "피해학생"])) {
    candidates.push("학교폭력예방 및 대책에 관한 법률");
  }
  if (hasAnyTerm(text, ["학생관리", "생활지도", "교권", "학부모", "민원", "담임", "학교장", "교사"])) {
    candidates.push("초중등교육법", "행정절차법");
  }
  if (hasAnyTerm(text, ["해외", "호주", "글로벌", "파견", "숙소", "보험", "보호자"])) {
    candidates.push("직업교육훈련 촉진법", "청소년복지 지원법");
  }

  candidates.push("직업교육훈련 촉진법", "근로기준법");
  return uniqueStrings(candidates).slice(0, 4);
}

function buildOfficialSourceQuery({ question = "", topic = "", keywords = [], lawQueries = [] } = {}) {
  const keywordCandidates = asArray(keywords)
    .map((keyword) => cleanText(keyword))
    .filter((keyword) => isSafeOfficialKeyword(keyword))
    .slice(0, 4);

  if (keywordCandidates.length) {
    return keywordCandidates.join(" ");
  }

  const text = normalizeMatchText([topic, question].join(" "));
  const topicTerms = [];
  if (hasAnyTerm(text, ["현장실습", "실습생", "특성화고", "직업계고"])) topicTerms.push("현장실습");
  if (hasAnyTerm(text, ["청소", "업무외", "업무외지시", "심부름"])) topicTerms.push("업무 범위");
  if (hasAnyTerm(text, ["직장내괴롭힘", "상급자", "근로자", "직원", "폭언", "모욕"])) topicTerms.push("직장 내 괴롭힘");
  if (hasAnyTerm(text, ["기간제", "계약", "재계약", "해고"])) topicTerms.push("기간제 근로자");
  if (hasAnyTerm(text, ["중대재해", "산재", "사고", "안전", "위험"])) topicTerms.push("산업안전");
  if (hasAnyTerm(text, ["학교폭력", "학폭"])) topicTerms.push("학교폭력");
  if (hasAnyTerm(text, ["폭행", "상해", "협박", "고소", "고발", "형사", "벌금"])) topicTerms.push("형사 처벌");
  if (hasAnyTerm(text, ["손해배상", "민사", "치료비", "위자료", "불법행위"])) topicTerms.push("민사 손해배상");
  if (hasAnyTerm(text, ["명예훼손", "모욕", "사이버", "인스타그램", "단체채팅"])) topicTerms.push("명예훼손 모욕");
  if (hasAnyTerm(text, ["아동학대", "정서학대", "생활지도 신고"])) topicTerms.push("아동학대 생활지도");
  if (hasAnyTerm(text, ["민원", "학부모", "생활지도"])) topicTerms.push("학교 민원");
  if (hasAnyTerm(text, ["해외", "호주", "글로벌"])) topicTerms.push("해외 현장실습");

  const combined = uniqueStrings([...topicTerms, ...lawQueries.slice(0, 2)]).join(" ");
  return combined || "현장실습";
}

function isSafeOfficialKeyword(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 30) {
    return false;
  }
  if (/@|\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}/.test(text)) {
    return false;
  }
  return !/[<>{}[\]\\]/.test(text);
}

function normalizeProvidedLawQueries(laws = []) {
  return uniqueStrings(asArray(laws)
    .map((law) => cleanText(law))
    .filter((law) => isSafeLawQuery(law)));
}

function isSafeLawQuery(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 80) {
    return false;
  }
  if (/@|\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}/.test(text)) {
    return false;
  }
  return /법|시행령|시행규칙|규칙|고시|지침|매뉴얼|안내|판례|해석/.test(text);
}

function hasAnyTerm(text, terms) {
  return terms.some((term) => text.includes(normalizeMatchText(term)));
}

function uniqueStrings(items) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

async function searchLaws(openApiKey, queries, keywords = []) {
  const notices = [];
  const batches = await Promise.all(
    queries.map((query) => callLawSearch(openApiKey, {
      target: "law",
      search: "1",
      query,
      display: "4"
    }))
  );

  const items = [];
  for (const batch of batches) {
    notices.push(...batch.notices);
    items.push(...batch.items);
  }

  const uniqueItems = uniqueBy(items, "url").slice(0, 8);
  const enriched = await enrichLawItemsWithOriginalText(openApiKey, uniqueItems, keywords);
  return {
    items: enriched.items,
    notices: [...notices, ...enriched.notices]
  };
}

async function searchLawInterpretations(openApiKey, question) {
  const [general, labor] = await Promise.all([
    callLawSearch(openApiKey, {
      target: "expc",
      search: "2",
      query: question,
      display: "3"
    }),
    callLawSearch(openApiKey, {
      target: "moelCgmExpc",
      search: "2",
      query: question,
      display: "3"
    })
  ]);

  return {
    items: uniqueBy([...labor.items, ...general.items], "url").slice(0, 6),
    notices: [...labor.notices, ...general.notices]
  };
}

async function searchLawsWithPreferredSource({ lawOpenApiKey, lawQueries, hasKoreanLawMcp, keywords = [] }) {
  if (hasKoreanLawMcp) {
    const mcpResults = await searchLawsViaMcp(lawQueries, keywords);
    if (mcpResults.items.length || !hasUsableValue(lawOpenApiKey)) {
      return mcpResults;
    }

    const fallbackResults = await searchLaws(lawOpenApiKey, lawQueries, keywords);
    return {
      items: fallbackResults.items,
      notices: [
        ...mcpResults.notices,
        "Korean Law MCP 결과가 비어 있어 법제처 직접 API/원문 링크로 fallback 했습니다.",
        ...fallbackResults.notices
      ]
    };
  }

  return hasUsableValue(lawOpenApiKey)
    ? searchLaws(lawOpenApiKey, lawQueries, keywords)
    : missingKey("LAW_OPEN_API_OC 또는 KOREAN_LAW_MCP_BASE_URL");
}

async function searchInterpretationsWithPreferredSource({ lawOpenApiKey, question, hasKoreanLawMcp }) {
  if (hasKoreanLawMcp && isMcpResearchEnabled()) {
    const mcpResults = await searchLegalResearchViaMcp(question);
    if (mcpResults.items.length || !hasUsableValue(lawOpenApiKey)) {
      return mcpResults;
    }

    const fallbackResults = await searchLawInterpretations(lawOpenApiKey, question);
    return {
      items: fallbackResults.items,
      notices: [
        ...mcpResults.notices,
        "Korean Law MCP 종합 리서치 결과가 비어 있어 법제처 해석례 직접 API로 fallback 했습니다.",
        ...fallbackResults.notices
      ]
    };
  }

  return hasUsableValue(lawOpenApiKey)
    ? searchLawInterpretations(lawOpenApiKey, question)
    : missingKey("LAW_OPEN_API_OC");
}

async function searchLawsViaMcp(queries, keywords = []) {
  const gatewayResults = await callKoreanLawGatewaySearch(queries, keywords);
  if (gatewayResults.items.length) {
    return gatewayResults;
  }

  const batches = await Promise.all(queries.map((query) => callKoreanLawMcpTool("search_law", {
    query,
    display: 5
  })));
  const items = [];
  const notices = [...gatewayResults.notices];

  for (const batch of batches) {
    notices.push(...batch.notices);
    items.push(...batch.items);
  }

  return {
    items: uniqueBy(items, "url").slice(0, 8),
    notices
  };
}

async function callKoreanLawGatewaySearch(queries, keywords = []) {
  const baseUrl = getKoreanLawMcpBaseUrl();
  if (!hasUsableValue(baseUrl)) {
    return {
      items: [],
      notices: ["KOREAN_LAW_MCP_BASE_URL 값이 없어 법제처 원문 게이트웨이 검색을 건너뛰었습니다."]
    };
  }

  const headers = {
    accept: "application/json",
    "content-type": "application/json"
  };
  const token = cleanText(activeEnv.KOREAN_LAW_MCP_TOKEN || "");
  if (token) {
    headers["x-gyo6-mcp-token"] = token;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/gyo6/law/search-and-read`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        queries: queries.slice(0, 4),
        keywords: keywords.slice(0, 10),
        maxArticles: 8
      }),
      signal: AbortSignal.timeout(readNumber(activeEnv.KOREAN_LAW_MCP_TIMEOUT_MS) || 12000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    return {
      items: asArray(data.laws).map(buildKoreanLawGatewayItem).filter(Boolean),
      notices: [
        ...(data.ok ? ["법제처 원문 게이트웨이에서 현행 법령 원문 조문을 확인했습니다."] : []),
        ...asArray(data.notices)
      ]
    };
  } catch (error) {
    return {
      items: [],
      notices: [`법제처 원문 게이트웨이 호출 실패: ${error.message}`]
    };
  }
}

function buildKoreanLawGatewayItem(law) {
  if (!law?.lawName && !law?.sourceUrl) {
    return null;
  }

  const query = law.query || law.lawName || "";
  return {
    title: law.lawName || query || "법제처 원문 조회 결과",
    subtitle: law.enforcementDate ? `시행일자 ${law.enforcementDate}` : "현행 법령 원문",
    source: "국가법령정보센터 원문 API",
    date: law.enforcementDate || law.promulgationDate || "",
    summary: summarizeLawGatewayArticles(law),
    url: normalizeLawUrl(law.sourceUrl, query, "law"),
    query,
    type: "법령 원문 조문",
    verifiedAt: law.verifiedAt || new Date().toISOString(),
    articles: asArray(law.articles).slice(0, 8).map((article) => ({
      articleNo: cleanText(article.articleNo || ""),
      branchNo: cleanText(article.branchNo || ""),
      title: cleanText(article.title || ""),
      effectiveDate: cleanText(article.effectiveDate || law.enforcementDate || ""),
      text: truncateLongText(cleanLongText(article.text || ""), 900)
    })),
    reliability: {
      level: "law-api-original-text",
      label: "법제처 원문 확인",
      needsReview: false
    }
  };
}

function summarizeLawGatewayArticles(law) {
  const intro = [
    law.lawName,
    law.enforcementDate ? `시행일자 ${law.enforcementDate}` : "",
    law.promulgationDate ? `공포일자 ${law.promulgationDate}` : ""
  ].filter(Boolean).join(" · ");
  const articles = asArray(law.articles)
    .slice(0, 5)
    .map((article) => {
      const number = `제${article.articleNo}${article.branchNo ? `의${article.branchNo}` : ""}조`;
      const title = article.title ? `(${article.title})` : "";
      return `${number}${title}: ${truncateLongText(cleanLongText(article.text || ""), 220)}`;
    });

  return [intro, ...articles].filter(Boolean).join("\n");
}

async function searchLegalResearchViaMcp(question) {
  const result = await callKoreanLawMcpTool("chain_full_research", {
    query: question,
    scenario: "action_plan"
  });

  return {
    items: result.items.map((item) => ({
      ...item,
      type: "법령·판례·해석 종합",
      subtitle: "Korean Law MCP 종합 리서치"
    })),
    notices: result.notices
  };
}

async function callKoreanLawMcpTool(name, args) {
  const baseUrl = getKoreanLawMcpBaseUrl();
  if (!hasUsableValue(baseUrl)) {
    return {
      items: [],
      notices: ["KOREAN_LAW_MCP_BASE_URL 값이 없어 Korean Law MCP 검색을 건너뛰었습니다."]
    };
  }

  const headers = {
    accept: "application/json",
    "content-type": "application/json"
  };
  const token = cleanText(activeEnv.KOREAN_LAW_MCP_TOKEN || "");
  if (token) {
    headers["x-gyo6-mcp-token"] = token;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `gyo6-${Date.now()}`,
        method: "tools/call",
        params: {
          name,
          arguments: args
        }
      }),
      signal: AbortSignal.timeout(readNumber(activeEnv.KOREAN_LAW_MCP_TIMEOUT_MS) || 12000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      throw new Error(data?.error?.message || `HTTP ${response.status}`);
    }

    const text = extractMcpText(data);
    if (!text) {
      throw new Error("MCP 응답이 비어 있습니다.");
    }

    const query = cleanText(args.query || "");
    return {
      items: [buildKoreanLawMcpItem({ tool: name, query, text })],
      notices: [`Korean Law MCP ${name} 결과를 공식자료 후보로 반영했습니다.`]
    };
  } catch (error) {
    return {
      items: [],
      notices: [`Korean Law MCP ${name} 호출 실패: ${error.message}`]
    };
  }
}

function extractMcpText(data) {
  const content = data?.result?.content || data?.content || [];
  return asArray(content)
    .map((item) => typeof item?.text === "string" ? item.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function buildKoreanLawMcpItem({ tool, query, text }) {
  return {
    title: query || "Korean Law MCP 검색 결과",
    subtitle: tool === "search_law" ? "Korean Law MCP 법령 검색" : "Korean Law MCP 종합 리서치",
    source: "Korean Law MCP / 국가법령정보센터",
    date: "",
    summary: compactMcpText(text),
    url: `https://www.law.go.kr/LSW/lsSc.do?query=${encodeURIComponent(query || "")}`,
    query,
    type: tool === "search_law" ? "법령 검색" : "법령·판례·해석 종합",
    verifiedAt: new Date().toISOString(),
    reliability: {
      level: "mcp-source",
      label: "MCP 공식자료 조회",
      needsReview: false
    }
  };
}

function compactMcpText(text) {
  return String(text || "")
    .replace(/\[[A-Z_]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function callLawSearch(openApiKey, params) {
  const protocols = getLawApiProtocols();
  const errors = [];

  for (const protocol of protocols) {
    const url = buildLawSearchUrl(protocol, openApiKey, params);
    try {
      const data = await fetchJson(url, {
        headers: getLawOpenApiHeaders()
      });
      if (data?.result || data?.msg) {
        throw new Error([data.result, data.msg].filter(Boolean).join(" "));
      }
      return {
        items: normalizeLawItems(data, params.target, params.query),
        notices: protocol === protocols[0] ? [] : [`법제처 ${params.target} 검색은 ${protocol.toUpperCase()} 재시도로 성공했습니다.`]
      };
    } catch (error) {
      errors.push(`${protocol.toUpperCase()} ${error.message}`);
    }
  }

  const fallbackItem = buildLawApiFallbackItem(params);
  return {
    items: fallbackItem ? [fallbackItem] : [],
    notices: [`법제처 ${params.target} 검색 실패: ${errors.join(" / ")}. 공식 원문 검색 링크를 대신 표시합니다.`]
  };
}

async function enrichLawItemsWithOriginalText(openApiKey, items, keywords = []) {
  const enrichedItems = [];
  const notices = [];

  for (const item of items.slice(0, 4)) {
    if (!item.mst && !item.lawId) {
      enrichedItems.push(item);
      continue;
    }

    const result = await callLawOriginalText(openApiKey, item, keywords);
    notices.push(...result.notices);
    enrichedItems.push(result.item || item);
  }

  return {
    items: [...enrichedItems, ...items.slice(4)],
    notices
  };
}

async function callLawOriginalText(openApiKey, item, keywords = []) {
  const protocols = getLawApiProtocols();
  const errors = [];

  for (const protocol of protocols) {
    try {
      const data = await fetchJson(buildLawServiceUrl(protocol, openApiKey, item), {
        headers: getLawOpenApiHeaders()
      });
      if (data?.result || data?.msg) {
        throw new Error([data.result, data.msg].filter(Boolean).join(" "));
      }

      const lawText = normalizeLawOriginalText(data);
      const articles = selectRelevantLawArticles(lawText.articles, keywords, 8);
      if (!articles.length) {
        throw new Error("조문 본문이 비어 있습니다.");
      }

      const law = {
        query: item.query,
        lawName: lawText.lawName || item.title,
        promulgationDate: lawText.promulgationDate || "",
        enforcementDate: lawText.enforcementDate || item.date || "",
        sourceUrl: item.url,
        articles
      };

      return {
        item: {
          ...item,
          title: law.lawName,
          subtitle: law.enforcementDate ? `시행일자 ${law.enforcementDate}` : item.subtitle,
          source: "국가법령정보센터 원문 API",
          date: law.enforcementDate || item.date,
          summary: summarizeLawGatewayArticles(law),
          type: "법령 원문 조문",
          verifiedAt: new Date().toISOString(),
          articles,
          reliability: {
            level: "law-api-original-text",
            label: "법제처 원문 확인",
            needsReview: false
          }
        },
        notices: [protocol === protocols[0]
          ? `법제처 원문 API에서 ${law.lawName} 조문을 확인했습니다.`
          : `법제처 원문 API는 ${protocol.toUpperCase()} 재시도로 ${law.lawName} 조문을 확인했습니다.`]
      };
    } catch (error) {
      errors.push(`${protocol.toUpperCase()} ${error.message}`);
    }
  }

  return {
    item,
    notices: [`법제처 원문 조문 조회 실패(${item.title}): ${errors.join(" / ")}`]
  };
}

function buildLawServiceUrl(protocol, openApiKey, item) {
  const url = new URL(`${protocol}://www.law.go.kr/DRF/lawService.do`);
  url.searchParams.set("OC", openApiKey);
  url.searchParams.set("target", "eflaw");
  url.searchParams.set("type", "JSON");
  if (item.mst) {
    url.searchParams.set("MST", item.mst);
  } else if (item.lawId) {
    url.searchParams.set("ID", item.lawId);
  }
  return url;
}

function normalizeLawOriginalText(data) {
  const law = data?.법령 || data?.Law || data || {};
  const info = law.기본정보 || law.basicInfo || {};
  const rawUnits = law?.조문?.조문단위 || law?.articles || [];
  const articles = asArray(rawUnits)
    .filter((unit) => String(unit?.조문여부 || unit?.articleType || "조문") === "조문")
    .map((unit) => ({
      articleNo: cleanText(getValue(unit, ["조문번호", "articleNo"])),
      branchNo: cleanText(getValue(unit, ["조문가지번호", "branchNo"])),
      title: cleanText(getValue(unit, ["조문제목", "title"])),
      effectiveDate: formatDate(getValue(unit, ["조문시행일자", "effectiveDate"])),
      text: truncateLongText(cleanLongText([
        getValue(unit, ["조문내용", "text"]),
        ...asArray(unit.항).map((hang) => [
          getValue(hang, ["항번호"]),
          getValue(hang, ["항내용"]),
          ...asArray(hang.호).map((ho) => `${getValue(ho, ["호번호"])} ${getValue(ho, ["호내용"])}`)
        ].filter(Boolean).join(" "))
      ].filter(Boolean).join("\n")), 900)
    }))
    .filter((article) => article.articleNo && article.text);

  return {
    lawName: cleanText(getValue(info, ["법령명_한글", "법령명한글", "법령명"])),
    promulgationDate: formatDate(getValue(info, ["공포일자"])),
    enforcementDate: formatDate(getValue(info, ["시행일자"])),
    articles
  };
}

function selectRelevantLawArticles(articles, keywords = [], limit = 8) {
  const normalizedKeywords = keywords.map(normalizeMatchText).filter((item) => item.length >= 2);
  const scored = articles.map((article) => {
    const haystack = normalizeMatchText(`${article.title} ${article.text}`);
    const score = normalizedKeywords.reduce((sum, keyword) => sum + (haystack.includes(keyword) ? 1 : 0), 0);
    return { article, score };
  });
  const matched = scored.filter((item) => item.score > 0).sort((left, right) => right.score - left.score);
  return (matched.length ? matched : scored).slice(0, limit).map((item) => item.article);
}

function buildLawSearchUrl(protocol, openApiKey, params) {
  const url = new URL(`${protocol}://www.law.go.kr/DRF/lawSearch.do`);
  url.searchParams.set("OC", openApiKey);
  url.searchParams.set("type", "JSON");
  url.searchParams.set("page", "1");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

function buildLawApiFallbackItem(params) {
  if (params.target !== "law" || !params.query) {
    return null;
  }

  return {
    title: params.query,
    subtitle: "국가법령정보센터 직접 검색",
    source: "국가법령정보센터",
    date: "",
    summary: "API 자동 조회가 실패했으므로 원문 검색 링크에서 현행 여부와 조문을 직접 확인해야 합니다.",
    url: `https://www.law.go.kr/LSW/lsSc.do?query=${encodeURIComponent(params.query)}`,
    query: params.query,
    type: "법령 원문 검색",
    verifiedAt: new Date().toISOString(),
    reliability: {
      level: "manual-source-link",
      label: "직접 확인 필요",
      needsReview: true
    }
  };
}

function getLawOpenApiHeaders() {
  const referer = normalizeReferer(activeEnv.LAW_OPEN_API_REFERER || activeEnv.PUBLIC_SITE_URL || "https://gyo6.kr/");

  if (!referer) {
    return {};
  }

  return {
    Referer: referer,
    Origin: new URL(referer).origin
  };
}

function getLawApiProtocols() {
  const requested = cleanText(activeEnv.LAW_API_PROTOCOL || "").toLowerCase();
  if (requested === "http") {
    return ["http", "https"];
  }
  if (requested === "https") {
    return ["https", "http"];
  }
  return ["https", "http"];
}

async function searchDisasterCases(publicDataKey, safetyContext) {
  const queries = safetyContext.disasterQueries.length ? safetyContext.disasterQueries : ["안전사고"];
  const batches = await Promise.all(queries.map((query) => callDisasterCases(publicDataKey, query)));
  const items = [];
  const notices = [];

  for (const batch of batches) {
    notices.push(...batch.notices);
    items.push(...batch.items);
  }

  const uniqueItems = uniqueByValue(items, getPublicDataIdentity);
  const scoredItems = uniqueItems
    .map((item) => attachDisasterRelevance(item, safetyContext))
    .sort((left, right) => right.relevance.score - left.relevance.score);
  const selectedItems = scoredItems
    .filter((item) => shouldKeepDisasterCandidate(item, safetyContext))
    .slice(0, 3);

  const hiddenCount = Math.max(scoredItems.length - selectedItems.length, 0);
  if (hiddenCount > 0) {
    notices.push(`국내재해사례 ${hiddenCount}건은 사고유형·작업상황 관련도가 낮아 표시하지 않았습니다.`);
  }
  if (!selectedItems.length && uniqueItems.length) {
    notices.push("국내재해사례는 조회되었지만 질문과 충분히 일치하는 정밀 후보가 없어 숨겼습니다.");
  }

  return {
    items: selectedItems,
    notices
  };
}

async function callDisasterCases(publicDataKey, keyword) {
  const url = new URL("http://apis.data.go.kr/B552468/disaster_api02/getdisaster_api02");
  url.searchParams.set("serviceKey", publicDataKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "12");
  url.searchParams.set("callApiId", "1060");
  if (keyword) {
    url.searchParams.set("keyword", keyword);
  }

  try {
    const data = await fetchJson(url);
    return {
      items: normalizePublicDataItems(data, "국내재해사례", "한국산업안전보건공단", keyword),
      notices: []
    };
  } catch (error) {
    return {
      items: [],
      notices: [`국내재해사례 ${keyword ? `"${keyword}" ` : ""}검색 실패: ${error.message}`]
    };
  }
}

async function searchSafetyMaterials(publicDataKey) {
  const url = new URL("http://apis.data.go.kr/B552468/selectMediaList01/getselectMediaList01");
  url.searchParams.set("serviceKey", publicDataKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "5");
  url.searchParams.set("callApiId", "1030");
  url.searchParams.set("ctgr04_kr", "Y");

  try {
    const data = await fetchJson(url);
    return {
      items: normalizePublicDataItems(data, "안전보건자료", "한국산업안전보건공단"),
      notices: []
    };
  } catch (error) {
    return {
      items: [],
      notices: [`안전보건자료 검색 실패: ${error.message}`]
    };
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("JSON 응답이 아닙니다.");
    }
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeLawItems(data, target, query) {
  const root = data?.LawSearch || data?.lawSearch || data || {};
  const rawItems =
    root.law ||
    root.expc ||
    root.MoelCgmExpc ||
    root.moelCgmExpc ||
    root.item ||
    root.items ||
    [];

  return asArray(rawItems).map((item) => {
    const title =
      getValue(item, ["법령명한글", "법령명", "안건명", "해석례명", "법령해석례명", "title"]) ||
      query;
    const subtitle =
      getValue(item, ["소관부처명", "해석기관명", "질의기관명", "회신기관명", "법령구분명"]) ||
      getLawTargetLabel(target);
    const date =
      formatDate(getValue(item, ["시행일자", "공포일자", "해석일자", "회신일자", "date"])) ||
      "";
    const detailLink = getValue(item, ["법령상세링크", "상세링크", "본문상세링크", "법령해석례상세링크"]);
    const mst = getValue(item, ["법령일련번호", "MST", "mst"]);
    const lawId = getValue(item, ["법령ID", "ID", "lawId"]);

    return {
      title: String(title),
      subtitle: String(subtitle),
      source: "국가법령정보센터",
      date,
      summary: getValue(item, ["제개정구분명", "안건번호", "질의요지", "summary"]) || "",
      url: normalizeLawUrl(detailLink, query, target),
      query,
      type: getLawTargetLabel(target),
      mst,
      lawId,
      verifiedAt: new Date().toISOString(),
      reliability: getReliabilityStatus(detailLink, date)
    };
  }).filter((item) => item.title);
}

function normalizePublicDataItems(data, type, source, query = "") {
  const root = data?.response || data || {};
  const body = root.body || root.Body || root;
  const rawItems =
    body?.items?.item ||
    body?.items ||
    body?.item ||
    body?.list ||
    body?.data ||
    [];

  return asArray(rawItems).map((item) => {
    const title =
      getValue(item, ["title", "ttl", "sj", "bbsSj", "subject", "mediaSj", "dataNm", "cntntsSj", "keyword", "MED_SJ_NM", "제목"]) ||
      type;
    const subtitle =
      getValue(item, ["business", "ctgrNm", "ctgr01Nm", "ctgr02Nm", "MED_TYPE_NM", "업종", "분류"]) ||
      type;
    const date =
      formatDate(getValue(item, ["regDate", "regDt", "wrtDt", "date", "MED_COMPY_DY", "등록일", "작성일"])) ||
      "";
    const summary =
      getValue(item, ["cn", "contents", "content", "summary", "desc", "MED_DESC", "내용", "설명"]) ||
      "";
    const url =
      getValue(item, ["url", "link", "linkUrl", "fileUrl", "atchFileUrl", "cntntsUrl", "MED_URL", "상세URL"]) ||
      "";

    return {
      title: String(title),
      subtitle: String(subtitle),
      source,
      date,
      summary: cleanPublicDataSummary(summary).slice(0, 180),
      url: normalizeUrl(url),
      query,
      type,
      verifiedAt: new Date().toISOString(),
      reliability: getReliabilityStatus(url, date)
    };
  }).filter((item) => item.title);
}

function getReliabilityStatus(url, date) {
  const hasSourceUrl = Boolean(url);
  const hasDate = Boolean(date);

  if (hasSourceUrl && hasDate) {
    return {
      level: "source-dated",
      label: "원문·일자 확인",
      needsReview: false
    };
  }

  if (hasSourceUrl) {
    return {
      level: "source-only",
      label: "원문 확인 필요",
      needsReview: true
    };
  }

  return {
    level: "needs-review",
    label: "출처 확인 필요",
    needsReview: true
  };
}

function getValue(object, keys) {
  if (!object || typeof object !== "object") {
    return "";
  }

  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null && object[key] !== "") {
      return object[key];
    }
  }

  return "";
}

function normalizeLawUrl(detailLink, query, target) {
  const fallbackUrl = buildLawSearchPageUrl(query || getLawTargetLabel(target));

  if (detailLink) {
    const value = String(detailLink).trim();
    const absoluteUrl = value.startsWith("http")
      ? value
      : value.startsWith("/")
        ? `https://www.law.go.kr${value}`
        : `https://www.law.go.kr${value.startsWith("DRF") ? "/" : ""}${value}`;

    try {
      const url = new URL(absoluteUrl);
      if (/law\.go\.kr$/i.test(url.hostname)) {
        for (const key of ["OC", "serviceKey", "apiKey", "apikey", "key", "KEY"]) {
          url.searchParams.delete(key);
        }

        if (/\/DRF\/law(Service|Search)\.do$/i.test(url.pathname)) {
          return fallbackUrl;
        }

        return url.toString();
      }
    } catch {
      return fallbackUrl;
    }
  }

  return fallbackUrl;
}

function buildLawSearchPageUrl(query) {
  const searchUrl = new URL("https://www.law.go.kr/LSW/lsSc.do");
  searchUrl.searchParams.set("query", query || "법령");
  return searchUrl.toString();
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  const text = String(value);
  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  if (text.startsWith("/")) {
    return `https://www.kosha.or.kr${text}`;
  }

  return text;
}

function cleanPublicDataSummary(value) {
  return String(value || "")
    .replace(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*00\s*(?:\([^)]+\))?/g, (_, year, month) => {
      return `${year}.${String(Number(month)).padStart(2, "0")}.(일자 확인 필요)`;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeReferer(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function getLawTargetLabel(target) {
  const labels = {
    law: "법령",
    expc: "법령해석례",
    moelCgmExpc: "고용노동부 법령해석"
  };
  return labels[target] || target;
}

const safetySignalCatalog = {
  accident: [
    { label: "끼임·말림", query: "끼임", terms: ["끼임", "끼인", "끼여", "끼였", "협착", "말림", "말려", "감김", "감겨"] },
    { label: "부딪힘·충돌", query: "부딪힘", terms: ["부딪", "충돌", "충격", "부딪힘", "부딪혀", "맞음", "가격"] },
    { label: "떨어짐·추락", query: "추락", terms: ["추락", "떨어짐", "떨어져", "떨어", "고소작업"] },
    { label: "깔림·매몰·붕괴", query: "깔림", terms: ["깔림", "깔려", "매몰", "붕괴", "무너", "넘어져 깔"] },
    { label: "절단·베임", query: "절단", terms: ["절단", "잘림", "베임", "절상", "절삭"] },
    { label: "감전", query: "감전", terms: ["감전", "전류", "전기"] },
    { label: "화재·폭발", query: "화재", terms: ["화재", "폭발", "발화"] },
    { label: "화상", query: "화상", terms: ["화상", "고온", "열상"] },
    { label: "질식·중독", query: "질식", terms: ["질식", "중독", "유해가스", "산소결핍"] }
  ],
  equipment: [
    { label: "동력 기계·설비", query: "기계", terms: ["기계", "설비", "장비", "공작기계", "CNC", "선반", "밀링", "프레스", "롤러", "컨베이어", "벨트", "풀리", "그라인더", "절단기", "톱", "사출", "금형"] },
    { label: "운반장비", query: "지게차", terms: ["지게차", "차량", "트럭", "운반차", "카트"] },
    { label: "고소·인양장비", query: "크레인", terms: ["크레인", "리프트", "승강기", "사다리", "비계", "고소작업대", "데크플레이트"] },
    { label: "전기설비", query: "전기", terms: ["전기", "분전반", "전선", "전동", "전류", "전압"] }
  ],
  task: [
    { label: "정비·청소·점검", query: "정비", terms: ["정비", "청소", "점검", "수리", "교체", "조정", "제거", "보수"] },
    { label: "작업 보조·지원", query: "보조", terms: ["친구", "동료", "도움", "도우", "보조", "지원", "같이", "대신"] },
    { label: "운반·이송", query: "운반", terms: ["운반", "이송", "적재", "하역", "이동"] },
    { label: "설치·해체", query: "설치", terms: ["설치", "해체", "조립", "분해"] },
    { label: "조작·가공", query: "조작", terms: ["조작", "가공", "운전", "작동", "투입"] }
  ],
  body: [
    { label: "팔·손 부상", query: "팔", terms: ["팔", "손", "손가락", "상지", "어깨", "손목"] },
    { label: "다리·발 부상", query: "다리", terms: ["다리", "발", "발목", "하지", "무릎"] },
    { label: "머리·몸통 부상", query: "머리", terms: ["머리", "두부", "얼굴", "허리", "가슴", "몸통"] }
  ],
  injury: [
    { label: "골절", query: "골절", terms: ["골절", "부러", "전치", "수술"] },
    { label: "절단", query: "절단", terms: ["절단", "절단상", "절단됨"] },
    { label: "사망·중상", query: "중상", terms: ["사망", "중상", "장해", "입원"] }
  ],
  context: [
    { label: "현장실습·학생", query: "현장실습", terms: ["현장실습", "실습생", "학생", "학교", "지도교사", "산업체"] }
  ]
};

function buildSafetyContext(question, keywords, topic) {
  const text = `${question} ${keywords.join(" ")}`;
  const groups = Object.fromEntries(
    Object.entries(safetySignalCatalog).map(([name, signals]) => [name, collectSignals(text, signals)])
  );
  const disasterQueries = buildDisasterQueries(groups, keywords, topic);

  return {
    topic,
    text: normalizeMatchText(text),
    groups,
    disasterQueries
  };
}

function collectSignals(text, signals) {
  const normalized = normalizeMatchText(text);
  return signals
    .filter((signal) => signal.terms.some((term) => normalized.includes(normalizeMatchText(term))))
    .map((signal) => ({
      ...signal,
      matchedTerms: signal.terms.filter((term) => normalized.includes(normalizeMatchText(term)))
    }));
}

function buildDisasterQueries(groups, keywords, topic) {
  const terms = [
    ...groups.accident.map((item) => item.query),
    ...groups.equipment.map((item) => item.query),
    ...groups.task.map((item) => item.query),
    ...groups.injury.map((item) => item.query)
  ];

  if ((topic === "fieldTraining" || topic === "schoolSafety") && !terms.length) {
    terms.push("안전사고");
  }

  for (const keyword of keywords) {
    if (keyword.length >= 2) {
      terms.push(keyword);
    }
  }

  return [...new Set(terms.map((item) => cleanText(item)).filter(Boolean))].slice(0, 6);
}

function attachDisasterRelevance(item, safetyContext) {
  const relevance = scoreDisasterRelevance(item, safetyContext);
  return {
    ...item,
    relevance,
    reliability: {
      ...(item.reliability || {}),
      label: relevance.label,
      needsReview: relevance.score < 70 || item.reliability?.needsReview
    }
  };
}

function scoreDisasterRelevance(item, safetyContext) {
  const text = normalizeMatchText([item.title, item.subtitle, item.summary].filter(Boolean).join(" "));
  const matched = {
    accident: matchSignals(text, safetyContext.groups.accident),
    equipment: matchSignals(text, safetyContext.groups.equipment),
    task: matchSignals(text, safetyContext.groups.task),
    body: matchSignals(text, safetyContext.groups.body),
    injury: matchSignals(text, safetyContext.groups.injury),
    context: matchSignals(text, safetyContext.groups.context)
  };
  const conflictingAccidents = findConflictingAccidents(text, safetyContext.groups.accident);
  const exactEquipmentTerms = getSpecificEquipmentTerms(safetyContext.groups.equipment);
  const exactEquipmentMatched = exactEquipmentTerms.filter((term) => text.includes(normalizeMatchText(term)));
  let score = 0;

  score += matched.accident.length ? 42 : 0;
  score += matched.equipment.length ? 24 : 0;
  score += matched.task.length ? 14 : 0;
  score += matched.body.length ? 8 : 0;
  score += matched.injury.length ? 8 : 0;
  score += matched.context.length ? 6 : 0;
  score += item.url ? 4 : 0;
  score += item.date ? 4 : 0;

  const accidentRequired = safetyContext.groups.accident.length > 0;
  if (accidentRequired && !matched.accident.length) {
    score -= 35;
  }
  if (conflictingAccidents.length && !matched.accident.length) {
    score -= 25;
  }
  if (exactEquipmentTerms.length) {
    if (exactEquipmentMatched.length) {
      score += 18;
    } else {
      score -= 30;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const matchedSignals = Object.values(matched).flat();
  const label = score >= 70 ? "정밀 일치" : score >= 55 ? "참고 가능" : "관련도 낮음";
  const reason = buildRelevanceReason(score, matched, conflictingAccidents, accidentRequired);

  return {
    score,
    label,
    reason,
    matchedSignals: [...new Set(matchedSignals)],
    conflicts: conflictingAccidents,
    exactEquipment: {
      required: exactEquipmentTerms,
      matched: exactEquipmentMatched
    },
    coreMatched: {
      accident: matched.accident.length > 0,
      equipment: matched.equipment.length > 0,
      task: matched.task.length > 0,
      injury: matched.injury.length > 0
    }
  };
}

function matchSignals(text, signals) {
  return signals
    .filter((signal) => signal.terms.some((term) => text.includes(normalizeMatchText(term))))
    .map((signal) => signal.label);
}

function findConflictingAccidents(text, selectedAccidents) {
  const selectedLabels = new Set(selectedAccidents.map((item) => item.label));
  return safetySignalCatalog.accident
    .filter((signal) => !selectedLabels.has(signal.label))
    .filter((signal) => signal.terms.some((term) => text.includes(normalizeMatchText(term))))
    .map((signal) => signal.label);
}

function buildRelevanceReason(score, matched, conflicts, accidentRequired) {
  if (score >= 70) {
    return `사고유형(${matched.accident.join(", ") || "확인 필요"})과 설비·작업 맥락이 함께 맞는 정밀 후보입니다.`;
  }

  if (score >= 55) {
    return "사고유형은 맞지만 설비, 작업상황, 부상 부위 중 일부가 달라 보조 사례로만 참고하세요.";
  }

  if (accidentRequired && !matched.accident.length) {
    return "질문 속 핵심 사고유형과 일치하지 않아 표시 대상에서 제외했습니다.";
  }

  if (conflicts.length) {
    return `다른 사고유형(${conflicts.join(", ")}) 신호가 강해 혼동 가능성이 있습니다.`;
  }

  return "질문과 직접 연결되는 신호가 부족합니다.";
}

function shouldKeepDisasterCandidate(item, safetyContext) {
  const relevance = item.relevance || {};
  const accidentRequired = safetyContext.groups.accident.length > 0;
  const exactEquipmentRequired = relevance.exactEquipment?.required?.length > 0;

  if (accidentRequired && !relevance.coreMatched?.accident) {
    return false;
  }

  if (exactEquipmentRequired && !relevance.exactEquipment?.matched?.length) {
    return false;
  }

  if (accidentRequired) {
    return relevance.score >= 55 && (relevance.coreMatched.equipment || relevance.coreMatched.task || relevance.coreMatched.injury);
  }

  return relevance.score >= 50;
}

function normalizeMatchText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function getSpecificEquipmentTerms(equipmentSignals) {
  const genericTerms = new Set(["기계", "설비", "장비", "공작기계", "전동"]);
  return [...new Set(
    equipmentSignals
      .flatMap((signal) => signal.matchedTerms || [])
      .filter((term) => !genericTerms.has(term) && normalizeMatchText(term).length >= 2)
  )];
}

function parseList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(/[|,]/)
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 12);
}

function hasUsableValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  return !/(나중|대기|신청|준비|pending|todo|none|null)/i.test(text);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function cleanLongText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateLongText(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function cleanUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  try {
    return new URL(text).toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key] || item.title;
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function uniqueByValue(items, getValueForItem) {
  const seen = new Set();
  return items.filter((item) => {
    const value = getValueForItem(item);
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function getPublicDataIdentity(item) {
  if (item.url) {
    return item.url;
  }

  return normalizeMatchText([item.title, item.date].filter(Boolean).join("|"));
}

function uniqueString(value, index, values) {
  return values.indexOf(value) === index;
}

function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/\D/g, "");
  const match = compact.length === 8
    ? [compact, compact.slice(0, 4), compact.slice(4, 6), compact.slice(6, 8)]
    : raw.match(/(\d{4})\D*(\d{1,2})\D*(\d{1,2})/);

  if (!match) {
    return value ? String(value) : "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }

  return `${String(year).padStart(4, "0")}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}
