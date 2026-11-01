// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisibleRefresh } from '../../src/renderer/src/useVisibleRefresh'

function deferred<T>() {
  let resolve!:(value:T)=>void
  const promise=new Promise<T>(done=>{resolve=done})
  return {promise,resolve}
}
describe('visible situation refresh lifecycle',()=>{
  let emit:()=>void,unsubscribe:ReturnType<typeof vi.fn>,visibility:DocumentVisibilityState
  beforeEach(()=>{
    vi.useFakeTimers();visibility='visible';unsubscribe=vi.fn();emit=()=>{}
    vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility)
    Object.defineProperty(window,'omnis',{configurable:true,value:{onSituationAlertsChanged:(callback:()=>void)=>{emit=callback;return unsubscribe}}})
  })
  afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers()})
  it('coalesces invalidations and discards an older in-flight response',async()=>{
    const first=deferred<number>(),second=deferred<number>(),query=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const {result}=renderHook(()=>useVisibleRefresh<number>(query))
    act(()=>vi.advanceTimersByTime(60_000))
    expect(query).toHaveBeenCalledTimes(1)
    act(()=>{emit();emit();result.current.refresh()})
    expect(query).toHaveBeenCalledTimes(1)
    await act(async()=>{first.resolve(1)})
    expect(result.current.data).toBeNull();expect(query).toHaveBeenCalledTimes(2)
    await act(async()=>{second.resolve(2)})
    expect(result.current.data).toBe(2);expect(result.current.pending).toBe(false)
  })
  it('pauses hidden reads, keeps last good data on failure, recovers on focus and removes subscriptions',async()=>{
    const query=vi.fn().mockResolvedValue(42)
    const {result,unmount}=renderHook(()=>useVisibleRefresh<number>(query))
    await act(async()=>{})
    expect(result.current.data).toBe(42)
    act(()=>{visibility='hidden';document.dispatchEvent(new Event('visibilitychange'));vi.advanceTimersByTime(60_000);emit()})
    expect(query).toHaveBeenCalledTimes(1)
    query.mockRejectedValueOnce(new Error('offline'))
    await act(async()=>{visibility='visible';document.dispatchEvent(new Event('visibilitychange'))})
    expect(result.current.data).toBe(42);expect(result.current.error).toBe('offline')
    query.mockResolvedValue(43)
    await act(async()=>{window.dispatchEvent(new Event('focus'))})
    expect(result.current.data).toBe(43);expect(result.current.error).toBeNull()
    unmount();expect(unsubscribe).toHaveBeenCalledOnce()
    const calls=query.mock.calls.length
    act(()=>{vi.advanceTimersByTime(60_000);window.dispatchEvent(new Event('focus'))})
    expect(query).toHaveBeenCalledTimes(calls)
  })
  it('does not fetch closed panels and clears old data when the scope changes',async()=>{
    const query=vi.fn().mockResolvedValue(1)
    const {result,rerender}=renderHook(({enabled,scope})=>useVisibleRefresh<number>(query,enabled,scope),{initialProps:{enabled:false,scope:'first'}})
    expect(query).not.toHaveBeenCalled()
    await act(async()=>{rerender({enabled:true,scope:'first'})})
    expect(result.current.data).toBe(1)
    const next=deferred<number>();query.mockReturnValue(next.promise)
    act(()=>{rerender({enabled:true,scope:'second'})})
    expect(result.current.data).toBeNull()
    await act(async()=>{next.resolve(2)})
    expect(result.current.data).toBe(2)
    act(()=>rerender({enabled:false,scope:'second'}))
    expect(result.current.data).toBeNull()
  })
})
