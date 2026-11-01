import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import BuildRounded from '@mui/icons-material/BuildRounded'
import type { Result } from '../../shared/contracts'
import type { IncidentMaintenanceContext } from '../../shared/incidentMaintenance'
import StatusChip from './StatusChip'

const statusLabels: Record<string, string> = {
  PLANNED: '계획',
  IN_PROGRESS: '진행',
  BLOCKED: '보류',
  COMPLETED: '완료',
  CANCELED: '취소'
}
export default function IncidentMaintenancePanel({
  incidentId,
  revision
}: {
  incidentId: string
  revision: string
}) {
  const navigate = useNavigate()
  const [context, setContext] = useState<IncidentMaintenanceContext | null>(
      null
    ),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setContext(null)
    setError('')
    window.omnis
      .invoke('maintenance:incidentContext', { incidentId })
      .then((result) => {
        if (!active) return
        const r = result as Result<IncidentMaintenanceContext>
        if (!r.ok) throw new Error(r.error.message)
        setContext(r.data)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [incidentId, revision])
  return (
    <Box
      sx={{
        my: 2.5,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2
      }}
    >
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <BuildRounded color="primary" fontSize="small" />
        <Typography sx={{ fontWeight: 700 }}>연계 정비</Typography>
      </Stack>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : !context ? (
        <Typography color="text.secondary">연계 정비 조회 중…</Typography>
      ) : (
        <>
          {context.tasks.length ? (
            <Stack spacing={1}>
              {context.tasks.map((task) => (
                <Stack
                  key={task.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{
                    p: 1.5,
                    bgcolor: '#f5f7fb',
                    borderRadius: 1.5,
                    alignItems: { sm: 'center' }
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ overflowWrap: 'anywhere', fontWeight: 600 }}
                    >
                      {task.taskNo} · {task.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      담당자 {task.assigneeName ?? '미지정'} · 진행률{' '}
                      {task.progress}%
                    </Typography>
                  </Box>
                  <StatusChip
                    code={task.status}
                    label={statusLabels[task.status] ?? task.status}
                  />
                  {task.canOpen && (
                    <Button
                      size="small"
                      sx={{ flexShrink: 0 }}
                      onClick={() =>
                        navigate(
                          `/maintenance?detail=${encodeURIComponent(task.id)}`
                        )
                      }
                    >
                      정비 보기
                    </Button>
                  )}
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              등록된 연계 정비가 없습니다.
            </Typography>
          )}
          {context.canCreate ? (
            <Button
              sx={{ mt: 1.5 }}
              variant="contained"
              startIcon={<BuildRounded />}
              onClick={() =>
                navigate(
                  `/maintenance?fromIncident=${encodeURIComponent(incidentId)}`
                )
              }
            >
              이 고장으로 정비 등록
            </Button>
          ) : (
            context.reason && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.5 }}
              >
                {context.reason}
              </Typography>
            )
          )}
        </>
      )}
    </Box>
  )
}
