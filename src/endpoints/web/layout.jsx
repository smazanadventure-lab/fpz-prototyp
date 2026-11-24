// Nagłówek (nawigacja, wyszukiwarka, dostępność, język, konto, koszyk), stopka, baner zgód, zachęta PWA, pasek offline.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { useStore, getState } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { languages } from '../../kernel/i18n.js';
import { matches, clsx, fmtDay } from '../../kernel/util.js';
import { Icon, Button, IconButton, Logo, A11yBar, PjmCall, Modal, Switch, Tag, PatternBand, Notice } from '../../ui/components.jsx';
import { useNav, SECTIONS, enc } from './nav.js';

/* ── wyszukiwanie globalne ── */
export function searchAll(q) {
  const s = getState(); const lang = s.clients.web?.lang || 'pl';
  if (!q || q.trim().length < 2) return null;
  const entries = sel.entries({ channel: 'web', q });
  const pois = sel.pois({ q }).concat(s.pois.filter((p) => p.active !== false && !matches(q, p.name.pl, p.name.en, (p.tags || []).join(' ')) && matches(q, p.short?.pl, p.short?.en)));
  const events = sel.events().filter((e) => matches(q, e.title.pl, e.title.en, e.description?.pl, e.description?.en));
  const venues = s.venues.filter((v) => v.active !== false && matches(q, v.name.pl, v.name.en, v.description?.pl, v.description?.en, (v.tags || []).join(' ')));
  return { entries, pois, events, venues, total: entries.length + pois.length + events.length + venues.length, lang };
}
export const SEARCH_GROUPS = [
  { id: 'entries', key: 'w.s.entries', icon: 'book', path: (x) => `historia/wpis/${enc(x.id)}`, title: (x) => x.title, sub: (x) => x.lead },
  { id: 'pois', key: 'w.s.pois', icon: 'mapPin', path: (x) => `mapa/miejsce/${enc(x.id)}`, title: (x) => x.name, sub: (x) => x.short },
  { id: 'events', key: 'w.s.events', icon: 'calendar', path: (x) => `wydarzenia/event/${enc(x.id)}`, title: (x) => x.title, sub: null },
  { id: 'venues', key: 'w.s.venues', icon: 'store', path: (x) => `wydarzenia/venue/${enc(x.id)}`, title: (x) => x.name, sub: (x) => x.description },
];

function SearchBox({ autoFocus, onDone }) {
  const { t, L, lang } = useClient(); const { go } = useNav(); const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const box = useRef(null); const inp = useRef(null);
  useEffect(() => { if (autoFocus) inp.current?.focus(); }, []);
  useEffect(() => { const h = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); }; document.addEventListener('pointerdown', h); return () => document.removeEventListener('pointerdown', h); }, []);
  const res = searchAll(q);
  const pick = (p) => { setOpen(false); setQ(''); go(p); onDone?.(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); inp.current?.focus(); }
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); box.current.querySelector('.w-sres button')?.focus(); }
  };
  const onListKey = (e) => {
    const items = [...box.current.querySelectorAll('.w-sres button')]; const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) inp.current?.focus(); else items[i - 1]?.focus(); }
    if (e.key === 'Escape') { setOpen(false); inp.current?.focus(); }
  };
  return (
    <div class="w-search" ref={box} role="search">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) pick(`szukaj/${enc(q.trim())}`); }}>
        <label class="w-sr" for="w-q">{t('w.search.label')}</label>
        <input id="w-q" ref={inp} class="fpz-input fpz-input--pill" type="search" value={q} placeholder={t('w.search.ph')} autoComplete="off"
          aria-expanded={open && !!res} aria-controls="w-sres" onInput={(e) => { setQ(e.currentTarget.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} />
        <button type="submit" class="w-search__go" aria-label={t('c.search')}><Icon name="search" size={17} /></button>
      </form>
      {open && res && (
        <div class="w-sres" id="w-sres" onKeyDown={onListKey}>
          <p class="w-sr" aria-live="polite">{t('w.search.count', { n: res.total })}</p>
          {res.total === 0 && <p class="w-sres__empty">{t('w.search.none', { q })}</p>}
          {SEARCH_GROUPS.filter((g) => res[g.id].length).map((g) => (
            <div key={g.id} class="w-sres__grp" role="group" aria-label={t(g.key)}>
              <h3 class="w-sres__h"><Icon name={g.icon} size={14} />{t(g.key)} <span>{res[g.id].length}</span></h3>
              <ul>{res[g.id].slice(0, 4).map((x) => <li key={x.id}><button type="button" onClick={() => pick(g.path(x))}><b>{L(g.title(x))}</b>{g.id === 'events' ? <span>{fmtDay(x.start, lang)}</span> : g.sub && <span>{L(g.sub(x))}</span>}</button></li>)}</ul>
            </div>))}
          {res.total > 0 && <button type="button" class="w-sres__all" onClick={() => pick(`szukaj/${enc(q.trim())}`)}>{t('w.search.all', { n: res.total })} <Icon name="arrowRight" size={15} /></button>}
        </div>)}
    </div>
  );
}

function LangSelect() {
  const { client, set, t } = useClient(); useStore(); const langs = languages();
  return (<label class="w-lang"><Icon name="globe" size={16} /><span class="w-sr">{t('c.language')}</span>
    <select value={client.lang} onChange={(e) => set({ lang: e.currentTarget.value })} aria-label={t('c.language')}>
      {langs.map((l) => <option key={l.code} value={l.code}>{l.code.toUpperCase()} · {l.name}</option>)}
    </select></label>);
}

function AccountCart({ showName = true }) {
  const { user, client, t } = useClient(); const { go } = useNav(); const n = sel.cart(client).count;
  return (<div class="w-acc">
    <button type="button" class="w-acc__user" onClick={() => go('wydarzenia/account')} aria-label={user ? `${t('w.account')}: ${user.name}` : t('w.login')}>
      <Icon name="user" size={18} />{showName && <span>{user ? user.name.split(' ')[0] : t('w.login')}</span>}
    </button>
    <IconButton icon="cart" variant="round" label={t('w.cart', { n })} badge={n || null} onClick={() => go('wydarzenia/cart')} />
  </div>);
}

export function Header() {
  const { t, client } = useClient(); const { r, go, compact, viewport } = useNav(); const [menu, setMenu] = useState(false); const [pjm, setPjm] = useState(false); const [sOpen, setSOpen] = useState(false);
  const skip = (e) => { e.preventDefault(); const m = e.currentTarget.closest('.w-scroll')?.querySelector('#w-main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } };
  const nav = (id) => { setMenu(false); go(id); };
  useEffect(() => { if (!menu) return; const k = (e) => { if (e.key === 'Escape') setMenu(false); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [menu]);
  const a11y = <A11yBar horizontal show={['contrast', 'bigger', 'smaller', 'lector', 'night', 'pjm']} onPjm={() => setPjm(true)} class="w-a11y" />;
  return (
    <header class="w-head">
      <a href="#w-main" class="w-skip" onClick={skip}>{t('w.skip')}</a>
      {!compact && <div class="w-top"><div class="w-wrap w-top__in">
        <SearchBox />
        <div class="w-top__tools">{a11y}<LangSelect /><AccountCart /></div>
      </div></div>}
      <div class="w-bar"><div class="w-wrap w-bar__in">
        {compact && <IconButton icon={menu ? 'close' : 'menu'} variant="round" label={t('w.menu')} aria-expanded={menu} aria-controls="w-drawer" onClick={() => setMenu(!menu)} />}
        <a href="#" class="w-bar__logo" onClick={(e) => { e.preventDefault(); nav(''); }} aria-label={t('w.homeLink')}><Logo /></a>
        {!compact && <nav class="w-nav" aria-label={t('w.nav.main')}><ul>
          {SECTIONS.map((s) => <li key={s.id}><a href="#" class={clsx(r.sec === s.id && 'is-active')} aria-current={r.sec === s.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); nav(s.id); }}>{t(s.key)}</a></li>)}
        </ul></nav>}
        {!compact && <Tag tone="warn" class="w-bar__test">{t('w.foot.test')}</Tag>}
        {compact && <div class="w-bar__right">
          <IconButton icon="search" variant="mint" label={t('c.search')} aria-expanded={sOpen} onClick={() => setSOpen(!sOpen)} />
          {viewport === 'tablet' && <LangSelect />}
          <AccountCart showName={viewport === 'tablet'} />
        </div>}
      </div>
      {compact && sOpen && <div class="w-wrap w-bar__search"><SearchBox autoFocus onDone={() => setSOpen(false)} /></div>}
      </div>
      {compact && menu && <>
        <div class="w-drawer__scrim" onClick={() => setMenu(false)} />
        <div class="w-drawer" id="w-drawer" role="dialog" aria-modal="true" aria-label={t('w.menu')}>
          <nav aria-label={t('w.nav.main')}><ul class="w-drawer__nav">
            {SECTIONS.map((s) => <li key={s.id}><a href="#" class={clsx(r.sec === s.id && 'is-active')} aria-current={r.sec === s.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); nav(s.id); }}><Icon name={s.icon} size={20} />{t(s.key)}</a></li>)}
          </ul></nav>
          <div class="w-drawer__group"><h2 class="w-kicker">{t('w.a11y')}</h2>{a11y}</div>
          <div class="w-drawer__group"><h2 class="w-kicker">{t('c.language')}</h2><LangSelect /></div>
        </div>
      </>}
      <PjmCall open={pjm} onClose={() => setPjm(false)} where="web" />
    </header>
  );
}

export function OfflineBar() {
  const { t, set } = useClient(); const [more, setMore] = useState(false);
  return (<div class="w-offline" role="status">
    <div class="w-wrap w-offline__in">
      <Icon name="wifiOff" size={18} /><div><b>{t('w.off.title')}</b> {t('w.off.text')}
        {more && <ul class="w-offline__list"><li>{t('w.off.l1')}</li><li>{t('w.off.l2')}</li><li>{t('w.off.l3')}</li><li>{t('w.off.l4')}</li><li class="is-no">{t('w.off.l5')}</li></ul>}</div>
      <button type="button" class="w-link" onClick={() => setMore(!more)} aria-expanded={more}>{more ? t('w.off.less') : t('w.off.more')}</button>
      <Button size="sm" variant="secondary" icon="wifi" onClick={() => set({ offlineSim: false })}>{t('w.off.back')}</Button>
    </div>
  </div>);
}

export function Footer() {
  const { t, L, client, set } = useClient(); const s = useStore(); const { go } = useNav(); const site = s.site;
  const links = [['historia', 'w.nav.history'], ['historia/galeria', 'w.h.gallery'], ['historia/filmy', 'w.h.videos'], ['wydarzenia', 'w.nav.events'], ['mapa/zaplanuj', 'w.plan.title'], ['gra', 'w.nav.game'], ['transmisje', 'w.nav.live'], ['informacje', 'w.nav.info'], ['informacje/dostepnosc', 'w.info.a11y'], ['informacje/prywatnosc', 'w.info.privacy']];
  return (
    <footer class="w-foot">
      <PatternBand class="w-foot__band" height="calc(var(--u) * 70)" />
      <div class="w-foot__main"><div class="w-wrap w-foot__grid">
        <div class="w-foot__brand"><Logo /><p>{L(site.tagline)}</p><Tag tone="warn">{t('w.foot.test')}</Tag></div>
        <nav aria-label={t('w.foot.links')}><h2 class="w-foot__h">{t('w.foot.links')}</h2><ul>{links.map(([p, k]) => <li key={p}><a href="#" onClick={(e) => { e.preventDefault(); go(p); }}>{t(k)}</a></li>)}</ul></nav>
        <div><h2 class="w-foot__h">{t('w.foot.contact')}</h2><ul class="w-contacts">
          <li><Icon name="mapPin" size={15} />{site.address}</li>
          <li><Icon name="phone" size={15} /><a href={`tel:${site.contact.phone.replace(/\s/g, '')}`}>{site.contact.phone}</a></li>
          <li><Icon name="mail" size={15} /><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></li>
          <li><Icon name="clock" size={15} />{L(site.hours)}</li></ul></div>
        <div><h2 class="w-foot__h">{t('w.foot.social')}</h2><ul class="w-social">{(site.social || []).map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer"><Icon name={{ youtube: 'video', instagram: 'camera', facebook: 'community', linkedin: 'building', tiktok: 'music' }[x.kind] || 'external'} size={16} />{x.label}<span class="w-sr"> ({t('w.newWin')})</span></a></li>)}</ul>
          <h2 class="w-foot__h">{t('w.foot.pwa')}</h2>
          <div class="w-foot__pwa">
            <Switch label={t('w.foot.offline')} checked={!!client.offlineSim} onChange={(e) => set({ offlineSim: e.currentTarget.checked })} />
            {client.pwaInstalled ? <Tag tone="green" icon="check">{t('w.pwa.installed')}</Tag> : <button type="button" class="w-link" onClick={() => set({ pwaAsk: true, pwaDismissed: false })}>{t('w.pwa.install')}</button>}
            <button type="button" class="w-link" onClick={() => set({ cookies: null })}>{t('w.ck.settings')}</button>
          </div></div>
      </div></div>
      <div class="w-foot__bottom"><div class="w-wrap"><span>© {new Date().getFullYear()} {L(site.name)}</span><span>{t('w.foot.sample')}</span></div></div>
    </footer>
  );
}

/* ── zgody cookies / RODO ── */
export function CookieBanner() {
  const { t, client, set, toast } = useClient(); const [cfg, setCfg] = useState(false); const [an, setAn] = useState(true); const [mk, setMk] = useState(false); const { go } = useNav();
  if (client.cookies) return null;
  const save = (a, m) => { set({ cookies: { necessary: true, analytics: a, marketing: m, at: new Date().toISOString() } }); setCfg(false); toast(t('w.ck.saved'), 'ok'); };
  return (<>
    <div class="w-cookie" role="region" aria-label={t('w.ck.title')}>
      <div class="w-cookie__txt"><h2>{t('w.ck.title')}</h2><p>{t('w.ck.text')} <a href="#" onClick={(e) => { e.preventDefault(); go('informacje/prywatnosc'); }}>{t('w.info.privacy')}</a>.</p></div>
      <div class="w-cookie__act">
        <Button size="sm" onClick={() => save(true, true)}>{t('w.ck.all')}</Button>
        <Button size="sm" variant="secondary" onClick={() => save(false, false)}>{t('w.ck.min')}</Button>
        <Button size="sm" variant="ghost" icon="settings" onClick={() => setCfg(true)}>{t('w.ck.custom')}</Button>
      </div>
    </div>
    <Modal open={cfg} onClose={() => setCfg(false)} title={t('w.ck.settings')} size="md" footer={<Button onClick={() => save(an, mk)}>{t('w.ck.save')}</Button>}>
      <div class="w-stack">
        <Switch label={t('w.ck.nec')} checked disabled />
        <p class="w-small">{t('w.ck.necD')}</p>
        <Switch label={t('w.ck.an')} checked={an} onChange={(e) => setAn(e.currentTarget.checked)} />
        <p class="w-small">{t('w.ck.anD')}</p>
        <Switch label={t('w.ck.mk')} checked={mk} onChange={(e) => setMk(e.currentTarget.checked)} />
        <p class="w-small">{t('w.ck.mkD')}</p>
      </div>
    </Modal>
  </>);
}

/* ── zachęta do instalacji PWA (symulacja) ── */
export function PwaPrompt() {
  const { t, client, set, toast } = useClient(); const [step, setStep] = useState(null); const [ready, setReady] = useState(false);
  useEffect(() => { const id = setTimeout(() => setReady(true), 9000); return () => clearTimeout(id); }, []);
  const visible = ready && client.cookies && !client.pwaInstalled && !client.pwaDismissed;
  useEffect(() => { if (client.pwaAsk) { setStep('confirm'); set({ pwaAsk: false }); } }, [client.pwaAsk]);
  const install = () => { set({ pwaInstalled: true, pwaDismissed: true }); setStep(null); toast(t('w.pwa.done'), 'ok'); };
  return (<>
    {visible && !step && <div class="w-pwa" role="complementary" aria-label={t('w.pwa.install')}>
      <span class="w-pwa__ic" aria-hidden="true"><Icon name="download" size={20} /></span>
      <div><b>{t('w.pwa.title')}</b><p>{t('w.pwa.text')}</p></div>
      <div class="w-pwa__act"><Button size="sm" onClick={() => setStep('confirm')}>{t('w.pwa.installBtn')}</Button>
        <IconButton icon="close" variant="plain" size="sm" label={t('w.pwa.later')} onClick={() => set({ pwaDismissed: true })} /></div>
    </div>}
    <Modal open={step === 'confirm'} onClose={() => setStep(null)} size="sm" title={t('w.pwa.install')} footer={<><Button variant="secondary" onClick={() => setStep(null)}>{t('c.cancel')}</Button><Button icon="download" onClick={install}>{t('w.pwa.installBtn')}</Button></>}>
      <div class="w-stack">
        <div class="w-pwa__app"><span class="w-pwa__appic"><Logo compact /></span><div><b>Fabryka Pełna Życia</b><span class="w-small">www.fpz.example</span></div></div>
        <p class="w-small">{t('w.pwa.desc')}</p>
        <Notice>{t('w.pwa.sim')}</Notice>
      </div>
    </Modal>
  </>);
}
