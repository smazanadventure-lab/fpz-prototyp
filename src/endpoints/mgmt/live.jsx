// Transmisje i napisy na żywo (respeaking) + dziennik połączeń z tłumaczem PJM.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { getState } from '../../kernel/store.js';
import { fmtTime, fmtDateTime, fmtDuration } from '../../kernel/util.js';
import { Icon, Button, Tag, Notice, Empty, Input, LiveCaptions, Field, QR } from '../../ui/components.jsx';
import { routeHref } from '../../shell/standalone.jsx';
import { LiveVideo } from '../../ui/live.jsx';
import { useX, useTick, Head, Panel } from './common.jsx';

const SAMPLE = [
  'Dobry wieczór, witamy w Hali Tworzeń w Fabryce Pełnej Życia.',
  'Za chwilę rozpoczniemy koncert młodych muzyków z Dąbrowy Górniczej.',
  'Przypominamy, że napisy wyświetlane są także w aplikacji mobilnej.',
  'Pierwszy utwór nawiązuje do historii hal fabrycznych.',
  'Prosimy o wyciszenie telefonów. Życzymy miłego wieczoru!',
];

export function Live() {
  const s = getState(); const { api, toast } = useClient(); const { can } = useX(); useTick(1000);
  const ok = can('playlists'); const live = s.live;
  const [title, setTitle] = useState(live.title?.pl || ''); const [line, setLine] = useState(''); const [playing, setPlaying] = useState(false);
  const timer = useRef(null); const inp = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);
  const send = (t) => { const r = api.live.caption(t); if (!r.ok) toast(r.message.pl, 'error'); };
  const play = () => {
    if (playing) { clearInterval(timer.current); setPlaying(false); return; }
    const lines = (s.videos.find((v) => v.kind === 'live')?.captions || []).map((c) => c.text.pl); const list = lines.length >= 3 ? lines : SAMPLE;
    let i = 0; send(list[i++]); setPlaying(true);
    timer.current = setInterval(() => { if (i >= list.length) { clearInterval(timer.current); setPlaying(false); return; } send(list[i++]); }, 2500);
  };
  const lcd = s.devices.filter((d) => s.playlists.find((p) => p.id === d.playlistId)?.items.some((it) => it.type === 'captions'));
  const dur = live.onAir && live.startedAt ? (Date.now() - new Date(live.startedAt).getTime()) / 1000 : 0;
  const cam = live.onAir && !!live.streamId; // obraz z kamery telefonu (strona /nadawanie); bez streamId – symulacja
  return (<div>
    <Head title="Transmisje i napisy na żywo" sub="Symultaniczny przekaz tekstowy (respeaking) na ekranach LCD, w aplikacji i na stronie WWW" icon="captions" />
    <div class="x-grid2 x-grid2--live">
      <Panel title="Transmisja" icon="video" actions={live.onAir ? <Tag tone="live">Na żywo</Tag> : <Tag>poza anteną</Tag>}>
        <Field label="Tytuł transmisji"><Input value={live.onAir ? live.title?.pl || '' : title} disabled={!ok || live.onAir} onInput={(e) => setTitle(e.currentTarget.value)} data-testid="x-live-title" /></Field>
        {live.onAir && <p class="x-live__src" data-testid="x-live-source" data-source={cam ? 'camera' : 'studio'}><Icon name={cam ? 'smartphone' : 'video'} size={16} />Źródło obrazu: <b>{cam ? 'kamera telefonu' : 'symulacja'}</b>{cam && <span class="x-muted"> · obraz WebRTC prosto z telefonu, do 6 odbiorników</span>}</p>}
        <div class="x-live__stats">
          <div><span class="x-lbl">{cam ? 'Odbiorniki obrazu' : 'Widzowie on-line'}</span><b data-testid="x-viewers">{live.onAir ? live.viewers : 0}{cam && <small> / 6</small>}</b></div>
          <div><span class="x-lbl">Czas trwania</span><b>{fmtDuration(dur)}</b></div>
          <div><span class="x-lbl">Linie napisów</span><b>{live.captions.length}</b></div>
        </div>
        {live.onAir
          ? <Button variant="danger" size="lg" icon="stop" block disabled={!ok} onClick={() => { api.live.stop(); clearInterval(timer.current); setPlaying(false); toast(cam ? 'Zakończono transmisję – telefon nadawcy wyłączy kamerę' : 'Zakończono transmisję', 'info'); }} data-testid="x-live-stop">Zakończ transmisję</Button>
          : <Button size="lg" icon="play" block disabled={!ok} onClick={() => { api.live.start(title.trim() || undefined); toast('Transmisja rozpoczęta – powiadomienie push wysłane'); setTimeout(() => inp.current?.focus(), 50); }} data-testid="x-live-start">Rozpocznij transmisję (symulacja)</Button>}
        <p class="x-muted x-small">Napisy trafiają na ekrany z pozycją „Napisy na żywo” w playliście ({lcd.map((d) => d.id).join(', ') || 'brak'}), do aplikacji mobilnej i na stronę WWW. Obraz: symulacja – albo prawdziwy obraz z kamery telefonu (karta „Nadawaj z telefonu”).</p>
      </Panel>
      <Panel title="Podgląd ekranu napisów" icon="tv">
        <div class={`x-lcdprev${cam ? ' x-lcdprev--cam' : ''}`} data-testid="x-lcdprev" data-cam={cam ? 'yes' : 'no'}>
          <div class="x-lcdprev__top">{live.onAir ? <Tag tone="live">Na żywo</Tag> : <Tag>offline</Tag>}<b>{live.title?.pl}</b></div>
          {/* prawdziwy obraz z telefonu (ten sam odbiornik co na ekranach); odbiór tylko, dopóki ta zakładka jest otwarta */}
          {cam && <LiveVideo key={live.streamId} streamId={live.streamId} chromeless muted showTitle={false} showCaptions={false} showViewers={false} ratio={null} class="x-lcdprev__video" fallback={<div class="x-lcdprev__ended">Nadawca rozłączony – czekam na obraz…</div>} />}
          <LiveCaptions lines={cam ? 2 : 3} class="x-lcdprev__caps" />
        </div>
        {cam && <p class="x-muted x-small x-lcdprev__note" data-testid="x-lcdprev-note"><Icon name="info" size={13} /> Podgląd liczy się jako jeden z 6 odbiorców, dopóki ta zakładka jest otwarta.</p>}
      </Panel>
    </div>
    <PhoneCard />
    <Panel title="Konsola respeakera" icon="mic" actions={<><Button size="sm" variant={playing ? 'danger' : 'mint'} icon={playing ? 'stop' : 'play'} disabled={!ok} onClick={play} data-testid="x-live-sample">{playing ? 'Zatrzymaj przebieg' : 'Odtwórz przykładowy przebieg'}</Button><Button size="sm" variant="secondary" icon="trash" disabled={!ok || !live.captions.length} onClick={() => { api.live.clear(); toast('Wyczyszczono napisy', 'info'); }}>Wyczyść</Button></>}>
      {!live.onAir && <Notice tone="warn">Transmisja nie jest uruchomiona – napisy pojawią się na ekranach, ale widzowie aplikacji nie zobaczą obrazu.</Notice>}
      <form class="x-respeak" onSubmit={(e) => { e.preventDefault(); if (!line.trim()) return; send(line); setLine(''); }}>
        <input ref={inp} class="fpz-input fpz-input--pill" value={line} disabled={!ok} onInput={(e) => setLine(e.currentTarget.value)} placeholder="Wpisz lub podyktuj linię napisów i naciśnij Enter…" aria-label="Linia napisów" data-testid="x-caption-input" />
        <Button type="submit" icon="send" disabled={!ok || !line.trim()}>Wyślij</Button>
      </form>
      <p class="x-muted x-small">Metoda respeakingu: lektor powtarza wypowiedzi, program rozpoznawania mowy zamienia je na tekst, a operator koryguje i wysyła linie (w prototypie – wpisywanie ręczne).</p>
      {live.captions.length ? <ol class="x-caplog">{live.captions.slice().reverse().map((c) => <li key={c.id}><time>{fmtTime(c.at)}</time><span>{c.text}</span></li>)}</ol> : <Empty icon="captions" title="Brak napisów" text="Wysłane linie pojawią się tutaj i na ekranach." />}
    </Panel>
    <Panel title="Tłumacz PJM on-line – dziennik połączeń" icon="hand" pad={false}>
      {s.pjmCalls.length ? <table class="x-table"><thead><tr><th>Skąd</th><th>Rozpoczęcie</th><th>Czas</th><th>Stan</th></tr></thead><tbody>{s.pjmCalls.map((c) => (
        <tr key={c.id}><td>{String(c.where || c.clientId)}</td><td>{fmtDateTime(c.startedAt)}</td><td>{fmtDuration(((c.endedAt ? new Date(c.endedAt) : new Date()) - new Date(c.startedAt)) / 1000)}</td><td>{c.status === 'active' ? <Tag tone="live">trwa</Tag> : <Tag tone="green">zakończone</Tag>}</td></tr>))}</tbody></table>
        : <div class="x-pad"><Empty icon="hand" title="Brak połączeń" text="Połączenia z tłumaczem uruchamiane jednym przyciskiem w kioskach, aplikacji i na stronie pojawią się tutaj." /></div>}
    </Panel>
  </div>);
}

/** „Nadawaj z telefonu”: adres strony nadawania i kod QR do zeskanowania telefonem (w wersji jednoplikowej – wyjaśnienie zamiast kodu). */
function PhoneCard() {
  const href = routeHref('nadawanie'); const served = /^https?:/.test(href);
  return (<Panel title="Nadawaj z telefonu" icon="smartphone" class="x-phonecast">
    <div class="x-phonecast__body" data-testid="x-phonecast">
      {served ? <a href={href} target="_blank" rel="noopener" class="x-phonecast__qr" title="Otwórz stronę nadawania" data-testid="x-phonecast-qr"><QR value={href} size={150} label="Zeskanuj telefonem" /></a>
        : <div class="x-phonecast__noqr"><Icon name="server" size={30} /></div>}
      <div class="x-phonecast__txt">
        <p>Prawdziwy obraz z kamery telefonu zamiast symulacji: otwórz na telefonie stronę nadawania, zaloguj się kontem służb technicznych i dotknij „Rozpocznij transmisję”. Obraz pojawi się na ekranach z napisami na żywo, w aplikacji, na stronie WWW i w kioskach; napisy wysyłasz dalej z konsoli poniżej.</p>
        {served ? <p class="x-phonecast__link"><Icon name="link" size={15} /><a href={href} target="_blank" rel="noopener" data-testid="x-phonecast-link">{href}</a></p>
          : <Notice tone="warn">Ta kopia systemu działa z jednego pliku, bez serwera – nadawanie z kamery działa tylko w wersji serwerowej (np. https://fpz-prototyp.netlify.app/nadawanie). Tam pojawi się kod QR do zeskanowania.</Notice>}
        <p class="x-muted x-small">Najlepiej w tej samej sieci Wi-Fi co ekrany; do 6 odbiorników naraz; transmisja nie jest nagrywana. Zakończenie transmisji tutaj wyłącza kamerę w telefonie nadawcy.</p>
      </div>
    </div>
  </Panel>);
}
