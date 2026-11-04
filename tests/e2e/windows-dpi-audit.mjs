import { _electron as electron } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const output=resolve('reports',process.env.OMNIS_DPI_OUTPUT??'windows-dpi-20261104-baseline')
mkdirSync(output,{recursive:true})
const executable=process.env.OMNIS_E2E_EXE??JSON.parse(readFileSync('release/windows-validation-20261104-local/installation.json','utf8').replace(/^\uFEFF/,'')).executable
const results=[]
for(const scale of [1,1.25,1.5]){
  const env={...process.env,OMNIS_E2E_DATA:resolve('tests/.tmp',`dpi-${scale}-${Date.now()}`)}
  delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;delete env.ANTHROPIC_API_KEY
  const app=await electron.launch({executablePath:executable,args:[`--force-device-scale-factor=${scale}`],env})
  try{
    const page=await app.firstWindow()
    await page.getByRole('button',{name:'관리자 로그인',exact:true}).click()
    await page.getByRole('heading',{name:'통합상황판',exact:true}).waitFor()
    const inspect=()=>app.evaluate(({screen,BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0],d=screen.getDisplayMatching(w.getBounds()),b=w.getBounds(),c=w.getContentBounds(),a=d.workArea;return{bounds:b,contentBounds:c,workArea:a,scaleFactor:d.scaleFactor,minSize:w.getMinimumSize(),maximized:w.isMaximized(),contentOutsideWorkArea:c.x<a.x-1||c.y<a.y-1||c.x+c.width>a.x+a.width+1||c.y+c.height>a.y+a.height+1}})
    const initial=await inspect()
    const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1}))
    await page.screenshot({path:resolve(output,`scale-${scale}-initial.png`)})
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].maximize())
    await page.waitForTimeout(250)
    const maximized=await inspect()
    const maxViewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1}))
    await page.screenshot({path:resolve(output,`scale-${scale}-maximized.png`)})
    results.push({scale,initial,viewport,maximized,maxViewport})
    writeFileSync(resolve(output,'audit.json'),JSON.stringify({executable,results},null,2))
    console.log(JSON.stringify(results.at(-1)))
  }finally{await app.close()}
}
assert.ok(results.every(r=>!r.initial.contentOutsideWorkArea&&!r.maximized.contentOutsideWorkArea),'The native window content must fit the work area at every tested scale')
assert.ok(results.every(r=>!r.viewport.horizontalOverflow&&!r.maxViewport.horizontalOverflow),'The page must not overflow horizontally at native scale')
