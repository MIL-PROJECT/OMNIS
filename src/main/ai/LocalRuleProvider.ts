import type { AIProvider, DailyStatus, IncidentMatch, MaintenanceCandidate, ProviderResponse, Triage } from './AIProvider'
import { DEFAULT_AI_MODELS } from './AIProvider'

const wrap = <T>(data: T, started: number, promptVersion: string): ProviderResponse<T> => ({ data, metadata: { provider: 'LOCAL', model: DEFAULT_AI_MODELS.LOCAL, promptVersion, latencyMs: Date.now() - started, inputTokens: null, outputTokens: null, requestId: null, externalTransmission: false } })

export function triageIncident(title: string, description: string, serviceImpact = ''): Triage {
  const text = `${title} ${description} ${serviceImpact}`.toLowerCase()
  const urgent = /중단|장애|불통|긴급|offline|down/.test(text)
  const category = /무선|위성/.test(text) ? '무선/위성' : /네트워크|전송/.test(text) ? '전송장비' : /보안|침입/.test(text) ? '사이버보호' : '기타'
  const recommendedTeamCode = category === '무선/위성' ? 'TEAM-RADIO' : category === '사이버보호' ? 'TEAM-CYBER' : 'TEAM-WIRE'
  return { category, priority: urgent ? 'URGENT' : 'NORMAL', confidence: urgent ? 0.78 : 0.62, recommendation: urgent ? '담당 정비반을 즉시 지정하고 서비스 영향과 원격조치 가능 여부를 확인하십시오.' : '영향 범위를 확인하고 계획에 따라 조치하십시오.', rationale: urgent ? '중단·불통·긴급 키워드와 서비스 영향 표현이 탐지되었습니다.' : '즉시 중단을 의미하는 표현이 없어 일반 우선순위로 판단했습니다.', recommendedTeamCode, estimatedMinutes: urgent ? 60 : 240, questions: serviceImpact.trim() ? ['원격조치가 가능한지 확인하십시오.'] : ['서비스 영향 범위를 입력하십시오.', '원격조치가 가능한지 확인하십시오.'], label: 'AI 추천' }
}
export class LocalRuleProvider implements AIProvider {
  readonly name = 'LOCAL' as const
  readonly model = DEFAULT_AI_MODELS.LOCAL
  readonly external = false
  async triageIncident(title: string, description: string, serviceImpact?: string): Promise<ProviderResponse<Triage>> { const started = Date.now(); return wrap(triageIncident(title,description,serviceImpact),started,'triage-v3') }
  async summarizeDailyStatus(status: DailyStatus): Promise<ProviderResponse<{ summary: string }>> { const started = Date.now(); return wrap({ summary:`현재 미종결 고장 ${status.openIncidents}건, 긴급 ${status.urgentIncidents}건, 진행 중 정비 ${status.activeMaintenance}건, 지연 ${status.delayedMaintenance}건, SLA 위험 ${status.slaRiskCount}건입니다.` },started,'daily-summary-v3') }
  async recommendMaintenance(candidates: MaintenanceCandidate[]): Promise<ProviderResponse<MaintenanceCandidate[]>> { const started=Date.now(); return wrap([...candidates].sort((a,b) => (a.priority === 'HIGH' ? -1 : 0) - (b.priority === 'HIGH' ? -1 : 0) || a.scheduled_date.localeCompare(b.scheduled_date)).slice(0,5),started,'maintenance-rank-v3') }
  async findSimilarIncidents(_title: string, candidates: IncidentMatch[]): Promise<ProviderResponse<IncidentMatch[]>> { const started=Date.now(); return wrap(candidates.slice(0,5),started,'similar-incidents-v3') }
}
