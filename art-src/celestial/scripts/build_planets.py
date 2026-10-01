"""Build the two background planets (programmatic pixel art, drawn at art resolution).

  public/assets/celestial/planet-far-plum.png  96x96  distant dusty plum planet, thin ring, low contrast
  public/assets/celestial/planet-im-fine.png  128x128 Planet "I'm Fine": wobbly lavender/teal, tiny bandage

Run from repo root: python art-src/celestial/scripts/build_planets.py [preview_dir]
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from paint import LIGHT, hx, ramp_pick, in_ellipse, inner_edge, preview  # noqa: E402

INK = hx("1D1F33")
OUT = Path("public/assets/celestial")


# --------------------------------------------------------------------------- far plum
def far_plum() -> Image.Image:
    W = H = 96
    cx, cy, r = 48, 49, 29
    PLUM = [hx("4F4566"), hx("5E5478"), hx("72688C"), hx("867BA0"), hx("9B8FB8"), hx("B0A6C9")]
    BAND = 0.07
    RING = [hx("6A6C85"), hx("8C8EA3"), hx("B6B2C8"), hx("C7BEDE")]
    tilt = -0.32  # ring tilt (radians)
    rx, ry = 44.0, 10.5
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    p = img.load()

    def ring_val(x, y):
        """Return ring colour or None; ring is a thin elliptical band."""
        d = in_ellipse(x + 0.5, y + 0.5, cx, cy, rx, ry, tilt)
        if 0.72 < d < 1.0:
            t = (x - (cx - rx)) / (2 * rx)
            inner = d < 0.82
            idx = 2 if t < 0.55 else 1
            if inner:
                idx = max(0, idx - 1)
            return RING[idx]
        return None

    def front(x, y):
        # front half of the ring = below the tilted major axis
        dx, dy = x + 0.5 - cx, y + 0.5 - cy
        c, s = math.cos(tilt), math.sin(tilt)
        return (-dx * s + dy * c) > 0

    # back ring
    for y in range(H):
        for x in range(W):
            rv = ring_val(x, y)
            if rv is not None and not front(x, y):
                p[x, y] = rv
    # planet body
    for y in range(H):
        for x in range(W):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d2 = (dx * dx + dy * dy) / (r * r)
            if d2 > 1:
                continue
            nz = math.sqrt(1 - d2)
            lam = (dx / r) * LIGHT[0] + (dy / r) * LIGHT[1] + nz * LIGHT[2]
            v = (lam + 0.25) / 1.25
            # soft dusty bands, parallel to the ring
            c, s = math.cos(tilt), math.sin(tilt)
            by = (-dx * s + dy * c) / r
            band = math.sin(by * 9.0 + 0.6) + 0.5 * math.sin(by * 17.0 + 2.0)
            if band > 0.85:
                v -= BAND
            elif band < -1.0:
                v += BAND * 0.7
            p[x, y] = ramp_pick(PLUM, v, x, y, band=0.34, dither_below=3)
    # ring shadow on the planet (thin, just above the front ring)
    for y in range(H):
        for x in range(W):
            if p[x, y][3] and p[x, y] in PLUM:
                d = in_ellipse(x + 0.5, y + 0.5 + 2.5, cx, cy, rx, ry, tilt)
                if 0.8 < d < 1.0 and front(x, y + 3):
                    i = PLUM.index(p[x, y])
                    p[x, y] = PLUM[max(0, i - 1)]
    # front ring
    for y in range(H):
        for x in range(W):
            rv = ring_val(x, y)
            if rv is not None and front(x, y):
                p[x, y] = rv
    # low-contrast outline: deep plum on the shadow side only
    def edge(x, y, c):
        if c in PLUM:
            lit = -((x - cx) * 0.62 + (y - cy) * 0.7) / r
            return PLUM[0] if lit < 0.2 else None
        return None
    inner_edge(img, edge)
    return img


# --------------------------------------------------------------------------- I'm Fine
def im_fine() -> Image.Image:
    W = H = 128
    cx, cy = 64, 66
    LAV = [hx("4A4466"), hx("5E5478"), hx("7A6E9C"), hx("9B8FB8"), hx("B3A8D0"), hx("C7BEDE"), hx("DDD6EC")]
    TEAL = [hx("2F4F55"), hx("3E6B6A"), hx("4E8077"), hx("6FA39A"), hx("8FBDB2"), hx("A9C9C2"), hx("CFE3DC")]

    def radius(a):
        return 46 + 1.3 * math.sin(3 * a + 0.4) + 0.9 * math.sin(5 * a + 1.9) + 0.5 * math.sin(2 * a + 2.6)

    def teal_field(u, v):
        # low-frequency blobs on the sphere surface (u,v in -1..1)
        f = (math.sin(u * 4.1 + 1.3) * math.cos(v * 3.3 - 0.4)
             + 0.6 * math.sin((u + v) * 5.7 + 0.9) + 0.35 * math.cos(u * 9.0 - v * 6.0))
        return f

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    p = img.load()
    for y in range(H):
        for x in range(W):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            a = math.atan2(dy, dx)
            rr = radius(a)
            d = math.hypot(dx, dy) / rr
            if d > 1:
                continue
            nz = math.sqrt(max(0.0, 1 - d * d))
            nx, ny = dx / rr, dy / rr
            lam = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
            v = (lam + 0.28) / 1.25
            # sphere-ish texture coords so patches wrap with the curvature
            u_, v_ = nx / max(0.35, nz) ** 0.35, ny / max(0.35, nz) ** 0.35
            f = teal_field(u_, v_)
            ramp = TEAL if f > 0.55 else LAV
            if 0.55 < f < 0.75:
                v -= 0.05  # slightly darker patch edge
            p[x, y] = ramp_pick(ramp, v, x, y, band=0.34, dither_below=3)
    # silhouette: ink on the shadow side, darker local colour on the lit side
    def edge(x, y, c):
        lit = -((x - cx) * 0.62 + (y - cy) * 0.7) / 46
        if lit < 0.25:
            return INK
        return LAV[2] if c in LAV else TEAL[2]
    inner_edge(img, edge)
    bandage(img, cx - 22, cy - 22)
    return img


def bandage(img: Image.Image, bx: int, by: int) -> None:
    """Little cross-shaped adhesive bandage stuck on the upper-left (crack peeking out)."""
    p = img.load()
    PL, PL_S, PL_L, PAD, PAD_S, EDGE = (hx("F4ECDC"), hx("E5D2B4"), hx("FBF7EC"), hx("F2C49A"),
                                         hx("E0A983"), hx("B98A5E"))
    CRACK = hx("4A4466")
    # crack peeking out from under the bandage
    for (x, y) in [(bx - 12, by + 1), (bx - 13, by + 2), (bx - 14, by + 2), (bx - 15, by + 3),
                   (bx + 12, by - 1), (bx + 13, by - 1), (bx + 14, by - 2), (bx + 15, by - 2), (bx + 16, by - 3)]:
        p[x, y] = CRACK
    def strip(rot):
        c, s = math.cos(rot), math.sin(rot)
        pts = {}
        for yy in range(by - 12, by + 13):
            for xx in range(bx - 12, bx + 13):
                dx, dy = xx + 0.5 - bx, yy + 0.5 - by
                u, v = dx * c + dy * s, -dx * s + dy * c
                if abs(u) <= 11.5 and abs(v) <= 2.6 and not (abs(u) > 10.5 and abs(v) > 1.6):
                    pts[(xx, yy)] = (u, v)
        return pts
    a = strip(-0.55)
    b = strip(-0.55 + math.pi / 2)
    allp = {**a, **b}
    # outline first
    for (x, y) in allp:
        for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + i, y + j)
            if q not in allp:
                p[q] = EDGE
    for (x, y), (u, v) in allp.items():
        col = PL
        if v > 1.6:
            col = PL_S  # lower edge of the strip in shade
        if v < -1.8 and u < 0:
            col = PL_L
        p[x, y] = col
    # centre pad
    for (x, y) in allp:
        dx, dy = x + 0.5 - bx, y + 0.5 - by
        if max(abs(dx), abs(dy)) <= 2.6:
            p[x, y] = PAD if dx + dy < 1.5 else PAD_S
    # tiny breathing holes on the strips
    for (x, y), (u, v) in a.items():
        if abs(v) < 0.6 and abs(u) in (5.5, 7.5) or (round(u) in (-6, 6) and round(v) == 0):
            p[x, y] = PL_S


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    prev = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    for name, fn in (("planet-far-plum", far_plum), ("planet-im-fine", im_fine)):
        img = fn()
        img.save(OUT / f"{name}.png", optimize=True)
        if prev:
            preview(img, str(prev / f"{name}.preview.png"), 4)
        print(name, img.size)


if __name__ == "__main__":
    main()
