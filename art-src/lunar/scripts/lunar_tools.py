"""Helper normalization for lunar assets (dev tooling only; Pillow).

Subcommands:
  strip   <raw> <out> --size WxH --surface ROW [--colors N] [--blend PX] [--key FF00FF]
          Chroma-key a wide panoramic strip, crop to content, scale to the target
          width so that the top of the solid content lands on --surface row, fill
          down to the bottom, cross-fade the edges so it tiles horizontally, then
          quantize and harden alpha.
  seamcheck <png>   prints how different column 0 and the last column are.
  split   <raw> <n> <outprefix>  split a row of N subjects on magenta into N crops
          (by finding gaps of empty columns).
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "tools" / "art"))
import pixelize  # noqa: E402


def key_and_crop(path: Path, key: str = "FF00FF", tol: int = 60) -> Image.Image:
    img = pixelize.remove_background(Image.open(path), key, tol)
    return pixelize.crop_to_content(img, 128)


def tint(img: Image.Image, color: str, amt: float) -> Image.Image:
    """Soft-light style colour grade toward `color` keeping luminance structure."""
    r, g, b = pixelize.hex_to_rgb(color)
    overlay = Image.new("RGBA", img.size, (r, g, b, 255))
    mult = Image.composite(Image.blend(img.convert("RGBA"), overlay, amt), img, img.getchannel("A"))
    mult.putalpha(img.getchannel("A"))
    return mult


def remove_specks(img: Image.Image, min_size: int) -> None:
    """Clear opaque connected components smaller than min_size (stray key/downscale specks)."""
    px = img.load()
    w, h = img.size
    seen = [[False] * w for _ in range(h)]
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or px[sx, sy][3] == 0:
                continue
            comp, stack = [], [(sx, sy)]
            seen[sy][sx] = True
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny][3]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(comp) < min_size:
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)


def make_seamless(img: Image.Image, blend: int) -> Image.Image:
    """Cross-fade the right `blend` columns into the left side, then trim them.

    Result width = img.width - blend; column 0 continues naturally from the last column.
    """
    w, h = img.size
    core = img.crop((0, 0, w - blend, h))
    tail = img.crop((w - blend, 0, w, h))
    head = img.crop((0, 0, blend, h))
    mask = Image.new("L", (blend, h))
    for x in range(blend):
        v = round(255 * (1 - x / max(1, blend - 1)))
        mask.paste(v, (x, 0, x + 1, h))
    # mask: 255 at left -> 0 at right ; we want tail dominant at left, head at right
    mixed = Image.composite(tail, head, mask)
    core.paste(mixed, (0, 0))
    return core


def strip(raw: Path, out: Path, size: str, surface: int, colors: int, blend: int, key: str, snap: str | None,
          vsquash: float = 1.0, top: int = -1, grade: str | None = None, grade_amt: float = 0.0) -> None:
    tw, th = pixelize.parse_size(size)
    img = key_and_crop(raw, key)
    work_w = tw + blend
    scale = work_w / img.width
    nh = max(1, round(img.height * scale * vsquash))
    img = img.resize((work_w, nh), Image.Resampling.BOX)
    if grade:
        img = tint(img, grade, grade_amt)
    canvas = Image.new("RGBA", (work_w, th), (0, 0, 0, 0))
    if surface >= 0:
        # find the solid surface: first row where >= 90% of pixels are opaque
        a = img.getchannel("A").load()
        solid_row = 0
        for y in range(img.height):
            if sum(1 for x in range(work_w) if a[x, y] >= 128) >= work_w * 0.9:
                solid_row = y
                break
        canvas.paste(img, (0, surface - solid_row), img)
    elif top >= 0:
        canvas.paste(img, (0, top), img)
    else:
        canvas.paste(img, (0, th - nh), img)
    # extend the bottom row down if the content is shorter than the canvas
    bbox = canvas.getchannel("A").getbbox()
    if bbox and bbox[3] < th:
        last = canvas.crop((0, bbox[3] - 1, work_w, bbox[3]))
        for y in range(bbox[3], th):
            canvas.paste(last, (0, y))
    canvas = make_seamless(canvas, blend)
    canvas = pixelize.quantize(canvas, colors, snap)
    canvas = pixelize.harden_alpha(canvas, 128, False)
    remove_specks(canvas, 8)
    if surface >= 0:
        # contract: every pixel from the surface row down is opaque; fill dips from the pixel below
        px = canvas.load()
        for y in range(th - 2, surface - 1, -1):
            for x in range(canvas.width):
                if px[x, y][3] == 0:
                    px[x, y] = px[x, y + 1]
    pixelize.save(canvas, out)


def seamcheck(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size
    diff = sum(sum(abs(a - b) for a, b in zip(px[0, y], px[w - 1, y])) for y in range(h))
    print(f"{path.name}: edge diff total={diff} per-row={diff / h:.1f}")


def split(raw: Path, n: int, prefix: str, key: str = "FF00FF") -> None:
    img = pixelize.remove_background(Image.open(raw), key, 60)
    a = img.getchannel("A").load()
    w, h = img.size
    cols = [any(a[x, y] >= 128 for y in range(h)) for x in range(w)]
    runs: list[list[int]] = []
    x = 0
    while x < w:
        if cols[x]:
            s = x
            while x < w and cols[x]:
                x += 1
            runs.append([s, x])
        else:
            x += 1
    # merge tiny gaps until n runs remain
    runs = [r for r in runs if r[1] - r[0] > 4]
    while len(runs) > n:
        gaps = [(runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
        _, i = min(gaps)
        runs[i] = [runs[i][0], runs[i + 1][1]]
        del runs[i + 1]
    for i, (s, e) in enumerate(runs):
        crop = img.crop((s, 0, e, h))
        crop = pixelize.crop_to_content(crop, 128)
        bg = Image.new("RGBA", crop.size, (255, 0, 255, 255))
        bg.alpha_composite(crop)
        out = Path(f"{prefix}-{i}.png")
        bg.convert("RGB").save(out)
        print(f"wrote {out} {crop.size}")


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("strip")
    s.add_argument("raw", type=Path)
    s.add_argument("out", type=Path)
    s.add_argument("--size", required=True)
    s.add_argument("--surface", type=int, default=-1)
    s.add_argument("--colors", type=int, default=28)
    s.add_argument("--blend", type=int, default=48)
    s.add_argument("--key", default="FF00FF")
    s.add_argument("--snap", default=None)
    s.add_argument("--vsquash", type=float, default=1.0)
    s.add_argument("--top", type=int, default=-1)
    s.add_argument("--grade", default=None)
    s.add_argument("--grade-amt", type=float, default=0.0)
    c = sub.add_parser("seamcheck")
    c.add_argument("png", type=Path, nargs="+")
    sp = sub.add_parser("split")
    sp.add_argument("raw", type=Path)
    sp.add_argument("n", type=int)
    sp.add_argument("prefix")
    args = p.parse_args()
    if args.cmd == "strip":
        strip(args.raw, args.out, args.size, args.surface, args.colors, args.blend, args.key, args.snap,
              args.vsquash, args.top, args.grade, args.grade_amt)
    elif args.cmd == "seamcheck":
        for png in args.png:
            seamcheck(png)
    else:
        split(args.raw, args.n, args.prefix)
    return 0


if __name__ == "__main__":
    sys.exit(main())
