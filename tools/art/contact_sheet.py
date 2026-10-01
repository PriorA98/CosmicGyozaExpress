"""Contact sheet of production art for review (dev tooling; Python + Pillow).

  python tools/art/contact_sheet.py [public/assets/<folder> ...] --out e2e/out/contact.png [--scale 2]

Each PNG is shown nearest-neighbour scaled on a cosmos tile and a parchment tile with its
file name and size, so critics can judge palette, outline, and pixel density side by side.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

COSMOS = (26, 27, 46, 255)
PARCHMENT = (244, 236, 220, 255)
INK = (29, 31, 51, 255)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("folders", nargs="*", default=["public/assets"])
    parser.add_argument("--out", default="e2e/out/contact-sheet.png")
    parser.add_argument("--scale", type=int, default=2)
    parser.add_argument("--max-width", type=int, default=1800)
    args = parser.parse_args()

    files = sorted(p for folder in args.folders for p in Path(folder).rglob("*.png") if ".preview" not in p.name)
    tiles = []
    for path in files:
        img = Image.open(path).convert("RGBA")
        scale = args.scale if max(img.size) * args.scale <= 700 else max(1, 700 // max(img.size))
        big = img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)
        tile = Image.new("RGBA", (big.width * 2 + 24, big.height + 34), PARCHMENT)
        tile.paste(Image.new("RGBA", (big.width + 8, big.height + 8), COSMOS), (4, 4))
        tile.alpha_composite(big, (8, 8))
        tile.alpha_composite(big, (big.width + 16, 8))
        ImageDraw.Draw(tile).text((6, big.height + 16), f"{path.as_posix().split('assets/')[-1]} {img.width}x{img.height} x{scale}", fill=INK)
        tiles.append(tile)

    if not tiles:
        print("no png files found")
        return

    rows, row, width = [], [], 0
    for tile in tiles:
        if row and width + tile.width > args.max_width:
            rows.append(row)
            row, width = [], 0
        row.append(tile)
        width += tile.width + 8
    rows.append(row)

    sheet_w = max(sum(t.width + 8 for t in r) for r in rows) + 8
    sheet_h = sum(max(t.height for t in r) + 8 for r in rows) + 8
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (214, 205, 181, 255))
    y = 8
    for r in rows:
        x = 8
        for tile in r:
            sheet.alpha_composite(tile, (x, y))
            x += tile.width + 8
        y += max(t.height for t in r) + 8
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.out)
    print(f"wrote {args.out} ({len(tiles)} images)")


if __name__ == "__main__":
    main()
