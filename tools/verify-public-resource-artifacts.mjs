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
assert(Array.isArray(index.resources) && index.resources.length >= 500, "index: public resource count regressed below expanded library baseline");
assert(index.stats?.searchOnly === 0, "index: search-only resources must not be published");
assert((index.stats?.byType?.guide || 0) >= 200, "index: practical guide count regressed below expanded library baseline");
assert((index.stats?.byType?.form || 0) >= 300, "index: practical form count regressed below expanded library baseline");
assert(index.resources.filter((resource) => resource.linkKind === "file").length >= 450, "index: directly downloadable file count regressed below expanded library baseline");
assert((index.stats?.embeddedFormCandidates || 0) >= 300, "index: embedded form extraction queue regressed below expanded library baseline");

const resourcesByCategory = index.resources.reduce((acc, resource) => {
  const category = resource.category || "uncategorized";
  acc[category] = (acc[category] || 0) + 1;
  return acc;
}, {});

assert((resourcesByCategory.fieldTraining || 0) >= 45, "index: vocational field-training resources regressed below expanded library baseline");
assert((resourcesByCategory.studentLife || 0) >= 180, "index: student-life resources regressed below expanded library baseline");
assert((resourcesByCategory.schoolAdmin || 0) >= 100, "index: school administration resources regressed below expanded library baseline");
assert((resourcesByCategory.schoolViolenceSafety || 0) >= 100, "index: school violence/safety resources regressed below expanded library baseline");
assert((resourcesByCategory.privacyRecords || 0) >= 25, "index: privacy/records resources regressed below expanded library baseline");
assert((resourcesByCategory.staffLabor || 0) >= 25, "index: staff labor resources regressed below expanded library baseline");

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
  assert(!/google\.com\/search|자료명 검색|공식자료 검색/.test([resource.url, resource.searchUrl, resource.actionLabel].join(" ")), `resource: search proxy leaked (${resource.title})`);
  assert(!/인사발령|공모전|수상작|댄스|소식지|우수사례집|채용\s*공고|시험\s*공고|접수\s*현황/.test([resource.title, resource.description, resource.query].join(" ")), `resource: low-value bulletin leaked (${resource.title})`);
  if (resource.extraction?.embeddedFormCandidate) {
    assert(resource.extraction.originalFileUrl || resource.url, `resource: embedded form source file missing (${resource.title})`);
    assert((resource.extraction.outputFormats || []).includes("pdf"), `resource: embedded form PDF output target missing (${resource.title})`);
    assert((resource.extraction.outputFormats || []).includes("docx"), `resource: embedded form DOCX output target missing (${resource.title})`);
  }
}

const importantResourceText = index.resources.map((item) => `${item.title} ${item.url}`).join("\n");
assert(/직업교육훈련촉진법/.test(importantResourceText), "index: missing vocational education act");
assert(/하이파이브|hifive\.go\.kr/i.test(importantResourceText), "index: missing HIFIVE vocational education resources");
assert(index.resources.filter((resource) => /하이파이브|hifive\.go\.kr/i.test(`${resource.provider} ${resource.url} ${resource.title}`)).length >= 40, "index: HIFIVE vocational resources regressed below expanded library baseline");
assert(index.resources.filter((resource) => /충청북도교육청|충북교육청|cbe\.go\.kr/i.test(`${resource.provider} ${resource.url} ${resource.title}`)).length >= 20, "index: CBE official safety/form resources regressed below expanded library baseline");
assert(index.resources.filter((resource) => /학교지원종합자료실|edupia|gbe\.kr/i.test(`${resource.provider} ${resource.url} ${resource.title}`)).length >= 300, "index: GBE Edupia official form resources regressed below expanded library baseline");
assert(/직업계고.*현장실습.*공통.*매뉴얼/.test(importantResourceText), "index: missing vocational field-training common manuals");
assert(/서식모음집|공통매뉴얼.*한글|표준협약서/.test(importantResourceText), "index: missing vocational editable/form resources");
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
    stats: index.stats,
    resourcesByCategory
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
