# Diagnostyka pliku wideo z biblioteki mediów pilotażu: kodek, profil, rozdzielczość, klatki, położenie indeksu (moov).
# Użycie: python3 tools/mp4info.py https://fpz-prototyp.netlify.app/api/media/<id>
import struct, sys, urllib.request
url = sys.argv[1]
def note(msg, level='notice'): print(f"::{level} title=Plik wideo::{msg}"); print(msg)
data = bytearray(); total = None; pos = 0; n = 0
while total is None or pos < total:
    req = urllib.request.Request(url, headers={'Range': f'bytes={pos}-', 'User-Agent': 'fpz-diag'})
    with urllib.request.urlopen(req, timeout=60) as r:
        cr = r.headers.get('Content-Range', ''); body = r.read(); n += 1
        if n == 1: note(f"odpowiedź serwera: HTTP {r.status}, Content-Type {r.headers.get('Content-Type')}, Content-Range {cr}, Accept-Ranges {r.headers.get('Accept-Ranges')}, Cache-Control {r.headers.get('Cache-Control')}")
        total = int(cr.split('/')[-1]) if '/' in cr else len(body); data += body; pos += len(body)
        if not body: break
note(f"pobrano {len(data)} B w {n} żądaniach (rozmiar wg serwera: {total})")
def boxes(buf, start, end):
    p = start
    while p + 8 <= end:
        size, typ = struct.unpack('>I4s', buf[p:p+8]); hdr = 8
        if size == 1: size = struct.unpack('>Q', buf[p+8:p+16])[0]; hdr = 16
        elif size == 0: size = end - p
        if size < hdr: break
        yield typ.decode('latin1'), p, p + hdr, p + size
        p += size
top = [(t, s, e) for t, s, b, e in boxes(data, 0, len(data))]
note('układ pliku: ' + ' → '.join(f"{t}@{s}({e - s} B)" for t, s, e in top) + ('  [indeks moov NA KOŃCU pliku]' if [t for t, _, _ in top if t in ('moov', 'mdat')][:1] == ['mdat'] else '  [indeks moov na początku]'))
ftyp = next(((s, e) for t, s, e in top if t == 'ftyp'), None)
if ftyp: note('ftyp: ' + bytes(data[ftyp[0]+8:ftyp[1]]).decode('latin1', 'replace').replace('\x00', '.'))
def find(buf, start, end, path):
    for t, s, b, e in boxes(buf, start, end):
        if t == path[0]:
            if len(path) == 1: yield (b, e)
            else: yield from find(buf, b, e, path[1:])
moov = next(((b, e) for t, s, b, e in boxes(data, 0, len(data)) if t == 'moov'), None)
if not moov: note('brak indeksu moov – plik niepełny albo to nie jest MP4', 'error'); sys.exit(0)
for tb, te in find(data, moov[0], moov[1], ['trak']):
    hd = next(find(data, tb, te, ['mdia', 'hdlr']), None); kind = bytes(data[hd[0]+8:hd[0]+12]).decode('latin1') if hd else '?'
    md = next(find(data, tb, te, ['mdia', 'mdhd']), None); dur = None
    if md:
        ver = data[md[0]]
        if ver == 1: ts, du = struct.unpack('>IQ', data[md[0]+20:md[0]+32])
        else: ts, du = struct.unpack('>II', data[md[0]+12:md[0]+20])
        dur = du / ts if ts else None
    sd = next(find(data, tb, te, ['mdia', 'minf', 'stbl', 'stsd']), None); info = ''
    if sd:
        p = sd[0] + 8; size, four = struct.unpack('>I4s', data[p:p+8]); four = four.decode('latin1')
        if kind == 'vide':
            w, h = struct.unpack('>HH', data[p+32:p+36]); info = f"kodek {four}, {w}x{h}"
            for t, s, b, e in boxes(data, p + 86, p + size):
                if t == 'avcC': prof, comp, lvl = data[b+1], data[b+2], data[b+3]; info += f", H.264 profil {prof} ({ {66:'Baseline',77:'Main',100:'High',110:'High 10 (10-bit)',122:'High 4:2:2',244:'High 4:4:4'}.get(prof,'?') }), poziom {lvl/10}"
                if t == 'hvcC': gp = data[b+1] & 0x1f; info += f", HEVC/H.265 profil {gp} ({ {1:'Main',2:'Main 10 (10-bit)'}.get(gp,'?') }), poziom {data[b+12]/30}"
                if t == 'av1C': info += ", AV1"
                if t == 'vpcC': info += ", VP9"
                if t == 'colr': info += f", colr {bytes(data[b:b+4]).decode('latin1')}"
            st = next(find(data, tb, te, ['mdia', 'minf', 'stbl', 'stsz']), None)
            if st and dur: cnt = struct.unpack('>I', data[st[0]+8:st[0]+12])[0]; info += f", {cnt} klatek ≈ {cnt/dur:.2f} kl./s"
        else:
            info = f"kodek {four}"
            if kind == 'soun': ch, bits = struct.unpack('>HH', data[p+24:p+28]); rate = struct.unpack('>I', data[p+32:p+36])[0] >> 16; info += f", {ch} kan., {rate} Hz"
    note(f"ścieżka {kind}: {info}, długość {dur:.2f} s" if dur else f"ścieżka {kind}: {info}")
