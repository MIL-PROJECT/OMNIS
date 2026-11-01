from pathlib import Path
from html import escape
import json,math,textwrap
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[2]
FONT=PROJECT/'node_modules/pretendard/dist/public/static/alternative'
SCENES=json.loads((ROOT/'sources/scenes.json').read_text())
C={'bg':'#F2F4F8','ink':'#1D2540','muted':'#64708A','navy':'#232E6B','blue':'#456BE0','teal':'#147F73','amber':'#A86618','line':'#DCE2ED','white':'#FFFFFF','soft':'#EBEFFA','greenbg':'#E9F6F1','amberbg':'#FFF3E3'}
FONTS={}
def font(size,weight=400):
 key=(size,weight)
 if key not in FONTS:
  name='Bold' if weight>=700 else 'SemiBold' if weight>=600 else 'Medium' if weight>=500 else 'Regular'
  FONTS[key]=ImageFont.truetype(str(FONT/f'Pretendard-{name}.ttf'),size)
 return FONTS[key]
def wrap(t,size,w,weight=400):
 f=font(size,weight);lines=[];line=''
 for word in t.split():
  q=(line+' '+word).strip()
  if f.getlength(q)>w and line:lines.append(line);line=word
  else:line=q
 if line:lines.append(line)
 return lines

class Canvas:
 def __init__(self,s):
  self.s=s;self.im=Image.new('RGB',(1920,1080),C['bg']);self.d=ImageDraw.Draw(self.im);self.svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><title>'+escape(s['title'])+'</title><desc>OMNIS 기술 평가 발표. '+escape(s['status'])+'</desc>'];self.bounds=[];self.highlights=[];self.ui=None
  self.rect(0,0,1920,1080,C['bg'],r=0)
 def rect(self,x,y,w,h,fill,stroke=None,r=20,width=2,dash=False):
  if dash and stroke:
   self.d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=fill,outline=None)
   # Dashes are also visible in the raster rendering.
   for xx in range(int(x+r),int(x+w-r),20):self.d.line((xx,y,min(xx+11,x+w-r),y),fill=stroke,width=width);self.d.line((xx,y+h,min(xx+11,x+w-r),y+h),fill=stroke,width=width)
   for yy in range(int(y+r),int(y+h-r),20):self.d.line((x,yy,x,min(yy+11,y+h-r)),fill=stroke,width=width);self.d.line((x+w,yy,x+w,min(yy+11,y+h-r)),fill=stroke,width=width)
  else:self.d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=fill,outline=stroke,width=width)
  self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{width}"'+(' stroke-dasharray="12 8"' if dash else '')+'/>')
 def line(self,pts,color=None,width=4,dash=False,arrow=False):
  color=color or C['line']
  for a,b in zip(pts,pts[1:]):
   if dash:
    length=math.dist(a,b)
    if length:
     for t in range(0,int(length),22):
      p=(a[0]+(b[0]-a[0])*t/length,a[1]+(b[1]-a[1])*t/length);q=(a[0]+(b[0]-a[0])*min(t+12,length)/length,a[1]+(b[1]-a[1])*min(t+12,length)/length);self.d.line((p,q),fill=color,width=width)
   else:self.d.line((a,b),fill=color,width=width)
  self.svg.append(f'<polyline points="'+ ' '.join(f'{x},{y}'for x,y in pts)+f'" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round"'+(' stroke-dasharray="12 10"'if dash else '')+'/>')
  if arrow:
   a,b=pts[-2:];ang=math.atan2(b[1]-a[1],b[0]-a[0]);p=[b,(b[0]-15*math.cos(ang-.5),b[1]-15*math.sin(ang-.5)),(b[0]-15*math.cos(ang+.5),b[1]-15*math.sin(ang+.5))];self.d.polygon(p,fill=color);self.svg.append('<polygon points="'+' '.join(f'{x},{y}'for x,y in p)+f'" fill="{color}"/>')
 def txt(self,x,y,t,size=30,color=None,weight=400,maxw=None):
  color=color or C['ink'];f=font(size,weight);w=f.getlength(t);asc,desc=f.getmetrics()
  if maxw and w>maxw+.5:raise ValueError(f'Text exceeds width: {self.s["id"]} {t} {w}>{maxw}')
  self.d.text((x,y+asc),t,font=f,fill=color,anchor='ls')
  self.svg.append(f'<text x="{x}" y="{y+asc}" font-family="Pretendard Variable, Pretendard, Apple SD Gothic Neo, sans-serif" font-size="{size}" font-weight="{weight}" fill="{color}">{escape(t)}</text>')
  self.bounds.append({'text':t,'x':x,'y':y,'w':w,'h':asc+desc,'size':size})
 def para(self,x,y,t,w,size=30,color=None,weight=400,gap=None,maxlines=5):
  lines=wrap(t,size,w,weight)
  if len(lines)>maxlines:raise ValueError('Too many text lines '+self.s['id']+' '+t)
  for i,line in enumerate(lines):self.txt(x,y+i*(gap or round(size*1.45)),line,size,color,weight,maxw=w)
  return len(lines)*(gap or round(size*1.45))
 def pill(self,x,y,t,color=None,bg=None,w=None):
  color=color or C['navy'];w=w or max(90,font(22,600).getlength(t)+32);self.rect(x,y,w,44,bg or C['soft'],r=22);self.txt(x+16,y+7,t,22,color,600,maxw=w-28)
 def card(self,x,y,w,h,title,body='',color=None,tag=None,dashed=False,titleSize=34):
  color=color or C['navy'];self.rect(x,y,w,h,C['white'],C['amber'] if dashed else C['line'],dash=dashed)
  self.rect(x+24,y+28,7,38,color,r=3)
  th=self.para(x+48,y+25,title,w-78,titleSize,color,700,maxlines=2)
  if body:self.para(x+32,y+max(100,th+45),body,w-64,29,C['muted'],maxlines=5)
  if tag:self.pill(x+28,y+h-66,tag,color,C['amberbg'] if dashed else C['soft'])
  self.highlights.append([x,y,w,h])
 def footer(self):
  t=self.s['evidence'];size=20
  while font(size).getlength(t)>1760:size-=1
  self.txt(80,922,t,size,C['muted'],maxw=1760)
  self.rect(0,962,1920,118,'#15203F',r=0)
  # The caption area stays empty in the artwork and is filled from measured speech timing.
 def header(self):
  self.txt(80,42,'OMNIS',28,C['navy'],700)
  ch=json.loads((ROOT/'sources/chapters.json').read_text())[self.s['chapter']-1]
  self.txt(255,47,f'{self.s["chapter"]:02} / '+ch['title'],23,C['muted'],500)
  status=self.s['status'];future='제안' in status or '미구현' in status;self.pill(1390,35,status,C['amber'] if future else C['teal'],C['amberbg'] if future else C['greenbg'],360)
  self.txt(1785,47,self.s['id']+' / 30',22,C['muted'])
  titleSize=52
  while font(titleSize,700).getlength(self.s['title'])>1760:titleSize-=1
  self.txt(80,120,self.s['title'],titleSize,C['navy'],700,maxw=1760)
  self.line([(80,210),(1840,210)],C['line'],2)
 def save(self):
  self.svg.append('</svg>');self.im.save(ROOT/'assets'/f'{self.s["id"]}.png');(ROOT/'assets'/f'{self.s["id"]}.svg').write_text('\n'.join(self.svg));return {'id':self.s['id'],'highlights':self.highlights,'ui':self.ui,'texts':self.bounds}

def grid(c,items,cols=3,y=292,h=475,future=False):
 gap=28;w=(1760-(cols-1)*gap)//cols
 rows=math.ceil(len(items)/cols);ch=h if rows==1 else (h-28)//rows
 for i,item in enumerate(items):
  title,body=item if isinstance(item,list)else(item,'')
  c.card(80+(i%cols)*(w+gap),y+(i//cols)*(ch+28),w,ch,title,body,C['amber']if future else C['navy'],dashed=future)

def pipeline(c,items,y=340,future=False):
 n=len(items);gap=48;w=(1760-(n-1)*gap)//n
 for i,item in enumerate(items):
  title,body=item if isinstance(item,list)else(item,'')
  x=80+i*(w+gap);c.card(x,y,w,275,title,body,C['amber'] if future else C['navy'],tag=f'{i+1:02}',dashed=future,titleSize=30)
  if i<n-1:c.line([(x+w+8,y+139),(x+w+gap-9,y+139)],C['amber'] if future else C['blue'],4,dash=future,arrow=True)

def draw(s):
 c=Canvas(s);c.header();items=s['items'];lay=s['layout']
 if lay in ['hero','closing']:
  c.rect(80,270,1760,592,C['navy'],r=28)
  if lay=='hero':
   c.txt(140,325,'OMNIS',102,C['white'],700);c.txt(145,468,'정보통신 운용·정비 통합체계',40,'#D7DFFB',600)
   c.para(145,572,'업무를 연결하고, 판단의 근거와 책임을 남깁니다.',1530,48,C['white'],600,maxlines=2)
   c.txt(145,740,'로컬 실행  /  선택형 AI  /  명시적 업무 반영',31,'#B9C8F3')
  else:
   for i,(title,body)in enumerate(items):
    y=330+i*145;c.txt(145,y,title,48,C['white'],700);c.txt(420,y+10,body,36,'#D7DFFB',500)
 elif lay=='problem':
  for i,t in enumerate(items[:3]):
   x=80+i*605;c.card(x,300,550,300,t,'서로 다른 기록과 확인 시점',C['navy'],tag=f'기록 {i+1}')
   if i<2:c.line([(x+560,450),(x+590,450)],C['amber'],4,dash=True,arrow=True)
  c.rect(80,670,1760,170,C['soft']);c.txt(125,705,'연결할 대상',27,C['muted'],500);c.txt(125,753,items[3],38,C['navy'],600)
 elif lay in ['three','comparison']:
  grid(c,items,3,h=440)
  c.rect(80,785,1760,84,C['soft']);c.txt(113,811,'주장마다 구현 근거와 검증 범위, 적용 조건을 함께 제시합니다.',29,C['navy'],500)
 elif lay=='features':grid(c,items,3,y=265,h=610)
 elif lay=='layers':
  pipeline(c,items,330)
  c.rect(80,704,1760,155,C['soft']);c.txt(115,738,'사용자 PC 안의 기본 업무 경로',34,C['navy'],600);c.txt(115,795,'별도 웹 서버 없음   ·   외부 AI는 선택   ·   장비 간 동기화는 향후 설계',29,C['muted'])
 elif lay=='trust':
  grid(c,items,3,y=288,h=390)
  c.rect(80,741,1760,125,C['greenbg']);c.txt(116,771,'신뢰 경계의 의미',31,C['teal'],700);c.txt(116,819,'UI 표시와 Main의 실행 권한을 분리합니다. 데이터별 접근 범위는 서비스에서 확인합니다.',28,C['teal'])
 elif lay=='sequence':
  pipeline(c,items,350)
  c.pill(80,730,'요청',C['blue']);c.txt(208,735,'입력 → 검증 → 저장',32,C['navy'],600)
  c.pill(1020,730,'응답',C['teal'],C['greenbg']);c.txt(1148,735,'결과 반환 → 재조회',32,C['navy'],600)
 elif lay=='storage':grid(c,items,2,y=266,h=610)
 elif lay=='ai':
  c.card(80,320,490,300,items[3][0],items[3][1],C['navy'],tag='Main 안의 실행 제어')
  for i,(a,b)in enumerate(items[:3]):
   x,y=950,260+i*178;c.card(x,y,890,145,a,b,C['teal']if i==0 else C['blue'],titleSize=29)
   c.line([(585,470),(760,470),(760,y+73),(930,y+73)],C['teal']if i==0 else C['blue'],3,dash=i>0,arrow=True)
  c.pill(80,750,'실선: 기본 경로',C['teal'],C['greenbg']);c.pill(400,750,'파란 점선: 구현된 선택 경로',C['blue'])
  c.txt(80,830,'선택 Provider 실패 → LOCAL 규칙 복귀  /  실제 사용 경로와 오류를 이력으로 구분',29,C['navy'],600)
 elif lay=='snapshot':
  for x,y,a,b in [(80,282,'기준 A','업무에 연결한 당시 질문·항목'),(1090,282,'기존 업무 · snapshot A','양식 변경 후에도 당시 내용 보존'),(80,563,'기준 B · 이후 변경','현재 템플릿을 새 업무에 사용'),(1090,563,'신규 업무 · snapshot B','과거 업무와 기준을 분리')]:c.card(x,y,750,210,a,b,C['teal']if x>1000 else C['navy'],titleSize=32)
  c.line([(850,390),(1065,390)],C['blue'],4,arrow=True);c.line([(850,672),(1065,672)],C['blue'],4,arrow=True)
  c.line([(453,503),(453,550)],C['muted'],3,dash=True,arrow=True)
  c.rect(80,824,1760,65,C['soft']);c.txt(112,842,'반복 회차: rule_id + occurrence_date의 중복을 방지합니다. 생성은 사용자 요청으로 실행합니다.',27,C['navy'],600)
 elif lay=='extension':
  pipeline(c,items,330)
  c.rect(80,734,1760,130,C['amberbg']);c.txt(116,763,'개선할 지점도 남아 있습니다',31,C['amber'],700);c.txt(116,812,'AppService의 책임 집중 · 일부 직접 SQL · 기능별 변경 영향과 회귀 시험 범위',29,C['amber'])
 elif lay=='provider':
  grid(c,items,4,y=285,h=455)
  c.rect(80,784,1760,86,C['soft']);c.txt(115,808,'새 Provider = 계약 재사용 + 공급자별 구현 + 실제 응답 검증',32,C['navy'],600)
 elif lay=='scale':
  c.card(80,290,820,345,items[0][0],items[0][1],C['teal'],tag='현재 구현')
  c.card(1020,290,820,345,items[2][0],items[2][1],C['amber'],tag='추가 개발',dashed=True)
  c.line([(920,462),(1000,462)],C['amber'],4,dash=True,arrow=True)
  c.rect(80,729,1760,140,C['amberbg']);c.txt(116,760,items[1][0],32,C['amber'],700);c.txt(116,810,items[1][1]+'  /  사용자 수·처리량은 실측 후 판단',30,C['amber'])
 elif lay=='operations':
  grid(c,items,3,y=300,h=440)
  c.txt(80,811,'검증된 빌드 경로와 현장 배포 적합성은 구분합니다.',34,C['navy'],600)
 elif lay=='boundary':
  for i,(a,b)in enumerate(items):
   x=80+i*605;c.card(x,320,550,325,a,b,C['navy']if i==0 else C['amber'],tag='현재 구현'if i==0 else '설계 / 미구현',dashed=i>0)
   if i<2:c.line([(x+561,482),(x+591,482)],C['amber'],4,dash=True,arrow=True)
  c.rect(80,755,1760,120,C['amberbg']);c.txt(116,788,'상대 체계의 실제 규격·권한·망 경로를 확인한 뒤 연결합니다.',33,C['amber'],600)
 elif lay=='fileflow':
  pipeline(c,items,337,True)
  c.rect(80,732,1760,140,C['amberbg']);c.txt(116,762,'검증 전 자료는 업무 상태를 변경하지 않습니다.',34,C['amber'],700);c.txt(116,815,'교환 계약 · 원본 책임 · 승인 · 행별 오류 · 트랜잭션 단위',29,C['amber'])
 elif lay=='idempotency':
  grid(c,items,2,y=270,h=600,future=True)
  c.txt(1200,820,'예시: EXT-M42 / rev 1',23,C['amber'],600)
 elif lay=='roadmapflow':
  pipeline(c,items,330,True)
  c.rect(80,750,1760,125,C['amberbg']);c.txt(116,782,'연결 성공 → 정합성 확인 → 장애 후 중복 없는 복구',34,C['amber'],700)
 elif lay=='evidence':
  gap=24;w=422
  for i,(a,b)in enumerate(items):
   x=80+i*(w+gap);c.rect(x,310,w,400,C['white'],C['line']);c.txt(x+30,370,a,68 if i<3 else 40,C['teal'],700);c.para(x+30,510,b,w-60,31,C['navy'],600,maxlines=3);c.highlights.append([x,310,w,400])
  c.rect(80,769,1760,114,C['greenbg']);c.txt(116,801,'현재 merge commit과 검증 commit의 소스 tree가 일치합니다.',33,C['teal'],600)
 elif lay=='limits':
  grid(c,items,2,y=266,h=535,future=True)
  c.rect(80,831,1760,63,C['amberbg']);c.txt(108,847,'추가 발견: 체계 미지정 접수의 AI 입력 검증 문제 → 보완 항목으로 기록',27,C['amber'],600)
 elif lay=='metrics':
  grid(c,items,2,y=266,h=610)
 elif lay=='roadmap':
  pipeline(c,items,330,True)
  c.txt(80,798,'필요성이 확인된 확장부터, 단계별 시험을 통과하며 진행합니다.',35,C['navy'],600)
 elif lay=='ui':
  # Real recorded pixels are composited here. SVG remains an editable explanatory frame.
  c.rect(80,254,1400,636,C['white'],C['line']);c.txt(110,266,'실제 설치 앱 녹화 · 가상 시연 프로필',23,C['muted'],500)
  c.ui={'x':96,'y':310,'width':1368,'height':560,'clip':s['clip']}
  for i,(a,b)in enumerate(items):
   y=285+i*188;c.txt(1530,y,f'{i+1:02}',25,C['blue'],700);c.para(1530,y+45,a,300,29,C['navy'],700,maxlines=2);c.para(1530,y+102,b,300,25,C['muted'],maxlines=3)
  if s['id']=='11':c.pill(1530,850,'신뢰도 ≠ 실측 정확도',C['amber'],C['amberbg'],310)
 else:raise ValueError(lay)
 c.footer()
 for b in c.bounds:
  if b['x']<0 or b['x']+b['w']>1920 or b['y']<0 or b['y']+b['h']>962:raise ValueError('Artwork text overflow '+s['id']+' '+str(b))
 return c.save()

if __name__=='__main__':
 rows=[draw(s)for s in SCENES];(ROOT/'sources/visual-layouts.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print('Rendered',len(rows),'editable SVG + PNG slide assets.')
