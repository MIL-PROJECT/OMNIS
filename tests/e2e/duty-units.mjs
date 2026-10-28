import { _electron as electron, expect } from 'playwright/test'
import { mkdirSync,rmSync } from 'node:fs'
import { resolve,sep } from 'node:path'
import {electronLaunchOptions} from './electron-launch.mjs'
const root=resolve('tests/.tmp'),dataDir=resolve('tests/.tmp/duty-units-profile')
if(!dataDir.startsWith(root+sep))throw new Error('Isolated profile required')
rmSync(dataDir,{recursive:true,force:true});mkdirSync(dataDir,{recursive:true})
const app=await electron.launch(electronLaunchOptions({dataDir})),page=await app.firstWindow(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
const invoke=async(c,p={})=>{const r=await page.evaluate(([c,p])=>window.omnis.invoke(c,p),[c,p]);if(!r.ok)throw new Error(r.error.message);return r.data}
const choose=async(scope,label,name)=>{await scope.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name,exact:true}).click()}
try {
 await page.getByRole('button',{name:'관리자 로그인',exact:true}).click()
 await page.evaluate(()=>{location.hash='/duty'})
 const base=(await invoke('duty:list')).length
 await choose(page,'부대급','비행단급');await choose(page,'소속 부대','제20전투비행단')
 const roster=page.getByRole('list',{name:'부대 담당자 명부',exact:true})
 await expect(roster.getByRole('listitem')).toHaveCount(10)
 await expect(page.getByText(`조회 0건 / 전체 ${base}건`,{exact:true})).toBeVisible()
 for(const [width,height] of [[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});await page.screenshot({path:resolve(`tests/.tmp/duty-roster-no-schedule-${width}.png`),animations:'disabled'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  for(const item of await roster.getByRole('listitem').all())expect(await item.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true)
 }
 expect((await invoke('duty:list')).length).toBe(base)
 await roster.getByRole('button').first().click()
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText('부대 담당자 10명')
 await expect(page.getByRole('dialog').getByRole('combobox',{name:'담당자 1',exact:true})).toContainText((await invoke('organizations:members',{unitId:'W20'}))[0].display_name)
 await page.getByRole('dialog').getByRole('button',{name:'취소',exact:true}).click()
 await choose(page,'부대급','여단급');await choose(page,'소속 부대','제2미사일방어여단')
 await expect(roster.getByRole('listitem')).toHaveCount(10)
 await expect(roster).not.toContainText('제20전투비행단')
 await page.getByRole('button',{name:'근무 등록',exact:true}).click()
 const dialog=page.getByRole('dialog')
 for(const [level,unit,id] of [['비행단급','제20전투비행단','W20'],['여단급','제2미사일방어여단','B02'],['전대급','제7항공통신전대','G07']]){
  await choose(dialog,'부대급',level);await choose(dialog,'소속 부대',unit)
  await expect(dialog.getByRole('alert')).toContainText('부대 담당자 10명')
  await dialog.getByRole('combobox',{name:'담당자 1',exact:true}).click()
  await expect(page.getByRole('option')).toHaveCount(10)
  const members=await invoke('organizations:members',{unitId:id})
  for(const m of members)await expect(page.getByRole('option').filter({hasText:m.display_name})).toHaveCount(1)
  await page.getByRole('option').first().click()
 }
 await choose(dialog,'부대급','여단급');await choose(dialog,'소속 부대','제2미사일방어여단')
 await expect(dialog.getByRole('alert')).toContainText('부대 담당자 10명')
 await expect(dialog.getByRole('button',{name:'저장',exact:true})).toBeDisabled()
 await dialog.getByLabel('일자',{exact:true}).fill('2035-04-05')
 await dialog.getByRole('combobox',{name:'담당자 1',exact:true}).click();await page.getByRole('option').first().click()
 await dialog.getByRole('textbox',{name:'직책 1',exact:true}).fill('가상 부대별 근무 시험')
 await dialog.getByRole('button',{name:'담당자 추가',exact:true}).click()
 await dialog.getByRole('combobox',{name:'담당자 2',exact:true}).click()
 await expect(page.getByRole('option',{disabled:true})).toHaveCount(1)
 await page.keyboard.press('Escape')
 for(const [width,height] of [[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});await page.screenshot({path:resolve(`tests/.tmp/duty-unit-form-${width}.png`)})
  expect(await dialog.locator('.MuiDialogContent-root').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
 }
 await dialog.getByRole('button',{name:'저장',exact:true}).click();await expect(dialog).toHaveCount(0)
 expect((await invoke('duty:list')).length).toBe(base+2)
 const saved=(await invoke('duty:list')).filter(d=>d.duty_date==='2035-04-05')
 expect(saved).toHaveLength(2);for(const d of saved)expect(d.unit_id).toBe('B02')
 await choose(page,'부대급','여단급');await choose(page,'소속 부대','제2미사일방어여단')
 const row=page.getByRole('row').filter({hasText:'가상 부대별 근무 시험'})
 await expect(row).toHaveCount(1);await expect(row).toContainText('제2미사일방어여단')
 await row.getByRole('button',{name:'수정',exact:true}).click()
 await expect(dialog.getByRole('combobox',{name:'소속 부대',exact:true})).toHaveValue('제2미사일방어여단')
 await expect(dialog.getByRole('alert')).toContainText('부대 담당자 10명')
 await dialog.getByRole('combobox',{name:'담당자',exact:true}).click();await expect(page.getByRole('option')).toHaveCount(10);await page.getByRole('option').last().click()
 await dialog.getByRole('button',{name:'저장',exact:true}).click();await expect(dialog).toHaveCount(0)
 const updated=(await invoke('duty:list')).find(d=>d.position==='가상 부대별 근무 시험')
 expect(updated.unit_id).toBe('B02');expect(updated.user_id).not.toBe(saved.find(d=>d.position==='가상 부대별 근무 시험').user_id)
 await choose(page,'부대급','비행단급');await choose(page,'소속 부대','제20전투비행단');await expect(page.getByRole('row').filter({hasText:'가상 부대별 근무 시험'})).toHaveCount(0)
 expect(errors).toEqual([])
 console.log('Duty units E2E passed: wing/brigade/group 10 contacts, create two, duplicate prevention, edit, unit filter, 1366/1920 layout')
}finally{await app.close()}
