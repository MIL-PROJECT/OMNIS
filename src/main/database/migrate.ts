import { migrateAccounts } from './accountMigration'
import type Database from 'better-sqlite3'
import { migrateUsability } from './usabilityMigration'
import { migrateOrganizations } from './organizationMigration'
import { migrateOrganizationContacts } from './organizationContacts'

export const SCHEMA_VERSION = 9

// 버전별 스키마 변경을 순서대로 적용한다 (기존 DB는 부족한 단계만 실행)
export function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current > SCHEMA_VERSION) throw new Error('DB schema is newer than this application')
  if (current === SCHEMA_VERSION) return
  db.transaction(() => {
    if (current < 1) migrateV1(db)
    if (current < 2) migrateV2(db)
    if (current < 3) migrateV3(db)
    if (current < 4) migrateV4(db)
    if (current < 5) migrateV5(db)
    if (current < 6) migrateUsability(db)
    if (current < 7) migrateOrganizations(db)
    if (current < 8) migrateOrganizationContacts(db)
    if (current < 9) migrateAccounts(db)
    db.pragma(`user_version = ${SCHEMA_VERSION}`)
  })()
}

// v5: 외부 AI Provider 실행 추적. API Key는 DB에 저장하지 않는다.
function migrateV5(db: Database.Database): void {
  db.exec(`
    ALTER TABLE ai_runs ADD COLUMN request_id TEXT;
    ALTER TABLE ai_runs ADD COLUMN input_tokens INTEGER;
    ALTER TABLE ai_runs ADD COLUMN output_tokens INTEGER;
    ALTER TABLE ai_runs ADD COLUMN error_code TEXT;
    ALTER TABLE ai_runs ADD COLUMN external_transmission INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE ai_runs ADD COLUMN output_schema_version TEXT;
    ALTER TABLE ai_runs ADD COLUMN selected_provider TEXT;
    CREATE INDEX IF NOT EXISTS idx_ai_runs_provider_created ON ai_runs(provider,created_at);
    INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES
      ('ai_provider','LOCAL',datetime('now')),
      ('ollama_endpoint','http://127.0.0.1:11434',datetime('now')),
      ('ollama_model','gemma3',datetime('now')),
      ('openai_model','gpt-6-luna',datetime('now')),
      ('anthropic_model','claude-haiku-5-5',datetime('now')),
      ('external_ai_enabled','false',datetime('now')),
      ('ai_timeout_seconds','15',datetime('now')),
      ('ai_daily_request_limit','50',datetime('now')),
      ('external_ai_consent_at','',datetime('now'));
  `)
}

// v4: 장애·정비 증빙 첨부자료 메타데이터. 실제 파일은 userData/attachments에 저장한다.
export function migrateV4(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('INCIDENT','MAINTENANCE')),
      entity_id TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('PHOTO','LOG','REPORT','CHECKLIST','OTHER')),
      original_name TEXT NOT NULL,
      stored_path TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
      sha256 TEXT NOT NULL,
      note TEXT,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type,entity_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_attachments_hash ON attachments(sha256);
  `)
}

export function migrateV1(db: Database.Database): void {
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
}

// v2: 사용자 등록 신청 — 군번 컬럼과 신청 테이블
export function migrateV2(db: Database.Database): void {
  db.exec(`
    ALTER TABLE users ADD COLUMN service_no TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_service_no ON users(service_no) WHERE service_no IS NOT NULL;
    CREATE TABLE IF NOT EXISTS signup_requests (id TEXT PRIMARY KEY, service_no TEXT NOT NULL, username TEXT NOT NULL, display_name TEXT NOT NULL, rank_name TEXT NOT NULL, unit_name TEXT NOT NULL, phone TEXT, reason TEXT, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, status TEXT NOT NULL, approved_role TEXT, user_id TEXT REFERENCES users(id), reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT, reject_reason TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_signup_status ON signup_requests(status, created_at);
  `)
}

// v3: PDF 운용절차 기반 통제·정비 협업·일일 마감·AI 추적
export function migrateV3(db: Database.Database): void {
  db.exec(`
    ALTER TABLE incidents ADD COLUMN intake_source TEXT NOT NULL DEFAULT 'BOARD';
    ALTER TABLE incidents ADD COLUMN reporter_name TEXT;
    ALTER TABLE incidents ADD COLUMN equipment_name TEXT;
    ALTER TABLE incidents ADD COLUMN service_impact TEXT;
    ALTER TABLE incidents ADD COLUMN occurred_at TEXT;
    ALTER TABLE incidents ADD COLUMN desired_resolution_at TEXT;
    ALTER TABLE incidents ADD COLUMN team_id TEXT;
    ALTER TABLE incidents ADD COLUMN resolution_mode TEXT;
    ALTER TABLE incidents ADD COLUMN emergency_preaction INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE incidents ADD COLUMN emergency_reason TEXT;
    ALTER TABLE incidents ADD COLUMN actual_action_started_at TEXT;
    ALTER TABLE incidents ADD COLUMN sla_due_at TEXT;
    ALTER TABLE incidents ADD COLUMN verified_at TEXT;
    ALTER TABLE incidents ADD COLUMN recurrence_risk TEXT;
    ALTER TABLE incidents ADD COLUMN follow_up_date TEXT;
    ALTER TABLE incidents ADD COLUMN user_confirmed INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE incidents ADD COLUMN ai_rationale TEXT;
    ALTER TABLE incidents ADD COLUMN ai_recommended_team TEXT;
    ALTER TABLE incident_events ADD COLUMN metadata_json TEXT;

    ALTER TABLE maintenance_tasks ADD COLUMN incident_id TEXT REFERENCES incidents(id);
    ALTER TABLE maintenance_tasks ADD COLUMN work_kind TEXT NOT NULL DEFAULT 'PLANNED';
    ALTER TABLE maintenance_tasks ADD COLUMN cause TEXT;
    ALTER TABLE maintenance_tasks ADD COLUMN action_detail TEXT;
    ALTER TABLE maintenance_tasks ADD COLUMN parts_used TEXT;
    ALTER TABLE maintenance_tasks ADD COLUMN resolution_mode TEXT;
    ALTER TABLE maintenance_tasks ADD COLUMN recurrence_risk TEXT;
    ALTER TABLE maintenance_tasks ADD COLUMN follow_up_date TEXT;
    ALTER TABLE maintenance_tasks ADD COLUMN carried_over INTEGER NOT NULL DEFAULT 0;

    ALTER TABLE directives ADD COLUMN due_at TEXT;
    ALTER TABLE directives ADD COLUMN department TEXT;
    ALTER TABLE directives ADD COLUMN assignee_id TEXT REFERENCES users(id);
    ALTER TABLE directives ADD COLUMN status TEXT NOT NULL DEFAULT 'OPEN';
    ALTER TABLE duty_roster ADD COLUMN availability_status TEXT NOT NULL DEFAULT 'AVAILABLE';

    CREATE TABLE IF NOT EXISTS maintenance_teams (
      id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      specialties TEXT NOT NULL, system_categories TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1, average_resolution_minutes INTEGER NOT NULL DEFAULT 120,
      display_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY, team_id TEXT NOT NULL REFERENCES maintenance_teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id), role_name TEXT NOT NULL DEFAULT '정비요원',
      available INTEGER NOT NULL DEFAULT 1, UNIQUE(team_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS situation_alerts (
      id TEXT PRIMARY KEY, alert_no TEXT UNIQUE NOT NULL, alert_type TEXT NOT NULL,
      severity TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      system_id TEXT REFERENCES communication_systems(id), impact_scope TEXT,
      action_guidance TEXT, department TEXT, status TEXT NOT NULL,
      occurred_at TEXT NOT NULL, acknowledged_by TEXT REFERENCES users(id), acknowledged_at TEXT,
      resolved_by TEXT REFERENCES users(id), resolved_at TEXT, created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS maintenance_daily_plans (
      id TEXT PRIMARY KEY, plan_date TEXT NOT NULL, team_id TEXT NOT NULL REFERENCES maintenance_teams(id),
      planned_count INTEGER NOT NULL DEFAULT 0, unplanned_count INTEGER NOT NULL DEFAULT 0,
      completed_count INTEGER NOT NULL DEFAULT 0, incomplete_reason TEXT, carry_over_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL REFERENCES users(id), closed_by TEXT REFERENCES users(id), closed_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(plan_date,team_id)
    );
    CREATE TABLE IF NOT EXISTS reconciliation_results (
      id TEXT PRIMARY KEY, close_date TEXT NOT NULL, issue_type TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN', exception_reason TEXT,
      reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_closures (
      id TEXT PRIMARY KEY, close_date TEXT UNIQUE NOT NULL, summary_json TEXT NOT NULL,
      issue_count INTEGER NOT NULL DEFAULT 0, exception_count INTEGER NOT NULL DEFAULT 0,
      closed_by TEXT NOT NULL REFERENCES users(id), closed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS handover_notes (
      id TEXT PRIMARY KEY, duty_date TEXT NOT NULL, shift_type TEXT NOT NULL,
      draft_text TEXT NOT NULL, final_text TEXT, status TEXT NOT NULL DEFAULT 'DRAFT',
      created_by TEXT NOT NULL REFERENCES users(id), confirmed_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL, confirmed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS directive_acknowledgements (
      id TEXT PRIMARY KEY, directive_id TEXT NOT NULL REFERENCES directives(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id), acknowledged_at TEXT NOT NULL,
      UNIQUE(directive_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS ai_runs (
      id TEXT PRIMARY KEY, feature TEXT NOT NULL, provider TEXT NOT NULL, model TEXT,
      prompt_version TEXT NOT NULL, input_summary TEXT NOT NULL, output_json TEXT,
      confidence REAL, latency_ms INTEGER NOT NULL, status TEXT NOT NULL,
      fallback_used INTEGER NOT NULL DEFAULT 0, user_modified INTEGER NOT NULL DEFAULT 0,
      applied INTEGER NOT NULL DEFAULT 0, entity_type TEXT, entity_id TEXT, created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS demo_scenarios (
      id TEXT PRIMARY KEY, scenario_key TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
      status TEXT NOT NULL, entity_ids_json TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL, reset_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_team_status ON incidents(team_id,status);
    CREATE INDEX IF NOT EXISTS idx_incidents_sla ON incidents(sla_due_at,status);
    CREATE INDEX IF NOT EXISTS idx_incidents_reported_status ON incidents(reported_at,status,severity);
    CREATE INDEX IF NOT EXISTS idx_maintenance_scheduled_status ON maintenance_tasks(scheduled_date,status,work_kind);
    CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON situation_alerts(status,severity,occurred_at);
    CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON maintenance_daily_plans(plan_date,team_id);
    CREATE INDEX IF NOT EXISTS idx_reconciliation_date ON reconciliation_results(close_date,status);
    CREATE INDEX IF NOT EXISTS idx_handover_date ON handover_notes(duty_date,shift_type);
    CREATE INDEX IF NOT EXISTS idx_ai_runs_feature ON ai_runs(feature,created_at);

    INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES
      ('daily_plan_time','08:30',datetime('now')),
      ('daily_close_time','16:00',datetime('now')),
      ('sla_urgent_minutes','60',datetime('now')),
      ('sla_normal_minutes','480',datetime('now'));
  `)
}
