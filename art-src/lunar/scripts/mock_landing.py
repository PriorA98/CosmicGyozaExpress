"""Quick static composite of the Tea Moon landing art at in-game positions (dev tooling; Pillow).

Approximates LunarScenery: surface line 612 screen px (art row 306), hills band bottom 10 art px
below the surface, ground surface row 8, pad centred, teahouse x 1062, rabbit x 924 (flipped).
Writes a 2x (1280x720) preview.  python art-src/lunar/scripts/mock_landing.py <out.png>
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[3]
A = ROOT / "public" / "assets"
SURF = 306


def load(p: str) -> Image.Image:
    return Image.open(A / p).convert("RGBA")


def main() -> None:
    out = Path(sys.argv[1])
    canvas = load("lunar/lunar-sky.png").copy()
    hills = load("lunar/lunar-hills-far.png")
    canvas.alpha_composite(hills, (0, SURF + 10 - hills.height))
    ground = load("lunar/lunar-ground.png")
    canvas.alpha_composite(ground, (0, SURF - 8))
    pad = load("lunar/lunar-pad.png")
    canvas.alpha_composite(pad, (320 - pad.width // 2, SURF - 6))
    lant = load("lunar/lunar-lantern.png").crop((12, 0, 24, 28))
    for lx in (320 - pad.width // 2 - 5 - 6, 320 + pad.width // 2 + 5 - 6):
        canvas.alpha_composite(lant, (lx, SURF + 1 - 28))
    house = load("lunar/lunar-teahouse.png")
    canvas.alpha_composite(house, (531 - 48, SURF + 2 - 80))
    rab = load("characters/rabbit-sprite.png")
    fw = rab.width // 4  # 4-frame strip
    frame = ImageOps.mirror(rab.crop((0, 0, fw, rab.height)))
    canvas.alpha_composite(frame, (462 - fw // 2, SURF + 1 - rab.height))
    canvas.resize((1280, 720), Image.NEAREST).save(out)


if __name__ == "__main__":
    main()
