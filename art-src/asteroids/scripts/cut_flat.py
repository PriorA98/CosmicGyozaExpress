"""Slice a straight broken flat side off a round sprite (crumb rock).

Removes every opaque pixel on the outer side of the line a->b, re-inks the new straight
edge 1 px (darkest outline colour already on the sprite), and paints a `face` px band just
inside it as a flat fracture face: a lit facet row (`lit`) under the ink and a cooler shade
(`shade`) behind it, so the cut reads as a clean break lit from the top-left.

Usage: python cut_flat.py <in.png> <out.png> ax ay bx by [face=3] [lit=#B7C8D2] [shade=#8E93B4] [order=outer|inner]

order=outer (default, round-2 look): ink, lit row, shade band.  order=inner (wave 2): ink, shade band,
then the lit row innermost, i.e. a lit ridge where the fracture face meets the crust.
"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
ax, ay, bx, by = map(float, sys.argv[3:7])
face = int(sys.argv[7]) if len(sys.argv) > 7 else 3
hexc = lambda s: tuple(int(s.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
lit = hexc(sys.argv[8]) if len(sys.argv) > 8 else hexc("#B7C8D2")
shade = hexc(sys.argv[9]) if len(sys.argv) > 9 else hexc("#8E93B4")
order = sys.argv[10] if len(sys.argv) > 10 else "outer"
im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()
lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
ink = min((px[x, y] for y in range(h) for x in range(w) if px[x, y][3]), key=lum)
dx, dy = bx - ax, by - ay
n = (dx * dx + dy * dy) ** 0.5
# signed distance: positive on the side away from the sprite centre
cx, cy = w / 2, h / 2
sgn = 1 if ((cx - ax) * dy - (cy - ay) * dx) < 0 else -1
dist = lambda x, y: sgn * ((x + 0.5 - ax) * dy - (y + 0.5 - ay) * dx) / n
for y in range(h):
    for x in range(w):
        if px[x, y][3] and dist(x, y) > 0:
            px[x, y] = (0, 0, 0, 0)
for y in range(h):
    for x in range(w):
        if not px[x, y][3]:
            continue
        d = -dist(x, y)
        if d < 1.0:
            px[x, y] = ink
        elif order == "inner":
            if d < face:
                px[x, y] = shade
            elif d < face + 1.0:
                px[x, y] = lit
        elif d < 2.0:
            px[x, y] = lit
        elif d < 1.0 + face:
            px[x, y] = shade
im.save(dst, optimize=True)
print("wrote", dst)
