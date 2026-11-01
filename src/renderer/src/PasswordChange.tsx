import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import type { PublicUser } from '../../shared/contracts'
import { adminCall } from './adminApi'
export default function PasswordChange({
  open,
  forced = false,
  onClose,
  onChanged,
  onLogout
}: {
  open: boolean
  forced?: boolean
  onClose: () => void
  onChanged: (user: PublicUser) => void
  onLogout?: () => void
}) {
  const [current, setCurrent] = useState(''),
    [next, setNext] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const save = async () => {
    if (busy) return
    setError('')
    if (next !== confirm) {
      setError('새 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    setBusy(true)
    try {
      const u = await adminCall('auth:changePassword', {
        currentPassword: current,
        newPassword: next
      })
      setCurrent('')
      setNext('')
      setConfirm('')
      onChanged(u)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경 실패')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onClose={forced || busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>
        {forced ? '첫 로그인 · 비밀번호 변경' : '내 비밀번호 변경'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary" variant="body2">
            {forced
              ? '임시 비밀번호를 새 비밀번호로 변경한 뒤 업무를 시작할 수 있습니다.'
              : '영문·숫자·특수문자를 포함해 8~64자로 입력하십시오.'}
          </Typography>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          <TextField
            label={forced ? '임시 비밀번호' : '현재 비밀번호'}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={busy}
          />
          <TextField
            label="새 비밀번호"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={busy}
          />
          <TextField
            label="새 비밀번호 확인"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        {forced ? (
          <Button onClick={onLogout} disabled={busy}>
            로그아웃
          </Button>
        ) : (
          <Button onClick={onClose} disabled={busy}>
            취소
          </Button>
        )}
        <Button
          variant="contained"
          onClick={save}
          disabled={busy || !current || !next || !confirm}
        >
          {busy ? '변경 중…' : '비밀번호 변경'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
