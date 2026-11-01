import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import type { PublicUser, Result } from '../../shared/contracts'
import type { IncidentMaintenanceContext } from '../../shared/incidentMaintenance'
import StatusChip from './StatusChip'

const labels: Record<string, string> = {
  ASSIGNED: '배정',
  PLANNED: '계획',
  IN_PROGRESS: '진행',
  REMOTE_IN_PROGRESS: '원격조치',
  ON_SITE_IN_PROGRESS: '현장출동'
}
export default function IncidentMaintenanceQueue({
  user,
  revision
}: {
  user: PublicUser
  revision: number
}) {
  const navigate = useNavigate()
  const [contexts, setContexts] = useState<IncidentMaintenanceContext[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    window.omnis
      .invoke('maintenance:incidentCandidates')
      .then((result) => {
        if (!active) return
        const r = result as Result<IncidentMaintenanceContext[]>
        if (!r.ok) throw new Error(r.error.message)
        setContexts(r.data)
        setError('')
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user.id, revision])
  const columns: GridColDef[] = [
    { field: 'ticketNo', headerName: '접수번호', width: 150 },
    {
      field: 'title',
      headerName: '고장 접수 내용',
      flex: 1.5,
      minWidth: 160,
      renderCell: ({ row }) => (
        <span className="incident-ellipsis" title={row.title}>
          {row.title}
        </span>
      )
    },
    {
      field: 'status',
      headerName: '고장 상태',
      width: 105,
      renderCell: ({ row }) => (
        <StatusChip
          code={row.status}
          label={labels[row.status] ?? row.status}
        />
      )
    },
    {
      field: 'teamName',
      headerName: '조치부서',
      flex: 1,
      minWidth: 100,
      renderCell: ({ row }) => (
        <span className="incident-ellipsis" title={row.teamName ?? ''}>
          {row.teamName ?? '미지정'}
        </span>
      )
    },
    { field: 'assigneeName', headerName: '담당자', width: 90 },
    {
      field: 'registration',
      headerName: '연계 정비',
      width: 130,
      sortable: false,
      renderCell: ({ row }) => {
        const context: IncidentMaintenanceContext = row.context
        const active = context.tasks.find(
          (t) => !['COMPLETED', 'CANCELED'].includes(t.status)
        )
        return context.canCreate ? (
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              navigate(
                `/maintenance?fromIncident=${encodeURIComponent(row.id)}`
              )
            }
          >
            정비 등록
          </Button>
        ) : active?.canOpen ? (
          <Button
            size="small"
            onClick={() =>
              navigate(`/maintenance?detail=${encodeURIComponent(active.id)}`)
            }
          >
            정비 보기
          </Button>
        ) : (
          <Typography
            variant="caption"
            color="text.secondary"
            title={context.reason ?? ''}
          >
            {active ? '기존 정비 진행 중' : '배정 확인 필요'}
          </Typography>
        )
      }
    },
    {
      field: 'view',
      headerName: '접수 상세',
      width: 95,
      sortable: false,
      renderCell: ({ row }) => (
        <Button
          size="small"
          onClick={() =>
            navigate(`/incidents?detail=${encodeURIComponent(row.id)}`)
          }
        >
          고장 보기
        </Button>
      )
    }
  ]
  return (
    <Box>
      <Alert severity="info" sx={{ m: 2 }}>
        {user.role === 'MAINTAINER'
          ? '본인에게 배정된 고장입니다.'
          : '배정이 완료된 고장입니다.'}{' '}
        ‘정비 등록’을 누르면 접수 내용·체계·담당부서가 자동으로 입력됩니다. 진행
        중인 정비가 있으면 기존 작업을 확인합니다.
      </Alert>
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
      <DataGrid
        className="incident-grid"
        rows={contexts.map((context) => ({
          ...context.incident,
          id: context.incident.id,
          context
        }))}
        columns={columns}
        loading={loading}
        rowHeight={42}
        columnHeaderHeight={40}
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10, page: 0 } }
        }}
      />
    </Box>
  )
}
