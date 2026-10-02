"""Redraw lunar-hills-far.png as three authored ridge layers (dev tooling; Pillow).

Wave 3 round 3 (2026-10-02). Replaces the posterized Codex strip (kept as work/lunar-hills-far-w2.png).
  * 640x96, transparent sky above, seamless horizontally (every dome uses periodic distance).
  * Three ridges (far, mid, near). Each crest is the max of a few rounded domes; whole-pixel crest,
    cleaned of 1 px back-and-forth steps.
  * Per ridge: a 1 px darker-value crest outline, a 1 px dusk-blue rim highlight under it (stronger on
    slopes facing the top-left light), then 4-5 flat value bands from a field of depth-below-crest and
    dome-side (left faces lit, right faces in shade).
  * A few authored crater ellipses (lunar-ground idiom: darker upper wall, lighter lower lip).
Run from the repo root:  python art-src/lunar/scripts/build_hills.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public" / "assets" / "lunar" / "lunar-hills-far.png"
W, H = 640, 96

# dome = (peak x, left half width, right half width, height above the ridge base)
RIDGES = [
    {
        "name": "far",
        "base": 50,
        "domes": [(36, 50, 70, 16), (156, 96, 64, 30), (262, 50, 70, 13), (404, 110, 74, 34), (528, 60, 54, 19), (602, 40, 56, 11)],
        "outline": (78, 74, 116),
        "rim": (176, 182, 214),
        "bands": [(152, 150, 190), (136, 133, 176), (121, 118, 162), (106, 102, 148)],
    },
    {
        "name": "mid",
        "base": 64,
        "domes": [(0, 64, 84, 15), (98, 70, 46, 22), (206, 60, 90, 18), (334, 70, 60, 9), (468, 96, 56, 22), (566, 40, 60, 13)],
        "outline": (70, 70, 106),
        "rim": (188, 198, 222),
        "bands": [(164, 168, 198), (147, 151, 184), (130, 134, 168), (114, 117, 153), (100, 102, 138)],
    },
    {
        "name": "near",
        "base": 78,
        "domes": [(58, 84, 70, 12), (186, 52, 66, 8), (300, 100, 110, 5), (424, 62, 70, 10), (540, 80, 88, 13)],
        "outline": (66, 66, 100),
        "rim": (200, 210, 228),
        "bands": [(176, 180, 206), (158, 163, 192), (141, 146, 176), (124, 128, 160), (108, 112, 144)],
    },
]

# craters: (ridge name, centre x, depth below crest, width, height)
CRATERS = [
    ("mid", 84, 10, 18, 6), ("mid", 470, 12, 20, 6),
    ("near", 132, 7, 20, 6), ("near", 590, 6, 16, 5), ("far", 388, 13, 16, 5),
]


def pdist(x: float, c: float) -> float:
    d = abs(x - c) % W
    return min(d, W - d)


def dome_profile(x: int, domes) -> tuple[float, int]:
    best, owner = 0.0, 0
    for i, (c, hwl, hwr, h) in enumerate(domes):
        sd = ((x + 0.5 - c + W / 2) % W) - W / 2
        hw = hwl if sd < 0 else hwr
        d = abs(sd)
        if d < hw:
            v = h * (0.5 + 0.5 * math.cos(math.pi * d / hw)) ** 0.8
            if v > best:
                best, owner = v, i
    return best, owner


def clean_steps(ys: list[int]) -> list[int]:
    for _ in range(3):
        for x in range(W):
            l, r = ys[(x - 1) % W], ys[(x + 1) % W]
            if l == r and ys[x] != l:
                ys[x] = l
    return ys


def main() -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    layer_of = [[-1] * W for _ in range(H)]
    crests: dict[str, list[int]] = {}
    owners: dict[str, list[int]] = {}

    for li, ridge in enumerate(RIDGES):
        prof = [dome_profile(x, ridge["domes"]) for x in range(W)]
        crest = clean_steps([round(ridge["base"] - p[0]) for p in prof])
        crests[ridge["name"]] = crest
        owners[ridge["name"]] = [p[1] for p in prof]
        bands = ridge["bands"]
        nb = len(bands)
        # facing per column from the crest slope, smoothed over +-12 px so band edges curve, never cut
        raw = [(crest[(x + 2) % W] - crest[(x - 2) % W]) / 4.0 for x in range(W)]
        facing = [sum(raw[(x + k) % W] for k in range(-12, 13)) / 25.0 for x in range(W)]
        for x in range(W):
            f = max(-1.0, min(1.0, facing[x] * 2.2))  # -1 faces the light (rises to the right), +1 faces away
            band_h = 7.0 - 2.2 * f                     # lit faces: wide light bands; shaded faces: thin
            for y in range(crest[x], H):
                d = y - crest[x]
                bi = max(0, min(nb - 1, int(d / band_h + 0.7 * max(0.0, f))))
                px[x, y] = (*bands[bi], 255)
                layer_of[y][x] = li
            # crest outline + rim highlight
            px[x, crest[x]] = (*ridge["outline"], 255)
            if crest[x] + 1 < H:
                if f < 0.35 or (x // 5) % 3 == 0:
                    px[x, crest[x] + 1] = (*ridge["rim"], 255)
                if f < -0.4 and crest[x] + 2 < H:
                    px[x, crest[x] + 2] = (*bands[0], 255)
        # outline also on vertical steps of the crest so the silhouette stays closed
        for x in range(W):
            for nx in ((x - 1) % W, (x + 1) % W):
                for y in range(crest[x] + 1, min(crest[nx], H)):
                    px[x, y] = (*ridge["outline"], 255)

    # second pass: clean isolated band pixels (keeps bands flat)
    for _ in range(2):
        for y in range(1, H - 1):
            for x in range(W):
                c = px[x, y]
                if c[3] == 0:
                    continue
                l, r = px[(x - 1) % W, y], px[(x + 1) % W, y]
                u, dn = px[x, y - 1], px[x, y + 1]
                if l == r and c != l and u != c and dn != c and l[3] and layer_of[y][x] == layer_of[y][(x - 1) % W]:
                    if c not in [tuple(rg["outline"]) + (255,) for rg in RIDGES] and c not in [tuple(rg["rim"]) + (255,) for rg in RIDGES]:
                        px[x, y] = l

    # craters
    by_name = {r["name"]: (i, r) for i, r in enumerate(RIDGES)}
    for name, cx, depth, cw, ch in CRATERS:
        li, ridge = by_name[name]
        bands = ridge["bands"]
        top = crests[name][cx] + depth
        dark, lip = bands[-1], ridge["rim"]
        inner = bands[min(len(bands) - 1, 2)]
        pts = []
        for dy in range(ch):
            for dx in range(cw):
                nx = (dx + 0.5 - cw / 2) / (cw / 2)
                ny = (dy + 0.5 - ch / 2) / (ch / 2)
                if nx * nx + ny * ny <= 1.0:
                    pts.append((dx, dy))
        ok = all(layer_of[top + dy][(cx - cw // 2 + dx) % W] == li for dx, dy in pts if top + dy < H)
        if not ok:
            print(f"skip crater {name}@{cx}")
            continue
        ptset = set(pts)
        for dx, dy in pts:
            x, y = (cx - cw // 2 + dx) % W, top + dy
            col = inner
            up = (dx, dy - 1) not in ptset
            down = (dx, dy + 1) not in ptset
            if up or ((dx - 1, dy) not in ptset and dy < ch // 2):
                col = dark                      # upper-left inner wall in shade
            elif down or ((dx + 1, dy) not in ptset and dy >= ch // 2):
                col = lip                       # lower-right lip catches the light
            px[x, y] = (*col, 255)
        # soft floor: one lighter step in the lower centre of the bowl
        for dx, dy in pts:
            if dy == ch - 2 and cw // 3 <= dx < cw - cw // 4 and (dx, dy + 1) in ptset:
                px[(cx - cw // 2 + dx) % W, top + dy] = (*bands[1], 255)

    # contract: rows 0..13 transparent, bottom row fully opaque
    for y in range(14):
        assert all(px[x, y][3] == 0 for x in range(W)), y
    assert all(px[x, H - 1][3] == 255 for x in range(W))
    img.save(OUT, optimize=True)
    print(f"wrote {OUT}; top content row {min(min(c) for c in crests.values())}")


if __name__ == "__main__":
    main()
