import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { PublicUser } from '../../shared/contracts'
import { schemas } from '../../shared/contracts'
import { incidentAssignmentStatuses } from '../../shared/incidentWorkflow'
import { assertOrganizationAssignee } from '../database/organizationContacts'
import { notifyIncidentAssignment } from './NotificationService'

// Assignment and work-start validation use the same eligibility checks.
export function assertIncidentAssignment(
  db: Database.Database,
  teamId: unknown,
  userId: unknown
) {
  if (!teamId || !userId)
    throw new Error('배정하려면 조치부서와 담당자를 모두 선택하십시오.')
  const team = db
    .prepare('SELECT name FROM maintenance_teams WHERE id=? AND available=1')
    .get(teamId) as { name: string } | undefined
  if (!team) throw new Error('가용 조치부서를 찾을 수 없습니다.')
  const assignee = db
    .prepare(
      "SELECT display_name FROM users WHERE id=? AND active=1 AND role IN ('ADMIN','OPERATOR','MAINTAINER')"
    )
    .get(userId) as { display_name: string } | undefined
  if (!assignee) throw new Error('유효한 조치 담당자를 선택하십시오.')
  assertOrganizationAssignee(db, String(teamId), String(userId))
  return { team, assignee }
}

export function assignIncidentTeam(
  db: Database.Database,
  user: PublicUser,
  input: unknown
): boolean {
  if (!['ADMIN', 'OPERATOR'].includes(user.role))
    throw new Error('권한이 없습니다.')
  const p = schemas['incidents:assignTeam'].parse(input)
  return db.transaction(() => {
    const before = db
      .prepare('SELECT * FROM incidents WHERE id=?')
      .get(p.id) as Record<string, unknown> | undefined
    if (!before) throw new Error('접수 건을 찾을 수 없습니다.')
    if (p.expectedUpdatedAt && p.expectedUpdatedAt !== before.updated_at)
      throw new Error(
        '접수 내용이나 배정이 변경되었습니다. 상세 화면을 다시 열어 주십시오.'
      )
    if (before.status === 'RECEIVED')
      throw new Error('접수 내용을 검토하고 분류를 완료한 뒤 배정하십시오.')
    if (!incidentAssignmentStatuses.has(String(before.status)))
      throw new Error('종결·취소 상태에서는 배정을 변경할 수 없습니다.')
    if (p.resume && before.status !== 'ON_HOLD')
      throw new Error('보류 상태에서만 배정 확인 후 재개할 수 있습니다.')
    const assigneeId = p.userId === undefined ? before.assigned_to : p.userId
    const unassign = p.teamId === null
    if (unassign && assigneeId)
      throw new Error('배정 해제 시 조치부서와 담당자를 함께 해제하십시오.')
    if (
      unassign &&
      (before.started_at ||
        !['TRIAGED', 'ASSIGNED', 'ON_HOLD'].includes(String(before.status)))
    )
      throw new Error(
        '조치를 시작한 고장은 배정을 해제할 수 없습니다. 담당부서·담당자를 변경하십시오.'
      )
    if (unassign && p.resume)
      throw new Error(
        '배정 확인 후 재개하려면 조치부서와 담당자를 선택하십시오.'
      )
    const assignment = unassign
      ? null
      : assertIncidentAssignment(db, p.teamId, assigneeId)
    const nextStatus = unassign
      ? 'TRIAGED'
      : before.status === 'TRIAGED' || p.resume
        ? 'ASSIGNED'
        : before.status
    const sameAssignment =
      (before.team_id ?? null) === p.teamId &&
      (before.assigned_to ?? null) === (assigneeId ?? null)
    if (sameAssignment && nextStatus === before.status) return true
    const date = new Date().toISOString()
    // Requesting department never changes when the action department changes.
    db.prepare(
      'UPDATE incidents SET team_id=?,assigned_to=?,assigned_at=?,status=?,updated_at=? WHERE id=?'
    ).run(
      p.teamId,
      assigneeId ?? null,
      unassign ? null : sameAssignment ? (before.assigned_at ?? date) : date,
      nextStatus,
      date,
      p.id
    )
    const eventType = unassign
      ? 'TEAM_UNASSIGNED'
      : nextStatus !== before.status
        ? 'TEAM_ASSIGNED'
        : 'ASSIGNMENT_CHANGED'
    const description = assignment
      ? `${assignment.team.name} · ${assignment.assignee.display_name} ${p.resume ? '배정 확인 후 재개' : eventType === 'TEAM_ASSIGNED' ? '배정 확정' : '배정 변경'}`
      : '조치부서·담당자 배정 해제 · 분류 단계로 복귀'
    const note = p.note?.trim()
      ? `${description} / ${p.note.trim()}`
      : description
    db.prepare(
      'INSERT INTO incident_events (id,incident_id,event_type,from_status,to_status,note,actor_id,created_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(
      randomUUID(),
      p.id,
      eventType,
      before.status,
      nextStatus,
      note,
      user.id,
      date,
      JSON.stringify({
        teamId: p.teamId,
        userId: assigneeId ?? null,
        previousTeamId: before.team_id,
        previousUserId: before.assigned_to
      })
    )
    db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)').run(
      randomUUID(),
      user.id,
      unassign ? 'UNASSIGN_TEAM' : 'ASSIGN_TEAM',
      'incidents',
      p.id,
      JSON.stringify(before),
      JSON.stringify({
        teamId: p.teamId,
        userId: assigneeId ?? null,
        status: nextStatus
      }),
      date
    )
    if (
      !sameAssignment ||
      (before.status === 'TRIAGED' && nextStatus === 'ASSIGNED')
    )
      notifyIncidentAssignment(
        db,
        {
          id: p.id,
          ticketNo: String(before.ticket_no),
          title: String(before.title)
        },
        unassign ? null : String(assigneeId),
        assignment?.team.name ?? null,
        user.display_name,
        date
      )
    return true
  })()
}

// Retained IPC endpoint for integrations; it follows the same workflow as the UI.
export function assignIncidentUser(
  db: Database.Database,
  user: PublicUser,
  input: unknown
): boolean {
  if (!['ADMIN', 'OPERATOR'].includes(user.role))
    throw new Error('권한이 없습니다.')
  const p = schemas['incidents:assign'].parse(input)
  const row = db
    .prepare('SELECT team_id FROM incidents WHERE id=?')
    .get(p.id) as { team_id: string | null } | undefined
  if (!row) throw new Error('접수 건을 찾을 수 없습니다.')
  return assignIncidentTeam(db, user, {
    id: p.id,
    teamId: row.team_id,
    userId: p.userId,
    expectedUpdatedAt: p.expectedUpdatedAt
  })
}
