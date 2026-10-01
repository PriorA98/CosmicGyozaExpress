"""Find per-frame offsets that put the saucer body at the same spot as gyoza-idle.

Registration: alpha-mask IoU of the saucer band (rim + hull, below the dome, above the legs)
of the idle frame against each frame, brute-force over integer shifts.
"""
from PIL import Image
import json

NAMES = ["gyoza-idle", "gyoza-fly-01", "gyoza-fly-02", "gyoza-fly-03",
         "gyoza-incident-01", "gyoza-incident-02", "gyoza-incident-03", "gyoza-incident-04", "gyoza-incident-05"]

def mask(name):
    im = Image.open(f"art-src/ship/originals/{name}.png").convert("RGBA")
    a = im.getchannel("A").load()
    return im.size, {(x, y) for x in range(im.width) for y in range(im.height) if a[x, y] > 128}

(rw, rh), ref_all = mask("gyoza-idle")
# saucer band in idle: rows 55..92 (rim + hull, excludes dome top and leg tips)
ref = {(x, y) for (x, y) in ref_all if 55 <= y <= 92}

def best_shift(m):
    best = (-1, 0, 0)
    for dx in range(-25, 26):
        for dy in range(-25, 26):
            hit = sum(1 for (x, y) in ref if (x + dx, y + dy) in m)
            if hit > best[0]:
                best = (hit, dx, dy)
    return best

out = {}
for n in NAMES:
    size, m = mask(n)
    hit, dx, dy = best_shift(m)
    out[n] = {"size": size, "dx": dx, "dy": dy, "overlap": round(hit / len(ref), 3)}
    print(n, out[n])
json.dump(out, open("art-src/ship/scripts/offsets.json", "w"), indent=1)
