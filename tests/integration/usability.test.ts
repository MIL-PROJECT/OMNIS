import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrate, SCHEMA_VERSION } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import {
  assertChecklistComplete,
  createMaintenance,
  getChecklist,
  getIntake,
  runUsability,
  saveIntake
} from '../../src/main/services/UsabilityService'
import { usabilitySchemas } from '../../src/shared/usabilityContracts'
import type { PublicUser } from '../../src/shared/contracts'
import type {
  Recurrence,
  TaskChecklist,
  WorkTemplate
} from '../../src/shared/usability'
import { koreaDate } from '../../src/shared/date'

let db: Database.Database,
  admin: PublicUser,
  maintainer: PublicUser,
  viewer: PublicUser
const run = (
  channel: keyof typeof usabilitySchemas,
  p: Record<string, unknown> = {},
  user = admin
): any => runUsability(db, channel, usabilitySchemas[channel].parse(p), user)
const task = (extra: Record<string, unknown> = {}) =>
  createMaintenance(db, admin, {
    title: '가상 점검 작업',
    maintenanceType: '정기점검',
    priority: 'NORMAL',
    department: '가상 정비반',
    scheduledDate: koreaDate(),
    ...extra
  })
const def = (): Recurrence => ({
  title: '가상 반복 점검',
  maintenanceType: '정기점검',
  department: '가상 정비반',
  priority: 'NORMAL',
  description: '가상 시험',
  systemId: null,
  assigneeId: maintainer.id,
  checklistTemplateId: 'check-general',
  startDate: '2032-01-01',
  endDate: null,
  frequency: 'MONTHLY',
  interval: 1,
  weekdays: [1],
  monthDay: 31,
  lastDay: false
})
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  migrate(db)
  seed(db)
  const user = (role: string) =>
    db
      .prepare('SELECT * FROM users WHERE role=? LIMIT 1')
      .get(role) as PublicUser
  admin = user('ADMIN')
  maintainer = user('MAINTAINER')
  viewer = user('VIEWER')
})
afterEach(() => db.close())
describe('five feature persistence and permissions', () => {
  it('keeps template edits across migration/seed and snapshots prior questions', () => {
    const t = run('templates:list', { kind: 'INCIDENT' })[0] as WorkTemplate,
      id = (
        db.prepare('SELECT id FROM incidents LIMIT 1').get() as { id: string }
      ).id
    saveIntake(db, admin, id, {
      templateId: t.id,
      templateVersion: t.version,
      answers: [{ id: 'when', text: '', unknown: true }]
    })
    run('templates:save', {
      ...t,
      definition: {
        ...t.definition,
        title: '사용자 수정 제목',
        questions: t.definition.questions.map((q) => ({
          ...q,
          label: '수정된 질문'
        }))
      }
    })
    migrate(db)
    seed(db)
    expect(
      run('templates:list', { kind: 'INCIDENT' })[0].definition.title
    ).toBe('사용자 수정 제목')
    expect(getIntake(db, id)?.questions[0].label).toBe(
      t.definition.questions[0].label
    )
    expect(() =>
      saveIntake(db, admin, id, {
        templateId: t.id,
        templateVersion: 99,
        answers: []
      })
    ).toThrow('변경')
  })
  it('validates question identity and allows missing optional answers', () => {
    const id = (
      db.prepare('SELECT id FROM incidents LIMIT 1').get() as { id: string }
    ).id
    expect(() =>
      saveIntake(db, admin, id, {
        templateId: null,
        templateVersion: null,
        answers: [{ id: 'forged', text: '값', unknown: false }]
      })
    ).toThrow('없는 질문')
    saveIntake(db, admin, id, {
      templateId: null,
      templateVersion: null,
      answers: []
    })
    expect(getIntake(db, id)?.answers).toEqual([])
  })
  it('restricts template administration to ADMIN', () => {
    const t = run('templates:list', { kind: 'INCIDENT' })[0]
    expect(() => run('templates:save', t, viewer)).toThrow('권한')
    expect(() =>
      run(
        'templates:list',
        { kind: 'INCIDENT', includeInactive: true },
        maintainer
      )
    ).toThrow('권한')
  })
  it('guards checklist ownership, required issues, NA, stale updates and closed results', () => {
    const t = task({
        assigneeId: maintainer.id,
        checklistTemplateId: 'check-general'
      }),
      check = getChecklist(db, t.id)!
    expect(() => assertChecklistComplete(db, t.id)).toThrow('미완료')
    expect(() =>
      run(
        'checklist:save',
        { taskId: t.id, revision: check.revision, results: [] },
        viewer
      )
    ).toThrow('권한')
    expect(() =>
      run(
        'checklist:save',
        {
          taskId: t.id,
          revision: 1,
          results: [{ id: check.items[1].id, status: 'NA', note: '사유' }]
        },
        maintainer
      )
    ).toThrow('허용')
    expect(() =>
      run(
        'checklist:save',
        {
          taskId: t.id,
          revision: 1,
          results: [{ id: 'fake', status: 'OK', note: '' }]
        },
        maintainer
      )
    ).toThrow('없는 점검')
    const result = run(
      'checklist:save',
      {
        taskId: t.id,
        revision: 1,
        results: check.items.map((i) => ({
          id: i.id,
          status: i.required ? 'OK' : 'NA',
          note: i.required ? '' : '미장착'
        }))
      },
      maintainer
    ) as TaskChecklist
    expect(result.revision).toBe(2)
    expect(result.results[0].actor).toBe(maintainer.id)
    expect(() => assertChecklistComplete(db, t.id)).not.toThrow()
    expect(() =>
      run(
        'checklist:save',
        { taskId: t.id, revision: 1, results: [] },
        maintainer
      )
    ).toThrow('변경')
    db.prepare(
      "UPDATE maintenance_tasks SET status='COMPLETED' WHERE id=?"
    ).run(t.id)
    expect(() =>
      run(
        'checklist:save',
        { taskId: t.id, revision: 2, results: [] },
        maintainer
      )
    ).toThrow('완료')
  })
  it('preserves legacy checklist-free tasks and checklist template snapshots', () => {
    const legacy = task()
    expect(() => assertChecklistComplete(db, legacy.id)).not.toThrow()
    const attached = task({ checklistTemplateId: 'check-general' }),
      old = getChecklist(db, attached.id)!,
      t = run('templates:list', { kind: 'CHECKLIST' })[0]
    run('templates:save', {
      ...t,
      definition: {
        ...t.definition,
        items: t.definition.items.map((i: any) => ({
          ...i,
          label: '바뀐 항목',
          required: false
        }))
      }
    })
    expect(getChecklist(db, attached.id)?.items).toEqual(old.items)
  })
  it('requires explicit revision and confirmation to replace or reset checklist', () => {
    const t = task({ checklistTemplateId: 'check-general' })
    expect(() =>
      run('checklist:attach', {
        taskId: t.id,
        templateId: 'check-network',
        expectedRevision: 0
      })
    ).toThrow('변경')
    expect(() =>
      run('checklist:attach', {
        taskId: t.id,
        templateId: 'check-network',
        expectedRevision: 1
      })
    ).toThrow('확인')
    expect(
      run('checklist:attach', {
        taskId: t.id,
        templateId: 'check-network',
        expectedRevision: 1,
        replaceConfirmed: true
      }).revision
    ).toBe(2)
  })
  it('keeps personal work scoped, today/overdue separate and directive confirmation independent', () => {
    const mine = task({ assigneeId: maintainer.id }),
      other = task(),
      old = task({ assigneeId: maintainer.id, scheduledDate: '2000-01-01' })
    task({ assigneeId: maintainer.id, scheduledDate: '2099-01-01' })
    const incident = (
      db.prepare('SELECT id FROM incidents LIMIT 1').get() as { id: string }
    ).id
    db.prepare(
      "UPDATE incidents SET assigned_to=?,status='ASSIGNED' WHERE id=?"
    ).run(maintainer.id, incident)
    db.prepare(
      "INSERT INTO directives (id,level,title,content,issuer,issued_at,expires_at,pinned,assignee_id,status) VALUES ('private','GENERAL','비공개','내용','관리자',?,NULL,0,?,'OPEN')"
    ).run(new Date().toISOString(), admin.id)
    const result = run('work:mine', {}, maintainer)
    expect(result.today.map((r: any) => r.id)).toContain(mine.id)
    expect(result.today.map((r: any) => r.id)).not.toContain(other.id)
    expect(result.overdue.map((r: any) => r.id)).toContain(old.id)
    expect(result.incidents.map((r: any) => r.id)).toContain(incident)
    expect(result.directives.some((r: any) => r.id === 'private')).toBe(false)
    expect(() => run('maintenance:get', { id: other.id }, maintainer)).toThrow(
      '권한'
    )
    expect(() => run('directives:get', { id: 'private' }, maintainer)).toThrow(
      '권한'
    )
    const before = run('work:mine', {}, admin).directives
    db.prepare(
      "INSERT INTO directive_acknowledgements VALUES ('ack','private',?,?)"
    ).run(admin.id, new Date().toISOString())
    expect(run('work:mine', {}, admin).directives.length).toBe(
      before.length - 1
    )
    expect(
      db
        .prepare("SELECT status FROM directives WHERE id='private'")
        .pluck()
        .get()
    ).toBe('OPEN')
  })
  it('previews without tasks, generates exact assignee and skips duplicate/canceled/moved occurrences', () => {
    const rule = run('recurring:save', { active: true, definition: def() }),
      range = { ...rule, from: '2032-01-01', to: '2032-03-30' },
      before = (
        db.prepare('SELECT count(*) n FROM maintenance_tasks').get() as {
          n: number
        }
      ).n
    const pv = run('recurring:preview', range)
    expect(pv.items.map((r: any) => r.date)).toEqual([
      '2032-01-31',
      '2032-02-29'
    ])
    expect(
      (
        db.prepare('SELECT count(*) n FROM maintenance_tasks').get() as {
          n: number
        }
      ).n
    ).toBe(before)
    const first = run('recurring:generate', {
      ...range,
      dates: ['2032-01-31', '2032-02-29']
    })
    expect(first.created).toHaveLength(2)
    expect(
      run('maintenance:get', { id: first.created[0].id }).assignee_id
    ).toBe(maintainer.id)
    expect(getChecklist(db, first.created[0].id)).not.toBeNull()
    db.prepare(
      "UPDATE maintenance_tasks SET scheduled_date='2032-02-01',status='CANCELED' WHERE id=?"
    ).run(first.created[0].id)
    const again = run('recurring:generate', {
      ...range,
      dates: ['2032-01-31', '2032-02-29']
    })
    expect(again.created).toHaveLength(0)
    expect(again.skipped).toHaveLength(2)
  })
  it('blocks forged/stale/paused/invalid-assignee previews and does not alter generated tasks on rule edit', () => {
    const rule = run('recurring:save', { active: true, definition: def() }),
      range = { ...rule, from: '2032-01-01', to: '2032-03-30' }
    expect(() =>
      run('recurring:generate', { ...range, dates: ['2032-01-30'] })
    ).toThrow('없는 예정일')
    run('recurring:save', { ...rule, active: false, definition: def() })
    expect(() => run('recurring:preview', range)).toThrow('변경')
    const current = run('recurring:list')[0]
    expect(() =>
      run('recurring:preview', { ...range, version: current.version })
    ).toThrow('중지')
    run('recurring:save', { ...current, active: true, definition: def() })
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(maintainer.id)
    expect(() => run('recurring:preview', { ...range, version: 3 })).toThrow(
      '담당자'
    )
  })
  it('forbids maintainer delegation and honors past-date consent and closure', () => {
    expect(() =>
      run(
        'recurring:save',
        { active: true, definition: { ...def(), assigneeId: admin.id } },
        maintainer
      )
    ).toThrow('권한')
    const rule = run('recurring:save', {
        active: true,
        definition: { ...def(), startDate: '2000-01-01' }
      }),
      range = {
        ...rule,
        from: '2000-01-01',
        to: '2000-01-31',
        dates: ['2000-01-31']
      }
    expect(() => run('recurring:generate', range)).toThrow('과거')
    expect(
      run('recurring:generate', { ...range, allowPast: true }).created
    ).toHaveLength(1)
    expect(() =>
      task({ scheduledDate: 'invalid', assigneeId: viewer.id })
    ).toThrow('담당자')
  })
  it('rolls back every task and occurrence when a generation batch fails midway', () => {
    const rule=run('recurring:save',{active:true,definition:def()})
    const before=db.prepare('SELECT count(*) FROM maintenance_tasks').pluck().get()
    db.exec("CREATE TRIGGER fail_second_task BEFORE INSERT ON maintenance_tasks WHEN NEW.scheduled_date='2032-02-29' BEGIN SELECT RAISE(ABORT,'simulated batch failure'); END")
    expect(()=>run('recurring:generate',{...rule,from:'2032-01-01',to:'2032-03-30',dates:['2032-01-31','2032-02-29']})).toThrow('simulated batch failure')
    expect(db.prepare('SELECT count(*) FROM maintenance_tasks').pluck().get()).toBe(before)
    expect(db.prepare('SELECT count(*) FROM recurring_occurrences').pluck().get()).toBe(0)
  })
  it('blocks generation on a closed business day without partial updates',()=>{
    const rule=run('recurring:save',{active:true,definition:def()})
    db.prepare('INSERT INTO daily_closures VALUES (?,?,?,?,?,?,?)').run('closed-test','2032-02-29','{}',0,0,admin.id,new Date().toISOString())
    expect(()=>run('recurring:generate',{...rule,from:'2032-01-01',to:'2032-03-30',dates:['2032-01-31','2032-02-29']})).toThrow('마감')
    expect(db.prepare('SELECT count(*) FROM recurring_occurrences').pluck().get()).toBe(0)
  })
  it('preserves generated tasks across rule pause and deletion',()=>{
    const rule=run('recurring:save',{active:true,definition:def()})
    const result=run('recurring:generate',{...rule,from:'2032-01-01',to:'2032-01-31',dates:['2032-01-31']})
    const changed=run('recurring:save',{...rule,active:false,definition:{...def(),title:'변경된 미래 제목'}})
    expect(run('maintenance:get',{id:result.created[0].id}).title).toBe('가상 반복 점검')
    run('recurring:delete',changed)
    expect(run('recurring:list')).toHaveLength(0)
    expect(run('maintenance:get',{id:result.created[0].id}).title).toBe('가상 반복 점검')
  })
  it('restores all new data from SQLite backup and remains migration-idempotent', () => {
    const t = task({ checklistTemplateId: 'check-general' })
    run('recurring:save', { active: true, definition: def() })
    const saved = db.serialize()
    const restored = new Database(saved)
    migrate(restored)
    expect(restored.pragma('user_version', { simple: true })).toBe(
      SCHEMA_VERSION
    )
    expect(getChecklist(restored, t.id)?.items.length).toBe(5)
    expect(restored.pragma('foreign_key_check')).toEqual([])
    expect(
      restored.prepare('SELECT count(*) FROM recurring_rules').pluck().get()
    ).toBe(1)
    restored.close()
  })
})
