from pathlib import Path
import json,hashlib,zipfile
from datetime import datetime,timezone,timedelta
O=Path(__file__).resolve().parents[1]
files=[O/n for n in ['OMNIS_전체시스템아키텍처.svg','OMNIS_전체시스템아키텍처.png','OMNIS_시스템아키텍처_발표자료.pptx','OMNIS_시스템아키텍처_발표자료.pdf','OMNIS_시스템아키텍처.drawio','README.md']]
files+=sorted(p for p in (O/'details').iterdir() if p.is_file())
files+=sorted(p for p in (O/'evidence').iterdir() if p.is_file())
files+=sorted(p for p in (O/'evidence/rendered').iterdir() if p.is_file())
files+=[O/'source'/n for n in ['architecture-model.json','scenes.json','source-refs.json','analyze.py','make_scenes.py','verify.py','write_notes.py','finalize_docs.py','export_powerpoint.ps1','rebuild.ps1','package.py','build/build.mjs','build/render_svg.mjs']]
assert len(files)==len(set(files))
for f in files:
 if not f.is_file():raise FileNotFoundError(f)
entries=[dict(filename=f.relative_to(O).as_posix(),size=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in files]
manifest=dict(schema='omnis.architecture-manifest.v1',generatedAt=datetime.now(timezone(timedelta(hours=9))).isoformat(),timeZone='Asia/Seoul',scope='Final artifacts, regeneration sources and evidence only. Excludes intermediate revisions, runtime dependency junction, and this manifest itself.',files=entries)
(O/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
archive=O.parent/('OMNIS_시스템아키텍처_'+O.name+'.zip')
if archive.exists():raise FileExistsError('Archive exists; use a fresh filename to preserve prior delivery: '+str(archive))
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in files+[O/'manifest.json']:z.write(f,f.relative_to(O).as_posix())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for entry in entries:assert hashlib.sha256(z.read(entry['filename'])).hexdigest()==entry['sha256']
 assert json.loads(z.read('manifest.json'))==manifest
sha=hashlib.sha256(archive.read_bytes()).hexdigest();archive.with_suffix('.zip.sha256').write_text(sha+'  '+archive.name+'\n',encoding='utf8')
result=dict(archive=str(archive),bytes=archive.stat().st_size,sha256=sha,manifestFiles=len(entries),zipEntries=len(files)+1,CRC='pass',allEntrySHA256='pass')
(O.parent/('.'+O.name+'-package-validation.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result,ensure_ascii=False))
