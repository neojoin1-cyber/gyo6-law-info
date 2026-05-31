import { createApi as createOfficialSourceApi } from "../../../functions/shared/api.mjs";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

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

const FIREBASE_CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const APPROVED_MEMBER_STATUSES = new Set(["approved"]);
const LAW_ACCESS_ROLES = new Set(["law", "teacher", "admin", "owner"]);
const ADMIN_ROLES = new Set(["admin", "owner"]);
const OWNER_ROLES = new Set(["owner"]);
const MEMBER_ROLES = ["pending", "general", "jobs", "law", "teacher", "admin", "owner"];
const MEMBER_STATUSES = ["pending", "approved", "suspended", "deleted"];
let firebaseCertCache = null;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const corsHeaders = getCorsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      const url = new URL(request.url);

      if (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/api/health") {
        return sendJson({
          ok: true,
          service: "gyo6-law-info-ai",
          openAi: Boolean(env.OPENAI_API_KEY),
          model: env.OPENAI_MODEL || "gpt-5.2",
          auth: {
            required: isAuthRequired(env),
            firebaseProjectId: cleanText(env.FIREBASE_PROJECT_ID || ""),
            memberDb: Boolean(env.MEMBER_DB)
          },
          sources: {
            koreanLawMcp: Boolean(cleanText(env.KOREAN_LAW_MCP_BASE_URL || "")),
            officialSourcePrefetch: String(env.OFFICIAL_SOURCE_PREFETCH || "true").toLowerCase() !== "false"
          },
          costControl: getCostControlSettings(env)
        }, 200, corsHeaders);
      }

      if (url.pathname === "/api/analyze" || url.pathname === "/analyze") {
        if (request.method !== "GET" && request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const payload = request.method === "POST"
          ? await readJsonBody(request)
          : Object.fromEntries(url.searchParams.entries());

        const authContext = await getOptionalAuthContext(request, env);
        const result = await handleAnalyze(payload, env, authContext);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/search" || url.pathname === "/search") {
        if (request.method !== "GET") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const officialSourceApi = createOfficialSourceApi(env);
        const result = await officialSourceApi.handleSearch(url);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/member/me") {
        const authContext = await requireAuthContext(request, env);
        if (authContext.error) {
          return sendJson(authContext, authContext.status || 401, corsHeaders);
        }

        const body = request.method === "POST" ? await readJsonBody(request) : {};
        const result = request.method === "POST"
          ? await upsertMemberProfile(authContext.user, body, env)
          : await getMemberProfile(authContext.user, env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/member/register") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const authContext = await requireAuthContext(request, env);
        if (authContext.error) {
          return sendJson(authContext, authContext.status || 401, corsHeaders);
        }

        const result = await registerMember(authContext.user, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/members") {
        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await listMembers(env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/member") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await updateMemberByAdmin(adminContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/member/delete") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await softDeleteMember(adminContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/member/invite") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await createMemberInvitation(adminContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      return sendJson({ error: "지원하지 않는 경로입니다." }, 404, corsHeaders);
    } catch (error) {
      return sendJson({
        error: "AI 분석 처리 중 오류가 발생했습니다.",
        detail: error.message
      }, 500, corsHeaders);
    }
  }
};

async function handleAnalyze(payload, env, authContext = null) {
  const question = cleanText(payload.q || payload.question || "");
  const topic = cleanText(payload.topic || "general");
  const role = cleanText(payload.role || "auto");
  const partyRole = cleanText(payload.partyRole || payload.party || "auto");
  const mode = cleanText(payload.mode || "intake");
  const caseId = cleanText(payload.caseId || "");
  const laws = parsePayloadList(payload.laws);
  const keywords = parsePayloadList(payload.keywords);
  const topicContext = sanitizeTopicContext(payload.topicContext);

  if (!question) {
    return { error: "질문이 비어 있습니다." };
  }

  const access = await assertLawAccess(authContext, env);
  if (!access.ok) {
    return {
      error: access.message,
      code: access.code,
      status: access.status || 403
    };
  }

  if (!env.OPENAI_API_KEY) {
    return {
      error: "OPENAI_API_KEY secret이 설정되어 있지 않습니다.",
      fallback: true
    };
  }

  const primaryModel = cleanText(env.OPENAI_MODEL || "gpt-5.2");
  const fallbackModel = cleanText(env.OPENAI_FALLBACK_MODEL || "gpt-4.1");
  const models = [...new Set([primaryModel, fallbackModel].filter(Boolean))];
  const errors = [];
  const officialSources = await loadOfficialSourceContext({
    question,
    topic,
    laws,
    keywords
  }, env);

  for (const model of models) {
    try {
      const aiResult = await callOpenAiLegalAnalysis(env.OPENAI_API_KEY, {
        model,
        question,
        topic,
        role,
        partyRole,
        topicContext,
        mode,
        officialSources
      }, env);

      return {
        ok: true,
        caseId,
        engine: "cloudflare-worker-openai-responses",
        model,
        generatedAt: new Date().toISOString(),
        analysis: aiResult.analysis,
        usage: aiResult.usage,
        billing: aiResult.billing,
        officialSources,
        sourceGrounding: summarizeSourceGrounding(officialSources),
        member: access.member ? sanitizeMember(access.member) : null,
        costControl: getCostControlSettings(env)
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

async function callOpenAiLegalAnalysis(openAiKey, payload, env = {}) {
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
                currentDate: new Date().toISOString().slice(0, 10),
                servicePurpose: "특성화고 학생, 교사, 학부모, 학교 관리자를 위한 법률정보 안내",
                topic: payload.topic,
                role: payload.role,
                partyRole: payload.partyRole,
                topicContext: payload.topicContext,
                mode: payload.mode,
                question: payload.question,
                officialSources: payload.officialSources || null
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
    })
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
      billing: estimateOpenAiBilling(usage, payload.model, env)
    };
  } catch (error) {
    throw new Error(`AI 분석 JSON 파싱 실패: ${error.message}`);
  }
}

async function loadOfficialSourceContext(payload, env) {
  if (String(env.OFFICIAL_SOURCE_PREFETCH || "true").toLowerCase() === "false") {
    return null;
  }

  try {
    const sourceApi = createOfficialSourceApi(env);
    const url = new URL("https://gyo6.internal/api/search");
    url.searchParams.set("q", payload.question);
    url.searchParams.set("topic", payload.topic || "general");
    if (payload.laws?.length) {
      url.searchParams.set("laws", payload.laws.slice(0, 5).join("|"));
    }
    if (payload.keywords?.length) {
      url.searchParams.set("keywords", payload.keywords.slice(0, 8).join("|"));
    }

    return compactOfficialSourceContext(await sourceApi.handleSearch(url));
  } catch (error) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      notices: [`공식자료 사전 확인 실패: ${error.message}`],
      results: {}
    };
  }
}

function compactOfficialSourceContext(data = {}) {
  const results = data.results || {};
  const compactResults = {
    laws: compactSourceItems(results.laws, 4),
    precedents: compactSourceItems(results.precedents, 3),
    interpretations: compactSourceItems(results.interpretations, 3),
    educationInterpretations: compactSourceItems(results.educationInterpretations, 3),
    educationAdminRules: compactSourceItems(results.educationAdminRules, 3),
    safetyDisasters: compactSourceItems(results.safetyDisasters, 3),
    safetyMaterials: compactSourceItems(results.safetyMaterials, 3)
  };

  return {
    ok: !data.error,
    checkedAt: data.verification?.checkedAt || data.generatedAt || new Date().toISOString(),
    status: data.status || {},
    notices: asArray(data.notices).slice(0, 6),
    results: compactResults,
    sourceReferenceIndex: buildSourceReferenceIndex(compactResults)
  };
}

function buildSourceReferenceIndex(results = {}) {
  const references = [];
  for (const law of asArray(results.laws)) {
    for (const article of asArray(law.articles)) {
      references.push({
        citation: formatArticleCitation(law, article),
        lawName: cleanText(law.title || ""),
        articleNo: cleanText(article.articleNo || ""),
        branchNo: cleanText(article.branchNo || ""),
        articleTitle: cleanText(article.title || ""),
        effectiveDate: cleanText(article.effectiveDate || law.date || ""),
        source: cleanText(law.source || ""),
        url: cleanText(law.url || ""),
        text: truncateText(cleanText(article.text || ""), 260)
      });
    }
  }
  return references.slice(0, 20);
}

function formatArticleCitation(law, article) {
  const lawName = cleanText(law.title || "법령");
  const articleNumber = formatArticleNumber(article);
  const title = cleanText(article.title || "");
  const effectiveDate = cleanText(article.effectiveDate || law.date || "");
  return [
    `${lawName} ${articleNumber}${title ? `(${title})` : ""}`,
    effectiveDate ? `시행 ${effectiveDate}` : ""
  ].filter(Boolean).join(" · ");
}

function formatArticleNumber(article) {
  const articleNo = cleanText(article.articleNo || "");
  const branchNo = cleanText(article.branchNo || "");
  if (!articleNo) {
    return "조문번호 확인 필요";
  }
  return branchNo ? `제${articleNo}조의${branchNo}` : `제${articleNo}조`;
}

function compactSourceItems(items, limit) {
  return asArray(items).slice(0, limit).map((item) => ({
    title: cleanText(item.title || ""),
    type: cleanText(item.type || ""),
    source: cleanText(item.source || ""),
    courtName: cleanText(item.courtName || item.court || ""),
    caseNumber: cleanText(item.caseNumber || item.caseNo || ""),
    decisionDate: cleanText(item.decisionDate || item.sentencedAt || item.date || ""),
    caseType: cleanText(item.caseType || ""),
    relatedLaws: asArray(item.relatedLaws || item.referencedLaws).slice(0, 5).map((law) => cleanText(law)).filter(Boolean),
    date: cleanText(item.date || ""),
    summary: truncateText(cleanText(item.summary || ""), 520),
    url: cleanText(item.url || ""),
    currentStatus: cleanText(item.currentStatus || ""),
    current: Boolean(item.current),
    relevance: item.relevance ? {
      score: Number(item.relevance.score || 0),
      label: cleanText(item.relevance.label || ""),
      reason: truncateText(cleanText(item.relevance.reason || ""), 220),
      matchedSignals: asArray(item.relevance.matchedSignals).slice(0, 6).map((signal) => cleanText(signal)).filter(Boolean)
    } : null,
    articles: asArray(item.articles).slice(0, 5).map((article) => ({
      articleNo: cleanText(article.articleNo || ""),
      branchNo: cleanText(article.branchNo || ""),
      title: cleanText(article.title || ""),
      effectiveDate: cleanText(article.effectiveDate || ""),
      text: truncateText(cleanText(article.text || ""), 420)
    })),
    reliability: cleanText(item.reliability?.label || ""),
    needsReview: Boolean(item.reliability?.needsReview)
  })).filter((item) => item.title || item.url);
}

function summarizeSourceGrounding(sourceContext) {
  if (!sourceContext) {
    return {
      enabled: false,
      checkedAt: "",
      itemCount: 0,
      notices: []
    };
  }

  const resultGroups = sourceContext.results || {};
  const itemCount = Object.values(resultGroups).reduce((sum, items) => sum + asArray(items).length, 0);
  return {
    enabled: true,
    checkedAt: sourceContext.checkedAt || "",
    itemCount,
    notices: asArray(sourceContext.notices).slice(0, 4)
  };
}

function parsePayloadList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }

  return String(value || "")
    .split(/[|,]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function sanitizeTopicContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    major: cleanText(value.major || ""),
    middle: cleanText(value.middle || ""),
    minor: cleanText(value.minor || ""),
    presetType: cleanText(value.presetType || ""),
    label: cleanText(value.label || ""),
    labels: parsePayloadList(value.labels).slice(0, 4)
  };
}

function getLegalAnalysisInstructions() {
  return [
    "당신은 한국 특성화고·직업계고 현장실습, 취업지도, 학교 민원 사안을 다루는 법률정보 분석 도우미입니다.",
    "목표는 법률 자문이나 사건 판단이 아니라, 사용자의 질문을 정확히 이해하고 필요한 공식자료 확인 방향과 다음 조치를 정리하는 것입니다.",
    "절대 원문에 없는 사실을 끼워 넣지 마세요. 이전 사례, 예시, 흔한 사례를 현재 질문의 사실처럼 쓰면 안 됩니다.",
    "질문에 '청소'만 있으면 '재료 운반'을 추가하지 마세요. 질문에 '재료'가 없으면 재료라는 말을 쓰지 마세요.",
    "질문에 부상, 진단서, 사고, 교육청 보고 요청이 없으면 그런 절차를 기본 결론으로 만들지 마세요.",
    "role은 답변을 요청하는 질문자 관점이고 partyRole은 실제 사건의 당사자입니다. 둘을 섞지 말고, 질문 본문에 없는 당사자나 사실은 만들지 마세요.",
    "topicContext는 사용자가 선택한 분류 힌트일 뿐입니다. 질문 본문과 충돌하면 질문 본문을 우선하고, 분류만으로 사고·폭행·민원·보고 의무를 추정하지 마세요.",
    "먼저 사용자가 실제로 말한 사실과 아직 모르는 사실을 분리하세요.",
    "officialSources가 제공되면 그 안의 공식자료 후보와 확인시각을 우선 반영하세요. 단, '직접 확인 필요' 또는 API 실패로 표시된 자료는 실존 조문으로 단정하지 말고 원문 확인 후보로만 다루세요.",
    "officialSources에 없는 조문·판례·해석례를 새로 만들어 인용하지 마세요. 필요한 경우 sourceSearchQueries에 추가 검색어로만 제안하세요.",
    "officialSources.sourceReferenceIndex는 법제처 원문에서 확인한 조문 인덱스입니다. 이 목록의 citation만 '원문 확인' 근거로 사용할 수 있습니다.",
    "officialSources.results.precedents는 승인된 공식 판례 API 결과 전용입니다. 이 배열이 비어 있으면 사건명·사건번호·선고일·법원명·판결요지·형량·손해배상액을 추정하지 말고 '판례 확인 필요'로 처리하세요.",
    "officialSources.results.educationInterpretations는 교육부 법령해석 후보입니다. 교육부 소관 행정규칙·고시·훈령과 구분해서, 쟁점 해석 방향을 확인하는 보조 근거로 다루세요.",
    "officialSources.results.educationAdminRules는 교육부 소관 행정규칙·고시·훈령 후보입니다. 이를 '교육부 행정해석'이라고 바꾸어 부르지 말고, 학교 실무 기준 확인 자료로만 다루세요.",
    "keyIssues.sourceFocus에는 관련 citation을 그대로 넣고, immediateActions·stakeholderActions·evidencePlan의 문장에는 꼭 필요한 경우 '(근거: citation)' 형식으로 짧게 붙이세요.",
    "officialSources.sourceReferenceIndex에 없는 조문번호나 벌칙을 추측해 쓰지 마세요. 특히 제○조, 징역, 벌금, 과태료, 손해배상 범위는 citation 또는 원문 확인 필요 중 하나로만 처리하세요.",
    "1차 결과는 긴 보고서가 아니라 상황 파악과 대처 방안 중심의 간편 보고서 초안으로 쓰일 예정입니다. 한 번에 모든 것을 처리하려 하지 말고 우선순위를 좁히세요.",
    "추가 질문은 미리 정한 문항을 나열하지 말고, 이 사안 판단에 꼭 필요한 1~3개만 생성하세요. 모르거나 민감하면 비워도 되는 질문으로 작성하세요.",
    "증빙자료는 필수 1~2개와 권고 1~2개 위주로 제한하세요. 실제 법적 필수 자료가 불명확하면 필수라고 과장하지 마세요.",
    "주체별 조치사항은 현재 사안에 직접 관련된 주체 2~3개만 정리하세요.",
    "법령 조문은 officialSources.sourceReferenceIndex에 citation이 있을 때만 확인된 근거로 쓰고, 없으면 우선 확인해야 할 공식자료와 검색어를 제시하며 확인 필요 상태로 표현하세요.",
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

async function getOptionalAuthContext(request, env) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  return requireAuthContext(request, env);
}

async function requireAuthContext(request, env) {
  const token = getBearerToken(request);
  if (!token) {
    return {
      error: "로그인이 필요합니다.",
      code: "AUTH_REQUIRED",
      status: 401
    };
  }

  try {
    const user = await verifyFirebaseIdToken(token, env);
    return {
      ok: true,
      user,
      member: await getMemberForUser(user, env)
    };
  } catch (error) {
    return {
      error: error.message || "로그인 확인에 실패했습니다.",
      code: "AUTH_INVALID",
      status: 401
    };
  }
}

async function requireAdminContext(request, env) {
  const authContext = await requireAuthContext(request, env);
  if (authContext.error) {
    return authContext;
  }

  if (!hasAdminAccess(authContext.member)) {
    return {
      error: "총괄관리자 또는 관리자 권한이 필요합니다.",
      code: "ADMIN_REQUIRED",
      status: 403
    };
  }

  return authContext;
}

async function assertLawAccess(authContext, env) {
  if (!isAuthRequired(env)) {
    if (!authContext || authContext.error) {
      return { ok: true, member: null };
    }

    return { ok: true, member: authContext.member };
  }

  if (!authContext || authContext.error) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      status: 401,
      message: authContext?.error || "법률정보 AI는 로그인 후 이용할 수 있습니다."
    };
  }

  const member = authContext.member || await getMemberForUser(authContext.user, env);
  if (!member || member.status !== "approved") {
    return {
      ok: false,
      code: "MEMBER_NOT_APPROVED",
      status: 403,
      message: "회원가입 승인 후 법률정보 AI를 이용할 수 있습니다."
    };
  }

  if (!LAW_ACCESS_ROLES.has(member.role)) {
    return {
      ok: false,
      code: "LAW_ROLE_REQUIRED",
      status: 403,
      message: "법률정보 이용 권한이 없습니다. 관리자에게 법률정보 권한을 요청하세요."
    };
  }

  return { ok: true, member };
}

async function getMemberProfile(user, env) {
  const member = await getMemberForUser(user, env);
  return {
    ok: true,
    configured: Boolean(env.MEMBER_DB),
    member: sanitizeMember(member),
    capabilities: getMemberCapabilities(member)
  };
}

async function registerMember(user, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다. Cloudflare D1 연결 후 가입 신청을 저장할 수 있습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503,
      member: sanitizeMember(buildVirtualMember(user, env))
    };
  }

  const now = new Date().toISOString();
  const existing = await getMemberByUid(user.uid, env);
  const requestedRole = normalizeRole(body.requestedRole || "general", "general");
  const displayName = cleanText(body.displayName || user.name || "");
  const schoolName = cleanText(body.schoolName || "");
  const phone = cleanText(body.phone || "");
  const note = cleanText(body.note || "");
  const invitation = await getInvitationForEmail(user.email, env);
  const ownerMember = buildVirtualMember(user, env);
  const isOwner = ownerMember.role === "owner";
  const role = isOwner ? "owner" : invitation?.role || (existing?.role && existing.role !== "pending" ? existing.role : "pending");
  const status = isOwner ? "approved" : invitation?.status || (existing?.status && existing.status !== "deleted" ? existing.status : "pending");

  await env.MEMBER_DB.prepare(`
    INSERT INTO members (
      uid, email, display_name, school_name, phone, requested_role, role, status,
      note, created_at, updated_at, approved_at, approved_by, last_login_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      school_name = excluded.school_name,
      phone = excluded.phone,
      requested_role = excluded.requested_role,
      note = excluded.note,
      updated_at = excluded.updated_at,
      last_login_at = excluded.last_login_at
  `).bind(
    user.uid,
    user.email,
    displayName,
    schoolName,
    phone,
    requestedRole,
    role,
    status,
    note,
    existing?.createdAt || now,
    now,
    isOwner ? now : existing?.approvedAt || null,
    isOwner ? user.uid : existing?.approvedBy || null,
    now
  ).run();

  await writeAuditLog(env, {
    actorUid: user.uid,
    targetUid: user.uid,
    action: existing ? "member.profile.update" : "member.register",
    detail: JSON.stringify({ requestedRole, status, role })
  });

  if (invitation) {
    await env.MEMBER_DB.prepare(`
      UPDATE member_invitations
      SET accepted_uid = ?, accepted_at = ?
      WHERE email = ?
    `).bind(user.uid, now, user.email).run().catch(() => null);
  }

  const member = await getMemberForUser(user, env);
  return {
    ok: true,
    member: sanitizeMember(member),
    capabilities: getMemberCapabilities(member)
  };
}

async function upsertMemberProfile(user, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  return registerMember(user, body, env);
}

async function listMembers(env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다. D1 데이터베이스를 만든 뒤 MEMBER_DB 바인딩을 추가해야 합니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503,
      members: []
    };
  }

  const result = await env.MEMBER_DB.prepare(`
    SELECT uid, email, display_name, school_name, phone, requested_role, role, status,
           note, created_at, updated_at, approved_at, approved_by, last_login_at
    FROM members
    WHERE status != 'deleted'
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      updated_at DESC
    LIMIT 200
  `).all();

  return {
    ok: true,
    members: (result.results || []).map(mapMemberRow).map(sanitizeMember)
  };
}

async function updateMemberByAdmin(adminContext, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  const uid = cleanText(body.uid || "");
  if (!uid) {
    return { error: "대상 회원 uid가 필요합니다.", code: "UID_REQUIRED", status: 400 };
  }

  const target = await getMemberByUid(uid, env);
  if (!target) {
    return { error: "대상 회원을 찾지 못했습니다.", code: "MEMBER_NOT_FOUND", status: 404 };
  }

  const nextRole = normalizeRole(body.role || target.role, target.role);
  const nextStatus = normalizeStatus(body.status || target.status, target.status);
  const note = cleanText(body.note ?? target.note ?? "");

  if (OWNER_ROLES.has(target.role) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자 권한은 총괄관리자만 변경할 수 있습니다.",
      code: "OWNER_PROTECTED",
      status: 403
    };
  }

  if (OWNER_ROLES.has(nextRole) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자 권한 부여는 총괄관리자만 할 수 있습니다.",
      code: "OWNER_GRANT_REQUIRED",
      status: 403
    };
  }

  const now = new Date().toISOString();
  const approvedAt = nextStatus === "approved" && target.status !== "approved"
    ? now
    : target.approvedAt || null;
  const approvedBy = nextStatus === "approved" && target.status !== "approved"
    ? adminContext.user.uid
    : target.approvedBy || null;

  await env.MEMBER_DB.prepare(`
    UPDATE members
    SET role = ?, status = ?, note = ?, updated_at = ?, approved_at = ?, approved_by = ?
    WHERE uid = ?
  `).bind(nextRole, nextStatus, note, now, approvedAt, approvedBy, uid).run();

  await writeAuditLog(env, {
    actorUid: adminContext.user.uid,
    targetUid: uid,
    action: "admin.member.update",
    detail: JSON.stringify({ role: nextRole, status: nextStatus })
  });

  return {
    ok: true,
    member: sanitizeMember(await getMemberByUid(uid, env))
  };
}

async function softDeleteMember(adminContext, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  const uid = cleanText(body.uid || "");
  if (!uid) {
    return { error: "대상 회원 uid가 필요합니다.", code: "UID_REQUIRED", status: 400 };
  }

  const target = await getMemberByUid(uid, env);
  if (!target) {
    return { error: "대상 회원을 찾지 못했습니다.", code: "MEMBER_NOT_FOUND", status: 404 };
  }

  if (OWNER_ROLES.has(target.role) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자는 일반 관리자가 삭제할 수 없습니다.",
      code: "OWNER_PROTECTED",
      status: 403
    };
  }

  const now = new Date().toISOString();
  await env.MEMBER_DB.prepare(`
    UPDATE members
    SET status = 'deleted', updated_at = ?, note = ?
    WHERE uid = ?
  `).bind(now, cleanText(body.note || "관리자 삭제 처리"), uid).run();

  await writeAuditLog(env, {
    actorUid: adminContext.user.uid,
    targetUid: uid,
    action: "admin.member.delete",
    detail: cleanText(body.note || "")
  });

  return { ok: true, uid };
}

async function createMemberInvitation(adminContext, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  const email = cleanText(body.email || "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "초대할 이메일 주소를 정확히 입력해 주세요.", code: "EMAIL_REQUIRED", status: 400 };
  }

  const role = normalizeRole(body.role || "general", "general");
  if (OWNER_ROLES.has(role) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자 사전 승인 권한은 총괄관리자만 부여할 수 있습니다.",
      code: "OWNER_GRANT_REQUIRED",
      status: 403
    };
  }

  const status = normalizeStatus(body.status || "approved", "approved");
  const note = cleanText(body.note || "");
  const now = new Date().toISOString();

  await env.MEMBER_DB.prepare(`
    INSERT INTO member_invitations (email, role, status, note, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      role = excluded.role,
      status = excluded.status,
      note = excluded.note,
      created_at = excluded.created_at,
      created_by = excluded.created_by
  `).bind(email, role, status, note, now, adminContext.user.uid).run();

  await writeAuditLog(env, {
    actorUid: adminContext.user.uid,
    targetUid: email,
    action: "admin.member.invite",
    detail: JSON.stringify({ role, status })
  });

  return {
    ok: true,
    invitation: { email, role, status, note, createdAt: now }
  };
}

async function getMemberForUser(user, env) {
  if (!user?.uid) {
    return null;
  }

  if (!env.MEMBER_DB) {
    return buildVirtualMember(user, env);
  }

  const member = await getMemberByUid(user.uid, env);
  if (member) {
    await env.MEMBER_DB.prepare("UPDATE members SET last_login_at = ?, updated_at = ? WHERE uid = ?")
      .bind(new Date().toISOString(), new Date().toISOString(), user.uid)
      .run()
      .catch(() => null);
    return member;
  }

  const virtual = buildVirtualMember(user, env);
  if (virtual.role === "owner") {
    await registerMember(user, { requestedRole: "owner", displayName: user.name }, env);
    return getMemberByUid(user.uid, env);
  }

  return {
    ...virtual,
    role: "pending",
    status: "pending",
    requestedRole: "general"
  };
}

async function getInvitationForEmail(email, env) {
  if (!env.MEMBER_DB || !email) {
    return null;
  }

  const row = await env.MEMBER_DB.prepare(`
    SELECT email, role, status, note, created_at, created_by, accepted_uid, accepted_at
    FROM member_invitations
    WHERE email = ?
  `).bind(cleanText(email).toLowerCase()).first().catch(() => null);

  if (!row || row.accepted_uid) {
    return null;
  }

  return {
    email: row.email,
    role: normalizeRole(row.role, "general"),
    status: normalizeStatus(row.status, "approved"),
    note: row.note || "",
    createdAt: row.created_at || "",
    createdBy: row.created_by || ""
  };
}

async function getMemberByUid(uid, env) {
  if (!env.MEMBER_DB) {
    return null;
  }

  const row = await env.MEMBER_DB.prepare(`
    SELECT uid, email, display_name, school_name, phone, requested_role, role, status,
           note, created_at, updated_at, approved_at, approved_by, last_login_at
    FROM members
    WHERE uid = ?
  `).bind(uid).first();

  return row ? mapMemberRow(row) : null;
}

function buildVirtualMember(user, env) {
  const ownerEmails = parseEmailList(env.OWNER_EMAILS);
  const adminEmails = parseEmailList(env.ADMIN_EMAILS);
  const email = cleanText(user.email || "").toLowerCase();
  const now = new Date().toISOString();

  if (ownerEmails.has(email)) {
    return {
      uid: user.uid,
      email,
      displayName: user.name || "",
      schoolName: "",
      phone: "",
      requestedRole: "owner",
      role: "owner",
      status: "approved",
      note: "OWNER_EMAILS 환경값으로 자동 총괄관리자 처리",
      createdAt: now,
      updatedAt: now,
      approvedAt: now,
      approvedBy: "system",
      lastLoginAt: now
    };
  }

  if (adminEmails.has(email)) {
    return {
      uid: user.uid,
      email,
      displayName: user.name || "",
      schoolName: "",
      phone: "",
      requestedRole: "admin",
      role: "admin",
      status: "approved",
      note: "ADMIN_EMAILS 환경값으로 자동 관리자 처리",
      createdAt: now,
      updatedAt: now,
      approvedAt: now,
      approvedBy: "system",
      lastLoginAt: now
    };
  }

  return {
    uid: user.uid,
    email,
    displayName: user.name || "",
    schoolName: "",
    phone: "",
    requestedRole: "general",
    role: isAuthRequired(env) ? "pending" : "law",
    status: isAuthRequired(env) ? "pending" : "approved",
    note: env.MEMBER_DB ? "" : "회원 DB 미연결 임시 프로필",
    createdAt: now,
    updatedAt: now,
    approvedAt: isAuthRequired(env) ? "" : now,
    approvedBy: isAuthRequired(env) ? "" : "system",
    lastLoginAt: now
  };
}

function mapMemberRow(row) {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name || "",
    schoolName: row.school_name || "",
    phone: row.phone || "",
    requestedRole: row.requested_role || "general",
    role: row.role || "pending",
    status: row.status || "pending",
    note: row.note || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    approvedAt: row.approved_at || "",
    approvedBy: row.approved_by || "",
    lastLoginAt: row.last_login_at || ""
  };
}

function sanitizeMember(member) {
  if (!member) {
    return null;
  }

  return {
    uid: member.uid,
    email: member.email,
    displayName: member.displayName,
    schoolName: member.schoolName,
    phone: member.phone,
    requestedRole: member.requestedRole,
    role: member.role,
    status: member.status,
    note: member.note,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    approvedAt: member.approvedAt,
    lastLoginAt: member.lastLoginAt
  };
}

function getMemberCapabilities(member) {
  const approved = member?.status === "approved";
  return {
    canUsePublic: true,
    canUseJobs: approved && ["jobs", "law", "teacher", "admin", "owner"].includes(member.role),
    canUseLawInfo: approved && LAW_ACCESS_ROLES.has(member.role),
    canManageMembers: approved && ADMIN_ROLES.has(member.role),
    canGrantOwner: approved && OWNER_ROLES.has(member.role)
  };
}

function hasAdminAccess(member) {
  return member?.status === "approved" && ADMIN_ROLES.has(member.role);
}

async function writeAuditLog(env, item) {
  if (!env.MEMBER_DB) {
    return;
  }

  await env.MEMBER_DB.prepare(`
    INSERT INTO member_audit_logs (actor_uid, target_uid, action, detail, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    item.actorUid || "",
    item.targetUid || "",
    item.action || "",
    item.detail || "",
    new Date().toISOString()
  ).run().catch(() => null);
}

async function verifyFirebaseIdToken(token, env) {
  const projectId = cleanText(env.FIREBASE_PROJECT_ID || "");
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID 환경값이 필요합니다.");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("잘못된 로그인 토큰 형식입니다.");
  }

  const header = parseJwtPart(parts[0]);
  const payload = parseJwtPart(parts[1]);

  if (header.alg !== "RS256") {
    throw new Error("지원하지 않는 로그인 토큰 알고리즘입니다.");
  }

  if (!header.kid) {
    throw new Error("로그인 토큰 키 식별자가 없습니다.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) <= now) {
    throw new Error("로그인 세션이 만료되었습니다.");
  }

  if (Number(payload.iat) > now + 60 || Number(payload.auth_time) > now + 60) {
    throw new Error("로그인 토큰 시간이 올바르지 않습니다.");
  }

  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("로그인 토큰의 Firebase 프로젝트가 일치하지 않습니다.");
  }

  if (!payload.sub || String(payload.sub).length > 128) {
    throw new Error("로그인 토큰의 사용자 식별자가 올바르지 않습니다.");
  }

  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error("로그인 토큰 검증 키를 찾지 못했습니다.");
  }

  const key = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(cert),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signingInput);

  if (!verified) {
    throw new Error("로그인 토큰 서명 검증에 실패했습니다.");
  }

  return {
    uid: payload.sub,
    email: cleanText(payload.email || "").toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: cleanText(payload.name || payload.email || ""),
    picture: cleanText(payload.picture || ""),
    authTime: payload.auth_time,
    claims: payload
  };
}

async function getFirebaseCerts() {
  if (firebaseCertCache && firebaseCertCache.expiresAt > Date.now()) {
    return firebaseCertCache.certs;
  }

  const response = await fetch(FIREBASE_CERT_URL);
  if (!response.ok) {
    throw new Error(`Firebase 공개키 조회 실패: HTTP ${response.status}`);
  }

  const certs = await response.json();
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  firebaseCertCache = {
    certs,
    expiresAt: Date.now() + Math.max(300, maxAge - 60) * 1000
  };
  return certs;
}

function parseJwtPart(value) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
  } catch {
    throw new Error("로그인 토큰을 해석하지 못했습니다.");
  }
}

function pemToArrayBuffer(pem) {
  const base64 = String(pem)
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  return base64ToBytes(base64);
}

function base64UrlToBytes(value) {
  const base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return base64ToBytes(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function isAuthRequired(env) {
  return /^true$/i.test(String(env.AUTH_REQUIRED || ""));
}

function normalizeRole(value, fallback = "pending") {
  const role = cleanText(value);
  return MEMBER_ROLES.includes(role) ? role : fallback;
}

function normalizeStatus(value, fallback = "pending") {
  const status = cleanText(value);
  return MEMBER_STATUSES.includes(status) ? status : fallback;
}

function parseEmailList(value) {
  return new Set(String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean));
}

function getResultStatus(result) {
  if (!result?.error) {
    return 200;
  }
  return result.status || (result.fallback ? 502 : 400);
}

function getCorsHeaders(origin, env) {
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,accept,authorization",
    "vary": "Origin"
  };
}

function sendJson(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders
    }
  });
}

async function readJsonBody(request) {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
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

function cleanText(value) {
  return String(value || "").trim();
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined || value === null ? [] : [value];
}

function isRetryableOpenAiError(error) {
  return [400, 404].includes(error.status) || /model|모델|not found|does not exist/i.test(error.message);
}
