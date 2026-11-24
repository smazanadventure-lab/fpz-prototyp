# Aplikacja Android (APK)

## Czym jest
Aplikacja **dla zwiedzających**: przewodnik po Fabryce i mieście, gra terenowa, bilety i rezerwacje. To powłoka [Capacitor](https://capacitorjs.com) (projekt w `android/`) z wbudowaną tą samą aplikacją, która działa pod adresem `/app` – zbudowaną do jednego pliku `dist/apk/index.html` (`node build.mjs --target=apk --api=<adres serwera>`).

APK **nie zawiera** CMS, zarządzania ekspozycją, stanowiska bileterskiego, kiosków, ekranów ani symulatora: kompilacja ma osobny punkt wejścia (`src/main-app.jsx`), pomija operacje zaplecza w kodzie klienta i przerywa się błędem, gdyby do paczki trafił moduł zaplecza. Serwer nie wysyła tej aplikacji danych zaplecza (konta personelu, urządzenia, harmonogramy, dziennik zdarzeń, statystyki, postępy innych graczy).

Treści startowe są w paczce APK, a aktualne dane (treści, wydarzenia, bilety, postęp gry) aplikacja pobiera z serwera API (domyślnie `https://fpz-prototyp.netlify.app/api/*`; origin WebView to `https://localhost`). Bez sieci aplikacja działa na danych zapamiętanych, a zmiany wysyła po odzyskaniu połączenia. Korzysta z aparatu (skanowanie kodów QR), GPS (mapa, misje gry) i lektora Androida (wtyczka `@capacitor-community/text-to-speech`). Przycisk „wstecz” obsługuje `src/shell/native.js`. Do testów poza Fabryką służy **tryb testowy** w aplikacji (plakietka „TEST”): symulowana pozycja, zasięg i kod QR.

Konfiguracja: `capacitor.config.json` (id `pl.fpz.prototyp`, nazwa „FPŻ – prototyp”). Ikony i ekran startowy generuje `python3 android/tools/gen-icons.py`.

## Jak powstaje APK (GitHub Actions)
Workflow `.github/workflows/apk.yml` uruchamia się sam po każdym pushu do `main`; można go też uruchomić ręcznie:
1. W repozytorium na GitHubie otwórz zakładkę **Actions**.
2. Po lewej wybierz **APK (Android)**.
3. Kliknij **Run workflow** → gałąź `main` → **Run workflow**.
4. Po ok. 5–10 min (zielony znaczek) plik jest dostępny:
   - w zakładce **Releases** (strona główna repozytorium, prawa kolumna) – wydanie `apk-<numer>` oznaczone jako *Pre-release*, plik `fpz-prototyp-debug.apk` – **to jest bezpośredni link do pobrania na telefon**;
   - albo w szczegółach przebiegu workflow, sekcja **Artifacts** (plik ZIP, wymaga zalogowania).

Workflow: `npm ci` → `node build.mjs --target=apk --api=…` → `npx cap sync android` → JDK 21 (Temurin) → `./gradlew assembleDebug`.

## Instalacja na telefonie
1. Otwórz na telefonie stronę wydania (Releases) i pobierz `fpz-prototyp-debug.apk`.
2. Otwórz pobrany plik. Android zapyta o zgodę na **instalację z nieznanych źródeł** dla przeglądarki / menedżera plików – zezwól (Ustawienia → Aplikacje → Dostęp specjalny → Instalowanie nieznanych aplikacji).
3. Przy pierwszym użyciu kamery i lokalizacji zezwól na dostęp.

APK jest podpisany **kluczem debug** – nadaje się tylko do testów, nie do sklepu. Każdy build z GitHuba może mieć inny klucz debug, więc przy aktualizacji Android może odmówić instalacji „na wierzch” – wtedy odinstaluj starą wersję.

## Zmiana adresu serwera
W repozytorium: **Settings → Secrets and variables → Actions → zakładka Variables → New repository variable**: nazwa `FPZ_API_BASE`, wartość np. `https://moj-serwer.example.pl` (bez końcowego `/`). Następny build użyje tego adresu. Serwer musi dopuszczać w CORS origin `https://localhost`.

## Zmiana wersji
W `android/app/build.gradle`: `versionName` (widoczna, np. `"0.3.0"`) i `versionCode` (liczba całkowita – zwiększaj przy każdym wydaniu).

## Publikacja w Google Play
Potrzebny jest własny klucz wydania (keystore przechowywany poza repozytorium, np. w sekretach GitHuba) oraz paczka AAB (`./gradlew bundleRelease`) podpisana tym kluczem; w Play Console należy założyć aplikację, włączyć podpisywanie przez Google Play i uzupełnić politykę prywatności (kamera, lokalizacja). Wymaga to konta dewelopera Google Play.
