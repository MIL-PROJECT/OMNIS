import { Chip } from '@mui/material'

// Notion 태그 스타일: card-tint 배경 + 같은 계열의 진한 글자
const green = { bg: '#d9f3e1', fg: '#1c6b33' }
const gray = { bg: '#f0eeec', fg: '#5d5b54' }
const orange = { bg: '#ffe8d4', fg: '#793400' }
const sky = { bg: '#dcecfa', fg: '#005bab' }
const lavender = { bg: '#e6e0f5', fg: '#391c57' }
const red = { bg: '#fde4e4', fg: '#b42323' }
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

export default function StatusChip({ code, label }: { code: unknown; label: string }) {
  const tone = statusTone(code)
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: tone.bg,
        color: tone.fg,
        fontWeight: 600,
        height: 24,
        fontSize: 12,
        '& .MuiChip-label': { px: 1.1 }
      }}
    />
  )
}
