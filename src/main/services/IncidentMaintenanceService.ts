import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { PublicUser } from '../../shared/contracts'
import { schemas } from '../../shared/contracts'
import type {
  IncidentMaintenanceContext,
  LinkedMaintenance
} from '../../shared/incidentMaintenance'
import { createMaintenance } from './UsabilityService'
import { assertIncidentAssignment } from './IncidentAssignmentService'

type Incident = {
  id: string
  ticket_no: string
  title: string
  status: string
  severity: string
  description: string
  service_impact: string | null
  system_id: string | null
  system_name: string | null
  equipment_name: string | null
  team_name: string | null
  assigned_to: string | null
  assignee_name: string | null
  assignee_role: string | null
  assignee_active: number | null
  team_id: string | null
  reported_by: string
  updated_at: string
}
const registrationStages = new Set([
  'ASSIGNED',
  'PLANNED',
  'IN_PROGRESS',
  'REMOTE_IN_PROGRESS',
  'ON_SITE_IN_PROGRESS'
])
const incidentSql = `SELECT i.*,s.name system_name,t.name team_name,u.display_name assignee_name,u.role assignee_role,u.active assignee_active
  FROM incidents i LEFT JOIN communication_systems s ON s.id=i.system_id
  LEFT JOIN maintenance_teams t ON t.id=i.team_id LEFT JOIN users u ON u.id=i.assigned_to`

function contextFor(
  db: Database.Database,
  user: PublicUser,
  row: Incident
): IncidentMaintenanceContext {
  if (user.role === 'USER' && row.reported_by !== user.id)
    throw new Error('본인이 접수한 고장만 조회할 수 있습니다.')
  const tasks = (
    db
      .prepare(
        `SELECT m.id,m.task_no taskNo,m.title,m.status,m.progress,u.display_name assigneeName,m.assignee_id
    FROM maintenance_tasks m LEFT JOIN users u ON u.id=m.assignee_id WHERE m.incident_id=? ORDER BY m.created_at DESC,m.rowid DESC`
      )
      .all(row.id) as (LinkedMaintenance & { assignee_id: string })[]
  ).map(({ assignee_id, ...task }) => ({
    ...task,
    canOpen:
      user.role !== 'USER' &&
      (user.role !== 'MAINTAINER' || assignee_id === user.id)
  }))
  const active = tasks.find(
    (t) => !['COMPLETED', 'CANCELED'].includes(t.status)
  )
  const assigneeEligible =
    !!row.assignee_active &&
    ['ADMIN', 'MAINTAINER'].includes(row.assignee_role ?? '')
  const canRegisterRole = user.role === 'ADMIN' || user.role === 'MAINTAINER'
  let assignmentIssue: string | null = null
  if (registrationStages.has(row.status)) {
    try {
      assertIncidentAssignment(db, row.team_id, row.assigned_to)
    } catch (error) {
      assignmentIssue = (error as Error).message
    }
  }
  const reason = !canRegisterRole
    ? '관리자 또는 배정받은 정비요원이 정비를 등록합니다.'
    : user.role === 'MAINTAINER' && row.assigned_to !== user.id
      ? '본인에게 배정된 고장만 정비를 등록할 수 있습니다.'
      : !registrationStages.has(row.status)
        ? '조치부서·담당자 배정 후 조치 진행 단계에서 정비를 등록할 수 있습니다.'
        : assignmentIssue
          ? `${assignmentIssue} 고장 배정 정보를 먼저 확인하십시오.`
          : active
            ? `진행 중인 정비 ${active.taskNo}가 있습니다. ${active.assigneeName ?? '기존 담당자'}의 작업을 먼저 확인하십시오.`
            : null
  return {
    incident: {
      id: row.id,
      ticketNo: row.ticket_no,
      title: row.title,
      status: row.status,
      severity: row.severity,
      description: row.description,
      serviceImpact: row.service_impact,
      systemId: row.system_id,
      systemName: row.system_name,
      equipmentName: row.equipment_name,
      teamName: row.team_name,
      assigneeName: row.assignee_name,
      maintenanceAssigneeId:
        user.role === 'ADMIN' && assigneeEligible
          ? String(row.assigned_to)
          : user.id,
      maintenanceAssigneeName:
        user.role === 'ADMIN' && assigneeEligible
          ? String(row.assignee_name)
          : user.display_name,
      updatedAt: row.updated_at
    },
    canCreate: reason === null,
    reason,
    tasks
  }
}

export function incidentMaintenanceContext(
  db: Database.Database,
  user: PublicUser,
  incidentId: string
): IncidentMaintenanceContext {
  const row = db.prepare(`${incidentSql} WHERE i.id=?`).get(incidentId) as
    Incident | undefined
  if (!row) throw new Error('고장 접수를 찾을 수 없습니다.')
  return contextFor(db, user, row)
}

export function incidentMaintenanceCandidates(
  db: Database.Database,
  user: PublicUser
): IncidentMaintenanceContext[] {
  if (!['ADMIN', 'MAINTAINER'].includes(user.role))
    throw new Error('정비 등록 권한이 없습니다.')
  const rows = db
    .prepare(
      `${incidentSql} WHERE i.status IN ('ASSIGNED','PLANNED','IN_PROGRESS','REMOTE_IN_PROGRESS','ON_SITE_IN_PROGRESS')
    AND (? IS NULL OR i.assigned_to=?) ORDER BY CASE i.severity WHEN 'URGENT' THEN 0 ELSE 1 END,i.reported_at DESC`
    )
    .all(
      user.role === 'ADMIN' ? null : user.id,
      user.role === 'ADMIN' ? null : user.id
    ) as Incident[]
  return rows.map((row) => contextFor(db, user, row))
}

export function createMaintenanceFromIncident(
  db: Database.Database,
  user: PublicUser,
  input: unknown
): { id: string; task_no: string; existing: boolean } {
  if (!['ADMIN', 'MAINTAINER'].includes(user.role))
    throw new Error('정비 등록 권한이 없습니다.')
  const p = schemas['maintenance:createFromIncident'].parse(input)
  return db
    .transaction(() => {
      const context = incidentMaintenanceContext(db, user, p.incidentId)
      // Permission and current assignment are checked even for a repeated request.
      const row = db
        .prepare('SELECT assigned_to,status FROM incidents WHERE id=?')
        .get(p.incidentId) as { assigned_to: string | null; status: string }
      if (user.role === 'MAINTAINER' && row.assigned_to !== user.id)
        throw new Error('본인에게 배정된 고장만 정비를 등록할 수 있습니다.')
      const active = context.tasks.find(
        (t) => !['COMPLETED', 'CANCELED'].includes(t.status)
      )
      if (active) {
        if (!active.canOpen)
          throw new Error(
            context.reason ?? '다른 담당자의 정비가 진행 중입니다.'
          )
        return { id: active.id, task_no: active.taskNo, existing: true }
      }
      if (!context.canCreate)
        throw new Error(context.reason ?? '정비를 등록할 수 없습니다.')
      if (p.expectedUpdatedAt !== context.incident.updatedAt)
        throw new Error(
          '고장 내용이나 배정이 변경되었습니다. 접수 내용을 다시 불러오십시오.'
        )
      const task = createMaintenance(db, user, {
        title: p.title,
        maintenanceType: '장애정비',
        workKind: p.workKind,
        priority: p.priority,
        department: context.incident.teamName,
        systemId: context.incident.systemId,
        assigneeId: context.incident.maintenanceAssigneeId,
        scheduledDate: p.scheduledDate,
        incidentId: p.incidentId,
        description: p.description,
        checklistTemplateId: p.checklistTemplateId
      })
      db.prepare(
        'INSERT INTO incident_events(id,incident_id,event_type,from_status,to_status,note,actor_id,created_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(
        randomUUID(),
        p.incidentId,
        'MAINTENANCE_REGISTERED',
        row.status,
        row.status,
        `연계 정비 ${task.task_no} 등록`,
        user.id,
        new Date().toISOString(),
        JSON.stringify({ maintenanceId: task.id, taskNo: task.task_no })
      )
      return { ...task, existing: false }
    })
    .immediate()
}
