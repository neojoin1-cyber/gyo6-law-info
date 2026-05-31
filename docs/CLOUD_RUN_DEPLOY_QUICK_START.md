# Cloud Run 빠른 배포 순서

## 1. Google Cloud Shell 열기

브라우저에서 Google Cloud Console에 로그인한 뒤 Cloud Shell을 엽니다.

## 2. 가장 쉬운 배포 명령

Cloud Shell에 아래 명령을 그대로 붙여넣습니다.

```bash
curl -fsSL https://raw.githubusercontent.com/neojoin1-cyber/gyo6-law-info/main/tools/cloud-shell-deploy-law-gateway.sh | bash
```

처음 실행할 때 입력할 값:

- `LAW_OC`: 법제처 OC 인증키
- `GYO6_MCP_TOKEN`: Worker와 게이트웨이가 공유할 긴 비밀 토큰

이미 한 번 성공해서 Secret Manager에 저장되어 있으면 다음 배포부터는 저장된 `gyo6-law-oc`, `gyo6-law-gateway-token` 값을 자동으로 재사용합니다. 이 경우 입력 프롬프트가 나오지 않아야 정상입니다.

스크립트가 저장소 clone/update, Secret Manager 저장, Cloud Run 배포, 원문 조회 테스트까지 실행합니다.

## 3. 수동으로 진행할 경우

### 3-1. 저장소 받기

```bash
git clone https://github.com/neojoin1-cyber/gyo6-law-info.git
cd gyo6-law-info
```

### 3-2. 게이트웨이 배포

```bash
bash gateways/korean-law-gateway/deploy-cloud-run.sh
```

처음 실행할 때 입력할 값:

- `LAW_OC`: 법제처 OC 인증키
- `GYO6_MCP_TOKEN`: Worker와 게이트웨이가 공유할 긴 비밀 토큰

이미 Secret Manager에 값이 있으면 자동으로 읽어 사용합니다. 프롬프트가 다시 나오면 저장된 secret 이름이 바뀌었거나 접근 권한이 없는 상태입니다.

성공하면 Cloud Run URL이 출력됩니다. `LAW_API_PROTOCOL` 기본값은 `auto`라서 HTTPS 원문 조회를 먼저 시도하고, 런타임 네트워크에서 TLS 문제가 생기면 HTTP를 한 번 더 시도합니다.

## 4. 로컬 PowerShell에서 Worker 연결

```powershell
cd C:\Projects\gyo6-law-info
npm run law-gateway:connect-worker
```

입력할 값:

- Cloud Run URL
- 위에서 입력한 `GYO6_MCP_TOKEN`

이 스크립트는 게이트웨이 원문 조회, Worker secret 설정, Worker 배포, Worker 검색 API 확인까지 한 번에 실행합니다.

## 5. 성공 기준

Worker health에서 `sources.koreanLawMcp`가 `true`로 표시되어야 합니다.

`/api/search` 결과의 법령 후보가 `법제처 원문 확인` 또는 `국가법령정보센터 원문 API`로 표시되면 연결 성공입니다.

## 6. 막힐 때 판단

- 결제 계정 또는 Cloud Run API 오류: Google Cloud 프로젝트 `gyo6-law-info`에서 결제 계정 연결과 Cloud Run API 사용 설정을 확인합니다.
- Secret Manager 권한 오류: 스크립트를 다시 실행하면 기본 Compute 서비스 계정에 secret accessor 권한을 다시 부여합니다.
- 법제처 HTTPS/TLS 오류: 기본값 `LAW_API_PROTOCOL=auto`가 HTTPS 후 HTTP를 재시도합니다. 계속 실패하면 Cloud Run URL과 오류 메시지를 보관한 뒤 게이트웨이 로그를 확인합니다.
- Worker health의 `sources.koreanLawMcp`가 `false`: 로컬에서 `npm run law-gateway:connect-worker`를 실행해 Cloud Run URL과 토큰을 Worker secret으로 넣어야 합니다.
