# Security

Electron renderer는 `contextIsolation`, `sandbox`, `webSecurity`를 사용하고 Node integration을 비활성화합니다. 모든 IPC 채널은 preload에서 제한되고 Zod로 검증합니다. 서비스 계층에서 RBAC와 상태 전이를 검사합니다. 비밀번호는 랜덤 salt와 `crypto.scrypt`로 저장합니다. 감사 로그는 주요 변경을 기록합니다. 데모 계정과 데이터는 운영 환경에 사용하지 않습니다.
