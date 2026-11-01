import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import { roleNames } from '../../shared/admin'
import type { Role } from '../../shared/contracts'
import { permissionRules } from '../../shared/permissions'
import { adminCall, useAdminQuery } from './adminApi'
import { Card } from './ui'
export default function AdminSecurity() {
  const policy = useAdminQuery('admin:securityPolicy'),
    [limit, setLimit] = useState(5),
    [minutes, setMinutes] = useState(15),
    [confirm, setConfirm] = useState(false),
    [reason, setReason] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  useEffect(() => {
    if (policy.data) {
      setLimit(policy.data.failedLimit)
      setMinutes(policy.data.lockMinutes)
    }
  }, [policy.data])
  const save = async () => {
    if (!policy.data || busy) return
    setBusy(true)
    setError('')
    try {
      await adminCall('admin:saveSecurityPolicy', {
        expectedVersion: policy.data.version,
        failedLimit: limit,
        lockMinutes: minutes,
        reason,
        adminPassword: password
      })
      setConfirm(false)
      setPassword('')
      setNotice('접속 정책을 저장했습니다.')
      policy.reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack spacing={2}>
      <Card
        icon={ShieldOutlined}
        title="접속 보안 정책"
        subtitle="오프라인 로그인 보호 · 수동 잠금과 사용 중지는 자동 해제되지 않습니다."
      >
        <Stack spacing={2} sx={{ p: 2.5 }}>
          {(policy.error || error) && (
            <Alert
              severity="error"
              action={<Button onClick={policy.reload}>재시도</Button>}
            >
              {policy.error || error}
            </Alert>
          )}
          {notice && (
            <Alert severity="success" onClose={() => setNotice('')}>
              {notice}
            </Alert>
          )}
          <Box className="admin-policy-fields">
            <TextField
              label="자동 잠금 실패 횟수"
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              slotProps={{ htmlInput: { min: 3, max: 10 } }}
              helperText="3~10회 연속 실패 시 잠금"
            />
            <TextField
              label="자동 잠금 시간(분)"
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              slotProps={{ htmlInput: { min: 1, max: 60 } }}
              helperText="1~60분, 앱 재시작 후에도 유지"
            />
            <Button
              variant="contained"
              disabled={
                policy.loading ||
                !policy.data ||
                limit < 3 ||
                limit > 10 ||
                minutes < 1 ||
                minutes > 60 ||
                !Number.isInteger(limit) ||
                !Number.isInteger(minutes)
              }
              onClick={() => {
                setReason('')
                setPassword('')
                setError('')
                setConfirm(true)
              }}
            >
              접속 정책 저장
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            잠금 해제는 사용자 관리에서 사유와 관리자 비밀번호를 확인한 뒤
            수행합니다. 임시 비밀번호는 최초 로그인에서 변경해야 하며, 변경
            전에는 업무 기능을 사용할 수 없습니다. 이 앱은 현재 Mac의 로컬
            세션을 관리합니다.
          </Typography>
        </Stack>
      </Card>
      <Card
        icon={ShieldOutlined}
        title="역할별 권한"
        subtitle="Main 서비스에서 적용되는 역할 규칙 · 소유권·상태별 제한은 추가 적용"
      >
        <Box className="admin-permission-wrap">
          <table className="admin-permission-table">
            <thead>
              <tr>
                <th>업무 기능</th>
                {(Object.keys(roleNames) as Role[]).map((role) => (
                  <th key={role}>{roleNames[role]}</th>
                ))}
                <th>적용 조건</th>
              </tr>
            </thead>
            <tbody>
              {permissionRules.map((rule) => (
                <tr key={rule.channel}>
                  <th scope="row">{rule.label}</th>
                  {(Object.keys(roleNames) as Role[]).map((role) => (
                    <td key={role}>
                      {rule.roles.includes(role) ? '허용' : '—'}
                    </td>
                  ))}
                  <td>{rule.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Card>
      <Dialog
        open={confirm}
        onClose={
          busy
            ? undefined
            : () => {
                setConfirm(false)
                setPassword('')
              }
        }
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>접속 정책 변경 확인</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              실패 {limit}회 · 자동 잠금 {minutes}분으로 변경합니다.
            </Typography>
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
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={() => {
              setConfirm(false)
              setPassword('')
            }}
          >
            취소
          </Button>
          <Button
            variant="contained"
            disabled={busy || reason.trim().length < 2 || !password}
            onClick={save}
          >
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
