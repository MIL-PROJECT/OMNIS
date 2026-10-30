import { _electron as electron } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { electronLaunchOptions } from './electron-launch.mjs'

// 사용자 등록 신청 → 승인 대기 로그인 차단 → 관리자 승인/반려 → 신규 계정 로그인
const dataDir = resolve('tests/.tmp/signup-profile')
rmSync(dataDir, { recursive: true, force: true }); mkdirSync(dataDir, { recursive: true })
const app = await electron.launch(electronLaunchOptions({ dataDir }))
const stamp = String(Date.now()).slice(-6)
const applicants = [
  { serviceNo: `24-7${stamp}1`, name: '신규승인', rank: '하사', unit: '가상 통신중대', id: `e2e_ok_${stamp}`, pw: 'Signup!2026' },
  { serviceNo: `24-7${stamp}2`, name: '신규반려', rank: '중사', unit: '가상 정비반', id: `e2e_no_${stamp}`, pw: 'Signup!2026' }
]
try {
  const page = await app.firstWindow()
  const loginAs = async (mode, id, pw) => { await page.getByRole('radio', { name: mode }).click(); await page.getByRole('textbox', { name: '아이디' }).fill(id); await page.getByRole('textbox', { name: '비밀번호' }).fill(pw); await page.getByRole('button', { name: '로그인' }).click() }
  const loginError = async text => { await page.getByRole('alert').filter({ hasText: text }).waitFor({ timeout: 5000 }) }

  for (const a of applicants) {
    await page.getByRole('button', { name: '사용자 등록 신청' }).click()
    const dlg = page.getByRole('dialog')
    await dlg.getByRole('textbox', { name: '군번' }).fill(a.serviceNo)
    await dlg.getByRole('combobox', { name: '계급' }).click(); await page.getByRole('option', { name: a.rank, exact: true }).click()
    await dlg.getByRole('textbox', { name: '이름' }).fill(a.name)
    await dlg.getByRole('textbox', { name: '소속' }).fill(a.unit)
    await dlg.getByRole('textbox', { name: '아이디' }).fill(a.id)
    await dlg.getByRole('textbox', { name: '비밀번호', exact: true }).fill(a.pw)
    await dlg.getByRole('textbox', { name: '비밀번호 확인' }).fill(a.pw)
    await dlg.getByRole('button', { name: '등록 신청' }).click()
    await dlg.getByText('사용자 등록 신청이 접수되었습니다').waitFor()
    await dlg.getByRole('button', { name: '확인' }).click()
  }
  // 같은 아이디로 다시 신청하면 거부
  await page.getByRole('button', { name: '사용자 등록 신청' }).click()
  const dup = page.getByRole('dialog')
  await dup.getByRole('textbox', { name: '군번' }).fill(`24-7${stamp}9`)
  await dup.getByRole('combobox', { name: '계급' }).click(); await page.getByRole('option', { name: '병장', exact: true }).click()
  await dup.getByRole('textbox', { name: '이름' }).fill('중복신청'); await dup.getByRole('textbox', { name: '소속' }).fill('가상 부대')
  await dup.getByRole('textbox', { name: '아이디' }).fill(applicants[0].id)
  await dup.getByRole('textbox', { name: '비밀번호', exact: true }).fill('Signup!2026'); await dup.getByRole('textbox', { name: '비밀번호 확인' }).fill('Signup!2026')
  await dup.getByRole('button', { name: '등록 신청' }).click()
  await dup.getByText('이미 사용 중이거나 신청 중인 아이디입니다.').waitFor()
  await dup.getByRole('button', { name: '취소' }).click()

  // 승인 전에는 로그인 불가
  await loginAs('사용자', applicants[0].id, applicants[0].pw)
  await loginError('관리자 승인 대기 중인 계정입니다')

  // 관리자: 한 명 승인(운용요원), 한 명 반려
  await loginAs('관리자', 'demo_admin', 'Demo!2026')
  await page.getByRole('link', { name: '사용자 신청현황' }).click()
  await page.getByRole('heading', { name: '사용자 신청현황' }).waitFor()
  const row = id => page.getByRole('row').filter({ hasText: id })
  await row(applicants[0].id).getByRole('button', { name: '승인' }).click()
  await page.getByRole('combobox', { name: '권한' }).click(); await page.getByRole('option', { name: /운용요원/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: '승인' }).click()
  await row(applicants[0].id).waitFor({ state: 'detached' })
  await row(applicants[1].id).getByRole('button', { name: '반려' }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: '반려 사유' }).fill('소속 확인 불가')
  await page.getByRole('dialog').getByRole('button', { name: '반려' }).click()
  await row(applicants[1].id).waitFor({ state: 'detached' })
  await page.getByRole('radio', { name: /승인/ }).click()
  await row(applicants[0].id).getByText('운용요원', { exact: false }).waitFor()
  await page.getByRole('button', { name: '로그아웃' }).click()

  // 반려된 계정은 사유와 함께 차단, 승인된 계정은 로그인
  await loginAs('사용자', applicants[1].id, applicants[1].pw)
  await loginError('소속 확인 불가')
  await loginAs('사용자', applicants[0].id, applicants[0].pw)
  await page.getByRole('link', { name: '고장관리' }).waitFor()
  await page.getByText('신규승인').first().waitFor()
  if (await page.getByRole('link', { name: '사용자 신청현황' }).count()) throw new Error('Approved OPERATOR should not see the admin menu')
  console.log('Signup E2E passed: request, duplicate check, pending block, approve with role, reject with reason, new account login')
} finally { await app.close() }
