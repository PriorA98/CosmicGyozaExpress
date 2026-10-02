"""Rebuild lunar-sky.png: clean banded dusk gradient + an authored ringed planet (dev tooling; Pillow).

Wave 3 round 3 (2026-10-02). Replaces the quantized Codex painting (kept as work/lunar-sky-w2.png):
  * the gradient keeps the w2 colour ramp but each band edge is a smooth sum of sines with integer
    periods over 640 px (seamless wrap), cleaned of 1 px back-and-forth steps; a few tapered
    horizontal cloud lenses sit in the warm lower sky;
  * stars and the two sparkle crosses are copied from the w2 sky (pixels well above their row's
    band colour), except near the planet;
  * the planet is drawn in the planet-far-plum idiom: 1 px darker rim, latitude bands on a tilted
    sphere in an 8-colour amber/terracotta/plum ramp, a terminator toward the bottom-right, a 1 px
    top-left limb catch-light and a continuous ring (back pass behind, front pass over the body,
    1 px ring shadow on the body).
Run from the repo root:  python art-src/lunar/scripts/build_sky.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "art-src" / "lunar" / "work" / "lunar-sky-w2.png"
OUT = ROOT / "public" / "assets" / "lunar" / "lunar-sky.png"
W, H = 640, 360

# (colour, first row of the band, wave terms (amp, cycles per 640 px, phase)) top to bottom
BANDS: list[tuple[tuple[int, int, int], int, list[tuple[float, int, float]]]] = [
    ((17, 19, 37), 0, []),
    ((19, 20, 42), 46, [(1.1, 2, 0.4), (0.2, 4, 1.1)]),
    ((21, 23, 45), 63, [(1.3, 2, 2.0), (0.2, 4, 0.3)]),
    ((23, 25, 50), 80, [(1.4, 3, 1.2), (0.3, 5, 2.2)]),
    ((26, 28, 58), 98, [(1.6, 2, 4.1), (0.3, 4, 0.8)]),
    ((30, 31, 66), 117, [(1.8, 3, 0.2), (0.3, 5, 1.7)]),
    ((33, 33, 72), 133, [(1.8, 2, 3.0), (0.3, 4, 2.6)]),
    ((37, 37, 79), 151, [(2.0, 3, 5.0), (0.4, 5, 0.1)]),
    ((43, 42, 87), 166, [(2.2, 2, 1.6), (0.4, 4, 3.3)]),
    ((48, 46, 94), 182, [(2.3, 3, 2.7), (0.4, 5, 1.0)]),
    ((55, 50, 101), 191, [(2.3, 2, 0.9), (0.5, 4, 4.0)]),
    ((64, 57, 109), 200, [(2.5, 3, 3.6), (0.5, 5, 2.0)]),
    ((76, 64, 117), 212, [(2.7, 2, 5.5), (0.5, 4, 0.6)]),
    ((93, 77, 131), 226, [(2.9, 3, 1.9), (0.6, 5, 3.0)]),
    ((108, 83, 133), 248, [(3.1, 2, 4.4), (0.6, 4, 1.4)]),
    ((127, 97, 148), 258, [(3.2, 3, 0.7), (0.6, 5, 2.8)]),
    ((141, 105, 149), 284, [(3.4, 2, 2.4), (0.6, 4, 4.6)]),
    ((161, 111, 138), 300, [(3.6, 3, 5.9), (0.7, 5, 0.2)]),
    ((194, 123, 119), 316, [(3.6, 2, 3.3), (0.7, 4, 1.9)]),
    ((219, 137, 97), 334, [(3.6, 3, 1.1), (0.7, 5, 3.9)]),
]

# tapered cloud lenses in the warm lower sky: (centre x, centre y, half length, max thickness, band index)
CLOUDS = [
    (96, 270, 58, 3, 16), (262, 292, 84, 4, 17), (430, 286, 44, 3, 17),
    (150, 314, 72, 4, 18), (360, 326, 90, 4, 19), (560, 318, 60, 3, 19),
]

# planet geometry (art px)
PCX, PCY, PR = 545, 206, 52
ROLL = math.radians(-12)        # ring/band tilt in the picture plane (rises to the right)
OPEN = math.radians(15)         # how far we see onto the ring's top face
RING_IN, RING_OUT = 1.50, 1.74  # ring radii in planet radii
RAMP = [
    (250, 226, 176),  # 0 highlight cream
    (242, 198, 138),  # 1 light amber
    (230, 168, 108),  # 2 amber
    (213, 138, 92),   # 3 warm terracotta
    (186, 112, 88),   # 4 terracotta deep
    (148, 92, 96),    # 5 terracotta-plum
    (113, 78, 110),   # 6 shadow plum
    (86, 64, 104),    # 7 deep shadow
]
RIM = (52, 40, 76)
RING_HI, RING_MID, RING_LO, RING_SHADE = (247, 218, 160), (226, 172, 112), (182, 120, 92), (122, 84, 108)


def wave(base: int, terms: list[tuple[float, int, float]]) -> list[int]:
    ys = [round(base + sum(a * math.sin(2 * math.pi * n * x / W + p) for a, n, p in terms)) for x in range(W)]
    for _ in range(3):
        for x in range(W):
            l, r = ys[(x - 1) % W], ys[(x + 1) % W]
            if l == r and ys[x] != l:
                ys[x] = l
    return ys


def gradient() -> Image.Image:
    img = Image.new("RGBA", (W, H), (*BANDS[0][0], 255))
    px = img.load()
    edges = [wave(b, t) for _, b, t in BANDS]
    for x in range(W):
        for y in range(H):
            idx = 0
            for i, e in enumerate(edges):
                if y >= e[x]:
                    idx = i
            px[x, y] = (*BANDS[idx][0], 255)
    for cx, cy, half, thick, band in CLOUDS:
        col = BANDS[band][0]
        for dx in range(-half, half + 1):
            t = 1 - (dx / half) ** 2
            th = max(1, round(thick * t ** 0.6))
            if t < 0.08:
                continue
            x = (cx + dx) % W
            # slight upward bow so lenses read as soft cloud bars, not rulers
            yc = cy - round(1.5 * t)
            for dy in range(th):
                px[x, yc + dy] = (*col, 255)
    return img


def copy_stars(img: Image.Image) -> int:
    """Copy the w2 stars/sparkles: small bright components only (<= 80 px: dots and the two sparkle crosses), away from the planet."""
    src = Image.open(SRC).convert("RGB")
    sp, px = src.load(), img.load()
    bright = {(x, y) for y in range(0, 250) for x in range(W) if sum(sp[x, y]) - sum(px[x, y][:3]) > 75}
    n, seen = 0, set()
    for start in bright:
        if start in seen:
            continue
        comp, stack = [], [start]
        seen.add(start)
        while stack:
            x, y = stack.pop()
            comp.append((x, y))
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in bright and q not in seen:
                    seen.add(q)
                    stack.append(q)
        if len(comp) > 80 or any(x > 596 and y > 196 for x, y in comp):
            continue
        if any((x - PCX) ** 2 + (y - PCY) ** 2 < (PR * 1.9) ** 2 for x, y in comp):
            continue
        for x, y in comp:
            px[x, y] = (*sp[x, y], 255)
            n += 1
    return n


def axes() -> tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]:
    """Planet spin axis and two ring-plane vectors in screen space (x right, y down, z toward viewer)."""
    # axis starts as screen-up, tipped toward the viewer by OPEN, then rolled by ROLL
    ax = (0.0, -math.cos(OPEN), math.sin(OPEN))
    e1 = (1.0, 0.0, 0.0)
    e2 = (0.0, math.sin(OPEN), math.cos(OPEN))
    c, s = math.cos(ROLL), math.sin(ROLL)

    def roll(v: tuple[float, float, float]) -> tuple[float, float, float]:
        return (v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2])

    return roll(ax), roll(e1), roll(e2)


def planet(img: Image.Image) -> None:
    px = img.load()
    ax, e1, e2 = axes()
    light = (-0.62, -0.58, 0.53)
    ln = math.sqrt(sum(v * v for v in light))
    light = tuple(v / ln for v in light)

    def ring_coords(x: float, y: float) -> tuple[float, float] | None:
        """Ring-plane radius (in planet radii) and depth sign for a screen point on the ring plane."""
        # solve P = a*e1 + b*e2 with P.xy = (x, y); z follows
        det = e1[0] * e2[1] - e1[1] * e2[0]
        if abs(det) < 1e-6:
            return None
        a = (x * e2[1] - y * e2[0]) / det
        b = (e1[0] * y - e1[1] * x) / det
        z = a * e1[2] + b * e2[2]
        return math.hypot(a, b), z

    def ring_colour(rho: float, a_ang: float, z: float):
        t = (rho - RING_IN) / (RING_OUT - RING_IN)
        if t < 0.18 or t > 0.88:
            col = RING_LO
        elif t < 0.5:
            col = RING_HI
        else:
            col = RING_MID
        # the far right ansa sits in the planet's shadow side: one step down
        return col

    ring_px: dict[tuple[int, int], tuple[tuple[int, int, int], float]] = {}
    for y in range(H):
        for x in range(W):
            dx, dy = (x + 0.5 - PCX) / PR, (y + 0.5 - PCY) / PR
            rc = ring_coords(dx, dy)
            if rc is None:
                continue
            rho, z = rc
            if RING_IN <= rho <= RING_OUT:
                ring_px[(x, y)] = (ring_colour(rho, 0.0, z), z)

    # ring outline: 1 px darker edge on the sky side of the ring band
    def is_ring(p: tuple[int, int]) -> bool:
        return p in ring_px

    # back pass + outlines first
    body: set[tuple[int, int]] = set()
    for y in range(PCY - PR - 1, PCY + PR + 2):
        for x in range(PCX - PR - 1, PCX + PR + 2):
            dx, dy = (x + 0.5 - PCX) / PR, (y + 0.5 - PCY) / PR
            if dx * dx + dy * dy <= 1.0:
                body.add((x, y))

    for (x, y), (col, z) in ring_px.items():
        if z < 0 and (x, y) not in body:
            px[x, y] = (*col, 255)
    for (x, y), (col, z) in ring_px.items():
        if (x, y) in body:
            continue
        for nx, ny in ((x, y - 1), (x, y + 1), (x - 1, y), (x + 1, y)):
            if (nx, ny) not in ring_px and (nx, ny) not in body and 0 <= ny < H and 0 <= nx < W:
                # outline only on the lower/outer edges (light from top-left keeps the upper edge soft)
                px[nx, ny] = (*RING_SHADE, 255) if ny > y or nx > x else px[nx, ny]

    # body
    shade: dict[tuple[int, int], int] = {}
    for (x, y) in body:
        dx, dy = (x + 0.5 - PCX) / PR, (y + 0.5 - PCY) / PR
        dz = math.sqrt(max(0.0, 1 - dx * dx - dy * dy))
        n = (dx, dy, dz)
        lam = max(0.0, sum(a * b for a, b in zip(n, light)))
        lat = sum(a * b for a, b in zip(n, ax))
        lon = math.atan2(sum(a * b for a, b in zip(n, e2)), sum(a * b for a, b in zip(n, e1)))
        if lam > 0.78:
            li = 0
        elif lam > 0.50:
            li = 1
        elif lam > 0.24:
            li = 2
        else:
            li = 4
        latw = lat + 0.035 * math.sin(2 * lon + 0.6)
        # latitude bands: 0 light zone, 1 belt, 2 dark accent belt
        if latw > 0.62:
            band = 1
        elif latw > 0.40:
            band = 0
        elif latw > 0.28:
            band = 1
        elif latw > 0.05:
            band = 0
        elif latw > -0.10:
            band = 2
        elif latw > -0.22:
            band = 1
        elif latw > -0.48:
            band = 0
        elif latw > -0.62:
            band = 1
        else:
            band = 0
        shade[(x, y)] = min(7, li + band + (1 if li == 0 and band else 0))

    # ring shadow on the body: just below the front pass
    for (x, y) in list(shade):
        dx, dy = (x + 0.5 - PCX) / PR, (y + 0.5 - PCY) / PR
        rc = ring_coords(dx, dy - 2.0 / PR)
        if rc and RING_IN <= rc[0] <= RING_OUT and rc[1] > 0 and (x, y) not in ring_px:
            shade[(x, y)] = min(7, shade[(x, y)] + 2)

    # clean isolated single pixels
    for _ in range(2):
        for (x, y), v in list(shade.items()):
            nb = [shade.get(p) for p in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))]
            nb = [n for n in nb if n is not None]
            if len(nb) == 4 and v not in nb:
                shade[(x, y)] = max(set(nb), key=nb.count)
            elif len(nb) >= 2 and nb.count(v) == 0 and (x - 1, y) in shade and (x + 1, y) in shade and shade[(x - 1, y)] == shade[(x + 1, y)]:
                shade[(x, y)] = shade[(x - 1, y)]

    for (x, y), v in shade.items():
        px[x, y] = (*RAMP[v], 255)

    # rim: 1 px darker outline on body pixels that touch the sky
    edge = [(x, y) for (x, y) in body if any(p not in body for p in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))]
    for x, y in edge:
        px[x, y] = (*RIM, 255)
    # top-left limb catch-light just inside the rim
    for x, y in edge:
        dx, dy = (x + 0.5 - PCX) / PR, (y + 0.5 - PCY) / PR
        if dx < -0.15 and dy < 0.25 and dx + dy < -0.55:
            ix, iy = x + (1 if dx < 0 else -1), y + (1 if dy < 0 else -1)
            for q in ((ix, y), (x, iy)):
                if q in body and q not in edge:
                    px[q[0], q[1]] = (*RAMP[0], 255)

    # front pass over the body
    for (x, y), (col, z) in ring_px.items():
        if z >= 0:
            px[x, y] = (*col, 255)
    # dark separation line just under the front pass where it crosses the body
    for (x, y), (col, z) in ring_px.items():
        if z >= 0 and (x, y) in body and (x, y + 1) in body and (x, y + 1) not in ring_px:
            px[x, y + 1] = (*RAMP[6], 255)


def main() -> None:
    img = gradient()
    n = copy_stars(img)
    planet(img)
    img.save(OUT, optimize=True)
    print(f"wrote {OUT} ({n} star px copied)")


if __name__ == "__main__":
    main()
