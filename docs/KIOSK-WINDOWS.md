# Kiosk na komputerze z Windows – test prawdziwego sterowania

Instrukcja dla osoby technicznej. Skrypty: katalog [`tools/windows/`](../tools/windows/) w repozytorium `https://github.com/smazanadventure-lab/fpz-prototyp`.

## Po co to jest

Kiosk albo ekran ekspozycji to strona WWW otwierana na pełnym ekranie (np. `https://fpz-prototyp.netlify.app/kiosk/TZ.T1.3`). Strona sama pobiera treści i wykonuje polecenia z panelu `/ekspozycja`, ale przeglądarka nie może sterować sprzętem: nie wyłączy monitora, nie zmieni głośności systemowej i nie uruchomi się ponownie po awarii.

Te skrypty zamieniają zwykły komputer z Windows 10/11 i monitor w testowy kiosk sterowany z panelu:

- **przeglądarka w trybie kiosku** (Edge albo Chrome, pełny ekran, osobny profil) uruchamia się po zalogowaniu, a gdy się zamknie lub ulegnie awarii, wraca po kilku sekundach;
- **program sterujący (agent)** co 5 s pyta serwer o zadany stan urządzenia (`GET /api/device/{id}`) i wykonuje go na komputerze: usypia i budzi monitor, ustawia głośność i jasność, restartuje przeglądarkę;
- co 30 s agent wysyła sygnał (`POST /api/beat`) z danymi komputera: nazwą, systemem, obciążeniem procesora, pamięcią, wolnym miejscem na dysku, czasem pracy, głośnością i stanem monitora. Panel pokazuje je w oknie urządzenia, w zakładce **„Stan rzeczywisty”**.

| Plik | Do czego służy |
|---|---|
| `instaluj-kiosk.ps1` | instalacja (uruchamiana raz) |
| `uruchom-kiosk.ps1` | start po zalogowaniu: czeka na sieć, uruchamia agenta i przeglądarkę, potem ich pilnuje |
| `fpz-agent.ps1` | agent (program sterujący) |
| `zatrzymaj-kiosk.ps1` | wyjście serwisowe: zatrzymuje kiosk i odsłania pulpit |
| `sprawdz.ps1` | diagnostyka (niczego nie zmienia) |
| `odinstaluj-kiosk.ps1` | odinstalowanie |
| `fpz-wspolne.ps1` | funkcje wspólne, z których korzystają pozostałe skrypty |

## Wymagania

- Windows 10 albo 11 (Home lub Pro), Windows PowerShell 5.1 (jest w systemie). PowerShell 7 nie jest potrzebny, ale też zadziała.
- Microsoft Edge (jest w systemie) albo Google Chrome.
- Monitor: dla kiosków `TZ.T1.1`…`TZ.T1.5` pionowy 1080×1920 (dotykowy, jeśli jest). Dla `LCD-01`, `LCD-02` i `PRJ-01` poziomy 1920×1080. `TZ.T1.5` odtwarza dźwięk, więc potrzebuje głośników.
- Dostęp do `https://fpz-prototyp.netlify.app` (port 443). Skrypty nie pobierają niczego poza odpowiedziami API serwera.
- Konto Windows, na którym ma działać kiosk. Najlepiej osobne, **lokalne konto standardowe**, np. `kiosk`. Uprawnienia administratora nie są potrzebne.

## Instalacja krok po kroku

1. Zaloguj się na konto, na którym ma działać kiosk.
2. Pobierz repozytorium: na stronie `https://github.com/smazanadventure-lab/fpz-prototyp` wybierz **Code → Download ZIP** i rozpakuj archiwum, np. do `C:\Users\kiosk\Downloads\fpz-prototyp`. Potrzebny jest tylko katalog `tools\windows`; zawsze kopiuj go w całości.
3. Otwórz PowerShell (menu Start → „Windows PowerShell”, **bez** „Uruchom jako administrator”) i przejdź do katalogu:
   ```powershell
   cd C:\Users\kiosk\Downloads\fpz-prototyp\tools\windows
   powershell -ExecutionPolicy Bypass -File .\instaluj-kiosk.ps1 -Id TZ.T1.3
   ```
   `-ExecutionPolicy Bypass` dotyczy tylko tego jednego uruchomienia. Zasady wykonywania skryptów w systemie się nie zmieniają.
4. Przeczytaj podsumowanie. Instalator wypisuje, co zrobił (`[OK]`), co się nie udało (`[!!]`) i listę **„Do zrobienia ręcznie”**.
5. Wykonaj kroki ręczne (następny rozdział), a potem uruchom kiosk: menu Start → **„FPZ – Uruchom kiosk”** albo wyloguj się i zaloguj ponownie.

Parametry instalatora:

| Parametr | Znaczenie |
|---|---|
| `-Id TZ.T1.3` | **wymagany**: identyfikator urządzenia z panelu (`TZ.T1.1`…`TZ.T1.5`, `LCD-01`, `LCD-02`, `PRJ-01`). Identyfikatory `TZ.*` otwierają `/kiosk/…`, pozostałe `/lcd/…` |
| `-Serwer https://…` | adres serwera; domyślnie `https://fpz-prototyp.netlify.app` |
| `-Przegladarka chrome` | Chrome zamiast Edge (domyślnie `edge`) |
| `-BezAgenta` | sama przeglądarka w trybie kiosku, bez sterowania sprzętem |
| `-Obrot pionowo\|poziomo` | oczekiwana orientacja ekranu. Instalator tylko ją **sprawdza** i podpowiada, niczego nie obraca |
| `-WylaczHibernacje` | `powercfg /hibernate off`; wymaga uprawnień administratora, bez nich instalator wypisze polecenie do wykonania |
| `-RestartSystemu` | „Restart aplikacji” w panelu restartuje cały komputer zamiast przeglądarki |
| `-UruchomTeraz` | uruchamia kiosk od razu po instalacji |

Co robi instalator:

- kopiuje skrypty do `C:\ProgramData\FPZ-Kiosk\` i zapisuje tam `konfiguracja.json`;
- tworzy skrót **w folderze Autostart bieżącego użytkownika** (`shell:startup`\`FPZ Kiosk.lnk`, `powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File …\uruchom-kiosk.ps1`);
- tworzy w menu Start folder **„FPZ Kiosk”** ze skrótami: Uruchom, Zatrzymaj, Sprawdź;
- ustawia na zasilaniu sieciowym: bez usypiania, bez wygaszania ekranu i bez hibernacji po czasie (`powercfg /change … 0`), a także wyłącza wygaszacz ekranu bieżącego użytkownika (HKCU);
- **nie** zmienia zasad grupy ani zabezpieczeń i nie zapisuje niczego w HKLM.

Kiosk zapisuje swoje dane w dwóch miejscach:

- `C:\ProgramData\FPZ-Kiosk\`: `kiosk.log` (start i nadzór przeglądarki), `agent.log` (agent; po przekroczeniu 1 MB powstaje `*.log.1`), `stan.json` (ostatni wykonany restart) i ewentualnie plik `STOP`;
- `%LocalAppData%\FPZ-Kiosk\profil\`: osobny profil przeglądarki kiosku.

## Ustawienia ręczne w Windows

1. **Automatyczne logowanie**: Win+R → `netplwiz` → zaznacz konto kiosku → odznacz „Aby używać tego komputera, użytkownicy muszą wprowadzić nazwę użytkownika i hasło” → podaj hasło. W Windows 11 tego pola nie widać, dopóki nie wyłączysz „Zezwalaj tylko na logowanie Windows Hello…” (Ustawienia → Konta → Opcje logowania).
2. **Orientacja pionowa** (kioski `TZ.*`): Ustawienia → System → Ekran → Orientacja ekranu → **Pionowa**. Ustaw rozdzielczość 1080×1920 i skalowanie 100%.
3. **Dźwięk**: Ustawienia → System → Dźwięk. Wybierz właściwe urządzenie wyjściowe, bo agent steruje głośnością **domyślnego** urządzenia.
4. **Powiadomienia i aktualizacje**: Ustawienia → System → Powiadomienia → wyłącz albo włącz „Nie przeszkadzać”. W Windows Update ustaw „Godziny aktywnej pracy” tak, aby obejmowały godziny ekspozycji (np. 6:00–23:00), albo wstrzymaj aktualizacje na czas testu.
5. **Ekran dotykowy**: Ustawienia → Bluetooth i urządzenia → Dotyk → wyłącz gesty trzema i czterema palcami. Przeciągnięcia od krawędzi ekranu (centrum akcji, widżety) wyłącza tylko zasada „Allow edge swipe” (gpedit / Intune). Skrypty jej nie zmieniają.
6. Jeśli instalator zgłosił błąd `powercfg`, w PowerShell uruchomionym jako administrator wykonaj `powercfg /change standby-timeout-ac 0` i `powercfg /change monitor-timeout-ac 0`.

## Scenariusz testu

Na drugim komputerze otwórz `https://fpz-prototyp.netlify.app/ekspozycja` i zaloguj się kontem personelu z uprawnieniem do urządzeń (np. kontem technika). Wejdź w **Urządzenia** i kliknij urządzenie, np. `TZ.T1.3`. Agent sprawdza serwer co 5 s, a panel odczytuje sygnały co 10 s, więc wynik każdego kroku widać po kilku–kilkunastu sekundach.

| W panelu | Na komputerze kiosku | W panelu, „Stan rzeczywisty” |
|---|---|---|
| (nic – po starcie) | przeglądarka na pełnym ekranie ze stroną kiosku | sekcja „Program sterujący na komputerze”: **nazwa komputera**, system, **obciążenie procesora**, pamięć, wolne miejsce, **czas pracy** |
| **Wyłącz** | strona pokazuje czarną planszę, a **monitor gaśnie** (uśpienie, dioda w trybie czuwania) | Monitor: **uśpiony** |
| **Włącz** | monitor **budzi się**, strona wraca | Monitor: **włączony** |
| suwak **Głośność**, np. 35% | głośność systemowa zmienia się na 35% (ikona głośnika na pasku zadań); 0% = wyciszenie | Głośność: 35% |
| suwak **Jasność** | zmienia jasność tylko na laptopach i ekranach z obsługą WMI; na zwykłym monitorze nic się nie dzieje | w „Uwagi”: „jasność: monitor nie obsługuje sterowania przez WMI” |
| **Restart aplikacji** | przeglądarka zamyka się i **startuje od nowa** (albo cały komputer, jeśli użyto `-RestartSystemu`) | „Restart wykonany …” |
| **Pulpit** → godzina symulowana **23:30** (albo 23:00 w polu godziny) | według harmonogramu „Godziny pracy ekspozycji” (07:00–22:00) urządzenie się wyłącza i **monitor gaśnie**. „12:00” włącza je z powrotem, „Czas rzeczywisty” kończy symulację | Monitor: uśpiony / włączony |
| **odłącz sieć** od komputera kiosku | kiosk działa dalej; agent zapisuje w logu brak połączenia i ponawia próby | po ok. 2 min „brak sygnału”; po **5 min** serwer zakłada zgłoszenie awarii (P2) w „Awarie i SLA”, a po przywróceniu sieci zamyka je sam |

Harmonogram działa tylko w trybie **„auto”**. Po ręcznym „Włącz/Wyłącz” urządzenie przechodzi w tryb ręczny, więc przed testem godziny symulowanej kliknij w oknie urządzenia **„Przywróć harmonogram”**.

Jeśli monitor zostanie obudzony dotykiem albo myszą, a urządzenie ma pozostać wyłączone, agent ponownie usypia monitor, nie częściej niż co minutę.

### Test bez Windows (tryb na sucho)

Agent ma tryb `-Test`, który niczego nie zmienia na komputerze: wypisuje, co by zrobił, i wysyła sygnały. Działa też w PowerShell 7 na Linuksie i macOS:

```powershell
pwsh tools/windows/fpz-agent.ps1 -Id TZ.T1.3 -Serwer https://fpz-prototyp.netlify.app -Test
```

```
[INFO] Zasilanie: off → monitor uśpiony
[TEST] [NA SUCHO] uśpiłbym monitor (SendMessageTimeout HWND_BROADCAST, WM_SYSCOMMAND, SC_MONITORPOWER, 2)
[TEST] [NA SUCHO] ustawiłbym głośność systemową na 35%
[TEST] [NA SUCHO] zamknąłbym i ponownie uruchomił przeglądarkę kiosku – polecenie z 2026-11-25T12:51:10.8180000Z
```

Na komputerze kiosku `fpz-agent.ps1 -Diagnostyka` sprawdza, czy działa sterowanie: kompilację definicji natywnych, odczyt głośności, jasności i danych systemu. Niczego przy tym nie zmienia.

## Obsługa: wyjście serwisowe, diagnostyka, odinstalowanie

- **Wyjście serwisowe**: naciśnij klawisz Windows (albo Ctrl+Alt+Del → Menedżer zadań → „Uruchom nowe zadanie”), wpisz „Zatrzymaj kiosk” i uruchom **„FPZ – Zatrzymaj kiosk”**. Skrypt tworzy plik `C:\ProgramData\FPZ-Kiosk\STOP`, zatrzymuje nadzór i agenta, zamyka przeglądarkę i odsłania pulpit.
  Samo **Alt+F4** zamyka przeglądarkę tylko na kilka sekund, bo nadzór od razu uruchomi ją ponownie. Alt+F4 działa jako wyjście tylko wtedy, gdy plik `STOP` już istnieje (można go też utworzyć ręcznie): nadzór wtedy czeka i wraca do pracy po usunięciu pliku.
- **Powrót do pracy**: menu Start → **„FPZ – Uruchom kiosk”** albo ponowne zalogowanie. Każde uruchomienie usuwa plik `STOP`, więc restart komputera zawsze przywraca kiosk.
- **Diagnostyka**: menu Start → **„FPZ – Sprawdź kiosk”** (`sprawdz.ps1`) pokazuje konfigurację, odpowiedź `/api/device/{id}`, wiek ostatnich sygnałów agenta i strony, procesy (nadzór, agent, przeglądarka), sterowanie sprzętem, rozdzielczość ekranów i ostatnie wiersze logów.
- **Zmiana urządzenia lub serwera**: uruchom instalator ponownie z nowymi parametrami, a potem „Zatrzymaj” i „Uruchom”.
- **Odinstalowanie**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File C:\ProgramData\FPZ-Kiosk\odinstaluj-kiosk.ps1 -UsunDane
  ```
  Skrypt zatrzymuje kiosk, usuwa autostart i skróty oraz przywraca wygaszanie ekranu (15 min), usypianie (30 min) i wygaszacz ekranu. Z `-UsunDane` usuwa też skrypty, logi i profil przeglądarki. Hibernację, jeśli była wyłączona, przywróć ręcznie (`powercfg /hibernate on` jako administrator).

## Ograniczenia pilotażu

- **Bez uwierzytelniania.** API urządzeń i sygnałów jest otwarte: każdy, kto zna adres, może odczytać stan urządzenia i wysłać fałszywy sygnał. Testuj więc w sieci testowej, na danych testowych.
- **Usypianie monitora** (`SC_MONITORPOWER`) działa tylko na monitorach, które obsługują oszczędzanie energii DPMS. Niektóre monitory i telewizory na HDMI pokazują „brak sygnału” zamiast zasnąć albo budzą się same. Na laptopach z nowoczesnym trybem wstrzymania (Modern Standby) wyłączenie ekranu może uśpić cały komputer. Agent ustawia „system wymagany”, ale sprawdź to w teście.
- **Jasność** zwykle da się sterować tylko na wbudowanych ekranach laptopów (WMI). Monitory zewnętrzne wymagałyby DDC/CI, a tego tu nie ma.
- **Głośność** dotyczy domyślnego urządzenia odtwarzania. Jeśli Windows przełączy wyjście (np. po podłączeniu HDMI), przy następnej zmianie głośności w panelu agent ustawi ją już na nowym wyjściu.
- **Projektory i nagłośnienie** (np. `PRJ-01`) wymagają sterowników AV (PJLink, RS-232, sterowniki DSP). To jest poza zakresem pilotażu. Agent steruje tylko komputerem, do którego podłączono projektor.
- Agent działa w sesji zalogowanego użytkownika, więc bez zalogowania (ekran logowania) nic nie działa. Dlatego potrzebne jest automatyczne logowanie.
- Jeśli zasady grupy wymuszają podpisane skrypty (`AllSigned`), parametr `-ExecutionPolicy Bypass` nie wystarczy. Skrypty nie są podpisane.

## Co byłoby w wersji docelowej

- **Usługa systemowa** zamiast skryptu w sesji użytkownika: działa bez logowania, ma własne konto, a usługa nadzorcy odporna na zamknięcie okna.
- **Tryb kiosku Windows**: „Assigned Access” (kiosk z jedną aplikacją, Edge w trybie kiosku) albo **Shell Launcher** (przeglądarka zamiast Eksploratora), wdrażane przez Intune/MDM. Bez pulpitu, bez gestów krawędziowych i bez Alt+Tab.
- **Uwierzytelnianie urządzeń**: osobny token lub certyfikat dla każdego komputera, polecenia podpisane, sygnały przyjmowane tylko od zarejestrowanych urządzeń.
- **Podpisane skrypty / podpisany program** (certyfikat podpisu kodu), zasada `AllSigned`.
- **Zdalna aktualizacja** agenta i przeglądarki z kontrolą wersji oraz zbiorczy podgląd logów na serwerze.
- **Sterowanie AV**: PJLink i RS-232 dla projektorów i nagłośnienia, DDC/CI dla jasności monitorów, harmonogram włączania komputerów (Wake-on-LAN, BIOS).
