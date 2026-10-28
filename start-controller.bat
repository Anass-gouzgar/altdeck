@echo off
title TabDeck PC Controller
color 0B
echo ========================================================
echo    TabDeck - Android Tablet PC Stream Deck Controller
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "bin\pc-control.exe" (
    echo [*] Compiling native Windows hardware controller...
    powershell -ExecutionPolicy Bypass -File build-helper.ps1
)

echo [*] Starting TabDeck Server...
start "" "http://localhost:3000"
node server.js

pause
