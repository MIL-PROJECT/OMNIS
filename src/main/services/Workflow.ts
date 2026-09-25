export const incidentTransitions: Record<string, string[]> = {
  RECEIVED: ['TRIAGED', 'CANCELED'], TRIAGED: ['ASSIGNED', 'CANCELED'], ASSIGNED: ['PLANNED', 'IN_PROGRESS', 'CANCELED'], PLANNED: ['IN_PROGRESS', 'CANCELED'], IN_PROGRESS: ['RESOLVED', 'CANCELED'], RESOLVED: ['CLOSED', 'IN_PROGRESS'], CLOSED: [], CANCELED: []
}
export const maintenanceTransitions: Record<string, string[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELED'], IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELED'], BLOCKED: ['IN_PROGRESS', 'CANCELED'], COMPLETED: [], CANCELED: []
}
export function assertTransition(map: Record<string, string[]>, before: string, after: string): void {
  if (!map[before]?.includes(after)) throw new Error(`허용되지 않은 상태 변경: ${before} → ${after}`)
}
