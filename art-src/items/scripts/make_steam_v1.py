"""Author the item-steam strip (4 frames, 16x24 each -> 64x24) directly at art resolution.

Soft rising wisp: puffs travel up a fixed S-curve; puff spacing equals the 4-frame travel
distance, so frame 4 -> frame 1 loops seamlessly. Alpha is quantized to a few steps so the
wisp stays crisp pixel art while keeping partial transparency.

Usage: python art-src/items/scripts/make_steam.py <out.png> [--raw <raw-preview.png>]
"""
from __future__ import annotations

import math
import sys

from PIL import Image

FW, FH, FRAMES = 16, 24, 4
SPACING = 4.8  # px between puffs == travel per loop
STEP = SPACING / FRAMES

PLASTER = (0xFB, 0xF7, 0xEC)
PARCH_DEEP = (0xEC, 0xDF, 0xC5)
DUSK = (0xB4, 0xC5, 0xCE)  # light dusk-blue/plaster in-between for the shaded side

ALPHA_STEPS = [0, 70, 130, 190, 235]


def path_x(y: float) -> float:
    # gentle S-curve, base centred, drifting a bit right as it rises
    rise = (FH - y) / FH
    return 7.5 + 2.4 * math.sin(rise * 2.4 * math.pi - 0.6) + rise * 0.8


def frame(t: int) -> Image.Image:
    img = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
    px = img.load()
    puffs = []
    for k in range(-1, 9):
        y = FH - 1.5 - (k * SPACING + t * STEP)
        if y < -4 or y > FH + 3:
            continue
        rise = max(0.0, min(1.0, (FH - y) / FH))
        r = 3.8 - 2.0 * rise + 0.4 * math.sin(rise * math.pi)
        # fade in at the bottom, fade out near the top
        a = min(1.0, (FH - y) / 5.0) * (1.0 - rise ** 1.6)
        puffs.append((path_x(y), y, r, max(0.0, a)))
    def field(cx: float, cy: float) -> float:
        # soft union of puffs (sum, clipped) so the wisp reads as one ribbon
        v = 0.0
        for (x, y, r, a) in puffs:
            d2 = ((cx - x) * 1.1) ** 2 + ((cy - y) * 0.8) ** 2
            v += a * math.exp(-d2 / (r * r * 0.42))
        return min(1.0, v * 0.95)

    for yy in range(FH):
        for xx in range(FW):
            v = field(xx + 0.5, yy + 0.5)
            if v <= 0.12:
                continue
            level = min(len(ALPHA_STEPS) - 1, int((v - 0.12) / 0.88 * (len(ALPHA_STEPS) - 0.01)) + 1)
            alpha = ALPHA_STEPS[level]
            # light from top-left: the lower-right rim of the ribbon is cooler/shaded
            rim = field(xx + 1.5, yy + 1.5) < v * 0.55
            if level >= 3:
                col = DUSK if rim else PLASTER
            else:
                col = DUSK if rim else PLASTER
            px[xx, yy] = (*col, alpha)
    return img


def main() -> None:
    out = sys.argv[1]
    strip = Image.new("RGBA", (FW * FRAMES, FH), (0, 0, 0, 0))
    for t in range(FRAMES):
        strip.paste(frame(t), (t * FW, 0))
    strip.save(out, optimize=True)
    print(f"wrote {out} {strip.size}")


if __name__ == "__main__":
    main()
