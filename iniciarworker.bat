@echo off
setlocal

set "PROJECT_DIR=%~dp0"

echo Iniciando MyRockomix.Party...

start "MyRockomix - Next.js" /D "%PROJECT_DIR%" cmd /k "echo [Next.js] Iniciando en http://localhost:3000 && pnpm dev"

start "MyRockomix - Worker" /D "%PROJECT_DIR%" cmd /k "echo [Worker] Iniciando en http://127.0.0.1:8787 && wrangler dev"

echo Se abrieron las ventanas de Next.js y Worker.
endlocal
