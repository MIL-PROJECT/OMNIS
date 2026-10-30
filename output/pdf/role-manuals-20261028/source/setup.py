from pathlib import Path
import json,hashlib,shutil,subprocess,datetime
root=Path(__file__).resolve().parents[1];repo=root.parents[2];ev=root/'evidence';snap=ev/'snapshot'
for p in [ev,snap,root/'screenshots',root/'rendered'] : p.mkdir(parents=True,exist_ok=True)
old=repo/'reports/project-analysis/20261028-technical-audit'
inventory=json.loads((old/'evidence/inventory.json').read_text('utf8'))
paths={x['path'] for x in inventory['files']}
paths.update(['build/icon.png','build/icon.ico','build/entitlements.mac.plist'])
records=[];diff=[]
prior={x['path']:x['sha256'].lower() for x in inventory['files']}
for name in sorted(paths):
 p=repo/name
 if not p.is_file():continue
 dest=snap/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
 digest=hashlib.sha256(p.read_bytes()).hexdigest();records.append({'path':name,'sha256':digest})
 if name in prior and digest!=prior[name]:diff.append(name)
meta={'capturedAt':datetime.datetime.now().astimezone().isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),'status':subprocess.check_output(['git','status','--short'],cwd=repo,text=True),'changedSincePrior':diff,'files':records}
(ev/'source-manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),'utf8')
shutil.copyfile(old/'기능목록_상세.json',ev/'prior-features.json')
print(json.dumps({k:v for k,v in meta.items() if k!='files'},ensure_ascii=False))
