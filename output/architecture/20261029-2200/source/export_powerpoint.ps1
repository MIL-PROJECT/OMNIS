$ErrorActionPreference='Stop'
$taskOut=Split-Path -Parent $PSScriptRoot
$inputDeck=Join-Path $taskOut 'OMNIS_시스템아키텍처_발표자료.pptx'
$outputPdf=Join-Path $taskOut 'OMNIS_시스템아키텍처_발표자료.pdf'
$appPpt=New-Object -ComObject PowerPoint.Application
$initialPptCount=$appPpt.Presentations.Count
$previousAlert=$appPpt.DisplayAlerts
$appPpt.DisplayAlerts=1
$deckPpt=$null
try {
  $deckPpt=$appPpt.Presentations.Open($inputDeck,-1,0,0)
  if($deckPpt.Slides.Count -ne 6){throw 'Expected 6 slides'}
  $deckPpt.SaveAs($outputPdf,32,0)
  $metrics=@()
  for($i=1;$i -le $deckPpt.Slides.Count;$i++){
    $slidePpt=$deckPpt.Slides.Item($i)
    $slidePpt.Export((Join-Path $taskOut "evidence/rendered/powerpoint-$i.png"),'PNG',1920,1080)
    $metrics+=@{slide=$i;shapes=$slidePpt.Shapes.Count}
  }
  @{application='Microsoft PowerPoint COM';opened=$inputDeck;exported=$outputPdf;slides=$deckPpt.Slides.Count;shapeCounts=$metrics;exportedAt=[DateTimeOffset]::Now.ToString('o')} | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $taskOut 'evidence/powerpoint-export.json')
  Write-Output "PowerPoint PDF exported: $outputPdf"
} finally {
  if($deckPpt){$deckPpt.Close()}
  $appPpt.DisplayAlerts=$previousAlert
  if($initialPptCount -eq 0){$appPpt.Quit()}
  [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($appPpt) | Out-Null
}

