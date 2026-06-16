import fs from "node:fs";
import vm from "node:vm";

const files = [
  "public/policy-knowledge-base.js",
  "public/policy-source-registry.js",
  "public/policy-corpus.js",
  "public/policy-question-taxonomy.js",
  "public/policy-engine.js",
  "public/app.js"
];

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
    clearTimeout() {},
    open() { return null; },
    print() {},
    confirm() { return true; },
    location: { hash: "", search: "" }
  }
};

vm.createContext(context);
for (const file of files) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

const failures = [];
const diagnostics = [];
const taxonomy = context.GYO6_POLICY_QUESTION_TAXONOMY;

function getGuide(question, options = {}) {
  return context.buildPolicyGuideResponse({
    question,
    officeCode: options.officeCode || "auto",
    roleCode: options.roleCode || "auto",
    categoryCode: options.categoryCode || "auto"
  });
}

function checkTaxonomy(testCase) {
  const candidates = taxonomy.classify(testCase.question, { limit: 5 });
  const primary = candidates[0] || {};
  diagnostics.push({
    id: testCase.id,
    mode: "taxonomy",
    primary: primary.code || "",
    confidence: primary.confidence || 0,
    candidates: candidates.map((item) => item.code)
  });

  if (testCase.intent && primary.code !== testCase.intent) {
    failures.push(`${testCase.id}: expected taxonomy intent ${testCase.intent}, got ${primary.code || "none"}`);
  }
  for (const forbidden of testCase.forbidIntents || []) {
    if (candidates.slice(0, 3).some((item) => item.code === forbidden)) {
      failures.push(`${testCase.id}: taxonomy top candidates leaked ${forbidden}`);
    }
  }
}

function checkGuide(testCase) {
  const guide = getGuide(testCase.question, testCase.options || {});
  const html = context.renderPolicyGuideResponse(guide);
  const primaryIntent = guide.intentResolution?.primary?.code || "";
  const domain = guide.directRule?.domain || guide.analysis?.engineAnalysis?.semanticFrame?.domainCode || "";
  const categoryCode = guide.category?.code || "";

  diagnostics.push({
    id: testCase.id,
    mode: "guide",
    primaryIntent,
    domain,
    categoryCode,
    needsIntentConfirmation: Boolean(guide.needsIntentConfirmation)
  });

  if (Object.prototype.hasOwnProperty.call(testCase, "needsIntentConfirmation") && Boolean(guide.needsIntentConfirmation) !== testCase.needsIntentConfirmation) {
    failures.push(`${testCase.id}: expected needsIntentConfirmation=${testCase.needsIntentConfirmation}, got ${Boolean(guide.needsIntentConfirmation)}`);
  }
  if (testCase.intent && primaryIntent && primaryIntent !== testCase.intent) {
    failures.push(`${testCase.id}: expected guide intent ${testCase.intent}, got ${primaryIntent}`);
  }
  if (testCase.domain && domain !== testCase.domain) {
    failures.push(`${testCase.id}: expected guide domain ${testCase.domain}, got ${domain || "none"}`);
  }
  if (testCase.categoryCode && categoryCode !== testCase.categoryCode) {
    failures.push(`${testCase.id}: expected guide category ${testCase.categoryCode}, got ${categoryCode || "none"}`);
  }
  for (const expected of testCase.mustInclude || []) {
    if (!html.includes(expected)) {
      failures.push(`${testCase.id}: expected rendered answer to include "${expected}"`);
    }
  }
  const commonInternalLeaks = ["파악한 질문", "일치 표현", "분류:", "기본 조건:", "로컬 정책 코퍼스", "확인 슬롯", "질문 문장만 기준"];
  for (const forbidden of [...commonInternalLeaks, ...(testCase.mustNotInclude || [])]) {
    const index = html.indexOf(forbidden);
    if (index >= 0) {
      const start = Math.max(0, index - 80);
      const end = Math.min(html.length, index + forbidden.length + 80);
      const snippet = html.slice(start, end).replace(/\s+/g, " ").trim();
      failures.push(`${testCase.id}: rendered answer leaked "${forbidden}" near "${snippet}"`);
    }
  }
}

function checkRoleCategory(testCase) {
  const options = context.getPolicyCategoryOptionsForRole(testCase.role);
  const values = options.map((option) => option.value);
  diagnostics.push({
    id: testCase.id,
    mode: "roleCategory",
    role: testCase.role,
    values: values.slice(0, 12)
  });

  for (const expected of testCase.mustInclude || []) {
    if (!values.includes(expected)) {
      failures.push(`${testCase.id}: expected role ${testCase.role} category options to include ${expected}`);
    }
  }

  const topValues = values.slice(0, testCase.topLimit || values.length);
  for (const forbidden of testCase.mustNotIncludeTop || []) {
    if (topValues.includes(forbidden)) {
      failures.push(`${testCase.id}: role ${testCase.role} should not show ${forbidden} in top ${topValues.length} options`);
    }
  }

  if (testCase.expectedPrefix) {
    const prefix = values.slice(0, testCase.expectedPrefix.length);
    if (prefix.join("|") !== testCase.expectedPrefix.join("|")) {
      failures.push(`${testCase.id}: expected prefix ${testCase.expectedPrefix.join(", ")}, got ${prefix.join(", ")}`);
    }
  }
}

function checkTopicBridge(testCase) {
  if (!context.inferTopicPath || !context.buildTopicContextFromPath || !context.mapTopicContextToPolicyCategory) {
    failures.push(`${testCase.id}: app topic bridge helpers are not available`);
    return;
  }

  const path = context.inferTopicPath(testCase.question, { type: testCase.presetType || "general" });
  const topicContext = context.buildTopicContextFromPath(path, true);
  const categoryCode = context.mapTopicContextToPolicyCategory(topicContext);
  diagnostics.push({
    id: testCase.id,
    mode: "topicBridge",
    path,
    topicContext,
    categoryCode
  });

  if (testCase.major && topicContext.major !== testCase.major) {
    failures.push(`${testCase.id}: expected topic major ${testCase.major}, got ${topicContext.major || "none"}`);
  }
  if (testCase.middle && topicContext.middle !== testCase.middle) {
    failures.push(`${testCase.id}: expected topic middle ${testCase.middle}, got ${topicContext.middle || "none"}`);
  }
  if (testCase.minor && topicContext.minor !== testCase.minor) {
    failures.push(`${testCase.id}: expected topic minor ${testCase.minor}, got ${topicContext.minor || "none"}`);
  }
  if (testCase.categoryCode && categoryCode !== testCase.categoryCode) {
    failures.push(`${testCase.id}: expected mapped category ${testCase.categoryCode}, got ${categoryCode || "none"}`);
  }
}

function checkTopicMajorRole(testCase) {
  if (!context.getTopicMajorOptionsForRole) {
    failures.push(`${testCase.id}: getTopicMajorOptionsForRole is not available`);
    return;
  }

  const options = context.getTopicMajorOptionsForRole(testCase.role);
  const values = options.map((option) => option.value);
  diagnostics.push({
    id: testCase.id,
    mode: "topicMajorRole",
    role: testCase.role,
    values
  });

  for (const expected of testCase.mustInclude || []) {
    if (!values.includes(expected)) {
      failures.push(`${testCase.id}: expected role ${testCase.role} topic major options to include ${expected}`);
    }
  }

  for (const forbidden of testCase.mustNotInclude || []) {
    if (values.includes(forbidden)) {
      failures.push(`${testCase.id}: role ${testCase.role} topic major options should not include ${forbidden}`);
    }
  }

  if (testCase.expectedPrefix) {
    const prefix = values.slice(0, testCase.expectedPrefix.length);
    if (prefix.join("|") !== testCase.expectedPrefix.join("|")) {
      failures.push(`${testCase.id}: expected topic major prefix ${testCase.expectedPrefix.join(", ")}, got ${prefix.join(", ")}`);
    }
  }
}

const roleCategoryCases = [
  {
    id: "role-category-student-first",
    role: "student",
    expectedPrefix: ["auto", "studentAttendance", "fieldExperienceLearning", "vocationalFieldTraining", "careerEmployment", "admissionsPathways"],
    mustInclude: ["studentRecords", "schoolViolenceGuide", "studentLifeGuidance", "studentWelfare", "studentHealthCounseling", "studentSafety", "vocationalCurriculum"],
    mustNotIncludeTop: ["leaveAttendance", "budgetExecution", "staffContract", "staffProtection"],
    topLimit: 10
  },
  {
    id: "role-category-parent-student-flow",
    role: "parent",
    mustInclude: ["studentAttendance", "fieldExperienceLearning", "studentRecords", "schoolViolenceGuide", "studentLifeGuidance", "studentWelfare"],
    mustNotIncludeTop: ["staffContract", "budgetExecution", "leaveAttendance"],
    topLimit: 9
  },
  {
    id: "role-category-teacher-student-operations",
    role: "teacher",
    mustInclude: ["studentAttendance", "vocationalFieldTraining", "careerEmployment", "studentRecords", "leaveAttendance", "staffProtection"],
    mustNotIncludeTop: ["staffContract", "facilityDigital"],
    topLimit: 8
  },
  {
    id: "role-category-local-officer-admin-first",
    role: "localOfficer",
    expectedPrefix: ["auto", "leaveAttendance", "staffContract", "budgetExecution", "documentDisclosure"],
    mustInclude: ["facilityDigital", "governanceRecords", "staffProtection"],
    mustNotIncludeTop: ["studentRecords", "studentAttendance", "admissionsPathways"],
    topLimit: 10
  }
];

const topicMajorRoleCases = [
  {
    id: "topic-major-student-does-not-show-staff-first",
    role: "student",
    expectedPrefix: ["auto", "studentPathway", "studentSupport", "vocationalLearning"],
    mustInclude: ["employment", "fieldTraining", "schoolViolence"],
    mustNotInclude: ["staffLabor", "schoolAdministration"]
  },
  {
    id: "topic-major-local-officer-staff-admin-only",
    role: "localOfficer",
    expectedPrefix: ["auto", "staffLabor", "schoolAdministration", "schoolSafety", "civilComplaint"],
    mustNotInclude: ["studentPathway", "studentSupport", "vocationalLearning", "employment", "fieldTraining", "schoolViolence"]
  },
  {
    id: "topic-major-teacher-keeps-student-and-staff",
    role: "teacher",
    expectedPrefix: ["auto", "studentPathway", "studentSupport", "vocationalLearning"],
    mustInclude: ["fieldTraining", "schoolViolence", "staffLabor", "schoolAdministration"]
  }
];

const topicBridgeCases = [
  {
    id: "topic-bridge-home-field-learning",
    question: "학생 가정체험학습 신청 방법과 보고서 제출 기준은?",
    major: "studentPathway",
    middle: "fieldExperience",
    categoryCode: "fieldExperienceLearning"
  },
  {
    id: "topic-bridge-student-attendance-evidence",
    question: "학생 출석인정결석은 어떤 증빙이 필요하나요?",
    major: "studentPathway",
    middle: "attendance",
    categoryCode: "studentAttendance"
  },
  {
    id: "topic-bridge-student-admission-pathway",
    question: "특성화고 학생 재직자전형과 특성화고 특별전형은 어떤 자료를 봐야 하나요?",
    major: "studentPathway",
    middle: "admissions",
    categoryCode: "admissionsPathways"
  },
  {
    id: "topic-bridge-student-record-correction",
    question: "학생부 정정 증빙과 생활기록부 보존 기준은?",
    major: "studentPathway",
    middle: "records",
    categoryCode: "studentRecords"
  },
  {
    id: "topic-bridge-student-phone-guidance",
    question: "수업 중 휴대전화 보관 생활지도 민원이 들어오면 어떻게 처리하나요?",
    major: "studentSupport",
    middle: "guidance",
    categoryCode: "studentLifeGuidance"
  },
  {
    id: "topic-bridge-student-welfare-refund",
    question: "수익자부담 경비와 자유수강권 환불 기준은 어떻게 확인하나요?",
    major: "studentSupport",
    middle: "welfare",
    categoryCode: "studentWelfare"
  },
  {
    id: "topic-bridge-student-health-counseling",
    question: "감염병 등교중지와 위기학생 상담기록은 어떤 절차로 관리하나요?",
    major: "studentSupport",
    middle: "health",
    categoryCode: "studentHealthCounseling"
  },
  {
    id: "topic-bridge-vocational-ncs",
    question: "NCS 실무과목과 직업계고학점제 이수 기준은 어떻게 확인하나요?",
    major: "vocationalLearning",
    middle: "curriculum",
    categoryCode: "vocationalCurriculum"
  },
  {
    id: "topic-bridge-practice-room-safety",
    question: "실험실습실 기자재와 보호구, MSDS 안전점검은 어떻게 해야 하나요?",
    major: "vocationalLearning",
    middle: "practiceRoom",
    categoryCode: "studentSafety"
  },
  {
    id: "topic-bridge-practice-room-budget",
    question: "실습실 기자재 구입 예산과 검수 기준은 어떻게 확인하나요?",
    major: "vocationalLearning",
    middle: "practiceRoom",
    categoryCode: "budgetExecution"
  }
];

const taxonomyCases = [
  {
    id: "taxonomy-spouse-childbirth",
    question: "정규직 선생님의 배우자가 출산한 경우 휴가일수는?",
    intent: "spouseChildbirthLeave",
    forbidIntents: ["bereavementLeave"]
  },
  {
    id: "taxonomy-male-teacher-childbirth",
    question: "남자 교사가 출산휴가를 받을 수 있나요?",
    intent: "spouseChildbirthLeave",
    forbidIntents: ["bereavementLeave"]
  },
  {
    id: "taxonomy-generic-childbirth-special-leave",
    question: "출산 휴가 규정",
    intent: "childbirthSpecialLeave",
    forbidIntents: ["bereavementLeave"]
  },
  {
    id: "taxonomy-spouse-parent-death",
    question: "교사의 배우자의 부모가 사망한 경우 경조사휴가는 며칠인가요?",
    intent: "bereavementLeave",
    forbidIntents: ["spouseChildbirthLeave"]
  },
  {
    id: "taxonomy-travel-not-attendance",
    question: "관외출장 중 일비와 식비를 계산하려고 합니다. 외출 처리가 아니라 출장입니다.",
    intent: "domesticTravelExpense",
    forbidIntents: ["attendanceTime"]
  },
  {
    id: "taxonomy-attendance-not-travel",
    question: "교사의 무단 외출과 지각은 나이스 근무상황에서 어떻게 처리하나요?",
    intent: "attendanceTime",
    forbidIntents: ["domesticTravelExpense"]
  },
  {
    id: "taxonomy-instructor-fee-not-afterschool",
    question: "대학 전임강사의 강의비는 얼마인가요?",
    intent: "instructorHonorarium",
    forbidIntents: ["afterSchoolInstructor"]
  },
  {
    id: "taxonomy-afterschool-selection-not-fee",
    question: "방과후학교 강사 선정 공고와 제안서 평가 절차는 어떻게 하나요?",
    intent: "afterSchoolInstructor",
    forbidIntents: ["instructorHonorarium"]
  },
  {
    id: "taxonomy-meal-complaint-not-poisoning",
    question: "학부모가 급식 반찬이 마음에 들지 않는다며 민원을 냈고 식중독은 없습니다.",
    intent: "mealComplaint",
    forbidIntents: ["foodPoisoning"]
  },
  {
    id: "taxonomy-food-poisoning-not-simple-meal",
    question: "급식 후 여러 학생이 구토와 설사를 해서 식중독 의심 보고가 필요합니다.",
    intent: "foodPoisoning"
  },
  {
    id: "taxonomy-vocational-job-source",
    question: "고졸채용 정보를 잡알리오와 경남교육청 취업지원센터 공고로 교차 확인하려면?",
    intent: "vocationalJobInfo"
  },
  {
    id: "taxonomy-field-training-operation",
    question: "특성화고 현장실습 표준협약서와 선도기업 점검은 어떻게 해야 하나요?",
    intent: "fieldTrainingOperation"
  },
  {
    id: "taxonomy-apprenticeship-operation",
    question: "도제학교 일학습병행 기업훈련 시간과 훈련수당 지침은?",
    intent: "apprenticeshipOperation"
  },
  {
    id: "taxonomy-ncs-curriculum",
    question: "ncs 실무과목과 직업계고학점제 이수 기준은 어떻게 확인하나요?",
    intent: "ncsCurriculum"
  },
  {
    id: "taxonomy-lab-equipment-safety",
    question: "실험실습실 기자재와 보호구, MSDS 안전점검은 어떻게 해야 하나요?",
    intent: "labEquipmentSafety"
  },
  {
    id: "taxonomy-career-employment-guidance",
    question: "졸업생 임금체불과 고졸채용 공고를 잡알리오로 검증하려면?",
    intent: "careerEmploymentGuidance"
  },
  {
    id: "taxonomy-admissions-transfer-graduation",
    question: "특성화고 전입학과 졸업 학적 처리는 어떤 규정을 확인하나요?",
    intent: "admissionsTransferGraduation"
  },
  {
    id: "taxonomy-scholarship-welfare",
    question: "장학금과 교육급여, 수익자부담 환불 기준은 어떻게 확인하나요?",
    intent: "scholarshipWelfare"
  },
  {
    id: "taxonomy-health-counseling",
    question: "감염병 등교중지와 위기학생 상담기록은 어떤 절차로 관리하나요?",
    intent: "healthInfectionCounseling"
  },
  {
    id: "taxonomy-teacher-rights",
    question: "학부모 악성민원과 교권 침해가 있을 때 교육활동 보호 절차는?",
    intent: "teacherRightsProtection"
  },
  {
    id: "taxonomy-facility-digital",
    question: "학교 CCTV 영상정보와 개인정보, 나이스 계정 권한은 어떻게 처리하나요?",
    intent: "facilityDigitalSecurity"
  },
  {
    id: "taxonomy-governance-rule",
    question: "학교운영위원회 회의록 공개와 학칙개정 심의 절차는?",
    intent: "governanceCommitteeRule"
  }
];

const guideCases = [
  {
    id: "guide-spouse-childbirth-direct",
    question: "정규직 선생님의 배우자가 출산한 경우 휴가일수는?",
    intent: "spouseChildbirthLeave",
    domain: "staffAttendanceService",
    needsIntentConfirmation: false,
    mustInclude: ["배우자 출산휴가는 20일"],
    mustNotInclude: ["배우자의 부모 사망 경조사휴가 5일", "질문 요지 확인 필요", "파악한 질문", "일치 표현", "분류:"]
  },
  {
    id: "guide-male-teacher-childbirth-direct",
    question: "남자 교사가 출산휴가를 받을 수 있나요?",
    intent: "spouseChildbirthLeave",
    domain: "staffAttendanceService",
    needsIntentConfirmation: false,
    mustInclude: ["배우자 출산휴가는 20일"],
    mustNotInclude: ["질문 요지 확인 필요", "배우자의 부모 사망 경조사휴가 5일", "파악한 질문", "일치 표현", "분류:"]
  },
  {
    id: "guide-ambiguous-spouse-leave-confirm",
    question: "정규직 선생님의 배우자 휴가일수는?",
    needsIntentConfirmation: true,
    mustInclude: ["질문 요지 확인 필요", "배우자 출산휴가", "사망 경조사휴가", "직접 입력"],
    mustNotInclude: ["명확한 답변", "배우자 출산휴가는 20일입니다"]
  },
  {
    id: "guide-spouse-uncle-not-parent",
    question: "교사의 배우자의 삼촌상은 휴가 몇일인가요?",
    domain: "bereavementLeave",
    needsIntentConfirmation: false,
    mustInclude: ["별도 일수로 열거되어 있지 않습니다"],
    mustNotInclude: ["배우자의 부모 사망 경조사휴가 5일"]
  },
  {
    id: "guide-travel-not-attendance",
    question: "교사의 진해시 출장시 일비와 식비는?",
    domain: "domesticTravelExpense",
    needsIntentConfirmation: false,
    mustInclude: ["진해시 출장", "일비는 25,000원", "식비는 25,000원"],
    mustNotInclude: ["지각·조퇴·외출", "교원휴가 예규"]
  },
  {
    id: "guide-attendance-not-travel",
    question: "교사의 무단 외출은 어떻게 해야 처리하나요?",
    domain: "staffAttendanceService",
    needsIntentConfirmation: false,
    mustInclude: ["무단 외출", "나이스 근무상황"],
    mustNotInclude: ["출장비", "공무원 여비 규정"]
  },
  {
    id: "guide-fixed-term-six-month",
    question: "경북교육청 기간제 교사의 연가일수는? 해당 교사는 현재 6개월째 결근없이 근무중임.",
    domain: "staffAttendanceService",
    needsIntentConfirmation: false,
    mustInclude: ["6개월째", "6일", "월 개근 1일", "계약제교원 운영 지침"],
    mustNotInclude: ["공무원 연가표를 그대로 21일입니다"]
  },
  {
    id: "guide-private-school-teacher-sick-leave-limit",
    question: "사립학교 교사의 최대 병가일수는?",
    domain: "staffAttendanceService",
    needsIntentConfirmation: false,
    mustInclude: ["사립학교", "학교법인", "60일", "180일", "진단서", "한의사"],
    mustNotInclude: ["증빙자료가 없어 최종 일수", "질문 요지 확인 필요"]
  },
  {
    id: "guide-instructor-fee-not-afterschool",
    question: "대학 전임강사의 강의비는 얼마인가요?",
    domain: "schoolInstructorHonorarium",
    needsIntentConfirmation: false,
    mustInclude: ["대학 전임강사", "일반강사2", "기본 1시간 120,000원"],
    mustNotInclude: ["방과후학교·돌봄·늘봄 확인 기준", "강사 선정"]
  },
  {
    id: "guide-afterschool-not-fee",
    question: "방과후학교 강사 선정 공고와 제안서 평가 절차는 어떻게 하나요?",
    domain: "afterSchoolChildcare",
    needsIntentConfirmation: false,
    mustInclude: ["강사 선정", "제안서", "계약"],
    mustNotInclude: ["일반강사2", "기본 1시간 120,000원"]
  },
  {
    id: "guide-meal-complaint-not-poisoning",
    question: "학부모가 급식 반찬이 마음에 들지 않는다며 학교장 면담을 요구했습니다. 식중독은 없습니다.",
    domain: "schoolMealOperation",
    needsIntentConfirmation: false,
    mustInclude: ["급식 운영 기준"],
    mustNotInclude: ["안전·응급 위험", "식중독 의심"]
  },
  {
    id: "guide-food-poisoning",
    question: "급식 후 여러 학생이 복통과 구토를 호소해서 식중독 의심 보고와 보존식 확인이 필요합니다.",
    domain: "schoolMealOperation",
    needsIntentConfirmation: false,
    mustInclude: ["식중독", "안전"],
    mustNotInclude: ["출장비", "기숙사 운영"]
  },
  {
    id: "guide-mobile-phone-not-office",
    question: "수업 중 휴대전화를 보관했다가 학부모가 학생 인권 침해라고 민원을 냈습니다.",
    domain: "classManagementGuidance",
    needsIntentConfirmation: false,
    mustInclude: ["휴대전화", "학교생활규정"],
    mustNotInclude: ["대전광역시교육청", "출장비"]
  },
  {
    id: "guide-field-learning",
    question: "교외체험학습 신청서와 보고서, 출결 처리는 어떻게 해야 하나요?",
    domain: "fieldExperienceLearning",
    categoryCode: "fieldExperienceLearning",
    needsIntentConfirmation: false,
    mustInclude: ["체험학습", "신청서"],
    mustNotInclude: ["출장비", "학교폭력 사안처리"]
  },
  {
    id: "guide-student-home-field-learning-category",
    question: "학생 가정체험학습 신청 방법과 보고서 제출 기준은?",
    domain: "fieldExperienceLearning",
    categoryCode: "fieldExperienceLearning",
    options: { roleCode: "student" },
    needsIntentConfirmation: false,
    mustInclude: ["체험학습"],
    mustNotInclude: ["휴가·근태", "출장비"]
  },
  {
    id: "guide-student-attendance-recognized-absence-category",
    question: "학생 출석인정결석은 어떤 증빙이 필요하나요?",
    domain: "studentRecordsAttendance",
    categoryCode: "studentAttendance",
    options: { roleCode: "student" },
    needsIntentConfirmation: false,
    mustInclude: ["출결", "증빙"],
    mustNotInclude: ["교직원 복무", "출장비"]
  },
  {
    id: "guide-student-admissions-special-pathway-category",
    question: "특성화고 학생 재직자전형과 특성화고 특별전형은 어떤 자료를 봐야 하나요?",
    domain: "admissionsTransferGraduation",
    categoryCode: "admissionsPathways",
    options: { roleCode: "student" },
    needsIntentConfirmation: false,
    mustInclude: ["재직자전형"],
    mustNotInclude: ["출장비", "학교회계"]
  },
  {
    id: "guide-student-career-employment-category",
    question: "특성화고 학생 고졸채용 추천채용 공고는 어디서 확인하나요?",
    domain: "careerEmploymentGuidance",
    categoryCode: "careerEmployment",
    options: { roleCode: "student" },
    needsIntentConfirmation: false,
    mustInclude: ["고졸채용"],
    mustNotInclude: ["교육공무직", "출장비"]
  },
  {
    id: "guide-dormitory-not-meal",
    question: "기숙사 배정에서 특정 학과 학생이 불리하다는 민원이 들어왔습니다.",
    domain: "dormitoryOperation",
    categoryCode: "studentLifeGuidance",
    needsIntentConfirmation: false,
    mustInclude: ["기숙사 운영규정", "차별"],
    mustNotInclude: ["급식 운영 기준", "출장비"]
  },
  {
    id: "guide-student-record-correction",
    question: "생활기록부 문구 정정 요구가 들어왔는데 증빙과 절차가 궁금합니다.",
    domain: "studentRecordsAttendance",
    needsIntentConfirmation: false,
    mustInclude: ["학생부·출결·정정", "학교생활기록"],
    mustNotInclude: ["학교폭력 사안처리", "출장비"]
  },
  {
    id: "guide-school-safety-accident",
    question: "학생이 체육시간에 다쳐 보건실과 보호자 연락, 안전공제 절차가 필요합니다.",
    domain: "schoolSafetyHealth",
    needsIntentConfirmation: false,
    mustInclude: ["안전", "보건실"],
    mustNotInclude: ["급식 운영 기준", "출장비"]
  },
  {
    id: "guide-field-training-operation",
    question: "특성화고 현장실습 표준협약서와 선도기업 점검은 어떻게 해야 하나요?",
    domain: "vocationalFieldTrainingOperation",
    categoryCode: "vocationalFieldTraining",
    needsIntentConfirmation: false,
    mustInclude: ["현장실습", "실습협약", "기업 선정·점검"],
    mustNotInclude: ["출장비", "강사수당·강사료"]
  },
  {
    id: "guide-apprenticeship-operation",
    question: "도제학교 일학습병행 기업훈련 시간과 훈련수당 지침은?",
    domain: "vocationalFieldTrainingOperation",
    categoryCode: "vocationalFieldTraining",
    needsIntentConfirmation: false,
    mustInclude: ["도제학교", "일학습병행"],
    mustNotInclude: ["출장비", "학교급식·위생·민원"]
  },
  {
    id: "guide-ncs-curriculum",
    question: "ncs 실무과목과 직업계고학점제 이수 기준은 어떻게 확인하나요?",
    domain: "vocationalCurriculumNcs",
    needsIntentConfirmation: false,
    mustInclude: ["NCS", "이수"],
    mustNotInclude: ["출장비", "학교폭력 사안처리"]
  },
  {
    id: "guide-lab-equipment-safety",
    question: "실험실습실 기자재와 보호구, MSDS 안전점검은 어떻게 해야 하나요?",
    domain: "labEquipmentPracticeSafety",
    needsIntentConfirmation: false,
    mustInclude: ["기자재", "보호구", "안전"],
    mustNotInclude: ["출장비", "고졸 채용정보"]
  },
  {
    id: "guide-career-employment-source",
    question: "고졸채용 정보를 잡알리오와 경남교육청 취업지원센터 공고로 교차 확인하려면?",
    domain: "careerEmploymentGuidance",
    categoryCode: "careerEmployment",
    needsIntentConfirmation: false,
    mustInclude: ["잡알리오", "2·3차 검증"],
    mustNotInclude: ["경상남도교육청 취업지원센터 공채캘린더", "부산광역시교육청 취업지원센터 고졸 채용공고"]
  },
  {
    id: "guide-admissions-transfer-graduation",
    question: "특성화고 전입학과 졸업 학적 처리는 어떤 규정을 확인하나요?",
    domain: "admissionsTransferGraduation",
    categoryCode: "admissionsPathways",
    needsIntentConfirmation: false,
    mustInclude: ["입학", "학적"],
    mustNotInclude: ["출장비", "학교급식·위생·민원"]
  },
  {
    id: "guide-scholarship-welfare",
    question: "기숙사비와 교육급여, 수익자부담 환불 기준은 어떻게 확인하나요?",
    domain: "scholarshipWelfareSupport",
    needsIntentConfirmation: false,
    mustInclude: ["교육급여", "수익자부담"],
    mustNotInclude: ["출장비", "학교폭력 사안처리"]
  },
  {
    id: "guide-health-counseling",
    question: "감염병 등교중지와 위기학생 상담기록은 어떤 절차로 관리하나요?",
    domain: "healthInfectionCounseling",
    needsIntentConfirmation: false,
    mustInclude: ["감염병", "상담"],
    mustNotInclude: ["출장비", "강사수당·강사료"]
  },
  {
    id: "guide-teacher-rights",
    question: "학부모 악성민원과 교권 침해가 있을 때 교육활동 보호 절차는?",
    domain: "teacherRightsProtection",
    needsIntentConfirmation: false,
    mustInclude: ["교육활동", "교원 보호조치", "민원"],
    mustNotInclude: ["출장비", "급식 운영 기준"]
  },
  {
    id: "guide-facility-digital",
    question: "학교 CCTV 영상정보와 개인정보, 나이스 계정 권한은 어떻게 처리하나요?",
    domain: "facilityDigitalSecurity",
    needsIntentConfirmation: false,
    mustInclude: ["개인정보", "나이스"],
    mustNotInclude: ["출장비", "학교폭력 사안처리"]
  },
  {
    id: "guide-governance-rule",
    question: "학교운영위원회 회의록 공개와 학칙개정 심의 절차는?",
    domain: "governanceCommitteeRule",
    needsIntentConfirmation: false,
    mustInclude: ["회의록", "학칙개정"],
    mustNotInclude: ["출장비", "강사수당·강사료"]
  }
];

if (!taxonomy?.classify || taxonomy.stats.intentCount < 42 || taxonomy.stats.slotCount < 21 || taxonomy.stats.aliasCount < 180) {
  failures.push("taxonomy-load: question taxonomy database is missing or too small for broad validation");
}

for (const testCase of roleCategoryCases) checkRoleCategory(testCase);
for (const testCase of topicMajorRoleCases) checkTopicMajorRole(testCase);
for (const testCase of topicBridgeCases) checkTopicBridge(testCase);
for (const testCase of taxonomyCases) checkTaxonomy(testCase);
for (const testCase of guideCases) checkGuide(testCase);

if (failures.length) {
  console.error(`Question taxonomy deep check failed: ${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("\nDiagnostics:");
  for (const item of diagnostics) console.error(JSON.stringify(item));
  process.exit(1);
}

console.log(`Question taxonomy deep check passed: ${roleCategoryCases.length} role-category cases + ${topicMajorRoleCases.length} topic-major role cases + ${topicBridgeCases.length} topic bridge cases + ${taxonomyCases.length} taxonomy cases + ${guideCases.length} guide cases`);
