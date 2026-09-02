<#
    Chrome 웹 스토어 업로드용 zip을 만든다.

    사용법:  powershell -NoProfile -ExecutionPolicy Bypass -File tools/package.ps1
    결과물:  dist/leetcode-helper-v{version}.zip

    스토어 패키지에는 런타임에 실제로 쓰이는 파일만 넣는다. .git, .idea, docs,
    tools, 512px 원본 아이콘은 심사에 불필요하고 용량만 키운다.
#>

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist '_stage'

# zip에 포함할 항목 (whitelist — 새 파일을 추가했다면 여기에도 넣을 것)
$include = @(
    'manifest.json',
    'background',
    'content',
    'options',
    'popup',
    'icons'
)

# icons 안에서 제외할 파일 (스토어 리스팅용 원본)
$excludeFiles = @('icon512.png')

$manifestPath = Join-Path $root 'manifest.json'
$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
Write-Host "LeetCode Helper v$version 패키징 중..."

# --- 무결성 검사: manifest가 가리키는 파일이 실제로 있는지 ---
$refs = @()
$refs += $manifest.background.service_worker
$refs += $manifest.options_ui.page
$refs += $manifest.action.default_popup
foreach ($cs in $manifest.content_scripts) { $refs += $cs.js }
foreach ($p in $manifest.icons.PSObject.Properties) { $refs += $p.Value }
foreach ($p in $manifest.action.default_icon.PSObject.Properties) { $refs += $p.Value }

$missing = @()
foreach ($ref in ($refs | Where-Object { $_ })) {
    if (-not (Test-Path (Join-Path $root $ref))) { $missing += $ref }
}
if ($missing.Count -gt 0) {
    throw "manifest.json이 참조하는 파일이 없습니다: $($missing -join ', ')"
}

# --- 스테이징 ---
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

foreach ($item in $include) {
    $src = Join-Path $root $item
    if (-not (Test-Path $src)) { throw "포함 대상이 없습니다: $item" }
    Copy-Item $src -Destination $stage -Recurse -Force
}

foreach ($name in $excludeFiles) {
    Get-ChildItem -Path $stage -Recurse -Filter $name -File | Remove-Item -Force
}

# --- 압축 ---
$zip = Join-Path $dist "leetcode-helper-v$version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal

Remove-Item $stage -Recurse -Force

$sizeKb = [math]::Round((Get-Item $zip).Length / 1KB, 1)
Write-Host ""
Write-Host "완료: $zip ($sizeKb KB)"
Write-Host "업로드: https://chrome.google.com/webstore/devconsole"
