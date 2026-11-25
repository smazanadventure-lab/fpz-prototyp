# FPZ Kiosk – funkcje wspólne (dołączane przez pozostałe skrypty: . "$PSScriptRoot\fpz-wspolne.ps1").
# Zgodność: Windows PowerShell 5.1 oraz PowerShell 7. Bez zależności zewnętrznych.

$script:FpzWersja = '1.0'
# $IsWindows nie istnieje w Windows PowerShell 5.1 (tam zawsze jesteśmy na Windows).
$script:FpzNaWindows = ($PSVersionTable.PSVersion.Major -lt 6) -or ($IsWindows -eq $true)

# Nazwy muteksów (jedna kopia nadzorcy i agenta w sesji użytkownika).
$script:FpzMutexNadzor = 'Local\FPZ-Kiosk-Nadzor'
$script:FpzMutexAgent = 'Local\FPZ-Kiosk-Agent'

function Get-FpzKatalogDanych {
    # %ProgramData%\FPZ-Kiosk (skrypty, konfiguracja, logi, plik STOP). Poza Windows (test na sucho) – katalog tymczasowy.
    if ($env:ProgramData) { return (Join-Path $env:ProgramData 'FPZ-Kiosk') }
    return (Join-Path ([IO.Path]::GetTempPath()) 'FPZ-Kiosk')
}

function Get-FpzKatalogProfilu {
    param([string]$Przegladarka = 'edge')
    # Osobny profil przeglądarki kiosku: %LocalAppData%\FPZ-Kiosk\profil\<edge|chrome>
    $baza = $env:LOCALAPPDATA
    if (-not $baza) { $baza = [IO.Path]::GetTempPath() }
    return (Join-Path (Join-Path (Join-Path $baza 'FPZ-Kiosk') 'profil') $Przegladarka)
}

function Get-FpzPlikStop { return (Join-Path (Get-FpzKatalogDanych) 'STOP') }

function New-FpzKatalog {
    param([string]$Sciezka)
    if (-not (Test-Path -LiteralPath $Sciezka)) { $null = New-Item -ItemType Directory -Path $Sciezka -Force }
}

function Write-FpzLog {
    # Dopisuje wiersz do logu (UTF-8) z prostą rotacją: po przekroczeniu 1 MB plik staje się <nazwa>.1
    param(
        [string]$Plik,
        [string]$Tekst,
        [ValidateSet('INFO', 'UWAGA', 'BLAD', 'TEST')][string]$Poziom = 'INFO',
        [switch]$Ekran
    )
    $wiersz = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Poziom, $Tekst
    if ($Ekran) {
        $kolor = switch ($Poziom) { 'BLAD' { 'Red' } 'UWAGA' { 'Yellow' } 'TEST' { 'Cyan' } default { 'Gray' } }
        Write-Host $wiersz -ForegroundColor $kolor
    }
    if (-not $Plik) { return }
    try {
        $kat = Split-Path -Parent $Plik
        if ($kat) { New-FpzKatalog $kat }
        if (Test-Path -LiteralPath $Plik) {
            $len = (Get-Item -LiteralPath $Plik).Length
            if ($len -gt 1MB) { Move-Item -LiteralPath $Plik -Destination ($Plik + '.1') -Force }
        }
        [IO.File]::AppendAllText($Plik, $wiersz + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
    } catch {
        # log nie może zatrzymać programu
    }
}

function Read-FpzJson {
    param([string]$Plik)
    if (-not (Test-Path -LiteralPath $Plik)) { return $null }
    try { return (Get-Content -LiteralPath $Plik -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

function Write-FpzJson {
    param([string]$Plik, $Obiekt)
    $json = $Obiekt | ConvertTo-Json -Depth 5
    [IO.File]::WriteAllText($Plik, $json, (New-Object Text.UTF8Encoding($false)))
}

function Read-FpzKonfiguracja {
    # Szuka konfiguracja.json obok skryptu, potem w katalogu danych.
    param([string]$KatalogSkryptu)
    foreach ($k in @($KatalogSkryptu, (Get-FpzKatalogDanych))) {
        if (-not $k) { continue }
        $c = Read-FpzJson (Join-Path $k 'konfiguracja.json')
        if ($c) { return $c }
    }
    return $null
}

function Get-FpzRodzaj {
    # TZ.* → kiosk pionowy (/kiosk/…), pozostałe (LCD-01, LCD-02, PRJ-01…) → ekran (/lcd/…)
    param([string]$Id)
    if ($Id -like 'TZ.*') { return 'kiosk' }
    return 'lcd'
}

function Get-FpzAdresStrony {
    param([string]$Serwer, [string]$Id)
    $sciezka = if ((Get-FpzRodzaj $Id) -eq 'kiosk') { 'kiosk' } else { 'lcd' }
    return ('{0}/{1}/{2}' -f $Serwer.TrimEnd('/'), $sciezka, [Uri]::EscapeDataString($Id))
}

function Set-FpzTls {
    # Windows PowerShell 5.1 na starszych kompilacjach .NET nie włącza TLS 1.2 domyślnie.
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
}

function Get-FpzKodHttp {
    # Kod HTTP z wyjątku Invoke-RestMethod (5.1: WebException, 7: HttpResponseException); 0 = brak odpowiedzi.
    param($Blad)
    try {
        $r = $Blad.Exception.Response
        if ($r -and $r.StatusCode) { return [int]$r.StatusCode }
    } catch { }
    return 0
}

function Test-FpzMutex {
    # Czy proces trzymający muteks o tej nazwie działa (nadzorca / agent)?
    param([string]$Nazwa)
    try { $m = [Threading.Mutex]::OpenExisting($Nazwa); $m.Dispose(); return $true } catch { return $false }
}

function Find-FpzPrzegladarka {
    # Zwraca pełną ścieżkę msedge.exe / chrome.exe albo $null.
    param([ValidateSet('edge', 'chrome')][string]$Przegladarka = 'edge')
    $exe = if ($Przegladarka -eq 'chrome') { 'chrome.exe' } else { 'msedge.exe' }
    $pf86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
    $kandydaci = @()
    if ($Przegladarka -eq 'chrome') {
        $kandydaci += @(
            (Join-Path "$env:ProgramFiles" 'Google\Chrome\Application\chrome.exe'),
            (Join-Path "$pf86" 'Google\Chrome\Application\chrome.exe'),
            (Join-Path "$env:LOCALAPPDATA" 'Google\Chrome\Application\chrome.exe'))
    } else {
        $kandydaci += @(
            (Join-Path "$pf86" 'Microsoft\Edge\Application\msedge.exe'),
            (Join-Path "$env:ProgramFiles" 'Microsoft\Edge\Application\msedge.exe'),
            (Join-Path "$env:LOCALAPPDATA" 'Microsoft\Edge\Application\msedge.exe'))
    }
    # Rejestr App Paths (tylko odczyt).
    foreach ($klucz in @(
            "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$exe",
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$exe",
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\$exe")) {
        try {
            $v = (Get-ItemProperty -LiteralPath $klucz -ErrorAction Stop).'(default)'
            if ($v) { $kandydaci += $v.Trim('"') }
        } catch { }
    }
    foreach ($k in $kandydaci) {
        if ($k -and (Test-Path -LiteralPath $k -PathType Leaf)) { return $k }
    }
    return $null
}

function Get-FpzArgumentyPrzegladarki {
    param([string]$Przegladarka, [string]$Adres, [string]$Profil)
    # Jeden napis: Start-Process w 5.1 nie dodaje cudzysłowów do elementów tablicy.
    if ($Przegladarka -eq 'chrome') {
        $flagi = @('--kiosk', $Adres, ('"--user-data-dir={0}"' -f $Profil), '--no-first-run', '--noerrdialogs',
            '--disable-session-crashed-bubble', '--autoplay-policy=no-user-gesture-required', '--disable-pinch',
            '--overscroll-history-navigation=0')
    } else {
        $flagi = @('--kiosk', $Adres, '--edge-kiosk-type=fullscreen', ('"--user-data-dir={0}"' -f $Profil), '--no-first-run',
            '--autoplay-policy=no-user-gesture-required', '--disable-features=Translate', '--disable-pinch',
            '--overscroll-history-navigation=0')
    }
    return ($flagi -join ' ')
}

function Get-FpzProcesyCim {
    # Procesy o podanych nazwach z wierszem poleceń (Win32_Process). Poza Windows – pusta lista.
    param([string[]]$Nazwy)
    if (-not $script:FpzNaWindows) { return @() }
    try {
        $filtr = ($Nazwy | ForEach-Object { "Name='$_'" }) -join ' OR '
        return @(Get-CimInstance -ClassName Win32_Process -Filter $filtr -ErrorAction Stop)
    } catch { return @() }
}

function Get-FpzProcesyPrzegladarki {
    # Procesy przeglądarki kiosku = te, których wiersz poleceń zawiera katalog profilu kiosku.
    param([string]$Przegladarka = 'edge')
    $profil = Get-FpzKatalogProfilu $Przegladarka
    $exe = if ($Przegladarka -eq 'chrome') { 'chrome.exe' } else { 'msedge.exe' }
    return @(Get-FpzProcesyCim @($exe) | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($profil, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
}

function Get-FpzProcesySkryptu {
    # Procesy PowerShell uruchomione z danym skryptem (np. 'fpz-agent.ps1'), z pominięciem bieżącego.
    param([string]$Skrypt)
    return @(Get-FpzProcesyCim @('powershell.exe', 'pwsh.exe') | Where-Object {
            $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($Skrypt, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
}

function Start-FpzPrzegladarka {
    # Uruchamia przeglądarkę w trybie kiosku. Zwraca obiekt procesu albo $null.
    param([string]$Przegladarka, [string]$Adres, [string]$LogPlik)
    $exe = Find-FpzPrzegladarka $Przegladarka
    if (-not $exe) {
        Write-FpzLog $LogPlik ("Nie znaleziono przeglądarki '{0}'. Zainstaluj ją albo zmień -Przegladarka w instalatorze." -f $Przegladarka) 'BLAD'
        return $null
    }
    $profil = Get-FpzKatalogProfilu $Przegladarka
    New-FpzKatalog $profil
    $argumenty = Get-FpzArgumentyPrzegladarki -Przegladarka $Przegladarka -Adres $Adres -Profil $profil
    Write-FpzLog $LogPlik ("Start przeglądarki: {0} {1}" -f $exe, $argumenty)
    try { return (Start-Process -FilePath $exe -ArgumentList $argumenty -PassThru -ErrorAction Stop) }
    catch { Write-FpzLog $LogPlik ("Nie udało się uruchomić przeglądarki: {0}" -f $_.Exception.Message) 'BLAD'; return $null }
}

function Stop-FpzPrzegladarka {
    # Zamyka przeglądarkę kiosku: najpierw łagodnie (zamknięcie okna), po 5 s – wymuszenie.
    param([string]$Przegladarka = 'edge', [string]$LogPlik)
    $procs = Get-FpzProcesyPrzegladarki $Przegladarka
    if (-not $procs.Count) { return 0 }
    foreach ($p in $procs) {
        try { $gp = Get-Process -Id $p.ProcessId -ErrorAction Stop; if ($gp.MainWindowHandle -ne [IntPtr]::Zero) { $null = $gp.CloseMainWindow() } } catch { }
    }
    $koniec = (Get-Date).AddSeconds(5)
    while ((Get-Date) -lt $koniec -and (Get-FpzProcesyPrzegladarki $Przegladarka).Count) { Start-Sleep -Milliseconds 500 }
    foreach ($p in (Get-FpzProcesyPrzegladarki $Przegladarka)) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch { }
    }
    Write-FpzLog $LogPlik ("Zamknięto przeglądarkę kiosku ({0} proc.)." -f $procs.Count)
    return $procs.Count
}

function Get-FpzPowershellExe {
    # Ścieżka do bieżącego interpretera (powershell.exe albo pwsh.exe).
    try { $p = (Get-Process -Id $PID).Path; if ($p) { return $p } } catch { }
    return (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
}

function Start-FpzSkryptUkryty {
    # Uruchamia skrypt .ps1 w ukrytym oknie (nowy proces).
    param([string]$Skrypt, [string]$Argumenty = '')
    $a = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" {1}' -f $Skrypt, $Argumenty
    return (Start-Process -FilePath (Get-FpzPowershellExe) -ArgumentList $a.Trim() -WindowStyle Hidden -PassThru)
}

function Test-FpzAdministrator {
    if (-not $script:FpzNaWindows) { return $false }
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}
