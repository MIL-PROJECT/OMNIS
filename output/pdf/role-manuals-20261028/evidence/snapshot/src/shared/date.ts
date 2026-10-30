export function koreaDate(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US',{ timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part=>part.type===type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function koreaDateTime(value: unknown): string {
  if (!value) return '-'
  const parsed = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0,16).replace('T',' ')
  const parts = new Intl.DateTimeFormat('en-US',{ timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(parsed)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part=>part.type===type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

export function koreaDateTimeInput(value: unknown = new Date()): string {
  return koreaDateTime(value).replace(' ','T')
}
