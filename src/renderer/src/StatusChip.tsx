import { Chip } from '@mui/material'

const tones: Record<string, { bg: string; fg: string }> = {
  NORMAL: { bg: '#DCFCE7', fg: '#15803D' },
  RESOLVED: { bg: '#DCFCE7', fg: '#15803D' },
  COMPLETED: { bg: '#DCFCE7', fg: '#15803D' },
  GENERAL: { bg: '#F1F5F9', fg: '#475569' },
  CLOSED: { bg: '#F1F5F9', fg: '#475569' },
  OFFLINE: { bg: '#F1F5F9', fg: '#475569' },
  WATCH: { bg: '#FEF3C7', fg: '#B45309' },
  IN_PROGRESS: { bg: '#FEF3C7', fg: '#B45309' },
  INSPECTION: { bg: '#DBEAFE', fg: '#1D4ED8' },
  RECEIVED: { bg: '#DBEAFE', fg: '#1D4ED8' },
  NOTICE: { bg: '#DBEAFE', fg: '#1D4ED8' },
  TRIAGED: { bg: '#EDE9FE', fg: '#6D28D9' },
  ASSIGNED: { bg: '#E0F2FE', fg: '#0369A1' },
  PLANNED: { bg: '#E0F2FE', fg: '#0369A1' },
  FAULT: { bg: '#FEE2E2', fg: '#B91C1C' },
  URGENT: { bg: '#FEE2E2', fg: '#B91C1C' },
  CANCELED: { bg: '#FEE2E2', fg: '#B91C1C' },
  BLOCKED: { bg: '#FEE2E2', fg: '#B91C1C' }
}

export const statusTone = (code: unknown): { bg: string; fg: string } =>
  tones[String(code)] ?? { bg: '#F1F5F9', fg: '#475569' }

export default function StatusChip({ code, label }: { code: unknown; label: string }) {
  const tone = statusTone(code)
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: tone.bg,
        color: tone.fg,
        fontWeight: 700,
        height: 24,
        fontSize: 12,
        '& .MuiChip-label': { px: 1.1 }
      }}
    />
  )
}
