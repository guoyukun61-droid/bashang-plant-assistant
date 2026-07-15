[CmdletBinding()]
param([switch]$IncludeModel)

$ErrorActionPreference = "Stop"
$stopped = 0

Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "cloudflared.exe" -and $_.CommandLine -match "tunnel" -and $_.CommandLine -match "127\.0\.0\.1:8011"
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    $stopped++
}

if ($IncludeModel) {
    $listeners = Get-NetTCPConnection -LocalPort 8011 -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
        if ($process.Name -eq "python.exe" -and $process.CommandLine -match "uvicorn app:app") {
            Stop-Process -Id $process.ProcessId -Force
            $stopped++
        }
    }
}

Write-Host "Stopped $stopped Bashang plant service process(es)."
