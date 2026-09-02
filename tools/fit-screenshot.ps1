<#
    스토어 스크린샷을 규격에 맞춰 정확히 1280x800 (또는 640x400) 으로 만든다.

    웹 스토어는 이 두 크기만 받는다. 캡처한 이미지를 잘라내지 않고 비율을 유지한 채
    가운데 배치하고 남는 여백만 채운다. 잘라내면 UI 가 잘려 심사에 불리하다.

    사용법:
      powershell -NoProfile -ExecutionPolicy Bypass -File tools/fit-screenshot.ps1 shot1.png
      powershell -NoProfile -ExecutionPolicy Bypass -File tools/fit-screenshot.ps1 *.png -Small
      powershell -NoProfile -ExecutionPolicy Bypass -File tools/fit-screenshot.ps1 shot.png -Background '#1e1e1e'

    결과물:  dist/store/{원본이름}-1280x800.png
#>

param(
    # -File 로 실행하면 여러 경로가 각각 위치 인수로 넘어온다.
    # ValueFromRemainingArguments 가 있어야 두 번째 이후 경로까지 배열로 모인다.
    [Parameter(Mandatory = $true, Position = 0, ValueFromRemainingArguments = $true)]
    [string[]] $Path,

    # 640x400 로 만들고 싶을 때
    [switch] $Small,

    # 여백 색. 다크 테마로 캡처했다면 어두운 색을 주는 편이 자연스럽다.
    [string] $Background = '#ffffff'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if ($Small) { $tw, $th = 640, 400 } else { $tw, $th = 1280, 800 }

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'dist\store'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$hex = $Background.TrimStart('#')
if ($hex.Length -ne 6) { throw "-Background 는 #rrggbb 형식이어야 합니다: $Background" }
$bgColor = [System.Drawing.Color]::FromArgb(
    255,
    [Convert]::ToInt32($hex.Substring(0, 2), 16),
    [Convert]::ToInt32($hex.Substring(2, 2), 16),
    [Convert]::ToInt32($hex.Substring(4, 2), 16)
)

$files = @()
foreach ($p in $Path) { $files += Get-ChildItem -Path $p -File }
if ($files.Count -eq 0) { throw "이미지를 찾지 못했습니다: $($Path -join ', ')" }

foreach ($file in $files) {
    $src = [System.Drawing.Image]::FromFile($file.FullName)
    try {
        # 비율을 유지한 채 목표 크기 안에 들어가는 최대 크기
        $scale = [Math]::Min($tw / $src.Width, $th / $src.Height)
        $w = [int][Math]::Round($src.Width * $scale)
        $h = [int][Math]::Round($src.Height * $scale)
        $x = [int](($tw - $w) / 2)
        $y = [int](($th - $h) / 2)

        $canvas = New-Object System.Drawing.Bitmap($tw, $th, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $g = [System.Drawing.Graphics]::FromImage($canvas)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.Clear($bgColor)
        $g.DrawImage($src, (New-Object System.Drawing.Rectangle $x, $y, $w, $h))
        $g.Dispose()

        $name = "{0}-{1}x{2}.png" -f [System.IO.Path]::GetFileNameWithoutExtension($file.Name), $tw, $th
        $dest = Join-Path $outDir $name
        $canvas.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
        $canvas.Dispose()

        $note = if ($scale -gt 1) { ' (확대됨 - 가능하면 더 큰 해상도로 다시 캡처하세요)' } else { '' }
        Write-Host ("{0} ({1}x{2}) -> {3}{4}" -f $file.Name, $src.Width, $src.Height, $name, $note)
    }
    finally {
        $src.Dispose()
    }
}

Write-Host ""
Write-Host "저장 위치: $outDir"
Write-Host "업로드 전에 GitHub 토큰과 API 키가 화면에 보이지 않는지 확인하세요."
