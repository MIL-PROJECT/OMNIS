# Windows 설치본 검증 — 2026-11-04

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

## 전달 설치 파일

동일 커밋의 빌드 결과와 패키징 설정으로 macOS에서 아래 파일을 별도 생성했습니다.

- 파일: `release/OMNIS-1.1.10-windows-x64-setup.exe`
- 크기: 141,997,926 bytes
- SHA256: `22a744fb63f90797ac330343bb56c0e1fc5105688ea47e43c374a7d7e19d305b`
- 체크섬 파일: `release/SHA256-windows-x64.txt`
- 명령: `pnpm exec electron-builder --win nsis --x64 --publish never --config.npmRebuild=false`

이 로컬 교차 빌드는 better-sqlite3 13.0.3에 포함된 Windows x64 Node-API 사전 빌드 모듈을 사용합니다. Windows 네이티브 소스를 macOS에서 컴파일하지 않으며, 리소스의 해당 모듈이 원본 Windows 사전 빌드와 동일함을 확인했습니다. EXE 헤더, app.asar, seed SQLite DB 및 역할별 PDF 5종도 확인했습니다.

실제 Windows에서 설치·실행한 바이너리는 CI 생성본이며, 로컬 전달 EXE 자체를 다시 Windows에서 실행한 것은 아닙니다. 두 파일은 같은 앱 소스와 설정을 사용하지만 별도 빌드 산출물입니다. EXE는 Git에 포함하지 않고 로컬 release에 보관합니다. 향후 Windows 빌드와 자동 검증은 기존 읽기 권한의 Windows installer 워크플로를 사용합니다.
