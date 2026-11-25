<#
.SYNOPSIS
  FPZ Kiosk – wyjście serwisowe: zatrzymuje nadzór, agenta i przeglądarkę kiosku.

.DESCRIPTION
  Tworzy plik %ProgramData%\FPZ-Kiosk\STOP (nadzór nie uruchomi już przeglądarki ponownie), a następnie zamyka
  nadzorcę (uruchom-kiosk.ps1), agenta (fpz-agent.ps1) i przeglądarkę kiosku. Pulpit Windows jest wtedy dostępny.
  Powrót do pracy: skrót „FPZ – Uruchom kiosk” w menu Start albo ponowne zalogowanie (autostart usuwa plik STOP).
#>
[CmdletBinding()]
param(
    [ValidateSet('', 'edge', 'chrome')][string]$Przegladarka = '',
    [switch]$BezPauzy
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'fpz-wspolne.ps1')

if (-not $FpzNaWindows) { Write-Host 'Ten skrypt działa tylko w Windows.' -ForegroundColor Red; exit 3 }

$cfg = Read-FpzKonfiguracja $PSScriptRoot
if (-not $Przegladarka) { $Przegladarka = if ($cfg -and $cfg.przegladarka) { [string]$cfg.przegladarka } else { 'edge' } }
$katalog = Get-FpzKatalogDanych
New-FpzKatalog $katalog
$LOG = Join-Path $katalog 'kiosk.log'

New-Item -ItemType File -Path (Get-FpzPlikStop) -Force | Out-Null
Write-FpzLog -Plik $LOG -Tekst 'Zatrzymanie kiosku (zatrzymaj-kiosk.ps1) – utworzono plik STOP.' -Ekran

$n = 0
foreach ($skrypt in @('uruchom-kiosk.ps1', 'fpz-agent.ps1')) {
    foreach ($p in (Get-FpzProcesySkryptu $skrypt)) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $n++; Write-FpzLog -Plik $LOG -Tekst ("Zatrzymano {0} (PID {1})." -f $skrypt, $p.ProcessId) -Ekran }
        catch { Write-FpzLog -Plik $LOG -Tekst ("Nie udało się zatrzymać {0} (PID {1}): {2}" -f $skrypt, $p.ProcessId, $_.Exception.Message) -Poziom 'UWAGA' -Ekran }
    }
}
$b = Stop-FpzPrzegladarka -Przegladarka $Przegladarka -LogPlik $LOG

Write-Host ''
Write-Host ("Kiosk zatrzymany (skrypty: {0}, procesy przeglądarki: {1})." -f $n, $b) -ForegroundColor Green
Write-Host 'Wznowienie: menu Start → „FPZ – Uruchom kiosk” albo wyloguj się i zaloguj ponownie.'
if (-not $BezPauzy) { Start-Sleep -Seconds 4 }
