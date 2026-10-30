# AI 설계

## 원칙

AI 출력은 `AI 추천`으로 표시하며 자동 확정하지 않는다. 사용자가 근거와 신뢰도를 확인하고 수정한 후 `incidents:applyAi`를 호출해야 업무 데이터가 바뀐다.

## 고장 분류 계약

입력은 제목, 장애 증상, 서비스 영향, 체계 식별자와 사건 식별자의 안전한 요약이다. 출력은 다음 구조를 따른다.

- `category`, `priority`
- `recommendedTeamCode`, `recommendation`
- `estimatedMinutes`
- `rationale`, `confidence`
- `questions[]`

Local Rule은 키워드와 서비스 영향으로 항상 결정적 결과를 반환한다. Ollama는 loopback HTTP만 허용하고 8초 timeout, JSON parsing, Zod schema 검증을 통과해야 한다. 하나라도 실패하면 Local Rule 결과를 반환하고 `fallback_used=1`로 기록한다.

## SLA 위험

현재 구현은 다음 값을 비교하는 설명 가능한 규칙 모델이다.

`estimated = team_average_minutes × (1 + active_workload × 0.15)`

SLA 잔여시간이 0 이하이거나 `estimated > remaining`이면 높음, `estimated > remaining × 0.7`이면 보통, 그 외 낮음이다. 화면은 잔여시간, 평균 처리시간, 작업량, 권장 조치를 함께 표시한다. 이는 통계 학습 모델의 예측값이 아니라 운영 지원 휴리스틱이다.

## 실행 이력

`ai_runs`는 기능, provider, model, prompt version, 안전한 입력 요약, 구조화 출력, confidence, latency, 성공상태, fallback, 사용자 수정, 최종 반영, 실행자를 저장한다. 비밀번호, 군번 전체, 연락처, 긴 원문을 저장하지 않는다.

## 재현성과 안전성

- Local Rule 버전: `rules-v2`
- 분류 prompt 버전: `triage-v2`
- 네트워크: `127.0.0.1` 또는 `localhost`만 허용
- 업무 지속성: provider 미설치·timeout·invalid JSON에서도 접수·배정·조치·마감 가능
- 한계: 현재 유사 사례 검색은 키워드 기반이며 embedding similarity 점수는 제공하지 않는다.
