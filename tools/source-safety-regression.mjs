const SECRET_OC = "SECRET_OC_SHOULD_NOT_LEAK";
const SECRET_NANET = "SECRET_NANET_SHOULD_NOT_LEAK";
const seenLawSearchQueries = [];
const seenGatewayBodies = [];
const seenNanetQueries = [];

function fakeLawSearch(url) {
  const target = url.searchParams.get("target") || "law";
  seenLawSearchQueries.push(url.searchParams.get("query") || "");
  if (target !== "law") {
    return {
      LawSearch: {
        [target]: []
      }
    };
  }

  return {
    LawSearch: {
      law: [{
        법령명한글: "직업교육훈련 촉진법",
        법령일련번호: "276195",
        법령ID: "000864",
        소관부처명: "고용노동부,교육부",
        시행일자: "20251001",
        공포일자: "20251001",
        법령상세링크: `/DRF/lawService.do?OC=${SECRET_OC}&target=law&MST=276195&type=HTML`
      }]
    }
  };
}

function fakeLawService() {
  return {
    법령: {
      기본정보: {
        법령명_한글: "직업교육훈련 촉진법",
        법령일련번호: "276195",
        법령ID: "000864",
        시행일자: "20251001",
        공포일자: "20251001"
      },
      조문: {
        조문단위: [{
          조문여부: "조문",
          조문번호: "7",
          조문제목: "현장실습",
          조문시행일자: "20251001",
          조문내용: "제7조(현장실습) 직업교육훈련생의 현장실습에 관한 사항을 정한다."
        }]
      }
    }
  };
}

function fakeNanetPrecedent(url) {
  seenNanetQueries.push(url.searchParams.get("SEARCH_KEYWORD") || "");
  if (url.searchParams.get("KEY") !== SECRET_NANET) {
    throw new Error("NANET API key was not sent to the server-side OpenAPI call");
  }

  return {
    LAW_NAME_INFO: {
      RESULT_CODE: "SUCCESS",
      TOTAL_CNT: "1",
      RECORD: [{
        TRANS_PRECED_NAME: "현장실습 안전조치 관련 공식 자료",
        ORG_PRECED_NAME: "Field training safety reference",
        NATION_NAME: "대한민국",
        GUBUN_NAME: "판례·법률자료",
        CN: "NANET-2026-0001",
        PROC_DATE: "20260601",
        SUMMARY: "현장실습에서 안전조치와 보호 의무를 확인할 때 참고할 공식 법률자료 후보입니다.",
        DETAIL_URL: `https://law.nanet.go.kr/detail.do?cn=NANET-2026-0001&KEY=${SECRET_NANET}`
      }]
    }
  };
}

function installFetchMock() {
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "openapi-law.nanet.go.kr") {
      return jsonResponse(fakeNanetPrecedent(url));
    }
    if (url.hostname !== "www.law.go.kr") {
      throw new Error(`Unexpected network call: ${url.toString()}`);
    }
    if (url.pathname.endsWith("/lawSearch.do")) {
      return jsonResponse(fakeLawSearch(url));
    }
    if (url.pathname.endsWith("/lawService.do")) {
      return jsonResponse(fakeLawService());
    }
    throw new Error(`Unexpected law path: ${url.pathname}`);
  };
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function assertNoSecretLeak(label, value) {
  const text = JSON.stringify(value);
  if (text.includes(SECRET_OC) || /[?&]OC=/i.test(text)) {
    throw new Error(`${label} leaked law OC value or OC query parameter`);
  }
  if (text.includes(SECRET_NANET) || /[?&]KEY=/i.test(text)) {
    throw new Error(`${label} leaked NANET API key value or KEY query parameter`);
  }
}

installFetchMock();

process.env.LAW_OC = SECRET_OC;
const gateway = await import("../gateways/korean-law-gateway/server.mjs");
const gatewayResult = await gateway.searchAndRead({
  queries: ["직업교육훈련 촉진법"],
  keywords: ["현장실습"],
  maxArticles: 2
});

if (!gatewayResult.ok) {
  throw new Error("Gateway mock search failed");
}
assertNoSecretLeak("gateway", gatewayResult);

const { createApi } = await import("../functions/shared/api.mjs");
const api = createApi({
  LAW_OPEN_API_OC: SECRET_OC,
  LAW_OPEN_API_REFERER: "https://gyo6.kr/",
  NANET_API_KEY: SECRET_NANET
});
const searchUrl = new URL("https://gyo6.internal/api/search");
searchUrl.searchParams.set(
  "q",
  "홍길동 학생 010-1234-5678 상담입니다. 현장실습 시간 종료 후 회사명 ABC에서 청소를 반복 지시합니다."
);

const apiResult = await api.handleSearch(searchUrl);
assertNoSecretLeak("official source api", apiResult);

for (const query of seenLawSearchQueries) {
  if (/홍길동|010-1234-5678|ABC/.test(query)) {
    throw new Error(`official source query leaked sensitive text: ${query}`);
  }
}
for (const query of seenNanetQueries) {
  if (/홍길동|010-1234-5678|ABC/.test(query)) {
    throw new Error(`NANET source query leaked sensitive text: ${query}`);
  }
}
if (!apiResult.results?.precedents?.length) {
  throw new Error("NANET-backed search did not return official legal-library candidates");
}

const unexpectedDirectLawCalls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.hostname === "gateway.local") {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    seenGatewayBodies.push({ path: url.pathname, body });
    if (url.pathname.endsWith("/gyo6/law/interpretations")) {
      return jsonResponse({
        ok: true,
        generatedAt: "2026-05-31T00:00:00.000Z",
        source: "국가법령정보센터",
        protocol: "auto",
        interpretations: [
          {
            query: "현장실습",
            title: "현장실습 운영 기준 관련 교육부 법령해석",
            subtitle: "교육부",
            source: "국가법령정보센터",
            date: "2026.03.01",
            summary: "교육부 법령해석 후보",
            url: "https://www.law.go.kr/LSW/expcInfoP.do?mode=1",
            type: "교육부 법령해석",
            verifiedAt: "2026-05-31T00:00:00.000Z",
            reliability: {
              level: "source-dated",
              label: "원문 링크 확인",
              needsReview: false
            }
          },
          {
            query: "현장실습",
            title: "일반 법령해석례",
            subtitle: "법령해석례",
            source: "국가법령정보센터",
            date: "2025.01.01",
            summary: "일반 법령해석례 후보",
            url: "https://www.law.go.kr/LSW/expcInfoP.do?mode=2",
            type: "법령해석례",
            verifiedAt: "2026-05-31T00:00:00.000Z",
            reliability: {
              level: "source-dated",
              label: "원문 링크 확인",
              needsReview: false
            }
          }
        ],
        notices: []
      });
    }
    if (url.pathname.endsWith("/gyo6/law/admin-rules")) {
      const requestText = JSON.stringify(body);
      if (/생활지도|학생지도|휴대전화|수업방해|교육활동|교권/.test(requestText)) {
        return jsonResponse({
          ok: true,
          generatedAt: "2026-05-31T00:00:00.000Z",
          source: "국가법령정보센터",
          protocol: "auto",
          adminRules: [
            {
              query: "교원의 학생생활지도",
              title: "교원의 학생생활지도에 관한 고시",
              subtitle: "고시",
              source: "국가법령정보센터",
              ministry: "교육부",
              date: "2026.03.01",
              summary: "학생생활지도, 휴대전화, 수업 방해, 교육활동 관련 기준",
              url: "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=11111",
              type: "교육부 행정규칙",
              currentStatus: "현행",
              current: true,
              verifiedAt: "2026-05-31T00:00:00.000Z",
              reliability: {
                level: "source-dated",
                label: "원문 링크 확인",
                needsReview: false
              }
            },
            {
              query: "교원",
              title: "기간제교원의 봉급 지급에 관한 예규",
              subtitle: "예규",
              source: "국가법령정보센터",
              ministry: "교육부",
              date: "2026.01.01",
              summary: "기간제교원 봉급 지급 기준",
              url: "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=22222",
              type: "교육부 행정규칙",
              currentStatus: "현행",
              current: true,
              verifiedAt: "2026-05-31T00:00:00.000Z",
              reliability: {
                level: "source-dated",
                label: "원문 링크 확인",
                needsReview: false
              }
            },
            {
              query: "생활지도",
              title: "유치원 교원의 유아생활지도에 관한 고시",
              subtitle: "고시",
              source: "국가법령정보센터",
              ministry: "교육부",
              date: "2026.03.01",
              summary: "유치원 유아생활지도 기준",
              url: "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=33333",
              type: "교육부 행정규칙",
              currentStatus: "현행",
              current: true,
              verifiedAt: "2026-05-31T00:00:00.000Z",
              reliability: {
                level: "source-dated",
                label: "원문 링크 확인",
                needsReview: false
              }
            },
            {
              query: "교원",
              title: "교육공무원 인사관리규정",
              subtitle: "훈령",
              source: "국가법령정보센터",
              ministry: "교육부",
              date: "2026.01.01",
              summary: "교육공무원 인사관리 기준",
              url: "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=44444",
              type: "교육부 행정규칙",
              currentStatus: "현행",
              current: true,
              verifiedAt: "2026-05-31T00:00:00.000Z",
              reliability: {
                level: "source-dated",
                label: "원문 링크 확인",
                needsReview: false
              }
            }
          ],
          notices: []
        });
      }
      return jsonResponse({
        ok: true,
        generatedAt: "2026-05-31T00:00:00.000Z",
        source: "국가법령정보센터",
        protocol: "auto",
        adminRules: [
          {
            query: "학교폭력",
            title: "학교폭력 가해학생 조치별 적용 세부기준 고시",
            subtitle: "고시",
            source: "국가법령정보센터",
            ministry: "교육부",
            date: "2020.05.01",
            summary: "교육부 소관 학교폭력 조치 기준 고시",
            url: "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=12345",
            type: "교육부 행정규칙",
            currentStatus: "현행",
            current: true,
            verifiedAt: "2026-05-31T00:00:00.000Z",
            reliability: {
              level: "source-dated",
              label: "원문 링크 확인",
              needsReview: false
            }
          },
          {
            query: "직업계고 현장실습",
            title: "직업계고 현장실습 운영 지침",
            subtitle: "훈령",
            source: "국가법령정보센터",
            ministry: "교육부",
            date: "2026.03.01",
            summary: "현장실습, 실습생, 직업계고 운영 기준",
            url: "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=67890",
            type: "교육부 행정규칙",
            currentStatus: "현행",
            current: true,
            verifiedAt: "2026-05-31T00:00:00.000Z",
            reliability: {
              level: "source-dated",
              label: "원문 링크 확인",
              needsReview: false
            }
          },
          {
            query: "현장실습",
            title: "대학생 현장실습학기제 운영규정",
            subtitle: "고시",
            source: "국가법령정보센터",
            ministry: "교육부",
            date: "2026.03.01",
            summary: "대학생 현장실습학기제 운영 기준",
            url: "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=99999",
            type: "교육부 행정규칙",
            currentStatus: "현행",
            current: true,
            verifiedAt: "2026-05-31T00:00:00.000Z",
            reliability: {
              level: "source-dated",
              label: "원문 링크 확인",
              needsReview: false
            }
          }
        ],
        notices: []
      });
    }
    return jsonResponse({
      ok: true,
      generatedAt: "2026-05-31T00:00:00.000Z",
      source: "국가법령정보센터",
      protocol: "auto",
      laws: [{
        query: "직업교육훈련 촉진법",
        lawName: "직업교육훈련 촉진법",
        enforcementDate: "2025.10.01",
        promulgationDate: "2025.10.01",
        sourceUrl: "https://www.law.go.kr/LSW/lsSc.do?query=%EC%A7%81%EC%97%85%EA%B5%90%EC%9C%A1%ED%9B%88%EB%A0%A8%20%EC%B4%89%EC%A7%84%EB%B2%95",
        verifiedAt: "2026-05-31T00:00:00.000Z",
        articles: [{
          articleNo: "9",
          branchNo: "2",
          title: "현장실습 시간",
          effectiveDate: "2025.10.01",
          text: "미성년자 또는 재학 중인 직업교육훈련생의 현장실습 시간은 1일 7시간, 1주일 35시간을 초과하지 못한다."
        }]
      }],
      notices: [
        "법령 원문 조회 실패(보조 후보): HTTP 520",
        "국내재해사례는 조회되었지만 질문과 충분히 일치하는 정밀 후보가 없어 숨겼습니다."
      ]
    });
  }

  if (url.hostname === "www.law.go.kr") {
    unexpectedDirectLawCalls.push(url.toString());
    return jsonResponse({ result: "ERROR", msg: "HTTP 525" });
  }
  if (url.hostname === "openapi-law.nanet.go.kr") {
    return jsonResponse(fakeNanetPrecedent(url));
  }

  throw new Error(`Unexpected network call: ${url.toString()}`);
};

const gatewayApi = createApi({
  LAW_OPEN_API_OC: SECRET_OC,
  LAW_OPEN_API_REFERER: "https://gyo6.kr/",
  KOREAN_LAW_MCP_BASE_URL: "https://gateway.local",
  KOREAN_LAW_MCP_TOKEN: "TEST_GATEWAY_TOKEN",
  NANET_API_KEY: SECRET_NANET
});
const gatewayUrl = new URL("https://gyo6.internal/api/search");
gatewayUrl.searchParams.set("q", "현장실습 시간 종료 후 청소를 반복 지시합니다.");
gatewayUrl.searchParams.set("laws", "직업교육훈련 촉진법");
gatewayUrl.searchParams.set("keywords", "현장실습|청소|실습시간");

const gatewayApiResult = await gatewayApi.handleSearch(gatewayUrl);

if (unexpectedDirectLawCalls.length) {
  throw new Error(`gateway-backed search should not call direct law.go.kr fallback: ${unexpectedDirectLawCalls.join(", ")}`);
}
if (!gatewayApiResult.results?.laws?.length) {
  throw new Error("gateway-backed search did not return original law text");
}
if (!Array.isArray(gatewayApiResult.results?.precedents)) {
  throw new Error("gateway-backed search should always expose a precedents result slot");
}
if (!gatewayApiResult.results.precedents.length) {
  throw new Error("gateway-backed search should include NANET official legal-library candidates when the key is configured");
}
if (!gatewayApiResult.results?.educationAdminRules?.length) {
  throw new Error("gateway-backed search did not return education admin rules");
}
if (!gatewayApiResult.results?.educationInterpretations?.length) {
  throw new Error("gateway-backed search did not split education interpretations");
}
if (gatewayApiResult.results?.interpretations?.some((item) => /교육부/.test(`${item.title} ${item.type} ${item.subtitle}`))) {
  throw new Error("education interpretations should be separated from the general interpretation group");
}
if (!/현장실습/.test(gatewayApiResult.results.educationAdminRules[0].title || "")) {
  throw new Error(`education admin rules were not prioritized by case relevance: ${gatewayApiResult.results.educationAdminRules[0].title}`);
}
if (gatewayApiResult.results.educationAdminRules.some((item) => /대학생/.test(item.title || ""))) {
  throw new Error("college internship rules should not be shown for vocational high-school field-training questions");
}
if ((gatewayApiResult.results.educationAdminRules[0].relevance?.score || 0) < 70) {
  throw new Error("education admin rule priority score is too low for a direct field-training match");
}
const lifestyleUrl = new URL("https://gyo6.internal/api/search");
lifestyleUrl.searchParams.set("q", "교사가 학생의 휴대전화 사용과 수업 방해를 생활지도해야 하는 상황입니다.");
lifestyleUrl.searchParams.set("keywords", "학생생활지도|휴대전화|수업방해|교육활동");

const lifestyleApiResult = await gatewayApi.handleSearch(lifestyleUrl);

if (!lifestyleApiResult.results?.educationAdminRules?.length) {
  throw new Error("student life-guidance search did not return a focused education admin rule");
}
if (lifestyleApiResult.results.educationAdminRules[0].title !== "교원의 학생생활지도에 관한 고시") {
  throw new Error(`student life-guidance source was not prioritized correctly: ${lifestyleApiResult.results.educationAdminRules[0].title}`);
}
if (lifestyleApiResult.results.educationAdminRules.some((item) => /봉급|인사관리|유치원/.test(item.title || ""))) {
  throw new Error(`student life-guidance search exposed weak education rule candidates: ${lifestyleApiResult.results.educationAdminRules.map((item) => item.title).join(", ")}`);
}
for (const request of seenGatewayBodies) {
  if (request.path.endsWith("/gyo6/law/admin-rules") && /홍길동|010-1234-5678|ABC/.test(JSON.stringify(request.body))) {
    throw new Error(`education admin rule query leaked sensitive text: ${JSON.stringify(request.body)}`);
  }
}
if (!gatewayApiResult.notices.some((notice) => /원문 게이트웨이/.test(notice))) {
  throw new Error("gateway-backed search should keep the successful original-text notice");
}
if (gatewayApiResult.notices.some((notice) => /HTTP 5\d\d|실패|값이 없어|숨겼|관련도가 낮|fallback/i.test(notice))) {
  throw new Error(`gateway-backed search exposed noisy fallback notice: ${gatewayApiResult.notices.join(" / ")}`);
}

console.log("Source safety regression passed");
