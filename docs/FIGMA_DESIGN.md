# OMNIS Figma 디자인 및 인계 현황

2026-11-01 기준으로 현재 앱 UI를 편집 가능한 Figma 레이어로 옮기고, 화면·상태·공통 컴포넌트를 관리할 수 있는 구조로 정리했다.

- [Figma 파일 · 시작 안내](https://www.figma.com/design/gazLDL6BMSr9VdU34soC5E/mil_project?node-id=44-21006)
- [공통 UI 상태표](https://www.figma.com/design/gazLDL6BMSr9VdU34soC5E/mil_project?node-id=44-20593)
- [프로토타입 · 전체 흐름 선택](https://www.figma.com/proto/gazLDL6BMSr9VdU34soC5E/mil_project?node-id=44-20988&starting-point-node-id=44-20988&scaling=contain)

## 파일 구성

Page는 작업 영역, Section은 기능·흐름 묶음, 최상위 Frame은 개별 화면·상태로 사용한다.

| Page | 구성 | Page ID |
|---|---|---|
| 00 · 시작하기 | Overview, 작업 및 인계 가이드, 화면 인덱스 | `0:1` |
| 01 · UI Library | Foundations, Icons, 원본 대응 Controls, App Shell, 상태 패턴 | `5:61` |
| 02 · Product Screens | 기능 Section 12개, 화면 Frame 82개, Prototype Overlay 36개, 흐름 선택 화면 | `5:62` |

기능 Section은 로그인 및 계정, 상황판 및 운영현황, 고장관리, 정비관리, 통제 및 일일마감, 근무 및 지시사항, AI 지원, 보고서 및 매뉴얼, 관리자센터, 시스템관리, 역할별 차이, 좁은 데스크톱으로 구성한다. 기본·입력·모달·빈 결과·권한·반응형 상태를 화면 이름과 주석에서 구분한다.

## 재사용 및 편집

- 앱 화면 77개에 공통 Sidebar와 Topbar 인스턴스를 각각 적용했다. 나머지 5개는 로그인·등록 화면이다.
- Sidebar는 실제 캡처의 권한·선택 메뉴·Viewport 조합 21개, Topbar는 문맥·너비 조합 18개를 제공한다. 사용자 이름·배지·날짜 등은 텍스트 속성으로 편집한다.
- 버튼은 Primary/Secondary/Text × Default/Hover/Disabled의 9개 조합, 입력란은 Default/Hover/Focused/Error/Disabled 5개 상태를 제공한다. 기존 상태 배지 9개도 유지한다.
- 원본 Pretendard Variable, 색상 변수, 텍스트·효과 스타일을 사용한다. 서체 편집에는 로컬 Pretendard 사용 환경이 필요하다.
- 원본 재현용 Controls는 의미 있는 이름과 `Source key`로 관리한다. 향후 설계용 상태 패턴과 함께 제공하며, 모든 원본 대응 컴포넌트를 하나의 범용 컴포넌트로 합치지는 않았다.
- 교체한 App Shell 원본은 숨김 보관 Section에 유지한다. 기존 화면 ID와 프로토타입 이동은 보존한다.

## 보정 및 검증

- 입력란 인스턴스 434곳의 값·placeholder·색상·날짜/시간 서식을 보정했다. 긴 한 줄 값은 말줄임 처리하고, 여러 줄 본문은 상단 정렬과 줄바꿈을 유지한다.
- 달력 이동 화살표 6곳, 비대칭 모서리 70곳을 보정했다.
- 원본 화면 82개를 비교하고 마지막 입력 서식 보정 후 대표 화면 13개를 다시 검토했다. 역할별 화면 한 장의 투명한 내보내기는 해당 Section을 표시한 뒤 Figma의 PNG 내보내기로 재생성했다.
- 최종 검사 결과는 화면 82개, 표시된 기능 Section 12개, Sidebar/Topbar 인스턴스 각각 77개다. 서체 누락·끊어진 이동 대상·화면 내부 이미지 채우기는 각각 0건이며, 기존 화면 반응 1,154개를 유지한다.
- 브라우저에서 프로토타입 허브 → 고장관리 → 정비관리 이동을 확인했다.

CSS 애니메이션·블러·네이티브 입력 위젯·일부 그라디언트와 캡처 압축은 정적 Figma 렌더와 표현 차이가 있다. 원본에 없는 업무 상태는 추가하지 않았으며, `Ready for dev`는 최종 승인 시 화면별로 지정한다.

## 저장 위치와 복구 자료

디자인 원본은 위 Figma 파일에 저장된다. 임시 로컬 연결은 종료했으며 플러그인 창을 닫아도 결과는 유지된다.

로컬 작업 디렉터리는 `release/figma-transfer/`다. `professional-state.json`에는 변경한 노드 ID와 최종 검사 결과, `source/professional-plan.json`에는 화면 목록, `verification/실무형-Figma-검토.html`에는 원본과 Figma의 비교 자료가 있다. 마지막 전체 감사는 `verification/local-results/job-79.json`이다.

이 Git 문서는 파일 링크·구성·검증 현황을 보존한다. `release/`는 기존 Git 제외 대상이며 로컬 캡처·빌드·프로필·임시 연결 정보는 추적하지 않는다. Figma 파일의 편집 이력은 Figma에서 관리한다.
