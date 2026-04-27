@echo off
chcp 65001 >nul
title Antigravity ERP

cd /d "%~dp0"

echo =====================================================
echo  Antigravity ERP Server
echo =====================================================

:: Kill process on port 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (
    taskkill /f /pid %%a >NUL 2>&1
)
echo [OK] Port 3001 cleared

:: Start server in new window
echo [START] Launching server...
start "Antigravity ERP Server" cmd /k "node --experimental-sqlite server.js"

:: Wait then open browser
timeout /t 3 /nobreak >nul
echo [BROWSER] Opening http://localhost:3001
start "" "http://localhost:3001"

echo.
echo [DONE] Server is running. Login: admin / admin1234
echo.
pause
