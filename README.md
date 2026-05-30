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

## 다음 개발 순서

1. Firebase Functions 의존성 설치와 Secret 등록
2. Firebase Hosting + Functions 배포
3. 배포 URL에서 법제처·안전보건공단 API 재검증
4. 법제처 법령 검색 결과 정규화 고도화
5. 안전보건공단 국내재해사례와 안전보건자료 응답 필드 정리
6. 승인 대기 중인 사법정보공유포털·국회법률도서관 API 연결
7. AI 요약 기능 연결
8. 비용 제한, 사용량 제한, 안내문 강화
9. 개인 홈페이지 카드에서 이 서비스로 링크 연결

## 보안 메모

API 키와 Firebase 설정값은 `.env` 계열 파일에 두고 Git에 커밋하지 않습니다. 공개 프론트엔드에 비밀 키를 직접 넣지 않습니다.

로컬 개발에서는 다음 값을 사용합니다.

```env
LAW_OPEN_API_OC=
LAW_OPEN_API_REFERER=https://gyo6.kr/
PUBLIC_DATA_API_KEY=
OPENAI_API_KEY=
```

Firebase 배포 전에는 Functions Secret에 같은 값을 등록합니다. Secret 등록과 실제 배포는 외부 Firebase 프로젝트 상태를 바꾸므로 실행 직전 사용자 확인을 받고 진행합니다.

```powershell
firebase functions:secrets:set LAW_OPEN_API_OC
firebase functions:secrets:set PUBLIC_DATA_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
```

배포 명령은 사용자 확인 후 실행합니다.

```powershell
npm --prefix functions install
firebase deploy --only functions,hosting
```
