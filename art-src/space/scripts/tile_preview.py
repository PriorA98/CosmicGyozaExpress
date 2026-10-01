"""Tile a layer NxM over the cosmos colour and upscale with nearest, to check seams (dev tooling only).

    python art-src/space/scripts/tile_preview.py <in.png> <out.png> [--nx 3] [--ny 3] [--scale 2] [--bg 1A1B2E]
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("src", type=Path)
    p.add_argument("out", type=Path)
    p.add_argument("--nx", type=int, default=3)
    p.add_argument("--ny", type=int, default=3)
    p.add_argument("--scale", type=int, default=2)
    p.add_argument("--bg", default="1A1B2E")
    p.add_argument("--under", type=Path, default=None, help="optional opaque layer tiled underneath")
    a = p.parse_args()
    img = Image.open(a.src).convert("RGBA")
    w, h = img.size
    bg = tuple(int(a.bg[i : i + 2], 16) for i in (0, 2, 4))
    sheet = Image.new("RGBA", (w * a.nx, h * a.ny), (*bg, 255))
    if a.under:
        under = Image.open(a.under).convert("RGBA")
        for y in range(0, sheet.height, under.height):
            for x in range(0, sheet.width, under.width):
                sheet.alpha_composite(under, (x, y))
    for j in range(a.ny):
        for i in range(a.nx):
            sheet.alpha_composite(img, (i * w, j * h))
    sheet = sheet.resize((sheet.width * a.scale, sheet.height * a.scale), Image.Resampling.NEAREST)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(a.out)
    print(f"wrote {a.out} {sheet.width}x{sheet.height}")


if __name__ == "__main__":
    main()
