import assert from "node:assert/strict";
import {
  buildPayloadFromLocalPolicyNormalizer,
  chooseBetterLocalPolicyResult,
  hasLocalPolicyResultRegression,
  scoreLocalPolicyResult,
  shouldUseLocalLlmPolicyNormalizer
} from "../functions/shared/local-llm.mjs";

function mockPolicyResult({
  domainCode,
  status = "needs_slot",
  confidence = 0.2,
  missingSlots = [],
  text = "",
  question = "",
  ok = true,
  hasPolicyResponse = true
} = {}) {
  return {
    ok,
    question,
    confidence,
    missingSlots,
    responseText: text,
    policyResponse: hasPolicyResponse ? { title: "테스트", answer: [text], lead: text } : null,
    answerState: {
      status,
      primaryText: text,
      conditionalAnswers: status === "definitive" ? [] : [text],
      definitiveAnswers: status === "definitive" ? [text] : []
    },
    semanticFrame: {
      domainCode,
      confidence
    }
  };
}

const normalizerConfig = {
  enabled: true,
  normalizerEnabled: true,
  normalizerMode: "auto",
  normalizerMinConfidence: 0.82
};

const weakBudgetBase = mockPolicyResult({
  domainCode: "schoolBudgetExecution",
  status: "needs_slot",
  confidence: 0.2,
  missingSlots: ["procedureStage"],
  text: "질문만으로는 적용 규정을 특정하기 어렵습니다. 계약인지 지출인지 먼저 확인해야 합니다."
});
const betterAfterSchoolCandidate = mockPolicyResult({
  domainCode: "afterSchoolChildcare",
  status: "definitive",
  confidence: 0.68,
  missingSlots: [],
  text: "늘봄 위탁 운영 사안입니다. 위탁 계약과 학생 안전관리 기준을 확인합니다."
});

assert.equal(
  shouldUseLocalLlmPolicyNormalizer({ question: "늘봄 위탁업체 선정 절차 뭐 봐야 해" }, weakBudgetBase, normalizerConfig),
  true,
  "weak result should trigger local LLM normalization"
);
assert.equal(
  chooseBetterLocalPolicyResult(weakBudgetBase, betterAfterSchoolCandidate),
  betterAfterSchoolCandidate,
  "local normalizer candidate should replace a weak misclassification"
);
assert.ok(
  scoreLocalPolicyResult(betterAfterSchoolCandidate) > scoreLocalPolicyResult(weakBudgetBase),
  "candidate should score better than weak base"
);

const strongTravelBase = mockPolicyResult({
  domainCode: "domesticTravelExpense",
  status: "definitive",
  confidence: 0.9,
  missingSlots: [],
  question: "공립고 교사의 안동 출장비를 알려줘",
  text: "출장비는 국내출장 여비 기준으로 확인합니다."
});
const wrongBudgetCandidate = mockPolicyResult({
  domainCode: "schoolBudgetExecution",
  status: "definitive",
  confidence: 0.8,
  missingSlots: [],
  text: "학교회계 지출 증빙 절차를 확인합니다."
});

assert.equal(
  shouldUseLocalLlmPolicyNormalizer({ question: "공립고 교사의 안동 출장비를 알려줘" }, strongTravelBase, normalizerConfig),
  false,
  "strong usable base result should not trigger normalization in auto mode"
);
assert.equal(
  chooseBetterLocalPolicyResult(strongTravelBase, wrongBudgetCandidate),
  strongTravelBase,
  "local normalizer must not replace a strong anchored travel answer"
);

const slotLosingCandidate = mockPolicyResult({
  domainCode: "domesticTravelExpense",
  status: "needs_slot",
  confidence: 0.7,
  missingSlots: ["destination"],
  text: "출장비는 출장지 확인 후 계산합니다."
});
assert.equal(
  hasLocalPolicyResultRegression(weakBudgetBase, slotLosingCandidate, {
    baseScore: scoreLocalPolicyResult(weakBudgetBase),
    normalizedScore: scoreLocalPolicyResult(slotLosingCandidate) + 20
  }),
  true,
  "candidate introducing a critical missing slot should be rejected"
);

const normalizedPayload = buildPayloadFromLocalPolicyNormalizer(
  { question: "쌤 병가 서류 뭐 필요?", roleLabel: "" },
  {
    normalizedQuestion: "기간제교사의 병가 신청 절차와 증빙자료 기준은?",
    slots: {
      roleLabel: "기간제교사",
      officeLabel: "경상북도교육청"
    }
  }
);
assert.equal(normalizedPayload.question, "기간제교사의 병가 신청 절차와 증빙자료 기준은?");
assert.equal(normalizedPayload.originalQuestion, "쌤 병가 서류 뭐 필요?");
assert.equal(normalizedPayload.roleLabel, "기간제교사");
assert.equal(normalizedPayload.officeLabel, "경상북도교육청");

console.log("Local LLM regression passed");
