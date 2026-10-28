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


## 로컬 입력 보완

고장 접수/상세와 AI 지원의 `InputAssist`는 공통 `missingQuestions` 규칙을 사용한다. 입력 점검은 추론 요청이 아니며 외부 API를 호출하지 않는다. 답변은 구조화 배열로 유지하고 실제 분석 요청 시 Main에서 `analysisDescription`으로 한 번 조합한다. 저장된 접수의 원문은 명시적 저장 없이 바꾸지 않는다. 화면 입력 변경/상세 이동 후 늦게 도착한 분석 결과는 폐기한다. 기존 Provider·Structured Outputs·Zod·마스킹·safeStorage·fallback·SLA 규칙은 유지된다.


## v4 기능별 프롬프트

PromptCatalog의 공통 OMNIS 업무 규칙과 기능별 지시문을 코드로 관리한다. 고장 분석(triage-v4), 일일 요약(daily-summary-v4), 유사 고장(similar-incidents-v4), 정비 우선순위(maintenance-priority-v4)를 각각 SDK 호출에 선택한다. 기존 Local Rule의 결정적 로직과 버전은 변경하지 않는다. OpenAI/Anthropic/Ollama는 동일 기능 지시를 사용하되 기존 각 Provider의 전송/검증/실패 처리 구조를 유지한다.

고장 정보가 부족하면 확인 질문과 잠정 판단을 제시하고, 정비 추천과 유사 고장에는 서로 다른 판단 기준을 적용한다. SLA 계산과 실제 업무 반영은 기존 서비스에 남긴다. 후보 JSON Schema의 uniqueItems를 제거하고 앱의 후보 대조·중복 제거를 유지했다. OpenAI Responses에는 store:false를 지정하며 공급자의 모든 로그가 제거된다고 해석하지 않는다.

콘솔 통합 Prompt, 기능별 system/JSON Schema와 가상 형식 예제는 docs/ai-prompts/v4에 있다. 생성기는 scripts/export-ai-prompts.ts이고 자동 테스트가 코드와 내보낸 파일의 동기화를 검사한다. 사진의 콘솔은 수동 시험에 사용하며 production 앱은 저장형 prompt ID를 참조하지 않는다. 문서·답변 형식 예제는 실제 모델 평가 결과가 아니다.
