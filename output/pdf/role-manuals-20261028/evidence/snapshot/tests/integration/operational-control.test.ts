import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../../src/main/database/migrate'
import { seed } from '../../src/main/database/seed'
import { runOperationalChannel } from '../../src/main/services/OperationalControlService'
import type { PublicUser } from '../../src/shared/contracts'

type Row = Record<string, unknown>

describe('operational control service', () => {
  it('enforces roles and persists plan, alert, close, handover, and demo lifecycle', async () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    migrate(db); seed(db)
    const user = (role: PublicUser['role']) => db.prepare('SELECT id,username,display_name,rank_name,unit_name,role FROM users WHERE role=? LIMIT 1').get(role) as PublicUser
    const admin = user('ADMIN'), operator = user('OPERATOR'), maintainer = user('MAINTAINER'), viewer = user('VIEWER')
    const ownTeam = db.prepare('SELECT team_id FROM team_members WHERE user_id=?').get(maintainer.id) as Row
    const otherTeam = db.prepare('SELECT id FROM maintenance_teams WHERE id<>? LIMIT 1').get(ownTeam.team_id) as Row
    const date = '2030-01-15'

    await expect(runOperationalChannel(db,'control:createAlert',{ alertType:'SERVER',severity:'WARNING',title:'가상 서버 주의',description:'권한 검증용 가상 경보',occurredAt:new Date().toISOString() },viewer)).rejects.toThrow('권한')
    const alert = await runOperationalChannel(db,'control:createAlert',{ alertType:'SERVER',severity:'WARNING',title:'가상 서버 주의',description:'권한 검증용 가상 경보',occurredAt:new Date().toISOString() },operator) as Row
    expect(db.prepare('SELECT status FROM situation_alerts WHERE id=?').get(alert.id)).toEqual({ status:'OPEN' })

    await runOperationalChannel(db,'control:upsertDailyPlan',{ date,teamId:ownTeam.team_id,plannedCount:2,unplannedCount:1,completedCount:2,incompleteReason:'가상 부품 대기',carryOverCount:1 },maintainer)
    await expect(runOperationalChannel(db,'control:upsertDailyPlan',{ date,teamId:otherTeam.id,plannedCount:1,unplannedCount:0,completedCount:0,incompleteReason:'가상 대기',carryOverCount:1 },maintainer)).rejects.toThrow('소속 정비반')

    const handover = await runOperationalChannel(db,'control:handoverDraft',{ date,shiftType:'DAY' },operator) as Row
    expect(String(handover.text)).toContain('근무 인수인계')
    await runOperationalChannel(db,'control:saveHandover',{ date,shiftType:'DAY',text:String(handover.text),confirm:true },operator)
    expect(db.prepare("SELECT count(*) n FROM handover_notes WHERE status='CONFIRMED'").get()).toEqual({ n:1 })

    const closed = await runOperationalChannel(db,'control:closeDay',{ date,allowExceptions:true },admin) as Row
    expect((closed.summary as Row).planned).toBe(2)
    await expect(runOperationalChannel(db,'control:closeDay',{ date,allowExceptions:true },admin)).rejects.toThrow('이미 마감')

    const prepared = await runOperationalChannel(db,'demo:prepare',{ scenario:'EVALUATION' },admin) as Row
    expect(db.prepare('SELECT count(*) n FROM incidents WHERE id=?').get((prepared.entityIds as Row).incidentId)).toEqual({ n:1 })
    await runOperationalChannel(db,'demo:reset',{ scenario:'EVALUATION' },admin)
    expect(db.prepare("SELECT count(*) n FROM demo_scenarios WHERE scenario_key='EVALUATION'").get()).toEqual({ n:0 })
    db.close()
  })
})
