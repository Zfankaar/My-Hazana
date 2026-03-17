@echo off
TITLE Hazana App Server
COLOR 0B

echo.
echo  ========================================
echo       HAZANA APP - LOCAL SERVER
echo  ========================================
echo.

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit
)

echo [INFO] Starting local server...
echo [INFO] Do not close this window while using the app.
echo.

:: Open browser after a short delay
start "" "http://localhost:8080/index.html"

:: Run the server
node server.js

pause
