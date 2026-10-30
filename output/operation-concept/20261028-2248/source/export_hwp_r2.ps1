param([Parameter(Mandatory=$true)][string]$Root)
$ErrorActionPreference='Stop'
$base=Join-Path $Root 'source/final-hwp-r2'
$hwp=New-Object -ComObject HWPFrame.HwpObject
try {
 $hwp.XHwpWindows.Item(0).Visible=$true
 Write-Output 'OPEN_DOCX'
 if(-not $hwp.Open([string](Join-Path $Root 'source/word-normalized.docx'),'OOXML','')) { throw 'DOCX open failed' }
 $before=$hwp.GetTextFile('TEXT','')
 Set-Content -LiteralPath (Join-Path $Root 'evidence/hwp-import-text.txt') -Value $before -Encoding utf8
 Write-Output 'SAVE_HWP'
 if(-not $hwp.SaveAs(($base+'.hwp'),'HWP','')) { throw 'HWP save failed' }
 $pages=$hwp.PageCount
 $hwp.Clear(1)
 Write-Output 'REOPEN_HWP'
 if(-not $hwp.Open(($base+'.hwp'),'HWP','')) { throw 'HWP reopen failed' }
 $after=$hwp.GetTextFile('TEXT','')
 Set-Content -LiteralPath (Join-Path $Root 'evidence/hwp-reopen-text.txt') -Value $after -Encoding utf8
 Write-Output 'EXPORT_FINAL_PDF'
 if(-not $hwp.SaveAs(($base+'.pdf'),'PDF','')) { throw 'PDF export failed' }
 @{hwpOpen=$true;hwpReopen=$true;pdfExport=$true;pageCount=$pages;reopenedPageCount=$hwp.PageCount;textEqual=($before -eq $after);application='Hancom HWP 2022';at=(Get-Date -Format o)} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Root 'evidence/hwp-conversion.json') -Encoding utf8
 Write-Output ('HWP_PAGES='+$pages)
} finally {try {$hwp.Quit()}catch {};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($hwp)}



