import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const authMount = document.querySelector("#authMount");
let config = window.GYO6_FIREBASE_CONFIG || {};
const configUrl = String(window.GYO6_FIREBASE_CONFIG_URL || "").trim();
const authRequired = Boolean(window.GYO6_AUTH_REQUIRED);
const state = {
  configured: false,
  ready: false,
  user: null,
  member: null,
  capabilities: {
    canUsePublic: true,
    canUseJobs: !authRequired,
    canUseLawInfo: !authRequired,
    canManageMembers: false,
    canGrantOwner: false
  },
  message: ""
};

let firebaseAuth = null;

window.GYO6_AUTH = {
  getState: () => ({ ...state }),
  getAccessTokenFor,
  refreshProfile
};

syncAuthBodyState();

if (!authMount) {
  state.ready = true;
} else {
  bootAuth();
}

async function bootAuth() {
  config = await resolveFirebaseConfig(config, configUrl);
  state.configured = hasFirebaseConfig(config);
  state.ready = true;

  if (!state.configured) {
    renderAuth();
    return;
  }

  const app = initializeApp(config);
  firebaseAuth = getAuth(app);
  onAuthStateChanged(firebaseAuth, async (user) => {
    state.user = user;
    state.member = null;
    state.ready = true;

    if (user) {
      await refreshProfile();
    }

    renderAuth();
  });
  renderAuth();
}

async function resolveFirebaseConfig(value, url) {
  if (hasFirebaseConfig(value)) {
    return value;
  }

  if (!url) {
    return value || {};
  }

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return hasFirebaseConfig(data) ? data : value || {};
  } catch (error) {
    state.message = `Firebase 설정을 불러오지 못했습니다. ${error.message}`;
    return value || {};
  }
}

authMount?.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();
  const action = form.dataset.authAction || "";

  try {
    if (action === "login") {
      await signInWithEmailAndPassword(firebaseAuth, getFormValue(form, "email"), getFormValue(form, "password"));
      state.message = "로그인했습니다.";
    }

    if (action === "signup") {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, getFormValue(form, "email"), getFormValue(form, "password"));
      await updateProfile(credential.user, { displayName: getFormValue(form, "displayName") });
      await apiFetch("/api/member/register", {
        method: "POST",
        body: {
          displayName: getFormValue(form, "displayName"),
          schoolName: getFormValue(form, "schoolName"),
          phone: getFormValue(form, "phone"),
          requestedRole: getFormValue(form, "requestedRole"),
          note: getFormValue(form, "note")
        }
      });
      state.message = "가입 신청을 접수했습니다. 승인 후 권한이 열립니다.";
    }

    if (action === "profile") {
      if (getFormValue(form, "displayName") && state.user) {
        await updateProfile(state.user, { displayName: getFormValue(form, "displayName") });
      }

      if (getFormValue(form, "newPassword") && state.user) {
        await updatePassword(state.user, getFormValue(form, "newPassword"));
      }

      await apiFetch("/api/member/me", {
        method: "POST",
        body: {
          displayName: getFormValue(form, "displayName"),
          schoolName: getFormValue(form, "schoolName"),
          phone: getFormValue(form, "phone"),
          requestedRole: getFormValue(form, "requestedRole"),
          note: getFormValue(form, "note")
        }
      });
      state.message = "내 정보를 저장했습니다.";
      await refreshProfile();
    }

    if (action === "invite") {
      await apiFetch("/api/admin/member/invite", {
        method: "POST",
        body: {
          email: getFormValue(form, "email"),
          role: getFormValue(form, "role"),
          status: "approved",
          note: getFormValue(form, "note")
        }
      });
      state.message = "회원 초대/사전 승인을 저장했습니다.";
      form.reset();
    }

    if (action === "kakao-approve") {
      await apiFetch("/api/admin/member/kakao-approve", {
        method: "POST",
        body: {
          accessCode: getFormValue(form, "accessCode"),
          role: "admin",
          note: getFormValue(form, "note")
        }
      });
      state.message = "카카오 챗봇 이용권한을 승인했습니다.";
      form.reset();
    }

    if (action === "member-update") {
      await apiFetch("/api/admin/member", {
        method: "POST",
        body: {
          uid: getFormValue(form, "uid"),
          role: getFormValue(form, "role"),
          status: getFormValue(form, "status"),
          note: getFormValue(form, "note")
        }
      });
      state.message = "회원 권한을 변경했습니다.";
      await renderAdminMembers();
    }
  } catch (error) {
    state.message = formatAuthErrorMessage(error, action);
  }

  renderAuth();
  if (["invite", "kakao-approve", "member-update"].includes(action)) {
    window.setTimeout(() => renderAdminMembers(), 0);
  }
});

authMount?.addEventListener("click", async (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-auth-click]") : null;
  if (!target) {
    return;
  }

  const action = target.dataset.authClick;
  if (action === "close-auth") {
    state.message = "";
    const details = authMount.querySelector(".auth-menu");
    if (details) {
      details.open = false;
    }
    renderAuth();
    return;
  }

  try {
    if (action === "logout") {
      await signOut(firebaseAuth);
      state.message = "로그아웃했습니다.";
    }

    if (action === "reset-password") {
      const email = authMount.querySelector("[data-login-email]")?.value.trim() || state.user?.email || "";
      if (!email) {
        throw new Error("비밀번호 재설정 메일을 받을 이메일을 입력해 주세요.");
      }
      await sendPasswordResetEmail(firebaseAuth, email);
      state.message = "비밀번호 재설정 메일을 보냈습니다.";
    }

    if (action === "admin-refresh") {
      await renderAdminMembers();
      state.message = "회원 목록을 새로 불러왔습니다.";
    }

    if (action === "member-delete") {
      const uid = target.dataset.uid || "";
      if (!uid || !window.confirm("이 회원의 서비스 이용권한을 삭제 처리할까요?")) {
        return;
      }
      await apiFetch("/api/admin/member/delete", {
        method: "POST",
        body: { uid, note: "관리자 삭제 처리" }
      });
      state.message = "회원 이용권한을 삭제 처리했습니다.";
      await renderAdminMembers();
    }
  } catch (error) {
    state.message = formatAuthErrorMessage(error, action);
  }

  renderAuth();
  if (["admin-refresh", "member-delete"].includes(action)) {
    window.setTimeout(() => renderAdminMembers(), 0);
  }
});

async function getAccessTokenFor(feature = "public") {
  if (!authRequired && !state.user) {
    return { ok: true, token: "" };
  }

  if (!state.configured) {
    return {
      ok: !authRequired,
      token: "",
      message: "Firebase 설정이 아직 없어 로그인 권한 확인을 사용할 수 없습니다."
    };
  }

  if (!state.user) {
    return {
      ok: false,
      token: "",
      message: "로그인 후 이용할 수 있습니다."
    };
  }

  await refreshProfile();
  const token = await state.user.getIdToken();
  if (feature === "law" && !state.capabilities.canUseLawInfo) {
    return {
      ok: false,
      token,
      message: getAccessDeniedMessage()
    };
  }

  if (feature === "jobs" && !state.capabilities.canUseJobs) {
    return {
      ok: false,
      token,
      message: "채용정보 이용권한이 없습니다. 관리자에게 권한을 요청하세요."
    };
  }

  return { ok: true, token };
}

async function refreshProfile() {
  if (!state.user) {
    state.member = null;
    return;
  }

  try {
    const data = await apiFetch("/api/member/me");
    state.member = data.member;
    state.capabilities = data.capabilities || state.capabilities;
  } catch (error) {
    state.message = error.message;
  }
}

async function apiFetch(path, options = {}) {
  const baseUrl = getWorkerBaseUrl();
  const token = state.user ? await state.user.getIdToken() : "";
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function syncAuthBodyState() {
  const root = document.body;
  if (!root) {
    return;
  }

  const canUseLawInfo = Boolean(state.capabilities?.canUseLawInfo);
  root.classList.toggle("auth-law-ready", canUseLawInfo);
  root.classList.toggle("auth-law-blocked", !canUseLawInfo);
  root.classList.toggle("auth-signed-in", Boolean(state.user));
  root.classList.toggle("auth-guest", !state.user);
  root.dispatchEvent(new CustomEvent("gyo6-auth-state", {
    bubbles: true,
    detail: {
      canUseLawInfo,
      signedIn: Boolean(state.user),
      ready: Boolean(state.ready)
    }
  }));
}

function renderAuth() {
  syncAuthBodyState();

  if (!authMount) {
    return;
  }

  if (!state.configured) {
    authMount.innerHTML = `
      <details class="auth-menu">
        <summary>로그인</summary>
        <section class="auth-card setup">
          <div class="auth-card-head">
            <div>
              <strong>회원 시스템 준비중</strong>
              <p>Firebase 웹 앱 설정이 로드되면 로그인과 권한관리를 시작할 수 있습니다.</p>
            </div>
            <button type="button" data-auth-click="close-auth" aria-label="로그인 창 닫기">닫기</button>
          </div>
        </section>
      </details>
    `;
    applyRequestedAuthOpen();
    return;
  }

  if (!state.user) {
    authMount.innerHTML = `
      <details class="auth-menu">
        <summary>로그인</summary>
        <section class="auth-card">
          <div class="auth-card-head">
            <div>
              <strong>회원 로그인</strong>
              <p>공개 자료실은 로그인 없이 볼 수 있고, 회원 상담은 승인된 회원이 이용합니다. AI 법률정보 도구는 관리자 답변 작성용으로만 열립니다.</p>
            </div>
            <button type="button" data-auth-click="close-auth" aria-label="로그인 창 닫기">닫기</button>
          </div>
          ${renderAuthMessage()}
          <div class="auth-grid">
            <form data-auth-action="login">
              <h3>로그인</h3>
              <label>이메일<input data-login-email name="email" type="email" autocomplete="email" required></label>
              <label>비밀번호<input name="password" type="password" autocomplete="current-password" required></label>
              <div class="auth-actions">
                <button type="submit">로그인</button>
                <button type="button" data-auth-click="reset-password">비밀번호 재설정</button>
              </div>
            </form>
            <form data-auth-action="signup">
              <h3>신규 회원가입 신청</h3>
              <label>이름<input name="displayName" type="text" autocomplete="name" required></label>
              <label>이메일<input name="email" type="email" autocomplete="email" required></label>
              <label>비밀번호<input name="password" type="password" autocomplete="new-password" minlength="6" required></label>
              <label>소속/학교<input name="schoolName" type="text" placeholder="예: ○○고, 학부모, 교육자료 이용자"></label>
              <label>연락처<input name="phone" type="text" placeholder="선택 입력"></label>
              <label>신청 권한
                <select name="requestedRole">
                  ${renderRoleOptions("general")}
                </select>
              </label>
              <label class="wide">신청 사유<textarea name="note" rows="2" placeholder="예: 특성화고 취업지도 업무에 활용"></textarea></label>
              <div class="auth-actions">
                <button type="submit">가입 신청</button>
              </div>
            </form>
          </div>
        </section>
      </details>
    `;
    applyRequestedAuthOpen();
    return;
  }

  const member = state.member || {};
  const isApproved = member.status === "approved";
  const roleFieldLabel = isApproved ? "승인된 권한" : "신청 권한";
  const roleFieldValue = isApproved ? member.role || "general" : member.requestedRole || "general";
  authMount.innerHTML = `
    <details class="auth-menu">
      <summary>${escapeHtml(state.user.displayName || "회원")}</summary>
      <section class="auth-card">
        <div class="auth-card-head">
          <div>
            <strong>${escapeHtml(state.user.displayName || state.user.email || "회원")}</strong>
            <p>${escapeHtml(formatMemberStatus(member))}</p>
          </div>
          <div class="auth-head-actions">
            <button type="button" data-auth-click="logout">로그아웃</button>
            <button type="button" data-auth-click="close-auth" aria-label="회원 창 닫기">닫기</button>
          </div>
        </div>
        ${renderAuthMessage()}
        ${renderCapabilityBar()}
        <details>
          <summary>내 정보 수정</summary>
          <form data-auth-action="profile" class="auth-profile-form">
            <label>이름<input name="displayName" type="text" value="${escapeHtml(member.displayName || state.user.displayName || "")}"></label>
            <label>소속/학교<input name="schoolName" type="text" value="${escapeHtml(member.schoolName || "")}"></label>
            <label>연락처<input name="phone" type="text" value="${escapeHtml(member.phone || "")}"></label>
            <label>${roleFieldLabel}
              ${isApproved ? `<input type="hidden" name="requestedRole" value="${escapeHtml(member.requestedRole || member.role || "general")}">` : ""}
              <select name="requestedRole" ${isApproved ? "disabled" : ""}>
                ${renderRoleOptions(roleFieldValue)}
              </select>
            </label>
            <label>새 비밀번호<input name="newPassword" type="password" minlength="6" placeholder="변경할 때만 입력"></label>
            <label class="wide">메모<textarea name="note" rows="2">${escapeHtml(member.note || "")}</textarea></label>
            <div class="auth-actions"><button type="submit">저장</button></div>
          </form>
        </details>
        ${state.capabilities.canManageMembers ? renderAdminPanelShell() : ""}
      </section>
    </details>
  `;
  applyRequestedAuthOpen();
}

function applyRequestedAuthOpen() {
  const details = authMount?.querySelector(".auth-menu");
  if (!details) {
    return;
  }

  if (hasLoginOpenIntent() || state.message) {
    details.open = true;
  }

  if (hasLoginOpenIntent() && !state.user) {
    window.setTimeout(() => {
      authMount?.querySelector("[data-login-email]")?.focus({ preventScroll: true });
    }, 0);
  }
}

function hasLoginOpenIntent() {
  try {
    const params = new URLSearchParams(window.location.search);
    const login = String(params.get("login") || params.get("auth") || "").toLowerCase();
    return ["1", "true", "law", "legal", "login"].includes(login)
      || ["#login", "#legalLogin"].includes(window.location.hash);
  } catch {
    return false;
  }
}

function renderAdminPanelShell() {
  return `
    <details class="admin-member-panel">
      <summary>관리자 회원 관리</summary>
      <form data-auth-action="kakao-approve" class="auth-kakao-approve">
        <h3>카카오 챗봇 식별번호 승인</h3>
        <p class="auth-form-note">카카오톡 챗봇이 알려준 KAKAO-XXXXXXXX 번호를 넣으면 관리자 권한으로 승인합니다.</p>
        <label>식별번호<input name="accessCode" type="text" required placeholder="예: KAKAO-85E6EFA9" autocomplete="off"></label>
        <label>관리 메모<input name="note" type="text" placeholder="예: ○○고 취업지도 교사, 파일럿 승인"></label>
        <div class="auth-actions"><button type="submit">카카오 챗봇 승인</button></div>
      </form>
      <form data-auth-action="invite" class="auth-admin-invite">
        <h3>회원 추가/사전 승인</h3>
        <p class="auth-form-note">이메일로 로그인할 사용자를 미리 승인합니다. 카카오 챗봇 식별번호는 위 승인 칸을 사용하세요.</p>
        <label>이메일<input name="email" type="email" required></label>
        <label>부여 권한<select name="role">${renderRoleOptions("general", true)}</select></label>
        <label class="wide">관리 메모<textarea name="note" rows="2" placeholder="예: ○○고 취업지도 교사"></textarea></label>
        <div class="auth-actions"><button type="submit">초대/승인 등록</button></div>
      </form>
      <div class="auth-admin-head">
        <p>회원 승인, 등급 변경, 이용정지, 삭제 처리를 할 수 있습니다.</p>
        <button type="button" data-auth-click="admin-refresh">회원 목록 불러오기</button>
      </div>
      <div id="adminMemberList" class="admin-member-list"></div>
    </details>
  `;
}

async function renderAdminMembers() {
  const mount = document.querySelector("#adminMemberList");
  if (!mount) {
    return;
  }

  try {
    const data = await apiFetch("/api/admin/members");
    const members = data.members || [];
    mount.innerHTML = members.length ? members.map(renderMemberRow).join("") : "<p>표시할 회원이 없습니다.</p>";
  } catch (error) {
    mount.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function renderMemberRow(member) {
  return `
    <form data-auth-action="member-update" class="admin-member-row">
      <input type="hidden" name="uid" value="${escapeHtml(member.uid)}">
      <div>
        <strong>${escapeHtml(member.displayName || member.email)}</strong>
        <p>${escapeHtml(member.email)} · ${escapeHtml(member.schoolName || "소속 미입력")}</p>
      </div>
      <label>권한<select name="role">${renderRoleOptions(member.role, true)}</select></label>
      <label>상태<select name="status">${renderStatusOptions(member.status)}</select></label>
      <label>메모<input name="note" type="text" value="${escapeHtml(member.note || "")}"></label>
      <div class="auth-actions">
        <button type="submit">저장</button>
        <button type="button" data-auth-click="member-delete" data-uid="${escapeHtml(member.uid)}">삭제</button>
      </div>
    </form>
  `;
}

function renderCapabilityBar() {
  const items = [
    ["공개", true],
    ["채용정보", state.capabilities.canUseJobs],
    ["법률정보", state.capabilities.canUseLawInfo],
    ["회원관리", state.capabilities.canManageMembers]
  ];
  return `<div class="capability-bar">${items.map(([label, enabled]) => `<span class="${enabled ? "on" : "off"}">${label}</span>`).join("")}</div>`;
}

function renderRoleOptions(selected, includeAdmin = false) {
  const roles = [
    ["general", "일반 사용자"],
    ["jobs", "채용정보 회원"],
    ["law", "법률정보 회원"],
    ["teacher", "교사/학교 회원"],
    ["admin", "관리자"],
    ["owner", "총괄관리자"]
  ].filter(([value]) => includeAdmin || !["admin", "owner"].includes(value));
  return roles.map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
}

function renderStatusOptions(selected) {
  return [
    ["pending", "승인 대기"],
    ["approved", "승인"],
    ["suspended", "이용 정지"],
    ["deleted", "삭제"]
  ].map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
}

function renderAuthMessage() {
  return state.message ? `<p class="auth-message">${escapeHtml(state.message)}</p>` : "";
}

function formatAuthErrorMessage(error, action = "") {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const text = `${code} ${message}`;
  const operation = getAuthOperationLabel(action);

  if (/configuration-not-found|CONFIGURATION_NOT_FOUND/.test(text)) {
    return `${operation}을 진행하려면 Firebase 콘솔에서 Authentication을 시작하고 Email/Password 로그인 제공자를 사용 설정해야 합니다. 설정 전에는 로그인과 회원가입이 작동하지 않습니다.`;
  }

  if (/operation-not-allowed|OPERATION_NOT_ALLOWED/.test(text)) {
    return `${operation}에 필요한 Email/Password 로그인 제공자가 꺼져 있습니다. Firebase 콘솔의 Authentication > Sign-in method에서 Email/Password를 사용 설정해 주세요.`;
  }

  if (/invalid-credential|INVALID_LOGIN_CREDENTIALS|wrong-password|user-not-found/.test(text)) {
    return "이메일 또는 비밀번호가 맞지 않습니다. 입력값을 확인하거나 비밀번호 재설정을 이용해 주세요.";
  }

  if (/email-already-in-use/.test(text)) {
    return "이미 가입된 이메일입니다. 로그인하거나 비밀번호 재설정을 이용해 주세요.";
  }

  if (/weak-password/.test(text)) {
    return "비밀번호는 6자 이상으로 입력해 주세요.";
  }

  if (/too-many-requests/.test(text)) {
    return "로그인 시도가 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (/network-request-failed/.test(text)) {
    return "네트워크 연결이 불안정해 로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  return message || "처리 중 오류가 발생했습니다.";
}

function getAuthOperationLabel(action = "") {
  if (action === "signup") {
    return "회원가입";
  }
  if (action === "reset-password") {
    return "비밀번호 재설정";
  }
  return "로그인";
}

function getAccessDeniedMessage() {
  const member = state.member;
  if (!member) {
    return "회원 정보를 확인하지 못했습니다.";
  }
  if (member.status !== "approved") {
    return "회원가입 승인 후 법률정보 AI를 이용할 수 있습니다.";
  }
  return "관리자에 의해 법률정보 권한을 승인받아야 합니다.";
}

function formatMemberStatus(member = {}) {
  const role = {
    pending: "승인 대기",
    general: "일반 사용자",
    jobs: "채용정보 회원",
    law: "법률정보 회원",
    teacher: "교사/학교 회원",
    admin: "관리자",
    owner: "총괄관리자"
  }[member.role] || "권한 미지정";
  const status = {
    pending: "승인 대기",
    approved: "승인",
    suspended: "이용 정지",
    deleted: "삭제"
  }[member.status] || "상태 미확인";
  return `${role} · ${status}`;
}

function getWorkerBaseUrl() {
  const base = String(window.GYO6_AI_WORKER_BASE_URL || "").trim();
  return base ? base.replace(/\/+$/, "") : "";
}

function hasFirebaseConfig(value) {
  return Boolean(value?.apiKey && value?.authDomain && value?.projectId);
}

function getFormValue(form, name) {
  const field = form.elements[name];
  return String(field?.value || "").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
