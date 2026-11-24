// Gra terenowa – sekcja aplikacji mobilnej (4 trasy, misje QR/BLE/AR/GPS/quiz/panorama/pomysł, punkty, nagrody, offline).
// <GameSection nav={{ openEntry, openPoi, showOnMap, openScanner, openCoupons }} /> – korzysta z useClient() aplikacji.
import { useEffect, useRef, useState } from 'preact/hooks';
import './strings.js';
import './game.css';
import { sel } from '../../kernel/api.js';
import { clsx } from '../../kernel/util.js';
import { Icon, IconButton, Button, Card, Tag, Progress, Notice, Media, QR, Modal, Empty, Field, Input, Switch } from '../../ui/components.jsx';
import { AGES, DIFFS, ROUTE_ICON } from './strings.js';
import { useGame, levelOf, badges, multOf, Section } from './parts.jsx';
import { RouteScreen, NatureCatalog } from './route.jsx';
import { MissionScreen } from './mission.jsx';

export default function GameSection({ nav }) {
  const g = useGame(); const { t, L, p, client, easy, s } = g;
  const [stack, setStack] = useState([{ v: 'home' }]);
  const scrollRef = useRef(null);
  const cur = stack[stack.length - 1];
  const go = (v, extra = {}) => setStack((st) => [...st, { v, ...extra }]);
  const back = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  const replace = (v, extra = {}) => setStack((st) => [...st.slice(0, -1), { v, ...extra }]);
  const home = () => setStack([{ v: 'home' }]);
  useEffect(() => { scrollRef.current?.scrollTo?.(0, 0); }, [stack.length, cur.v, cur.id, !!client.gameOnboarded]);

  // automatyczna synchronizacja po powrocie sieci (wykonuje ją jądro przy zmianie env) – potwierdzenie dla gracza
  const prev = useRef({ pending: p.pending.length, net: g.env.network });
  const [syncMsg, setSyncMsg] = useState(null);
  useEffect(() => {
    const was = prev.current; const net = g.env.network;
    if (was.net === 'offline' && net !== 'offline' && was.pending > 0 && p.pending.length === 0) { setSyncMsg(was.pending); g.toast(t('g.sync.auto', { n: was.pending }), 'ok', 4500); }
    if (net === 'offline') setSyncMsg(null);
    prev.current = { pending: p.pending.length, net };
  });

  const ctx = { nav, go, back, replace, home, syncMsg, setSyncMsg };
  const onboarded = !!client.gameOnboarded;
  const crumbs = stack.map((x) => crumbLabel(x, t, L));

  let body;
  if (!onboarded) body = <Onboarding />;
  else if (cur.v === 'route') body = <RouteScreen key={cur.id} id={cur.id} ctx={ctx} />;
  else if (cur.v === 'mission') body = <MissionScreen key={cur.id} id={cur.id} ctx={ctx} />;
  else if (cur.v === 'catalog') body = <NatureCatalog ctx={ctx} />;
  else if (cur.v === 'settings') body = <Settings ctx={ctx} />;
  else if (cur.v === 'rules') body = <Rules />;
  else if (cur.v === 'rewards') body = <RewardsScreen ctx={ctx} />;
  else if (cur.v === 'ranking') body = <RankingScreen />;
  else body = <Home ctx={ctx} />;

  return (<div class={clsx('ep-game', easy && 'g-easy')} data-view={onboarded ? cur.v : 'onboarding'}>
    <header class="g-head">
      {onboarded && stack.length > 1 ? (<>
        <IconButton icon="back" label={t('c.back')} class="g-back" onClick={back} />
        <nav class="g-crumbs" aria-label="breadcrumbs"><ol>{crumbs.map((c, i) => (<li key={i}>{i < crumbs.length - 1
          ? <button type="button" onClick={() => setStack((st) => st.slice(0, i + 1))}>{c}</button> : <span aria-current="page">{c}</span>}</li>))}</ol></nav>
      </>) : (<>
        <span class="g-head__ico" aria-hidden="true"><Icon name="mapPin" size={22} /></span>
        <h1 class="g-head__title">{t('g.title')}</h1>
      </>)}
      {onboarded && <button type="button" class="g-pts" onClick={() => cur.v !== 'rewards' && go('rewards')} aria-label={`${t('g.home.points')}: ${sel.points()} ${t('c.points')}`}>
        <Icon name="star" size={16} /><b>{sel.points()}</b>{p.pending.length > 0 && <i class="g-pts__dot" title={t('g.sync.pending', { n: p.pending.length })} />}</button>}
      {onboarded && stack.length === 1 && <IconButton icon="settings" variant="plain" label={t('g.home.settings')} onClick={() => go('settings')} />}
    </header>
    <div class="g-scroll" ref={scrollRef}><div class="g-view" key={stack.length + cur.v + (cur.id || '')}>{body}</div></div>
  </div>);
}

function crumbLabel(x, t, L) {
  if (x.v === 'home') return t('g.title');
  if (x.v === 'route') return L(sel.route(x.id)?.name) || '—';
  if (x.v === 'mission') return L(sel.mission(x.id)?.title) || t('g.crumb.mission');
  return t('g.crumb.' + x.v);
}

/* ── Profil gracza ── */
function ProfileForm({ submitLabel, onDone }) {
  const { t, api, p, toast, lang } = useGame();
  const [f, setF] = useState({ nick: p.nick, age: p.profile.age, difficulty: p.profile.difficulty, mode: p.profile.mode });
  const seg = (key, opts, label, fmt) => (<fieldset class="g-seg"><legend>{label}</legend><div class="g-seg__opts">{opts.map((o) => (
    <button key={o} type="button" class={clsx('g-seg__opt', f[key] === o && 'is-on')} aria-pressed={f[key] === o} onClick={() => setF({ ...f, [key]: o })}>{fmt(o)}</button>))}</div></fieldset>);
  const submit = (e) => { e.preventDefault(); const r = api.game.setProfile(f); if (r.ok) { toast(t('g.profile.saved')); onDone?.(); } };
  return (<form class="g-form" onSubmit={submit}>
    <Field label={t('g.profile.nick')} hint={t('g.profile.nickHint')}><Input value={f.nick} maxLength={24} required onInput={(e) => setF({ ...f, nick: e.currentTarget.value })} /></Field>
    {seg('age', AGES, t('g.profile.age'), (o) => t('g.age.' + o))}
    {seg('difficulty', DIFFS, t('g.profile.difficulty'), (o) => (<><b>{t('g.diff.' + o)}</b><small>{t('g.diff.mult', { m: String(multOf(o)).replace('.', lang === 'pl' ? ',' : '.') })}</small></>))}
    {seg('mode', ['standard', 'simple'], t('g.profile.mode'), (o) => t('g.mode.' + o))}
    <p class="g-muted g-small">{t('g.mode.simpleNote')}</p>
    <Button type="submit" size="lg" block icon="check">{submitLabel}</Button>
  </form>);
}

function Onboarding() {
  const { t, set } = useGame();
  return (<div class="g-pad g-stack">
    <Media ill="kids" shape="arc-tr" ratio="16/9" alt="" />
    <h2 class="g-h1">{t('g.welcome.title')}</h2>
    <p class="g-lead">{t('g.welcome.lead')}</p>
    <Notice tone="ok" icon="shield">{t('g.welcome.noAccount')}</Notice>
    <ProfileForm submitLabel={t('g.profile.start')} onDone={() => set({ gameOnboarded: true })} />
  </div>);
}

/* ── Ekran główny gry ── */
function Home({ ctx }) {
  const g = useGame(); const { t, L, s, p, easy } = g;
  const earned = sel.pointsEarned(); const lv = levelOf(earned);
  const bs = badges(s); const lb = sel.leaderboard(); const me = lb.find((x) => x.me);
  return (<div class="g-stack g-pad">
    <Card variant="deep" class="g-score">
      <div class="g-score__row">
        <div><span class="g-label g-label--on-dark">{t('g.home.points')}</span><b class="g-score__pts">{sel.points()} <small>{t('c.points')}</small></b></div>
        <div class="g-score__lvl"><Icon name="award" size={26} /><span><small>{t('g.home.level')} {lv.index + 1}</small><b>{t('g.lvl.' + lv.index)}</b></span></div>
      </div>
      <Progress value={lv.next ? earned - lv.from : 1} max={lv.next ? lv.next - lv.from : 1} label={t('g.home.level')} />
      <span class="g-small">{lv.next ? t('g.home.toNext', { n: lv.next - earned, name: t('g.lvl.' + (lv.index + 1)) }) : t('g.home.maxLevel')} · {p.nick}</span>
    </Card>

    <SyncCard ctx={ctx} />

    <Section title={t('g.home.routes')} icon="route" id="g-h-routes">
      <ul class="g-routes">{s.gameRoutes.filter((r) => r.active !== false).map((r) => { const pr = sel.routeProgress(r.id); const active = p.activeRoute?.routeId === r.id; return (
        <li key={r.id}><Card class={clsx('g-rcard', `g-rcard--${r.id}`)} onClick={() => ctx.go('route', { id: r.id })} aria-label={L(r.name)}>
          <Media ill={r.ill} src={r.src} shape="plain" ratio={easy ? '16/6' : '16/5'} alt="" />
          <div class="g-rcard__body">
            <span class="g-rcard__ico" aria-hidden="true"><Icon name={ROUTE_ICON[r.id] || 'route'} size={20} /></span>
            <div class="g-rcard__txt"><b>{L(r.name)}</b>{!easy && <span>{L(r.tagline)}</span>}</div>
            {pr.complete ? <Tag tone="green" icon="trophy">{t('g.home.completed')}</Tag> : active ? <Tag tone="live">{t('g.home.active')}</Tag> : null}
          </div>
          <div class="g-rcard__prog"><Progress value={pr.percent} label={L(r.name)} /><span>{t('g.home.missions', { done: pr.done, total: pr.total })} · {pr.points} {t('c.points')}</span></div>
        </Card></li>); })}</ul>
    </Section>

    <Section title={t('g.home.badges')} icon="award" id="g-h-badges">
      <ul class="g-badges">{bs.map((b) => <li key={b.id} class={clsx('g-badge', b.on && 'is-on')} title={t('g.badge.' + b.id)}><span aria-hidden="true"><Icon name={b.icon} size={20} /></span><small>{t('g.badge.' + b.id)}</small><i class="fpz-sr">{b.on ? '✓' : '—'}</i></li>)}</ul>
    </Section>

    <Section title={t('g.home.rewards')} icon="gift" id="g-h-rew" action={<button type="button" class="g-link" onClick={() => ctx.go('rewards')}>{t('g.home.rewardsAll')} ›</button>}>
      <RewardList limit={2} />
    </Section>

    <Card variant="mint" onClick={() => ctx.nav?.openCoupons?.()} class="g-linkcard">
      <Icon name="coupon" size={26} /><span><b>{t('g.home.coupons')}</b>{!easy && <small>{t('g.home.couponsLead')}</small>}</span>
      {p.coupons.length > 0 && <Tag tone="deep">{p.coupons.length}</Tag>}<Icon name="arrowRight" size={18} />
    </Card>

    <Section title={t('g.home.ranking')} icon="trophy" id="g-h-rank" action={<button type="button" class="g-link" onClick={() => ctx.go('ranking')}>{t('g.home.rankingAll')} ›</button>}>
      <Ranking rows={lb.slice(0, 3).concat(me && me.rank > 3 ? [me] : [])} />
    </Section>

    <div class="g-row2">
      <Button variant="secondary" icon="shield" onClick={() => ctx.go('rules')}>{t('g.home.rules')}</Button>
      <Button variant="secondary" icon="settings" onClick={() => ctx.go('settings')}>{t('g.home.settings')}</Button>
    </div>
    <p class="g-testnote"><Icon name="info" size={14} /> {t('g.testNote')}</p>
  </div>);
}

export function SyncCard({ ctx, compact }) {
  const { t, api, p, env, toast, L } = useGame(); const n = p.pending.length; const net = env.network;
  const doSync = () => { const r = api.game.sync(); if (r.ok) { toast(t('g.sync.done', { n: r.synced })); ctx?.setSyncMsg?.(null); } else toast(L(r.message), 'error'); };
  if (compact && !n && net === 'online' && !ctx?.syncMsg) return null;
  return (<div class={clsx('g-sync', n ? 'is-pending' : 'is-ok', net === 'offline' && 'is-offline')} aria-live="polite">
    <Icon name={net === 'offline' ? 'wifiOff' : n ? 'refresh' : 'circleCheck'} size={22} />
    <div class="g-sync__txt">
      <b>{n ? t('g.sync.pending', { n }) : t('g.sync.ok')}</b>
      {net === 'offline' ? <small>{t('g.sync.offline')}</small> : net === 'slow' ? <small>{t('g.sync.slow')}</small> : null}
      {ctx?.syncMsg && net !== 'offline' && <small class="g-sync__auto">{t('g.sync.auto', { n: ctx.syncMsg })}</small>}
      {n > 0 && <small>{t('g.sync.rankNote')}</small>}
    </div>
    {n > 0 && <Button size="sm" variant={net === 'offline' ? 'secondary' : 'primary'} icon="refresh" onClick={doSync} disabled={net === 'offline'}>{t('g.sync.now')}</Button>}
  </div>);
}

/* ── Ranking ── */
function Ranking({ rows }) {
  const { t } = useGame();
  return (<ol class="g-rank">{rows.map((r) => <li key={r.rank + r.nick} class={clsx(r.me && 'is-me')}><span class="g-rank__no">{r.rank}</span><span class="g-rank__nick">{r.nick}{r.me && <Tag tone="deep">{t('g.rank.me')}</Tag>}</span><b>{r.points} <small>{t('c.points')}</small></b></li>)}</ol>);
}
function RankingScreen() {
  const { t } = useGame(); const lb = sel.leaderboard(); const me = lb.find((x) => x.me);
  return (<div class="g-pad g-stack"><h2 class="g-h1">{t('g.home.ranking')}</h2><p class="g-lead">{t('g.rank.place', { n: me?.rank })}</p><Ranking rows={lb} /><p class="g-muted g-small">{t('g.sync.rankNote')}</p></div>);
}

/* ── Nagrody ── */
function RewardList({ limit }) {
  const { t, L, s, api, toast, offline } = useGame(); const [code, setCode] = useState(null);
  const pts = sel.points(); const list = s.rewards.filter((r) => r.active !== false).slice().sort((a, b) => a.cost - b.cost).slice(0, limit || 99);
  if (!list.length) return <Empty icon="gift" title={t('g.rew.emptyCat')} />;
  const redeem = (r) => { const res = api.game.redeemReward(r.id); if (res.ok) { setCode({ code: res.code, reward: r }); toast(t('g.rew.claimed')); } else toast(L(res.message), 'error'); };
  return (<>
    <ul class="g-rewards">{list.map((r) => { const can = pts >= r.cost && r.stock > 0; return (<li key={r.id}><Card class="g-reward">
      <Media ill={r.ill} src={r.src} shape="arc-tl" ratio="1/1" alt="" class="g-reward__img" />
      <div class="g-reward__body">
        <b class="g-reward__name">{L(r.name)}</b>
        <span class="g-small g-muted">{L(r.description)}</span>
        <span class="g-reward__meta"><Tag tone="deep" icon="star">{t('g.rew.cost', { n: r.cost })}</Tag>{r.stock > 0 ? <Tag>{t('g.rew.stock', { n: r.stock })}</Tag> : <Tag tone="warn">{t('g.rew.out')}</Tag>}</span>
        <details class="g-reward__pickup"><summary>{t('g.rew.pickup')}</summary><p>{L(r.pickup)}</p></details>
        <Button size="sm" icon="gift" disabled={!can || offline} onClick={() => redeem(r)} variant={can ? 'primary' : 'secondary'}>{can ? (offline ? t('g.rew.offline') : t('g.rew.redeem')) : r.stock > 0 ? t('g.rew.need', { n: r.cost - pts }) : t('g.rew.out')}</Button>
      </div></Card></li>); })}</ul>
    <RewardCode data={code} onClose={() => setCode(null)} />
  </>);
}
function RewardCode({ data, onClose }) {
  const { t, L, s, ov } = useGame(); if (!data) return null;
  const rec = s.player.rewards.find((x) => x.code === data.code); const collected = rec?.status === 'collected';
  return (<Modal class={ov} open onClose={onClose} title={t('g.rew.codeTitle')} variant="sheet" closeLabel={t('c.close')}>
    <div class="g-codebox">
      <b>{L(data.reward?.name)}</b>
      <div class={clsx('g-codebox__qr', collected && 'is-used')}><QR value={'FPZ:N:' + data.code} size={180} label={data.code} /></div>
      {collected ? <Tag tone="green" icon="circleCheck">{t('g.rew.collected')}</Tag> : <Tag tone="warn" icon="clock">{t('g.rew.toCollect')}</Tag>}
      <p class="g-small">{t('g.rew.codeLead')}</p>
      <p class="g-small"><b>{t('g.rew.pickup')}:</b> {L(data.reward?.pickup)}</p>
    </div></Modal>);
}
function MyRewards() {
  const { t, L, s } = useGame(); const [code, setCode] = useState(null); const mine = s.player.rewards.slice().reverse();
  if (!mine.length) return <Empty icon="gift" title={t('g.rew.none')} text={t('g.rew.noneText')} />;
  return (<><ul class="g-myrew">{mine.map((r) => { const rw = s.rewards.find((x) => x.id === r.rewardId); return (<li key={r.code}>
    <span class="g-myrew__name"><b>{L(rw?.name)}</b><small>{r.code}</small></span>
    {r.status === 'collected' ? <Tag tone="green" icon="circleCheck">{t('g.rew.collected')}</Tag> : <Tag tone="warn" icon="clock">{t('g.rew.toCollect')}</Tag>}
    <Button size="sm" variant="secondary" icon="qr" onClick={() => setCode({ code: r.code, reward: rw })}>{t('g.rew.showCode')}</Button></li>); })}</ul>
    <RewardCode data={code} onClose={() => setCode(null)} /></>);
}
function RewardsScreen() {
  const { t, offline } = useGame();
  return (<div class="g-pad g-stack">
    <h2 class="g-h1">{t('g.home.rewards')}</h2>
    <p class="g-lead">{t('g.home.points')}: <b>{sel.points()} {t('c.points')}</b></p>
    {offline && <Notice tone="warn">{t('g.rew.offline')}</Notice>}
    <RewardList />
    <Section title={t('g.home.myRewards')} icon="package" id="g-r-mine"><MyRewards /></Section>
  </div>);
}

/* ── Ustawienia i zasady ── */
function Settings({ ctx }) {
  const { t, api, client, set, toast, ov } = useGame(); const [confirm, setConfirm] = useState(false);
  return (<div class="g-pad g-stack">
    <h2 class="g-h1">{t('g.home.settings')}</h2>
    <ProfileForm submitLabel={t('g.profile.save')} onDone={ctx.back} />
    <Section title={t('g.set.appearance')} icon="sliders" id="g-s-app">
      <div class="g-stack g-stack--sm">
        <Switch label={t('g.set.night')} checked={client.theme === 'night'} onChange={(e) => set({ theme: e.currentTarget.checked ? 'night' : 'light' })} />
        <Switch label={t('g.set.contrast')} checked={client.contrast === 'high'} onChange={(e) => set({ contrast: e.currentTarget.checked ? 'high' : 'normal' })} />
      </div>
    </Section>
    <Button variant="danger" icon="trash" onClick={() => setConfirm(true)}>{t('g.set.reset')}</Button>
    <Modal class={ov} open={confirm} onClose={() => setConfirm(false)} title={t('g.set.reset')} size="sm" closeLabel={t('c.close')}
      footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>{t('g.set.cancel')}</Button><Button variant="danger" icon="trash" onClick={() => { api.game.reset(); setConfirm(false); toast(t('g.set.resetDone')); ctx.home(); }}>{t('g.set.delete')}</Button></>}>
      <p>{t('g.set.resetConfirm')}</p></Modal>
  </div>);
}
function Rules() {
  const { t } = useGame();
  const blocks = [['how', 'help'], ['points', 'star'], ['rewards', 'gift'], ['offline', 'wifiOff'], ['privacy', 'shield']];
  return (<div class="g-pad g-stack">
    <h2 class="g-h1">{t('g.home.rules')}</h2>
    {blocks.map(([k, ic]) => <Card key={k} variant={k === 'privacy' ? 'mint' : 'plain'}><div class="fpz-card__body g-stack g-stack--sm"><h3 class="g-h3"><Icon name={ic} size={18} /> {t('g.rules.' + k)}</h3><p>{t('g.rules.' + k + 'Text')}</p></div></Card>)}
    <p class="g-testnote"><Icon name="info" size={14} /> {t('g.testNote')}</p>
  </div>);
}
