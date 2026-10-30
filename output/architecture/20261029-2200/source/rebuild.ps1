param([string]$RepositoryRoot='C:/Users/admin/alex/alex_study/military_project')
$ErrorActionPreference='Stop'
$sourceRoot=$PSScriptRoot
$repoFull=[System.IO.Path]::GetFullPath($RepositoryRoot)
if(-not(Test-Path -LiteralPath (Join-Path $repoFull 'src/main/index.ts'))){throw 'OMNIS 저장소 경로를 확인하십시오.'}
$sourceCommit=(& git -C $repoFull rev-parse HEAD).Trim()
if($sourceCommit -ne 'ba829af630e080d9a078ea0ad9badfb28f4d2114'){throw '이 생성기는 분석한 commit 전용입니다. 새 코드의 구조·문구·근거를 먼저 다시 분석하십시오.'}
& git -C $repoFull diff --quiet HEAD
if($LASTEXITCODE -ne 0){throw '추적 파일이 변경되었습니다. 발표 문구·관계·검증 범위를 다시 분석한 후 생성기를 사용하십시오.'}
$runtimeBase='C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies'
$nodeRuntime=Join-Path $runtimeBase 'node/bin/node.exe'
$pythonRuntime=Join-Path $runtimeBase 'python/python.exe'
foreach($required in @($nodeRuntime,$pythonRuntime)){if(-not(Test-Path -LiteralPath $required)){throw "번들 런타임 없음: $required"}}
$localStamp=[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTimeOffset]::UtcNow,'Korea Standard Time').ToString('yyyyMMdd-HHmmss')
$newOut=Join-Path $repoFull "output/architecture/$localStamp"
if(Test-Path -LiteralPath $newOut){throw '같은 시각의 폴더가 있습니다. 잠시 후 다시 실행하십시오.'}
foreach($sub in @('source/build','evidence/rendered','details')){New-Item -ItemType Directory -Path (Join-Path $newOut $sub) -Force | Out-Null}
$codeFiles=@('analyze.py','make_scenes.py','verify.py','write_notes.py','finalize_docs.py','export_powerpoint.ps1','rebuild.ps1','package.py','build/build.mjs','build/render_svg.mjs')
foreach($rel in $codeFiles){Copy-Item -LiteralPath (Join-Path $sourceRoot $rel) -Destination (Join-Path $newOut "source/$rel")}
New-Item -ItemType Junction -Path (Join-Path $newOut 'source/build/node_modules') -Target (Join-Path $runtimeBase 'node/node_modules') | Out-Null
& $pythonRuntime -X utf8 (Join-Path $newOut 'source/analyze.py');if($LASTEXITCODE -ne 0){throw '소스 분석 실패'}
& $pythonRuntime -X utf8 (Join-Path $newOut 'source/make_scenes.py');if($LASTEXITCODE -ne 0){throw '장면 생성 실패'}
& $nodeRuntime (Join-Path $newOut 'source/build/build.mjs');if($LASTEXITCODE -ne 0){throw 'PPTX 검증 실패'}
& (Join-Path $newOut 'source/export_powerpoint.ps1')
& $nodeRuntime (Join-Path $newOut 'source/build/render_svg.mjs');if($LASTEXITCODE -ne 0){throw 'SVG 렌더 실패'}
& $pythonRuntime -X utf8 (Join-Path $newOut 'source/verify.py');if($LASTEXITCODE -ne 0){throw '산출물 검증 실패'}
& $pythonRuntime -X utf8 (Join-Path $newOut 'source/write_notes.py')
Write-Output "새 산출물: $newOut"
Write-Output 'SVG/PDF 6쪽 전체를 육안 확인한 뒤 finalize_docs.py --visual-reviewed, package.py를 실행하십시오.'
Write-Output '자동 구조 검사가 새 버전의 업무 사실·육안 검토·전체 프로그램 회귀를 보장하지 않습니다.'

