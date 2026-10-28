import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import AssignmentRounded from '@mui/icons-material/AssignmentRounded'
import { useNavigate } from 'react-router-dom'
import type { PublicUser } from '../../shared/contracts'
import { invoke } from './usabilityApi'
import { Card, EmptyState, PageHeader, fmtDateTime } from './ui'

type Item = {
  id: string
  title: string
  status: string
  ticket_no?: string
  task_no?: string
  scheduled_date?: string
  due_at?: string
  level?: string
}
type Mine = {
  date: string
  generatedAt: string
  incidentLabel: string
  incidents: Item[]
  today: Item[]
  overdue: Item[]
  directives: Item[]
}
export default function MyWork({ user }: { user: PublicUser }) {
  const [data, setData] = useState<Mine | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    token = useRef(0),
    navigate = useNavigate()
  const load = async () => {
    const version = ++token.current
    setBusy(true)
    try {
      const v = await invoke<Mine>('work:mine')
      if (token.current === version) {
        setData(v)
        setError('')
      }
    } catch (e) {
      if (token.current === version) setError((e as Error).message)
    } finally {
      if (token.current === version) setBusy(false)
    }
  }
  useEffect(() => {
    setData(null)
    load()
    return () => {
      token.current++
    }
  }, [user.id])
  const panels = data
    ? [
        { title: data.incidentLabel, rows: data.incidents, path: '/incidents' },
        { title: '오늘 예정 정비', rows: data.today, path: '/maintenance' },
        {
          title: '기한 지난 내 정비',
          rows: data.overdue,
          path: '/maintenance'
        },
        { title: '확인할 지시사항', rows: data.directives, path: '/duty' }
      ]
    : []
  return (
    <Box>
      <PageHeader
        section="통합상황판"
        title="내 업무"
        description={`${user.display_name} · ${data?.date ?? ''} · 확인과 완료는 별도로 기록됩니다.`}
        actions={
          <Stack direction="row" spacing={1}>
            <Button onClick={() => navigate('/')}>전체 현황</Button>
            <Button variant="outlined" disabled={busy} onClick={load}>
              새로고침
            </Button>
          </Stack>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Typography variant="caption">
        {data ? `${fmtDateTime(data.generatedAt)} 갱신` : '불러오는 중...'}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mt: 1
        }}
      >
        {panels.map((panel) => (
          <Card
            key={panel.title}
            icon={AssignmentRounded}
            title={panel.title}
            subtitle={`${panel.rows.length}건`}
            tone="sky"
          >
            <Stack spacing={1} sx={{ p: 2, maxHeight: 380, overflowY: 'auto' }}>
              {panel.rows.length ? (
                panel.rows.map((row) => (
                  <Button
                    key={row.id}
                    variant="outlined"
                    sx={{
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      p: 1.5
                    }}
                    onClick={() =>
                      navigate(
                        `${panel.path}?detail=${encodeURIComponent(row.id)}&from=mine`
                      )
                    }
                  >
                    <Box>
                      <Typography variant="body2">
                        {row.ticket_no ?? row.task_no ?? row.level} ·{' '}
                        {row.title}
                      </Typography>
                      <Typography variant="caption">
                        {row.scheduled_date ??
                          (row.due_at
                            ? `기한 ${fmtDateTime(row.due_at)}`
                            : '상세 확인')}
                      </Typography>
                    </Box>
                  </Button>
                ))
              ) : (
                <EmptyState
                  icon={AssignmentRounded}
                  title="해당 업무가 없습니다"
                  description="새 업무가 생기면 이곳에서 확인할 수 있습니다."
                />
              )}
            </Stack>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
