const form = document.querySelector("#queryForm");
const questionInput = document.querySelector("#question");
const resultState = document.querySelector("#resultState");
const resultTitle = document.querySelector(".result-head h2");
const statusDot = document.querySelector(".status-dot");
const topicTypeInput = document.querySelector("#topicType");
const answerModeInput = document.querySelector("#answerMode");
const userRoleInput = document.querySelector("#userRole");

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
    { type: "law", title: "직업교육훈련 촉진법", source: "국가법령정보센터", use: "현장실습 운영과 직업교육훈련 기준을 확인합니다.", query: "직업교육훈련 촉진법" },
    { type: "law", title: "산업안전보건법", source: "국가법령정보센터", use: "실습 현장의 안전보건 의무와 조치 기준을 확인합니다.", query: "산업안전보건법" },
    { type: "law", title: "중대재해 처벌 등에 관한 법률", source: "국가법령정보센터", use: "중대한 안전사고가 포함될 때 관리 책임과 안전보건 체계를 확인합니다.", query: "중대재해 처벌 등에 관한 법률" },
    { type: "admin", title: "직업계고 현장실습 자료", source: "교육부", use: "학교 현장실습 운영 자료와 공식 안내를 확인합니다.", query: "직업계고 현장실습", url: "https://www.moe.go.kr/main.do?s=moe" }
  ],
  overseasTraining: [
    { type: "law", title: "직업교육훈련 촉진법", source: "국가법령정보센터", use: "해외 현장실습도 직업교육훈련의 기본 틀에서 확인합니다.", query: "직업교육훈련 촉진법" },
    { type: "law", title: "초중등교육법", source: "국가법령정보센터", use: "학생 지도와 학교 운영의 기본 근거를 확인합니다.", query: "초중등교육법" },
    { type: "admin", title: "글로벌 현장학습·직업계고 자료", source: "교육부", use: "해외 실습 운영과 파견 전 확인 자료를 찾습니다.", query: "글로벌 현장학습", url: "https://www.moe.go.kr/main.do?s=moe" },
    { type: "admin", title: "해외안전여행 정보", source: "외교부", use: "파견 국가의 안전정보와 위기 대응 자료를 확인합니다.", query: "해외안전여행", url: "https://www.0404.go.kr" }
  ],
  schoolSafety: [
    { type: "law", title: "중대재해 처벌 등에 관한 법률", source: "국가법령정보센터", use: "중대재해 관련 안전보건 관리체계를 확인합니다.", query: "중대재해 처벌 등에 관한 법률" },
    { type: "law", title: "산업안전보건법", source: "국가법령정보센터", use: "학교와 실습 현장의 안전보건 기준을 확인합니다.", query: "산업안전보건법" },
    { type: "law", title: "학교안전사고 예방 및 보상에 관한 법률", source: "국가법령정보센터", use: "학교안전사고 예방과 보상 관련 기준을 확인합니다.", query: "학교안전사고 예방 및 보상에 관한 법률" },
    { type: "safety", title: "안전보건 자료", source: "안전보건공단", use: "위험성 평가, 안전교육, 사고 예방 자료를 확인합니다.", query: "안전보건", url: "https://www.kosha.or.kr/kosha/index.do" }
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
  const encodedQuestion = encodeURIComponent(question);
  const modeMessage = getModeMessage(answerMode);
  const roleGuide = getRoleGuide(userRole);
  const sourceLinks = getSourceLinks(encodedQuestion, preset, scopes);
  const keywords = buildKeywords(question, preset);
  const sourcePlan = getSourcePlan(preset, scopes);
  const factPrompts = getFactPrompts(preset, userRole);
  const riskSignals = detectRiskSignals(question);
  const officialMaterials = getOfficialMaterials(preset);

  resultTitle.textContent = "요약 초안";
  statusDot.textContent = "API 확인중";
  resultState.className = "summary-box";
  resultState.innerHTML = `
    <div class="query-readout">${escapeHtml(question)}</div>

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
      <h3>실제 API 확인</h3>
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
      <h3>실제 API 확인</h3>
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

    const total = countApiItems(data);
    statusDot.textContent = total > 0 ? "API 결과 반영" : "API 후보 없음";
  } catch (error) {
    statusDot.textContent = "API 확인 실패";
    mount.innerHTML = `
      <h3>실제 API 확인</h3>
      <p class="api-source-empty">API 확인 중 오류가 발생했습니다. 비밀키 설정과 네트워크 상태를 확인해 주세요.</p>
      <p class="api-error-text">${escapeHtml(error.message)}</p>
    `;
  }
}

function renderLiveSourceResults(data) {
  if (data.error) {
    return `
      <h3>실제 API 확인</h3>
      <p class="api-source-empty">${escapeHtml(data.error)}</p>
    `;
  }

  const results = data.results || {};
  const notices = data.notices || [];

  return `
    <h3>실제 API 확인</h3>
    <p class="api-live-summary">승인 완료된 법제처·공공데이터 출처에서 가져온 후보입니다. 원문 링크와 표시 내용을 다시 확인하세요.</p>
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

  return `
    <article class="api-source-card">
      <div class="api-card-type">${escapeHtml(item.type || item.source || "공식자료")}</div>
      <h5>${escapeHtml(item.title || "제목 없음")}</h5>
      <p class="api-card-meta">
        <span>${escapeHtml(item.source || "공식 출처")}</span>
        ${item.date ? `<span>${escapeHtml(item.date)}</span>` : ""}
      </p>
      ${item.subtitle ? `<p>${escapeHtml(item.subtitle)}</p>` : ""}
      ${item.summary ? `<p class="api-card-summary">${escapeHtml(item.summary)}</p>` : ""}
      ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">원문 확인</a>` : ""}
    </article>
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

function showEmptyMessage(title, message) {
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
