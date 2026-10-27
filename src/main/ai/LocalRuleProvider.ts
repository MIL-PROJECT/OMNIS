import type { AIProvider, IncidentMatch, MaintenanceCandidate, Triage } from './AIProvider'

export function triageIncident(title: string, description: string, serviceImpact = ''): Triage {
  const text = `${title} ${description} ${serviceImpact}`.toLowerCase()
  const urgent = /중단|장애|불통|긴급|offline|down/.test(text)
  const category = /무선|위성/.test(text) ? '무선/위성' : /네트워크|전송/.test(text) ? '전송장비' : /보안|침입/.test(text) ? '사이버보호' : '기타'
  const recommendedTeamCode = category === '무선/위성' ? 'TEAM-RADIO' : category === '사이버보호' ? 'TEAM-CYBER' : 'TEAM-WIRE'
  return { provider: 'Local Rule', category, priority: urgent ? 'URGENT' : 'NORMAL', confidence: urgent ? 0.78 : 0.62, recommendation: urgent ? '담당 정비반을 즉시 지정하고 서비스 영향과 원격조치 가능 여부를 확인하십시오.' : '영향 범위를 확인하고 계획에 따라 조치하십시오.', rationale: urgent ? '중단·불통·긴급 키워드와 서비스 영향 표현이 탐지되었습니다.' : '즉시 중단을 의미하는 표현이 없어 일반 우선순위로 판단했습니다.', recommendedTeamCode, estimatedMinutes: urgent ? 60 : 240, questions: serviceImpact.trim() ? ['원격조치가 가능한지 확인하십시오.'] : ['서비스 영향 범위를 입력하십시오.', '원격조치가 가능한지 확인하십시오.'], label: 'AI 추천' }
}
export class LocalRuleProvider implements AIProvider {
  async triageIncident(title: string, description: string, serviceImpact?: string): Promise<Triage> { return triageIncident(title,description,serviceImpact) }
  async summarizeDailyStatus(openCount: number): Promise<string> { return `현재 미종결 고장 ${openCount}건입니다. 긴급 건을 먼저 확인하고 진행 중 정비 작업을 점검하십시오.` }
  async recommendMaintenance(candidates: MaintenanceCandidate[]): Promise<MaintenanceCandidate[]> { return [...candidates].sort((a,b) => (a.priority === 'HIGH' ? -1 : 0) - (b.priority === 'HIGH' ? -1 : 0) || a.scheduled_date.localeCompare(b.scheduled_date)).slice(0,5) }
  async findSimilarIncidents(_title: string, candidates: IncidentMatch[]): Promise<IncidentMatch[]> { return candidates.slice(0,5) }
}
