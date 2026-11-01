import AdminCenter from './AdminCenter'
import PasswordChange from './PasswordChange'
import LockResetRounded from '@mui/icons-material/LockResetRounded'
import MyWork from './MyWork'
import ManualsManagement from './ManualsManagement'
import MenuBookRounded from '@mui/icons-material/MenuBookRounded'
import { useEffect, useState } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, IconButton, InputAdornment, Paper, TextField, Tooltip, Typography } from '@mui/material'
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded'
import LockOutlined from '@mui/icons-material/LockOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { koKR as gridKoKR } from '@mui/x-data-grid/locales'
import type {} from '@mui/x-data-grid/themeAugmentation'
import { koKR } from '@mui/material/locale'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import type { SvgIconComponent } from '@mui/icons-material'
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
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded'
import LogoutRounded from '@mui/icons-material/LogoutRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import CloudOffRounded from '@mui/icons-material/CloudOffRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import CampaignRounded from '@mui/icons-material/CampaignRounded'
import PushPinRounded from '@mui/icons-material/PushPinRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import StatusChip from './StatusChip'
import DutyManagement from './DutyManagement'
import OperationsManagement from './OperationsManagement'
import IncidentsManagement from './IncidentsManagement'
import MaintenanceManagement from './MaintenanceManagement'
import SystemManagement from './SystemManagement'
import SignupDialog from './SignupDialog'
import SignupRequests from './SignupRequests'
import HowToRegRounded from '@mui/icons-material/HowToRegRounded'
import FactCheckRounded from '@mui/icons-material/FactCheckRounded'
import AiManagement from './AiManagement'
import MaintenanceProgress from './MaintenanceProgress'
import ReportsManagement from './ReportsManagement'
import { Avatar, BrandEmblem, Card, Meter, PageHeader, Paged, countBy, fmtDateTime, type Tone } from './ui'
import DashboardDetail, { MetricListDialog, type DetailTarget, type ListTarget } from './DashboardDetail'
import ControlCenterManagement from './ControlCenterManagement'

type Row = Record<string, any>

// 소프트 대시보드 톤 — 차분한 회청색 바탕, 떠 있는 흰 카드, 인디고 네이비 포인트, 녹색은 긍정 수치
// style.css :root 변수와 같은 값을 쓴다
const theme = createTheme({
  palette: {
    primary: { main: '#232e6b', dark: '#171f4f', light: '#4a57a8', contrastText: '#ffffff' },
    secondary: { main: '#2fb872', dark: '#23945b' },
    success: { main: '#2fb872' },
    warning: { main: '#e8912d' },
    error: { main: '#e5484d' },
    info: { main: '#4a6cf7' },
    background: { default: '#eef1f6', paper: '#ffffff' },
    text: { primary: '#1d2033', secondary: '#6b7185', disabled: '#b3b8c6' },
    divider: '#e6e9f0'
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'Pretendard Variable', Pretendard, 'Segoe UI', 'Malgun Gothic', system-ui, sans-serif",
    fontSize: 13,
    h4: { fontWeight: 700 }, h5: { fontWeight: 700 }, h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 }
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 12, letterSpacing: '-.1px', transition: 'background-color .15s ease, box-shadow .15s ease, border-color .15s ease' },
        contained: ({ ownerState }) => ownerState.color === 'primary' ? {
          backgroundColor: '#232e6b', boxShadow: '0 6px 16px -6px rgba(35,46,107,.55)',
          '&:hover': { backgroundColor: '#1b255c', boxShadow: '0 8px 20px -6px rgba(35,46,107,.6)' },
          '&.Mui-disabled': { backgroundColor: '#e6e9f0', boxShadow: 'none', color: '#a3a9b8' }
        } : {},
        // 보조 버튼: 테두리 없는 흰 알약 + 옅은 그림자
        outlined: ({ ownerState }) => ownerState.color === 'primary'
          ? { backgroundColor: '#fff', borderColor: 'transparent', color: '#232e6b', boxShadow: '0 1px 2px rgba(35,46,107,.06), 0 0 0 1px #e6e9f0', '&:hover': { borderColor: 'transparent', backgroundColor: '#f5f7fb', boxShadow: '0 1px 2px rgba(35,46,107,.06), 0 0 0 1px #d8dde8' } }
          : { backgroundColor: '#fff' },
        text: ({ ownerState }) => ({ '&:hover': { backgroundColor: '#f0f2f8' }, ...(ownerState.color === 'primary' ? { color: '#232e6b' } : {}) })
      }
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 999 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    // 입력: 옅은 회청색 바탕, 포커스 시 흰 바탕 + 인디고 링
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12, backgroundColor: '#f5f7fb', transition: 'box-shadow .15s ease, background-color .15s ease',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e6e9f0' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d3d8e4' },
          '&.Mui-focused': { backgroundColor: '#fff', boxShadow: '0 0 0 4px rgba(35,46,107,.08)' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4a57a8', borderWidth: 1 },
          '&.Mui-disabled': { backgroundColor: '#f0f2f6' }
        }
      }
    },
    MuiInputLabel: { styleOverrides: { root: { color: '#7c8295', '&.Mui-focused': { color: '#232e6b' } } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 22, boxShadow: '0 30px 70px -20px rgba(29,32,51,.35)' } } },
    MuiBackdrop: { styleOverrides: { root: { '&:not(.MuiBackdrop-invisible)': { backgroundColor: 'rgba(29,36,71,.28)', backdropFilter: 'blur(4px)' } } } },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 14, boxShadow: '0 16px 40px -12px rgba(29,32,51,.25)' }, list: { padding: 6 } } },
    MuiMenuItem: { styleOverrides: { root: { borderRadius: 8, fontSize: 13.5, minHeight: 36, '&.Mui-selected': { backgroundColor: '#eef0fa' }, '&.Mui-selected:hover': { backgroundColor: '#e4e7f6' } } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: '#232e6b', height: 2, borderRadius: 2 } } },
    MuiTab: { styleOverrides: { root: { color: '#8a90a2', fontWeight: 500, '&.Mui-selected': { color: '#1d2033', fontWeight: 600 } } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: '#1d2447', fontSize: 12, fontWeight: 500, borderRadius: 8, padding: '6px 10px' }, arrow: { color: '#1d2447' } } },
    MuiPaginationItem: { styleOverrides: { root: { borderRadius: 8, '&.Mui-selected': { backgroundColor: '#232e6b', color: '#fff', '&:hover': { backgroundColor: '#1b255c' } } } } },
    MuiLinearProgress: { styleOverrides: { root: { backgroundColor: '#eef0f5' } } },
    MuiTextField: { defaultProps: { size: 'small' } }
  }
}, koKR, gridKoKR, {
  // 한국어 로케일도 'of'로 표시하므로 로케일 뒤에 덮어쓴다
  components: { MuiDataGrid: { defaultProps: { slotProps: { basePagination: { showFirstButton: true, showLastButton: true } } as object, localeText: { noRowsLabel: '표시할 항목이 없습니다', noResultsOverlayLabel: '검색 결과가 없습니다', paginationDisplayedRows: ({ from, to, count }: { from: number; to: number; count: number }) => `${from}–${to} / 전체 ${count}` } } } }
})

async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel, payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }
const statusText: Record<string, string> = { NORMAL: '정상', WATCH: '주의', INSPECTION: '점검', FAULT: '장애', OFFLINE: '중단', RECEIVED: '접수', TRIAGED: '분류', ASSIGNED: '배정', PLANNED: '계획', IN_PROGRESS: '진행', REMOTE_IN_PROGRESS:'원격조치',ON_SITE_IN_PROGRESS:'현장출동',RESOLVED: '조치완료', VERIFIED:'검증',CLOSED: '종결', ON_HOLD:'보류',CANCELED: '취소', BLOCKED: '보류', COMPLETED: '완료', URGENT: '긴급', GENERAL: '일반', NOTICE: '공지', HIGH: '높음' }
const label = (v: unknown) => statusText[String(v)] ?? String(v ?? '')
const roleText: Record<string, string> = { ADMIN: '관리자', OPERATOR: '운용요원', MAINTAINER: '정비요원', VIEWER: '조회전용', USER: '일반 사용자' }
const commonCols = (names: [string, string, number?][]): GridColDef[] => names.map(([field, headerName, width]) => {
  const badge = field === 'status' || field === 'severity'
  return {
    field, headerName, width: width ?? 140, flex: width ? undefined : 1,
    ...(badge
      ? { renderCell: ({ row }: { row: Row }) => <StatusChip code={row[field]} label={label(row[field])} /> }
      : field.endsWith('_at') ? { valueFormatter: (v: unknown) => fmtDateTime(v) }
      : field === 'progress' ? { valueFormatter: (v: unknown) => `${v ?? 0}%` }
      : { valueFormatter: (v: unknown) => String(v ?? '') })
  }
})

function Login({ onLogin }: { onLogin: (u: PublicUser) => void }) {
  const [username, setUsername] = useState('demo_admin'), [password, setPassword] = useState('Demo!2026'), [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false), [busy, setBusy] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false), [notice, setNotice] = useState('')
  // 접속 구분: 선택한 구분과 계정 권한이 다르면 로그인을 되돌린다 (관리자 = ADMIN, 사용자 = 그 외)
  const [mode, setMode] = useState<'admin' | 'user'>('admin')
  const modes: { value: 'admin' | 'user'; label: string; icon: SvgIconComponent; demoId: string }[] = [
    { value: 'admin', label: '관리자', icon: AdminPanelSettingsOutlined, demoId: 'demo_admin' },
    { value: 'user', label: '사용자', icon: PersonOutlineRounded, demoId: 'demo_user' }
  ]
  const pickMode = (m: typeof modes[number]) => { setMode(m.value); setUsername(m.demoId); setError(''); setNotice('') }
  // 등록 신청을 마치면 사용자 모드로 바꾸고 신청한 아이디를 채워 둔다
  const signupClosed = (id?: string) => { setSignupOpen(false); if (id) { setMode('user'); setUsername(id); setPassword(''); setError(''); setNotice('등록 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.') } }
  const submit = () => {
    setBusy(true); setError(''); setNotice('')
    call<PublicUser>('auth:login', { username, password })
      .then(u => (u.role === 'ADMIN') === (mode === 'admin') ? onLogin(u)
        : call('auth:logout').finally(() => setError(mode === 'admin' ? '관리자 권한이 없는 계정입니다. 사용자로 로그인하십시오.' : '관리자 계정입니다. 관리자로 로그인하십시오.')))
      .catch(x => setError(x.message)).finally(() => setBusy(false))
  }
  const features: [SvgIconComponent, string, string][] = [
    [HubRounded, '통합 관제', '체계별 운용 상태와 고장 접수를 한 화면에서'],
    [BuildRounded, '정비 일정 관리', '작업 진행률과 이력을 캘린더로 추적'],
    [SmartToyRounded, 'AI 분석 지원', '로컬 규칙 기반 분류와 유사 고장 조회']
  ]
  return <Box className="login">
    <Box className="login-hero">
      {/* 장식: 레이더 동심원 + 스윕 (정보통신·공군 모티프) */}
      <svg className="login-radar" viewBox="0 0 600 600" aria-hidden>
        <defs><linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8fa0ff" stopOpacity="0" /><stop offset="1" stopColor="#8fa0ff" stopOpacity=".35" /></linearGradient></defs>
        {[80, 150, 220, 290].map(r => <circle key={r} cx="300" cy="300" r={r} />)}
        <path d="M300 300 10 300M300 10 300 590" />
        <path className="login-radar-sweep" d="M300 300 L590 300 A290 290 0 0 0 505 95 Z" fill="url(#sweep)" stroke="none" />
      </svg>
      <Box className="login-brand"><span className="login-hero-mark"><BrandEmblem width={44} /></span><strong>OMNIS</strong></Box>
      <Box className="login-copy">
        <span className="login-eyebrow">Operations &amp; Maintenance Network Integrated System</span>
        <h1><span className="thin">정보통신 운용·정비를</span><br /><span className="strong">하나의 흐름으로.</span></h1>
        <p>체계 상태 감시부터 고장 접수, 정비 일정, 보고까지 — 부대 정보통신 업무를 하나의 화면에서 관리합니다.</p>
      </Box>
      <Box className="login-points">
        {features.map(([Icon, title, desc]) => <Box className="pt" key={title}><span><Icon /></span><Box><strong>{title}</strong><small>{desc}</small></Box></Box>)}
      </Box>
      <span className="login-foot">가상 시연 데이터 · 오프라인 환경 · OMNIS Desktop</span>
    </Box>
    <Box className="login-panel">
      <Box className="login-form" component="form" onSubmit={e => { e.preventDefault(); submit() }}>
        <span className="login-form-mark"><BrandEmblem width={40} /></span>
        <h2>로그인</h2>
        <p className="login-lead">정보통신 운용·정비 통합체계에 접속합니다.</p>
        <Box className="login-mode" role="radiogroup" aria-label="접속 구분">
          <span className="login-mode-thumb" style={{ transform: `translateX(${mode === 'admin' ? 0 : 100}%)` }} aria-hidden />
          {modes.map(m => <button type="button" role="radio" aria-checked={mode === m.value} key={m.value} className={mode === m.value ? 'on' : ''} onClick={() => pickMode(m)}>
            <m.icon />{m.label}
          </button>)}
        </Box>
        <label className="login-label" htmlFor="login-id">아이디</label>
        <TextField id="login-id" fullWidth size="medium" placeholder="아이디 입력" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username"
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonOutlineRounded /></InputAdornment> } }} />
        <label className="login-label" htmlFor="login-pw">비밀번호</label>
        <TextField id="login-pw" fullWidth size="medium" placeholder="비밀번호 입력" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
          slotProps={{ input: {
            startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment>,
            endAdornment: <InputAdornment position="end"><IconButton size="small" aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={() => setShowPw(v => !v)}>{showPw ? <VisibilityOffOutlined /> : <VisibilityOutlined />}</IconButton></InputAdornment>
          } }} />
        {error && <Typography className="login-error" role="alert">{error}</Typography>}
        {notice && !error && <Typography className="login-notice" role="status">{notice}</Typography>}
        <Button type="submit" variant="contained" size="large" fullWidth disabled={busy || !username || !password} endIcon={<ArrowForwardRounded />} className="login-submit">{busy ? '확인 중…' : `${mode === 'admin' ? '관리자' : '사용자'} 로그인`}</Button>
        <Box className="login-signup">처음 이용하시나요?<button type="button" onClick={() => setSignupOpen(true)}>사용자 등록 신청</button></Box>
        <p className="login-legal"><ShieldOutlined />인가된 사용자만 접속할 수 있으며, 접속 기록은 보안 감사를 위해 저장됩니다.</p>
      </Box>
    </Box>
    <SignupDialog open={signupOpen} onClose={signupClosed} />
  </Box>
}

type NavItem = { to: string; text: string; icon: SvgIconComponent; adminOnly?: boolean }
const dashboardNav: NavItem = { to: '/', text: '통합상황판', icon: DashboardRounded }
const navGroups: { title: string; to: string; items: NavItem[] }[] = [
  { title: '운용 현황', to: '/operations', items: [{ to: '/operations', text: '운영현황', icon: DnsRounded }, { to: '/incidents', text: '고장관리', icon: ReportProblemRounded }, { to: '/maintenance', text: '정비관리', icon: BuildRounded }, { to: '/control', text: '통제·일일마감', icon: FactCheckRounded }] },
  { title: '업무 지원', to: '/duty', items: [{ to: '/duty', text: '근무/지시사항', icon: EventNoteRounded }, { to: '/ai', text: 'AI 지원', icon: SmartToyRounded }, { to: '/reports', text: '보고서/통계', icon: AssessmentRounded }] },
  { title: '관리', to: '/settings', items: [{ to: '/admin', text: '관리자센터', icon: HowToRegRounded, adminOnly: true }, { to: '/settings', text: '시스템관리', icon: SettingsRounded, adminOnly: true }] }
]

function Shell({ user, onLogout, onUserChanged }: { user: PublicUser; onLogout: () => void; onUserChanged:(user:PublicUser)=>void }) {
  const [passwordOpen,setPasswordOpen]=useState(false)
  const [now, setNow] = useState(() => new Date())
  const [urgent, setUrgent] = useState(0), [pending, setPending] = useState(0)
  const location = useLocation()
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  // 메뉴 뱃지: 미종결 긴급 고장 수 (화면 이동 때마다 갱신)
  useEffect(() => { call<Row>('dashboard:getSummary').then(d => setUrgent(Number(d.urgentCount) || 0)).catch(() => {}) }, [location.pathname])
  // 관리자 메뉴 뱃지: 승인 대기 중인 사용자 등록 신청 수
  const loadPending = () => { if (user.role === 'ADMIN') call<Row[]>('admin:signupRequests').then(r => setPending(r.filter(x => x.status === 'PENDING').length)).catch(() => {}) }
  useEffect(loadPending, [location.pathname])
  const admin = user.role === 'ADMIN'
  const groups = navGroups.map(g => ({ ...g, items: g.items.filter(i => admin || !i.adminOnly) })).filter(g => g.items.length)
  const current = location.pathname==='/admin'?{text:'관리자센터',group:'관리',groupTo:'/admin'}:location.pathname==='/manuals'?{text:'사용자 매뉴얼',group:null,groupTo:null}:location.pathname === dashboardNav.to ? { ...dashboardNav, group:null, groupTo:null } : navGroups.flatMap(g => g.items.map(i => ({ ...i, group:g.title, groupTo:g.to }))).find(i => i.to === location.pathname)
  return <Box className="app">
    <aside className="sidebar">
      <Box className="sb-brand">
        <span className="brand-mark"><BrandEmblem /></span>
        <Box><strong>OMNIS</strong><span>정보통신 운용·정비 통합체계</span></Box>
      </Box>
      <nav className="sb-nav" aria-label="주 메뉴">
        <Box className="sb-standalone"><NavLink to={dashboardNav.to} end><DashboardRounded /><span>{dashboardNav.text}</span></NavLink></Box>
        {groups.map(g => <Box key={g.title} className="sb-group">
          <span className="sb-group-title">{g.title}</span>
          {g.items.map(({ to, text, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}>
            <Icon /><span>{text}</span>{to === '/incidents' && urgent > 0 && <b className="sb-badge" aria-hidden>{urgent}</b>}{to === '/admin' && pending > 0 && <b className="sb-badge info" aria-hidden>{pending}</b>}
          </NavLink>)}
        </Box>)}
      </nav>
      <Box className="sb-foot">
        <NavLink to="/manuals" className="sb-manual-link"><MenuBookRounded/><span>사용자 매뉴얼</span></NavLink>
        <Box className="sb-user">
          <Avatar name={user.display_name} size={36} />
          <Box sx={{ minWidth: 0, flex: 1 }}><strong>{user.display_name}</strong><span>{user.rank_name ? `${user.rank_name} · ` : ''}{roleText[user.role] ?? user.role}</span></Box>
          <Tooltip title="비밀번호 변경"><IconButton size="small" aria-label="비밀번호 변경" onClick={()=>setPasswordOpen(true)}><LockResetRounded fontSize="small"/></IconButton></Tooltip>
          <Tooltip title="로그아웃"><IconButton size="small" aria-label="로그아웃" onClick={() => call('auth:logout').then(onLogout)}><LogoutRounded fontSize="small" /></IconButton></Tooltip>
        </Box>
      </Box>
    </aside>
    <Box className="workspace">
      <header className="topbar">
        <Box className="crumbs">{current?.group&&current.groupTo?<><NavLink to={current.groupTo}>{current.group}</NavLink><ChevronRightRounded /></>:null}<strong>{current?.text ?? 'OMNIS'}</strong></Box>
        <Box className="topbar-right">
          <span className="pill-offline"><CloudOffRounded />오프라인 · 가상 시연 데이터</span>
          <span className="clock"><AccessTimeRounded />{now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
        </Box>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/operations" element={<Operations user={user} />} />
          <Route path="/incidents" element={<Incidents user={user} />} />
          <Route path="/maintenance" element={<Maintenance user={user} />} />
          <Route path="/control" element={<ControlCenterManagement user={user} />} />
          <Route path="/duty" element={<Duty user={user} />} />
          <Route path="/ai" element={<Ai />} />
          <Route path="/manuals" element={<ManualsManagement user={user}/>} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/signups" element={admin ? <SignupRequests onChange={loadPending} /> : <Navigate to="/" replace />} />
          <Route path="/admin" element={admin ? <AdminCenter user={user}/> : <Navigate to="/" replace/>}/>
          <Route path="/settings" element={admin ? <Settings user={user} /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </Box>
    <PasswordChange open={passwordOpen} onClose={()=>setPasswordOpen(false)} onChanged={onUserChanged}/>
  </Box>
}

const severityTone = (v: unknown) => v === 'URGENT' ? 'red' : 'gray'
const severityText = (v: unknown) => v === 'URGENT' ? '긴급' : '일반'
const chipCol = (field: string, headerName: string, width: number, tone?: (v: unknown) => Tone, text: (v: unknown) => string = label): GridColDef => ({ field, headerName, width, renderCell: ({ row }) => <StatusChip code={row[field]} label={text(row[field])} tone={tone?.(row[field])} /> })

// 상황판 목록 행 높이(px) — style.css의 .dash 규칙과 맞춘다
const GRID_ROW = 36, GRID_HEAD = 36, NOTICE_ROW = 42

function Dashboard({ user }: { user: PublicUser }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState<Row | null>(null)
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [list, setList] = useState<ListTarget | null>(null)
  const [loadedAt, setLoadedAt] = useState('')
  const open = (kind: DetailTarget['kind']) => ({ row }: { row: Row }) => setDetail({ kind, row })
  const load = () => call<Row>('dashboard:getSummary').then(d => { setData(d); setLoadedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })) })
  useEffect(() => { load() }, [])
  if(new URLSearchParams(location.search).get('view')==='mine')return <MyWork user={user}/>
  if (!data) return <Typography color="text.secondary">불러오는 중...</Typography>
  const sys = countBy(data.allSystems, 'status')
  const ms: Record<string, number> = Object.fromEntries(data.maintenanceStatus.map((r: Row) => [r.status, r.n]))
  const normalRate = data.systemCount ? Math.round(data.normalCount / data.systemCount * 100) : 0
  const systemCols = commonCols([['code', '체계코드', 110], ['name', '체계명'], ['category', '구분', 110], ['status', '상태', 90], ['uptime_pct', '운용률', 90], ['today_incident_count', '금일 고장', 90]])
  const viewAll = (to: string) => <Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => navigate(to)}>전체 보기</Button>
  const metrics: { key: string; value: number; unit: string; icon: SvgIconComponent; tone: Tone; foot: React.ReactNode; list: ListTarget }[] = [
    { key: '전체 체계', value: data.systemCount, unit: '개', icon: HubRounded, tone: 'sky', foot: <>정상 {sys.NORMAL ?? 0} · 주의 {sys.WATCH ?? 0} · 점검 {sys.INSPECTION ?? 0} · 장애 {sys.FAULT ?? 0}</>, list: { title: '전체 체계', kind: 'system', rows: data.allSystems, columns: systemCols } },
    { key: '정상 운용', value: data.normalCount, unit: '개', icon: CheckCircleRounded, tone: 'green', foot: <Box className="metric-meter"><span>정상 운용률</span><Meter value={normalRate} tone="green" /></Box>, list: { title: '정상 운용 체계', kind: 'system', rows: data.allSystems.filter((r: Row) => r.status === 'NORMAL'), columns: systemCols } },
    { key: '긴급 장애', value: data.urgentCount, unit: '건', icon: ReportRounded, tone: 'red', foot: <>미종결 고장 {data.incidentCount}건 중 긴급</>, list: { title: '긴급 장애 (미종결)', kind: 'incident', rows: data.urgentIncidents, columns: commonCols([['ticket_no', '접수번호', 150], ['title', '제목'], ['system_name', '체계', 120], ['status', '상태', 90], ['reported_at', '접수일시', 150]]) } },
    { key: '진행 중 정비', value: data.maintenanceCount, unit: '건', icon: BuildRounded, tone: 'orange', foot: <>진행 {ms.IN_PROGRESS ?? 0} · 예정 {ms.PLANNED ?? 0} · 보류 {ms.BLOCKED ?? 0}</>, list: { title: '예정·진행 중 정비', kind: 'maintenance', rows: data.openMaintenance, columns: commonCols([['task_no', '작업번호', 150], ['title', '작업명'], ['status', '상태', 85], ['assignee_name', '담당자', 90], ['scheduled_date', '예정일', 105], ['progress', '진행률', 80]]) } }
  ]
  // 표 행 높이 고정 → Paged가 화면 높이에 맞춰 페이지 크기를 계산
  const grid = { rowHeight: GRID_ROW, columnHeaderHeight: GRID_HEAD, hideFooter: true, autoHeight: true, disableColumnMenu: true } as const
  return <div className="dash">
    <PageHeader section="운용 현황" title="통합상황판" description={`${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} 기준 정보통신 운용 현황입니다.`}
      actions={<><Button variant="outlined" onClick={()=>navigate('/?view=mine')}>내 업무</Button><span className="ui-updated">{loadedAt} 갱신</span><Button variant="outlined" startIcon={<RefreshRounded />} onClick={load}>새로고침</Button></>} />
    <div className="metrics">{metrics.map(({ key, value, unit, icon: Icon, tone, foot, list }) => <Paper elevation={0} className={`metric clickable`} key={key} role="button" tabIndex={0} aria-label={`${key} ${value}${unit} 목록 보기`}
      onClick={() => setList(list)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setList(list) } }}>
      <Box className="metric-top"><span className="metric-label">{key}</span><span className={`ui-icon-tile tone-${tone}`}><Icon /></span></Box>
      <Box className="metric-value">{value}<small>{unit}</small></Box>
      <Box className="metric-foot">{foot}</Box>
    </Paper>)}</div>
    <Paper elevation={0} className="dashboard-control-band" role="button" tabIndex={0} onClick={() => navigate('/control')} onKeyDown={e => { if (e.key === 'Enter') navigate('/control') }}>
      <Box><span>금일 접수</span><strong>{data.todayReceived}<small>건</small></strong></Box>
      <Box><span>금일 조치완료</span><strong>{data.todayCompleted}<small>건</small></strong></Box>
      <Box className={data.openAlertCount ? 'warn' : ''}><span>미종료 상황경보</span><strong>{data.openAlertCount}<small>건</small></strong></Box>
      <Box className={data.slaOverdueCount ? 'danger' : ''}><span>SLA 초과</span><strong>{data.slaOverdueCount}<small>건</small></strong></Box>
      <Box><span>계획 / 비계획</span><strong>{data.plannedCount}<small> / {data.unplannedCount}건</small></strong></Box>
      <Box><span>금일 근무</span><strong>{data.dutyCount}<small>명</small></strong></Box>
      <Button size="small" endIcon={<ArrowForwardRounded />}>통제 화면</Button>
    </Paper>
    <div className="dashboard-grid">
      <Card icon={DnsRounded} tone="sky" title="정보통신 운영 현황" subtitle={`전체 ${data.systemCount}개 체계`} action={viewAll('/operations')}>
        <Paged rows={data.allSystems as Row[]} rowHeight={GRID_ROW} reserved={GRID_HEAD + 2} unit="개">{rows =>
          <DataGrid {...grid} className="clickable-grid" rows={rows} onRowClick={open('system')} columns={[
            { field: 'name', headerName: '체계명', flex: 1, renderCell: ({ row }) => <span className="cell-strong">{row.name}</span> }, chipCol('status', '상태', 90),
            { field: 'uptime_pct', headerName: '운용률', width: 150, renderCell: ({ row }) => <Meter value={row.uptime_pct} tone={row.uptime_pct >= 97 ? 'green' : 'sky'} /> }]} />}
        </Paged>
      </Card>
      <Card icon={BuildRounded} tone="orange" title="정비작업 진행 현황" subtitle={`예정·진행 ${data.maintenanceCount}건`} action={viewAll('/maintenance')}>
        <MaintenanceProgress status={data.maintenanceStatus} active={data.openMaintenance} onSelect={row => setDetail({ kind: 'maintenance', row })} />
      </Card>
      <Card icon={ReportProblemRounded} tone="red" title="최근 고장 접수" subtitle={`최근 ${data.recentIncidents.length}건`} action={viewAll('/incidents')}>
        <Paged rows={data.recentIncidents as Row[]} rowHeight={GRID_ROW} reserved={GRID_HEAD + 2}>{rows =>
          <DataGrid {...grid} className="clickable-grid" rows={rows} onRowClick={open('incident')} columns={[
            { field: 'ticket_no', headerName: '접수번호', width: 150, renderCell: ({ row }) => <span className="cell-code">{row.ticket_no}</span> },
            { field: 'title', headerName: '제목', flex: 1, renderCell: ({ row }) => <span className="cell-strong">{row.title}</span> },
            chipCol('severity', '중요도', 80, severityTone, severityText), chipCol('status', '상태', 90)]} />}
        </Paged>
      </Card>
      <Card icon={CampaignRounded} tone="lavender" title="지시사항 / 공지" subtitle={`고정 공지 우선 · 최근 ${data.directives.length}건`} action={viewAll('/duty')}>
        <Paged rows={data.directives as Row[]} rowHeight={NOTICE_ROW}>{rows =>
          rows.map(r => <Box component="button" type="button" className="notice clickable" key={r.id} onClick={() => setDetail({ kind: 'directive', row: r })}>
            <StatusChip code={r.level} label={label(r.level)} /><span>{r.title}</span>{r.pinned ? <PushPinRounded className="notice-pin" aria-label="고정" /> : null}<small>{String(r.issued_at).slice(0, 10)}</small>
          </Box>)}
        </Paged>
      </Card>
    </div>
    <MetricListDialog target={list} onSelect={setDetail} onClose={() => setList(null)} />
    <DashboardDetail target={detail} label={label} onClose={() => setDetail(null)} />
  </div>
}

function Operations({ user }: { user: PublicUser }) { return <OperationsManagement user={user} /> }
function Incidents({ user }: { user: PublicUser }) { return <IncidentsManagement user={user} /> }
function Maintenance({ user }: { user: PublicUser }) { return <MaintenanceManagement user={user} /> }
function Duty({ user }: { user: PublicUser }) { return <DutyManagement user={user} /> }
function Ai() { return <AiManagement /> }
function Reports() { return <ReportsManagement /> }
function Settings({ user }: { user: PublicUser }) { return <SystemManagement user={user} /> }
export default function App() {
  const [user,setUser]=useState<PublicUser|null>(null),[ready,setReady]=useState(false),[authNotice,setAuthNotice]=useState('')
  useEffect(()=>{
    let active=true
    const sync=()=>call<PublicUser|null>('auth:me').then(value=>{if(active)setUser(value)}).catch(()=>{if(active)setUser(null)}).finally(()=>{if(active)setReady(true)})
    void sync()
    const reset=()=>setUser(null)
    const stop=window.omnis.onAuthState(code=>{if(code==='AUTH_PASSWORD_CHANGE_REQUIRED')void sync();else {setUser(null);setAuthNotice('계정 상태 또는 권한이 변경되었습니다. 다시 로그인하십시오.')}})
    const timer=setInterval(sync,15000)
    window.addEventListener('omnis:reset',reset);window.addEventListener('focus',sync)
    return()=>{active=false;stop();clearInterval(timer);window.removeEventListener('omnis:reset',reset);window.removeEventListener('focus',sync)}
  },[])
  const logout=()=>call('auth:logout').finally(()=>setUser(null))
  return <ThemeProvider theme={theme}><HashRouter>{ready&&(user?(user.must_change_password?<PasswordChange open forced onClose={()=>{}} onChanged={setUser} onLogout={logout}/>:<Shell user={user} onLogout={()=>setUser(null)} onUserChanged={setUser}/>):<>{authNotice&&<Box className="auth-notice" role="status">{authNotice}</Box>}<Login onLogin={value=>{setUser(value);setAuthNotice('')}}/></>)}</HashRouter></ThemeProvider>
}
