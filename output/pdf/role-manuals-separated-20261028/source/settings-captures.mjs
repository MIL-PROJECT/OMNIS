import {_electron as electron} from 'playwright';
import {writeFileSync} from 'node:fs';import {join} from 'node:path';import{fileURLToPath}from'node:url';
import{electronLaunchOptions}from'../evidence/snapshot/tests/e2e/electron-launch.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const k of ['ELECTRON_RUN_AS_NODE','OPENAI_API_KEY','ANTHROPIC_API_KEY','OMNIS_E2E_EXE'])delete process.env[k];
const opts=electronLaunchOptions({dataDir:join(root,'evidence/current-ui-profile')});opts.args=[join(root,'evidence/snapshot/out/main/index.js')];
const app=await electron.launch(opts),p=await app.firstWindow();await p.setViewportSize({width:1600,height:1000});
const screens=[],results=[];
const call=(c,payload={})=>p.evaluate(([c,payload])=>window.omnis.invoke(c,payload),[c,payload]);
async function login(role,id){if(await p.getByRole('button',{name:'로그아웃',exact:true}).count())await p.getByRole('button',{name:'로그아웃',exact:true}).click();await p.getByRole('radio',{name:role==='ADMIN'?'관리자':'사용자',exact:true}).click();await p.getByLabel('아이디',{exact:true}).fill(id);await p.getByLabel('비밀번호',{exact:true}).fill('Demo!2026');await p.getByRole('button',{name:/^(관리자|사용자) 로그인$/}).click();await p.getByRole('link',{name:'통합상황판',exact:true}).waitFor();}
try{
 await login('ADMIN','demo_admin');await p.getByRole('link',{name:'시스템관리',exact:true}).click();
 for(const[id,title]of[['current-settings-info','시스템 정보'],['current-settings-sla','운영 기준시간 · SLA'],['current-settings-data','데이터 관리']]){await p.locator('.ui-card').filter({hasText:title}).first().screenshot({path:join(root,'screenshots',id+'.png')});screens.push({id,caption:title,role:'ADMIN',file:'screenshots/'+id+'.png',boxes:[]});}
 const config=(await call('system:getAiSettings')).data;
 const payload={provider:'LOCAL',ollamaEndpoint:config.ollamaEndpoint,ollamaModel:config.ollamaModel,openaiModel:config.openaiModel,anthropicModel:config.anthropicModel,timeoutSeconds:15,dailyRequestLimit:50,externalAiEnabled:false,externalConsent:false};
 for(const[role,id]of[['OPERATOR','demo_1'],['MAINTAINER','demo_4'],['USER','demo_user'],['VIEWER','demo_8']]){await login(role,id);const r=await call('system:setAiSettings',payload);results.push({id:'NEW-'+role+'-SETTINGS-DENY',role,level:'내부 호출·자동화 테스트 확인',status:!r.ok&&r.error?.message==='권한이 없습니다.'?'통과':'실패',result:r});}
}finally{writeFileSync(join(root,'evidence/current-settings.json'),JSON.stringify({screens,results},null,2));await app.close();}console.log(JSON.stringify(results));
