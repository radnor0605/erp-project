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

:: 번들 Node.js v22.22.2 고정 사용 (.jsc 컴파일 버전과 일치)
set BUNDLE_DIR=%~dp0_node\node-v22.22.2-win-x64
set BUNDLE_NODE=!BUNDLE_DIR!\node.exe
set BUNDLE_NPM=!BUNDLE_DIR!\npm.cmd

if not exist "!BUNDLE_NODE!" (
    echo [ERROR] Bundled Node.js not found.
    echo         _node\node-v22.22.2-win-x64\node.exe 가 없습니다.
    echo         설치 패키지를 다시 확인하세요.
    pause
    exit /b 1
)

for /f %%V in ('"!BUNDLE_NODE!" -v') do echo [OK] Node.js %%V (bundled)

:: node_modules 확인
if not exist "node_modules\" (
    echo [SETUP] 패키지 설치 중... (최초 1회)
    call "!BUNDLE_NPM!" install
    if !errorlevel! neq 0 (
        echo [ERROR] 패키지 설치 실패.
        pause
        exit /b 1
    )
    echo [OK] 패키지 설치 완료.
) else (
    echo [OK] 패키지 준비 완료.
)

:: .env 없으면 example에서 생성
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo [INFO] .env 파일 생성됨. API 키를 입력 후 재시작하세요.
    echo.
)

:: 포트 3001 정리
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (
    taskkill /f /pid %%a >NUL 2>&1
)
echo [OK] 포트 3001 준비 완료.

:: 서버 시작
echo [START] 서버 실행 중...
start "Antigravity ERP Server" cmd /k ""!BUNDLE_NODE!" --experimental-sqlite loader.js"

:: 브라우저 열기
timeout /t 3 /nobreak >nul
start "" "http://localhost:3001"

echo.
echo  =====================================================
echo   서버 실행 중: http://localhost:3001
echo   로그인: admin / admin1234
echo  =====================================================
echo.
pause