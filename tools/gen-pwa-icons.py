# Ikony strony / PWA (własny, prosty znak – nie jest to logotyp instytucji): python3 tools/gen-pwa-icons.py
from PIL import Image, ImageDraw, ImageFont
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'public')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def icon(size, pad=0.0, radius=0.22):
    S = size * 4; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if radius: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill='#125930')
    else: d.rectangle([0, 0, S, S], fill='#125930')
    inner = S * (1 - 2 * pad); x0 = S * pad
    # pas wzoru u dołu (jak ścięte narożniki w identyfikacji prototypu)
    d.polygon([(x0 + inner * 0.62, x0 + inner), (x0 + inner, x0 + inner * 0.62), (x0 + inner, x0 + inner)], fill='#5FB287')
    f = ImageFont.truetype(FONT, int(inner * 0.34)); t = 'FPŻ'; box = d.textbbox((0, 0), t, font=f)
    d.text((S / 2 - (box[2] + box[0]) / 2, S / 2 - (box[3] + box[1]) / 2 - inner * 0.03), t, font=f, fill='#EEF6F2')
    return im.resize((size, size), Image.LANCZOS)
icon(192).save(os.path.join(OUT, 'icon-192.png')); icon(512).save(os.path.join(OUT, 'icon-512.png'))
icon(512, pad=0.12, radius=0).save(os.path.join(OUT, 'icon-maskable-512.png'))
bg = Image.new('RGB', (180, 180), '#125930'); ic = icon(180, radius=0); bg.paste(ic, (0, 0), ic); bg.save(os.path.join(OUT, 'apple-touch-icon.png'))
print('OK ikony w public/')
