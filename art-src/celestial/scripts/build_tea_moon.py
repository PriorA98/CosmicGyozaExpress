"""Build public/assets/celestial/tea-moon.png (192x192, transparent) - programmatic pixel art.

The Tea Moon: pale jade/cream moon, soft craters, a teacup-shaped crater full of tea, a tiny tea
house with a warm window on the upper limb and a wisp of steam; banded shading with a checker
dither only at the terminator. Run from repo root: python art-src/celestial/scripts/build_tea_moon.py
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from paint import hx, ramp_pick, sphere_light, in_ellipse, outline, inner_edge, preview  # noqa: E402

W = H = 192
CX, CY, R = 90, 112, 72

INK = hx("1D1F33")
# moon ramp, dark -> light (cool jade shadow to warm cream light)
MOON = [hx("3F5459"), hx("5C7470"), hx("7F9A86"), hx("A3B79A"), hx("C2CFAE"), hx("DCE3C8"), hx("EFEEDB"), hx("FBF7EC")]
TEA = [hx("7A4017"), hx("A6614A"), hx("C98A4E"), hx("D4A055"), hx("F2C49A")]
PORC = [MOON[2], MOON[4], MOON[6], MOON[7]]  # cup rim/handle in moon tones: a crater, not a decal

# maria: soft darker patches (cx, cy, rx, ry, rot, amount)
MARIA = [(64, 126, 24, 15, 0.4, 0.10), (112, 88, 15, 10, -0.3, 0.08), (118, 150, 18, 11, 0.2, 0.09),
         (44, 96, 10, 14, 0.0, 0.07)]
# soft craters (cx, cy, r)
CRATERS = [(52, 82, 10), (126, 116, 7), (78, 158, 11), (36, 126, 6), (108, 172, 5), (144, 96, 5),
           (96, 64, 4), (68, 56, 5), (140, 142, 7), (58, 106, 3), (104, 138, 4), (30, 102, 3),
           (118, 70, 3), (46, 150, 4), (152, 124, 3), (88, 84, 2), (62, 178, 3)]
CUP = (84, 112, 14)  # teacup crater: centre + bowl radius; handle to the right


def base_value(x: int, y: int) -> float | None:
    sl = sphere_light(x + 0.5 - CX, y + 0.5 - CY, R)
    if sl is None:
        return None
    lam, n = sl
    v = (lam + 0.30) / 1.22
    for (mx, my, rx, ry, rot, amt) in MARIA:
        d = in_ellipse(x, y, mx, my, rx, ry, rot)
        if d < 1.0:
            v -= amt * (1.0 if d < 0.6 else 0.6)
    for (cx, cy, r) in CRATERS:
        # foreshorten toward the limb
        dx, dy = cx - CX, cy - CY
        rr = math.hypot(dx, dy) / R
        squash = max(0.45, math.sqrt(max(0.0, 1 - rr * rr)))
        ang = math.atan2(dy, dx)
        d = in_ellipse(x, y, cx, cy, r * squash, r, ang) if rr > 0.05 else in_ellipse(x, y, cx, cy, r, r)
        ox, oy = (x - cx) / r, (y - cy) / r
        lit = (ox * 0.7 + oy * 0.7)  # >0 lower-right
        if d < 1.0:
            v -= 0.22
            if lit > 0.38 and d > 0.35:
                v += 0.34  # lit inner wall (lower-right crescent)
            elif lit < -0.2:
                v -= 0.10  # shadowed inner wall (upper-left)
        elif d < 1.5:
            if lit < -0.25:
                v += 0.13  # lit outer rim (upper-left)
            elif lit > 0.4:
                v -= 0.07
    return v


def paint() -> Image.Image:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    p = img.load()
    for y in range(H):
        for x in range(W):
            v = base_value(x, y)
            if v is None:
                continue
            p[x, y] = ramp_pick(MOON, v, x, y, band=0.3, dither_below=4)
    cup(p)
    return img


def cup(p) -> None:
    cx, cy, r = CUP
    hx_, hy_ = cx + r + 5, cy + 1  # handle centre
    for y in range(cy - r - 10, cy + r + 10):
        for x in range(cx - r - 10, cx + r + 16):
            if p[x, y][3] == 0:
                continue
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            dh = math.hypot(x + 0.5 - hx_, (y + 0.5 - hy_) * 1.15)
            ox, oy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
            # saucer: faint ring around the cup
            if r + 4.5 <= d < r + 6.0:
                lit = -(ox + oy)
                p[x, y] = MOON[5] if lit > 0.3 else (MOON[2] if lit < -0.3 else p[x, y])
            # handle ring (drawn first so the cup lip overlaps it)
            if 2.6 <= dh < 5.6 and d >= r + 1:
                p[x, y] = PORC[2] if (y < hy_ + 1) else PORC[1]
                if dh >= 4.8 or dh < 3.3:
                    p[x, y] = INK if dh >= 4.8 and x > hx_ - 1 else PORC[0]
            if d < r - 1.5:
                # tea surface: deep amber, lighter toward lower-right (reflected light), glint top-left
                t = 0.5 + (0.3 * (ox + oy) / 1.41 if d / r > 0.6 else 0.0)
                if d > r - 3.5 and (ox + oy) < 0:
                    t -= 0.35  # shadow under the upper-left lip
                c = ramp_pick(TEA, t, x, y, band=0.0)
                if 0.52 < d / r < 0.72 and -0.95 < math.atan2(oy, ox) + 2.36 < 0.55:
                    c = TEA[4] if d / r < 0.64 else TEA[3]  # curved reflection arc, upper-left
                p[x, y] = c
            elif d < r + 1.0:
                lit = -(ox + oy)
                p[x, y] = PORC[3] if lit > 0.4 else (PORC[2] if lit > -0.6 else PORC[1])
            elif d < r + 2.0:
                p[x, y] = INK if (ox + oy) > 0.3 else PORC[0]


def tea_house(img: Image.Image) -> None:
    p = img.load()
    WALL, WALL_S, WALL_L = hx("F4ECDC"), hx("ECDFC5"), hx("FBF7EC")
    ROOF, ROOF_D, ROOF_L = hx("C97B5A"), hx("A6614A"), hx("E5A07E")
    WOOD, WOOD_D = hx("8A5A3C"), hx("5C3A26")
    WIN, WIN_L, WIN_D = hx("E08A4B"), hx("F7D9A8"), hx("C26954")
    STONE, STONE_D = hx("8C8EA3"), hx("5A5C70")
    x0, x1 = 107, 127  # wall span
    floor = 43
    # stilts / stone footing down to the surface
    for x in range(x0 - 1, x1 + 2):
        y = floor + 1
        while y < H and p[x, y][3] == 0:
            y += 1
        for yy in range(floor + 1, min(y + 1, H)):
            if x in (x0, x0 + 1, x1 - 1, x1) or x == (x0 + x1) // 2:
                p[x, yy] = WOOD if x not in (x0, x1 - 1) else WOOD_D
            elif yy == floor + 1:
                p[x, yy] = WOOD_D
    # deck
    for x in range(x0 - 3, x1 + 4):
        p[x, floor] = WOOD
        p[x, floor + 1] = WOOD_D
    # walls
    top = floor - 11
    for y in range(top, floor):
        for x in range(x0, x1 + 1):
            c = WALL
            if x >= x1 - 3:
                c = WALL_S
            if x <= x0 + 1:
                c = WALL_L
            p[x, y] = c
    # timber posts
    for y in range(top, floor):
        p[x0, y] = WOOD
        p[x1, y] = WOOD_D
    for x in range(x0, x1 + 1):
        p[x, floor - 1] = WOOD
    # window (warm, glowing)
    wx0, wy0 = x0 + 3, top + 3
    for y in range(wy0, wy0 + 5):
        for x in range(wx0, wx0 + 6):
            p[x, y] = WIN
    for x in range(wx0, wx0 + 6):
        p[x, wy0 + 2] = WIN_D
    for y in range(wy0, wy0 + 5):
        p[wx0 + 3, y] = WIN_D
    p[wx0, wy0] = WIN_L
    p[wx0 + 1, wy0] = WIN_L
    p[wx0, wy0 + 1] = WIN_L
    p[wx0 + 4, wy0] = WIN_L
    for x in range(wx0 - 1, wx0 + 7):
        p[x, wy0 - 1] = WOOD_D
        p[x, wy0 + 5] = WOOD
    for y in range(wy0 - 1, wy0 + 6):
        p[wx0 - 1, y] = WOOD_D
        p[wx0 + 6, y] = WOOD_D
    # door
    dx0 = x1 - 6
    for y in range(top + 4, floor - 1):
        for x in range(dx0, dx0 + 4):
            p[x, y] = ROOF_D if x > dx0 else WOOD
    p[dx0 + 2, top + 8] = WIN_L  # knob
    # roof: two-tier pagoda with upturned eaves
    def roof_row(y, xa, xb, shade_from):
        for x in range(xa, xb + 1):
            p[x, y] = ROOF_D if x >= shade_from else ROOF
    ry = top - 1
    # lower tier
    roof_row(ry, x0 - 4, x1 + 4, x1)
    roof_row(ry - 1, x0 - 3, x1 + 3, x1 - 1)
    roof_row(ry - 2, x0 - 1, x1 + 1, x1 - 2)
    roof_row(ry - 3, x0 + 1, x1 - 1, x1 - 3)
    for x in range(x0 - 3, x1 + 3):  # light along the ridge line of the lower tier
        if p[x, ry - 1] == ROOF:
            p[x, ry - 2 if x0 - 1 <= x <= x1 + 1 else ry - 1] = ROOF_L if x < x1 - 4 else p[x, ry - 2]
    # eave tips curl up (attached to the lower tier)
    p[x0 - 5, ry] = ROOF
    p[x0 - 5, ry - 1] = ROOF
    p[x1 + 5, ry] = ROOF_D
    p[x1 + 5, ry - 1] = ROOF_D
    # upper tier
    uy = ry - 4
    for x in range(x0 + 4, x1 - 3):
        p[x, uy] = WALL_S
    roof_row(uy - 1, x0 + 1, x1 - 1, x1 - 4)
    roof_row(uy - 2, x0 + 2, x1 - 2, x1 - 5)
    roof_row(uy - 3, x0 + 4, x1 - 4, x1 - 6)
    p[x0, uy - 2] = ROOF
    p[x1, uy - 2] = ROOF_D
    for x in range(x0 + 2, x1 - 5):
        p[x, uy - 2] = ROOF_L
    # finial
    fx = (x0 + x1) // 2
    p[fx, uy - 4] = hx("D4A055")
    p[fx, uy - 5] = hx("D4A055")
    p[fx, uy - 6] = hx("F7D9A8")
    # little chimney (teapot spout-ish) on the right of the upper tier
    cxp = x1 - 4
    for y in range(uy - 6, uy - 2):
        p[cxp, y] = STONE
        p[cxp + 1, y] = STONE_D
    # hanging lantern on the eave, left
    lx = x0 - 3
    p[lx, ry + 1] = WOOD_D
    p[lx, ry + 2] = WIN
    p[lx, ry + 3] = WIN
    p[lx - 1, ry + 2] = WIN_D
    p[lx + 1, ry + 2] = WIN_L
    # steam wisp from the chimney: two soft alpha levels, curling up and to the right
    # steam: a curl of soft puffs from the chimney, shrinking and fading as it rises
    puffs = [(cxp + 1.0, uy - 9.0, 2.6, 235), (cxp + 4.0, uy - 13.0, 3.1, 235), (cxp + 2.0, uy - 18.5, 2.7, 210),
             (cxp + 5.0, uy - 23.0, 2.2, 180), (cxp + 9.0, uy - 25.5, 1.6, 150), (cxp + 12.0, uy - 26.0, 1.0, 120)]
    for (x, y, rad, a) in puffs:
        for yy in range(int(y - rad - 1), int(y + rad + 2)):
            for xx in range(int(x - rad - 1), int(x + rad + 2)):
                if not (0 <= xx < W and 0 <= yy < H):
                    continue
                dd = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
                if dd <= rad and p[xx, yy][3] < a:
                    shade = (xx + 0.5 - x) + (yy + 0.5 - y) > rad * 0.6
                    p[xx, yy] = hx("D9E4E8", a) if shade else hx("FBF7EC", a)


def finish(img: Image.Image) -> Image.Image:
    # ink outline only on the shadow side / lower half; lit limb keeps a soft jade edge
    def edge(x, y, c):
        if c[3] != 255:
            return None
        if c in MOON:
            dx, dy = x + 0.5 - CX, y + 0.5 - CY
            lit = -(dx * 0.62 + dy * 0.7) / R
            if lit < 0.15:
                return INK
            return MOON[3] if lit > 0.6 else MOON[2]
        return None
    inner_edge(img, edge)
    # outline the tea house silhouette (opaque, non-moon pixels) with ink
    src = img.copy()
    s = src.load()
    p = img.load()
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if s[x, y][3] != 0:
                continue
            nb = [s[x + 1, y], s[x - 1, y], s[x, y + 1], s[x, y - 1]]
            if any(c[3] == 255 and c not in MOON and c != INK for c in nb):
                p[x, y] = INK
    return img


def main() -> None:
    img = paint()
    tea_house(img)
    img = finish(img)
    out = Path("public/assets/celestial/tea-moon.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, optimize=True)
    if len(sys.argv) > 1:
        preview(img, sys.argv[1], 3)
    print(out, img.size)


if __name__ == "__main__":
    main()
