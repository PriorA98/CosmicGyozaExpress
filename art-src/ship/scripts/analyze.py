"""Analyse ship frames: 2x grid phase, longest horizontal run (saucer rim) per frame."""
from PIL import Image
import glob
for f in sorted(glob.glob('art-src/ship/originals/*.png')):
    im = Image.open(f).convert('RGBA'); px = im.load(); W, H = im.size
    # grid phase
    best = None
    for ox in (0, 1):
        for oy in (0, 1):
            same = tot = 0
            for y in range(oy, H - 1, 2):
                for x in range(ox, W - 1, 2):
                    b = [px[x, y], px[x+1, y], px[x, y+1], px[x+1, y+1]]
                    if all(p[3] == 0 for p in b): continue
                    tot += 1
                    if all(abs(p[0]-b[0][0])+abs(p[1]-b[0][1])+abs(p[2]-b[0][2])+abs(p[3]-b[0][3]) < 24 for p in b): same += 1
            r = same / max(tot, 1)
            if best is None or r > best[0]: best = (r, ox, oy)
    # longest run per row
    rows = []
    for y in range(H):
        run = bestrun = (0, 0, 0)
        s = None
        for x in range(W + 1):
            op = x < W and px[x, y][3] > 128
            if op and s is None: s = x
            if not op and s is not None:
                if x - s > bestrun[0]: bestrun = (x - s, s, x)
                s = None
        rows.append((bestrun[0], y, bestrun[1], bestrun[2]))
    mx = max(rows)
    wide = [r for r in rows if r[0] >= mx[0] - 4]
    alpha = sorted(set(px[x, y][3] for x in range(W) for y in range(H)))
    print(f[-28:], im.size, 'grid', best, 'maxrun', mx, 'wide rows', wide[0][1], '-', wide[-1][1], 'n alpha', len(alpha))
