import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AddRounded from '@mui/icons-material/AddRounded'
import ReportProblemRounded from '@mui/icons-material/ReportProblemRounded'
import FilterAltOffRounded from '@mui/icons-material/FilterAltOffRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import { Avatar, Card, PageHeader, RowActions, SearchField, StatusFilter, countBy, fmtDateTime, fmtShort, type Tone } from './ui'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.afccs.invoke(channel,payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const labels: Record<string,string> = { RECEIVED:'접수',TRIAGED:'분류',ASSIGNED:'배정',PLANNED:'계획',IN_PROGRESS:'진행',RESOLVED:'조치완료',CLOSED:'종결',CANCELED:'취소',URGENT:'긴급',NORMAL:'일반' }
const flow: [string, Tone][] = [['RECEIVED','sky'],['TRIAGED','lavender'],['ASSIGNED','sky'],['PLANNED','sky'],['IN_PROGRESS','orange'],['RESOLVED','green'],['CLOSED','gray'],['CANCELED','red']]
const next: Record<string,string[]> = { RECEIVED:['TRIAGED','CANCELED'], TRIAGED:['ASSIGNED','CANCELED'], ASSIGNED:['PLANNED','IN_PROGRESS','CANCELED'], PLANNED:['IN_PROGRESS','CANCELED'], IN_PROGRESS:['RESOLVED','CANCELED'], RESOLVED:['CLOSED','IN_PROGRESS'] }
const empty = { title:'',category:'기반통신',severity:'NORMAL',description:'',department:'가상 정보통신대' }
const severityChip = (v: string) => <StatusChip code={v} label={labels[v] ?? v} tone={v === 'URGENT' ? 'red' : 'gray'} />

export default function IncidentsManagement({ user }: { user: PublicUser }) {
  const [rows,setRows] = useState<Row[]>([]), [users,setUsers] = useState<Row[]>([]), [search,setSearch] = useState(''), [statusFilter,setStatusFilter] = useState(''), [severityFilter,setSeverityFilter] = useState(''), [reportedFrom,setReportedFrom] = useState(''), [reportedTo,setReportedTo] = useState(''), [assigneeFilter,setAssigneeFilter] = useState(''), [form,setForm] = useState<Row | null>(null), [selected,setSelected] = useState<Row | null>(null), [events,setEvents] = useState<Row[]>([]), [assignee,setAssignee] = useState('')
  const editable = ['ADMIN','OPERATOR','USER'].includes(user.role), canAction = ['ADMIN','OPERATOR','MAINTAINER','USER'].includes(user.role)
  // 상태는 건수 표시를 위해 화면에서 거르고, 나머지 조건은 서버에서 거른다
  const refresh = () => call<Row[]>('incidents:list',{ search, ...(severityFilter ? { severity:severityFilter } : {}), ...(reportedFrom ? { reportedFrom } : {}), ...(reportedTo ? { reportedTo } : {}), ...(assigneeFilter ? { assignedTo:assigneeFilter } : {}) }).then(setRows)
  useEffect(() => { refresh() }, [search,severityFilter,reportedFrom,reportedTo,assigneeFilter])
  useEffect(() => { call<Row[]>('users:list').then(setUsers) }, [])
  const userName = (id: string) => users.find(u => u.id === id)?.display_name
  const counts = countBy(rows, 'status'), shown = statusFilter ? rows.filter(r => r.status === statusFilter) : rows
  const filtered = !!(severityFilter || reportedFrom || reportedTo || assigneeFilter)
  const clearFilters = () => { setSeverityFilter(''); setReportedFrom(''); setReportedTo(''); setAssigneeFilter('') }
  const show = (row: Row) => { setSelected(row); setAssignee(row.assigned_to ?? ''); call<Row[]>('incidents:getEvents',{ id: row.id }).then(setEvents) }
  const save = () => { if (!form) return; const { id, ...fields } = form; call(id ? 'incidents:update' : 'incidents:create',id ? { id, ...fields } : fields).then(() => { setForm(null); refresh() }).catch(e => alert(e.message)) }
  const columns: GridColDef[] = [
    { field:'ticket_no',headerName:'접수번호',width:150,renderCell:({row}) => <span className="cell-code">{row.ticket_no}</span> },
    { field:'title',headerName:'제목',flex:1,minWidth:200,renderCell:({row}) => <span className="cell-strong">{row.title}</span> },
    { field:'system_name',headerName:'체계',width:120,renderCell:({row}) => <span className="cell-muted">{row.system_name ?? row.category}</span> },
    { field:'severity',headerName:'중요도',width:80,renderCell:({row}) => severityChip(row.severity) },
    { field:'status',headerName:'상태',width:108,renderCell:({row}) => <StatusChip code={row.status} label={labels[row.status] ?? row.status}/> },
    { field:'assigned_to',headerName:'담당자',width:120,renderCell:({row}) => userName(row.assigned_to) ? <Box className="cell-person"><Avatar name={userName(row.assigned_to)!} size={22}/>{userName(row.assigned_to)}</Box> : <span className="cell-muted">미지정</span> },
    { field:'reported_at',headerName:'접수시간',width:120,renderCell:({row}) => <span className="cell-muted">{fmtShort(row.reported_at)}</span> },
    { field:'actions',headerName:'',width:92,sortable:false,renderCell:({row}) => <RowActions onView={() => show(row)} onEdit={editable ? () => setForm({ id:row.id,title:row.title,category:row.category,severity:row.severity,description:row.description,department:row.department ?? '' }) : undefined} /> }
  ]
  return <>
    <PageHeader section="운용 현황" title="고장관리" description="고장 접수부터 조치·종결까지 처리 단계를 추적합니다."
      actions={editable && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({ ...empty })}>신규 고장 접수</Button>} />
    <Card icon={ReportProblemRounded} tone="red" title="고장 접수 목록" subtitle={`조회 ${rows.length}건 · 긴급 ${rows.filter(r => r.severity === 'URGENT' && !['CLOSED','CANCELED'].includes(r.status)).length}건 미종결`} action={<SearchField value={search} onChange={setSearch} placeholder="제목 또는 접수번호 검색" />}>
      <Box className="ui-toolbar">
        <TextField select size="small" label="중요도" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} sx={{ minWidth:110 }}><MenuItem value="">전체</MenuItem><MenuItem value="URGENT">긴급</MenuItem><MenuItem value="NORMAL">일반</MenuItem></TextField>
        <TextField size="small" type="date" label="시작일" slotProps={{ inputLabel:{shrink:true} }} value={reportedFrom} onChange={e => setReportedFrom(e.target.value)}/>
        <TextField size="small" type="date" label="종료일" slotProps={{ inputLabel:{shrink:true} }} value={reportedTo} onChange={e => setReportedTo(e.target.value)}/>
        <TextField select size="small" label="담당자" value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} sx={{ minWidth:140 }}><MenuItem value="">전체</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}</TextField>
        {filtered && <Button size="small" startIcon={<FilterAltOffRounded />} onClick={clearFilters}>필터 초기화</Button>}
      </Box>
      <Box className="ui-toolbar"><StatusFilter total={rows.length} value={statusFilter} onChange={setStatusFilter} items={flow.map(([value, tone]) => ({ value, tone, label: labels[value], count: counts[value] ?? 0 }))} /></Box>
      <DataGrid rows={shown} columns={columns} density="compact" rowHeight={48} columnHeaderHeight={44} disableRowSelectionOnClick pageSizeOptions={[10,25,50]} initialState={{ pagination:{paginationModel:{pageSize:10,page:0}} }}/>
    </Card>

    <Dialog open={!!form} onClose={() => setForm(null)} fullWidth>
      <DialogTitle>{form?.id ? '고장 접수 수정' : '신규 고장 접수'}</DialogTitle>
      <DialogContent>{form && <Stack spacing={2} sx={{ mt:1 }}>
        <TextField label="제목" value={form.title} onChange={e => setForm({...form,title:e.target.value})}/>
        <Stack direction="row" spacing={1.5}>
          <TextField label="구분" sx={{ flex:1 }} value={form.category} onChange={e => setForm({...form,category:e.target.value})}/>
          <TextField select label="중요도" sx={{ flex:1 }} value={form.severity} onChange={e => setForm({...form,severity:e.target.value})}><MenuItem value="NORMAL">일반</MenuItem><MenuItem value="URGENT">긴급</MenuItem></TextField>
        </Stack>
        <TextField label="담당부서" value={form.department} onChange={e => setForm({...form,department:e.target.value})}/>
        <TextField multiline rows={4} label="내용" value={form.description} onChange={e => setForm({...form,description:e.target.value})}/>
      </Stack>}</DialogContent>
      <DialogActions><Button onClick={() => setForm(null)}>취소</Button><Button variant="contained" onClick={save}>저장</Button></DialogActions>
    </Dialog>

    <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="md">
      {selected && <>
        <DialogTitle sx={{ pb: 1 }}><Typography className="dd-kicker">고장 접수 · {selected.ticket_no}</Typography><Typography className="dd-heading">{selected.title}</Typography></DialogTitle>
        <DialogContent dividers>
          <Box className="stat-row">
            <Box><span className="dd-label">중요도</span>{severityChip(selected.severity)}</Box>
            <Box><span className="dd-label">상태</span><StatusChip code={selected.status} label={labels[selected.status] ?? selected.status}/></Box>
            <Box><span className="dd-label">체계</span><span className="dd-value">{selected.system_name ?? '-'}</span></Box>
            <Box><span className="dd-label">접수일시</span><span className="dd-value">{fmtDateTime(selected.reported_at)}</span></Box>
          </Box>
          <Typography className="dd-section">내용</Typography>
          <Typography className="dd-text">{selected.description}</Typography>
          {canAction && <><Stack direction="row" spacing={1} sx={{ mt: 2.5 }}><TextField select size="small" label="담당자" value={assignee} onChange={e => setAssignee(e.target.value)} sx={{ minWidth:220 }}><MenuItem value="">미지정</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}</TextField><Button variant="outlined" disabled={!assignee} onClick={() => call('incidents:assign',{ id:selected.id,userId:assignee }).then(() => { setSelected(null); refresh() }).catch(e => alert(e.message))}>담당자 지정</Button></Stack></>}
          <Typography className="dd-section">처리 이력</Typography>
          <ul className="timeline">{events.map(e => <li key={e.id}>
            <span className="timeline-step">{e.from_status ? `${labels[e.from_status] ?? e.from_status} → ` : ''}{labels[e.to_status] ?? e.to_status ?? ''}</span>
            <span>{e.note}</span><time>{fmtDateTime(e.created_at)}</time>
          </li>)}</ul>
        </DialogContent>
        <DialogActions>
          {canAction && (next[selected.status] ?? []).length > 0 && <span className="dlg-hint">상태 변경</span>}
          {canAction && (next[selected.status] ?? []).map(v => <Button key={v} variant="outlined" color={v === 'CANCELED' ? 'error' : 'primary'} onClick={() => call('incidents:updateStatus',{ id:selected.id,status:v }).then(() => { setSelected(null); refresh() }).catch(e => alert(e.message))}>{labels[v]}</Button>)}
          <Button onClick={() => setSelected(null)} sx={{ ml: 'auto !important' }}>닫기</Button>
        </DialogActions>
      </>}
    </Dialog>
  </>
}
