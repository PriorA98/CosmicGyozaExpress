"""Remove a flat magenta background by flood fill from the image border only.

Interior pixels that happen to be near magenta (pink/plum shading) are kept,
so the subject never gets holes. Writes an RGBA PNG for pixelize --key none.

Usage: python flood_key.py <in.png> <out.png> [tolerance]
"""
import sys
from collections import deque
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
tol = int(sys.argv[3]) if len(sys.argv) > 3 else 90
im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()

def bg(p):
    r, g, b, _ = p
    return (255 - r) + g + (255 - b) <= tol

seen = bytearray(w * h)
q = deque()
for x in range(w):
    q.append((x, 0)); q.append((x, h - 1))
for y in range(h):
    q.append((0, y)); q.append((w - 1, y))
while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i]:
        continue
    seen[i] = 1
    if not bg(px[x, y]):
        continue
    px[x, y] = (0, 0, 0, 0)
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
            q.append((nx, ny))
# soften the magenta fringe on remaining edge pixels: pull toward ink
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a and r > 200 and b > 200 and g < 120:
            px[x, y] = (0, 0, 0, 0)
im.save(dst)
print("wrote", dst)
