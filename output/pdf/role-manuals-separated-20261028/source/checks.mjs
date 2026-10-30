import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../../..'),ev=join(root,'evidence'),snap=join(ev,'snapshot');
const bin=(pkg,path)=>join(repo,'node_modules',pkg,path);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;delete env.ANTHROPIC_API_KEY;delete env.OMNIS_E2E_EXE;delete env.OMNIS_E2E_PROFILE;
const run=(name,args,cwd=snap)=>{const t=Date.now();const r=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8',timeout:150000,windowsHide:true});writeFileSync(join(ev,name+'.log'),(r.stdout??'')+'\n'+(r.stderr??''));let result={name,exitCode:r.status,seconds:(Date.now()-t)/1000,error:r.error?.message};writeFileSync(join(ev,name+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));return r.status===0};
const all=[['typecheck',[bin('typescript','bin/tsc'),'--noEmit']],['lint',[bin('eslint','bin/eslint.js'),'src','tests','scripts']],['unit-integration',[bin('vitest','vitest.mjs'),'run']],['seed',[bin('tsx','dist/cli.mjs'),'scripts/build-seed-db.ts']],['build',[bin('electron-vite','bin/electron-vite.js'),'build']]];
if(!process.argv.includes('--e2e-only'))for(const [n,a]of all){if(process.argv.includes('--remaining')&&['typecheck','lint'].includes(n))continue;const ok=run(n,a);if(!ok&&['seed','build'].includes(n))process.exit(1);}
mkdirSync(join(root,'source/e2e'),{recursive:true});
for(const name of ['smoke','roles','signup','operations-flow','visual-check']){
 let s=readFileSync(join(snap,`tests/e2e/${name}.mjs`),'utf8').replaceAll("'./electron-launch.mjs'",JSON.stringify(pathToFileURL(join(snap,'tests/e2e/electron-launch.mjs')).href)).replaceAll('tests/.tmp',join(ev,'baseline-profiles').replaceAll('\\','/'));
 let target=join(root,'source/e2e',name+'.mjs');writeFileSync(target,s);run('e2e-'+name,[target]);
}
