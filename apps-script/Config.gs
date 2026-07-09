/**
 * Config.gs
 * 배포 전 이 파일의 값만 채우면 됩니다. (README 3장 참조)
 */

// 1) Google Sheets 문서 ID (스프레드시트 URL의 /d/ 와 /edit 사이 문자열)
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';

// 2) 인증 방식: 'IDTOKEN' (Google 계정 아무거나 + 화이트리스트, Workspace 불필요·권장)
//              'WORKSPACE' (회사가 Google Workspace 사용 중이고 execute-as-me + getActiveUser 신뢰 가능할 때만)
const AUTH_MODE = 'IDTOKEN';

// 3) IDTOKEN 모드 사용 시 필수: Google Cloud Console에서 발급한 OAuth 2.0 클라이언트 ID
//    (설계서 v2 2장 B안. README 2장에 발급 절차 있음)
const GOOGLE_CLIENT_ID = 'PASTE_YOUR_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com';

// 4) 시트 탭 이름 (Bootstrap.gs가 이 이름으로 자동 생성함 — 바꾸지 않는 것을 권장)
const SHEETS = {
  INTERNS: 'Interns',
  ACTIVITY_LOGS: 'ActivityLogs',
  COMPETENCY_EVAL: 'CompetencyEval',
  RISK_CHECKLIST: 'RiskChecklist',
  DECISIONS: 'Decisions',
  USERS: 'Users',
  AUDIT_LOG: 'AuditLog'
};

function getSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf('PASTE_') === 0) {
    throw new Error('Config.gs의 SPREADSHEET_ID를 먼저 설정하세요.');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}
