@echo off
REM PlayPlay — first-run setup launcher (Windows)
setlocal
cd /d "%~dp0..\.."
node scripts\setup.mjs %*
pause
