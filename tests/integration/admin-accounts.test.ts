import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrate, SCHEMA_VERSION } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import {
  AccountError,
  AccountSecurity
} from '../../src/main/auth/AccountSecurity'
import { UserAdminService } from '../../src/main/services/UserAdminService'
import { session } from '../../src/main/auth/SessionManager'
import {
  adminSchemas,
  type AdminChannel,
  type AdminSummary,
  type AdminUser,
  type PageResult
} from '../../src/shared/admin'

describe('administrator accounts and offline security', () => {
  let db: Database.Database,
    auth: AccountSecurity,
    admin: UserAdminService,
    target: AdminUser,
    time: number
  const password = 'Demo!2026'
  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys=ON')
    migrate(db)
    seed(db)
    time = Date.parse('2032-01-01T00:00:00Z')
    auth = new AccountSecurity(db, () => new Date(time))
    admin = new UserAdminService(db, () => new Date(time))
    auth.login('demo_admin', password)
    target = (
      admin.run('admin:users', { role: 'OPERATOR' }) as PageResult<AdminUser>
    ).rows[0]
  })
  afterEach(() => {
    session.set(null)
    db.close()
  })
  const run = (channel: AdminChannel, p: unknown = {}) => admin.run(channel, p)
  function mutate(action: string, p: Record<string, unknown> = {}) {
    return run('admin:mutateUser', {
      id: target.id,
      expectedVersion: auth.user(target.id).version,
      action,
      reason: '가상 검증 사유',
      adminPassword: password,
      ...p
    }) as { user: AdminUser; temporaryPassword?: string }
  }
  it('separates 220 non-login contacts and excludes them from administrator/account statistics', () => {
    const summary = run('admin:summary') as AdminSummary
    expect(summary.loginAccounts).toBe(11)
    expect(summary.contacts).toBe(220)
    const contacts = run('admin:users', {
      kind: 'CONTACT'
    }) as PageResult<AdminUser>
    expect(contacts.total).toBe(220)
    expect(() =>
      mutate('RESET_PASSWORD', { id: contacts.rows[0].id, expectedVersion: 0 })
    ).toThrow('가상 담당자')
    expect(() => auth.login(contacts.rows[0].username, password)).toThrow(
      '아이디 또는 비밀번호'
    )
    expect(
      db
        .prepare(
          "SELECT count(*) n FROM users WHERE password_hash='' AND password_salt=''"
        )
        .get()
    ).toEqual({ n: 220 })
  })
  it('rejects every administrator API for every non-admin role, even direct service calls', () => {
    for (const role of ['USER', 'OPERATOR', 'MAINTAINER', 'VIEWER']) {
      const u = db
        .prepare(
          "SELECT username FROM users WHERE role=? AND password_hash<>'' LIMIT 1"
        )
        .get(role) as { username: string }
      auth.login(u.username, password)
      const requests: [AdminChannel, unknown][] = [
        ['admin:summary', {}],
        ['admin:users', {}],
        ['admin:user', { id: target.id }],
        ['admin:securityPolicy', {}],
        ['admin:audit', {}],
        [
          'admin:saveSecurityPolicy',
          {
            expectedVersion: 0,
            failedLimit: 5,
            lockMinutes: 15,
            reason: '가상 변경',
            adminPassword: password
          }
        ],
        [
          'admin:mutateUser',
          {
            id: target.id,
            expectedVersion: 0,
            action: 'LOCK',
            reason: '가상 변경',
            adminPassword: password
          }
        ]
      ]
      for (const [channel, p] of requests)
        expect(() => run(channel, p)).toThrow('관리자')
    }
  })
  it('protects self and last administrator without changing role or status', () => {
    const actor = session.get()!
    expect(() =>
      mutate('ROLE', { id: actor.id, expectedVersion: 0, role: 'USER' })
    ).toThrow('마지막')
    expect(() =>
      mutate('RESET_PASSWORD', { id: actor.id, expectedVersion: 0 })
    ).toThrow('본인')
    db.prepare("UPDATE users SET role='ADMIN' WHERE id=?").run(target.id)
    expect(() => mutate('LOCK', { id: actor.id, expectedVersion: 0 })).toThrow(
      '본인'
    )
    expect(auth.user(actor.id).active).toBe(1)
    expect(auth.user(actor.id).manual_locked).toBe(0)
  })
  it('requires admin reauthentication and a valid reason, and detects stale writes', () => {
    expect(() => mutate('LOCK', { adminPassword: 'wrong-password' })).toThrow(
      '관리자 비밀번호'
    )
    expect(() => mutate('LOCK', { reason: '' })).toThrow()
    const initial = auth.user(target.id).version
    mutate('LOCK')
    expect(() => mutate('UNLOCK', { expectedVersion: initial })).toThrow(
      '계정이 변경'
    )
    expect(auth.user(target.id).manual_locked).toBe(1)
  })
  it('keeps manual lock, auto lock and active status independent', () => {
    mutate('LOCK')
    mutate('DISABLE')
    mutate('RESET_PASSWORD')
    mutate('UNLOCK')
    expect(auth.user(target.id)).toMatchObject({
      active: 0,
      manual_locked: 0,
      must_change_password: 1
    })
    mutate('ENABLE')
    mutate('LOCK')
    db.prepare(
      'UPDATE account_security SET lock_until=?,failed_attempts=5 WHERE user_id=?'
    ).run(new Date(time + 1000).toISOString(), target.id)
    mutate('CLEAR_AUTO_LOCK')
    expect(auth.user(target.id)).toMatchObject({
      manual_locked: 1,
      failed_attempts: 0,
      lock_until: null
    })
    seed(db)
    expect(auth.user(target.id).manual_locked).toBe(1)
  })
  it('persists failed attempts and timed locks across new service instances without wall-clock waiting', () => {
    for (let i = 0; i < 5; i++)
      expect(() => auth.login(target.username, 'wrong-password')).toThrow(
        '아이디 또는 비밀번호'
      )
    expect(auth.user(target.id).failed_attempts).toBe(5)
    auth = new AccountSecurity(db, () => new Date(time))
    expect(() => auth.login(target.username, password)).toThrow('일시 제한')
    time += 15 * 60000 + 1
    expect(auth.login(target.username, password).id).toBe(target.id)
    expect(auth.user(target.id).failed_attempts).toBe(0)
  })
  it('only exposes a reset password once, forces change and rejects old credentials', () => {
    const reset = mutate('RESET_PASSWORD')
    expect(reset.temporaryPassword).toMatch(/^Tmp!/)
    expect(JSON.stringify(run('admin:user', { id: target.id }))).not.toContain(
      reset.temporaryPassword
    )
    expect(() => auth.login(target.username, password)).toThrow(
      '아이디 또는 비밀번호'
    )
    expect(
      auth.login(target.username, reset.temporaryPassword!).must_change_password
    ).toBe(true)
    expect(() => auth.requireUser()).toThrow('비밀번호를 변경')
    expect(() => auth.requireAdmin()).toThrow('비밀번호를 변경')
    expect(() =>
      run('auth:changePassword', {
        currentPassword: reset.temporaryPassword,
        newPassword: 'weak'
      })
    ).toThrow()
    run('auth:changePassword', {
      currentPassword: reset.temporaryPassword,
      newPassword: 'Changed!2032'
    })
    expect(auth.requireUser().must_change_password).toBe(false)
    expect(() => auth.login(target.username, reset.temporaryPassword!)).toThrow(
      '아이디 또는 비밀번호'
    )
    expect(auth.login(target.username, 'Changed!2032').id).toBe(target.id)
  })
  it.each(['ROLE', 'LOCK', 'DISABLE', 'RESET_PASSWORD'])(
    'invalidates a previously authenticated session after %s',
    (action) => {
      const old = auth.login(target.username, password),
        version = session.version()
      auth.login('demo_admin', password)
      mutate(action, { role: 'VIEWER' })
      session.set(old, version)
      expect(() => auth.requireUser()).toThrow(AccountError)
      expect(session.get()).toBeNull()
    }
  )
  it('updates profile safely, preserves workload references and filters inactive users', () => {
    const before = db.prepare('SELECT count(*) n FROM incidents').get()
    mutate('PROFILE', {
      displayName: '가상 변경자',
      rankName: '중위',
      unitName: '가상 검증부대',
      serviceNo: '22-99887766'
    })
    const result = run('admin:users', {
      search: '99887766'
    }) as PageResult<AdminUser>
    expect(result.rows[0].display_name).toBe('가상 변경자')
    mutate('DISABLE')
    expect(
      (
        run('admin:users', { state: 'INACTIVE' }) as PageResult<AdminUser>
      ).rows.some((u) => u.id === target.id)
    ).toBe(true)
    expect(db.prepare('SELECT count(*) n FROM incidents').get()).toEqual(before)
  })
  it('enforces versioned policy bounds and avoids leaking credential material to audit/read APIs', () => {
    run('admin:saveSecurityPolicy', {
      expectedVersion: 0,
      failedLimit: 3,
      lockMinutes: 1,
      reason: '가상 정책',
      adminPassword: password
    })
    expect(auth.policy()).toMatchObject({
      failedLimit: 3,
      lockMinutes: 1,
      version: 1
    })
    expect(() =>
      run('admin:saveSecurityPolicy', {
        expectedVersion: 0,
        failedLimit: 5,
        lockMinutes: 15,
        reason: '가상 정책',
        adminPassword: password
      })
    ).toThrow('다른 변경')
    expect(() =>
      adminSchemas['admin:saveSecurityPolicy'].parse({
        expectedVersion: 1,
        failedLimit: 0,
        lockMinutes: 1,
        reason: '가상 정책',
        adminPassword: password
      })
    ).toThrow()
    const reset = mutate('RESET_PASSWORD')
    mutate('LOCK')
    expect(() => mutate('UNLOCK', { expectedVersion: 0 })).toThrow(
      '계정이 변경'
    )
    const json = JSON.stringify(run('admin:audit', { targetId: target.id }))
    expect(json).not.toMatch(
      /password_hash|password_salt|temporaryPassword|adminPassword/
    )
    expect(json).not.toContain(reset.temporaryPassword)
    expect(json).not.toContain(password)
    expect(
      (run('admin:audit', { result: 'FAILURE' }) as PageResult<unknown>).total
    ).toBeGreaterThan(0)
  })
  it('migrates a populated v8 database once and preserves users, history and assigned contacts', () => {
    const users = db.prepare('SELECT * FROM users ORDER BY id').all(),
      incidents = db.prepare('SELECT * FROM incidents ORDER BY id').all()
    db.exec(
      'DROP TABLE account_security;DROP TABLE security_policy;PRAGMA user_version=8;'
    )
    migrate(db)
    migrate(db)
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    expect(db.prepare('SELECT * FROM users ORDER BY id').all()).toEqual(users)
    expect(db.prepare('SELECT * FROM incidents ORDER BY id').all()).toEqual(
      incidents
    )
    expect(
      db
        .prepare(
          "SELECT count(*) n FROM account_security WHERE account_kind='CONTACT'"
        )
        .get()
    ).toEqual({ n: 220 })
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(db.pragma('foreign_key_check')).toEqual([])
  })
})
