import { createApi as createOfficialSourceApi } from "../../../functions/shared/api.mjs";
import {
  buildKakaoSkillResponseFromResult,
  handlePolicyChatRequest,
  normalizeKakaoRequest
} from "../../../functions/shared/policy-chat.mjs";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const MODEL_PRICE_DEFAULTS = {
  "gpt-5.4-nano": {
    inputUsdPer1M: 0.2,
    cachedInputUsdPer1M: 0.02,
    outputUsdPer1M: 1.25
  },
  "gpt-5.4-mini": {
    inputUsdPer1M: 0.75,
    cachedInputUsdPer1M: 0.075,
    outputUsdPer1M: 4.5
  },
  "gpt-5.4": {
    inputUsdPer1M: 2.5,
    cachedInputUsdPer1M: 0.25,
    outputUsdPer1M: 15
  },
  "gpt-5.2": {
    inputUsdPer1M: 1.75,
    cachedInputUsdPer1M: 0.175,
    outputUsdPer1M: 14
  },
  "gpt-4.1": {
    inputUsdPer1M: 2,
    cachedInputUsdPer1M: 0.5,
    outputUsdPer1M: 8
  }
};

const DEFAULT_COST_CONTROL = {
  krwPerUsd: 1500,
  monthlyWarnUsd: 10,
  monthlyStopUsd: 20,
  dailyCallLimit: 30,
  pricingDate: "2026-06-13"
};
const DEFAULT_KAKAO_NORMALIZER_TIMEOUT_MS = 1800;
const KAKAO_CLARIFICATION_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
let kakaoClarificationTableEnsured = false;

const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const APPROVED_MEMBER_STATUSES = new Set(["approved"]);
const LAW_ACCESS_ROLES = new Set(["admin", "owner"]);
const ADMIN_ROLES = new Set(["admin", "owner"]);
const OWNER_ROLES = new Set(["owner"]);
const EBOOK_STUDENT_ROLES = new Set(["student", "teacher", "school_admin_teacher", "admin", "owner"]);
const EBOOK_TEACHER_ROLES = new Set(["teacher", "school_admin_teacher", "admin", "owner"]);
const MEMBER_ROLES = ["pending", "general", "jobs", "law", "student", "teacher", "school_admin_teacher", "admin", "owner"];
const MEMBER_STATUSES = ["pending", "approved", "suspended", "deleted"];
const COUNSEL_ROOMS = new Set(["student", "teacher"]);
const BOARD_ROOMS = new Set(["promotion", "collaboration", "qna"]);
const CONSULTATION_STATUSES = new Set(["open", "answered", "closed"]);
const EBOOK_CATALOG = [
  {
    ebookId: "fb-service-l3-2026-ext",
    subject: "식음료서비스",
    title: "식음료서비스 외부평가 전자책",
    level: "L3",
    year: "2026",
    status: "sample",
    lessons: [
      {
        lessonId: "fb.c01.l01",
        lessonTitle: "식음료 영업 준비 1차시",
        unitTitle: "영업 전 점검",
        estimatedMinutes: 50
      }
    ]
  }
];
const FB_SERVICE_C01_STUDENT_LESSON = {
  schemaVersion: "gyo6-ebook-v1",
  audience: "student",
  ebookId: "fb-service-l3-2026-ext",
  sourceBookId: "FB_SERVICE_L3_2026_EXT",
  subject: "식음료서비스",
  lessonId: "fb.c01.l01",
  lessonTitle: "식음료 영업 준비 1차시",
  unitTitle: "영업 전 점검",
  estimatedMinutes: 50,
  policy: {
    teacherNoteIncluded: false,
    teacherGuideIncluded: false,
    answerVisibility: "after_attempt_or_review_mode"
  },
  steps: [
    {
      stepId: "fb.c01.l01.s01",
      title: "도입",
      phase: "intro",
      studentBlocks: [
        { blockId: "fb.c01.l01.s01.b01", type: "headline", html: "손님이 문을 열고 들어오기 전, 매장은 이미 평가받기 시작합니다." },
        { blockId: "fb.c01.l01.s01.b02", type: "activity_prompt", html: "좋은 첫인상을 만드는 요소를 조명, 온도, 위생, 안전, 비품 관점에서 떠올려 봅니다." }
      ],
      questions: [],
      studentExplanations: []
    },
    {
      stepId: "fb.c01.l01.s02",
      title: "핵심 개념",
      phase: "concept",
      studentBlocks: [
        { blockId: "fb.c01.l01.s02.b01", type: "concept", html: "영업 전 점검은 고객 입장 전에 물리적 환경, 위생 상태, 안전 상태, 비품 재고를 체계적으로 확인하는 과정입니다." },
        { blockId: "fb.c01.l01.s02.b02", type: "mnemonic", html: "조·냉·위·안·비 = 조명, 냉난방, 위생, 안전, 비품" }
      ],
      questions: [],
      studentExplanations: []
    },
    {
      stepId: "fb.c01.l01.s03",
      title: "온도 기준 확인",
      phase: "question",
      studentBlocks: [
        { blockId: "fb.c01.l01.s03.b01", type: "prompt", html: "여름과 겨울의 실내 적정 온도를 다르게 맞춰야 한다면 각각 몇 도 정도일까요?" }
      ],
      questions: [
        {
          questionId: "fb.c01.q001",
          type: "short_answer",
          promptHtml: "여름과 겨울의 실내 적정 온도 기준을 쓰세요.",
          answerPolicy: "after_attempt",
          expectedAnswerHtml: "여름 26°C 내외, 겨울 20°C 내외",
          studentExplanationHtml: "계절별로 적정 온도를 다르게 유지합니다. 시험에서는 여름과 겨울 수치를 뒤바꾼 보기가 자주 나옵니다."
        }
      ],
      studentExplanations: [
        { blockId: "fb.c01.l01.s03.e01", showAfter: "attempt", html: "일반 기준은 여름 26°C 내외, 겨울 20°C 내외입니다." }
      ]
    },
    {
      stepId: "fb.c01.l01.s04",
      title: "현장 판단",
      phase: "question",
      studentBlocks: [
        { blockId: "fb.c01.l01.s04.b01", type: "prompt", html: "점검하다 불량 전구를 발견했습니다. 나중에 처리할까요, 즉시 교체 요청할까요?" }
      ],
      questions: [
        {
          questionId: "fb.c01.q002",
          type: "oral_or_choice",
          promptHtml: "불량 전구 발견 시 적절한 조치를 고르세요.",
          options: ["영업 중 고객이 말하면 처리한다.", "나중에 시간이 남으면 처리한다.", "즉시 교체를 요청한다.", "조명을 끄고 영업한다."],
          correctOptionIndex: 2,
          answerPolicy: "after_attempt",
          studentExplanationHtml: "영업 전 점검은 손님이 보기 전에 위험과 불편을 제거하는 과정입니다. 조명 불량은 분위기와 안전에 영향을 주므로 즉시 교체 요청이 맞습니다."
        }
      ],
      studentExplanations: []
    },
    {
      stepId: "fb.c01.l01.s05",
      title: "정리",
      phase: "summary",
      studentBlocks: [
        { blockId: "fb.c01.l01.s05.b01", type: "summary", html: "영업 전 점검 5대 영역: 조명, 냉난방, 위생, 안전, 비품" },
        { blockId: "fb.c01.l01.s05.b02", type: "keyline", html: "핵심은 고객 입장 전 완료입니다." }
      ],
      questions: [
        {
          questionId: "fb.c01.q003",
          type: "multiple_choice",
          promptHtml: "다음 중 식음료 영업장의 영업 전 점검 항목으로 옳지 않은 것은?",
          options: ["영업장 바닥과 창문의 청결 상태를 확인한다.", "비상구 표시등의 점등 여부를 매일 확인한다.", "테이블 위 냅킨·설탕·크리머 등 비품 재고를 점검한다.", "고객 주문을 받은 후 메뉴판을 영업장 입구에 비치한다."],
          correctOptionIndex: 3,
          answerPolicy: "after_attempt",
          studentExplanationHtml: "영업 전 점검은 고객이 입장하기 전에 완료해야 하는 사전 준비 과정입니다. 고객 주문 후 처리하는 것은 영업 전 점검 항목이 아닙니다."
        }
      ],
      studentExplanations: []
    }
  ],
  assets: [
    { assetId: "fb.c01.cover", sourcePath: "textbooks 또는 teacher-tools 파이프라인의 C01_0.jpg 계열 이미지", status: "owner_confirmation_needed" }
  ]
};
const FB_SERVICE_C01_TEACHER_LESSON = {
  ...FB_SERVICE_C01_STUDENT_LESSON,
  audience: "teacher",
  allowedRoles: ["owner", "admin", "school_admin_teacher", "teacher"],
  steps: [
    {
      stepId: "fb.c01.l01.s01",
      title: "도입",
      phase: "intro",
      studentBlocks: [
        { blockId: "fb.c01.l01.s01.b01", type: "headline", html: "손님이 문을 열고 들어오기 전, 매장은 이미 평가받기 시작합니다." }
      ],
      teacherNotes: [
        { noteId: "fb.c01.l01.s01.tn01", source: "A안 slides[].notes", html: "이 화면에서는 정답을 말하지 말고 ‘첫인상’이라는 키워드만 열어 둡니다." }
      ],
      teacherGuides: [
        { guideId: "fb.c01.l01.s01.tg01", type: "teacher_talk", html: "손님이 들어오기 전 이미 평가가 시작된다는 관점으로 발문합니다." }
      ]
    },
    {
      stepId: "fb.c01.l01.s02",
      title: "핵심 개념",
      phase: "concept",
      studentBlocks: [
        { blockId: "fb.c01.l01.s02.b01", type: "concept", html: "영업 전 점검은 고객 입장 전에 물리적 환경, 위생 상태, 안전 상태, 비품 재고를 체계적으로 확인하는 과정입니다." }
      ],
      teacherNotes: [
        { noteId: "fb.c01.l01.s02.tn01", source: "A안 slides[].notes", html: "학생들이 조·냉·위·안·비를 소리 내어 따라 말하게 합니다." }
      ],
      teacherGuides: [
        { guideId: "fb.c01.l01.s02.tg01", type: "board", html: "조·냉·위·안·비를 칠판 또는 화면에 크게 남깁니다." }
      ]
    },
    {
      stepId: "fb.c01.l01.s03",
      title: "온도 기준 확인",
      phase: "question",
      studentBlocks: [
        { blockId: "fb.c01.l01.s03.b01", type: "prompt", html: "여름과 겨울의 실내 적정 온도를 다르게 맞춰야 한다면 각각 몇 도 정도일까요?" }
      ],
      questions: [
        { questionId: "fb.c01.q001", type: "short_answer", promptHtml: "여름과 겨울의 실내 적정 온도 기준을 쓰세요.", expectedAnswerHtml: "여름 26°C 내외, 겨울 20°C 내외", studentExplanationHtml: "계절별로 적정 온도를 다르게 유지합니다." }
      ],
      teacherNotes: [
        { noteId: "fb.c01.l01.s03.tn01", source: "A안 slides[].notes", html: "정답 공개 전에 10초 정도 기다립니다. 실제 응답은 손들기·구두 답변으로 충분합니다." }
      ],
      teacherGuides: [
        { guideId: "fb.c01.l01.s03.tg01", type: "trap", html: "여름과 겨울 수치를 뒤바꾸는 함정 보기를 강조합니다." }
      ]
    },
    {
      stepId: "fb.c01.l01.s04",
      title: "현장 판단",
      phase: "question",
      studentBlocks: [
        { blockId: "fb.c01.l01.s04.b01", type: "prompt", html: "점검하다 불량 전구를 발견했습니다. 나중에 처리할까요, 즉시 교체 요청할까요?" }
      ],
      questions: [
        { questionId: "fb.c01.q002", type: "oral_or_choice", expectedAnswerHtml: "즉시 교체 요청", studentExplanationHtml: "조명 불량은 분위기와 안전에 영향을 주므로 영업 전 즉시 처리해야 합니다." }
      ],
      teacherNotes: [
        { noteId: "fb.c01.l01.s04.tn01", source: "A안 slides[].notes", html: "정답보다 이유 설명이 중요합니다." }
      ],
      teacherGuides: [
        { guideId: "fb.c01.l01.s04.tg01", type: "teacher_talk", html: "‘작은 문제니까 나중에’가 왜 위험한지 안전과 고객 첫인상 관점으로 이어 설명합니다." }
      ]
    },
    {
      stepId: "fb.c01.l01.s05",
      title: "정리와 평가",
      phase: "summary_quiz",
      studentBlocks: [
        { blockId: "fb.c01.l01.s05.b01", type: "summary", html: "영업 전 점검 5대 영역: 조명, 냉난방, 위생, 안전, 비품" }
      ],
      questions: [
        { questionId: "fb.c01.q003", type: "multiple_choice", promptHtml: "다음 중 식음료 영업장의 영업 전 점검 항목으로 옳지 않은 것은?", correctOptionIndex: 3, studentExplanationHtml: "고객 주문 후 처리하는 것은 영업 전 점검 항목이 아닙니다." }
      ],
      teacherNotes: [
        { noteId: "fb.c01.l01.s05.tn01", source: "A안 slides[].notes", html: "학생에게 먼저 손가락으로 1~4번을 표시하게 한 뒤 정답을 공개합니다." }
      ],
      teacherGuides: [
        { guideId: "fb.c01.l01.s05.tg01", type: "rubric", html: "평가 기준: 영업 전 점검 항목을 구분하고, 고객 입장 전 완료라는 핵심 조건을 설명할 수 있는지 확인합니다." },
        { guideId: "fb.c01.l01.s05.tg02", type: "board", html: "판서: 조명, 냉난방, 위생, 안전, 비품 / 여름 26°C, 겨울 20°C / 고객 입장 전 완료" }
      ]
    }
  ],
  portalPolicy: {
    studentApiMustExcludeTeacherFields: true,
    cssHideIsNotSufficient: true,
    teacherPersonalMemoStorage: "userId + ebookId + lessonId + stepId/blockId"
  }
};
let firebaseJwkCache = null;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const corsHeaders = getCorsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      const url = new URL(request.url);

      if (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/api/health") {
        return sendJson({
          ok: true,
          service: "gyo6-law-info-ai",
          openAi: Boolean(env.OPENAI_API_KEY),
          model: env.OPENAI_MODEL || "gpt-5.2",
          auth: {
            required: isAuthRequired(env),
            firebaseProjectId: cleanText(env.FIREBASE_PROJECT_ID || ""),
            trustedFirebaseProjectIds: getTrustedFirebaseProjectIds(env),
            memberDb: Boolean(env.MEMBER_DB),
            kakaoRequired: isKakaoAuthRequired(env)
          },
          sources: {
            koreanLawMcp: Boolean(cleanText(env.KOREAN_LAW_MCP_BASE_URL || "")),
            nanet: Boolean(cleanText(env.NANET_API_KEY || "")),
            officialSourcePrefetch: String(env.OFFICIAL_SOURCE_PREFETCH || "true").toLowerCase() !== "false"
          },
          costControl: getCostControlSettings(env)
        }, 200, corsHeaders);
      }

      if (url.pathname === "/api/analyze" || url.pathname === "/analyze") {
        if (request.method !== "GET" && request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const payload = request.method === "POST"
          ? await readJsonBody(request)
          : Object.fromEntries(url.searchParams.entries());

        const authContext = await getOptionalAuthContext(request, env);
        const result = await handleAnalyze(payload, env, authContext);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/search" || url.pathname === "/search") {
        if (request.method !== "GET") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const authContext = await requireAuthContext(request, env);
        const access = await assertLawAccess(authContext, env);
        if (!access.ok) {
          return sendJson({
            error: access.message,
            code: access.code,
            status: access.status || 403
          }, access.status || 403, corsHeaders);
        }

        const officialSourceApi = createOfficialSourceApi(env);
        const result = await officialSourceApi.handleSearch(url);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/policy" || url.pathname === "/policy") {
        if (request.method !== "GET" && request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const payload = request.method === "POST"
          ? await readJsonBody(request)
          : Object.fromEntries(url.searchParams.entries());
        const authContext = await getOptionalAuthContext(request, env);
        const result = await handlePolicyRequest(payload, env, authContext);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/kakao/skill" || url.pathname === "/kakao/skill") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }
        if (!hasValidKakaoSkillToken(request, url, env)) {
          return sendJson({ error: "카카오 챗봇 스킬 토큰이 올바르지 않습니다." }, 401, corsHeaders);
        }

        const result = await handleKakaoSkill(await readJsonBody(request), env, {
          detailUrl: env.PUBLIC_SITE_URL || "https://gyo6-law-info.web.app/"
        });
        return sendJson(result, 200, corsHeaders);
      }

      if (url.pathname === "/api/member/me") {
        const authContext = await requireAuthContext(request, env);
        if (authContext.error) {
          return sendJson(authContext, authContext.status || 401, corsHeaders);
        }

        const body = request.method === "POST" ? await readJsonBody(request) : {};
        const result = request.method === "POST"
          ? await upsertMemberProfile(authContext.user, body, env)
          : await getMemberProfile(authContext.user, env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/member/register") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const authContext = await requireAuthContext(request, env);
        if (authContext.error) {
          return sendJson(authContext, authContext.status || 401, corsHeaders);
        }

        const result = await registerMember(authContext.user, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/consultations") {
        const authContext = await requireAuthContext(request, env);
        if (authContext.error) {
          return sendJson(authContext, authContext.status || 401, corsHeaders);
        }

        if (request.method === "GET") {
          const result = await listConsultations(authContext, env, url);
          return sendJson(result, getResultStatus(result), corsHeaders);
        }

        if (request.method === "POST") {
          const result = await createConsultation(authContext, await readJsonBody(request), env);
          return sendJson(result, getResultStatus(result), corsHeaders);
        }

        return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
      }

      if (url.pathname === "/api/boards") {
        if (request.method === "GET") {
          const authContext = await getOptionalAuthContext(request, env);
          if (authContext?.error) {
            return sendJson(authContext, authContext.status || 401, corsHeaders);
          }

          const result = await listBoardPosts(authContext, env, url);
          return sendJson(result, getResultStatus(result), corsHeaders);
        }

        if (request.method === "POST") {
          const authContext = await requireAuthContext(request, env);
          if (authContext.error) {
            return sendJson(authContext, authContext.status || 401, corsHeaders);
          }

          const result = await createBoardPost(authContext, await readJsonBody(request), env);
          return sendJson(result, getResultStatus(result), corsHeaders);
        }

        return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
      }

      if (url.pathname === "/api/ebooks") {
        if (request.method !== "GET") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const authContext = await getOptionalAuthContext(request, env);
        if (authContext?.error) {
          return sendJson(authContext, authContext.status || 401, corsHeaders);
        }

        const result = listEbooks(authContext);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      const ebookLessonMatch = url.pathname.match(/^\/api\/ebooks\/([^/]+)\/lessons\/([^/]+)$/);
      if (ebookLessonMatch) {
        if (request.method !== "GET") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const authContext = await requireAuthContext(request, env);
        if (authContext.error) {
          return sendJson(authContext, authContext.status || 401, corsHeaders);
        }

        const result = getEbookLesson(authContext, {
          ebookId: decodeURIComponent(ebookLessonMatch[1]),
          lessonId: decodeURIComponent(ebookLessonMatch[2]),
          mode: url.searchParams.get("mode") || "student"
        });
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/progress") {
        const authContext = await requireAuthContext(request, env);
        if (authContext.error) {
          return sendJson(authContext, authContext.status || 401, corsHeaders);
        }

        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const result = await saveEbookProgress(authContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/members") {
        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await listMembers(env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/member") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await updateMemberByAdmin(adminContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/member/delete") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await softDeleteMember(adminContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/member/kakao-approve") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await approveKakaoMemberByAdmin(adminContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/member/invite") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await createMemberInvitation(adminContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/consultation/reply") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await replyConsultation(adminContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      if (url.pathname === "/api/admin/board/reply") {
        if (request.method !== "POST") {
          return sendJson({ error: "지원하지 않는 HTTP 메서드입니다." }, 405, corsHeaders);
        }

        const adminContext = await requireAdminContext(request, env);
        if (adminContext.error) {
          return sendJson(adminContext, adminContext.status || 403, corsHeaders);
        }

        const result = await replyBoardPost(adminContext, await readJsonBody(request), env);
        return sendJson(result, getResultStatus(result), corsHeaders);
      }

      return sendJson({ error: "지원하지 않는 경로입니다." }, 404, corsHeaders);
    } catch (error) {
      return sendJson({
        error: "AI 분석 처리 중 오류가 발생했습니다.",
        detail: error.message
      }, 500, corsHeaders);
    }
  }
};

async function handleAnalyze(payload, env, authContext = null) {
  const question = cleanText(payload.q || payload.question || "");
  const topic = cleanText(payload.topic || "general");
  const role = cleanText(payload.role || "auto");
  const partyRole = cleanText(payload.partyRole || payload.party || "auto");
  const mode = cleanText(payload.mode || "intake");
  const caseId = cleanText(payload.caseId || "");
  const laws = parsePayloadList(payload.laws);
  const keywords = parsePayloadList(payload.keywords);
  const topicContext = sanitizeTopicContext(payload.topicContext);

  if (!question) {
    return { error: "질문이 비어 있습니다." };
  }

  const access = await assertLawAccess(authContext, env);
  if (!access.ok) {
    return {
      error: access.message,
      code: access.code,
      status: access.status || 403
    };
  }

  const policyEngineFirst = buildPolicyEngineFirstAnalyzeResult({
    question,
    topic,
    role,
    partyRole,
    topicContext,
    mode,
    caseId,
    access,
    env
  });
  if (policyEngineFirst) {
    return policyEngineFirst;
  }

  if (!env.OPENAI_API_KEY) {
    return {
      error: "OPENAI_API_KEY secret이 설정되어 있지 않습니다.",
      fallback: true
    };
  }

  const primaryModel = cleanText(env.OPENAI_MODEL || "gpt-5.2");
  const fallbackModel = cleanText(env.OPENAI_FALLBACK_MODEL || "gpt-4.1");
  const models = [...new Set([primaryModel, fallbackModel].filter(Boolean))];
  const errors = [];
  const officialSources = await loadOfficialSourceContext({
    question,
    topic,
    laws,
    keywords
  }, env);

  for (const model of models) {
    try {
      const aiResult = await callOpenAiLegalAnalysis(env.OPENAI_API_KEY, {
        model,
        question,
        topic,
        role,
        partyRole,
        topicContext,
        mode,
        officialSources
      }, env);

      return {
        ok: true,
        caseId,
        engine: "cloudflare-worker-openai-responses",
        model,
        generatedAt: new Date().toISOString(),
        analysis: aiResult.analysis,
        usage: aiResult.usage,
        billing: aiResult.billing,
        officialSources,
        sourceGrounding: summarizeSourceGrounding(officialSources),
        member: access.member ? sanitizeMember(access.member) : null,
        costControl: getCostControlSettings(env)
      };
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
      if (!isRetryableOpenAiError(error)) {
        break;
      }
    }
  }

  return {
    error: "AI 사안 분석 호출에 실패했습니다.",
    fallback: true,
    notices: errors.slice(0, 3)
  };
}

async function handlePolicyRequest(payload = {}, env = {}, authContext = null) {
  const access = await assertLawAccess(authContext, env);
  if (!access.ok) {
    return {
      error: access.message,
      code: access.code,
      status: access.status || 403
    };
  }

  const baseResult = handlePolicyChatRequest(payload, {
    officeLabel: env.DEFAULT_OFFICE_LABEL || "경상북도교육청"
  });
  let finalResult = baseResult;

  if (shouldUsePolicyGptNormalizer(payload, baseResult, env)) {
    const budgetGate = await getOpenAiUsageGate(env, "policy_nlu");
    if (budgetGate.ok) {
      const normalizerResult = await runKakaoQuestionNormalizer(payload, baseResult, env);
      if (normalizerResult.ok) {
        await recordOpenAiUsage(env, {
          feature: "policy_nlu",
          model: normalizerResult.model,
          usage: normalizerResult.usage,
          billing: normalizerResult.billing
        });

        const normalizedPayload = buildPayloadFromKakaoNormalizer(payload, normalizerResult.normalization);
        const normalizedPolicyResult = handlePolicyChatRequest(normalizedPayload, {
          officeLabel: env.DEFAULT_OFFICE_LABEL || "경상북도교육청"
        });
        finalResult = chooseBetterPolicyResult(baseResult, normalizedPolicyResult);
        finalResult = attachKakaoNormalizerMetadata(finalResult, normalizerResult, budgetGate, "policy_nlu");
      } else {
        finalResult = attachKakaoNormalizerMetadata(baseResult, normalizerResult, budgetGate, "policy_nlu");
      }
    } else {
      finalResult = attachKakaoNormalizerMetadata(baseResult, {
        ok: false,
        skipped: true,
        reason: budgetGate.reason
      }, budgetGate, "policy_nlu");
    }
  }

  finalResult = await maybeAttachGptAnswerComposer(payload, finalResult, env, "policy_answer");
  return finalResult;
}

async function handleKakaoSkill(kakaoRequest, env, options = {}) {
  const basePayload = normalizeKakaoRequest(kakaoRequest);
  const kakaoAccess = await assertKakaoAccess(basePayload, env);
  if (!kakaoAccess.ok) {
    return buildKakaoAccessBlockedResponse(kakaoAccess);
  }

  const workingPayload = await hydrateKakaoClarificationPayload(basePayload, env);
  const baseResult = handlePolicyChatRequest(workingPayload, {
    officeLabel: env.DEFAULT_OFFICE_LABEL || "경상북도교육청"
  });
  let finalResult = baseResult;

  if (shouldUseKakaoGptNormalizer(workingPayload, baseResult, env)) {
    const budgetGate = await getOpenAiUsageGate(env, "kakao_nlu");
    if (budgetGate.ok) {
      const normalizerResult = await runKakaoQuestionNormalizer(workingPayload, baseResult, env);
      if (normalizerResult.ok) {
        await recordOpenAiUsage(env, {
          feature: "kakao_nlu",
          model: normalizerResult.model,
          usage: normalizerResult.usage,
          billing: normalizerResult.billing
        });

        const normalizedPayload = buildPayloadFromKakaoNormalizer(workingPayload, normalizerResult.normalization);
        const normalizedPolicyResult = handlePolicyChatRequest(normalizedPayload, {
          officeLabel: env.DEFAULT_OFFICE_LABEL || "경상북도교육청"
        });
        finalResult = chooseBetterPolicyResult(baseResult, normalizedPolicyResult);
        finalResult = attachKakaoNormalizerMetadata(finalResult, normalizerResult, budgetGate);
      } else {
        finalResult = attachKakaoNormalizerMetadata(baseResult, normalizerResult, budgetGate);
      }
    } else {
      finalResult = attachKakaoNormalizerMetadata(baseResult, {
        ok: false,
        skipped: true,
        reason: budgetGate.reason
      }, budgetGate);
    }
  }

  finalResult = await maybeAttachGptAnswerComposer(workingPayload, finalResult, env, "kakao_answer");

  await persistKakaoClarificationSession(workingPayload, finalResult, env);

  return buildKakaoSkillResponseFromResult(finalResult, {
    detailUrl: options.detailUrl || env.PUBLIC_SITE_URL || "https://gyo6-law-info.web.app/",
    thumbnailUrl: options.thumbnailUrl
  });
}

async function assertKakaoAccess(payload = {}, env = {}) {
  if (!isKakaoAuthRequired(env)) {
    return { ok: true, member: null };
  }

  const userKey = getKakaoClarificationUserKey(payload);
  if (!userKey) {
    return {
      ok: false,
      code: "KAKAO_USER_KEY_REQUIRED",
      status: 403,
      message: "카카오 사용자 식별정보를 확인하지 못해 챗봇 이용권한을 확인할 수 없습니다."
    };
  }

  if (!env.MEMBER_DB) {
    return {
      ok: false,
      code: "KAKAO_MEMBER_DB_REQUIRED",
      status: 503,
      message: "챗봇 이용권한 DB가 아직 연결되지 않았습니다.",
      userKey
    };
  }

  const envApproved = isKakaoUserApprovedByEnv(userKey, env);
  let member = await getMemberByUid(userKey, env);
  if (!member) {
    member = await registerKakaoMember(payload, userKey, env, { approved: envApproved });
  } else {
    await touchKakaoMember(payload, member, env, { approved: envApproved });
    member = await getMemberByUid(userKey, env);
  }

  if (envApproved && (!member || member.status !== "approved" || !LAW_ACCESS_ROLES.has(member.role))) {
    await promoteKakaoMemberFromAllowlist(userKey, env);
    member = await getMemberByUid(userKey, env);
  }

  if (!member || member.status !== "approved") {
    return {
      ok: false,
      code: "KAKAO_APPROVAL_REQUIRED",
      status: 403,
      message: "챗봇 이용권한 승인 후 사용할 수 있습니다.",
      userKey,
      member: sanitizeMember(member)
    };
  }

  if (!LAW_ACCESS_ROLES.has(member.role)) {
    return {
      ok: false,
      code: "KAKAO_LAW_ROLE_REQUIRED",
      status: 403,
      message: "관리자에 의해 법률정보 권한을 승인받아야 합니다.",
      userKey,
      member: sanitizeMember(member)
    };
  }

  return { ok: true, member };
}

function buildKakaoAccessBlockedResponse(access = {}) {
  const accessCode = access.userKey ? formatKakaoAccessCode(access.userKey) : "";
  const lines = [
    access.message || "챗봇 이용권한 확인이 필요합니다.",
    accessCode ? `관리자에게 이 식별번호를 알려주세요: ${accessCode}` : "",
    "승인 전에는 GPT 질문정규화와 답변 생성이 실행되지 않습니다."
  ].filter(Boolean);

  return {
    version: "2.0",
    template: {
      outputs: [
        {
          simpleText: {
            text: lines.join("\n")
          }
        }
      ],
      quickReplies: [
        {
          action: "message",
          label: "승인 요청",
          messageText: accessCode
            ? `챗봇 이용 승인 요청: ${accessCode}`
            : "챗봇 이용 승인 요청"
        }
      ]
    }
  };
}

async function registerKakaoMember(payload = {}, userKey = "", env = {}, options = {}) {
  const now = new Date().toISOString();
  const accessCode = formatKakaoAccessCode(userKey);
  const role = options.approved ? "admin" : "pending";
  const status = options.approved ? "approved" : "pending";
  const displayName = getKakaoDisplayName(payload, accessCode);
  await env.MEMBER_DB.prepare(`
    INSERT INTO members (
      uid, email, display_name, school_name, phone, requested_role, role, status,
      note, created_at, updated_at, approved_at, approved_by, last_login_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    userKey,
    getKakaoSyntheticEmail(userKey),
    displayName,
    "카카오톡 채널",
    "",
    "admin",
    role,
    status,
    `카카오 챗봇 이용 신청 식별번호: ${accessCode}`,
    now,
    now,
    options.approved ? now : null,
    options.approved ? "kakao-allowlist" : null,
    now
  ).run();
  return getMemberByUid(userKey, env);
}

async function touchKakaoMember(payload = {}, member = {}, env = {}, options = {}) {
  const now = new Date().toISOString();
  const displayName = getKakaoDisplayName(payload, formatKakaoAccessCode(member.uid));
  const nextRole = options.approved && !LAW_ACCESS_ROLES.has(member.role) ? "admin" : member.role;
  const nextStatus = options.approved && member.status !== "approved" ? "approved" : member.status;
  const approvedAt = nextStatus === "approved" && member.status !== "approved" ? now : member.approvedAt || null;
  const approvedBy = nextStatus === "approved" && member.status !== "approved" ? "kakao-allowlist" : member.approvedBy || null;
  await env.MEMBER_DB.prepare(`
    UPDATE members
    SET display_name = ?, role = ?, status = ?, updated_at = ?, approved_at = ?, approved_by = ?, last_login_at = ?
    WHERE uid = ?
  `).bind(
    displayName || member.displayName || "카카오 사용자",
    nextRole,
    nextStatus,
    now,
    approvedAt,
    approvedBy,
    now,
    member.uid
  ).run();
}

async function promoteKakaoMemberFromAllowlist(userKey = "", env = {}) {
  const now = new Date().toISOString();
  await env.MEMBER_DB.prepare(`
    UPDATE members
    SET role = 'admin',
        status = 'approved',
        updated_at = ?,
        approved_at = COALESCE(approved_at, ?),
        approved_by = COALESCE(approved_by, 'kakao-allowlist'),
        last_login_at = ?
    WHERE uid = ?
  `).bind(now, now, now, userKey).run();
}

export async function hydrateKakaoClarificationPayload(payload = {}, env = {}) {
  const session = await getKakaoClarificationSession(payload, env);
  if (shouldStartNewKakaoConsultation(payload, session)) {
    await clearKakaoClarificationSession(getKakaoClarificationUserKey(payload), env);
    return payload;
  }
  if (!shouldMergeKakaoClarificationAnswer(payload, session)) {
    return payload;
  }
  return composeKakaoClarificationFollowUpPayload(payload, session);
}

export function composeKakaoClarificationFollowUpPayload(payload = {}, session = {}) {
  const answer = cleanText(payload.question || "");
  const baseQuestion = cleanText(session.question || "");
  const nextQuestion = asArray(session.slotQuestions)[0] || {};
  const label = cleanText(nextQuestion.label || session.domainLabel || "추가 정보");
  const mergedQuestion = [
    baseQuestion,
    "",
    "추가 확인 내용:",
    `- ${label}: ${answer}`
  ].join("\n");

  return {
    ...payload,
    question: mergedQuestion,
    originalQuestion: baseQuestion,
    sessionContext: {
      used: true,
      sessionId: cleanText(session.userKey || ""),
      previousQuestion: baseQuestion,
      answer,
      label
    }
  };
}

export function shouldMergeKakaoClarificationAnswer(payload = {}, session = null) {
  if (!session?.question) return false;
  const text = cleanText(payload.question || "");
  if (!text || text.length > 220) return false;
  if (shouldStartNewKakaoConsultation(payload, session)) return false;
  return true;
}

export function shouldStartNewKakaoConsultation(payload = {}, session = null) {
  if (!session?.question) return false;
  const text = cleanText(payload.question || "");
  if (!text) return false;
  return isKakaoClarificationResetText(text)
    || isContextRichKakaoCommand(text)
    || isLikelyNewCompleteKakaoQuestion(text);
}

async function persistKakaoClarificationSession(payload = {}, result = {}, env = {}) {
  const userKey = getKakaoClarificationUserKey(payload);
  if (!userKey || !env.MEMBER_DB) return;

  try {
    await ensureKakaoClarificationSessionTable(env);
    if (!shouldStoreKakaoClarificationSession(result)) {
      await clearKakaoClarificationSession(userKey, env);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + KAKAO_CLARIFICATION_SESSION_TTL_MS).toISOString();
    const slotQuestions = getKakaoSessionSlotQuestions(result);
    const question = getKakaoSessionQuestion(payload, result);
    await env.MEMBER_DB.prepare(`
      INSERT INTO kakao_clarification_sessions (
        user_key, question, domain_code, domain_label, slot_questions, updated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_key) DO UPDATE SET
        question = excluded.question,
        domain_code = excluded.domain_code,
        domain_label = excluded.domain_label,
        slot_questions = excluded.slot_questions,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at
    `).bind(
      userKey,
      question,
      cleanText(result.semanticFrame?.domainCode || result.completionFlow?.domainCode || ""),
      cleanText(result.semanticFrame?.domainLabel || result.completionFlow?.domainLabel || ""),
      JSON.stringify(slotQuestions),
      now.toISOString(),
      expiresAt
    ).run();
  } catch (error) {
    console.warn("Kakao clarification session persist skipped:", error?.message || error);
  }
}

async function getKakaoClarificationSession(payload = {}, env = {}) {
  const userKey = getKakaoClarificationUserKey(payload);
  if (!userKey || !env.MEMBER_DB) return null;

  try {
    await ensureKakaoClarificationSessionTable(env);
    const now = new Date().toISOString();
    const row = await env.MEMBER_DB.prepare(`
      SELECT user_key, question, domain_code, domain_label, slot_questions, updated_at, expires_at
      FROM kakao_clarification_sessions
      WHERE user_key = ? AND expires_at > ?
    `).bind(userKey, now).first();
    if (!row) return null;
    return {
      userKey: row.user_key,
      question: cleanText(row.question || ""),
      domainCode: cleanText(row.domain_code || ""),
      domainLabel: cleanText(row.domain_label || ""),
      slotQuestions: parseJsonArray(row.slot_questions),
      updatedAt: cleanText(row.updated_at || ""),
      expiresAt: cleanText(row.expires_at || "")
    };
  } catch (error) {
    console.warn("Kakao clarification session load skipped:", error?.message || error);
    return null;
  }
}

async function ensureKakaoClarificationSessionTable(env = {}) {
  if (kakaoClarificationTableEnsured || !env.MEMBER_DB) return;
  await env.MEMBER_DB.prepare(`
    CREATE TABLE IF NOT EXISTS kakao_clarification_sessions (
      user_key TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      domain_code TEXT,
      domain_label TEXT,
      slot_questions TEXT,
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `).run();
  kakaoClarificationTableEnsured = true;
}

async function clearKakaoClarificationSession(userKey = "", env = {}) {
  if (!userKey || !env.MEMBER_DB) return;
  await env.MEMBER_DB.prepare("DELETE FROM kakao_clarification_sessions WHERE user_key = ?").bind(userKey).run();
}

export function shouldStoreKakaoClarificationSession(result = {}) {
  if (!result?.ok) return false;
  const status = cleanText(result.answerState?.status || "");
  const hasDomain = Boolean(cleanText(result.semanticFrame?.domainCode || ""));
  const flow = result.completionFlow || {};
  const questionBuilder = result.clarificationFlow || {};
  if (questionBuilder.type === "question_builder" && questionBuilder.status === "collect_slots") return true;
  if (flow.needed && (!hasDomain || cleanText(flow.type || "") === "choose_domain" || status === "unclassified")) return true;
  if (result.semanticFrame?.intentClarification?.needsConfirmation) return true;
  if (status === "unclassified") return true;
  return status === "needs_slot" && !hasDomain;
}

function getKakaoSessionQuestion(payload = {}, result = {}) {
  const flow = result.clarificationFlow || {};
  if (flow.type === "question_builder" && flow.status === "collect_slots") {
    return `${flow.profileLabel || result.semanticFrame?.domainLabel || "규정·지침"} 사안입니다. 필요한 정보(${flow.requiredInfo || "대상, 상황, 기간, 증빙, 소속 교육청"})를 보태면 답변합니다.`;
  }
  return cleanText(result.question || payload.question || "");
}

function getKakaoSessionSlotQuestions(result = {}) {
  return asArray(result.completionFlow?.nextQuestions)
    .concat(asArray(result.missingSlotQuestions))
    .concat(asArray(result.answerState?.slotQuestions))
    .map((item) => ({
      slot: cleanText(item.slot || "detail"),
      label: cleanText(item.label || item.slot || "추가 정보"),
      question: cleanText(item.question || "")
    }))
    .filter((item) => item.question || item.label)
    .slice(0, 3);
}

function getKakaoClarificationUserKey(payload = {}) {
  const user = payload.user || {};
  const properties = user.properties || {};
  const candidates = [
    user.id,
    user.userKey,
    user.botUserKey,
    user.appUserId,
    properties.plusfriendUserKey,
    properties.botUserKey,
    properties.appUserId,
    payload.action?.clientExtra?.userKey
  ].map((item) => cleanText(item)).filter(Boolean);
  return candidates.length ? `kakao:${candidates[0]}` : "";
}

function getKakaoDisplayName(payload = {}, fallback = "카카오 사용자") {
  const user = payload.user || {};
  const properties = user.properties || {};
  return cleanText(
    properties.nickname ||
    properties.name ||
    user.name ||
    user.nickname ||
    fallback
  );
}

function getKakaoSyntheticEmail(userKey = "") {
  return `kakao-${stableHash(userKey)}@kakao.local`;
}

function formatKakaoAccessCode(userKey = "") {
  return `KAKAO-${stableHash(userKey).slice(0, 10).toUpperCase()}`;
}

function isKakaoUserApprovedByEnv(userKey = "", env = {}) {
  const normalized = cleanText(userKey);
  const raw = normalized.replace(/^kakao:/, "");
  const hash = stableHash(normalized);
  const approved = parseKakaoUserKeyList(env.KAKAO_APPROVED_USER_KEYS);
  return approved.has(normalized) || approved.has(raw) || approved.has(hash) || approved.has(formatKakaoAccessCode(normalized));
}

function parseKakaoUserKeyList(value = "") {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => cleanText(item))
      .filter(Boolean)
  );
}

function stableHash(value = "") {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isKakaoClarificationResetText(text = "") {
  return /^(처음|처음부터|새\s*질문|새질문|리셋|취소|그만|다시)$/i.test(cleanText(text));
}

function isContextRichKakaoCommand(text = "") {
  return /질문\s*만들기|완성질문|자세히\s*보기|공식\s*출처|출처\s*확인|기준으로\s*다시|원\s*질문|추가\s*확인\s*내용/.test(text);
}

function isLikelyNewCompleteKakaoQuestion(text = "") {
  const normalized = cleanText(text);
  const compacted = normalized.replace(/\s+/g, "");
  const hasQuestionMark = /[?？]$/.test(normalized) || /[?？]/.test(normalized);
  const hasAskVerb = /알려|어떻게|되나요|가능|며칠|몇일|얼마|기준|절차|처리|조치|대응|해야|인가요|일까요|해도|수있|받을수|쓸수|내릴수|일수|규정|방법/.test(compacted);
  const hasDomainAnchor = /출장|여비|학교폭력|학폭|병가|연가|출산|휴가|복무|근태|계약직|행정직|공무직|기간제|개인정보|CCTV|현장실습|채용|근로|임금|민사|소송|형사|고소|고발|학생부|출결|예산|회계|강사료|방과후|수업|학생|생활지도|훈육|지시|불응|선도|학칙|학생생활규정|기숙사|급식|평가|성적|체험학습|장학|보건|상담|교권|교육활동/.test(compacted);
  return (hasQuestionMark && hasAskVerb && normalized.length >= 12)
    || (hasDomainAnchor && hasAskVerb && normalized.length >= 24);
}

function parseJsonArray(value = "") {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shouldUseKakaoGptNormalizer(payload = {}, result = {}, env = {}) {
  if (!isFeatureEnabled(env.KAKAO_GPT_NORMALIZER_ENABLED)) return false;
  if (!env.OPENAI_API_KEY) return false;

  const question = cleanText(payload.question || "");
  if (question.length < 3) return false;

  const mode = cleanText(env.KAKAO_GPT_NORMALIZER_MODE || "auto").toLowerCase();
  if (mode === "always") return true;
  if (mode === "off" || mode === "false") return false;

  const threshold = readNumber(env.KAKAO_GPT_NORMALIZER_MIN_CONFIDENCE) || 0.82;
  const confidence = Number(result.confidence || result.semanticFrame?.confidence || 0);
  const status = result.answerState?.status || "";
  const missingSlots = result.missingSlots || [];

  if (!result.ok || !result.semanticFrame?.domainCode) return true;
  if (status === "unclassified") return true;
  if (hasUsableKakaoPolicyResult(result)) return false;
  if (confidence < threshold) return true;
  if (hasCriticalMissingSlots(missingSlots)) return true;
  return isLowQualityKakaoPolicyResult(result);
}

function shouldUsePolicyGptNormalizer(payload = {}, result = {}, env = {}) {
  const policyEnv = {
    ...env,
    KAKAO_GPT_NORMALIZER_ENABLED: env.POLICY_GPT_NORMALIZER_ENABLED ?? env.KAKAO_GPT_NORMALIZER_ENABLED,
    KAKAO_GPT_NORMALIZER_MODE: env.POLICY_GPT_NORMALIZER_MODE || env.KAKAO_GPT_NORMALIZER_MODE,
    KAKAO_GPT_NORMALIZER_MIN_CONFIDENCE: env.POLICY_GPT_NORMALIZER_MIN_CONFIDENCE || env.KAKAO_GPT_NORMALIZER_MIN_CONFIDENCE
  };
  return shouldUseKakaoGptNormalizer(payload, result, policyEnv);
}

async function maybeAttachGptAnswerComposer(payload = {}, result = {}, env = {}, feature = "kakao_answer") {
  if (!shouldUseGptAnswerComposer(payload, result, env, feature)) return result;

  const budgetGate = await getOpenAiUsageGate(env, feature);
  if (!budgetGate.ok) {
    return attachPolicyAnswerComposerMetadata(result, {
      ok: false,
      skipped: true,
      reason: budgetGate.reason
    }, budgetGate, feature);
  }

  const composerResult = await runPolicyAnswerComposer(payload, result, env, feature);
  if (composerResult.ok) {
    await recordOpenAiUsage(env, {
      feature,
      model: composerResult.model,
      usage: composerResult.usage,
      billing: composerResult.billing
    });
  }
  return attachPolicyAnswerComposerMetadata(result, composerResult, budgetGate, feature);
}

function shouldUseGptAnswerComposer(payload = {}, result = {}, env = {}, feature = "kakao_answer") {
  const isPolicy = feature === "policy_answer";
  const enabled = isPolicy
    ? env.POLICY_GPT_ANSWER_ENABLED ?? env.KAKAO_GPT_ANSWER_ENABLED
    : env.KAKAO_GPT_ANSWER_ENABLED;
  if (!isFeatureEnabled(enabled)) return false;
  if (!env.OPENAI_API_KEY) return false;

  const mode = cleanText((isPolicy
    ? env.POLICY_GPT_ANSWER_MODE || env.KAKAO_GPT_ANSWER_MODE
    : env.KAKAO_GPT_ANSWER_MODE) || "auto").toLowerCase();
  if (mode === "off" || mode === "false") return false;

  const question = cleanText(payload.question || payload.q || "");
  if (question.length < 3) return false;
  if (!result?.ok || !result.semanticFrame?.domainCode || !result.policyResponse) return false;
  if (result.answerState?.status === "unclassified") return false;
  if (mode === "always") return true;

  const confidence = Number(result.confidence || result.semanticFrame?.confidence || 0);
  if (hasUsableKakaoPolicyResult(result)) return false;
  if (isLowQualityKakaoPolicyResult(result)) return true;
  if (confidence < readAnswerComposerConfidenceThreshold(env, isPolicy)) return true;
  if (hasThinPolicyAnswer(result)) return true;
  return false;
}

function readAnswerComposerConfidenceThreshold(env = {}, isPolicy = false) {
  const configured = readNumber(isPolicy
    ? env.POLICY_GPT_ANSWER_MIN_CONFIDENCE || env.KAKAO_GPT_ANSWER_MIN_CONFIDENCE
    : env.KAKAO_GPT_ANSWER_MIN_CONFIDENCE);
  return configured > 0 && configured < 1 ? configured : 0.72;
}

function hasThinPolicyAnswer(result = {}) {
  const texts = [
    result.responseText,
    result.answerState?.primaryText,
    ...(result.answerState?.conditionalAnswers || []),
    ...(result.answerState?.definitiveAnswers || [])
  ].map(cleanText).filter(Boolean);
  if (!texts.length) return true;
  const combined = texts.join(" ");
  if (/질문만으로는|적용 규정을 특정하기 어렵|먼저.*확인|무엇을 원하는지/.test(combined)) return true;
  const hasBasisSignal = /규정|지침|법령|예규|취업규칙|근로계약|교육청|학교법인|공식|증빙|진단서|절차|보고|승인|보존|일|원/.test(combined);
  return !hasBasisSignal || combined.length < 80;
}

function hasUsableKakaoPolicyResult(result = {}) {
  const status = result.answerState?.status || "";
  if (!["definitive", "conditional"].includes(status)) return false;
  if (!result.semanticFrame?.domainCode) return false;
  if (asArray(result.missingSlots).length) return false;
  if (isLowQualityKakaoPolicyResult(result)) return false;

  const text = cleanText([
    result.responseText,
    result.answerState?.primaryText,
    ...(result.answerState?.conditionalAnswers || []),
    ...(result.answerState?.definitiveAnswers || [])
  ].join(" "));

  if (result.semanticFrame.domainCode === "domesticTravelExpense") {
    return /출장비|여비|일비|식비|숙박비|운임/.test(text)
      && /\d[\d,]*\s*원|최대|합계|실비|상한/.test(text)
      && !/지역 미특정/.test(text);
  }

  return /(?:\d+\s*일|진단서|증빙자료|유급|무급|상한|환불|승인|보고|절차)/.test(text);
}

function hasCriticalMissingSlots(missingSlots = []) {
  const critical = new Set([
    "targetSubject",
    "travelerRole",
    "destination",
    "dateRange",
    "serviceIssue",
    "procedureStage",
    "riskSignal",
    "schoolLevel",
    "familyRelation",
    "evidence"
  ]);
  return missingSlots.some((slot) => critical.has(slot));
}

function isLowQualityKakaoPolicyResult(result = {}) {
  const texts = [
    result.responseText,
    result.answerState?.primaryText,
    ...(result.answerState?.conditionalAnswers || []),
    ...(result.answerState?.definitiveAnswers || [])
  ].map((text) => cleanText(text)).filter(Boolean);
  return texts.some((text) => /질문만으로는 적용 규정을 특정하기 어렵|먼저.*인지.*인지|무엇을 원하는지|제가 할 수 있는 일이 아니|이해하기 어려워요/.test(text));
}

async function runKakaoQuestionNormalizer(payload, baseResult, env) {
  const primaryModel = cleanText(env.KAKAO_NLU_MODEL || env.OPENAI_MODEL || "gpt-5.4-nano");
  const fallbackModel = cleanText(env.KAKAO_NLU_FALLBACK_MODEL || env.OPENAI_FALLBACK_MODEL || "gpt-5.4-mini");
  const models = [...new Set([primaryModel, fallbackModel].filter(Boolean))];
  const errors = [];

  for (const model of models) {
    try {
      return await callOpenAiKakaoQuestionNormalizer(env.OPENAI_API_KEY, {
        model,
        payload,
        baseResult,
        timeoutMs: readKakaoNormalizerTimeoutMs(env)
      }, env);
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
      if (error.code === "KAKAO_NLU_TIMEOUT") break;
      if (!isRetryableOpenAiError(error)) break;
    }
  }

  return {
    ok: false,
    error: "카카오 질문 정규화 호출에 실패했습니다.",
    notices: errors.slice(0, 3)
  };
}

async function callOpenAiKakaoQuestionNormalizer(openAiKey, payload, env = {}) {
  const controller = new AbortController();
  const timeoutMs = payload.timeoutMs || DEFAULT_KAKAO_NORMALIZER_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort("kakao_nlu_timeout"), timeoutMs);
  let response;

  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openAiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: payload.model,
        instructions: getKakaoQuestionNormalizerInstructions(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  currentDate: new Date().toISOString().slice(0, 10),
                  servicePurpose: "특성화고·학교 행정 규정 Q&A 카카오 챗봇",
                  userUtterance: redactSensitiveText(payload.payload.question),
                  localEngineResult: compactKakaoBaseResult(payload.baseResult)
                })
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "gyo6_kakao_question_normalization",
            strict: true,
            schema: getKakaoQuestionNormalizerSchema()
          },
          verbosity: "low"
        },
        max_output_tokens: 1200
      })
    });
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`카카오 응답 제한을 지키기 위해 GPT 질문정규화를 ${timeoutMs}ms에서 중단했습니다.`);
      timeoutError.status = 408;
      timeoutError.code = "KAKAO_NLU_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenAI API 오류 ${response.status}`);
    error.status = response.status;
    error.code = data?.error?.code || data?.error?.type || "";
    throw error;
  }

  const text = extractOpenAiText(data);
  if (!text) {
    throw new Error("질문 정규화 결과가 비어 있습니다.");
  }

  const usage = normalizeOpenAiUsage(data.usage);
  return {
    ok: true,
    model: payload.model,
    normalization: JSON.parse(text),
    usage,
    billing: estimateOpenAiBilling(usage, payload.model, env)
  };
}

function compactKakaoBaseResult(result = {}) {
  return {
    ok: Boolean(result.ok),
    question: cleanText(result.question || ""),
    domainCode: cleanText(result.semanticFrame?.domainCode || ""),
    domainLabel: cleanText(result.semanticFrame?.domainLabel || ""),
    confidence: Number(result.confidence || result.semanticFrame?.confidence || 0),
    answerState: cleanText(result.answerState?.status || ""),
    missingSlots: asArray(result.missingSlots).slice(0, 8),
    candidates: asArray(result.semanticFrame?.candidates).slice(0, 5)
  };
}

function readKakaoNormalizerTimeoutMs(env = {}) {
  const configured = Math.round(readNumber(env.KAKAO_GPT_NORMALIZER_TIMEOUT_MS));
  if (configured >= 500 && configured <= 3000) return configured;
  return DEFAULT_KAKAO_NORMALIZER_TIMEOUT_MS;
}

async function runPolicyAnswerComposer(payload = {}, baseResult = {}, env = {}, feature = "kakao_answer") {
  const isPolicy = feature === "policy_answer";
  const primaryModel = cleanText(
    (isPolicy ? env.POLICY_ANSWER_MODEL : env.KAKAO_ANSWER_MODEL)
    || env.KAKAO_ANSWER_MODEL
    || env.KAKAO_NLU_MODEL
    || env.OPENAI_MODEL
    || "gpt-5.4-nano"
  );
  const fallbackModel = cleanText(
    (isPolicy ? env.POLICY_ANSWER_FALLBACK_MODEL : env.KAKAO_ANSWER_FALLBACK_MODEL)
    || env.KAKAO_ANSWER_FALLBACK_MODEL
    || env.KAKAO_NLU_FALLBACK_MODEL
    || env.OPENAI_FALLBACK_MODEL
    || "gpt-5.4-mini"
  );
  const models = [...new Set([primaryModel, fallbackModel].filter(Boolean))];
  const errors = [];

  for (const model of models) {
    try {
      return await callOpenAiPolicyAnswerComposer(env.OPENAI_API_KEY, {
        model,
        payload,
        baseResult,
        feature,
        timeoutMs: readAnswerComposerTimeoutMs(env)
      }, env);
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
      if (error.code === "POLICY_ANSWER_TIMEOUT") break;
      if (!isRetryableOpenAiError(error)) break;
    }
  }

  return {
    ok: false,
    error: "GPT 답변 보강 호출에 실패했습니다.",
    notices: errors.slice(0, 3)
  };
}

async function callOpenAiPolicyAnswerComposer(openAiKey, payload, env = {}) {
  const controller = new AbortController();
  const timeoutMs = payload.timeoutMs || 2400;
  const timeout = setTimeout(() => controller.abort("policy_answer_timeout"), timeoutMs);
  let response;

  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openAiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: payload.model,
        instructions: getPolicyAnswerComposerInstructions(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  currentDate: new Date().toISOString().slice(0, 10),
                  servicePurpose: "특성화고·학교 행정 규정 Q&A 답변 품질 보강",
                  channel: payload.feature === "kakao_answer" ? "kakao" : "web",
                  userQuestion: redactSensitiveText(payload.payload.question || payload.payload.q || ""),
                  localEngineResult: compactPolicyAnswerBaseResult(payload.baseResult)
                })
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "gyo6_policy_answer_composition",
            strict: true,
            schema: getPolicyAnswerComposerSchema()
          },
          verbosity: "low"
        },
        max_output_tokens: 1400
      })
    });
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`카카오/웹 응답 제한을 지키기 위해 GPT 답변 보강을 ${timeoutMs}ms에서 중단했습니다.`);
      timeoutError.status = 408;
      timeoutError.code = "POLICY_ANSWER_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenAI API 오류 ${response.status}`);
    error.status = response.status;
    error.code = data?.error?.code || data?.error?.type || "";
    throw error;
  }

  const text = extractOpenAiText(data);
  if (!text) throw new Error("GPT 답변 보강 결과가 비어 있습니다.");

  const usage = normalizeOpenAiUsage(data.usage);
  return {
    ok: true,
    model: payload.model,
    draft: JSON.parse(text),
    usage,
    billing: estimateOpenAiBilling(usage, payload.model, env)
  };
}

function readAnswerComposerTimeoutMs(env = {}) {
  const configured = Math.round(readNumber(env.KAKAO_GPT_ANSWER_TIMEOUT_MS));
  if (configured >= 800 && configured <= 4000) return configured;
  return 2400;
}

function compactPolicyAnswerBaseResult(result = {}) {
  const frame = result.semanticFrame || {};
  const policyResponse = result.policyResponse || {};
  return {
    ok: Boolean(result.ok),
    question: cleanText(result.question || ""),
    officeLabel: cleanText(result.officeLabel || ""),
    confidence: Number(result.confidence || frame.confidence || 0),
    needsClarification: Boolean(result.needsClarification),
    missingSlots: asArray(result.missingSlots).slice(0, 8),
    domain: {
      code: cleanText(frame.domainCode || ""),
      label: cleanText(frame.domainLabel || ""),
      task: cleanText(frame.task || result.answerState?.basis?.task || ""),
      lookupStatus: cleanText(frame.lookupStatus || result.answerState?.basis?.lookupStatus || "")
    },
    answerState: {
      status: cleanText(result.answerState?.status || ""),
      primaryText: cleanText(result.answerState?.primaryText || ""),
      conditionalAnswers: asArray(result.answerState?.conditionalAnswers).map(cleanText).filter(Boolean).slice(0, 4),
      definitiveAnswers: asArray(result.answerState?.definitiveAnswers).map(cleanText).filter(Boolean).slice(0, 4),
      caveats: asArray(result.answerState?.caveats).map(cleanText).filter(Boolean).slice(0, 3),
      slotQuestions: asArray(result.answerState?.slotQuestions).slice(0, 3)
    },
    policyResponse: {
      title: cleanText(policyResponse.title || ""),
      lead: cleanText(policyResponse.lead || ""),
      answer: normalizePolicyAnswerTexts(policyResponse.answer).slice(0, 6),
      caution: cleanText(policyResponse.caution || ""),
      sourceKeys: asArray(policyResponse.sourceKeys).slice(0, 8),
      sourcePriority: cleanText(policyResponse.sourcePriority || "")
    }
  };
}

function normalizePolicyAnswerTexts(answer) {
  if (Array.isArray(answer)) {
    return answer.map((item) => {
      if (typeof item === "string") return cleanText(item);
      return cleanText(item?.text || item?.summary || item?.answer || "");
    }).filter(Boolean);
  }
  return cleanText(answer) ? [cleanText(answer)] : [];
}

function attachPolicyAnswerComposerMetadata(result = {}, composerResult = {}, budgetGate = {}, feature = "kakao_answer") {
  const metadata = {
    ok: Boolean(composerResult.ok),
    feature,
    model: cleanText(composerResult.model || ""),
    skipped: Boolean(composerResult.skipped),
    reason: cleanText(composerResult.reason || composerResult.error || ""),
    usage: composerResult.usage || null,
    billing: composerResult.billing || null,
    budgetGate: sanitizeUsageGate(budgetGate)
  };

  if (!composerResult.ok || !composerResult.draft) {
    return {
      ...result,
      gptAnswerComposer: metadata
    };
  }

  const draft = sanitizePolicyAnswerDraft(composerResult.draft);
  if (!draft.shortAnswer) {
    return {
      ...result,
      gptAnswerComposer: { ...metadata, draft }
    };
  }

  const nextStatus = mapComposerAnswerability(draft.answerability, result);
  const nextTexts = uniqueStrings([draft.shortAnswer, ...draft.bullets]);
  const nextPolicyResponse = result.policyResponse
    ? {
        ...result.policyResponse,
        lead: draft.shortAnswer,
        answer: nextTexts,
        caution: draft.caution || result.policyResponse.caution || ""
      }
    : result.policyResponse;
  const nextAnswerState = result.answerState
    ? {
        ...result.answerState,
        status: nextStatus,
        primaryText: draft.shortAnswer,
        definitiveAnswers: nextStatus === "definitive" ? nextTexts : [],
        conditionalAnswers: nextStatus === "definitive" ? [] : nextTexts,
        caveats: uniqueStrings([...(result.answerState.caveats || []), draft.caution]).filter(Boolean),
        slotQuestions: mergeComposerSlotQuestions(result.answerState.slotQuestions || [], draft.missingQuestions)
      }
    : result.answerState;

  return {
    ...result,
    policyResponse: nextPolicyResponse,
    answerState: nextAnswerState,
    responseText: formatPolicyAnswerDraftText(draft, result),
    needsClarification: nextStatus === "needs_slot" ? true : result.needsClarification,
    gptAnswerComposer: {
      ...metadata,
      draft
    }
  };
}

function sanitizePolicyAnswerDraft(draft = {}) {
  return {
    answerability: cleanText(draft.answerability || "conditional"),
    shortAnswer: cleanText(draft.shortAnswer || "").slice(0, 360),
    bullets: asArray(draft.bullets).map((item) => cleanText(item)).filter(Boolean).slice(0, 4),
    missingQuestions: asArray(draft.missingQuestions).map((item) => cleanText(item)).filter(Boolean).slice(0, 3),
    caution: cleanText(draft.caution || "").slice(0, 260),
    confidence: Math.max(0, Math.min(1, readNumber(draft.confidence)))
  };
}

function mapComposerAnswerability(answerability = "", result = {}) {
  const status = cleanText(answerability);
  if (status === "answerable" && !asArray(result.missingSlots).length) return "definitive";
  if (status === "needs_slot" || asArray(result.missingSlots).length) return "needs_slot";
  if (status === "unclassified") return "unclassified";
  return "conditional";
}

function mergeComposerSlotQuestions(existing = [], questions = []) {
  const mapped = asArray(questions).map((question, index) => ({
    slot: `gptFollowUp${index + 1}`,
    label: index === 0 ? "추가 확인" : `확인 ${index + 1}`,
    question
  }));
  return uniqueSlotQuestionObjects([...asArray(existing), ...mapped]).slice(0, 3);
}

function uniqueSlotQuestionObjects(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${cleanText(item?.slot || "")}:${cleanText(item?.question || "")}`;
    if (!item?.question || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatPolicyAnswerDraftText(draft = {}, result = {}) {
  const lines = [];
  if (draft.shortAnswer) lines.push(draft.shortAnswer);
  for (const bullet of draft.bullets || []) {
    if (bullet && bullet !== draft.shortAnswer) lines.push(`- ${bullet}`);
  }
  if (draft.missingQuestions?.length) {
    lines.push("");
    lines.push(`확인 필요: ${draft.missingQuestions.join(" / ")}`);
  } else if (result.officeLabel) {
    lines.push("");
    lines.push(`기준: ${result.officeLabel}`);
  }
  if (draft.caution) {
    lines.push("");
    lines.push(draft.caution);
  }
  return lines.filter(Boolean).join("\n").slice(0, 980);
}

function getPolicyAnswerComposerInstructions() {
  return [
    "당신은 특성화고·학교 행정 규정 Q&A의 답변 품질 보강기입니다.",
    "사용자 질문 원문과 로컬 규정 엔진 결과만 근거로 답변 문장을 더 명확하게 정리합니다.",
    "로컬 결과에 없는 법령명, 조문, 숫자, 일수, 금액, 절차를 새로 만들어내지 마세요.",
    "로컬 결과에 조건부 기준이 있으면 조건을 앞에 두고 답합니다. 예: 사립학교는 학교법인 규정 우선, 준용 시 60/180일.",
    "질문이 모호하거나 필수 슬롯이 부족하면 단정하지 말고 missingQuestions에 사용자가 바로 답할 짧은 질문을 넣습니다.",
    "카카오에서는 첫 답변이 길면 안 되므로 shortAnswer는 1~2문장, bullets는 최대 4개로 압축합니다.",
    "사용자에게 '규정을 먼저 확인합니다' 같은 내부 처리 문장만 보여주지 말고, 확인된 결론 또는 조건부 결론을 먼저 씁니다.",
    "법률 자문이나 최종 사건 판단으로 표현하지 말고, 공식 원문·소속 교육청·학교 내부 규정 확인 필요성을 caution에 분리합니다."
  ].join("\n");
}

function getPolicyAnswerComposerSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["answerability", "shortAnswer", "bullets", "missingQuestions", "caution", "confidence"],
    properties: {
      answerability: {
        type: "string",
        enum: ["answerable", "conditional", "needs_slot", "unclassified"]
      },
      shortAnswer: {
        type: "string",
        description: "사용자에게 먼저 보일 1~2문장 답변"
      },
      bullets: {
        type: "array",
        items: { type: "string" },
        maxItems: 4
      },
      missingQuestions: {
        type: "array",
        items: { type: "string" },
        maxItems: 3
      },
      caution: {
        type: "string",
        description: "공식 원문 확인, 소속 교육청, 학교 내부 규정 등 주의문"
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1
      }
    }
  };
}

function getKakaoQuestionNormalizerInstructions() {
  return [
    "당신은 한국 학교·특성화고 규정 Q&A 챗봇의 질문 이해 계층입니다.",
    "절대 최종 답변을 생성하지 마세요. 규정 내용, 금액, 일수, 절차를 새로 말하지 마세요.",
    "역할은 사용자의 거칠고 짧거나 장황한 카카오톡 발화를 규정 엔진이 처리할 수 있는 완성질문과 슬롯 JSON으로 바꾸는 것입니다.",
    "원문에 없는 사실을 추가하지 마세요. 다만 한국 학교 행정의 일반 표현은 안전하게 표준화할 수 있습니다. 예: 행정실 주무관·행정실장·행정직은 지방공무원/행정직 후보, 1박2일은 기간 1박 2일, 출장비는 국내 출장 여비 후보입니다.",
    "지역명은 문맥상 출발지와 출장지를 구분하세요. 예: '포항에 있는 학교의 ... 안동 출장'은 출발 학교 소재지를 포항시, 출장지를 안동시로 구조화합니다.",
    "대상 주체, 사건·사유, 업무 단계, 증빙·위험 신호의 조합을 보존하세요. 예: '남성 교직원 + 출산휴가'는 배우자 출산휴가 후보이고, '여 교직원 + 출산휴가'는 본인 출산 관련 특별휴가 후보입니다.",
    "구체 업무 물체를 버리지 마세요. 예: 급식 반찬 민원은 단순 민원이 아니라 학교급식·위생·민원 후보, 늘봄 위탁 계약은 단순 회계가 아니라 방과후·돌봄·늘봄 후보입니다.",
    "교육청이 명시되지 않았고 경북 지역 학교 문맥이면 경상북도교육청을 officeLabel 후보로 둘 수 있지만, 소속 교육청 확인 필요는 유지하세요.",
    "질문이 모호하면 answerability를 needs_slot 또는 unclassified로 두고, 사용자가 바로 답할 수 있는 짧은 추가질문을 1~3개만 만드세요.",
    "상담원 연결, 사람 상담, 전화 연결 버튼을 제안하지 마세요.",
    "normalizedQuestion은 규정 엔진에 넣을 한 문장 질문입니다. 사용자가 원한 핵심만 남기고 군더더기는 제거하세요.",
    "출력은 반드시 요청한 JSON 스키마만 따르세요."
  ].join("\n");
}

function getKakaoQuestionNormalizerSchema() {
  const stringArray = {
    type: "array",
    items: { type: "string" }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "normalizedQuestion",
      "intentDomain",
      "answerability",
      "confidence",
      "slots",
      "missingSlots",
      "clarifyingQuestions",
      "inferredFacts",
      "mustNotAssume",
      "reason"
    ],
    properties: {
      normalizedQuestion: { type: "string" },
      intentDomain: { type: "string" },
      answerability: {
        type: "string",
        enum: ["answerable", "needs_slot", "unclassified"]
      },
      confidence: { type: "number" },
      slots: {
        type: "object",
        additionalProperties: false,
        required: [
          "officeLabel",
          "roleLabel",
          "targetSubject",
          "schoolLocation",
          "institution",
          "origin",
          "destination",
          "duration",
          "serviceIssue",
          "procedureStage",
          "evidence",
          "riskSignal"
        ],
        properties: {
          officeLabel: { type: "string" },
          roleLabel: { type: "string" },
          targetSubject: { type: "string" },
          schoolLocation: { type: "string" },
          institution: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          duration: { type: "string" },
          serviceIssue: { type: "string" },
          procedureStage: { type: "string" },
          evidence: { type: "string" },
          riskSignal: { type: "string" }
        }
      },
      missingSlots: stringArray,
      clarifyingQuestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slot", "label", "question"],
          properties: {
            slot: { type: "string" },
            label: { type: "string" },
            question: { type: "string" }
          }
        }
      },
      inferredFacts: stringArray,
      mustNotAssume: stringArray,
      reason: { type: "string" }
    }
  };
}

function buildPayloadFromKakaoNormalizer(basePayload = {}, normalization = {}) {
  const slots = normalization.slots || {};
  const normalizedQuestion = cleanText(normalization.normalizedQuestion || basePayload.question || "");
  const roleLabel = cleanText(basePayload.roleLabel || slots.roleLabel || slots.targetSubject || "");
  const officeLabel = cleanText(basePayload.officeLabel || slots.officeLabel || "");

  return {
    ...basePayload,
    question: normalizedQuestion || basePayload.question,
    originalQuestion: basePayload.question,
    roleLabel,
    officeLabel
  };
}

export function chooseBetterPolicyResult(baseResult = {}, normalizedResult = {}) {
  if (!normalizedResult?.ok) return baseResult;
  if (!baseResult?.ok) return normalizedResult;
  const baseScore = scorePolicyResult(baseResult);
  const normalizedScore = scorePolicyResult(normalizedResult);
  if (hasPolicyResultRegression(baseResult, normalizedResult, { baseScore, normalizedScore })) return baseResult;
  return normalizedScore > baseScore + 4
    ? normalizedResult
    : baseResult;
}

export function hasPolicyResultRegression(baseResult = {}, candidateResult = {}, scores = {}) {
  const baseDomain = cleanText(baseResult.semanticFrame?.domainCode || "");
  const candidateDomain = cleanText(candidateResult.semanticFrame?.domainCode || "");
  if (baseDomain && candidateDomain && baseDomain !== candidateDomain) {
    return !shouldAllowDomainSwitch(baseResult, candidateResult, scores);
  }

  const baseMissing = new Set(asArray(baseResult.missingSlots));
  const candidateMissing = new Set(asArray(candidateResult.missingSlots));
  for (const slot of ["targetSubject", "travelerRole", "destination", "dateRange", "serviceIssue", "procedureStage", "riskSignal", "schoolLevel", "familyRelation"]) {
    if (!baseMissing.has(slot) && candidateMissing.has(slot)) return true;
  }

  const baseText = cleanText(baseResult.responseText || baseResult.answerState?.primaryText || "");
  const candidateText = cleanText(candidateResult.responseText || candidateResult.answerState?.primaryText || "");
  if (/지역 미특정/.test(candidateText) && !/지역 미특정/.test(baseText)) return true;
  if (/포항시에서\s*안동시로|안동시/.test(baseText) && !/안동시/.test(candidateText)) return true;

  return false;
}

function shouldAllowDomainSwitch(baseResult = {}, candidateResult = {}, scores = {}) {
  if (!candidateResult?.semanticFrame?.domainCode) return false;
  if (isLowQualityKakaoPolicyResult(candidateResult)) return false;
  const baseDomain = cleanText(baseResult.semanticFrame?.domainCode || "");
  const candidateDomain = cleanText(candidateResult.semanticFrame?.domainCode || "");
  if (baseDomain && candidateDomain && baseDomain !== candidateDomain && hasStrongOriginalDomainAnchor(baseResult, baseDomain)) {
    return false;
  }
  if (hasUsableKakaoPolicyResult(baseResult)) return false;

  const baseStatus = cleanText(baseResult.answerState?.status || "");
  const candidateStatus = cleanText(candidateResult.answerState?.status || "");
  const baseConfidence = Number(baseResult.confidence || baseResult.semanticFrame?.confidence || 0);
  const candidateConfidence = Number(candidateResult.confidence || candidateResult.semanticFrame?.confidence || 0);
  const baseMissing = asArray(baseResult.missingSlots);
  const candidateMissing = asArray(candidateResult.missingSlots);
  const baseScore = Number.isFinite(scores.baseScore) ? scores.baseScore : scorePolicyResult(baseResult);
  const candidateScore = Number.isFinite(scores.normalizedScore) ? scores.normalizedScore : scorePolicyResult(candidateResult);
  const baseWeak = isLowQualityKakaoPolicyResult(baseResult)
    || ["unclassified", "needs_slot"].includes(baseStatus)
    || hasCriticalMissingSlots(baseMissing)
    || baseConfidence < 0.45;
  const candidateSpecific = ["definitive", "conditional", "needs_slot"].includes(candidateStatus)
    && candidateResult.semanticFrame?.domainCode
    && candidateScore >= baseScore + 8
    && candidateConfidence >= Math.min(baseConfidence, 0.45);

  if (!baseWeak || !candidateSpecific) return false;
  const newCriticalMissing = candidateMissing.filter((slot) => !baseMissing.includes(slot) && hasCriticalMissingSlots([slot]));
  return newCriticalMissing.length === 0;
}

function hasStrongOriginalDomainAnchor(result = {}, domainCode = "") {
  const text = cleanText([
    result.originalQuestion,
    result.question,
    result.payload?.question
  ].join(" "));
  const patterns = {
    careerEmploymentGuidance: /졸업생|취업|채용|고졸채용|잡알리오|채용공고|추천채용|공채|근로계약|임금체불|체불임금|수습|해고|권고사직|부당해고|노동상담|노무상담|노동청|고용노동부|근로기준|근로조건/,
    instructorHonorarium: /강사료|강사수당|강사비|강의료|외부강사|시간당|원고료|자문료/,
    domesticTravelExpense: /출장비|국내출장|관외출장|근무지외|근무지내|여비|일비|식비|숙박비|운임/,
    vocationalFieldTrainingOperation: /현장실습|실습기업|참여기업|선도기업|표준협약|도제학교|일학습병행|실습생/,
    staffAttendanceService: /복무|근태|나이스근무상황|병가|연가|연차|특별휴가|출산휴가|배우자출산|육아시간|조퇴|지각|외출/,
    schoolViolenceProcedure: /학교폭력|학폭|전담기구|피해학생|가해학생|사안조사|보호조치/,
    facilityDigitalSecurity: /개인정보|정보보안|나이스계정|계정권한|CCTV|영상정보|초상권|홈페이지|SNS|사진|녹음|녹화/
  };
  return Boolean(patterns[domainCode]?.test(text));
}

export function scorePolicyResult(result = {}) {
  const stateScores = {
    definitive: 40,
    conditional: 32,
    needs_slot: 20,
    unclassified: 0
  };
  const missingPenalty = asArray(result.missingSlots).length * 4;
  const confidenceScore = Math.round(Number(result.confidence || result.semanticFrame?.confidence || 0) * 20);
  const domainScore = result.semanticFrame?.domainCode ? 25 : 0;
  const qualityPenalty = isLowQualityKakaoPolicyResult(result) ? 25 : 0;
  return domainScore + confidenceScore + (stateScores[result.answerState?.status] || 0) - missingPenalty - qualityPenalty;
}

function attachKakaoNormalizerMetadata(result = {}, normalizerResult = {}, budgetGate = {}, feature = "kakao_nlu") {
  const next = {
    ...result,
    aiNormalizer: {
      feature,
      enabled: true,
      used: Boolean(normalizerResult.ok),
      skipped: Boolean(normalizerResult.skipped),
      model: cleanText(normalizerResult.model || ""),
      reason: cleanText(normalizerResult.reason || normalizerResult.error || ""),
      budget: sanitizeUsageGate(budgetGate),
      billing: normalizerResult.billing || null,
      confidence: Number(normalizerResult.normalization?.confidence || 0),
      answerability: cleanText(normalizerResult.normalization?.answerability || "")
    }
  };

  if (normalizerResult.ok && normalizerResult.normalization?.answerability !== "answerable") {
    next.missingSlotQuestions = mergeSlotQuestions(
      result.missingSlotQuestions || [],
      normalizerResult.normalization.clarifyingQuestions || []
    );
    next.missingSlots = mergeStrings(result.missingSlots || [], normalizerResult.normalization.missingSlots || []);
    if (next.answerState) {
      next.answerState = {
        ...next.answerState,
        slotQuestions: mergeSlotQuestions(next.answerState.slotQuestions || [], next.missingSlotQuestions)
      };
    }
  }

  return next;
}

function mergeSlotQuestions(primary = [], secondary = []) {
  const seen = new Set();
  return [...primary, ...secondary]
    .map((item) => ({
      slot: cleanText(item.slot || "detail"),
      label: cleanText(item.label || item.slot || "추가 정보"),
      question: cleanText(item.question || "")
    }))
    .filter((item) => item.question)
    .filter((item) => {
      const key = `${item.slot}:${item.question}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function mergeStrings(first = [], second = []) {
  return [...new Set([...asArray(first), ...asArray(second)].map((item) => cleanText(item)).filter(Boolean))];
}

async function getOpenAiUsageGate(env, feature = "general") {
  if (!env.OPENAI_API_KEY) {
    return { ok: false, reason: "OPENAI_API_KEY secret 미설정" };
  }

  const settings = getCostControlSettings(env);
  if (!env.MEMBER_DB) {
    return {
      ok: true,
      reason: "usage ledger unavailable",
      settings
    };
  }

  const snapshot = await readOpenAiUsageSnapshot(env, feature);
  if (!snapshot.ok) {
    return {
      ok: true,
      reason: snapshot.reason,
      settings
    };
  }

  if (settings.dailyCallLimit && snapshot.dailyCalls >= settings.dailyCallLimit) {
    return {
      ok: false,
      reason: `일일 GPT 호출 한도 ${settings.dailyCallLimit}회에 도달했습니다.`,
      settings,
      snapshot
    };
  }

  if (settings.monthlyStopUsd && snapshot.monthlyEstimatedUsd >= settings.monthlyStopUsd) {
    return {
      ok: false,
      reason: `월 GPT 예상 비용 한도 $${settings.monthlyStopUsd}에 도달했습니다.`,
      settings,
      snapshot
    };
  }

  return {
    ok: true,
    settings,
    snapshot
  };
}

async function readOpenAiUsageSnapshot(env, feature = "general") {
  try {
    await ensureOpenAiUsageLedger(env);
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);
    const dayKey = now.toISOString().slice(0, 10);
    const month = await env.MEMBER_DB.prepare(`
      SELECT COALESCE(SUM(calls), 0) AS calls,
             COALESCE(SUM(estimated_usd), 0) AS estimated_usd
      FROM openai_usage_ledger
      WHERE month_key = ? AND feature = ?
    `).bind(monthKey, feature).first();
    const day = await env.MEMBER_DB.prepare(`
      SELECT COALESCE(SUM(calls), 0) AS calls,
             COALESCE(SUM(estimated_usd), 0) AS estimated_usd
      FROM openai_usage_ledger
      WHERE day_key = ? AND feature = ?
    `).bind(dayKey, feature).first();

    return {
      ok: true,
      monthKey,
      dayKey,
      monthlyCalls: Number(month?.calls || 0),
      monthlyEstimatedUsd: Number(month?.estimated_usd || 0),
      dailyCalls: Number(day?.calls || 0),
      dailyEstimatedUsd: Number(day?.estimated_usd || 0)
    };
  } catch (error) {
    return {
      ok: false,
      reason: `GPT 사용량 장부 확인 실패: ${error.message}`
    };
  }
}

async function ensureOpenAiUsageLedger(env) {
  if (!env.MEMBER_DB) return;
  await env.MEMBER_DB.prepare(`
    CREATE TABLE IF NOT EXISTS openai_usage_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature TEXT NOT NULL,
      model TEXT NOT NULL,
      month_key TEXT NOT NULL,
      day_key TEXT NOT NULL,
      calls INTEGER NOT NULL DEFAULT 1,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_usd REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `).run();
}

async function recordOpenAiUsage(env, { feature = "general", model = "", usage = {}, billing = {} } = {}) {
  if (!env.MEMBER_DB) return;
  try {
    await ensureOpenAiUsageLedger(env);
    const now = new Date();
    await env.MEMBER_DB.prepare(`
      INSERT INTO openai_usage_ledger (
        feature, model, month_key, day_key, calls,
        input_tokens, cached_input_tokens, output_tokens, estimated_usd, created_at
      )
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).bind(
      cleanText(feature || "general"),
      cleanText(model || billing.model || ""),
      now.toISOString().slice(0, 7),
      now.toISOString().slice(0, 10),
      Math.round(readNumber(usage.inputTokens)),
      Math.round(readNumber(usage.cachedInputTokens)),
      Math.round(readNumber(usage.outputTokens)),
      Number(billing.estimatedUsd || 0),
      now.toISOString()
    ).run();
  } catch {
    // Usage accounting must not break the user-facing answer path.
  }
}

function sanitizeUsageGate(gate = {}) {
  return {
    ok: Boolean(gate.ok),
    reason: cleanText(gate.reason || ""),
    monthlyEstimatedUsd: roundMoney(gate.snapshot?.monthlyEstimatedUsd || 0, 6),
    dailyCalls: Number(gate.snapshot?.dailyCalls || 0),
    monthlyStopUsd: Number(gate.settings?.monthlyStopUsd || 0),
    dailyCallLimit: Number(gate.settings?.dailyCallLimit || 0)
  };
}

function redactSensitiveText(value = "") {
  return cleanText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/01[016789]-?\d{3,4}-?\d{4}/g, "[phone]")
    .replace(/\d{2,3}-\d{3,4}-\d{4}/g, "[phone]")
    .replace(/\d{6}-?[1-4]\d{6}/g, "[rrn]");
}

function isFeatureEnabled(value) {
  return /^(true|1|yes|on)$/i.test(String(value || ""));
}

async function callOpenAiLegalAnalysis(openAiKey, payload, env = {}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openAiKey}`
    },
    body: JSON.stringify({
      model: payload.model,
      instructions: getLegalAnalysisInstructions(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                currentDate: new Date().toISOString().slice(0, 10),
                servicePurpose: "특성화고 학생, 교사, 학부모, 학교 관리자를 위한 법률정보 안내",
                topic: payload.topic,
                role: payload.role,
                partyRole: payload.partyRole,
                topicContext: payload.topicContext,
                mode: payload.mode,
                question: payload.question,
                officialSources: payload.officialSources || null
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "gyo6_legal_intake_analysis",
          strict: true,
          schema: getLegalAnalysisSchema()
        },
        verbosity: "medium"
      },
      max_output_tokens: 5600
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenAI API 오류 ${response.status}`);
    error.status = response.status;
    error.code = data?.error?.code || data?.error?.type || "";
    throw error;
  }

  const text = extractOpenAiText(data);
  if (!text) {
    throw new Error("AI 분석 결과가 비어 있습니다.");
  }

  try {
    const analysis = JSON.parse(text);
    const usage = normalizeOpenAiUsage(data.usage);
    return {
      analysis,
      usage,
      billing: estimateOpenAiBilling(usage, payload.model, env)
    };
  } catch (error) {
    throw new Error(`AI 분석 JSON 파싱 실패: ${error.message}`);
  }
}

async function loadOfficialSourceContext(payload, env) {
  if (String(env.OFFICIAL_SOURCE_PREFETCH || "true").toLowerCase() === "false") {
    return null;
  }

  try {
    const sourceApi = createOfficialSourceApi(env);
    const url = new URL("https://gyo6.internal/api/search");
    url.searchParams.set("q", payload.question);
    url.searchParams.set("topic", payload.topic || "general");
    if (payload.laws?.length) {
      url.searchParams.set("laws", payload.laws.slice(0, 5).join("|"));
    }
    if (payload.keywords?.length) {
      url.searchParams.set("keywords", payload.keywords.slice(0, 8).join("|"));
    }

    return compactOfficialSourceContext(await sourceApi.handleSearch(url));
  } catch (error) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      notices: [`공식자료 사전 확인 실패: ${error.message}`],
      results: {}
    };
  }
}

function compactOfficialSourceContext(data = {}) {
  const results = data.results || {};
  const compactResults = {
    laws: compactSourceItems(results.laws, 4),
    precedents: compactSourceItems(results.precedents, 3),
    interpretations: compactSourceItems(results.interpretations, 3),
    educationInterpretations: compactSourceItems(results.educationInterpretations, 3),
    educationAdminRules: compactSourceItems(results.educationAdminRules, 3),
    safetyDisasters: compactSourceItems(results.safetyDisasters, 3),
    safetyMaterials: compactSourceItems(results.safetyMaterials, 3)
  };

  return {
    ok: !data.error,
    checkedAt: data.verification?.checkedAt || data.generatedAt || new Date().toISOString(),
    status: data.status || {},
    notices: asArray(data.notices).slice(0, 6),
    results: compactResults,
    sourceReferenceIndex: buildSourceReferenceIndex(compactResults)
  };
}

function buildSourceReferenceIndex(results = {}) {
  const references = [];
  for (const law of asArray(results.laws)) {
    for (const article of asArray(law.articles)) {
      references.push({
        citation: formatArticleCitation(law, article),
        lawName: cleanText(law.title || ""),
        articleNo: cleanText(article.articleNo || ""),
        branchNo: cleanText(article.branchNo || ""),
        articleTitle: cleanText(article.title || ""),
        effectiveDate: cleanText(article.effectiveDate || law.date || ""),
        source: cleanText(law.source || ""),
        url: cleanText(law.url || ""),
        text: truncateText(cleanText(article.text || ""), 260)
      });
    }
  }
  return references.slice(0, 20);
}

function formatArticleCitation(law, article) {
  const lawName = cleanText(law.title || "법령");
  const articleNumber = formatArticleNumber(article);
  const title = cleanText(article.title || "");
  const effectiveDate = cleanText(article.effectiveDate || law.date || "");
  return [
    `${lawName} ${articleNumber}${title ? `(${title})` : ""}`,
    effectiveDate ? `시행 ${effectiveDate}` : ""
  ].filter(Boolean).join(" · ");
}

function formatArticleNumber(article) {
  const articleNo = cleanText(article.articleNo || "");
  const branchNo = cleanText(article.branchNo || "");
  if (!articleNo) {
    return "조문번호 확인 필요";
  }
  return branchNo ? `제${articleNo}조의${branchNo}` : `제${articleNo}조`;
}

function compactSourceItems(items, limit) {
  return asArray(items).slice(0, limit).map((item) => ({
    title: cleanText(item.title || ""),
    type: cleanText(item.type || ""),
    source: cleanText(item.source || ""),
    courtName: cleanText(item.courtName || item.court || ""),
    caseNumber: cleanText(item.caseNumber || item.caseNo || ""),
    decisionDate: cleanText(item.decisionDate || item.sentencedAt || item.date || ""),
    caseType: cleanText(item.caseType || ""),
    relatedLaws: asArray(item.relatedLaws || item.referencedLaws).slice(0, 5).map((law) => cleanText(law)).filter(Boolean),
    date: cleanText(item.date || ""),
    summary: truncateText(cleanText(item.summary || ""), 520),
    url: cleanText(item.url || ""),
    currentStatus: cleanText(item.currentStatus || ""),
    current: Boolean(item.current),
    relevance: item.relevance ? {
      score: Number(item.relevance.score || 0),
      label: cleanText(item.relevance.label || ""),
      reason: truncateText(cleanText(item.relevance.reason || ""), 220),
      matchedSignals: asArray(item.relevance.matchedSignals).slice(0, 6).map((signal) => cleanText(signal)).filter(Boolean)
    } : null,
    articles: asArray(item.articles).slice(0, 5).map((article) => ({
      articleNo: cleanText(article.articleNo || ""),
      branchNo: cleanText(article.branchNo || ""),
      title: cleanText(article.title || ""),
      effectiveDate: cleanText(article.effectiveDate || ""),
      text: truncateText(cleanText(article.text || ""), 420)
    })),
    reliability: cleanText(item.reliability?.label || ""),
    needsReview: Boolean(item.reliability?.needsReview)
  })).filter((item) => item.title || item.url);
}

function summarizeSourceGrounding(sourceContext) {
  if (!sourceContext) {
    return {
      enabled: false,
      checkedAt: "",
      itemCount: 0,
      notices: []
    };
  }

  const resultGroups = sourceContext.results || {};
  const itemCount = Object.values(resultGroups).reduce((sum, items) => sum + asArray(items).length, 0);
  return {
    enabled: true,
    checkedAt: sourceContext.checkedAt || "",
    itemCount,
    notices: asArray(sourceContext.notices).slice(0, 4)
  };
}

function buildPolicyEngineFirstAnalyzeResult({
  question = "",
  topic = "general",
  role = "auto",
  partyRole = "auto",
  topicContext = null,
  mode = "intake",
  caseId = "",
  access = {},
  env = {}
} = {}) {
  const policyResult = handlePolicyChatRequest({
    question,
    q: question,
    topic,
    roleLabel: role,
    partyRole,
    topicContext,
    mode
  }, {
    officeLabel: env.DEFAULT_OFFICE_LABEL || "경상북도교육청"
  });

  if (!shouldUsePolicyEngineFirstAnalyze(policyResult)) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    ok: true,
    caseId,
    engine: "policy-engine-first",
    model: "policy-engine",
    generatedAt: now,
    analysis: buildLegalAnalysisFromPolicyResult(policyResult, {
      question,
      topic,
      role,
      partyRole,
      topicContext,
      mode
    }),
    usage: {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    },
    billing: buildZeroOpenAiBilling(env),
    officialSources: null,
    sourceGrounding: {
      enabled: false,
      checkedAt: now,
      itemCount: 0,
      notices: ["규정 엔진 확정 답변으로 OpenAI 분석을 생략했습니다."]
    },
    member: access.member ? sanitizeMember(access.member) : null,
    costControl: getCostControlSettings(env),
    policyEngineFirst: {
      used: true,
      skippedOpenAi: true,
      reason: "usable_policy_result",
      domainCode: cleanText(policyResult.semanticFrame?.domainCode || ""),
      domainLabel: cleanText(policyResult.semanticFrame?.domainLabel || ""),
      answerStatus: cleanText(policyResult.answerState?.status || ""),
      sourceKeys: asArray(policyResult.policyResponse?.sourceKeys || policyResult.policyResponse?.ruleLookup?.sourceKeys).map(cleanText).filter(Boolean).slice(0, 8)
    }
  };
}

function shouldUsePolicyEngineFirstAnalyze(result = {}) {
  if (!result?.ok || !result.policyResponse || !result.semanticFrame?.domainCode) {
    return false;
  }
  if (result.semanticFrame?.intentClarification?.needsConfirmation) {
    return false;
  }
  return hasUsableKakaoPolicyResult(result);
}

function buildLegalAnalysisFromPolicyResult(result = {}, context = {}) {
  const frame = result.semanticFrame || {};
  const policyResponse = result.policyResponse || {};
  const answerTexts = extractPolicyAnswerTexts(result);
  const coreFinding = getPolicyEngineCoreFinding(result, answerTexts);
  const title = getPolicyEngineAnalysisTitle(result, context);
  const sourceFocus = getPolicyEngineSourceFocus(result);
  const slotFacts = getPolicyEngineSlotFacts(result);
  const missingSlots = asArray(result.missingSlots || frame.missingSlots).map((slot) => getPolicySlotLabel(slot, frame));
  const clarifyingQuestions = asArray(result.answerState?.slotQuestions || result.missingSlotQuestions)
    .slice(0, 3)
    .map((item) => ({
      question: cleanText(item.question || ""),
      why: `${cleanText(item.label || item.slot || "추가 정보")}에 따라 적용 규정이나 계산 결과가 달라질 수 있습니다.`,
      answerType: "text"
    }))
    .filter((item) => item.question);

  return {
    title,
    issueType: cleanText(frame.domainLabel || policyResponse.title || "규정·지침 확인"),
    situationSummary: getPolicyEngineSituationSummary(result, context),
    coreFinding,
    confidence: result.answerState?.status === "definitive" ? "높음" : "보통",
    knownFacts: uniqueStrings([
      `질문: ${cleanText(context.question || result.question || "")}`,
      frame.domainLabel ? `분류: ${frame.domainLabel}` : "",
      ...slotFacts,
      result.officeLabel ? `기준: ${result.officeLabel}` : ""
    ]).slice(0, 6),
    mustNotAssume: uniqueStrings([
      result.officeLabel === "경상북도교육청" && !hasPolicyQuestionOfficeSignal(context.question || result.question)
        ? "소속 교육청이 다르면 교육청 지침이나 학교 내부 규정 확인 결과가 달라질 수 있습니다."
        : "",
      policyResponse.caution || "",
      "최종 집행 전에는 현행 원문, 시행일, 학교 내부 결재 기준을 함께 확인해야 합니다."
    ]).slice(0, 5),
    missingFacts: missingSlots.length
      ? missingSlots
      : ["현재 질문만으로 규정 엔진이 필수 슬롯을 충족한 것으로 판단했습니다."],
    clarifyingQuestions,
    keyIssues: buildPolicyEngineKeyIssues(result, answerTexts, sourceFocus),
    immediateActions: buildPolicyEngineImmediateActions(result),
    stakeholderActions: buildPolicyEngineStakeholderActions(result),
    evidencePlan: buildPolicyEngineEvidencePlan(result),
    legalConsequenceAssessment: buildPolicyEngineLegalConsequenceAssessment(result),
    expertReferral: {
      level: "내부확인",
      reason: "규정표로 답할 수 있는 사안이므로 먼저 내부 복무·결재 기준과 소속 교육청 지침을 확인하면 됩니다.",
      suggestedMessage: "현재 질문의 산정 기준과 적용 신분을 내부 복무 담당자에게 확인해 주세요."
    },
    sourceSearchQueries: asArray(policyResponse.queries).map(cleanText).filter(Boolean).slice(0, 8),
    informationNotice: "이 답변은 법률 자문이나 사건 판단이 아니라 규정·지침 정보 정리입니다. 실제 조치 전에는 공식 원문과 기관 기준을 확인하세요."
  };
}

function extractPolicyAnswerTexts(result = {}) {
  const policyResponse = result.policyResponse || {};
  return uniqueStrings([
    result.answerState?.primaryText,
    ...(result.answerState?.definitiveAnswers || []),
    ...(result.answerState?.conditionalAnswers || []),
    ...asArray(policyResponse.answer).map((item) => {
      if (typeof item === "string") return item;
      return item?.text || item?.summary || item?.title || "";
    }),
    policyResponse.lead,
    policyResponse.caution
  ]).filter(Boolean);
}

function getPolicyEngineCoreFinding(result = {}, answerTexts = []) {
  return answerTexts.find((text) => /(?:\d+\s*일|원|상한|절차|승인|보고|진단서|증빙|전담기구|보호조치)/.test(text))
    || cleanText(result.answerState?.primaryText || result.policyResponse?.lead || result.responseText || "규정 엔진 기준으로 답변 가능한 사안입니다.");
}

function getPolicyEngineAnalysisTitle(result = {}, context = {}) {
  const frame = result.semanticFrame || {};
  const serviceIssue = cleanText(frame.slots?.serviceIssue?.label || "");
  const roleLabel = cleanText(frame.slots?.travelerRole?.subjectLabel || frame.slots?.targetSubject?.label || "");
  const base = [roleLabel, serviceIssue].filter(Boolean).join(" ");
  if (base) return `${base} 확인`;
  return cleanText(result.policyResponse?.title || frame.domainLabel || context.topic || "규정·지침 확인");
}

function getPolicyEngineSituationSummary(result = {}, context = {}) {
  const question = cleanText(context.question || result.question || "");
  const domain = cleanText(result.semanticFrame?.domainLabel || "");
  return `${question || "입력된 질문"}을 ${domain || "규정·지침"} 분야의 내부 규정 엔진으로 먼저 확인했습니다.`;
}

function getPolicyEngineSourceFocus(result = {}) {
  const sourceKeys = asArray(result.policyResponse?.sourceKeys || result.policyResponse?.ruleLookup?.sourceKeys)
    .map(cleanText)
    .filter(Boolean);
  return sourceKeys.length
    ? `우선 출처 후보: ${sourceKeys.slice(0, 4).join(", ")}`
    : "공식 규정·교육청 지침·학교 내부 기준";
}

function getPolicyEngineSlotFacts(result = {}) {
  const frame = result.semanticFrame || {};
  const slots = frame.slots || {};
  return [
    slots.travelerRole?.subjectLabel ? `대상: ${slots.travelerRole.subjectLabel}` : "",
    slots.serviceIssue?.label ? `사유: ${slots.serviceIssue.label}` : "",
    slots.employmentType?.label ? `고용 형태: ${slots.employmentType.label}` : "",
    slots.destination?.label ? `출장지: ${slots.destination.label}` : "",
    slots.duration?.days ? `기간: ${slots.duration.days}일` : "",
    slots.riskSignal?.label ? `위험 신호: ${slots.riskSignal.label}` : ""
  ].filter(Boolean);
}

function buildPolicyEngineKeyIssues(result = {}, answerTexts = [], sourceFocus = "") {
  const texts = answerTexts.slice(0, 3);
  if (!texts.length) {
    texts.push(cleanText(result.policyResponse?.lead || result.responseText || "적용 규정과 지침을 확인합니다."));
  }
  return texts.map((text, index) => ({
    title: index === 0 ? "핵심 답변" : `확인 기준 ${index + 1}`,
    analysis: text,
    sourceFocus
  }));
}

function buildPolicyEngineImmediateActions(result = {}) {
  const steps = asArray(result.policyResponse?.steps).map(cleanText).filter(Boolean);
  if (steps.length) return steps.slice(0, 4);
  return [
    "적용 신분과 소속 기관 기준을 확인합니다.",
    "공식 원문, 교육청 지침, 학교 내부 규정을 대조합니다.",
    "나이스·결재·상담·회의록 등 필요한 기록을 남깁니다."
  ];
}

function buildPolicyEngineStakeholderActions(result = {}) {
  const domain = cleanText(result.semanticFrame?.domainLabel || "규정·지침");
  return [
    {
      actor: "질문자",
      actions: [
        "본인 신분, 소속 교육청, 재직기간 또는 업무 단계를 확인합니다.",
        "이미 사용한 일수와 증빙자료를 정리합니다."
      ]
    },
    {
      actor: "학교·기관",
      actions: [
        `${domain} 관련 내부 규정과 결재 기준을 확인합니다.`,
        "공식 지침과 실제 처리 기록을 대조합니다."
      ]
    }
  ];
}

function buildPolicyEngineEvidencePlan(result = {}) {
  const frame = result.semanticFrame || {};
  const issueCode = cleanText(frame.slots?.serviceIssue?.code || "");
  const evidence = [
    {
      priority: "필수",
      item: "적용 신분과 소속 기관 기준",
      why: "교원, 기간제, 교육공무직, 사립학교 여부에 따라 적용 규정이 달라질 수 있습니다.",
      how: "인사·복무 담당자, 학교 내부 규정, 소속 교육청 지침으로 확인합니다."
    }
  ];

  if (frame.domainCode === "staffAttendanceService") {
    evidence.push({
      priority: "필수",
      item: issueCode === "annualLeave" ? "재직기간과 올해 사용한 연가 일수" : "나이스 근무상황과 증빙자료",
      why: "일수 산정과 승인 가능 여부의 직접 기준입니다.",
      how: "나이스 근무상황, 복무 결재, 인사기록, 증빙자료를 대조합니다."
    });
  } else {
    evidence.push({
      priority: "권고",
      item: "처리 기록과 공식 자료",
      why: "사후 민원이나 분쟁 시 판단 근거가 됩니다.",
      how: "상담기록, 회의록, 공문, 안내문, 공식 원문 링크를 함께 보관합니다."
    });
  }

  return evidence.slice(0, 4);
}

function buildPolicyEngineLegalConsequenceAssessment(result = {}) {
  return {
    applies: false,
    riskLevel: "해당 없음",
    summary: "현재 질문은 우선 규정·지침 확인 사안으로 보이며 형사·민사 판단은 별도 사실관계가 있을 때만 검토합니다.",
    criminalIssues: [],
    civilIssues: [],
    mitigationPlan: [],
    sourceSearchQueries: asArray(result.policyResponse?.queries).map(cleanText).filter(Boolean).slice(0, 5),
    caution: "분쟁, 손해, 징계, 형사 문제가 함께 제기되면 사실관계를 분리해 추가 상담이 필요합니다."
  };
}

function buildZeroOpenAiBilling(env = {}) {
  const costControl = getCostControlSettings(env);
  return {
    model: "policy-engine",
    pricingDate: costControl.pricingDate,
    estimatedUsd: 0,
    estimatedKrw: 0,
    krwPerUsd: costControl.krwPerUsd,
    free: true,
    reason: "policy_engine_first",
    note: "규정 엔진 확정 답변으로 OpenAI API 호출을 생략했습니다."
  };
}

function getPolicySlotLabel(slot = "", frame = {}) {
  const labels = {
    office: "소속 교육청",
    targetSubject: "대상자",
    travelerRole: frame.domainCode === "domesticTravelExpense" ? "출장자 신분" : "대상 신분",
    role: "신분",
    employmentType: "고용 형태",
    schoolLevel: "학교급",
    schoolRule: "학교 내부 규정",
    procedureStage: "업무 단계",
    dateRange: "기간",
    evidence: "증빙",
    riskSignal: "위험 신호",
    familyRelation: "가족관계",
    fiscalYear: "회계연도",
    serviceIssue: "복무 사유"
  };
  return labels[slot] || cleanText(slot);
}

function hasPolicyQuestionOfficeSignal(text = "") {
  return /교육청|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경상북도|경남|제주/.test(cleanText(text));
}

function parsePayloadList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }

  return String(value || "")
    .split(/[|,]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function sanitizeTopicContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    major: cleanText(value.major || ""),
    middle: cleanText(value.middle || ""),
    minor: cleanText(value.minor || ""),
    presetType: cleanText(value.presetType || ""),
    label: cleanText(value.label || ""),
    labels: parsePayloadList(value.labels).slice(0, 4)
  };
}

function getLegalAnalysisInstructions() {
  return [
    "당신은 한국 특성화고·직업계고 현장실습, 취업지도, 학교 민원 사안을 다루는 법률정보 분석 도우미입니다.",
    "목표는 법률 자문이나 사건 판단이 아니라, 사용자의 질문을 정확히 이해하고 필요한 공식자료 확인 방향과 다음 조치를 정리하는 것입니다.",
    "절대 원문에 없는 사실을 끼워 넣지 마세요. 이전 사례, 예시, 흔한 사례를 현재 질문의 사실처럼 쓰면 안 됩니다.",
    "질문에 '청소'만 있으면 '재료 운반'을 추가하지 마세요. 질문에 '재료'가 없으면 재료라는 말을 쓰지 마세요.",
    "질문에 부상, 진단서, 사고, 교육청 보고 요청이 없으면 그런 절차를 기본 결론으로 만들지 마세요.",
    "role은 답변을 요청하는 질문자 관점이고 partyRole은 실제 사건의 당사자입니다. 둘을 섞지 말고, 질문 본문에 없는 당사자나 사실은 만들지 마세요.",
    "topicContext는 사용자가 선택한 분류 힌트일 뿐입니다. 질문 본문과 충돌하면 질문 본문을 우선하고, 분류만으로 사고·폭행·민원·보고 의무를 추정하지 마세요.",
    "먼저 사용자가 실제로 말한 사실과 아직 모르는 사실을 분리하세요.",
    "officialSources가 제공되면 그 안의 공식자료 후보와 확인시각을 우선 반영하세요. 단, '직접 확인 필요' 또는 API 실패로 표시된 자료는 실존 조문으로 단정하지 말고 원문 확인 후보로만 다루세요.",
    "officialSources에 없는 조문·판례·해석례를 새로 만들어 인용하지 마세요. 필요한 경우 sourceSearchQueries에 추가 검색어로만 제안하세요.",
    "officialSources.sourceReferenceIndex는 법제처 원문에서 확인한 조문 인덱스입니다. 이 목록의 citation만 '원문 확인' 근거로 사용할 수 있습니다.",
    "officialSources.results.precedents는 승인된 공식 판례 API 결과 전용입니다. 이 배열이 비어 있으면 사건명·사건번호·선고일·법원명·판결요지·형량·손해배상액을 추정하지 말고 '판례 확인 필요'로 처리하세요.",
    "officialSources.results.educationInterpretations는 교육부 법령해석 후보입니다. 교육부 소관 행정규칙·고시·훈령과 구분해서, 쟁점 해석 방향을 확인하는 보조 근거로 다루세요.",
    "officialSources.results.educationAdminRules는 교육부 소관 행정규칙·고시·훈령 후보입니다. 이를 '교육부 행정해석'이라고 바꾸어 부르지 말고, 학교 실무 기준 확인 자료로만 다루세요.",
    "학교 행정 Q&A에서는 교원, 지방공무원, 교육공무직, 기간제 직원 등 신분을 먼저 구분하고, 신분별 적용 법령·복무규정·근로관계 기준을 섞지 마세요.",
    "근태·휴가·출장 질문은 교원휴가에 관한 예규, 국가공무원 복무규정, 지방공무원 복무규정, 공무원 여비 규정, 관할 교육청 기준을 구분해서 확인 후보로 제시하세요. 원문 근거 없이 휴가 일수, 수당, 증빙 의무를 단정하지 마세요.",
    "학교회계·지출 질문은 관할 시도교육청 학교회계 지침, 회계규칙, 품의·계약·검수·지출결의·영수증·세금계산서 등 문서 흐름을 확인하고, 개인 책임이나 위법성을 단정하지 마세요.",
    "학생생활기록 질문은 학교생활기록 작성 및 관리지침과 당해 학년도 학교생활기록부 기재요령을 우선 확인 후보로 삼고, 정정 가능 여부·보존기간·증빙 필요성을 원문 없이 확정하지 마세요.",
    "학교폭력 질문은 학교폭력예방법, 시행령, 최신 사안처리 가이드북을 신고·접수, 사안조사, 전담기구, 심의, 조치, 불복 단계로 나누어 다루세요.",
    "keyIssues.sourceFocus에는 관련 citation을 그대로 넣고, immediateActions·stakeholderActions·evidencePlan의 문장에는 꼭 필요한 경우 '(근거: citation)' 형식으로 짧게 붙이세요.",
    "officialSources.sourceReferenceIndex에 없는 조문번호나 벌칙을 추측해 쓰지 마세요. 특히 제○조, 징역, 벌금, 과태료, 손해배상 범위는 citation 또는 원문 확인 필요 중 하나로만 처리하세요.",
    "1차 결과는 긴 보고서가 아니라 상황 파악과 대처 방안 중심의 간편 보고서 초안으로 쓰일 예정입니다. 한 번에 모든 것을 처리하려 하지 말고 우선순위를 좁히세요.",
    "추가 질문은 미리 정한 문항을 나열하지 말고, 이 사안 판단에 꼭 필요한 1~3개만 생성하세요. 모르거나 민감하면 비워도 되는 질문으로 작성하세요.",
    "증빙자료는 필수 1~2개와 권고 1~2개 위주로 제한하세요. 실제 법적 필수 자료가 불명확하면 필수라고 과장하지 마세요.",
    "주체별 조치사항은 현재 사안에 직접 관련된 주체 2~3개만 정리하세요.",
    "법령 조문은 officialSources.sourceReferenceIndex에 citation이 있을 때만 확인된 근거로 쓰고, 없으면 우선 확인해야 할 공식자료와 검색어를 제시하며 확인 필요 상태로 표현하세요.",
    "교사·학생·학부모의 일반 상담이라도 폭행, 상해, 협박, 명예훼손, 모욕, 성폭력, 아동학대, 개인정보 유출, 손해배상, 고소·고발·소송 가능성이 보이면 legalConsequenceAssessment.applies를 true로 설정하세요.",
    "형사 사건 또는 민사 사건으로 발전할 가능성이 있으면 형량·벌금·손해배상 범위, 감경·감량 또는 책임 완화에 필요한 행동과 증거를 별도 섹션으로 정리하세요.",
    "다만 형량, 벌금, 과태료, 징역 기간, 손해배상 범위는 officialSources의 원문 조문·판례·해석례에 근거가 있을 때만 구체적으로 쓰세요. 원문이 없으면 '원문 확인 필요'라고 표시하고 sourceSearchQueries에 확인할 법령·판례 검색어를 넣으세요.",
    "감경·감량 자료는 필수, 권고, 선택으로 구분하고, 반성문처럼 무조건 유리하다고 단정하지 말고 실제로 필요한 조치와 증거 보전 중심으로 안내하세요.",
    "단순 안내, 경미한 민원, 학부모 전달로 끝날 가능성이 큰 사안에는 legalConsequenceAssessment.applies를 false로 두고 형사·민사 위험을 과장하지 마세요.",
    "중대한 위험, 보복, 성희롱, 폭행, 산재, 해고, 소송 가능성이 보일 때만 전문가 상담 단계를 올리세요.",
    "출력은 반드시 요청한 JSON 스키마만 따르세요."
  ].join("\n");
}

function getLegalAnalysisSchema() {
  const stringArray = {
    type: "array",
    items: { type: "string" }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "issueType",
      "situationSummary",
      "coreFinding",
      "confidence",
      "knownFacts",
      "mustNotAssume",
      "missingFacts",
      "clarifyingQuestions",
      "keyIssues",
      "immediateActions",
      "stakeholderActions",
      "evidencePlan",
      "legalConsequenceAssessment",
      "expertReferral",
      "sourceSearchQueries",
      "informationNotice"
    ],
    properties: {
      title: { type: "string" },
      issueType: { type: "string" },
      situationSummary: { type: "string" },
      coreFinding: { type: "string" },
      confidence: {
        type: "string",
        enum: ["높음", "보통", "낮음"]
      },
      knownFacts: stringArray,
      mustNotAssume: stringArray,
      missingFacts: stringArray,
      clarifyingQuestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "why", "answerType"],
          properties: {
            question: { type: "string" },
            why: { type: "string" },
            answerType: { type: "string" }
          }
        }
      },
      keyIssues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "analysis", "sourceFocus"],
          properties: {
            title: { type: "string" },
            analysis: { type: "string" },
            sourceFocus: stringArray
          }
        }
      },
      immediateActions: stringArray,
      stakeholderActions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["actor", "actions"],
          properties: {
            actor: { type: "string" },
            actions: stringArray
          }
        }
      },
      evidencePlan: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["priority", "item", "why", "how"],
          properties: {
            priority: {
              type: "string",
              enum: ["필수", "권고", "선택"]
            },
            item: { type: "string" },
            why: { type: "string" },
            how: { type: "string" }
          }
        }
      },
      legalConsequenceAssessment: {
        type: "object",
        additionalProperties: false,
        required: [
          "applies",
          "riskLevel",
          "summary",
          "criminalIssues",
          "civilIssues",
          "mitigationPlan",
          "sourceSearchQueries",
          "caution"
        ],
        properties: {
          applies: { type: "boolean" },
          riskLevel: {
            type: "string",
            enum: ["해당 없음", "낮음", "보통", "높음", "즉시 상담"]
          },
          summary: { type: "string" },
          criminalIssues: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["issue", "legalBasis", "potentialConsequence", "sourceStatus", "requiredFacts"],
              properties: {
                issue: { type: "string" },
                legalBasis: { type: "string" },
                potentialConsequence: { type: "string" },
                sourceStatus: {
                  type: "string",
                  enum: ["원문 확인", "원문 확인 필요", "판례 확인 필요"]
                },
                requiredFacts: stringArray
              }
            }
          },
          civilIssues: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["issue", "legalBasis", "possibleClaim", "sourceStatus", "requiredFacts"],
              properties: {
                issue: { type: "string" },
                legalBasis: { type: "string" },
                possibleClaim: { type: "string" },
                sourceStatus: {
                  type: "string",
                  enum: ["원문 확인", "원문 확인 필요", "판례 확인 필요"]
                },
                requiredFacts: stringArray
              }
            }
          },
          mitigationPlan: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["priority", "action", "evidence", "why", "legalBasis"],
              properties: {
                priority: {
                  type: "string",
                  enum: ["필수", "권고", "선택"]
                },
                action: { type: "string" },
                evidence: { type: "string" },
                why: { type: "string" },
                legalBasis: { type: "string" }
              }
            }
          },
          sourceSearchQueries: stringArray,
          caution: { type: "string" }
        }
      },
      expertReferral: {
        type: "object",
        additionalProperties: false,
        required: ["level", "reason", "suggestedMessage"],
        properties: {
          level: {
            type: "string",
            enum: ["내부확인", "교육청문의", "노무사상담", "변호사상담", "즉시상향"]
          },
          reason: { type: "string" },
          suggestedMessage: { type: "string" }
        }
      },
      sourceSearchQueries: stringArray,
      informationNotice: { type: "string" }
    }
  };
}

async function getOptionalAuthContext(request, env) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  return requireAuthContext(request, env);
}

async function requireAuthContext(request, env) {
  const token = getBearerToken(request);
  if (!token) {
    return {
      error: "로그인이 필요합니다.",
      code: "AUTH_REQUIRED",
      status: 401
    };
  }

  try {
    const user = await verifyFirebaseIdToken(token, env);
    return {
      ok: true,
      user,
      member: await getMemberForUser(user, env)
    };
  } catch (error) {
    return {
      error: error.message || "로그인 확인에 실패했습니다.",
      code: "AUTH_INVALID",
      status: 401
    };
  }
}

async function requireAdminContext(request, env) {
  const authContext = await requireAuthContext(request, env);
  if (authContext.error) {
    return authContext;
  }

  if (!hasAdminAccess(authContext.member)) {
    return {
      error: "총괄관리자 또는 관리자 권한이 필요합니다.",
      code: "ADMIN_REQUIRED",
      status: 403
    };
  }

  return authContext;
}

async function assertLawAccess(authContext, env) {
  if (!isAuthRequired(env)) {
    if (!authContext || authContext.error) {
      return { ok: true, member: null };
    }

    return { ok: true, member: authContext.member };
  }

  if (!authContext || authContext.error) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      status: 401,
      message: authContext?.error || "법률정보 AI는 로그인 후 이용할 수 있습니다."
    };
  }

  const member = authContext.member || await getMemberForUser(authContext.user, env);
  if (!member || member.status !== "approved") {
    return {
      ok: false,
      code: "MEMBER_NOT_APPROVED",
      status: 403,
      message: "회원가입 승인 후 법률정보 AI를 이용할 수 있습니다."
    };
  }

  if (!LAW_ACCESS_ROLES.has(member.role)) {
    return {
      ok: false,
      code: "LAW_ROLE_REQUIRED",
      status: 403,
      message: "관리자에 의해 법률정보 권한을 승인받아야 합니다."
    };
  }

  return { ok: true, member };
}

async function getMemberProfile(user, env) {
  const member = await getMemberForUser(user, env);
  return {
    ok: true,
    configured: Boolean(env.MEMBER_DB),
    member: sanitizeMember(member),
    capabilities: getMemberCapabilities(member)
  };
}

async function registerMember(user, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다. Cloudflare D1 연결 후 가입 신청을 저장할 수 있습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503,
      member: sanitizeMember(buildVirtualMember(user, env))
    };
  }

  const now = new Date().toISOString();
  const existing = await getMemberByUid(user.uid, env);
  const requestedRole = normalizeRole(body.requestedRole || "general", "general");
  const displayName = cleanText(body.displayName || user.name || "");
  const schoolName = cleanText(body.schoolName || "");
  const phone = cleanText(body.phone || "");
  const note = cleanText(body.note || "");
  const invitation = await getInvitationForEmail(user.email, env);
  const ownerMember = buildVirtualMember(user, env);
  const isOwner = ownerMember.role === "owner";
  const role = isOwner ? "owner" : invitation?.role || (existing?.role && existing.role !== "pending" ? existing.role : "pending");
  const status = isOwner ? "approved" : invitation?.status || (existing?.status && existing.status !== "deleted" ? existing.status : "pending");

  await env.MEMBER_DB.prepare(`
    INSERT INTO members (
      uid, email, display_name, school_name, phone, requested_role, role, status,
      note, created_at, updated_at, approved_at, approved_by, last_login_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      school_name = excluded.school_name,
      phone = excluded.phone,
      requested_role = excluded.requested_role,
      note = excluded.note,
      updated_at = excluded.updated_at,
      last_login_at = excluded.last_login_at
  `).bind(
    user.uid,
    user.email,
    displayName,
    schoolName,
    phone,
    requestedRole,
    role,
    status,
    note,
    existing?.createdAt || now,
    now,
    isOwner ? now : existing?.approvedAt || null,
    isOwner ? user.uid : existing?.approvedBy || null,
    now
  ).run();

  await writeAuditLog(env, {
    actorUid: user.uid,
    targetUid: user.uid,
    action: existing ? "member.profile.update" : "member.register",
    detail: JSON.stringify({ requestedRole, status, role })
  });

  if (invitation) {
    await env.MEMBER_DB.prepare(`
      UPDATE member_invitations
      SET accepted_uid = ?, accepted_at = ?
      WHERE email = ?
    `).bind(user.uid, now, user.email).run().catch(() => null);
  }

  const member = await getMemberForUser(user, env);
  return {
    ok: true,
    member: sanitizeMember(member),
    capabilities: getMemberCapabilities(member)
  };
}

async function upsertMemberProfile(user, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  return registerMember(user, body, env);
}

async function createConsultation(authContext, body = {}, env) {
  const access = await assertApprovedMemberAccess(authContext, env);
  if (!access.ok) {
    return access;
  }

  await ensureConsultationTables(env);

  const room = normalizeCounselRoom(body.room);
  if (!room) {
    return { error: "학생 상담실 또는 선생님 상담실을 선택해 주세요.", code: "ROOM_REQUIRED", status: 400 };
  }

  const title = truncateText(body.title, 120);
  const content = truncateText(body.body, 4000);
  if (!title || !content) {
    return { error: "상담 제목과 내용을 입력해 주세요.", code: "CONSULTATION_REQUIRED", status: 400 };
  }

  const now = new Date().toISOString();
  const anonymousName = truncateText(body.anonymousName || (room === "student" ? "익명 학생" : "익명 선생님"), 40);

  const result = await env.MEMBER_DB.prepare(`
    INSERT INTO consultations (
      room, author_uid, author_email, author_name, anonymous_name, title, body,
      status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
  `).bind(
    room,
    authContext.user.uid,
    authContext.user.email || "",
    authContext.member?.displayName || authContext.user.name || "",
    anonymousName,
    title,
    content,
    now,
    now
  ).run();

  const id = result.meta?.last_row_id || result.meta?.lastRowId;
  await writeAuditLog(env, {
    actorUid: authContext.user.uid,
    targetUid: String(id || ""),
    action: "consultation.create",
    detail: JSON.stringify({ room })
  });

  return {
    ok: true,
    consultation: await getConsultationById(id, env, hasAdminAccess(authContext.member))
  };
}

async function listConsultations(authContext, env, url) {
  const access = await assertApprovedMemberAccess(authContext, env);
  if (!access.ok) {
    return access;
  }

  await ensureConsultationTables(env);

  const isAdmin = hasAdminAccess(authContext.member);
  const room = normalizeCounselRoom(url.searchParams.get("room"));
  const where = [];
  const params = [];

  if (!isAdmin) {
    where.push("author_uid = ?");
    params.push(authContext.user.uid);
  }

  if (room) {
    where.push("room = ?");
    params.push(room);
  }

  const query = `
    SELECT id, room, author_uid, author_email, author_name, anonymous_name, title, body,
           status, admin_reply, admin_uid, admin_replied_at, created_at, updated_at
    FROM consultations
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  const statement = env.MEMBER_DB.prepare(query);
  const result = await (params.length ? statement.bind(...params) : statement).all();

  return {
    ok: true,
    consultations: (result.results || []).map((row) => mapConsultationRow(row, isAdmin))
  };
}

async function replyConsultation(adminContext, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  await ensureConsultationTables(env);

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "답변할 상담글 ID가 필요합니다.", code: "CONSULTATION_ID_REQUIRED", status: 400 };
  }

  const reply = truncateText(body.reply, 5000);
  if (!reply) {
    return { error: "관리자 답변 내용을 입력해 주세요.", code: "REPLY_REQUIRED", status: 400 };
  }

  const status = normalizeConsultationStatus(body.status || "answered");
  const now = new Date().toISOString();
  await env.MEMBER_DB.prepare(`
    UPDATE consultations
    SET admin_reply = ?, admin_uid = ?, admin_replied_at = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).bind(reply, adminContext.user.uid, now, status, now, id).run();

  const consultation = await getConsultationById(id, env, true);
  if (!consultation) {
    return { error: "상담글을 찾지 못했습니다.", code: "CONSULTATION_NOT_FOUND", status: 404 };
  }

  await writeAuditLog(env, {
    actorUid: adminContext.user.uid,
    targetUid: String(id),
    action: "consultation.reply",
    detail: JSON.stringify({ status })
  });

  return {
    ok: true,
    consultation
  };
}

async function createBoardPost(authContext, body = {}, env) {
  const access = await assertApprovedMemberAccess(authContext, env);
  if (!access.ok) {
    return access;
  }

  await ensureConsultationTables(env);

  const room = normalizeBoardRoom(body.room);
  if (!room) {
    return { error: "게시판을 선택해 주세요.", code: "BOARD_ROOM_REQUIRED", status: 400 };
  }

  if (room === "promotion" && !hasAdminAccess(authContext.member)) {
    return { error: "홍보 게시판 작성은 관리자만 가능합니다.", code: "ADMIN_REQUIRED", status: 403 };
  }

  const title = truncateText(body.title, 120);
  const content = truncateText(body.body, 4000);
  if (!title || !content) {
    return { error: "제목과 내용을 입력해 주세요.", code: "BOARD_POST_REQUIRED", status: 400 };
  }

  const now = new Date().toISOString();
  const anonymousName = truncateText(body.anonymousName || getBoardRoomDefaultAuthor(room), 40);

  const result = await env.MEMBER_DB.prepare(`
    INSERT INTO consultations (
      room, author_uid, author_email, author_name, anonymous_name, title, body,
      status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
  `).bind(
    room,
    authContext.user.uid,
    authContext.user.email || "",
    authContext.member?.displayName || authContext.user.name || "",
    anonymousName,
    title,
    content,
    now,
    now
  ).run();

  const id = result.meta?.last_row_id || result.meta?.lastRowId;
  await writeAuditLog(env, {
    actorUid: authContext.user.uid,
    targetUid: String(id || ""),
    action: "board.create",
    detail: JSON.stringify({ room })
  });

  return {
    ok: true,
    post: await getBoardPostById(id, env, authContext)
  };
}

async function listBoardPosts(authContext, env, url) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  await ensureConsultationTables(env);

  const room = normalizeBoardRoom(url.searchParams.get("room"));
  const keyword = truncateText(url.searchParams.get("q"), 80);
  const rooms = room ? [room] : [...BOARD_ROOMS];
  const placeholders = rooms.map(() => "?").join(", ");
  const where = [`room IN (${placeholders})`];
  const params = [...rooms];

  if (keyword) {
    where.push("(title LIKE ? OR body LIKE ?)");
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const query = `
    SELECT id, room, author_uid, author_email, author_name, anonymous_name, title, body,
           status, admin_reply, admin_uid, admin_replied_at, created_at, updated_at
    FROM consultations
    WHERE ${where.join(" AND ")}
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  const result = await env.MEMBER_DB.prepare(query).bind(...params).all();

  return {
    ok: true,
    posts: (result.results || []).map((row) => mapBoardPostRow(row, authContext))
  };
}

async function replyBoardPost(adminContext, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  await ensureConsultationTables(env);

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "답변할 게시글 ID가 필요합니다.", code: "BOARD_POST_ID_REQUIRED", status: 400 };
  }

  const target = await env.MEMBER_DB.prepare(`
    SELECT id, room
    FROM consultations
    WHERE id = ?
  `).bind(id).first();
  if (!target || !normalizeBoardRoom(target.room)) {
    return { error: "게시판 글을 찾지 못했습니다.", code: "BOARD_POST_NOT_FOUND", status: 404 };
  }

  const reply = truncateText(body.reply, 5000);
  if (!reply) {
    return { error: "관리자 답변 내용을 입력해 주세요.", code: "REPLY_REQUIRED", status: 400 };
  }

  const status = normalizeConsultationStatus(body.status || "answered");
  const now = new Date().toISOString();
  await env.MEMBER_DB.prepare(`
    UPDATE consultations
    SET admin_reply = ?, admin_uid = ?, admin_replied_at = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).bind(reply, adminContext.user.uid, now, status, now, id).run();

  await writeAuditLog(env, {
    actorUid: adminContext.user.uid,
    targetUid: String(id),
    action: "board.reply",
    detail: JSON.stringify({ status })
  });

  return {
    ok: true,
    post: await getBoardPostById(id, env, adminContext)
  };
}

function listEbooks(authContext = null) {
  const member = authContext?.member || null;
  return {
    ok: true,
    ebooks: EBOOK_CATALOG.map((ebook) => ({
      ...ebook,
      access: {
        canOpenStudent: canUseStudentEbook(member),
        canOpenTeacher: canUseTeacherEbook(member)
      }
    }))
  };
}

function getEbookLesson(authContext, options = {}) {
  const ebookId = cleanText(options.ebookId);
  const lessonId = cleanText(options.lessonId);
  const mode = cleanText(options.mode || "student");
  const member = authContext?.member || null;

  if (ebookId !== "fb-service-l3-2026-ext" || lessonId !== "fb.c01.l01") {
    return { error: "전자책 또는 차시를 찾지 못했습니다.", code: "EBOOK_LESSON_NOT_FOUND", status: 404 };
  }

  if (mode === "teacher") {
    if (!canUseTeacherEbook(member)) {
      return { error: "교사용 전자책은 승인된 교사 권한이 필요합니다.", code: "TEACHER_EBOOK_REQUIRED", status: 403 };
    }
    return {
      ok: true,
      mode: "teacher",
      lesson: deepClone(FB_SERVICE_C01_TEACHER_LESSON)
    };
  }

  if (!canUseStudentEbook(member)) {
    return { error: "학생용 전자책은 승인 회원 권한이 필요합니다.", code: "STUDENT_EBOOK_REQUIRED", status: 403 };
  }

  return {
    ok: true,
    mode: "student",
    lesson: buildStudentSafeLesson(FB_SERVICE_C01_STUDENT_LESSON)
  };
}

async function saveEbookProgress(authContext, body = {}, env) {
  const member = authContext?.member || null;
  if (!canUseStudentEbook(member)) {
    return { error: "전자책 진도 저장은 승인 회원만 가능합니다.", code: "STUDENT_EBOOK_REQUIRED", status: 403 };
  }
  if (!env.MEMBER_DB) {
    return { error: "회원 DB가 아직 연결되지 않았습니다.", code: "MEMBER_DB_NOT_CONFIGURED", status: 503 };
  }

  await ensureEbookTables(env);

  const ebookId = cleanText(body.ebookId);
  const lessonId = cleanText(body.lessonId);
  const stepId = cleanText(body.stepId);
  const questionId = cleanText(body.questionId || "");
  if (!ebookId || !lessonId || !stepId) {
    return { error: "전자책, 차시, 단계 ID가 필요합니다.", code: "EBOOK_PROGRESS_REQUIRED", status: 400 };
  }

  const now = new Date().toISOString();
  await env.MEMBER_DB.prepare(`
    INSERT INTO ebook_progress (
      user_uid, ebook_id, lesson_id, step_id, question_id, status, payload_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_uid, ebook_id, lesson_id, step_id, question_id)
    DO UPDATE SET status = excluded.status, payload_json = excluded.payload_json, updated_at = excluded.updated_at
  `).bind(
    authContext.user.uid,
    ebookId,
    lessonId,
    stepId,
    questionId,
    cleanText(body.status || "completed"),
    JSON.stringify(body.payload || {}),
    now
  ).run();

  return { ok: true, updatedAt: now };
}

async function ensureEbookTables(env) {
  if (!env.MEMBER_DB) return;
  await env.MEMBER_DB.prepare(`
    CREATE TABLE IF NOT EXISTS ebook_progress (
      user_uid TEXT NOT NULL,
      ebook_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      question_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed',
      payload_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_uid, ebook_id, lesson_id, step_id, question_id)
    )
  `).run();
}

function buildStudentSafeLesson(lesson) {
  const safeLesson = deepClone(lesson);
  safeLesson.steps = (safeLesson.steps || []).map((step) => ({
    ...step,
    questions: (step.questions || []).map((question) => sanitizeStudentQuestion(question)),
    studentExplanations: (step.studentExplanations || []).map((item) => ({
      ...item,
      lockedUntil: item.showAfter === "attempt" ? "attempt" : item.lockedUntil || ""
    }))
  }));
  delete safeLesson.sourceFiles;
  return safeLesson;
}

function sanitizeStudentQuestion(question) {
  const safe = { ...question };
  if (safe.answerPolicy === "after_attempt") {
    safe.answerLockedUntil = "attempt";
  }
  delete safe.expectedAnswerHtml;
  delete safe.correctOptionIndex;
  delete safe.studentExplanationHtml;
  return safe;
}

function canUseStudentEbook(member) {
  return member?.status === "approved" && EBOOK_STUDENT_ROLES.has(member.role);
}

function canUseTeacherEbook(member) {
  return member?.status === "approved" && EBOOK_TEACHER_ROLES.has(member.role);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function assertApprovedMemberAccess(authContext, env) {
  if (!env.MEMBER_DB) {
    return {
      ok: false,
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  if (!authContext?.member || authContext.member.status !== "approved") {
    return {
      ok: false,
      error: "관리자 승인 후 상담실을 이용할 수 있습니다.",
      code: "MEMBER_APPROVAL_REQUIRED",
      status: 403
    };
  }

  return { ok: true };
}

async function ensureConsultationTables(env) {
  if (!env.MEMBER_DB) {
    return;
  }

  await env.MEMBER_DB.prepare(`
    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT NOT NULL,
      author_uid TEXT NOT NULL,
      author_email TEXT DEFAULT '',
      author_name TEXT DEFAULT '',
      anonymous_name TEXT DEFAULT '',
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      admin_reply TEXT DEFAULT '',
      admin_uid TEXT DEFAULT '',
      admin_replied_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await env.MEMBER_DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_consultations_author_room_updated
      ON consultations (author_uid, room, updated_at)
  `).run();

  await env.MEMBER_DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_consultations_room_status_updated
      ON consultations (room, status, updated_at)
  `).run();
}

async function getConsultationById(id, env, includeAuthor = false) {
  if (!id || !env.MEMBER_DB) {
    return null;
  }

  const row = await env.MEMBER_DB.prepare(`
    SELECT id, room, author_uid, author_email, author_name, anonymous_name, title, body,
           status, admin_reply, admin_uid, admin_replied_at, created_at, updated_at
    FROM consultations
    WHERE id = ?
  `).bind(id).first();

  return row ? mapConsultationRow(row, includeAuthor) : null;
}

async function getBoardPostById(id, env, authContext = null) {
  if (!id || !env.MEMBER_DB) {
    return null;
  }

  const row = await env.MEMBER_DB.prepare(`
    SELECT id, room, author_uid, author_email, author_name, anonymous_name, title, body,
           status, admin_reply, admin_uid, admin_replied_at, created_at, updated_at
    FROM consultations
    WHERE id = ?
  `).bind(id).first();

  return row && normalizeBoardRoom(row.room) ? mapBoardPostRow(row, authContext) : null;
}

function mapConsultationRow(row, includeAuthor = false) {
  const item = {
    id: row.id,
    room: normalizeCounselRoom(row.room) || "student",
    title: row.title || "",
    body: row.body || "",
    status: normalizeConsultationStatus(row.status || "open"),
    adminReply: row.admin_reply || "",
    adminRepliedAt: row.admin_replied_at || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    author: {
      anonymousName: row.anonymous_name || ""
    }
  };

  if (includeAuthor) {
    item.author = {
      uid: row.author_uid || "",
      email: row.author_email || "",
      name: row.author_name || "",
      anonymousName: row.anonymous_name || ""
    };
  }

  return item;
}

function mapBoardPostRow(row, authContext = null) {
  const room = normalizeBoardRoom(row.room) || "qna";
  const canViewPrivate = canViewBoardPrivate(row, authContext);
  const item = {
    id: row.id,
    room,
    title: row.title || "",
    status: normalizeConsultationStatus(row.status || "open"),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    canViewBody: canViewPrivate,
    author: {
      anonymousName: row.anonymous_name || getBoardRoomDefaultAuthor(room)
    }
  };

  if (canViewPrivate) {
    item.body = row.body || "";
    item.adminReply = row.admin_reply || "";
    item.adminRepliedAt = row.admin_replied_at || "";
  }

  if (hasAdminAccess(authContext?.member)) {
    item.author = {
      uid: row.author_uid || "",
      email: row.author_email || "",
      name: row.author_name || "",
      anonymousName: row.anonymous_name || getBoardRoomDefaultAuthor(room)
    };
  }

  return item;
}

function canViewBoardPrivate(row, authContext = null) {
  if (normalizeBoardRoom(row.room) === "promotion") {
    return true;
  }
  if (!authContext || authContext.error) {
    return false;
  }
  if (hasAdminAccess(authContext.member)) {
    return true;
  }
  return Boolean(authContext.user?.uid && authContext.user.uid === row.author_uid);
}

function normalizeCounselRoom(value) {
  const room = cleanText(value);
  return COUNSEL_ROOMS.has(room) ? room : "";
}

function normalizeBoardRoom(value) {
  const room = cleanText(value);
  return BOARD_ROOMS.has(room) ? room : "";
}

function getBoardRoomDefaultAuthor(room) {
  if (room === "promotion") return "설탕과소금";
  if (room === "collaboration") return "협업 문의";
  return "질문 작성자";
}

function normalizeConsultationStatus(value) {
  const status = cleanText(value);
  return CONSULTATION_STATUSES.has(status) ? status : "answered";
}

async function listMembers(env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다. D1 데이터베이스를 만든 뒤 MEMBER_DB 바인딩을 추가해야 합니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503,
      members: []
    };
  }

  const result = await env.MEMBER_DB.prepare(`
    SELECT uid, email, display_name, school_name, phone, requested_role, role, status,
           note, created_at, updated_at, approved_at, approved_by, last_login_at
    FROM members
    WHERE status != 'deleted'
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      updated_at DESC
    LIMIT 200
  `).all();

  return {
    ok: true,
    members: (result.results || []).map(mapMemberRow).map(sanitizeMember)
  };
}

async function updateMemberByAdmin(adminContext, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  const uid = cleanText(body.uid || "");
  if (!uid) {
    return { error: "대상 회원 uid가 필요합니다.", code: "UID_REQUIRED", status: 400 };
  }

  const target = await getMemberByUid(uid, env);
  if (!target) {
    return { error: "대상 회원을 찾지 못했습니다.", code: "MEMBER_NOT_FOUND", status: 404 };
  }

  const nextRole = normalizeRole(body.role || target.role, target.role);
  const nextStatus = normalizeStatus(body.status || target.status, target.status);
  const note = cleanText(body.note ?? target.note ?? "");

  if (OWNER_ROLES.has(target.role) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자 권한은 총괄관리자만 변경할 수 있습니다.",
      code: "OWNER_PROTECTED",
      status: 403
    };
  }

  if (OWNER_ROLES.has(nextRole) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자 권한 부여는 총괄관리자만 할 수 있습니다.",
      code: "OWNER_GRANT_REQUIRED",
      status: 403
    };
  }

  const now = new Date().toISOString();
  const approvedAt = nextStatus === "approved" && target.status !== "approved"
    ? now
    : target.approvedAt || null;
  const approvedBy = nextStatus === "approved" && target.status !== "approved"
    ? adminContext.user.uid
    : target.approvedBy || null;

  await env.MEMBER_DB.prepare(`
    UPDATE members
    SET role = ?, status = ?, note = ?, updated_at = ?, approved_at = ?, approved_by = ?
    WHERE uid = ?
  `).bind(nextRole, nextStatus, note, now, approvedAt, approvedBy, uid).run();

  await writeAuditLog(env, {
    actorUid: adminContext.user.uid,
    targetUid: uid,
    action: "admin.member.update",
    detail: JSON.stringify({ role: nextRole, status: nextStatus })
  });

  return {
    ok: true,
    member: sanitizeMember(await getMemberByUid(uid, env))
  };
}

async function softDeleteMember(adminContext, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  const uid = cleanText(body.uid || "");
  if (!uid) {
    return { error: "대상 회원 uid가 필요합니다.", code: "UID_REQUIRED", status: 400 };
  }

  const target = await getMemberByUid(uid, env);
  if (!target) {
    return { error: "대상 회원을 찾지 못했습니다.", code: "MEMBER_NOT_FOUND", status: 404 };
  }

  if (OWNER_ROLES.has(target.role) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자는 일반 관리자가 삭제할 수 없습니다.",
      code: "OWNER_PROTECTED",
      status: 403
    };
  }

  const now = new Date().toISOString();
  await env.MEMBER_DB.prepare(`
    UPDATE members
    SET status = 'deleted', updated_at = ?, note = ?
    WHERE uid = ?
  `).bind(now, cleanText(body.note || "관리자 삭제 처리"), uid).run();

  await writeAuditLog(env, {
    actorUid: adminContext.user.uid,
    targetUid: uid,
    action: "admin.member.delete",
    detail: cleanText(body.note || "")
  });

  return { ok: true, uid };
}

async function approveKakaoMemberByAdmin(adminContext, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  const accessCode = normalizeKakaoAccessCode(body.accessCode || body.kakaoCode || "");
  if (!accessCode) {
    return {
      error: "카카오톡 챗봇에서 받은 KAKAO-XXXXXXXX 식별번호를 입력해 주세요.",
      code: "KAKAO_ACCESS_CODE_REQUIRED",
      status: 400
    };
  }

  const role = normalizeRole(body.role || "admin", "admin");
  if (!LAW_ACCESS_ROLES.has(role) && !OWNER_ROLES.has(role)) {
    return {
      error: "카카오 챗봇 이용권한은 관리자 또는 총괄관리자 권한으로만 승인할 수 있습니다.",
      code: "LAW_ROLE_REQUIRED",
      status: 400
    };
  }

  if (OWNER_ROLES.has(role) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자 권한 부여는 총괄관리자만 할 수 있습니다.",
      code: "OWNER_GRANT_REQUIRED",
      status: 403
    };
  }

  const likeCode = `%${accessCode}%`;
  const row = await env.MEMBER_DB.prepare(`
    SELECT uid, email, display_name, school_name, phone, requested_role, role, status,
           note, created_at, updated_at, approved_at, approved_by, last_login_at
    FROM members
    WHERE status != 'deleted'
      AND (
        UPPER(note) LIKE ?
        OR UPPER(display_name) LIKE ?
        OR UPPER(email) LIKE ?
      )
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(likeCode, likeCode, likeCode).first();

  if (!row) {
    return {
      error: "해당 식별번호의 카카오 챗봇 이용 신청을 찾지 못했습니다. 사용자가 챗봇에서 승인 요청 버튼을 한 번 누른 뒤 다시 승인해 주세요.",
      code: "KAKAO_MEMBER_NOT_FOUND",
      status: 404,
      accessCode
    };
  }

  const target = mapMemberRow(row);
  if (OWNER_ROLES.has(target.role) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자 권한은 총괄관리자만 변경할 수 있습니다.",
      code: "OWNER_PROTECTED",
      status: 403
    };
  }

  const now = new Date().toISOString();
  const note = mergeAdminNote(target.note, cleanText(body.note || `카카오 챗봇 승인: ${accessCode}`));

  await env.MEMBER_DB.prepare(`
    UPDATE members
    SET role = ?,
        status = 'approved',
        note = ?,
        updated_at = ?,
        approved_at = COALESCE(approved_at, ?),
        approved_by = COALESCE(approved_by, ?)
    WHERE uid = ?
  `).bind(role, note, now, now, adminContext.user.uid, target.uid).run();

  await writeAuditLog(env, {
    actorUid: adminContext.user.uid,
    targetUid: target.uid,
    action: "admin.member.kakao_approve",
    detail: JSON.stringify({ accessCode, role })
  });

  return {
    ok: true,
    accessCode,
    member: sanitizeMember(await getMemberByUid(target.uid, env))
  };
}

async function createMemberInvitation(adminContext, body = {}, env) {
  if (!env.MEMBER_DB) {
    return {
      error: "회원 DB가 아직 연결되지 않았습니다.",
      code: "MEMBER_DB_NOT_CONFIGURED",
      status: 503
    };
  }

  const email = cleanText(body.email || "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "초대할 이메일 주소를 정확히 입력해 주세요.", code: "EMAIL_REQUIRED", status: 400 };
  }

  const role = normalizeRole(body.role || "general", "general");
  if (OWNER_ROLES.has(role) && !OWNER_ROLES.has(adminContext.member.role)) {
    return {
      error: "총괄관리자 사전 승인 권한은 총괄관리자만 부여할 수 있습니다.",
      code: "OWNER_GRANT_REQUIRED",
      status: 403
    };
  }

  const status = normalizeStatus(body.status || "approved", "approved");
  const note = cleanText(body.note || "");
  const now = new Date().toISOString();

  await env.MEMBER_DB.prepare(`
    INSERT INTO member_invitations (email, role, status, note, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      role = excluded.role,
      status = excluded.status,
      note = excluded.note,
      created_at = excluded.created_at,
      created_by = excluded.created_by
  `).bind(email, role, status, note, now, adminContext.user.uid).run();

  await writeAuditLog(env, {
    actorUid: adminContext.user.uid,
    targetUid: email,
    action: "admin.member.invite",
    detail: JSON.stringify({ role, status })
  });

  return {
    ok: true,
    invitation: { email, role, status, note, createdAt: now }
  };
}

function normalizeKakaoAccessCode(value = "") {
  const code = cleanText(value).toUpperCase().replace(/\s+/g, "");
  const match = code.match(/KAKAO-[A-F0-9]{8,10}/);
  return match ? match[0] : "";
}

function mergeAdminNote(current = "", addition = "") {
  const base = cleanText(current);
  const next = cleanText(addition);
  if (!next) return base;
  if (!base) return next;
  if (base.includes(next)) return base;
  return `${base} / ${next}`;
}

async function getMemberForUser(user, env) {
  if (!user?.uid) {
    return null;
  }

  if (!env.MEMBER_DB) {
    return buildVirtualMember(user, env);
  }

  const member = await getMemberByUid(user.uid, env);
  if (member) {
    await env.MEMBER_DB.prepare("UPDATE members SET last_login_at = ?, updated_at = ? WHERE uid = ?")
      .bind(new Date().toISOString(), new Date().toISOString(), user.uid)
      .run()
      .catch(() => null);
    return member;
  }

  const emailMatchedMember = user.emailVerified ? await getMemberByEmail(user.email, env) : null;
  if (emailMatchedMember) {
    await env.MEMBER_DB.prepare("UPDATE members SET last_login_at = ?, updated_at = ? WHERE uid = ?")
      .bind(new Date().toISOString(), new Date().toISOString(), emailMatchedMember.uid)
      .run()
      .catch(() => null);
    return emailMatchedMember;
  }

  const virtual = buildVirtualMember(user, env);
  if (virtual.role === "owner") {
    await registerMember(user, { requestedRole: "owner", displayName: user.name }, env);
    return getMemberByUid(user.uid, env);
  }

  return {
    ...virtual,
    role: "pending",
    status: "pending",
    requestedRole: "general"
  };
}

async function getInvitationForEmail(email, env) {
  if (!env.MEMBER_DB || !email) {
    return null;
  }

  const row = await env.MEMBER_DB.prepare(`
    SELECT email, role, status, note, created_at, created_by, accepted_uid, accepted_at
    FROM member_invitations
    WHERE email = ?
  `).bind(cleanText(email).toLowerCase()).first().catch(() => null);

  if (!row || row.accepted_uid) {
    return null;
  }

  return {
    email: row.email,
    role: normalizeRole(row.role, "general"),
    status: normalizeStatus(row.status, "approved"),
    note: row.note || "",
    createdAt: row.created_at || "",
    createdBy: row.created_by || ""
  };
}

async function getMemberByUid(uid, env) {
  if (!env.MEMBER_DB) {
    return null;
  }

  const row = await env.MEMBER_DB.prepare(`
    SELECT uid, email, display_name, school_name, phone, requested_role, role, status,
           note, created_at, updated_at, approved_at, approved_by, last_login_at
    FROM members
    WHERE uid = ?
  `).bind(uid).first();

  return row ? mapMemberRow(row) : null;
}

async function getMemberByEmail(email, env) {
  const normalizedEmail = cleanText(email || "").toLowerCase();
  if (!env.MEMBER_DB || !normalizedEmail) {
    return null;
  }

  const row = await env.MEMBER_DB.prepare(`
    SELECT uid, email, display_name, school_name, phone, requested_role, role, status,
           note, created_at, updated_at, approved_at, approved_by, last_login_at
    FROM members
    WHERE email = ? AND status != 'deleted'
  `).bind(normalizedEmail).first();

  return row ? mapMemberRow(row) : null;
}

function buildVirtualMember(user, env) {
  const ownerEmails = parseEmailList(env.OWNER_EMAILS);
  parseEmailList(env.ADDITIONAL_OWNER_EMAILS).forEach((email) => ownerEmails.add(email));
  const adminEmails = parseEmailList(env.ADMIN_EMAILS);
  const email = cleanText(user.email || "").toLowerCase();
  const now = new Date().toISOString();

  if (ownerEmails.has(email)) {
    return {
      uid: user.uid,
      email,
      displayName: user.name || "",
      schoolName: "",
      phone: "",
      requestedRole: "owner",
      role: "owner",
      status: "approved",
      note: "총괄관리자 이메일 환경값으로 자동 승인",
      createdAt: now,
      updatedAt: now,
      approvedAt: now,
      approvedBy: "system",
      lastLoginAt: now
    };
  }

  if (adminEmails.has(email)) {
    return {
      uid: user.uid,
      email,
      displayName: user.name || "",
      schoolName: "",
      phone: "",
      requestedRole: "admin",
      role: "admin",
      status: "approved",
      note: "ADMIN_EMAILS 환경값으로 자동 관리자 처리",
      createdAt: now,
      updatedAt: now,
      approvedAt: now,
      approvedBy: "system",
      lastLoginAt: now
    };
  }

  return {
    uid: user.uid,
    email,
    displayName: user.name || "",
    schoolName: "",
    phone: "",
    requestedRole: "general",
    role: isAuthRequired(env) ? "pending" : "law",
    status: isAuthRequired(env) ? "pending" : "approved",
    note: env.MEMBER_DB ? "" : "회원 DB 미연결 임시 프로필",
    createdAt: now,
    updatedAt: now,
    approvedAt: isAuthRequired(env) ? "" : now,
    approvedBy: isAuthRequired(env) ? "" : "system",
    lastLoginAt: now
  };
}

function mapMemberRow(row) {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name || "",
    schoolName: row.school_name || "",
    phone: row.phone || "",
    requestedRole: row.requested_role || "general",
    role: row.role || "pending",
    status: row.status || "pending",
    note: row.note || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    approvedAt: row.approved_at || "",
    approvedBy: row.approved_by || "",
    lastLoginAt: row.last_login_at || ""
  };
}

function sanitizeMember(member) {
  if (!member) {
    return null;
  }

  return {
    uid: member.uid,
    email: member.email,
    displayName: member.displayName,
    schoolName: member.schoolName,
    phone: member.phone,
    requestedRole: member.requestedRole,
    role: member.role,
    status: member.status,
    note: member.note,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    approvedAt: member.approvedAt,
    lastLoginAt: member.lastLoginAt
  };
}

function getMemberCapabilities(member) {
  const approved = member?.status === "approved";
  return {
    canUsePublic: true,
    canUseJobs: approved && ["jobs", "law", "teacher", "admin", "owner"].includes(member.role),
    canUseLawInfo: approved && LAW_ACCESS_ROLES.has(member.role),
    canUseEbooks: approved && EBOOK_STUDENT_ROLES.has(member.role),
    canUseTeacherEbooks: approved && EBOOK_TEACHER_ROLES.has(member.role),
    canManageMembers: approved && ADMIN_ROLES.has(member.role),
    canGrantOwner: approved && OWNER_ROLES.has(member.role)
  };
}

function hasAdminAccess(member) {
  return member?.status === "approved" && ADMIN_ROLES.has(member.role);
}

async function writeAuditLog(env, item) {
  if (!env.MEMBER_DB) {
    return;
  }

  await env.MEMBER_DB.prepare(`
    INSERT INTO member_audit_logs (actor_uid, target_uid, action, detail, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    item.actorUid || "",
    item.targetUid || "",
    item.action || "",
    item.detail || "",
    new Date().toISOString()
  ).run().catch(() => null);
}

async function verifyFirebaseIdToken(token, env) {
  const trustedProjectIds = getTrustedFirebaseProjectIds(env);
  if (!trustedProjectIds.length) {
    throw new Error("FIREBASE_PROJECT_ID 또는 FIREBASE_TRUSTED_PROJECT_IDS 환경값이 필요합니다.");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("잘못된 로그인 토큰 형식입니다.");
  }

  const header = parseJwtPart(parts[0]);
  const payload = parseJwtPart(parts[1]);

  if (header.alg !== "RS256") {
    throw new Error("지원하지 않는 로그인 토큰 알고리즘입니다.");
  }

  if (!header.kid) {
    throw new Error("로그인 토큰 키 식별자가 없습니다.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) <= now) {
    throw new Error("로그인 세션이 만료되었습니다.");
  }

  if (Number(payload.iat) > now + 60 || Number(payload.auth_time) > now + 60) {
    throw new Error("로그인 토큰 시간이 올바르지 않습니다.");
  }

  const tokenProjectId = cleanText(payload.aud || "");
  if (!trustedProjectIds.includes(tokenProjectId) || payload.iss !== `https://securetoken.google.com/${tokenProjectId}`) {
    throw new Error("로그인 토큰의 Firebase 프로젝트가 일치하지 않습니다.");
  }

  if (!payload.sub || String(payload.sub).length > 128) {
    throw new Error("로그인 토큰의 사용자 식별자가 올바르지 않습니다.");
  }

  const keys = await getFirebaseJwks();
  const jwk = keys[header.kid];
  if (!jwk) {
    throw new Error("로그인 토큰 검증 키를 찾지 못했습니다.");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToBytes(parts[2]);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signingInput);

  if (!verified) {
    throw new Error("로그인 토큰 서명 검증에 실패했습니다.");
  }

  return {
    uid: payload.sub,
    authProjectId: tokenProjectId,
    email: cleanText(payload.email || "").toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: cleanText(payload.name || payload.email || ""),
    picture: cleanText(payload.picture || ""),
    authTime: payload.auth_time,
    claims: payload
  };
}

async function getFirebaseJwks() {
  if (firebaseJwkCache && firebaseJwkCache.expiresAt > Date.now()) {
    return firebaseJwkCache.keys;
  }

  const response = await fetch(FIREBASE_JWKS_URL);
  if (!response.ok) {
    throw new Error(`Firebase 공개키 조회 실패: HTTP ${response.status}`);
  }

  const data = await response.json();
  const keys = Object.fromEntries(
    (Array.isArray(data.keys) ? data.keys : [])
      .filter((key) => key?.kid)
      .map((key) => [key.kid, key])
  );
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  firebaseJwkCache = {
    keys,
    expiresAt: Date.now() + Math.max(300, maxAge - 60) * 1000
  };
  return keys;
}

function parseJwtPart(value) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
  } catch {
    throw new Error("로그인 토큰을 해석하지 못했습니다.");
  }
}

function base64UrlToBytes(value) {
  const base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return base64ToBytes(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function isAuthRequired(env) {
  return /^true$/i.test(String(env.AUTH_REQUIRED || ""));
}

function isKakaoAuthRequired(env = {}) {
  const explicit = cleanText(env.KAKAO_AUTH_REQUIRED || "");
  if (explicit) {
    return /^true$/i.test(explicit);
  }
  return isAuthRequired(env);
}

function getTrustedFirebaseProjectIds(env = {}) {
  return uniqueStrings([
    cleanText(env.FIREBASE_PROJECT_ID || ""),
    ...String(env.FIREBASE_TRUSTED_PROJECT_IDS || "")
      .split(",")
      .map((item) => cleanText(item))
  ]).filter(Boolean);
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))];
}

function hasValidKakaoSkillToken(request, url, env) {
  const expected = cleanText(env.KAKAO_SKILL_TOKEN || "");
  if (!expected) {
    return true;
  }

  const provided = cleanText(
    url.searchParams.get("token") ||
    request.headers.get("x-gyo6-kakao-token") ||
    request.headers.get("x-kakao-skill-token") ||
    ""
  );
  return provided === expected;
}

function normalizeRole(value, fallback = "pending") {
  const role = cleanText(value);
  return MEMBER_ROLES.includes(role) ? role : fallback;
}

function normalizeStatus(value, fallback = "pending") {
  const status = cleanText(value);
  return MEMBER_STATUSES.includes(status) ? status : fallback;
}

function parseEmailList(value) {
  return new Set(String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean));
}

function getResultStatus(result) {
  if (!result?.error) {
    return 200;
  }
  return result.status || (result.fallback ? 502 : 400);
}

function getCorsHeaders(origin, env) {
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "*";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,accept,authorization",
    "vary": "Origin"
  };
}

function sendJson(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders
    }
  });
}

async function readJsonBody(request) {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function extractOpenAiText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  const chunks = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function normalizeOpenAiUsage(usage = {}) {
  const inputTokens = readNumber(usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens);
  const outputTokens = readNumber(usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens);
  const totalTokens = readNumber(usage.total_tokens ?? usage.totalTokens) || inputTokens + outputTokens;
  const cachedInputTokens = readNumber(
    usage.input_tokens_details?.cached_tokens ??
    usage.prompt_tokens_details?.cached_tokens ??
    usage.cached_input_tokens ??
    usage.cachedInputTokens
  );

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens
  };
}

function estimateOpenAiBilling(usage, model, env = {}) {
  const price = getModelPrice(model, env);
  const costControl = getCostControlSettings(env);
  const cachedInputTokens = Math.min(usage.cachedInputTokens || 0, usage.inputTokens || 0);
  const regularInputTokens = Math.max((usage.inputTokens || 0) - cachedInputTokens, 0);
  const inputUsd = regularInputTokens / 1_000_000 * price.inputUsdPer1M;
  const cachedInputUsd = cachedInputTokens / 1_000_000 * price.cachedInputUsdPer1M;
  const outputUsd = (usage.outputTokens || 0) / 1_000_000 * price.outputUsdPer1M;
  const estimatedUsd = inputUsd + cachedInputUsd + outputUsd;

  return {
    model,
    pricingDate: costControl.pricingDate,
    inputUsdPer1M: price.inputUsdPer1M,
    cachedInputUsdPer1M: price.cachedInputUsdPer1M,
    outputUsdPer1M: price.outputUsdPer1M,
    estimatedUsd: roundMoney(estimatedUsd, 6),
    estimatedKrw: Math.max(1, Math.round(estimatedUsd * costControl.krwPerUsd)),
    krwPerUsd: costControl.krwPerUsd,
    note: "OpenAI API 토큰 단가 기준의 추정값입니다. 실제 청구액은 OpenAI 대시보드가 최종 기준입니다."
  };
}

function getModelPrice(model = "", env = {}) {
  const normalizedModel = String(model || "").trim().toLowerCase();
  const defaults = Object.entries(MODEL_PRICE_DEFAULTS)
    .find(([key]) => normalizedModel.includes(key))?.[1] || MODEL_PRICE_DEFAULTS["gpt-5.2"];

  return {
    inputUsdPer1M: readNumber(env.OPENAI_INPUT_PRICE_PER_1M) || defaults.inputUsdPer1M,
    cachedInputUsdPer1M: readNumber(env.OPENAI_CACHED_INPUT_PRICE_PER_1M) || defaults.cachedInputUsdPer1M,
    outputUsdPer1M: readNumber(env.OPENAI_OUTPUT_PRICE_PER_1M) || defaults.outputUsdPer1M
  };
}

function getCostControlSettings(env = {}) {
  return {
    krwPerUsd: readNumber(env.OPENAI_KRW_PER_USD) || DEFAULT_COST_CONTROL.krwPerUsd,
    monthlyWarnUsd: readNumber(env.OPENAI_MONTHLY_WARN_USD) || DEFAULT_COST_CONTROL.monthlyWarnUsd,
    monthlyStopUsd: readNumber(env.OPENAI_MONTHLY_STOP_USD) || DEFAULT_COST_CONTROL.monthlyStopUsd,
    dailyCallLimit: Math.round(readNumber(env.OPENAI_DAILY_CALL_LIMIT) || DEFAULT_COST_CONTROL.dailyCallLimit),
    pricingDate: cleanText(env.OPENAI_COST_PRICING_DATE || DEFAULT_COST_CONTROL.pricingDate)
  };
}

function readNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function roundMoney(value, decimals = 6) {
  return Number((Number(value) || 0).toFixed(decimals));
}

function cleanText(value) {
  return String(value || "").trim();
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined || value === null ? [] : [value];
}

function isRetryableOpenAiError(error) {
  return [400, 404].includes(error.status) || /model|모델|not found|does not exist/i.test(error.message);
}
