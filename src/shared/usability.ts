import { z } from 'zod'

export const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  label: z.string().trim().min(1).max(120),
  required: z.boolean().default(true)
})
export const answerSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  text: z.string().trim().max(500),
  unknown: z.boolean().default(false)
})
export type IntakeAnswer = z.infer<typeof answerSchema>
export const intakeSchema = z.object({
  templateId: z.string().nullable(),
  templateVersion: z.number().int().positive().nullable(),
  answers: z
    .array(answerSchema)
    .max(10)
    .refine(
      (a) => new Set(a.map((v) => v.id)).size === a.length,
      '질문 답변이 중복되었습니다.'
    )
})
export type Intake = z.infer<typeof intakeSchema> & {
  questions?: z.infer<typeof questionSchema>[]
}
export const checklistItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  label: z.string().trim().min(1).max(120),
  required: z.boolean(),
  allowNa: z.boolean()
})
export const templateDefinitionSchema = z
  .object({
    title: z.string().trim().min(2).max(100),
    category: z.string().trim().min(1).max(50),
    symptomHint: z.string().max(1000),
    impactHint: z.string().max(500),
    questions: z.array(questionSchema).max(5),
    items: z.array(checklistItemSchema).max(20)
  })
  .superRefine((v, c) => {
    for (const key of ['questions', 'items'] as const)
      if (new Set(v[key].map((x) => x.id)).size !== v[key].length)
        c.addIssue({
          code: 'custom',
          path: [key],
          message: '항목 ID가 중복되었습니다.'
        })
  })
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>
export type WorkTemplate = {
  id: string
  kind: 'INCIDENT' | 'CHECKLIST'
  version: number
  active: boolean
  definition: TemplateDefinition
}
export const checkResultSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'OK', 'ISSUE', 'NA']),
  note: z.string().trim().max(500)
})
export type CheckResult = z.infer<typeof checkResultSchema>
export type TaskChecklist = {
  taskId: string
  revision: number
  templateId: string
  templateVersion: number
  title: string
  items: z.infer<typeof checklistItemSchema>[]
  results: (CheckResult & { actor?: string; at?: string })[]
}
export const recurrenceSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    maintenanceType: z.string().trim().min(1).max(50),
    department: z.string().trim().min(1).max(100),
    priority: z.enum(['NORMAL', 'HIGH']),
    description: z.string().max(2000),
    systemId: z.string().nullable(),
    assigneeId: z.string().min(1),
    checklistTemplateId: z.string().nullable(),
    startDate: z.iso.date(),
    endDate: z.iso.date().nullable(),
    frequency: z.enum(['WEEKLY', 'MONTHLY']),
    interval: z.number().int().min(1).max(12),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7),
    monthDay: z.number().int().min(1).max(31),
    lastDay: z.boolean()
  })
  .superRefine((v, c) => {
    if (v.endDate && v.endDate < v.startDate)
      c.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '종료일은 시작일 이후여야 합니다.'
      })
    if (
      v.frequency === 'WEEKLY' &&
      (!v.weekdays.length || new Set(v.weekdays).size !== v.weekdays.length)
    )
      c.addIssue({
        code: 'custom',
        path: ['weekdays'],
        message: '중복 없이 요일을 선택하십시오.'
      })
  })
export type Recurrence = z.infer<typeof recurrenceSchema>
export type RecurringRule = {
  id: string
  version: number
  active: boolean
  definition: Recurrence
  createdBy: string
}
export const supplementQuestions: z.infer<typeof questionSchema>[] = [
  { id: 'when', label: '언제부터 발생했습니까?', required: true },
  { id: 'scope', label: '한 장비입니까, 여러 장비입니까?', required: true },
  {
    id: 'symptom',
    label: '오류 메시지나 구체적인 증상은 무엇입니까?',
    required: true
  },
  {
    id: 'impact',
    label: '어떤 업무나 서비스에 영향이 있습니까?',
    required: true
  },
  {
    id: 'action',
    label: '이미 확인하거나 시도한 조치가 있습니까?',
    required: false
  }
]
export function missingQuestions(
  input: { description: string; serviceImpact?: string; occurredAt?: string },
  answers: IntakeAnswer[] = []
): typeof supplementQuestions {
  const text = input.description
  const present: Record<string, boolean> = {
    when:
      Boolean(input.occurredAt) ||
      /\d{1,2}[:시]|오늘|어제|부터|발생시각/.test(text),
    scope: /전체|일부|여러|모든|한 대|1대|단일|영향범위/.test(text),
    symptom: text.trim().length >= 25 || /오류\s*[:：]|증상\s*[:：]/.test(text),
    impact:
      Boolean(input.serviceImpact?.trim()) || /업무|서비스|영향/.test(text),
    action: /시도|재부팅|재연결|확인했|미시도|조치\s*[:：]/.test(text)
  }
  return supplementQuestions.filter(
    (q) =>
      !present[q.id] &&
      !answers.some((a) => a.id === q.id && (a.unknown || a.text.trim()))
  )
}
export function supplementText(
  answers: IntakeAnswer[],
  questions: typeof supplementQuestions = supplementQuestions
): string {
  return answers
    .filter((a) => a.unknown || a.text.trim())
    .map(
      (a) =>
        `${questions.find((q) => q.id === a.id)?.label ?? a.id}: ${a.unknown ? '확인하지 못함' : a.text}`
    )
    .join('\n')
}
export function analysisDescription(
  description: string,
  answers: IntakeAnswer[],
  questions?: typeof supplementQuestions
): string {
  const extra = supplementText(answers, questions)
  return extra ? `${description}\n\n[사용자 보완 정보]\n${extra}` : description
}
export function recurrenceDates(
  rule: Recurrence,
  from: string,
  to: string
): string[] {
  const day = 86400000,
    start = Date.parse(`${from}T00:00:00Z`),
    end = Date.parse(`${to}T00:00:00Z`),
    anchor = Date.parse(`${rule.startDate}T00:00:00Z`)
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    end - start > 89 * day
  )
    throw new Error('미리보기 기간은 1~90일이어야 합니다.')
  const anchorDate = new Date(anchor),
    anchorMonday = anchor - ((anchorDate.getUTCDay() + 6) % 7) * day,
    out: string[] = []
  for (let ms = start; ms <= end; ms += day) {
    const d = new Date(ms),
      date = d.toISOString().slice(0, 10)
    if (date < rule.startDate || (rule.endDate && date > rule.endDate)) continue
    if (rule.frequency === 'WEEKLY') {
      const week = Math.floor((ms - anchorMonday) / (7 * day))
      if (
        week % rule.interval === 0 &&
        rule.weekdays.includes(d.getUTCDay() || 7)
      )
        out.push(date)
    } else {
      const months =
          (d.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12 +
          d.getUTCMonth() -
          anchorDate.getUTCMonth(),
        last = new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
        ).getUTCDate()
      if (
        months % rule.interval === 0 &&
        d.getUTCDate() === (rule.lastDay ? last : Math.min(rule.monthDay, last))
      )
        out.push(date)
    }
  }
  if (out.length > 100)
    throw new Error('한 번에 최대 100건을 생성할 수 있습니다.')
  return out
}
