# PDF 요구사항 추적표

기준 문서: `AI활용체계개발.pdf`, 특히 5~11쪽의 평가기준, 정보통신 운용·정비 사례와 일일 운영절차. 상태는 코드와 실행 검증을 기준으로 기록한다.

| ID | PDF 근거 | 업무 목적 | 구현 상태 | 변경 대상 | 우선순위 | 구현 파일 | 검증 | 완료 |
|---|---:|---|---|---|---|---|---|---|
| EV-01 | 5 | 완성도 50점: 설치 가능한 업무 앱 | 구현 | 전체 | P0 | `src/main`, `src/renderer` | build, E2E, NSIS | 완료 |
| EV-02 | 5 | AI 활용도 30점: 업무 데이터와 연결 | 구현 | AI·고장 | P0 | `AIProvider.ts`, `AppService.ts`, `IncidentsManagement.tsx` | AI unit, workflow E2E | 완료 |
| EV-03 | 5 | 차별성 15점: SLA·마감·인수인계 | 구현 | 통제 | P0 | `OperationalControlService.ts`, `ControlCenterManagement.tsx` | control integration, E2E | 완료 |
| OP-01 | 6~7 | 운영 체계 현황 통합 조회 | 기존 기능 유지·KPI 확장 | 상황판·운영현황 | P0 | `DashboardRepository.ts`, `App.tsx`, `OperationsManagement.tsx` | dashboard E2E | 완료 |
| OP-02 | 6~7 | GPS·망 품질·서버 상황경보 | 신규 구현 | 상황경보 | P0 | `migrate.ts`, `OperationalControlService.ts`, `ControlCenterManagement.tsx` | control integration | 완료 |
| IN-01 | 8~9 | 게시판·유선 고장 접수 | 확장 구현 | 고장관리 | P0 | `contracts.ts`, `AppService.ts`, `IncidentsManagement.tsx` | workflow E2E | 완료 |
| IN-02 | 8~9 | BNOC 분류 및 조치부서 지정 | 신규 구현 | 정비반·배정 | P0 | `maintenance_teams`, `team_members`, `incidents:assignTeam` | RBAC, workflow E2E | 완료 |
| IN-03 | 8~9 | 원격조치·현장출동·결과·검증·종결 | 신규 workflow | 고장관리 | P0 | `Workflow.ts`, `AppService.ts`, `IncidentsManagement.tsx` | transition unit/E2E | 완료 |
| IN-04 | 9 | 지휘관·참모 긴급 선조치 후 기록 | 신규 구현 | 접수 | P0 | `incidents` v3 컬럼, 접수 UI | schema/E2E | 완료 |
| MT-01 | 10 | 일일 계획과 진행상태 지속 확인 | 신규 구현 | 일일 작업판 | P0 | `maintenance_daily_plans`, control UI | control integration/E2E | 완료 |
| MT-02 | 10 | 08:30 계획·16:00 완료·미완료 사유 | 신규 구현, 시간 설정 가능 | 작업판·설정 | P0 | `app_settings`, `SystemManagement.tsx` | contract/UI E2E | 완료 |
| MT-03 | 10 | 계획·비계획 정비 구분 | 신규 구현 | 정비관리 | P1 | `maintenance_tasks.work_kind`, `MaintenanceManagement.tsx` | schema/workflow E2E | 완료 |
| RC-01 | 11 | 고장·정비 현황 대조 | 신규 구현 | 정합성 검사 | P0 | `reconciliationPreview`, `reconciliation_results` | control integration | 완료 |
| RC-02 | 11 | 미완료 최소화 및 관리자 마감 | 신규 구현 | 일일 마감 | P0 | `daily_closures`, `control:closeDay` | role/control integration | 완료 |
| DU-01 | 11 | 근무 현황·지시사항·인수인계 | 확장 구현 | 근무/지시 | P1 | `DutyManagement.tsx`, `handover_notes` | UI/E2E | 완료 |
| AI-01 | 5, 8~11 | 장애 유형·긴급도·정비반·초기조치 추천 | 확장 구현 | AI 분류 | P0 | `LocalRuleProvider.ts`, `OllamaProvider.ts` | structured-output unit | 완료 |
| AI-02 | 5 | 사람이 검토·수정 후 업무 반영 | 신규 구현 | AI 승인 | P0 | `incidents:applyAi`, AI 검토 패널 | workflow E2E | 완료 |
| AI-03 | 5 | timeout·잘못된 JSON fallback | 기존 안전장치 유지·로그 확장 | AI runtime | P0 | `AppService.ts`, `ai_runs` | AI unit/E2E | 완료 |
| AI-04 | 5 | 모델·프롬프트·latency·반영 추적 | 신규 구현 | AI audit | P1 | `ai_runs`, `ai:markApplied` | DB integration | 완료 |
| PR-01 | 5 | 15분 시연과 반복 가능한 가상 시나리오 | 신규 구현 | Demo Mode | P0 | `demo_scenarios`, `demo:prepare/reset` | workflow E2E | 완료 |
| EX-01 | 11 | 향후 외부 체계 연동 경계 | 인터페이스 설계만 | adapter | P2 | `OPERATION_CONCEPT.md` | 문서 검토 | 부분 |
| AT-01 | 8~9 | 접수·조치 첨부자료 | 신규 구현 | 고장·정비 상세 | P2 | `attachments`, `AttachmentStore.ts`, `AttachmentsPanel.tsx` | hash/storage integration, build, Electron E2E | 완료 |

## 평가 배점 기여

- 완성도: OP, IN, MT, RC, DU 요구사항이 실제 DB·IPC·UI workflow로 연결된다.
- AI 활용도: AI-01~04가 구조화 출력, 사람 승인, fallback, 재현성 기록을 제공한다.
- 차별성: SLA 위험, 긴급 선조치, 원격→현장 전환, 일일 마감, 인수인계, Demo Mode를 제공한다.
- 프레젠테이션: PR-01과 `DEMO_SCENARIO.md`가 15분 시연 경로를 고정한다.
