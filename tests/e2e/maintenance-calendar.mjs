import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { _electron as electron, expect } from 'playwright/test'
import { electronLaunchOptions } from './electron-launch.mjs'

mkdirSync(resolve('tests/.tmp'), { recursive: true })
const dataDir = mkdtempSync(resolve('tests/.tmp/maintenance-calendar-'))
const app = await electron.launch(electronLaunchOptions({ dataDir, packagedExecutable: process.env.OMNIS_E2E_EXE }))
let page
const checks = [], errors = []
try {
  assert.equal(resolve(await app.evaluate(({ app }) => app.getPath('userData'))), dataDir)
  page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => errors.push(e.message))
  const raw = (channel, payload = {}) => page.evaluate(([c, p]) => window.omnis.invoke(c, p), [channel, payload])
  const invoke = async (channel, payload = {}) => { const r = await raw(channel, payload); assert.equal(r.ok, true, JSON.stringify(r)); return r.data }
  const login = async (username, role) => {
    await page.getByRole('radio', { name: role === 'ADMIN' ? '관리자' : '사용자', exact: true }).click()
    await page.getByRole('textbox', { name: '아이디', exact: true }).fill(username)
    await page.getByRole('textbox', { name: '비밀번호', exact: true }).fill('Demo!2026')
    await page.getByRole('button', { name: role === 'ADMIN' ? '관리자 로그인' : '사용자 로그인', exact: true }).click()
    await page.getByRole('link', { name: '정비관리', exact: true }).click()
    assert.equal((await invoke('auth:me')).role, role)
  }
  const logout = () => page.getByRole('button', { name: '로그아웃', exact: true }).click()
  const calendar = page.locator('.calendar-wrap')
  const detail = page.getByRole('dialog', { name: /정비 작업 ·/ })
  const event = id => calendar.locator(`[data-maintenance-id="${id}"]`)
  const openCalendar = async () => {
    await page.getByRole('tab', { name: '캘린더', exact: true }).click()
    await calendar.locator('.fc-next-button').click()
    await expect(calendar.locator('.fc-toolbar-title')).toHaveText(monthTitle)
  }
  const close = async () => { await detail.getByRole('button', { name: '닫기', exact: true }).click(); await expect(detail).toHaveCount(0) }
  const capture = async name => {
    for (const [width, height] of [[1366, 768], [1920, 1080]]) {
      await page.setViewportSize({ width, height })
      await page.waitForTimeout(200)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.equal(await page.locator('.MuiDialogContent-root:visible').evaluateAll(nodes => nodes.some(n => n.scrollWidth > n.clientWidth + 1)), false)
      await page.screenshot({ path: resolve(dataDir, `${name}-${width}.png`), animations: 'disabled' })
    }
  }
  await login('demo_admin', 'ADMIN')
  const month = await page.evaluate(() => {
    const d = new Date(), next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return { year: next.getFullYear(), month: next.getMonth() + 1 }
  })
  const monthTitle = `${month.year}년 ${month.month}월`
  const date = day => `${month.year}-${String(month.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const maintainer = (await invoke('users:list')).find(u => u.username === 'demo_4')
  const create = (title, day, extra = {}) => invoke('maintenance:create', {
    title, maintenanceType: '네트워크 점검', workKind: 'PLANNED', priority: 'NORMAL', department: '가상 유선정비반',
    scheduledDate: date(day), description: `가상 작업 상세 설명 · ${day}일`, checklistTemplateId: null, ...extra
  })
  const first = await create('가상 동일 작업명 · 캘린더 상세', 5)
  const second = await create('가상 동일 작업명 · 캘린더 상세', 6)
  const completed = await create('가상 완료 작업 · 결과 확인', 7)
  await invoke('maintenance:updateStatus', { id: completed.id, status: 'IN_PROGRESS', progress: 50 })
  await invoke('maintenance:updateStatus', { id: completed.id, status: 'COMPLETED', progress: 100, result: '가상 점검 정상 완료', cause: '가상 접점 불량', actionDetail: '가상 접점 청소', partsUsed: '', resolutionMode: 'REMOTE', recurrenceRisk: 'LOW' })
  const own = await create('가상 담당 정비 작업', 8, { assigneeId: maintainer.id })
  const crowded = []
  for (let i = 0; i < 5; i++) crowded.push(await create(`가상 더보기 작업 ${i + 1}`, 10))
  await page.getByRole('link', { name: '통합상황판', exact: true }).click()
  await page.getByRole('link', { name: '정비관리', exact: true }).click()
  await openCalendar()
  await capture('calendar')

  // Update after the calendar loaded: detail must fetch the current record, not its cached summary.
  await invoke('maintenance:updateStatus', { id: first.id, status: 'IN_PROGRESS', progress: 50 })
  const before = await invoke('maintenance:get', { id: first.id }), history = await invoke('maintenance:getEvents', { id: first.id })
  await event(first.id).click()
  await expect(detail).toBeVisible()
  await expect(detail.getByText(first.task_no, { exact: false })).toBeVisible()
  await expect(detail.getByText('가상 작업 상세 설명 · 5일', { exact: true })).toBeVisible()
  await expect(detail.locator('.stat-row .status-pill').first()).toHaveText('진행')
  await expect(detail.getByText('가상 유선정비반', { exact: true })).toBeVisible()
  await expect(detail.locator('.timeline li')).toHaveCount(history.length)
  await capture('calendar-detail')
  await close()
  assert.deepEqual(await invoke('maintenance:get', { id: first.id }), before)
  assert.deepEqual(await invoke('maintenance:getEvents', { id: first.id }), history)
  await expect(page.getByRole('tab', { name: '캘린더', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(calendar.locator('.fc-toolbar-title')).toHaveText(monthTitle)
  await expect(event(first.id)).toBeFocused()
  checks.push('Calendar click opens fresh details and history without modifying the task; closing retains month, tab and focus')

  await event(second.id).focus(); await page.keyboard.press('Enter')
  await expect(detail.getByText(`정비 작업 · ${second.task_no}`, { exact: true })).toBeVisible()
  await expect(detail.getByText('가상 작업 상세 설명 · 6일', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape'); await expect(detail).toHaveCount(0)
  await expect(event(second.id)).toBeFocused()
  await event(completed.id).focus(); await page.keyboard.press('Space')
  await expect(detail.getByText('가상 점검 정상 완료', { exact: true })).toBeVisible()
  await expect(detail.getByRole('textbox', { name: '작업 결과', exact: true })).toHaveCount(0)
  await expect(detail.getByRole('button', { name: '진행', exact: true })).toHaveCount(0)
  await close()
  checks.push('Identical titles resolve by task ID; Enter/Space and Escape work; completed tasks show read-only results')

  await calendar.locator(`[data-date="${date(10)}"] .fc-daygrid-more-link`).click()
  const popover = calendar.locator('.fc-more-popover')
  await expect(popover).toBeVisible()
  await popover.locator(`[data-maintenance-id="${crowded[4].id}"]`).click()
  await expect(detail.getByText(`정비 작업 · ${crowded[4].task_no}`, { exact: true })).toBeVisible()
  await close()
  // Close a remaining more-events popover before changing screen.
  if (await popover.isVisible()) await popover.locator('.fc-popover-close').click()
  checks.push('Items inside the calendar more-events popover open their own details')

  await logout(); await login('demo_4', 'MAINTAINER'); await openCalendar()
  await event(own.id).click()
  await expect(detail.getByText(`정비 작업 · ${own.task_no}`, { exact: true })).toBeVisible()
  await expect(detail.getByRole('textbox', { name: '작업 결과', exact: true })).toBeVisible()
  await close()
  await event(first.id).click()
  await expect(page.getByRole('alert').filter({ hasText: '권한이 없습니다.' })).toBeVisible()
  await expect(detail).toHaveCount(0)
  assert.equal((await raw('maintenance:get', { id: first.id })).ok, false)
  checks.push('Maintainer opens assigned tasks; other assignees remain protected with a visible error')
  for (const [username, role] of [['demo_1', 'OPERATOR'], ['demo_8', 'VIEWER']]) {
    await logout(); await login(username, role); await openCalendar()
    await event(second.id).click()
    await expect(detail.getByText('가상 작업 상세 설명 · 6일', { exact: true })).toBeVisible()
    await expect(detail.getByRole('textbox', { name: '작업 결과', exact: true })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: '진행', exact: true })).toHaveCount(0)
    await close()
    checks.push(`${role} can inspect details without gaining maintenance editing privileges`)
  }
  assert.deepEqual(errors, [])
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
