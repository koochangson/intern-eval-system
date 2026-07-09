/**
 * Auth.gs
 * 설계서 v2 2장: 검증된 이메일(Google 로그인)을 받아 Users 시트 화이트리스트와 대조합니다.
 * "사용자가 화면에 입력한 이메일을 그대로 신뢰"하는 방식은 절대 쓰지 않습니다 — 반드시
 * (a) IDTOKEN 모드: 프론트의 Google Sign-In에서 발급된 idToken을 서버가 직접 검증하거나
 * (b) WORKSPACE 모드: Session.getActiveUser() 로 서버가 직접 확인한 이메일만 사용합니다.
 */

/**
 * 요청에서 인증된 사용자를 식별하고 Users 시트에서 role/site를 붙여 반환합니다.
 * 화이트리스트에 없거나 비활성(is_active=false)이면 예외를 던집니다.
 * @param {Object} body doPost로 들어온 파싱된 요청 바디
 * @return {{email:string, user_id:string, name:string, role:string, site:string}}
 */
function authenticate_(body) {
  const email = resolveVerifiedEmail_(body);
  if (!email) {
    throw new Error('AUTH_FAILED: 로그인 정보가 없거나 검증에 실패했습니다.');
  }
  const user = findUserByEmail_(email);
  if (!user) {
    throw new Error('AUTH_DENIED: 등록되지 않은 계정입니다 (' + email + '). 인사부서에 Users 시트 등록을 요청하세요.');
  }
  if (String(user.is_active).toUpperCase() === 'FALSE') {
    throw new Error('AUTH_DENIED: 비활성화된 계정입니다 (' + email + ').');
  }
  return user;
}

/** 설정된 AUTH_MODE에 따라 검증된 이메일 문자열을 반환. 실패 시 null. */
function resolveVerifiedEmail_(body) {
  if (AUTH_MODE === 'WORKSPACE') {
    const email = Session.getActiveUser().getEmail();
    return email || null;
  }
  // IDTOKEN 모드 (기본, 권장)
  const idToken = body && body.idToken;
  if (!idToken) return null;
  return verifyGoogleIdToken_(idToken);
}

/**
 * Google이 발급한 ID 토큰(JWT)을 Google tokeninfo 엔드포인트로 검증합니다.
 * aud(클라이언트ID 일치), email_verified, 만료시각을 확인합니다.
 */
function verifyGoogleIdToken_(idToken) {
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    Logger.log('tokeninfo 검증 실패: ' + resp.getContentText());
    return null;
  }
  const payload = JSON.parse(resp.getContentText());

  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.indexOf('PASTE_') === 0) {
    throw new Error('Config.gs의 GOOGLE_CLIENT_ID를 먼저 설정하세요.');
  }
  if (payload.aud !== GOOGLE_CLIENT_ID) {
    Logger.log('aud 불일치: ' + payload.aud);
    return null;
  }
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) < now) {
    return null; // 만료된 토큰
  }
  return payload.email;
}

/** Users 시트에서 이메일로 사용자 1건 조회 (없으면 null) */
function findUserByEmail_(email) {
  const rows = readAllRows_(SHEETS.USERS);
  const target = String(email).trim().toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].email).trim().toLowerCase() === target) {
      return rows[i];
    }
  }
  return null;
}

/** action이 role 목록에 포함되는지 확인, 아니면 예외 */
function requireRole_(user, allowedRoles) {
  if (allowedRoles.indexOf(user.role) === -1) {
    throw new Error('FORBIDDEN: ' + user.role + ' 권한으로는 이 작업을 할 수 없습니다.');
  }
}
