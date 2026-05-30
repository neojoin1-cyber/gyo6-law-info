const SECRET_OC = "SECRET_OC_SHOULD_NOT_LEAK";
const seenLawSearchQueries = [];

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

function installFetchMock() {
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
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
  LAW_OPEN_API_REFERER: "https://gyo6.kr/"
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

console.log("Source safety regression passed");
