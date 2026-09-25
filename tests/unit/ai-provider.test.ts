import { describe, expect, it, vi } from 'vitest'
import { OllamaProvider } from '../../src/main/ai/OllamaProvider'
import { schemas } from '../../src/shared/contracts'

describe('AI provider safety', () => {
  it('accepts valid structured local Ollama output', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: JSON.stringify({ category:'무선/위성',priority:'URGENT',confidence:.8,recommendation:'담당자 확인' }) }) })
    vi.stubGlobal('fetch',request)
    const result = await new OllamaProvider('http://127.0.0.1:11434','gemma3').triageIncident('가상 장애','무선 중단')
    expect(result.priority).toBe('URGENT')
    expect(result.provider).toBe('Ollama')
    expect(request.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/generate')
    vi.unstubAllGlobals()
  })
  it('rejects invalid model output and non-loopback endpoints', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: JSON.stringify({ category:'x',priority:'CRITICAL',confidence:2,recommendation:'x' }) }) }))
    await expect(new OllamaProvider('http://127.0.0.1:11434','gemma3').triageIncident('x','x')).rejects.toThrow()
    expect(schemas['system:setAiSettings'].safeParse({ provider:'OLLAMA',endpoint:'https://example.com/',model:'gemma3' }).success).toBe(false)
    vi.unstubAllGlobals()
  })
})
