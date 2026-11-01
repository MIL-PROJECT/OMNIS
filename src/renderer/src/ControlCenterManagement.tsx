import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Tabs, TextField } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AddAlertRounded from '@mui/icons-material/AddAlertRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import FactCheckRounded from '@mui/icons-material/FactCheckRounded'
import GroupsRounded from '@mui/icons-material/GroupsRounded'
import PlaylistAddCheckRounded from '@mui/icons-material/PlaylistAddCheckRounded'
import PublishedWithChangesRounded from '@mui/icons-material/PublishedWithChangesRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import { Card, Meter, PageHeader, fmtDateTime, type Tone } from './ui'
import { koreaDate, koreaDateTimeInput } from '../../shared/date'
import { situationSeverityMeta, situationStatusText, situationTypeText, type SituationAlert } from '../../shared/situationAlerts'
import SituationAlertDetail from './SituationAlertDetail'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel,payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const today = koreaDate()
const alertMeta: Record<string,readonly[string,Tone]> = situationSeverityMeta
const alertStatus: Record<string,string> = situationStatusText
const typeText: Record<string,string> = situationTypeText
const issueTypeText: Record<string,string> = { INCIDENT_RESULT_MISSING:'고장 조치결과 누락',STATUS_MISMATCH:'고장·정비 상태 불일치',INCOMPLETE_REASON_MISSING:'미완료 사유 누락' }
const planRowHeight = () => 'auto' as const
const estimatedPlanRowHeight = () => 76

export default function ControlCenterManagement({ user }: { user: PublicUser }) {
  const [tab,setTab] = useState(0), [date,setDate] = useState(today), [overview,setOverview] = useState<Row | null>(null), [teams,setTeams] = useState<Row[]>([])
  const [alerts,setAlerts] = useState<SituationAlert[]>([]), [plans,setPlans] = useState<Row[]>([]), [issues,setIssues] = useState<Row[]>([])
  const [searchParams,setSearchParams] = useSearchParams()
  const [alertsLoaded,setAlertsLoaded] = useState(false),[alertNotice,setAlertNotice] = useState('')
  const requestedAlertId=searchParams.get('alertId')
  const [alertForm,setAlertForm] = useState<Row | null>(null), [planForm,setPlanForm] = useState<Row | null>(null), [handover,setHandover] = useState(''), [handoverId,setHandoverId] = useState<string | undefined>()
  const [shift,setShift] = useState('DAY'), [busy,setBusy] = useState(false)
  const [selectedAlertId,setSelectedAlertId] = useState<string | null>(null)
  const selectedAlert = alerts.find(row => row.id === selectedAlertId)
  const canControl = ['ADMIN','OPERATOR'].includes(user.role), canPlan = ['ADMIN','MAINTAINER'].includes(user.role), admin = user.role === 'ADMIN'
  const refresh = () => Promise.all([
    call<Row>('control:overview',{ date }).then(setOverview), call<Row[]>('control:teams').then(setTeams), call<SituationAlert[]>('control:alerts').then(rows=>{setAlerts(rows);setAlertsLoaded(true)}),
    call<Row[]>('control:dailyPlans',{ date }).then(setPlans), call<Row[]>('control:reconciliation',{ date }).then(setIssues)
  ]).catch(e => alert(e.message))
  useEffect(() => { refresh() }, [date])
  useEffect(()=>{
    if(requestedAlertId===null||!alertsLoaded)return
    setTab(0)
    if(alerts.some(row=>row.id===requestedAlertId)){setSelectedAlertId(requestedAlertId);setAlertNotice('')}
    else {setSelectedAlertId(null);setAlertNotice('경보를 찾을 수 없습니다.')}
    const next=new URLSearchParams(searchParams);next.delete('alertId');setSearchParams(next,{replace:true})
  },[requestedAlertId,alertsLoaded,alerts,searchParams,setSearchParams])
  const total = Number(overview?.planned ?? 0) + Number(overview?.unplanned ?? 0), completion = total ? Math.round(Number(overview?.completed ?? 0) / total * 100) : 0
  const saveAlert = () => { if (!alertForm) return; setBusy(true); call('control:createAlert',{...alertForm,occurredAt:new Date(alertForm.occurredAt).toISOString()}).then(() => { setAlertForm(null); refresh() }).catch(e => alert(e.message)).finally(() => setBusy(false)) }
  const changeAlert = (id:string,action:'ACKNOWLEDGE'|'RESOLVE') => { setBusy(true); call('control:updateAlert',{ id,action }).then(refresh).catch(e => alert(e.message)).finally(() => setBusy(false)) }
  const savePlan = () => { if (!planForm) return; setBusy(true); call('control:upsertDailyPlan',{ date,teamId:planForm.team_id,plannedCount:Number(planForm.planned_count),unplannedCount:Number(planForm.unplanned_count),completedCount:Number(planForm.completed_count),incompleteReason:planForm.incomplete_reason || undefined,carryOverCount:Number(planForm.carry_over_count) }).then(() => { setPlanForm(null); refresh() }).catch(e => alert(e.message)).finally(() => setBusy(false)) }
  const generateHandover = () => call<Row>('control:handoverDraft',{ date,shiftType:shift }).then(r => { setHandover(r.text); setHandoverId(undefined) }).catch(e => alert(e.message))
  const saveHandover = (confirm:boolean) => call<Row>('control:saveHandover',{ ...(handoverId ? { id:handoverId } : {}),date,shiftType:shift,text:handover,confirm }).then(r => { setHandoverId(r.id); alert(confirm ? '인수인계를 확정했습니다.' : '인수인계 초안을 저장했습니다.') }).catch(e => alert(e.message))
  const closeDay = () => { if (!admin) return; const allowExceptions = issues.filter(x => x.status === 'OPEN').length > 0; if (!confirm(allowExceptions ? `미해결 항목 ${issues.length}건을 관리자 예외로 마감하시겠습니까?` : `${date} 업무를 마감하시겠습니까?`)) return; call('control:closeDay',{ date,allowExceptions }).then(() => { alert('일일 마감을 완료했습니다.'); refresh() }).catch(e => alert(e.message)) }
  const prepareDemo = () => call<Row>('demo:prepare',{ scenario:'EVALUATION' }).then(r => alert(r.existing ? '평가 시나리오가 이미 준비되어 있습니다.' : '평가 시나리오를 준비했습니다. 고장관리에서 확인하십시오.')).catch(e => alert(e.message))
  const resetDemo = () => { if (!confirm('OMNIS가 생성한 평가 시나리오 데이터만 삭제하시겠습니까?')) return; call<Row>('demo:reset',{scenario:'EVALUATION'}).then(r=>{alert(r.removed?'평가 시나리오를 초기화했습니다.':'초기화할 평가 시나리오가 없습니다.');refresh()}).catch(e=>alert(e.message)) }
  const metrics = useMemo(() => [
    ['상황경보',overview?.openAlerts ?? 0,'건',overview?.criticalAlerts ? `긴급 ${overview.criticalAlerts}건`:'긴급 경보 없음','orange'],
    ['SLA 위험',overview?.slaOverdue ?? 0,'건','기한 초과 미종결','red'],
    ['일일 완료율',completion,'%',`${overview?.completed ?? 0}/${total}건 완료`,'green'],
    ['이월 작업',overview?.carryOver ?? 0,'건',overview?.closed ? '마감 완료':'마감 전','sky']
  ] as [string,number,string,string,Tone][],[overview,completion,total])
  const alertColumns: GridColDef[] = [
    { field:'alert_no',headerName:'경보번호',width:150,renderCell:({row}) => <span className="cell-code control-alert-cell-text" title={row.alert_no}>{row.alert_no}</span> },
    { field:'severity',headerName:'등급',width:90,renderCell:({row}) => <StatusChip code={row.severity} label={alertMeta[row.severity]?.[0] ?? row.severity} tone={alertMeta[row.severity]?.[1] ?? 'gray'} /> },
    { field:'title',headerName:'상황',flex:1.5,minWidth:160,renderCell:({row}) => <span className="cell-strong control-alert-cell-text" title={row.title}>{row.title}</span> },
    { field:'alert_type',headerName:'유형',width:110,valueFormatter:v => typeText[String(v)] ?? String(v) },
    { field:'impact_scope',headerName:'영향범위',flex:1,minWidth:100,renderCell:({row}) => <span className="control-alert-cell-text" title={row.impact_scope}>{row.impact_scope || '-'}</span> },
    { field:'status',headerName:'상태',width:100,renderCell:({row}) => <StatusChip code={row.status} label={alertStatus[row.status] ?? row.status} /> },
    { field:'occurred_at',headerName:'발생시각',width:150,renderCell:({row}) => <span className="cell-muted">{fmtDateTime(row.occurred_at)}</span> },
    { field:'actions',headerName:'상세',width:104,align:'center',headerAlign:'center',cellClassName:'control-alert-action-cell',sortable:false,filterable:false,disableColumnMenu:true,renderCell:({row,hasFocus}) => <Button className="control-alert-detail-button" size="small" variant="text" tabIndex={hasFocus ? 0 : -1} aria-label="상황경보 상세보기" endIcon={<ChevronRightRounded/>} onClick={()=>setSelectedAlertId(row.id)}>상세</Button> }
  ]
  const planColumns: GridColDef[] = [
    { field:'name',headerName:'정비반',flex:1.5,minWidth:240,renderCell:({row}) => <Box className="control-plan-team"><span className="control-plan-name">{row.name}</span><span className="control-plan-average">평균 {row.average_resolution_minutes}분</span></Box> },
    { field:'planned_count',headerName:'계획',width:72,align:'center',headerAlign:'center' },{ field:'unplanned_count',headerName:'비계획',width:72,align:'center',headerAlign:'center' },{ field:'completed_count',headerName:'완료',width:72,align:'center',headerAlign:'center' },{ field:'carry_over_count',headerName:'이월',width:72,align:'center',headerAlign:'center' },
    { field:'rate',headerName:'완료율',width:160,renderCell:({row}) => { const sum=Number(row.planned_count)+Number(row.unplanned_count),v=sum?Math.round(Number(row.completed_count)/sum*100):0; return <Meter value={v} tone={v>=80?'green':v>=50?'orange':'red'} /> } },
    { field:'incomplete_reason',headerName:'미완료 사유',flex:1,minWidth:180,renderCell:({row}) => <span className="control-plan-reason">{row.incomplete_reason || '-'}</span> },
    { field:'actions',headerName:'',width:90,sortable:false,renderCell:({row}) => canPlan && !row.closed_at && <Button size="small" onClick={()=>setPlanForm({...row})}>입력</Button> }
  ]
  const issueColumns: GridColDef[] = [
    { field:'issue_type',headerName:'검사유형',width:190,renderCell:({row}) => <span className="cell-code control-alert-cell-text" title={issueTypeText[row.issue_type] ?? row.issue_type}>{issueTypeText[row.issue_type] ?? row.issue_type}</span> },
    { field:'description',headerName:'점검 결과',flex:1,minWidth:300 },
    { field:'status',headerName:'상태',width:128,disableColumnMenu:true,cellClassName:'control-issue-status',headerClassName:'control-issue-status',renderCell:({row}) => <StatusChip code={row.status} label={row.status === 'OPEN' ? '확인필요' : row.status === 'EXCEPTION' ? '예외승인' : '해결'} tone={row.status === 'OPEN' ? 'red' : 'green'} /> }
  ]
  return <>
    <PageHeader section="운용 현황" title="통제 · 일일마감" description="상황경보, 정비반 작업계획, 데이터 정합성, 근무 인수인계를 한 흐름으로 통제합니다."
      actions={<><TextField type="date" label="기준일" slotProps={{ inputLabel:{ shrink:true } }} value={date} onChange={e=>setDate(e.target.value)}/>{admin && <Button variant="outlined" onClick={prepareDemo}>평가 시나리오 준비</Button>}{admin && <Button color="error" onClick={resetDemo}>시연 초기화</Button>}</>} />
    <div className="metrics control-metrics">{metrics.map(([label,value,unit,foot,tone]) => <Box className="metric" key={label}><Box className="metric-top"><span className="metric-label">{label}</span><i className={`dot tone-${tone}`}/></Box><Box className="metric-value">{value}<small>{unit}</small></Box><Box className="metric-foot">{foot}</Box></Box>)}</div>
    <Card icon={PublishedWithChangesRounded} tone="lavender" title="운영 통제" subtitle={`${date} · ${overview?.closed ? '마감 완료':'업무 진행 중'}`}>
      <Box className="ui-toolbar control-toolbar"><Tabs value={tab} onChange={(_,v)=>setTab(v)} variant="scrollable" scrollButtons="auto" aria-label="운영 통제 메뉴" className="ui-seg-tabs"><Tab label="상황경보"/><Tab label="08:30 · 16:00 작업판"/><Tab label="정합성 · 마감"/><Tab label="근무 인수인계"/><Tab label="정비반"/></Tabs><span className="spacer"/>{tab===0&&canControl&&<Button variant="contained" startIcon={<AddAlertRounded/>} onClick={()=>setAlertForm({ alertType:'GPS_INTERFERENCE',severity:'WARNING',title:'',description:'',impactScope:'',actionGuidance:'',department:'',occurredAt:koreaDateTimeInput() })}>상황경보 등록</Button>}</Box>
      {tab===0&&<>{alertNotice&&<Alert severity="info">{alertNotice}</Alert>}<DataGrid className="control-alert-grid" rows={alerts} columns={alertColumns} density="compact" rowHeight={48} columnHeaderHeight={44} disableRowSelectionOnClick pageSizeOptions={[10,25]} initialState={{pagination:{paginationModel:{pageSize:10,page:0}}}} localeText={{noRowsLabel:'등록된 상황경보가 없습니다'}}/></>}
      {tab===1&&<><Box className="control-callout"><span className="ui-icon-tile tone-lavender" aria-hidden><PlaylistAddCheckRounded/></span><Box className="control-callout-copy"><strong>{overview?.planTime ?? '08:30'} 작업계획 · {overview?.closeTime ?? '16:00'} 완료현황</strong><span>계획·비계획 작업을 합산하고 미완료 사유와 다음 날 이월 건수를 기록합니다.</span></Box></Box><DataGrid className="control-plan-grid" rows={plans} getRowId={r=>r.team_id} columns={planColumns} getRowHeight={planRowHeight} getEstimatedRowHeight={estimatedPlanRowHeight} columnHeaderHeight={44} disableRowSelectionOnClick hideFooter/></>}
      {tab===2&&<><Box className="control-callout"><span className="ui-icon-tile tone-lavender" aria-hidden><FactCheckRounded/></span><Box className="control-callout-copy"><strong>마감 전 자동 정합성 검사</strong><span>조치결과 누락, 고장·정비 상태 불일치, 미완료 사유 누락을 확인합니다.</span></Box><span className="spacer"/>{admin&&<Button variant="contained" disabled={!!overview?.closed} onClick={closeDay}>{overview?.closed?'마감 완료':'일일 마감'}</Button>}</Box><DataGrid className="control-issue-grid" rows={issues.map((r,i)=>({...r,id:r.id??`${r.issue_type}-${r.entity_id}-${i}`}))} columns={issueColumns} density="compact" rowHeight={48} columnHeaderHeight={44} disableRowSelectionOnClick hideFooter localeText={{noRowsLabel:'정합성 이상이 없습니다'}}/></>}
      {tab===3&&<Stack spacing={2} className="control-handover"><Box className="ui-toolbar control-handover-toolbar"><TextField select label="교대" value={shift} onChange={e=>setShift(e.target.value)} sx={{minWidth:150}}><MenuItem value="DAY">주간</MenuItem><MenuItem value="NIGHT">야간</MenuItem><MenuItem value="DUTY">당직</MenuItem></TextField><Button variant="outlined" onClick={generateHandover}>업무현황에서 초안 생성</Button><span className="spacer"/><Button disabled={handover.trim().length<10} onClick={()=>saveHandover(false)}>초안 저장</Button><Button variant="contained" disabled={handover.trim().length<10} onClick={()=>saveHandover(true)}>인수인계 확정</Button></Box><TextField label="인수인계 내용" multiline minRows={14} value={handover} onChange={e=>setHandover(e.target.value)} helperText="생성된 초안을 확인·수정한 뒤 저장 또는 확정하십시오."/></Stack>}
      {tab===4&&<Box className="team-board">{teams.map(team=><Box className="team-card" key={team.id}><Box className="team-card-head"><span className="ui-icon-tile tone-sky" aria-hidden><GroupsRounded/></span><Box className="team-card-title"><strong className="team-card-name">{team.name}</strong><span className="team-card-code">{team.code}</span></Box><StatusChip code={team.available?'AVAILABLE':'UNAVAILABLE'} label={team.available?'가용':'비가용'} tone={team.available?'green':'red'}/></Box><dl><div><dt>전문분야</dt><dd>{team.specialties||'-'}</dd></div><div><dt>담당체계</dt><dd>{team.system_categories||'-'}</dd></div><div><dt>근무자</dt><dd>{team.member_names||'-'}</dd></div><div><dt>활성작업</dt><dd>{team.active_count}건</dd></div></dl></Box>)}</Box>}
    </Card>

    <Dialog open={!!selectedAlert} onClose={()=>setSelectedAlertId(null)} fullWidth maxWidth="sm" aria-labelledby="control-alert-detail-title">
      <DialogTitle id="control-alert-detail-title">상황경보 상세</DialogTitle>
      <DialogContent>{selectedAlert&&<><SituationAlertDetail alert={selectedAlert}/><p className="control-alert-detail-note">{selectedAlert.status === 'RESOLVED' ? '종료된 경보입니다. 내용과 처리 시각은 이력으로 보관됩니다.' : canControl ? '상황 확인은 경보를 확인했다는 기록입니다. 조치가 끝나면 상황 종료를 선택하십시오.' : '관리자·운용요원이 상황을 확인하고 종료할 수 있습니다.'} 경보 종료는 고장·정비 작업의 상태를 변경하지 않습니다.</p></>}</DialogContent>
      <DialogActions><Button onClick={()=>setSelectedAlertId(null)}>닫기</Button>{canControl&&selectedAlert?.status==='OPEN'&&<Button variant="outlined" disabled={busy} onClick={()=>changeAlert(selectedAlert.id,'ACKNOWLEDGE')}>상황 확인</Button>}{canControl&&selectedAlert&&selectedAlert.status!=='RESOLVED'&&<Button variant="contained" disabled={busy} onClick={()=>changeAlert(selectedAlert.id,'RESOLVE')}>상황 종료</Button>}</DialogActions>
    </Dialog>
    <Dialog open={!!alertForm} onClose={()=>setAlertForm(null)} fullWidth maxWidth="sm"><DialogTitle>상황경보 등록</DialogTitle><DialogContent>{alertForm&&<Stack spacing={2} sx={{mt:1}}><Stack direction="row" spacing={1.5}><TextField select label="유형" sx={{flex:1}} value={alertForm.alertType} onChange={e=>setAlertForm({...alertForm,alertType:e.target.value})}>{Object.entries(typeText).map(([v,t])=><MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField><TextField select label="심각도" sx={{flex:1}} value={alertForm.severity} onChange={e=>setAlertForm({...alertForm,severity:e.target.value})}>{Object.entries(alertMeta).map(([v,[t]])=><MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField></Stack><TextField label="제목" value={alertForm.title} onChange={e=>setAlertForm({...alertForm,title:e.target.value})}/><TextField label="내용" multiline rows={3} value={alertForm.description} onChange={e=>setAlertForm({...alertForm,description:e.target.value})}/><TextField label="영향 범위" value={alertForm.impactScope} onChange={e=>setAlertForm({...alertForm,impactScope:e.target.value})}/><TextField label="조치 지침" multiline rows={2} value={alertForm.actionGuidance} onChange={e=>setAlertForm({...alertForm,actionGuidance:e.target.value})}/><Stack direction="row" spacing={1.5}><TextField label="담당 부서" sx={{flex:1}} value={alertForm.department} onChange={e=>setAlertForm({...alertForm,department:e.target.value})}/><TextField type="datetime-local" label="발생 시각" sx={{flex:1}} slotProps={{inputLabel:{shrink:true}}} value={alertForm.occurredAt} onChange={e=>setAlertForm({...alertForm,occurredAt:e.target.value})}/></Stack></Stack>}</DialogContent><DialogActions><Button onClick={()=>setAlertForm(null)}>취소</Button><Button variant="contained" disabled={busy||!alertForm?.title||!alertForm?.description} onClick={saveAlert}>등록</Button></DialogActions></Dialog>
    <Dialog open={!!planForm} onClose={()=>setPlanForm(null)} fullWidth maxWidth="sm"><DialogTitle>{planForm?.name} 일일 작업현황</DialogTitle><DialogContent>{planForm&&<Stack spacing={2} sx={{mt:1}}><Stack direction="row" spacing={1.5}>{[['planned_count','계획 건수'],['unplanned_count','비계획 건수'],['completed_count','완료 건수'],['carry_over_count','이월 건수']].map(([key,label])=><TextField key={key} type="number" label={label} value={planForm[key]} onChange={e=>setPlanForm({...planForm,[key]:Number(e.target.value)})} slotProps={{htmlInput:{min:0}}}/>)}</Stack><TextField label="미완료 사유" multiline rows={3} value={planForm.incomplete_reason||''} onChange={e=>setPlanForm({...planForm,incomplete_reason:e.target.value})} helperText="미완료 작업이 있으면 사유를 입력하십시오."/></Stack>}</DialogContent><DialogActions><Button onClick={()=>setPlanForm(null)}>취소</Button><Button variant="contained" disabled={busy} onClick={savePlan}>저장</Button></DialogActions></Dialog>
  </>
}
