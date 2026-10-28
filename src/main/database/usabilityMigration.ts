import type Database from 'better-sqlite3'
import {
  supplementQuestions,
  type TemplateDefinition
} from '../../shared/usability'

export function migrateUsability(db: Database.Database): void {
  db.exec(`
    CREATE TABLE work_templates(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('INCIDENT','CHECKLIST')),version INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,definition_json TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE incident_intakes(incident_id TEXT PRIMARY KEY REFERENCES incidents(id) ON DELETE CASCADE,template_id TEXT REFERENCES work_templates(id),template_version INTEGER,questions_json TEXT NOT NULL,answers_json TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE task_checklists(task_id TEXT PRIMARY KEY REFERENCES maintenance_tasks(id) ON DELETE CASCADE,template_id TEXT NOT NULL REFERENCES work_templates(id),template_version INTEGER NOT NULL,title TEXT NOT NULL,items_json TEXT NOT NULL,results_json TEXT NOT NULL DEFAULT '[]',revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
    CREATE TABLE recurring_rules(id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,deleted INTEGER NOT NULL DEFAULT 0,definition_json TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL);
    CREATE TABLE recurring_occurrences(rule_id TEXT NOT NULL REFERENCES recurring_rules(id),occurrence_date TEXT NOT NULL,task_id TEXT REFERENCES maintenance_tasks(id) ON DELETE SET NULL,rule_version INTEGER NOT NULL,batch_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(rule_id,occurrence_date));
    CREATE INDEX idx_recurring_owner ON recurring_rules(created_by,deleted);
    CREATE INDEX idx_tasks_assignee_date ON maintenance_tasks(assignee_id,scheduled_date,status);
    CREATE INDEX idx_incidents_assigned_status ON incidents(assigned_to,status);
  `)
  const insert = db.prepare(
    'INSERT INTO work_templates(id,kind,definition_json,updated_at) VALUES (?,?,?,?)'
  )
  const definitions: [string, string, string][] = [
    ['network', '인터넷·네트워크 접속 불가', '네트워크'],
    ['phone', '통화 불가·통화 잡음', '기반통신'],
    ['power', '장비 전원 불량', '장비'],
    ['radio', '무선통신 끊김', '무선통신'],
    ['video', '영상·CCTV 화면 미표시', '영상'],
    ['software', '업무 프로그램 접속 오류', '사이버보호']
  ]
  for (const [id, title, category] of definitions) {
    const def: TemplateDefinition = {
      title,
      category,
      symptomHint: `예시: ${title} 증상의 발생 시각·범위·오류를 직접 확인하여 입력하십시오.`,
      impactHint: '영향받은 업무와 범위를 확인하여 입력하십시오.',
      questions: supplementQuestions,
      items: []
    }
    insert.run(
      `intake-${id}`,
      'INCIDENT',
      JSON.stringify(def),
      new Date().toISOString()
    )
  }
  for (const [id, title, labels] of [
    [
      'general',
      '정기점검',
      [
        '외관 확인',
        '전원 확인',
        '연결 확인',
        '기본 동작 시험',
        '점검 결과 기록'
      ]
    ],
    [
      'network',
      '네트워크 점검',
      [
        '전원 확인',
        '케이블 확인',
        '연결 상태 확인',
        '통신 시험',
        '점검 결과 기록'
      ]
    ],
    [
      'radio',
      '통신장비 점검',
      [
        '전원 확인',
        '연결부 확인',
        '송수신 상태 확인',
        '잡음 확인',
        '점검 결과 기록'
      ]
    ],
    [
      'security',
      '보안/프로그램 점검',
      [
        '서비스 상태 확인',
        '로그 확인',
        '설정 확인',
        '동작 확인',
        '점검 결과 기록'
      ]
    ]
  ] as [string, string, string[]][]) {
    insert.run(
      `check-${id}`,
      'CHECKLIST',
      JSON.stringify({
        title,
        category: title,
        symptomHint: '',
        impactHint: '',
        questions: [],
        items: labels.map((label, i) => ({
          id: `item-${i + 1}`,
          label,
          required: i !== 0,
          allowNa: i === 0
        }))
      }),
      new Date().toISOString()
    )
  }
}
