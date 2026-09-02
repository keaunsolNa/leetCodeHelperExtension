<#
    클립보드에 있는 이미지를 파일로 저장한다.

    Win+Shift+S 로 화면 일부를 잘라 찍으면 클립보드에만 들어가고 파일이 남지 않는다.
    "다른 이름으로 저장" 대화상자를 거치지 않고 바로 떨구기 위한 스크립트다.

    사용법:
      # 캡처(Win+Shift+S) 직후
      powershell -NoProfile -ExecutionPolicy Bypass -File tools/grab-clip.ps1 shot1

    결과물:  dist/store/raw/{이름}.png
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Name
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Clipboard 는 STA 아파트먼트에서만 동작한다. powershell.exe 는 기본이 STA 지만
# 다른 호스트에서 부를 수도 있으니 확인하고 안내한다.
if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
    throw '클립보드를 읽으려면 STA 모드가 필요합니다. powershell.exe -File 로 실행하세요.'
}

# 클립보드는 다른 프로세스가 잠시 붙잡고 있으면 ExternalException 을 던진다.
# 흔한 일이라 몇 번 다시 시도한다.
$image = $null
for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
        $image = [System.Windows.Forms.Clipboard]::GetImage()
        break
    }
    catch [System.Runtime.InteropServices.ExternalException] {
        if ($attempt -eq 5) {
            throw "클립보드를 열지 못했습니다. 다른 프로그램이 사용 중일 수 있습니다. " +
                  "잠시 후 다시 시도하거나, 캡처를 파일로 직접 저장한 뒤 fit-screenshot.ps1 에 경로를 넘기세요."
        }
        Start-Sleep -Milliseconds 150
    }
}

if ($null -eq $image) {
    throw '클립보드에 이미지가 없습니다. Win+Shift+S 로 캡처한 직후에 실행하세요.'
}

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'dist\store\raw'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$dest = Join-Path $outDir ("{0}.png" -f ($Name -replace '[\\/:*?"<>|]', '_'))
$image.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host ("저장: {0} ({1}x{2})" -f $dest, $image.Width, $image.Height)
$image.Dispose()
