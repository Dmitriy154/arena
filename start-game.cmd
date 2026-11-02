@echo off
setlocal
title Arena
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js with npm is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

echo Starting the dev server and opening the game in your browser...
echo Close this window to stop the server.
echo.

call npm run dev -- --open
if errorlevel 1 (
  echo The dev server stopped with an error.
  pause
)
