@echo off
REM ====================================================================
REM  ABRIR DULCE PLACER (LOCAL) - Creado 2026-09-20
REM  Actualizado 2026-09-27: ahora N8N tambien abre solo en el navegador.
REM  Prende N8N y la app en este PC, y abre las dos ventanas ya listas.
REM  No hay que escribir nada.
REM ====================================================================
cd /d "G:\TODOS_MIS_PROYECTOS_MAESTROS\1_ACTIVOS_Y_ACTUALIZADOS\Gestion Panaderia DUlce PLacer ORIGINAL"

netstat -ano | findstr ":5678" >nul 2>&1
if errorlevel 1 start "N8N - Dulce Placer" /min cmd /c "set NODE_OPTIONS=--dns-result-order=ipv4first && npx n8n"

netstat -ano | findstr ":5173" >nul 2>&1
if errorlevel 1 start "App - Dulce Placer" /min cmd /c "npx vite --config vite.config.local.ts"

set NAVEGADOR=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set NAVEGADOR=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set NAVEGADOR=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set NAVEGADOR=%LocalAppData%\Google\Chrome\Application\chrome.exe
if not defined NAVEGADOR if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set NAVEGADOR=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe
if not defined NAVEGADOR if exist "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" set NAVEGADOR=%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe

set /a intentos=0
:esperar
set /a intentos+=1
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":5173" >nul 2>&1
if errorlevel 1 if %intentos% LSS 40 goto esperar

if defined NAVEGADOR (
  start "" "%NAVEGADOR%" --app=http://localhost:5173 --new-window
) else (
  start "" "http://localhost:5173"
)

set /a intentosn8n=0
:esperarn8n
set /a intentosn8n+=1
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":5678" >nul 2>&1
if errorlevel 1 if %intentosn8n% LSS 60 goto esperarn8n

netstat -ano | findstr ":5678" >nul 2>&1
if not errorlevel 1 (
  if defined NAVEGADOR (
    start "" "%NAVEGADOR%" http://localhost:5678
  ) else (
    start "" "http://localhost:5678"
  )
)

exit
