# 외부 AI Provider 설정과 운용

## 구독과 API 사용의 차이

ChatGPT 또는 Claude 웹 구독은 각 서비스의 대화형 제품 이용권이다. OMNIS의 OpenAI·Anthropic 연동은 별도의 개발자 API credential과 사용량 과금이 필요하다. 토큰 사용량은 OMNIS 실행 이력에 기록하지만 금액은 계산하지 않으며 각 Provider 콘솔에서 확인한다.

## API Key 준비와 저장

1. OpenAI 개발자 콘솔에서 API Key를 발급하거나 `OPENAI_API_KEY`를 설정한다.
2. Anthropic Console에서 API Key를 발급하거나 `ANTHROPIC_API_KEY`를 설정한다.
3. `.env.example`을 참고하되 실제 Key가 포함된 `.env`를 Git에 추가하지 않는다.
4. 시스템관리 → AI Provider 설정의 password 입력에 Key를 넣고 저장한다.

Main Process가 Electron `safeStorage.encryptString()`으로 암호화한 ciphertext만 Windows `%APPDATA%/OMNIS/secrets/ai-credentials.json` 또는 macOS OMNIS userData의 같은 상대 경로에 기록한다. renderer와 IPC에는 `••••••••마지막4자`만 표시된다. 암호화를 사용할 수 없으면 저장하지 않으며 환경변수를 사용해야 한다.

## Provider 설정

- LOCAL: 완전 오프라인 결정적 규칙. 기본값.
- OLLAMA: `127.0.0.1` 또는 `localhost` endpoint와 로컬 model.
- OPENAI: 기본 `gpt-6-luna`, Responses API structured output.
- ANTHROPIC: 기본 `claude-haiku-5-5`, Messages API structured output.

외부 Provider 선택 전 활성화와 동의 항목을 모두 체크한다. timeout은 5~30초, 일일 요청 한도는 1~1,000 범위다. 저장만으로 외부 호출하지 않으며 연결 시험도 관리자가 버튼을 눌렀을 때만 실행한다.

## 외부 전송 범위와 비용

전송 가능 범위는 길이가 제한되고 마스킹된 고장 제목·증상·서비스 영향, 집계된 운영 수치, 최대 20개 후보의 업무 ID·제목·상태다. 비밀번호, API Key, 전체 군번, 전화번호, 이메일, 계정명, 로컬 경로, 첨부 원문, 감사 로그 원문, DB 전체는 보내지 않는다. 실제 군사기밀·개인정보·인증정보를 입력하지 않는다. 연결 시험을 포함한 외부 요청은 비용이 발생할 수 있다.

## 오류와 fallback

네트워크 오류·408·429·5xx는 최대 2회 재시도한다. 인증 오류와 형식 오류는 즉시 중단한다. 모든 실패는 Local Rule 결과로 업무를 계속하며 화면과 `ai_runs`에 선택 Provider, 실제 Provider, 오류 분류, latency, token, fallback을 구분해 표시한다. SLA 위험은 항상 로컬 결정 규칙으로 계산한다.

## Windows와 macOS

Windows는 `release/OMNIS Setup 1.0.0.exe`로 설치하거나 `release/win-unpacked/OMNIS.exe`를 실행한다. macOS는 CPU에 맞는 DMG/ZIP artifact를 사용한다. unsigned 빌드는 OS 경고가 표시될 수 있으며 서명·공증 여부를 artifact 설명에서 확인한다. Local Rule과 Ollama는 외부 API Key 없이 동작한다.

## Key 교체·삭제와 문제 해결

- 교체: 새 Key 입력 후 저장한다.
- 삭제: Provider 행의 삭제 버튼을 누른다. 환경변수 Key는 실행 환경에서 제거한다.
- 인증 실패: Key·프로젝트 권한·Provider 콘솔의 model 접근 권한을 확인한다.
- 요청 한도: 앱 일일 한도 또는 Provider rate limit을 확인한다.
- timeout/offline: Local Rule fallback 표시와 AI 실행 이력의 error code를 확인한다.

자동 테스트는 실제 API를 호출하지 않는다. 실제 Key smoke는 비용 안내를 확인한 뒤 Windows PowerShell에서 `$env:RUN_EXTERNAL_AI_TESTS='1'; pnpm test:external-ai:live`, macOS에서 `RUN_EXTERNAL_AI_TESTS=1 pnpm test:external-ai:live`로 명시적으로 opt-in하며 기본 CI에서는 제외한다.


## 1.0.1: 체크했는데도 EXTERNAL_DISABLED가 표시되는 문제 수정

이전 UI는 화면의 미저장 체크값과 DB 저장값을 구분하지 않았고, 키 저장/시험 후 설정 전체를 다시 불러와 선택값을 덮어썼다. 설치본 1.0.1에서는 다음 흐름을 사용한다.

1. 시스템관리에서 Provider를 OPENAI 또는 ANTHROPIC으로 선택한다.
2. 외부 AI 사용 활성화와 외부 전송·별도 비용·최종 검토 동의를 직접 체크한다.
3. 키가 미설정이면 키를 입력하고 키 저장을 누른다. 키 저장은 Provider/동의/모델/timeout 입력을 유지한다.
4. 저장되지 않은 변경이 있으면 연결 버튼이 **저장 후 연결 시험**으로 표시된다. 누르면 설정 저장 성공 후에만 시험한다. 설정은 위쪽 AI 설정 저장 버튼으로 별도 저장할 수도 있다.
5. 체크가 없거나 설정 검증에 실패하면 외부 시험을 실행하지 않는다. 아직 입력 중인 키는 먼저 저장해야 한다. 연결 시험은 외부 전송과 과금이 가능하므로 화면에 이를 표시한다.

화면에 저장된 제공자·현재 선택·미저장 상태를 구분하고, 선택한 Provider의 설정만 표시한다. 결과는 모달 경고 대신 화면 메시지와 오류 코드로 안내한다. 실제 사용한 Provider와 fallback은 기존 실행 이력에서 확인한다. 사이드바의 고정 Local Rule 표시는 일반 업무지원 문구로 정리했다.

기존 앱 데이터와 암호화 키 저장 위치는 유지하며 DB migration은 추가하지 않았다. 사용자 실제 DB는 provider/활성화/동의 시각/마지막 시험 코드 4개 비밀이 아닌 항목만 읽어 원인을 확인했다. 실제 키를 읽거나 설정을 자동으로 활성화하거나 실제 외부 API를 호출하지 않았다.

검증: typecheck/lint/build, 83개 unit/integration 테스트 및 격리된 mock `pnpm test:e2e:ai-settings` 통과. 체크→키 저장→저장 후 시험, 미동의 및 설정 저장 실패 시 시험 차단, OpenAI/Claude, 1366×768·1920×1080을 검증한다. 기존 external-ai/roles E2E도 회귀 검증한다. 실제 API 계정의 인증·결제·모델 접근 성공을 확인한 결과는 아니다.


최종 배포 검증: v1.0.1 Windows 실행본에서 ai-settings E2E 통과, 새로고침 후 동의/Provider 보존 및 자동 호출 없음도 검증했다. 테스트는 전부 mock 기반이며 실제 키는 사용하지 않았다. 설치 파일 크기 142,032,825 bytes, NotSigned, SHA-256 `34AD61ED318FC917A68CEDD289A9C3B8B7216FDC763CA4B56CB49BA578B02AE0`.
