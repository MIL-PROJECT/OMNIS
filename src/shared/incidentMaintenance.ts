export type LinkedMaintenance = {
  id: string
  taskNo: string
  title: string
  status: string
  progress: number
  assigneeName: string | null
  canOpen: boolean
}

export type IncidentMaintenanceContext = {
  incident: {
    id: string
    ticketNo: string
    title: string
    status: string
    severity: string
    description: string
    serviceImpact: string | null
    systemId: string | null
    systemName: string | null
    equipmentName: string | null
    teamName: string | null
    assigneeName: string | null
    maintenanceAssigneeId: string
    maintenanceAssigneeName: string
    updatedAt: string
  }
  canCreate: boolean
  reason: string | null
  tasks: LinkedMaintenance[]
}
