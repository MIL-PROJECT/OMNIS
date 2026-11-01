import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrate } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { DashboardRepository } from '../../src/main/repositories/DashboardRepository'
import type { PublicUser } from '../../src/shared/contracts'

describe('dashboard incident visibility', () => {
  let db: Database.Database
  let repo: DashboardRepository
  let reporter: Pick<PublicUser, 'id' | 'role'>
  let ownIds: string[]

  beforeAll(() => {
    db = new Database(':memory:')
    migrate(db)
    seed(db)
    repo = new DashboardRepository(db)
    const user = db.prepare("SELECT id FROM users WHERE username='demo_user'").get() as { id: string }
    const other = db.prepare("SELECT id FROM users WHERE username='demo_1'").get() as { id: string }
    reporter = { id: user.id, role: 'USER' }
    const ids = (db.prepare('SELECT id FROM incidents ORDER BY id').all() as { id: string }[]).map(row => row.id)
    db.prepare("UPDATE incidents SET reported_by=?,status='CANCELED',reported_at='2000-01-01T00:00:00.000Z',resolved_at=NULL,closed_at=NULL,sla_due_at=NULL").run(other.id)
    const now = new Date().toISOString()
    const overdue = new Date(Date.now() - 60_000).toISOString()
    const risk = new Date(Date.now() + 30 * 60_000).toISOString()
    const update = db.prepare('UPDATE incidents SET reported_by=?,severity=?,status=?,reported_at=?,resolved_at=?,closed_at=?,sla_due_at=? WHERE id=?')
    update.run(other.id, 'URGENT', 'RECEIVED', now, null, null, overdue, ids[0])
    update.run(other.id, 'URGENT', 'RECEIVED', now, null, null, risk, ids[1])
    update.run(user.id, 'NORMAL', 'RECEIVED', now, null, null, overdue, ids[2])
    update.run(user.id, 'URGENT', 'RECEIVED', now, null, null, risk, ids[3])
    update.run(user.id, 'URGENT', 'CLOSED', now, now, now, overdue, ids[4])
    // This owned record falls outside the global recent-30 limit, but must remain visible to its reporter.
    update.run(user.id, 'URGENT', 'CANCELED', '1999-01-01T00:00:00.000Z', null, null, overdue, ids[5])
    ownIds = ids.slice(2, 6)
  })

  afterAll(() => db.close())

  it('returns zero counts and no incident rows for a USER with no reports', () => {
    const result = repo.summary({ id: 'no-reports', role: 'USER' })
    for (const key of ['urgentCount', 'incidentCount', 'todayReceived', 'todayCompleted', 'slaOverdueCount', 'slaRiskCount']) {
      expect(result[key], key).toBe(0)
    }
    expect(result.recentIncidents).toEqual([])
    expect(result.urgentIncidents).toEqual([])
  })

  it('scopes all incident counts and rows to the USER before applying the recent-row limit', () => {
    const result = repo.summary(reporter)
    expect(result).toMatchObject({ urgentCount: 1, incidentCount: 2, todayReceived: 3, todayCompleted: 1, slaOverdueCount: 1, slaRiskCount: 1 })
    const recent = result.recentIncidents as { id: string; reported_by: string }[]
    expect(recent.map(row => row.id).sort()).toEqual([...ownIds].sort())
    expect(recent.every(row => row.reported_by === reporter.id)).toBe(true)
    expect((result.urgentIncidents as { id: string }[]).map(row => row.id)).toEqual([ownIds[1]])
  })

  it.each(['ADMIN', 'OPERATOR', 'MAINTAINER', 'VIEWER'] as const)('keeps the existing global incident view for %s', role => {
    expect(repo.summary({ id: reporter.id, role })).toMatchObject({
      urgentCount: 3, incidentCount: 4, todayReceived: 5, todayCompleted: 1, slaOverdueCount: 2, slaRiskCount: 2
    })
  })
})
