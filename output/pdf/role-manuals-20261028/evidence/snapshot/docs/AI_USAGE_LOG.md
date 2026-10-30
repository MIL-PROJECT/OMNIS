# AI Usage Log

| Phase | AI 요청 작업 | 생성 파일 | 확인 결과 | Human Review |
|---|---|---|---|---|
| 초기 구현 | Electron, SQLite, IPC, React, 문서 생성 | `src/`, `scripts/`, `docs/` | Typecheck, lint, seed, build 검사 기록은 `PROJECT_STATUS.md` 참조 | [ ] |
| 검증·수정 | preload sandbox, DB 격리, CRUD, AI fallback, 설치 파일 | `src/main`, `src/renderer`, `tests/e2e` | Vitest 5개, Electron 및 packaged EXE E2E, NSIS build 통과 | [ ] |

AI가 생성한 코드는 사람의 독립적인 보안·기능 검토를 아직 받지 않았습니다.
