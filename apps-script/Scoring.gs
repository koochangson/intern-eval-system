/**
 * Scoring.gs
 * 채점·판정 로직은 반드시 서버(Apps Script)에서만 계산합니다.
 * 프론트에서 계산하면 브라우저 개발자도구로 점수를 조작할 수 있기 때문입니다 (설계서 v2 4장).
 */

const AREA_POINTS = [20, 25, 20, 25, 10]; // 기본근무태도/학습태도/현장적응/업무수행/성장가능성
const SCORE_RATIO = { 4: 1.00, 3: 0.85, 2: 0.60, 1: 0.30 };
const RISK_ITEMS = [
  '근태 문제', '지시사항 불이행', '허위보고', '피드백 후 미개선',
  '협업상 우려', '직무 관심 부족', '책임감 부족'
];

/** 체크된 단계 배열([4,3,2,1,3] 등 5개)을 받아 영역별 환산점수와 합계를 계산 */
function calcCompetencyScores_(levels) {
  if (!Array.isArray(levels) || levels.length !== 5) {
    throw new Error('역량평가 5개 영역 점수가 모두 필요합니다.');
  }
  const areaScores = levels.map(function (level, i) {
    const ratio = SCORE_RATIO[Number(level)];
    if (ratio === undefined) throw new Error('유효하지 않은 평가 단계입니다: ' + level);
    return Math.round(AREA_POINTS[i] * ratio);
  });
  const total = areaScores.reduce(function (a, b) { return a + b; }, 0);
  return { areaScores: areaScores, total: total };
}

/**
 * 합계점수 + 위험요인 최고단계로 전환기준 자동판정
 * @param {number} totalScore
 * @param {string} maxRiskLevel '해당없음' | '주의' | '중대'
 * @param {number} riskCautionCount '주의' 단계 항목 개수
 */
function judgeConversion_(totalScore, maxRiskLevel, riskCautionCount) {
  if (maxRiskLevel === '중대') {
    return { result: '미전환권고', reason: '중대 위험요인 있음' };
  }
  if (totalScore < 60) {
    return { result: '미전환권고', reason: '합계 60점 미만' };
  }
  if (totalScore < 70) {
    return { result: '전환신중', reason: '합계 60~70점 미만' };
  }
  if (riskCautionCount >= 2) {
    return { result: '전환신중', reason: '주의 위험요인 2건 이상' };
  }
  if (totalScore < 80) {
    return { result: '조건부전환', reason: '합계 70~80점 미만' };
  }
  if (riskCautionCount >= 1) {
    return { result: '조건부전환', reason: '주의 위험요인 1건' };
  }
  return { result: '전환권고', reason: '80점 이상 + 중대 위험요인 없음' };
}

/** RiskChecklist 스냅샷(해당 시점 최신 상태) 중 최고 단계와 '주의' 건수를 요약 */
function summarizeRisk_(riskRows) {
  const order = { '해당없음': 0, '주의': 1, '중대': 2 };
  let maxLevel = '해당없음';
  let cautionCount = 0;
  riskRows.forEach(function (r) {
    if ((order[r.level] || 0) > (order[maxLevel] || 0)) maxLevel = r.level;
    if (r.level === '주의') cautionCount++;
  });
  return { maxLevel: maxLevel, cautionCount: cautionCount };
}
