/**
 * Data.gs
 * Google Sheets를 테이블처럼 다루기 위한 범용 CRUD 헬퍼.
 * 모든 쓰기 작업은 LockService로 직렬화하고 AuditLog에 자동 기록합니다.
 */

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + name + ' — Bootstrap.gs의 setupSheets를 먼저 실행하세요.');
  return sheet;
}

function getHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

/** 시트 전체를 [{컬럼:값, ...}, ...] 배열로 반환 */
function readAllRows_(sheetName) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const headers = getHeaders_(sheet);
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row, idx) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    obj.__row = idx + 2; // 실제 시트 행 번호 (헤더=1행 기준)
    return obj;
  });
}

/** 특정 컬럼 값으로 행을 검색 (여러 건일 수 있음) */
function findRowsBy_(sheetName, column, value) {
  return readAllRows_(sheetName).filter(function (r) {
    return String(r[column]) === String(value);
  });
}

/** obj를 헤더 순서에 맞춰 시트 맨 아래에 추가 */
function appendRow_(sheetName, obj) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  const row = headers.map(function (h) { return (obj[h] !== undefined && obj[h] !== null) ? obj[h] : ''; });
  sheet.appendRow(row);
  return obj;
}

/** __row로 지정된 실제 행을 obj 값으로 갱신 (없는 키는 기존 값 유지) */
function updateRowAt_(sheetName, rowNumber, patch) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  const current = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const next = headers.map(function (h, i) {
    return (patch[h] !== undefined) ? patch[h] : current[i];
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([next]);
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = next[i]; });
  return obj;
}

function generateId_(prefix) {
  const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMddHHmmss');
  const rand = Math.floor(Math.random() * 900 + 100);
  return prefix + '-' + ts + '-' + rand;
}

function nowIso_() {
  return new Date().toISOString();
}

/** 모든 쓰기 작업 공통 진입점: 락을 걸고 fn을 실행한 뒤 AuditLog에 기록 */
function withWriteLock_(user, action, targetId, fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const before = null;
    const result = fn();
    writeAuditLog_(user, action, targetId, before, result);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function writeAuditLog_(user, action, targetId, beforeValue, afterValue) {
  try {
    appendRow_(SHEETS.AUDIT_LOG, {
      ts: nowIso_(),
      user_id: user ? (user.user_id + ' (' + user.email + ')') : 'unknown',
      action: action,
      target_id: targetId || '',
      before_value: beforeValue ? JSON.stringify(beforeValue).slice(0, 500) : '',
      after_value: afterValue ? JSON.stringify(afterValue).slice(0, 500) : ''
    });
  } catch (err) {
    Logger.log('AuditLog 기록 실패: ' + err);
  }
}
