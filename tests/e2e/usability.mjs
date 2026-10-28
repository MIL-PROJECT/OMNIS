import { _electron as electron } from 'playwright'
import { expect } from 'playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { electronLaunchOptions } from './electron-launch.mjs'

const testRoot = resolve('tests/.tmp'),
  dataDir = resolve(
    process.env.OMNIS_E2E_PROFILE ?? 'tests/.tmp/usability-profile'
  )
if (!dataDir.startsWith(testRoot + sep))
  throw new Error('Usability E2E profile must be within tests/.tmp')
rmSync(dataDir, { recursive: true, force: true })
mkdirSync(dataDir, { recursive: true })
const packaged = process.env.OMNIS_E2E_EXE
let app = await electron.launch(
  electronLaunchOptions({ dataDir, packagedExecutable: packaged })
)
let page = await app.firstWindow()
const errors = [],
  dialogs = []
function listen() {
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', async (d) => {
    dialogs.push(d.message())
    await d.accept()
  })
}
listen()
const invoke = async (channel, payload = {}) => {
  const r = await page.evaluate(
    ([c, p]) => window.omnis.invoke(c, p),
    [channel, payload]
  )
  if (!r.ok) throw new Error(`${channel}: ${r.error.message}`)
  return r.data
}
const go = async (route) => {
  await page.evaluate((route) => {
    window.location.hash = route
  }, route)
}
async function choose(scope, label, option) {
  await scope.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
async function capture(name) {
  for(const [width,height] of [[1366,768],[1920,1080]]) {
    await page.setViewportSize({width,height})
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error(`${name}: horizontal overflow`)
    const modalOverflow=await page.locator('.MuiDialogContent-root').evaluateAll(nodes=>nodes.some(e=>e.scrollWidth>e.clientWidth+1))
    if(modalOverflow)throw new Error(`${name}: dialog content horizontal overflow`)
    await page.screenshot({path:resolve(`tests/.tmp/usability-${name}-${width}.png`),animations:'disabled'})
  }
}
try {
  await page.getByRole('button', { name: '관리자 로그인', exact: true }).click()
  await page.getByRole('link', { name: '고장관리', exact: true }).waitFor()
  const admin = await invoke('auth:me'),
    users = await invoke('users:list'),
    maintainer = users.find((u) => u.role === 'MAINTAINER'),
    today = (await invoke('work:mine')).date
  const beforeRuns = (await invoke('ai:listRuns', { limit: 200 })).length
  await page.getByRole('link', { name: '고장관리', exact: true }).click()
  await page
    .getByRole('button', { name: '신규 고장 접수', exact: true })
    .click()
  const intake = page.getByRole('dialog', {
    name: '신규 고장 접수',
    exact: true
  })
  await intake
    .getByRole('textbox', { name: '제목', exact: true })
    .fill('가상 UI 기존 제목 보존')
  await choose(intake, '자주 발생하는 고장', '인터넷·네트워크 접속 불가')
  await intake
    .getByRole('button', { name: '빈 항목 채우기', exact: true })
    .click()
  await expect(
    intake.getByRole('textbox', { name: '제목', exact: true })
  ).toHaveValue('가상 UI 기존 제목 보존')
  await expect(
    intake.getByRole('textbox', { name: '장애 증상', exact: true })
  ).toHaveValue('')
  await intake
    .getByRole('textbox', { name: '장애 증상', exact: true })
    .fill('가상 장비 불통 확인')
  await intake
    .getByRole('button', { name: '입력 내용 점검', exact: true })
    .click()
  const assist = page.getByRole('dialog', {
    name: '입력 내용 보완',
    exact: true
  })
  await assist
    .getByRole('textbox', {
      name: '오류 메시지나 구체적인 증상은 무엇입니까? (보완 권장)',
      exact: true
    })
    .fill('가상 연결 응답 없음')
  await assist
    .getByRole('textbox', {
      name: '한 장비입니까, 여러 장비입니까? (보완 권장)',
      exact: true
    })
    .fill('한 대')
  await assist
    .getByRole('button', { name: '보완 내용 반영', exact: true })
    .click()
  if ((await invoke('ai:listRuns', { limit: 200 })).length !== beforeRuns)
    throw new Error('Input assistance unexpectedly invoked AI')
  await capture('intake')
  await intake.getByRole('button', { name: '저장', exact: true }).click()
  await expect(intake).not.toBeVisible()
  const incident = (
      await invoke('incidents:list', { search: '가상 UI 기존 제목 보존' })
    )[0],
    saved = await invoke('incidents:get', { id: incident.id })
  if (
    saved.intake.answers.length !== 2 ||
    saved.description !== '가상 장비 불통 확인'
  )
    throw new Error('Intake snapshot or original facts not preserved')
  console.log('Passed intake template and local input assistance')
  await invoke('incidents:assign', { id: incident.id, userId: maintainer.id })

  await page.getByRole('link', { name: '정비관리', exact: true }).click()
  await page.getByRole('button', { name: '반복 정비', exact: true }).click()
  const recurring = page.getByRole('dialog', { name: '반복 정비', exact: true })
  await recurring
    .getByRole('button', { name: '반복 규칙 등록', exact: true })
    .click()
  const ruleForm = page.getByRole('dialog', {
    name: '반복 규칙 등록',
    exact: true
  })
  await ruleForm
    .getByRole('textbox', { name: '반복 작업명', exact: true })
    .fill('가상 UI 매월 점검')
  await choose(ruleForm, '담당자', maintainer.display_name)
  await ruleForm.getByLabel('시작일', { exact: true }).fill('2032-01-01')
  await choose(ruleForm, '반복 주기', '매월')
  await ruleForm
    .getByRole('spinbutton', { name: '기준 일자', exact: true })
    .fill('31')
  await ruleForm.getByRole('button', { name: '규칙 저장', exact: true }).click()
  await expect(ruleForm).not.toBeVisible()
  await recurring
    .getByLabel('미리보기 시작', { exact: true })
    .fill('2032-01-01')
  await recurring
    .getByLabel('미리보기 종료', { exact: true })
    .fill('2032-03-30')
  await recurring
    .getByRole('button', { name: '일정 미리보기', exact: true })
    .click()
  await expect(
    recurring.getByText('2032-02-29 · 생성 가능', { exact: true })
  ).toBeVisible()
  await recurring
    .getByRole('button', { name: '생성 가능 일정 모두 선택', exact: true })
    .click()
  await recurring
    .getByRole('button', { name: '선택 작업 2건 생성', exact: true })
    .click()
  await expect(
    recurring.getByText('생성 2건 · 기존 회차 건너뜀 0건', { exact: true })
  ).toBeVisible()
  await capture('recurring')
  const rule = (await invoke('recurring:list'))[0],
    range = {
      id: rule.id,
      version: rule.version,
      from: '2032-01-01',
      to: '2032-03-30',
      dates: ['2032-01-31', '2032-02-29']
    },
    repeat = await invoke('recurring:generate', range)
  if (repeat.created.length !== 0 || repeat.skipped.length !== 2)
    throw new Error('Duplicate recurring tasks')
  const tasks = await invoke('maintenance:list', {
    search: '가상 UI 매월 점검'
  })
  if (tasks.length !== 2 || tasks.some((t) => t.assignee_id !== maintainer.id))
    throw new Error('Wrong recurring assignment')
  await recurring.getByRole('button', { name: '닫기', exact: true }).click()
  console.log('Passed recurring preview, assignment and duplicate prevention')
  const task = await invoke('maintenance:create', {
    title: '가상 UI 오늘 체크 점검',
    maintenanceType: '정기점검',
    priority: 'NORMAL',
    department: '가상반',
    scheduledDate: today,
    assigneeId: maintainer.id,
    checklistTemplateId: 'check-general'
  })
  await invoke('directives:create', {
    title: '가상 UI 개인 지시',
    content: '오늘 가상 점검 결과를 확인하십시오.',
    level: 'GENERAL',
    assigneeId: maintainer.id
  })
  await invoke('auth:login', {
    username: maintainer.username,
    password: 'Demo!2026'
  })
  await page.reload()
  await go('/?view=mine')
  await expect(
    page.getByRole('heading', { name: '내 업무', exact: true })
  ).toBeVisible()
  await page
    .getByRole('button')
    .filter({ hasText: '가상 UI 기존 제목 보존' })
    .click()
  await expect(
    page.getByRole('dialog').filter({ hasText: incident.ticket_no })
  ).toBeVisible()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: '내 업무', exact: true })
  ).toBeVisible()
  await page
    .getByRole('button')
    .filter({ hasText: '가상 UI 개인 지시' })
    .click()
  await page.getByRole('button', { name: '지시사항 확인', exact: true }).click()
  await expect(
    page.getByRole('button').filter({ hasText: '가상 UI 개인 지시' })
  ).toHaveCount(0)
  await page
    .getByRole('button')
    .filter({ hasText: '가상 UI 오늘 체크 점검' })
    .click()
  let detail = page.getByRole('dialog').filter({ hasText: task.task_no })
  await detail.getByRole('button', { name: '진행', exact: true }).click()
  await page
    .getByRole('button')
    .filter({ hasText: '가상 UI 오늘 체크 점검' })
    .click()
  detail = page.getByRole('dialog').filter({ hasText: task.task_no })
  await detail
    .getByRole('textbox', { name: '원인 분석', exact: true })
    .fill('가상 시험 점검')
  await detail
    .getByRole('textbox', { name: '상세 조치내용', exact: true })
    .fill('가상 연결 상태 확인')
  await detail
    .getByRole('textbox', { name: '작업 결과', exact: true })
    .fill('가상 정상 확인')
  await detail.getByRole('button', { name: '완료', exact: true }).click()
  await expect
    .poll(() => dialogs.some((d) => d.includes('점검 미완료')))
    .toBeTruthy()
  let checklist = await invoke('checklist:get', { taskId: task.id })
  for (const item of checklist.items)
    await choose(detail, `${item.label} 결과`, '정상')
  await detail
    .getByRole('button', { name: '점검 결과 저장', exact: true })
    .click()
  await expect(
    detail.getByText('점검 결과를 저장했습니다.', { exact: true })
  ).toBeVisible()
  await capture('checklist')
  checklist = await invoke('checklist:get', { taskId: task.id })
  if (checklist.results.filter((r) => r.status === 'OK').length !== 5)
    throw new Error('Checklist did not persist')
  await detail.getByRole('button', { name: '닫기', exact: true }).click()
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080]
  ]) {
    await page.setViewportSize({ width, height })
    await go('/?view=mine')
    await expect(
      page.getByRole('heading', { name: '내 업무', exact: true })
    ).toBeVisible()
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1
      )
    )
      throw new Error('My work horizontal overflow')
    await page.screenshot({
      path: resolve(`tests/.tmp/usability-my-work-${width}.png`),
      fullPage: true,
      animations: 'disabled'
    })
  }
  await app.close()
  app = await electron.launch(
    electronLaunchOptions({ dataDir, packagedExecutable: packaged })
  )
  page = await app.firstWindow()
  listen()
  await page.getByRole('button', { name: '관리자 로그인', exact: true }).click()
  const restored = await invoke('incidents:get', { id: incident.id }),
    persisted = await invoke('checklist:get', { taskId: task.id })
  if (
    restored.intake.answers.length !== 2 ||
    persisted.results.filter((r) => r.status === 'OK').length !== 5
  )
    throw new Error('Restart persistence failed')
  await invoke('auth:login', {
    username: maintainer.username,
    password: 'Demo!2026'
  })
  await page.reload()
  await go(`/maintenance?detail=${task.id}&from=mine`)
  detail = page.getByRole('dialog').filter({ hasText: task.task_no })
  await detail
    .getByRole('textbox', { name: '원인 분석', exact: true })
    .fill('가상 시험 점검')
  await detail
    .getByRole('textbox', { name: '상세 조치내용', exact: true })
    .fill('가상 연결 상태 확인')
  await detail
    .getByRole('textbox', { name: '작업 결과', exact: true })
    .fill('가상 정상 확인')
  await detail.getByRole('button', { name: '완료', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '내 업무', exact: true })
  ).toBeVisible()
  if ((await invoke('maintenance:get', { id: task.id })).status !== 'COMPLETED')
    throw new Error('Checklist completion failed')
  const forbidden = await page.evaluate(
    (id) =>
      window.omnis.invoke('templates:save', {
        id,
        kind: 'INCIDENT',
        active: true,
        definition: {}
      }),
    'intake-network'
  )
  if (forbidden.ok) throw new Error('Invalid payload accepted')
  await invoke('auth:login', {
    username: admin.username,
    password: 'Demo!2026'
  })
  await page.reload()
  await go('/ai')
  await page
    .getByRole('textbox', { name: '제목', exact: true })
    .fill('가상 보완 분석')
  await page
    .getByRole('textbox', { name: '내용', exact: true })
    .fill('가상 불통')
  await page
    .getByRole('button', { name: '분석 및 유사 고장 조회', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: '입력 내용 보완' })
    .getByRole('button', { name: '현재 내용으로 분석', exact: true })
    .click()
  await expect(page.getByText('AI 추천 · LOCAL', { exact: true })).toBeVisible()
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(
    'Usability E2E passed: templates/input assistance/personal deep links/directive acknowledgement/recurrence deduplication/checklist gates/restart persistence/responsive UI/LOCAL analysis'
  )
} catch (e) {
  await page
    .screenshot({
      path: resolve('tests/.tmp/usability-failure.png'),
      fullPage: true,
      animations: 'disabled'
    })
    .catch(() => {})
  console.log('Renderer errors:', errors)
  throw e
} finally {
  await app.close()
}
