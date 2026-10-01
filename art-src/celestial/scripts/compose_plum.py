"""Hybrid Far Plum: Codex image_gen ringless body (normalized by normalize_w2.py) + a programmatic ring.

Image generation kept drawing the ring with inconsistent geometry (front band not joining the ring ends),
so the ring is drawn here as an exact tilted elliptical band at art resolution:
  back half -> only where the body is transparent; front half -> over the body;
  a one-notch shadow on the body just below-right of the front band (light from top-left).

Usage: python compose_plum.py <body_96.png> <out.png>
"""
from __future__ import annotations

import math
import sys

from PIL import Image

CX, CY = 48.0, 49.0
RX, RY = 45.0, 11.0      # outer ellipse
WX, WY = 6.0, 3.2        # band width along each axis
TILT = -0.30             # radians; right end higher
RING = [(0x5C, 0x56, 0x78), (0x86, 0x82, 0xA2), (0xA9, 0xA4, 0xC2), (0xC9, 0xC2, 0xDC), (0xE4, 0xDD, 0xEC)]
EDGE = (0x3A, 0x33, 0x50)


def local(x: float, y: float) -> tuple[float, float]:
    dx, dy = x - CX, y - CY
    c, s = math.cos(TILT), math.sin(TILT)
    return dx * c + dy * s, -dx * s + dy * c


def band(x: float, y: float) -> float | None:
    """0..1 position across the band (0 = outer edge) or None outside."""
    u, v = local(x, y)
    outer = (u / RX) ** 2 + (v / RY) ** 2
    inner = (u / (RX - WX)) ** 2 + (v / (RY - WY)) ** 2
    if outer <= 1.0 and inner > 1.0:
        o, i = math.sqrt(outer), math.sqrt(inner)
        # normalised: 0 at outer edge, 1 at inner edge
        return max(0.0, min(1.0, (1.0 - o) / max(1e-6, (i - o) + (1.0 - o))))
    return None


def is_front(x: float, y: float) -> bool:
    return local(x, y)[1] > 0


def ring_colour(x: int, y: int, t: float, front: bool) -> tuple[int, int, int]:
    u, _ = local(x + 0.5, y + 0.5)
    lit = -u / RX  # left end lit
    k = 2 + (1 if lit > 0.25 else 0) + (1 if lit > 0.7 else 0) - (1 if lit < -0.45 else 0)
    if t > 0.62:   # inner edge one notch darker
        k -= 1
    if t < 0.2 and front:
        k += 1     # bright outer lip on the front band
    if not front:
        k -= 1
    return RING[max(0, min(len(RING) - 1, k))]


def main(body_path: str, out_path: str) -> None:
    body = Image.open(body_path).convert("RGBA")
    W, H = body.size
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bp, op = body.load(), out.load()
    # back ring
    for y in range(H):
        for x in range(W):
            t = band(x + 0.5, y + 0.5)
            if t is not None and not is_front(x + 0.5, y + 0.5):
                op[x, y] = ring_colour(x, y, t, False) + (255,)
    # body (with ring shadow) over the back ring
    for y in range(H):
        for x in range(W):
            c = bp[x, y]
            if not c[3]:
                continue
            sx, sy = x + 0.5 - 1.0, y + 0.5 - 2.5
            if band(sx, sy) is not None and is_front(sx, sy):
                c = tuple(round(v * 0.8) for v in c[:3]) + (255,)
            op[x, y] = c
    # front ring
    front_px = set()
    for y in range(H):
        for x in range(W):
            t = band(x + 0.5, y + 0.5)
            if t is not None and is_front(x + 0.5, y + 0.5):
                op[x, y] = ring_colour(x, y, t, True) + (255,)
                front_px.add((x, y))
    # thin dark edge where the front band's lower edge meets the body / space (readability at 2x)
    for (x, y) in front_px:
        below = (x, y + 1)
        if below not in front_px and y + 1 < H:
            t = band(x + 0.5, y + 0.5)
            if t is not None and t > 0.6 and bp[x, y + 1][3]:
                pass
            if bp[x, y + 1][3] == 0 and op[x, y + 1][3] == 0:
                op[x, y + 1] = EDGE + (255,)
    out.save(out_path, optimize=True)
    print(f"wrote {out_path} {out.size}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
