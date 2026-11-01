import { ensureAccountRecords } from './accountMigration'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { migrate } from './migrate'
import { seed } from './seed'

let db: Database.Database | undefined
export const dbPath = (): string => join(app.getPath('userData'), 'data', 'omnis.db')
export const seedPath = (): string => app.isPackaged ? join(process.resourcesPath, 'db', 'omnis-seed.db') : join(process.cwd(), 'resources', 'db', 'omnis-seed.db')
export function openDb(): Database.Database {
  if (db) return db
  const path = dbPath()
  mkdirSync(dirname(path), { recursive: true })
  if (!existsSync(path) && existsSync(seedPath())) copyFileSync(seedPath(), path)
  db = new Database(path)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 5000')
  try { migrate(db); seed(db); ensureAccountRecords(db) } catch (error) { db.close(); db = undefined; throw error }
  return db
}
export function closeDb(): void { db?.close(); db = undefined }
