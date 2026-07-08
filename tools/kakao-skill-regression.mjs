import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildKakaoSkillResponse,
  buildKakaoSkillResponseFromResult,
  handlePolicyChatRequest
} from "../functions/shared/policy-chat.mjs";
import worker, {
  chooseBetterPolicyResult,
  composeKakaoClarificationFollowUpPayload,
  hasPolicyResultRegression,
  scorePolicyResult,
  shouldMergeKakaoClarificationAnswer,
  shouldStartNewKakaoConsultation,
  shouldStoreKakaoClarificationSession
} from "../workers/ai-analysis/src/index.js";

const travel = handlePolicyChatRequest({
  question: "교장의 경주 출장시 일비 식비는?"
});
assert.equal(travel.ok, true);
assert.equal(travel.semanticFrame.domainCode, "domesticTravelExpense");
assert.match(travel.responseText, /출장|일비|식비/);
assert.match(travel.responseText, /경상북도교육청 기준/);

const fixedTermSickLeave = buildKakaoSkillResponse({
  userRequest: {
    utterance: "기간제교사의 병가는 몇일 가능하며 어떻게 신청하나요?"
  }
});
assert.equal(fixedTermSickLeave.version, "2.0");
assert.ok(Array.isArray(fixedTermSickLeave.template.outputs));
assert.ok(fixedTermSickLeave.template.outputs.some((output) => output.simpleText?.text));
assert.match(fixedTermSickLeave.template.outputs[0].simpleText.text, /기간제|병가|복무|경상북도교육청/);
assert.match(fixedTermSickLeave.template.outputs[0].simpleText.text, /60일|180일|진단서|6일/);
assert.doesNotMatch(
  fixedTermSickLeave.template.outputs[0].simpleText.text,
  /계약제교원 운영 지침과 근로계약에서 유급·무급, 병가 일수, 진단서 기준을 먼저 확인/
);
assert.ok(
  fixedTermSickLeave.template.outputs[0].simpleText.text.length <= 430,
  `Kakao simpleText is too long: ${fixedTermSickLeave.template.outputs[0].simpleText.text.length}`
);
assert.match(fixedTermSickLeave.template.outputs[0].simpleText.text, /자세히 보기/);
assert.ok(!fixedTermSickLeave.template.outputs.some((output) => output.basicCard), "Kakao default response should not render bulky basicCard");
assert.equal(fixedTermSickLeave.template.quickReplies[0]?.label, "자세히 보기");
const fixedTermSickLeaveWebReply = fixedTermSickLeave.template.quickReplies.find((reply) => reply.label === "자세히 보기");
assert.equal(fixedTermSickLeaveWebReply?.action, "message");
assert.match(fixedTermSickLeaveWebReply?.messageText || "", /신청 절차|증빙 기준|자세히 알려줘/);
const sickLeaveEvidenceReply = fixedTermSickLeave.template.quickReplies.find((reply) => reply.label === "증빙");
assert.ok(sickLeaveEvidenceReply, "Expected an evidence quick reply for fixed-term sick leave");
assert.match(sickLeaveEvidenceReply.messageText, /기간제교사의 병가/);
assert.match(sickLeaveEvidenceReply.messageText, /필요한 증빙자료와 제출 기준/);

const fixedTermSickLeaveState = handlePolicyChatRequest({
  question: "기간제교사의 병가는 몇일 가능하며 어떻게 신청하나요?"
}).answerState;
assert.equal(fixedTermSickLeaveState.status, "conditional");
assert.ok(fixedTermSickLeaveState.primaryText.includes("60일") && fixedTermSickLeaveState.primaryText.includes("180일"));
assert.ok(fixedTermSickLeaveState.conditionalAnswers.some((text) => /60일|180일/.test(text)));
assert.ok(fixedTermSickLeaveState.conditionalAnswers.some((text) => /진단서|증빙/.test(text)));

const privateSchoolTeacherSickLeave = buildKakaoSkillResponse({
  userRequest: {
    utterance: "사립학교 교사의 최대 병가일수는?"
  }
});
const privateSchoolTeacherSickLeaveText = privateSchoolTeacherSickLeave.template.outputs[0].simpleText.text;
assert.doesNotMatch(privateSchoolTeacherSickLeaveText, /질문만으로는|무엇을 원하는지|적용 규정을 특정하기 어렵/);
assert.match(privateSchoolTeacherSickLeaveText, /학교법인|취업규칙|60일|180일/);
assert.equal(privateSchoolTeacherSickLeave.template.quickReplies[0]?.label, "자세히 보기");

const thirdYearRegularTeacherAnnualLeaveState = handlePolicyChatRequest({
  question: "3년차 정교사의 연가 일수는?"
});
assert.equal(thirdYearRegularTeacherAnnualLeaveState.semanticFrame?.domainCode, "staffAttendanceService");
assert.equal(thirdYearRegularTeacherAnnualLeaveState.semanticFrame?.slots?.serviceIssue?.code, "annualLeave");
assert.deepEqual(thirdYearRegularTeacherAnnualLeaveState.missingSlots, []);
assert.match(
  [
    thirdYearRegularTeacherAnnualLeaveState.responseText,
    thirdYearRegularTeacherAnnualLeaveState.answerState?.primaryText,
    ...(thirdYearRegularTeacherAnnualLeaveState.answerState?.conditionalAnswers || []),
    ...(thirdYearRegularTeacherAnnualLeaveState.answerState?.definitiveAnswers || [])
  ].join(" "),
  /3년 이상 4년 미만 16일|16일/
);

const thirdYearRegularTeacherAnnualLeave = buildKakaoSkillResponse({
  userRequest: {
    utterance: "3년차 정교사의 연가 일수는?"
  }
});
const thirdYearRegularTeacherAnnualLeaveText = thirdYearRegularTeacherAnnualLeave.template.outputs[0].simpleText.text;
assert.doesNotMatch(thirdYearRegularTeacherAnnualLeaveText, /질문만으로는|무엇을 원하는지|적용 규정을 특정하기 어렵|제가 할 수 있는 일이 아니/);
assert.match(thirdYearRegularTeacherAnnualLeaveText, /3년 이상 4년 미만|16일|나이스|학교장 승인/);
assert.equal(thirdYearRegularTeacherAnnualLeave.template.quickReplies[0]?.label, "자세히 보기");

const sickLeaveEvidenceFollowUp = buildKakaoSkillResponse({
  userRequest: {
    utterance: sickLeaveEvidenceReply.messageText
  }
});
const sickLeaveEvidenceFollowUpText = sickLeaveEvidenceFollowUp.template.outputs[0].simpleText.text;
assert.doesNotMatch(sickLeaveEvidenceFollowUpText, /질문 요지를 아직 특정하지 못했습니다|이해하기 어려워요/);
assert.match(sickLeaveEvidenceFollowUpText, /진단서|증빙자료|6일/);
assert.match(sickLeaveEvidenceFollowUpText, /한의사|치과의사/);

const schoolViolenceMoneyExtortion = buildKakaoSkillResponse({
  userRequest: {
    utterance: "학생이 다른 학생에게 돈을 3번에 걸쳐 2만원을 요구해서 받아갔음. 학폭 사안에 해당할까? 처리를 어떻게 해야할까?"
  }
});
const schoolViolenceText = schoolViolenceMoneyExtortion.template.outputs[0].simpleText.text;
assert.ok(!schoolViolenceMoneyExtortion.template.outputs.some((output) => output.basicCard), "School-violence Kakao response should stay compact");
assert.match(schoolViolenceText, /요약:/);
assert.match(schoolViolenceText, /금품|학교폭력 사안|사안조사|피해학생|전담기구/);
assert.match(schoolViolenceText, /자세히 보기/);
assert.equal(schoolViolenceMoneyExtortion.template.quickReplies[0]?.label, "자세히 보기");
const schoolViolenceDetailReply = schoolViolenceMoneyExtortion.template.quickReplies.find((reply) => reply.label === "자세히 보기");
assert.equal(schoolViolenceDetailReply?.action, "message");
assert.match(schoolViolenceDetailReply?.messageText || "", /신청 절차|증빙 기준|자세히 알려줘/);
const schoolViolenceDocumentReply = schoolViolenceMoneyExtortion.template.quickReplies.find((reply) => reply.label === "서류 체크");
assert.ok(schoolViolenceDocumentReply, "Expected a document checklist quick reply for school-violence procedure questions");
assert.match(schoolViolenceDocumentReply.messageText, /필요한 서류와 기록 보존 기준/);

const maleTeacherChildbirthLeave = buildKakaoSkillResponse({
  userRequest: {
    utterance: "남자 교사가 출산휴가를 받을 수 있나요?"
  }
});
const maleTeacherChildbirthLeaveText = maleTeacherChildbirthLeave.template.outputs[0].simpleText.text;
assert.doesNotMatch(maleTeacherChildbirthLeaveText, /질문만으로는|가까운 분야|완성질문|무엇을 원하는지|할 수 있는 일이 아니/);
assert.match(maleTeacherChildbirthLeaveText, /배우자 출산휴가|20일|특별휴가/);
assert.equal(maleTeacherChildbirthLeave.template.quickReplies[0]?.label, "자세히 보기");
assert.equal(maleTeacherChildbirthLeave.template.quickReplies[0]?.action, "message");

const abbreviatedMaleTeacherChildbirthLeave = buildKakaoSkillResponse({
  userRequest: {
    utterance: "남 교사의 출산 휴가는 몇일 사용 가능한가요?"
  }
});
const abbreviatedMaleTeacherChildbirthLeaveText = abbreviatedMaleTeacherChildbirthLeave.template.outputs[0].simpleText.text;
assert.doesNotMatch(abbreviatedMaleTeacherChildbirthLeaveText, /사유별 일수표|질문만으로는|가까운 분야|완성질문|무엇을 원하는지/);
assert.match(abbreviatedMaleTeacherChildbirthLeaveText, /배우자 출산휴가|20일|특별휴가/);
assert.equal(abbreviatedMaleTeacherChildbirthLeave.template.quickReplies[0]?.label, "자세히 보기");
assert.equal(abbreviatedMaleTeacherChildbirthLeave.template.quickReplies[0]?.action, "message");

const staffChildbirthSubjectEventCases = [
  "남성 교직원이 출산휴가를 신청하려면 며칠인지 알려줘",
  "아내가 출산한 공립 교원은 특별휴가를 며칠 받을 수 있나요?",
  "아빠 교사가 출산 관련 휴가를 쓰려면 며칠 가능한가요?"
];

for (const question of staffChildbirthSubjectEventCases) {
  const response = buildKakaoSkillResponse({
    userRequest: { utterance: question }
  });
  const text = response.template.outputs[0].simpleText.text;
  assert.doesNotMatch(text, /사유별 일수표|질문만으로는|가까운 분야|완성질문|무엇을 원하는지/);
  assert.match(text, /배우자 출산휴가|20일|특별휴가/);
  assert.equal(response.template.quickReplies[0]?.label, "자세히 보기");
  assert.equal(response.template.quickReplies[0]?.action, "message");
}

const femaleTeacherChildbirthLeave = buildKakaoSkillResponse({
  userRequest: {
    utterance: "여 교사의 출산 휴가는 어떻게 신청하나요?"
  }
});
const femaleTeacherChildbirthLeaveText = femaleTeacherChildbirthLeave.template.outputs[0].simpleText.text;
assert.match(femaleTeacherChildbirthLeaveText, /출산|특별휴가|복무/);
assert.doesNotMatch(femaleTeacherChildbirthLeaveText, /배우자 출산휴가는 공립 교원·국가공무원 기준으로 20일입니다/);

const genericChildbirthLeave = handlePolicyChatRequest({
  question: "출산 휴가 규정"
});
assert.equal(genericChildbirthLeave.semanticFrame.domainCode, "staffAttendanceService");
assert.equal(genericChildbirthLeave.answerState.status, "conditional");
assert.doesNotMatch(genericChildbirthLeave.responseText, /질문만으로는 적용 규정을 특정하기 어렵습니다/);
assert.match(genericChildbirthLeave.responseText, /출산|특별휴가|나이스|증빙/);

const semanticBridgeKakaoCases = [
  {
    question: "학생이 친구에게 돈을 여러 번 요구해서 받아갔는데 어떻게 처리해야 하나요?",
    domain: "schoolViolenceProcedure",
    text: /학교폭력|사안|피해학생|전담기구/
  },
  {
    question: "행정실에서 물품을 샀는데 어떤 서류가 필요해?",
    domain: "schoolBudgetExecution",
    text: /학교회계|증빙|품의|검수|지출/
  },
  {
    question: "늘봄 프로그램 위탁 계약과 학생 안전관리 자료는 무엇을 봐야 하나요?",
    domain: "afterSchoolChildcare",
    text: /방과후|돌봄|늘봄|교육청/
  },
  {
    question: "실습생이 회사에서 다쳤는데 학교가 뭘 해야 해?",
    domain: "vocationalFieldTrainingOperation",
    text: /현장실습|실습|보호|보고|기업/
  },
  {
    question: "퇴직한 직원 나이스 권한 계속 둬도 돼?",
    domain: "facilityDigitalSecurity",
    text: /나이스|권한|개인정보|보안/
  },
  {
    question: "졸업생 근로계약 임금체불 상담 기준, 처리 절차, 필요한 증빙자료를 알려주세요.",
    domain: "careerEmploymentGuidance",
    text: /졸업생|근로계약|임금체불|노동상담|취업지도/,
    notText: /^요약:\s*증빙자료/
  },
  {
    question: "학교 행사 사진을 홈페이지에 올려도 되나요?",
    domain: "facilityDigitalSecurity",
    text: /사진|영상|개인정보|동의|홈페이지/,
    notText: /facilityArea|dataSystem/
  },
  {
    question: "졸업앨범 사진 동의서는 꼭 받아야 하나요?",
    domain: "facilityDigitalSecurity",
    text: /사진|개인정보|동의|공개/,
    notText: /facilityArea|dataSystem/
  },
  {
    question: "학부모가 교사에게 계속 욕설하고 민원을 넣으면 어떻게 보호해?",
    domain: "teacherRightsProtection",
    text: /교권|교육활동 보호|교직원 보호|민원/
  },
  {
    question: "학생이 교사 얼굴을 몰래 찍어 SNS에 올렸어요. 어떻게 처리해야 하나요?",
    domain: "teacherRightsProtection",
    text: /교육활동 보호|무단 촬영|SNS|증거 보존|개인정보/
  },
  {
    question: "학부모가 담임 통화 녹음을 공개하겠다고 합니다. 어떻게 대응하나요?",
    domain: "teacherRightsProtection",
    text: /교육활동 보호|녹음|공개|증거 보존|개인정보/
  },
  {
    question: "상담기록을 다른 교사에게 공유해도 되나요?",
    domain: "healthInfectionCounseling",
    text: /상담기록|비밀보호|제공|기록 보존/
  },
  {
    question: "학부모가 급식 반찬이 마음에 들지 않는다며 학교장 면담을 요구했습니다. 식중독은 없습니다.",
    domain: "schoolMealOperation",
    text: /급식|학교급식|민원|식중독/,
    excludedRiskCodes: ["safety"]
  }
];

for (const testCase of semanticBridgeKakaoCases) {
  const result = handlePolicyChatRequest({ question: testCase.question });
  assert.equal(result.semanticFrame.domainCode, testCase.domain, `Expected ${testCase.question} to route to ${testCase.domain}`);
  assert.doesNotMatch(result.responseText, /질문만으로는 적용 규정을 특정하기 어렵습니다/);
  assert.match(result.responseText, testCase.text);
  if (testCase.notText) assert.doesNotMatch(result.responseText, testCase.notText);
  const riskCodes = result.semanticFrame.slots?.riskSignal?.items?.map((item) => item.code) || [];
  for (const riskCode of testCase.excludedRiskCodes || []) {
    assert.ok(!riskCodes.includes(riskCode), `Expected ${testCase.question} not to mark risk code ${riskCode}`);
  }
}

const ambiguous = handlePolicyChatRequest({
  question: "이거 되나요?"
});
assert.equal(ambiguous.needsClarification, true);
assert.equal(ambiguous.answerState.status, "unclassified");
assert.match(ambiguous.responseText, /분야|완성질문|원문/);
assert.equal(ambiguous.completionFlow?.needed, true);
assert.equal(ambiguous.completionFlow?.type, "choose_domain");

const ambiguousKakao = buildKakaoSkillResponse({
  userRequest: {
    utterance: "이거 되나요?"
  }
});
const ambiguousKakaoText = ambiguousKakao.template.outputs[0].simpleText.text;
assert.match(ambiguousKakaoText, /가까운 분야|완성질문/);
const attendanceBuilderReply = ambiguousKakao.template.quickReplies.find((reply) => reply.label === "복무·근태 질문 만들기");
assert.ok(attendanceBuilderReply, "Expected a staff attendance question-builder quick reply");
assert.match(attendanceBuilderReply.messageText, /질문 만들기|완성질문 예시/);

const legalRiskQuestion = buildKakaoSkillResponse({
  userRequest: {
    utterance: "민사소송을 해야 하나요?"
  }
});
const legalRiskQuestionText = legalRiskQuestion.template.outputs[0].simpleText.text;
assert.match(legalRiskQuestionText, /가까운 분야|완성질문|규정|확인 필요|증빙/);
assert.ok(
  legalRiskQuestion.template.quickReplies.some((reply) => /증빙|대상자|절차/.test(reply.label)),
  "Expected legal-risk quick replies for evidence, subject, or procedure follow-up"
);

const pendingLegalSession = {
  question: "법률·노무 위험 초기정리 사안입니다. 필요한 정보(당사자, 사건 유형, 발생 시점, 이미 한 조치, 증빙자료, 긴급 위험)를 보태면 답변합니다.",
  domainLabel: "법률·노무 위험 초기정리",
  slotQuestions: [
    { label: "당사자", question: "누가 누구에게 어떤 조치를 하려는 상황인가요?" }
  ]
};
assert.equal(
  shouldMergeKakaoClarificationAnswer({ question: "공립고 교사가 학생 보호자에게 고소를 고민 중입니다." }, pendingLegalSession),
  true
);
assert.equal(
  shouldMergeKakaoClarificationAnswer({ question: "학교폭력 처리는 어떻게 하나요?" }, pendingLegalSession),
  false
);
const mergedLegalPayload = composeKakaoClarificationFollowUpPayload(
  { question: "공립고 교사가 학생 보호자에게 고소를 고민 중입니다.", user: { id: "test-user" } },
  pendingLegalSession
);
assert.match(mergedLegalPayload.question, /추가 확인 내용/);
assert.match(mergedLegalPayload.question, /공립고 교사가 학생 보호자에게 고소/);
assert.equal(mergedLegalPayload.sessionContext.used, true);
const mergedLegalPolicy = handlePolicyChatRequest({
  question: "민사소송을 해야 하나요? 추가 확인 내용: 법률·노무 위험 초기정리: 공립고 교사가 학생 보호자에게 고소를 고민 중이고 문자 캡처가 있습니다."
});
assert.equal(mergedLegalPolicy.semanticFrame.domainCode, "teacherRightsProtection");
assert.doesNotMatch(mergedLegalPolicy.responseText, /사진·CCTV·녹음 등 자료를 기준/);
assert.match(mergedLegalPolicy.responseText, /교육활동|교권|교직원 보호|증빙|위험/);

const annualLeaveQuestion = handlePolicyChatRequest({
  question: "4년차 계약직 행정직원의 연가일수는?"
});
assert.equal(annualLeaveQuestion.semanticFrame.domainCode, "staffAttendanceService");
assert.equal(
  shouldStoreKakaoClarificationSession(annualLeaveQuestion),
  false,
  "A domain-classified answer must not leave a sticky Kakao follow-up session"
);
const pendingAnnualLeaveSession = {
  question: "4년차 계약직 행정직원의 연가일수는?",
  domainCode: "staffAttendanceService",
  domainLabel: "교직원 복무·근태",
  slotQuestions: [{ label: "증빙", question: "이미 있는 증빙자료나 필요한 증빙이 무엇인지 알려주세요." }]
};
const classroomGuidanceQuestion = {
  question: "교사의 수업시간 중 반복적인 지시를 따르지 않는 학생에게 내릴 수 있는 조치는?"
};
assert.equal(
  shouldStartNewKakaoConsultation(classroomGuidanceQuestion, pendingAnnualLeaveSession),
  true,
  "A new classroom guidance question must start a new Kakao consultation"
);
assert.equal(
  shouldMergeKakaoClarificationAnswer(classroomGuidanceQuestion, pendingAnnualLeaveSession),
  false,
  "A new classroom guidance question must not merge into the previous annual leave session"
);
const classroomGuidancePolicy = handlePolicyChatRequest(classroomGuidanceQuestion);
assert.equal(classroomGuidancePolicy.semanticFrame.domainCode, "classManagementGuidance");
assert.match(classroomGuidancePolicy.responseText, /교원의 학생생활지도|생활지도 고시|초·중등교육법/);
assert.doesNotMatch(classroomGuidancePolicy.responseText, /근로기준법|연가|16일/);
const classroomGuidanceKakao = buildKakaoSkillResponse({
  userRequest: {
    utterance: classroomGuidanceQuestion.question
  }
});
const classroomGuidanceKakaoText = classroomGuidanceKakao.template.outputs[0].simpleText.text;
assert.match(classroomGuidanceKakaoText, /교원의 학생생활지도|생활지도 고시|초·중등교육법|시행령 제31조/);
assert.doesNotMatch(classroomGuidanceKakaoText, /근로기준법|연가|16일/);

const committeeMinutesClarifier = buildKakaoSkillResponse({
  userRequest: {
    utterance: "위원회 회의록 공개 기준은?"
  }
});
const committeeMinutesClarifierText = committeeMinutesClarifier.template.outputs[0].simpleText.text;
assert.match(committeeMinutesClarifierText, /질문 요지 확인 필요|위원회.*종류|회의록/);
assert.doesNotMatch(committeeMinutesClarifierText, /명확한 답변|확정 답변/);
assert.ok(
  committeeMinutesClarifier.template.quickReplies.some((reply) => reply.label === "위원회 종류"),
  "Expected a committee-type clarifier quick reply"
);

const recordDisclosureClarifier = buildKakaoSkillResponse({
  userRequest: {
    utterance: "학생 기록을 학부모에게 공개해도 되나요?"
  }
});
const recordDisclosureClarifierText = recordDisclosureClarifier.template.outputs[0].simpleText.text;
assert.match(recordDisclosureClarifierText, /질문 요지 확인 필요|기록.*종류|요청자/);
assert.doesNotMatch(recordDisclosureClarifierText, /명확한 답변|확정 답변/);
assert.ok(
  recordDisclosureClarifier.template.quickReplies.some((reply) => reply.label === "기록 종류"),
  "Expected a record-type clarifier quick reply"
);

const attendanceBuilder = buildKakaoSkillResponse({
  userRequest: {
    utterance: attendanceBuilderReply.messageText
  }
});
const attendanceBuilderText = attendanceBuilder.template.outputs[0].simpleText.text;
assert.match(attendanceBuilderText, /필요 정보|대상 신분|증빙|소속 교육청/);
const sickLeaveExampleReply = attendanceBuilder.template.quickReplies.find((reply) => reply.label === "병가 예시");
assert.ok(sickLeaveExampleReply, "Expected a sick-leave example quick reply");
assert.match(sickLeaveExampleReply.messageText, /기간제교사|병가 7일|진단서/);

const sickLeaveExampleAnswer = buildKakaoSkillResponse({
  userRequest: {
    utterance: sickLeaveExampleReply.messageText
  }
});
assert.match(sickLeaveExampleAnswer.template.outputs[0].simpleText.text, /60일|180일|진단서|6일/);

const budget = buildKakaoSkillResponse({
  userRequest: {
    utterance: "학교 예산 편성과 지출 증빙은 어떻게 하나요?"
  }
});
assert.equal(budget.version, "2.0");
assert.ok(budget.template.quickReplies.some((reply) => /교육청/.test(reply.label + reply.messageText)));

const outsideTravel = buildKakaoSkillResponse({
  userRequest: {
    utterance: "경주 소재 학교장의 대구 출장시 출장비는?"
  }
});
const outsideTravelText = outsideTravel.template.outputs[0].simpleText.text;
assert.match(outsideTravelText, /근무지 외 국내출장 기준/);
assert.doesNotMatch(outsideTravelText, /근무지 내 출장인지,\s*근무지 외 국내출장인지 가른/);
assert.ok(
  outsideTravel.template.outputs[0].simpleText.text.length <= 430,
  `Outside-travel Kakao simpleText is too long: ${outsideTravel.template.outputs[0].simpleText.text.length}`
);

const outsideTravelChat = handlePolicyChatRequest({
  question: "경주 소재 학교장의 대구 출장시 출장비는?"
});
assert.doesNotMatch(outsideTravelChat.responseText, /근무지 내 출장인지,\s*근무지 외 국내출장인지 가른/);
assert.ok(["definitive", "conditional"].includes(outsideTravelChat.answerState.status));
assert.ok(
  [...outsideTravelChat.answerState.definitiveAnswers, ...outsideTravelChat.answerState.conditionalAnswers]
    .some((text) => /근무지 외 국내출장 기준/.test(text))
);

const schoolAdminOvernightTravel = buildKakaoSkillResponse({
  userRequest: {
    utterance: "포항에 있는 학교의 행정실 주무관의 안동 1박2일 출장시 출장비는?"
  }
});
const schoolAdminOvernightTravelText = schoolAdminOvernightTravel.template.outputs[0].simpleText.text;
assert.match(schoolAdminOvernightTravelText, /출장비|일비|식비|숙박비/);
assert.match(schoolAdminOvernightTravelText, /170,000원|일비 50,000원|식비 50,000원|숙박비 70,000원/);
assert.doesNotMatch(schoolAdminOvernightTravelText, /무엇을 원하는지|할 수 있는 일이 아니|이해하기 어려워요/);
assert.ok(
  schoolAdminOvernightTravelText.length <= 430,
  `School-admin overnight travel Kakao simpleText is too long: ${schoolAdminOvernightTravelText.length}`
);

const schoolAdminHeadOvernightTravel = handlePolicyChatRequest({
  question: "포항에 있는 학교의 행정실장이 안동 1박2일 출장시 출장비는?"
});
assert.equal(schoolAdminHeadOvernightTravel.semanticFrame.domainCode, "domesticTravelExpense");
assert.match(schoolAdminHeadOvernightTravel.responseText, /포항시에서 안동시로 이동하는 근무지 외 국내출장/);
assert.match(schoolAdminHeadOvernightTravel.responseText, /최대 170,000원|일비 50,000원|식비 50,000원|숙박비 70,000원/);

const normalizedTravelExpression = handlePolicyChatRequest({
  question: "포항시 소재 학교 지방공무원 행정직이 안동시로 1박 2일 근무지 외 국내출장을 갈 때 출장비는?"
});
assert.equal(normalizedTravelExpression.semanticFrame.domainCode, "domesticTravelExpense");
assert.ok(!normalizedTravelExpression.missingSlots.includes("destination"));
assert.match(normalizedTravelExpression.responseText, /안동시|최대 170,000원/);
assert.doesNotMatch(normalizedTravelExpression.responseText, /지역 미특정/);

const resolvedSlotGuard = buildKakaoSkillResponseFromResult({
  ok: true,
  question: "경주 소재 학교장의 대구 출장시 출장비는?",
  officeLabel: "경상북도교육청",
  needsClarification: false,
  missingSlots: [],
  semanticFrame: {
    domainCode: "domesticTravelExpense",
    domainLabel: "국내 출장 여비",
    lookupStatus: "ready"
  },
  policyResponse: {
    title: "국내 출장 여비 확인 기준",
    lead: "출장비는 먼저 근무지 내 출장인지, 근무지 외 국내출장인지 가른 뒤 공무원 여비 규정을 적용합니다.",
    answer: [
      "경주시에서 대구광역시로 이동하는 출장이므로 근무지 외 국내출장 기준으로 일비와 식비를 적용합니다."
    ]
  }
});
const resolvedSlotGuardText = resolvedSlotGuard.template.outputs[0].simpleText.text;
assert.match(resolvedSlotGuardText, /경주시에서 대구광역시로 이동하는 출장/);
assert.doesNotMatch(resolvedSlotGuardText, /먼저 근무지 내 출장인지/);

const unresolvedSlotGuard = buildKakaoSkillResponseFromResult({
  ok: true,
  question: "학교장 출장비는?",
  officeLabel: "경상북도교육청",
  needsClarification: true,
  missingSlots: ["travelerRole"],
  semanticFrame: {
    domainCode: "domesticTravelExpense",
    domainLabel: "국내 출장 여비",
    lookupStatus: "needsSlotConfirmation"
  },
  policyResponse: {
    title: "국내 출장 여비 확인 기준",
    lead: "출장비는 먼저 근무지 내 출장인지, 근무지 외 국내출장인지 가른 뒤 공무원 여비 규정을 적용합니다.",
    answer: [
      "학교장 신분과 출장지가 확인되면 국내출장 기준으로 일비와 식비를 계산합니다."
    ]
  }
});
const unresolvedSlotGuardText = unresolvedSlotGuard.template.outputs[0].simpleText.text;
assert.match(unresolvedSlotGuardText, /확인 필요/);
assert.match(unresolvedSlotGuardText, /먼저 근무지 내 출장인지/);

const explicitOffice = handlePolicyChatRequest({
  question: "부산교육청 기준으로 방과후학교 수강료 환불은 어떻게 하나요?",
  roleLabel: "학부모"
});
assert.equal(explicitOffice.officeLabel, "부산광역시교육청");
assert.equal(explicitOffice.semanticFrame.domainCode, "afterSchoolChildcare");
assert.doesNotMatch(explicitOffice.responseText, /교육청을 고르지 않아/);

const wranglerConfig = readFileSync(new URL("../workers/ai-analysis/wrangler.toml", import.meta.url), "utf-8");
const workerSource = readFileSync(new URL("../workers/ai-analysis/src/index.js", import.meta.url), "utf-8");
const firebaseConfig = readFileSync(new URL("../public/firebase-config.js", import.meta.url), "utf-8");
const indexSource = readFileSync(new URL("../public/index.html", import.meta.url), "utf-8");
const authSource = readFileSync(new URL("../public/auth.js", import.meta.url), "utf-8");
const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf-8");
const stylesSource = readFileSync(new URL("../public/styles.css", import.meta.url), "utf-8");
const publicResourceIndexSource = readFileSync(new URL("../public/public-resource-index-generated.js", import.meta.url), "utf-8");
assert.match(wranglerConfig, /OPENAI_MONTHLY_STOP_USD\s*=\s*"20"/);
assert.match(wranglerConfig, /OPENAI_DAILY_CALL_LIMIT\s*=\s*"1000"/);
assert.match(wranglerConfig, /KAKAO_GPT_NORMALIZER_ENABLED\s*=\s*"false"/);
assert.match(wranglerConfig, /KAKAO_GPT_NORMALIZER_MODE\s*=\s*"off"/);
assert.match(wranglerConfig, /KAKAO_GPT_NORMALIZER_MIN_CONFIDENCE\s*=\s*"0\.82"/);
assert.match(wranglerConfig, /KAKAO_GPT_NORMALIZER_TIMEOUT_MS\s*=\s*"1800"/);
assert.match(wranglerConfig, /KAKAO_NLU_MODEL\s*=\s*"gpt-5\.4-nano"/);
assert.match(wranglerConfig, /KAKAO_AUTH_REQUIRED\s*=\s*"false"/);
assert.match(wranglerConfig, /KAKAO_APPROVED_USER_KEYS\s*=\s*""/);
assert.match(wranglerConfig, /POLICY_GPT_NORMALIZER_ENABLED\s*=\s*"true"/);
assert.match(wranglerConfig, /POLICY_GPT_NORMALIZER_MODE\s*=\s*"auto"/);
assert.match(wranglerConfig, /POLICY_GPT_NORMALIZER_MIN_CONFIDENCE\s*=\s*"0\.82"/);
assert.match(wranglerConfig, /POLICY_GPT_ANSWER_ENABLED\s*=\s*"true"/);
assert.match(wranglerConfig, /POLICY_GPT_ANSWER_MODE\s*=\s*"always"/);
assert.match(wranglerConfig, /FIREBASE_TRUSTED_PROJECT_IDS\s*=\s*"gyo6-law-info,gyo6--ebook"/);
assert.match(wranglerConfig, /AUTH_REQUIRED\s*=\s*"true"/);
assert.match(firebaseConfig, /GYO6_FIREBASE_CONFIG\s*=\s*\{\}/);
assert.match(firebaseConfig, /GYO6_FIREBASE_CONFIG_URL\s*=\s*"\/__\/firebase\/init\.json"/);
assert.doesNotMatch(firebaseConfig, /apiKey:\s*["']/);
assert.doesNotMatch(firebaseConfig, /AIza/);
assert.match(firebaseConfig, /GYO6_AUTH_REQUIRED\s*=\s*true/);
assert.match(indexSource, /설탕과소금 상담자료실/);
assert.match(indexSource, /로그인 없이 이용하는 상담자료실/);
assert.match(indexSource, /public-resource-controls/);
assert.match(indexSource, /resource-browser/);
assert.match(indexSource, /id="resourceSearch"/);
assert.match(indexSource, /resource-classify-panel/);
assert.match(indexSource, /resource-keyword-panel/);
assert.match(indexSource, /id="resourceTypeSelect"/);
assert.match(indexSource, /id="resourceLevel1Select"/);
assert.match(indexSource, /id="resourceLevel2Select"/);
assert.match(indexSource, /id="resourceLevel3Select"/);
assert.match(indexSource, /id="resourceSearchButton"/);
assert.match(indexSource, /id="resourceResetButton"/);
assert.match(indexSource, /public-resource-index-generated\.js\?v=20260708-resource-levels-v1/);
assert.match(appSource, /function initializePublicResourceLibrary/);
assert.match(appSource, /GYO6_POLICY_CORPUS/);
assert.match(appSource, /GYO6_POLICY_SOURCE_EXPANSION_GENERATED/);
assert.match(appSource, /GYO6_PUBLIC_RESOURCE_INDEX/);
assert.match(appSource, /PUBLIC_RESOURCE_CATEGORIES/);
assert.match(appSource, /PUBLIC_RESOURCE_LEVEL2_RULES/);
assert.match(appSource, /function classifyPublicResourceCategory/);
assert.match(appSource, /function updatePublicResourceHierarchyControls/);
assert.match(appSource, /function buildPublicResourceHierarchy/);
assert.match(appSource, /function extractLawResource/);
assert.match(appSource, /function getPublicResourceSearchTokens/);
assert.match(appSource, /function isPublicResourceDisplayReady/);
assert.match(publicResourceIndexSource, /"searchOnly": 0/);
assert.doesNotMatch(publicResourceIndexSource, /google\.com\/search/);
assert.doesNotMatch(publicResourceIndexSource, /법령\/[^"']*교원휴가/);
assert.doesNotMatch(publicResourceIndexSource, /법령\/[^"']*및[^"']*기준/);
assert.doesNotMatch(publicResourceIndexSource, /원문 후보|원문·지침 후보|검색 대행/);
assert.match(indexSource, /admin-only-tool/);
assert.match(indexSource, /학생 상담실 입장/);
assert.match(indexSource, /선생님 상담실 입장/);
assert.match(indexSource, /data-counsel-enter="student"/);
assert.match(indexSource, /data-counsel-enter="teacher"/);
assert.match(indexSource, /firebase-config\.js\?v=20260708-counsel-rooms-v1/);
assert.match(indexSource, /styles\.css\?v=20260708-resource-levels-v1/);
assert.match(indexSource, /상담자료 질문창/);
assert.match(indexSource, /소속과 주체, 생활 업무영역을 먼저 고릅니다/);
assert.match(indexSource, /무료 로컬 규정 엔진으로 답변합니다/);
assert.match(indexSource, /id="policyOffice"/);
assert.match(indexSource, /value="gyeongbuk" selected>경상북도교육청/);
assert.doesNotMatch(indexSource, /tool=legal&amp;login=law#legalTool/);
assert.match(indexSource, /질문 조건·분류/);
assert.match(indexSource, /대상 주체 <small>자동 변환값<\/small>/);
assert.match(indexSource, /1차 업무영역 <small>자동 변환값<\/small>/);
assert.match(indexSource, /세부 분류·답변 방식/);
assert.match(indexSource, /선택 사항: 필요할 때만 열기/);
assert.match(indexSource, /답변 보기/);
assert.doesNotMatch(indexSource, /href="\.\/\?tool=guide#guideQa" target="_blank"/);
assert.doesNotMatch(indexSource, /https:\/\/pf\.kakao\.com\/_TTANn\/chat/);
assert.match(indexSource, /카카오톡 챗봇/);
assert.match(indexSource, /고품질 보강 연결을 점검 중입니다/);
assert.match(indexSource, /웹 상담자료 질문창이 사무실 Ollama 보강 경로까지 확인된 공식 이용 경로입니다/);
assert.match(indexSource, /웹 상담자료 질문창으로 이동/);
assert.match(indexSource, /auth\.js\?v=20260708-counsel-rooms-v1/);
assert.match(indexSource, /policy-knowledge-base\.js\?v=20260708-counsel-rooms-v1/);
assert.match(indexSource, /policy-engine\.js\?v=20260708-counsel-rooms-v1/);
assert.match(indexSource, /app\.js\?v=20260708-resource-levels-v1/);
assert.match(authSource, /function syncAuthBodyState/);
assert.match(authSource, /auth-law-ready/);
assert.match(authSource, /gyo6-auth-state/);
assert.match(authSource, /function applyRequestedAuthOpen/);
assert.match(authSource, /function hasLoginOpenIntent/);
assert.match(authSource, /params\.get\("login"\)/);
assert.match(authSource, /\["1", "true", "law", "legal", "login"\]/);
assert.match(authSource, /details\.open = true/);
assert.match(authSource, /function formatAuthErrorMessage/);
assert.match(authSource, /configuration-not-found\|CONFIGURATION_NOT_FOUND/);
assert.match(authSource, /Authentication을 시작하고 Email\/Password 로그인 제공자를 사용 설정/);
assert.match(authSource, /data-auth-click="close-auth"/);
assert.match(workerSource, /절대 최종 답변을 생성하지 마세요/);
assert.match(workerSource, /redactSensitiveText/);
assert.match(workerSource, /openai_usage_ledger/);
assert.match(workerSource, /await handlePolicyRequest\(payload, env, authContext\)/);
assert.match(workerSource, /async function handlePolicyRequest/);
assert.match(workerSource, /assertLawAccess\(authContext, env\)/);
assert.match(workerSource, /const LAW_ACCESS_ROLES = new Set\(\["admin", "owner"\]\)/);
assert.doesNotMatch(workerSource, /const LAW_ACCESS_ROLES = new Set\(\["law", "teacher", "admin", "owner"\]\)/);
assert.match(workerSource, /shouldUsePolicyGptNormalizer/);
assert.match(workerSource, /policy_nlu/);
assert.match(workerSource, /getTrustedFirebaseProjectIds/);
assert.match(workerSource, /FIREBASE_JWKS_URL/);
assert.match(workerSource, /service_accounts\/v1\/jwk\/securetoken@system\.gserviceaccount\.com/);
assert.match(workerSource, /getFirebaseJwks/);
assert.match(workerSource, /crypto\.subtle\.importKey\(\s*"jwk"/);
assert.doesNotMatch(workerSource, /crypto\.subtle\.importKey\(\s*"spki"/);
assert.match(workerSource, /getMemberByEmail/);
assert.match(workerSource, /emailVerified/);
assert.match(workerSource, /hasPolicyResultRegression/);
assert.match(workerSource, /hasUsableKakaoPolicyResult/);
assert.match(workerSource, /AbortController/);
assert.match(workerSource, /KAKAO_NLU_TIMEOUT/);
assert.match(workerSource, /대상 주체, 사건·사유, 업무 단계, 증빙·위험 신호의 조합을 보존/);
assert.match(workerSource, /구체 업무 물체를 버리지 마세요/);
assert.match(workerSource, /kakao_clarification_sessions/);
assert.match(workerSource, /hydrateKakaoClarificationPayload/);
assert.match(workerSource, /assertKakaoAccess/);
assert.match(workerSource, /buildKakaoAccessBlockedResponse/);
assert.match(workerSource, /registerKakaoMember/);
assert.match(workerSource, /KAKAO_AUTH_REQUIRED/);
assert.match(workerSource, /KAKAO_APPROVED_USER_KEYS/);
assert.match(workerSource, /승인 전에는 GPT 질문정규화와 답변 생성이 실행되지 않습니다/);
assert.match(workerSource, /kakao-\$\{stableHash\(userKey\)\}@kakao\.local/);
assert.match(appSource, /async function renderResult/);
assert.match(appSource, /renderFreeBasicPolicyResult/);
assert.match(appSource, /statusDot\.textContent = "기본 답변"/);
assert.doesNotMatch(appSource, /외부 AI API 호출 없이 무료 규정 엔진으로 답변했습니다/);
assert.doesNotMatch(appSource, /무료 규정 엔진으로 먼저 답변합니다/);
assert.match(appSource, /shouldTriggerPolicyQualityRecovery/);
assert.match(appSource, /renderPolicyQualityRecoveryNotice/);
assert.match(appSource, /양질의 답변을 생성하기 위해 정보를 추가로 수집 및 분석이 필요하니 조금 더 기다려 주세요/);
assert.match(appSource, /고품질 답변 보강 대기/);
assert.match(appSource, /getPolicyEngineContext/);
assert.match(appSource, /policyOfficeInput\?\.value \|\| "gyeongbuk"/);
assert.match(appSource, /getRequestedToolFromUrl/);
assert.match(appSource, /syncLawWindowMode/);
assert.match(appSource, /const requestedTool = getRequestedToolParam\(\) \|\| "legal";\s*const isToolWindow = true/);
assert.match(appSource, /law-tool-legal/);
assert.match(appSource, /law-tool-guide/);
assert.match(appSource, /function hydrateFromUrl\(\) {\s*const requestedTool = getRequestedToolParam\(\) \|\| "legal";/);
assert.match(appSource, /setSelectValue\(answerModeInput, params\.get\("answerMode"\) \|\| params\.get\("answer"\) \|\| params\.get\("mode"\)\)/);
assert.doesNotMatch(appSource, /API 과금 없는 기본 Q&amp;A는 별도 창에서만 사용할 수 있습니다/);
assert.doesNotMatch(appSource, /renderAccessBlockedLocalGuide/);
assert.match(appSource, /userSelectedTool/);
assert.match(stylesSource, /body\.law-landing \.guide-workspace/);
assert.match(stylesSource, /body\.auth-admin-ready\.law-tool-mode \.prelogin-guide/);
assert.match(stylesSource, /body\.auth-admin-ready\.law-tool-mode \.chatbot-guide/);
assert.match(stylesSource, /body:not\(\.auth-admin-ready\) \.admin-only-tool/);
assert.match(stylesSource, /\.chatbot-guide/);
assert.match(stylesSource, /\.chatbot-guide-action/);
assert.match(stylesSource, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(stylesSource, /body\.law-tool-mode \.tool-tabs/);
assert.match(stylesSource, /\.law-launch-action/);
assert.match(stylesSource, /\.auth-menu\[open\]::before/);
assert.match(stylesSource, /transform:\s*translateX\(-50%\)/);
assert.match(stylesSource, /\.intake-assist/);
assert.match(stylesSource, /\.policy-context-grid/);
assert.match(stylesSource, /\.answer-extra-panel/);
assert.doesNotMatch(stylesSource, /workspace\[data-tool-panel="legal"\]\s*\{\s*display:\s*none/s);
assert.doesNotMatch(stylesSource, /body:not\(\.auth-law-ready\) \.guide-workspace\s*\{/);

const renderResultStart = appSource.indexOf("async function renderResult");
const accessGuardIndex = appSource.indexOf("const access = await getLawInfoAccess();", renderResultStart);
const freeRenderIndex = appSource.indexOf("renderFreeBasicPolicyResult({", renderResultStart);
const earlyReturnIndex = appSource.indexOf("return;", freeRenderIndex);
assert.ok(freeRenderIndex > renderResultStart, "web law info should render the free local policy engine first");
assert.ok(earlyReturnIndex > freeRenderIndex, "web law info should not continue into paid AI analysis after free rendering");
assert.ok(accessGuardIndex < 0 || accessGuardIndex > earlyReturnIndex, "web law info should not require access before the free answer");

const freeKakaoResponse = await worker.fetch(
  new Request("https://worker.test/api/kakao/skill", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        utterance: "기간제교사의 병가는?",
        user: {
          id: "pilot-user-1",
          properties: { nickname: "테스트교사" }
        }
      }
    })
  }),
  {
    AUTH_REQUIRED: "true",
    KAKAO_AUTH_REQUIRED: "false",
    KAKAO_GPT_NORMALIZER_ENABLED: "false",
    KAKAO_GPT_ANSWER_ENABLED: "false",
    OPENAI_API_KEY: "test-key"
  }
);
const freeKakaoPayload = await freeKakaoResponse.json();
assert.equal(freeKakaoPayload.version, "2.0");
assert.doesNotMatch(freeKakaoPayload.template.outputs[0].simpleText.text, /챗봇 이용권한|승인 후|GPT 질문정규화/);
assert.match(freeKakaoPayload.template.outputs[0].simpleText.text, /병가|기간제|확인/);

function mockPolicyResult({
  domainCode,
  status = "needs_slot",
  confidence = 0.2,
  missingSlots = [],
  text = "",
  question = "",
  ok = true
} = {}) {
  return {
    ok,
    question,
    confidence,
    missingSlots,
    responseText: text,
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

const weakMisclassifiedBase = mockPolicyResult({
  domainCode: "schoolBudgetExecution",
  status: "needs_slot",
  confidence: 0.2,
  missingSlots: ["procedureStage"],
  text: "질문만으로는 적용 규정을 특정하기 어렵습니다. 계약인지 지출인지 먼저 확인해야 합니다."
});
const normalizedAfterSchoolCandidate = mockPolicyResult({
  domainCode: "afterSchoolChildcare",
  status: "definitive",
  confidence: 0.65,
  missingSlots: [],
  text: "방과후학교·돌봄·늘봄 운영 사안입니다. 위탁 계약과 학생 안전관리 절차를 확인합니다."
});
assert.equal(
  chooseBetterPolicyResult(weakMisclassifiedBase, normalizedAfterSchoolCandidate),
  normalizedAfterSchoolCandidate,
  "GPT normalizer candidate should be allowed to replace a weak misclassified base result"
);
assert.ok(
  scorePolicyResult(normalizedAfterSchoolCandidate) > scorePolicyResult(weakMisclassifiedBase),
  "normalized candidate should score better than weak base"
);

const strongTravelBase = mockPolicyResult({
  domainCode: "domesticTravelExpense",
  status: "definitive",
  confidence: 0.9,
  missingSlots: [],
  text: "출장비는 근무지 외 국내출장 기준으로 일비, 식비, 숙박비 합계 170,000원입니다."
});
const wrongDomainCandidate = mockPolicyResult({
  domainCode: "schoolBudgetExecution",
  status: "definitive",
  confidence: 0.7,
  missingSlots: [],
  text: "학교회계 지출 증빙 절차를 확인합니다."
});
assert.equal(
  chooseBetterPolicyResult(strongTravelBase, wrongDomainCandidate),
  strongTravelBase,
  "GPT normalizer candidate should not replace a strong usable base result"
);

const laborCounselingBase = mockPolicyResult({
  domainCode: "careerEmploymentGuidance",
  status: "needs_slot",
  confidence: 0.45,
  missingSlots: ["evidence"],
  question: "졸업생 근로계약 임금체불 상담 기준, 처리 절차, 필요한 증빙자료를 알려주세요.",
  text: "졸업생 근로계약과 임금체불은 취업지도·졸업생 노동상담 기준으로 확인합니다."
});
const wrongCounselingRecordCandidate = mockPolicyResult({
  domainCode: "healthInfectionCounseling",
  status: "definitive",
  confidence: 0.75,
  missingSlots: [],
  question: "필요한 증빙자료와 상담기록을 알려주세요.",
  text: "학생 상담기록은 비밀보호와 기록 보존 기준을 확인합니다."
});
assert.equal(
  chooseBetterPolicyResult(laborCounselingBase, wrongCounselingRecordCandidate),
  laborCounselingBase,
  "GPT normalizer candidate should not override strong graduate labor counseling anchors"
);

const slotLosingCandidate = mockPolicyResult({
  domainCode: "domesticTravelExpense",
  status: "needs_slot",
  confidence: 0.7,
  missingSlots: ["destination"],
  text: "출장비는 출장지 확인 후 계산합니다."
});
assert.equal(
  hasPolicyResultRegression(weakMisclassifiedBase, slotLosingCandidate, {
    baseScore: scorePolicyResult(weakMisclassifiedBase),
    normalizedScore: scorePolicyResult(slotLosingCandidate) + 20
  }),
  true,
  "GPT normalizer candidate should be rejected when it introduces a new critical missing slot"
);

console.log("Kakao skill regression passed");
