# QMAI Windows portable build script
# Requires Rust and Node.js

param(
    [switch]$Visible,
    [switch]$Clean,
    [switch]$Debug
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $ProjectRoot
$env:PATH = "$env:USERPROFILE\.cargo\bin;D:\QMAI\tools\protoc\bin;$env:PATH"
$env:PROTOC = "D:\QMAI\tools\protoc\bin\protoc.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "QMAI Portable Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Detect Windows SDK
$WindowsSdkDir = "D:\Windows Kits\10"
$WindowsSdkVersion = "10.0.26100.0"
$VcVarsBat = "$env:ProgramFiles\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
if (-not (Test-Path $VcVarsBat)) {
    $VcVarsBat = "G:\Visual Studio 2022\VC\Auxiliary\Build\vcvars64.bat"
}

if (Test-Path $VcVarsBat) {
    Write-Host "[1/4] Setting Visual Studio environment..." -ForegroundColor Yellow
    $env:WindowsSdkDir = $WindowsSdkDir
    $env:WindowsSDKVersion = $WindowsSdkVersion
    & "$VcVarsBat" > $null
} else {
    Write-Host "[1/4] Warning: vcvars64.bat not found, skipping SDK setup" -ForegroundColor Yellow
}

# Clean build artifacts
if ($Clean) {
    Write-Host "[2/4] Cleaning build artifacts..." -ForegroundColor Yellow
    if (Test-Path "src-tauri/target") {
        Remove-Item -Recurse -Force "src-tauri/target" -ErrorAction SilentlyContinue
    }
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
    }
    if (Test-Path "release-portable") {
        Remove-Item -Recurse -Force "release-portable" -ErrorAction SilentlyContinue
    }
}

# Cargo optimization settings
$env:CARGO_PROFILE_RELEASE_LTO = "false"
$env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS = "16"
$env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "1"

# Extra diagnostics for PowerShell 5.1
$env:RUST_BACKTRACE = "1"

Write-Host "[3/4] Building frontend and Tauri app..." -ForegroundColor Yellow
Write-Host "       (First Rust build may take a long time)" -ForegroundColor Gray
Write-Host "       PROTOC: $env:PROTOC" -ForegroundColor Gray

# Build frontend first, then Tauri
if ($Debug) {
    Write-Host "       Debug mode enabled" -ForegroundColor Gray
    $env:CARGO_PROFILE_RELEASE_OPT_LEVEL = "0"
    $env:RUST_LOG = "debug"
}

try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Frontend build failed. Exit code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    npx tauri build --no-bundle
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Tauri build failed. Exit code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "Build error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "[4/4] Packaging portable build..." -ForegroundColor Yellow
node scripts/build-portable.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Packaging failed. Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
$exePath = "D:\QMAI\release-portable\QMaiWrite.exe"
if (Test-Path $exePath) {
    $fileInfo = Get-Item $exePath
    Write-Host "Output: $exePath" -ForegroundColor White
    Write-Host "Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor White
    Write-Host "Time: $($fileInfo.LastWriteTime)" -ForegroundColor White

    if ($Visible) {
        Write-Host ""
        Write-Host "Launching app..." -ForegroundColor Cyan
        Start-Process $exePath
    }
} else {
    Write-Host "Warning: output file not found: $exePath" -ForegroundColor Yellow
}
