#!/usr/bin/env sh
# Wdrożenie na Netlify (projekt fpz-prototyp). Wymaga Node.js 20+. Opis: docs/WDROZENIE.md
set -e
cd "$(dirname "$0")"
echo "== Instalacja zależności"
npm ci
echo "== Budowanie i wdrożenie (przy pierwszym uruchomieniu otworzy się przeglądarka z logowaniem do Netlify)"
npx --yes netlify-cli@latest deploy --prod --site 6529ca3f-303b-47dc-88a5-8ea502f3b366
echo "== Gotowe. Sprawdź: https://fpz-prototyp.netlify.app/api/info"
