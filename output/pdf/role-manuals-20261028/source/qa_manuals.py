from pathlib import Path
import json,re,subprocess,concurrent.futures,sys
from pypdf import PdfReader
import pdfplumber
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];EV=ROOT/'evidence';books=json.loads((EV/'books.json').read_text('utf8'));font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',16)
def inspect(book):
 path=ROOT/book['file'];code=book['role']or'ALL';dest=ROOT/'rendered-final'/code;dest.mkdir(parents=True,exist_ok=True)
 if '--text-only' not in sys.argv:
  for old in list(dest.glob('page-*.png'))+list(dest.glob('contact-*.png')):
   assert old.resolve().is_relative_to((ROOT/'rendered-final').resolve());old.unlink()
 reader=PdfReader(path);texts=[p.extract_text()or'' for p in reader.pages];full='\n'.join(texts)
 bad=[];overlaps=[]
 with pdfplumber.open(path)as pdf:
  for n,p in enumerate(pdf.pages,1):
   for c in p.chars:
    if c['x0']<33 or c['x1']>p.width-33 or c['top']<12 or c['bottom']>p.height-12:bad.append({'page':n,'text':c['text'],'x':round(c['x0'],1),'top':round(c['top'],1)})
    # Text in page-body footer zone signals overflow, excluding ordinary footer.
    if c['size']>8.1 and c['bottom']>799:overlaps.append(n)
 fontstatus={}
 page_ids={p.indirect_reference.idnum for p in reader.pages};links=0;badlinks=[]
 for n,p in enumerate(reader.pages,1):
  for ref in p['/Resources'].get('/Font',{}).values():
   f=ref.get_object();d=f.get('/FontDescriptor');embedded=bool(d and any(x in d.get_object()for x in ['/FontFile','/FontFile2','/FontFile3']));fontstatus[str(f.get('/BaseFont'))]=embedded
  for ref in p.get('/Annots',[]):
   a=ref.get_object()
   if a.get('/Subtype')!='/Link':continue
   links+=1;destination=a.get('/Dest')
   if destination and isinstance(destination,list) and hasattr(destination[0],'idnum') and destination[0].idnum not in page_ids:badlinks.append(n)
 anchors=[]
 for key,n in book['anchors'].items():
  if not 1<=n<=len(reader.pages):anchors.append(key)
 missing=[id for id in book['tasks'] if not re.search(r'\b'+id+r'\b',full)]
 result={'file':book['file'],'role':code,'pages':len(reader.pages),'textCharacters':len(full),'emptyPages':[i+1 for i,t in enumerate(texts)if len(t.strip())<70],'missingTasks':missing,'outsideMargins':bad[:50],'bodyFooterCollisions':sorted(set(overlaps)),'replacementCharacters':full.count('\ufffd'),'fonts':fontstatus,'links':links,'badLinks':badlinks,'invalidAnchorPages':anchors,'koreanPresent':'사용자'in full,'rendered':False}
 (EV/(code+'-extracted.txt')).write_text('\n\n'.join(f'PAGE {i+1}\n{t}'for i,t in enumerate(texts)),'utf8')
 if '--text-only' not in sys.argv:subprocess.run(['pdftoppm','-r','45','-png',str(path),str(dest/'page')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 imgs=sorted(dest.glob('page-*.png'));assert len(imgs)==len(reader.pages),(code,len(imgs),len(reader.pages));result['rendered']=True
 for start in range(0,len(imgs),20):
  sheet=Image.new('RGB',(1200,2210),'#D8E1EB');draw=ImageDraw.Draw(sheet)
  for j,p in enumerate(imgs[start:start+20]):
   im=Image.open(p).convert('RGB');im.thumbnail((280,400));x=10+(j%4)*300;y=32+(j//4)*442;sheet.paste(im,(x,y));draw.text((x,y-25),f'{code} {start+j+1}',font=font,fill='#20335B')
  sheet.save(dest/f'contact-{start//20+1:02}.png')
 print(code,result['pages'],'margins',len(bad),'missing',missing,flush=True);return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:results=list(pool.map(inspect,books))
(EV/'pdf-quality.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),'utf8')
print('Total pages',sum(x['pages']for x in results))
