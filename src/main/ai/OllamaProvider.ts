import { z } from 'zod'
import type { AIProvider, DailyStatus, IncidentMatch, MaintenanceCandidate, ProviderResponse, Triage } from './AIProvider'
import { AIProviderError } from './AIProvider'
import { externalDailyInput, externalIncidentCandidates, externalMaintenanceCandidates, externalTriageInput, selectCandidateIds } from './ExternalDataGuard'
import { idsSchema, promptCatalog, summarySchema, triageSchema } from './PromptCatalog'
import { parseJson, safeProviderError } from './ProviderSupport'

export class OllamaProvider implements AIProvider {
  readonly name = 'OLLAMA' as const
  readonly external = false
  constructor(private endpoint:string,readonly model:string,private timeoutMs=15000) {}
  private async generate<T>(prompt:string,schema:z.ZodType<T>,promptVersion:string):Promise<ProviderResponse<T>> {
    const started=Date.now(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.timeoutMs)
    try {
      const response=await fetch(`${this.endpoint}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:this.model,prompt,stream:false,format:'json'}),signal:controller.signal})
      if(!response.ok)throw new AIProviderError(`HTTP_${response.status}`,'Ollama 응답 오류',response.status===408||response.status===429||response.status>=500,response.status)
      const envelope=z.object({response:z.string(),prompt_eval_count:z.number().optional(),eval_count:z.number().optional()}).parse(await response.json())
      return {data:parseJson(envelope.response,schema),metadata:{provider:'OLLAMA',model:this.model,promptVersion,latencyMs:Date.now()-started,inputTokens:envelope.prompt_eval_count??null,outputTokens:envelope.eval_count??null,requestId:null,externalTransmission:false}}
    } catch(error){throw safeProviderError(error)} finally{clearTimeout(timeout)}
  }
  async triageIncident(title:string,description:string,serviceImpact=''):Promise<ProviderResponse<Triage>> { const p=promptCatalog.triage,input=externalTriageInput(title,description,serviceImpact); const result=await this.generate(`${p.system}\n<business_data>${JSON.stringify(input)}</business_data>`,triageSchema,p.version); return {...result,data:{...result.data,label:'AI 추천'}} }
  async summarizeDailyStatus(status:DailyStatus):Promise<ProviderResponse<{summary:string}>> { const p=promptCatalog.dailySummary; return this.generate(`${p.system}\n<business_data>${JSON.stringify(externalDailyInput(status))}</business_data>`,summarySchema,p.version) }
  async recommendMaintenance(candidates:MaintenanceCandidate[]):Promise<ProviderResponse<MaintenanceCandidate[]>> { const p=promptCatalog.candidateRanking,result=await this.generate(`${p.system}\n<business_data>${JSON.stringify(externalMaintenanceCandidates(candidates))}</business_data>`,idsSchema,p.version); return {...result,data:selectCandidateIds(result.data.ids,candidates,c=>c.task_no)} }
  async findSimilarIncidents(title:string,candidates:IncidentMatch[]):Promise<ProviderResponse<IncidentMatch[]>> { const p=promptCatalog.candidateRanking,result=await this.generate(`${p.system}\n<business_data>${JSON.stringify(externalIncidentCandidates(title,candidates))}</business_data>`,idsSchema,p.version); return {...result,data:selectCandidateIds(result.data.ids,candidates,c=>c.ticket_no)} }
}
