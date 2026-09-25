# IPC API

All channels are defined and validated in `src/shared/contracts.ts`. The preload exposes named methods such as `window.omnis.incidents.create(payload)` and the typed `window.omnis.invoke(channel, payload)` dispatcher. Handlers return `{ok:true,data}` or `{ok:false,error}`.

| Group | Channels |
|---|---|
| Auth | `auth:login`, `auth:logout`, `auth:me` |
| Dashboard | `dashboard:getSummary` |
| Operations | `operations:list/create/update/delete`, `operations:updateStatus`, `operations:getHistory` |
| Incidents | `incidents:list/get/create/update`, `incidents:updateStatus`, `incidents:assign`, `incidents:getEvents` |
| Maintenance | `maintenance:list/create/update`, `maintenance:updateStatus`, `maintenance:getEvents` |
| Duty / Directives | `duty:list/create/update/delete`, `directives:list/create/update/delete`, `users:list` |
| Reports | `reports:daily`, `reports:weekly`, `reports:exportCsv`, `reports:exportPdf` |
| AI | `ai:triageIncident`, `ai:dailySummary`, `ai:similarIncidents`, `ai:maintenanceRecommendations` |
| System | `system:getInfo`, `system:setAiSettings`, `system:auditLogs`, `system:notifications`, `system:backup`, `system:resetDemo`, `system:openDataFolder` |

See `PROJECT_STATUS.md` for requested endpoints not implemented yet.
