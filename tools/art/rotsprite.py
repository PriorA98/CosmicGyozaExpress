"""Pre-rotate pixel-art frames with a RotSprite-style pipeline (dev tooling; Python + Pillow + numpy).

Runtime nearest-neighbour rotation of pixel art produces ragged stair-steps. Instead we bake a
fixed set of angles offline:

  1. pad the frame into a square cell centred on its pivot,
  2. upscale 8x with three Scale2x (EPX) passes, which smooths diagonal edges without new colours,
  3. rotate the 8x image with nearest sampling about the pivot,
  4. downscale 8x by sampling pixel centres (no new colours, hard alpha kept),
  5. pack the angles into a grid spritesheet (row-major, angle 0 = upright, clockwise).

  python tools/art/rotsprite.py public/assets/ship/gyoza-idle.png public/assets/ship/rot/gyoza-idle-rot.png \
      --pivot 32,34 --cell 112 --angles 32 --columns 8
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def scale2x(src: np.ndarray) -> np.ndarray:
    """EPX/Scale2x on an RGBA array (h, w, 4); pixels compare by exact RGBA equality."""
    h, w, _ = src.shape
    padded = np.pad(src, ((1, 1), (1, 1), (0, 0)), mode="edge")
    p = padded[1:-1, 1:-1]
    a = padded[:-2, 1:-1]  # up
    b = padded[1:-1, 2:]  # right
    c = padded[1:-1, :-2]  # left
    d = padded[2:, 1:-1]  # down

    def eq(x: np.ndarray, y: np.ndarray) -> np.ndarray:
        return np.all(x == y, axis=-1)

    ca, ab, db, cd = eq(c, a), eq(a, b), eq(d, b), eq(c, d)
    e0 = np.where((ca & ~cd & ~ab)[..., None], a, p)
    e1 = np.where((ab & ~ca & ~db)[..., None], b, p)
    e2 = np.where((cd & ~db & ~ca)[..., None], c, p)
    e3 = np.where((db & ~ab & ~cd)[..., None], d, p)

    out = np.empty((h * 2, w * 2, 4), dtype=src.dtype)
    out[0::2, 0::2] = e0
    out[0::2, 1::2] = e1
    out[1::2, 0::2] = e2
    out[1::2, 1::2] = e3
    return out


def rotsprite(frame: Image.Image, pivot: tuple[int, int], cell: int, angles: int) -> list[Image.Image]:
    rgba = frame.convert("RGBA")
    # Hard alpha keeps EPX comparisons stable; semi-transparent glass keeps its stepped value.
    canvas = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    canvas.paste(rgba, (cell // 2 - pivot[0], cell // 2 - pivot[1]))
    big = np.asarray(canvas, dtype=np.uint8)
    for _ in range(3):
        big = scale2x(big)
    big_img = Image.fromarray(big, "RGBA")
    centre = (cell * 4, cell * 4)

    frames = []
    for index in range(angles):
        degrees_clockwise = index * 360.0 / angles
        rotated = big_img.rotate(-degrees_clockwise, resample=Image.Resampling.NEAREST, center=centre)
        small = rotated.resize((cell, cell), Image.Resampling.NEAREST)
        frames.append(small)
    return frames


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--pivot", default="32,34", help="pivot in source art px (rotation centre)")
    parser.add_argument("--cell", type=int, default=112)
    parser.add_argument("--angles", type=int, default=32)
    parser.add_argument("--columns", type=int, default=8)
    args = parser.parse_args()

    px, py = (int(v) for v in args.pivot.split(","))
    frames = rotsprite(Image.open(args.input), (px, py), args.cell, args.angles)
    rows = (len(frames) + args.columns - 1) // args.columns
    sheet = Image.new("RGBA", (args.columns * args.cell, rows * args.cell), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((i % args.columns) * args.cell, (i // args.columns) * args.cell))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, optimize=True)
    print(f"wrote {args.output} {sheet.width}x{sheet.height} ({len(frames)} angles)")


if __name__ == "__main__":
    main()
