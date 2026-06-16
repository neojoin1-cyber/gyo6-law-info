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

    const guardedRemoteResult = applyRequiredPolicyAnchors(remoteResult, baseResult);
    return {
      ...guardedRemoteResult,
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

function applyRequiredPolicyAnchors(remoteResult = {}, baseResult = {}) {
  const requiredLines = getRequiredPolicyAnchorLines(baseResult);
  if (!requiredLines.length) return remoteResult;

  const remoteText = [
    remoteResult.responseText,
    remoteResult.policyResponse?.lead,
    ...asArray(remoteResult.policyResponse?.answer),
    ...asArray(remoteResult.policyResponse?.steps),
    remoteResult.policyResponse?.caution
  ].map(cleanLongText).filter(Boolean).join(" ");
  const missingLines = requiredLines.filter((line) => {
    if (/한의사/.test(line) && /진단서/.test(line)) {
      return !/한의사/.test(remoteText) || !/진단서/.test(remoteText);
    }
    return !remoteText.includes(line);
  });
  const certificateLine = requiredLines.find((line) => /한의사/.test(line) && /진단서/.test(line));
  const shouldPromoteCertificateLead = certificateLine && !/한의사/.test(cleanLongText(remoteResult.policyResponse?.lead || ""));
  const remoteAnswerLines = asArray(remoteResult.policyResponse?.answer)
    .filter((line) => !isLessSpecificMedicalCertificateLine(line));
  const remoteStepLines = asArray(remoteResult.policyResponse?.steps)
    .filter((line) => !isLessSpecificMedicalCertificateLine(line));
  const shouldFilterAnswer = remoteAnswerLines.length !== asArray(remoteResult.policyResponse?.answer).length;
  const shouldFilterSteps = remoteStepLines.length !== asArray(remoteResult.policyResponse?.steps).length;
  const shouldFilterResponseText = String(remoteResult.responseText || "").split(/\n+/).some((line) => isLessSpecificMedicalCertificateLine(line));
  if (!missingLines.length && !shouldPromoteCertificateLead && !shouldFilterAnswer && !shouldFilterSteps && !shouldFilterResponseText) return remoteResult;

  const nextAnswer = uniqueLines([...missingLines, ...remoteAnswerLines]).slice(0, 8);
  const nextLead = shouldPromoteCertificateLead ? certificateLine : remoteResult.policyResponse?.lead;
  return {
    ...remoteResult,
    policyResponse: {
      ...(remoteResult.policyResponse || {}),
      lead: nextLead,
      answer: nextAnswer,
      steps: remoteStepLines
    },
    answerState: {
      ...(remoteResult.answerState || {}),
      primaryText: shouldPromoteCertificateLead ? certificateLine : remoteResult.answerState?.primaryText,
      conditionalAnswers: uniqueLines([...missingLines, ...asArray(remoteResult.answerState?.conditionalAnswers)]).slice(0, 5)
    },
    responseText: prependRequiredLines(remoteResult.responseText, missingLines, shouldPromoteCertificateLead ? certificateLine : "")
  };
}

function getRequiredPolicyAnchorLines(baseResult = {}) {
  const frame = baseResult.semanticFrame || {};
  const issueCode = cleanText(frame.slots?.serviceIssue?.code || "");
  const issueLabel = cleanText(frame.slots?.serviceIssue?.label || "");
  const question = cleanText(baseResult.question || frame.question || "");
  const isSickLeave = frame.domainCode === "staffAttendanceService"
    && (issueCode === "sickLeave" || /병가/.test(issueLabel) || /병가/.test(question));
  if (!isSickLeave) return [];

  const sourceLines = [
    baseResult.policyResponse?.lead,
    ...asArray(baseResult.policyResponse?.answer),
    ...asArray(baseResult.policyResponse?.steps),
    baseResult.policyResponse?.caution
  ].map(cleanLongText).filter(Boolean);
  const certificateLine = sourceLines.find((line) => /한의사/.test(line) && /진단서/.test(line));
  const certificateDetailLine = sourceLines.find((line) => /(입원확인서|진료확인서)/.test(line) && /(보조자료|대체 가능|별도로 확인)/.test(line));
  return uniqueLines([certificateLine, certificateDetailLine]);
}

function prependRequiredLines(responseText = "", missingLines = [], promotedLead = "") {
  const lines = String(responseText || "").split(/\n+/).map(cleanLongText).filter(Boolean);
  const requiredBullets = uniqueLines(missingLines)
    .filter((line) => line !== promotedLead)
    .map((line) => `- ${line}`);
  if (!lines.length) return [promotedLead, ...requiredBullets].filter(Boolean).join("\n").slice(0, 1600);
  if (promotedLead) {
    return renumberOrderedSteps([
      promotedLead,
      ...requiredBullets,
      ...lines.slice(1).filter((line) => !isLessSpecificMedicalCertificateLine(line))
    ].join("\n")).slice(0, 1600);
  }
  return renumberOrderedSteps([
    lines[0],
    ...requiredBullets,
    ...lines.slice(1).filter((line) => !isLessSpecificMedicalCertificateLine(line))
  ].join("\n")).slice(0, 1600);
}

function uniqueLines(items = []) {
  return [...new Set(asArray(items).map(cleanLongText).filter(Boolean))];
}

function renumberOrderedSteps(text = "") {
  let stepIndex = 0;
  let inStepBlock = false;
  return String(text || "").split("\n").map((line) => {
    const current = cleanLongText(line);
    if (current === "확인 순서") {
      stepIndex = 0;
      inStepBlock = true;
      return current;
    }
    if (inStepBlock && /^\d+\.\s+/.test(current)) {
      stepIndex += 1;
      return current.replace(/^\d+\./, `${stepIndex}.`);
    }
    if (inStepBlock && current && !/^\d+\.\s+/.test(current)) {
      inStepBlock = false;
    }
    return current;
  }).filter(Boolean).join("\n");
}

function isLessSpecificMedicalCertificateLine(line = "") {
  const text = cleanLongText(line);
  return /(의사.*진단서|진단서.*의사)/.test(text) && !/(한의사|치과의사)/.test(text);
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
