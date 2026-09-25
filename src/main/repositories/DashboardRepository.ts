import type Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { and, count, eq, notInArray, inArray } from 'drizzle-orm'
import * as schema from '../database/schema'

type Row = Record<string, unknown>
export class DashboardRepository {
  private orm: BetterSQLite3Database<typeof schema>
  constructor(private db: Database.Database) { this.orm = drizzle(db,{ schema }) }
  summary(): Record<string, unknown> {
    // 상세 팝업에서 체계명·담당자명을 보여주기 위한 공통 조인
    const incidentSql = `SELECT i.*, s.name system_name, r.display_name reporter_name, a.display_name assignee_name FROM incidents i
      LEFT JOIN communication_systems s ON s.id = i.system_id LEFT JOIN users r ON r.id = i.reported_by LEFT JOIN users a ON a.id = i.assigned_to`
    const maintenanceSql = `SELECT m.*, s.name system_name, u.display_name assignee_name FROM maintenance_tasks m
      LEFT JOIN communication_systems s ON s.id = m.system_id LEFT JOIN users u ON u.id = m.assignee_id
      WHERE m.status IN ('IN_PROGRESS','BLOCKED','PLANNED') ORDER BY CASE m.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'BLOCKED' THEN 1 ELSE 2 END, m.scheduled_date`
    const allSystems = this.db.prepare('SELECT * FROM communication_systems ORDER BY display_order').all() as Row[]
    const systems = allSystems.slice(0, 8)
    const recentIncidents = this.db.prepare(`${incidentSql} ORDER BY i.reported_at DESC LIMIT 6`).all() as Row[]
    const urgentIncidents = this.db.prepare(`${incidentSql} WHERE i.severity = 'URGENT' AND i.status NOT IN ('CLOSED','CANCELED') ORDER BY i.reported_at DESC`).all() as Row[]
    const recentMaintenance = this.db.prepare('SELECT * FROM maintenance_tasks ORDER BY scheduled_date DESC LIMIT 6').all() as Row[]
    const maintenanceStatus = this.db.prepare('SELECT status, count(*) n FROM maintenance_tasks GROUP BY status').all() as Row[]
    const openMaintenance = this.db.prepare(maintenanceSql).all() as Row[]
    const activeMaintenance = openMaintenance.slice(0, 4)
    const directives =this.db.prepare('SELECT * FROM directives ORDER BY pinned DESC,issued_at DESC LIMIT 5').all() as Row[]
    return {
      systems,allSystems,urgentIncidents,openMaintenance,
      systemCount: this.orm.select({ n:count() }).from(schema.communicationSystems).get()?.n ?? 0,
      normalCount: this.orm.select({ n:count() }).from(schema.communicationSystems).where(eq(schema.communicationSystems.status,'NORMAL')).get()?.n ?? 0,
      urgentCount: this.orm.select({ n:count() }).from(schema.incidents).where(and(eq(schema.incidents.severity,'URGENT'),notInArray(schema.incidents.status,['CLOSED','CANCELED']))).get()?.n ?? 0,
      incidentCount: this.orm.select({ n:count() }).from(schema.incidents).where(notInArray(schema.incidents.status,['CLOSED','CANCELED'])).get()?.n ?? 0,
      maintenanceCount: this.orm.select({ n:count() }).from(schema.maintenanceTasks).where(inArray(schema.maintenanceTasks.status,['PLANNED','IN_PROGRESS','BLOCKED'])).get()?.n ?? 0,
      recentIncidents,recentMaintenance,maintenanceStatus,activeMaintenance,directives
    }
  }
}
