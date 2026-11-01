import { _electron as electron } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { electronLaunchOptions } from './electron-launch.mjs'

const dataDir = resolve('tests/.tmp/roles-profile')
mkdirSync(dataDir, { recursive:true })
const app = await electron.launch(electronLaunchOptions({ dataDir }))
try {
  const actual = await app.evaluate(({app}) => app.getPath('userData'))
  if (resolve(actual).toLowerCase() !== dataDir.toLowerCase()) throw new Error(`Data isolation failed: ${actual}`)
  const page = await app.firstWindow()
  const login = async username => { await page.getByRole('radio',{name: username === 'demo_admin' ? '관리자' : '사용자'}).click(); await page.getByRole('textbox',{name:'아이디'}).fill(username); await page.getByRole('textbox',{name:'비밀번호'}).fill('Demo!2026'); await page.getByRole('button',{name:'로그인'}).click(); await page.getByRole('link',{name:'고장관리'}).waitFor() }
  const denied = async (channel,payload) => { const result = await page.evaluate(([c,p]) => window.omnis.invoke(c,p),[channel,payload]); if (result.ok || result.error?.message !== '권한이 없습니다.') throw new Error(`Expected RBAC rejection for ${channel}: ${JSON.stringify(result)}`) }
  await login('demo_8')
  await denied('incidents:create',{title:'가상 테스트 접수',category:'기반통신',severity:'NORMAL',description:'가상 접수 내용'})
  await denied('operations:updateStatus',{id:'does-not-matter',status:'WATCH'})
  await page.getByRole('button',{name:'로그아웃'}).click()
  await login('demo_1')
  await denied('maintenance:create',{title:'가상 정비 작업',maintenanceType:'정기점검',priority:'NORMAL',department:'가상 정비반',scheduledDate:'2026-09-17'})
  await page.getByRole('button',{name:'로그아웃'}).click()
  await login('demo_4')
  await denied('directives:create',{title:'가상 지시사항',content:'가상 내용입니다.',level:'GENERAL'})
  await page.getByRole('button',{name:'로그아웃'}).click()
  await login('demo_user')
  const allowed = async (channel,payload) => { const result = await page.evaluate(([c,p]) => window.omnis.invoke(c,p),[channel,payload]); if (!result.ok) throw new Error(`Expected USER to be allowed ${channel}: ${JSON.stringify(result)}`) }
  await allowed('incidents:create',{title:'가상 사용자 접수',category:'기반통신',severity:'NORMAL',description:'가상 접수 내용'})
  await denied('maintenance:create',{title:'가상 사용자 정비',maintenanceType:'정기점검',workKind:'PLANNED',priority:'NORMAL',department:'가상 정비반',scheduledDate:'2026-09-17'})
  await denied('directives:create',{title:'가상 사용자 지시',content:'가상 내용입니다.',level:'GENERAL'})
  for (const [channel,payload] of [['system:getInfo',{}],['system:getAiSettings',{}],['system:backup',{}],['system:auditLogs',{limit:10}],['system:setAiSettings',{provider:'LOCAL',ollamaEndpoint:'http://127.0.0.1:11434/',ollamaModel:'gemma3',openaiModel:'gpt-6-luna',anthropicModel:'claude-haiku-5-5',externalAiEnabled:false,externalConsent:false,timeoutSeconds:15,dailyRequestLimit:50}],['system:saveAiCredential',{provider:'OPENAI',apiKey:'sk-not-allowed-example'}],['system:deleteAiCredential',{provider:'OPENAI'}],['system:testAiConnection',{provider:'OPENAI'}],['system:resetDemo',{confirm:'RESET DEMO'}],['operations:delete',{id:'does-not-matter'}],['admin:signupRequests',{}],['admin:approveSignup',{id:'x',role:'ADMIN'}],['admin:rejectSignup',{id:'x',reason:'권한 없음'}]]) await denied(channel,payload)
  if (await page.getByRole('link',{name:'시스템관리'}).count()) throw new Error('USER should not see the 시스템관리 menu')
  if (await page.getByRole('link',{name:'관리자센터'}).count()) throw new Error('USER should not see the 사용자 신청현황 menu')
  await page.evaluate(() => { location.hash = '#/settings' })
  await page.getByRole('heading',{name:'통합상황판'}).waitFor()
  if (await page.getByRole('heading',{name:'시스템관리'}).count()) throw new Error('USER reached /settings directly')
  await page.getByRole('button',{name:'로그아웃'}).click()
  await login('demo_admin')
  await page.getByRole('link',{name:'시스템관리'}).waitFor()
  console.log('RBAC E2E passed: VIEWER, OPERATOR, MAINTAINER and USER role boundaries enforced in Main services')
} finally { await app.close() }
