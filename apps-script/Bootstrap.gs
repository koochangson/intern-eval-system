/**
 * Bootstrap.gs
 * 최초 1회만 실행: Apps Script 편집기에서 이 파일을 열고 setupSheets 함수를 선택해 ▶ 실행하세요.
 * 이미 존재하는 탭은 건드리지 않고, 없는 탭만 헤더와 함께 생성합니다. 여러 번 실행해도 안전합니다.
 */

const SCHEMA_ = {
  Interns: [
    'intern_id', 'name', 'site', 'job', 'start_date', 'mentor_id', 'manager_id',
    'status', 'contract_phase', 'created_at', 'created_by', 'updated_at', 'updated_by', 'is_active'
  ],
  ActivityLogs: [
    'log_id', 'intern_id', 'week_no', 'log_date', 'tasks', 'learning', 'issues',
    'mentor_comment', 'mentor_comment_at', 'submitted_at', 'updated_at'
  ],
  CompetencyEval: [
    'eval_id', 'intern_id',
    'area1_score', 'area2_score', 'area3_score', 'area4_score', 'area5_score',
    'area1_evidence', 'area2_evidence', 'area3_evidence', 'area4_evidence', 'area5_evidence',
    'total_score', 'mentor_submitted_at',
    'manager_area1_score', 'manager_area2_score', 'manager_area3_score', 'manager_area4_score', 'manager_area5_score',
    'manager_total_score', 'manager_adjust_reason', 'manager_confirmed_at',
    'final_status', 'updated_at', 'updated_by'
  ],
  RiskChecklist: [
    'risk_id', 'intern_id', 'item', 'level', 'evidence',
    'phase', 'week_no', 'status', 'reported_by', 'reported_at', 'snapshot_at'
  ],
  Decisions: [
    'decision_id', 'intern_id', 'decision_type', 'result', 'decided_by', 'decided_at', 'note', 'created_at'
  ],
  Users: [
    'user_id', 'name', 'role', 'site', 'email', 'is_active', 'created_at'
  ],
  AuditLog: [
    'ts', 'user_id', 'action', 'target_id', 'before_value', 'after_value'
  ]
};

function setupSheets() {
  const ss = getSpreadsheet_();
  Object.keys(SCHEMA_).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      Logger.log('생성됨: ' + name);
    } else {
      Logger.log('이미 존재함(건너뜀): ' + name);
    }
    const headers = SCHEMA_[name];
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const isEmpty = firstRow.join('') === '';
    if (isEmpty) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1E2761').setFontColor('#FFFFFF');
      sheet.autoResizeColumns(1, headers.length);
    }
  });

  // 기본 시트("시트1")가 남아있으면 정리
  const defaultSheet = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  SpreadsheetApp.flush();
  Logger.log('완료. Users 탭에 최소 1명(본인) 이메일과 role=hr을 직접 입력한 뒤 프론트에서 로그인 테스트하세요.');
}
