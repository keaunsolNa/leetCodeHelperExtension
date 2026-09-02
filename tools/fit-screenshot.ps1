<#
    스토어 스크린샷을 규격에 맞춰 정확히 1280x800 (또는 640x400) 으로 만든다.

    웹 스토어는 이 두 크기만 받는다. 캡처한 이미지를 잘라내지 않고 비율을 유지한 채
    가운데 배치하고 남는 여백만 채운다. 잘라내면 UI 가 잘려 심사에 불리하다.

    스토어에는 스크린샷별 설명란이 없다. 그래서 -Caption 으로 이미지 안에
    문구를 구워 넣을 수 있게 했다.

    사용법:
      # 그대로 규격만 맞추기
      powershell -NoProfile -ExecutionPolicy Bypass -File tools/fit-screenshot.ps1 shot1.png

      # 캡션 + 프레임 (순서대로 짝지어진다)
      powershell -NoProfile -ExecutionPolicy Bypass -File tools/fit-screenshot.ps1 `
          shot1.png shot2.png -Frame `
          -Caption '정답을 맞히면 자동으로 GitHub에 커밋','토큰 없이 버튼 한 번으로 연결'

      # 다크 테마로 캡처했을 때
      powershell -NoProfile -ExecutionPolicy Bypass -File tools/fit-screenshot.ps1 shot.png -Frame -Background '#111827'

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
    [string] $Background = '#ffffff',

    # 이미지 위에 구워 넣을 문구. 입력 파일 순서대로 짝지어진다.
    [string[]] $Caption,

    # 캡처를 안쪽으로 물리고 둥근 모서리와 그림자를 넣는다.
    [switch] $Frame
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if ($Small) { $tw, $th = 640, 400 } else { $tw, $th = 1280, 800 }
$scaleUi = $tw / 1280.0   # 640x400 일 때 여백과 글자를 같은 비율로 줄인다

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'dist\store'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

function ConvertTo-Color([string] $value) {
    $hex = $value.TrimStart('#')
    if ($hex.Length -ne 6) { throw "색상은 #rrggbb 형식이어야 합니다: $value" }
    [System.Drawing.Color]::FromArgb(
        255,
        [Convert]::ToInt32($hex.Substring(0, 2), 16),
        [Convert]::ToInt32($hex.Substring(2, 2), 16),
        [Convert]::ToInt32($hex.Substring(4, 2), 16)
    )
}

function New-RoundedPath([int] $x, [int] $y, [int] $w, [int] $h, [int] $r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = 2 * $r
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    $p
}

$bgColor = ConvertTo-Color $Background
# 배경 밝기에 따라 글자색을 고른다. 밝은 배경에 흰 글씨를 쓰면 읽을 수 없다.
$luminance = (0.299 * $bgColor.R + 0.587 * $bgColor.G + 0.114 * $bgColor.B) / 255
$textColor = if ($luminance -gt 0.6) { [System.Drawing.Color]::FromArgb(255, 17, 24, 39) }
             else { [System.Drawing.Color]::White }

$files = @()
foreach ($p in $Path) { $files += Get-ChildItem -Path $p -File }
if ($files.Count -eq 0) { throw "이미지를 찾지 못했습니다: $($Path -join ', ')" }

if ($Caption -and $Caption.Count -ne $files.Count) {
    Write-Warning "캡션 $($Caption.Count)개 / 이미지 $($files.Count)장 — 짝이 맞지 않는 이미지는 캡션 없이 나갑니다."
}

$index = 0
foreach ($file in $files) {
    $text = if ($Caption -and $index -lt $Caption.Count) { $Caption[$index] } else { $null }
    $index++

    $src = [System.Drawing.Image]::FromFile($file.FullName)
    try {
        $canvas = New-Object System.Drawing.Bitmap($tw, $th, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $g = [System.Drawing.Graphics]::FromImage($canvas)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
        $g.Clear($bgColor)

        # 캡션과 여백이 차지할 영역을 먼저 떼어 놓고, 남는 자리에 캡처를 맞춘다
        $margin = if ($Frame) { [int](56 * $scaleUi) } else { 0 }
        $capH = if ($text) { [int](104 * $scaleUi) } else { 0 }

        $areaX = $margin
        $areaY = $capH + $margin
        $areaW = $tw - 2 * $margin
        $areaH = $th - $capH - 2 * $margin
        if ($areaW -le 0 -or $areaH -le 0) { throw '여백이 너무 큽니다.' }

        if ($text) {
            $fontSize = [single](30 * $scaleUi)
            $font = New-Object System.Drawing.Font('Malgun Gothic', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
            $fmt = New-Object System.Drawing.StringFormat
            $fmt.Alignment = [System.Drawing.StringAlignment]::Center
            $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
            $brush = New-Object System.Drawing.SolidBrush $textColor
            $rect = New-Object System.Drawing.RectangleF(
                [single]($margin), [single]0, [single]($tw - 2 * $margin), [single]$capH)
            $g.DrawString($text, $font, $brush, $rect, $fmt)
            $brush.Dispose(); $font.Dispose(); $fmt.Dispose()
        }

        $scale = [Math]::Min($areaW / $src.Width, $areaH / $src.Height)
        $w = [int][Math]::Round($src.Width * $scale)
        $h = [int][Math]::Round($src.Height * $scale)
        $x = $areaX + [int](($areaW - $w) / 2)
        $y = $areaY + [int](($areaH - $h) / 2)

        if ($Frame) {
            # 반투명 사각형을 조금씩 넓혀 그려 부드러운 그림자를 흉내낸다.
            for ($i = 6; $i -ge 1; $i--) {
                $alpha = [int](7 * (7 - $i))
                $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 0, 0, 0))
                $sp = New-RoundedPath ($x - $i) ($y - $i + 3) ($w + 2 * $i) ($h + 2 * $i) ([int](12 * $scaleUi) + $i)
                $g.FillPath($shadow, $sp)
                $sp.Dispose(); $shadow.Dispose()
            }
            $clip = New-RoundedPath $x $y $w $h ([int](12 * $scaleUi))
            $g.SetClip($clip)
            $g.DrawImage($src, (New-Object System.Drawing.Rectangle $x, $y, $w, $h))
            $g.ResetClip()
            $clip.Dispose()
        }
        else {
            $g.DrawImage($src, (New-Object System.Drawing.Rectangle $x, $y, $w, $h))
        }

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
