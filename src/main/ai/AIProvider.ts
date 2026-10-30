export const AI_PROVIDERS = ['LOCAL', 'OLLAMA', 'OPENAI', 'ANTHROPIC'] as const
export type AIProviderName = typeof AI_PROVIDERS[number]

export const DEFAULT_AI_MODELS = { LOCAL: 'rules-v3', OLLAMA: 'gemma3', OPENAI: 'gpt-6-luna', ANTHROPIC: 'claude-haiku-5-5' } as const

export type Triage = { category: string; priority: 'URGENT' | 'NORMAL'; confidence: number; recommendation: string; rationale: string; recommendedTeamCode: 'TEAM-WIRE' | 'TEAM-RADIO' | 'TEAM-CYBER'; estimatedMinutes: number; questions: string[]; label: 'AI 추천' }
export type IncidentMatch = { ticket_no: string; title: string; status: string; action_summary: string | null }
export type MaintenanceCandidate = { id: string; task_no: string; title: string; priority: string; status: string; scheduled_date: string }
export type DailyStatus = { openIncidents: number; urgentIncidents: number; activeMaintenance: number; delayedMaintenance: number; slaRiskCount: number; majorAlerts: string[] }
export type ProviderMetadata = { provider: AIProviderName; model: string; promptVersion: string; latencyMs: number; inputTokens: number | null; outputTokens: number | null; requestId: string | null; externalTransmission: boolean }
export type ProviderResponse<T> = { data: T; metadata: ProviderMetadata }
export type AIExecution<T> = ProviderResponse<T> & { fallbackUsed: boolean; selectedProvider: AIProviderName; errorCode: string | null; runId?: string }

export interface AIProvider {
  readonly name: AIProviderName
  readonly model: string
  readonly external: boolean
  triageIncident(title: string, description: string, serviceImpact?: string): Promise<ProviderResponse<Triage>>
  summarizeDailyStatus(status: DailyStatus): Promise<ProviderResponse<{ summary: string }>>
  recommendMaintenance(candidates: MaintenanceCandidate[]): Promise<ProviderResponse<MaintenanceCandidate[]>>
  findSimilarIncidents(title: string, candidates: IncidentMatch[]): Promise<ProviderResponse<IncidentMatch[]>>
}

export class AIProviderError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false, public readonly status?: number, public readonly retryAfterMs?: number) { super(message); this.name = 'AIProviderError' }
}
