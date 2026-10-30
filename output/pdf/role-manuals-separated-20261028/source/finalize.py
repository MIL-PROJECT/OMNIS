from pathlib import Path
import json,re,csv,hashlib,subprocess,datetime,zipfile,sys
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1];EV=ROOT/'evidence';REPO=ROOT.parents[2];OLD=ROOT.parent/'role-manuals-20261028'
def dump(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2),'utf8')
manifest=json.loads((EV/'source-manifest.json').read_text('utf8'))
drift=[]
for row in manifest['files']:
 p=REPO/row['path'];h=hashlib.sha256(p.read_bytes()).hexdigest()if p.exists()else None
 if h!=row['sha256']:drift.append({'path':row['path'],'snapshotHash':row['sha256'],'currentHash':h})
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
dump(EV/'source-drift-final.json',{'checkedAt':datetime.datetime.now().astimezone().isoformat(),'snapshotHead':manifest['head'],'currentHead':head,'changedSinceSnapshot':drift,'policy':'Application source was not modified; frozen snapshot remains the document baseline.'})
# Compare complete per-channel handler blocks between the previous and current frozen source.
rel='src/main/services/AppService.ts'
def handlers(path):
 text=path.read_text('utf8');matches=list(re.finditer(r"^  if \(channel === '([^']+)'\)",text,re.M));return{m[1]:text[m.start():matches[i+1].start()if i+1<len(matches)else text.find('\n  throw',m.start())].strip()for i,m in enumerate(matches)}
a=handlers(OLD/'evidence/snapshot'/rel);b=handlers(EV/'snapshot'/rel)
diff=[{'channel':k,'result':'same'if a.get(k)==b.get(k)else'changed'if k in a and k in b else'added_or_removed'}for k in sorted(a.keys()|b.keys())]
dump(EV/'handler-drift.json',diff)

books=json.loads((EV/'books.json').read_text('utf8'));navigation=[]
for book in books:
 reader=PdfReader(ROOT/book['file']);errors=[];outlines=[]
 def walk(items):
  for item in items:
   if isinstance(item,list):walk(item)
   else:
    page=reader.get_destination_page_number(item)+1;title=item.title;outlines.append({'title':title,'page':page})
    compact=lambda s:re.sub(r'\s+','',s)
    if compact(title)not in compact(reader.pages[page-1].extract_text()):errors.append({'bookmark':title,'page':page})
 walk(reader.outline)
 targets={p.indirect_reference.idnum:i+1 for i,p in enumerate(reader.pages)};toc_links=[]
 for n in range(book['anchors']['toc']-1,book['anchors']['start']-1):
  for ann in reader.pages[n].get('/Annots',[]):
   d=ann.get_object().get('/Dest')
   if d and isinstance(d,list):toc_links.append(targets.get(d[0].idnum))
 navigation.append({'role':book['role'],'bookmarkCount':len(outlines),'bookmarks':outlines,'bookmarkTextPageMismatches':errors,'tocLinkCount':len(toc_links),'tocLinksHaveValidPage':all(x is not None for x in toc_links),'allTaskLinksInOwnDocument':all(x in book['tasks']for x in book['references'])})
 assert not errors and toc_links and all(x is not None for x in toc_links)
 text='\n'.join(p.extract_text()or''for p in reader.pages)
 assert not re.search(r'통합본\s*\d+\s*쪽|통합 매뉴얼.*참고|다른 역할.*PDF에서',text)
 assert re.sub(r'\s+','','캘린더 작업 클릭 상세 열기도 구현되지 않았습니다.')in re.sub(r'\s+','',text)
dump(EV/'navigation-quality.json',navigation)
rows=[]
for fn in ['current-ui.json','current-settings.json']:
 for r in json.loads((EV/fn).read_text('utf8'))['results']:
  level=r['level']
  if r['id']=='NEW-ADMIN-NETWORK-GUARD':level='내부 호출·자동화 테스트 확인'
  rows.append([r['id'],r['role'],r.get('task','비관리자 AI 설정 변경 거부'),level,r['status'],json.dumps(r.get('detail',r.get('result')),ensure_ascii=False),'evidence/'+fn])
with (ROOT/'현재_재검증결과.csv').open('w',encoding='utf-8-sig',newline='')as f:csv.writer(f).writerows([['검증ID','역할','업무','검증수준','상태','실제결과','증거']]+rows)
assert all(r[4]=='통과'for r in rows)
counts={b['role']:b['pages']for b in books}
readme=f'''# 역할별 독립 사용자 매뉴얼 — 재생성 및 검증 안내

확인일: 2026-10-28 KST. OMNIS 1.0.0, DB schema v5.
기준 커밋: {manifest['head']}. 미커밋 변경을 포함한 95개 파일 스냅샷.
기존 문서는 덮어쓰지 않았고 앱 소스·운영 DB는 수정하지 않았습니다.

## 파일 구성
- 01~05 PDF: 역할별 독립 목차·책갈피·내부 링크. 페이지 수 {counts} (총 {sum(counts.values())}쪽).
- 같은 이름의 Markdown: 편집 가능한 본문. 이미지 경로는 이 폴더 기준입니다.
- 역할별_절차원본.json: 최종 역할별 입력·절차·결과·복구·제한.
- source/role_content.py: 역할별 선별·재작성. source/separate.py: 공통 편집과 PDF 생성.
- 역할별_권한_및_업무표.csv, 역할별_수록업무_및_검증범위.csv: 권한·절차·검증 수준.
- 현재_재검증결과.csv: 이번 실제 UI 및 내부 호출 결과. 이전 결과는 evidence/previous.
- screenshots: 실제 가상 교육 환경 화면. current-는 현재 촬영. 다른 계정 촬영은 캡션에 표시.
- evidence: 소스 해시, 고정 코드, 검사 로그, PDF 검사 결과, 텍스트 추출, 시각 검수 근거.

## 문서 내용 수정
Markdown만 수정하면 다음 생성에 반영되지 않습니다. 역할 절차는 source/role_content.py,
공통 설명·레이아웃은 source/separate.py, 이전 절차 기반은 content/workflows/operations/admin/guide.py를 수정합니다.
생성 시 각 역할의 Markdown과 JSON을 다시 내보냅니다. 원본 PDF 페이지 추출 방식이 아닙니다.

## PDF만 재생성 (앱 실행 불필요)
Windows, Python 3, reportlab·pypdf·pdfplumber·Pillow와 Windows 맑은 고딕이 필요합니다.
Poppler의 pdftoppm이 PATH에 있어야 전체 페이지를 렌더링할 수 있습니다.
새 결과 폴더를 복제해 그 폴더에서 아래를 실행하세요. 기존 결과를 보존할 수 있습니다.

```powershell
python -X utf8 source/separate.py
python -X utf8 source/qa_manuals.py
python -X utf8 source/finalize.py
```

finalize.py의 소스 드리프트 비교는 이 문서 폴더가 프로젝트의 output/pdf 하위에 있는 경우를 기준으로 합니다.
다른 위치에서는 비교 경로를 명시적으로 맞추세요. 문서 생성 자체는 source와 evidence 및 screenshots가 있으면 가능합니다.
이 환경에서 사용한 Python은 C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe 입니다.
prepare.py는 최초 증거 고정 스크립트이며 재실행하면 편집된 보조 파일을 덮어쓸 수 있으므로 재생성에 사용하지 마세요.
구형 build_manuals.py는 레이아웃 기반 모듈로 import하며 직접 실행하지 않습니다.

## 앱 검증을 다시 해야 할 경우
프로젝트 의존성과 Electron/Playwright가 준비된 동일 Windows 환경이 필요합니다.
source/checks.mjs는 evidence/snapshot에서 타입·Lint·테스트·seed·build·기존 E2E를 수행합니다.
source/current-ui.mjs 및 settings-captures.mjs는 해당 build와 격리 프로필을 사용합니다.
이 스크립트는 OPENAI_API_KEY·ANTHROPIC_API_KEY를 제거하고 Local Rule만 사용합니다.
운영 프로필이나 실제 계정으로 바꾸지 마세요. 새 검증은 새 결과 폴더와 새 테스트 프로필에서 수행하세요.
ZIP에는 node_modules, 앱 build, Electron 캐시, 테스트 DB·프로필·자격증명을 포함하지 않았습니다.

## 검사 결과를 읽는 법
- 타입·seed·build 통과. Lint 10건 오류(앱 소스 수정 안 함).
- 단위·통합 31건 중 29건 통과. DB 테스트 2건은 스키마 기대값 4/현재 5 불일치.
- 기존 E2E 5종 중 smoke·signup·visual-check 통과. roles·operations-flow는 구형 AI 설정 입력 때문에 중단.
- 현재 역할별 UI/AI와 보완 내부 호출은 결과 CSV 참조. 외부 API 실행은 0건.
- 신규 관리자 외 4개 역할의 설정 변경 거부는 현재 입력 스키마로 보완 확인.
- 이전 역할별 증거를 다른 역할의 UI 통과로 바꾸지 않았습니다. 메뉴 조회는 모든 상세 조작의 검증이 아닙니다.
- OS 파일 대화상자·실제 기본 앱 열기, 외부 모델 품질, 설치·업데이트·실제 장비는 미검증.

## 개선한 내용
조회전용 첨부 추가·삭제 안내 제거, 사용자 본인 종결 절차 분리, 조회·수정·인계 요청 구분,
현재 USER/VIEWER AI 권한 변경 반영, 외부 Provider 설정의 미검증 범위 표시,
정비 캘린더의 존재하지 않는 클릭 상세 열기 안내 정정, 근무현황 탭명 정정,
실제 역할별 검증 출처 정정, 각 PDF 독립 목차·페이지·책갈피 재생성.

## PDF 검수
pdf-quality.json: 전 페이지 렌더링, 텍스트 추출, 글꼴 포함, 여백, 빈 페이지, 링크 검사.
navigation-quality.json: 책갈피 제목과 목적 페이지 본문 일치, 목차 링크와 내부 참조 검사.
visual-review.json: 전체 축소판 및 확대 페이지의 실제 시각 검토 기록.
ZIP에는 전체 페이지 축소판(contact)과 선택 확대 검수 이미지를 포함합니다.
전체 페이지 개별 PNG는 원본 결과 폴더의 rendered-final에 있으며 재생성할 수 있습니다.
Helvetica 리소스는 ReportLab 기본 리소스이며 한글 본문·표·목차는 포함된 MalgunGothic 계열을 사용합니다.

## 변경 기준과 현재 소스
source-manifest.json이 문서 기준입니다. handler-drift.json은 이전/현재 Main 처리 블록 비교입니다.
최종 소스 비교에서 기준 이후 변경 {len(drift)}개, 커밋 변경 {'있음'if head!=manifest['head']else'없음'}.
상세 목록은 source-drift-final.json을 확인하세요. 기준 이후 변경을 문서에서 검증했다고 주장하지 않습니다.
'''
(ROOT/'재생성_안내.md').write_text(readme,'utf8')
summary={'books':books,'totalPages':sum(counts.values()),'currentVerificationCases':len(rows),'currentVerificationPassed':sum(r[4]=='통과'for r in rows),'driftFiles':len(drift),'sourceFileCount':len(manifest['files']),'changedSincePrior':len(manifest['changedSincePrior'])}
dump(EV/'report-summary.json',summary)
print(json.dumps({k:v for k,v in summary.items()if k!='books'},ensure_ascii=False))
if '--zip'in sys.argv:
 out=ROOT/'역할별_독립_사용자매뉴얼_전체자료.zip'
 # Explicit allowlist: no DB, profiles, caches, node_modules or build bundles.
 files=list(ROOT.glob('*.pdf'))+list(ROOT.glob('*.md'))+list(ROOT.glob('*.csv'))+[ROOT/'역할별_절차원본.json']
 files+=list((ROOT/'source').rglob('*.py'))+list((ROOT/'source').rglob('*.mjs'))+list((ROOT/'screenshots').glob('*.png'))
 files+=list(EV.glob('*.json'))+list(EV.glob('*.log'))+list(EV.glob('*-extracted.txt'))+list((EV/'previous').glob('*.json'))
 files+=[EV/'snapshot'/r['path']for r in manifest['files']]
 files+=list((ROOT/'rendered-final').glob('*/contact-*.png'))+list((ROOT/'rendered-final').glob('details/*.png'))
 files=[p for p in sorted(set(files))if p.is_file()and p.name!='zip-validation.json']
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for p in files:z.write(p,p.relative_to(ROOT).as_posix())
 with zipfile.ZipFile(out)as z:
  assert z.testzip()is None
  assert all(not any(x in n.split('/')for x in ['node_modules','out','__pycache__','current-ui-profile'])for n in z.namelist())
  assert len([n for n in z.namelist()if '/'not in n and n.endswith('.pdf')])==5
  for b in books:assert hashlib.sha256(z.read(b['file'])).hexdigest()==b['sha256']
 dump(EV/'zip-validation.json',{'file':out.name,'files':len(files),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'crc':'pass','pdfHashes':'pass','excluded':'DB, profiles, cache, node_modules, build bundles'})
 print(out,len(files),out.stat().st_size)
