import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { assignIncidentTeam } from '../../src/main/services/IncidentAssignmentService'
import {
  createMaintenanceFromIncident,
  incidentMaintenanceCandidates,
  incidentMaintenanceContext
} from '../../src/main/services/IncidentMaintenanceService'
import { createMaintenance } from '../../src/main/services/UsabilityService'
import type { PublicUser } from '../../src/shared/contracts'
import { koreaDate } from '../../src/shared/date'

let db: Database.Database,
  admin: PublicUser,
  maintainer: PublicUser,
  other: PublicUser,
  reporter: PublicUser,
  id: string,
  teamId: string
const context = (user = maintainer) => incidentMaintenanceContext(db, user, id)
const input = () => ({
  incidentId: id,
  title: '가상 고장 연계 정비',
  scheduledDate: koreaDate(),
  priority: 'HIGH',
  description: '접수 내용에서 불러온 정비',
  expectedUpdatedAt: context().incident.updatedAt,
  checklistTemplateId: 'check-general'
})
const count = () =>
  (
    db
      .prepare('SELECT count(*) n FROM maintenance_tasks WHERE incident_id=?')
      .get(id) as { n: number }
  ).n
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  migrate(db)
  seed(db)
  const user = (name: string) =>
    db.prepare('SELECT * FROM users WHERE username=?').get(name) as PublicUser
  admin = user('demo_admin')
  maintainer = user('demo_4')
  other = user('demo_5')
  reporter = user('demo_user')
  id = (db.prepare('SELECT id FROM incidents LIMIT 1').get() as { id: string })
    .id
  teamId = (
    db
      .prepare("SELECT id FROM maintenance_teams WHERE code='TEAM-WIRE'")
      .get() as { id: string }
  ).id
  db.prepare(
    "UPDATE incidents SET status='TRIAGED',team_id=NULL,assigned_to=NULL,department='원래 요청부서',reported_by=? WHERE id=?"
  ).run(reporter.id, id)
  assignIncidentTeam(db, admin, { id, teamId, userId: maintainer.id })
})
afterEach(() => db.close())

describe('incident to maintenance registration', () => {
  it('copies the confirmed source and owner, creates an unplanned repair and records the link', () => {
    const initial = context()
    const result = createMaintenanceFromIncident(db, maintainer, {
      ...input(),
      assigneeId: other.id,
      department: '위조 부서',
      systemId: 'forged'
    })
    expect(result.existing).toBe(false)
    expect(
      db.prepare('SELECT * FROM maintenance_tasks WHERE id=?').get(result.id)
    ).toMatchObject({
      incident_id: id,
      assignee_id: maintainer.id,
      department: '유선정비반',
      system_id: initial.incident.systemId,
      work_kind: 'UNPLANNED',
      maintenance_type: '장애정비',
      status: 'PLANNED',
      priority: 'HIGH'
    })
    expect(
      db.prepare('SELECT status,department FROM incidents WHERE id=?').get(id)
    ).toEqual({ status: 'ASSIGNED', department: '원래 요청부서' })
    expect(
      db
        .prepare(
          "SELECT metadata_json,from_status,to_status FROM incident_events WHERE incident_id=? AND event_type='MAINTENANCE_REGISTERED'"
        )
        .get(id)
    ).toMatchObject({
      from_status: 'ASSIGNED',
      to_status: 'ASSIGNED',
      metadata_json: JSON.stringify({
        maintenanceId: result.id,
        taskNo: result.task_no
      })
    })
    expect(context().tasks[0]).toMatchObject({ id: result.id, canOpen: true })
    expect(context().canCreate).toBe(false)
  })
  it('returns the existing active task on repeated registration instead of creating duplicates', () => {
    const p = input(),
      first = createMaintenanceFromIncident(db, maintainer, p),
      again = createMaintenanceFromIncident(db, maintainer, p)
    expect(again).toEqual({ ...first, existing: true })
    expect(count()).toBe(1)
    expect(
      db
        .prepare(
          "SELECT count(*) n FROM incident_events WHERE incident_id=? AND event_type='MAINTENANCE_REGISTERED'"
        )
        .get(id)
    ).toEqual({ n: 1 })
  })
  it.each([
    ['EMERGENCY', '긴급'],
    ['FIELD', '야전'],
    ['DEPOT', '창']
  ])('keeps the selected %s kind and confirmed assignment when registering from a fault', (workKind, label) => {
    const result = createMaintenanceFromIncident(db, maintainer, { ...input(), workKind })
    expect(db.prepare('SELECT work_kind,assignee_id,status FROM maintenance_tasks WHERE id=?').get(result.id)).toEqual({
      work_kind: workKind, assignee_id: maintainer.id, status: 'PLANNED'
    })
    expect(db.prepare('SELECT note FROM maintenance_events WHERE task_id=?').get(result.id)).toEqual({ note: `${label} 작업 등록` })
    // Retrying with a different selection must not create or silently reclassify an active task.
    const retry = createMaintenanceFromIncident(db, maintainer, { ...input(), workKind: 'PLANNED' })
    expect(retry.id).toBe(result.id)
    expect(retry.existing).toBe(true)
    expect(db.prepare('SELECT work_kind FROM maintenance_tasks WHERE id=?').get(result.id)).toEqual({ work_kind: workKind })
  })
  it('limits the maintainer queue and both registration paths to the assigned person', () => {
    expect(
      incidentMaintenanceCandidates(db, maintainer).some(
        (c) => c.incident.id === id
      )
    ).toBe(true)
    expect(
      incidentMaintenanceCandidates(db, other).some((c) => c.incident.id === id)
    ).toBe(false)
    expect(() => createMaintenanceFromIncident(db, other, input())).toThrow(
      '본인에게 배정'
    )
    expect(() =>
      createMaintenance(db, other, {
        title: '우회 등록 시험',
        maintenanceType: '장애정비',
        priority: 'NORMAL',
        department: '가상',
        scheduledDate: koreaDate(),
        incidentId: id
      })
    ).toThrow('본인에게 배정')
    expect(count()).toBe(0)
  })
  it.each(['USER', 'OPERATOR', 'VIEWER'] as const)(
    'rejects %s creating or listing repair registrations',
    (role) => {
      const user = { ...maintainer, role }
      expect(() => createMaintenanceFromIncident(db, user, input())).toThrow(
        '권한'
      )
      expect(() => incidentMaintenanceCandidates(db, user)).toThrow('권한')
    }
  )
  it('requires assignment and an active work phase, preserving prior workflow rules', () => {
    for (const status of [
      'RECEIVED',
      'TRIAGED',
      'ON_HOLD',
      'RESOLVED',
      'VERIFIED',
      'CLOSED',
      'CANCELED'
    ]) {
      db.prepare('UPDATE incidents SET status=? WHERE id=?').run(status, id)
      expect(context().canCreate).toBe(false)
      expect(() =>
        createMaintenanceFromIncident(db, maintainer, input())
      ).toThrow('배정 후')
    }
    expect(count()).toBe(0)
  })
  it('rejects changed source or reassignment after the form was opened', () => {
    const stale = input()
    db.prepare("UPDATE incidents SET updated_at='changed' WHERE id=?").run(id)
    expect(() => createMaintenanceFromIncident(db, maintainer, stale)).toThrow(
      '다시 불러'
    )
    assignIncidentTeam(db, admin, { id, teamId, userId: other.id })
    expect(() => createMaintenanceFromIncident(db, maintainer, stale)).toThrow(
      '본인에게 배정'
    )
    expect(count()).toBe(0)
  })
  it('blocks new work if the confirmed department or person is no longer eligible', () => {
    db.prepare('UPDATE maintenance_teams SET available=0 WHERE id=?').run(
      teamId
    )
    expect(context().canCreate).toBe(false)
    expect(() =>
      createMaintenanceFromIncident(db, maintainer, input())
    ).toThrow('가용')
    db.prepare('UPDATE maintenance_teams SET available=1 WHERE id=?').run(
      teamId
    )
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(maintainer.id)
    expect(context(admin).canCreate).toBe(false)
    expect(() => createMaintenanceFromIncident(db, admin, input())).toThrow(
      '유효한'
    )
    expect(count()).toBe(0)
  })
  it('shows a former owner’s active work without allowing takeover or another quick registration', () => {
    const task = createMaintenanceFromIncident(db, maintainer, input())
    assignIncidentTeam(db, admin, { id, teamId, userId: other.id })
    expect(context(other).tasks[0]).toMatchObject({
      id: task.id,
      canOpen: false
    })
    expect(() =>
      createMaintenanceFromIncident(db, other, {
        ...input(),
        expectedUpdatedAt: context(other).incident.updatedAt
      })
    ).toThrow('진행 중인 정비')
    expect(count()).toBe(1)
  })
  it('allows further work after an earlier task completes while the incident remains active', () => {
    const first = createMaintenanceFromIncident(db, maintainer, input())
    db.prepare(
      "UPDATE maintenance_tasks SET status='COMPLETED' WHERE id=?"
    ).run(first.id)
    expect(context().canCreate).toBe(true)
    expect(createMaintenanceFromIncident(db, maintainer, input()).id).not.toBe(
      first.id
    )
    expect(count()).toBe(2)
  })
  it('lets ADMIN register to the confirmed maintenance assignee and protects reporter access', () => {
    const task = createMaintenanceFromIncident(db, admin, input())
    expect(
      db
        .prepare('SELECT assignee_id FROM maintenance_tasks WHERE id=?')
        .get(task.id)
    ).toEqual({ assignee_id: maintainer.id })
    expect(context(reporter).tasks[0].canOpen).toBe(false)
    expect(() => context({ ...reporter, id: 'other-reporter' })).toThrow(
      '본인이 접수'
    )
  })
  it('rolls back the work, checklist and link if history registration fails', () => {
    db.exec(
      "CREATE TRIGGER fail_link BEFORE INSERT ON incident_events WHEN NEW.event_type='MAINTENANCE_REGISTERED' BEGIN SELECT RAISE(ABORT,'link failed'); END"
    )
    expect(() =>
      createMaintenanceFromIncident(db, maintainer, input())
    ).toThrow('link failed')
    expect(count()).toBe(0)
    expect(db.pragma('foreign_key_check')).toEqual([])
  })
})
