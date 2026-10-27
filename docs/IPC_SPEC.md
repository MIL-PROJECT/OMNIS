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
