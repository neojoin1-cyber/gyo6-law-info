import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { createApi } from "./shared/api.mjs";
import { handlePolicyChatRequest } from "./shared/policy-chat.mjs";
import { maybeApplyRemoteLocalPolicyLlm } from "./shared/remote-local-llm.mjs";

const lawOpenApiOc = defineSecret("LAW_OPEN_API_OC");
const publicDataApiKey = defineSecret("PUBLIC_DATA_API_KEY");
const nanetApiKey = defineSecret("NANET_API_KEY");
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const remoteLocalLlmToken = defineSecret("REMOTE_LOCAL_LLM_TOKEN");

export const api = onRequest({
  region: "asia-northeast3",
  timeoutSeconds: 30,
  memory: "256MiB",
  secrets: [lawOpenApiOc, publicDataApiKey, nanetApiKey, openAiApiKey, remoteLocalLlmToken]
}, async (request, response) => {
  const apiClient = createApi(process.env);

  try {
    const requestUrl = buildRequestUrl(request);
    const apiPath = normalizeApiPath(request.path || requestUrl.pathname);

    if (apiPath === "/health") {
      return sendJson(response, apiClient.getHealthStatus());
    }

    if (apiPath === "/search") {
      if (!isLegacySearchEnabled()) {
        return sendJson(response, {
          error: "레거시 공식자료 검색 API는 비활성화되어 있습니다. 법률정보 회원 권한을 확인하는 Worker API를 사용해 주세요.",
          code: "LEGACY_SEARCH_DISABLED",
          status: 410
        }, 410);
      }
      return sendJson(response, await apiClient.handleSearch(requestUrl));
    }

    if (apiPath === "/analyze") {
      const result = await apiClient.handleAnalyze(requestUrl);
      return sendJson(response, result, getResultStatus(result));
    }

    if (apiPath === "/policy") {
      if (request.method !== "GET" && request.method !== "POST") {
        return sendJson(response, { error: "지원하지 않는 HTTP 메서드입니다." }, 405);
      }

      const payload = request.method === "POST"
        ? readPolicyPayload(request)
        : Object.fromEntries(requestUrl.searchParams.entries());
      const result = handlePolicyChatRequest(payload, {
        officeLabel: process.env.DEFAULT_OFFICE_LABEL || "경상북도교육청"
      });
      const enrichedResult = await maybeApplyRemoteLocalPolicyLlm(payload, result, process.env);
      return sendJson(response, enrichedResult, getResultStatus(enrichedResult));
    }

    return sendJson(response, { error: "지원하지 않는 API 경로입니다." }, 404);
  } catch (error) {
    console.error(error);
    return sendJson(response, { error: "서버 처리 중 오류가 발생했습니다." }, 500);
  }
});

function buildRequestUrl(request) {
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers.host || "gyo6-law-info.web.app";
  return new URL(request.originalUrl || request.url || "/", `${protocol}://${host}`);
}

function normalizeApiPath(pathname) {
  const path = String(pathname || "/");
  if (path === "/api") {
    return "/";
  }
  if (path.startsWith("/api/")) {
    return path.slice(4);
  }
  return path;
}

function sendJson(response, data, status = 200) {
  response.status(status).set({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }).send(JSON.stringify(data));
}

function getResultStatus(data) {
  const status = Number(data?.status || 200);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 200;
}

function readPolicyPayload(request = {}) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  if (typeof request.body === "string") {
    return parseJsonObject(request.body);
  }
  if (Buffer.isBuffer(request.body)) {
    return parseJsonObject(request.body.toString("utf-8"));
  }
  if (Buffer.isBuffer(request.rawBody)) {
    return parseJsonObject(request.rawBody.toString("utf-8"));
  }
  return {};
}

function parseJsonObject(value = "") {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isLegacySearchEnabled() {
  return /^true$/i.test(String(process.env.LEGACY_SEARCH_ENABLED || "").trim());
}
