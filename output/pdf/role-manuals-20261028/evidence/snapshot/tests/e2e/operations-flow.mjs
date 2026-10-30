import { _electron as electron } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { electronLaunchOptions } from './electron-launch.mjs'

const dataDir = resolve(process.env.OMNIS_E2E_PROFILE ?? 'tests/.tmp/operations-flow-profile')
rmSync(dataDir,{recursive:true,force:true}); mkdirSync(dataDir,{recursive:true})
const packaged = process.env.OMNIS_E2E_EXE
const app = await electron.launch(electronLaunchOptions({ dataDir, packagedExecutable: packaged }))

try {
  const page = await app.firstWindow()
  await page.getByRole('button',{name:'로그인'}).click()
  await page.getByRole('link',{name:'통제·일일마감'}).waitFor()
  const invoke = async (channel,payload={}) => {
    const result = await page.evaluate(([c,p])=>window.omnis.invoke(c,p),[channel,payload])
    if (!result.ok) throw new Error(`${channel}: ${result.error?.message}`)
    return result.data
  }
  const systems = await invoke('operations:list',{})
  const teams = await invoke('control:teams',{})
  const users = await invoke('users:list',{})
  const maintainer = users.find(u=>u.role==='MAINTAINER')
  const date = '2031-03-05'

  const normal = await invoke('incidents:create',{ title:'E2E 가상 회선 장애',category:'기반통신',severity:'URGENT',description:'가상 시험 회선이 간헐 중단됨',systemId:systems[0].id,department:'가상 운용반',intakeSource:'PHONE',reporterName:'가상 신고자',equipmentName:'가상 전송장비',serviceImpact:'가상 지휘통신 일부 지연',occurredAt:new Date().toISOString() })
  await invoke('incidents:updateStatus',{id:normal.id,status:'TRIAGED',note:'통제 분류 완료'})
  const ai = await invoke('ai:triageIncident',{incidentId:normal.id,title:'E2E 가상 회선 장애',description:'가상 시험 회선이 간헐 중단됨',serviceImpact:'가상 지휘통신 일부 지연'})
  if (!ai.rationale || !ai.recommendedTeamCode || !ai.runId) throw new Error('Structured AI triage output is incomplete')
  const recommended = teams.find(t=>t.code===ai.recommendedTeamCode) ?? teams[0]
  await invoke('incidents:applyAi',{id:normal.id,category:ai.category,severity:ai.priority,teamId:recommended.id,rationale:ai.rationale,confidence:ai.confidence,runId:ai.runId})
  await invoke('incidents:assignTeam',{id:normal.id,teamId:recommended.id,userId:maintainer.id,note:'E2E 통제 배정'})
  await invoke('incidents:updateStatus',{id:normal.id,status:'REMOTE_IN_PROGRESS',note:'가상 원격 재설정'})
  await invoke('incidents:updateStatus',{id:normal.id,status:'ON_SITE_IN_PROGRESS',note:'원격 미해결로 가상 현장 전환'})
  await invoke('incidents:updateStatus',{id:normal.id,status:'RESOLVED',note:'가상 정상화',cause:'가상 커넥터 접촉 불량',actionSummary:'가상 커넥터 교체 및 신호 확인',resolutionMode:'ON_SITE',recurrenceRisk:'LOW',followUpDate:'2031-03-12'})
  await invoke('incidents:updateStatus',{id:normal.id,status:'VERIFIED',note:'통제 검증 완료'})
  await invoke('incidents:updateStatus',{id:normal.id,status:'CLOSED',note:'요청자 확인',userConfirmed:true})
  const finalIncident = await invoke('incidents:get',{id:normal.id})
  if (finalIncident.status !== 'CLOSED' || finalIncident.resolution_mode !== 'ON_SITE') throw new Error('Incident workflow did not close correctly')

  const emergency = await invoke('incidents:create',{ title:'E2E 가상 긴급 선조치',category:'작전통신',severity:'URGENT',description:'가상 작전통신 긴급 점검',intakeSource:'OPERATION_URGENT',emergencyPreaction:true,emergencyReason:'가상 작전 영향 최소화를 위한 선조치',actualActionStartedAt:new Date().toISOString(),occurredAt:new Date().toISOString() })
  const emergencyRow = await invoke('incidents:get',{id:emergency.id})
  if (!emergencyRow.emergency_preaction || !emergencyRow.actual_action_started_at) throw new Error('Emergency pre-action was not recorded')

  const maintenance = await invoke('maintenance:create',{title:'E2E 가상 연계 비계획 정비',maintenanceType:'장애정비',workKind:'UNPLANNED',priority:'HIGH',department:'가상 정비반',scheduledDate:date,incidentId:normal.id,description:'가상 연계 정비'})
  await invoke('maintenance:updateStatus',{id:maintenance.id,status:'IN_PROGRESS',progress:50})
  await invoke('maintenance:updateStatus',{id:maintenance.id,status:'COMPLETED',progress:100,result:'가상 정상화 확인',cause:'가상 커넥터 불량',actionDetail:'가상 커넥터 교체',partsUsed:'가상 커넥터 1개',resolutionMode:'ON_SITE',recurrenceRisk:'LOW',followUpDate:'2031-03-12'})

  await invoke('control:upsertDailyPlan',{date,teamId:teams[0].id,plannedCount:1,unplannedCount:1,completedCount:2,carryOverCount:0})
  const issues = await invoke('control:reconciliation',{date})
  if (!Array.isArray(issues)) throw new Error('Reconciliation did not return a list')
  await invoke('control:closeDay',{date,allowExceptions:issues.some(x=>x.status==='OPEN')})
  const overview = await invoke('control:overview',{date})
  if (!overview.closed) throw new Error('Daily close snapshot was not persisted')

  const handover = await invoke('control:handoverDraft',{date,shiftType:'DAY'})
  await invoke('control:saveHandover',{date,shiftType:'DAY',text:handover.text,confirm:true})

  await invoke('system:setAiSettings',{provider:'OLLAMA',endpoint:'http://127.0.0.1:65530/',model:'missing-demo-model'})
  const fallback = await invoke('ai:triageIncident',{title:'E2E AI 장애 복구',description:'가상 통신 중단'})
  if (!fallback.fallbackUsed || fallback.provider !== 'Local Rule') throw new Error('AI fallback was not activated')
  await invoke('system:setAiSettings',{provider:'LOCAL',endpoint:'http://127.0.0.1:11434/',model:'gemma3'})

  const demo = await invoke('demo:prepare',{scenario:'EVALUATION'})
  await invoke('demo:reset',{scenario:'EVALUATION'})
  const demoRows = await invoke('incidents:list',{search:'INC-DEMO-EVAL'})
  if (demoRows.some(r=>r.id===demo.entityIds.incidentId)) throw new Error('Evaluation scenario reset left generated rows')

  await page.getByRole('link',{name:'통제·일일마감'}).click()
  await page.getByRole('heading',{name:'통제 · 일일마감'}).waitFor()
  await page.getByRole('tab',{name:'정비반'}).click()
  await page.getByText('유선정비반').waitFor()
  console.log('Operations E2E passed: incident workflow, emergency record, linked maintenance, close, handover, AI fallback, demo lifecycle')
} finally {
  await app.close()
}
