# Windows 설치본 검증 — 2026-11-04

최신 전달본은 화면 배율 문제를 수정한 1.1.11입니다. [화면·배율 검증 보고서](WINDOWS_UI_VALIDATION_20261104.md)를 참고하십시오. 아래 1.1.10 기록과 파일은 그대로 보존합니다.

## 이전 1.1.10 전달본: 로컬 Windows에서 다시 빌드·설치한 EXE

- 검증 기준 소스: `5cc22ae5237b0fba39c063b578913107dea3283d` (앱 1.1.10).
- 실행 환경: Windows x64 / OS build 10.0.26300, 설치 앱 Electron 44.4.1 / Node 24.21.0.
- 파일: `release/OMNIS-1.1.10-windows-x64-setup.exe`.
- 크기: 140,176,905 bytes.
- SHA-256: `4bf0516bc9c090415aa00278bef68916ff2bfde0a852ae05e9382dd9d2fe6851`.
- 서명: NotSigned. 이전 Mac 교차 빌드 파일과는 별도 산출물입니다.
- 위 파일 자체를 실행해 `%LOCALAPPDATA%\Programs\OMNIS`에 설치했고 종료 코드 0, Windows 프로그램 등록 1.1.10, 실제 런타임의 `app.isPackaged=true`와 x64를 확인했습니다.
- 실행 파일·app.asar·seed DB·역할별 PDF 5종은 설치 전후 해시가 일치하며, SQLite 네이티브 모듈도 Windows x64임을 확인했습니다.

설치된 `OMNIS.exe`로 다음 13개 기존 E2E를 통과했습니다.

`smoke`, `roles`, `operations-flow`, `maintenance-kinds`, `dashboard-alerts`, `admin-users`, `incident-workflow`, `incident-maintenance-notifications`, `reports-pdf`, `manuals`, `maintenance-calendar`, `operations-permissions`, `control-alerts`.

PDF 검사의 최초 시도는 Windows의 `python3` 실행 별칭 때문에 중단됐습니다. 기존 테스트의 `OMNIS_PDF_PYTHON` 옵션으로 실제 Python 경로와 UTF-8을 지정한 재시도에서 원래 검증 조건을 모두 통과했습니다. 이 문제로 앱·검사 소스를 변경하지 않았습니다.

이전 가상 seed DB v8을 별도 프로필에 복사해 설치본으로 열고 v10 전환, `integrity_check=ok`, 외래키 검사, 고장 52건·정비 42건·지시사항 8건의 주요 업무 값과 재시작 후 보존을 확인했습니다. 실제 사용자 DB도 검증 전후 SHA-256이 같아 변경되지 않았습니다.

상세 증빙: [로컬 검증 보고서](../release/windows-validation-20261104-local/WINDOWS_LOCAL_VALIDATION.md), `release/windows-validation-20261104-local/verification-summary.json`, `logs/`, 설치본 화면 캡처. EXE·검증 프로필·증빙은 Git 제외 경로에 보관합니다. 실제 유료 외부 AI 호출과 새로운 물리 PC의 보안 정책은 이번 검증 범위에 포함하지 않았습니다.

## 이전 Windows CI와 Mac 교차 빌드 기록

- 앱 버전: 1.1.10
- 앱·배포 설정 커밋: a651bc332998cae5e112082d261ee3b220c473bf
- 실제 Windows 검증: https://github.com/alex50027319/military_project/actions/runs/41814015702

## 실제 Windows 실행 결과

Windows GitHub 실행기에서 다음 단계가 모두 성공했습니다.

- 타입 검사, ESLint, 단위 테스트 20개 파일 / 155개 테스트.
- React·Electron 빌드, seed DB 생성, Windows x64 NSIS EXE 생성.
- 공백·한글을 포함하는 경로에 EXE 무인 설치, 실행 파일 및 DB·매뉴얼 리소스 확인.
- 설치된 OMNIS.exe로 로그인, 고장·체계·정비·근무·공지 CRUD, 재실행 후 저장 유지.
- 캘린더, 주간 보고서, 일일 PDF 생성, 백업과 가상 데이터 초기화.
- 조회전용·운용요원·정비요원·일반 사용자 권한의 Main 프로세스 접근 통제.
- 정비 계획·비계획·긴급·야전·창 구분, 잘못된 분류 거부, 재실행 유지.
- 통합상황판 상황경보 수량·우선순위·실시간 갱신·상세 패널·역할별 동작 및 3개 화면 크기.

실행 전체 상태가 실패로 표시되는 이유는 마지막 `Upload installer` 단계에서 GitHub Actions 저장 용량 한도를 초과했기 때문입니다. EXE 생성·설치와 기능 검증 실패가 아닙니다. 저장 용량·저장소 쓰기 권한·릴리스 자동 게시 설정은 변경하지 않았습니다.

## 이전 Mac 교차 빌드 전달 파일 이력

동일 커밋의 빌드 결과와 패키징 설정으로 macOS에서 아래 파일을 별도 생성했습니다.

- 파일: `release/OMNIS-1.1.10-windows-x64-setup.exe`
- 크기: 141,997,926 bytes
- SHA256: `22a744fb63f90797ac330343bb56c0e1fc5105688ea47e43c374a7d7e19d305b`
- 체크섬 파일: `release/SHA256-windows-x64.txt`
- 명령: `pnpm exec electron-builder --win nsis --x64 --publish never --config.npmRebuild=false`

이 로컬 교차 빌드는 better-sqlite3 13.0.3에 포함된 Windows x64 Node-API 사전 빌드 모듈을 사용합니다. Windows 네이티브 소스를 macOS에서 컴파일하지 않으며, 리소스의 해당 모듈이 원본 Windows 사전 빌드와 동일함을 확인했습니다. EXE 헤더, app.asar, seed SQLite DB 및 역할별 PDF 5종도 확인했습니다.

당시 실제 Windows에서 설치·실행한 바이너리는 CI 생성본이며, Mac에서 만든 전달 EXE 자체를 다시 Windows에서 실행한 것은 아니었습니다. 위 크기·해시는 당시 Mac 교차 빌드의 이력이며 현재 Windows 재검증 전달 파일의 크기·해시는 이 문서 맨 위 항목을 따릅니다. EXE는 Git에 포함하지 않습니다. 향후 Windows 빌드와 자동 검증은 기존 읽기 권한의 Windows installer 워크플로를 사용합니다.
