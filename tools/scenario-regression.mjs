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

const cases = [
  {
    id: "field-scope-cleaning",
    question: "현장실습 중인 학생에게 기존 근로자가 근무시간 중에 청소를 자꾸 시킵니다. 생산에 필요한 재료를 가져오라 하면서 주변 청소를 반복적으로 시키고, 어떨 때는 필요도 없는 재료를 가져오라 하며 또 청소를 시킵니다.",
    expect: { preset: "fieldTraining", scenario: "fieldTrainingScopeIssue", disposition: "internal" },
    mustInclude: ["업무 범위", "반복 지시", "현장실습계약서"],
    mustNotInclude: [...accidentWords, educationDraftText, "중대재해"]
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
  }
];

function buildResult(question) {
  const preset = context.findPreset(question, "auto");
  const scenario = context.analyzeQuestionScenario(question, preset);
  const displayPreset = context.getScenarioDisplayPreset(preset, scenario);
  const materials = context.getOfficialMaterials(displayPreset, scenario, question);
  const report = context.buildCaseReport(question, displayPreset, { label: "상황 중심" }, materials, context.detectRiskSignals(question), scenario);
  const direct = context.getDirectAnswer(question, displayPreset, { label: "상황 중심" }, scenario);
  const html = context.renderCaseReport(report);

  return {
    preset,
    scenario,
    displayPreset,
    report,
    direct,
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
    result.html
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

if (failures.length) {
  console.error(`Scenario regression failed: ${failures.length}`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Scenario regression passed: ${cases.length} cases`);
