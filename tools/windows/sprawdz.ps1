<#
.SYNOPSIS
  FPZ Kiosk – diagnostyka: konfiguracja, serwer, stan urządzenia, procesy, ostatnie wpisy w logach.
  Niczego nie zmienia.
#>
[CmdletBinding()]
param(
    [string]$Id,
    [string]$Serwer,
    [int]$Wiersze = 15
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'fpz-wspolne.ps1')

function Naglowek([string]$t) { Write-Host ''; Write-Host "── $t ──" -ForegroundColor Cyan }
function Dobrze([string]$t) { Write-Host "  [OK] $t" -ForegroundColor Green }
function Zle([string]$t) { Write-Host "  [!!] $t" -ForegroundColor Yellow }
function Info([string]$t) { Write-Host "       $t" }

$katalog = Get-FpzKatalogDanych
$cfg = Read-FpzKonfiguracja $PSScriptRoot
if (-not $Id -and $cfg) { $Id = [string]$cfg.id }
if (-not $Serwer -and $cfg) { $Serwer = [string]$cfg.serwer }
if (-not $Serwer) { $Serwer = 'https://fpz-prototyp.netlify.app' }
$Serwer = $Serwer.TrimEnd('/')
$przegladarka = if ($cfg -and $cfg.przegladarka) { [string]$cfg.przegladarka } else { 'edge' }

Write-Host "FPZ Kiosk – diagnostyka ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan

Naglowek 'Konfiguracja'
if ($cfg) { Dobrze "konfiguracja.json: id=$($cfg.id), serwer=$($cfg.serwer), przeglądarka=$($cfg.przegladarka), agent=$(if ($cfg.bezAgenta) { 'nie' } else { 'tak' })" }
else { Zle "Brak konfiguracja.json w $katalog – uruchom instaluj-kiosk.ps1." }
if (-not $Id) { Zle 'Nie znam identyfikatora urządzenia (-Id).'; exit 2 }
Info ("Adres strony: " + (Get-FpzAdresStrony $Serwer $Id))
Info ("Katalog danych: $katalog")
if (Test-Path -LiteralPath (Get-FpzPlikStop)) { Zle 'Istnieje plik STOP – kiosk w trybie serwisowym (nie jest pilnowany).' } else { Dobrze 'Brak pliku STOP.' }

if ($FpzNaWindows) {
    $lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'FPZ Kiosk.lnk'
    if (Test-Path -LiteralPath $lnk) { Dobrze "Autostart: $lnk" } else { Zle 'Brak skrótu w folderze Autostart (shell:startup).' }
}

Naglowek 'Serwer'
Set-FpzTls
$adres = '{0}/api/device/{1}' -f $Serwer, [Uri]::EscapeDataString($Id)
$sw = [Diagnostics.Stopwatch]::StartNew()
try {
    $d = Invoke-RestMethod -Uri $adres -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Dobrze ("Serwer odpowiada ({0} ms): {1}" -f $sw.ElapsedMilliseconds, $adres)
    Info ("Urządzenie: {0} – {1} ({2})" -f $d.id, $d.name, $d.kind)
    Info ("Zadane: power={0}, harmonogram={1}, noc={2}, głośność={3}, jasność={4}, ostatni restart={5}" -f $d.power, $d.schedule, $d.night, $d.volume, $d.brightness, $d.restartedAt)
} catch {
    $kod = Get-FpzKodHttp $_
    if ($kod -eq 404) { Zle "Serwer nie zna urządzenia '$Id' (404) – sprawdź identyfikator." }
    else { Zle ("Brak odpowiedzi serwera: {0}" -f $_.Exception.Message) }
}
try {
    $p = Invoke-RestMethod -Uri "$Serwer/api/presence" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    $b = $p.beats.$Id
    foreach ($src in @('agent', 'page')) {
        $x = $b.$src
        $nazwa = if ($src -eq 'agent') { 'Sygnał agenta' } else { 'Sygnał strony' }
        if ($x) {
            $wiek = [Math]::Round(([double]$p.now - [double]$x.at) / 1000)
            $txt = "$nazwa sprzed $wiek s"
            if ($src -eq 'agent') { $txt += " – host=$($x.host), monitor=$($x.monitor), głośność=$($x.volume), cpu=$($x.cpu)%" }
            if ($wiek -le 100) { Dobrze $txt } else { Zle "$txt (nieaktualny)" }
            if ($x.note) { Info "uwagi: $($x.note)" }
        } else { Zle "${nazwa}: brak" }
    }
} catch { Zle ("Nie udało się odczytać /api/presence: {0}" -f $_.Exception.Message) }

if ($FpzNaWindows) {
    Naglowek 'Procesy'
    $n = Get-FpzProcesySkryptu 'uruchom-kiosk.ps1'
    if ($n.Count -or (Test-FpzMutex $FpzMutexNadzor)) { Dobrze ("Nadzór (uruchom-kiosk.ps1) działa {0}" -f (($n | ForEach-Object { "PID $($_.ProcessId)" }) -join ', ')) } else { Zle 'Nadzór (uruchom-kiosk.ps1) nie działa.' }
    $a = Get-FpzProcesySkryptu 'fpz-agent.ps1'
    if ($a.Count -or (Test-FpzMutex $FpzMutexAgent)) { Dobrze ("Agent (fpz-agent.ps1) działa {0}" -f (($a | ForEach-Object { "PID $($_.ProcessId)" }) -join ', ')) }
    elseif ($cfg -and $cfg.bezAgenta) { Info 'Agent wyłączony w konfiguracji (-BezAgenta).' } else { Zle 'Agent (fpz-agent.ps1) nie działa.' }
    $pr = Get-FpzProcesyPrzegladarki $przegladarka
    if ($pr.Count) { Dobrze ("Przeglądarka kiosku ({0}) działa: {1} proc." -f $przegladarka, $pr.Count) } else { Zle "Przeglądarka kiosku ($przegladarka) nie działa." }
    $exe = Find-FpzPrzegladarka $przegladarka
    if ($exe) { Info "Plik przeglądarki: $exe" } else { Zle "Nie znaleziono pliku przeglądarki '$przegladarka'." }

    Naglowek 'Sterowanie sprzętem (agent -Diagnostyka)'
    $ag = Join-Path $PSScriptRoot 'fpz-agent.ps1'
    if (Test-Path -LiteralPath $ag) { & $ag -Diagnostyka } else { Zle "Brak $ag" }

    Naglowek 'Ekran'
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        foreach ($s in [System.Windows.Forms.Screen]::AllScreens) {
            $o = if ($s.Bounds.Height -gt $s.Bounds.Width) { 'pionowo' } else { 'poziomo' }
            Info ("{0}: {1} × {2} ({3}){4}" -f $s.DeviceName, $s.Bounds.Width, $s.Bounds.Height, $o, $(if ($s.Primary) { ', główny' } else { '' }))
        }
    } catch { Info 'Nie udało się odczytać ekranów.' }
}

foreach ($plik in @('agent.log', 'kiosk.log')) {
    Naglowek "Ostatnie wiersze: $plik"
    $sc = Join-Path $katalog $plik
    if (Test-Path -LiteralPath $sc) { Get-Content -LiteralPath $sc -Tail $Wiersze -Encoding UTF8 | ForEach-Object { Info $_ } } else { Info '(brak pliku)' }
}
Write-Host ''
