"""Author the nebula parallax layer as stepped cumulus puffs at TRUE 640x360 art resolution. Dev tooling only.

Round-3 replacement for nebula_true.py (which re-pixelized a blurred image_gen raw and read as haze).
Every cloud is a union of rasterised round lobes (1 art px = 1 file px, no anti-aliasing), painted back
to front. Each lobe is shaded with nested offset circles toward the top-left light, which gives 4 flat
value steps per hue (shadow / mid / light / rim) with hard 1 px stepped edges, like the clouds on the
Tea Moon postcard. A dim back bank sits behind the main clusters for depth. Only the shadow/mid
terminator gets a 1 px checker dither so tone boundaries do not stair-step in 2 px clusters.

Composition follows the round-2 layer: a top band and a bottom band with a calm empty middle, plum
clusters with amber top-left rims on the left, teal and dusk-blue clusters elsewhere. Horizontally
seamless (all lobes wrap modulo 640). Alpha is capped at 127 like round 2.

    python art-src/space/scripts/nebula_puffs.py public/assets/space/nebula.png [--seed 20261002]
"""

from __future__ import annotations

import argparse
import math
import random
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

W, H = 640, 360
ALPHA_MAX = 127

# 4-step ramps per hue: shadow, mid, light, rim. Muted, drawn from the design tokens.
RAMPS: dict[str, tuple[tuple[int, int, int], ...]] = {
    "plum": ((70, 60, 102), (108, 96, 146), (155, 143, 184), (204, 192, 224)),
    "plum-amber": ((70, 60, 102), (108, 96, 146), (155, 143, 184), (226, 178, 108)),
    "teal": ((42, 80, 88), (72, 120, 122), (111, 163, 154), (176, 212, 198)),
    "dusk": ((56, 70, 98), (94, 116, 142), (158, 182, 196), (214, 228, 234)),
    "dusk-amber": ((56, 70, 98), (94, 116, 142), (158, 182, 196), (222, 186, 124)),
}
# Back bank: two dim tones (body, top-left lip), lower alpha.
BACK = ((50, 44, 80), (74, 66, 108))
BACK_ALPHA = 80
SHADOW_ALPHA = 112

LIGHT = (-0.62, -0.78)  # direction toward the light (top-left)


@dataclass
class Lobe:
    cx: float
    cy: float
    r: float
    ramp: str
    back: bool = False


def wrap_dx(x: float, cx: float) -> float:
    d = (x - cx) % W
    return d - W if d > W / 2 else d


def lobe_tone(lobe: Lobe, dx: float, dy: float) -> int:
    """Tone index 0..3 for a pixel at offset (dx, dy) from the lobe centre (inside the lobe)."""
    r = lobe.r
    lx, ly = LIGHT
    # light face: smaller circle shifted toward the light
    sx, sy = dx + lx * 0.34 * r, dy + ly * 0.34 * r
    in_light = sx * sx + sy * sy <= (0.70 * r) ** 2
    # mid body: a circle shifted a little toward the light (lower-right crescent stays shadow)
    mx, my = dx + lx * 0.16 * r, dy + ly * 0.16 * r
    in_mid = mx * mx + my * my <= (0.90 * r) ** 2
    d = math.hypot(dx, dy)
    facing = (dx * lx + dy * ly) / max(d, 1e-6)
    rim_w = 1.0 if r < 9 else 1.6 if r < 16 else 2.2
    if in_light and d >= r - rim_w and facing > 0.35:
        return 3
    if in_light:
        return 2
    if in_mid:
        return 1
    return 0


def cluster(rng: random.Random, x0: float, x1: float, top: float, base: float, ramp: str,
            band: str, hump: float = 10.0, rmin: float = 9, rmax: float = 17) -> list[Lobe]:
    """A cumulus cluster: a domed back row of big lobes plus a lower front row of smaller lobes."""
    lobes: list[Lobe] = []
    span = x1 - x0
    # back row (crown)
    x = x0
    while x < x1:
        t = (x - x0) / span
        r = rng.uniform(rmin, rmax) * (0.75 + 0.45 * math.sin(math.pi * t))
        crown = top + (1 - math.sin(math.pi * t)) * hump + rng.uniform(-2, 2)
        lobes.append(Lobe(x, crown + r, r, ramp))
        x += r * rng.uniform(0.95, 1.35)
    # front row (lower, smaller), drawn on top so its lit lips cut across the crown's shadows
    x = x0 + rng.uniform(4, 10)
    while x < x1 - 4:
        r = rng.uniform(rmin * 0.65, rmax * 0.7)
        if band == "top":
            cy = base - r + rng.uniform(-3, 3)
        else:
            cy = base - r * 0.2 + rng.uniform(-3, 3)
        lobes.append(Lobe(x, cy, r, ramp))
        x += r * rng.uniform(1.2, 1.7)
    return lobes


def back_bank(rng: random.Random, y_line: float, band: str, amp: float) -> list[Lobe]:
    lobes: list[Lobe] = []
    x = 0.0
    while x < W:
        r = rng.uniform(14, 26)
        wave = math.sin(2 * math.pi * 3 * x / W + 0.7) * amp + math.sin(2 * math.pi * 5 * x / W) * amp * 0.4
        cy = (y_line + wave + r * 0.2) if band == "top" else (y_line + wave + r)
        lobes.append(Lobe(x, cy, r, "back", back=True))
        x += r * rng.uniform(0.9, 1.25)
    return lobes


def build(seed: int) -> list[Lobe]:
    rng = random.Random(seed)
    lobes: list[Lobe] = []
    # --- back banks (dim, behind everything) ---
    lobes += back_bank(rng, 6, "top", 10)
    lobes += back_bank(rng, 236, "bottom", 10)
    # --- top band: crowns near y 6..30, bases near y 84..112 ---
    top_clusters = [
        (300, 440, 18, 88, "teal", 8),
        (540, 690, 14, 96, "dusk", 8),
        (-20, 170, 12, 100, "teal", 10),
        (90, 270, 4, 112, "plum-amber", 12),
        (420, 560, 8, 92, "plum", 10),
        (640 + 150 - 640 + 640, 0, 0, 0, "", 0),  # placeholder removed below
    ]
    for x0, x1, top, base, ramp, hump in top_clusters:
        if not ramp:
            continue
        lobes += cluster(rng, x0, x1, top, base, ramp, "top", hump)
    # --- bottom band: crowns near y 246..280, fills to the bottom edge ---
    bottom_clusters = [
        (230, 380, 262, 352, "plum", 10),
        (470, 650, 254, 352, "dusk", 10),
        (330, 500, 268, 356, "teal", 8),
        (10, 180, 248, 356, "plum-amber", 14),
        (560, 740, 272, 360, "plum", 8),
        (150, 290, 276, 360, "teal", 8),
    ]
    for x0, x1, top, base, ramp, hump in bottom_clusters:
        lobes += cluster(rng, x0, x1, top, base, ramp, "bottom", hump, rmin=11, rmax=20)
    # bottom filler: big low lobes so the band reaches the bottom edge (mirror join in flight)
    x = 0.0
    ramps = ["plum", "teal", "dusk", "plum", "teal"]
    i = 0
    while x < W:
        r = rng.uniform(26, 36)
        lobes.insert(len(lobes) - 0, Lobe(x, 360 + r * 0.35, r, ramps[i % len(ramps)]))
        x += r * 1.1
        i += 1
    return lobes


def render(lobes: list[Lobe]) -> Image.Image:
    tone = [[-1] * W for _ in range(H)]
    ramp_of = [[""] * W for _ in range(H)]
    for lobe in lobes:
        r = lobe.r
        y0, y1 = max(0, int(math.floor(lobe.cy - r))), min(H - 1, int(math.ceil(lobe.cy + r)))
        for y in range(y0, y1 + 1):
            dy = y + 0.5 - lobe.cy
            half = r * r - dy * dy
            if half < 0:
                continue
            for xi in range(int(math.floor(lobe.cx - r)), int(math.ceil(lobe.cx + r)) + 1):
                dx = xi + 0.5 - lobe.cx
                if dx * dx + dy * dy > r * r:
                    continue
                x = xi % W
                if lobe.back:
                    lx, ly = LIGHT
                    sx, sy = dx + lx * 0.25 * r, dy + ly * 0.25 * r
                    t = 1 if (dx * dx + dy * dy >= (r - 1.6) ** 2 and (dx * lx + dy * ly) > 0.3 * r) else 0
                    tone[y][x] = 10 + t
                    ramp_of[y][x] = "back"
                else:
                    tone[y][x] = lobe_tone(lobe, dx, dy)
                    ramp_of[y][x] = lobe.ramp
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = tone[y][x]
            if t < 0:
                continue
            if t >= 10:
                c = BACK[t - 10]
                px[x, y] = (*c, BACK_ALPHA)
                continue
            # 1 px checker dither on the shadow side of the shadow/mid terminator
            if t == 0 and (x + y) % 2 == 0:
                for nx, ny in ((x - 1, y), (x, y - 1)):
                    if 0 <= ny < H and tone[ny][nx % W] == 1 and ramp_of[ny][nx % W] == ramp_of[y][x]:
                        t = 1
                        break
            c = RAMPS[ramp_of[y][x]][t]
            px[x, y] = (*c, SHADOW_ALPHA if t == 0 else ALPHA_MAX)
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--seed", type=int, default=20261002)
    a = ap.parse_args()
    img = render(build(a.seed))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out, optimize=True)
    print(f"wrote {a.out} {img.size}")


if __name__ == "__main__":
    main()
