<#
.SYNOPSIS
  FPZ Kiosk – odinstalowanie.

.DESCRIPTION
  Zatrzymuje nadzór, agenta i przeglądarkę kiosku, usuwa autostart i skróty z menu Start, przywraca czasy
  wygaszania ekranu (15 min) i usypiania komputera (30 min) na zasilaniu sieciowym oraz wygaszacz ekranu.
  Z -UsunDane usuwa też %ProgramData%\FPZ-Kiosk (skrypty, logi) i %LocalAppData%\FPZ-Kiosk (profil przeglądarki).
#>
[CmdletBinding()]
param(
    [switch]$UsunDane
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'fpz-wspolne.ps1')
function Dobrze([string]$t) { Write-Host "  [OK] $t" -ForegroundColor Green }
function Uwaga([string]$t) { Write-Host "  [!!] $t" -ForegroundColor Yellow }

if (-not $FpzNaWindows) { Write-Host 'Ten skrypt działa tylko w Windows.' -ForegroundColor Red; exit 3 }
Write-Host 'FPZ Kiosk – odinstalowanie' -ForegroundColor Cyan

$katalog = Get-FpzKatalogDanych
$cfg = Read-FpzKonfiguracja $PSScriptRoot
$przegladarka = if ($cfg -and $cfg.przegladarka) { [string]$cfg.przegladarka } else { 'edge' }

# 1. zatrzymanie
if (Test-Path -LiteralPath $katalog) { New-Item -ItemType File -Path (Get-FpzPlikStop) -Force | Out-Null }
foreach ($skrypt in @('uruchom-kiosk.ps1', 'fpz-agent.ps1')) {
    foreach ($p in (Get-FpzProcesySkryptu $skrypt)) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Dobrze "Zatrzymano $skrypt (PID $($p.ProcessId))." } catch { Uwaga "Nie zatrzymano $skrypt (PID $($p.ProcessId))." }
    }
}
$n = Stop-FpzPrzegladarka -Przegladarka $przegladarka
Dobrze "Przeglądarka kiosku zamknięta ($n proc.)."

# 2. autostart i skróty
$autostart = Join-Path ([Environment]::GetFolderPath('Startup')) 'FPZ Kiosk.lnk'
if (Test-Path -LiteralPath $autostart) { Remove-Item -LiteralPath $autostart -Force; Dobrze "Usunięto autostart: $autostart" } else { Dobrze 'Autostartu nie było.' }
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'FPZ Kiosk'
if (Test-Path -LiteralPath $menu) { Remove-Item -LiteralPath $menu -Recurse -Force; Dobrze "Usunięto skróty z menu Start." }

# 3. zasilanie i wygaszacz
$blad = $false
foreach ($ust in @(@('monitor-timeout-ac', 15), @('standby-timeout-ac', 30))) {
    $out = & powercfg.exe /change $ust[0] $ust[1] 2>&1
    if ($LASTEXITCODE -eq 0) { Dobrze "powercfg /change $($ust[0]) $($ust[1])" } else { $blad = $true; Uwaga "powercfg /change $($ust[0]) $($ust[1]): $(($out | Out-String).Trim())" }
}
if ($blad) { Uwaga 'Przywróć czasy ręcznie: Ustawienia → System → Zasilanie (albo powyższe polecenia jako administrator).' }
$wyg = if ($cfg -and $null -ne $cfg.wygaszaczPoprzedni) { [string]$cfg.wygaszaczPoprzedni } else { '1' }
try { Set-ItemProperty -LiteralPath 'HKCU:\Control Panel\Desktop' -Name ScreenSaveActive -Value $wyg -ErrorAction Stop; Dobrze "Wygaszacz ekranu: przywrócono ScreenSaveActive=$wyg." } catch { Uwaga 'Nie udało się przywrócić wygaszacza.' }
Write-Host '       Hibernacji nie przywracam automatycznie – jeśli była wyłączona: powercfg /hibernate on (administrator).'

# 4. dane
$profil = Join-Path $env:LOCALAPPDATA 'FPZ-Kiosk'
if ($UsunDane) {
    Start-Sleep -Seconds 1
    foreach ($k in @($profil, $katalog)) {
        if (Test-Path -LiteralPath $k) {
            try { Remove-Item -LiteralPath $k -Recurse -Force -ErrorAction Stop; Dobrze "Usunięto $k" } catch { Uwaga "Nie udało się usunąć $k – $($_.Exception.Message)" }
        }
    }
} else {
    if (Test-Path -LiteralPath $katalog) { Remove-Item -LiteralPath (Get-FpzPlikStop) -Force -ErrorAction SilentlyContinue }
    Write-Host "       Pozostawiono dane: $katalog (skrypty, logi) i $profil (profil przeglądarki). Usunięcie: -UsunDane."
}
Write-Host 'Odinstalowano.' -ForegroundColor Green
