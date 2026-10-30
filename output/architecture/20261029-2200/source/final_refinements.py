from pathlib import Path
p=Path(__file__).with_name('analyze.py');s=p.read_text(encoding='utf-8-sig')
s=s.replace("tracked=git('ls-files').splitlines()", """for f in flows:
 f['requestPath']=[];f['responsePath']=[]
 if f['fromId'] in ['R','REVIEW'] and f['toId'] in ['W','U','AI']:
  f['requestPath']=[f['fromId'],'P','G','S',f['toId']]
  f['sourceRefs']=list(dict.fromkeys(f['sourceRefs']+[R['preload'],R['ipc'],R['route']]))
 if f['toId'] in ['R','REVIEW']:
  f['responsePath']=[f['fromId'],'S','G','P',f['toId']]
tracked=git('ls-files').splitlines()""")
s=s.replace("실행방식=f['execution'],근거=fmt(f['sourceRefs'])", "실행방식=f['execution'],공통IPC경로=' → '.join(f['requestPath']),응답경로=' → '.join(f['responsePath']),근거=fmt(f['sourceRefs'])")
p.write_text(s,encoding='utf8')
p=Path(__file__).with_name('make_scenes.py');s=p.read_text(encoding='utf-8-sig')
s=s.replace("path([(1089,510),(1089,609)]", "path([(943,453),(971,453)],'E21',dash=True,color=C['ai'])\npath([(1089,510),(1089,609)]")
p.write_text(s,encoding='utf8')
p=Path(__file__).parent/'build/build.mjs';s=p.read_text(encoding='utf-8-sig').replace('.20261029-2200-r3-pptx-validation.json','.20261029-2200-r4-pptx-validation.json');p.write_text(s,encoding='utf8')
