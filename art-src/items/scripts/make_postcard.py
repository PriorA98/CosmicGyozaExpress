"""Compose memory-postcard.png (96x64): crop the raw generation's inner picture, pixelize it
with tools/art/pixelize.py to 90x58, then frame it in a clean pixel parchment border
(the raw's thin border collapses to ~1.5 art px at 96x64, so it is redrawn by hand).

Usage: python art-src/items/scripts/make_postcard.py <raw.png> <out.png> [colors] [inner_box]
  inner_box = left,top,right,bottom of the picture area inside the raw border.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image

W, H = 96, 64
BORDER = 3
EDGE = (0xD8, 0xC4, 0x9E, 255)       # deeper parchment rim (card edge)
PARCH = (0xF4, 0xEC, 0xDC, 255)      # parchment
SHADE = (0xEC, 0xDF, 0xC5, 255)      # parchment-deep (lower/right inner bevel, light from top-left)


def main() -> None:
    raw, out = Path(sys.argv[1]), Path(sys.argv[2])
    colors = sys.argv[3] if len(sys.argv) > 3 else "32"
    box = tuple(int(v) for v in sys.argv[4].split(",")) if len(sys.argv) > 4 else (25, 25, 1511, 999)
    tmp_dir = out.parent if out.parent.name == "work" else Path("art-src/items/work")
    tmp_dir.mkdir(parents=True, exist_ok=True)
    crop_path = tmp_dir / f"{raw.stem}-inner.png"
    pic_path = tmp_dir / f"{raw.stem}-inner-px.png"
    Image.open(raw).convert("RGB").crop(box).save(crop_path)
    iw, ih = W - 2 * BORDER, H - 2 * BORDER
    subprocess.run(
        [sys.executable, "tools/art/pixelize.py", str(crop_path), str(pic_path),
         "--size", f"{iw}x{ih}", "--fit", "cover", "--opaque", "--key", "none",
         "--no-crop", "--colors", colors],
        check=True,
    )
    card = Image.new("RGBA", (W, H), PARCH)
    px = card.load()
    for x in range(W):
        for y in range(H):
            if x == 0 or y == 0 or x == W - 1 or y == H - 1:
                px[x, y] = EDGE
            elif x == W - 2 or y == H - 2:
                px[x, y] = SHADE
    # round the card corners by one pixel
    for (x, y) in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
        px[x, y] = (0, 0, 0, 0)
    card.paste(Image.open(pic_path).convert("RGBA"), (BORDER, BORDER))
    card.save(out, optimize=True)
    print(f"wrote {out} {card.size}")


if __name__ == "__main__":
    main()
