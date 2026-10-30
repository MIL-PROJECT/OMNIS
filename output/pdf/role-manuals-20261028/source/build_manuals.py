from pathlib import Path
import json,re,csv,hashlib,datetime
from xml.sax.saxutils import escape
from PIL import Image as PIL
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate,PageTemplate,Frame,Paragraph,Spacer,PageBreak,Table,TableStyle,KeepTogether,Flowable
from reportlab.platypus.tableofcontents import TableOfContents
from content import TASKS,ALL,NAMES
import workflows,operations,admin
from guide import ROLES,PERMISSIONS,LIMITS,FAQ,GLOSSARY

ROOT=Path(__file__).resolve().parents[1];EV=ROOT/'evidence'
manifest=json.loads((EV/'source-manifest.json').read_text('utf8'))
screens={};observations=[]
for name in ['ui-results.json','supplement-results.json','attachment-retry-results.json']:
 d=json.loads((EV/name).read_text('utf8'));screens.update({x['id']:x for x in d['screens']});observations.extend(d['results'])
current={x['id']:x for x in observations}
for task in TASKS:
 if task['id']=='C05':task.update(shot='attachments',check='UI20: 파일 선택창 대체 / P08 / OS 기본 앱 열기 미검증')
 if task['id']=='T01':task.update(shot='system-create',check='UI19 실제 등록·조회')
 if task['id']=='T02':task.update(shot='system-status',check='UI19 실제 상태 변경')
 if task['id']=='T11':
  task['steps']=[x.replace('정비 유형·우선순위를 선택','작업유형을 입력하고 우선순위를 선택') for x in task['steps']]
  for row in task['fields']:row[0]=row[0].replace('정비 유형','작업유형')
TASKS.sort(key=lambda x:({'C':0,'T':1,'A':2}[x['id'][0]],x['id']))
BYID={x['id']:x for x in TASKS}
pdfmetrics.registerFont(TTFont('MG','C:/Windows/Fonts/malgun.ttf'));pdfmetrics.registerFont(TTFont('MGB','C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('MG',normal='MG',bold='MGB',italic='MG',boldItalic='MGB')
W,H=A4;L=44;CW=W-88
NAVY=colors.HexColor('#20335B');TEAL=colors.HexColor('#087F8C');GRAY=colors.HexColor('#586579');LIGHT=colors.HexColor('#F1F5F9');ORANGE=colors.HexColor('#A45A17')
S={
'body':ParagraphStyle('body',fontName='MG',fontSize=10,leading=16,spaceAfter=8,wordWrap='CJK',textColor=NAVY),
'small':ParagraphStyle('small',fontName='MG',fontSize=8.3,leading=12.7,spaceAfter=5,wordWrap='CJK',textColor=GRAY),
'h1':ParagraphStyle('h1',fontName='MGB',fontSize=22,leading=30,spaceAfter=18,textColor=NAVY,keepWithNext=True,wordWrap='CJK'),
'h2':ParagraphStyle('h2',fontName='MGB',fontSize=16,leading=23,spaceAfter=12,textColor=NAVY,keepWithNext=True,wordWrap='CJK'),
'label':ParagraphStyle('label',fontName='MGB',fontSize=10.3,leading=16,spaceBefore=8,spaceAfter=5,textColor=TEAL,keepWithNext=True),
'table':ParagraphStyle('table',fontName='MG',fontSize=8.5,leading=13,wordWrap='CJK',textColor=NAVY),
'th':ParagraphStyle('th',fontName='MGB',fontSize=8.7,leading=13,wordWrap='CJK',textColor=colors.white),
'cover':ParagraphStyle('cover',fontName='MGB',fontSize=29,leading=42,textColor=NAVY,spaceAfter=20),
}
def clean(s):return str(s).replace('\u2011','-').replace('\u2013','-').replace('\u2014','-')
def par(s,style='body',raw=False):return Paragraph(clean(s) if raw else escape(clean(s)).replace('\n','<br/>'),S[style])
class Shot(Flowable):
 def __init__(self,meta,maxh=320,crop=None,marks=True):
  Flowable.__init__(self);self.meta=meta;self.path=ROOT/meta['file'];self.iw,self.ih=PIL.open(self.path).size;self.crop=crop or (0,0,self.iw,self.ih);x,y,w,h=self.crop;self.scale=min(CW/w,maxh/h);self.width=w*self.scale;self.height=h*self.scale;self.marks=marks;self.hAlign='CENTER'
 def draw(self):
  c=self.canv;x,y,w,h=self.crop;k=self.scale;c.saveState();clip=c.beginPath();clip.rect(0,0,self.width,self.height);c.clipPath(clip,stroke=0);c.drawImage(str(self.path),-x*k,-(self.ih-y-h)*k,width=self.iw*k,height=self.ih*k,mask='auto')
  if self.marks:
   for i,b in enumerate(self.meta.get('boxes',[]),1):
    xx=(b['x']-x)*k;yy=(h-(b['y']-y)-b['height'])*k;c.setStrokeColor(TEAL);c.setLineWidth(1.3);c.rect(xx,yy,b['width']*k,b['height']*k,fill=0,stroke=1);c.setFillColor(TEAL);c.circle(xx+4,yy+b['height']*k-3,7,fill=1,stroke=0);c.setFillColor(colors.white);c.setFont('MGB',8);c.drawCentredString(xx+4,yy+b['height']*k-6,str(i))
  c.restoreState()
class Doc(BaseDocTemplate):
 def afterFlowable(self,f):
  if hasattr(f,'key'):
   title=f.getPlainText();self.canv.bookmarkPage(f.key);self.canv.addOutlineEntry(title,f.key,f.level,False);self.notify('TOCEntry',(f.level,title,self.page,f.key));self.pages[f.key]=self.page
class Flow(Flowable):
 def __init__(self,rows):
  Flowable.__init__(self);self.rows=rows;self.width=CW;self.height=len(rows)*76
 def draw(self):
  c=self.canv
  for ri,row in enumerate(self.rows):
   y=self.height-(ri+1)*76+16;gap=16;bw=(CW-gap*(len(row)-1))/len(row)
   for i,(state,actor) in enumerate(row):
    x=i*(bw+gap);c.setFillColor(LIGHT);c.setStrokeColor(TEAL);c.roundRect(x,y,bw,49,5,fill=1,stroke=1)
    c.setFillColor(NAVY);c.setFont('MGB',10);c.drawCentredString(x+bw/2,y+30,state);c.setFont('MG',8);c.drawCentredString(x+bw/2,y+12,actor)
    if i<len(row)-1:
     xx=x+bw+3;c.line(xx,y+25,xx+10,y+25);c.line(xx+10,y+25,xx+6,y+28);c.line(xx+10,y+25,xx+6,y+22)
   if ri<len(self.rows)-1:
    c.setFont('MG',8);c.drawCentredString(CW/2,y-10,'아래 줄 왼쪽 단계로 이어집니다')
class Book:
 def __init__(self,role=None):
  self.role=role;self.title='통합 역할별 사용자 매뉴얼' if not role else NAMES[role]+' 사용자 매뉴얼';self.tasks=[t for t in TASKS if not role or role in t['roles']];self.ids={t['id'] for t in self.tasks};self.story=[];self.md=[];self.counter=0
 def p(self,s,style='body',raw=False):self.story.append(par(s,style,raw));self.md.append(str(s)+'\n')
 def h(self,s,key,level=0,new=True):
  if new:self.story.append(PageBreak())
  el=par(s,'h1' if level==0 else 'h2');el.key=key;el.level=level;self.story.append(el);self.md.append('#'*(level+1)+' '+s+'\n')
 def sub(self,label,s):self.story.append(par(label,'label'));self.p(s)
 def rows(self,headers,rows,widths=None):
  cells=[[par(x,'th') for x in headers]]+[[par(x,'table') for x in row]for row in rows];t=Table(cells,colWidths=widths or [CW/len(headers)]*len(headers),repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,LIGHT]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,-1),.2,colors.HexColor('#DCE4EC'))]));self.story.extend([t,Spacer(1,8)]);self.md.extend(['| '+' | '.join(headers)+' |','| '+' | '.join('---'for _ in headers)+' |']+['| '+' | '.join(map(str,r))+' |' for r in rows]+[''])
 def link(self,id):
  return f'<link href="#{id}" color="#087F8C">{id} {escape(BYID[id]["title"])}</link>' if id in self.ids else f'{id} {escape(BYID[id]["title"])} (다른 담당 역할의 절차)'
 def picture(self,id,caption=None,maxh=310,crop=None,marks=True):
  if id not in screens:raise ValueError('Missing screenshot '+id)
  meta=screens[id];self.story.append(Shot(meta,maxh,crop,marks));self.p((caption or meta['caption'])+f' | 촬영 역할: {NAMES.get(meta["role"],meta["role"])} · 가상 교육 자료','small');self.md.append(f'![{caption or meta["caption"]}]({meta["file"]})\n')
 def cover(self):
  self.story.append(Spacer(1,68));self.p('OMNIS 1.0.0','label');self.p(self.title,'cover');self.p('화면을 따라 업무를 끝내는 실무 안내서\n접수·배정·조치·검증·종결 / 계획·마감·인수인계');self.story.append(Spacer(1,25));self.rows(['항목','적용 기준'],[['작성일','2026-10-28 / 한국 표준시'],['적용 대상','Windows 소스 실행, 로컬 가상 데이터'],['소스 기준',manifest['head']],['문서 대상','모든 역할' if not self.role else NAMES[self.role]+' ('+self.role+')'],['사용 원칙','실제 권한·화면·검증 범위를 구분하여 설명']],[105,CW-105]);self.p('스크린샷의 인물·장비·부대·업무는 교육용 가상 자료입니다. 실제 장비 조작이나 운영 도입 승인을 대신하지 않습니다.','small');self.p('처음에는 빠른 시작과 자신의 역할 안내를 읽고, 업무별 절차 ID를 목차에서 찾아 이동하세요.','body')
 def front(self):
  self.h('목차','toc');toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc0',fontName='MGB',fontSize=10,leading=15,textColor=NAVY,spaceBefore=6),ParagraphStyle('toc1',fontName='MG',fontSize=8.7,leading=13,leftIndent=12,textColor=GRAY)];toc.dotsMinLevel=0;self.story.append(toc)
  self.h('1. 처음 사용하는 사람을 위한 안내','start')
  self.sub('이 앱으로 할 수 있는 일','로컬 PC에서 체계 상태, 고장 접수, 정비 작업, 근무·지시사항, 일일 계획·마감과 보고 자료를 기록합니다. 기본 AI는 로컬 규칙 기반의 참고 추천입니다.')
  self.sub('현재 지원하지 않는 일','다중 PC의 실시간 공동 작업, 실제 장비 자동 제어, 외부 정비체계 자동 동기화, 사용자용 DB 복원·비밀번호 찾기·기존 계정 역할 변경, 달력 드래그 일정 변경은 지원하지 않습니다.')
  self.sub('자신의 역할 찾기','로그인 후 왼쪽 아래 사용자 이름 아래에 역할이 표시됩니다. 로그인 화면의 관리자/사용자 구분은 ADMIN과 나머지 역할을 구분합니다. 그 선택으로 권한이 바뀌지는 않습니다.')
  self.rows(['역할','주요 책임','먼저 읽기'],[[NAMES[r],ROLES[r]['purpose'].split('.')[0],', '.join(ROLES[r]['quick'])]for r in ([self.role]if self.role else ALL)],[76,300,CW-376])
  self.sub('표시의 의미','“실제 UI 실행 확인”은 화면 조작과 결과를 확인한 범위입니다. “코드·설정 확인”은 소스에서 확인했으나 모든 화면 조합을 실행한 것은 아닙니다. 파일 선택/저장 대화상자는 테스트 대체를 사용한 경우 별도 표시합니다.')
  self.h('시작 전 준비와 저장 확인 습관','prepare',1)
  self.rows(['준비','확인할 사항'],[['실행 환경','설치 담당자가 제공한 OMNIS를 실행합니다. 새 PC 설치본과 macOS 설치 검증은 이번 범위 밖입니다.'],['계정','승인된 본인 계정과 역할을 확인합니다. 데모 계정을 실사용 계정으로 공유하지 않습니다.'],['업무 정보','접수번호·작업번호·대상 체계·발생 시각·증상·영향·확인 근거를 준비합니다.'],['저장 확인','저장/처리 후 창이 닫히면 목록과 상세를 다시 열어 값·상태·이력을 확인합니다.'],['교대','한 PC의 계정을 바꿔 사용하는 흐름입니다. 작업 저장 후 로그아웃하고 다음 사람이 본인 계정으로 로그인합니다.'],['자료 보존','사용자 폴더의 DB나 첨부를 직접 이동·삭제하지 않습니다. 백업은 관리자 기능입니다.']],[100,CW-100])
  self.sub('모든 역할의 첫 5분','1. 접속 구분을 맞춰 로그인합니다. 2. 이름과 역할을 확인합니다. 3. 통합상황판을 새로고침합니다. 4. 자신의 역할별 빠른 시작을 읽습니다. 5. 허용된 업무 하나를 수행하고 저장 결과를 재조회합니다.')
  self.sub('불확실하면 멈출 지점','삭제·초기화·예외 마감·타인 데이터 노출·잘못된 역할 부여가 관련되면 반복 클릭하지 않습니다. 해당 번호·시각·메시지를 기록하고 관리자에게 문의합니다.')
  self.h('2. 실제 역할별 권한과 업무 범위','permissions')
  self.p('현재 Main의 역할 검사와 화면을 대조한 표입니다. 전체 조합을 모두 UI로 수행한 것은 아니며 주요 경계는 E2E와 실제 사례로 확인했습니다. 허용 권한과 조직에서 맡긴 업무 범위는 다를 수 있습니다.')
  if self.role:
   col=ALL.index(self.role)+1;self.rows(['업무','이 역할의 범위'],[[x[0],x[col]]for x in PERMISSIONS],[CW-160,160])
  else:self.rows(['업무','관리자','운용요원','정비요원','일반 사용자','조회전용'],PERMISSIONS,[137]+[(CW-137)/5]*5)
  self.p('¹ 연결된 고장·정비가 없는 체계만 삭제. ² 상태·소유권·팀 조건을 모두 만족해야 하며 종결/완료/취소 건 변경은 관리자만 가능. 삭제는 관리자 또는 등록자에게 제한. ³ 금지된 버튼이 화면에 노출될 수 있음. ⁴ 다른 접수 노출 결함이 재현되어 허용된 업무 외 이용·공유 금지.','small')
  self.sub('메뉴가 보이는 것과 실행 권한은 다릅니다','조회전용에게 AI 분류·인수인계 저장 버튼이 보이거나, 정비요원에게 다른 팀 작업판 입력 버튼이 보여도 서버에서 거절될 수 있습니다. 기능별 사전 조건을 먼저 확인합니다.')
 def role_chapters(self):
  self.h('3. 역할별 실무 안내','roles')
  self.p('아래 하루 흐름은 권장 업무 순서입니다. 필수 입력·상태 전이·권한 제한은 앱의 실제 규칙이며, 같은 시스템을 사용하더라도 조직의 책임 분담을 우선 확인하세요.')
  self.rows(['업무를 넘기는 사람','받는 사람','인계할 핵심 정보'],[['일반 사용자','운용요원','접수번호·증상·영향·실제 발생 시각'],['운용요원','정비요원','팀·개인 배정·기한·첨부·확인된 증상'],['정비요원','운용요원','원인·조치·확인 결과·잔여 작업'],['운용요원','요청자','검증 결과·실제 복구 확인 요청'],['정비요원','관리자','계획·비계획·완료·미완료 사유·이월'],['마감 담당자','다음 근무자','마감 상태·예외 판단·다음 확인 시각']],[104,94,CW-198])
  self.sub('업무를 받을 때 되묻기','어떤 번호인가요? 마지막으로 확인한 상태는 무엇인가요? 다음 행동은 누가 언제 하나요? 이 세 가지가 분명하지 않으면 내용을 확인한 뒤 인수합니다.')
  for r in ([self.role]if self.role else ALL):
   d=ROLES[r];self.h(NAMES[r]+' | 책임과 빠른 시작','role-'+r,1)
   self.sub('내가 맡는 일',d['purpose']);self.sub('첫 사용 준비',d['ready']);self.sub('처음 수행할 업무','아래 절차 ID를 누르면 이 문서의 해당 설명으로 이동합니다.')
   for id in d['quick']:self.p(self.link(id),raw=True)
   self.picture(r+'-dashboard',NAMES[r]+'의 로그인 후 확인 위치',maxh=245)
   self.sub('로그인 후 확인','왼쪽 아래 역할이 '+NAMES[r]+'인지 확인합니다. 기본 진입 화면이 다르면 통합상황판을 직접 선택합니다. 실제 업무와 다른 역할이라면 진행하지 않습니다.')
   self.h(NAMES[r]+' | 하루 흐름과 실수 예방','day-'+r,1)
   for n,s in enumerate(d['daily'],1):self.sub(str(n)+'. '+s.split(':')[0],s.split(':',1)[1].strip())
   self.rows(['자주 하는 실수','바르게 확인하기'],[[x,'행동 전에 해당 업무의 역할·상태·완료 확인을 대조합니다.']for x in d['avoid']],[CW*.62,CW*.38])
   self.sub('업무 인계에 꼭 남길 정보','접수번호/작업번호, 현재 상태, 마지막 조치와 근거, 남은 작업, 다음 담당자, 확인 예정 시각, 필요한 자료를 전달합니다. 비밀번호와 불필요한 인적 정보는 전달하지 않습니다.')
   self.h(NAMES[r]+' | 실습과 완료 기준','exercise-'+r,1)
   self.sub('실습 1: 정상 업무',d['normal']);self.sub('실습 2: 예외와 권한',d['edge']);self.rows(['점검','완료 기준'],[[str(i+1),x]for i,x in enumerate(d['done'])],[48,CW-48]);self.sub('실습 결과 기록 양식','실습일: ______ / 역할: ______ / 접수·작업번호: ______\n수행 단계: ______ / 확인한 상태: ______\n오류 또는 제한: ______ / 다음 담당자: ______')
   self.sub('기대 결과와 다르면','권한 오류·저장 누락·상태 차이를 정상 결과로 고쳐 적지 않습니다. 재시도 전에 번호와 목록을 확인하여 중복 등록을 방지합니다. 원래 기록은 보존하고 오류 해결 장을 참고합니다.')
   self.h(NAMES[r]+' | 한 장 업무 요약','quick-'+r,1)
   self.p(d['purpose']);self.rows(['순서','실행 전 확인','바로 가기'],[[str(i+1),BYID[id]['title'],id]for i,id in enumerate(d['quick'])],[42,CW-105,63]);self.sub('시작','역할·기준일·담당 업무·기존 번호를 확인합니다.');self.sub('진행','한 번 저장한 뒤 목록과 상세를 다시 열어 상태와 이력을 확인합니다.');self.sub('마무리','다음 담당자와 확인 시각을 명확히 하고 미처리 항목을 인계합니다. 인수인계는 저장 후 별도 보관합니다.');self.sub('즉시 문의','타인 정보 노출, 잘못된 종결·마감, 초기화 오류, 데이터 유실 의심, 권한 불일치는 관리자에게 번호·시각·메시지를 전달합니다.');self.p('이 페이지는 요약입니다. 처음 수행하는 업무는 상세 절차를 먼저 읽으세요.','small')
 def task_chapters(self):
  self.h('4. 화면을 따라 하는 업무별 상세 절차','tasks')
  self.p('각 절차는 목적·사전 조건·입력값·실행 순서와 실제 화면·결과 확인·복구 범위로 구성했습니다. 문서에 보이는 공통 기능의 촬영 계정이 현재 역할과 다를 수 있습니다. 각 절차의 허용 역할과 조건을 기준으로 사용하세요.')
  self.rows(['업무 목적','찾을 절차'],[['처음 접속·자료 찾기','C01 로그인, C02 신청, C03 검색, C04 상황판'],['근거와 보고자료','C05 첨부, C06/C08 AI 참고, C07 통계·내보내기'],['체계 상태 관리','T01 등록·수정, T02 상태 변경'],['고장 접수와 처리','T03~T05 접수·보완, T06 AI 검토, T07 배정, T08~T10 진행·종결'],['정비 업무','T11 작업 등록, T12 결과 기록, T13 캘린더'],['통제와 일일 실적','T14 경보, T15 작업판, T16 정합성, T17 마감, T18 인계'],['근무와 지시','T19 근무 편성, T20 지시 관리, T21 읽음 확인'],['관리자 운영','A01 승인, A02~A03 설정, A04 백업, A05 알림·감사, A06~A07 교육 초기화']],[116,CW-116])
  self.sub('절차를 읽는 순서','사전 조건 → 입력값 준비 → 단계별 조작 → 화면 비교 → 정상 결과 재조회 → 다음 담당자 인계 순서로 사용합니다. 이 개별 PDF에 없는 다른 역할의 절차는 통합본이나 해당 역할 매뉴얼을 확인합니다.')
  for t in self.tasks:
   self.h(t['id']+' '+t['title'],t['id'],1)
   self.p('사용 역할: '+', '.join(NAMES[r]for r in t['roles'])+'\n이동 경로: '+t['where'],'small')
   self.sub('언제 사용하나요?',t['when']);self.sub('시작하기 전에',t['pre']);self.story.append(par('따라 하기','label'))
   for i,s in enumerate(t['steps'],1):self.p(f'{i}. {s}')
   if t['fields']:self.rows(['입력 항목','필수 여부','형식·의미','입력 예시'],t['fields'],[101,62,175,CW-338])
   self.h(t['id']+' 화면과 완료 확인',t['id']+'-screen',1)
   sid=t['shot']
   if t['id']=='C04'and self.role:sid=self.role+'-dashboard'
   if sid:
    meta=screens[sid];iw,ih=PIL.open(ROOT/meta['file']).size
    # Screenshot remains original; PDF clip shows a labelled magnified region.
    if t['id']=='C01':self.picture(sid,maxh=300,crop=(1140,280,440,470))
    elif t['id']=='T12':
     self.picture(sid,'확대 보기: 원인·조치·결과와 조치 방식 입력',maxh=300,crop=(0,260,600,420))
     self.picture(sid,'확대 보기: 완료 버튼을 눌러 결과 저장',maxh=48,crop=(0,866,600,70))
    else:self.picture(sid,maxh=210 if iw>1400 else 300)
    if meta.get('boxes'):self.p('화면 표시: '+' · '.join(b['label']for b in meta['boxes']),'small')
    if iw>1400 and t['id'] not in ['C01','A04','A07']:
     crops={'C01':(850,220,700,630),'C03':(290,110,1000,410),'C04':(290,95,950,390),'C06':(300,190,620,425),'C07':(290,180,1000,430),'C08':(930,195,630,410),'A02':(930,195,625,365),'A03':(300,600,1000,220),'A05':(300,190,1000,370)}
     crop=crops.get(t['id'],(300,180,800,250));x,y,w,h=crop;crop=(min(x,iw-1),min(y,ih-1),min(w,iw-x),min(h,ih-y));self.picture(sid,'확대 보기: 입력·조회 영역',maxh=140,crop=crop,marks=False)
   self.sub('정상 결과',t['result']);self.sub('다음에 할 일',t['next']);self.sub('잘못 처리했거나 오류가 나면',t['fix']);self.sub('제한과 주의',t['warn']);self.p('확인 범위: '+t['check'],'small')
 def scenarios(self):
  self.h('5. 한 건의 업무를 여러 역할이 이어받기','scenario')
  self.p('다음 사례는 실제 UI로 수행한 가상 교육 시나리오입니다. 동일 PC에서 역할별로 로그아웃·로그인하며 진행했습니다. 다중 PC 실시간 공유를 검증한 것은 아닙니다.')
  rows=[['1 일반 사용자','교육용 회선 장애 접수','접수','T03'],['2 일반 사용자','서비스 영향 보완','접수 유지','T05'],['3 운용요원','AI 검토 후 반영','상태 유지','T06'],['4 운용요원','분류 처리 후 정비반·개인 배정','분류 → 배정','T07'],['5 정비요원','원격조치 시작','원격조치','T08'],['6 정비요원','원인·조치결과 입력','조치완료','T09'],['7 운용요원','결과 검증','검증','T10'],['8 일반 사용자','실제 복구 확인 체크 후 처리','종결','T10']]
  self.rows(['수행 역할','행동','기대 상태','절차'],rows,[93,219,128,CW-440]);self.sub('역할이 바뀔 때 전달할 것','항상 같은 접수번호를 전달합니다. 정비요원에게는 팀·개인 배정과 증상·영향·첨부·기한을, 요청자에게는 실제 복구 확인 방법을 전달합니다. 매뉴얼의 가상 계정 비밀번호를 운영 계정으로 공유하지 않습니다.')
  self.sub('정상 흐름의 우회와 재처리','조치 결과가 불충분하면 조치완료에서 원격조치 또는 현장출동으로 돌아갈 수 있습니다. 검증에서 조치완료로 되돌리는 경로도 있습니다. 종결·취소에는 재개 버튼이 없습니다. 권한과 현재 상태에 따라 표시되는 버튼만 사용합니다.')
  self.h('업무 흐름을 한눈에 보기','flow-diagrams',1)
  self.p('아래는 이번 실습에서 확인한 대표 경로입니다. 모든 상태 전이를 나열한 도식은 아니며, 상세 절차의 권한과 필수 입력 조건을 함께 확인합니다.')
  self.story.append(par('고장 처리와 역할 인계','label'))
  self.story.append(Flow([[('접수','일반 사용자'),('분류','운용요원'),('배정','운용요원')],[('원격조치','정비요원'),('조치완료','정비요원'),('검증','운용요원'),('종결','요청자 확인')]]))
  self.p('AI 검토·반영만으로 분류 상태가 되지 않습니다. 원격조치 대신 현장출동 경로도 있습니다. 종결된 건을 다시 여는 사용자 기능은 없습니다.','small')
  self.story.append(par('정비 작업의 대표 경로','label'))
  self.story.append(Flow([[('계획','작업 등록'),('진행','담당자 조치'),('완료','결과·원인·조치 기록')]]))
  self.p('보류·취소는 별도 상태입니다. 연결된 고장의 상태는 정비 완료만으로 자동 변경되지 않습니다. 고장 상세에서 후속 절차를 확인합니다.','small')
  self.story.append(par('일일 업무와 교대 인계','label'))
  self.story.append(Flow([[('계획·실적 입력','팀 담당자'),('대조','담당자·관리자'),('일일 마감','관리자'),('인수인계','다음 근무자에게 전달')]]))
  self.p('권장 업무 순서입니다. 자동 집계·자동 마감·저장된 인계 내용의 재조회 기능으로 오해하지 않습니다. 인계 내용은 확정 전 별도로 보관합니다.','small')
  self.md.append('도식: 접수 → 분류 → 배정 → 원격조치 → 조치완료 → 검증 → 종결. 정비: 계획 → 진행 → 완료. 일일 업무: 계획·실적 입력 → 대조 → 관리자 마감 → 인수인계.\n')
  self.h('계획·실적·마감·인수인계 시나리오','plan-scenario',1)
  self.rows(['단계','담당','입력·확인','결과'],[['계획','정비요원','소속팀 계획 2, 비계획 1','총 작업 3'],['실적','정비요원','완료 2, 이월 1, 미완료 사유','완료율 67%'],['대조','담당자·관리자','정비·고장 결과와 작업판 비교','누락 또는 예외 정리'],['마감','관리자','기준일·미해결·예외 판단','마감 요약 저장'],['인계','운용·정비 담당','교대 선택, 초안 검토·수정·확정','저장 메시지 확인 후 별도 보관']],[65,94,230,CW-389])
  self.sub('자동화로 오해하지 않기','정비 작업을 완료해도 작업판 건수가 자동 갱신되지 않습니다. 이월 숫자가 다음 날짜의 정비를 자동 생성하지 않습니다. 16:00이 되었다고 자동 마감되지 않습니다. 인계 확정 후 다음 사람이 앱에서 자동 불러오는 기능도 없습니다.')
  self.sub('실습용 인계 문장','[교육일 주간 인수인계]\n접수번호: 교육 중 생성된 번호 / 현재 상태: 종결\n연계 정비: 교육용 연결 점검 / 상태: 완료\n미완료: 가상 점검 장비 확보 1건 / 다음 담당: 가상 정비반\n다음 확인: 다음 근무 시작 시 장비 확보 여부 확인\n마감: 관리자 확인 완료 / 예외: 확인된 항목과 판단 근거 별도 첨부')
  self.sub('상대 역할의 기능이 이 PDF에 없다면','통합 매뉴얼 또는 해당 역할의 개별 PDF에서 같은 절차 ID를 찾습니다. 이 PDF 안에 있는 절차는 아래 찾아보기의 링크로 바로 이동할 수 있습니다.')
 def ending(self):
  self.h('6. 문제 해결과 자주 묻는 질문','faq')
  for i,(q,a)in enumerate(FAQ,1):self.story.append(KeepTogether([par(f'{i}. {q}','label'),par(a)]));self.md.extend([f'### {q}',a+'\n'])
  self.h('관리자에게 전달할 오류 기록','support',1)
  self.rows(['항목','기록 예시'],[['발생 시각','2026-10-28 10:15 KST처럼 날짜·시각·시간대를 적음'],['사용 역할','일반 사용자 / 정비요원 등. 비밀번호는 제외'],['업무 식별','접수번호 또는 작업번호, 기준일과 팀'],['화면 경로','고장관리 → 상세 → 조치완료'],['수행 행동','어느 칸에 어떤 종류의 값을 넣고 어떤 버튼을 눌렀는지'],['기대와 실제','조치완료 기대 / 권한 오류 발생'],['메시지','화면 문구를 그대로 기록. 민감 정보는 제거'],['재시도 여부','한 번만 수행, 중복 접수 없음 / 이미 생성된 번호 확인']],[105,CW-105])
  self.sub('안전한 확인 순서','1. 현재 역할과 번호를 확인합니다. 2. 오류 문구를 기록합니다. 3. 목록을 재조회하여 저장 여부를 확인합니다. 4. 필터·권한·필수 입력을 확인합니다. 5. 해결되지 않으면 관리자에게 전달합니다. 반복 저장·자료 삭제·DB 직접 편집은 하지 않습니다.')
  self.h('7. 알려진 제한과 검증하지 않은 범위','limits')
  for id,title,evidence,action in LIMITS:self.story.append(KeepTogether([par(id+' '+title,'label'),par('확인: '+evidence,'small'),par(action)]));self.md.extend([f'### {id} {title}',evidence,action+'\n'])
  self.sub('현재 검증한 범위','타입 검사, Lint, 3개 파일의 11개 단위·통합 테스트, seed 생성, production build와 5개 기존 E2E를 새 고정 소스에서 실행했습니다. 추가로 5개 역할 메뉴, 등록 신청·승인, 접수부터 종결, 정비 완료, 작업판, 인계, 경보, 근무·지시, 체계 상태, 통계, 첨부·파일 생성과 재시작 보존을 확인했습니다.')
  self.sub('실행 검증의 경계','파일 선택·저장 대화상자는 자동화에서 경로를 지정하는 대체 구현을 사용했습니다. 실제 기본 연결 앱 열기, 모든 오류 조합, 실제 모델 품질, 신규 PC 설치·업데이트·제거, macOS 실행은 검증하지 않았습니다. UI14의 조회전용 분류 실패는 재확인한 권한 제한이며 UI20의 사용자 전환 대기는 보정 후 통과했습니다.')
  self.h('8. 용어집과 업무별 찾아보기','glossary')
  self.rows(['용어','의미와 사용 방법'],GLOSSARY,[112,CW-112])
  self.h('업무별 바로 가기','index',1)
  for t in self.tasks:self.p(self.link(t['id']),raw=True)
  self.h('화면·버튼으로 찾기','button-index',1)
  buttonmap=[('사용자 등록 신청','C02'),('새로고침 / 통합상황판','C04'),('파일 선택 / 열기 / 삭제','C05'),('분석 및 유사 고장 조회','C06'),('일일 요약 생성 / 정비 우선순위 조회','C08'if self.role=='VIEWER'else'C06'),('고장 CSV / 정비 CSV / 일일 PDF','C07'),('체계 등록','T01'),('상태 저장','T02'),('신규 고장 접수','T03'),('긴급 선조치 후 사후 접수','T04'),('수정 / 고장 접수 수정','T05'),('AI 분류 / 검토 후 반영','T06'),('분류 / 정비반 배정','T07'),('원격조치 / 현장출동 / 보류','T08'),('조치완료','T09'),('검증 / 종결','T10'),('작업 등록','T11'),('진행 / 완료','T12'),('캘린더','T13'),('상황경보 등록 / 확인 / 종료','T14'),('08:30 · 16:00 작업판 / 입력','T15'),('정합성 · 마감','T16'),('일일 마감','T17'),('초안 저장 / 인수인계 확정','T18'),('근무 등록','T19'),('지시사항 등록','T20'),('지시사항 확인','T21'),('승인 / 반려','A01'),('AI 설정 저장','A02'),('운영 설정 저장','A03'),('DB 백업','A04'),('읽음 / 감사 로그','A05'),('평가 시나리오 준비 / 시연 초기화','A06'),('Demo 데이터 초기화','A07')]
  for label,id in buttonmap:
   if id in self.ids:self.p(escape(label)+' → '+self.link(id),raw=True)
  self.h('문서 확인 기준과 재검토 안내','provenance',1)
  self.p('기준 소스: '+manifest['head']+'\n고정 시각: '+manifest['capturedAt']+'\n현재 문서: '+self.title)
  self.p('이전 기술 보고서 이후 변경된 macOS CI·문서, lint 제외 경로, macOS E2E 종료 조건을 포함한 현재 소스를 새로 고정하고 검사했습니다. 소스·프로필·화면·실행 로그는 사용자 매뉴얼 자료 묶음의 evidence 및 screenshots에 보관합니다.')
  self.p('애플리케이션 기능을 수정하지 않고 문서를 작성했습니다. 이전에 재현한 권한·날짜·마감·수정 누락·시연 초기화 결함은 현재 버전에서도 확인됐습니다. 향후 앱이 변경되면 이 매뉴얼의 버튼·권한·결과를 다시 검토해야 합니다.')
  self.p('원본은 같은 이름의 Markdown과 source의 구조화된 절차 데이터입니다. UI 캡처에는 실제 사용자 개인정보를 사용하지 않았으며, 문서 생성·검증 방법은 재생성_안내.md를 참고합니다.','small')
 def build(self):
  self.cover();self.front();self.role_chapters();self.task_chapters();self.scenarios();self.ending()
  name='통합_역할별_사용자매뉴얼' if not self.role else NAMES[self.role]+'_'+self.role+'_사용자매뉴얼'
  pdf=ROOT/(name+'.pdf');doc=Doc(str(pdf),pagesize=A4,leftMargin=L,rightMargin=L,topMargin=52,bottomMargin=43,title='OMNIS '+self.title,author='OMNIS local UI manual');doc.pages={}
  def frame(c,d):
   c.saveState();c.setFillColor(GRAY);c.setFont('MG',8)
   if d.page>1:c.drawString(L,H-28,'OMNIS | '+self.title);c.drawRightString(W-L,H-28,'2026-10-28 · 가상 교육 환경');c.setStrokeColor(colors.HexColor('#D7E2EC'));c.line(L,H-35,W-L,H-35)
   c.drawString(L,23,'실제 역할·상태 확인 후 사용 | 저장 결과는 목록과 상세에서 재확인');c.drawRightString(W-L,23,str(d.page));c.restoreState()
  doc.addPageTemplates(PageTemplate(id='all',frames=[Frame(L,43,CW,H-95,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=frame));doc.multiBuild(self.story)
  (ROOT/(name+'.md')).write_text('\n'.join(self.md),'utf8');return dict(file=pdf.name,role=self.role,title=self.title,anchors=doc.pages,tasks=[t['id']for t in self.tasks],sha256=hashlib.sha256(pdf.read_bytes()).hexdigest())

if __name__=='__main__':
 books=[]
 for role in [None]+ALL:
  b=Book(role);result=b.build();books.append(result);print(result['file'],max(result['anchors'].values()),flush=True)
 (EV/'books.json').write_text(json.dumps(books,ensure_ascii=False,indent=2),'utf8')
 (ROOT/'사용자절차_원본.json').write_text(json.dumps(TASKS,ensure_ascii=False,indent=2),'utf8')
 with (ROOT/'역할별_권한_및_업무표.csv').open('w',encoding='utf-8-sig',newline='')as f:csv.writer(f).writerows([['업무']+[NAMES[r]for r in ALL]]+PERMISSIONS)
 (ROOT/'알려진_제한사항_및_미검증항목.md').write_text('\n\n'.join(f'## {id} {title}\n{evidence}\n\n{action}'for id,title,evidence,action in LIMITS),'utf8')
 with (ROOT/'사용자절차_검증결과.csv').open('w',encoding='utf-8-sig',newline='')as f:
  w=csv.writer(f);w.writerow(['절차','업무','역할','사전 조건','수행 절차','예상 결과','확인 범위','제한']);
  for t in TASKS:w.writerow([t['id'],t['title'],','.join(t['roles']),t['pre'],' / '.join(t['steps']),t['result'],t['check'],t['warn']])
 with (ROOT/'실행검증_관찰결과.csv').open('w',encoding='utf-8-sig',newline='')as f:
  w=csv.writer(f);w.writerow(['검증ID','역할','업무','검증수준','상태','실제결과','증거']);
  for r in observations:w.writerow([r['id'],r['role'],r['task'],r['level'],r['status'],json.dumps(r.get('detail',''),ensure_ascii=False),'evidence/ui-results.json 또는 supplement/attachment-retry-results.json'])
