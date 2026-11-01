import concurrent.futures,hashlib,json,math,re,subprocess,sys,wave
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[2]
FF=imageio_ffmpeg.get_ffmpeg_exe();FONTDIR=PROJECT/'node_modules/pretendard/dist/public/static/alternative'
base=json.loads((ROOT/'sources/scenes.json').read_text());voiced={s['id']:s for s in json.loads((ROOT/'sources/voiced-scenes.json').read_text())}
scenes=[]
for s in base:
 v=voiced[s['id']]
 if s['narration']!=v['narration']:raise ValueError('Stale speech '+s['id'])
 scenes.append({**s,'speech':v['speech'],'speechDuration':v['speechDuration']})
layouts={s['id']:s for s in json.loads((ROOT/'sources/visual-layouts.json').read_text())}
def run(args,log):
 with open(log,'w') as f:subprocess.run([FF,'-y','-hide_banner','-loglevel','warning',*args],stdout=f,stderr=f,check=True)
def media(path):
 r=subprocess.run([FF,'-hide_banner','-i',str(path)],capture_output=True,text=True).stderr;m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',r)
 if not m:raise ValueError(r)
 return {'seconds':int(m[1])*3600+int(m[2])*60+float(m[3]),'description':r}
def assstamp(t):
 x=round(t*100);return f'{x//360000}:{x//6000%60:02}:{x//100%60:02}.{x%100:02}'
def srtstamp(t):
 x=round(t*1000);return f'{x//3600000:02}:{x//60000%60:02}:{x//1000%60:02},{x%1000:03}'
font=ImageFont.truetype(str(FONTDIR/'Pretendard-Regular.ttf'),34)
def wrap(t,w=1770):
 out=[];line=''
 for word in t.split():
  z=(line+' '+word).strip()
  if font.getlength(z)>w and line:out.append(line);line=word
  else:line=z
 if line:out.append(line)
 if len(out)>2:raise ValueError('More than 2 caption lines: '+t)
 return out
ASS='''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Pretendard,34,&H00FFFFFF,&H00FFFFFF,&H0015203F,&H0015203F,0,0,0,0,100,100,0,0,1,0,0,5,64,64,0,1
Style: Tip,Pretendard,28,&H00D9DFEC,&H00D9DFEC,&H0015203F,&H0015203F,0,0,0,0,100,100,0,0,1,0,0,5,64,64,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
def event(a,b,style,t):return f'Dialogue: 0,{assstamp(a)},{assstamp(b)},{style},,0,0,0,,{{\\pos(960,1020)}}{t}\n'

def audio():
 cues=[];stats=[]
 for s in scenes:
  speed=s['speechDuration']/(s['duration']-1.5)
  if not .85<=speed<=1.15:raise ValueError('Rewrite narration to avoid extreme speech speed '+s['id']+' '+str(speed))
  out=ROOT/'audio'/f'{s["id"]}.wav';sig=hashlib.sha256(json.dumps({'speech':s['speech'],'speed':speed,'filterVersion':2},ensure_ascii=False,sort_keys=True).encode()).hexdigest();cache=ROOT/'audio'/f'{s["id"]}.sha'
  if not out.exists()or not cache.exists()or cache.read_text()!=sig:
   ins=[]
   for p in s['speech']:ins+=['-i',p['path']]
   f=''.join(f'[{i}:a]'for i in range(len(s['speech'])))+f'concat=n={len(s["speech"])}:v=0:a=1,atempo={speed:.9f},loudnorm=I=-16:TP=-2:LRA=8,aresample=48000,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,adelay=750,apad=whole_len={s["duration"]*48000},atrim=end_sample={s["duration"]*48000},asetpts=PTS-STARTPTS[a]'
   run([*ins,'-filter_complex',f,'-map','[a]','-c:a','pcm_s16le','-ar','48000','-ac','1',str(out)],ROOT/'audio'/f'{s["id"]}.log');cache.write_text(sig)
  with wave.open(str(out))as w:assert w.getframerate()==48000 and w.getnchannels()==1 and abs(w.getnframes()/w.getframerate()-s['duration'])<.001
  t=.75;ass=ASS+event(0,.75,'Tip',s['status'])
  for p in s['speech']:
   end=t+p['duration']/speed;lines=wrap(p['text']);ass+=event(t,end,'Caption','\\N'.join(lines));cues.append({'scene':s['id'],'start':s['at']+t,'end':s['at']+end,'text':p['text'],'lines':lines});t=end
  ass+=event(t,s['duration'],'Tip',s['status']);(ROOT/'sources'/f'{s["id"]}.ass').write_text(ass)
  stats.append({'scene':s['id'],'targetSeconds':s['duration'],'nativeSpeechSeconds':s['speechDuration'],'atempo':speed,'voiceStart':.75,'voiceEnd':t,'voice':'macOS Yuna','sentenceCount':len(s['speech'])});s['speechSpeed']=speed
  print('AUDIO',s['id'],round(speed,3),flush=True)
 (ROOT/'한국어_자막.srt').write_text('\n\n'.join(f'{i+1}\n{srtstamp(c["start"])} --> {srtstamp(c["end"])}\n'+ '\n'.join(c['lines'])for i,c in enumerate(cues))+'\n')
 (ROOT/'sources/captions.json').write_text(json.dumps(cues,ensure_ascii=False,indent=2));(ROOT/'evidence/narration-timing.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
 (ROOT/'sources/audio-concat.txt').write_text(''.join(f"file '{ROOT}/audio/{s['id']}.wav'\n"for s in scenes))
 run(['-f','concat','-safe','0','-i',str(ROOT/'sources/audio-concat.txt'),'-c','copy',str(ROOT/'OMNIS_평가발표_한국어음성.wav')],ROOT/'audio/concat.log')
 print('AUDIO AND SRT COMPLETE',flush=True)

def capture_source(m,name=None):
 info=media(m['videoPath']);offset=info['seconds']-m['recordingEnd'];row=next(x for x in m.get('clips',[])if x['name']==name)if name else m
 return {'video':m['videoPath'],'start':row['start']+offset,'duration':row['end']-row['start'],'offset':offset}
def ui_sources():
 cap=json.loads((ROOT/'recordings/capture.json').read_text());history=json.loads((ROOT/'recordings/history-capture.json').read_text());control=json.loads((ROOT/'recordings/control-capture.json').read_text())
 assert not cap.get('failure')and not cap['errors']and not cap['dialogs'];assert not history.get('failure')and not history['errors'];assert not control.get('failure')and not control['errors']
 src={x['name']:capture_source(cap,x['name'])for x in cap['clips']};src['history']=capture_source(history)
 for step in control['steps']:src['control-'+step['name']]=capture_source({**control,**step})
 # Each record: source, source offset, source seconds, presentation seconds, pixel crop.
 specs={
 '05':[('case',2,5,30,(285,112,850,335))],
 '11':[('ai-review',7.2,3.0,30,(285,399,860,276))],
 '12':[('timeline',2.6,7.2,30,(285,276,860,393))],
 '13':[('control-plan',1,2.4,8,(290,290,1110,460)),('control-reconciliation',1,2.4,11,(290,290,1110,460)),('control-handover',1,2.4,11,(290,290,1110,460))],
 '14':[('fallback',4,9.7,20,(285,399,860,276)),('history',1,3.2,10,(510,322,785,112))],
 '15':[('security',12,4,12,(500,210,450,350)),('security',17,3.1,5,(420,150,600,300)),('security',31,4.8,13,(290,225,1110,500))]
 }
 (ROOT/'evidence/ui-edit-decisions.json').write_text(json.dumps({'sources':src,'scenes':specs,'disclosure':'Actual app recordings cropped for legibility. End frames are held for narration. No UI values are fabricated. Screen action tooltips at the raw top edge are outside these crops.'},ensure_ascii=False,indent=2))
 for ident,parts in specs.items():
  paths=[]
  for i,(name,offset,length,target,crop)in enumerate(parts):
   p=ROOT/'segments'/f'ui-{ident}-{i}.mp4';paths.append(p)
   if p.exists():continue
   source=src[name];length=min(length,source['duration']-offset-.04)
   if length<=0:raise ValueError(name+' source too short')
   x,y,w,h=crop;vf=f'crop={w}:{h}:{x}:{y},scale=1368:560:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1368:560:(ow-iw)/2:(oh-ih)/2:color=white,setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration={target},format=yuv420p'
   run(['-ss',str(source['start']+offset),'-t',str(length),'-i',source['video'],'-an','-vf',vf,'-t',str(target),'-c:v','libx264','-preset','veryfast','-crf','18','-threads','3','-r','30',str(p)],ROOT/'segments'/f'ui-{ident}-{i}.log')
  txt=ROOT/'sources'/f'ui-{ident}-concat.txt';txt.write_text(''.join(f"file '{p}'\n"for p in paths));out=ROOT/'segments'/f'ui-{ident}.mp4';run(['-f','concat','-safe','0','-i',str(txt),'-c','copy',str(out)],ROOT/'segments'/f'ui-{ident}.log')
  print('UI EDIT',ident,flush=True)

def render_scene(s):
 ident=s['id'];target=s['duration'];output=ROOT/'segments'/f'{ident}.mp4'
 if output.exists()and '--force'not in sys.argv:print('REUSE',ident,flush=True);return
 args=['-loop','1','-framerate','30','-i',str(ROOT/'assets'/f'{ident}.png')]
 is_ui=s['layout']=='ui'
 if is_ui:args+=['-i',str(ROOT/'segments'/f'ui-{ident}.mp4')]
 args+=['-i',str(ROOT/'audio'/f'{ident}.wav')]
 filt='[0:v]fps=30,format=yuv420p[bg];'
 if is_ui:filt+='[bg][1:v]overlay=96:310:shortest=1[base];'
 else:filt+='[bg]null[base];'
 fx=[];boxes=layouts[ident]['highlights']
 if boxes and s['layout']not in ['hero','closing']:
  span=(target-2)/len(boxes)
  for i,(x,y,w,h)in enumerate(boxes):
   a=1+i*span;b=1+(i+1)*span;fx.append(f"drawbox=x={x+2}:y={y+2}:w={w-4}:h={h-4}:color=0x456BE0@0.35:t=3:enable='between(t,{a:.3f},{b:.3f})'")
 fx.extend([f'fade=t=in:st=0:d=0.22',f'fade=t=out:st={target-.22}:d=0.22',f"ass=filename='{ROOT}/sources/{ident}.ass':fontsdir='{FONTDIR}'",'format=yuv420p'])
 filt+='[base]'+','.join(fx)+'[v]'
 args+=['-filter_complex',filt,'-map','[v]','-map',f'{2 if is_ui else 1}:a:0','-t',str(target),'-c:v','libx264','-preset','veryfast','-crf','19','-threads','3','-r','30','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','1','-movflags','+faststart',str(output)]
 run(args,ROOT/'segments'/f'{ident}.log');print('RENDERED',ident,s['title'],flush=True)

def finish():
 metadata=';FFMETADATA1\ntitle=OMNIS 기술평가 발표 · 15분\nartist=OMNIS\ncomment=Actual isolated app recording and explanatory diagrams. Korean synthesized narration: macOS Yuna.\n'
 for ch in range(1,9):
  group=[s for s in scenes if s['chapter']==ch];name=json.loads((ROOT/'sources/chapters.json').read_text())[ch-1]['title'];metadata+=f'[CHAPTER]\nTIMEBASE=1/1000\nSTART={group[0]["at"]*1000}\nEND={(group[-1]["at"]+group[-1]["duration"])*1000}\ntitle={ch:02}. {name}\n'
 (ROOT/'sources/chapters.ffmeta').write_text(metadata);(ROOT/'sources/video-concat.txt').write_text(''.join(f"file '{ROOT}/segments/{s['id']}.mp4'\n"for s in scenes))
 output=ROOT/'OMNIS_기술평가_시현영상_15분.mp4';run(['-f','concat','-safe','0','-i',str(ROOT/'sources/video-concat.txt'),'-i',str(ROOT/'sources/chapters.ffmeta'),'-map','0','-map_metadata','1','-map_chapters','1','-t','900','-c','copy','-movflags','+faststart',str(output)],ROOT/'segments/final.log');print('VIDEO COMPLETE',output,flush=True)

if __name__=='__main__':
 audio()
 if '--audio-only'in sys.argv:sys.exit(0)
 ui_sources()
 with concurrent.futures.ThreadPoolExecutor(max_workers=2)as p:list(p.map(render_scene,scenes))
 finish()
