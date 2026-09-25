import { useEffect, useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import StorageRounded from '@mui/icons-material/StorageRounded'
import SmartToyRounded from '@mui/icons-material/SmartToyRounded'
import BackupRounded from '@mui/icons-material/BackupRounded'
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded'
import ReportRounded from '@mui/icons-material/ReportRounded'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import { Card, EmptyState, PageHeader, fmtDateTime, type Tone } from './ui'

type Row = Record<string, any>
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel,payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const actionTone: Record<string, Tone> = { CREATE:'green', UPDATE:'sky', UPDATE_STATUS:'sky', ASSIGN:'lavender', DELETE:'red', RESET:'red', BACKUP:'gray', SEED:'gray' }
const columns: GridColDef[] = [
  { field:'created_at',headerName:'시간',width:170,renderCell:({row}) => <span className="cell-muted">{fmtDateTime(row.created_at)}</span> },
  { field:'action',headerName:'작업',width:130,renderCell:({row}) => <StatusChip code={row.action} label={row.action} tone={actionTone[row.action] ?? 'gray'} /> },
  { field:'entity_type',headerName:'대상',width:190,renderCell:({row}) => <span className="cell-code">{row.entity_type}</span> },
  { field:'entity_id',headerName:'식별자',flex:1,renderCell:({row}) => <span className="cell-muted">{row.entity_id}</span> }
]
const bytes = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`

export default function SystemManagement({ user }: { user: PublicUser }) {
  const [info,setInfo] = useState<Row | null>(null),[audit,setAudit] = useState<Row[]>([]),[notifications,setNotifications] = useState<Row[]>([]),[tab,setTab] = useState(0),[step,setStep] = useState(0)
  const [provider,setProvider] = useState('LOCAL'),[endpoint,setEndpoint] = useState('http://127.0.0.1:11434'),[model,setModel] = useState('gemma3')
  const loadNotifications = () => call<Row[]>('system:notifications').then(setNotifications)
  useEffect(() => { call<Row>('system:getInfo').then(r => { setInfo(r); setProvider(r.aiProvider); setEndpoint(r.ollamaEndpoint); setModel(r.ollamaModel) }); loadNotifications(); if (user.role === 'ADMIN') call<Row[]>('system:auditLogs',{ limit:100 }).then(setAudit) }, [user.role])
  const admin = user.role === 'ADMIN'
  const unread = notifications.filter(n => !n.read_at).length
  const infoRows: [string, React.ReactNode, boolean?][] = info ? [['앱 버전', info.version], ['스키마 버전', `v${info.schemaVersion}`], ['DB 크기', bytes(info.dbSize)], ['AI 제공자', info.aiProvider === 'OLLAMA' ? 'Ollama (로컬)' : 'Local Rule'], ['DB 경로', info.dbPath, true], ['백업 경로', info.backupPath, true]] : []
  return <>
    <PageHeader section="관리" title="시스템관리" description="시스템 정보, AI 설정, 데이터 백업과 감사 기록을 관리합니다." />
    <Tabs value={tab} onChange={(_,v) => setTab(v)} className="page-tabs">
      <Tab label="정보"/>
      <Tab label="알림" icon={unread ? <span className="tab-count">{unread}</span> : undefined} iconPosition="end"/>
      {admin && <Tab label="감사 로그"/>}
    </Tabs>

    {tab === 0 && <>
      <div className="dashboard-grid">
        <Card icon={StorageRounded} tone="sky" title="시스템 정보" subtitle="로컬 설치 환경">
          <dl className="info-list">{infoRows.map(([k, v, path]) => <div key={k}><dt>{k}</dt><dd className={path ? 'path' : ''}>{v}</dd></div>)}</dl>
        </Card>
        {admin && <Card icon={SmartToyRounded} tone="lavender" title="AI 설정" subtitle="분석에 사용할 제공자와 로컬 모델">
          <Stack spacing={2} sx={{ p: 2.25 }}>
            <TextField select label="Provider" value={provider} onChange={e => setProvider(e.target.value)}><MenuItem value="LOCAL">Local Rule</MenuItem><MenuItem value="OLLAMA">Ollama (로컬)</MenuItem></TextField>
            <TextField label="Ollama Endpoint" value={endpoint} disabled={provider !== 'OLLAMA'} onChange={e => setEndpoint(e.target.value)} helperText="보안을 위해 127.0.0.1 또는 localhost만 허용됩니다."/>
            <TextField label="Model" value={model} disabled={provider !== 'OLLAMA'} onChange={e => setModel(e.target.value)}/>
            <Box sx={{ display:'flex', justifyContent:'flex-end' }}><Button variant="outlined" onClick={() => call('system:setAiSettings',{ provider,endpoint,model }).then(() => { alert('AI 설정 저장 완료'); call<Row>('system:getInfo').then(setInfo) }).catch(e => alert(e.message))}>AI 설정 저장</Button></Box>
          </Stack>
        </Card>}
      </div>
      {admin && <Card icon={BackupRounded} tone="green" title="데이터 관리" subtitle="매일 첫 실행 시 자동 백업 · 최근 10개 보관">
        <Box className="data-actions">
          <Box><strong>수동 백업</strong><span>현재 데이터베이스를 백업 폴더에 즉시 저장합니다.</span></Box>
          <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<FolderOpenRounded />} onClick={() => call('system:openDataFolder').catch(e => alert(e.message))}>데이터 폴더 열기</Button><Button variant="contained" startIcon={<BackupRounded />} onClick={() => call<string>('system:backup').then(v => alert(`백업: ${v}`)).catch(e => alert(e.message))}>DB 백업</Button></Stack>
        </Box>
        <Box className="danger-zone">
          <span className="ui-icon-tile tone-red"><WarningAmberRounded /></span>
          <Box sx={{ flex: 1 }}><strong>위험 구역 · Demo 데이터 초기화</strong><span>현재 데이터를 백업한 뒤 가상 시연 데이터 초기 상태로 되돌립니다. 입력한 데이터는 모두 사라집니다.</span></Box>
          <Button variant="outlined" color="error" onClick={() => setStep(1)}>Demo 데이터 초기화</Button>
        </Box>
      </Card>}
    </>}

    {tab === 1 && <Card icon={NotificationsNoneRounded} tone="orange" title="알림" subtitle={`전체 ${notifications.length}건 · 읽지 않음 ${unread}건`}>
      {notifications.length ? <Box>{notifications.map(n => <Box className={`notify ${n.read_at ? 'read' : ''}`} key={n.id}>
        <span className={`ui-icon-tile tone-${n.type === 'URGENT' ? 'red' : 'sky'}`}><ReportRounded /></span>
        <Box sx={{ flex: 1, minWidth: 0 }}><strong>{n.title}</strong><span>{n.body}</span></Box>
        <time>{fmtDateTime(n.created_at)}</time>
        {!n.read_at ? <Button size="small" onClick={() => call('system:markNotificationRead',{ id:n.id }).then(loadNotifications).catch(e => alert(e.message))}>읽음</Button> : <span className="notify-done">확인함</span>}
      </Box>)}</Box> : <EmptyState icon={NotificationsNoneRounded} title="알림이 없습니다" description="긴급 고장이 접수되면 이곳에 표시됩니다." />}
    </Card>}

    {tab === 2 && admin && <Card icon={HistoryRounded} tone="gray" title="감사 로그" subtitle={`최근 ${audit.length}건 · 데이터 변경 이력`}>
      <DataGrid rows={audit} columns={columns} density="compact" rowHeight={48} columnHeaderHeight={44} disableRowSelectionOnClick pageSizeOptions={[10,25,50]} initialState={{ pagination:{paginationModel:{pageSize:10,page:0}} }}/>
    </Card>}

    <Dialog open={step > 0} onClose={() => setStep(0)}>
      <DialogTitle>Demo 데이터 초기화 · {step}/2</DialogTitle>
      <DialogContent><Typography>{step === 1 ? '현재 데이터가 백업되고 가상 데이터 초기 상태로 돌아갑니다.' : '최종 확인: 사용자가 입력한 데이터가 초기화됩니다.'}</Typography></DialogContent>
      <DialogActions><Button onClick={() => setStep(0)}>취소</Button><Button color="error" variant={step === 2 ? 'contained' : 'text'} onClick={() => step === 1 ? setStep(2) : call('system:resetDemo',{ confirm:'RESET DEMO' }).then(() => { setStep(0); window.dispatchEvent(new Event('omnis:reset')) }).catch(e => alert(e.message))}>{step === 1 ? '다음':'초기화 실행'}</Button></DialogActions>
    </Dialog>
  </>
}
