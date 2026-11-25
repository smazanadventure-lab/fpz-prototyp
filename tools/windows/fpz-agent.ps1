<#
.SYNOPSIS
  FPZ Kiosk – program sterujący (agent) na komputerze kiosku / ekranu.

.DESCRIPTION
  Co kilka sekund odczytuje z serwera zadany stan urządzenia (GET {serwer}/api/device/{id}) i wykonuje go fizycznie:
    - power ≠ "on"  → usypia monitor (SC_MONITORPOWER), power = "on" → budzi monitor i nie pozwala mu zgasnąć,
    - volume        → głośność systemowa (Core Audio),
    - brightness    → jasność (WMI – zwykle tylko wbudowane ekrany laptopów),
    - restartedAt   → ponowne uruchomienie przeglądarki kiosku (albo całego systemu z -RestartSystemu).
  Co ok. 30 s wysyła sygnał z danymi komputera (POST {serwer}/api/beat), które panel pokazuje jako stan rzeczywisty.
  Błędy sieci i sterowania są łapane i zapisywane w logu – agent działa dalej.

.PARAMETER Id
  Identyfikator urządzenia, np. TZ.T1.3, LCD-01. Domyślnie z konfiguracja.json.
.PARAMETER Serwer
  Adres serwera, np. https://fpz-prototyp.netlify.app. Domyślnie z konfiguracja.json.
.PARAMETER Okres
  Co ile sekund odpytywać serwer (domyślnie 5).
.PARAMETER Test
  Tryb na sucho: niczego nie zmienia na komputerze, tylko wypisuje, co by zrobił, i wysyła sygnały.
  Działa także w PowerShell 7 na Linuksie/macOS.
.PARAMETER RestartSystemu
  Polecenie „Restart” z panelu restartuje cały komputer (Restart-Computer) zamiast samej przeglądarki.
.PARAMETER MaksCzas
  Zakończ po tylu sekundach (0 = bez końca). Przydatne w testach.
.PARAMETER Diagnostyka
  Sprawdza tylko, czy działa sterowanie (kompilacja definicji natywnych, odczyt głośności, jasności, danych systemu) i kończy.
  Niczego nie zmienia.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\fpz-agent.ps1 -Id TZ.T1.3 -Test
#>
[CmdletBinding()]
param(
    [string]$Id,
    [string]$Serwer,
    [ValidateRange(1, 300)][int]$Okres = 5,
    [switch]$Test,
    [switch]$RestartSystemu,
    [int]$MaksCzas = 0,
    [switch]$Diagnostyka
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'fpz-wspolne.ps1')

$WERSJA = "agent $FpzWersja"
$OKRES_SYGNALU = 30          # s – sygnał do serwera
$MIN_PONOW_USPIENIA = 60     # s – najczęściej ponawiane uśpienie ekranu, gdy coś go obudziło
$OKRES_CZUWANIA = 60         # s – odświeżanie SetThreadExecutionState

# ───────────────────────── konfiguracja ─────────────────────────
$cfg = Read-FpzKonfiguracja $PSScriptRoot
if (-not $Id -and $cfg) { $Id = [string]$cfg.id }
if (-not $Serwer -and $cfg) { $Serwer = [string]$cfg.serwer }
if (-not $Serwer) { $Serwer = 'https://fpz-prototyp.netlify.app' }
$Serwer = $Serwer.TrimEnd('/')
if (-not $RestartSystemu -and $cfg -and $cfg.restartSystemu -eq $true) { $RestartSystemu = $true }
$przegladarka = 'edge'
if ($cfg -and $cfg.przegladarka) { $przegladarka = [string]$cfg.przegladarka }

$katalog = Get-FpzKatalogDanych
New-FpzKatalog $katalog
$LOG = Join-Path $katalog 'agent.log'
$PLIK_STANU = if ($Test) { Join-Path $katalog 'stan-test.json' } else { Join-Path $katalog 'stan.json' }

function Log([string]$t, [string]$p = 'INFO') { Write-FpzLog -Plik $LOG -Tekst $t -Poziom $p -Ekran }
function NaSucho([string]$t) { Log ("[NA SUCHO] " + $t) 'TEST' }

if (-not $Id -and -not $Diagnostyka) {
    Log 'Brak identyfikatora urządzenia: podaj -Id (np. -Id TZ.T1.3) albo uruchom instalator.' 'BLAD'
    exit 2
}

# ───────────────────────── definicje natywne (Windows) ─────────────────────────
# Uwaga: składnia C# zgodna z kompilatorem Windows PowerShell 5.1 (C# 5) – bez interpolacji, „out var” itp.
$KOD_NATYWNY = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace FpzKiosk
{
    public static class Ekran
    {
        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam,
            uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);

        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        [DllImport("kernel32.dll")]
        private static extern uint SetThreadExecutionState(uint esFlags);

        [StructLayout(LayoutKind.Sequential)]
        private struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

        private static readonly IntPtr HWND_BROADCAST = new IntPtr(0xFFFF);
        private const uint WM_SYSCOMMAND = 0x0112;
        private const int SC_MONITORPOWER = 0xF170;
        private const uint SMTO_ABORTIFHUNG = 0x0002;
        private const uint MOUSEEVENTF_MOVE = 0x0001;
        private const uint ES_CONTINUOUS = 0x80000000;
        private const uint ES_SYSTEM_REQUIRED = 0x00000001;
        private const uint ES_DISPLAY_REQUIRED = 0x00000002;

        /// <summary>Usypia monitor(y): SC_MONITORPOWER = 2 (wyłączenie). SendMessageTimeout zamiast SendMessage – nie zawiesza się na nieodpowiadającym oknie.</summary>
        public static void Uspij()
        {
            UIntPtr wynik;
            SendMessageTimeout(HWND_BROADCAST, WM_SYSCOMMAND, new IntPtr(SC_MONITORPOWER), new IntPtr(2),
                SMTO_ABORTIFHUNG, 2000, out wynik);
        }

        /// <summary>Budzi monitor: ruch myszy o 1 px i z powrotem (SC_MONITORPOWER = -1 nie działa niezawodnie od Windows 8).</summary>
        public static void Obudz()
        {
            mouse_event(MOUSEEVENTF_MOVE, 1, 0, 0, UIntPtr.Zero);
            Thread.Sleep(50);
            mouse_event(MOUSEEVENTF_MOVE, -1, 0, 0, UIntPtr.Zero);
        }

        /// <summary>Czuwanie: ekran=true → system i ekran nie usypiają; ekran=false → tylko system nie usypia. Zwraca poprzedni stan (0 = błąd).</summary>
        public static uint Czuwanie(bool ekran)
        {
            uint flagi = ES_CONTINUOUS | ES_SYSTEM_REQUIRED;
            if (ekran) flagi |= ES_DISPLAY_REQUIRED;
            return SetThreadExecutionState(flagi);
        }

        /// <summary>Znacznik czasu (GetTickCount) ostatniego wejścia: mysz, klawiatura, dotyk.</summary>
        public static uint OstatnieWejscie()
        {
            LASTINPUTINFO lii = new LASTINPUTINFO();
            lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
            if (!GetLastInputInfo(ref lii)) return 0;
            return lii.dwTime;
        }
    }

    // ── Core Audio: IMMDeviceEnumerator → IMMDevice → IAudioEndpointVolume (mmdeviceapi.h, endpointvolume.h).
    // Kolejność metod = kolejność w tablicy wirtualnej (vtable) – nie zmieniać.
    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDeviceEnumerator
    {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams,
            [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    }

    [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioEndpointVolume
    {
        [PreserveSig] int RegisterControlChangeNotify(IntPtr pNotify);
        [PreserveSig] int UnregisterControlChangeNotify(IntPtr pNotify);
        [PreserveSig] int GetChannelCount(out uint pnChannelCount);
        [PreserveSig] int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
        [PreserveSig] int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
        [PreserveSig] int GetMasterVolumeLevel(out float pfLevelDB);
        [PreserveSig] int GetMasterVolumeLevelScalar(out float pfLevel);
        [PreserveSig] int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
        [PreserveSig] int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
        [PreserveSig] int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        [PreserveSig] int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    internal class MMDeviceEnumeratorCom { }

    public static class Dzwiek
    {
        private const int eRender = 0;
        private const int eMultimedia = 1;
        private const int CLSCTX_ALL = 23;

        private static IAudioEndpointVolume Glosnik()
        {
            IMMDeviceEnumerator en = (IMMDeviceEnumerator)(new MMDeviceEnumeratorCom());
            IMMDevice dev = null;
            try
            {
                Marshal.ThrowExceptionForHR(en.GetDefaultAudioEndpoint(eRender, eMultimedia, out dev));
                Guid iid = typeof(IAudioEndpointVolume).GUID;
                object o;
                Marshal.ThrowExceptionForHR(dev.Activate(ref iid, CLSCTX_ALL, IntPtr.Zero, out o));
                return (IAudioEndpointVolume)o;
            }
            finally
            {
                if (dev != null) Marshal.ReleaseComObject(dev);
                Marshal.ReleaseComObject(en);
            }
        }

        /// <summary>Głośność domyślnego urządzenia odtwarzania 0–100 (wyciszone → 0).</summary>
        public static int Pobierz()
        {
            IAudioEndpointVolume v = Glosnik();
            try
            {
                float f;
                Marshal.ThrowExceptionForHR(v.GetMasterVolumeLevelScalar(out f));
                bool m;
                if (v.GetMute(out m) == 0 && m) return 0;
                return (int)Math.Round(f * 100.0);
            }
            finally { Marshal.ReleaseComObject(v); }
        }

        /// <summary>Ustawia głośność 0–100; 0 = wyciszenie, &gt;0 = wyłączenie wyciszenia.</summary>
        public static void Ustaw(int procent)
        {
            if (procent < 0) procent = 0;
            if (procent > 100) procent = 100;
            IAudioEndpointVolume v = Glosnik();
            try
            {
                Guid ctx = Guid.Empty;
                Marshal.ThrowExceptionForHR(v.SetMasterVolumeLevelScalar(procent / 100.0f, ref ctx));
                Marshal.ThrowExceptionForHR(v.SetMute(procent == 0, ref ctx));
            }
            finally { Marshal.ReleaseComObject(v); }
        }
    }
}
'@

$natywne = $false
function Initialize-Natywne {
    if ('FpzKiosk.Ekran' -as [type]) { $script:natywne = $true; return $true }
    try {
        Add-Type -TypeDefinition $KOD_NATYWNY -Language CSharp -ErrorAction Stop
        $script:natywne = $true
    } catch {
        Log ("Nie udało się skompilować definicji natywnych (user32/Core Audio): " + $_.Exception.Message) 'BLAD'
        $script:natywne = $false
    }
    return $script:natywne
}

# ───────────────────────── sprzęt ─────────────────────────
function Get-Glosnosc {
    if (-not ($FpzNaWindows -and $natywne)) { return $null }
    try { return [FpzKiosk.Dzwiek]::Pobierz() } catch { return $null }
}

function Get-JasnoscObiekty {
    if (-not $FpzNaWindows) { return @() }
    try { return @(Get-CimInstance -Namespace 'root/WMI' -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop) } catch { return @() }
}

function Get-Jasnosc {
    if (-not $FpzNaWindows) { return $null }
    try {
        $b = @(Get-CimInstance -Namespace 'root/WMI' -ClassName WmiMonitorBrightness -ErrorAction Stop)
        if ($b.Count) { return [int]$b[0].CurrentBrightness }
    } catch { }
    return $null
}

function Set-Jasnosc([int]$v) {
    $m = Get-JasnoscObiekty
    if (-not $m.Count) { return $false }
    foreach ($x in $m) {
        $null = Invoke-CimMethod -InputObject $x -MethodName WmiSetBrightness -Arguments @{ Timeout = [uint32]0; Brightness = [byte]([Math]::Max(0, [Math]::Min(100, $v))) } -ErrorAction Stop
    }
    return $true
}

$script:nazwaSystemu = $null
function Get-NazwaSystemu {
    if ($script:nazwaSystemu) { return $script:nazwaSystemu }
    $n = $null
    if ($FpzNaWindows) {
        try {
            $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
            $n = ($os.Caption -replace '^Microsoft\s+', '').Trim()
            $wer = $null
            try {
                $r = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction Stop
                if ($r.DisplayVersion) { $wer = $r.DisplayVersion } elseif ($r.ReleaseId) { $wer = $r.ReleaseId }
            } catch { }
            if ($wer) { $n = "$n $wer" }
            $n = "$n (kompilacja $($os.BuildNumber))"
        } catch { $n = 'Windows' }
    } else {
        try { $n = [Runtime.InteropServices.RuntimeInformation]::OSDescription } catch { $n = [Environment]::OSVersion.VersionString }
    }
    $script:nazwaSystemu = $n
    return $n
}

function Get-Telemetria {
    # Zwraca: host, os, cpu, memPct, diskFreeGb, uptimeH (brakujące = $null).
    $t = [ordered]@{ host = [Environment]::MachineName; os = (Get-NazwaSystemu); cpu = $null; memPct = $null; diskFreeGb = $null; uptimeH = $null }
    if ($FpzNaWindows) {
        try {
            $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
            if ($os.TotalVisibleMemorySize -gt 0) { $t.memPct = [Math]::Round(100.0 * ($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) }
            $t.uptimeH = [Math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
        } catch { }
        try {
            $l = (Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop | Measure-Object -Property LoadPercentage -Average).Average
            if ($null -eq $l) {
                $l = (Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -ErrorAction Stop).PercentProcessorTime
            }
            if ($null -ne $l) { $t.cpu = [Math]::Round([double]$l, 1) }
        } catch { }
        try {
            $sd = $env:SystemDrive; if (-not $sd) { $sd = 'C:' }
            $d = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$sd'" -ErrorAction Stop
            if ($d) { $t.diskFreeGb = [Math]::Round($d.FreeSpace / 1GB, 1) }
        } catch { }
    } else {
        # Tryb testowy poza Windows – przybliżone dane z /proc (Linux).
        try {
            $mi = Get-Content '/proc/meminfo' -ErrorAction Stop
            $tot = [double](($mi | Where-Object { $_ -like 'MemTotal:*' }) -replace '\D', '')
            $av = [double](($mi | Where-Object { $_ -like 'MemAvailable:*' }) -replace '\D', '')
            if ($tot -gt 0) { $t.memPct = [Math]::Round(100.0 * ($tot - $av) / $tot) }
        } catch { }
        try { $t.uptimeH = [Math]::Round([double]((Get-Content '/proc/uptime' -Raw -ErrorAction Stop).Split(' ')[0]) / 3600, 1) } catch { }
        try {
            $la = [double]((Get-Content '/proc/loadavg' -Raw -ErrorAction Stop).Split(' ')[0])
            $t.cpu = [Math]::Round([Math]::Min(100, 100 * $la / [Environment]::ProcessorCount), 1)
        } catch { }
        try { $t.diskFreeGb = [Math]::Round((New-Object IO.DriveInfo('/')).AvailableFreeSpace / 1GB, 1) } catch { }
    }
    return $t
}

# ───────────────────────── tryb diagnostyki ─────────────────────────
if ($Diagnostyka) {
    Write-Host "FPZ agent $FpzWersja – diagnostyka (niczego nie zmienia)" -ForegroundColor Cyan
    Write-Host ("PowerShell {0}, Windows: {1}" -f $PSVersionTable.PSVersion, $FpzNaWindows)
    $ok = Initialize-Natywne
    Write-Host ("Definicje natywne (user32, kernel32, Core Audio): {0}" -f $(if ($ok) { 'skompilowane' } else { 'BŁĄD' }))
    if ($FpzNaWindows -and $ok) {
        try { Write-Host ("Głośność systemowa: {0}%" -f [FpzKiosk.Dzwiek]::Pobierz()) } catch { Write-Host ("Głośność systemowa: niedostępna – {0}" -f $_.Exception.Message) -ForegroundColor Yellow }
        try { Write-Host ("Ostatnie wejście (GetLastInputInfo): {0}" -f [FpzKiosk.Ekran]::OstatnieWejscie()) } catch { Write-Host "GetLastInputInfo: błąd" -ForegroundColor Yellow }
    }
    $j = Get-Jasnosc
    Write-Host ("Jasność (WMI): {0}" -f $(if ($null -ne $j) { "$j%" } else { 'niedostępna (typowe dla monitorów zewnętrznych)' }))
    $t = Get-Telemetria
    foreach ($k in $t.Keys) { Write-Host ("  {0,-10} {1}" -f $k, $t[$k]) }
    exit 0
}

# ───────────────────────── stan i sieć ─────────────────────────
function ConvertTo-IsoUtc($v) {
    # Uwaga: PowerShell 7 zamienia napisy z datą w JSON na [datetime] – normalizujemy do ISO 8601 UTC.
    if ($null -eq $v -or "$v" -eq '') { return $null }
    try {
        if ($v -is [datetime]) { return $v.ToUniversalTime().ToString('o') }
        return [DateTimeOffset]::Parse([string]$v, [Globalization.CultureInfo]::InvariantCulture).UtcDateTime.ToString('o')
    } catch { return $null }
}

function ConvertTo-Czas([string]$iso) { return [DateTimeOffset]::Parse($iso, [Globalization.CultureInfo]::InvariantCulture) }

$stan = [ordered]@{ zainicjowano = $false; ostatniRestart = $null }
$s = Read-FpzJson $PLIK_STANU
if ($s) {
    $stan.zainicjowano = ($s.zainicjowano -eq $true)
    $stan.ostatniRestart = ConvertTo-IsoUtc $s.ostatniRestart
}
function Save-Stan { try { Write-FpzJson $PLIK_STANU $stan } catch { Log ("Nie zapisano pliku stanu: " + $_.Exception.Message) 'UWAGA' } }

Set-FpzTls
$naglowki = @{ 'Cache-Control' = 'no-cache' }
$adresUrzadzenia = '{0}/api/device/{1}' -f $Serwer, [Uri]::EscapeDataString($Id)

function Get-Urzadzenie {
    # Zwraca obiekt urządzenia; $null + ustawia $script:bladSieci / $script:nieZnane.
    try {
        $r = Invoke-RestMethod -Uri $adresUrzadzenia -Method Get -Headers $naglowki -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        $script:nieZnane = $false
        return $r
    } catch {
        $kod = Get-FpzKodHttp $_
        if ($kod -eq 404) { $script:nieZnane = $true; $script:bladSieci = $null }
        else { $script:nieZnane = $false; $script:bladSieci = $_.Exception.Message }
        return $null
    }
}

function Send-Sygnal([hashtable]$Dodatki) {
    $t = Get-Telemetria
    $b = [ordered]@{ id = $Id; src = 'agent' }
    foreach ($k in $t.Keys) { if ($null -ne $t[$k]) { $b[$k] = $t[$k] } }
    foreach ($k in $Dodatki.Keys) { if ($null -ne $Dodatki[$k]) { $b[$k] = $Dodatki[$k] } }
    $b.ver = $WERSJA
    $json = $b | ConvertTo-Json -Compress
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($json)
        $null = Invoke-RestMethod -Uri "$Serwer/api/beat" -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# ───────────────────────── działania ─────────────────────────
$monitor = $null            # 'on' / 'off' – stan zadany przez agenta (null = jeszcze nie ustawiony)
$uspionoO = $null           # [datetime] ostatnie polecenie uśpienia
$wejsciePrzyUspieniu = 0    # GetLastInputInfo w chwili uśpienia
$obudzonyRecznie = $false   # ktoś dotknął ekranu / poruszył myszą po uśpieniu
$czuwanieO = [datetime]::MinValue
$glosnoscZadana = $null
$jasnoscZadana = $null
$jasnoscDostepna = $null    # null = nie sprawdzano
$uwagi = @{}                # klucz → treść do pola „note”

function Set-Monitor([string]$cel) {
    if ($cel -eq 'off') {
        if ($Test) { NaSucho 'uśpiłbym monitor (SendMessageTimeout HWND_BROADCAST, WM_SYSCOMMAND, SC_MONITORPOWER, 2)' }
        else {
            try {
                [void][FpzKiosk.Ekran]::Czuwanie($false)   # zwalniamy „ekran wymagany”, system nadal nie usypia
                [FpzKiosk.Ekran]::Uspij()
                $script:wejsciePrzyUspieniu = [FpzKiosk.Ekran]::OstatnieWejscie()
                Log 'Monitor uśpiony (power ≠ on).'
                $uwagi.Remove('monitor')
            } catch { Log ("Nie udało się uśpić monitora: " + $_.Exception.Message) 'BLAD'; $uwagi['monitor'] = 'usypianie monitora nie działa' }
        }
        $script:uspionoO = Get-Date
        $script:obudzonyRecznie = $false
    } else {
        if ($Test) { NaSucho 'obudziłbym monitor (mouse_event ±1 px) i ustawił SetThreadExecutionState(ES_CONTINUOUS|ES_SYSTEM_REQUIRED|ES_DISPLAY_REQUIRED)' }
        else {
            try {
                [FpzKiosk.Ekran]::Obudz()
                [void][FpzKiosk.Ekran]::Czuwanie($true)
                $script:czuwanieO = Get-Date
                Log 'Monitor obudzony (power = on).'
                $uwagi.Remove('monitor')
            } catch { Log ("Nie udało się obudzić monitora: " + $_.Exception.Message) 'BLAD'; $uwagi['monitor'] = 'budzenie monitora nie działa' }
        }
    }
    $script:monitor = $cel
}

function Set-Glosnosc([int]$v) {
    if ($Test) { NaSucho ("ustawiłbym głośność systemową na {0}%" -f $v); return }
    if (-not $natywne) { $uwagi['glosnosc'] = 'sterowanie głośnością niedostępne'; return }
    try {
        [FpzKiosk.Dzwiek]::Ustaw($v)
        Log ("Głośność systemowa: {0}%" -f $v)
        $uwagi.Remove('glosnosc')
    } catch {
        Log ("Nie udało się ustawić głośności (brak urządzenia audio?): " + $_.Exception.Message) 'UWAGA'
        $uwagi['glosnosc'] = 'głośność: brak urządzenia audio albo błąd Core Audio'
    }
}

function Set-JasnoscZadana([int]$v) {
    if ($Test) { NaSucho ("ustawiłbym jasność na {0}% (WMI WmiSetBrightness – jeśli ekran to obsługuje)" -f $v); return }
    if ($null -eq $script:jasnoscDostepna) { $script:jasnoscDostepna = ((Get-JasnoscObiekty).Count -gt 0) }
    if (-not $script:jasnoscDostepna) {
        $uwagi['jasnosc'] = 'jasność: monitor nie obsługuje sterowania przez WMI'
        return
    }
    try {
        if (Set-Jasnosc $v) { Log ("Jasność: {0}%" -f $v); $uwagi.Remove('jasnosc') }
    } catch {
        Log ("Nie udało się ustawić jasności: " + $_.Exception.Message) 'UWAGA'
        $uwagi['jasnosc'] = 'jasność: błąd WMI'
    }
}

function Invoke-Restart([string]$kiedy) {
    if ($RestartSystemu) {
        if ($Test) { NaSucho ("zrestartowałbym komputer (Restart-Computer) – polecenie z {0}" -f $kiedy); return }
        Log ("Polecenie restartu z {0}: restart komputera za 10 s." -f $kiedy) 'UWAGA'
        Start-Sleep -Seconds 10
        try { Restart-Computer -Force -ErrorAction Stop } catch { Log ("Restart komputera nie powiódł się: " + $_.Exception.Message) 'BLAD' }
        return
    }
    if ($Test) { NaSucho ("zamknąłbym i ponownie uruchomił przeglądarkę kiosku – polecenie z {0}" -f $kiedy); return }
    Log ("Polecenie restartu z {0}: ponowne uruchomienie przeglądarki." -f $kiedy)
    try {
        $nadzor = Test-FpzMutex $FpzMutexNadzor
        if ($nadzor) { New-Item -ItemType File -Path (Join-Path $katalog 'RESTART') -Force | Out-Null }
        $n = Stop-FpzPrzegladarka -Przegladarka $przegladarka -LogPlik $LOG
        if (-not $nadzor) {
            # Brak nadzorcy (uruchom-kiosk.ps1) – uruchamiamy przeglądarkę sami.
            $adres = Get-FpzAdresStrony $Serwer $Id
            $null = Start-FpzPrzegladarka -Przegladarka $przegladarka -Adres $adres -LogPlik $LOG
        } elseif ($n -eq 0) {
            Log 'Przeglądarka kiosku nie działała – nadzorca uruchomi ją ponownie.' 'UWAGA'
        }
    } catch { Log ("Restart przeglądarki nie powiódł się: " + $_.Exception.Message) 'BLAD' }
}

# ───────────────────────── start ─────────────────────────
if (-not $Test) {
    if (-not $FpzNaWindows) { Log 'Sterowanie sprzętem działa tylko w Windows. Poza Windows użyj -Test.' 'BLAD'; exit 3 }
    try {
        $utworzony = $false
        $script:muteks = New-Object Threading.Mutex($true, $FpzMutexAgent, [ref]$utworzony)
        if (-not $utworzony) { Log 'Agent już działa w tej sesji – kończę.' 'UWAGA'; exit 0 }
    } catch { }
    $null = Initialize-Natywne
}

Log ("Start: {0}, urządzenie {1}, serwer {2}, odpytywanie co {3} s{4}{5}" -f $WERSJA, $Id, $Serwer, $Okres,
    $(if ($Test) { ', TRYB NA SUCHO' } else { '' }), $(if ($RestartSystemu) { ', restart = restart komputera' } else { '' }))
if ($Test) { $uwagi['test'] = 'tryb na sucho – bez sterowania sprzętem' }

$zegar = [Diagnostics.Stopwatch]::StartNew()
$ostatniSygnal = -1000.0
$bylOnline = $null
$nieZnane = $false; $bladSieci = $null
$plikStop = Get-FpzPlikStop

while ($true) {
    $poczatek = $zegar.Elapsed.TotalSeconds
    $pilne = $false
    try {
        if (Test-Path -LiteralPath $plikStop) { Log 'Znaleziono plik STOP – agent kończy pracę (wyjście serwisowe).'; break }

        $d = Get-Urzadzenie
        if ($d) {
            if ($bylOnline -ne $true) { Log ("Połączono z serwerem: {0} ({1}), power={2}, volume={3}, brightness={4}" -f $d.id, $d.name, $d.power, $d.volume, $d.brightness) }
            $bylOnline = $true
            $uwagi.Remove('serwer')

            # 1. Zasilanie ekranu – tylko przy zmianie stanu.
            $cel = if ([string]$d.power -eq 'on') { 'on' } else { 'off' }
            if ($cel -ne $monitor) {
                Log ("Zasilanie: {0} → monitor {1}" -f $d.power, $(if ($cel -eq 'on') { 'włączony' } else { 'uśpiony' }))
                Set-Monitor $cel; $pilne = $true
            }

            # 2. Głośność.
            if ($null -ne $d.volume) {
                $v = [int]$d.volume
                if ($v -ne $glosnoscZadana) { Set-Glosnosc $v; $glosnoscZadana = $v; $pilne = $true }
            }

            # 3. Jasność.
            if ($null -ne $d.brightness) {
                $j = [int]$d.brightness
                if ($j -ne $jasnoscZadana) { Set-JasnoscZadana $j; $jasnoscZadana = $j; $pilne = $true }
            }

            # 4. Restart – gdy restartedAt nowszy niż ostatnio wykonany.
            $ra = ConvertTo-IsoUtc $d.restartedAt
            if (-not $stan.zainicjowano) {
                $stan.zainicjowano = $true; $stan.ostatniRestart = $ra; Save-Stan
                if ($ra) { Log ("Zapamiętano ostatnie polecenie restartu z serwera ({0}) – nie wykonuję go wstecz." -f $ra) }
            } elseif ($ra -and (-not $stan.ostatniRestart -or (ConvertTo-Czas $ra) -gt (ConvertTo-Czas $stan.ostatniRestart))) {
                $stan.ostatniRestart = $ra; Save-Stan     # najpierw zapis – restart komputera nie może się zapętlić
                Invoke-Restart $ra; $pilne = $true
            }
        } else {
            if ($nieZnane) {
                if ($bylOnline -ne 'nieznane') { Log ("Serwer nie zna urządzenia '{0}' (404). Sprawdź identyfikator." -f $Id) 'BLAD' }
                $bylOnline = 'nieznane'; $uwagi['serwer'] = "serwer nie zna identyfikatora $Id"
            } else {
                if ($bylOnline -ne $false) { Log ("Brak połączenia z serwerem – ponawiam co {0} s. ({1})" -f $Okres, $bladSieci) 'UWAGA' }
                $bylOnline = $false
            }
        }

        # Ekran uśpiony, a ktoś go obudził (dotyk, mysz) – ponów uśpienie, nie częściej niż co minutę.
        if (-not $Test -and $natywne -and $monitor -eq 'off' -and $uspionoO) {
            $wej = [FpzKiosk.Ekran]::OstatnieWejscie()
            if ($wej -ne $wejsciePrzyUspieniu) {
                if (-not $obudzonyRecznie) { $obudzonyRecznie = $true; Log 'Ekran obudzony (dotyk / mysz / klawiatura) mimo stanu „wyłączony”.' 'UWAGA' }
                if (((Get-Date) - $uspionoO).TotalSeconds -ge $MIN_PONOW_USPIENIA) {
                    Log 'Ponawiam uśpienie monitora.'
                    Set-Monitor 'off'; $pilne = $true
                }
            }
        }
        # Odświeżenie czuwania (ekran nie gaśnie, system nie usypia) w czasie pracy.
        if (-not $Test -and $natywne -and $monitor -eq 'on' -and ((Get-Date) - $czuwanieO).TotalSeconds -ge $OKRES_CZUWANIA) {
            try { [void][FpzKiosk.Ekran]::Czuwanie($true) } catch { }
            $czuwanieO = Get-Date
        }

        # Sygnał co 30 s albo zaraz po wykonaniu polecenia (nie wysyłamy, gdy serwer nie zna identyfikatora).
        if ($bylOnline -ne 'nieznane' -and ($pilne -or ($zegar.Elapsed.TotalSeconds - $ostatniSygnal) -ge $OKRES_SYGNALU)) {
            $glos = if ($Test) { $glosnoscZadana } else { Get-Glosnosc }
            $jas = if ($Test) { $null } else { Get-Jasnosc }
            $mon = $monitor
            if ($mon -eq 'off' -and $obudzonyRecznie) { $mon = 'on' }
            $note = (@($uwagi.Values) | Sort-Object) -join '; '
            if ($note.Length -gt 230) { $note = $note.Substring(0, 230) }
            $dod = @{ volume = $glos; brightness = $jas; monitor = $mon; note = $(if ($note) { $note } else { $null }); appliedRestart = $stan.ostatniRestart }
            $okS = Send-Sygnal $dod
            $ostatniSygnal = $zegar.Elapsed.TotalSeconds
            if ($Test) { Log ("Sygnał wysłany: {0} (monitor={1}, volume={2})" -f $(if ($okS) { 'OK' } else { 'BŁĄD' }), $mon, $glos) 'TEST' }
        }
    } catch {
        Log ("Nieoczekiwany błąd pętli (agent działa dalej): " + $_.Exception.Message) 'BLAD'
    }

    if ($MaksCzas -gt 0 -and $zegar.Elapsed.TotalSeconds -ge $MaksCzas) { Log 'Koniec czasu działania (-MaksCzas).'; break }
    $reszta = $Okres - ($zegar.Elapsed.TotalSeconds - $poczatek)
    if ($reszta -gt 0) { Start-Sleep -Milliseconds ([int]($reszta * 1000)) }
}
