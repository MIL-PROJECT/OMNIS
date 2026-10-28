import TaskChecklistPanel from './TaskChecklistPanel'
import RecurringMaintenance from './RecurringMaintenance'
import { type WorkTemplate } from '../../shared/usability'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import koLocale from '@fullcalendar/core/locales/ko'
import AddRounded from '@mui/icons-material/AddRounded'
import BuildRounded from '@mui/icons-material/BuildRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip, { statusTone } from './StatusChip'
import { Card, Meter, PageHeader, RowActions, SearchField, StatusFilter, countBy, fmtDateTime, weekday, type Tone } from './ui'
import { koreaDate } from '../../shared/date'
import AttachmentsPanel from './AttachmentsPanel'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel,payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const statusLabel: Record<string,string> = { PLANNED:'계획',IN_PROGRESS:'진행',BLOCKED:'보류',COMPLETED:'완료',CANCELED:'취소' }
const statusTones: [string, Tone][] = [['PLANNED','sky'],['IN_PROGRESS','orange'],['BLOCKED','red'],['COMPLETED','green'],['CANCELED','gray']]
const toneOf = (s: string): Tone => statusTones.find(x => x[0] === s)?.[1] ?? 'gray'
const next: Record<string,string[]> = { PLANNED:['IN_PROGRESS','CANCELED'], IN_PROGRESS:['BLOCKED','COMPLETED','CANCELED'], BLOCKED:['IN_PROGRESS','CANCELED'] }
const empty = { title:'',maintenanceType:'정기점검',workKind:'PLANNED',priority:'NORMAL',department:'가상 정비반',scheduledDate:koreaDate(),incidentId:'',description:'' }
const priorityChip = (v: string) => <StatusChip code={v} label={v === 'HIGH' ? '높음' : '일반'} tone={v === 'HIGH' ? 'red' : 'gray'} />

export default function MaintenanceManagement({ user }: { user: PublicUser }) {
  const [params]=useSearchParams(),navigate=useNavigate()
  const [checkTemplates,setCheckTemplates]=useState<WorkTemplate[]>([])
  const [recurringOpen,setRecurringOpen]=useState(false)
  const closeDetail=()=>{setSelected(null);if(params.get('from')==='mine')navigate('/?view=mine');else if(params.has('detail'))navigate('/maintenance',{replace:true})}
  useEffect(()=>{const id=params.get('detail');if(id)call<Row>('maintenance:get',{id}).then(show).catch(e=>{alert(e.message);navigate(params.get('from')==='mine'?'/?view=mine':'/maintenance',{replace:true})})},[params.get('detail')])
  useEffect(()=>{call<WorkTemplate[]>('templates:list',{kind:'CHECKLIST'}).then(setCheckTemplates)},[])
  const [rows,setRows] = useState<Row[]>([]), [incidents,setIncidents] = useState<Row[]>([]), [tab,setTab] = useState(0), [search,setSearch] = useState(''), [filter,setFilter] = useState(''), [form,setForm] = useState<Row | null>(null), [selected,setSelected] = useState<Row | null>(null), [events,setEvents] = useState<Row[]>([])
  const [resultForm,setResultForm] = useState<Row>({ result:'',cause:'',actionDetail:'',partsUsed:'',resolutionMode:'REMOTE',recurrenceRisk:'LOW',followUpDate:'' })
  const editable = ['ADMIN','MAINTAINER'].includes(user.role)
  const canEdit = (row: Row) => !['COMPLETED','CANCELED'].includes(row.status)&&(user.role === 'ADMIN' || (user.role === 'MAINTAINER' && row.assignee_id === user.id))
  const refresh = () => call<Row[]>('maintenance:list',{ search }).then(setRows)
  useEffect(() => { refresh() }, [search])
  useEffect(() => { call<Row[]>('incidents:list',{}).then(setIncidents) }, [])
  const counts = countBy(rows, 'status'), shown = filter ? rows.filter(r => r.status === filter) : rows
  const done = rows.length ? Math.round((counts.COMPLETED ?? 0) / rows.length * 100) : 0
  const [saving,setSaving]=useState(false)
  const save = () => { if (!form||saving) return;setSaving(true); const { id, ...raw } = form, fields={...raw,incidentId:raw.incidentId || null}; call(id ? 'maintenance:update' : 'maintenance:create',id ? { id, ...fields } : fields).then(() => { setForm(null); refresh() }).catch(e => alert(e.message)).finally(()=>setSaving(false)) }
  const show = (row: Row) => { setSelected(row); setResultForm({ result:row.result ?? '',cause:row.cause ?? '',actionDetail:row.action_detail ?? '',partsUsed:row.parts_used ?? '',resolutionMode:row.resolution_mode ?? 'REMOTE',recurrenceRisk:row.recurrence_risk ?? 'LOW',followUpDate:row.follow_up_date ?? '' }); call<Row[]>('maintenance:getEvents',{ id:row.id }).then(setEvents) }
  const columns: GridColDef[] = [
    { field:'task_no',headerName:'작업번호',width:150,renderCell:({row}) => <span className="cell-code">{row.task_no}</span> },
    { field:'title',headerName:'작업명',flex:1,minWidth:200,renderCell:({row}) => <span className="cell-strong">{row.title}</span> },
    { field:'status',headerName:'상태',width:84,renderCell:({row}) => <StatusChip code={row.status} label={statusLabel[row.status] ?? row.status}/> },
    { field:'work_kind',headerName:'구분',width:90,renderCell:({row}) => <StatusChip code={row.work_kind} label={row.work_kind === 'UNPLANNED' ? '비계획' : '계획'} tone={row.work_kind === 'UNPLANNED' ? 'orange' : 'sky'} /> },
    { field:'priority',headerName:'우선순위',width:90,renderCell:({row}) => priorityChip(row.priority) },
    { field:'department',headerName:'부서',width:120,renderCell:({row}) => <span className="cell-muted">{row.department}</span> },
    { field:'scheduled_date',headerName:'예정일',width:120,renderCell:({row}) => <span className="cell-muted">{row.scheduled_date} ({weekday(row.scheduled_date)})</span> },
    { field:'progress',headerName:'진행률',width:170,renderCell:({row}) => <Meter value={row.progress} tone={toneOf(row.status)} /> },
    { field:'actions',headerName:'',width:92,sortable:false,renderCell:({row}) => <RowActions onView={() => show(row)} onEdit={canEdit(row) ? () => setForm({ id:row.id,title:row.title,maintenanceType:row.maintenance_type,workKind:row.work_kind ?? 'PLANNED',priority:row.priority,department:row.department,scheduledDate:row.scheduled_date,incidentId:row.incident_id ?? '',description:row.description ?? '' }) : undefined} /> }
  ]
  return <>
    <PageHeader section="운용 현황" title="정비관리" description="정비 작업 계획과 진행 상황을 목록과 캘린더로 관리합니다."
      actions={editable && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({ ...empty, checklistTemplateId:'check-general' })}>작업 등록</Button>} />
    {editable&&<Box sx={{mb:1}}><Button variant="outlined" onClick={()=>setRecurringOpen(true)}>반복 정비</Button></Box>}
    <Dialog open={recurringOpen} onClose={()=>setRecurringOpen(false)} fullWidth maxWidth="md"><DialogTitle>반복 정비</DialogTitle><DialogContent dividers><RecurringMaintenance user={user} onCreated={refresh}/></DialogContent><DialogActions><Button onClick={()=>setRecurringOpen(false)}>닫기</Button></DialogActions></Dialog>
    <Card icon={BuildRounded} tone="orange" title="정비 작업" subtitle={`전체 ${rows.length}건 · 완료율 ${done}%`} action={<SearchField value={search} onChange={setSearch} placeholder="작업명 또는 작업번호 검색" />}>
      <Box className="ui-toolbar">
        <Tabs value={tab} onChange={(_,v) => setTab(v)} className="ui-seg-tabs"><Tab label="목록"/><Tab label="캘린더"/></Tabs>
        <span className="spacer" />
        {tab === 0 && <StatusFilter total={rows.length} value={filter} onChange={setFilter} items={statusTones.map(([value, tone]) => ({ value, tone, label: statusLabel[value], count: counts[value] ?? 0 }))} />}
      </Box>
      {tab === 0
        ? <DataGrid rows={shown} columns={columns} density="compact" rowHeight={48} columnHeaderHeight={44} disableRowSelectionOnClick pageSizeOptions={[10,25,50]} initialState={{ pagination:{paginationModel:{pageSize:10,page:0}} }}/>
        : <Box className="calendar-wrap"><FullCalendar plugins={[dayGridPlugin]} initialView="dayGridMonth" locale={koLocale} height={640} dayMaxEvents={3} events={rows.map(r => ({ title:r.title,date:r.scheduled_date,backgroundColor:statusTone(r.status).bg,borderColor:statusTone(r.status).bg,textColor:statusTone(r.status).fg }))}/></Box>}
    </Card>

    <Dialog open={!!form} onClose={() => setForm(null)} fullWidth>
      <DialogTitle>{form?.id ? '정비 작업 수정':'정비 작업 등록'}</DialogTitle>
      <DialogContent>{form && <Stack spacing={2} sx={{ mt:1 }}>
        <TextField label="작업명" value={form.title} onChange={e => setForm({...form,title:e.target.value})}/>
        <Stack direction="row" spacing={1.5}>
          <TextField label="작업유형" sx={{ flex:1 }} value={form.maintenanceType} onChange={e => setForm({...form,maintenanceType:e.target.value,...(!form.id&&!form.checklistManual?{checklistTemplateId:/네트워크|망/.test(e.target.value)?'check-network':/무선|통신/.test(e.target.value)?'check-radio':/보안|프로그램/.test(e.target.value)?'check-security':'check-general'}:{})})}/>
          <TextField select label="우선순위" sx={{ flex:1 }} value={form.priority} onChange={e => setForm({...form,priority:e.target.value})}><MenuItem value="NORMAL">일반</MenuItem><MenuItem value="HIGH">높음</MenuItem></TextField>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <TextField select label="작업 구분" sx={{ flex:1 }} value={form.workKind} onChange={e => setForm({...form,workKind:e.target.value})}><MenuItem value="PLANNED">계획</MenuItem><MenuItem value="UNPLANNED">비계획</MenuItem></TextField>
          <TextField select label="연계 고장 접수" sx={{ flex:2 }} value={form.incidentId ?? ''} onChange={e => setForm({...form,incidentId:e.target.value})}><MenuItem value="">연계 없음</MenuItem>{incidents.map(i=><MenuItem key={i.id} value={i.id}>{i.ticket_no} · {i.title}</MenuItem>)}</TextField>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <TextField label="담당부서" sx={{ flex:1 }} value={form.department} onChange={e => setForm({...form,department:e.target.value})}/>
          <TextField label="예정일" type="date" sx={{ flex:1 }} slotProps={{ inputLabel:{shrink:true} }} value={form.scheduledDate} onChange={e => setForm({...form,scheduledDate:e.target.value})}/>
        </Stack>
        {!form.id&&<TextField select label="체크리스트" value={form.checklistTemplateId??''} onChange={e=>setForm({...form,checklistTemplateId:e.target.value||null,checklistManual:true})}><MenuItem value="">없음 (기존 방식)</MenuItem>{checkTemplates.map(t=><MenuItem key={t.id} value={t.id}>{t.definition.title}</MenuItem>)}</TextField>}
        <TextField multiline rows={3} label="내용" value={form.description} onChange={e => setForm({...form,description:e.target.value})}/>
      </Stack>}</DialogContent>
      <DialogActions><Button onClick={() => setForm(null)}>취소</Button><Button variant="contained" disabled={saving} onClick={save}>저장</Button></DialogActions>
    </Dialog>

    <Dialog open={!!selected} onClose={closeDetail} fullWidth maxWidth="md">
      {selected && <>
        <DialogTitle sx={{ pb: 1 }}><Typography className="dd-kicker">정비 작업 · {selected.task_no}</Typography><Typography className="dd-heading">{selected.title}</Typography></DialogTitle>
        <DialogContent dividers>
          <Box className="stat-row">
            <Box><span className="dd-label">상태</span><StatusChip code={selected.status} label={statusLabel[selected.status] ?? selected.status}/></Box>
            <Box><span className="dd-label">우선순위</span>{priorityChip(selected.priority)}</Box>
            <Box><span className="dd-label">예정일</span><span className="dd-value">{selected.scheduled_date}</span></Box>
            <Box sx={{ flex: 1.4 }}><span className="dd-label">진행률</span><Meter value={selected.progress} tone={toneOf(selected.status)} /></Box>
          </Box>
          {selected.description && <><Typography className="dd-section">작업 내용</Typography><Typography className="dd-text">{selected.description}</Typography></>}
          {selected.incident_id && <Typography className="maintenance-link">연계 고장: {incidents.find(i=>i.id===selected.incident_id)?.ticket_no ?? selected.incident_id}</Typography>}
          {canEdit(selected) && selected.status !== 'COMPLETED' && <Box className="maintenance-result-form">
            <Typography className="dd-section">완료 결과 입력</Typography>
            <Stack spacing={1.5}>
              <TextField label="원인 분석" fullWidth multiline rows={2} value={resultForm.cause} onChange={e => setResultForm({...resultForm,cause:e.target.value})}/>
              <TextField label="상세 조치내용" fullWidth multiline rows={2} value={resultForm.actionDetail} onChange={e => setResultForm({...resultForm,actionDetail:e.target.value})}/>
              <TextField label="작업 결과" fullWidth multiline rows={2} value={resultForm.result} onChange={e => setResultForm({...resultForm,result:e.target.value})}/>
              <TextField label="사용 부품/자재" fullWidth value={resultForm.partsUsed} onChange={e => setResultForm({...resultForm,partsUsed:e.target.value})}/>
              <Stack direction="row" spacing={1.5}>
                <TextField select label="조치 방식" sx={{flex:1}} value={resultForm.resolutionMode} onChange={e => setResultForm({...resultForm,resolutionMode:e.target.value})}><MenuItem value="REMOTE">원격 조치</MenuItem><MenuItem value="ON_SITE">현장 조치</MenuItem></TextField>
                <TextField select label="재발 위험" sx={{flex:1}} value={resultForm.recurrenceRisk} onChange={e => setResultForm({...resultForm,recurrenceRisk:e.target.value})}><MenuItem value="LOW">낮음</MenuItem><MenuItem value="MEDIUM">보통</MenuItem><MenuItem value="HIGH">높음</MenuItem></TextField>
                <TextField label="후속 점검일" type="date" sx={{flex:1}} slotProps={{inputLabel:{shrink:true}}} value={resultForm.followUpDate} onChange={e => setResultForm({...resultForm,followUpDate:e.target.value})}/>
              </Stack>
            </Stack>
          </Box>}
          {selected.status === 'COMPLETED' && <><Typography className="dd-section">완료 결과</Typography><dl className="result-detail"><div><dt>원인</dt><dd>{selected.cause || '-'}</dd></div><div><dt>조치</dt><dd>{selected.action_detail || '-'}</dd></div><div><dt>결과</dt><dd>{selected.result || '-'}</dd></div><div><dt>방식</dt><dd>{selected.resolution_mode === 'ON_SITE' ? '현장 조치' : '원격 조치'}</dd></div><div><dt>재발 위험</dt><dd>{selected.recurrence_risk || '-'}</dd></div></dl></>}
          <TaskChecklistPanel taskId={selected.id} editable={canEdit(selected)&&!['COMPLETED','CANCELED'].includes(selected.status)} onChanged={()=>call<Row[]>('maintenance:getEvents',{id:selected.id}).then(setEvents)}/>
          <AttachmentsPanel entityType="MAINTENANCE" entityId={selected.id} canAdd={user.role==='ADMIN'||(!['COMPLETED','CANCELED'].includes(selected.status)&&(user.role==='OPERATOR'||canEdit(selected)))} onChanged={()=>call<Row[]>('maintenance:getEvents',{id:selected.id}).then(setEvents)}/>
          <Typography className="dd-section">작업 이력</Typography>
          <ul className="timeline">{events.map(e => <li key={e.id}><span>{e.note}</span><time>{fmtDateTime(e.created_at)}</time></li>)}</ul>
        </DialogContent>
        <DialogActions>
          {canEdit(selected) && (next[selected.status] ?? []).length > 0 && <span className="dlg-hint">상태 변경</span>}
          {canEdit(selected) && (next[selected.status] ?? []).map(v => <Button key={v} variant="outlined" color={v === 'CANCELED' ? 'error' : 'primary'} onClick={() => call('maintenance:updateStatus',{ id:selected.id,status:v,progress:v === 'COMPLETED' ? 100 : v === 'IN_PROGRESS' ? Math.max(50,selected.progress) : selected.progress,...(v === 'COMPLETED' ? {...resultForm,followUpDate:resultForm.followUpDate || undefined} : {}) }).then(() => { closeDetail(); refresh() }).catch(e => alert(e.message))}>{statusLabel[v]}</Button>)}
          <Button onClick={closeDetail} sx={{ ml: 'auto !important' }}>닫기</Button>
        </DialogActions>
      </>}
    </Dialog>
  </>
}
