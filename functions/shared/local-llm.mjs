const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_LOCAL_LLM_MODEL = "qwen3:4b-instruct";
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_NORMALIZER_TIMEOUT_MS = 9000;
const DEFAULT_NORMALIZER_MIN_CONFIDENCE = 0.82;
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

const POLICY_NORMALIZATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "normalizedQuestion",
    "intentDomain",
    "answerability",
    "confidence",
    "slots",
    "missingSlots",
    "clarifyingQuestions",
    "inferredFacts",
    "mustNotAssume",
    "reason"
  ],
  properties: {
    normalizedQuestion: { type: "string" },
    intentDomain: { type: "string" },
    answerability: {
      type: "string",
      enum: ["answerable", "needs_slot", "unclassified"]
    },
    confidence: { type: "number" },
    slots: {
      type: "object",
      additionalProperties: false,
      required: [
        "officeLabel",
        "roleLabel",
        "targetSubject",
        "schoolLocation",
        "institution",
        "origin",
        "destination",
        "duration",
        "serviceIssue",
        "procedureStage",
        "evidence",
        "riskSignal"
      ],
      properties: {
        officeLabel: { type: "string" },
        roleLabel: { type: "string" },
        targetSubject: { type: "string" },
        schoolLocation: { type: "string" },
        institution: { type: "string" },
        origin: { type: "string" },
        destination: { type: "string" },
        duration: { type: "string" },
        serviceIssue: { type: "string" },
        procedureStage: { type: "string" },
        evidence: { type: "string" },
        riskSignal: { type: "string" }
      }
    },
    missingSlots: {
      type: "array",
      items: { type: "string" }
    },
    clarifyingQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slot", "label", "question"],
        properties: {
          slot: { type: "string" },
          label: { type: "string" },
          question: { type: "string" }
        }
      }
    },
    inferredFacts: {
      type: "array",
      items: { type: "string" }
    },
    mustNotAssume: {
      type: "array",
      items: { type: "string" }
    },
    reason: { type: "string" }
  }
};

export async function maybeApplyLocalLlmPolicyNormalizer(payload = {}, baseResult = {}, env = {}, buildPolicyResult = null) {
  const config = getLocalLlmConfig(env);
  if (!config.enabled || !config.normalizerEnabled || typeof buildPolicyResult !== "function") {
    return baseResult;
  }

  if (!shouldUseLocalLlmPolicyNormalizer(payload, baseResult, config)) {
    return attachLocalLlmNormalizerMetadata(baseResult, {
      ok: false,
      skipped: true,
      reason: "base_result_usable",
      provider: "ollama",
      model: config.normalizerModel
    }, { used: false });
  }

  const startedAt = Date.now();
  const normalizerResult = await runLocalPolicyQuestionNormalizer(payload, baseResult, config)
    .catch((error) => ({
      ok: false,
      skipped: true,
      reason: normalizeErrorMessage(error),
      provider: "ollama",
      model: config.normalizerModel
    }));
  normalizerResult.elapsedMs = Date.now() - startedAt;

  if (!normalizerResult.ok) {
    return attachLocalLlmNormalizerMetadata(baseResult, normalizerResult, { used: false });
  }

  const normalizedPayload = buildPayloadFromLocalPolicyNormalizer(payload, normalizerResult.normalization);
  const originalQuestion = cleanLongText(payload.question || payload.q || "");
  if (!normalizedPayload.question || normalizedPayload.question === originalQuestion) {
    return attachLocalLlmNormalizerMetadata(baseResult, normalizerResult, {
      used: false,
      reason: "normalized_question_unchanged",
      normalizedPayload
    });
  }

  const candidateResult = {
    ...buildPolicyResult(normalizedPayload),
    originalQuestion,
    payload: normalizedPayload
  };
  const baseScore = scoreLocalPolicyResult(baseResult);
  const candidateScore = scoreLocalPolicyResult(candidateResult);
  const chosenResult = chooseBetterLocalPolicyResult(baseResult, candidateResult, { baseScore, normalizedScore: candidateScore });

  return attachLocalLlmNormalizerMetadata(chosenResult, normalizerResult, {
    used: chosenResult === candidateResult,
    baseScore,
    candidateScore,
    normalizedPayload
  });
}

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
    timeoutMs: config.timeoutMs,
    normalizer: {
      enabled: config.normalizerEnabled,
      mode: config.normalizerMode,
      model: config.normalizerModel,
      minConfidence: config.normalizerMinConfidence,
      timeoutMs: config.normalizerTimeoutMs
    }
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
      normalizerModelAvailable: models.some((model) => model.name === config.normalizerModel || model.model === config.normalizerModel),
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
  const normalizerValue = cleanText(env.LOCAL_LLM_NORMALIZER_ENABLED || enabledValue || "auto").toLowerCase();
  const normalizerMode = cleanText(env.LOCAL_LLM_NORMALIZER_MODE || "auto").toLowerCase();
  const disabled = ["0", "false", "off", "no", "disabled"].includes(enabledValue);
  const normalizerDisabled = disabled || ["0", "false", "off", "no", "disabled"].includes(normalizerValue);
  return {
    enabled: !disabled,
    baseUrl: cleanUrl(env.LOCAL_LLM_BASE_URL || env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL),
    model: cleanText(env.LOCAL_LLM_MODEL || env.OLLAMA_MODEL || DEFAULT_LOCAL_LLM_MODEL),
    normalizerEnabled: !normalizerDisabled,
    normalizerMode: ["always", "auto"].includes(normalizerMode) ? normalizerMode : "auto",
    normalizerModel: cleanText(env.LOCAL_LLM_NORMALIZER_MODEL || env.LOCAL_LLM_MODEL || env.OLLAMA_MODEL || DEFAULT_LOCAL_LLM_MODEL),
    normalizerTimeoutMs: clampNumber(env.LOCAL_LLM_NORMALIZER_TIMEOUT_MS, 1000, 30000, DEFAULT_NORMALIZER_TIMEOUT_MS),
    normalizerMinConfidence: clampNumber(env.LOCAL_LLM_NORMALIZER_MIN_CONFIDENCE, 0, 1, DEFAULT_NORMALIZER_MIN_CONFIDENCE),
    timeoutMs: clampNumber(env.LOCAL_LLM_TIMEOUT_MS || env.OLLAMA_TIMEOUT_MS, 1500, 60000, DEFAULT_TIMEOUT_MS),
    maxOutputTokens: clampNumber(env.LOCAL_LLM_MAX_OUTPUT_TOKENS, 180, 1600, DEFAULT_MAX_OUTPUT_TOKENS),
    contextTokens: clampNumber(env.LOCAL_LLM_CONTEXT_TOKENS, 2048, 32768, DEFAULT_CONTEXT_TOKENS),
    temperature: clampNumber(env.LOCAL_LLM_TEMPERATURE, 0, 1, DEFAULT_TEMPERATURE)
  };
}

export function shouldUseLocalLlmPolicyNormalizer(payload = {}, result = {}, config = {}) {
  const question = cleanText(payload.question || payload.q || "");
  if (!question || question.length < 3) return false;
  if (!config.enabled || !config.normalizerEnabled) return false;
  if (config.normalizerMode === "always") return true;

  const confidence = Number(result.confidence || result.semanticFrame?.confidence || 0);
  const missingSlots = result.missingSlots || [];
  if (!result.ok || !result.semanticFrame?.domainCode) return true;
  if (result.answerState?.status === "unclassified") return true;
  if (hasUsablePolicyResult(result)) return false;
  if (confidence < config.normalizerMinConfidence) return true;
  if (hasCriticalMissingSlots(missingSlots)) return true;
  return isLowQualityPolicyResult(result);
}

function shouldComposePolicyAnswer(result = {}) {
  return Boolean(
    result?.ok &&
    result.policyResponse &&
    result.semanticFrame?.domainCode &&
    result.answerState?.status !== "unclassified"
  );
}

async function runLocalPolicyQuestionNormalizer(payload = {}, baseResult = {}, config = {}) {
  const body = {
    model: config.normalizerModel,
    stream: false,
    format: POLICY_NORMALIZATION_SCHEMA,
    options: {
      temperature: Math.min(config.temperature, 0.2),
      num_predict: Math.min(config.maxOutputTokens, 900),
      num_ctx: Math.max(config.contextTokens, 4096)
    },
    messages: [
      {
        role: "system",
        content: buildPolicyQuestionNormalizerSystemPrompt()
      },
      {
        role: "user",
        content: JSON.stringify(buildPolicyQuestionNormalizerInput(payload, baseResult))
      }
    ]
  };

  const data = await fetchOllamaJson(config, "/api/chat", body, config.normalizerTimeoutMs);
  const content = cleanLongText(data?.message?.content || "");
  const parsed = parseJsonContent(content);
  const normalization = sanitizePolicyNormalization(parsed);
  if (!normalization.normalizedQuestion) {
    throw new Error("local_llm_empty_normalized_question");
  }
  return {
    ok: true,
    provider: "ollama",
    model: config.normalizerModel,
    normalization,
    usage: normalizeOllamaUsage(data)
  };
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

function buildPolicyQuestionNormalizerSystemPrompt() {
  return [
    "당신은 한국 학교·특성화고 규정 Q&A의 질문 이해 계층입니다.",
    "최종 답변을 생성하지 마세요. 법령명, 금액, 일수, 절차, 권리·의무를 새로 말하지 마세요.",
    "역할은 사용자의 짧거나 장황한 발화를 규정 엔진이 처리할 수 있는 완성 질문과 슬롯 JSON으로 바꾸는 것입니다.",
    "원문에 없는 사실은 추가하지 마세요. 다만 학교 행정의 일반 표현은 보수적으로 표준화할 수 있습니다.",
    "예: 행정실 주무관·행정실장·행정직은 지방공무원/행정직 후보, 1박2일은 기간 1박 2일, 출장비는 국내 출장 여비 후보입니다.",
    "짧은 구어체는 규정 질문 표현으로 풀어 쓰세요. 예: 쌤·선생님은 교사 후보, 서류는 증빙자료 후보, 뭐 필요는 신청 절차와 증빙 기준 후보입니다.",
    "질문이 이미 짧더라도 normalizedQuestion은 가능한 한 완성된 문장으로 바꾸세요. 예: '쌤 병가 서류 뭐 필요?'는 '교사의 병가 신청 절차와 증빙자료 기준은?'처럼 정리합니다.",
    "지역명은 출발지/학교 소재지와 출장지를 구분하세요. 예: '포항 학교에서 안동 출장'은 학교 소재지 포항, 출장지 안동입니다.",
    "대상 주체, 사건·사유, 업무 단계, 증빙, 위험 신호를 보존하세요.",
    "구체 업무 대상을 버리지 마세요. 예: 늘봄 위탁 계약은 단순 회계보다 방과후·돌봄·늘봄 후보입니다.",
    "질문이 모호하면 answerability를 needs_slot 또는 unclassified로 두고, 짧은 추가 질문을 1~3개만 만드세요.",
    "normalizedQuestion은 규정 엔진에 넣을 한 문장 질문입니다.",
    "출력은 반드시 요청한 JSON 스키마만 따르세요."
  ].join("\n");
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

function buildPolicyQuestionNormalizerInput(payload = {}, baseResult = {}) {
  return {
    currentDate: new Date().toISOString().slice(0, 10),
    servicePurpose: "특성화고와 학교 현장을 위한 무료 규정·지침 Q&A",
    userQuestion: cleanLongText(payload.question || payload.q || ""),
    requestedOfficeLabel: cleanText(payload.officeLabel || payload.office || ""),
    requestedRoleLabel: cleanText(payload.roleLabel || payload.role || ""),
    localEngineResult: compactPolicyBaseResult(baseResult),
    outputGoal: {
      normalizedQuestion: "원문 사실만 보존한 규정 엔진용 한 문장 질문",
      intentDomain: "가능성이 높은 업무 영역 이름 또는 코드",
      slots: "원문에서 확인되는 대상·지역·업무단계·증빙·위험 신호",
      missingSlots: "답변 정확도에 필요한데 원문에 없는 정보"
    }
  };
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

function compactPolicyBaseResult(result = {}) {
  return {
    ok: Boolean(result.ok),
    question: cleanText(result.question || ""),
    domainCode: cleanText(result.semanticFrame?.domainCode || ""),
    domainLabel: cleanText(result.semanticFrame?.domainLabel || ""),
    confidence: Number(result.confidence || result.semanticFrame?.confidence || 0),
    answerState: cleanText(result.answerState?.status || ""),
    missingSlots: asArray(result.missingSlots).map(cleanText).filter(Boolean).slice(0, 8),
    candidates: asArray(result.semanticFrame?.candidates).slice(0, 5).map((candidate) => ({
      code: cleanText(candidate.code || candidate.domainCode || ""),
      label: cleanText(candidate.label || candidate.domainLabel || ""),
      confidence: Number(candidate.confidence || candidate.score || 0)
    }))
  };
}

export function buildPayloadFromLocalPolicyNormalizer(basePayload = {}, normalization = {}) {
  const slots = normalization.slots || {};
  const normalizedQuestion = cleanLongText(normalization.normalizedQuestion || basePayload.question || basePayload.q || "").slice(0, 500);
  const roleLabel = cleanText(basePayload.roleLabel || basePayload.role || slots.roleLabel || slots.targetSubject || "");
  const officeLabel = cleanText(basePayload.officeLabel || basePayload.office || slots.officeLabel || "");

  return {
    ...basePayload,
    question: normalizedQuestion || basePayload.question || basePayload.q || "",
    originalQuestion: basePayload.question || basePayload.q || "",
    roleLabel,
    officeLabel
  };
}

function attachLocalLlmNormalizerMetadata(result = {}, normalizerResult = {}, decision = {}) {
  const normalization = normalizerResult.normalization || {};
  return {
    ...result,
    localLlmNormalizer: {
      ok: Boolean(normalizerResult.ok),
      skipped: Boolean(normalizerResult.skipped || !decision.used),
      used: Boolean(decision.used),
      reason: cleanText(decision.reason || normalizerResult.reason || normalizerResult.error || ""),
      provider: normalizerResult.provider || "ollama",
      model: cleanText(normalizerResult.model || ""),
      elapsedMs: Number(normalizerResult.elapsedMs || 0) || 0,
      confidence: Number(normalization.confidence || 0),
      answerability: cleanText(normalization.answerability || ""),
      intentDomain: cleanText(normalization.intentDomain || ""),
      normalizedQuestion: cleanLongText(normalization.normalizedQuestion || decision.normalizedPayload?.question || "").slice(0, 500),
      baseScore: Number(decision.baseScore || 0) || 0,
      candidateScore: Number(decision.candidateScore || 0) || 0,
      usage: normalizerResult.usage || null
    }
  };
}

export function chooseBetterLocalPolicyResult(baseResult = {}, normalizedResult = {}, scores = {}) {
  if (!normalizedResult?.ok) return baseResult;
  if (!baseResult?.ok) return normalizedResult;
  const baseScore = Number.isFinite(scores.baseScore) ? scores.baseScore : scoreLocalPolicyResult(baseResult);
  const normalizedScore = Number.isFinite(scores.normalizedScore) ? scores.normalizedScore : scoreLocalPolicyResult(normalizedResult);
  if (hasLocalPolicyResultRegression(baseResult, normalizedResult, { baseScore, normalizedScore })) return baseResult;
  return normalizedScore > baseScore + 4 ? normalizedResult : baseResult;
}

export function hasLocalPolicyResultRegression(baseResult = {}, candidateResult = {}, scores = {}) {
  const baseDomain = cleanText(baseResult.semanticFrame?.domainCode || "");
  const candidateDomain = cleanText(candidateResult.semanticFrame?.domainCode || "");
  if (baseDomain && candidateDomain && baseDomain !== candidateDomain) {
    return !shouldAllowLocalDomainSwitch(baseResult, candidateResult, scores);
  }

  const baseMissing = new Set(asArray(baseResult.missingSlots));
  const candidateMissing = new Set(asArray(candidateResult.missingSlots));
  for (const slot of ["targetSubject", "travelerRole", "destination", "dateRange", "serviceIssue", "procedureStage", "riskSignal", "schoolLevel", "familyRelation"]) {
    if (!baseMissing.has(slot) && candidateMissing.has(slot)) return true;
  }

  const baseText = cleanText(baseResult.responseText || baseResult.answerState?.primaryText || "");
  const candidateText = cleanText(candidateResult.responseText || candidateResult.answerState?.primaryText || "");
  if (/지역 미특정/.test(candidateText) && !/지역 미특정/.test(baseText)) return true;
  if (/포항시에서\s*안동시로|안동시/.test(baseText) && !/안동시/.test(candidateText)) return true;

  return false;
}

function shouldAllowLocalDomainSwitch(baseResult = {}, candidateResult = {}, scores = {}) {
  if (!candidateResult?.semanticFrame?.domainCode) return false;
  if (isLowQualityPolicyResult(candidateResult)) return false;
  const baseDomain = cleanText(baseResult.semanticFrame?.domainCode || "");
  const candidateDomain = cleanText(candidateResult.semanticFrame?.domainCode || "");
  if (baseDomain && candidateDomain && baseDomain !== candidateDomain && hasStrongOriginalDomainAnchor(baseResult, baseDomain)) {
    return false;
  }
  if (hasUsablePolicyResult(baseResult)) return false;

  const baseStatus = cleanText(baseResult.answerState?.status || "");
  const candidateStatus = cleanText(candidateResult.answerState?.status || "");
  const baseConfidence = Number(baseResult.confidence || baseResult.semanticFrame?.confidence || 0);
  const candidateConfidence = Number(candidateResult.confidence || candidateResult.semanticFrame?.confidence || 0);
  const baseMissing = asArray(baseResult.missingSlots);
  const candidateMissing = asArray(candidateResult.missingSlots);
  const baseScore = Number.isFinite(scores.baseScore) ? scores.baseScore : scoreLocalPolicyResult(baseResult);
  const candidateScore = Number.isFinite(scores.normalizedScore) ? scores.normalizedScore : scoreLocalPolicyResult(candidateResult);
  const baseWeak = isLowQualityPolicyResult(baseResult)
    || ["unclassified", "needs_slot"].includes(baseStatus)
    || hasCriticalMissingSlots(baseMissing)
    || baseConfidence < 0.45;
  const candidateSpecific = ["definitive", "conditional", "needs_slot"].includes(candidateStatus)
    && candidateDomain
    && candidateScore >= baseScore + 8
    && candidateConfidence >= Math.min(baseConfidence, 0.45);

  if (!baseWeak || !candidateSpecific) return false;
  const newCriticalMissing = candidateMissing.filter((slot) => !baseMissing.includes(slot) && hasCriticalMissingSlots([slot]));
  return newCriticalMissing.length === 0;
}

export function scoreLocalPolicyResult(result = {}) {
  const stateScores = {
    definitive: 40,
    conditional: 32,
    needs_slot: 20,
    unclassified: 0
  };
  const missingPenalty = asArray(result.missingSlots).length * 4;
  const confidenceScore = Math.round(Number(result.confidence || result.semanticFrame?.confidence || 0) * 20);
  const domainScore = result.semanticFrame?.domainCode ? 25 : 0;
  const qualityPenalty = isLowQualityPolicyResult(result) ? 25 : 0;
  return domainScore + confidenceScore + (stateScores[result.answerState?.status] || 0) - missingPenalty - qualityPenalty;
}

function attachLocalPolicyDraft(result = {}, draft = {}, metadata = {}) {
  const guardedDraft = applyRequiredPolicyAnchors(draft, result);
  const nextResponse = {
    ...(result.policyResponse || {}),
    title: guardedDraft.title || result.policyResponse?.title || "",
    lead: guardedDraft.lead || result.policyResponse?.lead || "",
    answer: guardedDraft.answer.length ? guardedDraft.answer : result.policyResponse?.answer || [],
    steps: guardedDraft.steps.length ? guardedDraft.steps : result.policyResponse?.steps || [],
    caution: guardedDraft.caution || result.policyResponse?.caution || ""
  };
  const nextPrimaryText = guardedDraft.lead || guardedDraft.answer[0] || result.answerState?.primaryText || "";

  return {
    ...result,
    policyResponse: nextResponse,
    answerState: {
      ...(result.answerState || {}),
      primaryText: nextPrimaryText,
      conditionalAnswers: guardedDraft.answer.slice(1, 5),
      slotQuestions: guardedDraft.followupQuestions.length
        ? guardedDraft.followupQuestions.map((question, index) => ({
            slot: `local_llm_followup_${index + 1}`,
            label: "추가 확인",
            question
          }))
        : result.answerState?.slotQuestions || []
    },
    responseText: formatLocalPolicyDraftText(guardedDraft, result),
    localLlmComposer: metadata
  };
}

function applyRequiredPolicyAnchors(draft = {}, result = {}) {
  const requiredLines = getRequiredPolicyAnchorLines(result);
  if (!requiredLines.length) return draft;

  const draftText = [
    draft.title,
    draft.lead,
    ...asArray(draft.answer),
    ...asArray(draft.steps),
    draft.caution
  ].map(cleanLongText).filter(Boolean).join(" ");
  const missingLines = requiredLines.filter((line) => {
    if (/한의사/.test(line) && /진단서/.test(line)) {
      return !/한의사/.test(draftText) || !/진단서/.test(draftText);
    }
    return !draftText.includes(line);
  });
  const certificateLine = requiredLines.find((line) => /한의사/.test(line) && /진단서/.test(line));
  const shouldPromoteCertificateLead = certificateLine && !/한의사/.test(cleanLongText(draft.lead || ""));
  const filteredAnswer = asArray(draft.answer).filter((line) => !isLessSpecificMedicalCertificateLine(line));
  const filteredSteps = asArray(draft.steps).filter((line) => !isLessSpecificMedicalCertificateLine(line));
  const shouldFilterAnswer = filteredAnswer.length !== asArray(draft.answer).length;
  const shouldFilterSteps = filteredSteps.length !== asArray(draft.steps).length;
  if (!missingLines.length && !shouldPromoteCertificateLead && !shouldFilterAnswer && !shouldFilterSteps) return draft;

  return {
    ...draft,
    lead: shouldPromoteCertificateLead ? certificateLine : draft.lead,
    answer: uniqueDraftLines([...missingLines, ...filteredAnswer]).slice(0, 5),
    steps: filteredSteps
  };
}

function getRequiredPolicyAnchorLines(result = {}) {
  const frame = result.semanticFrame || {};
  const issueCode = cleanText(frame.slots?.serviceIssue?.code || "");
  const issueLabel = cleanText(frame.slots?.serviceIssue?.label || "");
  const question = cleanText(result.question || frame.question || frame.normalized || "");
  const isSickLeave = frame.domainCode === "staffAttendanceService"
    && (issueCode === "sickLeave" || /병가/.test(issueLabel) || /병가/.test(question));
  if (!isSickLeave) return [];

  const sourceLines = [
    result.policyResponse?.lead,
    ...asArray(result.policyResponse?.answer),
    ...asArray(result.policyResponse?.steps),
    result.policyResponse?.caution
  ].map(cleanLongText).filter(Boolean);
  const certificateLine = sourceLines.find((line) => /한의사/.test(line) && /진단서/.test(line));
  const certificateDetailLine = sourceLines.find((line) => /(입원확인서|진료확인서)/.test(line) && /(보조자료|대체 가능|별도로 확인)/.test(line));
  return uniqueDraftLines([
    certificateLine,
    certificateDetailLine,
    ...getGenericCriticalPolicyAnchorLines(sourceLines)
  ]).slice(0, 4);
}

function uniqueDraftLines(items = []) {
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

function isLessSpecificMedicalCertificateLine(line = "") {
  const text = cleanLongText(line);
  return /(의사.*진단서|진단서.*의사)/.test(text) && !/(한의사|치과의사)/.test(text);
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

function sanitizePolicyNormalization(value = {}) {
  const answerability = ["answerable", "needs_slot", "unclassified"].includes(value.answerability)
    ? value.answerability
    : "needs_slot";
  return {
    normalizedQuestion: cleanLongText(value.normalizedQuestion || "").slice(0, 500),
    intentDomain: cleanText(value.intentDomain || ""),
    answerability,
    confidence: clampNumber(value.confidence, 0, 1, 0),
    slots: sanitizePolicyNormalizationSlots(value.slots || {}),
    missingSlots: asArray(value.missingSlots).map(cleanText).filter(Boolean).slice(0, 8),
    clarifyingQuestions: asArray(value.clarifyingQuestions).map((item) => ({
      slot: cleanText(item?.slot || ""),
      label: cleanText(item?.label || ""),
      question: cleanLongText(item?.question || "").slice(0, 160)
    })).filter((item) => item.question).slice(0, 3),
    inferredFacts: asArray(value.inferredFacts).map(cleanLongText).filter(Boolean).slice(0, 8),
    mustNotAssume: asArray(value.mustNotAssume).map(cleanLongText).filter(Boolean).slice(0, 8),
    reason: cleanLongText(value.reason || "").slice(0, 260)
  };
}

function sanitizePolicyNormalizationSlots(slots = {}) {
  return {
    officeLabel: cleanText(slots.officeLabel || ""),
    roleLabel: cleanText(slots.roleLabel || ""),
    targetSubject: cleanText(slots.targetSubject || ""),
    schoolLocation: cleanText(slots.schoolLocation || ""),
    institution: cleanText(slots.institution || ""),
    origin: cleanText(slots.origin || ""),
    destination: cleanText(slots.destination || ""),
    duration: cleanText(slots.duration || ""),
    serviceIssue: cleanText(slots.serviceIssue || ""),
    procedureStage: cleanText(slots.procedureStage || ""),
    evidence: cleanText(slots.evidence || ""),
    riskSignal: cleanText(slots.riskSignal || "")
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

function hasUsablePolicyResult(result = {}) {
  const status = cleanText(result.answerState?.status || "");
  const confidence = Number(result.confidence || result.semanticFrame?.confidence || 0);
  return Boolean(
    result.ok &&
    result.semanticFrame?.domainCode &&
    result.policyResponse &&
    ["definitive", "conditional"].includes(status) &&
    confidence >= 0.74 &&
    !hasCriticalMissingSlots(result.missingSlots || []) &&
    !isLowQualityPolicyResult(result)
  );
}

function hasCriticalMissingSlots(missingSlots = []) {
  const critical = new Set([
    "targetSubject",
    "travelerRole",
    "destination",
    "dateRange",
    "serviceIssue",
    "procedureStage",
    "riskSignal",
    "schoolLevel",
    "familyRelation",
    "evidence"
  ]);
  return missingSlots.some((slot) => critical.has(slot));
}

function isLowQualityPolicyResult(result = {}) {
  const texts = [
    result.responseText,
    result.answerState?.primaryText,
    ...(result.answerState?.conditionalAnswers || []),
    ...(result.answerState?.definitiveAnswers || [])
  ].map((text) => cleanText(text)).filter(Boolean);
  return texts.some((text) => /질문만으로는 적용 규정을 특정하기 어렵|먼저.*인지.*인지|무엇을 원하는지|제가 할 수 있는 일이 아니|이해하기 어려워요/.test(text));
}

function hasStrongOriginalDomainAnchor(result = {}, domainCode = "") {
  const text = cleanText([
    result.originalQuestion,
    result.question,
    result.payload?.question
  ].join(" "));
  const patterns = {
    careerEmploymentGuidance: /졸업생|취업|채용|고졸채용|잡알리오|채용공고|추천채용|공채|근로계약|임금체불|체불임금|수습|해고|권고사직|부당해고|노동상담|노무상담|노동청|고용노동부|근로기준|근로조건/,
    instructorHonorarium: /강사료|강사수당|강사비|강의료|외부강사|시간당|원고료|자문료/,
    domesticTravelExpense: /출장비|국내출장|관외출장|근무지외|근무지내|여비|일비|식비|숙박비|운임/,
    vocationalFieldTrainingOperation: /현장실습|실습기업|참여기업|선도기업|표준협약|도제학교|일학습병행|실습생/,
    staffAttendanceService: /복무|근태|나이스근무상황|병가|연가|연차|특별휴가|출산휴가|배우자출산|육아시간|조퇴|지각|외출/,
    schoolViolenceProcedure: /학교폭력|학폭|전담기구|피해학생|가해학생|사안조사|보호조치/,
    facilityDigitalSecurity: /개인정보|정보보안|나이스계정|계정권한|CCTV|영상정보|초상권|홈페이지|SNS|사진|녹음|녹화/
  };
  return Boolean(patterns[domainCode]?.test(text));
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
