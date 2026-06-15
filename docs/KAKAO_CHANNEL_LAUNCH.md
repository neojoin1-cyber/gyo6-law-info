# KakaoTalk Channel Launch Checklist

## Current Status

- Worker endpoint: `https://gyo6-law-info-ai.gyo6.workers.dev/api/kakao/skill`
- Kakao skill response format: `version: "2.0"`
- First chat bubble: concise summary, clarification need, and source/detail button guidance
- GPT question normalizer: enabled in auto mode after pilot approval
- Monthly AI budget cap setting: `OPENAI_MONTHLY_STOP_USD=20` with `OPENAI_KRW_PER_USD=1500`
- Default office when unspecified: 경상북도교육청

## Recommended Skill URL

초기 내부 테스트:

```text
https://gyo6-law-info-ai.gyo6.workers.dev/api/kakao/skill
```

공개 공유 전 권장:

```text
https://gyo6-law-info-ai.gyo6.workers.dev/api/kakao/skill?token=<KAKAO_SKILL_TOKEN>
```

`KAKAO_SKILL_TOKEN`을 Worker secret으로 설정하면 토큰 없는 요청은 `401`로 차단된다.

## User Approval Gate

과금 보호를 위해 카카오 챗봇도 관리자 승인 사용자에게만 답변한다.

- `KAKAO_AUTH_REQUIRED=true`이면 카카오 사용자 식별키를 기준으로 이용권한을 확인한다.
- 승인되지 않은 사용자는 D1 `members` 테이블에 `pending` 상태로 자동 등록된다.
- 관리자 화면의 회원관리에서 해당 사용자를 `law`로 승인하거나 총괄관리자 `owner`로 확인된 경우에만 챗봇 이용이 열린다.
- `teacher`, `admin`, `jobs`, `general` 권한은 전자책 서재 또는 관리 기능 권한으로 유지되며 법률정보 챗봇 과금 경로에는 들어가지 않는다.
- 승인 전에는 GPT 질문정규화, 슬롯추출, 정책 답변 생성이 실행되지 않는다.
- 긴급 파일럿은 `KAKAO_APPROVED_USER_KEYS`에 원 카카오 키, `kakao:<key>`, 해시, 또는 `KAKAO-XXXXXXXXXX` 식별번호를 쉼표로 넣어 임시 허용할 수 있다.

승인 대기 사용자는 챗봇에서 다음과 같은 식별번호를 받는다.

```text
KAKAO-XXXXXXXXXX
```

관리자는 회원 목록에서 `kakao-<hash>@kakao.local` 항목 또는 메모의 식별번호를 확인해 승인한다.

## Kakao Admin Setup

1. 카카오톡 채널을 준비한다.
2. 챗봇 관리자센터에서 봇을 만든다.
3. 스킬 서버 URL에 위 endpoint를 등록한다.
4. 발화 블록은 자유질문형으로 열어 둔다.
5. 기본 시나리오의 `폴백 블록`도 같은 자유질문 스킬 블록으로 연결한다.
   - 이 설정이 빠지면 사용자가 자유롭게 질문했을 때 카카오 기본 응답인 `무엇을 원하는지 잘 모르겠어요`, `제가 할 수 있는 일이 아니에요`가 먼저 나올 수 있다.
   - 테스트 발화 `포항에 있는 학교의 행정실 주무관의 안동 1박2일 출장시 출장비는?`가 스킬 응답으로 가야 한다.
6. 웰컴 블록과 폴백 블록에서 `상담원 연결` 카드/버튼을 삭제한다.
   - 카카오비즈니스 채널 관리의 채팅 설정에서도 상담직원/상담원 연결 안내가 켜져 있으면 끈다.
   - 이 서비스는 자동 규정 Q&A 파일럿이므로 상담원 연결 버튼을 노출하지 않는다.
7. 실패/예외 안내 문구는 다음처럼 둔다.

```text
질문 요지를 아직 정확히 잡지 못했습니다. 학교급, 신분, 소속 교육청, 업무 단계를 한 가지라도 더 적어 주세요.
```

8. 내부 테스트 후 채널 공개 범위를 넓힌다.

## Must-Pass Kakao Admin Tests

카카오 관리자센터 봇테스트와 실제 채널 채팅에서 아래를 확인한다.

```text
포항에 있는 학교의 행정실 주무관의 안동 1박2일 출장시 출장비는?
```

- 정상: `일비 50,000원`, `식비 50,000원`, `숙박비 70,000원`, `최대 170,000원` 중 핵심 금액이 응답에 보인다.
- 비정상: `무엇을 원하는지 잘 모르겠어요`, `제가 할 수 있는 일이 아니에요`가 나오면 폴백 블록이 스킬 URL로 연결되지 않은 것이다.
- 비정상: `상담원 연결` 버튼이나 카드가 보이면 웰컴/폴백 블록 또는 채널 상담 설정에 상담원 연결이 남아 있는 것이다.

## Teacher And Student Intro Copy

### Teachers

```text
학교 규정, 복무, 출장 여비, 현장실습, 생활지도, 학교회계, 학생부·출결 등 특성화고 현장에서 자주 부딪히는 질문을 카카오톡으로 물어보세요. 소속 교육청과 신분을 함께 적으면 더 정확합니다.
```

### Students

```text
현장실습, 안전, 취업, 출결, 학교생활 관련 궁금한 점을 쉬운 말로 물어보세요. 개인 이름, 전화번호, 주민등록번호 같은 정보는 적지 않는 것이 좋습니다.
```

## Internal Smoke Test Questions

```text
교장의 경주 출장시 일비 식비는?
기간제교사의 병가는 몇일 가능하며 어떻게 신청하나요?
현장실습 중 위험기계 사고가 나면 학교와 기업은 무엇을 해야 하나요?
이거 나이스에 올려야 하나요?
부산교육청 기준으로 방과후학교 수강료 환불은 어떻게 하나요?
```

## Privacy Notice For GPT NLU

GPT 발문정리는 2026-06-13 파일럿 승인 후 자동 모드로 켜져 있다. 운영 조건은 다음과 같다.

- 사용자가 외부 AI 발문정리 사용 가능성을 알 수 있어야 한다.
- 전화번호, 이메일, 주민등록번호 형태의 직접 식별자는 OpenAI 호출 전에 마스킹한다.
- GPT는 최종 답변이나 답변 근거를 만들지 않고 도메인·슬롯·완성질문 JSON만 생성한다.
- 최종 답변은 기존 규정 지식베이스와 출처 엔진이 생성한다.
- 월 예산 차단선과 OpenAI 프로젝트 예산 제한을 함께 설정한다.

## Launch Decision

현재 상태는 규칙 엔진 기반 카카오 Q&A에 GPT 질문정규화 자동 보정 계층을 더한 제한 공개 파일럿이다. 카카오 관리자센터의 폴백 블록이 자유질문 스킬로 연결되어야 실제 채팅방에서도 이 흐름이 동작한다.
