S001 src/main/index.ts:33-33 — sandbox/contextIsolation, nodeIntegration=false
```ts
  const window = new BrowserWindow({ width: 1600, height: 950, minWidth: 1366, minHeight: 768, show: false, autoHideMenuBar: true, webPreferences: { preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged } })
```

S002 src/main/index.ts:25-29 — userData 경로와 기존 AFCCS 자료 조건부 복사
```ts
const appData = app.getPath('appData')
const userDataPath = process.env.OMNIS_E2E_DATA ?? join(appData, 'OMNIS')
if (!process.env.OMNIS_E2E_DATA) migrateLegacyData(join(appData, 'AFCCS'), userDataPath)
mkdirSync(userDataPath, { recursive: true })
app.setPath('userData', userDataPath)
```

S003 src/main/index.ts:47-54 — DB 준비→IPC 등록→창 생성→날짜 marker 조건부 백업
```ts
  app.whenReady().then(() => {
    log.initialize()
    try { openDb(); registerIpc() } catch (error) { log.error('Startup failed', error); throw error }
    createWindow()
    const lastBackup = koreaDate()
    const marker = join(app.getPath('userData'), `backup-${lastBackup}.marker`)
    import('node:fs').then(async fs => { if (!fs.existsSync(marker)) { try { await backup(); fs.writeFileSync(marker, '') } catch (error) { log.error('Backup failed', error) } } })
  })
```

S004 src/main/index.ts:39-40 — 개발 Vite URL 또는 로컬 HTML
```ts
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
```

S005 src/main/ipc/registerIpc.ts:9-18 — mainFrame→Zod parse→run→Result
```ts
    ipcMain.handle(channel, async (event, payload: unknown): Promise<Result<unknown>> => {
      try {
        if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) throw new Error('허용되지 않은 프레임입니다.')
        const parsed = schemas[channel].parse(payload ?? {}) as Record<string, unknown>
        return { ok: true, data: await run(channel, parsed) }
      } catch (error) {
        log.error(`IPC ${channel}`, error instanceof Error ? error.message : 'Unknown error')
        // 입력 검증 오류는 첫 번째 항목의 안내 문구만 화면에 보낸다
        if (error instanceof ZodError) return { ok: false, error: { code: 'INVALID_INPUT', message: error.issues[0]?.message ?? '입력값이 올바르지 않습니다.' } }
        return { ok: false, error: { code: 'REQUEST_FAILED', message: error instanceof Error ? error.message : '요청에 실패했습니다.' } }
```

S006 src/preload/index.ts:4-15 — window.omnis와 ipcRenderer.invoke
```ts
const invoke = (channel: Channel, payload?: Record<string, unknown>) => ipcRenderer.invoke(channel, payload ?? {})
const api: OmnisApi = {
  invoke,
  auth: { login: p => invoke('auth:login', p), logout: () => invoke('auth:logout'), me: () => invoke('auth:me') },
  dashboard: { getSummary: () => invoke('dashboard:getSummary') },
  operations: { list: p => invoke('operations:list', p), updateStatus: p => invoke('operations:updateStatus', p), getHistory: p => invoke('operations:getHistory', p) },
  incidents: { list: p => invoke('incidents:list', p), get: p => invoke('incidents:get', p), create: p => invoke('incidents:create', p), updateStatus: p => invoke('incidents:updateStatus', p), assign: p => invoke('incidents:assign', p), getEvents: p => invoke('incidents:getEvents', p) },
  maintenance: { list: p => invoke('maintenance:list', p), create: p => invoke('maintenance:create', p), updateStatus: p => invoke('maintenance:updateStatus', p) },
  ai: { triageIncident: p => invoke('ai:triageIncident', p), dailySummary: () => invoke('ai:dailySummary'), similarIncidents: p => invoke('ai:similarIncidents', p), maintenanceRecommendations: () => invoke('ai:maintenanceRecommendations') },
  sy
```

S007 src/shared/contracts.ts:9-9 — 실제 역할 5종: OPERATOR도 존재
```ts
export const roleSchema = z.enum(['ADMIN', 'OPERATOR', 'MAINTAINER', 'VIEWER', 'USER'])
```

S008 src/shared/contracts.ts:112-112 — loopback HTTP 허용; timeout 5~30초
```ts
  'system:setAiSettings': z.object({ provider: aiProviderSchema, ollamaEndpoint: z.url().refine(v => { const u = new URL(v); return u.protocol === 'http:' && ['127.0.0.1','localhost'].includes(u.hostname) && !u.username && !u.password && u.pathname === '/' }, '로컬 HTTP 주소만 허용됩니다.'), ollamaModel: z.string().regex(/^[a-zA-Z0-9_.:-]{1,80}$/), openaiModel:z.string().regex(/^[a-zA-Z0-9_.:-]{1,80}$/), anthropicModel:z.string().regex(/^[a-zA-Z0-9_.:-]{1,80}$/), externalAiEnabled:z.boolean(), externalConsent:z.boolean(), timeoutSeconds:z.number().int().min(5).max(30), dailyRequestLimit:z.number().int().min(1).max(1000) }),
```

S009 src/main/auth/SessionManager.ts:2-3 — PublicUser Main 메모리 세션; DB 테이블 없음
```ts
let current: PublicUser | null = null
export const session = { get: (): PublicUser | null => current, set: (user: PublicUser | null): void => { current = user } }
```

S010 src/main/services/AppService.ts:54-70 — scrypt 검증 후 Main 세션 저장
```ts
  if (channel === 'auth:login') {
    const row = one(db, 'SELECT * FROM users WHERE username=? AND active=1', p.username)
    if (!row) {
      // 등록 신청만 한 계정: 비밀번호가 맞을 때만 승인 대기·반려 상태를 알려준다
      const request = one(db, "SELECT * FROM signup_requests WHERE username=? AND status IN ('PENDING','REJECTED') ORDER BY created_at DESC LIMIT 1", p.username)
      if (request && passwordMatches(p.password, request.password_hash, request.password_salt)) {
        if (request.status === 'PENDING') throw new Error('관리자 승인 대기 중인 계정입니다. 승인 후 로그인할 수 있습니다.')
        throw new Error(`사용자 등록 신청이 반려되었습니다. 사유: ${request.reject_reason ?? '-'}`)
      }
      throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
    }
    if (!passwordMatches(p.password, row.password_hash, row.password_salt)) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
    const user = { id: String(row.id), username: String(row.username), display_name: String(row.display_name), rank_name: row.rank_name as string | null, unit_name: row.unit_name as string | null, role: row.role as PublicUser['role'] }
    session.set(user); return user
  }
  if (channel === 'auth:logout') { session.set(null); return true }
  if (channel === 'auth:me') return sessio
```

S011 src/main/services/AppService.ts:35-36 — 로그인·역할 검사
```ts
const requireUser = (): PublicUser => { const user = session.get(); if (!user) throw new Error('로그인이 필요합니다.'); return user }
const permit = (...roles: string[]): PublicUser => { const user = requireUser(); if (!roles.includes(user.role)) throw new Error('권한이 없습니다.'); return user }
```

S012 src/main/services/AppService.ts:90-92 — Main 내부 업무 모듈 dispatcher
```ts
  if (usabilityChannels.has(channel)) return runUsability(db,channel,p,requireUser())
  if (attachmentChannels.has(channel)) return runAttachmentChannel(db,channel,p,requireUser())
  if (operationalChannels.has(channel)) return runOperationalChannel(db,channel,p,requireUser(),attachmentRoot())
```

S013 src/main/services/AppService.ts:94-107 — ADMIN 가입 승인과 사용자 생성
```ts
  if (channel === 'admin:approveSignup') {
    const admin = permit('ADMIN')
    return db.transaction(() => {
      const request = one(db, 'SELECT * FROM signup_requests WHERE id=?', p.id)
      if (!request) throw new Error('신청을 찾을 수 없습니다.')
      if (request.status !== 'PENDING') throw new Error('이미 처리된 신청입니다.')
      if (one(db, 'SELECT id FROM users WHERE username=?', request.username)) throw new Error('같은 아이디의 사용자가 이미 있습니다.')
      if (one(db, 'SELECT id FROM users WHERE service_no=?', request.service_no)) throw new Error('같은 군번의 사용자가 이미 있습니다.')
      const userId = randomUUID(), date = now()
      db.prepare('INSERT INTO users (id,username,display_name,rank_name,unit_name,role,password_hash,password_salt,active,created_at,updated_at,service_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(userId, request.username, request.display_name, request.rank_name, request.unit_name, p.role, request.password_hash, request.password_salt, 1, date, date, request.service_no)
      // 비밀번호 해시는 사용자 계정으로 옮겼으므로 신청 기록에서는 지운다
      db.prepare("UPDATE signup_requests SET status='APPROVED',approved_role=?,user_id=?,reviewed_by=?,reviewed_at=?,password_hash='',password_salt='' WHERE id=?").run(p.role, u
```

S014 src/main/services/AppService.ts:126-126 — 체계와 운용 이력 SQL transaction
```ts
  if (channel === 'operations:create') { permit('ADMIN','OPERATOR','USER'); return db.transaction(() => { const id = randomUUID(), date = now(); const order = Number(one(db,'SELECT COALESCE(max(display_order),0)+1 n FROM communication_systems')?.n ?? 1); db.prepare('INSERT INTO communication_systems VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,p.code,p.name,p.category,p.status,p.uptimePct,0,p.remarks ?? null,order,date); db.prepare('INSERT INTO communication_status_history VALUES (?,?,?,?,?)').run(randomUUID(),id,p.status,p.uptimePct,date); audit(db,'CREATE','communication_systems',id,null,p); return { id } })() }
```

S015 src/main/services/AppService.ts:133-133 — USER 본인 접수 필터
```ts
  if (channel === 'incidents:list') { const user=requireUser(); return all(db, "SELECT i.*, c.name system_name,t.name team_name FROM incidents i LEFT JOIN communication_systems c ON c.id=i.system_id LEFT JOIN maintenance_teams t ON t.id=i.team_id WHERE (? IS NULL OR i.title LIKE ? OR i.ticket_no LIKE ?) AND (? IS NULL OR i.status=?) AND (? IS NULL OR i.severity=?) AND (? IS NULL OR date(i.reported_at,'+9 hours')>=?) AND (? IS NULL OR date(i.reported_at,'+9 hours')<=?) AND (? IS NULL OR i.assigned_to=?) AND (? IS NULL OR i.reported_by=?) ORDER BY i.reported_at DESC", p.search ? `%${p.search}%` : null, `%${p.search ?? ''}%`, `%${p.search ?? ''}%`, p.status ?? null, p.status ?? null, p.severity ?? null, p.severity ?? null, p.reportedFrom ?? null, p.reportedFrom ?? null, p.reportedTo ?? null, p.reportedTo ?? null, p.assignedTo ?? null, p.assignedTo ?? null, user.role === 'USER' ? user.id : null, user.role === 'USER' ? user.id : null) }
```

S016 src/main/services/AppService.ts:137-138 — 접수·SLA·event·audit·intake snapshot 저장
```ts
  if (channel === 'incidents:create') { const user = permit('ADMIN','OPERATOR','USER'); return db.transaction(() => { const id = randomUUID(), date = now(), no = ticket(db, 'incidents', 'ticket_no', 'INC'); const slaMinutes = Number(setting(db,p.severity === 'URGENT' ? 'sla_urgent_minutes' : 'sla_normal_minutes',p.severity === 'URGENT' ? '60' : '480')); const slaDue = new Date(Date.now()+slaMinutes*60000).toISOString(); db.prepare(`INSERT INTO incidents (id,ticket_no,title,category,system_id,severity,status,description,reported_by,department,reported_at,created_at,updated_at,intake_source,reporter_name,equipment_name,service_impact,occurred_at,desired_resolution_at,emergency_preaction,emergency_reason,actual_action_started_at,sla_due_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, no, p.title, p.category, p.systemId ?? null, p.severity, 'RECEIVED', p.description, user.id, p.department ?? null, date, date, date, p.intakeSource, p.reporterName ?? null, p.equipmentName ?? null, p.serviceImpact ?? null, p.occurredAt ?? date, p.desiredResolutionAt ?? null, p.emergencyPreaction ? 1 : 0, p.emergencyReason ?? null, p.actualActionStartedAt ?? null, slaDue); db.pre
```

S017 src/main/services/AppService.ts:140-140 — 담당·상태전이·결과·사용자 확인 검사
```ts
  if (channel === 'incidents:updateStatus') { const user = permit('ADMIN','OPERATOR','MAINTAINER','USER'); return db.transaction(() => { const before = one(db, 'SELECT * FROM incidents WHERE id=?', p.id); if (!before) throw new Error('접수 건을 찾을 수 없습니다.'); if (user.role === 'USER' && (before.reported_by !== user.id || p.status !== 'CLOSED')) throw new Error('권한이 없습니다.'); if (user.role === 'MAINTAINER' && before.assigned_to !== user.id && !one(db,'SELECT id FROM team_members WHERE team_id=? AND user_id=? AND available=1',before.team_id,user.id)) throw new Error('배정된 작업만 처리할 수 있습니다.'); assertTransition(incidentTransitions, String(before.status), String(p.status)); if (p.status === 'RESOLVED' && (!String(p.cause ?? '').trim() || !String(p.actionSummary ?? '').trim())) throw new Error('조치완료 처리에는 장애 원인과 조치결과가 필요합니다.'); if (p.status === 'CLOSED' && !before.user_confirmed && !p.userConfirmed) throw new Error('종결하려면 사용자 확인이 필요합니다.'); const date = now(); const mode = p.status === 'REMOTE_IN_PROGRESS' ? 'REMOTE' : p.status === 'ON_SITE_IN_PROGRESS' ? 'ON_SITE' : p.resolutionMode ?? before.resolution_mode; db.prepare(`UPDATE incidents SET status=?,updated_at=?,started_at=CASE WHEN ? IN ('IN_PRO
```

S018 src/main/services/AppService.ts:143-143 — ADMIN/OPERATOR 검토 후 업무·AI 이력 반영
```ts
  if (channel === 'incidents:applyAi') { const user=permit('ADMIN','OPERATOR'); return db.transaction(() => { const before=one(db,'SELECT * FROM incidents WHERE id=?',p.id); if(!before) throw new Error('접수 건을 찾을 수 없습니다.'); const team=p.teamId ? one(db,'SELECT name FROM maintenance_teams WHERE id=? AND available=1',p.teamId) : undefined; if(p.teamId&&!team)throw new Error('가용 조치부서를 찾을 수 없습니다.'); db.prepare('UPDATE incidents SET category=?,severity=?,team_id=COALESCE(?,team_id),ai_category=?,ai_priority=?,ai_confidence=?,ai_rationale=?,ai_recommended_team=?,updated_at=? WHERE id=?').run(p.category,p.severity,p.teamId ?? null,p.category,p.severity,p.confidence,p.rationale,p.teamId ?? null,now(),p.id); if(p.runId) db.prepare('UPDATE ai_runs SET applied=1,entity_type=\'incident\',entity_id=? WHERE id=?').run(p.id,p.runId); db.prepare('INSERT INTO incident_events (id,incident_id,event_type,from_status,to_status,note,actor_id,created_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),p.id,'AI_APPLIED',before.status,before.status,'AI 분류 검토 후 반영',user.id,now(),JSON.stringify({ confidence:p.confidence,teamId:p.teamId })); audit(db,'APPLY_AI','incidents',String(p.id),before,{ cat
```

S019 src/main/services/IncidentAssignmentService.ts:7-79 — 조치부서/담당 소속 검사와 요청부서 보존
```ts
export function assignIncidentTeam(
  db: Database.Database,
  user: PublicUser,
  input: unknown
): boolean {
  if (!['ADMIN', 'OPERATOR'].includes(user.role))
    throw new Error('권한이 없습니다.')
  const p = schemas['incidents:assignTeam'].parse(input)
  return db.transaction(() => {
    const before = db
      .prepare('SELECT * FROM incidents WHERE id=?')
      .get(p.id) as Record<string, unknown> | undefined
    if (!before) throw new Error('접수 건을 찾을 수 없습니다.')
    const team = p.teamId
      ? (db
          .prepare('SELECT * FROM maintenance_teams WHERE id=? AND available=1')
          .get(p.teamId) as { name: string } | undefined)
      : undefined
    if (p.teamId && !team) throw new Error('가용 조치부서를 찾을 수 없습니다.')
    if (
      p.userId &&
      !db
        .prepare(
          "SELECT id FROM users WHERE id=? AND active=1 AND role IN ('ADMIN','OPERATOR','MAINTAINER')"
        )
        .get(p.userId)
    )
      throw new Error('유효한 조치 담당자를 선택하십시오.')
    const date = new Date().toISOString()
    const nextStatus =
      team && before.status === 'TRIAGED'
        ? 'ASSIGNED'
        : !team && before.status === 'ASSIGNED'
          ? 'TRIAGED'
          : before.status
    co
```

S020 src/main/services/Workflow.ts:1-19 — 분류·배정·원격/현장·검증·종결 및 보류/취소
```ts
export const incidentTransitions: Record<string, string[]> = {
  RECEIVED: ['TRIAGED', 'CANCELED'],
  TRIAGED: ['ASSIGNED', 'ON_HOLD', 'CANCELED'],
  ASSIGNED: ['REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS', 'PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'CANCELED'],
  PLANNED: ['REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS', 'IN_PROGRESS', 'ON_HOLD', 'CANCELED'],
  IN_PROGRESS: ['REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS', 'RESOLVED', 'ON_HOLD', 'CANCELED'],
  REMOTE_IN_PROGRESS: ['ON_SITE_IN_PROGRESS', 'RESOLVED', 'ON_HOLD', 'CANCELED'],
  ON_SITE_IN_PROGRESS: ['RESOLVED', 'ON_HOLD', 'CANCELED'],
  RESOLVED: ['VERIFIED', 'REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS'],
  VERIFIED: ['CLOSED', 'RESOLVED'],
  ON_HOLD: ['ASSIGNED', 'REMOTE_IN_PROGRESS', 'ON_SITE_IN_PROGRESS', 'CANCELED'],
  CLOSED: [], CANCELED: []
}
export const maintenanceTransitions: Record<string, string[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELED'], IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELED'], BLOCKED: ['IN_PROGRESS', 'CANCELED'], COMPLETED: [], CANCELED: []
}
export function assertTransition(map: Record<string, string[]>, before: string, after: string): void {
  if (!map[before]?.includes(after)) throw new Error(`허용되지 않은 상
```

S021 src/main/services/AppService.ts:148-148 — 완료 전에 필수 체크리스트 검사
```ts
  if (channel === 'maintenance:updateStatus') { const user = permit('ADMIN','MAINTAINER'); return db.transaction(() => { const before = one(db, 'SELECT * FROM maintenance_tasks WHERE id=?', p.id); if (!before) throw new Error('정비 작업을 찾을 수 없습니다.'); if (user.role === 'MAINTAINER' && before.assignee_id !== user.id) throw new Error('배정된 작업만 처리할 수 있습니다.'); assertTransition(maintenanceTransitions, String(before.status), String(p.status)); if(p.status==='COMPLETED')assertChecklistComplete(db,String(p.id)); const progress = p.status === 'COMPLETED' ? 100 : p.progress; const completedAt = p.status === 'COMPLETED' ? now() : null; db.prepare(`UPDATE maintenance_tasks SET status=?,progress=?,result=COALESCE(?,result),cause=COALESCE(?,cause),action_detail=COALESCE(?,action_detail),parts_used=COALESCE(?,parts_used),resolution_mode=COALESCE(?,resolution_mode),recurrence_risk=COALESCE(?,recurrence_risk),follow_up_date=COALESCE(?,follow_up_date),completed_at=COALESCE(?,completed_at),updated_at=? WHERE id=?`).run(p.status, progress, p.result ?? null, p.cause ?? null, p.actionDetail ?? null, p.partsUsed ?? null, p.resolutionMode ?? null, p.recurrenceRisk ?? null, p.followUpDate ?? null, completedAt, 
```

S022 src/main/services/UsabilityService.ts:381-381 — 실용 기능 dispatcher
```ts
export function runUsability(
```

S023 src/main/services/UsabilityService.ts:49-69 — USER 상세 차단, 정비 담당 범위
```ts
export function taskAccess(
  db: Database.Database,
  user: PublicUser,
  id: string,
  write = false
): Row {
  const row = one(db, 'SELECT * FROM maintenance_tasks WHERE id=?', id)
  if (!row) throw new Error('정비 작업을 찾을 수 없습니다.')
  if (write) {
    permit(user, 'ADMIN', 'MAINTAINER')
    if (user.role !== 'ADMIN' && row.assignee_id !== user.id)
      throw new Error('배정된 작업만 처리할 수 있습니다.')
    if (['COMPLETED', 'CANCELED'].includes(String(row.status)))
      throw new Error('완료·취소 작업은 수정할 수 없습니다.')
  } else if (
    user.role === 'USER' ||
    (user.role === 'MAINTAINER' && row.assignee_id !== user.id)
  )
    throw new Error('권한이 없습니다.')
  return row
}
```

S024 src/main/services/UsabilityService.ts:447-477 — 기존 업무 테이블 조회·조합
```ts
  if (channel === 'work:mine') {
    const date = koreaDate(),
      incidents = all(
        db,
        `SELECT id,ticket_no,title,status,severity,sla_due_at FROM incidents WHERE ${user.role === 'USER' ? 'reported_by' : 'assigned_to'}=? AND status NOT IN ('CLOSED','CANCELED') ORDER BY CASE severity WHEN 'URGENT' THEN 0 ELSE 1 END,reported_at`,
        user.id
      )
    const tasks =
      user.role === 'USER'
        ? []
        : all(
            db,
            "SELECT id,task_no,title,status,scheduled_date FROM maintenance_tasks WHERE assignee_id=? AND scheduled_date<=? AND status NOT IN ('COMPLETED','CANCELED') ORDER BY scheduled_date",
            user.id,
            date
          )
    const directives = all(
      db,
      `SELECT d.* FROM directives d WHERE (d.expires_at IS NULL OR julianday(d.expires_at)>julianday(?)) AND NOT EXISTS(SELECT 1 FROM directive_acknowledgements a WHERE a.directive_id=d.id AND a.user_id=?) ORDER BY CASE d.level WHEN 'URGENT' THEN 0 ELSE 1 END,d.issued_at DESC`,
      now(),
      user.id
    ).filter((r) => applicableDirective(r, user))
    return {
      date,
      generatedAt: now(),
      incidentLabel:
        user.role === 'USER' ?
```

S025 src/main/services/UsabilityService.ts:419-431 — 결정적 로컬 규칙, 외부 전송 false
```ts
  if (channel === 'input:inspect')
    return {
      questions: missingQuestions(
        {
          description: String(p.description),
          serviceImpact: p.serviceImpact as string | undefined,
          occurredAt: p.occurredAt as string | undefined
        },
        p.answers as Intake['answers']
      ),
      provider: 'LOCAL',
      externalTransmission: false
    }
```

S026 src/main/services/UsabilityService.ts:218-236 — 체크리스트 필수·NA 사유 검사
```ts
export function checklistProblems(check: TaskChecklist | null): string[] {
  if (!check) return []
  return check.items.flatMap((item) => {
    const r = check.results.find((r) => r.id === item.id)
    if (item.required && (!r || r.status === 'PENDING' || r.status === 'ISSUE'))
      return [`${item.label}: 필수 점검을 정상 확인하십시오.`]
    if (r?.status === 'NA' && (!item.allowNa || !r.note.trim()))
      return [`${item.label}: 해당 없음 허용 여부와 사유를 확인하십시오.`]
    if (r?.status === 'ISSUE' && !r.note.trim())
      return [`${item.label}: 이상 조치 메모를 입력하십시오.`]
    return []
  })
}
export function assertChecklistComplete(
  db: Database.Database,
  id: string
): void {
  const issues = checklistProblems(getChecklist(db, id))
  if (issues.length) throw new Error(`점검 미완료: ${issues.join(' / ')}`)
```

S027 src/main/services/UsabilityService.ts:353-378 — 규칙 버전·담당·기존 회차·마감·과거 조회
```ts
function preview(db: Database.Database, user: PublicUser, p: Row) {
  const rule = getRule(db, user, String(p.id))
  if (!rule.active || rule.version !== p.version)
    throw new Error('규칙이 변경되었거나 중지되었습니다. 다시 미리보십시오.')
  validAssignee(db, user, rule.definition.assigneeId)
  if (rule.definition.checklistTemplateId)
    template(db, rule.definition.checklistTemplateId, 'CHECKLIST')
  const dates = recurrenceDates(rule.definition, String(p.from), String(p.to))
  return {
    rule,
    items: dates.map((date) => ({
      date,
      existing: Boolean(
        one(
          db,
          'SELECT 1 FROM recurring_occurrences WHERE rule_id=? AND occurrence_date=?',
          rule.id,
          date
        )
      ),
      closed: Boolean(
        one(db, 'SELECT id FROM daily_closures WHERE close_date=?', date)
      ),
      past: date < koreaDate()
    }))
  }
```

S028 src/main/services/UsabilityService.ts:596-640 — 재검증·중복 skip·회차 순차 생성 transaction
```ts
  if (channel === 'recurring:generate')
    return db.transaction(() => {
      const { rule, items } = preview(db, user, p),
        dates = p.dates as string[]
      if (dates.some((d) => !items.some((i) => i.date === d)))
        throw new Error('미리보기 범위에 없는 예정일입니다.')
      if (items.some((i) => dates.includes(i.date) && !i.existing && i.closed))
        throw new Error('마감된 업무일을 포함합니다.')
      if (
        !p.allowPast &&
        items.some((i) => dates.includes(i.date) && !i.existing && i.past)
      )
        throw new Error('과거 작업 생성 확인이 필요합니다.')
      const batchId = randomUUID(),
        created: { id: string; task_no: string }[] = [],
        skipped: string[] = []
      for (const date of dates) {
        if (
          one(
            db,
            'SELECT 1 FROM recurring_occurrences WHERE rule_id=? AND occurrence_date=?',
            rule.id,
            date
          )
        ) {
          skipped.push(date)
          continue
        }
        const task = createMaintenance(db, user, {
          ...rule.definition,
          scheduledDate: date,
          workKind: 'PLANNED'
        })
        created.push(task)
        db.prepare(
          'INSERT INTO recurr
```

S029 src/main/services/OperationalControlService.ts:35-35 — 상황경보·계획·정합성·마감·인수인계
```ts
export async function runOperationalChannel(db: Database.Database, channel: Channel, p: Record<string, unknown>, user: PublicUser, attachmentRoot?: string): Promise<unknown> {
```

S030 src/main/services/OperationalControlService.ts:104-118 — ADMIN 수동 마감·예외·집계 snapshot
```ts
  if (channel === 'control:closeDay') {
    permit(user,'ADMIN')
    return db.transaction(() => {
      if (one(db,'SELECT id FROM daily_closures WHERE close_date=?',p.date)) throw new Error('이미 마감된 날짜입니다.')
      const issues = reconciliationPreview(db,String(p.date))
      if (issues.length && !p.allowExceptions) throw new Error(`미해결 정합성 항목 ${issues.length}건이 있습니다. 확인 후 예외 마감하십시오.`)
      const createdAt = now()
      for (const issue of issues) db.prepare('INSERT INTO reconciliation_results (id,close_date,issue_type,entity_type,entity_id,description,status,exception_reason,reviewed_by,reviewed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(randomUUID(),p.date,issue.issue_type,issue.entity_type,issue.entity_id,issue.description,p.allowExceptions ? 'EXCEPTION' : 'OPEN',p.allowExceptions ? '관리자 예외 마감' : null,p.allowExceptions ? user.id : null,p.allowExceptions ? createdAt : null,createdAt)
      const plans = all(db,'SELECT * FROM maintenance_daily_plans WHERE plan_date=?',p.date)
      const summary = { plans:plans.length,planned:plans.reduce((s,r)=>s+Number(r.planned_count),0),unplanned:plans.reduce((s,r)=>s+Number(r.unplanned_count),0),completed:plans.reduce((s,r)
```

S031 src/main/services/AppService.ts:151-151 — 다중 담당자를 개별 duty_roster 행으로 저장
```ts
  if (channel === 'duty:create') { permit('ADMIN','OPERATOR','USER'); const assignees = p.assignees as { userId: string; position: string }[]; return db.transaction(() => assignees.map(a => { if (!one(db, 'SELECT id FROM users WHERE id=? AND active=1', a.userId)) throw new Error('사용자를 찾을 수 없습니다.'); const id = randomUUID(), row = { dutyDate: p.dutyDate, shiftType: p.shiftType, ...a }; db.prepare('INSERT INTO duty_roster (id,duty_date,shift_type,user_id,position,start_time,end_time,availability_status) VALUES (?,?,?,?,?,?,?,?)').run(id,p.dutyDate,p.shiftType,a.userId,a.position,null,null,'AVAILABLE'); audit(db,'CREATE','duty_roster',id,null,row); return { id } }))() }
```

S032 src/main/services/AppService.ts:161-161 — 지시 확인 이력
```ts
  if (channel === 'directives:acknowledge') { const user=requireUser(); directiveAccess(db,user,String(p.id)); db.prepare('INSERT OR IGNORE INTO directive_acknowledgements (id,directive_id,user_id,acknowledged_at) VALUES (?,?,?,?)').run(randomUUID(),p.id,user.id,now()); audit(db,'ACKNOWLEDGE','directives',String(p.id),null,{ userId:user.id }); return true }
```

S033 src/main/services/OrganizationService.ts:7-7 — 조직과 조치부서 mapping
```ts
export function listActionDepartments(db: Database.Database): unknown[] {
```

S034 src/main/database/organizationContacts.ts:38-73 — 빈 인증정보의 가상 명부 생성
```ts
export function seedOrganizationContacts(db: Database.Database): void {
  const units = db
    .prepare(
      "SELECT id,name FROM organization_units WHERE unit_level IN ('WING','BRIGADE','GROUP') ORDER BY id"
    )
    .all() as { id: string; name: string }[]
  const date = new Date().toISOString()
  db.transaction(() => {
    for (const [index, unit] of units.entries())
      for (let slot = 1; slot <= 10; slot++) {
        if (
          db
            .prepare(
              'SELECT user_id FROM organization_members WHERE unit_id=? AND demo_slot=?'
            )
            .get(unit.id, slot)
        )
          continue
        const id = `org-demo-${unit.id}-${slot}`,
          username = `org_demo_${unit.id.toLowerCase()}_${String(slot).padStart(2, '0')}`
        // These are fictional assignable contacts, not sign-in accounts. Empty credentials are rejected by passwordMatches.
        const name = surnames[slot - 1] + givenNames[index % givenNames.length]
        db.prepare(
          `INSERT OR IGNORE INTO users (id,username,display_name,rank_name,unit_name,role,password_hash,password_salt,active,created_at,updated_at)
        VALUES (?,?,?,?,?,'MAINTAINER','','',1,?,?)`
```

S035 src/main/database/connection.ts:9-22 — DB/seed 경로·최초 복사·WAL·migration·seed
```ts
export const dbPath = (): string => join(app.getPath('userData'), 'data', 'omnis.db')
export const seedPath = (): string => app.isPackaged ? join(process.resourcesPath, 'db', 'omnis-seed.db') : join(process.cwd(), 'resources', 'db', 'omnis-seed.db')
export function openDb(): Database.Database {
  if (db) return db
  const path = dbPath()
  mkdirSync(dirname(path), { recursive: true })
  if (!existsSync(path) && existsSync(seedPath())) copyFileSync(seedPath(), path)
  db = new Database(path)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 5000')
  try { migrate(db); seed(db) } catch (error) { db.close(); db = undefined; throw error }
  return db
```

S036 src/main/database/migrate.ts:6-6 — 현재 schema 8
```ts
export const SCHEMA_VERSION = 8
```

S037 src/main/database/migrate.ts:9-24 — 부족한 v1~v8 순차 transaction
```ts
export function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current > SCHEMA_VERSION) throw new Error('DB schema is newer than this application')
  if (current === SCHEMA_VERSION) return
  db.transaction(() => {
    if (current < 1) migrateV1(db)
    if (current < 2) migrateV2(db)
    if (current < 3) migrateV3(db)
    if (current < 4) migrateV4(db)
    if (current < 5) migrateV5(db)
    if (current < 6) migrateUsability(db)
    if (current < 7) migrateOrganizations(db)
    if (current < 8) migrateOrganizationContacts(db)
    db.pragma(`user_version = ${SCHEMA_VERSION}`)
  })()
}
```

S038 src/main/database/seed.ts:49-58 — seed 조건 및 가상 데이터 보충
```ts
export function seed(db: Database.Database): void {
  if ((db.prepare('SELECT count(*) n FROM users').get() as { n: number }).n) { ensureDemoUser(db); ensureOperationalDemoData(db); seedOrganizationDirectory(db); seedOrganizationContacts(db); return }
  db.transaction(() => {
    const insertUser = db.prepare('INSERT INTO users (id,username,display_name,rank_name,unit_name,role,password_hash,password_salt,active,created_at,updated_at,service_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    const names = ['김정보', '이통신', '박운용', '최정비', '정지원', '한관제', '서네트', '오보안', '유장비', '강당직']
    const ids: string[] = []
    names.forEach((name, i) => {
      const id = randomUUID(), salt = randomBytes(16).toString('hex')
      ids.push(id)
      insertUser.run(id, i === 0 ? demoCredentials.username : `demo_${i}`, name, i < 5 ? '대위' : '중위', '가상 정보통신대', i === 0 ? 'ADMIN' : i < 4 ? 'OPERATOR' : i < 8 ? 'MAINTAINER' : 'VIEWER', scryptSync(i === 0 ? demoCredentials.password : 'Demo!2026', salt, 64).toString('hex'), salt, 1, day(), day(), `15-${70000000 + i}`)
```

S039 src/main/repositories/DashboardRepository.ts:10-37 — Drizzle count와 직접 SQL 혼용
```ts
  constructor(private db: Database.Database) { this.orm = drizzle(db,{ schema }) }
  summary(): Record<string, unknown> {
    const today = koreaDate(), now = new Date().toISOString()
    // 상세 팝업에서 체계명·담당자명을 보여주기 위한 공통 조인
    const incidentSql = `SELECT i.*, s.name system_name, r.display_name reporter_name, a.display_name assignee_name FROM incidents i
      LEFT JOIN communication_systems s ON s.id = i.system_id LEFT JOIN users r ON r.id = i.reported_by LEFT JOIN users a ON a.id = i.assigned_to`
    const maintenanceSql = `SELECT m.*, s.name system_name, u.display_name assignee_name FROM maintenance_tasks m
      LEFT JOIN communication_systems s ON s.id = m.system_id LEFT JOIN users u ON u.id = m.assignee_id
      WHERE m.status IN ('IN_PROGRESS','BLOCKED','PLANNED') ORDER BY CASE m.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'BLOCKED' THEN 1 ELSE 2 END, m.scheduled_date`
    const allSystems = this.db.prepare('SELECT * FROM communication_systems ORDER BY display_order').all() as Row[]
    const systems = allSystems.slice(0, 8)
    const recentIncidents = this.db.prepare(`${incidentSql} ORDER BY i.reported_at DESC LIMIT 30`).all() as Row[]
    const urgentIncidents = this.db.prepare(`
```

S040 src/main/database/migrate.ts:74-86 — v1~v5 실제 SQL DDL
```ts
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, rank_name TEXT, unit_name TEXT, role TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS communication_systems (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL, uptime_pct REAL NOT NULL, today_incident_count INTEGER NOT NULL DEFAULT 0, remarks TEXT, display_order INTEGER NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS communication_status_history (id TEXT PRIMARY KEY, system_id TEXT NOT NULL REFERENCES communication_systems(id), status TEXT NOT NULL, uptime_pct REAL NOT NULL, recorded_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, ticket_no TEXT UNIQUE NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, system_id TEXT REFERENCES communication_systems(id), severity TEXT NOT NULL, status TEXT NOT NULL, description TEXT NOT NULL, reported_by TEXT NOT NULL REFERENCES users(id), assigned_to TEXT REFERENCES users(id), depar
```

S041 src/main/database/usabilityMigration.ts:9-14 — snapshot·체크리스트·반복 실제 FK
```ts
    CREATE TABLE work_templates(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('INCIDENT','CHECKLIST')),version INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,definition_json TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE incident_intakes(incident_id TEXT PRIMARY KEY REFERENCES incidents(id) ON DELETE CASCADE,template_id TEXT REFERENCES work_templates(id),template_version INTEGER,questions_json TEXT NOT NULL,answers_json TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE task_checklists(task_id TEXT PRIMARY KEY REFERENCES maintenance_tasks(id) ON DELETE CASCADE,template_id TEXT NOT NULL REFERENCES work_templates(id),template_version INTEGER NOT NULL,title TEXT NOT NULL,items_json TEXT NOT NULL,results_json TEXT NOT NULL DEFAULT '[]',revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
    CREATE TABLE recurring_rules(id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,deleted INTEGER NOT NULL DEFAULT 0,definition_json TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL);
    CREATE TABLE recurring_occurrences(rule_id TEXT NOT NULL REFERENCES recurring_rules(id),occ
```

S042 src/main/database/organizationMigration.ts:5-13 — 조직/조치부서 FK
```ts
  db.exec(`CREATE TABLE IF NOT EXISTS organization_units (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, unit_level TEXT NOT NULL,
    source_url TEXT NOT NULL DEFAULT '', source_date TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS team_organizations (
    team_id TEXT PRIMARY KEY REFERENCES maintenance_teams(id),
    unit_id TEXT NOT NULL REFERENCES organization_units(id), department_name TEXT NOT NULL,
    source_url TEXT, source_date TEXT, provenance TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '', UNIQUE(unit_id,department_name)
```

S043 src/main/database/organizationContacts.ts:4-8 — 명부 PK/FK 및 unique 부대/slot
```ts
  db.exec(`CREATE TABLE IF NOT EXISTS organization_members (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    unit_id TEXT NOT NULL REFERENCES organization_units(id),
    demo_slot INTEGER NOT NULL CHECK(demo_slot BETWEEN 1 AND 10),
    is_demo INTEGER NOT NULL DEFAULT 1, UNIQUE(unit_id,demo_slot)
```

S044 src/main/services/AttachmentService.ts:9-9 — native dialog→파일·metadata 저장
```ts
export async function runAttachmentChannel(db: Database.Database, channel: Channel, p: Record<string,unknown>, user: PublicUser): Promise<unknown> {
```

S045 src/main/services/AttachmentStore.ts:93-93 — 원본 복사·해시·DB metadata·실패시 복사본 정리
```ts
export function storeAttachmentPaths(db: Database.Database, user: PublicUser, input: { entityType:AttachmentEntity; entityId:string; category:AttachmentCategory; note?:string }, sourcePaths: string[], root: string): Row[] {
```

S046 src/main/services/AppService.ts:195-195 — DB backup + 첨부 복사, 최신 10개 보존
```ts
export async function backup(db = openDb()): Promise<string> { const dir = join(app.getPath('userData'), 'backups'), stamp=now().replaceAll(/[-:T]/g, '').slice(0,14); mkdirSync(dir, { recursive: true }); const file = join(dir, `omnis-${stamp}.db`), sourceAttachments=attachmentRoot(), attachmentBackup=join(dir,`omnis-${stamp}-attachments`); await db.backup(file); if (existsSync(sourceAttachments)) cpSync(sourceAttachments,attachmentBackup,{recursive:true}); const files = readdirSync(dir).filter(n => /^omnis-\d+\.db$/.test(n)).sort().reverse(); files.slice(10).forEach(n => { unlinkSync(join(dir,n)); rmSync(join(dir,n.replace(/\.db$/,'-attachments')),{recursive:true,force:true}) }); audit(db, 'BACKUP', 'database', file, null, { path: file,attachments:existsSync(attachmentBackup) ? attachmentBackup : null }); return file }
```

S047 src/main/services/AppService.ts:164-164 — 전체 업무 CSV를 로컬 저장
```ts
  if (channel === 'reports:exportCsv') { const rows = p.kind === 'incidents' ? all(db, 'SELECT ticket_no,title,severity,status,reported_at FROM incidents') : all(db, 'SELECT task_no,title,status,scheduled_date,progress FROM maintenance_tasks'); const save = await dialog.showSaveDialog({ defaultPath: `${p.kind}-${koreaDate()}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] }); if (save.canceled || !save.filePath) return null; const { writeFileSync } = await import('node:fs'); const keys = Object.keys(rows[0] ?? {}); const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`; writeFileSync(save.filePath, '\uFEFF' + [keys.join(','), ...rows.map(r => keys.map(k => escape(r[k])).join(','))].join('\r\n')); return save.filePath }
```

S048 src/main/services/AppService.ts:172-177 — 당일 고장 SQL→HTML→printToPDF→저장
```ts
  if (channel === 'reports:exportPdf') {
    const rows = all(db,'SELECT ticket_no,title,severity,status FROM incidents WHERE substr(reported_at,1,10)=? ORDER BY reported_at',p.date)
    const escape = (v: unknown) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
    const html = `<html><meta charset="utf-8"><style>body{font:12px sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px;text-align:left}</style><h1>OMNIS 일일 고장 현황</h1><p>${escape(p.date)} · 가상 시연 데이터</p><table><tr><th>접수번호</th><th>제목</th><th>중요도</th><th>상태</th></tr>${rows.map(r => `<tr><td>${escape(r.ticket_no)}</td><td>${escape(r.title)}</td><td>${escape(r.severity)}</td><td>${escape(r.status)}</td></tr>`).join('')}</table></html>`
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } })
    try { await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`); const pdf = await win.webContents.printToPDF({ printBackground: true }); const chosen = await dialog.showSaveDialog({ defaultPath: `omnis-daily-${p.date}.pdf
```

S049 src/main/services/AppService.ts:162-163 — 일별 상태/주별 날짜 건수
```ts
  if (channel === 'reports:daily') return { date: p.date, incidents: all(db, "SELECT status,count(*) n FROM incidents WHERE date(reported_at,'+9 hours')=? GROUP BY status", p.date), maintenance: all(db, 'SELECT status,count(*) n FROM maintenance_tasks WHERE scheduled_date=? GROUP BY status', p.date) }
  if (channel === 'reports:weekly') { const end = new Date(`${p.startDate}T00:00:00Z`); end.setUTCDate(end.getUTCDate()+7); const endDate = end.toISOString().slice(0,10); return { startDate: p.startDate, endDate, incidents: all(db,"SELECT date(reported_at,'+9 hours') day,count(*) n FROM incidents WHERE date(reported_at,'+9 hours')>=? AND date(reported_at,'+9 hours')<? GROUP BY day ORDER BY day",p.startDate,endDate), maintenance: all(db,'SELECT scheduled_date day,count(*) n FROM maintenance_tasks WHERE scheduled_date>=? AND scheduled_date<? GROUP BY day ORDER BY day',p.startDate,endDate) } }
```

S050 src/main/services/ManualService.ts:64-86 — 번들 PDF 검증 후 선택 경로 복사
```ts
export async function saveManual(
  root: string,
  role: string,
  choosePath: (filename: string) => Promise<string | undefined>
): Promise<{ canceled: boolean; filename?: string }> {
  const entry = entryFor(role),
    source = await sourceFor(root, role)
  const chosen = await choosePath(entry.filename)
  if (!chosen) return { canceled: true }
  const destination = chosen.toLowerCase().endsWith('.pdf')
    ? chosen
    : `${chosen}.pdf`
  if (resolve(destination) === resolve(source))
    throw new Error('앱에 포함된 원본 대신 다른 저장 위치를 선택해 주세요.')
  try {
    await copyFile(source, destination)
  } catch {
    throw new Error(
      '매뉴얼 저장에 실패했습니다. 저장 위치와 권한을 확인해 주세요.'
    )
  }
  return { canceled: false, filename: entry.filename }
}
```

S051 src/main/services/AppService.ts:49-49 — 요청 시 Factory/Orchestrator 생성
```ts
const aiRuntime = (db:Database.Database,user:PublicUser,overrideProvider?:AIProviderName) => { const settings={...aiSettings(db),provider:overrideProvider??aiSettings(db).provider}; const factory=new AIProviderFactory(settings,secretStore(),e2eAIClients()),selected=factory.create(); const orchestrator=new AIOrchestrator(factory.local,{timeoutMs:settings.timeoutSeconds*1000,record:r=>recordAiRun(db,user,r)}); return {settings,selected,local:factory.local,orchestrator} }
```

S052 src/main/services/AppService.ts:46-46 — 선택/실제 Provider, model, tokens, latency, fallback, 전송 flag
```ts
const recordAiRun = (db:Database.Database,user:PublicUser,record:AIRunRecord):void => { const id=randomUUID(),result=record.result,created=now(),confidence=typeof (result.data as {confidence?:unknown})?.confidence==='number'?(result.data as {confidence:number}).confidence:null; db.prepare(`INSERT INTO ai_runs (id,feature,provider,model,prompt_version,input_summary,output_json,confidence,latency_ms,status,fallback_used,user_modified,applied,entity_type,entity_id,created_by,created_at,request_id,input_tokens,output_tokens,error_code,external_transmission,output_schema_version,selected_provider) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,record.feature,result.metadata.provider,result.metadata.model,result.metadata.promptVersion,record.inputSummary.slice(0,100),JSON.stringify(result.data),confidence,result.metadata.latencyMs,result.fallbackUsed?'FALLBACK':'SUCCESS',result.fallbackUsed?1:0,0,0,record.entityType,record.entityId,user.id,created,result.metadata.requestId,result.metadata.inputTokens,result.metadata.outputTokens,result.errorCode,result.metadata.externalTransmission?1:0,result.metadata.promptVersion,record.selectedProvider); result.runId=id }
```

S053 src/main/services/AppService.ts:43-44 — KST 외부전송 flag 행 수 한도
```ts
const externalRequestCount = (db:Database.Database):number => Number(one(db,"SELECT count(*) n FROM ai_runs WHERE external_transmission=1 AND date(created_at,'+9 hours')=?",koreaDate())?.n??0)
const guardExternalLimit = (db:Database.Database,provider:AIProvider,limit:number):void => { if(provider.external)assertDailyRequestLimit(externalRequestCount(db),limit) }
```

S054 src/main/services/AppService.ts:165-165 — 권한→입력 조합→한도→Orchestrator→이력
```ts
  if (channel === 'ai:triageIncident') { const user=permit('ADMIN','OPERATOR','MAINTAINER','USER'); if(p.incidentId&&user.role==='USER'&&!one(db,'SELECT id FROM incidents WHERE id=? AND reported_by=?',p.incidentId,user.id))throw new Error('권한이 없습니다.'); p={...p,description:analysisDescription(String(p.description),(p.answers as IntakeAnswer[]|undefined)??[],p.incidentId?getIntake(db,String(p.incidentId))?.questions:undefined)}; const runtime=aiRuntime(db,user),call=()=>{guardExternalLimit(db,runtime.selected,runtime.settings.dailyRequestLimit);return runtime.selected.triageIncident(String(p.title),String(p.description),String(p.serviceImpact??''))}; const result=await runtime.orchestrator.execute('incident_triage',runtime.selected,call,()=>runtime.local.triageIncident(String(p.title),String(p.description),String(p.serviceImpact??'')),{inputSummary:String(p.title),entityType:p.incidentId?'incident':undefined,entityId:p.incidentId?String(p.incidentId):undefined}); db.prepare('INSERT INTO ai_interactions VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(),result.metadata.provider,'triage',String(p.title).slice(0,100),JSON.stringify(result.data),(result.data as {confidence:number}).confidence,r
```

S055 src/main/services/AppService.ts:168-168 — DB 집계 입력만 일일 요약에 제공
```ts
  if (channel === 'ai:dailySummary') { const user=permit('ADMIN','OPERATOR','MAINTAINER','VIEWER'),runtime=aiRuntime(db,user),status=dailyStatus(db),call=()=>{guardExternalLimit(db,runtime.selected,runtime.settings.dailyRequestLimit);return runtime.selected.summarizeDailyStatus(status)}; const result=await runtime.orchestrator.execute('daily_summary',runtime.selected,call,()=>runtime.local.summarizeDailyStatus(status),{inputSummary:'집계된 일일 운영현황'}); return {...aiView(result),label:'AI 추천'} }
```

S056 src/main/services/AppService.ts:166-166 — SLA/작업량/평균 조치시간의 결정적 위험도
```ts
  if (channel === 'ai:slaRisk') { const user=requireUser(), incident=one(db,`SELECT i.*,t.average_resolution_minutes,t.name team_name FROM incidents i LEFT JOIN maintenance_teams t ON t.id=i.team_id WHERE i.id=?`,p.incidentId); if(!incident) throw new Error('접수 건을 찾을 수 없습니다.'); if (user.role === 'USER' && incident.reported_by !== user.id) throw new Error('권한이 없습니다.'); const due=incident.sla_due_at ? new Date(String(incident.sla_due_at)).getTime() : Date.now()+8*3600000, remaining=Math.round((due-Date.now())/60000), workload=incident.team_id ? Number(one(db,"SELECT count(*) n FROM incidents WHERE team_id=? AND status NOT IN ('CLOSED','CANCELED')",incident.team_id)?.n ?? 0) : 0, average=Number(incident.average_resolution_minutes ?? (incident.severity === 'URGENT' ? 60 : 240)), risk=remaining <= 0 || average*(1+workload*.15)>remaining ? 'HIGH' : average>remaining*.7 ? 'MEDIUM' : 'LOW'; const recommendation=risk === 'HIGH' ? '즉시 진행상태를 확인하고 가용 정비반 재배정을 검토하십시오.' : risk === 'MEDIUM' ? '담당자에게 예상 완료시각을 확인하십시오.' : '현재 배정과 조치계획을 유지하십시오.'; return { label:'AI 추천',provider:'Local Rule',risk,remainingMinutes:remaining,estimatedMinutes:Math.round(average*(1+workload*.15)),workload,teamName:inciden
```

S057 src/main/ai/AIProviderFactory.ts:16-25 — Provider 선택·외부 활성화/동의/credential
```ts
  create():AIProvider {
    const s=this.settings
    if(s.provider==='LOCAL')return this.local
    if(s.provider==='OLLAMA')return new OllamaProvider(s.ollamaEndpoint,s.ollamaModel,s.timeoutSeconds*1000)
    if(!s.externalAiEnabled||!s.externalAiConsentAt)return new UnavailableProvider(s.provider,s.provider==='OPENAI'?s.openaiModel:s.anthropicModel,'EXTERNAL_DISABLED','외부 AI 사용 활성화와 전송 동의를 선택한 뒤 AI 설정 저장을 완료해 주세요.')
    const credential=this.secrets.getCredential(s.provider)
    if(!credential)return new UnavailableProvider(s.provider,s.provider==='OPENAI'?s.openaiModel:s.anthropicModel,'CREDENTIAL_MISSING',`${s.provider==='OPENAI'?'OpenAI':'Anthropic'} API Key가 설정되지 않았습니다.`)
    return s.provider==='OPENAI'?new OpenAIProvider(credential.value,s.openaiModel,s.timeoutSeconds*1000,this.clients.openai):new AnthropicProvider(credential.value,s.anthropicModel,s.timeoutSeconds*1000,this.clients.anthropic)
  }
}
```

S058 src/main/ai/AIOrchestrator.ts:13-27 — 시도당 timeout·조건부 retry 최대2회·LOCAL fallback
```ts
  async execute<T>(feature:AIRunFeature,selected:AIProvider,primary:()=>Promise<ProviderResponse<T>>,fallback:()=>Promise<ProviderResponse<T>>,context:{inputSummary:string;entityType?:string;entityId?:string}):Promise<AIExecution<T>> {
    let error:AIProviderError|null=null
    const started=Date.now()
    if(selected.name==='LOCAL') { const response=await primary(); return this.finish(feature,selected.name,{...response,fallbackUsed:false,selectedProvider:selected.name,errorCode:null},context) }
    for(let attempt=0;attempt<=this.maxRetries;attempt++){
      try{const response=await this.withTimeout(primary()); return this.finish(feature,selected.name,{...response,fallbackUsed:false,selectedProvider:selected.name,errorCode:null},context)}
      catch(cause){error=safeProviderError(cause); if(!error.retryable||attempt===this.maxRetries)break; const base=error.retryAfterMs??Math.min(4000,250*2**attempt); await this.sleep(base+Math.floor(Math.random()*100))}
    }
    const localResponse=await fallback()
    localResponse.metadata.latencyMs=Date.now()-started
    localResponse.metadata.externalTransmission=selected.external&&!['CREDENTIAL_MISSING','EXTERNAL_DISABLED','DAILY_LIMIT'].
```

S059 src/main/ai/AIProvider.ts:14-22 — 업무 기능 Provider 계약
```ts
export interface AIProvider {
  readonly name: AIProviderName
  readonly model: string
  readonly external: boolean
  triageIncident(title: string, description: string, serviceImpact?: string): Promise<ProviderResponse<Triage>>
  summarizeDailyStatus(status: DailyStatus): Promise<ProviderResponse<{ summary: string }>>
  recommendMaintenance(candidates: MaintenanceCandidate[]): Promise<ProviderResponse<MaintenanceCandidate[]>>
  findSimilarIncidents(title: string, candidates: IncidentMatch[]): Promise<ProviderResponse<IncidentMatch[]>>
}
```

S060 src/main/ai/PromptCatalog.ts:77-77 — 기능별 version·system·JSON schema·token 제한
```ts
export const promptCatalog = {
```

S061 src/main/ai/ExternalDataGuard.ts:4-10 — 패턴 마스킹·길이·후보 개수·허용 ID
```ts
const patterns = [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,/\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g,/\b\d{2}-\d{5,8}\b/g,/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,/\b(?:sk|api|key)[-_][A-Za-z0-9_-]{12,}\b/gi,/\b(?:password|passwd|비밀번호|token|secret|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi,/(?:[A-Za-z]:\\|\\\\)[^\r\n<>:"|?*]+/g,/\/(?:Users|home|var|tmp)\/[^\s]+/g]
export function redactExternalText(value:string,maxLength:number):string { let output=value.slice(0,maxLength); for(const pattern of patterns) output=output.replace(pattern,MASK); return output }
export function externalTriageInput(title:string,description:string,serviceImpact=''):Record<string,string> { return { title:redactExternalText(title,200),description:redactExternalText(description,1000),serviceImpact:redactExternalText(serviceImpact,500) } }
export function externalDailyInput(status:DailyStatus):DailyStatus { return {...status,majorAlerts:status.majorAlerts.slice(0,10).map(v=>redactExternalText(v,160))} }
export function externalIncidentCandidates(title:string,candidates:IncidentMatch[]):{title:string;candidates:Array<{id:string;title:string;status:string}>} { return {title:redactExternalText(title,200),candidates:candidat
```

S062 src/main/ai/AIUsagePolicy.ts:2-2 — 일일 외부 요청 한도
```ts
export function assertDailyRequestLimit(current:number,limit:number):void { if(current>=limit)throw new AIProviderError('DAILY_LIMIT','일일 외부 AI 요청 한도에 도달했습니다.') }
```

S063 src/main/ai/AISecretStore.ts:10-22 — 환경변수 우선·safeStorage 암호문·상태 반환
```ts
export class AISecretStore {
  readonly filePath:string
  constructor(userDataPath:string,private encryption:EncryptionAdapter,private env:NodeJS.ProcessEnv=process.env){this.filePath=join(userDataPath,'secrets','ai-credentials.json')}
  private read():SecretFile { if(!existsSync(this.filePath))return {version:1,credentials:{}}; try{const value=JSON.parse(readFileSync(this.filePath,'utf8')) as SecretFile; return value.version===1&&value.credentials?value:{version:1,credentials:{}}}catch{return {version:1,credentials:{}}} }
  private write(value:SecretFile):void { mkdirSync(dirname(this.filePath),{recursive:true}); const temp=`${this.filePath}.tmp`; writeFileSync(temp,JSON.stringify(value),{encoding:'utf8',mode:0o600}); try{renameSync(temp,this.filePath)}catch{copyFileSync(temp,this.filePath);unlinkSync(temp)} }
  private envName(provider:CredentialProvider):'OPENAI_API_KEY'|'ANTHROPIC_API_KEY' { return provider==='OPENAI'?'OPENAI_API_KEY':'ANTHROPIC_API_KEY' }
  getCredential(provider:CredentialProvider):{value:string;source:Exclude<CredentialSource,'none'>}|null { const envValue=this.env[this.envName(provider)]?.trim(); if(envValue)return {value:envValue,source:'environment'}; con
```

S064 src/main/ai/ProviderSupport.ts:5-7 — 안전한 오류·retry 분류·출력 검증
```ts
export function safeProviderError(error:unknown):AIProviderError { if(error instanceof AIProviderError)return error; const source=(error instanceof Error?error:new Error('Unknown provider error')) as StatusError; const status=source.status; const timeout=source.name==='AbortError'||source.code==='ETIMEDOUT'||source.code==='ECONNABORTED'; const network=!status&&(timeout||/network|fetch|socket|connect|offline/i.test(source.message)); const retryable=network||status===408||status===429||(typeof status==='number'&&status>=500); const code=timeout?'TIMEOUT':status?`HTTP_${status}`:network?'NETWORK_ERROR':'PROVIDER_ERROR'; const message=status===401||status===403?'API 인증정보 또는 접근 권한을 확인하십시오.':status===429?'외부 AI 요청 한도에 도달했습니다.':timeout?'외부 AI 응답 시간이 초과되었습니다.':network?'외부 AI 서비스에 연결할 수 없습니다.':'외부 AI 응답을 처리하지 못했습니다.'; return new AIProviderError(code,message,retryable,status,retryAfterMs(source.headers)) }
export function parseJson<T>(text:string,parser:{parse(value:unknown):T}):T { if(!text.trim())throw new AIProviderError('EMPTY_OUTPUT','외부 AI가 빈 응답을 반환했습니다.'); try{return parser.parse(JSON.parse(text))}catch{throw new AIProviderError('SCHEMA_VALIDATION','외부 AI 응답 형식이 유효하지 않습니다.')} }
export
```

S065 src/main/ai/OpenAIProvider.ts:16-29 — SDK Responses/strict json_schema/store:false/Zod
```ts
  private async generate<T>(definition:PromptDefinition,input:unknown,parser:{parse(value:unknown):T}):Promise<ProviderResponse<T>> {
    const started=Date.now()
    try {
      const response=await this.client.responses.create({model:this.model,store:false,instructions:definition.system,input:`<business_data>${JSON.stringify(input)}</business_data>`,reasoning:{effort:'low'},max_output_tokens:definition.maxOutputTokens,text:{format:{type:'json_schema',name:definition.schemaName,strict:true,schema:definition.jsonSchema}}})
      if(response.status==='incomplete')throw new AIProviderError('INCOMPLETE','외부 AI 응답이 완성되지 않았습니다.')
      if(response.output?.some(item=>item.content?.some(part=>part.type==='refusal')))throw new AIProviderError('REFUSAL','외부 AI가 요청 처리를 거부했습니다.')
      const data=parseJson(response.output_text,parser)
      return {data,metadata:{provider:'OPENAI',model:this.model,promptVersion:definition.version,latencyMs:Date.now()-started,inputTokens:response.usage?.input_tokens??null,outputTokens:response.usage?.output_tokens??null,requestId:response._request_id??null,externalTransmission:true}}
    } catch(error){throw safeProviderError(error)}
  }
  async triageIncident
```

S066 src/main/ai/AnthropicProvider.ts:16-31 — SDK Messages/output_config/Zod
```ts
  private async generate<T>(definition:PromptDefinition,input:unknown,parser:{parse(value:unknown):T}):Promise<ProviderResponse<T>> {
    const started=Date.now()
    try {
      const response=await this.client.messages.create({model:this.model,max_tokens:definition.maxOutputTokens,system:definition.system,messages:[{role:'user',content:`<business_data>${JSON.stringify(input)}</business_data>`}],output_config:{format:{type:'json_schema',schema:definition.jsonSchema}}})
      if(response.stop_reason==='refusal')throw new AIProviderError('REFUSAL','외부 AI가 요청 처리를 거부했습니다.')
      if(response.stop_reason==='max_tokens'||response.stop_reason==='model_context_window_exceeded'||response.stop_reason==='pause_turn')throw new AIProviderError('INCOMPLETE','외부 AI 응답이 완성되지 않았습니다.')
      const block=response.content.find(part=>part.type==='text')
      if(!block?.text)throw new AIProviderError('EMPTY_OUTPUT','외부 AI가 텍스트 응답을 반환하지 않았습니다.')
      const data=parseJson(block.text,parser)
      return {data,metadata:{provider:'ANTHROPIC',model:this.model,promptVersion:definition.version,latencyMs:Date.now()-started,inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens,requ
```

S067 src/main/ai/OllamaProvider.ts:12-24 — 별도 HTTP api/generate·timeout·Zod
```ts
  private async generate<T>(prompt:string,schema:z.ZodType<T>,promptVersion:string):Promise<ProviderResponse<T>> {
    const started=Date.now(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),this.timeoutMs)
    try {
      const response=await fetch(`${this.endpoint}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:this.model,prompt,stream:false,format:'json'}),signal:controller.signal})
      if(!response.ok)throw new AIProviderError(`HTTP_${response.status}`,'Ollama 응답 오류',response.status===408||response.status===429||response.status>=500,response.status)
      const envelope=z.object({response:z.string(),prompt_eval_count:z.number().optional(),eval_count:z.number().optional()}).parse(await response.json())
      return {data:parseJson(envelope.response,schema),metadata:{provider:'OLLAMA',model:this.model,promptVersion,latencyMs:Date.now()-started,inputTokens:envelope.prompt_eval_count??null,outputTokens:envelope.eval_count??null,requestId:null,externalTransmission:false}}
    } catch(error){throw safeProviderError(error)} finally{clearTimeout(timeout)}
  }
  async triageIncident(title:string,descripti
```

S068 src/main/ai/LocalRuleProvider.ts:13-13 — 기본 결정적 규칙, 생성형 LLM 아님
```ts
export class LocalRuleProvider implements AIProvider {
```

S069 src/main/services/AppService.ts:180-184 — ADMIN 상태·설정·Key 저장/삭제·연결시험
```ts
  if (channel === 'system:getAiSettings') { permit('ADMIN'); const settings=aiSettings(db),secrets=secretStore(); return {...settings,credentials:{OPENAI:secrets.status('OPENAI'),ANTHROPIC:secrets.status('ANTHROPIC')},lastTests:{OPENAI:{status:setting(db,'ai_test_openai_status','NOT_TESTED'),at:setting(db,'ai_test_openai_at','')||null},ANTHROPIC:{status:setting(db,'ai_test_anthropic_status','NOT_TESTED'),at:setting(db,'ai_test_anthropic_at','')||null},OLLAMA:{status:setting(db,'ai_test_ollama_status','NOT_TESTED'),at:setting(db,'ai_test_ollama_at','')||null}},fallbackPolicy:'선택 Provider 실패 시 Local Rule'} }
  if (channel === 'system:setAiSettings') { permit('ADMIN'); const external=p.provider==='OPENAI'||p.provider==='ANTHROPIC'; if(external&&(!p.externalAiEnabled||!p.externalConsent))throw new Error('외부 AI Provider 선택 전에 외부 전송·비용·최종 검토 안내에 동의해야 합니다.'); return db.transaction(()=>{const before=aiSettings(db),consent=p.externalConsent?(before.externalAiConsentAt??now()):''; const values:[string,string][]= [['ai_provider',String(p.provider)],['ollama_endpoint',String(p.ollamaEndpoint)],['ollama_model',String(p.ollamaModel)],['openai_model',String(p.openaiModel)],['anthropic_model',Stri
```

S070 src/renderer/src/main.tsx:4-4 — React 진입 및 Pretendard
```ts
import 'pretendard/dist/web/variable/pretendardvariable.css'
```

S071 src/renderer/src/App.tsx:385-385 — useState 인증 + HashRouter
```ts
export default function App() { const [user,setUser] = useState<PublicUser | null>(null),[ready,setReady] = useState(false); useEffect(() => { call<PublicUser | null>('auth:me').then(setUser).finally(() => setReady(true)); const reset = () => setUser(null); window.addEventListener('omnis:reset',reset); return () => window.removeEventListener('omnis:reset',reset) }, []); return <ThemeProvider theme={theme}><HashRouter>{ready && (user ? <Shell user={user} onLogout={() => setUser(null)}/> : <Login onLogin={setUser}/>)}</HashRouter></ThemeProvider> }
```

S072 src/renderer/src/App.tsx:224-228 — 실제 메뉴 묶음
```ts
const navGroups: { title: string; to: string; items: NavItem[] }[] = [
  { title: '운용 현황', to: '/operations', items: [{ to: '/operations', text: '운영현황', icon: DnsRounded }, { to: '/incidents', text: '고장관리', icon: ReportProblemRounded }, { to: '/maintenance', text: '정비관리', icon: BuildRounded }, { to: '/control', text: '통제·일일마감', icon: FactCheckRounded }] },
  { title: '업무 지원', to: '/duty', items: [{ to: '/duty', text: '근무/지시사항', icon: EventNoteRounded }, { to: '/ai', text: 'AI 지원', icon: SmartToyRounded }, { to: '/reports', text: '보고서/통계', icon: AssessmentRounded }] },
  { title: '관리', to: '/settings', items: [{ to: '/signups', text: '사용자 신청현황', icon: HowToRegRounded, adminOnly: true }, { to: '/settings', text: '시스템관리', icon: SettingsRounded, adminOnly: true }] }
]
```

S073 src/renderer/src/App.tsx:278-290 — 11개 route 및 ADMIN guard
```ts
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/operations" element={<Operations user={user} />} />
          <Route path="/incidents" element={<Incidents user={user} />} />
          <Route path="/maintenance" element={<Maintenance user={user} />} />
          <Route path="/control" element={<ControlCenterManagement user={user} />} />
          <Route path="/duty" element={<Duty user={user} />} />
          <Route path="/ai" element={<Ai />} />
          <Route path="/manuals" element={<ManualsManagement user={user}/>} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/signups" element={admin ? <SignupRequests onChange={loadPending} /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={admin ? <Settings user={user} /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
```

S074 src/renderer/src/usabilityApi.ts:3-10 — Result 실패를 Error로 변환
```ts
export async function invoke<T>(
  channel: Channel,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const r = (await window.omnis.invoke(channel, payload)) as Result<T>
  if (!r.ok) throw new Error(r.error.message)
  return r.data
}
```

S075 src/renderer/src/IncidentsManagement.tsx:45-45 — 목록 재조회 후 setRows
```ts
  const refresh = () => call<Row[]>('incidents:list',{ search,...(severityFilter?{severity:severityFilter}:{}),...(reportedFrom?{reportedFrom}:{}),...(reportedTo?{reportedTo}:{}),...(assigneeFilter?{assignedTo:assigneeFilter}:{}) }).then(setRows)
```

S076 src/renderer/src/IncidentsManagement.tsx:55-60 — 저장/배정/상태변경 후 재조회
```ts
  const save=()=>{if(!form)return;const{id,...raw}=form;const payload={...raw,occurredAt:toIso(raw.occurredAt),desiredResolutionAt:toIso(raw.desiredResolutionAt),actualActionStartedAt:raw.emergencyPreaction?toIso(raw.actualActionStartedAt):undefined};setBusy(true);call(id?'incidents:update':'incidents:create',id?{id,...payload}:payload).then(()=>{setForm(null);refresh()}).catch(e=>alert(e.message)).finally(()=>setBusy(false))}
  const assignTeam=async()=>{if(!selected||assignBusy)return;if(selected.team_id&&!teamId&&!confirm('조치부서 배정을 해제하고 미지정으로 저장하시겠습니까?'))return;setAssignBusy(true);try{await call('incidents:assignTeam',{id:selected.id,teamId:teamId||null,userId:assignee||null,note:teamId?'통제 담당자 조치부서 배정':'조치부서 미지정'});await show(selected);await refresh()}catch(e){alert((e as Error).message)}finally{setAssignBusy(false)}}
  const analyze=(answers:IntakeAnswer[]=analysisAnswers)=>{if(!selected||busy)return;const version=++analysisEpoch.current;setBusy(true);call<Row>('ai:triageIncident',{title:selected.title,description:selected.description,serviceImpact:selected.service_impact??'',systemId:selected.system_id,incidentId:selected.id,answers}).then(v=>{if(version===analysisEpoch.curre
```

S077 src/renderer/src/IncidentsManagement.tsx:58-58 — 사람 버튼→incidents:applyAi
```ts
  const applyAi=()=>{if(!selected||!ai)return;const team=teams.find(t=>t.code===ai.recommendedTeamCode);call('incidents:applyAi',{id:selected.id,category:ai.category,severity:ai.priority,teamId:team?.id,rationale:ai.rationale,confidence:ai.confidence,runId:ai.runId}).then(()=>{setAi(null);setSelected(null);refresh()}).catch(e=>alert(e.message))}
```

S078 src/renderer/src/RecurringMaintenance.tsx:109-109 — 반복 회차 미리보기 요청
```ts
      await invoke<Preview>('recurring:preview', {
```

S079 src/renderer/src/TaskChecklistPanel.tsx:42-43 — 체크리스트/템플릿 초기 동시조회
```ts
      invoke<TaskChecklist | null>('checklist:get', { taskId }),
      invoke<WorkTemplate[]>('templates:list', { kind: 'CHECKLIST' })
```

S080 src/renderer/src/InputAssist.tsx:18-18 — Renderer 로컬 입력보완과 명시적 AI 요청 구분
```ts
  missingQuestions,
```

S081 src/renderer/src/MyWork.tsx:38-38 — 내 업무 및 원래 업무 상세 이동
```ts
      const v = await invoke<Mine>('work:mine')
```

S082 src/renderer/src/MaintenanceManagement.tsx:8-8 — 달력·상세·반복·체크리스트
```ts
import FullCalendar from '@fullcalendar/react'
```

S083 src/renderer/src/ControlCenterManagement.tsx:26-26 — 화면 조작 역할 구분
```ts
  const canControl = ['ADMIN','OPERATOR'].includes(user.role), canPlan = ['ADMIN','MAINTAINER'].includes(user.role), admin = user.role === 'ADMIN'
```

S084 src/renderer/src/DutyManagement.tsx:76-77 — 근무·지시 UI 조작 역할
```ts
  const editable = ['ADMIN','OPERATOR','USER'].includes(user.role)
  const canManageDirective = ['ADMIN','OPERATOR'].includes(user.role)
```

S085 src/renderer/src/OperationsManagement.tsx:4-4 — 운용 이력 차트
```ts
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
```

S086 src/renderer/src/ReportsManagement.tsx:3-3 — 일/주 통계 차트
```ts
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
```

S087 src/renderer/src/AiManagement.tsx:37-37 — 분류/유사고장 동시 요청; 나머지 버튼
```ts
  const analyze = async(inputAnswers:IntakeAnswer[]=answers) => { if(busy)return;const version=epoch.current;setBusy('analysis');try{const jobs:[Promise<Row>,Promise<Row>|null]=[call<Row>('ai:triageIncident',{title,description,answers:inputAnswers}),title.length>=3?call<Row>('ai:similarIncidents',{title}):null];const [analysis,matches]=await Promise.all([jobs[0],jobs[1]]);if(version!==epoch.current)return;setResult(analysis);if(matches){setSimilar(matches.items);setSimilarMeta(matches)}}catch(e){alert((e as Error).message)}finally{setBusy('')} }
```

S088 src/renderer/src/SystemManagement.tsx:97-97 — 입력 순간 Renderer에 Key 있음, 저장된 Key 상태와 구분
```ts
              <TextField size="small" fullWidth type="password" label={`${kind} API Key 저장/교체`} value={kind==='OPENAI'?openaiKey:anthropicKey} disabled={aiDisabled} onChange={e=>kind==='OPENAI'?setOpenaiKey(e.target.value):setAnthropicKey(e.target.value)} autoComplete="new-password" sx={{mt:1.5}}/>
```

S089 package.json:3-3 — 소스 패키지 1.0.1, 실행중 버전 단정 없음
```ts
  "version": "1.0.1",
```

S090 package.json:15-15 — seed build 후 electron-vite build
```ts
    "build": "pnpm db:build-seed && electron-vite build",
```

S091 electron-builder.yml:8-17 — seed/매뉴얼 extraResources + native asarUnpack
```ts
extraResources:
  - from: resources/db/omnis-seed.db
    to: db/omnis-seed.db
  - from: resources/manuals
    to: manuals
    filter: ["*.pdf", "README.md"]
asarUnpack:
  - node_modules/better-sqlite3/**/*
win:
  icon: build/icon.svg
```

S092 electron-builder.yml:16-39 — Windows NSIS x64/macOS DMG·ZIP 설정
```ts
win:
  icon: build/icon.svg
  target:
    - target: nsis
      arch: [x64]
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
mac:
  icon: build/icon.icns
  category: public.app-category.business
  minimumSystemVersion: "13.0"
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  artifactName: "${productName}-${version}-${os}-${arch}.${ext}"
  target:
    - dmg
    - zip
dmg:
  title: "${productName} ${version}"
  iconSize: 96
  window:
    width: 540
    height: 380
```

S093 electron.vite.config.ts:7-11 — Main/Preload/Renderer 빌드
```ts
export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { output: { format: 'cjs' } } } },
  renderer: { plugins: [react()] }
})
```

S094 .github/workflows/macos-build.yml:18-29 — macOS arm64/x64 CI 설정
```ts
  build-and-test:
    name: macOS ${{ matrix.arch }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - arch: arm64
            binary_arch: arm64
            runner: macos-15
          - arch: x64
            binary_arch: x86_64
            runner: macos-15-intel
```

S095 .github/workflows/macos-build.yml:88-133 — 정적/단위/E2E/패키징 검증 설정
```ts
      - name: Static checks and tests
        run: |
          pnpm typecheck
          pnpm lint
          pnpm test

      - name: Build application
        run: pnpm build

      - name: Source Electron E2E
        run: |
          pnpm test:e2e
          pnpm test:e2e:roles
          pnpm test:e2e:signup
          pnpm test:e2e:operations
          pnpm test:e2e:visual
          pnpm test:e2e:external-ai

      - name: Package DMG and ZIP
        run: pnpm exec electron-builder --mac dmg zip --${{ matrix.arch }} --publish never

      - name: Verify packaged application
        shell: bash
        run: |
          APP_BUNDLE="$(find release -type d -path '*/OMNIS.app' -print -quit)"
          APP_EXECUTABLE="$APP_BUNDLE/Contents/MacOS/OMNIS"
          test -x "$APP_EXECUTABLE"
          lipo -archs "$APP_EXECUTABLE" | grep -qw "${{ matrix.binary_arch }}"
          OMNIS_E2E_EXE="$APP_EXECUTABLE" OMNIS_E2E_PROFILE="tests/.tmp/packaged-${{ matrix.arch }}" pnpm test:e2e
          OMNIS_E2E_EXE="$APP_EXECUTABLE" pnpm test:e2e:external-ai
          if [[ -n "${CSC_LINK:-}" ]]; then
            codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"
          else
            ech
```

S096 tests/e2e/electron-launch.mjs:12-12 — 격리 E2E profile
```ts
    env: { ...process.env, OMNIS_E2E_DATA: resolve(dataDir) }
```

S097 tests/unit/external-ai.test.ts:1-1 — mock AI 시험 소스, 이번 실행 아님
```ts
import { describe,expect,it,vi } from 'vitest'
```

S098 tests/integration/usability.test.ts:1-1 — 실용기능 통합 시험 소스, 이번 실행 아님
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
```

S099 src/main/database/migrate.ts:84-84 — 실제 DDL: ai_interactions
```ts
    CREATE TABLE IF NOT EXISTS ai_interactions (id TEXT PRIMARY KEY, provider TEXT NOT NULL, feature TEXT NOT NULL, input_summary TEXT NOT NULL, output_summary TEXT NOT NULL, confidence REAL, fallback_used INTEGER NOT NULL, created_at TEXT NOT NULL);
```

S100 src/main/database/migrate.ts:192-192 — 실제 DDL: ai_runs
```ts
    CREATE TABLE IF NOT EXISTS ai_runs (
```

S101 src/main/database/migrate.ts:86-86 — 실제 DDL: app_settings
```ts
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
```

S102 src/main/database/migrate.ts:53-53 — 실제 DDL: attachments
```ts
    CREATE TABLE IF NOT EXISTS attachments (
```

S103 src/main/database/migrate.ts:85-85 — 실제 DDL: audit_logs
```ts
    CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, before_json TEXT, after_json TEXT, created_at TEXT NOT NULL);
```

S104 src/main/database/migrate.ts:76-76 — 실제 DDL: communication_status_history
```ts
    CREATE TABLE IF NOT EXISTS communication_status_history (id TEXT PRIMARY KEY, system_id TEXT NOT NULL REFERENCES communication_systems(id), status TEXT NOT NULL, uptime_pct REAL NOT NULL, recorded_at TEXT NOT NULL);
```

S105 src/main/database/migrate.ts:75-75 — 실제 DDL: communication_systems
```ts
    CREATE TABLE IF NOT EXISTS communication_systems (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL, uptime_pct REAL NOT NULL, today_incident_count INTEGER NOT NULL DEFAULT 0, remarks TEXT, display_order INTEGER NOT NULL, updated_at TEXT NOT NULL);
```

S106 src/main/database/migrate.ts:176-176 — 실제 DDL: daily_closures
```ts
    CREATE TABLE IF NOT EXISTS daily_closures (
```

S107 src/main/database/migrate.ts:200-200 — 실제 DDL: demo_scenarios
```ts
    CREATE TABLE IF NOT EXISTS demo_scenarios (
```

S108 src/main/database/migrate.ts:187-187 — 실제 DDL: directive_acknowledgements
```ts
    CREATE TABLE IF NOT EXISTS directive_acknowledgements (
```

S109 src/main/database/migrate.ts:82-82 — 실제 DDL: directives
```ts
    CREATE TABLE IF NOT EXISTS directives (id TEXT PRIMARY KEY, level TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, issuer TEXT NOT NULL, issued_at TEXT NOT NULL, expires_at TEXT, pinned INTEGER NOT NULL DEFAULT 0);
```

S110 src/main/database/migrate.ts:81-81 — 실제 DDL: duty_roster
```ts
    CREATE TABLE IF NOT EXISTS duty_roster (id TEXT PRIMARY KEY, duty_date TEXT NOT NULL, shift_type TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), position TEXT NOT NULL, start_time TEXT, end_time TEXT);
```

S111 src/main/database/migrate.ts:181-181 — 실제 DDL: handover_notes
```ts
    CREATE TABLE IF NOT EXISTS handover_notes (
```

S112 src/main/database/migrate.ts:78-78 — 실제 DDL: incident_events
```ts
    CREATE TABLE IF NOT EXISTS incident_events (id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), event_type TEXT NOT NULL, from_status TEXT, to_status TEXT, note TEXT, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
```

S113 src/main/database/usabilityMigration.ts:10-10 — 실제 DDL: incident_intakes
```ts
    CREATE TABLE incident_intakes(incident_id TEXT PRIMARY KEY REFERENCES incidents(id) ON DELETE CASCADE,template_id TEXT REFERENCES work_templates(id),template_version INTEGER,questions_json TEXT NOT NULL,answers_json TEXT NOT NULL,updated_at TEXT NOT NULL);
```

S114 src/main/database/migrate.ts:77-77 — 실제 DDL: incidents
```ts
    CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, ticket_no TEXT UNIQUE NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, system_id TEXT REFERENCES communication_systems(id), severity TEXT NOT NULL, status TEXT NOT NULL, description TEXT NOT NULL, reported_by TEXT NOT NULL REFERENCES users(id), assigned_to TEXT REFERENCES users(id), department TEXT, reported_at TEXT NOT NULL, assigned_at TEXT, started_at TEXT, resolved_at TEXT, closed_at TEXT, cause TEXT, action_summary TEXT, ai_category TEXT, ai_priority TEXT, ai_confidence REAL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
```

S115 src/main/database/migrate.ts:163-163 — 실제 DDL: maintenance_daily_plans
```ts
    CREATE TABLE IF NOT EXISTS maintenance_daily_plans (
```

S116 src/main/database/migrate.ts:80-80 — 실제 DDL: maintenance_events
```ts
    CREATE TABLE IF NOT EXISTS maintenance_events (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES maintenance_tasks(id), event_type TEXT NOT NULL, note TEXT, actor_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
```

S117 src/main/database/migrate.ts:79-79 — 실제 DDL: maintenance_tasks
```ts
    CREATE TABLE IF NOT EXISTS maintenance_tasks (id TEXT PRIMARY KEY, task_no TEXT UNIQUE NOT NULL, title TEXT NOT NULL, maintenance_type TEXT NOT NULL, priority TEXT NOT NULL, system_id TEXT REFERENCES communication_systems(id), status TEXT NOT NULL, department TEXT NOT NULL, assignee_id TEXT REFERENCES users(id), scheduled_date TEXT NOT NULL, due_date TEXT, started_at TEXT, completed_at TEXT, progress INTEGER NOT NULL DEFAULT 0, description TEXT, result TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
```

S118 src/main/database/migrate.ts:143-143 — 실제 DDL: maintenance_teams
```ts
    CREATE TABLE IF NOT EXISTS maintenance_teams (
```

S119 src/main/database/migrate.ts:83-83 — 실제 DDL: notifications
```ts
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL);
```

S120 src/main/database/organizationContacts.ts:4-4 — 실제 DDL: organization_members
```ts
  db.exec(`CREATE TABLE IF NOT EXISTS organization_members (
```

S121 src/main/database/organizationMigration.ts:5-5 — 실제 DDL: organization_units
```ts
  db.exec(`CREATE TABLE IF NOT EXISTS organization_units (
```

S122 src/main/database/migrate.ts:170-170 — 실제 DDL: reconciliation_results
```ts
    CREATE TABLE IF NOT EXISTS reconciliation_results (
```

S123 src/main/database/usabilityMigration.ts:13-13 — 실제 DDL: recurring_occurrences
```ts
    CREATE TABLE recurring_occurrences(rule_id TEXT NOT NULL REFERENCES recurring_rules(id),occurrence_date TEXT NOT NULL,task_id TEXT REFERENCES maintenance_tasks(id) ON DELETE SET NULL,rule_version INTEGER NOT NULL,batch_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(rule_id,occurrence_date));
```

S124 src/main/database/usabilityMigration.ts:12-12 — 실제 DDL: recurring_rules
```ts
    CREATE TABLE recurring_rules(id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,deleted INTEGER NOT NULL DEFAULT 0,definition_json TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL);
```

S125 src/main/database/migrate.ts:99-99 — 실제 DDL: signup_requests
```ts
    CREATE TABLE IF NOT EXISTS signup_requests (id TEXT PRIMARY KEY, service_no TEXT NOT NULL, username TEXT NOT NULL, display_name TEXT NOT NULL, rank_name TEXT NOT NULL, unit_name TEXT NOT NULL, phone TEXT, reason TEXT, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, status TEXT NOT NULL, approved_role TEXT, user_id TEXT REFERENCES users(id), reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT, reject_reason TEXT, created_at TEXT NOT NULL);
```

S126 src/main/database/migrate.ts:154-154 — 실제 DDL: situation_alerts
```ts
    CREATE TABLE IF NOT EXISTS situation_alerts (
```

S127 src/main/database/usabilityMigration.ts:11-11 — 실제 DDL: task_checklists
```ts
    CREATE TABLE task_checklists(task_id TEXT PRIMARY KEY REFERENCES maintenance_tasks(id) ON DELETE CASCADE,template_id TEXT NOT NULL REFERENCES work_templates(id),template_version INTEGER NOT NULL,title TEXT NOT NULL,items_json TEXT NOT NULL,results_json TEXT NOT NULL DEFAULT '[]',revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
```

S128 src/main/database/migrate.ts:149-149 — 실제 DDL: team_members
```ts
    CREATE TABLE IF NOT EXISTS team_members (
```

S129 src/main/database/organizationMigration.ts:9-9 — 실제 DDL: team_organizations
```ts
  CREATE TABLE IF NOT EXISTS team_organizations (
```

S130 src/main/database/migrate.ts:74-74 — 실제 DDL: users
```ts
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, rank_name TEXT, unit_name TEXT, role TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
```

S131 src/main/database/usabilityMigration.ts:9-9 — 실제 DDL: work_templates
```ts
    CREATE TABLE work_templates(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('INCIDENT','CHECKLIST')),version INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,definition_json TEXT NOT NULL,updated_at TEXT NOT NULL);
```