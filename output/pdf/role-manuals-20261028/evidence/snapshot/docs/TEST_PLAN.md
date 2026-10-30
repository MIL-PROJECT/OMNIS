# Test Plan

1. `pnpm typecheck` and `pnpm lint`.
2. `pnpm test` checks v2→v3 migration preservation, seed counts, integrity, workflow, offline triage, operational control roles/lifecycle, Asia/Seoul boundary and indexed 1,000-row queries.
3. `pnpm build` creates the seed DB and bundles Main, preload and Renderer.
4. `pnpm test:e2e` launches Electron in an isolated APPDATA path and checks login, incident persistence across restart, duty/directive creation, and backup.
5. `pnpm test:e2e:operations` verifies normal and emergency intake, AI approval, team assignment, remote→on-site, result/verification/close, linked maintenance, daily close, handover, Ollama fallback and Demo lifecycle.
6. `pnpm test:e2e:roles` and `pnpm test:e2e:signup` verify Main RBAC and the registration lifecycle.
7. `pnpm test:e2e:visual` checks 1366×768 and 1920×1080 overflow and Renderer console errors and saves screenshots.
8. Attachment integration test checks schema v4 migration, allowed file storage, SHA-256, incident event, audit log, deletion, and executable-extension rejection.
8. `pnpm dist:win` builds NSIS. Run smoke and operations E2E with `OMNIS_E2E_EXE=release/win-unpacked/OMNIS.exe`.
9. Manual check still needed: install/upgrade/uninstall on a clean Windows VM. PDF save, visual layout, packaged native SQLite and Demo reset are automated.
