import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { PublicUser } from '../../shared/contracts'
import type {
  NotificationInbox,
  UserNotification
} from '../../shared/notifications'

export function retireIncidentNotifications(
  db: Database.Database,
  incidentId: string,
  date: string
): void {
  db.prepare(
    "UPDATE user_notifications SET superseded_at=? WHERE entity_id=? AND kind='INCIDENT_ASSIGNED' AND superseded_at IS NULL"
  ).run(date, incidentId)
}

export function notifyIncidentAssignment(
  db: Database.Database,
  incident: { id: string; ticketNo: string; title: string },
  assigneeId: string | null,
  departmentName: string | null,
  actorName: string,
  date: string
): void {
  // Older assignment alerts remain in history, but do not alert a former assignee.
  retireIncidentNotifications(db, incident.id, date)
  if (!assigneeId) return
  db.prepare(
    'INSERT INTO user_notifications(id,user_id,kind,title,body,entity_id,created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(
    randomUUID(),
    assigneeId,
    'INCIDENT_ASSIGNED',
    '담당 고장이 배정되었습니다',
    `${incident.ticketNo} · ${incident.title}\n조치부서: ${departmentName ?? '미지정'} · 배정자: ${actorName}`,
    incident.id,
    date
  )
}

export function notificationInbox(
  db: Database.Database,
  user: PublicUser
): NotificationInbox {
  return {
    items: db
      .prepare(
        'SELECT id,kind,title,body,entity_id,created_at,read_at,superseded_at FROM user_notifications WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100'
      )
      .all(user.id) as UserNotification[],
    unreadCount: (
      db
        .prepare(
          'SELECT count(*) n FROM user_notifications WHERE user_id=? AND read_at IS NULL AND superseded_at IS NULL'
        )
        .get(user.id) as { n: number }
    ).n
  }
}

export function readUserNotification(
  db: Database.Database,
  user: PublicUser,
  id: string
): boolean {
  if (
    !db
      .prepare('SELECT id FROM user_notifications WHERE id=? AND user_id=?')
      .get(id, user.id)
  )
    throw new Error('알림을 찾을 수 없거나 읽을 권한이 없습니다.')
  db.prepare(
    'UPDATE user_notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?'
  ).run(new Date().toISOString(), id, user.id)
  return true
}

export function readAllUserNotifications(
  db: Database.Database,
  user: PublicUser
): boolean {
  db.prepare(
    'UPDATE user_notifications SET read_at=COALESCE(read_at,?) WHERE user_id=? AND read_at IS NULL'
  ).run(new Date().toISOString(), user.id)
  return true
}
