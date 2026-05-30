const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

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
          model: env.OPENAI_MODEL || "gpt-5.2"
        }, 200, corsHeaders);
      }

      if (url.pathname === "/api/analyze" || url.pathname === "/analyze") {
        if (request.method !== "GET" && request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const payload = request.method === "POST"
          ? await readJsonBody(request)
          : Object.fromEntries(url.searchParams.entries());

        const result = await handleAnalyze(payload, env);
        return sendJson(result, result.error ? 502 : 200, corsHeaders);
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

async function handleAnalyze(payload, env) {
  const question = cleanText(payload.q || payload.question || "");
  const topic = cleanText(payload.topic || "general");
  const role = cleanText(payload.role || "auto");
  const mode = cleanText(payload.mode || "intake");
  const caseId = cleanText(payload.caseId || "");

  if (!question) {
    return { error: "질문이 비어 있습니다." };
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

  for (const model of models) {
    try {
      const analysis = await callOpenAiLegalAnalysis(env.OPENAI_API_KEY, {
        model,
        question,
        topic,
        role,
        mode
      });

      return {
        ok: true,
        caseId,
        engine: "cloudflare-worker-openai-responses",
        model,
        generatedAt: new Date().toISOString(),
        analysis
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
                currentDate: new Date().toISOString().slice(0, 10),
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
      max_output_tokens: 4200
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
    return JSON.parse(text);
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

function getCorsHeaders(origin, env) {
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,accept",
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

function cleanText(value) {
  return String(value || "").trim();
}

function isRetryableOpenAiError(error) {
  return [400, 404].includes(error.status) || /model|모델|not found|does not exist/i.test(error.message);
}
