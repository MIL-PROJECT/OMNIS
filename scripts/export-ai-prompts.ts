import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  promptCatalog,
  consoleMasterPrompt
} from '../src/main/ai/PromptCatalog'

const root = resolve('docs/ai-prompts/v4')
mkdirSync(root, { recursive: true })
const cases = {
  triage: {
    task: 'TRIAGE',
    input: {
      title: '가상 통신 회선 간헐 불통',
      description: '가상 시험 중 일부 단말의 회선 연결이 반복 중단됩니다.',
      serviceImpact: '가상 업무 단말에서 통신 서비스를 이용할 수 없습니다.'
    },
    example: {
      category: '전송장비',
      priority: 'URGENT',
      confidence: 0.76,
      recommendation:
        '영향 범위와 지속 여부를 확인하고 담당 정비반에 보고한 뒤 승인된 진단 절차를 수행하십시오.',
      rationale:
        '서비스 이용 중단이 명시되어 긴급 확인을 추천합니다. 원인은 아직 확인되지 않았습니다.',
      recommendedTeamCode: 'TEAM-WIRE',
      estimatedMinutes: 60,
      questions: ['발생 시각과 영향을 받는 단말 범위는 어떻게 됩니까?']
    }
  },
  dailySummary: {
    task: 'DAILY_SUMMARY',
    input: {
      openIncidents: 12,
      urgentIncidents: 2,
      activeMaintenance: 4,
      delayedMaintenance: 1,
      slaRiskCount: 2,
      majorAlerts: ['가상 통신 일부 연결 지연']
    },
    example: {
      summary:
        '미종결 고장 12건, 긴급 고장 2건, 진행 중 정비 4건, 지연 정비 1건, SLA 위험 2건입니다. 가상 통신 연결 지연 경보가 있으므로 긴급 고장과 SLA 위험 건의 진행 상태를 우선 확인하십시오.'
    }
  },
  similarIncidents: {
    task: 'SIMILAR_INCIDENTS',
    input: {
      title: '가상 무선 음성 끊김',
      candidates: [
        {
          id: 'INC-DEMO-A',
          title: '가상 무선 음성 간헐 끊김',
          status: 'CLOSED'
        },
        {
          id: 'INC-DEMO-B',
          title: '가상 저장장치 용량 점검',
          status: 'RECEIVED'
        }
      ]
    },
    example: { ids: ['INC-DEMO-A'] }
  },
  maintenancePriority: {
    task: 'MAINTENANCE_PRIORITY',
    input: [
      {
        id: 'MT-DEMO-A',
        title: '가상 전송장비 점검',
        priority: 'HIGH',
        status: 'PLANNED',
        scheduledDate: '2030-01-01'
      },
      {
        id: 'MT-DEMO-B',
        title: '가상 정기 단말 점검',
        priority: 'NORMAL',
        status: 'PLANNED',
        scheduledDate: '2030-01-02'
      }
    ],
    example: { ids: ['MT-DEMO-A', 'MT-DEMO-B'] }
  }
}
const json = (file: string, value: unknown) =>
  writeFileSync(join(root, file), JSON.stringify(value, null, 2) + '\n')
writeFileSync(
  join(root, 'OMNIS_CONSOLE_MASTER_PROMPT.txt'),
  consoleMasterPrompt + '\n'
)
for (const [name, prompt] of Object.entries(promptCatalog)) {
  const fixture = cases[name as keyof typeof cases]
  writeFileSync(join(root, `${name}.system.txt`), prompt.system + '\n')
  json(`${name}.schema.json`, prompt.jsonSchema)
  json(`${name}.response-format.json`, {
    type: 'json_schema',
    name: prompt.schemaName,
    strict: true,
    schema: prompt.jsonSchema
  })
  json(`${name}.input.json`, fixture.input)
  json(`${name}.console-message.json`, {
    task: fixture.task,
    data: fixture.input
  })
  json(`${name}.expected-output.json`, fixture.example)
}
json('manifest.json', {
  source: 'src/main/ai/PromptCatalog.ts',
  kind: 'code-managed prompts and synthetic format fixtures, not live model results',
  prompts: Object.fromEntries(
    Object.entries(promptCatalog).map(([key, p]) => [
      key,
      {
        version: p.version,
        schemaName: p.schemaName,
        maxOutputTokens: p.maxOutputTokens
      }
    ])
  )
})
console.log(`Exported four prompt/schema/fixture sets: ${root}`)
