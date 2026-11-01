import type Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { and, count, eq, notInArray, inArray } from 'drizzle-orm'
import * as schema from '../database/schema'
import { koreaDate } from '../../shared/date'
import type { PublicUser } from '../../shared/contracts'
import type { SituationAlertSummary } from '../../shared/situationAlerts'
import { SituationAlertRepository } from './SituationAlertRepository'

type Row = Record<string, unknown>
export class DashboardRepository {
  private orm: BetterSQLite3Database<typeof schema>
  constructor(private db: Database.Database) { this.orm = drizzle(db,{ schema }) }
  summary(user?: Pick<PublicUser, 'id' | 'role'>): Record<string, unknown> & SituationAlertSummary {
    const today = koreaDate(), now = new Date().toISOString()
    // Match incidents:list: USER accounts can only see their own reports.
    const reporterId = user?.role === 'USER' ? user.id : null
    const incidentScopeSql = '(? IS NULL OR i.reported_by = ?)'
    const incidentScopeArgs = [reporterId, reporterId]
    const incidentScope = reporterId === null ? undefined : eq(schema.incidents.reportedBy, reporterId)
    // 상세 팝업에서 체계명·담당자명을 보여주기 위한 공통 조인
    const incidentSql = `SELECT i.*, s.name system_name, r.display_name reporter_name, a.display_name assignee_name FROM incidents i
      LEFT JOIN communication_systems s ON s.id = i.system_id LEFT JOIN users r ON r.id = i.reported_by LEFT JOIN users a ON a.id = i.assigned_to`
    const maintenanceSql = `SELECT m.*, s.name system_name, u.display_name assignee_name FROM maintenance_tasks m
      LEFT JOIN communication_systems s ON s.id = m.system_id LEFT JOIN users u ON u.id = m.assignee_id
      WHERE m.status IN ('IN_PROGRESS','BLOCKED','PLANNED') ORDER BY CASE m.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'BLOCKED' THEN 1 ELSE 2 END, m.scheduled_date`
    const allSystems = this.db.prepare('SELECT * FROM communication_systems ORDER BY display_order').all() as Row[]
    const systems = allSystems.slice(0, 8)
    const recentIncidents = this.db.prepare(`${incidentSql} WHERE ${incidentScopeSql} ORDER BY i.reported_at DESC LIMIT 30`).all(...incidentScopeArgs) as Row[]
    const urgentIncidents = this.db.prepare(`${incidentSql} WHERE ${incidentScopeSql} AND i.severity = 'URGENT' AND i.status NOT IN ('CLOSED','CANCELED') ORDER BY i.reported_at DESC`).all(...incidentScopeArgs) as Row[]
    const recentMaintenance = this.db.prepare('SELECT * FROM maintenance_tasks ORDER BY scheduled_date DESC LIMIT 6').all() as Row[]
    const maintenanceStatus = this.db.prepare('SELECT status, count(*) n FROM maintenance_tasks GROUP BY status').all() as Row[]
    const openMaintenance = this.db.prepare(maintenanceSql).all() as Row[]
    const activeMaintenance = openMaintenance.slice(0, 4)
    const directives =this.db.prepare('SELECT * FROM directives ORDER BY pinned DESC,issued_at DESC LIMIT 30').all() as Row[]
    const daily = this.db.prepare('SELECT COALESCE(sum(planned_count),0) planned,COALESCE(sum(unplanned_count),0) unplanned,COALESCE(sum(completed_count),0) completed,COALESCE(sum(carry_over_count),0) carry_over FROM maintenance_daily_plans WHERE plan_date=?').get(today) as Row
    const number = (sql: string, ...args: unknown[]) => Number((this.db.prepare(sql).get(...args) as { n: number } | undefined)?.n ?? 0)
    return {
      systems,allSystems,urgentIncidents,openMaintenance,
      systemCount: this.orm.select({ n:count() }).from(schema.communicationSystems).get()?.n ?? 0,
      normalCount: this.orm.select({ n:count() }).from(schema.communicationSystems).where(eq(schema.communicationSystems.status,'NORMAL')).get()?.n ?? 0,
      urgentCount: this.orm.select({ n:count() }).from(schema.incidents).where(and(incidentScope,eq(schema.incidents.severity,'URGENT'),notInArray(schema.incidents.status,['CLOSED','CANCELED']))).get()?.n ?? 0,
      incidentCount: this.orm.select({ n:count() }).from(schema.incidents).where(and(incidentScope,notInArray(schema.incidents.status,['CLOSED','CANCELED']))).get()?.n ?? 0,
      maintenanceCount: this.orm.select({ n:count() }).from(schema.maintenanceTasks).where(inArray(schema.maintenanceTasks.status,['PLANNED','IN_PROGRESS','BLOCKED'])).get()?.n ?? 0,
      todayReceived: number(`SELECT count(*) n FROM incidents i WHERE ${incidentScopeSql} AND date(i.reported_at,'+9 hours')=?`,...incidentScopeArgs,today),
      todayCompleted: number(`SELECT count(*) n FROM incidents i WHERE ${incidentScopeSql} AND date(COALESCE(i.resolved_at,i.closed_at),'+9 hours')=?`,...incidentScopeArgs,today),
      ...new SituationAlertRepository(this.db).summary(),
      slaOverdueCount: number(`SELECT count(*) n FROM incidents i WHERE ${incidentScopeSql} AND i.status NOT IN ('CLOSED','CANCELED') AND i.sla_due_at IS NOT NULL AND i.sla_due_at<?`,...incidentScopeArgs,now),
      slaRiskCount: number(`SELECT count(*) n FROM incidents i WHERE ${incidentScopeSql} AND i.status NOT IN ('CLOSED','CANCELED') AND i.sla_due_at IS NOT NULL AND i.sla_due_at>=? AND i.sla_due_at<?`,...incidentScopeArgs,now,new Date(Date.now()+60*60000).toISOString()),
      plannedCount: Number(daily.planned ?? 0),unplannedCount:Number(daily.unplanned ?? 0),completedPlanCount:Number(daily.completed ?? 0),carryOverCount:Number(daily.carry_over ?? 0),
      dutyCount: number('SELECT count(*) n FROM duty_roster WHERE duty_date=?',today),
      lastUpdatedAt: now,
      recentIncidents,recentMaintenance,maintenanceStatus,activeMaintenance,directives
    }
  }
}
