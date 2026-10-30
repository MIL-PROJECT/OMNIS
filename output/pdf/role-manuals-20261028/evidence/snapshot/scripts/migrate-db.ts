import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { migrate } from '../src/main/database/migrate'

const path = process.argv[2]
if (!path) throw new Error('Usage: pnpm db:migrate <existing-db-path>')
const target = resolve(path)
if (!existsSync(target)) throw new Error('DB file does not exist')
const backup = `${target}.before-migration-${Date.now()}.db`
const db = new Database(target)
try { await db.backup(backup); db.pragma('foreign_keys = ON'); migrate(db); if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Integrity check failed'); console.log('Migrated', target, 'backup:', backup) } finally { db.close() }
