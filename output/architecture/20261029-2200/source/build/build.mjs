import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Presentation, PresentationFile} from '@oai/artifact-tool';
process.env.RUNTIME_NODE_MODULES='C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const OUT=path.resolve(HERE,'../..');
const scenes=JSON.parse(await fs.readFile(path.join(OUT,'source/scenes.json'),'utf8'));
const model=JSON.parse(await fs.readFile(path.join(OUT,'source/architecture-model.json'),'utf8'));
const presentation=Presentation.create({slideSize:{width:scenes.width,height:scenes.height}});
for(const [i,scene] of scenes.slides.entries()) {
 const slide=presentation.slides.add();slide.background.fill='#FFFFFF';
 for(const o of scene.items) {
  if(o.type==='path'){
   for(let j=1;j<o.points.length;j++){
    const [x1,y1]=o.points[j-1], [x2,y2]=o.points[j];
    const conn=slide.shapes.add({geometry:'connector',name:o.id+'-'+j,kind:'straight',position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1),horizontalFlip:x2<x1,verticalFlip:y2<y1},line:{fill:o.color,width:2.4,style:o.dash?'dashed':'solid'},tail:j===o.points.length-1&&o.arrow?{type:'triangle',width:'sm',length:'sm'}:{type:'none'}});
    conn.bringToFront();
   }
  } else if(o.type==='rect') {
   slide.shapes.add({geometry:o.r?'roundRect':'rect',name:o.id,position:{left:o.x,top:o.y,width:o.w,height:o.h},fill:o.fill,line:{fill:o.stroke,width:1.5,style:o.dash?'dashed':'solid'},...(o.r?{borderRadius:o.r}:{})});
  } else if(o.type==='text') {
   const shape=slide.shapes.add({geometry:'textbox',name:o.id,position:{left:o.x,top:o.y,width:o.w,height:o.h},fill:'none',line:{fill:'none',width:0}});
   shape.text=o.text;shape.text.style={fontSize:o.size,typeface:scenes.font,bold:o.bold,color:o.color,alignment:o.align,verticalAlignment:'top',autoFit:'none',wrap:'none',insets:0};
  }
 }
 const refs=scene.sourceRefs.map(id=>model.sourceRefs.find(r=>r.id===id)).filter(Boolean);
 slide.speakerNotes.text=scene.notes+'\n\n[발표 시간 약 40~60초 / 소스 기준 '+model.analyzedAt+']\n\n소스 근거:\n'+refs.map(r=>r.id+' '+r.path+':'+r.lineStart+'-'+r.lineEnd+' '+r.meaning).join('\n');
}
const candidate=path.join(HERE,'candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(candidate);
console.log('candidate exported',candidate);
const SKILL='C:/Users/admin/.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(path.join(SKILL,'container_tools/artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({workspaceDir:path.resolve(OUT,'..'),candidatePath:candidate,finalPath:path.resolve(OUT,process.argv[2]??'OMNIS_시스템아키텍처_발표자료.pptx'),pythonExecutable:'C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','15240000,8572500','--validate-bullet-geometry','--validate-heading-fit'],explicitTotalSlideCount:6,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:['Malgun Gothic']},verifyArtifactToolImport:true,receiptPath:path.join(OUT,'..','.'+path.basename(OUT)+'-pptx-validation.json')});
console.log(JSON.stringify(result));




