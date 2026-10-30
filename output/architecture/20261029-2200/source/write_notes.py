from pathlib import Path
import json,csv
O=Path(__file__).resolve().parents[1];M=json.loads((O/'source/architecture-model.json').read_text(encoding='utf8'))
by={r['meaning']:r for r in M['sourceRefs']}
def src(needle):
 r=next(r for r in M['sourceRefs'] if needle in r['meaning']);return f"`{r['path']}:{r['lineStart']}-{r['lineEnd']}`"
text=f'''# 현재 구현 분석과 표현 수준

기준 시각: {M['analyzedAt']} (Asia/Seoul). 패키지 {M['projectVersion']}, schema {M['schemaVersion']}, HEAD `{M['gitCommit']}`, 브랜치 `{M['gitBranch']}`. 실행 중인 앱 버전을 관찰한 결과가 아니라 소스·lockfile·migration 기준이다. 추적 파일의 미커밋 변경은 없었다. 미추적 prompt 문서와 기존 output은 보존했다. 대화로 제공된 AGENTS.md 지침을 적용했고, 현재 디렉터리·상위 경로 및 저장소의 적용 위치에서 별도 AGENTS.md 파일은 발견하지 못했다.

## 실행 위치와 화면 갱신

Renderer는 React state/useEffect/useRef를 사용하고 `window.omnis.invoke`의 Result 실패를 Error로 바꾼다. 저장 후 폼/상세를 닫고 목록을 재조회한다. 통합상황판은 초기/명시적 새로고침, 메뉴 badge는 route 변경 시 재조회한다. 화면의 reset DOM event는 로그인 상태 초기화용이며 일반 업무 변경의 방송 채널이 아니다. WebSocket 업무 동기화·React Query cache는 확인되지 않았다. CSP의 localhost WebSocket 허용은 개발 도구 연결과 혼동하지 않았다. {src('useState 인증')}, {src('목록 재조회')}, {src('Result 실패')}.

Renderer에는 Node 통합을 제공하지 않는다. `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, `webSecurity:true`, 패키징 앱 devTools 제한·창 열기/내비게이션 차단을 확인했다. Main의 ipcMain.handle은 mainFrame과 Zod를 확인하고, AppService 및 각 모듈이 세션·역할·대상 접근을 검사한다. G는 이 검사 책임을 같은 Main 안에서 묶은 도면 요소이며 독립 서버가 아니다. {src('sandbox/contextIsolation')}, {src('mainFrame→Zod')}.

## 시작과 자료 보존

- `OMNIS_E2E_DATA`가 있으면 격리 경로를 사용한다. 없으면 appData/OMNIS를 사용하며 새 경로가 없고 AFCCS/data가 있을 때 AFCCS의 data와 backups만 임시 폴더로 복사한 뒤 이름을 바꾼다. 이전 원본은 삭제하지 않는다. 첨부·자격정보가 이 이전 코드에서 함께 복사된다고 표현하지 않았다.
- DB가 없고 seed가 있을 때만 seed 파일을 복사한다. DB를 열어 foreign_keys=ON, WAL, synchronous=NORMAL, busy_timeout=5000을 설정하고 필요한 v1~v8 migration 후 seed를 실행한다. schema가 앱보다 높으면 시작을 거부한다.
- users가 있으면 기존 사용자를 유지하며 demo user/통제용 자료/조직/가상 명부를 필요한 조건에서 보충한다. 빈 DB면 가상 초기 자료를 생성한다. migration과 seed는 같은 개념이 아니다.
- app.whenReady 안에서 DB → IPC 등록 → 창 생성 순서다. 날짜 marker가 없으면 창 생성 후 비동기 일일 백업을 시도하고 성공 후 marker를 쓴다. 백업은 SQLite backup API와 첨부 복사이며 최신 10개 DB 및 대응 첨부 백업을 남긴다. 자격정보 파일은 백업 대상에 없다.
- 08:30/16:00은 작업판 기본 설정/안내 시각이다. 자동 실행 스케줄러로 그리지 않았다. 외부 AI는 앱 시작 때 자동 호출되지 않는다.

근거: {src('userData 경로')}, {src('DB/seed 경로')}, {src('부족한 v1')}, {src('seed 조건')}, {src('DB 준비→IPC')}, {src('DB backup')}.

## 데이터와 파일

현재 migration의 리터럴 DDL을 Python SQLite 메모리에서 재현했고, 배포용 resources/db/omnis-seed.db는 mode=ro로 schema와 테이블별 건수만 조회했다. 이 확인은 Node/Electron의 실제 migration 통합시험을 대체하지 않는다. 실제 사용자 DB·첨부·백업·Key 저장소는 열지 않았다. 전체 33개 테이블, 345개 필드와 실제 FK는 CSV/JSON에 보존했다.

- 세션은 SessionManager의 PublicUser 메모리 값이다. 별도 sessions 테이블은 없다.
- `department`는 요청부서 문자열이다. `incidents.team_id`는 조치부서이며 실제 FK가 없고 서비스가 가용·담당 소속을 검사한다. `assigned_to`는 users FK이다.
- `team_organizations`는 조치부서와 조직을, `organization_members`는 users와 조직 명부를 연결한다. 가상 명부의 인원은 빈 인증정보를 사용하여 로그인 계정으로 사용하지 않는다. 당일 근무 인원은 duty_roster의 날짜별 편성이다.
- 접수 답변 snapshot(incident_intakes)과 체크리스트 snapshot(task_checklists)은 당시 질문·항목·버전을 보존한다. 체크리스트는 revision으로 stale update를 검사하고 필수/NA 사유를 확인한다.
- 반복 규칙은 기존 업무를 자동 배치하는 상주 스케줄러가 아니다. 미리보기 후 사용자가 날짜를 선택해 생성한다. 생성 때 규칙/담당/마감/과거 여부를 재검증하고 PK(rule_id,occurrence_date)와 존재 확인으로 이미 생성된 회차를 skip한다. batch transaction 실패 시 전체 rollback 구조다.
- work:mine은 incidents, maintenance_tasks, directives의 사용자별 조회이며 전용 저장소가 아니다.
- attachments는 metadata/해시이고 원본은 userData/attachments 파일이다. entity_type/entity_id 관계는 polymorphic 논리 관계이며 FK로 표시하지 않았다. 파일 복사 후 DB transaction이 실패하면 복사본 정리 경로가 있다.
- 보고서 화면은 일별 상태 건수와 주별 날짜 건수를 제공한다. CSV는 고장/정비 전체 선택 열을 저장한다. PDF는 선택 날짜의 고장 SQL → HTML → 숨긴 BrowserWindow.printToPDF로 생성한다. PDF 날짜 필터는 substr(reported_at,1,10), 일별 통계는 date(reported_at,'+9 hours')로 달라 같은 시간 경계를 보장한다고 단정하지 않았다.
- 역할별 매뉴얼은 번들 PDF 검증 후 열기/복사한다. 보고서처럼 즉석 생성하는 경로가 아니다. 로그인 사용자는 5개 역할의 매뉴얼을 선택할 수 있다.

근거: {src('메모리 세션')}, {src('요청부서 보존')}, {src('명부 PK/FK')}, {src('규칙 버전')}, {src('재검증·중복')}, {src('native dialog')}, {src('당일 고장 SQL')}, {src('번들 PDF')}.

## 역할과 업무 의미

실제 roleSchema는 ADMIN, OPERATOR, MAINTAINER, USER, VIEWER 5종이다. `/signups`, `/settings`만 ADMIN route guard가 있고 나머지는 로그인 공통 route다. 버튼 노출과 Main 허용 범위는 다를 수 있다. USER는 본인 고장을 조회/수정하고 VERIFIED 상태에서 확인을 갖춰 종결한다. MAINTAINER의 고장 상태 변경은 본인 배정 또는 가용 팀 멤버 조건이 있고, 정비 상세·수정은 본인 배정 범위를 검사한다. VIEWER는 조회 중심이지만 지시 확인처럼 로그인/대상 확인만 요구하는 호출도 있으므로 완전한 쓰기 금지라고 단정하지 않았다.

가입 승인은 사용자 계정 등록 절차다. 고장 요청에 대한 정비 부서 배정·처리 상태와 구분한다. 정합성 검사는 기록 누락·상태 불일치·미완료 사유 검사이고 장비 실물 검증이 아니다. VERIFIED도 사람의 업무 상태 입력이다. UI에서는 일부 route/버튼이 열려도 Main에서 호출을 거부할 수 있으며, 이 차이를 자료에서 개선 완료로 주장하지 않았다.

## AI 계약과 신뢰 경계

AIProvider 계약 아래 Factory가 설정별 객체를 만들고 Orchestrator가 요청을 실행한다. PromptCatalog는 기능별 system, version, JSON Schema와 출력 토큰 한도를 제공한다. 입력 보완은 Renderer missingQuestions/shared 규칙, `input:inspect`도 LOCAL 규칙이며 선택형 추론과 별개다. AI 지원 화면은 분류와 유사 고장 후보를 Promise.all로 동시에 요청할 수 있으나, 한 요청의 Provider를 동시에 여러 곳 호출하는 구조는 아니다.

- LOCAL은 Main의 결정적 규칙이고 기본값이다. 생성형 LLM이 아니다. 실제 저장된 사용자 설정은 이번에 조회하지 않았다.
- OLLAMA는 별도 설치·기동·모델 준비가 필요한 HTTP 프로세스다. 기본 `http://127.0.0.1:11434`, 설정 계약은 http + 127.0.0.1/localhost + 루트 경로 + URL 자격정보 없음 조건이다. Provider 코드와 mock fetch 시험 소스만 확인했으며 설치·기동·실모델 응답은 확인하지 않았다.
- OPENAI는 공식 SDK Responses의 strict JSON Schema, store:false를 사용한다. ANTHROPIC은 공식 SDK Messages와 output_config JSON Schema를 사용한다. store:false를 공급자의 모든 로그가 없다는 보장으로 설명하지 않았다.
- 외부 활성화·동의·credential은 Factory, 요청 한도는 primary 호출 시 검사한다. ExternalDataGuard의 마스킹·길이 제한은 각 Provider 호출 전에 적용한다. 첨부 원문·전체 DB·저장소 자동 수집·RAG·임베딩·벡터 DB·문서 학습·장비 실시간 감시·자율 업무 실행은 확인되지 않아 구성에서 제외했다.
- JSON 파싱과 Zod는 비결정적 출력에 적용한다. 후보는 제공 ID만 대조해 중복 제거 후 최대 5개를 반환한다. 일일 요약의 허용 수치 검사는 OpenAI/Anthropic에 있으며, Ollama 요약에는 동일 assertSummaryNumbers 호출이 없다. 모든 Provider가 같은 사실 검증을 한다고 표현하지 않았다.
- SLA 위험은 AppService에서 잔여시간, 조치부서 평균 시간, 활성 업무량을 비교하는 별도 결정적 규칙이다. LocalRuleProvider의 LLM 분석 결과로 대체하지 않는다.
- 시도당 timeout은 기본 15초, 설정 5~30초다. 네트워크/408/429/5xx의 재시도 가능한 오류만 최대 2회 retry하고 Retry-After 또는 backoff+jitter를 기다린다. 전체 요청 시간에는 대기·재시도·fallback이 더해진다. Orchestrator의 Promise.race 자체는 underlying 작업을 직접 취소하지 않으며 SDK timeout/Ollama AbortController가 따로 있다.
- 실패 시 선택 Provider에서 LOCAL로 직접 fallback한다. Ollama를 중간 fallback으로 거치지 않는다. 관리자 연결 시험은 Orchestrator 경로와 달리 선택 Provider를 직접 호출하고 성공/실패를 기록한다. 이번에는 해당 시험을 실행하지 않았다.

근거: {src('Provider 선택')}, {src('시도당 timeout')}, {src('패턴 마스킹')}, {src('SDK Responses')}, {src('SDK Messages')}, {src('별도 HTTP')}, {src('안전한 오류')}, {src('SLA/') }.

## Key와 실행 이력의 정확한 의미

AISecretStore는 환경변수를 우선 사용하고, 없으면 userData/secrets/ai-credentials.json의 safeStorage 암호문을 사용한다. OS 암호화 불가 시 새 파일 저장은 거부하고 환경변수 사용을 안내한다. 저장은 provider별 교체, 삭제는 저장 파일의 해당 provider 항목 제거이며 환경변수 자체를 지우지 않는다. 따라서 파일 Key를 삭제해도 환경변수가 있으면 configured=true가 유지될 수 있다. 상태 반환은 configured/source/masked이며 raw Key를 돌려주지 않는다. 다만 사용자가 password 필드에 Key를 입력하는 순간 Renderer state에 문자열이 존재하고 저장 IPC로 전달되므로 'Renderer에는 Key 문자열이 존재할 수 없다'고 쓰지 않았다. 관리 설정·저장·삭제·연결 시험은 ADMIN 권한이다.

ai_runs에는 selected_provider와 실제 provider, model, prompt_version, latency_ms, input/output_tokens, request_id, fallback_used, error_code, external_transmission, applied 등을 저장한다. 현재 output_schema_version은 promptVersion과 같은 값을 저장한다. 성공 시 latency는 Provider가 반환한 해당 시도 시간이며 fallback일 때는 Orchestrator 전체 경과시간으로 바뀐다. external_transmission은 외부 Provider와 오류 분류로 산출한 코드상 flag이지 네트워크 송신 증명서가 아니다. 일일 한도는 이 flag가 1인 실행 행 수를 세므로 retry 횟수·실제 과금 요청 수와 같지 않다.

추천은 사용자에게 표시하고 `incidents:applyAi`를 ADMIN/OPERATOR가 별도 호출할 때만 업무 분류·우선순위·추천 부서가 반영된다. `ai:markApplied`는 이력 flag이며 업무 갱신과 같지 않다. 패턴 마스킹과 구조 검증이 완전한 비식별화나 군 보안 승인을 의미하지 않는다.

## 빌드·검증의 증거 수준

Node.js/pnpm은 개발환경이다. electron-vite가 세 번들을 만들고 electron-builder가 NSIS x64 또는 macOS DMG/ZIP을 구성한다. better-sqlite3는 asarUnpack이며 seed DB와 5개 역할 매뉴얼은 extraResources다. 개발 URL은 ELECTRON_RENDERER_URL, 배포 앱은 로컬 HTML이며 임의의 포트를 적지 않았다. 사용자 PC에 Node.js/pnpm 개발환경이 필요하다고 표현하지 않았다.

macOS workflow에는 arm64/x64, 정적/단위/E2E 및 패키징·조건부 서명/공증 검사 설정이 있다. 이것은 현재 HEAD CI 성공 기록이 아니다. release에는 1.0.0 Windows 설치본이 있으며 소스 1.0.1의 설치/패키징 검증 근거로 사용하지 않았다. 신규 PC 설치·현재 HEAD 패키징 앱 시험·macOS 실제 빌드/CI 성공·전자서명/공증·외부 AI 응답은 이번 작업에서 미검증이다. 과거 '83개 통과' 숫자는 이번 통과 결과로 재인용하지 않았다.

기존 자료는 docs/architecture/README.md의 v6 설명, docs/AI_DESIGN.md·EXTERNAL_AI.md, output/operation-concept/20261028-2248의 최종본 README·검증 기록만 선택 대조했다. 옛 결과를 현재 시스템의 새로운 실행 증거로 사용하지 않았다. 전체 프로그램 회귀를 추가 완료 조건으로 확대하지 않았다.
'''
(O/'evidence/분석_주요판단.md').write_text(text,encoding='utf8')
roles=[('운영현황 변경','ADMIN/OPERATOR/USER','동일 역할, 삭제는 ADMIN','operations:create/update/updateStatus/delete'),('고장 목록/상세','로그인 공통','USER는 본인 reported_by, 나머지는 목록 조회','incidents:list/get'),('고장 신규/수정','ADMIN/OPERATOR/USER','동일 역할; USER 수정은 본인 RECEIVED만','incidents:create/update'),('부서/담당 배정','ADMIN/OPERATOR','가용 부서·활성 담당·소속 검사','incidents:assignTeam'),('고장 조치·검증','ADMIN/OPERATOR/MAINTAINER','MAINTAINER는 배정 또는 가용 팀멤버; 전이·원인/결과 검사','incidents:updateStatus'),('고장 종결','USER 본인 VERIFIED일 때 UI 제공','USER는 본인 CLOSED 요청만; 공통 전이 및 사용자 확인 검사','incidents:updateStatus'),('정비 목록','로그인 공통 route/목록','로그인 목록 조회; 상세와 별개','maintenance:list'),('정비 상세/수정','버튼과 상세 요청의 제한이 다를 수 있음','USER 상세 불가, MAINTAINER는 본인 배정; 쓰기 ADMIN/MAINTAINER','maintenance:get/update/updateStatus'),('반복 규칙·체크리스트 쓰기','ADMIN/MAINTAINER','담당·버전·마감·완료 상태 별도 검사','recurring:*/checklist:*'),('상황경보/정합성 예외','ADMIN/OPERATOR','동일 역할; 마감은 ADMIN','control:createAlert/resolveIssue/closeDay'),('일일 계획','ADMIN/MAINTAINER','MAINTAINER는 가용 팀멤버인 부서 계획만','control:upsertDailyPlan'),('근무 편성','ADMIN/OPERATOR/USER','동일 역할; 각 담당 활성 사용자 확인','duty:create/update/delete'),('지시 관리/확인','관리 ADMIN/OPERATOR, 확인은 화면 기능','관리 ADMIN/OPERATOR; 확인은 로그인과 applicable 대상','directives:create/update/acknowledge'),('AI 분류','AI route 공통; 고장 상세는 VIEWER 버튼 숨김','ADMIN/OPERATOR/MAINTAINER/USER; USER incidentId 본인 검사','ai:triageIncident'),('AI 요약·추천·이력','AI route 공통','ADMIN/OPERATOR/MAINTAINER/VIEWER; USER 거부','ai:dailySummary/maintenanceRecommendations/listRuns'),('AI 업무 반영','ADMIN/OPERATOR','동일 역할 별도 transaction','incidents:applyAi'),('가입 승인/설정/백업','ADMIN route guard','ADMIN 재검사','admin:approveSignup/system:*'),('매뉴얼 다운로드','로그인 사용자 공통','로그인 후 5개 역할 매뉴얼 선택','manuals:list/open/save')]
with (O/'evidence/역할_권한_대조.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['기능','UI','Main 실제 검사','대표 채널']);w.writerows(roles)
print('analysis and roles evidence written')
