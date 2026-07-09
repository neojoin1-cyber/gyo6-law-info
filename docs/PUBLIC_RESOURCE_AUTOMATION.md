# Public Resource Library Automation

Last updated: 2026-07-09 KST

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
   - 공식 교육청 게시판 상세 화면을 열어 PDF/HWP/HWPX/DOCX/XLSX/PPTX 첨부파일을 직접 추출한다.
   - 경북교육청 학교지원종합자료실처럼 본문 안에 다운로드 버튼이 들어 있는 콘텐츠 페이지도 따라가서 실제 파일 URL을 추출한다.
   - 충북교육청 학교폭력·성폭력 예방 자료처럼 별도 부서 게시판에 흩어진 안전·생활지도 지침과 서식도 수집한다.
   - 지침 안에 포함된 서식 후보는 원문 파일 URL과 함께 `extraction` 대기열에 표시한다.
   - 공개 자료 인덱스를 재생성한다.
3. `npm run policy:resources:verify`
   - 구글 검색 대행, 게시판 메인, 깨진 법령 경로를 차단한다.
   - `교원휴가에관한예규`가 `/법령/` 경로로 들어오지 못하게 막는다.
   - 공개 자료 총량, 지침 수, 서식 수, 직접 파일 수가 최소 기준보다 낮으면 실패한다.
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

## Official Attachment Harvest

2026-07-09 기준 자동 수집기는 경북교육청의 학생생활, 학교회계, 통합자료실, 현장체험학습, 인사정보, 감염병 대응, 학교운영위원회 게시판을 직접 조회한다. 또한 교육부·하이파이브 교육자료실에서 직업계고 현장실습 공통 매뉴얼, 서식모음집, 산업안전 자료, 실습일지 안내, 고졸청년 지원정책 자료를 직접 수집한다. 여기에 경북교육청 학교지원종합자료실의 콘텐츠형 자료와 충북교육청 학교폭력·성폭력 예방 부서 자료를 추가해, 게시판 목록뿐 아니라 본문 안의 다운로드 버튼까지 실제 파일 URL로 승격한다. 목록 검색에서 상세 게시글 번호를 찾고, 상세 화면의 `RAONKUPLOAD.AddUploadedFile(...)`, `/upload/...`, `fileDownload.do`, `FileDown.do`, `nttFileDownload.do`, `goFileDown(...)` 형태의 첨부파일을 원문 파일로 승격한다.

공개 자료실에는 검색 결과 링크가 아니라 실제 공식 첨부파일이나 법령 원문만 들어간다. 현재 기준 검증선은 공개 자료 1,000건 이상, 지침 330건 이상, 서식 650건 이상, 직접 파일 1,000건 이상, 지침 내부 서식 추출 대기열 650건 이상이다. 이 기준을 통과하지 못하면 scheduled workflow가 실패한다.

직업계고 핵심 자료는 별도 보호선이 있다. 하이파이브 자료 80건 이상, 경북교육청 학교지원종합자료실 자료 900건 이상, 충북교육청 학교폭력·성폭력 예방 자료 30건 이상, 취업·진로 자료 10건 이상, 직업계고 현장실습 공통 매뉴얼, 편집 가능한 한글 서식·서식모음집이 빠지면 검증이 실패한다.

## Embedded Form Split Queue

서식은 독립 파일이 아니라 지침·매뉴얼·규정의 붙임, 별지, 부록 안에 들어 있는 경우가 많다. 자동 수집기는 `서식`, `양식`, `신청서`, `보고서`, `동의서`, `협약서`, `점검표`, `체크리스트`, `붙임`, `별지`, `부록` 신호가 있는 원문 파일에 `extraction.embeddedFormCandidate`를 표시한다.

분리 산출물은 다음 조건을 만족할 때만 공개한다.

- 원문 공식 파일 URL을 보존한다.
- 서식 부분만 별도 PDF로 생성한다.
- 사용자가 편집할 수 있는 DOCX도 함께 생성한다.
- PDF/DOCX 렌더링 검증에서 잘림, 깨짐, 표 붕괴가 없어야 한다.
- 원문 출처와 생성 시각을 산출물 메타데이터에 남긴다.

이 구조는 자료실을 단순 링크 모음이 아니라 실무 서식창고로 확장하기 위한 대기열이다.
