import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vaultPath = path.join(rootDir, "public", "public-resource-form-vault-generated.js");
const functionsVaultPath = path.join(rootDir, "functions", "public", "public-resource-form-vault-generated.js");
const loaded = await import(`${pathToFileURL(vaultPath)}?v=${Date.now()}`);
const vault = loaded.default || loaded;
const EDITABLE_FORMATS = new Set(["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);
const candidates = (vault.entries || []).filter((entry) =>
  entry.status === "ready"
  && entry.sourceUrl
  && (!entry.verifiedFile || entry.format === "file")
);

let cursor = 0;
let verified = 0;
let editable = 0;
const workers = Array.from({ length: Math.min(12, candidates.length) }, async () => {
  while (cursor < candidates.length) {
    const entry = candidates[cursor++];
    const metadata = await inspectRemoteFile(entry.sourceUrl);
    if (!metadata) continue;
    entry.format = metadata.format;
    entry.fileName = metadata.fileName;
    entry.verifiedFile = true;
    entry.downloadUrl = entry.sourceUrl;
    entry.previewUrl = metadata.format === "pdf" ? entry.sourceUrl : "";
    entry.editableUrl = EDITABLE_FORMATS.has(metadata.format) ? entry.sourceUrl : "";
    entry.plannedEditableUrl = entry.editableUrl || entry.plannedEditableUrl;
    entry.tags = unique([
      ...(entry.tags || []).filter((tag) => !/^FILE$/i.test(tag)),
      metadata.format.toUpperCase(),
      entry.editableUrl ? "편집가능" : ""
    ]);
    verified += 1;
    if (entry.editableUrl) editable += 1;
  }
});

await Promise.all(workers);
vault.generatedAt = new Date().toISOString();
vault.stats = buildStats(vault.entries || [], vault.stats || {});
const content = renderModule(vault);
await writeFile(vaultPath, content, "utf8");
await writeFile(functionsVaultPath, content, "utf8");
console.log(`Verified ${verified}/${candidates.length} remote form files; ${editable} are directly editable.`);

async function inspectRemoteFile(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "gyo6-form-vault/1.0" }
    });
    if (!response.ok) return null;
    const disposition = response.headers.get("content-disposition") || "";
    const contentType = response.headers.get("content-type") || "";
    const fileName = getFileName(disposition);
    const format = detectFormat([fileName, disposition, response.url, contentType].join(" "));
    await response.body?.cancel();
    if (!format || (!/attachment/i.test(disposition) && /text\/html/i.test(contentType))) return null;
    return { format, fileName };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getFileName(disposition) {
  const utf8 = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8) return decodeSafe(utf8[1].replace(/^"|"$/g, ""));
  const plain = disposition.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  return (plain?.[1] || plain?.[2] || "").trim();
}

function detectFormat(value) {
  const match = String(value).match(/\.(hwpx?|docx?|xlsx?|pptx?|pdf)(?:\b|[^a-z0-9])/i);
  if (match) return match[1].toLowerCase();
  if (/application\/pdf/i.test(value)) return "pdf";
  return "";
}

function buildStats(entries, previous) {
  const ready = entries.filter((entry) => entry.status === "ready");
  return {
    ...previous,
    total: entries.length,
    ready: ready.length,
    pdfPreview: ready.filter((entry) => entry.previewUrl).length,
    editable: ready.filter((entry) => entry.editableUrl).length,
    verifiedFiles: ready.filter((entry) => entry.verifiedFile).length
  };
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
