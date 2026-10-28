import type { AIProvider, AIProviderName, IncidentMatch, MaintenanceCandidate, ProviderResponse, Triage } from './AIProvider'
import { AIProviderError, DEFAULT_AI_MODELS } from './AIProvider'
import { LocalRuleProvider } from './LocalRuleProvider'
import { OllamaProvider } from './OllamaProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { AnthropicProvider } from './AnthropicProvider'
import type { OpenAIClientLike } from './OpenAIProvider'
import type { AnthropicClientLike } from './AnthropicProvider'
import type { AISecretStore } from './AISecretStore'

export type AISettings={provider:AIProviderName;externalAiEnabled:boolean;ollamaEndpoint:string;ollamaModel:string;openaiModel:string;anthropicModel:string;timeoutSeconds:number;dailyRequestLimit:number;externalAiConsentAt:string|null}
export type AIProviderClients={openai?:OpenAIClientLike;anthropic?:AnthropicClientLike}
export class AIProviderFactory {
  readonly local=new LocalRuleProvider()
  constructor(private settings:AISettings,private secrets:AISecretStore,private clients:AIProviderClients={}){}
  create():AIProvider {
    const s=this.settings
    if(s.provider==='LOCAL')return this.local
    if(s.provider==='OLLAMA')return new OllamaProvider(s.ollamaEndpoint,s.ollamaModel,s.timeoutSeconds*1000)
    if(!s.externalAiEnabled||!s.externalAiConsentAt)return new UnavailableProvider(s.provider,s.provider==='OPENAI'?s.openaiModel:s.anthropicModel,'EXTERNAL_DISABLED','외부 AI 사용 활성화와 전송 동의를 선택한 뒤 AI 설정 저장을 완료해 주세요.')
    const credential=this.secrets.getCredential(s.provider)
    if(!credential)return new UnavailableProvider(s.provider,s.provider==='OPENAI'?s.openaiModel:s.anthropicModel,'CREDENTIAL_MISSING',`${s.provider==='OPENAI'?'OpenAI':'Anthropic'} API Key가 설정되지 않았습니다.`)
    return s.provider==='OPENAI'?new OpenAIProvider(credential.value,s.openaiModel,s.timeoutSeconds*1000,this.clients.openai):new AnthropicProvider(credential.value,s.anthropicModel,s.timeoutSeconds*1000,this.clients.anthropic)
  }
}
export const defaultAISettings:AISettings={provider:'LOCAL',externalAiEnabled:false,ollamaEndpoint:'http://127.0.0.1:11434',ollamaModel:DEFAULT_AI_MODELS.OLLAMA,openaiModel:DEFAULT_AI_MODELS.OPENAI,anthropicModel:DEFAULT_AI_MODELS.ANTHROPIC,timeoutSeconds:15,dailyRequestLimit:50,externalAiConsentAt:null}

class UnavailableProvider implements AIProvider {
  readonly external=true
  constructor(readonly name:'OPENAI'|'ANTHROPIC',readonly model:string,private code:string,private reason:string){}
  private fail<T>():Promise<ProviderResponse<T>>{return Promise.reject(new AIProviderError(this.code,this.reason))}
  triageIncident():Promise<ProviderResponse<Triage>>{return this.fail()}
  summarizeDailyStatus():Promise<ProviderResponse<{summary:string}>>{return this.fail()}
  recommendMaintenance():Promise<ProviderResponse<MaintenanceCandidate[]>>{return this.fail()}
  findSimilarIncidents():Promise<ProviderResponse<IncidentMatch[]>>{return this.fail()}
}
