"""Icons and link-preview images for the personal brands.

Generalised from make-ricky-brand.py, which drew Rick.Fit's set. Same reasoning
for drawing rather than generating: a wordmark has to be exact, repeatable and
legible at 32px, which is the one thing image models are reliably bad at.

Every brand needs its own icon-192, icon-512 and og.png. Without them
brand-html.mjs falls back to Coached by Kim's, and every share and every
home-screen install carries her mark - the exact failure that script exists to
prevent.

Run: python scripts/make-brand-assets.py [slug ...]   (default: all)
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
BOLD = 'C:/Windows/Fonts/arialbd.ttf'

BRANDS = {
    # Shrewsbury Town's blue and amber. Lennon is contracted there and has
    # permission to use the brand - this is his own app, not public marketing.
    'lennon': {
        'bg': (10, 22, 44),
        'accent': (255, 184, 28),
        'text': (240, 245, 252),
        'muted': (135, 152, 176),
        'mark': 'LG',
        'wordmark': ('LENNON', 'GK'),
        'strap': 'Goalkeeper. Fuelled properly.',
    },
    'kelsey': {
        'bg': (24, 10, 22),
        'accent': (233, 84, 140),
        'text': (250, 240, 246),
        'muted': (168, 138, 158),
        'mark': 'K',
        'wordmark': ('KELSEY', 'FIT'),
        'strap': 'Glutes, strength, shape.',
    },
}


def font(size):
    return ImageFont.truetype(BOLD, size)


def centred(draw, box, text, f, fill):
    l, t, r, b = draw.textbbox((0, 0), text, font=f)
    x = box[0] + (box[2] - box[0] - (r - l)) / 2 - l
    y = box[1] + (box[3] - box[1] - (b - t)) / 2 - t
    draw.text((x, y), text, font=f, fill=fill)


def icon(cfg, size):
    im = Image.new('RGB', (size, size), cfg['bg'])
    d = ImageDraw.Draw(im)
    # A rule under the mark, in the accent - reads as deliberate at 32px where a
    # more detailed device just turns to mush.
    centred(d, (0, -size * 0.06, size, size * 0.94), cfg['mark'], font(int(size * 0.44)), cfg['text'])
    bar_w, bar_h = int(size * 0.30), max(2, int(size * 0.045))
    x0 = (size - bar_w) // 2
    y0 = int(size * 0.76)
    d.rounded_rectangle([x0, y0, x0 + bar_w, y0 + bar_h], radius=bar_h // 2, fill=cfg['accent'])
    return im


def og(cfg):
    w, h = 1200, 630
    im = Image.new('RGB', (w, h), cfg['bg'])
    d = ImageDraw.Draw(im)
    one, two = cfg['wordmark']
    f = font(112)
    l, t, r, b = d.textbbox((0, 0), f'{one} ', font=f)
    total = (r - l) + d.textbbox((0, 0), two, font=f)[2]
    x = (w - total) / 2
    y = h / 2 - 96
    d.text((x, y), one, font=f, fill=cfg['text'])
    d.text((x + (r - l), y), two, font=f, fill=cfg['accent'])
    centred(d, (0, h / 2 + 40, w, h / 2 + 110), cfg['strap'], font(34), cfg['muted'])
    d.rounded_rectangle([w / 2 - 60, h / 2 + 150, w / 2 + 60, h / 2 + 158], radius=4, fill=cfg['accent'])
    return im


def main():
    wanted = sys.argv[1:] or list(BRANDS)
    for slug in wanted:
        cfg = BRANDS.get(slug)
        if not cfg:
            raise SystemExit(f'unknown brand: {slug}')
        out = ROOT / 'public' / 'brands' / slug
        out.mkdir(parents=True, exist_ok=True)
        icon(cfg, 192).save(out / 'icon-192.png')
        icon(cfg, 512).save(out / 'icon-512.png')
        og(cfg).save(out / 'og.png')
        print(f'{slug}: icon-192, icon-512, og -> {out}')


if __name__ == '__main__':
    main()
