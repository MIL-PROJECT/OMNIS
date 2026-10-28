import type { Channel, Result } from '../../shared/contracts'

export async function invoke<T>(
  channel: Channel,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const r = (await window.omnis.invoke(channel, payload)) as Result<T>
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}
