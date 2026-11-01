import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { _electron as electron, expect } from 'playwright/test'
import { electronLaunchOptions } from './electron-launch.mjs'

mkdirSync(resolve('tests/.tmp'),{recursive:true})
const dataDir=mkdtempSync(resolve('tests/.tmp/reports-pdf-'))
const app=await electron.launch(electronLaunchOptions({dataDir,packagedExecutable:process.env.OMNIS_E2E_EXE}))
let page;const checks=[],errors=[]
const pdfText=path=>execFileSync(process.env.OMNIS_PDF_PYTHON??'python3',['-c','from pypdf import PdfReader;import sys;print("\\n".join(p.extract_text() for p in PdfReader(sys.argv[1]).pages))',path],{encoding:'utf8'})
try{
  assert.equal(resolve(await app.evaluate(({app})=>app.getPath('userData'))),dataDir)
  page=await app.firstWindow();page.setDefaultTimeout(15000)
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept())
  await page.getByRole('button',{name:'관리자 로그인',exact:true}).click()
  await page.getByRole('link',{name:'통합상황판',exact:true}).waitFor()
  const invoke=async(c,p={})=>{const r=await page.evaluate(([c,p])=>window.omnis.invoke(c,p),[c,p]);assert.equal(r.ok,true,JSON.stringify(r));return r.data}
  const team=(await invoke('control:teams')).find(t=>t.code==='TEAM-WIRE'),owner=(await invoke('users:list')).find(u=>u.username==='demo_4')
  const statuses=['RECEIVED','TRIAGED','ASSIGNED','PLANNED','IN_PROGRESS','REMOTE_IN_PROGRESS','ON_SITE_IN_PROGRESS','RESOLVED','VERIFIED','CLOSED','ON_HOLD','CANCELED']
  const labels=['접수','분류','배정','계획','진행','원격조치','현장출동','조치완료','검증','종결','보류','취소']
  const update=(id,status)=>invoke('incidents:updateStatus',{id,status,cause:'가상 원인 분석',actionSummary:'가상 조치 완료',userConfirmed:true})
  for(const [index,target]of statuses.entries()){
    const {id}=await invoke('incidents:create',{title:index===0?'가상 회선 <점검> & 확인':`가상 한국어 보고서 검증 ${index+1}`,category:'기반통신',severity:index%2?'URGENT':'NORMAL',description:'격리된 검증 프로필의 가상 고장입니다.'})
    if(target==='RECEIVED')continue
    await update(id,'TRIAGED');if(target==='TRIAGED')continue
    if(target==='CANCELED'){await update(id,target);continue}
    await invoke('incidents:assignTeam',{id,teamId:team.id,userId:owner.id});if(target==='ASSIGNED')continue
    if(['PLANNED','IN_PROGRESS','REMOTE_IN_PROGRESS','ON_SITE_IN_PROGRESS','ON_HOLD'].includes(target)){await update(id,target);continue}
    await update(id,'REMOTE_IN_PROGRESS');await update(id,'RESOLVED');if(target==='RESOLVED')continue
    await update(id,'VERIFIED');if(target==='CLOSED')await update(id,'CLOSED')
  }
  await app.evaluate(({dialog},folder)=>{dialog.showSaveDialog=async options=>({canceled:false,filePath:`${folder}/${options.defaultPath}`})},dataDir)
  await page.getByRole('link',{name:'보고서/통계',exact:true}).click()
  const date=await page.getByLabel('조회일',{exact:true}).inputValue()
  await expect(page.locator('.report-block').first().locator('.sb-label-text')).toHaveCount(12)
  const path=resolve(dataDir,`omnis-daily-${date}.pdf`)
  await page.getByRole('button',{name:'일일 PDF',exact:true}).click()
  await expect.poll(()=>existsSync(path)).toBe(true)
  const bytes=readFileSync(path);assert.equal(bytes.subarray(0,4).toString(),'%PDF')
  const text=pdfText(path),compact=text.replace(/\s/g,'')
  for(const label of [...labels,'일반','긴급'])assert.ok(compact.includes(label),`Missing Korean label: ${label}`)
  assert.ok(!/\b(?:RECEIVED|TRIAGED|ASSIGNED|PLANNED|IN_PROGRESS|REMOTE_IN_PROGRESS|ON_SITE_IN_PROGRESS|RESOLVED|VERIFIED|CLOSED|ON_HOLD|CANCELED|NORMAL|URGENT)\b/.test(text),text)
  assert.ok(compact.includes('가상회선<점검>&확인'))
  const totals=await invoke('reports:daily',{date}),total=totals.incidents.reduce((sum,row)=>sum+row.n,0)
  assert.equal((text.match(/INC-/g)??[]).length,total,'PDF row count matches the Korean-date daily report')
  await expect.poll(async()=>(await app.windows()).length).toBe(1)
  checks.push('The actual PDF button saves Korean labels for both severities and all twelve fault states; escaped titles remain readable')
  writeFileSync(resolve(dataDir,'report-text.txt'),text)
  await page.getByLabel('조회일',{exact:true}).fill('1990-01-01');await page.getByRole('button',{name:'조회',exact:true}).click()
  await expect(page.locator('.report-caption')).toContainText('1990-01-01')
  await page.getByRole('button',{name:'일일 PDF',exact:true}).click()
  const empty=resolve(dataDir,'omnis-daily-1990-01-01.pdf');await expect.poll(()=>existsSync(empty)).toBe(true)
  assert.ok(pdfText(empty).replace(/\s/g,'').includes('해당날짜의고장접수가없습니다.'))
  checks.push('Empty days save a readable Korean report')
  await app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true,filePath:undefined})})
  assert.equal(await invoke('reports:exportPdf',{date}),null)
  assert.deepEqual(readFileSync(path),bytes)
  await expect.poll(async()=>(await app.windows()).length).toBe(1)
  checks.push('Canceling preserves existing files and closes the hidden print window')
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,dataDir,pdf:path,checks},null,2))
}catch(error){if(page)await page.screenshot({path:resolve(dataDir,'failure.png')}).catch(()=>{});throw error}
finally{writeFileSync(resolve(dataDir,'checks.json'),JSON.stringify({checks,errors},null,2));await app.close()}
