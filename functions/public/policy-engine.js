(function attachPolicyEngine(root, factory) {
  const engine = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  } else {
    root.GYO6_POLICY_ENGINE = engine;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createPolicyEngine(root) {
  const VERSION = "20260610-policy-engine-v3";
  const KB = loadKnowledgeBase(root);
  const TRAVEL = KB.domesticTravel || {};
  const HONORARIUM = KB.instructorHonorarium || {};
  const STAFF_ATTENDANCE = KB.staffAttendance || {};
  const ONTOLOGY = KB.schoolPolicyOntology || {};
  const CORPUS = loadPolicyCorpus(root);
  const subjectProfiles = TRAVEL.subjectProfiles || [];

  function loadKnowledgeBase(globalRoot) {
    if (globalRoot?.GYO6_POLICY_KB) return globalRoot.GYO6_POLICY_KB;
    if (typeof require === "function") {
      try {
        return require("./policy-knowledge-base.js");
      } catch (error) {
        return createEmptyKnowledgeBase(error);
      }
    }
    return createEmptyKnowledgeBase();
  }

  function loadPolicyCorpus(globalRoot) {
    if (globalRoot?.GYO6_POLICY_CORPUS) return globalRoot.GYO6_POLICY_CORPUS;
    if (typeof require === "function") {
      try {
        return require("./policy-corpus.js");
      } catch {
        return createEmptyPolicyCorpus();
      }
    }
    return createEmptyPolicyCorpus();
  }

  function createEmptyKnowledgeBase(error = null) {
    return {
      version: "missing-policy-kb",
      loadError: error ? String(error.message || error) : "",
      domesticTravel: {
        sourceKeys: [],
        lodgingCaps: {},
        subjectProfiles: [],
        metropolitanNames: []
      }
    };
  }

  function createEmptyPolicyCorpus() {
    return {
      version: "missing-policy-corpus",
      stats: { entries: 0 },
      entries: [],
      search() {
        return [];
      }
    };
  }

  function analyzePolicyQuestion(question = "") {
    const semanticFrame = buildPolicySemanticFrame(question);
    const normalized = semanticFrame.normalized;
    const domesticTravel = semanticFrame.domainCode === "domesticTravelExpense"
      ? parseDomesticTravelIntent(question, normalized, semanticFrame)
      : null;
    const inferredRoleCode = domesticTravel?.profile?.roleCode
      || semanticFrame.slots?.targetSubject?.roleCode
      || semanticFrame.slots?.travelerRole?.roleCode
      || "";
    return {
      question,
      normalized,
      semanticFrame,
      categoryCode: domesticTravel ? "leaveAttendance" : semanticFrame.categoryCode || "",
      roleCode: inferredRoleCode,
      intents: { domesticTravel }
    };
  }

  function buildPolicySemanticFrame(question = "") {
    const normalized = compactText(question);
    const explicitFocus = inferExplicitFocus(question);
    const initialScoringText = explicitFocus.normalized || normalized;
    const understandingAttempts = buildQuestionUnderstandingAttempts(question, normalized, explicitFocus);
    let scoringText = initialScoringText;
    let selectedUnderstandingAttempt = understandingAttempts.find((attempt) => attempt.normalized === scoringText)
      || understandingAttempts[0]
      || { label: "원문", text: question, normalized: scoringText };
    let domainCandidates = scorePolicyDomains(scoringText);
    const retryAttempt = selectQuestionUnderstandingAttempt(understandingAttempts, domainCandidates);
    if (shouldUseQuestionUnderstandingAttempt(domainCandidates, retryAttempt)) {
      scoringText = retryAttempt.normalized;
      selectedUnderstandingAttempt = retryAttempt;
      domainCandidates = retryAttempt.domainCandidates;
    }
    const primaryDomain = domainCandidates[0] || null;
    let domainCode = primaryDomain?.score > 0 ? primaryDomain.code : "";
    const overrideText = scoringText || normalized;
    if (isChildbirthLeaveContext(overrideText) || isGeneralStaffLeaveContext(overrideText) || isStaffOvertimeQuestion(overrideText)) {
      domainCode = "staffAttendanceService";
    }
    const beforeContextDomainCode = domainCode;
    domainCode = applyDomainContextOverrides(domainCode, scoringText, domainCandidates);
    const domain = domainCode ? getEffectivePolicyDomain(domainCode) : {};
    const slots = extractDomainSlots(domainCode, question, normalized, domain);
    const task = inferDomainTask(domain, normalized, slots);
    const requiredSlots = getEffectiveRequiredSlots(domainCode, domain, task, slots, normalized);
    const missingSlots = requiredSlots.filter((slotName) => !isSlotFilled(slots[slotName]));
    const clarificationText = explicitFocus.detected ? scoringText : normalized;
    const intentClarification = inferIntentClarification({
      normalized: clarificationText,
      domainCode,
      domainCandidates,
      slots,
      missingSlots,
      explicitFocus
    });
    const selectedDomain = domainCandidates.find((candidate) => candidate.code === domainCode);
    const semanticBridgeConfidence = domainCode && domainCode !== primaryDomain?.code && domainCode !== beforeContextDomainCode ? 0.55 : 0;
    const confidence = Math.max(primaryDomain?.confidence || 0, selectedDomain?.confidence || 0, semanticBridgeConfidence);
    const lookupPlan = buildLookupPlan(domainCode, domain, task, slots, missingSlots, requiredSlots);
    if (intentClarification.needsConfirmation) {
      lookupPlan.status = "needsIntentConfirmation";
      lookupPlan.intentClarification = intentClarification;
    }

    return {
      question,
      normalized,
      domainCode,
      domainLabel: domain.label || "",
      categoryCode: domain.categoryCode || "",
      confidence,
      domainCandidates,
      explicitFocus,
      understandingAttempts: summarizeQuestionUnderstandingAttempts(understandingAttempts, selectedUnderstandingAttempt),
      task,
      slots,
      requiredSlots,
      missingSlots,
      intentClarification,
      lookupPlan
    };
  }

  function scorePolicyDomains(normalized = "") {
    const audienceCodes = inferAudienceCodes(normalized);
    return Object.entries(KB.domains || {})
      .map(([code, domain]) => {
        const matchedKeywords = (domain.intentKeywords || []).filter((keyword) => normalized.includes(compactText(keyword)));
        const dataIndex = getDomainDataIndexProfile(code, domain);
        const matchedIndexTerms = getMatchedDomainIndexTerms(normalized, dataIndex);
        const keywordScore = matchedKeywords.reduce((sum, keyword) => sum + Math.max(2, compactText(keyword).length), 0);
        const indexScore = matchedIndexTerms.reduce((sum, term) => sum + Math.max(1, Math.min(6, Math.ceil(compactText(term).length / 2))), 0);
        const audienceScore = audienceCodes.length && dataIndex?.audiences?.some((audience) => audienceCodes.includes(audience))
          && (keywordScore > 0 || indexScore > 0)
          ? 3
          : 0;
        const score = keywordScore + indexScore + audienceScore;
        return {
          code,
          label: domain.label || code,
          categoryCode: domain.categoryCode || "",
          matchedKeywords,
          matchedIndexTerms,
          audienceCodes,
          score,
          confidence: Math.min(1, score / 16)
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  function inferExplicitFocus(question = "") {
    const text = String(question || "").replace(/\s+/g, " ").trim();
    const patterns = [
      /핵심만\s*보면,?\s*(?:[^,]{0,40}?\s*입장에서는\s*)?(.+?)(?:이|가)\s*핵심/,
      /핵심만\s*보면,?\s*(.+?)(?:관련\s*(?:가능\s*여부|최대\s*한도|처리\s*절차|필요\s*서류|공식\s*근거|소속\s*교육청\s*기준|학교\s*내부\s*규정\s*우선순위|당사자별\s*할\s*일|민원\s*답변\s*문장|위험\s*신호와\s*전문가\s*전환\s*기준)|(?:의|에\s*대한)\s*(?:가능\s*여부|최대\s*한도|처리\s*절차|필요\s*서류|공식\s*근거|소속\s*교육청\s*기준|학교\s*내부\s*규정\s*우선순위|당사자별\s*할\s*일|민원\s*답변\s*문장|위험\s*신호와\s*전문가\s*전환\s*기준)|입니다|이에요|예요|\.|,)/,
      /핵심만\s*보면,?\s*(.{4,90}?(?:\?|？|요|까|가요|나요|하나요|인가요|일까요))/,
      /핵심(?:은|는)\s*(.+?)(?:입니다|이에요|예요|임\.|임,|이고|이며|인데|입니다\.|입니다,)/,
      /실제\s*문의(?:는|가)\s*(.+?)(?:입니다|이에요|예요|임\.|임,|이고|이며|인데|입니다\.|입니다,)/,
      /실제\s*문의(?:는|가)\s*(.{4,90}?(?:\?|？|요|까|가요|나요|하나요|인가요|일까요))/,
      /(?:질문|문의)\s*:\s*(.+?)(?:\.|입니다|이에요|예요|$)/,
      /["“](.+?)["”]\s*라고만\s*물/,
      /(?:입장에서는|입장에선)\s*(.+?)(?:이|가)\s*핵심/,
      /(.{4,90}?)(?:이|가)\s*핵심(?:입니다|이에요|예요|임\.|임,|이고|이며|인데|입니다\.|입니다,)/,
      /(.{4,90}?)\s*중심으로\s*(?:알려|확인|분류|봐|답변)/,
      /(.{4,90}?)(?:의|에\s*대한|관련)\s*(?:가능\s*여부|최대\s*한도|처리\s*절차|필요\s*서류|공식\s*근거|소속\s*교육청\s*기준|학교\s*내부\s*규정\s*우선순위|당사자별\s*할\s*일|민원\s*답변\s*문장|위험\s*신호와\s*전문가\s*전환\s*기준)(?:를|을)?\s*(?:묻는|관련|입니다|궁금)/,
      /(.{4,90}?)\s*질문에\s*.+?(?:섞|보이|붙|오해)/,
      /(.{4,90}?)\s*관련\s*(?:가능\s*여부|최대\s*한도|처리\s*절차|필요\s*서류|공식\s*근거|소속\s*교육청\s*기준|학교\s*내부\s*규정\s*우선순위|당사자별\s*할\s*일|민원\s*답변\s*문장|위험\s*신호와\s*전문가\s*전환\s*기준)(?:입니다|이에요|예요|임\.|임,|이고|이며|인데|입니다\.|입니다,)/
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const value = compactText(match?.[1] || "");
      if (value && value.length >= 4 && value.length <= 90) {
        return { text: match[1].trim(), normalized: value, detected: true };
      }
    }
    return { text: "", normalized: "", detected: false };
  }

  function buildQuestionUnderstandingAttempts(question = "", normalized = compactText(question), explicitFocus = null) {
    const rawText = String(question || "").replace(/\s+/g, " ").trim();
    const attempts = [];
    const seen = new Set();
    const addAttempt = (label, value) => {
      const raw = String(value || "").replace(/\s+/g, " ").trim();
      const compact = compactText(raw);
      if (!compact || compact.length < 4 || seen.has(compact)) return;
      seen.add(compact);
      attempts.push({ label, text: raw || compact, normalized: compact });
    };

    addAttempt("원문", normalized || rawText);
    if (explicitFocus?.detected) {
      addAttempt("명시된 핵심", explicitFocus.text || explicitFocus.normalized);
    }

    const focusPatterns = [
      /(?:다시\s*말(?:해|하면)|즉|결론적으로|정리하면)\s*([^.!?\n。！？]{4,120})/,
      /(?:핵심|질문|문의|궁금한\s*것|궁금한\s*점|정확히\s*묻는\s*것)(?:은|는|이|가|요)?\s*([^.!?\n。！？]{4,120})/,
      /(?:제가\s*)?(?:묻고\s*싶은\s*것|알고\s*싶은\s*것)(?:은|는|이|가)?\s*([^.!?\n。！？]{4,120})/
    ];
    for (const pattern of focusPatterns) {
      const match = rawText.match(pattern);
      addAttempt("질문 재정리", match?.[1] || "");
    }

    rawText
      .split(/[.!?\n。！？]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 6 && sentence.length <= 140)
      .filter((sentence) => hasPolicyUnderstandingSignal(sentence))
      .slice(0, 5)
      .forEach((sentence) => addAttempt("정책 단서 문장", sentence));

    const keywordPattern = /연가|연차|병가|공가|특별휴가|출산휴가|출장|출장비|여비|숙박비|학폭|학교폭력|교외체험학습|현장체험학습|가정체험학습|나이스|neis|회의록|개인정보|cctv|현장실습|도제|임금체불|근로계약|고소|고발|민사|형사|소송|학교회계|예산|학생부|생활기록부|방과후|강사비|강사료|급식|기숙사|교권|학칙|운영위원회|수익자부담|감염병|상담기록/gi;
    for (const match of rawText.matchAll(keywordPattern)) {
      const index = match.index || 0;
      const start = Math.max(0, index - 45);
      const end = Math.min(rawText.length, index + 90);
      addAttempt("핵심어 주변", rawText.slice(start, end));
      if (attempts.length >= 9) break;
    }

    return attempts.slice(0, 9);
  }

  function hasPolicyUnderstandingSignal(text = "") {
    const normalized = compactText(text);
    return /연가|연차|병가|공가|휴가|출장|출장비|여비|학폭|학교폭력|체험학습|현장실습|나이스|neis|회의록|개인정보|cctv|근로계약|임금|고소|소송|학교회계|예산|학생부|생활기록부|방과후|강사비|급식|기숙사|교권|학칙|운영위원회|감염병|상담기록|규정|지침|절차|증빙|서류/.test(normalized);
  }

  function selectQuestionUnderstandingAttempt(attempts = [], baseCandidates = []) {
    if (!attempts.length) return null;
    let best = null;
    for (const attempt of attempts) {
      const candidates = scorePolicyDomains(attempt.normalized);
      const primaryDomain = candidates[0] || null;
      let domainCode = primaryDomain?.score > 0 ? primaryDomain.code : "";
      if (isChildbirthLeaveContext(attempt.normalized) || isGeneralStaffLeaveContext(attempt.normalized)) {
        domainCode = "staffAttendanceService";
      }
      domainCode = applyDomainContextOverrides(domainCode, attempt.normalized, candidates);
      const selected = candidates.find((candidate) => candidate.code === domainCode) || primaryDomain || {};
      const score = Math.max(selected.score || 0, primaryDomain?.score || 0);
      const confidence = Math.max(selected.confidence || 0, primaryDomain?.confidence || 0, domainCode && domainCode !== primaryDomain?.code ? 0.55 : 0);
      const enriched = {
        ...attempt,
        domainCode,
        domainCandidates: candidates,
        score,
        confidence,
        priorityScore: score + getUnderstandingAttemptPriority(attempt)
      };
      if (!best || enriched.priorityScore > best.priorityScore || (enriched.priorityScore === best.priorityScore && enriched.confidence > best.confidence)) {
        best = enriched;
      }
    }
    return best;
  }

  function getUnderstandingAttemptPriority(attempt = {}) {
    const normalized = attempt.normalized || "";
    if (attempt.label === "명시된 핵심") return 50;
    if (attempt.label === "질문 재정리" && /핵심|실제문의|묻고싶은것|알고싶은것|다시말하면|정리하면/.test(normalized)) return 6;
    if (attempt.label === "정책 단서 문장" && /핵심|실제문의|중심/.test(normalized)) return 4;
    return 0;
  }

  function shouldUseQuestionUnderstandingAttempt(baseCandidates = [], attempt = null) {
    if (!attempt?.domainCode) return false;
    const basePrimary = baseCandidates[0] || {};
    const baseScore = basePrimary.score || 0;
    const baseConfidence = basePrimary.confidence || 0;
    if (baseScore <= 0) return true;
    if (attempt.domainCode === basePrimary.code && attempt.score >= baseScore) return false;
    if (attempt.label === "명시된 핵심" && attempt.score > 0 && attempt.confidence >= 0.35) return true;
    if (attempt.priorityScore >= baseScore + 2 && attempt.score > 0 && attempt.confidence >= 0.35) return true;
    if (baseConfidence < 0.35 && attempt.score >= baseScore) return true;
    if (attempt.score >= baseScore + 4) return true;
    return attempt.score >= baseScore + 2 && attempt.confidence >= 0.55;
  }

  function summarizeQuestionUnderstandingAttempts(attempts = [], selected = null) {
    return attempts.slice(0, 5).map((attempt) => ({
      label: attempt.label,
      text: attempt.text,
      normalized: attempt.normalized,
      selected: Boolean(selected && attempt.normalized === selected.normalized)
    }));
  }

  function applyDomainContextOverrides(domainCode = "", normalized = "", domainCandidates = []) {
    return getSemanticBridgeDomain(normalized, domainCandidates) || domainCode;
  }

  function getSemanticBridgeDomain(normalized = "", domainCandidates = []) {
    const hasCandidate = (code) => domainCandidates.some((candidate) => candidate.code === code && candidate.score > 0);
    const rules = [
      {
        domainCode: "schoolViolenceProcedure",
        matches: () => /학교폭력|학폭|전담기구/.test(normalized)
          || (/학생|친구|동급생|선배|후배|피해학생|가해학생/.test(normalized)
            && /돈|금품|요구|갈취|빼앗|협박|폭행|괴롭힘|따돌림|보복|신고|피해|가해/.test(normalized)
            && /처리|해당|사안|절차|신고|어떻게|해야|가능|규정/.test(normalized))
      },
      {
        domainCode: "governanceCommitteeRule",
        matches: () => /학교운영위원회|운영위원회|학운위|학칙개정|규정개정|제척|회피/.test(normalized)
          && !/학교폭력|학폭|전담기구/.test(normalized)
      },
      {
        domainCode: "schoolMealOperation",
        matches: () => isMealOperationContext(normalized)
          && !/학교운영위원회|운영위원회/.test(normalized)
      },
      {
        domainCode: "careerEmploymentGuidance",
        matches: () => /현장실습|실습생|표준협약|선도기업/.test(normalized)
          && /채용|공고|잡알리오|추천채용|고졸채용/.test(normalized)
      },
      {
        domainCode: "admissionsTransferGraduation",
        matches: () => /재직자전형|특별전형|특성화고특별전형|선취업후진학|동일계전형|입학전형/.test(normalized)
          && /지원|자격|증빙|모집요강|전형|입학|대학|졸업|재직/.test(normalized)
      },
      {
        domainCode: "staffAttendanceService",
        matches: () => isStaffOvertimeQuestion(normalized)
      },
      {
        domainCode: "domesticTravelExpense",
        matches: () => isDomesticTravelQuestion(normalized)
      },
      {
        domainCode: "careerEmploymentGuidance",
        matches: () => isCareerEmploymentLaborContext(normalized)
      },
      {
        domainCode: "vocationalFieldTrainingOperation",
        matches: () => /현장실습|도제학교|일학습병행|표준협약|선도기업|참여기업|실습기업|실습생/.test(normalized)
          && /사고|다쳤|부상|위험|기계|안전|보고|기업|학교|중단|복교|보호|처리|절차/.test(normalized)
          && (hasCandidate("vocationalFieldTrainingOperation") || /현장실습|실습생|실습기업|참여기업|선도기업/.test(normalized))
      },
      {
        domainCode: "parentComplaintResponse",
        matches: () => /학부모|민원인|보호자/.test(normalized)
          && /민원|답변|답변서|공개|비공개|정보공개|개인정보|자료요구|상담기록|면담|항의/.test(normalized)
          && !/교권|교육활동보호|침해|폭언|욕설|협박/.test(normalized)
          && !isMealOperationContext(normalized)
          && !isStaffTargetedMediaAbuseContext(normalized)
          && !isCounselingRecordDisclosureContext(normalized)
      },
      {
        domainCode: "teacherRightsProtection",
        matches: () => isTeacherLegalDisputeContext(normalized) || isStaffTargetedMediaAbuseContext(normalized)
      },
      {
        domainCode: "healthInfectionCounseling",
        matches: () => isCounselingRecordDisclosureContext(normalized)
      },
      {
        domainCode: "labEquipmentPracticeSafety",
        matches: () => /실습실|실험실습실|실험실|실습장|위험기계|기자재|실습재료|보호구|msds|화학물질/i.test(normalized)
          && /안전|사고|보고|점검|교육|기계|장비|보호구|관리|기록|다쳤|부상|위험/i.test(normalized)
      },
      {
        domainCode: "schoolSafetyHealth",
        matches: () => isSchoolSafetyAccidentContext(normalized)
      },
      {
        domainCode: "facilityDigitalSecurity",
        matches: () => isPersonalInfoMediaDisclosureContext(normalized)
      },
      {
        domainCode: "facilityDigitalSecurity",
        matches: () => /나이스|neis|cctv|영상정보|개인정보|계정|권한|비밀번호|정보보안/i.test(normalized)
          && /계정|권한|접근|비밀번호|정보보안|영상정보|개인정보|유출|제공|열람|공개|보관/.test(normalized)
          && !(/학부모|민원인|보호자/.test(normalized) && /민원|답변|답변서|상담기록|자료요구|정보공개|공개범위/.test(normalized))
      },
      {
        domainCode: "facilityDigitalSecurity",
        matches: () => /자료|기록|문서|정보|개인정보/.test(normalized)
          && /공개|열람|제공|공유|보내|넘겨|줘도|요구|외부기관|외부에|외부로/.test(normalized)
          && !/학생부|생활기록부|생기부|출결|학교폭력|학폭|급식|보존식/.test(normalized)
      },
      {
        domainCode: "staffAttendanceService",
        matches: () => /나이스|neis/i.test(normalized)
          && /근무상황|연가|병가|조퇴|지각|외출|복무|상신/.test(normalized)
      },
      {
        domainCode: "bereavementLeave",
        matches: () => hasDeathLeaveSignal(normalized)
          && /휴가|경조사|특별휴가|일수|며칠|몇일|사용|가능|증빙|신청/.test(normalized)
      },
      {
        domainCode: "staffAttendanceService",
        matches: () => isChildbirthLeaveContext(normalized) || isGeneralStaffLeaveContext(normalized)
      },
      {
        domainCode: "afterSchoolChildcare",
        matches: () => isAfterSchoolChildcareContext(normalized)
      },
      {
        domainCode: "schoolBudgetExecution",
        matches: () => isSchoolBudgetExecutionContext(normalized)
      },
      {
        domainCode: "fieldExperienceLearning",
        matches: () => /교외체험학습|현장체험학습|체험학습/.test(normalized)
          && /신청|보고서|출결|결석|승인|절차|서류|규정/.test(normalized)
      },
      {
        domainCode: "classManagementGuidance",
        matches: () => isStudentGuidanceDisciplineContext(normalized)
      },
      {
        domainCode: "assessmentAcademicManagement",
        matches: () => /성적|평가|수행평가|시험|학업성적관리|답안지|채점|부정행위/.test(normalized)
          && /이의신청|정정|심의|위원회|처리|절차|규정|증빙|보존|기준/.test(normalized)
      },
      {
        domainCode: "teacherRightsProtection",
        matches: () => /교권|교육활동보호|교원보호|악성민원|교사에게|교원에게|선생님에게/.test(normalized)
          && /침해|폭언|욕설|협박|민원|신고|보호|조치|처리|절차/.test(normalized)
      }
    ];
    return rules.find((rule) => rule.matches())?.domainCode || "";
  }

  function isMealOperationContext(normalized = "") {
    return /급식|학교급식|급식반찬|반찬|식단|보존식|검식|식중독|알레르기|영양교사|조리실|급식소|급식실/.test(normalized)
      && /민원|면담|항의|위생|식중독|알레르기|보존식|검식|식단|반찬|공개|비공개|보고|처리|절차|기준|자료|요구|상담|학부모|학생/.test(normalized);
  }

  function isDomesticTravelQuestion(normalized = "") {
    if (isStaffOvertimeQuestion(normalized) && !/출장비|여비|일비|식비|숙박비|운임|교통비|정산/.test(normalized)) return false;
    const hasTravelAnchor = /출장|관외출장|관내출장|국내출장|출장비|여비|국내여비|숙박비|숙박|숙소|호텔|일비|식비|식대|운임|교통비/.test(normalized);
    const hasTravelTask = /얼마|한도|인정|계산|지급|정산|가능|기준|규정|몇일|며칠|1박|박당|출장명령|증빙|관외|관내|근무지/.test(normalized);
    return hasTravelAnchor && hasTravelTask
      && !/현장실습|실습기업|선도기업|표준협약|체험학습/.test(normalized);
  }

  function isStaffOvertimeQuestion(normalized = "") {
    const hasOvertimeSignal = /초과근무|시간외근무|시간외|야근|휴일근무|휴일근로/.test(normalized);
    const hasServiceTask = /신청|상신|승인|가능|인정|처리|수당|근무상황|나이스|근무명령|초과근무명령/.test(normalized);
    return hasOvertimeSignal && hasServiceTask;
  }

  function isSchoolSafetyAccidentContext(normalized = "") {
    const hasAccident = /안전공제|학교안전공제|안전사고|사고보고|다쳤|다쳐|부상|골절|상처|응급|119|치료비/.test(normalized);
    const hasSchoolContext = /학생|체육|수업|실습|학교|보건실|보호자|교사|담임|안전공제|사고보고/.test(normalized);
    return hasAccident && hasSchoolContext
      && !/현장실습|실습기업|선도기업|표준협약|산업체|사업장/.test(normalized);
  }

  function isAfterSchoolChildcareContext(normalized = "") {
    return /방과후|방과후학교|돌봄|늘봄|자유수강권/.test(normalized)
      && /프로그램|수강료|환불|강사선정|선정|위탁|계약|안전|학생|운영|신청|자료|기준|공고|정산|자유수강권/.test(normalized);
  }

  function isCareerEmploymentLaborContext(normalized = "") {
    if (/재직자전형|특별전형|특성화고특별전형|선취업후진학|동일계전형|입학전형/.test(normalized)) return false;
    const hasLaborAnchor = /졸업생|취업|채용|고졸채용|잡알리오|채용공고|추천채용|공채|근로계약|임금체불|체불임금|수습|해고|권고사직|부당해고|노동상담|노무상담|노동청|고용노동부|근로기준|근로조건/.test(normalized);
    const hasLaborTask = /상담|처리|절차|신고|권리구제|기준|규정|증빙|서류|계약|체불|임금|해고|채용|공고|추천|취업|확인/.test(normalized);
    const hasStudentCounselingRecord = /학생상담|상담기록|상담일지|Wee|wee|위기학생|정서행동|자해|자살|보호자상담/.test(normalized);
    return hasLaborAnchor && hasLaborTask && !hasStudentCounselingRecord;
  }

  function isSchoolBudgetExecutionContext(normalized = "") {
    if (/출장|여비|일비|식비|숙박비|운임/.test(normalized)) return false;
    if (/근로계약|임금체불|수습|해고|권고사직|졸업생/.test(normalized)) return false;
    if (/장학금|교육급여|교육비지원|통학비|기숙사비|교복|교과서|감면/.test(normalized)) return false;
    if (/현장실습|실습기업|실습생|표준협약|선도기업|참여기업/.test(normalized)) return false;
    if (/학교안전|안전사고|안전공제|응급|119|치료비/.test(normalized)) return false;
    if (/성적|평가|수행평가|시험|학업성적관리|답안지|채점/.test(normalized)) return false;
    if (/강사수당|강사료|강사비|강의비|강의료|외부강사|시간당/.test(normalized)) return false;

    const hasBudgetAnchor = /학교회계|회계|예산|예산편성|품의|검수|지출|정산|업무추진비|카드전표|세금계산서|물품구입|물품|행정실|수익자부담경비/.test(normalized);
    const hasBudgetAction = /구입|계약|품의|검수|지출|정산|영수증|카드전표|세금계산서|증빙|서류|환불/.test(normalized);
    return hasBudgetAnchor && hasBudgetAction;
  }

  function isStaffTargetedMediaAbuseContext(normalized = "") {
    const explicitStudentMedia = /학생사진|학생.*사진|학생.*영상|졸업앨범|행사사진|단체사진|홈페이지게시|홈페이지에/.test(normalized);
    const explicitStaffTarget = /(?:교사|교원|선생님|담임|교직원)(?:의)?(?:얼굴|목소리|통화녹음)|(?:교사|교원|선생님|담임|교직원).{0,12}(?:몰래|무단|허락없이|동의없이).{0,12}(?:촬영|찍|녹음|녹화)|통화녹음/.test(normalized);
    if (explicitStudentMedia && !explicitStaffTarget) {
      return false;
    }
    return /교사|교원|선생님|담임|교직원|직원/.test(normalized)
      && /학생|학부모|보호자|민원|수업|학교/.test(normalized)
      && /사진|얼굴|영상|동영상|촬영|찍|녹음|녹화|통화녹음|목소리|sns|SNS|온라인|게시|공개|유포|공유/.test(normalized)
      && /몰래|무단|허락|동의|협박|위협|공개하겠|유포|게시|올렸|올림|촬영|녹음|녹화/.test(normalized);
  }

  function isTeacherLegalDisputeContext(normalized = "") {
    return /교사|교원|선생님|담임|교직원|직원|학교/.test(normalized)
      && /학부모|보호자|민원인|학생|가정/.test(normalized)
      && /고소|고발|소송|민사|형사|손해배상|명예훼손|모욕|협박|폭언|아동학대신고|문자|카카오톡캡처|카톡캡처|캡처|녹취|증거/.test(normalized)
      && /가능|해야|고민|대응|처리|절차|조치|위험|증빙|자료|보존|상담|신고/.test(normalized);
  }

  function isStudentGuidanceDisciplineContext(normalized = "") {
    const hasClassroomSubject = /교사|교원|선생님|담임|수업|교실|학급|학생/.test(normalized);
    const hasDisciplineSignal = /지시|따르지|불응|수업방해|수업태도|생활지도|훈육|반복|소란|방해|선도|학생생활규정|학칙/.test(normalized);
    const asksAction = /조치|처리|대응|지도|가능|내릴수|해야|절차|규정|기준|어떻게/.test(normalized);
    return hasClassroomSubject && hasDisciplineSignal && asksAction
      && !/학교폭력|학폭|폭행|갈취|따돌림|보복|성폭력/.test(normalized);
  }

  function isCounselingRecordDisclosureContext(normalized = "") {
    if (isCareerEmploymentLaborContext(normalized)) {
      return false;
    }
    if (/교권|교육활동보호|교육활동침해|교원보호|교사보호|교직원보호|아동학대신고|악성민원/.test(normalized)) {
      return false;
    }
    if (/생활지도|학급관리|수업방해|휴대전화|학생생활지도/.test(normalized)) {
      return false;
    }
    return /상담기록|학생상담|상담일지|Wee|wee|위기학생|정서행동/.test(normalized)
      && /공개|비공개|열람|제공|공유|보여|보내|요구|학부모|보호자|다른교사|다른선생님|담임/.test(normalized);
  }

  function isPersonalInfoMediaDisclosureContext(normalized = "") {
    return /학생|학부모|보호자|교사|교원|선생님|학교|학급|수업|행사|졸업앨범|가정통신문/.test(normalized)
      && /사진|단체사진|얼굴|초상권|졸업앨범|영상|동영상|녹음|녹화|통화녹음|목소리|sns|SNS|홈페이지|가정통신문|게시물|업로드/.test(normalized)
      && /올려|올림|게시|공개|비공개|사용|써도|보내|제공|공유|유포|동의서|동의|허락|촬영|녹음|녹화|보존|삭제/.test(normalized);
  }

  function inferIntentClarification({ normalized = "", domainCode = "", domainCandidates = [], slots = {}, missingSlots = [], explicitFocus = null } = {}) {
    if (hasGenericCommitteeAmbiguity(normalized)) {
      return buildIntentClarification({
        type: "committeeType",
        slot: "committeeType",
        label: "위원회 종류",
        summary: "위원회·회의록 질문은 어떤 위원회인지에 따라 공개, 보존, 심의 절차와 근거가 달라집니다.",
        question: "학교운영위원회, 학교폭력 전담기구, 학업성적관리위원회 등 어떤 위원회의 회의록·심의 기준인지 알려주세요.",
        placeholder: "예: 학교운영위원회 회의록 공개 / 학폭 전담기구 회의록 보존 / 학업성적관리위원회 심의",
        candidates: [
          ["governanceCommitteeRule", "학교운영위원회·규정개정", "학교운영위원회, 학칙·규정개정, 일반 위원회 회의록"],
          ["schoolViolenceProcedure", "학교폭력 전담기구·심의", "학교폭력 사안 접수, 전담기구 판단, 심의 요청 기록"],
          ["assessmentAcademicManagement", "학업성적관리위원회", "평가·성적 이의신청, 성적 정정, 학업성적관리 규정"],
          ["classManagementGuidance", "학생생활지도·선도", "생활교육위원회, 선도 조치, 학생지도 기록"],
          ["schoolMealOperation", "급식·보건·안전 관련 위원회", "급식소위원회, 보건·안전 관련 회의와 민원 기록"]
        ]
      });
    }

    if (hasGenericRecordDisclosureAmbiguity(normalized)) {
      return buildIntentClarification({
        type: "recordDisclosure",
        slot: "recordType",
        label: "기록 종류",
        summary: "기록·자료 공개 질문은 학생부, 상담기록, CCTV, 학폭자료, 회의록 중 무엇인지와 요청자가 누구인지부터 확인해야 합니다.",
        question: "공개·제공하려는 기록 종류와 요청자가 누구인지 알려주세요.",
        placeholder: "예: 학부모가 학생부 열람 요청 / 보호자가 상담기록 요구 / 외부기관이 CCTV 영상 요청",
        candidates: [
          ["studentRecordsAttendance", "학생부·출결 기록", "학교생활기록부, 출결, 정정자료 열람·제공 기준"],
          ["parentComplaintResponse", "학부모 민원·상담기록", "학부모 자료요구, 면담·상담기록, 답변서 공개 범위"],
          ["facilityDigitalSecurity", "개인정보·CCTV·정보보안", "CCTV 영상, 개인정보, 시스템 자료 제공·열람 기준"],
          ["schoolViolenceProcedure", "학교폭력 사안자료", "학교폭력 신고, 사안조사, 전담기구 기록 공개·보존"],
          ["governanceCommitteeRule", "위원회 회의록", "학교운영위원회 등 회의록 공개·비공개·보존 기준"]
        ]
      });
    }

    if (isChildbirthLeaveContext(normalized) || isSpouseChildbirthLeaveContext(normalized)) {
      return { needsConfirmation: false };
    }

    if (
      isStaffTargetedMediaAbuseContext(normalized)
      || isPersonalInfoMediaDisclosureContext(normalized)
      || isCounselingRecordDisclosureContext(normalized)
    ) {
      return { needsConfirmation: false };
    }

    const primaryDomain = domainCandidates.find((candidate) => candidate.score > 0);
    if (domainCode && primaryDomain?.code && domainCode !== primaryDomain.code) {
      return { needsConfirmation: false };
    }

    const closeCandidates = getCloseDomainAmbiguityCandidates(domainCode, domainCandidates, missingSlots);
    if (closeCandidates.length >= 2) {
      if (shouldTrustExplicitFocusDomain(explicitFocus, closeCandidates)) {
        return { needsConfirmation: false };
      }
      return buildIntentClarification({
        type: "closeDomain",
        slot: "policyDomain",
        label: "규정 분야",
        summary: "질문 안의 단서가 여러 규정 분야에 비슷하게 걸립니다.",
        question: "아래 후보 중 실제로 확인하려는 규정 분야를 골라 주세요.",
        placeholder: closeCandidates.map((candidate) => candidate.label).join(" / "),
        candidates: closeCandidates.map((candidate) => [candidate.code, candidate.label, candidate.summary || candidate.label, candidate.confidence])
      });
    }

    return { needsConfirmation: false };
  }

  function shouldTrustExplicitFocusDomain(explicitFocus = null, closeCandidates = []) {
    if (!explicitFocus?.detected || !closeCandidates.length) return false;
    const focusText = explicitFocus.normalized || compactText(explicitFocus.text || "");
    const primary = closeCandidates[0];
    const secondary = closeCandidates[1];
    if (!focusText || !primary || !secondary) return false;
    const primaryAnchor = (primary.matchedKeywords || []).some((keyword) => {
      const compactKeyword = compactText(keyword);
      return compactKeyword.length >= 4 && focusText.includes(compactKeyword);
    });
    if (!primaryAnchor) return false;
    const secondaryAnchor = (secondary.matchedKeywords || []).some((keyword) => {
      const compactKeyword = compactText(keyword);
      return compactKeyword.length >= 4 && focusText.includes(compactKeyword);
    });
    const scoreGap = Number(primary.score || 0) - Number(secondary.score || 0);
    return scoreGap >= 1 || !secondaryAnchor;
  }

  function hasGenericCommitteeAmbiguity(normalized = "") {
    const hasCommitteeSignal = /위원회|회의록|심의|자문|의결/.test(normalized);
    const hasSpecificCommittee = /학교운영위원회|운영위원회|학교폭력|학폭|전담기구|학업성적관리|성적관리|급식소위원회|교권보호|교육활동보호|학생선도|생활교육위원회|인사위원회|개별화교육|IEP|학부모회|학생자치/i.test(normalized);
    const asksRecordOrProcedure = /공개|비공개|열람|보존|회의록|심의|자문|의결|절차|기준|규정|가능/.test(normalized);
    return hasCommitteeSignal && asksRecordOrProcedure && !hasSpecificCommittee;
  }

  function hasGenericRecordDisclosureAmbiguity(normalized = "") {
    const hasRecordSignal = /기록|자료|서류|문서|정보|개인정보/.test(normalized);
    const hasDisclosureSignal = /공개|비공개|열람|제공|공유|보내|넘겨|줘도|요구|보존|외부기관|외부에|외부로/.test(normalized);
    const hasSpecificRecord = /학생부|생활기록부|생기부|출결|cctv|CCTV|영상정보|상담기록|민원답변|학교폭력|학폭|전담기구|회의록|보존식|검식|급식|진단서|감염병|개별화교육|IEP/i.test(normalized);
    if (/증빙자료|필요한증빙|필요한서류|필요한자료/.test(normalized) && !hasDisclosureSignal) return false;
    if (isCareerEmploymentLaborContext(normalized)) return false;
    if (/강사료|강사수당|강사비|출장비|병가|연가|경조사|학교회계|현장실습|성적|장학금|교육급여/.test(normalized)) return false;
    return hasRecordSignal && hasDisclosureSignal && !hasSpecificRecord;
  }

  function getCloseDomainAmbiguityCandidates(domainCode = "", domainCandidates = [], missingSlots = []) {
    const scored = domainCandidates.filter((candidate) => candidate.score > 0).slice(0, 5);
    const primary = scored[0] || null;
    if (!primary || primary.score >= 12 || missingSlots.length === 0) return [];
    const close = scored.filter((candidate) => primary.score - candidate.score < 2 && candidate.score >= 3);
    if (close.length < 2) return [];
    if (domainCode && close.some((candidate) => candidate.code === domainCode)) return close;
    return close.slice(0, 3);
  }

  function buildIntentClarification({ type = "policyDomain", slot = "policyDomain", label = "규정 분야", summary = "", question = "", placeholder = "", candidates = [] } = {}) {
    return {
      needsConfirmation: true,
      type,
      slot,
      label,
      summary,
      question,
      placeholder,
      candidates: candidates.map(([code, candidateLabel, candidateSummary, confidence]) => ({
        code,
        label: candidateLabel || getEffectivePolicyDomain(code).label || code,
        summary: candidateSummary || getEffectivePolicyDomain(code).label || candidateLabel || code,
        confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : 0.62
      }))
    };
  }

  function isChildbirthLeaveContext(normalized = "") {
    if (hasDeathLeaveSignal(normalized)) return false;
    return getLeaveEventContext(normalized).isChildbirthLeave;
  }

  function isSpouseChildbirthLeaveContext(normalized = "") {
    if (hasDeathLeaveSignal(normalized)) return false;
    const subject = getSubjectContext(normalized);
    const leaveEvent = getLeaveEventContext(normalized);
    return leaveEvent.isChildbirthLeave && (leaveEvent.relation === "spouse" || (subject.isStaff && subject.gender === "male"));
  }

  function getSubjectContext(normalized = "") {
    const isStaff = /교사|교원|선생님|교직원|직원|교장|교감|학교장|공무원|행정직|주무관|교육공무직|공무직|기간제|계약제|정규직/.test(normalized);
    const maleSubject = /남(?:교사|교원|선생님|직원|공무원|교직원)|남자|남성|남편|아빠|아버지|부친/.test(normalized);
    const femaleSubject = /여(?:교사|교원|선생님|직원|공무원|교직원)|여자|여성|아내|임신|산전|산후|모성/.test(normalized);
    return {
      isStaff,
      gender: maleSubject && !femaleSubject ? "male" : femaleSubject && !maleSubject ? "female" : "",
      relation: /배우자|남편|아내/.test(normalized) ? "spouse" : ""
    };
  }

  function getLeaveEventContext(normalized = "") {
    const hasLeaveSignal = /휴가|특별휴가|출산휴가|복무|근태/.test(normalized);
    const hasChildbirthSignal = /출산|분만|배우자출산|아내출산|남편출산/.test(normalized);
    const relation = /배우자출산|(?:배우자|남편|아내).{0,16}출산|출산.{0,16}(?:배우자|남편|아내)/.test(normalized)
      ? "spouse"
      : "";
    return {
      isChildbirthLeave: hasLeaveSignal && hasChildbirthSignal,
      relation
    };
  }

  function isGeneralStaffLeaveContext(normalized = "") {
    if (hasDeathLeaveSignal(normalized) || /출장|여비|일비|식비|숙박비|운임|교통비/.test(normalized)) return false;
    const subject = getSubjectContext(normalized);
    return /휴가|휴가규정|연가|연차|병가|공가|특별휴가|출산휴가|복무|근태/.test(normalized)
      && subject.isStaff;
  }

  function hasDeathLeaveSignal(normalized = "") {
    return /사망|상례|장례|부고|별세|부모상|배우자상|자녀상|조부모상|형제상|자매상|삼촌상|숙부상|백부상|고모상|이모상|장인상|장모상|시부상|시모상/.test(normalized);
  }

  function getEffectivePolicyDomain(domainCode = "") {
    const domain = KB.domains?.[domainCode] || {};
    const template = ONTOLOGY.defaultDomainTemplate || {};
    if (!domain.ontologyGroup) return domain;
    return {
      ...template,
      ...domain,
      sourcePriorityDefault: domain.sourcePriorityDefault || template.sourcePriorityDefault || "mixed",
      requiredSlots: domain.requiredSlots || template.requiredSlots || [],
      slotExtractors: {
        ...(template.slotExtractors || {}),
        ...(domain.slotExtractors || {})
      },
      tasks: {
        ...(template.tasks || {}),
        ...(domain.tasks || {})
      }
    };
  }

  function extractDomainSlots(domainCode, question, normalized, domain = {}) {
    const slots = {};
    const extractors = domain.slotExtractors || {};
    for (const [slotName, extractorName] of Object.entries(extractors)) {
      slots[slotName] = runSlotExtractor(extractorName, question, normalized);
    }
    if (domainCode === "domesticTravelExpense") {
      slots.expenseItems ||= inferTravelExpenseItems(normalized);
      slots.destination ||= inferDomesticTravelDestination(question, normalized);
      slots.duration ||= inferTravelDuration(normalized);
      slots.travelerRole ||= inferDomesticTravelProfile(normalized);
      slots.workplaceTravel ??= (TRAVEL.workplaceTravelPattern || /근무지내|근무지안|관내출장|같은시|같은군|동일시|동일군|12km|12킬로|4시간|네시간|당일관내/).test(normalized);
      slots.institution ||= inferInstitutionName(question, normalized);
    }
    return slots;
  }

  function runSlotExtractor(extractorName, question, normalized) {
    if (extractorName === "travelSubjectProfile") return inferDomesticTravelProfile(normalized);
    if (extractorName === "policySubjectProfile") return inferPolicySubjectProfile(normalized);
    if (extractorName === "travelExpenseItems") return inferTravelExpenseItems(normalized);
    if (extractorName === "domesticTravelDestination") return inferDomesticTravelDestination(question, normalized);
    if (extractorName === "travelDuration") return inferTravelDuration(normalized);
    if (extractorName === "workplaceTravel") return (TRAVEL.workplaceTravelPattern || /근무지내|근무지안|관내출장|같은시|같은군|동일시|동일군|12km|12킬로|4시간|네시간|당일관내/).test(normalized);
    if (extractorName === "institutionName") return inferInstitutionName(question, normalized);
    if (extractorName === "familyRelation") return inferFamilyRelation(normalized);
    if (extractorName === "employmentType") return inferEmploymentType(normalized);
    if (extractorName === "dateRange") return inferDateRange(normalized);
    if (extractorName === "serviceIssue") return inferServiceIssue(normalized);
    if (extractorName === "evidence") return inferEvidence(normalized);
    if (extractorName === "educationOffice") return inferEducationOffice(normalized);
    if (extractorName === "fiscalYear") return inferFiscalYear(normalized);
    if (extractorName === "spendingType") return inferSpendingType(normalized);
    if (extractorName === "procedureStage") return inferProcedureStage(normalized);
    if (extractorName === "instructorHonorariumProfile") return inferInstructorHonorariumProfile(normalized);
    if (extractorName === "lectureDuration") return inferLectureDuration(normalized);
    if (extractorName === "universalProcedureStage") return inferUniversalProcedureStage(normalized);
    if (extractorName === "schoolLevel") return inferSchoolLevel(normalized);
    if (extractorName === "schoolRule") return inferSchoolRule(normalized);
    if (extractorName === "riskSignal") return inferRiskSignal(normalized);
    if (extractorName === "vocationalProgram") return inferVocationalProgram(normalized);
    if (extractorName === "industryPartner") return inferIndustryPartner(normalized);
    if (extractorName === "curriculumArea") return inferCurriculumArea(normalized);
    if (extractorName === "welfareBenefit") return inferWelfareBenefit(normalized);
    if (extractorName === "facilityArea") return inferFacilityArea(normalized);
    if (extractorName === "dataSystem") return inferDataSystem(normalized);
    return null;
  }

  function inferDomainTask(domain = {}, normalized = "", slots = {}) {
    const tasks = Object.entries(domain.tasks || {})
      .map(([code, task]) => ({
        code,
        score: (task.keywords || []).reduce((sum, keyword) => sum + (normalized.includes(compactText(keyword)) ? Math.max(2, compactText(keyword).length) : 0), 0),
        outputSlots: task.outputSlots || []
      }))
      .sort((a, b) => b.score - a.score);
    const selected = tasks[0]?.score ? tasks[0] : inferFallbackTask(slots, domain);
    return selected || { code: "unknown", score: 0, outputSlots: [] };
  }

  function getEffectiveRequiredSlots(domainCode = "", domain = {}, task = {}, slots = {}, normalized = "") {
    const requiredSlots = domain.requiredSlots || [];
    if (domainCode !== "staffAttendanceService") return requiredSlots;

    const issueCode = getStaffIssueCode(slots);
    const employmentCode = getStaffEmploymentCode(slots);
    const taskCode = task?.code || "";
    const hasSpecificIssue = issueCode && issueCode !== "serviceGeneral" && issueCode !== "unknown";
    const asksRuleOrAmount = /기준|규정|가능|인정|처리|어떻게|확인|적용|최대|한도|일수|며칠|몇일|사용|신청/.test(normalized);

    if (employmentCode === "fixedTerm" && issueCode === "sickLeave") {
      return requiredSlots;
    }

    if (hasSpecificIssue && taskCode !== "disputeRisk" && asksRuleOrAmount) {
      return requiredSlots.filter((slotName) => slotName !== "evidence");
    }
    return requiredSlots;
  }

  function inferFallbackTask(slots = {}, domain = {}) {
    if (Array.isArray(slots.expenseItems) && isFullTravelExpenseItems(slots.expenseItems)) {
      return { code: "totalAmount", score: 1, outputSlots: ["expenseItems", "duration", "destination", "travelerRole"] };
    }
    if (Array.isArray(slots.expenseItems) && slots.expenseItems.length) {
      return { code: "componentAmount", score: 1, outputSlots: ["expenseItems", "destination", "travelerRole"] };
    }
    if (domain.ontologyGroup) {
      if (isSlotFilled(slots.riskSignal)) return { code: "disputeRisk", score: 1, outputSlots: ["targetSubject", "riskSignal", "evidence"] };
      if (isSlotFilled(slots.evidence)) return { code: "evidence", score: 1, outputSlots: ["evidence", "procedureStage"] };
      if (isSlotFilled(slots.procedureStage)) return { code: "procedure", score: 1, outputSlots: ["targetSubject", "procedureStage", "evidence", "riskSignal"] };
      return { code: "procedure", score: 0, outputSlots: ["targetSubject", "procedureStage", "evidence", "riskSignal"] };
    }
    return null;
  }

  function buildLookupPlan(domainCode, domain = {}, task = {}, slots = {}, missingSlots = [], requiredSlots = null) {
    if (!domainCode) return { status: "unclassified", actions: [] };
    const dataCoverage = buildDataCoverage(domainCode, domain, task, slots, missingSlots, requiredSlots);
    const sourceExpansion = buildSourceExpansionPlan(domainCode, domain, task, slots, missingSlots, requiredSlots, dataCoverage);
    const required = requiredSlots || domain.requiredSlots || [];
    return {
      status: missingSlots.length ? "needsSlotConfirmation" : "ready",
      domainCode,
      taskCode: task.code || "unknown",
      sourcePriority: domain.sourcePriorityDefault || "national",
      dataCoverage,
      sourceExpansion,
      requiredSlots: required,
      presentSlots: Object.entries(slots)
        .filter(([, value]) => isSlotFilled(value))
        .map(([slotName]) => slotName),
      missingSlots,
      actions: uniqueStrings([
        "classify_policy_question",
        "search_school_policy_corpus",
        "search_policy_rules",
        "get_rule_table",
        missingSlots.includes("office") || domain.sourcePriorityDefault === "office" ? "get_office_guideline" : "",
        missingSlots.includes("schoolRule") || required.includes("schoolRule") || domain.sourcePriorityDefault === "schoolRuleFirst" ? "get_school_rule" : "",
        dataCoverage.gapCandidates.length ? "record_unanswered_gap_candidates" : "",
        sourceExpansion.required ? "queue_source_expansion" : "",
        sourceExpansion.required ? "fetch_office_guideline_originals" : "",
        sourceExpansion.required ? "fetch_school_rule_originals" : "",
        "verify_source_currentness",
        sourceExpansion.required ? "recheck_policy_answer_with_expanded_sources" : "",
        "compose_policy_answer"
      ])
    };
  }

  function buildDataCoverage(domainCode, domain = {}, task = {}, slots = {}, missingSlots = [], requiredSlots = null) {
    const dataIndex = getDomainDataIndexProfile(domainCode, domain);
    const required = requiredSlots || domain.requiredSlots || [];
    const missing = uniqueStrings([...(missingSlots || []), ...required.filter((slotName) => !isSlotFilled(slots[slotName]))]);
    const present = uniqueStrings(required.filter((slotName) => isSlotFilled(slots[slotName])));
    const sourceTargets = uniqueStrings(dataIndex?.sourceTargets || domain.sourceKeys || []);
    const indexedSubtopics = uniqueStrings(dataIndex?.subtopics || (domain.intentKeywords || []).slice(0, 8));
    const collectionTargets = uniqueStrings(dataIndex?.dataGrowthTargets || []);
    const clarificationSlots = uniqueStrings(dataIndex?.clarificationSlots || required);
    const gapCandidates = uniqueStrings([
      ...missing.map((slotName) => `사용자 확인 필요: ${slotName}`),
      ...(!sourceTargets.length ? [`공식 출처 연결 필요: ${domain.label || domainCode}`] : []),
      ...((missing.length || sourceTargets.length < 2) ? collectionTargets.slice(0, 3) : [])
    ]);

    return {
      domainCode,
      indexAvailable: Boolean(dataIndex),
      indexedSubtopics,
      sourceTargets,
      clarificationSlots,
      presentSlots: present,
      missingSlots: missing,
      collectionTargets,
      gapCandidates,
      autoExpansionRequired: Boolean(gapCandidates.length),
      coverageLevel: dataIndex && sourceTargets.length >= 3 && indexedSubtopics.length >= 4
        ? "structured"
        : dataIndex
          ? "partial"
          : "basic"
    };
  }

  function buildSourceExpansionPlan(domainCode, domain = {}, task = {}, slots = {}, missingSlots = [], requiredSlots = null, dataCoverage = {}) {
    const required = requiredSlots || domain.requiredSlots || [];
    const missing = uniqueStrings([...(missingSlots || []), ...required.filter((slotName) => !isSlotFilled(slots[slotName]))]);
    const sourceTargets = uniqueStrings(dataCoverage.sourceTargets || domain.sourceKeys || []);
    const collectionTargets = uniqueStrings(dataCoverage.collectionTargets || []);
    const domainLabel = domain.label || domainCode || "학교정책";
    const taskLabel = getTaskLabel(domainCode, task?.code || "");
    const officeLabel = slots.office?.label || "경상북도교육청";
    const ruleLabel = slots.schoolRule?.label || "학교생활규정·학칙·위원회 규정";
    const hasGap = Boolean((dataCoverage.gapCandidates || []).length);
    const isSchoolDomain = isOntologySchoolDomain(domainCode);
    const needsSchoolRule = isSchoolDomain || missing.includes("schoolRule") || domain.sourcePriorityDefault === "schoolRuleFirst";
    const needsOfficeGuideline = isSchoolDomain || missing.includes("office") || domain.sourcePriorityDefault === "office";
    const needsExpansion = Boolean(
      hasGap
      || dataCoverage.coverageLevel === "basic"
      || missing.some((slotName) => ["office", "schoolRule", "evidence", "riskSignal"].includes(slotName))
      || (isSchoolDomain && sourceTargets.length < 3)
    );

    const acquisitionTargets = uniqueObjectsByKey([
      isSchoolDomain ? {
        tier: "ministryGuideline",
        label: "상위 법령·고시·교육부 지침 원문",
        query: `${domainLabel} ${taskLabel} 법령 고시 교육부 지침`,
        reason: "학교·교육청 세부 기준보다 먼저 적용되는 상위 공식 기준 확인"
      } : null,
      needsOfficeGuideline ? {
        tier: "educationOfficeGuideline",
        label: `${officeLabel} 지침 원문`,
        query: `${officeLabel} ${domainLabel} ${taskLabel} 지침 원문`,
        reason: "상위 기준을 소속 교육청 지침으로 구체화했는지 확인"
      } : null,
      needsSchoolRule ? {
        tier: "schoolRule",
        label: ruleLabel,
        query: `${domainLabel} ${ruleLabel} ${taskLabel} 원문`,
        reason: "상위 법령·고시·교육청 지침으로도 남는 학교별 세부 집행 기준 최종 대조"
      } : null,
      missing.includes("evidence") || isSchoolDomain ? {
        tier: "evidenceTemplate",
        label: "신청서·동의서·회의록·상담기록·통지서 서식",
        query: `${domainLabel} ${taskLabel} 증빙자료 서식 기록 보존`,
        reason: "답변에 필요한 증빙 흐름을 사용자에게 떠넘기지 않고 보강"
      } : null
    ].filter(Boolean), "tier");

    return {
      required: needsExpansion,
      status: needsExpansion ? "queued" : "sufficient",
      trigger: needsExpansion ? "source_or_slot_gap_detected" : "covered_by_current_index",
      missingSlots: missing,
      collectionTargets,
      acquisitionTargets,
      riskReview: buildRiskReviewPlan(domainCode, slots, task),
      recheckSteps: needsExpansion ? [
        "질문을 학교 현장 쟁점과 사용자 사실관계 슬롯으로 다시 분해",
        "상위 법령·고시·교육부 지침을 먼저 확보하고 교육청 지침과 학교생활규정·학칙·위원회 규정을 순서대로 대조",
        "시행일, 적용 대상, 학교급, 소속 교육청, 내부 결재·통지 이력을 대조",
        "안전·인권·개인정보·불복 쟁점을 분리해 긴급 조치와 일반 안내를 나눔",
        "확보한 원문과 증빙 기준으로 같은 질문의 결론을 재작성"
      ] : []
    };
  }

  function buildRiskReviewPlan(domainCode = "", slots = {}, task = {}) {
    const riskLabel = slots.riskSignal?.label || "";
    const domainLabel = getEffectivePolicyDomain(domainCode)?.label || domainCode || "학교 현장";
    const text = `${domainLabel} ${task?.code || ""} ${riskLabel}`;
    const items = [
      ["safety", "안전·응급", /안전|응급|사고|위험|감염|식중독|보호|긴급/],
      ["humanRights", "학생인권·차별", /인권|차별|부당|모욕|강압|체벌|학생지도/],
      ["privacy", "개인정보·민감정보", /개인정보|영상|사진|CCTV|민감정보|기록|학생부|상담기록/],
      ["appeal", "불복·이의신청", /불복|이의|재심|행정심판|민원|소명|통지/],
      ["schoolViolence", "학교폭력·보복", /학교폭력|학폭|보복|가해|피해|괴롭힘|협박/],
      ["records", "기록·증빙 보존", /증빙|기록|회의록|공문|통지|결재|서식|신청서/]
    ];

    return {
      required: isOntologySchoolDomain(domainCode) || Boolean(riskLabel),
      items: items.map(([code, label, pattern]) => ({
        code,
        label,
        status: pattern.test(text) ? "detected" : "screen",
        check: `${label} 쟁점을 일반 규정 답변과 분리해 판단`
      }))
    };
  }

  function uniqueObjectsByKey(items = [], keyName = "key") {
    const seen = new Set();
    return items.filter((item) => {
      const key = item?.[keyName];
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getDomainDataIndexProfile(domainCode = "", domain = {}) {
    return domain.dataIndex || ONTOLOGY.specializedDataIndex?.[domainCode] || null;
  }

  function getMatchedDomainIndexTerms(normalized = "", dataIndex = null) {
    if (!dataIndex) return [];
    return uniqueStrings([
      ...(dataIndex.subtopics || []),
      ...(dataIndex.questionPatterns || []),
      ...(dataIndex.evidence || []),
      ...(dataIndex.sourceTargets || []),
      ...(dataIndex.dataGrowthTargets || [])
    ]).filter((term) => {
      const compact = compactText(term);
      if (!compact || compact.length < 3 || isGenericIndexTerm(compact)) return false;
      return normalized.includes(compact);
    });
  }

  function isGenericIndexTerm(term = "") {
    return /^(학생|학부모|교사|교원|학교|자료|서류|기준|절차|신청|승인|확인|지침|법령|사례|서식)$/.test(term);
  }

  function inferAudienceCodes(normalized = "") {
    const matches = [];
    if (/학생|재학생|고등학생|특성화고생|현장실습생|실습생/.test(normalized)) matches.push("student");
    if (/학부모|보호자|부모/.test(normalized)) matches.push("parent");
    if (/교사|교원|담임|선생|교장|학교장|관리자/.test(normalized)) matches.push("teacher", "manager");
    if (/기간제|계약제교원/.test(normalized)) matches.push("fixedTermTeacher");
    if (/사립학교|학교법인/.test(normalized)) matches.push("privateSchool");
    if (/행정실|행정직|지방공무원|교육행정/.test(normalized)) matches.push("localOfficer");
    if (/교육공무직|공무직|특수운영직군/.test(normalized)) matches.push("educationWorker");
    if (/실습기업|참여기업|선도기업|산업체|업체/.test(normalized)) matches.push("industryPartner");
    if (/졸업생|졸업자|취업자/.test(normalized)) matches.push("graduate");
    return uniqueStrings(matches);
  }

  function isSlotFilled(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "boolean") return true;
    if (!value) return false;
    if (typeof value === "object") {
      if (value.code === "unknown") return false;
      if (value.label === "지역 미특정") return false;
      if (Object.prototype.hasOwnProperty.call(value, "detected")) return Boolean(value.detected);
      return Object.keys(value).length > 0;
    }
    return String(value).trim().length > 0;
  }

  function buildPolicyResponse({ question = "", officeLabel = "소속 교육청", roleLabel = "" } = {}) {
    const analysis = analyzePolicyQuestion(question);
    const lookup = lookupPolicyRules(analysis);
    if (lookup?.domain === "domesticTravelExpense") {
      return buildDomesticTravelResponse(analysis, { officeLabel, roleLabel, lookup });
    }
    if (lookup?.domain === "schoolInstructorHonorarium") {
      return buildInstructorHonorariumResponse(analysis, { officeLabel, roleLabel, lookup });
    }
    if (lookup?.domain) {
      return buildSemanticPolicyResponse(analysis, { officeLabel, roleLabel, lookup });
    }
    return null;
  }

  function lookupPolicyRules(analysis = {}) {
    const semanticFrame = analysis.semanticFrame || buildPolicySemanticFrame(analysis.question || "");
    if (!semanticFrame.domainCode) return null;

    const domain = getEffectivePolicyDomain(semanticFrame.domainCode);

    if (analysis.intents?.domesticTravel || semanticFrame.domainCode === "domesticTravelExpense") {
      const corpusMatches = searchPolicyCorpus(semanticFrame, analysis.question || semanticFrame.question || "");
      return {
        domain: "domesticTravelExpense",
        categoryCode: domain.categoryCode || "leaveAttendance",
        sourcePriority: domain.sourcePriorityDefault || "national",
        sourceKeys: TRAVEL.sourceKeys || [],
        requiredSlots: semanticFrame.requiredSlots || domain.requiredSlots || [],
        semanticFrame,
        task: semanticFrame.task,
        missingSlots: semanticFrame.missingSlots,
        lookupPlan: semanticFrame.lookupPlan,
        dataCoverage: semanticFrame.lookupPlan?.dataCoverage || null,
        corpusMatches,
        legalBasis: TRAVEL.legalBasis || [],
        connectors: KB.sourceConnectors || {},
        tables: {
          domesticTravel: {
            dailyRate: TRAVEL.dailyRate,
            mealRate: TRAVEL.mealRate,
            workplaceUnder4h: TRAVEL.workplaceUnder4h,
            workplace4h: TRAVEL.workplace4h,
            lodgingCaps: TRAVEL.lodgingCaps || {}
          }
        }
      };
    }

    const corpusMatches = searchPolicyCorpus(semanticFrame, analysis.question || semanticFrame.question || "");
    return {
      domain: semanticFrame.domainCode,
      categoryCode: domain.categoryCode || semanticFrame.categoryCode || "",
      sourcePriority: domain.sourcePriorityDefault || "national",
      sourceKeys: domain.sourceKeys || [],
      requiredSlots: semanticFrame.requiredSlots || domain.requiredSlots || [],
      semanticFrame,
      task: semanticFrame.task,
      missingSlots: semanticFrame.missingSlots,
      lookupPlan: semanticFrame.lookupPlan,
      dataCoverage: semanticFrame.lookupPlan?.dataCoverage || null,
      corpusMatches,
      legalBasis: domain.legalBasis || [],
      connectors: KB.sourceConnectors || {},
      tables: semanticFrame.domainCode === "schoolInstructorHonorarium"
        ? { instructorHonorarium: HONORARIUM.rateTables || {} }
        : {}
    };
  }

  function searchPolicyCorpus(semanticFrame = {}, question = "") {
    if (!CORPUS?.search) return [];
    return CORPUS.search(question || semanticFrame.question || "", {
      semanticFrame,
      domainCode: semanticFrame.domainCode,
      limit: 8
    }).map((match) => ({
      id: match.id,
      type: match.type,
      score: match.score,
      domainCode: match.domainCode || "",
      sourceKey: match.sourceKey || "",
      sourceTier: match.sourceTier || "",
      title: match.title || "",
      provider: match.provider || "",
      query: match.query || "",
      summary: match.summary || "",
      dataGrowthTarget: match.dataGrowthTarget || "",
      dataIndex: match.dataIndex || null
    }));
  }

  function buildSemanticPolicyResponse(analysis, { officeLabel = "소속 교육청", roleLabel = "", lookup = null } = {}) {
    const frame = lookup?.semanticFrame || analysis.semanticFrame || buildPolicySemanticFrame(analysis.question || "");
    const domainCode = lookup?.domain || frame.domainCode;
    const domain = getEffectivePolicyDomain(domainCode);
    const slots = frame.slots || {};
    const subjectLabel = getSubjectLabelFromSlots(slots, roleLabel);
    const domainLabel = domain.label || frame.domainLabel || "규정·지침";
    const taskLabel = getTaskLabel(domainCode, frame.task?.code);

    return {
      engineVersion: VERSION,
      domain: domainCode,
      categoryCode: domain.categoryCode || frame.categoryCode || "",
      roleCode: slots.travelerRole?.roleCode || "auto",
      roleLabel: subjectLabel,
      title: `${domainLabel} 확인 기준`,
      lead: buildGenericDomainLead(domainCode, domainLabel, taskLabel, subjectLabel, slots, officeLabel, frame),
      sourcePriority: lookup?.sourcePriority || domain.sourcePriorityDefault || "national",
      sourceKeys: lookup?.sourceKeys || domain.sourceKeys || [],
      ruleLookup: lookup,
      sourceExpansion: frame.lookupPlan?.sourceExpansion || lookup?.lookupPlan?.sourceExpansion || null,
      riskReview: frame.lookupPlan?.sourceExpansion?.riskReview || lookup?.lookupPlan?.sourceExpansion?.riskReview || null,
      answer: buildGenericDomainAnswers(domainCode, domainLabel, taskLabel, subjectLabel, slots, officeLabel, frame, lookup),
      steps: buildGenericDomainSteps(domainCode, subjectLabel, slots, officeLabel, frame),
      queries: buildGenericDomainQueries(domainCode, domainLabel, taskLabel, subjectLabel, slots, officeLabel, lookup),
      caution: buildGenericDomainCaution(domainCode, frame, officeLabel)
    };
  }

  function buildGenericDomainLead(domainCode, domainLabel, taskLabel, subjectLabel, slots, officeLabel, frame = {}) {
    if (domainCode === "schoolBudgetExecution") {
      const officeText = getOfficeSlotLabel(slots, officeLabel);
      const fiscalYear = slots.fiscalYear?.label || "해당 학년도";
      return `${domainLabel} 질문은 ${officeText}의 ${fiscalYear} 지침을 우선 조회하고, ${taskLabel}에 필요한 절차와 증빙을 공통 회계·계약 기준으로 다시 대조합니다.`;
    }

    if (domainCode === "staffAttendanceService") {
      return buildStaffAttendanceLead(domainLabel, subjectLabel, slots, frame);
    }

    if (domainCode === "bereavementLeave") {
      const relation = slots.familyRelation?.label || "경조사 대상";
      return `${subjectLabel}의 ${relation} 경조사휴가는 신분과 가족관계를 먼저 확정한 뒤 공통 복무규정과 소속기관 규정을 대조합니다.`;
    }

    if (domainCode === "careerEmploymentGuidance") {
      return buildCareerEmploymentLead(domainLabel, slots, frame);
    }

    if (isOntologySchoolDomain(domainCode)) {
      return buildOntologyDomainLead(domainCode, domainLabel, slots, officeLabel, frame);
    }

    return `${domainLabel} 질문은 먼저 대상 신분, 적용 기관, 업무 단계, 증빙자료를 분리해 확인합니다.`;
  }

  function buildGenericDomainAnswers(domainCode, domainLabel, taskLabel, subjectLabel, slots, officeLabel, frame, lookup = null) {
    const missingText = getMissingSlotText(frame.missingSlots || []);

    if (domainCode === "schoolBudgetExecution") {
      const officeText = getOfficeSlotLabel(slots, officeLabel);
      const fiscalYear = slots.fiscalYear?.label || "해당 학년도";
      const spendingType = slots.spendingType?.label || "집행 항목";
      const stage = slots.procedureStage?.label || "업무 단계";
      const evidence = slots.evidence?.label || "품의서·검수자료·지출결의서·영수증 등 증빙";
      return uniqueStrings([
        `${officeText} ${fiscalYear} 학교회계 예산편성 기본지침을 먼저 조회해야 합니다.`,
        `${spendingType} 사안이면 ${stage} 단계에서 예산 과목, 집행 가능 범위, 결재권자, ${evidence}을 순서대로 대조합니다.`,
        "계약·검수·지출이 섞인 질문은 학교회계 규칙, 지방계약 법령, 공공기록물 보존 기준을 보조 근거로 붙입니다.",
        missingText ? `현재 질문에서 ${missingText}가 명확하지 않으므로 자동 자료확충·사실보완 후보로 등록합니다. 확보되는 즉시 답을 더 좁힙니다.` : ""
      ]);
    }

    if (domainCode === "staffAttendanceService") {
      return buildStaffAttendanceAnswers(subjectLabel, slots, frame, missingText);
    }

    if (domainCode === "bereavementLeave") {
      const relation = slots.familyRelation?.label || "가족관계";
      const employmentType = slots.employmentType?.label || subjectLabel;
      const relationRule = slots.familyRelation || {};
      if (relationRule.detected && relationRule.listed === false) {
        return uniqueStrings([
          `${employmentType} 기준으로 ${relation} 사망은 국가공무원 복무규정 별표 2의 경조사별 휴가 일수표에 별도 일수로 열거되어 있지 않습니다.`,
          "공립 교원은 경조사휴가로 바로 5일을 부여하는 사안이 아니며, 필요하면 연가·특별한 사유의 복무 처리 가능성과 소속기관 별도 지침을 확인합니다.",
          "교육공무직·기간제·사립학교 교직원은 취업규칙, 단체협약, 근로계약서, 학교법인 복무규정에서 방계친족 경조사휴가를 별도로 정했는지 확인합니다."
        ]);
      }
      if (relationRule.detected && Number.isFinite(relationRule.leaveDays) && relationRule.leaveDays > 0) {
        const condition = relationRule.legalCondition ? ` ${relationRule.legalCondition}에는` : "";
        return uniqueStrings([
          `${employmentType} 기준으로 ${relation} 사망 경조사휴가는${condition} ${relationRule.leaveDays}일입니다.`,
          "근거는 국가공무원 복무규정 제20조와 별표 2의 경조사별 휴가 일수표이며, 공립 교원은 교원휴가에 관한 예규와 나이스 근무상황 신청 절차를 함께 확인합니다.",
          "지방공무원·교육공무직·기간제·사립학교 교직원은 지방공무원 복무규정, 취업규칙, 단체협약, 근로계약서, 학교법인 복무규정을 각각 대조합니다."
        ]);
      }
      return uniqueStrings([
        `${employmentType}의 경조사휴가는 ${relation}와 대상 신분을 먼저 확정해야 일수와 신청 절차를 판단할 수 있습니다.`,
        "공립 교원·국가공무원 기준은 국가공무원 복무규정 별표와 교원휴가에 관한 예규를 함께 보고, 지방공무원은 지방공무원 복무규정과 교육청 복무 기준을 대조합니다.",
        "교육공무직·기간제·사립학교 교직원은 취업규칙, 단체협약, 근로계약서, 학교법인 복무규정이 직접 지급·휴가 근거가 될 수 있습니다.",
        missingText ? `현재 질문에서 ${missingText}가 명확하지 않아 최종 일수는 확정하지 않고 확인 항목으로 남깁니다.` : ""
      ]);
    }

    if (domainCode === "careerEmploymentGuidance") {
      return buildCareerEmploymentAnswers(domainLabel, taskLabel, slots, frame, lookup, missingText);
    }

    if (isOntologySchoolDomain(domainCode)) {
      const domain = getEffectivePolicyDomain(domainCode);
      const stage = slots.procedureStage?.label || "업무 단계";
      const evidence = getContextualEvidenceLabel(domainCode, slots, frame);
      const rule = slots.schoolRule?.label || "학교 내부 규정";
      const risk = slots.riskSignal?.label || "안전·인권·개인정보·민원 등 위험 신호";
      const schoolLevel = slots.schoolLevel?.label ? `${slots.schoolLevel.label} 기준을 함께 보고, ` : "";
      return uniqueStrings([
        buildOntologyPrimaryAnswer(domainCode, domainLabel, taskLabel, slots, officeLabel, frame),
        domain.answerStrategy || `${domainLabel}은 학교 내부 규정과 공식 지침을 함께 확인해야 합니다.`,
        buildCorpusBasisText(lookup),
        buildOntologyEvidenceAnswer(domainCode, evidence, schoolLevel, frame),
        slots.riskSignal?.detected ? `${appendSubjectParticle(risk)} 보이므로 단순 안내, 긴급 보호, 위원회·심의, 법적 분쟁 가능성을 분리합니다.` : "위험 신호가 명확하지 않으면 단순 안내·민원 단계로 보되, 안전·인권·개인정보 단서는 계속 확인합니다.",
        missingText ? `현재 질문에서 확인이 부족한 항목은 ${missingText}입니다. 시스템이 자료확충·사실보완 후보로 등록하고, 확보되는 즉시 같은 사안을 재검증합니다.` : ""
      ]);
    }

    return [`${domainLabel} 사안은 ${taskLabel}에 맞춰 대상, 기관, 단계, 증빙을 분리한 뒤 공식 규정 원문을 조회해야 합니다.`];
  }

  function buildCareerEmploymentLead(domainLabel, slots, frame) {
    if (isCareerLaborCounselingQuestion(frame)) {
      return "졸업생·학생의 근로계약, 임금체불, 해고 등은 채용공고 확인이 아니라 취업지도와 노동상담 사안으로 분리해 봅니다.";
    }
    return "고졸채용·추천채용 정보는 잡알리오 등 1차 공식 공고를 먼저 확인하고, 교육청 취업지원센터와 학교 공고는 누락 보완과 교차검증 자료로 봅니다.";
  }

  function buildCareerEmploymentAnswers(domainLabel, taskLabel, slots, frame, lookup, missingText) {
    if (isCareerLaborCounselingQuestion(frame)) {
      return uniqueStrings([
        "졸업생 노동상담은 근로계약서, 임금지급 내역, 출퇴근 기록, 채용공고·문자·상담 이력을 모아 임금체불·근로조건 쟁점을 먼저 정리합니다.",
        "학교는 법률대리 판단을 단정하기보다 취업지도 기록과 사실관계를 정리하고, 필요하면 고용노동부·노동청 진정 또는 노무 상담으로 연결할지 안내합니다.",
        buildCorpusBasisText(lookup),
        "학생·졸업생에게는 민감정보를 최소화해 자료를 보관하게 하고, 임금체불 금액·근무기간·사업장 정보·이미 받은 급여 내역을 분리해 확인합니다.",
        missingText ? `현재 질문에서 확인이 부족한 항목은 ${missingText}입니다. 확보되는 즉시 근로계약·임금체불·상담 절차를 다시 좁혀 답합니다.` : ""
      ]);
    }

    return uniqueStrings([
      "취업지도에서 채용정보를 확인할 때는 잡알리오 등 공식 공고를 1차 기준으로 두고, 교육청 취업지원센터·학교 공고는 누락 보완과 2·3차 검증 출처로 교차 확인합니다.",
      "고졸채용 공고는 채용기관, 전형 일정, 지원 자격, 학교장 추천 여부, 제출 서류와 원문 공고 링크를 분리해 확인합니다.",
      buildCorpusBasisText(lookup),
      missingText ? `현재 질문에서 확인이 부족한 항목은 ${missingText}입니다. 공고 유형과 지원 단계가 확인되면 필요한 자료를 더 정확히 좁힙니다.` : ""
    ]);
  }

  function isCareerLaborCounselingQuestion(frame = {}) {
    const text = compactText([
      frame.question || "",
      frame.normalized || "",
      frame.task?.label || "",
      frame.slots?.riskSignal?.label || "",
      frame.slots?.evidence?.label || ""
    ].join(" "));
    return /근로계약|임금체불|체불임금|노동상담|노무상담|노동청|고용노동부|해고|권고사직|수습|근로조건|급여/.test(text)
      || (/졸업생/.test(text) && /상담|임금|근로|계약|해고|노동|노무/.test(text));
  }

  function buildOntologyDomainLead(domainCode, domainLabel, slots, officeLabel, frame) {
    const normalized = frame.normalized || "";
    if (domainCode === "fieldExperienceLearning") {
      return "교외체험학습·가정학습은 보호자 사전 신청, 학교장 승인, 실시 후 보고서 제출, 출결 처리 순서로 진행합니다.";
    }
    if (domainCode === "schoolViolenceProcedure") {
      return "학교폭력 의심 사안은 신고·인지 후 피해학생 보호, 사안조사, 전담기구 검토, 학교장 자체해결 또는 심의 요청 순서로 처리합니다.";
    }
    if (domainCode === "classManagementGuidance") {
      if (/휴대전화|휴대폰|핸드폰|스마트폰|소지품/.test(normalized)) {
        return "수업 중 휴대전화·소지품 지도는 먼저 교원의 학생생활지도에 관한 고시의 생활지도·분리·소지품 관리 기준을 보고, 학생 인권·개인정보 침해 위험과 학교생활규정의 세부 절차를 뒤따라 대조합니다.";
      }
      return "수업 중 자리 미착석·반복 지도 불응은 먼저 교원의 학생생활지도에 관한 고시의 수업방해 생활지도 기준으로 사실을 기록하고, 선도·징계로 넘어갈 때 초·중등교육법 제18조와 시행령 제31조 절차 및 학교생활규정을 대조합니다.";
    }
    if (domainCode === "studentRecordsAttendance") {
      return "학생부·출결·정정 사안은 당해 학년도 기재요령, 증빙자료, 정정 권한과 결재 이력을 기준으로 처리합니다.";
    }
    if (domainCode === "schoolSafetyHealth") {
      return "학교 안전·보건 사안은 응급조치와 보호자 연락을 먼저 하고, 사고보고·공제·감염병·중대재해 전환 가능성을 단계별로 확인합니다.";
    }
    if (domainCode === "teacherRightsProtection") {
      return "교권 침해와 교육활동 보호 사안은 민원·상담 기록, 교육활동 침해 여부, 교원 보호조치, 아동학대 신고 위험, 법률·노무 상담 전환 필요성을 나누어 확인합니다.";
    }
    if (domainCode === "governanceCommitteeRule" && /학칙|규정개정|개정/.test(normalized)) {
      return "학칙개정과 학교운영위원회 사안은 먼저 초·중등교육법상 학칙·학교운영위원회 근거와 공공기록물·정보공개 기준을 확인하고, 학교별 위원회 규정은 세부 집행 기준으로 최종 대조합니다.";
    }

    const domain = getEffectivePolicyDomain(domainCode);
    return domain.answerStrategy || `${domainLabel}은 학교 내부 규정, 교육부·교육청 지침, 증빙자료를 기준으로 처리합니다.`;
  }

  function buildOntologyPrimaryAnswer(domainCode, domainLabel, taskLabel, slots, officeLabel, frame) {
    const normalized = frame.normalized || "";
    if (domainCode === "fieldExperienceLearning") {
      const schoolLevel = slots.schoolLevel?.label ? `${slots.schoolLevel.label} 학생은 ` : "학생은 ";
      const officeText = getOfficeSlotLabel(slots, officeLabel);
      return `${schoolLevel}체험학습 전에 보호자가 학교 양식의 신청서를 제출하고 학교장 승인을 받은 뒤 실시하며, 종료 후 보고서를 내야 출석인정 처리가 가능합니다. 인정 일수와 제출 기한은 ${officeText} 지침과 학교 학칙을 확인합니다.`;
    }
    if (domainCode === "schoolViolenceProcedure") {
      return "학생 사이의 폭행·협박·따돌림 등 학교폭력 의심 사안은 먼저 피해학생 보호와 사실 기록을 확보하고, 전담기구 조사와 학교장 자체해결 가능 여부를 검토한 뒤 필요하면 교육지원청 심의위원회 절차로 연결합니다.";
    }
    if (domainCode === "classManagementGuidance") {
      if (/휴대전화|휴대폰|핸드폰|스마트폰|소지품/.test(normalized)) {
        return "수업 중 휴대전화 보관은 교원의 학생생활지도에 관한 고시에 따른 생활지도·소지품 관리 가능 범위를 먼저 확인하고, 사전 안내, 보관·반환 기록, 학생 인권·개인정보 보호, 학교생활규정의 세부 절차를 함께 맞춥니다.";
      }
      return "수업 중 반복적인 지시 불응은 교원의 학생생활지도에 관한 고시에 따라 수업방해 사실과 지도 과정을 시간순으로 기록하고, 훈계·상담·분리 등 생활지도 가능 범위와 학생 인권·아동학대 민원 위험을 먼저 분리합니다. 선도·징계가 필요할 때만 초·중등교육법 제18조, 시행령 제31조, 학교생활규정 절차를 최종 대조합니다.";
    }
    if (domainCode === "studentRecordsAttendance") {
      return "학생부·출결·정정은 당해 학년도 기재요령과 학교생활기록 작성·관리지침을 기준으로, 증빙자료와 결재 이력이 확인될 때 정정 또는 출결 처리를 진행합니다.";
    }
    if (domainCode === "schoolSafetyHealth") {
      return "학교 안전·보건 사안은 학생 보호와 응급조치를 먼저 하고, 사고 경위서·보건 기록·보호자 연락·학교안전공제 또는 감염병 보고 필요 여부를 확인합니다.";
    }
    if (domainCode === "teacherRightsProtection") {
      return "교권 침해 또는 교육활동 보호 사안은 먼저 민원·상담·녹취·문자 등 사실자료를 보존하고, 교육활동 침해 여부와 교원 보호조치 필요성, 아동학대 신고나 법적 분쟁으로 번질 위험을 분리해 처리합니다.";
    }
    if (domainCode === "governanceCommitteeRule" && /학칙|규정개정|개정/.test(normalized)) {
      return "학칙개정은 초·중등교육법상 학칙·학교운영위원회 근거와 공공기록물·정보공개 기준을 먼저 확인한 뒤, 학교운영위원회 심의 또는 자문, 개정안 공고와 의견수렴, 회의록 작성·공개 범위, 학생·학부모 의견 반영 여부를 학교별 위원회 규정으로 최종 대조합니다.";
    }

    const domain = getEffectivePolicyDomain(domainCode);
    return domain.answerStrategy || `${domainLabel} 사안은 ${taskLabel}에 맞춰 필요한 조치와 증빙자료를 학교 내부 규정과 공식 지침에 따라 확인합니다.`;
  }

  function getSickLeaveMedicalCertificateText(rule = {}) {
    return rule.medicalCertificateRule
      || "병가 일수가 연간 6일을 초과하면 의사·치과의사·한의사가 발급한 진단서를 첨부하는 기준을 우선 확인합니다.";
  }

  function isSickLeaveEvidenceQuestion(slots = {}, frame = {}) {
    const text = `${frame.question || ""} ${frame.normalized || ""}`;
    return Boolean(
      slots.evidence?.detected
      || frame.task?.code === "evidenceCheck"
      || frame.task?.code === "evidence"
      || /서류|증빙|진단서|확인서|입원확인|진료확인|처방전|뭐\s*필요|뭐필요/.test(text)
    );
  }

  function buildStaffAttendanceLead(domainLabel, subjectLabel, slots, frame = {}) {
    const issueCode = getStaffIssueCode(slots);
    const issueLabel = slots.serviceIssue?.label || "복무·근태";
    const employmentLabel = getStaffEmploymentLabel(slots, subjectLabel);

    if (issueCode === "spouseChildbirthLeave") {
      return `${domainLabel} 질문에서 ${subjectLabel}의 배우자 출산휴가는 특별휴가 사안으로 보고, ${employmentLabel} 기준의 일수와 나이스 근무상황 신청 절차를 함께 확인합니다.`;
    }
    if (issueCode === "specialLeave") {
      return `${domainLabel} 질문에서 ${subjectLabel}의 특별휴가는 사유별 일수표와 ${employmentLabel} 기준의 신청·증빙 절차를 함께 확인합니다.`;
    }
    if (issueCode === "annualLeave") {
      return `${domainLabel} 질문에서 ${subjectLabel}의 연가는 ${employmentLabel} 기준의 일수 산정과 나이스 근무상황 신청·학교장 승인 절차를 함께 확인합니다.`;
    }
    if (issueCode === "sickLeave") {
      if (isSickLeaveEvidenceQuestion(slots, frame)) {
        return `${subjectLabel}의 병가 서류는 병가 사용일수와 사유를 기준으로 보며, 연간 병가가 6일을 초과하면 의사·치과의사·한의사가 발급한 진단서를 첨부하는 기준이 핵심입니다.`;
      }
      if (getStaffEmploymentCode(slots) === "fixedTerm") {
        return `${subjectLabel}의 병가는 공립 교원 복무 기준을 준용하는 경우 일반 병가 60일, 공무상 병가 180일 범위가 기준 후보입니다.`;
      }
      return `${domainLabel} 질문에서 ${subjectLabel}의 병가는 ${employmentLabel} 기준의 병가 한도, 진단서, 나이스 근무상황 신청 절차를 함께 확인합니다.`;
    }
    if (issueCode === "tardyEarlyLeave") {
      return `${domainLabel} 질문에서 ${subjectLabel}의 지각·조퇴·외출은 출근기록, 나이스 근무상황, 승인 여부, 증빙을 분리해 처리합니다.`;
    }
    if (issueCode === "overtime") {
      return `${domainLabel} 질문에서 ${subjectLabel}의 시간외근무는 출장 여부보다 실제 근무명령·사전승인·근무시간 증빙을 기준으로 판단합니다. 1박 2일 인솔출장이라는 사실만으로 자동 인정되는 사안은 아니며, 여비와 분리해 확인합니다.`;
    }
    return `${domainLabel} 질문에서 ${subjectLabel}의 ${issueLabel} 사안은 ${employmentLabel} 기준으로 적용 규정, 승인 절차, 증빙자료를 함께 확인합니다.`;
  }

  function buildStaffAttendanceAnswers(subjectLabel, slots, frame, missingText) {
    const issueCode = getStaffIssueCode(slots);
    const employmentCode = getStaffEmploymentCode(slots);
    const employmentLabel = getStaffEmploymentLabel(slots, subjectLabel);
    const normalized = frame.normalized || "";
    const isFixedTerm = employmentCode === "fixedTerm";
    const isPublicTeacher = employmentCode === "publicTeacher" || employmentCode === "unknown";
    const hasSeparateStaffRule = !isFixedTerm && !isPublicTeacher;

    if (issueCode === "spouseChildbirthLeave") {
      if (hasSeparateStaffRule) return buildOtherStaffAttendanceAnswers(subjectLabel, slots, frame, missingText);
      return uniqueStrings([
        `${subjectLabel}의 배우자 출산휴가는 공립 교원·국가공무원 기준으로 20일입니다.`,
        "이 사안은 가족 사망 경조사휴가가 아니라 배우자 출산 특별휴가이므로 부모상·배우자상 일수표를 적용하지 않습니다.",
        "나이스 근무상황에서 배우자 출산휴가 또는 특별휴가로 사전·사후 신청하고, 출산 사실 확인 자료와 학교장 승인 절차를 맞춥니다.",
        isFixedTerm
          ? "기간제교사는 계약제교원 운영 지침과 임용계약서에서 같은 특별휴가를 어떻게 준용하는지 함께 확인합니다."
          : "지방공무원·교육공무직·사립학교 교직원은 지방공무원 복무규정, 취업규칙, 단체협약, 학교법인 규정에서 별도 기준을 확인합니다.",
        missingText ? `현재 질문에는 ${missingText}가 없어도, 배우자 출산휴가라는 질문 요지는 확정해 답변합니다.` : ""
      ]);
    }

    if (issueCode === "specialLeave") {
      if (hasSeparateStaffRule) return buildOtherStaffAttendanceAnswers(subjectLabel, slots, frame, missingText);
      return uniqueStrings([
        `${subjectLabel}의 특별휴가는 사유별 일수표를 먼저 확인해야 하며, 출산·경조사·모성보호처럼 사유가 달라지면 적용 규정도 달라집니다.`,
        "질문에 배우자 출산, 사망 관계, 본인 출산, 육아시간 등 구체 사유가 드러나면 해당 사유의 특별휴가 규칙으로 다시 좁혀 답변합니다.",
        "나이스 근무상황 신청 종별, 증빙자료, 학교장 승인 절차를 함께 확인합니다.",
        missingText ? `현재 질문에는 ${missingText}가 없어 최종 일수는 사유 확인 항목으로 남깁니다.` : ""
      ]);
    }

    if (issueCode === "annualLeave") {
      if (hasSeparateStaffRule) return buildOtherStaffAttendanceAnswers(subjectLabel, slots, frame, missingText);
      return isFixedTerm
        ? buildFixedTermAnnualLeaveAnswers(subjectLabel, slots, frame, missingText)
        : buildPublicTeacherAnnualLeaveAnswers(subjectLabel, missingText);
    }

    if (issueCode === "sickLeave") {
      if (hasSeparateStaffRule) return buildOtherStaffAttendanceAnswers(subjectLabel, slots, frame, missingText);
      return isFixedTerm
        ? buildFixedTermSickLeaveAnswers(subjectLabel, slots, frame, missingText)
        : buildPublicTeacherSickLeaveAnswers(subjectLabel, slots, frame, missingText);
    }

    if (issueCode === "tardyEarlyLeave" || issueCode === "attendanceRecord") {
      if (hasSeparateStaffRule) return buildOtherStaffAttendanceAnswers(subjectLabel, slots, frame, missingText);
      return isFixedTerm
        ? buildFixedTermAttendanceTimeAnswers(subjectLabel, normalized, frame, missingText)
        : buildPublicTeacherAttendanceTimeAnswers(subjectLabel, normalized, frame, missingText);
    }

    if (issueCode === "overtime") {
      return buildStaffOvertimeAnswers(subjectLabel, slots, frame, missingText);
    }

    const issueLabel = slots.serviceIssue?.label || "복무·근태";
    const evidence = slots.evidence?.label || "나이스 근무상황, 승인 결재, 증빙자료";
    const disputeText = frame.task?.code === "disputeRisk"
      ? "복무평가·계약연장·불이익이 함께 언급되면 동일 사례 처리, 서면 근거, 불리한 처분과 복무 사용 사이의 인과관계를 별도로 확인해야 합니다."
      : "";
    return uniqueStrings([
      `${subjectLabel}의 ${issueLabel} 질문은 ${employmentLabel} 기준으로 적용 규정과 소속기관 지침을 대조해 처리합니다.`,
      "공립 교원은 교원휴가에 관한 예규와 국가공무원 복무규정, 지방공무원은 지방공무원 복무규정, 교육공무직·기간제·사립학교는 취업규칙·단체협약·근로계약·학교법인 규정을 우선 대조합니다.",
      `${issueLabel} 처리는 ${evidence}를 기준으로 사유, 기간, 승인권자, 처리 이력, 분쟁 위험을 함께 확인합니다.`,
      disputeText,
      isPublicTeacher && missingText ? `확정 계산에 필요한 ${missingText}가 빠져 있어도, 확인된 신분과 복무 이슈 기준으로 가능한 범위의 규정 조회는 먼저 진행합니다.` : ""
    ]);
  }

  function buildOtherStaffAttendanceAnswers(subjectLabel, slots, frame, missingText) {
    const issueLabel = slots.serviceIssue?.label || "복무·근태";
    const issueCode = getStaffIssueCode(slots);
    const employmentCode = getStaffEmploymentCode(slots);
    const employmentLabel = getStaffEmploymentLabel(slots, subjectLabel);
    if (issueCode === "sickLeave" && employmentCode === "privateSchool") {
      return buildPrivateSchoolSickLeaveAnswers(subjectLabel, slots, frame, missingText);
    }
    const basis = getOtherStaffBasis(employmentCode);
    return uniqueStrings([
      `${subjectLabel}의 ${issueLabel}는 ${employmentLabel} 기준으로 ${basis.primary}를 먼저 적용하고, 소속 교육청·학교 내부 기준을 함께 확인합니다.`,
      basis.secondary,
      "나이스 근무상황, 내부 결재, 근로계약서, 취업규칙·단체협약, 증빙자료를 대조해 일수·유급 여부·승인권자를 확정합니다.",
      frame.task?.code === "disputeRisk" ? "불이익·평가·재계약 문제가 있으면 동일 사례 처리와 서면 기준을 별도로 확인합니다." : "",
      missingText ? `현재 질문에는 ${missingText}가 없어 최종 일수나 유급 여부는 해당 기관 규정 확인 항목으로 남깁니다.` : ""
    ]);
  }

  function buildPrivateSchoolSickLeaveAnswers(subjectLabel, slots, frame, missingText) {
    const rule = STAFF_ATTENDANCE.privateSchoolTeacher?.sickLeave || {};
    const publicRule = STAFF_ATTENDANCE.publicTeacher?.sickLeave || {};
    const normalDays = rule.normalDays || publicRule.normalDays || 60;
    const officialDays = rule.officialInjuryDays || publicRule.officialInjuryDays || 180;
    const evidenceFocused = isSickLeaveEvidenceQuestion(slots, frame);
    const coreAnswer = `${subjectLabel}의 병가는 사립학교에서는 학교법인 복무규정·취업규칙·근로계약이 직접 기준입니다. 다만 해당 학교가 교원휴가 기준을 준용하면 일반 질병·부상 병가는 연 ${normalDays}일, 공무상 질병·부상 병가는 연 ${officialDays}일이 기준 후보입니다.`;
    const certificateAnswer = getSickLeaveMedicalCertificateText(publicRule);
    const evidenceAnswer = rule.evidenceRule || "교원휴가 기준을 준용하는 경우 병가 일수가 연간 6일을 초과하면 의사·치과의사·한의사가 발급한 진단서를 첨부하는 기준을 함께 봅니다.";
    return uniqueStrings([
      evidenceFocused ? evidenceAnswer : coreAnswer,
      evidenceFocused ? certificateAnswer : "",
      evidenceFocused ? coreAnswer : evidenceAnswer,
      rule.hourlyConversion || "교원휴가 기준을 준용하는 경우 질병·부상으로 인한 지각·조퇴·외출은 누계 8시간을 병가 1일로 계산합니다.",
      rule.approval || "나이스 근무상황 또는 학교 내부 복무 신청으로 병가를 상신하고 학교법인 규정상 승인권자와 증빙 기준을 확인합니다.",
      "학교법인 규정이 공립 교원 준용 기준과 다르게 정한 경우 그 규정이 우선하므로, 실제 적용 전 복무규정·취업규칙·근로계약의 병가 조항을 확인합니다.",
      missingText ? `남은 확인 항목은 ${missingText}입니다. 그래도 병가 한도 질문은 위 준용 기준과 학교법인 직접 규정 확인으로 먼저 답변할 수 있습니다.` : ""
    ]);
  }

  function buildPublicTeacherAnnualLeaveAnswers(subjectLabel, missingText) {
    const rule = STAFF_ATTENDANCE.publicTeacher?.annualLeave || {};
    const daysText = formatAnnualLeaveDays(rule.daysByService);
    return uniqueStrings([
      `${subjectLabel}의 연가는 국가공무원 복무규정 제15조 기준으로 재직기간별 ${daysText}입니다.`,
      rule.approval || "나이스 근무상황에서 사전 신청하고 학교장 승인 후 사용합니다.",
      "국가공무원 복무규정 제16조는 연가 신청을 받으면 공무 수행에 특별한 지장이 없는 경우 승인하는 구조입니다.",
      rule.calculationNote || "정확한 잔여 일수는 재직기간, 사용일수, 휴직·정직·직위해제 이력, 저축연가와 미리 사용한 연가를 함께 계산합니다.",
      missingText ? `현재 질문에는 ${missingText}가 없어 잔여 일수까지는 계산하지 않고, 재직기간별 기본 일수와 신청 절차를 먼저 답합니다.` : ""
    ]);
  }

  function buildFixedTermAnnualLeaveAnswers(subjectLabel, slots, frame, missingText) {
    const rule = STAFF_ATTENDANCE.fixedTermTeacher?.annualLeave || {};
    const normalized = frame?.normalized || "";
    const privateSchool = /사립|학교법인|법인/.test(normalized);
    const fourYear = /4년|사년/.test(normalized);
    const estimate = buildFixedTermAnnualLeaveEstimate(normalized);
    const laborAnnualLeaveFormula = "근로기준법 제60조의 연차유급휴가 산식을 적용하는 경우 1년 80% 이상 출근 15일을 출발점으로, 계속근로 3년 이상부터 2년마다 1일을 가산하는 구조를 후보로 검토합니다.";
    const lead = privateSchool
      ? `${subjectLabel}의 연가·연차는 공립 교원 연가표를 그대로 적용하지 않고 학교법인 취업규칙·복무규정, 근로계약, 계속근로 인정 여부를 먼저 봅니다.`
      : `${subjectLabel}의 연가·연차는 공무원 연가표를 그대로 21일로 단정하지 않고 계약기간, 근무일수, 방학 중 근무 여부, 소속 교육청 계약제교원 지침과 근로계약으로 산정합니다.`;
    const continuousServiceCheck = fourYear
      ? "질문처럼 4년 근무라도 매년 계약 단절이나 방학 중 비근무 기간이 있었는지에 따라 계속근로기간이 달라집니다. 끊김 없는 계속근로 4년이 인정되고 근로기준법 산식을 적용하는 구조라면 16일이 우선 후보입니다."
      : "같은 기간제교사라도 계약기간이 1년인지, 방학 중 비근무인지, 주당 근무일이 어떻게 되는지에 따라 실제 가능 일수가 달라집니다.";
    return uniqueStrings([
      estimate.answer,
      lead,
      rule.approval || "학교가 나이스 근무상황 처리를 사용하면 연가 또는 연차유급휴가로 사전 상신하고 학교장 승인 후 사용합니다.",
      estimate.confirmation,
      continuousServiceCheck,
      laborAnnualLeaveFormula,
      privateSchool
        ? "사립학교는 소속 교육청 지침이 참고가 될 수 있어도 최종 적용은 학교법인 취업규칙, 단체협약, 복무규정, 근로계약의 휴가 조항을 자동 자료확충·재검증 대상으로 둡니다."
        : "소속 교육청이 확인되면 계약제교원 운영 지침과 근로계약서의 휴가 조항을 우선 조회하고, 근로기준법상 연차유급휴가 기준을 보조로 대조합니다.",
      missingText ? `현재 질문에는 ${missingText}가 없어 최종 일수는 계약서·교육청 지침 자동 자료확충 항목으로 남깁니다.` : ""
    ]);
  }

  function buildFixedTermAnnualLeaveEstimate(normalized = "") {
    const serviceMonths = inferServiceMonths(normalized);
    const serviceYears = inferServiceYears(normalized);
    const fullAttendance = inferFullAttendance(normalized);
    const fullAttendanceText = fullAttendance
      ? "개근·무결근 조건이 충족된 것으로 보이면"
      : "월별 개근 여부가 확인되면";

    if (Number.isFinite(serviceMonths) && serviceMonths > 0 && serviceMonths < 12) {
      return {
        answer: `${serviceMonths}개월째 근무 중인 기간제교사는 근로기준법 제60조 제2항식 월 개근 1일 구조를 적용하는 경우 ${serviceMonths}일이 우선 산정 후보입니다.`,
        confirmation: `${fullAttendanceText} 1년 미만 기간에는 매 1개월 개근마다 1일씩 발생하는 산식을 먼저 검토하고, 경상북도교육청 등 소속 교육청 계약제교원 운영 지침과 임용계약서가 이를 어떻게 정했는지 대조해야 합니다.`
      };
    }

    if (Number.isFinite(serviceYears) && serviceYears >= 1) {
      const baseDays = serviceYears >= 3 ? 15 + Math.floor((serviceYears - 1) / 2) : 15;
      return {
        answer: `계속근로 ${serviceYears}년이 끊김 없이 인정되고 1년간 80% 이상 출근한 기간제교사는 근로기준법 제60조 산식을 적용하는 경우 ${baseDays}일이 우선 산정 후보입니다.`,
        confirmation: "다만 매년 계약 단절, 방학 중 비근무, 근로계약의 휴가 조항에 따라 계속근로 인정과 실제 사용 가능 일수가 달라질 수 있습니다."
      };
    }

    return {
      answer: "",
      confirmation: "계약 시작일, 현재 근무 개월 수, 월별 개근 여부가 확인되면 근로기준법 제60조 산식과 소속 교육청 계약제교원 지침을 함께 적용해 후보 일수를 먼저 계산합니다."
    };
  }

  function inferServiceMonths(normalized = "") {
    const numeric = normalized.match(/(\d{1,2})개월(?:째|차|간)?/);
    if (numeric) return Number(numeric[1]);
    const koreanNumbers = {
      한: 1,
      일: 1,
      두: 2,
      이: 2,
      세: 3,
      삼: 3,
      네: 4,
      사: 4,
      다섯: 5,
      오: 5,
      여섯: 6,
      육: 6,
      일곱: 7,
      칠: 7,
      여덟: 8,
      팔: 8,
      아홉: 9,
      구: 9,
      열: 10,
      십: 10,
      열한: 11,
      십일: 11
    };
    for (const [word, value] of Object.entries(koreanNumbers)) {
      if (new RegExp(`${word}개월(?:째|차|간)?`).test(normalized)) return value;
    }
    if (/반년|6개월/.test(normalized)) return 6;
    return null;
  }

  function inferServiceYears(normalized = "") {
    const numeric = normalized.match(/(\d{1,2})년(?:째|차|간|근무)?/);
    if (numeric) return Number(numeric[1]);
    const koreanNumbers = {
      일: 1,
      한: 1,
      이: 2,
      두: 2,
      삼: 3,
      세: 3,
      사: 4,
      네: 4,
      오: 5,
      다섯: 5,
      육: 6,
      여섯: 6
    };
    for (const [word, value] of Object.entries(koreanNumbers)) {
      if (new RegExp(`${word}년(?:째|차|간|근무)?`).test(normalized)) return value;
    }
    return null;
  }

  function inferFullAttendance(normalized = "") {
    return /결근없|결근없이|무결근|개근|빠짐없이|출근율100|출근율백/.test(normalized);
  }

  function buildPublicTeacherSickLeaveAnswers(subjectLabel, slots, frame, missingText) {
    const rule = STAFF_ATTENDANCE.publicTeacher?.sickLeave || {};
    const normalDays = rule.normalDays || 60;
    const officialDays = rule.officialInjuryDays || 180;
    const limitAnswer = `${subjectLabel}의 병가는 국가공무원 복무규정 제18조 기준으로 일반 질병·부상은 연 ${normalDays}일, 공무상 질병·부상은 연 ${officialDays}일 범위에서 승인할 수 있습니다.`;
    const certificateAnswer = getSickLeaveMedicalCertificateText(rule);
    const evidenceAnswer = rule.evidenceRule || "병가 일수가 연간 6일을 초과하면 의사·치과의사·한의사가 발급한 진단서를 첨부해야 합니다.";
    const evidenceFocused = isSickLeaveEvidenceQuestion(slots, frame);
    return uniqueStrings([
      evidenceFocused ? evidenceAnswer : limitAnswer,
      evidenceFocused ? certificateAnswer : "",
      evidenceFocused ? limitAnswer : evidenceAnswer,
      rule.hourlyConversion || "질병·부상으로 인한 지각·조퇴·외출은 누계 8시간을 병가 1일로 계산합니다.",
      rule.approval || "나이스 근무상황에서 병가로 신청하고 진단서 등 증빙과 학교장 승인을 맞춰 처리합니다.",
      missingText ? `현재 질문에는 ${missingText}가 없어 실제 승인 가능 여부는 증빙과 학교장 승인 단계에서 확정합니다.` : ""
    ]);
  }

  function buildFixedTermSickLeaveAnswers(subjectLabel, slots, frame, missingText) {
    const rule = STAFF_ATTENDANCE.fixedTermTeacher?.sickLeave || {};
    const publicRule = STAFF_ATTENDANCE.publicTeacher?.sickLeave || {};
    const generalAnswer = `${subjectLabel}의 병가는 공립 교원 복무 기준을 준용하는 경우 일반 병가 60일, 공무상 병가 180일 범위가 기준 후보입니다. 실제 유급·무급과 사용 가능 일수는 소속 교육청 계약제교원 운영 지침과 근로계약을 함께 적용합니다.`;
    const certificateAnswer = getSickLeaveMedicalCertificateText(publicRule);
    const evidenceAnswer = rule.approval || "나이스 근무상황 또는 학교 내부 복무 신청으로 병가를 상신하고, 연간 병가가 6일을 초과하면 의사·치과의사·한의사 진단서 등 증빙자료를 첨부하는 기준을 우선 확인합니다.";
    const evidenceFocused = isSickLeaveEvidenceQuestion(slots, frame);
    return uniqueStrings([
      evidenceFocused ? evidenceAnswer : generalAnswer,
      evidenceFocused ? certificateAnswer : "",
      evidenceFocused ? generalAnswer : evidenceAnswer,
      "진단서, 승인 이력, 병가 사용일수, 동일 사례 처리 기준은 복무평가·재계약 불이익 여부를 판단할 때도 중요한 증빙이 됩니다.",
      frame.task?.code === "disputeRisk" ? "병가 사용만으로 불이익을 주는지, 증빙 부족·무단결근·계약상 의무 위반처럼 별도 사유가 있는지를 구분해야 합니다." : "",
      missingText ? `현재 질문에는 ${missingText}가 없어 최종 일수와 유급 여부는 계약서·교육청 지침 확인 항목으로 남깁니다.` : ""
    ]);
  }

  function buildPublicTeacherAttendanceTimeAnswers(subjectLabel, normalized, frame, missingText) {
    const rule = STAFF_ATTENDANCE.publicTeacher?.attendanceTime || {};
    const unauthorized = /무단|승인없이|허가없이|미승인|허가없/.test(normalized);
    return uniqueStrings([
      unauthorized
        ? `${subjectLabel}의 무단 지각은 출근기록과 나이스 근무상황을 대조해 지각 시간과 승인 여부를 확정한 뒤, 승인·증빙 없는 시간은 복무 위반 사안으로 처리합니다.`
        : `${subjectLabel}의 지각·조퇴·외출은 출근기록, 나이스 근무상황, 승인권자 결재, 사유와 증빙을 맞춰 처리합니다.`,
      rule.evidence || "출근기록, 근무상황부, 나이스 상신·승인 이력, 사유서와 증빙자료를 함께 확인합니다.",
      "질병·부상으로 인한 지각·조퇴·외출이면 국가공무원 복무규정 제18조에 따라 누계 8시간을 병가 1일로 계산할 수 있고, 개인 사유이면 연가·외출·지각 처리 기준을 확인합니다.",
      rule.followUp || "사유 확인, 사후 승인 가능성, 복무지도·주의·경고·징계 검토 가능성을 분리합니다.",
      missingText ? `현재 질문에는 ${missingText}가 없어 증빙자료 확인 전에는 징계 여부까지 단정하지 않습니다.` : ""
    ]);
  }

  function buildFixedTermAttendanceTimeAnswers(subjectLabel, normalized, frame, missingText) {
    const rule = STAFF_ATTENDANCE.fixedTermTeacher?.attendanceTime || {};
    const unauthorized = /무단|승인없이|허가없이|미승인|허가없/.test(normalized);
    return uniqueStrings([
      unauthorized
        ? `${subjectLabel}의 무단 지각은 출근기록, 나이스 근무상황, 관리자 승인 여부를 기준으로 복무 위반과 계약상 불이익 위험을 분리해 처리합니다.`
        : `${subjectLabel}의 지각·조퇴·외출은 계약제교원 운영 지침, 근로계약, 학교 복무 기준, 나이스 근무상황 이력을 함께 확인해 처리합니다.`,
      rule.approval || "사유서, 증빙자료, 사후 승인 가능성, 복무지도 또는 재계약 평가 반영 여부를 서면 근거로 확인합니다.",
      "질병·부상 사유라면 병가 처리 가능성을 먼저 보고, 개인 사유라면 연가·외출·지각 처리와 임금·복무평가 반영 기준을 구분합니다.",
      frame.task?.code === "disputeRisk" ? "재계약·평가 불이익이 언급되면 동일 사례 처리와 평가 기준의 사전 고지 여부를 따로 확인합니다." : "",
      missingText ? `현재 질문에는 ${missingText}가 없어 증빙과 계약서 확인 전에는 최종 불이익 여부를 단정하지 않습니다.` : ""
    ]);
  }

  function buildStaffOvertimeAnswers(subjectLabel, slots, frame, missingText) {
    const normalized = frame.normalized || "";
    const travelContext = /출장|인솔|수학여행|체험학습|1박|숙박/.test(normalized);
    return uniqueStrings([
      travelContext
        ? `${subjectLabel}의 인솔 출장이 1박 2일이라도 시간외근무가 자동 인정되는 것은 아니고, 정규 근무시간 외에 학교장의 근무명령·사전승인에 따라 실제 학생 인솔·생활지도·안전관리 업무를 했는지가 핵심입니다.`
        : `${subjectLabel}의 시간외근무는 학교장의 근무명령·사전승인, 실제 근무시간, 나이스 초과근무 신청·승인 이력을 기준으로 판단합니다.`,
      "출장명령과 여비 지급은 별도 축입니다. 일비·식비·숙박비를 받는다는 사실만으로 시간외근무 수당이 당연히 인정되거나 배제되지는 않으므로, 출장 중 실제 근무시간과 이동·대기·취침 시간을 분리해야 합니다.",
      "신청하려면 초과근무명령 또는 사전승인, 나이스 상신·승인 이력, 현장체험학습·인솔 계획, 야간 생활지도·안전관리 근무분장, 실제 근무시간 기록을 함께 확인합니다.",
      "소속 교육청 복무·초과근무 지침과 학교 내부 결재 기준에서 출장 중 초과근무 인정 범위, 중복 지급 제한, 사후 승인 가능 여부를 확인한 뒤 최종 처리합니다.",
      missingText ? `현재 질문에는 ${missingText}가 없어도, 질문의 핵심은 여비가 아니라 출장 중 시간외근무 신청 가능 여부로 보아 답변합니다.` : ""
    ]);
  }

  function buildStaffAttendanceSteps(subjectLabel, slots, frame) {
    const issueCode = getStaffIssueCode(slots);
    if (issueCode === "annualLeave") {
      return uniqueStrings([
        `${subjectLabel}의 재직기간 또는 계약기간과 올해 사용한 연가·연차 확인`,
        "나이스 근무상황에서 연가 또는 연차유급휴가로 사전 신청",
        "학교장 승인 여부와 공무 수행 지장 여부 확인",
        "휴직·정직·직위해제, 저축연가, 미리 사용한 연가, 방학 중 근무 여부 대조"
      ]);
    }
    if (issueCode === "sickLeave") {
      return uniqueStrings([
        `${subjectLabel}의 병가 사유가 일반 질병·부상인지 공무상 질병·부상인지 구분`,
        "나이스 근무상황 또는 학교 내부 복무 신청으로 병가 상신",
        "연간 병가 사용일수와 의사·치과의사·한의사 진단서 제출 기준 확인",
        "승인 결재, 진단서·입원확인서·진료확인서 등 증빙, 처리 이력 보존",
        ...(frame.task?.code === "disputeRisk" ? ["복무평가·계약연장 불이익이 있으면 동일 사례와 서면 기준 확인"] : [])
      ]);
    }
    if (issueCode === "tardyEarlyLeave" || issueCode === "attendanceRecord") {
      return uniqueStrings([
        "출근기록과 나이스 근무상황으로 실제 지각·조퇴·외출 시간 확정",
        "사전 승인 또는 사후 승인 가능 사유와 증빙 확인",
        "질병·부상 사유는 병가 누계 8시간 1일 계산 여부 확인",
        "무단 사안은 복무지도, 주의·경고, 징계·계약상 불이익 가능성을 분리"
      ]);
    }
    if (issueCode === "overtime") {
      return uniqueStrings([
        "출장명령과 별도로 초과근무명령 또는 사전승인이 있었는지 확인",
        "정규 근무시간 이후 실제 학생 인솔·생활지도·안전관리 근무시간 기록",
        "이동·대기·취침시간과 실제 근무시간을 분리",
        "나이스 초과근무 신청·승인 이력, 사후 확인, 여비와의 중복 제한 여부 확인"
      ]);
    }
    return uniqueStrings([
      `${subjectLabel}의 신분과 고용 형태 확정`,
      "복무 이슈를 연가, 병가, 공가, 특별휴가, 조퇴·외출·지각, 초과근무, 업무분장, 복무평가 중 하나로 분류",
      "나이스 근무상황 신청, 승인권자, 증빙자료, 처리일자를 확인",
      "소속 교육청 복무 지침, 취업규칙, 단체협약, 근로계약, 학교법인 규정 대조",
      ...(frame.task?.code === "disputeRisk" ? ["불이익·차별·분쟁 가능성이 있으면 동일 사례와 서면 근거를 따로 정리"] : [])
    ]);
  }

  function buildStaffAttendanceQueries(subjectLabel, slots) {
    const issueCode = getStaffIssueCode(slots);
    const employmentCode = getStaffEmploymentCode(slots);
    if (issueCode === "annualLeave") {
      if (employmentCode === "fixedTerm") {
        return [
          "계약제교원 운영 지침 기간제교사 연가 연차",
          "기간제교사 근로계약 연차유급휴가 방학 중 비근무",
          "근로기준법 제60조 제2항 1개월 개근 1일 연차유급휴가",
          `${subjectLabel} 나이스 근무상황 연가 신청`
        ];
      }
      return [
        "국가공무원 복무규정 제15조 연가 일수",
        "국가공무원 복무규정 제16조 연가 승인",
        "교원휴가에 관한 예규 연가",
        `${subjectLabel} 나이스 근무상황 연가 신청`
      ];
    }
    if (issueCode === "sickLeave") {
      if (employmentCode === "fixedTerm") {
        return [
          "계약제교원 운영 지침 기간제교사 병가 복무",
          "기간제교사 근로계약 병가 유급 무급",
          "교원휴가에 관한 예규 병가 준용 여부",
          `${subjectLabel} 나이스 근무상황 병가 신청`
        ];
      }
      if (employmentCode === "privateSchool") {
        return [
          "학교법인 복무규정 사립학교 교원 병가",
          "사립학교 교직원 취업규칙 병가 휴가",
          "교원휴가에 관한 예규 병가 60일 180일",
          "국가공무원 복무규정 제18조 병가"
        ];
      }
      return [
        "국가공무원 복무규정 제18조 병가 60일 180일 진단서",
        "교원휴가에 관한 예규 병가",
        `${subjectLabel} 나이스 근무상황 병가 신청`
      ];
    }
    if (issueCode === "tardyEarlyLeave" || issueCode === "attendanceRecord") {
      return [
        "교원 복무 지각 조퇴 외출 나이스 근무상황",
        "국가공무원 복무규정 제18조 지각 조퇴 외출 병가 8시간",
        `${subjectLabel} 무단 지각 복무 처리`
      ];
    }
    if (issueCode === "overtime") {
      return [
        "국가공무원 복무규정 시간외근무 명령 승인",
        "공무원수당 등에 관한 규정 시간외근무수당 교원",
        `${subjectLabel} 출장 중 시간외근무 나이스 신청`,
        "현장체험학습 인솔교사 초과근무 시간외근무 교육청 지침"
      ];
    }
    return [];
  }

  function buildStaffAttendanceFallbackQueries(subjectLabel, issue, slots = {}) {
    const employmentCode = getStaffEmploymentCode(slots);
    if (employmentCode === "fixedTerm") {
      return [
        `${subjectLabel} ${issue} 계약제교원 운영 지침`,
        `${subjectLabel} ${issue} 근로계약 복무 기준`
      ];
    }
    if (employmentCode === "privateSchool") {
      return [
        `${subjectLabel} ${issue} 학교법인 복무규정`,
        `${subjectLabel} ${issue} 사립학교 취업규칙 근로계약`
      ];
    }
    if (employmentCode === "educationStaff") {
      return [
        `${subjectLabel} ${issue} 교육공무직 취업규칙`,
        `${subjectLabel} ${issue} 교육공무직 단체협약 근로계약`
      ];
    }
    if (employmentCode === "localOfficer") {
      return [
        `${subjectLabel} ${issue} 지방공무원 복무규정`,
        `${subjectLabel} ${issue} 교육청 지방공무원 복무 조례`
      ];
    }
    return [
      `${subjectLabel} ${issue} 복무 지침`,
      `국가공무원 복무규정 ${issue}`,
      `교원휴가에 관한 예규 ${issue}`
    ];
  }

  function filterStaffAttendanceQueriesForEmployment(queries = [], slots = {}) {
    const employmentCode = getStaffEmploymentCode(slots);
    const roleCode = slots.travelerRole?.code || "";
    const blockedPatterns = {
      fixedTerm: [/교육공무직|공무직|지방공무원|교육행정|행정직|사립학교|학교법인/],
      privateSchool: [roleCode === "fixedTermTeacher" ? /교육공무직|공무직|지방공무원|교육행정|행정직/ : /교육공무직|공무직|지방공무원|교육행정|행정직|계약제교원|기간제교사/],
      educationStaff: [/지방공무원|교육행정|행정직|계약제교원|기간제교사|사립학교|학교법인|교원휴가/],
      localOfficer: [/교육공무직|공무직|계약제교원|기간제교사|사립학교|학교법인|교원휴가/],
      publicTeacher: [/교육공무직|공무직|계약제교원|기간제교사|사립학교|학교법인/]
    };
    const patterns = blockedPatterns[employmentCode] || [];
    if (!patterns.length) return queries;
    return queries.filter((query) => !patterns.some((pattern) => pattern.test(query)));
  }

  function buildStaffAttendanceCaution(frame, missingPrefix) {
    const slots = frame.slots || {};
    const employmentCode = getStaffEmploymentCode(slots);
    const issueCode = getStaffIssueCode(slots);
    if (employmentCode === "fixedTerm") {
      return `${missingPrefix}기간제교사는 소속 교육청 계약제교원 운영 지침과 근로계약이 실제 일수·유급 여부를 좌우할 수 있습니다. 공립 교원 기준 준용 여부를 자동 자료확충·재검증 대상으로 남깁니다.`;
    }
    if (employmentCode === "privateSchool" && (issueCode === "annualLeave" || issueCode === "sickLeave" || issueCode === "tardyEarlyLeave")) {
      return `${missingPrefix}사립학교 교직원은 학교법인 복무규정·취업규칙·근로계약이 직접 기준입니다. 교원휴가 기준 준용 여부와 별도 조항은 자동 자료확충·재검증 대상으로 둡니다.`;
    }
    if (employmentCode === "publicTeacher" && (issueCode === "annualLeave" || issueCode === "sickLeave" || issueCode === "tardyEarlyLeave")) {
      return `${missingPrefix}공립 정규교원 기준으로 우선 답변했습니다. 사립학교, 교육공무직, 지방공무원, 기간제교사는 취업규칙·단체협약·근로계약·소속 교육청 지침이 달라질 수 있습니다.`;
    }
    if (issueCode === "overtime") {
      return `${missingPrefix}시간외근무는 출장여비와 별개로 근무명령, 사전승인, 실제 근무시간 증빙, 소속 교육청 초과근무 지침이 있어야 판단할 수 있습니다. 단순 이동·숙박·대기 시간만으로는 인정 여부를 단정하지 않습니다.`;
    }
    return `${missingPrefix}복무·근태는 신분과 고용 형태에 따라 적용 규정이 달라집니다. 공립 교원, 지방공무원, 교육공무직, 기간제, 사립학교 여부를 확정해야 최종 답을 낼 수 있습니다.`;
  }

  function getStaffIssueCode(slots = {}) {
    return slots.serviceIssue?.code && slots.serviceIssue.code !== "unknown"
      ? slots.serviceIssue.code
      : "serviceGeneral";
  }

  function getStaffEmploymentCode(slots = {}) {
    if (slots.employmentType?.code && slots.employmentType.code !== "unknown") return slots.employmentType.code;
    const roleCode = slots.travelerRole?.code || "";
    if (roleCode === "fixedTermTeacher") return "fixedTerm";
    if (["regularTeacher", "teacher", "principal", "vicePrincipal"].includes(roleCode)) return "publicTeacher";
    if (roleCode === "educationStaff") return "educationStaff";
    if (roleCode === "privateSchoolStaff") return "privateSchool";
    if (roleCode === "localOfficer") return "localOfficer";
    return "unknown";
  }

  function getStaffEmploymentLabel(slots = {}, subjectLabel = "대상자") {
    const code = getStaffEmploymentCode(slots);
    const labels = {
      publicTeacher: "공립 교원",
      fixedTerm: "기간제교사",
      educationStaff: "교육공무직",
      privateSchool: "사립학교 교직원",
      localOfficer: "지방공무원·행정직",
      unknown: subjectLabel || "대상자"
    };
    return labels[code] || labels.unknown;
  }

  function getOtherStaffBasis(employmentCode = "unknown") {
    const map = {
      localOfficer: {
        primary: "지방공무원 복무규정과 관할 교육청 복무 기준",
        secondary: "지방공무원·행정직은 국가공무원 기준을 그대로 쓰지 말고 지방공무원 복무규정, 조례·규칙, 교육청 내부 복무 지침을 대조합니다."
      },
      educationStaff: {
        primary: "교육공무직 취업규칙, 단체협약, 근로계약",
        secondary: "교육공무직은 공무원 연가·병가표를 그대로 적용하지 않고 교육청별 취업규칙과 단체협약의 유급·무급 기준을 우선 확인합니다."
      },
      privateSchool: {
        primary: "학교법인 복무규정, 취업규칙, 근로계약",
        secondary: "사립학교 교직원은 공립 교원 기준이 참고가 될 수 있어도 실제 적용은 학교법인 규정과 근로계약을 우선합니다."
      }
    };
    return map[employmentCode] || {
      primary: "해당 신분의 직접 복무 규정",
      secondary: "신분이 확정되면 공립 교원, 지방공무원, 교육공무직, 기간제, 사립학교 중 해당 규정을 우선 적용합니다."
    };
  }

  function formatAnnualLeaveDays(daysByService = []) {
    if (!Array.isArray(daysByService) || !daysByService.length) {
      return "1개월 이상 1년 미만 11일, 1년 이상 3년 미만 15일, 3년 이상 4년 미만 16일, 4년 이상 5년 미만 17일, 5년 이상 6년 미만 20일, 6년 이상 21일";
    }
    return daysByService.map((item) => `${item.service} ${item.days}일`).join(", ");
  }

  function buildCorpusBasisText(lookup = null) {
    const sourceOrder = lookup?.sourceKeys || [];
    let sourceMatches = (lookup?.corpusMatches || []).filter((match) => match.type === "officialSource");
    if (lookup?.domain === "classManagementGuidance") {
      sourceMatches = sourceMatches.sort((a, b) => {
        const aIndex = sourceOrder.indexOf(a.sourceKey);
        const bIndex = sourceOrder.indexOf(b.sourceKey);
        const aRank = aIndex >= 0 ? aIndex : Number.MAX_SAFE_INTEGER;
        const bRank = bIndex >= 0 ? bIndex : Number.MAX_SAFE_INTEGER;
        return aRank - bRank || Number(b.score || 0) - Number(a.score || 0);
      });
    }
    sourceMatches = sourceMatches.slice(0, 3);
    if (!sourceMatches.length) return "";
    return `관련 공식자료로 ${appendObjectParticle(sourceMatches.map((match) => match.title).join(", "))} 먼저 확인합니다.`;
  }

  function getContextualEvidenceLabel(domainCode = "", slots = {}, frame = {}) {
    const normalized = frame.normalized || "";
    const detectedLabel = slots.evidence?.label || "";

    if (domainCode === "teacherRightsProtection") {
      if (isTeacherLegalDisputeContext(normalized)) {
        return buildEvidenceLabel([
          /문자|카톡|메시지|채팅|캡처|스크린샷/.test(normalized) ? "문자·카톡 캡처" : "",
          /녹취|녹음|통화녹음/.test(normalized) ? "통화녹취·녹음자료" : "",
          /민원|학부모|보호자|상담|면담/.test(normalized) ? "민원·상담 기록" : "",
          /고소|고발|소송|민사|형사|손해배상|명예훼손|모욕|협박/.test(normalized) ? "법률위험 관련 자료" : ""
        ], "민원·상담 기록과 증거자료");
      }
      if (isStaffTargetedMediaAbuseContext(normalized)) {
        return buildEvidenceLabel([
          /사진|촬영|얼굴/.test(normalized) ? "촬영자료" : "",
          /영상|동영상|녹화|SNS|sns|게시|유포/.test(normalized) ? "게시·유포 화면" : "",
          /녹취|녹음|통화녹음|목소리/.test(normalized) ? "녹취·녹음자료" : "",
          "상담·민원 기록"
        ], "촬영·녹음 원본과 상담·민원 기록");
      }
    }

    return detectedLabel || "신청서·동의서·회의록·상담기록·공문 등 증빙";
  }

  function buildOntologyEvidenceAnswer(domainCode = "", evidence = "", schoolLevel = "", frame = {}) {
    const normalized = frame.normalized || "";
    if (domainCode === "teacherRightsProtection" && isTeacherLegalDisputeContext(normalized)) {
      return `${schoolLevel}${appendObjectParticle(evidence)} 기준으로 발언·연락 경위, 교육활동 침해 여부, 교원 보호조치, 법률·노무 상담 전환 필요성을 정리합니다.`;
    }
    return `${schoolLevel}${appendObjectParticle(evidence)} 기준으로 사실관계, 승인·통지 이력, 보존해야 할 기록을 정리합니다.`;
  }

  function buildEvidenceLabel(parts = [], fallback = "증빙자료") {
    const values = uniqueStrings(parts).filter(Boolean);
    return values.length ? `${values.join("·")} 등 증빙` : fallback;
  }

  function buildGenericDomainSteps(domainCode, subjectLabel, slots, officeLabel, frame) {
    if (domainCode === "schoolBudgetExecution") {
      return uniqueStrings([
        `${getOfficeSlotLabel(slots, officeLabel)}의 해당 학년도 학교회계 예산편성 기본지침 조회`,
        "질문 속 업무를 예산편성, 품의, 계약, 검수, 지출, 정산 중 어느 단계인지 분류",
        "예산 과목과 재원 성격, 집행 가능 범위, 결재권자 확인",
        "품의서, 견적·계약 자료, 검수조서, 지출결의서, 카드전표·세금계산서 등 증빙 흐름 확인",
        "교육청 지침이 없거나 불명확한 부분은 학교회계 규칙, 지방계약 법령, 공공기록물 기준으로 보조 검증"
      ]);
    }

    if (domainCode === "staffAttendanceService") {
      return buildStaffAttendanceSteps(subjectLabel, slots, frame);
    }

    if (domainCode === "bereavementLeave") {
      return uniqueStrings([
        `${subjectLabel}의 신분과 적용 규정 확인`,
        "본인 부모, 배우자 부모, 배우자, 자녀, 조부모 등 가족관계 확정",
        "휴가 시작일, 휴일 포함 방식, 증빙서류, 나이스 신청 종별 확인",
        "교육공무직·기간제·사립학교는 취업규칙·단체협약·학교법인 규정 우선 대조"
      ]);
    }

    if (isOntologySchoolDomain(domainCode)) {
      const domain = getEffectivePolicyDomain(domainCode);
      if (domainCode === "classManagementGuidance") {
        return uniqueStrings([
          "교원의 학생생활지도에 관한 고시에서 수업방해·훈계·상담·분리·제지 가능 범위를 먼저 확인",
          "수업방해 사실, 교사 지시, 학생 반응, 지도·상담·보호자 안내 과정을 시간순으로 기록",
          "선도·징계 검토 단계로 넘어가면 초·중등교육법 제18조와 시행령 제31조의 절차·의견진술 기회를 대조",
          "교육활동 침해, 학교폭력, 안전 위험, 학생 인권·아동학대 민원 가능성을 각각 분리",
          "상위 기준으로 판단이 남는 세부 집행 부분만 학교생활규정·학칙·위원회 규정으로 최종 확인"
        ]);
      }
      return uniqueStrings([
        `${domain.label || "학교정책"} 질문을 대상, 학교급, 업무 단계, 증빙, 위험 신호로 분해`,
        "상위 법령·고시·교육부 지침을 먼저 자동 확보하고, 교육청·학교 내부 규정은 세부 집행 기준으로 순차 대조",
        "신청서, 동의서, 상담기록, 회의록, 사진, 공문, 통지 이력 등 증빙 흐름을 자료확충 후보로 분리",
        "안전·학교폭력·학생인권·개인정보·차별·불복 가능성을 긴급 조치와 일반 안내로 분리",
        "원문 시행일과 소속 교육청·학교별 세부 규정이 확보되면 같은 질문을 재검증해 답변 문장 갱신"
      ]);
    }

    return ["대상 신분, 소속기관, 업무 단계, 증빙자료를 먼저 분리", "공식 규정 원문과 소속기관 지침을 함께 조회"];
  }

  function buildGenericDomainQueries(domainCode, domainLabel, taskLabel, subjectLabel, slots, officeLabel, lookup = null) {
    let corpusQueries = uniqueStrings((lookup?.corpusMatches || [])
      .map((match) => match.query || match.title)
      .filter(Boolean));
    if (domainCode === "schoolBudgetExecution") {
      const officeText = getOfficeSlotLabel(slots, officeLabel);
      const fiscalYear = slots.fiscalYear?.label || "해당 학년도";
      const spendingType = slots.spendingType?.label || "지출 증빙";
      return uniqueStrings([
        ...corpusQueries,
        `${officeText} ${fiscalYear} 학교회계 예산편성 기본지침 ${spendingType}`,
        `${officeText} 학교회계 지출 증빙 품의 검수 지출결의`,
        "국립 유치원 및 초·중등학교 회계규칙 지출 검수",
        "지방자치단체를 당사자로 하는 계약에 관한 법률 학교 수의계약 검수"
      ]);
    }

    if (domainCode === "staffAttendanceService") {
      const issue = slots.serviceIssue?.label || "복무 근태";
      corpusQueries = filterStaffAttendanceQueriesForEmployment(corpusQueries, slots);
      return uniqueStrings([
        ...corpusQueries,
        ...buildStaffAttendanceQueries(subjectLabel, slots),
        ...buildStaffAttendanceFallbackQueries(subjectLabel, issue, slots)
      ]);
    }

    if (domainCode === "bereavementLeave") {
      const relation = slots.familyRelation?.label || "경조사";
      return uniqueStrings([
        ...corpusQueries,
        `국가공무원 복무규정 별표2 ${relation} 경조사휴가`,
        `교원휴가에 관한 예규 ${relation} 경조사휴가`,
        `지방공무원 복무규정 ${relation} 특별휴가`,
        `교육공무직 취업규칙 ${relation} 경조사휴가`
      ]);
    }

    if (isOntologySchoolDomain(domainCode)) {
      const domain = getEffectivePolicyDomain(domainCode);
      const stage = slots.procedureStage?.label || taskLabel;
      const rule = slots.schoolRule?.label || "학교 규정";
      const expansionQueries = (lookup?.lookupPlan?.sourceExpansion?.acquisitionTargets || [])
        .map((target) => target.query)
        .filter(Boolean);
      if (domainCode === "classManagementGuidance") {
        return uniqueStrings([
          ...corpusQueries,
          ...expansionQueries,
          "교원의 학생생활지도에 관한 고시 수업방해 훈계 상담 분리 제지",
          "초중등교육법 제18조 초중등교육법 시행령 제31조 학생 징계 의견진술",
          "교원지위법 교육활동 침해 수업방해 학생 지도",
          `${getOfficeSlotLabel(slots, officeLabel)} 학생생활규정 학생선도위원회 생활지도`,
          `${rule} ${stage} 증빙자료`
        ]);
      }
      return uniqueStrings([
        ...corpusQueries,
        ...expansionQueries,
        `${domain.label || domainLabel} ${stage} ${rule}`,
        `${domain.label || domainLabel} 교육부 지침`,
        `${domain.label || domainLabel} 시도교육청 지침`,
        `${rule} ${stage} 증빙자료`,
        `${domain.label || domainLabel} 민원 개인정보 안전 조치`
      ]);
    }

    return [`${domainLabel} ${taskLabel} 공식 규정`];
  }

  function buildGenericDomainCaution(domainCode, frame, officeLabel) {
    const missingText = getMissingSlotText(frame.missingSlots || []);
    const missingPrefix = missingText ? `확인되지 않은 항목: ${missingText}. ` : "";

    if (domainCode === "schoolBudgetExecution") {
      return `${missingPrefix}예산·지출은 교육청별 해당 학년도 지침과 학교 내부 결재 기준이 직접적인 처리 기준이 될 수 있으므로, 공통 법령만으로 확정하지 않습니다.`;
    }

    if (domainCode === "staffAttendanceService") {
      return buildStaffAttendanceCaution(frame, missingPrefix);
    }

    if (domainCode === "bereavementLeave") {
      return `${missingPrefix}복무·근태는 신분과 고용 형태에 따라 적용 규정이 달라집니다. 공립 교원, 지방공무원, 교육공무직, 기간제, 사립학교 여부를 확정해야 최종 답을 낼 수 있습니다.`;
    }

    if (isOntologySchoolDomain(domainCode)) {
      if (domainCode === "classManagementGuidance") {
        return `${missingPrefix}학생 생활지도 사안은 교원의 학생생활지도에 관한 고시와 초·중등교육법상 선도·징계 절차를 먼저 적용하고, 학교생활규정·학칙은 상위 기준으로도 남는 학교별 세부 집행 기준을 확정할 때 최종 대조합니다. 시스템이 부족한 상위 원문과 교육청 자료를 자동 자료확충 대상으로 등록하고, 안전·인권·개인정보·불복 쟁점을 분리해 재검증합니다.`;
      }
      return `${missingPrefix}학교 현장 사안은 상위 법령·고시·교육부 지침을 먼저 적용하고, 교육청 지침과 학교생활규정·학칙·위원회 규정은 그 기준을 구체화하는 세부 집행 기준으로 순차 대조합니다. 시스템이 부족한 상위 원문과 교육청·학교 원문을 자동 자료확충 대상으로 등록하고, 안전·인권·개인정보·불복 쟁점을 분리해 재검증합니다.`;
    }

    return `${missingPrefix}${officeLabel} 지침과 내부 규정이 공통 법령보다 더 구체적일 수 있습니다.`;
  }

  function isOntologySchoolDomain(domainCode = "") {
    return Boolean(KB.domains?.[domainCode]?.ontologyGroup);
  }

  function getSubjectLabelFromSlots(slots = {}, roleLabel = "") {
    if (slots.travelerRole?.subjectLabel) return slots.travelerRole.subjectLabel;
    if (slots.travelerRole?.roleLabel) return slots.travelerRole.roleLabel;
    if (slots.targetSubject?.subjectLabel) return slots.targetSubject.subjectLabel;
    if (slots.targetSubject?.roleLabel) return slots.targetSubject.roleLabel;
    if (slots.instructorProfile?.subjectLabel) return slots.instructorProfile.subjectLabel;
    if (slots.instructorProfile?.roleLabel) return slots.instructorProfile.roleLabel;
    if (roleLabel && roleLabel !== "상황에서 자동 판단") return roleLabel;
    return "대상자";
  }

  function getOfficeSlotLabel(slots = {}, officeLabel = "소속 교육청") {
    if (slots.office?.label) return slots.office.label;
    return officeLabel || "소속 교육청";
  }

  function getTaskLabel(domainCode, taskCode) {
    const labels = {
      schoolBudgetExecution: {
        budgetPlanning: "예산 편성",
        spendingEvidence: "지출 증빙",
        contractCheck: "계약·검수",
        allowanceCheck: "수당 집행"
      },
      schoolInstructorHonorarium: {
        feeAmount: "강사수당 산정",
        gradeCheck: "강사 등급 확인",
        evidenceCheck: "지급 증빙 확인"
      },
      staffAttendanceService: {
        ruleCheck: "복무 기준",
        evidenceCheck: "근태 증빙",
        disputeRisk: "불이익·분쟁 위험"
      },
      bereavementLeave: {
        leaveDays: "휴가 일수",
        eligibility: "사용 가능 여부",
        evidence: "증빙·신청 절차"
      }
    };
    const ontologyLabels = {
      procedure: "절차 확인",
      eligibility: "기준·가능 여부",
      evidence: "증빙자료 확인",
      disputeRisk: "분쟁·위험 신호"
    };
    return labels[domainCode]?.[taskCode] || ontologyLabels[taskCode] || "규정 확인";
  }

  function getMissingSlotText(missingSlots = []) {
    const labels = {
      travelerRole: "대상 신분",
      targetSubject: "대상",
      familyRelation: "가족관계",
      employmentType: "고용 형태",
      dateRange: "기간",
      serviceIssue: "복무 이슈",
      instructorProfile: "강사 등급 대상",
      lectureDuration: "강의시간",
      evidence: "증빙자료",
      office: "소속 교육청",
      fiscalYear: "학년도",
      schoolLevel: "학교급",
      schoolRule: "학교 내부 규정",
      riskSignal: "위험 신호",
      spendingType: "집행 항목",
      procedureStage: "업무 단계",
      destination: "출장지",
      workplaceTravel: "근무지 내·외 구분",
      vocationalProgram: "직업교육 프로그램",
      industryPartner: "참여기업·산업체",
      curriculumArea: "교육과정 영역",
      welfareBenefit: "복지·지원 항목",
      facilityArea: "시설·공간",
      dataSystem: "정보시스템"
    };
    return uniqueStrings(missingSlots.map((slotName) => labels[slotName] || slotName)).join(", ");
  }

  function buildDomesticTravelResponse(analysis, { officeLabel = "소속 교육청", roleLabel = "", lookup = null } = {}) {
    const normalized = analysis.normalized || compactText(analysis.question);
    const intent = analysis.intents.domesticTravel;
    const profile = inferDomesticTravelProfile(normalized, roleLabel, intent);
    const destination = intent.destination;
    const duration = intent.duration || inferTravelDuration(normalized);
    const destinationText = destination.label === "지역 미특정" ? "국내 출장" : `${destination.label} 출장`;
    const items = intent.expenseItems;
    const itemLabel = getTravelExpenseItemLabel(items);
    const responseTitle = itemLabel === "출장비"
      ? `${profile.subjectLabel} 국내 출장비 확인 기준`
      : `${profile.subjectLabel} 국내 출장 ${itemLabel} 확인 기준`;
    const leadDestinationText = itemLabel === "출장비"
      ? destinationText.replace(/\s*출장$/, "")
      : destinationText;
    const hasDaily = items.includes("daily");
    const hasMeal = items.includes("meal");
    const hasLodging = items.includes("lodging");
    const hasTransport = items.includes("transport");
    const needsInstitutionTravelRule = profile.localRuleFirst || /사립|학교법인/.test(profile.subjectLabel);
    const needsRoleConfirmation = profile.code === "unknown";
    const travelScope = inferDomesticTravelScope(analysis.question || "", normalized, destination, intent);
    const primaryAnswer = buildTravelExpensePrimaryAnswer(profile, destinationText, items, intent.isWorkplaceTravel, duration, destination);
    const officeRuleText = needsInstitutionTravelRule
      ? `${officeLabel} 지침이나 학교법인 여비규정·취업규칙·내부 복무규정에서 더 구체적인 지급 방식이 있으면 그 기준을 함께 적용합니다.`
      : "";

    return {
      engineVersion: VERSION,
      domain: "domesticTravelExpense",
      categoryCode: "leaveAttendance",
      roleCode: profile.roleCode || "auto",
      roleLabel: profile.roleLabel || "신분 확인 필요",
      title: responseTitle,
      lead: buildDomesticTravelLead(profile, leadDestinationText, itemLabel, travelScope),
      sourcePriority: needsInstitutionTravelRule ? "office" : "national",
      sourceKeys: lookup?.sourceKeys || TRAVEL.sourceKeys || [],
      ruleLookup: lookup,
      answer: uniqueStrings([
        primaryAnswer,
        profile.privateSchoolBasis,
        getTravelGradeBasisText(profile),
        hasDaily ? `공무원 여비 규정 별표 2의 국내출장 일비는 제1호와 제2호 모두 1일당 ${formatWon(TRAVEL.dailyRate)}입니다.` : "",
        hasMeal ? `공무원 여비 규정 별표 2의 국내출장 식비는 제1호와 제2호 모두 1일당 ${formatWon(TRAVEL.mealRate)}입니다.` : "",
        hasDaily && hasMeal ? `근무지 외 국내출장이면 1일 기준 일비는 ${formatWon(TRAVEL.dailyRate)}, 식비는 ${formatWon(TRAVEL.mealRate)}이며 두 항목 합계는 ${formatWon(TRAVEL.dailyRate + TRAVEL.mealRate)}입니다.` : "",
        travelScope.status === "outsideConfirmed" ? "" : "근무지 내 국내출장이면 제16조의 일비·식비·숙박비 계산이 아니라 제18조에 따라 4시간 이상 20,000원, 4시간 미만 10,000원을 봅니다.",
        travelScope.status === "outsideConfirmed" ? "" : "공용차량을 이용하는 등 인사혁신처장이 정하는 감액 사유가 있으면 근무지 내 출장 여비에서 10,000원을 감액할 수 있습니다.",
        profile.localRuleFirst ? `${profile.subjectLabel}은 소속 교육청 취업규칙·단체협약·여비 지침이 직접 지급 근거가 될 수 있으므로, 공무원 여비 규정 준용 여부를 자동 자료확충·재검증 대상으로 둡니다.` : "",
        hasLodging ? "공무원 여비 규정 별표 2에서 제1호의 국내 숙박비는 실비이고, 제2호는 지역별 상한이 붙습니다." : "",
        hasLodging ? getLodgingCapText(destination) : "",
        hasTransport ? "운임은 철도·선박·항공·자동차 운임 모두 실제 필요한 금액을 증빙으로 정산하는 실비 항목입니다." : "",
        officeRuleText
      ]),
      steps: [
        travelScope.status === "outsideConfirmed"
          ? `${travelScope.originLabel}에서 ${destination.label}로 이동하는 출장이므로 근무지 외 국내출장 기준으로 처리`
          : `${destination.label === "지역 미특정" ? "출장지가" : appendSubjectParticle(destination.label)} 근무지 내 같은 시·군 또는 12km 미만 출장인지 먼저 확인`,
        duration.detected ? `${formatTravelDuration(duration)} 일정이면 일비·식비는 ${duration.days}일, 숙박비는 ${duration.nights}박 기준으로 계산` : "",
        "근무지 외 국내출장이면 공무원 여비 규정 제16조와 별표 2의 일비·숙박비·식비 항목을 적용",
        travelScope.status === "outsideConfirmed" ? "" : "근무지 내 국내출장이면 제18조의 4시간 기준 정액과 공용차량 감액 여부를 적용",
        `${profile.subjectLabel}의 여비 지급등급 기준을 ${profile.gradeDetail}에서 확인`,
        "출장명령의 목적지, 출장일수, 출장시간, 숙박 필요 여부, 이동수단을 확인",
        "출장명령, 내부 결재선, 운임·숙박 증빙, 학교법인 또는 교육청 여비 지침을 함께 대조"
      ].filter(Boolean),
      queries: uniqueStrings([
        ...((lookup?.legalBasis || []).map((basis) => `${basis} ${itemLabel}`)),
        "공무원 여비 규정 제16조 일비 숙박비 식비 지급",
        "공무원 여비 규정 제18조 근무지 내 국내 출장 4시간 2만원",
        "공무원 여비 규정 별표 2 국내 여비 지급표 일비 식비 25000",
        "공무원 여비 규정 별표 1 초·중·고등학교 교원 제2호"
      ]),
      caution: needsInstitutionTravelRule
        ? "실제 지급액은 근무지 내·외 구분, 출장시간, 공용차량 이용, 식사 제공 여부, 소속 교육청 또는 학교 내부 여비 지침에 따라 달라질 수 있습니다."
        : needsRoleConfirmation
          ? "일비와 식비의 전국 공통 금액은 먼저 제시할 수 있지만, 최종 지급등급과 적용 규정은 출장자의 신분을 확인해야 확정됩니다."
          : travelScope.status === "outsideConfirmed"
            ? "공립 교원 등 공무원 여비 규정 적용 대상은 전국 공통 여비표를 먼저 적용합니다. 실제 지급 전에는 출장시간, 운임 증빙, 식사 제공 여부, 숙박 필요 여부를 확인하면 됩니다."
            : "공립 교원 등 공무원 여비 규정 적용 대상은 전국 공통 여비표를 먼저 적용합니다. 실제 지급 전에는 근무지 내·외 구분, 출장시간, 공용차량 이용, 식사 제공 여부만 확인하면 됩니다."
    };
  }

  function buildDomesticTravelLead(profile, leadDestinationText, itemLabel, travelScope = {}) {
    if (travelScope.status === "outsideConfirmed") {
      return `${profile.subjectLabel}의 ${leadDestinationText} ${itemLabel}${getTopicParticle(itemLabel)} ${travelScope.originLabel}에서 ${travelScope.destinationLabel}로 이동하는 근무지 외 국내출장 기준으로 공무원 여비 규정 제16조와 별표 2를 적용합니다.`;
    }

    if (travelScope.status === "workplaceConfirmed") {
      return `${profile.subjectLabel}의 ${leadDestinationText} ${itemLabel}${getTopicParticle(itemLabel)} 근무지 내 국내출장 기준으로 공무원 여비 규정 제18조의 4시간 기준 정액을 먼저 적용합니다.`;
    }

    return `${profile.subjectLabel}의 ${leadDestinationText} ${itemLabel}${getTopicParticle(itemLabel)} 먼저 근무지 내 출장인지, 근무지 외 국내출장인지 가른 뒤 공무원 여비 규정 제16조·제18조와 별표 2를 적용합니다.`;
  }

  function inferDomesticTravelScope(question = "", normalized = compactText(question), destination = {}, intent = {}) {
    if (intent.isWorkplaceTravel) {
      return {
        status: "workplaceConfirmed",
        originLabel: "",
        destinationLabel: destination.label || ""
      };
    }

    const destinationLabel = destination.label || "";
    if (!destinationLabel || destinationLabel === "지역 미특정") {
      return { status: "unknown", originLabel: "", destinationLabel };
    }

    const originLabel = inferTravelOriginName(question, normalized);
    if (originLabel && !isSameTravelArea(originLabel, destinationLabel)) {
      return {
        status: "outsideConfirmed",
        originLabel,
        destinationLabel
      };
    }

    return { status: "unknown", originLabel, destinationLabel };
  }

  function inferTravelOriginName(question = "", normalized = compactText(question)) {
    const text = String(question || "").replace(/\s+/g, " ").trim();
    const patterns = [
      /([가-힣]{2,10})(시|군|구)?\s*소재/,
      /([가-힣]{2,10})(시|군|구)?\s*에\s*(?:있는|소재한)/,
      /([가-힣]{2,10})(시|군|구)?\s*(?:학교|초|중|고|특수학교)의?\s*(?:교장|학교장|교사|교원)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      const label = normalizeTravelDestinationName(match?.[1], match?.[2]);
      if (label) return label;
    }

    const compactPatterns = [
      /([가-힣]{2,10})(시|군|구)?소재/,
      /([가-힣]{2,10})(시|군|구)?에(?:있는|소재한)/
    ];

    for (const pattern of compactPatterns) {
      const match = normalized.match(pattern);
      const label = normalizeTravelDestinationName(match?.[1], match?.[2]);
      if (label) return label;
    }

    return "";
  }

  function isSameTravelArea(originLabel = "", destinationLabel = "") {
    const origin = normalizeTravelAreaForCompare(originLabel);
    const destination = normalizeTravelAreaForCompare(destinationLabel);
    return Boolean(origin && destination && origin === destination);
  }

  function normalizeTravelAreaForCompare(label = "") {
    return String(label || "")
      .replace(/특별자치도|특별자치시|특별시|광역시|자치시|자치도|시|군|구|도/g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  function buildInstructorHonorariumResponse(analysis, { officeLabel = "소속 교육청", roleLabel = "", lookup = null } = {}) {
    const normalized = analysis.normalized || compactText(analysis.question);
    const frame = lookup?.semanticFrame || analysis.semanticFrame || buildPolicySemanticFrame(analysis.question || "");
    const slots = frame.slots || {};
    const profile = slots.instructorProfile?.detected
      ? slots.instructorProfile
      : inferInstructorHonorariumProfile(normalized);
    const duration = slots.lectureDuration?.detected
      ? slots.lectureDuration
      : inferLectureDuration(normalized);
    const officeCode = slots.office?.detected
      ? slots.office.code
      : inferHonorariumOfficeCodeFromLabel(officeLabel);
    const officeText = slots.office?.detected ? slots.office.label : officeLabel || "소속 교육청";
    const table = getInstructorRateTableForOffice(officeCode);
    const defaultTable = getInstructorDefaultRateTable();
    const exactRate = table?.profiles?.[profile.rateProfileKey] || null;
    const defaultRate = defaultTable?.profiles?.[profile.rateProfileKey] || null;
    const hasExactRate = Boolean(table && exactRate);
    const hasDefaultExample = !hasExactRate && !officeCode && Boolean(defaultTable && defaultRate);
    const activeTable = hasExactRate ? table : hasDefaultExample ? defaultTable : null;
    const activeRate = hasExactRate ? exactRate : hasDefaultExample ? defaultRate : null;
    const hours = duration.hours;
    const hasHours = Number.isFinite(hours) && hours > 0;
    const total = activeRate && hasHours ? calculateInstructorFee(activeRate, hours) : null;
    const feeLabel = inferInstructorFeeLabel(normalized);
    const amountText = activeRate && hasHours
      ? `${formatHours(hours)} ${feeLabel}는 ${formatWon(total)}`
      : activeRate
        ? `기본 1시간 ${formatWon(activeRate.base)}, 초과시간당 ${formatWon(activeRate.extra)}`
        : "강사 등급과 기본·초과시간 단가 확인";
    const rateText = activeRate
      ? `기본 1시간 ${formatWon(activeRate.base)}, 초과시간당 ${formatWon(activeRate.extra)}`
      : "교육청별 기본·초과시간 단가";
    const primaryAnswer = buildInstructorHonorariumPrimaryAnswer({
      profile,
      duration,
      officeText,
      table,
      defaultTable,
      activeRate,
      amountText,
      hasExactRate,
      hasDefaultExample
    });
    const calculation = activeRate && hasHours
      ? `산출식은 기본 1시간 ${formatWon(activeRate.base)} + 초과 ${formatHours(Math.max(0, hours - 1))} x ${formatWon(activeRate.extra)} = ${formatWon(total)}입니다.`
      : "";
    const tableLabel = activeTable
      ? `${activeTable.officeLabel} ${activeTable.title}`
      : `${officeText} 해당 학년도 학교회계 예산편성 기본지침 교육 강사수당 표`;
    const subjectLabel = profile.subjectLabel || roleLabel || "강사";
    const privateSchoolCaveat = /사립학교|학교법인/.test(roleLabel)
      ? "사립학교는 공립학교회계 지침을 그대로 적용하는지보다 학교법인·학교 내부 강사수당 지급 기준의 준용 여부를 먼저 확인해야 합니다."
      : "";

    return {
      engineVersion: VERSION,
      domain: "schoolInstructorHonorarium",
      categoryCode: "budgetExecution",
      roleCode: profile.roleCode || "auto",
      roleLabel: subjectLabel,
      title: `${subjectLabel} 강사수당·강사료 확인 기준`,
      lead: `${subjectLabel} ${feeLabel}는 강사 선발·프로그램 운영 사안이 아니라 교육청별 학교회계 예산편성 기본지침의 교육 강사수당 표에서 등급과 강의시간을 대조하는 사안입니다.`,
      sourcePriority: "office",
      sourceKeys: lookup?.sourceKeys || HONORARIUM.sourceKeys || ["schoolAccountingRule", "publicRecords"],
      ruleLookup: lookup,
      answer: uniqueStrings([
        primaryAnswer,
        activeRate ? `${profile.subjectLabel}은 ${activeRate.grade}로 보며, ${rateText}을 적용합니다.` : "",
        calculation,
        activeRate?.basis ? `${activeRate.grade} 판단 근거는 ${activeRate.basis}` : "",
        `확인할 직접 자료는 ${tableLabel}입니다.`,
        "이 질문의 핵심 슬롯은 강사 신분, 강사 등급, 강의시간, 소속 교육청 단가표입니다.",
        "특별강사 인정은 직위명만으로 단정하지 말고 학교장 인정 사유, 강의 주제의 전문성, 내부 결재 근거를 함께 남겨야 합니다.",
        privateSchoolCaveat,
        "당해 기관 소속 공무원이 자기 업무와 관련해 소속 기관에서 교육하거나 교관요원으로 지정된 자체교육 강사인 경우에는 강사수당 미지급 예외가 있을 수 있습니다.",
        frame.missingSlots?.includes("office") ? "교육청별 단가표가 다를 수 있으므로 소속 교육청이 확인되면 같은 등급·시간 슬롯으로 해당 교육청 표를 다시 조회합니다." : ""
      ]),
      steps: uniqueStrings([
        "질문을 교육 강사수당·강사료 지급 단가 사안으로 분류",
        "강사의 현재·전직 신분, 직위, 강의 주제 전문성으로 일반강사·특별강사 등급 확인",
        "소속 교육청과 해당 학년도 학교회계 예산편성 기본지침 교육 강사수당 표 조회",
        hasHours ? `${formatHours(hours)}을 기본 1시간과 초과시간으로 나누어 산출` : "총 강의시간과 시간당 단가 질문인지 확인",
        "품의서에 강사 등급, 기본·초과시간 단가, 강의시간, 지급 예외 검토 결과 기재",
        "청탁금지법상 외부강의등 사례금 상한과 학교 내부 지급 기준이 더 엄격한지 대조"
      ]),
      queries: uniqueStrings([
        ...((lookup?.corpusMatches || []).map((match) => match.query || match.title).filter(Boolean)),
        `${officeText} 학교회계 예산편성 기본지침 교육 강사수당`,
        `${subjectLabel} ${profile.grade || "강사 등급"} ${feeLabel} ${duration.label || "1시간"}`,
        "교육 강사수당 일반강사 특별강사 기본 1시간 초과시간",
        "청탁금지법 외부강의등 사례금 상한 학교 강사수당"
      ]),
      caution: frame.missingSlots?.includes("office")
        ? "소속 교육청이 없으면 전국 공통 정액처럼 단정하면 안 됩니다. 답변은 확인된 로컬 단가표의 조건부 예시와, 소속 교육청 표로 재조회해야 할 항목을 분리해 제시합니다."
        : "강사수당은 교육청별 예산편성 지침, 학교 내부 결재 기준, 강사 등급 인정 사유, 강의시간 산정 방식이 함께 맞아야 확정됩니다."
    };
  }

  function buildInstructorHonorariumPrimaryAnswer({ profile, duration, officeText, table, defaultTable, activeRate, amountText, hasExactRate, hasDefaultExample }) {
    if (!profile.detected || !activeRate) {
      return `${profile.subjectLabel || "강사"}의 강사비는 ${officeText} 해당 학년도 교육 강사수당 표에서 강사 등급과 기본·초과시간 단가를 먼저 확인해야 합니다.`;
    }
    if (hasExactRate) {
      return `${table.officeLabel} ${table.fiscalYear} 기준으로 ${profile.subjectLabel}은 ${activeRate.grade}이며 ${amountText}입니다.`;
    }
    if (hasDefaultExample) {
      return `소속 교육청이 미선택이면 전국 공통 금액으로 단정할 수 없습니다. 다만 확인된 ${defaultTable.officeLabel} ${defaultTable.fiscalYear} 기준으로 ${profile.subjectLabel}은 ${activeRate.grade}이며 ${amountText}입니다.`;
    }
    return `${profile.subjectLabel}은 ${profile.grade || "강사 등급"} 후보입니다. ${officeText} 교육 강사수당 표의 기본·초과시간 단가를 조회해야 최종 강사비를 확정할 수 있습니다.`;
  }

  function parseDomesticTravelIntent(question = "", normalized = compactText(question), semanticFrame = null) {
    const domain = KB.domains?.domesticTravelExpense;
    const intentKeywords = domain?.intentKeywords || ["출장", "관외", "국내여비", "국내출장", "여비", "출장비", "숙박비", "숙박", "숙소", "호텔", "일비", "식비", "식대", "일당", "밥값", "운임", "교통비"];
    if (!intentKeywords.some((keyword) => normalized.includes(keyword))) return null;
    const slots = semanticFrame?.slots || {};
    return {
      type: "domesticTravelExpense",
      taskCode: semanticFrame?.task?.code || "unknown",
      expenseItems: slots.expenseItems || inferTravelExpenseItems(normalized),
      destination: slots.destination || inferDomesticTravelDestination(question, normalized),
      duration: slots.duration || inferTravelDuration(normalized),
      isWorkplaceTravel: slots.workplaceTravel ?? (TRAVEL.workplaceTravelPattern || /근무지내|근무지안|관내출장|같은시|같은군|동일시|동일군|12km|12킬로|4시간|네시간|당일관내/).test(normalized),
      institution: slots.institution || inferInstitutionName(question, normalized),
      profile: slots.travelerRole || inferDomesticTravelProfile(normalized)
    };
  }

  function inferPolicySubjectProfile(normalized = "") {
    const profiles = [
      { code: "industryPartner", roleCode: "company", roleLabel: "산업체·기업", subjectLabel: "산업체·기업", patterns: [/산업체|기업|회사|사업장|참여기업|선도기업|실습기업|채용기관/] },
      { code: "careerTeacher", roleCode: "teacher", roleLabel: "취업부·직업교육 담당교사", subjectLabel: "취업부·직업교육 담당교사", patterns: [/취업부|직업교육부|현장실습담당|도제담당|산학협력담당/] },
      { code: "graduate", roleCode: "student", roleLabel: "졸업생", subjectLabel: "졸업생", patterns: [/졸업생|졸업예정자|졸업예정학생/] },
      { code: "student", roleCode: "student", roleLabel: "학생", subjectLabel: "학생", patterns: [/피해학생|가해학생|장애학생|현장실습생|학생/] },
      { code: "parent", roleCode: "parent", roleLabel: "학부모·보호자", subjectLabel: "학부모·보호자", patterns: [/학부모|보호자/] },
      { code: "principal", roleCode: "teacher", roleLabel: "교장", subjectLabel: "교장", patterns: [/교장|학교장|원장/] },
      { code: "vicePrincipal", roleCode: "teacher", roleLabel: "교감", subjectLabel: "교감", patterns: [/교감/] },
      { code: "fixedTermTeacher", roleCode: "teacher", roleLabel: "기간제교사", subjectLabel: "기간제교사", patterns: [/기간제교사|기간제교원/] },
      { code: "regularTeacher", roleCode: "teacher", roleLabel: "정규교사", subjectLabel: "정규교사", patterns: [/정규교사|정규교원|정교사/] },
      { code: "teacher", roleCode: "teacher", roleLabel: "교원", subjectLabel: "교원", patterns: [/교사|교원|담임|선생님|선생|장학사|교육연구사/] },
      { code: "localOfficer", roleCode: "localOfficer", roleLabel: "지방공무원·행정직", subjectLabel: "지방공무원·행정직", patterns: [/지방공무원|행정직|행정실|교육행정|일반직/] },
      { code: "educationStaff", roleCode: "staff", roleLabel: "교육공무직", subjectLabel: "교육공무직", patterns: [/교육공무직|공무직|조리실무|돌봄전담|특수교육실무|당직|청소원/] },
      { code: "privateSchoolStaff", roleCode: "privateSchool", roleLabel: "사립학교 교직원", subjectLabel: "사립학교 교직원", patterns: [/사립|학교법인|법인/] },
      { code: "schoolStaff", roleCode: "staff", roleLabel: "교직원", subjectLabel: "교직원", patterns: [/교직원|직원/] }
    ];
    if (isStaffOvertimeQuestion(normalized)) {
      const staffFound = profiles
        .filter((profile) => profile.code !== "student" && ["teacher", "localOfficer", "staff", "privateSchool"].includes(profile.roleCode))
        .find((profile) => profile.patterns.some((pattern) => pattern.test(normalized)));
      if (staffFound) return { ...staffFound, detected: true };
    }
    const found = profiles.find((profile) => profile.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", roleCode: "auto", roleLabel: "신분 확인 필요", subjectLabel: "대상자", detected: false };
  }

  function inferInstructorHonorariumProfile(normalized = "") {
    const rules = [
      {
        code: "special2",
        rateProfileKey: "special2",
        roleCode: "expert",
        patterns: [/교육감|장관|차관|국회의원|대학총장|정부출연연구기관장|국영기업체장|인간문화재|유명예술인|특별강사2/]
      },
      {
        code: "general1",
        rateProfileKey: "general1",
        roleCode: "teacher",
        patterns: [/전직교장|퇴직교장|교장|학교장|유초중등학교장|유·초·중등학교장|장학관|교육연구관|4급|박사|일반강사1/]
      },
      {
        code: "general2",
        rateProfileKey: "general2",
        roleCode: "teacher",
        patterns: [/전직교감|퇴직교감|교감|전직교사|퇴직교사|교사|교원|교육공무원|장학사|교육연구사|5급|6급|7급|8급|9급|대학전임강사|전임강사|시간강사|원어민|일반강사2/]
      },
      {
        code: "general3",
        rateProfileKey: "general3",
        roleCode: "expert",
        patterns: [/전산강사|컴퓨터강사|외국어강사|체육강사|일반강사3/]
      }
    ];
    const found = rules.find((rule) => rule.patterns.some((pattern) => pattern.test(normalized)));
    if (!found) {
      return {
        code: "unknown",
        rateProfileKey: "",
        roleCode: "auto",
        roleLabel: "강사",
        subjectLabel: "강사",
        grade: "",
        detected: false
      };
    }
    const rate = getInstructorDefaultRateTable()?.profiles?.[found.rateProfileKey] || {};
    return {
      ...found,
      roleLabel: inferInstructorSubjectLabel(normalized),
      subjectLabel: inferInstructorSubjectLabel(normalized),
      grade: rate.grade || "",
      detected: true
    };
  }

  function inferInstructorSubjectLabel(normalized = "") {
    if (/전직교장|퇴직교장/.test(normalized)) return "전직 교장";
    if (/교장|학교장|유초중등학교장|유·초·중등학교장/.test(normalized)) return "교장";
    if (/전직교감|퇴직교감/.test(normalized)) return "전직 교감";
    if (/교감/.test(normalized)) return "교감";
    if (/전직교사|퇴직교사|전직교원|퇴직교원/.test(normalized)) return "전직 교원";
    if (/교사|교원/.test(normalized)) return "교원";
    if (/장학관/.test(normalized)) return "장학관";
    if (/교육연구관/.test(normalized)) return "교육연구관";
    if (/장학사/.test(normalized)) return "장학사";
    if (/교육연구사/.test(normalized)) return "교육연구사";
    if (/대학전임강사|전임강사/.test(normalized)) return "대학 전임강사";
    if (/시간강사/.test(normalized)) return "대학 시간강사";
    if (/교육감/.test(normalized)) return "교육감";
    if (/대학총장/.test(normalized)) return "대학 총장급 강사";
    if (/전산강사|컴퓨터강사/.test(normalized)) return "전산강사";
    if (/외국어강사/.test(normalized)) return "외국어강사";
    if (/체육강사/.test(normalized)) return "체육강사";
    return "강사";
  }

  function inferLectureDuration(normalized = "") {
    if (/초과시간당|초과단가|초과시간/.test(normalized) && !/\d+(?:\.\d+)?시간/.test(normalized)) {
      return { hours: null, label: "초과시간당", rateMode: "extra", detected: true };
    }
    const numericMatch = normalized.match(/(\d+(?:\.\d+)?)시간/);
    if (numericMatch) {
      const hours = Number(numericMatch[1]);
      return { hours, label: formatHours(hours), rateMode: hours <= 1 ? "base" : "total", detected: true };
    }
    const koreanNumbers = {
      한: 1,
      두: 2,
      세: 3,
      네: 4,
      다섯: 5,
      여섯: 6
    };
    for (const [word, value] of Object.entries(koreanNumbers)) {
      if (new RegExp(`${word}시간`).test(normalized)) {
        return { hours: value, label: formatHours(value), rateMode: value <= 1 ? "base" : "total", detected: true };
      }
    }
    if (/시간당|기본1시간|기본시간/.test(normalized)) {
      return { hours: 1, label: "1시간 기준", rateMode: "base", detected: true };
    }
    return { hours: null, label: "", rateMode: "", detected: false };
  }

  function inferInstructorFeeLabel(normalized = "") {
    if (/강의비|강의료/.test(normalized)) return "강의비";
    if (/강사료/.test(normalized)) return "강사료";
    if (/강사수당/.test(normalized)) return "강사수당";
    return "강사비";
  }

  function inferEmploymentType(normalized = "") {
    const types = [
      { code: "fixedTerm", label: "기간제", patterns: [/기간제|계약제|계약직/] },
      { code: "educationStaff", label: "교육공무직", patterns: [/교육공무직|공무직|조리실무|돌봄전담|특수교육실무/] },
      { code: "privateSchool", label: "사립학교 교직원", patterns: [/사립|학교법인|법인/] },
      { code: "publicTeacher", label: "공립 교원", patterns: [/공립.*교원|공립.*교사|정규교사|정규교원|정교사|교원|교사|교장|교감/] },
      { code: "localOfficer", label: "지방공무원·행정직", patterns: [/지방공무원|행정직|교육행정|행정실|일반직/] }
    ];
    const found = types.find((type) => type.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferFamilyRelation(normalized = "") {
    const relations = [
      { code: "spouseUncleAunt", label: "배우자의 삼촌·숙부·이모 등 방계친족", leaveDays: 0, listed: false, patterns: [/배우자.*(?:삼촌|숙부|백부|외삼촌|고모|이모|큰아버지|작은아버지|큰어머니|작은어머니|외숙모)/] },
      { code: "spouseParent", label: "배우자의 부모", leaveDays: 5, listed: true, patterns: [/배우자.*(?:부모|부친|모친|아버지|어머니)|장인|장모|시부|시모/] },
      { code: "spouseGrandParent", label: "배우자의 조부모·외조부모", leaveDays: 3, listed: true, patterns: [/배우자.*(?:조부모|외조부모|할아버지|할머니|외조부|외조모)/] },
      { code: "spouseSibling", label: "배우자의 형제자매", leaveDays: 1, listed: true, patterns: [/배우자.*(?:형제|자매|오빠|언니|누나|동생|형|누이)/] },
      { code: "spouseChild", label: "배우자의 자녀", leaveDays: 3, listed: true, legalCondition: "법적으로 본인의 자녀 관계가 확인되는 경우", patterns: [/배우자.*(?:자녀|아들|딸)/] },
      { code: "parent", label: "본인 부모", leaveDays: 5, listed: true, patterns: [/부모상|본인부모|부친|모친|아버지|어머니/] },
      { code: "spouse", label: "배우자", leaveDays: 5, listed: true, patterns: [/배우자상|배우자사망|배우자가사망|남편상|아내상|남편.*사망|아내.*사망/] },
      { code: "childSpouse", label: "자녀의 배우자", leaveDays: 3, listed: true, patterns: [/자녀.*배우자|아들.*배우자|딸.*배우자|사위|며느리/] },
      { code: "child", label: "자녀", leaveDays: 3, listed: true, patterns: [/자녀|아들|딸/] },
      { code: "grandParent", label: "조부모·외조부모", leaveDays: 3, listed: true, patterns: [/조부모|할아버지|할머니|외조부|외조모/] },
      { code: "sibling", label: "형제자매", leaveDays: 1, listed: true, patterns: [/형제|자매|오빠|언니|누나|동생|형|누이/] },
      { code: "uncleAunt", label: "삼촌·숙부·이모 등 방계친족", leaveDays: 0, listed: false, patterns: [/삼촌|숙부|백부|외삼촌|고모|이모|큰아버지|작은아버지|큰어머니|작은어머니|외숙모/] }
    ];
    const found = relations.find((relation) => relation.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferDateRange(normalized = "") {
    const overnight = normalized.match(/(\d+)박(\d+)일/);
    if (overnight) return { label: `${overnight[1]}박 ${overnight[2]}일`, days: Number(overnight[2]), detected: true };
    const days = normalized.match(/(\d+)일(?!당)/);
    if (days) return { label: `${days[1]}일`, days: Number(days[1]), detected: true };
    const date = normalized.match(/(20\d{2})[.\-년]?(\d{1,2})[.\-월]?(\d{1,2})?/);
    if (date) return { label: date[0], detected: true };
    if (/당일|오늘|내일|어제|이번주|다음주|이번달|다음달/.test(normalized)) return { label: "상대 날짜", detected: true };
    return { label: "", detected: false };
  }

  function inferServiceIssue(normalized = "") {
    if (isSpouseChildbirthLeaveContext(normalized)) {
      return { code: "spouseChildbirthLeave", label: "배우자 출산휴가", detected: true };
    }
    const issues = [
      { code: "sickLeave", label: "병가", patterns: [/병가|질병|진단서|요양|입원|통원/] },
      { code: "officialLeave", label: "공가", patterns: [/공가|공무상|예비군|민방위|건강검진/] },
      { code: "spouseChildbirthLeave", label: "배우자 출산휴가", patterns: [/(?:배우자|남편|아내).{0,16}출산|출산.{0,16}(?:배우자|남편|아내)|배우자출산휴가/, /(?:남자|남성|아빠|아버지|부친).{0,24}(?:교사|교원|선생님|교직원|공무원)?.{0,24}출산휴가/, /(?:교사|교원|선생님|교직원|공무원).{0,24}(?:남자|남성|아빠|아버지|부친).{0,24}출산휴가/] },
      { code: "specialLeave", label: "특별휴가", patterns: [/특별휴가|경조사|출산|출산휴가|육아시간|모성보호|부성보호/] },
      { code: "annualLeave", label: "연가", patterns: [/연가|연차/] },
      { code: "leaveGeneral", label: "휴가", patterns: [/휴가|휴가규정/] },
      { code: "tardyEarlyLeave", label: "지각·조퇴·외출", patterns: [/지각|조퇴|외출/] },
      { code: "overtime", label: "초과근무", patterns: [/초과근무|시간외|야근|휴일근무/] },
      { code: "workAssignment", label: "업무분장", patterns: [/업무분장|업무배정|행사업무|수업외|업무가많/] },
      { code: "attendanceRecord", label: "근무상황·나이스 처리", patterns: [/근무상황|나이스|NEIS|상신|승인|결재/] },
      { code: "serviceEvaluation", label: "복무평가", patterns: [/복무평가|근무평가|계약연장|재계약|불이익|평가/] },
      { code: "serviceGeneral", label: "복무·근태", patterns: [/복무|근태|근무시간|재택/] }
    ];
    const found = issues.find((issue) => issue.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferEvidence(normalized = "") {
    const evidence = [
      ["medicalCertificate", "진단서", /진단서|소견서|진료확인|입원확인|처방전/],
      ["evidenceDocument", "증빙자료", /증빙|첨부자료|제출자료|확인자료|필요서류|제출서류/],
      ["neis", "나이스 근무상황", /나이스|NEIS|근무상황|상신/],
      ["approval", "내부 결재", /결재|승인|품의|기안/],
      ["receipt", "영수증·카드전표", /영수증|카드전표|매출전표|현금영수증/],
      ["taxInvoice", "세금계산서", /세금계산서|계산서/],
      ["inspection", "검수조서", /검수조서|검수|납품확인|완료확인/],
      ["paymentResolution", "지출결의서", /지출결의|지출결의서/],
      ["contract", "계약·견적 자료", /계약서|견적서|수의계약|입찰/],
      ["officialDocument", "공문", /공문|문서|확인서/],
      ["consent", "동의서·신청서·보고서", /동의서|신청서|보고서|체험학습신청|체험학습보고/],
      ["meetingRecord", "회의록·위원회 기록", /회의록|위원회|심의록|전담기구/],
      ["counselingRecord", "상담기록·면담기록", /상담기록|면담기록|상담|면담/],
      ["mediaEvidence", getMediaEvidenceLabel(normalized), /사진|CCTV|씨씨티비|녹음|녹취|영상|캡처|스크린샷|카톡|메시지|문자/]
    ]
      .filter(([, , pattern]) => pattern.test(normalized))
      .map(([code, label]) => ({ code, label }));

    if (!evidence.length) return { code: "unknown", label: "", items: [], detected: false };
    return {
      code: evidence.map((item) => item.code).join("+"),
      label: evidence.map((item) => item.label).join("·"),
      items: evidence,
      detected: true
    };
  }

  function getMediaEvidenceLabel(normalized = "") {
    return buildEvidenceLabel([
      /문자|카톡|메시지|채팅|캡처|스크린샷/.test(normalized) ? "문자·카톡 캡처" : "",
      /녹음|녹취|통화녹음/.test(normalized) ? "녹음·녹취자료" : "",
      /사진|얼굴|촬영/.test(normalized) ? "사진·촬영자료" : "",
      /영상|동영상|CCTV|씨씨티비|녹화/i.test(normalized) ? "영상·CCTV자료" : ""
    ], "디지털 증거자료");
  }

  function inferEducationOffice(normalized = "") {
    const offices = [
      ["seoul", "서울특별시교육청", /서울/],
      ["busan", "부산광역시교육청", /부산/],
      ["daegu", "대구광역시교육청", /대구/],
      ["incheon", "인천광역시교육청", /인천/],
      ["gwangju", "광주광역시교육청", /광주/],
      ["daejeon", "대전광역시교육청", /대전/],
      ["ulsan", "울산광역시교육청", /울산/],
      ["sejong", "세종특별자치시교육청", /세종/],
      ["gyeonggi", "경기도교육청", /경기/],
      ["gangwon", "강원특별자치도교육청", /강원/],
      ["chungbuk", "충청북도교육청", /충북|충청북도/],
      ["chungnam", "충청남도교육청", /충남|충청남도/],
      ["jeonbuk", "전북특별자치도교육청", /전북|전라북도/],
      ["jeonnam", "전라남도교육청", /전남|전라남도/],
      ["gyeongbuk", "경상북도교육청", /경북|경상북도/],
      ["gyeongnam", "경상남도교육청", /경남|경상남도/],
      ["jeju", "제주특별자치도교육청", /제주/]
    ];
    const found = offices.find(([, , pattern]) => pattern.test(normalized));
    if (found?.[0] === "daejeon" && /휴대전화|휴대전화를|휴대폰/.test(normalized) && !/대전광역시|대전교육청|대전시교육청/.test(normalized)) {
      return { code: "unknown", label: "", detected: false };
    }
    if (found) return { code: found[0], label: found[1], detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferFiscalYear(normalized = "") {
    const year = normalized.match(/(20\d{2})(?:학년도|년도|년)?/);
    if (year) return { year: Number(year[1]), label: `${year[1]}학년도`, detected: true };
    if (/해당학년도|당해연도|당해학년도|올해|금년|이번학년도/.test(normalized)) {
      return { year: null, label: "해당 학년도", detected: true };
    }
    return { year: null, label: "", detected: false };
  }

  function inferSpendingType(normalized = "") {
    const types = [
      { code: "instructorFee", label: "강사수당·강사료", patterns: [/강사수당|강사료|강사비|강의비|강의료|외부강사|교육강사|강의/] },
      { code: "businessPromotion", label: "업무추진비·협의회비", patterns: [/업무추진비|협의회|간담회|접대|식비/] },
      { code: "contract", label: "계약·검수", patterns: [/계약|수의계약|입찰|견적|검수/] },
      { code: "goods", label: "물품 구입", patterns: [/물품|구입|구매|비품|소모품/] },
      { code: "service", label: "용역", patterns: [/용역|위탁/] },
      { code: "construction", label: "공사", patterns: [/공사|시설|수선|보수/] },
      { code: "evidence", label: "지출 증빙", patterns: [/지출증빙|증빙|영수증|카드전표|세금계산서|지출결의/] },
      { code: "budgetPlanning", label: "예산 편성", patterns: [/예산편성|편성|본예산|추경|예산요구/] },
      { code: "budgetGeneral", label: "학교회계 예산·지출", patterns: [/예산|지출|집행/] }
    ];
    const found = types.find((type) => type.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferProcedureStage(normalized = "") {
    const stages = [
      { code: "budgetPlanning", label: "예산 편성", patterns: [/예산편성|편성|본예산|추경|예산요구/] },
      { code: "draftApproval", label: "품의·기안", patterns: [/품의|기안|결재/] },
      { code: "contract", label: "계약", patterns: [/계약|수의계약|입찰|견적/] },
      { code: "inspection", label: "검수", patterns: [/검수|납품|완료확인/] },
      { code: "spending", label: "지출", patterns: [/지출|집행|지급|지출결의/] },
      { code: "settlement", label: "정산", patterns: [/정산|반납|잔액/] },
      { code: "evidence", label: "증빙 확인", patterns: [/증빙|영수증|카드전표|세금계산서/] }
    ];
    const found = stages.find((stage) => stage.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferUniversalProcedureStage(normalized = "") {
    const stages = [
      { code: "report", label: "신고·접수", patterns: [/신고|접수|제보|민원접수|국민신문고/] },
      { code: "factFinding", label: "사실확인·조사", patterns: [/사실확인|조사|확인|면담|상담|경위|진술|증거/] },
      { code: "protection", label: "긴급 보호·안전 조치", patterns: [/보호조치|분리|긴급|안전|응급|119|병원|보건실/] },
      { code: "committee", label: "위원회·심의", patterns: [/위원회|심의|전담기구|학업성적관리위원회|급식소위원회|운영위원회/] },
      { code: "approval", label: "신청·승인", patterns: [/신청|승인|허가|동의|학교장승인|보고서/] },
      { code: "notice", label: "안내·통지", patterns: [/안내|통지|가정통신문|답변서|문구|공지/] },
      { code: "appeal", label: "이의신청·불복", patterns: [/이의|불복|재심|행정심판|소송|고소|고발/] },
      { code: "recordCorrection", label: "기록·정정", patterns: [/기록|정정|수정|삭제|보존|생활기록부|학생부|출결/] },
      { code: "operation", label: "운영 기준 확인", patterns: [/운영|배정|선정|편성|계획|규정|기준|처리/] }
    ];
    const found = stages.find((stage) => stage.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferSchoolLevel(normalized = "") {
    const levels = [
      { code: "kindergarten", label: "유치원", patterns: [/유치원|유아/] },
      { code: "elementary", label: "초등학교", patterns: [/초등학교|초등|초\d/] },
      { code: "middle", label: "중학교", patterns: [/중학교|중등|중\d/] },
      { code: "high", label: "고등학교", patterns: [/고등학교|고등|고\d|특성화고|마이스터고/] },
      { code: "special", label: "특수학교", patterns: [/특수학교/] }
    ];
    const found = levels.find((level) => level.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferSchoolRule(normalized = "") {
    const rules = [
      { code: "fieldTrainingRule", label: "현장실습 운영계획·협약서", patterns: [/현장실습|도제학교|일학습병행|표준협약|실습협약|선도기업|참여기업|기업현장교사/] },
      { code: "curriculumRule", label: "교육과정 편성·학업성적관리 기준", patterns: [/교육과정|ncs|전문교과|실무과목|학점제|공동교육과정|졸업|전입학|편입학/i] },
      { code: "labSafetyRule", label: "실험실습실 안전관리 기준", patterns: [/실습실|실험실|기자재|실습재료|보호구|msds|화학물질|위험기계/i] },
      { code: "welfareRule", label: "장학·교육복지·수익자부담 기준", patterns: [/장학금|교육비|교육급여|수익자부담|자유수강권|교복|기숙사비|환불/] },
      { code: "teacherRightsRule", label: "교육활동 보호 기준", patterns: [/교권|교육활동침해|교원치유|교권보호위원회|악성민원/] },
      { code: "facilitySecurityRule", label: "시설·정보보안·개인정보 기준", patterns: [/시설|cctv|영상정보|개인정보|정보보안|나이스|k-?에듀파인|스마트기기|와이파이/i] },
      { code: "governanceRule", label: "학교운영위원회·위원회 규정", patterns: [/학교운영위원회|운영위원회|규정개정|학칙개정|위원회|회의록/] },
      { code: "studentLifeRule", label: "학교생활규정·학생생활규정", patterns: [/학교생활규정|학생생활규정|생활규정|생활지도|학칙|학생인권|휴대전화|휴대폰/] },
      { code: "dormitoryRule", label: "기숙사 운영규정", patterns: [/기숙사|생활관|입사|퇴사|호실|점호|외박|벌점/] },
      { code: "academicManagementRule", label: "학업성적관리규정", patterns: [/학업성적관리|평가|시험|성적|부정행위|이의신청|채점/] },
      { code: "mealOperationRule", label: "급식 운영 기준", patterns: [/급식|식단|보존식|검식|식중독|알레르기|위생/] },
      { code: "fieldLearningRule", label: "체험학습 운영 지침", patterns: [/체험학습|교외체험학습|현장체험학습|수학여행|수련활동/] },
      { code: "schoolViolenceGuide", label: "학교폭력 사안처리 지침", patterns: [/학교폭력|학폭|전담기구|피해학생|가해학생|보호조치/] }
    ];
    const found = rules.find((rule) => rule.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferRiskSignal(normalized = "") {
    let risks = [
      ["safety", "안전·응급 위험", /안전|위험|사고|응급|119|병원|치료|보건|감염병|식중독|중대재해|실습실|기계|화학물질|msds|보호구|석면|소방|전기/i],
      ["violence", "학교폭력·보복 위험", /학교폭력|학폭|폭행|따돌림|욕설|보복|사이버폭력|명예훼손/],
      ["rights", "학생 인권·생활지도 민원", /인권|아동학대|생활지도|휴대전화|훈육|자리이동|수업방해/],
      ["privacy", "개인정보·기록 공개 위험", /개인정보|민감정보|상담내용|정보공개|비공개|cctv|녹음|사진/i],
      ["discrimination", "차별·불이익 주장", /차별|불리|불이익|배정|선발|특정학과|장애학생/],
      ["legalDispute", "형사·민사·불복 전환 가능성", /고소|고발|손해배상|벌금|형량|소송|행정심판|불복|이의신청/],
      ["civilComplaint", "민원·감사 전환 가능성", /민원|감사|교육청민원|국민신문고|항의|사과|면담/],
      ["labor", "근로조건·채용 위험", /임금체불|해고|권고사직|수습|근로계약|부당|야간|장시간|현장실습시간|실습수당/],
      ["selfHarm", "자해·자살 위험", /자살|자해|극단|위기학생|정서행동|정신건강/],
      ["facilitySecurity", "시설·정보보안 위험", /cctv|영상정보|정보보안|계정|개인정보유출|스마트기기|와이파이/i]
    ]
      .filter(([, , pattern]) => pattern.test(normalized))
      .map(([code, label]) => ({ code, label }));

    if (/식중독(?:은|는)?없|식중독아니|안전사고(?:는)?없|사고(?:는)?없|피해(?:는)?없|다친(?:것은|건)?아니|다치지않/.test(normalized)) {
      risks = risks.filter((risk) => risk.code !== "safety");
    }

    if (!risks.length) return { code: "unknown", label: "", items: [], detected: false };
    return {
      code: risks.map((item) => item.code).join("+"),
      label: risks.map((item) => item.label).join("·"),
      items: risks,
      detected: true
    };
  }

  function inferVocationalProgram(normalized = "") {
    const programs = [
      { code: "fieldTraining", label: "현장실습", patterns: [/현장실습|표준협약|실습협약|선도기업|참여기업|기업현장교사/] },
      { code: "apprenticeship", label: "도제학교·일학습병행", patterns: [/도제학교|일학습병행|기업훈련|학습근로/] },
      { code: "jobPlacement", label: "취업지도·채용연계", patterns: [/취업지도|추천채용|고졸채용|잡알리오|공채|채용공고/] },
      { code: "ncsCurriculum", label: "NCS·전문교과", patterns: [/ncs|전문교과|실무과목|직업계고학점제|고교학점제/i] },
      { code: "globalTraining", label: "글로벌 현장학습", patterns: [/글로벌현장학습|해외현장실습|해외현장학습/] }
    ];
    const found = programs.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferIndustryPartner(normalized = "") {
    const partners = [
      { code: "leadCompany", label: "선도기업", patterns: [/선도기업/] },
      { code: "participatingCompany", label: "참여기업·실습기업", patterns: [/참여기업|실습기업|현장실습기업/] },
      { code: "companyTrainer", label: "기업현장교사", patterns: [/기업현장교사|현장교사/] },
      { code: "employer", label: "채용기관·사업장", patterns: [/채용기관|산업체|기업|회사|사업장/] }
    ];
    const found = partners.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferCurriculumArea(normalized = "") {
    const areas = [
      { code: "ncs", label: "NCS·전문교과", patterns: [/ncs|전문교과|실무과목|직업기초능력/i] },
      { code: "creditSystem", label: "고교학점제·학점 이수", patterns: [/고교학점제|직업계고학점제|학점|이수단위|학점이수/] },
      { code: "academicRecord", label: "학적·졸업", patterns: [/학적|졸업|수료|자퇴|퇴학|유예|휴학|재입학|편입학|전입학/] },
      { code: "jointCurriculum", label: "공동교육과정", patterns: [/공동교육과정|학교밖교육|위탁교육/] },
      { code: "assessment", label: "평가·성적", patterns: [/평가|성적|수행평가|부정행위|학업성적관리/] }
    ];
    const found = areas.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferWelfareBenefit(normalized = "") {
    const benefits = [
      { code: "scholarship", label: "장학금", patterns: [/장학금|장학생/] },
      { code: "educationAid", label: "교육급여·교육비 지원", patterns: [/교육급여|교육비|저소득|지원금/] },
      { code: "studentCost", label: "수익자부담경비", patterns: [/수익자부담|학부모부담|징수|환불|정산/] },
      { code: "freeVoucher", label: "자유수강권", patterns: [/자유수강권/] },
      { code: "livingSupport", label: "기숙사비·급식비·통학비", patterns: [/기숙사비|급식비|통학비|교복비|교과서/] }
    ];
    const found = benefits.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferFacilityArea(normalized = "") {
    const areas = [
      { code: "practiceRoom", label: "실험실습실", patterns: [/실습실|실험실습실|실험실|실습장/] },
      { code: "equipment", label: "기자재·실습재료", patterns: [/기자재|실습재료|장비|공구|소모품/] },
      { code: "dormMeal", label: "기숙사·급식실", patterns: [/기숙사|생활관|급식실|조리실/] },
      { code: "facilityConstruction", label: "시설공사·안전점검", patterns: [/시설공사|석면|소방|전기|안전점검|공사/] },
      { code: "digitalDevice", label: "정보화기기·스마트기기", patterns: [/정보화기기|스마트기기|태블릿|노트북|와이파이/] },
      { code: "cctv", label: "CCTV·영상정보", patterns: [/cctv|영상정보|폐쇄회로/i] }
    ];
    const found = areas.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferDataSystem(normalized = "") {
    const systems = [
      { code: "neis", label: "나이스", patterns: [/나이스|neis/i] },
      { code: "kedufine", label: "K-에듀파인", patterns: [/k-?에듀파인|에듀파인/i] },
      { code: "privacy", label: "개인정보·영상정보", patterns: [/개인정보|영상정보|cctv|정보공개|민감정보/i] },
      { code: "accountSecurity", label: "계정·정보보안", patterns: [/계정|비밀번호|정보보안|접근권한|권한부여/] },
      { code: "deviceNetwork", label: "스마트기기·네트워크", patterns: [/스마트기기|태블릿|노트북|와이파이|무선망/] }
    ];
    const found = systems.find((item) => item.patterns.some((pattern) => pattern.test(normalized)));
    if (found) return { ...found, detected: true };
    return { code: "unknown", label: "", detected: false };
  }

  function inferTravelExpenseItems(normalized = "") {
    if (isFullTravelExpenseQuestion(normalized)) return ["daily", "meal", "lodging", "transport"];

    const items = [];
    const synonyms = TRAVEL.expenseSynonyms || {};
    if (hasAnyKeyword(normalized, synonyms.daily || ["일비", "일당", "출장일당", "하루일비"])) items.push("daily");
    if (hasAnyKeyword(normalized, synonyms.meal || ["식비", "식대", "식사", "밥값", "끼니"])) items.push("meal");
    if (hasAnyKeyword(normalized, synonyms.lodging || ["숙박비", "숙박", "숙소", "호텔", "1박", "박당", "숙소비", "방값"])) items.push("lodging");
    if (hasAnyKeyword(normalized, synonyms.transport || ["운임", "교통비", "철도", "항공", "버스", "자동차"])) items.push("transport");
    if (!items.length && /출장비|여비/.test(normalized)) return ["daily", "meal", "lodging", "transport"];
    return items.length ? items : ["general"];
  }

  function isFullTravelExpenseQuestion(normalized = "") {
    const keywords = TRAVEL.fullExpenseKeywords || ["출장비", "여비", "국내여비"];
    return keywords.some((keyword) => normalized.includes(keyword)) && !/(출장비|국내여비|여비)중/.test(normalized);
  }

  function hasAnyKeyword(normalized = "", keywords = []) {
    return keywords.some((keyword) => normalized.includes(keyword));
  }

  function inferTravelDuration(normalized = "") {
    const overnight = normalized.match(/(\d+)박(\d+)일/);
    if (overnight) {
      const nights = Number(overnight[1]);
      const days = Number(overnight[2]);
      return { days, nights, detected: true };
    }

    if (/당일/.test(normalized)) return { days: 1, nights: 0, detected: true };

    const daysOnly = normalized.match(/(\d+)일(?!당)/);
    if (daysOnly) {
      const days = Number(daysOnly[1]);
      return { days, nights: Math.max(days - 1, 0), detected: true };
    }

    return { days: 1, nights: 0, detected: false };
  }

  function inferDomesticTravelProfile(normalized = "", roleLabel = "", intent = null) {
    const isPrivateSchool = /사립|학교법인|법인/.test(normalized) || String(roleLabel).includes("사립학교");
    const byRole = subjectProfiles.find((profile) => roleLabel && (roleLabel.includes(profile.roleLabel) || roleLabel.includes(profile.subjectLabel)));
    const byText = subjectProfiles.find((profile) => (profile.patterns || []).some((pattern) => pattern.test(normalized)));
    const base = byText || byRole || intent?.profile || {
      code: "unknown",
      roleCode: "auto",
      roleLabel: "신분 확인 필요",
      subjectLabel: "출장자",
      gradeGroup: "지급등급 확인 필요",
      gradeDetail: "공무원 여비 규정 별표 1 또는 소속기관 여비 지침"
    };
    const subjectLabel = isPrivateSchool && base.privateSubjectLabel ? base.privateSubjectLabel : base.subjectLabel;
    return {
      ...base,
      subjectLabel,
      roleLabel: isPrivateSchool && base.privateSubjectLabel ? base.privateSubjectLabel : base.roleLabel || base.subjectLabel,
      privateSchoolBasis: isPrivateSchool && !base.localRuleFirst
        ? "사립학교 교원은 공무원 여비 규정 별표 9에서 국공립학교 교원의 여비 지급등급을 준용하도록 정리되어 있습니다."
        : ""
    };
  }

  function inferInstitutionName(question = "", normalized = compactText(question)) {
    const text = String(question || "").replace(/\s+/g, " ").trim();
    const match = text.match(/([가-힣A-Za-z0-9]{2,20}(?:초|중|고|학교|초등학교|중학교|고등학교|특수학교))/);
    if (!match) return { label: "", detected: false };
    const label = match[1].replace(/^(?:공립|사립)/, "");
    if (/(?:라고|하고|이고|다고|냐고)$/.test(label)) return { label: "", detected: false };
    if (/교사|교장|학교장|출장|여비|일비|식비|숙박/.test(label)) return { label: "", detected: false };
    return { label, detected: true };
  }

  function inferDomesticTravelDestination(question = "", normalized = compactText(question)) {
    const destinationName = inferTravelDestinationName(question, normalized);
    const destinationText = compactText(destinationName);
    const lodgingCaps = TRAVEL.lodgingCaps || {};
    if (/서울|서울특별시/.test(destinationText || normalized)) return { label: "서울특별시", cap: lodgingCaps.seoul, regionGroup: "seoul" };
    if (/부산|대구|인천|광주|대전|울산|세종|광역시/.test(destinationText || normalized)) {
      return { label: getCanonicalMetropolitanDestinationName(destinationName || destinationText) || "광역시", cap: lodgingCaps.metropolitan, regionGroup: "metropolitan" };
    }
    if (destinationName) return { label: destinationName, cap: lodgingCaps.other, regionGroup: "other" };
    if (/제주|경기|강원|충북|충청북도|충남|충청남도|전북|전라북도|전남|전라남도|경북|경상북도|경남|경상남도|도지역|그밖|그외|기타지역/.test(normalized)) {
      return { label: "그 밖의 지역", cap: lodgingCaps.other, regionGroup: "other" };
    }
    return { label: "지역 미특정", cap: null, regionGroup: "unknown" };
  }

  function inferTravelDestinationName(question = "", normalized = compactText(question)) {
    const text = String(question || "").replace(/\s+/g, " ").trim();
    const patterns = [
      /([가-힣]{2,10})(시|군|구)?\s*(?:으?로|에)\s*(?:\d+\s*박\s*\d+\s*일|\d+\s*일|당일)?\s*(?:근무지\s*외\s*)?(?:국내\s*)?(?:출장|출장을|출장비|여비)/,
      /(?:^|[\s,])([가-힣]{2,10})(시|군|구)?\s*(?:\d+\s*박\s*\d+\s*일|\d+\s*일|당일)?\s*(?:으?로|에|에서|의)?\s*(?:관외\s*)?출장/,
      /출장(?:지|장소|목적지)(?:는|은|:)?\s*([가-힣]{2,10})(시|군|구)?/,
      /([가-힣]{2,10})(시|군|구)?\s*(?:\d+\s*박\s*\d+\s*일|\d+\s*일|당일)?\s*(?:으?로|에)\s*(?:가면|갈|가는|다녀|출장)/,
      /([가-힣]{2,10})(시|군|구)?\s*(?:\d+\s*박\s*\d+\s*일|\d+\s*일|당일)?\s*(?:다녀오|다녀왔|출장가|출장을\s*가|출장\s*가)/
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const label = normalizeTravelDestinationName(match?.[1], match?.[2]);
      if (label) return label;
    }
    const withSuffix = normalized.match(/([가-힣]{2,10}(?:시|군|구))(?:\d+박\d+일|\d+일|당일)?(?:로|으로|에|에서|의)?(?:관외)?출장/);
    if (withSuffix) {
      const label = normalizeTravelDestinationName(withSuffix[1]);
      if (label) return label;
    }
    const toTravel = normalized.match(/([가-힣]{2,10}(?:시|군|구)?)(?:로|으로|에)(?:\d+박\d+일|\d+일|당일)?(?:근무지외)?(?:국내)?(?:출장|출장비|여비)/);
    if (toTravel) {
      const label = normalizeTravelDestinationName(toTravel[1]);
      if (label) return label;
    }
    const beforeTravel = normalized.match(/([가-힣]{2,12})(?:\d+박\d+일|\d+일|당일)?(?:로|으로|에|에서|의)?(?:관외)?출장/);
    const stripped = beforeTravel?.[1]
      ?.replace(/.*(?:교장|학교장|교감|교사|교원|행정직|공무원|교육공무직)의?/, "")
      ?.replace(/.*(?:사립학교|공립학교|학교)의?/, "");
    return normalizeTravelDestinationName(stripped);
  }

  function normalizeTravelDestinationName(name = "", suffix = "") {
    const raw = String(name || "").replace(/[^\uAC00-\uD7A3]/g, "").trim();
    if (!raw || raw.length < 2) return "";
    if ((TRAVEL.destinationBlockPattern || /출장|국내|관외|일비|식비|숙박|운임|교장|교사|교원|공무원|학교장|행정직|선생|대상|다녀|가면|가는|계산|얼마|인정/).test(raw)) return "";
    if (suffix) return `${raw}${suffix}`;
    if (/(특별시|광역시|특별자치시|특별자치도|시|군|구|도)$/.test(raw)) return raw;
    return `${raw}시`;
  }

  function buildTravelExpensePrimaryAnswer(profile, destinationText, items, isWorkplaceTravel, duration, destination) {
    if (isWorkplaceTravel) {
      return `${profile.subjectLabel}의 근무지 내 국내출장은 별도 일비·식비가 아니라 출장시간 4시간 이상 ${formatWon(TRAVEL.workplace4h)}, 4시간 미만 ${formatWon(TRAVEL.workplaceUnder4h)} 기준으로 봅니다.`;
    }
    if (isFullTravelExpenseItems(items)) return buildTravelTotalExpenseAnswer(profile, destinationText, duration, destination);
    if (items.includes("daily") && items.includes("meal")) {
      return `${profile.subjectLabel}의 ${destinationText}이 근무지 외 국내출장이고 공무원 여비 규정을 준용한다면 1일 기준 일비는 ${formatWon(TRAVEL.dailyRate)}, 식비는 ${formatWon(TRAVEL.mealRate)}, 합계는 ${formatWon(TRAVEL.dailyRate + TRAVEL.mealRate)}입니다.`;
    }
    if (items.includes("daily")) return `${profile.subjectLabel}의 ${destinationText}이 근무지 외 국내출장이고 공무원 여비 규정을 준용한다면 일비는 1일당 ${formatWon(TRAVEL.dailyRate)}입니다.`;
    if (items.includes("meal")) return `${profile.subjectLabel}의 ${destinationText}이 근무지 외 국내출장이고 공무원 여비 규정을 준용한다면 식비는 1일당 ${formatWon(TRAVEL.mealRate)}입니다.`;
    if (items.includes("lodging")) {
      if (profile.gradeGroup === "제1호") {
        return `${profile.subjectLabel}이 공무원 여비 규정을 준용한다면 ${destinationText} 숙박비는 ${destinationText.includes("서울") ? "서울 100,000원 상한이 아니라 " : ""}제1호 기준 실비 정산입니다.`;
      }

      const cap = destinationText.includes("서울")
        ? TRAVEL.lodgingCaps?.seoul
        : destinationText.includes("광역")
          ? TRAVEL.lodgingCaps?.metropolitan
          : TRAVEL.lodgingCaps?.other;
      return `${profile.subjectLabel}이 공무원 여비 규정을 준용한다면 ${destinationText} 숙박비는 실비 정산하되 1박당 상한 ${formatWon(cap)}을 적용합니다.`;
    }
    return `${profile.subjectLabel}의 ${destinationText} 여비는 근무지 외 국내출장이면 별표 2, 근무지 내 국내출장이면 제18조의 정액 기준을 먼저 적용합니다.`;
  }

  function isFullTravelExpenseItems(items = []) {
    return ["daily", "meal", "lodging", "transport"].every((item) => items.includes(item));
  }

  function buildTravelTotalExpenseAnswer(profile, destinationText, duration = inferTravelDuration(), destination = {}) {
    const days = Math.max(Number(duration.days) || 1, 1);
    const nights = Math.max(Number(duration.nights) || 0, 0);
    const dailyAmount = (TRAVEL.dailyRate || 0) * days;
    const mealAmount = (TRAVEL.mealRate || 0) * days;
    const durationText = formatTravelDuration({ days, nights, detected: true });
    const placeText = destinationText.replace(/\s*출장$/, "");

    if (!nights) {
      return `${profile.subjectLabel}의 ${placeText} ${durationText} 출장비는 운임·숙박 발생분을 제외하고 일비 ${formatWon(dailyAmount)}(${formatWon(TRAVEL.dailyRate)} x ${days}일), 식비 ${formatWon(mealAmount)}(${formatWon(TRAVEL.mealRate)} x ${days}일), 합계 ${formatWon(dailyAmount + mealAmount)}입니다. 운임은 실제 이동수단과 증빙으로 별도 실비 정산합니다.`;
    }

    if (profile.gradeGroup === "제1호") {
      return `${profile.subjectLabel}의 ${placeText} ${durationText} 출장비는 일비 ${formatWon(dailyAmount)}(${formatWon(TRAVEL.dailyRate)} x ${days}일), 식비 ${formatWon(mealAmount)}(${formatWon(TRAVEL.mealRate)} x ${days}일), 숙박비는 제1호 기준 실비, 운임은 증빙 실비로 정산합니다. 숙박비와 운임을 빼고 바로 계산되는 금액은 ${formatWon(dailyAmount + mealAmount)}입니다.`;
    }

    const lodgingCap = Number(destination?.cap || TRAVEL.lodgingCaps?.other || 0);
    const lodgingAmount = lodgingCap * nights;
    const total = dailyAmount + mealAmount + lodgingAmount;
    return `${profile.subjectLabel}의 ${placeText} ${durationText} 출장비는 운임을 제외하면 최대 ${formatWon(total)}입니다. 일비 ${formatWon(dailyAmount)}(${formatWon(TRAVEL.dailyRate)} x ${days}일), 식비 ${formatWon(mealAmount)}(${formatWon(TRAVEL.mealRate)} x ${days}일), 숙박비 ${formatWon(lodgingAmount)}(${destination.label || "해당 지역"} 제2호 상한 ${formatWon(lodgingCap)} x ${nights}박)을 합산한 금액입니다. 운임은 실제 이동수단과 증빙으로 별도 실비 정산합니다.`;
  }

  function formatTravelDuration(duration = {}) {
    const days = Math.max(Number(duration.days) || 1, 1);
    const nights = Math.max(Number(duration.nights) || 0, 0);
    if (nights) return `${nights}박 ${days}일`;
    return `${days}일`;
  }

  function getTravelGradeBasisText(profile) {
    if (profile.code === "unknown") {
      return `신분 확인 필요: 출장자의 신분이 확인되면 ${profile.gradeDetail}에서 여비 지급등급을 확정합니다.`;
    }
    return `${profile.subjectLabel}은 ${profile.gradeDetail}에 따라 ${profile.gradeGroup} 국내여비 지급표를 적용합니다.`;
  }

  function getTravelExpenseItemLabel(items = []) {
    if (isFullTravelExpenseItems(items)) return "출장비";
    const labels = { daily: "일비", meal: "식비", lodging: "숙박비", transport: "운임", general: "여비" };
    return uniqueStrings(items.map((item) => labels[item] || labels.general)).join("·") || "여비";
  }

  function getTopicParticle(text = "") {
    return hasFinalConsonant(text) ? "은" : "는";
  }

  function appendSubjectParticle(text = "") {
    return `${text}${hasFinalConsonant(text) ? "이" : "가"}`;
  }

  function appendObjectParticle(text = "") {
    return `${text}${hasFinalConsonant(text) ? "을" : "를"}`;
  }

  function formatProcedureStage(stage = "업무 단계") {
    const label = String(stage || "업무 단계").trim() || "업무 단계";
    if (label === "업무 단계") return "업무 단계로";
    if (/단계$|확인$|심의$|접수$|정정$|조치$/.test(label)) return `${label}로`;
    return `${label} 단계로`;
  }

  function hasFinalConsonant(text = "") {
    const value = String(text || "").trim();
    const last = value.charCodeAt(value.length - 1);
    if (last < 0xac00 || last > 0xd7a3) return false;
    return ((last - 0xac00) % 28) > 0;
  }

  function getLodgingCapText(destination) {
    if (Number.isFinite(destination?.cap)) return `제2호 숙박비 상한은 ${destination.label} 기준 ${formatWon(destination.cap)}입니다.`;
    return "제2호 숙박비 상한은 서울특별시 100,000원, 광역시 80,000원, 그 밖의 지역 70,000원입니다.";
  }

  function getCanonicalMetropolitanDestinationName(name = "") {
    const normalized = compactText(name);
    const entries = TRAVEL.metropolitanNames || [["서울", "서울특별시"], ["부산", "부산광역시"], ["대구", "대구광역시"], ["인천", "인천광역시"], ["광주", "광주광역시"], ["대전", "대전광역시"], ["울산", "울산광역시"], ["세종", "세종특별자치시"]];
    return entries.find(([keyword]) => normalized.includes(keyword))?.[1] || "";
  }

  function compactText(value) {
    return normalizeCommonPolicyInput(value).replace(/\s+/g, "");
  }

  function normalizeCommonPolicyInput(value = "") {
    return String(value || "")
      .replace(/쌤/g, "선생님")
      .replace(/츌장|춣장|출쟝/g, "출장")
      .replace(/병까|병갸|뼝가/g, "병가")
      .replace(/경조휴가/g, "경조사휴가")
      .replace(/학운위/g, "학교운영위원회")
      .replace(/학폭/g, "학교폭력")
      .replace(/생기부/g, "생활기록부")
      .replace(/씨씨티비/gi, "cctv")
      .replace(/에스엔에스/gi, "sns");
  }

  function uniqueStrings(items = []) {
    return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  function formatWon(amount) {
    return `${Number(amount || 0).toLocaleString("ko-KR")}원`;
  }

  function formatHours(hours) {
    return `${Number(hours || 0).toLocaleString("ko-KR")}시간`;
  }

  function calculateInstructorFee(profile = {}, hours = 0) {
    return Number(profile.base || 0) + Math.max(0, Number(hours || 0) - 1) * Number(profile.extra || 0);
  }

  function getInstructorDefaultRateTable() {
    const tableCode = HONORARIUM.defaultRateTableCode || "";
    return (HONORARIUM.rateTables || {})[tableCode] || null;
  }

  function getInstructorRateTableForOffice(officeCode = "") {
    if (!officeCode) return null;
    return Object.values(HONORARIUM.rateTables || {}).find((table) => table.officeCode === officeCode) || null;
  }

  function inferHonorariumOfficeCodeFromLabel(label = "") {
    const normalized = compactText(label);
    const offices = [
      ["gyeongbuk", /경북|경상북도/],
      ["seoul", /서울/],
      ["busan", /부산/],
      ["daegu", /대구/],
      ["incheon", /인천/],
      ["gwangju", /광주/],
      ["daejeon", /대전/],
      ["ulsan", /울산/],
      ["sejong", /세종/],
      ["gyeonggi", /경기/],
      ["gangwon", /강원/],
      ["chungbuk", /충북|충청북도/],
      ["chungnam", /충남|충청남도/],
      ["jeonbuk", /전북|전라북도/],
      ["jeonnam", /전남|전라남도/],
      ["gyeongnam", /경남|경상남도/],
      ["jeju", /제주/]
    ];
    return offices.find(([, pattern]) => pattern.test(normalized))?.[0] || "";
  }

  return {
    version: VERSION,
    knowledgeBaseVersion: KB.version,
    knowledgeBase: KB,
    buildPolicySemanticFrame,
    analyzePolicyQuestion,
    lookupPolicyRules,
    buildPolicyResponse,
    internals: {
      parseDomesticTravelIntent,
      inferDomesticTravelDestination,
      inferDomesticTravelProfile,
      inferTravelDuration,
      getDomainDataIndexProfile,
      buildDataCoverage
    }
  };
});
