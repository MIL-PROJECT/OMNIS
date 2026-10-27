# 운영개념

## 역할

- **ADMIN**: 운영 기준 설정, 예외 마감, 백업·감사, 시연 lifecycle.
- **OPERATOR**: BNOC 통제 역할. 접수 분류, 정비반 배정, 경보와 지시사항 관리.
- **MAINTAINER**: 소속 정비반 계획과 배정 작업의 원격·현장 조치, 결과 입력.
- **USER**: 고장 접수, 본인 접수 확인·수정, 검증된 결과의 사용자 확인·종결.
- **VIEWER**: 조회만 허용하며 mutation은 Main Process에서 거부.

## 일일 운용

1. 기준시각 전 정비반은 계획 건수와 이월 건수를 입력한다. 기본값은 08:30이며 관리자가 변경할 수 있다.
2. 통제 담당자는 상황경보와 신규 고장을 분류하고 가용 정비반과 담당자를 지정한다.
3. 정비반은 원격조치를 시작하고 실패 시 이력과 함께 현장출동으로 전환한다.
4. 완료 시 원인, 상세 조치, 결과, 부품, 방식, 재발 위험, 후속 점검일을 기록한다.
5. 기본 16:00에 계획·비계획·완료·미완료·이월을 갱신한다.
6. 정합성 검사가 결과 누락, 고장/정비 상태 불일치, 미완료 사유 누락을 찾는다.
7. ADMIN이 이상 없음 또는 명시적 예외 승인을 확인하고 snapshot을 마감한다.
8. 교대자는 미종결 고장, 진행 정비, 미완료 지시를 모은 초안을 수정하고 확정한다.

## 외부 체계 연동 경계

향후 DELIIS 같은 외부 체계는 Main Process adapter로만 연결한다. Renderer는 adapter를 직접 호출하지 않는다.

```ts
interface MaintenanceExchangeAdapter {
  preview(input: Uint8Array): Promise<{ valid: number; invalid: ImportError[] }>
  import(input: Uint8Array, idempotencyKey: string): Promise<ImportResult>
  export(range: { from: string; to: string }): Promise<Uint8Array>
}
```

구현 시 dry run, 행 단위 오류, source ID 매핑, 중복 방지, 원본 hash, 실행자와 감사 로그를 필수로 한다. 현재 버전에는 실제 네트워크 연동을 포함하지 않는다.
