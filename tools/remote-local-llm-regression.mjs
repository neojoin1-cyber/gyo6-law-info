import assert from "node:assert/strict";
import { createServer } from "node:http";
import { maybeApplyRemoteLocalPolicyLlm } from "../functions/shared/remote-local-llm.mjs";

const baseResult = {
  ok: true,
  question: "교사의 병가 신청 서류는?",
  confidence: 0.5,
  semanticFrame: {
    domainCode: "staffAttendanceService",
    domainLabel: "교직원 복무·근태",
    confidence: 0.5
  },
  answerState: {
    status: "needs_slot",
    primaryText: "병가 신청 절차와 증빙자료를 확인합니다."
  },
  policyResponse: {
    title: "병가 신청",
    lead: "병가 신청 절차를 확인합니다.",
    answer: ["병가 신청 절차와 증빙자료를 확인합니다."],
    caution: "원문 기준 확인이 필요합니다."
  },
  missingSlots: ["evidence"]
};

assert.equal(
  await maybeApplyRemoteLocalPolicyLlm({ question: "쌤 병까 서류 뭐 필요?" }, baseResult, {
    REMOTE_LOCAL_LLM_ENABLED: "false"
  }),
  baseResult,
  "disabled remote bridge should leave the base result untouched"
);

const missingConfig = await maybeApplyRemoteLocalPolicyLlm({ question: "쌤 병까 서류 뭐 필요?" }, baseResult, {
  REMOTE_LOCAL_LLM_ENABLED: "true"
});
assert.equal(missingConfig.remoteLocalLlm?.ok, false);
assert.equal(missingConfig.remoteLocalLlm?.reason, "remote_local_llm_base_url_missing");

const token = "test-bridge-token";
const remoteResult = {
  ...baseResult,
  answerState: {
    status: "conditional",
    primaryText: "교사의 병가 신청은 나이스 신청과 증빙자료 확인이 핵심입니다."
  },
  policyResponse: {
    ...baseResult.policyResponse,
    lead: "교사의 병가 신청은 나이스 신청과 증빙자료 확인이 핵심입니다.",
    answer: ["나이스 근무상황 신청과 진단서 등 증빙자료 기준을 함께 확인합니다."]
  },
  localLlmComposer: {
    ok: true,
    provider: "ollama",
    model: "qwen3:4b-instruct"
  }
};

const server = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, `Bearer ${token}`);
  assert.equal(request.url, "/api/policy/llm");
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    ok: true,
    result: remoteResult,
    bridge: {
      elapsedMs: 123,
      localLlmUsed: true
    }
  }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
try {
  const result = await maybeApplyRemoteLocalPolicyLlm({ question: "쌤 병까 서류 뭐 필요?" }, baseResult, {
    REMOTE_LOCAL_LLM_ENABLED: "true",
    REMOTE_LOCAL_LLM_BASE_URL: `http://127.0.0.1:${address.port}`,
    REMOTE_LOCAL_LLM_TOKEN: token,
    REMOTE_LOCAL_LLM_TIMEOUT_MS: "5000"
  });
  assert.equal(result.answerState.status, "conditional");
  assert.equal(result.remoteLocalLlm.ok, true);
  assert.equal(result.remoteLocalLlm.localLlmUsed, true);
  assert.equal(result.remoteLocalLlm.bridgeElapsedMs, 123);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("Remote local LLM bridge regression passed");
