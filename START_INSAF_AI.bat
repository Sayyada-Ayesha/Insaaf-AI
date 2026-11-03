@echo off
setlocal enabledelayedexpansion
TITLE Insaaf AI - Local Development Launcher
COLOR 0A

:: Switch working directory to batch file directory
cd /d "%~dp0"

echo ===================================================
echo             INSAAF AI LOCAL LAUNCHER              
echo ===================================================
echo.

:: 1. Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    COLOR 0C
    echo [ERROR] Node.js is not detected on your system PATH!
    echo Please ensure Node.js is installed on your Windows PC.
    echo Download: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check npm
call npm --version >nul 2>&1
if errorlevel 1 (
    COLOR 0C
    echo [ERROR] npm command is not detected on your system PATH!
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js and npm verified.
echo.

:: 3. Check node_modules
if not exist node_modules (
    echo [INFO] Dependencies missing. Installing via npm install...
    call npm install
    if errorlevel 1 (
        COLOR 0C
        echo [ERROR] npm install failed! Please check your internet connection.
        pause
        exit /b 1
    )
)

:: 4. Check .env configuration file
if not exist .env (
    copy .env.example .env >nul
    echo [INFO] Created .env from .env.example. No API key is needed - INSAaf runs its own
    echo        local model, so the copied defaults are ready to use as they are.
    echo.
)

:: 5. Kill any existing processes on ports 3000 and 3001
echo Checking for existing processes on ports 3000 and 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    echo [INFO] Killing existing process on port 3000 (PID: %%a)
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING" 2^>nul') do (
    echo [INFO] Killing existing process on port 3001 (PID: %%a)
    taskkill /PID %%a /F >nul 2>&1
)

:: 6. Launch Backend API Server
echo.
echo Starting Insaaf AI Backend API Server (Port 3001)...
start "Insaaf AI Backend API" cmd /k "cd /d "%~dp0" && npm run server"

:: 7. Wait for backend to become healthy
echo Waiting for Backend API to become ready...
set BACKEND_RETRIES=0
:BACKEND_WAIT
ping -n 2 127.0.0.1 >nul
curl -s http://localhost:3001/api/health >nul 2>&1
if errorlevel 1 (
    set /a BACKEND_RETRIES+=1
    if !BACKEND_RETRIES! geq 15 (
        echo [WARNING] Backend did not respond within 30 seconds. Continuing anyway...
        goto BACKEND_READY
    )
    goto :BACKEND_WAIT
)
echo [OK] Backend API is healthy on port 3001.
:BACKEND_READY

:: 8. Launch Frontend Dev Server
echo Starting Insaaf AI Frontend Development Server (Port 3000)...
start "Insaaf AI Dev Server" cmd /k "cd /d "%~dp0" && npm run dev"

:: 9. Wait until http://localhost:3000/ is responding before opening browser
echo Waiting for Frontend server to become ready at http://localhost:3000...
set FRONTEND_RETRIES=0
:WAIT_LOOP
ping -n 2 127.0.0.1 >nul
curl -s http://localhost:3000/ >nul 2>&1
if errorlevel 1 (
    set /a FRONTEND_RETRIES+=1
    if !FRONTEND_RETRIES! geq 30 (
        echo [WARNING] Frontend did not respond within 60 seconds.
        echo Please check the dev server window for errors.
        goto :END
    )
    goto :WAIT_LOOP
)

echo.
echo [SUCCESS] Both servers are online! Opening browser...
start "" http://localhost:3000/

:END
echo.
echo ===================================================
echo   Insaaf AI is running locally:
echo   Frontend:  http://localhost:3000/
echo   Backend:   http://localhost:3001/api/health
echo.
echo   Two CMD windows are running the servers.
echo   Close BOTH server windows to stop the app.
echo   You can safely close THIS launcher window.
echo ===================================================
echo.
pause
