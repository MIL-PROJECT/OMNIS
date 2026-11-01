import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import ManageAccountsRounded from '@mui/icons-material/ManageAccountsRounded'
import type { AdminUser } from '../../shared/admin'
import { roleNames } from '../../shared/admin'
import type { PublicUser, Role } from '../../shared/contracts'
import { adminCall, useAdminQuery } from './adminApi'
import { Card, fmtDateTime, fmtShort } from './ui'
import StatusChip from './StatusChip'
import AdminAudit from './AdminAudit'
const actionNames = {
  PROFILE: '정보 저장',
  ROLE: '권한 변경',
  LOCK: '수동 잠금',
  UNLOCK: '수동 잠금 해제',
  DISABLE: '사용 중지',
  ENABLE: '재활성화',
  CLEAR_AUTO_LOCK: '자동 잠금 해제',
  RESET_PASSWORD: '비밀번호 초기화'
}
type Action = keyof typeof actionNames
const locked = (u: AdminUser) =>
  !!u.lock_until && u.lock_until > new Date().toISOString()
function State({
  user: u,
  compact = false
}: {
  user: AdminUser
  compact?: boolean
}) {
  if (u.account_kind === 'CONTACT')
    return <StatusChip code="CONTACT" label="연락처" tone="gray" />
  const states: {
    text: string
    tone: 'gray' | 'red' | 'orange' | 'lavender' | 'green'
  }[] = []
  if (!u.active) states.push({ text: '중지', tone: 'gray' })
  if (u.manual_locked) states.push({ text: '수동 잠금', tone: 'red' })
  if (locked(u)) states.push({ text: '자동 잠금', tone: 'orange' })
  if (u.must_change_password)
    states.push({ text: '변경 필요', tone: 'lavender' })
  if (!states.length) states.push({ text: '정상', tone: 'green' })
  return (
    <Box
      className="admin-state-list"
      title={states.map((s) => s.text).join(' · ')}
    >
      {(compact ? states.slice(0, 1) : states).map((s) => (
        <StatusChip key={s.text} code={s.text} label={s.text} tone={s.tone} />
      ))}
      {compact && states.length > 1 && <small>+{states.length - 1}</small>}
    </Box>
  )
}

export default function UserManagement({
  actor,
  initialState = 'ALL',
  initialKind = 'LOGIN',
  onChanged
}: {
  actor: PublicUser
  initialState?: string
  initialKind?: string
  onChanged?: () => void
}) {
  const [search, setSearch] = useState(''),
    [role, setRole] = useState(''),
    [state, setState] = useState(initialState),
    [kind, setKind] = useState(initialKind),
    [paging, setPaging] = useState({ page: 0, pageSize: 10 }),
    [sort, setSort] = useState({ sort: 'display_name', direction: 'asc' })
  const list = useAdminQuery('admin:users', {
    search,
    role: role || undefined,
    state,
    kind,
    ...paging,
    ...sort
  })
  const [selected, setSelected] = useState<AdminUser | null>(null),
    [action, setAction] = useState<Action | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [password, setPassword] = useState(''),
    [temporary, setTemporary] = useState(''),
    [history, setHistory] = useState(false)
  const [form, setForm] = useState({
    displayName: '',
    rankName: '',
    unitName: '',
    serviceNo: '',
    role: 'USER' as Role
  })
  useEffect(() => {
    setState(initialState)
    setKind(initialKind)
    setPaging((p) => ({ ...p, page: 0 }))
  }, [initialState, initialKind])
  const resetPage = () => setPaging((p) => ({ ...p, page: 0 }))
  const open = async (u: AdminUser) => {
    setError('')
    try {
      const fresh = await adminCall('admin:user', { id: u.id })
      setSelected(fresh)
      setForm({
        displayName: fresh.display_name,
        rankName: fresh.rank_name ?? '',
        unitName: fresh.unit_name ?? '',
        serviceNo: fresh.service_no ?? '',
        role: fresh.role
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const begin = (a: Action) => {
    setError('')
    setReason('')
    setPassword('')
    setAction(a)
  }
  const mutate = async () => {
    if (!selected || !action || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await adminCall('admin:mutateUser', {
        id: selected.id,
        expectedVersion: selected.version,
        action,
        reason,
        adminPassword: password,
        ...form
      })
      setSelected(result.user)
      setPassword('')
      setAction(null)
      if (result.temporaryPassword) setTemporary(result.temporaryPassword)
      setNotice(`${actionNames[action]} 완료`)
      list.reload()
      onChanged?.()
    } catch (e) {
      setError((e as Error).message)
      if ((e as { code?: string }).code === 'CONFLICT') {
        try {
          const fresh = await adminCall('admin:user', { id: selected.id })
          setSelected(fresh)
          setForm({
            displayName: fresh.display_name,
            rankName: fresh.rank_name ?? '',
            unitName: fresh.unit_name ?? '',
            serviceNo: fresh.service_no ?? '',
            role: fresh.role
          })
        } catch {
          list.reload()
        }
      }
    } finally {
      setBusy(false)
    }
  }
  const columns: GridColDef[] = [
    {
      field: 'display_name',
      headerName: '이름',
      width: 86,
      renderCell: ({ row }) => (
        <span className="admin-ellipsis" title={row.display_name}>
          {row.display_name}
        </span>
      )
    },
    {
      field: 'username',
      headerName: '아이디',
      flex: 1,
      minWidth: 110,
      renderCell: ({ row }) => (
        <span className="admin-ellipsis" title={row.username}>
          {row.username}
        </span>
      )
    },
    {
      field: 'unit_name',
      headerName: '소속',
      flex: 1.3,
      minWidth: 115,
      renderCell: ({ row }) => (
        <span className="admin-ellipsis" title={row.unit_name}>
          {row.unit_name || '-'}
        </span>
      )
    },
    {
      field: 'role',
      headerName: '권한',
      width: 88,
      valueFormatter: (v) => roleNames[v as Role]
    },
    {
      field: 'state',
      headerName: '계정 상태',
      width: 130,
      sortable: false,
      renderCell: ({ row }) => <State user={row} compact />
    },
    {
      field: 'last_login_at',
      headerName: '최근 로그인',
      width: 120,
      renderCell: ({ row }) => (
        <span
          className="admin-ellipsis"
          title={
            row.last_login_at ? fmtDateTime(row.last_login_at) : '기록 없음'
          }
        >
          {row.last_login_at ? fmtShort(row.last_login_at) : '기록 없음'}
        </span>
      )
    },
    {
      field: 'actions',
      headerName: '관리',
      width: 66,
      sortable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => (
        <Button size="small" onClick={() => open(row)}>
          상세
        </Button>
      )
    }
  ]
  return (
    <>
      <Card
        icon={ManageAccountsRounded}
        title="사용자 관리"
        subtitle={
          kind === 'LOGIN'
            ? '로그인 계정 · 잠금과 사용 중지는 별도로 관리합니다.'
            : '가상 담당자 · 로그인할 수 없는 업무 배정용 연락처입니다.'
        }
        action={<Button onClick={list.reload}>새로고침</Button>}
      >
        <Box className="admin-filters">
          <TextField
            label="이름·아이디·군번·소속 검색"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPage()
            }}
          />
          <TextField
            select
            label="계정 종류"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value)
              resetPage()
            }}
          >
            <MenuItem value="LOGIN">로그인 계정</MenuItem>
            <MenuItem value="CONTACT">가상 담당자</MenuItem>
          </TextField>
          <TextField
            select
            label="권한"
            value={role}
            onChange={(e) => {
              setRole(e.target.value)
              resetPage()
            }}
          >
            <MenuItem value="">전체</MenuItem>
            {Object.entries(roleNames).map(([v, t]) => (
              <MenuItem key={v} value={v}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="계정 상태"
            value={state}
            onChange={(e) => {
              setState(e.target.value)
              resetPage()
            }}
          >
            {[
              ['ALL', '전체'],
              ['ACTIVE', '사용 가능'],
              ['MANUAL_LOCK', '수동 잠금'],
              ['AUTO_LOCK', '자동 잠금'],
              ['INACTIVE', '사용 중지'],
              ['PASSWORD_CHANGE', '비밀번호 변경 필요']
            ].map(([v, t]) => (
              <MenuItem key={v} value={v}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        {(list.error || error) && !selected && (
          <Alert
            severity="error"
            action={<Button onClick={list.reload}>재시도</Button>}
          >
            {list.error || error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" onClose={() => setNotice('')}>
            {notice}
          </Alert>
        )}
        <DataGrid
          className="admin-grid"
          rows={list.data?.rows ?? []}
          columns={columns}
          rowHeight={40}
          columnHeaderHeight={40}
          loading={list.loading}
          rowCount={list.data?.total ?? 0}
          paginationMode="server"
          paginationModel={paging}
          onPaginationModelChange={setPaging}
          sortingMode="server"
          onSortModelChange={(m) => {
            setSort({
              sort: m[0]?.field ?? 'display_name',
              direction: m[0]?.sort ?? 'asc'
            })
            resetPage()
          }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: '조건에 맞는 사용자가 없습니다' }}
        />
      </Card>
      <Dialog
        open={!!selected}
        onClose={
          busy
            ? undefined
            : () => {
                setSelected(null)
                setError('')
              }
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>사용자 상세 · {selected?.display_name}</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <Box className="admin-user-identity">
                <strong>{selected.username}</strong>
                <State user={selected} />
              </Box>
              <dl className="admin-detail-list">
                <div>
                  <dt>계정 종류</dt>
                  <dd>
                    {selected.account_kind === 'LOGIN'
                      ? '로그인 계정'
                      : '가상 담당자 (로그인 불가)'}
                  </dd>
                </div>
                <div>
                  <dt>최근 로그인</dt>
                  <dd>
                    {selected.last_login_at
                      ? fmtDateTime(selected.last_login_at)
                      : '기록 없음'}
                  </dd>
                </div>
                <div>
                  <dt>로그인 실패</dt>
                  <dd>{selected.failed_attempts}회</dd>
                </div>
                <div>
                  <dt>자동 잠금 해제</dt>
                  <dd>
                    {locked(selected)
                      ? fmtDateTime(selected.lock_until)
                      : '잠금 없음'}
                  </dd>
                </div>
              </dl>
              <TextField
                label="이름"
                value={form.displayName}
                disabled={selected.account_kind === 'CONTACT'}
                onChange={(e) =>
                  setForm((p) => ({ ...p, displayName: e.target.value }))
                }
              />
              <Stack direction="row" spacing={1.5}>
                <TextField
                  fullWidth
                  label="계급"
                  value={form.rankName}
                  disabled={selected.account_kind === 'CONTACT'}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, rankName: e.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  label="군번"
                  value={form.serviceNo}
                  disabled={selected.account_kind === 'CONTACT'}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, serviceNo: e.target.value }))
                  }
                />
              </Stack>
              <TextField
                label="소속 부대"
                value={form.unitName}
                disabled={selected.account_kind === 'CONTACT'}
                onChange={(e) =>
                  setForm((p) => ({ ...p, unitName: e.target.value }))
                }
              />
              <TextField
                select
                label="역할"
                value={form.role}
                disabled={
                  selected.account_kind === 'CONTACT' ||
                  selected.id === actor.id
                }
                onChange={(e) =>
                  setForm((p) => ({ ...p, role: e.target.value as Role }))
                }
              >
                {Object.entries(roleNames).map(([v, t]) => (
                  <MenuItem key={v} value={v}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              {selected.account_kind === 'CONTACT' ? (
                <Alert severity="info">
                  가상 담당자는 업무 배정용 연락처입니다. 로그인 계정으로
                  전환하거나 비밀번호를 발급할 수 없습니다.
                </Alert>
              ) : (
                <>
                  <Box className="admin-user-actions">
                    <Button variant="outlined" onClick={() => begin('PROFILE')}>
                      정보 저장
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={
                        selected.id === actor.id || form.role === selected.role
                      }
                      onClick={() => begin('ROLE')}
                    >
                      권한 변경
                    </Button>
                    <Button
                      color={selected.manual_locked ? 'primary' : 'error'}
                      disabled={selected.id === actor.id}
                      onClick={() =>
                        begin(selected.manual_locked ? 'UNLOCK' : 'LOCK')
                      }
                    >
                      {selected.manual_locked ? '수동 잠금 해제' : '수동 잠금'}
                    </Button>
                    <Button
                      color={selected.active ? 'error' : 'primary'}
                      disabled={selected.id === actor.id}
                      onClick={() =>
                        begin(selected.active ? 'DISABLE' : 'ENABLE')
                      }
                    >
                      {selected.active ? '사용 중지' : '재활성화'}
                    </Button>
                    <Button
                      disabled={selected.id === actor.id || !locked(selected)}
                      onClick={() => begin('CLEAR_AUTO_LOCK')}
                    >
                      자동 잠금 해제
                    </Button>
                    <Button
                      disabled={selected.id === actor.id}
                      onClick={() => begin('RESET_PASSWORD')}
                    >
                      비밀번호 초기화
                    </Button>
                  </Box>
                  {selected.id === actor.id && (
                    <Typography variant="caption" color="text.secondary">
                      본인의 잠금·권한 변경은 보호됩니다. 비밀번호는 사이드바의
                      비밀번호 변경을 사용하십시오.
                    </Typography>
                  )}
                </>
              )}
              <Button onClick={() => setHistory(true)}>
                이 사용자 변경 이력
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={() => {
              setSelected(null)
              setError('')
            }}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!action}
        onClose={
          busy
            ? undefined
            : () => {
                setAction(null)
                setPassword('')
              }
        }
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{action && actionNames[action]}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              {selected?.display_name} ({selected?.username})
              {action === 'ROLE'
                ? ` · ${roleNames[selected!.role]} → ${roleNames[form.role]}`
                : ''}
            </Typography>
            {action === 'RESET_PASSWORD' && (
              <Alert severity="warning">
                기존 비밀번호는 사용할 수 없게 됩니다. 임시 비밀번호를 전달한 뒤
                첫 로그인에서 변경해야 합니다. 다른 잠금 상태는 유지됩니다.
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="변경 사유"
              multiline
              minRows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
            />
            <TextField
              label="관리자 비밀번호 확인"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAction(null)
              setPassword('')
            }}
            disabled={busy}
          >
            취소
          </Button>
          <Button
            variant="contained"
            onClick={mutate}
            disabled={busy || reason.trim().length < 2 || !password}
          >
            {busy ? '처리 중…' : '확인'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!temporary}
        onClose={() => setTemporary('')}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>임시 비밀번호 · 한 번만 표시</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            이 창을 닫으면 다시 확인할 수 없습니다. 대상 사용자에게 안전하게
            전달하십시오.
          </Alert>
          <Typography
            component="p"
            className="admin-temporary"
            data-testid="temporary-password"
          >
            {temporary}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemporary('')}>확인하고 닫기</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={history}
        onClose={() => setHistory(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>사용자 변경 이력 · {selected?.display_name}</DialogTitle>
        <DialogContent>
          {history && selected && <AdminAudit targetId={selected.id} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistory(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
