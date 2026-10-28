# AI 설계

## 원칙과 Provider

AI 출력은 항상 `AI 추천`이며 자동 확정하지 않는다. 사용자가 근거와 신뢰도를 검토하고 `incidents:applyAi`를 호출한 뒤에만 업무 데이터가 바뀐다. 기본 Provider는 `LOCAL`이고 `OLLAMA`, `OPENAI`, `ANTHROPIC`을 관리자가 선택할 수 있다. 외부 Provider는 동의·활성화·credential이 모두 있을 때만 호출한다.

`AIProvider`는 업무 계약, `AIProviderFactory`는 설정별 생성, `AIOrchestrator`는 timeout·재시도·fallback·이력, `AISecretStore`는 credential 보호, `PromptCatalog`는 prompt version·JSON Schema·output token 한도를 담당한다.

## 구조화 출력

- 고장 분류: category, priority, confidence, recommendation, rationale, recommendedTeamCode, estimatedMinutes, questions.
- OpenAI: 공식 SDK와 Responses API의 `text.format.type=json_schema`, `strict=true`.
- Anthropic: 공식 SDK와 Messages API의 `output_config.format.type=json_schema`.
- Ollama: loopback `/api/generate`, JSON format.
- 모든 비결정적 결과는 Zod로 다시 검증한다.
- 유사 고장·정비 추천은 제공된 후보 ID만 허용하며 중복 제거 후 최대 5개로 제한한다.
- 일일 요약은 DB 집계값만 입력하고, 입력에 없는 숫자가 출력되면 거부한다.

## 외부 전송 보호

전화번호, 이메일, 군번, Bearer/API Key 형태, password/token 값, Windows/macOS 로컬 경로를 중앙 `ExternalDataGuard`에서 마스킹한다. 제목 200자, 증상 1,000자, 서비스 영향 500자, 후보 20개로 제한한다. 첨부 원문·감사 로그·계정명·DB 전체 데이터는 보내지 않는다. system instruction과 `<business_data>`를 분리해 사용자 입력을 명령이 아닌 데이터로 취급한다.

## timeout, retry, fallback

기본 timeout은 15초이며 5~30초로 설정할 수 있다. 네트워크 오류, 408, 429, 5xx만 최대 2회 exponential backoff와 jitter로 재시도한다. 400, 401, 403 및 schema/refusal 오류는 재시도하지 않는다. 실패 시 선택 Provider에서 직접 Local Rule로 fallback하며 Ollama를 중간 경로로 사용하지 않는다.

## SLA 위험

SLA 위험은 LLM이 변경하지 않는다. `team_average_minutes × (1 + active_workload × 0.15)`와 SLA 잔여시간을 비교하는 기존 결정적 규칙을 유지한다.

## credential과 실행 이력

API Key는 DB·renderer·localStorage·로그에 저장하지 않는다. Electron `safeStorage` ciphertext만 `userData/secrets/ai-credentials.json`에 저장하며 암호화를 사용할 수 없으면 저장을 거부하고 환경변수만 허용한다. IPC는 configured/source/masked만 반환한다.

schema v5의 `ai_runs`는 선택/실제 Provider, model, prompt/schema version, latency, input/output token, request ID, error code, fallback, external transmission, 반영 여부를 저장한다. 가격표는 저장하지 않는다.
