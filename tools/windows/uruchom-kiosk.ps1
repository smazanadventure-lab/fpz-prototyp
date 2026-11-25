<#
.SYNOPSIS
  FPZ Kiosk – start po zalogowaniu: przeglądarka w trybie kiosku + agent + nadzór.

.DESCRIPTION
  1. Usuwa plik STOP (nowe uruchomienie = powrót do normalnej pracy).
  2. Czeka na sieć (do 60 s).
  3. Uruchamia agenta (fpz-agent.ps1), o ile nie wybrano -BezAgenta.
  4. Uruchamia przeglądarkę (Edge / Chrome) w trybie kiosku z osobnym profilem.
  5. Pilnuje przeglądarki: jeśli zniknie, uruchamia ją ponownie po kilku sekundach – chyba że istnieje plik STOP
     w %ProgramData%\FPZ-Kiosk (wyjście serwisowe; zob. zatrzymaj-kiosk.ps1). Pilnuje też agenta.
  Wszystko zapisuje w %ProgramData%\FPZ-Kiosk\kiosk.log.
#>
[CmdletBinding()]
param(
    [string]$Id,
    [string]$Serwer,
    [ValidateSet('', 'edge', 'chrome')][string]$Przegladarka = '',
    [switch]$BezAgenta
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'fpz-wspolne.ps1')

$cfg = Read-FpzKonfiguracja $PSScriptRoot
if (-not $Id -and $cfg) { $Id = [string]$cfg.id }
if (-not $Serwer -and $cfg) { $Serwer = [string]$cfg.serwer }
if (-not $Serwer) { $Serwer = 'https://fpz-prototyp.netlify.app' }
$Serwer = $Serwer.TrimEnd('/')
if (-not $Przegladarka) { $Przegladarka = if ($cfg -and $cfg.przegladarka) { [string]$cfg.przegladarka } else { 'edge' } }
if (-not $BezAgenta -and $cfg -and $cfg.bezAgenta -eq $true) { $BezAgenta = $true }

$katalog = Get-FpzKatalogDanych
New-FpzKatalog $katalog
$LOG = Join-Path $katalog 'kiosk.log'
function Log([string]$t, [string]$p = 'INFO') { Write-FpzLog -Plik $LOG -Tekst $t -Poziom $p -Ekran }

if (-not $FpzNaWindows) { Log 'Ten skrypt działa tylko w Windows.' 'BLAD'; exit 3 }
if (-not $Id) { Log 'Brak identyfikatora urządzenia – uruchom najpierw instaluj-kiosk.ps1 albo podaj -Id.' 'BLAD'; exit 2 }

# Jedna kopia nadzorcy w sesji.
try {
    $utworzony = $false
    $muteks = New-Object Threading.Mutex($true, $FpzMutexNadzor, [ref]$utworzony)
    if (-not $utworzony) { Log 'Kiosk już działa w tej sesji (nadzorca aktywny) – kończę.' 'UWAGA'; exit 0 }
} catch { }

$plikStop = Get-FpzPlikStop
$plikRestart = Join-Path $katalog 'RESTART'
if (Test-Path -LiteralPath $plikStop) { Remove-Item -LiteralPath $plikStop -Force -ErrorAction SilentlyContinue; Log 'Usunięto plik STOP – wznawiam pracę kiosku.' }
Remove-Item -LiteralPath $plikRestart -Force -ErrorAction SilentlyContinue

$adres = Get-FpzAdresStrony $Serwer $Id
Log ("Start kiosku: urządzenie {0}, adres {1}, przeglądarka {2}{3}" -f $Id, $adres, $Przegladarka, $(if ($BezAgenta) { ', bez agenta' } else { '' }))

# ── czekanie na sieć (do 60 s) ──
Set-FpzTls
$test = '{0}/api/device/{1}' -f $Serwer, [Uri]::EscapeDataString($Id)
$limit = (Get-Date).AddSeconds(60); $siec = $false
while ((Get-Date) -lt $limit) {
    try { $null = Invoke-RestMethod -Uri $test -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop; $siec = $true; break }
    catch { if ((Get-FpzKodHttp $_) -gt 0) { $siec = $true; break } }   # serwer odpowiada (np. 404) – sieć jest
    Start-Sleep -Seconds 3
}
if ($siec) { Log 'Serwer odpowiada.' } else { Log 'Brak odpowiedzi serwera po 60 s – uruchamiam mimo to (strona poczeka na sieć).' 'UWAGA' }

# ── agent ──
$skryptAgenta = Join-Path $PSScriptRoot 'fpz-agent.ps1'
function Start-Agent {
    if ($BezAgenta) { return }
    if (Test-FpzMutex $FpzMutexAgent) { return }
    if (-not (Test-Path -LiteralPath $skryptAgenta)) { Log "Brak pliku $skryptAgenta" 'BLAD'; return }
    try { $p = Start-FpzSkryptUkryty -Skrypt $skryptAgenta; Log ("Uruchomiono agenta (PID {0})." -f $p.Id) }
    catch { Log ("Nie udało się uruchomić agenta: " + $_.Exception.Message) 'BLAD' }
}
Start-Agent

# ── przeglądarka + pętla nadzoru ──
if ((Get-FpzProcesyPrzegladarki $Przegladarka).Count -eq 0) { $null = Start-FpzPrzegladarka -Przegladarka $Przegladarka -Adres $adres -LogPlik $LOG }
else { Log 'Przeglądarka kiosku już działa – przejmuję nadzór.' }

$OKRES = 3                  # s – sprawdzanie procesów
$OPOZNIENIE = 5             # s – ponowny start po zniknięciu przeglądarki
$OPOZNIENIE_DLUGIE = 60     # s – gdy przeglądarka pada raz za razem
$starty = New-Object System.Collections.ArrayList
$brakOd = $null
$bezOknaOd = $null
$stopZgloszony = $false
$agentSprawdzony = Get-Date

while ($true) {
    Start-Sleep -Seconds $OKRES
    try {
        if (Test-Path -LiteralPath $plikStop) {
            if (-not $stopZgloszony) { Log 'Plik STOP – nie uruchamiam ponownie przeglądarki (usuń STOP, aby wznowić).'; $stopZgloszony = $true }
            continue
        }
        if ($stopZgloszony) { Log 'Plik STOP usunięty – wznawiam nadzór.'; $stopZgloszony = $false }

        if (((Get-Date) - $agentSprawdzony).TotalSeconds -ge 30) {
            $agentSprawdzony = Get-Date
            if (-not $BezAgenta -and -not (Test-FpzMutex $FpzMutexAgent)) { Log 'Agent nie działa – uruchamiam ponownie.' 'UWAGA'; Start-Agent }
        }

        $procs = Get-FpzProcesyPrzegladarki $Przegladarka
        if ($procs.Count -gt 0) {
            $brakOd = $null
            # Procesy są, ale bez okna (np. przeglądarka została w tle po zamknięciu okna) – po 20 s zamykamy je.
            $okno = $false
            foreach ($p in $procs) { try { if ((Get-Process -Id $p.ProcessId -ErrorAction Stop).MainWindowHandle -ne [IntPtr]::Zero) { $okno = $true; break } } catch { } }
            if ($okno) { $bezOknaOd = $null; continue }
            if (-not $bezOknaOd) { $bezOknaOd = Get-Date; continue }
            if (((Get-Date) - $bezOknaOd).TotalSeconds -lt 20) { continue }
            Log 'Przeglądarka kiosku działa bez okna – zamykam ją, by uruchomić od nowa.' 'UWAGA'
            foreach ($p in $procs) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch { } }
            $bezOknaOd = $null
            continue
        }
        $bezOknaOd = $null

        if (Test-Path -LiteralPath $plikRestart) {
            # Restart zlecony z panelu (agent zamknął przeglądarkę) – start od razu, bez liczenia jako awaria.
            Remove-Item -LiteralPath $plikRestart -Force -ErrorAction SilentlyContinue
            Log 'Restart z panelu – uruchamiam przeglądarkę.'
            $null = Start-FpzPrzegladarka -Przegladarka $Przegladarka -Adres $adres -LogPlik $LOG
            $brakOd = $null
            continue
        }

        if (-not $brakOd) { $brakOd = Get-Date; Log 'Przeglądarka kiosku zniknęła (zamknięcie / awaria).' 'UWAGA' }
        $teraz = Get-Date
        while ($starty.Count -and ($teraz - $starty[0]).TotalMinutes -gt 5) { $starty.RemoveAt(0) }
        $czekaj = if ($starty.Count -ge 5) { $OPOZNIENIE_DLUGIE } else { $OPOZNIENIE }
        if (($teraz - $brakOd).TotalSeconds -ge $czekaj) {
            if ($czekaj -eq $OPOZNIENIE_DLUGIE) { Log 'Przeglądarka pada raz za razem – kolejne próby co 60 s.' 'UWAGA' }
            [void]$starty.Add($teraz)
            $null = Start-FpzPrzegladarka -Przegladarka $Przegladarka -Adres $adres -LogPlik $LOG
            $brakOd = $null
        }
    } catch {
        Log ("Błąd pętli nadzoru (działam dalej): " + $_.Exception.Message) 'BLAD'
    }
}
