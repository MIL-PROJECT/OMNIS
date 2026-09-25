# AFCCS 정보통신 운용·정비 통합체계

Windows용 오프라인 시연 앱입니다. 모든 기본 데이터는 가상 데이터입니다. 실제 군 운용 자료를 입력하지 마십시오.

## 구조

React 19 Renderer → sandboxed preload contextBridge → validated IPC → Electron Main → service → SQLite (`better-sqlite3`). HTTP 서버는 사용하지 않습니다. Drizzle schema 정의는 `src/main/database/schema.ts`에 있으며, 전체 ORM 적용은 남은 작업입니다.

## 환경 및 실행

- Node.js 22.18 이상 또는 24 LTS, pnpm 11
- `pnpm install`
- `pnpm db:build-seed`
- `pnpm dev`

데모 계정: 관리자 `demo_admin`, 일반 사용자 `demo_user` (비밀번호 모두 `Demo!2026`). 일반 사용자는 시스템관리 메뉴와 관리자 전용 기능(백업·초기화·AI 설정·감사 로그·체계 삭제)을 사용할 수 없습니다. 설치 후 반드시 변경하는 프로덕션 계정이 아닙니다.

## 데이터

실제 DB: `%APPDATA%/AFCCS/data/afccs.db`. 최초 실행 시 `resources/db/afccs-seed.db`를 복사합니다. seed가 없으면 migration과 seed 코드가 DB를 생성합니다. 업데이트 시 이 경로의 DB를 유지합니다. E2E는 `AFCCS_E2E_DATA`로 격리된 경로를 사용하고 경로를 검증합니다.

## 검사 및 배포

- `pnpm typecheck`, `pnpm lint`, `pnpm test`
- `pnpm build`
- `pnpm dist:win` → `release/`에 NSIS 설치 파일

앱 내 시스템관리에서 DB 백업, 데이터 폴더 열기, 2단계 확인 후 Demo 초기화를 실행할 수 있습니다.

## 현재 범위

대시보드, 운영 체계 CRUD, 고장·정비 등록/수정/상태 전이, 근무·지시사항 CRUD, Local Rule 및 선택적 로컬 Ollama, 일일·주간 보고서, CSV/PDF, 백업과 초기화를 구현했습니다. 남은 범위는 `PROJECT_STATUS.md`를 확인하십시오.
