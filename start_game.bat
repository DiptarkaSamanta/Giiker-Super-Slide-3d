@echo off
title GiiKER Super Slide 3D Launcher
color 0b

echo ========================================================
echo             GiiKER SUPER SLIDE 3D PUZZLE GAME
echo ========================================================
echo.
echo Starting local game server...
echo.

:: Open the default browser to the game
start "" http://localhost:8080

:: Check for Python
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Starting server with Python on port 8080...
    echo Press Ctrl+C to stop the game server when done.
    echo.
    python -m http.server 8080
    goto :end
)

:: Check for Node / npx
where npx >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Starting server with Node / npx serve on port 8080...
    echo Press Ctrl+C to stop the game server when done.
    echo.
    npx serve -l 8080 .
    goto :end
)

:: Fallback if neither is found in PATH: open directly in browser
echo Neither Python nor Node was found in PATH.
echo Opening index.html directly...
start "" "%~dp0index.html"

:end
pause

