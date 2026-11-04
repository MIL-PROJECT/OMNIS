# Project Status

## 2026-11-04 Windows 1.1.11 및 팀 저장소 전달

- Windows 150% 배율에서 최초 창이 모니터 작업 영역을 벗어나던 문제를 수정했다. 최초 위치·크기와 최소 크기를 논리 작업 영역에 맞추며 표시 환경 변경 시 과도하게 큰 창을 조절한다.
- 타입 검사·ESLint·앱 빌드, 단위·통합 테스트 160개, 1.1.11 설치본 smoke·roles·operations-flow를 통과했다. 1.1.10 설치본 E2E 13종과 DB v8→v10 보존 검증은 별도 이전 기록이다.
- 설치된 1.1.11에서 99개 화면 상태·387개 크기 조합을 자동 검사했다. 작은 창 대표 화면 99개의 컨택트 시트 17장과 선택한 원본 캡처를 직접 검토했다. 100%·125%·150% 앱별 배율 재현에서 최초·최대화 창 내용의 화면 경계 초과가 없다.
- 검증 범위·스크롤 구분·미검증 조건은 [Windows 화면 검증](docs/WINDOWS_UI_VALIDATION_20261104.md)에 기록했다. 원본 사용자 DB의 SHA-256은 설치·검증 전후 동일하다.
- 팀 저장소는 비공개 `MIL-PROJECT/OMNIS`이며 기존 `alex50027319/military_project`도 유지한다. 코드·검사·문서와 현재 로컬에 있는 본선 준비 계획·업무분담 자료를 Git으로 전달한다. EXE·체크섬·프로필을 제외한 화면 검증 자료는 Releases로 구분한다.
- [팀 저장소 안내](docs/TEAM_REPOSITORY.md). 실제 업무 DB·API Key·개인 설정·node_modules·검증용 실행 프로필은 공유하지 않는다. 코드 서명과 실제 유료 외부 AI 호출은 이번 검증에 포함하지 않았다.

## 2026-11-01 전체 작업 저장 전 검증

- 작업 브랜치: `codex/admin-user-management`. 관리자센터·계정 보안·DB v9 이관·테스트 변경과 Figma 디자인 인계 문서를 함께 저장한다.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`를 재실행해 통과했다. Vitest는 12개 파일·97개 테스트다.
- 소스 앱의 `pnpm test:e2e:admin`을 새 격리 프로필에서 통과했다. 관리자 E2E 8개 흐름과 관리자센터 7개 영역 × 4가지 화면 크기를 확인했고, 기록된 화면 오류는 0건이다.
- 이번 저장에서는 설치 패키지 재생성·설치, 기존 전체 E2E·외부 유료 AI 호출은 다시 수행하지 않았다. 아래 과거 검증 기록은 해당 날짜와 범위의 결과다.
- 설치 파일·DB·캐시·프로필·임시 로컬 연결 자료는 기존 Git 제외 규칙을 유지한다. Figma 편집 원본은 Figma에 있으며, Git에는 파일 링크·구성·검증 현황을 남긴다.

## 2026-11-01 Figma 실무형 구성 완료

- `mil_project` Figma 파일을 시작하기, UI Library, Product Screens의 3개 Page로 정리했다. 기능 Section 12개, 기존 ID를 보존한 화면 Frame 82개, Prototype Overlay 36개를 구성했다.
- 앱 화면 77개의 Sidebar·Topbar를 공통 컴포넌트 인스턴스로 연결했다. 텍스트 편집 속성, 버튼 9개 조합, 입력란 5개 상태와 기존 상태 배지를 제공한다.
- 입력란 434곳의 값·placeholder·색상·날짜/시간 서식과 말줄임·여러 줄 정렬, 달력 이동 아이콘 6곳, 비대칭 모서리 70곳을 보정했다.
- 원본 82개 화면 비교와 대표 13개 화면의 최종 입력 서식 검토를 완료했다. 최종 감사에서 서체 누락·끊어진 이동 대상·화면 내부 이미지 채우기는 0건이며, 기존 화면 반응 1,154개를 유지했다. 브라우저 프로토타입 이동도 확인했다.
- 파일·프로토타입 링크, 편집 방식, 표현 차이와 로컬 복구 자료는 [Figma 디자인 및 인계 현황](docs/FIGMA_DESIGN.md)에 기록했다. Figma 원본은 Figma에 저장하며, 기존 Git 제외 대상인 `release/`의 로컬 캡처·프로필·임시 연결 정보는 추적하지 않는다.

## 2026-10-31 관리자센터·계정 보안 1.1.0

- 작업 브랜치: `codex/admin-user-management`. 기존 사이드바·운영통제·고장관리 UI 수정을 유지한다.
- 관리자센터 7개 영역: 관리 현황, 사용자 관리, 등록 승인, 역할·접속 보안, 감사 기록, 조직·업무 설정, 시스템·데이터. 기존 신청현황·시스템관리 경로와 화면을 유지·재사용한다.
- 실제 로그인 계정과 가상 업무 담당자 220명을 분리한다. 사용자 검색·정렬·상태 필터·페이지 이동, 기본 정보·역할 변경, 수동 잠금·해제, 사용 중지·재활성화, 자동 잠금 해제, 비밀번호 초기화를 구현했다.
- Main에서 매 요청의 현재 계정 상태·역할·인증 버전을 검사한다. 자기 계정 제한·마지막 정상 관리자 제한을 방지하며, 민감한 변경은 사유·관리자 비밀번호·동시 수정 버전을 확인한다.
- 기본 연속 5회 실패 시 15분 자동 잠금(횟수 3~10회·시간 1~60분 정책), 임시 비밀번호 일회성 표시·첫 변경 강제, 본인 비밀번호 변경, 인증 상태 UI 갱신을 구현했다. 실패 횟수·잠금·정책은 재시작 후에도 유지된다.
- 기존 감사 기록에 인증·권한·계정·정책 변경과 실패 결과를 추가하고 기간·수행자·대상·작업·결과 검색 및 변경 전후 상세를 제공한다. 새 사용자 조회·감사 응답에는 비밀번호·해시·salt·임시 비밀번호를 포함하지 않는다.
- DB v8→v9는 계정 보안·정책 테이블과 인덱스를 추가한다. Drizzle 정의를 갱신했고, seed는 기존 계정 변경을 덮어쓰지 않는다. 사용 중지 계정의 과거 고장 담당자 이름도 유지한다.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` 통과. Vitest 12개 파일·97개 테스트이며 신규 계정 보안 통합 테스트 14개를 포함한다. 마지막 정책 실패 감사 보완 후 해당 14개 테스트도 재통과했다.
- 소스 및 최종 `/Applications/OMNIS.app`에서 관리자 E2E 8개 흐름을 격리 프로필로 통과했다. 승인·권한 적용·직접 IPC 거절·잠금·사용 중지·프로세스 재시작 후 자동 잠금 유지·최초 비밀번호 변경·가상 담당자 제한·사용자 감사 상세·정책/계정 재시작 유지를 확인했다.
- 관리자센터 7개 영역을 1366×768 / 1440×900 / 1600×950 / 1920×1080에서 검사하고 스크린샷을 확인했다. 기존 roles, signup, operations, 업무 smoke 및 visual E2E도 통과했다.
- Apple Silicon 앱과 `release/admin-center/OMNIS-1.1.0-mac-arm64.dmg`를 생성했고 DMG 무결성 검사를 통과했다. SHA-256: `02f0250d5a3c3f342c55d3b6b97542c94f4ea7dfdb5ffee5dfb20ced490139bb`.
- 기존 앱을 `release/admin-center/previous-install/OMNIS.app`, 전체 userData를 `release/admin-center/user-data-before-v9/`에 보관하고 1.1.0을 설치했다. 기존 DB의 32개 테이블(감사 및 신규 보안 테이블 제외)을 전후 행 수·데이터 해시로 비교해 일치했고, v9 DB 무결성은 `ok`다. 비교 기록은 `release/admin-center/migration-preservation.json`에 있다.
- 관리자 사용·보안 상태·migration·복구·검증 안내: [ADMIN_CENTER.md](docs/ADMIN_CENTER.md). UI 검사 결과·이미지는 `tests/.tmp/admin-users/`에 로컬 보관한다. 빌드·DB·userData 백업·검사 프로필의 Git 제외 규칙을 유지한다.
- Apple 배포 서명·공증, Windows·Intel Mac 실행/설치는 이번 변경에서 검증하지 않았다. 사용자 정의 역할·개별 예외 권한·외부 SSO·다중 장비 세션·CSV 내보내기는 이번 범위에 추가하지 않았다.

## 2026-10-31 macOS UI 정리 및 설치 앱 반영

### 반영 내용

- 사이드바 하단의 로컬 DB·AI 업무지원 상태 표시를 제거하고 메뉴·매뉴얼·사용자 영역 간격을 조정했다. 낮은 창에서는 메뉴 간격을 줄여 전체 메뉴가 보이도록 했다.
- 통제·일일마감 작업판의 정비반 이름과 평균 시간은 별도 줄 간격으로 표시하고, 긴 이름·미완료 사유에 따라 행 높이가 자동으로 늘어나도록 했다.
- 정비반 카드의 제목용 스타일이 사람 아이콘과 가용 상태 배지에 적용되던 문제를 수정했다. 긴 부대명, 빈 항목, 화면 폭에 따른 카드 배치와 운영통제 탭·안내·인수인계 영역 여백을 정리했다.
- 고장관리 표는 조치부서 너비를 100~180px 범위로 조정하고 제목과 남는 공간을 나눈다. 모든 열과 상세·수정 버튼이 화면 안에 들어오도록 고정 너비·셀 여백을 줄이고, 빈 보정 셀과 처리 열 메뉴가 만들던 추가 가로 넘침을 제거했다.
- 고장관리의 최종 행 높이는 36px, 머리글 높이는 40px이다. 제목·접수수단·조치부서는 한 줄 말줄임으로 표시하며 전체 내용은 마우스를 올리거나 상세 화면에서 확인한다.

### 검증 및 로컬 산출물

- `pnpm typecheck`, `pnpm lint`, `pnpm build` 통과.
- 커밋 전 `pnpm test` 재실행: Vitest 11개 파일, 83개 테스트 통과.
- 격리된 테스트 데이터로 소스 앱과 `/Applications/OMNIS.app` 설치 앱을 각각 실행해 Playwright UI 검사를 수행했다. 사용자 DB·설정은 유지했다.
- 사이드바: 관리자·일반 사용자, 1366×768 / 1440×800 / 1440×850 / 1440×900 / 1600×950 / 1920×1080에서 메뉴 스크롤·잘림·겹침 없이 표시됨을 확인했다. 매뉴얼 이동·키보드 탐색·로그아웃도 확인했다.
- 운영통제: 5개 탭을 1366×768 / 1440×900 / 1600×950 / 1920×1080에서 확인했다. 작업판 25개 행과 정비반 카드 25개에서 글자·아이콘·가용 점 정렬을 확인했고, 긴 미완료 사유 저장·인수인계 초안 생성·경보 등록창도 검사했다.
- 최종 고장관리: 같은 4가지 화면 크기에서 36px 행 높이, 한 줄 말줄임, 9개 열·10개 행의 상세/수정 버튼 20개 표시, 가로 넘침 없음, 전체 문구 표시 및 상세·수정 진입을 확인했다.
- 임시 UI 검사 스크립트·JSON 결과·스크린샷은 `tests/.tmp/sidebar-layout/`, `tests/.tmp/control-layout/`, `tests/.tmp/incident-compact/`에 로컬 보관한다. 정규 `test:e2e` 전체 실행과는 별도의 검사다.
- 현재 설치 앱은 OMNIS 1.0.1 Apple Silicon(arm64) 로컬 개발용 빌드이며 Apple 배포 서명·공증은 하지 않았다. 최종 앱 번들은 `release/incident-compact/mac-arm64/OMNIS.app`에 있다. 이전 설치 앱들은 각 `release/*/previous-install/`에 보존했다.
- 마지막 36px 행 높이 수정은 `.app` 번들로 반영했다. 이전에 만든 DMG·ZIP은 해당 최종 수정을 포함하지 않으므로, 최신 설치 이미지가 필요하면 `pnpm dist:mac:arm64`로 다시 생성한다.
- 설치 앱·빌드 출력·의존성·DB·자격 증명·임시 검사 자료의 기존 Git 제외 규칙을 유지한다. Windows 실행·설치, Apple 서명·공증은 이번 UI 변경의 검증 범위에 포함하지 않는다.

## 2026-10-30 전체 작업 저장 스냅샷

- 작업 브랜치: `codex/usability-five-features`. 기존 실용 기능, 부대별 담당자 조회, 역할별 매뉴얼 다운로드, AI 프롬프트 및 설정 개선 커밋을 유지한다.
- 추가 저장 자료: 구현·평가 고도화·운용개념·시스템 아키텍처 마스터 프롬프트 4종, 역할별 매뉴얼과 원본·검증 증빙·ZIP, 운용개념기술서 DOCX/HWP/PDF, 편집 가능한 아키텍처 SVG/draw.io/PPTX와 PDF·생성 원본·검증 증빙, 일일 보고서 PDF와 참조 이미지.
- 이번 저장 전 실행 검증: `pnpm typecheck`, `pnpm lint`, `pnpm test` 통과. Vitest 11개 파일, 83개 테스트 통과.
- 매뉴얼·운용개념 자료는 2026-10-28, 아키텍처 자료는 2026-10-29 산출물과 당시 검증 기록을 보존한다. 이번 저장에서 해당 문서를 재생성하거나 시각 검수를 다시 수행하지 않았다.
- 이번 저장에서 Electron E2E, 설치 패키지 재빌드·새 PC 설치, 유료 외부 AI 호출은 실행하지 않았다. 아래 기존 결과는 각 기록의 검증 범위로만 해석한다.
- 매뉴얼 캡처용 Electron 프로필·캐시와 Python bytecode는 Git 추적에서 제외하고 로컬 원본을 보존한다. 기존 `.gitignore`의 설치 파일·의존성·DB·비밀정보 제외 규칙도 유지한다.
- `output/` 산출물은 Git 줄바꿈 변환을 비활성화해 원본 바이트와 기존 SHA-256 검증 정보를 보존한다.

2026-10-28 조치부서 수정: 요청부서·조치부서 분리, 미지정/배정 해제, 실제 부대별 검색과 관리자 디렉터리, DB v7. 현재 등록 범위·출처·검증 결과와 설치본은 [조치부서 안내](docs/ACTION_DEPARTMENTS.md)를 기준으로 한다. 아래 이전 버전의 hash와 macOS 결과는 이번 수정본의 검증을 대신하지 않는다.

## Completed

- [x] Phase 1–2: pnpm project, Electron, React 19, TypeScript strict and secure preload.
- [x] Phase 3–4: SQLite schema v9 순방향 migration, 기존 11 demo users + 부대별 가상 담당자 220명, 38 systems, 52 incidents, 42 maintenance tasks, 기존 공통 정비반 3종 + 실제 부대별 조치조직 디렉터리, 상황경보, 일일 작업계획, 첨부자료 메타데이터, AI 실행 사용량 메타데이터.
- [x] Phase 5–6: local scrypt login, role checks, Zod validated IPC and restricted contextBridge.
- [x] Phase 7–11: dashboard; operations CRUD/status/history; incident create/edit/assignment/workflow/events; maintenance create/edit/workflow/events/calendar; duty and directive CRUD.
- [x] Phase 12: offline Local Rule, optional local Ollama provider, structured output validation and fallback; triage, summary, similar incident and maintenance recommendations.
- [x] Phase 13: daily/weekly reports, CSV and daily PDF export.
- [x] Phase 14–15: system info, notifications, admin audit view, backup, two stage demo reset with recovery backup.
- [x] Phase 16–17: typecheck, lint, unit/integration test, Electron E2E, Windows NSIS packaging.
- [x] Phase 18: README and architecture, database, security, IPC, build and demo docs.
- [x] OMNIS rebranding and legacy AFCCS data migration with source preservation.
- [x] Indigo dashboard redesign, unified data tables/status chips and responsive side navigation.
- [x] User registration request, duplicate validation, admin approve/reject with role assignment and pending/rejected login handling.
- [x] PDF 5~11쪽 운영절차: 접수→분류→정비반 배정→원격/현장→결과→검증→종결, 긴급 선조치, 08:30/16:00 작업판, 정합성 검사, 일일 마감, 인수인계.
- [x] AI 구조화 분류·사람 승인 반영·SLA 위험·실행 이력(`ai_runs`)·Ollama 실패 시 Local Rule fallback.
- [x] 상황경보, 정비반 master/작업량, 지시사항 확인·기한·이행상태, 평가 시나리오 생성/선택 초기화.
- [x] Asia/Seoul 업무일자·시간 표시와 집계, 1,000건 이상 인덱스 조회 회귀 테스트.
- [x] 장애·정비 첨부자료: 다중 선택, 형식·25MB 제한, SHA-256, 역할/소유권, 열기·삭제, 감사 및 업무 이벤트, 백업 연계.
- [x] macOS 13+ 경로 호환, Apple Silicon/Intel 전용 DMG·ZIP 설정, ICNS 아이콘, 플랫폼 독립 E2E launcher, Apple 서명·공증 연계 CI.
- [x] OpenAI Responses API·Anthropic Messages API, structured output, safeStorage credential, 외부 전송 마스킹·동의, retry·timeout·일일 한도·Local Rule fallback.

## In progress

- [ ] Review remaining gaps in `Remaining` and validate installers on clean Windows and macOS machines.

## Remaining

- [ ] Move the remaining service SQL into dedicated repositories and integrate Drizzle migrations with the runtime upgrader. The dashboard repository now uses Drizzle and schema generation works, but other services still use hand-written schema v1 migrations and parameterized SQLite queries.
- [ ] Add richer operations history charts and calendar drag/drop.
- [ ] Add monthly trend reports, editable AI report drafts and broader report print layout review.
- [ ] Add external-system file adapter implementation; interface and safeguards are documented only.
- [ ] Fresh machine installer test.
- [ ] Apple Developer 인증서를 GitHub Secrets에 등록해 Developer ID 서명·Apple 공증·Gatekeeper 실기기 검증을 완료.

## Test Result

- TypeScript typecheck: passed.
- ESLint: passed.
- TypeScript typecheck and ESLint: passed on 2026-10-28.
- Vitest: 31 passed across 5 test files, including v4→v5 preservation, OpenAI/Claude structured output, refusal/incomplete/schema 오류, retry/timeout/offline fallback, credential 암호화, 마스킹, attachment/RBAC/control 회귀.
- Seed DB: integrity check passed; expected row counts verified.
- Electron E2E: login, incident persistence/edit, operations creation, maintenance workflow/result/calendar, duty/directive creation, weekly report, PDF export, notification read state, backup and demo reset passed in an isolated data path.
- RBAC E2E: VIEWER, OPERATOR and MAINTAINER forbidden actions rejected by Main services.
- USER RBAC E2E: daily work allowed; admin navigation and Main IPC channels rejected.
- Signup E2E: request, duplicate prevention, pending login block, role approval, rejection reason and approved-account login passed.
- Operations E2E: incident workflow, emergency pre-action, linked unplanned maintenance, reconciliation/close, handover, AI fallback, and Demo lifecycle passed.
- Visual E2E: 1366×768 and 1920×1080 body overflow/renderer-console check passed; screenshots saved under `tests/.tmp/visual`.
- External AI E2E: mock OpenAI/Claude 분석, 환경변수 Key masking, timeout→Local fallback, AI 추천 검토 후 반영, 1366×768·1920×1080 설정 화면 overflow 검사를 통과.
- Source Electron E2E: the latest OMNIS UI and workflow passed on 2026-10-28 with isolated data.
- Packaged EXE E2E: the latest `release/win-unpacked/OMNIS.exe` passed the full end-to-end flow with isolated data on 2026-10-28.
- Packaged EXE Operations E2E: the latest unpacked executable passed the new workflow and AI fallback scenario.
- `pnpm build`, `pnpm dist:win` and `pnpm db:generate`: passed.
- Production renderer/Main/preload build: passed on 2026-10-28.
- NSIS `OMNIS Setup 1.0.0.exe`: regenerated on 2026-10-28.
- External AI branch NSIS: `release/OMNIS Setup 1.0.0.exe`, 122,034,587 bytes, SHA-256 `3C4C6C5EAEB4FE2448D6517C1000852CC99702A11F42B183D6782A1A32428D46`.
- Unpacked EXE SHA-256: `D3746FE90D0A6696EB49D48CEA407F2ED6C26199008AEC4D1B54DB25FD86CCDB`.
- Windows Authenticode: 두 실행 파일 모두 `NotSigned`; 기능·패키징 검증과 코드 서명은 구분한다.

## Known Issues

- 실제 유료 OpenAI/Anthropic live call, 외부-system adapter, embedding similarity, editable AI report drafts, clean-machine installer behavior는 미검증 범위다. 자동 테스트는 mock transport만 사용한다.
- Fresh-machine installer behavior still needs manual verification.
- Early smoke tests created a demo DB under `%APPDATA%/Electron/data/afccs.db` before the app data path was corrected. It has not been deleted or reset. Normal runs now use `%APPDATA%/OMNIS/data/omnis.db` on Windows or `~/Library/Application Support/OMNIS/data/omnis.db` on macOS; E2E runs use `tests/.tmp`.

## 2026-09-26 이름 변경
- 프로그램 이름을 AFCCS → **OMNIS**(Operations & Maintenance Network Integrated System)로 변경. 데이터 폴더 `%APPDATA%/OMNIS`, DB `omnis.db`.
- 첫 실행 시 기존 `%APPDATA%/AFCCS` 폴더를 복사해 이전(원본 보존). 위의 AFCCS 표기는 변경 전 기록.

## 2026-10-28 Claude 작업 통합 검증
- OMNIS 대시보드·업무 화면 디자인과 사용자 등록 기능이 Main/Preload/Renderer 계약에 연결된 상태를 확인.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` 통과.
- 업무 smoke, RBAC, 사용자 등록 E2E를 각각 격리된 SQLite 데이터로 통과.


## 실용 기능 5종 브랜치

`codex/usability-five-features`에서 접수 템플릿·내 업무·정비 체크리스트·반복 정비·로컬 입력 보완을 구현했다. DB v6 additive migration, typed/Zod IPC, Main 권한, 기존 AI Provider 연계, 고해상도 시스템 구성도를 포함한다.

최신 테스트/산출물 결과는 `docs/FIVE_FEATURES_VERIFICATION.md`에 별도 기록한다. 앞선 외부 AI 브랜치의 테스트 수·hash·macOS 결과를 이번 버전의 검증으로 대체하지 않는다.
