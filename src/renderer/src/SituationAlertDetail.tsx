import { Box } from '@mui/material'
import { situationSeverityMeta, situationStatusText, situationTypeText, type SituationAlert } from '../../shared/situationAlerts'
import StatusChip from './StatusChip'
import { fmtDateTime } from './ui'

export default function SituationAlertDetail({alert}:{alert:SituationAlert}) {
  const fields:[string,string|null][] = [
    ['등급 / 유형',`${situationSeverityMeta[alert.severity][0]} / ${situationTypeText[alert.alert_type]}`],
    ['상황 내용',alert.description],['영향 범위',alert.impact_scope],['조치 지침',alert.action_guidance],
    ['담당 부서',alert.department],['대상 체계',alert.system_name],['등록자',alert.creator_name],
    ['발생 시각',fmtDateTime(alert.occurred_at)],
    ['확인 시각',alert.acknowledged_at ? fmtDateTime(alert.acknowledged_at) : '미확인'],
    ['종료 시각',alert.resolved_at ? fmtDateTime(alert.resolved_at) : '미종료']
  ]
  return <>
    <Box className="control-alert-detail-head"><span className="cell-code">{alert.alert_no}</span><StatusChip code={alert.status} label={situationStatusText[alert.status]}/></Box>
    <h3 className="control-alert-detail-title">{alert.title}</h3>
    <dl className="control-alert-detail">{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value || '-'}</dd></div>)}</dl>
  </>
}
