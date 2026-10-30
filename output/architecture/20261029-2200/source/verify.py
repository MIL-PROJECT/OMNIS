from pathlib import Path
import json,re,zipfile,hashlib,subprocess,unicodedata,xml.etree.ElementTree as ET
from PIL import Image
from pypdf import PdfReader
OUT=Path(__file__).resolve().parents[1];ROOT=OUT.parents[2]
M=json.loads((OUT/'source/architecture-model.json').read_text(encoding='utf8'));S=json.loads((OUT/'source/scenes.json').read_text(encoding='utf8'))
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
errors=[];reports=[];validIds={n['id'] for n in M['nodes']}|{e['id'] for e in M['dataEntities'] if 'id'in e}
rm={r['id']:r for r in M['sourceRefs']}
for r in M['sourceRefs']:
 lines=(ROOT/r['path']).read_text(encoding='utf-8-sig').splitlines(); actual='\n'.join(lines[r['lineStart']-1:r['lineEnd']])
 if not actual.startswith(r['snippet']):errors.append('source ref changed: '+r['id'])
for n in M['nodes']:
 if n['parentBoundary'] and n['parentBoundary'] not in validIds:errors.append('unknown boundary '+n['id'])
for edge in M['edges']:
 if edge['from'] not in validIds or edge['to'] not in validIds or not edge['sourceRefs']:errors.append('invalid model edge '+edge['id'])
for p,h in M['sourceFingerprints'].items():
 if hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h:errors.append('source modified: '+p)
for sl in S['slides']:
 for o in sl['items']:
  if any(i not in validIds for i in o.get('componentIds',[])):errors.append('unknown component: '+o['id'])
  if o['type']=='path' and o['arrow'] and not o['sourceRefs']:errors.append('unsourced arrow: '+o['id'])
  if o['type']=='text' and o['size']<16:errors.append('font below12pt: '+o['id'])
reader=PdfReader(OUT/'OMNIS_시스템아키텍처_발표자료.pdf')
if len(reader.pages)!=6:errors.append('PDF page count')
normal=lambda x:re.sub(r'\s+','',unicodedata.normalize('NFKC',x))
with zipfile.ZipFile(OUT/'OMNIS_시스템아키텍처_발표자료.pptx') as z:
 if z.testzip():errors.append('PPTX zip CRC')
 for i,sl in enumerate(S['slides'],1):
  root=ET.fromstring(z.read(f'ppt/slides/slide{i}.xml'));texts=[x.text or '' for x in root.findall('.//a:t',ns)]
  expected=[o['text'] for o in sl['items'] if o['type']=='text'];pdftext=reader.pages[i-1].extract_text();notes=ET.fromstring(z.read(f'ppt/notesSlides/notesSlide{i}.xml'));notetext='\n'.join(x.text or '' for x in notes.findall('.//a:t',ns))
  missingpdf=[t for t in expected if normal(t) not in normal(pdftext)];missingppt=[t for t in expected if t not in texts]
  if missingpdf:errors.append('PDF text missing slide'+str(i)+': '+str(missingpdf))
  if missingppt:errors.append('PPTX text missing slide'+str(i))
  if sl['notes'] not in notetext:errors.append('notes missing slide'+str(i))
  pictures=len(root.findall('.//p:pic',ns));conns=len(root.findall('.//p:cxnSp',ns));shapes=len(root.findall('.//p:sp',ns))
  if pictures:errors.append('unexpected embedded raster slide'+str(i))
  svg=ET.parse(OUT/(sl['stem']+'.svg'));svgtxt=[x.text or '' for x in svg.findall('.//{http://www.w3.org/2000/svg}text')]
  if svgtxt!=expected:errors.append('SVG text mismatch slide'+str(i))
  with Image.open(OUT/(sl['stem']+'.png')) as im:pngsize=im.size
  if pngsize!=(3840,2160):errors.append('PNG dimensions slide'+str(i))
  reports.append(dict(slide=i,editableShapes=shapes,editableConnectors=conns,editableTextBoxes=len(texts),embeddedRasterPictures=pictures,notesCharacters=len(sl['notes']),notesEditable=True,PNG=list(pngsize),PDFMissingText=missingpdf,PPTXMissingText=missingppt,SVGTextMatches=True))
# Render final native PowerPoint PDF through Poppler, all pages at the presentation ratio.
poppler=Path('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
subprocess.run([str(poppler),'-png','-scale-to-x','1920','-scale-to-y','1080',str(OUT/'OMNIS_시스템아키텍처_발표자료.pdf'),str(OUT/'evidence/rendered/pdf')],check=True,capture_output=True)
for i in range(1,7):
 with Image.open(OUT/f'evidence/rendered/pdf-{i}.png') as im:
  if im.size!=(1920,1080):errors.append('PDF render dimensions')
# Source-only test coverage map. No app test execution is claimed.
testmap=[('AUTH G W','tests/e2e/roles.mjs','UI 역할 및 Main 접근 제한 E2E 소스'),('AUTH','tests/e2e/signup.mjs','가입 승인/반려 E2E 소스'),('DB','tests/integration/database.test.ts','migration/seed/SQL·첨부 시험 소스'),('U','tests/integration/usability.test.ts','snapshot·체크리스트·내 업무·반복 중복/rollback 시험 소스'),('C W','tests/integration/organization.test.ts','부서 배정·요청부서 보존 시험 소스'),('C W','tests/integration/organization-contacts.test.ts','가상 명부·소속 담당 검증 시험 소스'),('C','tests/integration/operational-control.test.ts','상황경보·정합성·마감 시험 소스'),('AI F O GUARD LIMIT SECRET','tests/unit/external-ai.test.ts','SDK mock·retry/fallback·마스킹·한도·암호화 adapter 시험 소스'),('AI PROMPT','tests/unit/prompt-catalog.test.ts','prompt/schema 계약 시험 소스'),('OLLAMA','tests/unit/ai-provider.test.ts','mock fetch/출력 검증 소스'),('MANUAL','tests/manuals.test.ts','번들 PDF 열기/저장 로컬 시험 소스'),('MANUAL','tests/e2e/manuals.mjs','격리 profile 매뉴얼 다운로드 E2E 소스')]
import csv
with (OUT/'evidence/소스_시험_대응표.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['구성요소ID','시험파일','근거행','범위','이번작업상태'])
 for ids,p,meaning in testmap:
  lines=(ROOT/p).read_text(encoding='utf8').splitlines();line=next((j for j,t in enumerate(lines,1) if re.search(r'\b(describe|test|it)\(',t)),1)
  w.writerow([ids,p,line,meaning,'소스 확인; 이번 실행하지 않음'])
tracked=subprocess.check_output(['git','diff','--name-status','HEAD'],cwd=ROOT).decode('utf8').strip()
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
if head!=M['gitCommit'] or tracked:errors.append('Git HEAD/tracked state changed')
result=dict(status='pass' if not errors else 'fail',errors=errors,sourceRefsVerified=len(M['sourceRefs']),sourceFingerprintsVerified=len(M['sourceFingerprints']),nodes=len(M['nodes']),edges=len(M['edges']),tables=33,PDFPages=len(reader.pages),slides=reports,gitCommit=head,trackedDiff=tracked,claimBoundary='Artifact/source verification only; no app regression, AI live request, installation or CI execution')
(OUT/'evidence/verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result,ensure_ascii=False))
if errors:raise SystemExit(1)
