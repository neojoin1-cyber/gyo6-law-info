import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const sourceRegistry = require("../public/policy-source-registry.js");
const knowledgeBase = require("../public/policy-knowledge-base.js");
const currentIndex = require("../public/public-resource-index-generated.js");

const generatedAt = new Date();
const currentYear = generatedAt.getFullYear();
const academicYears = buildAcademicYears(generatedAt);
const outDir = path.join(rootDir, "data", "policy-quality");
const HARVEST_ENABLED = process.env.PUBLIC_RESOURCE_HARVEST_OFFICIAL !== "0";
const HARVEST_FETCH_TIMEOUT_MS = Number(process.env.PUBLIC_RESOURCE_HARVEST_TIMEOUT_MS || 14000);
const HARVEST_DETAIL_LIMIT = Number(process.env.PUBLIC_RESOURCE_HARVEST_DETAIL_LIMIT || 140);
const HARVEST_LIST_LIMIT = Number(process.env.PUBLIC_RESOURCE_HARVEST_LIST_LIMIT || 90);
const HARVEST_CONCURRENCY = Number(process.env.PUBLIC_RESOURCE_HARVEST_CONCURRENCY || 4);
const DOCUMENT_FILE_PATTERN = /\.(pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/i;
const NON_DOCUMENT_FILE_PATTERN = /\.(jpg|jpeg|png|gif|webp|mp3|mp4|avi|wmv|mov|zip)(\?|#|$)/i;
const EMBEDDED_FORM_PATTERN = /서식|양식|신청서|보고서|동의서|협약서|계약서|점검표|체크리스트|기록|대장|조서|품의|검수|정산|부록|붙임|별지|서식모음/i;

const OFFICIAL_FILE_HARVEST_SOURCES = [
  {
    code: "gbe-student-life",
    label: "경북교육청 학생생활과 자료실",
    provider: "경상북도교육청 학생생활과",
    origin: "https://www.gbe.kr",
    listPath: "/dep_stu/na/ntt/selectNttList.do",
    infoPath: "/dep_stu/na/ntt/selectNttInfo.do",
    mi: "8671",
    bbsId: "2693",
    category: "studentLife",
    terms: ["교외체험학습", "학교폭력", "학교폭력 사안처리", "학생생활규정", "생활지도", "학생선도", "상담 기록", "아동학대", "성폭력", "딥페이크", "체크리스트", "관련 서식"]
  },
  {
    code: "gbe-school-accounting",
    label: "경북교육청 학교회계 안내·지침서",
    provider: "경상북도교육청",
    origin: "https://www.gbe.kr",
    listPath: "/main/na/ntt/selectNttList.do",
    infoPath: "/main/na/ntt/selectNttInfo.do",
    mi: "3372",
    bbsId: "1852",
    category: "schoolAdmin",
    terms: ["예산편성", "학교회계", "강사수당", "강사료", "수익자부담", "품의", "검수", "지출", "계약", "정산 서식"]
  },
  {
    code: "gbe-integrated-library",
    label: "경북교육청 통합자료실",
    provider: "경상북도교육청",
    origin: "https://www.gbe.kr",
    listPath: "/main/na/ntt/selectNttList.do",
    infoPath: "/main/na/ntt/selectNttInfo.do",
    mi: "9138",
    bbsId: "2852",
    category: "general",
    terms: ["직업계고", "특성화고", "현장실습", "표준협약서", "취업지원", "NCS", "도제학교", "일학습병행", "개인정보보호", "정보공개", "학교운영", "서식", "점검표"]
  },
  {
    code: "gbe-field-trip",
    label: "경북교육청 현장체험학습 자료실",
    provider: "경상북도교육청",
    origin: "https://www.gbe.kr",
    listPath: "/main/na/ntt/selectNttList.do",
    infoPath: "/main/na/ntt/selectNttInfo.do",
    mi: "3432",
    bbsId: "1875",
    category: "studentLife",
    terms: ["현장체험학습", "수학여행", "수련활동", "안전계획", "동의서", "보고서", "체험학습", "서식", "부록 서식"]
  },
  {
    code: "gbe-staff-personnel",
    label: "경북교육청 인사정보 자료실",
    provider: "경상북도교육청",
    origin: "https://www.gbe.kr",
    listPath: "/main/na/ntt/selectNttList.do",
    infoPath: "/main/na/ntt/selectNttInfo.do",
    mi: "3531",
    bbsId: "1880",
    category: "staffLabor",
    terms: ["계약제교원", "기간제교사", "복무", "휴가", "근무상황", "교육공무직 취업규칙", "교육공무직 단체협약", "계약제교원 운영 지침"]
  },
  {
    code: "gbe-health-response",
    label: "경북교육청 감염병 대응지침",
    provider: "경상북도교육청",
    origin: "https://www.gbe.kr",
    listPath: "/main/na/ntt/selectNttList.do",
    infoPath: "/main/na/ntt/selectNttInfo.do",
    mi: "9245",
    bbsId: "2885",
    category: "schoolViolenceSafety",
    terms: ["감염병", "등교중지", "보건", "대응지침", "학교보건", "마스크"]
  },
  {
    code: "gbe-school-committee",
    label: "경북교육청 학교운영위원회 자료실",
    provider: "경상북도교육청",
    origin: "https://www.gbe.kr",
    listPath: "/main/na/ntt/selectNttList.do",
    infoPath: "/main/na/ntt/selectNttInfo.do",
    mi: "3735",
    bbsId: "1901",
    category: "schoolAdmin",
    terms: ["학교운영위원회", "회의록", "심의", "규정", "학칙", "위원회"]
  },
  {
    code: "hifive-education-library",
    label: "하이파이브 교육자료실",
    provider: "교육부·하이파이브",
    origin: "https://www.hifive.go.kr",
    kind: "hifive-bbs",
    listPath: "/front/bbs/bbsList.do",
    infoPath: "/front/bbs/bbsDetail.do",
    bbsId: "87",
    rootMenuId: "04",
    menuId: "0403",
    category: "fieldTraining",
    terms: ["", "직업계고 현장실습", "현장실습 공통 매뉴얼", "서식모음집", "산업안전 매뉴얼", "실습일지", "직업계고 학점제", "NCS 교육과정"]
  }
];

const RESOURCE_AUTOPILOT_MISSIONS = [
  {
    category: "fieldTraining",
    label: "현장실습·직업교육",
    minPublic: 36,
    minDirect: 8,
    domainHints: ["vocationalFieldTrainingOperation", "vocationalCurriculumNcs", "labEquipmentPracticeSafety", "careerEmploymentGuidance"],
    seeds: [
      seed("guide", "직업계고 현장실습 운영 매뉴얼", "교육부·시도교육청", "직업계고 현장실습 운영 매뉴얼 학생 보호 산업체 선정", "hifive.go.kr", true),
      seed("form", "현장실습 표준협약서·운영 서식", "교육부·시도교육청", "현장실습 표준협약서 참여 동의서 순회지도 상담 기록 서식", "hifive.go.kr", true),
      seed("guide", "직업계고 취업지원·채용연계 운영 자료", "교육부·시도교육청", "직업계고 취업지원 채용연계 운영 자료 고졸채용", "moe.go.kr", true),
      seed("rule", "NCS 실무과목·전문교과 운영 기준", "교육부·시도교육청", "직업계고 NCS 실무과목 전문교과 교육과정 운영 지침", "moe.go.kr", true)
    ]
  },
  {
    category: "studentLife",
    label: "학생생활·학적",
    minPublic: 32,
    minDirect: 8,
    domainHints: ["studentRecordsAttendance", "fieldExperienceLearning", "assessmentAcademicManagement", "admissionsTransferGraduation", "classManagementGuidance"],
    seeds: [
      seed("guide", "학교생활기록부 기재요령", "교육부·학교생활기록부 종합지원포털", "학교생활기록부 기재요령 출결 정정 평가 창의적 체험활동", "star.moe.go.kr", true),
      seed("rule", "학교생활기록 작성 및 관리지침", "교육부·국가법령정보센터", "학교생활기록 작성 및 관리지침 출결 정정 보존", "law.go.kr", true),
      seed("guide", "학교장허가 교외체험학습 운영 지침", "교육부·시도교육청", "학교장허가 교외체험학습 운영 지침 신청서 보고서", "moe.go.kr", true),
      seed("rule", "학업성적관리 시행지침", "교육부·시도교육청", "학업성적관리 시행지침 평가 이의신청 인정점", "moe.go.kr", true)
    ]
  },
  {
    category: "schoolViolenceSafety",
    label: "학교폭력·안전",
    minPublic: 34,
    minDirect: 8,
    domainHints: ["schoolViolenceProcedure", "schoolSafetyHealth", "labEquipmentPracticeSafety", "schoolMealOperation"],
    seeds: [
      seed("guide", "학교폭력 사안처리 가이드북", "교육부·시도교육청", "학교폭력 사안처리 가이드북 접수 전담기구 심의 피해학생 보호", "moe.go.kr", true),
      seed("form", "학교폭력 사안 접수·조사·상담 서식", "교육부·시도교육청", "학교폭력 사안 접수 조사 상담 기록 보호조치 서식", "moe.go.kr", true),
      seed("guide", "학교안전사고 예방·보상 업무 자료", "교육부·학교안전공제중앙회", "학교안전사고 예방 보상 사고보고 학교안전공제 자료", "schoolsafe.or.kr", true),
      seed("guide", "산업안전보건·실습실 안전 자료", "고용노동부·안전보건공단", "학교 실습실 산업안전보건 위험성평가 보호구 MSDS", "kosha.or.kr", true)
    ]
  },
  {
    category: "staffLabor",
    label: "교직원 복무·노무",
    minPublic: 32,
    minDirect: 8,
    domainHints: ["staffAttendanceService", "bereavementLeave", "teacherRightsProtection", "parentComplaintResponse"],
    seeds: [
      seed("rule", "교원휴가에 관한 예규", "교육부·국가법령정보센터", "교원휴가에 관한 예규 연가 병가 공가 특별휴가", "law.go.kr", true),
      seed("rule", "국가공무원 복무규정", "국가법령정보센터", "국가공무원 복무규정 복무 휴가 출장", "law.go.kr", true),
      seed("guide", "교육공무직 취업규칙·단체협약", "시도교육청", "교육공무직 취업규칙 단체협약 복무 임금 휴가", "moe.go.kr", true),
      seed("form", "나이스 근무상황·휴가 증빙 서식", "교육부·시도교육청", "나이스 근무상황 휴가 증빙자료 신청 승인 서식", "moe.go.kr", true)
    ]
  },
  {
    category: "schoolAdmin",
    label: "학교회계·행정",
    minPublic: 30,
    minDirect: 7,
    domainHints: ["budgetAccountingContract", "facilityDigitalSecurity", "governanceCommitteeRule", "afterSchoolChildcare"],
    seeds: [
      seed("guide", "학교회계 예산편성 기본지침", "시도교육청", "학교회계 예산편성 기본지침 세출 예산 결산", "moe.go.kr", true),
      seed("rule", "지방자치단체 입찰 및 계약집행기준", "행정안전부·국가법령정보센터", "지방자치단체 입찰 및 계약집행기준 수의계약", "law.go.kr", true),
      seed("form", "학교회계 품의·검수·지출 증빙 서식", "시도교육청", "학교회계 품의 검수 지출 증빙 서식", "moe.go.kr", true),
      seed("guide", "학교운영위원회·규정 개정 자료", "교육부·시도교육청", "학교운영위원회 학칙 규정 개정 회의록 자료", "moe.go.kr", true)
    ]
  },
  {
    category: "privacyRecords",
    label: "개인정보·기록",
    minPublic: 24,
    minDirect: 6,
    domainHints: ["facilityDigitalSecurity", "parentComplaintResponse"],
    seeds: [
      seed("law", "개인정보 보호법", "국가법령정보센터", "개인정보 보호법 학교 개인정보 처리 영상정보처리기기", "law.go.kr", true),
      seed("guide", "학교 개인정보보호 업무 자료", "개인정보보호위원회·교육부", "학교 개인정보보호 업무 사례 처리 동의 파기", "pipc.go.kr", true),
      seed("rule", "공공기록물 관리 기준", "국가기록원·국가법령정보센터", "공공기록물 관리 학교 회의록 공문서 보존", "law.go.kr", true),
      seed("guide", "정보공개·비공개 판단 자료", "행정안전부·국가법령정보센터", "정보공개 비공개 부분공개 개인정보 학교 민원", "law.go.kr", true)
    ]
  },
  {
    category: "careerEmployment",
    label: "취업·진로",
    minPublic: 24,
    minDirect: 5,
    domainHints: ["careerEmploymentGuidance", "vocationalFieldTrainingOperation"],
    seeds: [
      seed("guide", "고졸채용·직업계고 채용연계 자료", "교육부·고용노동부", "고졸채용 직업계고 채용연계 취업지원 자료", "moe.go.kr", true),
      seed("guide", "공공기관 고졸채용 정보 확인 자료", "기획재정부·잡알리오", "공공기관 고졸채용 채용형 인턴 직업계고 잡알리오", "job.alio.go.kr", true),
      seed("form", "취업추천·현장실습 전환 관련 서식", "교육부·시도교육청", "직업계고 취업추천 현장실습 전환 채용 서식", "hifive.go.kr", true)
    ]
  },
  {
    category: "general",
    label: "공통·기타",
    minPublic: 20,
    minDirect: 5,
    domainHints: ["healthInfectionCounseling", "specialEducationSupport", "scholarshipWelfareSupport"],
    seeds: [
      seed("law", "초·중등교육법", "국가법령정보센터", "초중등교육법 학생 지도 학칙 학교운영", "law.go.kr", true),
      seed("guide", "특수교육대상자 지원 자료", "교육부·시도교육청", "특수교육대상자 개별화교육 통합교육 지원 자료", "moe.go.kr", true),
      seed("guide", "교육급여·교육비 지원 기준", "교육부·시도교육청", "교육급여 교육비 지원 장학금 교복비 통학비 기준", "moe.go.kr", true),
      seed("form", "민원·상담 기록 서식", "교육부·시도교육청", "학교 민원 상담 기록 보호자 안내 서식", "moe.go.kr", true)
    ]
  }
];

const existingResources = normalizeExistingResources(currentIndex.resources || []);
const missionReports = RESOURCE_AUTOPILOT_MISSIONS.map((mission) => buildMissionReport(mission));
const harvestedFileCandidates = await buildHarvestedOfficialFileCandidates();
const candidates = dedupeCandidates([
  ...harvestedFileCandidates,
  ...RESOURCE_AUTOPILOT_MISSIONS.flatMap(buildMissionCandidates),
  ...buildKnowledgeBaseGapCandidates(),
  ...buildRegistryUpgradeCandidates()
]).sort(compareCandidates);

const payload = {
  version: `generated-${generatedAt.toISOString().replace(/[:.]/g, "-")}`,
  generatedAt: generatedAt.toISOString(),
  currentYear,
  academicYears,
  stats: {
    existingResources: existingResources.length,
    missions: missionReports.length,
    candidates: candidates.length,
    publicCandidates: candidates.filter((item) => item.includeInLibrary).length,
    harvestedFiles: harvestedFileCandidates.length,
    highPriority: candidates.filter((item) => item.priority === "high").length,
    directUrlNeeded: candidates.filter((item) => item.needsDirectUrl).length,
    byCategory: candidates.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {})
  },
  missions: missionReports,
  candidates
};

await writeOutputs(payload);

console.log(`Public resource autopilot generated: ${payload.stats.candidates} candidates`);
console.log(`Public library candidates: ${payload.stats.publicCandidates}`);
console.log(`Official files harvested: ${payload.stats.harvestedFiles}`);
console.log(`Direct URL needed: ${payload.stats.directUrlNeeded}`);
console.log(`Weakest mission: ${missionReports[0]?.label || "none"} (${missionReports[0]?.coverageScore ?? 0})`);

function seed(type, title, provider, query, searchDomain, publicReady = false) {
  return { type, title, provider, query, searchDomain, publicReady };
}

function buildAcademicYears(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return uniqueStrings(month >= 9 ? [year, year + 1] : [year, year - 1]).sort((a, b) => b - a);
}

function normalizeExistingResources(resources = []) {
  return resources.map((item) => ({
    id: cleanText(item.id),
    type: normalizeType(item.type),
    category: cleanText(item.category),
    title: cleanText(item.title),
    provider: cleanText(item.provider),
    query: cleanText(item.query),
    description: cleanText(item.description),
    url: cleanText(item.url),
    searchUrl: cleanText(item.searchUrl),
    linkKind: cleanText(item.linkKind || inferLinkKind(item.url)),
    searchDomain: getDomainFromUrl(item.searchUrl || item.url),
    normalizedText: normalizeSearchText([item.category, item.hierarchy?.level2, item.hierarchy?.level3, item.title, item.provider, item.query, item.description].join(" "))
  }));
}

function buildMissionReport(mission) {
  const related = existingResources.filter((resource) => isMissionRelatedResource(resource, mission));
  const direct = related.filter((resource) => resource.linkKind && resource.linkKind !== "search");
  const byType = related.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  const missingTypes = ["law", "rule", "guide", "form"].filter((type) => (byType[type] || 0) < minTypeCount(type));
  const coverageScore = Math.min(100, Math.round(
    (Math.min(1, related.length / mission.minPublic) * 55)
    + (Math.min(1, direct.length / mission.minDirect) * 30)
    + ((4 - missingTypes.length) / 4 * 15)
  ));
  return {
    category: mission.category,
    label: mission.label,
    existing: related.length,
    directCount: direct.length,
    byType,
    missingTypes,
    minPublic: mission.minPublic,
    minDirect: mission.minDirect,
    coverageScore,
    status: coverageScore >= 85 ? "healthy" : coverageScore >= 65 ? "watch" : "needs_acquisition"
  };
}

function buildMissionCandidates(mission) {
  const report = missionReports.find((item) => item.category === mission.category) || buildMissionReport(mission);
  const priority = report.coverageScore < 65 ? "high" : report.coverageScore < 85 ? "normal" : "low";
  return mission.seeds.flatMap((baseSeed) => expandSeedByYears(baseSeed).map((expanded) => {
    const score = scoreCandidate(expanded, mission, report);
    return normalizeCandidate({
      ...expanded,
      id: `mission:${mission.category}:${expanded.type}:${expanded.searchDomain}:${expanded.title}`,
      category: mission.category,
      missionLabel: mission.label,
      priority,
      reason: `${mission.label} 자료실 확보 목표 ${report.existing}/${mission.minPublic}, 직접 원문 ${report.directCount}/${mission.minDirect}`,
      source: "mission-seed",
      qualityScore: score,
      includeInLibrary: Boolean(expanded.publicReady && score >= 80),
      needsDirectUrl: score < 90 || !hasDirectExistingMatch(expanded)
    });
  }));
}

function expandSeedByYears(baseSeed) {
  const needsYear = /기재요령|가이드북|운영|지침|예산편성|취업지원|현장실습|학업성적관리|교육과정|학교폭력|서식/.test(baseSeed.title + baseSeed.query);
  if (!needsYear) {
    return [baseSeed];
  }
  return academicYears.map((year) => ({
    ...baseSeed,
    title: `${year} ${baseSeed.title}`,
    query: `${year} ${baseSeed.query}`
  }));
}

function buildKnowledgeBaseGapCandidates() {
  const domains = knowledgeBase.domains || {};
  return Object.entries(domains).flatMap(([domainCode, domain]) => {
    const domainLabel = cleanText(domain.label || domainCode);
    const current = existingResources.filter((resource) => {
      const text = resource.normalizedText;
      return text.includes(normalizeSearchText(domainLabel))
        || (domain.intentKeywords || []).some((keyword) => text.includes(normalizeSearchText(keyword)));
    });
    if (current.length >= 5) {
      return [];
    }
    const category = inferCategoryFromDomain(domainCode, domain);
    return [
      normalizeCandidate({
        id: `kb-gap:${domainCode}:guide`,
        category,
        type: "guide",
        title: `${academicYears[0]} ${domainLabel} 공식 지침`,
        provider: "교육부·시도교육청",
        query: `${academicYears[0]} ${domainLabel} 공식 지침 ${uniqueStrings(domain.intentKeywords || []).slice(0, 4).join(" ")}`,
        searchDomain: inferDomainForCategory(category),
        priority: "normal",
        reason: `${domainLabel} 도메인의 자료실 후보가 ${current.length}건으로 부족함`,
        source: "knowledge-base-gap",
        qualityScore: 72,
        includeInLibrary: false,
        needsDirectUrl: true
      }),
      normalizeCandidate({
        id: `kb-gap:${domainCode}:form`,
        category,
        type: "form",
        title: `${domainLabel} 신청·점검·상담 서식`,
        provider: "교육부·시도교육청",
        query: `${domainLabel} 신청서 점검표 상담 기록 서식`,
        searchDomain: inferDomainForCategory(category),
        priority: "low",
        reason: `${domainLabel} 도메인의 실무 서식 후보 자동 보강`,
        source: "knowledge-base-gap",
        qualityScore: 68,
        includeInLibrary: false,
        needsDirectUrl: true
      })
    ];
  });
}

function buildRegistryUpgradeCandidates() {
  return Object.entries(sourceRegistry.officialSources || {}).flatMap(([sourceKey, source]) => {
    const title = cleanText(source.title || sourceKey);
    const category = inferCategoryFromDomains(source.domains || []);
    const hasDirectUrl = Boolean(cleanText(source.url || source.supportUrl || source.homepage));
    if (hasDirectUrl) {
      return [];
    }
    return [normalizeCandidate({
      id: `registry-upgrade:${sourceKey}`,
      category,
      type: normalizeType(source.type || source.tier),
      title: `${title} 원문 직접 연결 보강`,
      provider: cleanText(source.provider || "공식자료"),
      query: cleanText(source.query || title),
      searchDomain: inferSearchDomainFromSource(source),
      priority: "normal",
      reason: "공식 출처 레지스트리에 직접 URL이 없어 자동 원문 보강 대상",
      source: "registry-direct-url-gap",
      qualityScore: 74,
      includeInLibrary: false,
      needsDirectUrl: true
    })];
  });
}

async function buildHarvestedOfficialFileCandidates() {
  if (!HARVEST_ENABLED || typeof fetch !== "function") {
    return [];
  }

  const listTargets = OFFICIAL_FILE_HARVEST_SOURCES.flatMap((source) =>
    source.terms.map((term) => ({
      source,
      term,
      url: buildOfficialListSearchUrl(source, term)
    }))
  ).slice(0, HARVEST_LIST_LIMIT);

  const discovered = new Map();
  const seededDetails = buildSeededHarvestDetailTargets();
  seededDetails.forEach((target) => {
    discovered.set(target.detailUrl, target);
  });

  const listResults = await mapWithConcurrency(listTargets, HARVEST_CONCURRENCY, async (target) => {
    const html = await fetchText(target.url);
    return extractDetailTargetsFromList(html, target.source, target.term);
  });

  listResults.flat().forEach((target) => {
    if (target.detailUrl && !discovered.has(target.detailUrl)) {
      discovered.set(target.detailUrl, target);
    }
  });

  const detailTargets = [...discovered.values()].slice(0, HARVEST_DETAIL_LIMIT);
  const detailResults = await mapWithConcurrency(detailTargets, HARVEST_CONCURRENCY, harvestOfficialDetailFiles);
  return detailResults.flat();
}

function buildSeededHarvestDetailTargets() {
  return Object.entries(sourceRegistry.officialSources || {}).flatMap(([key, source]) => {
    return [source.url, source.supportUrl]
      .filter(Boolean)
      .filter((url) => isOfficialHarvestPageUrl(url))
      .map((url) => {
        const parsed = new URL(url);
        return {
          source: {
            code: `registry-${key}`,
            label: source.title || key,
            provider: source.provider || getProviderForTier(source.tier),
            category: inferCategoryFromDomains(source.domains || []),
            origin: `${parsed.protocol}//${parsed.host}`
          },
          term: source.query || source.title || key,
          detailUrl: url,
          nttSn: parsed.searchParams.get("nttSn") || ""
        };
      });
  });
}

function buildOfficialListSearchUrl(source, term) {
  if (source.kind === "hifive-bbs") {
    const url = new URL(source.listPath, source.origin);
    url.searchParams.set("auth_type", "M2");
    url.searchParams.set("auth_type_bbs_id", "");
    url.searchParams.set("bbs_id", source.listBbsId || "");
    url.searchParams.set("menuId", source.menuId || "0403");
    url.searchParams.set("rootMenuId", source.rootMenuId || "04");
    url.searchParams.set("search_auth_type", "M2");
    if (term) {
      url.searchParams.set("search_code", "title");
      url.searchParams.set("search_text", term);
    }
    return url.href;
  }
  const url = new URL(source.listPath, source.origin);
  url.searchParams.set("mi", source.mi);
  url.searchParams.set("bbsId", source.bbsId);
  url.searchParams.set("searchType", "sj");
  url.searchParams.set("searchValue", term);
  return url.href;
}

function extractDetailTargetsFromList(html = "", source = {}, term = "") {
  if (!html) {
    return [];
  }

  if (source.kind === "hifive-bbs") {
    return [...html.matchAll(/funcGoDetail\('([^']+)','([^']+)','([^']+)'\)[\s\S]*?title="([^"]+)"/gi)]
      .map((match) => ({
        source,
        term,
        nttSn: match[1],
        bbsId: match[2],
        title: decodeHtml(match[4]),
        detailUrl: buildOfficialDetailUrl({ ...source, bbsId: match[2] }, match[1])
      }))
      .filter((item) => item.detailUrl);
  }

  const ids = uniqueStrings([...html.matchAll(/listFileDown["']?\s*[^>]*data-id=["']?(\d+)|listFileDown(\d+)/gi)]
    .map((match) => match[1] || match[2])
    .filter(Boolean));

  return ids.map((nttSn) => ({
    source,
    term,
    nttSn,
    detailUrl: buildOfficialDetailUrl(source, nttSn)
  })).filter((item) => item.detailUrl);
}

function buildOfficialDetailUrl(source = {}, nttSn = "") {
  if (source.kind === "hifive-bbs") {
    if (!source.origin || !source.infoPath || !source.bbsId || !nttSn) {
      return "";
    }
    const url = new URL(source.infoPath, source.origin);
    url.searchParams.set("bbs_id", source.bbsId);
    url.searchParams.set("auth_type_bbs_id", "");
    url.searchParams.set("search_auth_type", "M2");
    url.searchParams.set("auth_type", "M2");
    url.searchParams.set("rootMenuId", source.rootMenuId || "04");
    url.searchParams.set("menuId", source.menuId || "0403");
    url.searchParams.set("currpage", "1");
    url.searchParams.set("bbs_seq", nttSn);
    url.searchParams.set("passwd", "");
    return url.href;
  }
  if (!source.origin || !source.infoPath || !source.mi || !source.bbsId || !nttSn) {
    return "";
  }
  const url = new URL(source.infoPath, source.origin);
  url.searchParams.set("mi", source.mi);
  url.searchParams.set("bbsId", source.bbsId);
  url.searchParams.set("nttSn", nttSn);
  return url.href;
}

async function harvestOfficialDetailFiles(target = {}) {
  const html = await fetchText(target.detailUrl);
  if (!html) {
    return [];
  }

  const detailTitle = extractDetailTitle(html) || target.title || target.term;
  return extractOfficialFileLinks(html, target)
    .filter((file) => isUsefulOfficialDocument(file.fileName, file.url, detailTitle))
    .map((file, index) => {
      const text = `${detailTitle} ${file.fileName} ${target.term}`;
      const type = inferHarvestedResourceType(text);
      const embeddedFormCandidate = type === "form" || EMBEDDED_FORM_PATTERN.test(text);
      return normalizeCandidate({
        id: `harvest:${target.source.code || "official"}:${target.nttSn || stableId(target.detailUrl)}:${index}:${file.fileName}`,
        category: inferCategoryFromText([target.source.category, detailTitle, file.fileName, target.term].join(" ")),
        type,
        title: buildHarvestedResourceTitle(detailTitle, file.fileName),
        provider: target.source.provider || providerFromUrl(target.detailUrl),
        query: uniqueStrings([target.term, detailTitle, file.fileName]).join(" "),
        url: file.url,
        searchDomain: getDomainFromUrl(file.url),
        description: `${target.source.label || "공식자료실"}에서 확인한 첨부 원문 파일`,
        priority: "high",
        source: "official-file-harvest",
        missionLabel: target.source.label || "",
        reason: "공식 게시글 상세 화면에서 첨부파일 직접 URL을 추출",
        qualityScore: 98,
        includeInLibrary: true,
        needsDirectUrl: false,
        extraction: {
          embeddedFormCandidate,
          originalFileUrl: file.url,
          status: embeddedFormCandidate ? "queued_for_verified_pdf_docx_split" : "source_only",
          outputFormats: embeddedFormCandidate ? ["pdf", "docx"] : []
        }
      });
    });
}

function extractOfficialFileLinks(html = "", target = {}) {
  const origin = target.source?.origin || getOrigin(target.detailUrl);
  const files = [];
  const addFile = (fileName = "", rawUrl = "") => {
    const cleanName = cleanText(decodeHtml(fileName));
    const absolute = toAbsoluteUrl(rawUrl, origin);
    if (!cleanName || !absolute || !isDirectCandidateUrl(absolute)) {
      return;
    }
    files.push({ fileName: cleanName, url: absolute });
  };

  for (const match of html.matchAll(/AddUploadedFile\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/gi)) {
    addFile(match[1], match[2]);
  }

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*(?:fileDownload\.do|\/upload\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = cleanText(stripHtml(match[2]));
    addFile(text || extractFileNameFromUrl(match[1]), match[1]);
  }

  for (const match of html.matchAll(/funcFiledownload\('([^']+)','([^']+)','([^']+)'\)/gi)) {
    const url = new URL("/common/FileDown.do", origin);
    url.searchParams.set("filepath", decodeHtml(match[1]));
    url.searchParams.set("filerealname", decodeHtml(match[2]));
    url.searchParams.set("filename", decodeHtml(match[3]));
    addFile(match[2], url.href);
  }

  return dedupeHarvestedFiles(files);
}

function extractDetailTitle(html = "") {
  const thMatch = html.match(/<th\b[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/th>/i);
  if (thMatch) {
    return cleanText(stripHtml(thMatch[1]));
  }
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? cleanText(stripHtml(titleMatch[1]).replace(/^[^-]+-/, "")) : "";
}

function buildHarvestedResourceTitle(detailTitle = "", fileName = "") {
  const cleanTitle = cleanText(detailTitle);
  const cleanFile = cleanText(fileName.replace(/\.(pdf|hwp|hwpx|docx?|xlsx?|pptx?)$/i, ""));
  if (!cleanTitle) return cleanFile;
  if (!cleanFile || normalizeSearchText(cleanTitle).includes(normalizeSearchText(cleanFile).slice(0, 12))) {
    return cleanTitle;
  }
  return `${cleanTitle} - ${cleanFile}`;
}

function inferHarvestedResourceType(text = "") {
  if (EMBEDDED_FORM_PATTERN.test(text)) {
    return "form";
  }
  if (/규정|규칙|고시|예규|훈령|단체협약|취업규칙/.test(text)) {
    return "rule";
  }
  return "guide";
}

function isUsefulOfficialDocument(fileName = "", url = "", title = "") {
  const text = `${fileName} ${url} ${title}`;
  if (!DOCUMENT_FILE_PATTERN.test(url) && !DOCUMENT_FILE_PATTERN.test(fileName)) {
    return false;
  }
  if (NON_DOCUMENT_FILE_PATTERN.test(url) || NON_DOCUMENT_FILE_PATTERN.test(fileName)) {
    return false;
  }
  if (/영상|음원|댄스|포스터|카드뉴스|사진|이미지|배너|홍보영상|뉴스레터|공모전|수상작|소식지|우수사례집|인사발령|전보\s*인사|채용\s*공고|시험\s*공고|접수\s*현황/.test(text)) {
    return false;
  }
  return /현장실습|직업계고|특성화고|마이스터고|표준협약|도제|일학습|NCS|취업지원|체험학습|수학여행|학교폭력|사안처리|생활규정|생활지도|학생선도|안전계획|안전교육|보건|감염병|학교회계|예산편성|강사수당|강사료|품의|검수|계약|복무|휴가|근무상황|교육공무직|계약제교원|기간제|취업규칙|단체협약|개인정보|정보공개|학교운영위원회|회의록|서식|신청서|보고서|점검표|체크리스트|동의서|지침|매뉴얼|핸드북|안내서/i.test(text);
}

function dedupeHarvestedFiles(files = []) {
  const map = new Map();
  files.forEach((file) => {
    const key = normalizeSearchText(`${file.fileName}|${file.url}`);
    if (!map.has(key)) {
      map.set(key, file);
    }
  });
  return [...map.values()];
}

async function fetchText(url = "") {
  if (!url || !isOfficialHarvestPageUrl(url)) {
    return "";
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HARVEST_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 GYO6ResourceHarvester/1.0",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    if (!response.ok) {
      return "";
    }
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function isOfficialHarvestPageUrl(url = "") {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return /(^|\.)gbe\.kr$|(^|\.)moe\.go\.kr$|(^|\.)moel\.go\.kr$|(^|\.)kosha\.or\.kr$|(^|\.)hrdkorea\.or\.kr$|(^|\.)hifive\.go\.kr$|(^|\.)schoolsafe\.or\.kr$|(^|\.)pipc\.go\.kr$/.test(host);
  } catch {
    return false;
  }
}

function toAbsoluteUrl(rawUrl = "", origin = "") {
  const value = decodeHtml(cleanText(rawUrl));
  if (!value) return "";
  try {
    return new URL(value, origin || "https://www.gbe.kr").href;
  } catch {
    return "";
  }
}

function getOrigin(url = "") {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

function providerFromUrl(url = "") {
  const domain = getDomainFromUrl(url);
  if (/gbe\.kr$/.test(domain)) return "경상북도교육청";
  if (/hifive\.go\.kr$/.test(domain)) return "교육부·하이파이브";
  if (/moe\.go\.kr$/.test(domain)) return "교육부";
  if (/moel\.go\.kr$/.test(domain)) return "고용노동부";
  if (/kosha\.or\.kr$/.test(domain)) return "안전보건공단";
  if (/hrdkorea\.or\.kr$/.test(domain)) return "한국산업인력공단";
  return "공식자료";
}

function extractFileNameFromUrl(url = "") {
  try {
    return decodeURIComponent(new URL(url, "https://www.gbe.kr").pathname.split("/").pop() || "");
  } catch {
    return "";
  }
}

function decodeHtml(value = "") {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;|&apos;/g, "'");
}

function stripHtml(value = "") {
  return decodeHtml(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

async function mapWithConcurrency(items = [], limit = 4, mapper) {
  const results = [];
  let index = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }));
  return results.filter(Boolean);
}

function normalizeCandidate(item = {}) {
  const title = cleanText(item.title);
  const provider = cleanText(item.provider || "공식자료");
  const query = cleanText(item.query || title);
  const searchDomain = cleanText(item.searchDomain || inferDomainForCategory(item.category));
  const type = normalizeType(item.type);
  const url = cleanText(item.url || buildDirectCandidateUrl({ type, title, query, searchDomain }));
  const id = stableId(item.id || `${item.category}:${type}:${provider}:${title}:${searchDomain}`);
  return {
    id,
    category: normalizeCategory(item.category),
    type,
    title,
    provider,
    query,
    url,
    searchDomain,
    description: cleanText(item.description || `${provider} 공식자료에서 ${query} 원문·서식을 확인하는 자동 확보 후보`),
    priority: cleanText(item.priority || "normal"),
    source: cleanText(item.source || "resource-autopilot"),
    missionLabel: cleanText(item.missionLabel || ""),
    reason: cleanText(item.reason || ""),
    qualityScore: Math.max(0, Math.min(100, Number(item.qualityScore || 0))),
    includeInLibrary: Boolean(item.includeInLibrary && isDirectCandidateUrl(url)),
    needsDirectUrl: Boolean(item.needsDirectUrl),
    extraction: normalizeExtractionPlan(item.extraction, { type, title, query, url }),
    generatedAt: generatedAt.toISOString()
  };
}

function normalizeExtractionPlan(extraction = null, item = {}) {
  const text = `${item.type || ""} ${item.title || ""} ${item.query || ""}`;
  const embeddedFormCandidate = Boolean(extraction?.embeddedFormCandidate || EMBEDDED_FORM_PATTERN.test(text));
  if (!embeddedFormCandidate) {
    return { embeddedFormCandidate: false, status: "source_only", outputFormats: [] };
  }
  const outputFormats = uniqueStrings(extraction?.outputFormats || []);
  return {
    embeddedFormCandidate: true,
    originalFileUrl: cleanText(extraction?.originalFileUrl || item.url || ""),
    status: cleanText(extraction?.status === "source_only" ? "queued_for_verified_pdf_docx_split" : extraction?.status || "queued_for_verified_pdf_docx_split"),
    outputFormats: outputFormats.length ? outputFormats : ["pdf", "docx"]
  };
}

function buildDirectCandidateUrl(item = {}) {
  if (item.searchDomain !== "law.go.kr" && !["law", "rule"].includes(item.type)) {
    return "";
  }
  const legalResource = extractLegalResource(`${item.title || ""} ${item.query || ""}`);
  return legalResource.name && legalResource.path
    ? `https://www.law.go.kr/${legalResource.path}/${encodeURIComponent(legalResource.name)}`
    : "";
}

function extractLegalResource(value = "") {
  const normalized = String(value || "").replace(/\s+/g, "");
  const adminRuleNames = [
    "교원휴가에관한예규",
    "교원의학생생활지도에관한고시",
    "학교생활기록작성및관리지침",
    "학교생활기록부기재요령",
    "교육공무원인사관리규정"
  ];
  const lawNames = [
    "학교폭력예방및대책에관한법률",
    "학교안전사고예방및보상에관한법률",
    "교원의지위향상및교육활동보호를위한특별법",
    "지방자치단체를당사자로하는계약에관한법률",
    "장애인등에대한특수교육법",
    "공공기관의정보공개에관한법률",
    "공공기록물관리에관한법률",
    "중대재해처벌등에관한법률",
    "직업교육훈련촉진법",
    "산업현장일학습병행지원에관한법률",
    "산업안전보건법",
    "개인정보보호법",
    "국가공무원복무규정",
    "지방공무원복무규정",
    "근로기준법",
    "초·중등교육법시행령",
    "초중등교육법시행령",
    "초·중등교육법",
    "초중등교육법",
    "학교급식법",
    "학교보건법"
  ];
  const adminMatch = adminRuleNames.find((name) => normalized.includes(name.replace(/\s+/g, "")));
  if (adminMatch) return { name: adminMatch, path: "행정규칙" };
  const lawMatch = lawNames.find((name) => normalized.includes(name.replace(/\s+/g, "")));
  if (lawMatch) return { name: lawMatch, path: "법령" };
  return { name: "", path: "" };
}

function isDirectCandidateUrl(url = "") {
  const value = cleanText(url);
  if (!value || /google\.com\/search/i.test(value)) return false;
  if (DOCUMENT_FILE_PATTERN.test(value)) return true;
  if (/law\.go\.kr\/(법령|행정규칙)\//i.test(value)) return true;
  try {
    const parsed = new URL(value);
    const pathName = parsed.pathname.replace(/\/+$/, "") || "/";
    return !["/", "/main", "/main.do", "/index", "/index.do", "/home"].includes(pathName)
      && !/\/(bbs|board|notice|data|archive)\/?$/i.test(pathName);
  } catch {
    return false;
  }
}

function scoreCandidate(seedItem, mission, report) {
  let score = 55;
  if (seedItem.searchDomain) score += 15;
  if (/law\.go\.kr|moe\.go\.kr|hifive\.go\.kr|star\.moe\.go\.kr|kosha\.or\.kr|schoolsafe\.or\.kr|pipc\.go\.kr|job\.alio\.go\.kr/.test(seedItem.searchDomain)) score += 10;
  if (report.missingTypes.includes(seedItem.type)) score += 8;
  if (mission.domainHints.some((hint) => normalizeSearchText(seedItem.query).includes(normalizeSearchText(hint)))) score += 4;
  if (hasDirectExistingMatch(seedItem)) score += 8;
  if (/서식|신청서|점검표|협약서/.test(seedItem.title + seedItem.query) && seedItem.type !== "form") score -= 10;
  return Math.max(0, Math.min(100, score));
}

function hasDirectExistingMatch(candidate = {}) {
  const titleText = normalizeSearchText(candidate.title);
  const queryText = normalizeSearchText(candidate.query);
  return existingResources.some((resource) => {
    if (resource.linkKind === "search") return false;
    const text = resource.normalizedText;
    return text.includes(titleText) || (queryText && queryText.length >= 8 && text.includes(queryText.slice(0, 8)));
  });
}

function isMissionRelatedResource(resource, mission) {
  if (resource.category && resource.category === mission.category) return true;
  const text = resource.normalizedText;
  if (mission.domainHints.some((hint) => text.includes(normalizeSearchText(hint)))) return true;
  if (mission.seeds.some((item) => normalizeSearchText(item.query).split(/[^\p{L}\p{N}]+/u).filter((term) => term.length >= 3).some((term) => text.includes(term)))) return true;
  return false;
}

function minTypeCount(type) {
  return type === "guide" ? 5 : 2;
}

function inferCategoryFromDomain(domainCode = "", domain = {}) {
  return inferCategoryFromText([domainCode, domain.label, domain.categoryCode, domain.ontologyGroup, ...(domain.intentKeywords || [])].join(" "));
}

function inferCategoryFromDomains(domains = []) {
  return inferCategoryFromText(domains.join(" "));
}

function inferCategoryFromText(value = "") {
  const text = normalizeSearchText(value);
  if (/현장실습|직업계고|특성화고|ncs|curriculum|fieldtraining|employment|career/.test(text)) return /employment|career|취업|채용/.test(text) ? "careerEmployment" : "fieldTraining";
  if (/학생부|생활기록|출결|학적|평가|체험학습|record|attendance|assessment|graduation/.test(text)) return "studentLife";
  if (/학교폭력|안전|급식|보건|폭력|safety|violence|meal|health/.test(text)) return "schoolViolenceSafety";
  if (/복무|휴가|교권|민원|교육공무직|계약제|기간제|근무상황|취업규칙|단체협약|service|leave|teacher|complaint/.test(text)) return "staffLabor";
  if (/회계|계약|위원회|시설|행정|budget|accounting|contract|committee|facility/.test(text)) return "schoolAdmin";
  if (/개인정보|정보공개|기록|cctv|privacy|record|disclosure/.test(text)) return "privacyRecords";
  return "general";
}

function inferDomainForCategory(category = "") {
  return {
    fieldTraining: "hifive.go.kr",
    studentLife: "star.moe.go.kr",
    schoolViolenceSafety: "moe.go.kr",
    staffLabor: "law.go.kr",
    schoolAdmin: "moe.go.kr",
    privacyRecords: "pipc.go.kr",
    careerEmployment: "job.alio.go.kr",
    general: "moe.go.kr"
  }[category] || "moe.go.kr";
}

function inferSearchDomainFromSource(source = {}) {
  return cleanText(source.searchDomain)
    || getDomainFromUrl(source.url || source.supportUrl || source.homepage)
    || inferDomainForCategory(inferCategoryFromDomains(source.domains || []));
}

function normalizeType(type = "") {
  const text = cleanText(type);
  if (["law", "rule", "guide", "form"].includes(text)) return text;
  if (/법|령|nationalLaw/i.test(text)) return "law";
  if (/규정|규칙|고시|훈령|예규|rule|schoolRule/i.test(text)) return "rule";
  if (/서식|양식|form|template/i.test(text)) return "form";
  return "guide";
}

function normalizeCategory(category = "") {
  const allowed = new Set(RESOURCE_AUTOPILOT_MISSIONS.map((item) => item.category));
  return allowed.has(category) ? category : "general";
}

function dedupeCandidates(items = []) {
  const map = new Map();
  items.filter((item) => item.title && item.query).forEach((item) => {
    const key = normalizeSearchText(`${item.category}|${item.type}|${item.title}|${item.searchDomain}`);
    const existing = map.get(key);
    if (!existing || item.qualityScore > existing.qualityScore || priorityRank(item.priority) > priorityRank(existing.priority)) {
      map.set(key, item);
    }
  });
  return [...map.values()];
}

function compareCandidates(a, b) {
  return priorityRank(b.priority) - priorityRank(a.priority)
    || Number(b.includeInLibrary) - Number(a.includeInLibrary)
    || b.qualityScore - a.qualityScore
    || a.category.localeCompare(b.category)
    || a.title.localeCompare(b.title, "ko");
}

function priorityRank(value = "") {
  if (value === "high") return 3;
  if (value === "normal") return 2;
  return 1;
}

async function writeOutputs(data) {
  await mkdir(outDir, { recursive: true });
  await mkdir(path.join(rootDir, "public"), { recursive: true });
  await mkdir(path.join(rootDir, "functions", "public"), { recursive: true });
  await writeFile(path.join(outDir, "public-resource-acquisition-plan.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "public-resource-acquisition-summary.md"), renderSummary(data), "utf8");
  const moduleContent = [
    "(function attachPublicResourceAcquisition(root, factory) {",
    "  const data = factory();",
    "  if (typeof module === \"object\" && module.exports) {",
    "    module.exports = data;",
    "  } else {",
    "    root.GYO6_PUBLIC_RESOURCE_ACQUISITION = data;",
    "  }",
    `})(typeof globalThis !== "undefined" ? globalThis : window, function createPublicResourceAcquisition() { return ${JSON.stringify({
      version: data.version,
      generatedAt: data.generatedAt,
      stats: data.stats,
      missions: data.missions,
      candidates: data.candidates.filter((item) => item.includeInLibrary).slice(0, 240)
    }, null, 2)}; });`,
    ""
  ].join("\n");
  await writeFile(path.join(rootDir, "public", "public-resource-acquisition-generated.js"), moduleContent, "utf8");
  await writeFile(path.join(rootDir, "functions", "public", "public-resource-acquisition-generated.js"), moduleContent, "utf8");
}

function renderSummary(data) {
  return [
    "# Public Resource Acquisition Autopilot",
    "",
    `- Generated: ${data.generatedAt}`,
    `- Existing resources: ${data.stats.existingResources}`,
    `- Candidates: ${data.stats.candidates}`,
    `- Public candidates: ${data.stats.publicCandidates}`,
    `- Direct URL needed: ${data.stats.directUrlNeeded}`,
    "",
    "## Mission Coverage",
    "",
    ...data.missions
      .sort((a, b) => a.coverageScore - b.coverageScore)
      .map((mission) => `- ${mission.label}: ${mission.coverageScore}점, 자료 ${mission.existing}/${mission.minPublic}, 직접 원문 ${mission.directCount}/${mission.minDirect}, 상태 ${mission.status}`),
    "",
    "## Next High Priority Candidates",
    "",
    ...data.candidates
      .filter((item) => item.priority === "high")
      .slice(0, 20)
      .map((item) => `- [${item.category}/${item.type}] ${item.title} (${item.searchDomain}) - ${item.reason}`)
  ].join("\n");
}

function getDomainFromUrl(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function inferLinkKind(url = "") {
  if (!url) return "search";
  if (/\.(pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/i.test(url)) return "file";
  if (/law\.go\.kr/i.test(url)) return "law";
  return "page";
}

function stableId(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160) || "resource-acquisition";
}

function normalizeSearchText(value = "") {
  return cleanText(value).toLowerCase().replace(/\s+/g, "");
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueStrings(items = []) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}
