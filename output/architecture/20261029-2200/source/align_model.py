from pathlib import Path
p=Path(__file__).with_name('analyze.py');s=p.read_text(encoding='utf-8-sig')
s=s.replace('edges=[]',"""node('STORE','로컬 파일 보존','storage','PC','첨부 원본·백업·암호화 자격정보 파일의 발표용 묶음; 별도 서비스 아님','','attachstore backup secret')
node('VALIDATE','결과 검증 · 이력','ai','M','Provider 내부 출력 검사와 Orchestrator 실행 기록의 발표용 묶음','Zod|ProviderSupport|AIOrchestrator','guard openai anthropic record orchestrator')
node('AUTH_UI','인증·가입 흐름','ui','R','로그인·가입 신청·승인 후 계정 사용','','auth signup')
node('SOURCE','소스 · 개발환경','build',None,'소스 및 Node.js/pnpm 개발환경','Node.js|pnpm','package build')
node('TEST','정적 검사 · 시험','build',None,'정적/단위/통합/Electron E2E 구성','TypeScript|ESLint|Vitest|Playwright','citest testai testuse testlaunch')
node('TARGET','플랫폼별 패키지','build',None,'Windows NSIS x64, macOS DMG/ZIP arm64/x64 구성','','platform ci','설정만 있음','소스 확인; 현 HEAD 성공 미검증')
for item in nodes:
 if item['id']=='BUNDLE':item['label']='3개 영역 번들'
 if item['id']=='PKG':item['label']='electron-builder'
 if item['id'] in ['FILE','BACK','KEYFILE']:item['parentBoundary']='STORE'
edges=[]""")
s=s.replace('UIrows=[]',"""edge('E39','SOURCE','TEST','정적/단위/통합/E2E 검사','로컬 개발 도구','citest testai testuse','설정 경로; 이번 앱 시험 미실행',dc='프로그램')
edge('E40','TEST','BUNDLE','검사 후 build','로컬 빌드','citest build vite','CI 또는 개발자 명시 실행',dc='프로그램')
edge('E41','PKG','TARGET','플랫폼별 설치 패키지 구성','패키징','platform ci','이번 재패키징 미실행',dc='프로그램')
edge('E42','TARGET','PC','설치 구성','설치','platform','현 HEAD 신규PC 설치 미검증',dc='프로그램')
edge('E43','AI','VALIDATE','선택 Provider 출력·실행 metadata','동일 Main 호출','openai anthropic ollama orchestrator')
edge('E44','VALIDATE','REVIEW','검증 추천·이력 metadata','IPC 응답','uiapply openai anthropic record')
UIrows=[]""")
s=s.replace("entities.append(dict(table=name,", "entities.append(dict(id='T:'+name,table=name,")
s=s.replace("foreignKeys=len(relations),foreignKeyCheck=", "foreignKeys=len(relations),pythonSQLiteVersion=sqlite3.sqlite_version,foreignKeyCheck=")
needle="csvwrite('evidence/기술스택_사용범위.csv'"
pos=s.index(needle)
s=s[:pos]+"""rolemap={'react':'Renderer의 useState/useEffect/useRef 및 JSX 화면','react-router-dom':'HashRouter·Route·Navigate·검색 파라미터로 메뉴/상세 이동','typescript':'타입 계약 및 tsc --noEmit 정적 검사 (package scripts)','electron':'Main/Preload/BrowserWindow·IPC·safeStorage·native dialog','electron-vite':'Main/Preload/Renderer 개발·번들링','vite':'electron-vite Renderer 개발/번들 기반, 포트 명시 없음','electron-builder':'NSIS/DMG/ZIP 및 native dependency packaging','vitest':'tests/unit·integration 시험 소스 (이번 미실행)','playwright':'tests/e2e의 Electron/UI 자동화 소스 (이번 미실행)','drizzle-orm':'schema.ts 선언, DashboardRepository의 count 쿼리; 나머지는 주로 직접 SQL','drizzle-kit':'db:generate 설정; runtime migration은 자체 migrate.ts SQL','better-sqlite3':'Main의 동기 native SQLite/transaction/backup 직접 SQL','electron-log':'Main 시작/IPC 오류 기록','zod':'IPC payload 및 비결정적 AI 결과 검증','@tanstack/react-query':'설치됨; src import/사용 미확인, 화면 캐시 계층으로 배치하지 않음','zustand':'설치됨; src import/사용 미확인','react-hook-form':'설치됨; src import/사용 미확인','@hookform/resolvers':'설치됨; src import/사용 미확인'}
for item in versions:
 if item['technology'] in rolemap:item['actualRole']=rolemap[item['technology']]
"""+s[pos:]
p.write_text(s,encoding='utf8')
p=Path(__file__).with_name('make_scenes.py');s=p.read_text(encoding='utf-8-sig')
s=s.replace("node('FILE',502,609", "node('STORE',502,609")
s=s.replace("node('AI',770,538", "node('VALIDATE',770,538")
s=s.replace("node('AUTH',56,175", "node('AUTH_UI',56,175")
s=s.replace("'Main 검증·접근','AppService'", "'IPC 검증·접근 검사','AppService'")
s=s.replace("node('KEYFILE',370,744,350,61,title='secrets/ai-credentials.json',titleSize=21)","node('KEYFILE',370,734,350,74,'secrets/ai-credentials.json',size=18,titleSize=23)")
s=s.replace("(545,744)","(545,734)")
s=s.replace("steps=[('DEV',56", "steps=[('SOURCE',56").replace("('DEV',342", "('TEST',342").replace("('PKG',1246", "('TARGET',1246")
s=s.replace("for a,b in [(296,342),(588,634),(892,938),(1200,1246)]:path([(a,258),(b,258)],'E36 E37 E38',color=C['main'])", "for (a,b),eid in zip([(296,342),(588,634),(892,938),(1200,1246)],['E39','E40','E37','E41']):path([(a,258),(b,258)],eid,color=C['main'])")
s=s.replace("def entity(x,y,title,body,h=105):node('DB',x,y,370,h,body,size=19,title=title,titleSize=23,color=C['storage'])","def entity(x,y,title,body,h=105):node('T:'+title,x,y,370,h,body,size=19,title=title,titleSize=23,color=C['storage'])")
p.write_text(s,encoding='utf8')
