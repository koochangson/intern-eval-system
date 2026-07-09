/**
 * Code.gs — 진입점
 * 프론트(GitHub Pages)는 이 Web App의 배포 URL로 fetch(POST)만 호출합니다.
 * CORS 프리플라이트를 피하기 위해 프론트는 Content-Type: text/plain 으로 JSON 문자열을 보내고,
 * 여기서 JSON.parse로 직접 파싱합니다 (js/api.js 참조).
 */

function doGet() {
  return ContentService.createTextOutput(
    'Intern Eval API is running. Use POST with {action, idToken, payload}.'
  ).setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'BAD_REQUEST: JSON 파싱 실패' });
  }

  try {
    const action = body.action;
    if (action === 'ping') {
      return jsonOut_({ ok: true, data: { pong: true, time: nowIso_() } });
    }

    const user = authenticate_(body); // 실패 시 예외
    const payload = body.payload || {};

    const handlers = {
      whoami: function () { return { user: publicUser_(user) }; },
      listInterns: function () { return { interns: handleListInterns_(user) }; },
      getInternDetail: function () { return handleGetInternDetail_(user, payload); },
      submitActivityLog: function () { return handleSubmitActivityLog_(user, payload); },
      mentorCommentActivityLog: function () { return handleMentorComment_(user, payload); },
      submitCompetencyEval: function () { return handleSubmitCompetencyEval_(user, payload); },
      confirmCompetencyEval: function () { return handleConfirmCompetencyEval_(user, payload); },
      submitRisk: function () { return handleSubmitRisk_(user, payload); },
      submitDecision: function () { return handleSubmitDecision_(user, payload); },
      getDashboard: function () { return handleGetDashboard_(user, payload); }
    };

    if (!handlers[action]) {
      return jsonOut_({ ok: false, error: 'UNKNOWN_ACTION: ' + action });
    }
    const data = handlers[action]();
    return jsonOut_({ ok: true, data: data });
  } catch (err) {
    Logger.log(err);
    return jsonOut_({ ok: false, error: String(err.message || err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function publicUser_(user) {
  return { user_id: user.user_id, name: user.name, role: user.role, site: user.site, email: user.email };
}

// ---------- Interns ----------

function handleListInterns_(user) {
  const all = readAllRows_(SHEETS.INTERNS).filter(function (r) { return String(r.is_active) !== 'false' && String(r.is_active) !== 'FALSE'; });
  if (user.role === 'hr') return all;
  if (user.role === 'manager') return all.filter(function (r) { return r.manager_id === user.user_id || r.site === user.site; });
  if (user.role === 'mentor') return all.filter(function (r) { return r.mentor_id === user.user_id; });
  if (user.role === 'intern') return all.filter(function (r) { return r.intern_id === user.user_id; });
  return [];
}

function handleGetInternDetail_(user, payload) {
  const internId = requireField_(payload, 'intern_id');
  const intern = findRowsBy_(SHEETS.INTERNS, 'intern_id', internId)[0];
  if (!intern) throw new Error('NOT_FOUND: 인턴 정보를 찾을 수 없습니다.');
  assertCanAccessIntern_(user, intern);

  const logs = findRowsBy_(SHEETS.ACTIVITY_LOGS, 'intern_id', internId)
    .sort(function (a, b) { return Number(a.week_no) - Number(b.week_no); });
  const evals = findRowsBy_(SHEETS.COMPETENCY_EVAL, 'intern_id', internId);
  const risks = findRowsBy_(SHEETS.RISK_CHECKLIST, 'intern_id', internId)
    .filter(function (r) { return r.phase === 'ongoing'; });
  const decisions = findRowsBy_(SHEETS.DECISIONS, 'intern_id', internId);

  return { intern: intern, activityLogs: logs, competencyEvals: evals, risks: risks, decisions: decisions };
}

function assertCanAccessIntern_(user, intern) {
  if (user.role === 'hr') return;
  if (user.role === 'manager' && (intern.manager_id === user.user_id || intern.site === user.site)) return;
  if (user.role === 'mentor' && intern.mentor_id === user.user_id) return;
  if (user.role === 'intern' && intern.intern_id === user.user_id) return;
  throw new Error('FORBIDDEN: 해당 인턴 정보에 접근할 수 없습니다.');
}

function requireField_(payload, field) {
  const v = payload[field];
  if (v === undefined || v === null || v === '') throw new Error('BAD_REQUEST: ' + field + ' 값이 필요합니다.');
  return v;
}
