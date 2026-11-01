# OMNIS 관리자센터 · 1.1.0

관리자 로그인 후 사이드바 **관리자센터**를 연다. 기존 `/signups`, `/settings` 경로와 시스템관리 화면은 유지한다. 모든 기본 계정·담당자·업무 자료는 가상 시연 데이터다.

## 메뉴

| 영역 | 제공 기능 |
|---|---|
| 관리 현황 | 로그인 계정, 승인 대기, 수동·자동 잠금, 사용 중지, 비밀번호 변경 필요, 가상 담당자 집계 및 목록 이동 |
| 사용자 관리 | 이름·아이디·군번·소속 검색, 계정 종류·역할·상태 필터, 정렬·페이지 이동, 상세 조회와 프로필·권한 변경 |
| 등록 승인 | 기존 가입 신청 승인·반려. ADMIN 부여 시 현재 관리자 비밀번호 재확인 |
| 역할·접속 보안 | 실패 횟수·자동 잠금 시간 변경, Main에서 사용하는 역할 규칙 및 서비스별 추가 제한 조회 |
| 감사 기록 | 기간(KST), 수행자, 대상, 작업 코드, 결과 검색과 변경 전후 상세 |
| 조직·업무 설정 | 기존 조치부서·부대 담당자·업무 템플릿 관리 화면 재사용 |
| 시스템·데이터 | 기존 시스템 정보, AI 설정, SLA·기준시간, 알림, 백업·시연 초기화 재사용 |

기본 역할은 ADMIN·OPERATOR·MAINTAINER·VIEWER·USER 5종이다. 권한표는 주요 작업에 대한 실제 Main 공통 규칙을 표시하며 본인 접수·배정·정비반 소속·현재 업무 상태 등의 서비스별 제한이 추가된다. 사용자 정의 역할·예외 권한 편집기는 제공하지 않는다.

## 계정 변경

1. 사용자 관리에서 대상을 검색하고 **상세**를 선택한다.
2. 프로필 수정 후 **정보 저장**, 역할 선택 후 **권한 변경**, 또는 필요한 상태 작업을 선택한다.
3. 대상·영향을 확인하고 변경 사유와 현재 관리자 비밀번호를 입력한다.
4. 성공 후 목록과 상세가 갱신된다. 다른 변경과 충돌하면 새 값을 확인한 뒤 다시 제출한다.

자기 자신의 잠금·사용 중지·역할 변경·관리자 초기화는 차단한다. 마지막 정상 로그인 가능한 관리자의 강등·잠금·사용 중지도 Main 트랜잭션에서 차단한다. 본인 비밀번호는 사이드바 하단의 **비밀번호 변경** 버튼으로 변경한다.

### 서로 독립적인 상태

- **사용 중지**: `users.active=0`. 로그인과 기존 활성 사용자 배정 목록에서 제외한다. 이전 업무 참조·담당자 이름·이력은 유지한다. 재활성화해도 다른 잠금은 유지된다.
- **수동 잠금**: 관리자가 설정·해제한다. 시간이 지나거나 앱을 다시 켜도 해제되지 않는다. 정비반 가용 상태나 업무 연락처 자체를 변경하지 않는다.
- **자동 잠금**: 기본 연속 5회 실패 시 15분. 정책 범위는 3~10회, 1~60분이다. 실패 횟수·해제 시각은 SQLite에 저장한다. 해제 시각 이후 로그인 시 실패 횟수를 정리한다. 수동 잠금·사용 중지는 그대로 유지한다.
- **비밀번호 변경 필요**: 관리자 초기화 후 임시 비밀번호로 로그인할 수 있으나, 비밀번호 변경·본인 인증 상태 확인·로그아웃 외 업무 IPC는 거절된다.

목록에서 상태가 여러 개면 대표 상태와 `+숫자`를 표시한다. 마우스를 올리거나 상세 화면을 열어 전체 상태를 확인한다. 자동 잠금 해제 시각은 KST로 표시한다.

### 비밀번호 초기화

관리자가 다른 로그인 계정에 **비밀번호 초기화**를 실행하면 안전한 난수 임시 비밀번호가 한 번 표시된다. 창을 닫으면 조회할 수 없다. 기존 비밀번호는 즉시 사용할 수 없으며 임시 비밀번호로 최초 로그인 후 새 비밀번호를 설정해야 한다. 임시 비밀번호를 잃어버렸다면 관리자에게 다시 초기화를 요청한다. 초기화는 수동 잠금·사용 중지를 자동 해제하지 않는다.

새 비밀번호는 기존 규칙과 같은 영문·숫자·특수문자 포함 8~64자이며 현재 비밀번호와 달라야 한다. 평문·hash·salt·임시 비밀번호는 사용자 조회·감사 API에 포함하지 않는다. 로그인 확인에는 scrypt와 상수 시간 비교를 사용한다.

## 실제 로그인 계정과 가상 담당자

기본 22개 부대의 가상 담당자 220명은 로그인할 수 없는 업무 배정용 연락처다. 별도 계정 종류 필터로 조회하며 로그인 계정 수와 마지막 관리자 수에서 제외한다. 계정 권한 변경·잠금·비밀번호 발급 등은 허용하지 않는다.

v9 이관 시 `organization_members.is_demo=1`이거나 자격 증명이 비어 있는 사용자는 CONTACT, 나머지는 LOGIN으로 분류한다. 신규 승인 계정과 신규 생성된 가상 담당자의 누락 메타데이터만 추가한다. 기존 보안 상태·권한·비밀번호는 seed나 재시작으로 덮어쓰지 않는다.

## 데이터와 인증 경계

DB v8→v9는 `account_security`, `security_policy` 및 조회 인덱스를 추가하는 순방향 migration이다. 사용자·업무·첨부파일 참조를 삭제하지 않는다. Drizzle 정의도 갱신했다.

모든 보호된 IPC는 현재 DB의 계정 상태와 역할을 확인한다. 권한·잠금·사용 상태·임시 비밀번호 변경 작업은 인증 버전을 증가시켜 이전 세션을 무효화한다. 인증 무효화 이벤트와 인증 상태 재조회로 화면을 로그인 또는 비밀번호 변경 화면으로 전환한다. 잠금은 프로세스 메모리만으로 판단하지 않는다.

인증 오류 코드는 `AUTH_REQUIRED`, `AUTH_SESSION_REVOKED`, `AUTH_PASSWORD_CHANGE_REQUIRED`, `AUTH_LOGIN_FAILED`, `AUTH_ACCOUNT_LOCKED`, `REAUTH_FAILED`, `FORBIDDEN` 등으로 구분한다. 동시 수정은 `CONFLICT`로 처리한다. 잘못된 비밀번호일 때 계정 상태를 공개하지 않으며, 가입 대기·반려 사유는 해당 비밀번호 확인 후에만 표시한다.

이 앱은 현재 설치 환경의 단일 로컬 세션을 다룬다. 다중 장비 접속·IP 추적·외부 SSO를 제공하지 않는다. OS 관리자가 DB를 직접 변경하는 것까지 방어하거나 로컬 감사 기록의 외부 변조 불가능성을 보장하지 않는다.

## 감사와 복구

기존 `audit_logs`에 로그인 성공·실패, 자동 잠금, 재인증 실패, 사용자 상태·권한·정보 변경, 비밀번호 초기화·변경, 정책 변경을 기록한다. 신규 변경은 사유·결과와 허용된 필드의 변경 전후만 저장한다. 관리자 화면에 수정·삭제 기능은 없다. CSV 내보내기는 이번 범위에 추가하지 않았다.

- 자동 잠금: 해제 예정 시각까지 기다리거나 다른 정상 관리자가 해제한다.
- 수동 잠금·사용 중지: 다른 정상 관리자가 해당 상태를 각각 해제한다.
- 초기 비밀번호 분실: 다른 정상 관리자가 재초기화한다.
- 모든 관리자 자격 증명을 분실한 경우: 자동 복구용 우회 계정은 없다. 앱을 종료하고 설치 전 보관한 userData 백업 또는 기존 수동 백업을 관리 절차에 따라 복구한다. 실제 자료를 시연 초기화로 덮어쓰지 않는다.
- v9를 연 DB는 v8 앱에서 열 수 없다. 이전 앱으로 되돌릴 때는 앱과 함께 이전 DB·첨부파일·설정 백업을 일치시켜 복구해야 한다. 복구 전 현재 자료도 별도 보관한다.

## 검증 방법

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e:admin
pnpm test:e2e:roles
pnpm test:e2e:signup
pnpm test:e2e:operations
pnpm test:e2e
pnpm test:e2e:visual
```

관리자 E2E는 매번 `tests/.tmp/admin-users/` 아래 새 격리 프로필을 사용한다. 가입 승인, 역할 적용·직접 IPC 거절, 잠금·사용 중지, 프로세스 재시작 후 자동 잠금 유지, 임시 비밀번호·최초 변경 강제, 가상 담당자 제한, 감사 상세와 정책·계정 상태 재시작 유지, 7개 영역의 4가지 화면 크기를 검증한다. 실제 사용자 DB에 테스트 계정을 만들지 않는다.

빌드된 앱은 `OMNIS_E2E_EXE=/절대경로/OMNIS.app/Contents/MacOS/OMNIS pnpm test:e2e:admin`으로 같은 검사를 수행한다. 테스트 결과·스크린샷은 로컬 `tests/.tmp/admin-users/`에 보관한다.

## 구현 파일

| 영역 | 주요 파일 |
|---|---|
| 계정 인증·세션 | `src/main/auth/AccountSecurity.ts`, `SessionManager.ts` |
| 관리자 서비스 | `src/main/services/UserAdminService.ts`, `AppService.ts` |
| DB 이관 | `src/main/database/accountMigration.ts`, `migrate.ts`, `schema.ts`, `connection.ts` |
| IPC 계약·권한 | `src/shared/admin.ts`, `permissions.ts`, `contracts.ts`, `src/main/ipc/registerIpc.ts`, `src/preload/index.ts` |
| 관리자 화면 | `src/renderer/src/AdminCenter.tsx`, `UserManagement.tsx`, `AdminSecurity.tsx`, `AdminAudit.tsx`, `PasswordChange.tsx`, `adminApi.ts` |
| 기존 화면 연계 | `App.tsx`, `SignupRequests.tsx`, `SystemManagement.tsx`, `IncidentsManagement.tsx`, `style.css` |
| 테스트 | `tests/integration/admin-accounts.test.ts`, `tests/e2e/admin-users.mjs`, `roles.mjs`, `signup.mjs` |

## 2026-10-31 실행 결과

- OMNIS 1.1.0 / SQLite schema v9 / Apple Silicon arm64.
- 타입 검사·린트·빌드, Vitest 12개 파일 97개 테스트 통과. 신규 계정 보안 테스트는 14개다.
- 소스 및 최종 설치 앱의 관리자 E2E 8개 흐름, 기존 역할·가입 승인·운영 업무·업무 smoke·visual E2E 통과.
- 실제 사용자 DB는 v8→v9로 이관했으며, 감사/신규 보안 테이블을 제외한 기존 32개 테이블의 행 수·내용 해시가 일치하고 무결성은 `ok`다.
- 설치 앱: `/Applications/OMNIS.app`. DMG: `release/admin-center/OMNIS-1.1.0-mac-arm64.dmg` (무결성 확인).
- 설치 전 앱: `release/admin-center/previous-install/OMNIS.app`. 전체 userData: `release/admin-center/user-data-before-v9/`. 비교 결과: `release/admin-center/migration-preservation.json`.
- Apple 배포 서명·공증은 하지 않았다. Windows·Intel Mac 실행/설치와 사용자 정의 권한 확장은 검증 범위에 포함하지 않는다.
