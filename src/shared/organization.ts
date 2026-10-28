import { z } from 'zod'

export const unitLevelSchema = z.enum(['WING', 'BRIGADE', 'GROUP', 'OTHER'])
export type UnitLevel = z.infer<typeof unitLevelSchema>
export const unitLevelLabels: Record<UnitLevel, string> = {
  WING: '비행단급',
  BRIGADE: '여단급',
  GROUP: '전대급',
  OTHER: '기타'
}
export const publicSourceSchema = z
  .string()
  .trim()
  .url()
  .max(1000)
  .refine((value) => {
    const u = new URL(value)
    return u.protocol === 'https:' && !u.username && !u.password
  }, 'HTTPS 자료 주소를 입력하십시오.')
export const organizationSchemas = {
  'organizations:list': z.object({}),
  'organizations:saveDepartment': z.object({
    id: z.string().min(1).optional(),
    unitId: z.string().min(1).optional(),
    unitName: z.string().trim().min(2).max(80),
    unitLevel: unitLevelSchema,
    departmentName: z.string().trim().min(2).max(80),
    sourceUrl: publicSourceSchema.optional(),
    sourceDate: z.iso.date().optional(),
    note: z.string().trim().max(500).default(''),
    available: z.boolean().default(true)
  })
}

export type OrganizationUnit = {
  id: string
  name: string
  unit_level: UnitLevel
  source_url: string
  source_date: string | null
}
export type ActionDepartment = {
  id: string
  code: string
  name: string
  available: number
  active_count: number
  unit_id: string | null
  unit_name: string | null
  unit_level: UnitLevel | null
  department_name: string | null
  source_url: string | null
  source_date: string | null
  provenance: 'PUBLIC' | 'LOCAL' | null
  note: string | null
}
