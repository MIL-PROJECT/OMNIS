import { z } from 'zod'
import { usabilitySchemas } from './usabilityContracts'
import { organizationSchemas } from './organization'
import { intakeSchema, answerSchema } from './usability'

export const statusSchema = z.enum(['NORMAL', 'WATCH', 'INSPECTION', 'FAULT', 'OFFLINE'])
export const incidentStatusSchema = z.enum(['RECEIVED', 'TRIAGED', 'ASSIGNED', 'PLANNED', 'IN_PROGRESS', 'REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED', 'ON_HOLD', 'CANCELED'])
export const maintenanceStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELED'])
export const roleSchema = z.enum(['ADMIN', 'OPERATOR', 'MAINTAINER', 'VIEWER', 'USER'])
export const intakeSourceSchema = z.enum(['BOARD', 'PHONE', 'COMMAND', 'OPERATION_URGENT'])
export const resolutionModeSchema = z.enum(['REMOTE', 'ON_SITE'])
export const situationSeveritySchema = z.enum(['INFO', 'WARNING', 'CRITICAL'])
export const attachmentEntitySchema = z.enum(['INCIDENT', 'MAINTENANCE'])
export const attachmentCategorySchema = z.enum(['PHOTO', 'LOG', 'REPORT', 'CHECKLIST', 'OTHER'])
export const aiProviderSchema = z.enum(['LOCAL','OLLAMA','OPENAI','ANTHROPIC'])
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
  ...usabilitySchemas,
  ...organizationSchemas,
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
  'incidents:create': z.object({ title: z.string().min(3), category: z.string().min(1), severity: z.enum(['URGENT', 'NORMAL']), description: z.string().min(3), systemId: z.string().nullable().optional(), department: z.string().optional(), intakeSource: intakeSourceSchema.default('BOARD'), reporterName: z.string().max(50).optional(), equipmentName: z.string().max(100).optional(), serviceImpact: z.string().max(1000).optional(), occurredAt: z.iso.datetime().optional(), desiredResolutionAt: z.iso.datetime().optional(), emergencyPreaction: z.boolean().default(false), emergencyReason: z.string().max(1000).optional(), actualActionStartedAt: z.iso.datetime().optional(), intake:intakeSchema.optional() }).superRefine((v,ctx) => { if (v.emergencyPreaction && !v.emergencyReason?.trim()) ctx.addIssue({ code:'custom', path:['emergencyReason'], message:'긴급 선조치 사유가 필요합니다.' }); if (v.emergencyPreaction && !v.actualActionStartedAt) ctx.addIssue({ code:'custom', path:['actualActionStartedAt'], message:'실제 조치 시작시각이 필요합니다.' }) }),
  'incidents:update': z.object({ id: z.string(), title: z.string().min(3), category: z.string().min(1), severity: z.enum(['URGENT','NORMAL']), description: z.string().min(3), department: z.string().nullable().optional(), intakeSource: intakeSourceSchema.optional(), reporterName: z.string().max(50).nullable().optional(), equipmentName: z.string().max(100).nullable().optional(), serviceImpact: z.string().max(1000).nullable().optional(), desiredResolutionAt: z.iso.datetime().nullable().optional(), intake:intakeSchema.optional(), expectedUpdatedAt:z.string().optional() }),
  'incidents:updateStatus': z.object({ id: z.string(), status: incidentStatusSchema, note: z.string().max(1000).optional(), cause: z.string().max(1000).optional(), actionSummary: z.string().max(2000).optional(), resolutionMode: resolutionModeSchema.optional(), recurrenceRisk: z.enum(['LOW','MEDIUM','HIGH']).optional(), followUpDate: z.iso.date().optional(), userConfirmed: z.boolean().optional() }),
  'incidents:assign': z.object({ id: z.string(), userId: z.string(), department: z.string().optional() }),
  'incidents:assignTeam': z.object({ id: z.string(), teamId: z.string().min(1).nullable(), userId: z.string().min(1).nullable().optional(), note: z.string().max(500).optional() }),
  'incidents:applyAi': z.object({ id: z.string(), category: z.string().min(1).max(50), severity: z.enum(['URGENT','NORMAL']), teamId: z.string().optional(), rationale: z.string().min(1).max(1000), confidence: z.number().min(0).max(1), runId: z.string().optional() }),
  'incidents:getEvents': z.object({ id: z.string() }),
  'maintenance:list': z.object({ search: z.string().optional() }),
  'maintenance:create': z.object({ title: z.string().min(3), maintenanceType: z.string().min(1), workKind: z.enum(['PLANNED','UNPLANNED']).default('PLANNED'), priority: z.enum(['NORMAL','HIGH']), department: z.string().min(1), scheduledDate: z.iso.date(), systemId: z.string().nullable().optional(), incidentId: z.string().nullable().optional(), description: z.string().max(2000).optional(), assigneeId:z.string().optional(), checklistTemplateId:z.string().nullable().optional() }),
  'maintenance:update': z.object({ id: z.string(), title: z.string().min(3), maintenanceType: z.string().min(1), workKind: z.enum(['PLANNED','UNPLANNED']), priority: z.enum(['NORMAL','HIGH']), department: z.string().min(1), scheduledDate: z.iso.date(), incidentId: z.string().nullable().optional(), description: z.string().max(2000).optional() }),
  'maintenance:updateStatus': z.object({ id: z.string(), status: maintenanceStatusSchema, progress: z.number().int().min(0).max(100), result: z.string().max(2000).optional(), cause: z.string().max(1000).optional(), actionDetail: z.string().max(2000).optional(), partsUsed: z.string().max(1000).optional(), resolutionMode: resolutionModeSchema.optional(), recurrenceRisk: z.enum(['LOW','MEDIUM','HIGH']).optional(), followUpDate: z.iso.date().optional() }).superRefine((v,ctx) => { if (v.status === 'COMPLETED') { if (!v.result?.trim()) ctx.addIssue({code:'custom',path:['result'],message:'작업 결과가 필요합니다.'}); if (!v.cause?.trim()) ctx.addIssue({code:'custom',path:['cause'],message:'원인 분석이 필요합니다.'}); if (!v.actionDetail?.trim()) ctx.addIssue({code:'custom',path:['actionDetail'],message:'상세 조치내용이 필요합니다.'}); if (!v.resolutionMode) ctx.addIssue({code:'custom',path:['resolutionMode'],message:'조치 방식을 선택하십시오.'}) } }),
  'maintenance:getEvents': z.object({ id: z.string() }),
  'attachments:list': z.object({ entityType: attachmentEntitySchema, entityId: z.string().min(1) }),
  'attachments:add': z.object({ entityType: attachmentEntitySchema, entityId: z.string().min(1), category: attachmentCategorySchema.default('OTHER'), note: z.string().trim().max(300).optional() }),
  'attachments:open': z.object({ id: z.string().min(1) }),
  'attachments:delete': z.object({ id: z.string().min(1) }),
  'duty:list': z.object({}),
  'duty:create': z.object({ dutyDate: z.iso.date(), shiftType: z.enum(['DAY','NIGHT','DUTY']), assignees: z.array(z.object({ userId: z.string().min(1), position: z.string().min(1) })).min(1).max(20).refine(a => new Set(a.map(x => x.userId)).size === a.length, '같은 담당자가 중복되었습니다.') }),
  'duty:update': z.object({ id: z.string(), dutyDate: z.iso.date(), shiftType: z.enum(['DAY','NIGHT','DUTY']), userId: z.string(), position: z.string().min(1) }),
  'duty:delete': z.object({ id: z.string() }),
  'directives:list': z.object({}),
  'directives:create': z.object({ title: z.string().min(3), content: z.string().min(3), level: z.enum(['URGENT', 'GENERAL', 'NOTICE']), dueAt: z.iso.datetime().optional(), department: z.string().max(100).optional(), assigneeId: z.string().optional() }),
  'directives:update': z.object({ id: z.string(), title: z.string().min(3), content: z.string().min(3), level: z.enum(['URGENT', 'GENERAL', 'NOTICE']), dueAt: z.iso.datetime().nullable().optional(), department: z.string().max(100).nullable().optional(), assigneeId: z.string().nullable().optional(), status: z.enum(['OPEN','IN_PROGRESS','COMPLETED']).optional() }),
  'directives:delete': z.object({ id: z.string() }),
  'directives:acknowledge': z.object({ id: z.string() }),
  'users:list': z.object({}),
  'reports:daily': z.object({ date: z.string() }),
  'reports:weekly': z.object({ startDate: z.iso.date() }),
  'reports:exportCsv': z.object({ kind: z.enum(['incidents', 'maintenance']) }),
  'reports:exportPdf': z.object({ date: z.iso.date() }),
  'ai:triageIncident': z.object({ title: z.string(), description: z.string(), serviceImpact: z.string().max(1000).optional(), systemId: z.string().optional(), incidentId: z.string().optional(), answers:z.array(answerSchema).max(10).optional() }),
  'ai:dailySummary': z.object({}),
  'ai:similarIncidents': z.object({ title: z.string().min(3) }),
  'ai:maintenanceRecommendations': z.object({}),
  'ai:slaRisk': z.object({ incidentId: z.string() }),
  'ai:markApplied': z.object({ runId: z.string(), userModified: z.boolean().default(false) }),
  'ai:listRuns': z.object({ limit: z.number().int().min(1).max(200).default(50) }),
  'control:overview': z.object({ date: z.iso.date().optional() }),
  'control:teams': z.object({}),
  'control:alerts': z.object({ status: z.enum(['OPEN','ACKNOWLEDGED','RESOLVED']).optional() }),
  'control:createAlert': z.object({ alertType: z.enum(['GPS_INTERFERENCE','NETWORK_DEGRADATION','SERVER','CYBER','OTHER']), severity: situationSeveritySchema, title: z.string().min(3).max(120), description: z.string().min(3).max(2000), systemId: z.string().nullable().optional(), impactScope: z.string().max(500).optional(), actionGuidance: z.string().max(1000).optional(), department: z.string().max(100).optional(), occurredAt: z.iso.datetime() }),
  'control:updateAlert': z.object({ id: z.string(), action: z.enum(['ACKNOWLEDGE','RESOLVE']) }),
  'control:dailyPlans': z.object({ date: z.iso.date() }),
  'control:upsertDailyPlan': z.object({ date: z.iso.date(), teamId: z.string(), plannedCount: z.number().int().min(0).max(999), unplannedCount: z.number().int().min(0).max(999), completedCount: z.number().int().min(0).max(999), incompleteReason: z.string().max(1000).optional(), carryOverCount: z.number().int().min(0).max(999) }).refine(v => v.completedCount <= v.plannedCount + v.unplannedCount, { path:['completedCount'], message:'완료 건수는 전체 작업 건수를 초과할 수 없습니다.' }),
  'control:reconciliation': z.object({ date: z.iso.date() }),
  'control:resolveIssue': z.object({ id: z.string(), exceptionReason: z.string().min(2).max(1000).optional() }),
  'control:closeDay': z.object({ date: z.iso.date(), allowExceptions: z.boolean().default(false) }),
  'control:handoverDraft': z.object({ date: z.iso.date(), shiftType: z.enum(['DAY','NIGHT','DUTY']) }),
  'control:saveHandover': z.object({ id: z.string().optional(), date: z.iso.date(), shiftType: z.enum(['DAY','NIGHT','DUTY']), text: z.string().min(10).max(10000), confirm: z.boolean().default(false) }),
  'demo:prepare': z.object({ scenario: z.literal('EVALUATION') }),
  'demo:reset': z.object({ scenario: z.literal('EVALUATION') }),
  'system:getInfo': z.object({}), 'system:backup': z.object({}), 'system:resetDemo': z.object({ confirm: z.literal('RESET DEMO') }),
  'system:openDataFolder': z.object({}),
  'system:getAiSettings': z.object({}),
  'system:setAiSettings': z.object({ provider: aiProviderSchema, ollamaEndpoint: z.url().refine(v => { const u = new URL(v); return u.protocol === 'http:' && ['127.0.0.1','localhost'].includes(u.hostname) && !u.username && !u.password && u.pathname === '/' }, '로컬 HTTP 주소만 허용됩니다.'), ollamaModel: z.string().regex(/^[a-zA-Z0-9_.:-]{1,80}$/), openaiModel:z.string().regex(/^[a-zA-Z0-9_.:-]{1,80}$/), anthropicModel:z.string().regex(/^[a-zA-Z0-9_.:-]{1,80}$/), externalAiEnabled:z.boolean(), externalConsent:z.boolean(), timeoutSeconds:z.number().int().min(5).max(30), dailyRequestLimit:z.number().int().min(1).max(1000) }),
  'system:saveAiCredential': z.object({ provider:z.enum(['OPENAI','ANTHROPIC']), apiKey:z.string().trim().min(12).max(500) }),
  'system:deleteAiCredential': z.object({ provider:z.enum(['OPENAI','ANTHROPIC']) }),
  'system:testAiConnection': z.object({ provider:z.enum(['OLLAMA','OPENAI','ANTHROPIC']) }),
  'system:setOperationsSettings': z.object({ planTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), urgentSlaMinutes: z.number().int().min(10).max(10080), normalSlaMinutes: z.number().int().min(10).max(43200) }),
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
