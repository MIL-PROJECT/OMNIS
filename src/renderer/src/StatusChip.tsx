import type { CSSProperties } from 'react'

// 상태 배지: 흰 알약 + 가는 테두리 + 색 점(은은한 후광). 색은 점에만 쓰고 글자는 중립색으로 두어
// 표가 차분하게 읽히게 한다. 긴급·장애·보류(red)만 글자에도 색을 준다.
// bg/fg는 달력 이벤트 등 면 채색용 (style.css .tone-* 와 같은 값)
const green = { bg: '#e3f6ec', fg: '#1d8a52', dot: '#22b573' }
const gray = { bg: '#eef0f5', fg: '#5c6275', dot: '#a3a9b8' }
const orange = { bg: '#fff0dd', fg: '#a8570b', dot: '#f29f33' }
const sky = { bg: '#e6effd', fg: '#2f55c9', dot: '#4a6cf7' }
const lavender = { bg: '#eceefb', fg: '#3f4bb0', dot: '#8b7cf0' }
const red = { bg: '#fde6ea', fg: '#c4323a', dot: '#e5484d' }
export const tonePalette = { green, gray, orange, sky, lavender, red }
type ToneColors = typeof green
const tones: Record<string, ToneColors> = {
  NORMAL: green, RESOLVED: green, COMPLETED: green,
  GENERAL: gray, CLOSED: gray, OFFLINE: gray, CANCELED: gray,
  WATCH: orange, IN_PROGRESS: orange,
  INSPECTION: sky, RECEIVED: sky, NOTICE: sky, ASSIGNED: sky, PLANNED: sky,
  TRIAGED: lavender,
  FAULT: red, URGENT: red, BLOCKED: red
}

export const statusTone = (code: unknown): ToneColors => tones[String(code)] ?? gray

// tone을 주면 코드와 무관하게 그 색을 쓴다 (예: 중요도 NORMAL=일반은 회색)
export default function StatusChip({ code, label, tone: override }: { code: unknown; label: string; tone?: keyof typeof tonePalette }) {
  const tone = override ? tonePalette[override] : statusTone(code)
  const alert = tone === red
  return <span className={alert ? 'status-pill alert' : 'status-pill'} style={{ '--dot': tone.dot } as CSSProperties}>
    <i aria-hidden />{label}
  </span>
}
