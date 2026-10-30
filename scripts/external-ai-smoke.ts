import { OpenAIProvider } from '../src/main/ai/OpenAIProvider'
import { AnthropicProvider } from '../src/main/ai/AnthropicProvider'
import { DEFAULT_AI_MODELS } from '../src/main/ai/AIProvider'

if(process.env.RUN_EXTERNAL_AI_TESTS!=='1'){
  console.log('SKIPPED: set RUN_EXTERNAL_AI_TESTS=1 to opt in to paid external API smoke tests.')
  process.exit(0)
}

const providers=[]
if(process.env.OPENAI_API_KEY)providers.push(new OpenAIProvider(process.env.OPENAI_API_KEY,process.env.OPENAI_MODEL??DEFAULT_AI_MODELS.OPENAI,15000))
if(process.env.ANTHROPIC_API_KEY)providers.push(new AnthropicProvider(process.env.ANTHROPIC_API_KEY,process.env.ANTHROPIC_MODEL??DEFAULT_AI_MODELS.ANTHROPIC,15000))
if(!providers.length)throw new Error('OPENAI_API_KEY 또는 ANTHROPIC_API_KEY가 필요합니다.')

for(const provider of providers){
  const result=await provider.triageIncident('가상 연결 시험','가상 시험 환경의 통신 중단','가상 서비스 일부 영향')
  console.log(JSON.stringify({provider:result.metadata.provider,model:result.metadata.model,requestId:result.metadata.requestId,inputTokens:result.metadata.inputTokens,outputTokens:result.metadata.outputTokens,priority:result.data.priority}))
}
