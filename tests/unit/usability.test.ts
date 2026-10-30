import { describe, expect, it } from 'vitest'
import { koreaDate } from '../../src/shared/date'
import {
  analysisDescription,
  missingQuestions,
  recurrenceDates,
  recurrenceSchema,
  type Recurrence
} from '../../src/shared/usability'

const rule: Recurrence = {
  title: '가상 정기 점검',
  maintenanceType: '정기점검',
  department: '가상반',
  priority: 'NORMAL',
  description: '',
  systemId: null,
  assigneeId: 'test',
  checklistTemplateId: null,
  startDate: '2032-01-01',
  endDate: null,
  frequency: 'MONTHLY',
  interval: 1,
  weekdays: [1],
  monthDay: 31,
  lastDay: false
}
describe('recurrence dates and local input assistance', () => {
  it('uses the Korean business day across UTC midnight boundaries', () => {
    expect(koreaDate(new Date('2032-02-28T14:59:59Z'))).toBe('2032-02-28')
    expect(koreaDate(new Date('2032-02-28T15:00:00Z'))).toBe('2032-02-29')
  })
  it('clamps month end but restores original anchor, including leap year', () => {
    expect(recurrenceDates(rule, '2032-01-01', '2032-03-30')).toEqual([
      '2032-01-31',
      '2032-02-29'
    ])
    expect(recurrenceDates(rule, '2032-03-01', '2032-04-30')).toEqual([
      '2032-03-31',
      '2032-04-30'
    ])
  })
  it('supports monthly intervals, last day and inclusive end', () => {
    expect(
      recurrenceDates(
        { ...rule, interval: 2, lastDay: true, endDate: '2032-03-31' },
        '2032-02-01',
        '2032-04-30'
      )
    ).toEqual(['2032-03-31'])
  })
  it('anchors weekly interval on Monday, filters before start and deduplicates days', () => {
    const r = {
      ...rule,
      frequency: 'WEEKLY' as const,
      startDate: '2031-03-05',
      interval: 2,
      weekdays: [1, 5]
    }
    expect(recurrenceDates(r, '2031-03-01', '2031-03-23')).toEqual([
      '2031-03-07',
      '2031-03-17',
      '2031-03-21'
    ])
    expect(recurrenceSchema.safeParse({ ...r, weekdays: [1, 1] }).success).toBe(
      false
    )
  })
  it('bounds preview range and validates rule dates', () => {
    expect(() => recurrenceDates(rule, '2032-01-01', '2032-04-01')).toThrow(
      '90일'
    )
    expect(() => recurrenceDates(rule, '2032-03-01', '2032-01-01')).toThrow()
    expect(
      recurrenceSchema.safeParse({ ...rule, endDate: '2031-01-01' }).success
    ).toBe(false)
  })
  it('asks only missing facts and treats unknown as an answer', () => {
    expect(missingQuestions({ description: '불통' })).toHaveLength(5)
    expect(
      missingQuestions({
        description:
          '오늘 09시부터 여러 장비에 오류: 연결 불가가 발생하여 전체 서비스에 영향. 재부팅 시도.',
        serviceImpact: '업무 중단'
      })
    ).toHaveLength(0)
    expect(
      missingQuestions({ description: '불통' }, [
        { id: 'when', text: '', unknown: true }
      ]).some((q) => q.id === 'when')
    ).toBe(false)
  })
  it('composes supplement once from structured answers without mutating source', () => {
    const base = '가상 증상',
      answers = [{ id: 'scope', text: '한 대', unknown: false }]
    expect(analysisDescription(base, answers)).toBe(
      analysisDescription(base, answers)
    )
    expect(base).toBe('가상 증상')
    expect(
      analysisDescription(base, [{ id: 'when', text: '', unknown: true }])
    ).toContain('확인하지 못함')
  })
})
