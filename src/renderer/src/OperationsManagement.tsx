import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AddRounded from '@mui/icons-material/AddRounded'
import DnsRounded from '@mui/icons-material/DnsRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import { Card, Meter, PageHeader, RowActions, SearchField, StatusFilter, countBy, fmtDateTime, type Tone } from './ui'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.afccs.invoke(channel,payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const statuses: [string, string, Tone][] = [['NORMAL','정상','green'],['WATCH','주의','orange'],['INSPECTION','점검','sky'],['FAULT','장애','red'],['OFFLINE','중단','gray']]
const statusText = (v: string) => statuses.find(x => x[0] === v)?.[1] ?? v
const empty = { code: '', name: '', category: '기반통신', status: 'NORMAL', uptimePct: 100, remarks: '' }
export const uptimeTone = (v: number): Tone => v >= 97 ? 'green' : v >= 95 ? 'sky' : 'orange'

export default function OperationsManagement({ user }: { user: PublicUser }) {
  const [rows,setRows] = useState<Row[]>([]), [search,setSearch] = useState(''), [filter,setFilter] = useState(''), [form,setForm] = useState<Row | null>(null), [selected,setSelected] = useState<Row | null>(null), [history,setHistory] = useState<Row[]>([]), [status,setStatus] = useState('NORMAL')
  const editable = ['ADMIN','OPERATOR','USER'].includes(user.role)
  const refresh = () => call<Row[]>('operations:list', { search }).then(setRows)
  useEffect(() => { refresh() }, [search])
  const counts = countBy(rows, 'status'), shown = filter ? rows.filter(r => r.status === filter) : rows
  const show = (row: Row) => { setSelected(row); setStatus(row.status); call<Row[]>('operations:getHistory',{ id: row.id }).then(setHistory) }
  const save = () => { if (!form) return; const { id, ...fields } = form; call(id ? 'operations:update' : 'operations:create', id ? { id, name: fields.name, category: fields.category, uptimePct: Number(fields.uptimePct), remarks: fields.remarks } : { ...fields, uptimePct: Number(fields.uptimePct) }).then(() => { setForm(null); refresh() }).catch(e => alert(e.message)) }
  const columns: GridColDef[] = [
    { field: 'code', headerName: '코드', width: 120, renderCell: ({ row }) => <span className="cell-code">{row.code}</span> },
    { field: 'name', headerName: '체계명', flex: 1.2, minWidth: 160, renderCell: ({ row }) => <span className="cell-strong">{row.name}</span> },
    { field: 'category', headerName: '분류', flex: .8, minWidth: 110 },
    { field: 'status', headerName: '상태', width: 90, renderCell: ({ row }) => <StatusChip code={row.status} label={statusText(row.status)} /> },
    { field: 'uptime_pct', headerName: '운용률', width: 180, renderCell: ({ row }) => <Meter value={row.uptime_pct} tone={uptimeTone(row.uptime_pct)} /> },
    { field: 'remarks', headerName: '비고', flex: 1, minWidth: 120, renderCell: ({ row }) => <span className="cell-muted">{row.remarks || '-'}</span> },
    { field: 'actions', headerName: '', width: 92, sortable: false, renderCell: ({ row }) => <RowActions onView={() => show(row)} onEdit={editable ? () => setForm({ id: row.id, code: row.code, name: row.name, category: row.category, uptimePct: row.uptime_pct, remarks: row.remarks ?? '' }) : undefined} /> }
  ]
  return <>
    <PageHeader section="운용 현황" title="운영현황" description="정보통신체계의 운용 상태와 운용률을 확인하고 관리합니다."
      actions={editable && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({ ...empty })}>체계 등록</Button>} />
    <Card icon={DnsRounded} tone="sky" title="정보통신체계" subtitle={`전체 ${rows.length}개${filter ? ` · ${statusText(filter)} ${shown.length}개` : ''}`} action={<SearchField value={search} onChange={setSearch} placeholder="체계명 또는 코드 검색" />}>
      <Box className="ui-toolbar"><StatusFilter total={rows.length} value={filter} onChange={setFilter} items={statuses.map(([value, label, tone]) => ({ value, label, tone, count: counts[value] ?? 0 }))} /></Box>
      <DataGrid rows={shown} columns={columns} density="compact" rowHeight={44} disableRowSelectionOnClick pageSizeOptions={[10,25,50]} initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}/>
    </Card>

    <Dialog open={!!form} onClose={() => setForm(null)} fullWidth>
      <DialogTitle>{form?.id ? '체계 수정' : '체계 등록'}</DialogTitle>
      <DialogContent>{form && <Stack spacing={2} sx={{ mt: 1 }}>
        <Stack direction="row" spacing={1.5}><TextField label="코드" sx={{ flex: 1 }} value={form.code ?? ''} disabled={!!form.id} onChange={e => setForm({ ...form, code: e.target.value })}/><TextField label="분류" sx={{ flex: 1 }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}/></Stack>
        <TextField label="체계명" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
        <Stack direction="row" spacing={1.5}>
          {!form.id && <TextField select label="상태" sx={{ flex: 1 }} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{statuses.map(([v,t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField>}
          <TextField label="운용률 (%)" type="number" sx={{ flex: 1 }} value={form.uptimePct} onChange={e => setForm({ ...form, uptimePct: e.target.value })}/>
        </Stack>
        <TextField label="비고" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}/>
      </Stack>}</DialogContent>
      <DialogActions><Button onClick={() => setForm(null)}>취소</Button><Button variant="contained" onClick={save}>저장</Button></DialogActions>
    </Dialog>

    <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
      {selected && <>
        <DialogTitle sx={{ pb: 1 }}><Typography className="dd-kicker">체계 상세 · {selected.code}</Typography><Typography className="dd-heading">{selected.name}</Typography></DialogTitle>
        <DialogContent dividers>
          <Box className="stat-row">
            <Box><span className="dd-label">현재 상태</span><StatusChip code={selected.status} label={statusText(selected.status)} /></Box>
            <Box><span className="dd-label">분류</span><span className="dd-value">{selected.category}</span></Box>
            <Box sx={{ flex: 1.4 }}><span className="dd-label">운용률</span><Meter value={selected.uptime_pct} tone={uptimeTone(selected.uptime_pct)} /></Box>
          </Box>
          <TextField select fullWidth label="상태 변경" value={status} onChange={e => setStatus(e.target.value)} disabled={!editable} sx={{ mt: 2.5 }}>{statuses.map(([v,t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField>
          <Typography className="dd-section">최근 30일 운용률</Typography>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={[...history].reverse().map(r => ({ date:String(r.recorded_at).slice(5,10), uptime:r.uptime_pct }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1E0D9" vertical={false}/>
              <XAxis dataKey="date" tick={{ fill:'#898781', fontSize:11 }} axisLine={{ stroke:'#C3C2B7' }} tickLine={false}/>
              <YAxis domain={[90,100]} width={32} tick={{ fill:'#898781', fontSize:11 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e5e3df', fontSize:12 }} formatter={v => [`${v}%`, '운용률']}/>
              <Line dataKey="uptime" stroke="#2A78D6" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
          <Typography className="dd-section">상태 이력</Typography>
          <ul className="timeline">{history.slice(0,6).map(r => <li key={r.id}><StatusChip code={r.status} label={statusText(r.status)} /><span>운용률 {r.uptime_pct}%</span><time>{fmtDateTime(r.recorded_at)}</time></li>)}</ul>
        </DialogContent>
        <DialogActions>
          {user.role === 'ADMIN' && <Button color="error" onClick={() => { if (confirm('이 체계를 삭제하시겠습니까?')) call('operations:delete',{ id: selected.id }).then(() => { setSelected(null); refresh() }).catch(e => alert(e.message)) }} sx={{ mr: 'auto' }}>삭제</Button>}
          <Button onClick={() => setSelected(null)}>닫기</Button>
          {editable && <Button variant="contained" onClick={() => call('operations:updateStatus',{ id: selected.id, status }).then(() => { setSelected(null); refresh() }).catch(e => alert(e.message))}>상태 저장</Button>}
        </DialogActions>
      </>}
    </Dialog>
  </>
}
