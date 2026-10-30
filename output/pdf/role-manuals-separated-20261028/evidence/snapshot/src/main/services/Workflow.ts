export const incidentTransitions: Record<string, string[]> = {
  RECEIVED: ['TRIAGED', 'CANCELED'],
  TRIAGED: ['ASSIGNED', 'ON_HOLD', 'CANCELED'],
  ASSIGNED: ['REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS', 'PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'CANCELED'],
  PLANNED: ['REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS', 'IN_PROGRESS', 'ON_HOLD', 'CANCELED'],
  IN_PROGRESS: ['REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS', 'RESOLVED', 'ON_HOLD', 'CANCELED'],
  REMOTE_IN_PROGRESS: ['ON_SITE_IN_PROGRESS', 'RESOLVED', 'ON_HOLD', 'CANCELED'],
  ON_SITE_IN_PROGRESS: ['RESOLVED', 'ON_HOLD', 'CANCELED'],
  RESOLVED: ['VERIFIED', 'REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS'],
  VERIFIED: ['CLOSED', 'RESOLVED'],
  ON_HOLD: ['ASSIGNED', 'REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS', 'CANCELED'],
  CLOSED: [], CANCELED: []
}
export const maintenanceTransitions: Record<string, string[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELED'], IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELED'], BLOCKED: ['IN_PROGRESS', 'CANCELED'], COMPLETED: [], CANCELED: []
}
export function assertTransition(map: Record<string, string[]>, before: string, after: string): void {
  if (!map[before]?.includes(after)) throw new Error(`허용되지 않은 상태 변경: ${before} → ${after}`)
}
