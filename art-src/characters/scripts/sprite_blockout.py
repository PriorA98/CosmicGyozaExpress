"""Procedural blockout for the 24x32 rabbit sprite; prints an ASCII map to hand-finish.

Dev tooling only. Output is an ASCII grid which was then hand-edited into
build_sprite.py (the source of truth for rabbit-sprite.png).
"""
import math

W, H = 24, 32
grid = [["." for _ in range(W)] for _ in range(H)]


def ell(cx, cy, rx, ry, ch, rot=0.0):
    c, s = math.cos(rot), math.sin(rot)
    for y in range(H):
        for x in range(W):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            u = dx * c + dy * s
            v = -dx * s + dy * c
            if (u / rx) ** 2 + (v / ry) ** 2 <= 1.0:
                grid[y][x] = ch


# back to front
ell(17.6, 12.0, 1.9, 4.6, "C", rot=math.radians(-45))  # droopy ear (viewer right)
ell(8.6, 5.6, 1.9, 4.8, "C", rot=math.radians(-8))  # upright ear
ell(12.0, 26.0, 4.6, 4.4, "C")  # body
ell(10.0, 29.6, 1.8, 1.3, "C")  # foot L
ell(14.0, 29.6, 1.8, 1.3, "C")  # foot R
ell(12.0, 15.0, 7.0, 5.6, "C")  # head

# silhouette outline
filled = [[grid[y][x] != "." for x in range(W)] for y in range(H)]
for y in range(H):
    for x in range(W):
        if filled[y][x]:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and filled[ny][nx]:
                grid[y][x] = "K"
                break

for row in grid:
    print("".join(row))
