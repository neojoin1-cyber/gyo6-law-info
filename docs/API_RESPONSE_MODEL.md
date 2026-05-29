# API 응답 모델 초안

이 문서는 법제처 Open API, 판례 검색, 교육부·교육청 자료 검색을 실제로 연결할 때 결과를 한 화면에 안정적으로 표시하기 위한 응답 모델 초안이다.

## 목표

- 출처가 다른 자료를 같은 결과 화면에서 비교할 수 있게 한다.
- 법령 원문, 행정자료, 판례, 안전자료를 구분한다.
- AI 요약은 원문과 분리해 표시한다.
- 사용자가 어떤 자료를 먼저 열어야 하는지 우선순위를 제공한다.

## 검색 요청 모델

```json
{
  "question": "현장실습 중 안전사고가 나면 어떤 법령을 확인해야 하나요?",
  "role": "teacher",
  "topic": "fieldTraining",
  "scopes": ["law", "admin", "case", "source"],
  "answerMode": "plain",
  "keywords": ["현장실습", "안전사고", "직업교육훈련 촉진법"]
}
```

## 공유 가능한 질문 URL

MVP 화면은 테스트와 안내를 쉽게 하기 위해 URL 파라미터로 질문을 미리 넣을 수 있다.

```text
public/index.html?q=현장실습%20안전사고&role=teacher&topic=fieldTraining&mode=plain&scopes=law,admin,case,source&run=1
```

지원 파라미터:

- `q` 또는 `question`: 질문 본문
- `role`: `student`, `teacher`, `parent`, `principal`, `staff`
- `topic`: `employment`, `apprenticeship`, `fieldTraining`, `overseasTraining`, `schoolSafety`, `schoolViolence`, `staffLabor`, `civilComplaint`
- `mode`: `plain`, `source`, `checklist`
- `scopes`: `law,admin,case,source`처럼 쉼표로 구분
- `run=1`: 페이지가 열리면 바로 결과 렌더링

## 검색 결과 모델

```json
{
  "topic": {
    "id": "fieldTraining",
    "title": "현장실습과 학생 안전 관련 법령",
    "tags": ["현장실습", "안전관리", "실습 협약"]
  },
  "roleGuide": {
    "role": "teacher",
    "label": "선생님 관점",
    "advice": "상담 기록, 지도 절차, 학교 규정, 교육청 안내와 함께 확인할 원문을 정리합니다."
  },
  "riskSignals": ["중대재해"],
  "materials": [
    {
      "rank": 1,
      "type": "law",
      "title": "직업교육훈련 촉진법",
      "source": "국가법령정보센터",
      "url": "https://www.law.go.kr/...",
      "reason": "현장실습 운영과 직업교육훈련 기준을 확인합니다.",
      "effectiveDate": "YYYY-MM-DD",
      "retrievedAt": "YYYY-MM-DD"
    }
  ],
  "sourcePlan": [
    {
      "rank": 1,
      "label": "행정자료",
      "source": "교육부·교육청",
      "reason": "학교 현장에서 실제 절차를 운영할 때 필요한 공식 안내입니다."
    }
  ],
  "factPrompts": [
    "실습 협약서가 있나요?",
    "사고나 문제가 발생한 날짜와 장소는 어디인가요?"
  ],
  "notice": "이 서비스는 법률 자문이나 사건 판단을 제공하지 않습니다."
}
```

## 자료 유형

| type | 의미 | 대표 출처 |
| --- | --- | --- |
| law | 법령·조문 | 국가법령정보센터 |
| admin | 행정자료·지침 | 교육부, 교육청, 고용노동부 |
| case | 판례 | 법원 판례 검색, 사법정보공유포털 |
| safety | 안전자료 | 고용노동부, 안전보건공단 |
| expert | 전문가 확인 | 변호사, 노무사, 교육청 담당 부서 |

## 정렬 규칙

1. 주제별 기본 우선순위를 먼저 적용한다.
2. 사용자가 선택한 자료 범위를 반영한다.
3. 중요한 위험 표현이 있으면 전문가 확인 안내를 상단에 표시한다.
4. 최신성, 원문 여부, 공식기관 여부를 점수화한다.
5. AI 요약은 정렬 기준이 아니라 보조 설명으로만 사용한다.

## 점수화 초안

```text
officialScore = 공식기관이면 40점
sourceScore = 원문 URL이 있으면 30점
topicScore = 주제 키워드와 맞으면 20점
freshnessScore = 최신 자료이면 10점
total = officialScore + sourceScore + topicScore + freshnessScore
```

## 화면 표시 원칙

- 제목, 출처, 자료 유형, 확인 이유, 원문 링크를 한 카드에 표시한다.
- 시행일이나 확인일이 있으면 함께 표시한다.
- 원문 링크가 없는 자료는 "후보"로 표시하고, 사용자가 직접 검색하도록 안내한다.
- 판례는 일반 사용자가 오해하지 않도록 "보조 자료"라고 표시한다.
- 행정자료는 법령과 구분해 "현장 운영 안내"로 표시한다.
