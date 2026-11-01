import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { _electron as electron, expect } from 'playwright/test'
import { electronLaunchOptions } from './electron-launch.mjs'

mkdirSync(resolve('tests/.tmp'), { recursive: true })
const dataDir = mkdtempSync(resolve('tests/.tmp/control-alerts-'))
const app = await electron.launch(electronLaunchOptions({ dataDir, packagedExecutable: process.env.OMNIS_E2E_EXE }))
let page
const errors = [], checks = []
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
    await page.getByRole('link', { name: '통제·일일마감', exact: true }).click()
    assert.equal((await invoke('auth:me')).role, role)
  }
  const logout = () => page.getByRole('button', { name: '로그아웃', exact: true }).click()
  const row = title => page.getByRole('row').filter({ hasText: title })
  const create = async title => {
    await page.getByRole('button', { name: '상황경보 등록', exact: true }).click()
    const dialog = page.getByRole('dialog')
    for (const [label, value] of [['제목', title], ['내용', '가상 GPS 수신 품질 저하 관측\n현장 재확인 필요'], ['영향 범위', '가상 기지 일부'], ['조치 지침', '예비 항법장비 확인 후 상황반에 보고'], ['담당 부서', '가상 운용통제반']]) {
      await dialog.getByRole('textbox', { name: label, exact: true }).fill(value)
    }
    await dialog.getByRole('button', { name: '등록', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(row(title)).toBeVisible()
    return (await invoke('control:alerts')).find(a => a.title === title)
  }
  const capture = async name => {
    for (const [width, height] of [[1366, 768], [1920, 1080]]) {
      await page.setViewportSize({ width, height })
      await expect.poll(() => page.getByRole('columnheader').last().evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(width)
      await page.waitForTimeout(200)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      const grid = await page.locator('.MuiDataGrid-virtualScroller').evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, children: Array.from(el.children).map(child => ({ className: child.className, width: child.getBoundingClientRect().width, scrollWidth: child.scrollWidth })) }))
      assert.ok(grid.scrollWidth <= grid.width + 1, JSON.stringify(grid))
      await page.screenshot({ path: resolve(dataDir, `${name}-${width}.png`), animations: 'disabled' })
    }
  }

  await login('demo_admin', 'ADMIN')
  const incidentsBefore = await invoke('incidents:list')
  const title = '가상 GPS 수신 주의 · 상황경보 처리 확인'
  const alert = await create(title)
  assert.equal(alert.status, 'OPEN')
  await capture('alerts-open')
  await row(title).getByRole('button', { name: '상황경보 상세보기', exact: true }).click()
  let detail = page.getByRole('dialog', { name: '상황경보 상세', exact: true })
  await expect(detail.getByText('예비 항법장비 확인 후 상황반에 보고', { exact: true })).toBeVisible()
  await expect(detail.getByText('가상 운용통제반', { exact: true })).toBeVisible()
  await detail.getByRole('button', { name: '상황 확인', exact: true }).click()
  await expect(detail.getByRole('button', { name: '상황 확인', exact: true })).toHaveCount(0)
  let saved = (await invoke('control:alerts')).find(a => a.id === alert.id)
  assert.equal(saved.status, 'ACKNOWLEDGED'); assert.ok(saved.acknowledged_at)
  await detail.getByRole('button', { name: '상황 종료', exact: true }).click()
  await expect(detail.getByRole('button', { name: '상황 종료', exact: true })).toHaveCount(0)
  saved = (await invoke('control:alerts')).find(a => a.id === alert.id)
  assert.equal(saved.status, 'RESOLVED'); assert.ok(saved.resolved_at)
  await expect(detail.getByText(/종료된 경보입니다/)).toBeVisible()
  await detail.screenshot({ path: resolve(dataDir, 'alert-detail-resolved.png'), animations: 'disabled' })
  await detail.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(row(title).getByRole('button', { name: '상황경보 상세보기', exact: true })).toBeVisible()
  assert.deepEqual(await invoke('incidents:list'), incidentsBefore, 'Alert processing must not modify fault records')
  checks.push('Administrator creates, reads, acknowledges and resolves an alert; history remains and fault records stay unchanged')

  await page.getByRole('tab', { name: '정합성 · 마감', exact: true }).click()
  await expect(page.locator('.control-issue-grid .status-pill').first()).toBeVisible()
  await capture('reconciliation')
  const gaps = await page.locator('.control-issue-grid .control-issue-status[role="gridcell"]').evaluateAll(cells => cells.map(cell => {
    const pill = cell.querySelector('.status-pill')
    return cell.getBoundingClientRect().right - pill.getBoundingClientRect().right
  }))
  assert.ok(gaps.length > 0 && gaps.every(gap => gap >= 24), JSON.stringify(gaps))
  await expect(page.getByText('고장 조치결과 누락', { exact: true }).first()).toBeVisible()
  checks.push('Reconciliation status badges have at least 24 px of right clearance and readable Korean issue names')

  await logout(); await login('demo_1', 'OPERATOR')
  const active = await create('가상 통신망 상황 · 조회 권한 확인')
  checks.push('Operator can create an alert through the visible registration action')
  await logout()
  for (const [username, role] of [['demo_4', 'MAINTAINER'], ['demo_user', 'USER'], ['demo_8', 'VIEWER']]) {
    await login(username, role)
    await expect(page.getByRole('button', { name: '상황경보 등록', exact: true })).toHaveCount(0)
    await row(active.title).getByRole('button', { name: '상황경보 상세보기', exact: true }).click()
    detail = page.getByRole('dialog', { name: '상황경보 상세', exact: true })
    await expect(detail.getByText('예비 항법장비 확인 후 상황반에 보고', { exact: true })).toBeVisible()
    await expect(detail.getByRole('button', { name: '상황 확인', exact: true })).toHaveCount(0)
    await expect(detail.getByRole('button', { name: '상황 종료', exact: true })).toHaveCount(0)
    for (const action of ['ACKNOWLEDGE', 'RESOLVE']) assert.equal((await raw('control:updateAlert', { id: active.id, action })).ok, false)
    assert.equal((await raw('control:createAlert', { alertType: 'SERVER', severity: 'WARNING', title: '권한 확인', description: '가상 경보', occurredAt: new Date().toISOString() })).ok, false)
    await detail.getByRole('button', { name: '닫기', exact: true }).click()
    if (role === 'MAINTAINER') await capture('alerts-readonly')
    await logout()
    checks.push(`${role} can inspect the alert and instructions but cannot create or process it in UI or IPC`)
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: true, dataDir, checks }, null, 2))
} catch (error) {
  if (page) await page.screenshot({ path: resolve(dataDir, 'failure.png'), animations: 'disabled' }).catch(() => {})
  throw error
} finally {
  writeFileSync(resolve(dataDir, 'checks.json'), JSON.stringify({ checks, errors }, null, 2))
  await app.close()
}
