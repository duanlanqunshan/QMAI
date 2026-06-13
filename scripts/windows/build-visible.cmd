@echo off
setlocal
title QMAI Portable Build
cd /d "%~dp0\..\.."

echo ========================================
echo QMAI Portable Build
echo ========================================
echo.
echo This window shows live build progress.
echo First Rust build can take 20-40 minutes.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-portable.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
    echo Build failed with exit code %EXIT_CODE%.
) else (
    echo Build finished successfully.
    echo Output: D:\QMAI\release-portable\QMaiWrite.exe
)
echo.
pause
exit /b %EXIT_CODE%
