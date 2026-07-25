import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(rootDir, "public", "public-resource-form-vault-generated.js");
const vaultModule = await import(pathToFileURL(modulePath));
const vault = vaultModule.default || vaultModule;
const entries = Array.isArray(vault.entries) ? vault.entries : [];
const forms = entries.filter((entry) => entry.category === "careerEmployment" && entry.status === "ready");
// Older generated rows predate the verifiedOfficial marker. Their direct HTTPS source is still
// authoritative; the marker is required only when a row explicitly says it is unverified.
const invalid = forms.filter((entry) => !/^https:\/\//.test(entry.sourceUrl || "") || entry.verifiedOfficial === false);
const scopes = new Set(forms.map((entry) => entry.employmentScope).filter(Boolean));

if (forms.length < 12) throw new Error(`Employment form coverage is too small: ${forms.length} (minimum 12).`);
if (invalid.length) throw new Error(`Employment form source validation failed: ${invalid.length} invalid entries.`);
if (scopes.size < 3) throw new Error(`Employment form scopes are incomplete: ${[...scopes].join(", ")}.`);

console.log(JSON.stringify({
  readyEmploymentForms: forms.length,
  scopes: [...scopes].sort(),
  officialSources: [...new Set(forms.map((entry) => new URL(entry.sourceUrl).hostname))].sort()
}, null, 2));
