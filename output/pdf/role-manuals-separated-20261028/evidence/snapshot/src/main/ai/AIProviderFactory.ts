import type { AIProvider, AIProviderName, DailyStatus, IncidentMatch, MaintenanceCandidate, ProviderResponse, Triage } from './AIProvider'
import { AIProviderError, DEFAULT_AI_MODELS } from './AIProvider'
import { LocalRuleProvider } from './LocalRuleProvider'
import { OllamaProvider } from './OllamaProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { AnthropicProvider } from './AnthropicProvider'
import type { AISecretStore } from './AISecretStore'

export type AISettings={provider:AIProviderName;externalAiEnabled:boolean;ollamaEndpoint:string;ollamaModel:string;openaiModel:string;anthropicModel:string;timeoutSeconds:number;dailyRequestLimit:number;externalAiConsentAt:string|null}
export class AIProviderFactory {
  readonly local=new LocalRuleProvider()
  constructor(private settings:AISettings,private secrets:AISecretStore){}
  create():AIProvider {
    const s=this.settings
    if(s.provider==='LOCAL')return this.local
    if(s.provider==='OLLAMA')return new OllamaProvider(s.ollamaEndpoint,s.ollamaModel,s.timeoutSeconds*1000)
    if(!s.externalAiEnabled||!s.externalAiConsentAt)return new UnavailableProvider(s.provider,s.provider==='OPENAI'?s.openaiModel:s.anthropicModel,'EXTERNAL_DISABLED','외부 AI 사용 동의와 활성화가 필요합니다.')
    const credential=this.secrets.getCredential(s.provider)
    if(!credential)return new UnavailableProvider(s.provider,s.provider==='OPENAI'?s.openaiModel:s.anthropicModel,'CREDENTIAL_MISSING',`${s.provider==='OPENAI'?'OpenAI':'Anthropic'} API Key가 설정되지 않았습니다.`)
    return s.provider==='OPENAI'?new OpenAIProvider(credential.value,s.openaiModel,s.timeoutSeconds*1000):new AnthropicProvider(credential.value,s.anthropicModel,s.timeoutSeconds*1000)
  }
}
export const defaultAISettings:AISettings={provider:'LOCAL',externalAiEnabled:false,ollamaEndpoint:'http://127.0.0.1:11434',ollamaModel:DEFAULT_AI_MODELS.OLLAMA,openaiModel:DEFAULT_AI_MODELS.OPENAI,anthropicModel:DEFAULT_AI_MODELS.ANTHROPIC,timeoutSeconds:15,dailyRequestLimit:50,externalAiConsentAt:null}

class UnavailableProvider implements AIProvider {
  readonly external=true
  constructor(readonly name:'OPENAI'|'ANTHROPIC',readonly model:string,private code:string,private reason:string){}
  private fail<T>():Promise<ProviderResponse<T>>{return Promise.reject(new AIProviderError(this.code,this.reason))}
  triageIncident(_title:string,_description:string,_serviceImpact?:string):Promise<ProviderResponse<Triage>>{return this.fail()}
  summarizeDailyStatus(_status:DailyStatus):Promise<ProviderResponse<{summary:string}>>{return this.fail()}
  recommendMaintenance(_candidates:MaintenanceCandidate[]):Promise<ProviderResponse<MaintenanceCandidate[]>>{return this.fail()}
  findSimilarIncidents(_title:string,_candidates:IncidentMatch[]):Promise<ProviderResponse<IncidentMatch[]>>{return this.fail()}
}
