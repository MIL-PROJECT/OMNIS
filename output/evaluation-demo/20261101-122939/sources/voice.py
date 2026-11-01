import json,re,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
scenes=json.loads((ROOT/'sources/scenes.json').read_text())
cache={s['id']:s for s in json.loads((ROOT/'sources/voiced-scenes.json').read_text())} if (ROOT/'sources/voiced-scenes.json').exists() else {}
for s in scenes:
    speech=[]
    for i,text in enumerate(re.split(r'(?<=[.!?])\s+',s['narration'])):
        text=text.strip()
        if not text:continue
        path=ROOT/'audio'/f'{s["id"]}-{i:02}.aiff'
        old=cache.get(s['id'],{}).get('speech',[])
        if not path.exists() or i>=len(old) or old[i]['text']!=text:subprocess.run(['/usr/bin/say','-v','Yuna','-r','175','-o',str(path),text],check=True,timeout=120)
        info=subprocess.check_output(['/usr/bin/afinfo',str(path)],text=True)
        m=re.search(r'estimated duration: ([0-9.]+)',info)
        if not m:raise RuntimeError(info)
        duration=float(m[1])
        if duration<.25:raise RuntimeError('Empty speech '+str(path))
        speech.append({'text':text,'path':str(path),'duration':duration})
    s['speech']=speech;s['speechDuration']=sum(p['duration'] for p in speech)
    s['naturalSpeedForTarget']=s['speechDuration']/(s['duration']-1.5)
    print(s['id'],s['title'],round(s['speechDuration'],2),'target',s['duration'],'ratio',round(s['naturalSpeedForTarget'],3),flush=True)
    (ROOT/'sources/voiced-scenes.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2))
print('VOICE COMPLETE',flush=True)
