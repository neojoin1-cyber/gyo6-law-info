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
    lead: "교원의 병가 서류는 병가 사용일수와 사유를 기준으로 확인합니다.",
    answer: [
      "연간 병가가 6일을 초과하면 의사·치과의사·한의사가 발급한 진단서를 제출해야 합니다.",
      "일반 질병·부상은 연 60일, 공무상 질병·부상은 연 180일까지 병가를 승인할 수 있습니다."
    ],
    caution: "원문 기준 확인이 필요합니다."
  },
  missingSlots: ["evidence"],
  sourceExpansion: {
    required: true,
    status: "queued",
    trigger: "source_or_slot_gap_detected",
    missingSlots: ["evidence"],
    acquisitionTargets: [
      { tier: "educationOfficeGuideline", label: "경상북도교육청 지침 원문", query: "경상북도교육청 병가 증빙 지침 원문" },
      { tier: "schoolRule", label: "학교 내부 복무 규정", query: "학교 내부 복무 규정 병가 증빙" }
    ],
    riskReview: {
      required: true,
      items: [
        { code: "records", label: "기록·증빙 보존", status: "detected" }
      ]
    }
  },
  riskReview: {
    required: true,
    items: [
      { code: "records", label: "기록·증빙 보존", status: "detected" }
    ]
  }
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
  sourceExpansion: null,
  riskReview: null,
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
  assert.match(result.policyResponse.lead, /의사·치과의사·한의사/);
  assert.match(result.responseText, /의사·치과의사·한의사/);
  assert.match(result.responseText, /60일|180일/);
  assert.equal(result.sourceExpansion?.status, "queued");
  assert.equal(result.policyResponse?.sourceExpansion?.status, "queued");
  assert.equal(result.answerState?.sourceExpansion?.status, "queued");
  assert.equal(result.riskReview?.items?.[0]?.code, "records");
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const overtimeBaseResult = {
  ok: true,
  question: "교사가 경주에서 대전으로 1박2일 학생 인솔 출장시 시간외근무 신청을 할 수 있나요?",
  semanticFrame: {
    domainCode: "staffAttendanceService",
    domainLabel: "교직원 복무·근태",
    slots: {
      travelerRole: { subjectLabel: "교원" },
      serviceIssue: { code: "overtime", label: "초과근무" }
    }
  },
  answerState: {
    status: "conditional",
    primaryText: "출장 중 시간외근무는 근무명령·사전승인·실제 근무시간 증빙으로 판단합니다."
  },
  policyResponse: {
    title: "출장 중 시간외근무",
    lead: "교원의 시간외근무는 출장 여부보다 실제 근무명령·사전승인·근무시간 증빙을 기준으로 판단합니다.",
    answer: [
      "인솔 출장이 1박 2일이라도 시간외근무가 자동 인정되는 것은 아니고, 정규 근무시간 외 실제 학생 인솔·생활지도·안전관리 업무가 있었는지 확인합니다."
    ],
    steps: ["출장명령과 별도로 초과근무명령 또는 사전승인이 있었는지 확인"],
    caution: "시간외근무는 출장여비와 별개입니다."
  },
  missingSlots: []
};

const staleTravelRemoteResult = {
  ...overtimeBaseResult,
  semanticFrame: {
    domainCode: "domesticTravelExpense",
    domainLabel: "국내 출장 여비",
    slots: {
      travelerRole: { subjectLabel: "교원" }
    }
  },
  answerState: {
    status: "definitive",
    primaryText: "1박당 숙박비 상한 70,000원을 적용합니다."
  },
  policyResponse: {
    title: "교사 인솔 출장 숙박비",
    lead: "교사가 경주에서 대전으로 인솔 출장할 경우 숙박비 70,000원 상한을 적용합니다.",
    answer: ["공무원 여비 규정 별표 2에 따라 1박당 상한 70,000원을 적용합니다."]
  },
  localLlmComposer: {
    ok: true,
    provider: "ollama",
    model: "qwen3:4b-instruct"
  }
};

const staleServer = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, `Bearer ${token}`);
  assert.equal(request.url, "/api/policy/llm");
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    ok: true,
    result: staleTravelRemoteResult,
    bridge: { elapsedMs: 99, localLlmUsed: true }
  }));
});

await new Promise((resolve) => staleServer.listen(0, "127.0.0.1", resolve));
const staleAddress = staleServer.address();
try {
  const guarded = await maybeApplyRemoteLocalPolicyLlm({ question: overtimeBaseResult.question }, overtimeBaseResult, {
    REMOTE_LOCAL_LLM_ENABLED: "true",
    REMOTE_LOCAL_LLM_BASE_URL: `http://127.0.0.1:${staleAddress.port}`,
    REMOTE_LOCAL_LLM_TOKEN: token,
    REMOTE_LOCAL_LLM_TIMEOUT_MS: "5000"
  });
  assert.equal(guarded.semanticFrame.domainCode, "staffAttendanceService");
  assert.equal(guarded.policyResponse.title, "출장 중 시간외근무");
  assert.equal(guarded.remoteLocalLlm.ok, false);
  assert.equal(guarded.remoteLocalLlm.reason, "remote_local_llm_regressed_result");
  assert.doesNotMatch(guarded.responseText || guarded.policyResponse.answer.join(" "), /70,000원/);
} finally {
  await new Promise((resolve) => staleServer.close(resolve));
}

console.log("Remote local LLM bridge regression passed");
