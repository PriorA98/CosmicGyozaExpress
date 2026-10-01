"""Downscale a canonical in-game sprite (pixel art) into a small on-model stamp for the postcard.

Usage: python art-src/items/scripts/stamp_sprite.py <src.png> <out.png> <width> [--flip]
Crops to content, box-downscales to <width> (keeping aspect), hard alpha, 1px ink outline.
"""
from __future__ import annotations

import sys

from PIL import Image

INK = (0x1D, 0x1F, 0x33, 255)


def main() -> None:
    src, out, w = sys.argv[1], sys.argv[2], int(sys.argv[3])
    im = Image.open(src).convert("RGBA")
    im = im.crop(im.getbbox())
    if "--flip" in sys.argv:
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    h = max(1, round(im.height * w / im.width))
    # premultiplied box downscale so transparent pixels do not darken edges
    small = im.resize((w, h), Image.Resampling.BOX, reducing_gap=None)
    px = small.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 110 else (0, 0, 0, 0)
    canvas = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    canvas.paste(small, (1, 1))
    cp = canvas.load()
    solid = {(x, y) for y in range(h + 2) for x in range(w + 2) if cp[x, y][3]}
    for y in range(h + 2):
        for x in range(w + 2):
            if (x, y) in solid:
                continue
            if any((x + dx, y + dy) in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                cp[x, y] = INK
    canvas.save(out)
    print(f"wrote {out} {canvas.size}")


if __name__ == "__main__":
    main()
