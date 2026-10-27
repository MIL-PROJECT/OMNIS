import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type Database from 'better-sqlite3'
import type { Channel, PublicUser } from '../../shared/contracts'
import { koreaDate } from '../../shared/date'

type Row = Record<string, unknown>
const now = () => new Date().toISOString()
const all = (db: Database.Database, sql: string, ...args: unknown[]): Row[] => db.prepare(sql).all(...args) as Row[]
const one = (db: Database.Database, sql: string, ...args: unknown[]): Row | undefined => db.prepare(sql).get(...args) as Row | undefined
const setting = (db: Database.Database, key: string, fallback: string): string => String(one(db,'SELECT value FROM app_settings WHERE key=?',key)?.value ?? fallback)
const permit = (user: PublicUser, ...roles: PublicUser['role'][]): void => { if (!roles.includes(user.role)) throw new Error('권한이 없습니다.') }
const audit = (db: Database.Database, user: PublicUser, action: string, type: string, id: string, before: unknown, after: unknown): void => {
  db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(), user.id, action, type, id, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, now())
}
const purgeAttachments = (db: Database.Database, entityType: 'INCIDENT'|'MAINTENANCE', entityId: string, root?: string): void => {
  const rows = all(db,'SELECT stored_path FROM attachments WHERE entity_type=? AND entity_id=?',entityType,entityId)
  db.prepare('DELETE FROM attachments WHERE entity_type=? AND entity_id=?').run(entityType,entityId)
  if (!root) return
  const safeRoot=resolve(root)
  for (const row of rows) { const path=resolve(root,...String(row.stored_path).split('/')); if(path.startsWith(`${safeRoot}${sep}`)) rmSync(path,{force:true}) }
}

function reconciliationPreview(db: Database.Database, date: string): Row[] {
  const issues: Row[] = []
  const add = (issueType: string, entityType: string, entityId: unknown, description: string): void => { issues.push({ issue_type: issueType, entity_type: entityType, entity_id: String(entityId), description, status: 'OPEN' }) }
  for (const row of all(db, "SELECT id,ticket_no,status FROM incidents WHERE status IN ('RESOLVED','VERIFIED','CLOSED') AND COALESCE(trim(action_summary),'')='' AND substr(COALESCE(resolved_at,updated_at),1,10)<=?", date)) add('INCIDENT_RESULT_MISSING','incident',row.id,`${row.ticket_no}: 조치결과가 입력되지 않았습니다.`)
  for (const row of all(db, "SELECT m.id,m.task_no,i.ticket_no,i.status FROM maintenance_tasks m JOIN incidents i ON i.id=m.incident_id WHERE m.status='COMPLETED' AND i.status NOT IN ('RESOLVED','VERIFIED','CLOSED') AND m.scheduled_date<=?", date)) add('STATUS_MISMATCH','maintenance',row.id,`${row.task_no} 완료 상태와 ${row.ticket_no} 고장 상태가 일치하지 않습니다.`)
  for (const row of all(db, "SELECT p.id,t.name,p.planned_count,p.unplanned_count,p.completed_count FROM maintenance_daily_plans p JOIN maintenance_teams t ON t.id=p.team_id WHERE p.plan_date=? AND p.completed_count<p.planned_count+p.unplanned_count AND COALESCE(trim(p.incomplete_reason),'')=''", date)) add('INCOMPLETE_REASON_MISSING','daily_plan',row.id,`${row.name}: 미완료 작업 사유가 없습니다.`)
  return issues
}

export async function runOperationalChannel(db: Database.Database, channel: Channel, p: Record<string, unknown>, user: PublicUser, attachmentRoot?: string): Promise<unknown> {
  if (channel === 'control:overview') {
    const date = String(p.date ?? koreaDate())
    return {
      date,
      planTime: setting(db,'daily_plan_time','08:30'),
      closeTime: setting(db,'daily_close_time','16:00'),
      openAlerts: Number(one(db,"SELECT count(*) n FROM situation_alerts WHERE status!='RESOLVED'")?.n ?? 0),
      criticalAlerts: Number(one(db,"SELECT count(*) n FROM situation_alerts WHERE severity='CRITICAL' AND status!='RESOLVED'")?.n ?? 0),
      slaOverdue: Number(one(db,"SELECT count(*) n FROM incidents WHERE status NOT IN ('CLOSED','CANCELED') AND sla_due_at IS NOT NULL AND sla_due_at<?",now())?.n ?? 0),
      emergencyOpen: Number(one(db,"SELECT count(*) n FROM incidents WHERE emergency_preaction=1 AND status NOT IN ('CLOSED','CANCELED')")?.n ?? 0),
      planned: Number(one(db,'SELECT COALESCE(sum(planned_count),0) n FROM maintenance_daily_plans WHERE plan_date=?',date)?.n ?? 0),
      unplanned: Number(one(db,'SELECT COALESCE(sum(unplanned_count),0) n FROM maintenance_daily_plans WHERE plan_date=?',date)?.n ?? 0),
      completed: Number(one(db,'SELECT COALESCE(sum(completed_count),0) n FROM maintenance_daily_plans WHERE plan_date=?',date)?.n ?? 0),
      carryOver: Number(one(db,'SELECT COALESCE(sum(carry_over_count),0) n FROM maintenance_daily_plans WHERE plan_date=?',date)?.n ?? 0),
      issues: reconciliationPreview(db,date).length,
      closed: !!one(db,'SELECT id FROM daily_closures WHERE close_date=?',date),
      lastUpdatedAt: now()
    }
  }
  if (channel === 'control:teams') return all(db, `SELECT t.*,GROUP_CONCAT(u.display_name, ', ') member_names,
      (SELECT count(*) FROM incidents i WHERE i.team_id=t.id AND i.status NOT IN ('CLOSED','CANCELED')) active_count
      FROM maintenance_teams t LEFT JOIN team_members tm ON tm.team_id=t.id AND tm.available=1 LEFT JOIN users u ON u.id=tm.user_id
      GROUP BY t.id ORDER BY t.display_order`)
  if (channel === 'control:alerts') return all(db, `SELECT a.*,c.name system_name,creator.display_name creator_name
      FROM situation_alerts a LEFT JOIN communication_systems c ON c.id=a.system_id LEFT JOIN users creator ON creator.id=a.created_by
      WHERE (? IS NULL OR a.status=?) ORDER BY CASE a.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,a.occurred_at DESC`,p.status ?? null,p.status ?? null)
  if (channel === 'control:createAlert') {
    permit(user,'ADMIN','OPERATOR')
    const id = randomUUID(), date = now()
    const count = Number(one(db,"SELECT count(*) n FROM situation_alerts WHERE alert_no LIKE ?",`ALT-${koreaDate().replaceAll('-','')}-%`)?.n ?? 0) + 1
    const alertNo = `ALT-${koreaDate().replaceAll('-','')}-${String(count).padStart(3,'0')}`
    db.prepare('INSERT INTO situation_alerts (id,alert_no,alert_type,severity,title,description,system_id,impact_scope,action_guidance,department,status,occurred_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id,alertNo,p.alertType,p.severity,p.title,p.description,p.systemId ?? null,p.impactScope ?? null,p.actionGuidance ?? null,p.department ?? null,'OPEN',p.occurredAt,user.id,date,date)
    if (p.severity === 'CRITICAL') db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?,?)').run(randomUUID(),'ALERT','긴급 상황경보',String(p.title),null,date)
    audit(db,user,'CREATE','situation_alerts',id,null,{ alertNo, ...p }); return { id, alertNo }
  }
  if (channel === 'control:updateAlert') {
    permit(user,'ADMIN','OPERATOR')
    const before = one(db,'SELECT * FROM situation_alerts WHERE id=?',p.id); if (!before) throw new Error('상황경보를 찾을 수 없습니다.')
    const date = now(), status = p.action === 'ACKNOWLEDGE' ? 'ACKNOWLEDGED' : 'RESOLVED'
    if (status === 'ACKNOWLEDGED') db.prepare('UPDATE situation_alerts SET status=?,acknowledged_by=?,acknowledged_at=?,updated_at=? WHERE id=?').run(status,user.id,date,date,p.id)
    else db.prepare('UPDATE situation_alerts SET status=?,resolved_by=?,resolved_at=?,updated_at=? WHERE id=?').run(status,user.id,date,date,p.id)
    audit(db,user,String(p.action),'situation_alerts',String(p.id),before,{ status }); return true
  }
  if (channel === 'control:dailyPlans') return all(db, `SELECT t.id team_id,t.code,t.name,t.available,t.average_resolution_minutes,
      p.id,p.plan_date,COALESCE(p.planned_count,0) planned_count,COALESCE(p.unplanned_count,0) unplanned_count,
      COALESCE(p.completed_count,0) completed_count,p.incomplete_reason,COALESCE(p.carry_over_count,0) carry_over_count,p.closed_at
      FROM maintenance_teams t LEFT JOIN maintenance_daily_plans p ON p.team_id=t.id AND p.plan_date=? ORDER BY t.display_order`,p.date)
  if (channel === 'control:upsertDailyPlan') {
    permit(user,'ADMIN','MAINTAINER')
    if (!one(db,'SELECT id FROM maintenance_teams WHERE id=?',p.teamId)) throw new Error('정비반을 찾을 수 없습니다.')
    if (user.role === 'MAINTAINER' && !one(db,'SELECT id FROM team_members WHERE team_id=? AND user_id=? AND available=1',p.teamId,user.id)) throw new Error('소속 정비반 작업계획만 입력할 수 있습니다.')
    const existing = one(db,'SELECT * FROM maintenance_daily_plans WHERE plan_date=? AND team_id=?',p.date,p.teamId), id = String(existing?.id ?? randomUUID()), date = now()
    db.prepare(`INSERT INTO maintenance_daily_plans (id,plan_date,team_id,planned_count,unplanned_count,completed_count,incomplete_reason,carry_over_count,created_by,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(plan_date,team_id) DO UPDATE SET planned_count=excluded.planned_count,unplanned_count=excluded.unplanned_count,completed_count=excluded.completed_count,incomplete_reason=excluded.incomplete_reason,carry_over_count=excluded.carry_over_count,updated_at=excluded.updated_at`)
      .run(id,p.date,p.teamId,p.plannedCount,p.unplannedCount,p.completedCount,p.incompleteReason ?? null,p.carryOverCount,user.id,date,date)
    audit(db,user,existing ? 'UPDATE' : 'CREATE','maintenance_daily_plans',id,existing,p); return { id }
  }
  if (channel === 'control:reconciliation') {
    const date = String(p.date), generated = reconciliationPreview(db,date)
    const stored = all(db,'SELECT * FROM reconciliation_results WHERE close_date=? ORDER BY created_at DESC',date)
    const resolvedKeys = new Set(stored.filter(r => r.status !== 'OPEN').map(r => `${r.issue_type}:${r.entity_type}:${r.entity_id}`))
    return [...generated.filter(r => !resolvedKeys.has(`${r.issue_type}:${r.entity_type}:${r.entity_id}`)),...stored.filter(r => r.status !== 'OPEN')]
  }
  if (channel === 'control:resolveIssue') {
    permit(user,'ADMIN','OPERATOR')
    const before = one(db,'SELECT * FROM reconciliation_results WHERE id=?',p.id); if (!before) throw new Error('정합성 항목을 찾을 수 없습니다.')
    const status = p.exceptionReason ? 'EXCEPTION' : 'RESOLVED'
    db.prepare('UPDATE reconciliation_results SET status=?,exception_reason=?,reviewed_by=?,reviewed_at=? WHERE id=?').run(status,p.exceptionReason ?? null,user.id,now(),p.id)
    audit(db,user,'REVIEW','reconciliation_results',String(p.id),before,{ status,reason:p.exceptionReason }); return true
  }
  if (channel === 'control:closeDay') {
    permit(user,'ADMIN')
    return db.transaction(() => {
      if (one(db,'SELECT id FROM daily_closures WHERE close_date=?',p.date)) throw new Error('이미 마감된 날짜입니다.')
      const issues = reconciliationPreview(db,String(p.date))
      if (issues.length && !p.allowExceptions) throw new Error(`미해결 정합성 항목 ${issues.length}건이 있습니다. 확인 후 예외 마감하십시오.`)
      const createdAt = now()
      for (const issue of issues) db.prepare('INSERT INTO reconciliation_results (id,close_date,issue_type,entity_type,entity_id,description,status,exception_reason,reviewed_by,reviewed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(randomUUID(),p.date,issue.issue_type,issue.entity_type,issue.entity_id,issue.description,p.allowExceptions ? 'EXCEPTION' : 'OPEN',p.allowExceptions ? '관리자 예외 마감' : null,p.allowExceptions ? user.id : null,p.allowExceptions ? createdAt : null,createdAt)
      const plans = all(db,'SELECT * FROM maintenance_daily_plans WHERE plan_date=?',p.date)
      const summary = { plans:plans.length,planned:plans.reduce((s,r)=>s+Number(r.planned_count),0),unplanned:plans.reduce((s,r)=>s+Number(r.unplanned_count),0),completed:plans.reduce((s,r)=>s+Number(r.completed_count),0),carryOver:plans.reduce((s,r)=>s+Number(r.carry_over_count),0) }
      const id = randomUUID(); db.prepare('INSERT INTO daily_closures VALUES (?,?,?,?,?,?,?)').run(id,p.date,JSON.stringify(summary),issues.length,p.allowExceptions ? issues.length : 0,user.id,createdAt)
      db.prepare('UPDATE maintenance_daily_plans SET closed_by=?,closed_at=?,updated_at=? WHERE plan_date=?').run(user.id,createdAt,createdAt,p.date)
      audit(db,user,'CLOSE_DAY','daily_closures',id,null,{ ...summary,issues:issues.length }); return { id,summary,issueCount:issues.length }
    })()
  }
  if (channel === 'control:handoverDraft') {
    const openIncidents = all(db,"SELECT ticket_no,title,severity,status,department FROM incidents WHERE status NOT IN ('CLOSED','CANCELED') ORDER BY CASE severity WHEN 'URGENT' THEN 0 ELSE 1 END,reported_at LIMIT 12")
    const maintenance = all(db,"SELECT task_no,title,status,department,progress FROM maintenance_tasks WHERE status IN ('PLANNED','IN_PROGRESS','BLOCKED') ORDER BY CASE priority WHEN 'HIGH' THEN 0 ELSE 1 END,scheduled_date LIMIT 10")
    const directives = all(db,"SELECT title,level,status,due_at FROM directives WHERE status!='COMPLETED' ORDER BY CASE level WHEN 'URGENT' THEN 0 ELSE 1 END,issued_at DESC LIMIT 8")
    const text = [`[${p.date} ${p.shiftType} 근무 인수인계]`,`미종결 고장 ${openIncidents.length}건`,...openIncidents.map(r=>`- ${r.ticket_no} ${r.title} / ${r.status} / ${r.department ?? '미지정'}`),`진행 정비 ${maintenance.length}건`,...maintenance.map(r=>`- ${r.task_no} ${r.title} / ${r.status} / ${r.progress}%`),`미완료 지시 ${directives.length}건`,...directives.map(r=>`- [${r.level}] ${r.title} / ${r.status}`)].join('\n')
    return { text,openIncidents,maintenance,directives,generatedAt:now(),label:'AI 지원 초안',provider:'Local Rule' }
  }
  if (channel === 'control:saveHandover') {
    permit(user,'ADMIN','OPERATOR','MAINTAINER','USER')
    const id = String(p.id ?? randomUUID()), date = now(), existing = p.id ? one(db,'SELECT * FROM handover_notes WHERE id=?',p.id) : undefined
    if (existing) db.prepare('UPDATE handover_notes SET final_text=?,status=?,confirmed_by=?,confirmed_at=? WHERE id=?').run(p.text,p.confirm ? 'CONFIRMED' : 'DRAFT',p.confirm ? user.id : null,p.confirm ? date : null,id)
    else db.prepare('INSERT INTO handover_notes (id,duty_date,shift_type,draft_text,final_text,status,created_by,confirmed_by,created_at,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,p.date,p.shiftType,p.text,p.text,p.confirm ? 'CONFIRMED' : 'DRAFT',user.id,p.confirm ? user.id : null,date,p.confirm ? date : null)
    audit(db,user,p.confirm ? 'CONFIRM' : 'SAVE','handover_notes',id,existing,{ date:p.date,shiftType:p.shiftType,status:p.confirm ? 'CONFIRMED':'DRAFT' }); return { id }
  }
  if (channel === 'demo:prepare') {
    permit(user,'ADMIN')
    const existing = one(db,"SELECT * FROM demo_scenarios WHERE scenario_key='EVALUATION' AND status='READY'")
    if (existing) return { id:existing.id,existing:true,entityIds:JSON.parse(String(existing.entity_ids_json)) }
    return db.transaction(() => {
      const date = now(), incidentId = randomUUID(), ticketNo = `INC-DEMO-EVAL-${date.replaceAll(/[-:TZ.]/g,'').slice(0,12)}`
      const system = one(db,'SELECT id FROM communication_systems ORDER BY display_order LIMIT 1'), team = one(db,"SELECT id FROM maintenance_teams WHERE code='TEAM-WIRE'"), assignee = one(db,"SELECT id FROM users WHERE role='MAINTAINER' ORDER BY username LIMIT 1")
      const sla = new Date(Date.now()+60*60000).toISOString()
      db.prepare(`INSERT INTO incidents (id,ticket_no,title,category,system_id,severity,status,description,reported_by,assigned_to,department,reported_at,assigned_at,created_at,updated_at,intake_source,reporter_name,equipment_name,service_impact,occurred_at,team_id,emergency_preaction,sla_due_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(incidentId,ticketNo,'가상 지휘통신 회선 간헐 중단','기반통신',system?.id ?? null,'URGENT','ASSIGNED','평가 시연용 가상 장애입니다.',user.id,assignee?.id ?? null,'유선정비반',date,date,date,date,'COMMAND','가상 상황담당','가상 교환기','지휘통신 일부 지연',date,team?.id ?? null,0,sla)
      db.prepare('INSERT INTO incident_events (id,incident_id,event_type,from_status,to_status,note,actor_id,created_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),incidentId,'DEMO_READY',null,'ASSIGNED','시연 시나리오 준비',user.id,date,JSON.stringify({ mock:true }))
      const id = randomUUID(), entityIds = { incidentId }
      db.prepare('INSERT INTO demo_scenarios VALUES (?,?,?,?,?,?,?,NULL)').run(id,'EVALUATION','평가 시연 시나리오','READY',JSON.stringify(entityIds),user.id,date)
      audit(db,user,'PREPARE','demo_scenarios',id,null,{ mock:true,entityIds }); return { id,existing:false,entityIds }
    })()
  }
  if (channel === 'demo:reset') {
    permit(user,'ADMIN')
    const scenario = one(db,"SELECT * FROM demo_scenarios WHERE scenario_key='EVALUATION'")
    if (!scenario) return { removed:false }
    return db.transaction(() => {
      const ids = JSON.parse(String(scenario.entity_ids_json)) as { incidentId?: string; maintenanceId?: string }
      if (ids.maintenanceId) { purgeAttachments(db,'MAINTENANCE',ids.maintenanceId,attachmentRoot); db.prepare('DELETE FROM maintenance_events WHERE task_id=?').run(ids.maintenanceId); db.prepare('DELETE FROM maintenance_tasks WHERE id=?').run(ids.maintenanceId) }
      if (ids.incidentId) { purgeAttachments(db,'INCIDENT',ids.incidentId,attachmentRoot); db.prepare('DELETE FROM incident_events WHERE incident_id=?').run(ids.incidentId); db.prepare('DELETE FROM incidents WHERE id=?').run(ids.incidentId) }
      db.prepare('DELETE FROM demo_scenarios WHERE id=?').run(scenario.id)
      audit(db,user,'RESET','demo_scenarios',String(scenario.id),scenario,{ removedEntityIds:ids }); return { removed:true,entityIds:ids }
    })()
  }
  return undefined
}

export const operationalChannels = new Set<Channel>([
  'control:overview','control:teams','control:alerts','control:createAlert','control:updateAlert','control:dailyPlans','control:upsertDailyPlan','control:reconciliation','control:resolveIssue','control:closeDay','control:handoverDraft','control:saveHandover','demo:prepare','demo:reset'
])
