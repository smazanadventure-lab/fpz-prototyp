# Fabryka Pełna Życia – prototyp systemu multimedialnego (wersja testowa)

Zestaw wzajemnie zależnych aplikacji uruchamianych w przeglądarce jako jeden plik HTML:
aplikacja mobilna z grą terenową, strona WWW/PWA z systemem rezerwacji, kioski TZ.T1.1–T1.5, ekrany LCD,
stanowisko bileterskie, panel CMS oraz system zarządzania ekspozycją. Wszystkie końcówki działają na wspólnym,
symulowanym w przeglądarce „backendzie” (jeden magazyn danych + API z dziennikiem wywołań).

**To wersja testowa:** treści są przykładowe; logowanie, płatności, kamera, Bluetooth, GPS, wideo i połączenie
z tłumaczem PJM są symulowane. Logotyp jest znakiem zastępczym (właściwy plik wgrywa się w CMS → Ustawienia → Identyfikacja).

## Dwa wydania
1. **Jeden plik** – otwórz `dist/index.html` w przeglądarce (działa z dysku, bez serwera i bez internetu). Dane są wspólne dla zakładek, zapisane tylko w tej przeglądarce.
2. **Serwer + aplikacja na telefon (pilotaż)** – ten sam kod wdrożony na Netlify: wspólne dane na serwerze (`/api/*`), każda końcówka pod własnym adresem (`/app`, `/www`, `/kiosk/TZ.T1.1`, `/lcd/LCD-01`, `/bileter`, `/cms`, `/ekspozycja`), aplikacja dla zwiedzających jako APK (Android) albo strona dodana do ekranu głównego. **Instrukcja: [`docs/WDROZENIE.md`](docs/WDROZENIE.md)**, aplikacja Android: [`docs/APK.md`](docs/APK.md).

W wersji serwerowej działają też: **prawdziwe pliki multimedialne** (zdjęcia, filmy, nagrania wgrywane w CMS i odtwarzane we wszystkich końcówkach), **prawdziwy stan urządzeń** w panelu zarządzania (kioski i ekrany meldują się serwerowi) oraz – na komputerze z Windows – **sterowanie sprzętem** przez program sterujący: [`docs/KIOSK-WINDOWS.md`](docs/KIOSK-WINDOWS.md).

Logowanie w panelach jest makietą – login i hasło konta testowego są wpisane.

## Uruchomienie
Otwórz `dist/index.html` w przeglądarce albo – w wersji serwerowej – `npm run serve` i `http://localhost:8787`.

## Budowanie
```
npm install
node build.mjs                 # → dist/index.html (jeden samowystarczalny plik)
node build.mjs --target=netlify  # → dist/site (strona + /app) i server/build/handler.mjs (funkcja API) – to samo robi Netlify
node build.mjs --target=apk --api=https://fpz-prototyp.netlify.app   # → dist/apk (aplikacja dla zwiedzających do powłoki Android)
node tools/dev-server.mjs [--blobs]   # lokalny serwer testowy: strona + API (http://localhost:8787)
node test/srv-race.mjs && node test/srv-e2e.mjs   # testy trybu serwerowego (współbieżność, 9 „urządzeń”)
node build.mjs --only=mobile,game,reservation   # szybka kompilacja wybranych końcówek → dist/dev-….html
node tools/validate-content.mjs                 # sprawdzenie spójności treści
node tools/api-test.mjs                         # test dymny logiki (rezerwacje, gra, urządzenia)
node tools/shot.mjs --file=dist/index.html --script=test/int-flow.mjs   # scenariusze zależności w bezgłowym Chrome (Playwright)
```

## Struktura
```
src/kernel/     wspólny magazyn danych (store.js), dane początkowe (seed.js), API domenowe (api.js), języki (i18n.js), kontekst końcówki (client.jsx)
src/ui/         system wizualny wg próbek B i C: tokeny, komponenty, ikony, ilustracje, mapy, komponenty multimedialne
src/content/    treści przykładowe PL/EN (schemat: docs/CONTENT.md)
src/endpoints/  mobile, game, reservation, web, kiosk, signage, validator, cms, mgmt
src/shell/      powłoka z zakładkami, widokiem „Dwa okna”, panelem otoczenia telefonu, dziennikiem API i zakładką „O prototypie”
server/         backend pilotażowy: core.mjs (operacje na wspólnym stanie, wersjonowanie, widoki danych), netlify-fn.mjs (Netlify Blobs), storage-file.mjs (plik)
netlify/        funkcja /api/* (netlify/functions/api.mjs) – konfiguracja w netlify.toml
android/        projekt Capacitor (powłoka Android aplikacji dla zwiedzających); budowa APK: .github/workflows/apk.yml
public/         manifest i ikony strony, service worker (uruchamianie aplikacji bez sieci)
docs/           SPEC.md (zasady i kontrakty modułów), CONTENT.md (schemat treści)
test/, tools/   skrypty testowe i narzędzia
```

## Konta testowe
- klient rezerwacji: `anna.kowalska@example.com` / `demo1234`
- personel (login = hasło): `admin`, `redaktor`, `moderator`, `bileter`, `technik`

## Biblioteki
Preact (MIT), ikony Lucide (ISC), qrcode-generator (MIT), esbuild (MIT – tylko do budowania).
