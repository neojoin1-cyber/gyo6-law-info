(function attachPolicyKnowledgeBase(root, factory) {
  const knowledgeBase = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = knowledgeBase;
  } else {
    root.GYO6_POLICY_KB = knowledgeBase;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createPolicyKnowledgeBase() {
  return {
    version: "20260615-policy-kb-specialized-index-v1",
    sourceConnectors: {
      localDb: {
        status: "planned",
        purpose: "규정 원문, 표, 시행일, 교육청별 지침 파일을 자체 캐시에 저장해 검색 지연과 출처 누락을 줄입니다."
      },
      officialLawApi: {
        status: "planned",
        provider: "국가법령정보센터 Open API",
        url: "https://open.law.go.kr/LSO/openApi/openApiManual.do",
        purpose: "법령명, 조문, 별표, 시행일, 원문 링크를 공식 데이터로 재검증합니다."
      },
      educationFinanceApi: {
        status: "planned",
        provider: "지방교육재정알리미 Open API",
        url: "https://www.eduinfo.go.kr/portal/open/openData/openApiInfo.do",
        purpose: "17개 시도교육청 재정 정보와 예산·결산 공개 데이터를 보조 출처로 조회합니다."
      },
      neisOpenApi: {
        status: "planned",
        provider: "나이스 교육정보 개방 포털 Open API",
        url: "https://open.neis.go.kr/portal/guide/apiGuidePage.do",
        purpose: "학교·기관 맥락 정보가 필요한 질문에서 보조 데이터로 사용합니다."
      },
      officeGuidelineApi: {
        status: "planned",
        provider: "시도교육청 공식 게시판·자료실",
        purpose: "교육청별 예산편성 기본지침, 취업규칙, 복무 지침, 단체협약을 수집·버전관리합니다."
      },
      mcp: {
        status: "planned",
        tools: [
          "classify_policy_question",
          "search_school_policy_corpus",
          "ingest_official_guideline",
          "search_policy_rules",
          "get_rule_table",
          "get_office_guideline",
          "get_school_rule",
          "verify_source_currentness",
          "compose_policy_answer"
        ]
      }
    },
    schoolPolicyOntology: {
      purpose: "학교폭력, 학급관리, 체험학습, 기숙사, 급식, 학생부, 민원, 안전, 회계, 복무는 물론 특성화고 현장실습, 도제학교, 산학협력, NCS 교육과정, 실험실습실, 취업지도, 학적, 복지, 교권, 시설·정보보안처럼 법령 본문만으로 끝나지 않는 학교 현장 질문을 하나의 분류·슬롯·출처조회 체계로 처리합니다.",
      sourceTiers: [
        "nationalLaw",
        "ministryGuideline",
        "educationOfficeGuideline",
        "schoolRule",
        "caseEvidence",
        "userContext"
      ],
      commonSlots: {
        targetSubject: "학생, 학부모, 교원, 기간제교사, 교육공무직, 행정직, 학교장 등 질문 대상",
        schoolLevel: "초등학교, 중학교, 고등학교, 특수학교, 유치원 등 학교급",
        office: "17개 시도교육청 또는 소속기관",
        schoolRule: "학교생활규정, 학칙, 기숙사 운영규정, 급식 운영 기준, 내부 위원회 규정",
        procedureStage: "신고, 접수, 조사, 심의, 계획, 승인, 집행, 정정, 통지, 불복 등 업무 단계",
        evidence: "신청서, 동의서, 회의록, 사진, CCTV, 진단서, 상담기록, 영수증, 공문 등 확인 자료",
        riskSignal: "안전, 인권, 차별, 개인정보, 아동학대, 형사·민사, 감사·민원 전환 가능성",
        instructorProfile: "전·현직 교장, 교감, 교사, 장학관, 장학사, 외부 전문가 등 강사 등급 판단 대상",
        lectureDuration: "기본 1시간, 초과시간, 총 강의시간, 시간당 단가 여부",
        vocationalProgram: "현장실습, 도제학교, 산학협력, 취업맞춤반, NCS 교육과정, 실험실습 등 직업교육 프로그램",
        industryPartner: "참여기업, 선도기업, 산학협력기관, 실습기업, 채용기관",
        curriculumArea: "전문교과, 보통교과, NCS 실무과목, 학점제, 공동교육과정, 학업성적관리",
        welfareBenefit: "장학금, 교육급여, 수익자부담경비, 교복·교과서·기숙사비·통학비 지원",
        facilityArea: "실습실, 실험실, 기숙사, 급식실, 체육관, 시설공사, 정보화기기, CCTV 등 공간·시설",
        dataSystem: "나이스, K-에듀파인, 학생부, CCTV, 학내망, 계정, 스마트기기 등 정보시스템"
      },
      corpusPipeline: [
        "collect_official_sources",
        "normalize_rule_text",
        "extract_tables_and_checklists",
        "index_by_domain_task_slot",
        "index_by_audience_school_context_evidence",
        "record_unanswered_gap_candidates",
        "verify_effective_date",
        "run_scenario_regression",
        "publish_to_local_db_and_mcp"
      ],
      dataIndexSchema: {
        purpose: "질문 분류만으로 끝내지 않고, 지식베이스 답변 데이터가 대상자·학교 장면·절차·증빙·출처 단계와 함께 검색되도록 하는 특성화고 전문 색인입니다.",
        axes: {
          audiences: "학생, 학부모, 교원, 학교장, 행정실, 교육공무직, 실습기업, 졸업생 등 실제 질문 주체와 대상",
          subtopics: "사용자가 고르는 세부 업무영역과 질문 속 핵심 업무",
          questionPatterns: "자주 나오는 자연어 질문 형태와 변형 표현",
          evidence: "신청서, 동의서, 회의록, 상담기록, 진단서, 협약서, 공고문 등 답변 정확도를 좌우하는 자료",
          sourceTargets: "법령, 교육부 지침, 교육청 자료, 학교 내부 규정, 공식 공고, 사례 기록의 우선순위",
          dataGrowthTargets: "답변이 약하거나 출처가 비어 있을 때 추가 수집해야 할 데이터 묶음",
          clarificationSlots: "질문이 부족할 때 사용자에게 되물어야 할 핵심 슬롯"
        },
        gapWorkflow: [
          "low_confidence_or_missing_source_detected",
          "attach_domain_and_missing_slot_to_gap_candidate",
          "queue_official_source_or_school_rule_collection",
          "convert_verified_material_to_indexed_corpus_entry",
          "add_regression_case_from_the_original_question"
        ]
      },
      specializedDataIndex: {
        studentRecordsAttendance: {
          audiences: ["student", "parent", "teacher", "manager"],
          subtopics: ["출결", "인정결석", "질병결석", "미인정결석", "지각·조퇴·결과", "등교중지", "학생부 기재"],
          questionPatterns: ["출석인정이 되나요", "인정결석 증빙은 무엇인가요", "결석계를 어떻게 처리하나요", "등교중지는 출결이 어떻게 되나요"],
          evidence: ["결석계", "진단서", "보호자 확인서", "학교장 승인", "나이스 출결 이력"],
          sourceTargets: ["schoolRecordGuide", "schoolRecordRule", "schoolHealthAct", "educationOfficeGuideline", "schoolRule"],
          dataGrowthTargets: ["시도교육청 출결 Q&A", "감염병 등교중지 출결 안내", "학교별 결석계 양식"],
          clarificationSlots: ["schoolLevel", "dateRange", "evidence", "procedureStage"]
        },
        fieldExperienceLearning: {
          audiences: ["student", "parent", "teacher", "manager"],
          subtopics: ["교외체험학습", "가정체험학습", "현장체험학습", "수학여행", "수련활동", "국외 체험학습", "보고서"],
          questionPatterns: ["가정체험학습 신청 방법은", "교외체험학습 며칠까지 가능한가요", "보고서를 안 냈을 때 출결 처리는", "수학여행 동의서와 안전계획은"],
          evidence: ["신청서", "보호자 동의서", "학교장 승인", "결과보고서", "안전계획"],
          sourceTargets: ["fieldExperienceGuide", "schoolRecordGuide", "schoolSafetyAct", "educationOfficeGuideline", "schoolRule"],
          dataGrowthTargets: ["교육청별 교외체험학습 일수 한도", "국외 체험학습 처리 기준", "학교별 체험학습 신청서·보고서 서식"],
          clarificationSlots: ["office", "schoolLevel", "dateRange", "procedureStage", "evidence"]
        },
        schoolViolenceProcedure: {
          audiences: ["student", "parent", "teacher", "manager"],
          subtopics: ["신고·접수", "사안조사", "전담기구", "피해학생 보호", "가해학생 조치", "보복 위험", "불복"],
          questionPatterns: ["학폭에 해당하나요", "피해학생 보호조치는", "전담기구는 언제 열어야 하나요", "증거가 부족하면 어떻게 하나요"],
          evidence: ["신고서", "상담기록", "사진·영상", "메신저 캡처", "진술서", "보호자 통지 기록"],
          sourceTargets: ["schoolViolenceGuide2025", "schoolRule", "publicRecords", "infoDisclosure"],
          dataGrowthTargets: ["학교폭력 사안처리 단계별 체크리스트", "보복 위험 대응 사례", "전담기구 서식 묶음"],
          clarificationSlots: ["procedureStage", "evidence", "riskSignal", "targetSubject"]
        },
        classManagementGuidance: {
          audiences: ["student", "parent", "teacher", "manager"],
          subtopics: ["수업방해", "휴대전화", "생활지도", "학생인권", "선도조치", "기숙사 생활지도", "학칙"],
          questionPatterns: ["수업 중 지시를 안 따르면", "휴대전화를 보관해도 되나요", "생활지도와 학폭을 어떻게 구분하나요", "학부모 민원이 들어오면"],
          evidence: ["학교생활규정", "상담기록", "보호자 안내", "수업 기록", "학생 의견 청취 기록"],
          sourceTargets: ["studentGuidanceRule", "schoolRecordRule", "schoolRule", "publicRecords", "infoDisclosure"],
          dataGrowthTargets: ["생활지도 고시 해설", "학생생활규정 표준안", "휴대전화 지도 관련 학교 사례"],
          clarificationSlots: ["schoolRule", "procedureStage", "evidence", "riskSignal"]
        },
        vocationalFieldTrainingOperation: {
          audiences: ["student", "parent", "teacher", "manager", "industryPartner"],
          subtopics: ["현장실습", "도제학교", "일학습병행", "표준협약서", "선도기업", "실습수당", "위험작업", "실습중단"],
          questionPatterns: ["현장실습 중 부당지시는", "표준협약서에는 무엇을 넣나요", "선도기업 점검은", "도제 훈련시간과 수당은", "위험기계 사고가 나면"],
          evidence: ["표준협약서", "실습계획서", "기업 점검표", "안전교육 기록", "보호자 동의서", "실습일지"],
          sourceTargets: ["vocationalEducationAct", "fieldTrainingManual", "apprenticeshipGuide", "schoolSafetyAct", "industrialSafetyAct"],
          dataGrowthTargets: ["현장실습 사전교육 자료", "기업 점검 체크리스트", "실습중단·복귀 절차 사례", "도제학교 운영 지침"],
          clarificationSlots: ["vocationalProgram", "industryPartner", "procedureStage", "evidence", "riskSignal"]
        },
        careerEmploymentGuidance: {
          audiences: ["student", "parent", "teacher", "graduate", "manager"],
          subtopics: ["취업지도", "고졸채용", "추천채용", "학교장 추천", "잡알리오", "근로계약", "임금체불", "수습·해고"],
          questionPatterns: ["채용공고가 믿을 만한가요", "학교장 추천 기준은", "졸업생 임금체불은 어떻게 상담하나요", "근로계약서에서 무엇을 봐야 하나요"],
          evidence: ["공식 채용공고", "직무기술서", "근로계약서", "임금명세서", "상담기록", "추천 기준"],
          sourceTargets: ["jobAlio", "vocationalEmploymentGuide", "laborStandard", "fixedTermAct", "publicRecords"],
          dataGrowthTargets: ["고졸채용 공식 공고 보관", "추천채용 절차 기준", "졸업생 노동상담 사례", "근로계약 체크리스트"],
          clarificationSlots: ["targetSubject", "vocationalProgram", "procedureStage", "evidence", "riskSignal"]
        },
        admissionsTransferGraduation: {
          audiences: ["student", "parent", "teacher", "manager", "graduate"],
          subtopics: ["입학전형", "특성화고 특별전형", "재직자전형", "선취업후진학", "전입학", "위탁교육", "졸업·수료", "학적"],
          questionPatterns: ["재직자전형 자격은", "특성화고 특별전형은 누가 지원하나요", "전입학 처리는", "졸업 요건은", "선취업후진학 자료는"],
          evidence: ["모집요강", "재직증명서", "졸업예정 증명", "학적 자료", "교육청 전형요강"],
          sourceTargets: ["elementarySecondaryEducationAct", "schoolRecordRule", "schoolRecordGuide", "educationOfficeGuideline", "schoolRule"],
          dataGrowthTargets: ["대학별 재직자전형 모집요강", "교육청 특성화고 입학전형 요강", "전입학 처리 사례", "위탁교육 학적 기준"],
          clarificationSlots: ["schoolLevel", "curriculumArea", "procedureStage", "evidence", "dateRange"]
        },
        vocationalCurriculumNcs: {
          audiences: ["student", "parent", "teacher", "manager"],
          subtopics: ["NCS", "전문교과", "실무과목", "직업계고학점제", "고교학점제", "공동교육과정", "평가계획", "학생부 기재"],
          questionPatterns: ["NCS 실무과목 이수 기준은", "직업계고 학점제는 어떻게 적용하나요", "전문교과 평가계획은", "공동교육과정 학생부 기재는"],
          evidence: ["교육과정 편성표", "평가계획", "학업성적관리규정", "학생부 기재 자료", "성취기준"],
          sourceTargets: ["nationalCurriculum", "vocationalCurriculumGuide", "schoolRecordGuide", "schoolRecordRule"],
          dataGrowthTargets: ["직업계고 교육과정 편성 사례", "NCS 실무과목 평가 사례", "학점제 운영 지침"],
          clarificationSlots: ["curriculumArea", "schoolLevel", "procedureStage", "evidence", "schoolRule"]
        },
        labEquipmentPracticeSafety: {
          audiences: ["student", "teacher", "manager", "educationWorker"],
          subtopics: ["실험실습실", "기자재", "실습재료", "위험기계", "보호구", "MSDS", "안전교육", "폐기물"],
          questionPatterns: ["실습실 안전점검은", "위험기계 사용 기준은", "보호구를 안 쓰면", "MSDS는 어떻게 관리하나요", "실습재료 구입 증빙은"],
          evidence: ["안전교육 기록", "위험성평가", "MSDS", "보호구 지급대장", "기자재 검수자료", "사고보고서"],
          sourceTargets: ["schoolSafetyAct", "industrialSafetyAct", "vocationalCurriculumGuide", "schoolAccountingRule"],
          dataGrowthTargets: ["전공별 실습실 안전 체크리스트", "위험기계 지도 사례", "실습재료·기자재 관리 서식"],
          clarificationSlots: ["facilityArea", "procedureStage", "evidence", "riskSignal"]
        },
        scholarshipWelfareSupport: {
          audiences: ["student", "parent", "teacher", "manager"],
          subtopics: ["장학금", "교육비지원", "교육급여", "교복비", "기숙사비", "통학비", "자유수강권", "수익자부담 환불"],
          questionPatterns: ["교육비 지원 대상은", "기숙사비 환불은", "자유수강권은 어떻게 쓰나요", "장학금 중복지원은"],
          evidence: ["신청서", "소득자료", "선정 통지", "납부·환불 자료", "정산 자료"],
          sourceTargets: ["educationWelfareGuide", "afterSchoolGuide", "schoolAccountingRule", "educationOfficeGuideline"],
          dataGrowthTargets: ["교육청별 교육복지 지원 안내", "수익자부담 환불 사례", "자유수강권 정산 기준"],
          clarificationSlots: ["welfareBenefit", "office", "procedureStage", "evidence"]
        },
        healthInfectionCounseling: {
          audiences: ["student", "parent", "teacher", "manager"],
          subtopics: ["감염병", "등교중지", "보건실", "투약", "상담기록", "위기학생", "자해·자살", "Wee 연계"],
          questionPatterns: ["등교중지 출결은", "상담기록을 공개해도 되나요", "위기학생 보호자 안내는", "보건실 투약 기록은"],
          evidence: ["진단서", "등교중지 안내", "보건기록", "상담기록", "보호자 연락 기록", "전문기관 연계 기록"],
          sourceTargets: ["schoolHealthAct", "studentCounselingGuide", "schoolSafetyAct", "schoolRecordGuide"],
          dataGrowthTargets: ["감염병 출결 처리 Q&A", "상담기록 관리 지침", "위기학생 대응 절차 자료"],
          clarificationSlots: ["procedureStage", "evidence", "riskSignal", "schoolLevel"]
        },
        schoolBudgetExecution: {
          audiences: ["teacher", "localOfficer", "manager", "educationWorker"],
          subtopics: ["예산편성", "품의", "계약", "검수", "지출결의", "정산", "업무추진비", "강사수당"],
          questionPatterns: ["이 예산으로 집행 가능한가요", "증빙은 무엇이 필요한가요", "수의계약 기준은", "강사료는 얼마인가요"],
          evidence: ["사업계획서", "품의서", "견적서", "계약서", "검수조서", "영수증", "세금계산서", "카드전표"],
          sourceTargets: ["schoolAccountingRule", "localContract", "educationOfficeGuideline", "publicRecords"],
          dataGrowthTargets: ["교육청별 예산편성 기본지침", "원가통계비목 사례", "지출 증빙 체크리스트"],
          clarificationSlots: ["office", "fiscalYear", "spendingType", "procedureStage", "evidence"]
        },
        schoolInstructorHonorarium: {
          audiences: ["teacher", "localOfficer", "manager"],
          subtopics: ["강사수당", "강사료", "강사등급", "기본시간", "초과시간", "원고료", "심사수당"],
          questionPatterns: ["강사료는 얼마인가요", "전직 교장은 몇 등급인가요", "초과시간 단가는", "원고료와 강사료를 같이 줄 수 있나요"],
          evidence: ["강사 프로필", "강의계획", "강의시간", "강사료 산출내역", "품의·지출자료"],
          sourceTargets: ["schoolAccountingRule", "educationOfficeGuideline", "publicRecords"],
          dataGrowthTargets: ["시도교육청별 강사수당 단가표", "강사등급 판정 사례", "원고료·심사수당 기준"],
          clarificationSlots: ["office", "fiscalYear", "instructorProfile", "lectureDuration"]
        },
        staffAttendanceService: {
          audiences: ["teacher", "fixedTermTeacher", "privateSchool", "localOfficer", "educationWorker", "manager"],
          subtopics: ["연가", "병가", "공가", "특별휴가", "출산휴가", "근무상황", "지각·조퇴·외출", "초과근무"],
          questionPatterns: ["연가 일수는", "병가는 몇 일인가요", "증빙은 무엇인가요", "사립학교 교사는", "기간제교사는"],
          evidence: ["나이스 근무상황", "진단서", "복무 신청", "근로계약", "취업규칙", "단체협약"],
          sourceTargets: ["teacherLeave", "nationalService", "localService", "fixedTermTeacherGuideline", "privateSchoolWorkRules", "educationWorkerWorkRules"],
          dataGrowthTargets: ["교육청별 계약제교원 운영 지침", "사립학교 복무규정 예시", "교육공무직 취업규칙·단체협약"],
          clarificationSlots: ["travelerRole", "employmentType", "serviceIssue", "dateRange", "evidence"]
        },
        teacherRightsProtection: {
          audiences: ["teacher", "fixedTermTeacher", "privateSchool", "manager"],
          subtopics: ["교육활동 침해", "교권", "악성민원", "아동학대 신고", "교원 보호조치", "몰래촬영·녹음", "SNS 유포"],
          questionPatterns: ["교권침해인가요", "학부모 폭언은 어떻게 처리하나요", "학생이 몰래 촬영했어요", "아동학대 신고 위험은"],
          evidence: ["상담기록", "통화녹음", "문자·메신저 캡처", "민원 접수 이력", "수업·지도 기록"],
          sourceTargets: ["teacherRightsAct", "studentGuidanceRule", "publicRecords", "infoDisclosure"],
          dataGrowthTargets: ["교육활동 침해 사례", "교원 보호조치 절차", "민원 대응 문장 예시"],
          clarificationSlots: ["procedureStage", "evidence", "riskSignal", "targetSubject"]
        },
        facilityDigitalSecurity: {
          audiences: ["student", "parent", "teacher", "localOfficer", "manager"],
          subtopics: ["CCTV", "개인정보", "사진·영상", "나이스 권한", "K-에듀파인", "정보보안", "시설공사", "스마트기기"],
          questionPatterns: ["CCTV를 보여줘도 되나요", "학생 사진을 올려도 되나요", "나이스 권한은", "스마트기기 분실은"],
          evidence: ["동의서", "처리방침", "접근권한 이력", "영상 열람 기록", "시설 점검표", "사고보고"],
          sourceTargets: ["personalInfoAct", "schoolFacilitySafetyGuide", "infoDisclosure", "publicRecords", "localContract"],
          dataGrowthTargets: ["학교 CCTV 운영 사례", "학생 사진·영상 동의서 서식", "정보보안 사고 처리 기준"],
          clarificationSlots: ["dataSystem", "facilityArea", "procedureStage", "evidence", "riskSignal"]
        },
        governanceCommitteeRule: {
          audiences: ["student", "parent", "teacher", "manager", "localOfficer"],
          subtopics: ["학교운영위원회", "회의록", "규정개정", "학칙개정", "학생자치", "학부모회", "심의·자문"],
          questionPatterns: ["회의록 공개 기준은", "학칙 개정 절차는", "운영위원회 심의 대상은", "학생 의견수렴은"],
          evidence: ["안건", "회의록", "공고문", "의견수렴 자료", "심의 결과", "공개·비공개 결정"],
          sourceTargets: ["elementarySecondaryEducationAct", "publicRecords", "infoDisclosure", "studentGuidanceRule"],
          dataGrowthTargets: ["학교운영위원회 회의록 공개 사례", "학칙 개정 절차 자료", "위원회별 심의·자문 구분표"],
          clarificationSlots: ["schoolRule", "procedureStage", "evidence", "targetSubject"]
        },
        afterSchoolChildcare: {
          audiences: ["student", "parent", "teacher", "manager", "localOfficer"],
          subtopics: ["방과후학교", "늘봄", "강사 선정", "수강료", "환불", "자유수강권", "수익자부담", "안전관리"],
          questionPatterns: ["방과후 수강료 환불은", "자유수강권 사용 기준은", "강사 선정 절차는", "늘봄 안전관리는"],
          evidence: ["수강신청서", "환불 신청", "출석부", "강사 계약", "선정 평가표", "정산 자료"],
          sourceTargets: ["afterSchoolGuide", "schoolAccountingRule", "localContract", "educationOfficeGuideline"],
          dataGrowthTargets: ["교육청별 방과후학교 운영 지침", "환불 기준 사례", "강사 선정 서식"],
          clarificationSlots: ["office", "procedureStage", "spendingType", "evidence", "riskSignal"]
        }
      },
      defaultDomainTemplate: {
        sourcePriorityDefault: "mixed",
        requiredSlots: ["targetSubject", "procedureStage", "evidence", "schoolRule"],
        slotExtractors: {
          targetSubject: "policySubjectProfile",
          schoolLevel: "schoolLevel",
          office: "educationOffice",
          schoolRule: "schoolRule",
          procedureStage: "universalProcedureStage",
          evidence: "evidence",
          riskSignal: "riskSignal",
          fiscalYear: "fiscalYear",
          institution: "institutionName",
          vocationalProgram: "vocationalProgram",
          industryPartner: "industryPartner",
          curriculumArea: "curriculumArea",
          welfareBenefit: "welfareBenefit",
          facilityArea: "facilityArea",
          dataSystem: "dataSystem"
        },
        tasks: {
          procedure: {
            keywords: ["절차", "처리", "어떻게", "순서", "해야", "대응", "조치", "확인"],
            outputSlots: ["targetSubject", "procedureStage", "evidence", "riskSignal"]
          },
          eligibility: {
            keywords: ["가능", "대상", "기준", "인정", "허용", "금지", "해당", "위반"],
            outputSlots: ["targetSubject", "schoolRule", "riskSignal"]
          },
          evidence: {
            keywords: ["증빙", "서류", "자료", "기록", "회의록", "사진", "동의서", "공문", "안내문"],
            outputSlots: ["evidence", "procedureStage"]
          },
          disputeRisk: {
            keywords: ["민원", "이의", "불복", "차별", "인권", "아동학대", "고소", "고발", "손해배상", "감사", "분쟁"],
            outputSlots: ["targetSubject", "riskSignal", "evidence"]
          }
        }
      }
    },
    domains: {
      domesticTravelExpense: {
        categoryCode: "leaveAttendance",
        label: "국내 출장 여비",
        sourcePriorityDefault: "national",
        intentKeywords: ["출장", "관외", "국내여비", "국내출장", "여비", "출장비", "숙박비", "일비", "식비", "운임", "교통비"],
        requiredSlots: ["travelerRole", "expenseItems", "destination", "workplaceTravel"],
        slotExtractors: {
          travelerRole: "travelSubjectProfile",
          expenseItems: "travelExpenseItems",
          destination: "domesticTravelDestination",
          duration: "travelDuration",
          workplaceTravel: "workplaceTravel",
          institution: "institutionName"
        },
        tasks: {
          totalAmount: {
            keywords: ["출장비", "여비", "국내여비", "계산", "얼마", "총액", "합계"],
            outputSlots: ["expenseItems", "duration", "destination", "travelerRole"]
          },
          componentAmount: {
            keywords: ["일비", "식비", "식대", "숙박비", "숙소비", "운임", "교통비"],
            outputSlots: ["expenseItems", "destination", "travelerRole"]
          },
          method: {
            keywords: ["어떻게", "방법", "기준", "산정", "계산하나요"],
            outputSlots: ["expenseItems", "workplaceTravel", "travelerRole"]
          }
        },
        answerStrategy: "금액표를 먼저 답하고, 근무지 내·외와 대상 신분에 따른 분기를 뒤따르게 합니다."
      },
      bereavementLeave: {
        categoryCode: "leaveAttendance",
        label: "경조사휴가",
        sourcePriorityDefault: "roleFirst",
        intentKeywords: ["경조사", "부모상", "배우자", "상례", "사망", "특별휴가"],
        requiredSlots: ["travelerRole", "familyRelation", "employmentType", "dateRange"],
        sourceKeys: ["teacherLeave", "nationalService", "localService", "laborStandard", "fixedTermAct", "educationWorkerWorkRules", "fixedTermTeacherGuideline", "privateSchoolWorkRules"],
        slotExtractors: {
          travelerRole: "policySubjectProfile",
          familyRelation: "familyRelation",
          employmentType: "employmentType",
          dateRange: "dateRange",
          institution: "institutionName"
        },
        tasks: {
          leaveDays: {
            keywords: ["며칠", "몇일", "일수", "휴가일수", "기간", "몇일간", "몇일쓸", "몇일사용"],
            outputSlots: ["travelerRole", "familyRelation", "employmentType", "dateRange"]
          },
          eligibility: {
            keywords: ["가능", "대상", "적용", "인정", "쓸수", "사용", "해당", "받을수"],
            outputSlots: ["travelerRole", "familyRelation", "employmentType"]
          },
          evidence: {
            keywords: ["증빙", "서류", "제출", "확인", "나이스", "복무", "상신"],
            outputSlots: ["travelerRole", "familyRelation", "employmentType"]
          }
        },
        answerStrategy: "대상 신분과 가족관계를 먼저 확정한 뒤 공통 복무규정과 소속기관 규정을 대조합니다."
      },
      staffAttendanceService: {
        categoryCode: "leaveAttendance",
        label: "교직원 복무·근태",
        sourcePriorityDefault: "roleFirst",
        intentKeywords: ["복무", "근태", "근무상황", "나이스", "NEIS", "휴가", "휴가규정", "연가", "병가", "공가", "특별휴가", "출산휴가", "배우자출산휴가", "배우자 출산", "육아시간", "모성보호", "부성보호", "조퇴", "외출", "지각", "업무분장", "초과근무", "재택", "근무시간", "복무평가"],
        requiredSlots: ["travelerRole", "serviceIssue", "employmentType", "evidence"],
        sourceKeys: ["teacherLeave", "nationalService", "localService", "laborStandard", "fixedTermAct", "educationWorkerWorkRules", "fixedTermTeacherGuideline", "privateSchoolWorkRules"],
        slotExtractors: {
          travelerRole: "policySubjectProfile",
          serviceIssue: "serviceIssue",
          employmentType: "employmentType",
          evidence: "evidence",
          dateRange: "dateRange",
          institution: "institutionName"
        },
        tasks: {
          ruleCheck: {
            keywords: ["기준", "규정", "가능", "인정", "처리", "어떻게", "확인", "적용", "최대", "한도", "일수", "며칠", "몇일", "사용일수", "가능일수", "신청"],
            outputSlots: ["travelerRole", "serviceIssue", "employmentType"]
          },
          evidenceCheck: {
            keywords: ["증빙", "서류", "나이스", "근무상황", "상신", "결재", "제출"],
            outputSlots: ["serviceIssue", "evidence", "dateRange"]
          },
          disputeRisk: {
            keywords: ["불리", "민원", "분쟁", "평가", "차별", "괴롭힘", "불이익"],
            outputSlots: ["travelerRole", "serviceIssue", "employmentType", "evidence"]
          }
        },
        answerStrategy: "교원·지방공무원·교육공무직·기간제 등 신분을 먼저 분기하고, 복무 사유와 증빙을 확인한 뒤 소속기관 규정과 공통 법령을 대조합니다."
      },
      schoolBudgetExecution: {
        categoryCode: "budgetExecution",
        label: "학교회계·예산·지출",
        sourcePriorityDefault: "office",
        intentKeywords: ["예산", "예산편성", "품의", "검수", "지출", "증빙", "업무추진비", "계약"],
        requiredSlots: ["office", "fiscalYear", "spendingType", "procedureStage"],
        sourceKeys: ["schoolAccountingRule", "localContract", "publicRecords"],
        slotExtractors: {
          office: "educationOffice",
          fiscalYear: "fiscalYear",
          spendingType: "spendingType",
          procedureStage: "procedureStage",
          evidence: "evidence",
          institution: "institutionName"
        },
        tasks: {
          budgetPlanning: {
            keywords: ["예산편성", "본예산", "추경", "성립전", "예산요구", "편성", "세출", "세입"],
            outputSlots: ["office", "fiscalYear", "spendingType", "procedureStage"]
          },
          spendingEvidence: {
            keywords: ["지출", "증빙", "품의", "검수", "정산", "영수증", "카드전표", "세금계산서", "지출결의"],
            outputSlots: ["office", "fiscalYear", "spendingType", "procedureStage", "evidence"]
          },
          contractCheck: {
            keywords: ["계약", "수의계약", "입찰", "견적", "검수", "물품", "용역", "공사"],
            outputSlots: ["office", "fiscalYear", "spendingType", "procedureStage"]
          },
          allowanceCheck: {
            keywords: ["강사수당", "강사료", "수당", "원고료", "심사수당", "업무추진비", "협의회", "간담회"],
            outputSlots: ["office", "fiscalYear", "spendingType", "procedureStage"]
          }
        },
        answerStrategy: "소속 교육청 해당 학년도 지침을 우선 조회하고 공통 회계·계약 법령을 보조 근거로 붙입니다."
      },
      schoolInstructorHonorarium: {
        categoryCode: "budgetExecution",
        label: "강사수당·강사료",
        sourcePriorityDefault: "office",
        intentKeywords: ["강사수당", "강사료", "강사비", "강의비", "강의료", "강연료", "외부강의", "교육강사수당", "교육강사", "원고료", "심사수당", "일반강사", "특별강사", "강사등급", "시간당", "초과시간", "전직교감", "전직교장", "퇴직교감", "퇴직교장", "전임강사", "대학전임강사"],
        requiredSlots: ["office", "instructorProfile", "lectureDuration"],
        sourceKeys: ["schoolAccountingRule", "publicRecords"],
        slotExtractors: {
          office: "educationOffice",
          instructorProfile: "instructorHonorariumProfile",
          lectureDuration: "lectureDuration",
          fiscalYear: "fiscalYear",
          spendingType: "spendingType",
          procedureStage: "procedureStage",
          institution: "institutionName"
        },
        tasks: {
          feeAmount: {
            keywords: ["강사비", "강사료", "강의비", "강의료", "강사수당", "얼마", "시간당", "1시간", "2시간", "산정", "계산"],
            outputSlots: ["office", "instructorProfile", "lectureDuration", "fiscalYear"]
          },
          gradeCheck: {
            keywords: ["등급", "일반강사", "특별강사", "해당", "분류", "기준"],
            outputSlots: ["office", "instructorProfile", "fiscalYear"]
          },
          evidenceCheck: {
            keywords: ["품의", "결재", "증빙", "지급", "원고료", "심사수당", "청탁금지법"],
            outputSlots: ["office", "instructorProfile", "lectureDuration", "procedureStage"]
          }
        },
        answerStrategy: "방과후학교 운영 절차와 분리해, 교육청별 학교회계 예산편성 기본지침의 교육 강사수당 표에서 강사 등급과 기본·초과시간 단가를 먼저 확정합니다."
      },
      schoolViolenceProcedure: {
        categoryCode: "schoolViolenceGuide",
        label: "학교폭력 사안처리",
        ontologyGroup: "studentLife",
        sourcePriorityDefault: "ministry",
        intentKeywords: ["학교폭력", "학폭", "전담기구", "심의", "피해학생", "가해학생", "분리", "보호조치", "보복", "따돌림", "사이버폭력", "폭행", "욕설", "명예훼손"],
        requiredSlots: ["targetSubject", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["schoolViolenceGuide2025", "publicRecords", "infoDisclosure"],
        answerStrategy: "신고·접수, 사안조사, 피해학생 보호, 전담기구, 심의 요청, 조치, 불복 단계를 분리하고 증거와 긴급 위험 신호를 먼저 확인합니다."
      },
      classManagementGuidance: {
        categoryCode: "documentDisclosure",
        label: "학급관리·학생생활지도",
        ontologyGroup: "studentLife",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["학급관리", "생활지도", "수업방해", "수업시간", "수업태도", "지시불응", "지도불응", "교사지시", "지시", "따르지", "선도조치", "학생조치", "휴대전화", "휴대폰", "학생인권", "자리이동", "상담", "훈육", "학칙", "학생생활규정", "생활교육", "담임"],
        requiredSlots: ["targetSubject", "procedureStage", "evidence", "schoolRule", "riskSignal"],
        sourceKeys: ["studentGuidanceRule", "schoolRecordRule", "publicRecords", "infoDisclosure"],
        answerStrategy: "학생생활규정과 학급 운영 원칙을 먼저 확인하고, 학생 인권·개인정보·아동학대 민원 전환 가능성을 함께 분리합니다."
      },
      fieldExperienceLearning: {
        categoryCode: "studentRecords",
        label: "현장체험학습·교외체험학습",
        ontologyGroup: "studentActivity",
        sourcePriorityDefault: "office",
        intentKeywords: ["체험학습", "교외체험학습", "현장체험학습", "가정학습", "수학여행", "수련활동", "동의서", "신청서", "보고서", "인솔", "안전요원"],
        requiredSlots: ["targetSubject", "schoolLevel", "office", "procedureStage", "evidence"],
        sourceKeys: ["fieldExperienceGuide", "schoolRecordGuide", "schoolRecordRule", "publicRecords"],
        answerStrategy: "교육청 체험학습 지침, 학교장 승인, 보호자 동의, 안전계획, 출결·학생부 처리 기준을 함께 확인합니다."
      },
      dormitoryOperation: {
        categoryCode: "documentDisclosure",
        label: "기숙사 운영·생활지도",
        ontologyGroup: "studentWelfare",
        sourcePriorityDefault: "schoolRuleFirst",
        intentKeywords: ["기숙사", "생활관", "입사", "퇴사", "배정", "호실", "벌점", "외박", "점호", "생활관규정", "기숙사규정", "차별"],
        requiredSlots: ["targetSubject", "schoolRule", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["studentGuidanceRule", "publicRecords", "infoDisclosure", "schoolRecordRule"],
        answerStrategy: "기숙사 운영규정과 선발·배정 기준을 우선 확인하고, 차별·생활지도·개인정보·안전 위험을 별도 슬롯으로 분리합니다."
      },
      schoolMealOperation: {
        categoryCode: "documentDisclosure",
        label: "학교급식·위생·민원",
        ontologyGroup: "studentWelfare",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["급식", "학교급식", "급식반찬", "급식민원", "식단", "반찬", "식중독", "알레르기", "검식", "보존식", "영양교사", "급식소", "위생", "급식운영"],
        requiredSlots: ["targetSubject", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["schoolMealAct", "publicRecords", "infoDisclosure"],
        answerStrategy: "학교급식 사안은 단순 급식 민원, 알레르기·건강 위험, 식중독 여부, 보존식 확인, 급식운영위원회·식단 공개 사안을 먼저 분리합니다."
      },
      studentRecordsAttendance: {
        categoryCode: "studentRecords",
        label: "학생부·출결·정정",
        ontologyGroup: "studentRecords",
        sourcePriorityDefault: "ministry",
        intentKeywords: ["생활기록부", "학교생활기록", "생기부", "학생부", "출결", "인정결석", "결석", "지각", "조퇴", "결과", "정정", "기재요령", "누가기록"],
        requiredSlots: ["targetSubject", "schoolLevel", "procedureStage", "evidence", "fiscalYear"],
        sourceKeys: ["schoolRecordGuide", "schoolRecordRule", "publicRecords", "infoDisclosure"],
        answerStrategy: "당해 학년도 기재요령, 학교생활기록 작성·관리지침, 출결 증빙, 정정 권한과 결재 이력을 함께 확인합니다."
      },
      schoolSafetyHealth: {
        categoryCode: "studentSafety",
        label: "학교안전·보건·사고대응",
        ontologyGroup: "safety",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["안전사고", "학교안전", "보건", "응급", "119", "병원", "치료비", "안전공제", "감염병", "약물", "보건실", "중대재해", "위험성평가"],
        requiredSlots: ["targetSubject", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["schoolSafetyAct", "publicRecords", "infoDisclosure"],
        answerStrategy: "응급조치, 보호자 연락, 사고보고, 학교안전공제, 감염병·보건 기준, 중대재해 전환 가능성을 단계별로 분리합니다."
      },
      parentComplaintResponse: {
        categoryCode: "documentDisclosure",
        label: "학부모·민원 대응",
        ontologyGroup: "civilComplaint",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["민원", "학부모", "보호자", "면담", "사과", "전화응대", "항의", "교육청민원", "국민신문고", "답변서", "안내문", "요구"],
        requiredSlots: ["targetSubject", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["publicRecords", "infoDisclosure", "studentGuidanceRule"],
        answerStrategy: "학부모·보호자 민원은 요구사항, 사실확인 범위, 공개 가능한 정보, 개인정보, 재발방지 안내, 교육청 민원 전환 가능성을 분리합니다."
      },
      specialEducationSupport: {
        categoryCode: "studentRecords",
        label: "특수교육·지원·통합교육",
        ontologyGroup: "studentSupport",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["특수교육", "장애학생", "통합교육", "개별화교육", "IEP", "특수교육대상자", "지원인력", "보조공학", "치료지원"],
        requiredSlots: ["targetSubject", "schoolLevel", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["specialEducationAct", "schoolRecordGuide", "schoolRecordRule", "publicRecords", "infoDisclosure"],
        answerStrategy: "대상자 선정, 개별화교육계획, 지원인력, 보호자 동의, 개인정보와 차별 위험을 함께 확인합니다."
      },
      assessmentAcademicManagement: {
        categoryCode: "studentRecords",
        label: "평가·성적·학업성적관리",
        ontologyGroup: "academicManagement",
        sourcePriorityDefault: "schoolRuleFirst",
        intentKeywords: ["평가", "시험", "성적", "부정행위", "이의신청", "학업성적관리", "수행평가", "재시험", "채점", "답안지"],
        requiredSlots: ["targetSubject", "schoolLevel", "schoolRule", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["schoolRecordGuide", "schoolRecordRule", "publicRecords", "infoDisclosure"],
        answerStrategy: "학업성적관리규정, 평가계획, 이의신청 절차, 부정행위 사실확인과 학생 의견청취를 우선 확인합니다."
      },
      afterSchoolChildcare: {
        categoryCode: "budgetExecution",
        label: "방과후학교·돌봄·늘봄",
        ontologyGroup: "studentWelfare",
        sourcePriorityDefault: "office",
        intentKeywords: ["방과후", "방과후학교", "돌봄", "늘봄", "수강료", "환불", "프로그램", "위탁", "선정", "강사선정", "자유수강권"],
        requiredSlots: ["targetSubject", "office", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["afterSchoolGuide", "schoolAccountingRule", "localContract", "publicRecords"],
        answerStrategy: "교육청 방과후·늘봄 지침에서 수강료, 환불, 수익자부담·자유수강권, 강사 선정, 계약·정산, 안전관리 기준을 함께 확인합니다."
      },
      vocationalFieldTrainingOperation: {
        categoryCode: "vocationalFieldTraining",
        label: "현장실습·도제·산학협력",
        ontologyGroup: "vocationalEducation",
        sourcePriorityDefault: "ministry",
        intentKeywords: ["현장실습", "도제학교", "일학습병행", "산학협력", "선도기업", "참여기업", "기업현장교사", "실습협약", "표준협약서", "실습수당", "취업맞춤반", "글로벌현장학습", "직업교육훈련"],
        requiredSlots: ["targetSubject", "schoolLevel", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["vocationalEducationAct", "fieldTrainingManual", "apprenticeshipGuide", "schoolSafetyAct", "publicRecords"],
        answerStrategy: "학생 보호, 표준협약서·실습협약, 실습시간, 선도기업·참여기업 선정·점검, 보호자 동의, 안전교육, 기업 민원·중단 절차를 현장실습 운영 단계별로 분리합니다."
      },
      vocationalCurriculumNcs: {
        categoryCode: "vocationalCurriculum",
        label: "직업계고 교육과정·NCS·학점제",
        ontologyGroup: "vocationalEducation",
        sourcePriorityDefault: "ministry",
        intentKeywords: ["NCS", "ncs", "엔씨에스", "직업계고학점제", "고교학점제", "전문교과", "실무과목", "교육과정", "직무능력", "이수단위", "학점", "공동교육과정", "마이스터고", "특성화고", "직업기초능력"],
        requiredSlots: ["targetSubject", "schoolLevel", "procedureStage", "evidence", "schoolRule"],
        sourceKeys: ["nationalCurriculum", "vocationalCurriculumGuide", "schoolRecordGuide", "schoolRecordRule", "publicRecords"],
        answerStrategy: "전문교과 편성, NCS 실무과목, 학점·이수 기준, 평가계획, 학생부 기재, 공동교육과정 운영 기준을 함께 확인합니다."
      },
      labEquipmentPracticeSafety: {
        categoryCode: "studentSafety",
        label: "실험실습실·기자재·실습재료·안전",
        ontologyGroup: "safety",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["실습실", "실험실습실", "실험실", "기자재", "실습재료", "실습복", "공구", "기계", "위험기계", "안전교육", "보호구", "MSDS", "msds", "화학물질", "폐기물", "실습실안전", "기능반"],
        requiredSlots: ["targetSubject", "facilityArea", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["schoolSafetyAct", "industrialSafetyAct", "vocationalCurriculumGuide", "schoolAccountingRule", "publicRecords"],
        answerStrategy: "실험실습실 안전교육, 위험기계·화학물질, MSDS, 보호구, 기자재 구입·검수, 사고보고와 예산 집행 증빙을 분리해 확인합니다."
      },
      careerEmploymentGuidance: {
        categoryCode: "careerEmployment",
        label: "취업지도·채용공고·졸업생 노동상담",
        ontologyGroup: "vocationalEducation",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["취업지도", "취업지원", "취업지원센터", "채용공고", "잡알리오", "고졸채용", "고졸 채용", "공채", "추천채용", "현장실습생채용", "졸업생", "근로계약", "임금체불", "수습", "해고", "권고사직"],
        requiredSlots: ["targetSubject", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["jobAlio", "vocationalEmploymentGuide", "laborStandard", "fixedTermAct", "publicRecords"],
        answerStrategy: "취업지도에서는 채용정보를 잡알리오 등 공식 공고를 1차 기준으로 두고, 교육청 취업지원센터·학교 공고는 누락 보완과 2·3차 검증 출처로 교차 확인합니다."
      },
      admissionsTransferGraduation: {
        categoryCode: "admissionsPathways",
        label: "입학·특별전형·재직자전형·학적·졸업",
        ontologyGroup: "academicManagement",
        sourcePriorityDefault: "office",
        intentKeywords: ["입학", "입학전형", "특별전형", "특성화고특별전형", "재직자전형", "선취업후진학", "동일계전형", "대학진학", "전학", "전입학", "편입학", "재입학", "자퇴", "퇴학", "유예", "휴학", "졸업", "조기진급", "학적", "위탁교육", "직업위탁", "대안교육"],
        requiredSlots: ["targetSubject", "schoolLevel", "office", "procedureStage", "evidence"],
        sourceKeys: ["elementarySecondaryEducationAct", "schoolRecordRule", "schoolRecordGuide", "publicRecords", "infoDisclosure"],
        answerStrategy: "입학전형, 특성화고 특별전형, 재직자전형, 전입학·편입학 가능 여부, 학적 변동, 위탁교육, 졸업·수료 기준을 교육청 지침과 모집요강으로 함께 확인합니다."
      },
      scholarshipWelfareSupport: {
        categoryCode: "studentWelfare",
        label: "장학·교육복지·수익자부담",
        ontologyGroup: "studentWelfare",
        sourcePriorityDefault: "office",
        intentKeywords: ["장학금", "교육비지원", "교육급여", "교육복지", "수익자부담", "감면", "환불", "교복", "교과서", "급식비", "기숙사비", "통학비", "방과후자유수강권", "자유수강권"],
        requiredSlots: ["targetSubject", "office", "procedureStage", "evidence", "welfareBenefit"],
        sourceKeys: ["educationWelfareGuide", "schoolAccountingRule", "afterSchoolGuide", "publicRecords", "infoDisclosure"],
        answerStrategy: "지원 대상, 신청·선정 절차, 개인정보·소득자료, 수익자부담 집행·환불, 중복지원 가능성을 분리해 확인합니다."
      },
      healthInfectionCounseling: {
        categoryCode: "studentHealthCounseling",
        label: "보건·감염병·상담·위기학생",
        ontologyGroup: "studentWelfare",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["보건", "감염병", "독감", "코로나", "등교중지", "보건실", "투약", "약물", "학생상담", "상담일지", "자살", "자해", "위기학생", "Wee", "정서행동", "정신건강", "상담기록"],
        requiredSlots: ["targetSubject", "schoolLevel", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["schoolHealthAct", "studentCounselingGuide", "schoolSafetyAct", "publicRecords", "infoDisclosure"],
        answerStrategy: "감염병·등교중지, 투약·보건실 기록, 상담 비밀보호, 상담기록 열람·제공, 자해·자살 위험, 보호자·전문기관 연계와 기록 보존을 구분합니다."
      },
      teacherRightsProtection: {
        categoryCode: "staffProtection",
        label: "교육활동 보호·교권침해·교직원 보호",
        ontologyGroup: "staffProtection",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["교권", "교육활동침해", "교육활동 보호", "교원치유지원", "교권보호위원회", "학부모폭언", "악성민원", "교사보호", "아동학대신고", "교직원보호", "몰래촬영", "몰래녹음", "통화녹음", "녹음공개", "SNS유포"],
        requiredSlots: ["targetSubject", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["teacherRightsAct", "studentGuidanceRule", "publicRecords", "infoDisclosure"],
        answerStrategy: "교육활동 침해 여부, 학생 생활지도와 아동학대 신고 위험, 교원 보호조치, 사진·영상·녹음·SNS 유포, 상담·녹취·민원 기록, 위원회 절차를 분리합니다."
      },
      facilityDigitalSecurity: {
        categoryCode: "facilityDigital",
        label: "시설·정보화·개인정보·CCTV·보안",
        ontologyGroup: "safety",
        sourcePriorityDefault: "mixed",
        intentKeywords: ["시설", "학교시설", "시설공사", "석면", "소방", "전기", "정보화", "나이스", "NEIS", "neis", "K-에듀파인", "K에듀파인", "k-에듀파인", "k에듀파인", "개인정보", "CCTV", "cctv", "영상정보", "사진", "단체사진", "졸업앨범", "초상권", "녹음", "녹화", "SNS", "홈페이지", "동의서", "스마트기기", "태블릿", "와이파이", "계정", "정보보안", "보안"],
        requiredSlots: ["targetSubject", "facilityArea", "dataSystem", "procedureStage", "evidence", "riskSignal"],
        sourceKeys: ["schoolFacilitySafetyGuide", "personalInfoAct", "infoDisclosure", "publicRecords", "localContract"],
        answerStrategy: "시설 안전, 공사·계약, CCTV·영상정보, 학생 사진·영상·녹음·SNS 게시, 개인정보 처리, 나이스·K-에듀파인 권한, 정보보안 사고를 별도 절차로 나눕니다."
      },
      governanceCommitteeRule: {
        categoryCode: "governanceRecords",
        label: "학교운영위원회·규정개정·위원회",
        ontologyGroup: "schoolGovernance",
        sourcePriorityDefault: "schoolRuleFirst",
        intentKeywords: ["학교운영위원회", "운영위원회", "규정개정", "학칙개정", "위원회", "회의록", "심의", "자문", "의결", "학생자치", "학부모회", "교무위원회"],
        requiredSlots: ["targetSubject", "schoolRule", "procedureStage", "evidence"],
        sourceKeys: ["elementarySecondaryEducationAct", "publicRecords", "infoDisclosure", "studentGuidanceRule"],
        answerStrategy: "위원회 권한, 심의·자문 구분, 회의록 공개·비공개, 규정개정 공고·의견수렴, 학생·학부모 참여 절차를 확인합니다."
      }
    },
    sources: {
      travelExpense: {
        title: "공무원 여비 규정",
        source: "국가법령정보센터",
        query: "공무원 여비 규정 별표1 별표2 별표9 출장 숙박비",
        url: "https://www.law.go.kr/LSW/lsInfoP.do?lsId=009402&urlMode=lsInfoP"
      },
      publicRecords: {
        title: "공공기록물 관리에 관한 법률",
        source: "국가법령정보센터",
        query: "공공기록물 관리에 관한 법률 학교 회의록 보존",
        url: "https://www.law.go.kr/LSW/lsSc.do?query=%EA%B3%B5%EA%B3%B5%EA%B8%B0%EB%A1%9D%EB%AC%BC%20%EA%B4%80%EB%A6%AC%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0"
      },
      educationWorkerWorkRules: {
        title: "소속 교육청 교육공무직원 취업규칙·단체협약",
        source: "시도교육청",
        query: "교육공무직원 취업규칙 단체협약 복무 휴가 연차",
        url: ""
      },
      fixedTermTeacherGuideline: {
        title: "소속 교육청 계약제교원 운영 지침",
        source: "시도교육청",
        query: "계약제교원 운영 지침 기간제교사 연가 병가 복무",
        url: ""
      },
      privateSchoolWorkRules: {
        title: "학교법인 취업규칙·복무규정·근로계약",
        source: "학교법인·학교",
        query: "사립학교 교직원 교원 취업규칙 복무규정 근로계약 병가 휴가 연차",
        url: ""
      }
    },
    instructorHonorarium: {
      defaultRateTableCode: "gyeongbuk2026",
      sourceKeys: ["schoolAccountingRule", "publicRecords"],
      rateTables: {
        gyeongbuk2026: {
          officeCode: "gyeongbuk",
          officeLabel: "경상북도교육청",
          fiscalYear: "2026학년도",
          title: "2026학년도 공립학교회계 예산편성 기본지침 교육 강사수당",
          profiles: {
            special2: {
              grade: "특별강사2",
              base: 300000,
              extra: 200000,
              basis: "전·현직 장·차관, 국회의원, 대학총장급, 교육감 등 지침에서 정한 고위직·권위자 유형에 적용됩니다."
            },
            general1: {
              grade: "일반강사1",
              base: 200000,
              extra: 100000,
              basis: "유·초·중등학교장, 4급 상당 이상 공무원, 장학관·교육연구관, 해당 분야 전문가 등이 포함됩니다."
            },
            general2: {
              grade: "일반강사2",
              base: 120000,
              extra: 60000,
              basis: "일반강사1에 해당하지 않는 5급 이하 공무원 및 교육공무원, 대학 전임강사·시간강사, 외국인 원어민 강사 등이 포함됩니다."
            },
            general3: {
              grade: "일반강사3",
              base: 80000,
              extra: 40000,
              basis: "외국어, 체육, 전산강사 등 별도 전문강사 유형에 적용됩니다."
            }
          }
        }
      }
    },
    staffAttendance: {
      sourceKeys: ["teacherLeave", "nationalService", "localService", "laborStandard", "fixedTermAct", "educationWorkerWorkRules", "fixedTermTeacherGuideline", "privateSchoolWorkRules"],
      publicTeacher: {
        annualLeave: {
          basis: ["국가공무원 복무규정 제15조", "국가공무원 복무규정 제16조", "교원휴가에 관한 예규"],
          daysByService: [
            { service: "1개월 이상 1년 미만", days: 11 },
            { service: "1년 이상 3년 미만", days: 15 },
            { service: "3년 이상 4년 미만", days: 16 },
            { service: "4년 이상 5년 미만", days: 17 },
            { service: "5년 이상 6년 미만", days: 20 },
            { service: "6년 이상", days: 21 }
          ],
          approval: "나이스 근무상황에서 사전 신청하고 학교장 승인 후 사용합니다.",
          calculationNote: "잔여 일수는 재직기간, 사용일수, 휴직·정직·직위해제 등 재직기간 산입 제외 이력, 저축연가와 미리 사용한 연가를 함께 계산합니다."
        },
        sickLeave: {
          basis: ["국가공무원 복무규정 제18조", "교원휴가에 관한 예규"],
          normalDays: 60,
          officialInjuryDays: 180,
          hourlyConversion: "질병·부상으로 인한 지각·조퇴·외출은 누계 8시간을 병가 1일로 계산합니다.",
          evidenceRule: "병가 일수가 연간 6일을 초과하면 의사·치과의사·한의사가 발급한 진단서를 첨부해야 합니다.",
          medicalCertificateRule: "진단서는 의사·치과의사·한의사가 발급한 자료를 기준으로 보며, 병명·치료기간 또는 직무수행 곤란 기간이 확인되어야 합니다. 입원확인서·진료확인서는 소속기관 지침상 보조자료 또는 대체 가능 여부를 별도로 확인합니다.",
          approval: "나이스 근무상황에서 병가로 신청하고 의사·치과의사·한의사 진단서, 입원확인서 등 증빙과 학교장 승인을 맞춰 처리합니다."
        },
        attendanceTime: {
          basis: ["국가공무원 복무규정 제3조", "국가공무원 복무규정 제18조", "교원휴가에 관한 예규", "나이스 근무상황 처리 기준"],
          unauthorizedProcess: "출근기록과 나이스 근무상황을 대조해 지각 시간과 승인 여부를 확정한 뒤, 승인·증빙 없는 시간은 복무 위반 사안으로 처리합니다.",
          evidence: "출근기록, 근무상황부, 나이스 상신·승인 이력, 사유서와 증빙자료를 함께 확인합니다.",
          followUp: "사유 확인, 사후 승인 가능성, 복무지도·주의·경고·징계 검토 가능성을 분리합니다."
        }
      },
      fixedTermTeacher: {
        annualLeave: {
          basis: ["소속 교육청 계약제교원 운영 지침", "근로계약서", "근로기준법", "교원휴가에 관한 예규 준용 여부"],
          answer: "공무원 연가표를 그대로 21일로 단정하지 않고 계약기간, 근무일수, 방학 중 근무 여부, 소속 교육청 계약제교원 지침과 근로계약으로 산정합니다.",
          approval: "학교가 나이스 근무상황 처리를 사용하면 연가 또는 연차유급휴가로 사전 상신하고 학교장 승인 후 사용합니다."
        },
        sickLeave: {
          basis: ["소속 교육청 계약제교원 운영 지침", "근로계약서", "교원휴가에 관한 예규 준용 여부", "국가공무원 복무규정 제18조"],
          answer: "공립학교 기간제교사가 교원 복무 기준을 준용하면 일반 질병·부상 병가는 연 60일, 공무상 질병·부상 병가는 연 180일 범위가 기준 후보입니다. 유급·무급 여부와 실제 적용 일수는 소속 교육청 계약제교원 운영 지침과 근로계약서로 확정합니다.",
          approval: "나이스 근무상황 또는 학교 내부 복무 신청으로 병가를 상신하고, 연간 6일 초과 병가 등은 의사·치과의사·한의사 진단서 기준을 확인합니다."
        },
        attendanceTime: {
          basis: ["소속 교육청 계약제교원 운영 지침", "근로계약서", "학교 복무 기준", "나이스 근무상황 처리 기준"],
          answer: "계약기간 중 무단 지각·조퇴·외출은 출근기록, 나이스 근무상황, 관리자 승인 여부를 기준으로 복무 위반과 계약상 불이익 위험을 분리해 처리합니다.",
          approval: "사유서, 증빙자료, 사후 승인 가능성, 복무지도 또는 재계약 평가 반영 여부를 서면 근거로 확인합니다."
        }
      },
      privateSchoolTeacher: {
        sickLeave: {
          basis: ["학교법인 복무규정", "취업규칙", "근로계약", "교원휴가에 관한 예규 준용 여부", "국가공무원 복무규정 제18조"],
          normalDays: 60,
          officialInjuryDays: 180,
          answer: "사립학교 교원은 학교법인 복무규정·취업규칙·근로계약이 직접 기준입니다. 다만 해당 학교가 교원휴가 기준을 준용하면 일반 질병·부상 병가 연 60일, 공무상 질병·부상 병가 연 180일이 기준 후보가 됩니다.",
          evidenceRule: "교원휴가 기준을 준용하는 경우 병가 일수가 연간 6일을 초과하면 의사·치과의사·한의사가 발급한 진단서를 첨부하는 기준을 함께 봅니다.",
          hourlyConversion: "교원휴가 기준을 준용하는 경우 질병·부상으로 인한 지각·조퇴·외출은 누계 8시간을 병가 1일로 계산합니다.",
          approval: "나이스 근무상황 또는 학교 내부 복무 신청으로 병가를 상신하고 학교법인 규정상 승인권자와 의사·치과의사·한의사 진단서 등 증빙 기준을 확인합니다."
        }
      }
    },
    domesticTravel: {
      dailyRate: 25000,
      mealRate: 25000,
      workplaceUnder4h: 10000,
      workplace4h: 20000,
      lodgingCaps: {
        seoul: 100000,
        metropolitan: 80000,
        other: 70000
      },
      sourceKeys: ["travelExpense", "publicRecords"],
      legalBasis: [
        "공무원 여비 규정 제16조",
        "공무원 여비 규정 제18조",
        "공무원 여비 규정 별표 1",
        "공무원 여비 규정 별표 2",
        "공무원 여비 규정 별표 9"
      ],
      expenseSynonyms: {
        daily: ["일비", "일당", "출장일당", "하루일비"],
        meal: ["식비", "식대", "식사", "밥값", "끼니"],
        lodging: ["숙박비", "숙박", "숙소", "호텔", "1박", "박당", "숙소비", "방값"],
        transport: ["운임", "교통비", "철도", "항공", "버스", "자동차"]
      },
      fullExpenseKeywords: ["출장비", "여비", "국내여비"],
      workplaceTravelPattern: /근무지내|근무지안|관내출장|같은시|같은군|동일시|동일군|12km|12킬로|4시간|네시간|당일관내/,
      destinationBlockPattern: /출장|출장비|국내|관외|일비|식비|숙박|운임|교장|교사|교원|공무원|학교장|행정직|선생|대상|다녀|가면|가는|계산|얼마|인정|비는/,
      metropolitanNames: [
        ["서울", "서울특별시"],
        ["부산", "부산광역시"],
        ["대구", "대구광역시"],
        ["인천", "인천광역시"],
        ["광주", "광주광역시"],
        ["대전", "대전광역시"],
        ["울산", "울산광역시"],
        ["세종", "세종특별자치시"]
      ],
      subjectProfiles: [
        {
          code: "principal",
          roleCode: "teacher",
          roleLabel: "초·중·고등학교 교장",
          subjectLabel: "초·중·고등학교 교장",
          privateSubjectLabel: "사립학교 교장",
          gradeGroup: "제1호",
          gradeDetail: "공무원 여비 규정 별표 1 제1호 라목",
          patterns: [/교장|학교장|원장/]
        },
        {
          code: "teacher",
          roleCode: "teacher",
          roleLabel: "공립 교원",
          subjectLabel: "교원",
          privateSubjectLabel: "사립학교 교원",
          gradeGroup: "제2호",
          gradeDetail: "공무원 여비 규정 별표 1 제2호",
          patterns: [/교감|교사|교원|담임|선생님|선생|담당교사|장학사|교육연구사|기간제교원|기간제교사/]
        },
        {
          code: "localOfficer",
          roleCode: "localOfficer",
          roleLabel: "지방공무원·행정직",
          subjectLabel: "지방공무원·행정직",
          gradeGroup: "제2호",
          gradeDetail: "공무원 여비 규정 별표 1 제2호",
          patterns: [/행정직|행정실|지방공무원|교육행정직|교육행정|일반직|공무원/]
        },
        {
          code: "educationWorker",
          roleCode: "educationWorker",
          roleLabel: "교육공무직·특수운영직군",
          subjectLabel: "교육공무직·특수운영직군",
          gradeGroup: "소속기관 기준",
          gradeDetail: "소속 교육청 취업규칙·단체협약·여비 지침",
          localRuleFirst: true,
          patterns: [/교육공무직|특수운영직군|공무직|무기계약/]
        }
      ]
    }
  };
});
