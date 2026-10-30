# OMNIS 최종 시스템 아키텍처

기준: 앱 소스 1.0.1 / DB schema 8 / `ba829af630e080d9a078ea0ad9badfb28f4d2114` / `codex/usability-five-features`.
분석 모델 확정: 2026-10-29T22:29:26.659367+09:00 (Asia/Seoul). 자료 검증 기록: 2026-10-29T22:36:35.110992+09:00.
원본 저장소: `C:\Users\admin\alex\alex_study\military_project`.

## 읽는 순서와 파일

1. `OMNIS_전체시스템아키텍처.png`: 3840×2160 총괄도. 발표에는 이 한 장부터 사용한다.
2. `OMNIS_시스템아키텍처_발표자료.pptx`: 총괄+세부 6장, 모두 실제 편집 가능한 도형·텍스트·연결선. 각 장의 발표자 노트는 약 30~60초 원고와 소스 위치를 포함한다.
3. `OMNIS_시스템아키텍처_발표자료.pdf`: 최종 PPTX를 Microsoft PowerPoint로 실제 열어 PDF 저장한 6쪽 배포본.
4. `OMNIS_전체시스템아키텍처.svg`와 `details/`의 SVG·PNG: 동일 좌표 모델에서 생성한 벡터/고해상도 배포본. 세부 5장의 파일 번호는 PPTX 2~6번과 같다.
5. `OMNIS_시스템아키텍처.drawio`: diagrams.net에서 로컬 편집 가능한 6개 페이지. XML 구조를 검사했으며 diagrams.net 앱으로 실제 열기 검증은 하지 않았다.
6. `source/architecture-model.json`: 구성요소 41개, 경로 44개, 소스 근거 131개, 실제 UI/테이블/파일 모델. 발표용 그룹은 독립 프로세스나 마이크로서비스를 뜻하지 않는다.
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
& .\source\rebuild.ps1
```

개별 생성 코드는 analyze.py → make_scenes.py → build/build.mjs → export_powerpoint.ps1 → build/render_svg.mjs → verify.py 순서다. `write_notes.py`는 분석 부록/권한표 생성기다. 최초 조사·revision 보조 스크립트와 source/build의 first-pass/candidate/final-r*는 중간 작업물이며 배포 ZIP/manifest에서 제외했다. 최종 제출에는 최상위 파일을 사용한다.

## 범례

파랑=UI, 남색=Main/개발, 청록=저장, 보라=AI, 황토=보안. 실선=현재 호출/실제 FK, 점선=조건부·선택·실패 경로. ERD에서 점선은 FK가 없는 서비스 관리 관계이며 해당 장 범례를 따른다. sequence의 옅은 세로 점선은 실행 위치를 나타내는 lifeline이다. 색만으로 검증 완료를 의미하지 않는다.

재생성 후에는 SVG/PDF 6쪽을 먼저 육안 확인하고 `finalize_docs.py --visual-reviewed`와 `package.py`를 실행한다. 새 결과에 과거의 육안 검증을 자동 승계하지 않는다. 현재 자료는 최종 6쪽을 모두 실제 이미지로 확인했다.

이 재생성기는 기록한 commit의 재출력용이다. 다른 HEAD 또는 추적 파일 변경이 있으면 구조·문구·근거를 새로 검토하도록 중단한다. 텍스트가 코드와 달라진 상태로 과거 도면을 자동 재발행하지 않는다.
