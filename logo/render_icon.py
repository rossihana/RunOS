"""Render 6 varian logo RunOS — palet resmi frontend (index.css):
oranye #FC4C02 (brand), zinc-900 #18181b, putih.
    python render_icon.py            -> logo/<name>.png 512px
    python render_icon.py --check    -> self-check ukuran + piksel aksen
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ACCENT = "#FC4C02"   # brand orange (index.css --chart-pace)
INK = "#18181b"      # zinc-900
SURFACE = "#ffffff"
SS = 8
GRID = 64

FONT_B = "C:/Windows/Fonts/interstateregular.ttf"  # fallback dicek di bawah


def _font_path():
    for cand in ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf",
                 "C:/Windows/Fonts/arial.ttf"):
        if os.path.exists(cand):
            return cand
    raise SystemExit("font sistem tak ditemukan")


def _base(size, tile_color=INK, radius=14):
    s = size * SS
    k = s / GRID
    tile = Image.new("RGB", (s, s), tile_color)
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=radius * k, fill=255)
    im = Image.new("RGB", (s, s), tile_color)
    # tile memenuhi canvas; surface dipakai hanya untuk varian terang
    im.paste(tile, (0, 0))
    if tile_color == SURFACE:
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius * k, outline=INK, width=int(2.5 * k))
    return im, ImageDraw.Draw(im), k


def _stroke(d, pts, color, w, k, joint="curve"):
    d.line([(x * k, y * k) for x, y in pts], fill=color, width=int(w * k), joint=joint)
    r = w * k / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x * k - r, y * k - r, x * k + r, y * k + r], fill=color)


def _finish(im, size):
    return im.resize((size, size), Image.LANCZOS)


def ink_box(ch, size, k):
    f = ImageFont.truetype(_font_path(), int(size * k))
    n = int(GRID * k) * 3
    im = Image.new("L", (n, n), 0)
    ImageDraw.Draw(im).text((n / 2, n / 2), ch, font=f, fill=255, anchor="mm")
    return tuple((v - n / 2) / k for v in im.getbbox())


# ---- 1. pulse (garis detak jantung) di tile gelap — identitas ikon iklan ----
def pulse_dark(size=512):
    im, d, k = _base(size, INK)
    _stroke(d, [(8, 34), (20, 34), (26, 18), (34, 48), (40, 34), (56, 34)], ACCENT, 5.5, k)
    return _finish(im, size)


# ---- 2. pulse di tile oranye (invers) ----
def pulse_orange(size=512):
    im, d, k = _base(size, ACCENT)
    _stroke(d, [(8, 34), (20, 34), (26, 18), (34, 48), (40, 34), (56, 34)], SURFACE, 5.5, k)
    return _finish(im, size)


# ---- 3. monogram R geometris ----
def mono_r(size=512):
    im, d, k = _base(size, INK)
    _stroke(d, [(22, 50), (22, 14), (38, 14), (44, 18), (44, 26), (38, 30), (22, 30)], SURFACE, 5.5, k)
    _stroke(d, [(28, 30), (44, 50)], ACCENT, 5.5, k)
    return _finish(im, size)


# ---- 4. rute lari (jalur GPS abstrak + titik finish) ----
def route(size=512):
    im, d, k = _base(size, INK)
    _stroke(d, [(14, 50), (14, 30), (30, 30), (30, 16), (46, 16), (46, 40), (50, 44)], SURFACE, 5, k)
    d.ellipse([(50 - 6) * k, (44 - 6) * k, (50 + 6) * k, (44 + 6) * k], fill=ACCENT)
    return _finish(im, size)


# ---- 4b. route khusus ukuran kecil: stroke tebal, satu belokan, titik besar ----
def route_small(size=512):
    im, d, k = _base(size, INK)
    _stroke(d, [(16, 50), (16, 32), (36, 32), (36, 16)], SURFACE, 7, k)
    d.ellipse([(44 - 9) * k, (24 - 9) * k, (44 + 9) * k, (24 + 9) * k], fill=ACCENT)
    return _finish(im, size)


# ---- 5. kecepatan: dua garis miring (motion streaks) ----
def streaks(size=512):
    im, d, k = _base(size, ACCENT)
    _stroke(d, [(14, 24), (40, 24)], SURFACE, 5, k)
    _stroke(d, [(22, 36), (50, 36)], SURFACE, 5, k)
    _stroke(d, [(30, 48), (50, 48)], INK, 5, k)
    return _finish(im, size)


# ---- 6. ring progress (lingkaran pace + jarum) ----
def ring(size=512):
    im, d, k = _base(size, INK)
    d.arc([12 * k, 12 * k, 52 * k, 52 * k], start=-90, end=250, fill=ACCENT, width=int(6 * k))
    d.arc([12 * k, 12 * k, 52 * k, 52 * k], start=250, end=270, fill="#3f3f46", width=int(6 * k))
    _stroke(d, [(32, 32), (32, 16)], SURFACE, 4.5, k)
    return _finish(im, size)


VARIANTS = {
    "pulse-dark": pulse_dark,
    "pulse-orange": pulse_orange,
    "mono-r": mono_r,
    "route": route,
    "route-small": route_small,
    "streaks": streaks,
    "ring": ring,
}


def check():
    accent_rgb = tuple(int(ACCENT[i:i + 2], 16) for i in (1, 3, 5))
    for name, fn in VARIANTS.items():
        img = fn(512)
        assert img.size == (512, 512), f"{name}: ukuran salah {img.size}"
        px = img.load()
        # aksen ATAU putih di atas tile (pulse-orange/streaks dominan putih)
        hits_accent = sum(1 for y in range(0, 512, 8) for x in range(0, 512, 8)
                          if px[x, y][:3] == accent_rgb)
        hits_white = sum(1 for y in range(0, 512, 8) for x in range(0, 512, 8)
                         if px[x, y][:3] == (255, 255, 255))
        assert hits_accent or hits_white, f"{name}: mark tak ter-render"
        print(f"ok  {name}: 512x512  accent={hits_accent} white={hits_white}")
    print("ALL OK")


if __name__ == "__main__":
    if "--check" in sys.argv:
        check()
    else:
        os.makedirs("logo", exist_ok=True)
        for name, fn in VARIANTS.items():
            fn(512).save(f"logo/{name}.png")
            print("wrote", f"logo/{name}.png")
