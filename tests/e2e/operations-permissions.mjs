import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { resolve } from 'node:path'
import { _electron as electron } from 'playwright'
import { electronLaunchOptions } from './electron-launch.mjs'

// Every run gets a separate synthetic profile; never use the installed app's data.
mkdirSync(resolve('tests/.tmp'), { recursive: true })
const dataDir = mkdtempSync(resolve('tests/.tmp/operations-permissions-'))
const app = await electron.launch(electronLaunchOptions({ dataDir, packagedExecutable: process.env.OMNIS_E2E_EXE }))
try {
  const actualDataDir = await app.evaluate(({ app }) => app.getPath('userData'))
  assert.equal(resolve(actualDataDir), dataDir, 'E2E profile must be isolated')
  const page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  const invoke = (channel, payload = {}) => page.evaluate(
    ([name, input]) => window.omnis.invoke(name, input), [channel, payload]
  )
  const list = async () => {
    const result = await invoke('operations:list')
    assert.equal(result.ok, true, JSON.stringify(result))
    return result.data
  }
  const roles = [
    { username: 'demo_admin', role: 'ADMIN', canCreate: true },
    { username: 'demo_1', role: 'OPERATOR', canCreate: true },
    { username: 'demo_user', role: 'USER', canCreate: false },
    { username: 'demo_4', role: 'MAINTAINER', canCreate: false },
    { username: 'demo_8', role: 'VIEWER', canCreate: false }
  ]
  for (const { username, role, canCreate } of roles) {
    const admin = role === 'ADMIN'
    await page.getByRole('radio', { name: admin ? '관리자' : '사용자', exact: true }).click()
    await page.getByRole('textbox', { name: '아이디', exact: true }).fill(username)
    await page.getByRole('textbox', { name: '비밀번호', exact: true }).fill('Demo!2026')
    await page.getByRole('button', { name: admin ? '관리자 로그인' : '사용자 로그인', exact: true }).click()
    await page.getByRole('link', { name: '운영현황', exact: true }).click()
    await page.getByRole('heading', { name: '운영현황', exact: true }).waitFor()
    const session = await invoke('auth:me')
    assert.equal(session.ok, true)
    assert.equal(session.data.role, role)
    assert.equal(await page.getByRole('button', { name: '체계 등록', exact: true }).count(), canCreate ? 1 : 0,
      `${role}: registration button visibility`)

    // A valid direct IPC request must be rejected as well as hidden in the UI.
    const before = await list()
    const payload = {
      code: `RBAC-${role}-API`, name: `권한시험 ${role} 직접 등록`,
      category: '기반통신', status: 'NORMAL', uptimePct: 100, remarks: '격리 권한 시험'
    }
    const result = await invoke('operations:create', payload)
    assert.equal(result.ok, canCreate, `${role}: ${JSON.stringify(result)}`)
    const after = await list()
    if (!canCreate) {
      assert.equal(result.error.code, 'FORBIDDEN')
      assert.equal(after.length, before.length, `${role}: denied request must not add a system`)
      assert.equal(after.some(row => row.code === payload.code), false)
    } else {
      assert.equal(after.length, before.length + 1)
      assert.equal(after.find(row => row.id === result.data.id)?.name, payload.name)
      const history = await invoke('operations:getHistory', { id: result.data.id })
      assert.equal(history.ok, true)
      assert.equal(history.data.length, 1)
      assert.equal(history.data[0].status, 'NORMAL')

      // Both allowed roles can also register through the actual form and see the saved result.
      await page.getByRole('button', { name: '체계 등록', exact: true }).click()
      const dialog = page.getByRole('dialog')
      const code = `RBAC-${role}-UI`, name = `권한시험 ${role} 화면 등록`
      await dialog.getByRole('textbox', { name: '코드', exact: true }).fill(code)
      await dialog.getByRole('textbox', { name: '체계명', exact: true }).fill(name)
      await dialog.getByRole('button', { name: '저장', exact: true }).click()
      await dialog.waitFor({ state: 'hidden' })
      await page.getByPlaceholder('체계명 또는 코드 검색').fill(code)
      await page.getByText(name, { exact: true }).waitFor()
      assert.equal((await list()).find(row => row.code === code)?.name, name)
    }
    console.log(`${role}: button, direct request and persisted result verified (${canCreate ? 'allowed' : 'denied'})`)
    await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  }
  console.log('System registration permissions passed for all 5 roles')
} finally {
  await app.close()
}
