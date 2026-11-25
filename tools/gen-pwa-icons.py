# Ikony strony / PWA: sygnet Fabryki Pełnej Życia (biały) na zielonym tle #125930.
# Źródło: oficjalne logo – docs/logo/zrodlo/fabryka-pelna-zycia-logo-czarne-poziome.png (sygnet wycinany z kanału alfa).
# Uruchomienie z katalogu głównego:  python3 tools/gen-pwa-icons.py   (wymaga Pillow)
from PIL import Image, ImageDraw
import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public')
SRC = os.path.join(HERE, '..', 'docs', 'logo', 'zrodlo', 'fabryka-pelna-zycia-logo-czarne-poziome.png')
GREEN = '#125930'
SPLIT = 1440  # sygnet zajmuje lewą część pliku (do ok. 1240 px), napis zaczyna się od ok. 1650 px


def load_mark():
    a = Image.open(SRC).convert('RGBA').getchannel('A')
    a = a.crop((0, 0, SPLIT, a.height))
    return a.crop(a.getbbox())  # dokładny prostokąt ograniczający sygnetu


MARK = load_mark()


def mark_layer(size, frac):
    """Biały sygnet (RGBA) o wysokości frac·size, wyśrodkowany na przezroczystym kwadracie size×size."""
    h = round(size * frac); w = round(h * MARK.width / MARK.height)
    alpha = MARK.resize((w, h), Image.LANCZOS)
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    white = Image.new('RGBA', (w, h), (255, 255, 255, 255)); white.putalpha(alpha)
    layer.paste(white, ((size - w) // 2, (size - h) // 2))
    return layer


def icon(size, frac=0.62, radius=0.22):
    if radius:  # tło z zaokrągleniem rysowane w 4× i pomniejszane (gładka krawędź)
        S = size * 4; bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(bg).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=GREEN)
        bg = bg.resize((size, size), Image.LANCZOS)
    else:
        bg = Image.new('RGBA', (size, size), GREEN)
    bg.alpha_composite(mark_layer(size, frac))
    return bg


icon(192).save(os.path.join(OUT, 'icon-192.png'), optimize=True)
icon(512).save(os.path.join(OUT, 'icon-512.png'), optimize=True)
# maskable: pełne tło bez zaokrągleń, sygnet w strefie bezpiecznej (koło o średnicy 80% boku) – ok. 50% boku
icon(512, frac=0.50, radius=0).save(os.path.join(OUT, 'icon-maskable-512.png'), optimize=True)
icon(180, radius=0).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'), optimize=True)
print('OK ikony w public/')
