@echo off
echo ===================================
echo Math Schedule Manager Build
echo ===================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install from https://nodejs.org
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)

echo.
echo [2/3] Building app...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo [3/3] Done!
echo.
echo ===================================
echo Build complete!
echo.
echo Output folder: dist\win-unpacked
echo.
echo To distribute:
echo 1. Copy the entire "win-unpacked" folder
echo 2. Or zip it and share
echo.
echo Run: dist\win-unpacked\MathScheduleManager.exe
echo ===================================
echo.

start "" "dist\win-unpacked"
pause
