import { z } from 'zod'
import {
  answerSchema,
  checkResultSchema,
  recurrenceSchema,
  templateDefinitionSchema
} from './usability'

export const usabilitySchemas = {
  'templates:list': z.object({
    kind: z.enum(['INCIDENT', 'CHECKLIST']),
    includeInactive: z.boolean().default(false)
  }),
  'templates:save': z.object({
    id: z.string().optional(),
    version: z.number().int().positive().optional(),
    kind: z.enum(['INCIDENT', 'CHECKLIST']),
    active: z.boolean(),
    definition: templateDefinitionSchema
  }),
  'work:mine': z.object({}),
  'maintenance:get': z.object({ id: z.string() }),
  'directives:get': z.object({ id: z.string() }),
  'checklist:get': z.object({ taskId: z.string() }),
  'checklist:attach': z.object({
    taskId: z.string(),
    templateId: z.string(),
    expectedRevision: z.number().int().min(0),
    replaceConfirmed: z.boolean().default(false)
  }),
  'checklist:save': z.object({
    taskId: z.string(),
    revision: z.number().int().positive(),
    results: z
      .array(checkResultSchema)
      .max(20)
      .refine(
        (a) => new Set(a.map((v) => v.id)).size === a.length,
        '점검 항목이 중복되었습니다.'
      )
  }),
  'recurring:list': z.object({}),
  'recurring:save': z.object({
    id: z.string().optional(),
    version: z.number().int().positive().optional(),
    active: z.boolean(),
    definition: recurrenceSchema
  }),
  'recurring:delete': z.object({
    id: z.string(),
    version: z.number().int().positive()
  }),
  'recurring:preview': z.object({
    id: z.string(),
    version: z.number().int().positive(),
    from: z.iso.date(),
    to: z.iso.date()
  }),
  'recurring:generate': z.object({
    id: z.string(),
    version: z.number().int().positive(),
    from: z.iso.date(),
    to: z.iso.date(),
    dates: z
      .array(z.iso.date())
      .min(1)
      .max(100)
      .refine((a) => new Set(a).size === a.length, '예정일이 중복되었습니다.'),
    allowPast: z.boolean().default(false)
  }),
  'input:inspect': z.object({
    description: z.string().max(6000),
    serviceImpact: z.string().max(1000).optional(),
    occurredAt: z.string().max(40).optional(),
    answers: z.array(answerSchema).max(10).default([])
  })
} as const
