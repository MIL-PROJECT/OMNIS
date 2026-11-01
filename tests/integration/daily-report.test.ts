import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { migrate } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { dailyReportIncidents } from '../../src/main/services/DailyReport'

describe('daily PDF date boundary',()=>{
  it('uses the same Korean calendar date as the on-screen daily report',()=>{
    const db=new Database(':memory:')
    try{
      migrate(db);seed(db)
      db.prepare("UPDATE incidents SET reported_at='2000-01-01T00:00:00.000Z'").run()
      const rows=db.prepare('SELECT id,ticket_no FROM incidents ORDER BY id LIMIT 4').all() as {id:string;ticket_no:string}[]
      const times=['2026-10-31T14:59:59.000Z','2026-10-31T15:00:00.000Z','2026-11-01T14:59:59.000Z','2026-11-01T15:00:00.000Z']
      rows.forEach((row,i)=>db.prepare('UPDATE incidents SET reported_at=? WHERE id=?').run(times[i],row.id))
      expect(dailyReportIncidents(db,'2026-11-01').map(row=>row.ticket_no)).toEqual([rows[1].ticket_no,rows[2].ticket_no])
      expect(dailyReportIncidents(db,'2026-11-02').map(row=>row.ticket_no)).toEqual([rows[3].ticket_no])
      expect(dailyReportIncidents(db,'1990-01-01')).toEqual([])
    }finally{db.close()}
  })
})
