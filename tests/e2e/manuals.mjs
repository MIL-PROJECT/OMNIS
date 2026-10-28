import { _electron as electron,expect } from 'playwright/test'
import {mkdirSync,rmSync,readFileSync} from 'node:fs'
import {resolve,join,sep} from 'node:path'
import {createHash} from 'node:crypto'
import {electronLaunchOptions} from './electron-launch.mjs'
const root=resolve('tests/.tmp'),dataDir=resolve(process.env.OMNIS_E2E_PROFILE??'tests/.tmp/manuals-profile')
if(!dataDir.startsWith(root+sep))throw new Error('Isolated profile required')
rmSync(dataDir,{recursive:true,force:true});mkdirSync(dataDir,{recursive:true})
const app=await electron.launch(electronLaunchOptions({dataDir,packagedExecutable:process.env.OMNIS_E2E_EXE})),page=await app.firstWindow(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
const invoke=(c,p={})=>page.evaluate(([c,p])=>window.omnis.invoke(c,p),[c,p])
const hash=data=>createHash('sha256').update(data).digest('hex')
try{
 expect((await invoke('manuals:list')).ok).toBe(false)
 await page.getByRole('button',{name:'관리자 로그인',exact:true}).click()
 await page.getByRole('link',{name:'사용자 매뉴얼',exact:true}).click()
 await expect(page.getByRole('heading',{name:'사용자 매뉴얼',exact:true})).toBeVisible()
 await expect(page.locator('.manual-row')).toHaveCount(5)
 await expect(page.locator('.manual-row').first()).toContainText('관리자 매뉴얼')
 await app.evaluate(({dialog,shell},dir)=>{
  globalThis.__manualTest={dir,mode:'save',count:0,opened:[]}
  dialog.showSaveDialog=async options=>{const state=globalThis.__manualTest;state.lastOptions=options;return state.mode==='cancel'?{canceled:true}:{canceled:false,filePath:`${state.dir}/saved-${++state.count}.pdf`}}
  shell.openPath=async path=>{globalThis.__manualTest.opened.push(path);return globalThis.__manualTest.mode==='open-fail'?'No viewer':''}
 },dataDir)
 const docs=[['ADMIN','관리자'],['OPERATOR','운용요원'],['MAINTAINER','정비요원'],['USER','일반 사용자'],['VIEWER','조회전용']]
 for(const [i,[role,title]] of docs.entries()){
  await page.getByRole('button',{name:`${title} 매뉴얼 다운로드`,exact:true}).click()
  await expect(page.getByRole('alert').filter({hasText:'선택한 위치에'})).toBeVisible()
  expect(hash(readFileSync(join(dataDir,`saved-${i+1}.pdf`)))).toBe(hash(readFileSync(resolve(`resources/manuals/${role}.pdf`))))
  await page.getByRole('button',{name:`${title} PDF 열기`,exact:true}).click()
  await expect(page.getByRole('button',{name:`${title} PDF 열기`,exact:true})).toBeEnabled()
 }
 const opened=await app.evaluate(()=>globalThis.__manualTest.opened)
 expect(opened.map(p=>p.replaceAll('\\','/').split('/').at(-1))).toEqual(docs.map(([role])=>`${role}.pdf`))
 expect((await invoke('manuals:save',{role:'../../outside'})).ok).toBe(false)
 await app.evaluate(()=>{globalThis.__manualTest.mode='cancel'})
 await page.getByRole('button',{name:'관리자 매뉴얼 다운로드',exact:true}).click()
 await expect(page.getByRole('button',{name:'관리자 매뉴얼 다운로드',exact:true})).toBeEnabled()
 await expect(page.getByRole('alert').filter({hasText:'선택한 위치에'})).toHaveCount(0)
 await app.evaluate(()=>{globalThis.__manualTest.mode='open-fail'})
 await page.getByRole('button',{name:'관리자 PDF 열기',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'PDF를 열 수 없습니다'})).toBeVisible()
 await app.evaluate(()=>{globalThis.__manualTest.mode='save'})
 await page.getByRole('button',{name:'관리자 PDF 열기',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'PDF를 열 수 없습니다'})).toHaveCount(0)
 for(const [width,height] of [[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});await page.screenshot({path:resolve(`tests/.tmp/manuals-${width}.png`),animations:'disabled'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await expect(page.getByRole('link',{name:'사용자 매뉴얼',exact:true})).toBeVisible()
  expect(await page.getByRole('button',{name:'로그아웃',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})).toBe(true)
  for(const btn of await page.locator('.manual-actions button').all())expect(await btn.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})).toBe(true)
 }
 for(const [username,title] of [['demo_1','운용요원'],['demo_4','정비요원'],['demo_user','일반 사용자'],['demo_8','조회전용']]){
  await page.getByRole('button',{name:'로그아웃',exact:true}).click()
  await page.getByRole('radio',{name:'사용자',exact:true}).click()
  await page.getByRole('textbox',{name:'아이디',exact:true}).fill(username)
  await page.getByRole('textbox',{name:'비밀번호',exact:true}).fill('Demo!2026')
  await page.getByRole('button',{name:'사용자 로그인',exact:true}).click()
  await page.getByRole('link',{name:'사용자 매뉴얼',exact:true}).click()
  await expect(page.locator('.manual-row').first()).toContainText(`${title} 매뉴얼`)
  expect((await invoke('manuals:list')).data).toHaveLength(5)
  await page.getByRole('button',{name:`${title} 매뉴얼 다운로드`,exact:true}).click()
  await expect(page.getByRole('alert').filter({hasText:'선택한 위치에'})).toBeVisible()
 }
 expect(errors).toEqual([])
 console.log('Manuals E2E passed: sidebar, all roles, five exact PDF downloads, open handler, cancel/error recovery, path rejection, 1366/1920 layout')
}finally{await app.close()}
