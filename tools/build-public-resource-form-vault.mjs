import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const index = require(path.join(rootDir, "public", "public-resource-index-generated.js"));
let extractionQueue = { items: [] };
try {
  extractionQueue = require(path.join(rootDir, "public", "public-resource-form-extraction-queue-generated.js"));
} catch {
  // The public library can be built before an optional extraction queue exists.
}
let previousVault = { entries: [] };
try {
  previousVault = require(path.join(rootDir, "public", "public-resource-form-vault-generated.js"));
} catch {
  // The first build has no prior file verification metadata to preserve.
}
const verifiedFormatByUrl = new Map(
  (previousVault.entries || [])
    .filter((entry) => entry.verifiedFile && entry.sourceUrl && entry.format)
    .map((entry) => [entry.sourceUrl, {
      format: entry.format,
      fileName: entry.fileName || "",
      verifiedFile: true
    }])
);
const generatedAt = new Date();
const runId = generatedAt.toISOString().replace(/[:.]/g, "-");

const TARGET_FORM_COUNT = Number(process.env.PUBLIC_RESOURCE_FORM_VAULT_TARGET || 10000);
const READY_FORM_LIMIT = Number(process.env.PUBLIC_RESOURCE_FORM_VAULT_READY_LIMIT || 50000);
const EXTRACTION_LIMIT = Number(process.env.PUBLIC_RESOURCE_FORM_VAULT_EXTRACTION_LIMIT || 50000);
const HIGH_PRIORITY_THRESHOLD = 70;
const EDITABLE_FORMATS = new Set(["hwp", "hwpx", "doc", "docx", "xls", "xlsx"]);

const entries = buildFormVault();
await writeGeneratedModule(entries);

console.log(`Public resource form vault generated: ${entries.length} entries`);

function buildFormVault() {
  const readyForms = (index.resources || [])
    .filter((resource) => resource.type === "form")
    .filter((resource) => resource.url)
    .map(normalizeReadyForm)
    .slice(0, READY_FORM_LIMIT);

  const extractionEntries = (extractionQueue.queue || [])
    .filter((item) => item.sourceUrl)
    .map(normalizeExtractionCandidate)
    .slice(0, EXTRACTION_LIMIT);

  return dedupeEntries([...readyForms, ...extractionEntries])
    .sort(compareVaultEntries);
}

function normalizeReadyForm(resource = {}) {
  const verified = verifiedFormatByUrl.get(resource.url) || null;
  const format = detectFormat(resource.url, resource) || verified?.format || "";
  const editable = EDITABLE_FORMATS.has(format);
  const pdfPreview = format === "pdf";
  const artifactId = stableId(resource.id || resource.title || resource.url);
  return {
    id: stableId(`form-ready:${resource.id || resource.title}`),
    sourceResourceId: resource.id || "",
    kind: "ready",
    status: "ready",
    statusLabel: "바로 사용",
    title: resource.title || "서식",
    provider: resource.provider || "공식자료",
    category: resource.category || "general",
    hierarchy: resource.hierarchy || null,
    description: resource.description || resource.query || "공식 서식 파일",
    format: format || "file",
    fileName: verified?.fileName || "",
    verifiedFile: Boolean(verified),
    sourceUrl: resource.url,
    downloadUrl: resource.url,
    previewUrl: pdfPreview ? resource.url : "",
    editableUrl: editable ? resource.url : "",
    plannedPdfUrl: pdfPreview ? resource.url : `generated/forms/${artifactId}.pdf`,
    plannedEditableUrl: editable ? resource.url : `generated/forms/${artifactId}.docx`,
    priority: computeReadyPriority(resource, { editable, pdfPreview }),
    tags: buildTags(resource, [
      "바로사용",
      pdfPreview ? "PDF미리보기" : "",
      editable ? "편집가능" : ""
    ]),
    generatedAt: generatedAt.toISOString()
  };
}

function normalizeExtractionCandidate(item = {}) {
  const highPriority = Number(item.priority || 0) >= HIGH_PRIORITY_THRESHOLD;
  const status = highPriority ? "extract_high_priority" : "extract_queued";
  const format = detectFormat(item.sourceUrl, item);
  const artifactId = stableId(item.id || item.title || item.sourceUrl);
  return {
    id: stableId(`form-extract:${item.id || item.title}`),
    sourceResourceId: item.sourceResourceId || "",
    kind: "extraction",
    status,
    statusLabel: highPriority ? "우선 추출 대상" : "추출 대기",
    title: item.title || "지침 속 서식 추출 후보",
    provider: item.provider || "공식자료",
    category: item.category || "general",
    hierarchy: null,
    description: item.reason || "지침·매뉴얼 안의 별지·붙임 서식을 별도 PDF·DOCX로 분리할 후보입니다.",
    format: format || "source",
    sourceUrl: item.sourceUrl,
    downloadUrl: item.sourceUrl,
    previewUrl: format === "pdf" ? item.sourceUrl : "",
    editableUrl: EDITABLE_FORMATS.has(format) ? item.sourceUrl : "",
    plannedPdfUrl: `generated/forms/${artifactId}.pdf`,
    plannedEditableUrl: `generated/forms/${artifactId}.docx`,
    priority: Number(item.priority || 0),
    tags: buildTags(item, [
      "추출대기",
      highPriority ? "우선추출" : "",
      "PDF예정",
      "DOCX예정",
      ...(item.signals || [])
    ]),
    generatedAt: generatedAt.toISOString()
  };
}

function computeReadyPriority(resource = {}, flags = {}) {
  let score = 50;
  if (flags.pdfPreview) score += 12;
  if (flags.editable) score += 16;
  if (/현장실습|표준협약|취업|고졸|직업계고|특성화고|학교폭력|안전|출결|생활기록|복무|학교회계/i.test(resource.title || resource.query || "")) score += 12;
  const year = `${resource.title || ""} ${resource.query || ""}`.match(/20\d{2}/);
  if (year) score += Math.min(Number(year[0]) - 2020, 10);
  return score;
}

function buildTags(item = {}, extra = []) {
  return uniqueStrings([
    item.title,
    item.provider,
    item.category,
    item.hierarchy?.level2,
    item.hierarchy?.level3,
    ...(item.tags || []),
    ...extra
  ].filter(Boolean).map((value) => String(value).trim()));
}

function detectFormat(url = "", item = {}) {
  const value = String(url || "");
  const candidates = [value, item.title, item.description, item.query, item.filename, item.fileName, item.fileRealName]
    .filter(Boolean)
    .map((text) => decodeSafe(String(text)));
  try {
    const parsed = new URL(value);
    for (const [key, paramValue] of parsed.searchParams.entries()) {
      if (/file|name|path/i.test(key)) {
        candidates.push(decodeSafe(paramValue));
      }
    }
  } catch {
    // Some public records provide relative or malformed URLs; fall back to title-based inference.
  }
  const joined = candidates.join(" ").toLowerCase();
  const extension = joined.match(/\.(hwpx?|docx?|xlsx?|pdf)(?:\b|[^a-z0-9])/i);
  if (extension) {
    return extension[1].toLowerCase();
  }
  if (/pdf\s*(다운로드|파일|문서|미리보기)|pdf$/i.test(joined)) return "pdf";
  if (/hwpx/i.test(joined)) return "hwpx";
  if (/hwp|한글\s*(파일|서식|문서|다운로드)|아래아한글/i.test(joined)) return "hwp";
  if (/docx?|워드/i.test(joined)) return "docx";
  if (/xlsx?|엑셀/i.test(joined)) return "xlsx";
  return "";
}

function decodeSafe(value = "") {
  try {
    return decodeURIComponent(String(value || "").replace(/\+/g, " "));
  } catch {
    return String(value || "");
  }
}

function dedupeEntries(entries = []) {
  const seen = new Map();
  for (const entry of entries) {
    const key = getVaultDedupeKey(entry);
    if (!seen.has(key)) {
      seen.set(key, entry);
      continue;
    }
    const existing = seen.get(key);
    seen.set(key, mergeVaultEntries(existing, entry));
  }
  return [...seen.values()];
}

function getVaultDedupeKey(entry = {}) {
  return stableId([
    entry.sourceResourceId,
    entry.sourceUrl,
    entry.downloadUrl,
    entry.title,
    entry.provider
  ].filter(Boolean).join("|"));
}

function mergeVaultEntries(left = {}, right = {}) {
  const ready = left.kind === "ready" ? left : right.kind === "ready" ? right : null;
  const extraction = left.kind === "extraction" ? left : right.kind === "extraction" ? right : null;

  if (ready && extraction) {
    return {
      ...ready,
      priority: Math.max(Number(ready.priority || 0), Number(extraction.priority || 0)),
      plannedPdfUrl: ready.plannedPdfUrl || extraction.plannedPdfUrl,
      plannedEditableUrl: ready.plannedEditableUrl || extraction.plannedEditableUrl,
      extractionPlannedPdfUrl: extraction.plannedPdfUrl || "",
      extractionPlannedEditableUrl: extraction.plannedEditableUrl || "",
      extractionStatus: extraction.status || "",
      extractionStatusLabel: extraction.statusLabel || "",
      hasExtractionPlan: true,
      tags: uniqueStrings([...(ready.tags || []), ...(extraction.tags || []), "PDF·DOCX분리예정"])
    };
  }

  const preferred = Number(left.priority || 0) >= Number(right.priority || 0) ? left : right;
  const fallback = preferred === left ? right : left;
  return {
    ...preferred,
    downloadUrl: preferred.downloadUrl || fallback.downloadUrl,
    previewUrl: preferred.previewUrl || fallback.previewUrl,
    editableUrl: preferred.editableUrl || fallback.editableUrl,
    plannedPdfUrl: preferred.plannedPdfUrl || fallback.plannedPdfUrl,
    plannedEditableUrl: preferred.plannedEditableUrl || fallback.plannedEditableUrl,
    tags: uniqueStrings([...(preferred.tags || []), ...(fallback.tags || [])])
  };
}

function compareVaultEntries(a, b) {
  const statusOrder = { ready: 0, extract_high_priority: 1, extract_queued: 2 };
  return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    || b.priority - a.priority
    || a.title.localeCompare(b.title, "ko");
}

async function writeGeneratedModule(items = []) {
  const stats = {
    total: items.length,
    target: TARGET_FORM_COUNT,
    ready: items.filter((item) => item.status === "ready").length,
    pdfPreview: items.filter((item) => item.previewUrl).length,
    editable: items.filter((item) => item.editableUrl).length,
    plannedPdf: items.filter((item) => item.plannedPdfUrl).length,
    plannedEditable: items.filter((item) => item.plannedEditableUrl).length,
    extractionQueued: items.filter((item) => item.kind === "extraction" || item.hasExtractionPlan).length,
    highPriorityExtraction: items.filter((item) => item.status === "extract_high_priority" || item.extractionStatus === "extract_high_priority").length,
    byCategory: items.reduce((acc, item) => {
      acc[item.category || "general"] = (acc[item.category || "general"] || 0) + 1;
      return acc;
    }, {})
  };

  const data = {
    version: `generated-${runId}`,
    generatedAt: generatedAt.toISOString(),
    policy: "form-vault-v1",
    stats,
    entries: items
  };
  const content = [
    "(function attachGeneratedPublicResourceFormVault(root, factory) {",
    "  const data = factory();",
    "  if (typeof module === \"object\" && module.exports) {",
    "    module.exports = data;",
    "  } else {",
    "    root.GYO6_PUBLIC_RESOURCE_FORM_VAULT = data;",
    "  }",
    `})(typeof globalThis !== "undefined" ? globalThis : window, function createGeneratedPublicResourceFormVault() { return ${JSON.stringify(data, null, 2)}; });`,
    ""
  ].join("\n");

  await mkdir(path.join(rootDir, "public"), { recursive: true });
  await mkdir(path.join(rootDir, "functions", "public"), { recursive: true });
  await writeFile(path.join(rootDir, "public", "public-resource-form-vault-generated.js"), content, "utf8");
  await writeFile(path.join(rootDir, "functions", "public", "public-resource-form-vault-generated.js"), content, "utf8");
}

function stableId(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "form-vault-entry";
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}
