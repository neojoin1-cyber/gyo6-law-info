import assert from "node:assert/strict";
import policyEngine from "../public/policy-engine.js";
import { handlePolicyChatRequest } from "../functions/shared/policy-chat.mjs";
import { buildSyntheticPolicyScenarioBank } from "./policy-scenario-bank.mjs";

const bank = buildSyntheticPolicyScenarioBank({
  maxPerDomain: 432,
  maxCounterexamplesPerDomain: 540
});
const kbDomains = policyEngine.knowledgeBase?.domains || {};
const failures = [];

function addFailure(id, message, extra = {}) {
  failures.push({ id, message, ...extra });
}

assert.ok(bank.metadata.domainCount >= 26, `Expected at least 26 domains, got ${bank.metadata.domainCount}`);
assert.ok(bank.metadata.syntheticCount >= 10000, `Synthetic bank is too small: ${bank.metadata.syntheticCount}`);
assert.ok(bank.metadata.manualCounterexampleCount >= 10, `Manual counterexample bank is too small: ${bank.metadata.manualCounterexampleCount}`);
assert.ok(bank.metadata.syntheticCounterexampleCount >= 12000, `Synthetic counterexample bank is too small: ${bank.metadata.syntheticCounterexampleCount}`);
assert.ok(bank.metadata.counterexampleCount >= 12000, `Counterexample bank is too small: ${bank.metadata.counterexampleCount}`);
assert.equal(bank.generator.mode, "deterministic-ai-style-balanced-grid");
assert.ok(bank.generator.coverageAxes?.includes("purpose"), "Scenario generator must cover question purpose axis");
assert.ok(
  bank.scenarios.some((scenario) => scenario.domainCode === "staffAttendanceService" && /사립학교 교사의 최대 병가일수/.test(scenario.question)),
  "Expanded bank should retain private-school teacher sick-leave limit variants"
);
assert.ok(
  bank.scenarios.some((scenario) => scenario.domainCode === "staffAttendanceService" && /학교법인 교원 질병휴가 한도/.test(scenario.question)),
  "Expanded bank should retain school-corporation teacher sick-leave variants"
);
assert.ok(
  new Set(bank.scenarios.filter((scenario) => scenario.domainCode === "staffAttendanceService").flatMap((scenario) => scenario.tags || [])).size >= 80,
  "Expanded staff attendance scenarios should cover many wording and slot tags"
);

const coveredDomains = new Set(bank.scenarios.map((scenario) => scenario.domainCode));
for (const domainCode of Object.keys(kbDomains)) {
  if (!coveredDomains.has(domainCode)) {
    addFailure("coverage", `domain ${domainCode} has no synthetic scenarios`);
  }
}

for (const scenario of bank.regressionSample) {
  const frame = policyEngine.buildPolicySemanticFrame(scenario.question);
  if (frame.domainCode !== scenario.expectedDomain) {
    addFailure(scenario.id, `expected ${scenario.expectedDomain}, got ${frame.domainCode || "unclassified"}`, {
      question: scenario.question,
      candidates: frame.domainCandidates?.slice(0, 5).map((candidate) => ({
        code: candidate.code,
        score: candidate.score,
        matched: candidate.matchedKeywords
      }))
    });
  }
  if (!frame.caseFrame || frame.caseFrame.domainCode !== frame.domainCode) {
    addFailure(scenario.id, "missing or mismatched policy caseFrame", {
      question: scenario.question,
      domain: frame.domainCode,
      caseFrame: frame.caseFrame
    });
  }
  if (!frame.lookupPlan?.sourceHierarchy?.length) {
    addFailure(scenario.id, "lookup plan missing sourceHierarchy", {
      question: scenario.question,
      domain: frame.domainCode,
      lookupPlan: frame.lookupPlan
    });
  }
}

for (const scenario of bank.counterexamples) {
  const frame = policyEngine.buildPolicySemanticFrame(scenario.question);
  if (scenario.expectedClarification) {
    const result = handlePolicyChatRequest({ question: scenario.question });
    if (!frame.intentClarification?.needsConfirmation && !result.needsClarification) {
      addFailure(scenario.id, "expected clarification guard", {
        question: scenario.question,
        domain: frame.domainCode,
        responseText: result.responseText?.slice(0, 300)
      });
    }
    continue;
  }

  if (frame.domainCode !== scenario.expectedDomain) {
    addFailure(scenario.id, `expected ${scenario.expectedDomain}, got ${frame.domainCode || "unclassified"}`, {
      question: scenario.question,
      forbiddenDomain: scenario.forbiddenDomain,
      candidates: frame.domainCandidates?.slice(0, 5).map((candidate) => ({
        code: candidate.code,
        score: candidate.score,
        matched: candidate.matchedKeywords
      }))
    });
  }
  if (scenario.forbiddenDomain && frame.domainCode === scenario.forbiddenDomain) {
    addFailure(scenario.id, `routed to forbidden domain ${scenario.forbiddenDomain}`, {
      question: scenario.question
    });
  }
}

const explicitFocusCases = [
  {
    id: "focus-question-school-violence",
    question: "민원인이 길게 말했는데 핵심만 보면 학교폭력 사안 접수 후 보호자 통지는 어떻게 하나요?",
    domain: "schoolViolenceProcedure",
    focusIncludes: "학교폭력",
    noIntentConfirmation: true
  },
  {
    id: "focus-question-honorarium",
    question: "여러 말이 섞였지만 실제 문의는 전직 교장 특강 강사수당은 얼마인가요?",
    domain: "schoolInstructorHonorarium",
    focusIncludes: "강사수당",
    noIntentConfirmation: true
  },
  {
    id: "focus-question-staff-attendance",
    question: "장황하게 적었지만 핵심만 보면 사립학교 교사의 최대 병가일수는 몇 일인가요?",
    domain: "staffAttendanceService",
    focusIncludes: "병가",
    noIntentConfirmation: true
  }
];

for (const testCase of explicitFocusCases) {
  const frame = policyEngine.buildPolicySemanticFrame(testCase.question);
  if (!frame.explicitFocus?.detected || !frame.explicitFocus.text.includes(testCase.focusIncludes)) {
    addFailure(testCase.id, "expected explicit focus extraction for question-style phrasing", {
      question: testCase.question,
      explicitFocus: frame.explicitFocus
    });
  }
  if (frame.domainCode !== testCase.domain) {
    addFailure(testCase.id, `expected focused domain ${testCase.domain}, got ${frame.domainCode || "unclassified"}`, {
      question: testCase.question,
      explicitFocus: frame.explicitFocus,
      candidates: frame.domainCandidates?.slice(0, 5).map((candidate) => ({
        code: candidate.code,
        score: candidate.score,
        matched: candidate.matchedKeywords
      }))
    });
  }
  if (testCase.noIntentConfirmation && frame.intentClarification?.needsConfirmation) {
    addFailure(testCase.id, "focused question should not trigger close-domain confirmation", {
      question: testCase.question,
      explicitFocus: frame.explicitFocus,
      intentClarification: frame.intentClarification
    });
  }
}

const kakaoSmokeCases = [
  "학교 행사 사진을 홈페이지에 올려도 되나요?",
  "학생이 교사 얼굴을 몰래 찍어 SNS에 올렸어요. 어떻게 처리해야 하나요?",
  "현장실습 중 위험기계 사고가 났을 때 학교와 기업의 보고 절차는?",
  "졸업생 근로계약 임금체불 상담 기준, 처리 절차, 필요한 증빙자료를 알려주세요.",
  "위원회 회의록 공개 기준은?"
];

for (const question of kakaoSmokeCases) {
  const result = handlePolicyChatRequest({ question });
  if (!result.ok || /이해하기 어려워요|제가 할 수 있는 일이 아니에요|무엇을 원하는지 잘 모르겠어요/.test(result.responseText || "")) {
    addFailure(`kakao-smoke:${question}`, "Kakao policy chat returned a generic failure", {
      responseText: result.responseText
    });
  }
}

const kakaoDomainSmokeCases = [
  {
    question: "졸업생 근로계약 임금체불 상담 기준, 처리 절차, 필요한 증빙자료를 알려주세요.",
    include: /졸업생|근로계약|임금|체불|노동|취업|채용/,
    exclude: /학생상담|위기학생|정서행동/
  }
];

for (const testCase of kakaoDomainSmokeCases) {
  const result = handlePolicyChatRequest({ question: testCase.question });
  if (!testCase.include.test(result.responseText || "") || testCase.exclude.test(result.responseText || "")) {
    addFailure(`kakao-domain:${testCase.question}`, "Kakao response did not preserve the expected domain", {
      responseText: result.responseText
    });
  }
}

if (failures.length) {
  console.error(`Policy scenario bank regression failed: ${failures.length}`);
  for (const failure of failures.slice(0, 25)) {
    console.error(`- ${failure.id}: ${failure.message}`);
    if (failure.question) console.error(`  question: ${failure.question}`);
    if (failure.candidates) console.error(`  candidates: ${JSON.stringify(failure.candidates)}`);
  }
  process.exit(1);
}

console.log(
  `Policy scenario bank regression passed: ${bank.metadata.syntheticCount} synthetic scenarios + ${bank.metadata.counterexampleCount} counterexamples (${bank.metadata.manualCounterexampleCount} manual + ${bank.metadata.syntheticCounterexampleCount} synthetic); ${bank.metadata.regressionSampleCount} sampled checks`
);
