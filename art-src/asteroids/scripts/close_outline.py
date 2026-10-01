"""Close gaps in a sprite's 1px dark silhouette outline (in place, no growth).

Every opaque pixel touching transparency (4-neighbour) whose luminance is above
`max_lum` is recoloured to the darkest existing edge colour, so the outline is
continuous after downscaling. Silhouette size is unchanged.

Usage: python close_outline.py <in.png> <out.png> [max_lum]
"""
import sys
from collections import Counter
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
max_lum = float(sys.argv[3]) if len(sys.argv) > 3 else 70
im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()

def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]

def edge(x, y):
    if px[x, y][3] == 0:
        return False
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] == 0:
            return True
    return False

edges = [(x, y) for y in range(h) for x in range(w) if edge(x, y)]
dark = Counter(px[x, y] for x, y in edges if lum(px[x, y]) <= max_lum)
ink = dark.most_common(1)[0][0] if dark else (29, 31, 51, 255)
fixed = 0
for x, y in edges:
    if lum(px[x, y]) > max_lum:
        px[x, y] = ink
        fixed += 1
im.save(dst, optimize=True)
print(f"wrote {dst}: ink={ink[:3]} recoloured {fixed}/{len(edges)} edge px")
