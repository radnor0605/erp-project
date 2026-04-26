@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Antigravity ERP

cd /d "%~dp0"

echo.
echo  =====================================================
echo   Antigravity ERP - Starting...
echo  =====================================================
echo.

set BUNDLE_DIR=%~dp0_node\node-v22.22.2-win-x64
set BUNDLE_NODE=!BUNDLE_DIR!\node.exe
set BUNDLE_NPM=!BUNDLE_DIR!\npm.cmd

:: 1. Determine node.exe (system v22+ preferred, else bundled)
set NODE_EXE=
set SYS_NODE_OK=0
where node >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=1 delims=v." %%V in ('node -v 2^>nul') do set NODE_MAJOR=%%V
    if !NODE_MAJOR! geq 22 set SYS_NODE_OK=1
)

if "!SYS_NODE_OK!"=="1" (
    set NODE_EXE=node
    for /f %%V in ('node -v') do echo [OK] System Node.js %%V
    goto CHECK_MODULES
)

if exist "!BUNDLE_NODE!" (
    set NODE_EXE=!BUNDLE_NODE!
    echo [OK] Bundled Node.js v22.22.2
    goto CHECK_MODULES
)

echo [ERROR] Node.js not found. Install from https://nodejs.org
pause
exit /b 1

:: 2. node_modules check
:CHECK_MODULES
if not exist "node_modules\" (
    echo [SETUP] Installing packages... (first run only)
    call "!BUNDLE_NPM!" install
    if !errorlevel! neq 0 (
        echo [ERROR] Package install failed.
        pause
        exit /b 1
    )
    echo [OK] Packages installed.
) else (
    echo [OK] Packages ready.
)

:: 3. Create .env if missing
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo [INFO] .env created from example. Fill in API keys before use.
    echo.
)

:: 4. Clear port 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (
    taskkill /f /pid %%a >NUL 2>&1
)
echo [OK] Port 3001 ready.

:: 5. Start server (loader.js ? compiled entry point)
echo [START] Launching server...
start "Antigravity ERP Server" cmd /k ""!NODE_EXE!" --experimental-sqlite loader.js"

:: 6. Open browser
timeout /t 3 /nobreak >nul
start "" "http://localhost:3001"

echo.
echo  =====================================================
echo   Server running at http://localhost:3001
echo   Login: admin / admin1234
echo  =====================================================
echo.
pause