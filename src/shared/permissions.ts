import type { Role } from './contracts'
export interface PermissionRule {
  channel: string
  label: string
  roles: Role[]
  note: string
}
export const permissionRules: PermissionRule[] = [
  {
    channel: 'operations:create',
    label: '운영 체계 등록',
    roles: ['ADMIN', 'OPERATOR'],
    note: '체계 코드·필수 정보 검증 후 등록'
  },
  {
    channel: 'operations:update',
    label: '운영 체계 수정',
    roles: ['ADMIN', 'OPERATOR', 'USER'],
    note: '기존 체계 참조와 입력 검증 적용'
  },
  {
    channel: 'operations:delete',
    label: '운영 체계 삭제',
    roles: ['ADMIN'],
    note: '고장·정비 연결 기록이 있으면 삭제 차단'
  },
  {
    channel: 'incidents:create',
    label: '고장 접수',
    roles: ['ADMIN', 'OPERATOR', 'USER'],
    note: '일반 사용자는 본인 접수 건 중심으로 접근'
  },
  {
    channel: 'incidents:update',
    label: '고장 내용 수정',
    roles: ['ADMIN', 'OPERATOR', 'USER'],
    note: '일반 사용자는 본인 접수·접수 상태 제한'
  },
  {
    channel: 'incidents:assignTeam',
    label: '조치부서·담당자 배정',
    roles: ['ADMIN', 'OPERATOR'],
    note: '분류 후 조치부서·담당자 동시 확정, 배정 상태 전환 및 소속 검사'
  },
  {
    channel: 'incidents:applyAi',
    label: 'AI 분류 검토 후 반영',
    roles: ['ADMIN', 'OPERATOR'],
    note: 'AI 결과만으로 업무 데이터 자동 변경 없음'
  },
  {
    channel: 'maintenance:create',
    label: '정비 등록',
    roles: ['ADMIN', 'MAINTAINER'],
    note: '정비요원은 본인 작업 등 서비스의 소유권 제한 적용'
  },
  {
    channel: 'maintenance:createFromIncident',
    label: '고장 접수에서 정비 등록',
    roles: ['ADMIN', 'MAINTAINER'],
    note: '정비요원은 본인 배정 고장만 등록, 진행 중 정비는 기존 작업 안내'
  },
  {
    channel: 'maintenance:incidentCandidates',
    label: '정비 등록할 배정 고장 조회',
    roles: ['ADMIN', 'MAINTAINER'],
    note: '정비요원은 본인 배정 고장으로 제한'
  },
  {
    channel: 'maintenance:update',
    label: '정비 수정',
    roles: ['ADMIN', 'MAINTAINER'],
    note: '정비요원은 배정받은 작업만 수정'
  },
  {
    channel: 'maintenance:updateStatus',
    label: '정비 상태 변경',
    roles: ['ADMIN', 'MAINTAINER'],
    note: '배정·필수 점검·완료 결과 검사 적용'
  },
  {
    channel: 'duty:create',
    label: '근무 등록',
    roles: ['ADMIN', 'OPERATOR', 'USER'],
    note: '근무 수정·삭제도 동일 역할'
  },
  {
    channel: 'directives:create',
    label: '지시사항 등록',
    roles: ['ADMIN', 'OPERATOR'],
    note: '지시 수정·삭제도 동일 역할, 확인은 접근 가능한 사용자'
  },
  {
    channel: 'control:upsertDailyPlan',
    label: '일일 작업계획 입력',
    roles: ['ADMIN', 'MAINTAINER'],
    note: '정비요원은 소속 정비반 계획만 입력'
  },
  {
    channel: 'control:closeDay',
    label: '일일 마감',
    roles: ['ADMIN'],
    note: '정합성 검사·예외 승인·중복 마감 제한'
  },
  {
    channel: 'admin:summary',
    label: '사용자·접속 정책·감사 관리',
    roles: ['ADMIN'],
    note: '모든 신규 관리자 API는 Main에서 관리자 권한 검사'
  },
  {
    channel: 'system:backup',
    label: '백업·시스템 설정',
    roles: ['ADMIN'],
    note: '기존 AI·SLA·초기화·조직 설정도 관리자 전용'
  }
]
