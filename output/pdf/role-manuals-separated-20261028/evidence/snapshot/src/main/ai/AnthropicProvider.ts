import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, DailyStatus, IncidentMatch, MaintenanceCandidate, ProviderResponse, Triage } from './AIProvider'
import { AIProviderError } from './AIProvider'
import { externalDailyInput, externalIncidentCandidates, externalMaintenanceCandidates, externalTriageInput, selectCandidateIds } from './ExternalDataGuard'
import { idsSchema, promptCatalog, summarySchema, triageSchema, type PromptDefinition } from './PromptCatalog'
import { assertSummaryNumbers, parseJson, safeProviderError } from './ProviderSupport'

export interface AnthropicMessageLike { content:Array<{type:string;text?:string}>;stop_reason:string|null;usage:{input_tokens:number;output_tokens:number};_request_id?:string|null }
export interface AnthropicClientLike { messages:{ create(params:unknown):Promise<AnthropicMessageLike> } }

export class AnthropicProvider implements AIProvider {
  readonly name='ANTHROPIC' as const
  readonly external=true
  private client:AnthropicClientLike
  constructor(apiKey:string,readonly model:string,timeoutMs:number,client?:AnthropicClientLike){ this.client=client??new Anthropic({apiKey,maxRetries:0,timeout:timeoutMs}) as unknown as AnthropicClientLike }
  private async generate<T>(definition:PromptDefinition,input:unknown,parser:{parse(value:unknown):T}):Promise<ProviderResponse<T>> {
    const started=Date.now()
    try {
      const response=await this.client.messages.create({model:this.model,max_tokens:definition.maxOutputTokens,system:definition.system,messages:[{role:'user',content:`<business_data>${JSON.stringify(input)}</business_data>`}],output_config:{format:{type:'json_schema',schema:definition.jsonSchema}}})
      if(response.stop_reason==='refusal')throw new AIProviderError('REFUSAL','외부 AI가 요청 처리를 거부했습니다.')
      if(response.stop_reason==='max_tokens'||response.stop_reason==='model_context_window_exceeded'||response.stop_reason==='pause_turn')throw new AIProviderError('INCOMPLETE','외부 AI 응답이 완성되지 않았습니다.')
      const block=response.content.find(part=>part.type==='text')
      if(!block?.text)throw new AIProviderError('EMPTY_OUTPUT','외부 AI가 텍스트 응답을 반환하지 않았습니다.')
      const data=parseJson(block.text,parser)
      return {data,metadata:{provider:'ANTHROPIC',model:this.model,promptVersion:definition.version,latencyMs:Date.now()-started,inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens,requestId:response._request_id??null,externalTransmission:true}}
    } catch(error){throw safeProviderError(error)}
  }
  async triageIncident(title:string,description:string,serviceImpact=''):Promise<ProviderResponse<Triage>> { const result=await this.generate(promptCatalog.triage,externalTriageInput(title,description,serviceImpact),triageSchema); return {...result,data:{...result.data,label:'AI 추천'}} }
  async summarizeDailyStatus(status:DailyStatus):Promise<ProviderResponse<{summary:string}>> { const result=await this.generate(promptCatalog.dailySummary,externalDailyInput(status),summarySchema); assertSummaryNumbers(result.data.summary,status); return result }
  async recommendMaintenance(candidates:MaintenanceCandidate[]):Promise<ProviderResponse<MaintenanceCandidate[]>> { const result=await this.generate(promptCatalog.candidateRanking,externalMaintenanceCandidates(candidates),idsSchema); return {...result,data:selectCandidateIds(result.data.ids,candidates,c=>c.task_no)} }
  async findSimilarIncidents(title:string,candidates:IncidentMatch[]):Promise<ProviderResponse<IncidentMatch[]>> { const result=await this.generate(promptCatalog.candidateRanking,externalIncidentCandidates(title,candidates),idsSchema); return {...result,data:selectCandidateIds(result.data.ids,candidates,c=>c.ticket_no)} }
}
