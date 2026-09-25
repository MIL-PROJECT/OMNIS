import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { AppBar, Box, Button, Chip, Paper, Stack, TextField, Toolbar, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
import ReportsManagement from './ReportsManagement'

type Row = Record<string, any>

const theme = createTheme({
  palette: {
    primary: { main: '#123B8C', dark: '#0A2A63', light: '#4E77C4' },
    secondary: { main: '#0EA5E9' },
    success: { main: '#15803D' },
    warning: { main: '#B45309' },
    error: { main: '#B91C1C' },
    info: { main: '#0369A1' },
    background: { default: '#F3F5F9', paper: '#FFFFFF' },
    text: { primary: '#0F172A', secondary: '#64748B' },
    divider: '#E6EAF0'
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "'Segoe UI', 'Malgun Gothic', '맑은 고딕', system-ui, sans-serif",
    fontSize: 13,
    button: { textTransform: 'none', fontWeight: 700 }
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 8 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 14 } } },
    MuiTextField: { defaultProps: { size: 'small' } }
  }
})

async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.afccs.invoke(channel, payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const statusText: Record<string, string> = { NORMAL: '정상', WATCH: '주의', INSPECTION: '점검', FAULT: '장애', OFFLINE: '중단', RECEIVED: '접수', TRIAGED: '분류', ASSIGNED: '배정', PLANNED: '계획', IN_PROGRESS: '진행', RESOLVED: '조치완료', CLOSED: '종결', CANCELED: '취소', BLOCKED: '보류', COMPLETED: '완료', URGENT: '긴급', GENERAL: '일반', NOTICE: '공지' }
const label = (v: unknown) => statusText[String(v)] ?? String(v ?? '')
const commonCols = (names: [string, string, number?][]): GridColDef[] => names.map(([field, headerName, width]) => {
  const badge = field === 'status' || field === 'severity'
  return {
    field, headerName, width: width ?? 140, flex: width ? undefined : 1,
    ...(badge
      ? { renderCell: ({ row }: { row: Row }) => <StatusChip code={row[field]} label={label(row[field])} /> }
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
        </Stack>
      </Paper>
    </Box>
  </Box>
}

function Shell({ user, onLogout }: { user: PublicUser; onLogout: () => void }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const links: [string, string, typeof DashboardRounded][] = [
    ['/', '통합상황판', DashboardRounded], ['/operations', '운영현황', DnsRounded], ['/incidents', '고장관리', ReportProblemRounded],
    ['/maintenance', '정비관리', BuildRounded], ['/duty', '근무/지시사항', EventNoteRounded], ['/ai', 'AI 지원', SmartToyRounded],
    ['/reports', '보고서/통계', AssessmentRounded], ['/settings', '시스템관리', SettingsRounded]
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
          <Chip className="user-chip" size="small" label={`${user.display_name} · ${user.role}`} />
          <Button className="logout-btn" color="inherit" startIcon={<LogoutRounded sx={{ fontSize: 17 }} />} onClick={() => call('auth:logout').then(onLogout)}>로그아웃</Button>
        </Stack>
      </Toolbar>
    </AppBar>
    <nav>{links.map(([to, text, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon /><span>{text}</span></NavLink>)}</nav>
    <main>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/operations" element={<Operations user={user} />} />
        <Route path="/incidents" element={<Incidents user={user} />} />
        <Route path="/maintenance" element={<Maintenance user={user} />} />
        <Route path="/duty" element={<Duty user={user} />} />
        <Route path="/ai" element={<Ai />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings user={user} />} />
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
  useEffect(() => { call<Row>('dashboard:getSummary').then(setData) }, [])
  if (!data) return <Typography>불러오는 중...</Typography>
  const metrics: [string, unknown, typeof HubRounded, string][] = [
    ['전체 체계', data.systemCount, HubRounded, 'blue'], ['정상 운용', data.normalCount, CheckCircleRounded, 'green'],
    ['긴급 장애', data.urgentCount, ReportRounded, 'red'], ['진행 중 정비', data.maintenanceCount, BuildRounded, 'amber']
  ]
  return <>
    <h1>통합상황판</h1>
    <div className="metrics">{metrics.map(([k, v, Icon, tone]) => <Paper className={`metric metric-${tone}`} key={k}><Box className="metric-icon"><Icon /></Box><Box><Typography className="metric-label">{k}</Typography><Typography className="metric-value">{v as any}</Typography></Box></Paper>)}</div>
    <div className="dashboard-grid">
      <Panel title="정보통신 운영 현황"><DataGrid rows={data.systems} columns={commonCols([['name', '체계명'], ['status', '상태', 90], ['uptime_pct', '운용률', 100]])} density="compact" hideFooter autoHeight /></Panel>
      <Panel title="정비작업 진행 현황">
        <ResponsiveContainer width="100%" height={245}>
          <AreaChart data={data.recentMaintenance.map((r: Row, i: number) => ({ name: i + 1, progress: r.progress })).reverse()}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E1E0D9" />
            <XAxis dataKey="name" tick={{ fill: '#898781', fontSize: 11 }} axisLine={{ stroke: '#C3C2B7' }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#898781', fontSize: 11 }} axisLine={{ stroke: '#C3C2B7' }} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E6EAF0', fontSize: 12 }} />
            <Area dataKey="progress" stroke="#2A78D6" strokeWidth={2} fill="#2A78D6" fillOpacity={0.12} />
          </AreaChart>
        </ResponsiveContainer>
        <Typography variant="body2" color="text.secondary">예정 및 진행 작업 {data.maintenanceCount}건</Typography>
      </Panel>
      <Panel title="최근 고장 접수"><DataGrid rows={data.recentIncidents} columns={commonCols([['ticket_no', '접수번호', 165], ['title', '제목'], ['severity', '중요도', 85], ['status', '상태', 95]])} density="compact" hideFooter autoHeight /></Panel>
      <Panel title="지시사항 / 공지"><Stack spacing={0}>{data.directives.map((r: Row) => <Box className="notice" key={r.id}><StatusChip code={r.level} label={label(r.level)} /><span>{r.title}</span><small>{String(r.issued_at).slice(0, 10)}</small></Box>)}</Stack></Panel>
    </div>
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
