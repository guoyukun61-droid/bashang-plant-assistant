@echo off
chcp 65001 >nul
title Bashang Plant Assistant - Start Public Access
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_public_access.ps1"
echo.
pause
