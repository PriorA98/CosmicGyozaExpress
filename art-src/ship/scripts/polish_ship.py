"""Polish the 9 Gyoza ship frames onto one 144x160 canvas on a 2x pixel grid.

Steps (see art-src/ship/PROVENANCE.md):
  1. register each original against gyoza-idle by the saucer band (offsets.json, from register.py;
     incident-04/05 use alpha-centroid alignment because the saucer is gone in those frames)
  2. paste onto a 144x160 canvas, saucer rim at the same place in every frame; detached debris
     that would be clipped by the canvas edge is nudged inward
  3. premultiplied 2x box downscale to 72x80 art px
     (dome ring: muddy grey mixes of outline+highlight above the rim are re-inked)
  4. alpha cleanup: hard alpha everywhere except pale glass pixels (dome), which keep 2 soft levels
  5. one shared palette for all frames (median cut, gently snapped toward design tokens)
  6. remove stray single pixels, fill pinholes, unify dark silhouette edge to ink #1D1F33,
     light warm rim light on top-left facing hull edge pixels
  7. 2x nearest upscale to 144x160
Run from repo root: python art-src/ship/scripts/polish_ship.py
"""
from __future__ import annotations

import json
import time
from PIL import Image

SRC = "art-src/ship/originals"
DST = "public/assets/ship"
CW, CH = 144, 160
AW, AH = CW // 2, CH // 2
OX, OY = 0, -6  # where the idle frame origin lands on the canvas
INK = (0x1D, 0x1F, 0x33)
RIM_Y = 28
HULL_ROWS = (RIM_Y - 2, 53)  # art rows of hull + legs (flames start below)
GLASS_RIM = (0xD9, 0xE4, 0xE8, 96)  # art-px row of the saucer rim (dome above)
TOKENS = ["1D1F33", "2F3149", "3D3E4D", "F4ECDC", "ECDFC5", "F9F3E5", "FBF7EC", "C97B5A", "A6614A",
          "E08A4B", "D4A055", "8DA17A", "6B7E5A", "9EB6C4", "9B8FB8", "6FA39A", "C26954",
          "7A4017", "8A5A3C", "B98A5E", "F2C49A", "F7D9A8", "5A5C70", "D9E4E8", "4B4D66"]
TOK = [tuple(int(t[i:i + 2], 16) for i in (0, 2, 4)) for t in TOKENS]

offsets = json.load(open("art-src/ship/scripts/offsets.json"))
offsets["gyoza-incident-04"].update(dx=7, dy=-5)    # explosion centred on the saucer centroid
offsets["gyoza-incident-05"].update(dx=-12, dy=7)   # smoke puff centred on the same point
NAMES = list(offsets)


def components(img: Image.Image, thr: int = 40):
    a = img.getchannel("A").load()
    W, H = img.size
    seen = set()
    comps = []
    for y in range(H):
        for x in range(W):
            if a[x, y] > thr and (x, y) not in seen:
                stack = [(x, y)]
                seen.add((x, y))
                pts = []
                while stack:
                    p = stack.pop()
                    pts.append(p)
                    for ddx in (-1, 0, 1):
                        for ddy in (-1, 0, 1):
                            q = (p[0] + ddx, p[1] + ddy)
                            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and a[q] > thr:
                                seen.add(q)
                                stack.append(q)
                comps.append(pts)
    return comps


def place(name: str) -> Image.Image:
    im = Image.open(f"{SRC}/{name}.png").convert("RGBA")
    o = offsets[name]
    M = 40
    big = Image.new("RGBA", (CW + 2 * M, CH + 2 * M), (0, 0, 0, 0))
    big.alpha_composite(im, (M + OX - o["dx"], M + OY - o["dy"]))
    comps = sorted(components(big), key=len, reverse=True)
    out = Image.new("RGBA", big.size, (0, 0, 0, 0))
    bp, op = big.load(), out.load()
    for i, pts in enumerate(comps):
        xs = [p[0] for p in pts]
        shift = 0
        if i > 0:  # detached debris: keep inside the canvas with a 2px margin
            lo, hi = M + 2, M + CW - 3
            if min(xs) < lo:
                shift = lo - min(xs)
            elif max(xs) > hi:
                shift = hi - max(xs)
        for (x, y) in pts:
            op[x + shift, y] = bp[x, y]
    for y in range(big.height):  # faint haze not in any component (glass)
        for x in range(big.width):
            if 0 < bp[x, y][3] <= 40 and op[x, y][3] == 0:
                op[x, y] = bp[x, y]
    return out.crop((M, M, M + CW, M + CH))


def downscale(img: Image.Image) -> Image.Image:
    p = img.load()
    out = Image.new("RGBA", (AW, AH))
    q = out.load()
    for y in range(AH):
        for x in range(AW):
            s = [p[2 * x + i, 2 * y + j] for i in (0, 1) for j in (0, 1)]
            at = sum(c[3] for c in s)
            if at == 0:
                q[x, y] = (0, 0, 0, 0)
                continue
            q[x, y] = tuple(round(sum(c[k] * c[3] for c in s) / at) for k in range(3)) + (round(at / 4),)
    return out


def is_glass(c) -> bool:
    r, g, b = c[:3]
    return b >= r - 6 and (r + g + b) / 3 > 110


SOFT_FRAMES = {"gyoza-incident-05"}  # dissipating smoke: keep 3 alpha levels everywhere


def clean_alpha(img: Image.Image, soft: bool = False) -> Image.Image:
    p = img.load()
    for y in range(AH):
        for x in range(AW):
            c = p[x, y]
            a = c[3]
            if soft:
                na = 0 if a < 28 else 90 if a < 90 else 170 if a < 180 else 255
            elif is_glass(c) and 30 <= a < 200:
                na = 110 if a < 120 else 180
            else:
                na = 255 if a >= 112 else 0
            p[x, y] = c[:3] + (na,) if na else (0, 0, 0, 0)
    return img


def build_palette(frames, n=32):
    pix = [c[:3] for f in frames for c in f.get_flattened_data() if c[3] > 0]
    strip = Image.new("RGB", (len(pix), 1))
    strip.putdata(pix)
    pal = strip.quantize(n, method=Image.Quantize.MEDIANCUT).getpalette()[: n * 3]
    cols = [tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]
    snapped = []
    for c in cols:
        t = min(TOK, key=lambda t: sum((a - b) ** 2 for a, b in zip(c, t)))
        d = sum((a - b) ** 2 for a, b in zip(c, t)) ** 0.5
        k = 0.6 if d < 30 else (0.3 if d < 55 else 0.0)
        snapped.append(tuple(round(a + (b - a) * k) for a, b in zip(c, t)))
    return snapped


def remap(img, pal):
    p = img.load()
    cache = {}
    for y in range(AH):
        for x in range(AW):
            c = p[x, y]
            if c[3] == 0:
                continue
            if c[:3] not in cache:
                cache[c[:3]] = min(pal, key=lambda t: sum((a - b) ** 2 for a, b in zip(c[:3], t)))
            p[x, y] = cache[c[:3]] + (c[3],)


def tidy(img, soft: bool = False):
    p = img.load()
    src = img.copy()
    s = src.load()

    def op(x, y):
        return 0 <= x < AW and 0 <= y < AH and s[x, y][3] > 0

    for y in range(AH):
        for x in range(AW):
            n8 = sum(op(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1) if i or j)
            if s[x, y][3] > 0 and n8 == 0:
                p[x, y] = (0, 0, 0, 0)  # stray pixel
            elif s[x, y][3] == 0 and all(0 <= x + i < AW and 0 <= y + j < AH and s[x + i, y + j][3] == 255
                                         for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                nb = [s[x + i, y + j] for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                p[x, y] = max(set(nb), key=nb.count)  # pinhole
    src = img.copy()
    s = src.load()

    def tr(x, y):
        return not (0 <= x < AW and 0 <= y < AH) or s[x, y][3] == 0

    # exterior = transparent pixels reachable from the canvas border (dome interior excluded)
    ext = set()
    stack = [(x, y) for x in range(AW) for y in (0, AH - 1)] + [(x, y) for y in range(AH) for x in (0, AW - 1)]
    while stack:
        q = stack.pop()
        if q in ext or not (0 <= q[0] < AW and 0 <= q[1] < AH) or s[q][3] != 0:
            continue
        ext.add(q)
        stack += [(q[0] + 1, q[1]), (q[0] - 1, q[1]), (q[0], q[1] + 1), (q[0], q[1] - 1)]
    for y in range(RIM_Y):
        for x in range(AW):
            c = s[x, y]
            if c[3] == 0:
                continue
            mx, mn = max(c[:3]), min(c[:3])
            lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
            if mx - mn >= 40 or lum >= 125:
                continue  # coloured or pale glass highlight: keep
            if c[3] < 255:
                p[x, y] = (0, 0, 0, 0)  # grey semi-transparent fringe around the dome ring
            elif any((x + i, y + j) in ext for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                p[x, y] = INK + (255,)  # outer dome ring: grey outline/highlight mix -> ink
    src = img.copy()
    s = src.load()
    for y in range(AH):
        for x in range(AW):
            c = s[x, y]
            if c[3] != 255:
                continue
            edge = tr(x - 1, y) or tr(x + 1, y) or tr(x, y - 1) or tr(x, y + 1)
            lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
            if edge and lum < 70:
                p[x, y] = INK + (255,)
    # outer halo: pale low-saturation fringe sitting outside the ink outline -> remove
    src = img.copy()
    s = src.load()
    for y in range(AH):
        for x in range(AW):
            c = s[x, y]
            if soft or c[3] == 0 or c[:3] == INK:
                continue
            nb = [(x + i, y + j) for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            touches_ext = any(q in ext for q in nb)
            touches_ink = any(0 <= q[0] < AW and 0 <= q[1] < AH and s[q][:3] == INK and s[q][3] == 255 for q in nb)
            low_sat = max(c[:3]) - min(c[:3]) < 45 and c[1] >= c[0] - 8
            lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
            if touches_ext and touches_ink and low_sat:
                p[x, y] = (0, 0, 0, 0)
            elif HULL_ROWS[0] <= y <= HULL_ROWS[1] and (c[3] < 255 or (touches_ext and low_sat and lum > 80)):
                p[x, y] = (0, 0, 0, 0)  # hull/legs: no soft fringe, no pale grey edge specks
    # glass rim light: 1px soft pale highlight outside the upper dome arc so it reads on dark space
    src = img.copy()
    s = src.load()
    for y in range(1, RIM_Y - 5):
        for x in range(1, AW - 1):
            if s[x, y][3] != 0 or (x, y) not in ext:
                continue
            below_or_side = [s[x, y + 1], s[x + 1, y], s[x - 1, y]]
            if any(c[:3] == INK and c[3] == 255 for c in below_or_side):
                p[x, y] = GLASS_RIM
    return img


def warm_rim(img):
    """1px warm highlight just inside the ink outline where the hull faces the top-left light."""
    src = img.copy()
    s = src.load()
    p = img.load()
    for y in range(2, AH - 1):
        for x in range(2, AW - 1):
            c = s[x, y]
            if c[3] != 255 or c[:3] == INK:
                continue
            r, g, b = c[:3]
            warm = r > g > b and r - b > 50 and r > 150
            ink_tl = s[x - 1, y][:3] == INK or s[x, y - 1][:3] == INK
            outside_tl = s[x - 2, y][3] == 0 or s[x, y - 2][3] == 0
            if warm and ink_tl and outside_tl:
                p[x, y] = (min(255, r + 22), min(255, g + 18), min(255, b + 10), 255)
    return img


def save_retry(img: Image.Image, path: str) -> None:
    """Windows: the dev server / watchers can briefly lock a PNG; retry a few times."""
    for i in range(10):
        try:
            img.save(path, optimize=True)
            return
        except OSError:
            time.sleep(0.3 * (i + 1))
    img.save(path, optimize=True)


def main():
    arts = [clean_alpha(downscale(place(n)), n in SOFT_FRAMES) for n in NAMES]
    pal = build_palette(arts, 32)
    for n, a in zip(NAMES, arts):
        remap(a, pal)
        tidy(a, n in SOFT_FRAMES)
        warm_rim(a)
        a.save(f"art-src/ship/art/{n}.png", optimize=True)
        save_retry(a.resize((CW, CH), Image.NEAREST), f"{DST}/{n}.png")
        print(n, "ok")


if __name__ == "__main__":
    main()
