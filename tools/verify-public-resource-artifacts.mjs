import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const acquisition = require("../public/public-resource-acquisition-generated.js");
const index = require("../public/public-resource-index-generated.js");

const expectFresh = process.env.RESOURCE_AUTOMATION_EXPECT_FRESH === "1";
const now = Date.now();

assert(acquisition?.generatedAt, "acquisition: generatedAt is missing");
assert(index?.generatedAt, "index: generatedAt is missing");
assert(Array.isArray(acquisition.missions) && acquisition.missions.length >= 8, "acquisition: mission coverage is incomplete");
assert(Array.isArray(acquisition.candidates), "acquisition: candidates must be an array");
assert(Array.isArray(index.resources) && index.resources.length >= 24, "index: public resource count is too small");
assert(index.stats?.searchOnly === 0, "index: search-only resources must not be published");

if (expectFresh) {
  assert(isFresh(acquisition.generatedAt), "acquisition: generatedAt is too old for scheduled automation");
  assert(isFresh(index.generatedAt), "index: generatedAt is too old for scheduled automation");
}

for (const candidate of acquisition.candidates) {
  assert(candidate.includeInLibrary !== false, `candidate: non-public candidate leaked (${candidate.id || candidate.title})`);
  assertDirectUrl(candidate.url, `candidate:${candidate.id || candidate.title}`);
}

for (const resource of index.resources) {
  assert(resource.title && resource.provider, `resource: title/provider missing (${resource.id})`);
  assert(["law", "rule", "guide", "form"].includes(resource.type), `resource: invalid type ${resource.type}`);
  assertDirectUrl(resource.url, `resource:${resource.id || resource.title}`);
  assert(!/원문 후보|원문·지침 후보|검색 대행|확인 필요/.test([resource.title, resource.description, resource.query].join(" ")), `resource: weak placeholder text leaked (${resource.title})`);
}

const importantResourceText = index.resources.map((item) => `${item.title} ${item.url}`).join("\n");
assert(/직업교육훈련촉진법/.test(importantResourceText), "index: missing vocational education act");
assert(/학교생활기록작성및관리지침|학교생활기록부기재요령/.test(importantResourceText), "index: missing school record rule/guide");
assert(/교원휴가에관한예규/.test(importantResourceText), "index: missing teacher leave administrative rule");
assert(!/법령\/[^"'\n]*교원휴가/.test(importantResourceText), "index: teacher leave rule must not use /법령/ path");

console.log(JSON.stringify({
  ok: true,
  acquisition: {
    generatedAt: acquisition.generatedAt,
    publicCandidates: acquisition.candidates.length,
    missions: acquisition.missions.length
  },
  index: {
    generatedAt: index.generatedAt,
    resources: index.resources.length,
    stats: index.stats
  }
}, null, 2));

function assertDirectUrl(url = "", label = "url") {
  const value = String(url || "").trim();
  assert(value, `${label}: direct url is missing`);
  assert(!/google\.com\/search/i.test(value), `${label}: google search proxy is forbidden`);
  assert(!isGenericBoardUrl(value), `${label}: generic board/home URL is forbidden`);
  if (/law\.go\.kr/i.test(value)) {
    assert(!/\/LSW\/admRulSc\.do/i.test(value), `${label}: law.go.kr administrative rule search page is forbidden`);
    assert(/law\.go\.kr\/(법령|행정규칙|LSW\/admRul(?:InfoP|LsInfoP)\.do)/i.test(value), `${label}: law.go.kr URL must point to law or administrative rule detail`);
    assert(!/법령\/[^"'\n]*교원휴가/i.test(value), `${label}: teacher leave rule must not use law path`);
  }
}

function isGenericBoardUrl(url = "") {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    if (["/", "/main", "/main.do", "/index", "/index.do", "/home"].includes(path)) {
      return true;
    }
    return /\/(bbs|board|notice|data|archive)\/?$/i.test(path);
  } catch {
    return true;
  }
}

function isFresh(value = "") {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && now - timestamp <= 6 * 60 * 60 * 1000;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
