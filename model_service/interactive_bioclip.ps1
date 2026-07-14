$ErrorActionPreference = "Stop"
$ServiceRoot = $PSScriptRoot
$Python = Join-Path $ServiceRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $Python)) { $Python = "python" }

try {
    $Health = Invoke-RestMethod -Uri "http://127.0.0.1:8011/health" -TimeoutSec 5
    if (-not $Health.modelReady) { throw "Model is not ready." }
} catch {
    Write-Host "BioCLIP service is not ready. Start model_service\start_bioclip.ps1 first." -ForegroundColor Yellow
    exit 1
}

Set-Location -LiteralPath $ServiceRoot
& $Python "interactive_cli.py" --interactive
