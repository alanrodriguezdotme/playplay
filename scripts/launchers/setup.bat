@echo off
REM PlayPlay Venue — first-run setup launcher (Windows)
setlocal
cd /d "%~dp0..\.."
node scripts\setup.mjs %*
pause
