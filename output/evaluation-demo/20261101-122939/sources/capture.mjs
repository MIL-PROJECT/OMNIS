import {_electron as electron} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import net from 'node:net';
const root=resolve('release/evaluation-demo/20261101-122939'),dir=resolve(root,'recordings'),profile=resolve(dir,`profile-${Date.now()}`);
mkdirSync(profile,{recursive:true});mkdirSync(resolve(dir,'screenshots'),{recursive:true});
// A fresh userData path is mandatory. This never opens the user's OMNIS profile.
const app=await electron.launch({executablePath:'/Applications/OMNIS.app/Contents/MacOS/OMNIS',args:[],env:{...process.env,OMNIS_E2E_DATA:profile},recordVideo:{dir,size:{width:1440,height:768},showActions:{duration:850,cursor:'pointer'}}});
const page=await app.firstWindow();page.setDefaultTimeout(15000);
await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1440,768);w.setPosition(20,40);w.show();});await page.setViewportSize({width:1440,height:768});
const errors=[],dialogs=[],calls=[],manifest={profile,clips:[],errors,dialogs,calls,appVersion:await app.evaluate(({app})=>app.getVersion()),captureMethod:'Playwright Electron native recordVideo, real installed application, isolated synthetic profile',dataPreparation:'Synthetic incident and state progression use validated Main IPC; filmed review/approve/fallback/account actions use visible UI.'};
const actual=await app.evaluate(({app})=>app.getPath('userData'));if(resolve(actual)!==profile)throw Error('Isolation mismatch');
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push({message:d.message(),at:performance.now()});await d.dismiss();});
const btn=(name,scope=page)=>scope.getByRole('button',{name,exact:true}),tab=name=>page.getByRole('tab',{name,exact:true}),field=(name,scope=page)=>scope.getByRole('textbox',{name,exact:true}),modal=name=>page.getByRole('dialog',{name,exact:true});
const wait=ms=>page.waitForTimeout(ms);
async function click(el){await el.scrollIntoViewIfNeeded();await el.hover();await wait(180);await el.click();await wait(420);}
async function nav(name){await click(page.getByRole('link',{name,exact:true}));await wait(650);}
async function invoke(channel,payload={}){const r=await page.evaluate(([c,p])=>window.omnis.invoke(c,p),[channel,payload]);calls.push({channel,ok:r.ok,code:r.error?.code});if(!r.ok)throw Error(channel+': '+r.error.message);return r.data;}
const origin=performance.now();
async function shot(name){await page.screenshot({path:resolve(dir,'screenshots',name+'.png')});}
async function clip(name,fn,hold=3000){const c={name,start:(performance.now()-origin)/1000};manifest.clips.push(c);console.log('START',name);await wait(500);await fn();await wait(hold);await shot(name);c.end=(performance.now()-origin)/1000;c.duration=c.end-c.start;writeFileSync(resolve(dir,'capture.json'),JSON.stringify(manifest,null,2));console.log('DONE',name,c.duration.toFixed(2));}
let id,title='가상 운용실 회선 간헐 중단',date;
async function openIncident(){await page.getByRole('row').filter({hasText:title}).getByRole('button',{name:'상세',exact:true}).click();await wait(650);}
async function closeIncident(){const d=page.getByRole('dialog').first();if(await d.isVisible().catch(()=>false))await click(btn('닫기',d));}
async function supplement(){const d=modal('입력 내용 보완');if(!await d.isVisible().catch(()=>false))return;for(let i=0;i<await d.getByRole('textbox').count();i++)await d.getByRole('textbox').nth(i).fill('가상 운용실 단말 한 대에서 간헐 중단, 다른 단말은 정상이며 연결부 재확인이 필요합니다.');await click(btn('보완 후 분석',d));}
try{
  await btn('관리자 로그인').waitFor();await click(btn('관리자 로그인'));date=(await invoke('work:mine')).date;
  const systems=await invoke('operations:list');const selectedSystem=systems[0];if(!selectedSystem)throw Error('No synthetic system');manifest.selectedSystem={id:selectedSystem.id,name:selectedSystem.name};
  const created=await invoke('incidents:create',{systemId:selectedSystem.id,title,category:'기반통신',severity:'URGENT',description:'가상 운용실 회선이 약 5분 간격으로 중단됩니다. 다른 단말은 정상 통신을 확인했습니다.',intakeSource:'PHONE',department:'가상 운용반',reporterName:'가상 신고자',equipmentName:'가상 회선 단말',serviceImpact:'가상 운용실 단말 한 대의 자료 전송이 지연됩니다.'});
  id=created.id??created;manifest.incidentId=id;
  await invoke('incidents:updateStatus',{id,status:'TRIAGED',note:'가상 평가 사례: 신고 내용과 영향 범위 확인'});
  await clip('overview',async()=>{await nav('통합상황판');await page.mouse.move(960,350,{steps:10});},4500);
  await nav('고장관리');await field('검색').fill(title);await wait(700);
  await clip('case',async()=>{await openIncident();},5500);
  const before=await invoke('incidents:get',{id});
  await clip('ai-review',async()=>{await click(btn('AI 분류'));await supplement();await page.locator('.ai-review').waitFor();await page.locator('.ai-review').scrollIntoViewIfNeeded();await wait(3500);await shot('ai-review-before-apply');const after=await invoke('incidents:get',{id});manifest.aiReview={before:{category:before.category,severity:before.severity,team_id:before.team_id},afterAnalysis:{category:after.category,severity:after.severity,team_id:after.team_id},unchanged:before.category===after.category&&before.severity===after.severity&&before.team_id===after.team_id};if(!manifest.aiReview.unchanged)throw Error('Analysis changed business fields');await click(btn('검토 후 반영'));await wait(1200);},1500);
  const teams=await invoke('control:teams');const wire=teams.find(t=>t.code==='TEAM-WIRE')??teams[0],users=await invoke('users:list'),maintainer=users.find(u=>u.role==='MAINTAINER');
  await invoke('incidents:assignTeam',{id,teamId:wire.id,userId:maintainer.id,note:'가상 평가 사례: 유선정비반 배정'});
  for(const [status,note,extra]of[
   ['REMOTE_IN_PROGRESS','가상 원격 점검: 포트 상태 및 단말 연결 확인',{}],
   ['ON_SITE_IN_PROGRESS','가상 원격 점검 후 연결부 확인을 위해 현장 전환',{}],
   ['RESOLVED','가상 현장 통신 시험 정상 확인',{cause:'가상 회선 연결부 접촉 불량',actionSummary:'연결부 재체결 후 가상 통신 시험 3회 정상 확인',resolutionMode:'ON_SITE',recurrenceRisk:'LOW',followUpDate:date}],
   ['VERIFIED','가상 통제 담당자 조치 결과 확인',{}],
   ['CLOSED','가상 요청부서 사용자 확인 후 종결',{userConfirmed:true}]
  ])await invoke('incidents:updateStatus',{id,status,note,...extra});
  await clip('timeline',async()=>{await openIncident();await page.locator('.timeline').scrollIntoViewIfNeeded();await wait(2000);},6000);await closeIncident();
  await clip('control',async()=>{await nav('통제·일일마감');await click(tab('08:30 · 16:00 작업판'));await wait(2800);await shot('control-plan');await click(tab('정합성 · 마감'));await wait(3000);await shot('control-reconciliation');await click(tab('근무 인수인계'));await click(btn('업무현황에서 초안 생성'));await wait(3500);await shot('control-handover');},1500);
  manifest.reconciliation=await invoke('control:reconciliation',{date});manifest.closedInFilm=false;
  // Loopback port must be closed; no external service or real credential is used.
  const closed=await new Promise(resolve=>{const c=net.connect({host:'127.0.0.1',port:11435});c.once('connect',()=>{c.destroy();resolve(false)});c.once('error',()=>resolve(true));c.setTimeout(1000,()=>{c.destroy();resolve(true)});});if(!closed)throw Error('Chosen failure-demo port is in use');
  const settings=await invoke('system:getAiSettings');const payload={provider:'OLLAMA',ollamaEndpoint:'http://127.0.0.1:11435',ollamaModel:settings.ollamaModel,openaiModel:settings.openaiModel,anthropicModel:settings.anthropicModel,externalAiEnabled:false,externalConsent:false,timeoutSeconds:5,dailyRequestLimit:10};await invoke('system:setAiSettings',payload);
  await nav('고장관리');await field('검색').fill(title);await wait(600);await openIncident();
  await clip('fallback',async()=>{await click(btn('AI 분류'));await supplement();await page.locator('.ai-review').waitFor();await page.locator('.ai-review').scrollIntoViewIfNeeded();await page.getByText(/Local Rule fallback/).waitFor();await wait(4000);await shot('fallback-result');},4000);
  manifest.aiRuns=await invoke('ai:listRuns',{limit:10});const fall=manifest.aiRuns.find(r=>r.fallback_used&&r.selected_provider==='OLLAMA'&&r.provider==='LOCAL');if(!fall)throw Error('Fallback evidence not recorded');manifest.fallbackEvidence=fall;await closeIncident();await invoke('system:setAiSettings',{...payload,provider:'LOCAL'});
  await clip('security',async()=>{await nav('관리자센터');await click(tab('사용자 관리'));await field('이름·아이디·군번·소속 검색').fill('demo_user');await wait(650);await click(btn('상세',page.getByRole('row').filter({hasText:'demo_user'})));const detail=page.getByRole('dialog').first();await shot('security-detail');await click(btn('수동 잠금',detail));const confirm=modal('수동 잠금');await field('변경 사유',confirm).fill('가상 평가 프로필의 계정 상태 변경 시현');await field('관리자 비밀번호 확인',confirm).fill('Demo!2026');await wait(1500);await click(btn('확인',confirm));await confirm.waitFor({state:'hidden'});await wait(2000);await shot('security-locked');await click(btn('수동 잠금 해제',detail));const unlock=modal('수동 잠금 해제');await field('변경 사유',unlock).fill('가상 평가 시현 후 잠금 해제');await field('관리자 비밀번호 확인',unlock).fill('Demo!2026');await click(btn('확인',unlock));await unlock.waitFor({state:'hidden'});await click(btn('닫기',detail));await click(tab('감사 기록'));await wait(2800);await shot('security-audit');},2000);
  manifest.result={incident:await invoke('incidents:get',{id}),events:await invoke('incidents:getEvents',{id}),providerAfter:'LOCAL'};
  if(manifest.result.incident.status!=='CLOSED')throw Error('Incident did not close');
  if(errors.length||dialogs.length)throw Error('Unexpected UI errors/dialogs');
}catch(e){manifest.failure={message:e.message,stack:e.stack};await shot('failure').catch(()=>{});console.error(e);process.exitCode=1;}
finally{manifest.recordingEnd=(performance.now()-origin)/1000;manifest.videoPath=await page.video().path();await app.close();writeFileSync(resolve(dir,'capture.json'),JSON.stringify(manifest,null,2));console.log('CAPTURE SAVED',manifest.videoPath);}
