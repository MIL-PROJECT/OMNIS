import type { incidentStatusSchema, maintenanceStatusSchema } from './contracts'

export type ReportStatus = (typeof incidentStatusSchema.options)[number] | (typeof maintenanceStatusSchema.options)[number]
export const reportStatusLabels:Record<ReportStatus,string> = {
  RECEIVED:'접수',TRIAGED:'분류',ASSIGNED:'배정',PLANNED:'계획',IN_PROGRESS:'진행',
  REMOTE_IN_PROGRESS:'원격조치',ON_SITE_IN_PROGRESS:'현장출동',RESOLVED:'조치완료',
  VERIFIED:'검증',CLOSED:'종결',ON_HOLD:'보류',CANCELED:'취소',BLOCKED:'보류',COMPLETED:'완료'
}
export const incidentSeverityLabels:Record<'URGENT'|'NORMAL',string> = {URGENT:'긴급',NORMAL:'일반'}
export const reportStatusLabel=(value:unknown):string=>reportStatusLabels[String(value) as ReportStatus]??'확인필요'
export const incidentSeverityLabel=(value:unknown):string=>incidentSeverityLabels[String(value) as keyof typeof incidentSeverityLabels]??'확인필요'
