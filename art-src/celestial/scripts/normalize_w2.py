"""Wave-2 celestial normalizer (pure Pillow, dev tooling only).

Turns a Codex image_gen raw (subject on flat magenta) into an exact production PNG:
  1. magenta key by "magenta score" (min(r,b) - g) + 2 px erosion to drop AA fringe
  2. exact placement: raw subject geometry (disc centre/diameter) -> art canvas geometry,
     box-downscaled with coverage-normalised colour (no fringe bleeding), hard alpha
  3. optional top-left Lambert terminator darkening on the disc (cool tint)
  4. per-region palettes (so small accents like the roof, tea, bandage keep their colour)
  5. isolated-pixel cleanup on the body only
  6. silhouette re-ink: ink on the shadow side, darker local colour on the lit side

Usage: python normalize_w2.py <asset> [raw.png] [out.png]
  asset in: tea-moon | planet-far-plum | planet-im-fine
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "art-src" / "celestial" / "raw"
OUT = ROOT / "public" / "assets" / "celestial"

INK = (0x1D, 0x1F, 0x33)
LIGHT = (-0.55, -0.62, 0.56)
_l = math.sqrt(sum(c * c for c in LIGHT))
LIGHT = tuple(c / _l for c in LIGHT)


def key_mask(img: Image.Image, clear: list[tuple[int, int, int, int]]) -> Image.Image:
    rgb = img.convert("RGB")
    px = rgb.load()
    m = Image.new("L", rgb.size, 0)
    mp = m.load()
    w, h = rgb.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if min(r, b) - g < 70:
                mp[x, y] = 255
    for x0, y0, x1, y1 in clear:
        m.paste(0, (x0, y0, x1, y1))
    return m.filter(ImageFilter.MinFilter(5))


def downscale(img: Image.Image, mask: Image.Image, src_box: tuple[float, float, float, float],
              size: tuple[int, int]) -> Image.Image:
    rgb = img.convert("RGB")
    black = Image.new("RGB", rgb.size, (0, 0, 0))
    pre = Image.composite(rgb, black, mask)
    small = pre.resize(size, Image.Resampling.BOX, box=src_box)
    cov = mask.resize(size, Image.Resampling.BOX, box=src_box)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    sp, cp, op = small.load(), cov.load(), out.load()
    for y in range(size[1]):
        for x in range(size[0]):
            c = cp[x, y]
            if c >= 128:
                r, g, b = sp[x, y]
                f = 255.0 / c
                op[x, y] = (min(255, round(r * f)), min(255, round(g * f)), min(255, round(b * f)), 255)
    return out


def shade_disc(img: Image.Image, cx: float, cy: float, r: float, tint: tuple[int, int, int],
               strength: float, lo: float, hi: float, exclude=None) -> None:
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            if p[3] == 0 or (exclude and exclude(x, y)):
                continue
            dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
            d2 = dx * dx + dy * dy
            if d2 > 1.0:
                d2 = 1.0
            dz = math.sqrt(1.0 - d2)
            lam = dx * LIGHT[0] + dy * LIGHT[1] + dz * LIGHT[2]
            t = (hi - lam) / (hi - lo)
            t = max(0.0, min(1.0, t))
            t = t * t * (3 - 2 * t) * strength
            px[x, y] = tuple(round(p[i] * (1 - t) + p[i] * tint[i] / 255 * t) for i in range(3)) + (255,)


def region_quantize(img: Image.Image, regions: list[tuple[str, int]], region_of) -> list[tuple[int, int, int]]:
    px = img.load()
    buckets: dict[str, list[tuple[int, int]]] = {name: [] for name, _ in regions}
    for y in range(img.height):
        for x in range(img.width):
            if px[x, y][3]:
                buckets[region_of(x, y, px[x, y])].append((x, y))
    allpal: list[tuple[int, int, int]] = []
    for name, budget in regions:
        pts = buckets[name]
        if not pts:
            continue
        strip = Image.new("RGB", (len(pts), 1))
        sp = strip.load()
        for i, (x, y) in enumerate(pts):
            sp[i, 0] = px[x, y][:3]
        q = strip.quantize(colors=budget, method=Image.Quantize.MEDIANCUT, kmeans=4)
        pal = q.getpalette()[: budget * 3]
        cols = [tuple(pal[i:i + 3]) for i in range(0, len(pal), 3)]
        used = sorted(set(q.tobytes()))
        cols = [cols[i] for i in used]
        allpal += cols
        for (x, y) in pts:
            c = px[x, y]
            best = min(cols, key=lambda k: (k[0] - c[0]) ** 2 * 3 + (k[1] - c[1]) ** 2 * 4 + (k[2] - c[2]) ** 2 * 2)
            px[x, y] = best + (255,)
    return allpal


def cleanup(img: Image.Image, allow) -> None:
    px = img.load()
    w, h = img.size
    src = img.copy().load()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = src[x, y]
            if not c[3] or not allow(x, y):
                continue
            nb = [src[x + 1, y], src[x - 1, y], src[x, y + 1], src[x, y - 1]]
            if any(n[3] == 0 for n in nb) or any(n == c for n in nb):
                continue
            counts: dict = {}
            for n in nb:
                counts[n] = counts.get(n, 0) + 1
            best, k = max(counts.items(), key=lambda kv: kv[1])
            if k >= 3:
                px[x, y] = best


def darker(c, f=0.62):
    return tuple(round(v * f) for v in c[:3])


def reink(img: Image.Image, cx: float, cy: float, skip=None) -> None:
    px = img.load()
    w, h = img.size
    src = img.copy().load()
    for y in range(h):
        for x in range(w):
            c = src[x, y]
            if not c[3] or (skip and skip(x, y)):
                continue
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h or src[nx, ny][3] == 0:
                    edge = True
                    break
            if not edge:
                continue
            nx, ny = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(nx, ny) or 1.0
            lit = (nx * LIGHT[0] + ny * LIGHT[1]) / d
            px[x, y] = (INK if lit < 0.15 else darker(c)) + (255,)


def build(asset: str, raw: Path, out: Path) -> None:
    src = Image.open(raw)
    cfg = CONFIGS[asset]
    mask = key_mask(src, cfg.get("clear", []))
    rcx, rcy, rd = cfg["raw_disc"]
    acx, acy, ad = cfg["art_disc"]
    s = ad / rd
    W, H = cfg["size"]
    P = 600
    big = Image.new("RGB", (src.width + 2 * P, src.height + 2 * P), (255, 0, 255))
    big.paste(src.convert("RGB"), (P, P))
    bigm = Image.new("L", big.size, 0)
    bigm.paste(mask, (P, P))
    box = (rcx + P - acx / s, rcy + P - acy / s, rcx + P + (W - acx) / s, rcy + P + (H - acy) / s)
    img = downscale(big, bigm, box, (W, H))
    r = ad / 2
    if "shade" in cfg:
        tint, strength, lo, hi = cfg["shade"]
        shade_disc(img, acx, acy, r, tint, strength, lo, hi, cfg.get("noshade"))
    region_of = cfg["region_of"]
    pal = region_quantize(img, cfg["regions"], region_of)
    snap = img.copy().load()
    cleanup(img, lambda x, y: region_of(x, y, snap[x, y]) == "body")
    reink(img, acx, acy, cfg.get("noink"))
    if "post" in cfg:
        cfg["post"](img)
    if "windows" in cfg:
        glow_windows(img, cfg["windows"])
    if "steam" in cfg:
        steam_puffs(img, cfg["steam"])
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, optimize=True)
    print(f"wrote {out} {img.size} palette<= {len(pal) + 3}")


def steam_puffs(img: Image.Image, puffs: list[tuple[float, float, float, int]]) -> None:
    """Paint soft round steam puffs (cx, cy, r, alpha) with top-left light, at art resolution."""
    px = img.load()
    hi, mid, lo = (0xFB, 0xF7, 0xEC), (0xF1, 0xEA, 0xDA), (0xD8, 0xD8, 0xD4)
    for cx, cy, r, a in puffs:
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                if dx * dx + dy * dy > r * r:
                    continue
                if 0 <= x < img.width and 0 <= y < img.height and px[x, y][3] == 0:
                    k = (dx * LIGHT[0] + dy * LIGHT[1]) / r
                    col = hi if k > 0.25 else (mid if k > -0.35 else lo)
                    px[x, y] = col + (a,)


def glow_windows(img: Image.Image, centres: list[tuple[int, int]]) -> None:
    """Round 5x5 tea-house windows: terracotta-deep frame, warm amber glow (canonical lunar-teahouse look)."""
    px = img.load()
    frame, glow, warm, hot, mull = (0x8A, 0x4A, 0x36), (0xF0, 0xB0, 0x58), (0xE0, 0x8A, 0x4B), (0xFF, 0xE3, 0xA3), (0xB8, 0x6A, 0x3C)
    rows = [" fff ", "fhgwf", "fgmwf", "fwwwf", " fff "]
    lut = {"f": frame, "g": glow, "w": warm, "h": hot, "m": mull}
    for cx, cy in centres:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != " ":
                    px[cx - 2 + i, cy - 2 + j] = lut[ch] + (255,)


# ---------------------------------------------------------------- per-asset geometry
def _moon_region(x, y, c=None):
    if (x - 90) ** 2 + (y - 112) ** 2 > 70 ** 2 and y < 80 and x > 96:
        return "house"
    if y < 50 and x > 104:
        return "house"
    if 108 <= x <= 140 and y <= 55 and (c is None or c[0] > c[1] - 6 or y <= 52):
        return "house"
    if (x - 77) ** 2 + (y - 100) ** 2 < 24 ** 2 and x < 104:
        return "cup"
    return "body"


def _imfine_region(x, y, c=(0, 0, 0, 0)):
    # bandage = warm (cream/peach) pixels inside the bandage box; lavender stays body
    if 26 <= x <= 54 and 26 <= y <= 56 and c[0] > c[2] + 4:
        return "bandage"
    return "body"


CONFIGS = {
    "tea-moon": {
        "size": (192, 192),
        "raw_disc": (628.0, 680.0, 1015.0),
        "art_disc": (90.0, 112.0, 144.0),
        "regions": [("body", 20), ("house", 14), ("cup", 7)],
        "region_of": _moon_region,
        "shade": ((0x55, 0x78, 0x80), 0.62, -0.05, 0.55),
        "noshade": lambda x, y: _moon_region(x, y) != "body",
        "clear": [(915, 0, 1030, 104)],
        "steam": [(141.0, 28.5, 2.0, 240), (143.5, 23.0, 2.6, 215), (147.5, 16.5, 3.1, 185)],
    },
    "planet-far-plum": {
        "size": (96, 96),
        "raw_disc": (627.0, 620.0, 870.0),
        "art_disc": (48.0, 48.0, 62.0),
        "regions": [("body", 22)],
        "region_of": lambda x, y, c=None: "body",
    },
    "planet-im-fine": {
        "size": (128, 128),
        "raw_disc": (630.0, 628.0, 1060.0),
        "art_disc": (64.0, 64.0, 106.0),
        "regions": [("body", 22), ("bandage", 7)],
        "region_of": _imfine_region,
        "shade": ((0x5E, 0x55, 0x86), 0.45, -0.1, 0.5),
    },
}

# v1 raw needed its "?"-shaped steam replaced; v2 (chosen) already has round puffs.
CONFIGS["tea-moon-v1"] = CONFIGS["tea-moon"]
CONFIGS["tea-moon"] = {
    **CONFIGS["tea-moon-v1"],
    "raw_disc": (627.0, 677.0, 1014.0),
    # v2's own puffs are ~2 art px and get re-inked; clear them and paint softer, larger ones
    "clear": [(925, 0, 1040, 100)],
    "steam": [(138.5, 26.0, 2.6, 255), (142.5, 20.0, 3.2, 240), (147.5, 13.0, 3.7, 215)],
    "windows": [(113, 46), (133, 49)],
}


if __name__ == "__main__":
    asset = sys.argv[1]
    raw = Path(sys.argv[2]) if len(sys.argv) > 2 else RAW / f"{asset}-v1.png"
    out = Path(sys.argv[3]) if len(sys.argv) > 3 else OUT / f"{asset}.png"
    build(asset, raw, out)
