"""Break a chunky faceted face off a round sprite (crumb rock, wave 3).

Replaces the wave-2 straight `cut_flat.py` chord. The removed region is a polygon whose inner
boundary is a polyline of short facets, so the broken side reads as a chunky rock edge instead
of a knife cut. After the cut:
  * single-pixel spurs and 1 px notches along the new edge are cleaned so stair steps stay chunky,
  * a fracture face band (distance 2..face+1 from the cut, BFS) is painted with the rock's own
    lavender shadow ramp, darkest next to the outline, so the lower-left sits in shadow
    (light comes from the top-left) and no light strip remains,
  * the whole silhouette is re-inked with the same 1 px outline colour the sprite already uses
    (the most common dark edge colour), so the outline is continuous all the way round.

Usage: python chunk_cut.py <in.png> <out.png> "x0,y0 x1,y1 ..." [ramp=#575172,#726A92,#88799E] [crease=#9486AA]
  polyline points are in pixel coordinates, ordered along the cut; the removal polygon is the
  polyline closed through the canvas corner nearest the cut's midpoint.
"""
import sys
from collections import Counter, deque
from PIL import Image, ImageDraw

src, dst, pts_s = sys.argv[1], sys.argv[2], sys.argv[3]
hexc = lambda s: tuple(int(s.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
ramp = [hexc(c) for c in (sys.argv[4] if len(sys.argv) > 4 else "#575172,#726A92,#88799E").split(",")]
crease = hexc(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "none" else None
pts = [tuple(float(v) for v in p.split(",")) for p in pts_s.split()]

im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()
lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def is_edge(x, y):
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] == 0:
            return True
    return False


dark = Counter(px[x, y] for y in range(h) for x in range(w)
               if px[x, y][3] and is_edge(x, y) and lum(px[x, y]) <= 70)
ink = dark.most_common(1)[0][0]

# removal polygon: polyline + the canvas corner closest to the polyline midpoint
mx = sum(p[0] for p in pts) / len(pts)
my = sum(p[1] for p in pts) / len(pts)
cx = 0 if mx < w / 2 else w
cy = 0 if my < h / 2 else h
(sx, sy), (ex, ey) = pts[0], pts[-1]
poly = list(pts) + [(ex if cy == h else cx, cy), (cx, cy), (cx, sy if cx == 0 else ey)]
mask = Image.new("L", (w, h), 0)
ImageDraw.Draw(mask).polygon(poly, fill=255)
mk = mask.load()
cut = set()
for y in range(h):
    for x in range(w):
        if mk[x, y] and px[x, y][3]:
            px[x, y] = (0, 0, 0, 0)
            cut.add((x, y))

# clean spurs (opaque px with <= 1 opaque 4-neighbour) and fill 1 px notches (transparent px
# with >= 3 opaque 4-neighbours) near the cut, a few passes
def n4(x, y):
    return sum(1 for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
               if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3])

near = lambda x, y: any((x + dx, y + dy) in cut for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2))
for _ in range(3):
    for y in range(h):
        for x in range(w):
            if not near(x, y):
                continue
            if px[x, y][3] and n4(x, y) <= 1:
                px[x, y] = (0, 0, 0, 0)
                cut.add((x, y))
            elif not px[x, y][3] and (x, y) in cut and n4(x, y) >= 3:
                px[x, y] = ramp[0]
                cut.discard((x, y))

# distance (4-neighbour BFS) of opaque pixels from the cut region
dist = {}
q = deque()
for (x, y) in cut:
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] and (nx, ny) not in dist:
            dist[(nx, ny)] = 1
            q.append((nx, ny))
face = len(ramp)
while q:
    x, y = q.popleft()
    d = dist[(x, y)]
    if d > face + 1:
        continue
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] and (nx, ny) not in dist:
            dist[(nx, ny)] = d + 1
            q.append((nx, ny))

for (x, y), d in dist.items():
    if 2 <= d <= face + 1:
        cur = px[x, y]
        new = ramp[d - 2]
        # never brighten: keep an existing darker crater/shadow pixel
        if lum(cur) > lum(new):
            px[x, y] = new
    elif d == face + 2 and crease is not None and lum(px[x, y]) > lum(crease):
        px[x, y] = crease

# re-ink the whole silhouette (continuous 1 px outline, same colour as the rest of the rock)
edges = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and is_edge(x, y)]
fixed = 0
for x, y in edges:
    if lum(px[x, y]) > 70:
        px[x, y] = ink
        fixed += 1
im.save(dst, optimize=True)
print(f"wrote {dst}: ink={ink[:3]} cut={len(cut)} face px={sum(1 for d in dist.values() if 2 <= d <= face + 1)} re-inked={fixed}")
