import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const policyEngine = require("../public/policy-engine.js");

export function analyzePolicy(question) {
  return policyEngine.analyzePolicyQuestion(question);
}

export function lookupPolicy(question) {
  return policyEngine.lookupPolicyRules(analyzePolicy(question));
}

export function queryPolicy(question, options = {}) {
  return policyEngine.buildPolicyResponse({
    question,
    officeLabel: options.officeLabel || "소속 교육청",
    roleLabel: options.roleLabel || ""
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error("Usage: node tools/policy-query-engine.mjs <question>");
    process.exit(1);
  }

  const response = queryPolicy(question);
  console.log(JSON.stringify(response, null, 2));
}
