import { _electron as electron } from 'playwright'
import Database from 'better-sqlite3'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { electronLaunchOptions } from '../evidence/snapshot/tests/e2e/electron-launch.mjs'
const base=fileURLToPath(new URL('../evidence/',import.meta.url)), dataDir=join(base,'final-probe-profile')
mkdirSync(dataDir,{recursive:true})
delete process.env.ELECTRON_RUN_AS_NODE
const app=await electron.launch(electronLaunchOptions({dataDir})), results=[]
try {
 const actual=await app.evaluate(({app})=>app.getPath('userData'))
 if(resolve(actual)!==dataDir)throw new Error('Isolation mismatch')
 const page=await app.firstWindow(); page.on('pageerror',e=>console.log('PAGEERROR',String(e)));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await page.waitForLoadState('domcontentloaded');
 console.log('STARTUP',page.url(),await page.locator('body').innerText());
 try { await page.getByRole('button',{name:'로그인'}).waitFor({timeout:15000}) } catch(e){await page.screenshot({path:join(base,'probe-startup-failure.png')});throw e}
 const invoke=(c,p={})=>page.evaluate(([c,p])=>window.omnis.invoke(c,p),[c,p])
 const call=async(c,p={})=>{const r=await invoke(c,p);if(!r.ok)throw new Error(c+': '+r.error.message);return r.data}
 const sql=async(statement,params=[],mode='all')=>{
   const db=new Database(join(dataDir,'data','omnis.db'));db.pragma('foreign_keys=ON');try{return db.prepare(statement)[mode](...params)}finally{db.close()}
 }
 const record=(id,data)=>{results.push({id,...data});writeFileSync(join(base,'probes.json'),JSON.stringify(results,null,2));console.log(id,JSON.stringify(data))}
 await call('auth:login',{username:'demo_admin',password:'Demo!2026'})
 const fixture=await call('incidents:create',{title:'AUDIT_PRIVATE_FIXTURE',category:'기반통신',severity:'NORMAL',description:'Synthetic authorization probe'})
 await call('auth:logout');await call('auth:login',{username:'demo_user',password:'Demo!2026'})
 const own=await call('incidents:list'),direct=await invoke('incidents:get',{id:fixture.id}),dash=await call('dashboard:getSummary'),similar=await call('ai:similarIncidents',{title:'AUDIT_PRIVATE_FIXTURE'}),handover=await call('control:handoverDraft',{date:'2032-01-01',shiftType:'DAY'})
 record('P01',{ownListCount:own.length,directGetDenied:!direct.ok,dashboardExposesForeign:dash.recentIncidents.some(x=>x.id===fixture.id),similarExposesForeign:similar.some(x=>x.ticket_no===fixture.ticket_no),handoverCount:handover.openIncidents.length})
 const csvPath=join(base,'probe-user-export.csv');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},csvPath)
 await call('reports:exportCsv',{kind:'incidents'});record('P02',{userCsvContainsForeign:readFileSync(csvPath,'utf8').includes(fixture.ticket_no)})
 await call('auth:logout');await call('auth:login',{username:'demo_admin',password:'Demo!2026'})
 await sql('UPDATE incidents SET reported_at=? WHERE id=?',['2032-01-01T16:00:00.000Z',fixture.id],'run')
 const daily=await call('reports:daily',{date:'2032-01-02'}),pdfPath=join(base,'probe-timezone.pdf')
 await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},pdfPath)
 await call('reports:exportPdf',{date:'2032-01-02'})
 record('P03',{fixtureTicket:fixture.ticket_no,utcTime:'2032-01-01T16:00:00.000Z',koreanDate:'2032-01-02',dailyCount:daily.incidents.reduce((s,x)=>s+x.n,0),pdfFile:'probe-timezone.pdf',pdfQueryCount:(await sql('SELECT count(*) n FROM incidents WHERE substr(reported_at,1,10)=?',['2032-01-02']))[0].n})
 const teams=await call('control:teams'),plan={date:'2032-01-03',teamId:teams[0].id,plannedCount:2,unplannedCount:0,completedCount:2,carryOverCount:0}
 await call('control:upsertDailyPlan',plan);const closed=await call('control:closeDay',{date:plan.date,allowExceptions:true});const edit=await invoke('control:upsertDailyPlan',{...plan,plannedCount:7,completedCount:7});const overview=await call('control:overview',{date:plan.date})
 record('P04',{editAfterCloseAccepted:edit.ok,closed:overview.closed,snapshotPlanned:closed.summary.planned,currentPlanned:overview.planned})
 const systems=await call('operations:list');await call('incidents:update',{id:fixture.id,title:'AUDIT_PRIVATE_FIXTURE',category:'기반통신',severity:'NORMAL',description:'Synthetic changed equipment',systemId:systems[0].id,occurredAt:'2032-01-02T03:00:00Z'})
 const after=await call('incidents:get',{id:fixture.id});record('P05',{systemIdSent:systems[0].id,systemIdPersisted:after.system_id,occurredAtPersisted:after.occurred_at,requestedOccurredAt:'2032-01-02T03:00:00Z'})
 const demo=await call('demo:prepare',{scenario:'EVALUATION'});await call('maintenance:create',{title:'AUDIT linked demo task',maintenanceType:'장애정비',workKind:'UNPLANNED',priority:'NORMAL',department:'가상 정비반',scheduledDate:'2032-01-03',incidentId:demo.entityIds.incidentId});const reset=await invoke('demo:reset',{scenario:'EVALUATION'})
 record('P06',{resetWithLinkedMaintenanceAccepted:reset.ok,error:reset.ok?null:reset.error.message})
 const emptyInvalid=await invoke('incidents:create',{title:'x',category:'기반통신',severity:'NORMAL',description:'x'}),missingEmergency=await invoke('incidents:create',{title:'가상 긴급',category:'기반통신',severity:'URGENT',description:'가상 내용',emergencyPreaction:true})
 record('P07',{shortInputRejected:!emptyInvalid.ok,shortInputCode:emptyInvalid.error?.code,missingEmergencyRejected:!missingEmergency.ok,missingEmergencyCode:missingEmergency.error?.code})
 // Validate attachment UI pipeline with a synthetic text fixture; only the OS file picker is stubbed.
 const file=join(base,'attachment-fixture.log');writeFileSync(file,'AUDIT synthetic attachment\n')
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file)
 const added=await call('attachments:add',{entityType:'INCIDENT',entityId:fixture.id,category:'LOG',note:'Synthetic audit evidence'})
 const backup=await call('system:backup');await call('attachments:delete',{id:added[0].id});const left=await call('attachments:list',{entityType:'INCIDENT',entityId:fixture.id})
 record('P08',{addedCount:added.length,sha256Length:added[0].sha256.length,afterDeleteCount:left.length,backupCreated:backup.includes(dataDir)})
 const end=await sql('PRAGMA integrity_check');record('P09',{integrity:end})
}finally{await app.close()}
