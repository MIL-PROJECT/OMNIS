import { z } from 'zod'

export const statusSchema = z.enum(['NORMAL', 'WATCH', 'INSPECTION', 'FAULT', 'OFFLINE'])
export const incidentStatusSchema = z.enum(['RECEIVED', 'TRIAGED', 'ASSIGNED', 'PLANNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELED'])
export const maintenanceStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELED'])
export const roleSchema = z.enum(['ADMIN', 'OPERATOR', 'MAINTAINER', 'VIEWER', 'USER'])
export type Role = z.infer<typeof roleSchema>
export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

export const schemas = {
  'auth:login': z.object({ username: z.string().min(1), password: z.string().min(1) }),
  'auth:logout': z.object({}), 'auth:me': z.object({}),
  'dashboard:getSummary': z.object({}),
  'operations:list': z.object({ search: z.string().optional(), status: statusSchema.optional() }),
  'operations:create': z.object({ code: z.string().min(2).max(30), name: z.string().min(2), category: z.string().min(1), status: statusSchema, uptimePct: z.number().min(0).max(100), remarks: z.string().max(1000).optional() }),
  'operations:update': z.object({ id: z.string(), name: z.string().min(2), category: z.string().min(1), uptimePct: z.number().min(0).max(100), remarks: z.string().max(1000).optional() }),
  'operations:delete': z.object({ id: z.string() }),
  'operations:updateStatus': z.object({ id: z.string(), status: statusSchema, remarks: z.string().max(1000).optional() }),
  'operations:getHistory': z.object({ id: z.string() }),
  'incidents:list': z.object({ search: z.string().optional(), status: incidentStatusSchema.optional(), severity: z.enum(['URGENT','NORMAL']).optional(), reportedFrom: z.iso.date().optional(), reportedTo: z.iso.date().optional(), assignedTo: z.string().optional() }),
  'incidents:get': z.object({ id: z.string() }),
  'incidents:create': z.object({ title: z.string().min(3), category: z.string().min(1), severity: z.enum(['URGENT', 'NORMAL']), description: z.string().min(3), systemId: z.string().nullable().optional(), department: z.string().optional() }),
  'incidents:update': z.object({ id: z.string(), title: z.string().min(3), category: z.string().min(1), severity: z.enum(['URGENT','NORMAL']), description: z.string().min(3), department: z.string().nullable().optional() }),
  'incidents:updateStatus': z.object({ id: z.string(), status: incidentStatusSchema, note: z.string().max(1000).optional() }),
  'incidents:assign': z.object({ id: z.string(), userId: z.string(), department: z.string().optional() }),
  'incidents:getEvents': z.object({ id: z.string() }),
  'maintenance:list': z.object({ search: z.string().optional() }),
  'maintenance:create': z.object({ title: z.string().min(3), maintenanceType: z.string().min(1), priority: z.string(), department: z.string(), scheduledDate: z.string(), systemId: z.string().nullable().optional(), description: z.string().optional() }),
  'maintenance:update': z.object({ id: z.string(), title: z.string().min(3), maintenanceType: z.string().min(1), priority: z.enum(['NORMAL','HIGH']), department: z.string().min(1), scheduledDate: z.iso.date(), description: z.string().optional() }),
  'maintenance:updateStatus': z.object({ id: z.string(), status: maintenanceStatusSchema, progress: z.number().int().min(0).max(100), result: z.string().max(2000).optional() }),
  'maintenance:getEvents': z.object({ id: z.string() }),
  'duty:list': z.object({}),
  'duty:create': z.object({ dutyDate: z.iso.date(), shiftType: z.enum(['DAY','NIGHT','DUTY']), assignees: z.array(z.object({ userId: z.string().min(1), position: z.string().min(1) })).min(1).max(20).refine(a => new Set(a.map(x => x.userId)).size === a.length, '같은 담당자가 중복되었습니다.') }),
  'duty:update': z.object({ id: z.string(), dutyDate: z.iso.date(), shiftType: z.enum(['DAY','NIGHT','DUTY']), userId: z.string(), position: z.string().min(1) }),
  'duty:delete': z.object({ id: z.string() }),
  'directives:list': z.object({}),
  'directives:create': z.object({ title: z.string().min(3), content: z.string().min(3), level: z.enum(['URGENT', 'GENERAL', 'NOTICE']) }),
  'directives:update': z.object({ id: z.string(), title: z.string().min(3), content: z.string().min(3), level: z.enum(['URGENT', 'GENERAL', 'NOTICE']) }),
  'directives:delete': z.object({ id: z.string() }),
  'users:list': z.object({}),
  'reports:daily': z.object({ date: z.string() }),
  'reports:weekly': z.object({ startDate: z.iso.date() }),
  'reports:exportCsv': z.object({ kind: z.enum(['incidents', 'maintenance']) }),
  'reports:exportPdf': z.object({ date: z.iso.date() }),
  'ai:triageIncident': z.object({ title: z.string(), description: z.string() }),
  'ai:dailySummary': z.object({}),
  'ai:similarIncidents': z.object({ title: z.string().min(3) }),
  'ai:maintenanceRecommendations': z.object({}),
  'system:getInfo': z.object({}), 'system:backup': z.object({}), 'system:resetDemo': z.object({ confirm: z.literal('RESET DEMO') }),
  'system:openDataFolder': z.object({}),
  'system:setAiSettings': z.object({ provider: z.enum(['LOCAL','OLLAMA']), endpoint: z.url().refine(v => { const u = new URL(v); return u.protocol === 'http:' && ['127.0.0.1','localhost'].includes(u.hostname) && !u.username && !u.password && u.pathname === '/' }, '로컬 HTTP 주소만 허용됩니다.'), model: z.string().regex(/^[a-zA-Z0-9_.:-]{1,80}$/) }),
  'system:auditLogs': z.object({ limit: z.number().int().min(1).max(500).default(100) }),
  'system:notifications': z.object({}),
  'system:markNotificationRead': z.object({ id: z.string() })
} as const
export type Channel = keyof typeof schemas

export type PublicUser = { id: string; username: string; display_name: string; role: Role; rank_name: string | null; unit_name: string | null }
export type AfccsApi = {
  invoke: (channel: Channel, payload?: Record<string, unknown>) => Promise<Result<unknown>>
  auth: { login: (payload: { username: string; password: string }) => Promise<Result<unknown>>; logout: () => Promise<Result<unknown>>; me: () => Promise<Result<unknown>> }
  dashboard: { getSummary: () => Promise<Result<unknown>> }
  operations: { list: (payload?: Record<string, unknown>) => Promise<Result<unknown>>; updateStatus: (payload: Record<string, unknown>) => Promise<Result<unknown>>; getHistory: (payload: Record<string, unknown>) => Promise<Result<unknown>> }
  incidents: { list: (payload?: Record<string, unknown>) => Promise<Result<unknown>>; get: (payload: Record<string, unknown>) => Promise<Result<unknown>>; create: (payload: Record<string, unknown>) => Promise<Result<unknown>>; updateStatus: (payload: Record<string, unknown>) => Promise<Result<unknown>>; assign: (payload: Record<string, unknown>) => Promise<Result<unknown>>; getEvents: (payload: Record<string, unknown>) => Promise<Result<unknown>> }
  maintenance: { list: (payload?: Record<string, unknown>) => Promise<Result<unknown>>; create: (payload: Record<string, unknown>) => Promise<Result<unknown>>; updateStatus: (payload: Record<string, unknown>) => Promise<Result<unknown>> }
  ai: { triageIncident: (payload: Record<string, unknown>) => Promise<Result<unknown>>; dailySummary: () => Promise<Result<unknown>>; similarIncidents: (payload: Record<string, unknown>) => Promise<Result<unknown>>; maintenanceRecommendations: () => Promise<Result<unknown>> }
  system: { getInfo: () => Promise<Result<unknown>>; backup: () => Promise<Result<unknown>>; resetDemo: (payload: Record<string, unknown>) => Promise<Result<unknown>> }
}
