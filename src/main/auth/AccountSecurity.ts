import { koreaDateTime } from '../../shared/date'
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from 'node:crypto'
import type Database from 'better-sqlite3'
import type { PublicUser } from '../../shared/contracts'
import type { AdminUser, SecurityPolicy } from '../../shared/admin'
import { ensureAccountRecords } from '../database/accountMigration'
import { session } from './SessionManager'

export class AccountError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'AccountError'
  }
}
export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex')
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') }
}
const dummy = hashPassword('unused-authentication-placeholder')
export function passwordMatches(
  password: string,
  hash: unknown,
  salt: unknown
): boolean {
  const valid =
    typeof hash === 'string' &&
    /^[0-9a-f]{128}$/i.test(hash) &&
    typeof salt === 'string' &&
    salt.length > 0
  const value = scryptSync(password, valid ? String(salt) : dummy.salt, 64),
    expected = Buffer.from(valid ? String(hash) : dummy.hash, 'hex')
  return timingSafeEqual(value, expected) && valid
}
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/password|salt|api.?key|token|secret/i.test(key))
        .map(([key, v]) => [key, redact(v)])
    )
  return value
}
export function securityAudit(
  db: Database.Database,
  actor: string | null,
  action: string,
  target: string,
  before: unknown,
  after: Record<string, unknown>,
  reason = '',
  result = 'SUCCESS'
): void {
  db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)').run(
    randomUUID(),
    actor,
    action,
    'users',
    target,
    before ? JSON.stringify(redact(before)) : null,
    JSON.stringify({ ...(redact(after) as object), reason, result }),
    new Date().toISOString()
  )
}
export const userSelect = `SELECT u.id,u.username,u.display_name,u.rank_name,u.unit_name,u.service_no,u.role,u.active,u.created_at,u.updated_at,s.account_kind,s.manual_locked,s.failed_attempts,s.lock_until,s.must_change_password,s.auth_version,s.version,s.last_login_at FROM users u JOIN account_security s ON s.user_id=u.id`
export const publicUser = (u: AdminUser): PublicUser => ({
  id: u.id,
  username: u.username,
  display_name: u.display_name,
  rank_name: u.rank_name,
  unit_name: u.unit_name,
  role: u.role,
  must_change_password: !!u.must_change_password
})
export class AccountSecurity {
  constructor(
    public db: Database.Database,
    public clock: () => Date = () => new Date()
  ) {
    ensureAccountRecords(db)
  }
  user(id: string): AdminUser {
    const u = this.db.prepare(`${userSelect} WHERE u.id=?`).get(id) as
      AdminUser | undefined
    if (!u) throw new AccountError('NOT_FOUND', '사용자를 찾을 수 없습니다.')
    return u
  }
  policy(): SecurityPolicy {
    const p = this.db
      .prepare(
        'SELECT failed_limit failedLimit,lock_minutes lockMinutes,version FROM security_policy WHERE id=1'
      )
      .get() as SecurityPolicy
    return p
  }
  autoLocked(u: AdminUser): boolean {
    return !!u.lock_until && u.lock_until > this.clock().toISOString()
  }
  requireUser(allowPasswordChange = false): PublicUser {
    const current = session.get()
    if (!current)
      throw new AccountError('AUTH_REQUIRED', '로그인이 필요합니다.')
    let u: AdminUser
    try {
      u = this.user(current.id)
    } catch {
      session.set(null)
      throw new AccountError(
        'AUTH_SESSION_REVOKED',
        '계정 상태가 변경되었습니다. 다시 로그인하십시오.'
      )
    }
    if (
      u.account_kind !== 'LOGIN' ||
      !u.active ||
      u.manual_locked ||
      this.autoLocked(u) ||
      u.auth_version !== session.version()
    ) {
      session.set(null)
      throw new AccountError(
        'AUTH_SESSION_REVOKED',
        '계정 상태 또는 권한이 변경되었습니다. 다시 로그인하십시오.'
      )
    }
    const fresh = publicUser(u)
    session.refresh(fresh)
    if (u.must_change_password && !allowPasswordChange)
      throw new AccountError(
        'AUTH_PASSWORD_CHANGE_REQUIRED',
        '업무를 시작하기 전에 비밀번호를 변경하십시오.'
      )
    return fresh
  }
  requireAdmin(): PublicUser {
    const u = this.requireUser()
    if (u.role !== 'ADMIN') {
      securityAudit(
        this.db,
        u.id,
        'ADMIN_ACCESS_DENIED',
        u.id,
        null,
        {},
        '관리자 기능 접근 거절',
        'FAILURE'
      )
      throw new AccountError('FORBIDDEN', '관리자만 사용할 수 있습니다.')
    }
    return u
  }
  private failed(u: AdminUser, action = 'LOGIN_FAILED'): void {
    const p = this.policy(),
      attempts = u.failed_attempts + 1,
      lock =
        attempts >= p.failedLimit
          ? new Date(
              this.clock().getTime() + p.lockMinutes * 60000
            ).toISOString()
          : null
    this.db
      .prepare(
        'UPDATE account_security SET failed_attempts=?,lock_until=?,version=version+1 WHERE user_id=?'
      )
      .run(attempts, lock, u.id)
    securityAudit(
      this.db,
      null,
      action,
      u.id,
      null,
      { attempts },
      '인증 실패',
      'FAILURE'
    )
    if (lock)
      securityAudit(
        this.db,
        null,
        'AUTO_LOCK',
        u.id,
        null,
        { lock_until: lock },
        '로그인 실패 한도 도달'
      )
  }
  login(username: string, password: string): PublicUser {
    session.set(null)
    const candidate = this.db
      .prepare(
        'SELECT id,password_hash,password_salt FROM users WHERE username=?'
      )
      .get(username) as
      { id: string; password_hash: string; password_salt: string } | undefined
    const matches = passwordMatches(
      password,
      candidate?.password_hash,
      candidate?.password_salt
    )
    if (!candidate) {
      const r = this.db
        .prepare(
          "SELECT status,password_hash,password_salt,reject_reason FROM signup_requests WHERE username=? AND status IN ('PENDING','REJECTED') ORDER BY created_at DESC LIMIT 1"
        )
        .get(username) as Record<string, string> | undefined
      securityAudit(
        this.db,
        null,
        'LOGIN_FAILED',
        'unknown',
        null,
        { username: username.slice(0, 100) },
        '인증 실패',
        'FAILURE'
      )
      if (r && passwordMatches(password, r.password_hash, r.password_salt))
        throw new AccountError(
          'SIGNUP_PENDING',
          r.status === 'PENDING'
            ? '관리자 승인 대기 중인 계정입니다. 승인 후 로그인할 수 있습니다.'
            : `사용자 등록 신청이 반려되었습니다. 사유: ${r.reject_reason ?? '-'}`
        )
      throw new AccountError(
        'AUTH_LOGIN_FAILED',
        '아이디 또는 비밀번호가 올바르지 않습니다.'
      )
    }
    let u = this.user(candidate.id)
    if (u.lock_until && !this.autoLocked(u)) {
      this.db
        .prepare(
          'UPDATE account_security SET lock_until=NULL,failed_attempts=0,version=version+1 WHERE user_id=?'
        )
        .run(u.id)
      u = this.user(u.id)
    }
    if (!matches || u.account_kind !== 'LOGIN') {
      if (
        u.account_kind === 'LOGIN' &&
        u.active &&
        !u.manual_locked &&
        !this.autoLocked(u)
      )
        this.failed(u)
      else
        securityAudit(
          this.db,
          null,
          'LOGIN_FAILED',
          u.id,
          null,
          {},
          '인증 실패',
          'FAILURE'
        )
      throw new AccountError(
        'AUTH_LOGIN_FAILED',
        '아이디 또는 비밀번호가 올바르지 않습니다.'
      )
    }
    if (!u.active || u.manual_locked || this.autoLocked(u)) {
      securityAudit(
        this.db,
        null,
        'LOGIN_DENIED',
        u.id,
        null,
        {},
        '제한된 계정',
        'FAILURE'
      )
      throw new AccountError(
        'AUTH_ACCOUNT_LOCKED',
        this.autoLocked(u)
          ? `로그인이 일시 제한되었습니다. 해제 예정: ${koreaDateTime(u.lock_until)}`
          : '계정 사용이 제한되었습니다. 관리자에게 문의하십시오.'
      )
    }
    this.db
      .prepare(
        'UPDATE account_security SET failed_attempts=0,lock_until=NULL,last_login_at=? WHERE user_id=?'
      )
      .run(this.clock().toISOString(), u.id)
    securityAudit(this.db, u.id, 'LOGIN_SUCCESS', u.id, null, {})
    u = this.user(u.id)
    const result = publicUser(u)
    session.set(result, u.auth_version)
    return result
  }
  reauthenticate(password: string): PublicUser {
    const actor = this.requireAdmin(),
      u = this.user(actor.id),
      row = this.db
        .prepare('SELECT password_hash,password_salt FROM users WHERE id=?')
        .get(actor.id) as Record<string, string>
    if (!passwordMatches(password, row.password_hash, row.password_salt)) {
      this.failed(u, 'REAUTH_FAILED')
      if (this.autoLocked(this.user(u.id))) session.set(null)
      throw new AccountError('REAUTH_FAILED', '관리자 비밀번호를 확인하십시오.')
    }
    this.db
      .prepare('UPDATE account_security SET failed_attempts=0 WHERE user_id=?')
      .run(actor.id)
    return actor
  }
  changePassword(currentPassword: string, newPassword: string): PublicUser {
    const actor = this.requireUser(true),
      u = this.user(actor.id),
      row = this.db
        .prepare('SELECT password_hash,password_salt FROM users WHERE id=?')
        .get(actor.id) as Record<string, string>
    if (
      !passwordMatches(currentPassword, row.password_hash, row.password_salt)
    ) {
      this.failed(u, 'PASSWORD_CHANGE_FAILED')
      if (this.autoLocked(this.user(u.id))) session.set(null)
      throw new AccountError('REAUTH_FAILED', '현재 비밀번호를 확인하십시오.')
    }
    if (currentPassword === newPassword)
      throw new AccountError(
        'INVALID_INPUT',
        '현재 비밀번호와 다른 비밀번호를 입력하십시오.'
      )
    const p = hashPassword(newPassword)
    this.db.transaction(() => {
      this.db
        .prepare(
          'UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?'
        )
        .run(p.hash, p.salt, this.clock().toISOString(), u.id)
      this.db
        .prepare(
          'UPDATE account_security SET must_change_password=0,failed_attempts=0,lock_until=NULL,auth_version=auth_version+1,version=version+1 WHERE user_id=?'
        )
        .run(u.id)
      securityAudit(
        this.db,
        u.id,
        'PASSWORD_CHANGED',
        u.id,
        null,
        {},
        '본인 비밀번호 변경'
      )
    })()
    const fresh = this.user(u.id),
      result = publicUser(fresh)
    session.set(result, fresh.auth_version)
    return result
  }
}
