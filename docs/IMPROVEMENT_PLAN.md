# OMNIS 고도화 계획과 구현 결정

## 결론

기존 인디고 UI와 보안 아키텍처를 유지하고, PDF의 운영절차를 `고장 workflow`, `정비반 협업`, `08:30/16:00 작업판`, `정합성 검사`, `일일 마감`의 다섯 업무 단위로 구현했다. SQLite schema v4는 기존 행을 유지하는 순방향 migration이며 외부 HTTP 서버를 추가하지 않는다.

## 전제

- 모든 seed와 Demo Mode 데이터는 가상 자료다.
- 시간 저장은 ISO 8601 UTC, 화면 표시는 Windows의 Asia/Seoul 로컬 시간대를 사용한다.
- AI는 의사결정 지원이며 자동 확정하지 않는다.
- Ollama가 없거나 실패해도 Local Rule로 모든 핵심 시연이 가능하다.

## 완료한 단계

1. **데이터**: schema v4, 정비반·상황경보·일일계획·대조결과·마감 snapshot·인수인계·AI 실행·시연 시나리오·첨부자료 메타데이터.
2. **계약**: 신규 요청을 Zod로 검증하고 날짜, enum, 완료 결과 필수조건을 검사.
3. **업무 서비스**: 상태전이, 배정, SLA, 계획/실적, 대조, 마감, 인수인계, Demo lifecycle.
4. **화면**: 기존 카드·DataGrid·Dialog·상태 배지 규칙으로 고장/정비/통제/지시/설정 화면 확장.
5. **AI**: 구조화 추천, 사용자 승인 반영, Local Rule fallback, `ai_runs` 추적.
6. **보안**: Main Process 역할 검사, USER 본인 접수 제한, MAINTAINER 배정 작업 제한.
7. **검증**: typecheck, lint, unit/integration, source Electron E2E, 역할 E2E, signup E2E, Windows build/package.

## 후속 우선순위

| 우선순위 | 항목 | 완료 조건 |
|---|---|---|
| 완료 | 접수·조치 첨부자료 | 허용 확장자·25MB·SHA-256·감사기록·삭제 정책·백업 포함 |
| P1 | 외부 체계 adapter | 파일 import/export DTO, dry run, 오류 행 보고, idempotency |
| P1 | 1,000건 성능 기준 | p95 목록 조회·필터·마감 검사 시간 기록 |
| P2 | 정비반 master CRUD | 가용성, 전문분야, 구성원 변경 감사 UI |
| P2 | 월간 분석·보고서 초안 확대 | 편집·확정·PDF 출력과 AI 실행 이력 연결 |
| P2 | 깨끗한 Windows VM 설치 검증 | 설치·업그레이드·삭제 후 사용자 DB 보존 확인 |

## rollback

- 배포 전 DB 백업을 생성한다.
- migration은 transaction에서 실행되며 실패 시 `user_version`이 올라가지 않는다.
- Demo Mode 초기화는 `demo_scenarios.entity_ids_json`에 기록된 OMNIS 생성 행만 삭제한다.
- 전체 Demo 초기화는 시스템관리의 2단계 확인과 사전 백업을 거친다.
