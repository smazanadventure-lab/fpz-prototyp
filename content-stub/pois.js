const L = (pl, en) => ({ pl, en });
const hall = (id, pl, en, x, y, w, d, roof, ill) => ({
  id, name: L(pl, en), kind: 'hall', scope: 'fpz', lat: 50.3256 - y * 0.00002, lng: 19.1858 + x * 0.00004,
  site: { x, y }, building: { w, d, floors: 1, roof }, districtId: 'srodmiescie',
  short: L('Obiekt na terenie Fabryki.', 'A building on the Factory site.'),
  description: L('Opis zastępczy – zostanie uzupełniony.', 'Placeholder description – to be completed.'),
  accessible: true, accessNote: L('Wejście bez progów.', 'Step-free entrance.'), protection: null, tags: ['fpz'], ill,
});
export const pois = [
  hall('hala-zielona', 'Hala Zielona', 'Green Hall', 24, 30, 22, 14, 'sawtooth', 'hall-green'),
  hall('pasaz-reden', 'Pasaż Reden', 'Reden Passage', 50, 28, 8, 30, 'flat', 'passage'),
  hall('hala-tworzen', 'Hala Tworzeń', 'Tworzeń Hall', 74, 32, 24, 16, 'gable', 'hall-exterior'),
  hall('hala-zabkowice', 'Hala Ząbkowice', 'Ząbkowice Hall', 30, 70, 26, 16, 'sawtooth', 'hall-interior'),
  { ...hall('fabryka-wczoraj-i-dzis', 'Fabryka wczoraj i dziś', 'The Factory then and now', 52, 52, 0, 0, 'flat', 'factory-archival'), kind: 'spot', building: null },
  { ...hall('dzwieki-miasta', 'Dźwięki miasta', 'Sounds of the city', 38, 62, 0, 0, 'flat', 'workers'), kind: 'spot', building: null },
  { ...hall('wieza-widokowa', 'Wieża widokowa', 'Viewing tower', 80, 68, 5, 5, 'flat', 'tower'), kind: 'spot', building: { w: 5, d: 5, floors: 6, roof: 'flat' } },
  { id: 'pogoria-3', name: L('Pogoria III', 'Pogoria III lake'), kind: 'nature', scope: 'city', lat: 50.352, lng: 19.203, site: null, building: null, districtId: 'golonog',
    short: L('Jezioro z plażami.', 'A lake with beaches.'), description: L('Opis zastępczy.', 'Placeholder.'), accessible: true, accessNote: L('Utwardzona ścieżka.', 'Paved path.'), protection: null, tags: ['woda'], ill: 'lake' },
];
