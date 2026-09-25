import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Stack, TextField, Typography } from '@mui/material'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'
import TaskAltRounded from '@mui/icons-material/TaskAltRounded'
import { ranks, signupRules, type Channel, type Result } from '../../shared/contracts'

type Form = { serviceNo: string; rankName: string; displayName: string; unitName: string; username: string; password: string; confirm: string; phone: string; reason: string }
const blank: Form = { serviceNo: '', rankName: '', displayName: '', unitName: '', username: '', password: '', confirm: '', phone: '', reason: '' }
async function call<T>(channel: Channel, payload: Record<string, unknown> = {}): Promise<T> { const r = await window.omnis.invoke(channel, payload) as Result<T>; if (!r.ok) throw new Error(r.error.message); return r.data }

// 입력 칸별 검사 — 서버(signupSchema)와 같은 규칙, 화면에서는 칸 아래에 바로 안내
const check = (f: Form): Partial<Record<keyof Form, string>> => ({
  serviceNo: signupRules.serviceNo.test(f.serviceNo.trim()) ? undefined : '예: 22-12345678',
  rankName: f.rankName ? undefined : '계급을 선택하십시오.',
  displayName: f.displayName.trim().length >= 2 ? undefined : '이름을 2자 이상 입력하십시오.',
  unitName: f.unitName.trim().length >= 2 ? undefined : '소속을 입력하십시오.',
  username: signupRules.username.test(f.username.trim()) ? undefined : '영문 소문자로 시작, 4~20자 (소문자·숫자·_)',
  password: signupRules.password.test(f.password) ? undefined : '영문·숫자·특수문자 포함 8자 이상',
  confirm: f.confirm && f.confirm === f.password ? undefined : '비밀번호가 일치하지 않습니다.',
  phone: !f.phone.trim() || signupRules.phone.test(f.phone.trim()) ? undefined : '예: 010-1234-5678'
})

export default function SignupDialog({ open, onClose }: { open: boolean; onClose: (username?: string) => void }) {
  const [form, setForm] = useState<Form>(blank), [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({}), [show, setShow] = useState(false)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false)
  const errors = check(form), valid = Object.values(errors).every(v => !v)
  const field = (key: keyof Form) => ({
    value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }), onBlur: () => setTouched({ ...touched, [key]: true }),
    error: !!(touched[key] && errors[key]), helperText: touched[key] && errors[key] ? errors[key] : ' '
  })
  const close = () => { const username = done ? form.username.trim() : undefined; setForm(blank); setTouched({}); setError(''); setDone(false); onClose(username) }
  const submit = () => {
    setTouched(Object.fromEntries(Object.keys(blank).map(k => [k, true])))
    if (!valid) return
    setBusy(true); setError('')
    const payload: Partial<Form> = { ...form }
    delete payload.confirm
    call('auth:register', payload).then(() => setDone(true)).catch(e => setError(e.message)).finally(() => setBusy(false))
  }
  const pwAdornment = { input: { endAdornment: <InputAdornment position="end"><IconButton size="small" aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={() => setShow(!show)}>{show ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}</IconButton></InputAdornment> } }

  return <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
    {done ? <>
      <DialogContent sx={{ textAlign: 'center', py: 5 }}>
        <TaskAltRounded sx={{ fontSize: 52, color: 'success.main' }} />
        <Typography variant="h6" sx={{ mt: 1.5 }}>사용자 등록 신청이 접수되었습니다</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>관리자가 승인하면 <b>{form.username}</b> 아이디로 로그인할 수 있습니다.</Typography>
      </DialogContent>
      <DialogActions><Button variant="contained" onClick={close}>확인</Button></DialogActions>
    </> : <>
      <DialogTitle sx={{ pb: .5 }}>사용자 등록 신청</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2.5 }}>신청 정보는 관리자 확인 후 승인됩니다. 승인 전에는 로그인할 수 없습니다.</Typography>
        <Box className="signup-section">인적 사항</Box>
        <Stack direction="row" spacing={1.5}>
          <TextField label="군번" required placeholder="22-12345678" sx={{ flex: 1.2 }} {...field('serviceNo')} />
          <TextField select label="계급" required sx={{ flex: .8 }} {...field('rankName')}>{ranks.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}</TextField>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <TextField label="이름" required sx={{ flex: 1 }} {...field('displayName')} />
          <TextField label="연락처" placeholder="010-1234-5678" sx={{ flex: 1 }} {...field('phone')} />
        </Stack>
        <TextField label="소속" required fullWidth placeholder="예: 제1정보통신대대 운용중대" {...field('unitName')} />
        <Box className="signup-section">계정 정보</Box>
        <TextField label="아이디" required fullWidth autoComplete="off" {...field('username')} />
        <Stack direction="row" spacing={1.5}>
          <TextField label="비밀번호" required type={show ? 'text' : 'password'} sx={{ flex: 1 }} autoComplete="new-password" slotProps={pwAdornment} {...field('password')} />
          <TextField label="비밀번호 확인" required type={show ? 'text' : 'password'} sx={{ flex: 1 }} autoComplete="new-password" {...field('confirm')} />
        </Stack>
        <TextField label="신청 사유" fullWidth multiline rows={2} placeholder="담당 업무 등 (선택)" {...field('reason')} />
        {error && <Typography className="login-error" role="alert" sx={{ mt: 1 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions><Button onClick={close}>취소</Button><Button variant="contained" disabled={busy} onClick={submit}>{busy ? '신청 중...' : '등록 신청'}</Button></DialogActions>
    </>}
  </Dialog>
}
