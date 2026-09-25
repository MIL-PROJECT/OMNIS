import type Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { and, count, eq, notInArray, inArray } from 'drizzle-orm'
import * as schema from '../database/schema'

type Row = Record<string, unknown>
export class DashboardRepository {
  private orm: BetterSQLite3Database<typeof schema>
  constructor(private db: Database.Database) { this.orm = drizzle(db,{ schema }) }
  summary(): Record<string, unknown> {
    const systems = this.db.prepare('SELECT * FROM communication_systems ORDER BY display_order LIMIT 8').all() as Row[]
    const recentIncidents = this.db.prepare('SELECT * FROM incidents ORDER BY reported_at DESC LIMIT 6').all() as Row[]
    const recentMaintenance = this.db.prepare('SELECT * FROM maintenance_tasks ORDER BY scheduled_date DESC LIMIT 6').all() as Row[]
    const directives = this.db.prepare('SELECT * FROM directives ORDER BY pinned DESC,issued_at DESC LIMIT 5').all() as Row[]
    return {
      systems,
      systemCount: this.orm.select({ n:count() }).from(schema.communicationSystems).get()?.n ?? 0,
      normalCount: this.orm.select({ n:count() }).from(schema.communicationSystems).where(eq(schema.communicationSystems.status,'NORMAL')).get()?.n ?? 0,
      urgentCount: this.orm.select({ n:count() }).from(schema.incidents).where(and(eq(schema.incidents.severity,'URGENT'),notInArray(schema.incidents.status,['CLOSED','CANCELED']))).get()?.n ?? 0,
      incidentCount: this.orm.select({ n:count() }).from(schema.incidents).where(notInArray(schema.incidents.status,['CLOSED','CANCELED'])).get()?.n ?? 0,
      maintenanceCount: this.orm.select({ n:count() }).from(schema.maintenanceTasks).where(inArray(schema.maintenanceTasks.status,['PLANNED','IN_PROGRESS','BLOCKED'])).get()?.n ?? 0,
      recentIncidents,recentMaintenance,directives
    }
  }
}
