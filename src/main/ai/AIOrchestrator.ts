import type { AIExecution, AIProvider, ProviderResponse } from './AIProvider'
import { AIProviderError } from './AIProvider'
import { safeProviderError } from './ProviderSupport'

export type AIRunFeature='incident_triage'|'daily_summary'|'similar_incidents'|'maintenance_recommendations'|'connection_test'
export type AIRunRecord={feature:AIRunFeature;selectedProvider:string;result:AIExecution<unknown>;inputSummary:string;entityType:string|null;entityId:string|null}
export type OrchestratorOptions={timeoutMs:number;maxRetries?:number;sleep?:(ms:number)=>Promise<void>;record?:(record:AIRunRecord)=>void|Promise<void>}

export class AIOrchestrator {
  private maxRetries:number
  private sleep:(ms:number)=>Promise<void>
  constructor(private local:AIProvider,private options:OrchestratorOptions){this.maxRetries=options.maxRetries??2;this.sleep=options.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)))}
  async execute<T>(feature:AIRunFeature,selected:AIProvider,primary:()=>Promise<ProviderResponse<T>>,fallback:()=>Promise<ProviderResponse<T>>,context:{inputSummary:string;entityType?:string;entityId?:string}):Promise<AIExecution<T>> {
    let error:AIProviderError|null=null
    const started=Date.now()
    if(selected.name==='LOCAL') { const response=await primary(); return this.finish(feature,selected.name,{...response,fallbackUsed:false,selectedProvider:selected.name,errorCode:null},context) }
    for(let attempt=0;attempt<=this.maxRetries;attempt++){
      try{const response=await this.withTimeout(primary()); return this.finish(feature,selected.name,{...response,fallbackUsed:false,selectedProvider:selected.name,errorCode:null},context)}
      catch(cause){error=safeProviderError(cause); if(!error.retryable||attempt===this.maxRetries)break; const base=error.retryAfterMs??Math.min(4000,250*2**attempt); await this.sleep(base+Math.floor(Math.random()*100))}
    }
    const localResponse=await fallback()
    localResponse.metadata.latencyMs=Date.now()-started
    localResponse.metadata.externalTransmission=selected.external&&!['CREDENTIAL_MISSING','EXTERNAL_DISABLED','DAILY_LIMIT'].includes(error?.code??'')
    return this.finish(feature,selected.name,{...localResponse,fallbackUsed:true,selectedProvider:selected.name,errorCode:error?.code??'PROVIDER_ERROR'},context)
  }
  private async withTimeout<T>(operation:Promise<T>):Promise<T>{ let timer:ReturnType<typeof setTimeout>|undefined; try{return await Promise.race([operation,new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new AIProviderError('TIMEOUT','외부 AI 응답 시간이 초과되었습니다.',true)),this.options.timeoutMs)})])}finally{if(timer)clearTimeout(timer)} }
  private async finish<T>(feature:AIRunFeature,selectedProvider:string,result:AIExecution<T>,context:{inputSummary:string;entityType?:string;entityId?:string}):Promise<AIExecution<T>> { await this.options.record?.({feature,selectedProvider,result:result as AIExecution<unknown>,inputSummary:context.inputSummary,entityType:context.entityType??null,entityId:context.entityId??null}); return result }
}
