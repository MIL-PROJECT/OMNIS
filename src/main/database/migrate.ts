import type Database from 'better-sqlite3'

export const SCHEMA_VERSION = 1
export function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current > SCHEMA_VERSION) throw new Error('DB schema is newer than this application')
  if (current === SCHEMA_VERSION) return
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, rank_name TEXT, unit_name TEXT, role TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS communication_systems (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL, uptime_pct REAL NOT NULL, today_incident_count INTEGER NOT NULL DEFAULT 0, remarks TEXT, display_order INTEGER NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS communication_status_history (id TEXT PRIMARY KEY, system_id TEXT NOT NULL REFERENCES communication_systems(id), status TEXT NOT NULL, uptime_pct REAL NOT NULL, recorded_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, ticket_no TEXT UNIQUE NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, system_id TEXT REFERENCES communication_systems(id), severity TEXT NOT NULL, status TEXT NOT NULL, description TEXT NOT NULL, reported_by TEXT NOT NULL REFERENCES users(id), assigned_to TEXT REFERENCES users(id), department TEXT, reported_at TEXT NOT NULL, assigned_at TEXT, started_at TEXT, resolved_at TEXT, closed_at TEXT, cause TEXT, action_summary TEXT, ai_category TEXT, ai_priority TEXT, ai_confidence REAL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS incident_events (id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), event_type TEXT NOT NULL, from_status TEXT, to_status TEXT, note TEXT, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS maintenance_tasks (id TEXT PRIMARY KEY, task_no TEXT UNIQUE NOT NULL, title TEXT NOT NULL, maintenance_type TEXT NOT NULL, priority TEXT NOT NULL, system_id TEXT REFERENCES communication_systems(id), status TEXT NOT NULL, department TEXT NOT NULL, assignee_id TEXT REFERENCES users(id), scheduled_date TEXT NOT NULL, due_date TEXT, started_at TEXT, completed_at TEXT, progress INTEGER NOT NULL DEFAULT 0, description TEXT, result TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS maintenance_events (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES maintenance_tasks(id), event_type TEXT NOT NULL, note TEXT, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS duty_roster (id TEXT PRIMARY KEY, duty_date TEXT NOT NULL, shift_type TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), position TEXT NOT NULL, start_time TEXT, end_time TEXT);
    CREATE TABLE IF NOT EXISTS directives (id TEXT PRIMARY KEY, level TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, issuer TEXT NOT NULL, issued_at TEXT NOT NULL, expires_at TEXT, pinned INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ai_interactions (id TEXT PRIMARY KEY, provider TEXT NOT NULL, feature TEXT NOT NULL, input_summary TEXT NOT NULL, output_summary TEXT NOT NULL, confidence REAL, fallback_used INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, before_json TEXT, after_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status); CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity); CREATE INDEX IF NOT EXISTS idx_incidents_reported ON incidents(reported_at);
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_tasks(status); CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance_tasks(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_history_system ON communication_status_history(system_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
  `)
  db.pragma(`user_version = ${SCHEMA_VERSION}`)
}
