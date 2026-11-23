@echo off
title Stop SkipSense
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\stop_server.ps1"
echo.
pause

