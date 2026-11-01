import { z } from 'zod'
import type { Role } from './contracts'

export const adminRoles = ['ADMIN'] as const
export const roleNames: Record<Role, string> = {
  ADMIN: '관리자',
  OPERATOR: '운용요원',
  MAINTAINER: '정비요원',
  VIEWER: '조회전용',
  USER: '일반 사용자'
}
const roles = z.enum(['ADMIN', 'OPERATOR', 'MAINTAINER', 'VIEWER', 'USER'])
const reason = z
  .string()
  .trim()
  .min(2, '변경 사유를 2자 이상 입력하십시오.')
  .max(300)
const password = z.string().min(1).max(128)
const version = z.number().int().min(0)
const paging = {
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25)
}
export const adminSchemas = {
  'auth:changePassword': z.object({
    currentPassword: password,
    newPassword: z
      .string()
      .regex(
        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/,
        '영문·숫자·특수문자를 포함해 8~64자로 입력하십시오.'
      )
  }),
  'admin:summary': z.object({}),
  'admin:users': z.object({
    ...paging,
    search: z.string().trim().max(100).default(''),
    role: roles.optional(),
    kind: z.enum(['LOGIN', 'CONTACT']).default('LOGIN'),
    state: z
      .enum([
        'ALL',
        'ACTIVE',
        'INACTIVE',
        'MANUAL_LOCK',
        'AUTO_LOCK',
        'PASSWORD_CHANGE'
      ])
      .default('ALL'),
    sort: z
      .enum([
        'display_name',
        'username',
        'unit_name',
        'role',
        'last_login_at',
        'created_at'
      ])
      .default('display_name'),
    direction: z.enum(['asc', 'desc']).default('asc')
  }),
  'admin:user': z.object({ id: z.string().min(1) }),
  'admin:mutateUser': z
    .object({
      id: z.string().min(1),
      expectedVersion: version,
      action: z.enum([
        'PROFILE',
        'ROLE',
        'LOCK',
        'UNLOCK',
        'DISABLE',
        'ENABLE',
        'CLEAR_AUTO_LOCK',
        'RESET_PASSWORD'
      ]),
      reason,
      adminPassword: password,
      role: roles.optional(),
      displayName: z.string().trim().min(2).max(20).optional(),
      rankName: z.string().trim().max(20).optional(),
      unitName: z.string().trim().min(2).max(50).optional(),
      serviceNo: z
        .string()
        .trim()
        .regex(/^\d{2}-\d{5,8}$/)
        .optional()
        .or(z.literal(''))
    })
    .superRefine((p, c) => {
      if (p.action === 'ROLE' && !p.role)
        c.addIssue({
          code: 'custom',
          path: ['role'],
          message: '변경할 역할을 선택하십시오.'
        })
      if (p.action === 'PROFILE' && (!p.displayName || !p.unitName))
        c.addIssue({
          code: 'custom',
          path: ['displayName'],
          message: '이름과 소속을 입력하십시오.'
        })
    }),
  'admin:securityPolicy': z.object({}),
  'admin:saveSecurityPolicy': z.object({
    expectedVersion: version,
    failedLimit: z.number().int().min(3).max(10),
    lockMinutes: z.number().int().min(1).max(60),
    reason,
    adminPassword: password
  }),
  'admin:audit': z
    .object({
      ...paging,
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      actor: z.string().trim().max(100).default(''),
      target: z.string().trim().max(100).default(''),
      targetId: z.string().optional(),
      action: z.string().trim().max(60).default(''),
      result: z.enum(['ALL', 'SUCCESS', 'FAILURE']).default('ALL')
    })
    .refine((p) => !p.from || !p.to || p.from <= p.to, {
      message: '조회 기간을 확인하십시오.'
    })
}
export type AdminChannel = keyof typeof adminSchemas
export interface SecurityPolicy {
  failedLimit: number
  lockMinutes: number
  version: number
}
export interface AdminUser {
  id: string
  username: string
  display_name: string
  rank_name: string | null
  unit_name: string | null
  service_no: string | null
  role: Role
  active: number
  account_kind: 'LOGIN' | 'CONTACT'
  manual_locked: number
  failed_attempts: number
  lock_until: string | null
  must_change_password: number
  auth_version: number
  version: number
  last_login_at: string | null
  created_at: string
  updated_at: string
}
export interface AdminSummary {
  loginAccounts: number
  contacts: number
  pending: number
  manualLocked: number
  autoLocked: number
  inactive: number
  passwordChange: number
}
export interface AuditEntry {
  id: string
  actor_id: string | null
  actor_name: string | null
  target_name: string | null
  action: string
  entity_type: string
  entity_id: string
  created_at: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  result: string
  reason: string
}
export interface PageResult<T> {
  rows: T[]
  total: number
}
export interface UserMutationResult {
  user: AdminUser
  temporaryPassword?: string
}
export interface AdminResponses {
  'auth:changePassword': import('./contracts').PublicUser
  'admin:summary': AdminSummary
  'admin:users': PageResult<AdminUser>
  'admin:user': AdminUser
  'admin:mutateUser': UserMutationResult
  'admin:securityPolicy': SecurityPolicy
  'admin:saveSecurityPolicy': SecurityPolicy
  'admin:audit': PageResult<AuditEntry>
}
