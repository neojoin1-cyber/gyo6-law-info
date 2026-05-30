import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { createApi } from "./shared/api.mjs";

const lawOpenApiOc = defineSecret("LAW_OPEN_API_OC");
const publicDataApiKey = defineSecret("PUBLIC_DATA_API_KEY");
const openAiApiKey = defineSecret("OPENAI_API_KEY");

export const api = onRequest({
  region: "asia-northeast3",
  timeoutSeconds: 30,
  memory: "256MiB",
  secrets: [lawOpenApiOc, publicDataApiKey, openAiApiKey]
}, async (request, response) => {
  const apiClient = createApi(process.env);

  try {
    const requestUrl = buildRequestUrl(request);
    const apiPath = normalizeApiPath(request.path || requestUrl.pathname);

    if (apiPath === "/health") {
      return sendJson(response, apiClient.getHealthStatus());
    }

    if (apiPath === "/search") {
      return sendJson(response, await apiClient.handleSearch(requestUrl));
    }

    if (apiPath === "/analyze") {
      return sendJson(response, await apiClient.handleAnalyze(requestUrl));
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
