from pathlib import Path
from html import escape

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs'/'architecture'
OUT.mkdir(parents=True,exist_ok=True)
C={'ink':'#182344','muted':'#66748D','line':'#D6DDEC','indigo':'#303F91','blue':'#3274CB','teal':'#087F86','purple':'#7655B1','orange':'#BA6A25','bg':'#F5F7FC'}
parts=[]
def add(s): parts.append(s)
def rect(x,y,w,h,fill='#FFFFFF',stroke='#D6DDEC',r=20,dash=None):
 add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>')
def text(x,y,value,size=25,color=None,weight=400):
 add(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{color or C["ink"]}">{escape(value)}</text>')
def lines(x,y,values,size=24,color=None,gap=39):
 for i,v in enumerate(values): text(x,y+i*gap,v,size,color)
def arrow(d,color='#73829D',dashed=False):
 add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="3.5" stroke-linejoin="round" marker-end="url(#arr)"'+(' stroke-dasharray="10 8"' if dashed else '')+'/>')
def label(x,y,v,color='#66748D'):
 w=max(110,len(v)*14+24);rect(x-8,y-25,w,35,'#FFFFFF','#FFFFFF',6);text(x,y,v,20,color,600)
def icon(x,y,kind,color='#303F91',scale=1):
 add(f'<g transform="translate({x} {y}) scale({scale})" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">')
 if kind=='atom':
  for a in [0,60,120]: add(f'<ellipse cx="30" cy="30" rx="30" ry="11" transform="rotate({a} 30 30)"/>')
  add(f'<circle cx="30" cy="30" r="4" fill="{color}" stroke="none"/>')
 elif kind=='db':
  add('<ellipse cx="28" cy="12" rx="25" ry="10"/><path d="M3 12 V48 C3 62 53 62 53 48 V12 M3 30 C3 44 53 44 53 30"/>')
 elif kind=='shield': add('<path d="M28 1 L52 10 V28 C52 44 40 54 28 61 C16 54 4 44 4 28 V10 Z"/><path d="M17 28 L25 36 L41 18"/>')
 elif kind=='user': add(f'<circle cx="29" cy="16" r="13"/><path d="M3 60 C3 26 55 26 55 60 Z" fill="{color}" stroke="none"/>')
 elif kind=='screen': add('<rect x="2" y="4" width="56" height="38" rx="4"/><path d="M20 56 H42 M30 42 V55"/>')
 elif kind=='folder': add('<path d="M2 17 V7 H23 L29 17 H58 V55 H2 Z"/><path d="M2 25 H58"/>')
 elif kind=='chip': add('<rect x="11" y="11" width="38" height="38" rx="7"/><path d="M21 1 V10 M39 1 V10 M21 50 V60 M39 50 V60 M1 21 H10 M1 39 H10 M50 21 H60 M50 39 H60"/><rect x="22" y="22" width="16" height="16" rx="2"/>')
 elif kind=='cloud': add('<path d="M13 47 C-3 47 -3 23 14 23 C12 3 45 0 48 24 C66 22 69 47 51 47 Z"/>')
 elif kind=='box': add('<path d="M3 17 L30 2 L57 17 V48 L30 62 L3 48 Z M3 17 L30 33 L57 17 M30 33 V62"/>')
 add('</g>')
def card(x,y,w,h,title,sub,kind,color):
 rect(x,y,w,h);rect(x+20,y+22,78,78,'#F0F3FA','#F0F3FA',17);icon(x+30,y+30,kind,color,0.95);text(x+116,y+52,title,31,color,750);text(x+116,y+87,sub,16 if w<300 else 21,C['muted']);add(f'<path d="M{x+24} {y+124} H{x+w-24}" stroke="{C["line"]}" stroke-width="2"/>')
def begin(w,h,title,desc):
 parts.clear();add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{escape(title)}"><title>{escape(title)}</title><desc>{escape(desc)}</desc><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#73829D"/></marker></defs><g font-family="Pretendard, Malgun Gothic, Apple SD Gothic Neo, sans-serif">');rect(0,0,w,h,'#FFFFFF','#FFFFFF',0)
def save(name):
 add('</g></svg>');(OUT/f'{name}.svg').write_text('\n'.join(parts),encoding='utf-8')

begin(2800,1850,'OMNIS 시스템 아키텍처','로컬 Electron 데스크톱 앱의 Renderer, Preload IPC, Main 업무 서비스, SQLite, 로컬 파일, 선택형 AI Provider와 개발 및 배포 흐름')
text(70,92,'OMNIS',62,C['indigo'],800);text(335,90,'정보통신 운용·정비 통합체계',43,C['ink'],750)
text(74,143,'SYSTEM ARCHITECTURE  /  로컬 실행 · 업무 데이터 보존 · 사람 검토 후 AI 반영',27,C['muted'])
arrow('M2010 105 H2070');text(2090,114,'로컬 호출 / 데이터 흐름',20,C['muted']);arrow('M2415 105 H2475',dashed=True);text(2495,114,'선택형 연결',20,C['muted'])
rect(50,205,2250,1280,'#F7F9FD','#BFCBE1',32);text(88,260,'사용자 PC  ·  Windows / macOS',30,C['indigo'],750);text(1220,260,'업무 기본 경로는 인터넷·API Key 없이 실행',25,C['teal'],600)
rect(90,395,215,300);icon(167,420,'user',C['indigo'],0.9);text(126,520,'사용자',31,C['indigo'],750)
lines(115,566,['관리자 · 통제','정비 담당자','요청자 · 조회자'],24,C['muted'],44)
rect(350,305,1870,775,'#EEF2FA','#BBC9E2',26);icon(380,322,'atom',C['purple'],0.58);text(430,350,'Electron 44 · OMNIS Desktop Application',30,C['indigo'],750)
card(395,390,450,590,'Renderer','React 19 · TypeScript · MUI','atom','#1497B5')
lines(425,558,['통합상황판 · 내 업무','운용현황 · 고장 접수','정비 · 반복 일정 · 점검표','근무 / 지시 · 보고서','AI 지원 · 시스템관리'],26,C['ink'],51)
rect(420,825,400,116,'#F3F7FD','#E0E7F2',12);lines(440,862,['화면 입력 · 미리보기 · 상세 이동','업무 확정은 담당자가 직접 수행'],22,C['muted'],37)
card(910,505,270,350,'Preload','격리된 연결 경계','shield',C['indigo'])
lines(936,678,['contextBridge','Typed IPC','ipcRenderer'],25,C['ink'],47)
text(925,902,'Node / DB 직접 접근 차단',19,C['muted'],600)
card(1245,390,920,590,'Main Process','Electron · Node.js · 신뢰 경계 안에서 처리','chip',C['indigo'])
rect(1272,540,865,139,'#F7F9FD','#E2E8F2',13);text(1292,576,'인증 · 권한 · 업무 서비스',26,C['indigo'],700);lines(1292,615,['SessionManager · scrypt · Zod 입력 검증 · 역할 / 소유권 검사','AppService · OperationalControlService · UsabilityService'],23,C['muted'],37)
rect(1272,704,865,232,'#F1F0FA','#D8D4ED',13);text(1292,745,'AI 실행 제어',27,C['purple'],700);lines(1292,788,['AIProviderFactory → AIOrchestrator','PromptCatalog · JSON Schema · Zod 결과 검증','최소 입력 / 마스킹 · timeout / retry · 일일 요청 한도','실행 이력 기록 · 실패 시 Local Rule fallback'],24,C['ink'],39)
arrow('M305 550 H385');label(310,526,'입력')
arrow('M845 660 H900');arrow('M1180 660 H1235');label(905,477,'IPC 요청 / 응답')
text(420,1035,'보안 설정: contextIsolation=true   ·   nodeIntegration=false   ·   sandbox=true',24,C['indigo'],600)
card(395,1150,1040,260,'로컬 영속 저장소','app.getPath("userData") · 설치 폴더와 분리','db',C['teal'])
icon(425,1300,'db',C['teal'],0.62);lines(480,1309,['SQLite / better-sqlite3','Drizzle 정의 · DB v6'],23,C['ink'],37)
icon(820,1300,'folder',C['blue'],0.65);lines(872,1309,['첨부자료 · 백업','SHA-256 · 파일 보존'],23,C['ink'],37)
icon(1140,1300,'shield',C['purple'],0.65);lines(1190,1309,['safeStorage','암호화 API Key'],22,C['ink'],37)
card(1530,1150,635,260,'로컬 AI','기본 규칙 + 선택형 로컬 모델','chip',C['teal'])
lines(1560,1310,['LOCAL: Main 내 결정적 규칙 · 기본값','Ollama: loopback HTTP · 별도 프로세스','SLA 위험 계산은 결정적 규칙 유지'],24,C['ink'],38)
arrow('M1490 980 V1110 H920 V1140');label(1010,1110,'업무 데이터 · snapshot · 실행 이력')
arrow('M1845 980 V1140',dashed=True);label(1856,1109,'로컬 호출')
rect(2365,585,385,695,'#F8FBFD','#BFCFD9',25,'10 8');icon(2400,610,'cloud',C['blue'],0.9);text(2480,652,'외부 AI',32,C['blue'],750);text(2400,707,'선택 · 동의 후 HTTPS 연결',23,C['muted'])
rect(2390,750,335,170,'#FFFFFF','#D4DFEA',16);text(2420,800,'OpenAI',33,C['ink'],750);lines(2420,844,['공식 TypeScript SDK','Responses API'],24,C['muted'],37)
rect(2390,950,335,170,'#FFFFFF','#D4DFEA',16);text(2420,1000,'Anthropic Claude',29,C['ink'],750);lines(2420,1044,['공식 TypeScript SDK','Messages API'],24,C['muted'],37)
lines(2400,1174,['마스킹된 최소 데이터만 전송','API Key는 Main에서만 사용'],22,C['teal'],40)
arrow('M2165 800 H2355',dashed=True);label(2190,760,'HTTPS')
text(2380,1332,'외부 호출 실패 → LOCAL 결과 제공',22,C['purple'],600)
text(90,1455,'설치본 실행: 로컬 HTML / CSS / JavaScript 로드  ·  별도 웹 서버 없이 구동  ·  로컬 파일·업무 DB 유지',23,C['muted'])
text(75,1553,'개발 · 검증 · 패키징',31,C['indigo'],750);text(660,1553,'실행 아키텍처와 구분한 산출물 생성 경로',24,C['muted'])
for x,w,title,sub,kind,color in [(75,560,'개발 소스','TypeScript · React · Git 브랜치','screen',C['indigo']),(725,560,'정적 검사 · 테스트','TypeScript / ESLint · Vitest · Electron E2E','shield',C['teal']),(1375,560,'빌드 · 패키징','electron-vite → electron-builder','box',C['blue']),(2025,700,'설치 산출물','Windows NSIS · macOS DMG / ZIP','folder',C['purple'])]:
 rect(x,1590,w,150,'#F8FAFE','#D7E0EF',18);icon(x+23,1624,kind,color,0.8);text(x+100,1646,title,28,color,750);text(x+100,1695,sub,20,C['muted'])
for x in [635,1285,1935]:arrow(f'M{x} 1663 H{x+80}')
text(82,1802,'구조 기준: 현재 저장소의 DB v6 소스 · 신규 5개 기능 포함 · 플랫폼별 실행 검증 상태는 별도 증빙 문서 참조',22,C['muted'])
save('omnis-system-architecture')

begin(2400,1400,'OMNIS AI 업무 지원 데이터 흐름','로컬 입력 보완, Main 권한 검증, 최소 데이터 마스킹, 선택형 Provider, 구조화 검증과 담당자 검토 후 반영')
text(70,95,'OMNIS  |  AI 업무 지원 흐름',49,C['indigo'],800);text(73,148,'입력 보완부터 검토 후 반영까지 · LOCAL 기본 · 외부 AI는 선택',27,C['muted'])
steps=[(70,'01','사용자 입력','고장 제목 · 증상 · 영향','screen'),(530,'02','로컬 입력 점검','누락 질문 · 미확인 표시','shield'),(990,'03','Main 실행 요청','권한 · 동의 · 한도 검사','chip'),(1450,'04','Provider 선택','Factory + Orchestrator','atom'),(1910,'05','구조화 결과','JSON Schema + Zod','shield')]
for x,n,title,sub,kind in steps:
 card(x,250,400,240,title,sub,kind,C['indigo']);text(x+25,450,n,30,C['blue'],800)
for x in [470,930,1390,1850]:arrow(f'M{x} 370 H{x+50}')
rect(70,530,860,132,'#F3F8F9','#D4E7E8',17);text(95,575,'입력 점검에서는 외부 API 호출 0회',30,C['teal'],750);text(95,620,'사용자가 분석을 요청할 때만 선택한 Provider를 호출',24,C['muted'])
rect(990,545,400,380,'#F8F9FD','#D7E0EF',18);text(1020,595,'전송 전 보호',28,C['indigo'],750);lines(1020,652,['필요한 업무 필드만 추출','전화 · 이메일 · 토큰 마스킹','질문 답변도 같은 경로 적용','파일 원문 / DB 전체 제외','API Key는 Main에만 보관'],25,C['muted'],48)
arrow('M1190 490 V535')
rect(1450,545,400,380,'#F6F5FC','#D9D4ED',18);text(1480,595,'4개 Provider',28,C['purple'],750);lines(1480,655,['LOCAL · 기본 / 오프라인','OLLAMA · 로컬 HTTP','OPENAI · HTTPS','ANTHROPIC · HTTPS'],26,C['ink'],55)
arrow('M1650 490 V535')
rect(1910,545,400,380,'#F5FAFC','#D4E2ED',18);text(1940,595,'결과 검증 · 기록',28,C['blue'],750);lines(1940,652,['refusal / incomplete 처리','잘못된 결과 → 규칙 fallback','Provider · model · latency','token · request ID · fallback','AI 실행 이력에 기록'],24,C['muted'],48)
arrow('M2110 490 V535')
rect(70,730,860,195,'#FFF9F2','#EEDDC5',18);text(100,782,'통제 원칙',30,C['orange'],750);lines(100,827,['SLA 위험은 기존 규칙으로 계산','AI 분석이 고장 상태·담당자·우선순위를 자동 변경하지 않음'],25,C['muted'],46)
arrow('M2110 925 V1010 H1650 V1055')
card(1250,1065,1060,230,'담당자 검토 → 명시적 반영','추천 근거 확인 · 수정 · 기존 권한 / 업무 workflow 적용','user',C['teal'])
text(1290,1245,'정상 결과도 사람이 검토하기 전에는 업무 데이터에 적용되지 않습니다.',26,C['muted'])
rect(70,1065,1060,230,'#F8FAFE','#D7E0EF',20);text(110,1120,'실행 이력과 업무 이력',30,C['indigo'],750);lines(110,1173,['ai_runs: 선택 / 실제 Provider · 응답시간 · 사용량 · fallback','incident_events / audit_logs: 검토 후 반영과 업무 변경 기록'],25,C['muted'],48)
arrow('M1250 1185 H1140')
text(74,1354,'범위: 현재 입력과 DB 업무 데이터를 요청 시 분석하는 구조 · 문서 RAG 및 모델 학습 기능은 포함하지 않음',23,C['muted'])
save('omnis-ai-data-flow')
print('Created architecture SVGs in',OUT)
