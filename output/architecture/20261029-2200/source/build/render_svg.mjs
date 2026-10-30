import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {chromium} from 'playwright';
const OUT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');const scene=JSON.parse(await fs.readFile(path.join(OUT,'source/scenes.json'),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:3840,height:2160},deviceScaleFactor:1});const report=[];
for(const [i,s] of scene.slides.entries()){
 const svg=await fs.readFile(path.join(OUT,s.stem+'.svg'),'utf8');await page.setContent('<style>html,body{margin:0;background:white}svg{width:100vw;height:100vh;display:block}</style>'+svg);await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:path.join(OUT,s.stem+'.png')});await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:path.join(OUT,'evidence/rendered/svg-'+(i+1)+'.png')});
 const text=await page.locator('text').evaluateAll(els=>els.map(e=>({id:e.id,text:e.textContent,bbox:{x:e.getBBox().x,y:e.getBBox().y,w:e.getBBox().width,h:e.getBBox().height}})));
 report.push({slide:i+1,textCount:text.length,outside:text.filter(t=>t.bbox.x<0||t.bbox.y<0||t.bbox.x+t.bbox.w>1600||t.bbox.y+t.bbox.h>900)});await page.setViewportSize({width:3840,height:2160});
}
await browser.close();await fs.writeFile(path.join(OUT,'evidence/svg-render.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
