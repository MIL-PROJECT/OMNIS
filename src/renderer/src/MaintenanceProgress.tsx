import { Box, Tooltip, Typography } from '@mui/material'
import StatusChip from './StatusChip'
import { Paged } from './ui'

type Row = Record<string, any>
const TASK_ROW = 38 // style.css .dash .mp-task 높이와 맞춘다

// 상태 색은 StatusChip 의미와 맞춤 (완료=녹색, 진행=주황, 보류=적색, 계획=청색).
// validate_palette 통과: 녹↔주황 CVD ΔE 6.3 → 2px 간격 + 범례 수치로 보조 인코딩
const segments = [
  { code: 'COMPLETED', label: '완료', color: '#0ca30c' },
  { code: 'IN_PROGRESS', label: '진행', color: '#eda100' },
  { code: 'BLOCKED', label: '보류', color: '#d03b3b' },
  { code: 'PLANNED', label: '계획', color: '#2a78d6' }
]
const colorOf = (code: string) => segments.find(s => s.code === code)?.color ?? '#94a3b8'

export default function MaintenanceProgress({ status, active, onSelect }: { status: Row[]; active: Row[]; onSelect?: (row: Row) => void }) {
  const count = (code: string) => Number(status.find(r => r.status === code)?.n ?? 0)
  const total = segments.reduce((sum, s) => sum + count(s.code), 0)
  const done = count('COMPLETED'), canceled = count('CANCELED')
  const rate = total ? Math.round(done / total * 100) : 0
  const pct = (n: number) => total ? Math.round(n / total * 100) : 0

  return <Box className="mp">
    <Box className="mp-hero">
      <Box>
        <Typography className="mp-kicker">전체 완료율</Typography>
        <Typography className="mp-rate">{rate}<span>%</span></Typography>
      </Box>
      <Typography className="mp-sub">전체 {total}건 중 완료 {done}건{canceled > 0 && ` · 취소 ${canceled}건 제외`}</Typography>
    </Box>

    <Box className="mp-bar" role="img" aria-label={segments.map(s => `${s.label} ${count(s.code)}건`).join(', ')}>
      {segments.filter(s => count(s.code) > 0).map(s => <Tooltip key={s.code} arrow placement="top" title={`${s.label} · ${count(s.code)}건 (${pct(count(s.code))}%)`}>
        <Box className="mp-seg" sx={{ flexGrow: count(s.code), bgcolor: s.color }} />
      </Tooltip>)}
    </Box>

    <Box className="mp-legend">
      {segments.map(s => <Box key={s.code} className="mp-legend-item">
        <i style={{ background: s.color }} />{s.label}<strong>{count(s.code)}</strong><small>{pct(count(s.code))}%</small>
      </Box>)}
    </Box>

    <Typography className="mp-section">예정·진행 작업</Typography>
    {active.length ? <Paged rows={active} rowHeight={TASK_ROW}>{rows => rows.map(r => <Box key={r.id} className={onSelect ? 'mp-task clickable' : 'mp-task'} title={`${r.title} · 예정일 ${r.scheduled_date}`}
      role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} onClick={() => onSelect?.(r)}
      onKeyDown={e => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(r) } }}>
      <Box className="mp-task-head">
        <StatusChip code={r.status} label={segments.find(s => s.code === r.status)?.label ?? r.status} />
        <span className="mp-task-title">{r.title}</span>
        <span className="mp-task-no">{r.task_no}</span>
        <span className="mp-task-date">{String(r.scheduled_date).slice(5).replace('-', '.')}</span>
      </Box>
      <Box className="mp-task-track">
        <Box className="mp-track"><Box className="mp-fill" sx={{ width: `${r.progress}%`, bgcolor: colorOf(r.status) }} /></Box>
        <span className="mp-task-pct">{r.progress}%</span>
      </Box>
    </Box>)}</Paged> : <Typography color="text.secondary" variant="body2">진행 중인 작업이 없습니다.</Typography>}
  </Box>
}
