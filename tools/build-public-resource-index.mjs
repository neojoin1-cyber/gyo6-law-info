import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const generatedAt = new Date();
const runId = generatedAt.toISOString().replace(/[:.]/g, "-");

const [registry, knowledgeBase, corpus, generatedExpansion, generatedAcquisition] = await Promise.all([
  import(pathToFileURL(path.join(rootDir, "public", "policy-source-registry.js"))),
  import(pathToFileURL(path.join(rootDir, "public", "policy-knowledge-base.js"))),
  import(pathToFileURL(path.join(rootDir, "public", "policy-corpus.js"))),
  import(pathToFileURL(path.join(rootDir, "public", "policy-source-expansion-generated.js")).href).catch(() => ({ default: { results: [] } })),
  import(pathToFileURL(path.join(rootDir, "public", "public-resource-acquisition-generated.js")).href).catch(() => ({ default: { candidates: [] } }))
]);

const sourceRegistry = registry.default || registry;
const policyKb = knowledgeBase.default || knowledgeBase;
const policyCorpus = corpus.default || corpus;
const sourceExpansion = generatedExpansion.default || generatedExpansion;
const publicResourceAcquisition = generatedAcquisition.default || generatedAcquisition;
const DOCUMENT_FILE_PATTERN = /\.(pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/i;

const resources = buildResourceIndex();
await writeGeneratedModule(resources);

console.log(`Public resource index generated: ${resources.length} resources`);
console.log(`Direct resources: ${resources.filter((item) => item.linkKind !== "search").length}`);

function buildResourceIndex() {
  const items = [
    ...buildRegistryResources(),
    ...buildCorpusResources(),
    ...buildKnowledgeBaseResources(),
    ...buildGeneratedExpansionResources(),
    ...buildPublicResourceAcquisitionResources(),
    ...buildCuratedResources()
  ];

  return dedupeResources(items)
    .filter(isDisplayReadyResource)
    .sort(compareResources)
    .slice(0, Number(process.env.PUBLIC_RESOURCE_INDEX_LIMIT || 3000));
}

function buildRegistryResources() {
  return Object.entries(sourceRegistry.officialSources || {}).map(([key, source]) => normalizeResource({
    id: `registry:${key}`,
    title: source.title || key,
    provider: source.provider || getProviderForTier(source.tier),
    query: source.query || source.title || key,
    type: classifyType(source),
    sourceTier: source.tier || "",
    url: source.url || source.supportUrl || source.homepage || "",
    searchDomain: getSearchDomain(source),
    description: source.summary || source.query || `${source.title || key} 공식자료`
  }));
}

function buildCorpusResources() {
  return (policyCorpus.entries || [])
    .filter((entry) => ["officialSource", "sourceExpansionResult"].includes(entry.type))
    .flatMap((entry) => {
      if (entry.type === "sourceExpansionResult" && entry.matchedSources?.length) {
        return entry.matchedSources.map((source, index) => normalizeResource({
          id: `corpus:${entry.id}:${index}`,
          title: source.title || entry.title,
          provider: source.provider || source.source || entry.sourceTier,
          query: source.query || entry.query || source.title || entry.title,
          type: classifyType(source),
          sourceTier: source.tier || entry.sourceTier,
          url: source.url || source.supportUrl || source.homepage || "",
          searchDomain: getSearchDomain(source),
          description: source.summary || entry.summary || source.query || ""
        }));
      }

      return [normalizeResource({
        id: `corpus:${entry.id}`,
        title: entry.title,
        provider: entry.provider || entry.sourceTier,
        query: entry.query || entry.title,
        type: classifyType(entry),
        sourceTier: entry.sourceTier,
        description: entry.summary || entry.query || ""
      })];
    });
}

function buildKnowledgeBaseResources() {
  const domains = Object.entries(policyKb.domains || {});
  return domains.flatMap(([domainCode, domain]) => {
    const index = domain.dataIndex || policyKb.schoolPolicyOntology?.specializedDataIndex?.[domainCode] || null;
    const sourceTargets = index?.sourceTargets || domain.sourceKeys || [];
    const growthTargets = index?.dataGrowthTargets || [];
    return [
      ...sourceTargets.map((target, indexNumber) => normalizeResource({
        id: `kb-source-target:${domainCode}:${indexNumber}`,
        title: getReadableSourceTarget(target),
        provider: "설탕과소금 정책 KB",
        query: `${domain.label || domainCode} ${getReadableSourceTarget(target)}`,
        type: classifyType({ title: target, tier: target }),
        sourceTier: "knowledgeBaseSourceTarget",
        description: `${domain.label || domainCode} 답변에서 우선 확인할 공식자료 후보`
      })),
      ...growthTargets.map((target, indexNumber) => normalizeResource({
        id: `kb-growth:${domainCode}:${indexNumber}`,
        title: String(target || "").trim(),
        provider: "설탕과소금 자료확충 후보",
        query: String(target || "").trim(),
        type: classifyType({ title: target }),
        sourceTier: "dataGrowthTarget",
        description: `${domain.label || domainCode} 자료 보강 후보`
      }))
    ];
  });
}

function buildGeneratedExpansionResources() {
  return (sourceExpansion.results || []).flatMap((item, index) => {
    const directUrlItems = (item.directUrls || []).map((source, sourceIndex) => normalizeResource({
      id: `expansion-direct:${item.key || index}:${sourceIndex}`,
      title: source.title || item.title,
      provider: source.provider || getProviderForTier(source.tier),
      query: source.query || item.query || source.title || item.title,
      type: classifyType(source),
      sourceTier: source.tier || item.sourceTier,
      url: source.url || "",
      description: item.answerIntegration?.summary || item.reason || ""
    }));

    const matchedItems = (item.matchedSources || []).map((source, sourceIndex) => normalizeResource({
      id: `expansion-source:${item.key || index}:${sourceIndex}`,
      title: source.title || item.title,
      provider: source.provider || getProviderForTier(source.tier),
      query: source.query || item.query || source.title || item.title,
      type: classifyType(source),
      sourceTier: source.tier || item.sourceTier,
      url: source.url || source.supportUrl || source.homepage || "",
      searchDomain: getSearchDomain(source),
      description: item.answerIntegration?.summary || item.reason || ""
    }));

    return [...directUrlItems, ...matchedItems];
  });
}

function buildPublicResourceAcquisitionResources() {
  return (publicResourceAcquisition.candidates || [])
    .filter((item) => item.includeInLibrary !== false)
    .map((item) => normalizeResource({
      ...item,
      id: `acquisition:${item.id}`,
      provider: item.provider || "공식자료",
      sourceTier: item.source || "resourceAutopilot",
      description: item.description || item.reason || item.query,
      url: item.url || "",
      searchDomain: item.searchDomain,
      category: item.category
    }));
}

function buildCuratedResources() {
  return [
    law("직업교육훈련 촉진법", "현장실습, 직업교육훈련, 산업체 협약 관련 기본 법령"),
    law("산업현장 일학습병행 지원에 관한 법률", "도제학교와 일학습병행 운영 근거"),
    law("초·중등교육법", "학교 운영, 학생 지도, 학칙과 교육활동 기본 근거"),
    law("학교폭력예방 및 대책에 관한 법률", "학교폭력 사안 처리와 학생 보호 절차"),
    law("학교안전사고 예방 및 보상에 관한 법률", "학교안전사고 예방, 보상, 공제 관련 근거"),
    law("개인정보 보호법", "학생·교직원 개인정보 처리와 영상정보 처리 기준"),
    law("근로기준법", "근로계약, 임금, 근로시간, 휴게, 연소자 보호 기준"),
    law("기간제 및 단시간근로자 보호 등에 관한 법률", "기간제·단시간근로자 계약과 차별 금지 기준"),
    rule("학교생활기록 작성 및 관리지침", "국가법령정보센터", "생활기록부 작성, 관리, 정정 기준", "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000188164"),
    guide("학교생활기록부 기재요령", "교육부 학생평가지원포털", "생활기록부 기재, 정정, 출결 처리 실무 자료", "https://star.moe.go.kr/web/contents/m21100.do"),
    searchResource("직업계고 현장실습 운영 매뉴얼", "교육부·하이파이브", "guide", "직업계고 현장실습 운영 매뉴얼 표준협약서 순회지도", "hifive.go.kr"),
    searchResource("현장실습 표준협약서", "교육부·하이파이브", "form", "현장실습 표준협약서 서식", "hifive.go.kr"),
    searchResource("순회지도·상담 기록 서식", "교육부·시도교육청", "form", "현장실습 순회지도 상담 기록 서식", "hifive.go.kr"),
    searchResource("학교폭력 사안처리 가이드북", "교육부·시도교육청", "guide", "학교폭력 사안처리 가이드북 PDF", "moe.go.kr"),
    searchResource("학교안전사고 보고·점검 서식", "교육부·학교안전공제중앙회", "form", "학교 안전사고 보고 점검 서식", "schoolsafe.or.kr")
  ].map(normalizeResource);
}

function law(title, description) {
  return {
    id: `curated:law:${stableId(title)}`,
    type: "law",
    title,
    provider: "국가법령정보센터",
    description,
    query: title,
    url: `https://www.law.go.kr/법령/${encodeURIComponent(title.replace(/\s+/g, ""))}`
  };
}

function rule(title, provider, description, url) {
  return { id: `curated:rule:${stableId(title)}`, type: "rule", title, provider, description, query: title, url };
}

function guide(title, provider, description, url) {
  return { id: `curated:guide:${stableId(title)}`, type: "guide", title, provider, description, query: title, url };
}

function searchResource(title, provider, type, query, searchDomain) {
  return { id: `curated:${type}:${stableId(title)}`, type, title, provider, description: query, query, searchDomain };
}

function normalizeResource(item = {}) {
  const rawTitle = cleanText(item.title || item.name);
  const provider = cleanText(item.provider || item.source || "공식자료");
  const query = cleanText(item.query || rawTitle);
  const initialType = ["law", "rule", "guide", "form"].includes(item.type) ? item.type : classifyType(item);
  const legalResource = extractLegalResource(`${rawTitle} ${query}`);
  const type = legalResource.path === "행정규칙" ? "rule" : legalResource.path === "법령" ? "law" : initialType;
  const title = legalResource.name || rawTitle;
  const url = normalizeDirectUrl(item.url || item.href || item.downloadUrl || item.fileUrl || "", type, title, query);
  const searchUrl = buildSearchUrl({ ...item, title, provider, query, type, url });
  const linkKind = getLinkKind(url);
  const description = cleanDisplayDescription(cleanText(item.description || item.summary || item.use || item.note || query), type, title, provider);
  const category = cleanText(item.category || item.resourceCategory || "")
    || inferResourceCategory(`${type} ${title} ${provider} ${query} ${description} ${item.sourceTier || item.tier || ""}`);
  return {
    id: stableId(item.id || `${type}:${provider}:${title}:${url || query}`),
    type,
    category,
    title,
    provider,
    query,
    sourceTier: cleanText(item.sourceTier || item.tier || ""),
    description,
    url,
    searchUrl,
    linkKind,
    extraction: normalizeExtractionPlan(item.extraction, { type, title, query, url }),
    generatedAt: generatedAt.toISOString()
  };
}

function normalizeExtractionPlan(extraction = null, item = {}) {
  const text = compactText(`${item.type || ""} ${item.title || ""} ${item.query || ""}`);
  const embeddedFormCandidate = Boolean(
    extraction?.embeddedFormCandidate
    || /서식|양식|신청서|보고서|동의서|협약서|계약서|점검표|체크리스트|기록|대장|조서|품의|검수|정산|부록|붙임|별지|서식모음/i.test(text)
  );
  if (!embeddedFormCandidate) {
    return { embeddedFormCandidate: false, status: "source_only", outputFormats: [] };
  }
  const outputFormats = [...new Set(extraction?.outputFormats || [])];
  return {
    embeddedFormCandidate: true,
    originalFileUrl: cleanText(extraction?.originalFileUrl || item.url || ""),
    status: cleanText(extraction?.status === "source_only" ? "queued_for_verified_pdf_docx_split" : extraction?.status || "queued_for_verified_pdf_docx_split"),
    outputFormats: outputFormats.length ? outputFormats : ["pdf", "docx"]
  };
}

function cleanDisplayDescription(description = "", type = "", title = "", provider = "") {
  const text = cleanText(description);
  if (type === "law") {
    return `${provider || "국가법령정보센터"}에서 제공하는 ${title} 원문`;
  }
  if (!text || /후보|검색|확인 필요/.test(text)) {
    return `${provider || "공식자료"} 공식 원문·자료`;
  }
  return text.replace(/원문·지침 후보/g, "공식 원문·지침").replace(/원문 후보/g, "공식 원문");
}

function classifyType(item = {}) {
  const titleText = compactText(item.title || item.name || "");
  const tierText = compactText(item.sourceTier || item.tier || "");
  const text = compactText([item.title, item.name, item.query, item.provider, item.source, item.sourceTier, item.tier, item.description, item.summary].join(" "));
  const legalResource = extractLegalResource(text);
  if (legalResource.path === "행정규칙") return "rule";
  if (legalResource.path === "법령") return "law";
  if (/법률|법령|시행령|시행규칙/.test(titleText) || /nationalLaw/i.test(tierText)) return "law";
  if (/고시|훈령|예규|행정규칙|관리지침|규정|규칙|학칙|취업규칙|단체협약/.test(titleText) || /schoolRule|officialRule/i.test(tierText)) return "rule";
  if (/표준협약서|협약서|신청서|보고서|동의서|기록서|점검표|체크리스트|서식|양식|template|form/.test(text)) return "form";
  return "guide";
}

function inferResourceCategory(value = "") {
  const text = compactText(value);
  if (/현장실습|직업계고|특성화고|마이스터고|표준협약|도제|일학습|NCS|하이파이브|취업지원|고졸채용/i.test(text)) {
    return "fieldTraining";
  }
  if (/학교폭력|사안처리|학생보호|안전사고|학교안전|산업안전|실습실|위험성평가|보건|감염병|급식|아동학대|성폭력|딥페이크/i.test(text)) {
    return "schoolViolenceSafety";
  }
  if (/학교생활기록|생활기록부|출결|학적|교외체험학습|현장체험학습|수학여행|학생생활|생활지도|학생선도|학업성적|평가|전입|전출|졸업/i.test(text)) {
    return "studentLife";
  }
  if (/학교회계|예산|결산|계약|수의계약|강사수당|강사료|품의|검수|지출|정산|학교운영위원회|학칙|규정개정|행정/i.test(text)) {
    return "schoolAdmin";
  }
  if (/개인정보|정보공개|공공기록|기록물|기록관리|CCTV|영상정보|정보보안|저작권|공문서|비공개|나이스|NEIS/i.test(text)) {
    return "privacyRecords";
  }
  if (/교원휴가|복무|연가|병가|공가|특별휴가|출장|근무상황|교육공무직|계약제교원|기간제|인사관리|취업규칙|단체협약|노무|근로기준/i.test(text)) {
    return "staffLabor";
  }
  if (/진로|취업|채용|취업추천|면접|자소서|이력서|고용|청년지원/i.test(text)) {
    return "careerEmployment";
  }
  return "general";
}

function normalizeDirectUrl(url = "", type = "", title = "", query = "") {
  const value = cleanText(url);
  if (value && !isGenericUrl(value) && !isBrokenLawUrl(value)) return value;
  if (type === "law" || type === "rule") {
    const legalResource = extractLegalResource(`${title} ${query}`);
    return legalResource.name && legalResource.path
      ? `https://www.law.go.kr/${legalResource.path}/${encodeURIComponent(legalResource.name)}`
      : "";
  }
  return "";
}

function buildSearchUrl(item = {}) {
  return "";
}

function getSearchDomain(source = {}) {
  return source.searchDomain || getDomainFromUrl(source.url || source.supportUrl || source.homepage || "") || getDefaultDomain([source.provider, source.tier, source.title].join(" "));
}

function getDomainFromUrl(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getDefaultDomain(value = "") {
  const text = String(value || "");
  if (/국가법령|법령|nationalLaw/i.test(text)) return "law.go.kr";
  if (/교육부|ministry/i.test(text)) return "moe.go.kr";
  if (/하이파이브|직업계고|현장실습/i.test(text)) return "hifive.go.kr";
  if (/고용노동부|노동부|moel/i.test(text)) return "moel.go.kr";
  if (/안전보건공단|산업안전|kosha/i.test(text)) return "kosha.or.kr";
  if (/개인정보보호위원회|pipc/i.test(text)) return "pipc.go.kr";
  if (/경상북도교육청|경북교육청/.test(text)) return "gbe.kr";
  if (/교육청/.test(text)) return "moe.go.kr";
  return "";
}

function getProviderForTier(tier = "") {
  if (/nationalLaw/i.test(tier)) return "국가법령정보센터";
  if (/ministry/i.test(tier)) return "교육부";
  if (/educationOffice/i.test(tier)) return "시도교육청";
  if (/schoolRule/i.test(tier)) return "학교규정";
  return "공식자료";
}

function getReadableSourceTarget(value = "") {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^schoolRecordGuide$/i, "학교생활기록부 기재요령")
    .replace(/^schoolRecordRule$/i, "학교생활기록 작성 및 관리지침")
    .replace(/^fieldExperienceGuide$/i, "교외체험학습 운영 지침")
    .replace(/^schoolViolenceGuide2025$/i, "학교폭력 사안처리 가이드북")
    .trim();
}

function getLinkKind(url = "") {
  if (!url) return "search";
  if (DOCUMENT_FILE_PATTERN.test(url) || /\/cf\/fileDownload\.do|\/fileDownload\.do/i.test(url)) return "file";
  if (/law\.go\.kr/i.test(url)) return "law";
  return "page";
}

function isGenericUrl(url = "") {
  try {
    const parsed = new URL(url);
    if (/law\.go\.kr$/i.test(parsed.hostname.replace(/^www\./, "")) && /\/LSW\/admRulSc\.do$/i.test(parsed.pathname)) return true;
    const pathName = parsed.pathname.replace(/\/+$/, "") || "/";
    if (["/", "/main", "/main.do", "/index", "/index.do", "/home", "/kosha", "/kosha/index.do"].includes(pathName)) return true;
    return /\/(bbs|board|notice|data|archive)\/?$/i.test(pathName);
  } catch {
    return false;
  }
}

function extractLawName(value = "") {
  return extractLegalResource(value).name;
}

function extractLegalResource(value = "") {
  const normalized = String(value || "").replace(/\s+/g, "");
  const adminRuleNames = [
    "교원휴가에관한예규",
    "교원의학생생활지도에관한고시",
    "학교생활기록작성및관리지침",
    "학교생활기록부기재요령",
    "교육공무원인사관리규정"
  ];
  const knownLawNames = [
    "학교폭력예방및대책에관한법률",
    "학교안전사고예방및보상에관한법률",
    "교원의지위향상및교육활동보호를위한특별법",
    "지방자치단체를당사자로하는계약에관한법률",
    "장애인등에대한특수교육법",
    "공공기관의정보공개에관한법률",
    "공공기록물관리에관한법률",
    "중대재해처벌등에관한법률",
    "직업교육훈련촉진법",
    "산업안전보건법",
    "개인정보보호법",
    "국가공무원복무규정",
    "지방공무원복무규정",
    "근로기준법",
    "초·중등교육법시행령",
    "초중등교육법시행령",
    "초·중등교육법",
    "초중등교육법",
    "학교급식법",
    "학교보건법"
  ];
  const adminMatch = adminRuleNames.find((ruleName) => normalized.includes(ruleName.replace(/\s+/g, "")));
  if (adminMatch) return { name: adminMatch, path: "행정규칙" };
  const lawMatch = knownLawNames.find((lawName) => normalized.includes(lawName.replace(/\s+/g, "")));
  if (lawMatch) return { name: lawMatch, path: "법령" };
  return { name: "", path: "" };
}

function isDisplayReadyResource(item = {}) {
  if (!item.title || !item.type || !item.url) return false;
  if (item.linkKind === "search") return false;
  if (/google\.com\/search/i.test([item.url, item.searchUrl].join(" "))) return false;
  if (isGenericUrl(item.url)) return false;
  if (isBrokenLawUrl(item.url)) return false;
  return true;
}

function isBrokenLawUrl(url = "") {
  if (!/law\.go\.kr\/(법령|행정규칙)\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").map((part) => decodeURIComponent(part));
    const lawName = parts.pop() || "";
    const pathType = parts.pop() || "";
    const legalResource = extractLegalResource(lawName);
    if (!legalResource.name || /및.+기준|자료|검색|확인|후보/.test(lawName)) return true;
    if (pathType && pathType !== legalResource.path) return true;
    return lawName !== legalResource.name && lawName.length > legalResource.name.length + 5;
  } catch {
    return true;
  }
}

function dedupeResources(items = []) {
  const map = new Map();
  for (const item of items.filter(Boolean)) {
    const key = compactText(`${item.type}|${item.title}|${item.provider}`);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    const winnerUrl = preferUrl(existing.url, item.url);
    map.set(key, {
      ...existing,
      ...item,
      url: winnerUrl,
      searchUrl: existing.searchUrl || item.searchUrl,
      linkKind: getLinkKind(winnerUrl),
      description: existing.description.length >= item.description.length ? existing.description : item.description
    });
  }
  return [...map.values()];
}

function preferUrl(left = "", right = "") {
  if (!left) return right || "";
  if (!right) return left;
  const rank = (url) => getLinkKind(url) === "file" ? 4 : getLinkKind(url) === "law" ? 3 : getLinkKind(url) === "page" ? 2 : 1;
  return rank(right) > rank(left) ? right : left;
}

function compareResources(a, b) {
  const typeOrder = { guide: 0, form: 1, rule: 2, law: 3 };
  const directRank = (item) => item.linkKind === "file" ? -3 : item.linkKind === "law" ? -2 : item.linkKind === "page" ? -1 : 0;
  return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9)
    || directRank(a) - directRank(b)
    || extractResourceYear(b) - extractResourceYear(a)
    || a.title.localeCompare(b.title, "ko");
}

function extractResourceYear(item = {}) {
  const match = `${item.title || ""} ${item.query || ""}`.match(/20\d{2}/);
  return match ? Number(match[0]) : 0;
}

async function writeGeneratedModule(payload) {
  const data = {
    version: `generated-${runId}`,
    generatedAt: generatedAt.toISOString(),
    stats: {
      total: payload.length,
      direct: payload.filter((item) => item.linkKind !== "search").length,
      searchOnly: payload.filter((item) => item.linkKind === "search").length,
      byType: payload.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {}),
      embeddedFormCandidates: payload.filter((item) => item.extraction?.embeddedFormCandidate).length
    },
    resources: payload
  };
  const content = [
    "(function attachGeneratedPublicResourceIndex(root, factory) {",
    "  const data = factory();",
    "  if (typeof module === \"object\" && module.exports) {",
    "    module.exports = data;",
    "  } else {",
    "    root.GYO6_PUBLIC_RESOURCE_INDEX = data;",
    "  }",
    `})(typeof globalThis !== "undefined" ? globalThis : window, function createGeneratedPublicResourceIndex() { return ${JSON.stringify(data, null, 2)}; });`,
    ""
  ].join("\n");

  await mkdir(path.join(rootDir, "public"), { recursive: true });
  await mkdir(path.join(rootDir, "functions", "public"), { recursive: true });
  await writeFile(path.join(rootDir, "public", "public-resource-index-generated.js"), content, "utf8");
  await writeFile(path.join(rootDir, "functions", "public", "public-resource-index-generated.js"), content, "utf8");
}

function stableId(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "resource";
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compactText(value = "") {
  return cleanText(value).replace(/\s+/g, "");
}
