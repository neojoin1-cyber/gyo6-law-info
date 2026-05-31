# GYO6 Korean Law Gateway

법제처 최신 원문을 Cloudflare Worker 바깥에서 읽기 위한 최소 Node 게이트웨이입니다.

## 역할

- 법령명으로 국가법령정보센터 Open API 검색
- 현행 법령 원문 조회
- 질문 키워드와 관련 있는 조문을 압축해 반환
- GYO6 Worker가 호출할 수 있는 `/gyo6/law/search-and-read` 제공
- MCP 호환 최소 엔드포인트 `/mcp` 제공

## 환경변수

```env
LAW_OC=법제처_OC_키
LAW_OPEN_API_REFERER=https://gyo6.kr/
LAW_API_PROTOCOL=https
GYO6_MCP_TOKEN=서버간_호출_토큰
PORT=8080
LAW_GATEWAY_TIMEOUT_MS=12000
```

`LAW_OC`, `LAW_OPEN_API_OC`, `LAW_OPEN_API_KEY` 중 하나가 있으면 법제처 인증키로 사용합니다.
법제처 사용자 검증 때문에 `LAW_OPEN_API_REFERER`는 API 신청 때 등록한 도메인과 맞춰야 합니다. 기본값은 `https://gyo6.kr/`입니다.

법제처 서버와 HTTPS 연결이 맞지 않는 호스팅 환경에서는 `LAW_API_PROTOCOL=http`를 테스트합니다.

## 로컬 단발 테스트

프로젝트 루트의 `.env.local`에 `LAW_OPEN_API_KEY` 또는 `LAW_OPEN_API_OC`가 있으면 아래 명령으로 바로 확인할 수 있습니다.

```powershell
node gateways/korean-law-gateway/server.mjs --once "직업교육훈련 촉진법" 현장실습 청소
```

성공하면 `ok: true`, `source: "국가법령정보센터"`, `lawName`, `enforcementDate`, `articles`가 함께 출력됩니다.

## 로컬 서버 실행

```powershell
node gateways/korean-law-gateway/server.mjs
```

```powershell
curl.exe -s http://localhost:8080/health
```

## GYO6 Worker 연결

게이트웨이를 Cloud Run 등 외부에 배포한 뒤 Worker에 아래 값을 설정합니다.

```env
KOREAN_LAW_MCP_BASE_URL=https://배포주소
KOREAN_LAW_MCP_TOKEN=서버간_호출_토큰
```

GYO6 Worker는 해당 값이 있으면 법령 검색에서 이 게이트웨이를 우선 사용하고, 실패하면 기존 법제처 직접 API/원문 링크로 fallback 합니다.

## Cloud Run 배포 준비

이 폴더에는 Cloud Run 컨테이너 배포용 `Dockerfile`이 포함되어 있습니다.

Google Cloud Shell에서 저장소를 받은 뒤 아래 스크립트를 실행하면 필요한 API 활성화, Secret Manager 저장, Cloud Run 배포, 원문 조회 테스트까지 한 번에 진행합니다.

```bash
bash gateways/korean-law-gateway/deploy-cloud-run.sh
```

기본값:

```env
PROJECT_ID=gyo6-law-info
REGION=asia-northeast3
SERVICE_NAME=gyo6-korean-law-gateway
LAW_OPEN_API_REFERER=https://gyo6.kr/
LAW_API_PROTOCOL=https
```

```powershell
gcloud run deploy gyo6-korean-law-gateway `
  --source gateways/korean-law-gateway `
  --region asia-northeast3 `
  --allow-unauthenticated
```

배포 시 Cloud Run 환경변수 또는 Secret Manager에 아래 값을 넣습니다. 실제 인증키와 서버간 토큰은 명령어 기록에 남지 않도록 콘솔/Secret Manager 입력을 권장합니다.

```env
LAW_OC=법제처_OC_키
LAW_OPEN_API_REFERER=https://gyo6.kr/
GYO6_MCP_TOKEN=서버간_호출_토큰
LAW_API_PROTOCOL=https
LAW_GATEWAY_TIMEOUT_MS=12000
```

배포 URL이 나오면 Worker에 `KOREAN_LAW_MCP_BASE_URL`을 그 URL로 설정하고, `KOREAN_LAW_MCP_TOKEN`은 게이트웨이의 `GYO6_MCP_TOKEN`과 같은 값으로 설정합니다.

로컬 PowerShell에서 Worker 연결값을 넣습니다.

```powershell
npm run law-gateway:connect-worker
```

Cloud Run URL과 Cloud Run 배포 때 입력한 서버간 토큰을 물어봅니다. 스크립트는 게이트웨이 health, 원문 조문 조회, Worker secret 설정, Worker 재배포, Worker 검색 API 확인까지 순서대로 실행합니다.

수동으로 처리해야 할 때만 아래 명령을 사용합니다.

```powershell
npx.cmd wrangler secret put KOREAN_LAW_MCP_BASE_URL --config workers/ai-analysis/wrangler.toml
npx.cmd wrangler secret put KOREAN_LAW_MCP_TOKEN --config workers/ai-analysis/wrangler.toml
npm run worker:deploy
```
