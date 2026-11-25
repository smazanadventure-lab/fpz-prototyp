#!/usr/bin/env python3
"""Wektoryzacja oficjalnego logo FPŻ (docs/logo/zrodlo/…-czarne-poziome.png) → src/ui/logo-data.js.

Trasowanie kanału alfa (próg 50%) w pełnej rozdzielczości biblioteką potracer (czysty Python,
`pip install potracer`), współrzędne przeskalowane do viewBox 0 0 400 140.5 (2 miejsca po przecinku).
Uruchomienie z katalogu głównego:  python3 tools/vectorize-logo.py [turdsize alphamax opttolerance]
"""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image
import potrace

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/logo/zrodlo/fabryka-pelna-zycia-logo-czarne-poziome.png'
OUT = ROOT / 'src/ui/logo-data.js'
K = 0.1  # 4000 px → 400 jednostek
SPLIT = 1440  # granica sygnet | napis (przerwa 1239–1652 px)

args = [float(v) for v in sys.argv[1:4]]
TURD, ALPHA, OPTTOL = (args + [2, 1.0, 0.4][len(args):]) if args else (2, 1.0, 0.4)


def n(v):
    s = f'{v * K:.2f}'.rstrip('0').rstrip('.')
    if s.startswith('0.'): s = s[1:]
    elif s.startswith('-0.'): s = '-' + s[2:]
    return '0' if s in ('', '-0', '-') else s


def pair(p):
    a, b = n(p[0]), n(p[1])
    return a + ('' if b.startswith('-') else ' ') + b


def collinear(a, b, c, tol=0.15):
    """Czy punkt b leży na odcinku a–c (odległość < tol px źródła)? – wtedy jest zbędny."""
    (ax, ay), (bx, by), (cx, cy) = a, b, c
    L = ((cx - ax) ** 2 + (cy - ay) ** 2) ** 0.5
    if L < 1e-9: return False
    dist = abs((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / L
    t = ((bx - ax) * (cx - ax) + (by - ay) * (cy - ay)) / (L * L)
    return dist < tol and 0 <= t <= 1


def curve_d(curve):
    # segmenty: ('L', p) albo ('C', c1, c2, p); punkty narożne potrace zamieniane na odcinki
    start = (curve.start_point.x, curve.start_point.y)
    segs = []
    for seg in curve:
        if seg.is_corner:
            segs.append(('L', (seg.c.x, seg.c.y)))
            segs.append(('L', (seg.end_point.x, seg.end_point.y)))
        else:
            segs.append(('C', (seg.c1.x, seg.c1.y), (seg.c2.x, seg.c2.y), (seg.end_point.x, seg.end_point.y)))
    # usuwanie punktów leżących na prostej między sąsiadami (bez zmiany kształtu)
    changed = True
    while changed:
        changed = False
        out, prev = [], start
        i = 0
        while i < len(segs):
            s = segs[i]
            if s[0] == 'L' and i + 1 < len(segs) and segs[i + 1][0] == 'L' and collinear(prev, s[1], segs[i + 1][1]):
                changed = True
                i += 1
                continue
            out.append(s)
            prev = s[-1]
            i += 1
        segs = out
    # odcinek domykający do punktu startowego jest zbędny (Z)
    if segs and segs[-1][0] == 'L' and abs(segs[-1][1][0] - start[0]) < 1e-9 and abs(segs[-1][1][1] - start[1]) < 1e-9:
        segs.pop()
    d = ['M' + pair(start)]
    for s in segs:
        d.append(s[0] + ' '.join(pair(q) for q in s[1:]))
    return ''.join(d) + 'Z'


def simplify(d):
    # usuwa zbędne powtórzenia liter poleceń (L1 2L3 4 → L1 2 3 4)
    import re
    toks = re.findall(r'[MLCZ]|[^MLCZ]+', d)
    res, last = [], None
    for t in toks:
        if t in 'MLCZ' and len(t) == 1:
            if t == last and t in 'LC':
                res.append(' ')
                continue
            last = t
        res.append(t)
    return ''.join(res).replace('  ', ' ')


def main():
    im = Image.open(SRC).convert('RGBA')
    W, H = im.size
    alpha = np.array(im)[:, :, 3] >= 128
    # potracer.Bitmap odwraca dane wejściowe (traktuje je jak jasność), stąd negacja maski
    path = potrace.Bitmap(~alpha).trace(turdsize=TURD, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                                        alphamax=ALPHA, opticurve=True, opttolerance=OPTTOL)
    parts = {'mark': [], 'word': []}
    for c in path:
        parts['mark' if c.start_point.x < SPLIT else 'word'].append(simplify(curve_d(c)))
    data = {}
    for key, (x0, x1) in {'mark': (0, SPLIT), 'word': (SPLIT, W)}.items():
        sub = alpha[:, x0:x1]
        cs = np.where(sub.any(0))[0]; rs = np.where(sub.any(1))[0]
        bx, by, bx2, by2 = x0 + cs.min(), rs.min(), x0 + cs.max() + 1, rs.max() + 1
        box = [round(float(v) * K, 2) for v in (bx, by, bx2 - bx, by2 - by)]
        data[key] = {'box': box, 'd': ''.join(parts[key])}
    js = ('// Oficjalne logo Fabryki Pełnej Życia (wersja pozioma: sygnet + napis „Fabryka. / Pełna / Życia”).\n'
          '// Źródło: plik przekazany przez Zamawiającego – docs/logo/zrodlo/fabryka-pelna-zycia-logo-czarne-poziome.png\n'
          f'// ({W}×{H} px). Ścieżki: wektoryzacja kanału alfa (potrace, turdsize={TURD:g}, alphamax={ALPHA:g},\n'
          f'// opttolerance={OPTTOL:g}) narzędziem tools/vectorize-logo.py; układ viewBox 0 0 400 140.5 (1 j. = 10 px źródła).\n'
          '// box = [x, y, szer., wys.] – prostokąt ograniczający części. Nie edytować ręcznie.\n'
          'export const LOGO = {\n  w: 400, h: 140.5,\n'
          f"  mark: {{ box: {json.dumps(data['mark']['box'])}, d: '{data['mark']['d']}' }},\n"
          f"  word: {{ box: {json.dumps(data['word']['box'])}, d: '{data['word']['d']}' }},\n}};\n")
    OUT.write_text(js, encoding='utf-8')
    print('OK', OUT, len(js.encode()), 'B; mark', data['mark']['box'], 'word', data['word']['box'],
          'curves', len(parts['mark']), len(parts['word']))


if __name__ == '__main__':
    main()
