import { spawn, execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = {
  ...process.env,
  ...await loadEnvFile(path.join(rootDir, ".env.local"))
};

const command = cleanText(process.argv[2] || "status").toLowerCase();
const bridgePort = Number(env.LOCAL_LLM_BRIDGE_PORT || 8789);
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
const ollamaBaseUrl = cleanUrl(env.LOCAL_LLM_BASE_URL || env.OLLAMA_BASE_URL || "http://127.0.0.1:11434");
const model = cleanText(env.LOCAL_LLM_MODEL || env.OLLAMA_MODEL || "qwen3:4b-instruct");
const remoteBridgeUrl = cleanUrl(env.REMOTE_LOCAL_LLM_BASE_URL || "https://ollama-bridge.gyo6.kr");
const tunnelName = cleanText(env.LOCAL_LLM_TUNNEL_NAME || "gyo6-ollama-bridge");
const cloudflaredPath = resolveCloudflaredPath(env.CLOUDFLARED_PATH);

let exitCode = 0;

if (command === "start") {
  const result = await startStack();
  printJson(result);
  exitCode = result.ready ? 0 : 1;
} else if (command === "verify") {
  const result = await verifyStack();
  printJson(result);
  exitCode = result.ready && result.externalPolicy?.remoteLocalLlm?.ok ? 0 : 1;
} else if (command === "install-startup") {
  const result = await installStartupTask();
  printJson(result);
  exitCode = result.ok ? 0 : 1;
} else if (command === "status" || !command) {
  printJson(await getStackStatus({ includeExternalPolicy: false }));
} else {
  printJson({ ok: false, error: `unknown_command:${command}` });
  exitCode = 1;
}

process.exitCode = exitCode;

async function startStack() {
  const actions = [];

  let status = await getStackStatus({ includeExternalPolicy: false });

  if (!status.ollama.ok) {
    const started = startDetached("ollama", resolveCommand("ollama"), ["serve"]);
    actions.push({ service: "ollama", ...started });
    await sleep(3000);
    status = await getStackStatus({ includeExternalPolicy: false });
  }

  if (!status.localBridge.ok) {
    const started = startDetached("gyo6-local-ollama-bridge", process.execPath, [path.join(rootDir, "tools", "local-ollama-bridge.mjs")]);
    actions.push({ service: "localBridge", ...started });
    await waitFor(() => probeJson(`${bridgeUrl}/health`, 5000).then((item) => item.ok), 12000);
    status = await getStackStatus({ includeExternalPolicy: false });
  }

  if (!status.remoteBridge.ok) {
    const args = ["tunnel", "--url", bridgeUrl, "run", tunnelName];
    const started = startDetached("gyo6-ollama-tunnel", cloudflaredPath, args);
    actions.push({ service: "remoteTunnel", ...started });
    await waitFor(() => probeJson(`${remoteBridgeUrl}/health`, 8000).then((item) => item.ok), 18000);
    status = await getStackStatus({ includeExternalPolicy: false });
  }

  const warmup = status.ollama.ok ? await warmOllamaModel() : { ok: false, skipped: true, reason: "ollama_unavailable" };
  const finalStatus = await getStackStatus({ includeExternalPolicy: false });

  return {
    ok: true,
    ready: Boolean(finalStatus.ollama.ok && finalStatus.localBridge.ok && finalStatus.remoteBridge.ok),
    actions,
    warmup,
    status: finalStatus
  };
}

async function verifyStack() {
  const started = await startStack();
  const status = await getStackStatus({ includeExternalPolicy: true });
  return {
    ok: true,
    ready: Boolean(status.ollama.ok && status.localBridge.ok && status.remoteBridge.ok && status.externalPolicy?.remoteLocalLlm?.ok),
    start: started,
    ...status
  };
}

async function getStackStatus({ includeExternalPolicy = false } = {}) {
  const [ollama, localBridge, remoteBridge] = await Promise.all([
    getOllamaStatus(),
    probeJson(`${bridgeUrl}/health`, 5000),
    probeJson(`${remoteBridgeUrl}/health`, 10000)
  ]);

  const result = {
    checkedAt: new Date().toISOString(),
    ready: Boolean(ollama.ok && localBridge.ok && remoteBridge.ok),
    model,
    ollama,
    localBridge,
    remoteBridge
  };

  if (includeExternalPolicy) {
    result.externalPolicy = await verifyExternalPolicy();
    result.ready = Boolean(result.ready && result.externalPolicy.remoteLocalLlm?.ok);
  }

  return result;
}

async function getOllamaStatus() {
  const tags = await probeJson(`${ollamaBaseUrl}/api/tags`, 5000);
  const models = Array.isArray(tags.body?.models) ? tags.body.models : [];
  return {
    ok: Boolean(tags.ok),
    status: tags.status || 0,
    elapsedMs: tags.elapsedMs,
    error: tags.error || "",
    selectedModelAvailable: models.some((item) => item.name === model || item.model === model),
    models: models.map((item) => ({
      name: cleanText(item.name || item.model || ""),
      parameterSize: cleanText(item.details?.parameter_size || ""),
      quantization: cleanText(item.details?.quantization_level || "")
    })).filter((item) => item.name)
  };
}

async function warmOllamaModel() {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: "안녕. 한국어로 짧게 한 문장만 대답해줘.",
        stream: false,
        keep_alive: "30m",
        options: {
          temperature: 0.1,
          num_ctx: 2048,
          num_predict: 40
        }
      }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json().catch(async () => ({ raw: await response.text() }));
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      response: cleanLongText(data.response || data.message?.content || "").slice(0, 120)
    };
  } catch (error) {
    return {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: cleanText(error?.message || error)
    };
  }
}

async function verifyExternalPolicy() {
  const startedAt = Date.now();
  try {
    const response = await fetch("https://gyo6-law-info.web.app/api/policy", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        question: "교원의 부모 사망시 경조사휴가는 며칠이고 공휴일은 어떻게 계산하나요?",
        officeLabel: "경상북도교육청",
        roleLabel: "교원"
      }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await response.json().catch(async () => ({ raw: await response.text() }));
    return {
      ok: response.ok && Boolean(data.ok),
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      domain: cleanText(data.semanticFrame?.domainCode || ""),
      quality: cleanText(data.policyResponse?.qualityGate?.status || ""),
      remoteLocalLlm: {
        ok: Boolean(data.remoteLocalLlm?.ok),
        skipped: Boolean(data.remoteLocalLlm?.skipped),
        provider: cleanText(data.remoteLocalLlm?.provider || ""),
        reason: cleanText(data.remoteLocalLlm?.reason || ""),
        elapsedMs: Number(data.remoteLocalLlm?.elapsedMs || 0),
        localLlmUsed: Boolean(data.remoteLocalLlm?.localLlmUsed)
      },
      primary: cleanLongText(data.answerState?.primaryText || "").slice(0, 220)
    };
  } catch (error) {
    return {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: cleanText(error?.message || error)
    };
  }
}

async function installStartupTask() {
  const taskName = "GYO6-Ollama-Stack";
  const taskRun = `C:\\Windows\\System32\\cmd.exe /d /c ""${path.join(rootDir, "tools", "start-ollama-stack.cmd")}""`;
  const result = await runCommand("schtasks.exe", [
    "/Create",
    "/TN",
    taskName,
    "/SC",
    "ONLOGON",
    "/TR",
    taskRun,
    "/F"
  ], 20000);

  if (result.code !== 0) {
    const fallback = await installStartupFolderFallback();
    return {
      ok: fallback.ok,
      taskName,
      taskRun,
      scheduler: {
        ok: false,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error
      },
      fallback
    };
  }

  return {
    ok: result.code === 0,
    taskName,
    taskRun,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error
  };
}

async function installStartupFolderFallback() {
  const startupDir = getStartupFolder();
  if (!startupDir) {
    return { ok: false, error: "startup_folder_not_found" };
  }

  try {
    mkdirSync(startupDir, { recursive: true });
    const launcherPath = path.join(startupDir, "GYO6-Ollama-Stack.cmd");
    await writeFile(launcherPath, [
      "@echo off",
      `call "${path.join(rootDir, "tools", "start-ollama-stack.cmd")}"`,
      ""
    ].join("\r\n"), "utf-8");
    return { ok: true, method: "startup-folder", launcherPath };
  } catch (error) {
    return { ok: false, method: "startup-folder", error: cleanText(error?.message || error) };
  }
}

async function probeJson(url, timeoutMs = 5000) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      body: parseJson(text)
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - startedAt,
      error: cleanText(error?.message || error)
    };
  }
}

function startDetached(label, commandPath, args = []) {
  try {
    const child = spawn(commandPath, args, {
      cwd: rootDir,
      detached: true,
      windowsHide: true,
      stdio: "ignore"
    });
    child.unref();
    return { ok: true, label, pid: child.pid };
  } catch (error) {
    return { ok: false, label, error: cleanText(error?.message || error) };
  }
}

async function waitFor(check, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await sleep(750);
  }
  return false;
}

async function runCommand(commandPath, args = [], timeoutMs = 10000) {
  return new Promise((resolve) => {
    execFile(commandPath, args, {
      cwd: rootDir,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => {
      resolve({
        code: Number(error?.code || 0),
        error: cleanText(error?.message || ""),
        stdout: cleanLongText(stdout || "").slice(0, 2000),
        stderr: cleanLongText(stderr || "").slice(0, 2000)
      });
    });
  });
}

async function loadEnvFile(filePath) {
  const result = {};
  try {
    const content = await readFile(filePath, "utf-8");
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
    // The stack can still run when values are supplied by the process environment.
  }
  return result;
}

function resolveCloudflaredPath(value = "") {
  const explicit = cleanText(value);
  if (explicit) return explicit;
  const defaultPath = "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
  return existsSync(defaultPath) ? defaultPath : "cloudflared";
}

function getStartupFolder() {
  const appData = cleanText(process.env.APPDATA || "");
  if (!appData) return "";
  return path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}

function resolveCommand(value = "") {
  return cleanText(value || "");
}

function cleanUrl(value = "") {
  return String(value || "").trim().replace(/\/+$/, "");
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanLongText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseJson(text = "") {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { raw: String(text || "").slice(0, 500) };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
