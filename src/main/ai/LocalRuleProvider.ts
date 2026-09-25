import type { AIProvider, IncidentMatch, MaintenanceCandidate, Triage } from './AIProvider'

export function triageIncident(title: string, description: string): Triage {
  const text = `${title} ${description}`.toLowerCase()
  const urgent = /중단|장애|불통|긴급|offline|down/.test(text)
  const category = /무선|위성/.test(text) ? '무선/위성' : /네트워크|전송/.test(text) ? '전송장비' : /보안|침입/.test(text) ? '사이버보호' : '기타'
  return { provider: 'Local Rule', category, priority: urgent ? 'URGENT' : 'NORMAL', confidence: urgent ? 0.74 : 0.58, recommendation: urgent ? '담당자 지정 후 즉시 현황을 확인하십시오.' : '영향 범위를 확인하고 계획에 따라 조치하십시오.', label: 'AI 추천' }
}
export class LocalRuleProvider implements AIProvider {
  async triageIncident(title: string, description: string): Promise<Triage> { return triageIncident(title,description) }
  async summarizeDailyStatus(openCount: number): Promise<string> { return `현재 미종결 고장 ${openCount}건입니다. 긴급 건을 먼저 확인하고 진행 중 정비 작업을 점검하십시오.` }
  async recommendMaintenance(candidates: MaintenanceCandidate[]): Promise<MaintenanceCandidate[]> { return [...candidates].sort((a,b) => (a.priority === 'HIGH' ? -1 : 0) - (b.priority === 'HIGH' ? -1 : 0) || a.scheduled_date.localeCompare(b.scheduled_date)).slice(0,5) }
  async findSimilarIncidents(_title: string, candidates: IncidentMatch[]): Promise<IncidentMatch[]> { return candidates.slice(0,5) }
}
