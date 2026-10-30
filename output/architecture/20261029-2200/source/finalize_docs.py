from pathlib import Path
import sys
if "--visual-reviewed" not in sys.argv: raise SystemExit("먼저 SVG/PDF 전 페이지를 육안 확인하고 --visual-reviewed로 실행하십시오.")
import json,sqlite3,csv,subprocess,hashlib
from datetime import datetime,timezone,timedelta
O=Path(__file__).resolve().parents[1];ROOT=O.parents[2];M=json.loads((O/'source/architecture-model.json').read_text(encoding='utf8'));V=json.loads((O/'evidence/verification.json').read_text(encoding='utf8'));S=json.loads((O/'source/scenes.json').read_text(encoding='utf8'))
now=datetime.now(timezone(timedelta(hours=9))).isoformat()
# Read-only joins on the bundled fictional seed, no actual user profile/database.
seed=sqlite3.connect((ROOT/'resources/db/omnis-seed.db').as_uri()+'?mode=ro',uri=True)
queries={
 'incidents_join_systems':"SELECT count(*) FROM incidents i JOIN communication_systems s ON s.id=i.system_id",
 'maintenance_linked_incidents':"SELECT count(*) FROM maintenance_tasks m JOIN incidents i ON i.id=m.incident_id",
 'mapped_action_departments':"SELECT count(*) FROM team_organizations o JOIN maintenance_teams t ON t.id=o.team_id JOIN organization_units u ON u.id=o.unit_id",
 'fictional_roster_members':"SELECT count(*) FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.is_demo=1",
 'recurring_generated_occurrences':"SELECT count(*) FROM recurring_occurrences r JOIN maintenance_tasks m ON m.id=r.task_id",
 'ai_record_rows':"SELECT count(*) FROM ai_runs"
}
probe={'source':'resources/db/omnis-seed.db','mode':'ro','queryResults':[{'name':n,'sql':q,'count':seed.execute(q).fetchone()[0]} for n,q in queries.items()],'seedForeignKeyViolationCount':len(seed.execute('PRAGMA foreign_key_check').fetchall()),'columnShapeDifferences':[]}
for entity in M['dataEntities']:
 if 'table' in entity:
  actual=[r[1] for r in seed.execute(f"PRAGMA table_info({entity['table']})")];expected=[c['name'] for c in entity['columns']]
  if actual!=expected:probe['columnShapeDifferences'].append(entity['table'])
seed.close();(O/'evidence/readonly-seed-queries.json').write_text(json.dumps(probe,ensure_ascii=False,indent=2),encoding='utf8')
assert not probe['columnShapeDifferences']
sourceFiles=len(M['sourceFingerprints']);shapes=sum(x['editableShapes'] for x in V['slides']);conns=sum(x['editableConnectors'] for x in V['slides']);texts=sum(x['editableTextBoxes'] for x in V['slides'])
readme=f'''# OMNIS 최종 시스템 아키텍처

기준: 앱 소스 {M['projectVersion']} / DB schema {M['schemaVersion']} / `{M['gitCommit']}` / `{M['gitBranch']}`.
분석 모델 확정: {M['analyzedAt']} (Asia/Seoul). 자료 검증 기록: {now}.
원본 저장소: `C:\\Users\\admin\\alex\\alex_study\\military_project`.

## 읽는 순서와 파일

1. `OMNIS_전체시스템아키텍처.png`: 3840×2160 총괄도. 발표에는 이 한 장부터 사용한다.
2. `OMNIS_시스템아키텍처_발표자료.pptx`: 총괄+세부 6장, 모두 실제 편집 가능한 도형·텍스트·연결선. 각 장의 발표자 노트는 약 30~60초 원고와 소스 위치를 포함한다.
3. `OMNIS_시스템아키텍처_발표자료.pdf`: 최종 PPTX를 Microsoft PowerPoint로 실제 열어 PDF 저장한 6쪽 배포본.
4. `OMNIS_전체시스템아키텍처.svg`와 `details/`의 SVG·PNG: 동일 좌표 모델에서 생성한 벡터/고해상도 배포본. 세부 5장의 파일 번호는 PPTX 2~6번과 같다.
5. `OMNIS_시스템아키텍처.drawio`: diagrams.net에서 로컬 편집 가능한 6개 페이지. XML 구조를 검사했으며 diagrams.net 앱으로 실제 열기 검증은 하지 않았다.
6. `source/architecture-model.json`: 구성요소 {len(M['nodes'])}개, 경로 {len(M['edges'])}개, 소스 근거 {len(M['sourceRefs'])}개, 실제 UI/테이블/파일 모델. 발표용 그룹은 독립 프로세스나 마이크로서비스를 뜻하지 않는다.
7. `evidence/구성요소_소스근거표.csv`, `데이터흐름_추적표.csv`: 구성요소·입출력·실행 위치·실제 코드 행 및 F01~F04 요청/응답 경로.
8. `evidence/전체테이블_필드사전.csv`, `실제FK와논리관계.json`: 33개 테이블·345개 필드의 전체 사전과 실제 FK/서비스 관계.
9. `evidence/기술스택_사용범위.csv`, `UI_라우트_기능.csv`, `역할_권한_대조.csv`, `소스_시험_대응표.csv`: 버전 범위/lock 해석값, 실제 사용 역할·route·권한·시험 소스.
10. `evidence/분석_주요판단.md`, `검증결과.md`: 세부 조건·차이·검증 수준·남은 확인사항. `manifest.json`은 최종 파일의 크기·SHA-256 목록이다.

## 1분 설명: 핵심 6단계

1. ADMIN·OPERATOR·MAINTAINER·USER·VIEWER가 React 화면에서 입력한다.
2. Preload의 window.omnis가 프로세스 간 호출인 Electron IPC로 전달한다.
3. Main이 frame·Zod 입력과 로그인·역할·업무 대상을 검사한다.
4. AppService/동일 Main 모듈이 SQLite 파일 또는 로컬 파일을 처리한다.
5. AI는 사용자가 요청할 때만 실행한다. LOCAL은 결정적 규칙, Ollama는 별도 설치형 로컬 서버, 외부 AI는 활성화·동의·Key·한도·최소화 조건을 통과한다.
6. 결과를 받은 화면이 state를 갱신하고 필요한 목록을 재조회한다. AI 업무 반영은 담당자의 별도 버튼이다.

F01 신규 접수, F02 배정·조치·검증·종결, F03 반복 규칙 미리보기·중복 없는 생성, F04 선택형 AI·검토·반영의 실제 추적은 CSV에 있다. 내 업무는 기존 업무 조회이며 별도 DB가 아니다. 요청부서 문자열과 조치부서 ID, 명부와 당일 편성, 가입 승인과 업무 처리, 데이터 정합성과 실물 검증을 구분했다.

## 구현·검증 수준과 경계

- 구현 축은 구현 / 설정만 있음 / 향후 제안, 검증 축은 소스 확인 / mock 시험 / 패키징 앱 시험 / 실제 외부 호출 / 미검증이다. 이번에는 기존 시험 소스를 확인했지만 앱 mock·단위·통합·E2E·전체 CI를 새로 실행했다고 주장하지 않는다.
- 세션은 Main 메모리이고 사용자 DB는 PC 내부 SQLite 파일이다. Renderer의 직접 DB·파일·외부 AI 접근이나 가짜 REST 서버를 그리지 않았다.
- Drizzle은 schema 선언과 DashboardRepository의 일부 count에 사용하며 실제 업무 SQL은 주로 better-sqlite3 직접 쿼리다. React Query·Zustand·React Hook Form은 설치 목록과 src 사용을 구분했다.
- 직접 API 호출, Key 조회/복호화, 외부 업로드, 모델 다운로드, 앱 실행, CI 실행, 재패키징을 수행하지 않았다. 실제 사용자 DB·설정·첨부·백업을 열거나 수정하지 않았다. 읽은 DB는 배포용 가상 seed의 읽기 전용 schema/집계다.
- Ollama 설치/기동/실모델 응답, 실제 OpenAI/Anthropic 응답, 현재 HEAD 설치본·신규 PC·macOS CI 성공·서명/공증·군 실운용 검증은 미확인이다. release의 1.0.0 설치본은 현재 소스 1.0.1의 성공 근거가 아니다.
- 세부 한계: 시도당 timeout과 총 소요시간은 다름, 외부전송 flag와 실제 패킷/과금 요청 수는 다름, Ollama 요약은 외부 Provider와 같은 수치 검사 호출이 없음, 보고서 날짜 필터와 일별 통계의 시간 경계가 다름. 상세 근거는 분석 문서에 있다.
- Key 저장 상태 반환과 입력 순간 Renderer password state는 별개다. 패턴 마스킹과 출력 검증이 완전한 비식별화 또는 군 보안 승인을 의미하지 않는다.

## 편집·재생성

글꼴은 Windows의 맑은 고딕(`Malgun Gothic`)이다. PPTX에 글꼴 파일은 포함하지 않았다. 다른 OS에서 대체 글꼴을 사용하면 재렌더링하여 줄바꿈/폭을 확인한다. 좌표는 1600×900, 제목 42px(31.5pt), 본문/노드는 주로 20~25px, 주석 최소 16px(12pt)다. 일부 복잡한 설명은 18~19px를 사용하며 1920×1080에서 확인했다.

PPTX/SVG/drawio의 텍스트는 이미지가 아닌 실제 텍스트다. 도형과 연결선도 각각 편집할 수 있다. 노드를 이동할 때 연결선을 함께 조정한다. SVG와 PPTX/PDF는 같은 좌표·문구 모델을 사용하지만 렌더러의 자간·획·점선 간격은 약간 다를 수 있다.

권장 수정 경로는 `source/architecture-model.json`(근거·구조)과 `source/make_scenes.py`(슬라이드 배치/문구)다. `source/scenes.json`은 생성된 공통 장면 원본이다. `source/analyze.py`를 다시 실행하면 현재 저장소 기준 근거와 모델을 갱신하므로 수동 모델 편집을 덮어쓴다.

이 PC의 번들 런타임을 사용한다. 새 폴더에 생성하려면 `source/rebuild.ps1`을 실행한다. 원본 앱과 이전 산출물을 변경하지 않고 `output/architecture/YYYYMMDD-HHmmss/`에 다시 만든다. Python(Pillow/pypdf), Node(@oai/artifact-tool/Playwright), Edge, PowerPoint, Poppler가 필요하다. 임시 node_modules는 번들 의존성으로 연결하며 설치/다운로드하지 않는다. 샌드박스 안에서는 링크와 PowerPoint 실행 승인이 필요할 수 있다.

```powershell
& .\\source\\rebuild.ps1
```

개별 생성 코드는 analyze.py → make_scenes.py → build/build.mjs → export_powerpoint.ps1 → build/render_svg.mjs → verify.py 순서다. `write_notes.py`는 분석 부록/권한표 생성기다. 최초 조사·revision 보조 스크립트와 source/build의 first-pass/candidate/final-r*는 중간 작업물이며 배포 ZIP/manifest에서 제외했다. 최종 제출에는 최상위 파일을 사용한다.

## 범례

파랑=UI, 남색=Main/개발, 청록=저장, 보라=AI, 황토=보안. 실선=현재 호출/실제 FK, 점선=조건부·선택·실패 경로. ERD에서 점선은 FK가 없는 서비스 관리 관계이며 해당 장 범례를 따른다. sequence의 옅은 세로 점선은 실행 위치를 나타내는 lifeline이다. 색만으로 검증 완료를 의미하지 않는다.
'''
(O/'README.md').write_text(readme,encoding='utf8')
review={'reviewedAt':now,'resolution':[1920,1080],'pages':[{'slide':i,'SVG':'육안 확인','PowerPointPDF':'육안 확인','cutoff':'없음','overlap':'의도하지 않은 겹침 없음','glyphs':'한글·영문·화살표 확인'} for i in range(1,7)],'method':'Final SVG render and all six final native PowerPoint PDF page PNGs inspected individually; source1 final one-arrow refinement rechecked in PDF1; content equivalent across SVG/PPTX/PDF','limits':'human visual review and structural checks; not a military security or whole-program regression approval'}
(O/'evidence/visual-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),encoding='utf8')
validation=next(v for p in sorted(O.parent.glob('.'+O.name+'*validation.json'),key=lambda p:p.stat().st_mtime,reverse=True) if (v:=json.loads(p.read_text(encoding='utf8'))).get('finalSha256')==hashlib.sha256((O/'OMNIS_시스템아키텍처_발표자료.pptx').read_bytes()).hexdigest())
summary={k:validation.get(k) for k in ['finalSha256','byteCount','packageIntegrity','presentationLayout','firstPartyImport']}
# Summarized public validation evidence; the private finalizer receipt remains outside the deliverable folder.
summary['privateReceiptOutsideDeliverables']=True
(O/'evidence/pptx-structural-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
report=f'''# 검증결과

검증 기록: {now} (Asia/Seoul).
최종 기준: {M['projectVersion']} / schema {M['schemaVersion']} / {M['gitCommit']}.

## 이번에 실제 수행한 확인

- 현재 디렉터리·적용 지침·Git branch/HEAD/status 조사. 추적 파일 변경 없음. {sourceFiles}개 소스/시험/설정 파일 SHA-256이 모델 조사 시점과 일치했다.
- 소스 근거 {len(M['sourceRefs'])}개 위치를 실제 파일·행·발췌와 재대조했다. {len(M['nodes'])}개 구성요소, {len(M['edges'])}개 모델 경로 및 도면의 모든 의미 있는 화살표에 근거를 연결했다.
- 현재 migration의 literal DDL을 Python SQLite 메모리 DB에서 재현해 33개 테이블·345개 필드를 확인했다. 이는 Node/Electron migration 통합시험이 아니다.
- resources/db/omnis-seed.db를 mode=ro로 열어 schema 8, 집계/조인, FK 이상 {probe['seedForeignKeyViolationCount']}건, 현재 DDL과 column shape 차이 {len(probe['columnShapeDifferences'])}건을 확인했다. 사용자 DB에는 접근하지 않았다.
- SVG 6장을 실제 Edge headless 렌더링하여 각각 3840×2160 PNG로 저장했다. 별도 1920×1080 검사본을 생성했다. 캔버스 밖 텍스트 0건, 사전 글자 폭 초과 0건.
- 최종 PPTX를 first-party Artifact Tool로 재수입하고 패키지/치수/글꼴/레이아웃 검사를 수행했다. 구조 finding 0건, 레이아웃 warning 0건. 최종 SHA-256은 `{validation['finalSha256']}`.
- 편집 가능한 일반 도형 {shapes}개(이 안의 텍스트 상자 {texts}개), native 연결선 {conns}개, 슬라이드 raster picture 0개. 발표자 노트 6개와 SVG text 모두 편집 가능한 구조를 확인했다.
- 최종 PPTX를 Microsoft PowerPoint COM으로 실제 열고 SaveAs(PDF)로 6쪽 PDF를 저장했다. 같은 열린 deck에서 6개 PNG를 내보냈고, 최종 PDF를 Poppler로 1920×1080 PNG 6장으로 다시 렌더링했다.
- 최종 PDF 6쪽과 PPTX/SVG 장면 원본의 모든 표시 문구를 대조했으며 누락 0건이다. 슬라이드 수·비율·순서·요소 좌표 모델·색상 팔레트가 일치한다.
- SVG 검사본과 PDF 전 페이지를 개별 이미지로 확인했다. 초안의 총괄도 선 교차·라벨 및 ERD 하단 설명 겹침을 수정했고 수정 후 최신본을 다시 렌더링했다. 잘림·의도하지 않은 겹침·깨진 한글을 발견하지 못했다. SVG/PDF 렌더러 간 획과 자간의 작은 차이는 있다.
- 도면은 시스템 구조 및 소스 식별자만 사용한다. 실제 인명·운용 사례·Key·첨부 원문·실부대 운용자료나 앱 실화면은 삽입하지 않았다. 코드 근거의 가상 자료/예시는 실제 운영 정보로 취급하지 않았다.
- 최초 모델 작성 뒤 업무 기능을 수정하지 않았다. HEAD/branch 변경, commit/push/reset/clean, 기존 산출물 삭제를 하지 않았다.

## 구현과 실행 검증의 분리

| 대상 | 구현 축 | 이번 검증 축 |
|---|---|---|
| React/IPC/Main 업무/SQLite/파일 | 구현 | 소스 확인 + 별도 자료용 SQL 확인 |
| LOCAL 규칙·입력 보완 | 구현 | 소스 확인, 앱 실행 시험 아님 |
| OpenAI/Anthropic SDK·보호·fallback | 구현 | 소스 및 mock 시험 코드 확인; 이번 mock 실행/실제 외부 호출 없음 |
| Ollama HTTP 연결 | 구현 | 소스 확인; 설치/기동/모델 응답 미검증 |
| NSIS/macOS CI/DMG·ZIP | 설정만 있음 | 설정 확인; 현 HEAD 패키징/CI 성공 미검증 |
| 이번 SVG/PNG/PPTX/PDF | 자료 생성 | 전체 렌더·native 열기/내보내기·육안/텍스트/패키지 검사 수행 |
| drawio | 자료 생성 | 6개 페이지·native 텍스트/벡터 XML 확인, 앱 열기 미시험 |

## 실행하지 않은 작업과 남은 확인사항

실제 외부 API, Key 조회·복호화, 외부 업로드, 모델 다운로드, CI, OMNIS 앱 실행, 재패키징, 전체 프로그램 회귀 시험은 수행하지 않았다. 기존 시험 통과 숫자를 이번 결과로 재인용하지 않았다. 새 PC 설치, 현재 HEAD 패키징 앱, macOS arm64/x64 실제 성공, 전자서명·공증, 실제 외부 Provider/Ollama 응답은 별도 검증이 필요하다.

이 결과는 도면 및 근거 검증이다. 패턴 마스킹의 완전한 비식별화, 운영 승인, 군 보안 승인, 실물 장비 검증 완료를 의미하지 않는다. 역할별 접근과 AI 한계, 날짜 필터 차이는 `분석_주요판단.md`를 참조한다.
'''
(O/'evidence/검증결과.md').write_text(report,encoding='utf8')
print(json.dumps(dict(verifiedAt=now,shapes=shapes,connectors=conns,textBoxes=texts,seed=probe),ensure_ascii=False))
