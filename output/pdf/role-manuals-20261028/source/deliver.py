from pathlib import Path
import csv,json,re,hashlib,subprocess,datetime,zipfile
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1];EV=ROOT/'evidence';REPO=ROOT.parents[2]
read=lambda p:json.loads(p.read_text('utf8'))
write=lambda p,x:p.write_text(json.dumps(x,ensure_ascii=False,indent=2),'utf8')
tasks=read(ROOT/'사용자절차_원본.json');books=read(EV/'books.json');manifest=read(EV/'source-manifest.json')
observations=[];current={}
for filename in ['ui-results.json','supplement-results.json','attachment-retry-results.json']:
 for row in read(EV/filename)['results']:
  row={**row,'evidence':'evidence/'+filename};observations.append(row);current[row['id']]=row
probes={x['id']:x for x in read(EV/'probes.json')}
with (ROOT/'사용자절차_검증결과.csv').open('w',encoding='utf-8-sig',newline='')as f:
 w=csv.writer(f);w.writerow(['역할','절차','업무','사전 조건','수행 절차','예상 결과','실제 관찰 결과','검증 수준','실행한 역할','증거 파일','제한사항'])
 for t in tasks:
  uiids=re.findall(r'UI\d+',t['check']);pids=re.findall(r'P\d+',t['check'])
  if t['id']in ['C01','C03','C04']:uiids+=['MENU-'+r for r in ['ADMIN','OPERATOR','MAINTAINER','USER','VIEWER']]
  selected=[current[id]for id in dict.fromkeys(uiids)if id in current]
  details=[r['id']+' '+r['status']+' ('+r['role']+'): '+r['task']+' '+json.dumps(r.get('detail',''),ensure_ascii=False)for r in selected]
  details += [id+': '+json.dumps(probes[id],ensure_ascii=False) for id in pids if id in probes]
  if t['id']=='T21':details.append('UI14는 지시 확인 버튼 조작 이후 AI 분류 기대에서 실패. 지시 확인 결과의 독립적인 저장·재조회 판정은 미실시.')
  for role in t['roles']:
   own=any(r['status']=='통과' and r['role']==role for r in selected)
   if t['id']=='C02':own=False
   level='실제 UI 실행 확인 (기록된 범위)'if own else '코드·설정 확인 (이 역할의 전체 절차 UI 재현 미검증)'
   if not own and pids:level+=' / 내부 호출 확인은 별도 근거 참고'
   ev=sorted({r['evidence']for r in selected}|({'evidence/probes.json'}if pids else set()))
   ev+=['source/'+('admin.py'if t['id'][0]=='A'else'content.py'if t['id'][0]=='C'else'workflows.py / operations.py'),'evidence/snapshot/src/']
   w.writerow([role,t['id'],t['title'],t['pre'],' / '.join(t['steps']),t['result'],' | '.join(details)or'현재 코드·설정 확인. 해당 전체 조작의 독립 실행 결과 없음.',level,','.join(sorted({r['role']for r in selected})),'; '.join(ev),t['warn']+' / '+t['check']])

head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
drift=[]
for x in manifest['files']:
 p=REPO/x['path'];now=hashlib.sha256(p.read_bytes()).hexdigest()if p.exists()else None
 if now!=x['sha256']:drift.append({'path':x['path'],'currentSha256':now,'baselineSha256':x['sha256']})
write(EV/'source-drift-final.json',{'checkedAt':datetime.datetime.now().astimezone().isoformat(),'baselineHead':manifest['head'],'currentHead':head,'changedFiles':drift,'gitStatus':subprocess.check_output(['git','status','--short'],cwd=REPO,text=True)})
norm=lambda s:re.sub(r'\s+','',s)
outline_results=[]
for book in books:
 reader=PdfReader(ROOT/book['file']);texts=[p.extract_text()or''for p in reader.pages];out=[]
 def walk(items):
  for item in items:
   if isinstance(item,list):walk(item)
   else:
    p=reader.get_destination_page_number(item);title=str(item.title);out.append({'title':title,'page':p+1,'headingMatches':norm(title)in norm(texts[p])})
 walk(reader.outline)
 outline_results.append({'file':book['file'],'outlineCount':len(out),'mismatches':[x for x in out if not x['headingMatches']],'outlines':out,'allTasksPresent':all(t in '\n'.join(texts)for t in book['tasks'])})
write(EV/'navigation-quality.json',outline_results)
quality=read(EV/'pdf-quality.json')
checks=[read(EV/(n+'.json'))for n in ['typecheck','lint','unit-integration','seed','build','e2e-smoke','e2e-roles','e2e-signup','e2e-operations-flow','e2e-visual-check']]
for q in quality:
 assert not any(q[k]for k in ['emptyPages','missingTasks','outsideMargins','bodyFooterCollisions','badLinks','invalidAnchorPages']),q['file']
 assert q['replacementCharacters']==0 and q['rendered']
 assert all(v for k,v in q['fonts'].items()if 'Malgun'in k)
assert all(not x['mismatches']and x['allTasksPresent']for x in outline_results)
assert len(books)==6 and len(tasks)==36
assert all(x['exitCode']==0 for x in checks)
lines=['# 검증 및 산출물 요약','',f"확인일: 2026-10-28 / 기준 커밋: {manifest['head']}",'',
'## 파일과 문서 범위','',f"PDF 6종 합계 {sum(x['pages']for x in quality)}쪽. 통합본의 고유 상세 절차는 36개이며 역할별 PDF에 공통 내용을 다시 포함하므로 전체 쪽수는 중복 내용을 포함합니다.",'',
'|문서|쪽수|수록 절차|','|---|---:|---:|']
for b,q in zip(books,quality):lines.append(f"|{b['file']}|{q['pages']}|{len(b['tasks'])}|")
lines+=['','## 실제 검증','',
'- 격리한 Windows Electron 앱에서 관리자·운용요원·정비요원·일반 사용자·조회전용으로 로그인하고 메뉴를 확인했습니다.',
'- 가상 고장 접수 → 내용 보완 → AI 추천 검토·반영 → 분류·팀/개인 배정 → 원격조치 → 조치완료 → 검증 → 요청자 확인·종결을 실제 화면으로 수행했습니다.',
'- 등록 신청·승인, 긴급 사후 접수, 정비 등록·진행·결과 완료·캘린더, 팀 작업판, 인수인계, 경보, 근무·지시, 체계 등록·상태, 통계, 관리자 백업·마감과 재시작 후 저장 확인을 수행했습니다.',
'- 첨부와 CSV/PDF는 화면 버튼 및 실제 파일 처리를 확인했지만 OS 파일 선택·저장 대화상자는 테스트 대체를 사용했습니다.',
'- 타입 검사·Lint·11개 단위/통합 테스트·seed·build·기존 E2E 5종은 모두 종료 코드 0입니다. 개별 로그는 evidence/에 있습니다.',
'- 9개 내부 경계 점검 P01~P09는 UI 검증과 구분했습니다. 권한 노출·날짜 집계·마감 이후 변경·수정 저장 누락·시연 초기화 오류를 현재 코드에서 재현했습니다. 테스트 통과가 이러한 결함의 해결을 뜻하지 않습니다.',
'','## 실패와 재검증 기록','',
'UI14는 조회전용에서 AI 분류를 허용한다고 기대했던 테스트가 실패했습니다. UI17에서 권한 거부가 실제 동작임을 확인하고 조회전용용 설명을 분리했습니다. UI14 중 지시 읽음 버튼은 조작했지만 저장 결과를 독립적으로 재조회한 판정은 없으므로 전체 성공으로 기록하지 않았습니다.',
'',
'UI20은 계정 전환 대기 때문에 한 차례 실패했고, 전환 대기를 보완하여 동일 가상 프로필에서 첨부 추가·삭제를 재검증해 통과했습니다. 원본 실패와 재시도 성공을 모두 보존했습니다.',
'','## PDF 품질','',
'- 한글 일반·굵게 폰트 포함, 텍스트 추출·검색, 452쪽 전체 렌더링을 검사했습니다.',
'- 텍스트 여백 이탈·본문/바닥글 충돌·빈 페이지·대체문자·잘못된 링크 목적지·누락 절차: 자동 검사 0건.',
'- 모든 책갈피의 이동 페이지에서 해당 제목을 확인했습니다. 역할별 목차·내부 링크는 각 파일의 페이지 기준으로 새로 생성했습니다.',
'- 전체 접촉 시트와 로그인·접수·정비 결과·권한표·흐름도의 확대 페이지를 육안 검수했습니다. 작은 정비 결과 화면은 입력 부분과 완료 버튼을 별도 확대했습니다. 상세 결과는 evidence/pdf-quality.json, navigation-quality.json, visual-review.json을 참고합니다.',
'','## 남은 범위와 사용상 제한','',
'- 전체 역할×기능×상태 조합을 UI로 전수 검증한 것은 아닙니다. 절차 검증표는 실제 실행 역할과 코드 확인을 구분합니다.',
'- 실제 Ollama 모델 추론 품질·외부 연동·실장비·신규 PC 설치·업데이트·macOS·OS 기본 연결 앱 열기는 미검증입니다.',
'- 사용자용 복원, 기존 계정 역할 변경, 비밀번호 찾기, 저장한 인수인계 재조회는 현재 화면에서 지원하지 않습니다.',
'- 일반 사용자에게 다른 고장 정보가 일부 요약·유사 검색·CSV에 노출됩니다. 보고서 날짜 집계 불일치, 마감 후 변경 허용 등의 알려진 결함을 정상 사용법이나 우회법으로 안내하지 않았습니다.',
'- 운영 APPDATA·DB·실제 첨부·앱 소스를 변경하지 않았습니다. 새로운 파일은 output 아래에만 생성했습니다.',
'',f"최종 소스 차이: {'없음' if not drift and head==manifest['head'] else '있음 - evidence/source-drift-final.json 확인'}. 기존 기술 보고서 이후 변경 4개 파일은 새 스냅샷에 포함했습니다.",
'','## 재생성과 패키지','',
'재생성_안내.md와 source/를 참고하세요. ZIP에는 PDF·Markdown·구조화 데이터·CSV·원본 캡처·도식·검사 로그·기준 소스·검수 접촉 시트를 넣었습니다. 운영 데이터, 테스트 DB, 앱 프로필·캐시, node_modules, 빌드 번들과 이전 렌더 결과는 제외했습니다. 파일 목록과 SHA-256은 파일_목록_SHA256.json에 있습니다.']
(ROOT/'검증_및_산출물_요약.md').write_text('\n'.join(lines),'utf8')
files=[]
for p in ROOT.rglob('*'):
 if not p.is_file():continue
 rel=p.relative_to(ROOT);parts=rel.parts
 if p.suffix=='.zip' or p.name in ['파일_목록_SHA256.json','zip-validation.json']:continue
 if any(x in parts for x in ['__pycache__','node_modules','out','baseline-profiles','final-probe-profile','ui-profiles','rendered']):continue
 if parts[0]=='source' and p.name.startswith('patch_'):continue
 if parts[0]=='rendered-final'and p.name.startswith('page-'):continue
 if p.suffix.lower()in ['.db','.db-shm','.db-wal']:continue
 files.append(p)
files=sorted(files,key=lambda p:str(p.relative_to(ROOT)))
write(ROOT/'파일_목록_SHA256.json',[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in files])
files.append(ROOT/'파일_목록_SHA256.json')
zip_path=ROOT/'역할별_사용자매뉴얼_전체자료.zip'
with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for p in files:z.write(p,p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(zip_path)as z:
 assert z.testzip()is None
 assert all(not any(x in n.split('/')for x in ['node_modules','out','ui-profiles','baseline-profiles'])for n in z.namelist())
write(EV/'zip-validation.json',{'file':zip_path.name,'files':len(files),'bytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),'crcTest':'passed'})
print(json.dumps({'pdfPages':{x['role']:x['pages']for x in quality},'zipFiles':len(files),'zipMB':round(zip_path.stat().st_size/1024**2,2),'sourceDrift':len(drift),'outlineMismatches':sum(len(x['mismatches'])for x in outline_results)},ensure_ascii=False))
