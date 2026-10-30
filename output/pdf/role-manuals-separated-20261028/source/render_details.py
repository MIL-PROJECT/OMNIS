from pathlib import Path
import json,subprocess
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'rendered-final/details';out.mkdir(parents=True,exist_ok=True)
books=json.loads((ROOT/'evidence/books.json').read_text('utf8'))
targets={'ADMIN':['cover','A02-screen','external-ai','validation'],'OPERATOR':['T07-screen'],'MAINTAINER':['T12-screen'],'USER':['C07','C07-screen','T10'],'VIEWER':['C05','C08-screen']}
rows=[]
for b in books:
 for key in targets[b['role']]:
  n=1 if key=='cover'else b['anchors'][key];name=b['role']+'-'+key
  subprocess.run(['pdftoppm','-f',str(n),'-l',str(n),'-r','125','-singlefile','-png',str(ROOT/b['file']),str(out/name)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  rows.append({'role':b['role'],'page':n,'key':key,'file':'rendered-final/details/'+name+'.png'})
(ROOT/'evidence/detail-pages.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),'utf8')
print('Rendered',len(rows),'detail pages')
