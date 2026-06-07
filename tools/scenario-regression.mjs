import fs from "node:fs";
import vm from "node:vm";

const code = fs.readFileSync("public/app.js", "utf8");

const stubElement = {
  addEventListener() {},
  appendChild() {},
  remove() {},
  requestSubmit() {},
  querySelector() { return stubElement; },
  querySelectorAll() { return []; },
  classList: { add() {}, remove() {}, toggle() {} },
  style: {},
  dataset: {},
  value: "",
  innerHTML: "",
  textContent: "",
  firstElementChild: null,
  options: []
};

const context = {
  console,
  Blob: class {},
  URLSearchParams,
  URL: { createObjectURL() { return ""; }, revokeObjectURL() {} },
  document: {
    body: stubElement,
    createElement() { return stubElement; },
    querySelector() { return stubElement; },
    querySelectorAll() { return []; }
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  window: {
    addEventListener() {},
    setTimeout() {},
    open() { return null; },
    print() {},
    confirm() { return true; },
    location: { hash: "", search: "" }
  }
};

vm.createContext(context);
vm.runInContext(code, context, { filename: "app.js" });

const accidentWords = ["다친 학생", "팔 골절", "치료와 안전 확보", "진단서", "산업재해조사표"];
const educationDraftText = "교육청 보고 초안";
const noAccidentReport = [educationDraftText, ...accidentWords, "사고 발생 보고 초안"];
const noSpecialistReferral = ["노무사 상담 우선 검토", "변호사 상담 검토", "노무사·변호사 병행 상담"];

const cases = [
  {
    id: "field-scope-cleaning",
    question: "현장실습 중인 학생에게 기존 근로자가 근무시간 중에 청소를 자꾸 시킵니다. 생산에 필요한 재료를 가져오라 하면서 주변 청소를 반복적으로 시키고, 어떨 때는 필요도 없는 재료를 가져오라 하며 또 청소를 시킵니다.",
    expect: { preset: "fieldTraining", scenario: "fieldTrainingScopeIssue", disposition: "internal" },
    mustInclude: ["업무 범위", "반복 지시", "현장실습계약서"],
    mustNotInclude: [...accidentWords, educationDraftText, "중대재해"]
  },
  {
    id: "field-scope-generic-off-duty",
    question: "현장 실습 중 업무외 일을 시키는 것은 어떻게 해야 할까요?",
    expect: { preset: "fieldTraining", scenario: "fieldTrainingScopeIssue", disposition: "internal" },
    mustInclude: ["업무 외 지시", "업무 범위", "현장실습계약서"],
    mustNotInclude: ["청소", "재료", "기존 근로자", "기존근로자", "반복 청소", ...accidentWords, educationDraftText]
  },
  {
    id: "field-scope-personal-errand",
    question: "현장실습 중 회사 직원이 개인 심부름을 시킵니다. 실습 업무와 관련 없는 일 같아 학교에 어떻게 말해야 할까요?",
    expect: { preset: "fieldTraining", scenario: "fieldTrainingScopeIssue", disposition: "internal" },
    mustInclude: ["사적 심부름", "현장실습", "업무 범위"],
    mustNotInclude: ["청소", "재료 운반", "반복 청소", ...accidentWords, educationDraftText]
  },
  {
    id: "field-after-hours-cleaning",
    question: "현장 실습생의 고충입니다. 현장실습 시간 종료 후에 자꾸 청소를 시킨다고 학생이 고민을 요청합니다. 이럴 경우에 대처 방안을 알려주세요.",
    expect: { preset: "fieldTraining", scenario: "fieldTrainingScopeIssue", disposition: "internal" },
    checkRefinement: true,
    mustInclude: ["실습시간 종료 후 청소 지시", "실습시간", "청소", "현장실습계약서"],
    mustNotInclude: ["재료", "재료 운반", "기존 근로자", "기존근로자", ...accidentWords, educationDraftText]
  },
  {
    id: "field-cleaning-only-no-material",
    question: "현장실습생이 매일 청소만 반복해서 시킨다고 고충을 말했습니다. 실습 업무와 관련 있는지 확인하고 싶습니다.",
    expect: { preset: "fieldTraining", scenario: "fieldTrainingScopeIssue", disposition: "internal" },
    checkRefinement: true,
    mustInclude: ["청소 지시", "업무 범위", "현장실습계약서"],
    mustNotInclude: ["재료", "재료 운반", "기존 근로자", "기존근로자", ...accidentWords, educationDraftText]
  },
  {
    id: "field-accident-fracture",
    question: "현장실습 중 학생이 실습시간 안에 프레스 기계 주변에서 작업하다 팔 골절상을 입었습니다. 보호자에게 연락했고 병원 치료 중입니다.",
    expect: { preset: "fieldTraining", scenario: "fieldTrainingAccident", disposition: "education-report" },
    mustInclude: [educationDraftText, "진단서", "산업재해"],
    mustNotInclude: ["업무범위·반복 지시 사안"]
  },
  {
    id: "workplace-harassment-staff",
    question: "행정실 기간제근로자가 상급자에게 매일 공개적으로 모욕을 듣고, 개인 심부름과 불필요한 야근 지시를 반복적으로 받습니다. 직장 내 괴롭힘인지 학교가 어떻게 확인해야 하나요?",
    expect: { preset: "staffLabor", disposition: "internal" },
    mustInclude: ["근로기준법", "직장 내 괴롭힘"],
    mustNotInclude: ["학교폭력", educationDraftText, ...accidentWords]
  },
  {
    id: "fixed-term-renewal-complaint",
    question: "학교 행정실 기간제근로자가 계약 갱신 기대권이 있었는데 갑자기 재계약을 하지 않겠다는 통보를 받았다고 민원을 제기했습니다.",
    expect: { preset: "staffLabor", disposition: "internal" },
    mustInclude: ["기간제", "계약"],
    mustNotInclude: [educationDraftText, ...accidentWords]
  },
  {
    id: "minor-parent-complaint",
    question: "학부모가 담임교사의 전화 응대가 불친절했다며 민원을 제기했습니다. 학생 피해나 징계 요구는 없고 사과와 재발방지 안내를 원합니다.",
    expect: { preset: "civilComplaint", disposition: "internal" },
    mustInclude: ["민원", "상담"],
    mustNotInclude: [educationDraftText, ...accidentWords, "노무사 상담"]
  },
  {
    id: "serious-accident-prevention",
    question: "학교장이 중대재해처벌법 대비를 위해 안전보건관리체계와 위험성평가 점검표를 만들고 싶습니다. 사고가 발생한 것은 아닙니다.",
    expect: { preset: "schoolSafety", disposition: "internal" },
    mustInclude: ["안전보건", "관리체계"],
    mustNotInclude: [educationDraftText, "사고 발생 보고 초안", ...accidentWords]
  },
  {
    id: "serious-accident-event",
    question: "학교 시설 공사 중 외부 용역 근로자가 추락해 사망했습니다. 중대재해처벌법과 교육청 보고 초안을 검토해야 합니다.",
    expect: { preset: "schoolSafety", disposition: "education-report" },
    mustInclude: [educationDraftText, "사망", "중대재해"],
    mustNotInclude: ["현장실습생에게 재료 운반", "현장실습 안전사고 발생 보고 초안"]
  },
  {
    id: "school-violence-student",
    question: "학생 사이 단체 채팅방 괴롭힘과 욕설이 있었고 피해 학생 보호 조치와 학교폭력 절차가 궁금합니다.",
    expect: { preset: "schoolViolence", disposition: "internal" },
    mustInclude: ["학교폭력", "피해학생"],
    mustNotInclude: [educationDraftText, "근로기준법 제76조"]
  },
  {
    id: "overseas-training-parent",
    question: "호주 해외 현장실습 파견 전 보험과 보호자 동의서, 현지 숙소 안전 확인 자료를 어떻게 챙겨야 하나요?",
    expect: { preset: "overseasTraining", disposition: "internal" },
    mustInclude: ["해외", "보험", "보호자"],
    mustNotInclude: [educationDraftText, ...accidentWords]
  },
  {
    id: "teacher-duty-complaint",
    question: "기간제교사가 수업 외 행사 업무를 너무 많이 배정받아 복무와 업무분장 민원을 제기했습니다. 괴롭힘이라고 단정하기는 어렵습니다.",
    expect: { preset: "staffLabor", disposition: "internal" },
    mustInclude: ["기간제", "복무"],
    mustNotInclude: ["학교폭력", educationDraftText, ...accidentWords]
  },
  {
    id: "field-danger-cleaning-no-injury",
    question: "현장실습생에게 가동 중인 기계 주변 청소를 반복 지시합니다. 아직 다친 것은 아니지만 위험해서 학교가 기업에 중단 요청을 해야 할지 궁금합니다.",
    expect: { preset: "fieldTraining", scenario: "fieldTrainingScopeIssue", disposition: "education-review" },
    mustInclude: ["업무 범위", "위험", "안전교육"],
    mustNotInclude: [educationDraftText, "진단서", "팔 골절"]
  },
  {
    id: "field-night-overtime",
    question: "현장실습 학생이 기업에서 밤 9시까지 잔업을 하라고 지시받았습니다. 실습시간과 보호자 안내, 학교 조치가 궁금합니다.",
    expect: { preset: "fieldTraining", disposition: "internal" },
    mustInclude: ["직업교육훈련 촉진법", "현장실습"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "field-production-quota-pressure",
    question: "특성화고 현장실습생에게 정규 직원처럼 생산량 목표를 채우라고 압박하고 평가 불이익을 말합니다. 사고는 없지만 학생이 많이 힘들어합니다.",
    expect: { preset: "fieldTraining", scenario: "fieldTrainingScopeIssue", disposition: "education-review" },
    mustInclude: ["현장실습", "학생 권익"],
    mustNotInclude: ["팔 골절", "진단서", educationDraftText]
  },
  {
    id: "apprenticeship-training-allowance",
    question: "도제학교 참여 학생의 기업훈련 시간이 길어지고 훈련수당 지급 기준이 애매합니다. 학교가 어떤 자료를 확인해야 하나요?",
    expect: { preset: "apprenticeship", disposition: "internal" },
    mustInclude: ["도제학교", "일학습병행"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "apprenticeship-company-evaluation-disadvantage",
    question: "산학일체형 도제학교 학생이 기업훈련 평가에서 불이익을 받을까 봐 부당한 지시를 말하지 못합니다. 학교 상담 기록과 기업 확인 방법이 필요합니다.",
    expect: { preset: "apprenticeship", disposition: "internal" },
    mustInclude: ["도제학교", "학생 보호"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "overseas-training-insurance-housing",
    question: "호주 글로벌 현장학습 파견 전에 보험, 숙소 안전, 현지 비상연락망, 보호자 동의서까지 한 번에 점검하고 싶습니다.",
    expect: { preset: "overseasTraining", disposition: "internal" },
    mustInclude: ["해외", "보험", "보호자"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "overseas-training-local-curfew",
    question: "해외 현장실습 중 현지 숙소에서 통금과 생활규칙을 강하게 요구해 학생 민원이 있습니다. 사고나 폭행은 없고 절차와 안내가 필요합니다.",
    expect: { preset: "overseasTraining", disposition: "internal" },
    mustInclude: ["해외", "현지"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "staff-education-worker-harassment",
    question: "교육공무직 조리실무사가 상급자에게 공개 모욕과 사적 심부름 지시를 반복적으로 받았다고 직장 내 괴롭힘 신고를 했습니다.",
    expect: { preset: "staffLabor", disposition: "internal" },
    mustInclude: ["근로기준법", "직장 내 괴롭힘"],
    mustNotInclude: ["학교폭력", educationDraftText, ...accidentWords]
  },
  {
    id: "staff-sexual-harassment",
    question: "행정실 직원이 회식 자리와 메신저에서 성희롱성 발언을 반복적으로 받았다고 상담을 요청했습니다. 학교가 내부 조사와 외부 상담을 어떻게 나눠야 하나요?",
    expect: { preset: "staffLabor", disposition: "specialist" },
    mustInclude: ["근로기준법"],
    mustNotInclude: ["학교폭력", educationDraftText, ...accidentWords]
  },
  {
    id: "fixed-term-sick-leave",
    question: "기간제교사가 병가 사용 후 계약 연장이나 복무평가에서 불리해질까 걱정하며 민원을 냈습니다. 병가와 복무 기준을 확인하고 싶습니다.",
    expect: { preset: "staffLabor", disposition: "internal" },
    mustInclude: ["기간제", "복무"],
    mustNotInclude: [educationDraftText, ...accidentWords]
  },
  {
    id: "fixed-term-admin-annual-leave-pay",
    question: "상근 기간제 행정직원이 연차수당과 방학 중 근무 처리 기준을 문의했습니다. 학교 내부 안내용으로 정리해야 합니다.",
    expect: { preset: "staffLabor", disposition: "internal" },
    mustInclude: ["기간제", "근로기준법"],
    mustNotInclude: [educationDraftText, ...accidentWords]
  },
  {
    id: "labor-dismissal-nonrenewal-threat",
    question: "학교 계약직 직원이 문제 제기 후 해고나 재계약 불이익을 암시받았다고 말합니다. 아직 통보는 없고 상담 기록을 남기려 합니다.",
    expect: { preset: "staffLabor", disposition: "specialist" },
    mustInclude: ["근로기준법", "계약"],
    mustNotInclude: ["학교폭력", educationDraftText, ...accidentWords]
  },
  {
    id: "teacher-parent-verbal-abuse",
    question: "학부모가 담임교사에게 반복적으로 폭언 전화를 하고 교권침해 민원으로 이어질 수 있습니다. 학생 사안은 아니고 교사 보호 조치가 필요합니다.",
    expect: { preset: "staffLabor", disposition: "internal" },
    mustInclude: ["교직원", "민원"],
    mustNotInclude: ["학교폭력", educationDraftText, ...accidentWords]
  },
  {
    id: "teacher-child-abuse-report",
    question: "교사가 생활지도 중 아동학대 신고를 당했습니다. 신체접촉은 없고 수업 방해 학생에게 자리 이동을 지시한 사안입니다.",
    expect: { preset: "civilComplaint", disposition: "specialist" },
    mustInclude: ["생활지도", "민원", "형사·민사 전환 가능성", "아동학대"],
    mustNotInclude: [educationDraftText, ...accidentWords]
  },
  {
    id: "teacher-phone-confiscation-complaint",
    question: "수업 중 휴대전화를 보관했다가 학부모가 학생 인권 침해라고 민원을 냈습니다. 학교 규정과 안내 문구가 필요합니다.",
    expect: { preset: "civilComplaint", disposition: "internal" },
    mustInclude: ["학생관리", "민원"],
    mustNotInclude: [...noAccidentReport, ...noSpecialistReferral]
  },
  {
    id: "parent-grade-record-correction",
    question: "학부모가 생활기록부 문구를 고쳐 달라고 요구하며 교육청 민원을 예고했습니다. 사실 확인과 답변 방향이 필요합니다.",
    expect: { preset: "schoolAdministration", disposition: "internal" },
    mustInclude: ["학교생활기록", "민원"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "minor-meal-complaint",
    question: "학부모가 급식 반찬이 마음에 들지 않는다며 학교장 면담을 요구했습니다. 학생 피해나 식중독은 없고 단순 민원입니다.",
    expect: { preset: "civilComplaint", disposition: "internal" },
    mustInclude: ["민원", "상담"],
    mustNotInclude: [...noAccidentReport, ...noSpecialistReferral, "중대재해"]
  },
  {
    id: "minor-unfriendly-call",
    question: "민원인이 행정실 전화 응대가 불친절했다며 사과를 요구합니다. 금전 피해나 징계 요구는 없습니다.",
    expect: { preset: "civilComplaint", disposition: "internal" },
    mustInclude: ["민원"],
    mustNotInclude: [...noAccidentReport, ...noSpecialistReferral]
  },
  {
    id: "attendance-document-question",
    question: "학부모가 인정결석 서류가 너무 많다며 출결 처리 기준을 묻습니다. 분쟁보다는 안내문이 필요한 상황입니다.",
    expect: { preset: "schoolAdministration", disposition: "internal" },
    mustInclude: ["출결", "민원"],
    mustNotInclude: [...noAccidentReport, ...noSpecialistReferral]
  },
  {
    id: "student-counseling-privacy",
    question: "학생이 상담 내용이 다른 선생님에게 전달된 것 같다며 고충을 제기했습니다. 민감정보를 최소화하면서 확인해야 합니다.",
    expect: { preset: "civilComplaint", disposition: "internal" },
    mustInclude: ["학생관리", "상담"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "student-dormitory-allocation",
    question: "기숙사 배정에서 특정 학과 학생이 불리하다는 고충이 접수됐습니다. 차별로 단정하기 전 확인 절차가 필요합니다.",
    expect: { preset: "civilComplaint", disposition: "internal" },
    mustInclude: ["학생관리", "민원"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "student-exam-misconduct-misunderstanding",
    question: "시험 중 부정행위로 오해받은 학생이 이의제기했습니다. 징계 전 사실 확인과 의견청취 절차가 궁금합니다.",
    expect: { preset: "civilComplaint", disposition: "specialist" },
    mustInclude: ["행정절차법", "학생관리"],
    mustNotInclude: [educationDraftText, ...accidentWords]
  },
  {
    id: "school-violence-chat-exclusion",
    question: "학생들이 단체채팅방에서 한 학생을 초대했다가 반복적으로 욕설하고 따돌렸습니다. 피해학생 보호와 학교폭력 절차가 필요합니다.",
    expect: { preset: "schoolViolence", disposition: "internal" },
    mustInclude: ["학교폭력", "피해학생"],
    mustNotInclude: ["근로기준법", educationDraftText, ...accidentWords]
  },
  {
    id: "school-violence-retaliation-risk",
    question: "학교폭력 신고 후 가해학생 친구들이 피해학생에게 보복성 메시지를 보냅니다. 긴급 보호 조치를 어떻게 정리해야 하나요?",
    expect: { preset: "schoolViolence", disposition: "specialist" },
    mustInclude: ["학교폭력", "피해학생"],
    mustNotInclude: ["근로기준법", educationDraftText, ...accidentWords]
  },
  {
    id: "school-violence-cyber-defamation",
    question: "학생 인스타그램에 다른 학생을 비방하는 글이 올라왔고 명예훼손과 학교폭력 절차가 모두 걱정됩니다.",
    expect: { preset: "schoolViolence", disposition: "specialist" },
    mustInclude: ["학교폭력", "전담기구", "형사·민사 전환 가능성", "명예훼손"],
    mustNotInclude: ["근로기준법", educationDraftText, ...accidentWords]
  },
  {
    id: "student-assault-criminal-civil",
    question: "학생이 친구에게 폭행을 당해 병원 치료를 받았고 학부모가 고소 가능성, 벌금이나 형량, 치료비 손해배상까지 문의합니다. 학교폭력 절차와 함께 어떤 자료를 준비해야 하나요?",
    expect: { preset: "schoolViolence", disposition: "specialist" },
    mustInclude: ["학교폭력", "형사·민사 전환 가능성", "감경·감량", "손해배상"],
    mustNotInclude: ["근로기준법", educationDraftText]
  },
  {
    id: "school-safety-lab-chemical-leak",
    question: "과학실에서 화학물질 냄새가 나서 학생들이 두통을 호소했습니다. 병원 이송은 없지만 환기와 보호자 안내, 안전점검이 필요합니다.",
    expect: { preset: "schoolSafety", disposition: "internal" },
    mustInclude: ["안전", "학교"],
    mustNotInclude: [educationDraftText, "산업재해조사표", "팔 골절"]
  },
  {
    id: "school-safety-pe-minor-bruise",
    question: "체육시간에 학생이 넘어져 가벼운 타박상을 입었습니다. 학부모에게 전달하고 학교안전공제 가능성만 안내하려 합니다.",
    expect: { preset: "schoolSafety", disposition: "internal" },
    mustInclude: ["학교 안전"],
    mustNotInclude: [educationDraftText, "중대재해", "산업재해조사표"]
  },
  {
    id: "school-safety-food-worker-burn",
    question: "학교 급식실 조리실무사가 뜨거운 물에 화상을 입어 병원 치료를 받았습니다. 산업안전보건과 산재 절차를 확인해야 합니다.",
    expect: { preset: "schoolSafety", disposition: "education-report" },
    mustInclude: [educationDraftText, "산업안전보건법"],
    mustNotInclude: ["현장실습 안전사고 발생 보고 초안"]
  },
  {
    id: "school-safety-facility-contractor-near-miss",
    question: "학교 시설 공사 중 외부업체 작업자가 추락할 뻔한 아차사고가 있었습니다. 다친 사람은 없고 재발방지와 중대재해 예방 점검이 필요합니다.",
    expect: { preset: "schoolSafety", disposition: "internal" },
    mustInclude: ["안전보건", "예방"],
    mustNotInclude: [educationDraftText, "사망", "진단서"]
  },
  {
    id: "school-safety-facility-contractor-death",
    question: "학교 증축 공사 현장에서 외부업체 근로자가 추락해 사망했습니다. 학교장과 교육청 보고, 중대재해처벌법 검토가 필요합니다.",
    expect: { preset: "schoolSafety", disposition: "education-report" },
    mustInclude: [educationDraftText, "중대재해", "사망"],
    mustNotInclude: ["현장실습 안전사고 발생 보고 초안"]
  },
  {
    id: "serious-accident-training-request",
    question: "학교 관리자가 중대재해처벌법 교육자료와 위탁업체 안전점검 체크리스트를 만들고 싶습니다. 사고는 없습니다.",
    expect: { preset: "schoolSafety", scenario: "safetyPrevention", disposition: "internal" },
    mustInclude: ["예방", "안전보건관리체계"],
    mustNotInclude: [educationDraftText, "사고 발생 보고 초안", "진단서"]
  },
  {
    id: "employment-job-offer-contract",
    question: "특성화고 졸업예정 학생이 회사에서 구두로 채용 약속을 받았는데 근로계약서 작성 전 조건이 바뀌었습니다. 취업지도 자료가 필요합니다.",
    expect: { preset: "employment", disposition: "internal" },
    mustInclude: ["근로계약", "취업"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "employment-wage-delay",
    question: "졸업생이 취업 후 첫 월급 일부가 지연됐다고 학교에 문의했습니다. 임금체불 가능성과 확인 자료를 안내하고 싶습니다.",
    expect: { preset: "employment", disposition: "internal" },
    mustInclude: ["임금", "근로기준법"],
    mustNotInclude: noAccidentReport
  },
  {
    id: "employment-probation-dismissal",
    question: "취업한 학생이 수습기간 중 갑자기 그만 나오라는 말을 들었습니다. 해고인지 권고사직인지 확인해야 합니다.",
    expect: { preset: "employment", disposition: "specialist" },
    mustInclude: ["해고", "근로기준법"],
    mustNotInclude: [educationDraftText, ...accidentWords]
  },
  {
    id: "public-recruitment-info-board",
    question: "특성화고 학생 대상 공채 정보를 게시판에 올릴 때 채용공고, 직무기술서, 지원서 양식, 접수기한을 어떻게 정리해야 하나요?",
    expect: { preset: "employment", disposition: "internal" },
    mustInclude: ["채용", "취업"],
    mustNotInclude: [...noAccidentReport, ...noSpecialistReferral]
  },
  {
    id: "company-info-for-recruitment",
    question: "직업계고 공채 안내와 함께 기업 정보, 채용 직무, 자격요건, 관련 전자책 자료를 연결하고 싶습니다. 법률상 주의사항도 알고 싶습니다.",
    expect: { preset: "employment", disposition: "internal" },
    mustInclude: ["채용", "근로계약"],
    mustNotInclude: noAccidentReport
  }
];

function buildResult(question) {
  const preset = context.findPreset(question, "auto");
  const scenario = context.analyzeQuestionScenario(question, preset);
  const displayPreset = context.getScenarioDisplayPreset(preset, scenario);
  const riskSignals = context.detectRiskSignals(question);
  const materials = context.getOfficialMaterials(displayPreset, scenario, question);
  const report = context.buildCaseReport(question, displayPreset, { label: "상황 중심" }, materials, riskSignals, scenario);
  const direct = context.getDirectAnswer(question, displayPreset, { label: "상황 중심" }, scenario);
  const refinement = context.getRefinementQuestions(question, displayPreset, "auto", riskSignals);
  const html = context.renderCaseReport(report);

  return {
    preset,
    scenario,
    displayPreset,
    report,
    direct,
    refinement,
    html,
    disposition: context.getReportDisposition(report)
  };
}

const failures = [];

for (const testCase of cases) {
  const result = buildResult(testCase.question);
  const combined = [
    result.displayPreset.title,
    result.displayPreset.summary,
    result.displayPreset.laws.join(" "),
    result.direct.title,
    result.direct.lead,
    result.html,
    ...(testCase.checkRefinement ? result.refinement.map((item) => `${item.question} ${item.reason} ${item.placeholder}`) : [])
  ].join("\n");

  if (testCase.expect?.preset && result.preset.type !== testCase.expect.preset) {
    failures.push(`${testCase.id}: preset expected ${testCase.expect.preset}, got ${result.preset.type}`);
  }
  if (testCase.expect?.scenario && result.scenario.type !== testCase.expect.scenario) {
    failures.push(`${testCase.id}: scenario expected ${testCase.expect.scenario}, got ${result.scenario.type}`);
  }
  if (testCase.expect?.disposition && result.disposition !== testCase.expect.disposition) {
    failures.push(`${testCase.id}: disposition expected ${testCase.expect.disposition}, got ${result.disposition}`);
  }

  for (const phrase of testCase.mustInclude || []) {
    if (!combined.includes(phrase)) {
      failures.push(`${testCase.id}: missing required phrase "${phrase}"`);
    }
  }

  for (const phrase of testCase.mustNotInclude || []) {
    if (combined.includes(phrase)) {
      failures.push(`${testCase.id}: forbidden phrase leaked "${phrase}"`);
    }
  }
}

const autoTopicCases = [
  {
    id: "auto-topic-field-after-hours",
    question: "현장실습 시간 종료 후 청소를 반복해서 시킨다는 상담이 들어왔습니다.",
    expected: { major: "fieldTraining", middle: "scope", minor: "afterHours", keyword: "업무범위" }
  },
  {
    id: "auto-topic-staff-bullying",
    question: "행정실 기간제근로자가 상급자에게 모욕과 개인 심부름 지시를 반복적으로 받습니다.",
    expected: { major: "staffLabor", middle: "workplaceIssue", minor: "bullying", keyword: "괴롭힘" }
  },
  {
    id: "auto-topic-recruitment-document",
    question: "고졸 공채 채용공고와 직무기술서, 접수기한을 게시판에 어떻게 정리해야 하나요?",
    expected: { major: "employment", middle: "hiring", minor: "document", keyword: "채용절차" }
  }
];

for (const testCase of autoTopicCases) {
  const preset = context.findPreset(testCase.question, "auto");
  const topicContext = context.resolveTopicContext(testCase.question, preset, { major: "auto", middle: "auto", minor: "auto", presetType: "auto", labels: [], label: "자동 분류" });
  const keywords = context.buildKeywords(testCase.question, preset, topicContext).join(" ");

  for (const [key, value] of Object.entries(testCase.expected)) {
    if (key === "keyword") {
      if (!keywords.includes(value)) {
        failures.push(`${testCase.id}: expected keyword "${value}" in "${keywords}"`);
      }
      continue;
    }
    if (topicContext[key] !== value) {
      failures.push(`${testCase.id}: ${key} expected ${value}, got ${topicContext[key]}`);
    }
  }

  if (!topicContext.autoDetected || !topicContext.label.startsWith("자동 분류 > ")) {
    failures.push(`${testCase.id}: expected auto-detected topic label, got "${topicContext.label}"`);
  }
}

const liveSourceReport = {
  title: "현장실습 시간 종료 후 청소 지시 사안 보고서",
  lead: "현장실습생에게 실습시간 종료 후 청소를 반복 지시한 사안입니다.",
  subtitle: "법제처 원문 조문 기반",
  officialMaterials: [],
  liveSourceReferences: [
    {
      label: "직업교육훈련 촉진법 제9조의2(현장실습 시간) · 시행 2025.10.01",
      lawName: "직업교육훈련 촉진법",
      articleNo: "9",
      branchNo: "2",
      articleTitle: "현장실습 시간",
      text: "미성년자 또는 재학 중인 직업교육훈련생의 현장실습 시간은 1일 7시간, 1주일 35시간을 초과하지 못한다. 오후 10시부터 오전 6시까지 및 휴일에 현장실습을 시켜서는 아니 된다."
    },
    {
      label: "직업교육훈련 촉진법 제26조(벌칙) · 시행 2025.10.01",
      lawName: "직업교육훈련 촉진법",
      articleNo: "26",
      branchNo: "",
      articleTitle: "벌칙",
      text: "제9조의2를 위반하여 현장실습 시간을 초과하거나 야간 및 휴일에 현장실습을 실시한 자는 2년 이하의 징역 또는 2천만원 이하의 벌금에 처한다."
    }
  ]
};

const timeBasis = context.getInlineBasisForText("실습시간 종료 후 청소 지시와 야간·휴일 실습 여부를 확인합니다.", liveSourceReport);
if (!timeBasis.includes("제9조의2") || !timeBasis.includes("법제처 원문 확인")) {
  failures.push(`live-source-basis: expected 제9조의2 원문 근거, got "${timeBasis}"`);
}

const penaltyBasis = context.getInlineBasisForText("벌칙, 징역, 벌금 적용 가능성은 원문 조문으로만 확인합니다.", liveSourceReport);
if (!penaltyBasis.includes("제26조")) {
  failures.push(`live-source-basis: expected 제26조 벌칙 근거, got "${penaltyBasis}"`);
}

const officialArticleBrief = context.renderOfficialArticleBrief(liveSourceReport);
if (!officialArticleBrief.includes("3-1. 공식 조문 확인 요약") || !officialArticleBrief.includes("직업교육훈련 촉진법 제9조의2")) {
  failures.push("official-article-brief: expected confirmed article summary cards in report body");
}
if (!officialArticleBrief.includes("실습시간") || !officialArticleBrief.includes("법제처 원문 확인")) {
  failures.push("official-article-brief: expected practical article use and source confirmation label");
}

const noOfficialArticleBrief = context.renderOfficialArticleBrief({
  title: "기본 보고서",
  liveSourceReferences: []
});
if (noOfficialArticleBrief) {
  failures.push("official-article-brief: should stay hidden when there is no confirmed article");
}

const interpretationBrief = context.renderInterpretationAndCaseBrief({
  title: "학교 생활지도 민원 보고서",
  lead: "학생 생활지도와 민원 대응 기준을 확인합니다.",
  sourceSearchQueries: ["아동학대처벌법 아동복지법 생활지도 판례"],
  officialSourceContext: {
    status: { scourt: false, nanet: false },
    results: {
      interpretations: [{
        title: "생활지도 관련 법령해석례",
        source: "국가법령정보센터",
        date: "2026.01.01",
        summary: "생활지도 사안의 법령 적용 방향을 확인하는 후보입니다.",
        url: "https://www.law.go.kr/LSW/expcInfoP.do?mode=1"
      }],
      educationInterpretations: [{
        title: "교육부 생활지도 법령해석",
        source: "국가법령정보센터",
        date: "2026.02.01",
        summary: "교육부 소관 법령해석 후보입니다."
      }],
      educationAdminRules: [{
        title: "교원의 학생생활지도에 관한 고시",
        source: "국가법령정보센터",
        date: "2026.03.01",
        summary: "학교 실무 기준자료입니다.",
        current: true,
        relevance: { score: 91, label: "우선 확인" }
      }]
    }
  }
});
if (!interpretationBrief.includes("3-2. 판례·행정해석 확인 상태")) {
  failures.push("interpretation-brief: expected report body section title");
}
if (!interpretationBrief.includes("교육부 공식 기준자료") || interpretationBrief.includes("교육부 행정해석")) {
  failures.push("interpretation-brief: education admin rules must be labeled as official standards, not interpretations");
}
if (!interpretationBrief.includes("공식 판례 API 미연결") || !interpretationBrief.includes("판례 확인 필요")) {
  failures.push("interpretation-brief: expected explicit case-law pending status when no official case API is connected");
}

const precedentBrief = context.renderInterpretationAndCaseBrief({
  title: "손해배상 검토 보고서",
  lead: "학생 피해와 손해배상 가능성을 확인합니다.",
  sourceSearchQueries: ["민법 불법행위 손해배상 위자료 판례"],
  officialSourceContext: {
    status: { scourt: true, nanet: false },
    results: {
      precedents: [{
        title: "손해배상 관련 공식 판례",
        source: "사법정보공유포털",
        courtName: "대법원",
        caseNumber: "2026다00000",
        decisionDate: "2026.05.01",
        caseType: "민사",
        summary: "공식 판례 API에서 확인된 판례 요지 후보입니다.",
        relatedLaws: ["민법"],
        url: "https://example.test/precedent"
      }]
    }
  }
});
if (!precedentBrief.includes("공식 판례") || !precedentBrief.includes("대법원") || !precedentBrief.includes("2026다00000")) {
  failures.push("precedent-brief: expected official precedent card details");
}
if (precedentBrief.includes("공식 판례 API 미연결")) {
  failures.push("precedent-brief: should not show disconnected status when official precedents are present");
}

const oldBranchOrder = context.renderReportLiveSources({
  results: {
    laws: [{
      title: "직업교육훈련 촉진법",
      source: "국가법령정보센터 원문 API",
      date: "2025.10.01",
      summary: "직업교육훈련 촉진법\n제9조의2(현장실습 시간): 현장실습 시간 원문",
      url: "https://www.law.go.kr/LSW/lsSc.do?query=test",
      reliability: { label: "법제처 원문 확인", needsReview: false },
      articles: []
    }]
  },
  notices: ["법제처 원문 게이트웨이에서 현행 법령 원문 조문을 확인했습니다."]
});
if (oldBranchOrder.includes("제9의2조")) {
  failures.push("live-source-render: branch article number should be 제9조의2, not 제9의2조");
}

if (failures.length) {
  console.error(`Scenario regression failed: ${failures.length}`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Scenario regression passed: ${cases.length} cases`);
