"""Re-paint the sleepy rock's cheek blush, which colour quantization drops at small sizes.

Blush pixels are found in the raw generation (warm pink: r-b > 40, r-g > 45, r > 170), the raw
subject bbox is mapped linearly onto the output sprite's bbox, and every output pixel whose
footprint is >= `frac` blush (and has a painted 4-neighbour, so no strays) is set to the mean raw blush colour (blended 80/20 with the mean skin under it). Only opaque pixels are touched.

Usage: python restore_blush.py <raw.png> <sprite.png> <out.png> [frac=0.3]
"""
import sys
from PIL import Image

raw_p, spr_p, out_p = sys.argv[1:4]
frac = float(sys.argv[4]) if len(sys.argv) > 4 else 0.3
raw = Image.open(raw_p).convert("RGB")
spr = Image.open(spr_p).convert("RGBA")
rp, sp = raw.load(), spr.load()
rw, rh = raw.size

def is_bg(p):
    return (255 - p[0]) + p[1] + (255 - p[2]) <= 90

def is_blush(p):
    r, g, b = p
    return r > 170 and r - b > 40 and r - g > 45 and not is_bg(p)

xs = [x for x in range(0, rw, 2) for y in range(0, rh, 8) if not is_bg(rp[x, y])]
ys = [y for y in range(0, rh, 2) for x in range(0, rw, 8) if not is_bg(rp[x, y])]
rx0, rx1, ry0, ry1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
sx0, sy0, sx1, sy1 = spr.getbbox()
fx, fy = (rx1 - rx0) / (sx1 - sx0), (ry1 - ry0) / (sy1 - sy0)
acc, n, painted = [0, 0, 0], 0, []
for y in range(sy0, sy1):
    for x in range(sx0, sx1):
        if sp[x, y][3] == 0:
            continue
        ax, ay = int(rx0 + (x - sx0) * fx), int(ry0 + (y - sy0) * fy)
        hits = tot = 0
        for yy in range(ay, int(ay + fy)):
            for xx in range(ax, int(ax + fx)):
                tot += 1
                p = rp[xx, yy]
                if is_blush(p):
                    hits += 1
                    acc = [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]]
                    n += 1
        if tot and hits / tot >= frac:
            painted.append((x, y))
ps = set(painted)
painted = [(x, y) for x, y in painted if any(q in ps for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))]
col = tuple(round(c / max(n, 1)) for c in acc) + (255,)
under = [sp[x, y] for x, y in painted]
if under:
    mu = [sum(u[i] for u in under) / len(under) for i in range(3)]
    col = tuple(round(0.8 * col[i] + 0.2 * mu[i]) for i in range(3)) + (255,)
for x, y in painted:
    sp[x, y] = col
spr.save(out_p, optimize=True)
print(f"wrote {out_p}: blush {col[:3]} on {len(painted)} px")
