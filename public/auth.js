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
    state.message = error.message || "처리 중 오류가 발생했습니다.";
  }

  renderAuth();
  if (["invite", "member-update"].includes(action)) {
    window.setTimeout(() => renderAdminMembers(), 0);
  }
});

authMount?.addEventListener("click", async (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-auth-click]") : null;
  if (!target) {
    return;
  }

  const action = target.dataset.authClick;
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
    state.message = error.message || "처리 중 오류가 발생했습니다.";
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

function renderAuth() {
  if (!authMount) {
    return;
  }

  if (!state.configured) {
    authMount.innerHTML = `
      <details class="auth-menu">
        <summary>로그인</summary>
        <section class="auth-card setup">
          <div>
            <strong>회원 시스템 준비중</strong>
            <p><code>public/firebase-config.js</code>에 Firebase 웹 앱 설정을 넣으면 로그인과 권한관리를 시작할 수 있습니다.</p>
          </div>
        </section>
      </details>
    `;
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
              <p>승인된 회원은 등급에 따라 법률정보와 채용정보를 이용합니다.</p>
            </div>
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
    return;
  }

  const member = state.member || {};
  authMount.innerHTML = `
    <details class="auth-menu">
      <summary>${escapeHtml(state.user.displayName || "회원")}</summary>
      <section class="auth-card">
        <div class="auth-card-head">
          <div>
            <strong>${escapeHtml(state.user.displayName || state.user.email || "회원")}</strong>
            <p>${escapeHtml(formatMemberStatus(member))}</p>
          </div>
          <button type="button" data-auth-click="logout">로그아웃</button>
        </div>
        ${renderAuthMessage()}
        ${renderCapabilityBar()}
        <details>
          <summary>내 정보 수정</summary>
          <form data-auth-action="profile" class="auth-profile-form">
            <label>이름<input name="displayName" type="text" value="${escapeHtml(member.displayName || state.user.displayName || "")}"></label>
            <label>소속/학교<input name="schoolName" type="text" value="${escapeHtml(member.schoolName || "")}"></label>
            <label>연락처<input name="phone" type="text" value="${escapeHtml(member.phone || "")}"></label>
            <label>신청 권한
              <select name="requestedRole">
                ${renderRoleOptions(member.requestedRole || "general")}
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
}

function renderAdminPanelShell() {
  return `
    <details class="admin-member-panel">
      <summary>관리자 회원 관리</summary>
      <form data-auth-action="invite" class="auth-admin-invite">
        <h3>회원 추가/사전 승인</h3>
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

function getAccessDeniedMessage() {
  const member = state.member;
  if (!member) {
    return "회원 정보를 확인하지 못했습니다.";
  }
  if (member.status !== "approved") {
    return "회원가입 승인 후 법률정보 AI를 이용할 수 있습니다.";
  }
  return "현재 회원 등급에는 법률정보 AI 이용권한이 없습니다.";
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
