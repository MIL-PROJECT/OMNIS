import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material'
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined'
import type { PublicUser } from '../../shared/contracts'
import type { AdminSummary } from '../../shared/admin'
import { useAdminQuery } from './adminApi'
import { Card, PageHeader, fmtDateTime } from './ui'
import UserManagement from './UserManagement'
import AdminSecurity from './AdminSecurity'
import AdminAudit, { auditAction } from './AdminAudit'
import SignupRequests from './SignupRequests'
import SystemManagement from './SystemManagement'
import ActionDepartmentManagement from './ActionDepartmentManagement'
import OrganizationMembers from './OrganizationMembers'
import TemplateManagement from './TemplateManagement'
const sections = [
  ['overview', '관리 현황'],
  ['users', '사용자 관리'],
  ['signups', '등록 승인'],
  ['security', '역할·접속 보안'],
  ['audit', '감사 기록'],
  ['organization', '조직·업무 설정'],
  ['system', '시스템·데이터']
]
function Overview({
  navigate
}: {
  navigate: (section: string, state?: string, kind?: string) => void
}) {
  const summary = useAdminQuery('admin:summary'),
    recent = useAdminQuery('admin:audit', { page: 0, pageSize: 5 })
  const cards: [keyof AdminSummary, string, string, string?, string?][] = [
    ['loginAccounts', '로그인 계정', 'users'],
    ['pending', '승인 대기', 'signups'],
    ['manualLocked', '수동 잠금', 'users', 'MANUAL_LOCK'],
    ['autoLocked', '자동 잠금', 'users', 'AUTO_LOCK'],
    ['inactive', '사용 중지', 'users', 'INACTIVE'],
    ['passwordChange', '비밀번호 변경 필요', 'users', 'PASSWORD_CHANGE'],
    ['contacts', '가상 담당자', 'users', 'ALL', 'CONTACT']
  ]
  return (
    <Stack spacing={2}>
      {summary.error && (
        <Alert
          severity="error"
          action={<Button onClick={summary.reload}>재시도</Button>}
        >
          {summary.error}
        </Alert>
      )}
      <Box className="admin-summary-grid">
        {cards.map(([key, title, section, state, kind]) => (
          <button
            className="admin-summary-card"
            key={key}
            onClick={() => navigate(section, state, kind)}
          >
            <span>{title}</span>
            <strong>
              {summary.data ? summary.data[key] : '—'}
              <small>명</small>
            </strong>
            <span>
              {key === 'contacts'
                ? '로그인 불가 · 업무 배정용 연락처'
                : '목록 확인 →'}
            </span>
          </button>
        ))}
      </Box>
      <Card
        icon={AdminPanelSettingsOutlined}
        title="최근 관리자·접속 이력"
        subtitle="현재 설치 환경의 인증 및 변경 기록"
        action={<Button onClick={() => navigate('audit')}>전체 기록</Button>}
      >
        {recent.error && (
          <Alert
            severity="error"
            action={<Button onClick={recent.reload}>재시도</Button>}
          >
            {recent.error}
          </Alert>
        )}
        <Box className="admin-recent">
          {recent.loading && !recent.data ? (
            <Typography>불러오는 중…</Typography>
          ) : recent.data?.rows.length ? (
            recent.data.rows.map((row) => (
              <Box key={row.id}>
                <span>
                  <strong>{auditAction(row.action)}</strong>
                  <small>
                    {row.actor_name || '로그인 전'} ·{' '}
                    {row.target_name || row.entity_id} ·{' '}
                    {row.result === 'FAILURE' ? '실패' : '성공'}
                  </small>
                </span>
                <time>{fmtDateTime(row.created_at)}</time>
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">기록이 없습니다.</Typography>
          )}
        </Box>
      </Card>
    </Stack>
  )
}
function OrganizationSettings() {
  const [tab, setTab] = useState(0)
  return (
    <Stack spacing={2}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        aria-label="조직·업무 설정 구분"
      >
        <Tab label="조치부서·담당자" />
        <Tab label="업무 템플릿" />
      </Tabs>
      {tab === 0 ? (
        <>
          <ActionDepartmentManagement />
          <OrganizationMembers />
        </>
      ) : (
        <TemplateManagement />
      )}
    </Stack>
  )
}
export default function AdminCenter({ user }: { user: PublicUser }) {
  const [params, setParams] = useSearchParams(),
    section = sections.some(([v]) => v === params.get('section'))
      ? params.get('section')!
      : 'overview'
  const navigate = (next: string, state = 'ALL', kind = 'LOGIN') =>
    setParams({ section: next, ...(next === 'users' ? { state, kind } : {}) })
  return (
    <>
      <PageHeader
        section="관리"
        title="관리자센터"
        description="사용자 계정과 접속 보안, 변경 이력, 조직·시스템 설정을 한곳에서 관리합니다."
      />
      <Box className="admin-center-nav">
        <Tabs
          value={section}
          onChange={(_, v) => navigate(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="관리자센터 메뉴"
        >
          {sections.map(([v, title]) => (
            <Tab key={v} value={v} label={title} />
          ))}
        </Tabs>
      </Box>
      <Box className="admin-center-content">
        {section === 'overview' && <Overview navigate={navigate} />}{' '}
        {section === 'users' && (
          <UserManagement
            actor={user}
            initialState={params.get('state') ?? 'ALL'}
            initialKind={params.get('kind') ?? 'LOGIN'}
          />
        )}{' '}
        {section === 'signups' && <SignupRequests embedded />}{' '}
        {section === 'security' && <AdminSecurity />}{' '}
        {section === 'audit' && <AdminAudit />}{' '}
        {section === 'organization' && <OrganizationSettings />}{' '}
        {section === 'system' && <SystemManagement user={user} embedded />}
      </Box>
    </>
  )
}
