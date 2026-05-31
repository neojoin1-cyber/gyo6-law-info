# Cloud Run 빠른 배포 순서

## 1. Google Cloud Shell 열기

브라우저에서 Google Cloud Console에 로그인한 뒤 Cloud Shell을 엽니다.

## 2. 저장소 받기

```bash
git clone https://github.com/neojoin1-cyber/gyo6-law-info.git
cd gyo6-law-info
```

## 3. 게이트웨이 배포

```bash
bash gateways/korean-law-gateway/deploy-cloud-run.sh
```

입력할 값:

- `LAW_OC`: 법제처 OC 인증키
- `GYO6_MCP_TOKEN`: Worker와 게이트웨이가 공유할 긴 비밀 토큰

성공하면 Cloud Run URL이 출력됩니다.

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
