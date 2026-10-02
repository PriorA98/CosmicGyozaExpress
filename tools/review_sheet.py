"""Composite a capture run into one labelled review sheet (dev tooling; Python + Pillow).

Agents inspect ONE sheet per capture run instead of reading every full-size PNG, which keeps
their context (and usage) small. Open a full-size PNG or a crop only when a detail matters.

  python tools/review_sheet.py e2e/out/<label> [--thumb 480] [--columns 3] [--match landing-]
  python tools/review_sheet.py e2e/out/<label> --crop landing-thrust@desktop.png 520,380,900,660 [--zoom 2]

Writes e2e/out/<label>/review-sheet.png (or review-crop.png) and prints its path.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

BG = (214, 205, 181)
LABEL_BG = (29, 31, 51)
LABEL_FG = (251, 247, 236)


def sheet(folder: Path, thumb: int, columns: int, match: str | None) -> Path:
    files = sorted(p for p in folder.glob("*.png") if not p.name.startswith("review-") and (match is None or match in p.name))
    if not files:
        raise SystemExit(f"no PNGs in {folder}")
    tiles = []
    for path in files:
        img = Image.open(path).convert("RGB")
        scale = thumb / img.width
        img = img.resize((thumb, max(1, round(img.height * scale))), Image.Resampling.BILINEAR)
        tile = Image.new("RGB", (img.width, img.height + 18), LABEL_BG)
        tile.paste(img, (0, 18))
        ImageDraw.Draw(tile).text((4, 3), path.stem, fill=LABEL_FG)
        tiles.append(tile)
    rows = [tiles[i : i + columns] for i in range(0, len(tiles), columns)]
    width = columns * thumb + (columns + 1) * 6
    height = sum(max(t.height for t in row) for row in rows) + (len(rows) + 1) * 6
    out = Image.new("RGB", (width, height), BG)
    y = 6
    for row in rows:
        x = 6
        for tile in row:
            out.paste(tile, (x, y))
            x += thumb + 6
        y += max(t.height for t in row) + 6
    target = folder / "review-sheet.png"
    out.save(target, optimize=True)
    return target


def crop(folder: Path, name: str, box: str, zoom: int) -> Path:
    x0, y0, x1, y1 = (int(v) for v in box.split(","))
    img = Image.open(folder / name).convert("RGB").crop((x0, y0, x1, y1))
    img = img.resize((img.width * zoom, img.height * zoom), Image.Resampling.NEAREST)
    target = folder / "review-crop.png"
    img.save(target)
    return target


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", type=Path)
    parser.add_argument("--thumb", type=int, default=480)
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--match", default=None)
    parser.add_argument("--crop", nargs=2, metavar=("PNG", "X0,Y0,X1,Y1"), default=None)
    parser.add_argument("--zoom", type=int, default=2)
    args = parser.parse_args()
    if args.crop:
        print(crop(args.folder, args.crop[0], args.crop[1], args.zoom))
    else:
        print(sheet(args.folder, args.thumb, args.columns, args.match))


if __name__ == "__main__":
    main()
