const form = document.querySelector("#queryForm");
const questionInput = document.querySelector("#question");
const resultState = document.querySelector("#resultState");
const resultTitle = document.querySelector(".result-head h2");
const statusDot = document.querySelector(".status-dot");

const topicPresets = [
  {
    keys: ["퇴직금", "퇴직", "임금", "근로", "해고"],
    title: "근로와 임금 관련 법령",
    summary: "근로관계에서는 근로계약, 임금 지급, 퇴직급여, 해고 절차를 함께 확인하는 것이 좋습니다.",
    laws: ["근로기준법", "근로자퇴직급여 보장법"],
    tags: ["임금", "퇴직급여", "근로계약", "해고 절차"]
  },
  {
    keys: ["전세", "보증금", "임대차", "월세", "집주인"],
    title: "주택 임대차 관련 법령",
    summary: "보증금 반환 문제는 계약서, 확정일자, 대항력, 임차권등기명령 등 사실관계를 함께 확인해야 합니다.",
    laws: ["주택임대차보호법", "민법"],
    tags: ["보증금", "대항력", "확정일자", "임차권등기"]
  },
  {
    keys: ["학교폭력", "학폭", "학생", "학교", "교육"],
    title: "학교폭력과 교육 절차 관련 법령",
    summary: "학교폭력 사안은 신고, 조사, 심의, 조치 결정, 불복 절차가 구분됩니다. 관할 교육청 안내도 함께 확인해야 합니다.",
    laws: ["학교폭력예방 및 대책에 관한 법률", "초중등교육법"],
    tags: ["학교폭력", "심의 절차", "학생 보호", "교육청"]
  }
];

const fallbackPreset = {
  title: "질문과 관련된 법령 검색",
  summary: "입력한 질문의 핵심 단어를 기준으로 법령 원문 검색부터 확인하세요. 실제 API 연결 후에는 관련 조문과 판례 후보를 함께 정렬합니다.",
  laws: ["대한민국 현행 법령", "관련 판례"],
  tags: ["법령 검색", "판례 확인", "원문 근거", "정보 제공"]
};

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    questionInput.value = button.dataset.example;
    questionInput.focus();
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();
  if (!question) {
    showEmptyMessage("질문을 입력해 주세요.", "생활 속에서 궁금한 법령이나 절차를 한 문장으로 적어도 괜찮습니다.");
    questionInput.focus();
    return;
  }

  const scopes = [...form.querySelectorAll("input[name='scope']:checked")].map((input) => input.value);
  const preset = findPreset(question);
  renderResult(question, preset, scopes);
});

function findPreset(question) {
  const normalized = question.replace(/\s+/g, "");
  return topicPresets.find((preset) => preset.keys.some((key) => normalized.includes(key))) || fallbackPreset;
}

function renderResult(question, preset, scopes) {
  const encodedQuestion = encodeURIComponent(question);
  const lawSearchUrl = `https://www.law.go.kr/LSW/lsSc.do?query=${encodedQuestion}`;
  const courtSearchUrl = `https://www.scourt.go.kr/portal/information/events/search/search.jsp?searchWord=${encodedQuestion}`;

  resultTitle.textContent = "요약 초안";
  statusDot.textContent = "원문 확인 필요";
  resultState.className = "summary-box";
  resultState.innerHTML = `
    <div class="query-readout">${escapeHtml(question)}</div>

    <section class="result-block">
      <h3>${escapeHtml(preset.title)}</h3>
      <p>${escapeHtml(preset.summary)}</p>
      <div class="topic-tags">
        ${preset.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
    </section>

    <section class="result-block">
      <h3>우선 확인할 자료</h3>
      <ul>
        ${preset.laws.map((law) => `<li>${escapeHtml(law)}</li>`).join("")}
      </ul>
    </section>

    <section class="result-block">
      <h3>선택한 검색 범위</h3>
      <p>${escapeHtml(formatScopes(scopes))}</p>
      <div class="source-actions">
        <a href="${lawSearchUrl}" target="_blank" rel="noopener noreferrer">법령 원문 검색</a>
        <a href="${courtSearchUrl}" target="_blank" rel="noopener noreferrer">판례 검색</a>
      </div>
    </section>

    <section class="result-block">
      <h3>주의</h3>
      <p>이 결과는 MVP 화면의 검색 준비 예시입니다. 실제 판단이나 조치는 원문과 전문가 상담을 통해 확인하세요.</p>
    </section>
  `;
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
    return "선택한 범위가 없습니다. 기본 검색에서는 법령, 판례, 원문 근거를 함께 확인합니다.";
  }

  const labels = {
    law: "법령",
    case: "판례",
    source: "원문 근거"
  };

  return scopes.map((scope) => labels[scope] || scope).join(", ");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
