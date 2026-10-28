# 실용 기능 5종 구현·검증 기록

검증일: 2026-10-28 (Windows x64). 브랜치: `codex/usability-five-features`. 구현 커밋: `ad198f9`. 기준 커밋: `d4df7861047eb56b978968f3a4a8d995a37b156e`. 이 문서는 해당 브랜치의 실제 실행 결과를 기록하며 외부 AI 브랜치의 이전 결과와 구분한다.

## 구현 범위

| 기능 | 연결·보존 정책 |
|---|---|
| 고장 접수 템플릿 | 6종 기본 템플릿, 미리보기·선택 적용·되돌리기·연결 해제, 관리자 편집, 저장 당시 질문/버전 사본. 예시 증상을 실제 사실로 자동 저장하지 않음 |
| 내 업무 | Main의 로그인 사용자 기준 고장/오늘 정비/지연 정비/미확인 지시, 개인 상세 링크와 복귀, 지시 확인 후 갱신 |
| 정비 체크리스트 | 작업별 사본·항목 결과·비고·작성자·시각·revision 저장. 필수 미확인/이상은 Main에서 완료 차단. 완료/취소 작업 수정 차단. 기존 미부착 작업 유지 |
| 반복 정비 | 주간/월간·간격·월말·윤년, 사전 미리보기와 선택 생성, 명시적 담당자, 회차 unique, stale/중지/마감 검사, batch transaction. 자동 주기 생성 없음 |
| AI 입력 보완 | 로컬 누락 질문·미확인·건너뛰기, 구조화 답변 중복 합성 방지, 기존 분석·검토 반영 연결. 입력 점검만으로 외부 호출하지 않음 |

DB v6는 기존 표를 유지하고 5개 신규 표와 인덱스를 추가한다. API Key·실사용 DB·실제 유료 API를 테스트에 사용하지 않았다. RAG는 추가하지 않았다.

## 정적·자동 검증

| 실제 실행 명령 | 결과 |
|---|---|
| `pnpm install --frozen-lockfile` | 통과, lockfile 변경 없음. 공급망 검증을 포함한 재시도 완료 |
| `pnpm typecheck` | 통과 |
| `pnpm lint` | 통과 |
| `pnpm test` | 7개 파일, 52개 테스트 통과 |
| `pnpm build` | Main/Preload/Renderer production 빌드 통과 |
| `pnpm test:e2e` | CRUD·재시작 영속성·캘린더·보고서·백업·가상자료 초기화 통과 |
| `pnpm test:e2e:roles` | 역할별 권한 회귀 통과 |
| `pnpm test:e2e:signup` | 등록 신청·승인·반려 회귀 통과 |
| `pnpm test:e2e:operations` | 고장 처리·긴급 선조치·연계 정비·마감·인수인계·AI fallback 통과 |
| `pnpm test:e2e:visual` | 1366×768, 1920×1080 화면 검사 통과 |
| `pnpm test:e2e:external-ai` | OpenAI/Claude mock·권한·Key masking·timeout fallback·검토 반영·설정 화면 검사 통과 |
| `pnpm test:e2e:usability` | 템플릿/보완·개인 업무 링크/지시 확인·반복 중복 방지·체크리스트 완료 조건·재시작 영속성·LOCAL 분석·반응형 검사 통과 |
| `pnpm dist:win --config.directories.output=release/usability-five-features` | Windows NSIS x64 생성 완료. 기존 `release/`의 다른 산출물은 보존 |
| `git diff --check`, `git diff --cached --check` | 통과 |

환경: Node.js 22.18.0, pnpm 12.6.0 (저장소 engines 허용 범위). 네트워크 제한으로 처음 의존성 공급망 검증/패키징이 끝나지 않은 실행은 통과로 집계하지 않았으며, 허용된 재실행의 완료 결과를 사용했다.

단위/통합 검증은 월말 원래 기준일 복원·윤년·KST 날짜 경계·주간 간격, 질문 중복 합성, 기존 DB/migration 재실행·seed 보존·백업 복원, 개인 scope와 권한, 체크리스트 revision/필수/NA/이상, 반복 회차 취소/이동 후 중복 방지·담당자·마감·일시중지/삭제·중간 실패 rollback을 포함한다.

신규 화면 캡처는 `tests/.tmp/usability-{intake,recurring,checklist}-{1366,1920}.png`, `tests/.tmp/usability-my-work-{1366,1920}.png`에 저장한다. 실제 이미지 확인 중 정비 상세의 내부 가로 넘침을 발견하여 대화상자 폭을 수정했고, 최종 E2E에는 body뿐 아니라 열린 DialogContent의 가로 넘침 검사도 추가했다. 최종 실행본에서 이 검사를 다시 통과했다.

## 최종 패키징 앱 검증

대상: `release/usability-five-features/win-unpacked/OMNIS.exe`. 최종 재패키징 후 아래 4개를 다시 실행하여 모두 통과했다.

```powershell
$env:OMNIS_E2E_EXE='release/usability-five-features/win-unpacked/OMNIS.exe'
$env:OMNIS_E2E_PROFILE='tests/.tmp/five-final-packaged-smoke'
pnpm test:e2e
$env:OMNIS_E2E_PROFILE='tests/.tmp/five-final-packaged-usability'
pnpm test:e2e:usability
$env:OMNIS_E2E_PROFILE='tests/.tmp/five-final-packaged-operations'
pnpm test:e2e:operations
pnpm test:e2e:external-ai
```

외부 AI E2E는 자체 격리 profile과 로컬 mock transport를 사용한다. 새 테스트의 재생성/삭제는 `tests/.tmp` 내부임을 검사하며 실제 사용자의 `%APPDATA%/OMNIS`에는 적용하지 않는다.

## Windows 산출물

작업 폴더: `C:\Users\admin\alex\alex_study\military_project`.

| 파일 (작업 폴더 기준) | 크기 (bytes) | 서명 |
|---|---:|---|
| `release/usability-five-features/OMNIS Setup 1.0.0.exe` | 122,054,791 | NotSigned |
| `release/usability-five-features/win-unpacked/OMNIS.exe` | 246,326,272 | NotSigned |

SHA-256:

```text
OMNIS Setup 1.0.0.exe
FFF74C3CB4ECF3CFA8ECBE1445A2F2A8B09CA9DDA08BB69C392A3A2FAA6F83FF

win-unpacked/OMNIS.exe
E232658E44C0B3305C4DC2E30BC149BA760A83DF198F645FA932FB73AD462675
```

설치 파일의 생성과 unpacked 앱 실행 검증은 완료했다. 새 VM/깨끗한 PC에서 NSIS 설치·제거하는 시험은 수행하지 않았다. 위 파일은 Authenticode 서명 없는 시연용 산출물이다.

## 구성도와 사용 안내

- [전체 시스템 / AI 처리 구성도](architecture/README.md): 코드의 프로세스 경계, 저장소, 선택형 외부 호출, 개발·패키징 흐름을 PNG/SVG로 제공.
- [사용 안내](FIVE_FEATURES_USER_GUIDE.md): 위치·클릭 순서·권한·완료/중복/오류 정책.
- [시연 시나리오](DEMO_SCENARIO.md): 5종 기능의 5~7분 시연 순서.

## 미검증·외부 전제조건

- 실제 OpenAI/Anthropic 유료 API live call은 수행하지 않았다. 자동 검증은 mock이며 API 응답 품질을 실측한 결과가 아니다.
- 이 신규 버전의 macOS arm64/x64 실실행·DMG/ZIP 빌드와 CI는 수행하지 않았다. 기존 버전의 성공을 이번 버전 성공으로 대체하지 않는다.
- clean PC 설치·제거, Authenticode/Apple 서명·공증, 실제 군 운용 검증은 수행하지 않았다.
- 원격 push와 GitHub Actions 실행은 이번 승인 범위에 포함하지 않았다. 변경은 별도 로컬 브랜치에 commit하며 main에 merge하지 않는다.
- 캡처·테스트 profile·설치본 등 실행 생성물과 기존 사용자 산출물은 Git commit에서 제외한다. 문서용 구성도 PNG/SVG만 의도적으로 포함한다.
