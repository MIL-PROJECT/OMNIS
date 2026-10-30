param([string]$Root)
$ErrorActionPreference='Stop'
$w=New-Object -ComObject Word.Application
try{
 $w.Visible=$false;$w.DisplayAlerts=0
 $d=$w.Documents.Open((Join-Path $Root 'OMNIS_운용개념기술서_제출본.docx'),$false,$true)
 $d.Repaginate();$n=$d.ComputeStatistics(2);$rows=@()
 for($i=1;$i -le $n;$i++){
  $s=$d.GoTo(1,1,$i).Start
  if($i -eq $n){$e=$d.Content.End}else{$e=$d.GoTo(1,1,($i+1)).Start}
  $tx=$d.Range($s,$e).Text
  $rows+=@{page=$i;chars=$tx.Length;first=$tx.Substring(0,[Math]::Min(75,$tx.Length));last=$tx.Substring([Math]::Max(0,$tx.Length-70))}
 }
 $rows | ConvertTo-Json | Set-Content (Join-Path $Root 'evidence/word-page-layout.json') -Encoding utf8
 $d.Close(0);Write-Output ('PAGES='+$n)
}finally{$w.Quit()}
