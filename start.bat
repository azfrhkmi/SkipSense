@echo off
title SkipSense Server
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\start_server.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Startup encountered an issue.
    pause
)

