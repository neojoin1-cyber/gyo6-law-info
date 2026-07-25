import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vaultPath = path.join(rootDir, "public", "public-resource-form-vault-generated.js");
const indexPath = path.join(rootDir, "public", "public-resource-index-generated.js");
const sourceVault = await import(pathToFileURL(vaultPath));
const sourceIndex = await import(pathToFileURL(indexPath));
const vault = sourceVault.default || sourceVault;
const index = sourceIndex.default || sourceIndex;

// These are school-to-employment documents, even when the source library filed them under operations.
const EMPLOYMENT_TERMS = /고졸|취업|채용서류|이력서|자기소개서|면접|취업추천|취업희망|취업처|취업률|직무|근로계약|근로조건|현장실습|일학습|도제|표준협약/i;
const EXCLUDE_TERMS = /교원|교육공무직|기간제|강사채용|전임코치|계약제교원/i;

const existing = (Array.isArray(vault.entries) ? vault.entries : []).map((entry) => {
  if (entry.category !== "careerEmployment") return entry;
  const text = searchable(entry);
  return {
    ...entry,
    employmentScope: entry.employmentScope || employmentScope(text),
    verifiedOfficial: entry.verifiedOfficial !== false && /^https:\/\//.test(entry.sourceUrl || "")
  };
});
const crossFiled = (index.resources || [])
  .filter((resource) => resource.type === "form" && resource.url)
  .filter((resource) => EMPLOYMENT_TERMS.test(String(resource.title || "")))
  .filter((resource) => !EXCLUDE_TERMS.test(searchable(resource)))
  .map(normalizeCareerForm);

const existingCareerSources = new Set(
  existing.filter((entry) => entry.category === "careerEmployment").map((entry) => entry.sourceUrl || entry.id)
);
// Keep the original category records intact. A cross-filed record is an additional discovery path,
// not a reclassification that would make an operations form disappear from its original shelf.
const additions = crossFiled.filter((entry) => !existingCareerSources.has(entry.sourceUrl || entry.id));
const entries = [...existing, ...additions].sort((a, b) => {
  const aCareer = a.category === "careerEmployment" ? 0 : 1;
  const bCareer = b.category === "careerEmployment" ? 0 : 1;
  return aCareer - bCareer || String(a.title).localeCompare(String(b.title), "ko");
});
const careerReady = entries.filter((entry) => entry.category === "careerEmployment" && entry.status === "ready");
const stats = buildStats(entries, vault.stats || {});
stats.careerEmploymentReady = careerReady.length;
stats.careerEmploymentCoverage = {
  jobPreparation: careerReady.filter((entry) => entry.employmentScope === "jobPreparation").length,
  interview: careerReady.filter((entry) => entry.employmentScope === "interview").length,
  fieldToEmployment: careerReady.filter((entry) => entry.employmentScope === "fieldToEmployment").length,
  employmentAdministration: careerReady.filter((entry) => entry.employmentScope === "employmentAdministration").length
};

const next = {
  ...vault,
  version: `career-employment-expanded-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  generatedAt: new Date().toISOString(),
  policy: "form-vault-v2-career-employment-official-source",
  stats,
  entries
};

await writeFile(vaultPath, renderModule(next), "utf8");
console.log(`Career employment form vault built: ${careerReady.length} ready employment forms / ${entries.length} total forms`);

function normalizeCareerForm(resource) {
  const text = searchable(resource);
  const format = detectFormat(resource.url);
  return {
    id: `form-ready-career-crossfile-${stableId(resource.id || resource.url)}`,
    sourceResourceId: resource.id || "",
    kind: "ready",
    status: "ready",
    statusLabel: "바로 사용",
    title: resource.title || "취업 서식",
    provider: resource.provider || "공식자료",
    category: "careerEmployment",
    hierarchy: resource.hierarchy || null,
    description: resource.description || "공식 원문 서식",
    format,
    sourceUrl: resource.url,
    downloadUrl: resource.url,
    previewUrl: format === "pdf" ? resource.url : "",
    editableUrl: /^(hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx)$/.test(format) ? resource.url : "",
    plannedPdfUrl: format === "pdf" ? resource.url : "",
    plannedEditableUrl: /^(hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx)$/.test(format) ? resource.url : "",
    priority: 92,
    tags: unique(["취업·진로", employmentScope(text), format.toUpperCase()].filter(Boolean)),
    employmentScope: employmentScope(text),
    verifiedOfficial: true,
    sourceTier: resource.sourceTier || "official-file-harvest"
  };
}

function employmentScope(text) {
  if (/면접|심사|질문지/.test(text)) return "interview";
  if (/현장실습|도제|일학습|표준협약|기업/.test(text)) return "fieldToEmployment";
  if (/근로계약|근로조건|채용서류|반환/.test(text)) return "employmentAdministration";
  return "jobPreparation";
}

function buildStats(entries, previous) {
  const ready = entries.filter((entry) => entry.status === "ready");
  const byCategory = {};
  for (const entry of entries) byCategory[entry.category || "general"] = (byCategory[entry.category || "general"] || 0) + 1;
  return {
    ...previous,
    total: entries.length,
    ready: ready.length,
    pdfPreview: ready.filter((entry) => entry.previewUrl).length,
    editable: ready.filter((entry) => entry.editableUrl).length,
    byCategory
  };
}

function searchable(item) {
  return [item.title, item.description, item.query, item.category, ...(item.tags || [])].join(" ");
}

function detectFormat(url = "") {
  const match = String(url).match(/\.(pdf|hwp|hwpx|docx?|xlsx?|pptx?)(?:[?#]|$)/i);
  return match ? match[1].toLowerCase() : "file";
}

function stableId(value = "") {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function renderModule(data) {
  return [
    "(function attachGeneratedPublicResourceFormVault(root, factory) {",
    "  const data = factory();",
    "  if (typeof module === \"object\" && module.exports) {",
    "    module.exports = data;",
    "  } else {",
    "    root.GYO6_PUBLIC_RESOURCE_FORM_VAULT = data;",
    "  }",
    "})(typeof globalThis !== \"undefined\" ? globalThis : window, function createGeneratedPublicResourceFormVault() { return " + JSON.stringify(data, null, 2) + "; });",
    ""
  ].join("\n");
}
