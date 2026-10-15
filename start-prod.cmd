@echo off
rem ===========================================================
rem  FAM asset management system - production launcher
rem  Called by Windows Scheduled Task "FAM-Asset-Server" (as SYSTEM)
rem  Deploy dir: C:/fam      Port: 8001
rem  NOTE: keep this file CRLF + ASCII; LF-only breaks cmd.exe parsing
rem ===========================================================
setlocal
cd /d "%~dp0"

set NODE_ENV=production
set HOST=0.0.0.0
set PORT=8001
set DATABASE_URL=file:./dev.db

rem JWT secret lives only in ecosystem.env.cjs (not committed)
for /f "usebackq delims=" %%s in (`node -e "console.log(require('./ecosystem.env.cjs').JWT_SECRET)"`) do set JWT_SECRET=%%s
set NUXT_JWT_SECRET=%JWT_SECRET%

if not exist "logs" mkdir "logs"
echo [%date% %time%] starting on port %PORT% >> "logs\prod.log"
node ".output\server\index.mjs" >> "logs\prod.log" 2>&1
