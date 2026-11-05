# The Babylon edition's own app icon (so it is easy to tell from the main game's compass rose): a neon cube, its
# faces magenta, violet and cyan, with a white airliner climbing across it, on deep violet. Writes the Android icons
# (scripts/android/res) and the PC icon (pc/app.ico). Drawn here, our own.
import os
from PIL import Image, ImageDraw, ImageFilter
here = os.path.dirname(os.path.abspath(__file__)); top = os.path.join(here, '..')
BG = (22, 12, 52, 255)
def art(S, bg):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if bg == 'square': d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)
    elif bg == 'round': d.ellipse([0, 0, S - 1, S - 1], fill=BG)
    k = 0.62 if bg == 'fg' else 0.78; c = S / 2; r = S * k / 2
    import math
    def pt(a, rr=1.0): return (c + math.cos(a) * r * rr, c + math.sin(a) * r * rr)
    hexp = [pt(math.radians(-90 + 60 * i)) for i in range(6)]; ctr = (c, c)
    top_f = [hexp[5], hexp[0], hexp[1], ctr]; left_f = [hexp[5], ctr, hexp[3], hexp[4]]; right_f = [ctr, hexp[1], hexp[2], hexp[3]]
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow); gd.polygon(hexp, fill=(255, 63, 184, 150)); glow = glow.filter(ImageFilter.GaussianBlur(S * 0.05)); im.alpha_composite(glow)
    d = ImageDraw.Draw(im)
    d.polygon(top_f, fill=(53, 240, 255, 255)); d.polygon(left_f, fill=(255, 63, 184, 255)); d.polygon(right_f, fill=(138, 75, 255, 255))
    w = max(2, int(S * 0.012)); d.line(hexp + [hexp[0]], fill=(255, 255, 255, 230), width=w); d.line([ctr, hexp[5]], fill=(255, 255, 255, 200), width=w); d.line([ctr, hexp[1]], fill=(255, 255, 255, 200), width=w); d.line([ctr, hexp[3]], fill=(255, 255, 255, 200), width=w)
    # a white airliner climbing across the cube
    pl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); pd = ImageDraw.Draw(pl); u = r / 100
    body = [(-70, -6), (60, -6), (80, 0), (60, 6), (-70, 6), (-78, 0)]
    wing = [(-5, 0), (25, 0), (-15, 46), (-30, 46)]; wing2 = [(-5, 0), (25, 0), (-15, -46), (-30, -46)]
    tail = [(-62, 0), (-50, 0), (-72, 22), (-80, 22)]; tail2 = [(-62, 0), (-50, 0), (-72, -22), (-80, -22)]
    a = math.radians(-24)
    def tr(p): x, y = p; return (c + (x * math.cos(a) - y * math.sin(a)) * u * 0.95, c + (x * math.sin(a) + y * math.cos(a)) * u * 0.95 + r * 0.05)
    for poly in (wing, wing2, tail, tail2, body): pd.polygon([tr(p) for p in poly], fill=(255, 255, 255, 255))
    sh = pl.filter(ImageFilter.GaussianBlur(S * 0.012)); sh2 = Image.new('RGBA', (S, S), (10, 0, 30, 0)); sh2.putalpha(sh.getchannel('A').point(lambda v: int(v * 0.7)))
    im.alpha_composite(sh2); im.alpha_composite(pl)
    return im
res = os.path.join(top, 'scripts', 'android', 'res')
for dpi, n, f in [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
    dd = os.path.join(res, 'mipmap-' + dpi); os.makedirs(dd, exist_ok=True)
    art(1024, 'square').resize((n, n), Image.LANCZOS).save(os.path.join(dd, 'ic_launcher.png'))
    art(1024, 'round').resize((n, n), Image.LANCZOS).save(os.path.join(dd, 'ic_launcher_round.png'))
    art(1024, 'fg').resize((f, f), Image.LANCZOS).save(os.path.join(dd, 'ic_launcher_foreground.png'))
with open(os.path.join(res, 'values', 'ic_launcher_background.xml'), 'w') as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#160C34</color>\n</resources>\n')
big = art(1024, 'square'); big.save(os.path.join(top, 'pc', 'app.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
big.resize((512, 512), Image.LANCZOS).save(os.path.join(top, 'www', 'icon.png'))
print('icons written')
