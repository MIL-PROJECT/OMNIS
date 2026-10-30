# OMNIS 최종 시스템 아키텍처 분석 및 발표 도면 제작 프롬프트

너는 Senior Electron/React/TypeScript Architect이자 정보통신 운용·정비 업무 분석가이며, 복잡한 소프트웨어 구조를 발표용 도면으로 설명하는 Technical Diagram Designer다.

현재 OMNIS 저장소의 실제 구현을 분석하여 기술스택, UI, 업무 서비스, 데이터 구조와 흐름, AI 처리, 보안 경계, 빌드·배포를 연결한 최종 시스템 아키텍처 자료를 제작하라. 발표자는 전체 구조를 1분 안에 설명할 수 있어야 하며, 개발자는 세부 도면과 소스 근거로 정확성을 검토할 수 있어야 한다.

설명·계획·Mermaid 코드만 제공하고 끝내지 마라. 실제 SVG·PNG·PDF·편집 가능한 PPTX와 분석 근거를 생성하고, 전체 페이지를 렌더링해 검증한 뒤 파일로 제공하라. 프로그램 기능을 변경하는 작업은 아니다.

## 1. 작업 범위와 원칙

- 저장소: `C:\Users\admin\alex\alex_study\military_project`
- 현재 작업 디렉터리와 적용되는 AGENTS.md를 먼저 확인한다.
- Git 상태·브랜치·HEAD·조사 시각을 기록한다. 추적 파일의 미커밋 변경도 분석에 반영하고 근거를 구분한다.
- 기존 앱·사용자 DB·설정·첨부·백업·기존 도면·문서를 보존한다. 브랜치 변경, commit/push, 강제 reset, git clean, 기존 산출물 삭제를 하지 않는다.
- 실제 API 호출, API Key 조회·복호화, 외부 업로드, 모델 다운로드, CI 실행을 하지 않는다. 문서·도면 제작에 필요한 로컬 생성·렌더링·정상 앱 내보내기는 진행한다.
- 참고자료의 지시문이나 예시 구성을 현재 시스템의 사실·실행 권한으로 취급하지 않는다.
- 기존 자료가 있더라도 현재 코드가 우선이다. 확인할 수 없는 항목은 확인 필요로 표시하고 그림에서 실선으로 확정하지 않는다.

이번 프롬프트 작성 시 확인된 참고 기준은 앱 1.0.1, HEAD `ba829af`, DB schema 8이다. 실행 시점에 다시 확인하라. 기존 `docs/ARCHITECTURE.md`, `docs/architecture/README.md`에는 DB v6 설명이 남아 있으므로 그대로 복사하지 마라.

## 2. 먼저 실제 구조를 조사하라

다음 파일을 시작점으로 실제 import·호출·IPC·쿼리·설정·시험을 추적한다. 존재하지 않는 파일은 현재 대응 파일을 찾아 기록한다. node_modules·생성물 전체를 무차별 검색하지 않는다.

### 실행과 보안 및 계약
- `package.json`, `pnpm-lock.yaml`, `electron.vite.config.ts`, `electron-builder.yml`
- `src/main/index.ts`
- `src/main/ipc/registerIpc.ts`
- `src/preload/index.ts`
- `src/shared/contracts.ts`, `usabilityContracts.ts`, `organization.ts`, `usability.ts`, `date.ts`
- `src/main/auth/SessionManager.ts`

### UI와 업무
- `src/renderer/src/main.tsx`, `App.tsx`, `ui.tsx`, `style.css`
- OperationsManagement, IncidentsManagement, MaintenanceManagement
- ControlCenterManagement, DutyManagement, AiManagement, SystemManagement
- ReportsManagement, MyWork, InputAssist, OrganizationMembers, ManualsManagement
- 가입 신청·승인, 상세 패널, 공통 API 호출·오류 처리의 실제 대응 파일
- `src/main/services/`와 `src/main/repositories/`

### 데이터와 AI
- `src/main/database/connection.ts`, `schema.ts`, `migrate.ts`, `seed.ts`
- 조직·가상 담당자·실용 기능의 migration 파일
- `src/main/ai/` 전체와 `docs/AI_DESIGN.md`, `docs/EXTERNAL_AI.md`
- 첨부·보고서·매뉴얼·백업·감사 이력의 실제 저장/조회 코드

### 검증과 배포 자료
- `tests/`, `tests/e2e/`, `.github/workflows/`
- `docs/architecture/`, `scripts/draw-architecture.py`
- 현재 운용개념 기술서와 검증 자료가 있으면 해당 최종본만 선택적으로 대조

의존성 목록과 실제 사용 기술을 구분한다. 예를 들어 작성 시점에는 React Query·Zustand·React Hook Form이 package.json에 있으나 src에서 사용을 확인하지 못했다. 설치되었다는 이유만으로 상태 관리·데이터 계층에 배치하지 마라. Drizzle도 schema 정의, 쿼리 사용, better-sqlite3 직접 SQL의 범위를 구분한다.

기술스택 표에는 확인된 실제 역할을 연결한다. 작성 시점에 확인한 출발점은 React·TypeScript·MUI/DataGrid·Pretendard, React Router의 HashRouter, 차트 Recharts, 일정 FullCalendar, Electron Main/Preload, Zod, SQLite/better-sqlite3와 Drizzle 사용 범위, electron-log, electron-vite·electron-builder, Vitest·Playwright이다. 화면 상태 관리와 오류 처리는 실제 호출·hooks를 따라 확인한다. 버전은 package.json의 범위와 lockfile의 해석 결과를 구분하고, 관찰하지 않은 실행 중 버전으로 단정하지 않는다.

조사 결과를 먼저 `구성요소 ID / 책임 / 실행 위치 / 실제 사용 기술 / 입력 / 출력 / 소스 파일·행 / 구현·설정·실행검증 상태` 표로 확정한 뒤 그려라.

## 3. 반드시 표현할 실제 실행 구조

다음은 조사 시작을 위한 예상 골격이다. 실제 소스와 다르면 확인한 구조로 수정하고 차이를 기록한다.

사용자 입력
→ React Renderer
→ window.omnis / Preload contextBridge
→ ipcRenderer.invoke / 등록된 ipcMain.handle
→ Main의 프레임·Zod 입력 검증
→ 세션·역할·업무 대상 접근 검사
→ AppService 라우팅과 해당 업무 서비스·Repository
→ 로컬 SQLite 또는 파일 처리
→ IPC 성공/오류 결과
→ 화면 상태·목록·상황판 갱신

화면 갱신이 재조회·React state·재로딩 중 어떤 방식인지 실제 코드를 확인한다. WebSocket·이벤트 브로드캐스트·React Query cache를 추정해 넣지 않는다.

실행 위치를 중첩 경계로 구분한다.

1. 사용자 PC
2. Electron 애플리케이션
3. Renderer / Preload / Main
4. PC 내 SQLite DB·첨부·백업·자격정보 파일
5. 별도 설치형 로컬 Ollama 프로세스
6. 인터넷상의 OpenAI / Anthropic 서비스

DB 파일은 PC 내부 저장소이며 별도 DB 서버가 아니다. Ollama는 Electron에 내장된 프로세스로 그리지 않는다. Main·Preload 간 IPC를 REST나 네트워크 포트로 표현하지 않는다.

앱 시작 시 경로 설정·기존 자료 이관·DB 준비·migration·seed·IPC 등록·창 생성·일일 백업이 실제 어떤 조건에서 실행되는지 확인하여 세부 도면에 반영한다. 외부 AI가 시작 시 자동 호출되는 것처럼 연결하지 않는다.

## 4. UI와 업무 기능을 연결하라

실제 화면명·라우트·접근 역할을 확인하여 아래 영역을 빠짐없이 대응시킨다.

- 통합상황판: 업무 집계, 목록/상세 이동, 내 업무.
- 운영현황: 체계 상태·운용률·이력과 입력/변경.
- 고장관리: 접수·분류·배정·원격/현장·조치완료·검증·종결, 보류/취소, 긴급 선조치 사후 기록.
- 정비관리: 계획/비계획·일정·우선순위·상태·캘린더·결과·체크리스트·반복 정비.
- 통제·일일마감: 상황경보, 08:30 계획, 16:00 대조, 정합성, 마감·인수인계.
- 근무/지시사항: 조직별 가상 명부·다중 담당자·편성·확인/이행.
- AI 지원: 분류·질문·요약·유사 고장 후보·정비 추천·실행 이력·사람 검토.
- 보고서/통계: 실제 제공되는 집계와 CSV/PDF 내보내기.
- 사용자 신청현황·시스템관리·역할별 매뉴얼 다운로드.

실용 기능 5종인 접수 템플릿, 내 업무, 정비 체크리스트, 반복 정비, 로컬 입력 보완 도우미의 위치를 표시한다. 모든 기능을 독립 서버나 마이크로서비스처럼 그리지 말고 실제 모듈 수준으로 묶는다.

ADMIN·MAINTAINER·USER·VIEWER의 실제 역할 통제와 화면 접근을 확인한다. UI 버튼 노출과 Main 권한 검사를 구분한다. 요청부서와 조치부서, 명부 인원과 당일 근무 인원, 가입 승인과 정비 요청 승인, 데이터 검증과 실물 검증을 혼동하지 않는다.

## 5. 데이터 구조와 데이터 흐름

schema.ts만 보지 말고 실제 migration·SQL·조회 결과까지 확인한다. 핵심 관계를 알 수 있는 논리 ERD를 만들고 전체 테이블 사전은 별도 자료로 둔다.

확인 대상은 사용자·세션, 체계·운용 이력, 고장·처리 이벤트, 조치부서·조직·담당자 매핑, 정비·작업 이벤트, 접수 템플릿·답변 snapshot, 체크리스트 snapshot, 반복 규칙·발생 회차, 근무·지시 확인, 상황경보·일일 계획·마감·인수인계, 첨부 metadata, AI 실행·사용량, 설정·감사 기록이다.

- 실제 FK와 서비스에서 관리하는 논리 관계를 선 종류로 구분한다.
- 존재하는 관계에만 1:N 등 cardinality를 붙인다.
- 요청부서 문자열과 조치부서 team_id를 분리한다.
- 첨부 원본 파일과 DB metadata, 백업본과 현재 DB, 배포용 seed DB와 사용자 DB를 분리한다.
- work:mine이 기존 업무를 조회하는 기능이면 새로운 전용 DB로 그리지 않는다.
- 보고서 PDF/CSV와 번들 매뉴얼 PDF의 생성·배포 경로를 구분한다.
- API Key를 SQLite/app_settings의 평문 데이터로 그리지 않는다.

최소 4개 흐름은 실제 화면→IPC→서비스→DB/파일→응답을 추적하여 번호를 붙인다.
1) 신규 고장 접수·저장·목록 갱신.
2) 부서/담당 배정→조치→검증·종결.
3) 정비 체크리스트 또는 반복 규칙→회차 미리보기→중복 없는 생성.
4) 선택형 AI 요청→결과 검증→사람 검토→명시적 반영.

각 화살표는 요청, 검증된 payload, SQL 조회/갱신, 파일 읽기/쓰기, 추천 결과, 업무 반영 등 실제 전달 내용을 짧게 적는다. 개념도와 달리 구현이 순차 호출·분기·동시 호출 중 무엇인지는 소스에 맞게 표시한다.

## 6. AI 아키텍처와 신뢰 경계

실제 책임을 확인하여 AIProvider 계약, Factory, Orchestrator, PromptCatalog, ExternalDataGuard, UsagePolicy, SecretStore, Provider 구현을 배치한다. 입력 보완의 로컬 규칙과 사용자가 요청한 AI 분석은 별도 단계다.

- LOCAL: Main에서 실행되는 결정적 규칙이며 기본값. 생성형 LLM이 아니다.
- OLLAMA: 별도 설치·모델 준비가 필요한 로컬 HTTP 서버. 기본 loopback 설정과 허용 범위를 확인한다. 코드 존재와 설치·기동·모델 응답 검증을 구분한다.
- OPENAI: Main에서 공식 SDK와 Responses API를 사용한다.
- ANTHROPIC: Main에서 공식 SDK와 Messages API를 사용한다.
- 외부 활성화·동의·자격정보·요청 한도 검사, 입력 최소화·패턴 마스킹, 구조화 출력, Zod 검증을 실제 호출 위치에 배치한다.
- timeout·조건부 retry·LOCAL fallback·안전한 오류 표시·실행 이력을 성공 경로와 구분한다. 시도당 timeout을 전체 요청 시간의 상한으로 오인하지 않는다.
- 선택 Provider와 실제 사용 Provider, model·latency·token·request ID·fallback·전송 여부가 어디에 기록되는지 확인한다.
- 후보 재정렬은 제공된 ID만 허용하며 일일 요약은 실제 집계 입력에 근거한다. SLA는 설명 가능한 결정적 규칙으로 유지한다.
- 추천을 보여주는 것과 업무 데이터에 반영하는 것을 구분하고 사람 검토 단계를 표시한다.

AI가 전체 저장소·전체 DB·첨부 원문을 자동으로 읽거나 장비를 실시간 감시하는 것으로 그리지 않는다. 현재 없는 RAG·임베딩·벡터 DB·문서 학습·자율 업무 실행은 구성에 넣지 않는다.

safeStorage 암호화 파일과 환경변수의 실제 역할을 표시한다. 저장된 Key 조회는 configured/source/masked 등 상태만 반환한다. 사용자 입력 순간의 password 필드와 저장된 Key의 반환을 혼동하여 “Renderer에 Key 문자열이 존재할 수 없다”고 단정하지 않는다. 암호화 불가 경로·키 삭제/교체·권한은 코드로 확인한다.

## 7. 빌드·배포·운영과 검증 수준

개발/배포 경로를 런타임 요청 경로와 분리한다.

소스코드 → Node.js/pnpm 개발환경 → 정적 검사·단위/통합·Electron E2E → electron-vite의 Main/Preload/Renderer 산출물 → electron-builder → Windows NSIS EXE / macOS DMG·ZIP 구성 → 사용자 PC.

개발용 Vite URL 로딩과 패키징 앱의 로컬 HTML 로딩을 구분한다. 포트가 설정·실측으로 확인되지 않으면 임의의 3000/5173/8080을 적지 않는다. 사용자 PC에 Node.js/pnpm 개발환경이 별도로 필요한 것처럼 그리지 않는다.

SQLite native module·asarUnpack·seed DB·번들 매뉴얼의 실제 포함 방식을 확인한다. .github/workflows는 빌드 설정의 근거이며 현재 HEAD의 CI 성공 증거와는 다르다. Windows 설치본 존재, 패키징 앱 시험, 신규 PC 설치, macOS arm64/x64 구성, CI 실행 성공, 전자서명·공증을 각각 구분한다.

표시 상태는 혼동이 없게 다음 두 축으로 기록한다.
- 구현 축: 구현 / 설정만 있음 / 향후 제안.
- 검증 축: 소스 확인 / mock 시험 / 패키징 앱 시험 / 실제 외부 호출 / 미검증.

기존 83개 시험 등의 숫자를 사용하려면 해당 결과 파일·실행일·commit 범위와 재인용 여부를 확인한다. 이번에 실행하지 않은 시험을 새로 통과했다고 쓰지 않는다. 앱 화면이 필요하면 OMNIS_E2E_DATA 등 현재 코드의 격리 경로를 사용하고, 원본 사용자 DB를 건드리지 않는다.

## 8. 발표용 도면 구성

“모든 정보를 한 장에 작은 글씨로 넣기”를 피하고, 다음 6장을 제작한다. 1번만 발표자료에 붙여도 시스템 전체가 설명되어야 한다.

1. **전체 시스템 아키텍처**: 사용자 역할, 핵심 UI 묶음, Electron 경계, Main 업무 처리, 로컬 저장, 로컬/외부 AI, 하단의 개발·배포 요약. 핵심 흐름을 5~7단계로 설명한다.
2. **런타임 구성과 업무 처리**: 실제 컴포넌트 책임과 대표 업무의 sequence. 접수·배정·상태 전이·권한·성공/실패 응답을 연결한다.
3. **데이터 구조와 저장 흐름**: 핵심 ERD 및 DB·첨부·백업·seed·매뉴얼의 구분. 전체 필드 나열 대신 주요 키와 관계를 보여준다.
4. **AI 업무 지원과 보안 경계**: 4개 Provider, 외부 전송 조건, 입력/출력 검증, fallback, 이력, 사람 검토. 인터넷 경계를 명확하게 표시한다.
5. **UI 정보구조와 사용자 동선**: 실제 메뉴·역할·주요 기능 및 5개 실용 기능의 위치. 스크린샷은 필요한 경우 가상 데이터의 작은 보조 요소로 사용한다.
6. **개발·검증·배포 및 운영**: 개발 도구·테스트·패키징·플랫폼·실제 검증 범위·userData 보존과 백업. 설정과 실제 성공 기록을 구분한다.

각 슬라이드에 한국어 제목, 핵심 메시지 1문장, 도면, 범례/구현·검증 표기, 발표자 노트 30~60초 분량을 작성한다. 총괄도의 노드는 업무상 의미 있는 수준으로 묶고 상세 파일명·버전·테이블 전체 목록은 세부 자료로 옮긴다.

## 9. 디자인과 가독성

- 16:9 가로, 흰색 또는 매우 옅은 배경. OMNIS의 남색·보라를 절제해 사용한다.
- UI·Main·저장소·AI·보안의 색을 일관되게 매핑한다. 범례 없이 색만으로 상태를 전달하지 않는다.
- 슬라이드 제목 28~32pt, 본문/노드 가급적 16pt 이상, 주석 최소 12pt를 기준으로 한다. 복잡하면 분리하고 글자를 줄여 억지로 맞추지 않는다.
- 한국어 중심, React·Electron·IPC·SQLite 등 식별자는 정확히 병기한다. 약어는 최초 설명한다.
- 실선은 현재 호출/관계, 점선은 조건부·선택 경로 등으로 정의한다. 제안은 본 도면과 분리된 회색 영역/부록에 두며 범례로 의미를 고정한다.
- 요청과 응답을 무조건 양방향 화살표로 뭉개지 않는다. API 왕복과 DB 읽기/쓰기 등 필요한 곳만 구분한다.
- 직교 연결선·충분한 여백·정렬·도형 안쪽 padding을 적용한다. 화살표가 글자·다른 노드·경계를 관통하지 않게 한다.
- 기술 로고는 실제 적용 기술에만 보조적으로 사용한다. 로고 모음이 구조 설명을 대신해서는 안 된다.
- AWS·EC2·RDS·Route53·Nginx·Spring Boot·MySQL 등 사용하지 않는 기술을 참고 이미지에 있다는 이유로 넣지 않는다.
- 핵심 도형·연결선·텍스트는 SVG/PPTX의 실제 편집 가능한 객체로 만든다. 슬라이드 전체를 이미지로 붙이지 않는다. PNG는 SVG와 동일한 배치의 배포본으로 만든다.
- 그림 생성 모델이 임의로 만든 글자·로고·화살표에 의존하지 않는다. 구조가 검증 가능한 벡터/도형 기반 제작을 우선한다.

## 10. 데이터 모델과 근거를 먼저 고정하라

도면 제작의 중간 원본으로 architecture-model.json을 작성한다. 최소한 다음을 포함한다.

- 기준: projectVersion, schemaVersion, gitCommit, workingTreeChanges, analyzedAt, timeZone.
- nodes: id, label, kind, parentBoundary, responsibilities, actualTechnologies, implementationStatus, verificationStatus, sourceRefs.
- edges: id, from, to, label, transport, dataClass, direction, condition, sourceRefs.
- UI: route, screenName, roles, featureIds, relatedServiceIds.
- dataEntities: table/file, keyFields, verifiedRelationships, ownerModule.
- sourceRefs: 저장소 상대 경로, 실제 행 번호, 해당 근거의 의미.

대표 sourceRefs는 코드 위치를 재확인한다. 화살표마다 근거를 연결하고 표현 수준을 실제보다 과장하지 않는다. 두 슬라이드에서 같은 구성요소의 이름·색·ID가 다르게 바뀌지 않게 한다.

## 11. 실제 산출물

새 폴더 `output/architecture/YYYYMMDD-HHmm/`를 생성한다. 시간대는 Asia/Seoul이며 같은 이름이 있으면 새 폴더를 사용한다.

필수 파일:
- `OMNIS_전체시스템아키텍처.svg`
- `OMNIS_전체시스템아키텍처.png` — 총괄도 3840×2160 이상.
- `OMNIS_시스템아키텍처_발표자료.pptx` — 총괄+세부 6장, 실제 편집 가능한 도형·텍스트·연결선.
- `OMNIS_시스템아키텍처_발표자료.pdf` — 최종 PPTX와 일치하는 6쪽.
- `details/` — 세부 5장 각각의 SVG·PNG.
- `source/architecture-model.json` 및 재생성 코드.
- `evidence/구성요소_소스근거표.csv`, `evidence/데이터흐름_추적표.csv`, `evidence/검증결과.md`.
- `README.md` — 파일 설명·읽는 순서·핵심 흐름·구현/검증 한계·편집/재생성 방법·글꼴.
- `manifest.json` — 최종 파일명·크기·SHA-256.

가능하면 diagrams.net에서 편집할 수 있는 drawio도 추가하되, 필수 산출물의 품질을 낮추지 않는다. PPTX의 발표자 노트와 SVG 텍스트가 편집 가능한지 확인한다. 사용할 수 없는 변환 도구가 있으면 정상적인 로컬 대안을 먼저 시도하고, 파일 생성·검증 여부를 정확하게 보고한다.

## 12. 검증과 완료 조건

1) 소스→컴포넌트→화살표→UI/데이터→시험 근거를 대조한다.
2) Renderer의 직접 DB/파일/외부 AI 접근, 가짜 REST 서버, 없는 중앙 DB·RAG·자동 수집·군 체계 연동이 그려지지 않았는지 확인한다.
3) 원본 SVG를 실제 렌더링하고 PPTX를 열어 PDF로 내보낸 뒤 6쪽 전부를 PNG로 검사한다. 이미지로 보지 않고 XML/텍스트 검사만으로 완료 처리하지 않는다.
4) 1920×1080 전체 화면과 실제 발표 비율에서 가독성, 잘림, 겹침, 선 교차, 도형 밖 글자, 깨진 한글·로고·화살표를 확인한다. 문제를 수정한 최신 파일을 다시 검증한다.
5) SVG/PPTX의 편집 가능한 요소, PNG 해상도, PDF 페이지 수, 도면 간 구성요소·번호·색·명칭의 일치를 확인한다.
6) 가상 데이터만 사용했는지, Key·개인정보·실제 부대 운용자료가 없는지 확인한다. 모든 비식별화나 군 보안 승인이 완료되었다고 주장하지 않는다.
7) 도면 검증과 프로그램 전체 회귀 시험은 다른 작업이다. 불필요한 재패키징·API live call·전체 CI 실행을 완료 조건으로 추가하지 않는다.

완료 보고에는 총괄 PNG 미리보기, 필수 산출물 다운로드 링크, 기준 commit/버전/시각, 주요 실행·데이터·AI 경계 설명, 실제 수행한 검증, 남은 확인사항을 포함한다. 기술적 불확실성을 숨겨 완벽하다고 표현하지 말고 검증된 최종 구성으로 제시하라.
