const form = document.querySelector("#queryForm");
const questionInput = document.querySelector("#question");
const resultState = document.querySelector("#resultState");
const resultPanel = document.querySelector(".result-panel");
const queryPanel = document.querySelector(".query-panel");
const workspace = document.querySelector(".workspace");
const resultTitle = document.querySelector(".result-head h2");
const statusDot = document.querySelector(".status-dot");
const toolTabs = document.querySelectorAll("[data-tool-tab]");
const toolPanels = document.querySelectorAll("[data-tool-panel]");
const toolLinks = document.querySelectorAll("[data-tool-link]");
const topicTypeInput = document.querySelector("#topicType");
const topicMajorInput = document.querySelector("#topicMajor");
const topicMiddleInput = document.querySelector("#topicMiddle");
const topicMinorInput = document.querySelector("#topicMinor");
const answerModeInput = document.querySelector("#answerMode");
const userRoleInput = document.querySelector("#userRole");
const partyRoleInput = document.querySelector("#partyRole");
const policyOfficeInput = document.querySelector("#policyOffice");
const policyRoleInput = document.querySelector("#policyRole");
const policyCategoryInput = document.querySelector("#policyCategory");
const resetQuestionButton = document.querySelector("#resetQuestionButton");
const guideForm = document.querySelector("#guideForm");
const guideQuestionInput = document.querySelector("#guideQuestion");
const guideOfficeInput = document.querySelector("#guideOffice");
const guideRoleInput = document.querySelector("#guideRole");
const guideCategoryInput = document.querySelector("#guideCategory");
const guideResult = document.querySelector("#guideResult");
const guideStatus = document.querySelector(".guide-status");
const guideResultTitle = document.querySelector(".guide-result-panel .result-head h2");
const resetGuideButton = document.querySelector("#resetGuideButton");
const REPORT_LIBRARY_KEY = "gyo6LawInfoReportLibrary";
const AI_USAGE_LEDGER_KEY = "gyo6LawInfoAiUsageLedger";
const LOCAL_COST_CONTROL = {
  monthlyWarnUsd: 10,
  monthlyStopUsd: 20,
  dailyCallLimit: 30,
  krwPerUsd: 1500,
  pricingDate: "2026-06-13"
};
let currentReportDraft = null;
let currentCaseId = "";
let currentLiveSourceData = null;
let skipNextAutoScroll = false;
let currentQuestionFingerprint = "";
let activeAiController = null;
let activeSourceController = null;
let activeLocalLlmController = null;
let activeGuideLocalLlmController = null;
let guideAutoRenderTimer = null;
let currentGuideQuestionFingerprint = "";
let userSelectedTool = false;

const roleGuides = {
  auto: {
    label: "상황 중심",
    advice: "질문 속 대상과 기관을 먼저 나누고, 법령 원문과 공식 자료를 함께 확인하는 흐름으로 정리합니다."
  },
  student: {
    label: "학생 관점",
    advice: "권리 보호, 안전, 근로조건, 학교에 요청할 자료를 쉬운 말로 먼저 정리합니다."
  },
  teacher: {
    label: "선생님 관점",
    advice: "상담 기록, 지도 절차, 학교 규정, 교육청 안내와 함께 확인할 원문을 정리합니다."
  },
  parent: {
    label: "학부모 관점",
    advice: "절차 이해, 학교와의 소통, 학생 보호를 중심으로 확인할 자료를 정리합니다."
  },
  principal: {
    label: "학교 관리자 관점",
    advice: "학교 운영, 안전관리, 민원 대응, 교직원·행정직 관리에 필요한 기준을 나누어 확인합니다."
  },
  staff: {
    label: "행정직원 관점",
    advice: "계약, 복무, 기록, 행정절차와 관련된 법령과 공식 지침을 우선 확인합니다."
  }
};

const partyGuides = {
  auto: {
    label: "상황에서 판단",
    advice: "질문 내용에서 실제 권리·의무가 문제 되는 당사자를 먼저 분리합니다."
  },
  student: {
    label: "학생",
    advice: "학생 보호, 권익 침해 여부, 학교와 기업의 조치 기준을 우선 확인합니다."
  },
  teacher: {
    label: "교사",
    advice: "교사의 지도·기록·보고 책임과 개인 권리 보호 지점을 함께 확인합니다."
  },
  parent: {
    label: "학부모",
    advice: "보호자 안내, 학교와의 소통, 학생 보호 절차를 중심으로 확인합니다."
  },
  principal: {
    label: "학교 관리자",
    advice: "학교 차원의 판단, 기록, 민원 대응, 보고 필요성을 우선 정리합니다."
  },
  staff: {
    label: "교직원·행정직원",
    advice: "복무, 근로관계, 업무분장, 민원 대응 기준을 구분해 확인합니다."
  },
  company: {
    label: "실습기업·사업장",
    advice: "산업체의 지시 권한, 안전·보호 의무, 현장실습 계약 범위를 확인합니다."
  },
  multiple: {
    label: "여러 주체",
    advice: "학생·학교·기업·보호자 등 주체별 사실관계와 조치 순서를 나눕니다."
  }
};

const sourceCatalog = {
  law: {
    label: "법령 원문",
    source: "국가법령정보센터",
    reason: "적용 기준과 조문을 확인하는 가장 기본 자료입니다."
  },
  admin: {
    label: "행정자료",
    source: "교육부·교육청",
    reason: "학교 현장에서 실제 절차를 운영할 때 필요한 공식 안내입니다."
  },
  case: {
    label: "판례·법률자료",
    source: "국회법률도서관·법원 판례 검색",
    reason: "비슷한 분쟁에서 어떤 기준이 다루어졌는지 공식 자료 후보로 확인합니다."
  },
  safety: {
    label: "안전 자료",
    source: "고용노동부·안전보건공단",
    reason: "현장실습, 중대재해, 안전사고에서는 예방·조치 기준을 함께 확인해야 합니다."
  },
  expert: {
    label: "전문가 확인",
    source: "변호사·노무사·교육청 담당 부서",
    reason: "사실관계에 따라 판단이 달라질 수 있는 사안은 전문가 확인이 필요합니다."
  }
};

const sourcePlanByTopic = {
  employment: ["law", "admin", "case", "expert"],
  apprenticeship: ["admin", "law", "safety", "case", "expert"],
  fieldTraining: ["admin", "law", "safety", "case", "expert"],
  overseasTraining: ["admin", "law", "expert"],
  schoolSafety: ["safety", "law", "admin", "case", "expert"],
  schoolViolence: ["admin", "law", "case", "expert"],
  schoolAdministration: ["admin", "law", "case", "expert"],
  staffLabor: ["law", "admin", "case", "expert"],
  civilComplaint: ["admin", "law", "case", "expert"],
  general: ["law", "admin", "case", "expert"]
};

const educationOfficeCatalog = [
  { code: "auto", label: "교육청 미선택", homepage: "https://www.moe.go.kr/main.do?s=moe", domain: "moe.go.kr" },
  { code: "seoul", label: "서울특별시교육청", homepage: "https://www.sen.go.kr", domain: "sen.go.kr" },
  {
    code: "busan",
    label: "부산광역시교육청",
    homepage: "https://www.pen.go.kr",
    domain: "pen.go.kr",
    budgetGuide: {
      title: "2026학년도 공립 유·초·중·고·특수학교 학교회계 예산편성 기본지침",
      url: "https://www.pen.go.kr/upload/main/na/bbs_2461/ntt_1152443/doc_d843vf4ef%3D32v89%3D46vab%3D9cvf4%3D9fc1ve75fve1fe_v2567.pdf",
      status: "직접 연결"
    }
  },
  { code: "daegu", label: "대구광역시교육청", homepage: "https://www.dge.go.kr", domain: "dge.go.kr" },
  {
    code: "incheon",
    label: "인천광역시교육청",
    homepage: "https://www.ice.go.kr",
    domain: "ice.go.kr",
    budgetGuide: {
      title: "2026년도 인천광역시 교육비특별회계 예산편성 기본지침",
      url: "https://www.ice.go.kr/arc/ad/func/ppm/selectPpmInfo.do?mi=10644&pblictnSn=3001563",
      status: "직접 연결"
    }
  },
  {
    code: "gwangju",
    label: "광주광역시교육청",
    homepage: "https://www.gen.go.kr",
    domain: "gen.go.kr",
    budgetGuide: {
      title: "2026학년도 학교회계 예산편성 기본지침",
      url: "https://www.gen.go.kr/xboard/board.php?keyset=con_sub&mode=view&number=455196&page=1&sCat=0&searchword=%ED%95%99%EA%B5%90%ED%9A%8C%EA%B3%84&tbnum=340",
      status: "직접 연결"
    }
  },
  { code: "daejeon", label: "대전광역시교육청", homepage: "https://www.dje.go.kr", domain: "dje.go.kr" },
  {
    code: "ulsan",
    label: "울산광역시교육청",
    homepage: "https://www.use.go.kr",
    domain: "use.go.kr",
    budgetGuide: {
      title: "2026학년도 학교회계 예산편성 기본지침",
      url: "https://use.go.kr/usgbe/user/bbs/BD_selectBbs.do?q_bbsDocNo=20260326104644369&q_bbsSn=1345",
      status: "교육지원청 직접 연결"
    }
  },
  { code: "sejong", label: "세종특별자치시교육청", homepage: "https://www.sje.go.kr", domain: "sje.go.kr" },
  { code: "gyeonggi", label: "경기도교육청", homepage: "https://www.goe.go.kr", domain: "goe.go.kr" },
  {
    code: "gangwon",
    label: "강원특별자치도교육청",
    homepage: "https://www.gwe.go.kr",
    domain: "gwe.go.kr",
    budgetGuide: {
      title: "2026년도 학교회계 예산편성 기본지침",
      url: "https://www.gwe.go.kr/main/bbs/view.do?bbsSn=46704&key=m2307211198550",
      status: "직접 연결"
    }
  },
  { code: "chungbuk", label: "충청북도교육청", homepage: "https://www.cbe.go.kr", domain: "cbe.go.kr" },
  { code: "chungnam", label: "충청남도교육청", homepage: "https://www.cne.go.kr", domain: "cne.go.kr" },
  {
    code: "jeonbuk",
    label: "전북특별자치도교육청",
    homepage: "https://www.jbe.go.kr",
    domain: "jbe.go.kr",
    budgetGuide: {
      title: "2026학년도 학교회계 예산편성 및 운영지침",
      url: "https://www.jbe.go.kr/board/view.jbe?boardId=BBS_0000191&categoryCode1=H&categoryCode2=H_01%2CH_02&dataSid=929936&keyword=%ED%95%99%EA%B5%90%ED%9A%8C%EA%B3%84&menuCd=DOM_000000707003000000&orderBy=REGISTER_DATE%3ADESC&paging=ok&searchOperation=AND&searchType=DATA_TITLE&startPage=1",
      status: "직접 연결"
    }
  },
  {
    code: "jeonnam",
    label: "전라남도교육청",
    homepage: "https://www.jne.go.kr",
    domain: "jne.go.kr",
    budgetGuide: {
      title: "2026학년도 학교회계 예산편성 기본지침",
      url: "https://www.jne.go.kr/upload/open/na/bbs_297/ntt_5160586/doc_ef0fa7d7-1e2f-4498-9c8a-cb1350824da41764a2269b52222.pdf",
      status: "직접 연결"
    }
  },
  {
    code: "gyeongbuk",
    label: "경상북도교육청",
    homepage: "https://www.gbe.kr",
    domain: "gbe.kr",
    budgetGuide: {
      title: "2026학년도 공립학교회계 예산편성 기본지침",
      url: "https://www.gbe.kr/main/na/ntt/selectNttInfo.do?mi=3372&bbsId=1852&nttSn=1564258",
      status: "공식 게시글 직접 연결"
    }
  },
  {
    code: "gyeongnam",
    label: "경상남도교육청",
    homepage: "https://www.gne.go.kr",
    domain: "gne.go.kr",
    budgetGuide: {
      title: "2026학년도 학교회계 예산편성 기본지침",
      url: "https://www.gne.go.kr/user/bbs/BD_selectBbs.do?q_bbsDocNo=20251125132734237&q_bbsSn=1286",
      status: "직접 연결"
    }
  },
  { code: "jeju", label: "제주특별자치도교육청", homepage: "https://www.jje.go.kr", domain: "jje.go.kr" }
];

const policySourceCatalog = {
  teacherLeave: {
    title: "교원휴가에 관한 예규",
    source: "국가법령정보센터·교육부",
    url: "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulId=20578&efYd=0",
    query: "교원휴가에 관한 예규",
    note: "공립 교원의 연가·병가·공가·특별휴가 처리 기준"
  },
  nationalService: {
    title: "국가공무원 복무규정",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EA%B5%AD%EA%B0%80%EA%B3%B5%EB%AC%B4%EC%9B%90%20%EB%B3%B5%EB%AC%B4%EA%B7%9C%EC%A0%95",
    query: "국가공무원 복무규정 제20조 별표2 경조사별 휴가 일수표",
    note: "국가공무원 복무와 경조사 특별휴가 공통 기준"
  },
  localService: {
    title: "지방공무원 복무규정",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EC%A7%80%EB%B0%A9%EA%B3%B5%EB%AC%B4%EC%9B%90%20%EB%B3%B5%EB%AC%B4%EA%B7%9C%EC%A0%95",
    query: "지방공무원 복무규정 특별휴가 경조사휴가",
    note: "교육감 소속 지방공무원·행정직 복무 기준"
  },
  travelExpense: {
    title: "공무원 여비 규정",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsInfoP.do?lsId=009402&urlMode=lsInfoP",
    query: "공무원 여비 규정 별표1 별표2 별표9 출장 숙박비",
    note: "출장명령, 운임·숙박비·일비, 여비 지급등급과 증빙 기준"
  },
  schoolAccountingRule: {
    title: "국립 유치원 및 초·중등학교 회계규칙",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=210514",
    query: "국립 유치원 및 초·중등학교 회계규칙",
    note: "학교회계 예산·수입·지출·출납·검수 공통 기준"
  },
  localContract: {
    title: "지방자치단체를 당사자로 하는 계약에 관한 법률",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EC%A7%80%EB%B0%A9%EC%9E%90%EC%B9%98%EB%8B%A8%EC%B2%B4%EB%A5%BC%20%EB%8B%B9%EC%82%AC%EC%9E%90%EB%A1%9C%20%ED%95%98%EB%8A%94%20%EA%B3%84%EC%95%BD%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0",
    query: "지방자치단체를 당사자로 하는 계약에 관한 법률 수의계약 검수",
    note: "물품·용역·공사 계약과 검수 기준 보조 자료"
  },
  schoolRecordGuide: {
    title: "2026학년도 학교생활기록부 기재요령",
    source: "학교생활기록부 종합지원포털",
    url: "https://star.moe.go.kr/web/contents/m21100.do",
    query: "2026학년도 학교생활기록부 기재요령 고등학교",
    note: "당해 학년도 학생부 기재·출결·정정 세부 기준"
  },
  schoolRecordRule: {
    title: "학교생활기록 작성 및 관리지침",
    source: "국가법령정보센터·교육부",
    url: "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000188164",
    query: "학교생활기록 작성 및 관리지침",
    note: "학교생활기록 작성·관리·정정 권한과 절차"
  },
  schoolViolenceGuide2025: {
    title: "2025년 학교폭력 사안처리 가이드북",
    source: "교육부·시도교육청",
    url: "https://www.cbe.go.kr/dept-21/na/ntt/selectNttInfo.do?mi=11221&nttSn=1548192",
    query: "2025년 학교폭력 사안처리 가이드북",
    note: "학교폭력 신고·접수·조사·심의·조치 단계별 현장 지침"
  },
  publicRecords: {
    title: "공공기록물 관리에 관한 법률",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EA%B3%B5%EA%B3%B5%EA%B8%B0%EB%A1%9D%EB%AC%BC%20%EA%B4%80%EB%A6%AC%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0",
    query: "공공기록물 관리에 관한 법률 학교 회의록 보존",
    note: "공문·회의록·증빙자료 보존 체계 확인"
  },
  infoDisclosure: {
    title: "공공기관의 정보공개에 관한 법률",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EA%B3%B5%EA%B3%B5%EA%B8%B0%EA%B4%80%EC%9D%98%20%EC%A0%95%EB%B3%B4%EA%B3%B5%EA%B0%9C%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0",
    query: "공공기관의 정보공개에 관한 법률 비공개 개인정보 학교",
    note: "정보공개 청구와 비공개·부분공개 판단"
  },
  laborStandard: {
    title: "근로기준법",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EA%B7%BC%EB%A1%9C%EA%B8%B0%EC%A4%80%EB%B2%95",
    query: "근로기준법 휴가 근로조건 취업규칙",
    note: "교육공무직·계약직 근로관계 기본 기준"
  },
  fixedTermAct: {
    title: "기간제 및 단시간근로자 보호 등에 관한 법률",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EA%B8%B0%EA%B0%84%EC%A0%9C%20%EB%B0%8F%20%EB%8B%A8%EC%8B%9C%EA%B0%84%EA%B7%BC%EB%A1%9C%EC%9E%90%20%EB%B3%B4%ED%98%B8%20%EB%93%B1%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0",
    query: "기간제 및 단시간근로자 보호 등에 관한 법률 학교 계약직",
    note: "기간제·단시간 근로자 차별·계약기간 쟁점"
  },
  educationWorkerWorkRules: {
    title: "소속 교육청 교육공무직원 취업규칙·단체협약",
    source: "시도교육청",
    url: "",
    query: "교육공무직원 취업규칙 단체협약 복무 휴가 연차",
    note: "교육공무직 복무·휴가·연차는 교육청별 취업규칙과 단체협약 원문을 확인해야 합니다.",
    status: "교육청 선택 필요",
    linkLabel: "교육청 선택 후 공식 자료실 검색"
  },
  fixedTermTeacherGuideline: {
    title: "소속 교육청 계약제교원 운영 지침",
    source: "시도교육청",
    url: "",
    query: "계약제교원 운영 지침 기간제교사 연가 병가 복무",
    note: "기간제교사 복무·연가·병가는 교육청 계약제교원 지침과 근로계약서를 우선 대조합니다.",
    status: "교육청 선택 필요",
    linkLabel: "교육청 선택 후 공식 자료실 검색"
  },
  privateSchoolWorkRules: {
    title: "학교법인 취업규칙·복무규정·근로계약",
    source: "학교법인·학교",
    url: "",
    query: "사립학교 교직원 교원 취업규칙 복무규정 근로계약 병가 휴가 연차",
    note: "사립학교는 학교법인 취업규칙, 복무규정, 단체협약, 근로계약이 직접 적용 기준이 될 수 있습니다.",
    status: "학교·법인 원문 확인 필요",
    linkLabel: "학교·법인 자료로 확인"
  },
  studentGuidanceRule: {
    title: "학생생활지도·학생생활규정",
    source: "교육부·시도교육청·학교규정",
    url: "",
    query: "학생생활지도 고시 학생생활규정 학칙 휴대전화 생활지도",
    note: "학급관리, 생활지도, 학생 인권, 학교생활규정 확인",
    status: "학교·교육청 원문 확인 필요",
    linkLabel: "학교·교육청 자료로 확인"
  },
  fieldExperienceGuide: {
    title: "현장체험학습·교외체험학습 운영 지침",
    source: "시도교육청",
    url: "",
    query: "교외체험학습 현장체험학습 운영 지침 신청서 보고서 출결",
    note: "체험학습 신청, 승인, 안전계획, 출결·학생부 처리 기준",
    status: "교육청 선택 필요",
    linkLabel: "교육청 선택 후 공식 자료실 검색"
  },
  schoolMealAct: {
    title: "학교급식법 및 급식 운영 기준",
    source: "국가법령정보센터·교육부·시도교육청",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%ED%95%99%EA%B5%90%EA%B8%89%EC%8B%9D%EB%B2%95",
    query: "학교급식법 급식 위생 식중독 알레르기 보존식",
    note: "급식 운영, 위생, 알레르기, 보존식, 급식 민원 기준"
  },
  schoolSafetyAct: {
    title: "학교안전사고 예방 및 보상에 관한 법률",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%ED%95%99%EA%B5%90%EC%95%88%EC%A0%84%EC%82%AC%EA%B3%A0%20%EC%98%88%EB%B0%A9%20%EB%B0%8F%20%EB%B3%B4%EC%83%81%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0",
    query: "학교안전사고 예방 및 보상 학교 사고보고 안전공제",
    note: "학교 안전사고, 응급조치, 사고보고, 안전공제 처리 기준"
  },
  specialEducationAct: {
    title: "장애인 등에 대한 특수교육법",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EC%9E%A5%EC%95%A0%EC%9D%B8%20%EB%93%B1%EC%97%90%20%EB%8C%80%ED%95%9C%20%ED%8A%B9%EC%88%98%EA%B5%90%EC%9C%A1%EB%B2%95",
    query: "장애인 등에 대한 특수교육법 개별화교육 특수교육대상자 지원",
    note: "특수교육대상자, 개별화교육계획, 통합교육, 지원인력 기준"
  },
  vocationalEducationAct: {
    title: "직업교육훈련 촉진법",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EC%A7%81%EC%97%85%EA%B5%90%EC%9C%A1%ED%9B%88%EB%A0%A8%20%EC%B4%89%EC%A7%84%EB%B2%95",
    query: "직업교육훈련 촉진법 현장실습 표준협약서 현장실습 시간",
    note: "직업계고 현장실습, 표준협약, 학생 보호, 실습시간 기준"
  },
  fieldTrainingManual: {
    title: "직업계고 현장실습 운영 매뉴얼·교육부 지침",
    source: "교육부·시도교육청",
    url: "",
    query: "직업계고 현장실습 운영 매뉴얼 선도기업 표준협약서",
    note: "선도기업, 실습협약, 실습생 보호, 현장실습 중단·복교 절차",
    status: "공식 매뉴얼 검색",
    linkLabel: "교육부·교육청 공식자료 검색"
  },
  apprenticeshipGuide: {
    title: "산학일체형 도제학교·일학습병행 운영 지침",
    source: "교육부·고용노동부·한국산업인력공단",
    url: "",
    query: "산학일체형 도제학교 일학습병행 운영 지침 학생 보호",
    note: "기업훈련, 훈련시간, 훈련수당, 학습근로자 보호 기준",
    status: "공식 지침 검색",
    linkLabel: "공식자료 검색"
  },
  nationalCurriculum: {
    title: "초·중등학교 교육과정 및 고교학점제 지침",
    source: "교육부",
    url: "",
    query: "초중등학교 교육과정 고교학점제 직업계고 전문교과",
    note: "전문교과, 보통교과, 학점·이수 기준, 공동교육과정"
  },
  vocationalCurriculumGuide: {
    title: "직업계고 교육과정·NCS 실무과목 운영 지침",
    source: "교육부·시도교육청",
    url: "",
    query: "직업계고 교육과정 NCS 실무과목 학점제 지침",
    note: "NCS 실무과목, 전문교과 편성, 실습 평가와 학생부 연계"
  },
  industrialSafetyAct: {
    title: "산업안전보건법 및 실습실 안전관리 기준",
    source: "국가법령정보센터·안전보건공단",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EC%82%B0%EC%97%85%EC%95%88%EC%A0%84%EB%B3%B4%EA%B1%B4%EB%B2%95",
    query: "산업안전보건법 학교 실습실 안전교육 보호구 MSDS",
    note: "위험기계, 보호구, MSDS, 실습실 안전교육 보조 기준"
  },
  vocationalEmploymentGuide: {
    title: "직업계고 취업지원·채용연계 운영 자료",
    source: "교육부·시도교육청",
    url: "",
    query: "직업계고 취업지원 채용연계 추천채용 고졸채용",
    note: "취업지도, 추천채용, 채용공고 검증, 졸업생 상담 기준"
  },
  jobAlio: {
    title: "잡알리오 공공기관 채용정보",
    source: "기획재정부·잡알리오",
    url: "https://job.alio.go.kr",
    query: "잡알리오 고졸채용 공공기관 채용공고",
    note: "공공기관 고졸 채용 공고의 1차 공식 확인 출처"
  },
  elementarySecondaryEducationAct: {
    title: "초·중등교육법 및 시행령",
    source: "국가법령정보센터",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EC%B4%88%C2%B7%EC%A4%91%EB%93%B1%EA%B5%90%EC%9C%A1%EB%B2%95",
    query: "초중등교육법 시행령 입학 전학 편입학 졸업 학교운영위원회",
    note: "입학·전입학·졸업·학교운영위원회 기본 법령"
  },
  educationWelfareGuide: {
    title: "교육급여·교육비 지원·장학금 운영 기준",
    source: "교육부·시도교육청",
    url: "",
    query: "교육급여 교육비 지원 장학금 교복비 기숙사비 통학비 학교",
    note: "지원 대상, 신청 절차, 개인정보·소득자료, 중복지원 여부"
  },
  afterSchoolGuide: {
    title: "방과후학교·늘봄학교·자유수강권 운영 지침",
    source: "교육부·시도교육청",
    url: "",
    query: "방과후학교 늘봄학교 자유수강권 수익자부담 환불 지침",
    note: "자유수강권, 수익자부담, 환불, 정산 기준"
  },
  schoolHealthAct: {
    title: "학교보건법 및 감염병·보건실 운영 기준",
    source: "국가법령정보센터·교육부",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%ED%95%99%EA%B5%90%EB%B3%B4%EA%B1%B4%EB%B2%95",
    query: "학교보건법 감염병 등교중지 보건실 투약 학생 건강",
    note: "감염병, 등교중지, 보건실 기록, 학생 건강관리 기준"
  },
  studentCounselingGuide: {
    title: "학생상담·위기학생 지원·Wee 프로젝트 자료",
    source: "교육부·시도교육청",
    url: "",
    query: "학생상담 위기학생 자살 자해 Wee 프로젝트 상담기록 비밀보호",
    note: "상담기록, 보호자 안내, 위기학생 전문기관 연계 기준"
  },
  teacherRightsAct: {
    title: "교원의 지위 향상 및 교육활동 보호를 위한 특별법",
    source: "국가법령정보센터·교육부",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EA%B5%90%EC%9B%90%EC%9D%98%20%EC%A7%80%EC%9C%84%20%ED%96%A5%EC%83%81%20%EB%B0%8F%20%EA%B5%90%EC%9C%A1%ED%99%9C%EB%8F%99%20%EB%B3%B4%ED%98%B8%EB%A5%BC%20%EC%9C%84%ED%95%9C%20%ED%8A%B9%EB%B3%84%EB%B2%95",
    query: "교원지위법 교육활동 침해 교권 보호 교원치유지원",
    note: "교육활동 침해, 교원 보호조치, 위원회·지원 절차"
  },
  schoolFacilitySafetyGuide: {
    title: "학교시설 안전·공사·정보화기기 관리 지침",
    source: "교육부·시도교육청",
    url: "",
    query: "학교시설 안전관리 시설공사 석면 소방 정보화기기 CCTV 지침",
    note: "시설 안전, 공사·계약, 정보화기기, CCTV 운영 기준"
  },
  personalInfoAct: {
    title: "개인정보 보호법 및 영상정보처리기기 운영 기준",
    source: "국가법령정보센터·개인정보보호위원회",
    url: "https://www.law.go.kr/LSW/lsSc.do?query=%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%20%EB%B3%B4%ED%98%B8%EB%B2%95",
    query: "개인정보 보호법 학교 CCTV 영상정보처리기기 개인정보 처리",
    note: "학생·교직원 개인정보, CCTV, 영상정보, 비공개 판단"
  }
};

const policyGuideCategories = {
  leaveAttendance: {
    label: "휴가·근태·출장",
    aliases: ["휴가", "근태", "출장", "출장비", "관외출장", "국내여비", "연가", "병가", "공가", "특별휴가", "경조사", "부모상", "배우자", "여비", "숙박비", "숙박", "일비", "식비", "운임", "나이스", "근무상황"],
    summary: "휴가·근태는 대상 신분이 먼저입니다. 교원, 지방공무원, 교육공무직, 기간제, 사립학교 교직원은 적용 규정의 출발점이 서로 다릅니다.",
    firstSteps: [
      "대상 신분을 교원, 지방공무원, 교육공무직, 기간제교원, 사립학교 교직원 중 하나로 확정",
      "소속 교육청 복무 지침, 취업규칙, 단체협약, 학교법인 규정이 있는지 확인",
      "나이스 근무상황, 출장명령, 승인권자, 증빙자료를 함께 대조"
    ],
    sourceKeys: ["teacherLeave", "nationalService", "localService", "travelExpense", "laborStandard", "fixedTermAct", "educationWorkerWorkRules", "fixedTermTeacherGuideline", "privateSchoolWorkRules"],
    officeQueries: ["교육공무직원 취업규칙 복무", "지방공무원 복무 조례 특별휴가", "교육공무직 단체협약 휴가"]
  },
  budgetExecution: {
    label: "학교회계·예산·지출",
    aliases: ["학교회계", "예산", "예산편성", "품의", "검수", "지출", "증빙", "영수증", "세금계산서", "수의계약", "정산", "업무추진비", "강사수당", "강사료", "강사비", "강의비", "강의료", "외부강사"],
    summary: "학교회계는 소속 교육청의 해당 학년도 학교회계 예산편성 기본지침을 최우선으로 보고, 공통 회계규칙과 계약 법령을 보조로 대조합니다.",
    firstSteps: [
      "소속 교육청의 2026학년도 학교회계 예산편성 기본지침 확인",
      "업무 단계를 예산 편성, 품의, 계약, 검수, 지출결의, 정산 중 하나로 구분",
      "학교 내부 결재선, 검수조서, 영수증·세금계산서, 카드전표, 사업계획서를 함께 확인"
    ],
    sourceKeys: ["schoolAccountingRule", "localContract", "publicRecords"],
    officeQueries: ["2026학년도 학교회계 예산편성 기본지침", "학교회계 예산편성 기본지침 지출 증빙", "학교회계 세출예산 원가통계비목"]
  },
  studentRecords: {
    label: "학생생활기록·출결",
    aliases: ["생활기록부", "학교생활기록", "생기부", "학생부", "출결", "인정결석", "정정", "증빙", "기재요령", "누가기록"],
    summary: "학생부·출결은 당해 학년도 기재요령과 학교생활기록 작성 및 관리지침을 먼저 보며, 학교급과 처리일자가 중요합니다.",
    firstSteps: [
      "학교급, 학년도, 항목, 처리일자를 먼저 확정",
      "정정 사안은 원자료, 증빙자료, 결재 기록, 권한 있는 사용자 처리 여부 확인",
      "학부모 안내는 확정 판단보다 지침상 처리 절차와 필요 자료 중심으로 작성"
    ],
    sourceKeys: ["schoolRecordGuide", "schoolRecordRule", "publicRecords", "infoDisclosure"],
    officeQueries: ["학교생활기록부 기재요령 Q&A", "학생생활기록 정정 증빙", "출결 인정결석 증빙"]
  },
  studentAttendance: {
    label: "출결·인정결석",
    aliases: ["출결", "인정결석", "질병결석", "미인정결석", "결석계", "출석인정", "지각", "조퇴", "결과", "등교중지"],
    summary: "출결은 학교급, 사유, 기간, 증빙자료, 당해 학년도 학생부 기재요령을 먼저 확인해야 합니다.",
    firstSteps: [
      "결석·지각·조퇴·결과 중 어떤 출결인지 구분",
      "인정결석, 질병결석, 미인정결석, 등교중지 중 적용 후보 확인",
      "결석계, 진단서, 보호자 확인서, 학교장 승인, 나이스 출결 처리 이력 대조"
    ],
    sourceKeys: ["schoolRecordGuide", "schoolRecordRule", "schoolHealthAct", "publicRecords", "infoDisclosure"],
    officeQueries: ["출결 인정결석 증빙 기재요령", "등교중지 출석인정 지침", "학생 출결 처리 교육청 지침"]
  },
  fieldExperienceLearning: {
    label: "교외·가정체험학습",
    aliases: ["교외체험학습", "가정체험학습", "현장체험학습", "체험학습", "가정학습", "체험학습 신청서", "체험학습 보고서", "수학여행", "수련활동"],
    summary: "교외·가정체험학습은 교육청 지침, 학교장 승인, 보호자 신청, 보고서, 출결 처리 기준을 함께 봅니다.",
    firstSteps: [
      "신청 전인지, 승인 후인지, 체험학습 종료 후 보고 단계인지 구분",
      "보호자 신청서, 학교장 승인, 기간 한도, 결과보고서 기준 확인",
      "출결·학생부 처리와 안전계획 또는 국외 체험학습 여부를 함께 확인"
    ],
    sourceKeys: ["fieldExperienceGuide", "schoolRecordGuide", "schoolRecordRule", "schoolSafetyAct", "publicRecords"],
    officeQueries: ["교외체험학습 운영 지침 신청서 보고서", "가정학습 출석인정 체험학습 지침", "현장체험학습 안전계획 보호자 동의"]
  },
  studentLifeGuidance: {
    label: "학생생활지도·학칙",
    aliases: ["학생생활지도", "생활지도", "학칙", "학교생활규정", "수업방해", "지시불응", "휴대전화", "휴대폰", "선도", "징계", "생활교육위원회", "학생인권", "기숙사"],
    summary: "학생생활지도는 학교생활규정, 생활지도 고시, 학생 인권, 아동학대·민원 위험, 상담기록을 분리해 확인해야 합니다.",
    firstSteps: [
      "단순 생활지도인지, 학교폭력인지, 교육활동 침해인지 먼저 분리",
      "학교생활규정·학칙·기숙사 운영규정에 근거가 있는지 확인",
      "학생 의견 청취, 상담기록, 보호자 안내, 개인정보·인권 침해 위험을 함께 점검"
    ],
    sourceKeys: ["studentGuidanceRule", "schoolRecordRule", "publicRecords", "infoDisclosure"],
    officeQueries: ["학생생활지도 고시 학교생활규정", "생활교육위원회 선도 조치 절차", "학생 휴대전화 생활지도 학교 규정"]
  },
  studentSafety: {
    label: "학교안전·실습실 안전",
    aliases: ["학교안전", "안전사고", "안전공제", "응급", "119", "치료비", "실습실", "실험실습실", "기자재", "위험기계", "보호구", "MSDS", "안전교육", "식중독", "급식 위생"],
    summary: "학생 안전은 응급조치, 보호자 안내, 사고보고, 안전공제, 실습실·급식 안전과 위험 신호를 먼저 나누어 봅니다.",
    firstSteps: [
      "실제 사고인지 예방 점검인지, 수업·실습·급식·체험활동 중 어디서 발생했는지 확인",
      "응급조치, 보호자 연락, 사고보고, 보건실 기록, 안전공제 안내 여부 점검",
      "실습실·위험기계·화학물질 사안은 안전교육, 보호구, 위험성평가 자료까지 대조"
    ],
    sourceKeys: ["schoolSafetyAct", "industrialSafetyAct", "schoolMealAct", "schoolHealthAct", "publicRecords", "infoDisclosure"],
    officeQueries: ["학교안전사고 안전공제 사고보고", "실험실습실 안전관리 지침 보호구", "학교급식 식중독 보존식 보고"]
  },
  studentWelfare: {
    label: "장학·교육복지·수익자부담",
    aliases: ["장학금", "교육비지원", "교육급여", "교육복지", "수익자부담", "환불", "감면", "교복비", "기숙사비", "통학비", "자유수강권", "방과후 수강료"],
    summary: "학생 복지와 수익자부담은 지원 대상, 신청·심사, 개인정보·소득자료, 환불·정산 기준을 나누어 확인합니다.",
    firstSteps: [
      "지원·감면·환불·정산 중 어느 단계인지 구분",
      "지원 대상, 신청 서류, 선정 기준, 중복지원 가능성 확인",
      "수익자부담 경비는 학교회계 집행·정산 자료와 보호자 안내 자료를 함께 확인"
    ],
    sourceKeys: ["educationWelfareGuide", "afterSchoolGuide", "schoolAccountingRule", "publicRecords", "infoDisclosure"],
    officeQueries: ["교육비 지원 장학금 지침", "수익자부담 경비 환불 정산", "자유수강권 방과후학교 수강료 환불"]
  },
  studentHealthCounseling: {
    label: "보건·감염병·상담",
    aliases: ["보건", "감염병", "독감", "코로나", "등교중지", "보건실", "투약", "약물", "학생상담", "상담기록", "상담일지", "자살", "자해", "위기학생", "Wee", "정서행동"],
    summary: "보건·상담 사안은 등교중지, 투약·보건실 기록, 상담 비밀보호, 보호자 안내, 전문기관 연계를 구분해야 합니다.",
    firstSteps: [
      "감염병·투약·상담·위기학생 중 어느 사안인지 구분",
      "보호자 안내, 보건실·상담기록, 출결 처리, 개인정보 제공 범위 확인",
      "자해·자살·학대 의심 등 위험 신호가 있으면 즉시 보호조치와 전문기관 연계 여부 점검"
    ],
    sourceKeys: ["schoolHealthAct", "studentCounselingGuide", "schoolSafetyAct", "schoolRecordGuide", "publicRecords", "infoDisclosure"],
    officeQueries: ["감염병 등교중지 출석인정 학교보건", "학생상담 기록 비밀보호 Wee", "위기학생 자살 자해 대응 지침"]
  },
  vocationalFieldTraining: {
    label: "현장실습·도제·산학협력",
    aliases: ["현장실습", "도제학교", "도제", "일학습병행", "산학협력", "선도기업", "참여기업", "표준협약서", "현장실습표준협약서", "실습수당", "기업현장교사", "글로벌현장학습", "하이파이브"],
    summary: "현장실습·도제는 학생 보호, 기업 선정, 협약서, 실습시간, 안전교육, 사고 보고를 먼저 나누어 확인합니다.",
    firstSteps: [
      "현장실습, 도제학교, 산학협력, 취업연계 중 실제 단계 구분",
      "학생·학교·기업·보호자 중 권리·의무 주체와 협약서 작성 상태 확인",
      "선도기업 기준, 실습시간, 안전교육, 실습수당, 사고 보고·복귀 절차 대조"
    ],
    sourceKeys: ["vocationalEducationAct", "fieldTrainingManual", "apprenticeshipGuide", "schoolSafetyAct", "industrialSafetyAct", "publicRecords", "infoDisclosure"],
    officeQueries: ["직업계고 현장실습 운영 매뉴얼", "현장실습 표준협약서 선도기업", "도제학교 일학습병행 운영 지침"]
  },
  careerEmployment: {
    label: "취업지원·고졸채용",
    aliases: ["취업지도", "취업지원", "고졸채용", "공채", "채용공고", "잡알리오", "추천채용", "학교장추천", "졸업생", "근로계약", "임금체불", "수습", "해고", "노동상담", "취업처", "채용검증"],
    summary: "취업지원은 공식 공고, 학교 추천, 근로조건, 졸업생 노동상담, 2·3차 검증 출처를 분리해 확인합니다.",
    firstSteps: [
      "재학생 취업지도인지 졸업생 노동상담인지 먼저 구분",
      "공식 공고 원문, 직무·임금·근로시간, 학교장 추천 여부 확인",
      "잡알리오 등 1차 공식 공고와 교육청 취업지원센터 자료를 교차 대조"
    ],
    sourceKeys: ["jobAlio", "vocationalEmploymentGuide", "laborStandard", "fixedTermAct", "publicRecords", "infoDisclosure"],
    officeQueries: ["직업계고 취업지원 고졸채용 공식공고", "잡알리오 고졸채용 공공기관 채용공고", "추천채용 근로조건 검증 지침"]
  },
  admissionsPathways: {
    label: "입학·특별전형·재직자전형",
    aliases: ["입학", "입학전형", "특성화고특별전형", "특별전형", "재직자전형", "선취업후진학", "전입학", "편입학", "재입학", "자퇴", "퇴학", "졸업", "학적", "위탁교육", "직업위탁", "대학진학", "동일계", "마이스터고 전형"],
    summary: "입학·진학 경로는 전형 종류, 지원 자격, 재직기간, 학적·졸업 요건, 모집요강 원문을 분리해 확인합니다.",
    firstSteps: [
      "특성화고 입학, 대학 특별전형, 재직자전형, 전입학·졸업 중 어느 경로인지 구분",
      "모집요강 원문, 학교급·학과, 재직기간, 졸업예정 여부와 증빙자료 확인",
      "교육청 전형요강과 대학별 모집요강이 충돌하지 않는지 대조"
    ],
    sourceKeys: ["elementarySecondaryEducationAct", "schoolRecordRule", "schoolRecordGuide", "publicRecords", "infoDisclosure"],
    officeQueries: ["특성화고 특별전형 재직자전형 모집요강", "특성화고 입학전형 전입학 지침", "선취업후진학 재직자전형 자격"]
  },
  vocationalCurriculum: {
    label: "직업계고 교육과정·NCS",
    aliases: ["NCS", "엔씨에스", "직업계고학점제", "고교학점제", "전문교과", "실무과목", "교육과정", "직무능력", "이수단위", "학점", "공동교육과정", "마이스터고", "특성화고", "직업기초능력", "평가계획", "성취평가"],
    summary: "직업계고 교육과정은 NCS 실무과목, 학점제, 이수 기준, 평가계획, 학생부 기재를 함께 확인합니다.",
    firstSteps: [
      "NCS 실무과목, 학점제, 평가, 공동교육과정, 졸업요건 중 쟁점 구분",
      "학년도, 학교급, 학과, 과목명, 이수단위·학점과 평가계획 확인",
      "교육과정 편성표, 학업성적관리규정, 학생부 기재요령을 함께 대조"
    ],
    sourceKeys: ["nationalCurriculum", "vocationalCurriculumGuide", "schoolRecordGuide", "schoolRecordRule", "elementarySecondaryEducationAct", "publicRecords"],
    officeQueries: ["직업계고 교육과정 NCS 실무과목", "고교학점제 직업계고 운영 지침", "전문교과 평가계획 학점 이수"]
  },
  schoolViolenceGuide: {
    label: "학교폭력 절차",
    aliases: ["학교폭력", "학폭", "전담기구", "심의", "피해학생", "가해학생", "불복", "분리", "사안처리"],
    summary: "학교폭력은 법률 판단보다 신고·접수, 사안조사, 전담기구, 심의 요청, 조치, 불복 단계가 먼저 구분되어야 합니다.",
    firstSteps: [
      "신고·접수일, 발생일, 관련 학생, 증거자료를 시간순으로 정리",
      "피해학생 보호조치와 관련 학생 분리 필요성 확인",
      "전담기구 확인, 심의 요청, 조치 결정, 불복 가능 단계를 분리"
    ],
    sourceKeys: ["schoolViolenceGuide2025"],
    officeQueries: ["학교폭력 사안처리 세부설명 A to Z", "학교폭력 사안처리 가이드북"]
  },
  documentDisclosure: {
    label: "공문·기록·정보공개",
    aliases: ["공문", "결재", "회의록", "보존", "기록물", "정보공개", "개인정보", "민원", "비공개", "부분공개"],
    summary: "공문·회의록·정보공개는 기록물 보존, 개인정보, 비공개 사유, 학교 내부 결재선이 함께 움직입니다.",
    firstSteps: [
      "문서 종류를 공문, 회의록, 상담기록, 지출증빙, 학생자료 중 하나로 구분",
      "보존기간표, 개인정보 포함 여부, 정보공개 비공개 사유를 대조",
      "민원 답변은 공개 가능한 사실과 내부 검토 자료를 구분"
    ],
    sourceKeys: ["publicRecords", "infoDisclosure", "schoolRecordRule"],
    officeQueries: ["교육청 기록물관리 지침", "정보공개 업무처리 지침 학교", "기록물 보존기간표 학교"]
  },
  staffContract: {
    label: "교육공무직·기간제 계약",
    aliases: ["교육공무직", "특수운영직군", "기간제", "계약직", "취업규칙", "단체협약", "근로계약", "재계약", "복무"],
    summary: "교육공무직과 기간제 직원은 법령 공통 기준만으로 끝나지 않고 교육청 취업규칙, 단체협약, 근로계약서를 함께 봐야 합니다.",
    firstSteps: [
      "교육공무직, 특수운영직군, 기간제교원, 기간제근로자 중 신분을 확정",
      "소속 교육청 취업규칙, 단체협약, 인사관리 규정, 근로계약서 확인",
      "근로기준법·기간제법은 공통 하한선으로 보고 교육청 기준과 충돌 여부 확인"
    ],
    sourceKeys: ["educationWorkerWorkRules", "fixedTermTeacherGuideline", "privateSchoolWorkRules", "laborStandard", "fixedTermAct", "teacherLeave", "localService"],
    officeQueries: ["교육공무직원 취업규칙", "교육공무직 단체협약", "기간제교원 운영 지침"]
  },
  vocationalEducation: {
    label: "특성화고·직업교육",
    aliases: ["특성화고", "마이스터고", "직업계고", "현장실습", "도제학교", "일학습병행", "산학협력", "취업지도", "고졸채용", "잡알리오", "선도기업", "표준협약서"],
    summary: "특성화고·직업교육 사안은 학생 보호, 교육과정, 기업 협약, 취업 공고 검증, 보호자 안내를 분리해 확인합니다.",
    firstSteps: [
      "현장실습·도제·취업지도·채용검증·산학협력 중 실제 업무 단계 확정",
      "학생, 학교, 기업, 보호자, 졸업생 중 권리·의무 주체를 구분",
      "교육부·교육청 지침, 협약서, 상담기록, 기업 공고·잡알리오 원문을 교차 확인"
    ],
    sourceKeys: ["vocationalEducationAct", "fieldTrainingManual", "apprenticeshipGuide", "vocationalEmploymentGuide", "jobAlio", "publicRecords"],
    officeQueries: ["직업계고 현장실습 운영 매뉴얼", "도제학교 운영 지침", "직업계고 취업지원 고졸채용"]
  },
  curriculumAcademic: {
    label: "교육과정·학사·학적",
    aliases: ["교육과정", "NCS", "고교학점제", "직업계고학점제", "전문교과", "실무과목", "입학", "전입학", "편입학", "졸업", "학적", "위탁교육"],
    summary: "교육과정·학사 사안은 학교급, 학년도, 이수 기준, 학적 처리, 학생부 연계를 함께 확인해야 합니다.",
    firstSteps: [
      "교육과정, 평가, 학적, 졸업, 위탁교육 중 업무 영역 구분",
      "학년도·학교급·학년·학과와 적용 교육청 지침 확인",
      "학생부 기재, 출결, 학업성적관리규정, 내부 결재 자료 대조"
    ],
    sourceKeys: ["nationalCurriculum", "vocationalCurriculumGuide", "elementarySecondaryEducationAct", "schoolRecordGuide", "schoolRecordRule"],
    officeQueries: ["직업계고 교육과정 NCS 실무과목", "고교학점제 직업계고 운영 지침", "전입학 학적 졸업 지침"]
  },
  studentWelfareSafety: {
    label: "학생복지·보건·안전",
    aliases: ["장학금", "교육비지원", "교육복지", "수익자부담", "보건", "감염병", "등교중지", "상담", "자살", "자해", "실습실", "기자재", "안전교육", "보호구"],
    summary: "학생복지·보건·안전 사안은 지원 대상, 건강·위험 신호, 보호자 안내, 기록 보존, 전문기관 연계를 나누어 봅니다.",
    firstSteps: [
      "복지지원, 보건·감염병, 위기상담, 실습실 안전 중 사안 구분",
      "학생 보호 필요성과 보호자 안내·전문기관 연계 여부 확인",
      "신청서, 상담기록, 보건기록, 안전교육, 예산·증빙자료를 분리"
    ],
    sourceKeys: ["educationWelfareGuide", "schoolHealthAct", "studentCounselingGuide", "schoolSafetyAct", "industrialSafetyAct", "publicRecords"],
    officeQueries: ["교육비 지원 장학금 지침", "감염병 등교중지 학교보건", "실습실 안전관리 지침"]
  },
  staffProtection: {
    label: "교육활동 보호·교직원 보호",
    aliases: ["교권", "교육활동침해", "교원치유", "교권보호위원회", "학부모폭언", "악성민원", "교사보호", "아동학대신고"],
    summary: "교육활동 보호는 학생 생활지도, 교원 보호조치, 민원·아동학대 신고 위험, 증빙 보존을 함께 분리해야 합니다.",
    firstSteps: [
      "교육활동 침해인지, 단순 민원인지, 아동학대 신고 위험인지 분리",
      "상담·통화·문자·녹취·민원 접수 이력과 학교 조치 기록 확인",
      "교육청 지원센터, 교원 보호 절차, 학생 생활지도 기준을 함께 대조"
    ],
    sourceKeys: ["teacherRightsAct", "studentGuidanceRule", "publicRecords", "infoDisclosure"],
    officeQueries: ["교육활동 침해 교원 보호 지침", "교권보호위원회 교육청", "교원치유지원센터"]
  },
  facilityDigital: {
    label: "시설·정보화·개인정보",
    aliases: ["시설", "시설공사", "석면", "소방", "전기", "정보화", "나이스", "K-에듀파인", "개인정보", "CCTV", "영상정보", "스마트기기", "와이파이", "정보보안"],
    summary: "시설·정보화 사안은 안전점검, 계약·공사, 개인정보, CCTV, 시스템 권한, 보안 사고를 별도 절차로 나누어 확인합니다.",
    firstSteps: [
      "시설 안전, 공사·계약, CCTV·개인정보, 정보시스템 권한 중 쟁점 구분",
      "학생·교직원 개인정보 포함 여부와 공개·비공개 기준 확인",
      "계약·검수 자료, 점검표, 권한 이력, 사고 보고 자료를 함께 대조"
    ],
    sourceKeys: ["schoolFacilitySafetyGuide", "personalInfoAct", "infoDisclosure", "publicRecords", "localContract"],
    officeQueries: ["학교시설 안전관리 지침", "학교 CCTV 개인정보 지침", "교육청 정보보안 기본지침"]
  },
  governanceRecords: {
    label: "학교운영·위원회·규정",
    aliases: ["학교운영위원회", "운영위원회", "규정개정", "학칙개정", "위원회", "회의록", "심의", "자문", "의결", "학생자치", "학부모회"],
    summary: "학교운영·위원회 사안은 심의·자문 권한, 회의록 공개, 규정개정 절차, 의견수렴을 구분해야 합니다.",
    firstSteps: [
      "위원회 성격과 심의·자문·의결 권한 확인",
      "안건 공고, 의견수렴, 회의록 작성·공개·비공개 기준 확인",
      "학칙·생활규정·위원회 규정과 공공기록물 보존 기준 대조"
    ],
    sourceKeys: ["elementarySecondaryEducationAct", "publicRecords", "infoDisclosure", "studentGuidanceRule"],
    officeQueries: ["학교운영위원회 규정 회의록 공개", "학칙 개정 의견수렴 절차", "학교 위원회 운영 지침"]
  }
};

Object.entries(policyGuideCategories).forEach(([code, category]) => {
  category.code = code;
});

const policyCategoryDefaultLabel = "질문에서 자동 분류";
const studentPolicyCategoryOrder = [
  "studentAttendance",
  "fieldExperienceLearning",
  "vocationalFieldTraining",
  "careerEmployment",
  "admissionsPathways",
  "studentRecords",
  "schoolViolenceGuide",
  "studentLifeGuidance",
  "studentWelfare",
  "studentHealthCounseling",
  "studentSafety",
  "vocationalCurriculum"
];
const operatingPolicyCategoryOrder = [
  "leaveAttendance",
  "budgetExecution",
  "documentDisclosure",
  "staffContract",
  "vocationalEducation",
  "curriculumAcademic",
  "studentWelfareSafety",
  "staffProtection",
  "facilityDigital",
  "governanceRecords"
];
const rolePolicyCategoryMatrix = {
  auto: [...studentPolicyCategoryOrder, ...operatingPolicyCategoryOrder],
  student: studentPolicyCategoryOrder,
  parent: [
    "studentAttendance",
    "fieldExperienceLearning",
    "studentRecords",
    "schoolViolenceGuide",
    "studentLifeGuidance",
    "studentWelfare",
    "studentHealthCounseling",
    "studentSafety",
    "admissionsPathways",
    "careerEmployment",
    "vocationalFieldTraining",
    "documentDisclosure"
  ],
  teacher: [
    "studentAttendance",
    "fieldExperienceLearning",
    "vocationalFieldTraining",
    "careerEmployment",
    "studentRecords",
    "schoolViolenceGuide",
    "studentLifeGuidance",
    "studentSafety",
    "vocationalCurriculum",
    "studentWelfare",
    "studentHealthCounseling",
    "leaveAttendance",
    "staffProtection",
    "budgetExecution",
    "documentDisclosure",
    "governanceRecords"
  ],
  fixedTermTeacher: [
    "leaveAttendance",
    "studentAttendance",
    "fieldExperienceLearning",
    "studentRecords",
    "schoolViolenceGuide",
    "studentLifeGuidance",
    "vocationalFieldTraining",
    "careerEmployment",
    "staffContract",
    "staffProtection",
    "documentDisclosure"
  ],
  privateSchool: [
    "leaveAttendance",
    "studentAttendance",
    "fieldExperienceLearning",
    "studentRecords",
    "schoolViolenceGuide",
    "vocationalFieldTraining",
    "careerEmployment",
    "staffContract",
    "staffProtection",
    "governanceRecords"
  ],
  localOfficer: [
    "leaveAttendance",
    "staffContract",
    "budgetExecution",
    "documentDisclosure",
    "facilityDigital",
    "governanceRecords",
    "staffProtection",
    "studentSafety"
  ],
  educationWorker: [
    "leaveAttendance",
    "staffContract",
    "staffProtection",
    "studentSafety",
    "studentHealthCounseling",
    "budgetExecution",
    "documentDisclosure",
    "facilityDigital",
    "studentWelfare"
  ],
  manager: [
    "studentAttendance",
    "fieldExperienceLearning",
    "studentRecords",
    "schoolViolenceGuide",
    "studentLifeGuidance",
    "vocationalFieldTraining",
    "careerEmployment",
    "studentSafety",
    "studentWelfare",
    "vocationalCurriculum",
    "budgetExecution",
    "documentDisclosure",
    "leaveAttendance",
    "staffContract",
    "staffProtection",
    "facilityDigital",
    "governanceRecords"
  ]
};

const policyCategoryTopicMap = {
  studentAttendance: { major: "studentPathway", middle: "attendance", minor: "recognizedAbsence" },
  fieldExperienceLearning: { major: "studentPathway", middle: "fieldExperience", minor: "application" },
  admissionsPathways: { major: "studentPathway", middle: "admissions", minor: "auto" },
  studentRecords: { major: "studentPathway", middle: "records", minor: "schoolRecord" },
  schoolViolenceGuide: { major: "schoolViolence", middle: "procedure", minor: "reporting" },
  studentLifeGuidance: { major: "studentSupport", middle: "guidance", minor: "auto" },
  studentWelfare: { major: "studentSupport", middle: "welfare", minor: "auto" },
  studentHealthCounseling: { major: "studentSupport", middle: "health", minor: "auto" },
  studentSafety: { major: "schoolSafety", middle: "accident", minor: "injury" },
  vocationalFieldTraining: { major: "fieldTraining", middle: "scope", minor: "auto" },
  careerEmployment: { major: "employment", middle: "hiring", minor: "highSchoolHiring" },
  vocationalCurriculum: { major: "vocationalLearning", middle: "curriculum", minor: "auto" },
  budgetExecution: { major: "schoolAdministration", middle: "budgetAccount", minor: "spendingEvidence" },
  documentDisclosure: { major: "schoolAdministration", middle: "adminProcedure", minor: "infoDisclosure" },
  leaveAttendance: { major: "staffLabor", middle: "attendanceLeave", minor: "teacherLeave" },
  staffContract: { major: "staffLabor", middle: "employmentStatus", minor: "auto" },
  staffProtection: { major: "staffLabor", middle: "workplaceIssue", minor: "workplaceComplaint" },
  facilityDigital: { major: "schoolAdministration", middle: "adminProcedure", minor: "document" },
  governanceRecords: { major: "schoolAdministration", middle: "adminProcedure", minor: "committee" },
  vocationalEducation: { major: "fieldTraining", middle: "scope", minor: "auto" },
  curriculumAcademic: { major: "vocationalLearning", middle: "curriculum", minor: "auto" },
  studentWelfareSafety: { major: "studentSupport", middle: "health", minor: "auto" }
};

function getPolicyCategoryOptionsForRole(roleCode = "auto") {
  const roleOrder = rolePolicyCategoryMatrix[roleCode] || rolePolicyCategoryMatrix.auto;
  const values = roleCode === "auto"
    ? ["auto", ...roleOrder, ...Object.keys(policyGuideCategories)]
    : ["auto", ...roleOrder];
  const seen = new Set();
  return values
    .filter((value) => {
      if (seen.has(value)) return false;
      if (value !== "auto" && !policyGuideCategories[value]) return false;
      seen.add(value);
      return true;
    })
    .map((value) => ({
      value,
      label: value === "auto" ? policyCategoryDefaultLabel : policyGuideCategories[value].label
    }));
}

function updatePolicyCategoryOptionsForRole({ keepValue = true } = {}) {
  updatePolicyCategorySelectForRole(policyCategoryInput, getEffectivePolicyCategoryRole(), { keepValue });
}

function updateGuideCategoryOptionsForRole({ keepValue = true } = {}) {
  updatePolicyCategorySelectForRole(guideCategoryInput, guideRoleInput?.value || "auto", { keepValue });
}

function updatePolicyCategorySelectForRole(select, roleCode = "auto", { keepValue = true } = {}) {
  if (!select) return;
  const previousValue = keepValue ? select.value : "auto";
  const options = getPolicyCategoryOptionsForRole(roleCode);
  replaceOptions(select, options);
  setSelectValue(select, previousValue);
  if (!select.value) {
    select.value = "auto";
  }
}

function getEffectivePolicyCategoryRole() {
  if (policyRoleInput?.value && policyRoleInput.value !== "auto") {
    return policyRoleInput.value;
  }

  return mapPartyToPolicyRole(partyRoleInput?.value || "auto")
    || mapUserToPolicyRole(userRoleInput?.value || "auto")
    || "auto";
}

const policyRoleProfiles = {
  auto: {
    label: "상황에서 판단",
    priority: "질문 속 신분 표현을 기준으로 적용 규정을 갈라야 합니다."
  },
  student: {
    label: "학생",
    priority: "학생은 학칙, 출결 기준, 학교생활기록부 기재요령, 학생생활규정이 우선입니다."
  },
  teacher: {
    label: "공립 교원",
    priority: "공립 교원은 교원휴가 예규, 국가공무원 복무규정, 교육공무원 관련 규정과 교육청 지침을 함께 봅니다."
  },
  fixedTermTeacher: {
    label: "기간제 교원",
    priority: "기간제 교원은 임용계약, 교육청 기간제교원 운영 지침, 교원 복무·휴가 기준 적용 여부를 함께 확인합니다."
  },
  localOfficer: {
    label: "지방공무원·행정직",
    priority: "교육감 소속 지방공무원은 지방공무원 복무규정과 관할 교육청 복무 조례·예규를 우선 확인합니다."
  },
  educationWorker: {
    label: "교육공무직·특수운영직군",
    priority: "교육공무직은 근로기준법보다 소속 교육청 취업규칙, 단체협약, 근로계약서의 구체 기준을 먼저 대조합니다."
  },
  privateSchool: {
    label: "사립학교 교직원",
    priority: "사립학교는 법령 공통 기준 외에 학교법인 정관, 취업규칙, 단체협약, 내부 복무규정 확인이 필요합니다."
  },
  manager: {
    label: "학교 관리자",
    priority: "학교 관리자는 소속 교육청 지침, 학교장 승인권, 결재선, 내부통제와 기록 보존을 함께 확인합니다."
  },
  parent: {
    label: "학부모",
    priority: "학부모 안내는 학교가 적용하는 지침명, 처리 절차, 제출 가능한 증빙자료를 명확히 설명하는 방식이 좋습니다."
  }
};

const topicTaxonomy = {
  auto: {
    label: "자동 분류",
    preset: "auto",
    middles: []
  },
  studentPathway: {
    label: "학생 출결·학적·진학",
    preset: "schoolAdministration",
    middles: [
      {
        value: "attendance",
        label: "출결·인정결석",
        preset: "schoolAdministration",
        minors: [
          { value: "recognizedAbsence", label: "출석인정·인정결석", preset: "schoolAdministration" },
          { value: "illnessAbsence", label: "질병결석·등교중지", preset: "schoolAdministration" },
          { value: "evidence", label: "결석계·증빙", preset: "schoolAdministration" }
        ]
      },
      {
        value: "fieldExperience",
        label: "교외·가정체험학습",
        preset: "schoolAdministration",
        minors: [
          { value: "application", label: "신청·학교장 승인", preset: "schoolAdministration" },
          { value: "report", label: "결과보고서", preset: "schoolAdministration" },
          { value: "attendance", label: "출결·학생부 처리", preset: "schoolAdministration" }
        ]
      },
      {
        value: "admissions",
        label: "입학·전입학·특별전형",
        preset: "schoolAdministration",
        minors: [
          { value: "employedAdult", label: "재직자전형", preset: "schoolAdministration" },
          { value: "vocationalSpecial", label: "특성화고 특별전형", preset: "schoolAdministration" },
          { value: "transferGraduation", label: "전입학·졸업·학적", preset: "schoolAdministration" }
        ]
      },
      {
        value: "records",
        label: "학생부·학적 기록",
        preset: "schoolAdministration",
        minors: [
          { value: "schoolRecord", label: "학생부 기재", preset: "schoolAdministration" },
          { value: "correction", label: "정정·증빙 보존", preset: "schoolAdministration" },
          { value: "graduation", label: "졸업·학적 처리", preset: "schoolAdministration" }
        ]
      }
    ]
  },
  studentSupport: {
    label: "학생생활·보건·복지",
    preset: "civilComplaint",
    middles: [
      {
        value: "guidance",
        label: "생활지도·학칙",
        preset: "civilComplaint",
        minors: [
          { value: "classroom", label: "수업방해·지시불응", preset: "civilComplaint" },
          { value: "phone", label: "휴대전화·소지품", preset: "civilComplaint" },
          { value: "rule", label: "학교생활규정·학칙", preset: "civilComplaint" }
        ]
      },
      {
        value: "health",
        label: "보건·감염병·상담",
        preset: "schoolSafety",
        minors: [
          { value: "infection", label: "감염병·등교중지", preset: "schoolSafety" },
          { value: "counseling", label: "상담기록·위기학생", preset: "civilComplaint" },
          { value: "medicine", label: "보건실·투약", preset: "schoolSafety" }
        ]
      },
      {
        value: "welfare",
        label: "장학·교육복지",
        preset: "schoolAdministration",
        minors: [
          { value: "scholarship", label: "장학금", preset: "schoolAdministration" },
          { value: "educationAid", label: "교육비·교육급여", preset: "schoolAdministration" },
          { value: "userFee", label: "수익자부담·환불", preset: "schoolAdministration" }
        ]
      }
    ]
  },
  vocationalLearning: {
    label: "직업교육과정·NCS",
    preset: "schoolAdministration",
    middles: [
      {
        value: "curriculum",
        label: "직업계고 교육과정",
        preset: "schoolAdministration",
        minors: [
          { value: "ncs", label: "NCS 실무과목", preset: "schoolAdministration" },
          { value: "credit", label: "고교학점제·이수", preset: "schoolAdministration" },
          { value: "assessment", label: "평가·성적관리", preset: "schoolAdministration" }
        ]
      },
      {
        value: "practiceRoom",
        label: "실험실습실·기자재",
        preset: "schoolSafety",
        minors: [
          { value: "equipment", label: "기자재·실습재료", preset: "schoolAdministration" },
          { value: "safety", label: "실습실 안전교육", preset: "schoolSafety" },
          { value: "budget", label: "예산·구입·검수", preset: "schoolAdministration" }
        ]
      }
    ]
  },
  employment: {
    label: "취업·근로계약",
    preset: "employment",
    middles: [
      {
        value: "contract",
        label: "근로계약·임금",
        preset: "employment",
        minors: [
          { value: "contractForm", label: "근로계약서", preset: "employment" },
          { value: "wage", label: "임금·수당", preset: "employment" },
          { value: "dismissal", label: "해고·퇴직", preset: "employment" }
        ]
      },
      {
        value: "hiring",
        label: "공채·채용절차",
        preset: "employment",
        minors: [
          { value: "highSchoolHiring", label: "고졸채용", preset: "employment" },
          { value: "recommendation", label: "학교장 추천", preset: "employment" },
          { value: "document", label: "공고·직무기술서", preset: "employment" }
        ]
      }
    ]
  },
  fieldTraining: {
    label: "현장실습·도제",
    preset: "fieldTraining",
    middles: [
      {
        value: "scope",
        label: "업무범위·부당지시",
        preset: "fieldTraining",
        minors: [
          { value: "cleaning", label: "청소·잡무 반복", preset: "fieldTraining" },
          { value: "afterHours", label: "실습시간 종료 후 지시", preset: "fieldTraining" },
          { value: "safety", label: "위험작업·안전", preset: "fieldTraining" }
        ]
      },
      {
        value: "apprenticeship",
        label: "도제학교·일학습병행",
        preset: "apprenticeship",
        minors: [
          { value: "trainingTime", label: "훈련시간", preset: "apprenticeship" },
          { value: "trainingContract", label: "훈련계약", preset: "apprenticeship" },
          { value: "allowance", label: "훈련수당", preset: "apprenticeship" }
        ]
      },
      {
        value: "overseas",
        label: "해외 현장실습",
        preset: "overseasTraining",
        minors: [
          { value: "australia", label: "호주·국외 파견", preset: "overseasTraining" },
          { value: "insurance", label: "보험·안전관리", preset: "overseasTraining" },
          { value: "consent", label: "동의·보호자 안내", preset: "overseasTraining" }
        ]
      }
    ]
  },
  schoolSafety: {
    label: "안전·중대재해",
    preset: "schoolSafety",
    middles: [
      {
        value: "accident",
        label: "사고·산재",
        preset: "schoolSafety",
        minors: [
          { value: "injury", label: "부상·치료", preset: "schoolSafety" },
          { value: "report", label: "보고·기록", preset: "schoolSafety" },
          { value: "prevention", label: "재발방지", preset: "schoolSafety" }
        ]
      },
      {
        value: "seriousAccident",
        label: "중대재해 판단",
        preset: "schoolSafety",
        minors: [
          { value: "schoolFacility", label: "학교 시설", preset: "schoolSafety" },
          { value: "workplace", label: "사업장", preset: "schoolSafety" },
          { value: "safetySystem", label: "안전보건 체계", preset: "schoolSafety" }
        ]
      }
    ]
  },
  schoolViolence: {
    label: "학교폭력·학생사안",
    preset: "schoolViolence",
    middles: [
      {
        value: "procedure",
        label: "신고·조사·심의",
        preset: "schoolViolence",
        minors: [
          { value: "reporting", label: "신고·접수", preset: "schoolViolence" },
          { value: "committee", label: "전담기구·심의", preset: "schoolViolence" },
          { value: "appeal", label: "불복·재심", preset: "schoolViolence" }
        ]
      },
      {
        value: "studentRights",
        label: "생활지도·학생권리",
        preset: "civilComplaint",
        minors: [
          { value: "discipline", label: "징계·출결", preset: "civilComplaint" },
          { value: "privacy", label: "개인정보·기록", preset: "civilComplaint" },
          { value: "complaint", label: "학부모 민원", preset: "civilComplaint" }
        ]
      }
    ]
  },
  schoolAdministration: {
    label: "교육행정·학교회계",
    preset: "schoolAdministration",
    middles: [
      {
        value: "budgetAccount",
        label: "학교회계·예산",
        preset: "schoolAdministration",
        minors: [
          { value: "budgetPlan", label: "예산 편성", preset: "schoolAdministration" },
          { value: "spendingEvidence", label: "지출 증빙", preset: "schoolAdministration" },
          { value: "contractAccounting", label: "계약·검수", preset: "schoolAdministration" }
        ]
      },
      {
        value: "studentRecords",
        label: "학생생활기록",
        preset: "schoolAdministration",
        minors: [
          { value: "schoolRecord", label: "학생부 기재", preset: "schoolAdministration" },
          { value: "attendanceRecord", label: "출결·증빙", preset: "schoolAdministration" },
          { value: "correction", label: "정정·보관", preset: "schoolAdministration" }
        ]
      },
      {
        value: "adminProcedure",
        label: "공문·행정절차",
        preset: "schoolAdministration",
        minors: [
          { value: "document", label: "공문·품의", preset: "schoolAdministration" },
          { value: "committee", label: "위원회·회의록", preset: "schoolAdministration" },
          { value: "infoDisclosure", label: "정보공개·민원", preset: "schoolAdministration" }
        ]
      }
    ]
  },
  staffLabor: {
    label: "교직원·행정직",
    preset: "staffLabor",
    middles: [
      {
        value: "employmentStatus",
        label: "신분·계약",
        preset: "staffLabor",
        minors: [
          { value: "fixedTerm", label: "기간제·단시간", preset: "staffLabor" },
          { value: "adminStaff", label: "행정직·교육공무직", preset: "staffLabor" },
          { value: "renewal", label: "계약갱신·재계약", preset: "staffLabor" }
        ]
      },
      {
        value: "attendanceLeave",
        label: "근태·출장·휴가",
        preset: "staffLabor",
        minors: [
          { value: "teacherLeave", label: "교원 휴가", preset: "staffLabor" },
          { value: "businessTrip", label: "출장·여비", preset: "staffLabor" },
          { value: "attendanceEvidence", label: "근태 증빙", preset: "staffLabor" }
        ]
      },
      {
        value: "workplaceIssue",
        label: "직장 내 문제·징계",
        preset: "staffLabor",
        minors: [
          { value: "bullying", label: "직장 내 괴롭힘", preset: "staffLabor" },
          { value: "discipline", label: "징계·민원", preset: "staffLabor" },
          { value: "workplaceComplaint", label: "고충·보호조치", preset: "staffLabor" }
        ]
      }
    ]
  },
  civilComplaint: {
    label: "민원·생활지도",
    preset: "civilComplaint",
    middles: [
      {
        value: "schoolComplaint",
        label: "학부모·학생 민원",
        preset: "civilComplaint",
        minors: [
          { value: "guidance", label: "생활지도", preset: "civilComplaint" },
          { value: "records", label: "기록·증빙", preset: "civilComplaint" },
          { value: "communication", label: "안내문·면담", preset: "civilComplaint" }
        ]
      }
    ]
  }
};

const topicMajorRoleMatrix = {
  auto: [
    "studentPathway",
    "studentSupport",
    "vocationalLearning",
    "employment",
    "fieldTraining",
    "schoolSafety",
    "schoolViolence",
    "schoolAdministration",
    "staffLabor",
    "civilComplaint"
  ],
  student: [
    "studentPathway",
    "studentSupport",
    "vocationalLearning",
    "employment",
    "fieldTraining",
    "schoolSafety",
    "schoolViolence",
    "civilComplaint"
  ],
  parent: [
    "studentPathway",
    "studentSupport",
    "schoolViolence",
    "fieldTraining",
    "employment",
    "schoolSafety",
    "civilComplaint"
  ],
  teacher: [
    "studentPathway",
    "studentSupport",
    "vocationalLearning",
    "fieldTraining",
    "employment",
    "schoolViolence",
    "schoolSafety",
    "civilComplaint",
    "schoolAdministration",
    "staffLabor"
  ],
  fixedTermTeacher: [
    "staffLabor",
    "studentPathway",
    "studentSupport",
    "vocationalLearning",
    "fieldTraining",
    "schoolViolence",
    "schoolSafety",
    "civilComplaint",
    "schoolAdministration"
  ],
  privateSchool: [
    "staffLabor",
    "schoolAdministration",
    "studentPathway",
    "studentSupport",
    "vocationalLearning",
    "fieldTraining",
    "schoolViolence",
    "schoolSafety",
    "civilComplaint"
  ],
  localOfficer: [
    "staffLabor",
    "schoolAdministration",
    "schoolSafety",
    "civilComplaint"
  ],
  educationWorker: [
    "staffLabor",
    "schoolSafety",
    "schoolAdministration",
    "civilComplaint"
  ],
  manager: [
    "schoolAdministration",
    "studentPathway",
    "studentSupport",
    "vocationalLearning",
    "fieldTraining",
    "employment",
    "schoolViolence",
    "schoolSafety",
    "staffLabor",
    "civilComplaint"
  ]
};

function getTopicMajorOptionsForRole(roleCode = "auto") {
  const roleOrder = topicMajorRoleMatrix[roleCode] || topicMajorRoleMatrix.auto;
  const values = ["auto", ...roleOrder];
  const seen = new Set();
  return values
    .filter((value) => {
      if (seen.has(value)) return false;
      if (value !== "auto" && !topicTaxonomy[value]) return false;
      seen.add(value);
      return true;
    })
    .map((value) => ({
      value,
      label: value === "auto" ? topicTaxonomy.auto.label : topicTaxonomy[value].label
    }));
}

const legalBasisCatalog = {
  fieldTrainingOperation: {
    label: "직업교육훈련 촉진법 제7조의2(현장실습 운영기준)",
    detail: "국가·지자체가 재학 중 직업교육훈련생의 현장실습 내실화를 위한 운영기준을 정하도록 한 조문입니다. 학교 운영계획, 배치, 지도·점검 기준을 대조합니다."
  },
  fieldTrainingCompanySelection: {
    label: "직업교육훈련 촉진법 제8조(현장실습산업체의 선정 등)",
    detail: "전공 분야, 현장실습프로그램, 시설·설비 적합성, 후생복지 여건 등을 고려해 산업체를 선정했는지 확인하는 조문입니다."
  },
  fieldTrainingContract: {
    label: "직업교육훈련 촉진법 제9조(현장실습계약 등)",
    detail: "직업교육훈련생과 현장실습산업체가 사전에 현장실습계약을 체결해야 하는 조문입니다. 계약서와 실제 업무 지시를 대조합니다."
  },
  fieldTrainingTime: {
    label: "직업교육훈련 촉진법 제9조의2(현장실습 시간)",
    detail: "미성년자·재학생 현장실습은 1일 7시간, 1주 35시간을 원칙으로 하며 야간·휴일 실습 제한 여부를 확인합니다."
  },
  fieldTrainingCompanyDuty: {
    label: "직업교육훈련 촉진법 제9조의4(현장실습산업체의 책무)",
    detail: "산업체가 적절한 실습환경을 조성하고 직업교육훈련생의 생명과 신체 보호에 협조해야 하는지 확인합니다."
  },
  fieldTrainingSafetyEducation: {
    label: "직업교육훈련 촉진법 제9조의5(현장실습 안전교육 등)",
    detail: "직업교육훈련기관이 현장실습생에게 안전교육 및 노동인권·권익보호 교육을 실시했는지 확인합니다."
  },
  oshEducation: {
    label: "산업안전보건법 제29조(근로자에 대한 안전보건교육)",
    detail: "사업주가 정기·채용·작업내용 변경 시 필요한 안전보건교육을 했는지 확인합니다. 실습생의 실제 작업 수행 여부와 함께 봅니다."
  },
  oshSafetyMeasures: {
    label: "산업안전보건법 제38조(안전조치)",
    detail: "기계·기구·설비, 에너지, 추락·낙하 등 위험으로 인한 산업재해 예방조치가 있었는지 확인합니다."
  },
  oshAccidentReport: {
    label: "산업안전보건법 제57조(산업재해 발생 은폐 금지 및 보고 등)",
    detail: "산업재해 은폐 금지, 발생 원인 기록·보존, 보고 대상 여부를 확인하는 조문입니다."
  },
  oshAccidentReportRule: {
    label: "산업안전보건법 시행규칙 제73조(산업재해 발생 보고 등)",
    detail: "사망 또는 3일 이상 휴업이 필요한 부상·질병이면 산업재해조사표를 1개월 이내 관할 지방고용노동관서에 제출하는지 확인합니다."
  },
  oshMachineGuard: {
    label: "산업안전보건법 제80조(유해하거나 위험한 기계·기구에 대한 방호조치)",
    detail: "동력 기계·기구의 유해·위험 방지를 위한 방호조치, 안전장치, 사용 제공 여부를 확인합니다."
  },
  seriousAccidentDefinition: {
    label: "중대재해 처벌 등에 관한 법률 제2조(정의)",
    detail: "중대산업재해 해당 여부를 사망, 다수 부상, 치료기간 등 법정 요건으로 대조합니다."
  },
  seriousAccidentDuty: {
    label: "중대재해 처벌 등에 관한 법률 제4조(사업주와 경영책임자등의 안전 및 보건 확보의무)",
    detail: "안전보건관리체계, 재발방지 대책, 관계 법령 의무이행 관리조치가 있었는지 확인합니다."
  },
  seriousAccidentContract: {
    label: "중대재해 처벌 등에 관한 법률 제5조(도급·용역·위탁 등 관계에서의 안전 및 보건 확보의무)",
    detail: "학교·기업·위탁기관 등 여러 주체가 얽힌 경우 실질적 지배·운영·관리 관계와 안전보건 확보의무를 확인합니다."
  },
  schoolSafetyCompensation: {
    label: "학교안전사고 예방 및 보상에 관한 법률",
    detail: "학교 교육활동 중 사고인지, 학교안전공제 절차와 보상 가능성을 별도로 확인합니다."
  },
  laborHarassmentBan: {
    label: "근로기준법 제76조의2(직장 내 괴롭힘의 금지)",
    detail: "지위 또는 관계의 우위를 이용해 업무상 적정범위를 넘어 신체적·정신적 고통을 주거나 근무환경을 악화시키는지 확인합니다. 현장실습생 사안에서는 적용·준용 가능성을 원문과 매뉴얼로 대조합니다."
  },
  laborHarassmentAction: {
    label: "근로기준법 제76조의3(직장 내 괴롭힘 발생 시 조치)",
    detail: "신고·인지 후 사실 확인, 피해자 보호, 불리한 처우 금지 등 조치 절차를 확인합니다. 현장실습생 사안에서는 학교와 산업체의 조치 흐름을 함께 봅니다."
  }
};

const factPromptsByTopic = {
  employment: ["근로계약서가 있나요?", "근무 시작일과 종료일은 언제인가요?", "임금·근로시간 조건을 알고 있나요?", "학생 신분과 근로자성이 함께 문제되나요?"],
  apprenticeship: ["도제학교 운영 계획이나 훈련계약이 있나요?", "학교와 기업의 역할이 나뉘어 있나요?", "훈련 장소와 시간이 정리되어 있나요?", "안전교육 기록이 있나요?"],
  fieldTraining: ["실습 협약서가 있나요?", "사고나 문제가 발생한 날짜와 장소는 어디인가요?", "학교·산업체가 어떤 조치를 했나요?", "보호자에게 안내된 자료가 있나요?"],
  overseasTraining: ["파견 국가와 기관은 어디인가요?", "동의서·보험·비상 연락 체계가 있나요?", "현지 사고나 민원이 발생했나요?", "귀국·중단 절차가 안내되었나요?"],
  schoolSafety: ["사고 장소와 시간은 언제인가요?", "피해 정도와 즉시 조치가 기록되어 있나요?", "안전교육·점검 기록이 있나요?", "학교·외부 기관의 역할이 구분되나요?"],
  schoolViolence: ["신고·접수 일자가 언제인가요?", "피해·가해 학생 보호 조치가 있었나요?", "전담기구 확인이나 심의 절차가 진행되었나요?", "2025 학교폭력 사안처리 가이드북이나 관할 교육청 자료를 확인했나요?"],
  schoolAdministration: ["예산·품의·검수·지출 중 어느 단계인가요?", "관할 시도교육청 학교회계 지침이나 학교 내부 규정이 있나요?", "학생부·출결·정정 사안이면 증빙자료와 처리일자가 있나요?", "공문, 회의록, 결재선, 보존기간을 확인해야 하나요?"],
  staffLabor: ["교원, 지방공무원, 교육공무직, 기간제 등 신분이 무엇인가요?", "휴가·출장·근태라면 신청일, 승인권자, 나이스 기록, 증빙이 있나요?", "계약서, 복무규정, 학교법인 또는 교육청 기준이 있나요?", "징계·민원·근로조건 중 어떤 사안인가요?"],
  civilComplaint: ["민원 접수 날짜와 경로가 있나요?", "상담·지도 기록이 시간순으로 정리되어 있나요?", "학교 규정이나 교육청 안내를 확인했나요?", "학생 권리 보호 조치가 필요한가요?"],
  general: ["누가 관련되어 있나요?", "언제·어디서 발생했나요?", "계약서·공문·기록이 있나요?", "학교나 기관이 이미 안내한 내용이 있나요?"]
};

const officialMaterialsByTopic = {
  employment: [
    { type: "law", title: "근로기준법", source: "국가법령정보센터", use: "임금, 근로시간, 휴게, 해고 절차의 기본 기준을 확인합니다.", query: "근로기준법" },
    { type: "law", title: "근로자퇴직급여 보장법", source: "국가법령정보센터", use: "퇴직급여와 퇴직금 관련 기준을 확인합니다.", query: "근로자퇴직급여 보장법" },
    { type: "law", title: "직업교육훈련 촉진법", source: "국가법령정보센터", use: "직업교육훈련과 학생 실습 관련 기준을 함께 확인합니다.", query: "직업교육훈련 촉진법" },
    { type: "admin", title: "근로조건·노동관계 안내", source: "고용노동부", use: "근로조건 해설, 민원 안내, 노동관계 자료를 확인합니다.", query: "근로조건", url: "https://www.moel.go.kr/index.do" }
  ],
  apprenticeship: [
    { type: "law", title: "산업현장 일학습병행 지원에 관한 법률", source: "국가법령정보센터", use: "도제학교와 일학습병행의 법적 기반을 확인합니다.", query: "산업현장 일학습병행 지원에 관한 법률" },
    { type: "law", title: "직업교육훈련 촉진법", source: "국가법령정보센터", use: "직업교육훈련과 현장 훈련 기준을 확인합니다.", query: "직업교육훈련 촉진법" },
    { type: "admin", title: "도제학교·직업계고 정책 자료", source: "교육부", use: "도제학교 운영과 직업계고 정책 자료를 확인합니다.", query: "도제학교", url: "https://www.moe.go.kr/main.do?s=moe" },
    { type: "safety", title: "산업안전보건 교육 자료", source: "안전보건공단", use: "기업훈련과 실습 현장의 안전교육 자료를 확인합니다.", query: "산업안전보건", url: "https://www.kosha.or.kr/kosha/index.do" }
  ],
  fieldTraining: [
    {
      type: "law",
      title: "직업교육훈련 촉진법",
      source: "국가법령정보센터",
      use: "현장실습 운영, 산업체 선정, 협약서, 실습시간, 안전교육 기준을 우선 대조합니다.",
      query: "직업교육훈련 촉진법",
      provisions: [
        { title: "제7조의2 현장실습 운영기준", why: "산업체 선정, 프로그램, 지도·감독 기준이 현장실습 운영기준 안에 있었는지 봅니다.", check: "학교 운영계획, 실습 배치표, 지도교사 방문·점검 기록을 대조합니다." },
        { title: "제8조 현장실습산업체의 선정 등", why: "학생 전공, 실습프로그램, 시설·설비, 후생복지 여건을 고려했는지 확인합니다.", check: "실습기업 선정 자료, 사전 현장실사, 위험 기계 보유 여부를 확인합니다." },
        { title: "제9조 현장실습계약 등", why: "표준협약서, 권리·의무, 실습내용, 기간·시간, 복리후생 기재 여부를 확인합니다.", check: "학생·기업·학교가 보관한 협약서 원본과 실제 지시 내용을 비교합니다." },
        { title: "제9조의2 현장실습 시간", why: "실습시간, 연장, 야간·휴일 실습 여부가 쟁점이면 반드시 봅니다.", check: "출퇴근 기록, 실습일지, 사고 시각이 실습시간 안인지 확인합니다." },
        { title: "제9조의5 현장실습 안전교육", why: "사고 전 안전교육과 노동인권·권익보호 교육이 이루어졌는지 확인합니다.", check: "교육자료, 서명부, 교육일자, 교육자가 누구였는지 대조합니다." }
      ],
      actionChecks: [
        "현장실습 협약서와 표준협약서가 실제 업무 범위와 맞는지 확인",
        "사고가 실습시간·실습장소·공식 업무 안에서 발생했는지 확인",
        "학교 지도·점검, 보호자 안내, 실습 중단 검토 기록 확인"
      ]
    },
    {
      type: "law",
      title: "산업안전보건법",
      source: "국가법령정보센터",
      use: "기계·기구 사고, 안전교육, 방호조치, 산업재해 보고 여부를 대조합니다.",
      query: "산업안전보건법",
      provisions: [
        { title: "제29조 근로자에 대한 안전보건교육", why: "실습생이 실제 작업을 했다면 작업 전 안전교육의 범위와 기록을 확인합니다.", check: "신규·작업변경·특별교육 자료와 서명부를 확보합니다." },
        { title: "제38조 안전조치", why: "기계·기구·설비에 의한 위험을 예방하기 위한 필요한 조치가 있었는지 봅니다.", check: "작업표준서, 감독자 배치, 보호구 지급, 접근금지·정지 절차를 확인합니다." },
        { title: "제57조 산업재해 발생 은폐 금지 및 보고 등", why: "골절처럼 휴업이 예상되는 부상은 보고·조사표 제출 대상인지 대조해야 합니다.", check: "산업재해조사표, 회사 사고보고서, 관할 지방고용노동관서 보고 여부를 확인합니다." },
        { title: "제80조 유해하거나 위험한 기계·기구에 대한 방호조치", why: "동력 기계의 방호덮개, 안전장치, 비상정지 장치가 사고와 직접 연결될 수 있습니다.", check: "기계 점검표, 방호장치 사진, 사고 당시 장치 작동 여부를 확인합니다." }
      ],
      caseHints: [
        { title: "기계 끼임·말림·부딪힘 재해사례", why: "방호장치 제거, 비상정지 미작동, 작업 중 접근 허용 여부가 반복 쟁점입니다.", check: "안전보건공단 국내재해사례에서 같은 기계·공정·부상 유형을 검색합니다." },
        { title: "정비·청소·친구 작업 지원 중 사고사례", why: "공식 지시인지 개인적 도움인지, 작업허가와 감독이 있었는지가 책임 확인의 핵심입니다.", check: "작업지시자, 허락 여부, 전원 차단, 출입통제, 목격자 진술을 정리합니다." }
      ],
      actionChecks: [
        "사고 직후 치료·보고·현장 보존 조치가 있었는지 시간순으로 정리",
        "기계 방호장치, 비상정지, 보호구, 작업표준서, 위험성평가 자료 확보",
        "산재·보험·학교안전 관련 절차가 중복 또는 누락되지 않았는지 확인"
      ]
    },
    {
      type: "law",
      title: "중대재해 처벌 등에 관한 법률",
      source: "국가법령정보센터",
      use: "중대한 안전사고 가능성이 있을 때 요건과 안전보건관리체계를 확인합니다.",
      query: "중대재해 처벌 등에 관한 법률",
      provisions: [
        { title: "제2조 정의", why: "사망, 동일 사고 부상자 수, 장기 치료 질병 등 중대산업재해 요건을 먼저 대조합니다.", check: "골절 1건만으로 단정하지 말고 진단서, 치료기간, 부상자 수를 확인합니다." },
        { title: "제4조 안전 및 보건 확보의무", why: "재해예방 인력·예산, 안전보건관리체계, 재발방지 대책이 있었는지 봅니다.", check: "회사 안전보건관리체계 문서와 사고 후 재발방지 계획을 확인합니다." },
        { title: "제5조 도급·용역·위탁 등 관계의 안전 및 보건 확보의무", why: "학교, 기업, 위탁기관 등 여러 기관이 얽힌 경우 관계를 확인합니다.", check: "실습 위탁 구조, 계약관계, 실제 지배·운영·관리 주체를 정리합니다." }
      ],
      actionChecks: [
        "중대재해 해당 여부는 요건 검토 전 단정하지 않기",
        "재발방지 대책과 안전보건관리체계 자료를 회사에 요청할 수 있는지 확인",
        "중대한 부상·분쟁 가능성이 있으면 노무사·변호사·관계기관 상담 기록 남기기"
      ]
    },
    {
      type: "admin",
      title: "직업계고 현장실습 자료",
      source: "교육부·교육청",
      use: "학교 현장실습 운영 매뉴얼, 표준협약서, 사고 보고와 보호자 안내 절차를 확인합니다.",
      query: "직업계고 현장실습",
      url: "https://www.moe.go.kr/main.do?s=moe",
      caseHints: [
        { title: "현장실습 사고 보고·실습 중단 사례", why: "학교가 학생 보호, 보호자 통보, 교육청 보고를 어떻게 처리해야 하는지 봅니다.", check: "관할 교육청 현장실습 매뉴얼과 학교 내부 보고 양식을 함께 확인합니다." },
        { title: "표준협약서·실습일지 누락 사례", why: "문서가 빠졌거나 실제 업무가 협약과 다르면 책임 확인이 어려워집니다.", check: "협약서, 실습일지, 기업 담당자 확인서, 지도교사 상담기록을 모읍니다." }
      ],
      actionChecks: [
        "관할 교육청의 최신 현장실습 운영 매뉴얼과 학교 내부 지침 확인",
        "보호자 안내문, 실습 중단 여부, 학생 평가·출결 처리 기준 확인",
        "교육청 보고가 필요한 사안인지 관리자와 즉시 검토"
      ]
    }
  ],
  overseasTraining: [
    { type: "law", title: "직업교육훈련 촉진법", source: "국가법령정보센터", use: "해외 현장실습도 직업교육훈련의 기본 틀에서 확인합니다.", query: "직업교육훈련 촉진법" },
    { type: "law", title: "초중등교육법", source: "국가법령정보센터", use: "학생 지도와 학교 운영의 기본 근거를 확인합니다.", query: "초중등교육법" },
    { type: "admin", title: "글로벌 현장학습·직업계고 자료", source: "교육부", use: "해외 실습 운영과 파견 전 확인 자료를 찾습니다.", query: "글로벌 현장학습", url: "https://www.moe.go.kr/main.do?s=moe" },
    { type: "admin", title: "해외안전여행 정보", source: "외교부", use: "파견 국가의 안전정보와 위기 대응 자료를 확인합니다.", query: "해외안전여행", url: "https://www.0404.go.kr" }
  ],
  schoolSafety: [
    {
      type: "law",
      title: "중대재해 처벌 등에 관한 법률",
      source: "국가법령정보센터",
      use: "중대재해 관련 안전보건 관리체계와 재발방지 조치 후보를 확인합니다.",
      query: "중대재해 처벌 등에 관한 법률",
      provisions: [
        { title: "제2조 정의", why: "중대산업재해·중대시민재해 해당 요건을 먼저 나눕니다.", check: "사망 여부, 부상자 수, 치료기간, 질병 요건을 자료로 확인합니다." },
        { title: "제4조 안전 및 보건 확보의무", why: "기관이나 사업장의 안전보건관리체계와 재발방지 대책이 핵심입니다.", check: "예산·인력·점검·개선명령 이행 자료를 확인합니다." }
      ],
      actionChecks: ["중대재해 여부를 단정하기 전 법정 요건 확인", "재발방지 대책과 사고 조사 기록 확보", "교육청·고용노동부·전문가 상담 필요 여부 검토"]
    },
    {
      type: "law",
      title: "산업안전보건법",
      source: "국가법령정보센터",
      use: "학교와 실습 현장의 안전보건 기준, 교육, 방호조치, 보고 의무를 확인합니다.",
      query: "산업안전보건법",
      provisions: [
        { title: "제29조 근로자에 대한 안전보건교육", why: "작업 전 교육과 특별교육 대상 여부를 확인합니다.", check: "교육자료, 서명부, 교육일자를 확보합니다." },
        { title: "제38조 안전조치", why: "위험 기계·설비·작업장소에 필요한 예방조치가 있었는지 봅니다.", check: "점검표, 보호구, 작업표준서, 감독자 기록을 확인합니다." },
        { title: "제57조 산업재해 발생 은폐 금지 및 보고 등", why: "사고 보고와 조사표 제출 대상인지 확인합니다.", check: "회사 보고서, 병원 진단서, 휴업 예상 기간을 대조합니다." }
      ],
      caseHints: [
        { title: "끼임·떨어짐·부딪힘 3대 사고유형", why: "안전보건 자료에서 반복적으로 다루는 고위험 유형입니다.", check: "사고 유형별 예방자료와 국내재해사례를 함께 검색합니다." }
      ]
    },
    {
      type: "law",
      title: "학교안전사고 예방 및 보상에 관한 법률",
      source: "국가법령정보센터",
      use: "학교 교육활동 중 사고인지, 학교안전공제와 보상 절차가 연결되는지 확인합니다.",
      query: "학교안전사고 예방 및 보상에 관한 법률",
      actionChecks: ["교육활동 해당 여부 확인", "학교안전공제회 절차와 산업재해 절차가 혼동되지 않도록 구분", "치료비·보상 관련 안내 기록 보관"]
    },
    {
      type: "safety",
      title: "안전보건 자료",
      source: "안전보건공단",
      use: "위험성 평가, 안전교육, 사고 예방, 국내재해사례 자료를 확인합니다.",
      query: "안전보건",
      url: "https://www.kosha.or.kr/kosha/index.do",
      caseHints: [
        { title: "기계·설비 방호장치 사례", why: "방호덮개, 인터록, 비상정지, 출입통제가 사고 예방의 직접 자료가 됩니다.", check: "사고 기계와 같은 설비명으로 자료를 검색합니다." },
        { title: "현장 안전교육 OPS·교안", why: "학교와 기업이 사고 전후 교육자료로 활용할 수 있습니다.", check: "실습 직무와 같은 공정의 OPS, 교안, 동영상 링크를 모읍니다." }
      ]
    }
  ],
  schoolViolence: [
    {
      type: "admin",
      title: "2025년 학교폭력 사안처리 가이드북",
      source: "교육부·시도교육청",
      use: "신고, 접수, 조사, 전담기구 확인, 심의 요청, 조치, 불복 절차를 학교 현장 기준으로 확인합니다.",
      query: "2025년 학교폭력 사안처리 가이드북",
      url: "https://www.cbe.go.kr/dept-21/na/ntt/selectNttInfo.do?mi=11221&nttSn=1548192",
      actionChecks: [
        "신고·접수일과 상담·진술·증거 자료를 시간순으로 정리",
        "피해학생 보호조치와 관련 학생 분리 필요성 확인",
        "전담기구 확인, 심의 요청, 조치 결정, 불복 가능 단계 구분"
      ]
    },
    { type: "law", title: "학교폭력예방 및 대책에 관한 법률", source: "국가법령정보센터", use: "학교폭력 사안 처리의 법적 근거와 학생 보호·선도·분쟁조정 기준을 확인합니다.", query: "학교폭력예방 및 대책에 관한 법률" },
    { type: "law", title: "학교폭력예방 및 대책에 관한 법률 시행령", source: "국가법령정보센터", use: "심의, 전담기구, 피해학생 지원, 교육·예방 등 시행 절차를 확인합니다.", query: "학교폭력예방 및 대책에 관한 법률 시행령" },
    { type: "law", title: "초중등교육법", source: "국가법령정보센터", use: "학생 지도와 학교 운영의 기본 근거를 확인합니다.", query: "초중등교육법" },
    { type: "case", title: "학교폭력 판례·법률자료", source: "국회법률도서관·법원 판례 검색", use: "비슷한 사안에서 다투어진 쟁점을 보조적으로 확인합니다.", query: "학교폭력" }
  ],
  schoolAdministration: [
    {
      type: "admin",
      title: "2026학년도 학교생활기록부 기재요령",
      source: "학교생활기록부 종합지원포털",
      use: "학생생활기록부 기재, 출결, 정정, 증빙 보관 사안에서 당해 학년도 공식 기재 기준을 먼저 확인합니다.",
      query: "2026학년도 학교생활기록부 기재요령 고등학교",
      url: "https://star.moe.go.kr/web/contents/m21100.do",
      actionChecks: [
        "학교급과 학년도 확인",
        "정정 사유, 처리일자, 증빙자료, 결재 기록 확인",
        "출결·창의적 체험활동·세부능력 특기사항 등 항목별 기재 금지·유의사항 확인"
      ]
    },
    {
      type: "admin",
      title: "학교생활기록 작성 및 관리지침",
      source: "국가법령정보센터·교육부",
      use: "학교생활기록의 작성·관리·정정 업무 원칙과 권한, 자료 입력 기준을 확인합니다.",
      query: "학교생활기록 작성 및 관리지침",
      url: "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000188164",
      actionChecks: [
        "담당 사용자 권한과 학교장 승인 흐름 확인",
        "관찰·평가 근거와 보조부·전산자료 보관 상태 확인",
        "개인정보와 학생 권리 보호 기준 확인"
      ]
    },
    {
      type: "law",
      title: "국립 유치원 및 초·중등학교 회계규칙",
      source: "국가법령정보센터",
      use: "학교회계 예산, 수입·지출, 출납, 계약·검수, 증빙 보관 기준을 확인합니다.",
      query: "국립 유치원 및 초·중등학교 회계규칙",
      url: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=210514",
      actionChecks: [
        "예산 편성·추경·집행 단계 구분",
        "품의, 계약, 검수, 지출결의, 영수증·세금계산서 등 증빙 확인",
        "출납원·임시출납원·학교장 결재 흐름 확인"
      ]
    },
    {
      type: "admin",
      title: "시도교육청 학교회계 예산편성 기본지침",
      source: "시도교육청",
      use: "관할 교육청별 예산 편성 기준, 사업비 집행 제한, 증빙 요구가 다른지 확인합니다.",
      query: "학교회계 예산편성 기본지침 지출 증빙"
    },
    {
      type: "law",
      title: "지방자치단체를 당사자로 하는 계약에 관한 법률",
      source: "국가법령정보센터",
      use: "학교 물품·용역·공사 계약, 수의계약, 검수, 계약상대자 관련 기준을 보조적으로 확인합니다.",
      query: "지방자치단체를 당사자로 하는 계약에 관한 법률"
    }
  ],
  staffLabor: [
    {
      type: "admin",
      title: "교원휴가에 관한 예규",
      source: "국가법령정보센터·교육부",
      use: "교원의 연가, 병가, 공가, 특별휴가, 수업일 중 연가 신청, 나이스 근무상황 처리 기준을 확인합니다.",
      query: "교원휴가에 관한 예규",
      url: "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulId=20578&efYd=0",
      actionChecks: [
        "교원 신분, 수업일·휴업일 여부, 휴가 종류 확인",
        "나이스 근무상황 신청 사유와 학교장 승인 흐름 확인",
        "질병 관련 증빙자료 요구 여부를 원문과 교육청 기준으로 확인"
      ]
    },
    { type: "law", title: "국가공무원 복무규정", source: "국가법령정보센터", use: "국가공무원 복무, 근무시간, 휴가, 공가 등 기본 기준을 확인합니다.", query: "국가공무원 복무규정" },
    { type: "law", title: "지방공무원 복무규정", source: "국가법령정보센터", use: "교육감 소속 지방공무원과 학교 행정직 복무 기준을 확인합니다.", query: "지방공무원 복무규정" },
    { type: "law", title: "공무원 여비 규정", source: "국가법령정보센터", use: "출장명령, 국내·국외 여비, 운임·숙박비·일비, 증빙자료 기준을 확인합니다.", query: "공무원 여비 규정", url: "https://www.law.go.kr/LSW/lsInfoP.do?lsId=009402&urlMode=lsInfoP" },
    { type: "law", title: "교육공무원법", source: "국가법령정보센터", use: "정규 교사와 교육공무원 신분·복무 기준을 확인합니다.", query: "교육공무원법" },
    { type: "law", title: "사립학교법", source: "국가법령정보센터", use: "사립학교 교직원 관련 기준을 확인합니다.", query: "사립학교법" },
    { type: "law", title: "근로기준법", source: "국가법령정보센터", use: "교육공무직, 행정직원, 계약직 근로관계 사안의 기본 기준을 확인합니다.", query: "근로기준법" },
    { type: "law", title: "기간제 및 단시간근로자 보호 등에 관한 법률", source: "국가법령정보센터", use: "기간제·단시간 근로자 보호 기준과 차별·계약기간 쟁점을 확인합니다.", query: "기간제 및 단시간근로자 보호 등에 관한 법률" }
  ],
  civilComplaint: [
    { type: "law", title: "초중등교육법", source: "국가법령정보센터", use: "학생관리와 학교 운영의 기본 근거를 확인합니다.", query: "초중등교육법" },
    { type: "law", title: "행정절차법", source: "국가법령정보센터", use: "처분, 의견제출, 절차 안내가 필요한 사안에서 확인합니다.", query: "행정절차법" },
    { type: "admin", title: "학교생활기록 작성 및 관리지침", source: "교육부", use: "학생 기록과 관리 기준이 필요한 경우 확인합니다.", query: "학교생활기록 작성 및 관리지침", url: "https://www.moe.go.kr/main.do?s=moe" },
    { type: "admin", title: "교육부·교육청 민원 안내", source: "교육부·교육청", use: "민원 접수, 답변, 처리 절차를 확인합니다.", query: "학교 민원 처리", url: "https://www.moe.go.kr/main.do?s=moe" }
  ],
  general: [
    { type: "law", title: "국가법령정보센터 통합검색", source: "국가법령정보센터", use: "질문 핵심어와 관련된 법령을 먼저 찾습니다.", query: "법령 검색" },
    { type: "admin", title: "교육부 자료 확인", source: "교육부", use: "학교 현장 관련 공식 자료를 확인합니다.", query: "교육부 자료", url: "https://www.moe.go.kr/main.do?s=moe" },
    { type: "case", title: "판례·법률자료 검색", source: "국회법률도서관·법원 판례 검색", use: "비슷한 분쟁의 판단 기준을 보조적으로 확인합니다.", query: "판례" }
  ]
};

const highRiskWords = ["소송", "고소", "고발", "형사", "사망", "중상", "해고", "징계", "손해배상", "폭행", "성폭력", "성희롱", "아동학대", "명예훼손", "자살", "중대재해"];

const reportProfileFields = [
  { name: "schoolName", label: "학교명", placeholder: "예: ○○공업고등학교" },
  { name: "studentLabel", label: "학생명 또는 식별명", placeholder: "예: 홍길동, 2학년 전기과 학생 A" },
  { name: "teacherName", label: "담당자", placeholder: "예: 담임 김○○, 현장실습 담당 이○○" },
  { name: "companyName", label: "파견 기업·기관", placeholder: "예: ○○테크 생산1팀" },
  { name: "currentStatus", label: "현재 조치·추가 메모", placeholder: "예: 학생 상담 완료, 기업 확인 중, 보호자 안내 예정", multiline: true },
  { name: "drafterName", label: "작성자·검토자", placeholder: "예: 취업지도부 김○○ / 관리자 검토 예정" }
];

const topicPresets = [
  {
    type: "employment",
    keys: ["취업", "근로계약", "임금", "퇴직", "해고", "채용"],
    title: "취업과 근로계약 관련 법령",
    summary: "취업 단계에서는 근로계약, 임금, 근로시간, 휴게, 퇴직급여, 해고 절차를 함께 확인하는 것이 좋습니다.",
    laws: ["근로기준법", "근로자퇴직급여 보장법", "직업교육훈련 촉진법"],
    tags: ["취업", "근로계약", "임금", "근로시간"],
    checklist: ["근로계약서와 채용 조건을 모읍니다.", "근로시간, 임금, 휴게 조건을 분리해 적습니다.", "원문 검색으로 관련 법령명을 확인합니다."]
  },
  {
    type: "apprenticeship",
    keys: ["도제", "도제학교", "산학일체형", "훈련", "기업훈련"],
    title: "도제학교와 기업훈련 관련 법령",
    summary: "도제학교는 학교 교육과 기업훈련이 함께 이루어지므로 학생 보호, 훈련계약, 근로시간, 안전관리 기준을 나누어 확인해야 합니다.",
    laws: ["산업현장 일학습병행 지원에 관한 법률", "직업교육훈련 촉진법", "근로기준법"],
    tags: ["도제학교", "일학습병행", "학생 보호", "기업훈련"],
    checklist: ["훈련계약과 학교 안내문을 확인합니다.", "학생 신분과 근로자성 판단이 필요한 지점을 표시합니다.", "안전관리와 근로시간 관련 원문을 함께 확인합니다."]
  },
  {
    type: "fieldTraining",
    keys: ["현장실습", "실습", "산업체", "안전사고", "실습생"],
    title: "현장실습과 학생 권익 관련 법령",
    summary: "현장실습은 실습 협약, 업무 범위, 학생 권익, 산업체 책임, 학교의 지도·점검 절차를 함께 확인해야 합니다.",
    laws: ["직업교육훈련 촉진법", "근로기준법", "산업안전보건법"],
    tags: ["현장실습", "업무범위", "실습 협약", "학생 권익"],
    checklist: ["실습 협약서와 운영 계획을 준비합니다.", "문제 발생 일시, 장소, 지시 내용과 반복 여부를 시간순으로 정리합니다.", "학교와 산업체의 지도·점검 및 권익보호 기준 관련 원문을 확인합니다."]
  },
  {
    type: "overseasTraining",
    keys: ["해외", "호주", "글로벌", "해외현장실습", "해외 현장실습"],
    title: "해외 현장실습과 학생 보호 관련 자료",
    summary: "해외 현장실습은 국내 법령뿐 아니라 파견 전 동의, 안전관리, 보험, 현지 기관 안내, 비상 대응 절차를 함께 확인해야 합니다.",
    laws: ["직업교육훈련 촉진법", "초중등교육법", "청소년복지 지원법"],
    tags: ["해외 현장실습", "호주", "안전관리", "보호자 동의"],
    checklist: ["파견 계획서, 동의서, 보험 자료를 모읍니다.", "현지 기관과 학교의 역할을 나눠 적습니다.", "국내 법령과 공식 안내 자료를 함께 확인합니다."]
  },
  {
    type: "schoolSafety",
    keys: ["중대재해", "안전", "사고", "산업안전", "위험"],
    title: "중대재해와 학교 안전관리 관련 법령",
    summary: "학교 현장의 안전 문제는 학교장, 교육청, 실습 기관의 역할과 안전보건 관리체계를 나누어 확인하는 흐름이 필요합니다.",
    laws: ["중대재해 처벌 등에 관한 법률", "산업안전보건법", "학교안전사고 예방 및 보상에 관한 법률"],
    tags: ["중대재해", "안전보건", "학교 안전", "관리체계"],
    checklist: ["사고 유형과 장소를 구분합니다.", "학교, 교육청, 외부 기관의 책임 범위를 정리합니다.", "안전보건 관리체계 관련 원문을 확인합니다."]
  },
  {
    type: "schoolViolence",
    keys: ["학교폭력", "학폭", "괴롭힘", "폭력", "심의"],
    title: "학교폭력과 교육 절차 관련 법령",
    summary: "학교폭력 사안은 신고, 조사, 전담기구 확인, 심의, 조치 결정, 불복 절차가 구분됩니다. 관할 교육청 안내도 함께 확인해야 합니다.",
    laws: ["학교폭력예방 및 대책에 관한 법률", "초중등교육법"],
    tags: ["학교폭력", "심의 절차", "학생 보호", "교육청"],
    checklist: ["발생 일시와 관련 자료를 시간순으로 정리합니다.", "학교와 교육청의 공식 절차 안내를 확인합니다.", "법령 원문과 관할 기관 안내를 함께 확인합니다."]
  },
  {
    type: "schoolAdministration",
    keys: ["교육행정", "학교회계", "예산", "품의", "검수", "지출", "증빙", "생활기록부", "생기부", "학생부", "출결", "정정", "공문", "정보공개", "회의록"],
    title: "교육행정과 학교회계·학생기록 관련 규정",
    summary: "학교 행정 질문은 신분·업무 단계와 관할 교육청 지침을 먼저 나누고, 법령·훈령·예규·교육청 기준을 함께 확인해야 합니다.",
    laws: ["학교생활기록 작성 및 관리지침", "국립 유치원 및 초·중등학교 회계규칙", "초중등교육법", "지방자치단체를 당사자로 하는 계약에 관한 법률"],
    tags: ["교육행정", "학교회계", "학생생활기록", "지출 증빙"],
    checklist: ["업무 단계를 예산 편성, 품의, 계약, 검수, 지출, 정산 중 하나로 구분합니다.", "관할 시도교육청 지침과 학교 내부 결재·보존 기준을 확인합니다.", "학생부·출결 사안은 당해 학년도 기재요령과 증빙자료를 함께 대조합니다."]
  },
  {
    type: "staffLabor",
    keys: ["기간제", "교사", "행정직", "상근", "교직원", "복무", "징계", "휴가", "출장", "근태", "연가", "병가", "공가", "특별휴가", "여비"],
    title: "교직원과 행정직 인사·노무 관련 법령",
    summary: "교직원과 행정직 사안은 신분, 계약 형태, 휴가·출장·근태 기준, 징계 절차, 근로관계 여부를 먼저 나누어 확인해야 합니다.",
    laws: ["교원휴가에 관한 예규", "국가공무원 복무규정", "지방공무원 복무규정", "공무원 여비 규정", "근로기준법"],
    tags: ["교직원", "기간제", "행정직", "근태·휴가"],
    checklist: ["교원, 지방공무원, 교육공무직, 기간제 등 신분을 먼저 구분합니다.", "휴가·출장·근태라면 신청일, 승인권자, 나이스 기록, 증빙을 확인합니다.", "교육공무원 규정, 복무규정, 근로관계 법령, 교육청 기준을 함께 확인합니다."]
  },
  {
    type: "civilComplaint",
    keys: ["민원", "학생관리", "학부모", "생활지도", "징계", "상담", "안내문", "면담"],
    title: "학생관리와 학교 민원 관련 법령",
    summary: "학생관리와 민원은 사실관계 기록, 학교 규정, 학생 권리 보호, 학부모 안내 절차를 함께 정리하는 것이 중요합니다.",
    laws: ["초중등교육법", "학교생활기록 작성 및 관리지침", "행정절차법"],
    tags: ["학생관리", "민원", "생활지도", "기록"],
    checklist: ["사실관계와 상담 기록을 시간순으로 정리합니다.", "학교 규정과 교육청 안내를 확인합니다.", "학생 권리와 학교의 조치 절차 관련 원문을 확인합니다."]
  }
];

const fallbackPreset = {
  type: "general",
  title: "질문과 관련된 법령 검색",
  summary: "입력한 질문의 핵심 단어를 기준으로 법령 원문 검색부터 확인하세요. 실제 API 연결 후에는 관련 조문, 판례, 행정자료 후보를 함께 정렬합니다.",
  laws: ["대한민국 현행 법령", "관련 판례", "공식 행정자료"],
  tags: ["법령 검색", "판례 확인", "행정자료", "원문 근거"],
  checklist: ["질문에서 대상, 장소, 날짜, 기관을 분리합니다.", "관련 키워드로 법령 원문을 검색합니다.", "결과를 실제 사안에 적용하기 전 전문가에게 확인합니다."]
};

initializeTopicControls();
initializePolicyCategoryControls();

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    resetTransientQuestionState({ keepFormValues: true });
    questionInput.value = button.dataset.example;
    setTopicSelection(button.dataset.topicMajor || "auto", button.dataset.topicMiddle || "auto", button.dataset.topicMinor || "auto");
    questionInput.focus();
  });
});

document.querySelectorAll("[data-guide-question]").forEach((button) => {
  button.addEventListener("click", () => {
    activateTool("guide");
    guideQuestionInput.value = button.dataset.guideQuestion || "";
    if (button.dataset.guideRole) guideRoleInput.value = button.dataset.guideRole;
    updateGuideCategoryOptionsForRole({ keepValue: true });
    if (button.dataset.guideCategory) guideCategoryInput.value = button.dataset.guideCategory;
    renderPolicyGuideResult();
    guideQuestionInput.focus();
  });
});

toolTabs.forEach((tab) => {
  tab.addEventListener("click", (event) => {
    event.preventDefault();
    userSelectedTool = true;
    activateTool(tab.dataset.toolTab || "legal", { updateHash: true, scroll: true });
  });
});

toolLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    userSelectedTool = true;
    activateTool(link.dataset.toolLink || "legal", { updateHash: true, scroll: true });
  });
});

resetQuestionButton?.addEventListener("click", () => {
  activateTool("legal");
  resetTransientQuestionState({ resetFormValues: true });
  questionInput.focus();
});

resetGuideButton?.addEventListener("click", () => {
  guideQuestionInput.value = "";
  guideOfficeInput.value = "gyeongbuk";
  guideRoleInput.value = "auto";
  guideCategoryInput.value = "auto";
  updateGuideCategoryOptionsForRole({ keepValue: false });
  showGuideEmptyState();
  guideQuestionInput.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  activateTool("legal");

  const question = questionInput.value.trim();
  if (!question) {
    resetTransientQuestionState({ keepFormValues: true });
    showEmptyMessage("질문을 입력해 주세요.", "취업, 현장실습, 학교 민원처럼 궁금한 상황을 한 문장으로 적어도 괜찮습니다.");
    questionInput.focus();
    return;
  }

  syncTopicTypeInput();
  const scopes = [...form.querySelectorAll("input[name='scope']:checked")].map((input) => input.value);
  const manualTopicContext = getSelectedTopicContext();
  const preset = findPreset(question, manualTopicContext.presetType);
  const selectedTopicContext = resolveTopicContext(question, preset, manualTopicContext);
  await renderResult(question, preset, scopes, answerModeInput.value, userRoleInput.value, partyRoleInput.value, selectedTopicContext);
  if (skipNextAutoScroll) {
    skipNextAutoScroll = false;
  } else {
    window.setTimeout(() => {
      const targetTop = Math.max(0, (resultPanel?.offsetTop || 0) - 88);
      window.scrollTo(0, targetTop);
    }, 0);
  }
});

guideForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  activateTool("guide");
  renderPolicyGuideResult();
});

guideQuestionInput?.addEventListener("input", schedulePolicyGuideAutoRender);
[guideOfficeInput, guideRoleInput, guideCategoryInput].forEach((input) => {
  input?.addEventListener("change", schedulePolicyGuideAutoRender);
});

window.addEventListener("hashchange", activateToolFromHash);
document.body?.addEventListener("gyo6-auth-state", (event) => {
  if (!syncLawWindowMode() || userSelectedTool || window.location?.hash || getRequestedToolParam()) {
    return;
  }

  activateTool("legal");
});

resultState.addEventListener("submit", (event) => {
  if (event.target?.id === "guideIntentConfirmForm") {
    event.preventDefault();
    applyLegalGuideIntentConfirmation(event.target);
    return;
  }

  if (event.target?.id === "guideClarifierForm") {
    event.preventDefault();
    applyLegalGuideClarifierAnswers(event.target);
    return;
  }

  if (event.target?.id === "clarifierForm") {
    event.preventDefault();
    applyClarifierAnswers(event.target);
  }
});

guideResult?.addEventListener("submit", (event) => {
  if (event.target?.id === "guideIntentConfirmForm") {
    event.preventDefault();
    applyGuideIntentConfirmation(event.target);
    return;
  }

  if (event.target?.id !== "guideClarifierForm") {
    return;
  }

  event.preventDefault();
  applyGuideClarifierAnswers(event.target);
});

guideResult?.addEventListener("click", (event) => {
  const followupButton = event.target instanceof Element
    ? event.target.closest("[data-guide-followup]")
    : null;
  if (!followupButton) return;

  event.preventDefault();
  applyGuideFollowupRequest(followupButton);
});

resultState.addEventListener("click", (event) => {
  const toolLink = event.target instanceof Element
    ? event.target.closest("[data-tool-link]")
    : null;
  if (toolLink) {
    event.preventDefault();
    userSelectedTool = true;
    activateTool(toolLink.dataset.toolLink || "legal", { updateHash: true, scroll: true });
    return;
  }

  const guideFollowup = event.target instanceof Element
    ? event.target.closest("[data-guide-followup]")
    : null;
  if (guideFollowup) {
    event.preventDefault();
    applyLegalFollowupRequest(guideFollowup);
    return;
  }

  const target = event.target instanceof Element
    ? event.target.closest("[data-print-report], [data-save-report], [data-download-report], [data-open-saved-report], [data-download-saved-report], [data-delete-saved-report]")
    : null;
  if (!target) {
    return;
  }

  if (target.matches("[data-print-report]")) {
    const savedReport = finalizeAndSaveReport();
    updateReportComposerFeedback(`보고서 자료실에 저장했습니다. 문서번호 ${savedReport.documentNo}`);
    document.body.classList.add("printing-report");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-report"), 500);
    return;
  }

  if (target.matches("[data-save-report]")) {
    const savedReport = finalizeAndSaveReport();
    updateReportComposerFeedback(`보고서 자료실에 저장했습니다. 문서번호 ${savedReport.documentNo}`);
    return;
  }

  if (target.matches("[data-download-report]")) {
    const savedReport = finalizeAndSaveReport();
    downloadSavedReport(savedReport);
    updateReportComposerFeedback("HTML 보고서 파일을 만들었습니다.");
    return;
  }

  if (target.matches("[data-open-saved-report]")) {
    openSavedReport(target.dataset.reportId);
    return;
  }

  if (target.matches("[data-download-saved-report]")) {
    downloadSavedReport(target.dataset.reportId);
    return;
  }

  if (target.matches("[data-delete-saved-report]")) {
    deleteSavedReport(target.dataset.reportId);
  }
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("printing-report");
});

activateToolFromHash();
hydrateFromUrl();

function activateToolFromHash() {
  if (!syncLawWindowMode()) {
    return;
  }

  const requestedTool = getRequestedToolFromUrl() || getToolFromHash(window.location?.hash || "");
  activateTool(requestedTool);
}

function syncLawWindowMode() {
  const requestedTool = getRequestedToolParam();
  const isToolWindow = Boolean(requestedTool);
  document.body?.classList.toggle("law-tool-mode", isToolWindow);
  document.body?.classList.toggle("law-landing", !isToolWindow);
  document.body?.classList.toggle("law-tool-legal", isToolWindow && requestedTool === "legal");
  document.body?.classList.toggle("law-tool-guide", isToolWindow && requestedTool === "guide");
  return isToolWindow;
}

function getRequestedToolFromUrl() {
  const requestedParam = getRequestedToolParam();
  if (requestedParam) {
    return requestedParam;
  }

  return getExplicitToolFromHash(window.location?.hash || "");
}

function getRequestedToolParam() {
  try {
    const params = new URLSearchParams(window.location?.search || "");
    const rawTool = String(params.get("tool") || params.get("mode") || "").trim().toLowerCase();
    if (["guide", "free", "free-guide", "qna", "qa"].includes(rawTool)) return "legal";
    if (["legal", "law", "login", "ai"].includes(rawTool)) return "legal";
  } catch {
    return "";
  }

  return "";
}

function getExplicitToolFromHash(hash = "") {
  const target = String(hash || "").replace("#", "");
  if (target === "guideQa" || target === "guideForm") return "legal";
  if (target === "legalTool" || target === "queryForm") return "legal";
  return "";
}

function getToolFromHash(hash = "") {
  return getExplicitToolFromHash(hash) || "legal";
}

function activateTool(tool = "legal", { updateHash = false, scroll = false } = {}) {
  const nextTool = "legal";
  const targetHash = "#legalTool";

  toolPanels.forEach((panel) => {
    const isActive = panel.dataset.toolPanel === nextTool;
    panel.hidden = !isActive;
    panel.classList.toggle("active-tool", isActive);
  });

  toolTabs.forEach((tab) => {
    const isActive = tab.dataset.toolTab === nextTool;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  if (updateHash && window.location && window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }

  if (scroll && typeof window.scrollTo === "function") {
    window.setTimeout(() => {
      const target = document.querySelector(".tool-tabs");
      const targetTop = Math.max(0, (target?.offsetTop || 0) - 88);
      window.scrollTo(0, targetTop);
    }, 0);
  }
}

function showGuideEmptyState() {
  if (!guideResult) return;
  activeGuideLocalLlmController?.abort();
  activeGuideLocalLlmController = null;
  currentGuideQuestionFingerprint = "";
  if (guideStatus) guideStatus.textContent = "질문 대기";
  if (guideResultTitle) guideResultTitle.textContent = "규정 답변 준비 화면";
  guideResult.className = "empty-state";
  guideResult.innerHTML = `
    <div class="empty-icon" aria-hidden="true">¶</div>
    <h3>규정·지침 질문을 입력하면 오른쪽 답변 공간에 결론부터 표시됩니다.</h3>
    <p>경상북도교육청을 기본값으로 하며, 다른 교육청 사안은 선택값을 바꿔 확인하세요.</p>
  `;
}

function renderPolicyGuideResult() {
  const question = (guideQuestionInput?.value || "").trim();
  if (!question) {
    currentGuideQuestionFingerprint = "";
    if (!guideResult) return;
    if (guideStatus) guideStatus.textContent = "입력 필요";
    if (guideResultTitle) guideResultTitle.textContent = "규정 질문 입력 필요";
    guideResult.className = "empty-state";
    guideResult.innerHTML = `
      <div class="empty-icon" aria-hidden="true">¶</div>
      <h3>규정 질문을 입력해 주세요.</h3>
      <p>예: 공립 교원의 배우자 부모상 경조사휴가는 며칠인가요?</p>
    `;
    return;
  }

  const officeCode = guideOfficeInput?.value || "gyeongbuk";
  const roleCode = guideRoleInput?.value || "auto";
  const categoryCode = guideCategoryInput?.value || "auto";
  const guideFingerprint = buildGuideQuestionFingerprint({ question, officeCode, roleCode, categoryCode });
  currentGuideQuestionFingerprint = guideFingerprint;
  const response = buildPolicyGuideResponse({
    question,
    officeCode,
    roleCode,
    categoryCode
  });

  if (guideStatus) guideStatus.textContent = "기본 답변";
  if (guideResultTitle) guideResultTitle.textContent = "규정·지침 답변";
  guideResult.className = "summary-box guideline-result";
  guideResult.innerHTML = renderPolicyGuideResponse(response);

  loadGuideLocalLlmPolicyEnhancement({
    question,
    officeCode,
    roleCode,
    categoryCode,
    baseResponse: response,
    guideFingerprint
  });
}

function schedulePolicyGuideAutoRender() {
  if (guideAutoRenderTimer) {
    window.clearTimeout(guideAutoRenderTimer);
  }

  guideAutoRenderTimer = window.setTimeout(() => {
    guideAutoRenderTimer = null;
    const question = (guideQuestionInput?.value || "").trim();
    if (!question) {
      showGuideEmptyState();
      return;
    }

    activateTool("guide");
    renderPolicyGuideResult();
  }, 220);
}

function buildPolicyGuideResponse({ question = "", officeCode = "auto", roleCode = "auto", categoryCode = "auto" } = {}) {
  const normalized = compactText(question);
  const office = getEducationOffice(officeCode);
  const analysis = analyzePolicyGuideQuestion(question, normalized);
  const category = getPolicyGuideCategory(categoryCode === "auto" ? analysis.categoryCode : categoryCode);
  const role = getPolicyRole(roleCode === "auto" ? analysis.roleCode : roleCode);
  const officeDefault = getDefaultEducationOfficeFallback(office, analysis, category);
  const effectiveOffice = officeDefault?.office || office;
  const intentResolution = buildPolicyGuideIntentResolution({ question, normalized, analysis, category, role });
  const localDirectRule = getDirectPolicyRule(analysis, category, role, effectiveOffice);

  const engineDomainCode = analysis.engineAnalysis?.semanticFrame?.domainCode || "";
  if (intentResolution.status === "notDetected" && !engineDomainCode && !analysis.intents?.domesticTravel) {
    const clarifyingQuestions = buildPolicyGuideQuestionCompletionQuestions({ question, analysis, category, role, office, effectiveOffice });
    return {
      question,
      office,
      effectiveOffice,
      officeDefault,
      category,
      role,
      analysis,
      directRule: null,
      intentResolution,
      needsQuestionCompletion: true,
      clarifyingQuestions,
      title: "질문 완성 필요",
      lead: "질문만으로는 적용할 규정 분야와 필요한 사실을 아직 특정하기 어렵습니다. 답을 단정하지 않고 먼저 질문을 완성합니다.",
      firstSteps: [
        "관련 주체와 사건 유형을 확인",
        "기간, 장소, 증빙자료, 이미 진행된 조치를 보강",
        "보강된 질문을 같은 규정 조회 엔진으로 다시 분류해 답변"
      ],
      officeSources: [],
      nationalSources: [],
      searchQueries: uniqueStrings([`${role.label} ${category.label} 규정 질문 보강`, question]).slice(0, 10),
      caution: "질문 요지가 확정되지 않은 상태에서는 규정명이나 처리 결론을 임의로 단정하지 않습니다."
    };
  }

  if (intentResolution.status === "needsConfirmation" && !localDirectRule) {
    const searchQueries = uniqueStrings([
      ...intentResolution.candidates.flatMap((candidate) => candidate.queries || [candidate.summary, candidate.label]),
      `${role.label} ${category.label} 규정 질문 요지 확인`,
      question
    ]).slice(0, 10);

    return {
      question,
      office,
      effectiveOffice,
      officeDefault,
      category,
      role,
      analysis,
      directRule: null,
      intentResolution,
      needsIntentConfirmation: true,
      clarifyingQuestions: [],
      title: "질문 요지 확인",
      lead: "질문에서 가능한 규정 갈래가 둘 이상입니다. 답변을 단정하지 않고 먼저 발문의 요지를 확정합니다.",
      firstSteps: [
        "질문 속 대상 신분, 사유, 원하는 결과를 분리",
        "아래 후보 중 실제 질문 의도와 가장 가까운 항목 선택",
        "선택한 요지를 질문에 반영해 같은 규정 조회 엔진으로 다시 답변"
      ],
      officeSources: [],
      nationalSources: [],
      searchQueries,
      caution: "질문 요지가 확정되지 않은 상태에서는 경조사휴가, 연가, 병가, 특별휴가 같은 서로 다른 규정을 섞어 답하지 않습니다."
    };
  }

  const engineDirectRule = getPolicyEngineDirectRule(question, effectiveOffice, role);
  const selectedDirectRule = shouldPreferPolicyEngineRule(engineDirectRule, localDirectRule)
    ? engineDirectRule
    : localDirectRule || engineDirectRule;
  const directRule = refinePolicyGuideDirectRuleForUserAnswer(selectedDirectRule, { question, analysis, role, office: effectiveOffice });
  const sourceContext = { question, analysis, directRule, role };
  const officeSources = directRule?.sourcePriority === "national" ? [] : buildOfficePolicySources(effectiveOffice, category, sourceContext);
  const sourceKeys = filterPolicySourceKeysForContext(
    uniqueStrings([...(directRule?.sourceKeys || []), ...(category.sourceKeys || [])]),
    sourceContext
  );
  const nationalSources = sourceKeys.map((key) => policySourceCatalog[key]).filter(Boolean);
  const searchQueries = buildPolicySearchQueries(question, effectiveOffice, category, role, directRule);
  const caution = appendOfficeDefaultCaution(
    directRule?.caution || "교육청별 지침, 학교 내부 규정, 단체협약, 취업규칙이 공통 법령보다 더 구체적일 수 있으므로 소속 기관 기준을 먼저 확인해야 합니다.",
    officeDefault
  );

  return {
    question,
    office,
    effectiveOffice,
    officeDefault,
    category,
    role,
    analysis,
    directRule,
    intentResolution,
    clarifyingQuestions: buildPolicyGuideClarifyingQuestions({ question, analysis, category, role, directRule, intentResolution, office, effectiveOffice }),
    title: directRule?.title || `${category.label} 규정 확인 순서`,
    lead: directRule?.lead || category.summary,
    firstSteps: uniqueStrings(directRule
      ? [...(directRule.steps || [])]
      : [role.priority, ...(category.firstSteps || [])]
    ).slice(0, 7),
    officeSources,
    nationalSources,
    searchQueries,
    caution
  };
}

function getDefaultEducationOfficeFallback(office, analysis, category) {
  if (office?.code !== "auto") return null;
  if (analysis?.intents?.domesticTravel) return null;

  const domainCode = analysis?.engineAnalysis?.semanticFrame?.domainCode || "";
  const sourcePriority = analysis?.engineAnalysis?.semanticFrame?.lookupPlan?.sourcePriority || "";
  const officeFirstDomains = new Set([
    "schoolBudgetExecution",
    "schoolInstructorHonorarium",
    "afterSchoolChildcare",
    "fieldExperienceLearning",
    "vocationalFieldTrainingOperation",
    "vocationalCurriculumNcs",
    "careerEmploymentGuidance",
    "admissionsTransferGraduation",
    "scholarshipWelfareSupport"
  ]);
  const officeSensitiveRoles = new Set(["educationWorker", "fixedTermTeacher", "privateSchool"]);
  const officeFirstCategories = new Set([
    "budgetExecution",
    "studentAttendance",
    "fieldExperienceLearning",
    "vocationalFieldTraining",
    "careerEmployment",
    "admissionsPathways",
    "studentWelfare",
    "studentHealthCounseling",
    "vocationalCurriculum"
  ]);
  const roleCode = analysis?.role?.code || analysis?.engineAnalysis?.roleCode || "";
  const employmentCode = analysis?.engineAnalysis?.semanticFrame?.slots?.employmentType?.code || "";
  const needsOfficeRule = officeSensitiveRoles.has(roleCode)
    || ["educationStaff", "fixedTerm", "privateSchool"].includes(employmentCode)
    || category === policyGuideCategories.staffContract;
  const shouldDefault = officeFirstDomains.has(domainCode)
    || sourcePriority === "office"
    || (["staffAttendanceService", "bereavementLeave"].includes(domainCode) && needsOfficeRule)
    || (sourcePriority === "roleFirst" && needsOfficeRule)
    || officeFirstCategories.has(category?.code);

  if (!shouldDefault) return null;

  const fallbackOffice = getEducationOffice("gyeongbuk");
  return {
    office: fallbackOffice,
    label: `${fallbackOffice.label} 기준`,
    notice: "교육청을 선택하지 않아 경상북도교육청 기준으로 우선 답변합니다. 실제 적용은 소속 교육청을 선택해야 더 정확합니다."
  };
}

function appendOfficeDefaultCaution(caution, officeDefault) {
  if (!officeDefault?.notice) return caution;
  return uniqueStrings([officeDefault.notice, caution]).join(" ");
}

function shouldPreferPolicyEngineRule(engineRule, localRule) {
  if (!engineRule) return false;
  if (!localRule) return true;
  if (localRule.priority === "exactIntent" || localRule.intentCode) return false;

  const broadSchoolDomains = new Set([
    "domesticTravelExpense",
    "schoolViolenceProcedure",
    "classManagementGuidance",
    "fieldExperienceLearning",
    "dormitoryOperation",
    "schoolMealOperation",
    "studentRecordsAttendance",
    "schoolSafetyHealth",
    "parentComplaintResponse",
    "specialEducationSupport",
    "assessmentAcademicManagement",
    "staffAttendanceService",
    "schoolInstructorHonorarium",
    "afterSchoolChildcare",
    "vocationalFieldTrainingOperation",
    "vocationalCurriculumNcs",
    "labEquipmentPracticeSafety",
    "careerEmploymentGuidance",
    "admissionsTransferGraduation",
    "scholarshipWelfareSupport",
    "healthInfectionCounseling",
    "teacherRightsProtection",
    "facilityDigitalSecurity",
    "governanceCommitteeRule"
  ]);

  return broadSchoolDomains.has(engineRule.domain);
}

function refinePolicyGuideDirectRuleForUserAnswer(rule, context = {}) {
  if (!rule) return rule;

  const annualLeaveRule = buildPublicServiceAnnualLeaveUserRule(context);
  if (annualLeaveRule) {
    return {
      ...rule,
      ...annualLeaveRule,
      sourceKeys: uniqueStrings([...(annualLeaveRule.sourceKeys || []), ...(rule.sourceKeys || [])]),
      queries: uniqueStrings([...(annualLeaveRule.queries || []), ...(rule.queries || [])]),
      ruleLookup: rule.ruleLookup || null
    };
  }

  const attendanceRule = buildStaffAttendanceTimeUserRule(context);
  if (attendanceRule) {
    return {
      ...rule,
      ...attendanceRule,
      sourceKeys: uniqueStrings([...(attendanceRule.sourceKeys || []), ...(rule.sourceKeys || [])]),
      queries: uniqueStrings([...(attendanceRule.queries || []), ...(rule.queries || [])]),
      ruleLookup: rule.ruleLookup || null
    };
  }

  const afterSchoolRule = buildAfterSchoolInstructorSelectionUserRule(context);
  if (afterSchoolRule) {
    return {
      ...rule,
      ...afterSchoolRule,
      sourceKeys: uniqueStrings([...(afterSchoolRule.sourceKeys || []), ...(rule.sourceKeys || [])]),
      queries: uniqueStrings([...(afterSchoolRule.queries || []), ...(rule.queries || [])]),
      ruleLookup: rule.ruleLookup || null
    };
  }

  return rule;
}

function buildPublicServiceAnnualLeaveUserRule(context = {}) {
  const normalized = compactText(context.question || "");
  if (!/연가|연차/.test(normalized)) return null;
  if (/기간제|계약제|교육공무직|공무직|사립|학교법인|근로계약|연차수당/.test(normalized)) return null;

  const roleCode = context.role?.code || context.analysis?.roleCode || context.analysis?.engineAnalysis?.roleCode || "";
  const employmentCode = context.analysis?.engineAnalysis?.semanticFrame?.slots?.employmentType?.code || "";
  const isLocalOfficer = roleCode === "localOfficer" || employmentCode === "localOfficer" || /지방공무원|행정직|주무관|교육행정/.test(normalized);
  const isPublicTeacher = roleCode === "teacher" || employmentCode === "publicTeacher" || /정교사|정규교사|정규직교사|공립교원|공립 교원|교사|교원|선생님/.test(normalized);
  if (!isLocalOfficer && !isPublicTeacher) return null;

  const subjectLabel = isLocalOfficer ? "지방공무원·행정직" : "공립 교원";
  const detectedBand = getPublicServiceAnnualLeaveBand(normalized);
  const tableText = "1개월 이상 1년 미만 11일, 1년 이상 3년 미만 15일, 3년 이상 4년 미만 16일, 4년 이상 5년 미만 17일, 5년 이상 6년 미만 20일, 6년 이상 21일";
  const answer = detectedBand
    ? [`${subjectLabel}의 ${detectedBand.label} 연가는 기본 ${detectedBand.days}일입니다.`]
    : [`${subjectLabel}의 연가는 재직기간별로 ${tableText}입니다.`];

  return {
    title: `${subjectLabel} 연가 일수`,
    lead: detectedBand
      ? `${detectedBand.label}로 판단하면 기본 연가일수는 ${detectedBand.days}일입니다. 실제 잔여일수는 올해 이미 사용한 연가, 휴직·정직·직위해제 이력, 저축연가·미리 사용한 연가를 빼서 계산합니다.`
      : `${subjectLabel}은 재직기간별 연가일수표를 기준으로 연가 가능 일수를 먼저 산정합니다. 실제 잔여일수는 이미 사용한 연가와 재직기간 산입 제외 이력을 반영해 계산합니다.`,
    roleLabel: subjectLabel,
    answer: [
      ...answer,
      `기본 연가일수표: ${tableText}.`,
      "사용하려면 나이스 근무상황에서 연가로 사전 신청하고, 학교장 승인 또는 승인권자 승인을 받은 뒤 사용합니다."
    ],
    steps: [
      "재직기간 기준일과 올해 이미 사용한 연가일수를 확인합니다.",
      "휴직·정직·직위해제, 저축연가, 미리 사용한 연가가 있으면 잔여일수에서 반영합니다.",
      "나이스 근무상황으로 사전 신청하고 학교장 승인 또는 승인권자 승인을 받은 뒤 사용합니다."
    ],
    sourceKeys: ["nationalService", "localService", "teacherLeave", "publicRecords"],
    queries: [
      "국가공무원 복무규정 제15조 연가 일수",
      "지방공무원 복무규정 연가 일수",
      "교원휴가에 관한 예규 연가"
    ],
    caution: `${subjectLabel} 기준의 일반 답변입니다. 교육청·학교 내부 복무 지침에서 신청 절차나 제한 사유를 더 구체적으로 정한 경우 그 기준도 함께 적용합니다.`,
    sourcePriority: "national"
  };
}

function getPublicServiceAnnualLeaveBand(normalized = "") {
  const yearMatch = normalized.match(/(\d+)\s*년\s*차/);
  const yearNumber = yearMatch ? Number(yearMatch[1]) : 0;
  if (yearNumber >= 6) return { label: "6년차 이상", days: "21" };
  if (yearNumber === 5) return { label: "5년차", days: "20" };
  if (yearNumber === 4) return { label: "4년차", days: "17" };
  if (yearNumber === 3) return { label: "3년차", days: "16" };
  if (yearNumber === 2 || yearNumber === 1) return { label: `${yearNumber}년차`, days: "15" };
  return null;
}

function buildStaffAttendanceTimeUserRule(context = {}) {
  const normalized = compactText(context.question || "");
  if (!/지각|조퇴|외출|근무상황/.test(normalized)) return null;
  if (/출장|여비|일비|식비|숙박비|운임/.test(normalized) && !/무단외출|외출신청|외출처리|근무상황외출/.test(normalized)) return null;

  const issueLabel = detectAttendanceTimeIssueLabel(normalized);
  const unauthorized = /무단|미승인|승인없이|허가없이|허가없/.test(normalized);
  const roleCode = context.role?.code || context.analysis?.roleCode || context.analysis?.engineAnalysis?.roleCode || "";
  const subjectLabel = roleCode === "fixedTermTeacher"
    ? "기간제교원"
    : roleCode === "localOfficer"
    ? "지방공무원·행정직"
    : "교원";

  return {
    title: `${subjectLabel} ${issueLabel} 처리`,
    lead: "",
    roleLabel: subjectLabel,
    answer: [
      unauthorized
        ? `${subjectLabel}의 무단 ${issueLabel}은 출근기록과 나이스 근무상황, 승인 여부를 대조해 실제 시간을 확정한 뒤 복무 위반 여부를 판단합니다.`
        : `${subjectLabel}의 ${issueLabel}은 나이스 근무상황으로 사전 신청하고 승인권자 결재, 사유와 증빙을 맞춰 처리합니다.`,
      "질병·부상 사유이면 누계 8시간을 병가 1일로 계산할 수 있는지 확인하고, 개인 사유이면 연가·외출·지각 처리 기준을 적용합니다.",
      "사후 승인 가능성, 사유서·증빙자료, 복무지도·주의·경고·징계 검토 가능성을 분리해 기록합니다."
    ],
    steps: [
      `출근기록과 나이스 근무상황으로 실제 ${issueLabel} 시간을 확인합니다.`,
      "사전 승인 또는 사후 승인 가능 사유와 증빙을 확인합니다.",
      "무단 사안이면 복무지도, 주의·경고, 징계·계약상 불이익 가능성을 분리합니다."
    ],
    sourceKeys: ["nationalService", "teacherLeave", "localService", "publicRecords"],
    queries: [
      `교원 복무 ${issueLabel} 나이스 근무상황`,
      "국가공무원 복무규정 지각 조퇴 외출 병가 8시간",
      `${subjectLabel} 무단 ${issueLabel} 복무 처리`
    ],
    caution: `${subjectLabel} 기준의 일반 답변입니다. 사립학교, 기간제교원, 교육공무직은 학교법인 규정, 계약제교원 지침, 취업규칙·단체협약이 달라질 수 있습니다.`,
    sourcePriority: "national"
  };
}

function detectAttendanceTimeIssueLabel(normalized = "") {
  if (/외출/.test(normalized)) return "외출";
  if (/조퇴/.test(normalized)) return "조퇴";
  if (/지각/.test(normalized)) return "지각";
  return "지각·조퇴·외출";
}

function buildAfterSchoolInstructorSelectionUserRule(context = {}) {
  const normalized = compactText(context.question || "");
  if (!/방과후|늘봄|돌봄|강사선정|제안서평가|위탁강사|방과후계약/.test(normalized)) return null;
  if (!/강사선정|제안서평가|위탁강사|공고|계약/.test(normalized)) return null;

  return {
    title: "방과후학교 강사 선정 절차",
    lead: "",
    roleLabel: "학교",
    answer: [
      "방과후학교·늘봄 강사 선정은 운영계획 수립, 공고, 제안서·프로그램 평가, 선정 결과 내부결재, 계약 체결, 운영·정산 기록 보존 순서로 처리합니다.",
      "수강료·환불·자유수강권 사안과 강사 선정 사안은 같은 방과후학교 지침 안에서 보되, 평가표·선정위원회·계약서 등 증빙을 따로 정리합니다.",
      "교육청 방과후학교·늘봄 운영 지침과 학교 내부 운영계획, 지방계약 기준 적용 여부를 함께 확인합니다."
    ],
    steps: [
      "방과후학교 운영계획과 강사 선정 공고문을 확인합니다.",
      "제안서 평가표, 선정위원회 기록, 내부결재 문서를 보존합니다.",
      "계약서, 성범죄·아동학대 조회, 안전관리·정산 자료를 함께 정리합니다."
    ],
    sourceKeys: ["afterSchoolGuide", "localContract", "schoolAccountingRule", "publicRecords"],
    queries: [
      "방과후학교 강사 선정 제안서 평가 절차",
      "방과후학교 운영 지침 강사 계약 공고",
      "늘봄학교 방과후학교 강사 선정 기준"
    ],
    caution: "교육청별 방과후학교 지침과 학교 운영계획의 세부 서식이 다를 수 있으므로, 실제 공고 전에는 소속 교육청 기준을 확인해야 합니다.",
    sourcePriority: "office"
  };
}

function getPolicyEngineDirectRule(question, office, role) {
  const engine = getPolicyEngine();
  if (!engine?.buildPolicyResponse) return null;

  try {
    const response = engine.buildPolicyResponse({
      question,
      officeLabel: office?.code === "auto" ? "소속 교육청" : office?.label,
      roleLabel: role?.label || ""
    });
    if (!response) return null;
    return {
      domain: response.domain,
      categoryCode: response.categoryCode,
      title: response.title,
      lead: response.lead,
      roleLabel: response.roleLabel,
      answer: response.answer || [],
      steps: response.steps || [],
      sourceKeys: response.sourceKeys || [],
      queries: response.queries || [],
      caution: response.caution,
      sourcePriority: response.sourcePriority,
      ruleLookup: response.ruleLookup || null
    };
  } catch (error) {
    console.warn("Policy engine fallback:", error);
    return null;
  }
}

function getPolicyEngineAnalysis(question = "") {
  const engine = getPolicyEngine();
  if (!engine?.analyzePolicyQuestion) return null;

  try {
    return engine.analyzePolicyQuestion(question);
  } catch (error) {
    console.warn("Policy engine analysis fallback:", error);
    return null;
  }
}

function getPolicyEngine() {
  return (typeof window !== "undefined" && window.GYO6_POLICY_ENGINE) || globalThis.GYO6_POLICY_ENGINE;
}

function getPolicyQuestionTaxonomy() {
  return (typeof window !== "undefined" && window.GYO6_POLICY_QUESTION_TAXONOMY) || globalThis.GYO6_POLICY_QUESTION_TAXONOMY;
}

function getPolicyQuestionTaxonomyMatches(question = "", analysis = null, limit = 8) {
  const taxonomy = getPolicyQuestionTaxonomy();
  if (!taxonomy?.classify) return [];

  try {
    return taxonomy.classify(question, {
      engineFrame: analysis?.engineAnalysis?.semanticFrame || analysis?.semanticFrame || null,
      limit
    }) || [];
  } catch (error) {
    console.warn("Policy question taxonomy fallback:", error);
    return [];
  }
}

function buildPolicyGuideIntentResolution(context = {}) {
  const normalized = context.normalized || compactText(context.question);
  const engineClarification = context.analysis?.engineAnalysis?.semanticFrame?.intentClarification || null;
  if (engineClarification?.needsConfirmation) {
    const candidates = (engineClarification.candidates || []).map((candidate) => ({
      code: candidate.code || engineClarification.type || "policyDomain",
      label: candidate.label || candidate.code || engineClarification.label || "규정 분야",
      summary: candidate.summary || candidate.label || engineClarification.summary || "",
      reason: engineClarification.summary || engineClarification.question || "질문 속 단서가 여러 규정 분야에 걸립니다.",
      confidence: Math.max(0.5, Math.min(0.9, Number(candidate.confidence) || 0.62)),
      needsConfirmation: true,
      categoryCode: context.category?.code || "",
      domainCode: candidate.code || "",
      roleCode: context.role?.code || "auto",
      queries: [candidate.summary, candidate.label, context.question].filter(Boolean)
    }));
    return {
      status: "needsConfirmation",
      primary: candidates[0] || {
        code: engineClarification.type || "policyDomain",
        label: engineClarification.label || "규정 분야",
        summary: engineClarification.summary || "",
        reason: engineClarification.question || "",
        confidence: 0.62,
        needsConfirmation: true
      },
      candidates,
      confidence: candidates[0]?.confidence || 0.62,
      summary: engineClarification.summary || "",
      reason: engineClarification.question || ""
    };
  }

  const candidates = buildPolicyGuideIntentCandidates({ ...context, normalized })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
  const primary = candidates[0] || null;

  if (!primary || primary.confidence < 0.42) {
    return {
      status: "notDetected",
      primary: null,
      candidates: [],
      confidence: 0,
      summary: ""
    };
  }

  const runnerUp = candidates.find((candidate) => candidate.code !== primary.code) || null;
  const closeRival = runnerUp
    && runnerUp.confidence >= 0.48
    && primary.confidence - runnerUp.confidence < 0.18
    && primary.confidence < 0.9
    && !arePolicyIntentCandidatesCompatible(primary, runnerUp);
  const ambiguousFamilyLeave = hasAmbiguousFamilyLeaveQuestion(normalized);
  const needsConfirmation = primary.needsConfirmation || ambiguousFamilyLeave || closeRival || primary.confidence < 0.72;

  return {
    status: needsConfirmation ? "needsConfirmation" : "confirmed",
    primary,
    candidates,
    confidence: primary.confidence,
    summary: primary.summary || primary.label || "",
    reason: primary.reason || ""
  };
}

function arePolicyIntentCandidatesCompatible(primary = {}, runnerUp = {}) {
  if (!primary || !runnerUp) return false;
  if (primary.domainCode && runnerUp.domainCode && primary.domainCode === runnerUp.domainCode) return true;
  if (primary.categoryCode && runnerUp.categoryCode && primary.categoryCode === runnerUp.categoryCode && primary.confidence >= 0.82) return true;
  return false;
}

function buildPolicyGuideIntentCandidates({ question = "", normalized = compactText(question), analysis = null, category = null, role = null } = {}) {
  const candidates = [];
  const roleLabel = role?.label || "대상자";
  const engineFrame = analysis?.engineAnalysis?.semanticFrame || null;
  const confirmedIntentText = getConfirmedGuideIntentText(normalized);
  const hasTeacherSignal = /정규직|정규교사|정규교원|선생님|교사|교원|교장|교감|공립/.test(normalized);
  const wantsDaysOrProcedure = /일수|몇일|며칠|얼마|가능|신청|처리|계산|산정|방법/.test(normalized);
  const hasLeaveSignal = /휴가|연가|연차|병가|공가|특별휴가|복무|근태/.test(normalized);
  const ambiguousFamilyLeave = hasAmbiguousFamilyLeaveQuestion(normalized);

  if (isSpouseChildbirthLeaveIntent(normalized) || /배우자출산휴가/.test(confirmedIntentText)) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "spouseChildbirthLeave",
      label: "배우자 출산휴가",
      summary: `${hasTeacherSignal ? "공립 정규교원" : roleLabel}의 배우자 출산휴가 일수와 신청 절차`,
      reason: "배우자와 출산, 휴가 일수 신호가 함께 확인되었습니다.",
      confidence: 0.93 + (wantsDaysOrProcedure ? 0.03 : 0),
      categoryCode: "leaveAttendance",
      roleCode: hasTeacherSignal ? "teacher" : role?.code || "auto",
      queries: ["국가공무원 복무규정 제20조 배우자 출산휴가 20일", "교원휴가에 관한 예규 배우자 출산휴가", "나이스 배우자 출산휴가 근무상황"]
    });
  } else if (ambiguousFamilyLeave && /배우자/.test(normalized) && !hasBereavementIntentSignal(normalized)) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "spouseChildbirthLeave",
      label: "배우자 출산휴가",
      summary: "배우자가 출산한 경우의 특별휴가 일수",
      reason: "배우자와 휴가가 언급되었지만 출산인지 사망인지 확정되지 않았습니다.",
      confidence: 0.56,
      needsConfirmation: true,
      categoryCode: "leaveAttendance",
      roleCode: hasTeacherSignal ? "teacher" : role?.code || "auto",
      queries: ["배우자 출산휴가 국가공무원 복무규정", "교원 배우자 출산휴가"]
    });
  }

  if (hasBereavementIntentSignal(normalized) || /경조사휴가|상례휴가|사망경조사/.test(confirmedIntentText)) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "bereavementLeave",
      label: "사망 경조사휴가",
      summary: `${hasTeacherSignal ? "공립 교원" : roleLabel}의 사망 경조사휴가 일수`,
      reason: "사망, 상례, 장례 또는 가족관계별 경조사 신호가 확인되었습니다.",
      confidence: /출산/.test(normalized) ? 0.48 : 0.86 + (wantsDaysOrProcedure ? 0.03 : 0),
      needsConfirmation: /출산/.test(normalized),
      categoryCode: "leaveAttendance",
      roleCode: hasTeacherSignal ? "teacher" : role?.code || "auto",
      queries: ["국가공무원 복무규정 별표2 경조사별 휴가 일수표", "교원휴가에 관한 예규 경조사휴가"]
    });
  } else if (ambiguousFamilyLeave) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "bereavementLeave",
      label: "사망 경조사휴가",
      summary: "가족 사망에 따른 경조사휴가 일수",
      reason: "가족관계와 휴가가 언급되었지만 사망 여부가 확정되지 않았습니다.",
      confidence: 0.54,
      needsConfirmation: true,
      categoryCode: "leaveAttendance",
      roleCode: hasTeacherSignal ? "teacher" : role?.code || "auto",
      queries: ["국가공무원 복무규정 별표2 경조사휴가", "교원 경조사휴가 가족관계별 일수"]
    });
  }

  if (/연가|연차/.test(normalized) || /교원연가|정규교사연가|기간제교사연가/.test(confirmedIntentText)) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "annualLeave",
      label: "연가·연차",
      summary: `${roleLabel}의 연가·연차 일수와 신청 절차`,
      reason: "연가 또는 연차 신호가 직접 확인되었습니다.",
      confidence: 0.84,
      categoryCode: "leaveAttendance",
      roleCode: role?.code || "auto",
      queries: ["교원 연가 국가공무원 복무규정 제15조", "기간제교사 연차 계약제교원 운영 지침"]
    });
  } else if (hasLeaveSignal && !/출산|사망|상례|장례|부고|병가|지각|조퇴|외출/.test(normalized) && !ambiguousFamilyLeave) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "annualLeave",
      label: "일반 휴가·연가",
      summary: "일반 휴가 또는 연가 일수와 신청 절차",
      reason: "휴가라는 넓은 표현만 있어 세부 휴가 종류 확인이 필요합니다.",
      confidence: 0.46,
      needsConfirmation: true,
      categoryCode: "leaveAttendance",
      roleCode: role?.code || "auto",
      queries: ["교원 연가 병가 특별휴가 구분", "교원휴가에 관한 예규 휴가 종류"]
    });
  }

  if (/병가|질병|진단서|입원|통원/.test(normalized)) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "sickLeave",
      label: "병가",
      summary: `${roleLabel}의 병가 가능 일수와 증빙·신청 절차`,
      reason: "병가, 질병, 진단서 신호가 확인되었습니다.",
      confidence: 0.88,
      categoryCode: "leaveAttendance",
      roleCode: role?.code || "auto",
      queries: ["교원 병가 국가공무원 복무규정", "교원휴가에 관한 예규 병가 진단서"]
    });
  }

  const hasAttendanceTimeIntent = /지각|조퇴|무단외출|외출신청|외출처리|근무상황외출|근무중외출/.test(normalized)
    || (/외출/.test(normalized) && !/관외출장|출장/.test(normalized));
  if (hasAttendanceTimeIntent) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "attendanceTime",
      label: "지각·조퇴·외출",
      summary: `${roleLabel}의 지각·조퇴·외출 처리와 나이스 근무상황`,
      reason: "지각, 조퇴, 외출 신호가 확인되었습니다.",
      confidence: 0.88,
      categoryCode: "leaveAttendance",
      roleCode: role?.code || "auto",
      queries: ["교원 지각 조퇴 외출 나이스 근무상황", "국가공무원 복무규정 근무상황 지각 조퇴"]
    });
  }

  if (analysis?.intents?.domesticTravel) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "domesticTravelExpense",
      label: "국내 출장여비",
      summary: "국내 출장 일비·식비·숙박비 산정",
      reason: "출장지, 출장비, 일비·식비 신호가 확인되었습니다.",
      confidence: 0.91,
      categoryCode: "leaveAttendance",
      roleCode: analysis.intents.domesticTravel.profile?.roleCode || role?.code || "auto",
      queries: ["공무원 여비 규정 별표2 국내 출장 일비 식비", "공무원 여비 규정 제18조 근무지 내 출장"]
    });
  }

  if (engineFrame?.domainCode === "schoolInstructorHonorarium" || /강사비|강사료|강의비|강사수당/.test(normalized)) {
    addPolicyGuideIntentCandidate(candidates, {
      code: "instructorHonorarium",
      label: "강사수당·강사료",
      summary: "교육 강사수당 등급과 기본·초과시간 단가 확인",
      reason: "강사료 또는 강사수당 신호가 확인되었습니다.",
      confidence: 0.84,
      categoryCode: "budgetExecution",
      roleCode: role?.code || "auto",
      queries: ["교육청 학교회계 예산편성 기본지침 교육 강사수당", "강사수당 일반강사 특별강사 단가"]
    });
  }

  getPolicyQuestionTaxonomyMatches(question, analysis, 8).forEach((candidate) => {
    addPolicyGuideIntentCandidate(candidates, {
      code: candidate.code,
      label: candidate.label,
      summary: candidate.summary || candidate.path || candidate.label,
      reason: candidate.reason,
      confidence: candidate.confidence,
      needsConfirmation: candidate.needsConfirmation,
      categoryCode: candidate.categoryCode || category?.code || "",
      domainCode: candidate.domainCode || "",
      roleCode: role?.code || "auto",
      queries: candidate.queries || [],
      requiredSlots: candidate.requiredSlots || [],
      taxonomyVersion: candidate.taxonomyVersion
    });
  });

  return candidates;
}

function addPolicyGuideIntentCandidate(candidates, candidate) {
  const existing = candidates.find((item) => item.code === candidate.code);
  const normalizedConfidence = Math.max(0, Math.min(0.99, Number(candidate.confidence) || 0));
  const next = { ...candidate, confidence: normalizedConfidence };

  if (!existing) {
    candidates.push(next);
    return;
  }

  if (next.confidence > existing.confidence) {
    Object.assign(existing, next);
  }
}

function getConfirmedGuideIntentText(normalized = "") {
  const match = normalized.match(/질문요지:([^-\n]+)|선택한요지:([^-\n]+)/);
  return match ? compactText(match[1] || match[2] || "") : "";
}

function hasAmbiguousFamilyLeaveQuestion(normalized = "") {
  const hasFamily = /배우자|남편|아내|부모|자녀|아들|딸|장인|장모|시부|시모|조부모|형제|자매/.test(normalized);
  const hasLeaveOrDays = /휴가|일수|며칠|몇일|얼마|가능/.test(normalized);
  const hasSpecificEvent = /출산|사망|상례|장례|부고|별세|부모상|배우자상|자녀상|조부모상|형제상|자매상|삼촌상|숙부상|백부상|고모상|이모상|장인상|장모상|시부상|시모상|병가|연가|연차|지각|조퇴|외출/.test(normalized);
  return hasFamily && hasLeaveOrDays && !hasSpecificEvent;
}

function isSpouseChildbirthLeaveIntent(normalized = "") {
  return /(?:배우자|남편|아내).{0,16}출산|출산.{0,16}(?:배우자|남편|아내)|배우자출산휴가/.test(normalized)
    || /(?:남자|남성|아빠|아버지|부친).{0,24}(?:교사|교원|선생님|교직원|공무원)?.{0,24}출산휴가/.test(normalized)
    || /(?:교사|교원|선생님|교직원|공무원).{0,24}(?:남자|남성|아빠|아버지|부친).{0,24}출산휴가/.test(normalized);
}

function hasBereavementIntentSignal(normalized = "") {
  if (/출산|임신|육아|모성보호|배우자출산휴가/.test(normalized) && !/사망|상례|장례|부고|별세|상$/.test(normalized)) {
    return false;
  }

  return /사망|상례|장례|부고|별세|부모상|배우자상|자녀상|조부모상|형제상|자매상|삼촌상|숙부상|백부상|고모상|이모상|장인상|장모상|시부상|시모상|경조사휴가|상휴가|상일수/.test(normalized);
}

function buildPolicyGuideClarifyingQuestions(context = {}) {
  const normalized = context.analysis?.normalized || compactText(context.question || "");
  const frame = context.analysis?.engineAnalysis?.semanticFrame || context.directRule?.ruleLookup?.semanticFrame || {};
  const domainCode = context.directRule?.domain || frame.domainCode || "";
  const employmentCode = frame.slots?.employmentType?.code || "";
  const serviceIssueCode = frame.slots?.serviceIssue?.code || "";
  const roleCode = context.role?.code || context.analysis?.roleCode || "";
  const questions = [];
  const intentClarification = frame.intentClarification || {};

  if (intentClarification.needsConfirmation && intentClarification.question) {
    questions.push({
      question: intentClarification.question,
      reason: intentClarification.summary || "질문 속 단서가 여러 규정 분야에 걸려 있어 답변 전에 요지를 확정합니다.",
      placeholder: intentClarification.placeholder || "예: 확인하려는 위원회·기록 종류·요청자를 함께 적어 주세요."
    });
  }

  if (domainCode === "domesticTravelExpense") {
    questions.push(
      {
        question: "출장명령과 출장지가 근무지 외 국내출장으로 확인되나요?",
        reason: "근무지 외 국내출장은 일비·식비·숙박비·운임 기준을 적용하고, 근무지 내 출장은 제18조 정액 기준을 적용합니다.",
        placeholder: "예: 관외출장 / 관내출장 4시간 이상 / 출장지와 학교 간 거리 확인 필요"
      },
      {
        question: "운임이나 숙박비를 함께 산정해야 하나요?",
        reason: "일비·식비는 정액이지만 운임·숙박비는 이동수단, 숙박 여부, 증빙자료에 따라 달라집니다.",
        placeholder: "예: 일비·식비만 / 1박 숙박 포함 / KTX 운임 증빙 있음"
      }
    );
    return questions;
  }

  if (
    domainCode === "staffAttendanceService"
    && serviceIssueCode === "annualLeave"
    && (employmentCode === "fixedTerm" || roleCode === "fixedTermTeacher" || /기간제|계약제/.test(normalized))
  ) {
    questions.push(
      {
        question: "임용계약 기간은 언제부터 언제까지인가요?",
        reason: "1년 미만 월 개근 산식인지, 1년 이상 연차 산식인지가 계약기간에서 갈립니다.",
        placeholder: "예: 2026.3.1.~2027.2.28. 1년 계약 / 2026.3.1.~2026.8.31. 6개월 계약"
      },
      {
        question: "방학 중 비근무 기간이 있거나 주당 소정근로일이 다른가요?",
        reason: "방학 중 비근무와 소정근로일은 계속근로와 실제 발생 일수 판단에 영향을 줍니다.",
        placeholder: "예: 방학 중 비근무 없음 / 여름방학 3주 비근무 / 주 5일 근무"
      },
      {
        question: "이미 사용한 연가·연차와 나이스 근무상황 처리 내역이 있나요?",
        reason: "발생 일수와 남은 일수는 이미 사용한 일수와 승인 이력을 빼서 계산합니다.",
        placeholder: "예: 아직 사용 없음 / 2일 사용 / 나이스 연가로 승인"
      },
      {
        question: "임용계약서나 소속 교육청 계약제교원 운영 지침의 휴가 조항을 확인했나요?",
        reason: "기간제교사는 공무원 연가표를 그대로 적용하지 않고 계약서·교육청 지침의 직접 조항을 대조해야 합니다.",
        placeholder: "예: 계약서에 연차유급휴가 조항 있음 / 아직 확인 못함"
      }
    );
  }

  if (
    domainCode === "staffAttendanceService"
    && (serviceIssueCode === "sickLeave" || serviceIssueCode === "tardyEarlyLeave" || serviceIssueCode === "attendanceRecord")
    && (employmentCode === "fixedTerm" || roleCode === "fixedTermTeacher" || /기간제|계약제/.test(normalized))
  ) {
    questions.push(
      {
        question: "임용계약서의 복무·병가·근무상황 조항을 확인했나요?",
        reason: "기간제교사는 계약제교원 지침과 계약서가 유급·무급, 승인권자, 증빙 기준을 좌우합니다.",
        placeholder: "예: 병가 유급 조항 있음 / 복무는 교원 기준 준용 / 아직 확인 못함"
      },
      {
        question: "나이스 상신·승인 이력이나 진단서 등 증빙자료가 있나요?",
        reason: "복무·근태 사안은 최종 답변을 내기 전에 승인 여부와 증빙자료를 확인해야 합니다.",
        placeholder: "예: 나이스 승인 완료 / 진단서 있음 / 사후 승인 요청 중"
      }
    );
  }

  if (context.office?.code === "auto" && context.effectiveOffice?.code === "gyeongbuk") {
    questions.push({
      question: "실제 소속 교육청이 경상북도교육청이 맞나요?",
      reason: "교육청을 선택하지 않으면 경상북도교육청 기준으로 우선 답하지만, 소속 교육청이 다르면 지침과 링크가 달라집니다.",
      placeholder: "예: 경상북도교육청 맞음 / 부산교육청 / 경남교육청"
    });
  }

  questions.push(...buildPolicyTaxonomyClarifyingQuestions(context));

  const seen = new Set();
  return questions.filter((item) => {
    if (seen.has(item.question)) return false;
    seen.add(item.question);
    return true;
  }).slice(0, 5);
}

function buildPolicyGuideQuestionCompletionQuestions(context = {}) {
  const taxonomyQuestions = buildPolicyTaxonomyClarifyingQuestions(context);
  const defaults = [
    {
      question: "누가 관련된 사안인가요?",
      reason: "학생, 학부모, 교사, 행정실, 교육공무직, 실습기업, 졸업생 등 주체에 따라 적용 규정과 절차가 달라집니다.",
      placeholder: "예: 공립고 교사 / 특성화고 학생 / 행정실 주무관 / 졸업생"
    },
    {
      question: "확인하려는 사안이 어떤 분야에 가장 가깝나요?",
      reason: "복무·휴가, 출장비, 학교폭력, 개인정보, 현장실습, 취업·노동, 민원·소송 위험처럼 갈래를 먼저 잡아야 합니다.",
      placeholder: "예: 출장비 / 학폭 처리 / 병가 증빙 / 임금체불 / 개인정보 동의"
    },
    {
      question: "날짜·기간·장소·현재 처리 단계가 있나요?",
      reason: "기간과 단계는 신청 가능 여부, 보고 기한, 보존 자료, 비용 산정에 직접 영향을 줍니다.",
      placeholder: "예: 1박2일 출장 / 병가 7일 / 사안 접수 전 / 전담기구 개최 전"
    },
    {
      question: "이미 있는 증빙자료나 위험 신호가 무엇인가요?",
      reason: "진단서, 사진, 회의록, 공문, 계약서, 상담기록, 안전사고 같은 자료와 위험 신호가 답변 수준을 좌우합니다.",
      placeholder: "예: 진단서 있음 / 사진 캡처 있음 / 공문 없음 / 긴급 위험 있음"
    }
  ];

  const seen = new Set();
  return [...taxonomyQuestions, ...defaults].filter((item) => {
    if (!item?.question || seen.has(item.question)) return false;
    seen.add(item.question);
    return true;
  }).slice(0, 5);
}

function buildPolicyTaxonomyClarifyingQuestions(context = {}) {
  const taxonomy = getPolicyQuestionTaxonomy();
  if (!taxonomy?.buildSlotQuestions) return [];

  const frame = context.analysis?.engineAnalysis?.semanticFrame || context.directRule?.ruleLookup?.semanticFrame || {};
  const primaryIntentCode = context.intentResolution?.primary?.code || context.directRule?.intentCode || "";

  try {
    return taxonomy.buildSlotQuestions({
      question: context.question || context.analysis?.question || "",
      frame,
      intentCode: primaryIntentCode,
      officeCode: context.office?.code || "auto"
    }).map((slot) => ({
      question: slot.question,
      reason: slot.reason,
      placeholder: slot.placeholder
    }));
  } catch (error) {
    console.warn("Policy question taxonomy clarifier fallback:", error);
    return [];
  }
}

function renderPolicyGuideResponse(response) {
  if (response.needsQuestionCompletion) {
    return renderPolicyGuideQuestionCompletion(response);
  }

  if (response.needsIntentConfirmation) {
    return renderPolicyGuideIntentConfirmation(response);
  }

  const officeLabel = response.officeDefault
    ? `${response.effectiveOffice.label} 기준(교육청 미선택 기본값)`
    : response.office.code === "auto" ? "소속 교육청 미선택" : response.office.label;
  const roleLabel = response.directRule?.roleLabel || response.role.label;
  const directItems = (response.directRule?.answer || [])
    .map(cleanPolicyGuideUserText)
    .filter(Boolean);
  const firstSteps = (response.firstSteps || [])
    .map(cleanPolicyGuideUserText)
    .filter(Boolean);
  const primaryAnswer = directItems[0] || firstSteps[0] || cleanPolicyGuideUserText(response.lead) || "확인 가능한 기준을 바탕으로 답변합니다.";
  const userLead = buildUserFacingGuideLead(response, primaryAnswer);
  let supportingItems = directItems.length ? directItems.slice(1) : firstSteps.slice(1, 4);
  const detailRequest = getPolicyGuideDetailRequest(response.question);
  const budgetGuideTitle = response.category === policyGuideCategories.budgetExecution
    ? response.effectiveOffice?.budgetGuide?.title
    : "";
  const prioritySupportingItems = [];
  if (budgetGuideTitle) {
    prioritySupportingItems.push(`${response.effectiveOffice.label} ${budgetGuideTitle}을 우선 확인합니다.`);
  }
  if (/사립학교|학교법인/.test(`${response.role?.label || ""} ${roleLabel} ${response.question}`)) {
    if (response.category === policyGuideCategories.budgetExecution) {
      prioritySupportingItems.push("사립학교는 학교법인·학교 내부 지급 기준과 공립학교회계 지침 준용 여부를 함께 확인합니다.");
    } else if (response.category === policyGuideCategories.leaveAttendance || response.directRule?.domain === "staffAttendanceService") {
      prioritySupportingItems.push("사립학교는 학교법인 복무규정, 취업규칙, 단체협약, 근로계약의 실제 문구를 우선 확인합니다.");
    }
  }
  if (prioritySupportingItems.length) {
    supportingItems = uniqueStrings([
      ...prioritySupportingItems,
      ...supportingItems
    ]).slice(0, 5);
  }
  const cautionText = cleanPolicyGuideUserText(buildPolicyGuideShortCaution(response, officeLabel, roleLabel));

  return `
    <section class="guide-answer-card primary">
      <div class="answer-label">답변</div>
      <h3>${escapeHtml(primaryAnswer)}</h3>
      ${userLead ? `<p class="guide-answer-lead">${escapeHtml(userLead)}</p>` : ""}
      ${supportingItems.length ? `
        <div class="guide-direct">
          <strong>다음에 확인할 것</strong>
          <ul>${supportingItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      ` : ""}
      ${cautionText ? `<p class="answer-warning">${escapeHtml(cautionText)}</p>` : ""}
    </section>

    ${renderPolicyGuideOptionalClarifyingPanel(response.clarifyingQuestions || [])}
    ${renderPolicyGuideDetailSections(response, detailRequest)}
    ${renderPolicyGuideFollowupActions(response, detailRequest)}
  `;
}

function buildUserFacingGuideLead(response = {}, primaryAnswer = "") {
  if (response.directRule) return "";
  const lead = cleanPolicyGuideUserText(response.lead || "");
  if (!lead) return "";
  if (compactText(lead) === compactText(primaryAnswer)) return "";
  if (isInternalPolicyGuideText(lead)) return "";
  return lead;
}

function cleanPolicyGuideUserText(value = "") {
  let text = normalizeReportText(value);
  if (!text) return "";
  text = text.replace(/^로컬 정책 코퍼스는\s*/u, "관련 기준은 ");
  text = text.replace(/을 우선 조회 후보로 올립니다\.?$/u, "입니다.");
  text = text.replace(/를 우선 조회 후보로 올립니다\.?$/u, "입니다.");
  text = text.replace(/[^.。]*(?:확인 필요 항목|확인 슬롯|같은 조회 계획|재계산|확보되는 즉시 같은 조회 계획)[^.。]*[.。]?\s*/g, "");
  text = text.replace(/현재 질문(?:에서|에는)?[^.。]*(?:명확하지|부족|없어|없어도)[^.。]*[.。]?\s*/g, "");
  text = text.replace(/확인되지 않은 항목:[^.。]+[.。]?\s*/g, "");
  text = text.replace(/확인이 부족한 항목은 [^.。]+[.。]?\s*/g, "");
  text = text.replace(/확정 판단 대신[^.。]+[.。]?\s*/g, "");
  text = text.replace(/^(.+?)\s*질문에서\s*/u, "");
  text = text.replace(/질문 속 도메인·업무 단계 신호가 일치했습니다\.?/g, "");
  text = text.replace(/\s*후보입니다\.?\s*일치 표현:[^.]+\.?/g, "");
  text = text.replace(/\s+/g, " ").trim();
  if (!text || isInternalPolicyGuideText(text)) return "";
  return text;
}

function isInternalPolicyGuideText(value = "") {
  const text = normalizeReportText(value);
  if (!text) return true;
  return /파악한 질문|일치 표현|질문 속 도메인|분류[:：]|질문 문장만 기준|기본 조건:/.test(text)
    || /로컬 정책 코퍼스|확정 판단 대신|확인 슬롯|확인되지 않은 항목|확인이 부족한 항목/.test(text)
    || /후보입니다\.?\s*(?:일치 표현|질문 속 도메인)/.test(text);
}

function renderPolicyGuideOptionalClarifyingPanel(questions = []) {
  if (!questions.length) return "";
  return `
    <details class="answer-extra-panel">
      <summary>
        <span>더 정확히 하려면</span>
        <strong>부족한 정보 ${questions.length}개 보태기</strong>
      </summary>
      ${renderPolicyGuideClarifyingPanel(questions)}
    </details>
  `;
}

function getPolicyGuideDetailRequest(question = "") {
  const normalized = compactText(question);
  const explicitDetail = /추가요청|자세히보기|상세보기|더자세히|구체적으로|상세히/.test(normalized);
  return {
    sources: explicitDetail && /관련규정|규정|지침|공식출처|출처|원문|법령|근거/.test(normalized),
    forms: explicitDetail && /서식|양식|체크리스트|신청서|보고서|서류|절차/.test(normalized)
  };
}

function buildPolicyGuideShortCaution(response = {}, officeLabel = "", roleLabel = "") {
  if (response.officeDefault) {
    return response.officeDefault.notice || "교육청을 선택하지 않아 경상북도교육청 기준으로 우선 답변합니다. 실제 적용은 소속 교육청을 선택해야 더 정확합니다.";
  }
  if (/사립학교|학교법인/.test(roleLabel)) {
    return "사립학교는 학교법인 복무규정, 취업규칙, 단체협약, 근로계약의 실제 문구를 함께 확인해야 합니다.";
  }
  if (officeLabel && !/미선택/.test(officeLabel)) {
    return `${officeLabel} 기준입니다. ${response.caution || "학교 내부 규정과 최신 원문은 필요하면 추가로 확인하세요."}`;
  }
  return response.caution || `${officeLabel} 기준으로 답변하되, 학교 내부 규정과 최신 원문은 필요하면 추가로 확인하세요.`;
}

function renderPolicyGuideDetailSections(response, detailRequest = {}) {
  const sections = [];
  if (detailRequest.forms) {
    sections.push(`
      <section class="guide-answer-card guide-detail-card">
        <h3>서식·절차 체크</h3>
        <ol>${response.firstSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
      </section>
    `);
  }

  if (detailRequest.sources) {
    const sourceCards = [
      ...(response.officeSources || []),
      ...(response.nationalSources || [])
    ];
    sections.push(`
      <section class="guide-answer-card guide-detail-card">
        <h3>관련 규정·공식 출처</h3>
        <div class="guide-source-grid">
          ${sourceCards.map(renderPolicySourceCard).join("") || "<p>직접 자료 링크가 없으면 소속 교육청을 선택한 뒤 공식 도메인 검색으로 확인합니다.</p>"}
        </div>
      </section>
    `);
  }

  return sections.join("");
}

function renderPolicyGuideFollowupActions(response = {}, detailRequest = {}) {
  const actions = [
    {
      code: "sources",
      label: detailRequest.sources ? "규정 다시 확인" : "관련 규정 보기",
      prompt: "관련 규정과 공식 출처를 자세히 보여 주세요."
    },
    {
      code: "forms",
      label: detailRequest.forms ? "서식 다시 확인" : "서식·체크리스트",
      prompt: "필요한 서식, 서류, 절차 체크리스트를 자세히 보여 주세요."
    }
  ];

  return `
    <div class="guide-answer-actions" aria-label="추가로 확인할 내용">
      ${actions.map((action) => `
        <button type="button" class="guide-action-button" data-guide-followup="${escapeHtml(action.code)}" data-followup-prompt="${escapeHtml(action.prompt)}">
          ${escapeHtml(action.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderPolicyGuideUserSignals(response = {}) {
  const question = compactText(response.question || "");
  const signals = [];
  const addSignal = (label) => {
    if (label && !signals.includes(label)) signals.push(label);
  };

  if (/기간제교사|기간제교원/.test(question)) addSignal("기간제교사");
  else if (/기간제|계약제/.test(question)) addSignal("기간제·계약제");
  if (/사립학교|학교법인/.test(question)) addSignal("사립학교");
  if (/정교사|교사|교원|선생님/.test(question)) addSignal("교원");
  if (/행정실|행정직|주무관|지방공무원/.test(question)) addSignal("행정직·지방공무원");
  if (/학생|학부모|보호자/.test(question)) addSignal("학생·학부모");
  if (/연가|연차/.test(question)) addSignal("연가·연차");
  if (/병가|질병|진단서/.test(question)) addSignal("병가·진단서");
  if (/휴가|특별휴가|공가|경조사/.test(question)) addSignal("휴가");
  if (/출장|여비|숙박비|운임|일비/.test(question)) addSignal("출장·여비");
  if (/학폭|학교폭력|폭행|괴롭힘/.test(question)) addSignal("학교폭력·생활지도");
  if (/현장실습|도제|산학/.test(question)) addSignal("현장실습·산학협력");
  if (/고소|고발|민사|형사|소송|손해배상|분쟁|사건|사안/.test(question)) addSignal("사건·분쟁 가능성");
  if (/증빙|서류|진단서|회의록|동의서|기록|사진|녹취/.test(question)) addSignal("증빙자료");

  if (!signals.length) return "";
  return `
    <div class="guide-user-signals">
      <span>질문에서 보이는 단서</span>
      <strong>${signals.slice(0, 5).map(escapeHtml).join(" · ")}</strong>
    </div>
  `;
}

function renderPolicyGuideQuestionCompletion(response) {
  return `
    <section class="guide-answer-card primary guide-intent-card">
      <div class="answer-label">질문 완성 필요</div>
      <h3>질문을 조금만 더 좁히면 답할 수 있습니다.</h3>
      <p class="guide-answer-lead">${escapeHtml(response.lead)}</p>
      ${renderPolicyGuideUserSignals(response)}
    </section>

    ${renderPolicyGuideClarifyingPanel(response.clarifyingQuestions || [])}

  `;
}

function renderPolicyGuideIntentSummary(intentResolution = null) {
  return "";
}

function renderPolicyGuideIntentConfirmation(response) {
  const candidates = response.intentResolution?.candidates || [];

  return `
    <section class="guide-answer-card primary guide-intent-card">
      <div class="answer-label">질문 요지 확인 필요</div>
      <h3>가장 가까운 질문 요지를 골라 주세요.</h3>
      <p class="guide-answer-lead">${escapeHtml(response.lead)}</p>
      ${renderPolicyGuideUserSignals(response)}
      <form id="guideIntentConfirmForm" data-count="${candidates.length}">
        <div class="guide-intent-options">
          ${candidates.map((candidate, index) => `
            <label class="guide-intent-option" for="guide-intent-${index}">
              <input id="guide-intent-${index}" type="radio" name="intent-index" value="${index}" ${index === 0 ? "checked" : ""}>
              <span>
                <strong>${escapeHtml(candidate.label)}</strong>
                <small>${escapeHtml(candidate.summary || candidate.reason || "")}</small>
              </span>
              <em>${Math.round(candidate.confidence * 100)}%</em>
              <input type="hidden" name="intent-code-${index}" value="${escapeHtml(candidate.code)}">
              <input type="hidden" name="intent-label-${index}" value="${escapeHtml(candidate.label)}">
              <input type="hidden" name="intent-summary-${index}" value="${escapeHtml(candidate.summary || candidate.label)}">
            </label>
          `).join("")}
          <label class="guide-intent-option" for="guide-intent-manual">
            <input id="guide-intent-manual" type="radio" name="intent-index" value="${candidates.length}">
            <span>
              <strong>직접 입력</strong>
              <small>위 후보가 맞지 않으면 아래 추가 힌트에 실제 질문 요지를 직접 적습니다.</small>
            </span>
            <em>사용자 확인</em>
            <input type="hidden" name="intent-code-${candidates.length}" value="manualIntent">
            <input type="hidden" name="intent-label-${candidates.length}" value="직접 입력">
            <input type="hidden" name="intent-summary-${candidates.length}" value="사용자가 직접 입력한 질문 요지">
          </label>
        </div>
        <label class="guide-intent-note" for="guideIntentNote">
          <span>추가 힌트</span>
          <textarea id="guideIntentNote" name="intent-note" rows="2" placeholder="예: 배우자 출산휴가를 묻는 것입니다 / 부모 사망 경조사휴가입니다 / 연가가 아니라 특별휴가입니다"></textarea>
        </label>
        <div class="clarifier-actions">
          <button class="primary-action clarifier-submit" type="submit">이 요지로 다시 답변</button>
          <span id="guideIntentFeedback" class="clarifier-feedback" role="status"></span>
        </div>
      </form>
    </section>

  `;
}

function renderPolicyGuideDetectedClues(response = {}) {
  const question = compactText(response.question || "");
  const roleLabel = response.role?.label || "";
  const frame = response.analysis?.engineAnalysis?.semanticFrame || {};
  const frameDomain = frame.domainLabel || "";
  const clues = [];

  if (question) clues.push(`원 질문: ${question}`);
  if (roleLabel && roleLabel !== "상황에서 판단") clues.push(`신분 단서: ${roleLabel}`);
  if (frameDomain) clues.push(`업무영역 후보: ${frameDomain}`);
  if (/기간제|계약제|임기제|시간제/.test(question)) clues.push("신분 단서: 기간제·계약제 여부");
  if (/정교사|정규교사|정규직|공무원|교원/.test(question)) clues.push("신분 단서: 교원 복무 기준 가능성");
  if (/고소|고발|형사|민사|소송|손해배상|분쟁|사건/.test(question)) clues.push("사건 단서: 소송·고소·분쟁 가능성");
  if (/증빙|자료|서류|기록|캡처|진단서|신청서|보고서/.test(question)) clues.push("자료 단서: 증빙자료 확인 필요");

  const uniqueClues = uniqueStrings(clues).slice(0, 5);
  if (!uniqueClues.length) return "";

  return `
    <div class="guide-detected-clues">
      <strong>질문에서 확인된 단서</strong>
      <ul>${uniqueClues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderPolicyGuideClarifyingPanel(questions = []) {
  if (!questions.length) return "";
  const visibleQuestions = questions.slice(0, 4);

  return `
    <section class="clarifier-panel guide-clarifier-panel" aria-label="정확한 규정 답변을 위한 추가 확인">
      <div class="clarifier-head">
        <div>
          <span>추가 확인</span>
          <h3>부족한 정보만 알려주세요.</h3>
        </div>
      </div>
      <form id="guideClarifierForm" data-count="${visibleQuestions.length}">
        <div class="clarifier-list">
          ${visibleQuestions.map((item, index) => `
            <article class="clarifier-item">
              <label for="guide-clarifier-note-${index}">${escapeHtml(item.question)}</label>
              <input type="hidden" name="question-${index}" value="${escapeHtml(item.question)}">
              <div class="clarifier-grid">
                <select name="status-${index}" aria-label="${escapeHtml(item.question)} 답변 상태">
                  <option value="answer">답변 입력</option>
                  <option value="unknown">모름</option>
                  <option value="none">없음/해당 없음</option>
                  <option value="sensitive">민감해서 생략</option>
                </select>
                <textarea id="guide-clarifier-note-${index}" name="note-${index}" rows="2" placeholder="${escapeHtml(item.placeholder)}"></textarea>
              </div>
            </article>
          `).join("")}
        </div>
        <p class="clarifier-note">실명, 주민번호, 전화번호, 주소 같은 민감한 정보는 쓰지 않아도 됩니다.</p>
        <div class="clarifier-actions">
          <button class="primary-action clarifier-submit" type="submit">추가 정보 반영해서 다시 답변</button>
          <span id="guideClarifierFeedback" class="clarifier-feedback" role="status"></span>
        </div>
      </form>
    </section>
  `;
}

function renderPolicySourceCard(source = {}) {
  const href = getRenderablePolicySourceUrl(source);
  const linkLabel = getPolicySourceLinkLabel(source, href);
  return `
    <article>
      <span>${escapeHtml(source.source || "공식자료")}</span>
      <h4>${escapeHtml(source.title || "공식자료 확인")}</h4>
      <p>${escapeHtml(source.note || source.query || "원문을 확인합니다.")}</p>
      ${source.status ? `<em>${escapeHtml(source.status)}</em>` : ""}
      ${href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel)}</a>`
        : `<span class="guide-source-action">${escapeHtml(linkLabel)}</span>`}
    </article>
  `;
}

function getRenderablePolicySourceUrl(source = {}) {
  const url = String(source.url || "").trim();
  if (!url) return "";
  if (isGenericPolicyHomepageUrl(url)) {
    return buildPolicySourceSearchUrl(source);
  }
  return url;
}

function getPolicySourceLinkLabel(source = {}, href = "") {
  if (!href) return source.linkLabel || source.status || "정확한 기관 선택 후 확인";
  if (source.linkType === "search" || /google\.com\/search/i.test(href)) {
    return source.linkLabel || "공식 도메인 검색";
  }
  return source.linkLabel || "원문·자료 보기";
}

function isGenericPolicyHomepageUrl(url = "") {
  const parsed = parsePolicyUrl(url);
  if (!parsed) return false;

  const host = normalizePolicyHost(parsed.hostname);
  const path = normalizePolicyPath(parsed.pathname);
  const genericPaths = new Set(["/", "/main", "/main.do", "/main/main.do", "/index", "/index.do", "/home"]);

  if (host === "moe.go.kr" && genericPaths.has(path)) return true;
  if (host === "moel.go.kr" && genericPaths.has(path)) return true;
  if (host === "kosha.or.kr" && ["/", "/kosha", "/kosha/index.do", "/main"].includes(path)) return true;

  return educationOfficeCatalog.some((office) => {
    const officeUrl = parsePolicyUrl(office.homepage);
    if (!officeUrl) return false;
    return host === normalizePolicyHost(officeUrl.hostname) && genericPaths.has(path);
  });
}

function normalizePolicySourceUrl(url = "") {
  return String(url).trim().replace(/\/+$/, "");
}

function parsePolicyUrl(url = "") {
  const raw = String(url || "").trim();
  try {
    if (typeof URL === "function") {
      return new URL(raw);
    }
  } catch {
    // Fall through to the lightweight parser below for test sandboxes.
  }
  const match = raw.match(/^https?:\/\/([^/?#]+)([^?#]*)/i);
  if (!match) return null;
  return {
    hostname: match[1],
    pathname: match[2] || "/"
  };
}

function normalizePolicyHost(host = "") {
  return String(host || "").toLowerCase().replace(/^www\./, "");
}

function normalizePolicyPath(path = "") {
  const value = String(path || "/").replace(/\/+$/, "");
  return value || "/";
}

function buildPolicySourceSearchUrl(source = {}) {
  if (source.linkType === "none") return "";
  const domain = source.searchDomain
    || getPolicySourceDomainFromUrl(source.url)
    || getPolicySourceDefaultDomain(source.source || source.title || "");
  const query = source.query || source.title || "";
  return buildOfficialSiteSearchUrl(domain, query);
}

function getPolicySourceDomainFromUrl(url = "") {
  const parsed = parsePolicyUrl(url);
  return parsed ? normalizePolicyHost(parsed.hostname) : "";
}

function getPolicySourceDefaultDomain(value = "") {
  const text = String(value || "");
  if (/고용노동부|노동부|moel/i.test(text)) return "moel.go.kr";
  if (/안전보건공단|산업안전보건|kosha/i.test(text)) return "kosha.or.kr";
  if (/경상북도교육청|경북교육청/.test(text)) return "gbe.kr";
  if (/부산광역시교육청|부산교육청/.test(text)) return "pen.go.kr";
  if (/경상남도교육청|경남교육청/.test(text)) return "gne.go.kr";
  if (/교육부|시도교육청|교육청/.test(text)) return "moe.go.kr";
  return "";
}

function getEducationOffice(code = "auto") {
  return educationOfficeCatalog.find((item) => item.code === code) || educationOfficeCatalog[0];
}

function getPolicyGuideCategory(code = "leaveAttendance") {
  return policyGuideCategories[code] || policyGuideCategories.leaveAttendance;
}

function getPolicyRole(code = "auto") {
  return policyRoleProfiles[code] || policyRoleProfiles.auto;
}

function analyzePolicyGuideQuestion(question = "", normalized = compactText(question)) {
  const engineAnalysis = getPolicyEngineAnalysis(question);
  const domesticTravel = engineAnalysis?.intents?.domesticTravel || null;
  const taxonomyMatches = getPolicyQuestionTaxonomyMatches(question, { engineAnalysis }, 5);
  const taxonomyPrimary = taxonomyMatches[0] || null;
  const categoryCode = inferSpecializedPolicyGuideCategory(normalized, engineAnalysis, taxonomyPrimary)
    || engineAnalysis?.categoryCode
    || taxonomyPrimary?.categoryCode
    || (domesticTravel ? "leaveAttendance" : inferPolicyGuideCategory(normalized));
  const roleCode = engineAnalysis?.roleCode || inferPolicyRoleFromIntent(normalized, { domesticTravel });

  return {
    question,
    normalized,
    engineAnalysis,
    taxonomyMatches,
    categoryCode,
    roleCode,
    intents: {
      domesticTravel
    }
  };
}

function inferSpecializedPolicyGuideCategory(normalized = "", engineAnalysis = null, taxonomyPrimary = null) {
  const domainCode = engineAnalysis?.semanticFrame?.domainCode || "";
  const intentCode = taxonomyPrimary?.code || "";
  const domainCategoryMap = {
    fieldExperienceLearning: "fieldExperienceLearning",
    studentRecordsAttendance: "studentRecords",
    schoolViolenceProcedure: "schoolViolenceGuide",
    classManagementGuidance: "studentLifeGuidance",
    dormitoryOperation: "studentLifeGuidance",
    schoolSafetyHealth: "studentSafety",
    schoolMealOperation: "studentSafety",
    specialEducationSupport: "studentWelfare",
    scholarshipWelfareSupport: "studentWelfare",
    healthInfectionCounseling: "studentHealthCounseling",
    vocationalFieldTrainingOperation: "vocationalFieldTraining",
    apprenticeshipOperation: "vocationalFieldTraining",
    labEquipmentPracticeSafety: "studentSafety",
    vocationalCurriculumNcs: "vocationalCurriculum",
    careerEmploymentGuidance: "careerEmployment",
    admissionsTransferGraduation: "admissionsPathways",
    assessmentAcademicManagement: "studentRecords"
  };
  const intentCategoryMap = {
    fieldLearningApproval: "fieldExperienceLearning",
    fieldTripSafety: "fieldExperienceLearning",
    studentAttendanceAbsence: "studentAttendance",
    studentRecordCorrection: "studentRecords",
    schoolViolenceIntake: "schoolViolenceGuide",
    victimProtection: "schoolViolenceGuide",
    classMobilePhone: "studentLifeGuidance",
    classroomDisruption: "studentLifeGuidance",
    careerEmploymentGuidance: "careerEmployment",
    vocationalJobInfo: "careerEmployment",
    admissionsTransferGraduation: "admissionsPathways",
    scholarshipWelfare: "studentWelfare",
    healthInfectionCounseling: "studentHealthCounseling",
    schoolSafetyAccident: "studentSafety",
    labEquipmentSafety: "studentSafety",
    ncsCurriculum: "vocationalCurriculum",
    fieldTrainingOperation: "vocationalFieldTraining",
    apprenticeshipOperation: "vocationalFieldTraining"
  };

  if (intentCategoryMap[intentCode]) return intentCategoryMap[intentCode];
  if (/재직자전형|특별전형|선취업후진학|동일계전형|입학전형/.test(normalized)) return "admissionsPathways";
  if (/가정체험학습|교외체험학습|현장체험학습|체험학습신청|체험학습보고/.test(normalized)) return "fieldExperienceLearning";
  if (/출석인정|인정결석|질병결석|미인정결석|결석계|등교중지/.test(normalized)) return "studentAttendance";
  if (/고졸채용|취업지원|추천채용|학교장추천|잡알리오|졸업생노동상담|임금체불/.test(normalized)) return "careerEmployment";
  if (/현장실습|도제학교|일학습병행|표준협약서|선도기업|산학협력/.test(normalized)) return "vocationalFieldTraining";
  if (/ncs|엔씨에스|직업계고학점제|고교학점제|전문교과|실무과목|직업기초능력/i.test(normalized)) return "vocationalCurriculum";
  if (domainCategoryMap[domainCode]) return domainCategoryMap[domainCode];
  return "";
}

function inferPolicyGuideCategory(normalized = "") {
  const entries = Object.entries(policyGuideCategories)
    .map(([code, category]) => ({
      code,
      score: (category.aliases || []).reduce((sum, alias) => sum + (normalized.includes(compactText(alias)) ? Math.max(2, alias.length) : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

  return entries[0]?.score ? entries[0].code : "leaveAttendance";
}

function inferPolicyRoleFromIntent(normalized = "", intents = {}) {
  if (intents.domesticTravel?.profile?.roleCode) return intents.domesticTravel.profile.roleCode;
  return inferPolicyRole(normalized);
}

function inferPolicyRole(normalized = "") {
  if (/교육공무직|특수운영직군|무기계약|공무직/.test(normalized)) return "educationWorker";
  if (/기간제교원|기간제교사|기간제/.test(normalized)) return "fixedTermTeacher";
  if (/행정직|행정실|지방공무원|교육행정직|일반직/.test(normalized)) return "localOfficer";
  if (/사립|학교법인|법인/.test(normalized)) return "privateSchool";
  if (/학교장|교감|관리자|교장|행정실장/.test(normalized)) return "manager";
  if (/학부모|보호자/.test(normalized)) return "parent";
  if (/학생|출결|생활기록부|생기부|학생부/.test(normalized)) return "student";
  if (/교원|교사|담임|수업일|연가|병가|공가|교원휴가/.test(normalized)) return "teacher";
  return "auto";
}

function getOfficePolicyQueries(category, context = {}) {
  const normalized = compactText(context.question || context.analysis?.question || "");
  const frame = context.analysis?.engineAnalysis?.semanticFrame || context.directRule?.ruleLookup?.semanticFrame || {};
  const domainCode = context.directRule?.domain || frame.domainCode || "";
  const employmentCode = frame.slots?.employmentType?.code || "";
  const serviceIssueCode = frame.slots?.serviceIssue?.code || "";
  const roleCode = context.role?.code || context.analysis?.roleCode || frame.slots?.targetSubject?.roleCode || frame.slots?.travelerRole?.code || "";
  const isFixedTerm = employmentCode === "fixedTerm" || roleCode === "fixedTermTeacher" || /기간제|계약제/.test(normalized);
  const isPrivateSchool = employmentCode === "privateSchool" || roleCode === "privateSchool" || /사립|학교법인/.test(normalized);
  const isLocalOfficer = employmentCode === "localOfficer" || roleCode === "localOfficer" || /지방공무원|행정직|교육행정/.test(normalized);
  const isEducationWorker = employmentCode === "educationStaff" || roleCode === "educationWorker" || /교육공무직|공무직|조리실무|돌봄전담/.test(normalized);

  const domainOfficeQueries = {
    vocationalFieldTrainingOperation: ["직업계고 현장실습 운영 매뉴얼", "현장실습 표준협약서 선도기업", "도제학교 일학습병행 운영 지침"],
    vocationalCurriculumNcs: ["직업계고 교육과정 NCS 실무과목", "고교학점제 직업계고 운영 지침", "전문교과 평가계획 학점 이수"],
    labEquipmentPracticeSafety: ["실험실습실 안전관리 지침", "실습실 기자재 보호구 MSDS", "직업계고 실습재료 안전교육"],
    careerEmploymentGuidance: ["직업계고 취업지원 고졸채용 공식공고", "잡알리오 고졸채용 공공기관 채용공고", "추천채용 근로조건 검증 지침"],
    admissionsTransferGraduation: ["전입학 학적 졸업 지침", "직업위탁 수료 졸업 인정", "특성화고 입학전형 전입학"],
    scholarshipWelfareSupport: ["교육비 지원 장학금 지침", "수익자부담 환불 정산 지침", "기숙사비 통학비 지원 기준"],
    healthInfectionCounseling: ["감염병 등교중지 학교보건 지침", "위기학생 상담기록 Wee 지침", "보건실 투약 학생 건강관리"],
    teacherRightsProtection: ["교육활동 침해 교원 보호 지침", "교권보호위원회 교육청", "악성민원 교직원 보호 절차"],
    facilityDigitalSecurity: ["학교 CCTV 개인정보 지침", "나이스 K-에듀파인 권한관리 지침", "교육청 정보보안 기본지침"],
    governanceCommitteeRule: ["학교운영위원회 규정 회의록 공개", "학칙 개정 의견수렴 절차", "학교 위원회 운영 지침"]
  };

  if (domainOfficeQueries[domainCode]) {
    return domainOfficeQueries[domainCode];
  }

  if (category === policyGuideCategories.leaveAttendance && isFixedTerm) {
    if (isPrivateSchool) {
      if (serviceIssueCode === "annualLeave" || /연가|연차|휴가/.test(normalized)) {
        return [
          "사립학교 기간제교사 취업규칙 복무규정 연가",
          "학교법인 기간제교사 근로계약 연차유급휴가",
          "계약제교원 운영 지침 기간제교사 연가 연차"
        ];
      }

      if (serviceIssueCode === "sickLeave" || /병가|질병|진단서/.test(normalized)) {
        return [
          "사립학교 기간제교사 취업규칙 복무규정 병가",
          "학교법인 기간제교사 근로계약 병가 유급 무급",
          "계약제교원 운영 지침 기간제교사 병가 복무"
        ];
      }

      return [
        "사립학교 기간제교사 취업규칙 복무규정",
        "학교법인 기간제교사 근로계약 복무 휴가",
        "계약제교원 운영 지침 기간제교사 복무"
      ];
    }

    if (serviceIssueCode === "annualLeave" || /연가|연차|휴가/.test(normalized)) {
      return [
        "계약제교원 운영 지침 기간제교사 연가 연차",
        "기간제교사 근로계약 연차유급휴가 방학 중 비근무",
        "계약제교원 복무 나이스 근무상황 연가"
      ];
    }

    if (serviceIssueCode === "sickLeave" || /병가|질병|진단서/.test(normalized)) {
      return [
        "계약제교원 운영 지침 기간제교사 병가 복무",
        "기간제교사 근로계약 병가 유급 무급",
        "계약제교원 복무 나이스 근무상황 병가"
      ];
    }

    return [
      "계약제교원 운영 지침 기간제교사 복무",
      "기간제교사 근로계약 복무 휴가",
      "계약제교원 나이스 근무상황 처리"
    ];
  }

  if (category === policyGuideCategories.leaveAttendance && isLocalOfficer) {
    return ["지방공무원 복무 조례 휴가", "지방공무원 복무규정 근태", "교육청 지방공무원 복무 지침"];
  }

  if (category === policyGuideCategories.leaveAttendance && isEducationWorker) {
    return ["교육공무직원 취업규칙 복무 휴가", "교육공무직 단체협약 연차", "교육공무직 근로계약 복무"];
  }

  if (category === policyGuideCategories.leaveAttendance && isPrivateSchool) {
    return ["사립학교 취업규칙 복무 휴가", "학교법인 복무규정 연가 병가", "사립학교 교원 근로계약 병가 휴가 연차"];
  }

  return category.officeQueries || [];
}

function filterPolicySourceKeysForContext(sourceKeys = [], context = {}) {
  const normalized = compactText(context.question || context.analysis?.question || "");
  const frame = context.analysis?.engineAnalysis?.semanticFrame || context.directRule?.ruleLookup?.semanticFrame || {};
  const domainCode = context.directRule?.domain || frame.domainCode || "";
  const employmentCode = frame.slots?.employmentType?.code || "";
  const roleCode = context.role?.code || context.analysis?.roleCode || "";

  const domainScopedSourceKeys = {
    domesticTravelExpense: ["travelExpense", "publicRecords"],
    vocationalFieldTrainingOperation: ["vocationalEducationAct", "fieldTrainingManual", "apprenticeshipGuide", "schoolSafetyAct", "industrialSafetyAct", "publicRecords", "infoDisclosure"],
    vocationalCurriculumNcs: ["nationalCurriculum", "vocationalCurriculumGuide", "schoolRecordGuide", "schoolRecordRule", "elementarySecondaryEducationAct", "publicRecords"],
    labEquipmentPracticeSafety: ["schoolSafetyAct", "industrialSafetyAct", "vocationalCurriculumGuide", "schoolAccountingRule", "publicRecords"],
    careerEmploymentGuidance: ["jobAlio", "vocationalEmploymentGuide", "laborStandard", "fixedTermAct", "publicRecords", "infoDisclosure"],
    admissionsTransferGraduation: ["elementarySecondaryEducationAct", "schoolRecordRule", "schoolRecordGuide", "publicRecords", "infoDisclosure"],
    scholarshipWelfareSupport: ["educationWelfareGuide", "schoolAccountingRule", "afterSchoolGuide", "publicRecords", "infoDisclosure"],
    healthInfectionCounseling: ["schoolHealthAct", "studentCounselingGuide", "schoolSafetyAct", "publicRecords", "infoDisclosure"],
    teacherRightsProtection: ["teacherRightsAct", "studentGuidanceRule", "publicRecords", "infoDisclosure"],
    facilityDigitalSecurity: ["schoolFacilitySafetyGuide", "personalInfoAct", "infoDisclosure", "publicRecords", "localContract"],
    governanceCommitteeRule: ["elementarySecondaryEducationAct", "publicRecords", "infoDisclosure", "studentGuidanceRule"]
  };

  if (domainScopedSourceKeys[domainCode]) {
    const allowed = new Set(domainScopedSourceKeys[domainCode]);
    return sourceKeys.filter((key) => allowed.has(key));
  }

  if (!["staffAttendanceService", "bereavementLeave"].includes(domainCode)) {
    return sourceKeys;
  }

  const scopedSourceKeys = sourceKeys.filter((key) => key !== "travelExpense");
  const isPrivate = employmentCode === "privateSchool" || roleCode === "privateSchool" || /사립|학교법인/.test(normalized);
  const isFixedTerm = employmentCode === "fixedTerm" || roleCode === "fixedTermTeacher" || /기간제|계약제/.test(normalized);
  const isEducationWorker = employmentCode === "educationStaff" || roleCode === "educationWorker" || /교육공무직|공무직/.test(normalized);
  const isLocalOfficer = employmentCode === "localOfficer" || roleCode === "localOfficer" || /지방공무원|행정직|교육행정/.test(normalized);

  if (isPrivate) {
    return scopedSourceKeys.filter((key) => ["teacherLeave", "laborStandard", "fixedTermAct", "privateSchoolWorkRules", "publicRecords", "infoDisclosure"].includes(key));
  }

  if (isFixedTerm) {
    return scopedSourceKeys.filter((key) => ["teacherLeave", "nationalService", "laborStandard", "fixedTermAct", "fixedTermTeacherGuideline", "publicRecords", "infoDisclosure"].includes(key));
  }

  if (isEducationWorker) {
    return scopedSourceKeys.filter((key) => ["laborStandard", "fixedTermAct", "educationWorkerWorkRules", "publicRecords", "infoDisclosure"].includes(key));
  }

  if (isLocalOfficer) {
    return scopedSourceKeys.filter((key) => ["nationalService", "localService", "publicRecords", "infoDisclosure"].includes(key));
  }

  return scopedSourceKeys.filter((key) => !["educationWorkerWorkRules", "fixedTermTeacherGuideline", "privateSchoolWorkRules"].includes(key));
}

function buildOfficePolicySources(office, category, context = {}) {
  const sources = [];
  const label = office.code === "auto" ? "소속 교육청" : office.label;
  const officeQueries = getOfficePolicyQueries(category, context);

  if (category === policyGuideCategories.budgetExecution) {
    if (office.budgetGuide?.url) {
      sources.push({
        title: office.budgetGuide.title,
        source: label,
        url: office.budgetGuide.url,
        note: `${label} 학교회계 예산편성 기준을 우선 확인합니다.`,
        status: office.budgetGuide.status
      });
    } else {
      sources.push({
        title: `${label} 학교회계 예산편성 기본지침`,
        source: label,
        url: buildOfficialDomainSearchUrl(office, "2026학년도 학교회계 예산편성 기본지침"),
        note: "교육청별 해당 학년도 학교회계 지침을 최우선으로 확인합니다.",
        status: office.code === "auto" ? "교육청 선택 필요" : "공식 도메인 검색",
        linkType: office.code === "auto" ? "none" : "search",
        linkLabel: office.code === "auto" ? "교육청 선택 후 공식 자료실 검색" : "공식 도메인 검색"
      });
    }
  }

  officeQueries.slice(0, 3).forEach((query) => {
    sources.push({
      title: `${label} ${query}`,
      source: label,
      url: buildOfficialDomainSearchUrl(office, query),
      note: "홈페이지 메인이 아니라 소속 교육청 공식 도메인 안에서 해당 지침·자료명을 좁혀 확인합니다.",
      status: office.code === "auto" ? "교육청 선택 필요" : "공식 도메인 검색",
      linkType: office.code === "auto" ? "none" : "search",
      linkLabel: office.code === "auto" ? "교육청 선택 후 공식 자료실 검색" : "공식 도메인 검색"
    });
  });

  return dedupePolicySources(sources).slice(0, 5);
}

function buildOfficialDomainSearchUrl(office, query) {
  if (office.code === "auto" || !office.domain) return "";

  return buildOfficialSiteSearchUrl(office.domain, query);
}

function buildOfficialSiteSearchUrl(domain = "", query = "") {
  if (!domain || !query) return "";
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`;
}

function dedupePolicySources(sources = []) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = `${source.title}|${source.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPolicySearchQueries(question, office, category, role, directRule) {
  const officeLabel = office.code === "auto" ? "소속 교육청" : office.label;
  const sourceContext = { question, directRule, role };
  const officeQueries = getOfficePolicyQueries(category, sourceContext);
  const scopedCategorySourceKeys = filterPolicySourceKeysForContext(category.sourceKeys || [], sourceContext);
  return filterPolicySearchQueriesForContext(uniqueStrings([
    ...(directRule?.queries || []),
    `${officeLabel} ${category.label} 지침`,
    `${officeLabel} ${role.label} 규정`,
    ...officeQueries,
    ...(scopedCategorySourceKeys.map((key) => policySourceCatalog[key]?.query).filter(Boolean)),
    question
  ]), sourceContext).slice(0, 10);
}

function filterPolicySearchQueriesForContext(queries = [], context = {}) {
  const normalized = compactText(context.question || context.analysis?.question || "");
  const frame = context.analysis?.engineAnalysis?.semanticFrame || context.directRule?.ruleLookup?.semanticFrame || {};
  const domainCode = context.directRule?.domain || frame.domainCode || "";
  const employmentCode = frame.slots?.employmentType?.code || "";
  const roleCode = context.role?.code || context.analysis?.roleCode || frame.slots?.targetSubject?.roleCode || frame.slots?.travelerRole?.code || "";
  if (!["staffAttendanceService", "bereavementLeave"].includes(domainCode)) return queries;

  const isPrivateSchool = employmentCode === "privateSchool" || roleCode === "privateSchool" || /사립|학교법인/.test(normalized);
  const isFixedTerm = employmentCode === "fixedTerm" || roleCode === "fixedTermTeacher" || /기간제|계약제/.test(normalized);
  const isEducationWorker = employmentCode === "educationStaff" || roleCode === "educationWorker" || /교육공무직|공무직/.test(normalized);
  const isLocalOfficer = employmentCode === "localOfficer" || roleCode === "localOfficer" || /지방공무원|행정직|교육행정/.test(normalized);

  const blockedPatterns = [];
  if (isPrivateSchool) {
    blockedPatterns.push(/교육공무직|공무직|지방공무원|교육행정|행정직/);
  } else if (isFixedTerm) {
    blockedPatterns.push(/교육공무직|공무직|지방공무원|교육행정|행정직|사립학교|학교법인/);
  } else if (isEducationWorker) {
    blockedPatterns.push(/지방공무원|교육행정|행정직|계약제교원|기간제교사|사립학교|학교법인|교원휴가/);
  } else if (isLocalOfficer) {
    blockedPatterns.push(/교육공무직|공무직|계약제교원|기간제교사|사립학교|학교법인|교원휴가/);
  } else if (roleCode === "teacher") {
    blockedPatterns.push(/교육공무직|공무직|계약제교원|기간제교사|사립학교|학교법인/);
  }
  if (!blockedPatterns.length) return queries;
  return queries.filter((query) => !blockedPatterns.some((pattern) => pattern.test(query)));
}

function getDirectPolicyRule(analysis, category, role, office) {
  const normalized = typeof analysis === "string" ? analysis : analysis?.normalized || "";

  if (category === policyGuideCategories.leaveAttendance) {
    const childbirthRule = buildSpouseChildbirthLeaveRule(normalized, role, office);
    if (childbirthRule) return childbirthRule;
  }

  if (category === policyGuideCategories.leaveAttendance && hasBereavementIntentSignal(normalized)) {
    const bereavementRule = buildBereavementLeaveRule(normalized);
    if (bereavementRule) return bereavementRule;
  }

  if (category === policyGuideCategories.budgetExecution && /강사수당|강사료|강사비|강의비|강의료|강연료|외부강사|교육강사|강의/.test(normalized)) {
    const instructorRule = buildGyeongbukInstructorFeeRule(normalized, office);
    if (instructorRule) return instructorRule;

    return {
      title: "교육 강사수당 확인 기준",
      lead: "강사료는 소속 교육청 학교회계 예산편성 기본지침의 교육 강사수당 표에서 강사 등급을 먼저 확정해야 합니다.",
      answer: [
        "강의비는 소속 교육청의 해당 학년도 교육 강사수당 표에서 강사 등급과 기본·초과시간 단가를 확인해야 합니다.",
        "교장, 교감, 교사, 전직 교원, 외부 전문가 여부에 따라 일반강사 등급이 달라질 수 있습니다.",
        "특별강사 인정은 직위명만으로 단정하지 말고 학교장 인정 사유와 내부 결재 근거를 남겨야 합니다."
      ],
      sourceKeys: ["schoolAccountingRule", "publicRecords"],
      queries: ["교육청 학교회계 예산편성 기본지침 교육 강사수당", "강사수당 일반강사 교장"]
    };
  }

  if (category === policyGuideCategories.budgetExecution && /업무추진비|간담회|식비|협의회/.test(normalized)) {
    return {
      title: "업무추진비·협의회 지출 확인 기준",
      lead: "업무추진비는 교육청 예산편성 기본지침의 사용 가능 범위와 학교 내부 품의·검수·지출 증빙 흐름을 같이 봐야 합니다.",
      answer: [
        "업무추진비·협의회 지출은 소속 교육청의 2026학년도 학교회계 예산편성 기본지침을 먼저 확인해야 합니다.",
        "품의서, 참석자 범위, 목적, 일시·장소, 영수증 또는 카드전표, 지출결의서를 함께 보관합니다.",
        "목적사업비나 수익자부담경비 등 재원 성격이 다르면 별도 집행 제한이 있을 수 있습니다."
      ],
      sourceKeys: ["schoolAccountingRule", "localContract", "publicRecords"],
      queries: ["학교회계 예산편성 기본지침 업무추진비", "학교회계 업무추진비 지출 증빙"]
    };
  }

  if (category === policyGuideCategories.budgetExecution && /수의계약|계약|검수|물품|용역|공사/.test(normalized)) {
    return {
      title: "계약·검수·지출 증빙 확인 기준",
      lead: "계약과 검수는 교육청 학교회계 지침, 학교회계 규칙, 지방계약 법령, 내부 결재 문서가 함께 맞아야 합니다.",
      answer: [
        "계약·검수·지출 증빙은 예산 편성 과목과 실제 집행 품목이 일치하는지부터 확인해야 합니다.",
        "품의, 견적 또는 계약, 납품·완료 확인, 검수, 지출결의, 증빙자료 순서로 문서 흐름을 맞춥니다.",
        "수의계약 가능 여부와 견적 기준은 지방계약 법령과 교육청 지침에서 함께 확인합니다."
      ],
      sourceKeys: ["schoolAccountingRule", "localContract", "publicRecords"],
      queries: ["학교회계 수의계약 검수 지출 증빙", "지방계약법 수의계약 학교"]
    };
  }

  return null;
}

function buildSpouseChildbirthLeaveRule(normalized, role = {}, office = {}) {
  if (!isSpouseChildbirthLeaveIntent(normalized)) return null;

  const subjectLabel = role?.code === "fixedTermTeacher"
    ? "기간제교사"
    : role?.code === "educationWorker"
      ? "교육공무직"
      : role?.code === "privateSchool"
        ? "사립학교 교직원"
        : "공립 정규교원";
  const needsOfficeCheck = ["fixedTermTeacher", "educationWorker", "privateSchool"].includes(role?.code);
  const officeText = office?.code && office.code !== "auto" ? `${office.label} ` : "";
  const caution = needsOfficeCheck
    ? `${subjectLabel}은 공립 정규교원 기준을 참고하되 ${officeText}계약제교원 지침, 취업규칙, 단체협약, 근로계약, 학교법인 규정에서 배우자 출산휴가 적용 일수와 유급 여부를 직접 확인해야 합니다.`
    : "교육공무직·기간제·사립학교 교직원은 공립 정규교원 기준을 바로 적용하지 말고 소속 교육청 지침, 취업규칙, 단체협약, 근로계약의 특별휴가 조항을 다시 확인해야 합니다.";

  return {
    title: "배우자 출산휴가 확인 기준",
    lead: "질문 요지는 가족 사망 경조사휴가가 아니라 배우자 출산에 따른 특별휴가 일수입니다.",
    answer: [
      `${subjectLabel} 기준으로 배우자 출산휴가는 20일입니다.`,
      "근거 갈래는 국가공무원 복무규정 제20조의 특별휴가 체계와 교원휴가에 관한 예규의 교원 휴가 처리 기준입니다.",
      "나이스 근무상황에서 배우자 출산휴가 또는 특별휴가로 신청하고, 출산 사실 확인 자료와 학교장 승인 절차를 맞춰 처리합니다.",
      "배우자, 출산, 휴가 일수가 함께 나오면 상례휴가·부모상 규정을 적용하지 않습니다."
    ],
    steps: [
      "질문 사유를 배우자 출산휴가로 확정",
      "공립 정규교원인지, 기간제·교육공무직·사립학교 교직원인지 신분 확인",
      "나이스 근무상황 신청 종별, 사용 시작일, 증빙자료, 학교장 승인 절차 확인",
      "비공립·비정규 신분이면 소속 교육청 지침, 취업규칙, 단체협약, 근로계약 조항 대조"
    ],
    sourceKeys: ["nationalService", "teacherLeave", "localService", "laborStandard"],
    queries: [
      "국가공무원 복무규정 제20조 배우자 출산휴가 20일",
      "교원휴가에 관한 예규 배우자 출산휴가",
      "나이스 근무상황 배우자 출산휴가 신청",
      "교육청 계약제교원 배우자 출산휴가"
    ],
    caution,
    roleLabel: subjectLabel,
    intentCode: "spouseChildbirthLeave",
    priority: "exactIntent",
    sourcePriority: needsOfficeCheck ? "roleFirst" : "national"
  };
}

function buildBereavementLeaveRule(normalized) {
  const relation = inferBereavementRelation(normalized);
  if (!relation) return null;

  const sourceKeys = ["nationalService", "teacherLeave", "localService", "laborStandard"];
  const commonSteps = [
    "신분이 공립 교원인지, 지방공무원인지, 교육공무직인지, 기간제인지, 사립학교 교직원인지 확정",
    "경조사 대상과 본인·배우자 기준의 가족관계를 정확히 구분",
    "휴가 시작일, 휴일 포함 방식, 나이스 신청 종별, 증빙자료 제출 기준 확인"
  ];

  if (relation.listed === false) {
    return {
      title: `${relation.label} 경조사휴가 확인 기준`,
      lead: "경조사휴가는 사망 사실만으로 판단하지 않고, 국가공무원 복무규정 별표 2의 가족관계별 일수표에 해당 관계가 열거되어 있는지 먼저 확인해야 합니다.",
      answer: [
        `공립 교원·국가공무원 기준으로 ${relation.label} 사망은 국가공무원 복무규정 별표 2의 경조사별 휴가 일수표에 별도 일수로 열거되어 있지 않습니다.`,
        "따라서 배우자의 부모 사망 5일 규정을 적용하면 안 됩니다.",
        "필요하면 연가 등 일반 복무 처리 가능성과 소속 교육청·학교 내부 규정의 별도 경조사휴가 여부를 확인합니다.",
        "교육공무직·기간제·사립학교 교직원은 취업규칙, 단체협약, 근로계약서, 학교법인 복무규정에서 방계친족 경조사휴가를 별도로 정했는지 확인합니다."
      ],
      steps: commonSteps,
      sourceKeys,
      queries: [
        "국가공무원 복무규정 별표2 경조사별 휴가 일수표",
        `교원휴가에 관한 예규 ${relation.label} 경조사휴가`,
        `교육공무직 취업규칙 ${relation.label} 경조사휴가`
      ],
      caution: "경조사휴가는 가족관계명이 비슷해도 일수가 달라집니다. 배우자의 삼촌·숙부·이모 등은 배우자의 부모가 아니므로 5일 규정을 적용하지 않습니다."
    };
  }

  const conditionText = relation.legalCondition ? ` ${relation.legalCondition}에는` : "";
  return {
    title: `${relation.label} 경조사휴가 확인 기준`,
    lead: "공립 교원·국가공무원 기준은 공통 법령에서 일수를 먼저 확인할 수 있지만, 교육공무직·사립학교·기간제 직원은 소속 교육청이나 법인 규정이 더 구체적일 수 있습니다.",
    answer: [
      `공립 교원·국가공무원 기준으로 ${relation.label} 사망 경조사휴가는${conditionText} ${relation.leaveDays}일입니다.`,
      "근거는 국가공무원 복무규정 제20조와 별표 2의 경조사별 휴가 일수표입니다.",
      "공립 교원은 교원휴가에 관한 예규와 나이스 근무상황 신청, 학교장 승인 절차를 함께 확인합니다.",
      "지방공무원·행정직은 지방공무원 복무규정과 관할 교육청 복무 조례·예규를 대조합니다.",
      "교육공무직·특수운영직군은 소속 교육청 취업규칙, 단체협약, 근로계약서의 경조사휴가표를 우선 확인합니다.",
      "사립학교 교직원은 학교법인 취업규칙, 복무규정, 단체협약에서 같은 경조사휴가가 어떻게 정해졌는지 확인합니다."
    ],
    steps: commonSteps,
    sourceKeys,
    queries: [
      `국가공무원 복무규정 제20조 별표2 ${relation.label} 사망 ${relation.leaveDays}일`,
      `교원휴가에 관한 예규 ${relation.label} 경조사휴가`,
      `교육공무직 경조사휴가 ${relation.label}`
    ],
    caution: relation.legalCondition || "실제 신청 전에는 신분, 가족관계 증빙, 휴가 시작일과 소속기관 세부 기준을 확인해야 합니다."
  };
}

function inferBereavementRelation(normalized) {
  const relations = [
    { code: "spouseUncleAunt", label: "배우자의 삼촌·숙부·이모 등 방계친족", listed: false, patterns: [/배우자.*(?:삼촌|숙부|백부|외삼촌|고모|이모|큰아버지|작은아버지|큰어머니|작은어머니|외숙모)/] },
    { code: "spouseParent", label: "배우자의 부모", leaveDays: 5, listed: true, patterns: [/배우자.*(?:부모|부친|모친|아버지|어머니)|장인|장모|시부|시모/] },
    { code: "spouseGrandParent", label: "배우자의 조부모·외조부모", leaveDays: 3, listed: true, patterns: [/배우자.*(?:조부모|외조부모|할아버지|할머니|외조부|외조모)/] },
    { code: "spouseSibling", label: "배우자의 형제자매", leaveDays: 1, listed: true, patterns: [/배우자.*(?:형제|자매|오빠|언니|누나|동생|형|누이)/] },
    { code: "spouseChild", label: "배우자의 자녀", leaveDays: 3, listed: true, legalCondition: "법적으로 본인의 자녀 관계가 확인되는 경우", patterns: [/배우자.*(?:자녀|아들|딸)/] },
    { code: "parent", label: "본인 부모", leaveDays: 5, listed: true, patterns: [/부모상|본인부모|부친|모친|아버지|어머니/] },
    { code: "spouse", label: "배우자", leaveDays: 5, listed: true, patterns: [/배우자상|배우자사망|배우자가사망|남편상|아내상|남편.*사망|아내.*사망/] },
    { code: "childSpouse", label: "자녀의 배우자", leaveDays: 3, listed: true, patterns: [/자녀.*배우자|아들.*배우자|딸.*배우자|사위|며느리/] },
    { code: "child", label: "자녀", leaveDays: 3, listed: true, patterns: [/자녀|아들|딸/] },
    { code: "grandParent", label: "조부모·외조부모", leaveDays: 3, listed: true, patterns: [/조부모|할아버지|할머니|외조부|외조모/] },
    { code: "sibling", label: "형제자매", leaveDays: 1, listed: true, patterns: [/형제|자매|오빠|언니|누나|동생|형|누이/] },
    { code: "uncleAunt", label: "삼촌·숙부·이모 등 방계친족", listed: false, patterns: [/삼촌|숙부|백부|외삼촌|고모|이모|큰아버지|작은아버지|큰어머니|작은어머니|외숙모/] }
  ];
  return relations.find((relation) => relation.patterns.some((pattern) => pattern.test(normalized))) || null;
}

function buildGyeongbukInstructorFeeRule(normalized, office) {
  if (office?.code !== "gyeongbuk") return null;

  const profile = inferGyeongbukInstructorFeeProfile(normalized);
  if (!profile) return null;

  const subjectLabel = inferInstructorSubjectLabel(normalized, profile);
  const hours = inferLectureHours(normalized);
  const hasTotalHours = Number.isFinite(hours) && hours > 0 && !/시간당|1\s*시간당/.test(normalized);
  const total = hasTotalHours ? calculateInstructorFee(profile, hours) : null;
  const rateText = `기본 1시간 ${formatWon(profile.base)}, 초과시간당 ${formatWon(profile.extra)}`;
  const answerLead = hasTotalHours
    ? `${office.label} 2026 공립학교회계 기준으로 ${subjectLabel}은 ${profile.grade}로 보아 ${formatHours(hours)} 강의비는 ${formatWon(total)}입니다.`
    : `${office.label} 2026 공립학교회계 기준으로 ${subjectLabel}은 ${profile.grade}로 보아 ${rateText}을 적용합니다.`;
  const calculationText = hasTotalHours
    ? `산출식은 기본 1시간 ${formatWon(profile.base)} + 초과 ${formatHours(Math.max(0, hours - 1))} × ${formatWon(profile.extra)} = ${formatWon(total)}입니다.`
    : `${profile.grade} 단가는 ${rateText}입니다.`;

  return {
    title: `${office.label} ${subjectLabel} 강사수당 확인 기준`,
    lead: `${office.label} 2026학년도 공립학교회계 예산편성 기본지침의 교육 강사수당 표를 기준으로 하되, 사립학교는 학교법인·학교 내부 지급 기준을 함께 확인해야 합니다.`,
    answer: [
      answerLead,
      calculationText,
      profile.basis,
      "특별강사 인정은 직위명만으로 단정하지 말고 학교장 인정 사유와 내부 결재 근거를 남겨야 합니다.",
      "사립학교는 이 지침을 준용하는지, 학교법인 정관·취업규칙·단체협약·내부 강사수당 지급 기준에 별도 단가가 있는지 먼저 확인합니다.",
      "당해 기관 소속 공무원이 자기 업무와 관련하여 소속 기관에서 교육하거나 교관요원으로 지정된 자체교육 강사인 경우에는 강사수당을 지급하지 않는 예외가 있습니다."
    ],
    steps: [
      "강사의 현재·전직 신분과 강의 주제가 해당 분야 전문성에 해당하는지 확인",
      `${profile.grade} 적용 사유와 ${rateText} 산출기초를 품의서에 명시`,
      "강의 시간은 기본 1시간과 초과시간으로 나누어 산출",
      "사립학교는 법인·학교 내부 강사수당 기준과 경북교육청 지침 준용 여부 확인",
      "청탁금지법 시행령 별표 2의 외부강의등 사례금 상한액 초과 여부 확인"
    ],
    sourceKeys: ["schoolAccountingRule", "publicRecords"],
    queries: [
      `경상북도교육청 2026학년도 공립학교회계 예산편성 기본지침 교육 강사수당 ${profile.grade}`,
      `경북교육청 교육강사수당 ${subjectLabel} 강의비`
    ],
    caution: "강사수당은 한도 단가와 내부 결재 사유가 함께 맞아야 합니다. 특히 사립학교는 공립학교회계 지침을 그대로 적용하는지보다 학교법인·학교 내부 규정의 준용 여부가 먼저입니다."
  };
}

function inferGyeongbukInstructorFeeProfile(normalized) {
  const profiles = {
    special2: {
      grade: "특별강사2",
      base: 300000,
      extra: 200000,
      basis: "특별강사2는 전·현직 장·차관, 국회의원, 대학총장급, 교육감 등 지침에서 정한 고위직·권위자 유형에 적용됩니다."
    },
    general1: {
      grade: "일반강사1",
      base: 200000,
      extra: 100000,
      basis: "일반강사1 적용 대상에는 유·초·중등학교장, 4급 상당 이상 공무원, 장학관·교육연구관, 해당 분야 전문가 등이 포함되어 있습니다."
    },
    general2: {
      grade: "일반강사2",
      base: 120000,
      extra: 60000,
      basis: "일반강사2 적용 대상에는 일반강사1에 해당하지 않는 5급 이하 공무원 및 교육공무원, 대학 시간강사, 외국인 원어민 강사 등이 포함됩니다."
    },
    general3: {
      grade: "일반강사3",
      base: 80000,
      extra: 40000,
      basis: "일반강사3은 외국어, 체육, 전산강사 등 별도 전문강사 유형에 적용됩니다."
    }
  };

  if (/교육감|장관|차관|국회의원|대학\s*총장|대학총장|정부출연\s*연구기관장|국영기업체장|인간문화재|유명\s*예술인|특별강사\s*2/.test(normalized)) {
    return profiles.special2;
  }
  if (/교장|학교장|유초중등학교장|유·초·중등학교장|장학관|교육연구관|4급|박사|일반강사\s*1/.test(normalized)) {
    return profiles.general1;
  }
  if (/교감|교사|교원|교육공무원|장학사|교육연구사|5급|6급|7급|8급|9급|대학\s*전임강사|전임강사|시간강사|원어민|일반강사\s*2/.test(normalized)) {
    return profiles.general2;
  }
  if (/전산강사|컴퓨터강사|외국어강사|체육강사|일반강사\s*3/.test(normalized)) {
    return profiles.general3;
  }

  return null;
}

function inferInstructorSubjectLabel(normalized, profile) {
  if (/전직\s*교장|퇴직\s*교장/.test(normalized)) return "전직 교장";
  if (/교장|학교장|유초중등학교장|유·초·중등학교장/.test(normalized)) return "교장";
  if (/전직\s*교감|퇴직\s*교감/.test(normalized)) return "전직 교감";
  if (/교감/.test(normalized)) return "교감";
  if (/전직\s*교사|퇴직\s*교사|전직\s*교원|퇴직\s*교원/.test(normalized)) return "전직 교원";
  if (/교사|교원/.test(normalized)) return "교원";
  if (/장학관/.test(normalized)) return "장학관";
  if (/교육연구관/.test(normalized)) return "교육연구관";
  if (/장학사/.test(normalized)) return "장학사";
  if (/교육연구사/.test(normalized)) return "교육연구사";
  if (/대학\s*전임강사|전임강사/.test(normalized)) return "대학 전임강사";
  if (/시간강사/.test(normalized)) return "대학 시간강사";
  if (/교육감/.test(normalized)) return "교육감";
  if (/대학\s*총장|대학총장/.test(normalized)) return "대학 총장급 강사";
  if (/전산강사|컴퓨터강사/.test(normalized)) return "전산강사";
  if (/외국어강사/.test(normalized)) return "외국어강사";
  if (/체육강사/.test(normalized)) return "체육강사";
  return `${profile.grade} 대상 강사`;
}

function inferLectureHours(normalized) {
  const numericMatch = normalized.match(/(\d+(?:\.\d+)?)\s*시간/);
  if (numericMatch) return Number(numericMatch[1]);

  const koreanNumbers = {
    한: 1,
    두: 2,
    세: 3,
    네: 4,
    다섯: 5,
    여섯: 6
  };
  for (const [word, value] of Object.entries(koreanNumbers)) {
    if (new RegExp(`${word}\\s*시간`).test(normalized)) return value;
  }
  return null;
}

function calculateInstructorFee(profile, hours) {
  return profile.base + Math.max(0, hours - 1) * profile.extra;
}

function formatWon(amount) {
  return `${Number(amount || 0).toLocaleString("ko-KR")}원`;
}

function formatHours(hours) {
  return `${Number(hours).toLocaleString("ko-KR")}시간`;
}

function findPreset(question, selectedType) {
  if (selectedType && selectedType !== "auto") {
    return topicPresets.find((preset) => preset.type === selectedType) || fallbackPreset;
  }

  const normalized = question.replace(/\s+/g, "");
  const scored = topicPresets
    .map((preset) => ({ preset, score: getPresetScore(preset, normalized) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.preset || fallbackPreset;
}

function getPresetScore(preset, normalized) {
  let score = 0;

  preset.keys.forEach((key) => {
    if (normalized.includes(key.replace(/\s+/g, ""))) {
      score += Math.max(2, key.length);
    }
  });

  if (preset.type === "employment") {
    if (/취업|채용|공채|근로계약|구두채용|월급|임금|수습기간|권고사직|해고|직무기술서|지원서|접수기한/.test(normalized)) score += 38;
    if (/학교계약직|계약직직원|행정실|교직원|교육공무직|재계약불이익/.test(normalized)) score -= 25;
    if (/현장실습|실습생|학교폭력|학폭/.test(normalized)) score -= 20;
  }

  if (preset.type === "apprenticeship") {
    if (/도제학교|도제|산학일체형|일학습병행|기업훈련|훈련수당|훈련계약/.test(normalized)) score += 45;
  }

  if (preset.type === "overseasTraining") {
    if (/해외|호주|글로벌|국외/.test(normalized)) score += 30;
    if (/해외현장실습|해외실습|글로벌현장학습/.test(normalized)) score += 40;
  }

  if (preset.type === "fieldTraining") {
    if (/현장실습|실습생|실습기업|실습기관/.test(normalized)) score += 18;
    if (/생산량|목표압박|평가불이익|불이익|야간|잔업|업무범위|잡무|청소/.test(normalized) && /현장실습|실습생|특성화고|직업계고/.test(normalized)) score += 22;
    if (/해외|호주|글로벌/.test(normalized)) score -= 25;
  }

  if (preset.type === "staffLabor") {
    if (/기간제|행정실|행정직|교직원|교육공무직|상근|복무|업무분장|계약갱신|재계약|근로자|직장내괴롭힘|직장.*괴롭힘|상급자|야근|모욕|성희롱|계약직직원|학교계약직/.test(normalized)) score += 35;
    if (/교원휴가|휴가|연가|병가|공가|특별휴가|출장|출장비|여비|근태|근무상황|나이스|NEIS|조퇴|외출|지각/.test(normalized) && /교원|교사|행정직|교육공무직|기간제|공무원|학교|교직원/.test(normalized)) score += 42;
    if (/(교육공무직|조리실무사|행정실|계약직직원|학교계약직).*(괴롭힘|모욕|심부름|상급자|성희롱|재계약불이익|해고)|((괴롭힘|모욕|심부름|상급자|성희롱|재계약불이익|해고).*(교육공무직|조리실무사|행정실|계약직직원|학교계약직))/.test(normalized)) score += 45;
    if (/교권침해|교육활동침해|교사보호|학부모폭언|폭언전화/.test(normalized)) score += 65;
    if (/담임교사.*학부모|학부모.*담임교사|전화응대|불친절/.test(normalized) && !/기간제|근로자|복무|업무분장|계약|징계(?!요구는?없|요구없|없)/.test(normalized)) score -= 20;
    if (/전화응대|불친절/.test(normalized) && /징계요구는?없|징계요구없|금전피해/.test(normalized)) score -= 45;
    if (/현장실습|실습생/.test(normalized) && !/기간제|행정실|행정직|교직원|상급자|직장내괴롭힘|복무|업무분장|계약갱신|재계약/.test(normalized)) score -= 35;
    if (/학생상담|상담내용|기숙사|부정행위|인정결석|휴대전화|휴대폰|생활기록부|급식반찬|학생인권|생활지도/.test(normalized) && !/교권침해|교육활동침해|교사보호/.test(normalized)) score -= 35;
    if (/중대재해|사망|추락|끼임|깔림/.test(normalized)) score -= 25;
  }

  if (preset.type === "schoolViolence") {
    if (/학교폭력|학폭|피해학생|가해학생|학생사이|단체채팅|단체채팅방|욕설|따돌림|심의|보복성메시지|사이버|인스타그램/.test(normalized)) score += 35;
    if (/학교폭력|폭행|상해|협박/.test(normalized) && /학생|친구|피해|가해|학부모/.test(normalized)) score += 45;
    if (/직장|상급자|근로자|기간제|행정실|행정직|교직원|복무|업무분장|계약갱신|재계약/.test(normalized)) score -= 35;
  }

  if (preset.type === "schoolAdministration") {
    if (/교육행정|학교회계|예산|품의|검수|지출|증빙|영수증|세금계산서|카드사용|정산|수의계약|계약서|공문|결재|회의록|정보공개|보존기간/.test(normalized)) score += 42;
    if (/생활기록부|학교생활기록|생기부|학생부|출결|인정결석|정정|기재요령|창의적체험활동|세부능력|특기사항|누가기록/.test(normalized)) score += 48;
    if (/예산.*(편성|집행|증빙|검수|지출)|지출.*(증빙|품의|검수|영수증)|학생부.*(정정|기재|증빙|보관)|출결.*(증빙|인정결석)/.test(normalized)) score += 35;
    if (/현장실습|실습생|도제학교|산재|중대재해/.test(normalized)) score -= 25;
    if (/학교폭력|학폭|피해학생|가해학생|심의/.test(normalized)) score -= 18;
    if (/해고|임금|근로계약|재계약불이익|직장내괴롭힘|성희롱/.test(normalized)) score -= 18;
  }

  if (preset.type === "civilComplaint") {
    if (/민원|학부모|담임|전화응대|불친절|사과|재발방지|생활지도|학생관리|학생상담|상담내용|민감정보|기숙사|차별|부정행위|이의제기|휴대전화|휴대폰|인권침해|학생인권|급식반찬|아동학대|자리이동|고충/.test(normalized)) score += 28;
    if (/학생|학부모|담임|생활지도|기숙사|부정행위|급식|상담내용|휴대전화|휴대폰/.test(normalized)) score += 20;
    if (/생활기록부|학교생활기록|생기부|학생부|출결|인정결석|정정|기재요령|예산|품의|검수|지출|증빙|학교회계/.test(normalized)) score -= 22;
    if (/기간제|근로자|계약갱신|재계약|임금|해고|징계|노무/.test(normalized)) score -= 20;
    if (/징계전|징계절차|부정행위|이의제기/.test(normalized)) score += 25;
    if (/교권침해|교육활동침해|교사보호|학부모폭언|폭언전화/.test(normalized)) score -= 45;
    if (/체육시간|타박상|학교안전공제|과학실|화학물질|급식실|조리실무사/.test(normalized)) score -= 30;
  }

  if (preset.type === "schoolSafety") {
    if (/중대재해|산업안전|안전보건|위험성평가|안전관리체계|사망|추락|끼임|중상|급식실|조리실무사|화상|과학실|화학물질|두통|체육시간|타박상|학교안전공제|시설공사|외부업체|아차사고/.test(normalized)) score += 30;
    if (/중대재해.*사망|사망.*중대재해|추락해사망|끼임사망|깔림사망/.test(normalized)) score += 45;
    if (/체육시간|타박상|학교안전공제|과학실|화학물질|급식실|조리실무사/.test(normalized)) score += 35;
    if (/괴롭힘|모욕|심부름|성희롱/.test(normalized) && !/화상|사고|부상|산재|산업안전|안전보건/.test(normalized)) score -= 50;
    if (/급식반찬|식단불만|맛이없|반찬이/.test(normalized) && !/식중독|화상|급식실|조리실무사/.test(normalized)) score -= 40;
  }

  return score;
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function uniqueStrings(items = []) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function hasOccurrenceNegation(normalized) {
  return /사고가?발생한것은아닙니다|사고가?발생한것은아니|사고는?발생하지않|사고없|사고처리절차가?아니|부상[·ㆍ,]?사고가?아니|부상은?아니|발생전|대비|예방|점검표|점검하고싶|만들고싶|다친사람은?없|다친것은?아니|부상자?없|부상은?없|사망자?없|사망은?없|병원이송은?없|치료는?없/.test(normalized);
}

function hasActualInjurySignal(value) {
  const normalized = compactText(value);
  if (hasOccurrenceNegation(normalized)) {
    return false;
  }

  return /골절|다침|다쳤|다쳐|상해|중상|화상|절단|출혈|입원|수술|119|응급|병원치료|치료를받|치료중|화상을입|타박상|부상(?!담)/.test(normalized);
}

function hasActualAccidentSignal(value) {
  const normalized = compactText(value);
  if (hasOccurrenceNegation(normalized) || /아차사고|사고날뻔|추락할뻔/.test(normalized)) {
    return false;
  }

  return /사고(가|는|를)?(발생|났|남|당했|당함|입었|겪었)|산재|산업재해/.test(normalized);
}

function hasMachineAccidentSignal(value) {
  const normalized = compactText(value);
  if (hasOccurrenceNegation(normalized) || /추락할뻔|끼일뻔|깔릴뻔/.test(normalized)) {
    return false;
  }

  return /끼임|절단|충돌|부딪|깔림|추락/.test(normalized);
}

function getFieldTrainingScopeProfile(value = "") {
  const normalized = compactText(value);
  const hasCleaningWork = /청소/.test(normalized);
  const hasTidyingWork = /정리정돈|작업장정리|주변정리/.test(normalized);
  const hasMaterialWork = /재료|자재|부품|물품/.test(normalized);
  const hasCleaning = hasCleaningWork || hasTidyingWork || hasMaterialWork;
  const hasErrand = /심부름|사적|개인적인|개인부탁|커피|담배|식사|배달|운전/.test(normalized);
  const hasQuota = /생산량|목표|압박|실적|평가불이익|불이익/.test(normalized);
  const hasAfterHours = /실습시간종료후|현장실습시간종료후|근무시간종료후|업무시간종료후|시간종료후|종료후|마친후|끝난후|퇴근후|일과후/.test(normalized);
  const hasOvertime = hasAfterHours || /야간|밤\d*시|잔업|초과|장시간|휴일|주말/.test(normalized);
  const hasSafetyConcern = /위험|가동중인기계|기계|설비|화학|분진|보호구|유해|끼일|다칠|안전/.test(normalized);
  const hasRepeat = /반복|자꾸|계속|매일|수시로|여러번|지속/.test(normalized);

  if (hasSafetyConcern && !hasCleaning) {
    return {
      kind: "unsafe",
      issueName: "위험하거나 부적절한 업무 외 지시",
      instructionName: "위험요소가 있는 업무 외 지시",
      reportLead: "현장실습생에게 실습계약 범위를 벗어나거나 안전 확인이 필요한 업무를 지시한 사안",
      problemType: "위험요소가 있는 업무 외 지시와 실습 업무 범위 적정성 문제",
      leadDetail: "현장실습생에게 위험요소가 있거나 실습계약에 없는 업무를 시킨 사안은 사고가 발생하기 전이라도 업무 범위, 안전교육, 보호구, 감독 여부를 먼저 확인해야 합니다.",
      firstAction: "언제, 누가, 어떤 업무를 지시했고 그 업무에 어떤 위험요소가 있었는지 기록합니다.",
      secondAction: "현장실습 협약서와 실습계획서에 해당 업무가 포함되는지, 안전교육과 보호구·감독이 있었는지 확인합니다.",
      keyQuestion: "해당 업무가 실습계약과 안전교육 범위 안에 있었는지",
      scopeCheck: "해당 업무가 현장실습 협약서나 실습계획서의 업무에 포함되어 있나요?",
      scopePlaceholder: "예: 협약서에는 생산 보조만 있음, 위험 작업은 언급 없음, 아직 못 봄",
      tags: ["업무범위", "위험 지시", "안전교육", "학생 권익"]
    };
  }

  if (hasAfterHours && (hasCleaningWork || hasTidyingWork)) {
    return {
      kind: "afterHoursCleaning",
      issueName: "실습시간 종료 후 청소 지시 문제",
      instructionName: "실습시간 종료 후 청소 지시",
      reportLead: "현장실습생에게 실습시간 종료 후 청소를 반복 지시한 사안",
      problemType: "실습시간 종료 후 청소 지시와 현장실습 시간·업무범위 적정성 문제",
      leadDetail: "현장실습 시간이 끝난 뒤 학생에게 청소를 반복 지시한 경우에는 실습시간 제한, 연장 지시 여부, 교육 목적, 학생 동의와 보호자·학교 안내 여부를 먼저 확인해야 합니다.",
      firstAction: "청소를 시킨 날짜, 종료 예정 시각, 실제 퇴근 시각, 지시자, 반복 횟수를 시간순으로 기록합니다.",
      secondAction: "현장실습 협약서와 실습계획서의 실습시간, 청소 포함 여부, 연장·잔업 지시 근거를 확인합니다.",
      keyQuestion: "청소 지시가 실습시간 안의 교육활동인지, 실습시간 종료 후 추가 지시였는지",
      scopeCheck: "청소가 현장실습 협약서나 실습계획서의 업무에 포함되어 있고, 실습시간 안에 이루어진 일인가요?",
      scopePlaceholder: "예: 실습은 17시에 종료, 이후 20분 청소 지시, 협약서에는 청소 언급 없음",
      tags: ["실습시간", "청소 지시", "업무범위", "학생 권익"]
    };
  }

  if (hasOvertime) {
    return {
      kind: "time",
      issueName: "현장실습 시간·업무범위 문제",
      instructionName: "야간·잔업 또는 장시간 실습 지시",
      reportLead: "현장실습생에게 야간·잔업 또는 장시간 실습을 지시한 사안",
      problemType: "실습시간·업무범위와 학생 권익보호 문제",
      leadDetail: "현장실습생에게 야간·잔업 또는 장시간 실습을 지시한 경우에는 실습시간 제한, 보호자 안내, 학교 승인 여부, 실습계약 범위를 먼저 확인해야 합니다.",
      firstAction: "언제부터 몇 시까지 실습했는지, 누가 잔업이나 야간 실습을 지시했는지 기록합니다.",
      secondAction: "현장실습 협약서, 실습계획서, 출퇴근 기록에서 실습시간과 연장·야간 지시 근거를 확인합니다.",
      keyQuestion: "실습시간과 지시가 현장실습 기준 안에 있었는지",
      scopeCheck: "야간·잔업 또는 장시간 실습이 현장실습 협약서나 실습계획서에 근거가 있나요?",
      scopePlaceholder: "예: 협약서에는 09:00~17:00만 있음, 밤 9시까지 지시, 학교 승인 모름",
      tags: ["실습시간", "업무범위", "학생 보호", "현장실습"]
    };
  }

  if (hasQuota) {
    return {
      kind: "quota",
      issueName: "생산량 압박·평가 불이익 문제",
      instructionName: "생산량 목표나 평가 불이익을 동반한 지시",
      reportLead: "현장실습생에게 정규 직원처럼 생산량 목표를 압박하거나 평가 불이익을 언급한 사안",
      problemType: "교육 목적과 생산 압박·평가 불이익의 경계 문제",
      leadDetail: "현장실습생에게 정규 직원 수준의 생산량 목표를 요구하거나 평가 불이익을 암시한 경우에는 교육 목적, 업무 범위, 평가 기준, 학생 보호 조치를 나누어 확인해야 합니다.",
      firstAction: "생산량 목표, 평가 불이익 발언, 지시자, 반복 시점과 학생이 느낀 부담을 사실 중심으로 기록합니다.",
      secondAction: "실습계획서와 평가 기준에 생산량 목표가 포함되는지, 교육 목적을 넘는 압박인지 확인합니다.",
      keyQuestion: "생산량 요구와 평가 기준이 교육 목적 안에 있었는지",
      scopeCheck: "생산량 목표나 평가 기준이 현장실습 협약서·실습계획서·평가기준에 적혀 있나요?",
      scopePlaceholder: "예: 실습계획에는 교육 과제만 있음, 생산량 목표는 구두 지시, 평가 불이익 언급",
      tags: ["생산량 압박", "평가 불이익", "학생 권익", "업무범위"]
    };
  }

  if (hasErrand) {
    return {
      kind: "errand",
      issueName: "사적 심부름·업무 외 지시 문제",
      instructionName: "사적 심부름 또는 업무 외 지시",
      reportLead: "현장실습생에게 교육 목적과 무관한 사적 심부름이나 업무 외 일을 지시한 사안",
      problemType: "사적 심부름·업무 외 지시와 실습 업무 범위 적정성 문제",
      leadDetail: "현장실습생에게 사적 심부름이나 교육 목적과 무관한 업무를 시킨 사안은 실습계약상 업무 범위, 지시 권한, 학생 권익보호를 먼저 확인해야 합니다.",
      firstAction: "언제, 누가, 어떤 사적 심부름이나 업무 외 일을 지시했는지 구체적으로 기록합니다.",
      secondAction: "해당 지시가 실습계획서의 직무와 관련 있는지, 지시자가 공식 담당자인지 확인합니다.",
      keyQuestion: "사적 심부름이나 업무 외 지시가 실습 목적과 관련 있었는지",
      scopeCheck: "사적 심부름 또는 업무 외 일이 현장실습 협약서나 실습계획서의 업무에 포함되어 있나요?",
      scopePlaceholder: "예: 협약서에는 전공 실습만 있음, 개인 심부름은 없음, 담당자 지시 여부 모름",
      tags: ["사적 심부름", "업무범위", "학생 권익", "지시 권한"]
    };
  }

  if (hasCleaning) {
    const cleaningInstruction = hasMaterialWork && hasCleaningWork
      ? "청소 및 재료·자재 운반 지시"
      : hasMaterialWork
        ? "재료·자재 운반 지시"
        : hasTidyingWork && !hasCleaningWork
          ? "정리정돈 지시"
          : "청소 지시";
    const cleaningIssue = hasMaterialWork && hasCleaningWork
      ? "청소·재료 운반 반복 지시 문제"
      : hasMaterialWork
        ? "재료·자재 운반 지시 문제"
        : hasTidyingWork && !hasCleaningWork
          ? "정리정돈 지시 문제"
          : "청소 반복 지시 문제";
    const cleaningLead = hasMaterialWork && hasCleaningWork
      ? "현장실습생에게 청소와 재료·자재 운반을 반복 지시한 사안"
      : hasMaterialWork
        ? "현장실습생에게 재료·자재 운반을 반복 지시한 사안"
        : hasTidyingWork && !hasCleaningWork
          ? "현장실습생에게 정리정돈을 반복 지시한 사안"
          : "현장실습생에게 청소를 반복 지시한 사안";
    const cleaningScope = hasMaterialWork && hasCleaningWork
      ? "청소와 재료·자재 운반이 현장실습 협약서나 실습계획서의 업무에 포함되어 있나요?"
      : `${cleaningInstruction}가 현장실습 협약서나 실습계획서의 업무에 포함되어 있나요?`;
    const cleaningPlaceholder = hasMaterialWork && hasCleaningWork
      ? "예: 협약서에는 생산 보조만 있음, 청소와 자재 운반 언급 없음, 아직 못 봄"
      : `예: 협약서에는 전공 실습만 있음, ${cleaningInstruction} 언급 없음, 아직 못 봄`;

    return {
      kind: "cleaning",
      issueName: cleaningIssue,
      instructionName: cleaningInstruction,
      reportLead: cleaningLead,
      problemType: `${cleaningInstruction}와 실습 업무 범위 적정성 문제`,
      leadDetail: `현장실습생에게 ${cleaningInstruction}를 반복한 경우에는 교육 목적이 있는 실습활동인지, 실습 범위 밖 잡무 전가인지 구분해야 합니다.`,
      firstAction: `언제, 누가, 어떤 방식으로 ${cleaningInstruction}를 지시했고 얼마나 반복됐는지 기록합니다.`,
      secondAction: `현장실습 협약서와 실습계획서에 ${cleaningInstruction}가 실습 내용으로 들어 있는지 확인합니다.`,
      keyQuestion: `${cleaningInstruction}가 실습 직무와 직접 관련 있었는지`,
      scopeCheck: cleaningScope,
      scopePlaceholder: cleaningPlaceholder,
      tags: ["업무범위", "반복 지시", cleaningInstruction, "학생 권익"]
    };
  }

  return {
    kind: "generic",
    issueName: hasRepeat ? "업무 외 반복 지시 문제" : "업무 외 지시 문제",
    instructionName: hasRepeat ? "업무 외 반복 지시" : "업무 외 지시",
    reportLead: "현장실습생에게 실습계약 또는 실습계획 범위를 벗어난 업무 외 일을 지시한 사안",
    problemType: "업무 외 지시와 실습 업무 범위 적정성 문제",
    leadDetail: "현장실습생에게 업무 외 일을 시킨다는 문제는 구체적 업무 내용을 단정하지 말고, 실습계약상 업무 범위, 교육 목적, 지시 권한, 학생 권익보호를 먼저 확인해야 합니다.",
    firstAction: "언제, 누가, 어떤 업무 외 일을 지시했는지 사실 중심으로 기록합니다.",
    secondAction: "현장실습 협약서와 실습계획서에 해당 업무가 포함되는지 확인합니다.",
    keyQuestion: "해당 업무가 실습계약과 교육 목적 안에 있었는지",
    scopeCheck: "업무 외로 보이는 일이 현장실습 협약서나 실습계획서의 업무에 포함되어 있나요?",
    scopePlaceholder: "예: 협약서에는 전공 실습만 있음, 해당 업무는 없음, 아직 못 봄",
    tags: ["업무범위", "업무 외 지시", "학생 권익", "지시 권한"]
  };
}

function getFieldTrainingInstructorLabel(value = "") {
  const normalized = compactText(value);
  if (/기존근로자/.test(normalized)) return "기존 근로자";
  if (/기업담당멘토|담당멘토|현장멘토|멘토/.test(normalized)) return "기업 담당 멘토";
  if (/사수|선배|직원|근로자|동료/.test(normalized)) return "기업 내부 직원";
  return "기업 내부 지시자";
}

async function renderResult(question, preset, scopes, answerMode, userRole, partyRole = "auto", topicContext = null) {
  abortActiveRequests();
  workspace?.classList.add("has-result");
  if (workspace && resultPanel && queryPanel && workspace.firstElementChild !== resultPanel) {
    workspace.insertBefore(resultPanel, queryPanel);
  }

  renderFreeBasicPolicyResult({
    question,
    preset,
    scopes,
    answerMode,
    userRole,
    partyRole,
    topicContext
  });
  return;

  const encodedQuestion = encodeURIComponent(question);
  const modeMessage = getModeMessage(answerMode);
  const roleGuide = getRoleGuide(userRole);
  const partyGuide = getPartyGuide(partyRole);
  const selectedTopicContext = topicContext || getSelectedTopicContext();
  const questionFingerprint = buildQuestionFingerprint({
    question,
    presetType: preset.type,
    scopes,
    answerMode,
    userRole,
    partyRole,
    topicContext: selectedTopicContext
  });
  const scenario = analyzeQuestionScenario(question, preset);
  const displayPreset = getScenarioDisplayPreset(preset, scenario);
  const sourceLinks = getSourceLinks(encodedQuestion, displayPreset, scopes);
  const keywords = buildKeywords(question, displayPreset, selectedTopicContext);
  const sourcePlan = getSourcePlan(displayPreset, scopes);
  const factPrompts = getFactPrompts(displayPreset, userRole);
  const riskSignals = detectRiskSignals(question);
  const officialMaterials = getOfficialMaterials(displayPreset, scenario, question);
  const directAnswer = getDirectAnswer(question, displayPreset, roleGuide, scenario);
  const refinementQuestions = getRefinementQuestions(question, preset, userRole, riskSignals);
  const caseReport = buildCaseReport(question, displayPreset, roleGuide, officialMaterials, riskSignals, scenario);
  caseReport.party = partyGuide.label;
  caseReport.topicPath = selectedTopicContext.label;
  const caseId = createCaseSessionId();
  caseReport.caseId = caseId;
  currentCaseId = caseId;
  currentQuestionFingerprint = questionFingerprint;
  currentLiveSourceData = null;
  currentReportDraft = caseReport;
  const policyGuideResponse = buildPolicyGuideResponse({
    question,
    officeCode: "auto",
    roleCode: "auto",
    categoryCode: "auto"
  });
  const detailRequest = getPolicyGuideDetailRequest(question);

  statusDot.textContent = "API 확인중";
  resultState.className = "summary-box";
  resultState.innerHTML = `
    <section class="answer-first" id="aiAnalysisMount" aria-label="AI 사안 분석">
      <div class="answer-label">AI 사안 분석 중</div>
      <h3>질문 요지를 여러 방식으로 다시 확인하고 있습니다.</h3>
      <p>곧 핵심 요약만 반영합니다. 자세한 규정이나 서식은 아래 추가 버튼으로 요청할 수 있습니다.</p>
    </section>

    ${renderPolicyGuideResponse(policyGuideResponse)}

    ${detailRequest.sources ? `
      <section class="result-block api-live" id="liveSourceMount" aria-live="polite">
        <h3>공식 원문 API 확인</h3>
        <p class="api-source-empty">관련 규정 요청이 있어 공식자료 후보를 확인하고 있습니다.</p>
      </section>
    ` : ""}

    <details class="question-detail">
      <summary>입력한 질문 보기</summary>
      <div class="query-readout">${escapeHtml(question)}</div>
    </details>
  `;

  loadAiAnalysis(question, displayPreset, keywords, userRole, answerMode, caseId, partyRole, selectedTopicContext, questionFingerprint);
  if (detailRequest.sources) {
    loadLiveSources(question, displayPreset, keywords, caseId, questionFingerprint, selectedTopicContext);
  }
}

function getPolicyEngineContext(topicContext = null, userRole = "auto", partyRole = "auto") {
  const selectedTopic = topicContext || getSelectedTopicContext();
  const categoryFromTopic = mapTopicContextToPolicyCategory(selectedTopic);
  const roleFromContext = mapPartyToPolicyRole(partyRole) || mapUserToPolicyRole(userRole);
  return {
    officeCode: policyOfficeInput?.value || "gyeongbuk",
    roleCode: policyRoleInput?.value && policyRoleInput.value !== "auto"
      ? policyRoleInput.value
      : roleFromContext || "auto",
    categoryCode: policyCategoryInput?.value && policyCategoryInput.value !== "auto"
      ? policyCategoryInput.value
      : categoryFromTopic || "auto"
  };
}

function mapPartyToPolicyRole(partyRole = "auto") {
  return {
    student: "student",
    teacher: "teacher",
    parent: "parent",
    principal: "manager",
    staff: "localOfficer"
  }[partyRole] || "";
}

function mapUserToPolicyRole(userRole = "auto") {
  return {
    student: "student",
    teacher: "teacher",
    parent: "parent",
    principal: "manager",
    staff: "localOfficer"
  }[userRole] || "";
}

function mapTopicContextToPolicyCategory(topicContext = null) {
  const major = topicContext?.major || "";
  const middle = topicContext?.middle || "";
  const minor = topicContext?.minor || "";
  if (major === "studentPathway") {
    if (middle === "fieldExperience") return "fieldExperienceLearning";
    if (middle === "admissions") return "admissionsPathways";
    if (middle === "records") return "studentRecords";
    if (middle === "attendance") return "studentAttendance";
    return "studentRecords";
  }
  if (major === "studentSupport") {
    if (middle === "guidance") return "studentLifeGuidance";
    if (middle === "welfare") return "studentWelfare";
    if (middle === "health") return "studentHealthCounseling";
    return "studentWelfare";
  }
  if (major === "vocationalLearning") {
    if (middle === "practiceRoom" && minor === "safety") return "studentSafety";
    if (middle === "practiceRoom" && minor === "budget") return "budgetExecution";
    return "vocationalCurriculum";
  }
  if (major === "fieldTraining") return "vocationalFieldTraining";
  if (major === "schoolViolence") return "schoolViolenceGuide";
  if (major === "schoolAdministration") {
    if (minor === "attendanceRecord") return "studentAttendance";
    if (middle === "studentRecords" || minor === "schoolRecord" || minor === "correction") return "studentRecords";
    if (minor === "committee") return "governanceRecords";
    if (minor === "infoDisclosure") return "documentDisclosure";
    return "budgetExecution";
  }
  if (major === "staffLabor") return "leaveAttendance";
  if (major === "schoolSafety") return "studentSafety";
  if (major === "civilComplaint") return "studentLifeGuidance";
  if (major === "employment") return "careerEmployment";
  return "";
}

async function loadAiAnalysis(question, preset, keywords, userRole, answerMode, caseId, partyRole = "auto", topicContext = null, questionFingerprint = "") {
  const mount = document.querySelector("#aiAnalysisMount");
  if (!mount) {
    return;
  }

  if (!isCurrentRequest(caseId, questionFingerprint)) {
    return;
  }

  if (window.location.protocol === "file:") {
    mount.innerHTML = `
      <div class="answer-label">AI 사안 분석 대기</div>
      <h3>로컬 서버 또는 배포 환경에서 AI 분석을 사용할 수 있습니다.</h3>
      <p><code>npm run dev</code>로 실행하면 서버가 OpenAI API 키를 안전하게 사용해 분석합니다.</p>
    `;
    return;
  }

  const guard = getAiCostGuardStatus();
  if (guard.blocked) {
    mount.innerHTML = renderAiCostGuardBlocked(guard);
    statusDot.textContent = "비용 제한";
    return;
  }

  const controller = new AbortController();
  activeAiController = controller;

  try {
    const access = await getLawInfoAccess();
    if (!access.ok) {
      if (!isCurrentRequest(caseId, questionFingerprint)) {
        return;
      }
      mount.innerHTML = renderAiAccessBlocked(access.message);
      statusDot.textContent = "권한 필요";
      return;
    }

    const headers = {
      accept: "application/json",
      "content-type": "application/json",
      ...(access.token ? { authorization: `Bearer ${access.token}` } : {})
    };

    const response = await fetch(getAiAnalyzeUrl(), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        caseId,
        question,
        topic: preset.type,
        laws: preset.laws,
        keywords,
        role: userRole,
        partyRole,
        topicContext,
        mode: answerMode
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!isCurrentRequest(caseId, questionFingerprint) || (data.caseId && data.caseId !== caseId)) {
      return;
    }
    recordAiUsage(data);
    mount.innerHTML = renderAiAnalysis(data);
    applyAiAnalysisToReport(data, question, preset, userRole, answerMode, caseId, partyRole, topicContext);
  } catch (error) {
    if (error.name === "AbortError" || !isCurrentRequest(caseId, questionFingerprint)) {
      return;
    }
    mount.innerHTML = `
      <div class="answer-label">AI 분석 실패</div>
      <h3>지능형 분석을 불러오지 못했습니다.</h3>
      <p>현재 화면은 기본 안전장치 분석으로 표시됩니다. API 키와 Functions 배포 상태를 확인해 주세요.</p>
      <p class="api-error-text">${escapeHtml(error.message)}</p>
    `;
  } finally {
    if (activeAiController === controller) {
      activeAiController = null;
    }
  }
}

async function getLawInfoAccess() {
  if (!window.GYO6_AUTH?.getAccessTokenFor) {
    if (window.GYO6_AUTH_REQUIRED === true) {
      return {
        ok: false,
        token: "",
        message: "로그인 기능을 확인한 뒤 이용할 수 있습니다. 잠시 후 다시 시도하거나 로그인 상태를 확인해 주세요."
      };
    }

    return { ok: true, token: "" };
  }

  return window.GYO6_AUTH.getAccessTokenFor("law");
}

function renderLawInfoAccessBlockedResult(message = "") {
  abortActiveRequests();
  currentCaseId = "";
  currentQuestionFingerprint = "";
  currentGuideQuestionFingerprint = "";
  currentLiveSourceData = null;
  currentReportDraft = null;

  workspace?.classList.add("has-result");
  if (workspace && resultPanel && queryPanel && workspace.firstElementChild !== resultPanel) {
    workspace.insertBefore(resultPanel, queryPanel);
  }

  resultTitle.textContent = "답변 먼저";
  statusDot.textContent = "권한 필요";
  resultState.className = "summary-box access-blocked-only";
  resultState.innerHTML = `
    <section class="answer-first" aria-label="법률정보 이용 권한 필요">
      ${renderAiAccessBlocked(message)}
    </section>
  `;
}

function renderFreeBasicPolicyResult({
  question = "",
  preset = fallbackPreset,
  scopes = [],
  answerMode = "plain",
  userRole = "auto",
  partyRole = "auto",
  topicContext = null,
  accessMessage = ""
} = {}) {
  abortActiveRequests();
  currentCaseId = "";
  currentQuestionFingerprint = "";
  currentLiveSourceData = null;
  currentReportDraft = null;

  const policyContext = getPolicyEngineContext(topicContext, userRole, partyRole);
  const questionFingerprint = buildQuestionFingerprint({
    question,
    presetType: preset.type,
    scopes,
    answerMode,
    userRole,
    partyRole,
    topicContext
  });
  currentQuestionFingerprint = questionFingerprint;
  const response = buildPolicyGuideResponse({
    question,
    officeCode: policyContext.officeCode,
    roleCode: policyContext.roleCode,
    categoryCode: policyContext.categoryCode
  });
  workspace?.classList.add("has-result");
  if (workspace && resultPanel && queryPanel && workspace.firstElementChild !== resultPanel) {
    workspace.insertBefore(resultPanel, queryPanel);
  }

  resultTitle.textContent = "기본 답변";
  statusDot.textContent = "기본 답변";
  resultState.className = "summary-box guideline-result free-policy-result";
  resultState.innerHTML = `
    ${renderPolicyGuideResponse(response)}
    ${accessMessage ? `
      <section class="free-access-note" aria-label="비로그인 기본 답변 안내">
        <strong>로그인 없이 기본 답변을 제공했습니다.</strong>
        <p class="answer-warning">${escapeHtml(accessMessage)}</p>
      </section>
    ` : ""}
  `;

  loadLocalLlmPolicyEnhancement({
    question,
    preset,
    scopes,
    answerMode,
    userRole,
    partyRole,
    topicContext,
    policyContext,
    baseResponse: response,
    questionFingerprint,
    accessMessage
  });
}

async function loadLocalLlmPolicyEnhancement({
  question = "",
  preset = fallbackPreset,
  scopes = [],
  answerMode = "plain",
  userRole = "auto",
  partyRole = "auto",
  topicContext = null,
  policyContext = null,
  baseResponse = null,
  questionFingerprint = "",
  accessMessage = ""
} = {}) {
  if (!question || window.location.protocol === "file:" || !isLocalLlmEnhancementHost()) return;

  const controller = new AbortController();
  activeLocalLlmController = controller;
  const office = getEducationOffice(policyContext?.officeCode || "gyeongbuk");
  const role = getPolicyRole(policyContext?.roleCode || "auto");
  const category = getPolicyGuideCategory(policyContext?.categoryCode || "auto");

  try {
    const response = await fetch("/api/policy", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        question,
        originalQuestion: question,
        officeLabel: office.code === "auto" ? "" : office.label,
        roleLabel: role.code === "auto" ? "" : role.label,
        categoryLabel: category.label,
        topic: preset.type,
        scopes,
        answerMode,
        userRole,
        partyRole,
        topicContext
      })
    });

    if (!response.ok) return;
    const data = await response.json();
    if (
      activeLocalLlmController !== controller ||
      questionFingerprint !== currentQuestionFingerprint ||
      (!data?.localLlmComposer?.ok && !data?.localLlmNormalizer?.used) ||
      !data.policyResponse
    ) {
      return;
    }

    const enhancedResponse = buildPolicyGuideResponseFromPolicyChatResult(data, {
      baseResponse,
      policyContext,
      question,
      office,
      role,
      category
    });
    resultTitle.textContent = data.localLlmComposer?.ok ? "로컬 AI 보강 답변" : "로컬 AI 질문 정리 답변";
    statusDot.textContent = data.localLlmComposer?.ok ? "로컬 AI 보강" : "질문 정리";
    resultState.className = "summary-box guideline-result free-policy-result local-llm-result";
    resultState.innerHTML = `
      ${renderPolicyGuideResponse(enhancedResponse)}
      ${renderLocalLlmComposerNote(data.localLlmComposer, data.localLlmNormalizer)}
      ${accessMessage ? `
        <section class="free-access-note" aria-label="비로그인 기본 답변 안내">
          <strong>로그인 없이 기본 답변을 제공했습니다.</strong>
          <p class="answer-warning">${escapeHtml(accessMessage)}</p>
        </section>
      ` : ""}
    `;
  } catch (error) {
    if (error.name !== "AbortError") {
      console.warn("Local LLM policy enhancement skipped:", error);
    }
  } finally {
    if (activeLocalLlmController === controller) {
      activeLocalLlmController = null;
    }
  }
}

async function loadGuideLocalLlmPolicyEnhancement({
  question = "",
  officeCode = "gyeongbuk",
  roleCode = "auto",
  categoryCode = "auto",
  baseResponse = null,
  guideFingerprint = ""
} = {}) {
  if (!question || window.location.protocol === "file:" || !isLocalLlmEnhancementHost()) return;

  activeGuideLocalLlmController?.abort();
  const controller = new AbortController();
  activeGuideLocalLlmController = controller;
  const office = getEducationOffice(officeCode);
  const role = getPolicyRole(roleCode);
  const category = getPolicyGuideCategory(categoryCode);

  try {
    const response = await fetch("/api/policy", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        question,
        originalQuestion: question,
        officeLabel: office.code === "auto" ? "" : office.label,
        roleLabel: role.code === "auto" ? "" : role.label,
        categoryLabel: category.label,
        topic: categoryCode,
        answerMode: "guide",
        userRole: role.code,
        partyRole: role.code
      })
    });

    if (!response.ok) return;
    const data = await response.json();
    if (
      activeGuideLocalLlmController !== controller ||
      guideFingerprint !== currentGuideQuestionFingerprint ||
      (!data?.localLlmComposer?.ok && !data?.localLlmNormalizer?.used) ||
      !data.policyResponse
    ) {
      return;
    }

    const enhancedResponse = buildPolicyGuideResponseFromPolicyChatResult(data, {
      baseResponse,
      policyContext: { officeCode, roleCode, categoryCode },
      question,
      office,
      role,
      category
    });
    if (guideStatus) guideStatus.textContent = data.localLlmComposer?.ok ? "로컬 AI 보강" : "질문 정리";
    if (guideResultTitle) guideResultTitle.textContent = data.localLlmComposer?.ok ? "로컬 AI 보강 답변" : "로컬 AI 질문 정리 답변";
    guideResult.className = "summary-box guideline-result local-llm-result";
    guideResult.innerHTML = `
      ${renderPolicyGuideResponse(enhancedResponse)}
      ${renderLocalLlmComposerNote(data.localLlmComposer, data.localLlmNormalizer)}
    `;
  } catch (error) {
    if (error.name !== "AbortError") {
      console.warn("Guide local LLM policy enhancement skipped:", error);
    }
  } finally {
    if (activeGuideLocalLlmController === controller) {
      activeGuideLocalLlmController = null;
    }
  }
}

function isLocalLlmEnhancementHost() {
  const host = window.location.hostname || "";
  if (window.location.protocol === "file:") return false;
  return Boolean(host);
}

function buildPolicyGuideResponseFromPolicyChatResult(data = {}, {
  baseResponse = null,
  policyContext = null,
  question = "",
  office = null,
  role = null,
  category = null
} = {}) {
  const policyResponse = data.policyResponse || {};
  const answerItems = normalizePolicyChatAnswerTexts(policyResponse.answer);
  const stepItems = (policyResponse.steps || []).map(cleanPolicyGuideUserText).filter(Boolean).slice(0, 4);
  const directRule = {
    ...(baseResponse?.directRule || {}),
    title: policyResponse.title || baseResponse?.directRule?.title || baseResponse?.title || "",
    lead: policyResponse.lead || baseResponse?.lead || "",
    roleLabel: policyResponse.roleLabel || data.roleLabel || role?.label || "",
    answer: answerItems.length ? answerItems : baseResponse?.directRule?.answer || [],
    steps: stepItems.length ? stepItems : baseResponse?.firstSteps || [],
    sourceKeys: policyResponse.sourceKeys || baseResponse?.directRule?.sourceKeys || [],
    queries: policyResponse.queries || baseResponse?.searchQueries || [],
    caution: policyResponse.caution || baseResponse?.caution || "",
    sourcePriority: policyResponse.sourcePriority || baseResponse?.directRule?.sourcePriority || ""
  };

  return {
    ...(baseResponse || {}),
    question: data.question || question,
    office: baseResponse?.office || office || getEducationOffice(policyContext?.officeCode || "gyeongbuk"),
    effectiveOffice: baseResponse?.effectiveOffice || office || getEducationOffice(policyContext?.officeCode || "gyeongbuk"),
    category: baseResponse?.category || category || getPolicyGuideCategory(policyContext?.categoryCode || "auto"),
    role: baseResponse?.role || role || getPolicyRole(policyContext?.roleCode || "auto"),
    needsQuestionCompletion: false,
    needsIntentConfirmation: false,
    title: policyResponse.title || baseResponse?.title || "규정·지침 답변",
    lead: policyResponse.lead || baseResponse?.lead || "",
    directRule,
    firstSteps: directRule.steps.length ? directRule.steps : answerItems.slice(1, 4),
    caution: directRule.caution,
    searchQueries: directRule.queries,
    localLlmComposer: data.localLlmComposer,
    localLlmNormalizer: data.localLlmNormalizer
  };
}

function normalizePolicyChatAnswerTexts(answer) {
  return (Array.isArray(answer) ? answer : [answer])
    .map((item) => {
      if (typeof item === "string") return cleanPolicyGuideUserText(item);
      return cleanPolicyGuideUserText(item?.text || item?.summary || item?.answer || "");
    })
    .filter(Boolean)
    .slice(0, 5);
}

function renderLocalLlmComposerNote(composer = {}, normalizer = {}) {
  if (!composer?.ok && !normalizer?.used) return "";
  const elapsed = Number(composer.elapsedMs || 0);
  const elapsedLabel = elapsed >= 1000 ? `${(elapsed / 1000).toFixed(1)}초` : `${elapsed}ms`;
  const normalizedText = normalizer?.used && normalizer.normalizedQuestion
    ? `<p>질문 정리: ${escapeHtml(normalizer.normalizedQuestion)}</p>`
    : "";
  const composerText = composer?.ok
    ? `<p>${escapeHtml(composer.model || "local model")} · ${escapeHtml(elapsedLabel)} · 규정 엔진 결과 안에서만 정리</p>`
    : "";
  return `
    <section class="free-access-note local-llm-note" aria-label="로컬 AI 보강 안내">
      <strong>Ollama 로컬 모델로 질문과 문장을 보강했습니다.</strong>
      ${normalizedText}
      ${composerText}
    </section>
  `;
}

function renderAiAccessBlocked(message = "") {
  return `
    <div class="answer-label">로그인·권한 확인</div>
    <h3>기본 답변을 먼저 확인할 수 있습니다.</h3>
    <p>${escapeHtml(message || "로그인하지 않아도 기본 규정·지침 Q&A는 이용할 수 있습니다.")}</p>
    <p>로그인이 필요한 기능은 공식자료 조회, 저장, 관리자 승인 같은 별도 기능입니다.</p>
  `;
}

function getAiAnalyzeUrl(params = null) {
  const configuredBase = getConfiguredAiWorkerBaseUrl();
  if (!configuredBase) {
    return params ? `/api/analyze?${params.toString()}` : "/api/analyze";
  }

  const baseUrl = `${configuredBase.replace(/\/+$/, "")}/api/analyze`;
  return params ? `${baseUrl}?${params.toString()}` : baseUrl;
}

function getOfficialSearchUrl(params) {
  const configuredBase = getConfiguredAiWorkerBaseUrl();
  if (!configuredBase) {
    return `/api/search?${params.toString()}`;
  }

  return `${configuredBase.replace(/\/+$/, "")}/api/search?${params.toString()}`;
}

function getConfiguredAiWorkerBaseUrl() {
  const runtimeValue = String(window.GYO6_AI_WORKER_BASE_URL || "").trim();
  if (runtimeValue) {
    return runtimeValue;
  }

  try {
    return String(window.localStorage.getItem("gyo6AiWorkerBaseUrl") || "").trim();
  } catch {
    return "";
  }
}

function createCaseSessionId() {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `case-${Date.now()}-${randomPart}`;
}

function resetTransientQuestionState({ keepFormValues = false, resetFormValues = false } = {}) {
  abortActiveRequests();
  currentCaseId = "";
  currentQuestionFingerprint = "";
  currentLiveSourceData = null;
  currentReportDraft = null;
  skipNextAutoScroll = false;

  if (resetFormValues && form) {
    form.reset();
    if (policyOfficeInput) policyOfficeInput.value = "gyeongbuk";
    if (policyRoleInput) policyRoleInput.value = "auto";
    if (policyCategoryInput) policyCategoryInput.value = "auto";
    updatePolicyCategoryOptionsForRole({ keepValue: false });
    setTopicSelection("auto", "auto", "auto");
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  if (!keepFormValues && !resetFormValues && questionInput) {
    questionInput.value = "";
  }

  if (workspace && resultPanel && queryPanel && workspace.firstElementChild !== queryPanel) {
    workspace.insertBefore(queryPanel, resultPanel);
  }

  workspace?.classList.remove("has-result");
  resultTitle.textContent = "검색 준비 화면";
  statusDot.textContent = "질문 대기";
  resultState.className = "empty-state";
  resultState.innerHTML = `
    <div class="empty-icon" aria-hidden="true">§</div>
    <h3>질문을 입력하면 결론부터 확인할 수 있습니다.</h3>
    <p>경상북도교육청 기본값, 대상자, 업무영역을 함께 반영합니다.</p>
  `;
}

function abortActiveRequests() {
  activeAiController?.abort();
  activeSourceController?.abort();
  activeLocalLlmController?.abort();
  activeGuideLocalLlmController?.abort();
  activeAiController = null;
  activeSourceController = null;
  activeLocalLlmController = null;
  activeGuideLocalLlmController = null;
}

function buildQuestionFingerprint({ question, presetType, scopes, answerMode, userRole, partyRole, topicContext }) {
  return JSON.stringify({
    question: String(question || "").trim(),
    presetType: String(presetType || "general"),
    scopes: [...(scopes || [])].map(String).sort(),
    answerMode: String(answerMode || "plain"),
    userRole: String(userRole || "auto"),
    partyRole: String(partyRole || "auto"),
    topic: {
      major: String(topicContext?.major || "auto"),
      middle: String(topicContext?.middle || "auto"),
      minor: String(topicContext?.minor || "auto"),
      presetType: String(topicContext?.presetType || "auto")
    }
  });
}

function buildGuideQuestionFingerprint({ question, officeCode, roleCode, categoryCode }) {
  return JSON.stringify({
    question: String(question || "").trim(),
    officeCode: String(officeCode || "auto"),
    roleCode: String(roleCode || "auto"),
    categoryCode: String(categoryCode || "auto")
  });
}

function isCurrentRequest(caseId, questionFingerprint = "") {
  return Boolean(
    caseId &&
    caseId === currentCaseId &&
    (!questionFingerprint || questionFingerprint === currentQuestionFingerprint)
  );
}

function renderAiAnalysis(data) {
  if (data.error || !data.analysis) {
    return `
      <div class="answer-label">AI 분석 미사용</div>
      <h3>${escapeHtml(data.error || "AI 분석 결과가 없습니다.")}</h3>
      <p>기본 분석 화면을 참고하되, 중요한 사안은 공식자료와 전문가 확인을 거치세요.</p>
    `;
  }

  const analysis = data.analysis;
  const clarifyingQuestions = (analysis.clarifyingQuestions || []).slice(0, 3);
  const keyIssues = (analysis.keyIssues || []).slice(0, 3);
  const analysisLabel = data.policyEngineFirst?.used
    ? "기본 답변"
    : `AI 질문정리 반영 · ${escapeHtml(data.model || "model")}`;
  const headline = analysis.coreFinding || analysis.title || "질문 요지를 다시 정리했습니다.";
  const lead = analysis.situationSummary || "질문 속 사실과 부족한 정보를 나누어 답변을 좁혔습니다.";

  return `
    <div class="answer-label">${analysisLabel}</div>
    ${renderAiCostSummary(data)}
    <h3>${escapeHtml(headline)}</h3>
    <p>${escapeHtml(lead)}</p>
    ${keyIssues.length ? `
      <div class="guide-direct">
        <strong>AI가 다시 잡은 핵심</strong>
        <ul>
          ${keyIssues.map((item) => `<li>${escapeHtml(item.title || item.analysis || item)}</li>`).join("")}
        </ul>
      </div>
    ` : ""}
    ${clarifyingQuestions.length ? `
      <div class="guide-direct ai-clarifying-questions">
        <strong>답변을 더 정확하게 하려면</strong>
        <ul>
          ${clarifyingQuestions.map((item) => `<li>${escapeHtml(item.question || item)}</li>`).join("")}
        </ul>
      </div>
    ` : ""}
    ${analysis.expertReferral?.reason ? `
      <p class="answer-warning">${escapeHtml(analysis.expertReferral.reason)}</p>
    ` : ""}
    ${analysis.informationNotice ? `<p class="answer-warning">${escapeHtml(analysis.informationNotice)}</p>` : ""}
  `;
}

function renderAiLegalConsequenceSummary(assessment) {
  const normalized = normalizeLegalConsequenceAssessment(assessment);
  if (!normalized) {
    return "";
  }

  const issueText = [
    ...(normalized.criminalIssues || []).map((item) => `형사: ${item.issue} - ${item.consequence}`),
    ...(normalized.civilIssues || []).map((item) => `민사: ${item.issue} - ${item.consequence}`)
  ].slice(0, 3);
  const evidenceText = (normalized.mitigationPlan || [])
    .slice(0, 3)
    .map((item) => `${item.priority}: ${item.action} (${item.evidence})`);

  return `
    <div class="result-block">
      <h3>형사·민사 가능성 확인</h3>
      <p>${escapeHtml(normalized.summary)}</p>
      ${issueText.length ? `
        <ul>
          ${issueText.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      ` : ""}
      ${evidenceText.length ? `
        <strong>감경·감량 또는 책임 완화 준비</strong>
        <ul>
          ${evidenceText.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      ` : ""}
      <p class="answer-warning">${escapeHtml(normalized.caution)}</p>
    </div>
  `;
}

function renderAiCostSummary(data = {}) {
  const billing = data.billing || {};
  const usage = data.usage || {};
  const controls = normalizeCostControl(data.costControl);
  const summary = summarizeAiUsageLedger(controls);
  const warning = getAiCostWarning(summary, controls);
  const isFreePolicyAnswer = billing.free || data.policyEngineFirst?.used;
  const costLabel = isFreePolicyAnswer
    ? "기본 답변"
    : billing.estimatedKrw
    ? `이번 답변 예상 비용 약 ${formatKrw(billing.estimatedKrw)}`
    : "이번 답변 비용 계산 대기";
  const tokenLabel = isFreePolicyAnswer
    ? "질문 내용과 선택 조건을 기준으로 답변했습니다."
    : usage.totalTokens
    ? `입력 ${formatNumber(usage.inputTokens)} · 출력 ${formatNumber(usage.outputTokens)} · 합계 ${formatNumber(usage.totalTokens)} 토큰`
    : "토큰 사용량 확인 대기";

  return `
    <div class="ai-cost-panel ${warning.level}">
      <div>
        <strong>${escapeHtml(costLabel)}</strong>
        <p>${escapeHtml(tokenLabel)}</p>
      </div>
      <div>
        <span>오늘 ${formatNumber(summary.today.calls)}회 · ${formatKrw(summary.today.krw)}</span>
        <span>이번 달 ${formatNumber(summary.month.calls)}회 · ${formatKrw(summary.month.krw)}</span>
      </div>
      ${warning.message ? `<p>${escapeHtml(warning.message)}</p>` : ""}
    </div>
  `;
}

function renderAiCostGuardBlocked(status = {}) {
  const summary = status.summary || summarizeAiUsageLedger(status.controls);
  return `
    <div class="answer-label">비용 제한 적용</div>
    <h3>오늘 또는 이번 달 사용 한도에 도달했습니다.</h3>
    <p>${escapeHtml(status.message || "테스트 비용 보호를 위해 현재 브라우저 기준 AI 호출을 잠시 막았습니다.")}</p>
    <div class="ai-cost-panel danger">
      <div>
        <strong>현재 누적</strong>
        <p>오늘 ${formatNumber(summary.today.calls)}회 · ${formatKrw(summary.today.krw)} / 이번 달 ${formatNumber(summary.month.calls)}회 · ${formatKrw(summary.month.krw)}</p>
      </div>
      <div>
        <span>월 경고 ${formatUsd(status.controls?.monthlyWarnUsd || LOCAL_COST_CONTROL.monthlyWarnUsd)}</span>
        <span>월 차단 ${formatUsd(status.controls?.monthlyStopUsd || LOCAL_COST_CONTROL.monthlyStopUsd)}</span>
      </div>
    </div>
    <p>중요한 테스트가 필요하면 브라우저 저장 사용량을 초기화하거나, 운영 전에는 OpenAI 대시보드의 실제 예산 한도를 함께 조정하세요.</p>
  `;
}

function renderReportCostMeta(report = {}) {
  if (!report.billing?.estimatedKrw && !report.usage?.totalTokens) {
    return "";
  }

  const parts = [
    report.billing?.estimatedKrw ? `예상 비용 ${formatKrw(report.billing.estimatedKrw)}` : "",
    report.usage?.totalTokens ? `토큰 ${formatNumber(report.usage.totalTokens)}` : "",
    report.billing?.pricingDate ? `단가 기준 ${report.billing.pricingDate}` : ""
  ].filter(Boolean);

  return `<p class="report-cost-meta">${parts.map(escapeHtml).join(" · ")}</p>`;
}

function recordAiUsage(data = {}) {
  if (!data.caseId || !data.billing?.estimatedUsd) {
    return;
  }

  const ledger = getAiUsageLedger();
  if (ledger.some((item) => item.caseId === data.caseId)) {
    return;
  }

  const controls = normalizeCostControl(data.costControl);
  const record = {
    caseId: data.caseId,
    model: data.model || data.billing.model || "",
    generatedAt: data.generatedAt || new Date().toISOString(),
    estimatedUsd: Number(data.billing.estimatedUsd) || 0,
    estimatedKrw: Number(data.billing.estimatedKrw) || 0,
    inputTokens: Number(data.usage?.inputTokens) || 0,
    outputTokens: Number(data.usage?.outputTokens) || 0,
    totalTokens: Number(data.usage?.totalTokens) || 0,
    pricingDate: data.billing.pricingDate || controls.pricingDate
  };

  setAiUsageLedger([...ledger, record].slice(-500));
}

function getAiCostGuardStatus() {
  const controls = normalizeCostControl();
  const summary = summarizeAiUsageLedger(controls);

  if (summary.month.usd >= controls.monthlyStopUsd) {
    return {
      blocked: true,
      controls,
      summary,
      message: `이번 달 현재 브라우저 기준 예상 사용액이 ${formatUsd(controls.monthlyStopUsd)} 차단선에 도달했습니다.`
    };
  }

  if (summary.today.calls >= controls.dailyCallLimit) {
    return {
      blocked: true,
      controls,
      summary,
      message: `오늘 현재 브라우저 기준 AI 호출 ${controls.dailyCallLimit}회 제한에 도달했습니다.`
    };
  }

  return { blocked: false, controls, summary };
}

function getAiCostWarning(summary, controls) {
  if (summary.month.usd >= controls.monthlyStopUsd) {
    return {
      level: "danger",
      message: `월 차단 기준 ${formatUsd(controls.monthlyStopUsd)}에 도달했습니다. 추가 호출은 제한됩니다.`
    };
  }

  if (summary.month.usd >= controls.monthlyWarnUsd) {
    return {
      level: "warning",
      message: `월 경고 기준 ${formatUsd(controls.monthlyWarnUsd)}를 넘었습니다. 중요한 테스트 위주로 진행하세요.`
    };
  }

  if (summary.today.calls >= Math.max(1, controls.dailyCallLimit - 3)) {
    return {
      level: "warning",
      message: `오늘 AI 호출 제한 ${controls.dailyCallLimit}회에 가까워지고 있습니다.`
    };
  }

  return { level: "normal", message: "" };
}

function summarizeAiUsageLedger(controls = normalizeCostControl()) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const monthKey = toMonthKey(now);
  const validRecords = getAiUsageLedger().filter((item) => {
    const date = new Date(item.generatedAt || "");
    return !Number.isNaN(date.getTime()) && toMonthKey(date) === monthKey;
  });
  const todayRecords = validRecords.filter((item) => toDateKey(new Date(item.generatedAt)) === todayKey);

  return {
    today: summarizeUsageRecords(todayRecords, controls),
    month: summarizeUsageRecords(validRecords, controls)
  };
}

function summarizeUsageRecords(records, controls) {
  const usd = records.reduce((sum, item) => sum + (Number(item.estimatedUsd) || 0), 0);
  const tokens = records.reduce((sum, item) => sum + (Number(item.totalTokens) || 0), 0);
  const krw = records.reduce((sum, item) => sum + (Number(item.estimatedKrw) || 0), 0) || Math.round(usd * controls.krwPerUsd);

  return {
    calls: records.length,
    usd,
    krw,
    tokens
  };
}

function getAiUsageLedger() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AI_USAGE_LEDGER_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setAiUsageLedger(records) {
  try {
    window.localStorage.setItem(AI_USAGE_LEDGER_KEY, JSON.stringify(records));
  } catch {
    // 비용 기록 실패가 상담 흐름을 막으면 안 됩니다.
  }
}

function normalizeCostControl(value = {}) {
  return {
    monthlyWarnUsd: readPositiveNumber(value.monthlyWarnUsd, LOCAL_COST_CONTROL.monthlyWarnUsd),
    monthlyStopUsd: readPositiveNumber(value.monthlyStopUsd, LOCAL_COST_CONTROL.monthlyStopUsd),
    dailyCallLimit: Math.round(readPositiveNumber(value.dailyCallLimit, LOCAL_COST_CONTROL.dailyCallLimit)),
    krwPerUsd: readPositiveNumber(value.krwPerUsd, LOCAL_COST_CONTROL.krwPerUsd),
    pricingDate: value.pricingDate || LOCAL_COST_CONTROL.pricingDate
  };
}

function readPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatKrw(value) {
  return `${formatNumber(Math.round(Number(value) || 0))}원`;
}

function formatUsd(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value) || 0);
}

function applyAiAnalysisToReport(data, question, preset, userRole, answerMode, caseId, partyRole = "auto", topicContext = null) {
  if (!data?.analysis || caseId !== currentCaseId) {
    return;
  }

  const reportElement = document.querySelector("#caseReport");
  if (!reportElement) {
    return;
  }

  const profile = collectReportProfile();
  const aiReport = buildAiSimpleReport(data, question, preset, userRole, answerMode, caseId, partyRole, topicContext);
  currentReportDraft = aiReport;
  reportElement.outerHTML = renderCaseReport(aiReport);
  restoreReportProfile(profile);

  if (currentLiveSourceData) {
    updateReportLiveSources(currentLiveSourceData);
  }
}

function buildAiSimpleReport(data, question, preset, userRole, answerMode, caseId, partyRole = "auto", topicContext = null) {
  const analysis = data.analysis || {};
  const referral = analysis.expertReferral || {};
  const generatedAt = data.generatedAt || new Date().toISOString();
  const officialSourceContext = data.officialSources || null;
  const liveSourceReferences = buildLiveSourceReferences(officialSourceContext);
  const stakeholderActions = (analysis.stakeholderActions || []).slice(0, 3).map((item) => ({
    title: item.actor || "관련 주체",
    summary: "",
    duties: (item.actions || []).slice(0, 3),
    rights: []
  }));
  const evidence = (analysis.evidencePlan || []).slice(0, 4).map((item) => ({
    priority: item.priority || "권고",
    text: item.item,
    reason: item.why,
    how: item.how
  }));

  return {
    caseId,
    source: "ai",
    title: `${analysis.title || preset.title} 간편 보고서`,
    subtitle: "상황 파악과 대처 방안 중심",
    audience: `${getRoleGuide(userRole).label} / 당사자: ${getPartyGuide(partyRole).label}`,
    generatedAt: formatDateTime(generatedAt),
    lead: analysis.coreFinding || analysis.situationSummary || "질문 내용을 바탕으로 상황과 대처 방향을 간단히 정리합니다.",
    disclaimer: analysis.informationNotice || "이 보고서는 법률 자문이나 사건 판단이 아니라 법률정보 정리 초안입니다.",
    facts: [
      { label: "원 질문", value: question },
      { label: "질문 맥락", value: topicContext?.label || preset.title },
      { label: "AI 분류", value: analysis.issueType || preset.title },
      { label: "상황 요약", value: analysis.situationSummary || "추가 확인 필요" },
      ...(analysis.knownFacts || []).slice(0, 3).map((item, index) => ({ label: `확인된 사실 ${index + 1}`, value: item }))
    ],
    issueSummary: [
      analysis.coreFinding,
      ...(analysis.keyIssues || []).slice(0, 3).map((item) => `${item.title}: ${item.analysis}`)
    ].filter(Boolean),
    immediateActions: (analysis.immediateActions || []).slice(0, 5),
    stakeholders: stakeholderActions.length ? stakeholderActions : [
      {
        title: "학교 담당자",
        summary: "사실 확인과 학생 보호 조치를 우선 정리합니다.",
        duties: (analysis.immediateActions || []).slice(0, 3),
        rights: []
      }
    ],
    evidence,
    cautions: [
      ...(analysis.mustNotAssume || []).slice(0, 3).map((item) => `단정 금지: ${item}`),
      ...(analysis.missingFacts || []).slice(0, 3).map((item) => `추가 확인: ${item}`)
    ],
    clarifyingQuestions: (analysis.clarifyingQuestions || []).slice(0, 3),
    legalConsequenceAssessment: normalizeLegalConsequenceAssessment(analysis.legalConsequenceAssessment),
    usage: data.usage || null,
    billing: data.billing || null,
    costControl: data.costControl || null,
    finalAdvice: {
      level: mapReferralLevel(referral.level),
      title: referral.level || "내부 확인",
      summary: referral.reason || "현재 입력 사실을 기준으로 내부 확인과 기록 정리를 우선합니다.",
      actions: referral.suggestedMessage ? [referral.suggestedMessage] : []
    },
    sourceSearchQueries: uniqueStrings([
      ...(analysis.sourceSearchQueries || []),
      ...(analysis.legalConsequenceAssessment?.sourceSearchQueries || [])
    ]).slice(0, 6),
    answerMode,
    officialMaterials: getOfficialMaterials(preset, {}, question),
    officialSourceContext,
    liveSourceReferences
  };
}

function buildLiveSourceReferences(sourceContext = {}) {
  const indexed = (sourceContext?.sourceReferenceIndex || []).map((item) => ({
    label: item.citation || formatLiveArticleCitation(item),
    lawName: item.lawName || "",
    articleNo: item.articleNo || "",
    branchNo: item.branchNo || "",
    articleTitle: item.articleTitle || "",
    effectiveDate: item.effectiveDate || "",
    text: item.text || "",
    url: item.url || ""
  }));

  if (indexed.length) {
    return indexed.filter((item) => item.label);
  }

  const laws = sourceContext?.results?.laws || sourceContext?.results?.law || [];
  return laws.flatMap((law) => (law.articles || []).map((article) => ({
    label: formatLiveArticleCitation({
      lawName: law.title || law.lawName || "",
      articleNo: article.articleNo || "",
      branchNo: article.branchNo || "",
      articleTitle: article.title || "",
      effectiveDate: article.effectiveDate || law.date || "",
      url: law.url || "",
      text: article.text || ""
    }),
    lawName: law.title || law.lawName || "",
    articleNo: article.articleNo || "",
    branchNo: article.branchNo || "",
    articleTitle: article.title || "",
    effectiveDate: article.effectiveDate || law.date || "",
    text: article.text || "",
    url: law.url || ""
  }))).filter((item) => item.label).slice(0, 20);
}

function formatLiveArticleCitation(item = {}) {
  const lawName = item.lawName || "법령";
  const articleNumber = formatLiveArticleNumber(item);
  const title = item.articleTitle ? `(${item.articleTitle})` : "";
  const effectiveDate = item.effectiveDate ? ` · 시행 ${item.effectiveDate}` : "";
  return `${lawName} ${articleNumber}${title}${effectiveDate}`;
}

function formatLiveArticleNumber(item = {}) {
  const articleNo = String(item.articleNo || "").trim();
  const branchNo = String(item.branchNo || "").trim();
  if (!articleNo) {
    return "조문번호 확인 필요";
  }
  return branchNo ? `제${articleNo}조의${branchNo}` : `제${articleNo}조`;
}

function mapReferralLevel(level = "") {
  if (/노무/.test(level)) return "labor";
  if (/변호|상향|즉시/.test(level)) return "legal";
  return "internal";
}

async function loadLiveSources(question, preset, keywords, caseId, questionFingerprint = "", topicContext = null) {
  const mount = document.querySelector("#liveSourceMount");
  if (!mount) {
    return;
  }

  if (!isCurrentRequest(caseId, questionFingerprint)) {
    return;
  }

  if (window.location.protocol === "file:") {
    statusDot.textContent = "로컬 서버 필요";
    mount.innerHTML = `
      <h3>근거 자료 확인</h3>
      <p class="api-source-empty"><code>npm run dev</code>로 실행한 뒤 같은 질문을 검색하면 실제 API 후보를 확인할 수 있습니다.</p>
    `;
    return;
  }

  const controller = new AbortController();
  activeSourceController = controller;

  try {
    const access = await getLawInfoAccess();
    if (!access.ok) {
      statusDot.textContent = "권한 필요";
      currentLiveSourceData = {
        error: access.message || "기본 답변은 바로 볼 수 있습니다. 공식자료 조회와 저장 기능은 승인된 사용자에게만 제공됩니다."
      };
      updateReportLiveSources(currentLiveSourceData);
      mount.innerHTML = `
        <h3>근거 자료 확인</h3>
        <p class="api-source-empty">${escapeHtml(currentLiveSourceData.error)}</p>
      `;
      return;
    }

    const params = new URLSearchParams({
      q: question,
      topic: preset.type,
      laws: preset.laws.join("|"),
      keywords: keywords.join("|"),
      topicMajor: topicContext?.major || "auto",
      topicMiddle: topicContext?.middle || "auto",
      topicMinor: topicContext?.minor || "auto",
      topicPath: topicContext?.label || preset.title
    });
    const response = await fetch(getOfficialSearchUrl(params), {
      headers: {
        accept: "application/json",
        ...(access.token ? { authorization: `Bearer ${access.token}` } : {})
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!isCurrentRequest(caseId, questionFingerprint)) {
      return;
    }
    currentLiveSourceData = data;
    mount.innerHTML = renderLiveSourceResults(data);
    updateReportLiveSources(data);

    const total = countApiItems(data);
    statusDot.textContent = total > 0 ? "API 결과 반영" : "API 후보 없음";
  } catch (error) {
    if (error.name === "AbortError" || !isCurrentRequest(caseId, questionFingerprint)) {
      return;
    }
    statusDot.textContent = "API 확인 실패";
    currentLiveSourceData = {
      error: "API 확인 중 오류가 발생했습니다. 현재 보고서는 기본 공식자료 후보를 기준으로 정리되어 있습니다."
    };
    updateReportLiveSources(currentLiveSourceData);
    mount.innerHTML = `
      <h3>근거 자료 확인</h3>
      <p class="api-source-empty">API 확인 중 오류가 발생했습니다. 비밀키 설정과 네트워크 상태를 확인해 주세요.</p>
      <p class="api-error-text">${escapeHtml(error.message)}</p>
    `;
  } finally {
    if (activeSourceController === controller) {
      activeSourceController = null;
    }
  }
}

function renderLiveSourceResults(data) {
  if (data.error) {
    return `
      <h3>근거 자료 확인</h3>
      <p class="api-source-empty">${escapeHtml(data.error)}</p>
    `;
  }

  const results = data.results || {};
  const notices = data.notices || [];
  const checkedAt = formatDateTime(data.verification?.checkedAt || data.generatedAt);

  return `
    <h3>근거 자료 확인</h3>
    <div class="api-verification">
      <span>확인시각 ${escapeHtml(checkedAt)}</span>
      <span>공식 API 우선</span>
      <span>원문 없으면 확인 필요</span>
    </div>
    <p class="api-live-summary">승인 완료된 법제처·공공데이터 출처에서 가져온 후보입니다. 국내재해사례는 사고유형, 설비, 작업상황이 충분히 맞는 후보만 엄선해 표시합니다.</p>
    ${renderApiGroup("법제처 법령 검색", results.laws, "질문과 연결된 법령 후보가 아직 없습니다.")}
    ${renderApiGroup("공식 판례·법률자료 후보", results.precedents, "국회법률도서관 또는 승인된 공식 판례 API 결과가 아직 없습니다. 판례는 확인 필요로 표시합니다.")}
    ${renderApiGroup("법령해석례 후보", results.interpretations, "관련 법령해석례 후보가 아직 없습니다.")}
    ${renderApiGroup("교육부 법령해석", results.educationInterpretations, "관련 교육부 법령해석 후보가 아직 없습니다.")}
    ${renderApiGroup("교육부 공식 기준자료", results.educationAdminRules, "관련 교육부 행정규칙·고시·훈령 후보가 아직 없습니다.")}
    ${renderApiGroup("국내재해사례", results.safetyDisasters, "관련 국내재해사례 후보가 아직 없습니다.")}
    ${renderApiGroup("안전보건자료", results.safetyMaterials, "안전보건자료 후보가 아직 없습니다.")}
    ${notices.length ? `
      <div class="api-notices">
        <strong>연결 메모</strong>
        <ul>
          ${notices.map((notice) => `<li>${escapeHtml(notice)}</li>`).join("")}
        </ul>
      </div>
    ` : ""}
  `;
}

function renderApiGroup(title, items = [], emptyMessage) {
  if (!items.length) {
    return `
      <section class="api-source-group">
        <h4>${escapeHtml(title)}</h4>
        <p class="api-source-empty">${escapeHtml(emptyMessage)}</p>
      </section>
    `;
  }

  return `
    <section class="api-source-group">
      <h4>${escapeHtml(title)}</h4>
      <div class="api-source-grid">
        ${items.slice(0, 6).map((item) => renderApiCard(item)).join("")}
      </div>
    </section>
  `;
}

function renderApiCard(item) {
  const url = safeUrl(item.url);
  const reliability = item.reliability || {};
  const verifiedAt = formatDateTime(item.verifiedAt);

  return `
    <article class="api-source-card">
      <div class="api-card-flags">
        <span class="api-card-type">${escapeHtml(item.type || item.source || "공식자료")}</span>
        <span class="api-reliability ${reliability.needsReview ? "needs-review" : "verified"}">${escapeHtml(reliability.label || "확인 필요")}</span>
      </div>
      <h5>${escapeHtml(item.title || "제목 없음")}</h5>
      <p class="api-card-meta">
        <span>${escapeHtml(item.source || "공식 출처")}</span>
        ${item.date ? `<span>일자 ${escapeHtml(item.date)}</span>` : "<span>일자 확인 필요</span>"}
        ${item.currentStatus ? `<span>${escapeHtml(item.currentStatus)}</span>` : ""}
        ${verifiedAt ? `<span>확인 ${escapeHtml(verifiedAt)}</span>` : ""}
      </p>
      ${item.subtitle ? `<p>${escapeHtml(item.subtitle)}</p>` : ""}
      ${item.summary ? `<p class="api-card-summary">${escapeHtml(item.summary)}</p>` : ""}
      ${renderApiRelevance(item.relevance)}
      ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">원문 확인</a>` : ""}
    </article>
  `;
}

function renderApiRelevance(relevance) {
  if (!relevance) {
    return "";
  }

  return `
    <div class="api-relevance ${relevance.score >= 70 ? "high" : "medium"}">
      <strong>${escapeHtml(relevance.label)} · 관련도 ${escapeHtml(relevance.score)}점</strong>
      <p>${escapeHtml(relevance.reason)}</p>
      ${relevance.matchedSignals?.length ? `
        <div>
          ${relevance.matchedSignals.map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function countApiItems(data) {
  const results = data.results || {};
  return Object.values(results).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
}

function safeUrl(value) {
  const text = String(value || "");
  return text.startsWith("https://") || text.startsWith("http://") ? text : "";
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function showEmptyMessage(title, message) {
  workspace?.classList.remove("has-result");
  if (workspace && resultPanel && queryPanel && workspace.firstElementChild !== queryPanel) {
    workspace.insertBefore(queryPanel, resultPanel);
  }

  resultTitle.textContent = "입력 필요";
  statusDot.textContent = "대기중";
  resultState.className = "empty-state";
  resultState.innerHTML = `
    <div class="empty-icon" aria-hidden="true">!</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
  `;
}

function formatScopes(scopes) {
  if (!scopes.length) {
    return "선택한 범위가 없습니다. 기본 검색에서는 법령, 판례, 행정자료, 원문 근거를 함께 확인합니다.";
  }

  const labels = {
    law: "법령",
    case: "판례",
    admin: "행정자료",
    source: "원문 근거"
  };

  return scopes.map((scope) => labels[scope] || scope).join(", ");
}

function getModeMessage(answerMode) {
  const messages = {
    plain: "쉬운 말 요약을 먼저 보여주되, 반드시 원문 확인으로 이어가야 합니다.",
    source: "원문 링크를 먼저 열어 법령명과 적용 범위를 확인하는 흐름입니다.",
    checklist: "자료 준비와 확인 순서를 중심으로 정리한 초안입니다."
  };

  return messages[answerMode] || messages.plain;
}

function analyzeQuestionScenario(question, preset) {
  const normalized = compactText(question);
  const occurrenceNegated = hasOccurrenceNegation(normalized);
  const isFieldTraining = preset.type === "fieldTraining" || /현장실습|실습생|실습기관|실습기업|직업계고|특성화고/.test(normalized);
  const actualInjury = hasActualInjurySignal(normalized) || (!occurrenceNegated && /사망|끼임|깔림|추락/.test(normalized));
  const actualAccident = hasActualAccidentSignal(normalized);
  const scopeIssue = isFieldTraining && /청소|잡무|허드렛일|업무외|업무가아니|반복|자꾸|시키|시킴|지시|불필요|필요도없는|재료|심부름|괴롭힘|부당|권익|실습범위|표준협약|멘토|기존근로자|생산량|목표|압박|평가불이익|불이익|야간|잔업|장시간/.test(normalized);
  const scopeProfile = scopeIssue ? getFieldTrainingScopeProfile(normalized) : null;
  const safetyConcern = isFieldTraining && !actualInjury && /위험|안전|기계|설비|보호구|화학|유해|먼지|청소중/.test(normalized);
  const minorStudentSafety = preset.type === "schoolSafety"
    && /체육시간|타박상|학교안전공제|과학실|화학물질|두통|가벼운|보건실|학생/.test(normalized)
    && !/중상|사망|입원|수술|중대재해|근로자|조리실무사|외부업체|용역|공사/.test(normalized);

  if (isFieldTraining && (actualInjury || actualAccident)) {
    return { type: "fieldTrainingAccident", isFieldTraining, actualInjury, actualAccident, scopeIssue, safetyConcern };
  }

  if (scopeIssue) {
    return { type: "fieldTrainingScopeIssue", isFieldTraining, actualInjury, actualAccident, scopeIssue, scopeProfile, safetyConcern };
  }

  if (preset.type === "schoolSafety" && occurrenceNegated) {
    return { type: "safetyPrevention", isFieldTraining, actualInjury, actualAccident, scopeIssue, safetyConcern };
  }

  if (minorStudentSafety) {
    return { type: "schoolSafetyMinor", isFieldTraining, actualInjury, actualAccident, scopeIssue, safetyConcern };
  }

  return { type: preset.type, isFieldTraining, actualInjury, actualAccident, scopeIssue, safetyConcern };
}

function getScenarioDisplayPreset(preset, scenario) {
  if (scenario.type === "schoolSafetyMinor") {
    return {
      ...preset,
      title: "학교 안전사고·학생 보호 확인 자료",
      summary: "중대한 사고 보고서로 단정하기보다 학생 상태, 보호자 안내, 학교안전공제 가능성, 재발방지 조치를 차분히 확인하는 자료입니다.",
      laws: ["학교안전사고 예방 및 보상에 관한 법률", "초중등교육법", "학교 안전관리 관련 교육청 안내"],
      tags: ["학교 안전", "학생 보호", "보호자 안내", "학교안전공제"],
      checklist: [
        "학생 상태와 보호자 안내 내용을 시간순으로 기록합니다.",
        "학교 교육활동 중 사고인지, 학교안전공제 안내가 필요한지 확인합니다.",
        "재발방지를 위해 수업·실험·체육 활동의 안전지도 기록을 정리합니다."
      ]
    };
  }

  if (scenario.type === "safetyPrevention") {
    return {
      ...preset,
      title: "중대재해 예방·안전보건관리체계 점검 자료",
      summary: "사고 발생 후 보고가 아니라, 학교장이 안전보건관리체계와 위험성평가를 사전에 점검하기 위한 예방·관리 자료를 정리합니다.",
      laws: ["중대재해 처벌 등에 관한 법률 제4조", "산업안전보건법", "위험성평가 관련 고시·안내"],
      tags: ["예방 점검", "안전보건관리체계", "위험성평가", "재발방지 체계"],
      checklist: [
        "학교와 용역·위탁업체의 안전보건 역할과 책임자를 구분합니다.",
        "위험성평가, 순회점검, 개선조치, 교육 기록을 정기 점검표로 만듭니다.",
        "실제 사고 보고서가 아니라 예방 점검표와 개선 이행 기록으로 관리합니다."
      ]
    };
  }

  if (scenario.type !== "fieldTrainingScopeIssue") {
    return preset;
  }

  const scopeProfile = scenario.scopeProfile || getFieldTrainingScopeProfile();

  return {
    ...preset,
    title: `현장실습 ${scopeProfile.issueName} 관련 법령`,
    summary: `${scopeProfile.reportLead}은 사고 처리 절차로 단정하지 말고, 현장실습계약·표준협약서의 업무 범위와 학생 권익보호 기준을 먼저 대조해야 합니다.`,
    laws: ["직업교육훈련 촉진법", "근로기준법 제76조의2·제76조의3", "직업계고 현장실습 운영 매뉴얼"],
    tags: scopeProfile.tags,
    checklist: [
      `${scopeProfile.instructionName}의 날짜, 지시자, 장소, 반복 여부를 시간순으로 적습니다.`,
      "현장실습계약서·표준협약서의 실습 내용과 실제 지시가 맞는지 대조합니다.",
      "학교 현장실습 담당자와 기업 담당 멘토에게 업무 범위 확인과 시정 요청을 기록으로 남깁니다."
    ]
  };
}

function getDirectAnswer(question, preset, roleGuide, scenario = analyzeQuestionScenario(question, preset)) {
  const normalized = compactText(question);

  if (scenario.type === "fieldTrainingScopeIssue") {
    const scopeProfile = scenario.scopeProfile || getFieldTrainingScopeProfile(question);
    const instructionActor = getFieldTrainingInstructorLabel(question);

    return {
      title: "사고 보고가 아니라, 현장실습 업무 범위와 지시의 적정성을 먼저 확인해야 합니다.",
      lead: `${scopeProfile.leadDetail} 사고 처리 절차가 아니라, 실습계약상 업무 범위·교육 목적·권익보호·직장 내 괴롭힘 해당 가능성을 나누어 봐야 합니다.`,
      actions: [
        scopeProfile.firstAction,
        scopeProfile.secondAction,
        "학생이 직접 맞서기보다 학교 현장실습 담당자에게 먼저 알리고, 학교가 기업 담당 멘토에게 업무 범위 확인과 시정 요청을 하도록 합니다.",
        `${scopeProfile.keyQuestion}를 확인하고, 교육 목적 밖 잡무 전가나 실습환경 악화 가능성을 분리해 봅니다.`
      ],
      responsibilityTitle: "주체별로 먼저 확인할 책임",
      responsibilities: [
        "학생: 지시 내용과 반복 횟수를 기록하고, 불편감·거부 의사·위험 요소를 학교에 알릴 수 있습니다.",
        "학교·지도교사: 실습계약 범위와 실제 지시를 대조하고, 기업 담당자에게 시정·재발방지 요청을 해야 합니다.",
        `실습기업: ${instructionActor}가 임의로 현장실습생에게 교육 목적 밖의 지시를 하지 않도록 담당자와 지시 체계를 정리해야 합니다.`,
        "보호자: 학생에게 불이익이 생기지 않도록 학교의 확인 결과와 기업의 개선 조치를 문서로 요청할 수 있습니다."
      ],
      warning: "부상이나 사고가 없으면 치료·산재 보고서가 아니라 업무 범위와 권익보호 보고서로 정리해야 합니다. 반복 지시, 모욕, 보복, 위험 작업이 확인될 때만 노무사·교육청 상담을 단계적으로 검토합니다."
    };
  }

  const hasInjury = hasActualInjurySignal(normalized);
  const hasAccident = hasActualAccidentSignal(normalized);
  const hasMachineAccident = hasMachineAccidentSignal(normalized);
  const isWorkOrTrainingSafety = /현장실습|실습생|산재|산업재해|중대재해|급식실|조리실무사|공사|외부업체|용역|사업장|기계/.test(normalized);

  if (scenario.type === "fieldTrainingAccident" || ((hasInjury || hasAccident || hasMachineAccident) && isWorkOrTrainingSafety)) {
    return {
      title: "다친 학생 보호와 사고 기록이 먼저이고, 책임 판단은 원문과 사실관계 확인 후 나눠야 합니다.",
      lead: "현장실습 중 기계 사고로 팔 골절상이 발생했다면 치료, 보호자 통보, 사고 경위 기록, 실습기관과 학교의 조치 확인을 먼저 진행해야 합니다.",
      actions: [
        "치료와 안전 확보를 먼저 하고 진단서, 치료 기록, 사고 당시 사진과 목격자 진술을 모읍니다.",
        "현장실습 협약서, 실습일지, 안전교육 기록, 기계 안전장치와 작업 지시 내용을 확인합니다.",
        "학교는 지도교사와 관리자에게 즉시 보고하고 보호자 안내, 교육청 보고 필요 여부, 실습 중단 여부를 검토합니다.",
        "실습기관은 사고 보고, 현장 보존, 안전조치, 보험·산재 관련 절차 가능성을 확인합니다."
      ],
      responsibilityTitle: "주체별로 나눠 볼 책임",
      responsibilities: [
        "학생: 치료와 사실 기록 확보가 우선이며, 혼자 책임을 떠안기는 어렵습니다.",
        "학교·지도교사: 실습 배치, 사전교육, 지도·점검, 사고 후 보호 조치가 쟁점입니다.",
        "실습기관·회사: 현장 안전관리, 기계 안전조치, 작업 지시와 감독이 핵심 쟁점입니다.",
        "학부모: 치료 자료, 협약서, 학교와 회사의 안내 내용을 모아 공식 절차를 요구할 수 있습니다."
      ],
      warning: "골절처럼 중한 부상이 있으면 검색 결과만으로 책임을 단정하지 말고, 학교·교육청·노무사·변호사 등 전문가 확인을 함께 진행해야 합니다."
    };
  }

  if (preset.type === "schoolViolence") {
    return {
      title: "사실관계 기록과 학생 보호 조치를 먼저 확인해야 합니다.",
      lead: "학교폭력 의심 사안은 신고·접수, 피해학생 보호, 전담기구 확인, 심의 절차를 순서대로 나누어 봐야 합니다.",
      actions: [
        "발생 일시, 장소, 관련 학생, 증거 자료를 시간순으로 정리합니다.",
        "학교의 접수 여부와 피해학생 보호 조치가 있었는지 확인합니다.",
        "교육부 학교폭력 사안처리 가이드북과 관련 법령을 함께 확인합니다."
      ],
      responsibilityTitle: "확인할 주체",
      responsibilities: [
        "학생: 안전 확보와 진술 보호가 우선입니다.",
        "학교: 접수, 조사, 보호 조치, 절차 안내가 쟁점입니다.",
        "학부모: 자료 보존과 학교 절차 확인이 중요합니다."
      ],
      warning: "징계, 심의, 형사 문제가 연결되면 전문가와 관할 기관 확인이 필요합니다."
    };
  }

  if (preset.type === "schoolAdministration") {
    return {
      title: "교육행정 사안은 업무 단계와 관할 기준을 먼저 나누어야 합니다.",
      lead: "학교회계, 학생생활기록, 공문·회의록·정보공개 사안은 법령만으로 끝나지 않고 교육부 훈령, 당해 학년도 기재요령, 시도교육청 지침, 학교 내부 결재 흐름을 함께 확인해야 합니다.",
      actions: [
        "질문이 예산 편성, 품의, 계약, 검수, 지출, 정산, 학생부 기재·정정, 공문 처리 중 어느 단계인지 표시합니다.",
        "관할 시도교육청 지침, 학교 내부 규정, 결재 문서, 증빙자료, 회의록을 시간순으로 모읍니다.",
        "학생생활기록 사안은 학교생활기록 작성 및 관리지침과 2026학년도 기재요령을 먼저 대조합니다.",
        "학교회계 사안은 학교회계 규칙, 예산편성 기본지침, 품의·검수·영수증 등 지출 증빙 흐름을 분리합니다."
      ],
      responsibilityTitle: "확인할 주체와 자료",
      responsibilities: [
        "담당자: 업무 단계, 결재선, 보유 증빙, 처리일자를 사실 중심으로 정리합니다.",
        "학교 관리자: 학교장 승인, 위원회·회의록, 내부통제와 보존 기준을 확인합니다.",
        "교육청 기준: 관할 시도교육청 지침, 학교회계 예산편성 기본지침, 학생부 관련 안내를 대조합니다."
      ],
      warning: "예산 집행 책임, 학생부 정정 가능 여부, 개인정보 제공 범위는 원문과 관할 교육청 기준에 따라 달라질 수 있으므로 확인 필요 상태를 명확히 표시해야 합니다."
    };
  }

  if (preset.type === "staffLabor") {
    return {
      title: "교직원·행정직 노무 사안은 사실관계 기록과 보호 조치를 먼저 나누어야 합니다.",
      lead: "휴가·출장·근태, 계약, 복무, 직장 내 괴롭힘, 성희롱, 재계약 불이익처럼 신분과 노동관계가 얽힌 사안은 학교 내부 확인과 외부 전문가 검토 필요성을 구분해야 합니다.",
      actions: [
        "교원, 지방공무원, 교육공무직, 기간제 등 신분과 적용 규정을 먼저 구분합니다.",
        "휴가·출장·근태라면 신청일, 승인권자, 나이스 근무상황, 공문, 증빙자료를 시간순으로 정리합니다.",
        "계약서, 복무 기준, 업무분장, 지시·발언 기록, 메신저·이메일 등 원자료를 시간순으로 정리합니다.",
        "신고자 보호, 불리한 처우 금지, 조사 담당자 분리 등 내부 절차를 먼저 확인합니다.",
        "성희롱, 해고, 재계약 불이익, 형사·손해배상 가능성이 있으면 노무사 또는 변호사 상담 범위를 별도로 정합니다."
      ],
      responsibilityTitle: "주체별로 나눠 볼 책임",
      responsibilities: [
        "학교·관리자: 사실 확인 절차, 신고자 보호, 불리한 처우 방지, 기록 보존이 핵심입니다.",
        "당사자: 구체적 일시·장소·발언·지시 내용과 보유 자료를 사실 중심으로 정리합니다.",
        "인사·행정 담당: 계약·복무·징계·재계약 기준과 실제 조치가 일치하는지 확인합니다."
      ],
      warning: "사고나 부상 사안이 아니면 의료·산재 자료를 요구하지 않습니다. 성희롱, 해고, 보복, 형사 문제로 이어질 가능성이 보일 때만 전문가 상담을 상향 검토합니다."
    };
  }

  return {
    title: `${preset.title}에 관해 먼저 사실관계와 공식 원문을 나눠 확인해야 합니다.`,
    lead: `${roleGuide.label} 기준으로는 질문 속 대상, 장소, 날짜, 기관, 이미 진행된 조치를 먼저 정리한 뒤 공식 법령과 행정자료를 확인하는 흐름이 좋습니다.`,
    actions: [
      "관련된 사람과 기관을 나눠 적습니다.",
      "계약서, 협약서, 공문, 상담 기록, 사진 등 원자료를 모읍니다.",
      "아래 공식 자료 후보와 실제 API 결과에서 원문 링크를 먼저 확인합니다."
    ],
    responsibilityTitle: "확인할 기준",
    responsibilities: [
      "법령 원문: 적용 기준과 조문을 확인합니다.",
      "행정자료: 학교 현장에서 실제 운영 절차를 확인합니다.",
      "전문가 확인: 책임 판단이나 분쟁 가능성이 있으면 별도로 검토합니다."
    ],
    warning: "이 답변은 법률 자문이 아니라 정보 정리입니다. 중요한 판단은 전문가 확인이 필요합니다."
  };
}

function buildCaseReport(question, preset, roleGuide, officialMaterials, riskSignals, scenario = analyzeQuestionScenario(question, preset)) {
  const context = getQuestionContext(question);

  if (scenario.type === "fieldTrainingAccident") {
    return buildFieldTrainingAccidentReport(context, roleGuide, officialMaterials, riskSignals);
  }

  if (scenario.type === "fieldTrainingScopeIssue") {
    return buildFieldTrainingScopeIssueReport(context, roleGuide, officialMaterials, riskSignals, scenario);
  }

  return buildGeneralCaseReport(context, preset, roleGuide, officialMaterials, riskSignals, scenario);
}

function buildFieldTrainingAccidentReport(context, roleGuide, officialMaterials, riskSignals) {
  const practicePlace = findDetailAnswer(context.details, "실습시간 안에");
  const workOrder = findDetailAnswer(context.details, "작업을 지시");
  const practiceRecords = findDetailAnswer(context.details, "협약서");
  const firstResponse = findDetailAnswer(context.details, "사고 직후");
  const friendWork = findDetailAnswer(context.details, "친구 일을");
  const injuryRecord = findDetailAnswer(context.details, "진단명");
  const privateVisitSignal = /놀러|개인|부탁|비공식|허락.*모름|그냥/.test(friendWork || "");
  const reportSeed = {
    context,
    presetType: "fieldTraining",
    riskSignals,
    injuryRecord,
    workOrder,
    firstResponse,
    friendWork,
    privateVisitSignal
  };

  return {
    title: "현장실습 중 안전사고 사안 보고서",
    subtitle: "학교·학생/보호자·실습기업 조치사항 및 근거자료 정리",
    audience: roleGuide.label,
    generatedAt: formatDateTime(new Date().toISOString()),
    lead: privateVisitSignal
      ? "현재 입력 내용상 실습기관 안팎에서 기계와 관련된 골절 사고가 발생했고, 친구 일을 도우러 간 경위가 공식 실습 업무인지 개인적 방문인지가 핵심 쟁점입니다. 치료와 학생 보호를 먼저 하되, 책임 판단은 사고 장소·시간·작업 지시·안전관리 기록을 분리해 확인해야 합니다."
      : "현재 입력 내용상 현장실습 과정에서 기계와 관련된 골절 사고가 발생한 사안입니다. 치료와 학생 보호를 먼저 하되, 학교의 실습 운영 관리와 실습기업의 안전보건 조치, 학생·보호자의 자료 확보를 동시에 진행해야 합니다.",
    disclaimer: "이 보고서는 법률 자문이나 책임 확정 문서가 아니라, 공식자료와 입력 사실을 바탕으로 한 법률정보 정리 초안입니다. 중상, 장해, 손해배상, 산재, 소송 가능성이 있으면 변호사·노무사·교육청 등 전문가 확인이 필요합니다.",
    facts: [
      { label: "원 질문", value: context.baseQuestion || "질문 내용 확인 필요" },
      { label: "사고 시간·장소", value: practicePlace || "실습시간 안, 실습 장소 안에서 발생했는지 추가 확인 필요" },
      { label: "작업 지시·허락", value: workOrder || "학생이 해당 작업을 지시받았거나 허락받았는지 추가 확인 필요" },
      { label: "실습 기록", value: practiceRecords || "현장실습 협약서, 실습일지, 안전교육 기록 확보 필요" },
      { label: "사고 직후 조치", value: firstResponse || "학교, 보호자, 회사의 최초 조치와 연락 시각 확인 필요" },
      { label: "친구 일을 도운 경위", value: friendWork || "공식 실습 업무인지, 개인적 부탁인지 추가 확인 필요" },
      { label: "피해 정도", value: injuryRecord || "진단명, 치료기간, 수술·장해 가능성 자료 확보 필요" }
    ],
    issueSummary: [
      "치료와 안전 확보가 최우선이며, 책임 판단보다 학생 보호·기록 보전·재발 방지가 먼저입니다.",
      "사고가 공식 실습 범위 안에서 발생했는지, 학생이 허락받은 작업을 했는지, 감독자가 있었는지가 핵심입니다.",
      "기계 안전장치, 위험성 안내, 안전교육, 작업 지시, 현장 감독 기록이 실습기업 책임 검토의 중심 자료입니다.",
      "학교는 실습 배치, 사전교육, 순회지도, 사고 후 보호자 통보와 교육청 보고 필요 여부를 확인해야 합니다.",
      "골절은 가벼운 사고로 보기 어렵기 때문에 치료 기록과 진단서를 기준으로 산재·보험·학교안전 관련 절차 가능성을 함께 검토해야 합니다."
    ],
    immediateActions: [
      "학생의 치료, 추가 위험 차단, 보호자 통보를 우선 완료합니다.",
      "사고 발생 시각, 장소, 작업 내용, 누가 지시했는지, 누가 목격했는지를 시간순으로 기록합니다.",
      "진단서, 응급실 기록, 치료비 영수증, 사진, CCTV 보존 요청, 목격자 진술을 확보합니다.",
      "현장실습 협약서, 실습일지, 출근·퇴근 기록, 안전교육 서명부, 지도교사 방문 기록을 모읍니다.",
      "기계 안전장치, 작업표준서, 위험성평가, 보호구 지급, 감독자 배치 자료를 실습기업에 요청합니다.",
      "학생에게 불이익이 생기지 않도록 출결, 평가, 실습 중단·복귀 계획을 학교가 별도로 관리합니다."
    ],
    stakeholders: [
      {
        title: "학교·지도교사·관리자",
        summary: "학생 보호와 실습 운영 관리의 중심 주체입니다. 사고 책임을 단정하기보다 기록을 보전하고 공식 절차를 빠르게 세우는 역할이 중요합니다.",
        duties: [
          "보호자 통보, 관리자 보고, 필요 시 교육청 보고 여부를 즉시 검토합니다.",
          "현장실습 협약서, 사전교육, 순회지도, 실습일지, 상담·보고 기록을 정리합니다.",
          "실습기관에 사고 경위, 안전조치, 작업 지시, 현장 보존, 보험·산재 관련 자료를 공식 요청합니다.",
          "학생의 치료, 출결, 평가, 실습 중단·재배치, 복귀 여부를 불이익 없이 관리합니다."
        ],
        rights: [
          "실습기관에 안전교육 자료, 작업 지시 기록, 사고 경위서, 재발방지 대책을 요청할 수 있습니다.",
          "사실관계가 불명확한 부분은 학생·보호자·기업의 진술을 나누어 확인하고 문서화할 수 있습니다."
        ]
      },
      {
        title: "학생·보호자",
        summary: "치료와 권리 보호가 최우선입니다. 학생에게 사고 책임을 성급히 돌리기보다 치료 자료와 공식 설명을 확보해야 합니다.",
        duties: [
          "진단서, 치료기록, 사진, 사고 당시 기억, 통화·문자 기록을 시간순으로 보관합니다.",
          "학교와 실습기업에 사고 경위, 보험·산재·보상 절차, 출결·평가 처리 방식을 공식적으로 문의합니다.",
          "민감정보는 꼭 필요한 범위에서만 제공하고, 사실과 다른 진술서에 서명하지 않도록 주의합니다."
        ],
        rights: [
          "치료와 안전 확보를 먼저 요구할 수 있고, 실습 중단·복귀·재배치에 대한 설명을 요구할 수 있습니다.",
          "학교와 기업이 보유한 사고 관련 기록, 안전교육 여부, 보호조치 내용을 확인 요청할 수 있습니다.",
          "중한 부상이나 보상 문제가 있으면 노무사·변호사·교육청 등 전문가 상담을 받을 수 있습니다."
        ]
      },
      {
        title: "실습기업·산업체",
        summary: "사업장 안에서 발생한 기계 관련 사고라면 안전보건 조치와 현장 감독 여부가 핵심입니다.",
        duties: [
          "응급조치, 사고 보고, 현장 보존, 추가 사고 방지 조치를 즉시 수행합니다.",
          "기계 안전장치, 보호구, 작업표준, 위험성 안내, 감독자 배치, 작업 지시 자료를 정리합니다.",
          "학생이 허가받은 작업을 했는지, 친구 작업을 도운 경위가 무엇인지, 담당자가 알고 있었는지 확인합니다.",
          "보험·산재·재해조사 가능성을 검토하고 학교와 보호자에게 절차를 안내합니다."
        ],
        rights: [
          "정확한 사실관계를 확인하기 위해 목격자 진술, CCTV, 작업일지, 출입기록을 확보할 수 있습니다.",
          "공식 실습 범위를 벗어난 사정이 있다면 그 경위를 학교와 함께 문서로 정리할 수 있습니다."
        ]
      }
    ],
    evidence: [
      "진단서, 치료기록, 치료비 영수증, 향후 치료 소견",
      "사고 당시 사진, CCTV 보존 요청, 목격자 진술, 통화·문자 기록",
      "현장실습 협약서, 실습일지, 출퇴근 기록, 실습 배치표",
      "안전교육 자료, 서명부, 보호구 지급 기록, 위험성평가 자료",
      "기계 점검표, 작업표준서, 작업 지시자·감독자 기록",
      "학교 보고서, 보호자 안내 기록, 교육청 보고 검토 기록"
    ],
    cautions: [
      "친구 일을 돕게 된 사정이 공식 실습 업무인지 개인적 방문인지가 불명확하면 책임 판단이 크게 달라질 수 있습니다.",
      "골절처럼 중한 부상은 단순 사고로 처리하지 말고 치료 경과와 장해 가능성을 계속 기록해야 합니다.",
      "중대재해처벌법 해당 여부는 사망, 동일 사고 부상자 수, 질병 요건 등 법정 기준에 따라 별도 검토가 필요합니다.",
      "AI 요약이나 검색 결과만으로 학교·기업·학생의 법적 책임을 확정하면 안 됩니다."
    ],
    finalAdvice: buildFinalAdvice(reportSeed),
    officialMaterials
  };
}

function buildFieldTrainingScopeIssueReport(context, roleGuide, officialMaterials, riskSignals, scenario = {}) {
  const scopeProfile = scenario.scopeProfile || getFieldTrainingScopeProfile(context.baseQuestion);
  const instructionActor = getFieldTrainingInstructorLabel([
    context.baseQuestion || "",
    ...(context.details || []).map((item) => `${item.question} ${item.answer}`)
  ].join(" "));
  const repeatedInstruction = findDetailAnswer(context.details, "반복") || findDetailAnswer(context.details, "지시") || "";
  const contractScope = findDetailAnswer(context.details, "협약서") || findDetailAnswer(context.details, "실습 내용") || "";
  const studentResponse = findDetailAnswer(context.details, "학생") || "";
  const schoolAction = findDetailAnswer(context.details, "학교") || "";
  const companyMentor = findDetailAnswer(context.details, "기업") || findDetailAnswer(context.details, "담당") || "";
  const reportSeed = {
    context,
    presetType: "fieldTrainingScopeIssue",
    scopeProfile,
    riskSignals,
    workOrder: repeatedInstruction
  };

  return {
    title: `현장실습 중 ${scopeProfile.issueName} 사안 보고서`,
    subtitle: "실습계약 범위, 학생 권익보호, 학교·기업 시정 조치 정리",
    audience: roleGuide.label,
    generatedAt: formatDateTime(new Date().toISOString()),
    lead: `현재 입력 내용은 ${scopeProfile.reportLead}입니다. 따라서 사고 처리 절차가 아니라 실습 업무 범위, 교육 목적, 지시 체계, 권익침해 가능성을 먼저 확인해야 합니다.`,
    disclaimer: "이 보고서는 법률 자문이나 괴롭힘 인정 판단이 아니라, 현장실습 업무 범위와 학생 권익보호 기준을 확인하기 위한 법률정보 정리 초안입니다. 보복, 모욕, 위험 작업, 지속적 불이익이 확인되면 학교·교육청·노무사 상담을 단계적으로 검토합니다.",
    facts: [
      { label: "원 질문", value: context.baseQuestion || "질문 내용 확인 필요" },
      { label: "문제 유형", value: `부상·사고가 아니라 ${scopeProfile.problemType}` },
      { label: "지시 내용", value: repeatedInstruction || `${scopeProfile.instructionName}의 구체적 내용과 지시 경위 확인 필요` },
      { label: "실습계약상 업무 범위", value: contractScope || "현장실습계약서·표준협약서·실습계획서상 업무 내용 확인 필요" },
      { label: "학생 상태·의사", value: studentResponse || "학생이 부담감, 거부 의사, 불이익 우려, 위험 요소를 느끼는지 상담 필요" },
      { label: "학교 조치", value: schoolAction || "학교 현장실습 담당자 상담, 기업 확인, 순회지도·시정요청 여부 확인 필요" },
      { label: "기업 담당 체계", value: companyMentor || `기업 담당 멘토와 ${instructionActor}의 지시 권한·업무분장 확인 필요` }
    ],
    issueSummary: [
      `${scopeProfile.instructionName}이 현장실습계약서의 실습 내용·방법에 포함되는지 먼저 확인해야 합니다.`,
      `${scopeProfile.keyQuestion}를 확인해 교육 목적 안의 실습인지, 교육 목적 밖 잡무 전가인지 구분해야 합니다.`,
      `${instructionActor}가 지위 또는 관계의 우위를 이용해 업무상 적정범위를 넘는 지시를 반복했다면 실습환경 악화와 권익침해 가능성을 검토합니다.`,
      "학교는 학생 상담 기록을 남기고, 기업 담당자에게 공식 업무 범위 확인과 시정 요청을 해야 합니다.",
      "현재 질문에 확인된 피해 발생이 없으므로, 업무범위·권익보호 보고서로 정리합니다."
    ],
    immediateActions: [
      scopeProfile.firstAction,
      `현장실습계약서, 표준협약서, 실습계획서, 직무기술서에 ${scopeProfile.instructionName}이 포함되어 있는지 확인합니다.`,
      `학교 현장실습 담당자는 기업 담당 멘토에게 ${instructionActor}의 지시 권한과 ${scopeProfile.instructionName}의 교육 목적을 확인합니다.`,
      "업무 범위 밖 반복 지시로 보이면 학교 명의로 지시 중단, 담당 멘토를 통한 지시 일원화, 학생 불이익 금지를 요청합니다.",
      "지시 내용이 기계·화학물질·분진 등 위험요소와 연결되면 안전교육·보호구·감독 여부를 별도로 확인합니다."
    ],
    stakeholders: [
      {
        title: "학교·지도교사·현장실습 담당자",
        summary: "학생이 기업 안에서 직접 문제 제기하기 어려우므로 학교가 사실 확인과 시정 요청의 중심이 되어야 합니다.",
        duties: [
          "학생 상담 내용을 시간순으로 기록하고, 실습계약상 업무 범위와 실제 지시를 대조합니다.",
          `기업 담당 멘토에게 ${instructionActor}의 지시 권한, ${scopeProfile.instructionName}의 필요성, 교육 목적을 확인합니다.`,
          "업무 범위 밖 지시가 반복되면 시정 요청, 순회지도 강화, 실습 변경·중단·재배치 필요성을 검토합니다.",
          "학생에게 출결·평가·취업상 불이익이 생기지 않도록 별도 관리합니다."
        ],
        rights: [
          "기업에 실습계획, 담당 멘토, 작업지시 체계, 개선 계획을 문서로 요청할 수 있습니다.",
          "학생 권익침해가 반복되면 교육청 현장실습 담당 부서에 사실관계와 조치 방향을 문의할 수 있습니다."
        ]
      },
      {
        title: "학생·보호자",
        summary: "학생은 문제를 혼자 떠안지 말고 지시 내용을 기록해 학교를 통해 확인하도록 하는 것이 안전합니다.",
        duties: [
          `언제, 누가, 어떤 방식으로 ${scopeProfile.instructionName}을 지시했는지 사실 위주로 기록합니다.`,
          "감정 표현보다 반복성, 지시자, 업무 관련성, 불필요성 여부를 구체적으로 남깁니다.",
          "기업 근로자와 직접 충돌하기보다 학교 담당자에게 먼저 알립니다."
        ],
        rights: [
          "실습계약 범위를 벗어난 반복 잡무나 불필요한 지시에 대해 학교를 통한 확인과 시정을 요구할 수 있습니다.",
          "보복, 모욕, 따돌림, 위험 작업 지시가 있으면 즉시 학교와 보호자에게 알리고 공식 절차를 요청할 수 있습니다."
        ]
      },
      {
        title: "실습기업·산업체",
        summary: `현장실습생에게는 교육 목적과 계약 범위에 맞는 지시 체계를 제공해야 하며, ${instructionActor}의 임의 지시를 방치하면 분쟁이 커질 수 있습니다.`,
        duties: [
          "현장실습 담당 멘토와 지시 권한자를 명확히 정합니다.",
          `${scopeProfile.instructionName}이 실습 직무에 필요한 경우라도 교육 목적, 범위, 시간, 안전조치를 설명합니다.`,
          `${instructionActor}에게 교육 목적 밖 업무 외 지시나 잡무 전가가 없도록 안내합니다.`,
          "학교의 시정 요청과 학생 보호 조치에 협조합니다."
        ],
        rights: [
          "실습 운영상 필요한 정리정돈 교육이라면 그 목적과 범위를 학교·학생에게 설명하고 기록할 수 있습니다.",
          "사실과 다른 주장에 대해서는 작업지시 기록, 멘토 확인, 실습일지로 소명할 수 있습니다."
        ]
      }
    ],
    evidence: [
      "현장실습계약서·표준협약서·실습계획서",
      `학생 실습일지와 ${scopeProfile.instructionName}의 지시 일시·지시자·장소 기록`,
      "기업 담당 멘토 확인 내용과 학교 상담 기록",
      "반복 지시가 드러나는 문자·메신저·작업표·사진",
      "위험요소가 있으면 안전교육·보호구·감독 기록"
    ],
    cautions: [
      `${scopeProfile.instructionName}만으로 곧바로 위법 또는 괴롭힘이라고 단정하면 안 됩니다. 실습 직무와 직접 관련된 교육활동인지, 반복 잡무 전가인지가 핵심입니다.`,
      "피해 발생이 확인되지 않은 사안에 의료·재해 자료를 요구하면 보고서 신뢰도가 떨어집니다.",
      "학생이 기업에서 불이익을 걱정할 수 있으므로 학교가 먼저 사실 확인과 시정 요청을 중재하는 방식이 적절합니다.",
      "모욕, 협박, 보복, 위험작업 지시, 장기간 반복이 확인되면 직장 내 괴롭힘 또는 권익침해 절차 검토가 필요합니다."
    ],
    finalAdvice: buildFinalAdvice(reportSeed),
    officialMaterials
  };
}

function buildGeneralCaseReport(context, preset, roleGuide, officialMaterials, riskSignals, scenario = {}) {
  const reportSeed = {
    context,
    presetType: preset.type,
    scenarioType: scenario.type,
    riskSignals
  };
  const legalConsequenceAssessment = buildLocalLegalConsequenceAssessment(context, preset, riskSignals);

  return {
    title: `${preset.title} 사안 보고서`,
    subtitle: "질문 내용, 확인 쟁점, 주체별 조치사항 및 근거자료 정리",
    audience: roleGuide.label,
    generatedAt: formatDateTime(new Date().toISOString()),
    lead: `${roleGuide.label} 기준으로 입력된 질문을 공식자료와 연결해 정리한 보고서입니다. 사실관계가 더 구체화될수록 적용 자료와 조치사항을 더 좁힐 수 있습니다.`,
    disclaimer: "이 보고서는 법률 자문이나 사건 판단이 아니라 법률정보 정리 초안입니다. 실제 조치 전에는 공식 원문과 전문가 확인이 필요합니다.",
    facts: [
      { label: "원 질문", value: context.baseQuestion || "질문 내용 확인 필요" },
      ...context.details.map((item) => ({ label: item.question, value: item.answer }))
    ],
    issueSummary: [
      "관련 주체, 날짜, 장소, 이미 진행된 조치를 나누어 확인해야 합니다.",
      "법령 원문, 행정자료, 판례 후보를 분리해 확인해야 합니다.",
      riskSignals.length ? `${riskSignals.join(", ")} 표현이 있어 전문가 확인을 우선 검토해야 합니다.` : "중요한 판단은 원문과 사실관계 확인 후 진행해야 합니다."
    ],
    immediateActions: [
      "관련 문서, 공문, 계약서, 문자, 사진, 상담 기록을 시간순으로 정리합니다.",
      "학교, 기관, 당사자별로 이미 한 조치와 앞으로 필요한 조치를 분리합니다.",
      "공식 원문과 승인 API 결과를 기준으로 확인하고, 출처 불명 자료는 참고 수준으로 낮춥니다."
    ],
    stakeholders: [
      {
        title: "학교·기관",
        summary: "절차 운영과 기록 보전의 중심입니다.",
        duties: ["사실관계와 조치 기록을 문서화합니다.", "관련 규정과 공식 안내를 기준으로 안내합니다.", "학생 또는 민원인의 권리 보호 조치를 검토합니다."],
        rights: ["필요한 자료 제출과 사실 확인을 요청할 수 있습니다.", "분쟁 가능성이 있으면 담당 기관과 전문가 검토를 요청할 수 있습니다."]
      },
      {
        title: "당사자·보호자",
        summary: "권리 보호와 자료 확보가 중요합니다.",
        duties: ["사실과 자료를 시간순으로 정리합니다.", "민감정보는 필요한 범위에서만 제공합니다.", "확인되지 않은 내용은 단정하지 않습니다."],
        rights: ["공식 절차와 처리 기준에 대한 설명을 요구할 수 있습니다.", "중요 사안은 전문가 상담을 받을 수 있습니다."]
      }
    ],
    evidence: ["계약서·협약서", "공문·안내문", "상담·지도 기록", "사진·문자·이메일", "관련 기관 답변"],
    cautions: ["사실관계가 바뀌면 적용 법령과 조치가 달라질 수 있습니다.", "AI 요약은 참고용이며 공식 원문 확인이 필요합니다."],
    legalConsequenceAssessment,
    sourceSearchQueries: legalConsequenceAssessment?.sourceSearchQueries || [],
    finalAdvice: buildFinalAdvice(reportSeed),
    officialMaterials
  };
}

function normalizeLegalConsequenceAssessment(assessment = {}) {
  if (!assessment || assessment.applies === false) {
    return null;
  }

  const criminalIssues = (assessment.criminalIssues || []).slice(0, 4).map((item) => ({
    issue: item.issue || "형사 쟁점",
    legalBasis: item.legalBasis || "원문 확인 필요",
    consequence: item.potentialConsequence || "법정형·벌금 범위는 법령 원문 확인 후 판단해야 합니다.",
    sourceStatus: item.sourceStatus || "원문 확인 필요",
    requiredFacts: (item.requiredFacts || []).slice(0, 3)
  }));
  const civilIssues = (assessment.civilIssues || []).slice(0, 4).map((item) => ({
    issue: item.issue || "민사 쟁점",
    legalBasis: item.legalBasis || "원문 확인 필요",
    consequence: item.possibleClaim || "손해배상 범위는 피해, 인과관계, 과실, 판례 경향 확인 후 판단해야 합니다.",
    sourceStatus: item.sourceStatus || "원문 확인 필요",
    requiredFacts: (item.requiredFacts || []).slice(0, 3)
  }));
  const mitigationPlan = (assessment.mitigationPlan || []).slice(0, 5).map((item) => ({
    priority: item.priority || "권고",
    action: item.action || "",
    evidence: item.evidence || "",
    why: item.why || "",
    legalBasis: item.legalBasis || "원문·판례 확인 필요"
  })).filter((item) => item.action || item.evidence);

  if (!criminalIssues.length && !civilIssues.length && !mitigationPlan.length) {
    return null;
  }

  return {
    applies: true,
    riskLevel: assessment.riskLevel || "보통",
    summary: assessment.summary || "형사·민사로 확대될 가능성이 있어 법령 원문과 사실관계 확인이 필요합니다.",
    criminalIssues,
    civilIssues,
    mitigationPlan,
    sourceSearchQueries: (assessment.sourceSearchQueries || []).slice(0, 5),
    caution: assessment.caution || "이 내용은 법률정보 정리이며, 처벌·배상 가능성은 원문과 구체적 사실관계에 따라 달라집니다."
  };
}

function buildLocalLegalConsequenceAssessment(context, preset, riskSignals = []) {
  const text = [
    context.baseQuestion || "",
    ...(context.details || []).map((item) => `${item.question} ${item.answer}`),
    preset.title || "",
    ...riskSignals
  ].join(" ");
  const normalized = compactText(text);
  const hasViolenceNegation = /폭행(은|는)?없|폭행없|상해(는|은)?없|상해없|신체접촉(은|는)?없|신체접촉없/.test(normalized);
  const hasViolenceSignal = !hasViolenceNegation && /폭행|상해|협박|감금|강요|공갈/.test(normalized);
  const hasCriminalSignal = hasViolenceSignal || /명예훼손|모욕|성폭력|성추행|불법촬영|아동학대|고소|고발|형사|벌금|합의|스토킹|개인정보유출|개인정보누설/.test(normalized);
  const hasCivilSignal = /손해배상|민사|치료비|위자료|불법행위|배상|합의금|재산피해|금전피해/.test(normalized) || (!hasViolenceNegation && /폭행|상해/.test(normalized)) || /명예훼손|모욕|아동학대|성폭력/.test(normalized);
  const hasInjuryRecordNeed = !hasViolenceNegation && /상해|폭행|치료비|병원|진단|다쳤|다침|부상|골절|화상|전치/.test(normalized);

  if (!hasCriminalSignal && !hasCivilSignal) {
    return null;
  }

  const criminalIssues = [];
  if (!hasViolenceNegation && /폭행|상해/.test(normalized)) {
    criminalIssues.push({
      issue: "폭행·상해 가능성",
      legalBasis: "형법상 폭행·상해 관련 조문 - 법제처 원문 확인 필요",
      consequence: "징역·벌금 등 법정형은 상해 발생 여부, 진단기간, 행위 태양에 따라 달라지므로 원문 조문과 판례 확인 후 기재합니다.",
      sourceStatus: "원문 확인 필요",
      requiredFacts: ["신체 접촉 또는 상해 발생 여부", "진단서·치료기록", "목격자·영상 등 객관자료"]
    });
  }
  if (/명예훼손|모욕|비방|인스타그램|단체채팅|사이버/.test(normalized)) {
    criminalIssues.push({
      issue: "명예훼손·모욕 가능성",
      legalBasis: "형법 및 정보통신망법상 명예훼손·모욕 관련 조문 - 법제처 원문 확인 필요",
      consequence: "공연성, 특정성, 사실 적시 여부, 정보통신망 이용 여부에 따라 처벌 범위가 달라져 원문과 판례 대조가 필요합니다.",
      sourceStatus: "원문 확인 필요",
      requiredFacts: ["게시물·대화 원본", "확산 범위와 상대 특정 가능성", "삭제·정정·사과 등 사후 조치"]
    });
  }
  if (/아동학대|정서학대/.test(normalized)) {
    criminalIssues.push({
      issue: "아동학대 신고·수사 가능성",
      legalBasis: "아동학대처벌법·아동복지법 관련 조문 - 법제처 원문 확인 필요",
      consequence: "행위 내용, 반복성, 학생에게 미친 영향, 교육적 지도 범위에 따라 형사 절차와 행정 절차가 갈릴 수 있습니다.",
      sourceStatus: "원문 확인 필요",
      requiredFacts: ["생활지도 경위", "학생 진술과 보호자 주장", "학교 규정·상담·목격 기록"]
    });
  }
  if (/성폭력|성추행|불법촬영|성희롱/.test(normalized)) {
    criminalIssues.push({
      issue: "성 관련 형사·징계 가능성",
      legalBasis: "성폭력처벌법, 형법, 양성평등 관련 법령 - 법제처 원문 확인 필요",
      consequence: "행위 유형과 피해자 연령, 증거 보전 상태에 따라 형사·징계·보호조치가 함께 문제될 수 있습니다.",
      sourceStatus: "원문 확인 필요",
      requiredFacts: ["발언·행위의 일시와 장소", "피해자 진술 보호", "메신저·영상·목격자 등 원자료"]
    });
  }

  const civilIssues = hasCivilSignal ? [{
    issue: "불법행위 손해배상 가능성",
    legalBasis: "민법 제750조 등 불법행위 책임 관련 조문 - 법제처 원문 확인 필요",
    consequence: "치료비, 위자료, 재산상 손해는 위법행위, 손해, 인과관계, 과실 및 판례 경향을 확인해 판단합니다.",
    sourceStatus: "원문 확인 필요",
    requiredFacts: ["피해와 손해액 자료", "행위자와 피해 사이 인과관계", "학교·기관의 사전·사후 조치"]
  }] : [];

  return normalizeLegalConsequenceAssessment({
    applies: true,
    riskLevel: /성폭력|아동학대|상해|고소|고발|형사|소송/.test(normalized) ? "높음" : "보통",
    summary: "현재 입력 내용에는 형사 또는 민사 사건으로 확대될 수 있는 표현이 있어, 처벌·벌금·손해배상 가능성을 원문과 사실관계 기준으로 별도 확인해야 합니다.",
    criminalIssues,
    civilIssues,
    mitigationPlan: [
      {
        priority: "필수",
        action: "사실관계표를 시간순으로 작성하고 원자료를 보존합니다.",
        evidence: hasInjuryRecordNeed
          ? "상담기록, 문자·메신저 원본, 사진·영상, 진단서·치료기록, 목격자 메모"
          : "상담기록, 문자·메신저 원본, 사진·영상, 목격자 메모",
        why: "형사·민사 모두 행위, 피해, 인과관계, 고의·과실 판단의 출발점입니다.",
        legalBasis: "형법·민법·관련 특별법 조문과 판례 대조 필요"
      },
      {
        priority: "권고",
        action: "피해 회복 또는 재발방지 조치를 기록하되, 책임 인정 문구는 신중히 검토합니다.",
        evidence: "사과·정정·삭제·분리조치·상담지원·재발방지 안내 기록",
        why: "사후 조치는 분쟁 완화와 양형·배상 판단에 참고될 수 있으나, 사실과 다른 인정은 오히려 불리할 수 있습니다.",
        legalBasis: "양형·손해배상 관련 판례 확인 필요"
      },
      {
        priority: "선택",
        action: "유사 판례와 행정자료를 찾아 상담 질문지를 만듭니다.",
        evidence: "관련 판례 요지, 법령 원문 링크, 학교 규정·교육청 안내",
        why: "전문가 상담 시 쟁점을 좁히고 불필요한 과금을 줄이는 데 도움이 됩니다.",
        legalBasis: "법원 판례·법제처 원문 확인 필요"
      }
    ],
    sourceSearchQueries: buildLegalConsequenceSourceQueries(normalized),
    caution: "형량·벌금·손해배상 액수는 현재 보고서에서 단정하지 않고, 법제처 원문·판례·구체적 사실관계 확인 뒤 보강해야 합니다."
  });
}

function buildLegalConsequenceSourceQueries(normalized) {
  const queries = [];
  if (/폭행|상해/.test(normalized)) queries.push("형법 폭행 상해 법정형 판례");
  if (/명예훼손|모욕|비방|사이버|인스타그램|단체채팅/.test(normalized)) queries.push("형법 정보통신망법 명예훼손 모욕 판례");
  if (/아동학대|정서학대/.test(normalized)) queries.push("아동학대처벌법 아동복지법 생활지도 판례");
  if (/성폭력|성추행|불법촬영|성희롱/.test(normalized)) queries.push("성폭력처벌법 성희롱 징계 판례");
  if (/손해배상|민사|치료비|위자료|불법행위|배상/.test(normalized)) queries.push("민법 불법행위 손해배상 위자료 판례");
  return queries.length ? queries : ["형사 처벌 민사 손해배상 판례"];
}

function buildFinalAdvice(seed) {
  const text = [
    seed.context?.baseQuestion || "",
    ...(seed.context?.details || []).map((item) => `${item.question} ${item.answer}`),
    seed.injuryRecord || "",
    seed.workOrder || "",
    seed.firstResponse || "",
    seed.friendWork || ""
  ].join(" ");
  const normalized = compactText(text);
  const hasSeriousInjury = /골절|수술|입원|장해|중상|사망|119|응급|전치|후유|화상/.test(normalized);
  const hasLaborIssue = /산재|산업재해|임금|근로계약|해고|근로시간|노동위원회|직장|회사|사업장|노무|재계약|권고사직/.test(normalized)
    || ["employment", "apprenticeship", "fieldTraining", "schoolSafety", "staffLabor"].includes(seed.presetType);
  const hasLegalDispute = /소송|고소|고발|형사|손해배상|합의|민사|경찰|검찰|변호사|폭행|성폭력|성희롱|아동학대|명예훼손|보복|부당해고|권고사직|재계약불이익/.test(normalized);
  const hasProcedureOnly = !hasSeriousInjury && !hasLegalDispute && !seed.riskSignals?.length;

  if (seed.presetType === "fieldTrainingScopeIssue") {
    const scopeProfile = seed.scopeProfile || getFieldTrainingScopeProfile(text);
    const instructionActor = getFieldTrainingInstructorLabel(text);

    return {
      level: "internal",
      title: "학교 확인·기업 시정 요청 우선",
      summary: "현재 내용은 사고 처리보다 현장실습 업무 범위와 학생 권익보호를 확인할 사안입니다. 먼저 학교가 학생 상담기록을 남기고 기업 담당자에게 지시 권한과 실습 범위를 확인하는 것이 적절합니다.",
      actions: [
        "학생 상담기록, 실습협약서, 반복 지시 일지를 묶어 사실관계표를 만듭니다.",
        `기업 담당 멘토에게 ${instructionActor}의 지시 권한과 ${scopeProfile.instructionName}의 교육 목적을 확인합니다.`,
        "업무 범위 밖 반복 지시로 보이면 학교 명의로 지시 중단, 담당자 일원화, 학생 불이익 금지를 요청합니다."
      ],
      closingSentence: "현재 사안은 학교가 현장실습 업무 범위를 확인하고 기업에 시정 요청을 우선 진행하되, 보복·모욕·위험 작업 또는 장기간 반복이 확인되면 교육청 또는 노무 상담으로 상향 검토하겠습니다."
    };
  }

  if (seed.presetType === "schoolSafety" && !hasSeriousInjury && /예방|점검|아차사고|다친사람은?없|사고는?없|재발방지|관리체계/.test(normalized)) {
    return {
      level: "internal",
      title: "예방 점검과 개선 기록 우선",
      summary: "현재 내용은 사고 처리나 산재 상담보다 안전보건관리체계, 위험성평가, 위탁업체 점검, 개선 이행 기록을 정리할 사안입니다.",
      actions: [
        "아차사고 또는 위험 징후의 일시, 장소, 관련 업체, 즉시 개선 조치를 기록합니다.",
        "계약서, 과업지시서, 안전관리계획, 순회점검표, 개선 완료 사진을 점검 자료로 묶습니다.",
        "실제 부상, 중대한 인명피해, 입원, 수술 등 피해가 확인되면 그때 관계기관 보고와 전문가 상담 여부를 상향 검토합니다."
      ],
      closingSentence: "현재 사안은 안전보건 예방 점검과 재발방지 기록으로 내부 관리하되, 실제 인명피해나 보고 대상 사고가 확인되면 교육청·관계기관 보고 여부를 즉시 재검토하겠습니다."
    };
  }

  if (seed.presetType === "schoolAdministration") {
    return {
      level: "internal",
      title: "공식 지침과 내부 결재 흐름 확인 우선",
      summary: "현재 내용은 법적 책임 단정보다 학교회계, 학생생활기록, 공문·회의록 처리 기준을 공식자료와 학교 내부 문서로 맞춰 보는 단계입니다.",
      actions: [
        "예산·품의·계약·검수·지출·정산 또는 학생부 기재·정정 등 업무 단계를 먼저 표시합니다.",
        "관할 시도교육청 지침, 학교 내부 규정, 결재 문서, 증빙자료, 회의록을 함께 모읍니다.",
        "학생부는 2026학년도 기재요령과 학교생활기록 작성 및 관리지침, 회계는 학교회계 규칙과 예산편성 기본지침을 우선 대조합니다."
      ],
      closingSentence: "현재 사안은 공식 지침과 내부 결재·증빙 흐름을 먼저 확인하고, 감사·민원·소송 가능성이 구체화될 때 전문가 상담 범위를 별도로 정리하겠습니다."
    };
  }

  if (hasProcedureOnly) {
    return {
      level: "internal",
      title: "내부 안내와 기록 정리 우선",
      summary: "현재 입력된 내용만으로는 곧바로 노무사나 변호사 상담을 의뢰하기보다, 학교 내부 안내·학부모 전달·사실관계 기록 정리를 먼저 진행하는 것이 적절합니다.",
      actions: [
        "학부모에게 확인된 사실, 학교의 조치, 추가 확인 예정 사항을 간단히 안내합니다.",
        "상담일지, 안내 문자, 관련 자료를 보관하고 새 피해나 분쟁 조짐이 생기는지 관찰합니다.",
        "손해배상, 징계, 산재, 형사 문제로 확대되는 경우에만 전문가 상담 여부를 다시 검토합니다."
      ],
      closingSentence: "현재 확인된 내용은 학교 내부 기록으로 정리하고 학부모에게 안내하되, 추가 피해나 분쟁 가능성이 확인되면 별도 전문가 상담을 검토하겠습니다."
    };
  }

  if (hasLaborIssue && !hasLegalDispute) {
    if (["staffLabor", "employment", "apprenticeship"].includes(seed.presetType) && !hasSeriousInjury && !/산재|산업재해|안전사고/.test(normalized)) {
      return {
        level: "labor",
        title: "노무사 상담 우선 검토",
        summary: "계약, 복무, 임금, 재계약, 직장 내 괴롭힘처럼 노동관계 판단이 필요한 경우에는 사고 자료가 아니라 계약·지시·조치 기록을 중심으로 노무 상담을 검토하는 것이 적절합니다.",
        actions: [
          "근로계약서, 임용계약서, 복무 규정, 업무분장표, 임금·근무기록을 상담 자료로 묶습니다.",
          "문제가 된 발언·지시·통보의 일시, 장소, 상대방, 증인을 사실 중심으로 정리합니다.",
          "상담 목적은 책임 단정이 아니라 학교가 지금 해야 할 조치와 피해야 할 조치를 확인하는 것으로 정리합니다."
        ],
        referralSentence: "교직원·행정직 또는 취업 관련 노무 사안에 관하여 계약·복무·임금·재계약·직장 내 괴롭힘 해당 가능성과 학교의 후속 조치 범위를 확인하고자 합니다. 첨부한 계약서, 복무 기준, 상담기록, 발언·지시 내역을 검토하시고 현재 단계에서 필요한 조치에 대한 노무 상담을 요청드립니다."
      };
    }

    return {
      level: "labor",
      title: "노무사 상담 우선 검토",
      summary: "산재, 근로조건, 실습기업의 안전보건 조치, 산업재해 보고·보험 절차가 핵심이면 노무사 상담을 우선 검토하는 것이 도움이 됩니다. 다만 손해배상, 형사책임, 소송 가능성이 함께 보이면 변호사 상담도 병행해야 합니다.",
      actions: [
        "진단서, 사고경위서, 실습협약서, 안전교육 기록, 회사의 사고보고 자료를 묶어 상담 자료로 준비합니다.",
        "상담 목적은 책임 단정이 아니라 산재·보험·보고 절차와 학교/기업의 다음 조치를 확인하는 것으로 정리합니다.",
        "학생에게 불이익이 생기지 않도록 출결, 평가, 실습 중단·복귀 처리도 함께 문의합니다."
      ],
      referralSentence: "현장실습 중 발생한 사고와 관련하여 산재·보험·산업안전보건 절차 및 학교와 실습기업의 조치 범위를 확인하고자 합니다. 첨부한 진단서, 사고 경위, 현장실습 협약서, 안전교육 기록을 검토하시고 필요한 후속 조치에 대한 노무 상담을 요청드립니다."
    };
  }

  return {
    level: "legal",
    title: hasLaborIssue ? "노무사·변호사 병행 상담 검토" : "변호사 상담 검토",
    summary: hasLaborIssue
      ? "산재·노무 절차와 함께 손해배상, 형사 문제, 소송 가능성이 보이면 노무사와 변호사 상담을 나누어 진행하는 것이 안전합니다."
      : "징계, 학교폭력 심의, 손해배상, 형사 절차, 소송 가능성이 보이면 변호사 상담을 검토하는 것이 안전합니다.",
    actions: [
      "상담 전 사실관계표, 증빙자료 목록, 이미 진행된 학교·기관 조치를 한 장으로 정리합니다.",
      "원하는 결론보다 확인할 질문을 먼저 정리합니다. 예: 지금 해야 할 조치, 피해야 할 발언, 보존할 증거, 공식 절차.",
      "상담 결과는 학교 내부 조치와 학생 보호 계획에 반영하되, 당사자에게 불필요한 압박이 되지 않도록 공유 범위를 제한합니다."
    ],
    referralSentence: hasLaborIssue && hasSeriousInjury
      ? "현장실습 사고와 관련하여 산재·노무 절차, 손해배상 가능성, 학교와 실습기업의 책임 범위를 구분해 확인하고자 합니다. 첨부 자료를 검토하시고 노무사 및 변호사 상담이 필요한 쟁점과 우선 조치사항에 대한 의견을 요청드립니다."
      : hasLaborIssue
        ? "계약·복무·임금·재계약·직장 내 괴롭힘 또는 불리한 처우 가능성과 관련하여 학교의 사실 확인 절차와 후속 조치 범위를 검토하고자 합니다. 첨부한 계약서, 복무 기준, 상담기록, 발언·지시 내역을 바탕으로 현재 단계에서 필요한 노무·법률 검토 의견을 요청드립니다."
      : "본 사안과 관련하여 학교 절차, 당사자 권리 보호, 손해배상 또는 형사·소송 가능성을 검토하고자 합니다. 첨부한 사실관계표와 증빙자료를 바탕으로 현재 단계에서 필요한 법률상 조치와 유의사항에 대한 상담을 요청드립니다."
  };
}

function renderFinalAdvice(advice) {
  if (!advice) {
    return "";
  }

  const level = ["internal", "labor", "legal"].includes(advice.level) ? advice.level : "internal";
  const guidanceTitle = advice.referralSentence ? "상담 의뢰 문장 초안" : "내부 마무리 문장";
  const guidanceSentence = advice.referralSentence || advice.closingSentence || "";

  return `
    <div class="report-section report-final-advice ${level}">
      <h4>8. 최종 조언 및 상담 의뢰 판단</h4>
      <div class="final-advice-box">
        <span>${escapeHtml(advice.title)}</span>
        <p>${escapeHtml(advice.summary)}</p>
      </div>
      ${advice.actions?.length ? renderReportList(advice.actions, "checklist") : ""}
      ${guidanceSentence ? `
        <div class="referral-draft">
          <strong>${escapeHtml(guidanceTitle)}</strong>
          <p>${escapeHtml(guidanceSentence)}</p>
        </div>
      ` : ""}
    </div>
  `;
}

function renderExecutiveSummarySection(report) {
  return `
    <div class="report-section report-executive-section">
      <h4>1. 관리자 요약: 6하원칙 및 대처 방향</h4>
      <div id="reportExecutiveSummary">
        ${renderExecutiveSummaryContent(report)}
      </div>
    </div>
  `;
}

function renderExecutiveSummaryContent(report, profileContext = {}) {
  const rows = buildSixWRows(report, profileContext);
  const metaItems = [
    profileContext.documentNo ? `문서번호 ${profileContext.documentNo}` : "",
    profileContext.savedAtText ? `작성시각 ${profileContext.savedAtText}` : "",
    profileContext.schoolName ? `학교 ${profileContext.schoolName}` : "",
    profileContext.drafterName ? `작성·검토 ${profileContext.drafterName}` : ""
  ].filter(Boolean);

  return `
    <div class="admin-summary-card">
      <div>
        <span>Executive Summary</span>
        <p>${escapeHtml(report.lead)}</p>
      </div>
      ${metaItems.length ? `
        <div class="admin-summary-meta">
          ${metaItems.map((item) => `<small>${escapeHtml(item)}</small>`).join("")}
        </div>
      ` : ""}
    </div>
    <div class="sixw-grid">
      ${rows.map((row) => `
        <article>
          <strong>${escapeHtml(row.label)}</strong>
          <p>${escapeHtml(row.value)}</p>
        </article>
      `).join("")}
    </div>
    <div class="response-summary">
      <strong>관리자 우선 판단</strong>
      <p>${escapeHtml(buildManagerPriorityText(report, profileContext))}</p>
    </div>
    ${renderEducationOfficeDraft(report, profileContext)}
  `;
}

function buildSixWRows(report, profileContext = {}) {
  const baseQuestion = findReportFact(report, "원 질문") || report.title;
  const incidentDatePlace = profileContext.incidentDatePlace || findReportFact(report, "사고 시간") || "";
  const firstResponse = profileContext.currentStatus || findReportFact(report, "사고 직후") || report.immediateActions?.[0] || "";
  const workOrder = findReportFact(report, "작업 지시") || findReportFact(report, "친구 일을") || "";
  const studentInfo = [
    profileContext.studentLabel,
    profileContext.department,
    profileContext.teacherName ? `담당 ${profileContext.teacherName}` : "",
    profileContext.guardianContact ? `보호자 ${profileContext.guardianContact}` : ""
  ].filter(Boolean).join(" · ");
  const placeInfo = [
    profileContext.companyName,
    profileContext.companyContact,
    incidentDatePlace
  ].filter(Boolean).join(" · ");
  const periodInfo = [
    profileContext.trainingPeriod,
    profileContext.programName
  ].filter(Boolean).join(" · ");

  return [
    { label: "누가", value: studentInfo || `${report.audience || "관련 사용자"} · 학생·학교·보호자·실습기업 등 관련 주체 확인 필요` },
    { label: "언제", value: periodInfo || incidentDatePlace || "문제 발생 일시, 반복 기간, 실습기간 추가 확인 필요" },
    { label: "어디서", value: placeInfo || "실습 장소, 학교, 기업 내 관련 장소 추가 확인 필요" },
    { label: "무엇을", value: baseQuestion || "사용자가 입력한 사안 내용 확인 필요" },
    { label: "어떻게", value: firstResponse || "현재 조치, 학생 상담, 기업 확인, 보호자 안내 여부 추가 확인 필요" },
    { label: "왜 중요한가", value: workOrder || report.issueSummary?.[1] || "책임 판단 전 사실관계와 공식 원문 확인이 필요합니다." }
  ];
}

function buildManagerPriorityText(report, profileContext = {}) {
  const status = profileContext.currentStatus ? `현재 조치: ${profileContext.currentStatus}` : "";
  const note = profileContext.referenceNote ? `참고사항: ${profileContext.referenceNote}` : "";
  const actions = report.immediateActions?.slice(0, 2).join(" ") || "";
  return [status, note, actions].filter(Boolean).join(" ") || "학생 보호, 사실관계 기록, 공식 원문 확인, 보고 필요 여부 판단을 우선 진행합니다.";
}

function getReportSearchText(report, profileContext = {}) {
  return [
    report?.title,
    report?.subtitle,
    report?.lead,
    report?.audience,
    report?.facts?.map((item) => `${item.label} ${item.value}`).join(" "),
    report?.issueSummary?.join(" "),
    report?.immediateActions?.join(" "),
    profileContext.schoolName,
    profileContext.studentLabel,
    profileContext.companyName,
    profileContext.currentStatus,
    profileContext.referenceNote
  ].filter(Boolean).join(" ");
}

function isLikelyFieldTrainingAccident(report, profileContext = {}) {
  const text = compactText(getReportSearchText(report, profileContext));
  const compactTitle = compactText(report?.title || "");
  if (/업무범위|업무외지시|업무외반복지시|권익보호|반복지시|청소|잡무/.test(compactTitle) && !hasActualInjurySignal(text)) {
    return false;
  }
  return /현장실습|도제|직업계고|특성화고|실습기업|실습기관/.test(text)
    && (hasActualInjurySignal(text) || hasActualAccidentSignal(text) || /산재|산업재해|사고발생|사고가발생|사고났|사고남/.test(text));
}

function isLikelyFieldTrainingScopeIssue(report, profileContext = {}) {
  if (/업무범위|반복 지시|반복지시|청소|잡무/.test(report?.title || "")) {
    return true;
  }

  const text = compactText(getReportSearchText(report, profileContext));
  return /현장실습|실습생|실습기업|실습기관|직업계고|특성화고/.test(text)
    && /청소|잡무|업무범위|반복지시|반복|자꾸|시키|시킴|재료|심부름|권익침해|실습환경|기존근로자|생산량|목표|압박|평가불이익|불이익|야간|잔업|장시간/.test(text)
    && !hasActualInjurySignal(text);
}

function getReportDisposition(report, profileContext = {}) {
  const text = compactText(getReportSearchText(report, profileContext));
  const originalQuestionText = compactText([
    findReportFact(report, "원 질문"),
    profileContext.currentStatus,
    profileContext.referenceNote
  ].filter(Boolean).join(" "));
  const explicitEducationReport = /교육청보고|교육청에보고|교육청보고필요|공문보고/.test(text);
  const occurrenceNegated = hasOccurrenceNegation(text);
  const actualInjury = hasActualInjurySignal(text);
  const workerSafetyInjury = actualInjury && /근로자|조리실무사|교육공무직|외부업체|용역|공사|급식실|현장실습|실습생|산업체|사업장/.test(text);
  const seriousAccident = isLikelyFieldTrainingAccident(report, profileContext)
    || workerSafetyInjury
    || (!occurrenceNegated && /중대재해발생|사망|중상|골절|입원|수술|장해|119|응급|추락해사망|끼임사망/.test(text));

  if (isLikelyFieldTrainingScopeIssue(report, profileContext)) {
    if (/보복|불이익발생|불이익을받|불이익이발생|실제불이익|평가불이익|모욕|협박|따돌림|위험작업|위험|가동중인기계|장기간반복|시정거부|개선거부|생산량압박/.test(originalQuestionText) || explicitEducationReport) {
      return "education-review";
    }

    return "internal";
  }

  if (seriousAccident || explicitEducationReport) {
    return "education-report";
  }

  if (/소송|고소|고발|형사|손해배상|언론|성희롱|성폭력|아동학대|명예훼손|보복성|보복메시지|부당해고|권고사직|재계약불이익|해고|징계전|징계처분|부정행위/.test(text)
    && !/징계요구는?없|징계요구없|해고는?아니|해고없|해고통보없/.test(text)) {
    return "specialist";
  }

  return "internal";
}

function shouldRenderEducationOfficeDraft(report, profileContext = {}) {
  return getReportDisposition(report, profileContext) === "education-report";
}

function renderEducationOfficeDraft(report, profileContext = {}) {
  if (!shouldRenderEducationOfficeDraft(report, profileContext)) {
    return "";
  }

  const isFieldTrainingReport = /현장실습|실습기업|실습생/.test(getReportSearchText(report, profileContext));
  const schoolName = profileContext.schoolName || "학교명 확인 필요";
  const studentLabel = profileContext.studentLabel || "학생 성명 또는 식별명 확인 필요";
  const companyName = profileContext.companyName || "실습기업·기관 확인 필요";
  const incident = profileContext.incidentDatePlace || findReportFact(report, "사고 시간") || "발생 일시·장소 확인 필요";
  const currentStatus = profileContext.currentStatus || report.immediateActions?.[0] || (isFieldTrainingReport ? "치료, 보호자 통보, 실습 중단 여부 확인 필요" : "응급조치, 현장 보존, 관계기관 보고 여부 확인 필요");
  const teacherName = profileContext.teacherName || "담당·지도교사 확인 필요";
  const period = profileContext.trainingPeriod || "파견일자·실습기간 확인 필요";
  const program = profileContext.programName || "참여 사업명 확인 필요";
  const facts = report.facts?.slice(0, 3).map((item) => `${item.label}: ${item.value}`).join(" / ") || report.lead;
  const draftTitle = isFieldTrainingReport
    ? `[검토용] 현장실습 안전사고 발생 보고 초안 - ${schoolName} ${studentLabel}`
    : `[검토용] 학교 안전사고·중대재해 관련 보고 초안 - ${schoolName}`;
  const overview = isFieldTrainingReport
    ? `${schoolName} 소속 ${studentLabel} 관련 현장실습 안전사고로, 학생 보호와 사실관계 확인을 우선 진행 중입니다.`
    : `${schoolName} 관련 학교 안전사고 또는 중대재해 의심 사안으로, 피해자 보호·현장 보존·관계기관 보고 필요 여부를 확인 중입니다.`;
  const relatedParties = isFieldTrainingReport
    ? `학생: ${studentLabel} / 담당: ${teacherName} / 실습기업: ${companyName} / 실습기간: ${period} / 참여사업: ${program}`
    : `학교: ${schoolName} / 담당: ${teacherName} / 관련 업체·기관: ${companyName} / 관련 기간: ${period} / 관련 사업: ${program}`;
  const issueText = isFieldTrainingReport
    ? "공식 현장실습 범위 안의 사고인지, 학생이 허락받은 작업을 했는지, 안전교육·작업지시·감독·방호조치·산재 보고 대상 여부를 확인 중입니다."
    : "사고 발생 장소, 피해자 소속, 도급·용역·위탁 관계, 안전보건관리체계, 재발방지 조치, 관계기관 보고 대상 여부를 확인 중입니다.";
  const nextAction = isFieldTrainingReport
    ? "교육청 보고 필요 여부 검토, 학생 치료와 보호자 안내, 현장 보존 요청, 증빙자료 확보, 실습 중단·복귀 계획 검토가 필요합니다."
    : "교육청·고용노동부 등 관계기관 보고 필요 여부 검토, 피해자 보호, 현장 보존, 사고 경위 기록, 재발방지 대책 수립이 필요합니다.";

  const rows = [
    { label: "수신", value: "관할 교육청 직업교육·현장실습 담당부서" },
    { label: "제목", value: draftTitle },
    { label: "1. 보고 개요", value: overview },
    { label: "2. 발생 일시·장소", value: incident },
    { label: "3. 관련 주체", value: relatedParties },
    { label: "4. 사고 경위", value: facts },
    { label: "5. 즉시 조치", value: currentStatus },
    { label: "6. 확인 중인 쟁점", value: issueText },
    { label: "7. 요청·향후 조치", value: nextAction }
  ];

  return `
    <div class="education-office-draft">
      <div>
        <strong>교육청 보고 초안</strong>
        <span>관리자 검토 후 공문·보고서 양식에 맞춰 조정</span>
      </div>
      <dl>
        ${rows.map((row) => `
          <div>
            <dt>${escapeHtml(row.label)}</dt>
            <dd>${escapeHtml(row.value)}</dd>
          </div>
        `).join("")}
      </dl>
    </div>
  `;
}

function findReportFact(report, labelPart) {
  const item = report.facts?.find((fact) => fact.label.includes(labelPart));
  return item?.value || "";
}

function renderFactProfileContextContent(profileContext = {}) {
  const groups = [
    {
      title: "학교·담당",
      value: [profileContext.schoolName, profileContext.teacherName, profileContext.drafterName].filter(Boolean).join(" · ")
    },
    {
      title: "학생·보호자",
      value: [profileContext.studentLabel, profileContext.department, profileContext.studentContact, profileContext.guardianContact].filter(Boolean).join(" · ")
    },
    {
      title: "실습·기업",
      value: [profileContext.companyName, profileContext.companyContact, profileContext.trainingPeriod, profileContext.programName].filter(Boolean).join(" · ")
    },
    {
      title: "현재 현황·참고사항",
      value: [profileContext.currentStatus, profileContext.referenceNote].filter(Boolean).join(" · ")
    }
  ].filter((item) => item.value);

  if (!groups.length) {
    return "";
  }

  return `
    <div class="report-context-block">
      ${groups.map((item) => `
        <article>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.value)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderStakeholderProfileContextContent(profileContext = {}) {
  const items = [
    profileContext.teacherName ? `학교 담당자: ${profileContext.teacherName}` : "",
    profileContext.companyContact ? `기업 담당자: ${profileContext.companyContact}` : "",
    profileContext.guardianContact ? `보호자 연락처: ${profileContext.guardianContact}` : "",
    profileContext.currentStatus ? `현재 조치: ${profileContext.currentStatus}` : ""
  ].filter(Boolean);

  if (!items.length) {
    return "";
  }

  return `
    <div class="stakeholder-context-note">
      <strong>입력 정보 반영</strong>
      <p>${escapeHtml(items.join(" · "))}</p>
    </div>
  `;
}

function buildEvidenceGroups(report) {
  if (isLikelyFieldTrainingScopeIssue(report)) {
    const scopeText = findReportFact(report, "원 질문") || report.lead || report.title;
    const scopeProfile = getFieldTrainingScopeProfile(scopeText);
    const instructionActor = getFieldTrainingInstructorLabel(scopeText);
    const safetyItems = /위험|기계|설비|화학|분진|보호구|유해|안전/.test(compactText(scopeText || ""))
      ? [
          {
            title: "업무 지시 장소의 안전 위험 확인 자료",
            reason: "지시된 업무가 기계, 화학물질, 분진, 날카로운 물체 등 위험요소와 연결되면 단순 업무범위를 넘어 안전 문제도 됩니다.",
            how: "위험구역 여부, 보호구, 안전교육, 감독자 배치 여부를 기업 담당자에게 확인합니다.",
            basis: formatLegalBasis(["oshSafetyMeasures", "fieldTrainingSafetyEducation"])
          }
        ]
      : [];

    return [
      {
        priority: "required",
        title: "필수 확인",
        description: "학생 보호와 시정 요청을 위해 먼저 확인해야 할 자료입니다. 의료·산재 자료가 아니라 업무 범위와 지시 체계 자료가 핵심입니다.",
        items: [
          {
            title: "현장실습계약서·표준협약서·실습계획서",
            reason: `${scopeProfile.instructionName}이 실습 직무와 교육 목적 안에 포함되는지 판단하는 기준 자료입니다.`,
            how: "학교 취업부·현장실습 담당자, 학생 보관본, 기업 보관본을 대조하고 실제 지시 내용과 다른 부분을 표시합니다.",
            basis: formatLegalBasis(["fieldTrainingContract"])
          },
          {
            title: "학생 상담기록과 지시 사실관계표",
            reason: "반복성, 지시자, 업무 관련성, 학생의 불이익 우려를 사실 중심으로 확인합니다.",
            how: "지도교사 또는 현장실습 담당자가 학생 면담 후 일시·장소·지시자·내용·소요시간을 표로 정리합니다.",
            basis: formatLegalBasis(["fieldTrainingOperation", "fieldTrainingSafetyEducation"])
          },
          {
            title: "기업 담당 멘토·지시 권한 확인 자료",
            reason: `${instructionActor}가 현장실습생에게 직접 지시할 권한이 있었는지, 지시 체계가 정해져 있었는지 확인합니다.`,
            how: `학교가 기업 담당자에게 담당 멘토, 지시 권한자, ${scopeProfile.instructionName}의 교육 목적을 서면 또는 상담기록으로 확인합니다.`,
            basis: formatLegalBasis(["fieldTrainingCompanyDuty", "fieldTrainingContract"])
          }
        ]
      },
      {
        priority: "recommended",
        title: "권고",
        description: "시정 요청과 재발 방지에 도움이 큰 자료입니다.",
        items: [
          {
            title: "실습일지·작업표·메신저·사진",
            reason: `${scopeProfile.instructionName}이 실제로 있었는지, 실습 내용과 얼마나 벗어났는지 보여줍니다.`,
            how: "학생 실습일지, 작업표, 메신저, 현장 사진을 모으되 개인정보와 영업기밀은 필요한 범위만 가립니다.",
            basis: formatLegalBasis(["fieldTrainingOperation", "fieldTrainingContract"])
          },
          {
            title: "학교의 기업 확인·시정 요청 기록",
            reason: "학교가 문제를 인지한 뒤 어떤 조치를 했는지, 기업이 개선 의사를 보였는지 남기는 자료입니다.",
            how: "통화기록, 상담일지, 공문, 이메일, 순회지도 기록에 기업 답변과 후속 조치를 함께 적습니다.",
            basis: formatLegalBasis(["fieldTrainingOperation", "fieldTrainingCompanyDuty"])
          },
          ...safetyItems
        ]
      },
      {
        priority: "optional",
        title: "선택",
        description: "있으면 이해에 도움이 되지만, 없다고 곧바로 불리하다고 보기는 어려운 자료입니다.",
        items: [
          {
            title: "학생·보호자 개인 메모",
            reason: "학생이 느낀 부담감, 반복 시점, 불이익 우려를 상담 전에 정리하는 데 도움이 됩니다.",
            how: "감정 표현과 사실을 구분해 적고, 보고서에는 확인 가능한 사실 위주로 반영합니다.",
            basis: "상담 참고자료 - 공식 판단은 계약서, 실습일지, 학교·기업 확인 기록을 우선합니다."
          },
          {
            title: "직장 내 괴롭힘 검토 메모",
            reason: "반복 지시가 모욕, 보복, 따돌림, 업무상 적정범위 초과와 연결될 때만 보조적으로 검토합니다.",
            how: "지시자의 지위, 반복성, 필요성, 학생의 고통·실습환경 악화 여부를 따로 적습니다.",
            basis: formatLegalBasis(["laborHarassmentBan", "laborHarassmentAction"])
          }
        ]
      }
    ];
  }

  if (!isLikelyFieldTrainingAccident(report)) {
    return [
      {
        priority: "recommended",
        title: "권고",
        description: "사안 판단에 도움이 큰 자료입니다. 원본 보관자와 확보 경로를 함께 기록합니다.",
        items: (report.evidence || []).map((item) => {
          const text = typeof item === "string" ? item : item.text;
          return {
          title: text,
          reason: "질문 내용과 관련된 사실관계를 확인하는 데 도움이 됩니다.",
          how: "학교 담당자, 관련 기관, 당사자 보관 자료 중 원본 또는 사본 확보 가능 여부를 확인합니다.",
          basis: getInlineBasisForText(text, report)
        };
        })
      }
    ];
  }

  return [
    {
      priority: "required",
      title: "필수 확인",
      description: "법적 판단을 단정하기 위한 필수 증거라는 뜻이 아니라, 보고·보호·산재 대상 여부를 판단하기 위해 먼저 확인해야 할 자료입니다.",
      items: [
        {
          title: "현장실습계약서·표준협약서",
          reason: "공식 실습 범위, 실습 내용, 기간·시간, 권리·의무와 실제 작업 지시가 맞는지 확인합니다.",
          how: "학교 취업부·현장실습 담당자, 학생 보관본, 실습기업 보관본을 각각 확인해 서명일자와 내용이 같은지 대조합니다.",
          basis: formatLegalBasis(["fieldTrainingContract"])
        },
        {
          title: "현장실습 운영계획·산업체 선정·학생 배치 기록",
          reason: "실습기업 선정과 학생 배치가 전공, 프로그램, 시설·설비, 안전 여건을 고려해 이루어졌는지 확인합니다.",
          how: "학교 현장실습 운영계획, 산업체 선정 심의·점검 자료, 배치표, 지도교사 방문·순회지도 기록을 학교 내부 자료에서 확보합니다.",
          basis: formatLegalBasis(["fieldTrainingOperation", "fieldTrainingCompanySelection"])
        },
        {
          title: "현장실습 안전교육 및 노동인권·권익보호 교육 기록",
          reason: "사고 전 학교와 기업이 어떤 안전교육을 했는지, 학생이 교육을 실제로 받았는지 확인합니다.",
          how: "교육일자, 교육자료, 서명부, LMS 이수내역, 교육 담당자 기록을 학교와 실습기업 양쪽에서 확인합니다.",
          basis: formatLegalBasis(["fieldTrainingSafetyEducation", "oshEducation"])
        },
        {
          title: "산업재해조사표 제출 대상 여부 확인 자료",
          reason: "사망 또는 3일 이상 휴업이 필요한 부상·질병인지가 확인되면 산업재해조사표 제출 대상이 될 수 있습니다.",
          how: "진단서·휴업 예상기간, 회사 사고보고서, 관할 지방고용노동관서 제출 여부를 실습기업에 확인하고 학교 기록에 남깁니다.",
          basis: formatLegalBasis(["oshAccidentReport", "oshAccidentReportRule"])
        },
        {
          title: "교육청 보고 필요 여부 판단 자료",
          reason: "현장실습 중 안전사고는 학생 보호, 실습 중단, 민원 대응, 교육청 보고 필요성을 관리자와 즉시 검토해야 합니다.",
          how: "관할 교육청 현장실습 매뉴얼, 학교 내부 보고 기준, 관리자 결재라인, 보호자 안내 기록을 확인합니다.",
          basis: formatLegalBasis(["fieldTrainingOperation", "fieldTrainingCompanyDuty"])
        }
      ]
    },
    {
      priority: "recommended",
      title: "권고",
      description: "책임 판단과 재발방지에 큰 도움이 되는 자료입니다. 가능한 한 조기에 원본 보존을 요청합니다.",
      items: [
        {
          title: "진단서·응급실 기록·치료비 영수증·향후 치료 소견",
          reason: "부상 정도, 휴업·치료 기간, 산재·보험·학교안전공제 절차 검토의 기준 자료입니다.",
          how: "학생·보호자 동의를 받아 의료기관 발급 자료를 확보하고, 개인정보가 포함되므로 열람·보관 권한을 제한합니다.",
          basis: formatLegalBasis(["oshAccidentReportRule"])
        },
        {
          title: "사고경위 시간표·목격자 진술·CCTV 보존 요청",
          reason: "누가 지시했는지, 공식 업무였는지, 사고 당시 현장상황이 어땠는지 확인하는 핵심 자료입니다.",
          how: "학교는 학생·목격자 상담기록을 남기고, 기업에는 CCTV·출입기록·현장 사진 보존을 서면으로 요청합니다.",
          basis: formatLegalBasis(["fieldTrainingOperation", "oshSafetyMeasures"])
        },
        {
          title: "출퇴근 기록·실습일지·작업지시 내역",
          reason: "사고가 실습시간 안에서 발생했는지, 학생이 허락받은 작업을 했는지 확인합니다.",
          how: "학생 실습일지, 기업 출입·근태 기록, 메신저·구두지시 기록, 지도교사 상담기록을 시간순으로 모읍니다.",
          basis: formatLegalBasis(["fieldTrainingTime", "fieldTrainingContract"])
        },
        {
          title: "기계 방호장치 사진·작업표준서·위험성평가·보호구 지급 자료",
          reason: "기계 사고에서는 방호조치, 작업방법, 감독, 보호구 지급 여부가 책임 판단의 중심 자료가 됩니다.",
          how: "실습기업 안전보건 담당자에게 사고 기계 사진, 점검표, 작업표준서, 위험성평가, 보호구 지급대장을 요청합니다.",
          basis: formatLegalBasis(["oshSafetyMeasures", "oshMachineGuard"])
        }
      ]
    },
    {
      priority: "optional",
      title: "선택",
      description: "있으면 사안 이해와 소통에 도움이 되지만, 없다고 해서 곧바로 불리하다고 보기는 어려운 자료입니다.",
      items: [
        {
          title: "학생·보호자 개인 메모, 통화·문자 기록",
          reason: "학교, 기업, 보호자 사이의 안내와 요청 경과를 시간순으로 정리하는 데 도움이 됩니다.",
          how: "학생·보호자가 보관한 문자, 통화일지, 상담 메모를 필요한 범위에서만 정리하고 민감정보는 가립니다.",
          basis: "기록 보존 목적의 참고자료 - 공식 보고서에는 사실 확인이 가능한 내용만 반영합니다."
        },
        {
          title: "유사 안전교육 자료·OPS·교안",
          reason: "사고 후 재발방지 교육과 학생 복귀 전 안전교육 계획을 보강하는 데 도움이 됩니다.",
          how: "안전보건공단 자료실, 고용노동부·교육부 자료, 학교 보유 교안을 찾아 사고 공정과 직접 관련 있는 자료만 첨부합니다.",
          basis: formatLegalBasis(["oshSafetyMeasures", "fieldTrainingSafetyEducation"])
        },
        {
          title: "복귀·실습중단·평가 처리 협의 기록",
          reason: "학생에게 출결·평가·실습 이수상 불이익이 생기지 않도록 사후 조치 경과를 남깁니다.",
          how: "담임, 취업지도부, 관리자, 보호자 협의 내용을 회의록이나 상담기록으로 남기고 학교 규정에 따라 보관합니다.",
          basis: formatLegalBasis(["fieldTrainingOperation"])
        }
      ]
    }
  ];
}

function renderEvidenceItems(report) {
  const groups = buildEvidenceGroups(report).filter((group) => group.items?.length);

  return `
    <div class="evidence-groups">
      ${groups.map((group) => `
        <section class="evidence-category ${escapeHtml(group.priority)}">
          <div class="evidence-category-head">
            <span class="evidence-priority ${escapeHtml(group.priority)}">${escapeHtml(group.title)}</span>
            <p>${escapeHtml(group.description)}</p>
          </div>
          <div class="evidence-items">
            ${group.items.map((item) => `
              <article>
                <h5>${escapeHtml(item.title)}</h5>
                <p>${escapeHtml(item.reason)}</p>
                <dl>
                  <div>
                    <dt>확보 방법</dt>
                    <dd>${escapeHtml(item.how)}</dd>
                  </div>
                  ${item.basis ? `
                    <div>
                      <dt>근거·확인 조문</dt>
                      <dd>${escapeHtml(item.basis)}</dd>
                    </div>
                  ` : ""}
                </dl>
              </article>
            `).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function renderLegalConsequenceAssessment(assessment) {
  if (!assessment?.applies) {
    return "";
  }

  const issueCards = [
    ...(assessment.criminalIssues || []).map((item) => ({ ...item, type: "형사" })),
    ...(assessment.civilIssues || []).map((item) => ({ ...item, type: "민사" }))
  ].slice(0, 5);
  const mitigation = (assessment.mitigationPlan || []).slice(0, 5);

  return `
    <div class="report-section legal-consequence-section">
      <h4>3-3. 형사·민사 전환 가능성</h4>
      <p class="report-section-note">${escapeHtml(assessment.summary || "형사·민사 가능성은 원문과 사실관계 확인 후 판단해야 합니다.")}</p>
      <div class="report-api-head">
        <strong>위험도</strong>
        <span class="${/높음|즉시/.test(assessment.riskLevel || "") ? "needs-review" : "verified"}">${escapeHtml(assessment.riskLevel || "확인 필요")}</span>
      </div>
      ${issueCards.length ? `
        <div class="report-mini-list">
          ${issueCards.map((item) => `
            <article class="report-mini-card">
              <span class="student-case-badge">${escapeHtml(item.type)} · ${escapeHtml(item.sourceStatus || "원문 확인 필요")}</span>
              <b>${escapeHtml(item.issue)}</b>
              <p>${escapeHtml(item.consequence)}</p>
              <em>법적 근거: ${escapeHtml(item.legalBasis || "원문 확인 필요")}</em>
              ${item.requiredFacts?.length ? `<em>확인할 사실: ${escapeHtml(item.requiredFacts.join(" · "))}</em>` : ""}
            </article>
          `).join("")}
        </div>
      ` : ""}
      ${mitigation.length ? `
        <div class="evidence-items">
          <h5>감경·감량 또는 책임 완화 준비자료</h5>
          ${mitigation.map((item) => `
            <article>
              <span class="evidence-priority ${escapeHtml(item.priority === "필수" ? "required" : item.priority === "선택" ? "optional" : "recommended")}">${escapeHtml(item.priority || "권고")}</span>
              <h5>${escapeHtml(item.action)}</h5>
              <p>${escapeHtml(item.why || "")}</p>
              <dl>
                <div>
                  <dt>준비 자료</dt>
                  <dd>${escapeHtml(item.evidence || "관련 원자료와 상담 기록")}</dd>
                </div>
                <div>
                  <dt>근거·판례 확인</dt>
                  <dd>${escapeHtml(item.legalBasis || "원문·판례 확인 필요")}</dd>
                </div>
              </dl>
            </article>
          `).join("")}
        </div>
      ` : ""}
      ${assessment.sourceSearchQueries?.length ? `
        <div class="search-keywords" aria-label="형사 민사 확인 검색어">
          ${assessment.sourceSearchQueries.map((keyword) => `<code>${escapeHtml(keyword)}</code>`).join("")}
        </div>
      ` : ""}
      ${assessment.caution ? `<p class="report-disclaimer">${escapeHtml(assessment.caution)}</p>` : ""}
    </div>
  `;
}

function renderOfficialArticleBrief(report = {}) {
  const references = selectReportOfficialArticleReferences(report, 4);
  if (!references.length) {
    return "";
  }

  return `
    <div class="report-section report-official-article-brief">
      <h4>3-1. 공식 조문 확인 요약</h4>
      <p class="report-section-note">법제처 원문 API에서 확인된 조문만 표시합니다. 조문이 없거나 맞지 않으면 단정하지 않고 원문 확인 필요로 남깁니다.</p>
      <div class="report-mini-list">
        ${references.map((reference) => {
          const url = safeUrl(reference.url);
          return `
            <article class="report-mini-card">
              <span class="student-case-badge">법제처 원문 확인</span>
              <b>${escapeHtml(reference.label)}</b>
              <p>${escapeHtml(getOfficialArticleUse(reference))}</p>
              ${reference.text ? `<em>${escapeHtml(summarizeOfficialArticleText(reference.text))}</em>` : ""}
              ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">원문 확인</a>` : ""}
            </article>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function selectReportOfficialArticleReferences(report = {}, limit = 4) {
  const references = report.liveSourceReferences?.length
    ? report.liveSourceReferences
    : buildLiveSourceReferences(report.officialSourceContext || {});
  const reportText = compactText([
    report.title,
    report.subtitle,
    report.lead,
    ...(report.issueSummary || []),
    ...(report.immediateActions || [])
  ].filter(Boolean).join(" "));
  const deduped = [];
  const seen = new Set();

  for (const reference of references) {
    const label = normalizeReportText(reference.label || formatLiveArticleCitation(reference));
    if (!label || /조문번호 확인 필요/.test(label) || seen.has(label)) {
      continue;
    }
    seen.add(label);
    deduped.push({
      ...reference,
      label,
      score: scoreLiveSourceReference(reference, reportText)
    });
  }

  const scored = deduped
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "ko-KR"));
  const fallback = deduped
    .filter((item) => item.score <= 0)
    .sort((left, right) => left.label.localeCompare(right.label, "ko-KR"));

  return [...scored, ...fallback].slice(0, limit);
}

function getOfficialArticleUse(reference = {}) {
  const text = compactText([reference.label, reference.articleTitle, reference.text].filter(Boolean).join(" "));
  if (/현장실습시간|1일7시간|1주일35시간|야간|휴일|연장/.test(text)) {
    return "실습시간, 실습 종료 후 지시, 야간·휴일 실습 여부를 판단할 때 우선 대조합니다.";
  }
  if (/계약|협약|현장실습계약|권리|의무|실습계획/.test(text)) {
    return "실습계약·표준협약서와 실제 지시 내용이 맞는지 확인할 때 사용합니다.";
  }
  if (/현장실습산업체|선정|실습기업|시설|설비|후생복지/.test(text)) {
    return "실습기업의 선정·관리와 실습환경 적정성을 확인할 때 사용합니다.";
  }
  if (/지도점검|자료제출|보고|현장조사|교육부장관|고용노동부장관|교육감/.test(text)) {
    return "학교·기업 확인, 지도·점검, 관계기관 보고 필요성을 검토할 때 사용합니다.";
  }
  if (/벌칙|징역|벌금|과태료|처한다/.test(text)) {
    return "형사·행정 제재 가능성은 이 조문과 사실관계를 함께 확인해야 합니다.";
  }
  if (/학교폭력|피해학생|가해학생|전담기구|심의/.test(text)) {
    return "학교폭력 접수, 보호조치, 심의 절차를 확인할 때 우선 대조합니다.";
  }
  return "이 사안과 관련된 공식 법령 조문으로, 적용 여부는 사실관계와 원문을 함께 대조합니다.";
}

function summarizeOfficialArticleText(value = "") {
  const text = normalizeReportText(value).replace(/^제\d+조(?:의\d+)?(?:\([^)]*\))?\s*/, "");
  if (text.length <= 180) {
    return text;
  }
  return `${text.slice(0, 180).trim()}...`;
}

function normalizeReportText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function renderInterpretationAndCaseBrief(report = {}) {
  const precedentItems = selectReportPrecedentItems(report, 3);
  const interpretationItems = selectReportInterpretationItems(report, 4);
  const caseStatus = buildCaseLawStatus(report, precedentItems.length);
  if (!precedentItems.length && !interpretationItems.length && !caseStatus.show) {
    return "";
  }

  return `
    <div class="report-section report-interpretation-brief">
      <h4>3-2. 판례·행정해석 확인 상태</h4>
      <p class="report-section-note">행정해석·교육부 기준자료는 쟁점 판단의 보조자료입니다. 판례·법률자료는 사법정보공유포털 또는 국회법률도서관 등 승인된 공식 API 결과가 있을 때만 구체적으로 표시합니다.</p>
      ${precedentItems.length ? `
        <div class="report-mini-list">
          ${precedentItems.map((item) => {
            const url = safeUrl(item.url);
            return `
              <article class="report-mini-card">
                <span class="student-case-badge">공식 판례</span>
                <b>${escapeHtml(item.title)}</b>
                <p>${escapeHtml(item.summary || "공식 API에서 확인된 판례·법률자료 후보입니다. 사안과의 유사성은 사실관계 대조 후 판단합니다.")}</p>
                <small>${escapeHtml([item.courtName, item.caseNumber, item.date, item.caseType].filter(Boolean).join(" · ") || item.source)}</small>
                ${item.relatedLaws.length ? `<em>참조 법령: ${escapeHtml(item.relatedLaws.join(", "))}</em>` : ""}
                ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">원문 확인</a>` : ""}
              </article>
            `;
          }).join("")}
        </div>
      ` : ""}
      ${interpretationItems.length ? `
        <div class="report-mini-list">
          ${interpretationItems.map((item) => {
            const url = safeUrl(item.url);
            return `
              <article class="report-mini-card">
                <span class="student-case-badge">${escapeHtml(item.groupLabel)}</span>
                <b>${escapeHtml(item.title)}</b>
                <p>${escapeHtml(item.use)}</p>
                ${item.summary ? `<em>${escapeHtml(item.summary)}</em>` : ""}
                <small>${escapeHtml(item.source)}${item.date ? ` · ${escapeHtml(item.date)}` : ""}${item.status ? ` · ${escapeHtml(item.status)}` : ""}</small>
                ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">원문 확인</a>` : ""}
              </article>
            `;
          }).join("")}
        </div>
      ` : `
        <p class="report-section-note">현재 질문과 직접 연결된 공식 행정해석 후보는 아직 없습니다.</p>
      `}
      ${caseStatus.show ? `
        <div class="report-api-relevance">
          <strong>${escapeHtml(caseStatus.title)}</strong>
          <p>${escapeHtml(caseStatus.message)}</p>
          ${caseStatus.queries.length ? `<small>확인 검색어: ${escapeHtml(caseStatus.queries.join(", "))}</small>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function selectReportInterpretationItems(report = {}, limit = 4) {
  const results = report.officialSourceContext?.results || {};
  const groups = [
    {
      groupLabel: "법령해석례",
      items: results.interpretations,
      use: "법령 적용 방향을 확인하는 보조자료입니다. 조문 원문과 사실관계에 맞는지 함께 대조합니다."
    },
    {
      groupLabel: "교육부 법령해석",
      items: results.educationInterpretations,
      use: "교육 분야 쟁점에서 교육부 해석 방향을 확인하는 보조자료입니다."
    },
    {
      groupLabel: "교육부 공식 기준자료",
      items: results.educationAdminRules,
      use: "학교 실무에 참고할 행정규칙·고시·훈령 후보입니다. 판례나 법령해석으로 바꾸어 부르지 않습니다."
    }
  ];

  return groups
    .flatMap((group) => normalizeReportSourceItems(group.items)
      .map((item) => ({
        ...item,
        groupLabel: group.groupLabel,
        use: group.use,
        sortScore: Number(item.relevance?.score || 0) + (item.current ? 20 : 0)
      })))
    .sort((left, right) =>
      right.sortScore - left.sortScore ||
      getApiComparableDate(right.date) - getApiComparableDate(left.date) ||
      left.title.localeCompare(right.title, "ko-KR")
    )
    .slice(0, limit);
}

function selectReportPrecedentItems(report = {}, limit = 3) {
  const precedents = normalizeReportPrecedentItems(report.officialSourceContext?.results?.precedents || []);
  return precedents
    .sort((left, right) =>
      getApiComparableDate(right.date) - getApiComparableDate(left.date) ||
      left.title.localeCompare(right.title, "ko-KR")
    )
    .slice(0, limit);
}

function normalizeReportPrecedentItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      title: normalizeReportText(item.title || item.caseName || item.summary || "판례 제목 확인 필요"),
      source: normalizeReportText(item.source || "공식 판례·법률자료 API"),
      courtName: normalizeReportText(item.courtName || item.court || ""),
      caseNumber: normalizeReportText(item.caseNumber || item.caseNo || ""),
      date: normalizeReportText(item.decisionDate || item.date || item.sentencedAt || ""),
      caseType: normalizeReportText(item.caseType || item.type || ""),
      summary: normalizeReportText(item.summary || item.holding || item.abstract || "").slice(0, 260),
      relatedLaws: uniqueStrings([...(item.relatedLaws || []), ...(item.referencedLaws || [])]).slice(0, 4),
      url: item.url || item.sourceUrl || ""
    }))
    .filter((item) => item.title && !item.title.includes("확인 필요"));
}

function normalizeReportSourceItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      title: normalizeReportText(item.title || item.subtitle || "제목 없음"),
      source: normalizeReportText(item.source || "공식 출처"),
      date: normalizeReportText(item.date || item.effectiveDate || ""),
      status: normalizeReportText(item.currentStatus || item.reliability?.label || item.reliability || ""),
      summary: normalizeReportText(item.summary || item.subtitle || "").slice(0, 220),
      url: item.url || "",
      current: Boolean(item.current),
      relevance: item.relevance || null
    }))
    .filter((item) => item.title && !item.title.includes("제목 없음"));
}

function buildCaseLawStatus(report = {}, precedentCount = 0) {
  const sourceContext = report.officialSourceContext || {};
  const status = sourceContext.status || {};
  const queryText = [
    report.title,
    report.lead,
    report.subtitle,
    ...(report.sourceSearchQueries || []),
    report.legalConsequenceAssessment?.summary || "",
    report.legalConsequenceAssessment?.riskLevel || ""
  ].filter(Boolean).join(" ");
  const needsCaseLaw = /판례|형사|민사|손해배상|위자료|징역|벌금|과태료|고소|고발|폭행|상해|명예훼손|모욕|아동학대|성폭력|직장내괴롭힘|부당해고|징계|소송/.test(compactText(queryText));
  const queries = uniqueStrings([
    ...(report.sourceSearchQueries || []),
    ...(report.legalConsequenceAssessment?.sourceSearchQueries || [])
  ]).filter((query) => /판례|형사|민사|손해배상|징역|벌금|처벌|위자료/.test(query)).slice(0, 4);

  if (!needsCaseLaw && !queries.length) {
    return { show: false, title: "", message: "", queries: [] };
  }

  if (precedentCount > 0) {
    return {
      show: true,
      title: "공식 판례 결과 반영",
      message: "위 카드는 국회법률도서관 또는 승인된 공식 판례 결과 슬롯에 들어온 자료만 표시합니다. 사안 적용 여부는 사건의 사실관계, 조문, 행정자료와 함께 대조해야 합니다.",
      queries
    };
  }

  if (status.scourt || status.nanet) {
    return {
      show: true,
      title: "판례 공식 API 연결 준비 상태",
      message: "판례·법률자료 API 키는 감지되었지만, 현재 보고서 본문에는 공식 결과가 도착한 경우에만 사건명·법원·선고일·요지를 표시합니다. 결과가 없으면 판례 내용을 추정하지 않습니다.",
      queries
    };
  }

  return {
    show: true,
    title: "공식 판례 API 미연결",
    message: "현재 보고서에는 사법정보공유포털 또는 국회법률도서관 공식 결과가 도착한 경우에만 판례·법률자료 후보를 표시합니다. 결과가 없으면 형량, 벌금, 손해배상액, 판례 경향을 단정하지 않고 판례 확인 필요 상태로 남깁니다.",
    queries
  };
}

function renderCaseReport(report) {
  return `
    <section class="case-report" id="caseReport" aria-label="사안 보고서">
      <div class="report-cover">
        <div>
          <p class="report-kicker">PRINTABLE REPORT</p>
          <h3>${escapeHtml(report.title)}</h3>
          <p>${escapeHtml(report.subtitle)}</p>
          ${renderReportCostMeta(report)}
        </div>
        <div class="report-actions">
          <span>${escapeHtml(report.generatedAt)}</span>
          <button type="button" data-save-report>자료실 저장</button>
          <button type="button" data-download-report>HTML 저장</button>
          <button type="button" data-print-report>보고서 인쇄</button>
        </div>
      </div>

      ${renderReportComposer(report)}

      <div class="report-section report-executive-section">
        <h4>1. 상황 요약</h4>
        <div id="reportExecutiveSummary">
          ${renderSimpleSituationSummary(report)}
        </div>
      </div>

      <div class="report-section">
        <h4>2. 사안 파악</h4>
        <div id="reportFactProfileContext"></div>
        ${renderSimpleFacts(report)}
      </div>

      <div class="report-section">
        <h4>3. 핵심 판단 포인트</h4>
        ${renderReportList((report.issueSummary || []).slice(0, 4), "", { basis: true, report })}
      </div>

      <div id="reportOfficialArticleBrief">
        ${renderOfficialArticleBrief(report)}
      </div>

      <div id="reportInterpretationAndCaseBrief">
        ${renderInterpretationAndCaseBrief(report)}
      </div>

      ${renderLegalConsequenceAssessment(report.legalConsequenceAssessment)}

      <div class="report-section">
        <h4>4. 대처 방안</h4>
        ${renderReportList((report.immediateActions || []).slice(0, 5), "checklist", { basis: true, report })}
      </div>

      <div class="report-section">
        <h4>5. 관련 주체별 할 일</h4>
        <div id="reportStakeholderProfileContext"></div>
        ${renderSimpleStakeholders(report)}
      </div>

      <div class="report-section">
        <h4>6. 먼저 챙길 자료</h4>
        ${renderSimpleEvidenceItems(report)}
      </div>

      ${renderSimpleClarifyingQuestions(report)}

      ${renderFinalAdvice(report.finalAdvice)}

      <div class="report-section">
        <h4>정보 제공 안내</h4>
        <p class="report-disclaimer">${escapeHtml(report.disclaimer)}</p>
        ${report.cautions?.length ? renderReportList(report.cautions.slice(0, 4)) : ""}
      </div>

      ${renderEducationOfficeDraft(report)}

      <details class="report-section report-source-section">
        <summary>필요하면 볼 공식 근거·유사자료</summary>
        <p class="report-section-note">첫 보고서에는 핵심만 담고, 더 깊은 검토가 필요할 때 원문 후보와 API 확인 자료를 펼쳐 봅니다.</p>
        <div id="reportLiveSources" class="report-live-sources">
          <p>법제처와 안전보건공단 API 자료를 확인하고 있습니다.</p>
        </div>
        ${report.sourceSearchQueries?.length ? `
          <div class="search-keywords" aria-label="추천 검색어">
            ${report.sourceSearchQueries.map((keyword) => `<code>${escapeHtml(keyword)}</code>`).join("")}
          </div>
        ` : ""}
        ${renderReportMaterials((report.officialMaterials || []).slice(0, 3))}
      </details>

      <div class="report-section report-sign-section">
        <h4>담당자 의견 작성란</h4>
        <div class="report-opinion-grid">
          <div><strong>담임·지도교사 의견</strong><span></span></div>
          <div><strong>취업지도부·업무담당자 의견</strong><span></span></div>
          <div><strong>관리자 검토 의견</strong><span></span></div>
        </div>
      </div>

      ${renderReportLibrary()}
    </section>
  `;
}

function renderSimpleSituationSummary(report, profileContext = {}) {
  const metaItems = [
    profileContext.documentNo ? `문서번호 ${profileContext.documentNo}` : "",
    profileContext.savedAtText ? `작성시각 ${profileContext.savedAtText}` : "",
    profileContext.schoolName ? `학교 ${profileContext.schoolName}` : "",
    profileContext.studentLabel ? `대상 ${profileContext.studentLabel}` : "",
    profileContext.companyName ? `기관 ${profileContext.companyName}` : ""
  ].filter(Boolean);

  return `
    <div class="admin-summary-card">
      <div>
        <span>간편 보고서</span>
        <p>${escapeHtml(report.lead)}</p>
      </div>
      ${metaItems.length ? `
        <div class="admin-summary-meta">
          ${metaItems.map((item) => `<small>${escapeHtml(item)}</small>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderSimpleFacts(report) {
  const facts = (report.facts || []).slice(0, 5);
  if (!facts.length) {
    return `<p class="report-section-note">아직 정리된 사실이 없습니다. 질문을 조금 더 구체적으로 입력하면 자동으로 채워집니다.</p>`;
  }

  return `
    <div class="report-facts">
      ${facts.map((item) => `
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(item.value)}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSimpleStakeholders(report) {
  const stakeholders = (report.stakeholders || []).slice(0, 3);
  if (!stakeholders.length) {
    return `<p class="report-section-note">관련 주체별 조치사항은 추가 확인 후 정리합니다.</p>`;
  }

  return `
    <div class="report-stakeholders">
      ${stakeholders.map((section) => `
        <article>
          <h5>${escapeHtml(section.title)}</h5>
          ${section.summary ? `<p>${escapeHtml(section.summary)}</p>` : ""}
          ${renderReportList([...(section.duties || []), ...(section.rights || [])].slice(0, 4), "", { basis: true, report })}
        </article>
      `).join("")}
    </div>
  `;
}

function renderSimpleEvidenceItems(report) {
  const evidence = (report.evidence || []).slice(0, 5);
  if (!evidence.length) {
    return `<p class="report-section-note">현재 단계에서는 상담기록과 관련 문서부터 보관하면 됩니다.</p>`;
  }

  return `
    <div class="evidence-items">
      ${evidence.map((item) => {
        const title = typeof item === "string" ? item : item.text || item.title || item.item || "";
        const priority = typeof item === "string" ? "권고" : item.priority || "권고";
        const details = [item.reason, item.how].filter(Boolean).join(" ");
        return `
          <article>
            <span class="evidence-priority">${escapeHtml(priority)}</span>
            <h5>${escapeHtml(title)}</h5>
            ${details ? `<p>${escapeHtml(details)}</p>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderSimpleClarifyingQuestions(report) {
  const questions = (report.clarifyingQuestions || []).slice(0, 3);
  if (!questions.length) {
    return "";
  }

  return `
    <div class="report-section">
      <h4>더 정확해지려면 확인할 질문</h4>
      <div class="source-priority-list">
        ${questions.map((item, index) => `
          <article>
            <span>${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.question || item)}</strong>
              ${item.why ? `<p>${escapeHtml(item.why)}</p>` : ""}
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderReportComposer() {
  return `
    <section class="report-composer" aria-label="보고서 작성 정보 입력">
      <div class="report-composer-head">
        <div>
          <span>간편 보고서 정보</span>
          <h4>필요한 기본 정보만 보태세요.</h4>
          <p>모르는 항목은 비워도 됩니다. 추가 자료가 필요한 사안이면 이후 단계에서 따로 확인합니다.</p>
        </div>
      </div>
      <div class="report-profile-form">
        ${reportProfileFields.map((field) => `
          <label class="${field.multiline ? "wide" : ""}">
            <span>${escapeHtml(field.label)}</span>
            ${field.multiline
              ? `<textarea data-report-field="${escapeHtml(field.name)}" rows="3" placeholder="${escapeHtml(field.placeholder)}"></textarea>`
              : `<input data-report-field="${escapeHtml(field.name)}" type="text" placeholder="${escapeHtml(field.placeholder)}">`}
          </label>
        `).join("")}
      </div>
      <div class="report-composer-actions">
        <button type="button" data-save-report>보고서 자료실 저장</button>
        <button type="button" data-download-report>HTML 파일 저장</button>
        <span id="reportComposerFeedback" role="status"></span>
      </div>
    </section>
  `;
}

function renderReportLibrary() {
  return `
    <section class="report-library" aria-label="저장된 보고서 자료실">
      <div class="report-library-head">
        <div>
          <span>보고서 자료실</span>
          <h4>이 브라우저에 저장된 보고서</h4>
          <p>자료실 저장은 현재 사용하는 브라우저에 보관됩니다. 장기 보관이나 공유가 필요하면 HTML 파일 저장도 함께 해 두세요.</p>
        </div>
      </div>
      <div id="reportLibraryList">
        ${renderReportLibraryList()}
      </div>
    </section>
  `;
}

function renderReportLibraryList() {
  const reports = getSavedReports();
  if (!reports.length) {
    return `<p class="report-library-empty">아직 저장된 보고서가 없습니다. 보고서 정보를 입력한 뒤 저장하거나 인쇄하면 여기에 남습니다.</p>`;
  }

  return `
    <div class="report-library-list">
      ${reports.map((report) => {
        const savedAt = formatDateTime(report.savedAt);
        const profileSummary = summarizeReportProfile(report.profile);
        return `
          <article>
            <div>
              <strong>${escapeHtml(report.title)}</strong>
              <p>${escapeHtml(report.documentNo)} · ${escapeHtml(savedAt)}</p>
              <small>${escapeHtml(profileSummary)}</small>
            </div>
            <div class="report-library-actions">
              <button type="button" data-open-saved-report data-report-id="${escapeHtml(report.id)}">열람</button>
              <button type="button" data-download-saved-report data-report-id="${escapeHtml(report.id)}">HTML 저장</button>
              <button type="button" data-delete-saved-report data-report-id="${escapeHtml(report.id)}">삭제</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function finalizeAndSaveReport() {
  const reportElement = document.querySelector("#caseReport");
  const nowIso = new Date().toISOString();
  const id = reportElement?.dataset.activeReportId || createReportId(nowIso);
  const documentNo = reportElement?.dataset.documentNo || createDocumentNo(nowIso);
  const profile = collectReportProfile();
  const profileContext = buildReportProfileContext(profile, documentNo, nowIso);

  if (reportElement) {
    reportElement.dataset.activeReportId = id;
    reportElement.dataset.documentNo = documentNo;
  }

  const draft = currentReportDraft || {};
  applyReportProfileContext(draft, profileContext);
  const record = {
    id,
    documentNo,
    title: draft.title || "사안 보고서",
    subtitle: draft.subtitle || "",
    question: getQuestionContext(questionInput.value).baseQuestion || questionInput.value.trim(),
    savedAt: nowIso,
    generatedAt: draft.generatedAt || formatDateTime(nowIso),
    billing: draft.billing || null,
    usage: draft.usage || null,
    profile,
    html: buildReportSnapshotHtml(documentNo, nowIso)
  };

  const reports = getSavedReports().filter((item) => item.id !== id);
  reports.unshift(record);
  setSavedReports(reports.slice(0, 30));
  refreshReportLibrary();

  return record;
}

function collectReportProfile() {
  return reportProfileFields.map((field) => {
    const input = document.querySelector(`[data-report-field="${field.name}"]`);
    return {
      name: field.name,
      label: field.label,
      value: input?.value.trim() || ""
    };
  });
}

function restoreReportProfile(profile = []) {
  for (const item of profile) {
    const input = document.querySelector(`[data-report-field="${item.name}"]`);
    if (input) {
      input.value = item.value || "";
    }
  }
}

function buildReportProfileContext(profile = [], documentNo = "", savedAt = "") {
  const values = Object.fromEntries(profile.map((item) => [item.name, item.value]));
  return {
    ...values,
    documentNo,
    savedAt,
    savedAtText: savedAt ? formatDateTime(savedAt) : ""
  };
}

function applyReportProfileContext(report, profileContext) {
  const executiveMount = document.querySelector("#reportExecutiveSummary");
  if (executiveMount) {
    executiveMount.innerHTML = renderSimpleSituationSummary(report, profileContext);
  }

  const factMount = document.querySelector("#reportFactProfileContext");
  if (factMount) {
    factMount.innerHTML = renderFactProfileContextContent(profileContext);
  }

  const stakeholderMount = document.querySelector("#reportStakeholderProfileContext");
  if (stakeholderMount) {
    stakeholderMount.innerHTML = renderStakeholderProfileContextContent(profileContext);
  }
}

function summarizeReportProfile(profile = []) {
  const values = Object.fromEntries(profile.map((item) => [item.name, item.value]));
  return [
    values.studentLabel,
    values.department,
    values.companyName,
    values.trainingPeriod
  ].filter(Boolean).join(" · ") || "입력 정보 미작성";
}

function refreshReportLibrary() {
  const mount = document.querySelector("#reportLibraryList");
  if (mount) {
    mount.innerHTML = renderReportLibraryList();
  }
}

function updateReportComposerFeedback(message) {
  const feedback = document.querySelector("#reportComposerFeedback");
  if (feedback) {
    feedback.textContent = message;
  }
}

function getSavedReports() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REPORT_LIBRARY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setSavedReports(reports) {
  try {
    window.localStorage.setItem(REPORT_LIBRARY_KEY, JSON.stringify(reports));
  } catch {
    updateReportComposerFeedback("브라우저 저장 공간이 부족해 자료실 저장에 실패했습니다. HTML 파일 저장을 이용하세요.");
  }
}

function createReportId(value) {
  return `report-${Date.parse(value) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDocumentNo(value) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("");
  const time = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
  return `GYO6-LAW-${stamp}-${time}`;
}

function buildReportSnapshotHtml(documentNo, savedAt) {
  const reportElement = document.querySelector("#caseReport");
  if (!reportElement) {
    return "";
  }

  const clone = reportElement.cloneNode(true);
  clone.querySelectorAll(".report-composer, .report-library, .report-actions").forEach((node) => node.remove());
  clone.removeAttribute("id");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentNo)} 보고서</title>
  <style>${getReportSnapshotStyles()}</style>
</head>
<body>
  <main>
    ${clone.outerHTML}
    <footer>저장시각 ${escapeHtml(formatDateTime(savedAt))} · GYO6 Law Info</footer>
  </main>
</body>
</html>`;
}

function getReportSnapshotStyles() {
  return `
    body{margin:0;background:#f5f6f8;color:#111827;font-family:Arial,"Noto Sans KR",sans-serif}
    main{max-width:960px;margin:0 auto;padding:28px;background:#fff}
    .case-report{display:grid;gap:18px}
    .report-cover{border-bottom:2px solid #111827;padding-bottom:14px}
    .report-kicker{margin:0 0 6px;color:#256fc5;font-size:12px;font-weight:800;letter-spacing:.08em}
    .report-cost-meta{display:inline-block;margin:8px 0 0;border-radius:999px;padding:5px 9px;background:#edf7f6;color:#12867d;font-size:12px;font-weight:800}
    h3{margin:0;font-size:26px;line-height:1.35}
    h4{margin:0;font-size:18px}
    h5{margin:0;font-size:15px}
    p,li{line-height:1.65}
    .report-lead{border-left:5px solid #256fc5;background:#f4f8fd;padding:14px;font-weight:700}
    .report-disclaimer{border:1px solid #f0d6a3;background:#fffaf0;padding:12px;color:#79540e}
    .report-section{border-top:1px solid #dce5ee;padding-top:14px;display:grid;gap:10px}
    .admin-summary-card{border:1px solid #c6dceb;border-left:5px solid #256fc5;background:#f4f8fd;padding:12px}
    .admin-summary-card span{display:block;margin-bottom:5px;color:#256fc5;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
    .admin-summary-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .admin-summary-meta small{background:#fff;border:1px solid #dce5ee;padding:4px 7px;font-size:11px}
    .sixw-grid,.report-context-block,.report-facts,.report-profile-grid,.report-materials{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .sixw-grid article,.report-context-block article,.report-facts div,.report-profile-grid div,.report-stakeholders article,.report-materials article,.report-api-list article,.evidence-items article{border:1px solid #dce5ee;padding:10px;background:#fbfcfd}
    .response-summary,.stakeholder-context-note{border:1px solid #dce5ee;background:#f8fbfd;padding:10px}
    .education-office-draft{display:grid;gap:10px;border:1px solid #cbdbe8;border-left:5px solid #256fc5;background:#f8fbfd;padding:12px}
    .education-office-draft>div{display:flex;justify-content:space-between;gap:10px}
    .education-office-draft span{color:#65758b;font-size:12px;font-weight:800}
    .education-office-draft dl{display:grid;gap:6px;margin:0}
    .education-office-draft dl div{display:grid;grid-template-columns:140px minmax(0,1fr);gap:8px;border:1px solid #dce5ee;background:#fff;padding:8px}
    .education-office-draft dt,.education-office-draft dd{margin:0;line-height:1.55}
    .education-office-draft dt{color:#256fc5;font-size:12px;font-weight:800}
    .report-materials article{display:grid;gap:8px}
    .report-material-detail{display:grid;gap:7px;border-top:1px solid #e5edf4;padding-top:8px}
    .report-mini-list{display:grid;gap:6px}
    .report-mini-card{border:1px solid #dce5ee;background:#fff;padding:8px}
    .report-mini-card b{display:block;margin-bottom:4px;color:#111827}
    .report-mini-card p{margin:0 0 4px}
    .report-mini-card em{display:block;color:#4d637b;font-style:normal;font-size:12px;line-height:1.55}
    .report-action-checks ul{margin:0;padding-left:18px}
    .inline-basis{display:block;margin-top:4px;color:#12867d;font-size:12px;font-weight:800;line-height:1.5}
    .report-similar-hints{border:1px solid #f0d6a3;background:#fffaf0;padding:10px;display:grid;gap:8px}
    .report-similar-hints>div{display:grid;gap:8px}
    .report-similar-hints article{border:1px solid #f0d6a3;background:#fff;padding:8px}
    .report-similar-hints section{display:grid;gap:6px}
    .report-similar-hints h5{margin:0;color:#79540e;font-size:12px}
    .report-similar-hints article>span,.student-case-badge{display:inline-block;width:fit-content;border-radius:999px;padding:3px 7px;background:#edf7f6;color:#12867d;font-size:11px;font-weight:800}
    .report-similar-hints b{display:block;margin-bottom:4px}
    .report-similar-hints p,.report-similar-hints em,.report-similar-hints small{display:block;margin:0 0 4px;color:#40556a;font-size:12px;font-style:normal}
    .report-api-relevance{display:grid;gap:5px;border:1px solid #d9e8f0;background:#f8fbfd;padding:8px}
    .report-api-relevance p{margin:0;color:#40556a;font-size:12px;line-height:1.55}
    .report-api-relevance small{color:#12867d;font-size:11px;font-weight:800}
    .report-final-advice{border:1px solid #dce5ee;border-left:5px solid #12867d;padding:12px;background:#fbfcfd}
    .report-final-advice.labor{border-left-color:#256fc5}
    .report-final-advice.legal{border-left-color:#9d3321}
    .final-advice-box,.referral-draft{display:grid;gap:6px;border:1px solid #dce5ee;background:#fff;padding:10px}
    .final-advice-box span{color:#12867d;font-size:12px;font-weight:800}
    .referral-draft{background:#f8fbfd}
    .referral-draft strong{color:#142033;font-size:13px}
    .final-advice-box p,.referral-draft p{margin:0;color:#40556a;line-height:1.65}
    strong{color:#142033}
    .report-list{margin:0;padding-left:20px}
    .report-list.checklist{padding-left:0;list-style-position:inside}
    .report-list.checklist li{border:1px solid #dce5ee;margin-bottom:6px;padding:8px;background:#f8fbfd}
    .report-list.compact{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-left:0;list-style:none}
    .evidence-groups{display:grid;gap:10px}
    .evidence-category{display:grid;gap:8px;border:1px solid #dce5ee;padding:10px;background:#fbfcfd}
    .evidence-category.required{border-left:5px solid #9d3321}
    .evidence-category.recommended{border-left:5px solid #256fc5}
    .evidence-category.optional{border-left:5px solid #12867d}
    .evidence-category-head{display:flex;gap:8px}
    .evidence-category-head p{margin:0;color:#40556a;line-height:1.55}
    .evidence-priority{height:fit-content;border-radius:999px;padding:4px 8px;background:#12867d;color:#fff;font-size:11px;font-weight:800}
    .evidence-priority.required{background:#9d3321}
    .evidence-priority.recommended{background:#256fc5}
    .evidence-items{display:grid;gap:8px}
    .evidence-items h5,.evidence-items p,.evidence-items dl{margin:0}
    .evidence-items dl{display:grid;gap:5px}
    .evidence-items dt{color:#12867d;font-size:12px;font-weight:800}
    .evidence-items dd{margin:0;color:#40556a;font-size:12px;line-height:1.55}
    .report-stakeholders{display:grid;gap:10px}
    .report-opinion-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .report-opinion-grid div{min-height:86px;border:1px solid #111827;padding:10px}
    .report-opinion-grid .wide{grid-column:1/-1}
    .report-opinion-grid span{display:block;min-height:52px;margin-top:8px;border-bottom:1px solid #111827}
    a{color:#111827;text-decoration:none}
    footer{margin-top:28px;border-top:1px solid #dce5ee;padding-top:12px;color:#65758b;font-size:12px}
    @media print{body{background:#fff}main{max-width:none;padding:0}.report-section,.report-stakeholders article,.report-materials article,.report-mini-card,.report-final-advice,.referral-draft,.admin-summary-card,.sixw-grid article,.report-context-block article,.report-similar-hints article,.report-opinion-grid div,.evidence-items article,.education-office-draft{break-inside:avoid}}
  `;
}

function downloadSavedReport(report) {
  const file = report?.html ? report : getSavedReports().find((item) => item.id === report);
  if (!file?.html) {
    updateReportComposerFeedback("저장된 보고서를 찾지 못했습니다.");
    return;
  }

  const blob = new Blob([file.html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${file.documentNo || "GYO6-LAW-REPORT"}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

function openSavedReport(id) {
  const report = getSavedReports().find((item) => item.id === id);
  if (!report?.html) {
    updateReportComposerFeedback("저장된 보고서를 찾지 못했습니다.");
    return;
  }

  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    downloadSavedReport(report);
    return;
  }

  popup.document.open();
  popup.document.write(report.html);
  popup.document.close();
}

function deleteSavedReport(id) {
  const reports = getSavedReports();
  const target = reports.find((item) => item.id === id);
  if (!target) {
    return;
  }

  const confirmed = window.confirm(`${target.documentNo} 보고서를 자료실에서 삭제할까요?`);
  if (!confirmed) {
    return;
  }

  setSavedReports(reports.filter((item) => item.id !== id));
  refreshReportLibrary();
  updateReportComposerFeedback("저장된 보고서를 삭제했습니다.");
}

function renderReportList(items, variant = "", options = {}) {
  return `
    <ul class="report-list ${variant}">
      ${items.map((item) => {
        const text = typeof item === "string" ? item : item.text;
        const basis = typeof item === "object" && item.basis
          ? item.basis
          : options.basis
            ? getInlineBasisForText(text, options.report)
            : "";
        return `
          <li>
            <span>${escapeHtml(text)}</span>
            ${basis ? `<small class="inline-basis">법적 근거: ${escapeHtml(basis)}</small>` : ""}
          </li>
        `;
      }).join("")}
    </ul>
  `;
}

function formatLegalBasis(keys = []) {
  return keys
    .map((key) => legalBasisCatalog[key])
    .filter(Boolean)
    .map((item) => `${item.label} - ${item.detail}`)
    .join(" / ");
}

function getInlineBasisForText(text, report) {
  const normalized = String(text || "").replace(/\s+/g, "");
  const liveSourceBasis = getLiveSourceBasisForText(text, report);
  if (liveSourceBasis) {
    return liveSourceBasis;
  }

  const reportText = compactText([
    report?.title,
    report?.lead,
    report?.subtitle
  ].filter(Boolean).join(" "));
  const preventionReport = /예방|점검|관리체계|아차사고/.test(reportText) && !/사망|중상|골절|입원|수술|산재|산업재해/.test(reportText);
  const basisKeys = [];

  const add = (...items) => items.forEach((item) => {
    if (item && !basisKeys.includes(item)) {
      basisKeys.push(item);
    }
  });

  if (/현장실습|실습운영|순회지도|지도.?점검|학교.*관리|교육청/.test(normalized)) {
    add("fieldTrainingOperation");
  }
  if (/산업체|실습기업|배치|선정/.test(normalized)) {
    add("fieldTrainingCompanySelection");
  }
  if (/협약|계약|실습내용|권리|의무/.test(normalized)) {
    add("fieldTrainingContract");
  }
  if (/청소|잡무|재료|심부름|업무범위|반복지시|실습계획|표준협약|멘토|지시권한/.test(normalized)) {
    add("fieldTrainingContract", "fieldTrainingCompanyDuty");
  }
  if (/실습시간|출근|퇴근|야간|휴일/.test(normalized)) {
    add("fieldTrainingTime");
  }
  if (/안전교육|노동인권|권익보호/.test(normalized)) {
    add("fieldTrainingSafetyEducation", "oshEducation");
  }
  if (/생명|신체|실습환경|학생보호|재발방지/.test(normalized)) {
    add("fieldTrainingCompanyDuty");
  }
  if (/기계|안전장치|방호|작업표준|보호구|위험성|감독자|작업지시|현장보존|추가위험|추가위험차단/.test(normalized)) {
    add("oshSafetyMeasures", "oshMachineGuard");
  }
  if (/산재|산업재해|사고보고|재해조사|보험|휴업|진단서/.test(normalized)) {
    add("oshAccidentReport", "oshAccidentReportRule");
  }
  if (/중대재해|중상|사망|장해/.test(normalized)) {
    if (preventionReport) {
      add("seriousAccidentDuty");
    } else {
      add("seriousAccidentDefinition", "seriousAccidentDuty");
    }
  }
  if (/위탁|도급|용역|파견|관계기관/.test(normalized)) {
    add("seriousAccidentContract");
  }
  if (/학교안전|공제|보상/.test(normalized)) {
    add("schoolSafetyCompensation");
  }
  if (/괴롭힘|모욕|보복|따돌림|업무상적정범위|실습환경악화|권익침해/.test(normalized)) {
    add("laborHarassmentBan", "laborHarassmentAction");
  }
  if (/학교폭력|피해학생|가해학생|전담기구|심의/.test(normalized)) {
    return "학교폭력예방 및 대책에 관한 법률 - 피해학생 보호조치, 사안 조사, 전담기구·심의 절차를 원문과 교육부 가이드북으로 대조합니다.";
  }
  if (/근로계약|임금|근로시간|휴게|해고|퇴직/.test(normalized)) {
    return "근로기준법 및 근로자퇴직급여 보장법 - 계약, 임금, 근로시간, 휴게, 퇴직급여 쟁점을 원문 조항과 계약서로 대조합니다.";
  }
  if (/민원|처분|의견제출|행정절차/.test(normalized)) {
    return "행정절차법 - 처분, 의견제출, 절차상 고지 여부를 관련 조문과 공문 기록으로 확인합니다.";
  }

  if (!basisKeys.length) {
    const material = report?.officialMaterials?.find((item) => item.provisions?.length) || report?.officialMaterials?.[0];
    const provision = material?.provisions?.[0]?.title;
    if (material?.title && provision) {
      return `${material.title} ${provision} - ${material.use || "공식 원문으로 적용 범위를 확인합니다."}`;
    } else if (material?.title) {
      return `${material.title} - ${material.use || "공식 원문으로 적용 범위를 확인합니다."}`;
    }
  }

  return formatLegalBasis(basisKeys.slice(0, 3));
}

function getLiveSourceBasisForText(text, report = {}) {
  const references = report.liveSourceReferences?.length
    ? report.liveSourceReferences
    : buildLiveSourceReferences(report.officialSourceContext || {});
  if (!references.length) {
    return "";
  }

  const normalized = compactText(text || "");
  const scored = references
    .map((reference) => ({
      reference,
      score: scoreLiveSourceReference(reference, normalized)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.reference.label.localeCompare(right.reference.label, "ko-KR"));

  if (!scored.length) {
    return "";
  }

  const labels = uniqueStrings(scored.slice(0, 2).map((item) => item.reference.label)).filter(Boolean);
  return labels.length ? `${labels.join(" / ")} - 법제처 원문 확인` : "";
}

function scoreLiveSourceReference(reference, normalizedText) {
  const sourceText = compactText([
    reference.lawName,
    reference.articleTitle,
    reference.text,
    reference.label
  ].filter(Boolean).join(" "));
  let score = 0;

  if (!normalizedText || !sourceText) {
    return 0;
  }

  if (reference.articleTitle && normalizedText.includes(compactText(reference.articleTitle))) {
    score += 8;
  }
  if (/실습시간|시간종료|잔업|야간|휴일|연장/.test(normalizedText) && /현장실습시간|1일7시간|1주일35시간|야간|휴일|연장/.test(sourceText)) {
    score += 12;
  }
  if (/지도점검|보고|자료제출|현장조사|교육청|고용노동부/.test(normalizedText) && /지도점검|보고|자료제출|현장조사|교육부장관|고용노동부장관|시도교육감/.test(sourceText)) {
    score += 10;
  }
  if (/벌칙|징역|벌금|과태료|처벌|형량/.test(normalizedText) && /벌칙|징역|벌금|과태료|처한다/.test(sourceText)) {
    score += 12;
  }
  if (/현장실습|실습생|직업교육훈련|실습기업/.test(normalizedText) && /현장실습|직업교육훈련|현장실습산업체/.test(sourceText)) {
    score += 3;
  }
  if (/청소|잡무|업무범위|심부름|반복지시|권익|협약|계약|실습계획/.test(normalizedText) && /현장실습|직업교육훈련|현장실습산업체|계약|협약|권리|의무/.test(sourceText)) {
    score += 2;
  }

  return score;
}

function renderReportSimilarHints(materials = []) {
  const hints = materials.flatMap((material) => (material.caseHints || []).map((hint) => ({
    ...hint,
    source: material.source,
    materialTitle: material.title
  })));

  if (!hints.length) {
    return "";
  }

  const studentPattern = /학생|현장실습|실습생|직업계고|특성화고|마이스터고|학교|지도교사|보호자/;
  const studentHints = hints.filter((hint) => studentPattern.test(`${hint.title} ${hint.why} ${hint.check} ${hint.materialTitle}`));
  const generalHints = hints.filter((hint) => !studentHints.includes(hint));
  const renderHintCard = (hint, priorityLabel) => `
    <article>
      <span>${escapeHtml(priorityLabel)}</span>
      <b>${escapeHtml(hint.title)}</b>
      <p>${escapeHtml(hint.why)}</p>
      <em>${escapeHtml(hint.check)}</em>
      <small>${escapeHtml(hint.source)} · ${escapeHtml(hint.materialTitle)}</small>
    </article>
  `;

  return `
    <div class="report-similar-hints" aria-label="유사자료 우선 후보">
      <strong>유사자료 우선 후보</strong>
      <p>학생·현장실습 사고 유사자료를 먼저 보고, 학생 사례가 부족하면 일반 근로자 재해사례를 보조자료로 봅니다.</p>
      <div>
        ${studentHints.length ? `
          <section>
            <h5>1순위: 학생·현장실습 사례</h5>
            ${studentHints.slice(0, 3).map((hint) => renderHintCard(hint, "학생·현장실습 우선")).join("")}
          </section>
        ` : `
          <section>
            <h5>1순위: 학생·현장실습 사례</h5>
            <article>
              <span>확인 필요</span>
              <b>학생 사고 유사사례 추가 검색 필요</b>
              <p>현재 기본 후보 안에는 학생·현장실습 사고로 바로 분류되는 사례가 부족합니다.</p>
              <em>안전보건공단 국내재해사례와 교육청 현장실습 사고 보고 자료에서 학생, 현장실습, 실습생, 직업계고 키워드를 우선 검색합니다.</em>
              <small>공식 자료 우선</small>
            </article>
          </section>
        `}
        <section>
          <h5>2순위: 일반 근로자 재해사례</h5>
          ${generalHints.slice(0, 3).map((hint) => renderHintCard(hint, "일반 근로자 보조사례")).join("")}
        </section>
      </div>
    </div>
  `;
}

function renderReportMaterials(materials) {
  return `
    <div class="report-materials">
      ${materials.map((material) => `
        <article>
          <span>${escapeHtml(getMaterialKindLabel(material.type))}</span>
          <h5>${escapeHtml(material.title)}</h5>
          <p>${escapeHtml(material.use)}</p>
          <small>${escapeHtml(material.source)} · ${escapeHtml(material.query)}</small>
          ${renderReportMaterialItems("관련 조항 후보", material.provisions)}
          ${renderReportMaterialItems("사고·사례 확인 후보", material.caseHints)}
          ${renderReportActionChecks(material.actionChecks)}
          <a href="${escapeHtml(getMaterialUrl(material, encodeURIComponent(material.query || material.title)))}" target="_blank" rel="noopener noreferrer">원문 연결</a>
        </article>
      `).join("")}
    </div>
  `;
}

function renderReportMaterialItems(title, items = []) {
  if (!items.length) {
    return "";
  }

  return `
    <div class="report-material-detail">
      <strong>${escapeHtml(title)}</strong>
      <div class="report-mini-list">
        ${items.map((item) => `
          <div class="report-mini-card">
            <b>${escapeHtml(item.title)}</b>
            <p>${escapeHtml(item.why)}</p>
            <em>${escapeHtml(item.check)}</em>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderReportActionChecks(items = []) {
  if (!items.length) {
    return "";
  }

  return `
    <div class="report-material-detail report-action-checks">
      <strong>보고서 대조 포인트</strong>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function updateReportLiveSources(data) {
  mergeLiveSourcesIntoCurrentReport(data);
  updateReportOfficialArticleBrief();
  updateReportInterpretationAndCaseBrief();

  const reportMount = document.querySelector("#reportLiveSources");
  if (!reportMount) {
    return;
  }

  reportMount.innerHTML = renderReportLiveSources(data);
}

function mergeLiveSourcesIntoCurrentReport(data) {
  if (!currentReportDraft || !data || data.error) {
    return;
  }

  const references = buildLiveSourceReferences(data);
  if (!references.length) {
    return;
  }

  currentReportDraft = {
    ...currentReportDraft,
    officialSourceContext: data,
    liveSourceReferences: references
  };
}

function updateReportOfficialArticleBrief() {
  const mount = document.querySelector("#reportOfficialArticleBrief");
  if (!mount) {
    return;
  }

  mount.innerHTML = renderOfficialArticleBrief(currentReportDraft || {});
}

function updateReportInterpretationAndCaseBrief() {
  const mount = document.querySelector("#reportInterpretationAndCaseBrief");
  if (!mount) {
    return;
  }

  mount.innerHTML = renderInterpretationAndCaseBrief(currentReportDraft || {});
}

function renderReportLiveSources(data) {
  if (data.error) {
    return `<p class="report-source-empty">${escapeHtml(data.error)}</p>`;
  }

  const results = data.results || {};
  const checkedAt = formatDateTime(data.verification?.checkedAt || data.generatedAt);

  return `
    <div class="report-api-head">
      <strong>유사 사례·공식 API 확인 자료</strong>
      <span>확인시각 ${escapeHtml(checkedAt)}</span>
    </div>
    ${renderReportApiGroup("국내재해사례", results.safetyDisasters)}
    ${renderReportApiGroup("안전보건자료", results.safetyMaterials)}
    ${renderReportApiGroup("현행 법령", results.laws)}
    ${renderReportApiGroup("공식 판례", results.precedents)}
    ${renderReportApiGroup("법령해석례", results.interpretations)}
    ${renderReportApiGroup("교육부 법령해석", results.educationInterpretations)}
    ${renderReportApiGroup("교육부 공식 기준자료", results.educationAdminRules)}
  `;
}

function renderReportApiGroup(title, items = []) {
  if (!items.length) {
    return "";
  }

  const visibleItems = prioritizeReportApiItems(title, items).slice(0, 5);

  return `
    <div class="report-api-group">
      <h5>${escapeHtml(title)}</h5>
      <div class="report-api-list">
        ${visibleItems.map((item) => {
          const reliability = item.reliability || {};
          const url = safeUrl(item.url);
          const studentCase = isStudentFieldTrainingLikeItem(item);
          const educationPriority = title === "교육부 공식 기준자료" && item.relevance?.label;
          return `
            <article>
              <div>
                <strong>${escapeHtml(item.title || "제목 없음")}</strong>
                <span class="${reliability.needsReview ? "needs-review" : "verified"}">${escapeHtml(reliability.label || "확인 필요")}</span>
              </div>
              ${studentCase ? `<small class="student-case-badge">학생·현장실습 우선 검토</small>` : ""}
              ${educationPriority ? `<small class="student-case-badge">학교 기준자료 ${escapeHtml(item.relevance.label)}</small>` : ""}
              <p>${escapeHtml(item.summary || item.subtitle || "요약 정보 없음")}</p>
              ${renderReportApiRelevance(item.relevance)}
              <small>${escapeHtml(item.source || "공식 출처")} ${item.date ? `· ${escapeHtml(item.date)}` : "· 일자 확인 필요"}${item.currentStatus ? ` · ${escapeHtml(item.currentStatus)}` : ""}</small>
              ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">원문 확인</a>` : ""}
            </article>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function prioritizeReportApiItems(title, items = []) {
  if (title === "교육부 공식 기준자료") {
    return [...items].sort((a, b) =>
      Number(b.relevance?.score || 0) - Number(a.relevance?.score || 0) ||
      Number(Boolean(b.current)) - Number(Boolean(a.current)) ||
      getApiComparableDate(b.date) - getApiComparableDate(a.date) ||
      String(a.title || "").localeCompare(String(b.title || ""), "ko-KR")
    );
  }

  if (title !== "국내재해사례") {
    return items;
  }

  return [...items].sort((a, b) => {
    const bScore = getStudentFieldTrainingScore(b) + Number(b.relevance?.score || 0);
    const aScore = getStudentFieldTrainingScore(a) + Number(a.relevance?.score || 0);
    return bScore - aScore;
  });
}

function getApiComparableDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 8) {
    return 0;
  }
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const timestamp = Date.UTC(year, month - 1, day);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isStudentFieldTrainingLikeItem(item) {
  return getStudentFieldTrainingScore(item) > 0;
}

function getStudentFieldTrainingScore(item) {
  const text = [item.title, item.summary, item.subtitle, item.source, item.relevance?.reason, item.relevance?.matchedSignals?.join(" ")]
    .filter(Boolean)
    .join(" ");
  const terms = ["현장실습", "실습생", "학생", "직업계고", "특성화고", "마이스터고", "학교"];
  return terms.reduce((score, term) => score + (text.includes(term) ? 30 : 0), 0);
}

function renderReportApiRelevance(relevance) {
  if (!relevance) {
    return "";
  }

  return `
    <div class="report-api-relevance">
      <strong>${escapeHtml(relevance.label)} · 관련도 ${escapeHtml(relevance.score)}점</strong>
      <p>${escapeHtml(relevance.reason)}</p>
      ${relevance.matchedSignals?.length ? `<small>일치 신호: ${escapeHtml(relevance.matchedSignals.join(", "))}</small>` : ""}
    </div>
  `;
}

function getQuestionContext(question) {
  const [baseQuestion, rawDetails = ""] = String(question || "").split(/\n\n추가 확인 내용:/);
  const details = rawDetails
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const normalized = line.replace(/^-\s*/, "");
      const separatorIndex = normalized.indexOf(":");
      if (separatorIndex === -1) {
        return { question: "추가 확인", answer: normalized };
      }

      return {
        question: normalized.slice(0, separatorIndex).trim(),
        answer: normalized.slice(separatorIndex + 1).trim()
      };
    });

  return {
    baseQuestion: baseQuestion.trim(),
    details
  };
}

function findDetailAnswer(details, keyword) {
  const item = details.find((detail) => detail.question.includes(keyword));
  return item?.answer || "";
}

function getRefinementQuestions(question, preset, userRole, riskSignals) {
  const normalized = question.replace(/\s+/g, "");
  const hasSeriousInjury = /골절|중상|사망|수술|장해|입원|119|응급|피해/.test(normalized);
  const hasFriendContext = /친구|동료|다른학생|같은반/.test(normalized);
  const byTopic = {
    employment: [
      {
        question: "근로계약서나 채용 공고에 적힌 근무 조건이 있나요?",
        reason: "계약서와 공고는 임금, 근로시간, 채용조건을 확인하는 기준입니다.",
        placeholder: "예: 근로계약서 있음, 공고만 있음, 아직 못 받음"
      },
      {
        question: "근무 시작일, 근무 장소, 실제 일한 시간이 정리되어 있나요?",
        reason: "언제 어디서 어떤 일을 했는지에 따라 적용 법령과 자료가 달라집니다.",
        placeholder: "예: 6월 1일부터 주 5일, 하루 7시간"
      },
      {
        question: "임금, 수당, 휴게시간, 퇴직 관련해서 다투는 지점이 무엇인가요?",
        reason: "쟁점이 분명해야 법령과 행정자료 후보를 정확히 좁힐 수 있습니다.",
        placeholder: "예: 야근수당 미지급, 휴게시간 없음"
      }
    ],
    apprenticeship: [
      {
        question: "도제학교 훈련계약, 운영계획, 학교 안내문이 있나요?",
        reason: "도제학교는 학교 교육과 기업훈련의 근거 자료를 함께 봐야 합니다.",
        placeholder: "예: 훈련계약 있음, 학교 안내문만 있음"
      },
      {
        question: "학생이 기업에서 실제로 맡은 업무와 훈련 시간이 어떻게 되나요?",
        reason: "훈련인지 근로인지, 안전관리 의무가 어떻게 연결되는지 확인해야 합니다.",
        placeholder: "예: 주 3일 기업훈련, 장비 조작 포함"
      },
      {
        question: "안전교육, 지도교사 방문, 기업 담당자 지도가 기록되어 있나요?",
        reason: "지도·감독과 안전교육 기록은 책임과 조치 판단의 핵심 자료입니다.",
        placeholder: "예: 안전교육 서명부 있음, 방문기록 모름"
      }
    ],
    fieldTraining: [
      {
        question: "사고나 문제가 실습시간 안에, 실습 장소에서 발생했나요?",
        reason: "현장실습 사고인지 개인적인 이동 중 사고인지에 따라 확인할 자료가 달라집니다.",
        placeholder: "예: 실습 종료 직후 회사 안, 지도교사에게 보고 전"
      },
      {
        question: "학생이 그 작업을 지시받았거나 허락받았나요?",
        reason: "작업 지시와 감독 여부는 학교와 실습기관 책임을 나눌 때 핵심입니다.",
        placeholder: "예: 직원 지시, 친구 부탁, 직접 판단"
      },
      {
        question: "현장실습 협약서, 실습일지, 안전교육 기록이 있나요?",
        reason: "공식 실습과 안전교육 기록은 원문 근거 검색의 출발점입니다.",
        placeholder: "예: 협약서 있음, 안전교육 기록은 모름"
      },
      {
        question: "사고 직후 학교, 보호자, 회사가 각각 어떤 조치를 했나요?",
        reason: "보고, 보호자 통보, 치료, 실습 중단 조치가 빠졌는지 확인해야 합니다.",
        placeholder: "예: 학교 보고, 보호자 통보, 병원 이송"
      }
    ],
    overseasTraining: [
      {
        question: "파견 국가, 기관, 기간, 실습 내용이 정리되어 있나요?",
        reason: "해외 현장실습은 국내 절차와 현지 기관 정보를 함께 확인해야 합니다.",
        placeholder: "예: 호주, 4주, 호텔 실습"
      },
      {
        question: "동의서, 보험, 비상연락망, 안전교육 자료가 있나요?",
        reason: "학생 보호와 사고 대응 절차의 기본 근거가 됩니다.",
        placeholder: "예: 보험 가입, 비상연락망 있음"
      },
      {
        question: "현지에서 사고, 민원, 실습 중단 같은 문제가 발생했나요?",
        reason: "문제 유형에 따라 학교, 파견기관, 보호자 안내 절차가 달라집니다.",
        placeholder: "예: 실습 중단 요청, 현지 기관 민원"
      }
    ],
    schoolSafety: [
      {
        question: "사고 장소, 시간, 관련 시설 또는 장비가 무엇인가요?",
        reason: "학교 안전, 산업안전, 중대재해 자료를 구분해 찾기 위해 필요합니다.",
        placeholder: "예: 실습실, 기계 장비, 방과후"
      },
      {
        question: "피해 정도와 즉시 조치 내용이 기록되어 있나요?",
        reason: "부상 정도와 응급조치는 보고·보상·전문가 확인 우선순위에 영향을 줍니다.",
        placeholder: "예: 진단서 있음, 119 이송, 사진 있음"
      },
      {
        question: "안전교육, 점검표, 위험성 평가 기록이 있나요?",
        reason: "예방 의무와 관리체계 확인에 필요한 자료입니다.",
        placeholder: "예: 안전교육 서명부 있음, 점검표 없음"
      }
    ],
    schoolViolence: [
      {
        question: "발생 일시, 장소, 관련 학생, 증거 자료가 시간순으로 정리되어 있나요?",
        reason: "학교폭력 절차는 접수와 사실 확인 기록이 매우 중요합니다.",
        placeholder: "예: 날짜, 장소, 문자 캡처, 목격자"
      },
      {
        question: "학교에 신고 또는 상담이 접수되었나요?",
        reason: "접수 여부에 따라 학교의 보호 조치와 절차 확인이 달라집니다.",
        placeholder: "예: 담임 상담, 학교폭력 담당자 접수"
      },
      {
        question: "피해학생 보호 조치나 분리 조치가 있었나요?",
        reason: "학생 안전을 먼저 확보했는지 확인해야 합니다.",
        placeholder: "예: 분리 조치, 상담 지원, 보호자 통보"
      }
    ],
    schoolAdministration: [
      {
        question: "업무 단계가 예산 편성, 품의, 계약, 검수, 지출, 정산, 학생부 정정 중 어디인가요?",
        reason: "교육행정은 단계별로 확인할 법령과 증빙자료가 달라집니다.",
        placeholder: "예: 지출 증빙, 학생부 정정, 회의록 보존"
      },
      {
        question: "관할 시도교육청 지침, 학교 내부 규정, 결재 문서가 있나요?",
        reason: "학교회계와 행정절차는 교육청별 지침과 내부 결재 흐름 확인이 중요합니다.",
        placeholder: "예: 예산편성 지침, 품의서, 검수조서"
      },
      {
        question: "학생부·출결 사안이면 학년도, 학교급, 증빙자료와 처리일자가 정리되어 있나요?",
        reason: "학생생활기록은 당해 학년도 기재요령과 작성·관리지침을 함께 대조해야 합니다.",
        placeholder: "예: 2026학년도 고등학교, 출결 증빙 있음"
      }
    ],
    staffLabor: [
      {
        question: "정규직, 기간제, 상근, 시간제 등 신분과 계약 형태가 무엇인가요?",
        reason: "교직원·행정직 사안은 신분과 계약 형태에 따라 적용 기준이 달라집니다.",
        placeholder: "예: 기간제교사, 상근 행정직, 교육공무직"
      },
      {
        question: "계약서, 복무규정, 공문, 내부 결재 기록이 있나요?",
        reason: "인사·노무 판단은 문서 근거를 먼저 확인해야 합니다.",
        placeholder: "예: 계약서 있음, 공문 있음"
      },
      {
        question: "쟁점이 징계, 복무, 민원, 근로조건 중 어디에 가깝나요?",
        reason: "쟁점 분류가 정확해야 법령과 판례 후보가 좁혀집니다.",
        placeholder: "예: 복무 위반 민원, 연가 처리, 계약 갱신"
      }
    ],
    civilComplaint: [
      {
        question: "민원 접수 날짜, 경로, 요구 내용이 정리되어 있나요?",
        reason: "민원은 접수와 답변의 시간순 기록이 중요합니다.",
        placeholder: "예: 국민신문고, 학교 방문, 전화 민원"
      },
      {
        question: "학생 보호나 학교 조치가 필요한 사안인가요?",
        reason: "학생 안전과 권리 보호가 필요한지 먼저 구분해야 합니다.",
        placeholder: "예: 출결, 생활지도, 징계, 상담"
      },
      {
        question: "학교 규정, 교육청 안내, 상담 기록이 있나요?",
        reason: "학교 현장 절차와 공식 기준을 함께 확인해야 합니다.",
        placeholder: "예: 학교 규정 있음, 상담일지 있음"
      }
    ],
    general: [
      {
        question: "누가 관련되어 있나요?",
        reason: "학생, 학부모, 교사, 학교, 회사 등 주체를 나누면 책임과 절차를 더 정확히 볼 수 있습니다.",
        placeholder: "예: 학생, 학교, 실습기업, 보호자"
      },
      {
        question: "언제 어디서 어떤 일이 발생했나요?",
        reason: "날짜와 장소는 적용되는 절차와 자료를 구분하는 기준입니다.",
        placeholder: "예: 5월 말, 학교 실습실, 회사 현장"
      },
      {
        question: "계약서, 협약서, 공문, 문자, 사진, 진단서 같은 자료가 있나요?",
        reason: "원자료가 있어야 공식 원문과 연결해 확인할 수 있습니다.",
        placeholder: "예: 공문 있음, 사진 있음, 계약서 모름"
      },
      {
        question: "이미 학교나 기관이 어떤 조치를 했나요?",
        reason: "이미 진행된 조치를 알아야 빠진 절차와 다음 행동을 찾을 수 있습니다.",
        placeholder: "예: 상담 완료, 보호자 통보, 회사 확인 중"
      }
    ]
  };

  const roleQuestion = {
    student: {
      question: "학생 본인이 지금 가장 걱정하는 점은 무엇인가요?",
      reason: "학생 관점에서는 보호, 치료, 불이익 방지, 설명 요청을 먼저 정리해야 합니다.",
      placeholder: "예: 치료비, 출석, 실습 평가, 회사와 학교 책임"
    },
    teacher: {
      question: "선생님이 남긴 상담·지도·보고 기록이 있나요?",
      reason: "교사 관점에서는 학생 보호와 지도 절차 기록이 중요합니다.",
      placeholder: "예: 상담일지, 보호자 통화, 관리자 보고"
    },
    parent: {
      question: "학부모가 학교나 기관에서 받은 안내가 있나요?",
      reason: "보호자 안내와 동의, 공식 답변 여부를 확인해야 합니다.",
      placeholder: "예: 문자 안내, 통화 내용, 공문"
    },
    principal: {
      question: "학교장 또는 관리자가 이미 지시하거나 결재한 조치가 있나요?",
      reason: "관리자 관점에서는 보고체계, 안전관리, 민원 대응 기록이 중요합니다.",
      placeholder: "예: 실습 중단 지시, 교육청 보고 검토"
    },
    staff: {
      question: "행정 처리나 공문으로 남긴 기록이 있나요?",
      reason: "행정직 관점에서는 계약, 공문, 결재, 접수 기록이 판단의 출발점입니다.",
      placeholder: "예: 공문 접수, 내부 결재, 계약서"
    }
  }[userRole];

  const scenario = analyzeQuestionScenario(question, preset);
  if (scenario.type === "fieldTrainingScopeIssue") {
    const scopeProfile = scenario.scopeProfile || getFieldTrainingScopeProfile(question);
    const questions = [];
    const addQuestion = (item) => questions.push(item);
    const hasTimeDetail = /\d{1,2}시|\d+분|\d+시간|퇴근시각|종료시각|시작시각|실제퇴근/.test(normalized);
    const hasActorDetail = /누가|멘토|담당|직원|근로자|사수|선배|관리자|반장|팀장|회사담당/.test(normalized);
    const hasContractDetail = /협약서|계약서|실습계획|표준협약|직무기술서|업무범위/.test(normalized);
    const hasSchoolAction = /학교|지도교사|선생|담임|취업부|알렸|보고|상담|확인요청|기업에/.test(normalized);
    const hasStudentConcern = /불이익|보복|평가|거절|싫다|힘들|고충|고민|스트레스/.test(normalized);
    const hasSafetyConcern = /위험|기계|설비|화학|분진|보호구|다칠|안전/.test(normalized);

    if (scopeProfile.kind === "afterHoursCleaning" || /종료후|퇴근후|일과후|마친후|끝난후/.test(normalized)) {
      addQuestion({
        question: "정해진 실습 종료 시각과 실제 퇴근 시각이 각각 언제였나요?",
        reason: "실습시간 종료 후 지시인지, 협약된 실습시간 안의 활동인지가 이 사안의 첫 판단 기준입니다.",
        placeholder: "예: 실습은 17시 종료, 청소 후 17시 30분 퇴근, 거의 매일"
      });
    } else if (!hasTimeDetail) {
      addQuestion({
        question: "문제가 된 지시가 언제, 얼마나 자주, 어느 정도 시간 동안 이루어졌나요?",
        reason: "일회성 안내인지 반복 지시인지에 따라 학교의 대응 강도가 달라집니다.",
        placeholder: "예: 이번 주 3회, 매번 20분 정도, 실습 종료 직전"
      });
    }

    if (!hasActorDetail) {
      addQuestion({
        question: "그 지시를 한 사람은 기업 담당 멘토인가요, 현장 직원인가요, 또는 다른 사람인가요?",
        reason: "지시 권한이 있는 사람인지 확인해야 기업에 어떤 방식으로 시정 요청할지 정할 수 있습니다.",
        placeholder: "예: 현장 직원, 담당 멘토는 아님, 정확히 모름"
      });
    }

    if (!hasContractDetail) {
      addQuestion({
        question: scopeProfile.scopeCheck,
        reason: "실습 범위 안의 교육활동인지, 교육 목적 밖 업무 전가인지 구분하는 핵심 자료입니다.",
        placeholder: scopeProfile.scopePlaceholder
      });
    }

    if (!hasSchoolAction) {
      addQuestion({
        question: "학교 현장실습 담당자나 지도교사에게 이미 알렸고, 기업 확인 요청이 있었나요?",
        reason: "학생이 기업 안에서 직접 해결하기보다 학교가 사실 확인과 시정 요청의 중심이 되는 것이 안전합니다.",
        placeholder: "예: 학생 상담만 받음, 기업 확인 전, 지도교사에게 아직 미보고"
      });
    }

    if (!hasStudentConcern) {
      addQuestion({
        question: "학생이 거절하거나 학교에 알렸을 때 평가·취업·분위기상 불이익을 걱정하고 있나요?",
        reason: "불이익 우려가 있으면 학교가 학생 보호와 지시 일원화를 함께 요청해야 합니다.",
        placeholder: "예: 평가 불이익 걱정, 회사 눈치가 보임, 불이익 우려는 아직 없음"
      });
    }

    if (hasSafetyConcern) {
      addQuestion({
        question: "지시된 일이 기계, 화학물질, 분진, 보호구 같은 안전 위험과 연결되어 있나요?",
        reason: "위험요소가 있으면 단순 업무범위 문제가 아니라 안전교육과 보호조치 확인까지 필요합니다.",
        placeholder: "예: 기계 주변, 분진 있음, 보호구 없음"
      });
    }

    if (roleQuestion) {
      addQuestion(roleQuestion);
    }

    const uniqueScopeQuestions = [];
    const seenScopeQuestions = new Set();
    questions.forEach((item) => {
      if (!seenScopeQuestions.has(item.question)) {
        seenScopeQuestions.add(item.question);
        uniqueScopeQuestions.push(item);
      }
    });

    return uniqueScopeQuestions.slice(0, 5);
  }

  const questions = [...(byTopic[preset.type] || byTopic.general)];

  if (preset.type === "fieldTraining" && /청소|잡무|업무외|업무가아니|반복|자꾸|시키|시킴|재료|심부름|기존근로자/.test(normalized)) {
    const scopeProfile = getFieldTrainingScopeProfile(normalized);

    questions.unshift(
      {
        question: "업무 외 지시를 한 사람은 기업 담당 멘토인가요, 기업 내부 직원인가요, 또는 다른 사람인가요?",
        reason: "누가 지시했는지에 따라 지시 권한과 기업의 관리 책임 확인 방향이 달라집니다.",
        placeholder: "예: 같은 라인 직원, 현장 멘토 아님, 담당자 모름"
      },
      {
        question: scopeProfile.scopeCheck,
        reason: "실습 범위 안의 교육활동인지, 교육 목적 밖 잡무 전가인지 구분하는 핵심 자료입니다.",
        placeholder: scopeProfile.scopePlaceholder
      },
      {
        question: "학생이 거절하거나 학교에 알렸을 때 불이익을 걱정하고 있나요?",
        reason: "보복·불이익 우려가 있으면 학교가 기업과 직접 확인하고 학생 보호 조치를 세워야 합니다.",
        placeholder: "예: 평가 불이익 걱정, 아직 학교에 말하지 못함"
      }
    );
  }

  if (hasFriendContext && preset.type === "fieldTraining") {
    questions.push({
      question: "친구 일을 도우러 간 상황이 공식 실습 업무였나요, 개인적인 부탁이었나요?",
      reason: "공식 업무 범위인지에 따라 학교와 회사의 확인 지점이 달라질 수 있습니다.",
      placeholder: "예: 같은 실습 업무, 친구 부탁, 담당자 허락 여부 모름"
    });
  }

  if (hasSeriousInjury || riskSignals.length) {
    questions.push({
      question: "진단명, 치료 기간, 장해 가능성처럼 피해 정도를 확인할 자료가 있나요?",
      reason: "중대한 부상이나 분쟁 가능성이 있으면 전문가 확인과 공식 보고를 우선 검토해야 합니다.",
      placeholder: "예: 팔 골절, 전치 6주, 수술 예정, 자료는 아직 없음"
    });
  }

  if (roleQuestion) {
    questions.push(roleQuestion);
  }

  const unique = [];
  const seen = new Set();
  questions.forEach((item) => {
    if (!seen.has(item.question)) {
      seen.add(item.question);
      unique.push(item);
    }
  });

  return unique.slice(0, 6);
}

function renderRefinementPanel(questions) {
  if (!questions.length) {
    return "";
  }

  return `
    <section class="clarifier-panel" aria-label="정확도를 높이는 보강 질문">
      <div class="clarifier-head">
        <div>
          <span>질문을 더 정확하게</span>
          <h3>부족한 사실을 확인해 볼까요?</h3>
          <p>답할 수 있는 것만 적어도 됩니다. 모르거나 없거나 민감한 내용은 그대로 표시해도 검색 방향을 좁히는 데 도움이 됩니다.</p>
        </div>
      </div>
      <form id="clarifierForm" data-count="${questions.length}">
        <div class="clarifier-list">
          ${questions.map((item, index) => `
            <article class="clarifier-item">
              <label for="clarifier-note-${index}">${escapeHtml(item.question)}</label>
              <p class="clarifier-reason">${escapeHtml(item.reason)}</p>
              <input type="hidden" name="question-${index}" value="${escapeHtml(item.question)}">
              <div class="clarifier-grid">
                <select name="status-${index}" aria-label="${escapeHtml(item.question)} 답변 상태">
                  <option value="answer">답변 입력</option>
                  <option value="unknown">모름</option>
                  <option value="none">없음/해당 없음</option>
                  <option value="sensitive">민감해서 생략</option>
                </select>
                <textarea id="clarifier-note-${index}" name="note-${index}" rows="2" placeholder="${escapeHtml(item.placeholder)}"></textarea>
              </div>
            </article>
          `).join("")}
        </div>
        <p class="clarifier-note">실명, 주민번호, 전화번호, 주소, 회사 내부 비밀처럼 민감한 정보는 쓰지 않아도 됩니다.</p>
        <div class="clarifier-actions">
          <button class="primary-action clarifier-submit" type="submit">답변 반영해서 다시 찾기</button>
          <span id="clarifierFeedback" class="clarifier-feedback" role="status"></span>
        </div>
      </form>
    </section>
  `;
}

function applyClarifierAnswers(formElement) {
  const count = Number(formElement.dataset.count || 0);
  const answers = [];

  for (let index = 0; index < count; index += 1) {
    const question = formElement.elements[`question-${index}`]?.value.trim();
    const status = formElement.elements[`status-${index}`]?.value || "answer";
    const note = formElement.elements[`note-${index}`]?.value.trim() || "";

    if (!question) {
      continue;
    }

    if (status === "answer" && !note) {
      continue;
    }

    answers.push({ question, status, note });
  }

  const feedback = formElement.querySelector("#clarifierFeedback");

  if (!answers.length) {
    if (feedback) {
      feedback.textContent = "아직 반영할 내용이 없습니다. 필요한 항목만 적거나 모름·없음·생략을 선택해 주세요.";
    }
    return;
  }

  questionInput.value = buildRefinedQuestion(stripPreviousRefinement(questionInput.value), answers);
  if (feedback) {
    feedback.textContent = "추가 확인 내용을 반영해 다시 찾습니다.";
  }
  skipNextAutoScroll = false;
  window.setTimeout(() => form.requestSubmit(), 0);
}

function applyLegalGuideClarifierAnswers(formElement) {
  const count = Number(formElement.dataset.count || 0);
  const answers = [];

  for (let index = 0; index < count; index += 1) {
    const question = formElement.elements[`question-${index}`]?.value.trim();
    const status = formElement.elements[`status-${index}`]?.value || "answer";
    const note = formElement.elements[`note-${index}`]?.value.trim() || "";

    if (!question) {
      continue;
    }

    if (status === "answer" && !note) {
      continue;
    }

    answers.push({ question, status, note });
  }

  const feedback = formElement.querySelector("#guideClarifierFeedback");

  if (!answers.length) {
    if (feedback) {
      feedback.textContent = "아직 반영할 내용이 없습니다. 필요한 항목만 적거나 모름·없음·생략을 선택해 주세요.";
    }
    return;
  }

  questionInput.value = buildRefinedQuestion(stripPreviousRefinement(questionInput.value), answers);
  if (feedback) {
    feedback.textContent = "추가 확인 내용을 반영해 다시 답변합니다.";
  }
  activateTool("legal");
  skipNextAutoScroll = false;
  window.setTimeout(() => form.requestSubmit(), 0);
}

function applyGuideClarifierAnswers(formElement) {
  const count = Number(formElement.dataset.count || 0);
  const answers = [];

  for (let index = 0; index < count; index += 1) {
    const question = formElement.elements[`question-${index}`]?.value.trim();
    const status = formElement.elements[`status-${index}`]?.value || "answer";
    const note = formElement.elements[`note-${index}`]?.value.trim() || "";

    if (!question) {
      continue;
    }

    if (status === "answer" && !note) {
      continue;
    }

    answers.push({ question, status, note });
  }

  const feedback = formElement.querySelector("#guideClarifierFeedback");

  if (!answers.length) {
    if (feedback) {
      feedback.textContent = "아직 반영할 내용이 없습니다. 필요한 항목만 적거나 모름·없음·생략을 선택해 주세요.";
    }
    return;
  }

  guideQuestionInput.value = buildRefinedQuestion(stripPreviousRefinement(guideQuestionInput.value), answers);
  if (feedback) {
    feedback.textContent = "추가 확인 내용을 반영해 다시 답변합니다.";
  }
  window.setTimeout(() => renderPolicyGuideResult(), 0);
}

function applyLegalGuideIntentConfirmation(formElement) {
  const selectedIndex = Number(formElement.elements["intent-index"]?.value ?? -1);
  const feedback = formElement.querySelector("#guideIntentFeedback");

  if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
    if (feedback) {
      feedback.textContent = "먼저 실제 질문 의도와 가장 가까운 항목을 선택해 주세요.";
    }
    return;
  }

  const label = formElement.elements[`intent-label-${selectedIndex}`]?.value.trim() || "질문 요지";
  const code = formElement.elements[`intent-code-${selectedIndex}`]?.value.trim() || "";
  const summary = formElement.elements[`intent-summary-${selectedIndex}`]?.value.trim() || label;
  const note = formElement.elements["intent-note"]?.value.trim() || "";

  if (code === "manualIntent" && !note) {
    if (feedback) {
      feedback.textContent = "직접 입력을 선택한 경우 실제 질문 요지를 추가 힌트에 적어 주세요.";
    }
    return;
  }

  const answerText = [label, summary, code ? `intent=${code}` : "", note].filter(Boolean).join(" - ");

  questionInput.value = buildRefinedQuestion(stripPreviousRefinement(questionInput.value), [{
    question: "질문 요지",
    status: "answer",
    note: answerText
  }]);

  if (feedback) {
    feedback.textContent = "선택한 질문 요지를 반영해 다시 답변합니다.";
  }
  activateTool("legal");
  skipNextAutoScroll = false;
  window.setTimeout(() => form.requestSubmit(), 0);
}

function applyGuideIntentConfirmation(formElement) {
  const selectedIndex = Number(formElement.elements["intent-index"]?.value ?? -1);
  const feedback = formElement.querySelector("#guideIntentFeedback");

  if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
    if (feedback) {
      feedback.textContent = "먼저 실제 질문 의도와 가장 가까운 항목을 선택해 주세요.";
    }
    return;
  }

  const label = formElement.elements[`intent-label-${selectedIndex}`]?.value.trim() || "질문 요지";
  const code = formElement.elements[`intent-code-${selectedIndex}`]?.value.trim() || "";
  const summary = formElement.elements[`intent-summary-${selectedIndex}`]?.value.trim() || label;
  const note = formElement.elements["intent-note"]?.value.trim() || "";

  if (code === "manualIntent" && !note) {
    if (feedback) {
      feedback.textContent = "직접 입력을 선택한 경우 실제 질문 요지를 추가 힌트에 적어 주세요.";
    }
    return;
  }

  const answerText = [label, summary, code ? `intent=${code}` : "", note].filter(Boolean).join(" - ");

  guideQuestionInput.value = buildRefinedQuestion(stripPreviousRefinement(guideQuestionInput.value), [{
    question: "질문 요지",
    status: "answer",
    note: answerText
  }]);

  if (feedback) {
    feedback.textContent = "선택한 질문 요지를 반영해 다시 답변합니다.";
  }
  window.setTimeout(() => renderPolicyGuideResult(), 0);
}

function applyGuideFollowupRequest(button) {
  const prompt = button?.dataset?.followupPrompt || "";
  if (!prompt || !guideQuestionInput) return;
  const baseQuestion = stripPreviousFollowupRequest(guideQuestionInput.value || "");
  guideQuestionInput.value = `${baseQuestion}\n\n추가 요청: ${prompt}`;
  window.setTimeout(() => renderPolicyGuideResult(), 0);
}

function applyLegalFollowupRequest(button) {
  const prompt = button?.dataset?.followupPrompt || "";
  if (!prompt || !questionInput) return;
  const baseQuestion = stripPreviousFollowupRequest(questionInput.value || "");
  questionInput.value = `${baseQuestion}\n\n추가 요청: ${prompt}`;
  skipNextAutoScroll = false;
  window.setTimeout(() => form.requestSubmit(), 0);
}

function buildRefinedQuestion(baseQuestion, answers) {
  const lines = answers.map((item) => {
    const statusLabel = getClarifierStatusLabel(item.status);
    const value = item.status === "answer"
      ? item.note
      : item.note
        ? `${statusLabel} - ${item.note}`
        : statusLabel;

    return `- ${item.question}: ${value}`;
  });

  return `${baseQuestion.trim()}\n\n추가 확인 내용:\n${lines.join("\n")}`;
}

function stripPreviousRefinement(value) {
  return String(value || "").split(/\n\n추가 확인 내용:/)[0].trim();
}

function stripPreviousFollowupRequest(value) {
  return String(value || "").split(/\n\n추가 요청:/)[0].trim();
}

function getClarifierStatusLabel(status) {
  const labels = {
    answer: "답변 입력",
    unknown: "모름",
    none: "없음/해당 없음",
    sensitive: "민감해서 생략"
  };

  return labels[status] || labels.answer;
}

function getRoleGuide(userRole) {
  return roleGuides[userRole] || roleGuides.auto;
}

function getPartyGuide(partyRole) {
  return partyGuides[partyRole] || partyGuides.auto;
}

function getSourcePlan(preset, scopes) {
  const basePlan = sourcePlanByTopic[preset.type] || sourcePlanByTopic.general;
  const filteredPlan = basePlan.filter((type) => {
    if (!scopes.length || type === "expert" || type === "safety") {
      return true;
    }

    if (type === "law") {
      return scopes.includes("law") || scopes.includes("source");
    }

    if (type === "admin") {
      return scopes.includes("admin") || scopes.includes("source");
    }

    if (type === "case") {
      return scopes.includes("case");
    }

    return true;
  });

  return filteredPlan.map((type) => sourceCatalog[type]).filter(Boolean);
}

function getFactPrompts(preset, userRole) {
  const prompts = factPromptsByTopic[preset.type] || factPromptsByTopic.general;
  const rolePrompt = {
    student: "학교나 선생님에게 이미 알린 내용이 있나요?",
    teacher: "상담·지도 기록이 남아 있나요?",
    parent: "학교에서 받은 안내문이나 문자 기록이 있나요?",
    principal: "학교장 또는 관리자의 조치 기록이 있나요?",
    staff: "공문, 계약서, 내부 결재 기록이 있나요?"
  }[userRole];

  return rolePrompt ? [...prompts, rolePrompt].slice(0, 5) : prompts;
}

function getOfficialMaterials(preset, scenario = {}, question = "") {
  if (scenario.type === "fieldTrainingScopeIssue") {
    return buildFieldTrainingScopeMaterials(question);
  }

  if (scenario.type === "safetyPrevention") {
    return buildSafetyPreventionMaterials();
  }

  if (preset.type === "schoolSafety") {
    return buildSchoolSafetyMaterials(question, scenario);
  }

  return officialMaterialsByTopic[preset.type] || officialMaterialsByTopic.general;
}

function buildSchoolSafetyMaterials(question = "", scenario = {}) {
  const normalized = compactText(question);
  const actualInjury = hasActualInjurySignal(normalized);
  const workerSafety = /근로자|조리실무사|외부업체|용역|공사|급식실|산업안전|산재|중대재해/.test(normalized);
  const majorEvent = !hasOccurrenceNegation(normalized) && (/사망|중상|입원|수술|추락해사망|끼임사망/.test(normalized) || (actualInjury && workerSafety));

  if (scenario.type === "schoolSafetyMinor" || (!majorEvent && /체육시간|학교안전공제|과학실|화학물질|두통|타박상|학생/.test(normalized))) {
    return [
      {
        type: "law",
        title: "학교안전사고 예방 및 보상에 관한 법률",
        source: "국가법령정보센터",
        use: "학교 교육활동 중 사고인지, 학교안전공제 안내와 보호자 통보가 필요한지 확인합니다.",
        query: "학교안전사고 예방 및 보상에 관한 법률",
        actionChecks: [
          "교육활동 해당 여부와 학생 상태 기록",
          "보호자 안내와 보건실·담당교사 조치 기록",
          "학교안전공제 안내 필요 여부 확인"
        ]
      },
      {
        type: "law",
        title: "초중등교육법",
        source: "국가법령정보센터",
        use: "학교의 학생 지도와 교육활동 운영 기준을 함께 확인합니다.",
        query: "초중등교육법 학생 지도 안전"
      },
      {
        type: "admin",
        title: "교육청 학교안전 관리 자료",
        source: "교육부·교육청",
        use: "수업, 실험, 체육활동 중 안전지도와 보호자 안내 절차를 확인합니다.",
        query: "학교안전 사고 예방 보호자 안내",
        url: "https://www.moe.go.kr/main.do?s=moe"
      }
    ];
  }

  if (!majorEvent) {
    return buildSafetyPreventionMaterials();
  }

  return officialMaterialsByTopic.schoolSafety;
}

function buildSafetyPreventionMaterials() {
  return [
    {
      type: "law",
      title: "중대재해 처벌 등에 관한 법률",
      source: "국가법령정보센터",
      use: "사고 발생 보고가 아니라, 경영책임자 등의 안전 및 보건 확보의무와 관리체계 점검 기준을 확인합니다.",
      query: "중대재해 처벌 등에 관한 법률 제4조 안전 및 보건 확보의무",
      provisions: [
        { title: "제4조 사업주와 경영책임자등의 안전 및 보건 확보의무", why: "재해예방에 필요한 인력·예산·점검·개선 체계를 갖추었는지 확인합니다.", check: "안전보건 목표, 책임자, 예산, 점검 주기, 개선 이행 기록을 점검표로 만듭니다." },
        { title: "제5조 도급·용역·위탁 등 관계에서의 안전 및 보건 확보의무", why: "학교 공사, 시설관리, 급식, 통학 등 위탁·용역 관계의 안전관리 범위를 확인합니다.", check: "계약서, 과업지시서, 업체 안전관리계획, 합동점검 기록을 확인합니다." }
      ],
      actionChecks: [
        "사고 발생 보고서가 아니라 예방 점검표로 작성",
        "학교 직접 업무와 도급·용역·위탁 업무를 분리",
        "점검 결과를 개선 이행 기록까지 연결"
      ]
    },
    {
      type: "law",
      title: "산업안전보건법",
      source: "국가법령정보센터",
      use: "학교와 작업 현장의 안전보건교육, 위험성평가, 안전조치, 관리감독 체계를 확인합니다.",
      query: "산업안전보건법 안전보건교육 위험성평가 안전조치",
      provisions: [
        { title: "제29조 근로자에 대한 안전보건교육", why: "직원과 현장 작업자가 필요한 안전보건교육을 받았는지 확인합니다.", check: "교육 계획, 이수 기록, 신규·작업변경 교육 여부를 점검합니다." },
        { title: "제36조 위험성평가의 실시", why: "유해·위험요인을 찾아 개선하는 정기 절차가 있는지 확인합니다.", check: "위험성평가표, 개선대책, 담당자, 완료일을 기록합니다." },
        { title: "제38조 안전조치", why: "기계·설비·추락·낙하 등 위험을 예방하기 위한 조치가 있는지 확인합니다.", check: "보호구, 안전표지, 접근통제, 작업표준, 점검표를 확인합니다." }
      ],
      actionChecks: [
        "정기 점검과 수시 점검을 나누어 관리",
        "위험성평가 결과가 실제 개선조치로 이어졌는지 확인",
        "교육·점검·개선 완료 기록을 보존"
      ]
    },
    {
      type: "admin",
      title: "학교 안전보건관리체계 점검 자료",
      source: "교육부·교육청·고용노동부",
      use: "학교 현장에 맞는 안전보건관리체계, 위탁업체 점검, 위험성평가 양식을 확인합니다.",
      query: "학교 안전보건관리체계 위험성평가 점검표",
      url: "https://www.moel.go.kr/index.do",
      actionChecks: [
        "학교장, 행정실, 시설관리, 급식, 외부업체 담당 역할 분담",
        "월별·분기별 점검표와 개선 이행 관리표 작성",
        "사고 발생 전 예방 기록으로 관리"
      ]
    }
  ];
}

function buildFieldTrainingScopeMaterials(question = "") {
  const normalized = compactText(question);
  const scopeProfile = getFieldTrainingScopeProfile(question);
  const hasSafetyConcern = /위험|기계|설비|화학|분진|보호구|유해|다칠|안전/.test(normalized);
  const materials = [
    {
      type: "law",
      title: "직업교육훈련 촉진법",
      source: "국가법령정보센터",
      use: "현장실습계약, 실습 내용, 산업체 책무, 안전·권익보호 교육 기준을 대조합니다.",
      query: "직업교육훈련 촉진법 현장실습계약 현장실습산업체 책무",
      provisions: [
        { title: "제7조의2 현장실습 운영기준", why: "학교가 현장실습을 어떤 기준으로 운영·지도·점검해야 하는지 확인합니다.", check: "운영계획, 순회지도, 상담기록, 기업 확인 기록을 대조합니다." },
        { title: "제8조 현장실습산업체의 선정 등", why: "학생 전공과 실습프로그램, 시설·설비, 실습환경이 적정했는지 확인합니다.", check: "산업체 선정자료와 실제 실습 직무를 비교합니다." },
        { title: "제9조 현장실습계약 등", why: "실습 내용과 방법, 권리·의무가 계약서에 어떻게 정해졌는지 확인합니다.", check: `표준협약서와 ${scopeProfile.instructionName}이 맞는지 표시합니다.` },
        { title: "제9조의4 현장실습산업체의 책무", why: "산업체가 교육 목적에 맞는 실습환경과 학생 보호 조치를 했는지 확인합니다.", check: "담당 멘토, 지시 권한, 시정 요청 답변을 확인합니다." },
        { title: "제9조의5 현장실습 안전교육 등", why: "학생 권익보호 교육과 안전교육이 이루어졌는지 확인합니다.", check: "학생이 부당하거나 위험한 지시를 어떻게 알리고 보호받는지 안내됐는지 봅니다." }
      ],
      actionChecks: [
        `${scopeProfile.instructionName}이 계약상 실습 내용에 포함되는지 확인`,
        `${scopeProfile.keyQuestion}를 확인해 교육 목적 밖 잡무 전가인지 구분`,
        "학교가 기업 담당자에게 업무 범위 확인과 시정 요청을 했는지 기록"
      ]
    },
    {
      type: "law",
      title: "근로기준법 직장 내 괴롭힘 관련 조항",
      source: "국가법령정보센터",
      use: "반복 지시가 지위 우위, 업무상 적정범위 초과, 실습환경 악화와 연결되는지 보조적으로 확인합니다.",
      query: "근로기준법 제76조의2 제76조의3 직장 내 괴롭힘",
      provisions: [
        { title: "제76조의2 직장 내 괴롭힘의 금지", why: "지위 또는 관계의 우위를 이용해 업무상 적정범위를 넘었는지 검토합니다.", check: "반복성, 불필요한 지시, 모욕·보복·실습환경 악화 여부를 분리합니다." },
        { title: "제76조의3 직장 내 괴롭힘 발생 시 조치", why: "신고·인지 후 사실 확인과 피해자 보호 흐름을 참고합니다.", check: "학생에게 불이익이 없도록 학교와 기업의 조치 기록을 남깁니다." }
      ],
      actionChecks: [
        "업무 외 지시 자체보다 반복성·불필요성·지시 권한·불이익 우려를 중심으로 확인",
        "괴롭힘이라고 단정하기 전 실습계약과 실제 업무 필요성을 먼저 대조",
        "모욕, 보복, 따돌림, 위험 작업이 함께 있으면 상담 단계 상향"
      ]
    },
    {
      type: "admin",
      title: "직업계고 현장실습 운영 자료",
      source: "교육부·교육청",
      use: "학교 현장실습 운영 매뉴얼, 표준협약서, 학생 권익보호와 기업 지도 절차를 확인합니다.",
      query: "직업계고 현장실습 표준협약서 권익보호",
      url: "https://www.moe.go.kr/main.do?s=moe",
      caseHints: [
        { title: "표준협약서와 실제 업무 불일치 사례", why: "실습계약서에는 없는 잡무 지시가 반복될 때 확인해야 할 유형입니다.", check: "협약서, 실습일지, 기업 담당자 확인, 학교 상담기록을 대조합니다." },
        { title: "현장실습생 권익보호 상담 사례", why: "학생이 기업에서 직접 문제 제기하기 어려운 경우 학교가 중재해야 하는 유형입니다.", check: "학교 담당자 상담, 기업 확인, 시정 요청 기록을 남깁니다." }
      ],
      actionChecks: [
        "학생 상담 후 기업 담당 멘토와 업무 범위 확인",
        "업무 범위 밖 반복 지시이면 시정 요청과 순회지도 강화",
        "학생에게 불이익이 생기지 않도록 출결·평가 처리 별도 관리"
      ]
    }
  ];

  if (hasSafetyConcern) {
    materials.push({
      type: "safety",
      title: `${scopeProfile.instructionName} 관련 안전 자료`,
      source: "안전보건공단",
      use: "업무 외 지시가 기계·화학물질·분진 등 위험요소와 연결될 때 안전교육과 보호조치 기준을 확인합니다.",
      query: "작업 안전 보호구 위험성평가",
      url: "https://www.kosha.or.kr/kosha/index.do"
    });
  }

  return materials;
}

function getMaterialKindLabel(type) {
  const labels = {
    law: "법령",
    admin: "행정자료",
    case: "판례",
    safety: "안전자료"
  };

  return labels[type] || "자료";
}

function getMaterialActionLabel(type) {
  const labels = {
    law: "법령명 검색",
    admin: "공식 자료 확인",
    case: "판례 검색",
    safety: "안전 자료 확인"
  };

  return labels[type] || "자료 확인";
}

function getMaterialUrl(material, encodedQuestion) {
  if (material.url && !isGenericPolicyHomepageUrl(material.url)) {
    return material.url;
  }

  const decodedQuestion = safeDecodeURIComponent(encodedQuestion);
  const queryText = material.query || decodedQuestion;
  const query = encodeURIComponent(queryText);

  if (material.type === "case") {
    return `https://www.scourt.go.kr/portal/information/events/search/search.jsp?searchWord=${query}`;
  }

  if (material.type === "admin" || material.type === "safety") {
    const domain = getPolicySourceDomainFromUrl(material.url)
      || getPolicySourceDefaultDomain(`${material.source || ""} ${material.title || ""}`)
      || (material.type === "safety" ? "kosha.or.kr" : "moe.go.kr");
    return buildOfficialSiteSearchUrl(domain, queryText);
  }

  return `https://www.law.go.kr/LSW/lsSc.do?query=${query}`;
}

function safeDecodeURIComponent(value = "") {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function detectRiskSignals(question) {
  const normalized = String(question || "").replace(/\s+/g, "");
  return highRiskWords.filter((word) => {
    const compactWord = word.replace(/\s+/g, "");

    if (!normalized.includes(compactWord)) {
      return false;
    }

    if (compactWord === "중대재해" && /중대재해처벌법(대비|예방|점검|교육|매뉴얼)|중대재해(대비|예방|점검|교육)|사고가?발생한것은아닙니다/.test(normalized)) {
      return /사망|중상|골절|입원|수술|발생|추락|끼임|깔림/.test(normalized) && !/사고가?발생한것은아닙니다/.test(normalized);
    }

    if (compactWord === "징계" && /징계(요구는?|요청은?)?없|징계는?아니|징계하지않|징계요구는없/.test(normalized)) {
      return false;
    }

    if (compactWord === "해고" && /해고는?아니|해고없|해고통보없/.test(normalized)) {
      return false;
    }

    return true;
  }).slice(0, 4);
}

function hydrateFromUrl() {
  const requestedTool = getRequestedToolParam();
  if (!requestedTool) {
    syncLawWindowMode();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const question = params.get("q") || params.get("question");

  if (!question) {
    return;
  }

  if (requestedTool === "guide") {
    guideQuestionInput.value = question;
    setSelectValue(guideOfficeInput, params.get("office") || params.get("educationOffice"));
    setSelectValue(guideRoleInput, params.get("guideRole") || params.get("role"));
    updateGuideCategoryOptionsForRole({ keepValue: true });
    setSelectValue(guideCategoryInput, params.get("guideCategory") || params.get("category"));

    if (params.get("run") === "1") {
      renderPolicyGuideResult();
    }

    return;
  }

  questionInput.value = question;
  setSelectValue(userRoleInput, params.get("role"));
  setSelectValue(partyRoleInput, params.get("party") || params.get("partyRole"));
  updatePolicyCategoryOptionsForRole({ keepValue: true });
  updateTopicMajorOptionsForCurrentRole({ keepValue: true });
  setTopicSelectionFromUrl(params);
  setSelectValue(answerModeInput, params.get("answerMode") || params.get("answer") || params.get("mode"));
  setScopesFromUrl(params.get("scopes"));

  if (params.get("run") === "1") {
    skipNextAutoScroll = true;
    form.requestSubmit();
  }
}

function setSelectValue(select, value) {
  if (!select || !value) {
    return;
  }

  const hasOption = [...select.options].some((option) => option.value === value);
  if (hasOption) {
    select.value = value;
  }
}

function setScopesFromUrl(value) {
  if (!value) {
    return;
  }

  const nextScopes = value.split(",").map((scope) => scope.trim()).filter(Boolean);
  form.querySelectorAll("input[name='scope']").forEach((input) => {
    input.checked = nextScopes.includes(input.value);
  });
}

function initializeTopicControls() {
  if (!topicMajorInput || !topicMiddleInput || !topicMinorInput) {
    syncTopicTypeInput();
    return;
  }

  updateTopicMajorOptionsForCurrentRole({ keepValue: true });
  topicMajorInput.addEventListener("change", () => populateTopicMiddleSelect(false));
  topicMiddleInput.addEventListener("change", () => populateTopicMinorSelect(false));
  topicMinorInput.addEventListener("change", syncTopicTypeInput);
}

function initializePolicyCategoryControls() {
  updatePolicyCategoryOptionsForRole({ keepValue: true });
  updateGuideCategoryOptionsForRole({ keepValue: true });
  policyRoleInput?.addEventListener("change", () => {
    updatePolicyCategoryOptionsForRole({ keepValue: false });
    updateTopicMajorOptionsForCurrentRole({ keepValue: false });
  });
  policyCategoryInput?.addEventListener("change", () => {
    syncTopicSelectionFromPolicyCategory({ force: true });
  });
  userRoleInput?.addEventListener("change", () => {
    updatePolicyCategoryOptionsForRole({ keepValue: true });
    updateTopicMajorOptionsForCurrentRole({ keepValue: true });
  });
  partyRoleInput?.addEventListener("change", () => {
    updatePolicyCategoryOptionsForRole({ keepValue: true });
    updateTopicMajorOptionsForCurrentRole({ keepValue: true });
  });
  guideRoleInput?.addEventListener("change", () => {
    updateGuideCategoryOptionsForRole({ keepValue: false });
  });
}

function getEffectiveTopicFilterRole() {
  if (policyRoleInput?.value && policyRoleInput.value !== "auto") {
    return policyRoleInput.value;
  }

  return mapPartyToPolicyRole(partyRoleInput?.value || "auto")
    || mapUserToPolicyRole(userRoleInput?.value || "auto")
    || "auto";
}

function updateTopicMajorOptionsForCurrentRole({ keepValue = true } = {}) {
  if (!topicMajorInput || !topicMiddleInput || !topicMinorInput) {
    syncTopicTypeInput();
    return;
  }

  const previousValue = keepValue ? topicMajorInput.value : "auto";
  const options = getTopicMajorOptionsForRole(getEffectiveTopicFilterRole());
  replaceOptions(topicMajorInput, options);
  setSelectValue(topicMajorInput, previousValue);
  if (!topicMajorInput.value) {
    topicMajorInput.value = "auto";
  }
  populateTopicMiddleSelect(keepValue);
}

function syncTopicSelectionFromPolicyCategory({ force = false } = {}) {
  if (!policyCategoryInput || !topicMajorInput) {
    return;
  }

  const categoryCode = policyCategoryInput.value || "auto";
  if (categoryCode === "auto") {
    if (force) {
      setTopicSelection("auto", "auto", "auto");
    }
    return;
  }

  const mappedTopic = policyCategoryTopicMap[categoryCode];
  if (!mappedTopic) {
    return;
  }

  const currentTopic = getSelectedTopicContext();
  const hasManualTopic = currentTopic.major && currentTopic.major !== "auto";
  if (!force && hasManualTopic) {
    return;
  }

  setTopicSelection(
    mappedTopic.major || "auto",
    mappedTopic.middle || "auto",
    mappedTopic.minor || "auto"
  );
}

function setTopicSelection(major = "auto", middle = "auto", minor = "auto") {
  if (!topicMajorInput || !topicMiddleInput || !topicMinorInput) {
    if (topicTypeInput) {
      topicTypeInput.value = major || "auto";
    }
    return;
  }

  setSelectValue(topicMajorInput, major);
  populateTopicMiddleSelect(true);
  setSelectValue(topicMiddleInput, middle);
  populateTopicMinorSelect(true);
  setSelectValue(topicMinorInput, minor);
  syncTopicTypeInput();
}

function setTopicSelectionFromUrl(params) {
  const major = params.get("topicMajor") || params.get("major");
  const middle = params.get("topicMiddle") || params.get("middle");
  const minor = params.get("topicMinor") || params.get("minor");
  if (major) {
    setTopicSelection(major, middle || "auto", minor || "auto");
    return;
  }

  const legacyTopic = params.get("topic");
  if (!legacyTopic) {
    syncTopicTypeInput();
    return;
  }

  const majorEntry = Object.entries(topicTaxonomy).find(([, item]) => item.preset === legacyTopic);
  setTopicSelection(majorEntry?.[0] || "auto", "auto", "auto");
}

function populateTopicMiddleSelect(keepValue = true) {
  if (!topicMajorInput || !topicMiddleInput) {
    return;
  }

  const previousValue = keepValue ? topicMiddleInput.value : "auto";
  const middleOptions = topicTaxonomy[topicMajorInput.value]?.middles || [];
  replaceOptions(topicMiddleInput, [
    { value: "auto", label: topicMajorInput.value === "auto" ? "자동분류" : "대분류만" },
    ...middleOptions.map((item) => ({ value: item.value, label: item.label }))
  ]);
  setSelectValue(topicMiddleInput, previousValue);
  populateTopicMinorSelect(keepValue);
}

function populateTopicMinorSelect(keepValue = true) {
  if (!topicMajorInput || !topicMiddleInput || !topicMinorInput) {
    syncTopicTypeInput();
    return;
  }

  const previousValue = keepValue ? topicMinorInput.value : "auto";
  const minorOptions = getSelectedMiddleNode()?.minors || [];
  replaceOptions(topicMinorInput, [
    { value: "auto", label: minorOptions.length ? "중분류만" : "선택 안 함" },
    ...minorOptions.map((item) => ({ value: item.value, label: item.label }))
  ]);
  setSelectValue(topicMinorInput, previousValue);
  syncTopicTypeInput();
}

function replaceOptions(select, options) {
  select.innerHTML = "";
  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  });
}

function getSelectedMiddleNode() {
  const middleOptions = topicTaxonomy[topicMajorInput?.value]?.middles || [];
  return middleOptions.find((item) => item.value === topicMiddleInput?.value) || null;
}

function getSelectedMinorNode() {
  const minorOptions = getSelectedMiddleNode()?.minors || [];
  return minorOptions.find((item) => item.value === topicMinorInput?.value) || null;
}

function getSelectedTopicContext() {
  const majorNode = topicTaxonomy[topicMajorInput?.value] || topicTaxonomy.auto;
  const middleNode = getSelectedMiddleNode();
  const minorNode = getSelectedMinorNode();
  const labels = [majorNode, middleNode, minorNode]
    .map((item) => item?.label)
    .filter(Boolean);

  return {
    major: topicMajorInput?.value || "auto",
    middle: topicMiddleInput?.value || "auto",
    minor: topicMinorInput?.value || "auto",
    presetType: minorNode?.preset || middleNode?.preset || majorNode.preset || "auto",
    labels,
    label: labels.join(" > ") || "자동 분류",
    autoDetected: false
  };
}

function syncTopicTypeInput() {
  if (topicTypeInput) {
    topicTypeInput.value = getSelectedTopicContext().presetType;
  }
}

function resolveTopicContext(question, preset, selectedTopicContext = null) {
  if (selectedTopicContext?.major && selectedTopicContext.major !== "auto") {
    return {
      ...selectedTopicContext,
      autoDetected: false
    };
  }

  return buildTopicContextFromPath(inferTopicPath(question, preset), true);
}

function inferTopicPath(question, preset) {
  const normalized = compactText(question);
  const presetType = preset?.type || "general";
  const has = (pattern) => pattern.test(normalized);

  if (presetType === "apprenticeship" || has(/도제학교|산학일체형|일학습병행|기업훈련|훈련계약|훈련수당/)) {
    if (has(/수당|임금|급여/)) return { major: "fieldTraining", middle: "apprenticeship", minor: "allowance" };
    if (has(/계약|협약/)) return { major: "fieldTraining", middle: "apprenticeship", minor: "trainingContract" };
    return { major: "fieldTraining", middle: "apprenticeship", minor: has(/시간|야간|휴일|초과/) ? "trainingTime" : "auto" };
  }

  if (presetType === "overseasTraining" || has(/해외현장실습|해외실습|글로벌현장학습|호주|국외파견|해외/)) {
    if (has(/보험|안전|사고|위험/)) return { major: "fieldTraining", middle: "overseas", minor: "insurance" };
    if (has(/동의|보호자|안내/)) return { major: "fieldTraining", middle: "overseas", minor: "consent" };
    return { major: "fieldTraining", middle: "overseas", minor: has(/호주|국외|파견/) ? "australia" : "auto" };
  }

  if (has(/교외체험학습|가정체험학습|현장체험학습|체험학습|가정학습/)) {
    if (has(/보고서|결과보고|사후/)) return { major: "studentPathway", middle: "fieldExperience", minor: "report" };
    if (has(/출결|인정결석|학생부|생활기록부|생기부/)) return { major: "studentPathway", middle: "fieldExperience", minor: "attendance" };
    return { major: "studentPathway", middle: "fieldExperience", minor: "application" };
  }

  if (has(/재직자전형|특성화고특별전형|특성화고전형|동일계전형|선취업후진학|입학전형|전입학|편입학|졸업|학적/)) {
    if (has(/재직자|선취업후진학/)) return { major: "studentPathway", middle: "admissions", minor: "employedAdult" };
    if (has(/특별전형|동일계|입학전형/)) return { major: "studentPathway", middle: "admissions", minor: "vocationalSpecial" };
    return { major: "studentPathway", middle: "admissions", minor: "transferGraduation" };
  }

  if (has(/감염병|보건실|투약|응급처치|학생상담|상담기록|위기학생|자살|자해|wee|Wee/)) {
    if (has(/감염병|등교중지/)) return { major: "studentSupport", middle: "health", minor: "infection" };
    if (has(/상담|위기|자살|자해|wee|Wee/)) return { major: "studentSupport", middle: "health", minor: "counseling" };
    return { major: "studentSupport", middle: "health", minor: "medicine" };
  }

  if (has(/출석인정|인정결석|질병결석|미인정결석|결석계|등교중지|출결|지각|조퇴|결과/)) {
    if (has(/질병|감염병|등교중지|병원|진단서/)) return { major: "studentPathway", middle: "attendance", minor: "illnessAbsence" };
    if (has(/결석계|증빙|확인서|진단서|서류/)) return { major: "studentPathway", middle: "attendance", minor: "evidence" };
    return { major: "studentPathway", middle: "attendance", minor: "recognizedAbsence" };
  }

  if (has(/생활기록부|학교생활기록|생기부|학생부|기재요령|창의적체험활동|세부능력|특기사항|누가기록/)) {
    if (has(/정정|수정|오류|증빙|보존|보관/)) return { major: "studentPathway", middle: "records", minor: "correction" };
    if (has(/졸업|학적/)) return { major: "studentPathway", middle: "records", minor: "graduation" };
    return { major: "studentPathway", middle: "records", minor: "schoolRecord" };
  }

  if (has(/수업방해|지시불응|생활지도|휴대전화|휴대폰|소지품|학교생활규정|학생생활규정|학칙|분리조치|훈육|훈계/)) {
    if (has(/휴대전화|휴대폰|소지품/)) return { major: "studentSupport", middle: "guidance", minor: "phone" };
    if (has(/학칙|학교생활규정|학생생활규정/)) return { major: "studentSupport", middle: "guidance", minor: "rule" };
    return { major: "studentSupport", middle: "guidance", minor: "classroom" };
  }

  if (has(/장학금|교육비지원|교육급여|교육복지|수익자부담|자유수강권|환불|지원금/)) {
    if (has(/장학/)) return { major: "studentSupport", middle: "welfare", minor: "scholarship" };
    if (has(/수익자부담|자유수강권|환불/)) return { major: "studentSupport", middle: "welfare", minor: "userFee" };
    return { major: "studentSupport", middle: "welfare", minor: "educationAid" };
  }

  if (has(/NCS|ncs|엔씨에스|직업계고학점제|고교학점제|전문교과|실무과목|이수단위|학점|성취평가|학업성적관리/)) {
    if (has(/성적|평가|학업성적/)) return { major: "vocationalLearning", middle: "curriculum", minor: "assessment" };
    if (has(/학점|이수단위|고교학점제|직업계고학점제/)) return { major: "vocationalLearning", middle: "curriculum", minor: "credit" };
    return { major: "vocationalLearning", middle: "curriculum", minor: "ncs" };
  }

  if (has(/실험실습실|실습실|기자재|실습재료|실습장비|실습실안전|안전교육/)) {
    if (has(/안전|사고|보호구|위험/)) return { major: "vocationalLearning", middle: "practiceRoom", minor: "safety" };
    if (has(/예산|구입|검수|품의|물품/)) return { major: "vocationalLearning", middle: "practiceRoom", minor: "budget" };
    return { major: "vocationalLearning", middle: "practiceRoom", minor: "equipment" };
  }

  if (presetType === "fieldTraining") {
    if (has(/위험|기계|프레스|끼임|추락|감전|화상|사고|다쳤|다침|부상|골절|안전/)) {
      return { major: "fieldTraining", middle: "scope", minor: "safety" };
    }
    if (has(/시간종료|종료후|퇴근후|야간|휴일|잔업|초과|늦게/)) {
      return { major: "fieldTraining", middle: "scope", minor: "afterHours" };
    }
    if (has(/청소|잡무|심부름|업무외|업무범위|반복|재료|정리정돈/)) {
      return { major: "fieldTraining", middle: "scope", minor: "cleaning" };
    }
    return { major: "fieldTraining", middle: "scope", minor: "auto" };
  }

  if (presetType === "schoolSafety") {
    if (has(/중대재해|안전보건관리체계|위험성평가|경영책임자|위탁업체|외부업체/)) {
      if (has(/위탁|외부업체|사업장|급식실|조리실무사/)) return { major: "schoolSafety", middle: "seriousAccident", minor: "workplace" };
      if (has(/체계|점검표|예방|위험성평가/)) return { major: "schoolSafety", middle: "seriousAccident", minor: "safetySystem" };
      return { major: "schoolSafety", middle: "seriousAccident", minor: "schoolFacility" };
    }
    if (has(/보고|기록|교육청|조사표|산재/)) return { major: "schoolSafety", middle: "accident", minor: "report" };
    if (has(/예방|재발|점검|체크리스트|교육자료/)) return { major: "schoolSafety", middle: "accident", minor: "prevention" };
    return { major: "schoolSafety", middle: "accident", minor: has(/부상|치료|병원|타박상|두통|화상|골절/) ? "injury" : "auto" };
  }

  if (
    presetType === "schoolAdministration"
    || has(/교육행정|학교회계|예산|품의|검수|지출|증빙|영수증|세금계산서|정산|수의계약|생활기록부|학교생활기록|생기부|학생부|출결|인정결석|정정|기재요령|공문|결재|회의록|정보공개|보존기간/)
  ) {
    if (has(/예산|회계|품의|검수|지출|영수증|세금계산서|카드|정산|수의계약|계약/)) {
      if (has(/편성|본예산|추경|예산서/)) return { major: "schoolAdministration", middle: "budgetAccount", minor: "budgetPlan" };
      if (has(/계약|수의계약|검수|납품|공사|용역|물품/)) return { major: "schoolAdministration", middle: "budgetAccount", minor: "contractAccounting" };
      return { major: "schoolAdministration", middle: "budgetAccount", minor: "spendingEvidence" };
    }
    if (has(/생활기록부|학교생활기록|생기부|학생부|출결|인정결석|정정|기재요령|창의적체험활동|세부능력|특기사항|누가기록/)) {
      if (has(/출결|인정결석|결석|지각|조퇴|결과/)) return { major: "schoolAdministration", middle: "studentRecords", minor: "attendanceRecord" };
      if (has(/정정|보관|보존|증빙|오류|수정/)) return { major: "schoolAdministration", middle: "studentRecords", minor: "correction" };
      return { major: "schoolAdministration", middle: "studentRecords", minor: "schoolRecord" };
    }
    if (has(/정보공개|민원|공개청구/)) return { major: "schoolAdministration", middle: "adminProcedure", minor: "infoDisclosure" };
    if (has(/위원회|회의록|심의|협의회/)) return { major: "schoolAdministration", middle: "adminProcedure", minor: "committee" };
    return { major: "schoolAdministration", middle: "adminProcedure", minor: "document" };
  }

  if (presetType === "schoolViolence") {
    if (has(/불복|재심|행정심판|이의제기/)) return { major: "schoolViolence", middle: "procedure", minor: "appeal" };
    if (has(/전담기구|심의|조치|위원회/)) return { major: "schoolViolence", middle: "procedure", minor: "committee" };
    return { major: "schoolViolence", middle: "procedure", minor: "reporting" };
  }

  if (presetType === "staffLabor") {
    if (has(/괴롭힘|모욕|성희롱|야근|심부름|상급자|직장내/)) return { major: "staffLabor", middle: "workplaceIssue", minor: "bullying" };
    if (has(/휴가|출장|근태|복무|연차|연가|병가|공가|특별휴가|여비|근무상황|나이스|조퇴|외출|지각/)) {
      if (has(/출장|여비|출장비|운임|숙박/)) return { major: "staffLabor", middle: "attendanceLeave", minor: "businessTrip" };
      if (has(/근태|근무상황|나이스|증빙|지각|조퇴|외출/)) return { major: "staffLabor", middle: "attendanceLeave", minor: "attendanceEvidence" };
      return { major: "staffLabor", middle: "attendanceLeave", minor: "teacherLeave" };
    }
    if (has(/징계|민원/)) return { major: "staffLabor", middle: "workplaceIssue", minor: "discipline" };
    if (has(/행정직|교육공무직|조리실무사|행정실/)) return { major: "staffLabor", middle: "employmentStatus", minor: "adminStaff" };
    if (has(/재계약|계약갱신|갱신기대권/)) return { major: "staffLabor", middle: "employmentStatus", minor: "renewal" };
    return { major: "staffLabor", middle: "employmentStatus", minor: has(/기간제|단시간|계약직/) ? "fixedTerm" : "auto" };
  }

  if (presetType === "civilComplaint") {
    if (has(/생활기록부|학교생활기록|생기부|학생부|출결|인정결석|정정|기재요령/)) return { major: "schoolAdministration", middle: "studentRecords", minor: "schoolRecord" };
    if (has(/기록|증빙|개인정보|상담내용/)) return { major: "civilComplaint", middle: "schoolComplaint", minor: "records" };
    if (has(/안내|면담|전화|사과|재발방지|답변/)) return { major: "civilComplaint", middle: "schoolComplaint", minor: "communication" };
    return { major: "civilComplaint", middle: "schoolComplaint", minor: "guidance" };
  }

  if (presetType === "employment") {
    if (has(/공채|채용|지원서|접수|직무기술서|학교장추천|추천/)) {
      if (has(/추천|학교장/)) return { major: "employment", middle: "hiring", minor: "recommendation" };
      if (has(/공고|직무기술서|접수/)) return { major: "employment", middle: "hiring", minor: "document" };
      return { major: "employment", middle: "hiring", minor: "highSchoolHiring" };
    }
    if (has(/해고|퇴직|권고사직/)) return { major: "employment", middle: "contract", minor: "dismissal" };
    if (has(/임금|수당|월급|급여|연차수당/)) return { major: "employment", middle: "contract", minor: "wage" };
    return { major: "employment", middle: "contract", minor: "contractForm" };
  }

  return { major: "auto", middle: "auto", minor: "auto" };
}

function buildTopicContextFromPath(path = {}, autoDetected = false) {
  const majorValue = path.major || "auto";
  const majorNode = topicTaxonomy[majorValue] || topicTaxonomy.auto;
  const middleNode = (majorNode.middles || []).find((item) => item.value === path.middle) || null;
  const minorNode = (middleNode?.minors || []).find((item) => item.value === path.minor) || null;
  const labels = [majorNode, middleNode, minorNode]
    .map((item) => item?.label)
    .filter(Boolean);
  const label = labels.join(" > ") || "자동 분류";

  return {
    major: majorNode === topicTaxonomy.auto ? "auto" : majorValue,
    middle: middleNode?.value || "auto",
    minor: minorNode?.value || "auto",
    presetType: minorNode?.preset || middleNode?.preset || majorNode.preset || "auto",
    labels,
    label: autoDetected && label !== "자동 분류" ? `자동 분류 > ${label}` : label,
    autoDetected
  };
}

function renderTopicClassificationNote(topicContext = {}) {
  const label = topicContext.label || "자동 분류";
  const guide = topicContext.autoDetected
    ? "필요하면 분류 선택값을 바꿔 답변 범위를 더 좁힐 수 있습니다."
    : "선택한 분류를 기준으로 답변 범위를 좁혔습니다.";

  return `
    <section class="role-note" aria-label="질문유형 분류">
      <strong>질문유형: ${escapeHtml(label)}</strong>
      <p>${escapeHtml(guide)}</p>
    </section>
  `;
}

function buildKeywords(question, preset, topicContext = null) {
  const questionWords = question
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .slice(0, 3);

  const topicWords = (topicContext?.labels || [])
    .flatMap((label) => String(label).split(/[>·ㆍ\-\s]+/))
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && word !== "자동" && word !== "분류");

  return [...new Set([...topicWords, ...questionWords, ...preset.tags, ...preset.laws])].slice(0, 10);
}

function getSourceLinks(encodedQuestion, preset, scopes) {
  const links = [];
  const wants = (scope) => !scopes.length || scopes.includes(scope);
  const decodedQuestion = safeDecodeURIComponent(encodedQuestion);

  if (wants("law") || wants("source")) {
    links.push({
      label: "국가법령정보센터 검색",
      href: `https://www.law.go.kr/LSW/lsSc.do?query=${encodedQuestion}`
    });
  }

  if (wants("case")) {
    links.push({
      label: "국회법률도서관·법원 판례 검색",
      href: `https://www.scourt.go.kr/portal/information/events/search/search.jsp?searchWord=${encodedQuestion}`
    });
  }

  if (wants("admin")) {
    links.push({
      label: "교육부 공식자료 검색",
      href: buildOfficialSiteSearchUrl("moe.go.kr", `${decodedQuestion} 교육부 지침 자료`)
    });
  }

  if (preset.type === "schoolViolence") {
    links.push({
      label: "2025 학교폭력 사안처리 가이드북",
      href: "https://www.cbe.go.kr/dept-21/na/ntt/selectNttInfo.do?mi=11221&nttSn=1548192"
    });
  }

  if (preset.type === "schoolAdministration") {
    links.push({
      label: "학교생활기록부 기재요령",
      href: "https://star.moe.go.kr/web/contents/m21100.do"
    });
    links.push({
      label: "학교생활기록 작성 및 관리지침",
      href: "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000188164"
    });
    links.push({
      label: "교육부·교육청 공식자료 검색",
      href: buildOfficialSiteSearchUrl("moe.go.kr", `${decodedQuestion} 교육부 교육청 지침`)
    });
  }

  links.push({
    label: "법령정보 API 안내",
    href: "https://open.law.go.kr/LSO/openApi/guideList.do"
  });

  return links;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
