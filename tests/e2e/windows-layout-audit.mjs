import { _electron as electron } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const stamp = process.env.OMNIS_LAYOUT_STAMP ?? String(Date.now())
const output = resolve('reports', `windows-layout-${stamp}`)
const profile = resolve('tests/.tmp', `windows-layout-${stamp}`)
mkdirSync(output, { recursive: true })
mkdirSync(profile, { recursive: true })
const executable = process.env.OMNIS_E2E_EXE ?? JSON.parse(readFileSync('release/windows-validation-20261104-local/installation.json','utf8').replace(/^\uFEFF/,'')).executable
const env = { ...process.env, OMNIS_E2E_DATA: profile }
delete env.ELECTRON_RUN_AS_NODE
delete env.OPENAI_API_KEY
delete env.ANTHROPIC_API_KEY
const args = process.env.OMNIS_LAYOUT_SCALE ? [`--force-device-scale-factor=${process.env.OMNIS_LAYOUT_SCALE}`] : []
const app = await electron.launch({ executablePath: executable, args, env })
let page
const results = [], errors = [], skipped = []
const sizes = [[1268,662],[1280,720],[1366,768],[1536,864],[1920,1080]]
const native = await app.evaluate(({app,screen,BrowserWindow}) => {
  const win=BrowserWindow.getAllWindows()[0]
  return { version:app.getVersion(),packaged:app.isPackaged,displays:screen.getAllDisplays().map(d=>({bounds:d.bounds,workArea:d.workArea,scaleFactor:d.scaleFactor})),bounds:win.getBounds(),contentBounds:win.getContentBounds(),minimumSize:win.getMinimumSize() }
})
const save=()=>writeFileSync(resolve(output,'audit.json'),JSON.stringify({output,profile,executable,native,results,errors,skipped},null,2))
async function nav(url){
  await page.evaluate(url=>{location.hash=`#${url}`},url)
  await page.locator('.workspace').waitFor()
  await page.waitForTimeout(180)
}
async function tab(name){await page.getByRole('tab',{name,exact:true}).click();await page.waitForTimeout(130)}
async function button(name){await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(130)}
async function close(){
  await page.keyboard.press('Escape')
  await page.waitForTimeout(130)
}
async function measure(){
  return page.evaluate(()=>{
    const visible=e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>1&&r.height>1&&c.visibility!=='hidden'&&c.display!=='none'&&c.opacity!=='0'}
    const clipped=[]
    const elements=[...document.querySelectorAll('button,input,textarea,[role="combobox"],.page-header,.ui-card-head,.MuiDialogActions-root')].filter(visible)
    for(const el of elements){
      if(el.closest('.MuiDataGrid-virtualScroller,.MuiTabs-scroller,.MuiMenu-paper'))continue
      const r=el.getBoundingClientRect(),label=(el.getAttribute('aria-label')||el.innerText||el.getAttribute('placeholder')||el.getAttribute('name')||el.tagName).trim().slice(0,90)
      let blocker
      for(let parent=el.parentElement;parent;parent=parent.parentElement){
        const c=getComputedStyle(parent),p=parent.getBoundingClientRect()
        if(['hidden','clip'].includes(c.overflowX)&&parent.clientWidth>0&&(r.left<p.left-2||r.right>p.right+2)){blocker={reason:'horizontal-hidden',ancestor:parent.className};break}
        if(['hidden','clip'].includes(c.overflowY)&&parent.clientHeight>0&&(r.top<p.top-2||r.bottom>p.bottom+2)){blocker={reason:'vertical-hidden',ancestor:parent.className};break}
        if(['auto','scroll'].includes(c.overflowX)||['auto','scroll'].includes(c.overflowY))break
      }
      if(blocker)clipped.push({label,...blocker,rect:{x:r.x,y:r.y,width:r.width,height:r.height}})
    }
    const dialogs=[...document.querySelectorAll('.MuiDialog-paper')].filter(visible).map(el=>{const r=el.getBoundingClientRect();return {label:el.querySelector('h2')?.innerText,rect:{x:r.x,y:r.y,width:r.width,height:r.height},outside:r.x<-1||r.y<-1||r.right>innerWidth+1||r.bottom>innerHeight+1,bodyOverflow:[...el.querySelectorAll('.MuiDialogContent-root')].some(n=>n.scrollWidth>n.clientWidth+2)}})
    const containers=[...document.querySelectorAll('.workspace,main,.MuiDialogContent-root,.MuiDialogActions-root,.ui-toolbar,.ui-card-head')].filter(visible).filter(el=>!el.closest('.MuiDataGrid-root')).map(el=>({className:el.className,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,overflow:getComputedStyle(el).overflowX})).filter(el=>el.scrollWidth>el.clientWidth+2)
    return {width:innerWidth,height:innerHeight,devicePixelRatio,documentOverflow:document.documentElement.scrollWidth>innerWidth+1,dialogs,clipped,containers,workspaceScroll:document.querySelector('.workspace')?{height:document.querySelector('.workspace').clientHeight,scrollHeight:document.querySelector('.workspace').scrollHeight}:null}
  })
}
async function capture(name,dimensions=sizes){
  for(const[width,height]of dimensions){
    await page.setViewportSize({width,height})
    await page.evaluate(async()=>{await document.fonts.ready;document.querySelector('.workspace')?.scrollTo(0,0);for(const el of document.querySelectorAll('.MuiDialogContent-root'))el.scrollTop=0})
    await page.waitForTimeout(100)
    const metrics=await measure(),file=`${String(results.length+1).padStart(3,'0')}-${name}-${width}.png`
    await page.screenshot({path:resolve(output,file),animations:'disabled'})
    results.push({name,width,height,file,metrics})
    const scroll=await page.evaluate(()=>{const el=[...document.querySelectorAll('.MuiDialogContent-root')].at(-1)??document.querySelector('.workspace');if(el&&el.scrollHeight>el.clientHeight+80){el.scrollTop=el.scrollHeight;return true}return false})
    if(scroll){await page.waitForTimeout(60);const bottom=file.replace('.png','-bottom.png');await page.screenshot({path:resolve(output,bottom),animations:'disabled'});results.at(-1).bottomFile=bottom;results.at(-1).bottomMetrics=await measure()}
    save()
  }
  console.log(`CAPTURE ${name}`)
}
async function attempt(name,fn){if(process.env.OMNIS_LAYOUT_ONLY&&!process.env.OMNIS_LAYOUT_ONLY.split(',').includes(name))return;try{await fn()}catch(e){skipped.push({name,error:e.message});save();console.log(`INCOMPLETE ${name}: ${e.message.split('\n')[0]}`);while(await page.getByRole('dialog').count())await close()}}

try{
  page=await app.firstWindow();page.setDefaultTimeout(6000)
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push(`Native dialog: ${d.message()}`);await d.dismiss()})
  await capture('login')
  await attempt('signup',async()=>{await button('사용자 등록 신청');await capture('signup');await close()})
  await button('관리자 로그인')
  const states=[
    ['dashboard','/'],['my-work','/?view=mine'],['operations','/operations'],['incidents','/incidents'],
    ['maintenance-list','/maintenance'],['maintenance-calendar','/maintenance','캘린더'],['maintenance-incident-queue','/maintenance','배정 고장'],
    ['control-alerts','/control'],['control-plans','/control','08:30 · 16:00 작업판'],['control-reconcile','/control','정합성 · 마감'],['control-handover','/control','근무 인수인계'],['control-teams','/control','정비반'],
    ['duty','/duty'],['directives','/duty','지시사항'],['ai-empty','/ai'],['reports-daily','/reports'],['reports-weekly','/reports','주간'],['manuals','/manuals'],
    ['settings-info','/settings'],['settings-notifications','/settings','알림'],['settings-audit','/settings','감사 로그'],['settings-templates','/settings','업무 템플릿'],['settings-departments','/settings','조치부서'],
    ['signups-legacy','/signups'],['admin-overview','/admin?section=overview'],['admin-users','/admin?section=users'],['admin-signups','/admin?section=signups'],['admin-security','/admin?section=security'],['admin-audit','/admin?section=audit'],['admin-organization','/admin?section=organization'],['admin-templates','/admin?section=organization','업무 템플릿'],['admin-system','/admin?section=system']
  ]
  for(const[name,url,selectedTab]of states)await attempt(name,async()=>{await nav(url);if(selectedTab)await tab(selectedTab);await capture(name)})
  const dialogs=[
    ['system-create','/operations','체계 등록'],['incident-create','/incidents','신규 고장 접수'],['maintenance-create','/maintenance','작업 등록'],['recurring-list','/maintenance','반복 정비'],['duty-create','/duty','근무 등록'],['alert-create','/control','상황경보 등록']
  ]
  for(const[name,url,action]of dialogs)await attempt(name,async()=>{await nav(url);await button(action);await page.getByRole('dialog').last().waitFor();await capture(name);await close()})
  await attempt('recurring-create',async()=>{await nav('/maintenance');await button('반복 정비');await button('반복 규칙 등록');await capture('recurring-create');await close();await close()})
  await attempt('directive-create',async()=>{await nav('/duty');await tab('지시사항');await button('지시사항 등록');await capture('directive-create');await close()})
  for(const[name,url]of [['system-detail','/operations'],['incident-detail','/incidents'],['maintenance-detail','/maintenance']])await attempt(name,async()=>{await nav(url);await page.getByRole('button',{name:'상세',exact:true}).first().click();await page.getByRole('dialog').last().waitFor();await capture(name);await close()})
  await attempt('template-edit',async()=>{await nav('/settings');await tab('업무 템플릿');await page.getByRole('button',{name:'수정',exact:true}).first().click();await capture('template-edit');await close()})
  await attempt('department-create',async()=>{await nav('/settings');await tab('조치부서');await button('조치부서 추가');await capture('department-create');await close()})
  await attempt('ai-results',async()=>{await nav('/ai');await page.getByRole('textbox',{name:'제목',exact:true}).fill('가상 서버 네트워크 접속 불가');await page.getByRole('textbox',{name:'내용',exact:true}).fill('일부 단말에서 간헐적으로 접속이 끊기는 가상 시험 상황입니다.');await button('분석 및 유사 고장 조회');if(await page.getByRole('dialog',{name:'입력 내용 보완',exact:true}).count()){await capture('ai-input-assist');await button('현재 내용으로 분석')}await button('일일 요약 생성');await button('정비 우선순위 조회');await capture('ai-results');await page.locator('.ai-result').scrollIntoViewIfNeeded();await capture('ai-triage-result');await button('AI 실행 이력');await capture('ai-runs');await close()})
  await attempt('password-change',async()=>{await nav('/');await button('비밀번호 변경');await capture('password-change');await close()})
  await attempt('notification-drawer',async()=>{await nav('/');await button('개인 알림함');await capture('notification-drawer');await button('알림함 닫기')})
  for(const[name,label]of [['settings-openai','OpenAI Responses API'],['settings-anthropic','Anthropic Claude'],['settings-ollama','Ollama (로컬)']])await attempt(name,async()=>{await nav('/settings');await tab('정보');await page.getByRole('combobox',{name:'Provider',exact:true}).click();const option=page.getByRole('option',{name:label,exact:true});if(await option.count())await option.click();else{const options=await page.getByRole('option').allTextContents();throw new Error(`Provider label ${label}; available ${options.join(', ')}`)}await capture(name)})
  await attempt('user-detail',async()=>{await nav('/admin?section=users');const row=page.getByRole('row').filter({hasText:'demo_1'});await (await row.count()?row.getByRole('button',{name:'상세',exact:true}):page.getByRole('button',{name:'상세',exact:true}).first()).click();await capture('user-detail');await page.getByRole('dialog').getByRole('combobox',{name:'역할',exact:true}).click();await page.getByRole('option',{name:'정비요원',exact:true}).click();await button('권한 변경');await capture('user-role-change');await close();await button('이 사용자 변경 이력');await capture('user-history');await close();await close()})
  await attempt('signup-review',async()=>{await nav('/admin?section=signups');await page.getByRole('button',{name:'승인',exact:true}).first().click();await capture('signup-approval');await close();await page.getByRole('button',{name:'반려',exact:true}).first().click();await capture('signup-rejection');await close();await page.locator('.MuiDataGrid-row').first().click();await capture('signup-detail');await close()})
  await attempt('alert-detail',async()=>{await nav('/control');await page.getByRole('button',{name:'상황경보 상세보기',exact:true}).first().click();await capture('alert-detail');await close()})
  for(const[role,username]of [['OPERATOR','demo_1'],['MAINTAINER','demo_4'],['USER','demo_user'],['VIEWER','demo_8']])await attempt(`role-${role}`,async()=>{
    await button('로그아웃');await page.getByRole('radio',{name:'사용자',exact:true}).click();await page.getByRole('textbox',{name:'아이디',exact:true}).fill(username);await page.getByRole('textbox',{name:'비밀번호',exact:true}).fill('Demo!2026');await button('사용자 로그인');await page.locator('.sidebar').waitFor()
    const paths=await page.locator('.sb-nav a,.sb-manual-link').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.getAttribute('href').replace(/^#/,'')))])
    for(const path of paths){await nav(path);await capture(`${role.toLowerCase()}-${path.replace(/[^a-z]/g,'')||'dashboard'}`,[[1268,662],[1920,1080]])}
  })
  // Native display scaling is inspected separately; viewport tests do not change OS DPI.
  save()
  console.log(JSON.stringify({output,states:[...new Set(results.map(r=>r.name))].length,captures:results.length,incomplete:skipped.length,rendererErrors:errors.length,native},null,2))
}finally{save();await app.close()}
