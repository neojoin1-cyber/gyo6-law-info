(function attachPolicySourceRegistry(root, factory) {
  const registry = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = registry;
  } else {
    root.GYO6_POLICY_SOURCE_REGISTRY = registry;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createPolicySourceRegistry() {
  return {
    version: "20260610-policy-source-registry-v1",
    sourceTiers: {
      nationalLaw: "법령·시행령·시행규칙·행정규칙",
      ministryGuideline: "교육부 고시·훈령·매뉴얼·가이드북",
      educationOfficeGuideline: "17개 시도교육청 지침·자료실·공문",
      schoolRule: "학교생활규정·학칙·기숙사규정·학업성적관리규정·현장실습운영계획·실습실안전관리규정 등 학교 내부 규정",
      caseEvidence: "신청서·동의서·회의록·상담기록·사진·공문·증빙자료",
      userContext: "사용자 질문에서 추출한 대상·학교급·지역·위험신호"
    },
    officialSources: {
      teacherLeave: {
        tier: "nationalLaw",
        title: "교원휴가에 관한 예규",
        provider: "교육부·국가법령정보센터",
        query: "교원휴가에 관한 예규 연가 병가 공가 특별휴가",
        domains: ["bereavementLeave", "staffAttendanceService"]
      },
      nationalService: {
        tier: "nationalLaw",
        title: "국가공무원 복무규정",
        provider: "국가법령정보센터",
        query: "국가공무원 복무규정 복무 휴가 경조사",
        domains: ["bereavementLeave", "staffAttendanceService"]
      },
      localService: {
        tier: "nationalLaw",
        title: "지방공무원 복무규정",
        provider: "국가법령정보센터",
        query: "지방공무원 복무규정 복무 휴가 특별휴가",
        domains: ["bereavementLeave", "staffAttendanceService"]
      },
      laborStandard: {
        tier: "nationalLaw",
        title: "근로기준법",
        provider: "국가법령정보센터",
        query: "근로기준법 제60조 연차유급휴가 취업규칙",
        domains: ["staffAttendanceService", "staffContract"]
      },
      fixedTermAct: {
        tier: "nationalLaw",
        title: "기간제 및 단시간근로자 보호 등에 관한 법률",
        provider: "국가법령정보센터",
        query: "기간제 및 단시간근로자 보호 등에 관한 법률 기간제교사 계약",
        domains: ["staffAttendanceService", "staffContract"]
      },
      educationWorkerWorkRules: {
        tier: "educationOfficeGuideline",
        title: "소속 교육청 교육공무직원 취업규칙·단체협약",
        provider: "17개 시도교육청",
        query: "교육공무직원 취업규칙 단체협약 복무 휴가 연차",
        domains: ["staffAttendanceService", "staffContract", "bereavementLeave"]
      },
      fixedTermTeacherGuideline: {
        tier: "educationOfficeGuideline",
        title: "소속 교육청 계약제교원 운영 지침",
        provider: "17개 시도교육청",
        query: "계약제교원 운영 지침 기간제교사 연가 병가 복무",
        domains: ["staffAttendanceService", "staffContract", "bereavementLeave"]
      },
      privateSchoolWorkRules: {
        tier: "schoolRule",
        title: "학교법인 취업규칙·복무규정·근로계약",
        provider: "학교법인·학교",
        query: "사립학교 교직원 교원 취업규칙 복무규정 근로계약 병가 휴가 연차",
        domains: ["staffAttendanceService", "staffContract", "bereavementLeave"]
      },
      travelExpense: {
        tier: "nationalLaw",
        title: "공무원 여비 규정",
        provider: "국가법령정보센터",
        query: "공무원 여비 규정 별표 1 별표 2 별표 9 국내 출장",
        domains: ["domesticTravelExpense"]
      },
      schoolAccountingRule: {
        tier: "nationalLaw",
        title: "국립 유치원 및 초·중등학교 회계규칙",
        provider: "국가법령정보센터",
        query: "학교회계 회계규칙 예산 지출 검수",
        domains: ["schoolBudgetExecution", "schoolInstructorHonorarium", "afterSchoolChildcare"]
      },
      localContract: {
        tier: "nationalLaw",
        title: "지방자치단체를 당사자로 하는 계약에 관한 법률",
        provider: "국가법령정보센터",
        query: "지방계약법 수의계약 검수 학교",
        domains: ["schoolBudgetExecution", "afterSchoolChildcare"]
      },
      educationOfficeBudgetGuideline: {
        tier: "educationOfficeGuideline",
        title: "시도교육청 학교회계 예산편성 기본지침",
        provider: "17개 시도교육청",
        query: "학교회계 예산편성 기본지침 교육 강사수당 강사료 일반강사 특별강사",
        domains: ["schoolBudgetExecution", "schoolInstructorHonorarium"]
      },
      vocationalEducationAct: {
        tier: "nationalLaw",
        title: "직업교육훈련 촉진법",
        provider: "국가법령정보센터",
        query: "직업교육훈련 촉진법 현장실습 표준협약서 현장실습 시간",
        domains: ["vocationalFieldTrainingOperation"]
      },
      fieldTrainingManual: {
        tier: "ministryGuideline",
        title: "직업계고 현장실습 운영 매뉴얼·교육부 지침",
        provider: "교육부·시도교육청",
        query: "직업계고 현장실습 운영 매뉴얼 선도기업 표준협약서 학생 보호",
        domains: ["vocationalFieldTrainingOperation"]
      },
      apprenticeshipGuide: {
        tier: "ministryGuideline",
        title: "산학일체형 도제학교·일학습병행 운영 지침",
        provider: "교육부·고용노동부·한국산업인력공단",
        query: "산학일체형 도제학교 일학습병행 운영 지침 기업훈련 학생 보호",
        domains: ["vocationalFieldTrainingOperation"]
      },
      nationalCurriculum: {
        tier: "ministryGuideline",
        title: "초·중등학교 교육과정 및 고교학점제 지침",
        provider: "교육부",
        query: "초중등학교 교육과정 고교학점제 전문교과 직업계고",
        domains: ["vocationalCurriculumNcs", "admissionsTransferGraduation", "assessmentAcademicManagement"]
      },
      vocationalCurriculumGuide: {
        tier: "educationOfficeGuideline",
        title: "직업계고 교육과정·NCS 실무과목 운영 지침",
        provider: "교육부·시도교육청",
        query: "직업계고 교육과정 NCS 실무과목 전문교과 학점제",
        domains: ["vocationalCurriculumNcs", "labEquipmentPracticeSafety"]
      },
      industrialSafetyAct: {
        tier: "nationalLaw",
        title: "산업안전보건법 및 실습실 안전관리 기준",
        provider: "국가법령정보센터·안전보건공단",
        query: "산업안전보건법 학교 실습실 안전교육 보호구 MSDS",
        domains: ["labEquipmentPracticeSafety", "schoolSafetyHealth"]
      },
      vocationalEmploymentGuide: {
        tier: "ministryGuideline",
        title: "직업계고 취업지원·채용연계 운영 자료",
        provider: "교육부·시도교육청",
        query: "직업계고 취업지원 채용연계 추천채용 고졸채용 운영 자료",
        domains: ["careerEmploymentGuidance"]
      },
      jobAlio: {
        tier: "ministryGuideline",
        title: "잡알리오 공공기관 채용정보",
        provider: "기획재정부·잡알리오",
        query: "잡알리오 고졸채용 공공기관 채용공고",
        domains: ["careerEmploymentGuidance"]
      },
      elementarySecondaryEducationAct: {
        tier: "nationalLaw",
        title: "초·중등교육법 및 시행령",
        provider: "국가법령정보센터",
        query: "초중등교육법 시행령 입학 전학 편입학 졸업 학교운영위원회",
        domains: ["admissionsTransferGraduation", "governanceCommitteeRule", "vocationalCurriculumNcs"]
      },
      educationWelfareGuide: {
        tier: "educationOfficeGuideline",
        title: "교육급여·교육비 지원·장학금 운영 기준",
        provider: "교육부·시도교육청",
        query: "교육급여 교육비 지원 장학금 교복비 기숙사비 통학비 학교",
        domains: ["scholarshipWelfareSupport"]
      },
      afterSchoolGuide: {
        tier: "educationOfficeGuideline",
        title: "방과후학교·늘봄학교·자유수강권 운영 지침",
        provider: "교육부·시도교육청",
        query: "방과후학교 늘봄학교 자유수강권 수익자부담 환불 지침",
        domains: ["afterSchoolChildcare", "scholarshipWelfareSupport"]
      },
      schoolHealthAct: {
        tier: "nationalLaw",
        title: "학교보건법 및 감염병·보건실 운영 기준",
        provider: "국가법령정보센터·교육부",
        query: "학교보건법 감염병 등교중지 보건실 투약 학생 건강",
        domains: ["healthInfectionCounseling", "schoolSafetyHealth"]
      },
      studentCounselingGuide: {
        tier: "ministryGuideline",
        title: "학생상담·위기학생 지원·Wee 프로젝트 자료",
        provider: "교육부·시도교육청",
        query: "학생상담 위기학생 자살 자해 Wee 프로젝트 상담기록 비밀보호",
        domains: ["healthInfectionCounseling", "parentComplaintResponse"]
      },
      teacherRightsAct: {
        tier: "nationalLaw",
        title: "교원의 지위 향상 및 교육활동 보호를 위한 특별법",
        provider: "국가법령정보센터·교육부",
        query: "교원지위법 교육활동 침해 교권 보호 교원치유지원",
        domains: ["teacherRightsProtection", "classManagementGuidance"]
      },
      schoolFacilitySafetyGuide: {
        tier: "educationOfficeGuideline",
        title: "학교시설 안전·공사·정보화기기 관리 지침",
        provider: "교육부·시도교육청",
        query: "학교시설 안전관리 시설공사 석면 소방 정보화기기 CCTV 지침",
        domains: ["facilityDigitalSecurity", "labEquipmentPracticeSafety"]
      },
      personalInfoAct: {
        tier: "nationalLaw",
        title: "개인정보 보호법 및 영상정보처리기기 운영 기준",
        provider: "국가법령정보센터·개인정보보호위원회",
        query: "개인정보 보호법 학교 CCTV 영상정보처리기기 개인정보 처리",
        domains: ["facilityDigitalSecurity", "parentComplaintResponse"]
      },
      schoolRecordGuide: {
        tier: "ministryGuideline",
        title: "학교생활기록부 기재요령",
        provider: "교육부·학교생활기록부 종합지원포털",
        query: "학교생활기록부 기재요령 출결 정정 체험학습",
        domains: ["studentRecordsAttendance", "fieldExperienceLearning", "specialEducationSupport", "assessmentAcademicManagement"]
      },
      schoolRecordRule: {
        tier: "ministryGuideline",
        title: "학교생활기록 작성 및 관리지침",
        provider: "교육부·국가법령정보센터",
        query: "학교생활기록 작성 및 관리지침 출결 정정 보존",
        domains: ["studentRecordsAttendance", "classManagementGuidance", "assessmentAcademicManagement"]
      },
      schoolViolenceGuide2025: {
        tier: "ministryGuideline",
        title: "학교폭력 사안처리 가이드북",
        provider: "교육부·시도교육청",
        query: "학교폭력 사안처리 가이드북 신고 접수 전담기구 심의 피해학생 보호",
        domains: ["schoolViolenceProcedure"]
      },
      studentGuidanceRule: {
        tier: "schoolRule",
        title: "경상북도교육청 학생생활규정·학생선도위원회 운영 자료",
        provider: "경상북도교육청 학교지원종합자료실",
        query: "학생선도위원회 운영계획 학교생활규정 제개정 절차 학생생활규정",
        url: "https://www.gbe.kr/edupia/cm/cntnts/cntntsView.do?mi=14937&cntntsId=6600",
        supportUrl: "https://www.gbe.kr/edupia/na/ntt/selectNttInfo.do?mi=22809&nttSn=1617362",
        domains: ["classManagementGuidance", "dormitoryOperation", "parentComplaintResponse"]
      },
      fieldExperienceGuide: {
        tier: "educationOfficeGuideline",
        title: "2026학년도 학교장허가 교외체험학습 운영 지침",
        provider: "경상북도교육청 학생생활과",
        query: "2026학년도 학교장허가 교외체험학습 운영 지침 신청서 보고서 출석 인정",
        url: "https://www.gbe.kr/dep_stu/na/ntt/selectNttInfo.do?mi=8671&bbsId=2693&nttSn=1591411",
        supportUrl: "https://www.gbe.kr/edupia/cm/cntnts/cntntsView.do?mi=14848&cntntsId=6404",
        domains: ["fieldExperienceLearning"]
      },
      schoolMealAct: {
        tier: "nationalLaw",
        title: "학교급식법 및 급식 운영 기준",
        provider: "국가법령정보센터·교육부·시도교육청",
        query: "학교급식법 급식 위생 식중독 알레르기 보존식",
        domains: ["schoolMealOperation"]
      },
      schoolSafetyAct: {
        tier: "nationalLaw",
        title: "학교안전사고 예방 및 보상에 관한 법률",
        provider: "국가법령정보센터",
        query: "학교안전사고 예방 보상 안전공제 사고보고",
        domains: ["schoolSafetyHealth"]
      },
      specialEducationAct: {
        tier: "nationalLaw",
        title: "장애인 등에 대한 특수교육법",
        provider: "국가법령정보센터",
        query: "특수교육법 특수교육대상자 개별화교육 통합교육 지원",
        domains: ["specialEducationSupport"]
      },
      publicRecords: {
        tier: "nationalLaw",
        title: "공공기록물 관리에 관한 법률",
        provider: "국가법령정보센터",
        query: "공공기록물 관리 학교 회의록 증빙 보존",
        domains: ["*"]
      },
      infoDisclosure: {
        tier: "nationalLaw",
        title: "공공기관의 정보공개에 관한 법률",
        provider: "국가법령정보센터",
        query: "정보공개 개인정보 비공개 부분공개 학교",
        domains: ["*"]
      }
    },
    collectionJobs: [
      {
        code: "lawApiCurrentness",
        connector: "officialLawApi",
        cadence: "weekly",
        targetTiers: ["nationalLaw"],
        output: "policy_sources + policy_rules + policy_tables"
      },
      {
        code: "ministryGuidelineHarvest",
        connector: "officialLawApi/ministryManual",
        cadence: "monthly",
        targetTiers: ["ministryGuideline"],
        output: "policy_sources + normalized_guideline_sections"
      },
      {
        code: "educationOfficeGuidelineHarvest",
        connector: "officeGuidelineApi",
        cadence: "monthly-or-on-demand",
        targetTiers: ["educationOfficeGuideline"],
        output: "office_guidelines + source_currentness"
      },
      {
        code: "vocationalGuidelineHarvest",
        connector: "officeGuidelineApi",
        cadence: "monthly-or-on-demand",
        targetTiers: ["ministryGuideline", "educationOfficeGuideline"],
        output: "vocational_guidelines + field_training_manuals + curriculum_guides"
      },
      {
        code: "employmentFeedCrossCheck",
        connector: "officialJobFeedApi",
        cadence: "daily",
        targetTiers: ["ministryGuideline", "educationOfficeGuideline"],
        output: "job_posts + cross_checked_sources + stale_post_flags"
      },
      {
        code: "schoolRuleIngestion",
        connector: "localDb",
        cadence: "on-upload",
        targetTiers: ["schoolRule"],
        output: "school_rules + rule_sections + vector_index"
      }
    ]
  };
});
