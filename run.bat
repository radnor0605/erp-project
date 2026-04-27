@echo off
chcp 65001 >nul
title Antigravity ERP
cd /d "%~dp0"

set "BUNDLE_NODE=%~dp0_node\node-v24.14.1-win-x64\node.exe"
set "BUNDLE_NPM=%~dp0_node\node-v24.14.1-win-x64\npm.cmd"

if not exist "%BUNDLE_NODE%" (
    echo [ERROR] Bundled Node.js not found: %BUNDLE_NODE%
    pause
    exit /b 1
)
echo [OK] Node.js v24.14.1 (bundled)

if not exist "%~dp0node_modules\" (
    echo [INSTALL] Installing dependencies...
    call "%BUNDLE_NPM%" install --prefix "%~dp0"
    if errorlevel 1 ( pause ^& exit /b 1 )
)

if not exist "%~dp0.env" ( copy "%~dp0.env.example" "%~dp0.env" >nul )

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (taskkill /f /pid %%a >nul 2^>^&1)

echo [START] Launching server...
start "Antigravity ERP" cmd /k ""%BUNDLE_NODE%" --experimental-sqlite "%~dp0loader.js""

timeout /t 3 /nobreak >nul
start "" http://localhost:3001

echo [DONE] Login: admin / admin1234
pause
