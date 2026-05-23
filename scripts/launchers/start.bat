@echo off
REM PlayPlay — start launcher (Windows)
setlocal
cd /d "%~dp0..\.."

REM A real install has both the stamp and a .env; if either is missing,
REM defer to the wizard (which will configure / build as needed).
if not exist "packages\server\.playplay-configured" (
  node scripts\setup.mjs
  goto :eof
)
if not exist "packages\server\.env" (
  node scripts\setup.mjs
  goto :eof
)
if not exist "packages\server\dist\index.js" (
  node scripts\setup.mjs
  goto :eof
)

set PORT=3001
for /f "usebackq tokens=2 delims==" %%A in (`findstr /b "PORT=" "packages\server\.env"`) do set PORT=%%A

REM Open browser shortly after starting the server.
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:%PORT%/admin"

node packages\server\dist\index.js
