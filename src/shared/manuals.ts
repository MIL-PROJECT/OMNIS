import type { Role } from './contracts'

export const manualCatalog: {
  role: Role
  title: string
  description: string
}[] = [
  {
    role: 'ADMIN',
    title: '관리자',
    description: '사용자 승인, 시스템 설정, 백업과 운영 관리'
  },
  {
    role: 'OPERATOR',
    title: '운용요원',
    description: '운용 현황 확인, 고장 통제와 업무 배정'
  },
  {
    role: 'MAINTAINER',
    title: '정비요원',
    description: '배정된 고장 조치, 정비 수행과 결과 기록'
  },
  {
    role: 'USER',
    title: '일반 사용자',
    description: '고장 접수, 처리 현황 조회와 업무 확인'
  },
  {
    role: 'VIEWER',
    title: '조회전용',
    description: '상황판, 운용 현황과 보고서 조회'
  }
]
export const manualRevision = '2026-10-28 09:51 KST'
export type ManualInfo = (typeof manualCatalog)[number] & {
  filename: string
  bytes: number
  available: boolean
}
