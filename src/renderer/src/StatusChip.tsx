import { Chip } from '@mui/material'

// 소프트 알약 태그: 옅은 배경 + 같은 계열의 진한 글자 (style.css .tone-* 와 같은 값)
const green = { bg: '#e3f6ec', fg: '#1d8a52' }
const gray = { bg: '#eef0f5', fg: '#5c6275' }
const orange = { bg: '#fff0dd', fg: '#a8570b' }
const sky = { bg: '#e6effd', fg: '#2f55c9' }
const lavender = { bg: '#eceefb', fg: '#3f4bb0' }
const red = { bg: '#fde6ea', fg: '#c4323a' }
export const tonePalette = { green, gray, orange, sky, lavender, red }
const tones: Record<string, { bg: string; fg: string }> = {
  NORMAL: green, RESOLVED: green, COMPLETED: green,
  GENERAL: gray, CLOSED: gray, OFFLINE: gray,
  WATCH: orange, IN_PROGRESS: orange,
  INSPECTION: sky, RECEIVED: sky, NOTICE: sky, ASSIGNED: sky, PLANNED: sky,
  TRIAGED: lavender,
  FAULT: red, URGENT: red, CANCELED: red, BLOCKED: red
}

export const statusTone = (code: unknown): { bg: string; fg: string } =>
  tones[String(code)] ?? gray

// tone을 주면 코드와 무관하게 그 색을 쓴다 (예: 중요도 NORMAL=일반은 회색)
export default function StatusChip({ code, label, tone: override }: { code: unknown; label: string; tone?: keyof typeof tonePalette }) {
  const tone = override ? tonePalette[override] : statusTone(code)
  return (
    <Chip
      label={<><span className="chip-dot" style={{ background: tone.fg }} />{label}</>}
      size="small"
      sx={{
        bgcolor: tone.bg,
        color: tone.fg,
        fontWeight: 600,
        height: 22,
        fontSize: 11.5,
        borderRadius: '999px',
        '& .MuiChip-label': { px: 1.2 }
      }}
    />
  )
}
