import assert from "node:assert/strict";
import { handlePolicyChatRequest } from "../functions/shared/policy-chat.mjs";

const SMART_INPUT_CASES = [
  {
    id: "travel-expense",
    domain: "domesticTravelExpense",
    variants: [
      "교장쌤 경주->안동 1박2일 출장비 얼마?",
      "관외츌장 일비 식비 숙박비 증빙 뭐 필요",
      "포항 학교 교사가 안동으로 당일 출장가면 여비 계산 기준 알려줘"
    ],
    includes: ["출장"]
  },
  {
    id: "staff-sick-leave",
    domain: "staffAttendanceService",
    variants: [
      "쌤 병가 서류 뭐 필요?",
      "기간제쌤 병까 진단서 몇일 기준?",
      "나이스 근무상황 병가 상신할 때 증빙자료 뭐 봐야 함"
    ],
    includes: ["병가"]
  },
  {
    id: "spouse-childbirth",
    domain: "staffAttendanceService",
    variants: [
      "남교사 출산휴가 몇일?",
      "남자 선생님 배우자 출산 휴가 일수랑 나이스 신청",
      "부성보호휴가라고 하던데 교직원 배우자 출산휴가 기준"
    ],
    includes: ["출산"]
  },
  {
    id: "bereavement",
    domain: "bereavementLeave",
    variants: [
      "장인상 경조사 몇일",
      "배우자 부모상 특별휴가 일수와 증빙",
      "기간제 교사 조부모상 경조휴가 가능한지"
    ],
    includes: ["경조사"]
  },
  {
    id: "budget-execution",
    domain: "schoolBudgetExecution",
    variants: [
      "품의 검수 지출결의 영수증 순서 헷갈림",
      "수익자부담 환불 정산 증빙 뭐 챙김?",
      "학교회계 물품구입 카드전표 세금계산서 보존 기준"
    ],
    includes: ["학교회계", "증빙"]
  },
  {
    id: "instructor-honorarium",
    domain: "schoolInstructorHonorarium",
    variants: [
      "외부강사 강사비 단가 얼마",
      "전직 교장 특강비 1시간 강사료",
      "대학 전임강사 강의료 초과시간 수당 기준"
    ],
    includes: ["강사"]
  },
  {
    id: "school-violence",
    domain: "schoolViolenceProcedure",
    variants: [
      "학폭 전담기구 사안조사 절차",
      "애가 친구 돈을 계속 달라고 했대요 학교폭력인가요",
      "카톡 단톡방 사이버괴롭힘 신고 들어왔을 때 보호자 통지"
    ],
    includes: ["학교폭력"]
  },
  {
    id: "digital-security",
    domain: "facilityDigitalSecurity",
    variants: [
      "학생사진 sns 올려도 됨?",
      "cctv 열람 요청 보호자한테 보여줘도 되나요",
      "나이스 계정 권한 행정실 직원 이동할 때 회수 기준"
    ],
    includes: ["개인정보", "CCTV", "정보보안"]
  },
  {
    id: "career-employment",
    domain: "careerEmploymentGuidance",
    variants: [
      "졸업생 임금체불 학교가 어디까지 도와줘야 함",
      "고졸채용 잡알리오 공고 추천채용 확인",
      "현장실습 끝난 학생 근로계약서 수습 해고 상담"
    ],
    includes: ["취업", "근로", "임금"]
  },
  {
    id: "field-training",
    domain: "vocationalFieldTrainingOperation",
    variants: [
      "현장실습 회사에서 다쳤는데 학교 조치",
      "도제학교 표준협약 참여기업 안전교육 기록",
      "실습생이 업체에서 사고났을때 보고 중단 절차"
    ],
    includes: ["현장실습", "실습"]
  },
  {
    id: "class-guidance",
    domain: "classManagementGuidance",
    variants: [
      "수업중 휴대폰 압수 가능?",
      "학생이 지시 불응하고 욕하면 생활지도 절차",
      "학교생활규정 선도조치 보호자 안내"
    ],
    includes: ["생활지도", "학교생활규정"]
  },
  {
    id: "field-experience",
    domain: "fieldExperienceLearning",
    variants: [
      "가정체험학습 신청서 보고서 출결처리",
      "교외체험학습 해외여행 증빙 뭐 필요",
      "현장체험학습이 아니라 가족체험학습 결석 처리"
    ],
    includes: ["체험학습"]
  },
  {
    id: "meal-operation",
    domain: "schoolMealOperation",
    variants: [
      "급식 반찬 민원 답변 근거",
      "식중독은 아닌데 급식 이물질 나왔을 때 조치",
      "알레르기 학생 급식 대체식 안내 기준"
    ],
    includes: ["급식"]
  },
  {
    id: "dormitory",
    domain: "dormitoryOperation",
    variants: [
      "기숙사 벌점 누적 퇴사 가능?",
      "생활관 규정 위반 보호자 통지 절차",
      "기숙사 외박 무단귀가 학생 조치"
    ],
    includes: ["기숙사", "생활관"]
  },
  {
    id: "health-counseling",
    domain: "healthInfectionCounseling",
    variants: [
      "학생 자해 위험 상담기록 어떻게 남김",
      "전염병 의심 결석 출석인정 보건실 기록",
      "감염병 확진 학생 등교중지 보호자 안내"
    ],
    includes: ["보건", "상담", "감염"]
  },
  {
    id: "teacher-rights",
    domain: "teacherRightsProtection",
    variants: [
      "학부모가 교사에게 폭언 녹음 민원 교권침해?",
      "수업중 학생이 교사 욕설 교육활동 침해 조치",
      "교권보호위원회 요청 전 증거 정리"
    ],
    includes: ["교권", "교육활동"]
  },
  {
    id: "governance",
    domain: "governanceCommitteeRule",
    variants: [
      "학교운영위원회 회의록 공개 범위",
      "학운위 위원 제척 회피 규정",
      "위원회 심의 자문 의결 차이 설명"
    ],
    includes: ["위원회"]
  },
  {
    id: "student-records",
    domain: "studentRecordsAttendance",
    variants: [
      "생기부 정정 증빙 절차",
      "질병결석 3일 출결 처리 진단서",
      "생활기록부 오기재 수정 학업성적관리위원회"
    ],
    includes: ["학생부", "출결", "생활기록부"]
  },
  {
    id: "admissions-transfer",
    domain: "admissionsTransferGraduation",
    variants: [
      "재직자전형 특성화고 졸업생 서류",
      "전학 전입학 학적 처리 기준",
      "졸업요건 미이수 학생 처리"
    ],
    includes: ["전형", "전학", "졸업"]
  },
  {
    id: "scholarship-welfare",
    domain: "scholarshipWelfareSupport",
    variants: [
      "저소득 학생 장학금 지원 증빙",
      "교육비 지원 급식비 감면 신청",
      "복지 대상 학생 개인정보 장학 추천"
    ],
    includes: ["장학", "복지", "교육비"]
  },
  {
    id: "lab-safety",
    domain: "labEquipmentPracticeSafety",
    variants: [
      "실습실 기계 안전사고 보고",
      "용접 실습 보호구 미착용 사고 예방 기준",
      "실험실 장비 파손 학생 다침 안전교육 기록"
    ],
    includes: ["실습실", "안전"]
  },
  {
    id: "ncs-curriculum",
    domain: "vocationalCurriculumNcs",
    variants: [
      "NCS 교육과정 편성 시수 기준",
      "직업계고 실무과목 평가계획",
      "전문교과 학점 배당 교육과정 변경"
    ],
    includes: ["교육과정", "NCS"]
  }
];

const STYLE_WRAPPERS = [
  (text) => text,
  (text) => `급함ㅠㅠ ${text}`,
  (text) => `정확한 용어는 모르겠고 ${text}`,
  (text) => text.replace(/\s+/g, ""),
  (text) => `${text}  어디 분야로 분류하고 답해야 하나요??`
];

const TYPO_REPLACEMENTS = [
  [/며칠/g, "몇일"],
  [/병가/g, "병까"],
  [/출장/g, "츌장"],
  [/증빙/g, "증빙자료"],
  [/학교폭력/g, "학폭"],
  [/생활기록부/g, "생기부"],
  [/휴대전화/g, "휴대폰"],
  [/교사/g, "쌤"]
];

const INTERNAL_LEAKS = [
  "파악한 질문",
  "일치 표현",
  "로컬 정책 코퍼스",
  "같은 조회 계획",
  "재계산합니다"
];

const failures = [];
const diagnostics = [];

for (const testCase of SMART_INPUT_CASES) {
  const questions = buildQuestionVariants(testCase.variants);
  for (const [index, question] of questions.entries()) {
    const result = handlePolicyChatRequest({ question });
    const text = [
      result.responseText,
      result.policyResponse?.title,
      result.policyResponse?.lead,
      ...(Array.isArray(result.policyResponse?.answer) ? result.policyResponse.answer : [result.policyResponse?.answer])
    ].filter(Boolean).join(" ");
    const actualDomain = result.semanticFrame?.domainCode || "";
    const status = result.answerState?.status || "";

    if (actualDomain !== testCase.domain) {
      addFailure(testCase.id, question, `expected ${testCase.domain}, got ${actualDomain || "unclassified"}`, result);
      continue;
    }
    if (status === "unclassified") {
      addFailure(testCase.id, question, "answer state stayed unclassified", result);
      continue;
    }
    if (!matchesAny(text, testCase.includes || [])) {
      addFailure(testCase.id, question, `answer text did not include any expected anchor: ${(testCase.includes || []).join(", ")}`, result);
    }
    for (const leak of INTERNAL_LEAKS) {
      if (text.includes(leak)) {
        addFailure(testCase.id, question, `internal text leaked: ${leak}`, result);
      }
    }
    if (index > 6) break;
  }
}

if (failures.length) {
  console.error(`Smart input regression failed: ${failures.length} failures`);
  for (const failure of failures.slice(0, 40)) {
    console.error(`- ${failure}`);
  }
  console.error(JSON.stringify(diagnostics.slice(0, 20), null, 2));
  process.exit(1);
}

console.log(`Smart input regression passed: ${SMART_INPUT_CASES.length} domains, ${SMART_INPUT_CASES.reduce((sum, item) => sum + Math.min(buildQuestionVariants(item.variants).length, 7), 0)} messy inputs`);

function buildQuestionVariants(variants = []) {
  const output = [];
  for (const variant of variants) {
    for (const wrapper of STYLE_WRAPPERS) {
      output.push(cleanQuestion(wrapper(variant)));
    }
    output.push(cleanQuestion(applyTypos(variant)));
  }
  return [...new Set(output)].filter(Boolean);
}

function applyTypos(text = "") {
  let next = text;
  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function matchesAny(text = "", anchors = []) {
  if (!anchors.length) return true;
  return anchors.some((anchor) => text.includes(anchor));
}

function cleanQuestion(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function addFailure(id, question, message, result = {}) {
  failures.push(`${id}: ${message} :: ${question}`);
  diagnostics.push({
    id,
    question,
    message,
    domain: result.semanticFrame?.domainCode || "",
    status: result.answerState?.status || "",
    confidence: result.confidence || 0,
    missingSlots: result.missingSlots || [],
    responsePreview: String(result.responseText || "").slice(0, 400)
  });
}

assert.ok(SMART_INPUT_CASES.length >= 20, "smart input coverage must span at least 20 domains");
