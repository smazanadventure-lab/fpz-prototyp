// Treści i playlisty: dynamiczne listy odtwarzania dla ekranów, projekcji i wygaszaczy kiosków.
import { useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { nowIso, uid, ago } from '../../kernel/util.js';
import { Icon, Button, Tag, Notice, Empty, Select, Field, Input, Modal } from '../../ui/components.jsx';
import { ILLUSTRATION_IDS } from '../../ui/illustrations.jsx';
import { mediaItem, mediaRef, isMediaRef } from '../../kernel/media.js';

/** Film z prawdziwym plikiem (pole src rekordu videos) – na ekranie odtwarzany cały, więc czas pozycji = długość filmu. */
const hasFile = (v) => !!(v?.src && mediaItem(v.src)) && v.kind !== 'live';
const videoDur = (v) => (hasFile(v) && (v.durationSec || mediaItem(v.src)?.durationSec)) || 20;
/** Obraz pozycji: zdjęcie z biblioteki mediów („media:<id>”) albo ilustracja systemowa. */
const imageOpts = (s) => [...s.media.filter((m) => m.type === 'image').map((m) => ({ id: mediaRef(m.id), label: 'Zdjęcie: ' + m.name })), ...ILLUSTRATION_IDS.map((x) => ({ id: x, label: 'Ilustracja: ' + x }))];
import { useX, useTick, ITEM_TYPES, KINDS, PowerBadge, Head, Panel, zoneName, DISPLAY_KINDS } from './common.jsx';

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
  const [addType, setAddType] = useState('video');
  const used = s.devices.filter((d) => d.playlistId === pl.id);
  const save = (items, msg) => { const r = api.cms.save('playlists', { id: pl.id, items, updatedAt: nowIso() }); if (!r.ok) return toast(r.message.pl, 'error'); toast(msg || `Zaktualizowano – zmiana działa od razu na ${used.length} urządz.`); };
  const patch = (i, p) => save(pl.items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i, dir) => { const a = pl.items.slice(); const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(a); };
  const add = () => {
    const base = { id: uid('pi'), type: addType, title: ITEM_TYPES[addType].label, durationSec: ['ticker', 'captions'].includes(addType) ? 0 : 10 };
    if (addType === 'video') { const v = s.videos.find(hasFile) || s.videos[0]; Object.assign(base, { ref: v?.id, title: v?.title.pl || 'Film', durationSec: videoDur(v) }); }
    if (addType === 'image') { const m = s.media.filter((x) => x.type === 'image').slice(-1)[0]; Object.assign(base, m ? { ref: mediaRef(m.id), title: m.alt?.pl || m.name } : { ref: ILLUSTRATION_IDS[0], title: 'Ilustracja' }); }
    if (addType === 'ticker') base.text = 'Nowy komunikat paska informacyjnego';
    if (addType === 'rss') Object.assign(base, { url: 'https://www.dabrowa-gornicza.pl/rss', title: 'Kanał RSS – aktualności miasta' });
    if (addType === 'stream') Object.assign(base, { url: 'rtmp://studio.fpz.local/live', title: 'Transmisja ze studia', durationSec: 60 });
    save([...pl.items, base], 'Dodano pozycję – urządzenia odświeżą listę bez ponownej publikacji');
  };
  const timed = pl.items.filter((i) => +i.durationSec > 0); const total = timed.reduce((a, i) => a + +i.durationSec, 0);
  const overlays = pl.items.filter((i) => !(+i.durationSec > 0));
  const displays = s.devices.filter((d) => DISPLAY_KINDS.includes(d.kind));
  const assign = (d, on) => { api.devices.set(d.id, { playlistId: on ? pl.id : null }); toast(on ? `Przypisano do: ${d.name}` : `Odłączono od: ${d.name}`); };
  const assignZone = (z) => { const ds = displays.filter((d) => d.zone === z && d.kind !== 'kiosk'); ds.forEach((d) => api.devices.set(d.id, { playlistId: pl.id })); toast(ds.length ? `Przypisano do ${ds.length} ekranów w strefie ${zoneName(z)}` : 'Brak ekranów w tej strefie', ds.length ? 'ok' : 'warn'); };
  return (<div class="x-pled">
    <Panel title="Edycja playlisty" icon="edit" actions={<>{pl.updatedAt && <Tag tone={Date.now() - new Date(pl.updatedAt).getTime() < 60000 ? 'green' : 'neutral'} icon="refresh">zaktualizowano {ago(pl.updatedAt)}</Tag>}<Button size="sm" variant="ghost" icon="trash" disabled={!ok} onClick={onDelete}>Usuń</Button></>}>
      <Field label="Nazwa"><Input value={pl.name} disabled={!ok} onChange={(e) => { api.cms.save('playlists', { id: pl.id, name: e.currentTarget.value, updatedAt: nowIso() }); }} /></Field>
      <div class="x-loop" aria-label="Oś czasu pętli">
        <div class="x-loop__bar">{timed.map((it, k) => <span key={it.id} style={{ flexGrow: +it.durationSec, background: TONES[k % TONES.length] }} title={`${it.title} – ${it.durationSec} s`}><Icon name={ITEM_TYPES[it.type]?.icon} size={14} /><em>{it.durationSec}s</em></span>)}{!timed.length && <span class="x-loop__empty">Pusta pętla</span>}</div>
        <div class="x-loop__meta"><span>Pętla: <b>{total} s</b></span>{overlays.map((o) => <Tag key={o.id} tone="info" icon={ITEM_TYPES[o.type]?.icon}>stale: {o.title}</Tag>)}</div>
      </div>
      <ol class="x-items">{pl.items.map((it, i) => (<li key={it.id} class="x-item" data-item={i}>
        <span class="x-item__no">{i + 1}</span>
        <span class="x-item__ic"><Icon name={ITEM_TYPES[it.type]?.icon} size={18} /></span>
        <div class="x-item__main">
          <div class="x-item__row">
            <Select value={it.type} disabled={!ok} aria-label="Rodzaj pozycji" onChange={(e) => patch(i, { type: e.currentTarget.value })} options={Object.entries(ITEM_TYPES).map(([k, v]) => ({ id: k, label: v.label }))} />
            <Input value={it.title} disabled={!ok} aria-label="Tytuł pozycji" onChange={(e) => patch(i, { title: e.currentTarget.value })} />
          </div>
          {it.type === 'video' && <div class="x-item__row"><Select value={it.ref || ''} disabled={!ok} aria-label="Film" onChange={(e) => { const v = s.videos.find((x) => x.id === e.currentTarget.value); patch(i, { ref: v?.id, title: v?.title.pl || it.title, ...(hasFile(v) ? { durationSec: videoDur(v) } : {}) }); }} options={s.videos.map((v) => ({ id: v.id, label: `${v.title.pl}${v.kind === 'archive' ? ' (archiwalny)' : ''}${hasFile(v) ? ' · plik wideo' : ' · symulacja'}` }))} />
            {hasFile(s.videos.find((v) => v.id === it.ref)) ? <Tag tone="green" icon="film">plik wideo</Tag> : <Tag tone="warn">symulacja</Tag>}</div>}
          {it.type === 'image' && <div class="x-item__row"><Select value={it.ref || ''} disabled={!ok} aria-label="Obraz" onChange={(e) => { const ref = e.currentTarget.value; const m = isMediaRef(ref) && mediaItem(ref); patch(i, { ref, ...(m && /^(Ilustracja|Obraz)$/.test(it.title) ? { title: m.alt?.pl || m.name } : {}) }); }} options={imageOpts(s)} />
            {isMediaRef(it.ref) ? (mediaItem(it.ref) ? <Tag tone="green" icon="image">zdjęcie</Tag> : <Tag tone="warn">plik usunięty</Tag>) : null}</div>}
          {it.type === 'ticker' && <Input value={it.text || ''} disabled={!ok} aria-label="Tekst paska" placeholder="Tekst paska informacyjnego" onChange={(e) => patch(i, { text: e.currentTarget.value })} />}
          {(it.type === 'rss' || it.type === 'stream') && <div class="x-item__row"><Input value={it.url || ''} disabled={!ok} aria-label="Adres" placeholder={it.type === 'rss' ? 'Adres kanału RSS' : 'Adres strumienia'} onChange={(e) => patch(i, { url: e.currentTarget.value })} /><Tag tone="warn">symulowane</Tag></div>}
          {it.type === 'captions' && <small class="x-muted">Wyświetla napisy z konsoli respeakera (sekcja „Transmisje i napisy”).</small>}
          {it.type === 'events' && <small class="x-muted">Lista najbliższych wydarzeń pobierana na żywo z systemu rezerwacji.</small>}
        </div>
        <label class="x-item__dur"><Input type="number" min="0" max="600" value={it.durationSec} disabled={!ok} aria-label="Czas trwania (s)" onChange={(e) => patch(i, { durationSec: Math.max(0, +e.currentTarget.value || 0) })} /><span>s</span></label>
        <div class="x-item__act">
          <button type="button" class="x-iconbtn" aria-label="W górę" disabled={!ok || i === 0} onClick={() => move(i, -1)} data-testid="x-item-up"><Icon name="up" size={16} /></button>
          <button type="button" class="x-iconbtn" aria-label="W dół" disabled={!ok || i === pl.items.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={16} /></button>
          <button type="button" class="x-iconbtn x-iconbtn--danger" aria-label="Usuń pozycję" disabled={!ok} onClick={() => save(pl.items.filter((_, k) => k !== i), 'Usunięto pozycję')}><Icon name="trash" size={16} /></button>
        </div>
      </li>))}</ol>
      {!pl.items.length && <Empty icon="playlist" title="Playlista jest pusta" text="Dodaj filmy, obrazy, pasek informacyjny, napisy na żywo, kanał RSS lub strumień." />}
      <div class="x-additem"><Select value={addType} disabled={!ok} aria-label="Rodzaj nowej pozycji" onChange={(e) => setAddType(e.currentTarget.value)} options={Object.entries(ITEM_TYPES).map(([k, v]) => ({ id: k, label: v.label }))} /><Button icon="plus" variant="mint" disabled={!ok} onClick={add} data-testid="x-item-add">Dodaj pozycję</Button></div>
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
