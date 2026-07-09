# 채용연계형 인턴 평가시스템 (Apps Script + Google Sheets + GitHub Pages) ff

설계서: `인턴평가시스템 웹 구현 설계서(v2).md` 기준 구현. 인증은 Google Sign-In(ID 토큰 서버 검증) 방식(IDTOKEN 모드)이 기본값이며, Workspace 도메인 환경이면 `AUTH_MODE`를 `WORKSPACE`로 바꿔 `Session.getActiveUser()` 방식으로 전환 가능하다.

## 배포 전 반드시 확인할 것 (요약)

1. GitHub Pages는 **Private 저장소여도 사이트 자체는 공개 URL**로 접근 가능하다(Enterprise Cloud 제외). 실제 접근 통제는 프런트엔드가 아니라 Apps Script 백엔드의 ID 토큰 검증 + Users 시트 화이트리스트가 담당한다. 프런트엔드 코드/화면에 민감정보를 넣지 말 것.
2. Users 시트에 등록되지 않은 이메일은 Google 로그인에 성공해도 시스템 접근이 거부된다(`AUTH_DENIED`). 최초 HR 계정은 시트에 수동으로 넣어야 한다.
3. `Config.gs`, `js/config.js`의 placeholder 값(스프레드시트 ID, OAuth 클라이언트 ID, Apps Script 배포 URL)을 채우지 않으면 동작하지 않는다.

## 배포 절차

### 1) Google Sheet 생성
- 새 Google Sheet를 만들고 URL의 스프레드시트 ID를 복사해 둔다.

### 2) Apps Script 프로젝트 구성
- 해당 Sheet에서 확장 프로그램 → Apps Script.
- `apps-script/` 폴더의 8개 파일(appsscript.json 포함)을 그대로 붙여넣는다. 파일명·확장자를 동일하게 맞춘다.
- `Config.gs`에서 `SPREADSHEET_ID`를 1)에서 복사한 값으로 교체한다.
- Apps Script 편집기에서 `setupSheets` 함수를 선택해 한 번 실행한다(권한 승인 필요). 7개 탭(Interns, ActivityLogs, CompetencyEval, RiskChecklist, Decisions, Users, AuditLog)과 헤더가 자동 생성된다. 이미 존재하는 시트는 건드리지 않으므로 재실행해도 안전하다.
- `Users` 시트에 최초 HR 계정 최소 1행을 수동으로 입력한다(email, name, role=hr, 관련 시트 스키마는 Bootstrap.gs의 `SCHEMA_.USERS` 참조). 이 계정이 없으면 아무도 로그인할 수 없다.

### 3) Google Cloud OAuth 클라이언트 ID 발급 (IDTOKEN 모드 사용 시)
- Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션) 생성.
- 승인된 자바스크립트 원본에 실제 GitHub Pages URL(예: `https://<계정>.github.io`)을 등록한다. 로컬 테스트 시 `http://localhost:포트`도 추가.
- 발급된 클라이언트 ID를 `apps-script/Config.gs`의 `GOOGLE_CLIENT_ID`와 `js/config.js`의 `GOOGLE_CLIENT_ID`에 동일하게 넣는다.

### 4) Apps Script 웹 앱 배포
- 배포 → 새 배포 → 유형: 웹 앱.
- 실행 계정: 나(me) / 액세스 권한: 모든 사용자(익명 포함). (실제 인증은 코드 내부 ID 토큰 검증이 담당하므로 Apps Script 자체 접근 게이트는 열어둔다.)
- 배포 후 발급되는 `/exec` URL을 `js/config.js`의 `APPS_SCRIPT_URL`에 넣는다.
- 코드(`.gs`)를 수정할 때마다 새 버전으로 재배포해야 반영된다.

### 5) GitHub Pages 배포
- 이 폴더 전체를 GitHub 저장소(Private 권장)에 push.
- Settings → Pages에서 배포 브랜치/폴더 지정 후 활성화.
- **주의**: Private 저장소라도 Pages 사이트 URL은 공개적으로 접근 가능하다(위 요약 1번 참조). 링크가 외부로 새어나가도 로그인 실패로 막히도록 설계되어 있으나, URL 자체를 비밀로 취급하지 않는다.

### 6) 접속 및 사용자 등록 운영
- 배포된 Pages URL로 접속 → Google 로그인 → Users 시트 등록 여부로 접근 통제.
- 신규 인턴/멘토/현장소장 투입 시 HR이 Users 시트에 행을 추가하는 것이 유일한 온보딩 절차다(코드 수정 불필요).

## 폴더 구조

```
intern-eval-system/
├── apps-script/         # Google Apps Script 백엔드 (Sheets를 DB로 사용)
│   ├── appsscript.json
│   ├── Config.gs        # 스프레드시트 ID, 인증모드, 시트명 상수
│   ├── Bootstrap.gs     # setupSheets() — 시트/헤더 초기화
│   ├── Auth.gs          # ID 토큰 검증 / Workspace 인증 / 사용자 조회
│   ├── Data.gs          # 공통 CRUD, 락, 감사로그
│   ├── Scoring.gs       # 역량점수·전환기준 매트릭스 로직
│   ├── Code.gs          # doGet/doPost 라우팅
│   └── Handlers.gs      # 액션별 비즈니스 로직
├── css/style.css
├── js/
│   ├── config.js        # 배포 후 채워야 하는 URL/클라이언트ID
│   ├── api.js           # callApi() — CORS 우회 포함 fetch 래퍼
│   └── auth.js           # 세션 저장, Google Sign-In 초기화, 역할별 라우팅
├── index.html            # 로그인
└── pages/
    ├── activity-log.html # 인턴용 — 주간 활동기록
    ├── mentor.html        # 멘토용 — 코멘트/1차 역량평가/위험요인
    ├── manager.html        # 현장소장용 — 역량평가 확정/위험요인 최종확인
    └── hr.html             # 인사부서용 — 대시보드/전환심의·수습결과 확정
```

## 구현된 핵심 비즈니스 로직 (설계서 대비 매핑)

| 규칙 | 구현 위치 |
|---|---|
| 역량평가 5영역 배점(20/25/20/25/10), 4단계 척도별 환산율(1.00/0.85/0.60/0.30) | `Scoring.gs: calcCompetencyScores_` |
| 전환기준 매트릭스(80점+무위험→전환권고 등) | `Scoring.gs: judgeConversion_` |
| 위험요인 7항목·3단계, 점수로 상쇄 불가 | `Scoring.gs: RISK_ITEMS`, `Handlers.gs: handleSubmitRisk_` |
| 무근거 일괄평가 방지(4점/1점 또는 최저영역 근거 필수) | `Handlers.gs: validateEvidenceRule_` |
| 멘토·현장소장 2단계 이상 차이 시 조정사유 필수 | `Handlers.gs: handleConfirmCompetencyEval_` |
| 위험요인 현재상태(ongoing) vs 심의 시점 스냅샷(decision_snapshot) 분리 | `Handlers.gs: handleSubmitDecision_` |
| 주간활동기록 upsert(intern_id+week_no 중복방지) | `Handlers.gs: handleSubmitActivityLog_` |
| 역할별 접근 통제(인턴/멘토/현장소장/인사부서) | `Code.gs: assertCanAccessIntern_`, 각 handler의 role 체크 |
| 모든 쓰기 작업 감사로그 기록 | `Data.gs: withWriteLock_ → writeAuditLog_` |

## 알려진 제약 및 향후 보완 필요 사항

- 현재 수습(7~12주차) 결과 처리는 `Decisions` 시트에 결과값을 기록하는 수준으로 구현되어 있다. 수습 전용 세부 평가서(OJT 체크리스트 등 종이양식에 있던 항목)를 화면으로 그대로 재현하려면 별도 화면/시트 확장이 필요하다.
- 동시 다중 사용자 쓰기 충돌은 `LockService.getScriptLock()`으로 직렬화하고 있으나, Apps Script 쿼터(일일 실행시간, URL Fetch 호출 수 등)를 초과하면 서비스가 일시 중단될 수 있다 — 사용자 수가 크게 늘어나면(수백 명 이상) Apps Script 대신 실제 백엔드(Cloud Functions 등) 전환을 검토할 것.
- Google Sheets를 DB로 쓰는 구조는 소규모(인턴 기수당 수십 명 단위) 운영에는 적합하나, 데이터가 누적되며 조회 성능이 저하될 수 있다. 연도별로 스프레드시트를 분리하거나 과거 기수 데이터를 별도 아카이브 시트로 이관하는 운영 규칙을 권장한다.
