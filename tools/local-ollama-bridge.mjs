import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handlePolicyChatRequest } from "../functions/shared/policy-chat.mjs";
import {
  getLocalLlmHealthStatus,
  maybeApplyLocalLlmPolicyNormalizer,
  maybeAttachLocalLlmPolicyComposer
} from "../functions/shared/local-llm.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = {
  ...process.env,
  ...loadEnvFile(path.join(rootDir, ".env.local"))
};
const port = Number(env.LOCAL_LLM_BRIDGE_PORT || 8789);
const host = env.LOCAL_LLM_BRIDGE_HOST || "127.0.0.1";
const token = cleanText(env.LOCAL_LLM_BRIDGE_TOKEN || env.REMOTE_LOCAL_LLM_TOKEN || "");

if (!token) {
  console.error("LOCAL_LLM_BRIDGE_TOKEN is required. Do not run the bridge without a shared token.");
  process.exit(1);
}

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);

    if (requestUrl.pathname === "/health" || requestUrl.pathname === "/api/health") {
      if (!hasValidBridgeToken(request)) {
        return sendJson(response, {
          ok: true,
          service: "gyo6-local-ollama-bridge",
          authenticated: false
        });
      }

      return sendJson(response, {
        ok: true,
        service: "gyo6-local-ollama-bridge",
        authenticated: true,
        localLlm: await getLocalLlmHealthStatus(env)
      });
    }

    if (requestUrl.pathname === "/api/policy/llm") {
      if (request.method !== "POST") {
        return sendJson(response, { error: "지원하지 않는 HTTP 메서드입니다." }, 405);
      }
      if (!hasValidBridgeToken(request)) {
        return sendJson(response, { error: "인증 토큰이 올바르지 않습니다." }, 401);
      }

      const body = await readJsonBody(request);
      const payload = sanitizePayload(body.payload || body);
      const startedAt = Date.now();
      const buildPolicyResult = (nextPayload) => handlePolicyChatRequest(nextPayload, {
        officeLabel: env.DEFAULT_OFFICE_LABEL || "경상북도교육청"
      });
      const baseResult = buildPolicyResult(payload);
      const normalizedResult = await maybeApplyLocalLlmPolicyNormalizer(payload, baseResult, env, buildPolicyResult);
      const finalResult = await maybeAttachLocalLlmPolicyComposer(payload, normalizedResult, env);
      return sendJson(response, {
        ok: true,
        result: finalResult,
        bridge: {
          elapsedMs: Date.now() - startedAt,
          localLlmUsed: Boolean(finalResult.localLlmComposer?.ok || finalResult.localLlmNormalizer?.used)
        }
      });
    }

    return sendJson(response, { error: "지원하지 않는 API 경로입니다." }, 404);
  } catch (error) {
    console.error(error);
    return sendJson(response, { error: "브리지 처리 중 오류가 발생했습니다." }, 500);
  }
}).listen(port, host, () => {
  console.log(`GYO6 local Ollama bridge: http://${host}:${port}`);
});

function loadEnvFile(filePath) {
  const result = {};
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      if (!/^[A-Z0-9_]+$/.test(key)) continue;
      result[key] = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Missing .env.local is fine when values are supplied by the process environment.
  }
  return result;
}

function hasValidBridgeToken(request = {}) {
  const authorization = cleanText(request.headers.authorization || "");
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const headerToken = cleanText(request.headers["x-gyo6-bridge-token"] || "");
  return Boolean(token && (safeEqual(bearerToken, token) || safeEqual(headerToken, token)));
}

function safeEqual(left = "", right = "") {
  const a = cleanText(left);
  const b = cleanText(right);
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) {
      throw new Error("request_body_too_large");
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  if (!text) return {};
  return JSON.parse(text);
}

function sanitizePayload(payload = {}) {
  return {
    question: cleanLongText(payload.question || payload.q || "").slice(0, 800),
    q: cleanLongText(payload.q || "").slice(0, 800),
    originalQuestion: cleanLongText(payload.originalQuestion || "").slice(0, 800),
    officeLabel: cleanText(payload.officeLabel || payload.office || ""),
    office: cleanText(payload.office || ""),
    roleLabel: cleanText(payload.roleLabel || payload.role || ""),
    role: cleanText(payload.role || "")
  };
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(data));
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function cleanLongText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}
