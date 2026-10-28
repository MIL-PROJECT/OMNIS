import type Database from 'better-sqlite3'
import { organizationCatalog } from './organizationCatalog'

export function migrateOrganizations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS organization_units (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, unit_level TEXT NOT NULL,
    source_url TEXT NOT NULL DEFAULT '', source_date TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS team_organizations (
    team_id TEXT PRIMARY KEY REFERENCES maintenance_teams(id),
    unit_id TEXT NOT NULL REFERENCES organization_units(id), department_name TEXT NOT NULL,
    source_url TEXT, source_date TEXT, provenance TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '', UNIQUE(unit_id,department_name)
  );`)
}

export function seedOrganizationDirectory(db: Database.Database): void {
  const date = new Date().toISOString()
  db.transaction(() => {
    for (const [i, entry] of organizationCatalog.entries()) {
      db.prepare(
        'INSERT OR IGNORE INTO organization_units (id,name,unit_level,source_url,source_date,created_at) VALUES (?,?,?,?,?,?)'
      ).run(entry.id, entry.name, entry.level, entry.url, entry.date, date)
      if (!entry.department) {
        const previous = db
          .prepare(
            `SELECT o.team_id FROM team_organizations o JOIN maintenance_teams t ON t.id=o.team_id WHERE o.unit_id=? AND o.provenance='DEMO' AND o.department_name='정보통신 업무 담당 (시연)' AND t.code=?`
          )
          .get(entry.id, `ROKAF-${entry.id}-ICT`) as
          { team_id: string } | undefined
        if (
          previous &&
          !db
            .prepare(
              "SELECT team_id FROM team_organizations WHERE unit_id=? AND department_name='정보통신대대'"
            )
            .get(entry.id)
        ) {
          db.prepare(
            "UPDATE team_organizations SET department_name='정보통신대대',note='사용자 지정 시연 명칭: 정보통신대대. 공식 편제 확인과 구분합니다.' WHERE team_id=?"
          ).run(previous.team_id)
          db.prepare(
            'UPDATE maintenance_teams SET name=?,updated_at=? WHERE id=?'
          ).run(`${entry.name} · 정보통신대대`, date, previous.team_id)
        }
        if (
          db
            .prepare(
              "SELECT team_id FROM team_organizations WHERE unit_id=? AND department_name='정보통신대대'"
            )
            .get(entry.id)
        )
          continue
      }
      const department = entry.department ?? '정보통신대대'
      const code = `ROKAF-${entry.id}-ICT`,
        id = `department-${entry.id}-ict`
      const name =
        department === entry.name ? entry.name : `${entry.name} · ${department}`
      db.prepare(
        `INSERT OR IGNORE INTO maintenance_teams (id,code,name,specialties,system_categories,available,average_resolution_minutes,display_order,created_at,updated_at)
        VALUES (?,?,?,?,?,1,120,?,?,?)`
      ).run(id, code, name, '정보통신 운용·정비', '', 100 + i, date, date)
      const team = db
        .prepare('SELECT id FROM maintenance_teams WHERE code=?')
        .get(code) as { id: string }
      db.prepare(
        `INSERT OR IGNORE INTO team_organizations (team_id,unit_id,department_name,source_url,source_date,provenance,note)
        VALUES (?,?,?,?,?,?,?)`
      ).run(
        team.id,
        entry.id,
        department,
        entry.department ? entry.url : null,
        entry.department ? entry.date : null,
        entry.department ? 'PUBLIC' : 'DEMO',
        entry.department
          ? '공개자료에 기재된 명칭. 현재 내부 편제의 전수 검증을 의미하지 않습니다.'
          : '사용자 지정 시연 명칭: 정보통신대대. 공식 편제 확인과 구분합니다.'
      )
    }
  })()
}
