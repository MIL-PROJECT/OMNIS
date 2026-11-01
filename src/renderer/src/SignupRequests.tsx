import { useEffect, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import HowToRegRounded from '@mui/icons-material/HowToRegRounded'
import type { Channel, Result, Role } from '../../shared/contracts'
import StatusChip from './StatusChip'
import { Avatar, Card, PageHeader, StatusFilter, countBy, fmtDateTime, fmtShort, type Tone } from './ui'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel, payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const statuses: [string, string, Tone][] = [['PENDING', '대기', 'orange'], ['APPROVED', '승인', 'green'], ['REJECTED', '반려', 'red']]
const statusChip = (v: string) => { const s = statuses.find(x => x[0] === v); return <StatusChip code={v} label={s?.[1] ?? v} tone={s?.[2] ?? 'gray'} /> }
const roles: [Role, string, string][] = [
  ['USER', '일반 사용자', '본인 고장 접수·운영현황·근무 업무, 관리자 기능 제외'],
  ['OPERATOR', '운용요원', '운영현황·고장 접수·근무/지시사항 관리'],
  ['MAINTAINER', '정비요원', '정비 작업 등록·진행 관리'],
  ['VIEWER', '조회전용', '허용된 업무 화면 조회, 관리자 기능 제외'],
  ['ADMIN', '관리자', '시스템관리와 사용자 승인까지 전체 권한']
]
const roleText = (v: string) => roles.find(r => r[0] === v)?.[1] ?? v

export default function SignupRequests({ onChange, embedded=false }: { onChange?: () => void; embedded?:boolean }) {
  const [adminPassword,setAdminPassword]=useState(''),[approvalBusy,setApprovalBusy]=useState(false),[approvalError,setApprovalError]=useState('')
  const [pageError,setPageError]=useState(''),[loading,setLoading]=useState(false)
  const [rows, setRows] = useState<Row[]>([]), [filter, setFilter] = useState('PENDING')
  const [approve, setApprove] = useState<Row | null>(null), [role, setRole] = useState<Role>('USER')
  const [reject, setReject] = useState<Row | null>(null), [reason, setReason] = useState(''), [detail, setDetail] = useState<Row | null>(null)
  const refresh = () => {setLoading(true);setPageError('');return call<Row[]>('admin:signupRequests').then(setRows).catch(e=>setPageError(e.message)).finally(()=>setLoading(false))}
  useEffect(() => { refresh() }, [])
  const done = () => { setApprove(null); setReject(null); setReason(''); refresh(); onChange?.() }
  const counts = countBy(rows, 'status'), shown = filter ? rows.filter(r => r.status === filter) : rows
  const columns: GridColDef[] = [
    { field: 'created_at', headerName: '신청일시', width: 120, renderCell: ({ row }) => <span className="cell-muted">{fmtShort(row.created_at)}</span> },
    { field: 'service_no', headerName: '군번', width: 105, renderCell: ({ row }) => <span className="cell-code">{row.service_no}</span> },
    { field: 'display_name', headerName: '신청자', width: 130, renderCell: ({ row }) => <Box className="cell-person"><Avatar name={row.display_name} size={24} /><span className="cell-strong">{row.display_name}</span><span className="cell-muted">{row.rank_name}</span></Box> },
    { field: 'unit_name', headerName: '소속', flex: 1, minWidth: 130 },
    { field: 'username', headerName: '아이디', width: 110, renderCell: ({ row }) => <span className="cell-code">{row.username}</span> },
    { field: 'phone', headerName: '연락처', width: 118, renderCell: ({ row }) => <span className="cell-muted">{row.phone || '-'}</span> },
    { field: 'status', headerName: '상태', width: 80, renderCell: ({ row }) => statusChip(row.status) },
    { field: 'actions', headerName: '처리', width: 150, sortable: false, renderCell: ({ row }) => row.status === 'PENDING'
      ? <Box className="ui-row-actions signup-actions" onClick={e => e.stopPropagation()}>
          <Button size="small" variant="contained" onClick={() => { setAdminPassword('');setApprovalError('');setRole('USER'); setApprove(row) }}>승인</Button>
          <Button size="small" variant="outlined" color="error" onClick={() => setReject(row)}>반려</Button>
        </Box>
      : <span className="cell-muted">{row.reviewer_name ?? '-'} · {fmtShort(row.reviewed_at)}{row.status === 'APPROVED' ? ` · ${roleText(row.approved_role)}` : ''}</span> }
  ]
  return <>
    {!embedded&&<PageHeader section="관리" title="사용자 신청현황" description="로그인 화면에서 접수된 사용자 등록 신청을 검토하고 승인 또는 반려합니다." />}
    <Card icon={HowToRegRounded} tone="sky" title="등록 신청 목록" subtitle={`전체 ${rows.length}건 · 대기 ${counts.PENDING ?? 0}건`}>
      <Box className="ui-toolbar"><StatusFilter total={rows.length} value={filter} onChange={setFilter} items={statuses.map(([value, label, tone]) => ({ value, label, tone, count: counts[value] ?? 0 }))} /></Box>
      {pageError&&<Alert severity="error" action={<Button onClick={refresh}>재시도</Button>}>{pageError}</Alert>}
      <DataGrid loading={loading} className="clickable-grid admin-grid" rows={shown} columns={columns} density="compact" rowHeight={48} columnHeaderHeight={44} disableRowSelectionOnClick onRowClick={({ row }) => setDetail(row)}
        pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
        localeText={{ noRowsLabel: filter === 'PENDING' ? '승인 대기 중인 신청이 없습니다' : '표시할 신청이 없습니다' }} />
    </Card>

    <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
      {detail && <>
        <DialogTitle sx={{ pb: 1 }}><Typography className="dd-kicker">사용자 등록 신청 · {fmtDateTime(detail.created_at)}</Typography><Typography className="dd-heading">{detail.rank_name} {detail.display_name}</Typography></DialogTitle>
        <DialogContent dividers>
          <Box className="dd-grid">
            {([['군번', detail.service_no], ['아이디', detail.username], ['소속', detail.unit_name], ['연락처', detail.phone || '-']] as const).map(([k, v]) => <Box key={k} className="dd-item"><span className="dd-label">{k}</span><span className="dd-value">{v}</span></Box>)}
            <Box className="dd-item"><span className="dd-label">상태</span>{statusChip(detail.status)}</Box>
            {detail.status !== 'PENDING' && <Box className="dd-item"><span className="dd-label">처리</span><span className="dd-value">{detail.reviewer_name ?? '-'} · {fmtDateTime(detail.reviewed_at)}</span></Box>}
            {detail.status === 'APPROVED' && <Box className="dd-item"><span className="dd-label">부여 권한</span><span className="dd-value">{roleText(detail.approved_role)}</span></Box>}
          </Box>
          <Box className="dd-long"><span className="dd-label">신청 사유</span><Typography className="dd-text">{detail.reason || '-'}</Typography></Box>
          {detail.status === 'REJECTED' && <Box className="dd-long"><span className="dd-label">반려 사유</span><Typography className="dd-text">{detail.reject_reason}</Typography></Box>}
        </DialogContent>
        <DialogActions>
          {detail.status === 'PENDING' && <><Button color="error" onClick={() => { setReject(detail); setDetail(null) }}>반려</Button><Button variant="contained" onClick={() => { setAdminPassword('');setApprovalError('');setRole('USER'); setApprove(detail); setDetail(null) }}>승인</Button></>}
          <Button onClick={() => setDetail(null)} sx={{ ml: 'auto !important' }}>닫기</Button>
        </DialogActions>
      </>}
    </Dialog>

    <Dialog open={!!approve} onClose={() => setApprove(null)} fullWidth maxWidth="xs">
      {approve && <>
        <DialogTitle>사용자 승인</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}><b>{approve.rank_name} {approve.display_name}</b> ({approve.username}) 계정을 생성합니다. 부여할 권한을 선택하십시오.</Typography>
          <TextField select fullWidth label="권한" value={role} onChange={e => setRole(e.target.value as Role)}>
            {roles.map(([v, t, d]) => <MenuItem key={v} value={v}><Box><Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{t}</Typography><Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{d}</Typography></Box></MenuItem>)}
          </TextField>
          {role==='ADMIN'&&<TextField fullWidth sx={{mt:2}} label="관리자 비밀번호 확인" type="password" autoComplete="current-password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)}/>}
          {approvalError&&<Typography color="error" role="alert" sx={{mt:1}}>{approvalError}</Typography>}
        </DialogContent>
        <DialogActions><Button onClick={() => setApprove(null)}>취소</Button><Button variant="contained" disabled={approvalBusy||(role==='ADMIN'&&!adminPassword)} onClick={async()=>{if(approvalBusy)return;setApprovalBusy(true);setApprovalError('');try{await call('admin:approveSignup',{id:approve.id,role,adminPassword:role==='ADMIN'?adminPassword:undefined});setAdminPassword('');done()}catch(e){setApprovalError((e as Error).message)}finally{setApprovalBusy(false)}}}>{approvalBusy?'처리 중…':'승인'}</Button></DialogActions>
      </>}
    </Dialog>

    <Dialog open={!!reject} onClose={() => setReject(null)} fullWidth maxWidth="xs">
      {reject && <>
        <DialogTitle>신청 반려</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}><b>{reject.rank_name} {reject.display_name}</b> ({reject.username})의 신청을 반려합니다. 반려 사유는 신청자가 로그인을 시도할 때 표시됩니다.</Typography>
          <TextField fullWidth multiline rows={3} label="반려 사유" value={reason} onChange={e => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions><Button onClick={() => setReject(null)}>취소</Button><Button variant="contained" color="error" disabled={approvalBusy||reason.trim().length < 2} onClick={()=>{if(approvalBusy)return;setApprovalBusy(true);call('admin:rejectSignup',{id:reject.id,reason}).then(done).catch(e=>alert(e.message)).finally(()=>setApprovalBusy(false))}}>반려</Button></DialogActions>
      </>}
    </Dialog>
  </>
}
