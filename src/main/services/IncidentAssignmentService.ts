import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { PublicUser } from '../../shared/contracts'
import { schemas } from '../../shared/contracts'
import { assertOrganizationAssignee } from '../database/organizationContacts'

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
    const team = p.teamId
      ? (db
          .prepare('SELECT * FROM maintenance_teams WHERE id=? AND available=1')
          .get(p.teamId) as { name: string } | undefined)
      : undefined
    if (p.teamId && !team) throw new Error('가용 조치부서를 찾을 수 없습니다.')
    if (
      p.userId &&
      !db
        .prepare(
          "SELECT id FROM users WHERE id=? AND active=1 AND role IN ('ADMIN','OPERATOR','MAINTAINER')"
        )
        .get(p.userId)
    )
      throw new Error('유효한 조치 담당자를 선택하십시오.')
    const date = new Date().toISOString()
    const nextStatus =
      team && before.status === 'TRIAGED'
        ? 'ASSIGNED'
        : !team && before.status === 'ASSIGNED'
          ? 'TRIAGED'
          : before.status
    const assignee = p.userId === undefined ? before.assigned_to : p.userId
    assertOrganizationAssignee(db,p.teamId,assignee as string|null)
    // department always represents the requesting department; assignment must never overwrite it.
    db.prepare(
      'UPDATE incidents SET team_id=?,assigned_to=?,assigned_at=?,status=?,updated_at=? WHERE id=?'
    ).run(
      p.teamId,
      assignee ?? null,
      team || assignee ? date : null,
      nextStatus,
      date,
      p.id
    )
    db.prepare(
      'INSERT INTO incident_events (id,incident_id,event_type,from_status,to_status,note,actor_id,created_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(
      randomUUID(),
      p.id,
      team ? 'TEAM_ASSIGNED' : 'TEAM_UNASSIGNED',
      before.status,
      nextStatus,
      p.note ?? (team ? `${team.name} 지정` : '조치부서 미지정'),
      user.id,
      date,
      JSON.stringify({ teamId: p.teamId, userId: assignee ?? null })
    )
    db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)').run(
      randomUUID(),
      user.id,
      team ? 'ASSIGN_TEAM' : 'UNASSIGN_TEAM',
      'incidents',
      p.id,
      JSON.stringify(before),
      JSON.stringify({ teamId: p.teamId, userId: assignee ?? null }),
      date
    )
    return true
  })()
}
