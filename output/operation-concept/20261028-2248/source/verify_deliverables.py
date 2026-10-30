"""Read-only content/format checks and evidence manifests for the generated deliverables."""
from pathlib import Path
import json, re, csv, hashlib, struct, zlib, sys
from zipfile import ZipFile
from pypdf import PdfReader
from docx import Document
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parent.parent
REPO=ROOT.parents[2]
CONTENT=json.loads((ROOT/'source/content.json').read_text(encoding='utf-8'))
E=ROOT/'evidence'
def normalized(s):return re.sub(r'\s+','',s).replace('\x07','')
def writecsv(name,headers,rows):
    with (E/name).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f);w.writerow(headers);w.writerows(rows)

form=[
 ('제목·인적사항','운용개념 기술서 / 소속·계급·성명·군번, 참가자 3개 행','첫 쪽','공란 보존'),
 ('1. 현행 업무 분석','가. 업무 처리 절차 / 1)·2)','본문 1','원문 사례와 관찰 경계 명시'),
 ('2. 체계 개념','가. 체계 소개 / 1) 개발스택 / 가)·나)·다) / 2)','본문 2가','실제 스택·아키텍처·데이터 경계'),
 ('2. 체계 개념','나. 체계 주요기능 / ①~⑦','본문 2나','목적·역할·입력·처리·출력·예외'),
 ('2. 체계 개념','다. 운용개념 및 운용 시나리오 / 1)~4)','본문 2다','일반·긴급·정비 대조·AI 검토'),
 ('3. 추가기능 구현','①~⑤ 및 보완 기능','본문 3','5종 동작·사용 단계·통제·확장'),
 ('4. AI 활용도','가. 활용 AI체계 / 나. AI 활용 SW 구현정도','본문 4','개발 지원과 운용 지원 구분·기여율 보류'),
 ('AI 활용 표','주요/추가기능 | 바이브 코딩 사용 | 입력 프롬프트 | 활용 소스코드','본문 4나','실제 4열 표·발췌 이미지 셀 병합'),
 ('5. 타 체계 연동방안(제안)','현재와 향후 제안 구분','본문 5','실제 군 체계 연동 미구현'),
 ('부록','요구사항·평가·시연·Q&A·출처/확인','5번 이후','원래 상위 목차 유지')]
writecsv('양식_대응표.csv',['원문 항목','작성 형태','본문 위치','검토'],form)

requirements=[
 ('R01','3','운용현황 CRUD·시현','구현/자유 분류 확대 범위 확인','운영현황·상황판','AppService / DashboardRepository','communication_systems','operations E2E(과거)·현재 가상 화면'),
 ('R02','3','상황정보 입력·변경','구현/수동 입력','상황경보','OperationalControlService','situation_alerts','operational-control 단위 시험 / 센서 연동 없음'),
 ('R03','3','병력·근무·지시','부분','근무/지시사항','조직·근무·지시 서비스','duty_roster / directives','가상 명부·근무 지원. 정원/현원/휴가 집계 없음'),
 ('R04','3','정비 요청과 관리자 승인','부분','고장·정비 등록','AppService / UsabilityService','incidents / maintenance_tasks','별도 정비 승인 단계 보완. 가입 승인과 구분'),
 ('R05','3','중요도·기한·담당·지시','구현','고장·정비 상세','IncidentAssignmentService / Workflow','maintenance_teams / incidents','현재 단위·통합 시험 / 역할별 범위'),
 ('R06','3','예정·완료·계획 수정','구현','정비 목록·캘린더','Workflow / UsabilityService','maintenance_tasks / maintenance_events','실물 검증과 별개'),
 ('R07','3','일·주·월 모니터링','부분','캘린더·보고서','AppService','실적 집계','일일/주간 보고. 월간 보고 범위 별도'),
 ('R08','3','접수·상태 알림','구현/앱 내부','배지·알림','알림 처리','알림/업무 상태','SMS·외부 메시징 아님'),
 ('R09','9~11','08:30·16:00 통제·인계','구현','통제·일일마감','OperationalControlService','maintenance_daily_plans / handover_notes','가상 화면·현재 operational-control 시험'),
 ('R10','9~11','긴급 선조치 사후 기록','구현','고장 상세','Workflow / AppService','incidents / incident_events','사유·실제 시작시각 / 실제 장비 제어 없음'),
 ('R11','6','AI 지원 개발과 검토·반영','증빙 일부/전체 기여율 보류','개발 프롬프트·소스·회귀 시험','commit '+CONTENT['basis']['commit'][:7],'해당 없음','입력 요청→오류 확인→수정→시험 / 전체 대화 확인 필요'),
 ('R12','3·5','가상 자료·외부 업로드 제한·보안 확인','최종 확인 필요','LOCAL 기본·가상 캡처','AI 마스킹·SecretStore','암호화 별도 파일','보호수단 구현이 보안 승인과 동일하지 않음')]
writecsv('요구사항_구현근거표.csv',['ID','원문 쪽','요구','판정','화면','서비스/소스','자료 구조','시험 및 한계'],requirements)

rubric=[(15,'실제 업무 절차 기반','1·2다','그림1 / E01·E02','현장 조사 별도'),(15,'군 내 적용/운용 구성','2가·5','그림2 / E02·E05','보안·배포 승인 별도'),(10,'주요기능 정상 구현','2나·부록1','E02·E03·E04','부분 충족 공개'),(10,'사용자 친화성·안정성','3·부록5','E03·E04','가상 시험 범위'),(10,'구체 프롬프트','4나','그림8 / E07','전체 원문 보존'),(10,'결과 확인·보완','4','수정 사례 / E06','전체 대화 추가 확인'),(10,'검토·수정·반영','4','그림9·10 / E06','기여율 보류'),(10,'요구 외 추가 구현','3','실용 5종 / E02·E03','기본 기능 중복 산정 제외'),(5,'확대·지속 활용','3·5','구조·제안','실배포 미검증'),(2.5,'이해 가능한 시연','부록3','15분 동선','리허설 미측정'),(2,'기술서 완성도','1~5','양식·그림·증빙','작성자 최종 확인'),(.5,'질의 답변','부록4','Q&A','실제 심사 미실시')]
assert sum(x[0] for x in rubric)==100
writecsv('평가항목_증빙표.csv',['원문 배점','항목','본문 위치','증빙','남은 확인'],rubric)

notes='''# 작성자 및 보안담당 확인사항

- 인적사항 3개 행은 사용자 미제공으로 비워 두었습니다. 임의로 채우지 않았습니다.
- AI 지원 개발의 원본 대화, 도구별 기여 범위, 사람의 검토 범위와 비율은 추가 확인이 필요합니다.
- 별도 정비 승인, 병력 집계, 월간 보고는 부분 충족 항목입니다. 이번 작업에서 기능을 추가하지 않았습니다.
- 캡처는 별도 가상 프로필입니다. 실제 사용자 DB·API Key·인증정보·운영 설정을 읽거나 변경하지 않았습니다.
- 기존 배포본의 공개 실부대명 카탈로그 포함 여부는 가상 캡처와 별개로 제출 보안 점검이 필요합니다.
- 앱 동의는 군 자료 외부 전송 승인이 아닙니다. 기본 시연은 LOCAL과 임의 가상 데이터입니다.
- 실제 외부 API·Ollama 모델 응답·신규 PC·macOS 실기기·서명/공증은 별도 확인입니다.
- 주관부서 제출 양식·분량·외부 업로드 금지·최종 확인·행사 후 처리 조건을 원문과 최신 지침으로 확인하십시오.
- 외부 업로드·제출·Git commit/push·실제 API 호출·Ollama 설치·사용자 파일 삭제를 수행하지 않았습니다.
'''
(E/'작성자_확인사항.md').write_text(notes,encoding='utf-8')

# Minimal read-only OLE/CFB parser. Verifies actual named streams, not just file extension.
def hwp_structure(path):
    data=path.read_bytes();assert data[:8]==bytes.fromhex('d0cf11e0a1b11ae1')
    u32=lambda b,o:struct.unpack_from('<I',b,o)[0]
    ss=1<<struct.unpack_from('<H',data,30)[0];ms=1<<struct.unpack_from('<H',data,32)[0]
    sector=lambda i:data[(i+1)*ss:(i+2)*ss]
    difat=list(struct.unpack_from('<109I',data,76));nfat=u32(data,44)
    ds=u32(data,68)
    for _ in range(u32(data,72)):
        bb=sector(ds);a=struct.unpack('<'+'I'*(ss//4),bb);difat.extend(a[:-1]);ds=a[-1]
    fat=[]
    for sid in [i for i in difat if i<0xfffffffa][:nfat]:fat.extend(struct.unpack('<'+'I'*(ss//4),sector(sid)))
    def chain(start,allocation):
        ids=[];seen=set();v=start
        while v<0xfffffffa:
            assert v<len(allocation) and v not in seen
            seen.add(v);ids.append(v);v=allocation[v]
        return ids
    big=lambda start:b''.join(sector(i) for i in chain(start,fat))
    raw=big(u32(data,48));entries=[]
    for o in range(0,len(raw),128):
        b=raw[o:o+128]
        if len(b)<128:continue
        ln=struct.unpack_from('<H',b,64)[0]
        if ln<2:continue
        entries.append({'name':b[:ln-2].decode('utf-16le'),'type':b[66],'start':u32(b,116),'size':struct.unpack_from('<Q',b,120)[0]})
    root=next(e for e in entries if e['type']==5);mini=big(root['start'])[:root['size']]
    mfraw=big(u32(data,60)) if u32(data,64) else b''
    mf=list(struct.unpack('<'+'I'*(len(mfraw)//4),mfraw)) if mfraw else []
    def stream(e):
        if e['size']<u32(data,56):return b''.join(mini[i*ms:(i+1)*ms] for i in chain(e['start'],mf))[:e['size']]
        return big(e['start'])[:e['size']]
    names={e['name']:e for e in entries}
    assert all(n in names for n in ['FileHeader','DocInfo','BodyText','Section0'])
    fh=stream(names['FileHeader']);assert fh.startswith(b'HWP Document File')
    compressed=bool(u32(fh,36)&1)
    di=stream(names['DocInfo']);body=stream(names['Section0'])
    if compressed:di=zlib.decompress(di,-15);body=zlib.decompress(body,-15)
    assert di and body
    return {'signature':fh[:32].rstrip(b'\0').decode('ascii'),'versionHex':hex(u32(fh,32)),'namedStreamsVerified':True,'compressed':compressed,'docInfoBytes':len(di),'bodySection0Bytes':len(body)}

docx=ROOT/'OMNIS_운용개념기술서_제출본.docx';d=Document(docx)
with ZipFile(docx) as z:assert 'word/document.xml' in z.namelist()
assert len(d.tables[0].rows)==4 and len(d.tables[0].columns)==4
assert all(not c.text.strip() for row in d.tables[0].rows[1:] for c in row.cells)
word=(E/'word-reopen-text.txt').read_text(encoding='utf-8-sig')
paragraphs=[]
for nodes in CONTENT['pages']:
    for node in nodes:
        if node['type'] in ['title','heading','paragraph']:paragraphs.append(node['text'])
        elif node['type']=='figure':paragraphs.append(node['caption'])
        elif node['type']=='table':
            paragraphs.extend(node['headers'])
            paragraphs.extend(str(c) for row in node['rows'] for c in row if str(c).strip())
missing_word=[p[:70] for p in paragraphs if normalized(p) not in normalized(word)]
assert not missing_word,missing_word
report={'docxOOXML':True,'editableParagraphs':len(d.paragraphs),'editableTables':len(d.tables),'inlineImages':len(d.inline_shapes),'blankAuthorRows':3,'wordMissingParagraphs':missing_word,'word':json.loads((E/'word-validation.json').read_text(encoding='utf-8-sig')),'layoutHelper':'render_docx.py attempted: LibreOffice absent; native Hancom + Poppler fallback selected','actualLiveApiCalled':False,'originalPdfSha256':hashlib.sha256((REPO/'AI활용체계개발.pdf').read_bytes()).hexdigest()}
hwp=docx.with_suffix('.hwp');pdf=docx.with_suffix('.pdf')
if hwp.exists():
    report['hwpFormat']=hwp_structure(hwp)
    text=(E/'hwp-reopen-text.txt').read_text(encoding='utf-8-sig');report['hwpMissingParagraphs']=[p[:70] for p in paragraphs if normalized(p) not in normalized(text)]
    assert not report['hwpMissingParagraphs'],report['hwpMissingParagraphs']
    report['hwpConversion']=json.loads((E/'hwp-conversion.json').read_text(encoding='utf-8-sig'))
if pdf.exists():
    r=PdfReader(pdf);text='\n'.join(p.extract_text() for p in r.pages)
    (E/'pdf-extracted-text.txt').write_text(text,encoding='utf-8')
    report['pdfPages']=len(r.pages)
    report['pdfMissingParagraphs']=[p[:70] for p in paragraphs if normalized(p) not in normalized(text)]
    report['pdfReplacementCharacters']=text.count('\ufffd')
    assert not report['pdfMissingParagraphs'],report['pdfMissingParagraphs']
    assert not report['pdfReplacementCharacters']
    report['pdfPageCharacters']=[len(p.extract_text()) for p in r.pages]
    assert all(n>30 for n in report['pdfPageCharacters'])
manifest=[]
for file in [docx,hwp,pdf]:
    if file.exists():manifest.append({'file':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
(E/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(E/'format-content-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
writecsv('최종파일_manifest.csv',['파일','bytes','SHA-256'],[(m['file'],m['bytes'],m['sha256']) for m in manifest])
print(json.dumps(report,ensure_ascii=False))
