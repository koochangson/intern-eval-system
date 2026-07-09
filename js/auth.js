// auth.js — Google Identity Services 기반 로그인 (설계서 v2 2장 B안)
// idToken은 세션스토리지에만 보관합니다(탭을 닫으면 사라짐). 서버가 매 요청마다 이 토큰을 재검증합니다.

const SESSION_KEY = 'intern_eval_session_v1';

function getIdToken() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw).idToken; } catch (e) { return null; }
}

function getCachedUser() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw).user; } catch (e) { return null; }
}

function setSession(idToken, user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ idToken: idToken, user: user }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function logout() {
  clearSession();
  window.location.href = '/index.html';
}

/** index.html 로그인 화면에서 호출: Google 버튼 렌더링 + 콜백 등록 */
function initGoogleSignIn(onSuccess) {
  if (!window.GOOGLE_CLIENT_ID || window.GOOGLE_CLIENT_ID.indexOf('PASTE_') === 0) {
    document.getElementById('loginError').textContent =
      'js/config.js의 GOOGLE_CLIENT_ID가 설정되지 않았습니다. README를 참조하세요.';
    return;
  }
  google.accounts.id.initialize({
    client_id: window.GOOGLE_CLIENT_ID,
    callback: async function (response) {
      const errEl = document.getElementById('loginError');
      errEl.textContent = '';
      try {
        const idToken = response.credential;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ idToken: idToken, user: null }));
        const data = await callApi('whoami', {});
        setSession(idToken, data.user);
        onSuccess(data.user);
      } catch (e) {
        clearSession();
        errEl.textContent = '로그인 실패: ' + e.message;
      }
    }
  });
  google.accounts.id.renderButton(
    document.getElementById('googleSignInBtn'),
    { theme: 'outline', size: 'large', width: 320 }
  );
}

/** 각 대시보드 페이지 상단에서 호출: 세션 없으면 로그인 화면으로 되돌림, role 불일치 시 안내 */
function guardPage(requiredRole) {
  const user = getCachedUser();
  const idToken = getIdToken();
  if (!user || !idToken) {
    window.location.href = '/index.html';
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    alert('이 화면은 ' + requiredRole + ' 권한 전용입니다. 현재 계정 권한: ' + user.role);
    window.location.href = '/index.html';
    return null;
  }
  return user;
}

function renderTopbar(user, titleText) {
  const el = document.getElementById('topbar');
  if (!el) return;
  el.innerHTML =
    '<div class="title">' + titleText + '</div>' +
    '<div style="display:flex;align-items:center;gap:14px;">' +
    '<span class="user">' + user.name + ' (' + user.role + (user.site ? ' · ' + user.site : '') + ')</span>' +
    '<button onclick="logout()">로그아웃</button>' +
    '</div>';
}
