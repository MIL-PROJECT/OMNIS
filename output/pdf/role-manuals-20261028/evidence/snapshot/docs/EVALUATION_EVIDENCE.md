# 평가 증빙

이 문서는 구현 파일과 실행 결과만 근거로 채점한다. 시뮬레이션·가상 데이터 결과를 실제 군 운용 검증으로 표현하지 않는다.

## 자체평가

| 영역 | 배점 | 예상 | 근거 | 남은 위험 |
|---|---:|---:|---|---|
| 완성도 | 50 | 48 | schema v4, 접수→종결 workflow, 정비·경보·작업판·마감 UI, 장애·정비 첨부자료, 기존 CRUD/보고서/백업, Electron E2E | 외부 adapter 구현 없음, 깨끗한 VM 설치 미검증 |
| AI 활용도 | 30 | 27 | 구조화 분류, 사용자 승인 반영, 유사 사례, SLA 규칙, 인수인계, Ollama fallback, `ai_runs` | embedding 유사도와 여러 보고서 초안은 제한적 |
| 차별성 | 15 | 14 | 긴급 선조치, 원격→현장, 정합성 검사, snapshot, 설명 가능한 SLA, Demo Mode | 실제 외부 체계 대조는 범위 밖 |
| 프레젠테이션 | 5 | 5 | 반복 가능한 시나리오 준비/초기화, 15분 클릭 흐름, 가상자료 표시 | 발표자 리허설 필요 |
| **합계** | **100** | **94** | 현재 코드와 로컬 검증 기준 | 미검증 항목을 점수에 포함하지 않음 |

## 구현 증빙

### 완성도

- DB와 migration: `src/main/database/migrate.ts`, `schema.ts`, `seed.ts`
- Workflow와 업무 서비스: `src/main/services/Workflow.ts`, `AppService.ts`, `OperationalControlService.ts`
- 업무 UI: `IncidentsManagement.tsx`, `MaintenanceManagement.tsx`, `ControlCenterManagement.tsx`, `DutyManagement.tsx`
- 기존 데이터 보존: v2→v4 migration test에서 기존 사용자 행 유지 확인
- 첨부자료: schema v4, 전용 저장소, 25MB·확장자 제한, SHA-256, 권한·감사·업무 이벤트, 백업 동반 보존

### AI

- Local Rule/Ollama: `src/main/ai/LocalRuleProvider.ts`, `OllamaProvider.ts`
- 구조화 출력: `AIProvider.ts`와 Zod provider schema
- 사용자 승인 반영과 추적: `incidents:applyAi`, `ai_runs`, incident event
- 안전성: loopback 제한, 8초 timeout, JSON/Zod 검증, Local Rule fallback

### 보안·권한

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` 유지
- 신규 mutation 권한은 Main service의 `permit`에서 강제
- USER 본인 접수 제한, MAINTAINER 배정 작업 제한, VIEWER mutation 차단
- 주요 변경은 `audit_logs`와 업무 event table에 저장

## 검증 명령과 판정

최종 실행 후 아래 결과와 설치 파일 hash를 갱신한다.

| 검사 | 명령 | 판정 |
|---|---|---|
| TypeScript | `pnpm typecheck` | 통과 |
| ESLint | `pnpm lint` | 통과 |
| unit/integration | `pnpm test` | 통과 |
| production build | `pnpm build` | 통과 |
| source Electron E2E | `pnpm test:e2e` | 통과 |
| 역할 E2E | `pnpm test:e2e:roles` | 통과 |
| 가입 E2E | `pnpm test:e2e:signup` | 통과 |
| 신규 workflow E2E | `pnpm test:e2e:operations` | 통과 |
| 해상도 UI | `pnpm test:e2e:visual` | 1366×768, 1920×1080 통과 |
| NSIS | `pnpm dist:win` | 통과 |
| packaged E2E | unpacked EXE 대상 smoke + operations | 모두 통과 |

94점은 현재 기능 범위의 보수적 자체평가다. 외부 adapter와 clean VM 설치까지 증빙하면 95점 이상 근거가 강화된다.

## Windows 산출물

- 설치 파일: `release/OMNIS Setup 1.0.0.exe`
- unpacked 실행본: `release/win-unpacked/OMNIS.exe`
- SHA-256: `918F017A7ECC3BF62CD3FDD988592A45D47D78943B165B784EE4871C7C7B409A`
- 생성 시각: 2026-10-28 07:24 KST
- 설치 파일 크기: 124,581,731 bytes
- unpacked 실행본 smoke와 operations workflow E2E 통과
