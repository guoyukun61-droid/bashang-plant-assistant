[CmdletBinding()]
param(
    [switch]$SkipDeploy,
    [ValidateSet("auto", "http2", "quic")]
    [string]$Protocol = "http2"
)

$ErrorActionPreference = "Stop"
$serviceRoot = $PSScriptRoot
$projectRoot = Split-Path -Parent $serviceRoot
$cloudflared = Join-Path $env:USERPROFILE ".local\cloudflared\cloudflared.exe"
$logRoot = Join-Path $projectRoot "tmp\public-access"
$runtimeFile = Join-Path $logRoot "current.json"

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-Health([string]$Url, [int]$TimeoutSeconds = 10) {
    try {
        return Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSeconds
    } catch {
        return $null
    }
}

function Wait-ForHealth([string]$Url, [int]$TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $health = Get-Health $Url
        if ($health -and $health.modelReady) {
            return $health
        }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    return $null
}

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

Write-Step "Checking local BioCLIP service"
$localHealthUrl = "http://127.0.0.1:8011/health"
$localHealth = Get-Health $localHealthUrl 5
if (-not ($localHealth -and $localHealth.modelReady)) {
    Write-Host "The local service is offline. Starting BioCLIP; first load may take several minutes."
    $modelStamp = Get-Date -Format "yyyyMMdd-HHmmss"
    Start-Process -FilePath "powershell.exe" `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $serviceRoot "start_bioclip.ps1")) `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logRoot "model-stdout-$modelStamp.log") `
        -RedirectStandardError (Join-Path $logRoot "model-stderr-$modelStamp.log") | Out-Null
    $localHealth = Wait-ForHealth $localHealthUrl 360
}
if (-not $localHealth) {
    throw "BioCLIP did not start. Check the model logs under $logRoot."
}
Write-Host "BioCLIP v$($localHealth.engineVersion) is ready with $($localHealth.catalogSize) catalog labels." -ForegroundColor Green

if (-not (Test-Path -LiteralPath $cloudflared)) {
    throw "cloudflared was not found at $cloudflared"
}

Write-Step "Stopping stale temporary tunnels for port 8011"
Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "cloudflared.exe" -and $_.CommandLine -match "tunnel" -and $_.CommandLine -match "127\.0\.0\.1:8011"
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
}
Start-Sleep -Seconds 2

Write-Step "Creating a Cloudflare Quick Tunnel"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stdout = Join-Path $logRoot "tunnel-stdout-$stamp.log"
$stderr = Join-Path $logRoot "tunnel-stderr-$stamp.log"
$tunnelProcess = Start-Process -FilePath $cloudflared `
    -ArgumentList @("tunnel", "--url", "http://127.0.0.1:8011", "--protocol", $Protocol, "--no-autoupdate") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru

$tunnelUrl = $null
$deadline = (Get-Date).AddMinutes(2)
do {
    Start-Sleep -Seconds 3
    $logText = (Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) +
        (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue)
    $match = [regex]::Match($logText, "https://[a-z0-9-]+\.trycloudflare\.com")
    if ($match.Success) {
        $tunnelUrl = $match.Value
        break
    }
    if ($tunnelProcess.HasExited) {
        throw "cloudflared exited. Check $stderr."
    }
} while ((Get-Date) -lt $deadline)

if (-not $tunnelUrl) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    throw "No temporary hostname was generated. Check $stderr."
}

$publicHealth = Wait-ForHealth "$tunnelUrl/health" 90
if (-not $publicHealth) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    throw "The public health check failed. Confirm that TCP or UDP port 7844 is allowed."
}
Write-Host "The public model service is ready: $tunnelUrl" -ForegroundColor Green

[ordered]@{
    tunnelUrl = $tunnelUrl
    processId = $tunnelProcess.Id
    protocol = $Protocol
    startedAt = (Get-Date).ToString("s")
    localHealthUrl = $localHealthUrl
    publicHealthUrl = "$tunnelUrl/health"
    visionApiUrl = "$tunnelUrl/v1/identify"
} | ConvertTo-Json | Set-Content -LiteralPath $runtimeFile -Encoding UTF8

if (-not $SkipDeploy) {
    Write-Step "Updating the Vercel production environment and redeploying"
    if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
        throw "Vercel CLI was not found. Install it or use -SkipDeploy to create only the tunnel."
    }
    & vercel env add VITE_VISION_API_URL production --value "$tunnelUrl/v1/identify" --force --no-sensitive --yes
    if ($LASTEXITCODE -ne 0) { throw "Failed to update VITE_VISION_API_URL." }
    & vercel env add VITE_MODEL_HEALTH_URL production --value "$tunnelUrl/health" --force --no-sensitive --yes
    if ($LASTEXITCODE -ne 0) { throw "Failed to update VITE_MODEL_HEALTH_URL." }
    & vercel --prod --yes
    if ($LASTEXITCODE -ne 0) { throw "The Vercel deployment failed." }
}

Write-Host "`nPublic access is ready." -ForegroundColor Green
Write-Host "Model health: $tunnelUrl/health"
if (-not $SkipDeploy) {
    Write-Host "Production site: https://bashangplantassistant.vercel.app"
}
Write-Host "Runtime details: $runtimeFile"
