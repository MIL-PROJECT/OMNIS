import { describe,expect,it,vi } from 'vitest'
import { mkdtempSync,readFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OpenAIProvider,type OpenAIClientLike } from '../../src/main/ai/OpenAIProvider'
import { AnthropicProvider,type AnthropicClientLike } from '../../src/main/ai/AnthropicProvider'
import { AIOrchestrator } from '../../src/main/ai/AIOrchestrator'
import { AIProviderError,type AIProvider, type ProviderResponse, type Triage } from '../../src/main/ai/AIProvider'
import { LocalRuleProvider } from '../../src/main/ai/LocalRuleProvider'
import { externalTriageInput,redactExternalText,selectCandidateIds } from '../../src/main/ai/ExternalDataGuard'
import { AISecretStore,type EncryptionAdapter } from '../../src/main/ai/AISecretStore'
import { assertDailyRequestLimit } from '../../src/main/ai/AIUsagePolicy'

const triage={category:'무선/위성',priority:'URGENT',confidence:.8,recommendation:'확인',rationale:'중단',recommendedTeamCode:'TEAM-RADIO',estimatedMinutes:60,questions:['범위?']}
const openAIResponse=(value:unknown)=>({output_text:JSON.stringify(value),status:'completed',output:[],usage:{input_tokens:12,output_tokens:8},_request_id:'req-openai'})
const anthropicResponse=(value:unknown)=>({content:[{type:'text',text:JSON.stringify(value)}],stop_reason:'end_turn',usage:{input_tokens:11,output_tokens:7},_request_id:'req-claude'})

describe('external AI providers',()=>{
  it('uses OpenAI Responses structured output and records metadata',async()=>{const create=vi.fn().mockResolvedValue(openAIResponse(triage)),client={responses:{create}} as OpenAIClientLike,result=await new OpenAIProvider('secret','gpt-6-luna',15000,client).triageIncident('무선 장애','회선 중단');expect(result.data.priority).toBe('URGENT');expect(result.metadata).toMatchObject({provider:'OPENAI',requestId:'req-openai',inputTokens:12,outputTokens:8,externalTransmission:true});expect(create.mock.calls[0][0]).toMatchObject({model:'gpt-6-luna',text:{format:{type:'json_schema',strict:true}}})})
  it('uses Claude Messages structured output and text content block',async()=>{const create=vi.fn().mockResolvedValue(anthropicResponse(triage)),client={messages:{create}} as AnthropicClientLike,result=await new AnthropicProvider('secret','claude-haiku-5-5',15000,client).triageIncident('무선 장애','회선 중단');expect(result.data.recommendedTeamCode).toBe('TEAM-RADIO');expect(result.metadata).toMatchObject({provider:'ANTHROPIC',requestId:'req-claude'});expect(create.mock.calls[0][0]).toMatchObject({output_config:{format:{type:'json_schema'}}})})
  it.each([
    ['malformed','not-json'],
    ['empty','']
  ])('rejects OpenAI %s output',async(_name,output)=>{const client={responses:{create:vi.fn().mockResolvedValue({...openAIResponse(triage),output_text:output})}} as OpenAIClientLike;await expect(new OpenAIProvider('secret','gpt-6-luna',15000,client).triageIncident('a','b')).rejects.toMatchObject({code:output?'SCHEMA_VALIDATION':'EMPTY_OUTPUT'})})
  it('rejects schema-invalid output',async()=>{const client={responses:{create:vi.fn().mockResolvedValue(openAIResponse({...triage,priority:'CRITICAL'}))}} as OpenAIClientLike;await expect(new OpenAIProvider('secret','gpt-6-luna',15000,client).triageIncident('a','b')).rejects.toMatchObject({code:'SCHEMA_VALIDATION'})})
  it('handles OpenAI refusal and incomplete responses',async()=>{const refusal={...openAIResponse(triage),output:[{content:[{type:'refusal'}]}]},incomplete={...openAIResponse(triage),status:'incomplete'};await expect(new OpenAIProvider('x','m',100,{responses:{create:vi.fn().mockResolvedValue(refusal)}}).triageIncident('a','b')).rejects.toMatchObject({code:'REFUSAL'});await expect(new OpenAIProvider('x','m',100,{responses:{create:vi.fn().mockResolvedValue(incomplete)}}).triageIncident('a','b')).rejects.toMatchObject({code:'INCOMPLETE'})})
  it('handles Claude refusal, incomplete, and missing text',async()=>{for(const response of [{...anthropicResponse(triage),stop_reason:'refusal'},{...anthropicResponse(triage),stop_reason:'max_tokens'},{...anthropicResponse(triage),content:[]}])await expect(new AnthropicProvider('x','m',100,{messages:{create:vi.fn().mockResolvedValue(response)}}).triageIncident('a','b')).rejects.toBeInstanceOf(AIProviderError)})
  it('rejects a daily summary containing an unprovided number',async()=>{const client={responses:{create:vi.fn().mockResolvedValue(openAIResponse({summary:'미종결 2건, 추가 99건'}))}} as OpenAIClientLike;await expect(new OpenAIProvider('x','m',100,client).summarizeDailyStatus({openIncidents:2,urgentIncidents:0,activeMaintenance:0,delayedMaintenance:0,slaRiskCount:0,majorAlerts:[]})).rejects.toMatchObject({code:'UNSUPPORTED_FACT'})})
  it('drops unknown and duplicate candidate IDs',()=>{const candidates=[{id:'A'},{id:'B'}];expect(selectCandidateIds(['A','A','X','B'],candidates,v=>v.id)).toEqual(candidates)})
})

describe('retry, timeout, and fallback',()=>{
  const local=new LocalRuleProvider(),context={inputSummary:'test'}
  const selected={name:'OPENAI',model:'m',external:true} as AIProvider
  const fallback=()=>local.triageIncident('일반 점검','정상')
  it('does not retry 401/403 and falls back',async()=>{for(const status of [401,403]){const primary=vi.fn().mockRejectedValue(new AIProviderError(`HTTP_${status}`,'auth',false,status)),result=await new AIOrchestrator(local,{timeoutMs:100,maxRetries:2,sleep:vi.fn()}).execute('incident_triage',selected,primary,fallback,context);expect(primary).toHaveBeenCalledTimes(1);expect(result).toMatchObject({fallbackUsed:true,errorCode:`HTTP_${status}`,selectedProvider:'OPENAI'})}})
  it.each([429,500])('retries HTTP %s then succeeds',async status=>{const success=await local.triageIncident('일반 점검','정상'),primary=vi.fn().mockRejectedValueOnce(new AIProviderError(`HTTP_${status}`,'retry',true,status,0)).mockResolvedValue(success),result=await new AIOrchestrator(local,{timeoutMs:100,maxRetries:2,sleep:vi.fn()}).execute('incident_triage',selected,primary,fallback,context);expect(primary).toHaveBeenCalledTimes(2);expect(result.fallbackUsed).toBe(false)})
  it('times out and uses Local Rule',async()=>{const primary=vi.fn(()=>new Promise<ProviderResponse<Triage>>(()=>{})),result=await new AIOrchestrator(local,{timeoutMs:5,maxRetries:0}).execute('incident_triage',selected,primary,fallback,context);expect(result).toMatchObject({fallbackUsed:true,errorCode:'TIMEOUT'});expect(result.metadata.provider).toBe('LOCAL')})
  it('handles offline network errors with fallback',async()=>{const primary=vi.fn().mockRejectedValue(new TypeError('fetch failed: offline')),result=await new AIOrchestrator(local,{timeoutMs:100,maxRetries:0}).execute('incident_triage',selected,primary,fallback,context);expect(result.errorCode).toBe('NETWORK_ERROR');expect(result.metadata.externalTransmission).toBe(true)})
})

describe('data protection and usage policy',()=>{
  it('masks personal data, credentials, and local paths before transmission',()=>{const input=externalTriageInput('010-1234-5678 test@example.com','22-12345678 Bearer abcdefghijklmnop password=hunter2 C:\\Users\\admin\\secret.txt','/Users/alex/private');const serialized=JSON.stringify(input);expect(serialized).not.toContain('010-1234-5678');expect(serialized).not.toContain('test@example.com');expect(serialized).not.toContain('hunter2');expect(serialized).not.toContain('Users\\\\admin');expect(redactExternalText('정상',10)).toBe('정상')})
  it('enforces the daily request limit',()=>{expect(()=>assertDailyRequestLimit(9,10)).not.toThrow();expect(()=>assertDailyRequestLimit(10,10)).toThrowError(expect.objectContaining({code:'DAILY_LIMIT'}))})
  it('stores only encrypted credentials and exposes only a mask',()=>{const dir=mkdtempSync(join(tmpdir(),'omnis-secret-'));const adapter:EncryptionAdapter={isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from([...v].reverse().join('')),decryptString:v=>[...v.toString()].reverse().join('')};try{const store=new AISecretStore(dir,adapter,{}),status=store.save('OPENAI','sk-example-super-secret');expect(status).toEqual({configured:true,source:'encrypted-store',masked:'••••••••cret'});expect(readFileSync(store.filePath,'utf8')).not.toContain('sk-example-super-secret');expect(store.getCredential('OPENAI')?.value).toBe('sk-example-super-secret');expect(store.delete('OPENAI').configured).toBe(false)}finally{rmSync(dir,{recursive:true,force:true})}})
  it('refuses plaintext persistence when encryption is unavailable',()=>{const dir=mkdtempSync(join(tmpdir(),'omnis-secret-'));const adapter:EncryptionAdapter={isEncryptionAvailable:()=>false,encryptString:()=>Buffer.alloc(0),decryptString:()=>''};try{expect(()=>new AISecretStore(dir,adapter,{}).save('ANTHROPIC','anthropic-secret-key')).toThrow('암호화')}finally{rmSync(dir,{recursive:true,force:true})}})
  it('uses environment credentials without returning the full value in status',()=>{const adapter:EncryptionAdapter={isEncryptionAvailable:()=>false,encryptString:()=>Buffer.alloc(0),decryptString:()=>''},store=new AISecretStore('unused',adapter,{OPENAI_API_KEY:'sk-env-private-value'});expect(store.status('OPENAI')).toEqual({configured:true,source:'environment',masked:'••••••••alue'});expect(JSON.stringify(store.status('OPENAI'))).not.toContain('sk-env-private-value')})
})
