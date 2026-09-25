import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Tab, Tabs, TextField } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import RemoveCircleOutlineRounded from '@mui/icons-material/RemoveCircleOutlineRounded'
import EventNoteRounded from '@mui/icons-material/EventNoteRounded'
import TodayRounded from '@mui/icons-material/TodayRounded'
import CampaignRounded from '@mui/icons-material/CampaignRounded'
import PushPinRounded from '@mui/icons-material/PushPinRounded'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import { Avatar, Card, EmptyState, PageHeader, RowActions, fmtDateTime, weekday, type Tone } from './ui'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.afccs.invoke(channel, payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const blankDuty = { dutyDate: new Date().toISOString().slice(0,10), shiftType: 'DAY' }
const defaultPosition = '운용 담당'
const blankDirective = { title: '', content: '', level: 'GENERAL' }
const shifts: [string, string, Tone][] = [['DAY','주간','sky'],['NIGHT','야간','lavender'],['DUTY','당직','orange']]
const shiftChip = (v: string) => { const s = shifts.find(x => x[0] === v); return <StatusChip code={v} label={s?.[1] ?? v} tone={s?.[2] ?? 'gray'} /> }
const levels: [string, string][] = [['URGENT','긴급'],['GENERAL','일반'],['NOTICE','공지']]
const levelText = (v: string) => levels.find(x => x[0] === v)?.[1] ?? v
const today = new Date().toISOString().slice(0,10)

export default function DutyManagement({ user }: { user: PublicUser }) {
  const [tab,setTab] = useState(0), [duty,setDuty] = useState<Row[]>([]), [directives,setDirectives] = useState<Row[]>([]), [users,setUsers] = useState<Row[]>([])
  const [dutyForm,setDutyForm] = useState<Row | null>(null), [directiveForm,setDirectiveForm] = useState<Row | null>(null)
  const editable = ['ADMIN','OPERATOR','USER'].includes(user.role)
  const refresh = () => { call<Row[]>('duty:list').then(setDuty); call<Row[]>('directives:list').then(setDirectives) }
  useEffect(() => { refresh(); call<Row[]>('users:list').then(setUsers) }, [])
  const saveDuty = () => { if (!dutyForm) return; const { id, ...fields } = dutyForm; call(id ? 'duty:update' : 'duty:create', id ? { id, ...fields } : fields).then(() => { setDutyForm(null); refresh() }).catch(e => alert(e.message)) }
  const saveDirective = () => { if (!directiveForm) return; const { id, ...fields } = directiveForm; call(id ? 'directives:update' : 'directives:create', id ? { id, ...fields } : fields).then(() => { setDirectiveForm(null); refresh() }).catch(e => alert(e.message)) }
  const assignees: Row[] = dutyForm?.assignees ?? []
  const setAssignee = (i: number, patch: Row) => dutyForm && setDutyForm({ ...dutyForm, assignees: assignees.map((a, j) => j === i ? { ...a, ...patch } : a) })
  const addAssignee = () => { if (!dutyForm) return; const next = users.find(u => !assignees.some(a => a.userId === u.id)); setDutyForm({ ...dutyForm, assignees: [...assignees, { userId: next?.id ?? '', position: defaultPosition }] }) }
  const removeAssignee = (i: number) => dutyForm && setDutyForm({ ...dutyForm, assignees: assignees.filter((_, j) => j !== i) })
  const remove = (channel: Channel, id: string) => { if (confirm('이 항목을 삭제하시겠습니까?')) call(channel, { id }).then(refresh).catch(e => alert(e.message)) }
  const todayDuty = duty.filter(d => d.duty_date === today).sort((a, b) => shifts.findIndex(s => s[0] === a.shift_type) - shifts.findIndex(s => s[0] === b.shift_type))
  const columns: GridColDef[] = [
    { field: 'duty_date', headerName: '일자', width: 150, renderCell: ({ row }) => <Box className="cell-person"><span className="cell-muted">{row.duty_date} ({weekday(row.duty_date)})</span>{row.duty_date === today && <span className="today-tag">오늘</span>}</Box> },
    { field: 'shift_type', headerName: '근무', width: 90, renderCell: ({ row }) => shiftChip(row.shift_type) },
    { field: 'display_name', headerName: '담당자', flex: 1, renderCell: ({ row }) => <Box className="cell-person"><Avatar name={row.display_name} size={24} /><span className="cell-strong">{row.display_name}</span></Box> },
    { field: 'position', headerName: '직책', flex: 1 },
    { field: 'action', headerName: '', width: 92, sortable: false, renderCell: ({ row }) => editable && <RowActions onEdit={() => setDutyForm({ id: row.id, dutyDate: row.duty_date, shiftType: row.shift_type, userId: row.user_id, position: row.position })} onDelete={() => remove('duty:delete', row.id)} /> }
  ]
  return <>
    <PageHeader section="업무 지원" title="근무 / 지시사항" description="근무 편성과 부대 지시사항·공지를 관리합니다."
      actions={editable && <Button variant="contained" startIcon={<AddRounded />} onClick={() => tab === 0 ? setDutyForm({ ...blankDuty, assignees: [{ userId: users[0]?.id ?? '', position: defaultPosition }] }) : setDirectiveForm({ ...blankDirective })}>{tab === 0 ? '근무 등록' : '지시사항 등록'}</Button>} />

    <Card icon={TodayRounded} tone="sky" title="오늘의 근무" subtitle={`${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} · ${todayDuty.length}명`}>
      {todayDuty.length
        ? <Box className="today-duty">{todayDuty.map(d => <Box key={d.id} className="duty-person"><Avatar name={d.display_name} size={36} /><Box><strong>{d.display_name}</strong><span>{d.position}</span></Box>{shiftChip(d.shift_type)}</Box>)}</Box>
        : <EmptyState icon={TodayRounded} title="오늘 편성된 근무가 없습니다" description="근무 등록으로 오늘 근무자를 편성하십시오." />}
    </Card>

    <Card icon={tab === 0 ? EventNoteRounded : CampaignRounded} tone={tab === 0 ? 'sky' : 'lavender'} title={tab === 0 ? '근무 편성표' : '지시사항 / 공지'} subtitle={tab === 0 ? `전체 ${duty.length}건` : `전체 ${directives.length}건 · 고정 ${directives.filter(d => d.pinned).length}건`}>
      <Box className="ui-toolbar"><Tabs value={tab} onChange={(_,v) => setTab(v)} className="ui-seg-tabs"><Tab label="근무현황"/><Tab label="지시사항"/></Tabs></Box>
      {tab === 0
        ? <DataGrid rows={duty} columns={columns} density="compact" rowHeight={48} columnHeaderHeight={44} disableRowSelectionOnClick pageSizeOptions={[10,25]} initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}/>
        : directives.length
          ? <Box className="directive-list">{directives.map(r => <Box className={`directive-card level-${r.level}`} key={r.id}>
              <Box className="directive-top"><StatusChip code={r.level} label={levelText(r.level)}/>{r.pinned ? <span className="pinned"><PushPinRounded />고정</span> : null}<span className="spacer" />{editable && <RowActions onEdit={() => setDirectiveForm({ id: r.id, title: r.title, content: r.content, level: r.level })} onDelete={() => remove('directives:delete', r.id)} />}</Box>
              <strong>{r.title}</strong>
              <p>{r.content}</p>
              <small>{r.issuer} · {fmtDateTime(r.issued_at)}</small>
            </Box>)}</Box>
          : <EmptyState icon={CampaignRounded} title="등록된 지시사항이 없습니다" />}
    </Card>

    <Dialog open={!!dutyForm} onClose={() => setDutyForm(null)} fullWidth><DialogTitle>{dutyForm?.id ? '근무 수정' : '근무 등록'}</DialogTitle><DialogContent>{dutyForm && <Stack spacing={2} sx={{ mt: 1 }}>
      <Stack direction="row" spacing={1.5}>
        <TextField label="일자" type="date" sx={{ flex: 1 }} slotProps={{ inputLabel: { shrink: true } }} value={dutyForm.dutyDate} onChange={e => setDutyForm({ ...dutyForm, dutyDate: e.target.value })}/>
        <TextField select label="근무" sx={{ flex: 1 }} value={dutyForm.shiftType} onChange={e => setDutyForm({ ...dutyForm, shiftType: e.target.value })}>{shifts.map(([v,t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField>
      </Stack>
      {dutyForm.id ? <><TextField select label="담당자" value={dutyForm.userId} onChange={e => setDutyForm({ ...dutyForm, userId: e.target.value })}>{users.map(u => <MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}</TextField><TextField label="직책" value={dutyForm.position} onChange={e => setDutyForm({ ...dutyForm, position: e.target.value })}/></>
        : <Box className="assignee-box">
          <span className="dd-label">담당자 {assignees.length}명</span>
          {assignees.map((a, i) => <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField select label={`담당자 ${i + 1}`} sx={{ flex: 1 }} value={a.userId} onChange={e => setAssignee(i, { userId: e.target.value })}>{users.map(u => <MenuItem key={u.id} value={u.id} disabled={u.id !== a.userId && assignees.some(x => x.userId === u.id)}>{u.display_name}</MenuItem>)}</TextField>
            <TextField label={`직책 ${i + 1}`} sx={{ flex: 1 }} value={a.position} onChange={e => setAssignee(i, { position: e.target.value })}/>
            <IconButton aria-label={`담당자 ${i + 1} 삭제`} disabled={assignees.length === 1} onClick={() => removeAssignee(i)}><RemoveCircleOutlineRounded/></IconButton>
          </Stack>)}
          <Button startIcon={<AddRounded/>} disabled={assignees.length >= users.length} onClick={addAssignee} sx={{ alignSelf: 'flex-start' }}>담당자 추가</Button>
        </Box>}
    </Stack>}</DialogContent><DialogActions><Button onClick={() => setDutyForm(null)}>취소</Button><Button variant="contained" onClick={saveDuty}>저장</Button></DialogActions></Dialog>

    <Dialog open={!!directiveForm} onClose={() => setDirectiveForm(null)} fullWidth><DialogTitle>{directiveForm?.id ? '지시사항 수정' : '지시사항 등록'}</DialogTitle><DialogContent>{directiveForm && <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField label="제목" value={directiveForm.title} onChange={e => setDirectiveForm({ ...directiveForm, title: e.target.value })}/>
      <TextField select label="등급" value={directiveForm.level} onChange={e => setDirectiveForm({ ...directiveForm, level: e.target.value })}>{levels.map(([v,t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField>
      <TextField label="내용" multiline rows={4} value={directiveForm.content} onChange={e => setDirectiveForm({ ...directiveForm, content: e.target.value })}/>
    </Stack>}</DialogContent><DialogActions><Button onClick={() => setDirectiveForm(null)}>취소</Button><Button variant="contained" onClick={saveDirective}>저장</Button></DialogActions></Dialog>
  </>
}
