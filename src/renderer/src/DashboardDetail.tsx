import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Typography } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import StatusChip from './StatusChip'

type Row = Record<string, any>
export type DetailKind = 'system' | 'incident' | 'maintenance' | 'directive'
export type DetailTarget = { kind: DetailKind; row: Row }
export type ListTarget = { title: string; kind: DetailKind; rows: Row[]; columns: GridColDef[] }

// 상단 지표 카드 클릭 시 해당 수치를 구성하는 항목 목록. 행을 누르면 항목 상세가 위에 겹쳐 열린다.
export function MetricListDialog({ target, onSelect, onClose }: { target: ListTarget | null; onSelect: (t: DetailTarget) => void; onClose: () => void }) {
  return <Dialog open={!!target} onClose={onClose} fullWidth maxWidth="md">
    {target && <>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography className="dd-kicker">상황판 지표</Typography>
        <Typography className="dd-heading">{target.title} <span className="dd-count">{target.rows.length}건</span></Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {target.rows.length
          ? <DataGrid className="clickable-grid" rows={target.rows} columns={target.columns} density="compact" hideFooter autoHeight
            onRowClick={({ row }) => onSelect({ kind: target.kind, row })} sx={{ border: 0 }} />
          : <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>해당 항목이 없습니다.</Typography>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>닫기</Button></DialogActions>
    </>}
  </Dialog>
}

// 필드 표시 방식: chip=상태 배지, date=일시, pct=진행률 막대, long=여러 줄 본문
type Field = [key: string, label: string, format?: 'chip' | 'date' | 'pct' | 'long' | 'bool']

const specs: Record<DetailKind, { title: string; heading: (r: Row) => string; sub: (r: Row) => string; fields: Field[] }> = {
  system: {
    title: '체계 상세', heading: r => r.name, sub: r => r.code,
    fields: [['status', '상태', 'chip'], ['category', '구분'], ['uptime_pct', '운용률'], ['today_incident_count', '금일 고장'], ['updated_at', '최종 갱신', 'date'], ['remarks', '비고', 'long']]
  },
  incident: {
    title: '고장 접수 상세', heading: r => r.title, sub: r => r.ticket_no,
    fields: [
      ['severity', '중요도', 'chip'], ['status', '상태', 'chip'], ['category', '구분'], ['system_name', '체계'],
      ['department', '부서'], ['reporter_name', '접수자'], ['assignee_name', '담당자'], ['reported_at', '접수일시', 'date'],
      ['assigned_at', '배정일시', 'date'], ['started_at', '착수일시', 'date'], ['resolved_at', '조치일시', 'date'], ['closed_at', '종결일시', 'date'],
      ['description', '내용', 'long'], ['cause', '원인', 'long'], ['action_summary', '조치 내용', 'long']
    ]
  },
  maintenance: {
    title: '정비작업 상세', heading: r => r.title, sub: r => r.task_no,
    fields: [
      ['status', '상태', 'chip'], ['priority', '우선순위', 'chip'], ['maintenance_type', '정비유형'], ['system_name', '체계'],
      ['department', '부서'], ['assignee_name', '담당자'], ['scheduled_date', '예정일'], ['due_date', '완료기한'],
      ['started_at', '착수일시', 'date'], ['completed_at', '완료일시', 'date'], ['progress', '진행률', 'pct'],
      ['description', '작업 내용', 'long'], ['result', '결과', 'long']
    ]
  },
  directive: {
    title: '지시사항 / 공지', heading: r => r.title, sub: r => r.issuer,
    fields: [['level', '구분', 'chip'], ['pinned', '상단 고정', 'bool'], ['issued_at', '발령일시', 'date'], ['expires_at', '만료일시', 'date'], ['content', '내용', 'long']]
  }
}

const fmtDate = (v: unknown) => String(v).replace('T', ' ').slice(0, 16)

export default function DashboardDetail({ target, label, onClose }: { target: DetailTarget | null; label: (v: unknown) => string; onClose: () => void }) {
  const spec = target && specs[target.kind], row = target?.row ?? {}
  const empty = (v: unknown) => v === null || v === undefined || v === ''
  const value = ([key, , format]: Field) => {
    const v = row[key]
    if (empty(v)) return <span className="dd-empty">-</span>
    switch (format) {
      case 'chip': return <StatusChip code={v} label={label(v)} />
      case 'date': return fmtDate(v)
      case 'bool': return v ? '예' : '아니오'
      case 'pct': return <Box className="dd-pct"><LinearProgress variant="determinate" value={Number(v)} /><span>{v}%</span></Box>
      default: return String(v)
    }
  }
  return <Dialog open={!!target} onClose={onClose} fullWidth maxWidth="sm">
    {spec && <>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography className="dd-kicker">{spec.title}</Typography>
        <Typography className="dd-heading">{spec.heading(row)}</Typography>
        {spec.sub(row) && <Typography className="dd-sub">{spec.sub(row)}</Typography>}
      </DialogTitle>
      <DialogContent dividers>
        <Box className="dd-grid">
          {spec.fields.filter(f => f[2] !== 'long').map(f => <Box key={f[0]} className="dd-item"><span className="dd-label">{f[1]}</span><Box className="dd-value">{value(f)}</Box></Box>)}
        </Box>
        {spec.fields.filter(f => f[2] === 'long').map(f => <Box key={f[0]} className="dd-long"><span className="dd-label">{f[1]}</span><Typography className="dd-text">{empty(row[f[0]]) ? '-' : String(row[f[0]])}</Typography></Box>)}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>닫기</Button></DialogActions>
    </>}
  </Dialog>
}
