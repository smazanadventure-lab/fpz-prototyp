// Ekran startowy, wybór języka i samouczek (pierwsze uruchomienie).
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { strings, languages } from '../../kernel/i18n.js';
import { clsx } from '../../kernel/util.js';
import { Button, Icon, Logo, Media, PatternBand, Spinner } from '../../ui/components.jsx';
import { APP_VERSION } from './ctx.js';

strings({
  'm.splash.tag': ['Wirtualny przewodnik', 'Virtual guide'], 'm.version': ['Wersja {v}', 'Version {v}'],
  'm.lang.title': ['Wybierz język', 'Choose your language'], 'm.lang.lead': ['Język możesz zmienić w każdej chwili w menu.', 'You can change the language any time in the menu.'],
  'm.tut.skip': ['Pomiń', 'Skip'], 'm.tut.start': ['Zaczynamy', 'Let’s start'], 'm.tut.step': ['Plansza {n} z {of}', 'Screen {n} of {of}'],
  'm.tut.1.t': ['Twój przewodnik po Fabryce', 'Your guide to the Factory'], 'm.tut.1.d': ['Historia, ludzie i miejsca Fabryki Pełnej Życia oraz Dąbrowy Górniczej – w tekstach, zdjęciach, filmach, modelach 3D i audioprzewodniku.', 'History, people and places of the Factory and Dąbrowa Górnicza – in texts, photos, films, 3D models and an audio guide.'],
  'm.tut.2.t': ['Skanuj, zbliż się, odkrywaj', 'Scan, get close, discover'], 'm.tut.2.d': ['Zeskanuj kod QR na tablicy, podejdź do nadajnika BLE albo skieruj aparat na wzorzec AR – aplikacja pokaże treści o miejscu, w którym stoisz.', 'Scan a QR code on a sign, walk up to a BLE beacon or point the camera at an AR marker – the app shows content about where you stand.'],
  'm.tut.3.t': ['Zagraj w grę terenową', 'Play the field game'], 'm.tut.3.d': ['Cztery trasy: przyroda, przemysł, historia i przyszłość. Zdobywaj punkty, odbieraj nagrody i kupony.', 'Four trails: nature, industry, history and the future. Earn points, collect rewards and coupons.'],
  'm.tut.4.t': ['Bilety i wydarzenia', 'Tickets & events'], 'm.tut.4.d': ['Kupuj bilety na koncerty, warsztaty i wystawy. Kod QR biletu masz zawsze w telefonie – także offline.', 'Buy tickets for concerts, workshops and exhibitions. Your ticket QR code is always on your phone – even offline.'],
});

export function Splash() {
  const { t } = useClient();
  return (<div class="m-splash" role="status">
    <PatternBand class="m-splash__band" scale={0.8} />
    <div class="m-splash__body"><Logo class="m-splash__logo" /><p>{t('m.splash.tag')}</p><Spinner /><small>{t('m.version', { v: APP_VERSION })}</small></div>
  </div>);
}

export function LangPick({ onNext }) {
  const { client, set, t } = useClient(); const langs = languages();
  return (<div class="m-onb">
    <PatternBand class="m-onb__band" scale={0.6} />
    <div class="m-onb__body"><Logo /><h1>{t('m.lang.title')}</h1><p>{t('m.lang.lead')}</p>
      <div class="m-langlist" role="radiogroup" aria-label={t('m.lang.title')}>{langs.map((l) => <button key={l.code} type="button" role="radio" aria-checked={client.lang === l.code} class={clsx('m-langbtn', client.lang === l.code && 'is-active')} onClick={() => set({ lang: l.code })}><span>{l.name}</span><b>{l.code.toUpperCase()}</b>{client.lang === l.code && <Icon name="check" size={18} />}</button>)}</div>
      <Button block size="lg" iconRight="arrowRight" onClick={onNext}>{t('c.next')}</Button></div>
  </div>);
}

const SLIDES = [{ ill: 'hall-exterior', icon: 'book' }, { ill: 'hall-interior', icon: 'scan', extra: ['qr', 'bluetooth', 'ar'] }, { ill: 'park', icon: 'game' }, { ill: 'stage', icon: 'ticket' }];
export function Tutorial({ onDone }) {
  const { t } = useClient(); const [i, setI] = useState(0); const s = SLIDES[i]; const last = i === SLIDES.length - 1;
  let x0 = null;
  return (<div class="m-tut" onPointerDown={(e) => { x0 = e.clientX; }} onPointerUp={(e) => { if (x0 == null) return; const d = e.clientX - x0; if (d < -50 && !last) setI(i + 1); if (d > 50 && i > 0) setI(i - 1); x0 = null; }}>
    <div class="m-tut__skip"><button type="button" class="m-link" onClick={onDone}>{t('m.tut.skip')}</button></div>
    <div class="m-tut__slide" key={i} aria-live="polite">
      <Media ill={s.ill} src={s.src} ratio="1/1" shape="arc-tr" class="m-tut__img" alt=""><span class="m-tut__badge"><Icon name={s.icon} size={30} /></span></Media>
      {s.extra && <div class="m-tut__chips">{s.extra.map((x) => <span key={x}><Icon name={x} size={18} />{x.toUpperCase().replace('BLUETOOTH', 'BLE')}</span>)}</div>}
      <h1>{t(`m.tut.${i + 1}.t`)}</h1><p>{t(`m.tut.${i + 1}.d`)}</p>
    </div>
    <div class="m-tut__foot">
      <div class="m-dots" aria-label={t('m.tut.step', { n: i + 1, of: SLIDES.length })}>{SLIDES.map((_, k) => <button key={k} type="button" class={k === i ? 'is-active' : ''} aria-label={String(k + 1)} onClick={() => setI(k)} />)}</div>
      <Button size="lg" iconRight={last ? 'check' : 'arrowRight'} onClick={() => (last ? onDone() : setI(i + 1))}>{last ? t('m.tut.start') : t('c.next')}</Button>
    </div>
  </div>);
}
