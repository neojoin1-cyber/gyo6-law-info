import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const policyEngine = require("../public/policy-engine.js");
const sourceRegistry = require("../public/policy-source-registry.js");
const policyCorpus = require("../public/policy-corpus.js");

const args = parseArgs(process.argv.slice(2));
const phase = args.phase || process.env.POLICY_QUALITY_PHASE || "all";
const sampleLimit = Number(args.limit || process.env.POLICY_QUALITY_SAMPLE_LIMIT || 180);
const officeLabel = cleanText(args.office || process.env.POLICY_QUALITY_OFFICE_LABEL || "경상북도교육청");
const outDir = path.join(rootDir, "data", "policy-quality");
const runDir = path.join(outDir, "runs");
const runAt = new Date();
const runId = runAt.toISOString().replace(/[:.]/g, "-");
const knownPhases = new Set(["all", "sources", "simulate", "evaluate"]);

if (!knownPhases.has(phase)) {
  printJson({ ok: false, error: `unknown_phase:${phase}`, phases: [...knownPhases] });
  process.exitCode = 1;
} else {
  const result = await runPolicyQualityLoop();
  printJson(result);
  process.exitCode = result.ok ? 0 : 1;
}

async function runPolicyQualityLoop() {
  await mkdir(runDir, { recursive: true });

  const bank = await loadScenarioBank();
  const selectedScenarios = selectScenarios(bank, sampleLimit, phase);
  const sourceHealth = phase === "all" || phase === "sources"
    ? await buildSourceHealth()
    : { skipped: true, reason: "phase_not_sources" };
  const simulation = phase === "all" || phase === "simulate" || phase === "evaluate"
    ? runScenarioSimulation(selectedScenarios)
    : { skipped: true, reason: "phase_not_simulation" };
  const ollamaReview = phase === "all" || phase === "evaluate"
    ? await runOptionalOllamaReview(simulation.findings || [])
    : { skipped: true, reason: "phase_not_evaluate" };

  const sourceExpansionQueue = buildSourceExpansionQueue({
    sourceHealth,
    findings: simulation.findings || []
  });
  const regressionCandidates = buildRegressionCandidates(simulation.findings || []);
  const trainingCases = buildTrainingCases(selectedScenarios, simulation.findings || []);
  const summary = buildSummary({
    bank,
    selectedScenarios,
    sourceHealth,
    simulation,
    ollamaReview,
    sourceExpansionQueue,
    regressionCandidates,
    trainingCases
  });

  const runPayload = {
    ok: true,
    runId,
    phase,
    runAt: runAt.toISOString(),
    officeLabel,
    freeOnly: true,
    paidApiCalls: 0,
    outputDir: outDir,
    summary,
    sourceHealth,
    simulation,
    ollamaReview,
    sourceExpansionQueue,
    regressionCandidates,
    trainingCases
  };

  const runPath = path.join(runDir, `${runId}-${phase}.json`);
  await writeJson(runPath, runPayload);
  await writeJson(path.join(outDir, "latest.json"), runPayload);
  await writeJson(path.join(outDir, "source-expansion-queue.json"), mergeQueueFile("source-expansion-queue.json", sourceExpansionQueue, "key"));
  await writeJson(path.join(outDir, "regression-candidates.json"), mergeQueueFile("regression-candidates.json", regressionCandidates, "id"));
  await appendJsonl(path.join(outDir, "training-cases.jsonl"), trainingCases);
  await writeFile(path.join(outDir, "latest.md"), renderMarkdown(runPayload), "utf8");

  return {
    ok: true,
    runId,
    phase,
    outputDir: outDir,
    summary,
    files: {
      latest: path.join(outDir, "latest.json"),
      latestMarkdown: path.join(outDir, "latest.md"),
      run: runPath,
      sourceExpansionQueue: path.join(outDir, "source-expansion-queue.json"),
      regressionCandidates: path.join(outDir, "regression-candidates.json"),
      trainingCases: path.join(outDir, "training-cases.jsonl")
    }
  };
}

async function loadScenarioBank() {
  try {
    const module = await import("./policy-scenario-bank.mjs");
    return {
      loadMode: "synthetic-policy-scenario-bank",
      ...module.buildSyntheticPolicyScenarioBank({
        maxPerDomain: Number(args.maxPerDomain || process.env.POLICY_QUALITY_MAX_PER_DOMAIN || 72),
        maxCounterexamplesPerDomain: Number(args.maxCounterexamplesPerDomain || process.env.POLICY_QUALITY_MAX_COUNTEREXAMPLES_PER_DOMAIN || 72)
      })
    };
  } catch (error) {
    return buildFallbackScenarioBank(error);
  }
}

function buildFallbackScenarioBank(error) {
  const domains = policyEngine.knowledgeBase?.domains || {};
  const scenarios = [];

  for (const [domainCode, domain] of Object.entries(domains)) {
    const patterns = [
      ...(domain.questionPatterns || []),
      ...(domain.subtopics || []).map((item) => `${item} 기준과 필요한 증빙은?`)
    ].filter(Boolean).slice(0, 8);

    patterns.forEach((question, index) => {
      scenarios.push({
        id: `fallback-${domainCode}-${index + 1}`,
        source: "fallback-domain-pattern",
        domainCode,
        categoryCode: domain.categoryCode || "",
        question
      });
    });
  }

  return {
    loadMode: "fallback-domain-patterns",
    loadError: cleanText(error?.message || error),
    metadata: {
      domainCount: Object.keys(domains).length,
      totalCount: scenarios.length,
      syntheticCount: scenarios.length,
      counterexampleCount: 0
    },
    scenarios,
    counterexamples: [],
    regressionSample: scenarios.slice(0, 40)
  };
}

async function buildSourceHealth() {
  const officialSources = sourceRegistry.officialSources || {};
  const sourceEntries = Object.entries(officialSources).map(([key, source]) => ({
    key,
    tier: cleanText(source.tier || ""),
    title: cleanText(source.title || ""),
    provider: cleanText(source.provider || ""),
    query: cleanText(source.query || ""),
    domains: source.domains || [],
    url: cleanText(source.url || source.homepage || "")
  }));
  const directUrlEntries = sourceEntries.filter((item) => item.url);
  const directUrlHealth = [];

  for (const item of directUrlEntries.slice(0, Number(args.sourceProbeLimit || process.env.POLICY_QUALITY_SOURCE_PROBE_LIMIT || 12))) {
    directUrlHealth.push({
      ...item,
      probe: await probeUrl(item.url)
    });
  }

  const byDomain = {};
  for (const source of sourceEntries) {
    for (const domainCode of source.domains || []) {
      const key = domainCode === "*" ? "common" : domainCode;
      byDomain[key] ||= { domainCode: key, total: 0, directUrls: 0, tiers: {}, sourceKeys: [] };
      byDomain[key].total += 1;
      if (source.url) byDomain[key].directUrls += 1;
      byDomain[key].tiers[source.tier || "unknown"] = (byDomain[key].tiers[source.tier || "unknown"] || 0) + 1;
      byDomain[key].sourceKeys.push(source.key);
    }
  }

  return {
    ok: true,
    registryVersion: sourceRegistry.version || "",
    corpusStats: policyCorpus.stats || {},
    sourceCount: sourceEntries.length,
    directUrlCount: directUrlEntries.length,
    collectionJobs: sourceRegistry.collectionJobs || [],
    domains: Object.values(byDomain).sort((a, b) => a.domainCode.localeCompare(b.domainCode)),
    directUrlHealth
  };
}

function runScenarioSimulation(scenarios) {
  const findings = [];
  const domainStats = {};
  const evaluated = [];

  for (const scenario of scenarios) {
    const item = evaluateScenario(scenario);
    evaluated.push(item);
    const domainCode = item.actualDomain || "unclassified";
    domainStats[domainCode] ||= { domainCode, count: 0, averageScore: 0, weak: 0, mismatches: 0 };
    domainStats[domainCode].count += 1;
    domainStats[domainCode].averageScore += item.score;
    if (item.score < 74) domainStats[domainCode].weak += 1;
    if (item.expectedDomain && item.actualDomain && item.expectedDomain !== item.actualDomain) domainStats[domainCode].mismatches += 1;
    if (item.finding) findings.push(item.finding);
  }

  for (const stat of Object.values(domainStats)) {
    stat.averageScore = Math.round(stat.averageScore / Math.max(1, stat.count));
  }

  const sortedFindings = findings
    .sort((a, b) => b.severityScore - a.severityScore)
    .slice(0, Number(args.findingLimit || process.env.POLICY_QUALITY_FINDING_LIMIT || 80));

  return {
    ok: true,
    sampleCount: evaluated.length,
    weakCount: evaluated.filter((item) => item.score < 74).length,
    mismatchCount: evaluated.filter((item) => item.expectedDomain && item.actualDomain && item.expectedDomain !== item.actualDomain).length,
    averageScore: Math.round(evaluated.reduce((sum, item) => sum + item.score, 0) / Math.max(1, evaluated.length)),
    domainStats: Object.values(domainStats).sort((a, b) => a.domainCode.localeCompare(b.domainCode)),
    findings: sortedFindings
  };
}

function evaluateScenario(scenario) {
  const question = cleanText(scenario.question || scenario.text || "");
  const expectedDomain = cleanText(scenario.domainCode || scenario.expectedDomain || "");
  let analysis = null;
  let lookup = null;
  let response = null;
  const weaknesses = [];
  let score = 100;

  try {
    analysis = policyEngine.analyzePolicyQuestion(question);
    lookup = policyEngine.lookupPolicyRules(analysis);
    response = policyEngine.buildPolicyResponse({
      question,
      officeLabel,
      roleLabel: scenario.roleLabel || scenario.subject || ""
    });
  } catch (error) {
    return {
      id: scenario.id || hashKey(question),
      question,
      expectedDomain,
      actualDomain: "",
      score: 0,
      finding: {
        id: `engine-error:${hashKey(question)}`,
        type: "engineError",
        severityScore: 100,
        question,
        expectedDomain,
        actualDomain: "",
        message: cleanText(error?.message || error),
        recommendedAction: "엔진 예외를 재현 회귀테스트로 고정하고 원인 분석"
      }
    };
  }

  const frame = analysis?.semanticFrame || {};
  const actualDomain = cleanText(lookup?.domain || response?.domain || frame.domainCode || "");
  const responseText = collectResponseText(response);
  const sourceKeys = response?.sourceKeys || lookup?.sourceKeys || [];
  const confidence = Number(frame.confidence || 0);

  if (expectedDomain && actualDomain && expectedDomain !== actualDomain) {
    score -= 28;
    weaknesses.push({
      type: "domainMismatch",
      message: `expected ${expectedDomain}, got ${actualDomain}`
    });
  }
  if (confidence && confidence < 0.45) {
    score -= 10;
    weaknesses.push({ type: "lowConfidence", message: `semantic confidence ${confidence}` });
  }
  if (!sourceKeys.length) {
    score -= 16;
    weaknesses.push({ type: "missingSourceKeys", message: "sourceKeys empty" });
  }
  if (hasUnsafeHandoffPhrase(responseText)) {
    score -= 18;
    weaknesses.push({ type: "handoffPhrase", message: "사용자에게 원문 확인을 떠넘기는 문구 감지" });
  }
  if (hasPrematureSchoolRulePhrase(responseText, response?.sourcePriority)) {
    score -= 12;
    weaknesses.push({ type: "prematureSchoolRule", message: "상위 규범 확인 전 학교 내부 규정 확인 문구가 앞서는 패턴" });
  }
  if (response?.qualityGate?.status === "needsSourceExpansion") {
    score -= 8;
    weaknesses.push({ type: "needsSourceExpansion", message: "품질 게이트가 추가 원문 확충 필요로 판단" });
  }
  if (!responseText || responseText.length < 80) {
    score -= 15;
    weaknesses.push({ type: "thinAnswer", message: "답변 본문이 지나치게 짧음" });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const finding = weaknesses.length ? {
    id: `${actualDomain || "unclassified"}:${hashKey(question)}`,
    type: weaknesses[0].type,
    severityScore: 100 - score,
    question,
    expectedDomain,
    actualDomain,
    categoryCode: cleanText(response?.categoryCode || lookup?.categoryCode || frame.categoryCode || ""),
    task: cleanText(frame.task?.code || ""),
    sourceKeys,
    missingSlots: frame.missingSlots || lookup?.missingSlots || [],
    sourceExpansion: response?.sourceExpansion || null,
    weaknesses,
    responseLead: cleanText(response?.lead || response?.title || "").slice(0, 260),
    recommendedAction: recommendAction(weaknesses, frame, response)
  } : null;

  return {
    id: scenario.id || hashKey(question),
    question,
    expectedDomain,
    actualDomain,
    score,
    confidence,
    sourceKeys,
    finding
  };
}

async function runOptionalOllamaReview(findings) {
  if (args.noOllama || process.env.POLICY_QUALITY_USE_OLLAMA === "false") {
    return { skipped: true, reason: "ollama_disabled" };
  }

  const baseUrl = cleanUrl(args.ollamaBaseUrl || process.env.LOCAL_LLM_BASE_URL || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434");
  const model = cleanText(args.ollamaModel || process.env.LOCAL_LLM_MODEL || process.env.OLLAMA_MODEL || "qwen3:4b-instruct");
  const status = await probeUrl(`${baseUrl}/api/tags`, 3000);
  if (!status.ok) {
    return { skipped: true, reason: "ollama_unavailable", baseUrl, status };
  }

  const samples = findings
    .filter((item) => item.severityScore >= 18)
    .slice(0, Number(args.ollamaLimit || process.env.POLICY_QUALITY_OLLAMA_LIMIT || 6));
  const reviews = [];

  for (const finding of samples) {
    reviews.push(await askOllamaForQualityReview({ baseUrl, model, finding }));
  }

  return {
    ok: true,
    baseUrl,
    model,
    sampleCount: reviews.length,
    reviews
  };
}

async function askOllamaForQualityReview({ baseUrl, model, finding }) {
  const prompt = [
    "너는 한국 학교 법률정보 Q&A 품질감사자다.",
    "유료 API 없이 로컬 품질평가용으로만 판단한다.",
    "아래 질문과 감지된 약점을 보고, 답변 시스템 개선에 필요한 한 줄 지시를 한국어로 써라.",
    "사용자에게 '원문을 확인하라'고 떠넘기지 않는 방향이어야 한다.",
    "",
    `질문: ${finding.question}`,
    `예상 도메인: ${finding.expectedDomain || "없음"}`,
    `실제 도메인: ${finding.actualDomain || "없음"}`,
    `약점: ${finding.weaknesses.map((item) => item.type).join(", ")}`,
    `현재 제안: ${finding.recommendedAction}`
  ].join("\n");

  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        keep_alive: "20m",
        options: {
          temperature: 0.1,
          num_ctx: 2048,
          num_predict: 120
        }
      }),
      signal: AbortSignal.timeout(Number(args.ollamaTimeoutMs || process.env.POLICY_QUALITY_OLLAMA_TIMEOUT_MS || 45000))
    });
    const data = await response.json().catch(async () => ({ raw: await response.text() }));
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      findingId: finding.id,
      suggestion: cleanLongText(data.response || data.message?.content || data.raw || "").slice(0, 600)
    };
  } catch (error) {
    return {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      findingId: finding.id,
      error: cleanText(error?.message || error)
    };
  }
}

function buildSourceExpansionQueue({ sourceHealth, findings }) {
  const fromFindings = findings.flatMap((finding) => {
    const expansionTargets = finding.sourceExpansion?.acquisitionTargets || [];
    if (!expansionTargets.length) {
      return [{
        key: `${finding.actualDomain || "unclassified"}:${finding.type}`,
        domainCode: finding.actualDomain || "",
        categoryCode: finding.categoryCode || "",
        priority: finding.severityScore >= 30 ? "high" : "normal",
        reason: finding.weaknesses.map((item) => item.type).join(", "),
        query: buildSourceQuery(finding),
        source: "quality-finding"
      }];
    }
    return expansionTargets.map((target, index) => ({
      key: `${finding.actualDomain || "unclassified"}:${cleanText(target.label || target.tier || index)}`,
      domainCode: finding.actualDomain || "",
      categoryCode: finding.categoryCode || "",
      priority: finding.severityScore >= 30 ? "high" : "normal",
      tier: cleanText(target.tier || ""),
      title: cleanText(target.label || target.title || ""),
      query: cleanText(target.query || buildSourceQuery(finding)),
      reason: finding.weaknesses.map((item) => item.type).join(", "),
      source: "quality-finding-source-expansion"
    }));
  });

  const missingDirectUrls = (sourceHealth.domains || [])
    .filter((domain) => domain.total > 0 && domain.directUrls === 0)
    .map((domain) => ({
      key: `${domain.domainCode}:direct-url-gap`,
      domainCode: domain.domainCode,
      priority: "normal",
      reason: "공식 출처는 있으나 직접 URL이 부족함",
      query: `${domain.domainCode} 공식 지침 원문`,
      source: "registry-direct-url-gap"
    }));

  return mergeByKey([...fromFindings, ...missingDirectUrls], "key")
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || a.key.localeCompare(b.key))
    .slice(0, Number(args.queueLimit || process.env.POLICY_QUALITY_QUEUE_LIMIT || 120));
}

function buildRegressionCandidates(findings) {
  return findings
    .filter((finding) => finding.severityScore >= 16)
    .map((finding) => ({
      id: `regression:${finding.id}`,
      source: "policy-quality-nightly",
      createdAt: runAt.toISOString(),
      question: finding.question,
      expectedDomain: finding.expectedDomain || finding.actualDomain || "",
      forbiddenPhrases: forbiddenPhrasesForFinding(finding),
      mustIncludeSourceKeys: finding.sourceKeys || [],
      reason: finding.weaknesses.map((item) => item.message).join("; "),
      recommendedAction: finding.recommendedAction
    }))
    .slice(0, Number(args.regressionLimit || process.env.POLICY_QUALITY_REGRESSION_LIMIT || 80));
}

function buildTrainingCases(scenarios, findings) {
  const weakQuestionSet = new Set(findings.map((finding) => finding.question));
  return scenarios
    .filter((scenario) => weakQuestionSet.has(cleanText(scenario.question || scenario.text || "")))
    .map((scenario) => ({
      id: `training:${scenario.id || hashKey(scenario.question || "")}`,
      createdAt: runAt.toISOString(),
      type: "classification-and-answer-quality",
      question: cleanText(scenario.question || scenario.text || ""),
      expectedDomain: cleanText(scenario.domainCode || scenario.expectedDomain || ""),
      expectedCategory: cleanText(scenario.categoryCode || ""),
      note: "로컬 규정 엔진과 Ollama 보강 프롬프트 개선에 쓰는 무료 시뮬레이션 케이스입니다. 외부 유료 API 학습 데이터가 아닙니다."
    }))
    .slice(0, Number(args.trainingLimit || process.env.POLICY_QUALITY_TRAINING_LIMIT || 120));
}

function buildSummary({ bank, selectedScenarios, sourceHealth, simulation, ollamaReview, sourceExpansionQueue, regressionCandidates, trainingCases }) {
  return {
    scenarioBankMode: bank.loadMode || "unknown",
    bankTotal: bank.metadata?.totalCount || (bank.scenarios || []).length,
    sampled: selectedScenarios.length,
    sourceCount: sourceHealth.sourceCount || 0,
    directUrlCount: sourceHealth.directUrlCount || 0,
    simulationAverageScore: simulation.averageScore || 0,
    weakCount: simulation.weakCount || 0,
    mismatchCount: simulation.mismatchCount || 0,
    sourceExpansionQueueCount: sourceExpansionQueue.length,
    regressionCandidateCount: regressionCandidates.length,
    trainingCaseCount: trainingCases.length,
    ollama: ollamaReview.skipped ? `skipped:${ollamaReview.reason}` : `reviewed:${ollamaReview.sampleCount}`,
    nextAction: sourceExpansionQueue[0]?.query || regressionCandidates[0]?.recommendedAction || "현재 주요 신규 후보 없음"
  };
}

function selectScenarios(bank, limit, currentPhase) {
  const scenarios = [
    ...(bank.regressionSample || []),
    ...(bank.scenarios || []),
    ...(bank.counterexamples || [])
  ].filter((item) => cleanText(item.question || item.text || ""));
  const unique = mergeByKey(scenarios.map((item) => ({
    ...item,
    stableKey: `${item.expectedDomain || item.domainCode || "unknown"}:${cleanText(item.question || item.text || "")}`
  })), "stableKey");
  const offset = hashNumber(`${runAt.toISOString().slice(0, 10)}:${currentPhase}`) % Math.max(1, unique.length);
  const rotated = [...unique.slice(offset), ...unique.slice(0, offset)];
  return rotated.slice(0, Math.max(1, limit));
}

function collectResponseText(response = {}) {
  return [
    response.title,
    response.lead,
    ...(response.answer || []),
    ...(response.steps || []),
    response.caution,
    response.qualityGate?.message
  ].map(cleanLongText).filter(Boolean).join(" ");
}

function hasUnsafeHandoffPhrase(text) {
  const value = cleanLongText(text);
  if (/자동\s*자료확충|재검증|확보되는\s*즉시|확충\s*후/.test(value)) return false;
  return /(원문을\s*확인|직접\s*확인|확인하시기\s*바랍니다|자료실.*검색|소속\s*교육청.*우선적으로\s*확인|공식\s*문서를\s*직접\s*확인)/.test(value);
}

function hasPrematureSchoolRulePhrase(text, sourcePriority = "") {
  const value = cleanLongText(text);
  if (!/(학교\s*(?:내부\s*)?(?:생활)?규정|학급\s*규정|학교\s*내규)/.test(value)) return false;
  if (/상위\s*(?:법령|고시|지침)|교육부\s*고시|국가공무원|초·중등교육법/.test(value)) return false;
  return sourcePriority !== "school";
}

function recommendAction(weaknesses, frame, response) {
  const types = new Set(weaknesses.map((item) => item.type));
  if (types.has("domainMismatch")) return "질문 속 대상 신분과 사건 키워드의 우선순위를 회귀 케이스로 고정";
  if (types.has("handoffPhrase")) return "사용자 확인 요구 문구를 자동 자료확충 큐와 재검증 메시지로 전환";
  if (types.has("prematureSchoolRule")) return "상위 법령·고시·교육청 지침을 먼저 세운 뒤 학교 규정을 최종 집행 기준으로 배치";
  if (types.has("missingSourceKeys")) return "해당 도메인 sourceKeys와 공식 출처 레지스트리 연결 보강";
  if (response?.sourceExpansion?.acquisitionTargets?.length) return "sourceExpansion acquisitionTargets를 공식 원문 수집 대상으로 반영";
  if (frame?.missingSlots?.length) return "누락 슬롯 질문을 답변 회피가 아니라 필요한 추가 질문으로 분리";
  return "답변 템플릿과 회귀 테스트를 보강";
}

function forbiddenPhrasesForFinding(finding) {
  const phrases = [];
  if (finding.weaknesses.some((item) => item.type === "handoffPhrase")) {
    phrases.push("원문을 확인하시기 바랍니다", "공식 자료실 검색");
  }
  if (finding.weaknesses.some((item) => item.type === "prematureSchoolRule")) {
    phrases.push("먼저 학급 및 학교 생활규정을 확인");
  }
  return phrases;
}

function buildSourceQuery(finding) {
  return cleanLongText([
    officeLabel,
    finding.actualDomain || finding.expectedDomain || "",
    finding.task || "",
    finding.question
  ].join(" ")).slice(0, 180);
}

async function probeUrl(url, timeoutMs = 8000) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs)
    });
    const contentType = response.headers.get("content-type") || "";
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      contentType: cleanText(contentType),
      finalUrl: cleanText(response.url || url)
    };
  } catch (error) {
    return {
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: cleanText(error?.message || error)
    };
  }
}

function cleanUrl(value) {
  return cleanText(value).replace(/\/+$/, "");
}

function parseArgs(rawArgs) {
  const parsed = { phase: "" };
  for (const arg of rawArgs) {
    if (arg.startsWith("--")) {
      const [key, rawValue] = arg.slice(2).split("=");
      const value = rawValue ?? "true";
      parsed[toCamelCase(key)] = value;
    } else if (!parsed.phase) {
      parsed.phase = arg;
    }
  }
  parsed.noOllama = parsed.noOllama === "true" || rawArgs.includes("--no-ollama");
  return parsed;
}

function toCamelCase(value) {
  return cleanText(value).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function appendJsonl(filePath, rows) {
  if (!rows.length) return;
  await mkdir(path.dirname(filePath), { recursive: true });
  const existingKeys = new Set();
  if (existsSync(filePath)) {
    const text = await readFile(filePath, "utf8").catch(() => "");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        if (item.id) existingKeys.add(item.id);
      } catch {}
    }
  }
  const nextRows = rows.filter((row) => !existingKeys.has(row.id));
  if (!nextRows.length) return;
  const prefix = existsSync(filePath) ? "\n" : "";
  await writeFile(filePath, `${prefix}${nextRows.map((row) => JSON.stringify(row)).join("\n")}\n`, { encoding: "utf8", flag: "a" });
}

function mergeQueueFile(fileName, incoming, keyField) {
  const filePath = path.join(outDir, fileName);
  let existing = [];
  if (existsSync(filePath)) {
    try {
      existing = require(filePath);
    } catch {
      existing = [];
    }
  }
  return mergeByKey([...(Array.isArray(existing) ? existing : []), ...incoming], keyField);
}

function mergeByKey(items, keyField) {
  const map = new Map();
  for (const item of items) {
    const key = cleanText(item?.[keyField] || "");
    if (!key) continue;
    const previous = map.get(key) || {};
    map.set(key, { ...previous, ...item, lastSeenAt: runAt.toISOString() });
  }
  return [...map.values()];
}

function priorityRank(priority) {
  if (priority === "high") return 3;
  if (priority === "normal") return 2;
  return 1;
}

function renderMarkdown(payload) {
  const lines = [
    "# GYO6 Policy Quality Nightly",
    "",
    `- Run: ${payload.runId}`,
    `- Phase: ${payload.phase}`,
    `- Office: ${payload.officeLabel}`,
    `- Paid API calls: ${payload.paidApiCalls}`,
    `- Sampled questions: ${payload.summary.sampled}`,
    `- Average score: ${payload.summary.simulationAverageScore}`,
    `- Weak findings: ${payload.summary.weakCount}`,
    `- Domain mismatches: ${payload.summary.mismatchCount}`,
    `- Source expansion queue: ${payload.summary.sourceExpansionQueueCount}`,
    `- Regression candidates: ${payload.summary.regressionCandidateCount}`,
    `- Training cases: ${payload.summary.trainingCaseCount}`,
    `- Ollama: ${payload.summary.ollama}`,
    "",
    "## Next Action",
    "",
    payload.summary.nextAction || "No urgent candidate.",
    ""
  ];

  return lines.join("\n");
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanLongText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hashKey(value) {
  return hashNumber(value).toString(36);
}

function hashNumber(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
