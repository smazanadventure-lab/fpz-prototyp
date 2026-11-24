// Walidator treści: node tools/validate-content.mjs
import * as c from '../src/content/index.js';
const ILLS = 'hall-exterior, hall-interior, hall-green, passage, factory-archival, machine-tool, workers, steelworks, mine, glassworks, railway, lake, desert, wetland, forest, park, tree, river, quarry, church, palace, city-street, city-panorama, tower, stage, market, food, workshop, kids, future-city, studio, map-old'.split(', ');
const errs = []; const warn = [];
const E = (m) => errs.push(m);
const isL = (v) => v && typeof v === 'object' && typeof v.pl === 'string' && typeof v.en === 'string';
const needL = (o, k, where, allowEmpty = false) => { if (!isL(o[k])) E(`${where}: pole "${k}" musi być {pl,en}`); else if (!allowEmpty && (!o[k].pl.trim() || !o[k].en.trim())) E(`${where}: pole "${k}" puste w pl lub en`); };
const ids = (arr, name) => { const s = new Set(); for (const x of arr) { if (!x.id || !/^[a-z0-9-]+$/.test(x.id)) E(`${name}: zły id "${x.id}"`); if (s.has(x.id)) E(`${name}: zdublowany id "${x.id}"`); s.add(x.id); } return s; };
const ill = (v, where) => { if (!ILLS.includes(v)) E(`${where}: nieznana ilustracja "${v}"`); };
for (const k of ['site', 'sitePlan', 'districts', 'eras', 'pois', 'categories', 'entries', 'news', 'videos', 'gallery', 'venues', 'events', 'products', 'coupons', 'gameRoutes', 'quizzes', 'rewards', 'ideaCategories', 'futureHotspots', 'sampleIdeas']) if (c[k] == null) E(`brak eksportu "${k}"`);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
['name', 'tagline', 'about', 'hours'].forEach((k) => needL(c.site, k, 'site'));
const dId = ids(c.districts, 'districts'); c.districts.forEach((d) => { needL(d, 'blurb', `district ${d.id}`); if (typeof d.lat !== 'number' || typeof d.lng !== 'number') E(`district ${d.id}: brak lat/lng`); });
const eId = ids(c.eras, 'eras'); c.eras.forEach((e) => { needL(e, 'name', `era ${e.id}`); needL(e, 'summary', `era ${e.id}`); });
const pId = ids(c.pois, 'pois');
for (const p of c.pois) { const w = `poi ${p.id}`; ['name', 'short', 'description', 'accessNote'].forEach((k) => needL(p, k, w, k === 'accessNote'));
  if (!['hall', 'spot', 'nature', 'park', 'tree', 'industry', 'history', 'culture', 'service'].includes(p.kind)) E(`${w}: kind`);
  if (!['fpz', 'city'].includes(p.scope)) E(`${w}: scope`);
  if (typeof p.lat !== 'number' || typeof p.lng !== 'number') E(`${w}: lat/lng`);
  if (p.lat < 50.2 || p.lat > 50.5 || p.lng < 19.0 || p.lng > 19.6) warn.push(`${w}: współrzędne poza okolicą Dąbrowy Górniczej (${p.lat}, ${p.lng})`);
  if (p.scope === 'fpz' && (!p.site || typeof p.site.x !== 'number')) E(`${w}: scope fpz wymaga site{x,y}`);
  if (p.districtId && !dId.has(p.districtId)) E(`${w}: nieznana dzielnica ${p.districtId}`);
  if (p.protection != null && !isL(p.protection)) E(`${w}: protection`);
  ill(p.ill, w); }
for (const need of ['hala-zielona', 'pasaz-reden', 'fabryka-wczoraj-i-dzis', 'hala-tworzen', 'hala-zabkowice', 'dzwieki-miasta', 'wieza-widokowa']) if (!pId.has(need)) E(`brak wymaganego POI "${need}"`);
const cId = ids(c.categories, 'categories'); c.categories.forEach((x) => { needL(x, 'name', `category ${x.id}`); if (x.parentId && !cId.has(x.parentId)) E(`category ${x.id}: parentId`); });
ids(c.entries, 'entries');
for (const e of c.entries) { const w = `entry ${e.id}`; ['title', 'lead', 'body'].forEach((k) => needL(e, k, w)); if (!cId.has(e.categoryId)) E(`${w}: categoryId`);
  if (e.poiId && !pId.has(e.poiId)) E(`${w}: poiId ${e.poiId}`); if (e.eraId && !eId.has(e.eraId)) E(`${w}: eraId`); if (e.districtId && !dId.has(e.districtId)) E(`${w}: districtId`);
  for (const m of e.media || []) { ill(m.ill, w + ' media'); needL(m, 'caption', w + ' media', true); if (!['image', 'video', 'audio', 'model3d', 'panorama'].includes(m.type)) E(`${w}: media.type`); }
  if (e.audioGuide && !isL(e.audioGuide.text)) E(`${w}: audioGuide.text`); if (!Array.isArray(e.channels)) E(`${w}: channels`); }
ids(c.news, 'news'); c.news.forEach((n) => { needL(n, 'title', `news ${n.id}`); needL(n, 'body', `news ${n.id}`); ill(n.ill, `news ${n.id}`); });
ids(c.videos, 'videos'); c.videos.forEach((v) => { needL(v, 'title', `video ${v.id}`); needL(v, 'description', `video ${v.id}`); ill(v.ill, `video ${v.id}`); (v.captions || []).forEach((x) => { if (!isL(x.text)) E(`video ${v.id}: captions`); }); });
ids(c.gallery, 'gallery'); c.gallery.forEach((g) => { needL(g, 'title', `gallery ${g.id}`); ill(g.ill, `gallery ${g.id}`); });
const vId = ids(c.venues, 'venues'); c.venues.forEach((v) => { needL(v, 'name', `venue ${v.id}`); needL(v, 'description', `venue ${v.id}`); needL(v, 'hours', `venue ${v.id}`, true); if (v.poiId && !pId.has(v.poiId)) E(`venue ${v.id}: poiId`); ill(v.ill, `venue ${v.id}`); if (!v.contact) E(`venue ${v.id}: contact`); });
const evId = ids(c.events, 'events'); c.events.forEach((e) => { needL(e, 'title', `event ${e.id}`); needL(e, 'description', `event ${e.id}`); if (!pId.has(e.poiId)) E(`event ${e.id}: poiId`); if (e.venueId && !vId.has(e.venueId)) E(`event ${e.id}: venueId`); if (typeof e.dayOffset !== 'number' || !/^\d\d:\d\d$/.test(e.time)) E(`event ${e.id}: dayOffset/time`); ill(e.ill, `event ${e.id}`); });
const prId = ids(c.products, 'products'); c.products.forEach((p) => { needL(p, 'name', `product ${p.id}`); needL(p, 'description', `product ${p.id}`); if (typeof p.price !== 'number') E(`product ${p.id}: price`); if (p.eventId && !evId.has(p.eventId)) E(`product ${p.id}: eventId`); if (p.venueId && !vId.has(p.venueId)) E(`product ${p.id}: venueId`); (p.includes || []).forEach((i) => { if (!prId.has(i)) E(`product ${p.id}: includes ${i}`); }); });
c.events.filter((e) => e.ticketed).forEach((e) => { if (!c.products.some((p) => p.eventId === e.id)) E(`event ${e.id}: biletowane, ale brak produktu`); });
const rIds = c.gameRoutes.map((r) => r.id).sort().join(','); if (rIds !== 'future,history,industry,nature') E(`gameRoutes: wymagane dokładnie nature, industry, history, future (jest: ${rIds})`);
const qId = ids(c.quizzes, 'quizzes'); const mAll = new Set();
for (const r of c.gameRoutes) { ['name', 'tagline', 'description'].forEach((k) => needL(r, k, `route ${r.id}`)); ill(r.ill, `route ${r.id}`);
  for (const m of r.missions) { const w = `mission ${m.id}`; if (mAll.has(m.id)) E(`${w}: duplikat`); mAll.add(m.id); ['title', 'story', 'task', 'taskEasy'].forEach((k) => needL(m, k, w));
    if (!pId.has(m.poiId)) E(`${w}: poiId ${m.poiId}`); if (!['qr', 'ble', 'ar', 'gps', 'quiz', 'panorama', 'idea'].includes(m.kind)) E(`${w}: kind`); if (m.quizId && !qId.has(m.quizId)) E(`${w}: quizId`);
    if (m.eraId && !eId.has(m.eraId)) E(`${w}: eraId`); if (m.districtId && !dId.has(m.districtId)) E(`${w}: districtId`);
    if (r.id === 'history' && (!m.eraId || !m.districtId)) E(`${w}: trasa historyczna wymaga eraId i districtId`);
    if (r.id === 'industry' && !m.variantText) warn.push(`${w}: brak variantText`);
    if (m.variantText) for (const k of ['technology', 'product', 'creators', 'pioneers']) if (!isL(m.variantText[k])) E(`${w}: variantText.${k}`); }
  if (r.id === 'nature') { if ((r.modes || []).length !== 3) E('route nature: 3 tryby'); if ((r.lengths || []).length !== 3) E('route nature: 3 długości'); }
  if (r.id === 'industry' && (r.variants || []).length !== 4) E('route industry: 4 warianty');
  for (const l of r.lengths || []) for (const id of l.missionIds) if (!r.missions.some((m) => m.id === id)) E(`route ${r.id} length ${l.id}: nieznana misja ${id}`); }
c.quizzes.forEach((q) => { needL(q, 'title', `quiz ${q.id}`); q.questions.forEach((x) => { needL(x, 'q', `quiz ${q.id}/${x.id}`); needL(x, 'explain', `quiz ${q.id}/${x.id}`); if (!Array.isArray(x.answers) || x.answers.length < 2 || !x.answers.every(isL)) E(`quiz ${q.id}/${x.id}: answers`); if (!(x.correct >= 0 && x.correct < x.answers.length)) E(`quiz ${q.id}/${x.id}: correct`); }); });
ids(c.rewards, 'rewards'); c.rewards.forEach((r) => { needL(r, 'name', `reward ${r.id}`); needL(r, 'pickup', `reward ${r.id}`); ill(r.ill, `reward ${r.id}`); });
ids(c.coupons, 'coupons'); c.coupons.forEach((k) => { needL(k, 'title', `coupon ${k.id}`); if (!vId.has(k.venueId)) E(`coupon ${k.id}: venueId`); const t = k.condition?.type; if (t === 'mission' && !mAll.has(k.condition.value)) E(`coupon ${k.id}: misja`); if (t === 'route' && !['nature', 'industry', 'history', 'future'].includes(k.condition.value)) E(`coupon ${k.id}: trasa`); });
const icId = ids(c.ideaCategories, 'ideaCategories');
ids(c.futureHotspots, 'futureHotspots'); c.futureHotspots.forEach((h) => { ['name', 'now', 'future'].forEach((k) => needL(h, k, `hotspot ${h.id}`)); for (const k of ['social', 'cultural', 'urban', 'demographic']) if (!isL(h.effects?.[k])) E(`hotspot ${h.id}: effects.${k}`); if (h.poiId && !pId.has(h.poiId)) E(`hotspot ${h.id}: poiId`); });
c.sampleIdeas.forEach((i) => { if (!icId.has(i.categoryId)) E(`idea ${i.id}: categoryId`); needL(i, 'text', `idea ${i.id}`); });
const count = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(' ');
console.log('Liczności:', count({ districts: c.districts.length, eras: c.eras.length, pois: c.pois.length, poisFPZ: c.pois.filter((p) => p.scope === 'fpz').length, categories: c.categories.length, entries: c.entries.length, news: c.news.length, videos: c.videos.length, gallery: c.gallery.length, venues: c.venues.length, events: c.events.length, products: c.products.length, coupons: c.coupons.length, missions: mAll.size, quizzes: c.quizzes.length, rewards: c.rewards.length, hotspots: c.futureHotspots.length }));
if (warn.length) console.log('OSTRZEŻENIA:\n' + warn.join('\n'));
if (errs.length) { console.error(`BŁĘDY (${errs.length}):\n` + errs.join('\n')); process.exit(1); }
console.log('OK – treści poprawne.');
