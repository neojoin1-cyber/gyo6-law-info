import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const knowledgeBase = require("../public/policy-knowledge-base.js");
const sourceRegistry = require("../public/policy-source-registry.js");
const policyCorpus = require("../public/policy-corpus.js");
const policyEngine = require("../public/policy-engine.js");

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(knowledgeBase.version, "knowledge-base: missing version");
assert(knowledgeBase.sourceConnectors?.localDb, "knowledge-base: missing local DB connector plan");
assert(knowledgeBase.sourceConnectors?.officialLawApi, "knowledge-base: missing official law API connector plan");
assert(knowledgeBase.sourceConnectors?.mcp?.tools?.includes("search_policy_rules"), "knowledge-base: missing MCP rule search tool plan");
assert(knowledgeBase.sourceConnectors?.mcp?.tools?.includes("search_school_policy_corpus"), "knowledge-base: missing MCP school policy corpus search tool plan");
assert(knowledgeBase.sourceConnectors?.mcp?.tools?.includes("get_school_rule"), "knowledge-base: missing MCP school rule tool plan");
assert(knowledgeBase.schoolPolicyOntology?.defaultDomainTemplate?.slotExtractors?.riskSignal, "knowledge-base: missing school policy ontology risk signal extractor");
assert(knowledgeBase.schoolPolicyOntology?.corpusPipeline?.includes("index_by_domain_task_slot"), "knowledge-base: missing school policy corpus indexing pipeline");
assert(knowledgeBase.schoolPolicyOntology?.corpusPipeline?.includes("index_by_audience_school_context_evidence"), "knowledge-base: missing audience/context/evidence indexing pipeline");
assert(knowledgeBase.schoolPolicyOntology?.corpusPipeline?.includes("record_unanswered_gap_candidates"), "knowledge-base: missing unanswered-gap accumulation pipeline");
assert(knowledgeBase.schoolPolicyOntology?.dataIndexSchema?.gapWorkflow?.includes("add_regression_case_from_the_original_question"), "knowledge-base: missing data gap regression promotion workflow");
assert(Object.keys(knowledgeBase.schoolPolicyOntology?.specializedDataIndex || {}).length >= 15, "knowledge-base: specialized data index is too small for vocational-school support");
assert(knowledgeBase.schoolPolicyOntology?.specializedDataIndex?.fieldExperienceLearning?.subtopics?.includes("가정체험학습"), "knowledge-base: field experience data index missing home-learning subtopic");
assert(knowledgeBase.schoolPolicyOntology?.specializedDataIndex?.admissionsTransferGraduation?.subtopics?.includes("재직자전형"), "knowledge-base: admissions data index missing employed-adult pathway");
assert(knowledgeBase.schoolPolicyOntology?.specializedDataIndex?.careerEmploymentGuidance?.sourceTargets?.includes("jobAlio"), "knowledge-base: career employment data index must preserve Job-Alio as primary source target");
assert(sourceRegistry.officialSources?.schoolViolenceGuide2025, "source-registry: missing school violence official source");
assert(sourceRegistry.officialSources?.schoolMealAct, "source-registry: missing school meal official source");
assert(sourceRegistry.officialSources?.educationOfficeBudgetGuideline, "source-registry: missing education-office budget guideline source");
assert(sourceRegistry.officialSources?.vocationalEducationAct, "source-registry: missing vocational education act source");
assert(sourceRegistry.officialSources?.fieldTrainingManual, "source-registry: missing field training manual source");
assert(sourceRegistry.officialSources?.apprenticeshipGuide, "source-registry: missing apprenticeship guide source");
assert(sourceRegistry.officialSources?.nationalCurriculum, "source-registry: missing national curriculum source");
assert(sourceRegistry.officialSources?.jobAlio, "source-registry: missing Job-Alio official source");
assert(sourceRegistry.officialSources?.schoolHealthAct, "source-registry: missing school health source");
assert(sourceRegistry.officialSources?.teacherRightsAct, "source-registry: missing teacher rights source");
assert(sourceRegistry.officialSources?.personalInfoAct, "source-registry: missing personal information source");
assert(sourceRegistry.collectionJobs?.some((job) => job.code === "schoolRuleIngestion"), "source-registry: missing school rule ingestion job");
assert(sourceRegistry.collectionJobs?.some((job) => job.code === "vocationalGuidelineHarvest"), "source-registry: missing vocational guideline harvesting job");
assert(sourceRegistry.collectionJobs?.some((job) => job.code === "employmentFeedCrossCheck"), "source-registry: missing employment feed cross-check job");
assert(policyCorpus.stats?.entries > Object.keys(knowledgeBase.domains || {}).length, "policy-corpus: expected entries beyond domain count");
assert(policyCorpus.search("학교폭력 피해학생 보호조치", { domainCode: "schoolViolenceProcedure" })?.some((entry) => entry.sourceKey === "schoolViolenceGuide2025"), "policy-corpus: school violence source search failed");
assert(policyCorpus.search("학생 가정체험학습 신청서 보고서 출결 처리", { domainCode: "fieldExperienceLearning" })?.some((entry) => entry.type === "dataIndexProfile"), "policy-corpus: field experience data index search failed");
assert(policyCorpus.search("재직자전형 특성화고 특별전형 모집요강 재직증명서", { domainCode: "admissionsTransferGraduation" })?.some((entry) => entry.type === "dataIndexProfile"), "policy-corpus: admissions pathway data index search failed");
assert(policyCorpus.search("졸업생 임금체불 근로계약 노동상담", { domainCode: "careerEmploymentGuidance" })?.some((entry) => entry.type === "dataGapCandidate"), "policy-corpus: career employment data gap candidate search failed");

for (const [domainKey, domain] of Object.entries(knowledgeBase.domains || {})) {
  assert(domain.categoryCode, `domain:${domainKey}: missing categoryCode`);
  assert(Array.isArray(domain.intentKeywords) && domain.intentKeywords.length > 0, `domain:${domainKey}: missing intent keywords`);
  assert(Array.isArray(domain.requiredSlots) && domain.requiredSlots.length > 0, `domain:${domainKey}: missing required slots`);
  assert(domain.sourcePriorityDefault !== "schoolRuleFirst", `domain:${domainKey}: school/internal rules must be final execution checks, not the default first source`);
  if (domainKey === "domesticTravelExpense") {
    assert(domain.slotExtractors?.travelerRole, "domain:domesticTravelExpense: missing travelerRole slot extractor");
    assert(domain.tasks?.totalAmount?.outputSlots?.includes("duration"), "domain:domesticTravelExpense: missing totalAmount task duration output slot");
  }
  if (domainKey === "staffAttendanceService") {
    assert(domain.slotExtractors?.serviceIssue, "domain:staffAttendanceService: missing serviceIssue slot extractor");
    assert(domain.tasks?.evidenceCheck?.outputSlots?.includes("evidence"), "domain:staffAttendanceService: missing evidenceCheck task evidence output slot");
  }
  if (domainKey === "schoolBudgetExecution") {
    assert(domain.slotExtractors?.procedureStage, "domain:schoolBudgetExecution: missing procedureStage slot extractor");
    assert(domain.tasks?.spendingEvidence?.outputSlots?.includes("evidence"), "domain:schoolBudgetExecution: missing spending evidence output slot");
  }
  if (domainKey === "schoolInstructorHonorarium") {
    assert(domain.slotExtractors?.instructorProfile, "domain:schoolInstructorHonorarium: missing instructor profile slot extractor");
    assert(domain.slotExtractors?.lectureDuration, "domain:schoolInstructorHonorarium: missing lecture duration slot extractor");
    assert(domain.tasks?.feeAmount?.outputSlots?.includes("lectureDuration"), "domain:schoolInstructorHonorarium: missing fee amount lecture duration output slot");
  }
}

const travel = knowledgeBase.domesticTravel || {};
const staffAttendance = knowledgeBase.staffAttendance || {};
assert(Number.isFinite(travel.dailyRate) && travel.dailyRate > 0, "domesticTravel: missing daily rate");
assert(Number.isFinite(travel.mealRate) && travel.mealRate > 0, "domesticTravel: missing meal rate");
assert(Number.isFinite(travel.workplaceUnder4h) && Number.isFinite(travel.workplace4h), "domesticTravel: missing workplace travel rates");
assert(Number.isFinite(travel.lodgingCaps?.seoul), "domesticTravel: missing Seoul lodging cap");
assert(Array.isArray(travel.subjectProfiles) && travel.subjectProfiles.length >= 3, "domesticTravel: missing subject profiles");
assert(Array.isArray(travel.legalBasis) && travel.legalBasis.includes("공무원 여비 규정 별표 2"), "domesticTravel: missing legal basis table");
assert(Array.isArray(staffAttendance.publicTeacher?.annualLeave?.daysByService) && staffAttendance.publicTeacher.annualLeave.daysByService.some((item) => item.days === 21), "staffAttendance: missing public teacher annual leave table");
assert(staffAttendance.publicTeacher?.sickLeave?.normalDays === 60 && staffAttendance.publicTeacher?.sickLeave?.officialInjuryDays === 180, "staffAttendance: missing public teacher sick leave limits");
assert(staffAttendance.fixedTermTeacher?.sickLeave?.answer?.includes("계약제교원"), "staffAttendance: missing fixed-term teacher sick leave rule");

const analysis = policyEngine.analyzePolicyQuestion("교사의 진해시 출장시 일비와 식비는?");
const lookup = policyEngine.lookupPolicyRules(analysis);
const response = policyEngine.buildPolicyResponse({ question: "교사의 진해시 출장시 일비와 식비는?" });
const semanticFrame = policyEngine.buildPolicySemanticFrame("경주정보고 교사의 남해군 1박 2일 출장시 출장비는?");
const budgetFrame = policyEngine.buildPolicySemanticFrame("학교 예산 편성과 지출 증빙은 소속 교육청 기준으로 무엇을 먼저 확인해야 하나요?");
const serviceFrame = policyEngine.buildPolicySemanticFrame("기간제교사가 병가 사용 후 복무평가에서 불리해질까 걱정됩니다. 근태 증빙은?");
const travelOvertimeQuestion = "교사가 경주에서 대전으로 1박2일 학생 인솔 출장시 시간외근무 신청을 할 수 있나요?";
const travelOvertimeFrame = policyEngine.buildPolicySemanticFrame(travelOvertimeQuestion);
const travelOvertimeResponse = policyEngine.buildPolicyResponse({ question: travelOvertimeQuestion });
const regularAnnualLeaveFrame = policyEngine.buildPolicySemanticFrame("정규교사의 연가는 몇일 가능하며 언제 신청하나요?");
const regularSickLeaveResponse = policyEngine.buildPolicyResponse({ question: "정규교사의 병가는 몇일 가능하며 어떻게 신청하나요?" });
const fixedTermSickLeaveResponse = policyEngine.buildPolicyResponse({ question: "기간제교사의 병가는 몇일 가능하며 어떻게 신청하나요?" });
const budgetResponse = policyEngine.buildPolicyResponse({ question: "학교 예산 편성과 지출 증빙은 소속 교육청 기준으로 무엇을 먼저 확인해야 하나요?", officeLabel: "강원특별자치도교육청" });
const serviceResponse = policyEngine.buildPolicyResponse({ question: "기간제교사가 병가 사용 후 복무평가에서 불리해질까 걱정됩니다. 근태 증빙은?" });
const schoolViolenceFrame = policyEngine.buildPolicySemanticFrame("학교폭력 신고 후 가해학생 친구들이 보복성 메시지를 보내는데 피해학생 보호 조치는?");
const classManagementFrame = policyEngine.buildPolicySemanticFrame("수업 중 휴대전화를 보관했다가 학부모가 학생 인권 침해라고 민원을 냈습니다.");
const classManagementResponse = policyEngine.buildPolicyResponse({ question: "수업 중 휴대전화를 보관했다가 학부모가 학생 인권 침해라고 민원을 냈습니다." });
const fieldLearningFrame = policyEngine.buildPolicySemanticFrame("교외체험학습 신청서와 보고서, 출결 처리는 어떻게 해야 하나요?");
const dormitoryFrame = policyEngine.buildPolicySemanticFrame("기숙사 배정에서 특정 학과 학생이 불리하다는 민원이 들어왔습니다.");
const mealFrame = policyEngine.buildPolicySemanticFrame("학부모가 급식 반찬이 마음에 들지 않는다며 학교장 면담을 요구했습니다. 식중독은 없습니다.");
const instructorFrame = policyEngine.buildPolicySemanticFrame("전직 교감의 1시간 강사비는?");
const instructorResponse = policyEngine.buildPolicyResponse({ question: "전직 교감의 1시간 강사비는?" });
const universityInstructorFrame = policyEngine.buildPolicySemanticFrame("대학 전임강사의 강의비는 얼마인가요?");
const spouseUncleFrame = policyEngine.buildPolicySemanticFrame("교사의 배우자의 삼촌상은 휴가 몇일인가요?");
const afterSchoolFrame = policyEngine.buildPolicySemanticFrame("방과후학교 강사 선정과 수강료 환불 기준을 교육청 지침으로 확인하고 싶습니다.");
const fieldTrainingOperationFrame = policyEngine.buildPolicySemanticFrame("특성화고 현장실습 표준협약서와 선도기업 점검은 어떻게 해야 하나요?");
const apprenticeshipFrame = policyEngine.buildPolicySemanticFrame("도제학교 일학습병행 기업훈련 시간과 훈련수당은 어떤 지침을 봐야 하나요?");
const ncsCurriculumFrame = policyEngine.buildPolicySemanticFrame("ncs 실무과목과 직업계고학점제 이수 기준은 어떻게 확인하나요?");
const labSafetyFrame = policyEngine.buildPolicySemanticFrame("실험실습실 기자재와 보호구, MSDS 안전점검은 어떻게 해야 하나요?");
const careerEmploymentFrame = policyEngine.buildPolicySemanticFrame("고졸채용 정보를 잡알리오와 교육청 취업지원센터 공고로 교차 확인하려면?");
const admissionsFrame = policyEngine.buildPolicySemanticFrame("특성화고 전입학과 졸업 학적 처리는 어떤 규정을 확인하나요?");
const scholarshipFrame = policyEngine.buildPolicySemanticFrame("기숙사비와 교육급여, 수익자부담 환불 기준은 어떻게 확인하나요?");
const healthCounselingFrame = policyEngine.buildPolicySemanticFrame("감염병 등교중지와 위기학생 상담기록은 어떤 절차로 관리하나요?");
const teacherRightsFrame = policyEngine.buildPolicySemanticFrame("학부모 악성민원과 교권 침해가 있을 때 교육활동 보호 절차는?");
const facilitySecurityFrame = policyEngine.buildPolicySemanticFrame("학교 CCTV 영상정보와 개인정보, 나이스 계정 권한은 어떻게 처리하나요?");
const governanceFrame = policyEngine.buildPolicySemanticFrame("학교운영위원회 회의록 공개와 학칙개정 심의 절차는?");
const assessmentResponse = policyEngine.buildPolicyResponse({ question: "수행평가 부정행위와 성적 이의신청은 어떻게 처리하나요?" });
const governanceResponse = policyEngine.buildPolicyResponse({ question: "학교운영위원회 회의록 공개와 학칙개정 심의 절차는?" });
const homeLearningFrame = policyEngine.buildPolicySemanticFrame("학생 가정체험학습 신청 방법과 보고서, 출석인정 처리는 어떻게 하나요?");
const employedAdultPathwayFrame = policyEngine.buildPolicySemanticFrame("특성화고 졸업생 재직자전형 지원 자격과 필요한 증빙은 무엇인가요?");
const graduateEmploymentGapFrame = policyEngine.buildPolicySemanticFrame("졸업생 취업처 문제가 있는데 상담 기준은?");

assert(analysis.intents?.domesticTravel?.destination?.label === "진해시", "engine: analyzer did not preserve destination slot");
assert(lookup?.tables?.domesticTravel?.dailyRate === travel.dailyRate, "engine: lookup did not use KB travel table");
assert(Array.isArray(lookup?.corpusMatches) && lookup.corpusMatches.length > 0, "engine: lookup did not attach corpus matches");
assert(response?.answer?.[0]?.includes("일비는 25,000원") && response.answer[0].includes("식비는 25,000원"), "engine: response did not compose KB rates");
assert(semanticFrame.domainCode === "domesticTravelExpense", "engine: semantic frame did not classify travel domain");
assert(semanticFrame.task?.code === "totalAmount", "engine: semantic frame did not infer total travel amount task");
assert(semanticFrame.slots?.institution?.label === "경주정보고", "engine: semantic frame did not extract institution slot");
assert(semanticFrame.slots?.destination?.label === "남해군", "engine: semantic frame did not extract destination slot");
assert(semanticFrame.slots?.duration?.days === 2 && semanticFrame.slots?.duration?.nights === 1, "engine: semantic frame did not extract overnight duration");
assert(semanticFrame.lookupPlan?.actions?.includes("search_policy_rules"), "engine: semantic frame did not build lookup plan");
assert(budgetFrame.domainCode === "schoolBudgetExecution", "engine: semantic frame did not classify budget execution domain");
assert(budgetFrame.slots?.spendingType?.detected && budgetFrame.slots?.procedureStage?.detected, "engine: budget frame did not extract spending type and procedure stage");
assert(serviceFrame.domainCode === "staffAttendanceService", "engine: semantic frame did not classify staff attendance service domain");
assert(serviceFrame.slots?.travelerRole?.subjectLabel === "기간제교사", "engine: service frame did not extract fixed-term teacher role");
assert(serviceFrame.slots?.serviceIssue?.label === "병가", "engine: service frame did not extract sick leave issue");
assert(travelOvertimeFrame.domainCode === "staffAttendanceService", "engine: travel + overtime question should classify as staff attendance, not travel expense");
assert(travelOvertimeFrame.slots?.serviceIssue?.code === "overtime", "engine: travel + overtime question did not extract overtime issue");
assert(travelOvertimeFrame.slots?.travelerRole?.subjectLabel === "교원", "engine: travel + overtime question should treat the teacher, not escorted students, as the staff subject");
assert(travelOvertimeResponse?.lead?.includes("시간외근무") && travelOvertimeResponse.lead.includes("여비와 분리"), "engine: travel + overtime lead should separate overtime from travel expense");
assert(travelOvertimeResponse?.answer?.some((line) => line.includes("자동 인정") && line.includes("근무명령")) && !travelOvertimeResponse.answer.join(" ").includes("70,000원"), "engine: travel + overtime response leaked lodging-cap answer");
assert(regularAnnualLeaveFrame.slots?.travelerRole?.subjectLabel === "정규교사" && regularAnnualLeaveFrame.slots?.serviceIssue?.code === "annualLeave", "engine: regular teacher annual leave frame did not extract role and issue");
assert(regularSickLeaveResponse?.answer?.[0]?.includes("연 60일") && regularSickLeaveResponse.answer[0].includes("연 180일") && regularSickLeaveResponse.answer.some((line) => line.includes("진단서") && line.includes("한의사")), "engine: regular teacher sick leave response did not use official limits and medical certificate rule");
assert(fixedTermSickLeaveResponse?.answer?.[0]?.includes("계약제교원") && fixedTermSickLeaveResponse.answer[0].includes("60일") && fixedTermSickLeaveResponse.answer[0].includes("180일"), "engine: fixed-term sick leave response did not separate contract guideline and public-teacher fallback");
assert(budgetResponse?.answer?.some((line) => line.includes("학교회계 예산편성 기본지침")), "engine: budget response did not compose guideline-first answer");
assert(serviceResponse?.answer?.some((line) => line.includes("복무평가") || line.includes("불이익")), "engine: service response did not compose dispute-aware answer");
assert(schoolViolenceFrame.domainCode === "schoolViolenceProcedure" && schoolViolenceFrame.slots?.riskSignal?.label?.includes("학교폭력"), "engine: school violence frame did not classify violence risk");
assert(classManagementFrame.domainCode === "classManagementGuidance" && classManagementFrame.slots?.schoolRule?.label?.includes("학교생활규정"), "engine: class management frame did not extract school rule");
assert(classManagementFrame.slots?.office?.detected !== true, "engine: class management frame falsely detected education office from 휴대전화");
assert(classManagementFrame.lookupPlan?.sourceExpansion?.required === true, "engine: class management source gap should trigger automatic source expansion");
assert(classManagementFrame.lookupPlan?.actions?.includes("queue_source_expansion") && classManagementFrame.lookupPlan?.actions?.includes("recheck_policy_answer_with_expanded_sources"), "engine: class management lookup did not queue source expansion and recheck");
assert(classManagementFrame.lookupPlan?.sourceExpansion?.acquisitionTargets?.some((target) => target.tier === "educationOfficeGuideline") && classManagementFrame.lookupPlan?.sourceExpansion?.acquisitionTargets?.some((target) => target.tier === "schoolRule"), "engine: class management source expansion did not target office guideline and school rule originals");
assert(classManagementFrame.lookupPlan?.sourceExpansion?.riskReview?.items?.some((item) => item.code === "humanRights" && item.status === "detected"), "engine: class management risk review did not detect human-rights issue");
assert(classManagementResponse?.sourceExpansion?.required === true && classManagementResponse?.riskReview?.items?.some((item) => item.code === "privacy"), "engine: class management response did not expose source expansion and risk review");
assert(classManagementResponse?.caution?.includes("자동 자료확충") && !classManagementResponse.caution.includes("먼저 분리해야 합니다"), "engine: class management caution still pushes source gap back to user");
assert(fieldLearningFrame.domainCode === "fieldExperienceLearning" && fieldLearningFrame.slots?.evidence?.label?.includes("신청서"), "engine: field learning frame did not extract application/report evidence");
assert(dormitoryFrame.domainCode === "dormitoryOperation" && dormitoryFrame.lookupPlan?.actions?.includes("get_school_rule"), "engine: dormitory frame did not keep school rule as a final execution-check target");
assert(dormitoryFrame.lookupPlan?.sourceExpansion?.acquisitionTargets?.[0]?.tier === "ministryGuideline", "engine: dormitory source expansion should check upper official rules before school rules");
assert(dormitoryFrame.lookupPlan?.sourceExpansion?.acquisitionTargets?.findIndex((target) => target.tier === "schoolRule") > dormitoryFrame.lookupPlan?.sourceExpansion?.acquisitionTargets?.findIndex((target) => target.tier === "ministryGuideline"), "engine: dormitory school rule should be a later execution check");
assert(mealFrame.domainCode === "schoolMealOperation" && !mealFrame.slots?.riskSignal?.label?.includes("안전·응급"), "engine: meal frame did not respect negated food poisoning risk");
assert(instructorFrame.domainCode === "schoolInstructorHonorarium", "engine: instructor fee frame did not classify honorarium domain");
assert(instructorFrame.slots?.instructorProfile?.subjectLabel === "전직 교감", "engine: instructor fee frame did not extract former vice-principal profile");
assert(instructorFrame.slots?.lectureDuration?.hours === 1, "engine: instructor fee frame did not extract one-hour lecture duration");
assert(instructorResponse?.answer?.[0]?.includes("전국 공통 금액으로 단정할 수 없습니다") && instructorResponse.answer[0].includes("일반강사2") && instructorResponse.answer[0].includes("120,000원"), "engine: instructor fee response did not compose conditional rate answer");
assert(!instructorResponse?.title?.includes("방과후학교"), "engine: instructor fee response leaked after-school domain title");
assert(universityInstructorFrame.domainCode === "schoolInstructorHonorarium" && universityInstructorFrame.slots?.instructorProfile?.subjectLabel === "대학 전임강사" && universityInstructorFrame.slots?.instructorProfile?.grade === "일반강사2", "engine: university full-time lecturer did not resolve to general instructor 2 profile");
assert(spouseUncleFrame.domainCode === "bereavementLeave" && spouseUncleFrame.slots?.familyRelation?.listed === false && spouseUncleFrame.slots?.familyRelation?.code === "spouseUncleAunt", "engine: spouse uncle bereavement should be unlisted relation, not spouse");
assert(afterSchoolFrame.domainCode === "afterSchoolChildcare", "engine: after-school instructor selection question should remain after-school domain");
assert(fieldTrainingOperationFrame.domainCode === "vocationalFieldTrainingOperation" && fieldTrainingOperationFrame.slots?.vocationalProgram?.code === "fieldTraining" && fieldTrainingOperationFrame.slots?.industryPartner?.detected, "engine: field training operation frame did not extract program and company slots");
assert(apprenticeshipFrame.domainCode === "vocationalFieldTrainingOperation" && apprenticeshipFrame.slots?.vocationalProgram?.code === "apprenticeship", "engine: apprenticeship question did not stay in vocational field-training domain");
assert(ncsCurriculumFrame.domainCode === "vocationalCurriculumNcs" && ncsCurriculumFrame.slots?.curriculumArea?.code === "ncs", "engine: NCS curriculum frame did not classify curriculum domain");
assert(labSafetyFrame.domainCode === "labEquipmentPracticeSafety" && labSafetyFrame.slots?.facilityArea?.code === "practiceRoom" && labSafetyFrame.slots?.riskSignal?.detected, "engine: lab equipment safety frame did not extract facility and risk slots");
assert(careerEmploymentFrame.domainCode === "careerEmploymentGuidance" && careerEmploymentFrame.slots?.vocationalProgram?.code === "jobPlacement", "engine: career employment frame did not classify job information as verified employment guidance");
assert(admissionsFrame.domainCode === "admissionsTransferGraduation" && admissionsFrame.slots?.curriculumArea?.code === "academicRecord", "engine: admissions/transfer/graduation frame did not classify academic record domain");
assert(scholarshipFrame.domainCode === "scholarshipWelfareSupport" && scholarshipFrame.slots?.welfareBenefit?.detected, "engine: scholarship/welfare frame did not extract welfare benefit");
assert(healthCounselingFrame.domainCode === "healthInfectionCounseling" && healthCounselingFrame.slots?.riskSignal?.detected, "engine: health counseling frame did not classify health/counseling risk");
assert(teacherRightsFrame.domainCode === "teacherRightsProtection" && teacherRightsFrame.slots?.riskSignal?.detected, "engine: teacher rights frame did not classify staff protection domain");
assert(facilitySecurityFrame.domainCode === "facilityDigitalSecurity" && facilitySecurityFrame.slots?.dataSystem?.detected, "engine: facility digital security frame did not classify data system");
assert(governanceFrame.domainCode === "governanceCommitteeRule" && governanceFrame.slots?.schoolRule?.code === "governanceRule", "engine: governance committee frame did not classify committee/rule domain");
assert(assessmentResponse?.answer?.join(" ").includes("학교생활기록부 기재요령") && assessmentResponse.answer.join(" ").includes("최종 대조"), "engine: assessment response should put ministry record standards before school assessment rules");
assert(governanceResponse?.answer?.join(" ").includes("초·중등교육법") && governanceResponse.answer.join(" ").includes("최종 대조"), "engine: governance response should put upper law and records standards before school committee rules");
assert(homeLearningFrame.domainCode === "fieldExperienceLearning" && homeLearningFrame.lookupPlan?.dataCoverage?.indexedSubtopics?.includes("가정체험학습"), "engine: home-learning question did not use specialized data index");
assert(employedAdultPathwayFrame.domainCode === "admissionsTransferGraduation" && employedAdultPathwayFrame.lookupPlan?.dataCoverage?.collectionTargets?.some((target) => target.includes("재직자전형")), "engine: employed-adult pathway did not preserve data-growth target");
assert(graduateEmploymentGapFrame.domainCode === "careerEmploymentGuidance" && graduateEmploymentGapFrame.lookupPlan?.actions?.includes("record_unanswered_gap_candidates"), "engine: weak/slot-missing employment guidance should keep data-gap candidate action");
assert(policyEngine.lookupPolicyRules({ semanticFrame: schoolViolenceFrame })?.corpusMatches?.some((match) => match.sourceKey === "schoolViolenceGuide2025"), "engine: school violence lookup did not attach source registry match");
assert(policyEngine.lookupPolicyRules({ semanticFrame: instructorFrame })?.corpusMatches?.some((match) => match.sourceKey === "educationOfficeBudgetGuideline"), "engine: instructor fee lookup did not attach education-office guideline source");
assert(policyEngine.lookupPolicyRules({ semanticFrame: careerEmploymentFrame })?.sourceKeys?.includes("jobAlio"), "engine: career employment lookup should include Job-Alio as first official source");

if (failures.length) {
  console.error(`Policy KB audit failed: ${failures.length}`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Policy KB audit passed: ${Object.keys(knowledgeBase.domains || {}).length} domains`);
