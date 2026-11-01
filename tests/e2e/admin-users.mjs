import { _electron as electron } from 'playwright'
import { strict as assert } from 'node:assert'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { electronLaunchOptions } from './electron-launch.mjs'
const label = process.env.OMNIS_E2E_EXE ? 'packaged' : 'source',
  output = resolve('tests/.tmp/admin-users', label),
  dataDir = resolve(output, `profile-${Date.now()}`)
mkdirSync(dataDir, { recursive: true })
let app = await electron.launch(
  electronLaunchOptions({
    dataDir,
    packagedExecutable: process.env.OMNIS_E2E_EXE
  })
)
let page = await app.firstWindow()
const errors = [],
  checks = []
page.setDefaultTimeout(15000)
page.on('pageerror', (e) => errors.push(e.message))
const raw = (c, p = {}) =>
  page.evaluate(
    ([channel, payload]) => window.omnis.invoke(channel, payload),
    [c, p]
  )
const invoke = async (c, p = {}) => {
  const r = await raw(c, p)
  if (!r.ok) throw new Error(`${c}: ${r.error.code} ${r.error.message}`)
  return r.data
}
const adminLogin = () =>
  invoke('auth:login', { username: 'demo_admin', password: 'Demo!2026' })
const stamp = String(Date.now()).slice(-6),
  username = `admin_test_${stamp}`,
  password = 'Account!2032',
  newPassword = 'Replaced!2032'
async function openUser() {
  await page.getByRole('tab', { name: '사용자 관리', exact: true }).click()
  const kind = page.getByRole('combobox', { name: '계정 종류', exact: true })
  await kind.click()
  await page.getByRole('option', { name: '로그인 계정', exact: true }).click()
  await page
    .getByRole('textbox', { name: '이름·아이디·군번·소속 검색' })
    .fill(username)
  await page
    .getByRole('row')
    .filter({ hasText: username })
    .getByRole('button', { name: '상세', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: '사용자 상세 · 관리시험', exact: true })
    .waitFor()
}
async function mutate(action) {
  const detail = page.getByRole('dialog', {
    name: '사용자 상세 · 관리시험',
    exact: true
  })
  await detail.getByRole('button', { name: action, exact: true }).click()
  const confirm = page.getByRole('dialog', { name: action, exact: true })
  await confirm
    .getByRole('textbox', { name: '변경 사유', exact: true })
    .fill('격리 E2E 관리자 변경 검증')
  await confirm
    .getByRole('textbox', { name: '관리자 비밀번호 확인', exact: true })
    .fill('Demo!2026')
  await confirm.getByRole('button', { name: '확인', exact: true }).click()
  await confirm.waitFor({ state: 'hidden' })
}
try {
  const actual = await app.evaluate(({ app }) => app.getPath('userData'))
  assert.equal(resolve(actual), dataDir)
  await page.getByRole('button', { name: '관리자 로그인', exact: true }).click()
  await page.getByRole('link', { name: '관리자센터', exact: true }).click()
  await page.getByRole('heading', { name: '관리자센터', exact: true }).waitFor()
  const summary = await invoke('admin:summary')
  assert.equal(summary.contacts, 220)
  assert.equal(summary.loginAccounts, 11)
  await invoke('auth:register', {
    serviceNo: `24-8${stamp}1`,
    username,
    password,
    displayName: '관리시험',
    rankName: '하사',
    unitName: '가상 검증부대'
  })
  await page.getByRole('tab', { name: '등록 승인', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: username })
  await row.getByRole('button', { name: '승인', exact: true }).click()
  await page
    .getByRole('dialog', { name: '사용자 승인', exact: true })
    .getByRole('button', { name: '승인', exact: true })
    .click()
  await row.waitFor({ state: 'detached' })
  checks.push('signup approved in administrator center')
  await openUser()
  await page
    .getByRole('dialog', { name: '사용자 상세 · 관리시험', exact: true })
    .getByRole('combobox', { name: '역할', exact: true })
    .click()
  await page.getByRole('option', { name: '운용요원', exact: true }).click()
  await mutate('권한 변경')
  const target = (await invoke('admin:users', { search: username })).rows[0]
  assert.equal(target.role, 'OPERATOR')
  await invoke('auth:login', { username, password })
  assert.equal((await raw('admin:users')).error.code, 'FORBIDDEN')
  assert.equal((await raw('system:backup')).ok, false)
  await invoke('control:createAlert', {
    alertType: 'OTHER',
    severity: 'INFO',
    title: '가상 역할 검증',
    description: '운용요원 권한으로 가상 경보 생성',
    occurredAt: new Date().toISOString()
  })
  await adminLogin()
  checks.push('role change applied in Main, admin API bypass rejected')
  await mutate('수동 잠금')
  assert.equal(
    (await raw('auth:login', { username, password })).error.code,
    'AUTH_ACCOUNT_LOCKED'
  )
  await adminLogin()
  await mutate('수동 잠금 해제')
  assert.equal(
    (await invoke('auth:login', { username, password })).role,
    'OPERATOR'
  )
  await adminLogin()
  const existingIncident = await invoke('incidents:create',{title:'가상 관리자 배정 보존 시험',category:'기반통신',severity:'NORMAL',description:'사용 중지 이후에도 담당자 이력을 보존하는지 확인합니다.'})
  await invoke('incidents:updateStatus',{id:existingIncident.id,status:'TRIAGED'})
  const assignmentTeam=(await invoke('control:teams')).find(t=>t.code==='TEAM-WIRE')
  await invoke('incidents:assignTeam',{id:existingIncident.id,teamId:assignmentTeam.id,userId:target.id})
  await invoke('incidents:assign', {
    id: existingIncident.id,
    userId: target.id
  })
  await mutate('사용 중지')
  assert.equal(
    (await invoke('incidents:list')).find((r) => r.id === existingIncident.id)
      .assignee_name,
    '관리시험'
  )
  assert.equal((await raw('auth:login', { username, password })).ok, false)
  await adminLogin()
  await mutate('재활성화')
  checks.push('manual lock/unlock, disable/reactivate and sign-in restrictions')
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await raw('auth:login', { username, password: 'incorrect' })).ok,
      false
    )
  await app.close()
  app = await electron.launch(
    electronLaunchOptions({
      dataDir,
      packagedExecutable: process.env.OMNIS_E2E_EXE
    })
  )
  page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  page.on('pageerror', (e) => errors.push(e.message))
  await page.getByRole('button', { name: '관리자 로그인', exact: true }).click()
  await page.getByRole('link', { name: '관리자센터', exact: true }).click()
  const persistedLock = await invoke('admin:user', { id: target.id })
  assert.equal(persistedLock.failed_attempts, 5)
  assert(persistedLock.lock_until > new Date().toISOString())
  await openUser()
  await mutate('자동 잠금 해제')
  checks.push('persistent login failure lock cleared in UI')
  await mutate('비밀번호 초기화')
  const temporaryDialog = page.getByRole('dialog', {
    name: '임시 비밀번호 · 한 번만 표시',
    exact: true
  })
  const temporary = (
    await temporaryDialog.getByTestId('temporary-password').textContent()
  ).trim()
  assert.match(temporary, /^Tmp!/)
  await temporaryDialog
    .getByRole('button', { name: '확인하고 닫기', exact: true })
    .click()
  const audit = await invoke('admin:audit', {
    targetId: target.id,
    pageSize: 100
  })
  assert(audit.rows.some((r) => r.action === 'USER_RESET_PASSWORD'))
  assert(!JSON.stringify(audit).includes(temporary))
  assert(!JSON.stringify(audit).includes('password_hash'))
  await page
    .getByRole('dialog', { name: '사용자 상세 · 관리시험', exact: true })
    .getByRole('button', { name: '닫기', exact: true })
    .click()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await page.getByRole('radio', { name: '사용자', exact: true }).click()
  await page
    .getByRole('textbox', { name: '아이디', exact: true })
    .fill(username)
  await page
    .getByRole('textbox', { name: '비밀번호', exact: true })
    .fill(temporary)
  await page.getByRole('button', { name: '사용자 로그인', exact: true }).click()
  const forced = page.getByRole('dialog', {
    name: '첫 로그인 · 비밀번호 변경',
    exact: true
  })
  await forced.waitFor()
  assert.equal(
    (await raw('dashboard:getSummary')).error.code,
    'AUTH_PASSWORD_CHANGE_REQUIRED'
  )
  await forced
    .getByRole('textbox', { name: '임시 비밀번호', exact: true })
    .fill(temporary)
  await forced
    .getByRole('textbox', { name: '새 비밀번호', exact: true })
    .fill(newPassword)
  await forced
    .getByRole('textbox', { name: '새 비밀번호 확인', exact: true })
    .fill(newPassword)
  await forced
    .getByRole('button', { name: '비밀번호 변경', exact: true })
    .click()
  await page.getByRole('link', { name: '통합상황판', exact: true }).waitFor()
  assert.equal(
    await page.getByRole('link', { name: '관리자센터', exact: true }).count(),
    0
  )
  assert.equal((await raw('admin:audit')).error.code, 'FORBIDDEN')
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await page.getByRole('radio', { name: '사용자', exact: true }).click()
  await page
    .getByRole('textbox', { name: '아이디', exact: true })
    .fill(username)
  await page
    .getByRole('textbox', { name: '비밀번호', exact: true })
    .fill(newPassword)
  await page.getByRole('button', { name: '사용자 로그인', exact: true }).click()
  await page.getByRole('link', { name: '통합상황판', exact: true }).waitFor()
  checks.push(
    'temporary credential restricted to password change; new password and role work'
  )
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await page.getByRole('radio', { name: '관리자', exact: true }).click()
  await page
    .getByRole('textbox', { name: '비밀번호', exact: true })
    .fill('Demo!2026')
  await page.getByRole('button', { name: '관리자 로그인', exact: true }).click()
  await page.getByRole('link', { name: '관리자센터', exact: true }).click()
  await page.getByRole('tab', { name: '역할·접속 보안', exact: true }).click()
  await page
    .getByRole('spinbutton', { name: '자동 잠금 실패 횟수', exact: true })
    .fill('4')
  await page
    .getByRole('button', { name: '접속 정책 저장', exact: true })
    .click()
  const policy = page.getByRole('dialog', {
    name: '접속 정책 변경 확인',
    exact: true
  })
  await policy
    .getByRole('textbox', { name: '변경 사유', exact: true })
    .fill('가상 보안 정책 검사')
  await policy
    .getByRole('textbox', { name: '관리자 비밀번호 확인', exact: true })
    .fill('Demo!2026')
  await policy.getByRole('button', { name: '확인', exact: true }).click()
  await policy.waitFor({ state: 'hidden' })
  assert.equal((await invoke('admin:securityPolicy')).failedLimit, 4)
  await page.getByRole('tab', { name: '사용자 관리', exact: true }).click()
  await page.getByRole('combobox', { name: '계정 종류', exact: true }).click()
  await page.getByRole('option', { name: '가상 담당자', exact: true }).click()
  await page.waitForFunction(() =>
    document
      .querySelector('.admin-grid .MuiDataGrid-row [data-field="username"]')
      ?.textContent?.startsWith('org_demo_')
  )
  await page
    .locator('.admin-grid .MuiDataGrid-row')
    .first()
    .getByRole('button', { name: '상세', exact: true })
    .click()
  const contact = page.getByRole('dialog').last()
  await contact
    .getByText('가상 담당자 (로그인 불가)', { exact: true })
    .waitFor()
  assert.equal(
    await contact
      .getByRole('button', { name: '비밀번호 초기화', exact: true })
      .count(),
    0
  )
  await contact.getByRole('button', { name: '닫기', exact: true }).click()
  await openUser()
  await page
    .getByRole('dialog', { name: '사용자 상세 · 관리시험', exact: true })
    .getByRole('button', { name: '이 사용자 변경 이력', exact: true })
    .click()
  const history = page.getByRole('dialog', {
    name: '사용자 변경 이력 · 관리시험',
    exact: true
  })
  await history
    .getByRole('button', { name: '보기', exact: true })
    .first()
    .click()
  const auditDetail = page.getByRole('dialog', { name: /변경 상세/ }).last()
  await auditDetail
    .getByRole('heading', { name: '변경 전', exact: true })
    .waitFor()
  assert(!(await auditDetail.textContent()).includes(temporary))
  await auditDetail.getByRole('button', { name: '닫기', exact: true }).click()
  await history.getByRole('button', { name: '닫기', exact: true }).click()
  await page
    .getByRole('dialog', { name: '사용자 상세 · 관리시험', exact: true })
    .getByRole('button', { name: '닫기', exact: true })
    .click()
  checks.push(
    'contact management blocked; target audit history and safe before/after details'
  )
  const sections = [
    '관리 현황',
    '사용자 관리',
    '등록 승인',
    '역할·접속 보안',
    '감사 기록',
    '조직·업무 설정',
    '시스템·데이터'
  ]
  for (const [width, height] of [
    [1366, 768],
    [1440, 900],
    [1600, 950],
    [1920, 1080]
  ]) {
    await page.setViewportSize({ width, height })
    for (const [index, name] of sections.entries()) {
      await page.getByRole('tab', { name, exact: true }).click()
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r))
          )
      )
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
      assert(overflow <= 1, `${name}: body overflow ${overflow} at ${width}`)
      if (name === '사용자 관리' || name === '감사 기록') {
        await page.locator('.admin-grid').first().waitFor()
        await page.waitForFunction(
          () => {
            const grid = document.querySelector('.admin-grid'),
              v = grid?.querySelector('.MuiDataGrid-virtualScroller')
            return v && v.scrollWidth <= v.clientWidth + 1
          },
          null,
          { timeout: 5000 }
        )
        const metrics = await page
          .locator('.admin-grid')
          .first()
          .evaluate((grid) => {
            const v = grid.querySelector('.MuiDataGrid-virtualScroller'),
              r = grid.getBoundingClientRect()
            return {
              offenders: [
                ...grid.querySelectorAll('.MuiDataGrid-virtualScroller *')
              ]
                .filter((el) => el.getBoundingClientRect().right > r.right + 1)
                .slice(0, 5)
                .map((el) => [
                  String(el.className),
                  el.getBoundingClientRect().width
                ]),
              overflow: v.scrollWidth - v.clientWidth,
              clipped: [
                ...grid.querySelectorAll('.MuiDataGrid-row button')
              ].some((b) => b.getBoundingClientRect().right > r.right)
            }
          })
        assert(
          metrics.overflow <= 1 && !metrics.clipped,
          JSON.stringify({ name, width, metrics })
        )
      }
      await page.screenshot({
        path: resolve(output, `${width}-${index}.png`),
        animations: 'disabled'
      })
    }
    assert.equal(
      await page
        .locator('.sb-nav')
        .evaluate((el) => el.scrollHeight - el.clientHeight),
      0
    )
  }
  checks.push(
    'all 7 sections at 4 screen sizes, compact lists, no body overflow'
  )
  // A fresh process must retain the edited role, password and security policy.
  await app.close()
  app = await electron.launch(
    electronLaunchOptions({
      dataDir,
      packagedExecutable: process.env.OMNIS_E2E_EXE
    })
  )
  page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  await page.getByRole('button', { name: '관리자 로그인', exact: true }).click()
  assert.equal((await invoke('admin:securityPolicy')).failedLimit, 4)
  const persisted = (await invoke('admin:users', { search: username })).rows[0]
  assert.equal(persisted.role, 'OPERATOR')
  assert.equal(persisted.must_change_password, 0)
  assert.equal(
    (await invoke('auth:login', { username, password: newPassword })).role,
    'OPERATOR'
  )
  assert.deepEqual(errors, [])
  checks.push('restart preserved changed account and security policy')
  writeFileSync(
    resolve(output, 'results.json'),
    JSON.stringify({ checks, errors }, null, 2)
  )
  console.log(
    `Admin accounts E2E passed (${label}): ${checks.length} flows, isolated profile, 7 sections × 4 sizes`
  )
} catch (error) {
  await page
    .screenshot({ path: resolve(output, 'failure.png'), fullPage: true })
    .catch(() => {})
  throw error
} finally {
  await app.close()
}
