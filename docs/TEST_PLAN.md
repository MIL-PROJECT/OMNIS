# Test Plan

1. `pnpm typecheck` and `pnpm lint`.
2. `pnpm test` checks migration/seed counts, integrity, transitions and offline triage.
3. `pnpm build` creates the seed DB and bundles Main, preload and Renderer.
4. `pnpm test:e2e` launches Electron in an isolated APPDATA path and checks login, incident persistence across restart, duty/directive creation, and backup.
5. `pnpm dist:win` builds NSIS. Run the same E2E script with `AFCCS_E2E_EXE` pointing to `release/win-unpacked/*.exe`.
6. `node tests/e2e/roles.mjs` verifies Main-side permission denial for VIEWER, OPERATOR and MAINTAINER, and that USER can do daily work but cannot see or reach the admin-only 시스템관리 menu or admin channels.
7. Manual checks still needed: fresh installer installation, PDF save dialog, deeper role coverage and full UI visual review. Demo reset is verified in isolated E2E data.
