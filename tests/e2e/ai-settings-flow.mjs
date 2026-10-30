import {_electron as electron,expect} from 'playwright/test'
import {mkdirSync,rmSync,readFileSync} from 'node:fs'
import {resolve,sep} from 'node:path'
import {electronLaunchOptions} from './electron-launch.mjs'

const root=resolve('tests/.tmp'),dataDir=resolve('tests/.tmp/ai-settings-flow-profile')
if(!dataDir.startsWith(root+sep))throw new Error('Isolated profile required')
rmSync(dataDir,{recursive:true,force:true});mkdirSync(dataDir,{recursive:true})
process.env.OMNIS_E2E_AI_MOCK='1'
process.env.OPENAI_API_KEY='sk-synthetic-settings-test-key'
process.env.ANTHROPIC_API_KEY='sk-synthetic-anthropic-settings-key'
const app=await electron.launch(electronLaunchOptions({dataDir,packagedExecutable:process.env.OMNIS_E2E_EXE})),page=await app.firstWindow(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('dialog',async d=>{errors.push('Unexpected native alert');await d.dismiss()})
const invoke=async(c,p={})=>{const r=await page.evaluate(([c,p])=>window.omnis.invoke(c,p),[c,p]);if(!r.ok)throw new Error(r.error.message);return r.data}
const chooseProvider=async name=>{await page.getByRole('combobox',{name:'Provider',exact:true}).click();await page.getByRole('option',{name,exact:true}).click()}
try{
  await page.getByRole('button',{name:'관리자 로그인',exact:true}).click()
  if(process.env.OMNIS_E2E_EXE)expect((await invoke('system:getInfo')).version).toBe(JSON.parse(readFileSync(resolve('package.json'),'utf8')).version)
  const base={provider:'LOCAL',ollamaEndpoint:'http://127.0.0.1:11434/',ollamaModel:'gemma3',openaiModel:'gpt-6-luna',anthropicModel:'claude-haiku-5-5',externalAiEnabled:false,externalConsent:false,timeoutSeconds:15,dailyRequestLimit:50}
  await invoke('system:setAiSettings',base)
  await page.getByRole('link',{name:'시스템관리',exact:true}).click()
  await chooseProvider('OpenAI Responses API')
  const enabled=page.getByRole('checkbox',{name:'외부 AI Provider 사용 활성화',exact:true}),consent=page.getByRole('checkbox',{name:'외부 전송·별도 비용·담당자 최종 판단 안내에 동의',exact:true})
  const runs=() => invoke('ai:listRuns',{limit:200})
  const initialCount=(await runs()).length
  // A configured key alone must never activate consent or make a request.
  await page.getByRole('button',{name:'저장 후 연결 시험',exact:true}).click()
  await expect(page.locator('.ai-feedback')).toContainText('모두 선택')
  expect((await runs()).length).toBe(initialCount)
  await enabled.check();await consent.check()
  await page.getByRole('spinbutton',{name:'Timeout(초)',exact:true}).fill('20')
  await page.getByRole('spinbutton',{name:'일일 외부 요청 한도',exact:true}).fill('30')
  const keyInput=page.getByLabel('OPENAI API Key 저장/교체',{exact:true})
  await keyInput.fill('sk-synthetic-replacement-only')
  await expect(page.getByRole('button',{name:'저장 후 연결 시험',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'OPENAI API Key 저장',exact:true}).click()
  await expect(keyInput).toHaveValue('')
  await expect(page.locator('.ai-feedback')).toContainText('API Key를 저장')
  await expect(enabled).toBeChecked();await expect(consent).toBeChecked()
  await expect(page.getByRole('combobox',{name:'Provider',exact:true})).toContainText('OpenAI Responses API')
  await expect(page.getByRole('spinbutton',{name:'Timeout(초)',exact:true})).toHaveValue('20')
  const unsaved=await invoke('system:getAiSettings')
  expect(unsaved.provider).toBe('LOCAL');expect(unsaved.externalAiEnabled).toBe(false);expect(unsaved.externalAiConsentAt).toBeNull()
  // The explicit save-and-test action commits exactly what is checked before testing.
  await page.getByRole('button',{name:'저장 후 연결 시험',exact:true}).click()
  await expect(page.locator('.ai-feedback')).toContainText('OPENAI 연결에 성공')
  const saved=await invoke('system:getAiSettings')
  expect(saved.provider).toBe('OPENAI');expect(saved.externalAiEnabled).toBe(true);expect(saved.externalAiConsentAt).toBeTruthy();expect(saved.timeoutSeconds).toBe(20);expect(saved.dailyRequestLimit).toBe(30)
  expect(saved.lastTests.OPENAI.status).toBe('SUCCESS')
  expect((await runs()).length).toBe(initialCount+1)
  await expect(page.getByText('저장된 제공자: OPENAI · 현재 선택: OPENAI',{exact:true})).toBeVisible()
  // Unchecking current consent blocks transmission even when an older consent is saved.
  await consent.uncheck()
  await page.getByRole('button',{name:'저장 후 연결 시험',exact:true}).click()
  await expect(page.locator('.ai-feedback')).toContainText('모두 선택')
  expect((await runs()).length).toBe(initialCount+1)
  await consent.check()
  // Invalid settings must stop before connection_test; no accidental request on save failure.
  await page.getByRole('textbox',{name:'OpenAI Model',exact:true}).fill('invalid model name')
  await page.getByRole('button',{name:'저장 후 연결 시험',exact:true}).click()
  await expect(page.locator('.ai-feedback')).toBeVisible()
  await expect(page.getByRole('button',{name:'저장 후 연결 시험',exact:true})).toBeEnabled()
  expect((await runs()).length).toBe(initialCount+1)
  expect((await invoke('system:getAiSettings')).openaiModel).toBe('gpt-6-luna')
  await page.getByRole('textbox',{name:'OpenAI Model',exact:true}).fill('gpt-6-luna')
  await page.getByRole('button',{name:'연결 시험',exact:true}).click()
  await expect(page.locator('.ai-feedback')).toContainText('연결에 성공')
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await page.setViewportSize({width,height})
    await page.getByRole('button',{name:'AI 설정 저장',exact:true}).scrollIntoViewIfNeeded()
    await page.screenshot({path:resolve(`tests/.tmp/ai-settings-save-test-${width}.png`),animations:'disabled'})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    expect(await page.locator('.ai-credential-card').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  }
  await chooseProvider('Anthropic Claude')
  await page.getByRole('button',{name:'저장 후 연결 시험',exact:true}).click()
  await expect(page.locator('.ai-feedback')).toContainText('ANTHROPIC 연결에 성공')
  expect((await invoke('system:getAiSettings')).provider).toBe('ANTHROPIC')
  const beforeReload=(await runs()).length
  await page.reload()
  await expect(page.getByRole('combobox',{name:'Provider',exact:true})).toContainText('Anthropic Claude')
  await expect(page.getByText('저장된 제공자: ANTHROPIC · 현재 선택: ANTHROPIC',{exact:true})).toBeVisible()
  await expect(enabled).toBeChecked();await expect(consent).toBeChecked()
  expect((await runs()).length).toBe(beforeReload)
  expect(errors).toEqual([])
  console.log('AI settings flow E2E passed: draft retained on key save, explicit save-before-test, unchecked consent/invalid-save no request, OpenAI/Claude, 1366/1920')
}finally{await app.close()}
