import { z } from 'zod'
import type { AIProvider, IncidentMatch, MaintenanceCandidate, Triage } from './AIProvider'

const triageSchema = z.object({ category: z.string().min(1).max(50), priority: z.enum(['URGENT','NORMAL']), confidence: z.number().min(0).max(1), recommendation: z.string().min(1).max(500) })
const summarySchema = z.object({ summary: z.string().min(1).max(1000) })
const idsSchema = z.object({ ticketNos: z.array(z.string()).max(5) })
export class OllamaProvider implements AIProvider {
  constructor(private endpoint: string, private model: string) {}
  private async generate<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`${this.endpoint}/api/generate`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ model:this.model, prompt, stream:false, format:'json' }), signal:controller.signal })
      if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`)
      const envelope = z.object({ response:z.string() }).parse(await response.json())
      return schema.parse(JSON.parse(envelope.response))
    } finally { clearTimeout(timeout) }
  }
  async triageIncident(title: string, description: string): Promise<Triage> { const result = await this.generate(`가상 정보통신 고장 접수만 분석. JSON: category, priority(URGENT|NORMAL), confidence(0-1), recommendation. 제목: ${title.slice(0,200)} 내용: ${description.slice(0,1000)}`,triageSchema); return { ...result, provider:'Ollama', label:'AI 추천' } }
  async summarizeDailyStatus(openCount: number): Promise<string> { const result = await this.generate(`가상 업무 현황을 한국어 한 문장으로 요약. JSON: summary. 미종결 고장: ${openCount}건. 다른 수치를 만들지 마세요.`,summarySchema); return result.summary }
  async recommendMaintenance(candidates: MaintenanceCandidate[]): Promise<MaintenanceCandidate[]> { const result = await this.generate(`가상 정비 작업의 우선순위를 추천. JSON: ticketNos 배열 최대 5개. 제공된 번호만 사용: ${JSON.stringify(candidates.map(c => ({ ticketNo:c.task_no,priority:c.priority,date:c.scheduled_date })))}`,idsSchema); return result.ticketNos.map(no => candidates.find(c => c.task_no === no)).filter((v):v is MaintenanceCandidate => !!v) }
  async findSimilarIncidents(title: string, candidates: IncidentMatch[]): Promise<IncidentMatch[]> { const result = await this.generate(`가상 고장 제목과 유사한 과거 건을 선택. JSON: ticketNos 배열 최대 5개. 새 제목: ${title.slice(0,200)}. 후보: ${JSON.stringify(candidates.map(c => ({ ticketNo:c.ticket_no,title:c.title })))}`,idsSchema); return result.ticketNos.map(no => candidates.find(c => c.ticket_no === no)).filter((v):v is IncidentMatch => !!v) }
}
