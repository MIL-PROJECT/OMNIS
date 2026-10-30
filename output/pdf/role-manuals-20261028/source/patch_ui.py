from pathlib import Path
p=Path(__file__).with_name('ui-verify.mjs');s=p.read_text('utf8')
s=s.replace("const field=n=>page.getByLabel(named(n));","const field=n=>page.getByLabel(named(n)).last();")
s=s.replace("async function login(r){await page.keyboard.press('Escape');", "async function login(r){await page.waitForTimeout(350);for(let i=0;i<3&&await page.getByRole('dialog').count();i++){await page.keyboard.press('Escape');await page.waitForTimeout(220)}await page.waitForTimeout(200);")
s=s.replace("await field('제목').fill('교육용 회선 장애');await field('장애 증상')", "await field('제목').fill('교육용 회선 장애');await page.getByRole('combobox',{name:'대상 체계',exact:true}).click();await page.getByRole('option').nth(1).click();await field('장애 증상')")
p.write_text(s,'utf8')
