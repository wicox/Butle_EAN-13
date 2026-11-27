@echo off
setlocal enabledelayedexpansion

echo ==================================================
echo   Baza Butelek ^& Generator EAN-13 - Start/Build
echo ==================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [BLAD] Wymagany jest Node.js ^(v20+^). Zainstaluj Node.js i sprobuj ponownie.
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    echo [INFO] Tworzenie pliku .env na podstawie .env.example...
    copy ".env.example" ".env" >nul
  )
)

echo [1/4] Instalacja zaleznosci ^(npm install^)...
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%

echo [2/4] Sprawdzanie typow TypeScript ^(npm run typecheck^)...
call npm run typecheck
if %errorlevel% neq 0 exit /b %errorlevel%

echo [3/4] Kompilacja aplikacji produkcyjnej ^(npm run build^)...
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%

echo [4/4] Uruchamianie serwera na porcie 3000...
call npm run start
