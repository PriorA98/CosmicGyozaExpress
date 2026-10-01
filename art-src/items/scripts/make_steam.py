"""Author the item-steam strip (4 frames, 16x24 each -> 64x24) directly at art resolution.

v2 (wave 2): reads on parchment as well as on dark space.
- stronger, more opaque plaster core
- warm-grey rim (instead of v1's cool dusk-grey) around the silhouette, darker on the
  lower-right (light from top-left) so the wisp has an edge against #F4ECDC
Puffs travel up a fixed S-curve; puff spacing equals the 4-frame travel distance, so
frame 4 -> frame 1 loops seamlessly. Alpha is quantized to a few steps for crisp pixels.

Usage: python art-src/items/scripts/make_steam.py <out.png>
"""
from __future__ import annotations

import math
import sys

from PIL import Image

FW, FH, FRAMES = 16, 24, 4
SPACING = 4.8  # px between puffs == travel per loop
STEP = SPACING / FRAMES

PLASTER = (0xFB, 0xF7, 0xEC)   # lit core
CREAM = (0xEE, 0xE4, 0xD3)     # body (warm, between plaster and parchment-deep)
RIM_LIGHT = (0xB9, 0xA7, 0x93)  # warm-grey rim, upper-left edges
RIM_DARK = (0x94, 0x80, 0x6E)   # warm-grey rim, lower-right shaded edges

THRESH = 0.10


def path_x(y: float) -> float:
    rise = (FH - y) / FH
    return 7.5 + 2.4 * math.sin(rise * 2.4 * math.pi - 0.6) + rise * 0.8


def build_field(t: int) -> list[list[float]]:
    puffs = []
    for k in range(-1, 9):
        y = FH - 1.5 - (k * SPACING + t * STEP)
        if y < -4 or y > FH + 3:
            continue
        rise = max(0.0, min(1.0, (FH - y) / FH))
        r = 3.9 - 2.0 * rise + 0.4 * math.sin(rise * math.pi)
        a = min(1.0, (FH - y) / 4.0) * (1.0 - rise ** 1.8)
        puffs.append((path_x(y), y, r, max(0.0, a)))

    def field(cx: float, cy: float) -> float:
        v = 0.0
        for (x, y, r, a) in puffs:
            d2 = ((cx - x) * 1.1) ** 2 + ((cy - y) * 0.8) ** 2
            v += a * math.exp(-d2 / (r * r * 0.42))
        return min(1.0, v * 1.05)

    return [[field(xx + 0.5, yy + 0.5) for xx in range(FW)] for yy in range(FH)]


def frame(t: int) -> Image.Image:
    f = build_field(t)
    img = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    px = img.load()

    def on(x: int, y: int) -> bool:
        return 0 <= x < FW and 0 <= y < FH and f[y][x] > THRESH

    for yy in range(FH):
        for xx in range(FW):
            v = f[yy][xx]
            if v <= THRESH:
                continue
            # fade the top of the plume: overall strength drives alpha
            fade = 1.0 if v > 0.55 else (0.88 if v > 0.3 else 0.74)
            # drop isolated specks (fewer than 2 lit 4-neighbours)
            if sum(on(xx + dx, yy + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) < 2:
                continue
            edge_lr = not on(xx + 1, yy) or not on(xx, yy + 1) or not on(xx + 1, yy + 1)
            edge_ul = not on(xx - 1, yy) or not on(xx, yy - 1)
            if edge_lr:
                col, a = RIM_DARK, 250
            elif edge_ul:
                col, a = RIM_LIGHT, 225
            elif v > 0.55:
                col, a = PLASTER, 250
            else:
                col, a = CREAM, 240
            px[xx, yy] = (*col, int(round(a * fade)))
    # post-pass: remove specks with fewer than 2 drawn 4-neighbours
    drawn = [[px[x, y][3] > 0 for x in range(FW)] for y in range(FH)]
    for y in range(FH):
        for x in range(FW):
            if drawn[y][x]:
                n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                        if 0 <= x + dx < FW and 0 <= y + dy < FH and drawn[y + dy][x + dx])
                if n < 2:
                    px[x, y] = (0, 0, 0, 0)
    # drop detached blobs smaller than 6 px (they flicker as noise at 2x)
    seen: set[tuple[int, int]] = set()
    for y in range(FH):
        for x in range(FW):
            if (x, y) in seen or px[x, y][3] == 0:
                continue
            comp, stack = [], [(x, y)]
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop()
                comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < FW and 0 <= ny < FH and (nx, ny) not in seen and px[nx, ny][3] > 0:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if len(comp) < 6:
                for cx, cy in comp:
                    px[cx, cy] = (0, 0, 0, 0)
    return img


def main() -> None:
    out = sys.argv[1]
    strip = Image.new("RGBA", (FW * FRAMES, FH), (0, 0, 0, 0))
    for t in range(FRAMES):
        strip.paste(frame(t), (t * FW, 0))
    strip.save(out, optimize=True)
    print(f"wrote {out} {strip.size}")


if __name__ == "__main__":
    main()
