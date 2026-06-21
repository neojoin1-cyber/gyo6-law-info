@echo off
setlocal
cd /d "%~dp0.."
if not exist logs mkdir logs
set "PHASE=%~1"
if "%PHASE%"=="" set "PHASE=all"
echo [%date% %time%] GYO6 policy quality phase=%PHASE% >> logs\policy-quality-nightly.log
node tools\policy-quality-nightly.mjs %PHASE% >> logs\policy-quality-nightly.log 2>&1
exit /b %ERRORLEVEL%
