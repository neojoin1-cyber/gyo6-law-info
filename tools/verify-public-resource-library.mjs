import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const targetUrl = process.env.RESOURCE_VERIFY_URL || "http://127.0.0.1:5173/#law-info";
const debugPort = Number(process.env.RESOURCE_VERIFY_DEBUG_PORT || 9231);

const userDataDir = await mkdtemp(path.join(tmpdir(), "gyo6-resource-chrome-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank"
], {
  stdio: "ignore",
  windowsHide: true
});

let socket = null;

try {
  const wsUrl = await waitForWebSocketUrl();
  socket = await connectWebSocket(wsUrl);
  const send = createCdpSender(socket);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: targetUrl });
  await waitForPageReady(send);

  const allState = await evaluateJson(send, `(() => {
    return {
      title: document.querySelector("#public-resource-title")?.textContent?.trim() || "",
      hasTypeSelect: Boolean(document.querySelector("#resourceTypeSelect")),
      hasLevel1Select: Boolean(document.querySelector("#resourceLevel1Select")),
      hasLevel2Select: Boolean(document.querySelector("#resourceLevel2Select")),
      hasLevel3Select: Boolean(document.querySelector("#resourceLevel3Select")),
      hasSearchButton: Boolean(document.querySelector("#resourceSearchButton")),
      hasResetButton: Boolean(document.querySelector("#resourceResetButton")),
      hasLibraryEntry: Boolean(document.querySelector(".library-entry")),
      hasQuickPaths: document.querySelectorAll("[data-resource-preset]").length,
      libraryBeforeCounsel: (() => {
        const library = document.querySelector("#publicResourceLibrary");
        const counsel = document.querySelector("#counselRoom");
        return Boolean(library && counsel && (library.compareDocumentPosition(counsel) & Node.DOCUMENT_POSITION_FOLLOWING));
      })(),
      typeOptions: [...document.querySelectorAll("#resourceTypeSelect option")].map((option) => option.value),
      level1Options: [...document.querySelectorAll("#resourceLevel1Select option")].map((option) => option.value),
      summary: document.querySelector("#resourceSummary")?.textContent?.trim() || "",
      totalRows: document.querySelectorAll(".resource-row").length
    };
  })()`);

  const fieldTrainingState = await evaluateJson(send, `(() => {
    const setSelect = (selector, value) => {
      const select = document.querySelector(selector);
      if (!select) return false;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return select.value === value;
    };
    setSelect("#resourceTypeSelect", "law");
    setSelect("#resourceLevel1Select", "fieldTraining");
    const inputs = [...document.querySelectorAll("[data-resource-keyword]")];
    inputs.forEach((input) => { input.value = ""; });
    inputs[0].value = "직업교육훈련";
    inputs[1].value = "촉진법";
    document.querySelector("#resourceSearchButton")?.click();
    return {
      summary: document.querySelector("#resourceSummary")?.textContent?.trim() || "",
      rows: [...document.querySelectorAll(".resource-row")].slice(0, 8).map((row) => row.textContent.trim()),
      preview: document.querySelector("#resourcePreview")?.textContent?.trim() || "",
      hrefs: [...document.querySelectorAll("[data-resource-open], .resource-preview-actions a")].map((anchor) => anchor.href)
    };
  })()`);

  const violenceState = await evaluateJson(send, `(() => {
    const setSelect = (selector, value) => {
      const select = document.querySelector(selector);
      if (!select) return false;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return select.value === value;
    };
    setSelect("#resourceTypeSelect", "law");
    setSelect("#resourceLevel1Select", "schoolViolenceSafety");
    const inputs = [...document.querySelectorAll("[data-resource-keyword]")];
    inputs.forEach((input) => { input.value = ""; });
    inputs[0].value = "학교폭력예방";
    document.querySelector("#resourceSearchButton")?.click();
    return {
      summary: document.querySelector("#resourceSummary")?.textContent?.trim() || "",
      rows: [...document.querySelectorAll(".resource-row")].slice(0, 8).map((row) => row.textContent.trim()),
      hrefs: [...document.querySelectorAll("[data-resource-open], .resource-preview-actions a")].map((anchor) => anchor.href)
    };
  })()`);

  const adminRuleState = await evaluateJson(send, `(() => {
    const setSelect = (selector, value) => {
      const select = document.querySelector(selector);
      if (!select) return false;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return select.value === value;
    };
    setSelect("#resourceTypeSelect", "rule");
    setSelect("#resourceLevel1Select", "staffLabor");
    const inputs = [...document.querySelectorAll("[data-resource-keyword]")];
    inputs.forEach((input) => { input.value = ""; });
    inputs[0].value = "교원휴가";
    inputs[1].value = "예규";
    document.querySelector("#resourceSearchButton")?.click();
    return {
      summary: document.querySelector("#resourceSummary")?.textContent?.trim() || "",
      rows: [...document.querySelectorAll(".resource-row")].slice(0, 8).map((row) => row.textContent.trim()),
      preview: document.querySelector("#resourcePreview")?.textContent?.trim() || "",
      hrefs: [...document.querySelectorAll("[data-resource-open], .resource-preview-actions a")].map((anchor) => anchor.href)
    };
  })()`);

  assert(allState.title.includes("자료실"), "자료실 제목을 찾지 못했습니다.");
  assert(allState.hasLibraryEntry && allState.hasQuickPaths >= 6, "자료실 우선 진입 UI가 없습니다.");
  assert(allState.libraryBeforeCounsel, "자료실이 상담실보다 위에 배치되어야 합니다.");
  assert(allState.hasTypeSelect && allState.hasLevel1Select && allState.hasLevel2Select && allState.hasLevel3Select, "4단계 분류 선택 상자가 없습니다.");
  assert(allState.hasSearchButton && allState.hasResetButton, "자료 검색/초기화 버튼이 없습니다.");
  assert(allState.typeOptions.includes("form"), "서식 유형 필터가 없습니다.");
  assert(allState.level1Options.includes("fieldTraining"), "현장실습·직업교육 분류가 없습니다.");
  assert(allState.level1Options.includes("schoolViolenceSafety"), "학교폭력·안전 분류가 없습니다.");
  assert(allState.totalRows > 0, "초기 자료 목록이 비어 있습니다.");

  assert(fieldTrainingState.summary.includes("직업교육훈련") && fieldTrainingState.summary.includes("촉진법"), "법령 단어 검색 요약이 표시되지 않았습니다.");
  assert(fieldTrainingState.rows.length > 0, "직업교육훈련 촉진법 검색 결과가 없습니다.");
  assert(fieldTrainingState.hrefs.some((href) => /law\.go\.kr/.test(href) && !/google\.com\/search/.test(href)), "직접 법령 링크가 없습니다.");

  assert(violenceState.summary.includes("학교폭력예방"), "학교폭력 법령 검색 요약이 표시되지 않았습니다.");
  assert(violenceState.rows.length > 0, "학교폭력예방 법령 검색 결과가 없습니다.");
  assert(adminRuleState.summary.includes("교원휴가") && adminRuleState.summary.includes("예규"), "교원휴가 예규 검색 요약이 표시되지 않았습니다.");
  assert(adminRuleState.rows.length > 0, "교원휴가 예규 검색 결과가 없습니다.");
  assert(adminRuleState.hrefs.some((href) => {
    const decoded = decodeURIComponent(href);
    return /law\.go\.kr/.test(decoded)
      && (/\/행정규칙\/교원휴가에관한예규/.test(decoded) || /admRul/i.test(decoded))
      && !/\/법령\//.test(decoded);
  }), "교원휴가 예규가 행정규칙 원문으로 연결되지 않습니다.");
  assert([...fieldTrainingState.hrefs, ...violenceState.hrefs, ...adminRuleState.hrefs].every((href) => !/google\.com\/search/.test(href)), "구글 검색 대행 링크가 노출되었습니다.");

  console.log(JSON.stringify({
    ok: true,
    typeOptions: allState.typeOptions.length,
    level1Options: allState.level1Options.length,
    initialRows: allState.totalRows,
    fieldTrainingSummary: fieldTrainingState.summary,
    schoolViolenceSummary: violenceState.summary,
    adminRuleSummary: adminRuleState.summary,
    directLinkOnly: true
  }, null, 2));
} finally {
  socket?.close?.();
  await stopChrome(chrome);
  try {
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // Chrome can hold the profile lock for a moment after exit; it is safe to leave a temp profile behind.
  }
}

async function waitForWebSocketUrl() {
  const listEndpoint = `http://127.0.0.1:${debugPort}/json/list`;
  const versionEndpoint = `http://127.0.0.1:${debugPort}/json/version`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    try {
      const listResponse = await fetch(listEndpoint);
      if (listResponse.ok) {
        const targets = await listResponse.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page?.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }

      const versionResponse = await fetch(versionEndpoint);
      if (versionResponse.ok) {
        const version = await versionResponse.json();
        if (version.webSocketDebuggerUrl) {
          return version.webSocketDebuggerUrl;
        }
      }
    } catch {
      // Chrome is still starting.
    }
    await delay(150);
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws), { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
}

function createCdpSender(ws) {
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message || "CDP command failed"));
    } else {
      resolve(message.result || {});
    }
  });

  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function waitForPageReady(send) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    const state = await evaluateJson(send, `(() => ({
      ready: document.readyState,
      hasResourceLibrary: Boolean(document.querySelector("#resourceSearch")),
      summary: document.querySelector("#resourceSummary")?.textContent || ""
    }))()`);
    if (state.ready === "complete" && state.hasResourceLibrary && !state.summary.includes("불러오는 중")) {
      return;
    }
    await delay(200);
  }
  throw new Error("Resource library did not finish rendering.");
}

async function evaluateJson(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Evaluation failed");
  }
  return result.result?.value;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopChrome(child) {
  if (!child || child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}
