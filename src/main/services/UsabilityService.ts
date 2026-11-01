import { randomUUID } from 'node:crypto'
import { maintenanceWorkKindLabel, maintenanceWorkKindSchema } from '../../shared/maintenance'
import type Database from 'better-sqlite3'
import type { PublicUser } from '../../shared/contracts'
import { usabilitySchemas } from '../../shared/usabilityContracts'
import { koreaDate } from '../../shared/date'
import {
  intakeSchema,
  missingQuestions,
  recurrenceDates,
  recurrenceSchema,
  supplementQuestions,
  templateDefinitionSchema,
  type CheckResult,
  type Intake,
  type RecurringRule,
  type TaskChecklist,
  type WorkTemplate
} from '../../shared/usability'

type Row = Record<string, unknown>
const now = () => new Date().toISOString()
const one = (db: Database.Database, sql: string, ...params: unknown[]) =>
  db.prepare(sql).get(...params) as Row | undefined
const all = (db: Database.Database, sql: string, ...params: unknown[]) =>
  db.prepare(sql).all(...params) as Row[]
const audit = (
  db: Database.Database,
  user: PublicUser,
  action: string,
  type: string,
  id: string,
  data: unknown
) =>
  db
    .prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)')
    .run(
      randomUUID(),
      user.id,
      action,
      type,
      id,
      null,
      JSON.stringify(data),
      now()
    )
function permit(user: PublicUser, ...roles: PublicUser['role'][]): void {
  if (!roles.includes(user.role)) throw new Error('권한이 없습니다.')
}
export function taskAccess(
  db: Database.Database,
  user: PublicUser,
  id: string,
  write = false
): Row {
  const row = one(db, 'SELECT * FROM maintenance_tasks WHERE id=?', id)
  if (!row) throw new Error('정비 작업을 찾을 수 없습니다.')
  if (write) {
    permit(user, 'ADMIN', 'MAINTAINER')
    if (user.role !== 'ADMIN' && row.assignee_id !== user.id)
      throw new Error('배정된 작업만 처리할 수 있습니다.')
    if (['COMPLETED', 'CANCELED'].includes(String(row.status)))
      throw new Error('완료·취소 작업은 수정할 수 없습니다.')
  } else if (
    user.role === 'USER' ||
    (user.role === 'MAINTAINER' && row.assignee_id !== user.id)
  )
    throw new Error('권한이 없습니다.')
  return row
}
export function directiveAccess(
  db: Database.Database,
  user: PublicUser,
  id: string
): Row {
  const row = one(db, 'SELECT * FROM directives WHERE id=?', id)
  if (!row) throw new Error('지시사항을 찾을 수 없습니다.')
  if (
    !['ADMIN', 'OPERATOR'].includes(user.role) &&
    !applicableDirective(row, user)
  )
    throw new Error('권한이 없습니다.')
  return row
}
function applicableDirective(row: Row, user: PublicUser): boolean {
  return row.assignee_id
    ? row.assignee_id === user.id
    : row.department
      ? row.department === user.unit_name
      : true
}
function template(
  db: Database.Database,
  id: string,
  kind?: string,
  requireActive = true
): WorkTemplate {
  const r = one(db, 'SELECT * FROM work_templates WHERE id=?', id)
  if (!r || (kind && r.kind !== kind) || (requireActive && !r.active))
    throw new Error('사용 가능한 템플릿을 찾을 수 없습니다.')
  return {
    id: String(r.id),
    kind: r.kind as WorkTemplate['kind'],
    version: Number(r.version),
    active: Boolean(r.active),
    definition: templateDefinitionSchema.parse(
      JSON.parse(String(r.definition_json))
    )
  }
}
export function getIntake(
  db: Database.Database,
  id: string
): (Intake & { questions: typeof supplementQuestions }) | null {
  const row = one(db, 'SELECT * FROM incident_intakes WHERE incident_id=?', id)
  return row
    ? {
        templateId: row.template_id as string | null,
        templateVersion: row.template_version as number | null,
        questions: JSON.parse(String(row.questions_json)),
        answers: JSON.parse(String(row.answers_json))
      }
    : null
}
export function saveIntake(
  db: Database.Database,
  user: PublicUser,
  id: string,
  value: unknown
): void {
  if (value === undefined) return
  const p = intakeSchema.parse(value),
    old = getIntake(db, id)
  let questions =
    old && !p.templateId
      ? [
          ...old.questions,
          ...supplementQuestions.filter(
            (q) => !old.questions.some((v) => v.id === q.id)
          )
        ]
      : supplementQuestions
  if (p.templateId) {
    const t = template(db, p.templateId, 'INCIDENT', false)
    if (
      old?.templateId === p.templateId &&
      old.templateVersion === p.templateVersion
    )
      questions = old.questions
    else {
      if (!t.active || t.version !== p.templateVersion)
        throw new Error('템플릿이 변경되었습니다. 다시 선택하십시오.')
      questions = t.definition.questions
    }
  }
  const allowed = new Set(questions.map((q) => q.id))
  if (p.answers.some((a) => !allowed.has(a.id)))
    throw new Error('템플릿에 없는 질문입니다.')
  db.prepare(
    'INSERT INTO incident_intakes VALUES (?,?,?,?,?,?) ON CONFLICT(incident_id) DO UPDATE SET template_id=excluded.template_id,template_version=excluded.template_version,questions_json=excluded.questions_json,answers_json=excluded.answers_json,updated_at=excluded.updated_at'
  ).run(
    id,
    p.templateId,
    p.templateVersion,
    JSON.stringify(questions),
    JSON.stringify(p.answers),
    now()
  )
  audit(db, user, 'SAVE_INTAKE', 'incidents', id, {
    templateId: p.templateId,
    version: p.templateVersion,
    answerCount: p.answers.length
  })
}
export function getChecklist(
  db: Database.Database,
  taskId: string
): TaskChecklist | null {
  const r = one(db, 'SELECT * FROM task_checklists WHERE task_id=?', taskId)
  return r
    ? {
        taskId,
        revision: Number(r.revision),
        templateId: String(r.template_id),
        templateVersion: Number(r.template_version),
        title: String(r.title),
        items: JSON.parse(String(r.items_json)),
        results: JSON.parse(String(r.results_json))
      }
    : null
}
function attachChecklist(
  db: Database.Database,
  user: PublicUser,
  taskId: string,
  templateId: string
): void {
  const t = template(db, templateId, 'CHECKLIST')
  if (!t.definition.items.length) throw new Error('점검 항목이 없습니다.')
  const previous = getChecklist(db, taskId),
    revision = (previous?.revision ?? 0) + 1
  db.prepare(
    'INSERT INTO task_checklists VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET template_id=excluded.template_id,template_version=excluded.template_version,title=excluded.title,items_json=excluded.items_json,results_json=excluded.results_json,revision=excluded.revision,updated_at=excluded.updated_at'
  ).run(
    taskId,
    t.id,
    t.version,
    t.definition.title,
    JSON.stringify(t.definition.items),
    '[]',
    revision,
    now()
  )
  audit(db, user, 'ATTACH_CHECKLIST', 'maintenance', taskId, {
    templateId,
    revision
  })
}
export function checklistProblems(check: TaskChecklist | null): string[] {
  if (!check) return []
  return check.items.flatMap((item) => {
    const r = check.results.find((r) => r.id === item.id)
    if (item.required && (!r || r.status === 'PENDING' || r.status === 'ISSUE'))
      return [`${item.label}: 필수 점검을 정상 확인하십시오.`]
    if (r?.status === 'NA' && (!item.allowNa || !r.note.trim()))
      return [`${item.label}: 해당 없음 허용 여부와 사유를 확인하십시오.`]
    if (r?.status === 'ISSUE' && !r.note.trim())
      return [`${item.label}: 이상 조치 메모를 입력하십시오.`]
    return []
  })
}
export function assertChecklistComplete(
  db: Database.Database,
  id: string
): void {
  const issues = checklistProblems(getChecklist(db, id))
  if (issues.length) throw new Error(`점검 미완료: ${issues.join(' / ')}`)
}
function validAssignee(
  db: Database.Database,
  user: PublicUser,
  id: string
): void {
  permit(user, 'ADMIN', 'MAINTAINER')
  if (user.role !== 'ADMIN' && id !== user.id)
    throw new Error('다른 담당자에게 배정할 권한이 없습니다.')
  const u = one(db, 'SELECT role,active FROM users WHERE id=?', id)
  if (!u?.active || !['ADMIN', 'MAINTAINER'].includes(String(u.role)))
    throw new Error('활성 정비 담당자를 선택하십시오.')
}
export function createMaintenance(
  db: Database.Database,
  user: PublicUser,
  p: Row
): { id: string; task_no: string } {
  return db.transaction(() => {
    const workKind = maintenanceWorkKindSchema.parse(p.workKind ?? 'PLANNED')
    const assignee = String(p.assigneeId ?? user.id)
    validAssignee(db, user, assignee)
    if (
      p.systemId &&
      !one(db, 'SELECT id FROM communication_systems WHERE id=?', p.systemId)
    )
      throw new Error('체계를 찾을 수 없습니다.')
    if (
      p.incidentId &&
      !one(db, 'SELECT id FROM incidents WHERE id=?', p.incidentId)
    )
      throw new Error('연계할 고장 접수를 찾을 수 없습니다.')
    if(p.incidentId&&user.role==='MAINTAINER'&&!one(db,'SELECT id FROM incidents WHERE id=? AND assigned_to=?',p.incidentId,user.id))
      throw new Error('본인에게 배정된 고장만 정비에 연결할 수 있습니다.')
    if (
      one(
        db,
        'SELECT id FROM daily_closures WHERE close_date=?',
        p.scheduledDate
      )
    )
      throw new Error('마감된 날짜에는 작업을 생성할 수 없습니다.')
    const id = randomUUID(),
      date = now(),
      prefix = `MNT-${koreaDate().replaceAll('-', '')}-`
    const max = Number(
      one(
        db,
        'SELECT max(CAST(substr(task_no,?) AS INTEGER)) n FROM maintenance_tasks WHERE task_no LIKE ?',
        prefix.length + 1,
        `${prefix}%`
      )?.n ?? 0
    )
    const no = prefix + String(max + 1).padStart(4, '0')
    db.prepare(
      'INSERT INTO maintenance_tasks(id,task_no,title,maintenance_type,priority,system_id,status,department,assignee_id,scheduled_date,progress,description,created_at,updated_at,incident_id,work_kind) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(
      id,
      no,
      p.title,
      p.maintenanceType,
      p.priority,
      p.systemId ?? null,
      'PLANNED',
      p.department,
      assignee,
      p.scheduledDate,
      0,
      p.description ?? null,
      date,
      date,
      p.incidentId ?? null,
      workKind
    )
    db.prepare('INSERT INTO maintenance_events VALUES (?,?,?,?,?,?)').run(
      randomUUID(),
      id,
      'CREATED',
      `${maintenanceWorkKindLabel(workKind)} 작업 등록`,
      user.id,
      date
    )
    if (p.checklistTemplateId)
      attachChecklist(db, user, id, String(p.checklistTemplateId))
    audit(db, user, 'CREATE', 'maintenance_tasks', id, {
      task_no: no,
      assigneeId: assignee
    })
    return { id, task_no: no }
  })()
}
function getRule(
  db: Database.Database,
  user: PublicUser,
  id: string
): RecurringRule {
  permit(user, 'ADMIN', 'MAINTAINER')
  const r = one(
    db,
    'SELECT * FROM recurring_rules WHERE id=? AND deleted=0',
    id
  )
  if (!r) throw new Error('반복 규칙을 찾을 수 없습니다.')
  const definition = recurrenceSchema.parse(
    JSON.parse(String(r.definition_json))
  )
  if (
    user.role !== 'ADMIN' &&
    (r.created_by !== user.id || definition.assigneeId !== user.id)
  )
    throw new Error('본인 반복 규칙만 사용할 수 있습니다.')
  return {
    id,
    version: Number(r.version),
    active: Boolean(r.active),
    definition,
    createdBy: String(r.created_by)
  }
}
function preview(db: Database.Database, user: PublicUser, p: Row) {
  const rule = getRule(db, user, String(p.id))
  if (!rule.active || rule.version !== p.version)
    throw new Error('규칙이 변경되었거나 중지되었습니다. 다시 미리보십시오.')
  validAssignee(db, user, rule.definition.assigneeId)
  if (rule.definition.checklistTemplateId)
    template(db, rule.definition.checklistTemplateId, 'CHECKLIST')
  const dates = recurrenceDates(rule.definition, String(p.from), String(p.to))
  return {
    rule,
    items: dates.map((date) => ({
      date,
      existing: Boolean(
        one(
          db,
          'SELECT 1 FROM recurring_occurrences WHERE rule_id=? AND occurrence_date=?',
          rule.id,
          date
        )
      ),
      closed: Boolean(
        one(db, 'SELECT id FROM daily_closures WHERE close_date=?', date)
      ),
      past: date < koreaDate()
    }))
  }
}
export const usabilityChannels = new Set<string>(Object.keys(usabilitySchemas))
export function runUsability(
  db: Database.Database,
  channel: string,
  p: Row,
  user: PublicUser
): unknown {
  if (channel === 'templates:list') {
    if (p.includeInactive) permit(user, 'ADMIN')
    return all(
      db,
      'SELECT id FROM work_templates WHERE kind=? AND (?=1 OR active=1) ORDER BY rowid',
      p.kind,
      p.includeInactive ? 1 : 0
    ).map((r) => template(db, String(r.id), String(p.kind), false))
  }
  if (channel === 'templates:save')
    return db.transaction(() => {
      permit(user, 'ADMIN')
      const id = String(p.id ?? randomUUID()),
        def = templateDefinitionSchema.parse(p.definition),
        old = p.id ? template(db, id, String(p.kind), false) : null
      if (old && old.version !== p.version)
        throw new Error('다른 화면에서 변경되었습니다. 새로고침하십시오.')
      if (p.kind === 'INCIDENT' && def.questions.length < 3)
        throw new Error('확인 질문은 3~5개 필요합니다.')
      if (p.kind === 'CHECKLIST' && !def.items.length)
        throw new Error('점검 항목을 추가하십시오.')
      const version = (old?.version ?? 0) + 1
      db.prepare(
        'INSERT INTO work_templates VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,active=excluded.active,definition_json=excluded.definition_json,updated_at=excluded.updated_at'
      ).run(id, p.kind, version, p.active ? 1 : 0, JSON.stringify(def), now())
      audit(db, user, 'SAVE_TEMPLATE', 'work_templates', id, {
        version,
        kind: p.kind,
        active: p.active
      })
      return { id, version }
    })()
  if (channel === 'input:inspect')
    return {
      questions: missingQuestions(
        {
          description: String(p.description),
          serviceImpact: p.serviceImpact as string | undefined,
          occurredAt: p.occurredAt as string | undefined
        },
        p.answers as Intake['answers']
      ),
      provider: 'LOCAL',
      externalTransmission: false
    }
  if (channel === 'maintenance:get') return taskAccess(db, user, String(p.id))
  if (channel === 'directives:get') {
    const r = directiveAccess(db, user, String(p.id))
    return {
      ...r,
      acknowledged_by_me: Boolean(
        one(
          db,
          'SELECT id FROM directive_acknowledgements WHERE directive_id=? AND user_id=?',
          p.id,
          user.id
        )
      )
    }
  }
  if (channel === 'work:mine') {
    const date = koreaDate(),
      incidents = all(
        db,
        `SELECT id,ticket_no,title,status,severity,sla_due_at FROM incidents WHERE ${user.role === 'USER' ? 'reported_by' : 'assigned_to'}=? AND status NOT IN ('CLOSED','CANCELED') ORDER BY CASE severity WHEN 'URGENT' THEN 0 ELSE 1 END,reported_at`,
        user.id
      )
    const tasks =
      user.role === 'USER'
        ? []
        : all(
            db,
            "SELECT id,task_no,title,status,scheduled_date FROM maintenance_tasks WHERE assignee_id=? AND scheduled_date<=? AND status NOT IN ('COMPLETED','CANCELED') ORDER BY scheduled_date",
            user.id,
            date
          )
    const directives = all(
      db,
      `SELECT d.* FROM directives d WHERE (d.expires_at IS NULL OR julianday(d.expires_at)>julianday(?)) AND NOT EXISTS(SELECT 1 FROM directive_acknowledgements a WHERE a.directive_id=d.id AND a.user_id=?) ORDER BY CASE d.level WHEN 'URGENT' THEN 0 ELSE 1 END,d.issued_at DESC`,
      now(),
      user.id
    ).filter((r) => applicableDirective(r, user))
    return {
      date,
      generatedAt: now(),
      incidentLabel:
        user.role === 'USER' ? '내가 접수한 고장' : '내게 배정된 고장',
      incidents,
      today: tasks.filter((r) => r.scheduled_date === date),
      overdue: tasks.filter((r) => String(r.scheduled_date) < date),
      directives
    }
  }
  if (channel === 'checklist:get') {
    taskAccess(db, user, String(p.taskId))
    return getChecklist(db, String(p.taskId))
  }
  if (channel === 'checklist:attach')
    return db.transaction(() => {
      taskAccess(db, user, String(p.taskId), true)
      const old = getChecklist(db, String(p.taskId))
      if ((old?.revision ?? 0) !== p.expectedRevision)
        throw new Error('점검표가 변경되었습니다. 다시 열어 주십시오.')
      if (old && !p.replaceConfirmed)
        throw new Error('기존 점검 결과 교체를 확인하십시오.')
      attachChecklist(db, user, String(p.taskId), String(p.templateId))
      return getChecklist(db, String(p.taskId))
    })()
  if (channel === 'checklist:save')
    return db.transaction(() => {
      taskAccess(db, user, String(p.taskId), true)
      const check = getChecklist(db, String(p.taskId))
      if (!check || check.revision !== p.revision)
        throw new Error('점검표가 변경되었습니다. 새로고침하십시오.')
      const values = p.results as CheckResult[]
      if (values.some((r) => !check.items.some((i) => i.id === r.id)))
        throw new Error('작업에 없는 점검 항목입니다.')
      for (const r of values) {
        const item = check.items.find((i) => i.id === r.id)!
        if (r.status === 'NA' && (!item.allowNa || !r.note.trim()))
          throw new Error('해당 없음은 허용된 항목에 사유가 필요합니다.')
        if (r.status === 'ISSUE' && !r.note.trim())
          throw new Error('이상 항목의 조치 메모가 필요합니다.')
      }
      const at = now(),
        results = check.items.map((i) => {
          const next = values.find((v) => v.id === i.id),
            old = check.results.find((v) => v.id === i.id)
          return next
            ? old && old.status === next.status && old.note === next.note
              ? old
              : { ...next, actor: user.id, at }
            : (old ?? { id: i.id, status: 'PENDING', note: '' })
        })
      db.prepare(
        'UPDATE task_checklists SET results_json=?,revision=revision+1,updated_at=? WHERE task_id=? AND revision=?'
      ).run(JSON.stringify(results), at, p.taskId, p.revision)
      audit(db, user, 'SAVE_CHECKLIST', 'maintenance', String(p.taskId), {
        revision: check.revision + 1,
        changes: values
          .filter((v) => {
            const old = check.results.find((r) => r.id === v.id)
            return old?.status !== v.status || old?.note !== v.note
          })
          .map((v) => ({
            id: v.id,
            from: check.results.find((r) => r.id === v.id)?.status ?? 'PENDING',
            to: v.status
          }))
      })
      return getChecklist(db, String(p.taskId))
    })()
  if (channel === 'recurring:list') {
    permit(user, 'ADMIN', 'MAINTAINER')
    return all(
      db,
      'SELECT id FROM recurring_rules WHERE deleted=0 AND (?=1 OR created_by=?) ORDER BY updated_at DESC',
      user.role === 'ADMIN' ? 1 : 0,
      user.id
    ).map((r) => getRule(db, user, String(r.id)))
  }
  if (channel === 'recurring:save')
    return db.transaction(() => {
      const definition = recurrenceSchema.parse(p.definition)
      validAssignee(db, user, definition.assigneeId)
      if (
        definition.systemId &&
        !one(
          db,
          'SELECT id FROM communication_systems WHERE id=?',
          definition.systemId
        )
      )
        throw new Error('체계를 찾을 수 없습니다.')
      if (definition.checklistTemplateId)
        template(db, definition.checklistTemplateId, 'CHECKLIST')
      const old = p.id ? getRule(db, user, String(p.id)) : null
      if (old && old.version !== p.version)
        throw new Error('규칙이 변경되었습니다. 다시 열어 주십시오.')
      const id = String(p.id ?? randomUUID()),
        version = (old?.version ?? 0) + 1
      db.prepare(
        'INSERT INTO recurring_rules(id,version,active,definition_json,created_by,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,active=excluded.active,definition_json=excluded.definition_json,updated_at=excluded.updated_at'
      ).run(
        id,
        version,
        p.active ? 1 : 0,
        JSON.stringify(definition),
        old?.createdBy ?? user.id,
        now()
      )
      audit(db, user, 'SAVE_RULE', 'recurring_rules', id, {
        version,
        active: p.active
      })
      return { id, version }
    })()
  if (channel === 'recurring:delete') {
    const old = getRule(db, user, String(p.id))
    if (old.version !== p.version) throw new Error('규칙이 변경되었습니다.')
    db.prepare(
      'UPDATE recurring_rules SET deleted=1,active=0,version=version+1,updated_at=? WHERE id=?'
    ).run(now(), old.id)
    audit(db, user, 'DELETE_RULE', 'recurring_rules', old.id, {
      version: old.version
    })
    return true
  }
  if (channel === 'recurring:preview') return preview(db, user, p)
  if (channel === 'recurring:generate')
    return db.transaction(() => {
      const { rule, items } = preview(db, user, p),
        dates = p.dates as string[]
      if (dates.some((d) => !items.some((i) => i.date === d)))
        throw new Error('미리보기 범위에 없는 예정일입니다.')
      if (items.some((i) => dates.includes(i.date) && !i.existing && i.closed))
        throw new Error('마감된 업무일을 포함합니다.')
      if (
        !p.allowPast &&
        items.some((i) => dates.includes(i.date) && !i.existing && i.past)
      )
        throw new Error('과거 작업 생성 확인이 필요합니다.')
      const batchId = randomUUID(),
        created: { id: string; task_no: string }[] = [],
        skipped: string[] = []
      for (const date of dates) {
        if (
          one(
            db,
            'SELECT 1 FROM recurring_occurrences WHERE rule_id=? AND occurrence_date=?',
            rule.id,
            date
          )
        ) {
          skipped.push(date)
          continue
        }
        const task = createMaintenance(db, user, {
          ...rule.definition,
          scheduledDate: date,
          workKind: 'PLANNED'
        })
        created.push(task)
        db.prepare(
          'INSERT INTO recurring_occurrences VALUES (?,?,?,?,?,?)'
        ).run(rule.id, date, task.id, rule.version, batchId, now())
      }
      audit(db, user, 'GENERATE_RECURRING', 'recurring_rules', rule.id, {
        batchId,
        created: created.length,
        skipped: skipped.length
      })
      return { batchId, created, skipped, failed: 0 }
    })()
  throw new Error('지원하지 않는 업무 요청입니다.')
}
