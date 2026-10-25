#!/usr/bin/env python3
"""Build RunOS Open-Track logo kit in PIL — deterministic, no chrome quirks.
Usage: python build_kit.py          # build semua + ICO + strip
       python build_kit.py --check  # verifikasi piksel saja
"""
import base64
import io
import os
import struct
import sys

from PIL import Image, ImageDraw

SS = 8                      # supersample
S = 64 * SS                 # kanvas kerja 512
ORANGE = (252, 76, 2, 255)  # #FC4C02
INK = (24, 24, 27, 255)     # zinc-900
LIGHT = (244, 244, 245, 255)  # zinc-100
WHITE = (255, 255, 255, 255)
HERE = os.path.dirname(os.path.abspath(__file__))

# geometri mark (skala 64): stadium 11.75,17.75 - 52.25,46.25, radius 10.25,
# stroke 5.5; celah terbuka di sisi kiri antara y 29..36
X0, Y0, X1, Y1 = 11.75, 17.75, 52.25, 46.25
RAD = 10.25
GAP_Y0, GAP_Y1 = 29.0, 36.0
STROKE = 5.5


def draw_track(draw, stroke, color):
    w = stroke * SS
    draw.rounded_rectangle(
        [X0 * SS, Y0 * SS, X1 * SS, Y1 * SS], radius=RAD * SS,
        outline=color, width=round(w))
    # buka celah di sisi kiri (tutup dengan warna latar tile / transparan)
    half = w / 2 + 2 * SS
    draw.rectangle(
        [(X0 - stroke) * SS, GAP_Y0 * SS, (X0 + stroke) * SS, GAP_Y1 * SS],
        fill=(0, 0, 0, 0))


def build_tile(stroke, out_size):
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=14 * SS, fill=ORANGE)
    # simpan salinan tile penuh untuk menutup celah (bukan transparan)
    d.rounded_rectangle(
        [(X0 - stroke) * SS, GAP_Y0 * SS, (X0 + stroke) * SS, GAP_Y1 * SS],
        fill=ORANGE)
    draw_track(d, stroke, WHITE)
    return im.resize((out_size, out_size), Image.LANCZOS)


def build_stroke(color, out_size):
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_track(d, STROKE, color)
    return im.resize((out_size, out_size), Image.LANCZOS)


def write_ico(masters, ico_path):
    """Hand-assembled ICO dari beberapa master (per-size redraw)."""
    entries, blobs = [], []
    for size, im in masters:
        buf = io.BytesIO()
        im.resize((size, size), Image.LANCZOS).save(buf, "PNG")
        blobs.append(buf.getvalue())
        entries.append((size, size))
    offset = 6 + 16 * len(blobs)
    out = struct.pack("<HHH", 0, 1, len(blobs))
    for (w, _h), blob in zip(entries, blobs):
        out += struct.pack("<BBBBHHII", w if w < 256 else 0,
                           w if w < 256 else 0, 0, 0, 1, 32,
                           len(blob), offset)
        offset += len(blob)
    with open(ico_path, "wb") as fh:
        fh.write(out + b"".join(blobs))


def build():
    master = build_tile(STROKE, 256)        # stroke 5.5 utk >=48px
    m16 = build_tile(7.5, 256)              # redraw tebal utk 16/32px
    mono = build_stroke(INK, 256)
    inverse = build_stroke(LIGHT, 256)

    master.save(os.path.join(HERE, "tile.png"))
    m16.save(os.path.join(HERE, "tile-16.png"))
    mono.save(os.path.join(HERE, "mono.png"))
    inverse.save(os.path.join(HERE, "inverse.png"))

    write_ico([(16, m16), (32, m16), (48, master), (64, master),
               (128, master), (256, master)],
              os.path.join(HERE, "favicon.ico"))

    buf = io.BytesIO()
    master.save(buf, "PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    with open(os.path.join(HERE, "icon.svg"), "w") as fh:
        fh.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                 f'<image href="data:image/png;base64,{b64}" width="64" height="64"/></svg>')
    print("built: tile.png tile-16.png mono.png inverse.png favicon.ico icon.svg")


def check():
    ok = True
    from PIL import IcoImagePlugin
    for size in (16, 32, 48, 256):
        f = IcoImagePlugin.IcoImageFile(os.path.join(HERE, "favicon.ico"))
        f.size = (size, size)
        rgb = f.convert("RGB")
        px = list(rgb.getdata())
        white = sum(1 for p in px if p[0] > 230 and p[1] > 230 and p[2] > 230)
        orange = sum(1 for p in px if p[0] > 200 and p[1] < 130 and p[2] < 80)
        good = white > 10 and orange > 50
        ok &= good
        print(f"ico {size}px: white={white} orange={orange} {'OK' if good else 'GAGAL'}")
    for name in ("tile.png", "mono.png", "inverse.png"):
        rgba = Image.open(os.path.join(HERE, name))
        a = rgba.split()[3]
        ink = sum(a.histogram()[11:]) / (a.size[0] * a.size[1]) * 100
        print(f"{name}: tinta {ink:.1f}%")
        ok &= ink > 3
    # strip legibilitas
    strip = Image.new("RGB", (980, 260), (245, 245, 245))
    d = ImageDraw.Draw(strip)
    try:
        from PIL import ImageFont
        font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 16)
    except Exception:
        font = ImageFont.load_default()
    whitebg = Image.new("RGBA", (256, 256), (255, 255, 255, 255))
    whitebg.alpha_composite(Image.open(os.path.join(HERE, "tile.png")))
    whitebg.alpha_composite(Image.open(os.path.join(HERE, "tile-16.png")), (0, 0))
    x = 30
    for s in (16, 24, 32, 48):
        base = Image.new("RGBA", (256, 256), (255, 255, 255, 255))
        base.alpha_composite(Image.open(os.path.join(HERE, "tile.png")))
        m = base.resize((s, s), Image.LANCZOS)
        base16 = Image.new("RGBA", (256, 256), (255, 255, 255, 255))
        base16.alpha_composite(Image.open(os.path.join(HERE, "tile-16.png")))
        v = base16.resize((s, s), Image.LANCZOS)
        strip.paste(m.resize((s * 4, s * 4), Image.NEAREST), (x, 60))
        strip.paste(v.resize((s * 4, s * 4), Image.NEAREST), (x + s * 4 + 8, 60))
        d.text((x, 26), f"{s}px  master|redraw", fill=(0, 0, 0), font=font)
        x += s * 8 + 42
    strip.save(os.path.join(HERE, "legibility-strip.png"))
    print("strip: legibility-strip.png")
    print("SEMUA OK" if ok else "ADA YANG GAGAL")
    return 0 if ok else 1


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(check())
    build()
    sys.exit(check())
