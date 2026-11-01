import { z } from 'zod'

export const maintenanceWorkKinds = ['PLANNED', 'UNPLANNED', 'EMERGENCY', 'FIELD', 'DEPOT'] as const
export const maintenanceWorkKindSchema = z.enum(maintenanceWorkKinds, {
  error: '작업 구분은 계획·비계획·긴급·야전·창 중에서 선택하십시오.'
})
export type MaintenanceWorkKind = z.infer<typeof maintenanceWorkKindSchema>
export const maintenanceWorkKindLabels: Record<MaintenanceWorkKind, string> = {
  PLANNED: '계획',
  UNPLANNED: '비계획',
  EMERGENCY: '긴급',
  FIELD: '야전',
  DEPOT: '창'
}
export function maintenanceWorkKindLabel(value: unknown): string {
  return maintenanceWorkKinds.includes(value as MaintenanceWorkKind)
    ? maintenanceWorkKindLabels[value as MaintenanceWorkKind]
    : '확인 필요'
}
