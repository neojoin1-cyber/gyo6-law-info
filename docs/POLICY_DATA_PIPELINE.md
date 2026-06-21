# Policy Data Pipeline

## 원칙

정책 Q&A는 답변 문장을 저장하지 않는다. 자체 DB에는 규정 원문, 시행일, 출처 URL, 표 데이터, 교육청·학년도·신분 같은 슬롯을 저장하고, 질문 이해 엔진은 슬롯을 뽑고, 규정 조회 엔진은 그 슬롯으로 근거를 찾고, 답변 조립 단계만 문장을 만든다.

## 처리 흐름

1. `analyzePolicyQuestion`
   - 질문을 정규화하고 도메인, 신분, 지역, 항목, 기관, 학년도, 증빙 조건을 추출한다.
   - 내부적으로 `buildPolicySemanticFrame`을 먼저 만들어 도메인 후보, 태스크, 슬롯, 누락 조건, 조회계획을 분리한다.
2. `lookupPolicyRules`
   - `public/policy-knowledge-base.js`의 구조화 규정표를 조회한다.
   - `public/policy-source-registry.js`의 공식자료 레지스트리와 `public/policy-corpus.js`의 로컬 코퍼스를 함께 검색한다.
   - 운영 단계에서는 자체 DB, 법제처 Open API, 교육청 공식 자료, MCP 게이트웨이를 같은 조회 단계에 붙인다.
3. `buildPolicyResponse`
   - 조회 결과의 금액표·휴가표·증빙표만 근거로 결론 우선 답변을 만든다.

## 자체 DB 초안

| 테이블 | 역할 |
| --- | --- |
| `policy_sources` | 법령, 행정규칙, 교육청 지침, 학교회계 지침의 제목·기관·URL·시행일·확인일 저장 |
| `policy_domains` | 출장, 휴가, 근태, 학교회계, 학생부, 학교폭력 등 주제 분류 |
| `policy_rules` | 도메인별 적용 규정, 우선순위, 필요 슬롯, 예외 조건 저장 |
| `policy_tables` | 여비 금액표, 휴가일수표, 강사수당표, 증빙표 같은 구조화 표 저장 |
| `office_guidelines` | 17개 시도교육청별 학년도 자료, 취업규칙, 단체협약, 예산편성 지침 저장 |
| `policy_regression_cases` | 질문 변형, 기대 슬롯, 기대 규정, 금지 문구를 저장해 회귀 테스트 생성 |

## 로컬 코퍼스 단계

| 파일 | 역할 |
| --- | --- |
| `public/policy-source-registry.js` | 법령, 교육부 지침, 교육청 지침, 학교 내부 규정, 증빙자료 수집 작업을 공식자료 레지스트리로 관리 |
| `public/policy-corpus.js` | KB 도메인, 공식자료, 공통 슬롯, 수집 작업을 검색 가능한 로컬 코퍼스 엔트리로 구성 |
| `policyEngine.lookupPolicyRules` | 질문 의미 프레임을 기준으로 `corpusMatches`를 붙여 실제 조회 후보를 답변 조립 단계에 전달 |

이 코퍼스는 정답 문장 사전이 아니라 “무엇을 어디에서 조회해야 하는지”를 찾는 색인이다. 예를 들어 학교폭력 질문은 `schoolViolenceProcedure` 도메인, 학교폭력 사안처리 지침, 피해학생 보호·보복 위험 슬롯을 함께 올리고, 급식 질문은 급식 운영 기준과 민원·식중독 위험 신호를 분리해 올린다.

## 공식 API 연결 순서

| 우선순위 | 출처 | 용도 | 연결 방식 |
| --- | --- | --- | --- |
| 1 | 국가법령정보 공동활용 Open API | 법령·행정규칙 목록조회, 본문조회, 조문, 별표, 시행일 검증 | `gateways/korean-law-gateway` 또는 자체 MCP 뒤에서 호출 |
| 2 | 지방교육재정알리미 Open API | 17개 시도교육청 재정 정보, 예산·결산·재정공시 계열 자료 확인 | 교육재정 질문의 보조 데이터로 사용 |
| 3 | 나이스 교육정보 개방 포털 Open API | 학교·교육정보 데이터 확인 | 규정 답변의 직접 근거가 아니라 학교·기관 맥락 보조로 사용 |
| 4 | 시도교육청 공식 자료실 | 학교회계 예산편성 지침, 교육공무직 취업규칙, 단체협약 | API가 없으면 공식 게시글 URL과 PDF/HWP를 캐시 DB로 수집 |

## MCP 도구 경계

| 도구 | 입력 | 출력 |
| --- | --- | --- |
| `classify_policy_question` | 사용자 질문 | 도메인, 슬롯, 누락 조건 |
| `search_school_policy_corpus` | 질문 의미 프레임 | 로컬 코퍼스의 도메인·공식자료·학교규정 후보 |
| `ingest_official_guideline` | 공식 자료 URL 또는 업로드 파일 | 정규화된 출처·섹션·표 메타데이터 |
| `search_policy_rules` | 도메인, 슬롯 | 규정 후보, 출처 우선순위 |
| `get_rule_table` | 규정 ID, 표 ID | 금액표·휴가표·증빙표 JSON |
| `get_office_guideline` | 교육청, 학년도, 주제 | 공식 자료 URL, 파일 메타데이터 |
| `get_school_rule` | 학교 내부 규정 종류, 학교급, 기관 | 학칙·생활규정·기숙사규정·학업성적관리규정 후보 |
| `verify_source_currentness` | 출처 URL, 기준일 | 시행일·개정일·확인 상태 |
| `compose_policy_answer` | 조회 결과 | 결론 우선 답변 카드 데이터 |

## 현재 구현 상태

- 국내출장 여비는 `policy-knowledge-base.js`의 구조화 데이터와 `policy-engine.js`의 3단 파이프라인으로 처리한다.
- `buildPolicySemanticFrame`은 질문을 바로 답변하지 않고 `domainCode`, `task`, `slots`, `missingSlots`, `lookupPlan`으로 먼저 해석한다.
- 학교정책 온톨로지는 학교폭력, 학급관리, 체험학습, 기숙사, 급식, 학생부, 안전, 특수교육, 평가, 방과후·늘봄까지 15개 도메인을 분류한다.
- 로컬 정책 코퍼스는 도메인 프로필, 공식자료, 공통 슬롯, 수집 작업을 검색해 `lookupPolicyRules.corpusMatches`로 반환한다.
- 회귀 테스트는 51개 수기 시나리오, 10개 학교 전반 정책 매트릭스, 550개 국내출장 생성형 조합, 330개 1박 2일 출장 조합을 검사한다.
- `tools/policy-kb-audit.mjs`는 지식베이스의 도메인, 커넥터, 로컬 코퍼스, 금액표, 엔진 조회 결과를 감사한다.

## 무료 야간 품질 루프

`tools/policy-quality-nightly.mjs`는 유료 API 호출 없이 법률정보 품질을 매일 끌어올리기 위한 로컬 작업이다. 답변 문장을 대량 저장하지 않고 다음 자료만 누적한다.

| 산출물 | 역할 |
| --- | --- |
| `data/policy-quality/source-expansion-queue.json` | 공식 원문·교육청 지침·학교규정 직접 URL 보강 후보 |
| `data/policy-quality/regression-candidates.json` | 약한 답변이 다시 나오지 않도록 회귀테스트로 승격할 질문 후보 |
| `data/policy-quality/training-cases.jsonl` | 질문 분류·슬롯 추출·금지 문구 개선용 무료 시뮬레이션 케이스 |
| `data/policy-quality/latest.json` | 최신 실행 요약, 약점 수, 도메인 불일치, Ollama 로컬 검토 여부 |

실행 명령:

```powershell
npm run policy:quality
npm run policy:quality:sources
npm run policy:quality:simulate
npm run policy:quality:evaluate
```

Windows 작업 스케줄러 등록:

```powershell
npm run policy:quality:install-schedule
npm run policy:quality:schedule
```

기본 심야 일정은 한국 시간 기준 `00:40` 출처 확충 큐, `02:40` 질문 시뮬레이션, `04:40` 답변 품질 평가다. Ollama가 켜져 있으면 평가 단계에서 일부 약한 사례를 로컬 모델로 재검토하고, 꺼져 있으면 규칙 엔진 평가만 수행한다.
