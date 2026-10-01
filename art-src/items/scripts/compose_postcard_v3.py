"""Compose memory-postcard.png v3 (96x64) with ON-MODEL tea house and ship (wave 2).

Codex's postcard-v3 generation got the scene (sky, Tea Moon, clouds, stamp) right, but at
90x58 the quantizer turned its cottage roof brick-red and its ship pale with a green-looking
pilot. So:
  1. the generated house and ship are painted out of the raw (column / row sky
     interpolation at raw resolution, moon disc re-filled where it was covered),
  2. the plate is pixelized to 90x58 with tools/art/pixelize.py (40 colours, cover, opaque),
  3. the CANONICAL sprites are stamped on top, box-downscaled from the production art:
       public/assets/lunar/lunar-teahouse.png  -> tea house sitting on the moon
       public/assets/ship/gyoza-idle.png       -> hero ship (dome interior glazed pale blue)
     plus a hand-placed cream puff trail behind the ship,
  4. framed in the same 3px parchment border as v1/v2 (make_postcard.py).

Usage: python art-src/items/scripts/compose_postcard_v3.py <raw.png> <out.png>
"""
from __future__ import annotations

import subprocess
import sys
from collections import deque
from pathlib import Path

from PIL import Image

W, H = 96, 64
BORDER = 3
IW, IH = W - 2 * BORDER, H - 2 * BORDER
EDGE = (0xD8, 0xC4, 0x9E, 255)
PARCH = (0xF4, 0xEC, 0xDC, 255)
SHADE = (0xEC, 0xDF, 0xC5, 255)
INK = (0x1D, 0x1F, 0x33, 255)
GLASS = (0xB9, 0xCF, 0xD8, 255)      # pale dusk-blue glass
GLASS_HI = (0xE9, 0xF1, 0xF0, 255)   # top-left glint
CREAM = (0xF9, 0xF3, 0xE5, 255)
CREAM_SH = (0xE6, 0xD4, 0xB4, 255)
WORK = Path("art-src/items/work")

# raw (1536x1024) regions occupied by Codex's own house and ship
SHIP_BOX = (790, 335, 1385, 690)
HOUSE_BOX = (170, 0, 720, 340)
MOON_C, MOON_R = (456, 530), 320
STAMP_BOX = (1244, 34, 1494, 302)   # postage stamp incl. perforations, raw px   # Tea Moon disc in raw px (measured)

# placement in the 90x58 picture (tunable from the command line: hx,hy,hw,sx,sy,sw)
PLACE = {"hx": 16, "hy": 0, "hw": 22, "sx": 59, "sy": 19, "sw": 24, "colors": 48}


def _luma(c: tuple[int, int, int]) -> float:
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def _median(px, xs, ys) -> tuple[int, int, int]:
    """Median sky colour of a sample window, ignoring bright stars / stamp paper."""
    vals = [px[x, y] for x in xs for y in ys]
    dark = [v for v in vals if 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2] < 125]
    vals = dark if len(dark) >= 4 else vals
    return tuple(sorted(v[i] for v in vals)[len(vals) // 2] for i in range(3))


def paint_out(raw: Image.Image) -> Image.Image:
    src = raw.convert("RGB")
    im = src.copy()
    sp, px = src.load(), im.load()
    w, h = src.size
    # ship: sky is a vertical gradient -> interpolate each column between robust (median)
    # samples of the clean sky just above and just below the box
    x0, y0, x1, y1 = SHIP_BOX
    for x in range(x0, x1):
        xs = range(max(0, x - 12), min(w, x + 13), 3)
        top = _median(sp, xs, range(y0 - 30, y0 - 2, 3))
        bot = _median(sp, xs, range(y1 + 2, y1 + 30, 3))
        for y in range(y0, y1):
            t = (y - y0) / (y1 - y0)
            px[x, y] = tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3))
    # house: interpolate each row between median sky strips left and right of the box;
    # inside the Tea Moon disc paint the moon (ink rim + body colour) instead
    x0, y0, x1, y1 = HOUSE_BOX
    body = _median(sp, range(380, 520, 4), range(360, 420, 4))
    cx, cy = MOON_C
    for y in range(y0, y1):
        ys = range(max(0, y - 12), min(h, y + 13), 3)
        lft = _median(sp, range(x0 - 34, x0 - 2, 3), ys)
        rgt = _median(sp, range(x1 + 2, x1 + 34, 3), ys)
        for x in range(x0, x1):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= MOON_R - 16:
                px[x, y] = body
            elif d <= MOON_R:
                px[x, y] = INK[:3]
            elif _luma(lft) > _luma(rgt) + 10:
                px[x, y] = rgt  # a star glow sits in the left strip: use the right sky only
            else:
                t = (x - x0) / (x1 - x0)
                px[x, y] = tuple(int(lft[i] * (1 - t) + rgt[i] * t) for i in range(3))
    return im


def outline(img: Image.Image) -> Image.Image:
    w, h = img.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(img, (1, 1))
    p = out.load()
    solid = {(x, y) for y in range(h + 2) for x in range(w + 2) if p[x, y][3]}
    for y in range(h + 2):
        for x in range(w + 2):
            if (x, y) not in solid and any((x + dx, y + dy) in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                p[x, y] = INK
    return out


def stamp(src: Image.Image, width: int) -> Image.Image:
    src = src.crop(src.getbbox())
    h = max(1, round(src.height * width / src.width))
    small = src.resize((width, h), Image.Resampling.BOX)
    p = small.load()
    for y in range(h):
        for x in range(width):
            r, g, b, a = p[x, y]
            p[x, y] = (r, g, b, 255) if a >= 110 else (0, 0, 0, 0)
    return outline(small)


def glaze_ship(src: Image.Image) -> Image.Image:
    """Fill the enclosed (transparent) dome interior of the hero sprite with pale glass."""
    im = src.convert("RGBA").copy()
    w, h = im.size
    p = im.load()
    ext = {(0, 0)}
    q = deque([(0, 0)])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < w and 0 <= n[1] < h and n not in ext and p[n][3] < 40:
                ext.add(n)
                q.append(n)
    holes = [(x, y) for y in range(h) for x in range(w) if p[x, y][3] < 40 and (x, y) not in ext]
    if holes:
        hx0 = min(x for x, _ in holes)
        hy0 = min(y for _, y in holes)
        for (x, y) in holes:
            glint = (x - hx0) + (y - hy0) < 14 and (x - hx0) > 3
            p[x, y] = GLASS_HI if glint else GLASS
    return im


def puff(canvas: Image.Image, cx: int, cy: int, r: int) -> None:
    p = canvas.load()
    pts = [(x, y) for y in range(cy - r - 1, cy + r + 2) for x in range(cx - r - 1, cx + r + 2)
           if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6
           and 0 <= x < canvas.width and 0 <= y < canvas.height]
    s = set(pts)
    for (x, y) in pts:
        p[x, y] = CREAM_SH if (x - cx) + (y - cy) >= r else CREAM
    for (x, y) in pts:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in s and 0 <= n[0] < canvas.width and 0 <= n[1] < canvas.height:
                p[n] = INK


def main() -> None:
    raw, out = Path(sys.argv[1]), Path(sys.argv[2])
    if len(sys.argv) > 3:
        for kv in sys.argv[3].split(","):
            k, v = kv.split("=")
            PLACE[k] = int(v)
    WORK.mkdir(parents=True, exist_ok=True)
    plate_path = WORK / f"{raw.stem}-plate.png"
    plate_px_path = WORK / f"{raw.stem}-plate-px.png"
    paint_out(Image.open(raw)).save(plate_path)
    subprocess.run(
        [sys.executable, "tools/art/pixelize.py", str(plate_path), str(plate_px_path),
         "--size", f"{IW}x{IH}", "--fit", "cover", "--opaque", "--key", "none",
         "--no-crop", "--colors", str(PLACE["colors"])],
        check=True,
    )
    pic = Image.open(plate_px_path).convert("RGBA")
    # the global 48-colour quantize pulls the stamp's terracotta cup into the plum clouds;
    # re-sample that corner on its own (box downscale + 8-colour quantize) and paste it back
    k = IW / 1536  # cover fit: 1536x1024 -> 90x60, 1px cropped top/bottom
    sb = STAMP_BOX
    sw, sh = round((sb[2] - sb[0]) * k), round((sb[3] - sb[1]) * k)
    patch = Image.open(raw).convert("RGB").crop(sb).resize((sw, sh), Image.Resampling.BOX)
    patch = patch.quantize(8, method=Image.Quantize.MEDIANCUT).convert("RGBA")
    pic.paste(patch, (round(sb[0] * k), round(sb[1] * k) - 1))

    house = stamp(Image.open("public/assets/lunar/lunar-teahouse.png").convert("RGBA"), PLACE["hw"])
    pic.alpha_composite(house, (PLACE["hx"], PLACE["hy"]))

    ship = stamp(glaze_ship(Image.open("public/assets/ship/gyoza-idle.png")), PLACE["sw"])
    sx, sy = PLACE["sx"], PLACE["sy"]
    mid = sy + ship.height * 2 // 3
    for (cx, cy, r) in ((sx - 11, mid + 1, 1), (sx - 6, mid, 2), (sx, mid - 1, 3)):
        puff(pic, cx, cy, r)
    pic.alpha_composite(ship, (sx, sy))
    pic.save(WORK / f"{raw.stem}-composite-px.png")

    card = Image.new("RGBA", (W, H), PARCH)
    p = card.load()
    for x in range(W):
        for y in range(H):
            if x in (0, W - 1) or y in (0, H - 1):
                p[x, y] = EDGE
            elif x == W - 2 or y == H - 2:
                p[x, y] = SHADE
    for c in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
        p[c] = (0, 0, 0, 0)
    card.paste(pic, (BORDER, BORDER))
    card.save(out, optimize=True)
    print(f"wrote {out} {card.size}")


if __name__ == "__main__":
    main()
