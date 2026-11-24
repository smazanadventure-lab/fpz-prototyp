// Nakładki: baner powiadomienia push (nowe z CMS) oraz karta „Jesteś w pobliżu” po wejściu w zasięg beaconu.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useClient } from '../../kernel/client.jsx';
import { strings } from '../../kernel/i18n.js';
import { sel } from '../../kernel/api.js';
import { getState } from '../../kernel/store.js';
import { clsx, fmtDistance } from '../../kernel/util.js';
import { Icon, IconButton } from '../../ui/components.jsx';
import { useApp } from './ctx.js';

strings({ 'b.push': ['Powiadomienie', 'Notification'], 'b.near': ['Jesteś w pobliżu', 'You are near'], 'b.open': ['Zobacz', 'View'], 'b.dismiss': ['Ukryj', 'Dismiss'], 'b.audioStarted': ['Audioprzewodnik: {name}', 'Audio guide: {name}'] });

export function Banners() {
  const app = useApp(); const { t, L, client, toast } = useClient(); const s = getState();
  const [push, setPush] = useState(null); const [near, setNear] = useState(null);
  const seenPush = useRef(null); const inRange = useRef(null);
  const pushes = sel.pushFor('mobile'); const beacons = sel.nearbyBeacons(150).filter((b) => b.inRange && b.poi);
  const pushKey = pushes.map((p) => p.id).join(','); const bKey = beacons.map((b) => b.trigger.id).join(',');
  useEffect(() => {
    if (seenPush.current == null) { seenPush.current = new Set(pushes.map((p) => p.id)); return; }
    const fresh = pushes.filter((p) => !seenPush.current.has(p.id)); fresh.forEach((p) => seenPush.current.add(p.id));
    if (fresh.length && client.notif !== false) setPush(fresh[0]);
  }, [pushKey]);
  useEffect(() => { if (!push) return; const x = setTimeout(() => setPush(null), 7000); return () => clearTimeout(x); }, [push?.id]);
  useEffect(() => {
    if (inRange.current == null) { inRange.current = new Set(beacons.map((b) => b.trigger.id)); return; }
    const fresh = beacons.filter((b) => !inRange.current.has(b.trigger.id)); inRange.current = new Set(beacons.map((b) => b.trigger.id));
    const b = fresh[0]; if (!b) { if (near && !beacons.some((x) => x.poi.id === near.poiId)) setNear(null); return; }
    const c = getState().clients.mobile || {};
    if (c.autoBeacon !== false) setNear({ poiId: b.poi.id, d: b.distanceM, trig: b.trigger.code });
    if (c.audioAuto) { const ids = sel.entries({ poiId: b.poi.id, channel: 'mobile' }).filter((e) => e.audioGuide).map((e) => e.id); if (ids.length) { app.playAudio(ids, 0); toast(t('b.audioStarted', { name: L(b.poi.name) }), 'info'); } }
  }, [bKey]);
  useEffect(() => { if (!near) return; const x = setTimeout(() => setNear(null), 9000); return () => clearTimeout(x); }, [near?.poiId]);
  const p = near && sel.poi(near.poiId);
  return (<div class="m-banners" aria-live="polite">
    {push && <div class="m-banner" role="status"><span class="m-banner__ico"><Icon name="bell" size={18} /></span><button type="button" class="m-banner__txt" onClick={() => { setPush(null); app.push('notifications'); }}><small>{t('b.push')}</small><b>{push.subject}</b>{push.body && <span>{push.body}</span>}</button><IconButton icon="close" variant="plain" size="sm" label={t('b.dismiss')} onClick={() => setPush(null)} /></div>}
    {p && <div class="m-banner m-banner--near" role="status"><span class="m-banner__ico"><Icon name="beacon" size={18} /></span><button type="button" class="m-banner__txt" onClick={() => { setNear(null); app.openPoi(p.id); }}><small>{t('b.near')} · {fmtDistance(near.d)}</small><b>{L(p.name)}</b><span>{L(p.short)}</span></button><IconButton icon="close" variant="plain" size="sm" label={t('b.dismiss')} onClick={() => setNear(null)} /></div>}
  </div>);
}
