from pathlib import Path
import hashlib,json,shutil,subprocess,datetime
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[2];OLD=ROOT.parent/'role-manuals-20261028';EV=ROOT/'evidence';SNAP=EV/'snapshot'
for p in [EV,SNAP,ROOT/'screenshots',ROOT/'rendered',ROOT/'source']:p.mkdir(parents=True,exist_ok=True)
prior=json.loads((OLD/'evidence/source-manifest.json').read_text('utf8'));paths={x['path']for x in prior['files']}
paths.update(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','src','tests','scripts'],cwd=REPO,text=True).splitlines())
paths.update(['package.json','pnpm-lock.yaml','vitest.config.ts'])
rows=[]
for name in sorted(paths):
 p=REPO/name
 if not p.is_file()or '/.tmp/'in name:continue
 target=SNAP/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target);rows.append({'path':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
oldhash={x['path']:x['sha256']for x in prior['files']}
changed=[x['path']for x in rows if oldhash.get(x['path'])!=x['sha256']]
meta={'capturedAt':datetime.datetime.now().astimezone().isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip(),'status':subprocess.check_output(['git','status','--short'],cwd=REPO,text=True),'changedSincePrior':changed,'files':rows}
(EV/'source-manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),'utf8')
for name in ['content.py','workflows.py','operations.py','admin.py','guide.py','build_manuals.py','checks.mjs','probe.mjs']:
 shutil.copyfile(OLD/'source'/name,ROOT/'source'/name)
for p in (OLD/'screenshots').glob('*.png'):shutil.copyfile(p,ROOT/'screenshots'/p.name)
for name in ['ui-results.json','supplement-results.json','attachment-retry-results.json']:
 shutil.copyfile(OLD/'evidence'/name,EV/name)
baseline=EV/'previous';baseline.mkdir(exist_ok=True)
for name in ['ui-results.json','supplement-results.json','attachment-retry-results.json','probes.json','source-manifest.json','pdf-quality.json','navigation-quality.json']:
 shutil.copyfile(OLD/'evidence'/name,baseline/name)
checks=ROOT/'source/checks.mjs';s=checks.read_text('utf8');s=s.replace("delete env.ELECTRON_RUN_AS_NODE;","delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;delete env.ANTHROPIC_API_KEY;");checks.write_text(s,'utf8')
print(json.dumps({'files':len(rows),'changed':changed},ensure_ascii=False))
