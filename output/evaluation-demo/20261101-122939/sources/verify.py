"""Decode final media, inspect geometry/subtitle contracts, and extract review frames."""
from pathlib import Path
import json,re,subprocess,wave,hashlib,xml.etree.ElementTree as ET,math,array,sys
from PIL import Image,ImageDraw,ImageFont,ImageStat
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];P=R.parents[2];FF=imageio_ffmpeg.get_ffmpeg_exe()
V=R/'OMNIS_기술평가_시현영상_15분.mp4';W=R/'OMNIS_평가발표_한국어음성.wav'
E=R/'evidence';PRE=R/'장면_미리보기';PRE.mkdir(exist_ok=True)
S=json.loads((R/'sources/scenes.json').read_text());CAP=json.loads((R/'sources/captions.json').read_text());TIM=json.loads((E/'narration-timing.json').read_text())
checks=[]
def check(name,condition,detail):
 checks.append({'check':name,'passed':bool(condition),'detail':detail})
 if not condition:raise AssertionError(name+' '+str(detail))
def command(args,name):
 with open(E/name,'w')as f:
  x=subprocess.run([FF,'-hide_banner','-nostdin',*args],stdout=f,stderr=f)
 check(name+' exit',x.returncode==0,x.returncode)
 return (E/name).read_text()

meta=subprocess.run([FF,'-hide_banner','-i',str(V)],capture_output=True,text=True).stderr;(E/'final-media.txt').write_text(meta)
m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',meta);duration=int(m[1])*3600+int(m[2])*60+float(m[3])
check('900 seconds',abs(duration-900)<.1,duration)
check('H264 / Full HD / 30fps',bool(re.search(r'Video: h264.*1920x1080.*30 fps',meta)),next(x for x in meta.splitlines()if 'Video:'in x))
check('AAC / 48 kHz',bool(re.search(r'Audio: aac.*48000 Hz',meta)),next(x for x in meta.splitlines()if 'Audio:'in x))
check('8 chapters',len(re.findall(r'Chapter #',meta))==8,len(re.findall(r'Chapter #',meta)))
check('30 scenes / 900 target seconds',len(S)==30 and sum(s['duration']for s in S)==900,len(S))
with wave.open(str(W))as w:
 params={'channels':w.getnchannels(),'sampleRate':w.getframerate(),'sampleWidth':w.getsampwidth(),'frames':w.getnframes(),'seconds':w.getnframes()/w.getframerate()}
 check('PCM voice exact 900 seconds',params['seconds']==900 and params['sampleRate']==48000 and params['channels']==1,params)
check('caption ordering / range',all(0<=c['start']<c['end']<=900 for c in CAP)and all(a['end']<=b['start']+.002 for a,b in zip(CAP,CAP[1:])),len(CAP))
check('captions <= 2 lines',all(1<=len(c['lines'])<=2 for c in CAP),max(len(c['lines'])for c in CAP))
norm=lambda x:re.sub(r'\s+','',x)
for s in S:check('caption matches narration '+s['id'],norm(''.join(c['text']for c in CAP if c['scene']==s['id']))==norm(s['narration']),s['id'])
check('all speech fits scenes',all(0<t['voiceStart']<t['voiceEnd']<t['targetSeconds']for t in TIM),TIM[-1])
check('bounded TTS speed',all(.85<=t['atempo']<=1.15 for t in TIM),[min(t['atempo']for t in TIM),max(t['atempo']for t in TIM)])
layouts=json.loads((R/'sources/visual-layouts.json').read_text());bounds=[x for s in layouts for x in s['texts']]
check('slide text stays in frame',all(x['x']>=0 and x['y']>=0 and x['x']+x['w']<=1920 and x['y']+x['h']<=962 for x in bounds),len(bounds))
for svg in [* (R/'assets').glob('*.svg'),* (R/'도식').glob('*.svg')]:ET.parse(svg)
check('editable SVG well formed',True,'assets + 도식 parsed with XML parser')
fonts=next((P/'node_modules/pretendard').rglob('Pretendard-Regular.ttf'));font=ImageFont.truetype(str(fonts),23)
check('subtitle width fits',all(font.font is not None for _ in [1])and all(ImageFont.truetype(str(fonts),34).getlength(line)<=1770 for c in CAP for line in c['lines']),'34px / <=1770px')
check('no real external AI in capture',json.loads((R/'recordings/capture.json').read_text())['fallbackEvidence']['external_transmission']==0,'Ollama loopback failure; provider LOCAL')

# Full decode is intentionally separate from frame extraction.
decode=command(['-v','error','-xerror','-i',str(V),'-map','0:v:0','-map','0:a:0','-f','null','-'],'full-decode.log')
check('full decode no errors',not decode.strip(),decode[:500])
progress=command(['-v','error','-i',str(V),'-map','0:v:0','-an','-c:v','copy','-progress','pipe:1','-f','null','-'],'frame-count.log')
frames=[int(x)for x in re.findall(r'^frame=(\d+)',progress,re.M)]
check('27000 video frames',frames and frames[-1]==27000,frames[-1]if frames else None)
stats=command(['-i',str(V),'-vn','-af','loudnorm=I=-16:TP=-2:LRA=8:print_format=json','-f','null','-'],'final-loudness.log')
j=json.loads(stats[stats.rfind('{'):stats.rfind('}')+1]);check('voice loudness / peak',-18<float(j['input_i'])<-14 and float(j['input_tp'])<-.5,j)

def extract(t,dest):
 subprocess.run([FF,'-v','error','-y','-ss',str(t),'-i',str(V),'-frames:v','1',str(dest)],check=True)
review=[]
for s in S:
 t=s['at']+s['duration']/2;dest=PRE/f'{s["id"]}.png';extract(t,dest);im=Image.open(dest)
 st=ImageStat.Stat(im);check('nonblank scene '+s['id'],max(st.stddev)>15,round(max(st.stddev),2))
 review.append({'scene':s['id'],'seconds':t,'file':str(dest),'kind':'midpoint'})
# Review every meaningful sub-cut too, including before/after the history and audit edits.
for ident,local in [('11',1),('11',3),('12',3),('13',3),('13',10),('13',23),('14',3),('14',14),('14',24),('15',3),('15',13),('15',23)]:
 s=next(s for s in S if s['id']==ident);dest=PRE/f'{ident}-{local:02}.png';extract(s['at']+local,dest);review.append({'scene':ident,'seconds':s['at']+local,'file':str(dest),'kind':'UI-cut'})
(E/'review-frames.json').write_text(json.dumps(review,ensure_ascii=False,indent=2))
for page in range(3):
 sheet=Image.new('RGB',(1440,5*300),'#e7ebf3');draw=ImageDraw.Draw(sheet)
 for i,s in enumerate(S[page*10:page*10+10]):
  im=Image.open(PRE/f'{s["id"]}.png');im.thumbnail((700,394));im=im.resize((512,288))
  # 2 columns, 5 rows. Keep 512px previews for legible overall geometry.
  col=i%2;row=i//2;x=col*720;y=row*300;sheet.paste(im,(x+205,y));draw.text((x+10,y+12),f'{s["id"]} / {s["at"]//60:02}:{s["at"]%60:02}',font=font,fill='#232e6b')
 sheet.save(E/f'final-contact-{page+1}.jpg',quality=92)
ui=[x for x in review if x['kind']=='UI-cut'];sheet=Image.new('RGB',(1440,4*310),'#e7ebf3');draw=ImageDraw.Draw(sheet)
for i,row in enumerate(ui):
 im=Image.open(row['file']);im.thumbnail((470,265));x=(i%3)*480;y=(i//3)*310;sheet.paste(im,(x,y));draw.text((x+6,y+270),f'{row["scene"]} / {row["seconds"]:.0f}s',font=font,fill='#232e6b')
sheet.save(E/'final-ui-contact.jpg',quality=94)
textfiles=[* (R/'발표자료').glob('*.md'),* (R/'도식').glob('*.svg'),R/'한국어_자막.srt']
findings=[]
for p in textfiles:
 text=p.read_text()
 for pat in [r'sk-[A-Za-z0-9_-]{20,}',r'gh[pousr]_[A-Za-z0-9]{20,}',r'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY',r'AKIA[A-Z0-9]{16}']:
  if re.search(pat,text):findings.append(str(p))
check('published text secret-pattern scan',not findings,findings)
check('product Git clean',subprocess.run(['git','status','--porcelain'],cwd=P,capture_output=True,text=True).stdout=='','ignored release output only')
report={'video':str(V),'durationSeconds':duration,'pcm':params,'audioLoudness':j,'captionCount':len(CAP),'frameCount':frames[-1],'checks':checks,'allPassed':all(x['passed']for x in checks),'visualReview':'42 extracted frames plus full decode; contact sheets require explicit visual review','voiceReview':'timing/level/decoding verified; full human listening not claimed','sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in [V,W,R/'한국어_자막.srt']}}
(E/'quality.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('QUALITY',len(checks),'passed; 42 review frames')
