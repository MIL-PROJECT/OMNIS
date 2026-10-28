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
      if (!entry.department) continue
      const code = `ROKAF-${entry.id}-ICT`,
        id = `department-${entry.id}-ict`
      const name =
        entry.department === entry.name
          ? entry.name
          : `${entry.name} · ${entry.department}`
      db.prepare(
        `INSERT OR IGNORE INTO maintenance_teams (id,code,name,specialties,system_categories,available,average_resolution_minutes,display_order,created_at,updated_at)
        VALUES (?,?,?,?,?,1,120,?,?,?)`
      ).run(id, code, name, '정보통신 운용·정비', '', 100 + i, date, date)
      const team = db
        .prepare('SELECT id FROM maintenance_teams WHERE code=?')
        .get(code) as { id: string }
      db.prepare(
        `INSERT OR IGNORE INTO team_organizations (team_id,unit_id,department_name,source_url,source_date,provenance,note)
        VALUES (?,?,?,?,?,'PUBLIC',?)`
      ).run(
        team.id,
        entry.id,
        entry.department,
        entry.url,
        entry.date,
        '공개자료에 기재된 명칭. 현재 내부 편제의 전수 검증을 의미하지 않습니다.'
      )
    }
  })()
}
