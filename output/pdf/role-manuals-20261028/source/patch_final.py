from pathlib import Path
p=Path(__file__).with_name('supplement.mjs');s=p.read_text('utf8')
s=s.replace("async function login(r){if", "async function login(r){await page.waitForTimeout(350);for(let i=0;i<3&&await page.getByRole('dialog').count();i++){await page.keyboard.press('Escape');await page.waitForTimeout(200)}if")
s=s.replace("const run=async(id,task,fn)=>{try", "const run=async(id,task,fn)=>{if(process.argv[2]&&process.argv[2]!==id)return;try")
s=s.replace("'supplement-results.json'", "(process.argv[2]?'attachment-retry-results.json':'supplement-results.json')")
p.write_text(s,'utf8')
p=Path(__file__).with_name('admin.py');s=p.read_text('utf8').replace('정수 10~1440','정수 10~10080').replace('일반 SLA(분)~필수~정수 10~10080','일반 SLA(분)~필수~정수 10~43200');p.write_text(s,'utf8')
p=Path(__file__).with_name('content.py');s=p.read_text('utf8').replace("'AI 지원 화면에서 분석·유사 사례·요약 보기',ALL", "'AI 지원 화면에서 분석·유사 사례·요약 보기',['ADMIN','OPERATOR','MAINTAINER','USER']").replace('UI14; Local Rule 테스트','UI18; Local Rule 테스트').replace('UI14 화면; 기존 smoke E2E','UI17·UI21 화면; 기존 smoke E2E').replace("'조회전용의 AI 참고 결과'","'운용요원의 AI 참고 결과'")
p.write_text(s,'utf8')
