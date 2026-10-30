from pathlib import Path
from html import escape
import json,math,xml.etree.ElementTree as ET
from PIL import ImageFont
OUT=Path(__file__).resolve().parents[1]
M=json.loads((OUT/'source/architecture-model.json').read_text(encoding='utf8'))
N={n['id']:n for n in M['nodes']};REF={r['id']:r for r in M['sourceRefs']}; E={e['id']:e for e in M['edges']}
C={'ink':'#172442','muted':'#58677F','line':'#CBD3E0','bg':'#FFFFFF','ui':'#336AC1','main':'#26386D','storage':'#087C7B','ai':'#7554A5','security':'#9A6620','pale_ui':'#EDF3FD','pale_main':'#F1F3FA','pale_storage':'#ECF7F5','pale_ai':'#F4F0FA','pale_security':'#FFF6E7'}
S=[];s=None;fit=[]
FONT='Malgun Gothic'
def add(v):
 v['id']=f"s{len(S)}-{len(s['items'])+1}";s['items'].append(v);return v

def rect(x,y,w,h,fill='#FFFFFF',stroke=None,dash=False,r=10,**kw):
 return add(dict(type='rect',x=x,y=y,w=w,h=h,fill=fill,stroke=stroke or C['line'],dash=dash,r=r,**kw))
def txt(x,y,text,size=24,color=None,bold=False,w=1450,align='left',**kw):
 font=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf' if bold else 'C:/Windows/Fonts/malgun.ttf',size)
 width=font.getlength(text)
 if width>w+1:fit.append(dict(slide=len(S),text=text,width=round(width,1),available=w))
 return add(dict(type='text',x=x,y=y,w=w,h=size*1.45,text=text,size=size,color=color or C['ink'],bold=bold,align=align,**kw))
def lines(x,y,vals,size=22,gap=31,w=1450,color=None,bold=False,**kw):
 for i,v in enumerate(vals.split('\n') if isinstance(vals,str) else vals):txt(x,y+i*gap,v,size,color,bold,w,**kw)
def path(points,ids='',label=None,lpos=None,dash=False,color=None,arrow=True,kind='call',refs=None):
 sources=refs or list(dict.fromkeys(r for eid in ids.split() for r in E[eid]['sourceRefs']))
 add(dict(type='path',points=points,edgeIds=ids.split(),sourceRefs=sources,dash=dash,color=color or C['muted'],arrow=arrow,kind=kind))
 if label:txt(lpos[0],lpos[1],label,18,color or C['muted'],False,lpos[2] if len(lpos)>2 else 500)
def boundary(id,x,y,w,h,label=None,fill='#FAFBFD',color=None):
 rect(x,y,w,h,fill,color or C['line'],r=14,componentIds=[id]);txt(x+18,y+10,label or N[id]['label'],23,color or C['ink'],True,w-36)
def node(id,x,y,w,h,body='',size=22,title=None,color=None,fill=None,titleSize=25):
 n=N.get(id);kind=n['kind'] if n else 'service';col=color or C['ai' if kind in ['ai','external'] else 'storage' if kind in ['storage','file'] else 'security' if kind=='security' else 'ui' if kind=='ui' else 'main']
 rect(x,y,w,h,fill or '#FFFFFF',col,r=9,componentIds=[id]);rect(x,y,5,h,col,col,r=0)
 head=title or (n['label'] if n else id)
 hs=head.split('\n');lines(x+18,y+12,hs,titleSize,gap=titleSize*1.22,w=w-36,color=col,bold=True,componentIds=[id])
 txt(x+w-42,y+12,id,16,col,False,30,align='right') if len(id)<=3 and len(hs[0])<11 else None
 if body:lines(x+18,y+18+len(hs)*titleSize*1.22,body,size,gap=size*1.38,w=w-36,componentIds=[id])
def note(text,x=56,y=825,w=1488):txt(x,y,text,17,C['muted'],False,w)
def begin(title,msg,notes,refs):
 global s
 s=dict(title=title,message=msg,notes=notes,sourceRefs=refs,items=[]);S.append(s)
 rect(0,0,1600,900,'#FFFFFF','#FFFFFF',r=0)
 rect(56,35,8,49,C['main'],C['main'],r=0)
 txt(82,30,title,42,C['main'],True,1440)
 txt(56,94,msg,24,C['muted'],False,1488)
 path([(56,137),(1544,137)],arrow=False,color=C['line'])
 txt(56,862,'OMNIS 1.0.1 · schema 8 · ba829af | 구현: 소스 확인 / 배포·외부 응답: 별도 검증',16,C['muted'],w=1350)
 txt(1455,858,f'{len(S):02d} / 06',18,C['main'],True,90,align='right')
def sources(keys):
 return [r['id'] for r in M['sourceRefs'] if any(k in r['meaning'] for k in keys)]

begin('OMNIS 전체 시스템 아키텍처','업무는 PC 안에서 처리하고, AI는 사용자가 요청한 범위만 선택적으로 실행합니다.',
'OMNIS는 PC 한 대에서 운용·정비 업무와 이력을 관리하는 Electron 앱입니다. 첫째, 다섯 역할의 사용자가 React 화면에서 업무를 입력합니다. 둘째, Preload의 window.omnis가 IPC로 요청을 보냅니다. 셋째, Main이 입력 형식과 로그인·역할·업무 대상을 검사합니다. 넷째, Main 업무 모듈이 SQLite 또는 로컬 파일을 처리합니다. 다섯째, 필요할 때만 LOCAL 규칙이나 선택형 AI를 호출합니다. Ollama는 별도 로컬 프로세스이고 외부 AI는 동의·자격정보·한도를 통과해야 합니다. 여섯째, 성공 또는 오류 응답을 받은 화면이 상태를 바꾸고 목록을 다시 조회합니다. 하단은 런타임과 구분한 개발·배포 경로입니다.',
list(dict.fromkeys(r for e in M['edges'] for r in e['sourceRefs'])))
boundary('PC',40,152,1240,570)
txt(280,165,'ADMIN · OPERATOR · MAINTAINER · USER · VIEWER',20,C['main'],w=925)
boundary('APP',62,198,1195,369,'Electron 애플리케이션 · Renderer / Preload / Main',fill='#F8FAFE')
boundary('M',635,242,597,291,fill=C['pale_main'],color=C['main'])
node('R',86,250,300,252,'상황판 · 운용 · 고장\n정비 · 통제 · 근무\n보고서 · AI · 관리\nReact state · 재조회',titleSize=25)
node('P',427,324,168,124,'window.omnis',size=18,title='Preload\nbridge',titleSize=23)
node('G',658,294,550,76,'mainFrame · Zod · 세션 · 역할 · 업무 대상',size=21,titleSize=23)
node('S',658,397,285,113,'고장·정비 · 통제·근무\n실용 기능 · 보고서',size=20,titleSize=25)
node('AI',971,397,237,113,'LOCAL 기본\n선택형 Provider',size=20,title='선택형 AI 업무 지원',titleSize=21)
node('DB',86,609,390,88,'data/omnis.db · WAL',size=21,titleSize=25)
node('STORE',502,609,354,88,'첨부 · 백업 · 암호화 Key',size=20,title='로컬 파일 보존',titleSize=25)
node('OLLAMA',883,609,350,88,'별도 설치 · loopback HTTP',size=20,titleSize=25)
boundary('NET',1320,152,240,570,fill=C['pale_ai'],color=C['ai'])
node('OPENAI',1340,266,200,108,'SDK Responses',size=18,title='OpenAI\n서비스',titleSize=23)
node('ANTHROPIC',1340,415,200,108,'SDK Messages',size=18,title='Anthropic\n서비스',titleSize=23)
lines(1340,565,['활성화·동의·Key·한도','최소 입력 · 마스킹','실제 외부 호출 미검증'],18,gap=30,w=205,color=C['ai'])
path([(386,385),(427,385)],'E01',label='① 입력',lpos=(382,291,110))
path([(595,385),(623,385),(623,332),(658,332)],'E02 E03',label='② IPC',lpos=(532,289,92))
path([(800,370),(800,397)],'E03 E04',label='③ 검사',lpos=(838,372,110))
path([(800,510),(800,552),(280,552),(280,609)],'E09',label='④ SQL·파일 처리',lpos=(367,524,260))
path([(658,473),(386,473)],'E14 E15',label='⑥ 응답·재조회',lpos=(428,479,200))
path([(900,510),(900,580),(678,580),(678,609)],'E16',color=C['storage'])
path([(943,453),(971,453)],'E21',dash=True,color=C['ai'])
path([(1089,510),(1089,609)],'E30',label='⑤ 선택 요청',lpos=(1095,559,160),dash=True,color=C['ai'])
path([(1208,431),(1294,431),(1294,320),(1340,320)],'E31',dash=True,color=C['ai'])
path([(1208,481),(1303,481),(1303,469),(1340,469)],'E32',dash=True,color=C['ai'])
rect(40,752,1520,63,C['pale_main'],C['line'])
txt(60,767,'개발·배포   소스 · Node.js/pnpm  →  검사·시험  →  electron-vite  →  electron-builder  →  NSIS EXE / macOS DMG·ZIP',22,C['main'],w=1480)
note('실선: 현재 호출·저장 / 점선: 조건부·선택 경로  |  파랑 UI · 남색 Main · 청록 저장 · 보라 AI · 황토 보안')

begin('런타임 구성과 업무 처리','IPC 검증과 업무 권한을 통과한 요청만 저장하며, 화면은 응답 후 다시 조회합니다.',
'위 순서는 신규 고장 접수 한 건의 실제 경로입니다. 화면의 저장 버튼은 incidents:create를 호출하고, Preload가 이를 IPC로 전달합니다. Main은 발신 프레임과 Zod 입력 계약을 검사한 다음 로그인·역할을 확인합니다. AppService는 접수, 처리 이벤트, 감사 기록, 접수 답변 snapshot을 한 transaction에 저장합니다. 성공하면 접수번호와 식별자를 반환하고 화면은 폼을 닫은 뒤 목록을 재조회합니다. 실패하면 ok:false의 안내 문구를 표시합니다. 아래는 별도 사용자 요청으로 진행되는 처리 상태입니다. 부서·담당 배정은 소속을 검사하며, 조치완료에는 원인과 결과가, 종결에는 사용자 확인이 필요합니다. 검증 상태는 사람이 기록한 것으로 실물 자동검사를 뜻하지 않습니다.',
list(dict.fromkeys(r for eid in ['E01','E02','E03','E04','E09','E14','E15'] for r in E[eid]['sourceRefs'])))
xs=[180,470,750,1050,1380]
for id,x,head in zip(['R','P','G','S','DB'],xs,['React Renderer','Preload bridge','IPC 검증·접근 검사','AppService','SQLite 사용자 DB']):
 node(id,x-110,170,220,67,title=head,titleSize=21)
 path([(x,237),(x,528)],arrow=False,dash=True,color=C['line'])
path([(180,263),(470,263)],'E01',label='F01.1  create payload',lpos=(192,239,270))
path([(470,304),(750,304)],'E02',label='F01.2  invoke · frame · Zod',lpos=(476,280,275))
path([(750,345),(1050,345)],'E03 E04',label='F01.3  역할·검증된 입력',lpos=(760,321,285))
path([(1050,386),(1380,386)],'E09',label='F01.4  SQL transaction',lpos=(1060,362,305))
path([(1380,439),(180,439)],'E13 E14 E15',label='F01.5  id·접수번호 → Result ok → incidents:list → setRows',lpos=(430,409,1030))
path([(750,505),(180,505)],'E14 E15',label='검증/권한 실패 → ok:false → Error 안내',lpos=(237,476,640),dash=True,color=C['security'])
txt(56,551,'F02  부서·담당 배정과 처리 상태 — 각각 별도의 사용자 요청',25,C['main'],True,1488)
labels=['접수','분류','배정','원격 / 현장','조치완료','검증','종결']
for i,l in enumerate(labels):
 x=56+i*213
 rect(x,600,185,62,C['pale_main'],C['main'])
 txt(x+10,611,l,25,C['main'],True,165,align='center')
 if i<6:path([(x+185,631),(x+213,631)],'E05 E09',refs=[next(r['id'] for r in M['sourceRefs'] if r['path'].endswith('Workflow.ts'))])
lines(56,686,['ADMIN/OPERATOR: 분류·배정  |  MAINTAINER: 배정 작업 조치  |  USER: 본인 VERIFIED → CLOSED + 확인',
'보류·취소: Workflow의 조건 분기  |  조치완료: 원인·결과 필수  |  종결: 사용자 확인 필수'],21,gap=36,w=1488)
rect(56,775,1488,39,C['pale_security'],C['pale_security'])
txt(72,779,'검증 상태 입력과 데이터 정합성 검사는 실물·장비 검증을 자동 수행했다는 의미가 아닙니다.',21,C['security'],w=1455)
note('실선: 순차 요청·반환 / 점선: 실패 분기 또는 실행 위치를 표시하는 lifeline')

begin('데이터 구조와 저장 흐름','SQLite 파일 하나에 업무 관계를 저장하고, 첨부 원본·백업·seed·매뉴얼은 별도 파일로 보존합니다.',
'이 도면은 핵심 관계만 선택한 논리 ERD입니다. 전체 33개 테이블과 345개 필드는 별도 CSV에서 확인할 수 있습니다. 실선은 실제 migration에 존재하는 외래키이고, 고장의 team_id처럼 서비스가 검사하는 관계는 점선으로 구분합니다. 요청부서는 department 문자열이고 조치부서는 team_id 식별자입니다. 접수 답변과 정비 체크리스트는 당시 템플릿의 snapshot을 별도로 보관합니다. 반복 정비는 rule_id와 예정일을 복합 기본키로 묶고 생성 전에 다시 조회해 기존 회차를 건너뜁니다. 세션은 Main 메모리이며 work:mine은 기존 업무 조회입니다. 첨부 원본은 파일, metadata와 해시는 DB에 저장합니다. 백업은 DB와 첨부를 복사하며 자격정보 파일을 포함하지 않습니다.',
sources(['실제 DDL','실제 FK','schema 8','회차','백업']))
def entity(x,y,title,body,h=105):node('T:'+title,x,y,370,h,body,size=19,title=title,titleSize=23,color=C['storage'])
entity(56,175,'users','id PK · role · active',85)
entity(610,175,'communication_systems','id PK · status · uptime_pct',85)
entity(1160,175,'recurring_rules','id PK · version · definition_json',85)
entity(56,350,'incidents','id PK · system_id FK · reported_by FK\ndepartment: 요청부서 문자열\nteam_id: 조치부서 논리 관계',140)
entity(610,350,'maintenance_tasks','id PK · incident_id FK · assignee_id FK\n상태 · 일정 · 결과\n정비 완료 전 체크리스트 검사',140)
entity(1160,350,'recurring_occurrences','PK(rule_id, occurrence_date)\nrule_id FK · task_id FK\n기존 회차 skip + transaction',140)
entity(56,568,'incident_events','id PK · incident_id FK · actor_id FK',87)
entity(610,568,'task_checklists','task_id PK/FK · template_id FK\n템플릿 snapshot · revision',100)
entity(1160,568,'work_templates','id PK · kind · version\n접수 질문 / 정비 점검 정의',100)
path([(241,260),(241,350)],label='reported_by 1:N',lpos=(79,292,295),color=C['storage'],refs=[R['ddl']] if 'R' in globals() else sources(['실제 DDL']))
path([(795,260),(795,350)],label='system_id 1:N',lpos=(632,292,295),color=C['storage'],refs=sources(['실제 DDL']))
path([(1345,260),(1345,350)],label='rule_id 1:N',lpos=(1194,292,285),color=C['storage'],refs=sources(['실제 DDL']))
path([(426,409),(610,409)],label='incident_id',lpos=(447,371,160),color=C['storage'],refs=sources(['실제 DDL']))
txt(485,416,'1:N',18,C['storage'],w=80)
path([(980,409),(1160,409)],label='task_id 1:N',lpos=(991,371,170),color=C['storage'],refs=sources(['실제 DDL']))
path([(241,490),(241,568)],label='incident_id 1:N',lpos=(76,522,300),color=C['storage'],refs=sources(['실제 DDL']))
path([(795,490),(795,568)],label='task_id 1:0..1',lpos=(629,522,300),color=C['storage'],refs=sources(['실제 DDL']))
path([(1160,618),(980,618)],label='template_id 1:N',lpos=(988,578,170),color=C['storage'],refs=sources(['실제 DDL']))
lines(56,686,['F03 반복 정비: 규칙·기간 미리보기 → 생성 시 재검증 → 기존 회차 skip → 작업·회차 transaction 저장',
'논리 관계: incidents.team_id → maintenance_teams.id (FK 없음) · 첨부/AI 이력은 entity_type + entity_id'],20,gap=36,w=1488)
# Explicit dotted service relationship; no cardinality asserted for polymorphic references.
path([(70,768),(180,768)],dash=True,arrow=False,color=C['security'],kind='logical',refs=sources(['조치부서/담당']))
txt(195,756,'점선: 서비스가 관리하는 논리 관계  |  실선: 실제 FK (부모 → 자식)',18,C['security'],w=1240)
rect(56,790,1488,39,C['pale_storage'],C['pale_storage'])
txt(72,793,'seed → 최초 사용자 DB  |  첨부: 원본 + DB metadata  |  백업: DB + 첨부  |  매뉴얼: 번들 복사  |  보고서: SQL → PDF/CSV',20,C['storage'],w=1455)
note('33개 테이블·FK·필드 사전: evidence/전체테이블_필드사전.csv  |  세션: Main 메모리 / work:mine: 기존 업무 조회',y=832)
begin('AI 업무 지원과 보안 경계','LOCAL 규칙이 기본이며, 비결정적 추천은 검증·이력·사람 검토를 거쳐 명시적으로 반영합니다.',
'왼쪽 입력 보완은 missingQuestions를 사용하는 로컬 규칙이며 추론 요청과 별도입니다. 사용자가 분석을 요청하면 Main이 입력을 조합하고 Factory가 Provider를 선택합니다. 외부 Provider는 활성화, 전송 동의, 자격정보와 각 시도 요청 한도를 확인합니다. PromptCatalog의 기능별 지시와 JSON 계약을 사용하고 Provider 안에서 입력을 최소화·마스킹합니다. LOCAL은 Main의 결정적 규칙, Ollama는 별도 설치형 loopback 서버, OpenAI와 Anthropic은 공식 SDK를 통한 인터넷 서비스입니다. 비결정적 출력은 Zod와 후보 ID를 검사하고 외부 일일 요약은 입력 수치를 확인합니다. 실패하면 조건부 재시도 후 LOCAL로 전환합니다. 시도당 timeout은 전체 시간 상한이 아닙니다. 추천 표시와 실제 업무 반영은 별개이며 담당자 버튼이 있어야 업무가 변경됩니다.',
list(dict.fromkeys(r for eid in ['E21','E22','E23','E24','E25','E26','E27','E28','E29','E30','E31','E32','E33','E34','E35'] for r in E[eid]['sourceRefs'])))
boundary('PC',40,155,1160,665)
txt(800,169,'F04 선택형 AI 요청과 명시적 반영',19,C['ai'],w=355)
boundary('M',340,197,814,520,fill=C['pale_main'],color=C['main'])
node('R',64,245,240,155,'InputAssist: 로컬 규칙\n분석은 별도 버튼',size=19,titleSize=24)
node('REVIEW',64,493,240,207,'추천·근거 확인\nADMIN/OPERATOR 버튼\nincidents:applyAi',size=18,title='담당자 검토·\n명시적 반영',titleSize=23)
node('F',370,246,350,87,'활성화 · 동의 · 자격정보',size=20,titleSize=24)
node('O',370,382,350,125,'AIUsagePolicy: 각 시도 한도\n시도당 timeout · 조건부 retry\n실패 → LOCAL fallback',size=18,titleSize=24)
node('GUARD',770,246,350,87,'PromptCatalog: 기능별 계약',size=20,title='ExternalDataGuard',titleSize=24)
node('LOCAL',770,382,350,105,'기본 결정적 규칙 · LLM 아님\nSLA 위험도는 별도 규칙',size=20,titleSize=24)
node('SECRET',370,538,350,145,'환경변수 우선\nsafeStorage 암호문 파일\n저장된 Key는 상태만 반환',size=20,titleSize=24)
node('VALIDATE',770,538,350,145,'비결정적 출력: JSON·Zod\n후보 ID · 외부 요약 수치 검사\nai_runs: 선택/실제·usage·fallback',size=18,title='결과 검증 · 이력',titleSize=24)
node('KEYFILE',370,734,350,74,'secrets/ai-credentials.json',size=18,titleSize=23)
node('OLLAMA',770,734,350,74,'127.0.0.1:11434 · HTTP',size=18,titleSize=23)
boundary('NET',1235,155,325,665,fill=C['pale_ai'],color=C['ai'])
node('OPENAI',1260,246,275,109,'공식 SDK · Responses',size=20,titleSize=25)
node('ANTHROPIC',1260,414,275,109,'공식 SDK · Messages',size=20,titleSize=25)
lines(1260,675,['선택 Provider 한 곳만 요청','전체 DB·첨부 원문 자동 수집 없음','실제 외부 응답은 미검증'],18,gap=31,w=279,color=C['ai'])
path([(304,290),(370,290)],'E21 E22',label='분석 요청',lpos=(64,416,240),color=C['ai'])
path([(545,333),(545,382)],'E23',label='선택·계약',lpos=(373,344,170),color=C['ai'])
path([(720,418),(744,418),(744,290),(770,290)],'E26 E27 E28',label='최소화·마스킹',lpos=(771,340,330),color=C['security'])
path([(720,455),(770,455)],'E29',dash=True,color=C['ai'])
path([(1120,290),(1260,290)],'E31',dash=True,color=C['ai'],label='HTTPS',lpos=(1138,261,115))
path([(1120,312),(1180,312),(1180,469),(1260,469)],'E32',dash=True,color=C['ai'])
path([(1120,321),(1168,321),(1168,776),(1120,776)],'E30',dash=True,color=C['ai'])
path([(945,487),(945,538)],'E34',color=C['ai'])
path([(1235,610),(1120,610)],'E34',label='JSON 응답',lpos=(1133,578,130),dash=True,color=C['ai'])
path([(770,640),(741,640),(741,710),(184,710),(184,700)],'E34',color=C['ai'])
path([(545,683),(545,734)],'E25',color=C['security'])
path([(370,318),(350,318),(350,610),(370,610)],'E24',dash=True,color=C['security'])
txt(357,506,'자격정보 조회',17,C['security'],w=255)
path([(304,639),(340,639)],'E35',color=C['ui'])
txt(70,753,'별도 IPC → Main 업무 반영',19,C['ui'],w=285)
note('시도당 5~30초 · 조건부 최대 2회 재시도 후 LOCAL fallback / 총 요청시간 상한 아님 · 전송 flag는 코드상 기록값')

begin('UI 정보구조와 사용자 동선','화면 접근·버튼 노출과 Main의 실제 권한 검사를 구분하며, 5개 실용 기능을 기존 업무에 배치합니다.',
'왼쪽은 실제 다섯 역할이고, 오른쪽은 HashRouter에 등록된 메뉴 구조입니다. 로그인 전 가입 신청을 제출할 수 있고 승인은 ADMIN의 사용자 신청현황에서 수행합니다. 통합상황판은 집계와 목록·상세 이동을 제공하며 내 업무는 별도 데이터베이스가 아닌 기존 업무 조회입니다. 운용 현황에는 체계 상태, 고장 전 과정, 정비 달력과 통제·일일마감이 있습니다. 업무 지원은 근무·지시, AI 지원, 보고서 통계입니다. 관리 화면에는 가입 승인, 시스템 설정과 역할별 매뉴얼이 있습니다. 접수 템플릿과 입력 보완은 고장 화면, 체크리스트와 반복 규칙은 정비 화면에 연결됩니다. 메뉴를 볼 수 있다고 모든 호출이 허용되지는 않습니다. 예를 들어 USER의 정비 상세 접근과 VIEWER의 AI 분류는 Main에서 제한합니다.',
sources(['route','메뉴','화면','입력','내 업무','가입 승인']))
node('AUTH_UI',56,175,310,112,'로그인 · 가입 신청\nADMIN이 가입 승인',size=21,title='인증·가입 흐름',titleSize=25)
rect(56,322,310,427,C['pale_security'],C['security'])
txt(76,338,'실제 역할 5종',25,C['security'],True,270)
for i,(a,b) in enumerate([('ADMIN','승인·설정·백업'),('OPERATOR','통제·분류·배정'),('MAINTAINER','배정 조치·정비'),('USER','본인 접수·확인·종결'),('VIEWER','조회 중심·일부 확인')]):
 txt(76,389+i*67,a,23,C['main'],True,270);txt(76,419+i*67,b,20,C['muted'],w=270)
rect(420,175,1114,93,C['pale_ui'],C['ui'])
txt(442,186,'통합상황판  /',27,C['ui'],True,1070)
txt(442,226,'집계 → 목록·상세 이동  ·  F2 내 업무 (?view=mine)',22,C['ink'],w=1070)
path([(366,227),(420,227)],refs=sources(['HashRouter']),color=C['ui'])
cols=[(420,'운용 현황',[('운영현황','/operations','체계 상태·운용률·이력'),('고장관리','/incidents','F1 접수 템플릿 · F5 입력 보완'),('정비관리','/maintenance','F3 체크리스트 · F4 반복 정비'),('통제·일일마감','/control','경보·계획·정합성·인수인계')]),(800,'업무 지원',[('근무/지시사항','/duty','가상 명부·다중 편성·확인/이행'),('AI 지원','/ai','F5 입력 보완 · 분류·요약·추천'),('보고서/통계','/reports','일/주 집계·CSV·일일 고장 PDF')]),(1180,'관리 · 도움말',[('사용자 신청현황','/signups','ADMIN: 가입 승인·반려'),('시스템관리','/settings','ADMIN: 설정·Key·백업·감사'),('사용자 매뉴얼','/manuals','로그인 후 5종 PDF 열기·복사')])]
for x,head,rows in cols:
 rect(x,328,354,378,'#FFFFFF',C['ui'])
 txt(x+18,340,head,26,C['ui'],True,318)
 for i,(label,route,body) in enumerate(rows):
  y=386+i*77
  txt(x+18,y,label,24,C['ink'],True,318)
  txt(x+18,y+30,route,17,C['muted'],w=318)
  txt(x+18,y+53,body,18,C['muted'],w=318)
 path([(x+177,268),(x+177,328)],refs=sources(['실제 메뉴']),color=C['ui'])
rect(420,743,1114,55,C['pale_ai'],C['pale_ai'])
txt(438,755,'F1 접수 템플릿 · F2 내 업무 · F3 체크리스트 · F4 반복 정비 · F5 로컬 입력 보완',21,C['ai'],True,1080)
note('UI 노출 ≠ Main 호출 허용: USER 정비 목록 조회와 상세 접근은 다름 / VIEWER의 AI 분류는 Main에서 거부',y=816)

begin('개발·검증·배포 및 운영','개발·패키징 설정과 현재 소스에서 확인한 동작을 분리하고, userData와 로컬 백업을 보존합니다.',
'개발 PC에서는 Node.js와 pnpm으로 정적 검사, Vitest 단위·통합, Playwright Electron E2E를 수행하도록 구성되어 있습니다. electron-vite는 Main, Preload, Renderer를 각각 번들링하고 electron-builder는 native SQLite 모듈을 풀어 포함하며 seed DB와 역할 매뉴얼을 리소스로 넣습니다. Windows x64 NSIS와 macOS arm64/x64 DMG·ZIP 구성이 있지만 이 자체가 배포 성공 증거는 아닙니다. 현재 폴더의 설치본은 1.0.0이라 소스 1.0.1 검증과 구분했습니다. 아래는 실제 시작 순서입니다. 경로와 이전 자료를 준비하고 DB를 열어 필요한 migration과 seed를 적용한 뒤 IPC와 창을 만듭니다. 날짜 marker가 없을 때 DB와 첨부를 백업하며 최신 열 개를 남깁니다. 이번 작업은 자료의 소스 대조와 전체 도면 검증이며 앱 전체 회귀 시험은 수행하지 않았습니다.',
sources(['개발','빌드','패키지','설정','백업','부족한','seed 조건']))
steps=[('SOURCE',56,240,'소스 · 개발환경','Node.js 22.18~24\npnpm 11~12 범위\n개발 PC에만 필요'),('TEST',342,246,'정적 검사 · 시험','typecheck · lint\nVitest · Electron E2E\n이번 앱 시험 실행 없음'),('BUNDLE',634,258,'3개 영역 번들','electron-vite\nout/main · out/preload\nout/renderer'),('PKG',938,262,'electron-builder','better-sqlite3 unpack\nseed DB · 매뉴얼 포함\n설치 패키지 구성'),('TARGET',1246,288,'플랫폼별 패키지','Windows NSIS x64\nmacOS DMG·ZIP\narm64 / x64 CI 구성')]
for id,x,w,h,b in steps:node(id,x,178,w,159,b,size=20,title=h,titleSize=24)
for (a,b),eid in zip([(296,342),(588,634),(892,938),(1200,1246)],['E39','E40','E37','E41']):path([(a,258),(b,258)],eid,color=C['main'])
txt(56,378,'실행 시 준비 순서',27,C['main'],True,1488)
startup=[('1  userData 경로','격리 경로 또는 appData\nAFCCS data·backups 복사'),('2  DB 준비','DB 없으면 seed 최초 복사\nWAL · 필요한 migration만'),('3  seed 실행','users 있으면 보충 자료\n없으면 가상 초기 자료'),('4  IPC · 창 생성','registerIpc → createWindow\nVite URL / 로컬 HTML 분기'),('5  조건부 일일 백업','당일 marker 없을 때\nDB + 첨부 · 최신 10개')]
for i,(h,b) in enumerate(startup):
 x=56+i*300
 rect(x,427,278,126,C['pale_main'],C['main']);txt(x+14,439,h,23,C['main'],True,250);lines(x+14,478,b,18,gap=28,w=250)
 if i<4:path([(x+278,489),(x+300,489)],refs=sources(['userData','DB 준비','부족한']),color=C['main'])
lines(56,580,['08:30/16:00은 작업판 설정 시각: 자동 스케줄러 아님  ·  앱 시작 시 외부 AI 자동 호출 없음',
'단일 PC 로컬 DB · 배포 앱의 로컬 HTML 로딩 · 사용자 PC에 Node.js/pnpm 별도 설치 불필요'],22,gap=37,w=1488)
rect(56,686,717,112,C['pale_storage'],C['storage']);rect(799,686,735,112,C['pale_security'],C['security'])
txt(76,697,'이번 수행: 자료 검증',24,C['storage'],True,675)
lines(76,735,['소스 대조 · 메모리 SQL/readonly seed 확인','SVG 렌더 · PPTX 열기/PDF 내보내기 · 6쪽 검사'],20,gap=29,w=675)
txt(819,697,'별도 확인 필요',24,C['security'],True,690)
lines(819,735,['현재 HEAD 설치/패키징 · 신규 PC · 실제 외부 AI','macOS CI 성공 · 서명/공증 · 군 실운용 검증'],20,gap=29,w=690)
note('배포 폴더에 1.0.0 설치본 존재: 소스 1.0.1 성공 증거로 인용하지 않음 / 이번 전체 앱 회귀·CI·API 호출 없음')

# SVG and PPTX share the same object geometry and text.
assert len(S)==6
for no,slide in enumerate(S,1):
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 1600 900">',f'<title>{escape(slide["title"])}</title>',f'<desc>{escape(slide["message"])}</desc>',f'<g font-family="{FONT}">']
 for o in slide['items']:
  if o['type']=='rect':svg.append(f'<rect id="{o["id"]}" x="{o["x"]}" y="{o["y"]}" width="{o["w"]}" height="{o["h"]}" rx="{o["r"]}" fill="{o["fill"]}" stroke="{o["stroke"]}" stroke-width="1.5"'+(' stroke-dasharray="9 7"' if o['dash'] else '')+'/>')
  elif o['type']=='text':
   xx=o['x']+({'left':0,'center':o['w']/2,'right':o['w']}[o['align']]);anchor={'left':'start','center':'middle','right':'end'}[o['align']]
   svg.append(f'<text id="{o["id"]}" x="{xx}" y="{o["y"]+o["size"]}" font-size="{o["size"]}" font-weight="{700 if o["bold"] else 400}" fill="{o["color"]}" text-anchor="{anchor}">{escape(o["text"])}</text>')
  elif o['type']=='path':
   points=o['points'];d='M '+' L '.join(f'{x},{y}' for x,y in points)
   svg.append(f'<path id="{o["id"]}" d="{d}" fill="none" stroke="{o["color"]}" stroke-width="2.4" stroke-linejoin="round"'+(' stroke-dasharray="8 6"' if o['dash'] else '')+'/>')
   if o['arrow']:
    (x1,y1),(x2,y2)=points[-2:];a=math.atan2(y2-y1,x2-x1);pts=[(x2,y2),(x2-10*math.cos(a-.42),y2-10*math.sin(a-.42)),(x2-10*math.cos(a+.42),y2-10*math.sin(a+.42))]
    svg.append('<polygon points="'+' '.join(f'{x},{y}' for x,y in pts)+f'" fill="{o["color"]}"/>')
 svg+=['</g></svg>']
 stem='OMNIS_전체시스템아키텍처' if no==1 else f'details/{no:02d}_'+['','', '런타임_업무처리','데이터_저장흐름','AI_보안경계','UI_정보구조','개발_배포운영'][no]
 slide['stem']=stem;(OUT/(stem+'.svg')).write_text('\n'.join(svg),encoding='utf8')
 # An uncompressed native diagrams.net page; text and vectors remain editable.
(OUT/'source/scenes.json').write_text(json.dumps(dict(width=1600,height=900,font=FONT,palette=C,slides=S),ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'evidence/text-fit.json').write_text(json.dumps(fit,ensure_ascii=False,indent=2),encoding='utf8')
mx=ET.Element('mxfile',host='app.diagrams.net',version='24.7.17')
for no,slide in enumerate(S,1):
 dg=ET.SubElement(mx,'diagram',id=f'omnis-{no}',name=slide['title']);gm=ET.SubElement(dg,'mxGraphModel',page='1',pageWidth='1600',pageHeight='900');root=ET.SubElement(gm,'root');ET.SubElement(root,'mxCell',id='0');ET.SubElement(root,'mxCell',id='1',parent='0')
 for o in slide['items']:
  if o['type']=='path':
   points=o['points'];cell=ET.SubElement(root,'mxCell',id=o['id'],parent='1',edge='1',style=f'edgeStyle=none;endArrow={"block" if o["arrow"] else "none"};strokeColor={o["color"]};strokeWidth=2;dashed={int(o["dash"])};');geo=ET.SubElement(cell,'mxGeometry',relative='1',**{'as':'geometry'});ET.SubElement(geo,'mxPoint',x=str(points[0][0]),y=str(points[0][1]),**{'as':'sourcePoint'});ET.SubElement(geo,'mxPoint',x=str(points[-1][0]),y=str(points[-1][1]),**{'as':'targetPoint'})
   ar=ET.SubElement(geo,'Array',**{'as':'points'})
   for x,y in points[1:-1]:ET.SubElement(ar,'mxPoint',x=str(x),y=str(y))
  else:
   style=(f'text;html=0;fontFamily={FONT};fontSize={o["size"]};fontColor={o["color"]};fontStyle={int(o["bold"])};align={o["align"]};verticalAlign=top;spacing=0;whiteSpace=wrap;fillColor=none;strokeColor=none;' if o['type']=='text' else f'rounded=1;arcSize=8;fillColor={o["fill"]};strokeColor={o["stroke"]};strokeWidth=1.5;dashed={int(o["dash"])};')
   cell=ET.SubElement(root,'mxCell',id=o['id'],value=o.get('text',''),style=style,vertex='1',parent='1');ET.SubElement(cell,'mxGeometry',x=str(o['x']),y=str(o['y']),width=str(o['w']),height=str(o['h']),**{'as':'geometry'})
ET.ElementTree(mx).write(OUT/'OMNIS_시스템아키텍처.drawio',encoding='utf8',xml_declaration=True)
print(json.dumps(dict(slides=len(S),objects=[len(sl['items']) for sl in S],textFitIssues=fit),ensure_ascii=False))




