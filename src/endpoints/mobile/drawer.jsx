// Panel boczny (navigation drawer): język, dostępność, konto, bilety, kupony, quizy, audioprzewodnik, filmy, media społecznościowe, ustawienia.
import { useEffect, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { strings, languages } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx } from '../../kernel/util.js';
import { A11yBar, Icon, IconButton, Logo, PatternBand, PjmCall } from '../../ui/components.jsx';
import { useApp, APP_VERSION } from './ctx.js';

strings({
  'm.d.account': ['Konto i logowanie', 'Account & sign-in'], 'm.d.signedAs': ['Zalogowano: {name}', 'Signed in: {name}'], 'm.d.guest': ['Logowanie wymagane tylko przy rezerwacjach', 'Sign-in is only needed for bookings'],
  'm.d.tickets': ['Moje bilety', 'My tickets'], 'm.d.booking': ['Wydarzenia i rezerwacje', 'Events & bookings'], 'm.d.coupons': ['Kupony', 'Coupons'], 'm.d.quizzes': ['Quizy', 'Quizzes'],
  'm.d.audio': ['Audioprzewodnik', 'Audio guide'], 'm.d.scan': ['Skanuj QR / BLE / AR', 'Scan QR / BLE / AR'], 'm.d.videos': ['Filmy i transmisje', 'Videos & live'], 'm.d.social': ['Media społecznościowe', 'Social media'],
  'm.d.info': ['Informacje praktyczne', 'Visitor information'], 'm.d.about': ['O aplikacji', 'About the app'], 'm.d.a11y': ['Dostępność', 'Accessibility'], 'm.d.lang': ['Język', 'Language'],
  'm.d.memories': ['Schowek wspomnień', 'Memories'], 'm.d.notif': ['Powiadomienia', 'Notifications'], 'm.d.search': ['Wyszukiwarka', 'Search'], 'm.d.tutorial': ['Samouczek', 'Tutorial'],
  'm.d.sec.visit': ['Zwiedzanie', 'Visiting'], 'm.d.sec.offer': ['Oferta', 'Offer'], 'm.d.sec.app': ['Aplikacja', 'App'], 'm.d.testSub': ['Pozycja, sieć, kod QR', 'Position, network, QR code'],
});

export function Drawer({ open, onClose }) {
  const app = useApp(); const { t, user, client, set } = useClient(); const [pjm, setPjm] = useState(false); const langs = languages();
  const unread = sel.pushFor('mobile').filter((p) => !client.pushReadAt || p.at > client.pushReadAt).length;
  const go = (name, props) => { onClose(); app.push(name, props); };
  useEffect(() => { if (!open) return; const k = (e) => { if (e.key === 'Escape' && !pjm) onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [open, pjm]);
  const Item = ({ icon, label, onClick, badge, sub }) => <li><button type="button" class="m-drawer__item" onClick={onClick}><Icon name={icon} size={20} /><span><b>{label}</b>{sub && <small>{sub}</small>}</span>{badge ? <em class="m-badge">{badge}</em> : null}</button></li>;
  return (<div class={clsx('m-drawer', open && 'is-open')} aria-hidden={!open} inert={!open ? true : undefined}>
    <div class="m-drawer__scrim" onClick={onClose} />
    <aside class="m-drawer__panel" role="dialog" aria-modal="true" aria-label={t('m.menu')}>
      <PatternBand class="m-drawer__head" scale={0.5}>
        <div class="m-drawer__headin"><Logo /><IconButton icon="close" variant="round" label={t('c.close')} onClick={onClose} /></div>
      </PatternBand>
      <div class="m-drawer__scroll">
        <div class="m-drawer__lang" role="group" aria-label={t('m.d.lang')}><Icon name="languages" size={18} />{langs.map((l) => <button key={l.code} type="button" class={clsx(client.lang === l.code && 'is-active')} aria-pressed={client.lang === l.code} onClick={() => set({ lang: l.code })}>{l.code.toUpperCase()}</button>)}</div>
        <div class="m-drawer__a11y"><A11yBar horizontal show={['contrast', 'bigger', 'smaller', 'lector', 'night', 'pjm']} onPjm={() => setPjm(true)} /></div>
        <ul class="m-drawer__list">
          <Item icon="user" label={t('m.d.account')} sub={user ? t('m.d.signedAs', { name: user.name }) : t('m.d.guest')} onClick={() => { onClose(); app.openReservation({ view: 'account' }); }} />
          <Item icon="ticket" label={t('m.d.tickets')} onClick={() => { onClose(); app.openReservation({ view: 'tickets' }); }} />
          <Item icon="calendar" label={t('m.d.booking')} onClick={() => { onClose(); app.openReservation({ view: 'home' }); }} />
        </ul>
        <h3 class="m-drawer__sec">{t('m.d.sec.visit')}</h3>
        <ul class="m-drawer__list">
          <Item icon="headphones" label={t('m.d.audio')} onClick={() => go('audio')} />
          <Item icon="scan" label={t('m.d.scan')} onClick={() => go('scan', { mode: 'qr' })} />
          <Item icon="coupon" label={t('m.d.coupons')} onClick={() => go('coupons')} />
          <Item icon="quiz" label={t('m.d.quizzes')} onClick={() => go('quizzes')} />
          <Item icon="image" label={t('m.d.memories')} badge={(client.memories || []).length || null} onClick={() => go('memories')} />
        </ul>
        <h3 class="m-drawer__sec">{t('m.d.sec.offer')}</h3>
        <ul class="m-drawer__list">
          <Item icon="video" label={t('m.d.videos')} badge={getState().live.onAir ? '●' : null} onClick={() => go('videos')} />
          <Item icon="share" label={t('m.d.social')} onClick={() => go('social')} />
          <Item icon="info" label={t('m.d.info')} onClick={() => go('info')} />
        </ul>
        <h3 class="m-drawer__sec">{t('m.d.sec.app')}</h3>
        <ul class="m-drawer__list">
          <Item icon="bell" label={t('m.d.notif')} badge={unread || null} onClick={() => go('notifications')} />
          <Item icon="search" label={t('m.d.search')} onClick={() => go('search')} />
          <Item icon="accessibility" label={t('m.d.a11y')} onClick={() => go('a11y')} />
          <Item icon="settings" label={t('m.settings')} onClick={() => go('settings')} />
          <Item icon="help" label={t('m.d.tutorial')} onClick={app.showTutorial} />
          <Item icon="flag" label={t('tm.title')} sub={app.standalone ? t('m.d.testSub') : null} onClick={app.openTestMode} />
          <Item icon="smartphone" label={t('m.d.about')} sub={APP_VERSION} onClick={() => go('about')} />
        </ul>
      </div>
    </aside>
    <PjmCall open={pjm} onClose={() => setPjm(false)} where="Aplikacja mobilna" />
  </div>);
}
