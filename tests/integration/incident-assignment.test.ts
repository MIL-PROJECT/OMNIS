import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import {
  assignIncidentTeam,
  assignIncidentUser,
  assertIncidentAssignment
} from '../../src/main/services/IncidentAssignmentService'
import type { PublicUser } from '../../src/shared/contracts'

let db: Database.Database,
  admin: PublicUser,
  id: string,
  teamId: string,
  userId: string
const row = () =>
  db.prepare('SELECT * FROM incidents WHERE id=?').get(id) as Record<
    string,
    unknown
  >
const events = () =>
  db
    .prepare('SELECT * FROM incident_events WHERE incident_id=? ORDER BY rowid')
    .all(id) as Record<string, unknown>[]
const assign = (patch = {}) =>
  assignIncidentTeam(db, admin, { id, teamId, userId, ...patch })
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  migrate(db)
  seed(db)
  admin = db
    .prepare("SELECT * FROM users WHERE username='demo_admin'")
    .get() as PublicUser
  id = (db.prepare('SELECT id FROM incidents LIMIT 1').get() as { id: string })
    .id
  teamId = (
    db
      .prepare("SELECT id FROM maintenance_teams WHERE code='TEAM-WIRE'")
      .get() as { id: string }
  ).id
  userId = (
    db.prepare("SELECT id FROM users WHERE username='demo_4'").get() as {
      id: string
    }
  ).id
  db.prepare(
    "UPDATE incidents SET status='TRIAGED',team_id=NULL,assigned_to=NULL,assigned_at=NULL,started_at=NULL,department='요청부서',updated_at='original' WHERE id=?"
  ).run(id)
  db.prepare('DELETE FROM incident_events WHERE incident_id=?').run(id)
})
afterEach(() => db.close())

describe('incident assignment is a workflow operation', () => {
  it('requires classification first and rejects both IPC assignment paths without writes', () => {
    db.prepare(
      "UPDATE incidents SET status='RECEIVED',team_id=? WHERE id=?"
    ).run(teamId, id)
    const before = row()
    expect(() => assign()).toThrow('분류를 완료')
    expect(() => assignIncidentUser(db, admin, { id, userId })).toThrow(
      '분류를 완료'
    )
    expect(row()).toEqual(before)
    expect(events()).toEqual([])
  })
  it('requires both department and eligible assignee before confirming', () => {
    expect(() => assign({ userId: null })).toThrow('모두 선택')
    expect(() => assign({ teamId: null })).toThrow('함께 해제')
    const viewer = db
      .prepare("SELECT id FROM users WHERE role='VIEWER' LIMIT 1")
      .get() as { id: string }
    expect(() => assign({ userId: viewer.id })).toThrow('유효한')
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(userId)
    expect(() => assign()).toThrow('유효한')
    expect(row()).toMatchObject({
      status: 'TRIAGED',
      team_id: null,
      assigned_to: null,
      updated_at: 'original'
    })
    expect(events()).toEqual([])
  })
  it('atomically writes department, person, status and one readable transition event', () => {
    assign()
    expect(row()).toMatchObject({
      status: 'ASSIGNED',
      team_id: teamId,
      assigned_to: userId,
      department: '요청부서'
    })
    expect(row().assigned_at).toBeTruthy()
    expect(events()).toHaveLength(1)
    expect(events()[0]).toMatchObject({
      event_type: 'TEAM_ASSIGNED',
      from_status: 'TRIAGED',
      to_status: 'ASSIGNED'
    })
    expect(events()[0].note).toContain('유선정비반')
    expect(events()[0].note).toContain('정지원')
    const first = row()
    assign() // Repeated save must not invent another event or change assignment time.
    expect(row()).toEqual(first)
    expect(events()).toHaveLength(1)
  })
  it('preserves processing stage when reassigning and blocks unassignment after work starts', () => {
    assign()
    db.prepare(
      "UPDATE incidents SET status='REMOTE_IN_PROGRESS',started_at='started' WHERE id=?"
    ).run(id)
    assign({ userId: admin.id, note: '교대 근무' })
    expect(row()).toMatchObject({
      status: 'REMOTE_IN_PROGRESS',
      assigned_to: admin.id
    })
    expect(events().at(-1)).toMatchObject({
      event_type: 'ASSIGNMENT_CHANGED',
      from_status: 'REMOTE_IN_PROGRESS',
      to_status: 'REMOTE_IN_PROGRESS'
    })
    const before = row()
    expect(() => assign({ teamId: null, userId: null })).toThrow(
      '해제할 수 없습니다'
    )
    expect(row()).toEqual(before)
  })
  it('allows explicit pre-work unassignment and returns to classification', () => {
    assign()
    assign({ teamId: null, userId: null })
    expect(row()).toMatchObject({
      status: 'TRIAGED',
      team_id: null,
      assigned_to: null,
      assigned_at: null
    })
    expect(events().at(-1)).toMatchObject({
      event_type: 'TEAM_UNASSIGNED',
      from_status: 'ASSIGNED',
      to_status: 'TRIAGED'
    })
  })
  it('distinguishes assignment changes on hold from explicit resumption', () => {
    assign()
    db.prepare("UPDATE incidents SET status='ON_HOLD' WHERE id=?").run(id)
    assign({ userId: admin.id })
    expect(row().status).toBe('ON_HOLD')
    assign({ userId: admin.id, resume: true })
    expect(row().status).toBe('ASSIGNED')
    expect(events().at(-1)).toMatchObject({
      from_status: 'ON_HOLD',
      to_status: 'ASSIGNED'
    })
  })
  it.each(['CLOSED', 'CANCELED'])(
    'rejects assignment changes after %s',
    (status) => {
      db.prepare('UPDATE incidents SET status=? WHERE id=?').run(status, id)
      const before = row()
      expect(() => assign()).toThrow('배정을 변경할 수 없습니다')
      expect(row()).toEqual(before)
      expect(events()).toEqual([])
    }
  )
  it.each(['RESOLVED', 'VERIFIED'])(
    'can repair legacy missing assignment at %s without changing the stage',
    (status) => {
      db.prepare('UPDATE incidents SET status=? WHERE id=?').run(status, id)
      assign()
      expect(row()).toMatchObject({
        status,
        team_id: teamId,
        assigned_to: userId
      })
      expect(events().at(-1)).toMatchObject({
        event_type: 'ASSIGNMENT_CHANGED',
        from_status: status,
        to_status: status
      })
    }
  )
  it.each(['USER', 'MAINTAINER', 'VIEWER'] as const)(
    'rejects %s attempting to assign',
    (role) => {
      expect(() =>
        assignIncidentTeam(db, { ...admin, role }, { id, teamId, userId })
      ).toThrow('권한')
      expect(events()).toEqual([])
    }
  )
  it('allows the operator to confirm assignment', () => {
    assignIncidentTeam(
      db,
      { ...admin, role: 'OPERATOR' },
      { id, teamId, userId }
    )
    expect(row().status).toBe('ASSIGNED')
  })
  it('rejects stale dialog writes and unavailable departments', () => {
    expect(() => assign({ expectedUpdatedAt: 'stale' })).toThrow('다시 열어')
    db.prepare('UPDATE maintenance_teams SET available=0 WHERE id=?').run(
      teamId
    )
    expect(() => assign()).toThrow('가용')
    expect(events()).toEqual([])
  })
  it('rolls back assignment and history together if the event write fails', () => {
    const before = row()
    db.exec(
      "CREATE TRIGGER fail_event BEFORE INSERT ON incident_events BEGIN SELECT RAISE(ABORT,'event failure'); END"
    )
    expect(() => assign()).toThrow('event failure')
    expect(row()).toEqual(before)
    expect(
      db
        .prepare(
          "SELECT count(*) n FROM audit_logs WHERE entity_id=? AND action='ASSIGN_TEAM'"
        )
        .get(id)
    ).toEqual({ n: 0 })
  })
  it('uses the same checks for starting work with legacy incomplete or inactive assignments', () => {
    expect(() => assertIncidentAssignment(db, null, userId)).toThrow(
      '모두 선택'
    )
    expect(() => assertIncidentAssignment(db, teamId, userId)).not.toThrow()
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(userId)
    expect(() => assertIncidentAssignment(db, teamId, userId)).toThrow('유효한')
  })
})
