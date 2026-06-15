import fs from "node:fs";
import vm from "node:vm";

const code = fs.readFileSync("public/app.js", "utf8");
const policyKnowledgeBaseCode = fs.readFileSync("public/policy-knowledge-base.js", "utf8");
const policySourceRegistryCode = fs.readFileSync("public/policy-source-registry.js", "utf8");
const policyCorpusCode = fs.readFileSync("public/policy-corpus.js", "utf8");
const policyQuestionTaxonomyCode = fs.readFileSync("public/policy-question-taxonomy.js", "utf8");
const policyEngineCode = fs.readFileSync("public/policy-engine.js", "utf8");
const indexHtml = fs.readFileSync("public/index.html", "utf8");

function createStubElement(dataset = {}) {
  const classes = new Set();
  return {
    addEventListener() {},
    appendChild() {},
    remove() {},
    requestSubmit() {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    querySelector() { return stubElement; },
    querySelectorAll() { return []; },
    classList: {
      add(className) { classes.add(className); },
      remove(className) { classes.delete(className); },
      toggle(className, force) {
        const shouldAdd = force === undefined ? !classes.has(className) : Boolean(force);
        if (shouldAdd) classes.add(className);
        else classes.delete(className);
        return shouldAdd;
      },
      contains(className) { return classes.has(className); }
    },
    style: {},
    dataset,
    attributes: {},
    hidden: false,
    value: "",
    innerHTML: "",
    textContent: "",
    firstElementChild: null,
    options: []
  };
}

const stubElement = createStubElement();
const legalToolTab = createStubElement({ toolTab: "legal" });
const guideToolTab = createStubElement({ toolTab: "guide" });
const legalToolPanel = createStubElement({ toolPanel: "legal" });
const guideToolPanel = createStubElement({ toolPanel: "guide" });
const guideToolLink = createStubElement({ toolLink: "guide" });

const context = {
  console,
  Blob: class {},
  URLSearchParams,
  URL: { createObjectURL() { return ""; }, revokeObjectURL() {} },
  document: {
    body: stubElement,
    createElement() { return stubElement; },
    querySelector() { return stubElement; },
    querySelectorAll(selector) {
      if (selector === "[data-tool-tab]") return [legalToolTab, guideToolTab];
      if (selector === "[data-tool-panel]") return [legalToolPanel, guideToolPanel];
      if (selector === "[data-tool-link]") return [guideToolLink];
      return [];
    }
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
vm.runInContext(policyKnowledgeBaseCode, context, { filename: "policy-knowledge-base.js" });
vm.runInContext(policySourceRegistryCode, context, { filename: "policy-source-registry.js" });
vm.runInContext(policyCorpusCode, context, { filename: "policy-corpus.js" });
vm.runInContext(policyQuestionTaxonomyCode, context, { filename: "policy-question-taxonomy.js" });
vm.runInContext(policyEngineCode, context, { filename: "policy-engine.js" });
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
const internalPolicyGuideLeaks = [
  "파악한 질문",
  "일치 표현",
  "분류:",
  "기본 조건:",
  "로컬 정책 코퍼스",
  "확인 슬롯",
  "질문 문장만 기준",
  "확인 필요 항목",
  "같은 조회 계획",
  "재계산합니다"
];

function getGuideDomain(guide = {}) {
  return guide.directRule?.domain
    || guide.analysis?.engineAnalysis?.semanticFrame?.domainCode
    || guide.analysis?.semanticFrame?.domainCode
    || "";
}

function assertGuideDomain(testId, guide, expectedDomain) {
  if (!expectedDomain) return;
  const actualDomain = getGuideDomain(guide);
  if (actualDomain !== expectedDomain) {
    failures.push(`${testId}: expected guide domain ${expectedDomain}, got ${actualDomain}`);
  }
}

function assertNoPolicyGuideInternalLeaks(testId, html = "") {
  for (const leak of internalPolicyGuideLeaks) {
    if (html.includes(leak)) {
      failures.push(`${testId}: internal policy guide text leaked "${leak}"`);
    }
  }
}

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

const policyEngine = context.GYO6_POLICY_ENGINE;
if (!policyEngine?.analyzePolicyQuestion || !policyEngine?.lookupPolicyRules || !policyEngine?.buildPolicyResponse) {
  failures.push("policy-engine-pipeline: expected separated analyze, lookup, and compose functions");
} else {
  const pipelineAnalysis = policyEngine.analyzePolicyQuestion("교장의 경주 출장시 일비 식비는?");
  const pipelineLookup = policyEngine.lookupPolicyRules(pipelineAnalysis);
  const pipelineResponse = policyEngine.buildPolicyResponse({ question: "교장의 경주 출장시 일비 식비는?" });
  const semanticFrame = policyEngine.buildPolicySemanticFrame("경주정보고 교사의 남해군 1박 2일 출장시 출장비는?");
  const budgetSemanticFrame = policyEngine.buildPolicySemanticFrame("학교 예산 편성과 지출 증빙은 소속 교육청 기준으로 무엇을 먼저 확인해야 하나요?");
  const serviceSemanticFrame = policyEngine.buildPolicySemanticFrame("기간제교사가 병가 사용 후 복무평가에서 불리해질까 걱정됩니다. 근태 증빙은?");
  const spouseChildbirthSemanticFrame = policyEngine.buildPolicySemanticFrame("정규직 선생님의 배우자가 출산한 경우 휴가일수는?");
  const maleTeacherChildbirthSemanticFrame = policyEngine.buildPolicySemanticFrame("남자 교사가 출산휴가를 받을 수 있나요?");
  const genericChildbirthLeaveSemanticFrame = policyEngine.buildPolicySemanticFrame("출산 휴가 규정");
  const schoolViolenceSemanticFrame = policyEngine.buildPolicySemanticFrame("학교폭력 신고 후 가해학생 친구들이 보복성 메시지를 보내는데 피해학생 보호 조치는?");
  const classManagementSemanticFrame = policyEngine.buildPolicySemanticFrame("수업 중 휴대전화를 보관했다가 학부모가 학생 인권 침해라고 민원을 냈습니다.");
  const fieldLearningSemanticFrame = policyEngine.buildPolicySemanticFrame("교외체험학습 신청서와 보고서, 출결 처리는 어떻게 해야 하나요?");
  const ramblingFieldLearningSemanticFrame = policyEngine.buildPolicySemanticFrame("앞부분은 좀 장황한데, 학교 행사 얘기와 학생부 얘기도 섞였습니다. 다시 말하면 학생 가정체험학습 신청 방법과 보고서 처리가 궁금합니다.");
  const dormitorySemanticFrame = policyEngine.buildPolicySemanticFrame("기숙사 배정에서 특정 학과 학생이 불리하다는 민원이 들어왔습니다.");
  const mealSemanticFrame = policyEngine.buildPolicySemanticFrame("학부모가 급식 반찬이 마음에 들지 않는다며 학교장 면담을 요구했습니다. 식중독은 없습니다.");
  if (pipelineAnalysis.intents?.domesticTravel?.type !== "domesticTravelExpense") {
    failures.push("policy-engine-pipeline: expected analyzer to classify domestic travel expense");
  }
  if (pipelineLookup?.domain !== "domesticTravelExpense" || !pipelineLookup.requiredSlots?.includes("travelerRole") || !pipelineLookup.tables?.domesticTravel?.dailyRate) {
    failures.push("policy-engine-pipeline: expected rule lookup to expose slots and domestic travel table");
  }
  if (!pipelineResponse?.answer?.[0]?.includes("일비는 25,000원") || !pipelineResponse?.ruleLookup?.legalBasis?.includes("공무원 여비 규정 별표 2")) {
    failures.push("policy-engine-pipeline: expected composer to use lookup result in final answer");
  }
  if (semanticFrame?.domainCode !== "domesticTravelExpense" || semanticFrame?.task?.code !== "totalAmount" || semanticFrame?.slots?.institution?.label !== "경주정보고" || semanticFrame?.slots?.destination?.label !== "남해군" || semanticFrame?.slots?.duration?.days !== 2 || !semanticFrame?.lookupPlan?.actions?.includes("search_policy_rules")) {
    failures.push("policy-engine-pipeline: expected broad semantic frame with domain, task, slots, and lookup plan");
  }
  if (budgetSemanticFrame?.domainCode !== "schoolBudgetExecution" || !budgetSemanticFrame?.slots?.spendingType?.detected || !budgetSemanticFrame?.slots?.procedureStage?.detected || !budgetSemanticFrame?.lookupPlan?.actions?.includes("get_office_guideline")) {
    failures.push("policy-engine-pipeline: expected budget questions to build semantic frame and office-guideline lookup plan");
  }
  if (serviceSemanticFrame?.domainCode !== "staffAttendanceService" || serviceSemanticFrame?.slots?.travelerRole?.subjectLabel !== "기간제교사" || serviceSemanticFrame?.slots?.serviceIssue?.label !== "병가" || serviceSemanticFrame?.task?.code !== "disputeRisk") {
    failures.push("policy-engine-pipeline: expected service/attendance questions to extract role, issue, and dispute task");
  }
  if (spouseChildbirthSemanticFrame?.domainCode !== "staffAttendanceService" || spouseChildbirthSemanticFrame?.slots?.serviceIssue?.code !== "spouseChildbirthLeave") {
    failures.push("policy-engine-pipeline: expected spouse childbirth leave to beat generic annual/special leave classification");
  }
  if (maleTeacherChildbirthSemanticFrame?.domainCode !== "staffAttendanceService" || maleTeacherChildbirthSemanticFrame?.slots?.serviceIssue?.code !== "spouseChildbirthLeave") {
    failures.push("policy-engine-pipeline: expected male teacher childbirth leave wording to classify as spouse childbirth leave");
  }
  if (genericChildbirthLeaveSemanticFrame?.domainCode !== "staffAttendanceService" || genericChildbirthLeaveSemanticFrame?.slots?.serviceIssue?.code !== "specialLeave") {
    failures.push("policy-engine-pipeline: expected generic childbirth leave wording to stay in staff attendance special-leave flow");
  }
  if (schoolViolenceSemanticFrame?.domainCode !== "schoolViolenceProcedure" || !schoolViolenceSemanticFrame?.slots?.riskSignal?.label?.includes("학교폭력")) {
    failures.push("policy-engine-pipeline: expected school violence questions to classify violence procedure and risk signal");
  }
  if (classManagementSemanticFrame?.domainCode !== "classManagementGuidance" || !classManagementSemanticFrame?.slots?.schoolRule?.label?.includes("학교생활규정") || classManagementSemanticFrame?.slots?.office?.detected) {
    failures.push("policy-engine-pipeline: expected class management questions to extract school rule without false office detection");
  }
  if (fieldLearningSemanticFrame?.domainCode !== "fieldExperienceLearning" || !fieldLearningSemanticFrame?.slots?.evidence?.label?.includes("신청서") || !fieldLearningSemanticFrame?.lookupPlan?.actions?.includes("get_office_guideline")) {
    failures.push("policy-engine-pipeline: expected field learning questions to extract evidence and office-guideline lookup");
  }
  if (ramblingFieldLearningSemanticFrame?.domainCode !== "fieldExperienceLearning" || !ramblingFieldLearningSemanticFrame?.understandingAttempts?.some((attempt) => attempt.selected)) {
    failures.push("policy-engine-pipeline: expected question-understanding retry to recover field learning intent from rambling mixed wording");
  }
  if (dormitorySemanticFrame?.domainCode !== "dormitoryOperation" || !dormitorySemanticFrame?.lookupPlan?.actions?.includes("get_school_rule")) {
    failures.push("policy-engine-pipeline: expected dormitory questions to prioritize school-rule lookup");
  }
  if (mealSemanticFrame?.domainCode !== "schoolMealOperation" || mealSemanticFrame?.slots?.riskSignal?.label?.includes("안전·응급")) {
    failures.push("policy-engine-pipeline: expected meal complaint to classify meal domain and respect negated food-poisoning risk");
  }
}

const leaveGuide = context.buildPolicyGuideResponse({
  question: "공립 교원의 배우자 부모상 경조사휴가는 며칠이고 어떤 규정을 확인해야 하나요?",
  officeCode: "incheon",
  roleCode: "teacher",
  categoryCode: "leaveAttendance"
});
const leaveGuideHtml = context.renderPolicyGuideResponse(leaveGuide);
if (!leaveGuideHtml.includes("5일") || !leaveGuideHtml.includes("국가공무원 복무규정") || !leaveGuideHtml.includes("교원휴가에 관한 예규")) {
  failures.push("policy-guide-leave: expected local answer with 5-day national service rule and teacher leave source");
}
if (!leaveGuideHtml.includes("답변") || !leaveGuideHtml.includes("공립 교원·국가공무원 기준으로 배우자의 부모 사망 경조사휴가는 5일입니다.")) {
  failures.push("policy-guide-leave: expected conclusion-first answer format");
}
if (!leaveGuideHtml.includes("인천광역시교육청") || !leaveGuideHtml.includes("교육공무직")) {
  failures.push("policy-guide-leave: expected office-priority and non-teacher caveat");
}

const spouseUncleLeaveGuide = context.buildPolicyGuideResponse({
  question: "교사의 배우자의 삼촌상은 휴가 몇일인가요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const spouseUncleLeaveGuideHtml = context.renderPolicyGuideResponse(spouseUncleLeaveGuide);
if (!spouseUncleLeaveGuideHtml.includes("별도 일수로 열거되어 있지 않습니다") || !spouseUncleLeaveGuideHtml.includes("배우자의 부모 사망 5일 규정을 적용하면 안 됩니다")) {
  failures.push("policy-guide-bereavement-relation: spouse uncle should not be treated as spouse parent leave");
}
if (spouseUncleLeaveGuideHtml.includes("배우자의 부모 사망 경조사휴가 5일")) {
  failures.push("policy-guide-bereavement-relation: spouse uncle leaked spouse-parent 5-day rule");
}

const spouseAuntLeaveGuide = context.buildPolicyGuideResponse({
  question: "교사의 배우자의 이모의 사망은 휴가 몇일인가요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const spouseAuntLeaveGuideHtml = context.renderPolicyGuideResponse(spouseAuntLeaveGuide);
if (!spouseAuntLeaveGuideHtml.includes("별도 일수로 열거되어 있지 않습니다") || spouseAuntLeaveGuideHtml.includes("배우자의 부모 사망 경조사휴가 5일")) {
  failures.push("policy-guide-bereavement-relation: spouse aunt should not be treated as spouse parent leave");
}

const spouseChildLeaveGuide = context.buildPolicyGuideResponse({
  question: "교사의 배우자의 아들의 사망은 휴가 몇일인가요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const spouseChildLeaveGuideHtml = context.renderPolicyGuideResponse(spouseChildLeaveGuide);
if (!spouseChildLeaveGuideHtml.includes("배우자의 자녀") || !spouseChildLeaveGuideHtml.includes("3일") || !spouseChildLeaveGuideHtml.includes("법적으로 본인의 자녀 관계")) {
  failures.push("policy-guide-bereavement-relation: spouse child should be conditionally treated as child leave, not spouse parent");
}
if (spouseChildLeaveGuideHtml.includes("배우자의 부모 사망 경조사휴가 5일")) {
  failures.push("policy-guide-bereavement-relation: spouse child leaked spouse-parent 5-day rule");
}

const childLeaveGuide = context.buildPolicyGuideResponse({
  question: "교사의 배우자의 자녀의 사망은 휴가 몇일인가요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const childLeaveGuideHtml = context.renderPolicyGuideResponse(childLeaveGuide);
if (!childLeaveGuideHtml.includes("배우자의 자녀") || !childLeaveGuideHtml.includes("3일") || childLeaveGuideHtml.includes("배우자의 부모 사망 경조사휴가 5일")) {
  failures.push("policy-guide-bereavement-relation: spouse child phrasing should resolve to conditional 3-day child leave");
}

const budgetGuide = context.buildPolicyGuideResponse({
  question: "학교 예산 편성과 지출 증빙은 소속 교육청 기준으로 무엇을 먼저 확인해야 하나요?",
  officeCode: "gangwon",
  roleCode: "manager",
  categoryCode: "budgetExecution"
});
const budgetGuideHtml = context.renderPolicyGuideResponse(budgetGuide);
if (!budgetGuideHtml.includes("강원특별자치도교육청") || !budgetGuideHtml.includes("2026년도 학교회계 예산편성 기본지침") || !budgetGuideHtml.includes("학교회계 예산편성 기본지침") || !budgetGuideHtml.includes("지출 증빙")) {
  failures.push("policy-guide-budget: expected selected education-office budget guide priority");
}

const budgetAutoGuide = context.buildPolicyGuideResponse({
  question: "학교 예산 편성과 지출 증빙은 무엇을 먼저 확인해야 하나요?",
  officeCode: "auto",
  roleCode: "manager",
  categoryCode: "budgetExecution"
});
const budgetAutoGuideHtml = context.renderPolicyGuideResponse(budgetAutoGuide);
assertGuideDomain("policy-guide-budget-auto-office-default", budgetAutoGuide, "schoolBudgetExecution");
assertNoPolicyGuideInternalLeaks("policy-guide-budget-auto-office-default", budgetAutoGuideHtml);
if (!budgetAutoGuide.officeDefault || !budgetAutoGuideHtml.includes("교육청을 선택하지 않아 경상북도교육청 기준으로 우선 답변합니다") || !budgetAutoGuideHtml.includes("2026학년도 공립학교회계 예산편성 기본지침")) {
  failures.push("policy-guide-budget-auto-office-default: expected Gyeongbuk default and missing-office caution");
}
if (budgetAutoGuideHtml.includes("소속 교육청 미선택")) {
  failures.push("policy-guide-budget-auto-office-default: should render effective Gyeongbuk office instead of generic missing office");
}

const attendanceGuide = context.buildPolicyGuideResponse({
  question: "기간제교사가 병가 사용 후 계약 연장이나 복무평가에서 불리해질까 걱정합니다. 근태 증빙은 어떻게 봐야 하나요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const attendanceGuideHtml = context.renderPolicyGuideResponse(attendanceGuide);
if (!attendanceGuideHtml.includes("기간제교사") || !attendanceGuideHtml.includes("병가") || !attendanceGuideHtml.includes("복무평가") || !attendanceGuideHtml.includes("나이스 근무상황") || !attendanceGuideHtml.includes("진단서") || !attendanceGuideHtml.includes("근로계약")) {
  failures.push("policy-guide-attendance-service: expected answer-first attendance/service response with role, sick-leave evidence, NEIS, contract, and dispute framing");
}
if (attendanceGuideHtml.includes("출장비") || attendanceGuideHtml.includes("학교회계·예산·지출 확인 기준")) {
  failures.push("policy-guide-attendance-service: attendance/service question should not leak travel or budget guidance");
}

const teacherTardyGuide = context.buildPolicyGuideResponse({
  question: "교사의 무단 지각은 어떻게 해야 처리하나요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const teacherTardyGuideHtml = context.renderPolicyGuideResponse(teacherTardyGuide);
if (!teacherTardyGuideHtml.includes("무단 지각") || !teacherTardyGuideHtml.includes("출근기록") || !teacherTardyGuideHtml.includes("나이스 근무상황") || !teacherTardyGuideHtml.includes("복무 위반")) {
  failures.push("policy-guide-staff-attendance: unauthorized teacher tardy should answer with attendance record, NEIS, and service violation handling");
}
if (teacherTardyGuideHtml.includes("어느 신분인지 갈라야 합니다")) {
  failures.push("policy-guide-staff-attendance: unauthorized teacher tardy fell back to generic identity question");
}

const regularAnnualLeaveGuide = context.buildPolicyGuideResponse({
  question: "정규교사의 연가는 몇일 가능하며 언제 신청하나요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const regularAnnualLeaveGuideHtml = context.renderPolicyGuideResponse(regularAnnualLeaveGuide);
if (!regularAnnualLeaveGuideHtml.includes("재직기간별") || !regularAnnualLeaveGuideHtml.includes("1개월 이상 1년 미만 11일") || !regularAnnualLeaveGuideHtml.includes("6년 이상 21일") || !regularAnnualLeaveGuideHtml.includes("나이스 근무상황") || !regularAnnualLeaveGuideHtml.includes("학교장 승인")) {
  failures.push("policy-guide-staff-attendance: regular teacher annual leave should answer with service-period table and application flow");
}
assertNoPolicyGuideInternalLeaks("policy-guide-staff-attendance:regular-teacher-annual-leave", regularAnnualLeaveGuideHtml);
if (regularAnnualLeaveGuideHtml.includes("어느 신분인지 갈라야 합니다")) {
  failures.push("policy-guide-staff-attendance: regular teacher annual leave fell back to generic identity question");
}

const thirdYearRegularAnnualLeaveGuide = context.buildPolicyGuideResponse({
  question: "3년차 정교사의 연가 일수는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const thirdYearRegularAnnualLeaveGuideHtml = context.renderPolicyGuideResponse(thirdYearRegularAnnualLeaveGuide);
if (!thirdYearRegularAnnualLeaveGuideHtml.includes("3년 이상 4년 미만 16일") && !thirdYearRegularAnnualLeaveGuideHtml.includes("16일")) {
  failures.push("policy-guide-staff-attendance: third-year regular teacher annual leave should resolve to 16 days");
}
if (thirdYearRegularAnnualLeaveGuideHtml.includes("근로기준법 기준") || thirdYearRegularAnnualLeaveGuideHtml.includes("질문만으로는")) {
  failures.push("policy-guide-staff-attendance: third-year regular teacher annual leave should not fall back to labor-standard ambiguity");
}
if (thirdYearRegularAnnualLeaveGuideHtml.includes("파악한 질문") || thirdYearRegularAnnualLeaveGuideHtml.includes("일치 표현") || thirdYearRegularAnnualLeaveGuideHtml.includes("분류:")) {
  failures.push("policy-guide-staff-attendance: third-year regular teacher annual leave should not expose internal diagnostics");
}

const thirdYearLocalOfficerAnnualLeaveGuide = context.buildPolicyGuideResponse({
  question: "지방공무원 행정직 3년차 연가 일수는?",
  officeCode: "gyeongbuk",
  roleCode: "localOfficer",
  categoryCode: "leaveAttendance"
});
const thirdYearLocalOfficerAnnualLeaveHtml = context.renderPolicyGuideResponse(thirdYearLocalOfficerAnnualLeaveGuide);
if (!thirdYearLocalOfficerAnnualLeaveHtml.includes("기본 16일") || !thirdYearLocalOfficerAnnualLeaveHtml.includes("나이스 근무상황")) {
  failures.push("policy-guide-staff-attendance: third-year local officer annual leave should answer with 16 days and application flow");
}
if (thirdYearLocalOfficerAnnualLeaveHtml.includes("파악한 질문") || thirdYearLocalOfficerAnnualLeaveHtml.includes("일치 표현") || thirdYearLocalOfficerAnnualLeaveHtml.includes("분류:")) {
  failures.push("policy-guide-staff-attendance: local officer annual leave should not expose internal diagnostics");
}

const regularSickLeaveGuide = context.buildPolicyGuideResponse({
  question: "정규교사의 병가는 몇일 가능하며 어떻게 신청하나요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const regularSickLeaveGuideHtml = context.renderPolicyGuideResponse(regularSickLeaveGuide);
if (!regularSickLeaveGuideHtml.includes("연 60일") || !regularSickLeaveGuideHtml.includes("연 180일") || !regularSickLeaveGuideHtml.includes("진단서") || !regularSickLeaveGuideHtml.includes("나이스 근무상황")) {
  failures.push("policy-guide-staff-attendance: regular teacher sick leave should answer with 60/180-day limits, certificate, and application flow");
}
if (regularSickLeaveGuideHtml.includes("어느 신분인지 갈라야 합니다")) {
  failures.push("policy-guide-staff-attendance: regular teacher sick leave fell back to generic identity question");
}

const spouseChildbirthLeaveGuide = context.buildPolicyGuideResponse({
  question: "정규직 선생님의 배우자가 출산한 경우 휴가일수는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const spouseChildbirthLeaveHtml = context.renderPolicyGuideResponse(spouseChildbirthLeaveGuide);
if (!spouseChildbirthLeaveHtml.includes("배우자 출산휴가는 20일") || !spouseChildbirthLeaveHtml.includes("나이스 근무상황")) {
  failures.push("policy-guide-intent: spouse childbirth leave should answer directly with 20 days and application flow");
}
if (spouseChildbirthLeaveHtml.includes("파악한 질문") || spouseChildbirthLeaveHtml.includes("일치 표현") || spouseChildbirthLeaveHtml.includes("분류:")) {
  failures.push("policy-guide-intent: user-facing direct answer should not expose internal intent diagnostics");
}
if (spouseChildbirthLeaveHtml.includes("교원의 경조사휴가는 가족관계와 대상 신분을 먼저") || spouseChildbirthLeaveHtml.includes("배우자의 부모 사망 경조사휴가 5일")) {
  failures.push("policy-guide-intent: spouse childbirth leave should not fall into bereavement/generic family-leave answer");
}

const ambiguousSpouseLeaveGuide = context.buildPolicyGuideResponse({
  question: "정규직 선생님의 배우자 휴가일수는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const ambiguousSpouseLeaveHtml = context.renderPolicyGuideResponse(ambiguousSpouseLeaveGuide);
if (!ambiguousSpouseLeaveHtml.includes("질문 요지 확인 필요") || !ambiguousSpouseLeaveHtml.includes("배우자 출산휴가") || !ambiguousSpouseLeaveHtml.includes("사망 경조사휴가")) {
  failures.push("policy-guide-intent: ambiguous spouse leave should ask for intent confirmation candidates");
}
if (!ambiguousSpouseLeaveHtml.includes("직접 입력")) {
  failures.push("policy-guide-intent: ambiguous spouse leave should expose a manual intent input option");
}
if (ambiguousSpouseLeaveHtml.includes("명확한 답변") || ambiguousSpouseLeaveHtml.includes("배우자 출산휴가는 20일입니다")) {
  failures.push("policy-guide-intent: ambiguous spouse leave should not present a final answer before confirmation");
}

const questionTaxonomy = context.GYO6_POLICY_QUESTION_TAXONOMY;
if (!questionTaxonomy?.stats || questionTaxonomy.stats.intentCount < 30 || questionTaxonomy.stats.slotCount < 15 || questionTaxonomy.stats.aliasCount < 120) {
  failures.push("policy-question-taxonomy: expected a large explicit intent/slot/alias database to be loaded");
}
const taxonomyChildbirth = questionTaxonomy?.classify?.("정규직 선생님의 배우자가 출산한 경우 휴가일수는?", { limit: 3 }) || [];
if (taxonomyChildbirth[0]?.code !== "spouseChildbirthLeave" || !taxonomyChildbirth[0]?.requiredSlots?.includes("employmentType")) {
  failures.push("policy-question-taxonomy: expected spouse childbirth leave classification with calculation slots");
}

const vagueInstructorGuide = context.buildPolicyGuideResponse({
  question: "강사의 강사비는 얼마인가요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const vagueInstructorHtml = context.renderPolicyGuideResponse(vagueInstructorGuide);
if (!vagueInstructorHtml.includes("추가 확인") || !vagueInstructorHtml.includes("실제 소속 교육청") || !vagueInstructorHtml.includes("강사의 신분·경력") || !vagueInstructorHtml.includes("강의시간")) {
  failures.push("policy-question-taxonomy: vague instructor fee should ask office, instructor profile, and lecture duration slots");
}

const fixedTermAnnualLeaveGuide = context.buildPolicyGuideResponse({
  question: "기간제교사의 연가는 몇일 가능하며 어떻게 신청하나요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const fixedTermAnnualLeaveGuideHtml = context.renderPolicyGuideResponse(fixedTermAnnualLeaveGuide);
if (!fixedTermAnnualLeaveGuideHtml.includes("기간제교사") || !fixedTermAnnualLeaveGuideHtml.includes("계약기간") || !fixedTermAnnualLeaveGuideHtml.includes("계약제교원") || !fixedTermAnnualLeaveGuideHtml.includes("근로계약") || !fixedTermAnnualLeaveGuideHtml.includes("나이스 근무상황")) {
  failures.push("policy-guide-staff-attendance: fixed-term teacher annual leave should use contract/guideline-first answer");
}
if (fixedTermAnnualLeaveGuideHtml.includes("공무원 연가표를 그대로 21일로 단정") && !fixedTermAnnualLeaveGuideHtml.includes("단정하지 않고")) {
  failures.push("policy-guide-staff-attendance: fixed-term annual leave should reject blanket 21-day answer");
}
if (fixedTermAnnualLeaveGuideHtml.includes('href="https://www.moe.go.kr/main.do?s=moe"') || fixedTermAnnualLeaveGuideHtml.includes('href="https://www.law.go.kr"')) {
  failures.push("policy-guide-source-links: missing-office staff rule sources should not render generic homepage or fallback law links as original sources");
}

const gyeongbukFixedTermSixMonthLeaveGuide = context.buildPolicyGuideResponse({
  question: "경북교육청 기간제 교사의 연가일수는? 해당 교사는 현재 6개월째 결근없이 근무중임.",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const gyeongbukFixedTermSixMonthLeaveHtml = context.renderPolicyGuideResponse(gyeongbukFixedTermSixMonthLeaveGuide);
if (!gyeongbukFixedTermSixMonthLeaveHtml.includes("6개월째") || !gyeongbukFixedTermSixMonthLeaveHtml.includes("6일") || !gyeongbukFixedTermSixMonthLeaveHtml.includes("월 개근 1일") || !gyeongbukFixedTermSixMonthLeaveHtml.includes("계약제교원 운영 지침") || !gyeongbukFixedTermSixMonthLeaveHtml.includes("임용계약서")) {
  failures.push("policy-guide-staff-attendance: Gyeongbuk fixed-term 6-month leave should calculate a 6-day candidate and require contract/guideline confirmation");
}
if (!gyeongbukFixedTermSixMonthLeaveHtml.includes("추가 확인") || !gyeongbukFixedTermSixMonthLeaveHtml.includes("방학 중 비근무") || !gyeongbukFixedTermSixMonthLeaveHtml.includes("이미 사용한 연가")) {
  failures.push("policy-guide-staff-attendance: fixed-term annual leave should render follow-up inputs for missing calculation slots");
}
if (gyeongbukFixedTermSixMonthLeaveHtml.includes("교육공무직원 취업규칙") || gyeongbukFixedTermSixMonthLeaveHtml.includes("지방공무원 복무 조례")) {
  failures.push("policy-guide-source-links: fixed-term annual leave should not show education-worker/local-officer source cards");
}
if (gyeongbukFixedTermSixMonthLeaveHtml.includes('href="https://www.moe.go.kr/main.do?s=moe"') || gyeongbukFixedTermSixMonthLeaveHtml.includes('href="https://www.gbe.kr"')) {
  failures.push("policy-guide-source-links: fixed-term annual leave should not expose ministry or education-office main homepage links");
}
const gyeongbukFixedTermSixMonthSourceGuide = context.buildPolicyGuideResponse({
  question: "경북교육청 기간제 교사의 연가일수는? 해당 교사는 현재 6개월째 결근없이 근무중임.\n\n추가 요청: 관련 규정과 공식 출처를 자세히 보여 주세요.",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const gyeongbukFixedTermSixMonthSourceHtml = context.renderPolicyGuideResponse(gyeongbukFixedTermSixMonthSourceGuide);
if (!gyeongbukFixedTermSixMonthSourceHtml.includes("관련 규정·공식 출처") || !gyeongbukFixedTermSixMonthSourceHtml.includes("site%3Agbe.kr") || !gyeongbukFixedTermSixMonthSourceHtml.includes("공식 도메인 검색")) {
  failures.push("policy-guide-source-links: source detail should appear only when explicitly requested and use official-domain search");
}

const vocationalJobGuide = context.buildPolicyGuideResponse({
  question: "고졸채용 정보를 잡알리오와 경남교육청 취업지원센터 공고로 교차 확인하려면?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const vocationalJobGuideHtml = context.renderPolicyGuideResponse(vocationalJobGuide);
assertGuideDomain("policy-guide-vocational-job-source", vocationalJobGuide, "careerEmploymentGuidance");
assertNoPolicyGuideInternalLeaks("policy-guide-vocational-job-source", vocationalJobGuideHtml);
if (!vocationalJobGuideHtml.includes("잡알리오") || !vocationalJobGuideHtml.includes("공식 공고") || !vocationalJobGuideHtml.includes("2·3차 검증")) {
  failures.push("policy-guide-vocational-job-source: expected Job-Alio-first employment guidance with education-office sources as verification only");
}
if (vocationalJobGuideHtml.includes("경상남도교육청 취업지원센터 공채캘린더") || vocationalJobGuideHtml.includes("부산광역시교육청 취업지원센터 고졸 채용공고")) {
  failures.push("policy-guide-vocational-job-source: regional employment centers should not be exposed as direct result cards");
}
if (vocationalJobGuideHtml.includes("직업계고 현장실습 운영 매뉴얼") || vocationalJobGuideHtml.includes("산학일체형 도제학교")) {
  failures.push("policy-guide-vocational-job-source: employment question should not inherit field-training source cards");
}

const adminMaterialUrl = context.getMaterialUrl(
  { type: "admin", title: "직업계고 현장실습 운영 자료", source: "교육부", query: "직업계고 현장실습 운영 자료", url: "https://www.moe.go.kr/main.do?s=moe" },
  encodeURIComponent("현장실습 업무 외 지시")
);
if (adminMaterialUrl.includes("moe.go.kr/main.do") || !adminMaterialUrl.includes("google.com/search") || !adminMaterialUrl.includes("site%3Amoe.go.kr")) {
  failures.push("source-links: generic ministry homepage material URLs should be converted to official-domain search URLs");
}

const adminSourceLinks = context.getSourceLinks(encodeURIComponent("기간제교사 연가"), { type: "staffLabor", tags: [], laws: [] }, ["admin"]);
if (adminSourceLinks.some((link) => link.href.includes("moe.go.kr/main.do"))) {
  failures.push("source-links: admin source links should not point to the Ministry main homepage");
}
if (!adminSourceLinks.some((link) => link.href.includes("google.com/search") && link.href.includes("site%3Amoe.go.kr"))) {
  failures.push("source-links: admin source links should use official-domain search when no direct material URL is known");
}

const privateFixedTermAnnualLeaveGuide = context.buildPolicyGuideResponse({
  question: "사립학교 4년 근무 기간제교사의 연가 일수는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const privateFixedTermAnnualLeaveGuideHtml = context.renderPolicyGuideResponse(privateFixedTermAnnualLeaveGuide);
if (!privateFixedTermAnnualLeaveGuideHtml.includes("사립학교") || !privateFixedTermAnnualLeaveGuideHtml.includes("기간제교사") || !privateFixedTermAnnualLeaveGuideHtml.includes("계속근로 4년") || !privateFixedTermAnnualLeaveGuideHtml.includes("16일") || !privateFixedTermAnnualLeaveGuideHtml.includes("취업규칙") || !privateFixedTermAnnualLeaveGuideHtml.includes("근로계약")) {
  failures.push("policy-guide-staff-attendance: private fixed-term 4-year annual leave should use private-school contract and labor-law candidate calculation");
}
if (!privateFixedTermAnnualLeaveGuideHtml.includes("경상북도교육청 기준") || !privateFixedTermAnnualLeaveGuideHtml.includes("교육청을 선택하지 않아")) {
  failures.push("policy-guide-staff-attendance: office-sensitive private/fixed-term leave should default to Gyeongbuk with missing-office caution");
}
if (privateFixedTermAnnualLeaveGuideHtml.includes('href="https://www.moe.go.kr/main.do?s=moe"') || privateFixedTermAnnualLeaveGuideHtml.includes('href="https://www.law.go.kr"')) {
  failures.push("policy-guide-source-links: private fixed-term leave should not expose generic homepage or fallback law links");
}

const fixedTermSickLeaveGuide = context.buildPolicyGuideResponse({
  question: "기간제교사의 병가는 몇일 가능하며 어떻게 신청하나요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const fixedTermSickLeaveGuideHtml = context.renderPolicyGuideResponse(fixedTermSickLeaveGuide);
if (!fixedTermSickLeaveGuideHtml.includes("기간제교사") || !fixedTermSickLeaveGuideHtml.includes("계약제교원") || !fixedTermSickLeaveGuideHtml.includes("근로계약") || !fixedTermSickLeaveGuideHtml.includes("60일") || !fixedTermSickLeaveGuideHtml.includes("180일") || !fixedTermSickLeaveGuideHtml.includes("진단서")) {
  failures.push("policy-guide-staff-attendance: fixed-term teacher sick leave should separate contract guideline and public-teacher fallback");
}
if (fixedTermSickLeaveGuideHtml.includes("어느 신분인지 갈라야 합니다")) {
  failures.push("policy-guide-staff-attendance: fixed-term teacher sick leave fell back to generic identity question");
}

const privateSchoolTeacherSickLeaveGuide = context.buildPolicyGuideResponse({
  question: "사립학교 교사의 최대 병가일수는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const privateSchoolTeacherSickLeaveGuideHtml = context.renderPolicyGuideResponse(privateSchoolTeacherSickLeaveGuide);
if (!privateSchoolTeacherSickLeaveGuideHtml.includes("사립학교") || !privateSchoolTeacherSickLeaveGuideHtml.includes("학교법인") || !privateSchoolTeacherSickLeaveGuideHtml.includes("취업규칙") || !privateSchoolTeacherSickLeaveGuideHtml.includes("60일") || !privateSchoolTeacherSickLeaveGuideHtml.includes("180일") || !privateSchoolTeacherSickLeaveGuideHtml.includes("진단서")) {
  failures.push("policy-guide-staff-attendance: private school teacher sick leave limit should answer 60/180 as a conditional teacher-leave standard with school-corporation priority");
}
if (privateSchoolTeacherSickLeaveGuideHtml.includes("증빙자료가 없어 최종 일수") || privateSchoolTeacherSickLeaveGuideHtml.includes("최종 일수나 유급 여부는 해당 기관 규정 확인 항목")) {
  failures.push("policy-guide-staff-attendance: private school teacher sick leave limit should not hide the day-count answer behind a missing-evidence slot");
}

const broadSchoolPolicyGuideCases = [
  {
    id: "school-violence-policy-engine",
    question: "학교폭력 신고 후 가해학생 친구들이 보복성 메시지를 보내는데 피해학생 보호 조치는?",
    domain: "schoolViolenceProcedure",
    expected: ["학교폭력", "피해학생 보호", "전담기구", "보복"],
    forbidden: ["근로기준법", "출장비", "학교회계·예산·지출 확인 기준"]
  },
  {
    id: "class-management-policy-engine",
    question: "수업 중 휴대전화를 보관했다가 학부모가 학생 인권 침해라고 민원을 냈습니다.",
    domain: "classManagementGuidance",
    expected: ["휴대전화", "학교생활규정", "학생 인권"],
    forbidden: ["대전광역시교육청", "출장비", "학교폭력 사안처리 확인 기준"]
  },
  {
    id: "field-learning-policy-engine",
    question: "교외체험학습 신청서와 보고서, 출결 처리는 어떻게 해야 하나요?",
    domain: "fieldExperienceLearning",
    expected: ["체험학습", "신청서", "보고서"],
    forbidden: ["출장비", "급식 운영 기준"]
  },
  {
    id: "dormitory-policy-engine",
    question: "기숙사 배정에서 특정 학과 학생이 불리하다는 민원이 들어왔습니다.",
    domain: "dormitoryOperation",
    expected: ["기숙사 운영규정", "차별"],
    forbidden: ["출장비", "학교급식·위생·민원 확인 기준"]
  },
  {
    id: "school-meal-policy-engine",
    question: "학부모가 급식 반찬이 마음에 들지 않는다며 학교장 면담을 요구했습니다. 식중독은 없습니다.",
    domain: "schoolMealOperation",
    expected: ["급식 운영 기준", "민원"],
    forbidden: ["안전·응급 위험", "출장비", "기숙사 운영·생활지도 확인 기준"]
  }
];

for (const guideCase of broadSchoolPolicyGuideCases) {
  const guide = context.buildPolicyGuideResponse({
    question: guideCase.question,
    officeCode: "auto",
    roleCode: "auto",
    categoryCode: "auto"
  });
  const html = context.renderPolicyGuideResponse(guide);
  assertGuideDomain(`policy-guide-broad-school:${guideCase.id}`, guide, guideCase.domain);
  assertNoPolicyGuideInternalLeaks(`policy-guide-broad-school:${guideCase.id}`, html);
  for (const expected of guideCase.expected) {
    if (!html.includes(expected)) {
      failures.push(`policy-guide-broad-school:${guideCase.id}: expected "${expected}"`);
    }
  }
  for (const forbidden of guideCase.forbidden) {
    if (html.includes(forbidden)) {
      failures.push(`policy-guide-broad-school:${guideCase.id}: leaked "${forbidden}"`);
    }
  }
}

const broadPolicyDomainMatrix = [
  {
    domain: "studentRecordsAttendance",
    title: "학생부·출결·정정",
    questions: [
      "학부모가 인정결석 서류가 너무 많다며 출결 처리 기준을 묻습니다.",
      "생활기록부 문구 정정 요구가 들어왔는데 증빙과 절차가 궁금합니다."
    ],
    expected: ["학생부·출결·정정", "학교생활기록"],
    forbidden: ["출장비", "학교폭력 사안처리 확인 기준"]
  },
  {
    domain: "schoolSafetyHealth",
    title: "학교안전·보건·사고대응",
    questions: [
      "학생이 체육시간에 다쳐 보건실과 보호자 연락, 안전공제 절차가 필요합니다.",
      "학생이 실습 중 손을 다쳐 보건실 처치와 안전공제 사고보고가 필요합니다."
    ],
    expected: ["학교안전·보건·사고대응", "안전"],
    forbidden: ["출장비", "학교회계·예산·지출 확인 기준"]
  },
  {
    domain: "specialEducationSupport",
    title: "특수교육·지원·통합교육",
    questions: [
      "장애학생 통합교육 지원인력 배치와 개별화교육계획 회의 자료가 필요합니다.",
      "특수교육대상자 치료지원 관련 보호자 동의와 기록 관리는 어떻게 하나요?"
    ],
    expected: ["특수교육·지원·통합교육", "특수교육"],
    forbidden: ["출장비", "급식 운영 기준"]
  },
  {
    domain: "assessmentAcademicManagement",
    title: "평가·성적·학업성적관리",
    questions: [
      "시험 중 부정행위로 오해받은 학생이 이의신청했습니다. 의견청취 절차가 궁금합니다.",
      "수행평가 채점 기준 민원이 들어왔는데 학업성적관리규정을 확인해야 합니다."
    ],
    expected: ["평가·성적·학업성적관리", "학업성적관리"],
    forbidden: ["출장비", "기숙사 운영·생활지도 확인 기준"]
  },
  {
    domain: "schoolInstructorHonorarium",
    title: "강사수당·강사료",
    questions: [
      "전직 교감의 1시간 강사비는?",
      "경북교육청 전직 교감의 2시간 강의비는?"
    ],
    expected: ["강사수당·강사료", "일반강사2"],
    forbidden: ["방과후학교·돌봄·늘봄 확인 기준", "수강료 환불", "출장비"]
  },
  {
    domain: "afterSchoolChildcare",
    title: "방과후학교·돌봄·늘봄",
    questions: [
      "방과후학교 강사 선정과 수강료 환불 기준을 교육청 지침으로 확인하고 싶습니다.",
      "늘봄 프로그램 위탁 계약과 학생 안전관리 자료는 무엇을 봐야 하나요?"
    ],
    expected: ["방과후학교·돌봄·늘봄", "교육청"],
    forbidden: ["출장비", "학교폭력 사안처리 확인 기준"]
  },
  {
    domain: "vocationalFieldTrainingOperation",
    title: "현장실습·도제·산학협력",
    questions: [
      "특성화고 현장실습 표준협약서와 선도기업 점검은 어떻게 해야 하나요?",
      "도제학교 일학습병행 기업훈련 시간과 훈련수당 지침은?"
    ],
    expected: ["현장실습·도제·산학협력", "현장실습"],
    forbidden: ["출장비", "강사수당·강사료 확인 기준", "학교급식·위생·민원 확인 기준"]
  },
  {
    domain: "vocationalCurriculumNcs",
    title: "직업계고 교육과정·NCS·학점제",
    questions: [
      "ncs 실무과목과 직업계고학점제 이수 기준은 어떻게 확인하나요?",
      "특성화고 공동교육과정과 전문교과 평가계획은 어떤 지침을 보나요?"
    ],
    expected: ["직업계고 교육과정·NCS·학점제", "교육과정"],
    forbidden: ["출장비", "학교폭력 사안처리 확인 기준", "급식 운영 기준"]
  },
  {
    domain: "labEquipmentPracticeSafety",
    title: "실험실습실·기자재·실습재료·안전",
    questions: [
      "실험실습실 기자재와 보호구, MSDS 안전점검은 어떻게 해야 하나요?",
      "특성화고 실습재료와 위험기계 안전교육 기록은 무엇을 남겨야 하나요?"
    ],
    expected: ["실험실습실·기자재·실습재료·안전", "안전"],
    forbidden: ["출장비", "고졸 채용정보", "학교급식·위생·민원 확인 기준"]
  },
  {
    domain: "careerEmploymentGuidance",
    title: "취업지도·채용공고·졸업생 노동상담",
    questions: [
      "고졸채용 정보를 잡알리오와 경남교육청 취업지원센터 공고로 교차 확인하려면?",
      "졸업생이 첫 월급을 못 받았다고 학교에 문의했는데 취업지도 자료와 근로조건 확인은?"
    ],
    expected: ["취업지도·채용공고·졸업생 노동상담", "잡알리오"],
    forbidden: ["경상남도교육청 취업지원센터 공채캘린더", "부산광역시교육청 취업지원센터 고졸 채용공고", "출장비"]
  },
  {
    domain: "admissionsTransferGraduation",
    title: "입학·특별전형·재직자전형·학적·졸업",
    questions: [
      "특성화고 전입학과 졸업 학적 처리는 어떤 규정을 확인하나요?",
      "직업위탁 학생의 수료와 졸업 인정 기준은 어디서 확인하나요?"
    ],
    expected: ["입학·특별전형·재직자전형·학적·졸업", "학적"],
    forbidden: ["출장비", "학교급식·위생·민원 확인 기준"]
  },
  {
    domain: "scholarshipWelfareSupport",
    title: "장학·교육복지·수익자부담",
    questions: [
      "기숙사비와 교육급여, 수익자부담 환불 기준은 어떻게 확인하나요?",
      "특성화고 학생 장학금과 통학비 지원 대상은 어떤 자료를 봐야 하나요?"
    ],
    expected: ["장학·교육복지·수익자부담", "교육급여"],
    forbidden: ["출장비", "학교폭력 사안처리 확인 기준"]
  },
  {
    domain: "healthInfectionCounseling",
    title: "보건·감염병·상담·위기학생",
    questions: [
      "감염병 등교중지와 위기학생 상담기록은 어떤 절차로 관리하나요?",
      "학생 자해 위험 신호가 있을 때 보건실과 Wee 상담 기록은 어떻게 남기나요?"
    ],
    expected: ["보건·감염병·상담·위기학생", "상담"],
    forbidden: ["출장비", "강사수당·강사료 확인 기준"]
  },
  {
    domain: "teacherRightsProtection",
    title: "교육활동 보호·교권침해·교직원 보호",
    questions: [
      "학부모 악성민원과 교권 침해가 있을 때 교육활동 보호 절차는?",
      "교사가 아동학대 신고를 당했을 때 교육활동 보호 자료와 상담기록은?"
    ],
    expected: ["교육활동 보호·교권침해·교직원 보호", "교권"],
    forbidden: ["출장비", "급식 운영 기준"]
  },
  {
    domain: "facilityDigitalSecurity",
    title: "시설·정보화·개인정보·CCTV·보안",
    questions: [
      "학교 CCTV 영상정보와 개인정보, 나이스 계정 권한은 어떻게 처리하나요?",
      "K-에듀파인 접근권한과 스마트기기 반납 기록은 어떤 기준을 보나요?"
    ],
    expected: ["시설·정보화·개인정보·CCTV·보안", "개인정보"],
    forbidden: ["출장비", "학교폭력 사안처리 확인 기준"]
  },
  {
    domain: "governanceCommitteeRule",
    title: "학교운영위원회·규정개정·위원회",
    questions: [
      "학교운영위원회 회의록 공개와 학칙개정 심의 절차는?",
      "학부모회와 교무위원회 회의록 보존 기준은 어떤 규정을 확인하나요?"
    ],
    expected: ["학교운영위원회·규정개정·위원회", "회의록"],
    forbidden: ["출장비", "강사수당·강사료 확인 기준"]
  }
];

let generatedBroadPolicyCaseCount = 0;
for (const domainCase of broadPolicyDomainMatrix) {
  for (const question of domainCase.questions) {
    const frame = policyEngine.buildPolicySemanticFrame(question);
    if (frame?.domainCode !== domainCase.domain) {
      failures.push(`policy-engine-broad-domain-matrix: expected ${domainCase.domain} for "${question}", got ${frame?.domainCode}`);
    }
    const guide = context.buildPolicyGuideResponse({
      question,
      officeCode: "auto",
      roleCode: "auto",
      categoryCode: "auto"
    });
    const html = context.renderPolicyGuideResponse(guide);
    generatedBroadPolicyCaseCount += 1;
    assertGuideDomain(`policy-guide-broad-domain-matrix:${domainCase.domain}`, guide, domainCase.domain);
    assertNoPolicyGuideInternalLeaks(`policy-guide-broad-domain-matrix:${domainCase.domain}`, html);
    for (const expected of domainCase.expected) {
      if (expected === domainCase.title) continue;
      if (!html.includes(expected)) {
        failures.push(`policy-guide-broad-domain-matrix:${domainCase.domain}: expected "${expected}" for "${question}"`);
      }
    }
    for (const forbidden of domainCase.forbidden) {
      if (html.includes(forbidden)) {
        failures.push(`policy-guide-broad-domain-matrix:${domainCase.domain}: leaked "${forbidden}" for "${question}"`);
      }
    }
  }
}

if (generatedBroadPolicyCaseCount !== broadPolicyDomainMatrix.reduce((sum, domainCase) => sum + domainCase.questions.length, 0)) {
  failures.push("policy-guide-broad-domain-matrix: generated broad policy matrix count mismatch");
}

const instructorAutoGuide = context.buildPolicyGuideResponse({
  question: "전직 교감의 1시간 강사비는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const instructorAutoGuideHtml = context.renderPolicyGuideResponse(instructorAutoGuide);
assertGuideDomain("policy-guide-instructor-auto", instructorAutoGuide, "schoolInstructorHonorarium");
assertNoPolicyGuideInternalLeaks("policy-guide-instructor-auto", instructorAutoGuideHtml);
if (!instructorAutoGuideHtml.includes("전직 교감") || !instructorAutoGuideHtml.includes("일반강사2") || !instructorAutoGuideHtml.includes("120,000원")) {
  failures.push("policy-guide-instructor-auto: expected former vice-principal one-hour instructor fee classification and conditional rate");
}
if (!instructorAutoGuide.officeDefault || !instructorAutoGuideHtml.includes("교육청을 선택하지 않아 경상북도교육청 기준으로 우선 답변합니다") || instructorAutoGuideHtml.includes("방과후학교·돌봄·늘봄 확인 기준") || instructorAutoGuideHtml.includes("수강료 환불")) {
  failures.push("policy-guide-instructor-auto: expected Gyeongbuk default missing-office caveat and no after-school leakage");
}

const universityFullTimeInstructorGuide = context.buildPolicyGuideResponse({
  question: "대학 전임강사의 강의비는 얼마인가요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const universityFullTimeInstructorGuideHtml = context.renderPolicyGuideResponse(universityFullTimeInstructorGuide);
if (!universityFullTimeInstructorGuideHtml.includes("대학 전임강사") || !universityFullTimeInstructorGuideHtml.includes("일반강사2") || !universityFullTimeInstructorGuideHtml.includes("기본 1시간 120,000원") || !universityFullTimeInstructorGuideHtml.includes("초과시간당 60,000원")) {
  failures.push("policy-guide-instructor-university-full-time: expected university full-time lecturer to resolve to Gyeongbuk general instructor 2 rates");
}
if (universityFullTimeInstructorGuideHtml.includes("강사 등급과 기본·초과시간 단가를 먼저 확인해야 합니다")) {
  failures.push("policy-guide-instructor-university-full-time: should not remain unresolved when full-time lecturer profile is present");
}

const gyeongbukInstructorGuide = context.buildPolicyGuideResponse({
  question: "전직 교장의 강의비는 시간당 얼마인가요?",
  officeCode: "gyeongbuk",
  roleCode: "privateSchool",
  categoryCode: "budgetExecution"
});
const gyeongbukInstructorGuideHtml = context.renderPolicyGuideResponse(gyeongbukInstructorGuide);
if (!gyeongbukInstructorGuideHtml.includes("기본 1시간 200,000원") || !gyeongbukInstructorGuideHtml.includes("초과시간당 100,000원") || !gyeongbukInstructorGuideHtml.includes("일반강사1")) {
  failures.push("policy-guide-gyeongbuk-instructor: expected conclusion-first principal instructor fee amount");
}
if (!gyeongbukInstructorGuideHtml.includes("경상북도교육청") || !gyeongbukInstructorGuideHtml.includes("2026학년도 공립학교회계 예산편성 기본지침") || !gyeongbukInstructorGuideHtml.includes("사립학교")) {
  failures.push("policy-guide-gyeongbuk-instructor: expected Gyeongbuk source and private-school caveat");
}

const gyeongbukVicePrincipalGuide = context.buildPolicyGuideResponse({
  question: "전직 교감의 2시간 강의비는 얼마인가요?",
  officeCode: "gyeongbuk",
  roleCode: "privateSchool",
  categoryCode: "auto"
});
const gyeongbukVicePrincipalGuideHtml = context.renderPolicyGuideResponse(gyeongbukVicePrincipalGuide);
if (!gyeongbukVicePrincipalGuideHtml.includes("전직 교감은 일반강사2") || !gyeongbukVicePrincipalGuideHtml.includes("2시간 강의비는 180,000원") || !gyeongbukVicePrincipalGuideHtml.includes("기본 1시간 120,000원")) {
  failures.push("policy-guide-gyeongbuk-instructor: expected vice-principal 2-hour fee calculation");
}
if (!gyeongbukVicePrincipalGuideHtml.includes("초과 1시간") || !gyeongbukVicePrincipalGuideHtml.includes("60,000원") || !gyeongbukVicePrincipalGuideHtml.includes("교육공무원")) {
  failures.push("policy-guide-gyeongbuk-instructor: expected vice-principal rate basis and calculation detail");
}

const privatePrincipalTravelGuide = context.buildPolicyGuideResponse({
  question: "사립학교 교장의 서울 출장시 숙박비 한도는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const privatePrincipalTravelGuideHtml = context.renderPolicyGuideResponse(privatePrincipalTravelGuide);
if (!privatePrincipalTravelGuideHtml.includes("사립학교 교장") || !privatePrincipalTravelGuideHtml.includes("제1호 기준 실비 정산") || !privatePrincipalTravelGuideHtml.includes("서울 100,000원 상한이 아니라")) {
  failures.push("policy-guide-travel: expected private principal Seoul lodging answer to use grade 1 actual expense");
}
if (!privatePrincipalTravelGuideHtml.includes("별표 9") || !privatePrincipalTravelGuideHtml.includes("국공립학교 교원의 여비 지급등급") || !privatePrincipalTravelGuideHtml.includes("별표 2")) {
  failures.push("policy-guide-travel: expected private-school and domestic travel table basis");
}

const privatePrincipalTravelVariant = context.buildPolicyGuideResponse({
  question: "사립고 학교장이 서울로 관외출장을 가면 1박 숙소비는 얼마까지 인정되나요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const privatePrincipalTravelVariantHtml = context.renderPolicyGuideResponse(privatePrincipalTravelVariant);
if (!privatePrincipalTravelVariantHtml.includes("사립학교 교장") || !privatePrincipalTravelVariantHtml.includes("제1호 기준 실비 정산") || !privatePrincipalTravelVariantHtml.includes("출장명령")) {
  failures.push("policy-guide-travel: expected phrasing variant to normalize to private principal lodging rule");
}

const teacherTravelGuide = context.buildPolicyGuideResponse({
  question: "교사의 서울 출장 숙박비는 얼마까지 가능한가요?",
  officeCode: "auto",
  roleCode: "teacher",
  categoryCode: "auto"
});
const teacherTravelGuideHtml = context.renderPolicyGuideResponse(teacherTravelGuide);
if (!teacherTravelGuideHtml.includes("1박당 상한 100,000원") || !teacherTravelGuideHtml.includes("제2호") || !teacherTravelGuideHtml.includes("서울특별시")) {
  failures.push("policy-guide-travel: expected teacher Seoul lodging cap under grade 2");
}

const principalGyeongjuTravelGuide = context.buildPolicyGuideResponse({
  question: "교장의 경주 출장시 일비 식비는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const principalGyeongjuTravelGuideHtml = context.renderPolicyGuideResponse(principalGyeongjuTravelGuide);
if (!principalGyeongjuTravelGuideHtml.includes("초·중·고등학교 교장") || !principalGyeongjuTravelGuideHtml.includes("경주시 출장") || !principalGyeongjuTravelGuideHtml.includes("일비는 25,000원") || !principalGyeongjuTravelGuideHtml.includes("식비는 25,000원") || !principalGyeongjuTravelGuideHtml.includes("합계는 50,000원")) {
  failures.push("policy-guide-travel-expense: expected principal Gyeongju daily and meal expense to use generic travel engine");
}
if (principalGyeongjuTravelGuideHtml.includes("교원휴가 예규, 국가공무원 복무규정, 교육공무원 관련 규정과 교육청 지침을 함께 봅니다.")) {
  failures.push("policy-guide-travel-expense: principal Gyeongju question should not fall back to generic leave guidance");
}
if (principalGyeongjuTravelGuideHtml.includes("소속 교육청 우선 자료") || principalGyeongjuTravelGuideHtml.includes("소속 교육청 지침이나 학교법인 여비규정")) {
  failures.push("policy-guide-travel-expense: public principal common travel expense should not require education-office-first materials");
}

const teacherUnknownCityTravelGuide = context.buildPolicyGuideResponse({
  question: "교사의 진해원시 출장시 일비와 식비는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const teacherUnknownCityTravelGuideHtml = context.renderPolicyGuideResponse(teacherUnknownCityTravelGuide);
if (!teacherUnknownCityTravelGuideHtml.includes("교원") || !teacherUnknownCityTravelGuideHtml.includes("진해원시 출장") || !teacherUnknownCityTravelGuideHtml.includes("1일 기준 일비는 25,000원") || !teacherUnknownCityTravelGuideHtml.includes("식비는 25,000원")) {
  failures.push("policy-guide-travel-expense: expected typo-like city token to stay in travel expense answer");
}
if (teacherUnknownCityTravelGuideHtml.includes("공립 교원은 교원휴가 예규")) {
  failures.push("policy-guide-travel-expense: teacher city expense question should not fall back to generic teacher leave text");
}

const teacherJinhaeTravelGuide = context.buildPolicyGuideResponse({
  question: "교사의 진해시 출장시 일비와 식비는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const teacherJinhaeTravelGuideHtml = context.renderPolicyGuideResponse(teacherJinhaeTravelGuide);
if (!teacherJinhaeTravelGuideHtml.includes("교원") || !teacherJinhaeTravelGuideHtml.includes("진해시 출장") || !teacherJinhaeTravelGuideHtml.includes("1일 기준 일비는 25,000원") || !teacherJinhaeTravelGuideHtml.includes("식비는 25,000원")) {
  failures.push("policy-guide-travel-expense: expected exact visible Jinhae teacher expense question to answer common travel amount");
}
if (teacherJinhaeTravelGuideHtml.includes("소속 교육청 우선 자료") || teacherJinhaeTravelGuideHtml.includes("공립 교원은 교원휴가 예규") || teacherJinhaeTravelGuideHtml.includes("소속 교육청 지침이나 학교법인 여비규정")) {
  failures.push("policy-guide-travel-expense: exact visible Jinhae teacher expense question should not show generic or education-office-first guidance");
}

const teacherOvernightFullTravelGuide = context.buildPolicyGuideResponse({
  question: "경주정보고 교사의 남해군 1박 2일 출장시 출장비는?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const teacherOvernightFullTravelGuideHtml = context.renderPolicyGuideResponse(teacherOvernightFullTravelGuide);
if (!teacherOvernightFullTravelGuideHtml.includes("남해군") || !teacherOvernightFullTravelGuideHtml.includes("출장비") || !teacherOvernightFullTravelGuideHtml.includes("최대 170,000원") || !teacherOvernightFullTravelGuideHtml.includes("일비 50,000원") || !teacherOvernightFullTravelGuideHtml.includes("식비 50,000원") || !teacherOvernightFullTravelGuideHtml.includes("숙박비 70,000원") || !teacherOvernightFullTravelGuideHtml.includes("운임")) {
  failures.push("policy-guide-travel-expense: expected 1-night 2-day full travel expense calculation");
}
if (teacherOvernightFullTravelGuideHtml.includes("비는시") || teacherOvernightFullTravelGuideHtml.includes("남해군가") || teacherOvernightFullTravelGuideHtml.includes("운임는") || teacherOvernightFullTravelGuideHtml.includes("출장 출장비") || teacherOvernightFullTravelGuideHtml.includes("국내 출장 숙박비 확인 기준") || teacherOvernightFullTravelGuideHtml.includes("국내 출장 숙박비는 실비 정산하되 1박당 상한")) {
  failures.push("policy-guide-travel-expense: full travel expense question should not be narrowed to lodging or leak malformed slots");
}

const nationwideTravelCities = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "수원", "춘천", "청주", "천안", "전주", "목포", "포항", "창원",
  "제주", "남원", "경주", "진해", "강릉", "군산"
];
const travelSubjectVariants = [
  { label: "교사", expectedRole: "교원" },
  { label: "선생님", expectedRole: "교원" },
  { label: "교장", expectedRole: "초·중·고등학교 교장" },
  { label: "학교장", expectedRole: "초·중·고등학교 교장" },
  { label: "행정직", expectedRole: "지방공무원·행정직" }
];
const travelQuestionTemplates = [
  ({ subject, city }) => `${subject}의 ${city} 출장시 일비와 식비는?`,
  ({ subject, city }) => `${city}로 출장 가는 ${subject}의 식대랑 일당`,
  ({ subject, city }) => `출장지는 ${city}, 대상은 ${subject}. 일비랑 식비 얼마?`,
  ({ subject, city }) => `${subject}이 ${city} 다녀오면 출장비 계산은?`,
  ({ subject, city }) => `${city} 관외출장 ${subject} 여비 중 밥값과 하루일비`
];

let generatedTravelCaseCount = 0;
let generatedOvernightTravelCaseCount = 0;
for (const city of nationwideTravelCities) {
  for (const subject of travelSubjectVariants) {
    for (const template of travelQuestionTemplates) {
      const question = template({ subject: subject.label, city });
      const guide = context.buildPolicyGuideResponse({
        question,
        officeCode: "auto",
        roleCode: "auto",
        categoryCode: "auto"
      });
      const html = context.renderPolicyGuideResponse(guide);
      generatedTravelCaseCount += 1;
      if (!html.includes(subject.expectedRole) || !html.includes(city) || !html.includes("25,000원") || !html.includes("식비")) {
        failures.push(`policy-guide-travel-matrix: failed to normalize "${question}"`);
      }
      if (html.includes("공립 교원은 교원휴가 예규") || html.includes("소속 교육청 우선 자료") || html.includes("소속 교육청 지침이나 학교법인 여비규정")) {
        failures.push(`policy-guide-travel-matrix: common public travel question leaked office/generic guidance for "${question}"`);
      }
    }
  }
}
if (generatedTravelCaseCount !== nationwideTravelCities.length * travelSubjectVariants.length * travelQuestionTemplates.length) {
  failures.push("policy-guide-travel-matrix: generated travel regression matrix count mismatch");
}

const metropolitanTravelCities = new Set(["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종"]);
const overnightTravelQuestionTemplates = [
  ({ subject, city }) => `${subject}의 ${city} 1박 2일 출장비는?`,
  ({ subject, city }) => `학교 ${subject}이 ${city}로 1박 2일 출장 가면 출장비 계산`,
  ({ subject, city }) => `${city} 1박 2일 관외출장 ${subject} 여비는 얼마?`
];
function expectedOneNightTravelTotal(city) {
  if (city === "서울") return "200,000원";
  if (metropolitanTravelCities.has(city)) return "180,000원";
  return "170,000원";
}

for (const city of nationwideTravelCities) {
  for (const subject of travelSubjectVariants) {
    for (const template of overnightTravelQuestionTemplates) {
      const question = template({ subject: subject.label, city });
      const guide = context.buildPolicyGuideResponse({
        question,
        officeCode: "auto",
        roleCode: "auto",
        categoryCode: "auto"
      });
      const html = context.renderPolicyGuideResponse(guide);
      generatedOvernightTravelCaseCount += 1;
      const isGradeOne = subject.expectedRole.includes("교장");
      const expectedAmountMatched = isGradeOne
        ? html.includes("숙박비는 제1호 기준 실비") && html.includes("바로 계산되는 금액은 100,000원")
        : html.includes(expectedOneNightTravelTotal(city)) && html.includes("숙박비");
      if (!html.includes(subject.expectedRole) || !html.includes(city) || !html.includes("출장비") || !expectedAmountMatched || !html.includes("일비 50,000원") || !html.includes("식비 50,000원") || !html.includes("운임")) {
        failures.push(`policy-guide-overnight-travel-matrix: failed to calculate broad travel expense for "${question}"`);
      }
      if (html.includes("비는시") || html.includes(`${city}가 근무지`) || html.includes("운임는") || html.includes("출장 출장비") || html.includes("국내 출장 숙박비 확인 기준") || html.includes("소속 교육청 우선 자료")) {
        failures.push(`policy-guide-overnight-travel-matrix: broad travel question leaked malformed or narrowed guidance for "${question}"`);
      }
    }
  }
}
if (generatedOvernightTravelCaseCount !== nationwideTravelCities.length * travelSubjectVariants.length * overnightTravelQuestionTemplates.length) {
  failures.push("policy-guide-overnight-travel-matrix: generated overnight travel regression matrix count mismatch");
}

const noRoleTravelGuide = context.buildPolicyGuideResponse({
  question: "출장 일비와 식비는 어떻게 계산하나요?",
  officeCode: "auto",
  roleCode: "auto",
  categoryCode: "auto"
});
const noRoleTravelGuideHtml = context.renderPolicyGuideResponse(noRoleTravelGuide);
if (!noRoleTravelGuideHtml.includes("출장자") || !noRoleTravelGuideHtml.includes("신분 확인 필요") || !noRoleTravelGuideHtml.includes("일비는 25,000원") || !noRoleTravelGuideHtml.includes("식비는 25,000원")) {
  failures.push("policy-guide-travel-expense: expected missing-role travel question to answer issue and mark grade as needed");
}
if (noRoleTravelGuideHtml.includes("출장자은") || noRoleTravelGuideHtml.includes("지급등급 확인 필요 국내여비")) {
  failures.push("policy-guide-travel-expense: missing-role travel answer should not leak awkward placeholder grammar");
}

if (!indexHtml.includes('data-tool-tab="legal"') || indexHtml.includes('data-tool-tab="guide"') || !indexHtml.includes('data-tool-panel="guide"') || !indexHtml.includes("hidden")) {
  failures.push("tool-tabs: expected a single visible legal question tab and hidden legacy guide panel only");
}
const policyScriptOrder = [
  "policy-knowledge-base.js",
  "policy-source-registry.js",
  "policy-corpus.js",
  "policy-engine.js",
  "app.js"
].map((scriptName) => indexHtml.indexOf(scriptName));
if (policyScriptOrder.some((index) => index < 0) || policyScriptOrder.some((index, offset, order) => offset > 0 && index < order[offset - 1])) {
  failures.push("policy-script-order: expected knowledge base, source registry, corpus, engine, and app scripts in order");
}

context.activateTool("guide");
if (legalToolPanel.hidden || !guideToolPanel.hidden || !legalToolTab.classList.contains("active") || guideToolTab.classList.contains("active")) {
  failures.push("tool-tabs: expected guide alias to activate the unified legal question panel");
}
context.activateTool("legal");
if (legalToolPanel.hidden || !guideToolPanel.hidden || !legalToolTab.classList.contains("active") || guideToolTab.classList.contains("active")) {
  failures.push("tool-tabs: expected only legal panel active after legal tab activation");
}

if (failures.length) {
  console.error(`Scenario regression failed: ${failures.length}`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Scenario regression passed: ${cases.length} scripted cases + ${generatedBroadPolicyCaseCount} broad policy cases + ${generatedTravelCaseCount} generated travel cases + ${generatedOvernightTravelCaseCount} overnight travel cases`);
