@echo off
title ONEBOX - Espace Numerique Personnel
echo ========================================================
echo   DEMARRAGE DE ONEBOX - Espace Numerique Personnel
echo ========================================================
echo.
echo Initialisation du serveur local et de la base SQLite FTS5...
start http://localhost:3845
node --experimental-strip-types apps/desktop/server.ts
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Une erreur est survenue lors de l'execution de ONEBOX.
  pause
)

