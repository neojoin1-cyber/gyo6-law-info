(function attachPublicResourceAcquisition(root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = data;
  } else {
    root.GYO6_PUBLIC_RESOURCE_ACQUISITION = data;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createPublicResourceAcquisition() { return {
  "version": "generated-2026-07-09T04-17-47-802Z",
  "generatedAt": "2026-07-09T04:17:47.802Z",
  "stats": {
    "existingResources": 28,
    "missions": 8,
    "candidates": 137,
    "publicCandidates": 7,
    "highPriority": 49,
    "directUrlNeeded": 129,
    "byCategory": {
      "privacyRecords": 8,
      "staffLabor": 11,
      "studentLife": 36,
      "general": 12,
      "schoolViolenceSafety": 25,
      "careerEmployment": 13,
      "fieldTraining": 16,
      "schoolAdmin": 16
    }
  },
  "missions": [
    {
      "category": "fieldTraining",
      "label": "현장실습·직업교육",
      "existing": 0,
      "directCount": 0,
      "byType": {},
      "missingTypes": [
        "law",
        "rule",
        "guide",
        "form"
      ],
      "minPublic": 36,
      "minDirect": 8,
      "coverageScore": 0,
      "status": "needs_acquisition"
    },
    {
      "category": "schoolViolenceSafety",
      "label": "학교폭력·안전",
      "existing": 0,
      "directCount": 0,
      "byType": {},
      "missingTypes": [
        "law",
        "rule",
        "guide",
        "form"
      ],
      "minPublic": 34,
      "minDirect": 8,
      "coverageScore": 0,
      "status": "needs_acquisition"
    },
    {
      "category": "schoolAdmin",
      "label": "학교회계·행정",
      "existing": 0,
      "directCount": 0,
      "byType": {},
      "missingTypes": [
        "law",
        "rule",
        "guide",
        "form"
      ],
      "minPublic": 30,
      "minDirect": 7,
      "coverageScore": 0,
      "status": "needs_acquisition"
    },
    {
      "category": "privacyRecords",
      "label": "개인정보·기록",
      "existing": 0,
      "directCount": 0,
      "byType": {},
      "missingTypes": [
        "law",
        "rule",
        "guide",
        "form"
      ],
      "minPublic": 24,
      "minDirect": 6,
      "coverageScore": 0,
      "status": "needs_acquisition"
    },
    {
      "category": "careerEmployment",
      "label": "취업·진로",
      "existing": 0,
      "directCount": 0,
      "byType": {},
      "missingTypes": [
        "law",
        "rule",
        "guide",
        "form"
      ],
      "minPublic": 24,
      "minDirect": 5,
      "coverageScore": 0,
      "status": "needs_acquisition"
    },
    {
      "category": "general",
      "label": "공통·기타",
      "existing": 0,
      "directCount": 0,
      "byType": {},
      "missingTypes": [
        "law",
        "rule",
        "guide",
        "form"
      ],
      "minPublic": 20,
      "minDirect": 5,
      "coverageScore": 0,
      "status": "needs_acquisition"
    },
    {
      "category": "studentLife",
      "label": "학생생활·학적",
      "existing": 2,
      "directCount": 2,
      "byType": {
        "rule": 1,
        "form": 1
      },
      "missingTypes": [
        "law",
        "rule",
        "guide",
        "form"
      ],
      "minPublic": 32,
      "minDirect": 8,
      "coverageScore": 11,
      "status": "needs_acquisition"
    },
    {
      "category": "staffLabor",
      "label": "교직원 복무·노무",
      "existing": 2,
      "directCount": 2,
      "byType": {
        "law": 1,
        "rule": 1
      },
      "missingTypes": [
        "law",
        "rule",
        "guide",
        "form"
      ],
      "minPublic": 32,
      "minDirect": 8,
      "coverageScore": 11,
      "status": "needs_acquisition"
    }
  ],
  "candidates": [
    {
      "id": "mission-privacyrecords-law-law-go-kr-개인정보-보호법",
      "category": "privacyRecords",
      "type": "law",
      "title": "개인정보 보호법",
      "provider": "국가법령정보센터",
      "query": "개인정보 보호법 학교 개인정보 처리 영상정보처리기기",
      "url": "https://www.law.go.kr/법령/%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%EB%B3%B4%ED%98%B8%EB%B2%95",
      "searchDomain": "law.go.kr",
      "description": "국가법령정보센터 공식자료에서 개인정보 보호법 학교 개인정보 처리 영상정보처리기기 원문·서식을 확인하는 자동 확보 후보",
      "priority": "high",
      "source": "mission-seed",
      "missionLabel": "개인정보·기록",
      "reason": "개인정보·기록 자료실 확보 목표 0/24, 직접 원문 0/6",
      "qualityScore": 96,
      "includeInLibrary": true,
      "needsDirectUrl": false,
      "generatedAt": "2026-07-09T04:17:47.802Z"
    },
    {
      "id": "mission-stafflabor-rule-law-go-kr-교원휴가에-관한-예규",
      "category": "staffLabor",
      "type": "rule",
      "title": "교원휴가에 관한 예규",
      "provider": "교육부·국가법령정보센터",
      "query": "교원휴가에 관한 예규 연가 병가 공가 특별휴가",
      "url": "https://www.law.go.kr/행정규칙/%EA%B5%90%EC%9B%90%ED%9C%B4%EA%B0%80%EC%97%90%EA%B4%80%ED%95%9C%EC%98%88%EA%B7%9C",
      "searchDomain": "law.go.kr",
      "description": "교육부·국가법령정보센터 공식자료에서 교원휴가에 관한 예규 연가 병가 공가 특별휴가 원문·서식을 확인하는 자동 확보 후보",
      "priority": "high",
      "source": "mission-seed",
      "missionLabel": "교직원 복무·노무",
      "reason": "교직원 복무·노무 자료실 확보 목표 2/32, 직접 원문 2/8",
      "qualityScore": 96,
      "includeInLibrary": true,
      "needsDirectUrl": false,
      "generatedAt": "2026-07-09T04:17:47.802Z"
    },
    {
      "id": "mission-stafflabor-rule-law-go-kr-국가공무원-복무규정",
      "category": "staffLabor",
      "type": "rule",
      "title": "국가공무원 복무규정",
      "provider": "국가법령정보센터",
      "query": "국가공무원 복무규정 복무 휴가 출장",
      "url": "https://www.law.go.kr/법령/%EA%B5%AD%EA%B0%80%EA%B3%B5%EB%AC%B4%EC%9B%90%EB%B3%B5%EB%AC%B4%EA%B7%9C%EC%A0%95",
      "searchDomain": "law.go.kr",
      "description": "국가법령정보센터 공식자료에서 국가공무원 복무규정 복무 휴가 출장 원문·서식을 확인하는 자동 확보 후보",
      "priority": "high",
      "source": "mission-seed",
      "missionLabel": "교직원 복무·노무",
      "reason": "교직원 복무·노무 자료실 확보 목표 2/32, 직접 원문 2/8",
      "qualityScore": 96,
      "includeInLibrary": true,
      "needsDirectUrl": false,
      "generatedAt": "2026-07-09T04:17:47.802Z"
    },
    {
      "id": "mission-studentlife-rule-law-go-kr-2025-학교생활기록-작성-및-관리지침",
      "category": "studentLife",
      "type": "rule",
      "title": "2025 학교생활기록 작성 및 관리지침",
      "provider": "교육부·국가법령정보센터",
      "query": "2025 학교생활기록 작성 및 관리지침 출결 정정 보존",
      "url": "https://www.law.go.kr/행정규칙/%ED%95%99%EA%B5%90%EC%83%9D%ED%99%9C%EA%B8%B0%EB%A1%9D%EC%9E%91%EC%84%B1%EB%B0%8F%EA%B4%80%EB%A6%AC%EC%A7%80%EC%B9%A8",
      "searchDomain": "law.go.kr",
      "description": "교육부·국가법령정보센터 공식자료에서 2025 학교생활기록 작성 및 관리지침 출결 정정 보존 원문·서식을 확인하는 자동 확보 후보",
      "priority": "high",
      "source": "mission-seed",
      "missionLabel": "학생생활·학적",
      "reason": "학생생활·학적 자료실 확보 목표 2/32, 직접 원문 2/8",
      "qualityScore": 96,
      "includeInLibrary": true,
      "needsDirectUrl": false,
      "generatedAt": "2026-07-09T04:17:47.802Z"
    },
    {
      "id": "mission-general-law-law-go-kr-2025-초-중등교육법",
      "category": "general",
      "type": "law",
      "title": "2025 초·중등교육법",
      "provider": "국가법령정보센터",
      "query": "2025 초중등교육법 학생 지도 학칙 학교운영",
      "url": "https://www.law.go.kr/법령/%EC%B4%88%C2%B7%EC%A4%91%EB%93%B1%EA%B5%90%EC%9C%A1%EB%B2%95",
      "searchDomain": "law.go.kr",
      "description": "국가법령정보센터 공식자료에서 2025 초중등교육법 학생 지도 학칙 학교운영 원문·서식을 확인하는 자동 확보 후보",
      "priority": "high",
      "source": "mission-seed",
      "missionLabel": "공통·기타",
      "reason": "공통·기타 자료실 확보 목표 0/20, 직접 원문 0/5",
      "qualityScore": 88,
      "includeInLibrary": true,
      "needsDirectUrl": true,
      "generatedAt": "2026-07-09T04:17:47.802Z"
    },
    {
      "id": "mission-general-law-law-go-kr-2026-초-중등교육법",
      "category": "general",
      "type": "law",
      "title": "2026 초·중등교육법",
      "provider": "국가법령정보센터",
      "query": "2026 초중등교육법 학생 지도 학칙 학교운영",
      "url": "https://www.law.go.kr/법령/%EC%B4%88%C2%B7%EC%A4%91%EB%93%B1%EA%B5%90%EC%9C%A1%EB%B2%95",
      "searchDomain": "law.go.kr",
      "description": "국가법령정보센터 공식자료에서 2026 초중등교육법 학생 지도 학칙 학교운영 원문·서식을 확인하는 자동 확보 후보",
      "priority": "high",
      "source": "mission-seed",
      "missionLabel": "공통·기타",
      "reason": "공통·기타 자료실 확보 목표 0/20, 직접 원문 0/5",
      "qualityScore": 88,
      "includeInLibrary": true,
      "needsDirectUrl": true,
      "generatedAt": "2026-07-09T04:17:47.802Z"
    },
    {
      "id": "mission-studentlife-rule-law-go-kr-2026-학교생활기록-작성-및-관리지침",
      "category": "studentLife",
      "type": "rule",
      "title": "2026 학교생활기록 작성 및 관리지침",
      "provider": "교육부·국가법령정보센터",
      "query": "2026 학교생활기록 작성 및 관리지침 출결 정정 보존",
      "url": "https://www.law.go.kr/행정규칙/%ED%95%99%EA%B5%90%EC%83%9D%ED%99%9C%EA%B8%B0%EB%A1%9D%EC%9E%91%EC%84%B1%EB%B0%8F%EA%B4%80%EB%A6%AC%EC%A7%80%EC%B9%A8",
      "searchDomain": "law.go.kr",
      "description": "교육부·국가법령정보센터 공식자료에서 2026 학교생활기록 작성 및 관리지침 출결 정정 보존 원문·서식을 확인하는 자동 확보 후보",
      "priority": "high",
      "source": "mission-seed",
      "missionLabel": "학생생활·학적",
      "reason": "학생생활·학적 자료실 확보 목표 2/32, 직접 원문 2/8",
      "qualityScore": 88,
      "includeInLibrary": true,
      "needsDirectUrl": true,
      "generatedAt": "2026-07-09T04:17:47.802Z"
    }
  ]
}; });
