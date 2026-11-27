#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "  Baza Butelek & Generator EAN-13 — Start/Build"
echo "=================================================="

if ! command -v node >/dev/null 2>&1; then
  echo "[BŁĄD] Wymagany jest Node.js (v20+). Zainstaluj Node.js i spróbuj ponownie."
  exit 1
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  echo "[INFO] Tworzenie pliku .env na podstawie .env.example..."
  cp .env.example .env
fi

echo "[1/4] Instalacja zależności (npm install)..."
npm install

echo "[2/4] Sprawdzanie typów TypeScript (npm run typecheck)..."
npm run typecheck

echo "[3/4] Kompilacja aplikacji produkcyjnej (npm run build)..."
npm run build

echo "[4/4] Uruchamianie serwera na porcie 3000..."
npm run start
