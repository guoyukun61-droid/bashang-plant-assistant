$ErrorActionPreference = "Stop"
$serviceRoot = $PSScriptRoot
$projectRoot = Split-Path -Parent $serviceRoot

$settings = @{
    BIOCLIP_HOME = Join-Path $projectRoot "models\bioclip"
    BIOCLIP_ENGINE_HOME = ""
    BIOCLIP_ENGINE_VERSION = "1.7"
    BIOCLIP_DEVICE = "auto"
    BIOCLIP_TOP_K = "10"
    BIOCLIP_CPU_THREADS = "8"
    BIOCLIP_STRATEGY = "ensemble"
    BIOCLIP_PRIOR = "1"
    BIOCLIP_PRIOR_REGION = "broad_grassland"
    BIOCLIP_TTA = "0"
}

$localConfig = Join-Path $serviceRoot "bioclip.local.bat"
if (Test-Path -LiteralPath $localConfig) {
    foreach ($line in Get-Content -LiteralPath $localConfig -Encoding UTF8) {
        if ($line -match '^\s*set\s+"([^=]+)=(.*)"\s*$') {
            $settings[$matches[1]] = $matches[2]
        }
    }
}
if (-not $settings.BIOCLIP_ENGINE_HOME) {
    $settings.BIOCLIP_ENGINE_HOME = $settings.BIOCLIP_HOME
}
foreach ($item in $settings.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($item.Key, [string]$item.Value, "Process")
}
$env:PLANT_KNOWLEDGE_BASE = Join-Path $projectRoot "public\data\plants.json"
$env:PLANT_APP_ORIGINS = "http://127.0.0.1:5173,http://127.0.0.1:4173,https://bashangplantassistant.vercel.app"

Write-Host "正在加载 BioCLIP v$($settings.BIOCLIP_ENGINE_VERSION) ($($settings.BIOCLIP_DEVICE))..."
Set-Location -LiteralPath $serviceRoot
python -m uvicorn app:app --host 127.0.0.1 --port 8011
