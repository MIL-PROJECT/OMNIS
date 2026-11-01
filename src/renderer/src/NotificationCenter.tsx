import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import type { Channel, PublicUser, Result } from '../../shared/contracts'
import type {
  NotificationInbox,
  UserNotification
} from '../../shared/notifications'
import { fmtDateTime } from './ui'

async function call<T>(
  channel: Channel,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const result = (await window.omnis.invoke(channel, payload)) as Result<T>
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export default function NotificationCenter({ user }: { user: PublicUser }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false),
    [inbox, setInbox] = useState<NotificationInbox>({
      items: [],
      unreadCount: 0
    })
  const [toast, setToast] = useState<UserNotification | null>(null),
    [error, setError] = useState('')
  const seen = useRef(new Set<string>()),
    active = useRef(false),
    request = useRef(0)
  const refresh = useCallback(async () => {
    const version = ++request.current
    try {
      const next = await call<NotificationInbox>('notifications:list')
      if (!active.current || version !== request.current) return
      setInbox(next)
      setError('')
      const fresh = next.items.filter(
        (n) => !n.read_at && !n.superseded_at && !seen.current.has(n.id)
      )
      next.items.forEach((n) => seen.current.add(n.id))
      setToast(
        (current) =>
          fresh[0] ??
          (current &&
          next.items.some(
            (n) => n.id === current.id && !n.read_at && !n.superseded_at
          )
            ? current
            : null)
      )
    } catch (e) {
      if (active.current && version === request.current)
        setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    active.current = true
    void refresh()
    const unsubscribe = window.omnis.onNotificationsChanged(
      () => void refresh()
    )
    const focus = () => void refresh()
    window.addEventListener('focus', focus)
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, 15000)
    return () => {
      active.current = false
      request.current++
      unsubscribe()
      clearInterval(timer)
      window.removeEventListener('focus', focus)
    }
  }, [refresh, user.id])
  const read = async (id: string) => {
    try {
      await call('notifications:read', { id })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const view = async (n: UserNotification) => {
    try {
      await call('notifications:read', { id: n.id })
      setOpen(false)
      setToast(null)
      await refresh()
      navigate(`/incidents?detail=${encodeURIComponent(n.entity_id)}`)
    } catch (e) {
      setError((e as Error).message)
      setOpen(true)
    }
  }
  return (
    <>
      <Tooltip title={`개인 알림함 · 읽지 않음 ${inbox.unreadCount}건`}>
        <IconButton
          aria-label="개인 알림함"
          onClick={() => {
            setOpen(true)
            setToast(null)
            void refresh()
          }}
          color="primary"
          sx={{ bgcolor: 'white', border: '1px solid', borderColor: 'divider' }}
        >
          <Badge badgeContent={inbox.unreadCount} color="error" max={99}>
            <NotificationsNoneRounded />
          </Badge>
        </IconButton>
      </Tooltip>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: { sx: { width: { xs: '100%', sm: 440 }, maxWidth: '100vw' } }
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ p: 2.5, alignItems: 'center' }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">개인 알림함</Typography>
            <Typography variant="body2" color="text.secondary">
              {user.display_name} · 읽지 않음 {inbox.unreadCount}건
            </Typography>
          </Box>
          <IconButton aria-label="알림함 닫기" onClick={() => setOpen(false)}>
            <CloseRounded />
          </IconButton>
        </Stack>
        <Stack
          direction="row"
          sx={{ px: 2.5, pb: 1.5, justifyContent: 'flex-end' }}
        >
          <Button
            size="small"
            disabled={!inbox.unreadCount}
            onClick={() =>
              call('notifications:readAll')
                .then(refresh)
                .catch((e) => setError(e.message))
            }
          >
            모두 읽음
          </Button>
        </Stack>
        <Divider />
        {error && (
          <Alert
            severity="error"
            sx={{ m: 2 }}
            action={
              <Button color="inherit" onClick={() => void refresh()}>
                다시 시도
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {!inbox.items.length ? (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">
              받은 배정 알림이 없습니다.
            </Typography>
          </Box>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {inbox.items.map((n) => (
              <Box
                component="li"
                key={n.id}
                sx={{
                  p: 2.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: !n.read_at && !n.superseded_at ? '#f1f4ff' : 'white'
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>{n.title}</Typography>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    mt: 0.75
                  }}
                >
                  {n.body}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
                  {fmtDateTime(n.created_at)}
                  {n.superseded_at
                    ? ' · 이전 배정'
                    : n.read_at
                      ? ' · 읽음'
                      : ' · 읽지 않음'}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => void view(n)}
                  >
                    고장 보기
                  </Button>
                  {!n.read_at && !n.superseded_at && (
                    <Button size="small" onClick={() => void read(n.id)}>
                      읽음으로 표시
                    </Button>
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        )}
      </Drawer>
      <Snackbar
        open={!!toast}
        autoHideDuration={8000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setToast(null)
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: 7 }}
      >
        <Alert
          severity="info"
          variant="filled"
          sx={{ maxWidth: 520, overflowWrap: 'anywhere' }}
          onClose={() => setToast(null)}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => toast && void view(toast)}
            >
              고장 보기
            </Button>
          }
        >
          <Typography sx={{ fontWeight: 700 }}>{toast?.title}</Typography>
          <Typography variant="body2">{toast?.body.split('\n')[0]}</Typography>
        </Alert>
      </Snackbar>
    </>
  )
}
