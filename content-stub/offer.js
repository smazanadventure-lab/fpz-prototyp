const L = (pl, en) => ({ pl, en });
export const venues = [{ id: 'kawiarnia-pod-suwnica', name: L('Kawiarnia Pod Suwnicą', 'Under the Crane Café'), category: 'gastro', description: L('Kawa i ciasta.', 'Coffee and cakes.'), poiId: 'pasaz-reden',
  contact: { phone: '+48 32 000 00 01', email: 'kawiarnia@fpz.example', www: 'https://fpz.example/kawiarnia', address: 'Pasaż Reden' }, hours: L('8:00–20:00', '8:00–20:00'), acceptsInquiries: true, ill: 'food', tags: ['kawa'], sample: true }];
export const events = [{ id: 'koncert-1', title: L('Koncert w Hali Ząbkowice', 'Concert at Ząbkowice Hall'), description: L('Opis.', 'Description.'), dayOffset: 3, time: '19:00', durationMin: 120,
  poiId: 'hala-zabkowice', venueId: null, category: 'koncert', ill: 'stage', ticketed: true, capacity: 200, live: true }];
export const products = [
  { id: 'koncert-1-n', kind: 'ticket', name: L('Bilet normalny', 'Standard ticket'), description: L('Wstęp na koncert.', 'Concert admission.'), price: 40, eventId: 'koncert-1', venueId: null, refundableHours: 24, maxPerOrder: 10, includes: null },
  { id: 'wieza-wstep', kind: 'zone', name: L('Wieża widokowa – wstęp', 'Viewing tower – admission'), description: L('Bilet do strefy.', 'Zone ticket.'), price: 12, eventId: null, venueId: null, refundableHours: 2, maxPerOrder: 10, includes: null },
];
export const coupons = [{ id: 'kupon-kawa', title: L('Kawa -15%', 'Coffee -15%'), description: L('Zniżka na kawę.', 'Coffee discount.'), venueId: 'kawiarnia-pod-suwnica', discount: L('-15%', '-15%'), condition: { type: 'points', value: 50 }, validDays: 60 }];
