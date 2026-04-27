@echo off
chcp 65001 >nul
title Antigravity ERP

cd /d "%~dp0"

echo.
echo  =====================================================
echo   Antigravity ERP  -  Starting...
echo  =====================================================
echo.

:: Node.js v24.14.1 bundled path
set "BUNDLE_NODE=%~dp0_node\node-v24.14.1-win-x64\node.exe"
set "BUNDLE_NPM=%~dp0_node\node-v24.14.1-win-x64\npm.cmd"

if not exist "%BUNDLE_NODE%" (
    echo [ERROR] Bundled Node.js not found.
    echo         Please reinstall from the distribution package.
    pause
    exit /b 1
)
echo [OK] Node.js v24.14.1 (bundled)

:: node_modules check
if not exist "%~dp0node_modules\" (
    echo [SETUP] Installing packages... (first run only^)
    call "%BUNDLE_NPM%" install
    if errorlevel 1 (
        echo [ERROR] Package install failed.
        pause
        exit /b 1
    )
    echo [OK] Packages installed.
) else (
    echo [OK] Packages ready.
)

:: Create .env if missing
if not exist "%~dp0.env" (
    copy "%~dp0.env.example" "%~dp0.env" >nul
    echo [INFO] .env created. Fill in API keys before use.
)

:: Clear port 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo [OK] Port 3001 ready.

:: Start server with bundled Node.js v24.14.1
echo [START] Launching server...
start "Antigravity ERP" cmd /k ""%BUNDLE_NODE%" --experimental-sqlite "%~dp0loader.js""

:: Open browser after 3 seconds
timeout /t 3 /nobreak >nul
start "" http://localhost:3001

echo.
echo  =====================================================
echo   Server: http://localhost:3001
echo   Login:  admin / admin1234
echo  =====================================================
echo.
pause