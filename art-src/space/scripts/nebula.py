"""Normalize a Codex nebula generation (clouds on flat black) into the 640x360 soft-alpha parallax layer.

Dev tooling only. Steps:
  1. derive alpha from brightness over the black background and un-premultiply colour
  2. cover-fit to (640 + BLEND) x 360 with a box filter, then on a 2x2 art grid (chunky dithered pixels)
  3. horizontal seam: cross-fade the first BLEND columns with the overflow columns -> wraps exactly
  4. band mask keeps the middle of the screen clear; overall alpha scaled low
  5. quantize colour (adaptive, CGE-snapped) and alpha (few levels, 4x4 Bayer ordered dither)

    python art-src/space/scripts/nebula.py <raw.png> <out.png> [--max-alpha 0.42] [--colors 28] [--blend 192]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "art"))
from pixelize import quantize  # noqa: E402

W, H = 640, 360
BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


def extract_alpha(img: Image.Image, floor: int, knee: int) -> Image.Image:
    rgb = img.convert("RGB")
    out = Image.new("RGBA", rgb.size)
    src, dst = rgb.load(), out.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = src[x, y]
            m = max(r, g, b)
            a = min(255, max(0, m - floor) * 255 // max(1, knee))
            if a <= 0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            # un-premultiply against black so faint wisps keep their hue
            s = 255 / a if a < 255 else 1.0
            dst[x, y] = (min(255, int(r * s)), min(255, int(g * s)), min(255, int(b * s)), a)
    return out


def quilt_seam(src, blend: int, g: int) -> list[int]:
    """Min-cost vertical path (image-quilting style) through the overlap of columns [0, blend) and [W, W+blend).

    Left of the path the layer shows the overflow columns (continuing from x=W-1, so the wrap is exact);
    right of it the original columns. Worked on the g-sized art grid so 2x2 clusters stay intact.
    """
    cols, rows = blend // g, H // g
    cost = [[0.0] * cols for _ in range(rows)]
    for r in range(rows):
        y = r * g
        for c in range(cols):
            x = c * g
            p, q = src[x, y], src[x + W, y]
            cost[r][c] = sum(abs(p[i] - q[i]) for i in range(4))
            # gentle pull toward the middle of the overlap so the cut never hugs an edge
            cost[r][c] += 0.15 * abs(c - cols / 2)
    acc = [row[:] for row in cost]
    back = [[0] * cols for _ in range(rows)]
    for r in range(1, rows):
        for c in range(cols):
            best, bc = None, c
            for dc in (-1, 0, 1):
                k = c + dc
                if 0 <= k < cols and (best is None or acc[r - 1][k] < best):
                    best, bc = acc[r - 1][k], k
            acc[r][c] += best or 0.0
            back[r][c] = bc
    c = min(range(cols), key=lambda k: acc[rows - 1][k])
    path = [0] * rows
    for r in range(rows - 1, -1, -1):
        path[r] = c
        c = back[r][c]
    seam = [0] * H
    for y in range(H):
        seam[y] = path[min(y // g, rows - 1)] * g
    return seam


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("src", type=Path)
    p.add_argument("out", type=Path)
    p.add_argument("--max-alpha", type=float, default=0.42)
    p.add_argument("--colors", type=int, default=28)
    p.add_argument("--blend", type=int, default=192)
    p.add_argument("--floor", type=int, default=10, help="brightness treated as empty black")
    p.add_argument("--knee", type=int, default=70, help="brightness above floor that reaches full alpha")
    p.add_argument("--grid", type=int, default=2, help="art-pixel cluster size inside the 640x360 layer")
    p.add_argument("--mid-clear", type=float, default=0.55, help="how strongly to fade the middle band (0..1)")
    p.add_argument("--no-snap", action="store_true", help="skip CGE palette snapping (keeps raw hues)")
    p.add_argument("--levels", type=int, default=5, help="alpha levels before dithering")
    p.add_argument("--seam", action="store_true", help="hard min-cost quilting seam instead of a cross-fade (no ghosting)")
    a = p.parse_args()

    raw = extract_alpha(Image.open(a.src), a.floor, a.knee)
    tw = W + a.blend
    scale = max(tw / raw.width, H / raw.height)
    nw, nh = round(raw.width * scale), round(raw.height * scale)
    # premultiplied resize avoids dark fringes
    pm = raw.convert("RGBa").resize((nw, nh), Image.Resampling.BOX)
    left, top = (nw - tw) // 2, (nh - H) // 2
    pm = pm.crop((left, top, left + tw, top + H))
    # chunky grid: downscale to grid then nearest back up
    g = a.grid
    pm = pm.resize((tw // g, H // g), Image.Resampling.BOX).resize((tw // g * g, H // g * g), Image.Resampling.NEAREST)
    if pm.width < tw:
        pm = pm.resize((tw, H), Image.Resampling.NEAREST)
    src = pm.load()

    out = Image.new("RGBa", (W, H))
    dst = out.load()
    b = a.blend
    seam = quilt_seam(src, b, g) if a.seam else None
    for y in range(H):
        ny = y / (H - 1)
        # band mask: 1 at top/bottom, dips in the middle third
        d = abs(ny - 0.5) / 0.5  # 0 centre .. 1 edges
        band = 1 - a.mid_clear * max(0.0, 1 - (d / 0.55)) ** 1.5
        for x in range(W):
            c = src[x, y]
            if seam is not None:
                if x < seam[y]:
                    c = src[x + W, y]
            elif x < b:
                t = x / b
                o = src[x + W, y]
                c = tuple(int(o[i] * (1 - t) + c[i] * t) for i in range(4))
            k = band * a.max_alpha
            dst[x, y] = tuple(int(v * k) for v in c)

    rgba = out.convert("RGBA")
    # quantize colour on an opaque copy (alpha handled separately)
    alpha = rgba.getchannel("A")
    solid = rgba.copy()
    solid.putalpha(255)
    q = quantize(solid, a.colors, None if a.no_snap else "cge")
    # alpha: snap to a few levels with ordered dither on the art grid
    top_a = int(255 * a.max_alpha)
    levels = [round(top_a * i / (a.levels - 1)) for i in range(a.levels)]
    apx = alpha.load()
    qa = Image.new("L", alpha.size)
    qpx = qa.load()
    for y in range(H):
        for x in range(W):
            v = apx[x, y] / max(1, top_a) * (a.levels - 1)
            lo = min(int(v), a.levels - 1)
            frac = v - lo
            th = (BAYER4[(y // g) % 4][(x // g) % 4] + 0.5) / 16
            idx = min(a.levels - 1, lo + (1 if frac > th else 0))
            qpx[x, y] = levels[idx]
    q.putalpha(qa)
    # fully transparent pixels -> zero rgb (smaller file, no colour bleed when filtered)
    data = [(0, 0, 0, 0) if px[3] == 0 else px for px in q.getdata()]
    q.putdata(data)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    q.save(a.out, optimize=True)
    print(f"wrote {a.out} {q.width}x{q.height} colours={len(q.getcolors(1 << 16) or [])}")


if __name__ == "__main__":
    main()
