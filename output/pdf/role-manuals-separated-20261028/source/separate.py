"""Role-specific authoring; source application is never edited by this module."""
import json,csv,re,hashlib,sys
from copy import deepcopy
import build_manuals as m
from build_manuals import *
from role_content import role_tasks,HANDOFF,PERMISSIONS
from pypdf import PdfReader

for file in ['current-ui.json','current-settings.json']:
 d=json.loads((EV/file).read_text('utf8'));m.screens.update({x['id']:x for x in d['screens']})
CURRENT=json.loads((EV/'current-ui.json').read_text('utf8'))
ROLE_DATA=deepcopy(ROLES)
ROLE_DATA['VIEWER']['edge']='AI 지원의 분석 및 유사 고장 조회는 권한 오류가 발생합니다. 분류와 유사 검색 모두 금지되므로 반복하지 않습니다. 일일 요약 생성·정비 우선순위 조회는 사용할 수 있습니다.'
LIMITS_NEW=deepcopy(LIMITS)
LIMITS_NEW[0]=('L01','허용 범위 밖의 고장 정보 노출 주의','이전 P01·P02 재현 / 현재 조회 경로 코드 대조. USER 일일 AI 요약은 현재 거부됨.','일반 사용자는 본인 고장관리 화면을 기준으로 처리합니다. 상황판·유사 검색·CSV·인계 초안에 타인의 자료가 나타나면 이용·공유를 중단하고 관리자에게 알립니다.')
LIMITS_NEW[6]=('L07','화면에 금지된 AI 버튼 노출','현재 5개 역할 UI 실행 확인','일반 사용자는 AI 요약·정비 추천을, 조회전용은 AI 분류·유사 검색을 실행할 수 없습니다. 인계 저장도 조회전용은 금지됩니다.')
LIMITS_NEW[10]=('L11','외부 모델·설치·실제 장비는 미검증','현재 Local Rule / Windows 소스 실행 확인','Ollama·OpenAI·Anthropic 실제 연결·모델 품질·과금·키 저장·설치 업데이트·macOS·장비 조작은 검증하지 않았습니다.')

READ_ONLY={'R01','R02','R03','R04','R05','C03','C04','C08','T16'}
OLD_ROLES={'C01':ALL,'C02':['USER'],'C03':ALL,'C04':ALL,'C05':['USER'],'C06':['OPERATOR'],'C07':['OPERATOR'],'C08':['VIEWER'],'T01':['USER'],'T02':['USER'],'T03':['USER'],'T04':['USER'],'T05':['USER'],'T06':['OPERATOR'],'T07':['OPERATOR'],'T08':['MAINTAINER'],'T09':['MAINTAINER'],'T10':['OPERATOR','USER'],'T11':['MAINTAINER'],'T12':['MAINTAINER'],'T13':['MAINTAINER'],'T14':['OPERATOR'],'T15':['MAINTAINER'],'T16':['ADMIN'],'T17':['ADMIN'],'T18':['MAINTAINER'],'T19':['USER'],'T20':['OPERATOR'],'T21':['OPERATOR'],'A01':['ADMIN'],'A02':['ADMIN'],'A03':['ADMIN'],'A04':['ADMIN'],'A05':['ADMIN'],'A06':['ADMIN'],'A07':['ADMIN']}
# Attribution is based on the actual role in prior UI result records.
OLD_ROLES.update({'C02':[],'C03':['ADMIN'],'C07':['ADMIN'],'T01':['OPERATOR'],'T02':['OPERATOR'],'T18':['OPERATOR'],'T19':['OPERATOR'],'T21':['VIEWER'],'A03':[],'A06':[],'A07':[]})

def verification(role,t):
 id=t['id'];old=role in OLD_ROLES.get(id,[])
 if id=='C02':return ('실제 UI 실행 확인(기존 로그인 전 증거)','이전 UI01의 로그인 전 신청 화면. 아직 역할이 부여되지 않은 신청이며 특정 승인 역할의 실행 검증이 아님.','evidence/previous/ui-results.json')
 if id=='T13':return ('코드·설정 확인 + 기존 UI 증거','현재 캘린더는 작업 클릭 상세 열기를 구현하지 않음. 목록 상세 조회로 안내 수정. 이전 UI09 촬영은 MAINTAINER 역할.','evidence/snapshot/src/renderer/src/MaintenanceManagement.tsx; evidence/previous/ui-results.json')
 if id in ['C06','C08']:return ('실제 UI 실행 확인','현재 '+role+'의 AI 실행/거부·내부 권한 검사. Local Rule만 실행.','evidence/current-ui.json')
 if id=='C01':return ('실제 UI 실행 확인','현재 '+role+' 로그인·로그아웃·메뉴 진입 확인.','evidence/current-ui.json')
 if id=='C04' or id.startswith('R'):return ('실제 UI 실행 확인 + 코드·설정 확인','현재 '+role+'의 메뉴·목록 확인. 상세의 모든 조합은 재실행하지 않음.','evidence/current-ui.json; evidence/snapshot/src')
 if id=='T21'and role=='VIEWER':return ('실제 UI 실행 확인','현재 조회전용의 확인 클릭과 재조회.','evidence/current-ui.json')
 if id=='T06'and role=='ADMIN':return ('실제 UI 실행 확인 + 코드·설정 확인','현재 AI 검토창 조회. 반영 버튼 실행은 이전 OPERATOR 증거와 코드 확인.','evidence/current-ui.json; evidence/previous')
 if id=='A02':return ('실제 UI 실행 확인 + 내부 호출·자동화 테스트 확인','현재 로컬 설정 저장, 동의 누락 거부. 외부 비활성 방어는 내부 호출. 외부 연결 미검증.','evidence/current-ui.json; evidence/current-settings.json')
 if old:return ('실제 UI 실행 확인(기존 증거 재사용)','이전 '+role+' 실행 증거와 현재 관련 코드 대조. 이번에 동일 동작을 재실행한 뜻은 아님. '+t['check'],'evidence/previous; evidence/snapshot/src')
 return ('코드·설정 확인','이 역할의 상세 조작 전체는 UI 미검증. 타 역할 화면은 공통 화면 구조 설명용. '+t['check'],'evidence/snapshot/src; evidence/previous')

def kind(role,t):
 id=t['id']
 if id in READ_ONLY or id=='T13'and role not in ['ADMIN','MAINTAINER'] or id=='C05'and role=='VIEWER' or id=='C07'and role=='USER':return '조회·확인 / 담당자에게 요청'
 if role=='MAINTAINER'and id in ['T08','T09','T10','T12','T15']:return '조건부 직접 수행(배정·팀·상태 확인)'
 if role=='USER'and id in ['T01','T02','T18','T19']:return '조직에서 맡긴 경우 직접 수행'
 return '직접 수행(각 절차 사전 조건 적용)'

class SeparatedBook(Book):
 def __init__(self,role):
  super().__init__(role);self.tasks=role_tasks(role);self.tasks.sort(key=lambda t:({'C':0,'R':1,'T':2,'A':3}[t['id'][0]],t['id']))
  self.ids={t['id']for t in self.tasks};self.byid={t['id']:t for t in self.tasks};self.refs=[]
  for t in self.tasks:
   if t['id']=='A02':t['shot']='current-settings-provider'
   if t['id']=='A03':t['shot']='current-settings-sla'
   if t['id']in ['A04','A07']:t['shot']='current-settings-data'
   for key in ['pre','result','next','fix','warn']:
    t[key]=self.clean_refs(t[key])
   t['steps']=[self.clean_refs(s)for s in t['steps']]
 def clean_refs(self,text):
  return re.sub(r'\b[CTA]\d{2}\b',lambda a:a[0] if a[0]in self.ids else '해당 담당자의 후속 업무',text)
 def link(self,id):
  if id not in self.ids:raise ValueError('Foreign task reference '+id)
  self.refs.append(id);return f'<link href="#{id}" color="#087F8C">{id} {escape(self.byid[id]["title"])}</link>'
 def picture(self,id,caption=None,maxh=240,crop=None,marks=False):
  meta=m.screens[id];period='현재 재확인 화면'if id.startswith('current-')else'기존 실행 증거 재사용'
  self.story.append(Shot(meta,maxh,crop,marks));self.p((caption or meta['caption'])+' | '+period+' · 촬영: '+NAMES.get(meta['role'],meta['role'])+' · 가상 자료','small');self.md.append(f'![{caption or meta["caption"]}]({meta["file"]})\n')
 def cover(self):
  self.story.append(Spacer(1,60));self.p('OMNIS 1.0.0 | 역할별 독립 매뉴얼','label');self.p(NAMES[self.role]+'\n사용자 매뉴얼','cover');self.p(self.role+' · 처음 로그인한 날부터 업무 인계까지');self.story.append(Spacer(1,20))
  self.rows(['항목','적용 기준'],[['확인 기준일','2026-10-28 / 한국 표준시(KST)'],['앱 기준','1.0.0 / Windows 소스 실행 / DB 스키마 v5'],['기준 커밋',manifest['head']],['미커밋 변경','포함. 기존 매뉴얼 기준 이후 25개 변경·신규 파일을 포함한 95개 파일 스냅샷'],['대상 역할',NAMES[self.role]+' ('+self.role+')'],['독립 사용','공통 설명·필요한 화면·용어·목차를 이 문서에 수록']],[105,CW-105])
  self.sub('주요 업무',ROLE_DATA[self.role]['purpose']);self.p('적용 소스는 2026-10-28 09:51 KST에 고정했습니다. 작성 중 다른 작업에서 AI 화면·설정·검사 코드 등이 변경되어, 그 이후 변경은 이 문서의 검증 대상에 포함하지 않았습니다. 현재 작업 폴더 전체의 최신 동작을 보증하는 문서는 아닙니다.','small');self.p('공통 화면을 다른 역할로 촬영한 경우 캡션에 촬영 역할을 표시합니다. 이는 해당 역할의 실행 권한을 증명하는 것이 아닙니다. 절차별 검증 수준과 사전 조건을 함께 읽으세요.','small')
 def front(self):
  self.h('목차','toc');toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc0',fontName='MGB',fontSize=10,leading=15,textColor=NAVY,spaceBefore=6),ParagraphStyle('toc1',fontName='MG',fontSize=8.7,leading=13,leftIndent=12,textColor=GRAY)];toc.dotsMinLevel=0;self.story.append(toc)
  self.h('1. 처음 사용하는 사람을 위한 안내','start')
  self.sub('이 문서를 사용하는 방법','본인 역할이 '+NAMES[self.role]+'인지 확인한 뒤 빠른 시작을 읽습니다. 이후 목차나 마지막 업무별 찾아보기에서 필요한 절차를 선택합니다. 절차 ID와 내부 링크는 모두 이 PDF 안에서 연결됩니다.')
  self.sub('프로그램 시작과 계정','설치 담당자가 제공한 OMNIS를 실행합니다. 첫 로그인을 위한 계정은 등록 신청 후 관리자 승인이 필요합니다. 승인된 계정을 사용하고 왼쪽 아래 이름·역할을 확인합니다. 새 PC 설치·업데이트는 검증 범위 밖이므로 설치 담당자의 안내를 따릅니다.')
  self.sub('종료와 교대','입력 중인 창의 저장 여부를 확인합니다. 목록과 상세에서 결과를 다시 읽고 로그아웃을 누릅니다. 프로그램은 창 닫기로 종료합니다. 다음 사람은 자신의 계정으로 로그인합니다. 앱 종료를 저장 버튼 대신 사용하지 않습니다.')
  self.sub('화면의 기본 구조','왼쪽 메뉴로 업무 화면을 이동합니다. 상단 제목과 기준일을 확인하고 목록에서 검색·필터·상세를 사용합니다. 재로그인하면 직전 메뉴가 남을 수 있으므로 통합상황판을 직접 선택해 시작 위치를 맞춥니다.')
  self.picture('current-'+self.role+'-dashboard','본인 역할 표시와 왼쪽 메뉴를 먼저 확인합니다.',maxh=235)
  self.sub('현재 지원하지 않는 일','다중 PC 실시간 자료 공유, 실제 장비 자동 제어, 기존 계정 역할 정정·비밀번호 찾기·DB 복원 UI, 저장한 인수인계 다시 열기, 정비 캘린더 드래그 변경은 지원하지 않습니다.')
  self.h('저장·상태·날짜를 읽는 기준','basics',1)
  self.rows(['확인 대상','사용자가 확인할 내용'],[['저장과 완료','저장은 값이 기록되는 것, 완료·검증·종결은 각각 업무 상태가 바뀌는 것입니다. 저장 메시지 뒤 목록·상세·이력을 다시 확인합니다.'],['검색 결과 없음','검색어·상태·중요도·날짜·담당자 조건을 지우고 다시 조회합니다. 일반 사용자는 본인 고장만 표시됩니다.'],['상태 표시','조치완료는 조치 기록, 검증은 결과 검토, 종결은 실제 요청자 확인 후 종료입니다. 색상만 보지 말고 상태명을 읽습니다.'],['날짜·시간','화면 시각은 한국 표준시로 읽습니다. 일일 PDF는 UTC 기준 집계와 차이가 있어 자정~08:59 기록을 별도로 대조합니다.'],['08:30 / 16:00','업무 기준시간 표기입니다. 자동 입력 잠금·자동 마감 시각이 아닙니다.'],['알림·확인','지시 읽음 확인, 경보 인지, 복구 확인은 의미가 다릅니다. 버튼 이름이 같아도 무엇을 확인하는지 읽습니다.'],['자동 값','작업판 실적은 별도 입력입니다. 정비 완료로 자동 집계되거나 이월 작업이 자동 생성되지 않습니다.']],[93,CW-93])
  self.sub('민감 정보 없이 문의하기','역할, 접수·작업번호, 화면 경로, 발생 시각, 메시지, 기대한 결과를 전달합니다. 비밀번호·API 키·불필요한 개인정보는 전달하지 않습니다.')
  self.h('2. 이 역할의 권한과 책임','permissions')
  self.p('이 표는 현재 코드의 역할·소유권·팀·상태 조건을 대조한 결과입니다. 모든 조합을 UI에서 실행한 표가 아닙니다. 실제 실행 범위는 각 절차와 검증 장을 확인합니다.')
  col=ALL.index(self.role)+1;self.rows(['업무','현재 역할의 범위'],[[x[0],x[col]]for x in PERMISSIONS],[CW-160,160])
  self.p('¹ 연결 고장·정비가 없는 체계만 삭제. ² 첨부는 소유권·팀·업무 상태 조건이 별도이며 삭제는 관리자/등록자 제한. ³ 버튼이 보여도 Main에서 거부될 수 있음. ⁴ 허용 범위 밖 정보 노출 가능성이 있어 활용·공유를 중단하고 문의.','small')
  scope={'ADMIN':'전체 업무를 관리할 수 있습니다. 담당자가 확인해야 할 사실을 대신 만들어 기록하지 않습니다. 종결·완료 건의 첨부 변경도 가능하므로 보존 필요성을 먼저 확인합니다.','OPERATOR':'전체 고장을 검토·배정할 수 있습니다. 정비 등록·정비 결과 수정과 일일 마감은 수행할 수 없습니다. 정비 첨부 추가 권한과 정비 작업 수정 권한은 다릅니다.','MAINTAINER':'고장 상태 변경은 개인 배정 또는 가용 소속팀 조건을 확인합니다. 정비 작업 변경은 본인 개인 담당 조건입니다. 소속팀 작업이라는 이유만으로 다른 사람의 정비를 수정할 수 없습니다.','USER':'고장 목록·상세는 본인 접수이며 내용 수정은 접수 상태에서 가능합니다. 본인 검증 건만 종결합니다. 체계·근무 변경과 인계 기록은 권한이 있으나 조직에서 맡긴 경우에만 사용합니다.','VIEWER':'업무 정보를 조회하고 지시를 읽음 확인할 수 있습니다. CSV/PDF·AI 요약·정비 추천도 허용되지만 자료 공유 범위는 별도로 확인합니다. 등록·수정·삭제·배정·마감·인계 저장은 수행하지 않습니다.'}
  self.sub('본인 건·개인 배정·팀·전체의 차이',scope[self.role]);self.sub('누구에게 요청하나요?',HANDOFF[self.role][0]+'에게 요청합니다. '+HANDOFF[self.role][1])
 def role_chapters(self):
  r=self.role;d=ROLE_DATA[r];self.h('3. 빠른 시작과 하루 업무','roles');self.sub('첫 사용 준비',d['ready']);self.sub('처음 수행할 대표 업무','아래 순서의 절차를 열고 가상 실습값으로 연습합니다. 실습은 교육용 환경에서만 수행합니다.')
  for id in d['quick']:self.p(self.link(id),raw=True)
  self.h('권장 하루 업무 흐름','day',1)
  self.p('아래 순서는 권장 업무 흐름입니다. 필수 입력·역할 조건·상태 전이는 실제 시스템 제한입니다.')
  for n,s in enumerate(d['daily'],1):self.sub(str(n)+'. '+s.split(':')[0],s.split(':',1)[1].strip())
  self.sub('내가 인계할 정보',HANDOFF[r][1]);self.sub('다음 담당자의 결과 확인',HANDOFF[r][2]);self.rows(['자주 하는 실수','확인 방법'],[[s,'번호·역할·현재 상태·저장 결과를 다시 읽고 해당 절차의 제한을 확인합니다.']for s in d['avoid']],[CW*.62,CW*.38])
 def task_chapters(self):
  self.h('4. 업무별 상세 사용 방법','tasks');self.p('직접 수행·조건부 수행·조회/요청을 각 절차에 표시했습니다. 읽기 → 준비 → 조작 → 결과 확인 → 인계 순서로 사용하세요. 화면 캡션과 검증 수준으로 현재 촬영과 기존 증거를 구분합니다.')
  self.rows(['구분','수록 내용'],[['공통 C','계정·검색·상황판·역할에 맞는 첨부와 AI·보고서'],['조회 R','체계·고장·정비·작업판·근무/지시 읽기'],['업무 T','이 역할에 허용된 업무 수행 또는 조회·요청'],['관리 A','관리자 파일에만 계정 승인·설정·백업 등 포함']],[80,CW-80])
  for t in self.tasks:
   self.h(t['id']+' '+t['title'],t['id'],1);self.p(kind(self.role,t)+'\n이동: '+t['where'],'small');self.sub('언제 사용하는가',t['when']);self.sub('시작하기 전에',t['pre']);self.story.append(par('따라 하기','label'))
   for n,s in enumerate(t['steps'],1):self.p(f'{n}. {s}')
   if t['fields']:self.rows(['항목','필수 여부','의미·형식','예시'],t['fields'],[102,62,168,CW-332])
   self.h(t['id']+' 화면과 완료 확인',t['id']+'-screen',1)
   sid=t['shot']
   if sid:
    iw,ih=PIL.open(ROOT/m.screens[sid]['file']).size
    if t['id']=='C01':self.picture(sid,'로그인 화면의 계정 입력 영역',maxh=250,crop=(1140,280,440,470))
    elif t['id']=='T12':
     self.picture(sid,'원인·조치·결과 입력 영역',maxh=240,crop=(0,260,600,420));self.picture(sid,'완료 버튼으로 결과 저장',maxh=46,crop=(0,866,600,70))
    elif t['id']=='A02':
     self.picture(sid,'AI Provider 설정 상단: 로컬 제공자와 모델·시간·요청 한도',maxh=270,crop=(0,0,iw,min(ih,600)))
    elif iw>1400:
     self.picture(sid,maxh=205)
     # Crop is a magnification of the actual capture, never a synthetic UI.
     crops={'C06':(300,190,620,345),'C08':(950,190,620,345),'T21':(300,345,850,250),'T13':(300,280,1000,260),'T16':(300,390,1000,260)}
     cx,cy,cw,ch=crops.get(t['id'],(300,155,950,230));cw=min(cw,iw-cx);ch=min(ch,ih-cy)
     self.picture(sid,'확대 보기: 화면의 목록·입력 영역',maxh=120,crop=(cx,cy,cw,ch))
    else:self.picture(sid,maxh=270)
   self.sub('정상 결과 확인',t['result']);self.sub('다음 담당자와 후속 업무',t['next']);self.sub('잘못 처리했을 때',t['fix']);self.sub('주의·제한',t['warn']);lev,detail,ev=verification(self.role,t);self.p('검증 수준: '+lev+'\n'+detail,'small')
   if t['id']=='A02':
    self.h('외부 AI 설정 항목을 읽는 방법','external-ai',1)
    self.p('다음은 화면·코드 확인 범위입니다. 실제 API 키 저장·외부 연결·비용·응답 품질은 검증하지 않았습니다. 사용 승인이 없다면 Local Rule를 유지합니다.')
    self.picture(sid,'API 키 상태·활성화 동의·저장 버튼 영역',maxh=285,crop=(0,max(0,ih-650),iw,min(650,ih)))
    self.rows(['항목','의미와 주의'],[['Provider 선택','Ollama는 준비된 로컬 모델 서버, OpenAI와 Anthropic은 외부 API입니다. 선택만으로 연결이 성공하지 않습니다.'],['Model','모델 이름과 이용 가능 여부를 관리자가 확인합니다. 표시 기본값을 현재 이용 가능한 모델로 보증하지 않습니다.'],['API Key 저장/교체','입력값은 마스킹됩니다. Windows 보안 저장소 이용 가능 여부와 환경변수 키 우선순위를 확인합니다. 키 원문을 보고서에 남기지 않습니다.'],['삭제','앱 저장 키 삭제이며 환경변수 자격증명 제거를 대신하지 않습니다. 삭제 후 configured 표시가 남을 수 있습니다.'],['연결 시험','실제 모델 호출·외부 전송·비용이 생길 수 있습니다. 조직 승인 후 시험하고 마지막 시험 상태를 읽습니다.'],['동의·요청 한도','외부 사용 활성화와 전송·비용 동의가 필요합니다. 요청 횟수 한도는 금액 상한이 아닙니다.'],['실패 / fallback','연결 시험 실패와 실제 업무의 대체 규칙 결과를 구분합니다. 대체 결과를 원래 모델 성공으로 보고하지 않습니다.']],[105,CW-105])
 def scenarios(self):
  d=ROLE_DATA[self.role];self.h('5. 역할별 실습과 인수인계','scenario');self.sub('가상 사례','교육용 회선 장애: 가상 교육실 단말 2대의 접속 불가. 실제 장비 제어를 수행하는 실습이 아닙니다. 생성된 접수번호와 작업번호를 기록하며 역할을 바꾸면 본인 계정으로 다시 로그인합니다.');self.sub('정상 실습: 내가 수행할 일',d['normal']);self.sub('예외 실습',d['edge'])
  self.rows(['연습 자료','값 또는 확인 기준'],[['제목 / 증상','교육용 회선 장애 / 가상 교육실 단말 2대 접속 불가'],['대상 체계','교육 환경에 존재하는 가상 통신 체계를 선택. 새 체계는 허용 역할만 등록'],['시각','교육 진행 당일 실제 입력 시각, 한국 표준시. 문서 날짜를 무조건 복사하지 않음'],['처리 근거','교육용 점검: 원인 가설과 확인 사실을 구분. 실제 복구 확인을 임의로 체크하지 않음'],['결과','역할별 상세 절차의 상태·저장 결과와 대조. 존재하지 않는 승인·재개 버튼 사용 금지']],[96,CW-96])
  self.rows(['완료 점검','확인할 내용'],[[str(n+1),s]for n,s in enumerate(d['done'])],[65,CW-65])
  self.h('한 건의 업무가 이어지는 지점','handoff',1)
  self.rows(['단계·주체','이 역할이 이해하고 확인할 결과'],[['접수 / 요청자','증상·영향·발생 시각이 담긴 접수번호 생성'],['분류·배정 / 운용 담당','분류 상태와 정비반·개인 담당자 확정. AI 반영만으로 배정되는 것은 아님'],['조치 / 배정 담당','조치 방법·원인·결과·잔여 작업 기록, 조치완료 상태'],['검증 / 권한 있는 담당','근거 검토 후 검증 상태. 실제 요청자 확인을 대신하지 않음'],['종결 / 요청자 또는 권한 담당','요청자의 실제 복구 확인 사실을 근거로 종결. 재개 UI 없음']],[135,CW-135])
  self.sub('이 역할이 전달할 정보',HANDOFF[self.role][1]);self.sub('회신을 받은 뒤',HANDOFF[self.role][2]);self.story.append(Flow([[('접수','증상·영향 기록'),('배정','팀·개인 확인'),('조치완료','결과 기록')],[('검증','결과 검토'),('종결','실제 복구 확인')]]));self.p('대표 경로입니다. 모든 화살표를 이 역할이 누르는 것이 아닙니다. 각 단계의 직접 수행 여부는 권한표와 상세 절차를 따릅니다.','small')
  self.h('계획·실적·마감 인계 사례','plan-scenario',1)
  self.rows(['기록','예시','책임'],[['계획 / 비계획','2 / 1','가용 소속팀 정비요원 또는 관리자'],['완료 / 이월','2 / 1 → 완료율 67%','원본 정비와 실제 처리 사실 대조'],['미완료 사유','가상 점검 장비 확보 대기 1건','팀 담당자'],['마감 판단','기준일·문제·예외 확인','관리자'],['인계','번호·상태·미완료·다음 담당·확인 시각','허용 역할의 기록 / 조회전용은 요청']],[100,200,CW-300])
  self.sub('이 역할의 참여',{'ADMIN':'정합성 문제와 원본 기록을 대조한 뒤 마감 여부를 판단합니다. 예외 마감 이유와 후속 책임을 남깁니다.','MAINTAINER':'소속팀 계획·실적·이월을 실제 근거로 입력합니다. 고장과 정비 상태를 따로 확인한 뒤 관리자에게 마감을 요청합니다.','OPERATOR':'조회한 불일치를 정비 담당자에게 전달하고 결과를 재확인합니다. 마감은 관리자에게 요청합니다.','USER':'본인 관련 기록을 확인하고 필요한 보완·인계를 운용요원에게 전달합니다. 조직에서 맡긴 인계 기록만 저장하며 전체 초안의 타인 정보를 공유하지 않습니다.','VIEWER':'기준일·팀·마감 상태를 읽고 차이를 관리자에게 전달합니다. 작업판 입력·마감·인계 저장을 수행하지 않습니다.'}[self.role])
  self.sub('자동으로 처리되지 않는 부분','정비 완료가 작업판 실적을 자동 계산하지 않습니다. 이월 숫자가 다음날 정비를 만들지 않으며 16:00에 자동 마감되지 않습니다. 확정 인계는 앱에서 다시 열 수 없으므로 담당자가 승인된 별도 기록에 보관합니다.')
  self.h('한 장 업무 요약','one-page',1);self.p(d['purpose']);self.rows(['순서','빠른 이동'],[[str(n+1),self.byid[id]['title']+' ('+id+')']for n,id in enumerate(d['quick'])],[48,CW-48]);self.sub('시작','본인 역할·날짜·번호·배정 조건을 확인합니다.');self.sub('진행','한 번 실행한 뒤 목록·상세·이력을 다시 읽습니다. 권한 오류는 반복하거나 우회하지 않습니다.');self.sub('마무리',HANDOFF[self.role][1]);self.sub('즉시 문의','타인 정보 노출, 잘못된 종결·마감, 자료 유실 의심, 화면·권한 불일치, 보고 수치 차이를 역할·번호·시각·메시지와 함께 관리자에게 전달합니다.');self.p('자세한 입력값과 제한은 이 PDF의 업무별 절차를 확인하세요.','small')
 def ending(self):
  self.h('6. 문제 해결과 문의','faq')
  for n,(q,a)in enumerate(FAQ,1):
   if self.role=='VIEWER'and n in [4,6,7,8,9,11,16,18,19]:continue
   if self.role in ['USER','OPERATOR']and n==7:continue
   self.story.append(KeepTogether([par(q,'label'),par(a)]));self.md.extend(['### '+q,a+'\n'])
  self.sub('역할별 AI 권한 오류',('일반 사용자는 분석·유사 검색만 사용할 수 있습니다. 일일 요약·정비 추천은 담당자에게 요청합니다.'if self.role=='USER'else'조회전용은 일일 요약·정비 추천만 사용할 수 있습니다. 분류·유사 검색은 운용요원에게 요청합니다.'if self.role=='VIEWER'else'결과의 제공자·외부 전송·대체 규칙 표시를 확인합니다. 입력과 실제 증상을 대조한 후 승인된 업무 범위에서만 활용합니다.'))
  self.sub('문의 양식','역할: ___ / 발생일시(KST): ___ / 업무 번호: ___\n화면과 버튼: ___ / 기대 결과: ___ / 실제 메시지: ___\n저장·재조회 여부: ___ / 다음 담당자: ___\n비밀번호·키·개인정보는 기록하지 않습니다.')
  self.h('7. 알려진 제한과 검증 범위','limits')
  skip={'ADMIN':set(),'OPERATOR':{'L05'},'MAINTAINER':{'L04','L05','L08'},'USER':{'L05','L08'},'VIEWER':{'L04','L05','L08'}}[self.role]
  for id,title,evidence,action in LIMITS_NEW:
   if id in skip:continue
   if self.role=='VIEWER'and id=='L06':action='인수인계 저장·확정은 금지입니다. 저장된 인계 재조회 UI도 없으므로 담당자에게 승인된 인계 자료를 요청합니다.'
   self.story.append(KeepTogether([par(id+' '+title,'label'),par(evidence,'small'),par(action)]));self.md.extend(['### '+id+' '+title,evidence,action+'\n'])
  self.h('이번에 확인한 것과 확인하지 않은 것','validation',1)
  self.p('아래 결과는 2026-10-28 09:51에 고정한 소스에 적용합니다. 이후 AI 설정·화면과 테스트 등이 추가 변경됐습니다. 이후 코드의 수정 완료 여부·검사 결과는 별도 재검증 대상이며, 여기 기록한 실패가 최신 작업 폴더에도 그대로 남아 있다고 단정하지 않습니다.','small')
  self.sub('현재 실제 UI 확인','5개 역할로 로그인하고 통합상황판·운영현황·고장관리·정비관리·통제·일일마감·근무/지시사항·통계 메뉴를 열어 캡처했습니다. 역할별 AI 실행·거부를 확인했으며 관리자 로컬 설정 저장·외부 활성화 동의 누락 거부, 조회전용 지시 읽음 확인을 수행했습니다.')
  self.sub('내부 호출과 기존 증거','AI 네 종류의 역할별 호출, 외부 비활성 연결 방어와 비관리자 설정 변경 거부는 내부 호출로 보완했습니다. 변경되지 않은 업무의 이전 UI 증거는 촬영 역할과 시점을 구분해 재사용했습니다. 모든 상태·권한 조합을 새로 UI 실행한 것은 아닙니다.')
  self.rows(['검사','실제 결과'],[['타입 / seed / build','통과'],['Lint','오류 10건. 애플리케이션 소스는 수정하지 않음'],['단위·통합','31건 중 29건 통과, 2건 실패. DB 스키마 기대값 4와 현재 5의 불일치'],['기존 E2E','smoke·signup·visual-check 통과. roles·operations-flow는 기존 AI 설정 입력 형식 불일치로 중단'],['보완 검증','현재 입력 형식으로 비관리자 AI 설정 변경 거부를 별도 내부 호출 확인'],['외부·설치','실제 API 키·외부 모델·Ollama 연결, 새 PC 설치·업데이트·macOS·장비 조작 미검증']],[115,CW-115])
  self.p('실패한 기존 테스트를 통과로 바꾸어 기록하지 않았습니다. UI 캡처와 내부 호출은 서로 다른 검증 수준입니다. 일부 이전 첨부·파일 저장 검증은 OS 대화상자 경로 지정을 대체했으며 Windows 기본 앱 열기는 미검증입니다.','small')
  self.h('8. 용어집과 찾아보기','glossary');self.rows(['용어','뜻과 확인 방법'],GLOSSARY,[115,CW-115]);self.h('업무·메뉴별 바로 가기','index',1)
  for t in self.tasks:self.p(escape(t['where'])+' → '+self.link(t['id']),raw=True)
  self.h('문서 적용 기준','provenance',1);self.p('커밋: '+manifest['head']+'\n스냅샷 고정 시각: '+manifest['capturedAt']+'\n역할: '+NAMES[self.role]+' / '+self.role);self.p('동일 커밋이어도 미커밋 소스가 달라지면 화면·권한이 달라질 수 있습니다. 이 문서는 evidence/source-manifest.json의 95개 파일 스냅샷을 기준으로 작성했습니다. 앱 소스와 운영 데이터를 변경하지 않았습니다. 이후 변경 여부는 source-drift-final.json을 확인합니다.');self.p('각 PDF의 Markdown 원본과 역할별_절차원본.json, source의 생성 코드를 함께 제공합니다. 검증 증거는 evidence, 실제 화면은 screenshots에 있습니다. 이 문서 안의 링크는 이 파일의 페이지로 이동합니다.')
 def build(self):
  self.cover();self.front();self.role_chapters();self.task_chapters();self.scenarios();self.ending()
  name=f'{ALL.index(self.role)+1:02}_'+NAMES[self.role].replace(' ','')+'_'+self.role+'_사용자매뉴얼';pdf=ROOT/(name+'.pdf');doc=Doc(str(pdf),pagesize=A4,title='OMNIS '+self.title,author='OMNIS role manual');doc.pages={}
  def frame(c,d):
   c.saveState();c.setFillColor(GRAY);c.setFont('MG',8)
   if d.page>1:c.drawString(L,H-28,'OMNIS | '+self.title);c.drawRightString(W-L,H-28,'2026-10-28 · '+self.role);c.setStrokeColor(colors.HexColor('#D7E2EC'));c.line(L,H-35,W-L,H-35)
   c.drawString(L,23,'본인 역할·업무 상태·저장 결과를 확인하세요');c.drawRightString(W-L,23,str(d.page));c.restoreState()
  doc.addPageTemplates(PageTemplate(id='all',frames=[Frame(L,43,CW,H-95,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=frame));doc.multiBuild(self.story)
  (ROOT/(name+'.md')).write_text('\n'.join(self.md),'utf8');return dict(file=pdf.name,role=self.role,title=self.title,pages=len(PdfReader(pdf).pages),anchors=doc.pages,tasks=[t['id']for t in self.tasks],references=self.refs,sha256=hashlib.sha256(pdf.read_bytes()).hexdigest())

if __name__=='__main__':
 books=[];data={};coverage=[]
 selected=set(sys.argv[1:])or set(ALL)
 oldbooks={b['role']:b for b in json.loads((EV/'books.json').read_text('utf8'))}if selected!=set(ALL)else{}
 for role in ALL:
  b=SeparatedBook(role);res=b.build()if role in selected else oldbooks[role];books.append(res);data[role]=b.tasks
  if role in selected:print(res['file'],res['pages'],flush=True)
  for t in b.tasks:
   lev,detail,ev=verification(role,t);coverage.append([role,NAMES[role],t['id'],t['title'],kind(role,t),t['where'],t['pre'],' / '.join(t['steps']),t['result'],lev,detail,ev,t['warn']])
 (EV/'books.json').write_text(json.dumps(books,ensure_ascii=False,indent=2),'utf8');(ROOT/'역할별_절차원본.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),'utf8')
 with (ROOT/'역할별_수록업무_및_검증범위.csv').open('w',encoding='utf-8-sig',newline='')as f:csv.writer(f).writerows([['역할코드','역할명','절차ID','업무','수행구분','이동경로','사전조건','수행절차','예상결과','검증수준','실제확인범위','증거','제한']]+coverage)
 with (ROOT/'역할별_권한_및_업무표.csv').open('w',encoding='utf-8-sig',newline='')as f:csv.writer(f).writerows([['업무']+[NAMES[r]for r in ALL]]+PERMISSIONS)
 (ROOT/'알려진_제한사항_및_미검증항목.md').write_text('\n\n'.join(f'## {id} {title}\n{ev}\n{act}'for id,title,ev,act in LIMITS_NEW)+'\n\n실제 외부 AI 연결, API 키 저장, 모델 품질, OS 파일 열기, 새 PC 설치·업데이트는 미검증입니다. 현재 Lint 10건 오류, 단위·통합 29/31 통과, 기존 E2E 3/5 통과이며 실패는 로그에 보존했습니다.','utf8')
