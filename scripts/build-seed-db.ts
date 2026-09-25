import Database from 'better-sqlite3'
import { mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { migrate } from '../src/main/database/migrate'
import { seed } from '../src/main/database/seed'

const target = resolve('resources/db/afccs-seed.db')
mkdirSync(dirname(target), { recursive: true })
if (existsSync(target)) unlinkSync(target)
const db = new Database(target)
db.pragma('foreign_keys = ON')
migrate(db)
if (!process.argv.includes('--migrate-only')) seed(db)
const integrity = db.pragma('integrity_check', { simple: true })
if (integrity !== 'ok') throw new Error(`Seed DB integrity: ${integrity}`)
console.log('Seed DB built:', target)
for (const table of ['users', 'communication_systems', 'incidents', 'maintenance_tasks', 'duty_roster', 'directives']) console.log(table, (db.prepare(`SELECT count(*) n FROM ${table}`).get() as { n: number }).n)
db.close()
