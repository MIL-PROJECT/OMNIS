import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { migrate, migrateV1, migrateV2, SCHEMA_VERSION } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { organizationCatalog } from '../../src/main/database/organizationCatalog'
import { assertTransition, incidentTransitions, maintenanceTransitions } from '../../src/main/services/Workflow'
import { triageIncident } from '../../src/main/ai/LocalRuleProvider'
import { DashboardRepository } from '../../src/main/repositories/DashboardRepository'
import { koreaDate, koreaDateTime } from '../../src/shared/date'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteAttachment, listAttachments, storeAttachmentPaths, validateAttachmentPath } from '../../src/main/services/AttachmentStore'
import type { PublicUser } from '../../src/shared/contracts'

describe('offline database', () => {
  it('uses the Asia/Seoul business date around UTC midnight', () => {
    expect(koreaDate(new Date('2026-10-27T21:35:00Z'))).toBe('2026-10-28')
    expect(koreaDateTime('2026-10-27T21:35:00.000Z')).toBe('2026-10-28 06:35')
  })
  it('migrates and seeds the required demo workload', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    migrate(db); seed(db); seed(db)
    const count = (table: string) => (db.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n
    expect(count('users')).toBe(11+organizationCatalog.length*10)
    expect(db.prepare("SELECT role FROM users WHERE username='demo_user'").get()).toEqual({ role: 'USER' })
    expect(count('communication_systems')).toBe(38)
    expect(count('incidents')).toBe(52)
    expect(count('maintenance_tasks')).toBe(42)
    expect(count('duty_roster')).toBe(28)
    expect(count('directives')).toBe(8)
    expect(count('signup_requests')).toBe(2)
    expect(count('maintenance_teams')).toBe(3+organizationCatalog.filter(entry=>entry.department).length)
    expect(count('situation_alerts')).toBe(1)
    expect(count('maintenance_daily_plans')).toBe(3)
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    expect(count('attachments')).toBe(0)
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
  it('preserves existing data while upgrading a version 2 database', () => {
    const db = new Database(':memory:')
    migrateV1(db)
    migrateV2(db)
    db.prepare("INSERT INTO users (id,username,display_name,rank_name,unit_name,role,password_hash,password_salt,active,created_at,updated_at,service_no) VALUES ('u1','old_user','기존','대위','부대','ADMIN','h','s',1,'t','t','20-000001')").run()
    db.pragma('user_version = 2')
    migrate(db)
    const columns = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(c => c.name)
    expect(columns).toContain('service_no')
    expect(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='maintenance_teams'").get()).toEqual({ n: 1 })
    const incidentColumns = (db.prepare('PRAGMA table_info(incidents)').all() as { name: string }[]).map(c => c.name)
    expect(incidentColumns).toContain('sla_due_at')
    expect(incidentColumns).toContain('team_id')
    expect(db.prepare("SELECT username FROM users").get()).toEqual({ username: 'old_user' })
    expect(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='attachments'").get()).toEqual({ n: 1 })
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    db.close()
  })
  it('stores, hashes, audits, and deletes an incident attachment', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    migrate(db); seed(db)
    const root = mkdtempSync(join(tmpdir(),'omnis-attachments-'))
    try {
      const source = join(root,'sample.log')
      writeFileSync(source,'가상 장애 로그\nline 2','utf8')
      const admin = db.prepare("SELECT id,username,display_name,rank_name,unit_name,role FROM users WHERE role='ADMIN' LIMIT 1").get() as PublicUser
      const incident = db.prepare('SELECT id FROM incidents LIMIT 1').get() as { id:string }
      const result = storeAttachmentPaths(db,admin,{entityType:'INCIDENT',entityId:incident.id,category:'LOG',note:'시험 로그'},[source],join(root,'store'))
      expect(result).toHaveLength(1)
      const stored = db.prepare('SELECT id,stored_path,sha256,size_bytes FROM attachments').get() as { id:string;stored_path:string;sha256:string;size_bytes:number }
      expect(stored.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(stored.size_bytes).toBeGreaterThan(0)
      expect(existsSync(join(root,'store',...stored.stored_path.split('/')))).toBe(true)
      expect(db.prepare("SELECT count(*) n FROM incident_events WHERE event_type='ATTACHMENT_ADDED'").get()).toEqual({n:1})
      expect(db.prepare("SELECT count(*) n FROM audit_logs WHERE action='ATTACH'").get()).toEqual({n:1})
      const viewer = db.prepare("SELECT id,username,display_name,rank_name,unit_name,role FROM users WHERE role='VIEWER' LIMIT 1").get() as PublicUser
      expect(() => storeAttachmentPaths(db,viewer,{entityType:'INCIDENT',entityId:incident.id,category:'LOG'},[source],join(root,'store'))).toThrow('조회 전용')
      const ordinary = db.prepare("SELECT id,username,display_name,rank_name,unit_name,role FROM users WHERE role='USER' LIMIT 1").get() as PublicUser
      expect(() => listAttachments(db,ordinary,'INCIDENT',incident.id)).toThrow('접근할 권한')
      expect(deleteAttachment(db,admin,stored.id,join(root,'store'))).toBe(true)
      expect(db.prepare('SELECT count(*) n FROM attachments').get()).toEqual({n:0})
      const blocked = join(root,'unsafe.exe'); writeFileSync(blocked,'x')
      expect(() => validateAttachmentPath(blocked)).toThrow('허용되지 않은')
    } finally { db.close(); rmSync(root,{recursive:true,force:true}) }
  })
  it('rejects invalid workflow changes', () => {
    expect(() => assertTransition(incidentTransitions, 'RECEIVED', 'CLOSED')).toThrow()
    expect(() => assertTransition(incidentTransitions, 'RECEIVED', 'TRIAGED')).not.toThrow()
    expect(() => assertTransition(incidentTransitions, 'ASSIGNED', 'REMOTE_IN_PROGRESS')).not.toThrow()
    expect(() => assertTransition(incidentTransitions, 'REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS')).not.toThrow()
    expect(() => assertTransition(incidentTransitions, 'RESOLVED', 'VERIFIED')).not.toThrow()
    expect(() => assertTransition(incidentTransitions, 'VERIFIED', 'CLOSED')).not.toThrow()
    expect(() => assertTransition(maintenanceTransitions, 'COMPLETED', 'IN_PROGRESS')).toThrow()
  })
  it('provides an offline triage result', () => {
    expect(triageIncident('무선 통신 장애', '회선 중단').priority).toBe('URGENT')
    expect(triageIncident('무선 통신 장애', '회선 중단').category).toBe('무선/위성')
  })
  it('keeps indexed incident and maintenance queries responsive at 1,000+ rows', () => {
    const db = new Database(':memory:')
    migrate(db); seed(db)
    const user = db.prepare('SELECT id FROM users LIMIT 1').get() as { id:string }
    const insert = db.prepare(`INSERT INTO incidents (id,ticket_no,title,category,severity,status,description,reported_by,reported_at,created_at,updated_at,intake_source,emergency_preaction,user_confirmed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,0)`)
    db.transaction(() => { for (let i=0;i<1000;i++) insert.run(`perf-${i}`,`INC-PERF-${i}`,'가상 성능 점검','기반통신',i%20===0?'URGENT':'NORMAL',i%3===0?'RECEIVED':'ASSIGNED','가상 성능 데이터',user.id,new Date(Date.now()-i*60000).toISOString(),'t','t','BOARD') })()
    const started = performance.now()
    const rows = db.prepare("SELECT id FROM incidents WHERE status='RECEIVED' AND reported_at>=? ORDER BY reported_at DESC LIMIT 50").all('2000-01-01')
    const elapsed = performance.now()-started
    expect(rows).toHaveLength(50)
    expect(elapsed).toBeLessThan(500)
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_incidents_reported_status','idx_maintenance_scheduled_status')").all()
    expect(indexes).toHaveLength(2)
    db.close()
  })
})
