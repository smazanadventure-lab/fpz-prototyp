// Wspólne elementy i obliczenia modułu gry terenowej.
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel, DIFFICULTY } from '../../kernel/api.js';
import { distanceM, fmtDistance, clsx } from '../../kernel/util.js';
import { Icon, Tag } from '../../ui/components.jsx';
import { KIND_ICON, LEVELS } from './strings.js';

/** Kontekst gry: klient aplikacji + stan + skróty. */
export function useGame() {
  const c = useClient(); const s = useStore();
  const p = s.player; const easy = p.profile.mode === 'simple';
  return { ...c, s, p, easy, env: s.env, offline: s.env.network === 'offline', ov: clsx('g-ov', easy && 'g-easy') };
}

/** Tekst misji wg profilu (tryb uproszczony → taskEasy) i wariantu (trasa przemysłowa). */
export function missionTask(m, p, L) { return L(p.profile.mode === 'simple' && m.taskEasy ? m.taskEasy : m.task); }
/** Opcje trasy: aktywnej (w stanie gracza) albo wybrane przed startem (stan klienta aplikacji). */
export function routeOpts(r, p, client) {
  if (!r) return {}; if (p.activeRoute?.routeId === r.id) return p.activeRoute;
  const d = client?.gameOpts?.[r.id] || {};
  return { mode: d.mode || r.modes?.[0]?.id || null, length: d.length || r.lengths?.[0]?.id || null, variant: d.variant || r.variants?.[0]?.id || null };
}
export function missionVariant(m, p, client) {
  const r = sel.routeOfMission(m.id); if (!r || !m.variantText) return null;
  const v = routeOpts(r, p, client).variant || r.variants?.[0]?.id;
  return m.variantText[v] ? { id: v, text: m.variantText[v], variant: (r.variants || []).find((x) => x.id === v) } : null;
}
export const ENV_KINDS = ['qr', 'ble', 'ar', 'gps', 'quiz'];

/** Stan misji do listy: { done, here, distanceM, label } */
export function missionStatus(m) {
  const chk = sel.missionCheck(m); const done = !!chk.done;
  const inApp = m.kind === 'panorama' || m.kind === 'idea';
  return { done, here: !done && (chk.ok || (inApp && chk.distanceM <= (m.radiusM || 40))), inApp, distanceM: chk.distanceM, chk };
}

/** Poziom gracza z punktów zdobytych (wydane na nagrody nie obniżają poziomu). */
export function levelOf(earned) {
  let i = 0; LEVELS.forEach((v, k) => { if (earned >= v) i = k; });
  return { index: i, next: LEVELS[i + 1] ?? null, from: LEVELS[i] };
}

/** Dzielnice, które mają misje trasy historycznej (licznik tick-boxów). */
export function historyDistricts(s) {
  const r = sel.route('history'); const ids = new Set((r?.missions || []).filter((m) => m.active !== false && m.districtId).map((m) => m.districtId));
  return s.districts.filter((d) => ids.has(d.id));
}

/** Odznaki gracza: [{id, icon, on}] */
export function badges(s) {
  const p = s.player; const anyDone = Object.keys(p.done).length > 0;
  const routeDone = (id) => { const r = sel.route(id); const lens = r?.lengths || []; return sel.routeProgress(id, lens.length ? { length: lens[0].id } : {}).complete; };
  const hd = historyDistricts(s); const visited = sel.districtsVisited();
  return [
    { id: 'first', icon: 'flag', on: anyDone },
    { id: 'nature', icon: 'leaf', on: routeDone('nature') },
    { id: 'industry', icon: 'factory', on: routeDone('industry') },
    { id: 'history', icon: 'history', on: routeDone('history') },
    { id: 'future', icon: 'sparkles', on: routeDone('future') },
    { id: 'quiz', icon: 'quiz', on: Object.values(p.quiz).some((q) => q.score === q.total && q.total > 0) },
    { id: 'idea', icon: 'message', on: (p.ideaBonus || 0) > 0 },
    { id: 'map', icon: 'map', on: hd.length > 0 && hd.every((d) => visited.includes(d.id)) },
  ];
}

/** Kupony, które gracz może właśnie odebrać (odblokowane warunkiem gry). */
export function unlockableCoupons(s) {
  return s.coupons.filter((c) => c.active !== false && (c.condition?.type || 'none') !== 'none').filter((c) => { const st = sel.couponState(c); return !st.claimed && st.available; }).map((c) => c.id);
}

/** Zaproszenie do kolejnego miejsca poza FPŻ: najbliższa niezaliczona misja w mieście (najpierw tej trasy), inaczej najbliższy POI miejski. */
export function nextOutside(s, fromPoi, routeId) {
  const from = fromPoi || s.env.position; const done = s.player.done;
  const cand = [];
  for (const r of s.gameRoutes) for (const m of r.missions) { if (m.active === false || done[m.id]) continue; const poi = sel.poi(m.poiId); if (poi && poi.scope === 'city') cand.push({ m, poi, r, d: distanceM(from, poi) + (r.id === routeId ? 0 : 1e6) }); }
  cand.sort((a, b) => a.d - b.d);
  if (cand[0]) return { poi: cand[0].poi, mission: cand[0].m, distanceM: distanceM(s.env.position, cand[0].poi) };
  const pois = s.pois.filter((x) => x.scope === 'city' && x.active !== false).sort((a, b) => distanceM(from, a) - distanceM(from, b));
  return pois[0] ? { poi: pois[0], mission: null, distanceM: distanceM(s.env.position, pois[0]) } : null;
}

export const multOf = (d) => DIFFICULTY[d] || 1;

/* ── Komponenty ── */
export function KindTag({ kind }) { const { t } = useClient(); return <Tag tone="deep" icon={KIND_ICON[kind] || 'target'}>{t('g.kind.' + kind)}</Tag>; }

/** Wiersz misji (lista misji trasy). */
export function MissionRow({ m, onOpen, showAccess, extra }) {
  const { t, L, p, easy, client } = useGame(); const st = missionStatus(m); const poi = sel.poi(m.poiId); const d = p.done[m.id];
  const v = missionVariant(m, p, client);
  return (<li><button type="button" class={clsx('g-mrow', st.done && 'is-done', st.here && 'is-here')} onClick={() => onOpen(m.id)}>
    <span class="g-mrow__ico" aria-hidden="true"><Icon name={st.done ? 'check' : KIND_ICON[m.kind] || 'target'} size={easy ? 24 : 20} /></span>
    <span class="g-mrow__main">
      <b class="g-mrow__title">{L(m.title)}</b>
      <span class="g-mrow__sub">{poi ? L(poi.name) : ''}{!easy && v ? ` · ${L(v.text).slice(0, 70)}${L(v.text).length > 70 ? '…' : ''}` : ''}</span>
      {showAccess && poi?.accessNote && L(poi.accessNote) && <span class="g-mrow__acc"><Icon name="wheelchair" size={13} /> {L(poi.accessNote)}</span>}
      <span class="g-mrow__tags">
        {st.done ? <Tag tone="green" icon="circleCheck">{t('g.m.doneAt', { pts: d.points })}{!d.synced ? ` · ${t('g.m.pending')}` : ''}</Tag>
          : st.here ? <Tag tone="live" icon="target">{t('g.ms.here')}</Tag>
          : <Tag icon="navigation">{t('g.ms.away', { d: fmtDistance(st.distanceM) })}</Tag>}
        {!easy && <Tag>{t('g.kind.' + m.kind)}</Tag>}
        {showAccess && (m.accessible ? <Tag tone="info" icon="wheelchair">{t('g.ms.accessible')}</Tag> : null)}
        {extra}
      </span>
    </span>
    <span class="g-mrow__pts">{m.points}<small>{t('c.points')}</small></span>
  </button></li>);
}

export function Section({ title, icon, children, action, class: cls, id }) {
  return (<section class={clsx('g-sec', cls)} aria-labelledby={id}>
    {title && <div class="g-sec__head"><h2 id={id}>{icon && <Icon name={icon} size={18} />}{title}</h2>{action}</div>}
    {children}</section>);
}
