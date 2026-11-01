import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { _electron as electron } from 'playwright'
import { electronLaunchOptions } from './electron-launch.mjs'

mkdirSync(resolve('tests/.tmp'), { recursive: true })
const dataDir = mkdtempSync(resolve('tests/.tmp/incident-counts-'))
const app = await electron.launch(electronLaunchOptions({ dataDir, packagedExecutable: process.env.OMNIS_E2E_EXE }))
const checks = []
try {
  assert.equal(resolve(await app.evaluate(({ app }) => app.getPath('userData'))), dataDir)
  const page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  const request = async (channel, payload = {}) => {
    const result = await page.evaluate(([name, input]) => window.omnis.invoke(name, input), [channel, payload])
    assert.equal(result.ok, true, `${channel}: ${JSON.stringify(result)}`)
    return result.data
  }
  const login = async (username, role) => {
    await page.getByRole('radio', { name: role === 'ADMIN' ? '관리자' : '사용자', exact: true }).click()
    await page.getByRole('textbox', { name: '아이디', exact: true }).fill(username)
    await page.getByRole('textbox', { name: '비밀번호', exact: true }).fill('Demo!2026')
    await page.getByRole('button', { name: role === 'ADMIN' ? '관리자 로그인' : '사용자 로그인', exact: true }).click()
    await page.getByRole('link', { name: '통합상황판', exact: true }).click()
    await page.getByRole('heading', { name: '통합상황판', exact: true }).waitFor()
    assert.equal((await request('auth:me')).role, role)
  }
  const badge = expected => page.waitForFunction(value => {
    const el = document.querySelector('a[href="#/incidents"] .sb-badge')
    return value === 0 ? !el : el?.textContent === String(value)
  }, expected)
  const snapshot = async label => {
    const [summary, rows] = await Promise.all([request('dashboard:getSummary'), request('incidents:list')])
    const visibleUrgent = rows.filter(row => row.severity === 'URGENT' && !['CLOSED', 'CANCELED'].includes(row.status))
    checks.push({ label, visibleRows: rows.length, urgentCount: summary.urgentCount, expectedUrgent: visibleUrgent.length })
    console.log(JSON.stringify(checks.at(-1)))
    assert.equal(summary.urgentCount, visibleUrgent.length, `${label}: badge and incident list visibility must agree`)
    const visibleIds = new Set(rows.map(row => row.id))
    assert.ok(summary.recentIncidents.every(row => visibleIds.has(row.id)))
    assert.deepEqual(summary.urgentIncidents.map(row => row.id).sort(), visibleUrgent.map(row => row.id).sort())
    return { summary, rows }
  }

  await login('demo_user', 'USER')
  const initial = await snapshot('USER without reports')
  assert.equal(initial.rows.length, 0)
  await page.getByRole('link', { name: '고장관리', exact: true }).click()
  await page.getByText('본인 접수 · 조회 0건 · 긴급 0건 미종결', { exact: true }).waitFor()
  await badge(0)
  await page.screenshot({ path: resolve(dataDir, 'user-no-reports.png') })

  // Saving on the current screen must update the badge without a route change.
  const title = '가상 사용자 긴급 고장 집계 시험'
  await page.getByRole('button', { name: '신규 고장 접수', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByRole('textbox', { name: '제목', exact: true }).fill(title)
  await form.getByRole('textbox', { name: '장애 증상', exact: true }).fill('합성 자료로 사용자별 조회와 메뉴 집계 일치를 확인합니다.')
  await form.getByRole('combobox', { name: '중요도', exact: true }).click()
  await page.getByRole('option', { name: '긴급', exact: true }).click()
  await form.getByRole('button', { name: '저장', exact: true }).click()
  await form.waitFor({ state: 'hidden' })
  await page.getByText(title, { exact: true }).waitFor()
  await badge(1)
  const owned = await snapshot('USER after urgent registration')
  assert.equal(owned.rows.length, 1)
  assert.equal(owned.summary.urgentCount, 1)
  await page.screenshot({ path: resolve(dataDir, 'user-one-report.png') })
  await page.getByRole('link', { name: '통합상황판', exact: true }).click()
  await page.getByRole('button', { name: '긴급 장애 1건 목록 보기', exact: true }).waitFor()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()

  await login('demo_admin', 'ADMIN')
  const admin = await snapshot('ADMIN global scope')
  assert.ok(admin.summary.urgentCount > 1)
  await badge(admin.summary.urgentCount)
  await page.getByRole('link', { name: '고장관리', exact: true }).click()
  await page.getByPlaceholder('제목 또는 접수번호 검색').fill(title)
  await page.getByRole('row').filter({ hasText: title }).getByRole('button', { name: '상세', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click()
  const action = page.getByRole('dialog')
  await action.getByRole('textbox', { name: '처리 메모', exact: true }).fill('집계 시험용 가상 접수 취소')
  await action.getByRole('button', { name: '처리', exact: true }).click()
  await action.waitFor({ state: 'hidden' })
  await badge(admin.summary.urgentCount - 1)
  await snapshot('ADMIN after canceling the report')
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()

  await login('demo_user', 'USER')
  const canceled = await snapshot('USER after cancellation')
  assert.equal(canceled.rows.length, 1, 'The report must remain in the list')
  assert.equal(canceled.rows[0].status, 'CANCELED')
  assert.equal(canceled.summary.urgentCount, 0, 'Canceled reports must not count as urgent open incidents')
  await badge(0)
  console.log('Incident visibility, sidebar refresh and cancellation counts passed')
} finally {
  writeFileSync(resolve(dataDir, 'checks.json'), JSON.stringify(checks, null, 2))
  await app.close()
}
