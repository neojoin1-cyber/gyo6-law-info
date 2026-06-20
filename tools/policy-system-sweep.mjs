import fs from "node:fs";
import vm from "node:vm";
import { performance } from "node:perf_hooks";

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
  URL,
  URLSearchParams,
  Intl,
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
context.window.URL = URL;
context.window.URLSearchParams = URLSearchParams;

vm.createContext(context);
for (const file of files) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

const failures = [];
const diagnostics = [];
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

const policyEngine = context.GYO6_POLICY_ENGINE;
const knowledgeBase = policyEngine?.knowledgeBase || {};
const taxonomy = context.GYO6_POLICY_QUESTION_TAXONOMY;

function compactText(value = "") {
  return String(value || "").replace(/\s+/g, "");
}

function stripHtml(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html = "") {
  const links = [];
  const pattern = /<a\s+[^>]*href="([^"]+)"/gi;
  let match;
  while ((match = pattern.exec(html))) {
    links.push(match[1].replace(/&amp;/g, "&"));
  }
  return links;
}

function getGuide(question, options = {}) {
  return context.buildPolicyGuideResponse({
    question,
    officeCode: options.officeCode || "auto",
    roleCode: options.roleCode || "auto",
    categoryCode: options.categoryCode || "auto"
  });
}

function getGuideDomain(guide = {}) {
  return guide.directRule?.domain || guide.analysis?.engineAnalysis?.semanticFrame?.domainCode || "";
}

function getRendered(question, options = {}) {
  const guide = getGuide(question, options);
  const html = context.renderPolicyGuideResponse(guide);
  return { guide, html, text: stripHtml(html), domain: getGuideDomain(guide) };
}

function addFailure(id, message, extra = null) {
  failures.push(`${id}: ${message}`);
  if (extra) diagnostics.push({ id, ...extra });
}

function assertNoPolicyGuideInternalLeaks(id, text = "") {
  for (const leak of internalPolicyGuideLeaks) {
    if (text.includes(leak)) {
      addFailure(id, `internal policy guide text leaked "${leak}"`, { text: text.slice(0, 600) });
    }
  }
}

const domainCases = [
  {
    id: "travel-daily-meal",
    domain: "domesticTravelExpense",
    question: "교사의 진해시 출장시 일비와 식비는?",
    include: ["일비", "식비", "25,000원"],
    exclude: ["나이스 근무상황", "경조사휴가"]
  },
  {
    id: "bereavement-spouse-parent",
    domain: "bereavementLeave",
    question: "교사의 배우자의 부모 사망 경조사휴가는 며칠인가요?",
    include: ["경조사휴가", "배우자의 부모"],
    exclude: ["배우자 출산휴가"]
  },
  {
    id: "bereavement-teacher-parent",
    domain: "bereavementLeave",
    question: "교원의 부모 사망시 경조사휴가는 며칠인가요?",
    include: ["본인 부모", "경조사휴가", "5일"],
    exclude: ["질문 요지 확인 필요", "가족관계를 먼저 확정", "최종 답을 낼 수 있습니다"]
  },
  {
    id: "bereavement-teacher-parent-holiday",
    domain: "bereavementLeave",
    question: "교원의 부모상 5일 중 중간에 공휴일이 있으면 어떻게 계산하나요?",
    include: ["토요일", "공휴일", "산입하지"],
    exclude: ["질문 요지 확인 필요", "기간을 먼저 확인", "가족관계를 먼저 확정"]
  },
  {
    id: "student-parent-death-attendance",
    domain: "studentRecordsAttendance",
    question: "학생의 부모 사망시 휴가는?",
    include: ["출석인정결석", "학교생활기록부 기재요령", "5일"],
    exclude: ["공립 교원", "국가공무원", "교원휴가", "나이스 근무상황", "경조사휴가"]
  },
  {
    id: "student-parent-death-attendance-holiday",
    domain: "studentRecordsAttendance",
    question: "학생 부모상 출석인정결석 중 중간에 공휴일이 있으면 어떻게 계산하나요?",
    include: ["출석인정결석", "수업일", "공휴일", "결석일수"],
    exclude: ["공립 교원", "국가공무원", "교원휴가", "나이스 근무상황", "경조사휴가"]
  },
  {
    id: "staff-sick-leave",
    domain: "staffAttendanceService",
    question: "정규교사의 병가는 며칠 가능하며 진단서는 언제 필요한가요?",
    include: ["병가", "진단서"],
    exclude: ["출장비"]
  },
  {
    id: "staff-male-teacher-childbirth-leave",
    domain: "staffAttendanceService",
    question: "남자 교사가 출산휴가를 받을 수 있나요?",
    include: ["배우자 출산휴가", "20일"],
    exclude: ["질문 요지 확인 필요", "배우자의 부모 사망 경조사휴가 5일"]
  },
  {
    id: "staff-abbreviated-male-teacher-childbirth-leave",
    domain: "staffAttendanceService",
    question: "남 교사의 출산 휴가는 몇일 사용 가능한가요?",
    include: ["배우자 출산휴가", "20일"],
    exclude: ["질문 요지 확인 필요", "사유별 일수표", "배우자의 부모 사망 경조사휴가 5일"]
  },
  {
    id: "staff-generic-childbirth-leave",
    domain: "staffAttendanceService",
    question: "출산 휴가 규정",
    include: ["특별휴가", "출산"],
    exclude: ["가까운 분야", "출장비"]
  },
  {
    id: "budget-contract",
    domain: "schoolBudgetExecution",
    question: "경북교육청 학교회계 물품 구입 검수와 지출 증빙은 어떻게 확인하나요?",
    include: ["학교회계", "검수", "증빙"],
    exclude: ["경조사휴가"]
  },
  {
    id: "honorarium-university-lecturer",
    domain: "schoolInstructorHonorarium",
    question: "대학 전임강사의 1시간 강의비는 얼마인가요?",
    include: ["대학 전임강사", "120,000원"],
    exclude: ["방과후학교·돌봄·늘봄"]
  },
  {
    id: "school-violence",
    domain: "schoolViolenceProcedure",
    question: "학교폭력 신고 후 전담기구 심의 요청 절차는?",
    include: ["학교폭력", "전담기구"],
    exclude: ["출장비"]
  },
  {
    id: "class-management-phone",
    domain: "classManagementGuidance",
    question: "수업 중 휴대전화 보관 생활지도 민원이 들어오면 어떻게 처리하나요?",
    include: ["교원의 학생생활지도", "학교생활규정", "휴대전화"],
    exclude: ["출장비"]
  },
  {
    id: "class-management-repeated-instruction-refusal",
    domain: "classManagementGuidance",
    question: "교사의 수업시간 중 반복적인 지시를 따르지 않는 학생에게 내릴 수 있는 조치는?",
    include: ["교원의 학생생활지도", "초·중등교육법", "시행령 제31조"],
    exclude: ["근로기준법", "연가", "16일"]
  },
  {
    id: "field-experience",
    domain: "fieldExperienceLearning",
    question: "교외체험학습 신청서 보고서 출결 처리 기준은?",
    include: ["체험학습", "신청서", "출결"],
    exclude: ["학교폭력 사안처리"]
  },
  {
    id: "dormitory",
    domain: "dormitoryOperation",
    question: "기숙사 입사 배정 기준과 벌점 퇴사 절차는?",
    include: ["기숙사", "배정"],
    exclude: ["급식 운영"]
  },
  {
    id: "meal-poisoning",
    domain: "schoolMealOperation",
    question: "급식 식중독 의심 보존식과 보고 절차는?",
    include: ["학교급식", "식중독", "보존식"],
    exclude: ["출장비"]
  },
  {
    id: "student-record-correction",
    domain: "studentRecordsAttendance",
    question: "학생부 정정 증빙과 결재 절차는?",
    include: ["학생부", "정정", "증빙"],
    exclude: ["학교폭력 사안처리"]
  },
  {
    id: "school-safety-accident",
    domain: "schoolSafetyHealth",
    question: "체육시간 안전사고 보호자 연락과 안전공제 절차는?",
    include: ["학교안전", "안전공제"],
    exclude: ["급식 운영"]
  },
  {
    id: "parent-complaint",
    domain: "parentComplaintResponse",
    question: "학부모 민원 답변서와 개인정보 공개 범위는 어떻게 나누나요?",
    include: ["학부모", "민원", "개인정보"],
    exclude: ["출장비"]
  },
  {
    id: "special-education",
    domain: "specialEducationSupport",
    question: "특수교육대상자 개별화교육계획 IEP와 보호자 동의 절차는?",
    include: ["특수교육", "개별화교육"],
    exclude: ["출장비"]
  },
  {
    id: "assessment",
    domain: "assessmentAcademicManagement",
    question: "수행평가 이의신청과 학업성적관리위원회 절차는?",
    include: ["평가", "학업성적관리"],
    exclude: ["출장비"]
  },
  {
    id: "after-school",
    domain: "afterSchoolChildcare",
    question: "방과후학교 강사 선정 공고와 수강료 환불 기준은?",
    include: ["방과후학교", "수강료"],
    exclude: ["대학 전임강사", "120,000원"]
  },
  {
    id: "field-training",
    domain: "vocationalFieldTrainingOperation",
    question: "특성화고 현장실습 표준협약서와 선도기업 점검은 어떻게 해야 하나요?",
    include: ["현장실습", "표준협약", "선도기업"],
    exclude: ["출장비"]
  },
  {
    id: "ncs-curriculum",
    domain: "vocationalCurriculumNcs",
    question: "ncs 실무과목과 직업계고학점제 이수 기준은 어떻게 확인하나요?",
    include: ["NCS", "학점제"],
    exclude: ["출장비"]
  },
  {
    id: "lab-safety",
    domain: "labEquipmentPracticeSafety",
    question: "실험실습실 기자재와 보호구, MSDS 안전점검은 어떻게 해야 하나요?",
    include: ["실험실습실", "보호구", "MSDS"],
    exclude: ["고졸 채용정보"]
  },
  {
    id: "career-employment",
    domain: "careerEmploymentGuidance",
    question: "고졸채용 정보를 잡알리오와 경남교육청 취업지원센터 공고로 교차 확인하려면?",
    include: ["취업지도", "잡알리오", "2·3차 검증"],
    exclude: ["경상남도교육청 취업지원센터 공채캘린더", "부산광역시교육청 취업지원센터 고졸 채용공고", "현장실습 운영 매뉴얼"]
  },
  {
    id: "academic-transfer",
    domain: "admissionsTransferGraduation",
    question: "특성화고 전입학과 졸업 학적 처리는 어떤 규정을 확인하나요?",
    include: ["전입학", "졸업", "학적"],
    exclude: ["출장비"]
  },
  {
    id: "scholarship-welfare",
    domain: "scholarshipWelfareSupport",
    question: "기숙사비와 교육급여, 수익자부담 환불 기준은 어떻게 확인하나요?",
    include: ["교육급여", "수익자부담"],
    exclude: ["기숙사 운영규정과 선발"]
  },
  {
    id: "health-counseling",
    domain: "healthInfectionCounseling",
    question: "감염병 등교중지와 위기학생 상담기록은 어떤 절차로 관리하나요?",
    include: ["감염병", "상담"],
    exclude: ["출장비"]
  },
  {
    id: "teacher-rights",
    domain: "teacherRightsProtection",
    question: "학부모 악성민원과 교권 침해가 있을 때 교육활동 보호 절차는?",
    include: ["교권", "교육활동 보호"],
    exclude: ["출장비"]
  },
  {
    id: "facility-digital",
    domain: "facilityDigitalSecurity",
    question: "학교 CCTV 영상정보와 개인정보, 나이스 계정 권한은 어떻게 처리하나요?",
    include: ["CCTV", "개인정보", "나이스"],
    exclude: ["출장비"]
  },
  {
    id: "governance",
    domain: "governanceCommitteeRule",
    question: "학교운영위원회 회의록 공개와 학칙개정 심의 절차는?",
    include: ["학교운영위원회", "회의록", "학칙개정"],
    exclude: ["출장비"]
  }
];

const adversarialCases = [
  {
    id: "adversarial-neis-attendance-not-security",
    domain: "staffAttendanceService",
    question: "나이스 근무상황에서 정규교사의 조퇴와 병가를 어떻게 신청하나요?",
    excludeDomain: "facilityDigitalSecurity"
  },
  {
    id: "adversarial-neis-account-security",
    domain: "facilityDigitalSecurity",
    question: "나이스 계정 권한을 퇴직 교직원에게 계속 부여해도 되나요?",
    excludeDomain: "staffAttendanceService"
  },
  {
    id: "adversarial-vocational-dormitory-fee",
    domain: "scholarshipWelfareSupport",
    question: "특성화고 기숙사비 수익자부담 환불 기준은?",
    excludeDomain: "dormitoryOperation"
  },
  {
    id: "adversarial-vocational-dormitory-assignment",
    domain: "dormitoryOperation",
    question: "특성화고 기숙사 입사 배정에서 특정 학과가 불리하다는 민원은?",
    excludeDomain: "vocationalCurriculumNcs"
  },
  {
    id: "adversarial-field-training-employment",
    domain: "careerEmploymentGuidance",
    question: "현장실습생 채용 공고와 추천채용 조건을 잡알리오로 검증하려면?",
    excludeDomain: "vocationalFieldTrainingOperation"
  },
  {
    id: "adversarial-field-training-accident",
    domain: "vocationalFieldTrainingOperation",
    question: "현장실습 중 위험기계 사고가 났을 때 학교와 기업의 보고 절차는?",
    excludeDomain: "labEquipmentPracticeSafety"
  },
  {
    id: "adversarial-committee-violence",
    domain: "schoolViolenceProcedure",
    question: "학교폭력 전담기구 회의록 공개 여부와 심의 요청 절차는?",
    excludeDomain: "governanceCommitteeRule"
  },
  {
    id: "adversarial-committee-governance",
    domain: "governanceCommitteeRule",
    question: "학교운영위원회 급식소위원회 회의록 공개와 비공개 기준은?",
    excludeDomain: "schoolMealOperation"
  }
];

const semanticBridgeCases = [
  {
    id: "bridge-staff-vague-leave",
    domain: "staffAttendanceService",
    question: "교사 휴가 규정",
    include: ["휴가", "질문 요지 확인 필요"],
    requireClarification: true
  },
  {
    id: "bridge-school-violence-money-without-label",
    domain: "schoolViolenceProcedure",
    question: "학생이 친구에게 돈을 여러 번 요구해서 받아갔는데 어떻게 처리해야 하나요?",
    include: ["학교폭력", "사안"]
  },
  {
    id: "bridge-budget-vague-documents",
    domain: "schoolBudgetExecution",
    question: "행정실에서 물품을 샀는데 어떤 서류가 필요해?",
    include: ["학교회계", "증빙"]
  },
  {
    id: "bridge-afterschool-consignment-safety",
    domain: "afterSchoolChildcare",
    question: "늘봄 프로그램 위탁 계약과 학생 안전관리 자료는 무엇을 봐야 하나요?",
    include: ["방과후학교", "늘봄", "교육청"]
  },
  {
    id: "bridge-field-training-injury",
    domain: "vocationalFieldTrainingOperation",
    question: "실습생이 회사에서 다쳤는데 학교가 뭘 해야 해?",
    include: ["현장실습", "보호"]
  },
  {
    id: "bridge-digital-permission",
    domain: "facilityDigitalSecurity",
    question: "퇴직한 직원 나이스 권한 계속 둬도 돼?",
    include: ["나이스", "권한"]
  },
  {
    id: "bridge-student-photo-homepage",
    domain: "facilityDigitalSecurity",
    question: "학교 행사 사진을 홈페이지에 올려도 되나요?",
    include: ["개인정보", "사진"]
  },
  {
    id: "bridge-graduation-album-photo-consent",
    domain: "facilityDigitalSecurity",
    question: "졸업앨범 사진 동의서는 꼭 받아야 하나요?",
    include: ["사진", "동의"]
  },
  {
    id: "bridge-teacher-rights-parent-abuse",
    domain: "teacherRightsProtection",
    question: "학부모가 교사에게 계속 욕설하고 민원을 넣으면 어떻게 보호해?",
    include: ["교육활동 보호", "교권"]
  },
  {
    id: "bridge-teacher-rights-student-sns-photo",
    domain: "teacherRightsProtection",
    question: "학생이 교사 얼굴을 몰래 찍어 SNS에 올렸어요. 어떻게 처리해야 하나요?",
    include: ["교육활동 보호", "사진"]
  },
  {
    id: "bridge-teacher-rights-parent-legal-risk",
    domain: "teacherRightsProtection",
    question: "공립고 교사가 보호자에게 고소를 고민 중이고 문자 캡처가 있습니다. 어떻게 정리해야 하나요?",
    include: ["교육활동", "교권", "증빙"],
    exclude: ["사진·CCTV·녹음"]
  },
  {
    id: "bridge-counseling-record-parent-request",
    domain: "healthInfectionCounseling",
    question: "학부모가 상담기록을 달라고 민원 넣었는데 어디까지 줘야 해?",
    include: ["상담기록", "비밀보호"]
  },
  {
    id: "bridge-meal-complaint-negated-food-poisoning",
    domain: "schoolMealOperation",
    question: "학부모가 급식 반찬이 마음에 들지 않는다며 학교장 면담을 요구했습니다. 식중독은 없습니다.",
    include: ["학교급식", "민원"],
    excludedRiskCodes: ["safety"]
  },
  {
    id: "bridge-field-experience-report",
    domain: "fieldExperienceLearning",
    question: "체험학습 보고서 안 냈으면 출결은 어떻게 처리해?",
    include: ["체험학습", "출결"]
  }
];

const subjectEventCases = [
  {
    id: "subject-event-male-teacher-childbirth",
    domain: "staffAttendanceService",
    question: "남 교사의 출산 휴가는 몇일 사용 가능한가요?",
    include: ["배우자 출산휴가", "20일"],
    exclude: ["사유별 일수표"]
  },
  {
    id: "subject-event-male-staff-childbirth",
    domain: "staffAttendanceService",
    question: "남성 교직원이 출산휴가를 신청하려면 며칠인지 알려줘",
    include: ["배우자 출산휴가", "20일"],
    exclude: ["사유별 일수표"]
  },
  {
    id: "subject-event-spouse-birth-teacher",
    domain: "staffAttendanceService",
    question: "아내가 출산한 공립 교원은 특별휴가를 며칠 받을 수 있나요?",
    include: ["배우자 출산휴가", "20일"],
    exclude: ["사유별 일수표"]
  },
  {
    id: "subject-event-father-teacher-childbirth",
    domain: "staffAttendanceService",
    question: "아빠 교사가 출산 관련 휴가를 쓰려면 며칠 가능한가요?",
    include: ["배우자 출산휴가", "20일"],
    exclude: ["사유별 일수표"]
  },
  {
    id: "subject-event-female-teacher-childbirth-not-spouse",
    domain: "staffAttendanceService",
    question: "여 교사의 출산 휴가는 어떻게 신청하나요?",
    include: ["특별휴가", "출산"],
    exclude: ["교원의 배우자 출산휴가는 공립 교원·국가공무원 기준으로 20일입니다", "20일입니다"],
    excludedServiceIssueCodes: ["spouseChildbirthLeave"]
  },
  {
    id: "subject-event-private-school-teacher-sick-leave-limit",
    domain: "staffAttendanceService",
    question: "사립학교 교사의 최대 병가일수는?",
    include: ["사립학교", "학교법인", "60일", "180일"],
    exclude: ["증빙자료가 없어 최종 일수", "질문만으로는 적용 규정을 특정하기 어렵습니다"]
  },
  {
    id: "subject-event-school-corporation-teacher-sick-leave-limit",
    domain: "staffAttendanceService",
    question: "학교법인 교원 질병휴가 한도는?",
    include: ["학교법인", "60일", "180일"],
    exclude: ["최종 일수나 유급 여부는 해당 기관 규정 확인 항목", "가까운 분야"]
  }
];

const caseFrameCases = [
  {
    id: "case-frame-student-bereavement-attendance",
    question: "학생의 부모 사망시 휴가는?",
    domain: "studentRecordsAttendance",
    subjectGroup: "student",
    eventCode: "bereavement",
    authorityTiers: ["ministryGuideline", "educationOfficeGuideline", "schoolRule"],
    schoolRulePosition: "finalExecutionCheck",
    qualityStatus: "pass",
    forbiddenPatterns: ["공립 교원", "국가공무원 복무규정", "교원휴가"]
  },
  {
    id: "case-frame-class-management-guidance",
    question: "수업 중 선생님 지시를 계속 따르지 않는 학생에게 할 수 있는 조치는?",
    domain: "classManagementGuidance",
    subjectGroup: "student",
    eventCode: "studentGuidance",
    authorityTiers: ["ministryGuideline", "educationOfficeGuideline", "schoolRule"],
    schoolRulePosition: "finalExecutionCheck",
    qualityStatus: "pass"
  },
  {
    id: "case-frame-staff-bereavement-leave",
    question: "교원의 부모상 5일 중 중간에 공휴일이 있으면 어떻게 계산하나요?",
    domain: "bereavementLeave",
    subjectGroup: "staff",
    eventCode: "bereavement",
    authorityTiers: ["officialRule", "educationOfficeGuideline", "employmentExecutionRule"],
    schoolRulePosition: "finalExecutionCheck",
    qualityStatus: "pass"
  },
  {
    id: "case-frame-budget-evidence",
    question: "행정실에서 물품을 샀는데 어떤 서류가 필요해?",
    domain: "schoolBudgetExecution",
    subjectGroup: "unknown",
    eventCode: "budgetContract",
    authorityTiers: ["educationOfficeGuideline", "nationalLaw", "schoolExecutionRule"],
    schoolRulePosition: "finalExecutionCheck"
  },
  {
    id: "case-frame-field-training-safety",
    question: "실습생이 회사에서 다쳤는데 학교가 뭘 해야 해?",
    domain: "vocationalFieldTrainingOperation",
    subjectGroup: "student",
    eventCode: "safety",
    authorityTiers: ["ministryGuideline", "educationOfficeGuideline", "schoolRule"],
    schoolRulePosition: "finalExecutionCheck"
  }
];

function makeVariants(question = "") {
  return [
    question,
    question.replace(/\s+/g, ""),
    `대충 질문드립니다. ${question} 알려주세요.`,
    question.replace(/\?/g, "요?"),
    question.replace(/와/g, " 및 ").replace(/은/g, "은요 ")
  ];
}

function checkSemanticBridgeCase(testCase) {
  const rendered = getRendered(testCase.question, testCase.options || {});
  const { guide, text, domain } = rendered;
  assertNoPolicyGuideInternalLeaks(testCase.id, text);
  const semanticFrame = guide.analysis?.engineAnalysis?.semanticFrame || {};
  if (domain !== testCase.domain) {
    addFailure(testCase.id, `semantic bridge expected domain ${testCase.domain}, got ${domain || "none"}`, {
      question: testCase.question,
      candidates: guide.analysis?.engineAnalysis?.semanticFrame?.domainCandidates?.slice(0, 5)
    });
  }
  if (testCase.requireClarification && !guide.needsIntentConfirmation && !/추가 확인|확인되지 않은 항목|확인 필요|필요 정보/.test(text)) {
    addFailure(testCase.id, "semantic bridge should keep a missing-slot/clarification guard for vague questions", { text: text.slice(0, 600) });
  }
  for (const token of testCase.include || []) {
    if (!text.includes(token)) {
      addFailure(testCase.id, `expected semantic bridge text to include "${token}"`, { text: text.slice(0, 600) });
    }
  }
  for (const token of testCase.exclude || []) {
    const index = text.indexOf(token);
    if (index >= 0) {
      addFailure(testCase.id, `semantic bridge text leaked forbidden token "${token}"`, {
        snippet: text.slice(Math.max(0, index - 180), Math.min(text.length, index + token.length + 180))
      });
    }
  }
  const riskCodes = semanticFrame.slots?.riskSignal?.items?.map((item) => item.code) || [];
  for (const riskCode of testCase.excludedRiskCodes || []) {
    if (riskCodes.includes(riskCode)) {
      addFailure(testCase.id, `semantic bridge leaked excluded risk code "${riskCode}"`, {
        riskSignal: semanticFrame.slots?.riskSignal
      });
    }
  }
  if (/질문만으로는 적용 규정을 특정하기 어렵습니다|가까운 분야/.test(text)) {
    addFailure(testCase.id, "semantic bridge fell back to unclassified question-builder text", { text: text.slice(0, 600) });
  }
}

function checkSubjectEventCase(testCase) {
  const rendered = getRendered(testCase.question, testCase.options || {});
  const { guide, text, domain } = rendered;
  assertNoPolicyGuideInternalLeaks(testCase.id, text);
  const semanticFrame = guide.analysis?.engineAnalysis?.semanticFrame || {};
  if (domain !== testCase.domain) {
    addFailure(testCase.id, `subject-event inference expected domain ${testCase.domain}, got ${domain || "none"}`, {
      question: testCase.question,
      frame: semanticFrame
    });
  }
  for (const token of testCase.include || []) {
    if (!text.includes(token)) {
      addFailure(testCase.id, `expected subject-event text to include "${token}"`, { text: text.slice(0, 600) });
    }
  }
  for (const token of testCase.exclude || []) {
    const index = text.indexOf(token);
    if (index >= 0) {
      addFailure(testCase.id, `subject-event text leaked forbidden token "${token}"`, {
        snippet: text.slice(Math.max(0, index - 180), Math.min(text.length, index + token.length + 180))
      });
    }
  }
  const serviceIssueCode = semanticFrame.slots?.serviceIssue?.code || "";
  for (const code of testCase.excludedServiceIssueCodes || []) {
    if (serviceIssueCode === code) {
      addFailure(testCase.id, `subject-event inference leaked excluded service issue "${code}"`, {
        serviceIssue: semanticFrame.slots?.serviceIssue
      });
    }
  }
}

function checkCaseFrameCase(testCase) {
  const frame = policyEngine.buildPolicySemanticFrame(testCase.question);
  const response = policyEngine.buildPolicyResponse({
    question: testCase.question,
    officeLabel: testCase.options?.officeLabel || "경상북도교육청"
  }) || {};
  const caseFrame = response.caseFrame || frame.caseFrame || frame.lookupPlan?.caseFrame || null;
  const qualityGate = response.qualityGate || {};
  const domain = response.domain || frame.domainCode || "";

  if (domain !== testCase.domain) {
    addFailure(testCase.id, `case frame expected domain ${testCase.domain}, got ${domain || "none"}`, {
      question: testCase.question,
      frame
    });
  }
  if (!caseFrame) {
    addFailure(testCase.id, "missing policy caseFrame", { question: testCase.question, frame });
    return;
  }
  if (caseFrame.subject?.group !== testCase.subjectGroup) {
    addFailure(testCase.id, `expected subject group ${testCase.subjectGroup}, got ${caseFrame.subject?.group || "none"}`, { caseFrame });
  }
  if (caseFrame.event?.code !== testCase.eventCode) {
    addFailure(testCase.id, `expected event code ${testCase.eventCode}, got ${caseFrame.event?.code || "none"}`, { caseFrame });
  }
  const tiers = (caseFrame.authorityPath || []).map((item) => item.tier);
  for (const tier of testCase.authorityTiers || []) {
    if (!tiers.includes(tier)) {
      addFailure(testCase.id, `missing authority tier ${tier}`, { tiers, caseFrame });
    }
  }
  if (testCase.schoolRulePosition && caseFrame.schoolRulePolicy?.position !== testCase.schoolRulePosition) {
    addFailure(testCase.id, `expected schoolRulePosition ${testCase.schoolRulePosition}, got ${caseFrame.schoolRulePolicy?.position || "none"}`, { caseFrame });
  }
  if (testCase.qualityStatus && qualityGate.status !== testCase.qualityStatus) {
    addFailure(testCase.id, `expected qualityGate ${testCase.qualityStatus}, got ${qualityGate.status || "none"}`, { qualityGate, response });
  }
  for (const pattern of testCase.forbiddenPatterns || []) {
    if (!(caseFrame.expectations?.forbiddenPatterns || []).includes(pattern)) {
      addFailure(testCase.id, `case frame missing forbidden pattern "${pattern}"`, { caseFrame });
    }
  }
}

function checkGuideCase(testCase) {
  const rendered = getRendered(testCase.question, testCase.options || {});
  const { guide, html, text, domain } = rendered;
  assertNoPolicyGuideInternalLeaks(testCase.id, text);

  if (domain !== testCase.domain) {
    addFailure(testCase.id, `expected domain ${testCase.domain}, got ${domain || "none"}`, {
      question: testCase.question,
      candidates: guide.analysis?.engineAnalysis?.semanticFrame?.domainCandidates?.slice(0, 5)
    });
  }

  if (guide.needsIntentConfirmation) {
    addFailure(testCase.id, "unexpected intent confirmation for a high-confidence domain case", {
      question: testCase.question
    });
  }

  for (const token of testCase.include || []) {
    if (!text.includes(token)) {
      addFailure(testCase.id, `expected rendered text to include "${token}"`, { text: text.slice(0, 400) });
    }
  }

  for (const token of testCase.exclude || []) {
    const index = text.indexOf(token);
    if (index >= 0) {
      addFailure(testCase.id, `rendered text leaked forbidden token "${token}"`, {
        snippet: text.slice(Math.max(0, index - 180), Math.min(text.length, index + token.length + 180))
      });
    }
  }

  const links = extractLinks(html);
  const genericHomepageLinks = links.filter((href) => {
    try {
      const url = new URL(href);
      const host = url.hostname.replace(/^www\./, "");
      const path = url.pathname.replace(/\/+$/, "") || "/";
      return (host === "moe.go.kr" && ["/", "/main.do", "/main"].includes(path))
        || (host === "moel.go.kr" && ["/", "/index.do", "/index"].includes(path))
        || (host === "kosha.or.kr" && ["/", "/kosha", "/kosha/index.do", "/main"].includes(path));
    } catch {
      return false;
    }
  });
  if (genericHomepageLinks.length) {
    addFailure(testCase.id, `generic homepage link leaked: ${genericHomepageLinks.join(", ")}`);
  }
}

function checkVariantStability(testCase) {
  for (const [index, question] of makeVariants(testCase.question).entries()) {
    const guide = getGuide(question, testCase.options || {});
    const domain = getGuideDomain(guide);
    if (domain !== testCase.domain) {
      addFailure(`${testCase.id}-variant-${index}`, `expected domain ${testCase.domain}, got ${domain || "none"}`, {
        question,
        candidates: guide.analysis?.engineAnalysis?.semanticFrame?.domainCandidates?.slice(0, 5)
      });
    }
  }
}

function checkAdversarialCase(testCase) {
  const guide = getGuide(testCase.question, testCase.options || {});
  const domain = getGuideDomain(guide);
  if (domain !== testCase.domain) {
    addFailure(testCase.id, `expected adversarial domain ${testCase.domain}, got ${domain || "none"}`, {
      question: testCase.question,
      candidates: guide.analysis?.engineAnalysis?.semanticFrame?.domainCandidates?.slice(0, 5)
    });
  }
  if (domain === testCase.excludeDomain) {
    addFailure(testCase.id, `misrouted into explicitly excluded domain ${testCase.excludeDomain}`);
  }
}

function checkCoverage() {
  const kbDomains = Object.keys(knowledgeBase.domains || {});
  const coveredDomains = new Set(domainCases.map((item) => item.domain));
  for (const domainCode of kbDomains) {
    if (!coveredDomains.has(domainCode)) {
      addFailure("coverage", `domain ${domainCode} has no sweep case`);
    }
  }

  for (const testCase of domainCases) {
    const domain = knowledgeBase.domains?.[testCase.domain];
    if (!domain) {
      addFailure(testCase.id, `sweep case points to unknown KB domain ${testCase.domain}`);
      continue;
    }
    if (!domain.categoryCode || !domain.label || !Array.isArray(domain.intentKeywords) || !domain.intentKeywords.length) {
      addFailure(testCase.id, "domain is missing categoryCode, label, or intentKeywords");
    }
  }
}

function checkAmbiguityGuards() {
  const ambiguousCases = [
    {
      id: "ambiguous-spouse-leave",
      question: "정규직 선생님의 배우자 휴가일수는?",
      include: ["질문 요지 확인 필요", "배우자 출산휴가", "사망 경조사휴가"]
    },
    {
      id: "ambiguous-plain-leave",
      question: "기간제교사의 휴가는 며칠인가요?",
      include: ["질문 요지 확인 필요", "기간제"]
    },
    {
      id: "ambiguous-committee-minutes",
      question: "위원회 회의록 공개 기준은?",
      include: ["질문 요지 확인 필요", "학교운영위원회", "학교폭력"]
    },
    {
      id: "ambiguous-record-disclosure",
      question: "학생 기록을 학부모에게 공개해도 되나요?",
      include: ["질문 요지 확인 필요", "학생부", "CCTV"]
    },
    {
      id: "ambiguous-civil-lawsuit-risk",
      question: "민사소송을 해야 하나요?",
      include: ["질문 완성 필요", "누가 관련", "증빙자료"]
    },
    {
      id: "ambiguous-criminal-complaint-risk",
      question: "이 사안은 고소해야 하나요?",
      include: ["질문 완성 필요", "사건", "증빙자료"]
    }
  ];

  for (const testCase of ambiguousCases) {
    const { guide, text } = getRendered(testCase.question);
    if (!guide.needsIntentConfirmation && !guide.needsQuestionCompletion && !/추가 확인|확인되지 않은 항목|질문 완성 필요/.test(text)) {
      addFailure(testCase.id, "ambiguous question produced a plain answer without confirmation or missing-slot guard", { text: text.slice(0, 600) });
    }
    for (const token of testCase.include) {
      if (!text.includes(token)) {
        addFailure(testCase.id, `expected ambiguity guard text to include "${token}"`, { text: text.slice(0, 600) });
      }
    }
  }
}

function checkTaxonomyBackstop() {
  if (!taxonomy?.classify || !taxonomy?.buildSlotQuestions) {
    addFailure("taxonomy", "question taxonomy is not loaded");
    return;
  }
  const stats = taxonomy.stats || {};
  if (stats.intentCount < 42 || stats.slotCount < 21 || stats.aliasCount < 180) {
    addFailure("taxonomy", `taxonomy stats too small: ${JSON.stringify(stats)}`);
  }
}

function checkPerformance() {
  const performanceFailBudgetMs = 12;
  const questions = [...domainCases, ...adversarialCases, ...semanticBridgeCases]
    .concat(subjectEventCases)
    .flatMap((item) => makeVariants(item.question))
    .slice(0, 170);
  const start = performance.now();
  for (let round = 0; round < 20; round += 1) {
    for (const question of questions) {
      const guide = getGuide(question);
      context.renderPolicyGuideResponse(guide);
    }
  }
  const elapsed = performance.now() - start;
  const operations = questions.length * 20;
  const perOperation = elapsed / operations;
  diagnostics.push({
    id: "performance",
    operations,
    elapsedMs: Math.round(elapsed),
    perOperationMs: Number(perOperation.toFixed(3)),
    failBudgetMs: performanceFailBudgetMs
  });
  if (perOperation > performanceFailBudgetMs) {
    addFailure("performance", `guide generation is too slow: ${perOperation.toFixed(2)}ms per operation`);
  }
}

checkCoverage();
checkTaxonomyBackstop();
for (const testCase of domainCases) {
  checkGuideCase(testCase);
  checkVariantStability(testCase);
}
for (const testCase of adversarialCases) {
  checkAdversarialCase(testCase);
}
for (const testCase of semanticBridgeCases) {
  checkSemanticBridgeCase(testCase);
}
for (const testCase of subjectEventCases) {
  checkSubjectEventCase(testCase);
}
for (const testCase of caseFrameCases) {
  checkCaseFrameCase(testCase);
}
checkAmbiguityGuards();
checkPerformance();

if (failures.length) {
  console.error(`Policy system sweep failed: ${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("\nDiagnostics:");
  for (const item of diagnostics) console.error(JSON.stringify(item));
  process.exit(1);
}

const performanceInfo = diagnostics.find((item) => item.id === "performance");
console.log(
  `Policy system sweep passed: ${domainCases.length} domains + ${adversarialCases.length} adversarial cases + ${semanticBridgeCases.length} semantic bridges + ${subjectEventCases.length} subject-event cases + ${caseFrameCases.length} case-frame cases + ${domainCases.length * 5} variants; ${performanceInfo.operations} render ops at ${performanceInfo.perOperationMs}ms/op`
);
