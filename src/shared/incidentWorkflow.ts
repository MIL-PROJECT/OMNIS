// Shared by the desktop UI and Main process so that both expose the same steps.
export const incidentTransitions: Record<string, string[]> = {
  RECEIVED: ['TRIAGED', 'CANCELED'],
  TRIAGED: ['ASSIGNED', 'ON_HOLD', 'CANCELED'],
  ASSIGNED: [
    'REMOTE_IN_PROGRESS',
    'ON_SITE_IN_PROGRESS',
    'PLANNED',
    'IN_PROGRESS',
    'ON_HOLD',
    'CANCELED'
  ],
  PLANNED: [
    'REMOTE_IN_PROGRESS',
    'ON_SITE_IN_PROGRESS',
    'IN_PROGRESS',
    'ON_HOLD',
    'CANCELED'
  ],
  IN_PROGRESS: [
    'REMOTE_IN_PROGRESS',
    'ON_SITE_IN_PROGRESS',
    'RESOLVED',
    'ON_HOLD',
    'CANCELED'
  ],
  REMOTE_IN_PROGRESS: [
    'ON_SITE_IN_PROGRESS',
    'RESOLVED',
    'ON_HOLD',
    'CANCELED'
  ],
  ON_SITE_IN_PROGRESS: ['RESOLVED', 'ON_HOLD', 'CANCELED'],
  RESOLVED: ['VERIFIED', 'REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS'],
  VERIFIED: ['CLOSED', 'RESOLVED'],
  ON_HOLD: [
    'ASSIGNED',
    'REMOTE_IN_PROGRESS',
    'ON_SITE_IN_PROGRESS',
    'CANCELED'
  ],
  CLOSED: [],
  CANCELED: []
}

export const incidentAssignmentStatuses = new Set([
  'TRIAGED',
  'ASSIGNED',
  'PLANNED',
  'IN_PROGRESS',
  'REMOTE_IN_PROGRESS',
  'ON_SITE_IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'VERIFIED'
])

export const incidentWorkStatuses = new Set([
  'PLANNED',
  'IN_PROGRESS',
  'REMOTE_IN_PROGRESS',
  'ON_SITE_IN_PROGRESS'
])
