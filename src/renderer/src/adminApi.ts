import { useCallback, useEffect, useState } from 'react'
import type { Result } from '../../shared/contracts'
import type { AdminChannel, AdminResponses } from '../../shared/admin'
export async function adminCall<C extends AdminChannel>(
  channel: C,
  payload: Record<string, unknown> = {}
): Promise<AdminResponses[C]> {
  const r = (await window.omnis.invoke(channel, payload)) as Result<
    AdminResponses[C]
  >
  if (!r.ok)
    throw Object.assign(new Error(r.error.message), { code: r.error.code })
  return r.data
}
export function useAdminQuery<C extends AdminChannel>(
  channel: C,
  payload: Record<string, unknown> = {}
) {
  const [data, setData] = useState<AdminResponses[C] | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0)
  const key = JSON.stringify(payload)
  const reload = useCallback(() => setRevision((v) => v + 1), [])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    adminCall(channel, JSON.parse(key))
      .then((r) => {
        if (active) setData(r)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [channel, key, revision])
  return { data, error, loading, reload }
}
