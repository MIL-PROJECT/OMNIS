import { z } from 'zod'

export const statusSchema = z.enum(['NORMAL', 'WATCH', 'INSPECTION', 'FAULT', 'OFFLINE'])
export const incidentStatusSchema = z.enum(['RECEIVED', 'TRIAGED', 'ASSIGNED', 'PLANNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELED'])
export const maintenanceStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELED'])
export const roleSchema = z.enum(['ADMIN', 'OPERATOR', 'MAINTAINER', 'VIEWER', 'USER'])
export type Role = z.infer<typeof roleSchema>
// 사용자 등록 신청
export const ranks = ['이병', '일병', '상병', '병장', '하사', '중사', '상사', '원사', '준위', '소위', '중위', '대위', '소령', '중령', '대령', '준장', '소장', '중장', '대장', '군무원'] as const
export const signupRules = {
  serviceNo: /^\d{2}-\d{5,8}$/,
  username: /^[a-z][a-z0-9_]{3,19}$/,
  password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/,
  phone: /^0\d{1,2}-?\d{3,4}-?\d{4}$/
}
export const signupSchema = z.object({
  serviceNo: z.string().trim().regex(signupRules.serviceNo, '군번 형식이 올바르지 않습니다. (예: 22-12345678)'),
  rankName: z.enum(ranks, { error: '계급을 선택하십시오.' }),
  displayName: z.string().trim().min(2, '이름은 2자 이상 입력하십시오.').max(20, '이름은 20자 이하로 입력하십시오.'),
  unitName: z.string().trim().min(2, '소속을 입력하십시오.').max(50, '소속은 50자 이하로 입력하십시오.'),
  username: z.string().trim().regex(signupRules.username, '아이디는 영문 소문자로 시작하는 4~20자(소문자·숫자·_)여야 합니다.'),
  password: z.string().regex(signupRules.password, '비밀번호는 영문·숫자·특수문자를 모두 포함해 8자 이상이어야 합니다.'),
  phone: z.string().trim().regex(signupRules.phone, '연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)').optional().or(z.literal('')),
  reason: z.string().trim().max(300, '신청 사유는 300자 이하로 입력하십시오.').optional()
})
export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

export const schemas = {
  'auth:login': z.object({ username: z.string().min(1), password: z.string().min(1) }),
  'auth:logout': z.object({}), 'auth:me': z.object({}),
  'auth:register': signupSchema,
  'admin:signupRequests': z.object({}),
  'admin:approveSignup': z.object({ id: z.string(), role: roleSchema }),
  'admin:rejectSignup': z.object({ id: z.string(), reason: z.string().trim().min(2, '반려 사유를 2자 이상 입력하십시오.').max(300, '반려 사유는 300자 이하로 입력하십시오.') }),
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
export type OmnisApi = {
  invoke: (channel: Channel, payload?: Record<string, unknown>) => Promise<Result<unknown>>
  auth: { login: (payload: { username: string; password: string }) => Promise<Result<unknown>>; logout: () => Promise<Result<unknown>>; me: () => Promise<Result<unknown>> }
  dashboard: { getSummary: () => Promise<Result<unknown>> }
  operations: { list: (payload?: Record<string, unknown>) => Promise<Result<unknown>>; updateStatus: (payload: Record<string, unknown>) => Promise<Result<unknown>>; getHistory: (payload: Record<string, unknown>) => Promise<Result<unknown>> }
  incidents: { list: (payload?: Record<string, unknown>) => Promise<Result<unknown>>; get: (payload: Record<string, unknown>) => Promise<Result<unknown>>; create: (payload: Record<string, unknown>) => Promise<Result<unknown>>; updateStatus: (payload: Record<string, unknown>) => Promise<Result<unknown>>; assign: (payload: Record<string, unknown>) => Promise<Result<unknown>>; getEvents: (payload: Record<string, unknown>) => Promise<Result<unknown>> }
  maintenance: { list: (payload?: Record<string, unknown>) => Promise<Result<unknown>>; create: (payload: Record<string, unknown>) => Promise<Result<unknown>>; updateStatus: (payload: Record<string, unknown>) => Promise<Result<unknown>> }
  ai: { triageIncident: (payload: Record<string, unknown>) => Promise<Result<unknown>>; dailySummary: () => Promise<Result<unknown>>; similarIncidents: (payload: Record<string, unknown>) => Promise<Result<unknown>>; maintenanceRecommendations: () => Promise<Result<unknown>> }
  system: { getInfo: () => Promise<Result<unknown>>; backup: () => Promise<Result<unknown>>; resetDemo: (payload: Record<string, unknown>) => Promise<Result<unknown>> }
}
