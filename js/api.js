// api.js — Apps Script Web App 호출 래퍼
// Content-Type을 text/plain으로 보내 CORS 프리플라이트(OPTIONS)를 피합니다.
// (Apps Script Web App은 OPTIONS 프리플라이트에 응답하지 않아, application/json으로 보내면 브라우저가 요청을 차단합니다.)

async function callApi(action, payload) {
  if (!window.APPS_SCRIPT_URL || window.APPS_SCRIPT_URL.indexOf('PASTE_') === 0) {
    throw new Error('js/config.js의 APPS_SCRIPT_URL이 설정되지 않았습니다.');
  }
  const idToken = getIdToken();
  if (action !== 'ping' && !idToken) {
    throw new Error('로그인이 필요합니다.');
  }

  const res = await fetch(window.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, idToken: idToken, payload: payload || {} })
  });

  if (!res.ok) {
    throw new Error('네트워크 오류: HTTP ' + res.status);
  }
  const json = await res.json();
  if (!json.ok) {
    if (String(json.error || '').indexOf('AUTH_') === 0) {
      clearSession();
    }
    throw new Error(json.error || '알 수 없는 오류가 발생했습니다.');
  }
  return json.data;
}
