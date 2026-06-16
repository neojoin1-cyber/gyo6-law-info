# GYO6 Law Info

특성화고 취업과 학교 현장을 위한 AI 법률정보 도우미 MVP 프로젝트입니다.

이 프로젝트는 개인 홈페이지와 분리된 별도 서비스입니다. 전자책 시스템 프로젝트와도 섞지 않습니다.

## 목표

특성화고 학생, 선생님, 학부모, 학교 구성원이 취업과 학교 현장에서 마주치는 법률 질문을 입력하면 관련 법령, 쉬운 말 요약 초안, 원문 확인 링크를 함께 보여주는 정보 제공 서비스를 만듭니다.

초기 표현은 "무료 법률상담"이 아니라 "AI 법률정보 도우미"로 유지합니다.

초기 핵심 주제는 특성화고 취업, 도제학교, 국내 현장실습, 해외 현장실습, 중대재해, 학교폭력, 교직원·행정직 인사와 노무, 학생관리, 민원 대응입니다.

## 중요한 고지

이 서비스는 법률 자문이나 사건 판단을 제공하지 않습니다. 공개 법령, 판례, 행정자료를 찾기 쉽게 정리하는 정보 제공 도구입니다. 실제 분쟁, 계약, 소송, 형사 사건, 행정 처분처럼 중요한 판단은 변호사 등 전문가와 상담해야 합니다.

## 현재 상태

- 정적 MVP 화면 구성 완료
- 질문 입력 UI 구성
- 특성화고 취업과 학교 현장 중심으로 첫 화면 문구 조정
- 질문 유형과 정리 방식 선택 추가
- 확인 순서 체크리스트 표시
- 법률정보 제공 고지 포함
- 법제처 원문 검색 링크 준비
- 로컬 API 프록시 서버 추가
- 법제처 Open API, 안전보건공단 국내재해사례, 안전보건자료 링크 API 후보 연결
- API 키는 `.env.local`에서만 읽고 브라우저에는 노출하지 않음
- 법제처 Open API는 신청 도메인 검증을 통과하도록 `LAW_OPEN_API_REFERER` 헤더를 서버에서 함께 전송
- Firebase Hosting + Functions 배포 구조 준비
- Cloudflare Workers 기반 AI 사안 분석·공식자료 검색 API 배포
- Cloudflare D1 회원 DB와 `MEMBER_DB` 바인딩 구성
- Firebase Hosting 자동 설정(`/__/firebase/init.json`)을 이용한 로그인 UI 준비
- GitHub 원격 저장소 `neojoin1-cyber/gyo6-law-info` 연결 및 `main` push 완료

## 로컬 확인

정적 화면만 볼 때는 브라우저에서 `public/index.html`을 열면 됩니다.

실제 API 후보까지 확인할 때는 로컬 서버를 실행합니다.

```powershell
npm run dev
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:5173
```

자바스크립트 문법 검사는 다음 명령으로 확인합니다.

```powershell
npm run check
```

### 로컬 Ollama 보강

로컬 개발 서버는 무료 규정 엔진의 기본 답변을 먼저 보여준 뒤, PC에 Ollama가 있으면 같은 근거 안에서 문장만 더 읽기 좋게 보강합니다. 보강 모델은 기본값으로 `qwen3:4b-instruct`를 사용합니다.

```powershell
ollama pull qwen3:4b-instruct
npm run dev
```

상태 확인:

```text
http://localhost:5173/api/local-llm/health
```

끄려면 `.env.local`에 다음 값을 둡니다.

```env
LOCAL_LLM_ENABLED=false
```

## 다음 개발 순서

1. Firebase 콘솔에서 Email/Password 로그인을 활성화하고 실제 회원가입 흐름을 검증
2. 총괄관리자 계정 로그인 후 회원 승인·권한 회수 UI 검증
3. 검증 완료 후 `AUTH_REQUIRED=true`로 전환해 법률정보 AI 접근 제한
4. Korean Law MCP의 인용 검증·캐시 구조를 참고해 공식자료 검증 후처리 강화
5. 법제처 API가 Cloudflare Worker에서 `HTTP 525`를 반환하는 연결 문제의 별도 중계 방안 검토
6. 사법정보공유포털 API 연결 및 국회법률도서관 OpenAPI 허용 IP 등록
7. 채용정보·전자책 서재 권한 등급과 메뉴 연결
8. 개인 홈페이지 카드에서 이 서비스로 링크 연결

## Cloudflare Workers AI 분석 API

AI 분석 API는 Firebase Blaze 없이 사용할 수 있도록 Cloudflare Workers로 분리했습니다.

Worker 위치:

```text
workers/ai-analysis
```

배포 전 Wrangler 로그인이 필요합니다.

```powershell
npx wrangler login
```

OpenAI 키와 공식자료 키는 Worker Secret으로 등록합니다. 키를 코드나 `public` 폴더에 넣지 않습니다.

```powershell
npx wrangler secret put OPENAI_API_KEY --config workers/ai-analysis/wrangler.toml
npx wrangler secret put NANET_API_KEY --config workers/ai-analysis/wrangler.toml
```

Worker 배포:

```powershell
npm run worker:deploy
```

배포 후 나온 Workers URL을 `public/ai-config.js`에 넣습니다.

```js
window.GYO6_AI_WORKER_BASE_URL = "https://gyo6-law-info-ai.<계정명>.workers.dev";
```

그 다음 Firebase Hosting에는 정적 파일만 배포하면 됩니다.

```powershell
firebase deploy --only hosting --project gyo6-law-info
```

Cloudflare Worker는 `/api/analyze`를 제공하며, AI가 먼저 다음 항목을 구조화해 돌려줍니다.

- 확인된 사실
- 추정하면 안 되는 사실
- 핵심 쟁점
- 꼭 필요한 추가 질문
- 주체별 조치
- 증빙자료 우선순위
- 전문가 상담 상향 여부

기존 규칙형 화면은 AI API 실패 시 보이는 보조 안전장치로 유지합니다.

### 공식자료 우선 분석

Worker는 `/api/analyze` 호출 전에 내부 공식자료 검색을 먼저 실행하고, 압축된 근거 후보를 AI 입력에 함께 전달합니다. 이 구조는 공개 Korean Law MCP의 "도구 기반 법령 확인" 접근을 참고하되, 학생·학교·기업 관련 민감한 질문을 제3자 서버로 보내지 않도록 자체 Worker 안에서 처리합니다.

자세한 검토 내용은 [docs/MCP_INTEGRATION_REVIEW.md](docs/MCP_INTEGRATION_REVIEW.md)를 참고합니다.

자체 호스팅 Korean Law MCP 또는 MCP 게이트웨이를 연결할 때는 `KOREAN_LAW_MCP_BASE_URL`과 `KOREAN_LAW_MCP_TOKEN`을 Worker 환경변수/secret으로 설정합니다. 무인증 공개 MCP 서버는 사용하지 않습니다. 운영안은 [docs/KOREAN_LAW_MCP_SELF_HOSTING.md](docs/KOREAN_LAW_MCP_SELF_HOSTING.md)를 따릅니다.

국회법률도서관 OpenAPI가 `ERROR11`을 반환하면 키가 아니라 접속 허용 IP 문제입니다. Worker 또는 별도 Cloud Run 게이트웨이의 고정 출구 IP를 승인 목록에 등록해야 실제 후보가 표시됩니다.

## 보안 메모

API 키와 Firebase 서버 비밀값은 `.env` 계열 파일에 두고 Git에 커밋하지 않습니다. 공개 프론트엔드에 비밀 키를 직접 넣지 않습니다. 배포 환경의 Firebase 웹 앱 공개 설정은 Firebase Hosting의 `/__/firebase/init.json`을 통해 자동 로딩합니다. 로컬 개발 서버도 같은 경로를 `.env.local`의 `FIREBASE_*` 값으로 제공하므로, Firebase 설정값을 `public` 파일에 직접 적지 않습니다.

로컬 개발에서는 다음 값을 사용합니다.

```env
LAW_OPEN_API_OC=
LAW_OPEN_API_REFERER=https://gyo6.kr/
PUBLIC_DATA_API_KEY=
NANET_API_KEY=
NANET_API_BASE_URL=http://lnp.nanet.go.kr/openapi/lawpreced
KOREAN_LAW_MCP_BASE_URL=
KOREAN_LAW_MCP_TOKEN=
OPENAI_API_KEY=
```

현재 AI 분석 운영은 Cloudflare Worker Secret의 `OPENAI_API_KEY`를 우선 사용합니다. Firebase Functions는 향후 Firestore, Auth, 보고서 저장소가 본격화될 때 사용할 수 있는 보조 배포 경로입니다.

## 비용 관리 기준

AI 분석은 품질을 위해 기본 모델을 `gpt-5.2`로 유지하고, Worker가 OpenAI 응답의 실제 input/output 토큰을 받아 1회 예상 비용을 계산합니다. 화면에는 이번 답변 비용, 오늘 누적, 이번 달 누적이 표시됩니다.

초기 비용 보호선은 다음과 같습니다.

```env
OPENAI_KRW_PER_USD=1500
OPENAI_MONTHLY_WARN_USD=10
OPENAI_MONTHLY_STOP_USD=50
OPENAI_DAILY_CALL_LIMIT=30
OPENAI_COST_PRICING_DATE=2026-05-30
```

브라우저 화면의 누적값은 현재 브라우저 기준의 추정치입니다. 실제 청구와 계정 전체 차단은 OpenAI 대시보드의 사용량·예산 설정을 최종 기준으로 확인합니다.

## 회원·권한 관리

회원 시스템은 Firebase Authentication으로 로그인하고, Cloudflare Worker가 Firebase ID 토큰과 D1 회원 DB를 확인하는 구조로 설계했습니다.

1차 권한 등급:

- `general`: 일반 사용자
- `jobs`: 채용정보 회원
- `law`: 법률정보 회원
- `teacher`: 교사/학교 회원
- `admin`: 관리자
- `owner`: 총괄관리자

초기 배포는 기존 테스트 흐름을 막지 않도록 `AUTH_REQUIRED=false`입니다. D1 `MEMBER_DB`, `OWNER_EMAILS` 설정과 마이그레이션은 적용되어 있으며, Firebase Auth 로그인 검증이 끝난 뒤 `AUTH_REQUIRED=true`로 전환하면 법률정보 AI 접근이 승인 회원으로 제한됩니다.

자세한 운영 계획은 [docs/MEMBER_ACCESS_PLAN.md](docs/MEMBER_ACCESS_PLAN.md)를 참고합니다.

```powershell
npm --prefix functions install
firebase deploy --only functions,hosting
```
