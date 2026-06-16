(function attachPolicyCorpus(root, factory) {
  const corpus = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = corpus;
  } else {
    root.GYO6_POLICY_CORPUS = corpus;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createPolicyCorpus(root) {
  const KB = loadModule(root, "GYO6_POLICY_KB", "./policy-knowledge-base.js", createEmptyKnowledgeBase);
  const REGISTRY = loadModule(root, "GYO6_POLICY_SOURCE_REGISTRY", "./policy-source-registry.js", createEmptySourceRegistry);
  const entries = buildCorpusEntries(KB, REGISTRY);

  function loadModule(globalRoot, globalKey, requirePath, fallbackFactory) {
    if (globalRoot?.[globalKey]) return globalRoot[globalKey];
    if (typeof require === "function") {
      try {
        return require(requirePath);
      } catch {
        return fallbackFactory();
      }
    }
    return fallbackFactory();
  }

  function createEmptyKnowledgeBase() {
    return { version: "missing-policy-kb", domains: {}, schoolPolicyOntology: {} };
  }

  function createEmptySourceRegistry() {
    return { version: "missing-source-registry", officialSources: {}, sourceTiers: {}, collectionJobs: [] };
  }

  function buildCorpusEntries(knowledgeBase, registry) {
    const domainEntries = Object.entries(knowledgeBase.domains || {}).map(([domainCode, domain]) => {
      const sourceKeys = domain.sourceKeys || knowledgeBase.domesticTravel?.sourceKeys || [];
      const dataIndex = getDomainDataIndex(knowledgeBase, domainCode, domain);
      const linkedSources = sourceKeys
        .map((sourceKey) => ({ key: sourceKey, ...(registry.officialSources?.[sourceKey] || {}) }))
        .filter((source) => source.title || source.query);
      return {
        id: `domain:${domainCode}`,
        type: "domainProfile",
        domainCode,
        categoryCode: domain.categoryCode || "",
        ontologyGroup: domain.ontologyGroup || "",
        title: domain.label || domainCode,
        sourceTier: domain.sourcePriorityDefault || "mixed",
        sourceKeys,
        requiredSlots: domain.requiredSlots || [],
        dataIndex,
        terms: uniqueStrings([
          domainCode,
          domain.label,
          domain.categoryCode,
          domain.ontologyGroup,
          domain.answerStrategy,
          ...(domain.intentKeywords || []),
          ...(domain.requiredSlots || []),
          ...flattenDataIndexTerms(dataIndex),
          ...linkedSources.flatMap((source) => [source.title, source.provider, source.query, source.tier])
        ]),
        summary: domain.answerStrategy || `${domain.label || domainCode} 도메인 규정 조회`
      };
    });

    const dataIndexEntries = Object.entries(knowledgeBase.domains || {}).flatMap(([domainCode, domain]) => {
      const dataIndex = getDomainDataIndex(knowledgeBase, domainCode, domain);
      if (!dataIndex) return [];
      const domainLabel = domain.label || domainCode;
      const profileEntry = {
        id: `index:${domainCode}`,
        type: "dataIndexProfile",
        domainCode,
        categoryCode: domain.categoryCode || "",
        ontologyGroup: domain.ontologyGroup || "",
        title: `${domainLabel} 전문 색인`,
        sourceTier: "localDb",
        dataIndex,
        terms: uniqueStrings([
          domainCode,
          domainLabel,
          domain.categoryCode,
          domain.ontologyGroup,
          ...flattenDataIndexTerms(dataIndex)
        ]),
        summary: `${domainLabel} 질문을 대상자·세부 주제·증빙·출처 우선순위로 연결하는 색인`
      };
      const gapEntries = (dataIndex.dataGrowthTargets || []).map((target, index) => ({
        id: `gap:${domainCode}:${index + 1}`,
        type: "dataGapCandidate",
        domainCode,
        categoryCode: domain.categoryCode || "",
        ontologyGroup: domain.ontologyGroup || "",
        title: `${domainLabel} 추가 수집 후보`,
        sourceTier: "userContext",
        dataGrowthTarget: target,
        terms: uniqueStrings([
          domainCode,
          domainLabel,
          target,
          ...(dataIndex.subtopics || []),
          ...(dataIndex.questionPatterns || []),
          ...(dataIndex.sourceTargets || [])
        ]),
        summary: `${target} 자료가 부족하면 공식자료·학교규정 수집 후보로 기록`
      }));
      return [profileEntry, ...gapEntries];
    });

    const sourceEntries = Object.entries(registry.officialSources || {}).flatMap(([sourceKey, source]) => {
      const domains = (source.domains || ["*"]).includes("*")
        ? Object.keys(knowledgeBase.domains || {})
        : source.domains || [];
      return domains.map((domainCode) => ({
        id: `source:${sourceKey}:${domainCode}`,
        type: "officialSource",
        sourceKey,
        domainCode,
        categoryCode: knowledgeBase.domains?.[domainCode]?.categoryCode || "",
        ontologyGroup: knowledgeBase.domains?.[domainCode]?.ontologyGroup || "",
        title: source.title || sourceKey,
        provider: source.provider || "",
        sourceTier: source.tier || "mixed",
        query: source.query || "",
        terms: uniqueStrings([
          sourceKey,
          source.title,
          source.provider,
          source.tier,
          source.query,
          domainCode,
          knowledgeBase.domains?.[domainCode]?.label,
          ...(knowledgeBase.domains?.[domainCode]?.intentKeywords || [])
        ]),
        summary: `${source.title || sourceKey} 원문·지침 후보`
      }));
    });

    const ontologyEntries = Object.entries(knowledgeBase.schoolPolicyOntology?.commonSlots || {}).map(([slotName, description]) => ({
      id: `slot:${slotName}`,
      type: "slotDefinition",
      slotName,
      title: slotName,
      sourceTier: "userContext",
      terms: uniqueStrings([slotName, description]),
      summary: description
    }));

    const collectionEntries = (registry.collectionJobs || []).map((job) => ({
      id: `collection:${job.code}`,
      type: "collectionJob",
      title: job.code,
      sourceTier: (job.targetTiers || []).join(","),
      terms: uniqueStrings([job.code, job.connector, job.cadence, job.output, ...(job.targetTiers || [])]),
      summary: `${job.connector} -> ${job.output}`
    }));

    return [...domainEntries, ...dataIndexEntries, ...sourceEntries, ...ontologyEntries, ...collectionEntries];
  }

  function search(query = "", options = {}) {
    const normalizedQuery = compactText(query);
    const semanticFrame = options.semanticFrame || null;
    const limit = Number(options.limit || 8);
    const domainCode = options.domainCode || semanticFrame?.domainCode || "";
    const slotTerms = semanticFrame ? flattenSlotTerms(semanticFrame.slots || {}) : [];
    const taskCode = semanticFrame?.task?.code || "";
    const queryTerms = uniqueStrings([
      normalizedQuery,
      domainCode,
      taskCode,
      ...(semanticFrame?.domainCandidates?.[0]?.matchedKeywords || []),
      ...slotTerms
    ]);

    return entries
      .filter((entry) => !domainCode || !entry.domainCode || entry.domainCode === domainCode)
      .map((entry) => ({
        ...entry,
        score: scoreEntry(entry, queryTerms, domainCode)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function scoreEntry(entry, queryTerms, domainCode) {
    const entryText = compactText([entry.id, entry.title, entry.summary, entry.query, ...(entry.terms || [])].join(" "));
    let score = 0;
    if (domainCode && entry.domainCode === domainCode) score += 16;
    if (domainCode && entry.id === `domain:${domainCode}`) score += 12;
    if (domainCode && entry.id === `index:${domainCode}`) score += 10;
    for (const term of queryTerms) {
      const normalizedTerm = compactText(term);
      if (!normalizedTerm) continue;
      if (entryText.includes(normalizedTerm)) score += Math.max(1, Math.min(8, normalizedTerm.length));
      else if (normalizedTerm.includes(entry.domainCode || "__no_domain__")) score += 4;
    }
    if (entry.type === "domainProfile") score += 2;
    if (entry.type === "dataIndexProfile") score += 3;
    if (entry.type === "dataGapCandidate") score += 1;
    if (entry.type === "officialSource") score += 1;
    return score;
  }

  function flattenSlotTerms(slots = {}) {
    return Object.entries(slots).flatMap(([slotName, value]) => {
      if (!value) return [slotName];
      if (Array.isArray(value)) return [slotName, ...value];
      if (typeof value === "object") {
        return [
          slotName,
          value.code,
          value.label,
          value.roleLabel,
          value.subjectLabel,
          value.regionGroup,
          ...(value.items || []).flatMap((item) => [item.code, item.label])
        ];
      }
      return [slotName, String(value)];
    });
  }

  function compactText(value) {
    return String(value || "").replace(/\s+/g, "");
  }

  function getDomainDataIndex(knowledgeBase, domainCode, domain = {}) {
    const index = domain.dataIndex || knowledgeBase.schoolPolicyOntology?.specializedDataIndex?.[domainCode] || null;
    if (index) return index;
    if (!domain.ontologyGroup) return null;
    return {
      audiences: ["student", "parent", "teacher", "manager"],
      subtopics: [domain.label, ...(domain.intentKeywords || []).slice(0, 8)],
      questionPatterns: (domain.intentKeywords || []).slice(0, 5).map((keyword) => `${keyword} 기준은 무엇인가요`),
      evidence: domain.requiredSlots || [],
      sourceTargets: domain.sourceKeys || [],
      dataGrowthTargets: [`${domain.label || domainCode} 교육청 지침`, `${domain.label || domainCode} 학교 내부 규정`, `${domain.label || domainCode} 사례·서식`],
      clarificationSlots: domain.requiredSlots || []
    };
  }

  function flattenDataIndexTerms(dataIndex = null) {
    if (!dataIndex) return [];
    return [
      ...(dataIndex.audiences || []),
      ...(dataIndex.subtopics || []),
      ...(dataIndex.questionPatterns || []),
      ...(dataIndex.evidence || []),
      ...(dataIndex.sourceTargets || []),
      ...(dataIndex.dataGrowthTargets || []),
      ...(dataIndex.clarificationSlots || [])
    ];
  }

  function uniqueStrings(items = []) {
    return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  return {
    version: "20260608-policy-corpus-v1",
    knowledgeBaseVersion: KB.version,
    sourceRegistryVersion: REGISTRY.version,
    stats: {
      entries: entries.length,
      domains: Object.keys(KB.domains || {}).length,
      officialSources: Object.keys(REGISTRY.officialSources || {}).length,
      collectionJobs: (REGISTRY.collectionJobs || []).length
    },
    entries,
    search,
    internals: { buildCorpusEntries, scoreEntry, flattenSlotTerms, getDomainDataIndex, flattenDataIndexTerms }
  };
});
