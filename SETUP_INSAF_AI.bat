@echo off
setlocal enabledelayedexpansion
TITLE Insaaf AI - First-Time Local Setup
COLOR 0B

:: Switch working directory to batch file directory
cd /d "%~dp0"

echo ===================================================
echo          INSAAF AI FIRST-TIME SETUP SCRIPT         
echo ===================================================
echo.

:: 1. Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    COLOR 0C
    echo [ERROR] Node.js is missing!
    echo Please install Node.js (v18 or higher) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check npm
call npm --version >nul 2>&1
if errorlevel 1 (
    COLOR 0C
    echo [ERROR] npm command is missing!
    echo.
    pause
    exit /b 1
)

echo [1/3] Node.js and npm verified.
echo.

:: 3. Check / Install dependencies
echo [2/3] Checking project dependencies...
if not exist node_modules (
    echo Installing dependencies via npm install...
    call npm install
    if errorlevel 1 (
        COLOR 0C
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
) else (
    echo [OK] node_modules directory exists.
)
echo.

:: 4. Check Environment Configuration
echo [3/3] Checking environment variables...
if not exist .env copy .env.example .env >nul
echo [OK] .env file checked.

echo.
echo ===================================================
echo Insaaf AI local setup completed.
echo Double-click START_INSAF_AI.bat for daily launching.
echo ===================================================
echo.
pause
