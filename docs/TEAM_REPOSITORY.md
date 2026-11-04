# OMNIS 팀 저장소와 전달 방법

## 저장소

- 팀 공동 개발: https://github.com/MIL-PROJECT/OMNIS (비공개).
- 기존 개인 저장소: https://github.com/alex50027319/military_project (비공개).
- 현재 PC의 로컬 경로: `C:\Users\admin\alex\alex_study\military_project`.
- 로컬 remote `origin`은 기존 개인 저장소를 가리키고, `mil-project`는 조직의 OMNIS를 가리킵니다.

두 저장소의 `main`에는 같은 전달 커밋과 Git 이력을 반영합니다. 저장소 간 자동 동기화는 설정하지 않았습니다. 팀에서 공동 개발할 때는 조직 저장소를 기준으로 작업하고, 개인 저장소에 사본을 유지하려면 명시적으로 양쪽에 push합니다. 기존 저장소를 삭제하거나 소유권을 이전하지 않습니다.

## 개발 환경에서 받기

```powershell
git clone https://github.com/MIL-PROJECT/OMNIS.git
cd OMNIS
pnpm install --frozen-lockfile
pnpm dev
```

저장소 접근 권한이 있는 각자의 GitHub 계정으로 인증합니다. Node.js 22.18 이상 또는 24, pnpm 11을 권장하며 현재 허용 범위는 `package.json`의 `engines`를 따릅니다. SQLite seed DB는 빌드 단계에서 생성하며, 사용자별 실행 데이터와는 분리됩니다.

소스와 문서·매뉴얼·보존된 발표자료는 Git으로 전달합니다. `node_modules`, `out`, `release`, `reports`, 임시 E2E 프로필, 실제 업무 DB, API Key와 `.env`는 Git에 포함하지 않습니다. API Key·Ollama·개인 데이터는 각 PC에서 별도로 설정합니다.

## 설치 파일과 검증 자료

Windows 1.1.11 설치 파일은 GitHub의 `v1.1.11` Releases에서 전달합니다. 대용량 EXE를 Git 이력에 직접 넣지 않습니다.

- `OMNIS-1.1.11-windows-x64-setup.exe`: 실제 Windows에서 설치하고 검증한 설치 파일.
- `SHA256-windows-x64.txt`: EXE 체크섬.
- `OMNIS-1.1.11-windows-verification.zip`: 설치·배율·화면 캡처·테스트·빌드 기록과 로컬 화면 갤러리.

검증 ZIP을 풀면 `reports/windows-layout-review-20261104/index.html`에서 대표 화면과 크기별 캡처를 볼 수 있습니다. 검증 ZIP에는 테스트 프로필 DB·실제 사용자 데이터·비밀정보를 넣지 않습니다. 경로·로그·스크린샷은 가상 검증 환경의 기록입니다.

EXE는 코드 서명이 없는 빌드입니다. Windows 게시자 확인 경고가 표시될 수 있습니다. 실제 Windows 검증 범위와 한계는 [화면·배율 검증](WINDOWS_UI_VALIDATION_20261104.md), [배포 방법](WINDOWS_DISTRIBUTION.md)을 참고합니다.

## 간단한 팀 작업 규칙

`main`의 최신 코드를 받은 뒤 작업별 브랜치를 만들고, 변경사항과 검증 결과를 Pull Request로 검토합니다. 각자 만든 서로 다른 프로젝트는 별도 저장소에 보관합니다. OMNIS를 함께 수정하는 작업만 이 저장소의 기능별 브랜치로 진행합니다.
