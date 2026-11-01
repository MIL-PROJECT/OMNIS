import type Database from 'better-sqlite3'
import type { SituationAlert, SituationAlertPreview, SituationAlertStatus, SituationAlertSummary } from '../../shared/situationAlerts'

const active = "status IN ('OPEN','ACKNOWLEDGED')"
const order = `CASE a.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
  CASE a.status WHEN 'OPEN' THEN 0 WHEN 'ACKNOWLEDGED' THEN 1 ELSE 2 END,a.occurred_at DESC,a.id DESC`

export class SituationAlertRepository {
  constructor(private db:Database.Database) {}
  counts():Pick<SituationAlertSummary,'openAlertCount'|'criticalAlertCount'> {
    return this.db.prepare(`SELECT count(*) openAlertCount,COALESCE(sum(severity='CRITICAL'),0) criticalAlertCount FROM situation_alerts WHERE ${active}`).get() as Pick<SituationAlertSummary,'openAlertCount'|'criticalAlertCount'>
  }
  summary():SituationAlertSummary {
    return this.db.transaction(() => ({
      ...this.counts(),
      activeAlertPreview:this.db.prepare(`SELECT a.id,a.alert_no,a.severity,a.title,a.impact_scope,a.status,a.occurred_at FROM situation_alerts a WHERE ${active} ORDER BY ${order} LIMIT 2`).all() as SituationAlertPreview[]
    }))()
  }
  list(status?:SituationAlertStatus):SituationAlert[] {
    return this.db.prepare(`SELECT a.*,c.name system_name,creator.display_name creator_name
      FROM situation_alerts a LEFT JOIN communication_systems c ON c.id=a.system_id LEFT JOIN users creator ON creator.id=a.created_by
      WHERE (? IS NULL OR a.status=?) ORDER BY ${order}`).all(status??null,status??null) as SituationAlert[]
  }
}
