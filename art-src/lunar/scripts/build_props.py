"""Build lunar prop sprites with exact contracts (dev tooling; Pillow).

Run from repo root:  python art-src/lunar/scripts/build_props.py <asset> [variant]
assets: pad, lantern, rocks, teahouse
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "art"))
import pixelize  # noqa: E402

RAW = ROOT / "art-src" / "lunar" / "raw"
OUT = ROOT / "public" / "assets" / "lunar"


def keyed(path: Path) -> Image.Image:
    return pixelize.remove_background(Image.open(path), "FF00FF", 60)


def finish(img: Image.Image, colors: int, snap: str | None = None) -> Image.Image:
    img = pixelize.quantize(img, colors, snap)
    return pixelize.harden_alpha(img, 128, False)


def first_solid_row(img: Image.Image, frac: float) -> int:
    a = img.getchannel("A").load()
    w, h = img.size
    for y in range(h):
        if sum(1 for x in range(w) if a[x, y] >= 128) >= w * frac:
            return y
    return 0


def pad(variant: str) -> None:
    W, H, SURFACE = 176, 24, 6
    img = pixelize.crop_to_content(keyed(RAW / f"lunar-pad-{variant}.png"), 128)
    scale = W / img.width
    img = img.resize((W, max(1, round(img.height * scale))), Image.Resampling.BOX)
    img = finish(img, 28)
    mat_top = first_solid_row(img, 0.7)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(img, (0, SURFACE - mat_top)) if SURFACE - mat_top >= 0 else canvas.paste(
        img.crop((0, mat_top - SURFACE, W, img.height)), (0, 0)
    )
    # enforce contract: rows 0..SURFACE-1 transparent except the corner posts (outer 10 px each side)
    px = canvas.load()
    for y in range(SURFACE):
        for x in range(12, W - 12):
            px[x, y] = (0, 0, 0, 0)
    pixelize.save(canvas, OUT / "lunar-pad.png")


def lantern(variant: str) -> None:
    FW, FH = 12, 28
    raw = keyed(RAW / f"lunar-lantern-{variant}.png")
    w, h = raw.size
    halves = [raw.crop((0, 0, w // 2, h)), raw.crop((w // 2, 0, w, h))]
    # bbox from the UNLIT frame (no glow particles); reuse its size for the lit frame aligned on the post
    b0 = pixelize.crop_to_content(halves[0], 128)
    bbox0 = halves[0].getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
    bbox1 = halves[1].getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
    assert bbox0 and bbox1
    bw, bh = bbox0[2] - bbox0[0], bbox0[3] - bbox0[1]
    # align lit frame by its bottom-left (the post base foot)
    crop1 = halves[1].crop((bbox1[0], bbox1[3] - bh, bbox1[0] + bw, bbox1[3]))
    frames = []
    for src in (b0, crop1):
        scale = min(FW / bw, FH / bh)
        nw, nh = max(1, round(bw * scale)), max(1, round(bh * scale))
        small = src.resize((nw, nh), Image.Resampling.BOX)
        frame = Image.new("RGBA", (FW, FH), (0, 0, 0, 0))
        frame.alpha_composite(small, ((FW - nw) // 2, FH - nh))
        frames.append(frame)
    strip = Image.new("RGBA", (FW * 2, FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.alpha_composite(f, (i * FW, 0))
    strip = finish(strip, 24)
    pixelize.save(strip, OUT / "lunar-lantern.png")


def rocks(variant: str) -> None:
    FW, FH = 32, 16
    work = ROOT / "art-src" / "lunar" / "work"
    crops = [pixelize.crop_to_content(keyed(work / f"rocks-{variant}-{i}.png"), 128) for i in range(3)]
    strip = Image.new("RGBA", (FW * 3, FH), (0, 0, 0, 0))
    for i, c in enumerate(crops):
        s = min(FW / c.width, FH / c.height)  # each cluster fills its frame (readability at 2x)
        nw, nh = max(1, round(c.width * s)), max(1, round(c.height * s))
        small = c.resize((nw, nh), Image.Resampling.BOX)
        strip.alpha_composite(small, (i * FW + (FW - nw) // 2, FH - nh))
    strip = finish(strip, 28)
    pixelize.save(strip, OUT / "lunar-rocks.png")


def teahouse(variant: str) -> None:
    W, H = 96, 80
    img = pixelize.crop_to_content(keyed(RAW / f"lunar-teahouse-{variant}.png"), 128)
    scale = min(W / img.width, H / img.height)
    nw, nh = round(img.width * scale), round(img.height * scale)
    small = img.resize((nw, nh), Image.Resampling.BOX)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((W - nw) // 2, H - nh))
    canvas = finish(canvas, 32)
    pixelize.save(canvas, OUT / "lunar-teahouse.png")


if __name__ == "__main__":
    name = sys.argv[1]
    variant = sys.argv[2] if len(sys.argv) > 2 else "v1"
    {"pad": pad, "lantern": lantern, "rocks": rocks, "teahouse": teahouse}[name](variant)
