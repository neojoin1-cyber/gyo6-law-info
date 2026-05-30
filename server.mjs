import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, "public");
const env = loadEnvFile(path.join(rootDir, ".env.local"));
const port = Number(env.PORT || 5173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/health") {
      return sendJson(response, getHealthStatus());
    }

    if (requestUrl.pathname === "/api/search") {
      return sendJson(response, await handleSearch(requestUrl));
    }

    return serveStatic(requestUrl, response);
  } catch (error) {
    console.error(error);
    return sendJson(response, { error: "서버 처리 중 오류가 발생했습니다." }, 500);
  }
}).listen(port, () => {
  console.log(`GYO6 Law Info dev server: http://localhost:${port}`);
});

function loadEnvFile(filePath) {
  const result = {};

  try {
    const content = readFileSync(filePath, "utf-8");

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separator = line.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = line.slice(0, separator).trim();
      if (!/^[A-Z0-9_]+$/.test(key)) {
        continue;
      }

      result[key] = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // The server can still run and show clear missing-key messages.
  }

  return result;
}

function getHealthStatus() {
  return {
    ok: true,
    keys: {
      lawOpenApi: hasUsableValue(getLawOpenApiKey()),
      publicData: hasUsableValue(env.PUBLIC_DATA_API_KEY),
      openAi: hasUsableValue(env.OPENAI_API_KEY),
      scourt: hasUsableValue(env.SCOUT_API_KEY),
      nanet: hasUsableValue(env.NANET_API_KEY)
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
  const safetyKeyword = chooseSafetyKeyword(question, keywords, topic);
  const lawOpenApiKey = getLawOpenApiKey();
  const publicDataKey = env.PUBLIC_DATA_API_KEY;

  const [lawResults, interpretationResults, disasterResults, materialResults] = await Promise.all([
    hasUsableValue(lawOpenApiKey) ? searchLaws(lawOpenApiKey, lawQueries) : missingKey("LAW_OPEN_API_OC"),
    hasUsableValue(lawOpenApiKey) ? searchLawInterpretations(lawOpenApiKey, question) : missingKey("LAW_OPEN_API_OC"),
    hasUsableValue(publicDataKey) ? searchDisasterCases(publicDataKey, safetyKeyword) : missingKey("PUBLIC_DATA_API_KEY"),
    hasUsableValue(publicDataKey) ? searchSafetyMaterials(publicDataKey) : missingKey("PUBLIC_DATA_API_KEY")
  ]);

  return {
    query: question,
    topic,
    generatedAt: new Date().toISOString(),
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
  return env.LAW_OPEN_API_OC || env.LAW_OPEN_API_KEY;
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
    const data = await fetchJson(url);
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

async function searchDisasterCases(publicDataKey, keyword) {
  const url = new URL("http://apis.data.go.kr/B552468/disaster_api02/getdisaster_api02");
  url.searchParams.set("serviceKey", publicDataKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "5");
  url.searchParams.set("callApiId", "1060");
  if (keyword) {
    url.searchParams.set("keyword", keyword);
  }

  try {
    const data = await fetchJson(url);
    return {
      items: normalizePublicDataItems(data, "국내재해사례", "한국산업안전보건공단"),
      notices: []
    };
  } catch (error) {
    return {
      items: [],
      notices: [`국내재해사례 검색 실패: ${error.message}`]
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

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
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
      type: getLawTargetLabel(target)
    };
  }).filter((item) => item.title);
}

function normalizePublicDataItems(data, type, source) {
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
      summary: String(summary).slice(0, 180),
      url: normalizeUrl(url),
      type
    };
  }).filter((item) => item.title);
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

function getLawTargetLabel(target) {
  const labels = {
    law: "법령",
    expc: "법령해석례",
    moelCgmExpc: "고용노동부 법령해석"
  };
  return labels[target] || target;
}

function chooseSafetyKeyword(question, keywords, topic) {
  const preferred = [
    "현장실습",
    "중대재해",
    "산업안전",
    "안전사고",
    "끼임",
    "추락",
    "감전",
    "지게차",
    "화재"
  ];

  const combined = `${question} ${keywords.join(" ")}`;
  const found = preferred.find((word) => combined.includes(word));
  if (found) {
    return found;
  }

  if (topic === "schoolSafety" || topic === "fieldTraining") {
    return "안전사고";
  }

  return keywords.find((word) => word.length >= 2) || "";
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

function uniqueString(value, index, values) {
  return values.indexOf(value) === index;
}

function formatDate(value) {
  const text = String(value || "").replace(/\D/g, "");
  if (text.length !== 8) {
    return value ? String(value) : "";
  }
  return `${text.slice(0, 4)}.${text.slice(4, 6)}.${text.slice(6, 8)}`;
}

async function serveStatic(requestUrl, response) {
  const requestedPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
  const filePath = path.normalize(path.join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir)) {
    return sendText(response, "Forbidden", 403);
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return sendText(response, "Not found", 404);
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  } catch {
    response.writeHead(302, { location: "/" });
    response.end();
  }
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(data));
}

function sendText(response, text, status = 200) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}
