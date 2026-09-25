import { useEffect, useState } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { AppBar, Box, Button, Chip, Paper, Stack, TextField, Toolbar, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import DashboardRounded from '@mui/icons-material/DashboardRounded'
import DnsRounded from '@mui/icons-material/DnsRounded'
import ReportProblemRounded from '@mui/icons-material/ReportProblemRounded'
import BuildRounded from '@mui/icons-material/BuildRounded'
import EventNoteRounded from '@mui/icons-material/EventNoteRounded'
import SmartToyRounded from '@mui/icons-material/SmartToyRounded'
import AssessmentRounded from '@mui/icons-material/AssessmentRounded'
import SettingsRounded from '@mui/icons-material/SettingsRounded'
import HubRounded from '@mui/icons-material/HubRounded'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import ReportRounded from '@mui/icons-material/ReportRounded'
import ShieldRounded from '@mui/icons-material/ShieldRounded'
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded'
import LogoutRounded from '@mui/icons-material/LogoutRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import DutyManagement from './DutyManagement'
import OperationsManagement from './OperationsManagement'
import IncidentsManagement from './IncidentsManagement'
import MaintenanceManagement from './MaintenanceManagement'
import SystemManagement from './SystemManagement'
import AiManagement from './AiManagement'
import MaintenanceProgress from './MaintenanceProgress'
import ReportsManagement from './ReportsManagement'
import DashboardDetail, { MetricListDialog, type DetailTarget, type ListTarget } from './DashboardDetail'

type Row = Record<string, any>

// Notion 디자인 토큰 (docs/design/DESIGN.md) — style.css의 CSS 변수와 같은 값
const theme = createTheme({
  palette: {
    primary: { main: '#5645d4', dark: '#4534b3', light: '#7b6ce0', contrastText: '#ffffff' },
    secondary: { main: '#0075de', dark: '#005bab' },
    success: { main: '#1aae39' },
    warning: { main: '#dd5b00' },
    error: { main: '#e03131' },
    info: { main: '#0075de' },
    background: { default: '#fafaf9', paper: '#ffffff' },
    text: { primary: '#1a1a1a', secondary: '#5d5b54', disabled: '#bbb8b1' },
    divider: '#e5e3df'
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "Inter, 'Segoe UI', 'Malgun Gothic', '맑은 고딕', system-ui, sans-serif",
    fontSize: 13,
    h4: { fontWeight: 600 }, h5: { fontWeight: 600 }, h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 }
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8 },
        // 보라색은 화면의 주요 버튼(contained)에만 — 보조 버튼은 잉크색 (Notion button-ghost / secondary)
        outlined: ({ ownerState }) => ownerState.color === 'primary' ? { borderColor: '#c8c4be', color: '#1a1a1a', '&:hover': { borderColor: '#a4a097', backgroundColor: '#f6f5f4' } } : {},
        text: ({ ownerState }) => ({ '&:hover': { backgroundColor: '#f6f5f4' }, ...(ownerState.color === 'primary' ? { color: '#37352f' } : {}) })
      }
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#c8c4be' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#a4a097' } } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 12, boxShadow: 'rgba(15,15,15,.16) 0px 16px 48px -8px' } } },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiMenu: { styleOverrides: { paper: { boxShadow: 'rgba(15,15,15,.16) 0px 16px 48px -8px', border: '1px solid #e5e3df' } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: '#1a1a1a', height: 2 } } },
    MuiTab: { styleOverrides: { root: { color: '#787671', fontWeight: 500, '&.Mui-selected': { color: '#1a1a1a' } } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: '#1a1a1a', fontSize: 12, fontWeight: 500, borderRadius: 6 }, arrow: { color: '#1a1a1a' } } },
    MuiTextField: { defaultProps: { size: 'small' } }
  }
})

async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.afccs.invoke(channel, payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const statusText: Record<string, string> = { NORMAL: '정상', WATCH: '주의', INSPECTION: '점검', FAULT: '장애', OFFLINE: '중단', RECEIVED: '접수', TRIAGED: '분류', ASSIGNED: '배정', PLANNED: '계획', IN_PROGRESS: '진행', RESOLVED: '조치완료', CLOSED: '종결', CANCELED: '취소', BLOCKED: '보류', COMPLETED: '완료', URGENT: '긴급', GENERAL: '일반', NOTICE: '공지' }
const label = (v: unknown) => statusText[String(v)] ?? String(v ?? '')
const roleText: Record<string, string> = { ADMIN: '관리자', OPERATOR: '운용요원', MAINTAINER: '정비요원', VIEWER: '조회전용', USER: '일반 사용자' }
const commonCols = (names: [string, string, number?][]): GridColDef[] => names.map(([field, headerName, width]) => {
  const badge = field === 'status' || field === 'severity'
  return {
    field, headerName, width: width ?? 140, flex: width ? undefined : 1,
    ...(badge
      ? { renderCell: ({ row }: { row: Row }) => <StatusChip code={row[field]} label={label(row[field])} /> }
      : field.endsWith('_at') ? { valueFormatter: (v: unknown) => String(v ?? '').replace('T', ' ').slice(0, 16) }
      : field === 'progress' ? { valueFormatter: (v: unknown) => `${v ?? 0}%` }
      : { valueFormatter: (v: unknown) => String(v ?? '') })
  }
})

function Login({ onLogin }: { onLogin: (u: PublicUser) => void }) {
  const [username, setUsername] = useState('demo_admin'), [password, setPassword] = useState('Demo!2026'), [error, setError] = useState('')
  const submit = () => call<PublicUser>('auth:login', { username, password }).then(onLogin).catch(x => setError(x.message))
  return <Box className="login">
    <Box className="login-hero">
      <Box className="login-hero-mark"><ShieldRounded sx={{ fontSize: 30 }} /></Box>
      <Box>
        <Typography variant="h4">AFCCS</Typography>
        <Typography className="sub">정보통신 운용·정비 통합체계</Typography>
      </Box>
      <Stack className="login-points">
        <Box className="pt"><HubRounded /> 실시간 운영 현황 통합 관제</Box>
        <Box className="pt"><BuildRounded /> 정비 이력 및 일정 관리</Box>
        <Box className="pt"><SmartToyRounded /> AI 기반 고장 분석 지원</Box>
      </Stack>
    </Box>
    <Box className="login-panel">
      <Paper className="login-card" elevation={0}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>로그인</Typography>
        <Typography color="text.secondary" sx={{ mt: .5, mb: 3 }}>가상 데이터 기반 오프라인 시연 환경</Typography>
        <Stack spacing={2}>
          <TextField size="medium" label="아이디" value={username} onChange={e => setUsername(e.target.value)} />
          <TextField size="medium" label="비밀번호" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} />
          <Button variant="contained" size="large" fullWidth onClick={submit}>로그인</Button>
          {error && <Typography color="error" variant="body2">{error}</Typography>}
          <Typography color="text.secondary" variant="body2">데모 계정 · 관리자 demo_admin / 일반 사용자 demo_user (비밀번호 동일)</Typography>
        </Stack>
      </Paper>
    </Box>
  </Box>
}

function Shell({ user, onLogout }: { user: PublicUser; onLogout: () => void }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const admin = user.role === 'ADMIN'
  // 네 번째 값: 관리자 전용 메뉴 여부
  const links: [string, string, typeof DashboardRounded, boolean?][] = [
    ['/', '통합상황판', DashboardRounded], ['/operations', '운영현황', DnsRounded], ['/incidents', '고장관리', ReportProblemRounded],
    ['/maintenance', '정비관리', BuildRounded], ['/duty', '근무/지시사항', EventNoteRounded], ['/ai', 'AI 지원', SmartToyRounded],
    ['/reports', '보고서/통계', AssessmentRounded], ['/settings', '시스템관리', SettingsRounded, true]
  ]
  return <Box className="app">
    <AppBar position="static" elevation={0}>
      <Toolbar className="top">
        <Box className="brand">
          <Box className="brand-mark"><ShieldRounded sx={{ fontSize: 20 }} /></Box>
          <Box className="brand-text"><Typography variant="h6">AFCCS 정보통신 운용·정비 통합체계</Typography><span>가상 시연 데이터 · 오프라인 업무 시스템</span></Box>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Stack direction="row" spacing={.6} sx={{ alignItems: 'center' }} className="clock"><AccessTimeRounded /><span>{now.toLocaleString('ko-KR')}</span></Stack>
          <Chip className="user-chip" size="small" label={`${user.display_name} · ${roleText[user.role] ?? user.role}`} />
          <Button className="logout-btn" color="inherit" startIcon={<LogoutRounded sx={{ fontSize: 17 }} />} onClick={() => call('auth:logout').then(onLogout)}>로그아웃</Button>
        </Stack>
      </Toolbar>
    </AppBar>
    <nav>{links.filter(([, , , adminOnly]) => admin || !adminOnly).map(([to, text, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon /><span>{text}</span></NavLink>)}</nav>
    <main>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/operations" element={<Operations user={user} />} />
        <Route path="/incidents" element={<Incidents user={user} />} />
        <Route path="/maintenance" element={<Maintenance user={user} />} />
        <Route path="/duty" element={<Duty user={user} />} />
        <Route path="/ai" element={<Ai />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={admin ? <Settings user={user} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    <footer className="status-bar">
      <span className="status-item"><span className="status-dot" />사용자: {user.username}</span>
      <span className="status-item"><span className="status-dot blue" />DB: 로컬 SQLite</span>
      <span className="status-item"><span className="status-dot blue" />AI: Local Rule</span>
      <span className="status-item push">Version 1.0.0</span>
    </footer>
  </Box>
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) { return <Paper className="panel"><Box className="panel-head"><Typography>{title}</Typography>{action}</Box>{children}</Paper> }

function Dashboard() {
  const [data, setData] = useState<Row | null>(null)
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [list, setList] = useState<ListTarget | null>(null)
  const open = (kind: DetailTarget['kind']) => ({ row }: { row: Row }) => setDetail({ kind, row })
  useEffect(() => { call<Row>('dashboard:getSummary').then(setData) }, [])
  if (!data) return <Typography>불러오는 중...</Typography>
  const systemCols = commonCols([['code', '체계코드', 110], ['name', '체계명'], ['category', '구분', 110], ['status', '상태', 90], ['uptime_pct', '운용률', 90], ['today_incident_count', '금일 고장', 90]])
  const metrics: [string, unknown, typeof HubRounded, string, ListTarget][] = [
    ['전체 체계', data.systemCount, HubRounded, 'blue', { title: '전체 체계', kind: 'system', rows: data.allSystems, columns: systemCols }],
    ['정상 운용', data.normalCount, CheckCircleRounded, 'green', { title: '정상 운용 체계', kind: 'system', rows: data.allSystems.filter((r: Row) => r.status === 'NORMAL'), columns: systemCols }],
    ['긴급 장애', data.urgentCount, ReportRounded, 'red', { title: '긴급 장애 (미종결)', kind: 'incident', rows: data.urgentIncidents, columns: commonCols([['ticket_no', '접수번호', 150], ['title', '제목'], ['system_name', '체계', 120], ['status', '상태', 90], ['reported_at', '접수일시', 150]]) }],
    ['진행 중 정비', data.maintenanceCount, BuildRounded, 'amber', { title: '예정·진행 중 정비', kind: 'maintenance', rows: data.openMaintenance, columns: commonCols([['task_no', '작업번호', 150], ['title', '작업명'], ['status', '상태', 85], ['assignee_name', '담당자', 90], ['scheduled_date', '예정일', 105], ['progress', '진행률', 80]]) }]
  ]
  return <>
    <h1>통합상황판</h1>
    <div className="metrics">{metrics.map(([k, v, Icon, tone, list]) => <Paper className={`metric metric-${tone} clickable`} key={k} role="button" tabIndex={0} aria-label={`${k} ${v}건 목록 보기`}
      onClick={() => setList(list)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setList(list) } }}>
      <Box className="metric-icon"><Icon /></Box><Box><Typography className="metric-label">{k}</Typography><Typography className="metric-value">{v as any}</Typography></Box></Paper>)}</div>
    <div className="dashboard-grid">
      <Panel title="정보통신 운영 현황"><DataGrid className="clickable-grid" rows={data.systems} columns={commonCols([['name', '체계명'], ['status', '상태', 90], ['uptime_pct', '운용률', 100]])} density="compact" hideFooter autoHeight onRowClick={open('system')} /></Panel>
      <Panel title="정비작업 진행 현황" action={<span className="panel-meta">예정·진행 {data.maintenanceCount}건</span>}><MaintenanceProgress status={data.maintenanceStatus} active={data.activeMaintenance} onSelect={row => setDetail({ kind: 'maintenance', row })} /></Panel>
      <Panel title="최근 고장 접수"><DataGrid className="clickable-grid" rows={data.recentIncidents} columns={commonCols([['ticket_no', '접수번호', 165], ['title', '제목'], ['severity', '중요도', 85], ['status', '상태', 95]])} density="compact" hideFooter autoHeight onRowClick={open('incident')} /></Panel>
      <Panel title="지시사항 / 공지"><Stack spacing={0}>{data.directives.map((r: Row) => <Box component="button" type="button" className="notice clickable" key={r.id} onClick={() => setDetail({ kind: 'directive', row: r })}><StatusChip code={r.level} label={label(r.level)} /><span>{r.title}</span><small>{String(r.issued_at).slice(0, 10)}</small></Box>)}</Stack></Panel>
    </div>
    <MetricListDialog target={list} onSelect={setDetail} onClose={() => setList(null)} />
    <DashboardDetail target={detail} label={label} onClose={() => setDetail(null)} />
  </>
}

function Operations({ user }: { user: PublicUser }) { return <OperationsManagement user={user} /> }
function Incidents({ user }: { user: PublicUser }) { return <IncidentsManagement user={user} /> }
function Maintenance({ user }: { user: PublicUser }) { return <MaintenanceManagement user={user} /> }
function Duty({ user }: { user: PublicUser }) { return <DutyManagement user={user} /> }
function Ai() { return <AiManagement /> }
function Reports() { return <ReportsManagement /> }
function Settings({ user }: { user: PublicUser }) { return <SystemManagement user={user} /> }
export default function App() { const [user,setUser] = useState<PublicUser | null>(null),[ready,setReady] = useState(false); useEffect(() => { call<PublicUser | null>('auth:me').then(setUser).finally(() => setReady(true)); const reset = () => setUser(null); window.addEventListener('afccs:reset',reset); return () => window.removeEventListener('afccs:reset',reset) }, []); return <ThemeProvider theme={theme}><HashRouter>{ready && (user ? <Shell user={user} onLogout={() => setUser(null)}/> : <Login onLogin={setUser}/>)}</HashRouter></ThemeProvider> }
