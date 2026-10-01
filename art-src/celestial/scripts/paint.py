"""Tiny pixel painter shared by the celestial build scripts (dev tooling, Pillow only).

Everything is drawn directly at art resolution (1 art px = 2 screen px in game), so there is no
resampling: shapes are rasterised per pixel, shading is banded with a checker dither only in the
narrow transition between two ramp tones ("soft dithered terminator").
"""
from __future__ import annotations

import math
from PIL import Image

RGBA = tuple[int, int, int, int]

BAYER2 = ((0.25, 0.75), (1.0, 0.5))


def hx(c: str, a: int = 255) -> RGBA:
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)


def norm(v):
    l = math.sqrt(sum(c * c for c in v))
    return tuple(c / l for c in v)


LIGHT = norm((-0.62, -0.7, 0.55))  # top-left, slightly toward the viewer


def ramp_pick(ramp: list[RGBA], v: float, x: int, y: int, band: float = 0.32, dither_below: int = 99) -> RGBA:
    """v in [0,1] -> ramp colour; checker dither only in the middle `band` of each step,
    and only for steps whose lower index is < dither_below (keeps the lit side clean)."""
    v = min(max(v, 0.0), 1.0) * (len(ramp) - 1)
    i = int(v)
    if i >= len(ramp) - 1:
        return ramp[-1]
    f = v - i
    if i >= dither_below:
        band = 0.0
    lo, hi = 0.5 - band / 2, 0.5 + band / 2
    if f < lo:
        return ramp[i]
    if f > hi:
        return ramp[i + 1]
    return ramp[i + 1] if (x + y) % 2 == 0 else ramp[i]


def sphere_light(dx: float, dy: float, r: float) -> tuple[float, tuple[float, float, float]] | None:
    """Lambert-ish light for a point (dx,dy) from the disc centre; None if outside."""
    d2 = (dx * dx + dy * dy) / (r * r)
    if d2 > 1.0:
        return None
    nz = math.sqrt(1.0 - d2)
    n = (dx / r, dy / r, nz)
    lam = sum(a * b for a, b in zip(n, LIGHT))
    return lam, n


def shift(ramp: list[RGBA], c: RGBA, steps: int) -> RGBA:
    """Move a colour that is in `ramp` up/down the ramp."""
    if c not in ramp:
        return c
    i = min(max(ramp.index(c) + steps, 0), len(ramp) - 1)
    return ramp[i]


def outline(img: Image.Image, color_fn, only_where=None) -> None:
    """Add a 1px outline outside opaque pixels. color_fn(x, y) -> RGBA or None (skip)."""
    src = img.copy()
    s = src.load()
    p = img.load()
    W, H = img.size
    for y in range(H):
        for x in range(W):
            if s[x, y][3] != 0:
                continue
            if any(0 <= x + i < W and 0 <= y + j < H and s[x + i, y + j][3] == 255
                   for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c = color_fn(x, y)
                if c is not None:
                    p[x, y] = c


def inner_edge(img: Image.Image, color_fn) -> None:
    """Recolour opaque pixels on the silhouette edge. color_fn(x, y, current) -> RGBA or None."""
    src = img.copy()
    s = src.load()
    p = img.load()
    W, H = img.size
    for y in range(H):
        for x in range(W):
            if s[x, y][3] == 0:
                continue
            if any(not (0 <= x + i < W and 0 <= y + j < H) or s[x + i, y + j][3] == 0
                   for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c = color_fn(x, y, s[x, y])
                if c is not None:
                    p[x, y] = c


def in_ellipse(x: float, y: float, cx: float, cy: float, rx: float, ry: float, rot: float = 0.0) -> float:
    """Return normalised ellipse distance (<1 inside)."""
    dx, dy = x - cx, y - cy
    if rot:
        c, s = math.cos(rot), math.sin(rot)
        dx, dy = dx * c + dy * s, -dx * s + dy * c
    return (dx / rx) ** 2 + (dy / ry) ** 2


def preview(img: Image.Image, path: str, scale: int = 3) -> None:
    W, H = img.size
    o = Image.new("RGBA", (W * 2 + 8, H), (26, 27, 46, 255))
    o.alpha_composite(img)
    light = Image.new("RGBA", (W, H), (244, 236, 220, 255))
    light.alpha_composite(img)
    o.paste(light, (W + 8, 0))
    o.resize((o.width * scale, o.height * scale), Image.NEAREST).save(path)
