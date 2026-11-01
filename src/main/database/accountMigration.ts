import type Database from 'better-sqlite3'
export function migrateAccounts(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS account_security (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    account_kind TEXT NOT NULL CHECK(account_kind IN ('LOGIN','CONTACT')),
    manual_locked INTEGER NOT NULL DEFAULT 0 CHECK(manual_locked IN (0,1)),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lock_until TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1)),
    auth_version INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 0,
    last_login_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_account_security_kind ON account_security(account_kind,manual_locked,lock_until);
  CREATE INDEX IF NOT EXISTS idx_account_audit_target ON audit_logs(entity_type,entity_id,created_at);
  CREATE INDEX IF NOT EXISTS idx_account_audit_actor ON audit_logs(actor_id,created_at);
  CREATE TABLE IF NOT EXISTS security_policy (id INTEGER PRIMARY KEY CHECK(id=1),failed_limit INTEGER NOT NULL CHECK(failed_limit BETWEEN 3 AND 10),lock_minutes INTEGER NOT NULL CHECK(lock_minutes BETWEEN 1 AND 60),version INTEGER NOT NULL DEFAULT 0);
  INSERT OR IGNORE INTO security_policy VALUES(1,5,15,0);`)
  ensureAccountRecords(db)
}
// Only missing metadata is inserted. Neither seeding nor reads can undo administrator changes.
export function ensureAccountRecords(db: Database.Database): void {
  db.exec(`INSERT OR IGNORE INTO account_security(user_id,account_kind)
    SELECT u.id,CASE WHEN COALESCE(m.is_demo,0)=1 OR u.password_hash='' OR u.password_salt='' THEN 'CONTACT' ELSE 'LOGIN' END
    FROM users u LEFT JOIN organization_members m ON m.user_id=u.id;`)
}
