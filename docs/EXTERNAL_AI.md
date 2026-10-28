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
