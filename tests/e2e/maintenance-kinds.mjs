import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { _electron as electron, expect } from 'playwright/test'
import { electronLaunchOptions } from './electron-launch.mjs'

mkdirSync(resolve('tests/.tmp'), { recursive: true })
const dataDir = mkdtempSync(resolve('tests/.tmp/maintenance-kinds-'))
const launch = () => electron.launch(electronLaunchOptions({ dataDir, packagedExecutable: process.env.OMNIS_E2E_EXE }))
let app = await launch(), page
const checks = [], errors = []
const kinds = [['PLANNED', '계획'], ['UNPLANNED', '비계획'], ['EMERGENCY', '긴급'], ['FIELD', '야전'], ['DEPOT', '창']]
try {
  assert.equal(resolve(await app.evaluate(({ app }) => app.getPath('userData'))), dataDir)
  const init = async () => {
    page = await app.firstWindow(); page.setDefaultTimeout(15000)
    page.on('pageerror', e => errors.push(e.message))
  }
  await init()
  const raw = (channel, payload = {}) => page.evaluate(([c, p]) => window.omnis.invoke(c, p), [channel, payload])
  const invoke = async (channel, payload = {}) => { const r = await raw(channel, payload); assert.equal(r.ok, true, JSON.stringify(r)); return r.data }
  const login = async (username = 'demo_admin', role = 'ADMIN') => {
    await page.getByRole('radio', { name: role === 'ADMIN' ? '관리자' : '사용자', exact: true }).click()
    await page.getByRole('textbox', { name: '아이디', exact: true }).fill(username)
    await page.getByRole('textbox', { name: '비밀번호', exact: true }).fill('Demo!2026')
    await page.getByRole('button', { name: role === 'ADMIN' ? '관리자 로그인' : '사용자 로그인', exact: true }).click()
    await page.getByRole('link', { name: '정비관리', exact: true }).click()
  }
  const chooseKind = async (dialog, label) => {
    await dialog.getByRole('combobox', { name: '작업 구분', exact: true }).click()
    await expect(page.getByRole('option')).toHaveText(kinds.map(([, text]) => text))
    await page.getByRole('option', { name: label, exact: true }).click()
  }
  const search = page.getByPlaceholder('작업명 또는 작업번호 검색')
  const detail = () => page.getByRole('dialog', { name: /정비 작업 ·/ })
  const row = id => page.locator(`.MuiDataGrid-row[data-id="${id}"]`)
  const save = async dialog => { await dialog.getByRole('button', { name: '저장', exact: true }).click(); await expect(dialog).toHaveCount(0) }
  const assertDetail = async (id, label) => {
    await expect(detail().locator('dl.result-detail').first().locator('div').filter({ has: page.locator('dt', { hasText: /^구분$/ }) }).locator('dd')).toHaveText(label)
    assert.equal((await invoke('maintenance:get', { id })).status, 'PLANNED', 'Kind does not imply a workflow status change')
    await detail().getByRole('button', { name: '닫기', exact: true }).click()
    await expect(detail()).toHaveCount(0)
  }
  await login()
  const originals = (await invoke('maintenance:list')).map(r => ({ id: r.id, workKind: r.work_kind }))
  const tasks = []
  for (const [kind, label] of kinds) {
    const title = `가상 구분 검사 · ${label}`
    await page.getByRole('button', { name: '작업 등록', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '정비 작업 등록', exact: true })
    await dialog.getByRole('textbox', { name: '작업명', exact: true }).fill(title)
    await dialog.getByRole('textbox', { name: '내용', exact: true }).fill(`${label} 분류의 저장 및 상세 표시를 확인합니다.`)
    await chooseKind(dialog, label); await save(dialog)
    const task = (await invoke('maintenance:list', { search: title }))[0]
    assert.equal(task.work_kind, kind); assert.equal(task.priority, 'NORMAL')
    await search.fill(title)
    await expect(row(task.id).locator('[data-field="work_kind"]')).toHaveText(label)
    await row(task.id).getByRole('button', { name: '상세', exact: true }).click()
    await assertDetail(task.id, label)
    assert.equal((await invoke('maintenance:getEvents', { id: task.id }))[0].note, `${label} 작업 등록`)
    tasks.push(task)
  }
  checks.push('All five choices save through the real registration form and display correctly in list, details and creation history')
  await search.fill('가상 구분 검사')
  await expect(page.locator('.MuiDataGrid-row')).toHaveCount(5)
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(200)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.screenshot({ path: resolve(dataDir, `work-kinds-${width}.png`), animations: 'disabled' })
  }
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i], [kind, label] = kinds[(i + 1) % kinds.length]
    await row(task.id).getByRole('button', { name: '수정', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '정비 작업 수정', exact: true })
    await expect(dialog.getByRole('combobox', { name: '작업 구분', exact: true })).toHaveText(kinds[i][1])
    await chooseKind(dialog, label); await save(dialog)
    await expect(row(task.id).locator('[data-field="work_kind"]')).toHaveText(label)
    const saved = await invoke('maintenance:get', { id: task.id })
    assert.equal(saved.work_kind, kind); assert.equal(saved.priority, 'NORMAL')
    tasks[i] = saved
  }
  checks.push('Editing can select every classification and leaves priority and workflow status independent')
  for (const task of tasks) {
    const label = kinds.find(([kind]) => kind === task.work_kind)[1]
    await search.fill(task.title)
    await expect(page.locator('.MuiDataGrid-row')).toHaveCount(1)
    await page.getByRole('tab', { name: '캘린더', exact: true }).click()
    await page.locator(`[data-maintenance-id="${task.id}"]`).click()
    await assertDetail(task.id, label)
    await page.getByRole('tab', { name: '목록', exact: true }).click()
  }
  checks.push('Calendar details use the saved classification for all five values')
  const date = tasks[0].scheduled_date
  const base = { title: '가상 유효성 시험', maintenanceType: '점검', priority: 'NORMAL', department: '가상 정비반', scheduledDate: date }
  const countBefore = (await invoke('maintenance:list')).length
  for (const invalid of ['OTHER', '긴급', '']) {
    const r = await raw('maintenance:create', { ...base, workKind: invalid })
    assert.equal(r.ok, false); assert.equal(r.error.code, 'INVALID_INPUT')
  }
  assert.equal((await invoke('maintenance:list')).length, countBefore)
  const badUpdate = await raw('maintenance:update', { ...base, id: tasks[0].id, workKind: 'OTHER' })
  assert.equal(badUpdate.ok, false)
  assert.equal((await invoke('maintenance:get', { id: tasks[0].id })).work_kind, tasks[0].work_kind)
  const legacy = await invoke('maintenance:create', base)
  assert.equal((await invoke('maintenance:get', { id: legacy.id })).work_kind, 'PLANNED')
  checks.push('Invalid classifications are rejected without writes; omitted classification retains the legacy planned default')

  const maintainer = (await invoke('users:list')).find(u => u.username === 'demo_4')
  const team = (await invoke('control:teams')).find(t => t.code === 'TEAM-WIRE')
  const incident = await invoke('incidents:create', { title: '가상 고장 · 야전 정비 연결', category: '기반통신', severity: 'NORMAL', description: '야전 정비 분류 선택을 확인합니다.' })
  await invoke('incidents:updateStatus', { id: incident.id, status: 'TRIAGED' })
  await invoke('incidents:assignTeam', { id: incident.id, teamId: team.id, userId: maintainer.id })
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await login('demo_4', 'MAINTAINER')
  await page.evaluate(id => { location.hash = `/maintenance?fromIncident=${encodeURIComponent(id)}` }, incident.id)
  const fromIncident = page.getByRole('dialog', { name: '고장 접수에서 정비 등록', exact: true })
  await expect(fromIncident.getByRole('combobox', { name: '작업 구분', exact: true })).toHaveText('비계획')
  await chooseKind(fromIncident, '야전'); await save(fromIncident)
  await expect(detail()).toBeVisible()
  const linked = (await invoke('maintenance:list')).find(t => t.incident_id === incident.id)
  assert.equal(linked.work_kind, 'FIELD'); assert.equal(linked.assignee_id, maintainer.id)
  assert.equal(linked.department, '유선정비반')
  await assertDetail(linked.id, '야전')
  checks.push('Assigned maintainer can choose a new classification when registering from a fault, with confirmed department and owner preserved')

  await app.close(); app = await launch(); await init(); await login()
  for (const task of tasks) assert.equal((await invoke('maintenance:get', { id: task.id })).work_kind, task.work_kind)
  assert.equal((await invoke('maintenance:get', { id: linked.id })).work_kind, 'FIELD')
  const after = await invoke('maintenance:list')
  for (const original of originals) assert.equal(after.find(r => r.id === original.id).work_kind, original.workKind)
  assert.deepEqual(errors, [])
  checks.push('Selections survive an app restart and all pre-existing classifications remain unchanged')
  const result = { passed: true, dataDir, checks }
  writeFileSync(resolve(dataDir, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  if (page) await page.screenshot({ path: resolve(dataDir, 'failure.png'), animations: 'disabled' }).catch(() => {})
  console.error(JSON.stringify({ passed: false, dataDir, checks, errors }))
  throw error
} finally {
  await app.close()
}
