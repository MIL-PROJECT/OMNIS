import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { assertTransition, incidentTransitions, maintenanceTransitions } from '../../src/main/services/Workflow'
import { triageIncident } from '../../src/main/ai/LocalRuleProvider'
import { DashboardRepository } from '../../src/main/repositories/DashboardRepository'

describe('offline database', () => {
  it('migrates and seeds the required demo workload', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    migrate(db); seed(db); seed(db)
    const count = (table: string) => (db.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n
    expect(count('users')).toBe(11)
    expect(db.prepare("SELECT role FROM users WHERE username='demo_user'").get()).toEqual({ role: 'USER' })
    expect(count('communication_systems')).toBe(38)
    expect(count('incidents')).toBe(52)
    expect(count('maintenance_tasks')).toBe(42)
    expect(count('duty_roster')).toBe(28)
    expect(count('directives')).toBe(8)
    const dashboard = new DashboardRepository(db).summary()
    expect(dashboard.systemCount).toBe(38)
    expect(dashboard.normalCount).toBe(35)
    expect(dashboard.urgentCount).toBe(5)
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    db.close()
  })
  it('adds the USER demo account to a database seeded before it existed', () => {
    const db = new Database(':memory:')
    migrate(db); seed(db)
    db.prepare("DELETE FROM users WHERE username='demo_user'").run()
    seed(db)
    expect(db.prepare("SELECT count(*) n FROM users WHERE username='demo_user' AND role='USER' AND active=1").get()).toEqual({ n: 1 })
    db.close()
  })
  it('rejects invalid workflow changes', () => {
    expect(() => assertTransition(incidentTransitions, 'RECEIVED', 'CLOSED')).toThrow()
    expect(() => assertTransition(incidentTransitions, 'RECEIVED', 'TRIAGED')).not.toThrow()
    expect(() => assertTransition(maintenanceTransitions, 'COMPLETED', 'IN_PROGRESS')).toThrow()
  })
  it('provides an offline triage result', () => {
    expect(triageIncident('무선 통신 장애', '회선 중단').priority).toBe('URGENT')
    expect(triageIncident('무선 통신 장애', '회선 중단').category).toBe('무선/위성')
  })
})
