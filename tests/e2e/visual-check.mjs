import { _electron as electron } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const dataDir=resolve('tests/.tmp/visual-profile'), output=resolve('tests/.tmp/visual')
rmSync(dataDir,{recursive:true,force:true}); mkdirSync(dataDir,{recursive:true}); mkdirSync(output,{recursive:true})
const app=await electron.launch({executablePath:resolve('node_modules/electron/dist/electron.exe'),args:[resolve('out/main/index.js')],env:{...process.env,OMNIS_E2E_DATA:dataDir}})
try {
  const page=await app.firstWindow(), errors=[]
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text())})
  await page.setViewportSize({width:1366,height:768})
  await page.getByRole('button',{name:'로그인'}).click()
  await page.getByRole('link',{name:'통제·일일마감'}).click()
  await page.getByRole('heading',{name:'통제 · 일일마감'}).waitFor()
  const overflow1366=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  if(overflow1366>1) throw new Error(`1366 layout horizontal overflow: ${overflow1366}px`)
  await page.screenshot({path:resolve(output,'control-1366x768.png')})
  await page.getByRole('link',{name:'고장관리'}).click()
  await page.getByRole('heading',{name:'고장관리'}).waitFor()
  await page.screenshot({path:resolve(output,'incidents-1366x768.png')})
  await page.getByRole('button',{name:'상세'}).first().click()
  await page.getByText('첨부자료',{exact:true}).waitFor()
  await page.getByText('파일당 최대 25MB').waitFor()
  await page.screenshot({path:resolve(output,'incident-attachments-1366x768.png')})
  await page.getByRole('button',{name:'닫기'}).click()
  await page.locator('.crumbs').getByRole('link',{name:'운용 현황'}).click()
  await page.getByRole('heading',{name:'운영현황'}).waitFor()
  if(await page.locator('.sb-standalone').getByRole('link',{name:'통합상황판'}).count()!==1) throw new Error('Dashboard is not a standalone navigation item')
  await page.setViewportSize({width:1920,height:1080})
  await page.getByRole('link',{name:'통합상황판'}).click()
  await page.getByRole('heading',{name:'통합상황판'}).waitFor()
  const overflow1920=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  if(overflow1920>1) throw new Error(`1920 layout horizontal overflow: ${overflow1920}px`)
  await page.screenshot({path:resolve(output,'dashboard-1920x1080.png')})
  if(errors.length) throw new Error(`Renderer console errors: ${errors.join(' | ')}`)
  console.log(`Visual E2E passed: 1366x768 and 1920x1080; screenshots in ${output}`)
} finally { await app.close() }
