param([string]$Root)
$ErrorActionPreference='Stop'
$w=New-Object -ComObject Word.Application
try{
 $w.Visible=$true
 $w.DisplayAlerts=0
 Write-Output 'WORD_FINAL_OPEN'
 $d=$w.Documents.Open((Join-Path $Root 'OMNIS_운용개념기술서_제출본.docx'),$false,$true)
 $d.Repaginate()
 $pages=$d.ComputeStatistics(2)
 Set-Content -LiteralPath (Join-Path $Root 'evidence/word-reopen-text.txt') -Value $d.Content.Text -Encoding utf8
 @{opened=$true;pageCount=$pages;tableCount=$d.Tables.Count;inlineShapeCount=$d.InlineShapes.Count;applicationVersion=$w.Version;readOnly=$d.ReadOnly} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Root 'evidence/word-validation.json') -Encoding utf8
 $d.Close(0)
 Write-Output ('WORD_FINAL_PAGES='+$pages)
}finally{$w.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($w)}
