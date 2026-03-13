@echo off
title Yv Earn Server
color 2
cls

echo ========================================
echo        Yv Earn - Starting...
echo ========================================
echo.

cd /d "%~dp0"

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found!
    echo Please install from: https://nodejs.org
    echo.
    pause
    exit
)

echo [1/3] Starting server...
start "YvEarn" cmd /k "node server.js"

echo [2/3] Waiting for server...
timeout /t 5 /nobreak >nul

echo [3/3] Opening browser...
start http://localhost:8080/index.html

cls
echo ========================================
echo       Yv Earn is Running!
echo ========================================
echo.
echo APP: http://localhost:8080/index.html
echo.
echo KEEP THIS WINDOW OPEN!
echo.
pause
