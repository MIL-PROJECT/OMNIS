import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { PublicUser } from '../../shared/contracts'
import { organizationSchemas } from '../../shared/organization'
import { seedOrganizationContacts } from '../database/organizationContacts'

export function listActionDepartments(db: Database.Database): unknown[] {
  return db
    .prepare(
      `SELECT t.*,o.unit_id,o.department_name,o.source_url,o.source_date,o.provenance,o.note,
    u.name unit_name,u.unit_level,
    (SELECT GROUP_CONCAT(us.display_name, ', ') FROM team_members tm JOIN users us ON us.id=tm.user_id WHERE tm.team_id=t.id AND tm.available=1) member_names,
    (SELECT count(*) FROM incidents i WHERE i.team_id=t.id AND i.status NOT IN ('CLOSED','CANCELED')) active_count
    FROM maintenance_teams t LEFT JOIN team_organizations o ON o.team_id=t.id LEFT JOIN organization_units u ON u.id=o.unit_id
    ORDER BY t.display_order,t.name`
    )
    .all()
}

export function saveActionDepartment(
  db: Database.Database,
  user: PublicUser,
  input: unknown
): { id: string } {
  if (user.role !== 'ADMIN')
    throw new Error('관리자만 조치부서를 변경할 수 있습니다.')
  const p = organizationSchemas['organizations:saveDepartment'].parse(input)
  return db.transaction(() => {
    const date = new Date().toISOString()
    const before = p.id
      ? db
          .prepare(
            'SELECT t.*,o.unit_id FROM maintenance_teams t JOIN team_organizations o ON o.team_id=t.id WHERE t.id=?'
          )
          .get(p.id)
      : undefined
    if (p.id && !before)
      throw new Error('등록된 조직별 조치부서를 찾을 수 없습니다.')
    let unit = p.unitId
      ? (db
          .prepare('SELECT * FROM organization_units WHERE id=?')
          .get(p.unitId) as
          { id: string; name: string; unit_level: string } | undefined)
      : (db
          .prepare('SELECT * FROM organization_units WHERE name=?')
          .get(p.unitName) as
          { id: string; name: string; unit_level: string } | undefined)
    if (p.unitId && !unit) throw new Error('부대를 찾을 수 없습니다.')
    if (unit && (unit.name !== p.unitName || unit.unit_level !== p.unitLevel))
      throw new Error('선택한 부대명·급 구분이 다릅니다.')
    if (!unit) {
      const id = randomUUID()
      db.prepare(
        'INSERT INTO organization_units (id,name,unit_level,source_url,source_date,created_at) VALUES (?,?,?,?,?,?)'
      ).run(
        id,
        p.unitName,
        p.unitLevel,
        p.sourceUrl ?? '',
        p.sourceDate ?? null,
        date
      )
      unit = { id, name: p.unitName, unit_level: p.unitLevel }
    }
    const duplicate = db
      .prepare(
        'SELECT team_id FROM team_organizations WHERE unit_id=? AND department_name=? AND team_id<>?'
      )
      .get(unit.id, p.departmentName, p.id ?? '')
    if (duplicate)
      throw new Error('같은 부대에 동일한 조치부서가 등록되어 있습니다.')
    const id = p.id ?? randomUUID(),
      name =
        p.departmentName === p.unitName
          ? p.unitName
          : `${p.unitName} · ${p.departmentName}`
    if (p.id)
      db.prepare(
        'UPDATE maintenance_teams SET name=?,available=?,updated_at=? WHERE id=?'
      ).run(name, p.available ? 1 : 0, date, id)
    else
      db.prepare(
        `INSERT INTO maintenance_teams (id,code,name,specialties,system_categories,available,average_resolution_minutes,display_order,created_at,updated_at) VALUES (?,?,?,?,?,?,120,1000,?,?)`
      ).run(
        id,
        `LOCAL-${id}`,
        name,
        '정보통신 운용·정비',
        '',
        p.available ? 1 : 0,
        date,
        date
      )
    db.prepare(
      `INSERT INTO team_organizations (team_id,unit_id,department_name,source_url,source_date,provenance,note) VALUES (?,?,?,?,?,'LOCAL',?)
      ON CONFLICT(team_id) DO UPDATE SET unit_id=excluded.unit_id,department_name=excluded.department_name,source_url=excluded.source_url,source_date=excluded.source_date,provenance='LOCAL',note=excluded.note`
    ).run(
      id,
      unit.id,
      p.departmentName,
      p.sourceUrl ?? null,
      p.sourceDate ?? null,
      p.note
    )
    db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)').run(
      randomUUID(),
      user.id,
      p.id ? 'UPDATE' : 'CREATE',
      'action_department',
      id,
      before ? JSON.stringify(before) : null,
      JSON.stringify(p),
      date
    )
    seedOrganizationContacts(db)
    return { id }
  })()
}
