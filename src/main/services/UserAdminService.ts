import { randomBytes } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  adminSchemas,
  type AdminChannel,
  type AdminUser,
  type AuditEntry,
  type PageResult
} from '../../shared/admin'
import {
  AccountError,
  AccountSecurity,
  hashPassword,
  redact,
  securityAudit,
  userSelect
} from '../auth/AccountSecurity'

const like = (s: string) => `%${s.replace(/[\\%_]/g, '\\$&')}%`
const safeJson = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null
  try {
    const obj = JSON.parse(String(value))
    return obj && typeof obj === 'object' && !Array.isArray(obj)
      ? (redact(obj) as Record<string, unknown>)
      : { note: '이전 형식의 기록' }
  } catch {
    return { note: '이전 형식의 기록' }
  }
}
const snapshot = (u: AdminUser) => ({
  username: u.username,
  display_name: u.display_name,
  rank_name: u.rank_name,
  unit_name: u.unit_name,
  service_no: u.service_no,
  role: u.role,
  active: u.active,
  manual_locked: u.manual_locked,
  lock_until: u.lock_until,
  must_change_required: !!u.must_change_password
})
export class UserAdminService {
  auth: AccountSecurity
  constructor(
    public db: Database.Database,
    clock: () => Date = () => new Date()
  ) {
    this.auth = new AccountSecurity(db, clock)
  }
  run(channel: AdminChannel, input: unknown): unknown {
    const p = adminSchemas[channel].parse(input ?? {})
    if (channel === 'auth:changePassword') {
      const v = p as { currentPassword: string; newPassword: string }
      return this.auth.changePassword(v.currentPassword, v.newPassword)
    }
    const actor = this.auth.requireAdmin()
    if (channel === 'admin:securityPolicy') return this.auth.policy()
    if (channel === 'admin:saveSecurityPolicy') {
      const v = adminSchemas[channel].parse(p)
      this.auth.reauthenticate(v.adminPassword)
      try {
        return this.db.transaction(() => {
          const before = this.auth.policy()
          if (before.version !== v.expectedVersion)
            throw new AccountError(
              'CONFLICT',
              '다른 변경이 있습니다. 새로고침 후 다시 시도하십시오.'
            )
          this.db
            .prepare(
              'UPDATE security_policy SET failed_limit=?,lock_minutes=?,version=version+1 WHERE id=1'
            )
            .run(v.failedLimit, v.lockMinutes)
          securityAudit(
            this.db,
            actor.id,
            'SECURITY_POLICY_CHANGED',
            'security-policy',
            before,
            this.auth.policy() as unknown as Record<string, unknown>,
            v.reason
          )
          return this.auth.policy()
        })()
      } catch (error) {
        securityAudit(
          this.db,
          actor.id,
          'SECURITY_POLICY_CHANGE_FAILED',
          'security-policy',
          null,
          { error_code: error instanceof AccountError ? error.code : 'FAILED' },
          v.reason,
          'FAILURE'
        )
        throw error
      }
    }
    if (channel === 'admin:summary') {
      const users = this.db.prepare(userSelect).all() as AdminUser[],
        accounts = users.filter((u) => u.account_kind === 'LOGIN')
      return {
        loginAccounts: accounts.length,
        contacts: users.length - accounts.length,
        pending: (
          this.db
            .prepare(
              "SELECT count(*) n FROM signup_requests WHERE status='PENDING'"
            )
            .get() as { n: number }
        ).n,
        manualLocked: accounts.filter((u) => !!u.manual_locked).length,
        autoLocked: accounts.filter((u) => this.auth.autoLocked(u)).length,
        inactive: accounts.filter((u) => !u.active).length,
        passwordChange: accounts.filter((u) => !!u.must_change_password).length
      }
    }
    if (channel === 'admin:user')
      return this.auth.user((p as { id: string }).id)
    if (channel === 'admin:users') {
      const v = adminSchemas[channel].parse(p),
        where = ['s.account_kind=?'],
        args: unknown[] = [v.kind]
      if (v.search) {
        where.push(
          "(u.display_name LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\' OR COALESCE(u.service_no,'') LIKE ? ESCAPE '\\' OR u.unit_name LIKE ? ESCAPE '\\')"
        )
        args.push(...Array(4).fill(like(v.search)))
      }
      if (v.role) {
        where.push('u.role=?')
        args.push(v.role)
      }
      const now = this.auth.clock().toISOString()
      if (v.state === 'INACTIVE') where.push('u.active=0')
      if (v.state === 'MANUAL_LOCK') where.push('s.manual_locked=1')
      if (v.state === 'AUTO_LOCK') {
        where.push('s.lock_until>?')
        args.push(now)
      }
      if (v.state === 'PASSWORD_CHANGE') where.push('s.must_change_password=1')
      if (v.state === 'ACTIVE') {
        where.push(
          'u.active=1 AND s.manual_locked=0 AND (s.lock_until IS NULL OR s.lock_until<=?)'
        )
        args.push(now)
      }
      const clause = ` WHERE ${where.join(' AND ')}`,
        base = ` FROM users u JOIN account_security s ON s.user_id=u.id`,
        total = (
          this.db.prepare('SELECT count(*) n' + base + clause).get(...args) as {
            n: number
          }
        ).n
      const sort =
        v.sort === 'last_login_at' ? 's.last_login_at' : `u.${v.sort}`
      return {
        total,
        rows: this.db
          .prepare(
            `${userSelect}${clause} ORDER BY ${sort} ${v.direction === 'asc' ? 'ASC' : 'DESC'},u.id LIMIT ? OFFSET ?`
          )
          .all(...args, v.pageSize, v.page * v.pageSize)
      }
    }
    if (channel === 'admin:audit')
      return this.audit(adminSchemas[channel].parse(p))
    if (channel === 'admin:mutateUser') {
      const v = adminSchemas[channel].parse(p)
      this.auth.reauthenticate(v.adminPassword)
      try {
        return this.db.transaction(() => {
          const before = this.auth.user(v.id)
          if (before.account_kind !== 'LOGIN')
            throw new AccountError(
              'CONTACT_READONLY',
              '가상 담당자는 로그인 계정이 아닙니다. 조직·담당자 화면에서 확인하십시오.'
            )
          if (before.version !== v.expectedVersion)
            throw new AccountError(
              'CONFLICT',
              '계정이 변경되었습니다. 새로고침한 뒤 다시 시도하십시오.'
            )
          const restrictive =
            (v.action === 'ROLE' && v.role !== 'ADMIN') ||
            v.action === 'LOCK' ||
            v.action === 'DISABLE'
          if (restrictive && before.role === 'ADMIN') {
            const usable = this.db
              .prepare(
                `${userSelect} WHERE u.role='ADMIN' AND length(u.password_hash)=128 AND u.password_hash NOT GLOB '*[^0-9a-fA-F]*' AND length(u.password_salt)>0 AND u.active=1 AND s.account_kind='LOGIN' AND s.manual_locked=0 AND s.must_change_password=0 AND (s.lock_until IS NULL OR s.lock_until<=?)`
              )
              .all(this.auth.clock().toISOString()) as AdminUser[]
            if (usable.length <= 1 && usable.some((u) => u.id === before.id))
              throw new AccountError(
                'LAST_ADMIN',
                '마지막 로그인 가능한 관리자는 제한할 수 없습니다.'
              )
          }
          if (before.id === actor.id && v.action !== 'PROFILE')
            throw new AccountError(
              'SELF_PROTECTED',
              '본인 계정의 권한·잠금·사용 상태는 변경할 수 없습니다. 비밀번호는 본인 변경 기능을 사용하십시오.'
            )
          let temporaryPassword: string | undefined
          if (v.action === 'PROFILE') {
            if (
              v.serviceNo &&
              this.db
                .prepare('SELECT id FROM users WHERE service_no=? AND id<>?')
                .get(v.serviceNo, v.id)
            )
              throw new AccountError('DUPLICATE', '이미 사용 중인 군번입니다.')
            this.db
              .prepare(
                'UPDATE users SET display_name=?,rank_name=?,unit_name=?,service_no=? WHERE id=?'
              )
              .run(
                v.displayName,
                v.rankName || null,
                v.unitName,
                v.serviceNo || null,
                v.id
              )
          }
          if (v.action === 'ROLE')
            this.db
              .prepare('UPDATE users SET role=? WHERE id=?')
              .run(v.role, v.id)
          if (v.action === 'LOCK' || v.action === 'UNLOCK')
            this.db
              .prepare(
                'UPDATE account_security SET manual_locked=? WHERE user_id=?'
              )
              .run(v.action === 'LOCK' ? 1 : 0, v.id)
          if (v.action === 'DISABLE' || v.action === 'ENABLE')
            this.db
              .prepare('UPDATE users SET active=? WHERE id=?')
              .run(v.action === 'ENABLE' ? 1 : 0, v.id)
          if (v.action === 'CLEAR_AUTO_LOCK')
            this.db
              .prepare(
                'UPDATE account_security SET failed_attempts=0,lock_until=NULL WHERE user_id=?'
              )
              .run(v.id)
          if (v.action === 'RESET_PASSWORD') {
            temporaryPassword = `Tmp!${randomBytes(18).toString('base64url')}9`
            const h = hashPassword(temporaryPassword)
            this.db
              .prepare(
                'UPDATE users SET password_hash=?,password_salt=? WHERE id=?'
              )
              .run(h.hash, h.salt, v.id)
            this.db
              .prepare(
                'UPDATE account_security SET must_change_password=1 WHERE user_id=?'
              )
              .run(v.id)
          }
          this.db
            .prepare('UPDATE users SET updated_at=? WHERE id=?')
            .run(this.auth.clock().toISOString(), v.id)
          this.db
            .prepare(
              'UPDATE account_security SET version=version+1,auth_version=auth_version+? WHERE user_id=?'
            )
            .run(v.action === 'PROFILE' ? 0 : 1, v.id)
          const after = this.auth.user(v.id)
          securityAudit(
            this.db,
            actor.id,
            `USER_${v.action}`,
            v.id,
            snapshot(before),
            snapshot(after),
            v.reason
          )
          return {
            user: after,
            ...(temporaryPassword ? { temporaryPassword } : {})
          }
        })()
      } catch (error) {
        securityAudit(
          this.db,
          actor.id,
          `USER_${v.action}_FAILED`,
          v.id,
          null,
          { error_code: error instanceof AccountError ? error.code : 'FAILED' },
          v.reason,
          'FAILURE'
        )
        throw error
      }
    }
    throw new AccountError('NOT_FOUND', '관리 기능을 찾을 수 없습니다.')
  }
  private audit(
    v: ReturnType<(typeof adminSchemas)['admin:audit']['parse']>
  ): PageResult<AuditEntry> {
    const where: string[] = [],
      args: unknown[] = []
    if (v.from) {
      where.push('l.created_at>=?')
      args.push(new Date(`${v.from}T00:00:00+09:00`).toISOString())
    }
    if (v.to) {
      where.push('l.created_at<?')
      args.push(
        new Date(
          new Date(`${v.to}T00:00:00+09:00`).getTime() + 86400000
        ).toISOString()
      )
    }
    if (v.actor) {
      where.push(
        "(a.display_name LIKE ? ESCAPE '\\' OR a.username LIKE ? ESCAPE '\\')"
      )
      args.push(like(v.actor), like(v.actor))
    }
    if (v.target) {
      where.push(
        "(t.display_name LIKE ? ESCAPE '\\' OR t.username LIKE ? ESCAPE '\\' OR l.entity_id LIKE ? ESCAPE '\\')"
      )
      args.push(like(v.target), like(v.target), like(v.target))
    }
    if (v.targetId) {
      where.push("l.entity_type='users' AND l.entity_id=?")
      args.push(v.targetId)
    }
    if (v.action) {
      where.push("l.action LIKE ? ESCAPE '\\'")
      args.push(like(v.action))
    }
    if (v.result !== 'ALL') {
      where.push(
        "COALESCE(CASE WHEN json_valid(l.after_json) THEN json_extract(l.after_json,'$.result') END,'SUCCESS')=?"
      )
      args.push(v.result)
    }
    const base = ` FROM audit_logs l LEFT JOIN users a ON a.id=l.actor_id LEFT JOIN users t ON t.id=l.entity_id`,
      clause = where.length ? ` WHERE ${where.join(' AND ')}` : ''
    const total = (
      this.db.prepare('SELECT count(*) n' + base + clause).get(...args) as {
        n: number
      }
    ).n
    const rows = this.db
      .prepare(
        `SELECT l.*,a.display_name actor_name,t.display_name target_name${base}${clause} ORDER BY l.created_at DESC,l.id DESC LIMIT ? OFFSET ?`
      )
      .all(...args, v.pageSize, v.page * v.pageSize) as Record<
      string,
      unknown
    >[]
    return {
      total,
      rows: rows.map((row) => {
        const { before_json, after_json, ...meta } = row,
          after = safeJson(after_json)
        return {
          ...meta,
          before: safeJson(before_json),
          after,
          result: String(after?.result ?? 'SUCCESS'),
          reason: String(after?.reason ?? '')
        } as unknown as AuditEntry
      })
    }
  }
}
