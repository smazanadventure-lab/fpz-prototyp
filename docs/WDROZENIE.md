# Wdrożenie pilotażowe: serwer (Netlify) + aplikacja na telefon

Ten sam system działa w dwóch wydaniach:

| Wydanie | Co to jest | Dane |
|---|---|---|
| **Jeden plik** `FPZ-prototyp-wersja-testowa.html` | symulator wszystkich końcówek w zakładkach, do otwarcia z dysku | tylko w tej przeglądarce |
| **Serwer** (to wdrożenie) | każda końcówka pod własnym adresem + aplikacja mobilna (APK / przeglądarka telefonu) | wspólne, na serwerze – zmiana w CMS jest widoczna w telefonie, kiosku i na ekranie po kilku sekundach |

## Adresy po wdrożeniu

Projekt Netlify: **fpz-prototyp** → `https://fpz-prototyp.netlify.app`

| Adres | Końcówka | Urządzenie |
|---|---|---|
| `/` | symulator (wszystkie końcówki w zakładkach, panel „Otoczenie telefonu”, dziennik API, reset danych) | komputer |
| `/app` | **aplikacja dla zwiedzających** – przewodnik, gra terenowa, bilety; ta sama paczka co w APK | telefon |
| `/www` | strona WWW z systemem rezerwacji | komputer, tablet, telefon |
| `/kiosk/TZ.T1.1` … `/kiosk/TZ.T1.5` | kioski (pełny ekran, pion 1080×1920) | monitor kiosku |
| `/lcd/LCD-01`, `/lcd/LCD-02`, `/lcd/PRJ-01` | ekrany informacyjne i napisy na żywo (poziom 1920×1080) | ekran LCD / projektor |
| `/bileter` | stanowisko bileterskie | telefon lub tablet biletera |
| `/cms` | panel CMS | komputer |
| `/ekspozycja` | zarządzanie ekspozycją | komputer |
| `/kody` | **kody QR do testów** – arkusz kodów miejsc, misji gry i kodów „z kiosków” do skanowania telefonem z ekranu albo po wydrukowaniu | komputer / wydruk |
| `/api/info` | stan backendu (liczba wpisów, zamówień, graczy) | — |

Aplikacja dla zwiedzających (`/app` i APK) jest osobną kompilacją: **nie zawiera** CMS, zarządzania ekspozycją, stanowiska bileterskiego, kiosków ani ekranów, a serwer nie wysyła jej danych zaplecza (konta personelu, urządzenia, harmonogramy, dziennik zdarzeń, statystyki, postępy innych graczy) i odrzuca jej próby wykonania operacji zaplecza.

Logowanie we wszystkich panelach to **makieta**: login i hasło konta testowego są wpisane, wystarczy „Zaloguj”.

## Stan wdrożenia (24.11.2026)

- **Strona i API:** `https://fpz-prototyp.netlify.app` – wdrożone, widoczność produkcji: publiczna (adresy podglądowe Netlify nadal wymagają logowania do zespołu).
- **Kod:** `https://github.com/smazanadventure-lab/fpz-prototyp`, gałąź `main`. Po podpięciu repozytorium w Netlify (Project configuration → Build & deploy → *Connect an existing repository*) każda zmiana na `main` wdraża się sama; ustawienia budowania są w `netlify.toml`.
- **APK:** zakładka *Releases* repozytorium – plik `fpz-prototyp-debug.apk`. GitHub Actions buduje nową wersję, gdy zmieni się kod aplikacji (nie przy zmianach samej dokumentacji), albo na żądanie (*Actions → APK (Android) → Run workflow*).

## Krok 1 – wdrożenie na Netlify (od zera, np. na innym koncie)

> **Widoczność projektu.** Nowe projekty Netlify są domyślnie **prywatne**: stronę i API otworzy tylko osoba zalogowana do zespołu Netlify, więc telefon testera, kiosk i aplikacja APK **nie połączą się z serwerem** (aplikacja pokaże „Brak połączenia z serwerem” i będzie działać na danych z paczki). Ustaw: **Project configuration → General → Visitor access → Project visibility → Edit visibility → Public**. Wersja pilotażowa nie ma prawdziwego logowania (zob. „Ograniczenia”) – adres podawaj tylko testerom. Ochrona wspólnym hasłem Netlify nie nadaje się tutaj, bo blokuje także wywołania API z aplikacji.

### Wariant A – przez GitHub (zalecany)
1. Wgraj kod do repozytorium na GitHubie (gałąź `main`).
2. W Netlify: **Add new project → Import an existing project** (albo w istniejącym projekcie *Connect an existing repository*) i wskaż repozytorium. Pola budowania zostaw puste – są w `netlify.toml` (`npm run build:netlify`, katalog `dist/site`).
3. Każdy `push` do `main` wdraża stronę.

### Wariant B – z komputera, jednym poleceniem
Wymaga [Node.js LTS](https://nodejs.org) (wersja 20 lub nowsza). W katalogu projektu uruchom **`wdrozenie-netlify.cmd`** (Windows) albo `./wdrozenie-netlify.sh` (macOS / Linux): `npm ci` → `npx netlify-cli deploy --prod --site <identyfikator projektu>`. Przy pierwszym uruchomieniu przeglądarka poprosi o zalogowanie do Netlify. Identyfikator projektu wpisany w skryptach dotyczy projektu `fpz-prototyp`.

Po wdrożeniu sprawdź `https://<adres>/api/info` – powinien zwrócić `{"ok":true,…}`.

## Krok 2 – aplikacja na telefon

**Od razu, bez instalacji:** otwórz na telefonie `https://fpz-prototyp.netlify.app/app` (kod QR do tego adresu jest w symulatorze pod przyciskiem „Adresy”). W Chrome / Safari wybierz „Dodaj do ekranu głównego” – aplikacja uruchamia się wtedy na pełnym ekranie, także bez sieci (iPhone również).

**APK (Android):** plik buduje GitHub Actions z projektu `android/` – opis w [`docs/APK.md`](APK.md). Gotowy plik `fpz-prototyp-debug.apk` jest w zakładce **Releases** repozytorium – pobierz go na telefon i zainstaluj. Nową wersję można zbudować ręcznie: **Actions → APK (Android) → Run workflow**.

**Kody QR:** strona `/kody` pokazuje wszystkie kody testowe (klik w kod = powiększenie do skanowania z ekranu, przycisk „Drukuj” = arkusz A4). Kody miejsc i misji zawierają adres `https://fpz-prototyp.netlify.app/q/KOD`: zeskanowane w aplikacji (Skanuj → Kamera) otwierają miejsce albo zaliczają krok misji, a zeskanowane zwykłym aparatem telefonu otwierają aplikację w przeglądarce. Kod misji odczytany aparatem (lub wpisany ręcznie) jest pamiętany przez 3 minuty – w tym czasie misję można zaliczyć w grze.

Aplikacja ma w paczce treści startowe, a aktualne dane pobiera z serwera; zmiany wykonane bez sieci (np. postęp gry) czekają w kolejce i wysyłają się po odzyskaniu połączenia. Skaner używa aparatu telefonu (kody z kiosków, biletów i tablic), a pozycję można brać z GPS albo – do testów poza Fabryką – ustawić w **trybie testowym** (plakietka „TEST” na ekranie głównym).

## Jak to działa (w skrócie)

- **Backend**: funkcja `netlify/functions/api.mjs` (adres `/api/*`) wykonuje te same operacje domenowe co prototyp (`src/kernel/api.js`) na wspólnym stanie zapisanym w **Netlify Blobs** (magazyn `fpz-pilot`). Zapis jest warunkowy (wersja danych) i ponawiany, więc równoczesne operacje z wielu urządzeń się nie nadpisują; powtórzone żądanie wykonuje się raz.
- **Końcówki** wykonują operację od razu u siebie (natychmiastowa reakcja interfejsu, praca offline), a równolegle wysyłają ją na serwer. Serwer jest źródłem prawdy – jego stan zastępuje dane lokalne. Gdy serwer rozstrzygnie inaczej (np. dwóch bileterów skasowało ten sam bilet w tej samej chwili), końcówka pokazuje komunikat i odświeża dane.
- **Aktualizacje z innych urządzeń** przychodzą przez cykliczne odpytywanie: co ok. 4 s, gdy coś się dzieje, rzadziej (10–30 s) przy bezczynności; karta w tle nie odpytuje.
- **Gra**: każdy telefon ma własny postęp, nagrody i ulubione (identyfikator urządzenia), wspólne są treści, oferta, bilety, pomysły, tablica wyników.
- **Reset danych**: przycisk „Reset” w symulatorze (`/`) przywraca dane początkowe na serwerze – dla wszystkich.

## Test lokalny (bez Netlify)

```
npm ci
npm run serve            # buduje stronę i uruchamia serwer testowy: http://localhost:8787
node test/srv-race.mjs   # współbieżność API
node test/srv-e2e.mjs    # 9 „urządzeń” w przeglądarce na wspólnym backendzie
```
`node tools/dev-server.mjs --blobs` uruchamia dokładnie ten moduł funkcji, który trafia na Netlify, z lokalnym emulatorem Netlify Blobs.

## Ograniczenia wersji pilotażowej (ważne)

- **Brak prawdziwego uwierzytelniania.** Logowanie jest makietą, a serwer ufa końcówkom – każdy, kto zna adres, może wejść do CMS, zmienić dane albo je zresetować. Adresu nie należy publikować; nie wpisywać prawdziwych danych osobowych ani haseł. Płatności, e-maile, SMS i powiadomienia push są symulowane.
- **Dane w jednym dokumencie** (ok. 0,4 MB) w Netlify Blobs z zapisem warunkowym. To wystarcza dla kilku–kilkunastu testerów, ale Netlify zaleca dla danych transakcyjnych bazę danych – wersja produkcyjna powinna mieć bazę (np. PostgreSQL), konta z rolami po stronie serwera i API z autoryzacją. Warstwa magazynu jest wydzielona (`server/netlify-fn.mjs`), więc podmiana nie zmienia logiki.
- **Odświeżanie przez odpytywanie**, nie „na żywo” – opóźnienie do kilku sekund (napisy na żywo na ekranie LCD pojawiają się z takim samym opóźnieniem). Każde odpytanie to wywołanie funkcji Netlify: otwarta karta zużywa ok. 15 wywołań na minutę w czasie aktywnych testów i 2 na minutę w spoczynku – warto zamykać nieużywane karty i obserwować zużycie w panelu Netlify.
- **Pliki** dodawane w CMS (obrazy) trafiają do wspólnego stanu, stąd limit 300 kB na plik.
- Zakres sprawdzenia: logikę serwera i końcówek przetestowano lokalnie (serwer testowy z produkcyjnym modułem funkcji i emulatorem Netlify Blobs, 9 „urządzeń” w przeglądarce, aplikacja mobilna z kamerą testową). Na Netlify potwierdzono w dzienniku żądań poprawne odpowiedzi API (`/api/sync`, `/api/rpc`). APK zbudował się na GitHubie i ma właściwą zawartość, ale jego działanie na telefonie (aparat, GPS, lektor, marginesy ekranu) wymaga sprawdzenia na urządzeniu.
