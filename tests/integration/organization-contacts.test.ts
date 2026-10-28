import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { organizationCatalog } from '../../src/main/database/organizationCatalog'
import { assignIncidentTeam } from '../../src/main/services/IncidentAssignmentService'
import { saveActionDepartment } from '../../src/main/services/OrganizationService'
import type { PublicUser } from '../../src/shared/contracts'
let db: Database.Database, admin: PublicUser
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  migrate(db)
  seed(db)
  admin = db
    .prepare("SELECT * FROM users WHERE username='demo_admin'")
    .get() as PublicUser
})
afterEach(() => db.close())
describe('fictional unit contacts', () => {
  it('creates ten contacts per unit, including parents with unregistered departments', () => {
    const counts = db
      .prepare(
        'SELECT unit_id,count(*) n FROM organization_members GROUP BY unit_id'
      )
      .all() as { unit_id: string; n: number }[]
    expect(counts).toHaveLength(organizationCatalog.length)
    expect(counts.every((row) => row.n === 10)).toBe(true)
    expect(db.prepare('SELECT count(DISTINCT u.display_name) n FROM organization_members m JOIN users u ON u.id=m.user_id').get()).toEqual({n:220})
    expect(
      db.prepare('SELECT count(*) n FROM organization_members').get()
    ).toEqual({ n: 220 })
    expect(
      db
        .prepare(
          "SELECT count(*) n FROM organization_members m JOIN users u ON u.id=m.user_id WHERE u.password_hash='' AND u.password_salt='' AND u.role='MAINTAINER' AND u.service_no IS NULL"
        )
        .get()
    ).toEqual({ n: 220 })
    expect(
      db
        .prepare(
          "SELECT count(*) n FROM organization_members WHERE unit_id='B01'"
        )
        .get()
    ).toEqual({ n: 10 })
    expect(
      db
        .prepare(
          "SELECT count(*) n FROM team_organizations WHERE unit_id='B01'"
        )
        .get()
    ).toEqual({ n: 1 })
  })
  it('preserves existing users, names, disabled contacts and assignments through repeat seeding', () => {
    db.prepare(
      "UPDATE users SET display_name='가상 수정 이름',active=0 WHERE id='org-demo-W19-1'"
    ).run()
    const before = db
      .prepare("SELECT * FROM users WHERE username='demo_admin'")
      .get()
    seed(db)
    seed(db)
    expect(
      db
        .prepare(
          "SELECT display_name,active FROM users WHERE id='org-demo-W19-1'"
        )
        .get()
    ).toEqual({ display_name: '가상 수정 이름', active: 0 })
    expect(
      db.prepare('SELECT count(*) n FROM organization_members').get()
    ).toEqual({ n: 220 })
    expect(
      db.prepare("SELECT * FROM users WHERE username='demo_admin'").get()
    ).toEqual(before)
    expect(db.pragma('foreign_key_check')).toEqual([])
  })
  it('assigns a same-unit contact, rejects another unit and preserves requesting department', () => {
    const row = db
      .prepare('SELECT id,department FROM incidents LIMIT 1')
      .get() as { id: string; department: string }
    assignIncidentTeam(db, admin, {
      id: row.id,
      teamId: 'department-W19-ict',
      userId: 'org-demo-W19-2'
    })
    expect(() =>
      assignIncidentTeam(db, admin, {
        id: row.id,
        teamId: 'department-W19-ict',
        userId: 'org-demo-W20-2'
      })
    ).toThrow('소속 부대')
    expect(
      db
        .prepare('SELECT assigned_to,department FROM incidents WHERE id=?')
        .get(row.id)
    ).toEqual({ assigned_to: 'org-demo-W19-2', department: row.department })
  })
  it('adds ten fictional contacts to a newly registered unit without inventing more departments', () => {
    saveActionDepartment(db, admin, {
      unitName: '가상 시험 비행단',
      unitLevel: 'WING',
      departmentName: '가상 통신부서'
    })
    const unit = db
      .prepare(
        "SELECT id FROM organization_units WHERE name='가상 시험 비행단'"
      )
      .get() as { id: string }
    expect(
      db
        .prepare('SELECT count(*) n FROM organization_members WHERE unit_id=?')
        .get(unit.id)
    ).toEqual({ n: 10 })
    seed(db)
    expect(
      db.prepare('SELECT count(*) n FROM organization_members').get()
    ).toEqual({ n: 230 })
  })
})
