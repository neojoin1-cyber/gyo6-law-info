# Policy Q&A Engine Roadmap

## Goal

규정 Q&A는 예문별 답변 사전이 아니라 다음 흐름으로 처리한다.

1. 사용자 질문 정규화
2. 의도 분류
3. 신분, 지역, 교육청, 학년도, 금액 항목, 증빙 항목 등 슬롯 추출
4. 구조화된 규정 데이터 조회
5. 공식 원문 출처 확인
6. 결론 우선 답변과 부족 조건 표시

## Current First Slice

- `public/policy-knowledge-base.js`
  - 규정 도메인, 출처 커넥터, 국내출장 금액표, 대상자 프로필을 분리한 구조화 지식베이스
- `public/policy-engine.js`
  - 브라우저와 Node 테스트가 함께 쓰는 규정 엔진
  - `buildPolicySemanticFrame` -> `analyzePolicyQuestion` -> `lookupPolicyRules` -> `buildPolicyResponse` 흐름으로 질의를 처리
  - 의미 프레임은 도메인 후보, 태스크, 슬롯, 누락 조건, 조회계획을 답변 생성 전에 분리한다.
- `tools/policy-query-engine.mjs`
  - 같은 엔진의 분석, 조회, 답변 조립 단계를 CLI와 향후 MCP 서버에서 호출하기 위한 Node 어댑터
- `tools/scenario-regression.mjs`
  - 출장 지역, 신분 표현, 질문 형식 변형을 생성해 회귀 검증
  - 현재 국내출장 550개 생성형 조합과 주요 수기 시나리오를 함께 검증

## Expansion Plan

### 1. Structured Rule Data

규정 데이터는 다음 구조로 별도 DB 또는 JSON에서 관리한다.

- `domain`: 복무, 여비, 휴가, 학교회계, 학생부, 학교폭력, 교육공무직 계약
- `ruleId`: 공무원 여비 규정, 국가공무원 복무규정, 교원휴가 예규 등
- `sourcePriority`: `national`, `office`, `school`, `contract`
- `requiredSlots`: 교육청, 학년도, 신분, 날짜, 항목, 증빙, 업무 단계
- `tables`: 금액표, 휴가일수표, 증빙표, 예산 비목표
- `source`: 법령/API/교육청 자료 URL, 시행일, 확인일

### 2. Source Connectors

공식 원문은 다음 순서로 붙인다.

- 국가법령정보센터 Open API: 법령, 행정규칙, 별표, 서식
- 교육부/공식 포털: 학생부, 학교폭력, 현장실습 등 전국 공통 지침
- 시도교육청 자료실: 학교회계 예산편성 지침, 교육공무직 취업규칙, 단체협약
- 자체 캐시 DB: 원문 URL, 제목, 시행연도, 교육청, 주제 태그 저장

### 3. MCP Server

향후 자체 MCP 서버는 다음 도구를 제공한다.

- `classify_policy_question`
- `search_policy_rules`
- `get_rule_table`
- `get_office_guideline`
- `verify_source_currentness`
- `compose_policy_answer`

도구는 답변 문장을 직접 만들기보다 다음 책임을 나누어야 한다.

- `classify_policy_question`: 사용자 질문에서 도메인과 슬롯만 추출
- `search_policy_rules`: 자체 DB와 공식 API에서 규정 후보 조회
- `get_rule_table`: 별표, 금액표, 휴가일수표, 증빙표를 구조화 데이터로 반환
- `verify_source_currentness`: 시행일, 개정일, 교육청 자료 연도를 검증
- `compose_policy_answer`: 조회 결과만 근거로 결론 우선 답변 작성

### 4. Regression Principle

새 규정 주제를 추가할 때는 단일 예문 테스트를 금지한다.

- 지역 변형
- 신분 표현 변형
- 질문 순서 변형
- 축약형/장문형
- 필수 조건 누락형

이 조합을 생성형 회귀 테스트로 추가한다.
