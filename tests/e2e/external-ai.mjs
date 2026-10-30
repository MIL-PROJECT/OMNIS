import { _electron as electron } from 'playwright'
import { mkdirSync,rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { electronLaunchOptions } from './electron-launch.mjs'

process.env.OMNIS_E2E_AI_MOCK='1'
process.env.OPENAI_API_KEY='sk-e2e-openai-secret-value'
process.env.ANTHROPIC_API_KEY='sk-e2e-anthropic-secret-value'
const dataDir=resolve('tests/.tmp/external-ai-profile')
rmSync(dataDir,{recursive:true,force:true});mkdirSync(dataDir,{recursive:true})
const app=await electron.launch(electronLaunchOptions({dataDir,packagedExecutable:process.env.OMNIS_E2E_EXE}))
try{
  const page=await app.firstWindow()
  await page.getByRole('radio',{name:'관리자'}).click()
  await page.getByRole('textbox',{name:'아이디'}).fill('demo_admin')
  await page.getByRole('textbox',{name:'비밀번호'}).fill('Demo!2026')
  await page.getByRole('button',{name:'로그인'}).click()
  await page.getByRole('link',{name:'시스템관리'}).waitFor()
  const invoke=async(channel,payload={})=>{const r=await page.evaluate(([c,p])=>window.omnis.invoke(c,p),[channel,payload]);if(!r.ok)throw new Error(`${channel}: ${r.error?.message}`);return r.data}
  const base={ollamaEndpoint:'http://127.0.0.1:11434/',ollamaModel:'gemma3',openaiModel:'gpt-6-luna',anthropicModel:'claude-haiku-5-5',externalAiEnabled:true,externalConsent:true,timeoutSeconds:5,dailyRequestLimit:50}
  const credentials=await invoke('system:getAiSettings')
  if(credentials.credentials.OPENAI.source!=='environment'||credentials.credentials.OPENAI.masked.includes('sk-e2e'))throw new Error('OpenAI key was not masked')
  if(JSON.stringify(credentials).includes('sk-e2e-openai-secret-value'))throw new Error('Full API key leaked through IPC')
  await invoke('system:setAiSettings',{...base,provider:'OPENAI'})
  const openai=await invoke('ai:triageIncident',{title:'E2E 외부 AI 장애',description:'가상 회선 중단'})
  if(openai.provider!=='OPENAI'||openai.fallbackUsed||openai.requestId!=='e2e-openai')throw new Error(`OpenAI mock analysis failed: ${JSON.stringify(openai)}`)
  await invoke('system:setAiSettings',{...base,provider:'ANTHROPIC'})
  const claude=await invoke('ai:triageIncident',{title:'E2E Claude 장애',description:'가상 회선 중단'})
  if(claude.provider!=='ANTHROPIC'||claude.fallbackUsed||claude.requestId!=='e2e-anthropic')throw new Error(`Claude mock analysis failed: ${JSON.stringify(claude)}`)
  const created=await invoke('incidents:create',{title:'E2E AI 검토 반영',category:'기반통신',severity:'NORMAL',description:'가상 분석 대상'})
  const suggestion=await invoke('ai:triageIncident',{title:'E2E AI 검토 반영',description:'가상 회선 중단',incidentId:created.id})
  await invoke('incidents:applyAi',{id:created.id,category:suggestion.category,severity:suggestion.priority,rationale:suggestion.rationale,confidence:suggestion.confidence,runId:suggestion.runId})
  const incident=await invoke('incidents:get',{id:created.id})
  if(incident.ai_category!==suggestion.category||!incident.ai_rationale)throw new Error('Reviewed AI suggestion was not applied')
  await invoke('system:setAiSettings',{...base,provider:'OPENAI'})
  const fallback=await invoke('ai:triageIncident',{title:'MOCK_TIMEOUT',description:'가상 timeout'})
  if(!fallback.fallbackUsed||fallback.provider!=='LOCAL'||fallback.selectedProvider!=='OPENAI'||fallback.errorCode!=='TIMEOUT')throw new Error(`Timeout fallback failed: ${JSON.stringify(fallback)}`)
  await page.getByRole('link',{name:'시스템관리'}).click()
  await page.setViewportSize({width:1366,height:768})
  await page.getByRole('heading',{name:'시스템관리'}).waitFor()
  let overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  if(overflow>1)throw new Error(`AI settings 1366 overflow: ${overflow}`)
  await page.setViewportSize({width:1920,height:1080})
  overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  if(overflow>1)throw new Error(`AI settings 1920 overflow: ${overflow}`)
  console.log('External AI E2E passed: RBAC/masked keys/OpenAI/Claude/timeout fallback/review apply/responsive UI')
}finally{await app.close()}
