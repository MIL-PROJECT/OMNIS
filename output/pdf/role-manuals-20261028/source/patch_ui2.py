from pathlib import Path
p=Path(__file__).with_name('ui-verify.mjs');s=p.read_text('utf8')
s=s.replace("await page.getByText('승인 대기 중인 신청이 없습니다').waitFor();", "await page.waitForTimeout(250);const approved=(await call('admin:signupRequests')).find(x=>x.username==='manual_trainee');if(approved.status!=='APPROVED')throw new Error('Approval not persisted');return approved.status;")
s=s.replace("await page.getByRole('button',{name:'상세',exact:true}).click();", "await page.getByRole('row').filter({hasText:'교육용 연결 점검'}).getByRole('button',{name:'상세',exact:true}).click();")
s=s.replace("await nav('통제·일일마감');await button('상황경보 등록')", "await nav('통제·일일마감');await page.getByRole('tab',{name:'상황경보',exact:true}).click();await button('상황경보 등록')")
s=s.replace("page.getByText('AI 추천 · LOCAL',{exact:false})", "page.getByText(/AI 추천 ·/)")
p.write_text(s,'utf8')
