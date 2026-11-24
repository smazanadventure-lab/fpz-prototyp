// Ekran misji: opowieść, zadanie, warunek zaliczenia (QR / BLE / AR / GPS / quiz / panorama / pomysł), wynik i zaproszenie dalej.
import { useState, useRef, useEffect } from 'preact/hooks';
import { sel } from '../../kernel/api.js';
import { clsx, fmtDistance } from '../../kernel/util.js';
import { Icon, Button, Card, Tag, Notice, Media, Empty, Modal, Chips } from '../../ui/components.jsx';
import { ARView, VideoSim } from '../../ui/media.jsx';
import { useGame, missionTask, missionVariant, routeOpts, unlockableCoupons, nextOutside, KindTag } from './parts.jsx';
import { PanoramaExplorer, IdeaForm } from './future.jsx';
import { SyncCard } from './index.jsx';

export function MissionScreen({ id, ctx }) {
  const g = useGame(); const { t, L, s, p, api, toast, easy, client, set } = g;
  const m = sel.mission(id); const [result, setResult] = useState(null); const [missing, setMissing] = useState(null); const [quizOn, setQuizOn] = useState(false);
  if (!m) return <div class="g-pad"><Empty icon="target" title={t('g.m.notFound')} /></div>;
  const r = sel.routeOfMission(id); const poi = sel.poi(m.poiId); const chk = sel.missionCheck(m); const done = p.done[id];
  const quiz = m.quizId ? sel.quiz(m.quizId) : null; const v = missionVariant(m, p, client);
  const opts = routeOpts(r, p, client);
  const setVariant = (vid) => { if (p.activeRoute?.routeId === r.id) api.game.setRouteOptions({ variant: vid }); else set({ gameOpts: { ...(client.gameOpts || {}), [r.id]: { ...opts, variant: vid } } }); };

  const complete = (via, force, extra = {}) => {
    const before = extra.before || unlockableCoupons(s);
    const res = api.game.completeMission(id, { via, force });
    if (!res.ok) { if (res.error === 'NOT_IN_RANGE') setMissing(res); else toast(L(res.message), 'error'); return; }
    setMissing(null); setQuizOn(false);
    const after = unlockableCoupons(s);
    setResult({ ...res, quiz: extra.quiz || null, coupons: after.filter((c) => !before.includes(c)) });
  };
  // przy misji z quizem: najpierw warunek na miejscu, potem quiz, na końcu zaliczenie
  const act = (via) => {
    if (!quiz) return complete(via, false);
    if (!chk.ok && ['qr', 'ble', 'ar', 'gps', 'quiz'].includes(m.kind)) { complete(via, false); return; }
    setMissing(null); setQuizOn(true);
  };
  const finishQuiz = (answers) => {
    const before = unlockableCoupons(s); const q = api.game.submitQuiz(m.quizId, answers);
    if (!q.ok) { toast(L(q.message), 'error'); return; }
    complete(m.kind === 'quiz' ? 'quiz' : m.kind, true, { before, quiz: q });
  };

  return (<div class="g-mission">
    <div class="g-hero g-hero--m">
      <Media ill={poi?.ill || r?.ill || 'city-street'} shape="arc-tr" ratio={easy ? '16/6' : '16/7'} alt={L(poi?.name)} />
      <div class="g-hero__txt">
        <span class="g-hero__tags"><KindTag kind={m.kind} />{poi && <Tag tone={poi.scope === 'fpz' ? 'green' : 'info'} icon={poi.scope === 'fpz' ? 'building' : 'map'}>{poi.scope === 'fpz' ? t('g.ms.fpz') : t('g.ms.city')}</Tag>}{m.accessible && <Tag icon="wheelchair">{t('g.ms.accessible')}</Tag>}</span>
        <h2 class="g-h1">{L(m.title)}</h2>
        {poi && <p class="g-muted"><Icon name="mapPin" size={15} /> {L(poi.name)} · {fmtDistance(chk.distanceM)}</p>}
        <span class="g-mpts"><Icon name="star" size={15} /> {m.points} {t('c.points')}</span>
      </div>
    </div>
    <div class="g-pad g-stack">
      {result ? <><DoneCard m={m} res={result} ctx={ctx} /><FollowUp m={m} ctx={ctx} /></> : done ? <Notice tone="ok">{t('g.m.doneAt', { pts: done.points })}{!done.synced ? ` · ${t('g.m.pending')}` : ''}</Notice> : null}

      <Card variant="mint" class="g-story"><div class="fpz-card__body g-stack g-stack--sm">
        <span class="g-label"><Icon name="book" size={14} /> {t('g.m.story')}</span>
        <p>{L(m.story)}</p>
        {poi?.accessNote && L(poi.accessNote) && (opts.mode === 'access' || easy) && <p class="g-small"><Icon name="wheelchair" size={14} /> {L(poi.accessNote)}</p>}
      </div></Card>

      {v && <div class="g-variant">
        <Chips scroll options={r.variants.map((x) => ({ id: x.id, label: L(x.name) }))} value={v.id} onChange={setVariant} />
        <p class="g-variant__txt"><span class="g-label">{t('g.m.context', { v: L(v.variant?.name) })}</span>{L(v.text)}</p>
      </div>}

      <div class="g-task"><span class="g-label"><Icon name="target" size={14} /> {t('g.m.task')}{easy && <Tag tone="info">{t('g.m.easyMode')}</Tag>}</span><p class="g-task__txt">{missionTask(m, p, L)}</p></div>

      {!done && !result && (quizOn && quiz ? <QuizRun quiz={quiz} onDone={finishQuiz} />
        : <Condition m={m} chk={chk} quiz={quiz} act={act} complete={complete} ctx={ctx} />)}

      {missing && <Notice tone="warn" icon="circleAlert" class="g-missing"><b>{t('g.m.missing')}: </b>{L(missing.message)} {missingDetail(missing, chk, m, t)}</Notice>}
      {!done && <SyncCard ctx={ctx} compact />}
      {!result && <FollowUp m={m} ctx={ctx} />}
      {!done && <p class="g-testnote"><Icon name="info" size={14} /> {t('g.testNote')}</p>}
    </div>
  </div>);
}

function missingDetail(res, chk, m, t) {
  if (res.need === 'qr') return chk.trigger ? t('g.m.qrCode', { code: chk.trigger.code }) : '';
  if (res.need === 'ble') return t('g.m.bleDist', { d: fmtDistance(chk.distanceM), r: chk.trigger?.ble?.rangeM || 20 });
  return t('g.m.gpsFar', { d: fmtDistance(chk.distanceM), r: m.radiusM || 40 });
}

/* ── Warunek zaliczenia ── */
function Condition({ m, chk, quiz, act, complete, ctx }) {
  const { t, L, s, env, easy } = useGame(); const [ar, setAr] = useState(false); const [seenN, setSeenN] = useState(0);
  const radius = m.radiusM || 40; const dist = fmtDistance(chk.distanceM);
  const head = <span class="g-label"><Icon name="check" size={14} /> {t('g.m.condition')}</span>;
  if (m.kind === 'qr') {
    const code = chk.trigger?.code; const inView = env.qrInView;
    return (<div class={clsx('g-cond', chk.ok && 'is-ok')}>{head}
      <div class="g-cond__row"><span class="g-cond__ico"><Icon name="qr" size={30} /></span>
        <p>{chk.ok ? t('g.m.qrSeen', { code: inView }) : t('g.m.qrHint', { code: code || '—' })}{!chk.ok && inView ? ` ${t('g.m.qrWrong', { code: inView })}` : ''}</p></div>
      <div class="g-row2"><Button icon="scan" size="lg" onClick={() => act('qr')}>{quiz && chk.ok ? t('g.m.startQuiz') : t('g.m.scan')}</Button>
        {ctx.nav?.openScanner && <Button variant="secondary" icon="camera" onClick={() => ctx.nav.openScanner()}>{t('g.m.scanOpen')}</Button>}</div>
    </div>);
  }
  if (m.kind === 'ble') {
    const range = chk.trigger?.ble?.rangeM || 20; const max = range * 4; const k = Math.min(1, (isFinite(chk.distanceM) ? chk.distanceM : max) / max);
    return (<div class={clsx('g-cond', chk.ok && 'is-ok')}>{head}
      <div class="g-radar" role="img" aria-label={t('g.m.bleDist', { d: dist, r: range })}>
        <svg viewBox="-50 -50 100 100"><circle r="48" class="g-radar__ring" /><circle r="36" class="g-radar__ring" /><circle r="24" class="g-radar__ring" /><circle r={48 / 4} class="g-radar__range" />
          <g class="g-radar__sweep"><path d="M0 0L0 -48A48 48 0 0 1 34 -34z" /></g>
          <circle cx="0" cy={-Math.max(4, k * 46)} r="4.5" class="g-radar__me" /><circle r="3.5" class="g-radar__bea" /></svg>
        <div class="g-radar__txt"><b>{chk.ok ? t('g.m.bleIn') : t('g.m.ble')}</b><span>{t('g.m.bleDist', { d: dist, r: range })}</span></div>
      </div>
      <Button icon="bluetooth" size="lg" block onClick={() => act('ble')} variant={chk.ok ? 'primary' : 'secondary'}>{quiz && chk.ok ? t('g.m.startQuiz') : t('g.m.bleGo')}</Button>
    </div>);
  }
  if (m.kind === 'ar') {
    const route = sel.routeOfMission(m.id); const sc = chk.trigger?.ar;
    return (<div class={clsx('g-cond', chk.ok && 'is-ok')}>{head}
      {chk.ok ? (ar ? <div class="g-stack g-stack--sm"><p class="g-small">{route?.id === 'future' ? t('g.fut.arLead') : ''} {t('g.m.arCapture')}</p>
        <ARView scene={sc?.scene || 'plaza'} overlay={route?.id === 'future' ? 'future' : (sc?.overlay || 'info')} modelId={sc?.modelId} label={route?.id === 'future' ? null : L(m.title)} onCapture={() => act('ar')} class="g-ar" /></div>
        : <Button icon="ar" size="lg" block onClick={() => setAr(true)}>{t('g.m.arGo')}</Button>)
        : <div class="g-cond__row"><span class="g-cond__ico"><Icon name="ar" size={30} /></span><p>{t('g.m.arFar', { d: dist, r: radius })}</p></div>}
      {!chk.ok && <Button variant="secondary" icon="ar" onClick={() => act('ar')}>{t('g.m.arGo')}</Button>}
    </div>);
  }
  if (m.kind === 'panorama') {
    const need = Math.min(3, (s.futureHotspots || []).length || 3);
    return (<div class={clsx('g-cond', seenN >= need && 'is-ok')}>{head}<p class="g-small">{t('g.m.panoNeed', { n: need })}</p>
      <PanoramaExplorer ctx={ctx} onSeen={(ids) => setSeenN(ids.length)} />
      <Button icon="circleCheck" size="lg" block disabled={seenN < need} onClick={() => (quiz ? act('panorama') : complete('panorama', true))}>{t('g.m.panoDone')} ({Math.min(seenN, need)}/{need})</Button>
    </div>);
  }
  if (m.kind === 'idea') {
    return (<div class="g-cond">{head}<p class="g-small">{t('g.m.ideaNeed')}</p><IdeaForm onSent={() => complete('idea', true)} /></div>);
  }
  // gps i quiz – geofencing
  return (<div class={clsx('g-cond', chk.ok && 'is-ok')}>{head}
    <div class="g-cond__row"><span class={clsx('g-cond__ico', chk.ok && 'is-pulse')}><Icon name={chk.ok ? 'circleCheck' : 'locate'} size={30} /></span>
      <p>{chk.ok ? <b>{t('g.m.gpsHere')}</b> : t('g.m.gpsFar', { d: dist, r: radius })}</p></div>
    {!easy && !chk.ok && <div class="g-geo" aria-hidden="true"><i style={{ width: `${Math.max(4, 100 - Math.min(100, (chk.distanceM / Math.max(radius * 10, 1)) * 100))}%` }} /></div>}
    <Button icon={quiz ? 'quiz' : 'locate'} size="lg" block variant={chk.ok ? 'primary' : 'secondary'} onClick={() => act(m.kind === 'quiz' ? 'quiz' : 'gps')}>{quiz ? t('g.m.startQuiz') : t('g.m.confirm')}</Button>
  </div>);
}

/* ── Quiz: pytania po kolei, natychmiastowa informacja zwrotna ── */
function QuizRun({ quiz, onDone }) {
  const { t, L, p, easy } = useGame(); const qs = quiz.questions; const lowLevel = p.profile.difficulty === 'easy' || easy;
  const [i, setI] = useState(0); const [answers, setAnswers] = useState(() => qs.map(() => null)); const [picked, setPicked] = useState(null);
  const q = qs[i]; const basic = q.level !== 'hard'; const last = i === qs.length - 1;
  const choose = (k) => { if (picked != null) return; setPicked(k); const a = answers.slice(); a[i] = k; setAnswers(a); };
  const next = () => { if (last) { onDone(answers); return; } setI(i + 1); setPicked(null); };
  const score = answers.filter((a, k) => a === qs[k].correct).length;
  return (<div class="g-quiz" aria-live="polite">
    <div class="g-quiz__head"><span class="g-label"><Icon name="quiz" size={14} /> {L(quiz.title)}</span><span class="g-small">{t('g.q.of', { i: i + 1, n: qs.length })} · ✓ {score}</span></div>
    <div class="g-quiz__dots" aria-hidden="true">{qs.map((x, k) => <i key={x.id} class={clsx(k === i && 'is-cur', answers[k] != null && (answers[k] === x.correct ? 'is-good' : 'is-bad'), lowLevel && x.level !== 'hard' && 'is-basic')} />)}</div>
    {lowLevel && <Tag tone={basic ? 'green' : 'neutral'}>{basic ? t('g.q.basic') : t('g.q.extra')}</Tag>}
    <h3 class="g-quiz__q">{L(q.q)}</h3>
    <ul class="g-quiz__ans">{q.answers.map((a, k) => { const st = picked == null ? '' : k === q.correct ? 'is-good' : k === picked ? 'is-bad' : 'is-dim'; return (
      <li key={k}><button type="button" class={clsx('g-ans', st)} onClick={() => choose(k)} disabled={picked != null} aria-pressed={picked === k}><span class="g-ans__l">{'ABCD'[k]}</span>{L(a)}{st === 'is-good' && <Icon name="circleCheck" size={18} />}{st === 'is-bad' && <Icon name="circleX" size={18} />}</button></li>); })}</ul>
    {picked != null && <Notice tone={picked === q.correct ? 'ok' : 'warn'} class="g-quiz__fb"><b>{picked === q.correct ? t('g.q.good') : t('g.q.bad')}</b> {L(q.explain)}</Notice>}
    <div class="g-row2">
      {picked == null && lowLevel && !basic && <Button variant="secondary" onClick={next}>{t('g.q.skip')}</Button>}
      {picked != null && <Button iconRight="arrowRight" onClick={next}>{last ? t('g.q.finish') : t('g.q.next')}</Button>}
    </div>
  </div>);
}

/* ── Po zaliczeniu ── */
function DoneCard({ m, res, ctx }) {
  const { t, L, s, api, toast } = useGame(); const [claimed, setClaimed] = useState([]); const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }, []);
  const gained = (res.points || 0) + (res.quiz?.points || 0); const r = sel.routeOfMission(m.id);
  const nextInRoute = r ? sel.routeMissions(r.id).find((x) => !s.player.done[x.id]) : null;
  const claim = (cid) => { const x = api.game.claimCoupon(cid); if (x.ok) { setClaimed([...claimed, cid]); toast(t('g.done.claimed')); } else toast(L(x.message), 'error'); };
  return (<div ref={ref} class="g-done-wrap"><Card variant="deep" class="g-done" role="status"><div class="fpz-card__body g-stack">
    <div class="g-done__top"><span class="g-done__badge" aria-hidden="true"><Icon name="trophy" size={30} /></span>
      <div><h3 class="g-h2">{t('g.done.title')}</h3><span class="g-small">{t('g.done.total', { n: sel.points() })}</span></div>
      <b class="g-pop" aria-label={`+${gained} ${t('c.points')}`}>+{gained}</b></div>
    {res.quiz && <p class="g-small">{t('g.q.result', { s: res.quiz.score, n: res.quiz.total, pts: res.quiz.points })}{!res.quiz.first ? ` ${t('g.q.repeat')}` : ''}</p>}
    {res.queued && <Notice tone="warn" icon="wifiOff">{t('g.done.queued')}</Notice>}
    {res.coupons?.length > 0 && <div class="g-stack g-stack--sm"><span class="g-label g-label--on-dark"><Icon name="coupon" size={14} /> {t('g.done.coupons')}</span>
      {res.coupons.map((cid) => { const c = s.coupons.find((x) => x.id === cid); const st = c && sel.couponState(c); return c && (<div key={cid} class="g-coupon"><span><b>{L(c.title)}</b>{!L(c.title).includes(L(c.discount)) && <small>{L(c.discount)}</small>}</span>
        {st.claimed ? <Button size="sm" variant="mint" icon="coupon" onClick={() => ctx.nav?.openCoupons?.()}>{t('g.home.coupons')}</Button> : <Button size="sm" variant="mint" icon="gift" onClick={() => claim(cid)}>{t('g.done.claim')}</Button>}</div>); })}</div>}
    {res.routeCompleted ? <><p><b>{t('g.done.routeDone')}</b></p><Button variant="mint" icon="trophy" onClick={() => ctx.back()}>{t('g.done.summary')}</Button></>
      : nextInRoute && <Button variant="mint" iconRight="arrowRight" class="g-wrapbtn" onClick={() => ctx.replace('mission', { id: nextInRoute.id })}><span>{t('g.done.nextMission')}<small>{L(nextInRoute.title)}</small></span></Button>}
  </div></Card></div>);
}

/** Dowiedz się więcej / mapa / film / zaproszenie do kolejnego miejsca poza FPŻ. */
function FollowUp({ m, ctx }) {
  const { t, L, s, p, ov } = useGame(); const [video, setVideo] = useState(null);
  const poi = sel.poi(m.poiId); const entry = sel.entries({ poiId: m.poiId })[0]; const vid = entry?.media?.find((x) => x.type === 'video');
  const r = sel.routeOfMission(m.id); const nx = nextOutside(s, poi, r?.id); const showInvite = !!p.done[m.id] || poi?.scope === 'fpz';
  return (<div class="g-stack">
    <div class="g-actions">
      {entry && <Button variant="secondary" icon="book" onClick={() => ctx.nav?.openEntry?.(entry.id)}>{t('g.m.more')}</Button>}
      {poi && <Button variant="secondary" icon="map" onClick={() => ctx.nav?.showOnMap?.(poi.id)}>{t('g.m.showMap')}</Button>}
      {vid && <Button variant="secondary" icon="video" onClick={() => setVideo(vid)}>{t('g.m.video')}</Button>}
    </div>
    {showInvite && nx && nx.poi.id !== poi?.id && <Card class="g-invite"><div class="g-invite__in">
      <Media ill={nx.poi.ill || 'city-street'} shape="arc-tl" ratio="1/1" alt="" class="g-invite__img" />
      <div class="g-stack g-stack--sm"><span class="g-label"><Icon name="compass" size={14} /> {t('g.done.invite')}</span>
        <b>{L(nx.poi.name)}</b><small class="g-muted">{L(nx.poi.short)} · {fmtDistance(nx.distanceM)}</small>
        <div class="g-actions">{nx.mission && <Button size="sm" iconRight="arrowRight" onClick={() => ctx.replace('mission', { id: nx.mission.id })}>{t('g.done.toMission')}</Button>}
          <Button size="sm" variant="secondary" icon="map" onClick={() => ctx.nav?.showOnMap?.(nx.poi.id)}>{t('g.m.showMap')}</Button></div></div></div></Card>}
    {video && <Modal class={ov} open onClose={() => setVideo(null)} title={L(video.caption)} size="lg" closeLabel={t('c.close')}>
      <VideoSim title={L(video.caption)} ill={video.ill} src={video.src} durationSec={video.durationSec || 60} autoplay captions={[{ t: 0, text: video.caption }, { t: 4, text: entry.lead }, { t: 12, text: entry.title }]} />
      <p class="g-small g-muted">{L(entry.lead)}</p></Modal>}
  </div>);
}
