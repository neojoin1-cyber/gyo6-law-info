import assert from "node:assert/strict";
import { createServer } from "node:http";
import { handlePolicyChatRequest } from "../functions/shared/policy-chat.mjs";
import { maybeApplyRemoteLocalPolicyLlm } from "../functions/shared/remote-local-llm.mjs";

const functionPolicyParentLeave = handlePolicyChatRequest({
  question: "교원의 부모 사망시 경조사휴가는 며칠인가요?",
  officeLabel: "경상북도교육청",
  roleLabel: "교원"
});
assert.equal(functionPolicyParentLeave.ok, true);
assert.equal(functionPolicyParentLeave.semanticFrame.domainCode, "bereavementLeave");
assert.equal(functionPolicyParentLeave.needsClarification, false);
assert.match(functionPolicyParentLeave.answerState.primaryText, /본인 부모 사망 경조사휴가는 5일/);
assert.doesNotMatch(functionPolicyParentLeave.responseText, /질문 요지 확인 필요|가족관계를 먼저 확정|확정해야 최종 답/);

const functionPolicyParentLeaveHoliday = handlePolicyChatRequest({
  question: "교원의 부모상 5일 중 중간에 공휴일이 있으면 어떻게 계산하나요?",
  officeLabel: "경상북도교육청",
  roleLabel: "교원"
});
assert.equal(functionPolicyParentLeaveHoliday.ok, true);
assert.equal(functionPolicyParentLeaveHoliday.semanticFrame.domainCode, "bereavementLeave");
assert.equal(functionPolicyParentLeaveHoliday.needsClarification, false);
assert.match(functionPolicyParentLeaveHoliday.responseText, /토요일·공휴일.*산입하지|토요일.*공휴일.*제외/);
assert.doesNotMatch(functionPolicyParentLeaveHoliday.responseText, /질문 요지 확인 필요|기간을 먼저 확인|가족관계를 먼저 확정/);

const functionPolicyStudentParentDeath = handlePolicyChatRequest({
  question: "학생의 부모 사망시 휴가는?",
  officeLabel: "경상북도교육청",
  roleLabel: "학생"
});
assert.equal(functionPolicyStudentParentDeath.ok, true);
assert.equal(functionPolicyStudentParentDeath.semanticFrame.domainCode, "studentRecordsAttendance");
assert.equal(functionPolicyStudentParentDeath.needsClarification, false);
assert.match(functionPolicyStudentParentDeath.responseText, /출석인정결석/);
assert.match(functionPolicyStudentParentDeath.responseText, /학교생활기록부 기재요령/);
assert.match(functionPolicyStudentParentDeath.responseText, /5일/);
assert.doesNotMatch(functionPolicyStudentParentDeath.responseText, /공립 교원|국가공무원|교원휴가|나이스 근무상황|경조사휴가/);

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

const classManagementBaseResult = {
  ok: true,
  question: "학교에서 수업 시간이 시작되어 선생님이 교실에 들어갔는데도 자리에 앉지 않는 학생에게 할 수 있는 조치는?",
  confidence: 0.43,
  semanticFrame: {
    domainCode: "classManagementGuidance",
    domainLabel: "학급관리·학생생활지도",
    confidence: 0.43
  },
  answerState: {
    status: "needs_slot",
    primaryText: "수업 중 자리 미착석·반복 지도 불응은 먼저 교원의 학생생활지도에 관한 고시의 수업방해 생활지도 기준으로 사실을 기록하고, 선도·징계로 넘어갈 때 초·중등교육법 제18조와 시행령 제31조 절차 및 학교생활규정을 대조합니다."
  },
  policyResponse: {
    title: "학급관리·학생생활지도 확인 기준",
    lead: "수업 중 자리 미착석·반복 지도 불응은 먼저 교원의 학생생활지도에 관한 고시의 수업방해 생활지도 기준으로 사실을 기록하고, 선도·징계로 넘어갈 때 초·중등교육법 제18조와 시행령 제31조 절차 및 학교생활규정을 대조합니다.",
    answer: [
      "수업 중 반복적인 지시 불응은 교원의 학생생활지도에 관한 고시에 따라 수업방해 사실과 지도 과정을 시간순으로 기록하고, 훈계·상담·분리 등 생활지도 가능 범위와 학생 인권·아동학대 민원 위험을 먼저 분리합니다. 선도·징계가 필요할 때만 초·중등교육법 제18조, 시행령 제31조, 학교생활규정 절차를 최종 대조합니다.",
      "교원의 학생생활지도에 관한 고시와 초·중등교육법상 선도·징계 절차를 먼저 확인하고, 학교생활규정은 학교별 세부 집행 기준을 확정하는 최종 대조 단계로 봅니다."
    ],
    steps: [
      "교원의 학생생활지도에 관한 고시에서 수업방해·훈계·상담·분리·제지 가능 범위를 먼저 확인",
      "선도·징계 검토 단계로 넘어가면 초·중등교육법 제18조와 시행령 제31조의 절차·의견진술 기회를 대조",
      "상위 기준으로 판단이 남는 세부 집행 부분만 학교생활규정·학칙·위원회 규정으로 최종 확인"
    ],
    caution: "학생 생활지도 사안은 교원의 학생생활지도에 관한 고시와 초·중등교육법상 선도·징계 절차를 먼저 적용하고, 학교생활규정·학칙은 상위 기준으로도 남는 학교별 세부 집행 기준을 확정할 때 최종 대조합니다.",
    sourceKeys: ["studentLifeGuidanceNotice", "elementarySecondaryEducationAct", "teacherRightsAct", "studentGuidanceRule"]
  },
  missingSlots: ["procedureStage", "evidence", "schoolRule", "riskSignal"],
  sourceExpansion: {
    required: true,
    status: "queued",
    trigger: "source_or_slot_gap_detected",
    missingSlots: ["procedureStage", "evidence", "schoolRule", "riskSignal"],
    acquisitionTargets: [
      { tier: "ministryGuideline", label: "교원의 학생생활지도에 관한 고시", query: "교원의 학생생활지도에 관한 고시 수업방해" }
    ]
  }
};

const staleClassManagementRemoteResult = {
  ...classManagementBaseResult,
  answerState: {
    status: "conditional",
    primaryText: "수업 중 지도 불응은 학급 규칙 기반으로 생활지도를 먼저 실시합니다."
  },
  policyResponse: {
    ...classManagementBaseResult.policyResponse,
    lead: "수업 중 지도 불응은 학급 규칙 기반으로 생활지도를 먼저 실시하고, 위험 신호가 없으면 단순 안내로 처리합니다.",
    answer: [
      "학생생활규정이나 학급 운영 원칙에 따라 안내를 하며, 필요 시 보호자와 상담하고, 학교 내 규정에 따라 조치를 고려합니다."
    ],
    steps: [
      "학생생활규정과 학급 운영 원칙을 먼저 확인",
      "지도 불응 사실을 생활지도 기록에 기재"
    ],
    caution: "학교별 생활규정, 교육청 지침, 학급관리 절차를 직접 확인해야 합니다."
  },
  responseText: "수업 중 지도 불응은 학급 규칙 기반으로 생활지도를 먼저 실시합니다.\n확인 순서\n1. 학생생활규정과 학급 운영 원칙을 먼저 확인\n학교별 생활규정, 교육청 지침, 학급관리 절차를 직접 확인해야 합니다.",
  localLlmComposer: {
    ok: true,
    provider: "ollama",
    model: "qwen3:4b-instruct"
  }
};

const staleClassManagementServer = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, `Bearer ${token}`);
  assert.equal(request.url, "/api/policy/llm");
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    ok: true,
    result: staleClassManagementRemoteResult,
    bridge: { elapsedMs: 88, localLlmUsed: true }
  }));
});

await new Promise((resolve) => staleClassManagementServer.listen(0, "127.0.0.1", resolve));
const staleClassManagementAddress = staleClassManagementServer.address();
try {
  const guarded = await maybeApplyRemoteLocalPolicyLlm({ question: classManagementBaseResult.question }, classManagementBaseResult, {
    REMOTE_LOCAL_LLM_ENABLED: "true",
    REMOTE_LOCAL_LLM_BASE_URL: `http://127.0.0.1:${staleClassManagementAddress.port}`,
    REMOTE_LOCAL_LLM_TOKEN: token,
    REMOTE_LOCAL_LLM_TIMEOUT_MS: "5000"
  });
  const guardedText = [
    guarded.responseText,
    guarded.policyResponse.lead,
    ...guarded.policyResponse.answer,
    ...guarded.policyResponse.steps,
    guarded.policyResponse.caution
  ].join(" ");
  assert.match(guarded.policyResponse.lead, /교원의 학생생활지도.*초·중등교육법|초·중등교육법.*교원의 학생생활지도/);
  assert.match(guardedText, /시행령 제31조/);
  assert.doesNotMatch(guardedText, /학급 규칙 기반|학생생활규정과 학급 운영 원칙을 먼저|직접 확인해야/);
  assert.equal(guarded.remoteLocalLlm.ok, true);
} finally {
  await new Promise((resolve) => staleClassManagementServer.close(resolve));
}

const assessmentBaseResult = {
  ok: true,
  question: "수행평가 부정행위와 성적 이의신청은 어떻게 처리하나요?",
  confidence: 0.5,
  semanticFrame: {
    domainCode: "assessmentAcademicManagement",
    domainLabel: "평가·성적·학업성적관리",
    confidence: 0.5
  },
  answerState: {
    status: "needs_slot",
    primaryText: "당해 학년도 학교생활기록부 기재요령과 학교생활기록 작성·관리지침을 먼저 확인하고, 학업성적관리규정·평가계획·이의신청 절차는 학교별 세부 집행 기준으로 최종 대조합니다."
  },
  policyResponse: {
    title: "평가·성적·학업성적관리 확인 기준",
    lead: "당해 학년도 학교생활기록부 기재요령과 학교생활기록 작성·관리지침을 먼저 확인하고, 학업성적관리규정·평가계획·이의신청 절차는 학교별 세부 집행 기준으로 최종 대조합니다.",
    answer: [
      "당해 학년도 학교생활기록부 기재요령과 학교생활기록 작성·관리지침을 먼저 확인하고, 학업성적관리규정·평가계획·이의신청 절차는 학교별 세부 집행 기준으로 최종 대조합니다."
    ],
    steps: [
      "상위 법령·고시·교육부 지침을 먼저 자동 확보하고, 교육청·학교 내부 규정은 세부 집행 기준으로 순차 대조"
    ],
    caution: "학교 현장 사안은 상위 법령·고시·교육부 지침을 먼저 적용하고, 교육청 지침과 학교생활규정·학칙·위원회 규정은 그 기준을 구체화하는 세부 집행 기준으로 순차 대조합니다.",
    sourceKeys: ["schoolRecordGuide", "schoolRecordRule", "publicRecords", "infoDisclosure"]
  },
  missingSlots: ["schoolLevel", "evidence"]
};

const staleAssessmentRemoteResult = {
  ...assessmentBaseResult,
  answerState: {
    status: "conditional",
    primaryText: "학생의 수행평가 부정행위와 성적 이의신청은 학교 내부 규정과 증빙 기준을 우선 확인해야 합니다."
  },
  policyResponse: {
    ...assessmentBaseResult.policyResponse,
    lead: "학생의 수행평가 부정행위와 성적 이의신청은 학교 내부 규정과 증빙 기준을 우선 확인해야 합니다.",
    answer: ["학업성적관리규정과 내부 결재 기준을 먼저 확인합니다."],
    steps: ["학교 내부 규정과 증빙자료를 우선 확인"],
    caution: "법령보다 학교 자체 규정이 더 직접적인 기준이 될 수 있습니다."
  },
  responseText: "학생의 수행평가 부정행위와 성적 이의신청은 학교 내부 규정과 증빙 기준을 우선 확인해야 합니다.\n확인 순서\n1. 학교 내부 규정과 증빙자료를 우선 확인\n법령보다 학교 자체 규정이 더 직접적인 기준이 될 수 있습니다.",
  localLlmComposer: {
    ok: true,
    provider: "ollama",
    model: "qwen3:4b-instruct"
  }
};

const staleAssessmentServer = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, `Bearer ${token}`);
  assert.equal(request.url, "/api/policy/llm");
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    ok: true,
    result: staleAssessmentRemoteResult,
    bridge: { elapsedMs: 77, localLlmUsed: true }
  }));
});

await new Promise((resolve) => staleAssessmentServer.listen(0, "127.0.0.1", resolve));
const staleAssessmentAddress = staleAssessmentServer.address();
try {
  const guarded = await maybeApplyRemoteLocalPolicyLlm({ question: assessmentBaseResult.question }, assessmentBaseResult, {
    REMOTE_LOCAL_LLM_ENABLED: "true",
    REMOTE_LOCAL_LLM_BASE_URL: `http://127.0.0.1:${staleAssessmentAddress.port}`,
    REMOTE_LOCAL_LLM_TOKEN: token,
    REMOTE_LOCAL_LLM_TIMEOUT_MS: "5000"
  });
  const guardedText = [
    guarded.responseText,
    guarded.policyResponse.lead,
    ...guarded.policyResponse.answer,
    ...guarded.policyResponse.steps,
    guarded.policyResponse.caution
  ].join(" ");
  assert.match(guarded.policyResponse.lead, /학교생활기록부 기재요령|학교생활기록 작성/);
  assert.match(guardedText, /최종 대조|세부 집행 기준|순차 대조/);
  assert.doesNotMatch(guardedText, /학교 내부 규정.*우선|학교 자체 규정.*직접적인 기준|내부 결재 기준을 먼저|직접 확인해야|교육청 지침.*우선 적용|확인하시기 바랍니다/);
  assert.equal(guarded.remoteLocalLlm.ok, true);
} finally {
  await new Promise((resolve) => staleAssessmentServer.close(resolve));
}

const childbirthBaseResult = {
  ok: true,
  question: "기간제교사의 출산휴가 규정은?",
  confidence: 0.56,
  semanticFrame: {
    domainCode: "staffAttendanceService",
    domainLabel: "교직원 복무·근태",
    confidence: 0.56,
    slots: {
      travelerRole: { subjectLabel: "기간제교사" },
      serviceIssue: { code: "childbirthLeave", label: "출산휴가" },
      employmentType: { code: "fixedTerm", label: "기간제교사" }
    }
  },
  answerState: {
    status: "conditional",
    primaryText: "기간제교사의 본인 출산휴가는 근로계약으로 임의 축소할 수 있는 사항이 아니며, 근로기준법 제74조의 출산전후휴가 기준인 90일을 기본 법정 기준으로 봅니다."
  },
  policyResponse: {
    title: "기간제교사 출산휴가",
    lead: "교직원 복무·근태 질문에서 기간제교사의 출산휴가는 사유가 이미 확인된 사안으로 보고, 공통 출산전후휴가 기준과 기간제교사 적용 절차를 먼저 답합니다.",
    answer: [
      "기간제교사의 본인 출산휴가는 근로계약으로 임의 축소할 수 있는 사항이 아니며, 근로기준법 제74조의 출산전후휴가 기준인 90일을 기본 법정 기준으로 봅니다. 한 번에 둘 이상 자녀를 임신한 경우에는 120일 기준입니다.",
      "출산 후 휴가 기간은 최소 45일 이상, 다태아는 최소 60일 이상 확보되도록 배치합니다.",
      "공립학교 기간제교사는 계약제교원 운영 지침과 교원휴가 예규 준용 여부를 대조하되, 그 문서는 법정 기준을 낮추는 근거가 아니라 신청 절차, 보수·대체교원 처리, 증빙 방식을 정리하는 집행 기준입니다."
    ],
    steps: [
      "본인 출산휴가 사유로 분류하고 출산예정일·출산일 기준 기간 확정",
      "공통 출산전후휴가 기준을 먼저 적용한 뒤 기간제·사립·교육공무직 등 신분별 지침을 대조"
    ],
    caution: "복무·근태는 공통 법령·예규를 먼저 적용하고 교육청 운영 지침과 계약·취업규칙 등 하위 집행문서는 세부 집행 기준으로 순차 대조합니다.",
    sourceKeys: ["teacherLeave", "nationalService", "laborStandard", "fixedTermTeacherGuideline"]
  },
  sourceExpansion: {
    required: true,
    status: "queued",
    trigger: "source_or_slot_gap_detected",
    acquisitionTargets: [
      { tier: "officialRule", label: "공통 법령·예규 원문", query: "출산휴가 국가공무원 복무규정 교원휴가 예규 근로기준법" },
      { tier: "educationOfficeGuideline", label: "경상북도교육청 지침 원문", query: "경상북도교육청 기간제교사 출산휴가 계약제교원 운영 지침" },
      { tier: "employmentExecutionRule", label: "임용계약서·취업규칙·복무규정", query: "기간제교사 출산휴가 임용계약서 복무규정" }
    ]
  },
  missingSlots: []
};

const staleChildbirthRemoteResult = {
  ...childbirthBaseResult,
  answerState: {
    status: "conditional",
    primaryText: "기간제교사의 출산휴가는 사유별 일수표를 먼저 확인해야 합니다."
  },
  policyResponse: {
    ...childbirthBaseResult.policyResponse,
    lead: "나이스 근무상황 신청 종별, 증빙자료, 학교장 승인 절차를 함께 확인합니다.",
    answer: [
      "기간제교사의 출산휴가 규정은 사유별 일수표에 따라 다르며, 본인 또는 배우자의 출산 등 구체 사유에 따라 적용됩니다.",
      "출산휴가의 일수와 신청 절차는 교육청의 계약제교원 운영 지침과 근로계약에 따라 달라질 수 있습니다.",
      "공립 교원 기준을 준용하는지 확인하고, 소속 교육청의 복무 지침을 우선적으로 확인해야 합니다."
    ],
    steps: ["나이스 근무상황 신청 종별, 증빙자료, 학교장 승인 절차를 함께 확인"],
    caution: "소속 교육청 지침과 근로계약을 직접 확인해야 합니다."
  },
  responseText: "나이스 근무상황 신청 종별, 증빙자료, 학교장 승인 절차를 함께 확인합니다.\n출산휴가의 일수와 신청 절차는 교육청의 계약제교원 운영 지침과 근로계약에 따라 달라질 수 있습니다.\n공립 교원 기준을 준용하는지 확인하고, 소속 교육청의 복무 지침을 우선적으로 확인해야 합니다.",
  localLlmComposer: {
    ok: true,
    provider: "ollama",
    model: "qwen3:4b-instruct"
  }
};

const staleChildbirthServer = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, `Bearer ${token}`);
  assert.equal(request.url, "/api/policy/llm");
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    ok: true,
    result: staleChildbirthRemoteResult,
    bridge: { elapsedMs: 66, localLlmUsed: true }
  }));
});

await new Promise((resolve) => staleChildbirthServer.listen(0, "127.0.0.1", resolve));
const staleChildbirthAddress = staleChildbirthServer.address();
try {
  const guarded = await maybeApplyRemoteLocalPolicyLlm({ question: childbirthBaseResult.question }, childbirthBaseResult, {
    REMOTE_LOCAL_LLM_ENABLED: "true",
    REMOTE_LOCAL_LLM_BASE_URL: `http://127.0.0.1:${staleChildbirthAddress.port}`,
    REMOTE_LOCAL_LLM_TOKEN: token,
    REMOTE_LOCAL_LLM_TIMEOUT_MS: "5000"
  });
  const guardedText = [
    guarded.responseText,
    guarded.policyResponse.lead,
    ...guarded.policyResponse.answer,
    ...guarded.policyResponse.steps,
    guarded.policyResponse.caution
  ].join(" ");
  assert.match(guardedText, /90일/);
  assert.match(guardedText, /120일/);
  assert.match(guardedText, /근로기준법 제74조|법정 기준|임의 축소/);
  assert.doesNotMatch(guardedText, /사유별 일수표|달라질 수 있습니다|우선적으로 확인해야|직접 확인해야|나이스 근무상황 신청 종별/);
  assert.equal(guarded.remoteLocalLlm.ok, true);
} finally {
  await new Promise((resolve) => staleChildbirthServer.close(resolve));
}

const bereavementBaseResult = {
  ok: true,
  question: "교원의 부모 사망시 경조사휴가는 며칠인가요?",
  needsClarification: false,
  semanticFrame: {
    domainCode: "bereavementLeave",
    domainLabel: "경조사휴가",
    slots: {
      travelerRole: { subjectLabel: "교원" },
      familyRelation: { code: "parent", label: "본인 부모", leaveDays: 5 },
      employmentType: { code: "publicTeacher", label: "공립 교원" }
    }
  },
  answerState: {
    status: "definitive",
    primaryText: "공립 교원·국가공무원 기준으로 본인 부모 사망 경조사휴가는 5일입니다."
  },
  policyResponse: {
    title: "본인 부모 경조사휴가 확인 기준",
    lead: "교원의 본인 부모 경조사휴가는 공립 교원·국가공무원 기준 일수를 먼저 확정하고, 비공립·비정규 신분은 적용 절차만 별도 대조합니다.",
    answer: [
      "공립 교원·국가공무원 기준으로 본인 부모 사망 경조사휴가는 5일입니다.",
      "근거는 국가공무원 복무규정 제20조와 별표 2의 경조사별 휴가 일수표이며, 공립 교원은 교원휴가에 관한 예규와 나이스 근무상황 신청 절차를 함께 확인합니다.",
      "경조사휴가 기간 중 토요일·공휴일은 휴가일수에 산입하지 않습니다. 따라서 중간에 공휴일이 끼면 그 날은 5일 같은 경조사휴가 일수에서 제외해 계산합니다.",
      "사립학교 교원·교육공무직은 학교법인 복무규정, 취업규칙, 단체협약에서 같은 경조사휴가를 어떻게 정했는지 대조하되, 이미 확정된 공립 교원 기준 일수 자체를 흐리지 않습니다."
    ],
    steps: [
      "본인 부모 관계는 이미 질문에서 확인되었으므로 같은 관계의 경조사휴가 일수표를 우선 적용"
    ],
    caution: "공립 교원·국가공무원 기준 일수는 5일로 먼저 답하고, 기간제·사립학교·교육공무직 등은 신청 절차, 보수 처리, 소속기관 경조사휴가표를 세부 집행 기준으로 대조합니다."
  },
  missingSlots: []
};

const staleBereavementRemoteResult = {
  ...bereavementBaseResult,
  needsClarification: true,
  missingSlots: ["familyRelation", "dateRange"],
  answerState: {
    status: "conditional",
    primaryText: "공립 교원의 경조사휴가는 가족관계와 대상 신분을 먼저 확정해야 일수와 신청 절차를 판단할 수 있습니다."
  },
  policyResponse: {
    ...bereavementBaseResult.policyResponse,
    lead: "공립 교원의 경조사휴가는 가족관계와 대상 신분을 먼저 확정해야 일수와 신청 절차를 판단할 수 있습니다.",
    answer: [
      "복무·근태는 신분과 고용 형태에 따라 적용 규정이 달라집니다.",
      "공립 교원, 지방공무원, 교육공무직, 기간제, 사립학교 여부를 확정해야 최종 답을 낼 수 있습니다.",
      "공휴일이 끼면 소속기관 복무 지침을 먼저 확인해야 합니다."
    ],
    steps: ["가족관계와 대상 신분을 먼저 확정"],
    caution: "소속 교육청 지침과 학교법인 규정을 직접 확인해야 합니다."
  },
  responseText: "공립 교원의 경조사휴가는 가족관계와 대상 신분을 먼저 확정해야 일수와 신청 절차를 판단할 수 있습니다.\n공립 교원, 지방공무원, 교육공무직, 기간제, 사립학교 여부를 확정해야 최종 답을 낼 수 있습니다.",
  localLlmComposer: {
    ok: true,
    provider: "ollama",
    model: "qwen3:4b-instruct"
  }
};

const staleBereavementServer = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, `Bearer ${token}`);
  assert.equal(request.url, "/api/policy/llm");
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    ok: true,
    result: staleBereavementRemoteResult,
    bridge: { elapsedMs: 64, localLlmUsed: true }
  }));
});

await new Promise((resolve) => staleBereavementServer.listen(0, "127.0.0.1", resolve));
const staleBereavementAddress = staleBereavementServer.address();
try {
  const guarded = await maybeApplyRemoteLocalPolicyLlm({ question: bereavementBaseResult.question }, bereavementBaseResult, {
    REMOTE_LOCAL_LLM_ENABLED: "true",
    REMOTE_LOCAL_LLM_BASE_URL: `http://127.0.0.1:${staleBereavementAddress.port}`,
    REMOTE_LOCAL_LLM_TOKEN: token,
    REMOTE_LOCAL_LLM_TIMEOUT_MS: "5000"
  });
  const guardedText = [
    guarded.responseText,
    guarded.policyResponse.lead,
    ...guarded.policyResponse.answer,
    ...guarded.policyResponse.steps,
    guarded.policyResponse.caution
  ].join(" ");
  assert.match(guardedText, /본인 부모 사망 경조사휴가는 5일/);
  assert.match(guardedText, /국가공무원 복무규정|교원휴가에 관한 예규/);
  assert.match(guardedText, /토요일·공휴일.*산입하지|토요일.*공휴일.*제외/);
  assert.doesNotMatch(guardedText, /가족관계와 대상 신분을 먼저 확정|확정해야 최종 답|직접 확인해야|공휴일이 끼면 소속기관/);
  assert.equal(guarded.needsClarification, false);
  assert.deepEqual(guarded.missingSlots, []);
  assert.equal(guarded.remoteLocalLlm.ok, true);
} finally {
  await new Promise((resolve) => staleBereavementServer.close(resolve));
}

const studentAttendanceBaseResult = {
  ok: true,
  question: "학생의 부모 사망시 휴가는?",
  needsClarification: false,
  semanticFrame: {
    domainCode: "studentRecordsAttendance",
    domainLabel: "학생부·출결·정정",
    slots: {
      targetSubject: { roleCode: "student", subjectLabel: "학생" },
      familyRelation: { code: "parent", label: "본인 부모", leaveDays: 5 }
    }
  },
  answerState: {
    status: "definitive",
    primaryText: "학생 가족 사망은 교직원 경조사휴가가 아니라 학교생활기록부 기재요령의 경조사로 인한 출석인정결석 기준으로 처리합니다."
  },
  policyResponse: {
    title: "경조사 출석인정결석 확인 기준",
    lead: "학생 가족 사망은 교직원 경조사휴가가 아니라 학교생활기록부 기재요령의 경조사로 인한 출석인정결석 기준으로 처리합니다.",
    answer: [
      "학생의 부모 사망은 경조사로 인한 출석인정결석 사안이며, 5일 기준으로 확인합니다.",
      "실제 출결 처리는 수업일·등교일 기준으로 결석일수를 산정하고, 토요일·공휴일·재량휴업일처럼 출석 의무가 없는 날은 결석일수에 넣지 않습니다.",
      "결석계, 사망 사실 확인 자료, 가족관계 확인 자료, 보호자 연락·담임 확인, 나이스 출결 처리 이력을 함께 정리합니다."
    ],
    steps: [
      "당해 학년도 학교생활기록부 기재요령의 경조사로 인한 출석인정결석 기준 확인"
    ],
    caution: "이 사안에는 공립 교원·국가공무원 경조사휴가, 교원휴가에 관한 예규, 교직원 나이스 근무상황 신청 기준을 적용하지 않습니다."
  },
  missingSlots: []
};

const wrongStudentAttendanceRemoteResult = {
  ...studentAttendanceBaseResult,
  semanticFrame: {
    domainCode: "bereavementLeave",
    domainLabel: "경조사휴가",
    slots: {
      travelerRole: { subjectLabel: "교원" }
    }
  },
  answerState: {
    status: "definitive",
    primaryText: "공립 교원·국가공무원 기준으로 본인 부모 사망 경조사휴가는 5일입니다."
  },
  policyResponse: {
    ...studentAttendanceBaseResult.policyResponse,
    lead: "공립 교원·국가공무원 기준으로 본인 부모 사망 경조사휴가는 5일입니다.",
    answer: [
      "근거는 국가공무원 복무규정 제20조와 교원휴가에 관한 예규입니다.",
      "나이스 근무상황에서 경조사휴가로 신청합니다."
    ],
    steps: ["나이스 근무상황 신청 종별 확인"],
    caution: "교직원 복무 기준을 확인합니다."
  },
  responseText: "공립 교원·국가공무원 기준으로 본인 부모 사망 경조사휴가는 5일입니다.\n나이스 근무상황에서 신청합니다.",
  localLlmComposer: {
    ok: true,
    provider: "ollama",
    model: "qwen3:4b-instruct"
  }
};

const wrongStudentAttendanceServer = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, `Bearer ${token}`);
  assert.equal(request.url, "/api/policy/llm");
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    ok: true,
    result: wrongStudentAttendanceRemoteResult,
    bridge: { elapsedMs: 61, localLlmUsed: true }
  }));
});

await new Promise((resolve) => wrongStudentAttendanceServer.listen(0, "127.0.0.1", resolve));
const wrongStudentAttendanceAddress = wrongStudentAttendanceServer.address();
try {
  const guarded = await maybeApplyRemoteLocalPolicyLlm({ question: studentAttendanceBaseResult.question }, studentAttendanceBaseResult, {
    REMOTE_LOCAL_LLM_ENABLED: "true",
    REMOTE_LOCAL_LLM_BASE_URL: `http://127.0.0.1:${wrongStudentAttendanceAddress.port}`,
    REMOTE_LOCAL_LLM_TOKEN: token,
    REMOTE_LOCAL_LLM_TIMEOUT_MS: "5000"
  });
  const guardedText = [
    guarded.responseText,
    guarded.policyResponse.lead,
    ...guarded.policyResponse.answer,
    ...guarded.policyResponse.steps,
    guarded.policyResponse.caution
  ].join(" ");
  assert.equal(guarded.semanticFrame.domainCode, "studentRecordsAttendance");
  assert.match(guardedText, /출석인정결석/);
  assert.match(guardedText, /학교생활기록부 기재요령/);
  assert.doesNotMatch(guardedText, /공립 교원·국가공무원 기준으로|국가공무원 복무규정|나이스 근무상황에서 경조사휴가/);
  assert.equal(guarded.remoteLocalLlm.ok, false);
  assert.equal(guarded.remoteLocalLlm.reason, "remote_local_llm_regressed_result");
} finally {
  await new Promise((resolve) => wrongStudentAttendanceServer.close(resolve));
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
