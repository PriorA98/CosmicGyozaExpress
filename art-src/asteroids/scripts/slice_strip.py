"""Slice a magenta-background strip of N isolated subjects into N separate PNGs.

Usage: python slice_strip.py <strip.png> <out_prefix> <count>
Splits on fully-background column gaps (magenta within tolerance), keeps the
<count> widest runs left-to-right, and pads each crop with magenta.
"""
import sys
from PIL import Image

def is_bg(p, tol=60):
    r, g, b = p[:3]
    return abs(r - 255) + g + abs(b - 255) <= tol

src, prefix, count = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert("RGB")
w, h = im.size
px = im.load()
cols = [any(not is_bg(px[x, y]) for y in range(0, h, 2)) for x in range(w)]
runs, start = [], None
for x, c in enumerate(cols + [False]):
    if c and start is None:
        start = x
    elif not c and start is not None:
        runs.append((start, x)); start = None
runs = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:count])
for i, (x0, x1) in enumerate(runs):
    rows = [y for y in range(h) if any(not is_bg(px[x, y]) for x in range(x0, x1))]
    crop = im.crop((x0, rows[0], x1, rows[-1] + 1))
    side = max(crop.size) + 40
    canvas = Image.new("RGB", (side, side), (255, 0, 255))
    canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    out = f"{prefix}-{i + 1}.png"
    canvas.save(out)
    print("wrote", out, crop.size)
