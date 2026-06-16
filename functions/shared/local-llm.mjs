const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_LOCAL_LLM_MODEL = "qwen3:4b-instruct";
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_OUTPUT_TOKENS = 720;
const DEFAULT_CONTEXT_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.1;

const POLICY_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    lead: { type: "string" },
    answer: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5
    },
    steps: {
      type: "array",
      items: { type: "string" },
      maxItems: 4
    },
    caution: { type: "string" },
    followupQuestions: {
      type: "array",
      items: { type: "string" },
      maxItems: 3
    }
  },
  required: ["title", "lead", "answer", "caution"]
};

export async function maybeAttachLocalLlmPolicyComposer(payload = {}, result = {}, env = {}) {
  const config = getLocalLlmConfig(env);
  if (!config.enabled) return result;

  if (!shouldComposePolicyAnswer(result)) {
    return attachLocalLlmMetadata(result, {
      ok: false,
      skipped: true,
      reason: "policy_result_not_ready",
      config
    });
  }

  const startedAt = Date.now();
  try {
    const draft = await runLocalPolicyComposer(payload, result, config);
    const elapsedMs = Date.now() - startedAt;
    return attachLocalPolicyDraft(result, draft, {
      ok: true,
      provider: "ollama",
      model: config.model,
      baseUrl: redactLocalBaseUrl(config.baseUrl),
      elapsedMs,
      usage: draft.usage || null
    });
  } catch (error) {
    return attachLocalLlmMetadata(result, {
      ok: false,
      skipped: true,
      reason: normalizeErrorMessage(error),
      provider: "ollama",
      model: config.model,
      baseUrl: redactLocalBaseUrl(config.baseUrl),
      elapsedMs: Date.now() - startedAt
    });
  }
}

export async function getLocalLlmHealthStatus(env = {}) {
  const config = getLocalLlmConfig(env);
  const status = {
    enabled: config.enabled,
    provider: "ollama",
    model: config.model,
    baseUrl: redactLocalBaseUrl(config.baseUrl),
    timeoutMs: config.timeoutMs
  };

  if (!config.enabled) {
    return { ok: true, ...status, available: false, reason: "disabled" };
  }

  try {
    const data = await fetchOllamaJson(config, "/api/tags", null, Math.min(config.timeoutMs, 2500));
    const models = Array.isArray(data.models) ? data.models : [];
    return {
      ok: true,
      ...status,
      available: true,
      selectedModelAvailable: models.some((model) => model.name === config.model || model.model === config.model),
      models: models.map((model) => ({
        name: cleanText(model.name || model.model || ""),
        size: Number(model.size || 0),
        parameterSize: cleanText(model.details?.parameter_size || ""),
        quantization: cleanText(model.details?.quantization_level || "")
      })).filter((model) => model.name)
    };
  } catch (error) {
    return {
      ok: false,
      ...status,
      available: false,
      reason: normalizeErrorMessage(error)
    };
  }
}

function getLocalLlmConfig(env = {}) {
  const enabledValue = cleanText(env.LOCAL_LLM_ENABLED || env.OLLAMA_ENABLED || "auto").toLowerCase();
  const disabled = ["0", "false", "off", "no", "disabled"].includes(enabledValue);
  return {
    enabled: !disabled,
    baseUrl: cleanUrl(env.LOCAL_LLM_BASE_URL || env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL),
    model: cleanText(env.LOCAL_LLM_MODEL || env.OLLAMA_MODEL || DEFAULT_LOCAL_LLM_MODEL),
    timeoutMs: clampNumber(env.LOCAL_LLM_TIMEOUT_MS || env.OLLAMA_TIMEOUT_MS, 1500, 60000, DEFAULT_TIMEOUT_MS),
    maxOutputTokens: clampNumber(env.LOCAL_LLM_MAX_OUTPUT_TOKENS, 180, 1600, DEFAULT_MAX_OUTPUT_TOKENS),
    contextTokens: clampNumber(env.LOCAL_LLM_CONTEXT_TOKENS, 2048, 32768, DEFAULT_CONTEXT_TOKENS),
    temperature: clampNumber(env.LOCAL_LLM_TEMPERATURE, 0, 1, DEFAULT_TEMPERATURE)
  };
}

function shouldComposePolicyAnswer(result = {}) {
  return Boolean(
    result?.ok &&
    result.policyResponse &&
    result.semanticFrame?.domainCode &&
    result.answerState?.status !== "unclassified"
  );
}

async function runLocalPolicyComposer(payload = {}, result = {}, config = {}) {
  const body = {
    model: config.model,
    stream: false,
    format: POLICY_DRAFT_SCHEMA,
    options: {
      temperature: config.temperature,
      num_predict: config.maxOutputTokens,
      num_ctx: config.contextTokens
    },
    messages: [
      {
        role: "system",
        content: buildPolicyComposerSystemPrompt()
      },
      {
        role: "user",
        content: JSON.stringify(buildPolicyComposerInput(payload, result))
      }
    ]
  };

  const data = await fetchOllamaJson(config, "/api/chat", body, config.timeoutMs);
  const content = cleanLongText(data?.message?.content || "");
  const parsed = parseJsonContent(content);
  const draft = sanitizePolicyDraft(parsed);
  if (!draft.answer.length) {
    throw new Error("local_llm_empty_answer");
  }
  return {
    ...draft,
    usage: normalizeOllamaUsage(data)
  };
}

function buildPolicyComposerSystemPrompt() {
  return [
    "You are a Korean school policy information editor for GYO6 Law Info.",
    "Return only JSON that matches the given schema. Do not include markdown, reasoning, or chain-of-thought.",
    "Use only the provided rule-engine result. Do not invent laws, article numbers, case names, dates, rights, duties, or source URLs.",
    "This is information, not legal advice. Preserve uncertainty and tell the user what to confirm when the base result is conditional.",
    "Write concise Korean for teachers, students, parents, and school staff. Put the conclusion first.",
    "If source keys or official source priority are provided, say that original school/education-office/national sources still need confirmation."
  ].join("\n");
}

function buildPolicyComposerInput(payload = {}, result = {}) {
  const response = result.policyResponse || {};
  const state = result.answerState || {};
  const frame = result.semanticFrame || {};
  return {
    servicePurpose: "특성화고와 학교 현장을 위한 무료 규정·지침 Q&A",
    question: cleanLongText(result.question || payload.question || payload.q || ""),
    officeLabel: cleanText(result.officeLabel || payload.officeLabel || ""),
    roleLabel: cleanText(result.roleLabel || payload.roleLabel || ""),
    classification: {
      domainCode: cleanText(frame.domainCode || ""),
      domainLabel: cleanText(frame.domainLabel || ""),
      confidence: Number(result.confidence || frame.confidence || 0),
      answerStatus: cleanText(state.status || ""),
      missingSlots: asArray(result.missingSlots || frame.missingSlots).map(cleanText).filter(Boolean).slice(0, 8),
      slotQuestions: asArray(result.missingSlotQuestions || state.slotQuestions)
        .map((item) => cleanText(item?.question || item))
        .filter(Boolean)
        .slice(0, 4)
    },
    ruleEngineAnswer: {
      title: cleanText(response.title || ""),
      lead: cleanLongText(response.lead || ""),
      answer: normalizeAnswerTexts(response.answer).slice(0, 8),
      steps: asArray(response.steps).map(cleanLongText).filter(Boolean).slice(0, 6),
      caution: cleanLongText(response.caution || ""),
      sourcePriority: cleanText(response.sourcePriority || ""),
      sourceKeys: asArray(response.sourceKeys || response.ruleLookup?.sourceKeys).map(cleanText).filter(Boolean).slice(0, 10),
      queries: asArray(response.queries).map(cleanText).filter(Boolean).slice(0, 8)
    },
    outputRules: {
      title: "짧은 답변 제목",
      lead: "한 문장 결론",
      answer: "근거 엔진 답변을 쉬운 말로 정리한 2-5개 항목",
      steps: "사용자가 바로 확인할 순서 0-4개",
      caution: "정보 제공 고지와 원문 확인 안내",
      followupQuestions: "부족한 정보가 있을 때만 0-3개"
    }
  };
}

function attachLocalPolicyDraft(result = {}, draft = {}, metadata = {}) {
  const nextResponse = {
    ...(result.policyResponse || {}),
    title: draft.title || result.policyResponse?.title || "",
    lead: draft.lead || result.policyResponse?.lead || "",
    answer: draft.answer.length ? draft.answer : result.policyResponse?.answer || [],
    steps: draft.steps.length ? draft.steps : result.policyResponse?.steps || [],
    caution: draft.caution || result.policyResponse?.caution || ""
  };
  const nextPrimaryText = draft.lead || draft.answer[0] || result.answerState?.primaryText || "";

  return {
    ...result,
    policyResponse: nextResponse,
    answerState: {
      ...(result.answerState || {}),
      primaryText: nextPrimaryText,
      conditionalAnswers: draft.answer.slice(1, 5),
      slotQuestions: draft.followupQuestions.length
        ? draft.followupQuestions.map((question, index) => ({
            slot: `local_llm_followup_${index + 1}`,
            label: "추가 확인",
            question
          }))
        : result.answerState?.slotQuestions || []
    },
    responseText: formatLocalPolicyDraftText(draft, result),
    localLlmComposer: metadata
  };
}

function attachLocalLlmMetadata(result = {}, metadata = {}) {
  return {
    ...result,
    localLlmComposer: {
      ok: Boolean(metadata.ok),
      skipped: Boolean(metadata.skipped),
      reason: cleanText(metadata.reason || ""),
      provider: metadata.provider || "ollama",
      model: cleanText(metadata.model || ""),
      baseUrl: cleanText(metadata.baseUrl || ""),
      elapsedMs: Number(metadata.elapsedMs || 0) || 0
    }
  };
}

function formatLocalPolicyDraftText(draft = {}, result = {}) {
  const lines = [];
  if (draft.lead) lines.push(draft.lead);
  for (const item of draft.answer.slice(0, 4)) {
    if (item && item !== draft.lead) lines.push(`- ${item}`);
  }
  if (draft.steps.length) {
    lines.push("");
    lines.push("확인 순서");
    draft.steps.slice(0, 4).forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  }
  const caution = draft.caution || result.policyResponse?.caution || "";
  if (caution) {
    lines.push("");
    lines.push(caution);
  }
  return lines.filter(Boolean).join("\n").slice(0, 1400);
}

async function fetchOllamaJson(config = {}, pathname = "", body = null, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}${pathname}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : { accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data?.error || `ollama_http_${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizePolicyDraft(value = {}) {
  return {
    title: cleanText(value.title || ""),
    lead: cleanLongText(value.lead || "").slice(0, 260),
    answer: asArray(value.answer).map(cleanLongText).filter(Boolean).slice(0, 5),
    steps: asArray(value.steps).map(cleanLongText).filter(Boolean).slice(0, 4),
    caution: cleanLongText(value.caution || "").slice(0, 360),
    followupQuestions: asArray(value.followupQuestions).map(cleanLongText).filter(Boolean).slice(0, 3)
  };
}

function parseJsonContent(content = "") {
  const text = cleanLongText(content).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  if (!text) throw new Error("local_llm_empty_content");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("local_llm_json_parse_failed");
  }
}

function normalizeAnswerTexts(answer) {
  return asArray(answer).map((item) => {
    if (typeof item === "string") return cleanLongText(item);
    return cleanLongText(item?.text || item?.summary || item?.answer || "");
  }).filter(Boolean);
}

function normalizeOllamaUsage(data = {}) {
  return {
    promptEvalCount: Number(data.prompt_eval_count || 0) || 0,
    evalCount: Number(data.eval_count || 0) || 0,
    totalDurationMs: Math.round(Number(data.total_duration || 0) / 1_000_000),
    loadDurationMs: Math.round(Number(data.load_duration || 0) / 1_000_000)
  };
}

function normalizeErrorMessage(error) {
  const name = cleanText(error?.name || "");
  if (name === "AbortError") return "local_llm_timeout";
  return cleanText(error?.message || "local_llm_failed").slice(0, 160);
}

function cleanUrl(value = "") {
  const fallback = DEFAULT_OLLAMA_BASE_URL;
  try {
    const url = new URL(String(value || fallback).trim());
    if (!["http:", "https:"].includes(url.protocol)) return fallback;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

function redactLocalBaseUrl(value = "") {
  try {
    const url = new URL(value || DEFAULT_OLLAMA_BASE_URL);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_OLLAMA_BASE_URL;
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function cleanLongText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
