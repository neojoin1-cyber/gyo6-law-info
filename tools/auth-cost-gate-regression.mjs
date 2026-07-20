import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApi } from "../functions/shared/api.mjs";
import worker from "../workers/ai-analysis/src/index.js";

const legacyApi = createApi({
  OPENAI_API_KEY: "test-key"
});
const functionsSource = await readFile(new URL("../functions/index.mjs", import.meta.url), "utf-8");
const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf-8");
const authSource = await readFile(new URL("../public/auth.js", import.meta.url), "utf-8");
const wranglerSource = await readFile(new URL("../workers/ai-analysis/wrangler.toml", import.meta.url), "utf-8");
const firebaseConfigSource = await readFile(new URL("../firebase.json", import.meta.url), "utf-8");
const firebaseConfig = JSON.parse(firebaseConfigSource);

const legacyAnalyzeResult = await legacyApi.handleAnalyze(
  new URL("https://example.test/api/analyze?q=%EA%B8%B0%EA%B0%84%EC%A0%9C%EA%B5%90%EC%82%AC%20%EB%B3%91%EA%B0%80")
);
assert.equal(legacyAnalyzeResult.code, "LEGACY_ANALYZE_DISABLED");
assert.equal(legacyAnalyzeResult.status, 410);

const baseEnv = {
  AUTH_REQUIRED: "true",
  FIREBASE_PROJECT_ID: "gyo6-law-info",
  FIREBASE_TRUSTED_PROJECT_IDS: "gyo6-law-info,gyo6--ebook",
  OPENAI_API_KEY: "test-key"
};

const analyzeResponse = await worker.fetch(
  new Request("https://gyo6-law-info-ai.test/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "기간제교사의 병가는?" })
  }),
  baseEnv
);
assert.equal(analyzeResponse.status, 401);
assert.equal((await analyzeResponse.json()).code, "AUTH_REQUIRED");

const policyResponse = await worker.fetch(
  new Request("https://gyo6-law-info-ai.test/api/policy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "남 교사의 출산휴가는 며칠인가요?" })
  }),
  baseEnv
);
assert.equal(policyResponse.status, 401);
assert.equal((await policyResponse.json()).code, "AUTH_REQUIRED");

const searchResponse = await worker.fetch(
  new Request("https://gyo6-law-info-ai.test/api/search?q=%ED%95%99%ED%8F%AD%20%EC%82%AC%EC%95%88%EC%B2%98%EB%A6%AC"),
  baseEnv
);
assert.equal(searchResponse.status, 401);
assert.equal((await searchResponse.json()).code, "AUTH_REQUIRED");

const policyEngineFirstAnalyzeResponse = await worker.fetch(
  new Request("https://gyo6-law-info-ai.test/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      caseId: "policy-engine-first-annual-leave",
      question: "3년차 정교사의 연가 일수는?"
    })
  }),
  {
    AUTH_REQUIRED: "false",
    DEFAULT_OFFICE_LABEL: "경상북도교육청"
  }
);
assert.equal(policyEngineFirstAnalyzeResponse.status, 200);
const policyEngineFirstAnalyze = await policyEngineFirstAnalyzeResponse.json();
assert.equal(policyEngineFirstAnalyze.ok, true);
assert.equal(policyEngineFirstAnalyze.engine, "policy-engine-first");
assert.equal(policyEngineFirstAnalyze.model, "policy-engine");
assert.equal(policyEngineFirstAnalyze.policyEngineFirst?.used, true);
assert.equal(policyEngineFirstAnalyze.policyEngineFirst?.skippedOpenAi, true);
assert.equal(policyEngineFirstAnalyze.billing?.free, true);
assert.equal(policyEngineFirstAnalyze.billing?.estimatedKrw, 0);
assert.equal(policyEngineFirstAnalyze.usage?.totalTokens, 0);
assert.match(policyEngineFirstAnalyze.analysis?.coreFinding || "", /3년 이상 4년 미만 16일|16일/);
assert.doesNotMatch(policyEngineFirstAnalyze.analysis?.coreFinding || "", /근로기준법 기준/);

const workerSource = await readFile(new URL("../workers/ai-analysis/src/index.js", import.meta.url), "utf-8");
assert.match(workerSource, /const LAW_ACCESS_ROLES = new Set\(\["admin", "owner"\]\)/);
assert.doesNotMatch(workerSource, /const LAW_ACCESS_ROLES = new Set\(\["law", "teacher", "admin", "owner"\]\)/);
assert.match(workerSource, /canUseLawInfo: approved && LAW_ACCESS_ROLES\.has\(member\.role\)/);
assert.match(workerSource, /관리자에 의해 법률정보 권한을 승인받아야 합니다/);
assert.match(workerSource, /url\.pathname === "\/api\/search"/);
assert.match(workerSource, /const access = await assertLawAccess\(authContext, env\)/);
assert.match(workerSource, /maybeAttachGptAnswerComposer\(payload, finalResult, env, "policy_answer"\)/);
assert.match(workerSource, /maybeAttachGptAnswerComposer\(workingPayload, finalResult, env, "kakao_answer"\)/);
assert.match(workerSource, /POLICY_GPT_ANSWER_ENABLED/);
assert.match(workerSource, /KAKAO_GPT_ANSWER_ENABLED/);
assert.match(workerSource, /getOpenAiUsageGate\(env, feature\)/);
assert.match(workerSource, /buildPolicyEngineFirstAnalyzeResult/);
assert.match(workerSource, /policy-engine-first/);
assert.match(workerSource, /url\.pathname === "\/api\/admin\/member\/kakao-approve"/);
assert.match(workerSource, /approveKakaoMemberByAdmin/);
assert.match(workerSource, /parseEmailList\(env\.ADDITIONAL_OWNER_EMAILS\)/);

assert.match(wranglerSource, /KAKAO_GPT_ANSWER_ENABLED = "false"/);
assert.match(wranglerSource, /KAKAO_GPT_ANSWER_MODE = "off"/);
assert.match(wranglerSource, /KAKAO_GPT_NORMALIZER_ENABLED = "false"/);
assert.match(wranglerSource, /KAKAO_GPT_NORMALIZER_MODE = "off"/);
assert.match(wranglerSource, /POLICY_GPT_NORMALIZER_ENABLED = "false"/);
assert.match(wranglerSource, /POLICY_GPT_NORMALIZER_MODE = "off"/);
assert.match(wranglerSource, /POLICY_GPT_ANSWER_ENABLED = "false"/);
assert.match(wranglerSource, /POLICY_GPT_ANSWER_MODE = "off"/);
assert.match(wranglerSource, /ADDITIONAL_OWNER_EMAILS = "admin@gyo6\.kr"/);

const sharedApiSource = await readFile(new URL("../functions/shared/api.mjs", import.meta.url), "utf-8");
assert.match(sharedApiSource, /LEGACY_ANALYZE_DISABLED/);
assert.match(sharedApiSource, /LEGACY_ANALYZE_ENABLED/);

assert.match(functionsSource, /getResultStatus\(result\)/);
assert.match(functionsSource, /LEGACY_SEARCH_DISABLED/);
assert.match(functionsSource, /LEGACY_SEARCH_ENABLED/);

const hostingRewrites = firebaseConfig.hosting?.rewrites || [];
assert.deepEqual(hostingRewrites[0], {
  source: "/api/**",
  function: {
    functionId: "api",
    region: "asia-northeast3"
  }
});
assert.deepEqual(hostingRewrites.at(-1), {
  source: "**",
  destination: "/index.html"
});

const renderResultStart = appSource.indexOf("async function renderResult");
const accessGuardIndex = appSource.indexOf("const access = await getLawInfoAccess();", renderResultStart);
const freeRenderIndex = appSource.indexOf("renderFreeBasicPolicyResult({", renderResultStart);
const postFreeWindow = appSource.slice(freeRenderIndex, freeRenderIndex + 240);
assert.ok(freeRenderIndex > renderResultStart);
assert.ok(accessGuardIndex > renderResultStart && accessGuardIndex < freeRenderIndex);
assert.doesNotMatch(postFreeWindow, /return;/);
assert.match(appSource, /statusDot\.textContent = "기본 답변"/);
assert.match(appSource, /renderLawInfoAccessBlockedResult\(access\.message\)/);
assert.doesNotMatch(appSource, /외부 AI API 호출 없이 무료 규정 엔진으로 답변했습니다/);
assert.doesNotMatch(appSource, /무료 규정 엔진으로 먼저 답변합니다/);

assert.match(authSource, /data-auth-action="kakao-approve"/);
assert.match(authSource, /\/api\/admin\/member\/kakao-approve/);
assert.match(authSource, /카카오 챗봇 식별번호 승인/);

console.log("Auth cost gate regression passed");
