# OMNIS macOS 빌드·배포

## 지원 범위

- macOS 13 Ventura 이상
- Apple Silicon: `arm64` (M1/M2/M3/M4 계열)
- Intel Mac: `x64`
- 배포 형식: DMG, ZIP
- 사용자 데이터: `~/Library/Application Support/OMNIS`

Electron 44부터 macOS 12 지원이 제거됐으므로 `LSMinimumSystemVersion`을 13.0으로 고정한다. `better-sqlite3`는 네이티브 모듈이므로 각 CPU 아키텍처의 macOS runner에서 다시 빌드한다.

## Mac에서 개발 실행

```bash
corepack enable
corepack prepare pnpm@11 --activate
pnpm install --frozen-lockfile
pnpm db:build-seed
pnpm dev
```

최초 실행 데이터는 `~/Library/Application Support/OMNIS/data/omnis.db`에 만들어진다. 테스트는 실제 사용자 데이터와 분리된 `tests/.tmp`를 사용한다.

## 로컬 배포본 생성

현재 Mac CPU에 맞는 빌드:

```bash
pnpm dist:mac
```

아키텍처를 명시하는 경우:

```bash
pnpm dist:mac:arm64
pnpm dist:mac:x64
```

결과는 `release/OMNIS-1.0.0-mac-arm64.dmg` 또는 `release/OMNIS-1.0.0-mac-x64.dmg` 형식으로 생성된다. 네이티브 모듈 안정성을 위해 arm64 빌드는 Apple Silicon, x64 빌드는 Intel Mac에서 수행하는 것이 원칙이다.

## GitHub Actions

`.github/workflows/macos-build.yml`은 다음 환경에서 각각 독립적으로 실행된다.

- `macos-15`: Apple Silicon arm64
- `macos-15-intel`: Intel x64

각 runner는 정적 검사, Vitest, 전체 Electron E2E, DMG·ZIP 패키징, 패키징 앱 smoke test, 실행 파일 아키텍처 확인과 SHA-256 생성을 수행한다. 산출물은 `omnis-macos-arm64`, `omnis-macos-x64` 이름으로 14일간 보관된다.

## Developer ID 서명과 Apple 공증

GitHub 저장소에 다음 Actions Secrets를 등록하면 electron-builder가 Developer ID 서명과 Apple notarization을 자동 수행한다.

| Secret | 내용 |
|---|---|
| `MACOS_CSC_LINK` | Developer ID Application 인증서 `.p12` 파일 또는 base64 |
| `MACOS_CSC_KEY_PASSWORD` | `.p12` 비밀번호 |
| `APPLE_API_KEY` | App Store Connect API `.p8` 키 경로 또는 base64 내용 |
| `APPLE_API_KEY_ID` | API Key ID |
| `APPLE_API_ISSUER` | Issuer ID |

서명 인증서가 있으면 CI는 `codesign --verify`를 실행한다. 공증 자격 증명까지 있으면 stapled ticket과 `spctl --assess`도 검증한다. Apple Developer Program 인증 정보가 없으면 DMG·ZIP은 생성되지만 unsigned 상태이며 Gatekeeper 경고 없이 일반 배포할 수 없다.

## 설치

1. Mac CPU에 맞는 DMG를 연다.
2. `OMNIS.app`을 `Applications`로 끌어 놓는다.
3. 서명·공증된 빌드는 응용 프로그램에서 바로 실행한다.

본인이 직접 생성한 unsigned 개발 빌드만 시험할 때 Gatekeeper 격리 속성을 제거할 수 있다.

```bash
xattr -dr com.apple.quarantine /Applications/OMNIS.app
```

출처를 확인할 수 없는 앱에는 이 명령을 사용하지 않는다. 평가·배포용 산출물은 Developer ID 서명과 공증을 완료해야 한다.

## 검증 명령

```bash
codesign --verify --deep --strict --verbose=2 /Applications/OMNIS.app
spctl --assess --type execute --verbose=2 /Applications/OMNIS.app
file /Applications/OMNIS.app/Contents/MacOS/OMNIS
```

정상 실행 후 시스템관리 화면에서 DB 경로, 백업 경로, 첨부파일 열기, PDF·CSV 내보내기와 Demo 초기화를 확인한다.
