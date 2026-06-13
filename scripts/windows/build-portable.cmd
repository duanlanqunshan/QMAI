@echo off
REM QMAI Windows build entry script
REM Usage: scripts\windows\build-portable.cmd [options]
REM Options:
REM   -visible  launch app after build
REM   -clean    clean before build
REM   -debug    debug mode

cd /d "%~dp0\..\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-portable.ps1" %*
