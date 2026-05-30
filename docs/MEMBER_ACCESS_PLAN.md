# GYO6 Law Info 회원·권한 관리 계획

## 목표

회원 등급에 따라 공개 콘텐츠, 채용정보, 법률정보 AI, 회원관리 기능을 분리한다.
화면에서 메뉴를 숨기는 것만으로 끝내지 않고, Cloudflare Worker API에서 Firebase 로그인 토큰과 회원 DB를 다시 확인한다.

## 회원 등급

| 등급 | 설명 | 주요 권한 |
| --- | --- | --- |
| pending | 가입 신청 또는 승인 대기 | 공개 콘텐츠 |
| general | 일반 사용자 | 공개 콘텐츠 |
| jobs | 채용정보 회원 | 공개 콘텐츠, 채용정보 |
| law | 법률정보 회원 | 공개 콘텐츠, 채용정보, 법률정보 AI |
| teacher | 교사/학교 회원 | 법률정보 AI, 보고서 활용, 향후 학교 기능 |
| admin | 관리자 | 회원 승인, 등급 변경, 권한 회수 |
| owner | 총괄관리자 | 관리자 권한 포함, 총괄관리자 권한 부여/회수 |

## 승인 상태

| 상태 | 의미 |
| --- | --- |
| pending | 가입 신청 후 승인 전 |
| approved | 이용 가능 |
| suspended | 이용 정지 |
| deleted | 삭제 처리, 서비스 이용 불가 |

## 서버 검증 흐름

1. 사용자가 Firebase Authentication으로 로그인한다.
2. 프론트엔드는 Firebase ID 토큰을 받아 Worker API 호출 시 `Authorization: Bearer <token>`으로 보낸다.
3. Worker는 Firebase 공개키로 ID 토큰을 검증한다.
4. Worker는 D1 `members` 테이블에서 회원 상태와 등급을 확인한다.
5. 법률정보 AI는 `law`, `teacher`, `admin`, `owner` 등급이면서 `approved` 상태인 경우만 허용한다.

## Cloudflare D1 준비

현재 원격 D1:

- 데이터베이스: `gyo6-law-info-member-db`
- Worker 바인딩: `MEMBER_DB`
- 마이그레이션: `0001_member_access.sql` 적용 완료

마이그레이션 파일:

```text
workers/ai-analysis/migrations/0001_member_access.sql
```

필요한 테이블:

- `members`: 회원 등급, 승인 상태, 연락처, 소속, 메모
- `member_audit_logs`: 권한 변경 기록
- `member_invitations`: 관리자가 이메일로 사전 승인한 회원

## 초기 운영 순서

1. Firebase 콘솔에서 Email/Password 로그인을 활성화한다.
2. 배포 환경에서는 Firebase Hosting의 `/__/firebase/init.json`으로 웹 앱 설정을 자동 로딩한다.
3. 첫 총괄관리자가 `OWNER_EMAILS`에 등록된 이메일로 로그인하면 자동 승인된다.
4. 총괄관리자가 다른 회원을 승인하고 등급을 부여한다.
5. 검증 완료 후 `AUTH_REQUIRED=true`로 전환해 법률정보 AI 접근을 제한한다.

## 주의

- `AUTH_REQUIRED=false` 상태에서는 기존 공개 테스트 흐름을 유지한다.
- `AUTH_REQUIRED=true`로 바꾸기 전에는 반드시 총괄관리자 로그인과 D1 회원 DB가 정상 동작하는지 확인한다.
- 현재 삭제는 서비스 이용권한 삭제 처리이며, Firebase Authentication 계정 자체 삭제는 Firebase Admin SDK 또는 별도 관리 절차가 필요하다.
