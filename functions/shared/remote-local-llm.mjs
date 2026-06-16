const DEFAULT_REMOTE_TIMEOUT_MS = 24000;

export async function maybeApplyRemoteLocalPolicyLlm(payload = {}, baseResult = {}, env = {}) {
  const config = getRemoteLocalLlmConfig(env);
  if (!config.enabled) return baseResult;

  if (!config.baseUrl) {
    return attachRemoteLocalLlmMetadata(baseResult, {
      ok: false,
      skipped: true,
      reason: "remote_local_llm_base_url_missing",
      provider: "office-ollama-bridge"
    });
  }

  if (!config.token) {
    return attachRemoteLocalLlmMetadata(baseResult, {
      ok: false,
      skipped: true,
      reason: "remote_local_llm_token_missing",
      provider: "office-ollama-bridge",
      baseUrl: redactUrl(config.baseUrl)
    });
  }

  const startedAt = Date.now();
  try {
    const response = await fetchRemoteBridge(config, {
      payload: sanitizePayload(payload),
      baseResult: compactPolicyResult(baseResult)
    });
    const elapsedMs = Date.now() - startedAt;
    const remoteResult = response?.result || response;

    if (!isUsableRemotePolicyResult(remoteResult)) {
      return attachRemoteLocalLlmMetadata(baseResult, {
        ok: false,
        skipped: true,
        reason: "remote_local_llm_invalid_result",
        provider: "office-ollama-bridge",
        baseUrl: redactUrl(config.baseUrl),
        elapsedMs
      });
    }

    return {
      ...remoteResult,
      remoteLocalLlm: {
        ok: true,
        skipped: false,
        provider: "office-ollama-bridge",
        baseUrl: redactUrl(config.baseUrl),
        elapsedMs,
        bridgeElapsedMs: Number(response?.bridge?.elapsedMs || 0) || 0,
        localLlmUsed: Boolean(remoteResult.localLlmComposer?.ok || remoteResult.localLlmNormalizer?.used)
      }
    };
  } catch (error) {
    return attachRemoteLocalLlmMetadata(baseResult, {
      ok: false,
      skipped: true,
      reason: normalizeErrorMessage(error),
      provider: "office-ollama-bridge",
      baseUrl: redactUrl(config.baseUrl),
      elapsedMs: Date.now() - startedAt
    });
  }
}

export function getRemoteLocalLlmConfig(env = {}) {
  const rawEnabled = cleanText(env.REMOTE_LOCAL_LLM_ENABLED || "false").toLowerCase();
  const baseUrl = cleanUrl(env.REMOTE_LOCAL_LLM_BASE_URL || "");
  const token = cleanText(env.REMOTE_LOCAL_LLM_TOKEN || env.LOCAL_LLM_BRIDGE_TOKEN || "");
  const enabled = ["1", "true", "yes", "on", "auto"].includes(rawEnabled);
  return {
    enabled,
    baseUrl,
    token,
    timeoutMs: clampNumber(env.REMOTE_LOCAL_LLM_TIMEOUT_MS, 3000, 55000, DEFAULT_REMOTE_TIMEOUT_MS)
  };
}

async function fetchRemoteBridge(config = {}, body = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/api/policy/llm`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data?.error || `remote_local_llm_http_${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function attachRemoteLocalLlmMetadata(result = {}, metadata = {}) {
  return {
    ...result,
    remoteLocalLlm: {
      ok: Boolean(metadata.ok),
      skipped: Boolean(metadata.skipped),
      provider: metadata.provider || "office-ollama-bridge",
      reason: cleanText(metadata.reason || ""),
      baseUrl: cleanText(metadata.baseUrl || ""),
      elapsedMs: Number(metadata.elapsedMs || 0) || 0,
      localLlmUsed: false
    }
  };
}

function isUsableRemotePolicyResult(result = {}) {
  return Boolean(
    result &&
    typeof result === "object" &&
    result.ok &&
    result.semanticFrame?.domainCode &&
    result.answerState?.status &&
    result.policyResponse
  );
}

function sanitizePayload(payload = {}) {
  return {
    question: cleanLongText(payload.question || payload.q || "").slice(0, 800),
    q: cleanLongText(payload.q || "").slice(0, 800),
    originalQuestion: cleanLongText(payload.originalQuestion || "").slice(0, 800),
    officeLabel: cleanText(payload.officeLabel || payload.office || ""),
    office: cleanText(payload.office || ""),
    roleLabel: cleanText(payload.roleLabel || payload.role || ""),
    role: cleanText(payload.role || "")
  };
}

function compactPolicyResult(result = {}) {
  return {
    ok: Boolean(result.ok),
    question: cleanLongText(result.question || "").slice(0, 800),
    officeLabel: cleanText(result.officeLabel || ""),
    confidence: Number(result.confidence || result.semanticFrame?.confidence || 0) || 0,
    semanticFrame: {
      domainCode: cleanText(result.semanticFrame?.domainCode || ""),
      domainLabel: cleanText(result.semanticFrame?.domainLabel || ""),
      confidence: Number(result.semanticFrame?.confidence || 0) || 0
    },
    answerState: {
      status: cleanText(result.answerState?.status || ""),
      primaryText: cleanLongText(result.answerState?.primaryText || "").slice(0, 800)
    },
    missingSlots: asArray(result.missingSlots).map(cleanText).filter(Boolean).slice(0, 8),
    policyResponse: result.policyResponse ? {
      title: cleanText(result.policyResponse.title || ""),
      lead: cleanLongText(result.policyResponse.lead || "").slice(0, 800),
      answer: asArray(result.policyResponse.answer).map(cleanLongText).filter(Boolean).slice(0, 8),
      caution: cleanLongText(result.policyResponse.caution || "").slice(0, 800)
    } : null
  };
}

function normalizeErrorMessage(error) {
  const name = cleanText(error?.name || "");
  if (name === "AbortError") return "remote_local_llm_timeout";
  return cleanText(error?.message || "remote_local_llm_failed").slice(0, 160);
}

function cleanUrl(value = "") {
  const text = cleanText(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function redactUrl(value = "") {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
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

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function cleanLongText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}
