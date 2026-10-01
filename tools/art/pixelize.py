"""Normalize generated source art into production pixel-art PNGs for Cosmic Gyoza Express.

Dev tooling only (requires Python 3.10+ and Pillow; not part of the game runtime).

Pipeline per input image:
  1. remove background: alpha already present, or chroma-key a flat colour (default magenta #FF00FF)
  2. crop to content (optional) and fit into the target art size (contain, centred, optional anchor)
  3. downscale to true art resolution (box filter, or nearest for already-pixel inputs)
  4. quantize colours (adaptive N colours, optionally snapped toward the CGE palette)
  5. hard alpha (pixel-art edges) and optional 1px ink outline
  6. write an optimized RGBA PNG

Examples:
  python tools/art/pixelize.py in.png out.png --size 72x72 --colors 20 --snap cge
  python tools/art/pixelize.py f1.png f2.png f3.png --sheet out.png --size 16x24 --colors 12
  python tools/art/pixelize.py sky.png out.png --size 640x360 --fit cover --opaque --colors 48
  python tools/art/pixelize.py --preview out.png --scale 2   (writes out.preview.png on dark+light)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageFilter

# Design tokens (docs/design/design-system.md) plus a few ramp helpers for shading.
CGE_PALETTE = [
    "1D1F33", "1A1B2E", "2F3149", "0E0F1C", "14162B", "3D3E4D",
    "F4ECDC", "ECDFC5", "F9F3E5", "FBF7EC", "E8D9BD", "D7CDB5", "B9AB8B",
    "C97B5A", "A6614A", "E08A4B", "D4A055", "8DA17A", "6B7E5A", "9EB6C4",
    "9B8FB8", "6FA39A", "C26954",
    # ramps
    "7A4017", "5E4F7A", "2E5232", "7A2E1F", "5A5C70", "C2CFAE", "C6DCC2",
    "F2C49A", "C7BEDE", "E5B0A2", "DDDCE2", "4B4D66", "6A6C85", "8C8EA3",
    "F7D9A8", "B98A5E", "8A5A3C", "4E8077", "A9C9C2", "D9E4E8", "5B6E8C",
]


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def parse_size(text: str) -> tuple[int, int]:
    w, h = text.lower().split("x")
    return int(w), int(h)


def remove_background(img: Image.Image, key: str | None, tolerance: int) -> Image.Image:
    img = img.convert("RGBA")
    if key is None:
        return img
    kr, kg, kb = hex_to_rgb(key)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if abs(r - kr) <= tolerance and abs(g - kg) <= tolerance and abs(b - kb) <= tolerance:
                px[x, y] = (0, 0, 0, 0)
            elif kr > 200 and kb > 200 and kg < 80 and r > 150 and b > 150 and g < 110:
                # magenta fringe from antialiasing: fade toward transparent
                px[x, y] = (r, g, b, int(a * 0.35))
    return img


def crop_to_content(img: Image.Image, alpha_threshold: int) -> Image.Image:
    alpha = img.getchannel("A").point(lambda v: 255 if v > alpha_threshold else 0)
    bbox = alpha.getbbox()
    return img.crop(bbox) if bbox else img


def fit(img: Image.Image, size: tuple[int, int], mode: str, resample: int, anchor: str, pad: int) -> Image.Image:
    tw, th = size
    inner_w, inner_h = max(1, tw - pad * 2), max(1, th - pad * 2)
    if mode == "stretch":
        return img.resize((tw, th), resample)
    scale = min(inner_w / img.width, inner_h / img.height) if mode == "contain" else max(tw / img.width, th / img.height)
    nw, nh = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    resized = img.resize((nw, nh), resample)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    if mode == "cover":
        left, top = (nw - tw) // 2, (nh - th) // 2
        return resized.crop((left, top, left + tw, top + th))
    x = (tw - nw) // 2
    y = {"top": pad, "center": (th - nh) // 2, "bottom": th - nh - pad}[anchor]
    canvas.paste(resized, (x, y), resized)
    return canvas


def quantize(img: Image.Image, colors: int, snap: str | None) -> Image.Image:
    alpha = img.getchannel("A")
    rgb = img.convert("RGB")
    if snap == "cge":
        pal_img = Image.new("P", (1, 1))
        flat: list[int] = []
        for value in CGE_PALETTE:
            flat.extend(hex_to_rgb(value))
        flat.extend([0, 0, 0] * (256 - len(CGE_PALETTE)))
        pal_img.putpalette(flat)
        adaptive = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert("RGB")
        snapped = adaptive.quantize(palette=pal_img, dither=Image.Dither.NONE).convert("RGB")
        # keep adaptive colours that are far from any palette entry (preserves unique hues)
        out = Image.blend(adaptive, snapped, 0.55)
        q = out.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    elif colors > 0:
        q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    else:
        q = rgb
    q = q.convert("RGBA")
    q.putalpha(alpha)
    return q


def harden_alpha(img: Image.Image, threshold: int, keep_soft: bool) -> Image.Image:
    if keep_soft:
        return img
    alpha = img.getchannel("A").point(lambda v: 255 if v >= threshold else 0)
    img = img.copy()
    img.putalpha(alpha)
    return img


def add_outline(img: Image.Image, color: str) -> Image.Image:
    rgb = hex_to_rgb(color)
    alpha = img.getchannel("A")
    grown = alpha.filter(ImageFilter.MaxFilter(3))
    outline = Image.new("RGBA", img.size, (*rgb, 0))
    px_o, px_g, px_a = outline.load(), grown.load(), alpha.load()
    for y in range(img.height):
        for x in range(img.width):
            if px_g[x, y] > 0 and px_a[x, y] == 0:
                px_o[x, y] = (*rgb, 255)
    outline.alpha_composite(img)
    return outline


def process(path: Path, args: argparse.Namespace) -> Image.Image:
    img = Image.open(path)
    img = remove_background(img, None if args.key == "none" else args.key, args.key_tolerance)
    if args.crop:
        img = crop_to_content(img, args.alpha_threshold)
    resample = Image.Resampling.NEAREST if args.nearest else Image.Resampling.BOX
    size = parse_size(args.size)
    img = fit(img, size, args.fit, resample, args.anchor, args.pad)
    img = quantize(img, args.colors, args.snap)
    if args.opaque:
        bg = Image.new("RGBA", img.size, (*hex_to_rgb("1A1B2E"), 255))
        bg.alpha_composite(img)
        img = bg
    img = harden_alpha(img, args.alpha_threshold, args.soft_alpha)
    if args.outline:
        img = add_outline(img, args.outline)
    return img


def save(img: Image.Image, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, optimize=True)
    print(f"wrote {out} {img.width}x{img.height}")


def preview(path: Path, scale: int) -> None:
    img = Image.open(path).convert("RGBA")
    big = img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)
    pad = 16
    sheet = Image.new("RGBA", (big.width * 2 + pad * 3, big.height + pad * 2), (*hex_to_rgb("F4ECDC"), 255))
    dark = Image.new("RGBA", (big.width + pad, big.height + pad), (*hex_to_rgb("1A1B2E"), 255))
    sheet.paste(dark, (pad // 2, pad // 2))
    sheet.alpha_composite(big, (pad, pad))
    sheet.alpha_composite(big, (big.width + pad * 2, pad))
    out = path.with_suffix(".preview.png")
    sheet.save(out)
    print(f"wrote {out}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", nargs="*", type=Path)
    parser.add_argument("--size", default="64x64", help="target art size per image/frame, e.g. 72x72")
    parser.add_argument("--fit", choices=["contain", "cover", "stretch"], default="contain")
    parser.add_argument("--anchor", choices=["top", "center", "bottom"], default="center")
    parser.add_argument("--pad", type=int, default=1, help="transparent padding in art px (contain mode)")
    parser.add_argument("--crop", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--key", default="FF00FF", help="chroma key hex or 'none' if input has alpha")
    parser.add_argument("--key-tolerance", type=int, default=60)
    parser.add_argument("--colors", type=int, default=24)
    parser.add_argument("--snap", choices=["cge"], default=None)
    parser.add_argument("--nearest", action="store_true", help="nearest downscale for inputs already on a pixel grid")
    parser.add_argument("--alpha-threshold", type=int, default=128)
    parser.add_argument("--soft-alpha", action="store_true", help="keep partial alpha (glows, nebula)")
    parser.add_argument("--opaque", action="store_true")
    parser.add_argument("--outline", default=None, help="hex colour for a 1px outline, e.g. 1D1F33")
    parser.add_argument("--sheet", type=Path, default=None, help="combine inputs into a horizontal strip")
    parser.add_argument("--preview", type=Path, default=None)
    parser.add_argument("--scale", type=int, default=2)
    parser.add_argument("output", nargs="?", type=Path)
    args = parser.parse_args()

    if args.preview:
        preview(args.preview, args.scale)
        return 0

    if args.sheet:
        frames = [process(p, args) for p in args.inputs]
        w, h = frames[0].size
        strip = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            strip.alpha_composite(frame, (i * w, 0))
        save(strip, args.sheet)
        return 0

    if len(args.inputs) == 2 and args.output is None:
        args.output = args.inputs.pop()
    if len(args.inputs) != 1 or args.output is None:
        parser.error("expected one input and one output (or use --sheet)")
    save(process(args.inputs[0], args), args.output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
