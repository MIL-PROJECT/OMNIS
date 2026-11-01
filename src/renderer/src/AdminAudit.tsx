import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import type { AuditEntry } from '../../shared/admin'
import { useAdminQuery } from './adminApi'
import { Card, fmtDateTime } from './ui'
import StatusChip from './StatusChip'
const actions: Record<string, string> = {
  LOGIN_SUCCESS: '로그인 성공',
  LOGIN_FAILED: '로그인 실패',
  LOGIN_DENIED: '접속 제한',
  AUTO_LOCK: '자동 잠금',
  REAUTH_FAILED: '재인증 실패',
  PASSWORD_CHANGED: '비밀번호 변경',
  USER_PROFILE: '정보 수정',
  USER_ROLE: '권한 변경',
  USER_LOCK: '수동 잠금',
  USER_UNLOCK: '수동 잠금 해제',
  USER_DISABLE: '사용 중지',
  USER_ENABLE: '재활성화',
  USER_CLEAR_AUTO_LOCK: '자동 잠금 해제',
  USER_RESET_PASSWORD: '비밀번호 초기화',
  SECURITY_POLICY_CHANGED: '접속 정책 변경',
  APPROVE: '가입 승인',
  REJECT: '가입 반려',
  ADMIN_ACCESS_DENIED: '관리자 접근 거절'
}
export const auditAction = (v: string) =>
  actions[v] ??
  (v.endsWith('_FAILED')
    ? `${actions[v.slice(0, -7)] ?? v.slice(0, -7)} 실패`
    : v)
export default function AdminAudit({ targetId }: { targetId?: string }) {
  const [filters, setFilters] = useState({
      from: '',
      to: '',
      actor: '',
      target: '',
      action: '',
      result: 'ALL'
    }),
    [paging, setPaging] = useState({ page: 0, pageSize: 10 }),
    [detail, setDetail] = useState<AuditEntry | null>(null)
  const query = useAdminQuery('admin:audit', {
    ...filters,
    from: filters.from || undefined,
    to: filters.to || undefined,
    targetId,
    ...paging
  })
  const filter = (key: keyof typeof filters, value: string) => {
    setFilters((p) => ({ ...p, [key]: value }))
    setPaging((p) => ({ ...p, page: 0 }))
  }
  const columns: GridColDef[] = [
    {
      field: 'created_at',
      headerName: '시간',
      width: 135,
      renderCell: ({ row }) => (
        <span className="admin-ellipsis" title={fmtDateTime(row.created_at)}>
          {fmtDateTime(row.created_at)}
        </span>
      )
    },
    {
      field: 'actor_name',
      headerName: '수행자',
      width: 84,
      valueFormatter: (v) => v || '로그인 전'
    },
    {
      field: 'action',
      headerName: '작업',
      flex: 1,
      minWidth: 125,
      renderCell: ({ row }) => (
        <span className="admin-ellipsis" title={auditAction(row.action)}>
          {auditAction(row.action)}
        </span>
      )
    },
    {
      field: 'target_name',
      headerName: '대상',
      flex: 1,
      minWidth: 100,
      renderCell: ({ row }) => (
        <span
          className="admin-ellipsis"
          title={row.target_name || row.entity_id}
        >
          {row.target_name || row.entity_id}
        </span>
      )
    },
    {
      field: 'result',
      headerName: '결과',
      width: 82,
      renderCell: ({ row }) => (
        <StatusChip
          code={row.result}
          label={row.result === 'FAILURE' ? '실패' : '성공'}
          tone={row.result === 'FAILURE' ? 'red' : 'green'}
        />
      )
    },
    {
      field: 'reason',
      headerName: '사유',
      flex: 1,
      minWidth: 100,
      renderCell: ({ row }) => (
        <span className="admin-ellipsis" title={row.reason}>
          {row.reason || '-'}
        </span>
      )
    },
    {
      field: 'actions',
      headerName: '상세',
      width: 66,
      sortable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => (
        <Button size="small" onClick={() => setDetail(row)}>
          보기
        </Button>
      )
    }
  ]
  return (
    <Card
      icon={HistoryRounded}
      title="감사 기록"
      subtitle="인증 및 관리자 변경 이력 · 로컬 기록"
      action={<Button onClick={query.reload}>새로고침</Button>}
    >
      <Box className="admin-filters">
        {(['from', 'to'] as const).map((key, i) => (
          <TextField
            key={key}
            label={i ? '종료일' : '시작일'}
            type="date"
            value={filters[key]}
            onChange={(e) => filter(key, e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        ))}
        {(['actor', 'target', 'action'] as const)
          .filter((k) => !targetId || k !== 'target')
          .map((key) => (
            <TextField
              key={key}
              label={
                {
                  actor: '수행자',
                  target: '대상 사용자',
                  action: '작업 코드 검색'
                }[key]
              }
              value={filters[key]}
              onChange={(e) => filter(key, e.target.value)}
            />
          ))}
        <TextField
          select
          label="결과"
          value={filters.result}
          onChange={(e) => filter('result', e.target.value)}
        >
          <MenuItem value="ALL">전체</MenuItem>
          <MenuItem value="SUCCESS">성공</MenuItem>
          <MenuItem value="FAILURE">실패</MenuItem>
        </TextField>
      </Box>
      {query.error && (
        <Alert
          severity="error"
          action={<Button onClick={query.reload}>재시도</Button>}
        >
          {query.error}
        </Alert>
      )}
      <DataGrid
        className="admin-grid"
        rows={query.data?.rows ?? []}
        columns={columns}
        rowHeight={40}
        columnHeaderHeight={40}
        loading={query.loading}
        rowCount={query.data?.total ?? 0}
        paginationMode="server"
        paginationModel={paging}
        onPaginationModelChange={setPaging}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        localeText={{ noRowsLabel: '조건에 맞는 감사 기록이 없습니다' }}
      />
      <Dialog
        open={!!detail}
        onClose={() => setDetail(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          변경 상세 · {detail && auditAction(detail.action)}
        </DialogTitle>
        <DialogContent dividers>
          {detail && (
            <>
              <dl className="admin-detail-list">
                <div>
                  <dt>수행자 / 대상</dt>
                  <dd>
                    {detail.actor_name || '로그인 전'} /{' '}
                    {detail.target_name || detail.entity_id}
                  </dd>
                </div>
                <div>
                  <dt>시간</dt>
                  <dd>{fmtDateTime(detail.created_at)}</dd>
                </div>
                <div>
                  <dt>사유</dt>
                  <dd>{detail.reason || '-'}</dd>
                </div>
                <div>
                  <dt>결과</dt>
                  <dd>{detail.result === 'FAILURE' ? '실패' : '성공'}</dd>
                </div>
              </dl>
              <Box className="admin-audit-compare">
                <section>
                  <h3>변경 전</h3>
                  <pre>
                    {JSON.stringify(detail.before, null, 2) ?? '기록 없음'}
                  </pre>
                </section>
                <section>
                  <h3>변경 후</h3>
                  <pre>
                    {JSON.stringify(detail.after, null, 2) ?? '기록 없음'}
                  </pre>
                </section>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
