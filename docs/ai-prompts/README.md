# OMNIS API 업무지원 프롬프트

사진의 Prompt 입력란은 모델의 행동·출력 규칙을 정의하는 곳입니다. 이 폴더는 실제 앱의 PromptCatalog에서 내보낸 지시문과 JSON Schema, 가상 시험 입력을 제공합니다. 플랫폼에 저장한 Prompt가 앱에 자동으로 연결되는 것은 아닙니다.

OpenAI 공식 문서는 새 구현에서 프롬프트를 코드로 관리하고 instructions/input으로 전달하도록 권장하며, 저장형 Prompt 객체 API의 종료를 2026-11-30으로 안내합니다. 이 앱도 prompt ID 의존성을 추가하지 않고 코드 관리 방식을 유지합니다.

- 공식 안내: https://developers.openai.com/api/docs/guides/prompting/migrate-from-prompt-object
- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs

## 사진의 화면에서 통합 시험하기

1. Prompt 입력란에 `v4/OMNIS_CONSOLE_MASTER_PROMPT.txt` 전체를 붙여 넣습니다.
2. Model은 앱과 같은 `gpt-6-luna`, Reasoning effort는 low로 시작합니다. WebSocket mode는 이 앱이 사용하지 않으므로 끕니다. Store logs도 끕니다. 이것이 공급자의 모든 서버 로그가 사라진다는 의미는 아닙니다.
3. 통합 시험의 Text format은 text로 두고 아래 사용자 입력창에 기능별 `*.console-message.json`을 넣습니다. task와 data를 읽어 해당 기능의 JSON을 반환하도록 만든 수동 시험 프롬프트입니다. 앱에서는 이 통합 형식을 사용하지 않습니다.
4. 처음에는 `triage.console-message.json`으로 시험합니다. 제출하면 외부 전송과 API 비용이 발생할 수 있습니다. 이 작업에서는 실제 API를 실행하지 않았습니다.
5. 통합 프롬프트의 text 시험은 출력 형식을 보장하지 않습니다. 실제 앱과 같은 구조화 출력을 시험하려면 아래 기능별 방법을 사용합니다.

## 기능별 Structured Outputs 시험

| 기능 | Prompt에 붙여 넣을 파일 | User 메시지의 업무 데이터 | Text format JSON Schema |
| --- | --- | --- | --- |
| 고장 분석 | triage.system.txt | triage.input.json | triage.schema.json |
| 일일 요약 | dailySummary.system.txt | dailySummary.input.json | dailySummary.schema.json |
| 유사 고장 | similarIncidents.system.txt | similarIncidents.input.json | similarIncidents.schema.json |
| 정비 우선순위 | maintenancePriority.system.txt | maintenancePriority.input.json | maintenancePriority.schema.json |

표의 파일은 모두 v4/ 아래 있습니다. User 메시지는 `<business_data>업무 JSON</business_data>`로 감쌉니다. Text format에서 JSON Schema/Structured Outputs를 선택하고 해당 schema.json을 지정합니다. name/strict/schema가 포함된 전체 포맷이 필요하면 response-format.json을 사용합니다. 지시문에 JSON이라고 쓰는 것만으로 Structured Outputs가 설정되지는 않습니다.

expected-output.json은 사람이 만든 형식 예시이며 모델이 실제로 반환한 답변이 아닙니다. 여러 유효한 추천이 가능하므로 live 평가에서 예시와 문장·점수가 정확히 일치해야 한다고 판단하지 않습니다.

## 앱에 반영된 방식

앱은 OpenAI Responses API의 instructions에 기능별 system을, input에 마스킹된 business_data를 직접 전송합니다. text.format은 json_schema/strict이며 응답은 Zod로 다시 검증합니다. OpenAI 호출에는 store:false를 지정했습니다. 이는 응답 객체 저장 옵션이며 공급자 전체 로그·보존 정책에 대한 보장은 아닙니다.

OpenAI/Anthropic/Ollama의 유사 고장과 정비 추천 지시문을 분리했습니다. 실제 배정과 업무 상태 변경, SLA 위험 계산, AI 추천 라벨과 실행 metadata는 앱이 처리합니다. 프롬프트가 DB·소스·첨부·실시간 장비를 직접 조회한다고 지시하지 않습니다. RAG는 추가하지 않았습니다.

후보 id에는 새 값이 들어갈 수 없도록 기존 후보 대조·중복 제거·최대 5개 제한을 유지합니다. JSON Schema에서 uniqueItems에 의존하지 않고 앱에서 중복을 제거합니다. 요약의 새로운 수치 검출과 실패 시 Local Rule fallback도 유지합니다. 프롬프트만으로 모델의 정확성·보안·실제 업무 완료를 보장하지 않습니다.

API Key는 이 문서나 플랫폼 Prompt 본문에 넣지 않습니다. 앱의 관리자 → 시스템관리 → AI Provider 설정에서 직접 저장하고 외부 사용 활성화/전송 동의/설정 저장/연결 시험을 진행합니다. 콘솔에는 앱의 전송 전 마스킹이 적용되지 않으므로 가상 자료만 입력합니다. 실제 군사기밀·개인정보·인증정보를 Prompt나 사용자 메시지에 넣지 않습니다.

## 수정·재생성·검증

프롬프트는 `src/main/ai/PromptCatalog.ts`를 수정한 뒤 `pnpm exec tsx scripts/export-ai-prompts.ts`로 재생성합니다. 내보낸 텍스트와 스키마의 코드 일치, 가상 출력 계약, SDK 호출 시 기능별 프롬프트 선택과 store:false를 자동 테스트합니다. 모델의 의미적 판단 성능과 실제 API 연결은 별도의 opt-in live 검증이 필요합니다. 기존 설치본은 갱신하지 않으면 이 프롬프트 변경이 적용되지 않습니다.


## 이번 변경의 검증 기록

- typecheck/lint/build 통과. 11개 파일 83개 unit/integration 테스트 통과.
- SDK mock으로 OpenAI/Anthropic/Ollama 각각 4기능의 지시문 선택·버전·응답 계약을 확인했다. 내보낸 프롬프트/스키마의 코드 일치도 확인했다.
- 소스 external-ai 및 operations E2E, Windows packaged external-ai E2E 통과. 모두 가상 데이터·mock 기반이며 실제 모델의 정확도·프롬프트 주입 방어 성공률을 측정한 결과가 아니다.
- 실제 API 키를 이용한 요청, 플랫폼 Prompt 저장·게시, macOS 빌드 실행은 이번 변경에서 수행하지 않았다.
- 설치본: release/ai-prompt-v4/OMNIS Setup 1.0.0.exe. 136,119,341 bytes, NotSigned. SHA-256: AA20077700D0B00EBBB2D10BD9F70EBFAC576A8C478492E6AEFE7A6504F3ECBF.
