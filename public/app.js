const form = document.querySelector("#queryForm");
const questionInput = document.querySelector("#question");
const resultState = document.querySelector("#resultState");
const resultPanel = document.querySelector(".result-panel");
const queryPanel = document.querySelector(".query-panel");
const workspace = document.querySelector(".workspace");
const resultTitle = document.querySelector(".result-head h2");
const statusDot = document.querySelector(".status-dot");
const topicTypeInput = document.querySelector("#topicType");
const answerModeInput = document.querySelector("#answerMode");
const userRoleInput = document.querySelector("#userRole");
const REPORT_LIBRARY_KEY = "gyo6LawInfoReportLibrary";
let currentReportDraft = null;
let skipNextAutoScroll = false;

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
    label: "판례",
    source: "법원 판례 검색",
    reason: "비슷한 분쟁에서 법원이 어떤 기준을 보았는지 확인하는 보조 자료입니다."
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
  staffLabor: ["law", "admin", "case", "expert"],
  civilComplaint: ["admin", "law", "case", "expert"],
  general: ["law", "admin", "case", "expert"]
};

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
  }
};

const factPromptsByTopic = {
  employment: ["근로계약서가 있나요?", "근무 시작일과 종료일은 언제인가요?", "임금·근로시간 조건을 알고 있나요?", "학생 신분과 근로자성이 함께 문제되나요?"],
  apprenticeship: ["도제학교 운영 계획이나 훈련계약이 있나요?", "학교와 기업의 역할이 나뉘어 있나요?", "훈련 장소와 시간이 정리되어 있나요?", "안전교육 기록이 있나요?"],
  fieldTraining: ["실습 협약서가 있나요?", "사고나 문제가 발생한 날짜와 장소는 어디인가요?", "학교·산업체가 어떤 조치를 했나요?", "보호자에게 안내된 자료가 있나요?"],
  overseasTraining: ["파견 국가와 기관은 어디인가요?", "동의서·보험·비상 연락 체계가 있나요?", "현지 사고나 민원이 발생했나요?", "귀국·중단 절차가 안내되었나요?"],
  schoolSafety: ["사고 장소와 시간은 언제인가요?", "피해 정도와 즉시 조치가 기록되어 있나요?", "안전교육·점검 기록이 있나요?", "학교·외부 기관의 역할이 구분되나요?"],
  schoolViolence: ["신고·접수 일자가 언제인가요?", "피해·가해 학생 보호 조치가 있었나요?", "전담기구 확인이나 심의 절차가 진행되었나요?", "교육청 안내 자료를 확인했나요?"],
  staffLabor: ["정규직·기간제·상근 여부가 무엇인가요?", "계약서와 복무 규정이 있나요?", "징계·민원·근로조건 중 어떤 사안인가요?", "학교법인 또는 교육청 기준이 있나요?"],
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
    { type: "admin", title: "2024년 학교폭력 사안처리 가이드북", source: "교육부", use: "신고, 조사, 심의, 조치 절차를 학교 현장 기준으로 확인합니다.", query: "학교폭력 사안처리 가이드북", url: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=316&boardSeq=98297&lev=0&m=0302&opType=N&s=moe&statusYN=W" },
    { type: "law", title: "학교폭력예방 및 대책에 관한 법률", source: "국가법령정보센터", use: "학교폭력 사안 처리의 법적 근거를 확인합니다.", query: "학교폭력예방 및 대책에 관한 법률" },
    { type: "law", title: "초중등교육법", source: "국가법령정보센터", use: "학생 지도와 학교 운영의 기본 근거를 확인합니다.", query: "초중등교육법" },
    { type: "case", title: "학교폭력 판례", source: "법원 판례 검색", use: "비슷한 사안에서 다투어진 쟁점을 보조적으로 확인합니다.", query: "학교폭력" }
  ],
  staffLabor: [
    { type: "law", title: "교육공무원법", source: "국가법령정보센터", use: "정규 교사와 교육공무원 신분·복무 기준을 확인합니다.", query: "교육공무원법" },
    { type: "law", title: "사립학교법", source: "국가법령정보센터", use: "사립학교 교직원 관련 기준을 확인합니다.", query: "사립학교법" },
    { type: "law", title: "근로기준법", source: "국가법령정보센터", use: "행정직원과 근로관계 사안의 기본 기준을 확인합니다.", query: "근로기준법" },
    { type: "law", title: "기간제 및 단시간근로자 보호 등에 관한 법률", source: "국가법령정보센터", use: "기간제·단시간 근로자 보호 기준을 확인합니다.", query: "기간제 및 단시간근로자 보호 등에 관한 법률" }
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
    { type: "case", title: "판례 검색", source: "법원 판례 검색", use: "비슷한 분쟁의 판단 기준을 보조적으로 확인합니다.", query: "판례" }
  ]
};

const highRiskWords = ["소송", "고소", "고발", "형사", "사망", "중상", "해고", "징계", "손해배상", "폭행", "성폭력", "자살", "중대재해"];

const reportProfileFields = [
  { name: "schoolName", label: "학교명", placeholder: "예: ○○공업고등학교" },
  { name: "studentLabel", label: "학생명 또는 식별명", placeholder: "예: 홍길동, 2학년 전기과 학생 A" },
  { name: "department", label: "학과·학년·반", placeholder: "예: 스마트전자과 2학년 1반" },
  { name: "teacherName", label: "담임·지도교사", placeholder: "예: 담임 김○○, 현장실습 담당 이○○" },
  { name: "studentContact", label: "학생 연락처", placeholder: "선택 입력, 내부 보고용" },
  { name: "guardianContact", label: "보호자 연락처", placeholder: "선택 입력, 내부 보고용" },
  { name: "companyName", label: "파견 기업·기관", placeholder: "예: ○○테크 생산1팀" },
  { name: "companyContact", label: "기업 담당자·연락처", placeholder: "예: 현장 멘토, 인사담당자" },
  { name: "trainingPeriod", label: "파견일자·실습기간", placeholder: "예: 2026.05.01~2026.06.30" },
  { name: "programName", label: "참여 사업명", placeholder: "예: 산학일체형 도제학교, 현장실습, 해외 현장실습" },
  { name: "incidentDatePlace", label: "사고·문제 일시와 장소", placeholder: "예: 2026.05.30 14:20, CNC 실습장" },
  { name: "currentStatus", label: "현재 조치·실습현황", placeholder: "예: 병원 이송 완료, 보호자 통보, 실습 중단 검토 중", multiline: true },
  { name: "referenceNote", label: "기타 참고사항", placeholder: "예: CCTV 보존 요청, 교육청 보고 검토, 산재·보험 문의 예정", multiline: true },
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
    title: "현장실습과 학생 안전 관련 법령",
    summary: "현장실습은 실습 협약, 학생 안전, 산업체 책임, 학교의 지도·점검 절차를 함께 확인해야 합니다.",
    laws: ["직업교육훈련 촉진법", "산업안전보건법", "중대재해 처벌 등에 관한 법률"],
    tags: ["현장실습", "안전관리", "실습 협약", "산업체 책임"],
    checklist: ["실습 협약서와 운영 계획을 준비합니다.", "사고 발생 일시, 장소, 조치 내용을 시간순으로 정리합니다.", "학교와 산업체의 안전관리 의무 관련 원문을 확인합니다."]
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
    type: "staffLabor",
    keys: ["기간제", "교사", "행정직", "상근", "교직원", "복무", "징계"],
    title: "교직원과 행정직 인사·노무 관련 법령",
    summary: "교직원과 행정직 사안은 신분, 계약 형태, 복무 기준, 징계 절차, 근로관계 여부를 먼저 나누어 확인해야 합니다.",
    laws: ["교육공무원법", "사립학교법", "근로기준법", "기간제 및 단시간근로자 보호 등에 관한 법률"],
    tags: ["교직원", "기간제", "행정직", "복무"],
    checklist: ["정규직, 기간제, 상근 여부를 먼저 구분합니다.", "계약서와 복무 규정을 확인합니다.", "교육공무원 규정과 근로관계 법령을 함께 확인합니다."]
  },
  {
    type: "civilComplaint",
    keys: ["민원", "학생관리", "학부모", "생활지도", "출결", "징계"],
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

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    questionInput.value = button.dataset.example;
    topicTypeInput.value = "auto";
    questionInput.focus();
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();
  if (!question) {
    showEmptyMessage("질문을 입력해 주세요.", "취업, 현장실습, 학교 민원처럼 궁금한 상황을 한 문장으로 적어도 괜찮습니다.");
    questionInput.focus();
    return;
  }

  const scopes = [...form.querySelectorAll("input[name='scope']:checked")].map((input) => input.value);
  const preset = findPreset(question, topicTypeInput.value);
  renderResult(question, preset, scopes, answerModeInput.value, userRoleInput.value);
  if (skipNextAutoScroll) {
    skipNextAutoScroll = false;
  } else {
    window.setTimeout(() => {
      const targetTop = Math.max(0, (resultPanel?.offsetTop || 0) - 88);
      window.scrollTo(0, targetTop);
    }, 0);
  }
});

resultState.addEventListener("submit", (event) => {
  if (event.target?.id !== "clarifierForm") {
    return;
  }

  event.preventDefault();
  applyClarifierAnswers(event.target);
});

resultState.addEventListener("click", (event) => {
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

hydrateFromUrl();

function findPreset(question, selectedType) {
  if (selectedType && selectedType !== "auto") {
    return topicPresets.find((preset) => preset.type === selectedType) || fallbackPreset;
  }

  const normalized = question.replace(/\s+/g, "");
  return topicPresets.find((preset) => preset.keys.some((key) => normalized.includes(key))) || fallbackPreset;
}

function renderResult(question, preset, scopes, answerMode, userRole) {
  workspace?.classList.add("has-result");
  if (workspace && resultPanel && queryPanel && workspace.firstElementChild !== resultPanel) {
    workspace.insertBefore(resultPanel, queryPanel);
  }

  const encodedQuestion = encodeURIComponent(question);
  const modeMessage = getModeMessage(answerMode);
  const roleGuide = getRoleGuide(userRole);
  const sourceLinks = getSourceLinks(encodedQuestion, preset, scopes);
  const keywords = buildKeywords(question, preset);
  const sourcePlan = getSourcePlan(preset, scopes);
  const factPrompts = getFactPrompts(preset, userRole);
  const riskSignals = detectRiskSignals(question);
  const officialMaterials = getOfficialMaterials(preset);
  const directAnswer = getDirectAnswer(question, preset, roleGuide);
  const refinementQuestions = getRefinementQuestions(question, preset, userRole, riskSignals);
  const caseReport = buildCaseReport(question, preset, roleGuide, officialMaterials, riskSignals);
  currentReportDraft = caseReport;

  resultTitle.textContent = "답변 먼저";
  statusDot.textContent = "API 확인중";
  resultState.className = "summary-box";
  resultState.innerHTML = `
    <section class="answer-first" aria-label="질문에 대한 1차 답변">
      <div class="answer-label">질문에 대한 1차 답변</div>
      <h3>${escapeHtml(directAnswer.title)}</h3>
      <p>${escapeHtml(directAnswer.lead)}</p>
      <div class="answer-columns">
        <div>
          <strong>지금 바로 할 일</strong>
          <ol>
            ${directAnswer.actions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ol>
        </div>
        <div>
          <strong>${escapeHtml(directAnswer.responsibilityTitle)}</strong>
          <ul>
            ${directAnswer.responsibilities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      </div>
      <p class="answer-warning">${escapeHtml(directAnswer.warning)}</p>
    </section>

    ${renderCaseReport(caseReport)}

    ${renderRefinementPanel(refinementQuestions)}

    <section class="trust-panel" aria-label="검증 기준">
      <div>
        <strong>검증 우선</strong>
        <p>원문, 출처, 확인시각이 있는 정보만 신뢰 후보로 표시합니다.</p>
      </div>
      <ul>
        <li>공식 원문·승인 API 우선</li>
        <li>현행 여부·시행일 확인</li>
        <li>출처 불명확 시 확인 필요</li>
      </ul>
    </section>

    <details class="question-detail">
      <summary>내가 입력한 질문 보기</summary>
      <div class="query-readout">${escapeHtml(question)}</div>
    </details>

    <section class="role-note" aria-label="사용자 관점">
      <strong>${escapeHtml(roleGuide.label)}</strong>
      <p>${escapeHtml(roleGuide.advice)}</p>
    </section>

    <section class="result-block">
      <h3>${escapeHtml(preset.title)}</h3>
      <p>${escapeHtml(preset.summary)}</p>
      <div class="topic-tags">
        ${preset.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
      <p class="mode-note">${escapeHtml(modeMessage)}</p>
    </section>

    ${riskSignals.length ? `
      <section class="risk-note" aria-label="주의 신호">
        <strong>중요 사안 가능성</strong>
        <p>${escapeHtml(riskSignals.join(", "))} 표현이 포함되어 있습니다. 원문 확인과 별도로 학교 담당 부서 또는 전문가 상담을 우선 검토하세요.</p>
      </section>
    ` : ""}

    <section class="result-block">
      <h3>우선 확인할 자료</h3>
      <ul>
        ${preset.laws.map((law) => `<li>${escapeHtml(law)}</li>`).join("")}
      </ul>
      <div class="search-keywords" aria-label="추천 검색어">
        ${keywords.map((keyword) => `<code>${escapeHtml(keyword)}</code>`).join("")}
      </div>
    </section>

    <section class="result-block">
      <h3>공식 자료 후보</h3>
      <div class="material-list">
        ${officialMaterials.map((material, index) => `
          <article>
            <div class="material-head">
              <span>${escapeHtml(getMaterialKindLabel(material.type))}</span>
              <small>${index + 1}순위</small>
            </div>
            <h4>${escapeHtml(material.title)}</h4>
            <p>${escapeHtml(material.use)}</p>
            <div class="material-meta">
              <span>${escapeHtml(material.source)}</span>
              <code>${escapeHtml(material.query)}</code>
            </div>
            <a href="${getMaterialUrl(material, encodedQuestion)}" target="_blank" rel="noopener noreferrer">${escapeHtml(getMaterialActionLabel(material.type))}</a>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="result-block api-live" id="liveSourceMount" aria-live="polite">
      <h3>근거 자료 확인</h3>
      <p class="api-source-empty">법제처와 안전보건공단 자료를 확인하고 있습니다.</p>
    </section>

    <section class="result-block">
      <h3>출처 확인 순서</h3>
      <div class="source-priority-list">
        ${sourcePlan.map((item, index) => `
          <article>
            <span>${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.source)}</small>
              <p>${escapeHtml(item.reason)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="result-block">
      <h3>확인 순서</h3>
      <ol class="checklist">
        ${preset.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ol>
    </section>

    <section class="result-block">
      <h3>더 적으면 정확해지는 내용</h3>
      <div class="fact-prompts">
        ${factPrompts.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </section>

    <section class="result-block">
      <h3>선택한 검색 범위</h3>
      <p>${escapeHtml(formatScopes(scopes))}</p>
      <div class="source-actions">
        ${sourceLinks.map((link, index) => `<a class="${index === 0 ? "source-primary" : "source-light"}" href="${link.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join("")}
      </div>
    </section>

    <section class="result-block">
      <h3>주의</h3>
      <p>이 결과는 MVP 화면의 검색 준비 예시입니다. 실제 판단이나 조치는 원문, 학교·교육청 공식 안내, 전문가 상담을 통해 확인하세요.</p>
    </section>
  `;

  loadLiveSources(question, preset, keywords);
}

async function loadLiveSources(question, preset, keywords) {
  const mount = document.querySelector("#liveSourceMount");
  if (!mount) {
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

  try {
    const params = new URLSearchParams({
      q: question,
      topic: preset.type,
      laws: preset.laws.join("|"),
      keywords: keywords.join("|")
    });
    const response = await fetch(`/api/search?${params.toString()}`, {
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    mount.innerHTML = renderLiveSourceResults(data);
    updateReportLiveSources(data);

    const total = countApiItems(data);
    statusDot.textContent = total > 0 ? "API 결과 반영" : "API 후보 없음";
  } catch (error) {
    statusDot.textContent = "API 확인 실패";
    updateReportLiveSources({
      error: "API 확인 중 오류가 발생했습니다. 현재 보고서는 기본 공식자료 후보를 기준으로 정리되어 있습니다."
    });
    mount.innerHTML = `
      <h3>근거 자료 확인</h3>
      <p class="api-source-empty">API 확인 중 오류가 발생했습니다. 비밀키 설정과 네트워크 상태를 확인해 주세요.</p>
      <p class="api-error-text">${escapeHtml(error.message)}</p>
    `;
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
    ${renderApiGroup("법령해석례 후보", results.interpretations, "관련 법령해석례 후보가 아직 없습니다.")}
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

function getDirectAnswer(question, preset, roleGuide) {
  const normalized = question.replace(/\s+/g, "");
  const hasInjury = /골절|부상|다침|사고|중상|치료|병원|119/.test(normalized);
  const hasMachine = /기계|설비|장비|끼임|절단|충돌|부딪/.test(normalized);

  if (preset.type === "fieldTraining" || preset.type === "schoolSafety" || hasInjury || hasMachine) {
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

function buildCaseReport(question, preset, roleGuide, officialMaterials, riskSignals) {
  const context = getQuestionContext(question);
  const normalized = question.replace(/\s+/g, "");
  const isFieldAccident = preset.type === "fieldTraining"
    || preset.type === "schoolSafety"
    || /현장실습|실습|산업체|기계|골절|부상|사고|안전/.test(normalized);

  if (isFieldAccident) {
    return buildFieldTrainingAccidentReport(context, roleGuide, officialMaterials, riskSignals);
  }

  return buildGeneralCaseReport(context, preset, roleGuide, officialMaterials, riskSignals);
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

function buildGeneralCaseReport(context, preset, roleGuide, officialMaterials, riskSignals) {
  const reportSeed = {
    context,
    presetType: preset.type,
    riskSignals
  };

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
    finalAdvice: buildFinalAdvice(reportSeed),
    officialMaterials
  };
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
  const normalized = text.replace(/\s+/g, "");
  const hasSeriousInjury = /골절|수술|입원|장해|중상|사망|119|응급|전치|후유/.test(normalized);
  const hasLaborIssue = /산재|산업재해|임금|근로계약|해고|징계|근로시간|노동위원회|직장|회사|사업장|노무/.test(normalized)
    || ["employment", "apprenticeship", "fieldTraining", "schoolSafety", "staffLabor"].includes(seed.presetType);
  const hasLegalDispute = /소송|고소|고발|형사|손해배상|합의|민사|경찰|검찰|변호사|폭행|성폭력/.test(normalized);
  const hasProcedureOnly = !hasSeriousInjury && !hasLegalDispute && !seed.riskSignals?.length;

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
    referralSentence: hasLaborIssue
      ? "현장실습 사고와 관련하여 산재·노무 절차, 손해배상 가능성, 학교와 실습기업의 책임 범위를 구분해 확인하고자 합니다. 첨부 자료를 검토하시고 노무사 및 변호사 상담이 필요한 쟁점과 우선 조치사항에 대한 의견을 요청드립니다."
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
    { label: "언제", value: periodInfo || incidentDatePlace || "사고·문제 발생 일시와 실습기간 추가 확인 필요" },
    { label: "어디서", value: placeInfo || "실습 장소, 학교, 기업, 민원 발생 장소 추가 확인 필요" },
    { label: "무엇을", value: baseQuestion || "사용자가 입력한 사안 내용 확인 필요" },
    { label: "어떻게", value: firstResponse || "현재 조치, 보호자 통보, 치료, 보고 여부 추가 확인 필요" },
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
  const text = getReportSearchText(report, profileContext).replace(/\s+/g, "");
  return /현장실습|도제|직업계고|특성화고|실습기업|실습기관/.test(text)
    && /사고|골절|부상|상해|기계|안전|산재|응급|치료|입원/.test(text);
}

function shouldRenderEducationOfficeDraft(report, profileContext = {}) {
  const text = getReportSearchText(report, profileContext).replace(/\s+/g, "");
  return isLikelyFieldTrainingAccident(report, profileContext)
    || /교육청보고|중대재해|사망|중상|골절|입원|수술|장해|민원|언론|분쟁/.test(text);
}

function renderEducationOfficeDraft(report, profileContext = {}) {
  if (!shouldRenderEducationOfficeDraft(report, profileContext)) {
    return "";
  }

  const schoolName = profileContext.schoolName || "학교명 확인 필요";
  const studentLabel = profileContext.studentLabel || "학생 성명 또는 식별명 확인 필요";
  const companyName = profileContext.companyName || "실습기업·기관 확인 필요";
  const incident = profileContext.incidentDatePlace || findReportFact(report, "사고 시간") || "발생 일시·장소 확인 필요";
  const currentStatus = profileContext.currentStatus || report.immediateActions?.[0] || "치료, 보호자 통보, 실습 중단 여부 확인 필요";
  const teacherName = profileContext.teacherName || "담당·지도교사 확인 필요";
  const period = profileContext.trainingPeriod || "파견일자·실습기간 확인 필요";
  const program = profileContext.programName || "참여 사업명 확인 필요";
  const facts = report.facts?.slice(0, 3).map((item) => `${item.label}: ${item.value}`).join(" / ") || report.lead;

  const rows = [
    { label: "수신", value: "관할 교육청 직업교육·현장실습 담당부서" },
    { label: "제목", value: `[검토용] 현장실습 안전사고 발생 보고 초안 - ${schoolName} ${studentLabel}` },
    { label: "1. 보고 개요", value: `${schoolName} 소속 ${studentLabel} 관련 현장실습 안전사고로, 학생 보호와 사실관계 확인을 우선 진행 중입니다.` },
    { label: "2. 발생 일시·장소", value: incident },
    { label: "3. 관련 학생·학교·실습기업", value: `학생: ${studentLabel} / 담당: ${teacherName} / 실습기업: ${companyName} / 실습기간: ${period} / 참여사업: ${program}` },
    { label: "4. 사고 경위", value: facts },
    { label: "5. 즉시 조치", value: currentStatus },
    { label: "6. 확인 중인 쟁점", value: "공식 현장실습 범위 안의 사고인지, 학생이 허락받은 작업을 했는지, 안전교육·작업지시·감독·방호조치·산재 보고 대상 여부를 확인 중입니다." },
    { label: "7. 요청·향후 조치", value: "교육청 보고 필요 여부 검토, 학생 치료와 보호자 안내, 현장 보존 요청, 증빙자료 확보, 실습 중단·복귀 계획 검토가 필요합니다." }
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

function renderCaseReport(report) {
  return `
    <section class="case-report" id="caseReport" aria-label="사안 보고서">
      <div class="report-cover">
        <div>
          <p class="report-kicker">PRINTABLE REPORT</p>
          <h3>${escapeHtml(report.title)}</h3>
          <p>${escapeHtml(report.subtitle)}</p>
        </div>
        <div class="report-actions">
          <span>${escapeHtml(report.generatedAt)}</span>
          <button type="button" data-save-report>자료실 저장</button>
          <button type="button" data-download-report>HTML 저장</button>
          <button type="button" data-print-report>보고서 인쇄</button>
        </div>
      </div>

      ${renderReportComposer(report)}

      ${renderExecutiveSummarySection(report)}

      <div class="report-section">
        <h4>2. 사안 개요</h4>
        <div id="reportFactProfileContext"></div>
        <div class="report-facts">
          ${report.facts.map((item) => `
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(item.value)}</p>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="report-section">
        <h4>3. 핵심 쟁점 및 판단 전제</h4>
        ${renderReportList(report.issueSummary, "", { basis: true, report })}
      </div>

      <div class="report-section">
        <h4>4. 즉시 조치 체크리스트</h4>
        ${renderReportList(report.immediateActions, "checklist", { basis: true, report })}
      </div>

      <div class="report-section">
        <h4>5. 주체별 조치사항과 권리·의무</h4>
        <div id="reportStakeholderProfileContext"></div>
        <div class="report-stakeholders">
          ${report.stakeholders.map((section) => `
            <article>
              <h5>${escapeHtml(section.title)}</h5>
              <p>${escapeHtml(section.summary)}</p>
              <strong>해야 할 조치·의무</strong>
              ${renderReportList(section.duties, "", { basis: true, report })}
              <strong>확인할 권리·요구할 수 있는 사항</strong>
              ${renderReportList(section.rights, "", { basis: true, report })}
            </article>
          `).join("")}
        </div>
      </div>

      <div class="report-section">
        <h4>6. 준비할 증빙자료</h4>
        ${renderEvidenceItems(report)}
      </div>

      <div class="report-section">
        <h4>7. 유의사항 및 정보 제공 안내</h4>
        <p class="report-disclaimer">${escapeHtml(report.disclaimer)}</p>
        ${renderReportList(report.cautions)}
      </div>

      ${renderFinalAdvice(report.finalAdvice)}

      <div class="report-section report-source-section">
        <h4>9. 유사자료 및 원문 근거 확인</h4>
        <p class="report-section-note">유사사례는 사고유형, 장소, 설비, 작업상황이 맞는 후보를 우선 표시합니다. 법령과 행정자료는 위 쟁점·조치사항의 법적 근거를 원문으로 재확인하기 위한 보조 영역입니다.</p>
        <div id="reportLiveSources" class="report-live-sources">
          <p>법제처와 안전보건공단 API 자료를 보고서에 반영하고 있습니다.</p>
        </div>
        ${renderReportSimilarHints(report.officialMaterials)}
        ${renderReportMaterials(report.officialMaterials)}
      </div>

      <div class="report-section report-sign-section">
        <h4>10. 담당자 의견 작성란</h4>
        <div class="report-opinion-grid">
          <div><strong>담임·지도교사 의견</strong><span></span></div>
          <div><strong>취업지도부·업무담당자 의견</strong><span></span></div>
          <div><strong>관리자 검토 의견</strong><span></span></div>
          <div class="wide"><strong>교육청 보고·전문가 상담·후속 조치 의견</strong><span></span></div>
        </div>
      </div>

      ${renderReportLibrary()}
    </section>
  `;
}

function renderReportComposer() {
  return `
    <section class="report-composer" aria-label="보고서 작성 정보 입력">
      <div class="report-composer-head">
        <div>
          <span>보고서 완성 정보</span>
          <h4>인쇄 전에 필요한 학생·실습 정보를 입력하세요.</h4>
          <p>모르는 항목은 비워도 됩니다. 연락처와 이름은 학교 내부 보고에 필요한 경우에만 입력하고, 외부 공유 전에는 비식별 처리하세요.</p>
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
    executiveMount.innerHTML = renderExecutiveSummaryContent(report, profileContext);
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
    add("seriousAccidentDefinition", "seriousAccidentDuty");
  }
  if (/위탁|도급|용역|파견|관계기관/.test(normalized)) {
    add("seriousAccidentContract");
  }
  if (/학교안전|공제|보상/.test(normalized)) {
    add("schoolSafetyCompensation");
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
  const reportMount = document.querySelector("#reportLiveSources");
  if (!reportMount) {
    return;
  }

  reportMount.innerHTML = renderReportLiveSources(data);
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
    ${renderReportApiGroup("법령해석례", results.interpretations)}
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
          return `
            <article>
              <div>
                <strong>${escapeHtml(item.title || "제목 없음")}</strong>
                <span class="${reliability.needsReview ? "needs-review" : "verified"}">${escapeHtml(reliability.label || "확인 필요")}</span>
              </div>
              ${studentCase ? `<small class="student-case-badge">학생·현장실습 우선 검토</small>` : ""}
              <p>${escapeHtml(item.summary || item.subtitle || "요약 정보 없음")}</p>
              ${renderReportApiRelevance(item.relevance)}
              <small>${escapeHtml(item.source || "공식 출처")} ${item.date ? `· ${escapeHtml(item.date)}` : "· 일자 확인 필요"}</small>
              ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">원문 확인</a>` : ""}
            </article>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function prioritizeReportApiItems(title, items = []) {
  if (title !== "국내재해사례") {
    return items;
  }

  return [...items].sort((a, b) => {
    const bScore = getStudentFieldTrainingScore(b) + Number(b.relevance?.score || 0);
    const aScore = getStudentFieldTrainingScore(a) + Number(a.relevance?.score || 0);
    return bScore - aScore;
  });
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

  const questions = [...(byTopic[preset.type] || byTopic.general)];

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

function getOfficialMaterials(preset) {
  return officialMaterialsByTopic[preset.type] || officialMaterialsByTopic.general;
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
  if (material.url) {
    return material.url;
  }

  const query = encodeURIComponent(material.query || decodeURIComponent(encodedQuestion));

  if (material.type === "case") {
    return `https://www.scourt.go.kr/portal/information/events/search/search.jsp?searchWord=${query}`;
  }

  return `https://www.law.go.kr/LSW/lsSc.do?query=${query}`;
}

function detectRiskSignals(question) {
  return highRiskWords.filter((word) => question.includes(word)).slice(0, 4);
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const question = params.get("q") || params.get("question");

  if (!question) {
    return;
  }

  questionInput.value = question;
  setSelectValue(userRoleInput, params.get("role"));
  setSelectValue(topicTypeInput, params.get("topic"));
  setSelectValue(answerModeInput, params.get("mode"));
  setScopesFromUrl(params.get("scopes"));

  if (params.get("run") === "1") {
    skipNextAutoScroll = true;
    form.requestSubmit();
  }
}

function setSelectValue(select, value) {
  if (!value) {
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

function buildKeywords(question, preset) {
  const questionWords = question
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .slice(0, 3);

  return [...new Set([...questionWords, ...preset.tags, ...preset.laws])].slice(0, 8);
}

function getSourceLinks(encodedQuestion, preset, scopes) {
  const links = [];
  const wants = (scope) => !scopes.length || scopes.includes(scope);

  if (wants("law") || wants("source")) {
    links.push({
      label: "국가법령정보센터 검색",
      href: `https://www.law.go.kr/LSW/lsSc.do?query=${encodedQuestion}`
    });
  }

  if (wants("case")) {
    links.push({
      label: "법원 판례 검색",
      href: `https://www.scourt.go.kr/portal/information/events/search/search.jsp?searchWord=${encodedQuestion}`
    });
  }

  if (wants("admin")) {
    links.push({
      label: "교육부 자료 확인",
      href: "https://www.moe.go.kr/main.do?s=moe"
    });
  }

  if (preset.type === "schoolViolence") {
    links.push({
      label: "학교폭력 가이드북",
      href: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=316&boardSeq=98297&lev=0&m=0302&opType=N&s=moe&statusYN=W"
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
