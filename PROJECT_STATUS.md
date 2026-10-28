# Project Status

## Completed

- [x] Phase 1–2: pnpm project, Electron, React 19, TypeScript strict and secure preload.
- [x] Phase 3–4: SQLite schema v6 순방향 migration, 11 demo users, 38 systems, 52 incidents, 42 maintenance tasks, 3 정비반, 상황경보, 일일 작업계획, 첨부자료 메타데이터, AI 실행 사용량 메타데이터.
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
