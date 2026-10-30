import type Database from 'better-sqlite3'
import { randomUUID, randomBytes, scryptSync } from 'node:crypto'
import { koreaDate } from '../../shared/date'

const day = (offset = 0): string => new Date(Date.now() + offset * 86400000).toISOString()
const localDay = (offset = 0): string => koreaDate(new Date(Date.now() + offset * 86400000))
export const demoCredentials = { username: 'demo_admin', password: 'Demo!2026' }
export const demoUserCredentials = { username: 'demo_user', password: 'Demo!2026' }

function ensureOperationalDemoData(db: Database.Database): void {
  const now = day()
  const users = db.prepare("SELECT id FROM users WHERE role IN ('ADMIN','OPERATOR','MAINTAINER') ORDER BY CASE role WHEN 'ADMIN' THEN 0 WHEN 'OPERATOR' THEN 1 ELSE 2 END, username").all() as { id: string }[]
  const systems = db.prepare('SELECT id FROM communication_systems ORDER BY display_order LIMIT 4').all() as { id: string }[]
  if (!users.length) return
  if (!(db.prepare('SELECT count(*) n FROM maintenance_teams').get() as { n: number }).n) {
    const insertTeam = db.prepare('INSERT INTO maintenance_teams (id,code,name,specialties,system_categories,available,average_resolution_minutes,display_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    const insertMember = db.prepare('INSERT OR IGNORE INTO team_members (id,team_id,user_id,role_name,available) VALUES (?,?,?,?,1)')
    const definitions = [
      ['TEAM-WIRE','유선정비반','회선,교환기,전송','기반통신,전송장비',95],
      ['TEAM-RADIO','무선정비반','무선,위성,안테나','무선/위성,작전통신',110],
      ['TEAM-CYBER','사이버정비반','서버,네트워크,보안','사이버보호,지원체계',140]
    ] as const
    definitions.forEach(([code,name,specialties,categories,average], index) => {
      const id = randomUUID(); insertTeam.run(id,code,name,specialties,categories,1,average,index,now,now)
      const member = users[(index + 3) % users.length] ?? users[0]
      insertMember.run(randomUUID(),id,member.id,index === 0 ? '반장' : '정비요원')
    })
  }
  if (!(db.prepare('SELECT count(*) n FROM situation_alerts').get() as { n: number }).n && systems.length) {
    db.prepare('INSERT INTO situation_alerts (id,alert_no,alert_type,severity,title,description,system_id,impact_scope,action_guidance,department,status,occurred_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(randomUUID(),'ALT-DEMO-0001','GPS_INTERFERENCE','WARNING','가상 GPS 전파환경 주의','가상 시연을 위한 경보입니다.',systems[0].id,'기지 일부','대체 항법수단과 영향 체계를 확인하십시오.','가상 운용반','OPEN',day(-1),users[0].id,now,now)
  }
  if (!(db.prepare('SELECT count(*) n FROM maintenance_daily_plans').get() as { n: number }).n) {
    const teams = db.prepare('SELECT id FROM maintenance_teams ORDER BY display_order').all() as { id: string }[]
    const insert = db.prepare('INSERT INTO maintenance_daily_plans (id,plan_date,team_id,planned_count,unplanned_count,completed_count,incomplete_reason,carry_over_count,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    teams.forEach((team,index) => insert.run(randomUUID(),localDay(),team.id,4 + index,1,index + 2,index === 0 ? '부품 수급 대기 1건' : null,index === 0 ? 1 : 0,users[0].id,now,now))
  }
}

// 일반 사용자(USER) 데모 계정: 이미 만들어진 DB에도 없으면 추가
function ensureDemoUser(db: Database.Database): void {
  if (db.prepare('SELECT id FROM users WHERE username=?').get(demoUserCredentials.username)) return
  const salt = randomBytes(16).toString('hex')
  db.prepare('INSERT INTO users (id,username,display_name,rank_name,unit_name,role,password_hash,password_salt,active,created_at,updated_at,service_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(), demoUserCredentials.username, '문사용', '중사', '가상 정보통신대', 'USER', scryptSync(demoUserCredentials.password, salt, 64).toString('hex'), salt, 1, day(), day(), '18-70000010')
}

export function seed(db: Database.Database): void {
  if ((db.prepare('SELECT count(*) n FROM users').get() as { n: number }).n) { ensureDemoUser(db); ensureOperationalDemoData(db); return }
  db.transaction(() => {
    const insertUser = db.prepare('INSERT INTO users (id,username,display_name,rank_name,unit_name,role,password_hash,password_salt,active,created_at,updated_at,service_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    const names = ['김정보', '이통신', '박운용', '최정비', '정지원', '한관제', '서네트', '오보안', '유장비', '강당직']
    const ids: string[] = []
    names.forEach((name, i) => {
      const id = randomUUID(), salt = randomBytes(16).toString('hex')
      ids.push(id)
      insertUser.run(id, i === 0 ? demoCredentials.username : `demo_${i}`, name, i < 5 ? '대위' : '중위', '가상 정보통신대', i === 0 ? 'ADMIN' : i < 4 ? 'OPERATOR' : i < 8 ? 'MAINTAINER' : 'VIEWER', scryptSync(i === 0 ? demoCredentials.password : 'Demo!2026', salt, 64).toString('hex'), salt, 1, day(), day(), `15-${70000000 + i}`)
    })
    const categories = ['기반통신', '작전통신', '사이버보호', '전송장비', '무선/위성', 'CCTV', '지원체계']
    const systems: string[] = []
    const sys = db.prepare('INSERT INTO communication_systems VALUES (?,?,?,?,?,?,?,?,?,?)')
    const hist = db.prepare('INSERT INTO communication_status_history VALUES (?,?,?,?,?)')
    for (let i = 0; i < 38; i++) {
      const id = randomUUID(), status = i % 19 === 0 ? 'WATCH' : i % 23 === 0 ? 'INSPECTION' : 'NORMAL', uptime = Math.round((96 + (i % 40) / 10) * 10) / 10
      systems.push(id)
      sys.run(id, `SYS-${String(i + 1).padStart(3, '0')}`, `${categories[i % categories.length]} ${String(Math.floor(i / categories.length) + 1).padStart(2, '0')}`, categories[i % categories.length], status, uptime, 0, null, i, day())
      for (let j = 29; j >= 0; j--) hist.run(randomUUID(), id, status, uptime - (j % 4) / 10, day(-j))
    }
    const incident = db.prepare(`INSERT INTO incidents (id,ticket_no,title,category,system_id,severity,status,description,reported_by,assigned_to,department,reported_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    const event = db.prepare('INSERT INTO incident_events (id,incident_id,event_type,from_status,to_status,note,actor_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
    const statuses = ['RECEIVED', 'TRIAGED', 'ASSIGNED', 'PLANNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
    for (let i = 0; i < 52; i++) {
      const id = randomUUID(), status = statuses[i % statuses.length], when = day(-(i % 30))
      incident.run(id, `INC-DEMO-${String(i + 1).padStart(4, '0')}`, `${categories[i % categories.length]} 성능 점검 요청 ${i + 1}`, categories[i % categories.length], systems[i % systems.length], i % 11 === 0 ? 'URGENT' : 'NORMAL', status, '가상 시험 환경에서 생성한 점검 요청입니다.', ids[i % ids.length], ids[(i + 1) % ids.length], '가상 정보통신대', when, when, when)
      event.run(randomUUID(), id, 'CREATED', null, 'RECEIVED', '가상 접수', ids[i % ids.length], when)
    }
    const mnt = db.prepare(`INSERT INTO maintenance_tasks (id,task_no,title,maintenance_type,priority,system_id,status,department,assignee_id,scheduled_date,progress,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    for (let i = 0; i < 42; i++) mnt.run(randomUUID(), `MNT-DEMO-${String(i + 1).padStart(4, '0')}`, `${categories[i % categories.length]} 정기 점검 ${i + 1}`, '정기점검', i % 9 === 0 ? 'HIGH' : 'NORMAL', systems[i % systems.length], i % 4 === 0 ? 'COMPLETED' : i % 3 === 0 ? 'IN_PROGRESS' : 'PLANNED', '가상 정비반', ids[(i + 3) % ids.length], localDay((i % 30) - 12), i % 4 === 0 ? 100 : i % 3 === 0 ? 50 : 0, '가상 시연 작업', day(-i), day(-i))
    const duty = db.prepare('INSERT INTO duty_roster (id,duty_date,shift_type,user_id,position,start_time,end_time) VALUES (?,?,?,?,?,?,?)')
    for (let i = 0; i < 28; i++) duty.run(randomUUID(), localDay(i % 14), ['DAY', 'NIGHT', 'DUTY'][i % 3], ids[i % ids.length], '운용 담당', null, null)
    const directive = db.prepare('INSERT INTO directives (id,level,title,content,issuer,issued_at,expires_at,pinned) VALUES (?,?,?,?,?,?,?,?)')
    for (let i = 0; i < 8; i++) directive.run(randomUUID(), i === 0 ? 'URGENT' : i % 3 === 0 ? 'NOTICE' : 'GENERAL', `가상 운용 공지 ${i + 1}`, '정기 점검 결과를 확인하고 필요한 내용을 기록하십시오.', names[0], day(-i), null, i === 0 ? 1 : 0)
    db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(), ids[0], 'SEED', 'database', 'demo', null, JSON.stringify({ mock: true }), day())
    ensureDemoUser(db)
    // 사용자 등록 신청 예시 (관리자 승인 대기)
    const request = db.prepare('INSERT INTO signup_requests (id,service_no,username,display_name,rank_name,unit_name,phone,reason,password_hash,password_salt,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    for (const [serviceNo, username, name, rank, unit, reason, offset] of [['21-70001234', 'req_yoon', '윤신청', '하사', '가상 통신중대', '통신 운용 업무 담당 배치', -1], ['19-70005678', 'req_jang', '장대기', '중위', '가상 정보보호반', '정비관리 업무 인수인계', 0]] as const) {
      const salt = randomBytes(16).toString('hex')
      request.run(randomUUID(), serviceNo, username, name, rank, unit, '010-0000-0000', reason, scryptSync('Demo!2026', salt, 64).toString('hex'), salt, 'PENDING', day(offset))
    }
  })()
  ensureOperationalDemoData(db)
}

