// Audioprzewodnik: lista wpisów z nagraniem lektora pogrupowana wg miejsc, odtwarzacz z kolejką i mini-odtwarzacz.
import { useEffect, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx, fmtDuration, fmtDistance } from '../../kernel/util.js';
import { estimateSeconds } from '../../ui/speech.js';
import { Button, Empty, Icon, IconButton, Media } from '../../ui/components.jsx';
import { useApp } from './ctx.js';
import { Screen } from './ui.jsx';

strings({
  'au.title': ['Audioprzewodnik', 'Audio guide'], 'au.lead': ['Posłuchaj opowieści lektora w miejscach, które odwiedzasz. Możesz odtworzyć całą trasę po kolei.', 'Listen to the narrator at the places you visit. You can play a whole route in order.'],
  'au.playAll': ['Odtwórz wszystko', 'Play all'], 'au.playPlace': ['Odtwórz miejsce', 'Play this place'], 'au.other': ['Pozostałe nagrania', 'Other recordings'], 'au.next': ['Następny punkt', 'Next stop'], 'au.prev': ['Poprzedni punkt', 'Previous stop'],
  'au.close': ['Zamknij odtwarzacz', 'Close player'], 'au.nowPlaying': ['Teraz odtwarzane', 'Now playing'], 'au.queue': ['{i} z {n}', '{i} of {n}'], 'au.sim': ['Lektor: synteza mowy urządzenia.', 'Narrator: device text-to-speech.'],
  'au.auto': ['Auto-start przy beaconie', 'Auto-start at beacons'],
});

export function AudioScreen() {
  const app = useApp(); const { t, L, client, set } = useClient(); const all = sel.entries({ channel: 'mobile' }).filter((e) => e.audioGuide);
  const groups = {}; for (const e of all) (groups[e.poiId || '_'] = groups[e.poiId || '_'] || []).push(e);
  const keys = Object.keys(groups).sort((a, b) => (a === '_' ? 1 : b === '_' ? -1 : sel.distanceTo(a) - sel.distanceTo(b)));
  const order = keys.flatMap((k) => groups[k].map((e) => e.id)); const cur = app.audio.ids[app.audio.i];
  return (<Screen title={t('au.title')} crumbs={[t('m.tab.home'), t('au.title')]}>
    <p class="m-muted">{t('au.lead')}</p>
    <div class="m-btnrow"><Button icon="play" disabled={!order.length} onClick={() => app.playAudio(order, 0)}>{t('au.playAll')}</Button>
      <label class="fpz-switch"><input type="checkbox" role="switch" checked={!!client.audioAuto} onChange={(e) => set({ audioAuto: e.currentTarget.checked })} /><span class="fpz-switch__track" /><span>{t('au.auto')}</span></label></div>
    {all.length === 0 ? <Empty icon="headphones" title={t('c.empty')} /> : keys.map((k) => { const p = k !== '_' && sel.poi(k); return (<section key={k} class="m-augroup">
      <div class="m-augroup__head">{p ? <Media ill={p.ill} src={p.src} ratio="1/1" shape="circle" class="m-augroup__img" alt="" /> : <span class="m-augroup__img m-augroup__img--ico"><Icon name="headphones" size={18} /></span>}
        <span><b>{p ? L(p.name) : t('au.other')}</b>{p && <small>{fmtDistance(sel.distanceTo(p))}</small>}</span>
        <IconButton icon="play" variant="mint" size="sm" label={t('au.playPlace')} onClick={() => app.playAudio(order, order.indexOf(groups[k][0].id))} /></div>
      <ul class="m-aulist">{groups[k].map((e) => <li key={e.id} class={clsx(cur === e.id && 'is-cur')}><button type="button" onClick={() => app.playAudio(order, order.indexOf(e.id))}><Icon name={cur === e.id && app.audio.playing ? 'volume' : 'play'} size={16} /><span>{L(e.title)}</span><small>{fmtDuration(estimateSeconds(L(e.audioGuide.text)))}</small></button>
        <IconButton icon="book" variant="plain" size="sm" label={L(e.title)} onClick={() => app.openEntry(e.id)} /></li>)}</ul>
    </section>); })}
  </Screen>);
}

/** Mini-odtwarzacz nad dolną nawigacją. */
export function MiniPlayer({ hidden }) {
  const app = useApp(); const { t, L } = useClient(); const a = app.audio; const [, tick] = useState(0);
  useEffect(() => { if (!a.playing) return; const i = setInterval(() => tick((n) => n + 1), 300); return () => clearInterval(i); }, [a.playing]);
  if (!a.open || !a.ids.length) return null; const e = sel.entry(a.ids[a.i]); if (!e) return null; const p = e.poiId && sel.poi(e.poiId);
  const prog = a.playing ? Math.min(1, (Date.now() - a.startedAt) / 1000 / a.dur) : 0;
  return (<div class={clsx('m-mini', hidden && 'is-low')} role="region" aria-label={t('au.nowPlaying')}>
    <div class="m-mini__bar" style={{ width: `${prog * 100}%` }} />
    <button type="button" class="m-mini__info" onClick={() => app.push('audio')}><Icon name="headphones" size={18} /><span><b>{L(e.title)}</b><small>{p ? L(p.name) + ' · ' : ''}{t('au.queue', { i: a.i + 1, n: a.ids.length })}</small></span></button>
    <IconButton icon={a.playing ? 'pause' : 'play'} variant="round" size="sm" label={a.playing ? t('c.pause') : t('c.play')} onClick={a.toggle} />
    <IconButton icon="skipForward" variant="plain" size="sm" label={t('au.next')} disabled={a.i + 1 >= a.ids.length} onClick={a.next} />
    <IconButton icon="close" variant="plain" size="sm" label={t('au.close')} onClick={a.close} />
  </div>);
}
