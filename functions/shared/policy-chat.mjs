import policyEngine from "../public/policy-engine.js";

const DEFAULT_OFFICE_LABEL = "경상북도교육청";
const DEFAULT_DETAIL_URL = "https://gyo6-law-info.web.app/";
const DEFAULT_KAKAO_THUMBNAIL_PATH = "/kakao-card-thumbnail.png";
const LOW_CONFIDENCE_THRESHOLD = 0.25;
const KAKAO_SIMPLE_TEXT_MAX_LENGTH = 430;
const DETAIL_CRITICAL_DOMAIN_CODES = new Set([
  "schoolViolenceProcedure",
  "studentRecordsAttendance",
  "schoolBudgetExecution",
  "staffAttendanceService",
  "vocationalFieldTrainingOperation",
  "classManagementGuidance",
  "teacherRightsProtection",
  "healthInfectionCounseling",
  "facilityDigitalSecurity",
  "governanceCommitteeRule"
]);
const DETAIL_CRITICAL_SLOTS = new Set([
  "evidence",
  "riskSignal",
  "procedureStage",
  "schoolRule",
  "fiscalYear"
]);
const CURATED_QUESTION_BUILDER_PROFILES = [
  {
    code: "staffAttendanceService",
    label: "교직원 복무·근태",
    replyLabel: "복무·근태 질문 만들기",
    aliases: [/복무|근태|휴가|출산|육아시간|모성보호|부성보호|병가|연가|연차|나이스|근무상황|지각|조퇴|외출/],
    requiredInfo: "대상 신분, 사유, 기간, 증빙, 소속 교육청",
    examples: [
      { label: "병가 예시", text: "기간제교사입니다. 병가 7일을 쓰려 하고 진단서가 있습니다. 경상북도교육청 기준으로 신청 절차와 유급 여부를 알려줘" },
      { label: "출산휴가 예시", text: "남자 교사입니다. 배우자 출산휴가를 받을 수 있는지, 가능 일수와 나이스 신청 절차를 알려줘" },
      { label: "연가 예시", text: "공립 고등학교 교사입니다. 올해 연가 사용 가능 일수와 나이스 근무상황 신청 절차를 알려줘" }
    ]
  },
  {
    code: "domesticTravelExpense",
    label: "국내 출장 여비",
    replyLabel: "출장 여비 질문 만들기",
    aliases: [/출장|여비|일비|식비|숙박|운임|교통비/],
    requiredInfo: "출장자 신분, 출발지, 출장지, 기간, 이동수단, 식사·숙박 여부",
    examples: [
      { label: "출장비 예시", text: "경주 소재 공립고 교장이 대구로 당일 출장갑니다. 근무지 외 국내출장 기준으로 일비와 식비, 운임 증빙 기준을 알려줘" },
      { label: "숙박 예시", text: "공립고 교사가 서울로 1박 2일 출장갑니다. 숙박비 상한과 일비·식비 계산 기준을 알려줘" }
    ]
  },
  {
    code: "vocationalFieldTrainingOperation",
    label: "특성화고 현장실습",
    replyLabel: "현장실습 질문 만들기",
    aliases: [/현장실습|실습생|도제|선도기업|표준협약|참여기업/],
    requiredInfo: "학생 상태, 실습기업, 사고·분쟁 여부, 현재 단계, 학교 조치 이력",
    examples: [
      { label: "사고 예시", text: "특성화고 학생이 현장실습 중 기계에 다쳤습니다. 학교와 기업의 즉시 보고, 실습 중단, 보호 조치 절차를 알려줘" },
      { label: "협약 예시", text: "특성화고 현장실습 표준협약을 체결하기 전 학교가 확인해야 할 기업 안전 기준과 학생 보호 절차를 알려줘" }
    ]
  },
  {
    code: "schoolBudgetExecution",
    label: "학교회계·예산·지출",
    replyLabel: "회계·지출 질문 만들기",
    aliases: [/예산|회계|지출|품의|검수|계약|영수증|카드전표|세금계산서|수익자부담/],
    requiredInfo: "회계연도, 집행 항목, 업무 단계, 증빙자료, 소속 교육청",
    examples: [
      { label: "지출 예시", text: "2026학년도 경상북도교육청 기준으로 학교 행사 물품 구입 지출을 하려 합니다. 품의, 검수, 지출결의, 증빙자료 기준을 알려줘" },
      { label: "수익자 예시", text: "수익자부담경비를 징수한 뒤 환불 사유가 생겼습니다. 정산과 환불 처리 절차, 필요한 증빙을 알려줘" }
    ]
  },
  {
    code: "studentRecordsAttendance",
    label: "학생부·출결·정정",
    replyLabel: "학생부·출결 질문 만들기",
    aliases: [/학생부|생활기록부|출결|결석|지각|정정|생기부/],
    requiredInfo: "학생 상황, 학교급, 처리 시점, 증빙자료, 정정 여부",
    examples: [
      { label: "출결 예시", text: "고등학생이 질병으로 3일 결석했습니다. 출결 처리와 진단서 등 증빙자료 기준을 알려줘" },
      { label: "정정 예시", text: "고등학교 학생부 기재 오류를 발견했습니다. 정정 절차와 학업성적관리위원회 확인이 필요한지 알려줘" }
    ]
  },
  {
    code: "afterSchoolChildcare",
    label: "방과후학교·돌봄",
    replyLabel: "방과후 질문 만들기",
    aliases: [/방과후|돌봄|늘봄|수강료|자유수강권|환불/],
    requiredInfo: "대상자, 수강료·환불 사유, 기간, 자유수강권 여부, 소속 교육청",
    examples: [
      { label: "환불 예시", text: "부산교육청 기준으로 방과후학교 수강료 환불 사유가 생겼습니다. 환불 기준, 수익자부담 처리, 증빙자료를 알려줘" },
      { label: "자유수강권 예시", text: "방과후학교 자유수강권 대상 학생의 수강료 지원과 환불 처리는 어떻게 하는지 알려줘" }
    ]
  },
  {
    code: "schoolViolenceProcedure",
    label: "학교폭력 사안처리",
    replyLabel: "학폭 질문 만들기",
    aliases: [/학교폭력|학폭|전담기구|사안조사|피해학생|가해학생|금품|폭행|괴롭힘|따돌림/],
    requiredInfo: "관련 학생, 발생 내용, 반복·위험 신호, 증빙자료, 현재 처리 단계",
    examples: [
      { label: "학폭 예시", text: "학생이 다른 학생에게 반복적으로 돈을 요구해 받아갔습니다. 피해학생 보호, 전담기구 판단, 필요한 기록과 절차를 알려줘" },
      { label: "서류 예시", text: "학교폭력 의심 사안이 접수되었습니다. 신청서·동의서·상담기록·사진 증빙과 보존 기준을 정리해줘" }
    ]
  },
  {
    code: "facilityDigitalSecurity",
    label: "개인정보·CCTV·보안",
    replyLabel: "개인정보 질문 만들기",
    aliases: [/개인정보|CCTV|영상정보|사진|초상권|홈페이지|SNS|녹음|녹화|나이스\s*계정|권한|정보보안/],
    requiredInfo: "자료 종류, 정보 주체, 공개·제공 대상, 동의·보존 여부, 소속 교육청",
    examples: [
      { label: "사진 예시", text: "학교 홈페이지에 학생 활동 사진을 게시하려 합니다. 동의서, 공개 범위, 보존·삭제 기준을 알려줘" },
      { label: "CCTV 예시", text: "학부모가 학교 CCTV 열람을 요청했습니다. 열람 가능 여부, 절차, 비식별 처리 기준을 알려줘" }
    ]
  },
  {
    code: "careerEmploymentGuidance",
    label: "취업지도·고졸채용·노동상담",
    replyLabel: "취업·노동 질문 만들기",
    aliases: [/취업|고졸채용|잡알리오|채용공고|학교장추천|졸업생|근로계약|임금체불|부당해고|노동청|근로조건|산재/],
    requiredInfo: "학생·졸업생 상태, 회사·공고 종류, 계약·근무 사실, 분쟁 내용, 증빙자료",
    examples: [
      { label: "임금체불 예시", text: "특성화고 졸업생이 근로계약서 없이 일하다 임금체불을 겪었습니다. 근무기록, 급여 내역, 노동청 진정 절차를 알려줘" },
      { label: "고졸채용 예시", text: "공공기관 고졸채용 공고를 확인하려 합니다. 잡알리오 1차 공고와 학교 추천 절차, 확인할 자료를 알려줘" }
    ]
  },
  {
    code: "legalRiskTriage",
    label: "법률·노무 위험 초기정리",
    replyLabel: "법률위험 질문 만들기",
    aliases: [/민사|소송|손해배상|형사|고소|고발|합의|노무사|변호사|노동청|진정|산재|명예훼손|모욕|아동학대|교권침해|법적\s*대응/],
    requiredInfo: "당사자, 사건 유형, 발생 시점, 이미 한 조치, 증빙자료, 긴급 위험",
    examples: [
      { label: "고소 예시", text: "학생이 교사 얼굴을 무단 촬영해 SNS에 올렸습니다. 캡처 증거가 있고 학교 조치와 고소 가능성, 교권보호 절차를 분리해 알고 싶습니다" },
      { label: "소송 예시", text: "현장실습 중 사고가 났고 병원 기록과 기업 보고 이력이 있습니다. 산재, 학교 보고, 손해배상 검토 전에 확인할 사실을 알려줘" },
      { label: "노무 예시", text: "졸업생이 임금체불과 부당해고를 주장합니다. 근로계약서, 출퇴근 기록, 노동청 진정 전 준비할 자료를 알려줘" }
    ]
  }
];
const QUESTION_BUILDER_PROFILES = buildQuestionBuilderProfiles();

function buildQuestionBuilderProfiles() {
  const curatedCodes = new Set(CURATED_QUESTION_BUILDER_PROFILES.map((profile) => profile.code));
  const generated = Object.entries(policyEngine.knowledgeBase?.domains || {})
    .filter(([code]) => !curatedCodes.has(code))
    .map(([code, domain]) => buildGeneratedQuestionBuilderProfile(code, domain))
    .filter(Boolean);
  return [...CURATED_QUESTION_BUILDER_PROFILES, ...generated];
}

function buildGeneratedQuestionBuilderProfile(code, domain = {}) {
  const keywords = (domain.intentKeywords || [])
    .map((keyword) => cleanText(keyword))
    .filter((keyword) => keyword.length >= 2)
    .slice(0, 14);
  const aliasPattern = buildKeywordAliasPattern(keywords, domain.label || code);
  if (!aliasPattern) return null;

  return {
    code,
    label: domain.label || code,
    replyLabel: `${buildShortProfileLabel(domain.label || code)} 질문 만들기`,
    aliases: [aliasPattern],
    requiredInfo: buildGeneratedProfileRequiredInfo(code, domain),
    examples: buildGeneratedProfileExamples(code, domain, keywords)
  };
}

function buildKeywordAliasPattern(keywords = [], fallback = "") {
  const terms = uniqueStrings([
    ...keywords,
    ...(fallback || "").split(/[·/,\s]+/).filter(Boolean)
  ])
    .map((term) => compactKoreanTerm(term))
    .filter((term) => term.length >= 2)
    .slice(0, 18);
  if (!terms.length) return null;
  return new RegExp(terms.map(escapeRegExp).join("|"));
}

function buildGeneratedProfileRequiredInfo(code, domain = {}) {
  const slots = Array.isArray(domain.requiredSlots) && domain.requiredSlots.length
    ? domain.requiredSlots
    : ["targetSubject", "procedureStage", "evidence", "riskSignal", "office"];
  return uniqueStrings(slots.map((slot) => getSlotLabel(slot, { domainCode: code }))).slice(0, 5).join(", ");
}

function buildGeneratedProfileExamples(code, domain = {}, keywords = []) {
  const label = domain.label || code;
  const seed = keywords[0] || label;
  return [
    {
      label: "완성질문 예시",
      text: `${label} 사안입니다. 대상자, 현재 단계, 증빙자료, 위험 신호, 소속 교육청을 포함해 ${seed} 처리 기준을 알려줘`
    }
  ];
}

function buildShortProfileLabel(label = "") {
  return cleanText(label).split(/[·/]/)[0].slice(0, 8) || "규정";
}

function compactKoreanTerm(value = "") {
  return cleanText(value).replace(/\s+/g, "");
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function handlePolicyChatRequest(payload = {}, options = {}) {
  const question = extractQuestion(payload);
  const originalQuestion = cleanText(payload.originalQuestion || "");
  const requestedOfficeLabel = cleanText(
    payload.officeLabel ||
    payload.office ||
    payload.educationOffice ||
    payload.action?.params?.officeLabel ||
    payload.action?.params?.office ||
    options.officeLabel ||
    ""
  );
  const roleLabel = cleanText(
    payload.roleLabel ||
    payload.role ||
    payload.action?.params?.roleLabel ||
    payload.action?.params?.role ||
    options.roleLabel ||
    ""
  );

  if (!question) {
    return {
      ok: false,
      error: "질문이 비어 있습니다.",
      needsClarification: true,
      prompt: "확인할 규정 질문을 한 문장으로 보내 주세요."
    };
  }

  const builderResult = buildQuestionBuilderResult(question, { requestedOfficeLabel, roleLabel });
  if (builderResult) return builderResult;

  const semanticFrame = policyEngine.buildPolicySemanticFrame(question);
  const officeLabel = requestedOfficeLabel || getOfficeLabelFromFrame(semanticFrame) || DEFAULT_OFFICE_LABEL;
  const policyResponse = policyEngine.buildPolicyResponse({
    question,
    originalQuestion,
    officeLabel,
    roleLabel
  });
  const needsClarification = shouldAskForClarification(semanticFrame, policyResponse);
  const missingSlots = semanticFrame.missingSlots || [];
  const missingSlotQuestions = buildMissingSlotQuestions(missingSlots, semanticFrame, question);
  const answerState = buildAnswerState({
    question,
    officeLabel,
    semanticFrame,
    policyResponse,
    needsClarification,
    missingSlots,
    missingSlotQuestions
  });

  return {
    ok: true,
    question,
    officeLabel,
    roleLabel,
    needsClarification,
    confidence: Number(semanticFrame.confidence || 0),
    semanticFrame: compactSemanticFrame(semanticFrame),
    missingSlots,
    missingSlotQuestions,
    answerState,
    completionFlow: buildConsultationCompletionFlow({
      question,
      officeLabel,
      semanticFrame,
      policyResponse,
      answerState,
      missingSlotQuestions
    }),
    policyResponse,
    responseText: buildChatText({
      question,
      originalQuestion,
      officeLabel,
      semanticFrame,
      policyResponse,
      answerState,
      needsClarification,
      missingSlots
    })
  };
}

export function buildKakaoSkillResponse(kakaoRequest = {}, options = {}) {
  const result = handlePolicyChatRequest(normalizeKakaoRequest(kakaoRequest), options);
  return buildKakaoSkillResponseFromResult(result, options);
}

export function buildKakaoSkillResponseFromResult(result = {}, options = {}) {
  const detailUrl = cleanText(options.detailUrl || DEFAULT_DETAIL_URL);
  const outputs = [{ simpleText: { text: buildKakaoSimpleText(result) } }];
  const quickReplies = buildQuickReplies(result, { detailUrl });
  const shouldRenderCard = options.renderCard === true;

  if (shouldRenderCard && result.ok && result.policyResponse) {
    outputs.push({
      basicCard: {
        title: result.policyResponse.title || result.semanticFrame.domainLabel || "GYO6 규정 확인",
        description: buildKakaoCardDescription(result),
        thumbnail: {
          imageUrl: buildKakaoThumbnailUrl(detailUrl, options.thumbnailUrl)
        },
        buttons: [
          {
            action: "webLink",
            label: "웹에서 자세히 보기",
            webLinkUrl: buildDetailUrl(detailUrl, result.question)
          }
        ]
      }
    });
  }

  return {
    version: "2.0",
    template: {
      outputs,
      quickReplies
    }
  };
}

export function normalizeKakaoRequest(kakaoRequest = {}) {
  const params = kakaoRequest.action?.params || {};
  return {
    question: cleanText(params.question || kakaoRequest.userRequest?.utterance || ""),
    officeLabel: cleanText(params.officeLabel || params.office || params.educationOffice || ""),
    roleLabel: cleanText(params.roleLabel || params.role || ""),
    action: kakaoRequest.action || null,
    user: kakaoRequest.userRequest?.user || null
  };
}

function extractQuestion(payload = {}) {
  return cleanText(
    payload.question ||
    payload.q ||
    payload.utterance ||
    payload.text ||
    payload.userRequest?.utterance ||
    payload.action?.params?.question ||
    ""
  );
}

function shouldAskForClarification(semanticFrame = {}, policyResponse = null) {
  if (!policyResponse || !semanticFrame.domainCode) return true;
  if (semanticFrame.intentClarification?.needsConfirmation) return true;
  if (hasReadyPolicyLookup(semanticFrame)) return false;
  if (Number(semanticFrame.confidence || 0) < LOW_CONFIDENCE_THRESHOLD) return true;
  return (semanticFrame.missingSlots || []).length > 0;
}

function hasReadyPolicyLookup(semanticFrame = {}) {
  const missingSlots = semanticFrame.missingSlots || [];
  if (missingSlots.length) return false;
  const lookupPlan = semanticFrame.lookupPlan || {};
  if (lookupPlan.status === "ready") return true;

  const requiredSlots = semanticFrame.requiredSlots || lookupPlan.requiredSlots || [];
  if (!requiredSlots.length) return false;
  const slots = semanticFrame.slots || {};
  return requiredSlots.every((slot) => Boolean(slots[slot]?.detected));
}

function buildChatText({ question, originalQuestion, officeLabel, semanticFrame, policyResponse, answerState, needsClarification, missingSlots }) {
  if (!policyResponse || !semanticFrame.domainCode) {
    return [
      "질문만으로는 적용 규정을 특정하기 어렵습니다.",
      "아래 분야 중 가까운 것을 고르면 필요한 정보를 모아 완성질문으로 바꾼 뒤 다시 답변합니다.",
      `원문: ${question}`
    ].join("\n");
  }

  const lines = [];
  if (originalQuestion && originalQuestion !== question) {
    lines.push(`제가 이해한 질문 요지: ${question}`);
    lines.push("");
  }
  const intentClarification = semanticFrame.intentClarification || {};
  if (intentClarification.needsConfirmation) {
    lines.push("질문 요지 확인이 필요합니다.");
    lines.push(intentClarification.summary || "질문 속 단서가 여러 규정 분야에 걸려 있어 먼저 요지를 좁혀야 합니다.");
    if (intentClarification.question) lines.push(`확인 질문: ${intentClarification.question}`);
    return lines.filter(Boolean).join("\n").slice(0, 980);
  }

  const primaryText = cleanText(answerState?.primaryText) || getPolicyPrimaryText({
    policyResponse,
    frame: semanticFrame,
    needsClarification,
    missingSlots
  });
  lines.push(primaryText || `${semanticFrame.domainLabel} 기준을 확인합니다.`);

  if (Array.isArray(policyResponse.answer)) {
    for (const item of policyResponse.answer.slice(0, 2)) {
      const text = typeof item === "string" ? item : item.text || item.summary || "";
      if (text && !isSamePolicyText(text, primaryText)) lines.push(`- ${text}`);
    }
  } else if (typeof policyResponse.answer === "string" && !isSamePolicyText(policyResponse.answer, primaryText)) {
    lines.push(policyResponse.answer);
  }

  if (needsClarification && missingSlots.length) {
    lines.push("");
    lines.push(`정확도를 높이려면 ${formatMissingSlots(missingSlots, semanticFrame)} 정보가 더 필요합니다.`);
  }

  if (officeLabel === DEFAULT_OFFICE_LABEL && !hasOfficeSignal(question)) {
    lines.push("");
    lines.push("교육청을 고르지 않아 경상북도교육청 기준으로 먼저 안내합니다. 실제 적용은 소속 교육청 지침 확인이 필요합니다.");
  }

  if (policyResponse.caution) {
    lines.push("");
    lines.push(policyResponse.caution);
  }

  return lines.filter(Boolean).join("\n").slice(0, 980);
}

function buildKakaoSimpleText(result = {}) {
  if (!result.ok) {
    return clipKakaoText(result.prompt || result.error || "확인할 규정 질문을 한 문장으로 보내 주세요.");
  }

  if (result.clarificationFlow?.type === "question_builder") {
    return clipKakaoText(buildQuestionBuilderSimpleText(result));
  }

  const frame = result.semanticFrame || {};
  const policyResponse = result.policyResponse || {};
  if (!policyResponse || !frame.domainCode) {
    return clipKakaoText([
      "질문만으로는 적용 규정을 특정하기 어렵습니다.",
      "아래에서 가까운 분야를 누르면 필요한 정보를 모아 완성질문으로 바꿔 답변하겠습니다."
    ].join("\n"));
  }

  const lines = [];
  const intentClarification = frame.intentClarification || {};
  if (intentClarification.needsConfirmation) {
    lines.push("질문 요지 확인 필요");
    lines.push(intentClarification.summary || "질문이 여러 규정 분야에 걸립니다.");
    if (intentClarification.question) lines.push(`확인: ${intentClarification.question}`);
    lines.push("아래 버튼으로 가까운 항목을 골라 주세요.");
    return clipKakaoText(lines.join("\n"));
  }

  const summary = getKakaoPrimarySummary(result, policyResponse, frame);
  if (summary) {
    lines.push(`요약: ${summary}`);
  } else {
    lines.push("요약: 현재 질문만으로는 결론을 바로 좁히기 어렵습니다.");
    lines.push("필요한 정보를 보태면 적용 규정과 처리 방법을 다시 답변하겠습니다.");
  }

  if (result.needsClarification && result.missingSlots?.length) {
    lines.push(`확인 필요: ${formatMissingSlots(result.missingSlots, frame)}.`);
  } else if (result.officeLabel) {
    lines.push(`기준: ${result.officeLabel}${result.officeLabel === DEFAULT_OFFICE_LABEL && !hasOfficeSignal(result.question) ? " 우선" : ""}`);
  }

  if (result.officeLabel === DEFAULT_OFFICE_LABEL && !hasOfficeSignal(result.question)) {
    lines.push("소속 교육청이 다르면 교육청 지정 버튼으로 바꿔 확인하세요.");
  }

  lines.push(isDetailCriticalResult(result)
    ? "서류·절차는 아래 자세히 보기에서 확인하세요."
    : "아래 자세히 보기에서 확인하세요.");
  return clipKakaoText(lines.join("\n"));
}

function getKakaoPrimarySummary(result = {}, policyResponse = {}, frame = {}) {
  const answerTexts = uniqueStrings([
    ...(result.answerState?.definitiveAnswers || []),
    ...(result.answerState?.conditionalAnswers || []),
    ...getAnswerTexts(policyResponse.answer)
  ]).filter((text) => text && !isInternalProcessText(text));
  const domainSummary = getDomainSpecificKakaoSummary(result, policyResponse, frame);
  if (domainSummary) return domainSummary;

  const richAnswer = answerTexts.find((text) => isHighValueKakaoSummary(text, frame));
  if (richAnswer) {
    const compact = getCompactSentence(richAnswer, 190);
    const primaryText = cleanText(result.answerState?.primaryText || policyResponse.lead || "");
    if (frame.domainCode === "domesticTravelExpense"
      && /근무지\s*외\s*국내출장/.test(primaryText)
      && !/근무지\s*외\s*국내출장/.test(compact)) {
      return getCompactSentence(`${compact} 근무지 외 국내출장 기준입니다.`, 220);
    }
    return compact;
  }

  if (result.answerState?.primaryText) {
    return getCompactSentence(result.answerState.primaryText, 170);
  }
  const sourceText = getPolicyPrimaryText({
    policyResponse,
    frame,
    needsClarification: result.needsClarification,
    missingSlots: result.missingSlots || []
  }) || `${frame.domainLabel || "규정·지침"} 확인 기준입니다.`;
  return getCompactSentence(sourceText, 170);
}

function getDomainSpecificKakaoSummary(result = {}, policyResponse = {}, frame = {}) {
  if (frame.domainCode === "staffAttendanceService") {
    const question = cleanText(result.originalQuestion || result.question || "");
    const issueCode = cleanText(frame.slots?.serviceIssue?.code || "");
    const issueLabel = cleanText(frame.slots?.serviceIssue?.label || "");
    const roleLabel = cleanText(frame.slots?.travelerRole?.subjectLabel || frame.slots?.travelerRole?.roleLabel || "");
    const answerTexts = getAnswerTexts(policyResponse.answer);

    if (issueCode === "annualLeave" || /연가|연차/.test(question)) {
      const hasThirdYearSignal = /3\s*년\s*차|3\s*년\s*이상|삼\s*년\s*차/.test(question.replace(/\s+/g, ""));
      const tableText = answerTexts.find((text) => /재직기간별|1개월\s*이상|6년\s*이상|21일/.test(text)) || "";
      if (hasThirdYearSignal && /16\s*일/.test(tableText)) {
        return getCompactSentence(
          `${roleLabel || "교원"} 연가는 재직기간별로 산정하며, 3년 이상 4년 미만은 16일입니다. 나이스 근무상황에서 사전 신청하고 학교장 승인 후 사용합니다.`,
          220
        );
      }
      return getCompactSentence(
        tableText || `${roleLabel || "교원"} 연가는 재직기간별 일수표와 나이스 근무상황 신청, 학교장 승인 절차를 함께 확인합니다.`,
        220
      );
    }

    if (issueCode === "sickLeave" || /병가/.test(issueLabel) || /병가/.test(question)) {
      const evidenceFocused = /서류|증빙|진단서|확인서|입원확인|진료확인|뭐\s*필요|뭐필요/.test(question);
      if (evidenceFocused) {
        const evidenceText = answerTexts.find((text) => /의사|치과의사|한의사|진단서|증빙자료|6일/.test(text)) || "";
        return getCompactSentence(
          evidenceText || `${roleLabel || "교직원"} 병가 서류는 병가 사용일수에 따라 달라지며, 연간 6일 초과 병가는 의사·치과의사·한의사가 발급한 진단서 기준을 먼저 확인합니다.`,
          240
        );
      }
      const sickLeaveText = answerTexts.find((text) => /60일|180일|진단서|한의사|6일/.test(text)) || "";
      return getCompactSentence(
        sickLeaveText || `${roleLabel || "교직원"} 병가는 일반 병가와 공무상 병가, 진단서 기준, 나이스 근무상황 신청 절차를 함께 확인합니다.`,
        220
      );
    }
  }

  if (frame.domainCode === "careerEmploymentGuidance") {
    const question = cleanText(result.originalQuestion || result.question || "");
    if (/임금체불|체불임금|근로계약|노동상담|노무상담|노동청|고용노동부|해고|권고사직|수습/.test(question)) {
      return getCompactSentence(
        "졸업생·학생의 근로계약, 임금체불, 해고 등은 취업지도와 노동상담 사안으로 분리해 봅니다. 계약서, 임금지급 내역, 근무기록, 상담·신고 이력을 증빙으로 정리하세요.",
        220
      );
    }
    if (/채용|공고|잡알리오|고졸채용|추천채용|공채/.test(question)) {
      return getCompactSentence(
        "채용정보는 잡알리오 등 1차 공식 공고를 먼저 확인하고, 교육청 취업지원센터·학교 공고는 누락 보완과 교차검증 출처로 봅니다.",
        200
      );
    }
  }

  if (frame.domainCode === "schoolMealOperation") {
    const question = cleanText(result.originalQuestion || result.question || "");
    if (/식중독(?:은|는)?\s*없|식중독\s*아니/.test(question)) {
      return getCompactSentence(
        "학교급식 반찬 민원으로 보고 식단·급식 운영 기준, 면담·민원 기록, 필요 시 학교장 보고 절차를 확인합니다. 식중독 의심이 없으면 안전사고로 단정하지 않습니다.",
        220
      );
    }
    return getCompactSentence(
      "학교급식·위생·민원 사안입니다. 식중독·알레르기 위험 여부, 보존식·검식 자료, 식단 공개와 민원 기록을 나눠 확인하세요.",
      200
    );
  }

  if (frame.domainCode === "afterSchoolChildcare") {
    return getCompactSentence(
      "방과후학교·돌봄·늘봄 운영 사안입니다. 위탁 계약, 강사 선정, 수강료·환불, 학생 안전관리 자료를 소속 교육청 지침으로 확인합니다.",
      200
    );
  }

  if (frame.domainCode === "classManagementGuidance") {
    const question = cleanText(result.originalQuestion || result.question || "");
    if (/수업|지시|따르지|불응|수업방해|훈육|조치|선도|생활지도/.test(question)) {
      return getCompactSentence(
        "반복적인 수업 지시불응은 학생생활규정과 생활지도 기준에 따라 단계적 지도, 상담·보호자 안내, 선도절차 가능 여부, 기록 보존을 나눠 확인합니다.",
        220
      );
    }
    return getCompactSentence(
      "학급관리·학생생활지도 사안입니다. 학교생활규정, 학생 인권, 상담·보호자 안내, 기록 보존과 민원 전환 위험을 함께 확인합니다.",
      200
    );
  }

  if (frame.domainCode === "facilityDigitalSecurity") {
    const question = cleanText(result.originalQuestion || result.question || "");
    if (/사진|단체사진|얼굴|초상권|졸업앨범|영상|녹음|녹화|SNS|sns|홈페이지|가정통신문/.test(question)) {
      return getCompactSentence(
        "사진·영상·녹음·SNS·홈페이지 게시 사안은 개인정보·초상권, 촬영·게시 동의, 공개 범위, 보관·삭제 기준을 먼저 확인합니다.",
        210
      );
    }
  }

  if (frame.domainCode === "teacherRightsProtection") {
    const question = cleanText(result.originalQuestion || result.question || "");
    if (/고소|고발|소송|민사|형사|손해배상|명예훼손|모욕|협박|아동학대신고|문자|카톡|캡처|녹취|증거/.test(question)) {
      return getCompactSentence(
        "교직원 관련 고소·소송 고민은 교육활동 침해 여부, 민원·상담 경위, 문자·녹취 등 증빙 보존, 교원 보호조치와 법률상담 전환 필요성을 나눠 봅니다.",
        220
      );
    }
    if (/교사|교원|선생님|담임/.test(question) && /사진|얼굴|영상|촬영|녹음|녹화|통화녹음|SNS|sns|공개|유포|게시/.test(question)) {
      return getCompactSentence(
        "교직원 대상 무단 촬영·녹음·공개·SNS 유포는 교육활동 보호, 학생 생활지도, 개인정보·명예훼손 위험, 증거 보존을 나눠 처리합니다.",
        220
      );
    }
  }

  if (frame.domainCode === "healthInfectionCounseling") {
    const question = cleanText(result.originalQuestion || result.question || "");
    if (/상담기록|상담일지|학생상담|Wee|wee/.test(question) && /공개|열람|제공|공유|보여|요구/.test(question)) {
      return getCompactSentence(
        "학생 상담기록은 비밀보호와 학생 안전, 보호자 안내 필요성, 제공 대상·범위, 기록 보존 기준을 분리해 확인해야 합니다.",
        200
      );
    }
  }

  if (frame.domainCode !== "schoolViolenceProcedure") return "";

  const question = cleanText(result.question || "");
  if (/금품|돈|갈취|빼앗|강요|요구|받아갔/.test(question)) {
    return getCompactSentence(
      "반복적 금품 요구·수수 정황이면 학교폭력 사안으로 접수해 사안조사 대상인지 검토할 수 있습니다. 피해학생 보호, 보호자 통지, 전담기구 판단, 증빙 확보를 함께 진행하세요.",
      220
    );
  }

  const procedureText = getAnswerTexts(policyResponse.answer)
    .find((text) => /신고·접수|사안조사|피해학생\s*보호|전담기구|심의\s*요청|보호조치/.test(text));
  return procedureText ? getCompactSentence(procedureText, 190) : "";
}

function isHighValueKakaoSummary(value = "", frame = {}) {
  const text = cleanText(value);
  if (!text) return false;
  if (frame.domainCode === "domesticTravelExpense") {
    return /출장비|여비|일비|식비|숙박비|운임/.test(text)
      && /\d[\d,]*\s*원|최대|합계|실비|상한/.test(text);
  }
  if (frame.domainCode === "careerEmploymentGuidance") {
    return /졸업생|취업|채용|잡알리오|고졸채용|근로계약|임금체불|노동|근로조건/.test(text)
      && !/^증빙자료/.test(text)
      && !isGenericSlotScaffoldingText(text);
  }
  return /(?:\d+\s*일|진단서|증빙자료|유급|무급|상한|환불|승인|보고)/.test(text)
    && !isGenericSlotScaffoldingText(text);
}

function buildAnswerState({
  question = "",
  officeLabel = "",
  semanticFrame = {},
  policyResponse = null,
  needsClarification = false,
  missingSlots = [],
  missingSlotQuestions = []
} = {}) {
  if (!policyResponse || !semanticFrame.domainCode) {
    const slotQuestions = buildUnclassifiedSlotQuestions(question);
    return {
      version: "20260613-answer-state-v1",
      status: "unclassified",
      confidence: Number(semanticFrame.confidence || 0),
      definitiveAnswers: [],
      conditionalAnswers: [],
      slotQuestions,
      caveats: [],
      primaryText: "질문만으로는 적용 규정을 특정하기 어렵습니다. 가까운 분야를 선택하면 필요한 정보를 받아 완성질문으로 다시 답변합니다.",
      basis: buildAnswerBasis({ question, officeLabel, semanticFrame, policyResponse })
    };
  }

  const frame = compactSemanticFrame(semanticFrame);
  const answerTexts = getAnswerTexts(policyResponse.answer);
  const intentClarification = semanticFrame.intentClarification || {};
  const primaryText = intentClarification.needsConfirmation
    ? buildIntentClarificationPrimaryText(intentClarification)
    : getPolicyPrimaryText({
      policyResponse,
      frame,
      needsClarification,
      missingSlots
    }) || policyResponse.lead || answerTexts[0] || "";
  const caveats = uniqueStrings([
    policyResponse.caution,
    officeLabel === DEFAULT_OFFICE_LABEL && !hasOfficeSignal(question)
      ? "경상북도교육청 기준으로 우선 안내하며, 실제 적용은 소속 교육청 지침 확인이 필요합니다."
      : ""
  ]);
  const conditional = isConditionalAnswerContext({
    question,
    officeLabel,
    needsClarification,
    missingSlots,
    policyResponse,
    texts: [primaryText, ...answerTexts, ...caveats]
  });
  const status = needsClarification || missingSlots.length
    ? "needs_slot"
    : conditional
      ? "conditional"
      : "definitive";
  const userFacingTexts = uniqueStrings([primaryText, ...answerTexts])
    .filter((text) => text && !isInternalProcessText(text));

  return {
    version: "20260613-answer-state-v1",
    status,
    confidence: Number(semanticFrame.confidence || 0),
    definitiveAnswers: status === "definitive" ? userFacingTexts : [],
    conditionalAnswers: status === "definitive" ? [] : userFacingTexts,
    slotQuestions: missingSlotQuestions,
    caveats,
    primaryText,
    basis: buildAnswerBasis({ question, officeLabel, semanticFrame, policyResponse })
  };
}

function buildConsultationCompletionFlow({
  question = "",
  officeLabel = "",
  semanticFrame = {},
  policyResponse = null,
  answerState = {},
  missingSlotQuestions = []
} = {}) {
  const status = answerState.status || "";
  if (!["unclassified", "needs_slot"].includes(status) && !semanticFrame.intentClarification?.needsConfirmation) {
    return {
      needed: false,
      status: status || "ready",
      nextQuestions: []
    };
  }

  const clarification = semanticFrame.intentClarification || {};
  const nextQuestions = uniqueSlotQuestions([
    ...(missingSlotQuestions || []),
    ...(answerState.slotQuestions || [])
  ]).slice(0, 3);
  const candidateDomains = (clarification.candidates?.length ? clarification.candidates : semanticFrame.candidates || [])
    .slice(0, 6)
    .map((candidate) => ({
      code: candidate.code || "",
      label: candidate.label || candidate.code || "",
      summary: candidate.summary || candidate.label || candidate.code || ""
    }));

  return {
    needed: true,
    status: status || "needs_slot",
    type: !policyResponse || !semanticFrame.domainCode
      ? "choose_domain"
      : clarification.needsConfirmation
        ? "confirm_intent"
        : "collect_slots",
    question,
    officeLabel,
    domainCode: semanticFrame.domainCode || "",
    domainLabel: semanticFrame.domainLabel || "",
    summary: clarification.summary || answerState.primaryText || "질문을 완성해야 정확한 규정 조회가 가능합니다.",
    nextQuestions,
    candidateDomains,
    completionInstruction: "사용자의 추가 답변을 원 질문에 합쳐 다시 분류하고, 충분해지면 같은 규정 조회 엔진으로 답변합니다."
  };
}

function buildAnswerBasis({ question = "", officeLabel = "", semanticFrame = {}, policyResponse = null } = {}) {
  return {
    domainCode: semanticFrame.domainCode || "",
    domainLabel: semanticFrame.domainLabel || "",
    task: semanticFrame.task?.code || "",
    lookupStatus: semanticFrame.lookupPlan?.status || "",
    officeLabel: officeLabel || "",
    sourcePriority: policyResponse?.sourcePriority || "",
    sourceKeys: policyResponse?.sourceKeys || [],
    defaultOfficeApplied: officeLabel === DEFAULT_OFFICE_LABEL && !hasOfficeSignal(question)
  };
}

function isConditionalAnswerContext({ question = "", officeLabel = "", needsClarification = false, missingSlots = [], policyResponse = {}, texts = [] } = {}) {
  if (needsClarification || missingSlots.length) return true;
  if (officeLabel === DEFAULT_OFFICE_LABEL && !hasOfficeSignal(question)) return true;
  if (policyResponse?.sourcePriority === "office" && !hasOfficeSignal(question)) return true;
  return texts.some((text) => /후보|준용|가능|다를 수|소속 교육청|근로계약|학교 내부|지침 확인|확인해야|확정|조건|우선 안내/.test(cleanText(text)));
}

function getPolicyPrimaryText({ policyResponse = {}, frame = {}, needsClarification = false, missingSlots = [] } = {}) {
  const lead = cleanText(policyResponse.lead || "");
  const answerText = cleanText(getBestUserFacingAnswerText(policyResponse.answer) || getFirstAnswerText(policyResponse.answer));
  const resolved = hasResolvedPrimarySlots({ frame, needsClarification, missingSlots });

  if (resolved && answerText && frame.task === "evidence") {
    return answerText;
  }

  if (resolved && answerText && isInternalProcessText(lead) && !isInternalProcessText(answerText)) {
    return answerText;
  }

  return lead || answerText || "";
}

function buildIntentClarificationPrimaryText(intentClarification = {}) {
  const label = cleanText(intentClarification.label || "규정 분야");
  const summary = cleanText(intentClarification.summary || "질문 속 단서가 여러 규정 분야에 걸려 있습니다.");
  const question = cleanText(intentClarification.question || `${label}를 먼저 확인해야 합니다.`);
  return `질문 요지 확인 필요: ${summary} ${question}`;
}

function hasResolvedPrimarySlots({ frame = {}, needsClarification = false, missingSlots = [] } = {}) {
  const lookupStatus = cleanText(frame.lookupStatus || frame.lookupPlan?.status || "");
  if (needsClarification) return false;
  if (missingSlots.length) return false;
  if (lookupStatus && lookupStatus !== "ready") return false;
  return true;
}

function isGenericSlotScaffoldingText(value = "") {
  const text = cleanText(value);
  if (!text) return false;
  const hasSlotWords = /대상\s*신분|적용\s*기관|업무\s*단계|증빙\s*자료|증빙자료|위험\s*신호|가족\s*관계|가족관계|근무지\s*내|근무지\s*외|소속\s*기관|학교\s*내부\s*규정/.test(text);
  const hasUnresolvedVerb = /먼저|확정|확인|구분|분리|가른|명확하지|확인\s*필요/.test(text);
  return (hasSlotWords && hasUnresolvedVerb) || /인지.{0,40}인지/.test(text);
}

function isInternalProcessText(value = "") {
  const text = cleanText(value);
  if (!text) return false;
  if (isGenericSlotScaffoldingText(text)) return true;
  return /먼저\s*(?:확인|조회|분류|대조)|함께\s*확인|절차를\s*함께\s*확인|분리해\s*(?:조회|확인|처리)|대조합니다|조회합니다/.test(text);
}

function isSamePolicyText(a = "", b = "") {
  return normalizePolicyText(a) === normalizePolicyText(b);
}

function normalizePolicyText(value = "") {
  return cleanText(value).replace(/^[-•]\s*/, "");
}

function getFirstAnswerText(answer) {
  if (Array.isArray(answer)) {
    const item = answer.find(Boolean);
    if (!item) return "";
    return typeof item === "string" ? item : item.text || item.summary || "";
  }
  return typeof answer === "string" ? answer : "";
}

function getBestUserFacingAnswerText(answer) {
  if (!Array.isArray(answer)) {
    return typeof answer === "string" && !isInternalProcessText(answer) ? answer : "";
  }
  for (const item of answer) {
    const text = typeof item === "string" ? item : item?.text || item?.summary || "";
    if (text && !isInternalProcessText(text)) return text;
  }
  return "";
}

function getAnswerTexts(answer) {
  if (Array.isArray(answer)) {
    return uniqueStrings(answer.map((item) => typeof item === "string" ? item : item?.text || item?.summary || ""));
  }
  return typeof answer === "string" ? [answer] : [];
}

function getCompactSentence(value = "", maxLength = 170) {
  const text = cleanText(value)
    .replace(/^[-•]\s*/, "")
    .replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;

  const punctuationIndexes = ["다.", "요.", "니다.", ". ", "? ", "! "]
    .map((mark) => text.indexOf(mark))
    .filter((index) => index > 30 && index <= maxLength)
    .sort((a, b) => a - b);
  if (punctuationIndexes.length) {
    return text.slice(0, punctuationIndexes[0] + 2).trim();
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function clipKakaoText(value = "") {
  const text = cleanText(value);
  return text.length > KAKAO_SIMPLE_TEXT_MAX_LENGTH
    ? `${text.slice(0, KAKAO_SIMPLE_TEXT_MAX_LENGTH - 3).trim()}...`
    : text;
}

function compactSemanticFrame(frame = {}) {
  return {
    domainCode: frame.domainCode || "",
    domainLabel: frame.domainLabel || "",
    categoryCode: frame.categoryCode || "",
    confidence: Number(frame.confidence || 0),
    task: frame.task?.code || "",
    slots: compactSemanticSlots(frame.slots || {}),
    missingSlots: frame.missingSlots || [],
    lookupStatus: frame.lookupPlan?.status || "",
    intentClarification: compactIntentClarification(frame.intentClarification),
    candidates: (frame.domainCandidates || []).slice(0, 3).map((candidate) => ({
      code: candidate.code,
      label: candidate.label,
      confidence: candidate.confidence,
      matchedKeywords: candidate.matchedKeywords || []
    }))
  };
}

function compactSemanticSlots(slots = {}) {
  const compacted = {};
  for (const [key, value] of Object.entries(slots || {})) {
    if (!value || typeof value !== "object") continue;
    compacted[key] = {
      code: cleanText(value.code || ""),
      label: cleanText(value.label || value.subjectLabel || value.roleLabel || ""),
      roleCode: cleanText(value.roleCode || ""),
      roleLabel: cleanText(value.roleLabel || ""),
      subjectLabel: cleanText(value.subjectLabel || ""),
      detected: Boolean(value.detected),
      days: Number(value.days || 0) || undefined,
      items: Array.isArray(value.items) ? value.items.map(cleanText).filter(Boolean).slice(0, 6) : undefined
    };
  }
  return compacted;
}

function compactIntentClarification(intentClarification = {}) {
  if (!intentClarification?.needsConfirmation) return { needsConfirmation: false };
  return {
    needsConfirmation: true,
    type: intentClarification.type || "",
    slot: intentClarification.slot || "policyDomain",
    label: intentClarification.label || "규정 분야",
    summary: intentClarification.summary || "",
    question: intentClarification.question || "",
    placeholder: intentClarification.placeholder || "",
    candidates: (intentClarification.candidates || []).slice(0, 6).map((candidate) => ({
      code: candidate.code || "",
      label: candidate.label || candidate.code || "",
      summary: candidate.summary || candidate.label || candidate.code || "",
      confidence: Number(candidate.confidence || 0)
    }))
  };
}

function getOfficeLabelFromFrame(frame = {}) {
  const office = frame.slots?.office;
  if (!office || office.detected === false) {
    return "";
  }
  return cleanText(office.label || office.officeLabel || "");
}

function buildMissingSlotQuestions(missingSlots = [], semanticFrame = {}, question = "") {
  const intentQuestion = buildIntentClarificationSlotQuestion(semanticFrame, question);
  const slotQuestions = missingSlots.slice(0, 3).map((slot) => ({
    slot,
    label: getSlotLabel(slot, semanticFrame),
    question: getSlotQuestion(slot, semanticFrame, question)
  }));
  return uniqueSlotQuestions([intentQuestion, ...slotQuestions]);
}

function buildIntentClarificationSlotQuestion(semanticFrame = {}, question = "") {
  const clarification = semanticFrame.intentClarification || {};
  if (!clarification.needsConfirmation) return null;
  const label = clarification.label || "규정 분야";
  const placeholder = cleanText(clarification.placeholder || "").replace(/^예:\s*/, "");
  const instruction = placeholder
    ? `${label}를 구체화해 다시 물어봐줘. 예: ${placeholder}`
    : `${label}를 구체화해 다시 물어봐줘`;
  return {
    slot: clarification.slot || "policyDomain",
    label,
    question: buildContextualSlotQuestion(question, semanticFrame.domainLabel || "", instruction)
  };
}

function uniqueSlotQuestions(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.slot || !item?.label || !item?.question) return false;
    const key = `${item.slot}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildQuickReplies(result = {}, options = {}) {
  if (!result.ok) {
    return [
      { label: "출장 여비", action: "message", messageText: "교사의 경주 출장시 일비와 식비는?" },
      { label: "현장실습", action: "message", messageText: "현장실습 중 안전사고가 나면 학교는 무엇을 해야 하나요?" }
    ];
  }

  if (result.clarificationFlow?.type === "question_builder") {
    return buildQuestionBuilderQuickReplies(result);
  }

  if (!result.policyResponse || result.answerState?.status === "unclassified" || !result.semanticFrame?.domainCode) {
    return buildQuestionBuilderStarterReplies(result.question);
  }

  const slotReplies = (result.missingSlotQuestions || []).map((item) => ({
    label: item.label,
    action: "message",
    messageText: item.question
  }));
  const defaults = [
    {
      label: "교육청 지정",
      action: "message",
      messageText: buildContextualSlotQuestion(result.question, "", `${result.officeLabel || DEFAULT_OFFICE_LABEL} 기준으로 다시 봐줘`)
    },
    {
      label: "출처 확인",
      action: "message",
      messageText: `${result.question} 공식 출처도 같이 확인해줘`
    }
  ];

  if (result.semanticFrame?.intentClarification?.needsConfirmation) {
    return uniqueQuickReplies([...slotReplies, ...defaults]).slice(0, 6);
  }

  const detailReply = result.policyResponse ? [{
    label: "자세히 보기",
    action: "message",
    messageText: buildDetailQuickReplyQuestion(result.question)
  }] : [];
  const detailFollowUpReplies = buildDetailFollowUpQuickReplies(result);

  return uniqueQuickReplies([...detailReply, ...detailFollowUpReplies, ...slotReplies, ...defaults]).slice(0, 6);
}

function buildDetailFollowUpQuickReplies(result = {}) {
  if (!isDetailCriticalResult(result)) return [];

  const replies = [];
  if (shouldOfferEvidenceQuickReply(result)) {
    replies.push({
      label: "증빙",
      action: "message",
      messageText: buildContextualSlotQuestion(result.question, result.semanticFrame?.domainLabel || "", "필요한 증빙자료와 제출 기준을 알려줘")
    });
  }

  replies.push({
    label: "서류 체크",
    action: "message",
    messageText: buildContextualSlotQuestion(result.question, result.semanticFrame?.domainLabel || "", "필요한 서류와 기록 보존 기준을 자세히 정리해줘")
  });

  if (isProcedureSensitiveResult(result)) {
    replies.push({
      label: "절차 확인",
      action: "message",
      messageText: buildContextualSlotQuestion(result.question, result.semanticFrame?.domainLabel || "", "처리 절차와 단계별 유의사항을 자세히 알려줘")
    });
  }

  return replies;
}

function shouldOfferEvidenceQuickReply(result = {}) {
  const frame = result.semanticFrame || {};
  const text = [
    result.question,
    frame.domainLabel,
    frame.slots?.serviceIssue?.label,
    result.policyResponse?.title,
    result.policyResponse?.lead,
    ...getAnswerTexts(result.policyResponse?.answer)
  ].map(cleanText).join(" ");
  return frame.domainCode === "staffAttendanceService" && /병가|증빙|진단서|근무상황|복무/.test(text);
}

function isDetailCriticalResult(result = {}) {
  const frame = result.semanticFrame || {};
  const domainCode = cleanText(frame.domainCode || result.answerState?.basis?.domainCode || "");
  if (DETAIL_CRITICAL_DOMAIN_CODES.has(domainCode)) return true;

  const slots = [
    ...(result.missingSlots || []),
    ...(frame.missingSlots || []),
    ...((result.answerState?.slotQuestions || []).map((item) => item.slot))
  ];
  if (slots.some((slot) => DETAIL_CRITICAL_SLOTS.has(slot))) return true;

  const text = [
    result.question,
    frame.domainLabel,
    result.policyResponse?.title,
    result.policyResponse?.lead,
    ...getAnswerTexts(result.policyResponse?.answer)
  ].map(cleanText).join(" ");
  return /학폭|학교폭력|전담기구|피해학생|가해학생|신고|보호조치|사안|처리|절차|증빙|서류|회의록|상담기록|기록\s*보존|공문/.test(text);
}

function isProcedureSensitiveResult(result = {}) {
  const frame = result.semanticFrame || {};
  const task = cleanText(frame.task || result.answerState?.basis?.task || "");
  const slots = [
    ...(result.missingSlots || []),
    ...(frame.missingSlots || []),
    ...((result.answerState?.slotQuestions || []).map((item) => item.slot))
  ];
  if (task === "procedure" || slots.includes("procedureStage") || slots.includes("riskSignal")) return true;

  const text = [
    result.question,
    frame.domainLabel,
    result.policyResponse?.title,
    result.policyResponse?.lead
  ].map(cleanText).join(" ");
  return /학폭|학교폭력|전담기구|신고|보고|보호조치|사안\s*처리|처리\s*절차|절차/.test(text);
}

function uniqueQuickReplies(replies = []) {
  const seenLabels = new Set();
  return replies.filter((reply) => {
    const label = cleanText(reply?.label || "");
    if (!label || seenLabels.has(label)) return false;
    seenLabels.add(label);
    return true;
  });
}

function buildQuestionBuilderResult(question = "", { requestedOfficeLabel = "", roleLabel = "" } = {}) {
  if (!isQuestionBuilderRequest(question)) return null;
  const profile = findQuestionBuilderProfile(question);
  const officeLabel = requestedOfficeLabel || DEFAULT_OFFICE_LABEL;
  if (!profile) {
    const slotQuestions = buildUnclassifiedSlotQuestions(question);
    return {
      ok: true,
      question,
      officeLabel,
      roleLabel,
      needsClarification: true,
      confidence: 0,
      semanticFrame: {
        domainCode: "",
        domainLabel: "",
        categoryCode: "",
        confidence: 0,
        task: "questionBuilder",
        missingSlots: ["domain"],
        lookupStatus: "needsSlotConfirmation",
        candidates: []
      },
      missingSlots: ["domain"],
      missingSlotQuestions: slotQuestions,
      answerState: {
        version: "20260613-answer-state-v1",
        status: "unclassified",
        confidence: 0,
        definitiveAnswers: [],
        conditionalAnswers: [],
        slotQuestions,
        caveats: [],
        primaryText: "먼저 어떤 규정 분야인지 선택해 주세요.",
        basis: { domainCode: "", domainLabel: "", task: "questionBuilder", lookupStatus: "needsSlotConfirmation", officeLabel }
      },
      clarificationFlow: {
        type: "question_builder",
        status: "choose_domain",
        profiles: QUESTION_BUILDER_PROFILES.map(({ code, label, replyLabel, requiredInfo }) => ({ code, label, replyLabel, requiredInfo }))
      },
      completionFlow: {
        needed: true,
        status: "unclassified",
        type: "choose_domain",
        question,
        officeLabel,
        domainCode: "",
        domainLabel: "",
        summary: "먼저 어떤 규정 분야인지 선택해야 합니다.",
        nextQuestions: slotQuestions.slice(0, 3),
        candidateDomains: QUESTION_BUILDER_PROFILES.slice(0, 6).map(({ code, label, requiredInfo }) => ({ code, label, summary: requiredInfo })),
        completionInstruction: "분야를 선택하면 필요한 슬롯을 모아 완성질문 예시를 제공합니다."
      },
      policyResponse: null,
      responseText: "어떤 규정 분야인지 먼저 선택해 주세요. 선택하면 필요한 정보를 모아 완성질문 예시를 보여드립니다."
    };
  }

  const slotQuestions = buildQuestionBuilderSlotQuestions(profile);
  const primaryText = `${profile.label} 답변을 완성하려면 ${profile.requiredInfo}를 한 문장에 담아 주세요.`;
  return {
    ok: true,
    question,
    officeLabel,
    roleLabel,
    needsClarification: true,
    confidence: 0.55,
    semanticFrame: {
      domainCode: profile.code,
      domainLabel: profile.label,
      categoryCode: "",
      confidence: 0.55,
      task: "questionBuilder",
      missingSlots: slotQuestions.map((item) => item.slot),
      lookupStatus: "needsSlotConfirmation",
      candidates: [{ code: profile.code, label: profile.label, confidence: 0.55, matchedKeywords: [] }]
    },
    missingSlots: slotQuestions.map((item) => item.slot),
    missingSlotQuestions: slotQuestions,
    answerState: {
      version: "20260613-answer-state-v1",
      status: "needs_slot",
      confidence: 0.55,
      definitiveAnswers: [],
      conditionalAnswers: [],
      slotQuestions,
      caveats: [],
      primaryText,
      basis: {
        domainCode: profile.code,
        domainLabel: profile.label,
        task: "questionBuilder",
        lookupStatus: "needsSlotConfirmation",
        officeLabel,
        defaultOfficeApplied: officeLabel === DEFAULT_OFFICE_LABEL
      }
    },
    clarificationFlow: {
      type: "question_builder",
      status: "collect_slots",
      profileCode: profile.code,
      profileLabel: profile.label,
      requiredInfo: profile.requiredInfo,
      examples: profile.examples
    },
    completionFlow: {
      needed: true,
      status: "needs_slot",
      type: "collect_slots",
      question,
      officeLabel,
      domainCode: profile.code,
      domainLabel: profile.label,
      summary: primaryText,
      nextQuestions: slotQuestions.slice(0, 3),
      candidateDomains: [{ code: profile.code, label: profile.label, summary: profile.requiredInfo }],
      completionInstruction: "사용자가 슬롯 정보를 보태면 원 질문과 합쳐 같은 규정 조회 엔진으로 다시 답변합니다."
    },
    policyResponse: null,
    responseText: `${primaryText}\n예: ${profile.examples[0]?.text || ""}`.trim()
  };
}

function isQuestionBuilderRequest(question = "") {
  const text = cleanText(question);
  return /질문\s*(?:만들|완성|보완|정리)|질의\s*(?:만들|완성|보완|정리)|규정\s*찾기|답변\s*전에|분야\s*선택/.test(text)
    || (/필요한\s*정보/.test(text) && /완성질문|질문\s*만들|예시|보여/.test(text));
}

function findQuestionBuilderProfile(question = "") {
  return QUESTION_BUILDER_PROFILES.find((profile) => matchesQuestionBuilderProfile(profile, question)) || null;
}

function buildQuestionBuilderSimpleText(result = {}) {
  const flow = result.clarificationFlow || {};
  if (flow.status === "choose_domain") {
    return [
      "어떤 규정 분야인지 먼저 골라 주세요.",
      "분야를 누르면 필요한 정보와 완성질문 예시를 보여드리겠습니다."
    ].join("\n");
  }
  return [
    `${flow.profileLabel || "해당 분야"} 답변을 완성하려면 다음 정보가 필요합니다.`,
    `필요 정보: ${flow.requiredInfo || "대상, 상황, 기간, 증빙, 소속 교육청"}`,
    "아래 예시를 누르거나 같은 형식으로 질문을 보내 주세요."
  ].join("\n");
}

function buildQuestionBuilderQuickReplies(result = {}) {
  const flow = result.clarificationFlow || {};
  if (flow.status === "choose_domain") return buildQuestionBuilderStarterReplies(result.question);
  const examples = (flow.examples || []).map((item) => ({
    label: item.label,
    action: "message",
    messageText: item.text
  }));
  return [
    ...examples,
    {
      label: "다른 분야",
      action: "message",
      messageText: "질문 만들기 다른 분야를 보여줘"
    }
  ].slice(0, 6);
}

function buildQuestionBuilderStarterReplies(question = "") {
  const rankedProfiles = rankQuestionBuilderProfiles(question);
  return rankedProfiles.slice(0, 6).map((profile) => ({
    label: profile.replyLabel,
    action: "message",
    messageText: `${profile.label} 질문 만들기: 필요한 정보(${profile.requiredInfo})를 확인해서 완성질문 예시를 보여줘`
  }));
}

function rankQuestionBuilderProfiles(question = "") {
  const text = cleanText(question);
  const compacted = compactKoreanTerm(question);
  const scored = QUESTION_BUILDER_PROFILES.map((profile, index) => ({
    profile,
    index,
    score: profile.aliases.reduce((sum, pattern) => sum + (pattern.test(text) || pattern.test(compacted) ? 1 : 0), 0)
  }));
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.profile);
}

function matchesQuestionBuilderProfile(profile = {}, question = "") {
  const text = cleanText(question);
  const compacted = compactKoreanTerm(question);
  const profileNames = [
    profile.label,
    profile.replyLabel,
    buildShortProfileLabel(profile.label || "")
  ].map(compactKoreanTerm).filter(Boolean);
  return profileNames.some((name) => compacted.includes(name))
    || (profile.aliases || []).some((pattern) => pattern.test(text) || pattern.test(compacted));
}

function buildQuestionBuilderSlotQuestions(profile = {}) {
  return String(profile.requiredInfo || "")
    .split(",")
    .map((label) => cleanText(label))
    .filter(Boolean)
    .map((label, index) => ({
      slot: `builder_${index + 1}`,
      label,
      question: `${profile.label} 답변을 위해 ${label} 정보를 질문에 포함해 주세요.`
    }));
}

function buildUnclassifiedSlotQuestions(question = "") {
  return rankQuestionBuilderProfiles(question).slice(0, 6).map((profile) => ({
    slot: "domain",
    label: profile.label,
    question: `${profile.label} 질문 만들기: 필요한 정보(${profile.requiredInfo})를 확인해서 완성질문 예시를 보여줘`
  }));
}

function buildKakaoCardDescription(result = {}) {
  const frame = result.semanticFrame || {};
  const stateLabel = getAnswerStateLabel(result.answerState?.status);
  const parts = [
    frame.domainLabel ? `분류: ${frame.domainLabel}` : "",
    stateLabel ? `상태: ${stateLabel}` : result.needsClarification ? "상태: 추가 확인 필요" : "상태: 답변 가능",
    result.officeLabel ? `기준: ${result.officeLabel}` : ""
  ];
  return parts.filter(Boolean).join("\n");
}

function getAnswerStateLabel(status = "") {
  const labels = {
    definitive: "확정 답변",
    conditional: "조건부 답변",
    needs_slot: "추가 확인 필요",
    unclassified: "질문 요지 확인 필요"
  };
  return labels[status] || "";
}

function buildKakaoThumbnailUrl(baseUrl = DEFAULT_DETAIL_URL, overrideUrl = "") {
  const explicit = cleanText(overrideUrl);
  if (/^https:\/\//.test(explicit)) return explicit;
  try {
    const url = new URL(baseUrl || DEFAULT_DETAIL_URL);
    url.pathname = DEFAULT_KAKAO_THUMBNAIL_PATH;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${DEFAULT_DETAIL_URL.replace(/\/$/, "")}${DEFAULT_KAKAO_THUMBNAIL_PATH}`;
  }
}

function buildDetailUrl(baseUrl, question) {
  try {
    const url = new URL(baseUrl);
    if (question) url.searchParams.set("q", question);
    return url.toString();
  } catch {
    return DEFAULT_DETAIL_URL;
  }
}

function formatMissingSlots(slots = [], semanticFrame = {}) {
  return slots.map((slot) => getSlotLabel(slot, semanticFrame)).join("·");
}

function getSlotLabel(slot, semanticFrame = {}) {
  const domainCode = semanticFrame.domainCode || semanticFrame?.basis?.domainCode || "";
  const labels = {
    office: "교육청",
    targetSubject: "대상자",
    travelerRole: domainCode === "domesticTravelExpense" ? "출장자 신분" : "대상 신분",
    role: "신분",
    employmentType: "고용 형태",
    schoolLevel: "학교급",
    schoolRule: "학교 규정",
    procedureStage: "업무 단계",
    dateRange: "기간",
    evidence: "증빙",
    riskSignal: "위험 신호",
    familyRelation: "가족관계",
    fiscalYear: "회계연도",
    serviceIssue: "복무 사유",
    committeeType: "위원회 종류",
    recordType: "기록 종류",
    requester: "요청자",
    policyDomain: "규정 분야",
    facilityArea: "시설·매체 종류",
    dataSystem: "시스템·자료 종류"
  };
  return labels[slot] || slot;
}

function getSlotQuestion(slot, semanticFrame = {}, question = "") {
  const domainLabel = semanticFrame.domainLabel || "해당 규정";
  const questions = {
    office: buildContextualSlotQuestion(question, domainLabel, `${DEFAULT_OFFICE_LABEL} 기준으로 다시 알려줘`),
    targetSubject: buildContextualSlotQuestion(question, domainLabel, "대상자별 기준을 나누어 알려줘"),
    travelerRole: buildContextualSlotQuestion(question, domainLabel, `${getSlotLabel("travelerRole", semanticFrame)}별 기준을 나누어 알려줘`),
    role: buildContextualSlotQuestion(question, domainLabel, "적용 대상 신분별 기준을 나누어 알려줘"),
    employmentType: buildContextualSlotQuestion(question, domainLabel, "고용 형태별 기준을 나누어 알려줘"),
    schoolLevel: buildContextualSlotQuestion(question, domainLabel, "학교급별로 달라지는 기준을 알려줘"),
    schoolRule: buildContextualSlotQuestion(question, domainLabel, "학교 내부 규정까지 필요한지 알려줘"),
    procedureStage: buildContextualSlotQuestion(question, domainLabel, "신청·승인·보고 단계별 처리 기준을 알려줘"),
    dateRange: buildContextualSlotQuestion(question, domainLabel, "기간에 따라 달라지는 기준을 알려줘"),
    evidence: buildContextualSlotQuestion(question, domainLabel, "필요한 증빙자료와 제출 기준을 알려줘"),
    riskSignal: buildContextualSlotQuestion(question, domainLabel, "위험 신호가 있는 경우 처리 기준을 알려줘"),
    familyRelation: buildContextualSlotQuestion(question, domainLabel, "가족관계별 적용 기준을 알려줘"),
    fiscalYear: buildContextualSlotQuestion(question, domainLabel, "해당 학년도 기준으로 필요한 확인 사항을 알려줘"),
    facilityArea: buildContextualSlotQuestion(question, domainLabel, "사진·영상·녹음·CCTV·홈페이지 등 매체 종류별 기준을 알려줘"),
    dataSystem: buildContextualSlotQuestion(question, domainLabel, "사용하는 시스템이나 자료 종류별 기준을 알려줘")
  };
  return questions[slot] || buildContextualSlotQuestion(question, domainLabel, `${getSlotLabel(slot, semanticFrame)} 기준으로 알려줘`);
}

function buildContextualSlotQuestion(question = "", domainLabel = "", instruction = "") {
  const base = cleanText(question);
  const suffix = cleanText(instruction).replace(/[.。]$/, "");
  if (base && suffix) return `${base} ${suffix}`;
  if (suffix) return `${domainLabel || "해당 규정"}에서 ${suffix}`;
  return base || `${domainLabel || "해당 규정"} 기준을 알려줘`;
}

function buildDetailQuickReplyQuestion(question = "") {
  const base = cleanText(question)
    .replace(/(?:자세히\s*보기|상세\s*보기|더\s*자세히|자세히\s*설명|상세히)\s*/g, "")
    .trim();
  const target = base || "방금 질문";
  return `${target} 신청 절차와 증빙 기준도 자세히 알려줘`;
}

function hasOfficeSignal(text = "") {
  return /교육청|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경상북도|경남|제주/.test(text);
}

function uniqueStrings(items = []) {
  return [...new Set(items.map((item) => cleanText(item)).filter(Boolean))];
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
