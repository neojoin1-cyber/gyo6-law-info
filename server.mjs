import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./functions/shared/api.mjs";
import { buildKakaoSkillResponse, handlePolicyChatRequest } from "./functions/shared/policy-chat.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, "public");
const env = {
  ...process.env,
  ...loadEnvFile(path.join(rootDir, ".env.local"))
};
const port = Number(env.PORT || 5173);
const api = createApi(env);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/health") {
      return sendJson(response, api.getHealthStatus());
    }

    if (requestUrl.pathname === "/api/search") {
      if (!isLegacySearchEnabled(env)) {
        return sendJson(response, {
          error: "레거시 공식자료 검색 API는 비활성화되어 있습니다. 법률정보 회원 권한을 확인하는 Worker API를 사용해 주세요.",
          code: "LEGACY_SEARCH_DISABLED",
          status: 410
        }, 410);
      }
      return sendJson(response, await api.handleSearch(requestUrl));
    }

    if (requestUrl.pathname === "/api/analyze") {
      const result = await api.handleAnalyze(requestUrl);
      return sendJson(response, result, getResultStatus(result));
    }

    if (requestUrl.pathname === "/api/policy") {
      const payload = request.method === "POST"
        ? await readJsonBody(request)
        : Object.fromEntries(requestUrl.searchParams.entries());
      return sendJson(response, handlePolicyChatRequest(payload, {
        officeLabel: env.DEFAULT_OFFICE_LABEL || "경상북도교육청"
      }));
    }

    if (requestUrl.pathname === "/api/kakao/skill") {
      if (request.method !== "POST") {
        return sendJson(response, { error: "지원하지 않는 HTTP 메서드입니다." }, 405);
      }

      return sendJson(response, buildKakaoSkillResponse(await readJsonBody(request), {
        detailUrl: env.PUBLIC_SITE_URL || "https://gyo6-law-info.web.app/"
      }));
    }

    return serveStatic(requestUrl, response);
  } catch (error) {
    console.error(error);
    return sendJson(response, { error: "서버 처리 중 오류가 발생했습니다." }, 500);
  }
}).listen(port, () => {
  console.log(`GYO6 Law Info dev server: http://localhost:${port}`);
});

function loadEnvFile(filePath) {
  const result = {};

  try {
    const content = readFileSync(filePath, "utf-8");

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separator = line.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = line.slice(0, separator).trim();
      if (!/^[A-Z0-9_]+$/.test(key)) {
        continue;
      }

      result[key] = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // The server can still run and show clear missing-key messages.
  }

  return result;
}

async function serveStatic(requestUrl, response) {
  const requestedPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
  const filePath = path.normalize(path.join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir)) {
    return sendText(response, "Forbidden", 403);
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return sendText(response, "Not found", 404);
    }

    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  } catch {
    response.writeHead(302, { location: "/" });
    response.end();
  }
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(data));
}

function getResultStatus(data) {
  const status = Number(data?.status || 200);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 200;
}

function isLegacySearchEnabled(environment = {}) {
  return /^true$/i.test(String(environment.LEGACY_SEARCH_ENABLED || "").trim());
}

function sendText(response, text, status = 200) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf-8").trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
