# Korean Law MCP 자체 호스팅 운영안

## 왜 자체 호스팅인가

Cloudflare Worker에서 `law.go.kr`를 직접 호출하면 TLS 핸드셰이크 단계에서 `HTTP 525`가 발생한다. 로컬 PC에서는 같은 요청이 `200`으로 응답하므로 API 키 문제가 아니라 Cloudflare Worker와 법제처 서버 사이의 연결 호환성 문제로 본다.

Korean Law MCP를 Cloudflare 바깥의 별도 서버에 자체 호스팅하면 다음 흐름으로 우회할 수 있다.

```text
GYO6 Worker -> 자체 MCP 게이트웨이 -> Korean Law MCP -> law.go.kr
```

## 예상 비용

초기 테스트 기준 예상 비용은 낮다.

- Cloud Run, Render, Fly.io, 작은 VPS 중 하나를 사용한다.
- 요청량이 작으면 월 0원~수천 원 수준으로 시작할 수 있다.
- 항상 켜두는 VPS를 쓰면 월 고정비가 생긴다.
- OpenAI 비용을 직접 줄이는 도구는 아니지만, 공식자료를 먼저 좁혀 가져오면 OpenAI 입력 토큰과 재질문 횟수를 줄이는 데 도움이 된다.

## 반드시 지킬 보안 조건

1. 법제처 `LAW_OC` 키는 MCP 서버 안에만 둔다.
2. 브라우저와 GitHub에는 절대 넣지 않는다.
3. MCP 서버를 무인증 공개 API로 열지 않는다.
4. GYO6 Worker에서만 호출할 수 있도록 `KOREAN_LAW_MCP_TOKEN` 같은 서버 간 토큰을 둔다.
5. 학생명, 학교명, 기업명, 전화번호 등 민감정보는 MCP 검색어에 넣지 않는다.
6. 호출량 제한과 캐시를 적용한다.

## GYO6 연동 환경변수

GYO6 Worker는 아래 값이 있을 때 Korean Law MCP를 법령 검색 우선 출처로 사용한다.

```env
KOREAN_LAW_MCP_BASE_URL=https://your-mcp-gateway.example.com
KOREAN_LAW_MCP_TOKEN=server-to-server-token
KOREAN_LAW_MCP_TIMEOUT_MS=12000
KOREAN_LAW_MCP_RESEARCH_ENABLED=false
```

`KOREAN_LAW_MCP_RESEARCH_ENABLED=false`가 기본값이다. 처음에는 `search_law`만 연결하고, 안정화된 뒤 `chain_full_research` 같은 긴 체인 도구를 켠다.

## 권장 구축 순서

1. Cloud Run 또는 유사한 Node 호스팅에 MCP 게이트웨이를 만든다.
2. 게이트웨이는 `X-GYO6-MCP-TOKEN`을 확인한 요청만 Korean Law MCP로 전달한다.
3. Korean Law MCP 컨테이너에는 `LAW_OC`, `LAW_API_PROTOCOL=http` 또는 `https`, `RATE_LIMIT_RPM`을 설정한다.
4. GYO6 Worker secret/variable에 `KOREAN_LAW_MCP_BASE_URL`, `KOREAN_LAW_MCP_TOKEN`을 넣는다.
5. `/api/search`에서 법령 검색 결과가 `Korean Law MCP / 국가법령정보센터`로 표시되는지 확인한다.
6. 안정화 후 보고서 생성 뒤 `verify_citations` 후처리를 붙인다.

## 현재 반영 상태

- GYO6 `/api/search`는 `KOREAN_LAW_MCP_BASE_URL`이 설정되면 법령 검색에서 MCP를 우선 사용한다.
- MCP가 없거나 실패하면 기존 법제처 직접 API 또는 원문 직접 확인 링크로 fallback 한다.
- MCP 종합 리서치(`chain_full_research`)는 비용·지연·응답 길이를 고려해 기본 비활성화 상태다.
