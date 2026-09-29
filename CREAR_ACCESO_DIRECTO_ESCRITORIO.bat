@echo off
REM Crea el acceso directo "Dulce Placer (Local)" en el Escritorio.
REM Solo hay que correrlo UNA VEZ.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$W=New-Object -ComObject WScript.Shell; $D=$W.SpecialFolders('Desktop'); $S=$W.CreateShortcut($D+'\Dulce Placer (Local).lnk'); $S.TargetPath='G:\TODOS_MIS_PROYECTOS_MAESTROS\1_ACTIVOS_Y_ACTUALIZADOS\Gestion Panaderia DUlce PLacer ORIGINAL\ABRIR_DULCE_PLACER_LOCAL.vbs'; $S.WorkingDirectory='G:\TODOS_MIS_PROYECTOS_MAESTROS\1_ACTIVOS_Y_ACTUALIZADOS\Gestion Panaderia DUlce PLacer ORIGINAL'; $S.IconLocation='G:\TODOS_MIS_PROYECTOS_MAESTROS\1_ACTIVOS_Y_ACTUALIZADOS\Gestion Panaderia DUlce PLacer ORIGINAL\public\dulce-placer.ico'; $S.Description='Abre Dulce Placer en este computador (app + N8N)'; $S.Save(); Write-Host 'Acceso directo creado en el Escritorio.'"
echo.
pause
