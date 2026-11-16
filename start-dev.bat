@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 goto directory_error

where.exe npm.cmd >nul 2>&1
if errorlevel 1 goto node_missing

if not exist "node_modules\@tauri-apps\cli\package.json" goto dependencies_missing

echo Starting moligod in development mode...
echo Keep this window open while developing.
call npm.cmd run tauri dev
set "moligod_exit=%errorlevel%"
if not "%moligod_exit%"=="0" (
  echo.
  echo Startup failed. See the error above.
  pause
)
exit /b %moligod_exit%

:directory_error
echo Unable to enter the project directory.
pause
exit /b 1

:node_missing
echo Node.js and npm are required. Install Node.js, then try again.
pause
exit /b 1

:dependencies_missing
echo Dependencies are missing. Run npm ci in this project directory first.
pause
exit /b 1
