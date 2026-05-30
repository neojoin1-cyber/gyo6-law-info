import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./functions/shared/api.mjs";

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
      return sendJson(response, await api.handleSearch(requestUrl));
    }

    if (requestUrl.pathname === "/api/analyze") {
      return sendJson(response, await api.handleAnalyze(requestUrl));
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

function sendText(response, text, status = 200) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}
