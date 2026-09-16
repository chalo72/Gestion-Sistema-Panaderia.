@echo off
chcp 65001 >nul
echo ============================================
echo   PUBLICANDO DULCE PLACER A PRODUCCION
echo   (version RAIZ - con todo lo de esta semana
echo    + los arreglos de hoy)
echo ============================================
echo.
echo Esto va a subir la version actual de esta carpeta
echo (raiz del proyecto) a:
echo   https://app-eight-sigma-13.vercel.app/
echo.
echo No cierres esta ventana hasta que termine.
echo.
cd /d "%~dp0"
call npx vercel --prod
echo.
echo ============================================
echo   LISTO. Revisa arriba si dio algun error.
echo   Si todo salio bien, entra a la pagina y
echo   dale clic al boton "Limpiar cache y recargar"
echo   (o Ctrl+Shift+R).
echo ============================================
pause
