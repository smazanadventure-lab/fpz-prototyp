// Zakładka „O prototypie”: jak korzystać, scenariusze zależności między końcówkami, zgodność z wymaganiami, architektura.
import './about.css';
import { Client } from '../kernel/client.jsx';
import { useStore } from '../kernel/store.js';
import { apiOperations, ROLES } from '../kernel/api.js';
import { stringKeys } from '../kernel/i18n.js';
import { Icon, Card, CardBody, Tag, Button, PatternBand, Notice } from '../ui/components.jsx';

const go = (id) => { try { window.dispatchEvent(new CustomEvent('fpz:tab', { detail: id })); } catch { location.hash = '#' + id; } };
const TABS = { mobile: 'Aplikacja', web: 'Strona WWW', kiosk: 'Kioski', signage: 'Ekrany LCD', validator: 'Bileter', cms: 'CMS', mgmt: 'Ekspozycja' };

const SCENARIOS = [
  { icon: 'edit', title: 'Treść z CMS trafia wszędzie', tabs: ['cms', 'mobile', 'web', 'kiosk'], steps: ['CMS (konto admin) → Treści → Wpisy: zmień tytuł dowolnego wpisu i zapisz.', 'Otwórz ten wpis w aplikacji, na stronie WWW i w kiosku – tytuł jest już zmieniony.', 'Odznacz kanał „kioski” – wpis znika z kiosków, zostaje w aplikacji i na stronie.'] },
  { icon: 'ticket', title: 'Bilet: zakup → bramka → rozliczenie', tabs: ['mobile', 'validator', 'cms'], steps: ['Aplikacja → wydarzenie → „Kup bilet”; zaloguj konto testowe i zatwierdź płatność testową.', 'Bileter (konto bileter): nowy bilet jest na liście kodów – zeskanuj go. Drugi skan zostanie odrzucony.', 'W aplikacji i na stronie WWW (to samo konto) bilet ma status „wykorzystany”; CMS → Zamówienia pokazuje sprzedaż.'] },
  { icon: 'qr', title: 'Nowy kod QR działa od razu', tabs: ['cms', 'mobile'], steps: ['CMS → Wyzwalacze → QR: wygeneruj kod prowadzący do wybranego wpisu.', 'Aplikacja: w panelu „Otoczenie telefonu” wybierz ten kod jako „Kod QR przed kamerą”.', 'W aplikacji otwórz skaner – kod otwiera przypisany wpis.'] },
  { icon: 'power', title: 'Sterowanie kioskami z jednego miejsca', tabs: ['mgmt', 'kiosk', 'signage'], steps: ['Włącz „Dwa okna”: po lewej Ekspozycja (konto technik), po prawej Kioski.', 'Wyłącz jedno stanowisko albo przełącz je w tryb serwisowy – ekran kiosku reaguje natychmiast.', 'Ustaw symulowaną godzinę 23:30 – harmonogram wyłącza ekspozycję; o 19:00 kioski przechodzą w tryb nocny.', '„Symuluj awarię” – powstaje zgłoszenie z licznikiem SLA, a w dzienniku powiadomień e-mail i SMS.'] },
  { icon: 'game', title: 'Gra terenowa offline i moderacja pomysłów', tabs: ['mobile', 'cms', 'web'], steps: ['Aplikacja → Gra terenowa: wybierz trasę, w panelu otoczenia przenieś zwiedzającego do punktu misji.', 'Ustaw zasięg „Offline” i zalicz misję – postęp czeka w kolejce; po powrocie sieci synchronizuje się sam.', 'Na trasie innowacji wyślij własny pomysł → CMS → Moderacja: zaakceptuj. Pomysł pojawia się na stronie WWW, a gracz dostaje punkty i powiadomienie.'] },
  { icon: 'captions', title: 'Napisy na żywo i tłumacz PJM', tabs: ['mgmt', 'signage', 'mobile', 'web'], steps: ['Ekspozycja → Transmisje: rozpocznij transmisję i wpisuj linie w konsoli respeakera.', 'Napisy pojawiają się jednocześnie na ekranie LCD sceny, w aplikacji i na stronie WWW.', 'W kiosku naciśnij przycisk tłumacza PJM – połączenie trafia do dziennika w systemie zarządzania.'] },
  { icon: 'languages', title: 'Nowy język bez programowania', tabs: ['cms', 'mobile', 'kiosk'], steps: ['CMS → Tłumaczenia: dodaj język (np. de – Deutsch) i przetłumacz kilka tekstów interfejsu.', 'W aplikacji i w kiosku nowy język jest na liście; nieprzetłumaczone teksty wyświetlają się po angielsku.'] },
  { icon: 'image', title: 'Logotyp i identyfikacja', tabs: ['cms', 'mobile', 'web', 'kiosk'], steps: ['CMS → Ustawienia → Identyfikacja: wgraj plik logotypu przekazany przez Zamawiającego.', 'Znak zastępczy zostaje podmieniony we wszystkich końcówkach.'] },
];

// status: ok = działa w prototypie; sim = działa na symulacji (bez prawdziwej usługi/urządzenia); out = poza zakresem wersji testowej
const MATRIX = [
  { g: 'I. Przedmiot umowy – prace programistyczne', rows: [
    ['a) Aplikacje mobilne iOS / Android', 'Zakładka „Aplikacja mobilna” w dwóch wariantach systemu (przełącznik iOS / Android w panelu otoczenia)', 'sim', 'Publikacja w App Store i Google Play – etap realizacji'],
    ['b) Aplikacja WWW (PWA) z równoważną funkcjonalnością', 'Zakładka „Strona WWW / PWA”; rezerwacje tym samym modułem co w aplikacji', 'ok', ''],
    ['c) Backend: API, baza, uwierzytelnianie, sesje, logowanie zdarzeń', 'Wspólny magazyn danych i API w przeglądarce; sesje klientów i personelu; „Dziennik API”; dziennik zdarzeń w CMS', 'sim', 'Serwer, baza i zabezpieczenia produkcyjne – etap realizacji'],
    ['d) CMS: treści (3D/audio/wideo), wielojęzyczność, QR, BLE, AR, współrzędne, workflow, moderacja UGC', 'Zakładka „CMS” – wszystkie wymienione moduły', 'ok', 'Pliki audio/wideo/3D przechowywane jako metadane'],
    ['e) System Rezerwacji: konto, koszyk, płatności online (PSD2/SCA), bilety, walidacja, zwroty', 'Moduł rezerwacji w aplikacji i na stronie + zakładka „Bileter”', 'sim', 'Operator płatności i krok SCA symulowane'],
    ['f) Gra terenowa: silnik misji edytowalny w CMS, punktacja, nagrody, poziomy trudności, geofencing, AR/BLE/QR', 'Aplikacja → Gra terenowa; CMS → Gra terenowa', 'sim', 'GPS, Bluetooth i kamera symulowane panelem otoczenia'],
    ['g) Mapa i nawigacja, trasy, ulubione, tryb offline', 'Plan terenu FPŻ (3D / rzut) i mapa miasta; ulubione, własne ścieżki, pakiet offline', 'sim', 'Mapy schematyczne; docelowo podkład zgodny z licencją'],
    ['h) Integracje: płatności, analityka, push, e-mail/SMS, AR/QR/BLE', 'Statystyki, powiadomienia push, dziennik wysyłek e-mail/SMS', 'sim', 'Bez połączeń z usługami zewnętrznymi'],
    ['i) Środowiska i DevOps, CI/CD, monitoring, kopie', 'Projekt źródłowy z jednym poleceniem budowania; eksport danych z CMS', 'out', 'Etap realizacji'],
    ['j) Testy jednostkowe, integracyjne, e2e, wydajności i bezpieczeństwa', 'Test dymny logiki (rezerwacje, gra, urządzenia) i przejścia w przeglądarce', 'out', 'Pełny pakiet testów – etap realizacji'],
    ['k–l) Publikacja, przekazanie materiałów, szkolenia', '—', 'out', 'Etap realizacji'],
  ] },
  { g: 'IV.2 Aplikacja mobilna – funkcje a–r', rows: [
    ['a–c) Ekran startowy, wybór języka, tutorial', 'Pierwsze uruchomienie aplikacji; ponownie z Ustawień', 'ok', ''],
    ['d–e) Ekran główny, menu (navigation drawer)', 'Układ wg próbki C; szuflada menu; dolna nawigacja 5 pozycji', 'ok', ''],
    ['f) Wyszukiwanie kodów QR', 'Skaner z podglądem „kamery” i ręcznym wpisaniem kodu', 'sim', 'Kod przed kamerą wybierany w panelu otoczenia'],
    ['g) Wyszukiwanie nadajników BLE (1–70 m)', 'Radar nadajników; treści po wejściu w zasięg', 'sim', 'Odległość liczona z symulowanej pozycji'],
    ['h) Wyszukiwanie obiektów AR', 'Widok AR z modelem 3D, etykietami i wizją przyszłości', 'sim', 'Obraz kamery symulowany'],
    ['i) Mapa z punktami, ulubionymi i trasami', 'Zakładka Nawigacja; kreator „Moja ścieżka”', 'ok', ''],
    ['j) Ustawienia', 'Język, dostępność, powiadomienia, pakiet offline, dane lokalne', 'ok', ''],
    ['k–m) Kategorie, podkategorie, wpisy', 'Historia i Społeczność – drzewo kategorii z CMS; wpisy z galerią, filmem, 3D', 'ok', ''],
    ['n–o) Gry terenowe, quizy', 'Gra terenowa (4 trasy) i lista quizów', 'ok', ''],
    ['p) Kupony', 'Kupony z warunkami (punkty, misja, trasa), kod QR, realizacja na stanowisku bileterskim', 'ok', ''],
    ['q) System rezerwacji', 'Wspólny moduł rezerwacji', 'ok', ''],
    ['r) Audioprzewodnik', 'Lektor z transkrypcją (synteza mowy przeglądarki)', 'sim', 'Docelowo nagrania studyjne'],
    ['Działanie przy słabym łączu i offline, synchronizacja postępów gry', 'Zasięg: LTE / słaby / offline w panelu otoczenia; kolejka synchronizacji', 'sim', ''],
    ['Media społecznościowe, materiały z wirtualnego studia, transmisje online', 'Filmy i transmisje w aplikacji i na stronie', 'sim', 'Odtwarzacz symulowany (bez plików wideo)'],
    ['Indywidualne ścieżki zwiedzania (aplikacja i WWW)', 'Kreator ścieżki wg czasu, zainteresowań i dostępności', 'ok', ''],
    ['Wersje językowe bez prac programistycznych', 'CMS → Tłumaczenia; PL i EN w komplecie', 'ok', ''],
  ] },
  { g: 'IV.3 System rezerwacji – a–k', rows: [
    ['a) Rejestracja / logowanie', 'Konto klienta wspólne dla aplikacji i strony', 'ok', ''],
    ['b) Zakup biletów na wydarzenia i do stref', 'Wydarzenia, strefy biletowane, pakiety; koszyk; bilety z kodami QR', 'ok', ''],
    ['c–e) Baza atrakcji, zapytanie o termin, dane kontaktowe', 'Baza obiektów i najemców; zapytania z odpowiedzią z CMS', 'ok', ''],
    ['f) Dodawanie obiektów / biletów / pakietów z CMS', 'CMS → Oferta i rezerwacje', 'ok', ''],
    ['g–h, j) PL/EN, responsywność, zgodność z aplikacją i stroną', 'Jeden moduł dopasowujący się do szerokości', 'ok', ''],
    ['i) Operator płatności online', 'Ekran operatora w trybie testowym (BLIK, karta testowa, przelew) z krokiem SCA', 'sim', 'Operator wskazany przez Zamawiającego – etap realizacji'],
  ] },
  { g: 'IV.4 Interaktywna gra terenowa', rows: [
    ['a) Trasa przyrodnicza: sposób przejścia, 3 długości, katalog miejsc', 'Tryby pieszy / rowerowy / dostępny, 3 długości, katalog terenów i pomników przyrody', 'ok', ''],
    ['b) Trasa przemysłowego dziedzictwa: warianty kontekstowe', 'Technologia / produkt / twórcy / pionierzy – inna treść misji w każdym wariancie', 'ok', ''],
    ['c) Trasa historyczna: oś czasu + dzielnice jako tick-boxy', 'Wehikuł czasu (epoki) i mapa dzielnic zapełniana po odwiedzeniu tablic', 'ok', ''],
    ['d) Trasa innowacji: AR, panorama 360°, zgłaszanie pomysłów', 'Widok przyszłości w AR, panorama z punktami, formularz pomysłów z moderacją', 'sim', 'Panorama rysowana schematycznie zamiast zdjęcia z drona'],
    ['Punktacja, nagrody, poziomy trudności, tryby dla grup wiekowych', 'Profil gracza, mnożniki trudności, katalog nagród z kodem odbioru, ranking', 'ok', ''],
  ] },
  { g: 'V. Systemy udogodnień', rows: [
    ['1. Tłumaczenie na język migowy on-line (jeden przycisk)', 'Przycisk tłumacza PJM w kiosku, aplikacji i na stronie', 'sim', 'Połączenie wideo symulowane; docelowo usługa zewnętrzna'],
    ['2. Symultaniczny przekaz tekstowy (napisy na żywo, respeaking)', 'Konsola respeakera w „Ekspozycji”; napisy na ekranie LCD, w aplikacji i na stronie', 'ok', ''],
    ['Dostępność: kontrast, skala tekstu, lektor, regulacja wysokości (kiosk)', 'Pasek dostępności we wszystkich końcówkach publicznych', 'ok', 'Pełny audyt WCAG 2.1 AA – etap realizacji'],
  ] },
  { g: 'VI. Aplikacje stanowisk', rows: [
    ['Aplikacje interaktywne: pełny ekran, autostart, blokada wyjścia, dotyk, gesty, PL/EN', 'Kioski: wygaszacz, menu serwisowe z PIN, gesty, animowane przejścia', 'sim', 'Instalatory i tryb kiosku systemu operacyjnego – etap realizacji'],
    ['TZ.T1.1–T1.4: mapa FPŻ z wyszukiwarką usług, informator wydarzeń, treści historyczne', 'Zakładka „Kioski” – cztery stanowiska z wyróżnieniem własnej hali', 'ok', ''],
    ['TZ.T1.5 Hala Ząbkowice i Dźwięki miasta: treści, pogoda, kalendarium, słuchawka, zmiana ścieżek', 'Kiosk T1.5 ze słuchawką i przyciskami; dźwięki syntetyczne', 'sim', 'Docelowo nagrania archiwalne i studyjne'],
    ['Materiały filmowe: napisy, lektor, audiodeskrypcja', 'Odtwarzacz z napisami, audiodeskrypcją i oknem tłumacza', 'sim', 'Bez plików filmowych'],
  ] },
  { g: 'VII. Zintegrowany system zarządzania multimediami', rows: [
    ['Uruchomienie / wyłączenie jednym przyciskiem; sterowanie pojedynczymi stanowiskami', 'Zakładka „Ekspozycja” – pulpit i urządzenia', 'ok', 'Urządzenia symulowane'],
    ['Interfejs graficzny na tablecie i komputerze, logowanie, uprawnienia', 'Widok komputer / tablet, konta z rolami', 'ok', ''],
    ['Tworzenie i organizacja treści, playlisty, harmonogramy, synchronizacja', 'Edytor playlist, harmonogramy z symulacją pory dnia, ekrany LCD grające równo', 'ok', ''],
    ['Monitoring, statystyki, raporty o usterkach, powiadomienia e-mail/SMS', 'Telemetria, zgłoszenia z licznikami SLA, raporty CSV, reguły alertów', 'sim', 'Powiadomienia zapisywane w dzienniku, nie wysyłane'],
    ['Odporność na nieprawidłowe wyłączenie', 'Stan sterowania utrwalany i przywracany po ponownym otwarciu', 'ok', ''],
    ['Urządzenia, instalacje, okablowanie, montaż, dokumentacja techniczna (pkt 9–22)', '—', 'out', 'Zakres sprzętowy'],
  ] },
];
const ST = { ok: ['green', 'działa'], sim: ['info', 'symulacja'], out: ['neutral', 'poza zakresem'] };

function Diagram() {
  const ends = [['Aplikacja mobilna', 'smartphone'], ['Strona WWW / PWA', 'globe'], ['Kioski T1.1–T1.5', 'monitor'], ['Ekrany LCD', 'tv'], ['Bileter', 'scan'], ['CMS', 'database'], ['Zarządzanie ekspozycją', 'sliders']];
  return (<div class="ab-diagram" role="img" aria-label="Schemat: siedem końcówek połączonych ze wspólnym backendem">
    <div class="ab-diagram__ends">{ends.map(([n, i]) => <div key={n} class="ab-node"><Icon name={i} size={18} /><span>{n}</span></div>)}</div>
    <div class="ab-diagram__bus"><span>API (operacje rejestrowane w „Dzienniku API”)</span></div>
    <div class="ab-diagram__core">
      <div class="ab-node ab-node--core"><Icon name="server" size={18} /><span><b>Wspólny backend (symulowany w przeglądarce)</b><small>treści i tłumaczenia · wyzwalacze QR/BLE/AR · konta, zamówienia, bilety · stan gry · urządzenia, playlisty, harmonogramy · transmisja i napisy · statystyki</small></span></div>
      <div class="ab-node ab-node--sim"><Icon name="satellite" size={18} /><span><b>Symulacja otoczenia</b><small>GPS · zasięg sieci · kod QR przed kamerą · pora dnia</small></span></div>
    </div>
  </div>);
}

function Page() {
  const s = useStore(); const ops = apiOperations();
  const counts = MATRIX.flatMap((g) => g.rows).reduce((m, r) => { m[r[2]]++; return m; }, { ok: 0, sim: 0, out: 0 });
  return (<div class="ab-scroll"><div class="ab-wrap">
    <PatternBand class="ab-hero" scale={1.1}><div class="ab-hero__in"><Tag tone="deep">Wersja testowa</Tag><h1>Fabryka Pełna Życia – prototyp systemu multimedialnego</h1>
      <p>Siedem końcówek działających na wspólnych danych: aplikacja mobilna z grą terenową, strona WWW z rezerwacjami, kioski, ekrany LCD, stanowisko bileterskie, CMS i system zarządzania ekspozycją.</p></div></PatternBand>

    <Notice tone="warn">To prototyp do uzgodnień: treści są przykładowe, a logowanie, płatności, kamera, Bluetooth, GPS, wideo i połączenia z tłumaczem są symulowane. Nic nie jest wysyłane poza tę przeglądarkę. Logotyp jest znakiem zastępczym – właściwy plik wgrywa się w CMS.</Notice>

    <section><h2>Jak korzystać</h2>
      <div class="ab-grid ab-grid--4">
        <Card variant="mint"><CardBody><Icon name="layers" size={22} /><h3>Zakładki u góry</h3><p>Każda zakładka to osobna końcówka systemu. Stan każdej jest zachowany przy przełączaniu.</p></CardBody></Card>
        <Card variant="mint"><CardBody><Icon name="split" size={22} /><h3>Dwa okna</h3><p>Pokazuje dwie końcówki obok siebie – najlepszy sposób, by zobaczyć zależności na żywo (np. Ekspozycja + Kioski).</p></CardBody></Card>
        <Card variant="mint"><CardBody><Icon name="satellite" size={22} /><h3>Otoczenie telefonu</h3><p>Panel obok telefonu ustawia pozycję zwiedzającego, zasięg sieci i kod QR przed kamerą.</p></CardBody></Card>
        <Card variant="mint"><CardBody><Icon name="terminal" size={22} /><h3>API i Reset</h3><p>„API” pokazuje wywołania wspólnego backendu z każdej końcówki. „Reset” przywraca dane początkowe.</p></CardBody></Card>
      </div>
      <div class="ab-accounts"><h3>Konta testowe</h3>
        <ul><li><b>Klient rezerwacji</b> (aplikacja, strona): anna.kowalska@example.com · hasło demo1234</li>
          {s.staff.map((st) => <li key={st.id}><b>{ROLES[st.role]?.name}</b>: login <code>{st.login}</code> · hasło <code>{st.password}</code></li>)}</ul></div>
    </section>

    <section><h2>Scenariusze pokazujące zależności</h2>
      <div class="ab-grid ab-grid--2">{SCENARIOS.map((sc, i) => (<Card key={i}><CardBody>
        <div class="ab-sc__head"><span class="ab-sc__n">{i + 1}</span><h3>{sc.title}</h3></div>
        <ol class="ab-steps">{sc.steps.map((st, k) => <li key={k}>{st}</li>)}</ol>
        <div class="ab-sc__tabs">{sc.tabs.map((t) => <Button key={t} size="sm" variant="secondary" onClick={() => go(t)}>{TABS[t]}</Button>)}</div>
      </CardBody></Card>))}</div>
    </section>

    <section><h2>Zgodność z dokumentem „Systemy Multimedialne i IT”</h2>
      <p class="ab-lead">Legenda: <Tag tone="green">działa</Tag> funkcja zrealizowana w prototypie · <Tag tone="info">symulacja</Tag> działa na danych lub urządzeniach symulowanych · <Tag>poza zakresem</Tag> nie dotyczy wersji testowej. Razem: {counts.ok} · {counts.sim} · {counts.out}.</p>
      {MATRIX.map((g) => (<div key={g.g} class="ab-matrix"><h3>{g.g}</h3>
        <div class="ab-table" role="table">{g.rows.map((r, i) => (<div key={i} class="ab-row" role="row"><div role="cell"><b>{r[0]}</b></div><div role="cell">{r[1]}{r[3] && <small>{r[3]}</small>}</div><div role="cell"><Tag tone={ST[r[2]][0]}>{ST[r[2]][1]}</Tag></div></div>))}</div></div>))}
    </section>

    <section><h2>Wersja serwerowa i aplikacja na telefon</h2>
      <p>Ten sam kod działa także jako wdrożenie pilotażowe: wspólne dane na serwerze (funkcja <code>/api/*</code> wykonuje te same operacje co symulowany backend), a każda końcówka ma własny adres – <code>/app</code>, <code>/www</code>, <code>/kiosk/TZ.T1.1</code>, <code>/lcd/LCD-01</code>, <code>/bileter</code>, <code>/cms</code>, <code>/ekspozycja</code> (przycisk <b>Adresy</b> w górnym pasku). Zmiana w CMS dociera do telefonu, kiosku i ekranu w ciągu kilku sekund; końcówki działają też bez sieci, a zmiany wysyłają po odzyskaniu połączenia.</p>
      <p><b>Aplikacja dla zwiedzających</b> (adres <code>/app</code> oraz plik APK dla Androida) to osobna kompilacja: zawiera wyłącznie przewodnik, grę terenową i bilety – bez CMS, zarządzania ekspozycją i pozostałych paneli zaplecza, a serwer nie wysyła jej danych zaplecza. Używa aparatu telefonu do kodów QR i GPS; do testów poza Fabryką ma <b>tryb testowy</b>.</p>
      <p>Logowanie w panelach jest makietą (wpisane dane konta testowego). Instrukcja wdrożenia: <code>docs/WDROZENIE.md</code>.</p></section>
    <section><h2>Architektura prototypu</h2>
      <Diagram />
      <div class="ab-grid ab-grid--4 ab-kpis">
        <div><b>{ops.length}</b><span>operacji API</span></div><div><b>{stringKeys().length}</b><span>tekstów interfejsu do tłumaczenia</span></div>
        <div><b>{s.entries.length + s.pois.length + s.events.length + s.venues.length}</b><span>wpisów, miejsc, wydarzeń i obiektów</span></div><div><b>{s.gameRoutes.reduce((n, r) => n + r.missions.length, 0)}</b><span>misji w 4 trasach gry</span></div>
      </div>
      <p class="ab-lead">Zalecane okno przeglądarki o szerokości co najmniej 1280 px (Chrome, Edge, Safari lub Firefox w aktualnej wersji). Lektor i audioprzewodnik korzystają z syntezy mowy przeglądarki, a „Dźwięki miasta” z Web Audio – oba uruchamiają się po pierwszym kliknięciu.</p>
      <p class="ab-lead">Całość jest jednym plikiem HTML bez połączeń sieciowych (Preact, własny magazyn danych, zapis stanu w pamięci przeglądarki). Te same komponenty, kolory i ikony we wszystkich końcówkach wynikają ze wspólnego systemu wizualnego opartego na próbkach B i C.</p>
    </section>

    <section><h2>Źródła treści i licencje</h2>
      <p class="ab-lead">Teksty przykładowe napisano na podstawie publicznie dostępnych informacji o Fabryce Pełnej Życia i Dąbrowie Górniczej; program wydarzeń, oferta najemców, nagrody i kupony są fikcyjne. Ilustracje i mapy są schematyczne i wykonane na potrzeby prototypu.</p>
      {s.site.sources?.length > 0 && <ul class="ab-sources">{s.site.sources.map((x, i) => <li key={i}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a></li>)}</ul>}
      <p class="ab-small">Wykorzystane biblioteki: Preact (MIT), ikony Lucide (ISC), qrcode-generator (MIT).</p>
    </section>
  </div></div>);
}
export function About() { return <Client id="about" base={15} class="ep-about"><Page /></Client>; }
export default About;
