param(
    [string]$OutputDir = "C:\Users\gyk11\Desktop\S-A-M-R"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutputRoot = [System.IO.Path]::GetFullPath($OutputDir)
$Stage = Join-Path $ProjectRoot "tmp\iplant-export-stage"
$Archive = Join-Path $OutputRoot "bashang_plant_knowledgebase_iplant_enriched_20260714.zip"

if (-not $Stage.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "暂存目录不在项目内: $Stage"
}
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
if (Test-Path -LiteralPath $Stage) { Remove-Item -LiteralPath $Stage -Recurse -Force }
if (Test-Path -LiteralPath $Archive) { Remove-Item -LiteralPath $Archive -Force }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

$PackageRoot = Join-Path $Stage "bashang_plant_knowledgebase_iplant_enriched_20260714"
New-Item -ItemType Directory -Force -Path $PackageRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PackageRoot "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PackageRoot "scripts") | Out-Null

foreach ($file in @("plants.json", "iplantEnrichment.json", "catalogSummary.json", "featureIndex.json", "glossary.json", "captureChecklist.json")) {
    Copy-Item -LiteralPath (Join-Path $ProjectRoot "public\data\$file") -Destination (Join-Path $PackageRoot "data\$file")
}
$Excel = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "release") -Filter "*iPlant*20260714.xlsx" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $Excel) { throw "iPlant enriched Excel was not found." }
Copy-Item -LiteralPath $Excel.FullName -Destination (Join-Path $PackageRoot "knowledgebase_iplant_enriched.xlsx")
$Guide = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "docs") -Filter "*iPlant*.md" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $Guide) { throw "iPlant export guide was not found." }
Copy-Item -LiteralPath $Guide.FullName -Destination (Join-Path $PackageRoot "README.md")
Copy-Item -LiteralPath (Join-Path $ProjectRoot "scripts\enrich_from_iplant.py") -Destination (Join-Path $PackageRoot "scripts")

$Files = Get-ChildItem -LiteralPath $PackageRoot -File -Recurse
$Manifest = foreach ($File in $Files) {
    $Relative = $File.FullName.Substring($PackageRoot.Length + 1)
    $Hash = (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash
    "$Hash  $Relative"
}
$Manifest | Set-Content -LiteralPath (Join-Path $PackageRoot "SHA256SUMS.txt") -Encoding utf8

Compress-Archive -LiteralPath $PackageRoot -DestinationPath $Archive -CompressionLevel Optimal
$ArchiveHash = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash
$Info = [pscustomobject]@{
    Archive = $Archive
    SizeMB = [math]::Round((Get-Item -LiteralPath $Archive).Length / 1MB, 2)
    SHA256 = $ArchiveHash
}
$Info | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputRoot "bashang_plant_knowledgebase_iplant_enriched_20260714_checksum.json") -Encoding utf8
Remove-Item -LiteralPath $Stage -Recurse -Force
$Info
