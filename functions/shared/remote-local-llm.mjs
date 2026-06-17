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

    if (isRemotePolicyResultRegression(baseResult, remoteResult)) {
      return attachRemoteLocalLlmMetadata(baseResult, {
        ok: false,
        skipped: true,
        reason: "remote_local_llm_regressed_result",
        provider: "office-ollama-bridge",
        baseUrl: redactUrl(config.baseUrl),
        elapsedMs
      });
    }

    const guardedRemoteResult = preservePolicyMetadata(applyRequiredPolicyAnchors(remoteResult, baseResult), baseResult);
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

function preservePolicyMetadata(remoteResult = {}, baseResult = {}) {
  const sourceExpansion = remoteResult.sourceExpansion
    || remoteResult.policyResponse?.sourceExpansion
    || remoteResult.answerState?.sourceExpansion
    || baseResult.sourceExpansion
    || baseResult.policyResponse?.sourceExpansion
    || baseResult.answerState?.sourceExpansion
    || baseResult.semanticFrame?.lookupPlan?.sourceExpansion
    || null;
  const riskReview = remoteResult.riskReview
    || remoteResult.policyResponse?.riskReview
    || remoteResult.answerState?.riskReview
    || sourceExpansion?.riskReview
    || baseResult.riskReview
    || baseResult.policyResponse?.riskReview
    || baseResult.answerState?.riskReview
    || null;

  if (!sourceExpansion && !riskReview) return remoteResult;

  return {
    ...remoteResult,
    sourceExpansion,
    riskReview,
    policyResponse: {
      ...(remoteResult.policyResponse || {}),
      sourceExpansion: remoteResult.policyResponse?.sourceExpansion || sourceExpansion,
      riskReview: remoteResult.policyResponse?.riskReview || riskReview
    },
    answerState: {
      ...(remoteResult.answerState || {}),
      sourceExpansion: remoteResult.answerState?.sourceExpansion || sourceExpansion,
      riskReview: remoteResult.answerState?.riskReview || riskReview
    }
  };
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
  const isClassManagement = baseResult.semanticFrame?.domainCode === "classManagementGuidance";

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
  const classManagementLead = requiredLines.find((line) => /교원의 학생생활지도/.test(line) && /초·중등교육법|시행령 제31조/.test(line));
  const remoteLead = cleanLongText(remoteResult.policyResponse?.lead || "");
  const shouldPromoteClassManagementLead = Boolean(
    isClassManagement &&
    classManagementLead &&
    (!/교원의 학생생활지도|초·중등교육법|시행령 제31조/.test(remoteLead) || isLessSpecificClassManagementFallbackLine(remoteLead))
  );
  const remoteAnswerLines = asArray(remoteResult.policyResponse?.answer)
    .filter((line) => !isLessSpecificMedicalCertificateLine(line))
    .filter((line) => !(isClassManagement && isLessSpecificClassManagementFallbackLine(line)));
  const remoteStepLines = asArray(remoteResult.policyResponse?.steps)
    .filter((line) => !isLessSpecificMedicalCertificateLine(line))
    .filter((line) => !(isClassManagement && isLessSpecificClassManagementFallbackLine(line)));
  const shouldFilterAnswer = remoteAnswerLines.length !== asArray(remoteResult.policyResponse?.answer).length;
  const shouldFilterSteps = remoteStepLines.length !== asArray(remoteResult.policyResponse?.steps).length;
  const shouldFilterResponseText = String(remoteResult.responseText || "").split(/\n+/).some((line) => (
    isLessSpecificMedicalCertificateLine(line) || (isClassManagement && isLessSpecificClassManagementFallbackLine(line))
  ));
  const remoteCaution = cleanLongText(remoteResult.policyResponse?.caution || "");
  const shouldFilterCaution = Boolean(isClassManagement && isLessSpecificClassManagementFallbackLine(remoteCaution));
  if (!missingLines.length && !shouldPromoteCertificateLead && !shouldPromoteClassManagementLead && !shouldFilterAnswer && !shouldFilterSteps && !shouldFilterResponseText && !shouldFilterCaution) return remoteResult;

  const nextAnswer = uniqueLines([...missingLines, ...remoteAnswerLines]).slice(0, 8);
  const nextLead = shouldPromoteCertificateLead ? certificateLine : (shouldPromoteClassManagementLead ? classManagementLead : remoteResult.policyResponse?.lead);
  const nextCaution = shouldFilterCaution
    ? (baseResult.policyResponse?.caution || remoteResult.policyResponse?.caution)
    : remoteResult.policyResponse?.caution;
  return {
    ...remoteResult,
    policyResponse: {
      ...(remoteResult.policyResponse || {}),
      lead: nextLead,
      answer: nextAnswer,
      steps: remoteStepLines,
      caution: nextCaution
    },
    answerState: {
      ...(remoteResult.answerState || {}),
      primaryText: (shouldPromoteCertificateLead || shouldPromoteClassManagementLead) ? nextLead : remoteResult.answerState?.primaryText,
      conditionalAnswers: uniqueLines([...missingLines, ...asArray(remoteResult.answerState?.conditionalAnswers)]).slice(0, 5)
    },
    responseText: prependRequiredLines(remoteResult.responseText, missingLines, (shouldPromoteCertificateLead || shouldPromoteClassManagementLead) ? nextLead : "", isClassManagement)
  };
}

function getRequiredPolicyAnchorLines(baseResult = {}) {
  const frame = baseResult.semanticFrame || {};
  const issueCode = cleanText(frame.slots?.serviceIssue?.code || "");
  const issueLabel = cleanText(frame.slots?.serviceIssue?.label || "");
  const question = cleanText(baseResult.question || frame.question || "");
  const sourceLines = [
    baseResult.policyResponse?.lead,
    ...asArray(baseResult.policyResponse?.answer),
    ...asArray(baseResult.policyResponse?.steps),
    baseResult.policyResponse?.caution
  ].map(cleanLongText).filter(Boolean);
  const genericLines = getGenericCriticalPolicyAnchorLines(sourceLines);
  if (frame.domainCode === "classManagementGuidance") {
    const hierarchyLine = sourceLines.find((line) => /교원의 학생생활지도/.test(line) && /초·중등교육법|시행령 제31조/.test(line));
    const procedureLine = sourceLines.find((line) => /선도·징계/.test(line) && /초·중등교육법|시행령 제31조/.test(line));
    const finalRuleLine = sourceLines.find((line) => /학교생활규정/.test(line) && /최종|세부 집행|상위 기준/.test(line));
    return uniqueLines([
      hierarchyLine,
      procedureLine,
      finalRuleLine,
      ...genericLines
    ]).slice(0, 4);
  }
  const isSickLeave = frame.domainCode === "staffAttendanceService"
    && (issueCode === "sickLeave" || /병가/.test(issueLabel) || /병가/.test(question));
  if (!isSickLeave) return genericLines.slice(0, 3);

  const certificateLine = sourceLines.find((line) => /한의사/.test(line) && /진단서/.test(line));
  const certificateDetailLine = sourceLines.find((line) => /(입원확인서|진료확인서)/.test(line) && /(보조자료|대체 가능|별도로 확인)/.test(line));
  return uniqueLines([
    certificateLine,
    certificateDetailLine,
    ...genericLines
  ]).slice(0, 4);
}

function isRemotePolicyResultRegression(baseResult = {}, remoteResult = {}) {
  const baseFrame = baseResult.semanticFrame || {};
  const remoteFrame = remoteResult.semanticFrame || {};
  const baseDomain = cleanText(baseFrame.domainCode || "");
  const remoteDomain = cleanText(remoteFrame.domainCode || "");
  if (baseDomain && remoteDomain && baseDomain !== remoteDomain) return true;

  const baseIssue = cleanText(baseFrame.slots?.serviceIssue?.code || "");
  const remoteIssue = cleanText(remoteFrame.slots?.serviceIssue?.code || "");
  if (baseIssue && remoteIssue && baseIssue !== remoteIssue) return true;

  const baseSubject = cleanText(baseFrame.slots?.travelerRole?.subjectLabel || "");
  const remoteSubject = cleanText(remoteFrame.slots?.travelerRole?.subjectLabel || "");
  if (/교원|교사|교장|교감/.test(baseSubject) && /학생/.test(remoteSubject)) return true;

  const baseText = collectPolicyText(baseResult);
  const remoteText = collectPolicyText(remoteResult);
  if (/시간외근무|초과근무/.test(baseText) && /숙박비|여비|출장비|70,000원/.test(remoteText) && !/시간외근무|초과근무/.test(remoteText)) {
    return true;
  }
  return false;
}

function collectPolicyText(result = {}) {
  return [
    result.responseText,
    result.answerState?.primaryText,
    result.policyResponse?.title,
    result.policyResponse?.lead,
    ...asArray(result.policyResponse?.answer),
    ...asArray(result.policyResponse?.steps),
    result.policyResponse?.caution
  ].map(cleanLongText).filter(Boolean).join(" ");
}

function prependRequiredLines(responseText = "", missingLines = [], promotedLead = "", filterClassManagement = false) {
  const lines = String(responseText || "").split(/\n+/).map(cleanLongText).filter(Boolean);
  const keepLine = (line) => !isLessSpecificMedicalCertificateLine(line)
    && !(filterClassManagement && isLessSpecificClassManagementFallbackLine(line));
  const requiredBullets = uniqueLines(missingLines)
    .filter((line) => line !== promotedLead)
    .map((line) => `- ${line}`);
  if (!lines.length) return [promotedLead, ...requiredBullets].filter(Boolean).join("\n").slice(0, 1600);
  if (promotedLead) {
    return renumberOrderedSteps([
      promotedLead,
      ...requiredBullets,
      ...lines.slice(1).filter(keepLine)
    ].join("\n")).slice(0, 1600);
  }
  return renumberOrderedSteps([
    lines[0],
    ...requiredBullets,
    ...lines.slice(1).filter(keepLine)
  ].join("\n")).slice(0, 1600);
}

function uniqueLines(items = []) {
  return [...new Set(asArray(items).map(cleanLongText).filter(Boolean))];
}

function getGenericCriticalPolicyAnchorLines(sourceLines = []) {
  return sourceLines.filter(isCriticalPolicyFactLine).slice(0, 3);
}

function isCriticalPolicyFactLine(line = "") {
  const text = cleanLongText(line);
  if (text.length < 8) return false;
  if (/확인되지 않은 항목|현재 질문에는|정확도를 높이려면|추가 확인 필요|원문 기준 확인/.test(text)) return false;
  return /의사·치과의사·한의사|진단서|입원확인서|진료확인서|계약서|취업규칙|학교법인|단체협약|나이스|학교장 승인|제\d+조|[0-9,]+\s*원|\d+\s*(?:일|시간|박|개월|년)|연\s*\d+\s*일|일비|식비|숙박비|운임|상한|한도|기한|초과|이상|이하/.test(text);
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

function isLessSpecificClassManagementFallbackLine(line = "") {
  const text = cleanLongText(line);
  if (!text) return false;
  const schoolRuleFirst = /(학생생활규정|학교생활규정|학급\s*규칙|학급\s*운영\s*원칙).{0,18}(먼저|우선|기반|확인)/.test(text);
  const schoolRuleOnly = /(학생생활규정|학교생활규정|학급\s*규칙|학급\s*운영\s*원칙)/.test(text)
    && !/교원의 학생생활지도|초·중등교육법|시행령 제31조|최종|세부 집행|상위 기준/.test(text);
  const delegatesToUser = /(학교별\s*생활규정|교육청\s*지침|학급관리\s*절차).{0,20}(직접\s*확인|확인해야)/.test(text);
  return (schoolRuleFirst || schoolRuleOnly || delegatesToUser) && !/교원의 학생생활지도|초·중등교육법|시행령 제31조/.test(text);
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
      primaryText: cleanLongText(result.answerState?.primaryText || "").slice(0, 800),
      sourceExpansion: compactSourceExpansion(result.answerState?.sourceExpansion)
    },
    missingSlots: asArray(result.missingSlots).map(cleanText).filter(Boolean).slice(0, 8),
    sourceExpansion: compactSourceExpansion(result.sourceExpansion || result.policyResponse?.sourceExpansion || result.answerState?.sourceExpansion),
    riskReview: compactRiskReview(result.riskReview || result.policyResponse?.riskReview || result.answerState?.riskReview),
    policyResponse: result.policyResponse ? {
      title: cleanText(result.policyResponse.title || ""),
      lead: cleanLongText(result.policyResponse.lead || "").slice(0, 800),
      answer: asArray(result.policyResponse.answer).map(cleanLongText).filter(Boolean).slice(0, 8),
      steps: asArray(result.policyResponse.steps).map(cleanLongText).filter(Boolean).slice(0, 6),
      caution: cleanLongText(result.policyResponse.caution || "").slice(0, 800),
      sourcePriority: cleanText(result.policyResponse.sourcePriority || ""),
      sourceKeys: asArray(result.policyResponse.sourceKeys).map(cleanText).filter(Boolean).slice(0, 10),
      sourceExpansion: compactSourceExpansion(result.policyResponse.sourceExpansion),
      riskReview: compactRiskReview(result.policyResponse.riskReview)
    } : null
  };
}

function compactSourceExpansion(sourceExpansion = null) {
  if (!sourceExpansion || typeof sourceExpansion !== "object") return null;
  return {
    required: Boolean(sourceExpansion.required),
    status: cleanText(sourceExpansion.status || ""),
    trigger: cleanText(sourceExpansion.trigger || ""),
    missingSlots: asArray(sourceExpansion.missingSlots).map(cleanText).filter(Boolean).slice(0, 8),
    acquisitionTargets: asArray(sourceExpansion.acquisitionTargets).map((target) => ({
      tier: cleanText(target?.tier || ""),
      label: cleanText(target?.label || ""),
      query: cleanText(target?.query || ""),
      reason: cleanText(target?.reason || "")
    })).filter((target) => target.tier || target.label || target.query).slice(0, 6),
    recheckSteps: asArray(sourceExpansion.recheckSteps).map(cleanText).filter(Boolean).slice(0, 5)
  };
}

function compactRiskReview(riskReview = null) {
  if (!riskReview || typeof riskReview !== "object") return null;
  return {
    required: Boolean(riskReview.required),
    items: asArray(riskReview.items).map((item) => ({
      code: cleanText(item?.code || ""),
      label: cleanText(item?.label || ""),
      status: cleanText(item?.status || ""),
      check: cleanText(item?.check || "")
    })).filter((item) => item.code || item.label).slice(0, 8)
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
