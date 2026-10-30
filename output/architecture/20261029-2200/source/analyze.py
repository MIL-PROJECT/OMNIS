from pathlib import Path
import csv,json,re,hashlib,subprocess,sqlite3
from datetime import datetime,timezone,timedelta
OUT=Path(__file__).resolve().parents[1]; ROOT=OUT.parents[2]
def read(p): return (ROOT/p).read_text(encoding='utf-8-sig')
def git(*a): return subprocess.check_output(['git',*a],cwd=ROOT).decode('utf8').strip()
def dump(p,x): (OUT/p).write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf8')
def csvwrite(p,rows):
 with (OUT/p).open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
refs=[]; R={}
def ref(k,p,needle,meaning,span=0):
 lines=read(p).splitlines(); hits=[i for i,l in enumerate(lines,1) if needle in l]
 if not hits: raise ValueError((k,p,needle))
 n=hits[0];rid='S%03d'%(len(refs)+1);R[k]=rid
 refs.append(dict(id=rid,path=p,lineStart=n,lineEnd=min(n+span,len(lines)),meaning=meaning,snippet='\n'.join(lines[n-1:n+span])[:1200]))
A='src/main/services/AppService.ts'; UI='src/renderer/src/'; AI='src/main/ai/'; DB='src/main/database/'; SV='src/main/services/'
specs=[
('window','src/main/index.ts','new BrowserWindow','sandbox/contextIsolation, nodeIntegration=false',0),
('startup','src/main/index.ts','const appData','userData 경로와 기존 AFCCS 자료 조건부 복사',4),
('ready','src/main/index.ts','app.whenReady','DB 준비→IPC 등록→창 생성→날짜 marker 조건부 백업',7),
('load','src/main/index.ts','if (process.env.ELECTRON_RENDERER_URL)','개발 Vite URL 또는 로컬 HTML',1),
('ipc','src/main/ipc/registerIpc.ts','ipcMain.handle','mainFrame→Zod parse→run→Result',9),
('preload','src/preload/index.ts','const invoke','window.omnis와 ipcRenderer.invoke',11),
('roles','src/shared/contracts.ts','export const roleSchema','실제 역할 5종: OPERATOR도 존재',0),
('ollamaurl','src/shared/contracts.ts',"'system:setAiSettings'",'loopback HTTP 허용; timeout 5~30초',0),
('session','src/main/auth/SessionManager.ts','let current','PublicUser Main 메모리 세션; DB 테이블 없음',1),
('auth',A,"if (channel === 'auth:login')",'scrypt 검증 후 Main 세션 저장',16),
('permit',A,'const requireUser','로그인·역할 검사',1),
('route',A,'if (usabilityChannels.has','Main 내부 업무 모듈 dispatcher',2),
('signup',A,"if (channel === 'admin:approveSignup')",'ADMIN 가입 승인과 사용자 생성',13),
('ops',A,"if (channel === 'operations:create')",'체계와 운용 이력 SQL transaction',0),
('list',A,"if (channel === 'incidents:list')",'USER 본인 접수 필터',0),
('create',A,"if (channel === 'incidents:create')",'접수·SLA·event·audit·intake snapshot 저장',1),
('status',A,"if (channel === 'incidents:updateStatus')",'담당·상태전이·결과·사용자 확인 검사',0),
('apply',A,"if (channel === 'incidents:applyAi')",'ADMIN/OPERATOR 검토 후 업무·AI 이력 반영',0),
('assign',SV+'IncidentAssignmentService.ts','export function assignIncidentTeam','조치부서/담당 소속 검사와 요청부서 보존',72),
('workflow',SV+'Workflow.ts','export const incidentTransitions','분류·배정·원격/현장·검증·종결 및 보류/취소',22),
('maint',A,"if (channel === 'maintenance:updateStatus')",'완료 전에 필수 체크리스트 검사',0),
('usability',SV+'UsabilityService.ts','export function runUsability','실용 기능 dispatcher',0),
('access',SV+'UsabilityService.ts','export function taskAccess','USER 상세 차단, 정비 담당 범위',20),
('mine',SV+'UsabilityService.ts',"if (channel === 'work:mine')",'기존 업무 테이블 조회·조합',30),
('input',SV+'UsabilityService.ts',"if (channel === 'input:inspect')",'결정적 로컬 규칙, 외부 전송 false',12),
('check',SV+'UsabilityService.ts','export function checklistProblems','체크리스트 필수·NA 사유 검사',18),
('preview',SV+'UsabilityService.ts','function preview(','규칙 버전·담당·기존 회차·마감·과거 조회',25),
('generate',SV+'UsabilityService.ts',"if (channel === 'recurring:generate')",'재검증·중복 skip·회차 순차 생성 transaction',44),
('control',SV+'OperationalControlService.ts','export async function runOperationalChannel','상황경보·계획·정합성·마감·인수인계',0),
('close',SV+'OperationalControlService.ts',"if (channel === 'control:closeDay')",'ADMIN 수동 마감·예외·집계 snapshot',14),
('duty',A,"if (channel === 'duty:create')",'다중 담당자를 개별 duty_roster 행으로 저장',0),
('directive',A,"if (channel === 'directives:acknowledge')",'지시 확인 이력',0),
('org',SV+'OrganizationService.ts','export function listActionDepartments','조직과 조치부서 mapping',0),
('contacts',DB+'organizationContacts.ts','export function seedOrganizationContacts','빈 인증정보의 가상 명부 생성',35),
('connect',DB+'connection.ts','export const dbPath','DB/seed 경로·최초 복사·WAL·migration·seed',13),
('schema',DB+'migrate.ts','export const SCHEMA_VERSION','현재 schema 8',0),
('migration',DB+'migrate.ts','export function migrate(','부족한 v1~v8 순차 transaction',15),
('seed',DB+'seed.ts','export function seed','seed 조건 및 가상 데이터 보충',9),
('orm','src/main/repositories/DashboardRepository.ts','constructor(private db','Drizzle count와 직접 SQL 혼용',27),
('ddl',DB+'migrate.ts','CREATE TABLE IF NOT EXISTS users','v1~v5 실제 SQL DDL',12),
('ddl6',DB+'usabilityMigration.ts','CREATE TABLE work_templates','snapshot·체크리스트·반복 실제 FK',5),
('ddl7',DB+'organizationMigration.ts','CREATE TABLE IF NOT EXISTS organization_units','조직/조치부서 FK',8),
('ddl8',DB+'organizationContacts.ts','CREATE TABLE IF NOT EXISTS organization_members','명부 PK/FK 및 unique 부대/slot',4),
('attach',SV+'AttachmentService.ts','export async function runAttachmentChannel','native dialog→파일·metadata 저장',0),
('attachstore',SV+'AttachmentStore.ts','export function importAttachments','원본 복사·해시·DB metadata·실패시 복사본 정리',0),
('backup',A,'export async function backup','DB backup + 첨부 복사, 최신 10개 보존',0),
('csv',A,"if (channel === 'reports:exportCsv')",'전체 업무 CSV를 로컬 저장',0),
('pdf',A,"if (channel === 'reports:exportPdf')",'당일 고장 SQL→HTML→printToPDF→저장',5),
('reports',A,"if (channel === 'reports:daily')",'일별 상태/주별 날짜 건수',1),
('manual',SV+'ManualService.ts','export async function saveManual','번들 PDF 검증 후 선택 경로 복사',30),
('runtime',A,'const aiRuntime','요청 시 Factory/Orchestrator 생성',0),
('record',A,'const recordAiRun','선택/실제 Provider, model, tokens, latency, fallback, 전송 flag',0),
('limit',A,'const externalRequestCount','KST 외부전송 flag 행 수 한도',1),
('triage',A,"if (channel === 'ai:triageIncident')",'권한→입력 조합→한도→Orchestrator→이력',0),
('daily',A,"if (channel === 'ai:dailySummary')",'DB 집계 입력만 일일 요약에 제공',0),
('sla',A,"if (channel === 'ai:slaRisk')",'SLA/작업량/평균 조치시간의 결정적 위험도',0),
('factory',AI+'AIProviderFactory.ts','create():AIProvider','Provider 선택·외부 활성화/동의/credential',9),
('orchestrator',AI+'AIOrchestrator.ts','async execute','시도당 timeout·조건부 retry 최대2회·LOCAL fallback',14),
('contract',AI+'AIProvider.ts','export interface AIProvider','업무 기능 Provider 계약',8),
('prompt',AI+'PromptCatalog.ts','export const promptCatalog','기능별 version·system·JSON schema·token 제한',0),
('guard',AI+'ExternalDataGuard.ts','const patterns','패턴 마스킹·길이·후보 개수·허용 ID',6),
('usage',AI+'AIUsagePolicy.ts','export function assertDailyRequestLimit','일일 외부 요청 한도',0),
('secret',AI+'AISecretStore.ts','export class AISecretStore','환경변수 우선·safeStorage 암호문·상태 반환',12),
('safeerr',AI+'ProviderSupport.ts','export function safeProviderError','안전한 오류·retry 분류·출력 검증',2),
('openai',AI+'OpenAIProvider.ts','private async generate','SDK Responses/strict json_schema/store:false/Zod',13),
('anthropic',AI+'AnthropicProvider.ts','private async generate','SDK Messages/output_config/Zod',15),
('ollama',AI+'OllamaProvider.ts','private async generate','별도 HTTP api/generate·timeout·Zod',12),
('local',AI+'LocalRuleProvider.ts','export class LocalRuleProvider','기본 결정적 규칙, 생성형 LLM 아님',0),
('aiset',A,"if (channel === 'system:getAiSettings')",'ADMIN 상태·설정·Key 저장/삭제·연결시험',4),
('uimain',UI+'main.tsx','pretendard','React 진입 및 Pretendard',0),
('uiapp',UI+'App.tsx','export default function App','useState 인증 + HashRouter',0),
('nav',UI+'App.tsx','const navGroups','실제 메뉴 묶음',4),
('routes',UI+'App.tsx','<Route path="/"','11개 route 및 ADMIN guard',12),
('call',UI+'usabilityApi.ts','export async function invoke','Result 실패를 Error로 변환',8),
('refresh',UI+'IncidentsManagement.tsx','const refresh =','목록 재조회 후 setRows',0),
('uisave',UI+'IncidentsManagement.tsx','const save=','저장/배정/상태변경 후 재조회',5),
('uiapply',UI+'IncidentsManagement.tsx','const applyAi=','사람 버튼→incidents:applyAi',0),
('uirec',UI+'RecurringMaintenance.tsx',"'recurring:preview'",'반복 회차 미리보기 요청',0),
('uicheck',UI+'TaskChecklistPanel.tsx',"'checklist:get'",'체크리스트/템플릿 초기 동시조회',1),
('uiinput',UI+'InputAssist.tsx','missingQuestions','Renderer 로컬 입력보완과 명시적 AI 요청 구분',0),
('uiwork',UI+'MyWork.tsx',"'work:mine'",'내 업무 및 원래 업무 상세 이동',0),
('uimaint',UI+'MaintenanceManagement.tsx','FullCalendar','달력·상세·반복·체크리스트',0),
('uicontrol',UI+'ControlCenterManagement.tsx','const canControl','화면 조작 역할 구분',0),
('uiduty',UI+'DutyManagement.tsx','const editable','근무·지시 UI 조작 역할',1),
('uiops',UI+'OperationsManagement.tsx',"from 'recharts'",'운용 이력 차트',0),
('uireport',UI+'ReportsManagement.tsx',"from 'recharts'",'일/주 통계 차트',0),
('uiai',UI+'AiManagement.tsx','Promise.all','분류/유사고장 동시 요청; 나머지 버튼',0),
('uikey',UI+'SystemManagement.tsx','type="password"','입력 순간 Renderer에 Key 있음, 저장된 Key 상태와 구분',0),
('package','package.json','"version"','소스 패키지 1.0.1, 실행중 버전 단정 없음',0),
('build','package.json','"build"','seed build 후 electron-vite build',0),
('builder','electron-builder.yml','extraResources:','seed/매뉴얼 extraResources + native asarUnpack',9),
('platform','electron-builder.yml','win:','Windows NSIS x64/macOS DMG·ZIP 설정',23),
('vite','electron.vite.config.ts','export default defineConfig','Main/Preload/Renderer 빌드',4),
('ci','.github/workflows/macos-build.yml','build-and-test:','macOS arm64/x64 CI 설정',11),
('citest','.github/workflows/macos-build.yml','- name: Static checks and tests','정적/단위/E2E/패키징 검증 설정',45),
('testlaunch','tests/e2e/electron-launch.mjs','OMNIS_E2E_DATA','격리 E2E profile',0),
('testai','tests/unit/external-ai.test.ts','import','mock AI 시험 소스, 이번 실행 아님',0),
('testuse','tests/integration/usability.test.ts','import','실용기능 통합 시험 소스, 이번 실행 아님',0)]
# Resolve against observed source names; no speculative evidence.
if 'export function importAttachments' not in read(SV+'AttachmentStore.ts'):
 specs=[(k,p,'export function storeAttachmentPaths' if k=='attachstore' else n,m,s) for k,p,n,m,s in specs]
for sp in specs: ref(*sp)
dump('source/source-refs.json',refs)
print('sourceRefs',len(refs))

nodes=[]
def node(id,label,kind,parent,resp,tech,keys,impl='구현',verify='소스 확인'):
 nodes.append(dict(id=id,label=label,kind=kind,parentBoundary=parent,responsibilities=resp,actualTechnologies=tech.split('|') if tech else [],implementationStatus=impl,verificationStatus=verify,sourceRefs=[R[k] for k in keys.split()]))
node('PC','사용자 PC','boundary',None,'앱·로컬 파일·선택형 Ollama 실행 호스트','','startup')
node('APP','Electron 애플리케이션','boundary','PC','로컬 단일 애플리케이션','Electron','window ready')
node('R','React Renderer','ui','APP','화면·입력·목록/상세·명시적 재조회','React|TypeScript|MUI/DataGrid|Pretendard|HashRouter|Recharts|FullCalendar','uiapp uimain routes refresh')
node('P','Preload bridge','bridge','APP','window.omnis 공개·IPC 호출 전달','contextBridge|ipcRenderer.invoke','preload')
node('M','Main 업무 처리','boundary','APP','IPC·권한·업무·저장·AI 실행','Electron|TypeScript','ipc route')
node('G','IPC 검증·접근 검사','security','M','mainFrame·Zod·로그인·역할·업무 대상 검사','ipcMain.handle|Zod|electron-log','ipc permit access')
node('AUTH','인증·Main 세션','security','M','비밀번호 해시 검증·PublicUser 메모리 세션','scrypt|timingSafeEqual|SessionManager','auth session')
node('S','AppService','service','M','채널 분기·직접 SQL·보고서·백업·AI 조합','better-sqlite3|Node fs','route ops create')
node('W','고장·정비 업무','service','M','접수·배정·전이·결과·감사','AppService|Workflow|IncidentAssignmentService','create assign workflow maint')
node('U','실용 기능 5종','service','M','템플릿·내 업무·체크리스트·반복·입력 점검','UsabilityService|shared/usability','usability mine generate input')
node('C','통제·조직·근무','service','M','경보·계획·정합성·마감·인수인계·명부·지시','OperationalControlService|OrganizationService|AppService','control org duty directive')
node('DASH','상황판 조회 Repository','repository','M','Drizzle count와 직접 SQL 집계·조인','Drizzle ORM|better-sqlite3','orm')
node('DB','SQLite 사용자 DB','storage','PC','data/omnis.db·WAL·schema 8','SQLite|better-sqlite3','connect migration schema')
node('FILE','첨부 원본 파일','storage','PC','userData/attachments, DB는 metadata/hash','Node fs|AttachmentStore','attach attachstore')
node('BACK','DB·첨부 백업본','storage','PC','userData/backups, 최신10개; 시작시 날짜 marker 조건','SQLite backup API|Node fs','backup ready')
node('SEED','배포 seed DB','storage','APP','resources/db/omnis-seed.db, 사용자 DB 없을 때 최초 복사','','connect builder')
node('MANUAL','번들 역할별 PDF','storage','APP','resources/manuals, 로그인 사용자가 열기/복사','','manual builder')
node('EXPORT','보고서 PDF·CSV','file','PC','DB 조회 결과를 선택 경로에 생성','printToPDF|UTF-8 BOM CSV','pdf csv reports')
node('AI','선택형 AI 업무 지원','ai','M','계약·입력 보호·Provider·검증·이력','AIProvider|Factory|Orchestrator|PromptCatalog','contract factory orchestrator prompt')
node('F','AIProviderFactory','ai','M','Provider 선택·외부 활성화·동의·자격정보','','factory')
node('O','AIOrchestrator','ai','M','시도당 timeout·조건부 retry·LOCAL fallback·실행 기록','','orchestrator')
node('PROMPT','PromptCatalog','ai','M','기능별 version/system/JSON schema/token 제한','Zod','prompt')
node('GUARD','ExternalDataGuard','security','M','입력 최소화·패턴 마스킹·허용 후보 ID','','guard')
node('LIMIT','AIUsagePolicy','security','M','KST 외부전송 flag 행 수 기반 일일 한도','ai_runs','usage limit')
node('SECRET','AISecretStore','security','M','환경변수 우선·OS 암호화·상태 응답','Electron safeStorage','secret aiset')
node('KEYFILE','암호화 자격정보 파일','storage','PC','secrets/ai-credentials.json, 평문 DB 저장 없음','safeStorage ciphertext','secret')
node('LOCAL','LOCAL 규칙','ai','M','기본 결정적 규칙; 생성형 LLM 아님','LocalRuleProvider','local factory')
node('OLLAMA','Ollama 별도 프로세스','ai','PC','별도 설치·기동·모델 준비, loopback HTTP','/api/generate','ollama ollamaurl',verify='소스 확인; 설치·응답 미검증')
node('NET','인터넷 서비스','boundary',None,'인터넷 외부 AI 서비스','','openai anthropic')
node('OPENAI','OpenAI 서비스','external','NET','Main 공식 SDK Responses 요청','openai SDK','openai',verify='소스 확인; 실제 외부 호출 미검증')
node('ANTHROPIC','Anthropic 서비스','external','NET','Main 공식 SDK Messages 요청','Anthropic SDK','anthropic',verify='소스 확인; 실제 외부 호출 미검증')
node('REVIEW','담당자 검토·명시적 반영','ui','R','추천 확인 후 incidents:applyAi 호출','','uiapply apply')
node('DEV','개발·검증','build',None,'소스·정적검사·단위/통합·Electron E2E','Node.js|pnpm|TypeScript|ESLint|Vitest|Playwright','build testai testuse testlaunch')
node('BUNDLE','Main·Preload·Renderer 번들','build',None,'out/main·out/preload·out/renderer','electron-vite|Vite','vite build')
node('PKG','설치 패키지 설정','build',None,'Windows NSIS x64 / macOS DMG·ZIP arm64·x64','electron-builder','builder platform ci','설정만 있음','소스 확인; 현재 HEAD 패키징 시험 미검증')
node('STORE','로컬 파일 보존','storage','PC','첨부 원본·백업·암호화 자격정보 파일의 발표용 묶음; 별도 서비스 아님','','attachstore backup secret')
node('VALIDATE','결과 검증 · 이력','ai','M','Provider 내부 출력 검사와 Orchestrator 실행 기록의 발표용 묶음','Zod|ProviderSupport|AIOrchestrator','guard openai anthropic record orchestrator')
node('AUTH_UI','인증·가입 흐름','ui','R','로그인·가입 신청·승인 후 계정 사용','','auth signup')
node('SOURCE','소스 · 개발환경','build',None,'소스 및 Node.js/pnpm 개발환경','Node.js|pnpm','package build')
node('TEST','정적 검사 · 시험','build',None,'정적/단위/통합/Electron E2E 구성','TypeScript|ESLint|Vitest|Playwright','citest testai testuse testlaunch')
node('TARGET','플랫폼별 패키지','build',None,'Windows NSIS x64, macOS DMG/ZIP arm64/x64 구성','','platform ci','설정만 있음','소스 확인; 현 HEAD 성공 미검증')
for item in nodes:
 if item['id']=='BUNDLE':item['label']='3개 영역 번들'
 if item['id']=='PKG':item['label']='electron-builder'
 if item['id'] in ['FILE','BACK','KEYFILE']:item['parentBoundary']='STORE'
edges=[]
def edge(id,a,b,label,transport,keys,condition=None,dc='업무 데이터'):
 edges.append(dict(id=id,**{'from':a,'to':b},label=label,transport=transport,dataClass=dc,direction='forward',condition=condition,sourceRefs=[R[k] for k in keys.split()]))
edge('E01','R','P','채널·payload','window.omnis','call preload')
edge('E02','P','G','invoke(channel,payload)','Electron IPC','preload ipc')
edge('E03','G','S','검증된 payload','동일 Main 함수','ipc route')
edge('E04','S','AUTH','로그인·역할 확인','메모리 함수','permit session')
edge('E05','S','W','고장·정비 채널','분기/함수','create assign maint')
edge('E06','S','U','실용 기능 채널','함수','route usability')
edge('E07','S','C','통제·조직·근무 채널','분기/함수','route org duty')
edge('E08','S','DASH','상황판 조회','Repository 함수','orm')
edge('E09','W','DB','SQL 조회·transaction 갱신','SQLite native','create assign maint')
edge('E10','U','DB','snapshot·회차 PK·내 업무 조회','SQLite native','mine generate ddl6')
edge('E11','C','DB','계획·마감·명부 SQL','SQLite native','close contacts directive')
edge('E12','DASH','DB','count·조인·집계','SQLite native','orm')
edge('E13','DB','S','쿼리 행·갱신 결과','native 戻り値','list orm')
edge('E14','S','P','Result {ok,data/error}','Electron IPC 응답','ipc preload')
edge('E15','P','R','Promise → state·재조회','bridge 반환','uisave call refresh')
edge('E16','S','FILE','선택 파일 복사·열기','로컬 파일 I/O','attach attachstore')
edge('E17','S','BACK','DB backup + 첨부 복사','로컬 파일 I/O','backup ready','날짜 marker 없음 / 관리자 요청')
edge('E18','SEED','DB','최초 DB 복사','로컬 파일 I/O','connect','사용자 DB 없고 seed 존재')
edge('E19','MANUAL','EXPORT','기존 PDF 열기·복사','native dialog + fs','manual','로그인 사용자 선택',dc='번들 PDF')
edge('E20','S','EXPORT','SQL → PDF/CSV 생성','printToPDF / fs','pdf csv','명시적 내보내기')
edge('E21','S','AI','분석용 업무 입력','동일 Main 함수','triage daily','사용자 요청')
edge('E22','AI','F','설정별 Provider 생성','함수','runtime factory')
edge('E23','AI','O','primary/fallback 실행','함수','runtime orchestrator')
edge('E24','F','SECRET','credential 조회','Main 내부','factory secret','외부 활성화·동의 통과',dc='자격정보')
edge('E25','SECRET','KEYFILE','OS 암호문 읽기/쓰기','로컬 파일 I/O','secret','환경변수 없을 때 조회 / 관리자 저장·삭제',dc='암호문')
edge('E26','O','LIMIT','매 primary 시도 한도 검사','함수','limit usage triage','외부 Provider')
edge('E27','O','GUARD','입력 최소화·마스킹','각 Provider 내부 함수','guard openai anthropic ollama','비 LOCAL Provider')
edge('E28','PROMPT','AI','system·schema·version','import/함수','prompt openai ollama')
edge('E29','O','LOCAL','기본 / 실패 fallback','동일 Main 함수','orchestrator local')
edge('E30','AI','OLLAMA','JSON prompt / 구조화 응답','loopback HTTP','ollama ollamaurl','선택·별도 설치·모델 준비')
edge('E31','AI','OPENAI','Responses JSON Schema','HTTPS / 공식 SDK','factory openai guard','선택·활성화·동의·credential·한도')
edge('E32','AI','ANTHROPIC','Messages JSON Schema','HTTPS / 공식 SDK','factory anthropic guard','선택·활성화·동의·credential·한도')
edge('E33','AI','DB','ai_runs 결과·usage','SQL INSERT','record orchestrator')
edge('E34','AI','REVIEW','검증 추천·근거·fallback','IPC 응답','openai anthropic uiapply')
edge('E35','REVIEW','W','incidents:applyAi','IPC → Main','uiapply apply','ADMIN/OPERATOR 검토 버튼')
edge('E36','DEV','BUNDLE','seed 생성·3영역 build','로컬 빌드','build vite',dc='프로그램')
edge('E37','BUNDLE','PKG','번들·native·resources','패키징','builder platform',dc='프로그램')
edge('E38','PKG','PC','NSIS / DMG·ZIP 구성','설치','platform ci','현재 HEAD 설치·CI 성공 미검증',dc='프로그램')
edge('E39','SOURCE','TEST','정적/단위/통합/E2E 검사','로컬 개발 도구','citest testai testuse','설정 경로; 이번 앱 시험 미실행',dc='프로그램')
edge('E40','TEST','BUNDLE','검사 후 build','로컬 빌드','citest build vite','CI 또는 개발자 명시 실행',dc='프로그램')
edge('E41','PKG','TARGET','플랫폼별 설치 패키지 구성','패키징','platform ci','이번 재패키징 미실행',dc='프로그램')
edge('E42','TARGET','PC','설치 구성','설치','platform','현 HEAD 신규PC 설치 미검증',dc='프로그램')
edge('E43','AI','VALIDATE','선택 Provider 출력·실행 metadata','동일 Main 호출','openai anthropic ollama orchestrator')
edge('E44','VALIDATE','REVIEW','검증 추천·이력 metadata','IPC 응답','uiapply openai anthropic record')
UIrows=[]
def screen(route,name,features,services,keys,roles=None,note='로그인 후 route 접근; 쓰기 권한은 Main에서 별도 검사'):
 UIrows.append(dict(route=route,screenName=name,roles=roles or ['ADMIN','OPERATOR','MAINTAINER','USER','VIEWER'],featureIds=features.split('|'),relatedServiceIds=services.split(),sourceRefs=[R[k] for k in keys.split()],accessNotes=note))
screen('/','통합상황판','집계·목록/상세 이동|F2 내 업무','DASH U','routes orm uiwork')
screen('/operations','운영현황','체계 상태·운용률·이력','S','routes uiops ops')
screen('/incidents','고장관리','접수·분류·배정·원격/현장·검증·종결|긴급 선조치 사후기록|F1 접수 템플릿|F5 입력 보완','W U AI','uisave workflow uiinput')
screen('/maintenance','정비관리','계획/비계획·일정·상태·결과·달력|F3 체크리스트|F4 반복 정비','W U','uimaint maint generate')
screen('/control','통제·일일마감','경보|08:30 계획 / 16:00 대조|정합성·수동 마감·인수인계','C','uicontrol control close')
screen('/duty','근무/지시사항','조직별 가상 명부|다중 담당자 편성|확인/이행','C','uiduty contacts duty directive')
screen('/ai','AI 지원','분류·질문·요약·유사 고장·정비 추천·이력|F5 입력 보완','AI U','uiai triage daily',note='route 모두 접근. USER의 요약/추천/이력, VIEWER 분류는 Main에서 거부')
screen('/reports','보고서/통계','일별 상태·주별 건수|전체 CSV / 당일 고장 PDF','S','uireport reports pdf')
screen('/signups','사용자 신청현황','가입 승인·반려','AUTH S','routes signup',roles=['ADMIN'])
screen('/settings','시스템관리','AI 설정/Key·감사·백업|템플릿·조치부서 관리','S U C','routes aiset backup',roles=['ADMIN'])
screen('/manuals','사용자 매뉴얼','5개 역할 매뉴얼 열기/다운로드','S','routes manual')
# Replay current literal migration SQL in SQLite memory: schema evidence, not an app integration test.
db=sqlite3.connect(':memory:');db.execute('PRAGMA foreign_keys=ON'); ms=read(DB+'migrate.ts')
for name in ['migrateV1','migrateV2','migrateV3','migrateV4','migrateV5']:
 sql=re.search(r'db\.exec\(`(.*?)`\)',ms[ms.index('function '+name+'('):],re.S).group(1)
 assert '${' not in sql;db.executescript(sql)
for f in ['usabilityMigration.ts','organizationMigration.ts','organizationContacts.ts']:
 sql=re.search(r'db\.exec\(`(.*?)`\)',read(DB+f),re.S).group(1);db.executescript(sql)
db.execute('PRAGMA user_version=8')
tables=[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
entities=[];fields=[];relations=[]
for name in tables:
 cols=[dict(zip(['cid','name','type','notNull','default','pk'],row)) for row in db.execute(f'PRAGMA table_info({name})')]
 indexes=[dict(name=row[1],unique=bool(row[2]),columns=[v[2] for v in db.execute(f'PRAGMA index_info("{row[1]}")')]) for row in db.execute(f'PRAGMA index_list({name})')]
 fk=[]
 for row in db.execute(f'PRAGMA foreign_key_list({name})'):
  unique=any(ix['unique'] and ix['columns']==[row[3]] for ix in indexes)
  rel=dict(fromTable=name,fromColumn=row[3],toTable=row[2],toColumn=row[4],kind='FK',onDelete=row[6],parentToChildCardinality='1:0..1' if unique else '1:N')
  fk.append(rel);relations.append(rel)
 fp=DB+('usabilityMigration.ts' if name in ['work_templates','incident_intakes','task_checklists','recurring_rules','recurring_occurrences'] else 'organizationMigration.ts' if name in ['organization_units','team_organizations'] else 'organizationContacts.ts' if name=='organization_members' else 'migrate.ts')
 needle=next(l.strip()[:110] for l in read(fp).splitlines() if re.search('CREATE TABLE (?:IF NOT EXISTS )?'+name+r'\b',l))
 ref('table_'+name,fp,needle,'실제 DDL: '+name)
 entities.append(dict(id='T:'+name,table=name,keyFields=[c['name'] for c in cols if c['pk']],columns=cols,indexes=indexes,verifiedRelationships=fk,ownerModule='UsabilityService' if fp.endswith('usabilityMigration.ts') else 'Organization' if 'organization' in fp else 'AppService/OperationalControlService',sourceRefs=[R['table_'+name]]))
 for c in cols:fields.append(dict(table=name,field=c['name'],type=c['type'],required=c['notNull'],primaryKeyOrder=c['pk'],default=c['default'],FK='; '.join(f"{x['toTable']}.{x['toColumn']}" for x in fk if x['fromColumn']==c['name'])))
logical=[dict(fromTable='incidents',fromColumn='team_id',toTable='maintenance_teams',toColumn='id',kind='service-managed',sourceRefs=[R['assign']]),dict(fromTable='attachments',fromColumn='entity_type/entity_id',toTable='incidents|maintenance_tasks',toColumn='id',kind='polymorphic-service-managed',sourceRefs=[R['attachstore']]),dict(fromTable='ai_runs',fromColumn='entity_type/entity_id',toTable='incidents',toColumn='id',kind='service-managed-optional',sourceRefs=[R['apply']]),dict(fromTable='reconciliation_results',fromColumn='entity_type/entity_id',toTable='incidents|maintenance_tasks|maintenance_daily_plans',toColumn='id',kind='polymorphic-service-managed',sourceRefs=[R['control']])]
for rel in logical: next(e for e in entities if e['table']==rel['fromTable'])['verifiedRelationships'].append(rel)
for filename,ks,owner in [('userData/attachments','attachstore','AttachmentStore'),('userData/backups','backup','AppService'),('userData/secrets/ai-credentials.json','secret','AISecretStore'),('resources/db/omnis-seed.db','connect builder','build/connection'),('resources/manuals/*.pdf','manual builder','ManualService'),('PublicUser (Main memory)','session','SessionManager')]:
 entities.append(dict(file=filename,keyFields=[],verifiedRelationships=[],ownerModule=owner,sourceRefs=[R[k] for k in ks.split()]))
seed={}; seedpath=ROOT/'resources/db/omnis-seed.db'
if seedpath.exists():
 s=sqlite3.connect(seedpath.as_uri()+'?mode=ro',uri=True)
 seed=dict(path='resources/db/omnis-seed.db',readMode='readonly',schemaVersion=s.execute('PRAGMA user_version').fetchone()[0],tableCounts={n:s.execute(f'SELECT count(*) FROM {n}').fetchone()[0] for n in tables if s.execute('SELECT name FROM sqlite_master WHERE name=?',(n,)).fetchone()});s.close()
dump('evidence/schema-probe.json',dict(method='Current literal migration SQL replay in Python SQLite memory; NOT Node/Electron migration integration test',tables=len(tables),foreignKeys=len(relations),pythonSQLiteVersion=sqlite3.sqlite_version,foreignKeyCheck=db.execute('PRAGMA foreign_key_check').fetchall(),seed=seed))
csvwrite('evidence/전체테이블_필드사전.csv',fields);dump('evidence/실제FK와논리관계.json',dict(actualForeignKeys=relations,logicalRelationships=logical))
# Interpret importer versions separately from requested package ranges.
pkg=json.loads(read('package.json'));lock=read('pnpm-lock.yaml').split('\npackages:')[0];versions=[]
for name,requested in (pkg['dependencies']|pkg['devDependencies']).items():
 m=re.search(r'^      [\'\"]?'+re.escape(name)+r'[\'\"]?:\n        specifier: (.*?)\n        version: (.*)$',lock,re.M)
 imports=[]
 for p in (ROOT/'src').rglob('*'):
  if p.suffix in ['.ts','.tsx','.css'] and re.search(r'(?:from\s*[\'\"]|import\s*[\'\"])'+re.escape(name)+r'(?:[\'\"]|/)',p.read_text(encoding='utf8')):imports.append(p.relative_to(ROOT).as_posix())
 versions.append(dict(technology=name,packageRange=requested,lockResolved=m.group(2).split('(')[0] if m else '확인 필요',actualRole=('src import: '+', '.join(imports[:4])) if imports else 'src 직접 import 미확인; 개발·시험 용도는 설정/시험 파일 별도 확인',sourceImports=imports))
rolemap={'react':'Renderer의 useState/useEffect/useRef 및 JSX 화면','react-router-dom':'HashRouter·Route·Navigate·검색 파라미터로 메뉴/상세 이동','typescript':'타입 계약 및 tsc --noEmit 정적 검사 (package scripts)','electron':'Main/Preload/BrowserWindow·IPC·safeStorage·native dialog','electron-vite':'Main/Preload/Renderer 개발·번들링','vite':'electron-vite Renderer 개발/번들 기반, 포트 명시 없음','electron-builder':'NSIS/DMG/ZIP 및 native dependency packaging','vitest':'tests/unit·integration 시험 소스 (이번 미실행)','playwright':'tests/e2e의 Electron/UI 자동화 소스 (이번 미실행)','drizzle-orm':'schema.ts 선언, DashboardRepository의 count 쿼리; 나머지는 주로 직접 SQL','drizzle-kit':'db:generate 설정; runtime migration은 자체 migrate.ts SQL','better-sqlite3':'Main의 동기 native SQLite/transaction/backup 직접 SQL','electron-log':'Main 시작/IPC 오류 기록','zod':'IPC payload 및 비결정적 AI 결과 검증','@tanstack/react-query':'설치됨; src import/사용 미확인, 화면 캐시 계층으로 배치하지 않음','zustand':'설치됨; src import/사용 미확인','react-hook-form':'설치됨; src import/사용 미확인','@hookform/resolvers':'설치됨; src import/사용 미확인'}
for item in versions:
 if item['technology'] in rolemap:item['actualRole']=rolemap[item['technology']]
csvwrite('evidence/기술스택_사용범위.csv',[{k:v for k,v in t.items() if k!='sourceImports'} for t in versions])
flows=[]
def flow(fid,step,a,b,payload,mode,ks): flows.append(dict(flowId=fid,step=step,fromId=a,toId=b,payload=payload,execution=mode,sourceRefs=[R[k] for k in ks.split()]))
flow('F01',1,'R','P','폼·템플릿 답변 → incidents:create','버튼 비동기 호출','uisave preload')
flow('F01',2,'P','G','invoke payload → frame/Zod 검사','IPC invoke/handle','ipc preload')
flow('F01',3,'G','W','로그인·ADMIN/OPERATOR/USER 검사','순차','permit create')
flow('F01',4,'W','DB','incidents + event + audit + intake + 조건부 알림','동기 SQL transaction','create')
flow('F01',5,'S','R','Result → 폼 닫기 → incidents:list → setRows','순차 재조회','uisave refresh call')
flow('F02',1,'R','W','incidents:assignTeam teamId/userId','IPC→서비스','uisave assign')
flow('F02',2,'W','DB','부서 가용·담당 소속 확인→배정·이벤트·감사','transaction','assign')
flow('F02',3,'R','W','updateStatus: 원격/현장→RESOLVED→VERIFIED→CLOSED','각각 별도 사용자 호출','workflow status')
flow('F02',4,'W','DB','담당·전이·원인/결과·사용자 확인→갱신','transaction; 실물 확인 자동화 아님','status')
flow('F02',5,'S','R','Result → 상세/목록 재조회','순차','uisave')
flow('F03',1,'R','U','recurring:preview id/version/from/to','미리보기 버튼','uirec preview')
flow('F03',2,'U','DB','규칙·담당·템플릿·기존회차·마감 조회','순차 SQL','preview')
flow('F03',3,'R','U','dates + version + allowPast → recurring:generate','명시적 생성','generate')
flow('F03',4,'U','DB','재검증·중복 skip·작업/체크리스트/회차 생성','transaction 내 순차 loop; PK(rule_id,date)','generate ddl6')
flow('F03',5,'U','R','created/skipped/batchId→목록 갱신','응답','generate uirec')
flow('F04',1,'R','AI','선택 분석 + 보완 답변→Main에서 입력 조합','명시적 요청','triage uiinput')
flow('F04',2,'F','O','Provider 선택·활성화/동의/credential·각시도 한도','순차; 실패 LOCAL fallback','factory usage triage orchestrator')
flow('F04',3,'AI','OPENAI','마스킹 입력 + JSON schema prompt','선택 Provider 한 곳; Ollama/Anthropic 대안','openai anthropic guard')
flow('F04',4,'AI','DB','Zod·허용 ID·외부 요약 수치 검사→ai_runs','성공/LOCAL fallback 이력','openai anthropic record orchestrator')
flow('F04',5,'AI','REVIEW','추천·근거·실제 Provider·fallback','응답·업무 자동변경 없음','uiapply apply')
flow('F04',6,'REVIEW','W','ADMIN/OPERATOR 검토 버튼 → incidents:applyAi','별도 IPC·transaction','uiapply apply')
for f in flows:
 f['requestPath']=[];f['responsePath']=[]
 if f['fromId'] in ['R','REVIEW'] and f['toId'] in ['W','U','AI']:
  f['requestPath']=[f['fromId'],'P','G','S',f['toId']]
  f['sourceRefs']=list(dict.fromkeys(f['sourceRefs']+[R['preload'],R['ipc'],R['route']]))
 if f['toId'] in ['R','REVIEW']:
  f['responsePath']=[f['fromId'],'S','G','P',f['toId']]
tracked=git('ls-files').splitlines();sourcefiles=[p for p in tracked if p.startswith(('src/','tests/','.github/','scripts/')) or p in ['package.json','pnpm-lock.yaml','electron-builder.yml','electron.vite.config.ts']]
hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sourcefiles if (ROOT/p).is_file()}
model=dict(projectVersion=pkg['version'],schemaVersion=8,gitCommit=git('rev-parse','HEAD'),gitBranch=git('branch','--show-current'),workingTreeChanges=git('status','--porcelain=v1'),trackedChanges=git('diff','--name-status','HEAD'),analyzedAt=datetime.now(timezone(timedelta(hours=9))).isoformat(),timeZone='Asia/Seoul',nodes=nodes,edges=edges,UI=UIrows,dataEntities=entities,sourceRefs=refs,dataFlows=flows,technologies=versions,sourceFingerprints=hashes,legend=dict(solid='현재 호출 또는 실제 FK',dashed='조건부·선택 경로',dotted='FK 없는 서비스 관리 논리 관계',implementationAxis=['구현','설정만 있음','향후 제안'],verificationAxis=['소스 확인','mock 시험','패키징 앱 시험','실제 외부 호출','미검증']))
# Normalize typographic slips in generated metadata.
model=json.loads(json.dumps(model,ensure_ascii=False).replace('native 戻り値','native 반환').replace('접수·분류','접수·분류'))
dump('source/architecture-model.json',model);dump('source/source-refs.json',refs)
RM={x['id']:x for x in refs}
def fmt(ids):return ' | '.join(f"{RM[i]['path']}:{RM[i]['lineStart']}-{RM[i]['lineEnd']} ({RM[i]['meaning']})" for i in ids)
csvwrite('evidence/구성요소_소스근거표.csv',[dict(ID=n['id'],이름=n['label'],책임=n['responsibilities'],실행위치=n['parentBoundary'],실제사용기술=', '.join(n['actualTechnologies']),입력='; '.join(e['label'] for e in edges if e['to']==n['id']),출력='; '.join(e['label'] for e in edges if e['from']==n['id']),소스파일행=fmt(n['sourceRefs']),구현축=n['implementationStatus'],검증축=n['verificationStatus']) for n in nodes])
csvwrite('evidence/데이터흐름_추적표.csv',[dict(흐름=f['flowId'],순서=f['step'],출발=f['fromId'],도착=f['toId'],전달내용=f['payload'],실행방식=f['execution'],공통IPC경로=' → '.join(f['requestPath']),응답경로=' → '.join(f['responsePath']),근거=fmt(f['sourceRefs'])) for f in flows])
csvwrite('evidence/UI_라우트_기능.csv',[dict(route=u['route'],화면=u['screenName'],역할=','.join(u['roles']),기능='; '.join(u['featureIds']),Main모듈=','.join(u['relatedServiceIds']),제약=u['accessNotes'],근거=fmt(u['sourceRefs'])) for u in UIrows])
(OUT/'evidence/source-refs.md').write_text('\n\n'.join(f"{r['id']} {r['path']}:{r['lineStart']}-{r['lineEnd']} — {r['meaning']}\n```ts\n{r['snippet']}\n```" for r in refs),encoding='utf8')
print(json.dumps(dict(nodes=len(nodes),edges=len(edges),refs=len(refs),tables=len(tables),fields=len(fields),seedSchema=seed.get('schemaVersion'),commit=model['gitCommit'],analyzedAt=model['analyzedAt']),ensure_ascii=False))

