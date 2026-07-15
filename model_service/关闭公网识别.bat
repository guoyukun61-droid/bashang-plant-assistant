@echo off
chcp 65001 >nul
title Bashang Plant Assistant - Stop Public Access
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop_public_access.ps1"
echo.
pause
