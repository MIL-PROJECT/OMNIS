import type Database from 'better-sqlite3'

export function migrateOrganizationContacts(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS organization_members (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    unit_id TEXT NOT NULL REFERENCES organization_units(id),
    demo_slot INTEGER NOT NULL CHECK(demo_slot BETWEEN 1 AND 10),
    is_demo INTEGER NOT NULL DEFAULT 1, UNIQUE(unit_id,demo_slot)
  );`)
}

const surnames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임']
const givenNames = [
  '민준',
  '서준',
  '도윤',
  '예준',
  '시우',
  '하준',
  '지호',
  '수현',
  '지민',
  '서연',
  '하은',
  '지우',
  '서현',
  '민서',
  '윤서',
  '예린',
  '수빈',
  '채원',
  '다은',
  '은우',
  '정우',
  '현우'
]

export function seedOrganizationContacts(db: Database.Database): void {
  const units = db
    .prepare(
      "SELECT id,name FROM organization_units WHERE unit_level IN ('WING','BRIGADE','GROUP') ORDER BY id"
    )
    .all() as { id: string; name: string }[]
  const date = new Date().toISOString()
  db.transaction(() => {
    for (const [index, unit] of units.entries())
      for (let slot = 1; slot <= 10; slot++) {
        if (
          db
            .prepare(
              'SELECT user_id FROM organization_members WHERE unit_id=? AND demo_slot=?'
            )
            .get(unit.id, slot)
        )
          continue
        const id = `org-demo-${unit.id}-${slot}`,
          username = `org_demo_${unit.id.toLowerCase()}_${String(slot).padStart(2, '0')}`
        // These are fictional assignable contacts, not sign-in accounts. Empty credentials are rejected by passwordMatches.
        const name = surnames[slot - 1] + givenNames[index % givenNames.length]
        db.prepare(
          `INSERT OR IGNORE INTO users (id,username,display_name,rank_name,unit_name,role,password_hash,password_salt,active,created_at,updated_at)
        VALUES (?,?,?,?,?,'MAINTAINER','','',1,?,?)`
        ).run(
          id,
          username,
          name,
          [
            '대위',
            '중위',
            '원사',
            '상사',
            '중사',
            '중사',
            '하사',
            '하사',
            '군무원',
            '군무원'
          ][slot - 1],
          unit.name,
          date,
          date
        )
        const user = db
          .prepare('SELECT id,username FROM users WHERE id=?')
          .get(id) as { id: string; username: string } | undefined
        if (!user || user.username !== username)
          throw new Error('가상 부대 담당자 ID가 기존 사용자와 충돌합니다.')
        db.prepare(
          'INSERT INTO organization_members (user_id,unit_id,demo_slot,is_demo) VALUES (?,?,?,1)'
        ).run(id, unit.id, slot)
      }
  })()
}

export function assertOrganizationAssignee(
  db: Database.Database,
  teamId: string | null,
  userId: string | null
): void {
  if (!teamId || !userId) return
  const member = db
    .prepare('SELECT unit_id FROM organization_members WHERE user_id=?')
    .get(userId) as { unit_id: string } | undefined
  const team = db
    .prepare('SELECT unit_id FROM team_organizations WHERE team_id=?')
    .get(teamId) as { unit_id: string } | undefined
  if (member && team && member.unit_id !== team.unit_id)
    throw new Error('선택한 조치부서와 담당자의 소속 부대가 다릅니다.')
}
