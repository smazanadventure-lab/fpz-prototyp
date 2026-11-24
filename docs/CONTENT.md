# Treści przykładowe – schemat danych (`src/content/*.js`)

Wszystkie pliki to czyste moduły ES z danymi (bez importów, bez funkcji), aby dało się je wczytać w Node i w przeglądarce.
Typ `L` = tekst dwujęzyczny: `{ pl: '…', en: '…' }` – **oba języki zawsze wypełnione**.
Identyfikatory: małe litery, cyfry, myślniki (`hala-zabkowice`). Współrzędne `lat/lng` – przybliżone (mapa jest schematyczna).

Identyfikatory ilustracji (`ill`) – wolno używać WYŁĄCZNIE tych:
`hall-exterior, hall-interior, hall-green, passage, factory-archival, machine-tool, workers, steelworks, mine, glassworks, railway, lake, desert, wetland, forest, park, tree, river, quarry, church, palace, city-street, city-panorama, tower, stage, market, food, workshop, kids, future-city, studio, map-old`

## meta.js
```js
export const site = {
  name: L, tagline: L, about: L,            // about: 2–3 akapity rozdzielone \n\n
  address: '…', lat, lng,
  contact: { phone, email, www },
  hours: L,
  social: [{ kind: 'facebook'|'instagram'|'youtube'|'tiktok'|'linkedin', label, url }],
  sources: [{ title, url }],                // bibliografia faktów (strony, z których pochodzą informacje)
};
// Plan terenu FPŻ: układ współrzędnych 0..100 (x: zachód→wschód, y: północ→południe)
export const sitePlan = {
  widthM, heightM,                           // przybliżone wymiary terenu w metrach
  origin: { lat, lng },                      // lewy-górny róg (do przeliczeń x,y → lat,lng)
  streets: [{ name, points: [[x,y],[x,y]…] }],
  greens:  [{ name, points: [[x,y]…] }],      // wielokąty zieleni / placów
  entrances: [{ name: L, x, y }],
};
export const districts = [{ id, name: 'Gołonóg', lat, lng, blurb: L, boardCode: 'TD-01' }]; // dzielnice + tablice dzielnicowe
export const eras = [{ id, name: L, from: 1796, to: 1830, summary: L }];                     // oś czasu trasy historycznej (5–7 epok)
```

## pois.js
```js
export const pois = [{
  id, name: L,
  kind: 'hall'|'spot'|'nature'|'park'|'tree'|'industry'|'history'|'culture'|'service',
  scope: 'fpz'|'city',                // na terenie FPŻ / w mieście i okolicy
  lat, lng,
  site: { x, y } | null,              // tylko scope 'fpz' – środek obiektu na planie terenu
  building: { w, d, floors, roof: 'sawtooth'|'gable'|'flat' } | null,  // tylko hale/budynki FPŻ (w,d w jednostkach planu 0..100)
  districtId,
  short: L,                           // 1 zdanie
  description: L,                     // 1–2 akapity
  accessible: true|false, accessNote: L,
  protection: L | null,               // np. „użytek ekologiczny”
  tags: ['…'], ill,
}];
```
Stałe identyfikatory, które MUSZĄ istnieć (scope 'fpz'): `hala-zielona`, `pasaz-reden`, `fabryka-wczoraj-i-dzis`, `hala-tworzen`, `hala-zabkowice`, `dzwieki-miasta`, `wieza-widokowa`.

## entries.js
```js
export const categories = [{ id, parentId: null|id, name: L, icon: 'history'|'people'|'leaf'|'factory'|'calendar'|'info'|'star'|'map', order }];
export const entries = [{
  id, categoryId,                     // kategoria lub podkategoria
  title: L, lead: L, body: L,         // body: akapity rozdzielone \n\n, dopuszczalne **pogrubienie**
  year: 1920|null, eraId: id|null, poiId: id|null, districtId: id|null,
  media: [{ type: 'image'|'video'|'audio'|'model3d'|'panorama', ill, caption: L, credit: '…', durationSec?, modelId?: 'lathe'|'hall'|'tower' }],
  audioGuide: { text: L } | null,     // tekst lektora (2–4 zdania); null = brak
  tags: ['…'], featured: true|false,
  channels: ['mobile','web','kiosk'],
}];
export const news    = [{ id, title: L, body: L, dayOffset: -3, ill }];   // dayOffset: dni względem „dziś”
export const videos  = [{ id, title: L, description: L, durationSec, ill, kind: 'studio'|'archive'|'live', year: null|1977,
                          captions: [{ t: 0, text: L }, { t: 6, text: L } …] }];  // 5–8 linii napisów
export const gallery = [{ id, title: L, description: L, ill, year, author: '…', tags: ['…'] }];
```

## offer.js (system rezerwacji)
```js
export const venues = [{ id, name: L, category: 'gastro'|'attraction'|'institution'|'tenant'|'culture',
  description: L, poiId: id|null, contact: { phone, email, www, address }, hours: L,
  acceptsInquiries: true|false, ill, tags: ['…'], sample: true|false }];   // sample: true = podmiot fikcyjny (dane demo)
export const events = [{ id, title: L, description: L, dayOffset: 3, time: '18:00', durationMin: 120,
  poiId, venueId: id|null, category: 'koncert'|'warsztaty'|'wystawa'|'targi'|'spotkanie'|'sport'|'dzieci'|'film',
  ill, ticketed: true|false, capacity: 200, live: false }];
export const products = [{ id, kind: 'ticket'|'zone'|'package', name: L, description: L, price: 25,   // PLN brutto
  eventId: id|null, venueId: id|null, refundableHours: 24, maxPerOrder: 10, includes: [productId…]|null }];
export const coupons = [{ id, title: L, description: L, venueId, discount: L,
  condition: { type: 'none'|'points'|'mission'|'route', value: 100|'missionId'|'routeId' }, validDays: 60 }];
```

## game.js (gra terenowa)
```js
export const gameRoutes = [{
  id: 'nature'|'industry'|'history'|'future',     // DOKŁADNIE te cztery
  name: L, tagline: L, description: L, ill,
  modes:    [{ id: 'walk'|'bike'|'access', name: L, note: L }],                  // wymagane dla 'nature'
  lengths:  [{ id: 's'|'m'|'l', name: L, km, durationMin, missionIds: [...] }],   // wymagane dla 'nature' (3 długości), opcjonalne dla innych
  variants: [{ id: 'technology'|'product'|'creators'|'pioneers', name: L, description: L }], // wymagane dla 'industry'
  missions: [{
    id, title: L, poiId,
    kind: 'qr'|'ble'|'ar'|'gps'|'quiz'|'panorama'|'idea',
    story: L,             // opowieść po dotarciu (2–4 zdania)
    task: L,              // zadanie
    taskEasy: L,          // wersja uproszczona (dzieci / łatwy poziom)
    points: 50,
    quizId: id|null,
    eraId: id|null, districtId: id|null,           // trasa historyczna: obie wartości wypełnione
    variantText: { technology: L, product: L, creators: L, pioneers: L } | null,  // trasa przemysłowa: inna treść w każdym wariancie
    accessible: true|false,
  }],
}];
export const quizzes = [{ id, title: L, questions: [{ id, q: L, answers: [L, L, L, L], correct: 0..3, explain: L, level: 'easy'|'medium'|'hard' }] }];
export const rewards = [{ id, name: L, description: L, cost: 150, pickup: L, stock: 40, ill }];
export const ideaCategories = [{ id, name: L }];        // „katalog możliwości” – obszary, w których mieszkańcy zgłaszają pomysły
export const futureHotspots = [{ id, name: L, az: 0..359, kind: 'fpz'|'city', poiId: id|null,
  now: L, future: L, effects: { social: L, cultural: L, urban: L, demographic: L } }];   // obiekty widoczne na panoramie 360°
export const sampleIdeas = [{ id, nick, categoryId, text: L, poiId: id|null, votes: 12, status: 'approved'|'pending' }];
```
