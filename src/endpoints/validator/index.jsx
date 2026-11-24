// Stanowisko bileterskie: walidacja biletów, kuponów i nagród z gry (końcówka „validator”).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Client, useClient, useNow } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { sel, makeApi, ROLES } from '../../kernel/api.js';
import { fmtDateTime, fmtTime, fmtDay, pad2 } from '../../kernel/util.js';
import { Icon, Button, Logo, ScaleBox, Field, Input, Select, Notice, Tag, Tabs, Chips, Empty, Progress } from '../../ui/components.jsx';
import './validator.css';

if (typeof window !== 'undefined') window.__fpzValidator = { getState, makeApi };

const GATES = ['Wejście główne', 'Hala Tworzeń – scena', 'Hala Ząbkowice', 'Pasaż Reden', 'Punkt odbioru nagród'];
const REASONS = { NOT_FOUND: 'Nie znaleziono', ALREADY_USED: 'Już wykorzystany', REFUNDED: 'Zwrócony', OTHER_EVENT: 'Inne wydarzenie' };
const KIND = { ticket: 'Bilet', reward: 'Nagroda z gry', coupon: 'Kupon' };

export default function ValidatorApp({ standalone = false } = {}) {
  return <Client id="validator" base={15} class={standalone ? 'ep-validator is-standalone' : 'ep-validator'}><Scene standalone={!!standalone} /></Client>;
}

function Scene({ standalone }) {
  const { staff } = useClient();
  const scanRef = useRef(null); const wrapRef = useRef(null);
  /* samodzielnie na wąskim ekranie panel testera jest pod urządzeniem – po „zeskanowaniu” wracamy do ekranu wyniku */
  const tester = <Tester scan={(c) => { scanRef.current?.(c); if (standalone) wrapRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} enabled={!!staff} />;
  /* Pod własnym adresem (/bileter) ekran urządzenia wypełnia okno (telefon/tablet biletera), bez obudowy i skalowania; panel testera obok (szeroko) lub pod spodem (wąsko). */
  if (standalone) return (<div class="v-wrap v-wrap--sa" ref={wrapRef}><div class="v-scene v-scene--sa">
    <div class="v-sa-device"><Device scanRef={scanRef} bare /></div>
    {tester}
  </div></div>);
  return (<div class="v-wrap"><div class="v-scene">
    <div class="v-stagewrap">
      <ScaleBox width={560} height={900}><Device scanRef={scanRef} /></ScaleBox>
    </div>
    {tester}
  </div></div>);
}

/* ───────── urządzenie bileterskie ───────── */
function beep(ok) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ctx = beep.ctx || (beep.ctx = new AC());
    const tones = ok ? [[1320, 0, 0.09], [1760, 0.11, 0.12]] : [[220, 0, 0.35]];
    for (const [f, t, d] of tones) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = ok ? 'sine' : 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d + 0.02); }
  } catch { /* brak Web Audio */ }
}

function Device({ scanRef, bare = false }) {
  const { staff, client, set, api, toast } = useClient(); const now = useNow(10000);
  const s = getState();
  return (<div class={bare ? 'v-device v-device--bare' : 'v-device'}>
    {!bare && <div class="v-device__grip" aria-hidden="true" />}
    <div class="v-screen">
      <div class="v-sbar"><span>{pad2(now.getHours())}:{pad2(now.getMinutes())}</span><span class="v-sbar__mid">FPŻ · Bileter</span><span class="v-sbar__ic"><Icon name={s.env.network === 'offline' ? 'wifiOff' : 'wifi'} size={14} /><Icon name="battery" size={16} />86%</span></div>
      {!staff ? <Login /> : !sel.can(staff, 'tickets.validate') ? <NoPerm /> : <Scanner scanRef={scanRef} />}
    </div>
    {!bare && <div class="v-device__trigger" aria-hidden="true" />}
  </div>);
}

function Login() {
  const { api, toast, set } = useClient();
  const [l, setL] = useState('bileter'); const [p, setP] = useState('bileter'); const [err, setErr] = useState('');
  const go = (a, b) => { const r = api.staff.login(a, b); if (!r.ok) return setErr(r.message.pl); set({ vShiftStart: new Date().toISOString() }); toast(`Zalogowano: ${r.staff.name}`); };
  const pick = (x) => { setL(x); setP(x); setErr(''); };
  const q = (x, icon) => { const on = l === x && p === x; return <button type="button" class={on ? 'is-on' : ''} aria-pressed={on} onClick={() => pick(x)} data-testid={`v-login-acc-${x}`}><Icon name={on ? 'check' : icon} size={16} />{x}</button>; };
  return (<form class="v-login" onSubmit={(e) => { e.preventDefault(); go(l, p); }}>
    <div class="v-login__logo"><Logo /></div>
    <h1>Stanowisko bileterskie</h1>
    <p class="v-muted">Zaloguj się kontem kasy / bileterki.</p>
    <Field label="Login"><Input value={l} onInput={(e) => setL(e.currentTarget.value)} autocomplete="username" name="v-login" /></Field>
    <Field label="Hasło" error={err}><Input type="password" value={p} onInput={(e) => setP(e.currentTarget.value)} autocomplete="current-password" name="v-pass" /></Field>
    <Button type="submit" size="lg" block icon="login" data-testid="v-login-submit">Zaloguj</Button>
    <p class="v-login__note"><Icon name="info" size={14} />Makieta logowania – dane konta testowego są wypełnione.</p>
    <div class="v-login__quick"><span>Konta testowe:</span>{q('bileter', 'ticket')}{q('admin', 'shield')}</div>
  </form>);
}

function NoPerm() {
  const { staff, api } = useClient();
  return (<div class="v-login"><Empty icon="lock" title="Brak uprawnień" text={`Konto „${staff.login}” (${ROLES[staff.role]?.name}) nie może walidować biletów.`} /><Button variant="secondary" icon="logout" onClick={() => api.staff.logout()}>Wyloguj</Button></div>);
}

function Scanner({ scanRef }) {
  const { staff, client, set, api, toast } = useClient(); const s = getState();
  const [code, setCode] = useState(''); const [res, setRes] = useState(null); const [left, setLeft] = useState(0);
  const inp = useRef(null);
  const gate = client.vGate || GATES[0]; const eventId = client.vEvent || '';
  const events = sel.events({ ticketed: true });
  const ev = eventId && sel.event(eventId);
  const shiftStart = client.vShiftStart || '';
  const mine = s.stats.validations.filter((v) => v.staffId === staff.id && v.at >= shiftStart);
  const okN = mine.filter((v) => v.ok).length; const badN = mine.length - okN;
  const sound = client.vSound !== false;

  const show = (r) => { setRes(r); setLeft(r.tone === 'ok' ? 3 : 6); if (sound && r.tone !== 'warn') beep(r.tone === 'ok'); else if (sound) beep(false); };
  const validate = (raw) => {
    const r = api.tickets.validate(raw, { gate });
    const t = r.ticket; const owner = t && sel.user(t.userId);
    const e = t?.eventId && sel.event(t.eventId);
    show({ tone: r.ok ? 'ok' : 'bad', kind: r.kind, reason: r.reason, code: String(raw).replace(/^FPZ:[TNK]:/i, '').toUpperCase(),
      title: r.ok ? (r.kind === 'reward' ? 'Wydaj nagrodę' : r.kind === 'coupon' ? 'Kupon przyjęty' : 'Bilet ważny') : r.reason === 'ALREADY_USED' ? (r.kind === 'ticket' ? 'Bilet już wykorzystany' : r.kind === 'reward' ? 'Nagroda już odebrana' : 'Kupon już wykorzystany') : r.reason === 'REFUNDED' ? 'Bilet zwrócony' : 'Nie znaleziono kodu',
      msg: r.message?.pl, label: r.label || '', owner: owner?.name, event: e, used: r.reason === 'ALREADY_USED' && t ? { at: t.usedAt, gate: t.gate } : null,
      reward: r.reward, coupon: r.coupon });
  };
  const scan = (raw) => {
    const txt = String(raw || '').trim(); if (!txt) return; setCode('');
    const m = txt.match(/^FPZ:([TNK]):(.+)$/i); const kind = m ? m[1].toUpperCase() : 'T'; const c = (m ? m[2] : txt).toUpperCase();
    if (kind === 'T' && eventId) {
      const t = s.tickets.find((x) => x.code === c);
      if (t && t.status === 'valid' && t.eventId && t.eventId !== eventId) { const e = sel.event(t.eventId); return show({ tone: 'warn', kind: 'ticket', reason: 'OTHER_EVENT', code: c, title: 'Bilet na inne wydarzenie', msg: `Bilet uprawnia do: ${e?.title.pl || 'inne wydarzenie'} (${e ? fmtDay(e.start) + ', ' + fmtTime(e.start) : ''}).`, label: t.productName.pl, owner: sel.user(t.userId)?.name, raw: txt }); }
    }
    validate(txt);
  };
  scanRef.current = scan;
  useEffect(() => () => { scanRef.current = null; }, []);
  useEffect(() => {
    if (!res || res.tone === 'warn') return;
    if (left <= 0) { setRes(null); return; }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000); return () => clearTimeout(t);
  }, [res, left]);
  useEffect(() => { if (!res) inp.current?.focus({ preventScroll: true }); }, [res]);

  const used = ev ? s.tickets.filter((t) => t.eventId === ev.id && t.status === 'used').length : 0;
  const recent = s.stats.validations.filter((v) => v.gate === gate).slice(0, 3);
  return (<div class="v-scan">
    <div class="v-scan__head">
      <div class="v-scan__who"><span class="v-avatar">{staff.name[0]}</span><div><b>{staff.name}</b><small>zmiana od {shiftStart ? fmtTime(shiftStart) : '—'}</small></div></div>
      <button type="button" class={`v-ic${sound ? ' is-on' : ''}`} aria-label={sound ? 'Wycisz sygnał' : 'Włącz sygnał'} aria-pressed={sound} onClick={() => set({ vSound: !sound })}><Icon name={sound ? 'volume' : 'mute'} size={18} /></button>
      <button type="button" class="v-ic" aria-label="Wyloguj" onClick={() => { api.staff.logout(); toast('Wylogowano', 'info'); }}><Icon name="logout" size={18} /></button>
    </div>
    <div class="v-setup">
      <Field label="Wejście"><Select value={gate} onChange={(e) => set({ vGate: e.currentTarget.value })} options={GATES.map((g) => ({ id: g, label: g }))} data-testid="v-gate" /></Field>
      <Field label="Wydarzenie (opcjonalnie)"><Select value={eventId} onChange={(e) => set({ vEvent: e.currentTarget.value })} options={[{ id: '', label: 'Wszystkie / wstęp ogólny' }, ...events.map((e) => ({ id: e.id, label: `${fmtDay(e.start)} ${fmtTime(e.start)} · ${e.title.pl}` }))]} data-testid="v-event" /></Field>
    </div>
    <div class="v-viewfinder" aria-hidden="true"><i /><i /><i /><i /><span class="v-laser" /><div><Icon name="scan" size={40} /><small>Skaner kodów 2D (symulacja)</small></div></div>
    <form class="v-codeform" onSubmit={(e) => { e.preventDefault(); scan(code); }}>
      <input ref={inp} class="fpz-input fpz-input--pill" value={code} onInput={(e) => setCode(e.currentTarget.value)} placeholder="Kod: FPZ:T:… / FPZ:N:… / FPZ:K:…" aria-label="Kod biletu, nagrody lub kuponu" autocomplete="off" spellcheck={false} data-testid="v-code" />
      <Button type="submit" icon="check" disabled={!code.trim()}>Sprawdź</Button>
    </form>
    <div class="v-counters">
      <div class="v-cnt"><b data-testid="v-ok">{okN}</b><span>wpuszczono</span></div>
      <div class="v-cnt v-cnt--bad"><b data-testid="v-bad">{badN}</b><span>odrzucono</span></div>
      <div class="v-cnt v-cnt--all"><b>{mine.length}</b><span>skanów na zmianie</span></div>
    </div>
    {ev ? <div class="v-att"><div class="v-att__t"><b>Frekwencja</b><span>{used} / {ev.sold || 0} sprzedanych · {ev.capacity} miejsc</span></div><Progress value={used} max={ev.capacity || 1} label="Frekwencja" /><div class="v-att__bar2"><i style={{ width: `${Math.min(100, ((ev.sold || 0) / (ev.capacity || 1)) * 100)}%` }} /></div></div>
      : <p class="v-muted v-small">Wybierz wydarzenie, aby widzieć frekwencję i ostrzeżenia o biletach na inne wydarzenia.</p>}
    <ul class="v-recent" aria-label="Ostatnie skany">{recent.map((v, i) => <li key={i} class={v.ok ? 'is-ok' : 'is-bad'}><Icon name={v.ok ? 'circleCheck' : 'circleX'} size={15} /><code>{v.code}</code><span>{v.ok ? 'OK' : REASONS[v.reason] || v.reason}</span><time>{fmtTime(v.at)}</time></li>)}</ul>
    <p class="v-offline"><Icon name="database" size={13} />Tryb offline: {s.tickets.filter((t) => t.status === 'valid').length} ważnych biletów w pamięci urządzenia</p>
    {res && <Result r={res} left={left} onClose={() => setRes(null)} onAllow={() => validate(res.raw)} />}
  </div>);
}

function Result({ r, left, onClose, onAllow }) {
  const icon = r.tone === 'ok' ? (r.kind === 'reward' ? 'gift' : r.kind === 'coupon' ? 'coupon' : 'circleCheck') : r.tone === 'warn' ? 'circleAlert' : 'circleX';
  return (<div class={`v-result v-result--${r.tone}`} role="alert" aria-live="assertive" data-testid="v-result" data-tone={r.tone} onClick={r.tone === 'warn' ? undefined : onClose}>
    <div class="v-result__ic"><Icon name={icon} size={92} stroke={2.2} /></div>
    <span class="v-result__kind">{KIND[r.kind] || 'Kod'} · {r.code}</span>
    <h2>{r.title}</h2>
    {r.kind === 'reward' && r.tone === 'ok' && <p class="v-result__big">{r.label}</p>}
    {r.kind !== 'reward' && r.label && <p class="v-result__lbl">{r.label}</p>}
    {r.msg && r.kind !== 'reward' && <p>{r.msg}</p>}
    {r.owner && <p class="v-result__det"><Icon name="user" size={16} />{r.owner}</p>}
    {r.used && <p class="v-result__det"><Icon name="clock" size={16} />Wykorzystany {fmtDateTime(r.used.at)} · {r.used.gate}</p>}
    {r.tone === 'warn'
      ? <div class="v-result__act"><Button variant="secondary" onClick={onClose} data-testid="v-deny">Odmów wejścia</Button><Button onClick={(e) => { e.stopPropagation(); onAllow(); }} data-testid="v-allow">Wpuść mimo to</Button></div>
      : <div class="v-result__foot"><span>Dotknij, aby skanować dalej · {left} s</span><i style={{ animationDuration: `${r.tone === 'ok' ? 3 : 6}s` }} /></div>}
  </div>);
}

/* ───────── panel testera ───────── */
function CodeItem({ payload, children, enabled, scan }) {
  return (<li><button type="button" class="v-tcode" disabled={!enabled} onClick={() => scan(payload)} data-code={payload} title="Zeskanuj ten kod"><Icon name="scan" size={18} /><div class="v-tcode__b">{children}</div><code>{payload}</code></button></li>);
}
function Tester({ scan, enabled }) {
  const s = getState(); const [tab, setTab] = useState('tickets'); const [f, setF] = useState('valid');
  const user = (id) => sel.user(id)?.name || '—';
  const tickets = s.tickets.filter((t) => !f || t.status === f).slice().reverse();
  const rewards = s.player.rewards.slice().reverse(); const coupons = s.player.coupons.slice().reverse();
  const tone = { valid: 'green', used: 'neutral', refunded: 'danger' }; const stl = { valid: 'ważny', used: 'wykorzystany', refunded: 'zwrócony' };
  return (<aside class="v-tester" aria-label="Panel testera">
    <div class="v-tester__head"><Tag tone="warn" icon="wrench">Pomoc wersji testowej</Tag><h2>Panel testera</h2>
      <p class="v-muted v-small">Aktualne kody ze wspólnego stanu systemu. Kliknięcie = „zeskanuj ten kod” na urządzeniu obok. Bilety kupione w aplikacji lub na stronie WWW pojawiają się tu od razu.</p>
      {!enabled && <Notice tone="warn">Najpierw zaloguj się na urządzeniu bileterskim.</Notice>}</div>
    <Tabs value={tab} onChange={setTab} tabs={[{ id: 'tickets', label: 'Bilety', badge: s.tickets.filter((t) => t.status === 'valid').length }, { id: 'rewards', label: 'Nagrody', badge: rewards.filter((r) => r.status !== 'collected').length }, { id: 'coupons', label: 'Kupony', badge: coupons.filter((c) => !c.used).length }, { id: 'history', label: 'Historia walidacji' }]} />
    {tab === 'tickets' && <>
      <Chips options={[{ id: 'valid', label: 'Ważne' }, { id: 'used', label: 'Wykorzystane' }, { id: 'refunded', label: 'Zwrócone' }, { id: '', label: 'Wszystkie' }]} value={f} onChange={setF} />
      {tickets.length ? <ul class="v-tlist">{tickets.map((t) => { const e = t.eventId && sel.event(t.eventId); return (<CodeItem enabled={enabled} scan={scan} key={t.id} payload={sel.ticketPayload(t)}>
        <b>{t.productName.pl}</b><span>{e ? `${e.title.pl} · ${fmtDay(e.start)} ${fmtTime(e.start)}` : 'wstęp / strefa'}</span><span><Icon name="user" size={12} /> {user(t.userId)} <Tag tone={tone[t.status]}>{stl[t.status]}</Tag>{t.usedAt && <small> {fmtTime(t.usedAt)} · {t.gate}</small>}</span></CodeItem>); })}</ul>
        : <Empty icon="ticket" title="Brak biletów" text="Kup bilet w aplikacji mobilnej lub na stronie WWW – pojawi się tutaj." />}
    </>}
    {tab === 'rewards' && (rewards.length ? <ul class="v-tlist">{rewards.map((r) => { const rw = s.rewards.find((x) => x.id === r.rewardId); return (<CodeItem enabled={enabled} scan={scan} key={r.code} payload={`FPZ:N:${r.code}`}><b>{rw?.name.pl || r.rewardId}</b><span>{fmtDateTime(r.at)} <Tag tone={r.status === 'collected' ? 'neutral' : 'green'}>{r.status === 'collected' ? 'odebrana' : 'do odbioru'}</Tag></span></CodeItem>); })}</ul>
      : <Empty icon="gift" title="Brak nagród do odbioru" text="Zdobądź punkty w grze terenowej i wymień je na nagrodę w aplikacji." />)}
    {tab === 'coupons' && (coupons.length ? <ul class="v-tlist">{coupons.map((c) => { const cp = s.coupons.find((x) => x.id === c.couponId); return (<CodeItem enabled={enabled} scan={scan} key={c.code} payload={`FPZ:K:${c.code}`}><b>{cp?.title.pl || c.couponId}</b><span>{cp?.discount?.pl || ''} <Tag tone={c.used ? 'neutral' : 'green'}>{c.used ? 'wykorzystany' : 'aktywny'}</Tag></span></CodeItem>); })}</ul>
      : <Empty icon="coupon" title="Brak kuponów" text="Kupony odbiera się w grze terenowej w aplikacji." />)}
    {tab === 'history' && (s.stats.validations.length ? <table class="v-hist"><thead><tr><th>Czas</th><th>Kod</th><th>Wynik</th><th>Wejście</th></tr></thead><tbody>{s.stats.validations.map((v, i) => (
      <tr key={i} class={v.ok ? 'is-ok' : 'is-bad'}><td>{fmtTime(v.at)}</td><td><code>{v.code}</code><small>{v.label}</small></td><td>{v.ok ? <Tag tone="green" icon="check">przyjęto</Tag> : <Tag tone="danger" icon="close">{REASONS[v.reason] || v.reason}</Tag>}</td><td>{v.gate}<small>{sel.staff(v.staffId)?.login || ''}</small></td></tr>))}</tbody></table>
      : <Empty icon="history" title="Brak walidacji" />)}
    <div class="v-tester__quick"><span class="v-muted v-small">Szybkie testy:</span>
      <button type="button" class="v-pill" disabled={!enabled} onClick={() => scan('FPZ:T:NIEMA0000X')} data-testid="v-unknown">Kod nieznany</button>
      <button type="button" class="v-pill" disabled={!enabled} onClick={() => scan('FPZ:N:BRAKKODU')}>Nagroda – zły kod</button></div>
    <Notice icon="wifiOff">Tryb offline bileterki: lista biletów jest przechowywana w pamięci urządzenia i synchronizowana co minutę, więc walidacja działa także przy chwilowym braku sieci (w prototypie – informacja).</Notice>
  </aside>);
}
