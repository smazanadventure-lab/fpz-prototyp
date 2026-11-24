// Wspólne elementy ekranów aplikacji mobilnej: ekran z nagłówkiem (iOS / Android), okruszki, szkielety, karty.
import { useRef } from 'preact/hooks';
import { useClient, useEnv } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx, fmtDistance } from '../../kernel/util.js';
import { Icon, IconButton, Logo, Media, Tag } from '../../ui/components.jsx';
import { useApp, entryAvailable } from './ctx.js';

strings({
  'm.menu': ['Otwórz menu', 'Open menu'], 'm.search': ['Szukaj', 'Search'], 'm.notifications': ['Powiadomienia', 'Notifications'],
  'm.net.offline': ['Tryb offline – dostępne są treści z pobranego pakietu, mapa i gra', 'Offline – downloaded content, the map and the game are available'],
  'm.net.slow': ['Słabe łącze – oszczędzanie danych (mniejsze obrazy)', 'Weak connection – data saver (smaller images)'],
  'm.needsNet': ['Wymaga połączenia', 'Needs connection'],
  'm.needsNet.text': ['Ta treść nie należy do pakietu offline. Połącz się z internetem albo pobierz pakiet w ustawieniach.', 'This content is not in the offline pack. Go online or download the pack in Settings.'],
});

/** Pasek stanu sieci (offline / słabe łącze) pod nagłówkiem. */
export function NetStrip() {
  const { env } = useEnv(); const { t } = useClient();
  if (env.network === 'online') return null;
  return <div class={clsx('m-net', env.network === 'offline' ? 'm-net--off' : 'm-net--slow')} role="status"><Icon name={env.network === 'offline' ? 'wifiOff' : 'signal'} size={14} /><span>{t(env.network === 'offline' ? 'm.net.offline' : 'm.net.slow')}</span></div>;
}

/** Nagłówek: iOS – okrągły przycisk (menu/wstecz) + logotyp lub okruszki; Android – górny pasek aplikacji (Material). */
export function TopBar({ root, title, crumbs, actions, below, hideTitle }) {
  const app = useApp(); const { t } = useClient(); const android = app.platform === 'android';
  const lead = root
    ? <IconButton icon="menu" variant={android ? 'plain' : 'round'} label={t('m.menu')} class="m-top__lead" onClick={app.openDrawer} />
    : <IconButton icon="back" variant={android ? 'plain' : 'round'} label={t('c.back')} class="m-top__lead" onClick={app.pop} />;
  if (android) return (<header class="m-top m-top--android">
    <div class="m-appbar">{lead}<h1 class="m-appbar__title">{title || (root ? t('m.appName') : '')}</h1><div class="m-top__actions">{actions}</div></div>
    <NetStrip />{below && <div class="m-top__below">{below}</div>}</header>);
  return (<header class="m-top">
    <div class="m-top__row">{lead}
      {root ? <><span class="m-top__spacer" /><div class="m-top__actions">{actions}</div><Logo class="m-top__logo" /></>
        : <><nav class="m-crumbs" aria-label={t('m.crumbs')}>{(crumbs || []).filter((c, i, a) => i === 0 || c !== a[i - 1]).map((c, i) => <span key={i}>{i > 0 && <i aria-hidden="true"> / </i>}{c}</span>)}</nav>{!title || hideTitle ? <div class="m-top__actions">{actions}</div> : null}</>}
    </div>
    {title && !hideTitle && <div class="m-top__titlerow"><h1 class="m-top__title">{title}</h1><div class="m-top__actions">{!root && actions}</div></div>}
    <NetStrip />{below && <div class="m-top__below">{below}</div>}</header>);
}
strings({ 'm.crumbs': ['Ścieżka nawigacji', 'Breadcrumbs'], 'm.appName': ['Fabryka Pełna Życia', 'Factory Full of Life'] });

/**
 * Ekran: nagłówek + przewijana treść (dolna nawigacja chowa się przy przewijaniu w głąb). embed – kontener pełnej wysokości dla osadzonych modułów.
 */
export function Screen({ root, title, crumbs, actions, below, children, embed, class: cls, hideTitle, flush }) {
  const app = useApp(); const last = useRef(0);
  const onScroll = (e) => { const y = e.currentTarget.scrollTop; const d = y - last.current; last.current = y; if (Math.abs(d) > 4) app.onScroll(d > 0 && y > 80 ? 'down' : 'up'); };
  return (<div class={clsx('m-screen-in', cls)}>
    <TopBar root={root} title={title} crumbs={crumbs} actions={actions} below={below} hideTitle={hideTitle} />
    {embed ? <div class="m-embed">{children}</div> : <div class={clsx('m-scroll', flush && 'm-scroll--flush')} onScroll={onScroll}>{children}</div>}
  </div>);
}

export const Skeleton = ({ lines = 4, media = true }) => (<div class="m-skel" aria-busy="true" aria-label="…">{media && <div class="m-skel__media" />}{Array.from({ length: lines }, (_, i) => <div key={i} class="m-skel__line" style={{ width: `${92 - (i % 3) * 17}%` }} />)}</div>);

export function SectionHead({ title, action, onAction }) {
  return <div class="m-sec"><h2 class="m-sec__title">{title}</h2>{action && <button type="button" class="m-sec__more" onClick={onAction}>{action}</button>}</div>;
}

/** Wpis jako karta (siatka) albo wiersz (lista). */
export function EntryCard({ entry, layout = 'grid', onClick }) {
  const { L, t, client } = useClient(); const ok = entryAvailable(entry.id, client); const img = (entry.media || []).find((m) => m.ill) || {}; const small = getState().env.network === 'slow';
  const tone = entry.year && entry.year < 1990 ? 'archival' : 'duotone';
  if (layout === 'list') return (<button type="button" class={clsx('m-erow', !ok && 'is-off')} onClick={onClick}>
    <Media ill={img.ill} src={img.src} tone={tone} ratio="1/1" shape="card" class={clsx('m-erow__img', small && 'is-small')} alt="" />
    <span class="m-erow__txt"><b>{L(entry.title)}</b><span>{L(entry.lead)}</span>{!ok && <Tag tone="warn" icon="wifiOff">{t('m.needsNet')}</Tag>}</span></button>);
  return (<button type="button" class={clsx('m-ecard', !ok && 'is-off')} onClick={onClick}>
    <Media ill={img.ill} src={img.src} tone={tone} ratio={small ? '2/1' : '4/3'} shape="arc-tr" class="m-ecard__img" alt="" />
    <span class="m-ecard__txt">{entry.year && <small>{entry.year}</small>}<b>{L(entry.title)}</b>{!ok && <Tag tone="warn" icon="wifiOff">{t('m.needsNet')}</Tag>}</span></button>);
}

/** Wiersz miejsca: ikona rodzaju, nazwa, odległość, dostępność. */
export function PoiRow({ poi, onClick, extra }) {
  const { L, t } = useClient(); const fav = getState().player.favorites.includes(poi.id);
  return (<button type="button" class="m-prow" onClick={onClick}>
    <Media ill={poi.ill} src={poi.src} ratio="1/1" shape="circle" class="m-prow__img" alt="" />
    <span class="m-prow__txt"><b>{L(poi.name)}{fav && <Icon name="heart" size={13} class="m-fav-ico" />}</b><span>{L(poi.short)}</span>
      <span class="m-prow__meta"><Icon name="navigation" size={12} />{fmtDistance(sel.distanceTo(poi))}{poi.accessible && <><Icon name="wheelchair" size={12} /><span class="m-sr">{t('c.accessible')}</span></>}</span></span>
    {extra}</button>);
}

export function NeedsNet() {
  const { t } = useClient(); const app = useApp();
  return <div class="m-needsnet"><Icon name="wifiOff" size={34} /><b>{t('m.needsNet')}</b><p>{t('m.needsNet.text')}</p><button type="button" class="fpz-btn fpz-btn--secondary" onClick={() => app.push('settings', { focus: 'offline' })}>{t('m.settings')}</button></div>;
}
strings({ 'm.settings': ['Ustawienia', 'Settings'] });
