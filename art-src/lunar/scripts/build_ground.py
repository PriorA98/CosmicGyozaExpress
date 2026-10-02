"""Wave 2 lunar ground: keep the Codex-derived surface band (rows 0..~26 of the wave-1 normalized
strip, art-src/lunar/work/lunar-ground-w1.png) and repaint the lower regolith as calm, hand-tuned
strata so the bands stop reading as blotchy noise.

- Surface contract kept: rows 0-6 transparent except the pebbles on row 7, rows 8-63 fully opaque.
- Seamless: every band boundary is a sum of sines with integer periods over 640 px, and pebble
  placement wraps around x, so column 639 continues into column 0.
- Strata: 4 bands (warm grey-beige -> dusk grey -> dusk blue -> deep slate), each with a 1 px
  darker lip under the band above and a sparse 1 px light catch-line on its top (light from top-left).
- A few clean embedded pebbles per band (3-6 px ovals with top-left highlight and ink-ish shade).

Run from repo root:  python art-src/lunar/scripts/build_ground.py
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "art-src" / "lunar" / "work" / "lunar-ground-w1.png"
OUT = ROOT / "public" / "assets" / "lunar" / "lunar-ground.png"
W, H = 640, 64

# band fill, lip (darker, drawn on the last row of the band above), catch-light (top row of band)
BANDS = [
    # base row, amplitude terms (amp, periods-per-640, phase), fill, catch
    (27, [(1.6, 3, 0.4), (0.9, 7, 1.9)], (190, 178, 166), (204, 192, 176)),
    (39, [(1.8, 4, 2.2), (0.8, 9, 0.3)], (153, 158, 167), (170, 172, 176)),
    (50, [(1.5, 5, 4.0), (0.7, 11, 2.6)], (120, 134, 156), (138, 150, 168)),
    (59, [(1.2, 3, 1.1), (0.6, 8, 5.0)], (95, 97, 118), (110, 114, 134)),
]
TOP_FILL = (220, 202, 175)  # beige of the surface band just above the first stratum
LIP = {  # 1 px shade under the band above (selective outline in a darker local colour)
    0: (196, 180, 156),
    1: (166, 156, 148),
    2: (134, 140, 152),
    3: (100, 112, 134),
}


def boundary(base: int, terms: list[tuple[float, int, float]]) -> list[int]:
    raw = [base + sum(a * math.sin(2 * math.pi * n * x / W + p) for a, n, p in terms) for x in range(W)]
    ys = [round(v) for v in raw]
    # pixel-art clean-up: no 1 px steps that immediately revert (keeps runs >= 2 px)
    for _ in range(2):
        for x in range(W):
            l, r = ys[(x - 1) % W], ys[(x + 1) % W]
            if l == r and ys[x] != l:
                ys[x] = l
    return ys


def pebble(px, cx: int, cy: int, w: int, h: int, fill, hi, sh, lo_y: int, hi_y: int) -> None:
    for dy in range(h):
        for dx in range(w):
            # ellipse mask
            nx = (dx + 0.5 - w / 2) / (w / 2)
            ny = (dy + 0.5 - h / 2) / (h / 2)
            if nx * nx + ny * ny > 1.0:
                continue
            x, y = (cx + dx) % W, cy + dy
            if not (lo_y <= y < hi_y):
                continue
            c = fill
            if dy == 0 or (dx == 0 and dy <= h // 2):
                c = hi
            elif dy == h - 1 or (dx == w - 1 and dy >= h // 2):
                c = sh
            px[x, y] = (*c, 255)


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    out = src.copy()
    px = out.load()
    bounds = [boundary(b, t) for b, t, _f, _c in BANDS]
    rng = random.Random(20261002)

    # catch-light runs along each band top (long on/off runs, not per-pixel dither)
    catch_on = []
    for _ in BANDS:
        mask, x = [False] * W, 0
        while x < W:
            on = rng.random() < 0.72
            n = rng.randint(8, 26) if on else rng.randint(3, 10)
            for k in range(x, min(W, x + n)):
                mask[k] = on
            x += n
        catch_on.append(mask)

    for x in range(W):
        for y in range(H):
            band = -1
            for i, ys in enumerate(bounds):
                if y >= ys[x]:
                    band = i
            if band < 0:
                continue
            fill, catch = BANDS[band][2], BANDS[band][3]
            c = fill
            if y == bounds[band][x] and catch_on[band][x]:
                c = catch
            px[x, y] = (*c, 255)
        # lip: last row above each boundary gets a darker shade of the band above
        for i, ys in enumerate(bounds):
            y = ys[x] - 1
            if y >= 8 and (i == 0 or y >= bounds[i - 1][x] + 2):
                px[x, y] = (*LIP[i], 255)

    # soften the surface band right above stratum 0: replace stray grey crater remnants that the
    # boundary cut in half (rows 22..boundary) with the surface beige so no half-craters remain
    for x in range(W):
        for y in range(22, bounds[0][x] - 1):
            r, g, b, _a = px[x, y]
            if r < 205 and b > r - 40:
                px[x, y] = (*TOP_FILL, 255)

    # sparse horizontal sediment streaks (2-6 px, one tone darker), calm texture inside the bands
    for band in range(len(BANDS)):
        fill = BANDS[band][2]
        streak = tuple(max(0, v - 9) for v in fill)
        for _ in range(16):
            x0 = rng.randrange(W)
            n = rng.randint(3, 7)
            lo = max(bounds[band][x0], bounds[band][(x0 + n) % W]) + 2
            hi = (min(bounds[band + 1][x0], bounds[band + 1][(x0 + n) % W]) - 2) if band + 1 < len(BANDS) else H - 1
            if hi <= lo:
                continue
            y = rng.randint(lo, hi - 1)
            for k in range(n):
                px[(x0 + k) % W, y] = (*streak, 255)

    # sparse embedded pebbles, wrap-around placement keeps the strip seamless
    pebble_specs = [  # band index, count, (w range), (h range)
        (0, 7, (5, 7), (3, 4)),
        (1, 5, (4, 6), (3, 3)),
        (2, 4, (4, 5), (3, 3)),
    ]
    for band, count, wr, hr in pebble_specs:
        fill, catch = BANDS[band][2], BANDS[band][3]
        nxt = BANDS[band + 1][2]
        shade = tuple(max(0, v - 34) for v in nxt)
        hi = tuple(min(255, v + 22) for v in catch)
        body = tuple((a + b) // 2 for a, b in zip(fill, nxt))
        slots = list(range(count))
        for k in slots:
            cx = int((k + rng.random() * 0.6 + 0.2) * W / count)
            w = rng.randint(*wr)
            h = rng.randint(*hr)
            top = max(bounds[band][cx % W], bounds[band][(cx + w) % W]) + 2
            bottom = min(bounds[band + 1][cx % W], bounds[band + 1][(cx + w) % W]) - 2
            if bottom - top < h:
                continue
            cy = rng.randint(top, bottom - h)
            pebble(px, cx, cy, w, h, body, hi, shade, top, bottom)

    # contract check
    a = out.getchannel("A").load()
    assert all(a[x, y] == 255 for x in range(W) for y in range(8, H)), "rows 8+ must be opaque"
    assert all(a[x, y] == 0 for x in range(W) for y in range(0, 7)), "rows 0-6 must be empty"
    out.save(OUT, optimize=True)
    diff = sum(sum(abs(p - q) for p, q in zip(out.getpixel((0, y)), out.getpixel((W - 1, y)))) for y in range(H)) / H
    print(f"wrote {OUT} {out.size}; seam edge diff per row {diff:.1f}")


if __name__ == "__main__":
    main()
