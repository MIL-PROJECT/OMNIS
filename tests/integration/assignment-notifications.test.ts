import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { migrate, SCHEMA_VERSION } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { assignIncidentTeam } from '../../src/main/services/IncidentAssignmentService'
import {
  notificationInbox,
  readAllUserNotifications,
  readUserNotification,
  retireIncidentNotifications
} from '../../src/main/services/NotificationService'
import type { PublicUser } from '../../src/shared/contracts'

let db: Database.Database,
  admin: PublicUser,
  first: PublicUser,
  second: PublicUser,
  id: string,
  teamId: string
const assign = (userId = first.id, department = teamId) =>
  assignIncidentTeam(db, admin, { id, teamId: department, userId })
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  migrate(db)
  seed(db)
  const user = (name: string) =>
    db.prepare('SELECT * FROM users WHERE username=?').get(name) as PublicUser
  admin = user('demo_admin')
  first = user('demo_4')
  second = user('demo_5')
  id = (db.prepare('SELECT id FROM incidents LIMIT 1').get() as { id: string })
    .id
  teamId = (
    db
      .prepare("SELECT id FROM maintenance_teams WHERE code='TEAM-WIRE'")
      .get() as { id: string }
  ).id
  db.prepare(
    "UPDATE incidents SET status='TRIAGED',team_id=NULL,assigned_to=NULL,started_at=NULL WHERE id=?"
  ).run(id)
})
afterEach(() => db.close())

describe('private persisted assignment notifications', () => {
  it('persists an alert for the assignee only and protects individual read state', () => {
    assign()
    const inbox = notificationInbox(db, first),
      notice = inbox.items[0]
    expect(inbox.unreadCount).toBe(1)
    expect(notice.body).toContain('유선정비반')
    expect(notice.entity_id).toBe(id)
    expect(notificationInbox(db, admin)).toEqual({ items: [], unreadCount: 0 })
    expect(notificationInbox(db, second)).toEqual({ items: [], unreadCount: 0 })
    expect(() => readUserNotification(db, second, notice.id)).toThrow('권한')
    expect(notificationInbox(db, first).unreadCount).toBe(1)
    readUserNotification(db, first, notice.id)
    const readAt = notificationInbox(db, first).items[0].read_at
    expect(readAt).toBeTruthy()
    expect(notificationInbox(db, first).unreadCount).toBe(0)
    readUserNotification(db, first, notice.id)
    expect(notificationInbox(db, first).items[0].read_at).toBe(readAt)
  })
  it('does not notify for repeated saves or resuming unchanged assignment', () => {
    assign()
    assign()
    db.prepare("UPDATE incidents SET status='ON_HOLD' WHERE id=?").run(id)
    assignIncidentTeam(db, admin, {
      id,
      teamId,
      userId: first.id,
      resume: true
    })
    expect(notificationInbox(db, first).items).toHaveLength(1)
  })
  it('alerts again when the same person’s department changes, superseding the earlier message', () => {
    assign()
    const radio = (
      db
        .prepare("SELECT id FROM maintenance_teams WHERE code='TEAM-RADIO'")
        .get() as { id: string }
    ).id
    assign(first.id, radio)
    const inbox = notificationInbox(db, first)
    expect(inbox.items).toHaveLength(2)
    expect(inbox.unreadCount).toBe(1)
    expect(inbox.items[0].body).toContain('무선정비반')
    expect(inbox.items[1].superseded_at).toBeTruthy()
  })
  it('retires old-owner alerts on reassignment and unassignment without deleting history', () => {
    assign()
    assign(second.id)
    expect(notificationInbox(db, first).unreadCount).toBe(0)
    expect(notificationInbox(db, first).items[0].superseded_at).toBeTruthy()
    expect(notificationInbox(db, second).unreadCount).toBe(1)
    assignIncidentTeam(db, admin, { id, teamId: null, userId: null })
    expect(notificationInbox(db, second).unreadCount).toBe(0)
    expect(notificationInbox(db, second).items).toHaveLength(1)
  })
  it('notifies when a legacy prefilled assignment is first confirmed after triage', () => {
    db.prepare('UPDATE incidents SET team_id=?,assigned_to=? WHERE id=?').run(
      teamId,
      first.id,
      id
    )
    assign()
    expect(notificationInbox(db, first).unreadCount).toBe(1)
  })
  it('rolls back assignment and history if the notification cannot be saved', () => {
    const before = db.prepare('SELECT * FROM incidents WHERE id=?').get(id)
    const count = db
      .prepare('SELECT count(*) n FROM incident_events WHERE incident_id=?')
      .get(id)
    db.exec(
      "CREATE TRIGGER fail_notice BEFORE INSERT ON user_notifications BEGIN SELECT RAISE(ABORT,'notice failed'); END"
    )
    expect(() => assign()).toThrow('notice failed')
    expect(db.prepare('SELECT * FROM incidents WHERE id=?').get(id)).toEqual(
      before
    )
    expect(
      db
        .prepare('SELECT count(*) n FROM incident_events WHERE incident_id=?')
        .get(id)
    ).toEqual(count)
  })
  it('counts all unread notifications beyond the displayed 100 and marks only this account’s rows', () => {
    const insert = db.prepare(
      'INSERT INTO user_notifications(id,user_id,kind,title,body,entity_id,created_at) VALUES (?,?,?,?,?,?,?)'
    )
    db.transaction(() => {
      for (let i = 0; i < 105; i++)
        insert.run(
          randomUUID(),
          first.id,
          'INCIDENT_ASSIGNED',
          '배정 알림',
          '가상 배정',
          id,
          new Date().toISOString()
        )
      insert.run(
        randomUUID(),
        second.id,
        'INCIDENT_ASSIGNED',
        '다른 계정',
        '가상',
        id,
        new Date().toISOString()
      )
    })()
    expect(notificationInbox(db, first).items).toHaveLength(100)
    expect(notificationInbox(db, first).unreadCount).toBe(105)
    readAllUserNotifications(db, first)
    expect(notificationInbox(db, first).unreadCount).toBe(0)
    expect(notificationInbox(db, second).unreadCount).toBe(1)
  })
  it('retires unread assignment alerts when a fault is closed or canceled', () => {
    assign()
    retireIncidentNotifications(db, id, new Date().toISOString())
    expect(notificationInbox(db, first).unreadCount).toBe(0)
    expect(notificationInbox(db, first).items).toHaveLength(1)
    expect(notificationInbox(db, first).items[0].superseded_at).toBeTruthy()
  })
  it('migrates v9 without changing business data or old shared notifications', () => {
    db.exec('DROP TABLE user_notifications;PRAGMA user_version=9')
    const incidents = db.prepare('SELECT * FROM incidents ORDER BY id').all(),
      shared = db.prepare('SELECT * FROM notifications ORDER BY id').all()
    migrate(db)
    migrate(db)
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    expect(db.prepare('SELECT * FROM incidents ORDER BY id').all()).toEqual(
      incidents
    )
    expect(db.prepare('SELECT * FROM notifications ORDER BY id').all()).toEqual(
      shared
    )
    expect(notificationInbox(db, first)).toEqual({ items: [], unreadCount: 0 })
    expect(db.pragma('foreign_key_check')).toEqual([])
  })
})
