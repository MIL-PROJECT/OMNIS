export { incidentTransitions } from '../../shared/incidentWorkflow'
export const maintenanceTransitions: Record<string, string[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELED'], IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELED'], BLOCKED: ['IN_PROGRESS', 'CANCELED'], COMPLETED: [], CANCELED: []
}
export function assertTransition(map: Record<string, string[]>, before: string, after: string): void {
  if (!map[before]?.includes(after)) throw new Error(`허용되지 않은 상태 변경: ${before} → ${after}`)
}
