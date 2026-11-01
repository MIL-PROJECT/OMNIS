export const situationSeverityMeta = { INFO:['정보','sky'],WARNING:['주의','orange'],CRITICAL:['긴급','red'] } as const
export const situationStatusText = { OPEN:'미확인',ACKNOWLEDGED:'확인',RESOLVED:'종료' } as const
export const situationTypeText = { GPS_INTERFERENCE:'GPS 전파환경',NETWORK_DEGRADATION:'통신망 품질',SERVER:'서버',CYBER:'사이버',OTHER:'기타' } as const
export type SituationAlertStatus = keyof typeof situationStatusText
export type SituationAlertSeverity = keyof typeof situationSeverityMeta
export interface SituationAlertPreview {
  id:string
  alert_no:string
  severity:SituationAlertSeverity
  title:string
  impact_scope:string|null
  status:SituationAlertStatus
  occurred_at:string
}
export interface SituationAlert extends SituationAlertPreview {
  alert_type:keyof typeof situationTypeText
  description:string
  action_guidance:string|null
  department:string|null
  system_name:string|null
  creator_name:string|null
  acknowledged_at:string|null
  resolved_at:string|null
  updated_at:string
}
export interface SituationAlertSummary {
  openAlertCount:number
  criticalAlertCount:number
  activeAlertPreview:SituationAlertPreview[]
}
