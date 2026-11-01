from pathlib import Path
import json,hashlib,zipfile,datetime,subprocess,shutil

R=Path(__file__).resolve().parents[1];P=R.parents[2]
Q=json.loads((R/'evidence/quality.json').read_text())
Q['visualReview']='Reviewed all 30 midpoint frames, 12 UI sub-cut frames, 3 full-scene contact sheets and UI contact sheet. Checked caption separation, major text bounds, current/proposal labels and corrected UI crops.'
Q['voiceReview']='All 900 seconds decode; 153 captions match narration; every scene has leading/trailing speech margin and bounded speed. Full human listening and venue speaker check are not claimed.'
Q['screenshots']='9 screenshots from the real installed app, using isolated synthetic profile. No production profile in share bundle.'
Q['overviewDiagramBoundsPassed']=all(x['x']>=0 and x['y']>=0 and x['x']+x['w']<=1920 and x['y']+x['h']<=1080 for x in json.loads((R/'evidence/overview-layout.json').read_text()))
assert Q['allPassed'] and Q['overviewDiagramBoundsPassed']
(R/'evidence/quality.json').write_text(json.dumps(Q,ensure_ascii=False,indent=2))
report=f'''# 최종 품질·검증 보고

완료일: {datetime.datetime.now().astimezone().isoformat(timespec='seconds')}.

## 산출물

| 항목 | 실제 결과 |
|---|---|
| 영상 | {Q['durationSeconds']:.2f}초, 1920×1080, 30fps, H.264 / yuv420p |
| 프레임 | {Q['frameCount']:,}개 |
| 내장 음성 | 한국어 macOS Yuna 합성 음성, AAC 48kHz mono |
| 별도 음성 | PCM 16-bit, 48kHz mono, 정확히 900초 |
| 음량 | integrated {Q['audioLoudness']['input_i']} LUFS, true peak {Q['audioLoudness']['input_tp']} dBTP |
| 구성 | 8개 장, 30개 장면, 실제 앱 녹화 6개 장면 |
| 자막 | {Q['captionCount']}개 cue, 최대 2줄, 별도 SRT와 영상 내 자막 |
| 문서 | 발표전략, 15분 대본, 스토리보드 CSV, 주장 근거표, 예상 질의 18개, 확장·연동 설계, 재촬영/상영 절차, 큐시트 |
| 도식 | 편집 가능한 SVG 4개 + PNG 4개 |
| 실제 앱 스크린샷 | 9개, 합성 시연 자료·격리 프로필 |

## 검사 결과

미디어·자막·기하·증빙 검사 {len(Q['checks'])}개를 통과했다. 이 숫자는 제품 테스트 건수와 별개다.

- 전체 영상과 음성을 끝까지 디코딩했다. 디코딩 오류 0.
- 자막 전체를 원문과 공백 정규화 후 비교했다. 153개 cue 순서·시간 범위·최대 2줄을 확인했다.
- 30개 장면의 목표 길이 합계는 900초다. 합성 음성 속도 보정은 약 0.917~1.123×이며 장면마다 앞·뒤 여백이 있다. 마지막 발화가 잘리지 않았는지 에너지 구간도 검사했다.
- 실제 최종 MP4에서 중간 프레임 30개와 UI 세부 전환 12개를 추출해 시각 검토했다. 한글, 자막 띠, 도식의 구현/제안 구분, 화면 주요 영역 잘림을 확인했다.
- 실행 이력의 일부 열과 관리자 확인창 버튼이 잘린 첫 편집을 수정해 다시 합성·검사했다. 최종 이력 표는 선택/실제 사용/모델/Fallback이 모두 보인다.
- 설명 artwork의 텍스트 {sum(len(x['texts'])for x in json.loads((R/'sources/visual-layouts.json').read_text()))}개 경계를 검사했다. 도식 SVG XML 구문과 별도 전체 구성도 경계도 확인했다.
- 공유 텍스트의 주요 API key·GitHub token·private key 패턴을 검사했다. 검출 0. 이것이 모든 민감 정보에 대한 자동 판별을 뜻하지는 않는다.
- `git status --porcelain`이 비어 있었다. 제품 코드·의존성·운영 DB를 변경하지 않았고 commit/push를 하지 않았다.

## 프로그램 검증과 영상 제작 검증의 구분

발표의 97개 단위/통합 테스트, 관리자 8개 흐름과 7영역×4크기 검사는 기존 동일 source tree의 기록이다. 현재 작업에서는 그 기록과 CI 성공을 재확인하고 촬영 앱의 Main/Preload/index.html 세 파일의 SHA-256을 현재 빌드와 대조했다. 새 현장 성능·모델 정확도 시험을 수행한 것으로 표현하지 않았다.

[CI 근거](https://github.com/alex50027319/military_project/actions/runs/41268151403): macOS arm64/x64 작업 성공. 소스와 설치 앱의 관리자 E2E 결과는 근거 JSON에 보존했다.

## 공개한 제한사항

1. 체계 미지정 접수의 AI 분석은 null/string 입력 계약 불일치가 재현됐다. 별도 근거와 후속 회귀 항목을 남겼으며 이번 제작에서는 제품을 수정하지 않았다. 체계를 명시한 합성 사례로 촬영했다.
2. 실제 생성형 모델의 정답·유료 외부 API·타체계 양방향 연결·다중 PC 동시성·현장 개선률은 검증하지 않았다.
3. 일일 계획 숫자는 수동 합성 fixture다. 실제 마감 완료를 촬영한 것이 아니며 정합성·인수인계 화면을 보여 줬다.
4. 원본 앱 화면은 1440×768이다. 잘라 확대하고 끝 프레임을 유지했다. 무편집 실시간 전체 조작 영상이 아니다. 일부 상태 준비는 기존 Main 업무 API를 사용했다.
5. 음성은 TTS다. 전 구간의 사람 청취와 실제 평가장 스피커·프로젝터 상영은 수행하지 않았다. 행사 전 로컬 플레이어로 처음·중간·마지막과 음량을 확인하는 절차를 제공했다.
6. 패키징 CI 성공은 Apple 배포 서명·공증, 신규 PC 설치·조직 보안 승인을 대신하지 않는다.

정지 설명 장면과 의도한 끝 프레임 유지가 많으므로 freeze 비율을 오류율로 제시하지 않는다. 이 보고서는 실제 확인한 범위에 대한 기록이며 모든 결함 부재를 보증하는 인증서가 아니다.
'''
(R/'발표자료/09_최종_품질검증.md').write_text(report)
readme='''# OMNIS 기술평가 발표 패키지

**15분 한국어 기술 시현 영상과 발표 원고**다. 평가관·개발자를 대상으로 현재 아키텍처, 세 가지 설계 차별성, 확장 조건과 타체계 연동 방안을 중심으로 구성했다.

## 바로 사용할 파일

- `OMNIS_기술평가_시현영상_15분.mp4`: 내장 한국어 합성 음성·자막, 1080p/30fps, 실제 길이 15분 0.02초. 이 파일 하나로 상영한다.
- `발표자료/02_15분_발표대본.md`: 영상 음성과 동일한 전체 원고, 화면·근거·연출·시각 포함.
- `발표자료/05_예상질의응답_18문항.md`: 약 30초 답변과 약 90초 확장 설명용 원고.
- `발표자료/08_진행자_큐시트.md`: 상영·질의 시각표.
- `발표자료/04_주장_근거_한계.md`: 무엇을 구현·시험·제안했는지 구분한 근거표.
- `발표자료/06_확장성_연동설계.md`: 데이터 책임·멱등·오류·승인·단계별 시험을 포함한 향후 설계안.
- `도식/`: 현재 전체 구성, 업무 요청, AI 경계, 향후 연동의 SVG/PNG.
- `실제앱_스크린샷/`: 가상 자료로 촬영한 실제 앱 9개 화면.
- `장면_미리보기/`: 최종 영상에서 추출한 30개 장면과 12개 세부 전환.
- `OMNIS_평가발표_한국어음성.wav`, `한국어_자막.srt`: 재편집용. 이미 음성·자막이 들어 있는 MP4에 동시에 켜지 않는다.
- `발표자료/09_최종_품질검증.md`: 실제 매체 검사와 남은 검증 범위.

## 발표 시간 배분

| 시간 | 주제 |
|---|---|
| 00:00–01:20 | 문제와 목표 |
| 01:20–02:20 | 기능과 대표 사례 |
| 02:20–05:20 | 현재 아키텍처 |
| 05:20–08:20 | 세 가지 설계 차별성 |
| 08:20–10:30 | 확장성과 변경 조건 |
| 10:30–12:40 | 타체계 연동 방안 |
| 12:40–14:10 | 검증과 실증 계획 |
| 14:10–15:00 | 로드맵과 결론 |

현재 구현은 녹색 상태 배지, 향후 연동 제안은 황색·점선으로 표시했다. AI 도식의 청색 점선은 이미 구현된 선택 경로다. LOCAL은 결정적 규칙으로 생성형 모델이 아니다. Ollama 장면은 연결 실패→LOCAL 복귀의 실제 재현이다.

## 기준과 주의점

OMNIS 1.1.0 / DB schema9 / main b142f1e / 검증 head62eaf83과 source tree 동일. 실제 설치 앱을 새 격리 프로필로 촬영했고 일부 상태는 Main 업무 API로 준비했다. 영상은 실제 녹화를 확대·편집하고 읽기 시간을 위해 끝 프레임을 유지한다. 기존 사용자 자료·유료 API·실제 타체계 접속은 사용하지 않았다.

체계 미지정 AI 분석의 입력 계약 문제를 발견해 한계에 공개했다. 촬영은 체계를 명시한 가상 사례를 사용했다. 타체계 실연동, 중앙 다중 PC, 모델 정확도·현장 효과는 완료 기능으로 표현하지 않았다. 상세는 근거표와 품질 보고서에 있다.

공유 ZIP에는 운영/가상 프로필 DB와 자격정보, 디버그 원본 녹화를 넣지 않는다. 편집·재촬영용 원본과 스크립트는 같은 작업 폴더의 `sources/`, `assets/`, `recordings/`, `audio/`에 별도로 보존했다. 제품 소스와 Git 상태는 변경하지 않았다. 이 문서의 상대 파일명은 패키지 안 위치를 뜻한다.
'''
(R/'README_먼저읽기.md').write_text(readme)
context=json.loads((R/'evidence/context.json').read_text());context['phase']='completed';context['qualityAllPassed']=True;context['videoDurationSeconds']=Q['durationSeconds'];context['completedAt']=datetime.datetime.now().astimezone().isoformat(timespec='seconds');(R/'evidence/context.json').write_text(json.dumps(context,ensure_ascii=False,indent=2))
curated=[R/'README_먼저읽기.md',R/'OMNIS_기술평가_시현영상_15분.mp4',R/'OMNIS_평가발표_한국어음성.wav',R/'한국어_자막.srt']
for name in ['발표자료','도식','실제앱_스크린샷','장면_미리보기']:curated.extend(x for x in (R/name).rglob('*')if x.is_file())
for name in ['quality.json','context.json','installed-build.json','pr-ci.json','admin-e2e-source.json','admin-e2e-packaged.json','narration-timing.json','audio-activity.json','filming-limitation.json','final-contact-1.jpg','final-contact-2.jpg','final-contact-3.jpg','final-ui-contact.jpg']:curated.append(R/'evidence'/name)
# No recording profiles, SQLite databases, raw debug videos or credential files in the shareable archive.
assert not any(x.suffix in ['.db','.webm','.aiff']or 'profile-'in str(x) for x in curated)
checksums='\n'.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(R)}'for p in sorted(curated))+'\n'
(R/'SHA256SUMS.txt').write_text(checksums);curated.append(R/'SHA256SUMS.txt')
z=R/'OMNIS_기술평가_발표패키지.zip'
with zipfile.ZipFile(z,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as out:
 for p in curated:out.write(p,str(Path('OMNIS_기술평가_발표패키지')/p.relative_to(R)))
with zipfile.ZipFile(z)as out:assert out.testzip()is None;assert len(out.namelist())==len(curated)
assert subprocess.run(['git','status','--porcelain'],cwd=P,capture_output=True,text=True).stdout==''
(R/'evidence/package.json').write_text(json.dumps({'file':str(z),'bytes':z.stat().st_size,'sha256':hashlib.sha256(z.read_bytes()).hexdigest(),'entries':len(curated),'archiveCrcTest':'passed','excluded':['profile databases','credentials','raw debug recording','failed raw recording'],'productGitStatus':'clean'},ensure_ascii=False,indent=2))
print('READY',str(z),len(curated),'files',round(z.stat().st_size/1024**2,1),'MiB')
