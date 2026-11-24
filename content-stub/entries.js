const L = (pl, en) => ({ pl, en });
export const categories = [
  { id: 'historia', parentId: null, name: L('Historia', 'History'), icon: 'history', order: 1 },
  { id: 'historia-fabryka', parentId: 'historia', name: L('Fabryka', 'The factory'), icon: 'factory', order: 1 },
  { id: 'spolecznosc', parentId: null, name: L('Społeczność', 'Community'), icon: 'people', order: 2 },
];
export const entries = [
  { id: 'defum-poczatki', categoryId: 'historia-fabryka', title: L('Od warsztatów do fabryki obrabiarek', 'From workshops to a machine-tool factory'),
    lead: L('Krótka historia zakładu.', 'A short history of the works.'), body: L('Treść zastępcza.\n\nDrugi akapit.', 'Placeholder.\n\nSecond paragraph.'),
    year: 1945, eraId: 'era-poczatki', poiId: 'hala-zabkowice', districtId: 'srodmiescie',
    media: [{ type: 'image', ill: 'factory-archival', caption: L('Hala montażu', 'Assembly hall'), credit: 'ilustracja' }, { type: 'model3d', ill: 'machine-tool', caption: L('Tokarka', 'Lathe'), credit: '', modelId: 'lathe' }],
    audioGuide: { text: L('Witaj w Hali Ząbkowice.', 'Welcome to Ząbkowice Hall.') }, tags: ['fabryka'], featured: true, channels: ['mobile', 'web', 'kiosk'] },
];
export const news = [{ id: 'news-1', title: L('Nowy sezon wydarzeń', 'A new season of events'), body: L('Treść zastępcza.', 'Placeholder.'), dayOffset: -2, ill: 'stage' }];
export const videos = [{ id: 'video-1', title: L('Fabryka z lotu ptaka', 'The Factory from above'), description: L('Materiał z wirtualnego studia.', 'From the virtual studio.'), durationSec: 95, ill: 'city-panorama', kind: 'studio', year: null,
  captions: [{ t: 0, text: L('Witamy w Fabryce Pełnej Życia.', 'Welcome to the Factory Full of Life.') }, { t: 6, text: L('Zaczynamy spacer.', 'Let us begin the walk.') }] }];
export const gallery = [{ id: 'gal-1', title: L('Hala produkcyjna', 'Production hall'), description: L('Opis.', 'Description.'), ill: 'hall-interior', year: 1975, author: 'archiwum', tags: ['hala'] }];
