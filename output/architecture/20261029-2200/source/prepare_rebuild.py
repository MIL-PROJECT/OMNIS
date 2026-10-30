from pathlib import Path
p=Path(__file__).parent/'build/build.mjs';s=p.read_text(encoding='utf-8-sig');s=s.replace("'.20261029-2200-r4-pptx-validation.json'","'.'+path.basename(OUT)+'-pptx-validation.json'");p.write_text(s,encoding='utf8')
p=Path(__file__).with_name('finalize_docs.py');s=p.read_text(encoding='utf-8-sig');s=s.replace('from pathlib import Path','from pathlib import Path\nimport sys\nif "--visual-reviewed" not in sys.argv: raise SystemExit("먼저 SVG/PDF 전 페이지를 육안 확인하고 --visual-reviewed로 실행하십시오.")',1)
s=s.replace("validation=json.loads((O.parent/'.20261029-2200-r4-pptx-validation.json').read_text(encoding='utf8'))", "validation=next(v for p in sorted(O.parent.glob('.'+O.name+'*validation.json'),key=lambda p:p.stat().st_mtime,reverse=True) if (v:=json.loads(p.read_text(encoding='utf8'))).get('finalSha256')==hashlib.sha256((O/'OMNIS_시스템아키텍처_발표자료.pptx').read_bytes()).hexdigest())")
p.write_text(s,encoding='utf8')
