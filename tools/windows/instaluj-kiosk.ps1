<#
.SYNOPSIS
  FPZ Kiosk – instalator (uruchamiany raz na komputerze kiosku / ekranu).

.DESCRIPTION
  - kopiuje skrypty do %ProgramData%\FPZ-Kiosk i zapisuje konfiguracja.json,
  - tworzy autostart dla BIEŻĄCEGO użytkownika (skrót w folderze Autostart → uruchom-kiosk.ps1 w ukrytym oknie)
    oraz skróty w menu Start: „FPZ – Uruchom kiosk”, „FPZ – Zatrzymaj kiosk”, „FPZ – Sprawdź kiosk”,
  - ustawia zasilanie na zasilaniu sieciowym: bez usypiania komputera i bez wygaszania ekranu (powercfg),
  - wyłącza wygaszacz ekranu bieżącego użytkownika (HKCU),
  - wypisuje, co zrobił, i co trzeba ustawić ręcznie.
  Nie zmienia zasad grupy, nie wyłącza zabezpieczeń, nie zapisuje nic w HKLM. Działa bez uprawnień administratora;
  tylko wyłączenie hibernacji (-WylaczHibernacje) wymaga administratora.

  WAŻNE: uruchom instalator z konta, na którym ma działać kiosk (autostart trafia do profilu bieżącego użytkownika).

.PARAMETER Id
  Identyfikator urządzenia z panelu, np. TZ.T1.3 (kiosk pionowy), LCD-01, LCD-02, PRJ-01 (ekrany poziome).
.PARAMETER Serwer
  Adres serwera (domyślnie https://fpz-prototyp.netlify.app).
.PARAMETER Przegladarka
  edge (domyślnie) albo chrome.
.PARAMETER BezAgenta
  Tylko przeglądarka w trybie kiosku – bez programu sterującego (brak sterowania monitorem/głośnością).
.PARAMETER Obrot
  Tylko informacja: oczekiwana orientacja ekranu (pionowo/poziomo). Instalator NIE zmienia orientacji – sprawdza ją i podpowiada.
.PARAMETER WylaczHibernacje
  Wyłącza hibernację (powercfg /hibernate off) – wymaga uruchomienia jako administrator.
.PARAMETER RestartSystemu
  Polecenie „Restart aplikacji” z panelu restartuje cały komputer zamiast przeglądarki.
.PARAMETER UruchomTeraz
  Po instalacji od razu uruchamia kiosk (bez ponownego logowania).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\instaluj-kiosk.ps1 -Id TZ.T1.3
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Id,
    [string]$Serwer = 'https://fpz-prototyp.netlify.app',
    [ValidateSet('edge', 'chrome')][string]$Przegladarka = 'edge',
    [switch]$BezAgenta,
    [ValidateSet('', 'pionowo', 'poziomo')][string]$Obrot = '',
    [switch]$WylaczHibernacje,
    [switch]$RestartSystemu,
    [switch]$UruchomTeraz
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'fpz-wspolne.ps1')

$recznie = New-Object System.Collections.ArrayList
function Krok([string]$t) { Write-Host ''; Write-Host "▶ $t" -ForegroundColor Cyan }
function Dobrze([string]$t) { Write-Host "  [OK] $t" -ForegroundColor Green }
function Uwaga([string]$t) { Write-Host "  [!!] $t" -ForegroundColor Yellow }
function Info([string]$t) { Write-Host "       $t" }
function Recznie([string]$t) { [void]$recznie.Add($t) }

Write-Host "FPZ Kiosk – instalator $FpzWersja" -ForegroundColor Cyan

if (-not $FpzNaWindows) { Write-Host 'Instalator działa tylko w Windows 10/11.' -ForegroundColor Red; exit 3 }
if ($Id -notmatch '^[A-Za-z0-9][A-Za-z0-9.\-]{2,23}$') { Write-Host "Niepoprawny identyfikator '$Id' (np. TZ.T1.3, LCD-01)." -ForegroundColor Red; exit 2 }
$Serwer = $Serwer.Trim().TrimEnd('/')
if ($Serwer -notmatch '^https?://') { Write-Host "Adres serwera musi zaczynać się od https:// (albo http:// w sieci testowej): '$Serwer'." -ForegroundColor Red; exit 2 }

$rodzaj = Get-FpzRodzaj $Id
if (-not $Obrot) { $Obrot = if ($rodzaj -eq 'kiosk') { 'pionowo' } else { 'poziomo' } }
$adres = Get-FpzAdresStrony $Serwer $Id
$admin = Test-FpzAdministrator
$uzytkownik = "$env:USERDOMAIN\$env:USERNAME"
Info "Urządzenie: $Id ($(if ($rodzaj -eq 'kiosk') { 'kiosk pionowy' } else { 'ekran poziomy' })), strona: $adres"
Info "Konto Windows: $uzytkownik$(if ($admin) { ' (z uprawnieniami administratora)' } else { '' })"
if ($admin) {
    Uwaga 'Instalator działa z uprawnieniami administratora. Autostart zostanie utworzony dla konta powyżej –'
    Info  'upewnij się, że to konto, na którym ma działać kiosk (a nie np. konto administratora z okna UAC).'
}

# ── 1. sprawdzenie serwera i przeglądarki ──
Krok 'Sprawdzenie serwera i przeglądarki'
Set-FpzTls
try {
    $d = Invoke-RestMethod -Uri ('{0}/api/device/{1}' -f $Serwer, [Uri]::EscapeDataString($Id)) -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Dobrze "Serwer zna urządzenie: $($d.name) (stan zadany: $($d.power), głośność $($d.volume)%)"
} catch {
    if ((Get-FpzKodHttp $_) -eq 404) { Uwaga "Serwer odpowiada, ale nie zna urządzenia '$Id' – sprawdź identyfikator w panelu (Urządzenia)." }
    else { Uwaga "Brak odpowiedzi serwera ($($_.Exception.Message)). Instaluję mimo to – sprawdź sieć przed testem." }
}
$exe = Find-FpzPrzegladarka $Przegladarka
if ($exe) { Dobrze "Przeglądarka: $exe" }
else {
    Uwaga "Nie znaleziono przeglądarki '$Przegladarka'."
    Recznie "Zainstaluj przeglądarkę $(if ($Przegladarka -eq 'chrome') { 'Google Chrome' } else { 'Microsoft Edge' }) albo zainstaluj kiosk ponownie z -Przegladarka $(if ($Przegladarka -eq 'chrome') { 'edge' } else { 'chrome' })."
}

# ── 2. pliki i konfiguracja ──
Krok "Kopiowanie skryptów do $(Get-FpzKatalogDanych)"
$cel = Get-FpzKatalogDanych
New-FpzKatalog $cel
$pliki = @('fpz-wspolne.ps1', 'uruchom-kiosk.ps1', 'fpz-agent.ps1', 'zatrzymaj-kiosk.ps1', 'sprawdz.ps1', 'odinstaluj-kiosk.ps1', 'instaluj-kiosk.ps1')
$zrodlo = (Resolve-Path -LiteralPath $PSScriptRoot).Path.TrimEnd('\')
foreach ($f in $pliki) {
    $z = Join-Path $zrodlo $f
    if (-not (Test-Path -LiteralPath $z)) { Uwaga "Brak pliku $f obok instalatora – pobierz cały katalog tools/windows."; continue }
    $c = Join-Path $cel $f
    if ($zrodlo -ne $cel.TrimEnd('\')) { Copy-Item -LiteralPath $z -Destination $c -Force }
    try { Unblock-File -LiteralPath $c -ErrorAction Stop } catch { }   # usuwa znacznik „pobrano z internetu”
}
Dobrze 'Skrypty skopiowane.'

$plikCfg = Join-Path $cel 'konfiguracja.json'
$stary = Read-FpzJson $plikCfg
$wygaszaczPoprzedni = $null
if ($stary -and $null -ne $stary.wygaszaczPoprzedni) { $wygaszaczPoprzedni = [string]$stary.wygaszaczPoprzedni }
else {
    try { $wygaszaczPoprzedni = [string](Get-ItemProperty -LiteralPath 'HKCU:\Control Panel\Desktop' -Name ScreenSaveActive -ErrorAction Stop).ScreenSaveActive } catch { $wygaszaczPoprzedni = '1' }
}
$konfig = [ordered]@{
    id                 = $Id
    serwer             = $Serwer
    przegladarka       = $Przegladarka
    rodzaj             = $rodzaj
    adres              = $adres
    bezAgenta          = [bool]$BezAgenta
    restartSystemu     = [bool]$RestartSystemu
    obrot              = $Obrot
    uzytkownik         = $uzytkownik
    wygaszaczPoprzedni = $wygaszaczPoprzedni
    wersja             = $FpzWersja
    zainstalowano      = (Get-Date).ToString('s')
}
try { Write-FpzJson $plikCfg $konfig; Dobrze "Zapisano $plikCfg" }
catch { Write-Host "Nie udało się zapisać konfiguracji: $($_.Exception.Message)" -ForegroundColor Red; exit 4 }
# Nowa instalacja: nie wykonuj wstecz starego polecenia restartu.
Remove-Item -LiteralPath (Join-Path $cel 'stan.json') -Force -ErrorAction SilentlyContinue

# ── 3. autostart i skróty ──
Krok 'Autostart i skróty (bieżący użytkownik)'
$ps51 = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
function New-Skrot([string]$Sciezka, [string]$Skrypt, [string]$Opis, [switch]$Ukryty, [switch]$ZostawOkno) {
    $sh = New-Object -ComObject WScript.Shell
    $l = $sh.CreateShortcut($Sciezka)
    $l.TargetPath = $ps51
    $styl = if ($Ukryty) { '-WindowStyle Hidden ' } else { '' }
    $noexit = if ($ZostawOkno) { '-NoExit ' } else { '' }
    $l.Arguments = ('-NoProfile {0}{1}-ExecutionPolicy Bypass -File "{2}"' -f $noexit, $styl, (Join-Path $cel $Skrypt))
    $l.WorkingDirectory = $cel
    $l.Description = $Opis
    if ($Ukryty) { $l.WindowStyle = 7 }   # zminimalizowane – krótsze mignięcie okna
    $l.Save()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($sh)
}
try {
    $autostart = Join-Path ([Environment]::GetFolderPath('Startup')) 'FPZ Kiosk.lnk'
    New-Skrot -Sciezka $autostart -Skrypt 'uruchom-kiosk.ps1' -Opis 'FPZ Kiosk – start po zalogowaniu' -Ukryty
    Dobrze "Autostart: $autostart"
} catch { Uwaga "Nie udało się utworzyć autostartu: $($_.Exception.Message)" }
try {
    $menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'FPZ Kiosk'
    New-FpzKatalog $menu
    New-Skrot -Sciezka (Join-Path $menu 'FPZ – Uruchom kiosk.lnk') -Skrypt 'uruchom-kiosk.ps1' -Opis 'Uruchamia kiosk FPZ' -Ukryty
    New-Skrot -Sciezka (Join-Path $menu 'FPZ – Zatrzymaj kiosk.lnk') -Skrypt 'zatrzymaj-kiosk.ps1' -Opis 'Wyjście serwisowe z kiosku FPZ'
    New-Skrot -Sciezka (Join-Path $menu 'FPZ – Sprawdź kiosk.lnk') -Skrypt 'sprawdz.ps1' -Opis 'Diagnostyka kiosku FPZ' -ZostawOkno
    Dobrze "Menu Start: $menu"
} catch { Uwaga "Nie udało się utworzyć skrótów w menu Start: $($_.Exception.Message)" }

# ── 4. zasilanie i wygaszacz ──
Krok 'Zasilanie (zasilanie sieciowe) i wygaszacz ekranu'
$bladZasilania = $false
foreach ($ust in @(@('standby-timeout-ac', 'usypianie komputera'), @('monitor-timeout-ac', 'wygaszanie ekranu'), @('hibernate-timeout-ac', 'hibernacja po czasie'))) {
    $out = & powercfg.exe /change $ust[0] 0 2>&1
    if ($LASTEXITCODE -eq 0) { Dobrze "$($ust[1]): nigdy (powercfg /change $($ust[0]) 0)" }
    else { $bladZasilania = $true; Uwaga "$($ust[1]): nie udało się ($(($out | Out-String).Trim()))" }
}
if ($bladZasilania) {
    Recznie 'Zasilanie: uruchom jako administrator:  powercfg /change standby-timeout-ac 0  oraz  powercfg /change monitor-timeout-ac 0  (albo Ustawienia → System → Zasilanie → „Nigdy”).'
}
if ($WylaczHibernacje) {
    if ($admin) {
        $out = & powercfg.exe /hibernate off 2>&1
        if ($LASTEXITCODE -eq 0) { Dobrze 'Hibernacja wyłączona (powercfg /hibernate off).' } else { Uwaga "Nie udało się wyłączyć hibernacji: $(($out | Out-String).Trim())" }
    } else {
        Uwaga 'Wyłączenie hibernacji wymaga administratora – pominięto.'
        Recznie 'Hibernacja (opcjonalnie): w oknie PowerShell „Uruchom jako administrator” wpisz:  powercfg /hibernate off'
    }
} else {
    Info 'Hibernacja: bez zmian (opcjonalnie -WylaczHibernacje jako administrator; czas hibernacji ustawiono na „nigdy”).'
}
try {
    Set-ItemProperty -LiteralPath 'HKCU:\Control Panel\Desktop' -Name ScreenSaveActive -Value '0' -ErrorAction Stop
    Dobrze "Wygaszacz ekranu wyłączony dla bieżącego użytkownika (poprzednio: $wygaszaczPoprzedni)."
    Info 'Jeśli wygaszacz wymusza zasada grupy (komputer w domenie), ustawienie może zostać nadpisane.'
} catch { Uwaga "Nie udało się wyłączyć wygaszacza: $($_.Exception.Message)" }

# ── 5. orientacja ekranu (tylko sprawdzenie) ──
Krok 'Orientacja ekranu (tylko sprawdzenie – instalator jej nie zmienia)'
try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $jest = if ($s.Height -gt $s.Width) { 'pionowo' } else { 'poziomo' }
    if ($jest -eq $Obrot) { Dobrze "Ekran główny: $($s.Width) × $($s.Height) ($jest) – zgodnie z oczekiwaną orientacją." }
    else {
        Uwaga "Ekran główny: $($s.Width) × $($s.Height) ($jest), a dla $Id oczekiwana orientacja to: $Obrot."
        Recznie "Orientacja: Ustawienia → System → Ekran → Orientacja ekranu → $(if ($Obrot -eq 'pionowo') { '„Pionowa” (kiosk 1080 × 1920)' } else { '„Pozioma”' }); skalowanie 100%."
    }
} catch { Info 'Nie udało się odczytać rozdzielczości ekranu.' }

# ── 6. podsumowanie ──
Krok 'Gotowe'
Dobrze "Kiosk uruchomi się automatycznie po zalogowaniu użytkownika $uzytkownik."
Info  "Ręcznie: menu Start → „FPZ – Uruchom kiosk”. Wyjście serwisowe: menu Start → „FPZ – Zatrzymaj kiosk”."
Info  "Diagnostyka: menu Start → „FPZ – Sprawdź kiosk”. Logi: $cel\kiosk.log, $cel\agent.log"

Recznie 'Automatyczne logowanie: Win+R → netplwiz → odznacz „Aby używać tego komputera, użytkownicy muszą wprowadzić nazwę użytkownika i hasło” (Windows 11: najpierw Ustawienia → Konta → Opcje logowania → wyłącz „Zezwalaj tylko na logowanie Windows Hello…”). Najlepiej osobne, lokalne konto standardowe.'
Recznie 'Głośność i dźwięk: sprawdź domyślne urządzenie odtwarzania (Ustawienia → System → Dźwięk) – agent steruje głośnością tego urządzenia.'
Recznie 'Powiadomienia: Ustawienia → System → Powiadomienia → wyłącz (albo „Nie przeszkadzać”); Windows Update → „Godziny aktywnej pracy” obejmujące godziny ekspozycji (np. 6:00–23:00) lub wstrzymanie aktualizacji na czas testu.'
if ($rodzaj -eq 'kiosk') {
    Recznie 'Ekran dotykowy: Ustawienia → Bluetooth i urządzenia → Dotyk → wyłącz gesty trzema i czterema palcami. Przeciągnięcia od krawędzi ekranu można wyłączyć tylko zasadą „Allow edge swipe” (gpedit / Intune) – instalator jej nie zmienia.'
}
Write-Host ''
Write-Host 'Do zrobienia ręcznie:' -ForegroundColor Yellow
$i = 1
foreach ($r in $recznie) { Write-Host ("  {0}. {1}" -f $i, $r); $i++ }
Write-Host ''

if ($UruchomTeraz) {
    $stop = Get-FpzPlikStop
    Remove-Item -LiteralPath $stop -Force -ErrorAction SilentlyContinue
    if (Test-FpzMutex $FpzMutexNadzor) {
        Uwaga 'Kiosk już działa – aby wczytać nową konfigurację, użyj „FPZ – Zatrzymaj kiosk”, a potem „FPZ – Uruchom kiosk”.'
    } else {
        $p = Start-FpzSkryptUkryty -Skrypt (Join-Path $cel 'uruchom-kiosk.ps1')
        Dobrze "Uruchomiono kiosk (PID $($p.Id))."
    }
} else {
    Info 'Aby uruchomić teraz: menu Start → „FPZ – Uruchom kiosk” (albo wyloguj się i zaloguj ponownie).'
}
