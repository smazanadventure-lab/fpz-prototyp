const L = (pl, en) => ({ pl, en });
export const site = {
  name: L('Fabryka Pełna Życia', 'Factory Full of Life'),
  tagline: L('Nowe centrum Dąbrowy Górniczej', 'The new heart of Dąbrowa Górnicza'),
  about: L('Teren dawnej fabryki obrabiarek w centrum miasta zmienia się w przestrzeń spotkań, kultury i biznesu.\n\nTo treść zastępcza – zostanie uzupełniona.', 'The former machine-tool factory in the city centre is turning into a place for meeting, culture and business.\n\nPlaceholder copy – to be completed.'),
  address: 'Dąbrowa Górnicza', lat: 50.3246, lng: 19.1879,
  contact: { phone: '+48 32 000 00 00', email: 'kontakt@fpz.example', www: 'https://fpz.example' },
  hours: L('Codziennie 8:00–22:00', 'Daily 8:00–22:00'),
  social: [{ kind: 'facebook', label: 'Facebook', url: 'https://fpz.example/fb' }],
  sources: [],
};
export const sitePlan = {
  widthM: 300, heightM: 220, origin: { lat: 50.3256, lng: 19.1858 },
  streets: [{ name: 'ul. Kościuszki', points: [[0, 4], [100, 4]] }, { name: 'ul. Kolejowa', points: [[3, 0], [3, 100]] }],
  greens: [{ name: 'Plac centralny', points: [[40, 44], [60, 44], [60, 60], [40, 60]] }],
  entrances: [{ name: L('Wejście główne', 'Main entrance'), x: 50, y: 6 }],
};
export const districts = [
  { id: 'srodmiescie', name: 'Śródmieście', lat: 50.3217, lng: 19.1949, blurb: L('Centrum miasta.', 'The city centre.'), boardCode: 'TD-01' },
  { id: 'reden', name: 'Reden', lat: 50.332, lng: 19.181, blurb: L('Dawna kolonia górnicza.', 'A former mining colony.'), boardCode: 'TD-02' },
  { id: 'golonog', name: 'Gołonóg', lat: 50.343, lng: 19.228, blurb: L('Dzielnica ze wzgórzem i kościołem.', 'A district with a hill and a church.'), boardCode: 'TD-03' },
  { id: 'zabkowice', name: 'Ząbkowice', lat: 50.367, lng: 19.27, blurb: L('Węzeł kolejowy i huta szkła.', 'A railway junction and glassworks.'), boardCode: 'TD-04' },
];
export const eras = [
  { id: 'era-poczatki', name: L('Początki przemysłu', 'Industrial beginnings'), from: 1796, to: 1870, summary: L('Odkrycie węgla i pierwsze zakłady.', 'Coal is found and the first works open.') },
  { id: 'era-wspolczesnosc', name: L('Współczesność', 'Today'), from: 1990, to: 2030, summary: L('Transformacja i rewitalizacja.', 'Transformation and renewal.') },
];
