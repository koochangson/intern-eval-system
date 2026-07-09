/**
 * Handlers.gs — 활동기록 / 역량평가 / 위험요인 / 전환심의·수습결과 처리
 */

// ---------- 활동기록 (ActivityLogs) ----------

function handleSubmitActivityLog_(user, payload) {
  requireRole_(user, ['intern']);
  const internId = requireField_(payload, 'intern_id');
  if (internId !== user.user_id) throw new Error('FORBIDDEN: 본인 활동기록만 작성할 수 있습니다.');
  const weekNo = requireField_(payload, 'week_no');

  return withWriteLock_(user, 'ActivityLog 작성', internId + '-w' + weekNo, function () {
    const existing = findRowsBy_(SHEETS.ACTIVITY_LOGS, 'intern_id', internId)
      .filter(function (r) { return String(r.week_no) === String(weekNo); })[0];

    const fields = {
      intern_id: internId,
      week_no: weekNo,
      log_date: payload.log_date || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
      tasks: payload.tasks || '',
      learning: payload.learning || '',
      issues: payload.issues || '',
      updated_at: nowIso_()
    };

    if (existing) {
      return updateRowAt_(SHEETS.ACTIVITY_LOGS, existing.__row, fields);
    }
    fields.log_id = generateId_('LOG');
    fields.submitted_at = nowIso_();
    fields.mentor_comment = '';
    fields.mentor_comment_at = '';
    return appendRow_(SHEETS.ACTIVITY_LOGS, fields);
  });
}

function handleMentorComment_(user, payload) {
  requireRole_(user, ['mentor']);
  const logId = requireField_(payload, 'log_id');
  const comment = requireField_(payload, 'comment');

  const row = findRowsBy_(SHEETS.ACTIVITY_LOGS, 'log_id', logId)[0];
  if (!row) throw new Error('NOT_FOUND: 활동기록을 찾을 수 없습니다.');
  const intern = findRowsBy_(SHEETS.INTERNS, 'intern_id', row.intern_id)[0];
  if (!intern || intern.mentor_id !== user.user_id) throw new Error('FORBIDDEN: 담당 인턴의 기록에만 코멘트를 남길 수 있습니다.');

  return withWriteLock_(user, '활동기록 코멘트', logId, function () {
    return updateRowAt_(SHEETS.ACTIVITY_LOGS, row.__row, {
      mentor_comment: comment,
      mentor_comment_at: nowIso_()
    });
  });
}

// ---------- 역량평가 (CompetencyEval) ----------

function handleSubmitCompetencyEval_(user, payload) {
  requireRole_(user, ['mentor']);
  const internId = requireField_(payload, 'intern_id');
  const levels = payload.levels;
  const evidences = payload.evidences || ['', '', '', '', ''];

  const intern = findRowsBy_(SHEETS.INTERNS, 'intern_id', internId)[0];
  if (!intern || intern.mentor_id !== user.user_id) throw new Error('FORBIDDEN: 담당 인턴만 평가할 수 있습니다.');

  // 4점 또는 1점이 있는 영역, 또는 전 영역 3점 이상이면 최저 영역은 근거 필수 (무근거 일괄평가 방지)
  validateEvidenceRule_(levels, evidences);

  const { areaScores, total } = calcCompetencyScores_(levels);

  return withWriteLock_(user, '역량평가 멘토제출', internId, function () {
    const existing = findRowsBy_(SHEETS.COMPETENCY_EVAL, 'intern_id', internId)[0];
    const fields = {
      intern_id: internId,
      area1_score: levels[0], area2_score: levels[1], area3_score: levels[2], area4_score: levels[3], area5_score: levels[4],
      area1_evidence: evidences[0], area2_evidence: evidences[1], area3_evidence: evidences[2], area4_evidence: evidences[3], area5_evidence: evidences[4],
      total_score: total,
      mentor_submitted_at: nowIso_(),
      final_status: '멘토제출',
      updated_at: nowIso_(),
      updated_by: user.email
    };
    if (existing) return updateRowAt_(SHEETS.COMPETENCY_EVAL, existing.__row, fields);
    fields.eval_id = generateId_('EVAL');
    return appendRow_(SHEETS.COMPETENCY_EVAL, fields);
  });
}

function validateEvidenceRule_(levels, evidences) {
  const extremeIdx = [];
  levels.forEach(function (lv, i) { if (Number(lv) === 4 || Number(lv) === 1) extremeIdx.push(i); });
  if (extremeIdx.length > 0) {
    extremeIdx.forEach(function (i) {
      if (!evidences[i] || !String(evidences[i]).trim()) {
        throw new Error('BAD_REQUEST: ' + (i + 1) + '번 영역은 4점/1점이므로 근거 작성이 필수입니다.');
      }
    });
  } else {
    // 전 영역 3점 이상 → 최저 영역(동점이면 첫 번째) 근거 필수
    let minVal = Math.min.apply(null, levels.map(Number));
    let minIdx = levels.findIndex(function (lv) { return Number(lv) === minVal; });
    if (!evidences[minIdx] || !String(evidences[minIdx]).trim()) {
      throw new Error('BAD_REQUEST: 모든 영역이 3점 이상이어도 최저 영역(' + (minIdx + 1) + '번)의 근거를 1건 이상 기재해야 합니다.');
    }
  }
}

function handleConfirmCompetencyEval_(user, payload) {
  requireRole_(user, ['manager']);
  const internId = requireField_(payload, 'intern_id');
  const intern = findRowsBy_(SHEETS.INTERNS, 'intern_id', internId)[0];
  if (!intern || (intern.manager_id !== user.user_id && intern.site !== user.site)) {
    throw new Error('FORBIDDEN: 담당 현장의 인턴만 확정할 수 있습니다.');
  }
  const existing = findRowsBy_(SHEETS.COMPETENCY_EVAL, 'intern_id', internId)[0];
  if (!existing) throw new Error('NOT_FOUND: 멘토가 먼저 1차 평가를 제출해야 합니다.');

  const mentorLevels = [existing.area1_score, existing.area2_score, existing.area3_score, existing.area4_score, existing.area5_score].map(Number);
  const managerLevels = payload.manager_levels ? payload.manager_levels.map(Number) : mentorLevels;

  const maxDiff = Math.max.apply(null, managerLevels.map(function (v, i) { return Math.abs(v - mentorLevels[i]); }));
  if (maxDiff >= 2 && !(payload.adjust_reason && String(payload.adjust_reason).trim())) {
    throw new Error('BAD_REQUEST: 멘토·현장소장 점수가 2단계 이상 차이나므로 조정 사유 기재가 필수입니다.');
  }

  const { areaScores, total } = calcCompetencyScores_(managerLevels);

  return withWriteLock_(user, '역량평가 현장소장확정', internId, function () {
    return updateRowAt_(SHEETS.COMPETENCY_EVAL, existing.__row, {
      manager_area1_score: managerLevels[0], manager_area2_score: managerLevels[1], manager_area3_score: managerLevels[2],
      manager_area4_score: managerLevels[3], manager_area5_score: managerLevels[4],
      manager_total_score: total,
      manager_adjust_reason: payload.adjust_reason || '',
      manager_confirmed_at: nowIso_(),
      final_status: '현장소장확정',
      updated_at: nowIso_(),
      updated_by: user.email
    });
  });
}

// ---------- 위험요인 (RiskChecklist) ----------

function handleSubmitRisk_(user, payload) {
  requireRole_(user, ['mentor', 'manager']);
  const internId = requireField_(payload, 'intern_id');
  const item = requireField_(payload, 'item');
  const level = requireField_(payload, 'level');
  if (RISK_ITEMS.indexOf(item) === -1) throw new Error('BAD_REQUEST: 알 수 없는 위험요인 항목입니다.');
  if (['해당없음', '주의', '중대'].indexOf(level) === -1) throw new Error('BAD_REQUEST: level 값이 올바르지 않습니다.');
  if (level !== '해당없음' && !(payload.evidence && String(payload.evidence).trim())) {
    throw new Error('BAD_REQUEST: 주의·중대 판단 시 구체적 사실 기재가 필수입니다.');
  }
  const intern = findRowsBy_(SHEETS.INTERNS, 'intern_id', internId)[0];
  if (!intern) throw new Error('NOT_FOUND: 인턴 정보를 찾을 수 없습니다.');
  assertCanAccessIntern_(user, intern);

  return withWriteLock_(user, '위험요인 갱신', internId + '-' + item, function () {
    const existing = findRowsBy_(SHEETS.RISK_CHECKLIST, 'intern_id', internId)
      .filter(function (r) { return r.phase === 'ongoing' && r.item === item; })[0];
    const fields = {
      intern_id: internId,
      item: item,
      level: level,
      evidence: payload.evidence || '',
      phase: 'ongoing',
      status: level === '해당없음' ? 'resolved' : 'open',
      reported_by: user.email,
      reported_at: nowIso_()
    };
    if (existing) return updateRowAt_(SHEETS.RISK_CHECKLIST, existing.__row, fields);
    fields.risk_id = generateId_('RISK');
    fields.week_no = payload.week_no || '';
    fields.snapshot_at = '';
    return appendRow_(SHEETS.RISK_CHECKLIST, fields);
  });
}

// ---------- 전환심의 · 수습결과 (Decisions) ----------

function handleSubmitDecision_(user, payload) {
  requireRole_(user, ['hr']);
  const internId = requireField_(payload, 'intern_id');
  const decisionType = requireField_(payload, 'decision_type'); // '전환심의' | '수습종료평가'
  const result = requireField_(payload, 'result');

  const intern = findRowsBy_(SHEETS.INTERNS, 'intern_id', internId)[0];
  if (!intern) throw new Error('NOT_FOUND: 인턴 정보를 찾을 수 없습니다.');

  return withWriteLock_(user, '전환심의/수습결과 확정 (' + decisionType + ')', internId, function () {
    // 1) 현재 ongoing 위험요인을 스냅샷으로 복제 (근거 고정)
    const ongoing = findRowsBy_(SHEETS.RISK_CHECKLIST, 'intern_id', internId)
      .filter(function (r) { return r.phase === 'ongoing'; });
    ongoing.forEach(function (r) {
      appendRow_(SHEETS.RISK_CHECKLIST, {
        risk_id: generateId_('RISKSNAP'),
        intern_id: internId,
        item: r.item,
        level: r.level,
        evidence: r.evidence,
        phase: 'decision_snapshot',
        week_no: payload.week_no || '',
        status: r.status,
        reported_by: r.reported_by,
        reported_at: r.reported_at,
        snapshot_at: nowIso_()
      });
    });

    // 2) 의사결정 기록
    const decision = appendRow_(SHEETS.DECISIONS, {
      decision_id: generateId_('DEC'),
      intern_id: internId,
      decision_type: decisionType,
      result: result,
      decided_by: user.email,
      decided_at: nowIso_(),
      note: payload.note || '',
      created_at: nowIso_()
    });

    // 3) 인턴 상태 갱신
    const statusMap = {
      '전환권고': '정규직(수습)', '조건부전환': '정규직(수습)',
      '전환신중': '전환심의중', '미전환권고': '미전환',
      '정상종료': '수습종료', '보완필요': '수습종료', '집중관리필요': '수습종료', '중대문제발생': '수습종료'
    };
    if (statusMap[result]) {
      updateRowAt_(SHEETS.INTERNS, intern.__row, { status: statusMap[result], updated_at: nowIso_(), updated_by: user.email });
    }

    return decision;
  });
}

/** 전환심의 전, 인사부서가 참고할 자동판정 제안값 조회 (저장하지 않음) */
function handleGetDashboard_(user, payload) {
  const interns = handleListInterns_(user);
  const enriched = interns.map(function (intern) {
    const evalRow = findRowsBy_(SHEETS.COMPETENCY_EVAL, 'intern_id', intern.intern_id)[0];
    const riskRows = findRowsBy_(SHEETS.RISK_CHECKLIST, 'intern_id', intern.intern_id)
      .filter(function (r) { return r.phase === 'ongoing'; });
    const riskSummary = summarizeRisk_(riskRows);
    let suggestion = null;
    const totalForJudge = evalRow ? Number(evalRow.manager_total_score || evalRow.total_score) : null;
    if (totalForJudge !== null && !isNaN(totalForJudge)) {
      suggestion = judgeConversion_(totalForJudge, riskSummary.maxLevel, riskSummary.cautionCount);
    }
    const unconfirmedLogs = findRowsBy_(SHEETS.ACTIVITY_LOGS, 'intern_id', intern.intern_id)
      .filter(function (l) { return !l.mentor_comment; }).length;
    return {
      intern: intern,
      totalScore: totalForJudge,
      riskMaxLevel: riskSummary.maxLevel,
      riskCautionCount: riskSummary.cautionCount,
      suggestion: suggestion,
      unconfirmedLogs: unconfirmedLogs,
      evalStatus: evalRow ? evalRow.final_status : '미시작'
    };
  });
  return { rows: enriched };
}
