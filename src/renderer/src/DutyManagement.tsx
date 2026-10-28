import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Tab, Tabs, TextField } from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import RemoveCircleOutlineRounded from '@mui/icons-material/RemoveCircleOutlineRounded'
import EventNoteRounded from '@mui/icons-material/EventNoteRounded'
import TodayRounded from '@mui/icons-material/TodayRounded'
import CampaignRounded from '@mui/icons-material/CampaignRounded'
import PushPinRounded from '@mui/icons-material/PushPinRounded'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import { unitLevelLabels, type OrganizationUnit } from '../../shared/organization'
import { Avatar, Card, EmptyState, PageHeader, RowActions, fmtDateTime, weekday, type Tone } from './ui'
import { koreaDate, koreaDateTimeInput } from '../../shared/date'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel, payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const blankDuty = { dutyDate: koreaDate(), shiftType: 'DAY' }
const defaultPosition = '운용 담당'
const blankDirective = { title: '', content: '', level: 'GENERAL', dueAt:'', department:'', assigneeId:'', status:'OPEN' }
const shifts: [string, string, Tone][] = [['DAY','주간','sky'],['NIGHT','야간','lavender'],['DUTY','당직','orange']]
const shiftChip = (v: string) => { const s = shifts.find(x => x[0] === v); return <StatusChip code={v} label={s?.[1] ?? v} tone={s?.[2] ?? 'gray'} /> }
const levels: [string, string][] = [['URGENT','긴급'],['GENERAL','일반'],['NOTICE','공지']]
const levelText = (v: string) => levels.find(x => x[0] === v)?.[1] ?? v
const today = koreaDate()

function UnitFilter({units,level,unitId,onLevel,onUnit}:{units:OrganizationUnit[];level:string;unitId:string;onLevel:(v:string)=>void;onUnit:(v:string)=>void}) {
  return <Stack direction="row" spacing={1.5} sx={{flexWrap:'wrap',gap:1}}>
    <TextField select label="부대급" value={level} onChange={e=>{onLevel(e.target.value);onUnit('')}} sx={{minWidth:140}}><MenuItem value="">전체</MenuItem>{Object.entries(unitLevelLabels).map(([v,t])=><MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField>
    <Autocomplete sx={{flex:1,minWidth:220}} options={units.filter(u=>!level||u.unit_level===level)} value={units.find(u=>u.id===unitId)??null} getOptionLabel={u=>u.name} isOptionEqualToValue={(a,b)=>a.id===b.id} onChange={(_,u)=>onUnit(u?.id??'')} renderInput={params=><TextField {...params} label="소속 부대" placeholder="전체 부대"/>}/>
  </Stack>
}

export default function DutyManagement({ user }: { user: PublicUser }) {
  const [params]=useSearchParams(),navigate=useNavigate()
  const [detail,setDetail]=useState<Row|null>(null)
  const closeDetail=()=>{setDetail(null);if(params.get('from')==='mine')navigate('/?view=mine');else navigate('/duty',{replace:true})}
  useEffect(()=>{let alive=true;const id=params.get('detail');if(id)call<Row>('directives:get',{id}).then(v=>{if(alive){setTab(1);setDetail(v)}}).catch(e=>{if(alive){alert(e.message);closeDetail()}});return()=>{alive=false}},[params.get('detail')])
  const [tab,setTab] = useState(0), [duty,setDuty] = useState<Row[]>([]), [directives,setDirectives] = useState<Row[]>([]), [users,setUsers] = useState<Row[]>([])
  const [dutyForm,setDutyForm] = useState<Row | null>(null), [directiveForm,setDirectiveForm] = useState<Row | null>(null)
  const [units,setUnits]=useState<OrganizationUnit[]>([])
  const [level,setLevel]=useState(''),[unitId,setUnitId]=useState('')
  const [formLevel,setFormLevel]=useState(''),[formUnit,setFormUnit]=useState('')
  const [members,setMembers]=useState<Row[]>([]),[membersBusy,setMembersBusy]=useState(false),[membersError,setMembersError]=useState('')
  const [directoryError,setDirectoryError]=useState('')
  useEffect(()=>{call<{units:OrganizationUnit[]}>('organizations:list').then(d=>setUnits(d.units)).catch(e=>setDirectoryError(e.message))},[])
  useEffect(()=>{
    if(!dutyForm||!formUnit){setMembers([]);setMembersBusy(false);setMembersError('');return}
    let active=true;setMembers([]);setMembersBusy(true);setMembersError('')
    call<Row[]>('organizations:members',{unitId:formUnit}).then(rows=>{if(active)setMembers(rows.filter(u=>u.active===1))}).catch(e=>{if(active)setMembersError(e.message)}).finally(()=>{if(active)setMembersBusy(false)})
    return()=>{active=false}
  },[formUnit,!!dutyForm])
  const visibleDuty=duty.filter(d=>unitId?d.unit_id===unitId:!level||units.some(u=>u.id===d.unit_id&&u.unit_level===level))
  const memberOptions=formUnit?members:users
  const existingDutyPerson=dutyForm?.id?duty.find(d=>d.user_id===dutyForm.userId):undefined
  const existingMember=dutyForm?.id?(users.find(u=>u.id===dutyForm.userId)??(existingDutyPerson?{...existingDutyPerson,id:existingDutyPerson.user_id}:undefined)):undefined
  const dutyPeople=existingMember&&!memberOptions.some(u=>u.id===existingMember.id)?[...memberOptions,existingMember]:memberOptions
  const openDuty=(row?:Row)=>{
    const selectedUnit=row?.unit_id??users.find(u=>u.id===row?.user_id)?.unit_id??unitId
    setFormUnit(selectedUnit||'');setFormLevel(units.find(u=>u.id===selectedUnit)?.unit_level??level)
    setMembers([]);setMembersError('')
    setDutyForm(row?{id:row.id,dutyDate:row.duty_date,shiftType:row.shift_type,userId:row.user_id,position:row.position}:{...blankDuty,assignees:[{userId:selectedUnit?'':users[0]?.id??'',position:defaultPosition}]})
  }
  const changeFormUnit=(id:string)=>{setFormUnit(id);setMembers([]);setMembersError('');setMembersBusy(!!id);if(dutyForm)setDutyForm(dutyForm.id?{...dutyForm,userId:''}:{...dutyForm,assignees:assignees.map(a=>({...a,userId:''}))})}
  const personLabel=(u:Row)=>`${u.rank_name??''} ${u.display_name}${formUnit?'':` · ${u.unit_name??'공통'}`}${u.is_demo?' · 가상':''}`.trim()
  const editable = ['ADMIN','OPERATOR','USER'].includes(user.role)
  const canManageDirective = ['ADMIN','OPERATOR'].includes(user.role)
  const refresh = () => { call<Row[]>('duty:list').then(setDuty); call<Row[]>('directives:list').then(setDirectives) }
  useEffect(() => { refresh(); call<Row[]>('users:list').then(setUsers) }, [])
  const saveDuty = () => { if (!dutyForm) return; const { id, ...fields } = dutyForm; call(id ? 'duty:update' : 'duty:create', id ? { id, ...fields } : fields).then(() => { setDutyForm(null); refresh() }).catch(e => alert(e.message)) }
  const saveDirective = () => { if (!directiveForm) return; const { id, ...raw } = directiveForm; const fields = { ...raw, dueAt:raw.dueAt ? new Date(raw.dueAt).toISOString() : (id ? null : undefined), assigneeId:raw.assigneeId || (id ? null : undefined), department:raw.department || (id ? null : undefined) }; call(id ? 'directives:update' : 'directives:create', id ? { id, ...fields } : fields).then(() => { setDirectiveForm(null); refresh() }).catch(e => alert(e.message)) }
  const assignees: Row[] = dutyForm?.assignees ?? []
  const setAssignee = (i: number, patch: Row) => dutyForm && setDutyForm({ ...dutyForm, assignees: assignees.map((a, j) => j === i ? { ...a, ...patch } : a) })
  const addAssignee = () => { if (!dutyForm) return; const next = dutyPeople.find(u => !assignees.some(a => a.userId === u.id)); setDutyForm({ ...dutyForm, assignees: [...assignees, { userId: next?.id ?? '', position: defaultPosition }] }) }
  const removeAssignee = (i: number) => dutyForm && setDutyForm({ ...dutyForm, assignees: assignees.filter((_, j) => j !== i) })
  const remove = (channel: Channel, id: string) => { if (confirm('이 항목을 삭제하시겠습니까?')) call(channel, { id }).then(refresh).catch(e => alert(e.message)) }
  const todayDuty = visibleDuty.filter(d => d.duty_date === today).sort((a, b) => shifts.findIndex(s => s[0] === a.shift_type) - shifts.findIndex(s => s[0] === b.shift_type))
  const columns: GridColDef[] = [
    { field: 'duty_date', headerName: '일자', width: 150, renderCell: ({ row }) => <Box className="cell-person"><span className="cell-muted">{row.duty_date} ({weekday(row.duty_date)})</span>{row.duty_date === today && <span className="today-tag">오늘</span>}</Box> },
    { field: 'shift_type', headerName: '근무', width: 90, renderCell: ({ row }) => shiftChip(row.shift_type) },
    { field: 'display_name', headerName: '담당자', flex: 1, renderCell: ({ row }) => <Box className="cell-person"><Avatar name={row.display_name} size={24} /><span className="cell-strong">{row.display_name}</span></Box> },
    { field: 'unit_name', headerName: '소속 부대', flex: 1, minWidth: 160 },
    { field: 'position', headerName: '직책', flex: 1 },
    { field: 'action', headerName: '', width: 92, sortable: false, renderCell: ({ row }) => editable && <RowActions onEdit={() => openDuty(row)} onDelete={() => remove('duty:delete', row.id)} /> }
  ]
  return <>
    <Dialog open={!!detail} onClose={closeDetail} fullWidth maxWidth="sm"><DialogTitle>{detail?.title}</DialogTitle><DialogContent dividers><Box sx={{whiteSpace:'pre-wrap'}}>{detail?.content}</Box><Box sx={{mt:2}}>기한: {detail?.due_at?fmtDateTime(detail.due_at):'없음'} · {detail?.acknowledged_by_me?'확인 완료':'확인 전'}</Box></DialogContent><DialogActions>{detail&&!detail.acknowledged_by_me&&<Button variant="contained" onClick={()=>call('directives:acknowledge',{id:detail.id}).then(()=>{refresh();closeDetail()}).catch(e=>alert(e.message))}>지시사항 확인</Button>}<Button onClick={closeDetail}>닫기</Button></DialogActions></Dialog>

    <PageHeader section="업무 지원" title="근무 / 지시사항" description="근무 편성과 부대 지시사항·공지를 관리합니다."
      actions={((tab === 0 && editable) || (tab === 1 && canManageDirective)) && <Button variant="contained" startIcon={<AddRounded />} onClick={() => tab === 0 ? openDuty() : setDirectiveForm({ ...blankDirective })}>{tab === 0 ? '근무 등록' : '지시사항 등록'}</Button>} />

    {directoryError&&<Alert severity="error">부대 목록 조회 실패: {directoryError}</Alert>}
    {tab===0&&<Box sx={{mb:2}}><UnitFilter units={units} level={level} unitId={unitId} onLevel={setLevel} onUnit={setUnitId}/></Box>}
    <Card icon={TodayRounded} tone="sky" title="오늘의 근무" subtitle={`${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} · ${todayDuty.length}명`}>
      {todayDuty.length
        ? <Box className="today-duty">{todayDuty.map(d => <Box key={d.id} className="duty-person"><Avatar name={d.display_name} size={36} /><Box><strong>{d.display_name}</strong><span>{d.position}</span></Box>{shiftChip(d.shift_type)}</Box>)}</Box>
        : <EmptyState icon={TodayRounded} title="오늘 편성된 근무가 없습니다" description="근무 등록으로 오늘 근무자를 편성하십시오." />}
    </Card>

    <Card icon={tab === 0 ? EventNoteRounded : CampaignRounded} tone={tab === 0 ? 'sky' : 'lavender'} title={tab === 0 ? '근무 편성표' : '지시사항 / 공지'} subtitle={tab === 0 ? `조회 ${visibleDuty.length}건 / 전체 ${duty.length}건` : `전체 ${directives.length}건 · 고정 ${directives.filter(d => d.pinned).length}건`}>
      <Box className="ui-toolbar"><Tabs value={tab} onChange={(_,v) => setTab(v)} className="ui-seg-tabs"><Tab label="근무현황"/><Tab label="지시사항"/></Tabs></Box>
      {tab === 0
        ? <DataGrid rows={visibleDuty} columns={columns} density="compact" rowHeight={48} columnHeaderHeight={44} disableRowSelectionOnClick pageSizeOptions={[10,25]} initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}/>
        : directives.length
          ? <Box className="directive-list">{directives.map(r => <Box className={`directive-card level-${r.level}`} key={r.id}>
              <Box className="directive-top"><StatusChip code={r.level} label={levelText(r.level)}/><StatusChip code={r.status} label={r.status === 'COMPLETED' ? '완료' : r.status === 'IN_PROGRESS' ? '수행중' : '미착수'} tone={r.status === 'COMPLETED' ? 'green' : r.status === 'IN_PROGRESS' ? 'sky' : 'gray'}/>{r.pinned ? <span className="pinned"><PushPinRounded />고정</span> : null}<span className="spacer" />{canManageDirective && <RowActions onEdit={() => setDirectiveForm({ id: r.id, title: r.title, content: r.content, level: r.level, dueAt:r.due_at ? koreaDateTimeInput(r.due_at) : '',department:r.department ?? '',assigneeId:r.assignee_id ?? '',status:r.status ?? 'OPEN' })} onDelete={() => remove('directives:delete', r.id)} />}</Box>
              <strong>{r.title}</strong>
              <p>{r.content}</p>
              <Box className="directive-meta"><small>{r.issuer} · {fmtDateTime(r.issued_at)}{r.due_at ? ` · 기한 ${fmtDateTime(r.due_at)}` : ''}{r.department ? ` · ${r.department}` : ''}{r.assignee_name ? ` · ${r.assignee_name}` : ''}</small><span className="spacer"/><small>확인 {r.acknowledgement_count}명</small>{!r.acknowledged_by_me && <Button size="small" onClick={()=>call('directives:acknowledge',{id:r.id}).then(refresh).catch(e=>alert(e.message))}>확인</Button>}</Box>
            </Box>)}</Box>
          : <EmptyState icon={CampaignRounded} title="등록된 지시사항이 없습니다" />}
    </Card>

    <Dialog open={!!dutyForm} onClose={() => setDutyForm(null)} fullWidth><DialogTitle>{dutyForm?.id ? '근무 수정' : '근무 등록'}</DialogTitle><DialogContent>{dutyForm && <Stack spacing={2} sx={{ mt: 1 }}>
      <Stack direction="row" spacing={1.5}>
        <TextField label="일자" type="date" sx={{ flex: 1 }} slotProps={{ inputLabel: { shrink: true } }} value={dutyForm.dutyDate} onChange={e => setDutyForm({ ...dutyForm, dutyDate: e.target.value })}/>
        <TextField select label="근무" sx={{ flex: 1 }} value={dutyForm.shiftType} onChange={e => setDutyForm({ ...dutyForm, shiftType: e.target.value })}>{shifts.map(([v,t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField>
      </Stack>
      <UnitFilter units={units} level={formLevel} unitId={formUnit} onLevel={setFormLevel} onUnit={changeFormUnit}/>
      {membersError?<Alert severity="error">담당자 조회 실패: {membersError}</Alert>:formUnit&&<Alert severity="info">{membersBusy?'담당자 조회 중':`부대 담당자 ${members.length}명${members.length?' · 가상 담당자는 별도 표시됩니다.':' · 등록된 활성 담당자가 없습니다.'}`}</Alert>}
      {dutyForm.id ? <><TextField select label="담당자" value={dutyForm.userId} onChange={e => setDutyForm({ ...dutyForm, userId: e.target.value })}>{dutyPeople.map(u => <MenuItem key={u.id} value={u.id}>{personLabel(u)}</MenuItem>)}</TextField><TextField label="직책" value={dutyForm.position} onChange={e => setDutyForm({ ...dutyForm, position: e.target.value })}/></>
        : <Box className="assignee-box">
          <span className="dd-label">담당자 {assignees.length}명</span>
          {assignees.map((a, i) => <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField select label={`담당자 ${i + 1}`} sx={{ flex: 1 }} value={a.userId} onChange={e => setAssignee(i, { userId: e.target.value })}>{dutyPeople.map(u => <MenuItem key={u.id} value={u.id} disabled={u.id !== a.userId && assignees.some(x => x.userId === u.id)}>{personLabel(u)}</MenuItem>)}</TextField>
            <TextField label={`직책 ${i + 1}`} sx={{ flex: 1 }} value={a.position} onChange={e => setAssignee(i, { position: e.target.value })}/>
            <IconButton aria-label={`담당자 ${i + 1} 삭제`} disabled={assignees.length === 1} onClick={() => removeAssignee(i)}><RemoveCircleOutlineRounded/></IconButton>
          </Stack>)}
          <Button startIcon={<AddRounded/>} disabled={membersBusy||!!membersError||assignees.length >= Math.min(20,dutyPeople.length)} onClick={addAssignee} sx={{ alignSelf: 'flex-start' }}>담당자 추가</Button>
        </Box>}
    </Stack>}</DialogContent><DialogActions><Button onClick={() => setDutyForm(null)}>취소</Button><Button variant="contained" disabled={membersBusy||!!membersError||(dutyForm?.id?!dutyForm.userId||!dutyForm.position?.trim():!assignees.length||assignees.some(a=>!a.userId||!a.position?.trim())||new Set(assignees.map(a=>a.userId)).size!==assignees.length)} onClick={saveDuty}>저장</Button></DialogActions></Dialog>

    <Dialog open={!!directiveForm} onClose={() => setDirectiveForm(null)} fullWidth><DialogTitle>{directiveForm?.id ? '지시사항 수정' : '지시사항 등록'}</DialogTitle><DialogContent>{directiveForm && <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField label="제목" value={directiveForm.title} onChange={e => setDirectiveForm({ ...directiveForm, title: e.target.value })}/>
      <TextField select label="등급" value={directiveForm.level} onChange={e => setDirectiveForm({ ...directiveForm, level: e.target.value })}>{levels.map(([v,t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField>
      <Stack direction="row" spacing={1.5}>
        <TextField label="완료 기한" type="datetime-local" sx={{flex:1}} slotProps={{inputLabel:{shrink:true}}} value={directiveForm.dueAt ?? ''} onChange={e => setDirectiveForm({ ...directiveForm, dueAt:e.target.value })}/>
        <TextField label="담당 부서" sx={{flex:1}} value={directiveForm.department ?? ''} onChange={e => setDirectiveForm({ ...directiveForm, department:e.target.value })}/>
      </Stack>
      <Stack direction="row" spacing={1.5}>
        <TextField select label="담당자" sx={{flex:1}} value={directiveForm.assigneeId ?? ''} onChange={e => setDirectiveForm({ ...directiveForm, assigneeId:e.target.value })}><MenuItem value="">미지정</MenuItem>{users.map(u=><MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}</TextField>
        {directiveForm.id && <TextField select label="이행 상태" sx={{flex:1}} value={directiveForm.status} onChange={e => setDirectiveForm({ ...directiveForm, status:e.target.value })}><MenuItem value="OPEN">미착수</MenuItem><MenuItem value="IN_PROGRESS">수행중</MenuItem><MenuItem value="COMPLETED">완료</MenuItem></TextField>}
      </Stack>
      <TextField label="내용" multiline rows={4} value={directiveForm.content} onChange={e => setDirectiveForm({ ...directiveForm, content: e.target.value })}/>
    </Stack>}</DialogContent><DialogActions><Button onClick={() => setDirectiveForm(null)}>취소</Button><Button variant="contained" onClick={saveDirective}>저장</Button></DialogActions></Dialog>
  </>
}
