import OpenAI from 'openai'
import type { AIProvider, DailyStatus, IncidentMatch, MaintenanceCandidate, ProviderResponse, Triage } from './AIProvider'
import { AIProviderError } from './AIProvider'
import { externalDailyInput, externalIncidentCandidates, externalMaintenanceCandidates, externalTriageInput, selectCandidateIds } from './ExternalDataGuard'
import { idsSchema, promptCatalog, summarySchema, triageSchema, type PromptDefinition } from './PromptCatalog'
import { assertSummaryNumbers, parseJson, safeProviderError } from './ProviderSupport'

export interface OpenAIResponseLike { output_text:string; status?:string; incomplete_details?:unknown; output?:Array<{content?:Array<{type:string}>}>; usage?:{input_tokens?:number;output_tokens?:number}; _request_id?:string|null }
export interface OpenAIClientLike { responses:{ create(params:unknown):Promise<OpenAIResponseLike> } }

export class OpenAIProvider implements AIProvider {
  readonly name='OPENAI' as const
  readonly external=true
  private client:OpenAIClientLike
  constructor(apiKey:string,readonly model:string,timeoutMs:number,client?:OpenAIClientLike){ this.client=client??new OpenAI({apiKey,maxRetries:0,timeout:timeoutMs}) as unknown as OpenAIClientLike }
  private async generate<T>(definition:PromptDefinition,input:unknown,parser:{parse(value:unknown):T}):Promise<ProviderResponse<T>> {
    const started=Date.now()
    try {
      const response=await this.client.responses.create({model:this.model,store:false,instructions:definition.system,input:`<business_data>${JSON.stringify(input)}</business_data>`,reasoning:{effort:'low'},max_output_tokens:definition.maxOutputTokens,text:{format:{type:'json_schema',name:definition.schemaName,strict:true,schema:definition.jsonSchema}}})
      if(response.status==='incomplete')throw new AIProviderError('INCOMPLETE','외부 AI 응답이 완성되지 않았습니다.')
      if(response.output?.some(item=>item.content?.some(part=>part.type==='refusal')))throw new AIProviderError('REFUSAL','외부 AI가 요청 처리를 거부했습니다.')
      const data=parseJson(response.output_text,parser)
      return {data,metadata:{provider:'OPENAI',model:this.model,promptVersion:definition.version,latencyMs:Date.now()-started,inputTokens:response.usage?.input_tokens??null,outputTokens:response.usage?.output_tokens??null,requestId:response._request_id??null,externalTransmission:true}}
    } catch(error){throw safeProviderError(error)}
  }
  async triageIncident(title:string,description:string,serviceImpact=''):Promise<ProviderResponse<Triage>> { const result=await this.generate(promptCatalog.triage,externalTriageInput(title,description,serviceImpact),triageSchema); return {...result,data:{...result.data,label:'AI 추천'}} }
  async summarizeDailyStatus(status:DailyStatus):Promise<ProviderResponse<{summary:string}>> { const result=await this.generate(promptCatalog.dailySummary,externalDailyInput(status),summarySchema); assertSummaryNumbers(result.data.summary,status); return result }
  async recommendMaintenance(candidates:MaintenanceCandidate[]):Promise<ProviderResponse<MaintenanceCandidate[]>> { const result=await this.generate(promptCatalog.maintenancePriority,externalMaintenanceCandidates(candidates),idsSchema); return {...result,data:selectCandidateIds(result.data.ids,candidates,c=>c.task_no)} }
  async findSimilarIncidents(title:string,candidates:IncidentMatch[]):Promise<ProviderResponse<IncidentMatch[]>> { const result=await this.generate(promptCatalog.similarIncidents,externalIncidentCandidates(title,candidates),idsSchema); return {...result,data:selectCandidateIds(result.data.ids,candidates,c=>c.ticket_no)} }
}
