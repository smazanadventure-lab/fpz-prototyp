#!/usr/bin/env python3
"""Generuje ikony aplikacji i grafiki ekranu startowego (splash) dla FPŻ – prototyp.

Znak: sygnet Fabryki Pełnej Życia (biały) na zielonym tle #125930, wycięty z kanału alfa oficjalnego logo
docs/logo/zrodlo/fabryka-pelna-zycia-logo-czarne-poziome.png (bez przerysowywania).
Uruchomienie (z katalogu głównego projektu):  python3 android/tools/gen-icons.py
Wymaga: Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image, ImageDraw

GREEN = (0x12, 0x59, 0x30, 255)
WHITE = (0xFF, 0xFF, 0xFF, 255)

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "docs" / "logo" / "zrodlo" / "fabryka-pelna-zycia-logo-czarne-poziome.png"
RES = Path(__file__).resolve().parent.parent / "app" / "src" / "main" / "res"
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
SS = 4  # nadpróbkowanie tła (zaokrąglenia, koło) dla gładkich krawędzi
SPLIT = 1440  # sygnet zajmuje lewą część pliku źródłowego (do ok. 1240 px), napis – od ok. 1650 px


def load_mark():
    a = Image.open(SRC).convert("RGBA").getchannel("A")
    a = a.crop((0, 0, SPLIT, a.height))
    return a.crop(a.getbbox())


MARK = load_mark()


def draw_mark(img, frac):
    """Nakłada biały sygnet o wysokości frac·bok, wyśrodkowany (skalowanie LANCZOS z pełnej rozdzielczości)."""
    W, H = img.size
    h = round(H * frac)
    w = round(h * MARK.width / MARK.height)
    layer = Image.new("RGBA", (w, h), WHITE)
    layer.putalpha(MARK.resize((w, h), Image.LANCZOS))
    img.alpha_composite(layer, ((W - w) // 2, (H - h) // 2))


def background(px, shape):
    S = px * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = int(S * 0.04)
    if shape == "square":
        d.rounded_rectangle([m, m, S - m, S - m], radius=int(S * 0.18), fill=GREEN)
    elif shape == "round":
        d.ellipse([m, m, S - m, S - m], fill=GREEN)
    return img.resize((px, px), Image.LANCZOS)


def render(px, shape):
    """shape: 'square' (legacy, zaokrąglony kwadrat), 'round' (koło), 'fg' (warstwa adaptacyjna)."""
    img = background(px, shape)
    if shape == "square":
        draw_mark(img, 0.56)
    elif shape == "round":
        draw_mark(img, 0.52)
    else:
        # 108 dp; strefa bezpieczna to koło 66 dp – sygnet 46 dp wysokości (przekątna ≈ 63 dp) mieści się w niej.
        # Tło #125930 pochodzi z zasobów (ic_launcher_background) – tu tylko przezroczysta warstwa ze znakiem.
        draw_mark(img, 46 / 108)
    return img


def main():
    for name, k in DENSITIES.items():
        out = RES / f"mipmap-{name}"
        out.mkdir(parents=True, exist_ok=True)
        render(round(48 * k), "square").save(out / "ic_launcher.png")
        render(round(48 * k), "round").save(out / "ic_launcher_round.png")
        render(round(108 * k), "fg").save(out / "ic_launcher_foreground.png")

    # Ekran startowy: jednolite tło #125930, rozmiary jak w szablonie Capacitora.
    splash = {
        "drawable": (480, 320),
        "drawable-port-mdpi": (320, 480), "drawable-port-hdpi": (480, 800),
        "drawable-port-xhdpi": (720, 1280), "drawable-port-xxhdpi": (960, 1600),
        "drawable-port-xxxhdpi": (1280, 1920),
        "drawable-land-mdpi": (480, 320), "drawable-land-hdpi": (800, 480),
        "drawable-land-xhdpi": (1280, 720), "drawable-land-xxhdpi": (1600, 960),
        "drawable-land-xxxhdpi": (1920, 1280),
    }
    for folder, size in splash.items():
        out = RES / folder
        out.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", size, GREEN[:3]).save(out / "splash.png", optimize=True)
    print("OK:", RES)


if __name__ == "__main__":
    main()
