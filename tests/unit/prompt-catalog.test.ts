import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  promptCatalog,
  triageSchema,
  summarySchema,
  idsSchema,
  consoleMasterPrompt
} from '../../src/main/ai/PromptCatalog'
import {
  OpenAIProvider,
  type OpenAIClientLike
} from '../../src/main/ai/OpenAIProvider'
import {
  AnthropicProvider,
  type AnthropicClientLike
} from '../../src/main/ai/AnthropicProvider'
import { OllamaProvider } from '../../src/main/ai/OllamaProvider'
import type {
  AIProvider,
  DailyStatus,
  IncidentMatch,
  MaintenanceCandidate,
  ProviderResponse
} from '../../src/main/ai/AIProvider'

const root = resolve('docs/ai-prompts/v4')
const read = (name: string) =>
  JSON.parse(readFileSync(resolve(root, name), 'utf8'))
type Feature = keyof typeof promptCatalog
const scenarios: {
  feature: Feature
  run: (provider: AIProvider) => Promise<ProviderResponse<unknown>>
}[] = [
  {
    feature: 'triage',
    run: (p) => {
      const d = read('triage.input.json')
      return p.triageIncident(d.title, d.description, d.serviceImpact)
    }
  },
  {
    feature: 'dailySummary',
    run: (p) =>
      p.summarizeDailyStatus(read('dailySummary.input.json') as DailyStatus)
  },
  {
    feature: 'similarIncidents',
    run: (p) => {
      const d = read('similarIncidents.input.json')
      const candidates: IncidentMatch[] = d.candidates.map(
        (v: { id: string; title: string; status: string }) => ({
          ticket_no: v.id,
          title: v.title,
          status: v.status,
          action_summary: null
        })
      )
      return p.findSimilarIncidents(d.title, candidates)
    }
  },
  {
    feature: 'maintenancePriority',
    run: (p) => {
      const candidates: MaintenanceCandidate[] = read(
        'maintenancePriority.input.json'
      ).map(
        (v: {
          id: string
          title: string
          priority: string
          status: string
          scheduledDate: string
        }) => ({
          id: v.id,
          task_no: v.id,
          title: v.title,
          priority: v.priority,
          status: v.status,
          scheduled_date: v.scheduledDate
        })
      )
      return p.recommendMaintenance(candidates)
    }
  }
]
afterEach(() => vi.unstubAllGlobals())
describe('code-managed AI feature prompts', () => {
  it('exports the same prompt/schema and valid synthetic output contracts', () => {
    for (const [name, p] of Object.entries(promptCatalog)) {
      expect(readFileSync(resolve(root, `${name}.system.txt`), 'utf8')).toBe(
        p.system + '\n'
      )
      expect(read(`${name}.schema.json`)).toEqual(p.jsonSchema)
      const example = read(`${name}.expected-output.json`)
      expect(
        (name === 'triage'
          ? triageSchema
          : name === 'dailySummary'
            ? summarySchema
            : idsSchema
        ).safeParse(example).success
      ).toBe(true)
      expect(JSON.stringify(p.jsonSchema)).not.toContain('uniqueItems')
    }
    expect(
      readFileSync(resolve(root, 'OMNIS_CONSOLE_MASTER_PROMPT.txt'), 'utf8')
    ).toBe(consoleMasterPrompt + '\n')
  })
  for (const scenario of scenarios) {
    it(`routes OpenAI ${scenario.feature} to its own versioned structured prompt`, async () => {
      const definition = promptCatalog[scenario.feature],
        example = read(`${scenario.feature}.expected-output.json`)
      const create = vi
        .fn()
        .mockResolvedValue({
          status: 'completed',
          output_text: JSON.stringify(example),
          usage: { input_tokens: 100, output_tokens: 30 }
        })
      const provider = new OpenAIProvider('synthetic-key', 'test-model', 100, {
        responses: { create }
      } as OpenAIClientLike)
      const result = await scenario.run(provider),
        request = create.mock.calls[0][0]
      expect(request.instructions).toBe(definition.system)
      expect(request.store).toBe(false)
      expect(request.text.format).toMatchObject({
        type: 'json_schema',
        name: definition.schemaName,
        strict: true
      })
      expect(result.metadata.promptVersion).toBe(definition.version)
    })
    it(`routes Claude ${scenario.feature} to the same feature rules`, async () => {
      const definition = promptCatalog[scenario.feature],
        example = read(`${scenario.feature}.expected-output.json`)
      const create = vi
        .fn()
        .mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify(example) }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 30 }
        })
      const result = await scenario.run(
        new AnthropicProvider('synthetic-key', 'test-model', 100, {
          messages: { create }
        } as AnthropicClientLike)
      )
      expect(create.mock.calls[0][0].system).toBe(definition.system)
      expect(result.metadata.promptVersion).toBe(definition.version)
    })
    it(`preserves Ollama ${scenario.feature} with the feature-specific prompt`, async () => {
      const definition = promptCatalog[scenario.feature],
        example = read(`${scenario.feature}.expected-output.json`)
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ response: JSON.stringify(example) }))
        )
      vi.stubGlobal('fetch', fetch)
      const result = await scenario.run(
        new OllamaProvider('http://127.0.0.1:11434', 'test-model', 100)
      )
      expect(JSON.parse(fetch.mock.calls[0][1].body).prompt).toContain(
        definition.system
      )
      expect(result.metadata.promptVersion).toBe(definition.version)
    })
  }
})
