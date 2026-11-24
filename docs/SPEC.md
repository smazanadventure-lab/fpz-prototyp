# FPŻ – prototyp systemu multimedialnego · specyfikacja dla wykonawców modułów

Budujemy **wersję testową uruchamianą w przeglądarce** zestawu wzajemnie zależnych aplikacji dla Fabryki Pełnej Życia (FPŻ) w Dąbrowie Górniczej.
Wymagania zamawiającego: `/home/claude/work/src/wymagania.txt` (tekst dokumentu „Systemy Multimedialne i IT”). Wzorce graficzne: próbka B (kiosk) i C (aplikacja mobilna) – opisane niżej w pkt 5; zrzuty stron: `/home/claude/work/src/B_sheet_1..3.jpg`, `C_sheet_1..2.jpg`, `cropB6b.jpg` (ekran kiosku), `cropB15.jpg` (mapa kiosku), `cropC2.jpg` (ekran aplikacji).

Całość to **jedna strona HTML** (powłoka z zakładkami-końcówkami). Wszystkie końcówki działają na **jednym wspólnym stanie** („backend” symulowany w przeglądarce) – zmiana w jednej końcówce jest natychmiast widoczna w pozostałych. To jest sedno prototypu.

## 1. Stos i uruchamianie
- Preact 10 + JSX (esbuild, `jsx: automatic`, **nie importuj `h`**), hooki z `preact/hooks`, CSS importowany z JS (`import './x.css'`). Bez innych bibliotek, bez żądań sieciowych, bez zewnętrznych fontów/obrazów (plik ma być samowystarczalny i działać offline z `file://`).
- Katalog projektu: `/home/claude/work/app`. Budowanie:
  - `node build.mjs --only=<id>[,<id>…]` → `dist/dev-<id>….html` (pozostałe końcówki zaślepione – buduj tak swoją część),
  - dodaj `--stub=content` gdy `src/content` jest chwilowo niespójne (inny agent je uzupełnia) i/lub `--stub=maps,media,illustrations`, gdy wspólne komponenty są w trakcie edycji przez innego agenta,
  - pełna kompilacja (`node build.mjs`) należy do integratora – nie uruchamiaj jej, by nie nadpisać `dist/index.html`.
- Podgląd/test w bezgłowym Chrome: `node tools/shot.mjs --file=dist/dev-<id>.html --tab=<zakładka> --out=shots/<nazwa>.png [--w=1440 --h=900] [--script=test/<twoj>.mjs]`.
  Zrzuty oglądaj narzędziem Read. Skrypt Playwright: `export default async (page, { shot, tab, errors }) => { … }`. Kod wyjścia 1 = błędy w konsoli.
  Zakładki powłoki (`--tab`): `mobile`, `web`, `kiosk`, `signage`, `validator`, `cms`, `mgmt`, `about`.
- **Nie edytuj plików spoza swojego zakresu** (pkt 9). Jeśli potrzebujesz zmiany w jądrze/komponentach wspólnych – opisz ją w raporcie końcowym i obejdź lokalnie.

## 2. Architektura
```
src/kernel/   store.js (stan + useStore), seed.js (dane początkowe), api.js (sel.* odczyty, makeApi operacje, ROLES, SLA), i18n.js, client.jsx (Client, useClient, useEnv, useNow), util.js
src/ui/       tokens.css, components.css, components.jsx (zestaw UI), icon-data.js, speech.js, illustrations.jsx, maps.jsx, media.jsx (+ stubs/ – wersje awaryjne o tym samym interfejsie)
src/content/  treści przykładowe (schemat: docs/CONTENT.md)
src/endpoints/<id>/index.jsx  – końcówki (domyślny eksport = komponent) ; registry.js – lista zakładek
src/shell/    powłoka: zakładki, „Dwa okna”, ramka telefonu + panel otoczenia, ramka przeglądarki, dziennik API
```
**Przeczytaj nagłówki i sygnatury w `src/kernel/api.js`, `src/kernel/client.jsx`, `src/kernel/seed.js` (kształt stanu) i `src/ui/components.jsx` – to jest kontrakt.**

### Stan (`useStore()` → obiekt stanu; mutowany w miejscu)
`settings` (logo, languages, defaultLang, moderation, payments), `i18n.overrides`, `site`, `sitePlan`, `districts`, `eras`, `pois`, `categories`, `entries` (+status, views, updatedAt, author), `news`, `videos`, `gallery`, `media` (biblioteka wgranych plików: `{id,name,type,dataUrl,…}`), `venues`, `events` (+start, end, sold), `products`, `coupons`, `gameRoutes` (z `missions`), `quizzes`, `rewards`, `ideaCategories`, `futureHotspots`, `ideas`, `triggers` (QR/BLE/AR), `users`, `orders`, `tickets`, `inquiries`, `player` (postęp gry na telefonie), `leaderboard`, `gameStats`, `staff`, `audit`, `outbox` (wysłane e-maile/SMS/push), `devices`, `zones`, `playlists`, `schedules`, `incidents`, `alertRules`, `live` (transmisja + napisy), `pjmCalls`, `stats`, `clients` (stan per końcówka), `env` (symulowane otoczenie telefonu), `apiLog`.
- Stan jest **mutowalny**: nie opieraj `useMemo`/`useEffect` na referencjach obiektów stanu – licz pochodne w renderze albo użyj `useStoreVersion()` jako zależności.
- **Nie trzymaj kopii danych domenowych w stanie lokalnym** (wyjątek: formularz w trakcie edycji). Zawsze czytaj ze stanu → zmiany z innych końcówek widać od razu.
- Zmiany **wyłącznie przez API** (`useClient().api.…`); każde wywołanie trafia do dziennika API. Gdy brakuje operacji: `cms.save(kolekcja, rekord)` / `cms.remove` obsługują wszystkie kolekcje; w ostateczności `update(s => …)` ze `store.js` (opisz w raporcie).

### Końcówka = `<Client>`
```jsx
import { Client, useClient, useEnv, useNow } from '../../kernel/client.jsx';
export default function MyEndpoint() { return <Client id="cms" base={15} class="ep-cms"><App /></Client>; }
// wewnątrz:
const { client, set, lang, t, L, api, user, staff, toast } = useClient();
```
- `id`: `mobile`, `web`, `kiosk:TZ.T1.1` … `kiosk:TZ.T1.5`, `signage:LCD-01`, `cms`, `mgmt`, `validator`. `base` = bazowy rozmiar pisma w px (telefon 16, WWW 16, kiosk 30, panele 14–15).
- `client` – utrwalany stan końcówki (lang, theme, contrast, fs, lector, userId, staffId, cart + własne pola przez `set({…})`); `user` = zalogowany klient rezerwacji, `staff` = zalogowany pracownik.
- `t('klucz', {zmienne})` – tekst interfejsu; `L(obiekt {pl,en})` – treść; `toast('tekst', 'ok'|'error'|'warn'|'info')`.
- `<Client>` ustawia `data-theme` (`light`/`night`), `data-contrast` (`normal`/`high`), skalę tekstu i obsługuje „asystę lektora” (czyta kliknięty element, gdy `client.lector`). Prop `theme="night"` wymusza motyw (kiosk w trybie nocnym).
- Korzeń `<Client>` to `position:relative; height:100%; overflow:hidden` – przewijanie realizuj we własnym kontenerze wewnątrz. Modale (`<Modal>`) i toasty renderują się w ramce końcówki.

### Odczyty `sel.*` i operacje `api.*` (pełna lista w `src/kernel/api.js`)
- treści: `sel.entries({categoryId, channel, poiId, eraId, districtId, q, featured, all})`, `sel.entry`, `sel.categoryTree()`, `sel.pois({scope, kind, accessible, q})`, `sel.poi`, `sel.news()`, `api.stats.track('entry'|'session'|'touch', id)`
- rezerwacje: `sel.events({category, poiId, ticketed, includePast})`, `sel.productsFor(eventId)`, `sel.zoneProducts()`, `sel.packages()`, `sel.remaining(eventId)`, `sel.cart(client)`, `sel.ordersOf(userId)`, `sel.ticketsOf`, `sel.ticketsOfOrder`, `sel.ticketPayload(t)`, `sel.inquiriesOf`, `sel.refundInfo(order)`; `api.auth.register/login/logout/updateProfile`, `api.booking.addToCart/setQty/clearCart/checkout/pay/cancel/refund/inquire`, `api.tickets.validate(kod, {gate})`
- wyzwalacze: `sel.triggersFor(type,id)`, `sel.triggerByCode`, `sel.qrPayload(t)`, `sel.nearbyBeacons(maxM)`, `sel.arHere()`, `sel.distanceTo(poi)`, `sel.nearestPoi(scope)`; `api.triggers.resolve(kod, via)` → `{ok, trigger, target:{type:'poi'|'entry'|'mission'|'coupon'|'ticket', id}, item}`
- gra: `sel.route`, `sel.mission`, `sel.routeMissions(routeId, opts)`, `sel.routeProgress`, `sel.missionCheck(mission)` → `{ok, need:'qr'|'ble'|'ar'|'gps', trigger, distanceM, done}`, `sel.points()`, `sel.pointsEarned()`, `sel.districtsVisited()`, `sel.erasVisited()`, `sel.leaderboard()`, `sel.couponState(c)`, `sel.ideas({all, mine, categoryId})`; `api.game.setProfile/startRoute/setRouteOptions/leaveRoute/completeMission/submitQuiz/redeemReward/claimCoupon/submitIdea/voteIdea/sync/reset`
- zwiedzanie: `api.visit.toggleFavorite/saveRoute/deleteRoute/suggest({minutes, interests, accessibleOnly, scope})`
- udogodnienia i transmisje: `api.live.start/stop/caption/clear`, `api.pjm.request/end`; komponenty `<PjmCall>`, `<LiveCaptions>`
- personel/CMS: `api.staff.login/logout`, `sel.staffOf(client)`, `sel.can(staff, 'uprawnienie')`, `ROLES`; `api.cms.save/remove/setStatus/saveMission/removeMission/moveMission/saveRoute/setTranslation/addLanguage/setLanguage/setSetting/setSite/moderateIdea/replyInquiry/sendPush`
- ekspozycja: `sel.device`, `sel.clock()`, `sel.incidentSla(inc)`, `sel.availability()`, `SLA`; `api.devices.power/powerAll/setAuto/set/restart/simulateFault/ackIncident/resolveIncident`, `api.env.set({simTime:'21:30'|null, network, qrInView, weather…})`
- otoczenie telefonu: `useEnv()` → `{ env:{position:{lat,lng,poiId}, network:'online'|'slow'|'offline', qrInView, arInView, simTime, weather}, setEnv, moveTo }` (ustawiane w panelu „Otoczenie telefonu” powłoki)

Konta testowe: klient `anna.kowalska@example.com` / `demo1234`; personel (login = hasło): `admin`, `redaktor`, `moderator`, `bileter`, `technik`.

## 3. Teksty i języki (wymóg: PL + EN, kolejne języki bez programowania)
- Każdy tekst interfejsu rejestruj: `strings({ 'm.home.title': ['Witaj…', 'Welcome…'] })` (z `kernel/i18n.js`, raz na moduł, prefiks kluczy jak w pkt 9) i używaj `t('m.home.title')`. Dzięki temu CMS pozwala je tłumaczyć i dodawać języki. Wspólne klucze `c.*` są już zarejestrowane (zob. `i18n.js`).
- Treści z danych: zawsze `L(obiekt)`. Daty/kwoty: `fmtDate/fmtDay/fmtTime/fmtDateTime/fmtMoney(…, lang)` z `kernel/util.js`.
- Panele administracyjne (CMS, zarządzanie ekspozycją, bileter) mogą być wyłącznie po polsku (wymóg: polski interfejs) – wtedy teksty wpisuj wprost.

## 4. Zestaw UI (`src/ui/components.jsx`) – używaj go zamiast własnych odpowiedników
`Icon({name,size})` (nazwy: `ICON_NAMES`, m.in. pin, history, community, map, game, ticket, menu, back, search, close, heart, qr, scan, bluetooth, beacon, ar, headphones, play, pause, settings, globe, contrast, ear, calendar, clock, info, star, leaf, factory, people, user, share, grid, list, check, plus, minus, trash, edit, eye, upload, download, wifi, wifiOff, cart, card, phone, mail, mapPin, route, walk, bike, wheelchair, trophy, gift, coupon, quiz, camera, video, image, volume, hand, captions, sun, moon, power, refresh, alert, bell, filter, arrowRight, external, home, layers, monitor, server, chart, shield, key, copy, printer, sparkles, rotate, panorama, flag, target, compass, tree, book, send, languages, building, utensils, coffee, music, film, news, tag, folder, file, database, activity, thermometer, cpu, wrench, zap, cloud, cloudRain, cloudSun, snow, wind, navigation, locate, zoomIn, zoomOut, more, save, timer, award, puzzle, message, thumbsUp, receipt, wallet, package, store, doorOpen, train, bus, mountain, waves, pickaxe, hammer, cog, phoneCall, phoneOff, rss, tv, playlist, sliders, help, circleCheck, circleX, circleAlert, skipForward, skipBack, repeat, bookmark …),
`HeightIcon`, `Button({variant:'primary'|'secondary'|'mint'|'ghost'|'danger', size:'sm'|'md'|'lg', icon, iconRight, block})`, `IconButton({icon|text, label, variant:'round'|'mint'|'plain', size, active, badge})`, `Chip`, `Chips({options,value,onChange,scroll})`, `Card({variant:'plain'|'mint'|'deep'|'outline', onClick})` + `CardBody`, `CornerLink` („Czytaj dalej ⌟”), `Tag({tone:'neutral'|'green'|'warn'|'danger'|'info'|'deep'|'live'})`, `Rich({text})`, `Media({ill|src, tone, ratio, shape:'rounded'|'card'|'plain'|'arc-tr'|'arc-tl'|'arc-br'|'arc-bl'|'circle'})`, `PatternBand({height, scale})`, `Logo({onDark, compact})`, `QR({value,size,label})`, `qrSvgString(value,size)`, `Modal({open,onClose,title,footer,size:'sm'|'md'|'lg'|'xl',variant:'center'|'sheet'})`, `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `SearchInput`, `Tabs({tabs,value,onChange,variant:'line'|'pill'})`, `Empty`, `Progress`, `Spinner`, `Notice({tone})`, `Stat`, `BarChart`, `LineChart`, `ScaleBox({width,height})`, `A11yBar({show:[…], horizontal, onPjm})`, `useLangSwitch()` + `LangMenu`, `LiveCaptions`, `PjmCall({open,onClose,where})`.
Wspólne komponenty treści: `Illustration({id,tone})` (`ui/illustrations.jsx`), `SitePlan`, `CityMap` (`ui/maps.jsx`), `VideoSim`, `AudioGuide`, `Model3D`, `Panorama360`, `ARView`, `useSoundscape` (`ui/media.jsx`) – sygnatury w nagłówkach plików w `src/ui/stubs/`. W trakcie prac mogą być jeszcze uproszczone (zaślepki) – docelowe wersje podmienią się same przy integracji; **nie zmieniaj ich i nie kopiuj**.

### Zasady CSS
- Własne style w pliku CSS modułu; **każdy selektor zaczynaj od klasy korzenia swojej końcówki** (np. `.ep-mobile …`), klasy własne z prefiksem z pkt 9. Można używać zagnieżdżania CSS (esbuild je obniża).
- **Kolory tylko z tokenów** (`var(--c-bg)`, `--c-surface`, `--c-surface-2`, `--c-surface-3`, `--c-text`, `--c-text-2`, `--c-text-3`, `--c-line`, `--c-line-strong`, `--c-accent`, `--c-accent-text`, `--c-accent-soft`, `--c-accent-soft-text`, `--c-green`, `--c-deep`, `--c-mint`, `--c-band`, `--c-danger`, `--c-warn`, `--c-info`, `--c-ok` + warianty `-bg`), aby motyw nocny i wysoki kontrast działały bez dodatkowej pracy. Sprawdź oba tryby na zrzutach.
- **Rozmiary pisma tylko tokenami** `var(--fs-2xs|xs|sm|md|lg|xl|2xl|3xl|4xl)` (skalują się przyciskami A↑/A↓). Odstępy i wymiary: `var(--sp-1..7)` (4, 8, 12, 16, 24, 32, 48 px przy bazie 16) albo `calc(var(--u) * N)`; promienie `--r-sm|md|lg|pill|card`; cienie `--shadow-1|2`.
- Resety w `tokens.css` mają zerową specyficzność (`:where`) – Twoje klasy zawsze je nadpisują; pamiętaj, że `button` wewnątrz `.fpz-theme` nie ma domyślnego tła, obramowania ani paddingu.
- Układ ma reagować na **szerokość kontenera**, nie okna (końcówki są osadzone w ramkach i skalowane): używaj `container-type: inline-size` + `@container`, flex/grid; nie używaj `@media (max-width…)` ani `100vw/100vh`.
- Końcówka może być zamontowana jako ukryta (`display:none`) – pomiary rób przez `ResizeObserver`, nie jednorazowo przy montowaniu.

## 5. Język wizualny (próbki B i C) – trzymaj się go ściśle
- **Kolory**: ciemna zieleń `#125930` (akcent: przyciski główne, aktywne ikony/teksty), zieleń identyfikacji `#5FB287` (pasy ze wzorem, wyróżnienia), neutralna zieleń `#45574D` (tekst/ikony przycisków neutralnych, linie), miętowy `#CCE5D8` (tło aktywnych przycisków), jasny miętowy `#EEF6F2` (tła neutralne, dolna nawigacja), biel. Tryb nocny: granatowo-grafitowe tło, jasny tekst, akcent `#5FB287`.
- **Typografia**: Helvetica Neue (stos systemowy), nagłówki Bold z interlinią 1,15, tekst ciągły Roman z interlinią 1,5; małe etykiety pogrubione z lekkim rozstrzeleniem liter.
- **Karty**: białe lub jasnomiętowe, duży promień i charakterystyczny prawie prostokątny prawy dolny narożnik (`--r-card`), miękki cień; odnośnik „Czytaj dalej ⌟” w prawym dolnym rogu (`CornerLink`).
- **Zdjęcia**: w próbkach monochromatyczne zielone (duotone) lub archiwalne; często z jednym bardzo dużym zaokrąglonym narożnikiem (ćwierćkole – `Media shape="arc-…"`). W prototypie zamiast zdjęć są ilustracje `Illustration`/`Media ill=…`.
- **Przyciski**: pigułki; główny ciemnozielony z ikoną (np. bilet + „Kup bilet”), drugorzędny biały z cienką obwódką („Dowiedz się więcej”). Filtry: pigułki z obwódką, aktywny – jasnomiętowe tło z cieniem i ciemnozielonym pogrubionym tekstem.
- **Aplikacja mobilna (próbka C)**: u góry okrągły ciemnozielony przycisk „hamburger” (navigation drawer wysuwany z lewej: język, ustawienia, dostępność, logowanie) i logotyp po prawej; pod spodem rząd filtrów-pigułek (Wszystko / Zwiedzanie / Wydarzenia / Informacje); treść w kartach; **dolna nawigacja 5 pozycji**: Główna (pinezka), Historia (gmach), Społeczność (dymki), Nawigacja (mapa), Gra terenowa (pinezka z postacią) – pas jasnomiętowy z zaokrąglonymi górnymi rogami, aktywna pozycja jako miętowy kafel z cieniem. Ekrany podrzędne: okrągły ciemnozielony przycisk wstecz + okruszki („Historia / Galeria zdjęć”), przełącznik siatka/lista, filtry; przy przewijaniu w głąb menu dolne chowa się.
- **Kiosk (próbka B)**: pionowy ekran 1080×1920 w czarnym totemie; u góry i u dołu **zielony pas ze wzorem identyfikacji** (`PatternBand`), środek biały: nagłówek „Witaj w Fabryce Pełnej Życia” + logotyp, linia, siatka kart w 2 kolumnach; **po lewej pływające pionowe menu** (jasnomiętowy panel: Główna, Historia, Społeczność, Nawigacja, Informacje – ikona + podpis, aktywna pozycja jako kafel); **po prawej kolumna okrągłych ciemnozielonych przycisków dostępności** (EN, kontrast, A↑, A↓, lektor – `A11yBar`) oraz **przycisk dopasowania wysokości** (trzy sylwetki – `HeightIcon`; 3 położenia: stojący 150 cm / dziecko 130 cm / wózek 105 cm – elementy nawigacyjne i treść przesuwają się na wybraną wysokość, pas ze wzorem wypełnia resztę); mapa aksonometryczna terenu z dymkiem obiektu, znacznikiem „Tu jesteś”, panelem „Nawigacja” (przełącznik 3D/plan, wyszukiwarka, filtry Atrakcje/Usługi/Zwiedzanie); tryb nocny.
- Wszystkie końcówki mają tworzyć **koherentną całość** – te same kolory, kształty, ikony i komponenty.

## 6. Dostępność (WCAG 2.1 AA) – wymóg odbiorowy
Semantyczne `button`/`a`/nagłówki/listy, `aria-label` dla przycisków-ikon, widoczny fokus (jest w tokenach), obsługa klawiatury dla okien i list, kontrast ≥ 4,5:1 (tekst na `#5FB287` tylko czarny), cele dotykowe ≥ 44 px (kiosk ≥ 64 px), teksty alternatywne ilustracji (`alt`), napisy/transkrypcje/audiodeskrypcja przy materiałach wideo i audio, komunikaty przez `aria-live`, respektowanie `prefers-reduced-motion`. Skala tekstu (A↑/A↓), wysoki kontrast i lektor muszą działać na każdym ekranie końcówek publicznych.

## 7. Uczciwość prototypu
- To wersja testowa: logowanie, płatności, kamera, Bluetooth, GPS, wideo i połączenie z tłumaczem są **symulowane** – oznaczaj to krótką, dyskretną adnotacją tam, gdzie użytkownik mógłby wziąć symulację za prawdziwą usługę (np. ekran operatora płatności: „Środowisko testowe – nie podawaj prawdziwych danych karty”; bez pól na numer karty – wybór metody i przyciski „Zatwierdź/Odrzuć płatność testową”, kod BLIK generowany).
- Nie rysuj ani nie odtwarzaj logotypu FPŻ, herbu miasta ani znaków firm – używaj `<Logo />` (znak zastępczy; właściwy plik wgrywa się w CMS). Nie osadzaj zdjęć z internetu.
- Mapy są schematyczne (adnotacja `t('c.schematicMap')`).

## 8. Jakość
- Kod zwarty, ale kompletny: każda funkcja z listy w Twoim zadaniu ma **działać** (klik → efekt w stanie → widoczny rezultat), nie być atrapą. Jeżeli coś świadomie upraszczasz – zrób to czytelnie i wymień w raporcie.
- Żadnych błędów w konsoli. Obsłuż puste listy (`Empty`), błędy API (`toast(L(res.message), 'error')`), brak sesji (logowanie w miejscu).
- Sprawdź wygląd na zrzutach (Read) – także tryb nocny/kontrast i wersję EN; popraw rozjazdy, ucięte teksty, nakładanie się elementów.
- Animowane przejścia między stanami (wymóg dla aplikacji interaktywnych) – krótkie (150–250 ms), CSS.

## 9. Podział plików i prefiksy
| moduł | katalog / pliki | klasa korzenia | prefiks klas | prefiks kluczy i18n |
|---|---|---|---|---|
| aplikacja mobilna | `src/endpoints/mobile/*` | `.ep-mobile` | `m-` | `m.` |
| gra terenowa (sekcja aplikacji) | `src/endpoints/game/*` | (wewnątrz `.ep-mobile`) `.ep-game` | `g-` | `g.` |
| system rezerwacji (wspólny dla aplikacji i WWW) | `src/endpoints/reservation/*` | `.ep-res` | `r-` | `r.` |
| strona WWW / PWA | `src/endpoints/web/*` | `.ep-web` | `w-` | `w.` |
| kioski | `src/endpoints/kiosk/*` | `.ep-kiosk` | `k-` | `k.` |
| ekrany LCD | `src/endpoints/signage/*` | `.ep-signage` | `s-` | `s.` |
| CMS | `src/endpoints/cms/*` | `.ep-cms` | `c-` (uwaga: nie `fpz-`) | – |
| zarządzanie ekspozycją | `src/endpoints/mgmt/*` | `.ep-mgmt` | `x-` | – |
| stanowisko bileterskie | `src/endpoints/validator/*` | `.ep-validator` | `v-` | – |
| ilustracje | `src/ui/illustrations.jsx` | – | `ill-` | – |
| mapy | `src/ui/maps.jsx`, `src/ui/maps.css` | – | `map-` | `map.` |
| multimedia | `src/ui/media.jsx`, `src/ui/media.css` | – | `md-` | `md.` |
Moduł może mieć wiele plików w swoim katalogu; `index.jsx` ma **domyślny eksport** komponentu końcówki. Testy/skrypty pomocnicze trzymaj w `test/<moduł>-*.mjs`, zrzuty w `shots/<moduł>-*.png`.

## 10. Raport końcowy agenta (krótko)
1) co działa (lista funkcji), 2) co uproszczono/pominięto i dlaczego, 3) potrzebne zmiany poza własnym zakresem (jądro, komponenty wspólne, dane), 4) wynik ostatniego `build` i `shot` (bez błędów konsoli), 5) nazwy 2–4 najlepszych zrzutów w `shots/`.

## 11. Kontrakty między modułami (tylko eksporty domyślne!)
Moduły importują się wyłącznie przez **eksport domyślny** `index.jsx` (przy budowaniu z `--only` brakujące moduły są podmieniane zaślepką z samym eksportem domyślnym).
- **Gra terenowa w aplikacji**: `import GameSection from '../game/index.jsx'` → `<GameSection nav={{ openEntry(entryId), openPoi(poiId), showOnMap(poiId), openScanner(), openCoupons() }} />`. Komponent wypełnia kontener (100% wysokości między paskiem stanu a dolną nawigacją aplikacji), sam zarządza nagłówkiem, nawigacją wewnętrzną i przewijaniem. Korzysta z `useClient()` aplikacji (nie tworzy własnego `<Client>`).
- **System rezerwacji w aplikacji i na stronie**: `import ReservationApp from '../reservation/index.jsx'` → `<ReservationApp channel="mobile"|"web" initial={{ view: 'home'|'events'|'event'|'venues'|'venue'|'cart'|'account'|'tickets', id }} nav={{ showOnMap(poiId) }} />`. Wypełnia kontener gospodarza, sam zarządza nawigacją wewnętrzną (zmiana `initial` wraz z `key` = głębokie wejście, np. „Kup bilet” z karty wydarzenia). Korzysta z `useClient()` gospodarza – sesja i koszyk należą do końcówki (`mobile` albo `web`), konto klienta jest wspólne.
  Liczbę pozycji w koszyku gospodarz liczy sam: `sel.cart(client).count`.
- **Kody „zabierz na telefon”** (kiosk, WWW, LCD → skaner w aplikacji): `<QR value="E:<entryId>" />`, `P:<poiId>`, `V:<eventId>`, `O:<venueId>`, `C:<couponId>`; bilety `sel.ticketPayload(t)`, kody wyzwalaczy `sel.qrPayload(trigger)`. Aplikacja rozpoznaje je przez `api.triggers.resolve(kod)` i otwiera właściwy ekran wg `target.type`.
- **Stan urządzeń** (`state.devices`, zmieniany w „Zarządzaniu ekspozycją”) obowiązuje kioski i ekrany LCD: `power` (`on`/`off`/`service`/`fault`), `night`, `volume`, `brightness`, `playlistId`, `heightMode`, `restartedAt`.
- **Transmisja i napisy**: `state.live` (`onAir`, `title`, `captions`) – sterowane w „Zarządzaniu ekspozycją”, wyświetlane w aplikacji, na stronie i na ekranie LCD (`<LiveCaptions>`).
- **Powiadomienia push** z CMS: `sel.pushFor('mobile')` – aplikacja pokazuje baner i centrum powiadomień.

## 12. Tryb serwerowy (pilotaż na Netlify) i końcówki samodzielne
Ten sam kod buduje się w dwóch trybach: **lokalnym** (jeden plik, dane w przeglądarce – jak dotąd) i **serwerowym** (`node build.mjs --api=""`): operacje API są wykonywane lokalnie (natychmiastowy wynik), a równolegle wysyłane na serwer, który jest źródłem prawdy; stan wspólny wraca z serwera i jest podmieniany w `useStore()` (także zmiany z innych urządzeń, co kilka sekund). Dla modułów nic się nie zmienia poza tym, że:
- **wszystkie zmiany danych wspólnych muszą iść przez `api.*`** (bez bezpośredniego `update()` na danych wspólnych – takie zmiany nie trafią na serwer i znikną przy synchronizacji); stan lokalny końcówki (`client`, `set()`) pozostaje lokalny;
- `state.deviceId` – identyfikator urządzenia; `state.net` – `{ mode: 'local'|'remote', status: 'online'|'offline'|'connecting', pending, version }`;
- `state.player` to gracz TEGO urządzenia (na serwerze każdy telefon ma własny postęp gry).

**Końcówki samodzielne** – każda końcówka działa także pod własnym adresem, bez powłoki symulatora (to jest właściwa aplikacja na urządzenie): `/app` (telefon, także APK), `/www`, `/kiosk/TZ.T1.1` … `/kiosk/TZ.T1.5`, `/lcd/LCD-01`, `/bileter`, `/cms`, `/ekspozycja`. Powłoka samodzielna (`src/shell/standalone.jsx`) renderuje komponent końcówki na całe okno i przekazuje prop **`standalone`**:
- `MobileApp({ platform, standalone: true })` – wypełnia całe okno (bez ramki 390×844; szerokości telefonów 320–480 px), marginesy bezpieczne ze zmiennych `--safe-top`/`--safe-bottom` (ustawia je powłoka z `env(safe-area-inset-*)`). Nie ma panelu „Otoczenie telefonu” – aplikacja musi sama udostępnić **tryb testowy** (zob. zadanie modułu).
- `WebApp({ viewport, standalone: true })`, `ValidatorApp({ standalone: true })`, `CmsApp()`, `MgmtApp()` – bez zmian w kontrakcie.
- `KioskEndpoint({ standalone: 'TZ.T1.3' })` – tylko ekran wskazanego kiosku (1080×1920 w `ScaleBox` na całe okno, czarne tło), bez listy stanowisk i totemu; `SignageEndpoint({ standalone: 'LCD-01' })` – analogicznie 1920×1080.
**Logowanie to makieta**: formularze logowania mają wstępnie wypełniony login i hasło konta testowego – wystarczy nacisnąć „Zaloguj”.

**Aplikacja dla zwiedzających** (`src/main-app.jsx`; cele `--target=apk` oraz `/app` w `--target=netlify`): osobna paczka wyłącznie z `MobileApp` (z grą i rezerwacjami). Kompilacja ustawia `globalThis.FPZ_APP_ONLY` – wtedy `api.js` nie zawiera operacji zaplecza (`ADMIN_OPS`: `cms.*`, `devices.*`, `staff.*`, `sys.*`, `live.*`, `tickets.*`), `seed.js` nie zawiera danych zaplecza (`BACKOFFICE_KEYS`), a `build.mjs` przerywa budowanie, gdy do paczki trafi moduł innej końcówki. Klient zgłasza się do API z `role=app`: serwer pomija w odpowiedziach `BACKOFFICE_KEYS` (w tym postępy innych graczy) i odrzuca operacje zaplecza (`FORBIDDEN`). Nowa operacja zaplecza musi trafić do `ADMIN_OPS` i do wzorca `ADMIN_OP` w `server/core.mjs`.
**Backend** (`server/core.mjs`): `GET /api/sync?device&role&since&epoch&etag[&tick]` – dane wspólne (całość albo klucze zmienione po wersji `since`); `POST /api/rpc { deviceId, role, since, epoch, ops: [{ op, args, nonce, clientId, client, env }] }` – paczka operacji wykonywana w jednym zapisie warunkowym (kolizja → ponowienie na świeżym stanie; `nonce` chroni przed podwójnym wykonaniem); `POST /api/reset`; `GET /api/info`. Gracze: `players[deviceId]`, klient dostaje własnego jako `player`.
