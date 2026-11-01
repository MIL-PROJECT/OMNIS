import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { _electron as electron, expect } from 'playwright/test'
import { electronLaunchOptions } from './electron-launch.mjs'

mkdirSync(resolve('tests/.tmp'),{recursive:true})
const dataDir=mkdtempSync(resolve('tests/.tmp/dashboard-alerts-'))
const app=await electron.launch(electronLaunchOptions({dataDir,packagedExecutable:process.env.OMNIS_E2E_EXE}))
let page;const checks=[],errors=[]
try{
  assert.equal(resolve(await app.evaluate(({app})=>app.getPath('userData'))),dataDir)
  page=await app.firstWindow();page.setDefaultTimeout(15000)
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept())
  const raw=(channel,payload={})=>page.evaluate(([c,p])=>window.omnis.invoke(c,p),[channel,payload])
  const invoke=async(c,p={})=>{const r=await raw(c,p);assert.equal(r.ok,true,JSON.stringify(r));return r.data}
  const login=async(username,role)=>{
    await page.getByRole('radio',{name:role==='ADMIN'?'관리자':'사용자',exact:true}).click()
    await page.getByRole('textbox',{name:'아이디',exact:true}).fill(username)
    await page.getByRole('textbox',{name:'비밀번호',exact:true}).fill('Demo!2026')
    await page.getByRole('button',{name:role==='ADMIN'?'관리자 로그인':'사용자 로그인',exact:true}).click()
    await page.getByRole('heading',{name:'통합상황판',exact:true}).waitFor()
    assert.equal((await invoke('auth:me')).role,role)
  }
  const home=()=>page.getByRole('link',{name:'통합상황판',exact:true}).click()
  const count=()=>page.locator('.dashboard-alert-count')
  const preview=()=>page.getByRole('region',{name:'미종료 상황경보',exact:true})
  const panel=()=>page.locator('.dashboard-alert-panel')
  const closePanel=async()=>{await page.getByRole('button',{name:'상황경보 패널 닫기',exact:true}).click();await expect(panel()).toHaveCount(0)}
  const add=async(title,severity='WARNING',occurredAt='2026-11-01T09:00:00.000Z')=>{
    const result=await invoke('control:createAlert',{alertType:'SERVER',severity,title,description:'가상 상황 내용\n운영 확인 요청',impactScope:'가상 기지 통신망 '.repeat(20),actionGuidance:'예비 장비 전환 후 가상 상황반 보고',department:'가상 통제반',occurredAt})
    return {...result,title}
  }
  const status=id=>invoke('control:alerts').then(rows=>rows.find(row=>row.id===id).status)
  const capture=async name=>{
    for(const [width,height]of [[1366,768],[1440,900],[1920,1080]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready)
      await expect.poll(()=>page.locator('.dash .dashboard-grid').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(width)
      await page.waitForTimeout(300)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Document horizontal overflow')
      const cards=await page.locator('.dash .dashboard-grid>.panel').evaluateAll(nodes=>nodes.map(node=>({height:node.clientHeight,bottom:node.getBoundingClientRect().bottom,body:node.querySelector('.ui-paged-body')?.clientHeight})))
      assert.equal(cards.length,4);assert.ok(cards.every(card=>card.height>=120&&card.bottom<=height),JSON.stringify({width,height,cards}))
      if(await preview().count()){
        await expect(preview().locator('.dashboard-alert-row:visible')).toHaveCount(height<=880?1:2)
        assert.ok(await preview().evaluate(el=>el.getBoundingClientRect().height)<=(height<=880?52:80))
      }
      await page.screenshot({path:resolve(dataDir,`${name}-${width}.png`),animations:'disabled'})
    }
  }
  const capturePanel=async name=>{
    for(const [width,height]of [[1366,768],[1440,900],[1920,1080]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(250)
      const bounds=await panel().evaluate(el=>({right:el.getBoundingClientRect().right,bottom:el.getBoundingClientRect().bottom,width:el.clientWidth,scrollWidth:el.scrollWidth}))
      assert.ok(bounds.right<=width&&bounds.bottom<=height&&bounds.scrollWidth<=bounds.width+1,JSON.stringify(bounds))
      await page.screenshot({path:resolve(dataDir,`${name}-${width}.png`),animations:'disabled'})
    }
  }
  await login('demo_admin','ADMIN')
  for(const alert of await invoke('control:alerts'))if(alert.status!=='RESOLVED')await invoke('control:updateAlert',{id:alert.id,action:'RESOLVE'})
  await expect(count()).toHaveAttribute('aria-label','상황경보 목록 보기 0건')
  await expect(preview()).toHaveCount(0)
  await count().focus();await page.keyboard.press('Space');await expect(panel().getByText('미종료 상황경보가 없습니다.',{exact:true})).toBeVisible()
  await closePanel();checks.push('Zero active alerts preserve the original dashboard and still allow history access')

  const old=await add('가상 긴급 서버 · 긴 제목과 영향범위 표시 검증 '.repeat(3),'CRITICAL','2026-11-01T08:00:00.000Z')
  await expect(count()).toHaveAttribute('aria-label','상황경보 목록 보기 1건')
  await expect(preview().locator('.dashboard-alert-row:visible')).toHaveCount(1)
  const acknowledged=await add('가상 확인한 긴급 상황','CRITICAL','2026-11-01T10:00:00.000Z')
  await invoke('control:updateAlert',{id:acknowledged.id,action:'ACKNOWLEDGE'})
  const latest=await add('가상 미확인 긴급 서버','CRITICAL','2026-11-01T09:00:00.000Z')
  for(let i=0;i<8;i++)await add(`가상 ${i}번 ${i%2?'정보':'주의'} 상황`,i%2?'INFO':'WARNING',`2026-11-01T11:0${i}:00.000Z`)
  await expect(count()).toHaveAttribute('aria-label','상황경보 목록 보기 11건')
  const summary=await invoke('dashboard:getSummary')
  assert.equal(summary.openAlertCount,11);assert.equal(summary.criticalAlertCount,3)
  assert.deepEqual(summary.activeAlertPreview.map(a=>a.id),[latest.id,old.id])
  await capture('dashboard-active-alerts')
  checks.push('Live change events update counts and bounded priority previews; all four cards fit three viewport sizes')

  await preview().getByRole('button',{name:`${old.title} 상세보기`,exact:true}).focus()
  await page.keyboard.press('Enter')
  await expect(panel().getByText(old.title,{exact:true})).toBeVisible()
  await expect(panel().getByText('예비 장비 전환 후 가상 상황반 보고',{exact:true})).toBeVisible()
  assert.equal(await status(old.id),'OPEN','Reading must not acknowledge an alert')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await invoke('control:updateAlert',{id:old.id,action:'RESOLVE'})
  await expect(panel().locator('.control-alert-detail-head')).toContainText('종료')
  await expect(count()).toHaveAttribute('aria-label','상황경보 목록 보기 10건')
  await capturePanel('drawer-detail-resolved')
  await page.keyboard.press('Escape');await expect(panel()).toHaveCount(0);await expect(count()).toBeFocused()
  checks.push('Keyboard opens full shared details without status mutation; resolving an open detail refreshes it and restores focus safely')

  await preview().getByRole('button',{name:'상황경보 전체 보기',exact:true}).click()
  await expect(panel().getByText('미종료 10건',{exact:true})).toBeVisible()
  await panel().getByRole('button',{name:'2 번째 페이지로 이동',exact:true}).click()
  const pageLabel=await panel().locator('.dashboard-alert-panel-footer>span').textContent()
  const item=panel().locator('.dashboard-alert-list-row').first(),itemName=await item.getAttribute('aria-label')
  await item.click();await page.getByRole('button',{name:'경보 목록으로',exact:true}).click()
  await expect(panel().locator('.dashboard-alert-panel-footer>span')).toHaveText(pageLabel)
  await expect(panel().getByRole('button',{name:itemName,exact:true})).toBeVisible()
  await panel().getByLabel('종료 이력 포함',{exact:true}).check()
  await expect(panel().getByText('전체 이력 12건',{exact:true})).toBeVisible()
  await capturePanel('drawer-history')
  await closePanel();checks.push('Full list paginates, preserves list position and clearly includes resolved history on request')

  await preview().getByRole('button',{name:`${latest.title} 상세보기`,exact:true}).click()
  await page.getByRole('button',{name:'통제에서 처리',exact:true}).click()
  const control=page.getByRole('dialog',{name:'상황경보 상세',exact:true})
  await expect(control.getByText(latest.alertNo,{exact:true})).toBeVisible()
  await control.getByRole('button',{name:'상황 확인',exact:true}).click()
  await expect(control.getByRole('button',{name:'상황 확인',exact:true})).toHaveCount(0)
  await control.getByRole('button',{name:'닫기',exact:true}).click()
  await page.evaluate(()=>{location.hash='/control?alertId=missing-alert'})
  await expect(page.getByText('경보를 찾을 수 없습니다.',{exact:true})).toBeVisible()
  await expect(control).toHaveCount(0)
  await home();checks.push('Control handoff opens the exact alert; invalid IDs return to the list without repeated dialogs')

  for(const [username,role]of [['demo_1','OPERATOR'],['demo_4','MAINTAINER'],['demo_user','USER'],['demo_8','VIEWER']]){
    await page.getByRole('button',{name:'로그아웃',exact:true}).click();await login(username,role)
    await count().click();await panel().locator('.dashboard-alert-list-row').first().click()
    await expect(page.getByRole('button',{name:role==='OPERATOR'?'통제에서 처리':'통제에서 보기',exact:true})).toBeVisible()
    await expect(panel().getByRole('button',{name:'상황 확인',exact:true})).toHaveCount(0)
    if(role!=='OPERATOR'){
      assert.equal((await raw('control:updateAlert',{id:acknowledged.id,action:'RESOLVE'})).ok,false)
      assert.equal((await raw('control:createAlert',{alertType:'SERVER',severity:'WARNING',title:'권한 검증',description:'가상 상황',occurredAt:new Date().toISOString()})).ok,false)
    }
    if(role==='USER'){
      const me=await invoke('auth:me'),own=await invoke('dashboard:getSummary')
      assert.ok(own.recentIncidents.every(incident=>incident.reported_by===me.id))
    }
    await closePanel();checks.push(`${role} keeps existing read/process rights and incident scope`)
  }
  // Fault injection affects this isolated test process only; production handlers
  // and the user's profile are never modified.
  const rows=await invoke('control:alerts'),missing=(await invoke('dashboard:getSummary')).activeAlertPreview[0]
  await app.evaluate(({ipcMain},remaining)=>{
    ipcMain.removeHandler('control:alerts')
    ipcMain.handle('control:alerts',()=>({ok:true,data:remaining}))
  },rows.filter(row=>row.id!==missing.id))
  await preview().getByRole('button',{name:`${missing.title} 상세보기`,exact:true}).click()
  await expect(panel().getByText('경보를 찾을 수 없습니다.',{exact:true})).toBeVisible()
  await expect(panel().locator('.dashboard-alert-list-row').first()).toBeVisible()
  await closePanel();checks.push('A stale preview whose ID is no longer available returns safely to the panel list')
  const lastCount=await count().getAttribute('aria-label')
  await count().click();await panel().locator('.dashboard-alert-list-row').first().click()
  const lastTitle=await panel().locator('.control-alert-detail-title').textContent()
  await app.evaluate(({ipcMain})=>{
    for(const channel of ['dashboard:getSummary','control:alerts']){
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel,()=>({ok:false,error:{code:'REQUEST_FAILED',message:'Isolated verification failure'}}))
    }
  })
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(panel().getByText('경보를 갱신하지 못했습니다.',{exact:true})).toBeVisible()
  await expect(panel().locator('.control-alert-detail-title')).toHaveText(lastTitle)
  await expect(count()).toHaveAttribute('aria-label',lastCount)
  await closePanel();await expect(page.locator('.dashboard-refresh-error')).toHaveText('갱신 실패')
  await expect(page.getByRole('button',{name:'다시 시도',exact:true})).toBeVisible()
  checks.push('Read failures preserve the last good dashboard and open detail instead of showing zero or dismissing the panel')
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,dataDir,checks},null,2))
}catch(error){if(page)await page.screenshot({path:resolve(dataDir,'failure.png'),animations:'disabled'}).catch(()=>{});throw error}
finally{writeFileSync(resolve(dataDir,'checks.json'),JSON.stringify({checks,errors},null,2));await app.close()}
