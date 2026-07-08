# Public Resource Library Automation

Last updated: 2026-07-08 KST

## Purpose

상담자료실의 법률, 규정, 지침, 서식 자료를 하루 3회 자동 점검한다. 공개 자료실에는 구글 검색 대행, 기관 메인/게시판 목록, 깨진 법령 링크를 넣지 않고, 바로 열 수 있는 공식 원문·파일·상세 페이지 자료만 반영한다.

## Schedule

GitHub Actions workflow: `.github/workflows/public-resource-feed.yml`

- 09:20 KST
- 17:20 KST
- 01:20 KST
- 수동 실행: GitHub Actions `Update public resource library` > `Run workflow`

GitHub cron is UTC, so the workflow uses:

```yaml
cron: "20 0,8,16 * * *"
```

## Pipeline

1. `npm run policy:quality:sources`
   - 공식 출처 레지스트리와 현재성 상태를 점검한다.
2. `npm run policy:resources:autopilot`
   - 자료실 임무별 부족 영역을 계산하고 자동 확보 후보를 만든다.
   - 법령·행정규칙처럼 직접 URL을 확정할 수 있는 자료는 공개 후보로 승격한다.
   - 공개 자료 인덱스를 재생성한다.
3. `npm run policy:resources:verify`
   - 구글 검색 대행, 게시판 메인, 깨진 법령 경로를 차단한다.
   - `교원휴가에관한예규`가 `/법령/` 경로로 들어오지 못하게 막는다.
4. `npm run test:kakao-skill`
   - 상담자료실 UI와 공개 자료 인덱스 회귀 조건을 확인한다.
5. 변경이 있을 때만 다음 파일을 자동 커밋한다.
   - `public/public-resource-acquisition-generated.js`
   - `public/public-resource-index-generated.js`
   - `functions/public/public-resource-acquisition-generated.js`
   - `functions/public/public-resource-index-generated.js`

## Deploy

워크플로는 `FIREBASE_TOKEN` repository secret이 있으면 Firebase Hosting까지 자동 배포한다. secret이 없으면 자료 인덱스 커밋까지만 수행한다. Firebase-GitHub 자동 배포가 별도로 연결되어 있으면 커밋 이후 그 경로로 반영된다.

## Quality Rule

공개 자료실에 들어갈 수 있는 링크:

- `law.go.kr/법령/...`
- `law.go.kr/행정규칙/...`
- `law.go.kr/LSW/admRul...`
- PDF/HWP/HWPX/DOCX/XLSX/PPTX 등 직접 파일
- 공식 사이트의 상세 자료 페이지

공개 금지:

- `google.com/search`
- 기관 홈페이지 첫 화면
- 게시판 목록 화면
- “원문 후보”, “검색 대행”, “확인 필요” 문구
- 행정규칙을 `/법령/` 경로로 잘못 만든 링크
