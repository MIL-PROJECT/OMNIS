import Database from 'better-sqlite3'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { migrate } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { SituationAlertRepository } from '../../src/main/repositories/SituationAlertRepository'
import { DashboardRepository } from '../../src/main/repositories/DashboardRepository'

describe('dashboard situation alerts',()=>{
  let db:Database.Database,repo:SituationAlertRepository,creator:string
  beforeAll(()=>{db=new Database(':memory:');db.pragma('foreign_keys=ON');migrate(db);seed(db);repo=new SituationAlertRepository(db);creator=(db.prepare("SELECT id FROM users WHERE role='ADMIN' LIMIT 1").get() as {id:string}).id})
  afterAll(()=>db.close())
  beforeEach(()=>db.prepare('DELETE FROM situation_alerts').run())
  const add=(id:string,severity='WARNING',status='OPEN',occurred='2030-01-01T00:00:00.000Z')=>db.prepare(`INSERT INTO situation_alerts (id,alert_no,alert_type,severity,title,description,status,occurred_at,created_by,created_at,updated_at) VALUES (?,?,'SERVER',?,?,?, ?,?,?,?,?)`).run(id,`ALT-${id}`,severity,id,'가상 상황 내용',status,occurred,creator,occurred,occurred)
  it('returns zero counts and no preview when all alerts are resolved',()=>{
    add('closed','CRITICAL','RESOLVED')
    expect(repo.summary()).toEqual({openAlertCount:0,criticalAlertCount:0,activeAlertPreview:[]})
    expect(repo.list()).toHaveLength(1)
  })
  it('prioritizes severity, unacknowledged state, time and ID; bounds only the preview',()=>{
    add('c0','CRITICAL','ACKNOWLEDGED','2039-01-01T00:00:00.000Z')
    add('c1','CRITICAL');add('c2','CRITICAL')
    add('w','WARNING','OPEN','2040-01-01T00:00:00.000Z')
    add('i','INFO','OPEN','2041-01-01T00:00:00.000Z')
    add('r','CRITICAL','RESOLVED','2042-01-01T00:00:00.000Z')
    const result=repo.summary()
    expect(result.openAlertCount).toBe(5);expect(result.criticalAlertCount).toBe(3)
    expect(result.activeAlertPreview.map(row=>row.id)).toEqual(['c2','c1'])
    expect(Object.keys(result.activeAlertPreview[0]).sort()).toEqual(['id','alert_no','severity','title','impact_scope','status','occurred_at'].sort())
    expect(repo.list().filter(row=>row.status!=='RESOLVED').map(row=>row.id)).toEqual(['c2','c1','c0','w','i'])
    expect(repo.list('ACKNOWLEDGED').map(row=>row.id)).toEqual(['c0'])
  })
  it('keeps acknowledged alerts active, drops resolved ones and never marks a read as acknowledged',()=>{
    add('a');add('b','INFO','ACKNOWLEDGED')
    const auditBefore=db.prepare('SELECT count(*) n FROM audit_logs').get()
    const summary=new DashboardRepository(db).summary({id:creator,role:'USER'})
    expect(summary.openAlertCount).toBe(2)
    expect(summary.activeAlertPreview.map(row=>row.id)).toEqual(['a','b'])
    repo.list();repo.summary()
    expect(db.prepare("SELECT status FROM situation_alerts WHERE id='a'").get()).toEqual({status:'OPEN'})
    expect(db.prepare('SELECT count(*) n FROM audit_logs').get()).toEqual(auditBefore)
    db.prepare("UPDATE situation_alerts SET status='RESOLVED' WHERE id='a'").run()
    expect(repo.summary()).toMatchObject({openAlertCount:1,criticalAlertCount:0})
    expect(repo.summary().activeAlertPreview.map(row=>row.id)).toEqual(['b'])
    expect(repo.list()).toHaveLength(2)
  })
})
