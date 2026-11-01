# OMNIS 정보통신 운용·정비 통합체계

**OMNIS** — Operations & Maintenance Network Integrated System


최신 Windows 수정본은 **1.0.1** (`release/ai-connection-fix/OMNIS Setup 1.0.1.exe`)입니다. 체크 후에도 EXTERNAL_DISABLED가 표시되던 저장 흐름을 수정했습니다. 키 저장 시 입력값 유지, 미저장 상태 표시, 명시적인 **저장 후 연결 시험**, 저장 실패/미동의 시 외부 시험 차단을 제공합니다. 기존 설치 앱을 닫고 업데이트한 뒤 시스템 정보에서 1.0.1을 확인하십시오. 데이터·암호화 키 경로는 유지됩니다. 사용법은 [외부 AI 안내](docs/EXTERNAL_AI.md)를 참고하십시오.

Windows와 macOS용 오프라인 시연 앱입니다. 모든 기본 데이터는 가상 데이터입니다. 실제 군 운용 자료를 입력하지 마십시오.

각 비행단·여단·전대에 가상 담당자 10명씩(기본 22개 부대 총 220명)을 제공하며 시스템관리에서 명단을 확인할 수 있습니다.

요청부서와 조치부서를 분리하고 실제 부대명별 조치조직 검색·배정/해제를 지원합니다. 등록한 명칭·출처·확인 범위와 사용법은 [조치부서 안내](docs/ACTION_DEPARTMENTS.md)를 참고하십시오.

## 관리자센터 (1.1.0)

관리자센터에서 실제 로그인 계정의 권한 변경, 수동·자동 잠금 해제, 사용 중지·재활성화, 비밀번호 초기화와 감사 기록을 관리합니다. 기본 자동 잠금은 연속 5회 실패 시 15분이며, 임시 비밀번호로 로그인하면 최초 변경을 완료해야 업무를 사용할 수 있습니다. 가상 부대 담당자 220명은 로그인 계정과 구분합니다. 기존 가입 승인·조직·업무 템플릿·시스템 설정도 연결합니다.

자세한 사용법, 계정 보호·DB v9 이관·복구 절차·검증 방법은 [관리자센터 안내](docs/ADMIN_CENTER.md)를 확인하십시오. 본인 비밀번호는 사이드바 하단에서 변경할 수 있습니다.

## Figma 디자인

편집 가능한 화면 82개를 기능 Section 12개로 정리하고, 공통 Sidebar·Topbar와 버튼·입력 상태를 UI Library에 구성했습니다. Figma 파일, 프로토타입, 편집 규칙과 검증 범위는 [Figma 디자인 및 인계 현황](docs/FIGMA_DESIGN.md)을 참고하십시오.

## 기술평가 발표·시현 영상

평가관·개발자를 위한 15분 한국어 시현 영상, 발표 대본, 예상 질의응답 18개, 아키텍처 도식과 검증 근거를 제공합니다. 현재 구현과 향후 확장·타체계 연동 제안을 구분했습니다. 파일 위치와 보존 범위는 [평가 발표 자료 안내](docs/EVALUATION_PRESENTATION.md)를 참고하십시오.

## 실용 기능 5종

- 고장 접수 템플릿과 로컬 입력 보완: 예시와 사실을 구분하고 작성한 내용을 보존합니다.
- 통합상황판의 **내 업무**: 개인 배정 고장·오늘/지연 정비·미확인 지시에서 상세로 바로 이동합니다.
- 정비 체크리스트: 작업별 snapshot과 결과를 저장하고 필수 미점검 시 완료를 차단합니다.
- 반복 정비: 주간/월간 일정 미리보기 후 명시적으로 생성하며 같은 회차는 중복 생성하지 않습니다.
- 기존 AI 분석에 보완 답변을 전달하되 로컬 점검 자체에는 API 비용이 없습니다.

사용법은 [5개 기능 사용 안내](docs/FIVE_FEATURES_USER_GUIDE.md), 구조 그림은 [시스템 구성도](docs/architecture/README.md)를 참고하십시오.

## 구조

React 19 Renderer → sandboxed preload contextBridge → Zod validated IPC → Electron Main → service/repository → SQLite (`better-sqlite3`). HTTP 서버는 사용하지 않습니다. Drizzle schema 정의는 `src/main/database/schema.ts`에 있으며, 전체 ORM 적용은 남은 작업입니다.

## 환경 및 실행

- Node.js 22.18 이상 또는 24 LTS, pnpm 11
- Windows 10/11 x64 또는 macOS 13 Ventura 이상(Apple Silicon·Intel)
- `pnpm install`
- `pnpm db:build-seed`
- `pnpm dev`

데모 계정: 관리자 `demo_admin`, 일반 사용자 `demo_user` (비밀번호 모두 `Demo!2026`). 일반 사용자는 시스템관리 메뉴와 관리자 전용 기능(백업·초기화·AI 설정·감사 로그·체계 삭제)을 사용할 수 없습니다. 로그인 화면에서 사용자 등록을 신청할 수 있으며, 관리자가 신청현황에서 권한을 지정해 승인한 뒤 로그인할 수 있습니다. 설치 후 반드시 변경하는 프로덕션 계정이 아닙니다.

## 데이터

실제 DB는 Windows의 `%APPDATA%/OMNIS/data/omnis.db`, macOS의 `~/Library/Application Support/OMNIS/data/omnis.db`에 저장됩니다. 최초 실행 시 `resources/db/omnis-seed.db`를 복사합니다. seed가 없으면 migration과 seed 코드가 DB를 생성합니다. 업데이트 시 이 경로의 DB를 유지합니다. E2E는 `OMNIS_E2E_DATA`로 격리된 경로를 사용하고 경로를 검증합니다.

## 검사 및 배포

- `pnpm typecheck`, `pnpm lint`, `pnpm test`
- `pnpm build`
- `pnpm test:e2e`, `pnpm test:e2e:operations`, `pnpm test:e2e:roles`, `pnpm test:e2e:signup`, `pnpm test:e2e:visual`, `pnpm test:e2e:external-ai`, `pnpm test:e2e:usability`
- `pnpm dist:win` → `release/`에 NSIS 설치 파일
- macOS에서 `pnpm dist:mac` → 현재 Mac CPU에 맞는 DMG·ZIP
- `pnpm dist:mac:arm64`, `pnpm dist:mac:x64` → CPU 아키텍처를 지정한 DMG·ZIP

macOS 로컬 빌드, Apple 서명·공증 및 GitHub Actions 산출물 사용법은 [`docs/MACOS_BUILD.md`](docs/MACOS_BUILD.md)를 확인하십시오.

앱 내 시스템관리에서 DB 백업, 데이터 폴더 열기, 2단계 확인 후 Demo 초기화를 실행할 수 있습니다.

## 현재 범위

인디고 기반 UI를 유지하면서 상황경보, 정비반 배정, 고장 접수→분류→원격/현장조치→검증→종결, 긴급 선조치, 장애·정비 첨부자료, 계획/비계획 정비, 08:30·16:00 작업판, 정합성 검사·일일 마감, 지시사항 확인, 인수인계, 설명 가능한 SLA 위험, AI 검토 후 반영, Demo Mode를 구현했습니다. 첨부파일은 `%APPDATA%/OMNIS/attachments`에 저장하고 DB에는 분류·크기·SHA-256·등록자·감사기록을 보관합니다.

AI Provider는 기본 `LOCAL`, 로컬 `OLLAMA`, 선택적 `OPENAI` Responses API, `ANTHROPIC` Messages API를 지원합니다. 외부 Provider는 기본 비활성화이며 API Key는 Electron `safeStorage`로 암호화해 userData의 별도 secrets 파일에 저장합니다. 외부 호출 실패 시 업무 흐름을 중단하지 않고 Local Rule로 fallback합니다. 설정·보안·비용·실행 절차는 [`docs/EXTERNAL_AI.md`](docs/EXTERNAL_AI.md)를 확인하십시오.


### 앱에서 역할별 사용자 매뉴얼 저장

사이드바 하단 **사용자 매뉴얼**에서 관리자/운용요원/정비요원/일반 사용자/조회전용 PDF 5종을 열거나 저장할 수 있습니다. 본인 역할이 먼저 표시되며 모든 로그인 사용자가 문서를 확인할 수 있습니다. 다운로드 버튼에서 저장 위치를 선택하고, PDF 열기는 OS 기본 뷰어를 사용합니다. 앱에 파일이 포함되어 인터넷이 필요하지 않습니다.

문서는 기존 독립형 작성본(2026-10-28 09:51 KST, 기준 커밋 482b16c66c6a5bc3b5e522644bd86ce916c004fd)을 그대로 제공합니다. 이후 변경된 화면과 차이가 있을 수 있습니다. 원본·SHA-256은 resources/manuals/README.md에 기록하며 기존 output 자료는 수정하지 않습니다. Windows/macOS extraResources에 같은 PDF를 포함합니다. `pnpm test:e2e:manuals`는 격리된 프로필에서 다운로드 원본 일치, 전 역할 접근, 취소/오류 및 레이아웃을 검사하며 OS 저장창·PDF 뷰어는 테스트에서 대체합니다.


매뉴얼 다운로드 검증(2026-10-28): typecheck/lint/build, 10개 파일 70개 unit/integration 테스트, source/packaged manuals E2E 및 기존 roles E2E 통과. OS 저장창·PDF 뷰어를 대체한 테스트에서 실제 저장된 5종 PDF의 SHA-256을 원본과 비교했다. 실제 OS 기본 PDF 뷰어별 동작과 macOS 실행은 이번 변경에서 검증하지 않았다.

Windows 설치본: `release/manual-downloads/OMNIS Setup 1.0.0.exe` (136,117,422 bytes, NotSigned). SHA-256: `77DBB2274ED23D426AD77765EAAB5CE768D3956DCAE8681484F5BD7B0D2AAC01`. 이전 release 출력과 사용자 생성물을 보존했다.
