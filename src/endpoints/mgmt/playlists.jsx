// Treści i playlisty: dynamiczne listy odtwarzania dla ekranów, projekcji i wygaszaczy kiosków.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { nowIso, uid, ago } from '../../kernel/util.js';
import { Icon, Button, Tag, Notice, Empty, Select, Field, Input, Modal } from '../../ui/components.jsx';
import { ILLUSTRATION_IDS } from '../../ui/illustrations.jsx';
import { mediaItem, mediaRef, isMediaRef, itemIssue, uploadMedia, videoWarnings, ceilSec, MEDIA_ACCEPT } from '../../kernel/media.js';
import { VideoTechTags } from '../../ui/media.jsx';

/** Film z prawdziwym plikiem (pole src rekordu videos) – na ekranie odtwarzany cały, więc czas pozycji = długość filmu. */
const hasFile = (v) => !!(v?.src && mediaItem(v.src)) && v.kind !== 'live';
const videoDur = (v) => (hasFile(v) && (v.durationSec || fileDur(mediaItem(v.src)))) || 20;
/** Długość pliku z biblioteki w pełnych sekundach (w górę – pozycja obejmuje cały klip). */
const fileDur = (m) => ceilSec(m?.durationExact) || m?.durationSec || null;
/** Obraz pozycji: zdjęcie z biblioteki mediów („media:<id>”) albo ilustracja systemowa. */
/** Film pozycji: plik wideo prosto z biblioteki mediów („media:<id>”) albo rekord filmu z CMS (z plikiem lub symulowany). */
const libVideos = (s) => s.media.filter((m) => m.type === 'video');
const videoOpts = (s) => [...libVideos(s).map((m) => ({ id: mediaRef(m.id), label: `Plik z biblioteki: ${m.name}${m.durationSec ? ' (' + m.durationSec + ' s)' : ''}` })), ...s.videos.map((v) => ({ id: v.id, label: `Film: ${v.title.pl}${v.kind === 'archive' ? ' (archiwalny)' : v.kind === 'live' ? ' (transmisja na żywo)' : ''}${v.kind === 'live' ? '' : hasFile(v) ? ' · plik wideo' : ' · symulacja'}` }))];
const videoPatch = (s, ref, it) => { if (isMediaRef(ref)) { const m = mediaItem(ref); return { ref, title: m?.alt?.pl || m?.name || it?.title || 'Film', ...(fileDur(m) ? { durationSec: fileDur(m) } : {}) }; } const v = s.videos.find((x) => x.id === ref); return { ref: v?.id, title: v?.title.pl || it?.title || 'Film', ...(hasFile(v) ? { durationSec: videoDur(v) } : {}) }; };
const imageOpts = (s) => [...s.media.filter((m) => m.type === 'image').map((m) => ({ id: mediaRef(m.id), label: 'Zdjęcie: ' + m.name })), ...ILLUSTRATION_IDS.map((x) => ({ id: x, label: 'Ilustracja: ' + x }))];
import { useX, useTick, ITEM_TYPES, KINDS, PowerBadge, Head, Panel, zoneName, DISPLAY_KINDS } from './common.jsx';
const ISSUE = { film: 'film usunięty', file: 'plik usunięty' };
/** Podgląd ekranu w nowej karcie: na serwerze /lcd/<id> (kiosk: /kiosk/<id>), w wersji jednoplikowej ?end=… (jak routeHref w shell/standalone.jsx). */
const SERVED = typeof __API_BASE__ !== 'undefined' && __API_BASE__ !== null;
const screenHref = (d) => { const p = (d.kind === 'kiosk' ? 'kiosk/' : 'lcd/') + d.id; return SERVED && typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? `${location.origin}/${p}` : `?end=${encodeURIComponent(p)}`; };
const fileTitle = (name) => String(name || 'Film').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ').trim() || 'Film';
/** „Wgraj film z dysku”: plik → biblioteka mediów (uploadMedia, jak w CMS) → onDone(rekord biblioteki). */
function UploadFilm({ disabled, onDone, testid }) {
  const { api, toast } = useClient(); const [p, setP] = useState(null);
  const pick = async (e) => {
    const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (!f) return;
    setP(0); const r = await uploadMedia(f, { api, onProgress: setP }); setP(null);
    if (!r.ok) { toast(r.message?.pl || 'Nie udało się wgrać pliku.', 'error', 6000); return; }
    onDone(r.item, videoWarnings(r.item));
  };
  return (<label class={`x-upload${disabled || p != null ? ' is-off' : ''}`} data-testid={testid}>
    <input type="file" accept={MEDIA_ACCEPT.video} disabled={disabled || p != null} class="x-sr" onChange={pick} data-testid={testid + '-file'} />
    <Icon name="upload" size={16} /><span>{p != null ? `Wysyłanie… ${Math.round(p * 100)}%` : 'Wgraj film z dysku'}</span>
    {p != null && <span class="x-upload__bar" role="progressbar" aria-label="Wysyłanie filmu" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(p * 100)}><i style={{ width: `${Math.round(p * 100)}%` }} /></span>}
  </label>);
}

const TONES = ['#125930', '#5FB287', '#45574D', '#2E7D5B', '#7FBF9E', '#1B5A86', '#8A6D1F', '#6E5A8A'];

export function Playlists() {
  const s = getState(); const { client, set, api, toast } = useClient(); const { can } = useX(); useTick(1000);
  const cur = s.playlists.find((p) => p.id === client.xPlaylist) || s.playlists[0];
  const [ask, setAsk] = useState(null);
  const create = () => { const r = api.cms.save('playlists', { name: 'Nowa playlista', items: [], updatedAt: nowIso() }); if (r.ok) { set({ xPlaylist: r.item.id }); toast('Utworzono playlistę'); } };
  return (<div>
    <Head title="Treści i playlisty" sub="Dynamiczne listy odtwarzania – zmiana pozycji trafia na urządzenia natychmiast, bez ponownej publikacji całej prezentacji" icon="playlist">
      <Button icon="plus" disabled={!can('playlists')} onClick={create} data-testid="x-pl-new">Nowa playlista</Button>
    </Head>
    <div class="x-split">
      <div class="x-pllist" role="list">
        {s.playlists.map((p) => { const used = s.devices.filter((d) => d.playlistId === p.id); const dur = p.items.reduce((a, i) => a + (+i.durationSec || 0), 0); return (
          <button key={p.id} type="button" role="listitem" class={`x-plcard${p.id === cur?.id ? ' is-active' : ''}`} onClick={() => set({ xPlaylist: p.id })} data-pl={p.id}>
            <b>{p.name}</b><span>{p.items.length} poz. · pętla {dur} s · {used.length} urządz.</span>
            {p.updatedAt && Date.now() - new Date(p.updatedAt).getTime() < 60000 && <Tag tone="green" icon="refresh">zaktualizowano</Tag>}
          </button>); })}
        {!s.playlists.length && <Empty icon="playlist" title="Brak playlist" />}
      </div>
      {cur ? <Editor key={cur.id} pl={cur} onDelete={() => setAsk(cur)} /> : <Empty icon="playlist" title="Wybierz lub utwórz playlistę" />}
    </div>
    <Modal open={!!ask} onClose={() => setAsk(null)} size="sm" title="Usunąć playlistę?" footer={<><Button variant="secondary" onClick={() => setAsk(null)}>Anuluj</Button><Button variant="danger" icon="trash" onClick={() => { s.devices.filter((d) => d.playlistId === ask.id).forEach((d) => api.devices.set(d.id, { playlistId: null })); api.cms.remove('playlists', ask.id); set({ xPlaylist: null }); setAsk(null); toast('Usunięto playlistę'); }}>Usuń</Button></>}>
      <p>„{ask?.name}” zostanie usunięta, a urządzenia, które ją odtwarzają, przejdą na treść domyślną.</p>
    </Modal>
  </div>);
}

function Editor({ pl, onDelete }) {
  const s = getState(); const { api, toast } = useClient(); const { can } = useX(); const ok = can('playlists');
  const [addType, setAddType] = useState('video'); const [flash, setFlash] = useState(null); const listRef = useRef(null);
  const used = s.devices.filter((d) => d.playlistId === pl.id);
  const save = (items, msg, tone) => { const r = api.cms.save('playlists', { id: pl.id, items, updatedAt: nowIso() }); if (!r.ok) { toast(r.message.pl, 'error'); return false; } toast(msg || `Zaktualizowano – zmiana działa od razu na ${used.length} urządz.`, tone); return true; };
  const fresh = () => getState().playlists.find((p) => p.id === pl.id) || pl; // po wgraniu pliku (asynchronicznie) – aktualna lista pozycji
  const whereTxt = () => { const ds = getState().devices.filter((d) => d.playlistId === pl.id); return ds.length ? `zagra na: ${ds.map((d) => d.id).join(', ')}` : 'playlista nie jest przypisana do żadnego ekranu'; };
  const warnTxt = (w) => (w?.length ? ' Uwaga: ' + w.map((x) => x.text).join(' ') : '');
  /** Dodanie pozycji na końcu listy: zapis, potwierdzenie z listą ekranów, przewinięcie i podświetlenie nowego wiersza. */
  const append = (it, warns) => { if (save([...fresh().items, it], `Dodano „${it.title}” – ${whereTxt()}.${warnTxt(warns)}`, warns?.length ? 'warn' : 'ok')) setFlash(it.id); };
  useEffect(() => {
    if (!flash) return undefined; const el = listRef.current?.querySelector(`[data-item-id="${flash}"]`);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true }); }
    const t = setTimeout(() => setFlash(null), 2600); return () => clearTimeout(t);
  }, [flash]);
  const fromUpload = (m) => ({ ref: mediaRef(m.id), title: fileTitle(m.name), ...(fileDur(m) ? { durationSec: fileDur(m) } : {}) });
  const uploadedTo = (id) => (m, warns) => { const items = fresh().items; const k = items.findIndex((x) => x.id === id); if (k < 0) return; save(items.map((x, j) => (j === k ? { ...x, ...fromUpload(m) } : x)), `Wgrano „${m.name}” do biblioteki i ustawiono w pozycji ${k + 1} – ${whereTxt()}.${warnTxt(warns)}`, warns.length ? 'warn' : 'ok'); setFlash(id); };
  const uploadedNew = (m, warns) => append({ id: uid('pi'), type: 'video', ...fromUpload(m) }, warns);
  const issues = pl.items.filter((it) => itemIssue(s, it)).length; const caps = pl.items.some((it) => it.type === 'captions');
  const patch = (i, p) => save(pl.items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i, dir) => { const a = pl.items.slice(); const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(a); };
  const add = () => {
    const base = { id: uid('pi'), type: addType, title: ITEM_TYPES[addType].label, durationSec: ['ticker', 'captions'].includes(addType) ? 0 : 10 };
    if (addType === 'video') { const m = libVideos(s).slice(-1)[0]; const v = s.videos.find(hasFile) || s.videos.find((x) => x.kind !== 'live') || s.videos[0]; Object.assign(base, { durationSec: 20 }, m ? videoPatch(s, mediaRef(m.id)) : { ref: v?.id, title: v?.title.pl || 'Film', durationSec: videoDur(v) }); } // najnowszy plik z biblioteki, a gdy jej nie ma – film z CMS
    if (addType === 'image') { const m = s.media.filter((x) => x.type === 'image').slice(-1)[0]; Object.assign(base, m ? { ref: mediaRef(m.id), title: m.alt?.pl || m.name } : { ref: ILLUSTRATION_IDS[0], title: 'Ilustracja' }); }
    if (addType === 'ticker') base.text = 'Nowy komunikat paska informacyjnego';
    if (addType === 'rss') Object.assign(base, { url: 'https://www.dabrowa-gornicza.pl/rss', title: 'Kanał RSS – aktualności miasta' });
    if (addType === 'stream') Object.assign(base, { url: 'rtmp://studio.fpz.local/live', title: 'Transmisja ze studia', durationSec: 60 });
    append(base);
  };
  const timed = pl.items.filter((i) => +i.durationSec > 0); const total = timed.reduce((a, i) => a + +i.durationSec, 0);
  const overlays = pl.items.filter((i) => !(+i.durationSec > 0));
  const displays = s.devices.filter((d) => DISPLAY_KINDS.includes(d.kind));
  const assign = (d, on) => { api.devices.set(d.id, { playlistId: on ? pl.id : null }); toast(on ? `Przypisano do: ${d.name}` : `Odłączono od: ${d.name}`); };
  const assignZone = (z) => { const ds = displays.filter((d) => d.zone === z && d.kind !== 'kiosk'); ds.forEach((d) => api.devices.set(d.id, { playlistId: pl.id })); toast(ds.length ? `Przypisano do ${ds.length} ekranów w strefie ${zoneName(z)}` : 'Brak ekranów w tej strefie', ds.length ? 'ok' : 'warn'); };
  return (<div class="x-pled">
    <Panel title="Edycja playlisty" icon="edit" actions={<>{issues > 0 && <Tag tone="danger" icon="alert">{issues === 1 ? '1 pozycja pomijana' : `${issues} poz. pomijane`}</Tag>}{pl.updatedAt && <Tag tone={Date.now() - new Date(pl.updatedAt).getTime() < 60000 ? 'green' : 'neutral'} icon="refresh">zaktualizowano {ago(pl.updatedAt)}</Tag>}<Button size="sm" variant="ghost" icon="trash" disabled={!ok} onClick={onDelete}>Usuń</Button></>}>
      {caps && s.live.onAir && <Notice tone="danger" icon="captions" class="x-pl-live">Trwa transmisja na żywo: ekrany z tą playlistą pokazują teraz wyłącznie napisy.</Notice>}
      <div class="x-plwhere" data-testid="x-pl-where">{used.length ? <><span class="x-lbl">Odtwarzają ją teraz:</span>{used.map((d) => <a key={d.id} class="x-pill x-pill--link" href={screenHref(d)} target="_blank" rel="noopener" data-screen={d.id} title="Podgląd ekranu w nowej karcie"><b>{d.id}</b> {d.name}<Icon name="external" size={13} /></a>)}</>
        : <span class="x-plwhere__none"><Icon name="alert" size={15} /> Ta playlista nie jest przypisana do żadnego ekranu – przypisz ją niżej.</span>}</div>
      {issues > 0 && <Notice tone="warn" icon="alert" class="x-pl-issues">{issues === 1 ? 'Jedna pozycja wskazuje' : `${issues} pozycje wskazują`} usunięty film lub plik – ekrany ją pomijają. Wybierz inny film albo usuń pozycję.</Notice>}
      <Field label="Nazwa"><Input value={pl.name} disabled={!ok} onChange={(e) => { api.cms.save('playlists', { id: pl.id, name: e.currentTarget.value, updatedAt: nowIso() }); }} /></Field>
      <div class="x-loop" aria-label="Oś czasu pętli">
        <div class="x-loop__bar">{timed.map((it, k) => <span key={it.id} style={{ flexGrow: +it.durationSec, background: TONES[k % TONES.length] }} title={`${it.title} – ${it.durationSec} s`}><Icon name={ITEM_TYPES[it.type]?.icon} size={14} /><em>{it.durationSec}s</em></span>)}{!timed.length && <span class="x-loop__empty">Pusta pętla</span>}</div>
        <div class="x-loop__meta"><span>Pętla: <b>{total} s</b></span>{overlays.map((o) => <Tag key={o.id} tone="info" icon={ITEM_TYPES[o.type]?.icon}>stale: {o.title}</Tag>)}</div>
      </div>
      <ol class="x-items" ref={listRef}>{pl.items.map((it, i) => { const bad = itemIssue(s, it); return (<li key={it.id} class={`x-item${bad ? ' is-bad' : ''}${flash === it.id ? ' is-new' : ''}`} data-item={i} data-item-id={it.id} data-issue={bad || undefined} tabIndex={-1}>
        <span class="x-item__no">{i + 1}</span>
        <span class="x-item__ic"><Icon name={ITEM_TYPES[it.type]?.icon} size={18} /></span>
        <div class="x-item__main">
          <div class="x-item__row">
            <Select value={it.type} disabled={!ok} aria-label="Rodzaj pozycji" onChange={(e) => patch(i, { type: e.currentTarget.value })} options={Object.entries(ITEM_TYPES).map(([k, v]) => ({ id: k, label: v.label }))} />
            <Input value={it.title} disabled={!ok} aria-label="Tytuł pozycji" onChange={(e) => patch(i, { title: e.currentTarget.value })} />
          </div>
          {it.type === 'video' && <div class="x-item__row"><Select value={bad ? '' : it.ref || ''} disabled={!ok} aria-label="Film" onChange={(e) => patch(i, videoPatch(s, e.currentTarget.value, it))} options={bad ? [{ id: '', label: '— wybierz film —' }, ...videoOpts(s)] : videoOpts(s)} />
            {bad ? <Tag tone="danger" icon="alert">{ISSUE[bad]}</Tag> : isMediaRef(it.ref) ? <Tag tone="green" icon="film">plik wideo</Tag> : s.videos.find((v) => v.id === it.ref)?.kind === 'live' ? <Tag tone="live">na żywo</Tag> : hasFile(s.videos.find((v) => v.id === it.ref)) ? <Tag tone="green" icon="film">plik wideo</Tag> : <Tag tone="warn">symulacja</Tag>}</div>}
          {it.type === 'video' && <div class="x-item__tech">{!bad && <VideoTechTags m={isMediaRef(it.ref) ? mediaItem(it.ref) : mediaItem(s.videos.find((v) => v.id === it.ref && v.kind !== 'live')?.src)} hint />}<UploadFilm disabled={!ok} onDone={uploadedTo(it.id)} testid={`x-item-upload-${i}`} /></div>}
          {it.type === 'image' && <div class="x-item__row"><Select value={it.ref || ''} disabled={!ok} aria-label="Obraz" onChange={(e) => { const ref = e.currentTarget.value; const m = isMediaRef(ref) && mediaItem(ref); patch(i, { ref, ...(m && /^(Ilustracja|Obraz)$/.test(it.title) ? { title: m.alt?.pl || m.name } : {}) }); }} options={imageOpts(s)} />
            {isMediaRef(it.ref) ? (mediaItem(it.ref) ? <Tag tone="green" icon="image">zdjęcie</Tag> : <Tag tone="danger" icon="alert">plik usunięty</Tag>) : null}</div>}
          {bad && <small class="x-item__bad">Ekrany pomijają tę pozycję – wybierz inny film albo ją usuń.</small>}
          {it.type === 'ticker' && <Input value={it.text || ''} disabled={!ok} aria-label="Tekst paska" placeholder="Tekst paska informacyjnego" onChange={(e) => patch(i, { text: e.currentTarget.value })} />}
          {(it.type === 'rss' || it.type === 'stream') && <div class="x-item__row"><Input value={it.url || ''} disabled={!ok} aria-label="Adres" placeholder={it.type === 'rss' ? 'Adres kanału RSS' : 'Adres strumienia'} onChange={(e) => patch(i, { url: e.currentTarget.value })} /><Tag tone="warn">symulowane</Tag></div>}
          {it.type === 'captions' && <small class="x-muted">Wyświetla napisy z konsoli respeakera (sekcja „Transmisje i napisy”).</small>}
          {it.type === 'captions' && <small class="x-item__hint" data-testid="x-caps-hint"><Icon name="info" size={14} /> W czasie transmisji na żywo ekran pokazuje tylko napisy – pozostałe pozycje wracają po jej zakończeniu.</small>}
          {it.type === 'events' && <small class="x-muted">Lista najbliższych wydarzeń pobierana na żywo z systemu rezerwacji.</small>}
        </div>
        <label class="x-item__dur"><Input type="number" min="0" max="600" value={it.durationSec} disabled={!ok} aria-label="Czas trwania (s)" onChange={(e) => patch(i, { durationSec: Math.max(0, +e.currentTarget.value || 0) })} /><span>s</span></label>
        <div class="x-item__act">
          <button type="button" class="x-iconbtn" aria-label="W górę" disabled={!ok || i === 0} onClick={() => move(i, -1)} data-testid="x-item-up"><Icon name="up" size={16} /></button>
          <button type="button" class="x-iconbtn" aria-label="W dół" disabled={!ok || i === pl.items.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={16} /></button>
          <button type="button" class="x-iconbtn x-iconbtn--danger" aria-label="Usuń pozycję" disabled={!ok} onClick={() => save(pl.items.filter((_, k) => k !== i), 'Usunięto pozycję')}><Icon name="trash" size={16} /></button>
        </div>
      </li>); })}</ol>
      {!pl.items.length && <Empty icon="playlist" title="Playlista jest pusta" text="Dodaj filmy, obrazy, pasek informacyjny, napisy na żywo, kanał RSS lub strumień." />}
      <div class="x-additem"><Select value={addType} disabled={!ok} aria-label="Rodzaj nowej pozycji" onChange={(e) => setAddType(e.currentTarget.value)} options={Object.entries(ITEM_TYPES).map(([k, v]) => ({ id: k, label: v.label }))} /><Button icon="plus" variant="mint" disabled={!ok} onClick={add} data-testid="x-item-add">Dodaj pozycję</Button>
        {addType === 'video' && <UploadFilm disabled={!ok} onDone={uploadedNew} testid="x-add-upload" />}</div>
      <Notice icon="zap">Lista dynamiczna: każda zmiana pozycji jest zapisywana i rozsyłana do odtwarzaczy natychmiast – bez ponownej publikacji całej prezentacji.</Notice>
    </Panel>
    <Panel title="Przypisanie do urządzeń i stref" icon="layers">
      <div class="x-zonebtns"><span class="x-lbl">Cała strefa (ekrany i projekcja):</span>{s.zones.filter((z) => displays.some((d) => d.zone === z.id && d.kind !== 'kiosk')).map((z) => <button key={z.id} type="button" class="x-pill" disabled={!ok} onClick={() => assignZone(z.id)}>{z.name}</button>)}</div>
      <ul class="x-assign">{displays.map((d) => { const on = d.playlistId === pl.id; const other = !on && d.playlistId && s.playlists.find((p) => p.id === d.playlistId); return (
        <li key={d.id}><label class="x-check"><input type="checkbox" checked={on} disabled={!ok} onChange={(e) => assign(d, e.currentTarget.checked)} data-assign={d.id} />
          <Icon name={KINDS[d.kind]?.icon} size={16} /><span class="x-grow"><b>{d.name}</b><small class="x-muted"> · {zoneName(d.zone)}{d.kind === 'kiosk' ? ' · jako wygaszacz' : ''}{other ? ` · teraz: ${other.name}` : ''}</small></span><PowerBadge power={d.power} /></label></li>); })}</ul>
    </Panel>
  </div>);
}
