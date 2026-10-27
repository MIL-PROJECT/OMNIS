import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Box, IconButton, InputAdornment, Pagination, TextField, Tooltip, Typography } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import { koreaDateTime } from '../../shared/date'
import SearchRounded from '@mui/icons-material/SearchRounded'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'

// 화면 공통 구성요소 — 스타일은 style.css의 ui-* 클래스

export type Tone = 'green' | 'gray' | 'orange' | 'sky' | 'lavender' | 'red'

export function PageHeader({ section, title, description, actions }: { section: string; title: string; description?: string; actions?: ReactNode }) {
  return <Box className="ui-page-header">
    <Box sx={{ minWidth: 0 }}>
      <span className="ui-eyebrow">{section}</span>
      <h1>{title}</h1>
      {description && <p className="ui-page-desc">{description}</p>}
    </Box>
    {actions && <Box className="ui-page-actions">{actions}</Box>}
  </Box>
}

export function Card({ icon: Icon, tone = 'gray', title, subtitle, action, children, className = '' }: { icon?: SvgIconComponent; tone?: Tone; title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ui-card ${className}`}>
    <header className="panel-head ui-card-head">
      <Box className="ui-card-title">
        {Icon && <span className={`ui-icon-tile tone-${tone}`}><Icon /></span>}
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2">{title}</Typography>
          {subtitle && <span className="ui-card-sub">{subtitle}</span>}
        </Box>
      </Box>
      {action && <Box className="ui-card-action">{action}</Box>}
    </header>
    {children}
  </section>
}

// 상태별 건수 필터 — value ''는 전체
export function StatusFilter({ items, value, onChange, total }: { items: { value: string; label: string; count: number; tone: Tone }[]; value: string; onChange: (v: string) => void; total: number }) {
  return <Box className="ui-filter" role="radiogroup" aria-label="상태 필터">
    <button type="button" role="radio" aria-checked={value === ''} className={value === '' ? 'on' : ''} onClick={() => onChange('')}>전체<b>{total}</b></button>
    {items.map(i => <button type="button" role="radio" aria-checked={value === i.value} key={i.value} className={value === i.value ? 'on' : ''} onClick={() => onChange(value === i.value ? '' : i.value)}>
      <i className={`dot tone-${i.tone}`} />{i.label}<b>{i.count}</b>
    </button>)}
  </Box>
}

export function SearchField({ value, onChange, placeholder = '검색' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <TextField className="ui-search" size="small" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
    slotProps={{ htmlInput: { 'aria-label': '검색' }, input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
}

// 표의 행 작업 버튼 — aria-label이 곧 버튼 이름(상세/수정/삭제)
export function RowActions({ onView, onEdit, onDelete }: { onView?: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const btn = (label: string, Icon: SvgIconComponent, onClick: () => void, danger = false) =>
    <Tooltip title={label} key={label}><IconButton size="small" aria-label={label} className={danger ? 'ui-row-btn danger' : 'ui-row-btn'} onClick={e => { e.stopPropagation(); onClick() }}><Icon /></IconButton></Tooltip>
  return <Box className="ui-row-actions">
    {onView && btn('상세', VisibilityOutlined, onView)}
    {onEdit && btn('수정', EditOutlined, onEdit)}
    {onDelete && btn('삭제', DeleteOutlineRounded, onDelete, true)}
  </Box>
}

// 남은 세로 공간에 들어가는 만큼만 행을 보여주고 나머지는 페이지로 넘긴다.
// 본문 높이는 부모(flex) 레이아웃이 정하므로 내용과 무관하게 측정된다. reserved: 표 머리글 등 고정 높이
export function Paged<T>({ rows, rowHeight, reserved = 0, unit = '건', children }: { rows: T[]; rowHeight: number; reserved?: number; unit?: string; children: (pageRows: T[]) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0), [page, setPage] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => setSize(Math.max(1, Math.floor((el.clientHeight - reserved) / rowHeight)))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [rowHeight, reserved])
  const pages = size ? Math.max(1, Math.ceil(rows.length / size)) : 1
  const cur = Math.min(page, pages), start = (cur - 1) * size
  return <Box className="ui-paged">
    <Box ref={ref} className="ui-paged-body">{size > 0 && children(rows.slice(start, start + size))}</Box>
    <Box className="ui-pager">
      <span>{rows.length ? `${start + 1}–${Math.min(start + size, rows.length)}` : 0} / {rows.length}{unit}</span>
      <Pagination size="small" count={pages} page={cur} onChange={(_, p) => setPage(p)} siblingCount={0} boundaryCount={1} disabled={pages < 2} showFirstButton showLastButton />
    </Box>
  </Box>
}

// 앱 대표 로고: 날개 + 별의 단색 라인 엠블럼 (공식 휘장이 아닌 자체 도안). 색은 CSS color를 따른다
export function BrandEmblem({ width = 34 }: { width?: number }) {
  const wing = <path d="M15.5 11 4 7.5M15.5 14 6 13M16 17 9 18.5" />
  return <svg viewBox="0 0 48 28" width={width} height={width * 28 / 48} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    {wing}
    <g transform="translate(48 0) scale(-1 1)">{wing}</g>
    <circle cx="24" cy="14" r="6.3" strokeWidth="1.8" />
    <path d="M24 10.4 24.85 12.83 27.42 12.89 25.38 14.45 26.12 16.91 24 15.45 21.88 16.91 22.62 14.45 20.58 12.89 23.15 12.83Z" fill="currentColor" stroke="none" />
  </svg>
}

// 표 안의 작은 진행 막대
export function Meter({ value, tone = 'sky', suffix = '%' }: { value: number; tone?: Tone; suffix?: string }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return <Box className="ui-meter"><span className="ui-meter-track"><span className={`ui-meter-fill tone-${tone}`} style={{ width: `${v}%` }} /></span><span className="ui-meter-val">{value}{suffix}</span></Box>
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: SvgIconComponent; title: string; description?: string; action?: ReactNode }) {
  return <Box className="ui-empty">
    <span className="ui-empty-icon"><Icon /></span>
    <strong>{title}</strong>
    {description && <span>{description}</span>}
    {action}
  </Box>
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const tones: Tone[] = ['sky', 'lavender', 'green', 'orange', 'red']
  const tone = tones[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % tones.length]
  // 작은 아바타는 성 한 글자, 큰 아바타는 이름 두 글자
  const text = size >= 32 ? name.slice(-2) : name.slice(0, 1)
  return <span className={`ui-avatar tone-${tone}`} style={{ width: size, height: size, fontSize: size >= 32 ? size * .34 : size * .5 }} aria-hidden>{text}</span>
}

export const fmtDateTime = (v: unknown) => koreaDateTime(v)
export const fmtShort = (v: unknown) => { const full=koreaDateTime(v); return full === '-' ? full : full.slice(5).replace('-','.') }
export const weekday = (d: string) => ['일', '월', '화', '수', '목', '금', '토'][new Date(`${d}T00:00:00`).getDay()]
export const countBy = (rows: Record<string, any>[], key: string) => rows.reduce<Record<string, number>>((m, r) => { m[r[key]] = (m[r[key]] ?? 0) + 1; return m }, {})
