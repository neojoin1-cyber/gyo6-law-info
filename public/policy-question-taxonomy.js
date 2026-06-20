(function attachPolicyQuestionTaxonomy(root, factory) {
  const taxonomy = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = taxonomy;
  } else {
    root.GYO6_POLICY_QUESTION_TAXONOMY = taxonomy;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createPolicyQuestionTaxonomy() {
  const VERSION = "20260612-question-taxonomy-v2";

  const slots = {
    targetSubject: {
      label: "대상 신분",
      question: "대상이 누구인가요?",
      reason: "교원, 기간제교사, 지방공무원, 교육공무직, 학생, 학부모, 강사 등 신분에 따라 적용 규정이 달라집니다.",
      placeholder: "예: 공립 정규교원 / 기간제교사 / 교육공무직 / 학생 / 학부모 / 외부강사"
    },
    office: {
      label: "소속 교육청",
      question: "실제 소속 교육청은 어디인가요?",
      reason: "예산, 복무, 계약제교원, 교육공무직, 체험학습, 방과후학교 등은 교육청별 지침이 달라질 수 있습니다.",
      placeholder: "예: 경상북도교육청 / 부산광역시교육청 / 경상남도교육청"
    },
    schoolLevel: {
      label: "학교급",
      question: "학교급은 무엇인가요?",
      reason: "유치원, 초등학교, 중학교, 고등학교, 특수학교에 따라 적용 지침과 서식이 달라질 수 있습니다.",
      placeholder: "예: 고등학교 / 특성화고 / 초등학교 / 유치원 / 특수학교"
    },
    employmentType: {
      label: "고용 형태",
      question: "고용 형태나 근무 형태가 어떻게 되나요?",
      reason: "정규교원, 기간제교사, 시간강사, 교육공무직, 사립학교 교직원은 휴가·복무·수당 산정 출발점이 다릅니다.",
      placeholder: "예: 공립 정규교원 / 기간제 6개월 / 사립학교 / 방학 중 비근무"
    },
    familyRelation: {
      label: "가족관계",
      question: "휴가 대상 가족관계가 어떻게 되나요?",
      reason: "경조사휴가는 배우자, 부모, 배우자의 부모, 자녀, 조부모, 형제자매 등 관계별 일수가 다릅니다.",
      placeholder: "예: 배우자 출산 / 배우자의 부모 사망 / 본인 부모 사망 / 배우자의 삼촌"
    },
    serviceIssue: {
      label: "복무 사유",
      question: "복무·근태 사유가 무엇인가요?",
      reason: "연가, 병가, 공가, 특별휴가, 지각·조퇴·외출, 초과근무는 서로 다른 규정과 증빙을 봅니다.",
      placeholder: "예: 배우자 출산휴가 / 병가 / 무단 지각 / 연가 / 공가"
    },
    dateRange: {
      label: "기간",
      question: "기간이나 기준일은 어떻게 되나요?",
      reason: "휴가·출장·체험학습·계약 기간 산정은 기준일과 일수 정보가 있어야 계산할 수 있습니다.",
      placeholder: "예: 2026.3.1.~2026.8.31. / 6개월째 근무 / 1박 2일 / 당일"
    },
    destination: {
      label: "출장지",
      question: "출장지는 어디이고 근무지 내 출장인가요?",
      reason: "출장 여비는 근무지 내·외, 출장지 지역, 숙박 여부에 따라 일비·식비·숙박비 산정이 달라집니다.",
      placeholder: "예: 진해시 당일 / 경주시 1박 2일 / 근무지 내 4시간 이상"
    },
    expenseItems: {
      label: "여비 항목",
      question: "무슨 비용을 알고 싶나요?",
      reason: "일비, 식비, 숙박비, 운임, 전체 출장비는 각각 산정 표와 증빙 기준이 다릅니다.",
      placeholder: "예: 일비와 식비 / 숙박비 / 전체 출장비 / 운임"
    },
    fiscalYear: {
      label: "학년도·회계연도",
      question: "어느 학년도 또는 회계연도 기준인가요?",
      reason: "학교회계 예산편성 기본지침과 강사수당 표는 학년도별로 바뀔 수 있습니다.",
      placeholder: "예: 2026학년도 / 올해 / 2025학년도"
    },
    spendingType: {
      label: "집행 항목",
      question: "예산·지출 항목은 무엇인가요?",
      reason: "강사수당, 업무추진비, 물품, 용역, 공사, 수익자부담경비는 집행 가능 범위와 증빙이 다릅니다.",
      placeholder: "예: 강사수당 / 업무추진비 / 물품 구입 / 수학여행 계약 / 정산"
    },
    procedureStage: {
      label: "업무 단계",
      question: "현재 어느 단계인가요?",
      reason: "신청, 승인, 접수, 조사, 심의, 통지, 정정, 집행, 정산 단계마다 확인할 자료가 달라집니다.",
      placeholder: "예: 신청 전 / 학교장 승인 전 / 조사 중 / 심의 후 / 지출 전"
    },
    evidence: {
      label: "증빙자료",
      question: "현재 확보된 자료나 기록은 무엇인가요?",
      reason: "규정 답변은 사실관계를 단정하기보다 신청서, 진단서, 회의록, 영수증, 상담기록 등 증빙 흐름으로 좁혀야 합니다.",
      placeholder: "예: 진단서 있음 / 나이스 상신 완료 / 신청서 없음 / 회의록 있음"
    },
    schoolRule: {
      label: "학교 내부 규정",
      question: "학교 내부 규정이나 위원회 기준이 있나요?",
      reason: "학칙, 학교생활규정, 기숙사 운영규정, 급식 운영 기준, 학업성적관리규정은 학교별 직접 기준이 될 수 있습니다.",
      placeholder: "예: 학교생활규정 있음 / 기숙사 운영규정 확인 전 / 학업성적관리규정 확인 필요"
    },
    riskSignal: {
      label: "위험 신호",
      question: "안전, 인권, 개인정보, 차별, 학교폭력, 아동학대, 감사·소송 위험이 있나요?",
      reason: "위험 신호가 있으면 단순 안내가 아니라 보호조치, 기록 보존, 담당부서 보고, 전문가 확인 단계가 필요합니다.",
      placeholder: "예: 피해학생 보호 필요 / 식중독 의심 없음 / 개인정보 포함 / 차별 주장"
    },
    instructorProfile: {
      label: "강사 등급",
      question: "강사의 신분·경력·등급 판단 정보가 있나요?",
      reason: "강사수당은 전·현직 교장, 교감, 교사, 장학관, 장학사, 외부 전문가 등 등급에 따라 단가가 달라집니다.",
      placeholder: "예: 대학 전임강사 / 전직 교장 / 현직 교사 / 외부 전문가"
    },
    lectureDuration: {
      label: "강의시간",
      question: "강의시간과 기본·초과시간 구분은 어떻게 되나요?",
      reason: "강사수당은 기본 1시간 단가와 초과시간 단가를 나누어 산정해야 합니다.",
      placeholder: "예: 1시간 / 2시간 / 초과시간만 / 회당 90분"
    },
    vocationalProgram: {
      label: "직업교육 프로그램",
      question: "어떤 직업교육 프로그램 또는 업무인가요?",
      reason: "현장실습, 도제학교, 일학습병행, NCS 교육과정, 취업지도는 적용 지침과 확인 자료가 다릅니다.",
      placeholder: "예: 현장실습 / 도제학교 / NCS 실무과목 / 추천채용 / 글로벌 현장학습"
    },
    industryPartner: {
      label: "참여기업·산업체",
      question: "관련 기업이나 산업체 유형은 무엇인가요?",
      reason: "선도기업, 참여기업, 실습기업, 채용기관 여부에 따라 협약·점검·안전·근로조건 확인 기준이 달라집니다.",
      placeholder: "예: 선도기업 / 참여기업 / 실습기업 / 채용기관 / 기업현장교사"
    },
    curriculumArea: {
      label: "교육과정·학적 영역",
      question: "교육과정이나 학적 중 어느 영역인가요?",
      reason: "NCS, 전문교과, 고교학점제, 전입학, 졸업, 평가·성적은 조회해야 할 지침과 위원회가 다릅니다.",
      placeholder: "예: NCS 실무과목 / 고교학점제 / 전입학 / 졸업 / 수행평가"
    },
    welfareBenefit: {
      label: "복지·지원 항목",
      question: "어떤 복지·지원 항목인가요?",
      reason: "장학금, 교육급여, 교육비, 수익자부담, 자유수강권, 기숙사비는 신청·심사·정산 기준이 다릅니다.",
      placeholder: "예: 장학금 / 교육급여 / 수익자부담 환불 / 자유수강권 / 기숙사비"
    },
    facilityArea: {
      label: "시설·공간",
      question: "어떤 시설이나 공간과 관련된 사안인가요?",
      reason: "실험실습실, 기자재, 급식실, 기숙사, 시설공사, CCTV는 담당 부서와 안전·계약·개인정보 기준이 달라집니다.",
      placeholder: "예: 실습실 / 기자재 / 급식실 / 기숙사 / 시설공사 / CCTV"
    },
    dataSystem: {
      label: "정보시스템",
      question: "관련 정보시스템이나 데이터는 무엇인가요?",
      reason: "나이스, K-에듀파인, 개인정보, 영상정보, 계정 권한은 각각 접근권한·보존·공개 기준이 다릅니다.",
      placeholder: "예: 나이스 / K-에듀파인 / 개인정보 / CCTV 영상 / 계정 권한"
    }
  };

  const intents = [
    intent("spouseChildbirthLeave", "배우자 출산휴가", "복무·휴가 > 특별휴가 > 배우자 출산휴가", "leaveAttendance", "staffAttendanceService", ["배우자출산휴가", "배우자 출산", "배우자가 출산", "배우자 출산한", "배우자 출산 경우", "아내 출산", "남편 출산", "남자 교사 출산휴가", "남성 교사 출산휴가", "남자 교사가 출산휴가", "남성 교사가 출산휴가", "아빠 출산휴가", "출산휴가 배우자"], ["targetSubject", "employmentType", "dateRange", "evidence"], ["출산", "배우자", "휴가일수", "나이스"], "배우자 출산에 따른 특별휴가 일수와 신청 절차"),
    intent("childbirthSpecialLeave", "출산 관련 특별휴가", "복무·휴가 > 특별휴가 > 출산·육아 관련 휴가", "leaveAttendance", "staffAttendanceService", ["출산휴가", "출산 휴가", "출산 휴가 규정", "교사 출산휴가", "교원 출산휴가", "모성보호", "부성보호", "육아시간"], ["targetSubject", "employmentType", "serviceIssue", "dateRange", "evidence"], ["출산", "특별휴가", "나이스"], "본인 출산휴가, 배우자 출산휴가, 육아 관련 특별휴가 구분"),
    intent("bereavementLeave", "사망 경조사휴가", "복무·휴가 > 특별휴가 > 경조사휴가", "leaveAttendance", "bereavementLeave", ["경조사휴가", "부모상", "배우자상", "장인상", "장모상", "시부상", "시모상", "조부모상", "형제상", "사망 휴가", "상휴가"], ["targetSubject", "employmentType", "familyRelation", "dateRange", "evidence"], ["사망", "상례", "장례", "부고"], "가족 사망에 따른 경조사휴가 일수와 증빙"),
    intent("annualLeave", "연가·연차", "복무·휴가 > 연가·연차", "leaveAttendance", "staffAttendanceService", ["연가", "연차", "휴가일수", "연가일수", "연차수당", "유급휴가"], ["targetSubject", "employmentType", "dateRange", "evidence"], ["근무기간", "개근", "나이스"], "연가·연차 발생 일수와 신청 절차"),
    intent("sickLeave", "병가", "복무·휴가 > 병가", "leaveAttendance", "staffAttendanceService", ["병가", "진단서", "질병휴가", "입원", "통원", "요양"], ["targetSubject", "employmentType", "dateRange", "evidence"], ["진단서", "나이스", "학교장 승인"], "병가 가능 일수와 증빙·승인 절차"),
    intent("officialLeave", "공가", "복무·휴가 > 공가", "leaveAttendance", "staffAttendanceService", ["공가", "예비군", "민방위", "건강검진", "공무상"], ["targetSubject", "employmentType", "procedureStage", "evidence"], ["공가", "증빙"], "공가 인정 여부와 증빙"),
    intent("attendanceTime", "지각·조퇴·외출", "복무·근태 > 지각·조퇴·외출", "leaveAttendance", "staffAttendanceService", ["지각", "조퇴", "외출", "무단지각", "무단 조퇴", "무단 외출", "근무상황"], ["targetSubject", "employmentType", "serviceIssue", "dateRange", "evidence"], ["출근기록", "나이스", "복무 위반"], "지각·조퇴·외출 처리와 복무 위반 여부"),
    intent("overtime", "초과근무", "복무·근태 > 초과근무", "leaveAttendance", "staffAttendanceService", ["초과근무", "시간외근무", "야근", "휴일근무", "대체휴무"], ["targetSubject", "employmentType", "dateRange", "evidence"], ["승인", "수당"], "초과근무 승인·수당·대체휴무 확인"),
    intent("domesticTravelExpense", "국내 출장여비", "출장·여비 > 국내 출장비 산정", "leaveAttendance", "domesticTravelExpense", ["출장비", "여비", "일비", "식비", "숙박비", "운임", "관외출장", "관내출장", "근무지내 출장"], ["targetSubject", "expenseItems", "destination", "dateRange", "evidence"], ["공무원 여비 규정", "근무지 내"], "국내 출장 일비·식비·숙박비·운임 산정"),
    intent("budgetPlanning", "예산편성", "학교회계 > 예산편성", "budgetExecution", "schoolBudgetExecution", ["예산편성", "본예산", "추경", "성립전", "세출예산", "원가통계비목"], ["office", "fiscalYear", "spendingType", "procedureStage"], ["학교회계", "기본지침"], "학교회계 예산편성 기준 확인"),
    intent("spendingEvidence", "지출 증빙", "학교회계 > 지출·증빙", "budgetExecution", "schoolBudgetExecution", ["지출", "증빙", "품의", "검수", "지출결의", "영수증", "카드전표", "세금계산서"], ["office", "fiscalYear", "spendingType", "procedureStage", "evidence"], ["품의", "검수", "정산"], "지출 가능 여부와 증빙자료 확인"),
    intent("contractCheck", "계약·검수", "학교회계 > 계약·검수", "budgetExecution", "schoolBudgetExecution", ["수의계약", "입찰", "견적", "계약", "검수", "물품", "용역", "공사"], ["office", "fiscalYear", "spendingType", "procedureStage", "evidence"], ["지방계약", "검수조서"], "계약·검수·지출 절차 확인"),
    intent("businessPromotion", "업무추진비·협의회비", "학교회계 > 업무추진비", "budgetExecution", "schoolBudgetExecution", ["업무추진비", "협의회비", "간담회", "접대", "식대", "회의 식비"], ["office", "fiscalYear", "spendingType", "procedureStage", "evidence"], ["참석자", "목적", "영수증"], "업무추진비 집행 가능 범위와 증빙"),
    intent("instructorHonorarium", "강사수당·강사료", "학교회계 > 강사수당", "budgetExecution", "schoolInstructorHonorarium", ["강사수당", "강사료", "강사비", "강의비", "교육강사수당", "외부강사", "전직교장", "전임강사"], ["office", "fiscalYear", "instructorProfile", "lectureDuration", "evidence"], ["강사등급", "초과시간"], "강사 등급과 기본·초과시간 단가 산정"),
    intent("studentAttendanceAbsence", "출결·인정결석", "학생부·출결 > 출결 처리", "studentRecords", "studentRecordsAttendance", ["출결", "인정결석", "출석인정결석", "질병결석", "미인정결석", "결석계", "출석인정", "경조사 결석", "경조사 출석인정", "경조사로 인한 결석", "학생 부모 사망", "부모 사망", "부모상 결석", "상고결석"], ["schoolLevel", "procedureStage", "evidence", "dateRange"], ["기재요령", "증빙", "경조사"], "출결 인정 여부와 증빙"),
    intent("studentRecordCorrection", "생활기록부 정정", "학생부·출결 > 생활기록부 정정", "studentRecords", "studentRecordsAttendance", ["생활기록부 정정", "학생부 정정", "생기부 수정", "기재오류", "삭제 요청"], ["schoolLevel", "procedureStage", "evidence", "riskSignal"], ["기재요령", "정정대장"], "학교생활기록부 정정 절차와 증빙"),
    intent("schoolViolenceIntake", "학교폭력 신고·접수", "학교폭력 > 신고·접수", "studentDiscipline", "schoolViolenceProcedure", ["학교폭력", "학폭", "폭행", "따돌림", "욕설", "사이버폭력", "단체채팅방", "보복"], ["targetSubject", "schoolLevel", "procedureStage", "evidence", "riskSignal"], ["피해학생", "가해학생", "전담기구"], "학교폭력 신고·접수·조사 흐름"),
    intent("victimProtection", "피해학생 보호조치", "학교폭력 > 피해학생 보호", "studentDiscipline", "schoolViolenceProcedure", ["피해학생 보호", "분리조치", "접촉금지", "보복", "긴급보호", "상담지원"], ["targetSubject", "procedureStage", "evidence", "riskSignal"], ["보호조치", "안전"], "피해학생 보호조치와 긴급 대응"),
    intent("classMobilePhone", "휴대전화 생활지도", "학급관리 > 학생생활지도", "studentDiscipline", "classManagementGuidance", ["휴대전화", "휴대폰", "스마트폰", "압수", "보관", "생활지도", "수업방해"], ["schoolLevel", "schoolRule", "procedureStage", "riskSignal", "evidence"], ["학교생활규정", "학생인권"], "휴대전화 보관·생활지도 기준"),
    intent("classroomDisruption", "수업방해 생활지도", "학급관리 > 수업방해", "studentDiscipline", "classManagementGuidance", ["수업방해", "자리 이동", "훈육", "생활지도", "교권침해", "아동학대 신고"], ["targetSubject", "schoolRule", "procedureStage", "riskSignal", "evidence"], ["생활지도 고시", "교권"], "수업방해·생활지도·민원 대응"),
    intent("fieldLearningApproval", "교외체험학습 신청·승인", "체험학습 > 신청·승인", "studentRecords", "fieldExperienceLearning", ["교외체험학습", "현장체험학습", "체험학습 신청서", "가정학습", "보고서"], ["office", "schoolLevel", "procedureStage", "evidence", "dateRange"], ["신청서", "보고서", "출결"], "체험학습 신청·승인·출결 처리"),
    intent("fieldTripSafety", "수학여행·수련활동 안전", "체험학습 > 수학여행·수련활동", "schoolSafety", "fieldExperienceLearning", ["수학여행", "수련활동", "숙박형 체험", "현장체험 안전", "인솔", "보험"], ["office", "schoolLevel", "procedureStage", "riskSignal", "evidence"], ["안전계획", "동의서"], "수학여행·수련활동 안전계획과 승인"),
    intent("dormitoryAssignment", "기숙사 배정·입퇴사", "기숙사 > 배정·입퇴사", "studentDiscipline", "dormitoryOperation", ["기숙사", "생활관", "입사", "퇴사", "호실", "배정", "외박", "점호", "벌점"], ["schoolLevel", "schoolRule", "procedureStage", "riskSignal", "evidence"], ["기숙사 운영규정"], "기숙사 운영규정과 배정·벌점·퇴사 절차"),
    intent("mealComplaint", "급식 민원", "급식 > 급식 민원", "schoolSafety", "schoolMealOperation", ["급식", "반찬", "식단", "급식 민원", "검식", "보존식", "급식소위원회"], ["schoolLevel", "procedureStage", "riskSignal", "evidence"], ["학교급식법", "급식운영"], "급식 민원 처리와 운영 기준"),
    intent("foodPoisoning", "식중독·급식 안전", "급식 > 식중독·위생", "schoolSafety", "schoolMealOperation", ["식중독", "복통", "구토", "설사", "급식 위생", "보존식", "역학조사"], ["schoolLevel", "procedureStage", "riskSignal", "evidence"], ["보건소", "보존식"], "식중독 의심 사안의 보고·보존·조치"),
    intent("afterSchoolInstructor", "방과후학교 강사 선정", "방과후·돌봄 > 강사 선정", "budgetExecution", "afterSchoolChildcare", ["방과후학교 강사", "강사 선정", "위탁강사", "제안서 평가", "방과후 계약"], ["office", "schoolLevel", "procedureStage", "evidence"], ["공고", "선정", "계약"], "방과후학교 강사 공고·선정·계약 절차"),
    intent("afterSchoolTuitionRefund", "방과후학교 수익자부담·환불", "방과후·돌봄 > 수익자부담·환불", "budgetExecution", "afterSchoolChildcare", ["방과후 수강료", "수익자부담", "환불", "자유수강권", "돌봄 수익자부담"], ["office", "schoolLevel", "spendingType", "procedureStage", "evidence"], ["환불", "정산"], "방과후학교 수강료·환불·정산"),
    intent("specialEducationIep", "특수교육 IEP·지원", "특수교육 > 개별화교육", "studentDiscipline", "specialEducationSupport", ["특수교육", "장애학생", "개별화교육", "IEP", "특수교육실무사", "통합교육"], ["targetSubject", "schoolLevel", "procedureStage", "evidence", "riskSignal"], ["개별화교육지원팀"], "특수교육대상자 지원과 개별화교육 절차"),
    intent("privacyDisclosure", "개인정보·정보공개", "개인정보·기록 > 공개·비공개", "studentRecords", "parentComplaintResponse", ["개인정보", "정보공개", "비공개", "CCTV", "녹음", "사진", "상담내용", "민감정보"], ["targetSubject", "procedureStage", "evidence", "riskSignal"], ["정보공개", "개인정보"], "개인정보·정보공개·기록 보존 판단"),
    intent("schoolSafetyAccident", "학교안전사고", "학교안전 > 사고보고·공제", "schoolSafety", "schoolSafetyHealth", ["학교안전사고", "다쳤", "골절", "응급", "119", "안전공제", "사고보고"], ["targetSubject", "schoolLevel", "procedureStage", "evidence", "riskSignal"], ["진단서", "사고보고"], "학교안전사고 보고와 안전공제"),
    intent("seriousAccidentPrevention", "중대재해·안전보건", "학교안전 > 중대재해·안전보건", "schoolSafety", "schoolSafetyHealth", ["중대재해", "안전보건", "위험성평가", "안전관리체계", "산업안전"], ["targetSubject", "procedureStage", "evidence", "riskSignal"], ["위험성평가", "안전보건"], "중대재해 예방·안전보건 관리체계"),
    intent("parentComplaint", "학부모 민원", "민원 > 학부모 민원", "studentDiscipline", "parentComplaintResponse", ["학부모 민원", "민원", "항의", "면담 요구", "사과 요구", "국민신문고", "교육청 민원"], ["targetSubject", "procedureStage", "evidence", "riskSignal"], ["답변서", "상담기록"], "학부모 민원 응대와 기록"),
    intent("academicAssessment", "평가·성적·부정행위", "평가 > 학업성적관리", "studentRecords", "assessmentAcademicManagement", ["시험", "평가", "성적", "부정행위", "이의신청", "채점", "수행평가"], ["schoolLevel", "schoolRule", "procedureStage", "evidence", "riskSignal"], ["학업성적관리규정"], "평가·성적·부정행위 처리"),
    intent("studentCouncilCommittee", "학교운영위원회·위원회", "학교운영 > 위원회·회의록", "schoolAdministration", "parentComplaintResponse", ["학교운영위원회", "위원회", "회의록", "심의", "자문", "위원 선출"], ["schoolLevel", "procedureStage", "evidence", "schoolRule"], ["회의록", "심의"], "위원회 운영·회의록·공개 기준"),
    intent("fieldTrainingOperation", "현장실습·표준협약", "특성화고·직업교육 > 현장실습 운영", "vocationalEducation", "vocationalFieldTrainingOperation", ["현장실습", "표준협약서", "실습협약", "선도기업", "참여기업", "현장실습 시간", "실습수당", "기업현장교사"], ["office", "schoolLevel", "vocationalProgram", "industryPartner", "procedureStage", "evidence", "riskSignal"], ["현장실습운영", "협약서", "안전점검"], "현장실습 협약·기업점검·학생 보호·실습수당 확인"),
    intent("apprenticeshipOperation", "도제학교·일학습병행", "특성화고·직업교육 > 도제학교·일학습병행", "vocationalEducation", "vocationalFieldTrainingOperation", ["도제학교", "일학습병행", "기업훈련", "훈련수당", "학습근로", "도제반"], ["office", "schoolLevel", "vocationalProgram", "industryPartner", "procedureStage", "evidence", "riskSignal"], ["도제학교", "훈련계약", "산학일체형"], "도제학교·일학습병행 운영과 기업훈련 확인"),
    intent("ncsCurriculum", "NCS·전문교과·학점제", "특성화고·교육과정 > NCS·전문교과", "curriculumAcademic", "vocationalCurriculumNcs", ["NCS", "엔씨에스", "전문교과", "실무과목", "직업계고학점제", "고교학점제", "교육과정", "공동교육과정"], ["office", "schoolLevel", "curriculumArea", "procedureStage", "evidence", "schoolRule"], ["교육과정", "성취기준", "학점"], "직업계고 교육과정·NCS·학점 이수 기준 확인"),
    intent("labEquipmentSafety", "실험실습실·기자재·안전", "특성화고·안전 > 실험실습실·기자재", "studentWelfareSafety", "labEquipmentPracticeSafety", ["실습실", "실험실습실", "기자재", "실습재료", "보호구", "MSDS", "화학물질", "위험기계", "장비"], ["schoolLevel", "facilityArea", "procedureStage", "evidence", "riskSignal", "schoolRule"], ["안전점검", "위험성평가", "보호구"], "실험실습실 안전·기자재·실습재료 관리 기준 확인"),
    intent("careerEmploymentGuidance", "취업지도·채용공고 검증", "특성화고·취업 > 취업지도·채용검증", "vocationalEducation", "careerEmploymentGuidance", ["취업지도", "추천채용", "고졸채용", "고졸 채용", "채용공고", "잡알리오", "공채", "졸업생 임금체불", "수습", "해고"], ["targetSubject", "vocationalProgram", "procedureStage", "evidence", "riskSignal"], ["잡알리오", "공식공고", "근로조건"], "채용정보 공식성·근로조건·취업지도 자료 교차 확인"),
    intent("admissionsTransferGraduation", "입학·전입학·학적·졸업", "교육과정·학사 > 입학·학적·졸업", "admissionsPathways", "admissionsTransferGraduation", ["입학전형", "특별전형", "특성화고특별전형", "재직자전형", "선취업후진학", "동일계전형", "대학진학", "전입학", "편입학", "재입학", "자퇴", "퇴학", "졸업", "학적", "위탁교육", "수료"], ["office", "schoolLevel", "curriculumArea", "procedureStage", "evidence"], ["학적", "졸업", "전입학", "특별전형", "재직자전형"], "입학·전입학·학적 변동·졸업·특성화고 진학 경로 확인"),
    intent("scholarshipWelfare", "장학·교육복지·수익자부담", "학생복지 > 장학·교육비·수익자부담", "studentWelfareSafety", "scholarshipWelfareSupport", ["장학금", "교육비지원", "교육비 지원", "교육급여", "수익자부담", "교복비", "기숙사비", "자유수강권", "환불", "통학비"], ["office", "schoolLevel", "welfareBenefit", "procedureStage", "evidence"], ["지원대상", "정산", "환불"], "장학·교육복지·수익자부담 신청·심사·정산 기준 확인"),
    intent("healthInfectionCounseling", "보건·감염병·상담", "학생복지·안전 > 보건·감염병·상담", "studentWelfareSafety", "healthInfectionCounseling", ["감염병", "등교중지", "보건실", "투약", "자살", "자해", "위기학생", "Wee", "상담기록", "정서행동"], ["targetSubject", "schoolLevel", "procedureStage", "evidence", "riskSignal"], ["보건", "상담", "위기학생"], "보건·감염병·학생상담·위기학생 대응 기준 확인"),
    intent("teacherRightsProtection", "교육활동 보호·교권", "교직원 보호 > 교육활동 침해", "staffProtection", "teacherRightsProtection", ["교권", "교육활동침해", "교육활동 보호", "교권보호위원회", "학부모 폭언", "악성민원", "아동학대 신고", "교원치유"], ["targetSubject", "procedureStage", "evidence", "riskSignal"], ["교권", "민원", "보호조치"], "교육활동 침해·악성민원·교직원 보호 절차 확인"),
    intent("facilityDigitalSecurity", "시설·정보화·개인정보", "시설·정보화 > 시설·CCTV·개인정보", "facilityDigital", "facilityDigitalSecurity", ["시설공사", "석면", "소방", "CCTV", "영상정보", "개인정보", "나이스", "NEIS", "K-에듀파인", "에듀파인", "정보보안", "스마트기기", "와이파이"], ["facilityArea", "dataSystem", "procedureStage", "evidence", "riskSignal"], ["개인정보", "시설안전", "접근권한"], "시설안전·정보보안·개인정보·CCTV 처리 기준 확인"),
    intent("governanceCommitteeRule", "학교운영위원회·규정개정", "학교운영 > 위원회·규정개정", "governanceRecords", "governanceCommitteeRule", ["학교운영위원회", "운영위원회", "규정개정", "학칙개정", "회의록", "심의", "자문", "학부모회", "위원 선출"], ["schoolLevel", "procedureStage", "evidence", "schoolRule"], ["회의록", "공개", "심의"], "학교운영위원회·위원회·규정개정·회의록 공개 기준 확인"),
    intent("vocationalJobInfo", "고졸 채용정보 검증", "직업계고 > 채용정보 검증", "vocationalEducation", "careerEmploymentGuidance", ["고졸채용", "고졸 채용", "잡알리오", "취업지원센터", "공채", "채용공고"], ["targetSubject", "vocationalProgram", "procedureStage", "evidence", "riskSignal"], ["잡알리오", "공식공고"], "고졸 채용정보의 공식 공고 교차 검증")
  ];

  const typoAliases = [
    ["몇일", "며칠"],
    ["일수", "일수"],
    ["강사비", "강사료"],
    ["강의비", "강사료"],
    ["생기부", "생활기록부"],
    ["학폭", "학교폭력"],
    ["휴대폰", "휴대전화"],
    ["관내", "근무지내"],
    ["관외", "근무지외"],
    ["경조사", "경조사휴가"]
  ];

  function intent(code, label, path, categoryCode, domainCode, aliases, requiredSlots, hints, summary) {
    return { code, label, path, categoryCode, domainCode, aliases, requiredSlots, hints, summary };
  }

  function classify(question = "", options = {}) {
    const normalized = normalize(question);
    const engineDomain = options.engineFrame?.domainCode || "";
    const matched = intents
      .map((entry) => scoreIntent(entry, normalized, engineDomain))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 8);

    return matched.map((candidate, index) => {
      const domainAligned = engineDomain && engineDomain === candidate.domainCode;
      const confidence = Math.min(
        0.97,
        Math.max(domainAligned ? 0.78 : 0.35, candidate.score / (domainAligned ? 18 : 26))
      );
      return {
        code: candidate.code,
        label: candidate.label,
        path: candidate.path,
        categoryCode: candidate.categoryCode,
        domainCode: candidate.domainCode,
        summary: candidate.summary,
        reason: buildReason(candidate),
        confidence: index === 0 ? confidence : Math.min(confidence, 0.86),
        needsConfirmation: confidence < 0.74,
        requiredSlots: candidate.requiredSlots || [],
        queries: buildQueries(candidate),
        taxonomyVersion: VERSION
      };
    });
  }

  function buildSlotQuestions(context = {}) {
    const question = context.question || "";
    const normalized = normalize(question);
    const frame = context.frame || {};
    const primaryCode = context.intentCode || classify(question, { engineFrame: frame, limit: 1 })[0]?.code || "";
    const entry = intents.find((item) => item.code === primaryCode)
      || intents.find((item) => item.domainCode === frame.domainCode)
      || null;
    if (!entry) return [];

    return (entry.requiredSlots || [])
      .filter((slotKey) => !isSlotPresent(slotKey, normalized, frame, context))
      .map((slotKey) => ({ slotKey, ...(slots[slotKey] || buildFallbackSlot(slotKey)) }));
  }

  function scoreIntent(entry, normalized, engineDomain = "") {
    let score = 0;
    let lexicalScore = 0;
    const matchedAliases = [];
    for (const alias of entry.aliases || []) {
      const key = normalize(alias);
      if (key && normalized.includes(key)) {
        matchedAliases.push(alias);
        const weight = Math.max(4, key.length);
        lexicalScore += weight;
        score += weight;
      }
    }
    for (const [wrong, right] of typoAliases) {
      if (normalized.includes(normalize(wrong)) && (entry.aliases || []).some((alias) => normalize(alias).includes(normalize(right)))) {
        lexicalScore += 3;
        score += 3;
      }
    }
    for (const hint of entry.hints || []) {
      const key = normalize(hint);
      if (key && normalized.includes(key)) {
        lexicalScore += 2;
        score += 2;
      }
    }
    if (lexicalScore <= 0) return { ...entry, score: 0, matchedAliases };
    if (isContextuallyExcluded(entry.code, normalized, matchedAliases)) {
      return { ...entry, score: 0, matchedAliases };
    }
    if (engineDomain && engineDomain === entry.domainCode) score += 8;
    if (matchedAliases.length >= 2) score += 5;

    return { ...entry, score, matchedAliases };
  }

  function isContextuallyExcluded(code = "", normalized = "", matchedAliases = []) {
    if (code === "spouseChildbirthLeave" && !/출산|배우자출산휴가/.test(normalized)) return true;
    if (code === "childbirthSpecialLeave" && /(?:배우자|남편|아내|남자|남성|아빠|아버지|부친).{0,24}출산|출산.{0,24}(?:배우자|남편|아내|남자|남성|아빠|아버지|부친)/.test(normalized)) return true;
    if (code === "bereavementLeave" && /출산/.test(normalized) && !/사망|상례|장례|부고|별세|부모상|배우자상|자녀상|조부모상|형제상|자매상/.test(normalized)) return true;
    if (code === "bereavementLeave"
      && /학생|재학생|고등학생|중학생|초등학생|특성화고생/.test(normalized)
      && /사망|상례|장례|부고|별세|부모상|가족상/.test(normalized)
      && /휴가|결석|출결|출석인정|인정결석|결석계|상고결석/.test(normalized)) return true;
    if (code === "attendanceTime") {
      const travelDominant = /출장|관외출장|관내출장|여비|일비|식비|숙박비|운임/.test(normalized);
      const attendanceSpecific = /무단외출|외출신청|외출처리|근무상황외출|지각|조퇴/.test(normalized);
      const negatedAttendance = /외출(?:처리)?(?:가|는|은)?아니|외출아님|외출이아니/.test(normalized);
      if ((travelDominant && !attendanceSpecific) || negatedAttendance) return true;
    }
    if (code === "domesticTravelExpense" && /출장(?:이|은|는)?아니|여비(?:가|는)?아니/.test(normalized)) return true;
    if (code === "foodPoisoning" && /식중독(?:은|는)?없|식중독아니|식중독의심(?:은|은)?없|구토(?:는)?없|설사(?:는)?없/.test(normalized)) return true;
    if (code === "mealComplaint" && /식중독의심|구토|설사|복통|보건소|역학조사/.test(normalized) && !/반찬|식단|민원/.test(normalized)) return true;
    if (code === "instructorHonorarium" && /방과후학교강사선정|강사선정|제안서평가|위탁강사공고/.test(normalized) && !/강사비|강사료|강의비|강사수당|단가/.test(normalized)) return true;
    if (code === "afterSchoolInstructor" && /강사비|강사료|강의비|강사수당|단가/.test(normalized) && !/방과후|늘봄|돌봄/.test(normalized)) return true;
    if (matchedAliases.length === 0 && ["spouseChildbirthLeave", "annualLeave", "sickLeave", "officialLeave", "attendanceTime"].includes(code)) return true;
    return false;
  }

  function buildReason(candidate) {
    const matched = candidate.matchedAliases?.length
      ? `일치 표현: ${candidate.matchedAliases.slice(0, 3).join(", ")}`
      : "질문 속 도메인·업무 단계 신호가 일치했습니다.";
    return `${candidate.path} 후보입니다. ${matched}`;
  }

  function buildQueries(candidate) {
    return [
      `${candidate.label} ${candidate.path}`,
      ...(candidate.hints || []).slice(0, 3).map((hint) => `${candidate.label} ${hint}`)
    ];
  }

  function isSlotPresent(slotKey, normalized, frame = {}, context = {}) {
    const slotValue = frame.slots?.[slotKey];
    if (isFilled(slotValue)) return true;

    if (slotKey === "office") {
      return context.officeCode && context.officeCode !== "auto" || /서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주/.test(normalized);
    }
    if (slotKey === "targetSubject") return /학생|학부모|보호자|교사|교원|선생님|교장|교감|행정직|행정실|교육공무직|공무직|기간제|강사|직원|학교장|졸업생|졸업예정자|기업|산업체|취업부|현장실습담당|도제담당/.test(normalized);
    if (slotKey === "employmentType") return /정규|공립|사립|기간제|계약제|교육공무직|공무직|지방공무원|행정직|강사/.test(normalized);
    if (slotKey === "familyRelation") return /배우자|부모|자녀|아들|딸|장인|장모|시부|시모|조부모|형제|자매|삼촌|이모|고모/.test(normalized);
    if (slotKey === "serviceIssue") return /연가|연차|병가|공가|특별휴가|경조사|출산|지각|조퇴|외출|초과근무|복무/.test(normalized);
    if (slotKey === "dateRange") return /\d+개월|\d+년|\d+일|\d+박|20\d{2}|당일|오늘|내일|이번/.test(normalized);
    if (slotKey === "expenseItems") return /일비|식비|숙박비|운임|교통비|출장비|여비/.test(normalized);
    if (slotKey === "destination") return /출장지|서울|부산|대구|인천|광주|대전|울산|세종|경주|진해|남해|제주|시|군|구|관외|관내|근무지/.test(normalized);
    if (slotKey === "fiscalYear") return /20\d{2}학년도|20\d{2}년도|올해|금년|이번학년도|해당학년도/.test(normalized);
    if (slotKey === "spendingType") return /강사|업무추진비|물품|용역|공사|계약|검수|지출|정산|수익자부담|예산|기자재|실습재료|장학금|교육비/.test(normalized);
    if (slotKey === "procedureStage") return /신청|승인|접수|조사|심의|통지|정정|지출|집행|정산|계약|검수|처리|대응|공고|선정|점검|협약|배정|편성|기록|공개|채용|추천|전형/.test(normalized);
    if (slotKey === "evidence") return /증빙|서류|자료|진단서|신청서|보고서|회의록|영수증|전표|공문|상담|사진|cctv|녹음|나이스|neis|결재|협약서|계약서|점검표|출근부|근로계약|공고문/.test(normalized);
    if (slotKey === "schoolRule") return /규정|학칙|학교생활규정|기숙사운영규정|학업성적관리규정|급식|생활지도|현장실습운영|실습협약|표준협약|교육과정|실습실|안전관리|교권|운영위원회/.test(normalized);
    if (slotKey === "riskSignal") return /안전|위험|사고|인권|차별|개인정보|학교폭력|학폭|아동학대|감사|민원|소송|고소|고발|식중독|임금체불|해고|부당|자살|자해|화학물질|msds|보호구|석면|정보보안|개인정보유출/.test(normalized);
    if (slotKey === "instructorProfile") return /교장|교감|교사|장학관|장학사|전임강사|교수|전문가|강사등급|특별강사|일반강사/.test(normalized);
    if (slotKey === "lectureDuration") return /\d+시간|시간당|초과시간|기본시간|회당/.test(normalized);
    if (slotKey === "vocationalProgram") return /현장실습|도제학교|일학습병행|기업훈련|ncs|엔씨에스|전문교과|실무과목|직업계고학점제|고교학점제|취업지도|추천채용|고졸채용|잡알리오|글로벌현장학습/.test(normalized);
    if (slotKey === "industryPartner") return /선도기업|참여기업|실습기업|현장실습기업|기업현장교사|채용기관|산업체|기업|회사|사업장/.test(normalized);
    if (slotKey === "curriculumArea") return /ncs|엔씨에스|전문교과|실무과목|고교학점제|직업계고학점제|학점|학적|졸업|수료|전입학|편입학|재입학|자퇴|위탁교육|공동교육과정|평가|성적/.test(normalized);
    if (slotKey === "welfareBenefit") return /장학금|장학생|교육급여|교육비|저소득|수익자부담|환불|자유수강권|기숙사비|급식비|통학비|교복비|교과서/.test(normalized);
    if (slotKey === "facilityArea") return /실습실|실험실습실|실험실|기자재|실습재료|장비|공구|급식실|조리실|기숙사|생활관|시설공사|석면|소방|전기|안전점검|정보화기기|스마트기기|태블릿|노트북|와이파이|cctv|영상정보/.test(normalized);
    if (slotKey === "dataSystem") return /나이스|neis|k-?에듀파인|에듀파인|개인정보|영상정보|cctv|정보공개|민감정보|계정|비밀번호|정보보안|접근권한|권한부여|스마트기기|태블릿|와이파이/.test(normalized);
    return false;
  }

  function isFilled(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (!value) return false;
    if (typeof value === "object") {
      if (value.code === "unknown") return false;
      if (value.label === "지역 미특정") return false;
      if (Object.prototype.hasOwnProperty.call(value, "detected")) return Boolean(value.detected);
      return Object.keys(value).length > 0;
    }
    return String(value).trim().length > 0;
  }

  function buildFallbackSlot(slotKey) {
    return {
      label: slotKey,
      question: `${slotKey} 정보를 추가로 입력해 주세요.`,
      reason: "정확한 규정 조회를 위해 필요한 항목입니다.",
      placeholder: "알고 있는 범위만 적어 주세요."
    };
  }

  function normalize(value = "") {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  return {
    version: VERSION,
    slots,
    intents,
    stats: {
      intentCount: intents.length,
      slotCount: Object.keys(slots).length,
      aliasCount: intents.reduce((sum, item) => sum + (item.aliases || []).length, 0)
    },
    classify,
    buildSlotQuestions
  };
});
