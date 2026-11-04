# Windows EXE 배포

## 설치 및 업데이트

- Windows 10/11 x64에서 `OMNIS-<버전>-windows-x64-setup.exe`를 실행합니다.
- 사용자별 NSIS 설치 프로그램으로 설치 위치를 선택할 수 있습니다. 별도의 Node.js, SQLite 서버, Python 설치는 필요하지 않습니다.
- 업데이트 전 기존 OMNIS를 종료합니다. 사용자 DB는 설치 폴더와 분리된 `%APPDATA%\OMNIS\data\omnis.db`에 유지됩니다. 삭제 프로그램도 사용자 데이터를 자동 삭제하지 않도록 설정합니다.
- 기본 오프라인 기능은 인터넷 없이 사용할 수 있습니다. Ollama는 별도 실행이 필요하고, 외부 AI는 네트워크·키·관리자 설정이 필요합니다.
- 현재 자동 빌드는 코드 서명 인증서를 사용하지 않습니다. 다운로드한 설치 파일에 Windows의 게시자 확인 경고가 나타날 수 있습니다. 기관 배포 시 코드 서명 인증서 적용이 필요합니다.

## 빌드

Windows x64에서 Node.js 24 및 pnpm 11을 준비한 뒤 실행합니다.

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm dist:win
```

`release`에 EXE 설치 파일을 생성합니다. electron-builder가 Electron ABI와 Windows 아키텍처에 맞는 better-sqlite3 네이티브 모듈을 준비합니다. macOS에서 만든 네이티브 모듈을 Windows 설치 파일에 복사하지 않습니다. seed DB, 역할별 PDF 매뉴얼과 React 정적 자원이 함께 포함됩니다.

## 자동 검증과 다운로드

`.github/workflows/windows-build.yml`은 main 푸시, PR 및 수동 실행 시 실제 Windows 실행기에서 다음 절차를 수행합니다.

1. 타입·린트·단위 테스트와 앱 빌드.
2. NSIS x64 설치 파일 생성 및 공백·한글을 포함한 경로에 무인 설치.
3. 설치된 실행 파일로 로그인, 고장·체계·정비·근무·공지 등록, 재시작 후 DB 유지, 캘린더, PDF 생성, 백업 및 가상 데이터 초기화 검사.
4. 역할별 권한, 정비 5개 분류 및 통합상황판 경보 검사.
5. EXE와 SHA256을 `omnis-windows-x64` 아티팩트에 저장.

E2E는 `OMNIS_E2E_DATA`로 격리된 가상 프로필을 사용하며 실제 사용자의 DB를 변경하지 않습니다. CI 검증은 설치본의 주요 업무 흐름에 대한 자동 검증이며 개별 기관 PC의 보안 정책, 백신, 실제 외부 연동에 대한 현장 검증을 대체하지 않습니다.

## 2026-11-04 검증 및 전달본

현재 전달본은 `release/OMNIS-1.1.11-windows-x64-setup.exe`입니다. Windows 150% 배율에서 최초 창이 작업 영역을 벗어나던 문제를 수정하고 실제 설치했습니다. SHA-256은 `e13deb40835ed8e873b16688d7d5cf5c36cce2143538f0d38f27dc01b2a87d34`이며 서명은 없습니다. 99개 화면 상태·387개 크기 조합, 100%·125%·150% 앱 배율 재현, 단위·통합 테스트 160개와 설치본 업무 회귀 검사 3종을 통과했습니다.

현재 PC에는 `%LOCALAPPDATA%\Programs\OMNIS\OMNIS.exe`로 설치했습니다. 원본 사용자 DB의 설치·검증 전후 SHA-256이 일치합니다. 최신 기록은 [화면·배율 검증 보고서](WINDOWS_UI_VALIDATION_20261104.md), 체크섬은 `release/SHA256-windows-x64.txt`를 참고하십시오. 1.1.10 설치본 E2E 13종과 DB 업그레이드 검증 기록은 [이전 로컬 보고서](../release/windows-validation-20261104-local/WINDOWS_LOCAL_VALIDATION.md)에 보존합니다. `release/`는 Git에 포함하지 않습니다.

기존 Windows CI 검증 및 Mac 교차 빌드 전달본의 이력은 [검증 기록](WINDOWS_VALIDATION_20261104.md)에 별도로 보존합니다. CI의 설치 파일 업로드 실패는 Actions 저장 용량 한도 때문이며, 이번 로컬 검증·설치 파일 생성과 구분합니다.
