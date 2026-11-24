// Trasa innowacji i przyszłości: panorama 360° z kartami „dziś / jutro / efekty”, zgłaszanie i głosowanie na pomysły.
import { useState } from 'preact/hooks';
import { sel } from '../../kernel/api.js';
import { clsx, fmtDate } from '../../kernel/util.js';
import { Icon, Button, Card, Tag, Notice, Empty, Field, Textarea, Select } from '../../ui/components.jsx';
import { Panorama360 } from '../../ui/media.jsx';
import { useGame } from './parts.jsx';

const ASPECTS = [['social', 'people'], ['cultural', 'music'], ['urban', 'building'], ['demographic', 'user']];

export function HotspotCard({ h, ctx }) {
  const { t, L } = useGame(); if (!h) return null;
  return (<Card class="g-hot" aria-live="polite"><div class="fpz-card__body g-stack g-stack--sm">
    <h3 class="g-h3"><Icon name="target" size={18} /> {L(h.name)}</h3>
    <div class="g-hot__nt">
      <div><span class="g-label">{t('g.fut.today')}</span><p>{L(h.now)}</p></div>
      <div class="is-future"><span class="g-label">{t('g.fut.tomorrow')}</span><p>{L(h.future)}</p></div>
    </div>
    {h.effects && <><span class="g-label">{t('g.fut.effects')}</span>
      <ul class="g-effects">{ASPECTS.map(([k, ic]) => h.effects[k] && <li key={k}><Icon name={ic} size={16} /><span><b>{t('g.fut.eff.' + k)}</b>{L(h.effects[k])}</span></li>)}</ul></>}
    {h.poiId && ctx?.nav?.showOnMap && <Button size="sm" variant="secondary" icon="map" onClick={() => ctx.nav.showOnMap(h.poiId)}>{t('g.m.showMap')}</Button>}
  </div></Card>);
}

/** Panorama z licznikiem obejrzanych obiektów. onSeen(ids) – wywoływane po każdym nowym obiekcie. */
export function PanoramaExplorer({ ctx, onSeen }) {
  const { t, L, s, easy } = useGame(); const hs = s.futureHotspots || [];
  const [seen, setSeen] = useState([]); const [cur, setCur] = useState(null);
  const look = (h) => { setCur(h); setSeen((x) => { if (x.includes(h.id)) return x; const n = [...x, h.id]; onSeen?.(n); return n; }); };
  if (!hs.length) return <Empty icon="panorama" title={t('c.empty')} />;
  return (<div class="g-stack">
    <p class="g-small">{t('g.fut.panoLead')}</p>
    <Panorama360 hotspots={hs} onDwell={look} onSelect={look} dwellMs={1200} class="g-pano" />
    <div class="g-hotchips" role="group">{hs.map((h) => <button key={h.id} type="button" class={clsx('g-dchip', seen.includes(h.id) && 'is-on')} onClick={() => look(h)} aria-pressed={cur?.id === h.id}><Icon name={seen.includes(h.id) ? 'eye' : 'target'} size={14} />{L(h.name)}</button>)}</div>
    <p class="g-small g-muted">{t('g.fut.seen', { x: seen.length, n: hs.length })}{!easy && ` · ${t('g.fut.panoNote')}`}</p>
    <HotspotCard h={cur} ctx={ctx} />
  </div>);
}

export function IdeaForm({ onSent }) {
  const { t, L, s, api, toast, easy } = useGame();
  const cats = s.ideaCategories || []; const [f, setF] = useState({ categoryId: cats[0]?.id || '', text: '', poiId: '' }); const [err, setErr] = useState(null);
  const send = (e) => { e.preventDefault(); const r = api.game.submitIdea({ categoryId: f.categoryId, text: f.text, poiId: f.poiId || null }); if (!r.ok) { setErr(L(r.message)); return; } setErr(null); setF({ ...f, text: '' }); toast(r.moderated ? t('g.idea.sentMod') : t('g.idea.sent'), 'ok', 5000); onSent?.(r.idea); };
  return (<form class="g-form g-idea" onSubmit={send}>
    <h3 class="g-h3"><Icon name="sparkles" size={18} /> {t('g.idea.new')}</h3>
    {!easy && <p class="g-small g-muted">{t('g.idea.lead')}</p>}
    <Field label={t('g.idea.category')}><Select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.currentTarget.value })} options={cats.map((c) => ({ id: c.id, label: L(c.name) }))} /></Field>
    <Field label={t('g.idea.text')} error={err}><Textarea rows={easy ? 3 : 4} value={f.text} maxLength={600} required onInput={(e) => setF({ ...f, text: e.currentTarget.value })} /></Field>
    <Field label={t('g.idea.place')}><Select value={f.poiId} onChange={(e) => setF({ ...f, poiId: e.currentTarget.value })}>
      <option value="">{t('g.idea.noPlace')}</option>{sel.pois({ scope: 'fpz' }).map((p) => <option key={p.id} value={p.id}>{L(p.name)}</option>)}</Select></Field>
    <p class="g-small g-muted"><Icon name="shield" size={13} /> {t('g.idea.privacy')}</p>
    <Button type="submit" icon="send" block>{t('g.idea.send')}</Button>
  </form>);
}

export function IdeasBoard() {
  const { t, L, s, api, client, toast, lang } = useGame();
  const pub = sel.ideas({}); const mine = s.ideas.filter((i) => i.mine); const voted = client.voted || [];
  const cat = (id) => L(s.ideaCategories.find((c) => c.id === id)?.name);
  const vote = (i) => { const r = api.game.voteIdea(i.id); if (!r.ok) toast(L(r.message), 'warn'); };
  const stTone = { pending: 'warn', approved: 'green', rejected: 'danger' };
  return (<div class="g-stack">
    <h3 class="g-h3"><Icon name="user" size={18} /> {t('g.idea.mine')}</h3>
    {mine.length ? <ul class="g-ideas">{mine.map((i) => <li key={i.id} class="g-ideaitem"><p>{L(i.text)}</p><span class="g-ideaitem__meta"><Tag>{cat(i.categoryId)}</Tag><Tag tone={stTone[i.status] || 'neutral'}>{t('g.idea.st.' + i.status)}</Tag><small>{fmtDate(i.createdAt, lang, { day: 'numeric', month: 'short' })}</small></span></li>)}</ul>
      : <Empty icon="message" title={t('g.idea.noneMine')} />}
    <h3 class="g-h3"><Icon name="people" size={18} /> {t('g.idea.published')}</h3>
    {pub.length ? <ul class="g-ideas">{pub.map((i) => { const v = voted.includes(i.id); return (<li key={i.id} class="g-ideaitem">
      <p>{L(i.text)}</p>
      <span class="g-ideaitem__meta"><b>{i.nick}</b><Tag>{cat(i.categoryId)}</Tag>{i.poiId && <Tag icon="mapPin">{L(sel.poi(i.poiId)?.name)}</Tag>}</span>
      <button type="button" class={clsx('g-vote', v && 'is-on')} aria-pressed={v} onClick={() => vote(i)} disabled={v}><Icon name="thumbsUp" size={16} /> {v ? t('g.idea.voted') : t('g.idea.vote')} · {t('g.idea.votes', { n: i.votes })}</button>
    </li>); })}</ul> : <Empty icon="message" title={t('g.idea.none')} />}
    {s.settings.moderation && <Notice>{t('g.idea.sentMod')}</Notice>}
  </div>);
}
