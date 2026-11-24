// Gra terenowa – prezentacja tras, zasady, ranking na żywo, nagrody, statystyki, zachęta do pobrania aplikacji.
import { useClient } from '../../kernel/client.jsx';
import { useStore } from '../../kernel/store.js';
import { sel } from '../../kernel/api.js';
import { Icon, Button, Card, CardBody, Tag, Media, QR, Stat, BarChart, Empty, PatternBand } from '../../ui/components.jsx';
import { useNav } from './nav.js';
import { PageHead, Section } from './bits.jsx';

const KIND_ICON = { qr: 'qr', ble: 'bluetooth', ar: 'ar', gps: 'locate', quiz: 'quiz', panorama: 'panorama', idea: 'sparkles' };

export function GamePage() {
  const s = useStore(); const { t, L } = useClient(); const { go } = useNav();
  const lb = sel.leaderboard().slice(0, 10); const me = sel.leaderboard().find((x) => x.me);
  const st = s.gameStats;
  return (<>
    <PageHead icon="game" title={t('w.nav.game')} lead={t('w.g.lead')} crumbs={[{ label: t('w.nav.game') }]} />
    <Section id="w-groutes" title={t('w.g.routes')} kicker={t('w.g.routesK')}>
      <ul class="w-grid w-grid--2">{s.gameRoutes.map((r) => { const ms = r.missions.filter((m) => m.active !== false); const kinds = [...new Set(ms.map((m) => m.kind))]; return (
        <li key={r.id}><Card as="article" class="w-groute">
          <Media ill={r.ill} src={r.src} ratio="21/9" shape="arc-tr" alt="" />
          <CardBody>
            <span class="w-kicker">{L(r.tagline)}</span>
            <h3 class="w-h3">{L(r.name)}</h3>
            <p class="w-small">{L(r.description)}</p>
            <div class="w-row"><Tag tone="deep" icon="flag">{t('w.g.missions', { n: ms.length })}</Tag>{ms.some((m) => m.accessible) && <Tag tone="green" icon="wheelchair">{t('w.g.accVariant')}</Tag>}
              <span class="w-gkinds" aria-label={t('w.g.tech')}>{kinds.map((k) => <Icon key={k} name={KIND_ICON[k] || 'pin'} size={16} title={t('w.mk.' + k)} />)}</span></div>
            {(r.lengths || []).length > 0 && <div><h4 class="w-h5">{t('w.g.lengths')}</h4><ul class="w-glist">{r.lengths.map((l) => <li key={l.id}><b>{L(l.name)}</b> · {l.km} km · {Math.round(l.durationMin / 6) / 10} h · {t('w.g.missions', { n: l.missionIds.length })}</li>)}</ul></div>}
            {(r.modes || []).length > 0 && <div><h4 class="w-h5">{t('w.g.modes')}</h4><div class="w-row">{r.modes.map((m) => <Tag key={m.id} icon={{ walk: 'walk', bike: 'bike', access: 'wheelchair' }[m.id]}>{L(m.name)}</Tag>)}</div></div>}
            {(r.variants || []).length > 0 && <div><h4 class="w-h5">{t('w.g.variants')}</h4><ul class="w-glist">{r.variants.map((v) => <li key={v.id}><b>{L(v.name)}</b>{v.description ? ` – ${L(v.description)}` : ''}</li>)}</ul></div>}
            <p class="w-small"><Icon name="trophy" size={14} /> {t('w.g.played', { n: st.byRoute?.[r.id] ?? 0 })}</p>
          </CardBody>
        </Card></li>); })}</ul>
    </Section>

    <Section id="w-ghow" tone="mint" title={t('w.g.how')}>
      <ol class="w-steps">
        {[['qr', 'w.g.s1', 'w.g.s1t'], ['bluetooth', 'w.g.s2', 'w.g.s2t'], ['ar', 'w.g.s3', 'w.g.s3t'], ['trophy', 'w.g.s4', 'w.g.s4t']].map(([ic, h, d], i) => <li key={h}><span class="w-steps__n">{i + 1}</span><Icon name={ic} size={28} /><h3>{t(h)}</h3><p class="w-small">{t(d)}</p></li>)}
      </ol>
      <div class="w-grid w-grid--2 w-mt">
        <Card><CardBody><h3 class="w-h4"><Icon name="sliders" size={18} /> {t('w.g.levels')}</h3><ul class="w-glist"><li><b>{t('w.g.easy')}</b> – {t('w.g.easyT')}</li><li><b>{t('w.g.medium')}</b> – {t('w.g.mediumT')}</li><li><b>{t('w.g.hard')}</b> – {t('w.g.hardT')}</li></ul></CardBody></Card>
        <Card><CardBody><h3 class="w-h4"><Icon name="people" size={18} /> {t('w.g.ages')}</h3><ul class="w-glist"><li><b>{t('w.g.kids')}</b> – {t('w.g.kidsT')}</li><li><b>{t('w.g.teens')}</b> – {t('w.g.teensT')}</li><li><b>{t('w.g.adults')}</b> – {t('w.g.adultsT')}</li><li><b>{t('w.g.seniors')}</b> – {t('w.g.seniorsT')}</li></ul></CardBody></Card>
      </div>
    </Section>

    <Section id="w-gboard">
      <div class="w-split">
        <div>
          <div class="w-sec__head"><div><span class="w-kicker"><Tag tone="live">{t('c.live')}</Tag></span><h2>{t('w.g.board')}</h2></div></div>
          <ol class="w-board" aria-live="polite">{lb.map((x) => <li key={x.nick + x.rank} class={x.me ? 'is-me' : ''}><span class="w-board__r">{x.rank}</span><span class="w-board__n">{x.nick}{x.me && <Tag tone="green">{t('w.g.you')}</Tag>}</span><b>{x.points} {t('c.points')}</b></li>)}</ol>
          {me && me.rank > 10 && <p class="w-small">{t('w.g.yourRank', { r: me.rank, p: me.points })}</p>}
          <p class="w-small">{t('w.g.boardNote')}</p>
        </div>
        <div>
          <div class="w-sec__head"><h2>{t('w.g.stats')}</h2></div>
          <div class="w-stats"><Stat icon="flag" label={t('w.g.stDone')} value={st.missionsDone} /><Stat icon="people" label={t('w.g.stPlayers')} value={st.playersSynced} /><Stat icon="route" label={t('w.g.stRoutes')} value={s.gameRoutes.length} /></div>
          <div class="w-chart"><BarChart data={s.gameRoutes.map((r) => ({ label: t('w.gr.' + r.id) === 'w.gr.' + r.id ? L(r.name) : t('w.gr.' + r.id), value: st.byRoute?.[r.id] || 0 }))} height={110} /></div>
          <p class="w-sr">{s.gameRoutes.map((r) => `${L(r.name)}: ${st.byRoute?.[r.id] || 0}`).join('; ')}</p>
        </div>
      </div>
    </Section>

    <Section id="w-grew" tone="mint" title={t('w.g.rewards')} kicker={t('w.g.rewardsK')}>
      {s.rewards.length ? <ul class="w-grid w-grid--4">{s.rewards.filter((r) => r.active !== false).map((r) => <li key={r.id}><Card as="article" class="w-reward">
        <Media ill={r.ill} src={r.src} ratio="4/3" shape="plain" alt="" />
        <CardBody><h3 class="w-h4">{L(r.name)}</h3><p class="w-small">{L(r.description)}</p>
          <div class="w-row w-row--between"><Tag tone="deep" icon="award">{r.cost} {t('c.points')}</Tag>{r.stock > 5 ? <Tag tone="green">{t('w.g.stock', { n: r.stock })}</Tag> : r.stock > 0 ? <Tag tone="warn">{t('w.g.stockLow', { n: r.stock })}</Tag> : <Tag tone="danger">{t('w.g.stockNone')}</Tag>}</div>
          {r.pickup && <p class="w-small"><Icon name="mapPin" size={13} /> {L(r.pickup)}</p>}
        </CardBody></Card></li>)}</ul> : <Empty icon="gift" title={t('c.empty')} />}
    </Section>

    <section class="w-appband" aria-labelledby="w-gapp-h">
      <PatternBand class="w-appband__bg" />
      <div class="w-wrap"><Card class="w-appband__card"><CardBody>
        <div class="w-appcta__row">
          <div><h2 id="w-gapp-h">{t('w.g.cta')}</h2><p>{t('w.g.ctaT')}</p><div class="w-row"><Tag icon="smartphone">Android</Tag><Tag icon="smartphone">iOS</Tag><Tag icon="wifiOff">{t('w.g.offline')}</Tag></div></div>
          <span class="w-qrbox"><QR value="https://app.fpz.example/pobierz?gra" size={128} /><span class="w-small">{t('w.app.scan')}</span></span>
        </div>
      </CardBody></Card></div>
    </section>
  </>);
}
