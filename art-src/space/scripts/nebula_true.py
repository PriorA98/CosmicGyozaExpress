"""Rebuild the nebula parallax layer at TRUE 640x360 art resolution (1 art px per file px). Dev tooling only.

Round-2 replacement for nebula.py (which collapsed the layer onto a 2x2 grid, i.e. 320x180 effective art).

  1. Gaussian-blur the raw generation (clouds on flat black) to erase its coarse ~6 px pixel grid and
     checker-dither fringe. Over black the RGB is already premultiplied, so blurring it is exact.
  2. Cover-fit to (640 + BLEND) x 360 with a box filter -> a smooth source at the true target resolution.
  3. Alpha from brightness over black (floor/knee), colour un-premultiplied so faint wisps keep their hue.
  4. Horizontal seam: min-cost vertical quilting path through the overlap (cols [0,BLEND) vs [640,640+BLEND)),
     feathered a few px on the smooth source, so the wrap at x=639 -> x=0 is exact.
  5. Top/bottom EDGE rows fade to fully transparent (smoothstep), so an exposed band edge is invisible.
  6. Re-pixelize: colour -> adaptive palette (no dither => stepped colour bands);
     alpha -> a few stepped levels with a narrow 1 px ordered-dither transition between steps.

    python art-src/space/scripts/nebula_true.py <raw.png> <out.png> [--max-alpha 0.5] [--colors 28]
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageFilter

W, H = 640, 360
BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


def smoothstep(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def quilt_seam(src, blend: int) -> list[int]:
    """Per-row cut column inside the overlap; left of it the overflow columns (continuing from x=W-1) are shown."""
    cols, rows = blend, H
    acc = [[0.0] * cols for _ in range(rows)]
    back = [[0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            p, q = src[c, r], src[c + W, r]
            cost = sum(abs(p[i] - q[i]) for i in range(3)) + 0.15 * abs(c - cols / 2)
            if r == 0:
                acc[r][c] = cost
                continue
            best, bc = None, c
            for dc in (-1, 0, 1):
                k = c + dc
                if 0 <= k < cols and (best is None or acc[r - 1][k] < best):
                    best, bc = acc[r - 1][k], k
            acc[r][c] = cost + (best or 0.0)
            back[r][c] = bc
    c = min(range(cols), key=lambda k: acc[rows - 1][k])
    path = [0] * rows
    for r in range(rows - 1, -1, -1):
        path[r] = c
        c = back[r][c]
    return path


def quantize_with_warm(colour: Image.Image, alpha_f: list[list[float]], colors: int, warm: int) -> Image.Image:
    """Median-cut palette over visible pixels, plus `warm` slots cut from the warm (amber) highlight pixels only,
    so the few top-left amber rims are not averaged away by the dominant plum/teal."""
    vis = [colour.getpixel((x, y)) for y in range(H) for x in range(W) if alpha_f[y][x] > 0.05]
    def cut(pxs: list[tuple[int, int, int]], n: int) -> list[int]:
        if not pxs or n <= 0:
            return []
        im = Image.new("RGB", (len(pxs), 1))
        im.putdata(pxs)
        pal = im.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        used = sorted({i for i in pal.getdata()})
        flat = pal.getpalette() or []
        return [v for i in used for v in flat[i * 3 : i * 3 + 3]]
    warm_px = [c for c in vis if c[0] > c[2] + 12 and c[0] > c[1] + 6]
    flat = cut(vis, colors - (warm if warm_px else 0)) + cut(warm_px, warm)
    flat += [0, 0, 0]
    pal_img = Image.new("P", (1, 1))
    pal_img.putpalette(flat + [0, 0, 0] * (256 - len(flat) // 3))
    return colour.quantize(palette=pal_img, dither=Image.Dither.NONE).convert("RGB")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("src", type=Path)
    p.add_argument("out", type=Path)
    p.add_argument("--max-alpha", type=float, default=0.5)
    p.add_argument("--colors", type=int, default=28)
    p.add_argument("--blend", type=int, default=192)
    p.add_argument("--blur", type=float, default=5.0, help="gaussian radius in RAW px (erases the raw pixel grid)")
    p.add_argument("--floor", type=int, default=8, help="brightness treated as empty black")
    p.add_argument("--knee", type=int, default=60, help="brightness above floor that reaches full alpha")
    p.add_argument("--levels", type=int, default=4, help="alpha steps including 0")
    p.add_argument("--dither-width", type=float, default=0.35, help="fraction of each alpha step that is dithered")
    p.add_argument("--feather", type=int, default=6, help="px feathered either side of the seam path")
    p.add_argument("--edge", type=int, default=16, help="rows at top/bottom fading to fully transparent")
    p.add_argument("--edge-wave", type=float, default=7.0, help="px of x-periodic waviness in the edge fade")
    p.add_argument("--median", type=int, default=0, help="odd median size in RAW px applied before the blur")
    p.add_argument("--warm", type=int, default=0, help="extra palette slots reserved for warm (amber) highlights")
    p.add_argument("--squash", type=float, default=1.0, help="extra vertical scale (<1 keeps more of the raw bands)")
    a = p.parse_args()

    raw = Image.open(a.src).convert("RGB")
    if a.median > 1:
        raw = raw.filter(ImageFilter.MedianFilter(a.median))
    raw = raw.filter(ImageFilter.GaussianBlur(a.blur))
    tw = W + a.blend
    scale = max(tw / raw.width, H / raw.height)
    nw, nh = round(raw.width * scale), max(H, round(raw.height * scale * a.squash))
    sm = raw.resize((nw, nh), Image.Resampling.BOX)
    left, top = (nw - tw) // 2, (nh - H) // 2
    sm = sm.crop((left, top, left + tw, top + H))
    src = sm.load()

    # 4. seam on the smooth (premultiplied) source
    path = quilt_seam(src, a.blend)
    f = max(1, a.feather)
    pm = Image.new("RGB", (W, H))
    dst = pm.load()
    for y in range(H):
        s = path[y]
        for x in range(W):
            c = src[x, y]
            if x < a.blend:
                o = src[x + W, y]
                # t=0 -> overflow (wraps exactly), t=1 -> original; ramp across [s-f, s+f]
                t = smoothstep((x - (s - f)) / (2 * f))
                c = tuple(int(o[i] * (1 - t) + c[i] * t + 0.5) for i in range(3))
            dst[x, y] = c

    # 3 + 5. alpha from brightness, un-premultiply, edge fade
    top_a = 255 * a.max_alpha
    colour = Image.new("RGB", (W, H))
    cpx = colour.load()
    alpha_f = [[0.0] * W for _ in range(H)]
    # x-periodic waviness (integer wave counts over W => wraps exactly) so the fade reads as dissolving puffs,
    # not straight stepped stripes. Separate phase for top and bottom.
    def scallop(x: int, ph: float) -> float:
        """0..1, rounded cloud-bump profile repeating an integer number of times over W (wraps exactly)."""
        t = 2 * math.pi * x / W
        v = 0.6 * abs(math.sin(5 * t / 2 * 2 + ph)) ** 0.6 + 0.4 * abs(math.sin(11 * t / 2 * 2 + 1.7 * ph)) ** 0.6
        return min(1.0, v)

    for y in range(H):
        for x in range(W):
            d = min(y, H - 1 - y)
            if a.edge:
                # puffs bulge toward the edge; between them the fade reaches deeper (up to edge-wave px)
                off = a.edge_wave * (1 - scallop(x, 0.0 if y < H // 2 else 2.4))
                ramp = max(2.0, a.edge - 2 - a.edge_wave)
                edge = 0.0 if d < 2 else smoothstep((d - 2 - off) / ramp)
            else:
                edge = 1.0
            r, g, b = dst[x, y]
            m = max(r, g, b)
            al = min(1.0, max(0.0, (m - a.floor) / a.knee))
            if al <= 0:
                cpx[x, y] = (0, 0, 0)
                continue
            k = 1 / al
            cpx[x, y] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)))
            alpha_f[y][x] = al * edge

    # 6. colour -> stepped bands (no dither)
    q = quantize_with_warm(colour, alpha_f, a.colors, a.warm).convert("RGBA")
    qpx = q.load()
    n = a.levels - 1
    levels = [round(top_a * i / n) for i in range(a.levels)]
    dw = max(0.01, a.dither_width)
    for y in range(H):
        for x in range(W):
            v = alpha_f[y][x] * n
            lo = min(int(v), n)
            frac = v - lo
            # dither only in a narrow window around the middle of each step -> stepped bands with broken edges
            fr = min(1.0, max(0.0, (frac - 0.5) / dw + 0.5))
            th = (BAYER4[y % 4][x % 4] + 0.5) / 16
            idx = min(n, lo + (1 if fr > th else 0))
            al = levels[idx]
            if al == 0:
                qpx[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, _ = qpx[x, y]
                qpx[x, y] = (r, g, b, al)

    a.out.parent.mkdir(parents=True, exist_ok=True)
    q.save(a.out, optimize=True)
    print(f"wrote {a.out} {q.width}x{q.height} colours={len(q.convert('RGB').getcolors(1 << 16) or [])}")


if __name__ == "__main__":
    main()
