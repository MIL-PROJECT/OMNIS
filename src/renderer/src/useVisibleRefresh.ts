import { useCallback, useEffect, useRef, useState } from 'react'

// One request at a time. An invalidation during a request discards that response
// and schedules one fresh read, including when several events arrive together.
export function useVisibleRefresh<T>(query:()=>Promise<T>,enabled=true,scopeKey='') {
  const [data,setData] = useState<T|null>(null)
  const [error,setError] = useState<string|null>(null)
  const [pending,setPending] = useState(false)
  const [updatedAt,setUpdatedAt] = useState<Date|null>(null)
  const refreshRef = useRef<()=>void>(()=>{})
  const refresh = useCallback(()=>refreshRef.current(),[])
  useEffect(()=>{
    setData(null);setError(null);setUpdatedAt(null);setPending(false)
    if (!enabled) return
    let active=true,inFlight=false,queued=false,queuedForce=false,revision=0
    const visible=()=>document.visibilityState!=='hidden'
    const run=async()=>{
      const ticket=revision
      inFlight=true;setPending(true)
      try {
        const value=await query()
        if(active&&ticket===revision){setData(value);setError(null);setUpdatedAt(new Date())}
      } catch(cause) {
        if(active&&ticket===revision)setError(cause instanceof Error ? cause.message : '조회하지 못했습니다.')
      } finally {
        inFlight=false
        if(active){
          if(queued&&(queuedForce||visible())){queued=false;queuedForce=false;void run()}
          else {queued=false;queuedForce=false;setPending(false)}
        }
      }
    }
    const request=(force=false)=>{
      revision++
      if(!force&&!visible()){queued=false;queuedForce=false;return}
      if(inFlight){queued=true;queuedForce ||= force;return}
      void run()
    }
    refreshRef.current=()=>request(true)
    const invalidate=()=>request()
    const timer=window.setInterval(()=>{if(!inFlight)request()},30_000)
    const unsubscribe=window.omnis.onSituationAlertsChanged(invalidate)
    window.addEventListener('focus',invalidate)
    document.addEventListener('visibilitychange',invalidate)
    request()
    return()=>{
      active=false;refreshRef.current=()=>{}
      clearInterval(timer);unsubscribe()
      window.removeEventListener('focus',invalidate)
      document.removeEventListener('visibilitychange',invalidate)
    }
  },[query,enabled,scopeKey])
  return {data,error,pending,updatedAt,refresh}
}
