let activeEnv = {};

export function createApi(env = {}) {
  activeEnv = env || {};

  return {
    getHealthStatus,
    handleSearch
  };
}

function getHealthStatus() {
  return {
    ok: true,
    keys: {
      lawOpenApi: hasUsableValue(getLawOpenApiKey()),
      publicData: hasUsableValue(activeEnv.PUBLIC_DATA_API_KEY),
      openAi: hasUsableValue(activeEnv.OPENAI_API_KEY),
      scourt: hasUsableValue(activeEnv.SCOUT_API_KEY),
      nanet: hasUsableValue(activeEnv.NANET_API_KEY)
    }
  };
}

async function handleSearch(requestUrl) {
  const question = cleanText(requestUrl.searchParams.get("q") || "");
  const topic = cleanText(requestUrl.searchParams.get("topic") || "general");
  const laws = parseList(requestUrl.searchParams.get("laws"));
  const keywords = parseList(requestUrl.searchParams.get("keywords"));

  if (!question) {
    return { error: "질문이 비어 있습니다." };
  }

  const lawQueries = laws.length ? laws.slice(0, 4) : [question];
  const safetyContext = buildSafetyContext(question, keywords, topic);
  const lawOpenApiKey = getLawOpenApiKey();
  const publicDataKey = activeEnv.PUBLIC_DATA_API_KEY;

  const [lawResults, interpretationResults, disasterResults, materialResults] = await Promise.all([
    hasUsableValue(lawOpenApiKey) ? searchLaws(lawOpenApiKey, lawQueries) : missingKey("LAW_OPEN_API_OC"),
    hasUsableValue(lawOpenApiKey) ? searchLawInterpretations(lawOpenApiKey, question) : missingKey("LAW_OPEN_API_OC"),
    hasUsableValue(publicDataKey) ? searchDisasterCases(publicDataKey, safetyContext) : missingKey("PUBLIC_DATA_API_KEY"),
    hasUsableValue(publicDataKey) ? searchSafetyMaterials(publicDataKey) : missingKey("PUBLIC_DATA_API_KEY")
  ]);

  return {
    query: question,
    topic,
    generatedAt: new Date().toISOString(),
    verification: buildVerificationSummary(),
    status: getHealthStatus().keys,
    results: {
      laws: lawResults.items,
      interpretations: interpretationResults.items,
      safetyDisasters: disasterResults.items,
      safetyMaterials: materialResults.items
    },
    notices: [
      ...lawResults.notices,
      ...interpretationResults.notices,
      ...disasterResults.notices,
      ...materialResults.notices
    ].filter(uniqueString).slice(0, 8)
  };
}

function getLawOpenApiKey() {
  return activeEnv.LAW_OPEN_API_OC || activeEnv.LAW_OPEN_API_KEY;
}

function buildVerificationSummary() {
  return {
    mode: "live-source-first",
    sourceRule: "공식 원문과 승인된 API 결과만 사용합니다.",
    noSourceRule: "원문 근거가 없으면 단정하지 않고 확인 필요로 표시합니다.",
    checkedAt: new Date().toISOString()
  };
}

function missingKey(name) {
  return Promise.resolve({
    items: [],
    notices: [`${name} 값이 없어 해당 출처는 건너뛰었습니다.`]
  });
}

async function searchLaws(openApiKey, queries) {
  const notices = [];
  const batches = await Promise.all(
    queries.map((query) => callLawSearch(openApiKey, {
      target: "law",
      search: "1",
      query,
      display: "4"
    }))
  );

  const items = [];
  for (const batch of batches) {
    notices.push(...batch.notices);
    items.push(...batch.items);
  }

  return { items: uniqueBy(items, "url").slice(0, 8), notices };
}

async function searchLawInterpretations(openApiKey, question) {
  const [general, labor] = await Promise.all([
    callLawSearch(openApiKey, {
      target: "expc",
      search: "2",
      query: question,
      display: "3"
    }),
    callLawSearch(openApiKey, {
      target: "moelCgmExpc",
      search: "2",
      query: question,
      display: "3"
    })
  ]);

  return {
    items: uniqueBy([...labor.items, ...general.items], "url").slice(0, 6),
    notices: [...labor.notices, ...general.notices]
  };
}

async function callLawSearch(openApiKey, params) {
  const url = new URL("http://www.law.go.kr/DRF/lawSearch.do");
  url.searchParams.set("OC", openApiKey);
  url.searchParams.set("type", "JSON");
  url.searchParams.set("page", "1");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  try {
    const data = await fetchJson(url, {
      headers: getLawOpenApiHeaders()
    });
    if (data?.result || data?.msg) {
      throw new Error([data.result, data.msg].filter(Boolean).join(" "));
    }
    return {
      items: normalizeLawItems(data, params.target, params.query),
      notices: []
    };
  } catch (error) {
    return {
      items: [],
      notices: [`법제처 ${params.target} 검색 실패: ${error.message}`]
    };
  }
}

function getLawOpenApiHeaders() {
  const referer = normalizeReferer(activeEnv.LAW_OPEN_API_REFERER || activeEnv.PUBLIC_SITE_URL || "https://gyo6.kr/");

  if (!referer) {
    return {};
  }

  return {
    Referer: referer,
    Origin: new URL(referer).origin
  };
}

async function searchDisasterCases(publicDataKey, safetyContext) {
  const queries = safetyContext.disasterQueries.length ? safetyContext.disasterQueries : ["안전사고"];
  const batches = await Promise.all(queries.map((query) => callDisasterCases(publicDataKey, query)));
  const items = [];
  const notices = [];

  for (const batch of batches) {
    notices.push(...batch.notices);
    items.push(...batch.items);
  }

  const uniqueItems = uniqueByValue(items, getPublicDataIdentity);
  const scoredItems = uniqueItems
    .map((item) => attachDisasterRelevance(item, safetyContext))
    .sort((left, right) => right.relevance.score - left.relevance.score);
  const selectedItems = scoredItems
    .filter((item) => shouldKeepDisasterCandidate(item, safetyContext))
    .slice(0, 3);

  const hiddenCount = Math.max(scoredItems.length - selectedItems.length, 0);
  if (hiddenCount > 0) {
    notices.push(`국내재해사례 ${hiddenCount}건은 사고유형·작업상황 관련도가 낮아 표시하지 않았습니다.`);
  }
  if (!selectedItems.length && uniqueItems.length) {
    notices.push("국내재해사례는 조회되었지만 질문과 충분히 일치하는 정밀 후보가 없어 숨겼습니다.");
  }

  return {
    items: selectedItems,
    notices
  };
}

async function callDisasterCases(publicDataKey, keyword) {
  const url = new URL("http://apis.data.go.kr/B552468/disaster_api02/getdisaster_api02");
  url.searchParams.set("serviceKey", publicDataKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "12");
  url.searchParams.set("callApiId", "1060");
  if (keyword) {
    url.searchParams.set("keyword", keyword);
  }

  try {
    const data = await fetchJson(url);
    return {
      items: normalizePublicDataItems(data, "국내재해사례", "한국산업안전보건공단", keyword),
      notices: []
    };
  } catch (error) {
    return {
      items: [],
      notices: [`국내재해사례 ${keyword ? `"${keyword}" ` : ""}검색 실패: ${error.message}`]
    };
  }
}

async function searchSafetyMaterials(publicDataKey) {
  const url = new URL("http://apis.data.go.kr/B552468/selectMediaList01/getselectMediaList01");
  url.searchParams.set("serviceKey", publicDataKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "5");
  url.searchParams.set("callApiId", "1030");
  url.searchParams.set("ctgr04_kr", "Y");

  try {
    const data = await fetchJson(url);
    return {
      items: normalizePublicDataItems(data, "안전보건자료", "한국산업안전보건공단"),
      notices: []
    };
  } catch (error) {
    return {
      items: [],
      notices: [`안전보건자료 검색 실패: ${error.message}`]
    };
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("JSON 응답이 아닙니다.");
    }
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeLawItems(data, target, query) {
  const root = data?.LawSearch || data?.lawSearch || data || {};
  const rawItems =
    root.law ||
    root.expc ||
    root.MoelCgmExpc ||
    root.moelCgmExpc ||
    root.item ||
    root.items ||
    [];

  return asArray(rawItems).map((item) => {
    const title =
      getValue(item, ["법령명한글", "법령명", "안건명", "해석례명", "법령해석례명", "title"]) ||
      query;
    const subtitle =
      getValue(item, ["소관부처명", "해석기관명", "질의기관명", "회신기관명", "법령구분명"]) ||
      getLawTargetLabel(target);
    const date =
      formatDate(getValue(item, ["시행일자", "공포일자", "해석일자", "회신일자", "date"])) ||
      "";
    const detailLink = getValue(item, ["법령상세링크", "상세링크", "본문상세링크", "법령해석례상세링크"]);

    return {
      title: String(title),
      subtitle: String(subtitle),
      source: "국가법령정보센터",
      date,
      summary: getValue(item, ["제개정구분명", "안건번호", "질의요지", "summary"]) || "",
      url: normalizeLawUrl(detailLink, query, target),
      query,
      type: getLawTargetLabel(target),
      verifiedAt: new Date().toISOString(),
      reliability: getReliabilityStatus(detailLink, date)
    };
  }).filter((item) => item.title);
}

function normalizePublicDataItems(data, type, source, query = "") {
  const root = data?.response || data || {};
  const body = root.body || root.Body || root;
  const rawItems =
    body?.items?.item ||
    body?.items ||
    body?.item ||
    body?.list ||
    body?.data ||
    [];

  return asArray(rawItems).map((item) => {
    const title =
      getValue(item, ["title", "ttl", "sj", "bbsSj", "subject", "mediaSj", "dataNm", "cntntsSj", "keyword", "MED_SJ_NM", "제목"]) ||
      type;
    const subtitle =
      getValue(item, ["business", "ctgrNm", "ctgr01Nm", "ctgr02Nm", "MED_TYPE_NM", "업종", "분류"]) ||
      type;
    const date =
      formatDate(getValue(item, ["regDate", "regDt", "wrtDt", "date", "MED_COMPY_DY", "등록일", "작성일"])) ||
      "";
    const summary =
      getValue(item, ["cn", "contents", "content", "summary", "desc", "MED_DESC", "내용", "설명"]) ||
      "";
    const url =
      getValue(item, ["url", "link", "linkUrl", "fileUrl", "atchFileUrl", "cntntsUrl", "MED_URL", "상세URL"]) ||
      "";

    return {
      title: String(title),
      subtitle: String(subtitle),
      source,
      date,
      summary: cleanPublicDataSummary(summary).slice(0, 180),
      url: normalizeUrl(url),
      query,
      type,
      verifiedAt: new Date().toISOString(),
      reliability: getReliabilityStatus(url, date)
    };
  }).filter((item) => item.title);
}

function getReliabilityStatus(url, date) {
  const hasSourceUrl = Boolean(url);
  const hasDate = Boolean(date);

  if (hasSourceUrl && hasDate) {
    return {
      level: "source-dated",
      label: "원문·일자 확인",
      needsReview: false
    };
  }

  if (hasSourceUrl) {
    return {
      level: "source-only",
      label: "원문 확인 필요",
      needsReview: true
    };
  }

  return {
    level: "needs-review",
    label: "출처 확인 필요",
    needsReview: true
  };
}

function getValue(object, keys) {
  if (!object || typeof object !== "object") {
    return "";
  }

  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null && object[key] !== "") {
      return object[key];
    }
  }

  return "";
}

function normalizeLawUrl(detailLink, query, target) {
  if (detailLink) {
    const value = String(detailLink);
    if (value.startsWith("http")) {
      return value;
    }
    if (value.startsWith("/")) {
      return `https://www.law.go.kr${value}`;
    }
    return `https://www.law.go.kr${value.startsWith("DRF") ? "/" : ""}${value}`;
  }

  const searchUrl = new URL("https://www.law.go.kr/LSW/lsSc.do");
  searchUrl.searchParams.set("query", query || getLawTargetLabel(target));
  return searchUrl.toString();
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  const text = String(value);
  if (text.startsWith("http://") || text.startsWith("https://")) {
    return text;
  }

  if (text.startsWith("/")) {
    return `https://www.kosha.or.kr${text}`;
  }

  return text;
}

function cleanPublicDataSummary(value) {
  return String(value || "")
    .replace(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*00\s*(?:\([^)]+\))?/g, (_, year, month) => {
      return `${year}.${String(Number(month)).padStart(2, "0")}.(일자 확인 필요)`;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeReferer(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function getLawTargetLabel(target) {
  const labels = {
    law: "법령",
    expc: "법령해석례",
    moelCgmExpc: "고용노동부 법령해석"
  };
  return labels[target] || target;
}

const safetySignalCatalog = {
  accident: [
    { label: "끼임·말림", query: "끼임", terms: ["끼임", "끼인", "끼여", "끼였", "협착", "말림", "말려", "감김", "감겨"] },
    { label: "부딪힘·충돌", query: "부딪힘", terms: ["부딪", "충돌", "충격", "부딪힘", "부딪혀", "맞음", "가격"] },
    { label: "떨어짐·추락", query: "추락", terms: ["추락", "떨어짐", "떨어져", "떨어", "고소작업"] },
    { label: "깔림·매몰·붕괴", query: "깔림", terms: ["깔림", "깔려", "매몰", "붕괴", "무너", "넘어져 깔"] },
    { label: "절단·베임", query: "절단", terms: ["절단", "잘림", "베임", "절상", "절삭"] },
    { label: "감전", query: "감전", terms: ["감전", "전류", "전기"] },
    { label: "화재·폭발", query: "화재", terms: ["화재", "폭발", "발화"] },
    { label: "화상", query: "화상", terms: ["화상", "고온", "열상"] },
    { label: "질식·중독", query: "질식", terms: ["질식", "중독", "유해가스", "산소결핍"] }
  ],
  equipment: [
    { label: "동력 기계·설비", query: "기계", terms: ["기계", "설비", "장비", "공작기계", "CNC", "선반", "밀링", "프레스", "롤러", "컨베이어", "벨트", "풀리", "그라인더", "절단기", "톱", "사출", "금형"] },
    { label: "운반장비", query: "지게차", terms: ["지게차", "차량", "트럭", "운반차", "카트"] },
    { label: "고소·인양장비", query: "크레인", terms: ["크레인", "리프트", "승강기", "사다리", "비계", "고소작업대", "데크플레이트"] },
    { label: "전기설비", query: "전기", terms: ["전기", "분전반", "전선", "전동", "전류", "전압"] }
  ],
  task: [
    { label: "정비·청소·점검", query: "정비", terms: ["정비", "청소", "점검", "수리", "교체", "조정", "제거", "보수"] },
    { label: "작업 보조·지원", query: "보조", terms: ["친구", "동료", "도움", "도우", "보조", "지원", "같이", "대신"] },
    { label: "운반·이송", query: "운반", terms: ["운반", "이송", "적재", "하역", "이동"] },
    { label: "설치·해체", query: "설치", terms: ["설치", "해체", "조립", "분해"] },
    { label: "조작·가공", query: "조작", terms: ["조작", "가공", "운전", "작동", "투입"] }
  ],
  body: [
    { label: "팔·손 부상", query: "팔", terms: ["팔", "손", "손가락", "상지", "어깨", "손목"] },
    { label: "다리·발 부상", query: "다리", terms: ["다리", "발", "발목", "하지", "무릎"] },
    { label: "머리·몸통 부상", query: "머리", terms: ["머리", "두부", "얼굴", "허리", "가슴", "몸통"] }
  ],
  injury: [
    { label: "골절", query: "골절", terms: ["골절", "부러", "전치", "수술"] },
    { label: "절단", query: "절단", terms: ["절단", "절단상", "절단됨"] },
    { label: "사망·중상", query: "중상", terms: ["사망", "중상", "장해", "입원"] }
  ],
  context: [
    { label: "현장실습·학생", query: "현장실습", terms: ["현장실습", "실습생", "학생", "학교", "지도교사", "산업체"] }
  ]
};

function buildSafetyContext(question, keywords, topic) {
  const text = `${question} ${keywords.join(" ")}`;
  const groups = Object.fromEntries(
    Object.entries(safetySignalCatalog).map(([name, signals]) => [name, collectSignals(text, signals)])
  );
  const disasterQueries = buildDisasterQueries(groups, keywords, topic);

  return {
    topic,
    text: normalizeMatchText(text),
    groups,
    disasterQueries
  };
}

function collectSignals(text, signals) {
  const normalized = normalizeMatchText(text);
  return signals
    .filter((signal) => signal.terms.some((term) => normalized.includes(normalizeMatchText(term))))
    .map((signal) => ({
      ...signal,
      matchedTerms: signal.terms.filter((term) => normalized.includes(normalizeMatchText(term)))
    }));
}

function buildDisasterQueries(groups, keywords, topic) {
  const terms = [
    ...groups.accident.map((item) => item.query),
    ...groups.equipment.map((item) => item.query),
    ...groups.task.map((item) => item.query),
    ...groups.injury.map((item) => item.query)
  ];

  if ((topic === "fieldTraining" || topic === "schoolSafety") && !terms.length) {
    terms.push("안전사고");
  }

  for (const keyword of keywords) {
    if (keyword.length >= 2) {
      terms.push(keyword);
    }
  }

  return [...new Set(terms.map((item) => cleanText(item)).filter(Boolean))].slice(0, 6);
}

function attachDisasterRelevance(item, safetyContext) {
  const relevance = scoreDisasterRelevance(item, safetyContext);
  return {
    ...item,
    relevance,
    reliability: {
      ...(item.reliability || {}),
      label: relevance.label,
      needsReview: relevance.score < 70 || item.reliability?.needsReview
    }
  };
}

function scoreDisasterRelevance(item, safetyContext) {
  const text = normalizeMatchText([item.title, item.subtitle, item.summary].filter(Boolean).join(" "));
  const matched = {
    accident: matchSignals(text, safetyContext.groups.accident),
    equipment: matchSignals(text, safetyContext.groups.equipment),
    task: matchSignals(text, safetyContext.groups.task),
    body: matchSignals(text, safetyContext.groups.body),
    injury: matchSignals(text, safetyContext.groups.injury),
    context: matchSignals(text, safetyContext.groups.context)
  };
  const conflictingAccidents = findConflictingAccidents(text, safetyContext.groups.accident);
  const exactEquipmentTerms = getSpecificEquipmentTerms(safetyContext.groups.equipment);
  const exactEquipmentMatched = exactEquipmentTerms.filter((term) => text.includes(normalizeMatchText(term)));
  let score = 0;

  score += matched.accident.length ? 42 : 0;
  score += matched.equipment.length ? 24 : 0;
  score += matched.task.length ? 14 : 0;
  score += matched.body.length ? 8 : 0;
  score += matched.injury.length ? 8 : 0;
  score += matched.context.length ? 6 : 0;
  score += item.url ? 4 : 0;
  score += item.date ? 4 : 0;

  const accidentRequired = safetyContext.groups.accident.length > 0;
  if (accidentRequired && !matched.accident.length) {
    score -= 35;
  }
  if (conflictingAccidents.length && !matched.accident.length) {
    score -= 25;
  }
  if (exactEquipmentTerms.length) {
    if (exactEquipmentMatched.length) {
      score += 18;
    } else {
      score -= 30;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const matchedSignals = Object.values(matched).flat();
  const label = score >= 70 ? "정밀 일치" : score >= 55 ? "참고 가능" : "관련도 낮음";
  const reason = buildRelevanceReason(score, matched, conflictingAccidents, accidentRequired);

  return {
    score,
    label,
    reason,
    matchedSignals: [...new Set(matchedSignals)],
    conflicts: conflictingAccidents,
    exactEquipment: {
      required: exactEquipmentTerms,
      matched: exactEquipmentMatched
    },
    coreMatched: {
      accident: matched.accident.length > 0,
      equipment: matched.equipment.length > 0,
      task: matched.task.length > 0,
      injury: matched.injury.length > 0
    }
  };
}

function matchSignals(text, signals) {
  return signals
    .filter((signal) => signal.terms.some((term) => text.includes(normalizeMatchText(term))))
    .map((signal) => signal.label);
}

function findConflictingAccidents(text, selectedAccidents) {
  const selectedLabels = new Set(selectedAccidents.map((item) => item.label));
  return safetySignalCatalog.accident
    .filter((signal) => !selectedLabels.has(signal.label))
    .filter((signal) => signal.terms.some((term) => text.includes(normalizeMatchText(term))))
    .map((signal) => signal.label);
}

function buildRelevanceReason(score, matched, conflicts, accidentRequired) {
  if (score >= 70) {
    return `사고유형(${matched.accident.join(", ") || "확인 필요"})과 설비·작업 맥락이 함께 맞는 정밀 후보입니다.`;
  }

  if (score >= 55) {
    return "사고유형은 맞지만 설비, 작업상황, 부상 부위 중 일부가 달라 보조 사례로만 참고하세요.";
  }

  if (accidentRequired && !matched.accident.length) {
    return "질문 속 핵심 사고유형과 일치하지 않아 표시 대상에서 제외했습니다.";
  }

  if (conflicts.length) {
    return `다른 사고유형(${conflicts.join(", ")}) 신호가 강해 혼동 가능성이 있습니다.`;
  }

  return "질문과 직접 연결되는 신호가 부족합니다.";
}

function shouldKeepDisasterCandidate(item, safetyContext) {
  const relevance = item.relevance || {};
  const accidentRequired = safetyContext.groups.accident.length > 0;
  const exactEquipmentRequired = relevance.exactEquipment?.required?.length > 0;

  if (accidentRequired && !relevance.coreMatched?.accident) {
    return false;
  }

  if (exactEquipmentRequired && !relevance.exactEquipment?.matched?.length) {
    return false;
  }

  if (accidentRequired) {
    return relevance.score >= 55 && (relevance.coreMatched.equipment || relevance.coreMatched.task || relevance.coreMatched.injury);
  }

  return relevance.score >= 50;
}

function normalizeMatchText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function getSpecificEquipmentTerms(equipmentSignals) {
  const genericTerms = new Set(["기계", "설비", "장비", "공작기계", "전동"]);
  return [...new Set(
    equipmentSignals
      .flatMap((signal) => signal.matchedTerms || [])
      .filter((term) => !genericTerms.has(term) && normalizeMatchText(term).length >= 2)
  )];
}

function parseList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(/[|,]/)
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 12);
}

function hasUsableValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  return !/(나중|대기|신청|준비|pending|todo|none|null)/i.test(text);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key] || item.title;
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function uniqueByValue(items, getValueForItem) {
  const seen = new Set();
  return items.filter((item) => {
    const value = getValueForItem(item);
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function getPublicDataIdentity(item) {
  if (item.url) {
    return item.url;
  }

  return normalizeMatchText([item.title, item.date].filter(Boolean).join("|"));
}

function uniqueString(value, index, values) {
  return values.indexOf(value) === index;
}

function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/\D/g, "");
  const match = compact.length === 8
    ? [compact, compact.slice(0, 4), compact.slice(4, 6), compact.slice(6, 8)]
    : raw.match(/(\d{4})\D*(\d{1,2})\D*(\d{1,2})/);

  if (!match) {
    return value ? String(value) : "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }

  return `${String(year).padStart(4, "0")}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}
