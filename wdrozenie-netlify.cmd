@echo off
rem Wdrozenie na Netlify (projekt fpz-prototyp). Wymaga Node.js 20+. Opis: docs\WDROZENIE.md
cd /d "%~dp0"
echo == Instalacja zaleznosci
call npm ci || goto :blad
echo == Budowanie i wdrozenie (przy pierwszym uruchomieniu otworzy sie przegladarka z logowaniem do Netlify)
call npx --yes netlify-cli@latest deploy --prod --site 6529ca3f-303b-47dc-88a5-8ea502f3b366 || goto :blad
echo == Gotowe. Sprawdz: https://fpz-prototyp.netlify.app/api/info
pause
exit /b 0
:blad
echo.
echo Wystapil blad - sprawdz komunikaty powyzej (czy jest zainstalowany Node.js 20+?).
pause
exit /b 1
