import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrate, SCHEMA_VERSION } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { organizationCatalog } from '../../src/main/database/organizationCatalog'
import { assignIncidentTeam } from '../../src/main/services/IncidentAssignmentService'
import {
  listActionDepartments,
  saveActionDepartment
} from '../../src/main/services/OrganizationService'
import type { PublicUser } from '../../src/shared/contracts'
let db: Database.Database, admin: PublicUser, viewer: PublicUser
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  migrate(db)
  seed(db)
  admin = db
    .prepare("SELECT * FROM users WHERE role='ADMIN' LIMIT 1")
    .get() as PublicUser
  viewer = { ...admin, role: 'VIEWER' }
})
afterEach(() => db.close())
const incident = () =>
  db
    .prepare('SELECT * FROM incidents ORDER BY ticket_no LIMIT 1')
    .get() as Record<string, unknown>
const team = () =>
  db
    .prepare("SELECT id FROM maintenance_teams WHERE code='ROKAF-W19-ICT'")
    .get() as { id: string }
describe('action organization and requesting department separation', () => {
  it('keeps requesting department through assignment, reassignment and unassignment', () => {
    const row = incident()
    db.prepare(
      "UPDATE incidents SET department='가상 요청 부서',team_id=NULL,status='TRIAGED' WHERE id=?"
    ).run(row.id)
    assignIncidentTeam(db, admin, { id: row.id, teamId: team().id })
    expect(incident()).toMatchObject({
      department: '가상 요청 부서',
      team_id: team().id,
      status: 'ASSIGNED'
    })
    const common = db
      .prepare("SELECT id FROM maintenance_teams WHERE code='TEAM-WIRE'")
      .get() as { id: string }
    assignIncidentTeam(db, admin, { id: row.id, teamId: common.id })
    expect(incident().department).toBe('가상 요청 부서')
    assignIncidentTeam(db, admin, { id: row.id, teamId: null, userId: null })
    expect(incident()).toMatchObject({
      department: '가상 요청 부서',
      team_id: null,
      assigned_to: null,
      status: 'TRIAGED'
    })
    expect(
      db
        .prepare(
          "SELECT event_type FROM incident_events WHERE incident_id=? AND event_type='TEAM_UNASSIGNED'"
        )
        .get(row.id)
    ).toBeTruthy()
  })
  it('rejects unavailable or forged departments and unauthorized assignment without changes', () => {
    const row = incident(),
      before = JSON.stringify(row)
    expect(() =>
      assignIncidentTeam(db, viewer, { id: row.id, teamId: team().id })
    ).toThrow('권한')
    expect(() =>
      assignIncidentTeam(db, admin, { id: row.id, teamId: 'fake' })
    ).toThrow('가용')
    db.prepare('UPDATE maintenance_teams SET available=0 WHERE id=?').run(
      team().id
    )
    expect(() =>
      assignIncidentTeam(db, admin, { id: row.id, teamId: team().id })
    ).toThrow('가용')
    expect(JSON.stringify(incident())).toBe(before)
  })
  it('seeds actual names and source metadata without inventing unconfirmed child departments', () => {
    const departments = listActionDepartments(db) as Record<string, unknown>[]
    expect(
      db.prepare('SELECT count(*) n FROM organization_units').get()
    ).toEqual({ n: organizationCatalog.length })
    for (const unit of organizationCatalog) {
      const rows = departments.filter((d) => d.unit_id === unit.id)
      expect(rows).toHaveLength(unit.department ? 1 : 0)
      if (unit.department)
        expect(rows[0]).toMatchObject({
          department_name: unit.department,
          source_url: unit.url,
          provenance: 'PUBLIC'
        })
    }
    expect(departments.find((t) => t.code === 'TEAM-WIRE')).toMatchObject({
      name: '유선정비반',
      unit_id: null
    })
  })
  it('allows ADMIN to register missing department and preserves edits on migration/seed restart', () => {
    const payload = {
      unitId: 'B01',
      unitName: '제1미사일방어여단',
      unitLevel: 'BRIGADE',
      departmentName: '가상 확인 통신부서',
      note: '가상 시험 fixture'
    }
    expect(() => saveActionDepartment(db, viewer, payload)).toThrow('관리자')
    const result = saveActionDepartment(db, admin, payload)
    expect(() => saveActionDepartment(db, admin, payload)).toThrow('동일')
    saveActionDepartment(db, admin, {
      ...payload,
      id: result.id,
      available: false
    })
    migrate(db)
    seed(db)
    seed(db)
    expect(
      (listActionDepartments(db) as Record<string, unknown>[]).find(
        (d) => d.id === result.id
      )
    ).toMatchObject({
      available: 0,
      provenance: 'LOCAL',
      note: '가상 시험 fixture'
    })
    const original = team().id
    saveActionDepartment(db, admin, {
      id: original,
      unitId: 'W19',
      unitName: '제19전투비행단',
      unitLevel: 'WING',
      departmentName: '가상 수정 부서',
      available: false
    })
    seed(db)
    expect(
      (listActionDepartments(db) as Record<string, unknown>[]).find(
        (d) => d.id === original
      )
    ).toMatchObject({
      available: 0,
      department_name: '가상 수정 부서',
      provenance: 'LOCAL'
    })
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
  })
  it('upgrades version 6 additively without changing old requester or assignment data', () => {
    const before = incident()
    db.exec('DROP TABLE organization_members; DROP TABLE team_organizations; DROP TABLE organization_units;')
    db.pragma('user_version=6')
    migrate(db)
    expect(incident()).toEqual(before)
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
  })
})
