# Project Status

## Completed

- [x] Phase 1–2: pnpm project, Electron, React 19, TypeScript strict and secure preload.
- [x] Phase 3–4: SQLite schema v1, migration, 10 demo users, 38 systems, 52 incidents, 42 maintenance tasks, 28 duty rows, 8 directives.
- [x] Phase 5–6: local scrypt login, role checks, Zod validated IPC and restricted contextBridge.
- [x] Phase 7–11: dashboard; operations CRUD/status/history; incident create/edit/assignment/workflow/events; maintenance create/edit/workflow/events/calendar; duty and directive CRUD.
- [x] Phase 12: offline Local Rule, optional local Ollama provider, structured output validation and fallback; triage, summary, similar incident and maintenance recommendations.
- [x] Phase 13: daily/weekly reports, CSV and daily PDF export.
- [x] Phase 14–15: system info, notifications, admin audit view, backup, two stage demo reset with recovery backup.
- [x] Phase 16–17: typecheck, lint, unit/integration test, Electron E2E, Windows NSIS packaging.
- [x] Phase 18: README and architecture, database, security, IPC, build and demo docs.

## In progress

- [ ] Review remaining gaps in `Remaining` and validate the installer on a clean Windows machine.

## Remaining

- [ ] Move the remaining service SQL into dedicated repositories and integrate Drizzle migrations with the runtime upgrader. The dashboard repository now uses Drizzle and schema generation works, but other services still use hand-written schema v1 migrations and parameterized SQLite queries.
- [ ] Add richer operations history charts, incident SLA/period filters and calendar drag/drop.
- [ ] Add date-range trend reports, calendar drag/drop and broader report print layout review.
- [ ] Role-specific navigation and deeper authorization tests for every IPC channel.
- [ ] Fresh machine installer test.

## Test Result

- TypeScript typecheck: passed.
- ESLint: passed.
- Vitest: 5 passed; `pnpm typecheck` and `pnpm lint` passed.
- Seed DB: integrity check passed; expected row counts verified.
- Electron E2E: login, incident persistence/edit, operations creation, maintenance workflow/result/calendar, duty/directive creation, weekly report, PDF export, notification read state, backup and demo reset passed in an isolated data path.
- RBAC E2E: VIEWER, OPERATOR and MAINTAINER forbidden actions rejected by Main services.
- Packaged EXE E2E: the latest single-process package passed the full end-to-end flow with isolated data.
- `pnpm build`, `pnpm dist:win` and `pnpm db:generate`: passed.
- NSIS Setup.exe: regenerated with AFCCS icon on 2026-09-25.

## Known Issues

- Feature coverage is partial against the original 45-section specification; remaining items above are not claimed complete.
- Fresh-machine installer behavior still needs manual verification.
- Early smoke tests created a demo DB under `%APPDATA%/Electron/data/afccs.db` before the app data path was corrected. It has not been deleted or reset. Normal runs now use `%APPDATA%/AFCCS/data/afccs.db`; E2E runs use `tests/.tmp`.
