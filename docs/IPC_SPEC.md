# IPC API

All channels are defined and validated in `src/shared/contracts.ts`. The preload exposes named methods such as `window.omnis.incidents.create(payload)` and the typed `window.omnis.invoke(channel, payload)` dispatcher. Handlers return `{ok:true,data}` or `{ok:false,error}`.

| Group | Channels |
|---|---|
| Auth | `auth:login`, `auth:logout`, `auth:me` |
| Dashboard | `dashboard:getSummary` |
| Operations | `operations:list/create/update/delete`, `operations:updateStatus`, `operations:getHistory` |
| Incidents | `incidents:list/get/create/update`, `incidents:updateStatus`, `incidents:assign/assignTeam`, `incidents:applyAi`, `incidents:getEvents` |
| Maintenance | `maintenance:list/create/update`, `maintenance:updateStatus`, `maintenance:getEvents` |
| Duty / Directives | `duty:list/create/update/delete`, `directives:list/create/update/delete/acknowledge`, `users:list` |
| Control | `control:overview/teams/alerts/createAlert/updateAlert`, `control:dailyPlans/upsertDailyPlan`, `control:reconciliation/resolveIssue/closeDay`, `control:handoverDraft/saveHandover` |
| Reports | `reports:daily`, `reports:weekly`, `reports:exportCsv`, `reports:exportPdf` |
| AI | `ai:triageIncident`, `ai:dailySummary`, `ai:similarIncidents`, `ai:maintenanceRecommendations`, `ai:slaRisk`, `ai:markApplied` |
| Demo | `demo:prepare`, `demo:reset` |
| Attachments | `attachments:list`, `attachments:add`, `attachments:open`, `attachments:delete` |
| System | `system:getInfo`, `system:setAiSettings`, `system:setOperationsSettings`, `system:auditLogs`, `system:notifications`, `system:backup`, `system:resetDemo`, `system:openDataFolder` |

Mutation 권한은 Renderer 상태와 무관하게 Main Process에서 검사한다. USER는 본인 접수만, MAINTAINER는 배정 작업과 소속 정비반 계획만 변경할 수 있다.

첨부자료 추가는 Main Process가 네이티브 파일 선택창을 열어 수행한다. Renderer는 원본 파일 경로를 전달하지 않으며, Main에서 확장자·크기·업무 접근권한을 검증한 뒤 전용 저장소로 복사한다.


## v6 실용 기능 IPC

신규 schema는 `src/shared/usabilityContracts.ts`에서 정의하고 기존 `contracts.ts`에 합친다.

| 영역 | 채널 | 권한/검증 |
|---|---|---|
| 템플릿 | `templates:list/save` | 조회는 로그인, 비활성 조회/수정은 ADMIN; version 검사 |
| 내 업무 | `work:mine` | 현재 session 사용자로만 조회 |
| 상세 링크 | `maintenance:get`, `directives:get` | 상세 재조회 시 행 권한 확인 |
| 점검표 | `checklist:get/attach/save` | ADMIN/배정 MAINTAINER; task 상태·revision·항목 소속·필수/NA 검사 |
| 반복 정비 | `recurring:list/save/delete/preview/generate` | ADMIN 또는 자기 담당 규칙 MAINTAINER; 날짜·version·상한·중복·담당자 검사 |
| 입력 점검 | `input:inspect` | 로그인, 결정적 로컬 규칙, 외부 호출 없음 |

`incidents:create/update`의 선택적 `intake`는 질문별 답변을 받으며 질문 snapshot은 Main이 템플릿에서 생성한다. 수정 시 `expectedUpdatedAt`로 오래된 접수 덮어쓰기를 방지할 수 있다. `maintenance:create`는 선택적 `assigneeId`와 `checklistTemplateId`를 받으며 생략 시 기존 생성자 배정·점검표 미부착 동작을 유지한다. `ai:triageIncident`의 선택적 `answers`는 Main에서 분석 입력에 조합한 후 기존 Provider의 마스킹 경로를 통과한다.

## 조직별 조치부서

`shared/organization.ts`의 Zod 계약을 사용한다.

- `organizations:list`: 로그인 사용자. 실제 부대와 부서 metadata/출처/등록 기준을 반환한다.
- `organizations:saveDepartment`: ADMIN. 실제 부대/부서 추가·수정·사용 여부. 동일 부대/부서 중복과 임의 부대 ID를 거부한다.
- `incidents:assignTeam`: ADMIN·OPERATOR. `teamId:null`은 조치부서 미지정, `userId:null`은 담당자 해제다. userId 생략은 기존 담당자 유지다. 비가용 부서/부적합 담당자를 거부하고 이벤트/감사 기록을 남긴다.
- `incidents:assign`, `incidents:assignTeam`, `incidents:applyAi`: 요청부서 `department`를 변경하지 않는다. 요청부서 변경은 접수 수정에서 수행한다. 기존 `incidents:assign.department` 입력은 호환성을 위해 수신하지만 더 이상 요청부서에 적용하지 않는다.
- `control:teams`, `incidents:list/get`: 기존 필드를 유지하면서 부대 metadata 또는 `team_name`을 반환한다. 목록의 조치부서는 team_name만 사용하고 NULL은 미지정이다.
