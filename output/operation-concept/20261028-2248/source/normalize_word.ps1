param([string]$Root)
$ErrorActionPreference='Stop'
$w=New-Object -ComObject Word.Application
try{
 $w.Visible=$false;$w.DisplayAlerts=0
 $d=$w.Documents.Open((Join-Path $Root 'OMNIS_운용개념기술서_제출본.docx'),$false,$true)
 $d.SaveAs2([string](Join-Path $Root 'source/word-normalized.docx'),16)
 $d.Close(0);Write-Output 'WORD_NORMALIZED'
}finally{$w.Quit()}
