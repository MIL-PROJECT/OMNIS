export type Triage = { provider: string; category: string; priority: 'URGENT' | 'NORMAL'; confidence: number; recommendation: string; label: 'AI 추천'; fallbackUsed?: boolean }
export type IncidentMatch = { ticket_no: string; title: string; status: string; action_summary: string | null }
export type MaintenanceCandidate = { id: string; task_no: string; title: string; priority: string; status: string; scheduled_date: string }
export interface AIProvider {
  triageIncident(title: string, description: string): Promise<Triage>
  summarizeDailyStatus(openCount: number): Promise<string>
  recommendMaintenance(candidates: MaintenanceCandidate[]): Promise<MaintenanceCandidate[]>
  findSimilarIncidents(title: string, candidates: IncidentMatch[]): Promise<IncidentMatch[]>
}
