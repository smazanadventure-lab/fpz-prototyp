#!/usr/bin/env python3
"""Generuje ikony aplikacji i grafiki ekranu startowego (splash) dla FPŻ – prototyp.

Własny, prosty znak: jasne litery „FPŻ” z kreską pod spodem na zielonym tle #125930.
Uruchomienie (z katalogu głównego projektu):  python3 android/tools/gen-icons.py
Wymaga: Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

GREEN = (0x12, 0x59, 0x30, 255)
LIGHT = (0xF2, 0xF7, 0xEE, 255)
ACCENT = (0x9F, 0xD8, 0x6B, 255)
TEXT = "FPŻ"

RES = Path(__file__).resolve().parent.parent / "app" / "src" / "main" / "res"
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
SS = 4  # nadpróbkowanie dla gładkich krawędzi

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def load_font(size):
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size=size)  # Pillow >= 10.1


def draw_mark(img, box_w):
    """Rysuje znak (litery + kreska) wyśrodkowany, o szerokości ok. box_w px."""
    d = ImageDraw.Draw(img)
    W, H = img.size
    size = int(box_w * 0.62)
    font = load_font(size)
    while d.textlength(TEXT, font=font) > box_w and size > 8:
        size -= 2
        font = load_font(size)
    l, t, r, b = d.textbbox((0, 0), TEXT, font=font)
    tw, th = r - l, b - t
    bar_h = max(1, int(box_w * 0.07))
    gap = int(box_w * 0.08)
    total_h = th + gap + bar_h
    x = (W - tw) / 2 - l
    y = (H - total_h) / 2 - t
    d.text((x, y), TEXT, font=font, fill=LIGHT)
    by = (H - total_h) / 2 + th + gap
    d.rounded_rectangle(
        [(W - tw) / 2, by, (W + tw) / 2, by + bar_h], radius=bar_h / 2, fill=ACCENT
    )


def render(px, shape):
    """shape: 'square' (legacy, zaokrąglony kwadrat), 'round' (koło), 'fg' (warstwa adaptacyjna)."""
    S = px * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if shape == "square":
        m = int(S * 0.04)
        d.rounded_rectangle([m, m, S - m, S - m], radius=int(S * 0.18), fill=GREEN)
        draw_mark(img, int(S * 0.70))
    elif shape == "round":
        m = int(S * 0.04)
        d.ellipse([m, m, S - m, S - m], fill=GREEN)
        draw_mark(img, int(S * 0.62))
    else:
        # 108 dp, strefa bezpieczna to koło 66 dp – znak mieści się w ~56% szerokości.
        draw_mark(img, int(S * 0.56))
    return img.resize((px, px), Image.LANCZOS)


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
