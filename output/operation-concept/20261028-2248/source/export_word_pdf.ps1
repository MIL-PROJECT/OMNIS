param([string]$Root)
$ErrorActionPreference='Stop'
$w=New-Object -ComObject Word.Application
try{
 $w.Visible=$true;$w.DisplayAlerts=0
 $d=$w.Documents.Open((Join-Path $Root 'OMNIS_운용개념기술서_제출본.docx'),$false,$true)
 $d.Repaginate()
 Write-Output 'WORD_PDF_SAVEAS_BEGIN'
 $p=Join-Path $Root 'evidence/docx-native.pdf'
 $fmt=17
 $d.SaveAs2([string]$p,17)
 Write-Output 'WORD_PDF_SAVEAS_OK'
 $d.Close(0)
}finally{try{$w.Quit()}catch{}}

