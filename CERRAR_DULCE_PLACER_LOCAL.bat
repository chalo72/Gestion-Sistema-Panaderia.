@echo off
REM Apaga la app local y N8N (libera los puertos 5173 y 5678).
echo Cerrando Dulce Placer local...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5678" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
echo Listo. Ya puedes cerrar esta ventana.
timeout /t 3 >nul
