import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.resolve(__dirname, "../../.env.local"));

const PORT = Number(process.env.PORT || 8080);
const LAW_API_PROTOCOL = normalizeProtocol(process.env.LAW_API_PROTOCOL || "https");
const DEFAULT_TIMEOUT_MS = Number(process.env.LAW_GATEWAY_TIMEOUT_MS || 12000);
const MAX_BODY_BYTES = 128 * 1024;

if (process.argv.includes("--once")) {
  const query = process.argv[process.argv.indexOf("--once") + 1] || "직업교육훈련 촉진법";
  const result = await searchAndRead({
    queries: [query],
    keywords: process.argv.slice(process.argv.indexOf("--once") + 2)
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer(handleRequest).listen(PORT, "0.0.0.0", () => {
    console.error(`GYO6 Korean Law Gateway listening on ${PORT}`);
  });
}

export async function handleRequest(request, response) {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "OPTIONS") {
      return sendJson(response, {}, 204);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return sendJson(response, {
        ok: true,
        service: "gyo6-korean-law-gateway",
        lawApi: Boolean(getLawApiKey()),
        protocol: LAW_API_PROTOCOL,
        refererOrigin: getLawApiRefererOrigin() || null
      });
    }

    if (!isAuthorized(request)) {
      return sendJson(response, { error: "게이트웨이 접근 토큰이 필요합니다." }, 401);
    }

    if (url.pathname === "/gyo6/law/search-and-read" && request.method === "POST") {
      return sendJson(response, await searchAndRead(await readJsonBody(request)));
    }

    if (url.pathname === "/mcp" && request.method === "POST") {
      return sendJson(response, await handleMcpCall(await readJsonBody(request)));
    }

    return sendJson(response, { error: "지원하지 않는 경로입니다." }, 404);
  } catch (error) {
    return sendJson(response, { error: scrubSecret(error.message || String(error)) }, 500);
  }
}

export async function searchAndRead(input = {}) {
  const queries = parseList(input.queries || input.query).slice(0, 4);
  const keywords = parseList(input.keywords).slice(0, 10);
  const maxArticles = Math.max(1, Math.min(Number(input.maxArticles || 8), 20));
  const notices = [];

  if (!queries.length) {
    return { ok: false, error: "검색할 법령명이 없습니다.", laws: [], notices };
  }

  const laws = [];
  for (const query of queries) {
    try {
      const search = await searchLaw(query);
      if (!search.items.length) {
        notices.push(`법령 검색 결과 없음: ${query}`);
        continue;
      }

      const selected = selectBestLaw(search.items, query);
      const lawText = await getLawText({
        mst: selected.mst,
        lawId: selected.lawId
      });
      laws.push(buildLawResult({ query, selected, lawText, keywords, maxArticles }));
    } catch (error) {
      notices.push(`법령 원문 조회 실패(${query}): ${scrubSecret(error.message || String(error))}`);
    }
  }

  return {
    ok: laws.length > 0,
    generatedAt: new Date().toISOString(),
    source: "국가법령정보센터",
    protocol: LAW_API_PROTOCOL,
    laws,
    notices
  };
}

async function handleMcpCall(body = {}) {
  const name = body?.params?.name || "";
  const args = body?.params?.arguments || {};
  const id = body?.id ?? null;

  if (name === "search_law") {
    const result = await searchAndRead({
      queries: [args.query],
      keywords: args.keywords || [],
      maxArticles: 6
    });
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: formatSearchAndReadText(result) }]
      }
    };
  }

  if (name === "get_law_text") {
    const lawText = await getLawText({
      mst: args.mst,
      lawId: args.lawId,
      jo: args.jo
    });
    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: formatLawText(lawText) }]
      }
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `지원하지 않는 MCP 도구입니다: ${name}` }
  };
}

async function searchLaw(query) {
  const url = lawApiUrl("/lawSearch.do", {
    OC: getLawApiKey(),
    target: "law",
    type: "JSON",
    query,
    display: "20"
  });
  const data = await fetchJsonWithRetry(url, { context: "법령 검색" });
  return {
    items: normalizeLawSearchItems(data, query)
  };
}

async function getLawText({ mst, lawId, jo } = {}) {
  const params = {
    OC: getLawApiKey(),
    target: "eflaw",
    type: "JSON"
  };
  if (mst) params.MST = String(mst);
  if (lawId) params.ID = String(lawId);
  if (jo) params.JO = String(jo);
  if (!params.MST && !params.ID) {
    throw new Error("MST 또는 법령ID가 필요합니다.");
  }

  const data = await fetchJsonWithRetry(lawApiUrl("/lawService.do", params), { context: "법령 원문" });
  return normalizeLawText(data);
}

function buildLawResult({ query, selected, lawText, keywords, maxArticles }) {
  const articles = selectArticles(lawText.articles, keywords, maxArticles);
  return {
    query,
    lawName: lawText.lawName || selected.title,
    mst: selected.mst || lawText.mst,
    lawId: selected.lawId || lawText.lawId,
    ministry: selected.ministry || lawText.ministry,
    promulgationDate: lawText.promulgationDate || selected.promulgationDate || "",
    enforcementDate: lawText.enforcementDate || selected.enforcementDate || "",
    current: true,
    sourceUrl: buildLawDetailUrl(selected, query),
    verifiedAt: new Date().toISOString(),
    articles
  };
}

function normalizeLawSearchItems(data, query) {
  const root = data?.LawSearch || data?.lawSearch || data || {};
  const rawItems = asArray(root.law || root.item || root.items || []);

  return rawItems.map((item) => ({
    query,
    title: getValue(item, ["법령명한글", "법령명", "법령명_한글", "title"]) || query,
    mst: getValue(item, ["법령일련번호", "MST", "mst"]),
    lawId: getValue(item, ["법령ID", "ID", "lawId"]),
    ministry: getValue(item, ["소관부처명", "소관부처", "ministry"]),
    promulgationDate: formatDate(getValue(item, ["공포일자", "promulgationDate"])),
    enforcementDate: formatDate(getValue(item, ["시행일자", "enforcementDate"])),
    detailLink: getValue(item, ["법령상세링크", "상세링크", "detailLink"])
  })).filter((item) => item.title && (item.mst || item.lawId));
}

function normalizeLawText(data) {
  const law = data?.법령 || data?.Law || data || {};
  const info = law.기본정보 || law.basicInfo || {};
  const rawUnits = law?.조문?.조문단위 || law?.articles || [];
  const articles = asArray(rawUnits)
    .filter((unit) => String(unit?.조문여부 || unit?.articleType || "조문") === "조문")
    .map((unit) => ({
      articleNo: getValue(unit, ["조문번호", "articleNo"]),
      branchNo: getValue(unit, ["조문가지번호", "branchNo"]),
      title: getValue(unit, ["조문제목", "title"]),
      effectiveDate: formatDate(getValue(unit, ["조문시행일자", "effectiveDate"])),
      text: cleanArticleText([
        getValue(unit, ["조문내용", "text"]),
        ...asArray(unit.항).map((hang) => [
          getValue(hang, ["항번호"]),
          getValue(hang, ["항내용"]),
          ...asArray(hang.호).map((ho) => `${getValue(ho, ["호번호"])} ${getValue(ho, ["호내용"])}`)
        ].filter(Boolean).join(" "))
      ].filter(Boolean).join("\n"))
    }))
    .filter((item) => item.articleNo && item.text);

  return {
    lawName: getValue(info, ["법령명_한글", "법령명한글", "법령명"]),
    mst: getValue(info, ["법령일련번호", "MST"]),
    lawId: getValue(info, ["법령ID", "ID"]),
    ministry: getValue(info, ["소관부처", "소관부처명"]),
    promulgationDate: formatDate(getValue(info, ["공포일자"])),
    enforcementDate: formatDate(getValue(info, ["시행일자"])),
    articles
  };
}

function selectBestLaw(items, query) {
  const normalizedQuery = normalizeMatchText(query);
  return [...items].sort((left, right) => {
    const leftTitle = normalizeMatchText(left.title);
    const rightTitle = normalizeMatchText(right.title);
    return scoreLawTitle(rightTitle, normalizedQuery) - scoreLawTitle(leftTitle, normalizedQuery);
  })[0];
}

function scoreLawTitle(title, query) {
  if (title === query) return 100;
  if (title.startsWith(query)) return 80;
  if (title.includes(query) || query.includes(title)) return 60;
  return 0;
}

function selectArticles(articles, keywords, maxArticles) {
  const normalizedKeywords = keywords.map(normalizeMatchText).filter((item) => item.length >= 2);
  const scored = articles.map((article) => {
    const text = normalizeMatchText(`${article.title} ${article.text}`);
    const score = normalizedKeywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
    return { article, score };
  });
  const matched = scored.filter((item) => item.score > 0).sort((left, right) => right.score - left.score);
  const selected = (matched.length ? matched : scored).slice(0, maxArticles).map((item) => item.article);
  return selected.map((article) => ({
    ...article,
    text: truncate(article.text, 1200)
  }));
}

async function fetchJsonWithRetry(url, { context }) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "GYO6-Law-Info-Gateway/1.0",
          ...getLawApiVerificationHeaders()
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`${context} HTTP ${response.status}`);
      }
      if (!text.trim()) {
        throw new Error(`${context} 빈 응답`);
      }
      if (/<!doctype html|<html/i.test(text)) {
        throw new Error(`${context} HTML 응답`);
      }
      const data = JSON.parse(text);
      const apiError = getLawApiErrorMessage(data);
      if (apiError) {
        throw new Error(`${context} API 오류: ${apiError}`);
      }
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await sleep(200 * attempt * attempt);
      }
    }
  }
  throw lastError;
}

function lawApiUrl(pathname, params) {
  const url = new URL(`${LAW_API_PROTOCOL}://www.law.go.kr/DRF${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

function formatSearchAndReadText(result) {
  if (!result.ok) {
    return `[NOT_FOUND] ${result.notices.join(" / ")}`;
  }
  return result.laws.map((law) => [
    `법령: ${law.lawName}`,
    `시행일자: ${law.enforcementDate || "확인 필요"}`,
    `원문: ${law.sourceUrl}`,
    ...law.articles.map((article) => `- 제${article.articleNo}조${article.title ? `(${article.title})` : ""}: ${truncate(article.text, 500)}`)
  ].join("\n")).join("\n\n");
}

function formatLawText(lawText) {
  return [
    `법령: ${lawText.lawName}`,
    `시행일자: ${lawText.enforcementDate || "확인 필요"}`,
    ...lawText.articles.slice(0, 12).map((article) => `- 제${article.articleNo}조${article.title ? `(${article.title})` : ""}: ${truncate(article.text, 700)}`)
  ].join("\n");
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("요청 본문이 너무 큽니다.");
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  return text.trim() ? JSON.parse(text) : {};
}

function isAuthorized(request) {
  const expected = String(process.env.GYO6_MCP_TOKEN || process.env.KOREAN_LAW_MCP_TOKEN || "").trim();
  if (!expected) {
    return true;
  }
  const provided =
    request.headers["x-gyo6-mcp-token"] ||
    request.headers["x-api-key"] ||
    String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return timingSafeEqual(String(provided || ""), expected);
}

function getLawApiKey() {
  return process.env.LAW_OC || process.env.LAW_OPEN_API_OC || process.env.LAW_OPEN_API_KEY || "";
}

function getLawApiVerificationHeaders() {
  const referer = getLawApiReferer();
  try {
    return {
      referer,
      origin: new URL(referer).origin
    };
  } catch {
    return {};
  }
}

function getLawApiReferer() {
  return String(process.env.LAW_OPEN_API_REFERER || process.env.PUBLIC_SITE_URL || "https://gyo6.kr/").trim();
}

function getLawApiRefererOrigin() {
  try {
    return new URL(getLawApiReferer()).origin;
  } catch {
    return "";
  }
}

function getLawApiErrorMessage(data) {
  const result = getValue(data, ["result", "RESULT"]);
  const msg = getValue(data, ["msg", "MSG", "message", "Message"]);
  return [result, msg].filter(Boolean).join(" ");
}

function buildLawDetailUrl(selected, query) {
  const fallbackUrl = buildLawSearchPageUrl(query || selected?.title || "");
  if (selected?.detailLink) {
    const detail = String(selected.detailLink);
    const absoluteUrl = detail.startsWith("http")
      ? detail
      : detail.startsWith("/")
        ? `https://www.law.go.kr${detail}`
        : `https://www.law.go.kr${detail.startsWith("DRF") ? "/" : ""}${detail}`;
    try {
      const url = new URL(absoluteUrl);
      for (const key of ["OC", "serviceKey", "apiKey", "apikey", "key", "KEY"]) {
        url.searchParams.delete(key);
      }
      if (/\/DRF\/law(Service|Search)\.do$/i.test(url.pathname)) {
        return fallbackUrl;
      }
      return url.toString();
    } catch {
      return fallbackUrl;
    }
  }
  return fallbackUrl;
}

function buildLawSearchPageUrl(query) {
  const url = new URL("https://www.law.go.kr/LSW/lsSc.do");
  url.searchParams.set("query", query || "법령");
  return url.toString();
}

function getValue(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanArticleText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMatchText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function formatDate(value) {
  const text = String(value || "").replace(/[^\d]/g, "");
  if (text.length !== 8) return String(value || "");
  return `${text.slice(0, 4)}.${text.slice(4, 6)}.${text.slice(6, 8)}`;
}

function truncate(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function normalizeProtocol(value) {
  return String(value || "").toLowerCase() === "http" ? "http" : "https";
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function scrubSecret(value) {
  const key = getLawApiKey();
  return key ? String(value).replaceAll(key, "[REDACTED]") : String(value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-api-key,x-gyo6-mcp-token"
  });
  response.end(status === 204 ? "" : JSON.stringify(data));
}

function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      if (!/^[A-Z0-9_]+$/.test(key) || process.env[key]) continue;
      process.env[key] = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Cloud Run and other hosts provide environment variables directly.
  }
}
