import policyEngine from "../public/policy-engine.js";

const SUBJECTS = [
  "특성화고 담임교사",
  "공립 고등학교 교감",
  "행정실 주무관",
  "기간제교사",
  "교육공무직원",
  "학생 보호자",
  "학생회 담당교사",
  "실습 담당교사",
  "보건교사",
  "취업부장",
  "교무부장",
  "학교장",
  "사립학교 교사",
  "학교법인 소속 교직원",
  "교무행정사",
  "특수교사",
  "영양교사",
  "전문상담교사",
  "산학협력부장",
  "도제학교 담당자",
  "실습기업 담당자",
  "졸업생",
  "학부모",
  "학생",
  "부장교사",
  "교무실 업무담당자",
  "행정실장"
];

const OFFICES = [
  "경상북도교육청 기준으로",
  "부산교육청 기준으로",
  "대구광역시교육청 기준으로",
  "경남교육청 기준으로",
  "서울시교육청 기준으로",
  "경기도교육청 기준으로",
  "교육청을 아직 못 골랐는데",
  "소속 교육청 자료를 기준으로",
  "학교 내부 규정도 같이 보면서",
  "교육청 자료와 학교 규정을 같이 보면서",
  "교육청은 아직 모르는 상태에서"
];

const STAGES = [
  "신청 전",
  "승인 단계",
  "사안 접수 직후",
  "위원회 심의 전",
  "보호자 안내 전",
  "결재 올리기 전",
  "교육청 보고 전",
  "자료 보존 단계",
  "민원 답변 전",
  "학교장 보고 전",
  "공문 시행 전",
  "계약 체결 전",
  "결과 통지 전",
  "재심·이의신청 전"
];

const EVIDENCE = [
  "신청서와 동의서",
  "나이스 상신 내역",
  "회의록과 공문",
  "상담기록과 사진",
  "영수증과 지출결의서",
  "진단서와 보호자 확인서",
  "협약서와 안전교육 기록",
  "CCTV·영상·녹음 자료",
  "근로계약서와 출근기록",
  "학교 내부 규정과 회의록",
  "사진과 상담일지",
  "공고문과 추천서",
  "검수조서와 세금계산서",
  "학생부 정정 증빙",
  "보건실 기록과 사고보고서"
];

const RISKS = [
  "개인정보 문제가 있을 때",
  "민원이 예상될 때",
  "학생 안전 문제가 있을 때",
  "예산 집행 오류가 걱정될 때",
  "학교폭력 가능성이 있을 때",
  "분쟁으로 번질 수 있을 때",
  "교육청 감사에서 볼 수 있을 때",
  "긴급 보호가 필요할 때",
  "소속과 신분이 애매할 때",
  "공립 기준과 사립 기준이 섞일 때",
  "학생 권리와 교원 보호가 충돌할 때",
  "노무·민형사 문제로 번질 때",
  "출처가 홈페이지 메인뿐일 때",
  "학교 내부 규정 확인이 필요한 때"
];

const MESSY_PREFIXES = [
  "",
  "급하게 묻습니다.",
  "상황이 좀 복잡한데요.",
  "정확한 용어는 모르겠고,",
  "선생님들이 헷갈려해서요.",
  "학교에서 실제로 생길 법한 일인데,",
  "말을 좀 대충 적으면,",
  "카톡으로 짧게 물어본다면,",
  "민원인이 길게 말했는데 핵심만 보면,",
  "규정 이름은 모르겠습니다.",
  "공립인지 사립인지가 섞여 보이는데,"
];

const QUESTION_PURPOSES = [
  "가능 여부",
  "최대 한도",
  "처리 절차",
  "필요 서류",
  "공식 근거",
  "소속 교육청 기준",
  "학교 내부 규정 우선순위",
  "당사자별 할 일",
  "민원 답변 문장",
  "위험 신호와 전문가 전환 기준"
];

const QUESTION_SUFFIXES = [
  "",
  "단정해도 되는지까지 봐 주세요.",
  "부족한 정보가 있으면 무엇을 물어봐야 하나요?",
  "공식 출처와 학교 내부 규정 순서를 나눠 주세요.",
  "사용자에게 바로 보여줄 짧은 답변으로 정리해 주세요.",
  "잘못 분류될 만한 지점도 함께 점검해 주세요."
];

const QUESTION_STYLES = [
  ({ office, subject, situation, stage, evidence, purpose, suffix }) => `${office} ${subject}가 ${situation}. ${stage} 기준으로 ${purpose}와 ${evidence}은 어떻게 확인하나요? ${suffix}`,
  ({ subject, situation, risk, purpose, suffix }) => `${subject} 관련해서 ${situation} ${risk} ${purpose}부터 무엇을 봐야 하나요? ${suffix}`,
  ({ office, situation, evidence, purpose, suffix }) => `${office} ${situation} ${purpose}에 필요한 자료가 ${evidence}인지 알려주세요. ${suffix}`,
  ({ prefix, subject, situation, stage, purpose, suffix }) => `${prefix} ${subject} ${situation} ${stage} ${purpose}가 궁금합니다. ${suffix}`,
  ({ subject, situation, evidence, risk, purpose, suffix }) => `${subject}이/가 ${situation} ${evidence}도 있고 ${risk} ${purpose} 답변을 어떻게 잡아야 하나요? ${suffix}`,
  ({ office, subject, situation, purpose, suffix }) => `${office} ${subject} 입장에서 "${situation}"라고 물으면 ${purpose}상 어떤 규정을 찾아야 하나요? ${suffix}`,
  ({ prefix, situation, purpose, evidence, suffix }) => `${prefix} ${situation}. ${purpose}만 묻는 질문 같지만 ${evidence}도 확인해야 하나요? ${suffix}`,
  ({ subject, situation, stage, risk, suffix }) => `${subject}: ${situation}. ${stage}인데 ${risk} 어느 분야로 분류하고 답해야 하나요? ${suffix}`,
  ({ office, subject, situation, purpose, evidence, risk }) => `${office} ${subject} 질문입니다. ${situation}의 ${purpose}, ${evidence}, ${risk}를 한 번에 정리해 주세요.`,
  ({ prefix, office, situation, purpose }) => `${prefix} ${office} "${situation}"라고만 물으면 ${purpose}를 바로 답해도 되나요?`
];

const DOMAIN_SEEDS = {
  domesticTravelExpense: [
    "경주 소재 학교장이 대구로 1박2일 출장갈 때 출장비",
    "행정실 주무관의 안동 관외출장 일비·식비·숙박비",
    "교사의 근무지 외 국내출장 운임 증빙"
  ],
  bereavementLeave: [
    "교사의 배우자 부모 사망 경조사휴가 일수",
    "기간제교사의 조부모상 특별휴가",
    "교육공무직의 가족 사망 경조사휴가 증빙"
  ],
  staffAttendanceService: [
    "기간제교사의 병가와 진단서 기준",
    "정규교사의 나이스 근무상황 연가 신청",
    "남 교사의 배우자 출산휴가 일수",
    "사립학교 교사의 최대 병가일수",
    "학교법인 교원 질병휴가 한도"
  ],
  schoolBudgetExecution: [
    "학교회계 물품 구입 품의·검수·지출 증빙",
    "수익자부담경비 환불과 정산",
    "업무추진비 집행과 영수증 보존"
  ],
  schoolInstructorHonorarium: [
    "외부강사 강사료 시간당 단가",
    "대학 전임강사 강의비와 초과시간 수당",
    "전직 교장 특강 강사수당"
  ],
  schoolViolenceProcedure: [
    "학생이 친구에게 돈을 반복적으로 요구한 학교폭력 사안",
    "사이버폭력 신고 후 전담기구 판단",
    "피해학생 보호조치와 보호자 통지"
  ],
  classManagementGuidance: [
    "수업 중 휴대전화 보관 생활지도",
    "학생 생활규정에 따른 자리이동 지도",
    "수업 중 반복적인 지시불응 학생 조치",
    "담임 상담기록과 학생생활지도 민원"
  ],
  fieldExperienceLearning: [
    "교외체험학습 신청서와 보고서 출결 처리",
    "현장체험학습 동의서와 안전계획",
    "가정학습 승인과 결석 처리"
  ],
  dormitoryOperation: [
    "기숙사 입사 배정과 벌점 퇴사 절차",
    "생활관 외박 승인과 보호자 동의",
    "기숙사 호실 배정 차별 민원"
  ],
  schoolMealOperation: [
    "급식 반찬 민원과 학교장 면담",
    "식중독 의심 보존식과 보고 절차",
    "알레르기 학생 식단 안내"
  ],
  studentRecordsAttendance: [
    "학생부 정정과 증빙자료",
    "질병 결석 출결 처리와 진단서",
    "생활기록부 기재 오류 정정 절차"
  ],
  schoolSafetyHealth: [
    "체육시간 안전사고와 안전공제 절차",
    "학교안전 사고 보고와 보호자 연락",
    "응급상황 119 이송과 치료비 처리"
  ],
  parentComplaintResponse: [
    "학부모 민원 답변서와 개인정보 공개 범위",
    "보호자 면담 요구와 학교장 보고",
    "국민신문고 민원 처리 기한"
  ],
  specialEducationSupport: [
    "특수교육대상자 개별화교육계획 IEP",
    "통합교육 지원인력 배치와 보호자 동의",
    "장애학생 치료지원과 보조공학기기"
  ],
  assessmentAcademicManagement: [
    "수행평가 이의신청과 학업성적관리위원회",
    "시험 부정행위 처리와 답안지 보존",
    "성적 정정 심의와 학교 규정"
  ],
  afterSchoolChildcare: [
    "방과후학교 수강료 환불",
    "늘봄 프로그램 위탁 계약과 안전관리",
    "자유수강권 대상 학생 지원"
  ],
  vocationalFieldTrainingOperation: [
    "특성화고 현장실습 중 기계 사고",
    "표준협약서 체결 전 선도기업 안전 확인",
    "실습기업에서 학생 보호 조치와 복교"
  ],
  vocationalCurriculumNcs: [
    "직업계고 NCS 실무과목 편성",
    "고교학점제 전문교과 이수 기준",
    "특성화고 공동교육과정 운영"
  ],
  labEquipmentPracticeSafety: [
    "실험실습실 위험기계 안전교육",
    "실습재료 구입과 보호구 지급",
    "MSDS 화학물질 폐기물 관리"
  ],
  careerEmploymentGuidance: [
    "잡알리오 고졸채용 공고 검증",
    "졸업생 근로계약 임금체불 상담",
    "취업부 추천채용 조건 확인"
  ],
  admissionsTransferGraduation: [
    "특성화고 전입학과 편입학 처리",
    "위탁교육 학적 변동",
    "졸업 기준과 학적부 정리"
  ],
  scholarshipWelfareSupport: [
    "특성화고 학생 장학금과 통학비 지원",
    "교육급여와 교육비 지원 신청",
    "기숙사비 감면과 수익자부담 환불"
  ],
  healthInfectionCounseling: [
    "학생 상담기록 열람과 비밀보호",
    "감염병 등교중지와 출석인정",
    "위기학생 자해 위험과 보호자 안내"
  ],
  teacherRightsProtection: [
    "학부모 폭언과 교육활동 보호",
    "교사가 아동학대 신고를 당한 사안",
    "학생이 교사 얼굴을 몰래 찍어 SNS에 올린 사안"
  ],
  facilityDigitalSecurity: [
    "학생 사진을 홈페이지에 게시할 때 개인정보 동의",
    "퇴직한 직원 나이스 권한 회수",
    "CCTV 영상 열람과 제공 기준"
  ],
  governanceCommitteeRule: [
    "학교운영위원회 회의록 공개",
    "학칙개정 의견수렴과 규정개정 절차",
    "교무위원회 심의 기록 보존"
  ]
};

export const COUNTEREXAMPLE_CASES = [
  {
    id: "field-training-accident-not-lab",
    question: "현장실습 중 위험기계 사고가 났을 때 학교와 기업의 보고 절차는?",
    expectedDomain: "vocationalFieldTrainingOperation",
    forbiddenDomain: "labEquipmentPracticeSafety"
  },
  {
    id: "employment-not-field-training",
    question: "현장실습생 채용 공고와 추천채용 조건을 잡알리오로 검증하려면?",
    expectedDomain: "careerEmploymentGuidance",
    forbiddenDomain: "vocationalFieldTrainingOperation"
  },
  {
    id: "graduate-labor-counseling-not-student-counseling",
    question: "졸업생 근로계약 임금체불 상담 기준, 처리 절차, 필요한 증빙자료를 알려주세요.",
    expectedDomain: "careerEmploymentGuidance",
    forbiddenDomain: "healthInfectionCounseling"
  },
  {
    id: "neis-permission-not-attendance",
    question: "퇴직한 직원 나이스 계정 권한을 계속 둬도 되나요?",
    expectedDomain: "facilityDigitalSecurity",
    forbiddenDomain: "staffAttendanceService"
  },
  {
    id: "neis-attendance-not-security",
    question: "기간제교사가 나이스 근무상황으로 병가를 상신하려면?",
    expectedDomain: "staffAttendanceService",
    forbiddenDomain: "facilityDigitalSecurity"
  },
  {
    id: "meal-complaint-not-parent-only",
    question: "학부모가 급식 반찬이 마음에 들지 않는다며 학교장 면담을 요구했습니다. 식중독은 없습니다.",
    expectedDomain: "schoolMealOperation",
    forbiddenDomain: "parentComplaintResponse"
  },
  {
    id: "teacher-sns-photo-not-unclassified",
    question: "학생이 교사 얼굴을 몰래 찍어 SNS에 올렸어요. 어떻게 처리해야 하나요?",
    expectedDomain: "teacherRightsProtection",
    forbiddenDomain: "facilityDigitalSecurity"
  },
  {
    id: "teacher-parent-legal-dispute-not-privacy",
    question: "공립고 교사가 보호자에게 고소를 고민 중이고 문자 캡처가 있습니다. 어떻게 정리해야 하나요?",
    expectedDomain: "teacherRightsProtection",
    forbiddenDomain: "facilityDigitalSecurity"
  },
  {
    id: "student-photo-consent-not-field-experience",
    question: "졸업앨범 사진 동의서는 꼭 받아야 하나요?",
    expectedDomain: "facilityDigitalSecurity",
    forbiddenDomain: "fieldExperienceLearning"
  },
  {
    id: "counseling-record-not-parent-complaint",
    question: "상담기록을 다른 교사에게 공유해도 되나요?",
    expectedDomain: "healthInfectionCounseling",
    forbiddenDomain: "parentComplaintResponse"
  },
  {
    id: "committee-minutes-ambiguous",
    question: "위원회 회의록 공개 기준은?",
    expectedClarification: true
  },
  {
    id: "record-disclosure-ambiguous",
    question: "학생 기록을 학부모에게 공개해도 되나요?",
    expectedClarification: true
  },
  {
    id: "civil-lawsuit-risk-ambiguous",
    question: "민사소송을 해야 하나요?",
    expectedClarification: true
  },
  {
    id: "criminal-complaint-risk-ambiguous",
    question: "이 사안은 고소해야 하나요?",
    expectedClarification: true
  },
  {
    id: "classroom-guidance-instruction-refusal-not-staff-leave",
    question: "교사의 수업시간 중 반복적인 지시를 따르지 않는 학생에게 내릴 수 있는 조치는?",
    expectedDomain: "classManagementGuidance",
    forbiddenDomain: "staffAttendanceService"
  }
];

const ADVERSARIAL_DISTRACTORS = [
  ["domesticTravelExpense", "출장비·여비·일비·식비"],
  ["bereavementLeave", "경조사휴가·가족관계"],
  ["staffAttendanceService", "나이스 근무상황·복무·병가·연가"],
  ["schoolBudgetExecution", "계약·지출·증빙·학교회계"],
  ["schoolInstructorHonorarium", "외부강사·강사료·시간당 단가"],
  ["schoolViolenceProcedure", "학교폭력·전담기구·피해학생 보호"],
  ["classManagementGuidance", "생활지도·상담·수업 중 휴대전화"],
  ["fieldExperienceLearning", "체험학습 신청서·보고서·출결"],
  ["dormitoryOperation", "기숙사 배정·외박·벌점"],
  ["schoolMealOperation", "급식 민원·식중독·보존식"],
  ["studentRecordsAttendance", "학생부·출결·정정"],
  ["schoolSafetyHealth", "안전사고·응급·안전공제"],
  ["parentComplaintResponse", "학부모 민원·답변서·정보공개"],
  ["specialEducationSupport", "특수교육·개별화교육계획·IEP"],
  ["assessmentAcademicManagement", "수행평가·성적정정·학업성적관리위원회"],
  ["afterSchoolChildcare", "방과후학교·늘봄·수강료 환불"],
  ["vocationalFieldTrainingOperation", "현장실습·표준협약·선도기업"],
  ["vocationalCurriculumNcs", "NCS·직업계고학점제·전문교과"],
  ["labEquipmentPracticeSafety", "실험실습실·위험기계·MSDS"],
  ["careerEmploymentGuidance", "잡알리오·고졸채용·임금체불 노동상담"],
  ["admissionsTransferGraduation", "전입학·편입학·졸업 학적"],
  ["scholarshipWelfareSupport", "장학금·교육급여·수익자부담"],
  ["healthInfectionCounseling", "감염병·상담기록·위기학생"],
  ["teacherRightsProtection", "교권침해·교육활동 보호·악성민원"],
  ["facilityDigitalSecurity", "개인정보·CCTV·나이스 계정권한"],
  ["governanceCommitteeRule", "학교운영위원회·회의록·규정개정"]
];

const ADVERSARIAL_SUBJECTS = [
  "학교 업무 담당자",
  "담당 교직원",
  "특성화고 담당자",
  "교무·행정 담당자",
  "부서 담당자",
  "학교 담당자"
];

const ADVERSARIAL_STAGES = [
  "처리 절차",
  "기준 확인",
  "공식 근거 확인",
  "자료 검토",
  "업무 단계 구분",
  "안내문 작성 전"
];

const ADVERSARIAL_EVIDENCE = [
  "필요 서류",
  "확인 자료",
  "증빙자료",
  "공문·기록",
  "신청·보고 자료",
  "보존 자료"
];

const ADVERSARIAL_RISKS = [
  "비슷한 용어가 섞였을 때",
  "자료 제목이 헷갈릴 때",
  "민원 문장이 장황할 때",
  "업무 담당자가 처음 접수했을 때",
  "공식 근거를 나눠야 할 때",
  "소속 교육청 기준도 확인해야 할 때"
];

const ADVERSARIAL_FRAMES = [
  ({ seed, distractor, stage, evidence }) => `핵심은 ${seed}입니다. 자료에 ${distractor} 표현도 보이지만 ${stage}와 ${evidence}을 ${seed} 중심으로 알려주세요.`,
  ({ subject, seed, distractor, risk }) => `${subject}가 묻습니다. 핵심은 ${seed}입니다. 첨부자료에 ${distractor}도 적혀 있지만 ${risk} 어느 규정 분야로 봐야 하나요?`,
  ({ office, seed, distractor, evidence }) => `${office} 핵심은 ${seed}입니다. ${distractor}와 헷갈린다는 의견이 있는데 ${evidence}과 절차를 구분해 주세요.`,
  ({ prefix, subject, seed, distractor, stage }) => `${prefix} ${subject} 입장에서는 ${seed}이 핵심입니다. 다만 설명에 ${distractor}가 섞여 있습니다. ${stage} 기준은?`,
  ({ seed, distractor, purpose, risk }) => `${seed}의 ${purpose}를 묻는 질문입니다. 문장 안에 ${distractor} 단어가 있어도 ${risk} 최종 분류는 어디로 해야 하나요?`,
  ({ office, subject, seed, distractor, purpose }) => `${office} ${subject} 질문: ${seed}. ${distractor}로 오해할 수 있지만 ${purpose} 답변은 핵심 사안 기준으로 해 주세요.`,
  ({ prefix, seed, distractor, evidence, purpose }) => `${prefix} ${seed} 관련 ${purpose}입니다. 첨부에 ${distractor}가 보여도 ${evidence} 확인은 어느 규정에서 시작하나요?`,
  ({ subject, seed, distractor, stage, risk }) => `${subject}가 "${seed}"라고만 물었고 뒤에 ${distractor} 이야기를 붙였습니다. ${stage}에서 ${risk} 무엇을 우선해야 하나요?`,
  ({ office, seed, distractor, purpose }) => `${office} ${seed} 질문에 ${distractor}가 섞여 있습니다. ${purpose}를 답할 때 잘못 끌려가면 안 되는 분야는 무엇인가요?`,
  ({ prefix, subject, seed, distractor, evidence }) => `${prefix} ${subject}의 실제 문의는 ${seed}입니다. ${distractor}는 참고 표현입니다. ${evidence}과 공식 근거를 핵심 기준으로 정리해 주세요.`
];

export function buildSyntheticPolicyScenarioBank({ maxPerDomain = 432, maxCounterexamplesPerDomain = 540 } = {}) {
  const kbDomains = policyEngine.knowledgeBase?.domains || {};
  const scenarios = [];

  for (const [domainCode, domain] of Object.entries(kbDomains)) {
    const seeds = DOMAIN_SEEDS[domainCode] || buildFallbackSeeds(domain);
    scenarios.push(...generateDomainScenarios(domainCode, domain, seeds, maxPerDomain));
  }

  const canonicalScenarios = buildCanonicalScenarios(kbDomains);
  const regressionSample = canonicalScenarios;
  const manualCounterexamples = COUNTEREXAMPLE_CASES.map((item) => ({
    ...item,
    kind: "counterexample",
    source: "human-curated-adversarial-seed"
  }));
  const syntheticCounterexamples = buildSyntheticCounterexamples(kbDomains, {
    maxPerDomain: maxCounterexamplesPerDomain
  });
  const counterexamples = [...manualCounterexamples, ...syntheticCounterexamples];

  return {
    version: "20260614-synthetic-policy-scenario-bank-v3",
    createdAt: "2026-06-14",
    generator: {
      mode: "deterministic-ai-style-balanced-grid",
      note: "External LLM calls are intentionally excluded from regression so the bank stays reproducible and free to run. GPT-generated rows can be appended with the same schema.",
      adversarialMode: "target-domain-anchor-plus-distractor-domain-noise",
      coverageAxes: ["domain", "seed", "subject", "office", "stage", "evidence", "risk", "purpose", "wording"]
    },
    metadata: {
      domainCount: Object.keys(kbDomains).length,
      syntheticCount: scenarios.length + canonicalScenarios.length,
      manualCounterexampleCount: manualCounterexamples.length,
      syntheticCounterexampleCount: syntheticCounterexamples.length,
      counterexampleCount: counterexamples.length,
      regressionSampleCount: regressionSample.length,
      totalCount: scenarios.length + canonicalScenarios.length + counterexamples.length
    },
    scenarios: [...canonicalScenarios, ...scenarios],
    counterexamples,
    regressionSample
  };
}

function generateDomainScenarios(domainCode, domain = {}, seeds = [], maxPerDomain = 432) {
  const generated = [];
  const safeSeeds = seeds.length ? seeds : buildFallbackSeeds(domain);

  for (let index = 0; index < maxPerDomain; index += 1) {
    const context = buildScenarioContext(index, safeSeeds, domainCode);
    const style = QUESTION_STYLES[index % QUESTION_STYLES.length];
    generated.push({
      id: `${domainCode}-synthetic-${index + 1}`,
      kind: "domain-synthetic",
      domainCode,
      domainLabel: domain.label || domainCode,
      question: compactQuestion(style(context)),
      expectedDomain: domainCode,
      tags: buildScenarioTags({
        domainCode,
        subject: context.subject,
        stage: context.stage,
        evidence: context.evidence,
        risk: context.risk,
        seed: context.situation,
        purpose: context.purpose
      }),
      source: "deterministic-balanced-scenario-generator"
    });
  }

  return generated;
}

function buildSyntheticCounterexamples(kbDomains = {}, { maxPerDomain = 540 } = {}) {
  const counterexamples = [];
  const domainCodes = Object.keys(kbDomains);

  for (const domainCode of domainCodes) {
    const seeds = DOMAIN_SEEDS[domainCode] || buildFallbackSeeds(kbDomains[domainCode]);
    const generatedForDomain = [];

    let serial = 0;
    let cursor = 0;
    const validDistractors = ADVERSARIAL_DISTRACTORS
      .filter(([forbiddenDomain]) => forbiddenDomain !== domainCode && kbDomains[forbiddenDomain]);

    while (generatedForDomain.length < maxPerDomain && validDistractors.length) {
      const seed = seeds[cursor % seeds.length];
      const [forbiddenDomain, distractor] = validDistractors[Math.floor(cursor / seeds.length) % validDistractors.length];
      const subject = ADVERSARIAL_SUBJECTS[Math.floor(cursor / (seeds.length * validDistractors.length)) % ADVERSARIAL_SUBJECTS.length];
      const stage = ADVERSARIAL_STAGES[Math.floor(cursor / 5) % ADVERSARIAL_STAGES.length];
      const evidence = ADVERSARIAL_EVIDENCE[Math.floor(cursor / 7) % ADVERSARIAL_EVIDENCE.length];
      const risk = ADVERSARIAL_RISKS[Math.floor(cursor / 11) % ADVERSARIAL_RISKS.length];
      const office = OFFICES[Math.floor(cursor / 13) % OFFICES.length];
      const prefix = MESSY_PREFIXES[Math.floor(cursor / 17) % MESSY_PREFIXES.length] || "질문이 섞였는데요.";
      const purpose = QUESTION_PURPOSES[Math.floor(cursor / 19) % QUESTION_PURPOSES.length];
      const frame = ADVERSARIAL_FRAMES[cursor % ADVERSARIAL_FRAMES.length];
      serial += 1;
      generatedForDomain.push({
        id: `${domainCode}-vs-${forbiddenDomain}-adversarial-${serial}`,
        kind: "counterexample-synthetic",
        domainCode,
        expectedDomain: domainCode,
        forbiddenDomain,
        question: compactQuestion(frame({
          office,
          subject,
          seed,
          distractor,
          stage,
          evidence,
          risk,
          prefix,
          purpose
        })),
        tags: [
          domainCode,
          `not-${forbiddenDomain}`,
          "adversarial",
          normalizeTag(seed),
          normalizeTag(distractor),
          normalizeTag(purpose)
        ],
        source: "deterministic-balanced-adversarial-generator"
      });
      cursor += 1;
    }

    counterexamples.push(...generatedForDomain);
  }

  return counterexamples;
}

function buildScenarioContext(index = 0, seeds = [], domainCode = "") {
  const seedCount = Math.max(1, seeds.length);
  return {
    office: OFFICES[Math.floor(index / 3) % OFFICES.length],
    subject: SUBJECTS[Math.floor(index / seedCount) % SUBJECTS.length],
    situation: seeds[index % seedCount],
    stage: STAGES[Math.floor(index / 5) % STAGES.length],
    evidence: EVIDENCE[Math.floor(index / 7) % EVIDENCE.length],
    risk: RISKS[Math.floor(index / 11) % RISKS.length],
    prefix: MESSY_PREFIXES[Math.floor(index / 13) % MESSY_PREFIXES.length],
    purpose: QUESTION_PURPOSES[Math.floor(index / 17) % QUESTION_PURPOSES.length],
    suffix: QUESTION_SUFFIXES[Math.floor(index / 19) % QUESTION_SUFFIXES.length],
    domainCode
  };
}

function buildFallbackSeeds(domain = {}) {
  const keywords = (domain.intentKeywords || []).slice(0, 3);
  const label = domain.label || "학교 규정";
  return keywords.length
    ? keywords.map((keyword) => `${label} ${keyword} 처리 기준`)
    : [`${label} 처리 기준`];
}

function buildCanonicalScenarios(kbDomains = {}) {
  const sample = [];
  for (const domainCode of Object.keys(kbDomains)) {
    const domain = kbDomains[domainCode] || {};
    const seeds = DOMAIN_SEEDS[domainCode] || buildFallbackSeeds(domain);
    for (const [index, seed] of seeds.slice(0, 3).entries()) {
      sample.push({
        id: `${domainCode}-canonical-${index + 1}`,
        kind: "domain-canonical",
        domainCode,
        domainLabel: domain.label || domainCode,
        question: `${seed} 기준, 처리 절차, 필요한 증빙자료를 알려주세요.`,
        expectedDomain: domainCode,
        tags: [domainCode, "canonical", normalizeTag(seed)],
        source: "deterministic-ai-style-canonical-seed"
      });
    }
  }
  return sample;
}

function buildScenarioTags({ domainCode, subject, stage, evidence, risk, seed, purpose = "" }) {
  return [
    domainCode,
    normalizeTag(subject),
    normalizeTag(stage),
    normalizeTag(evidence),
    normalizeTag(risk),
    normalizeTag(seed),
    normalizeTag(purpose)
  ].filter(Boolean);
}

function normalizeTag(value = "") {
  return String(value || "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function compactQuestion(value = "") {
  return String(value || "").replace(/\s+/g, " ").replace(/\s+\?/g, "?").trim();
}
