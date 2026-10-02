"""Wave 3 atmospheric-perspective pass for the FAR planet layer (planet-far-plum, planet-im-fine).

Critic r2: background planets used the same contrast/saturation/outline treatment as the foreground
asteroids and read as stickers on one plane. This pass pushes them back without repainting them:

  1. value-contrast compression around the body's mean luminance (shadows lifted, highlights pulled),
  2. desaturation + a blend toward a navy-plum haze (#4B4C70, between ink-soft and plum),
  3. edge treatment: the silhouette ring loses its lit-side highlight / ink re-ink and becomes one
     uniform haze-dark tone (a soft limb, not a sticker outline); a 1 px inner limb is slightly darkened,
  4. palette reduction (fewer tones = less micro-detail at distance), hard alpha kept.

Usage: python atmos_w3.py <in.png> <out.png> [--contrast 0.6] [--haze 0.3] [--sat 0.6] [--colors 14]
"""
from __future__ import annotations

import argparse
import colorsys

from PIL import Image

HAZE = (0x4B, 0x4C, 0x70)
LIMB = (0x2C, 0x2C, 0x48)


def lum(c: tuple[int, int, int]) -> float:
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--contrast", type=float, default=0.6)
    ap.add_argument("--haze", type=float, default=0.3)
    ap.add_argument("--sat", type=float, default=0.6)
    ap.add_argument("--colors", type=int, default=14)
    ap.add_argument("--limb", type=float, default=0.55, help="blend of edge pixels toward LIMB")
    ap.add_argument("--value", type=float, default=1.0, help="overall brightness scale (distance dimming)")
    ap.add_argument("--detail", type=float, default=0.55, help="scale of local (high-frequency) value detail")
    ap.add_argument("--blur", type=float, default=6.0, help="radius separating form shading from surface detail")
    ap.add_argument("--keep", default="", help="hex colours (comma list) of accent pixels to treat at half strength, e.g. the bandage")
    a = ap.parse_args()

    im = Image.open(a.inp).convert("RGBA")
    w, h = im.size
    px = im.load()
    opaque = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] >= 128]
    mean = sum(lum(px[x, y][:3]) for x, y in opaque) / len(opaque)

    # low-frequency luminance (form: terminator, limb darkening) vs high-frequency (surface detail).
    from PIL import ImageFilter
    lmap = Image.new("L", (w, h), int(mean))
    lp = lmap.load()
    for x, y in opaque:
        lp[x, y] = int(lum(px[x, y][:3]))
    low = lmap.filter(ImageFilter.GaussianBlur(a.blur)).load()
    keep = {tuple(int(k.strip().lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) for k in a.keep.split(",") if k.strip()}

    def near_keep(c: tuple[int, int, int]) -> bool:
        return any(sum(abs(c[i] - k[i]) for i in range(3)) < 60 for k in keep)

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for x, y in opaque:
        r, g, b, _ = px[x, y]
        soft = 0.25 if near_keep((r, g, b)) else 1.0
        hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        ss *= 1 - (1 - a.sat) * soft
        r2, g2, b2 = colorsys.hls_to_rgb(hh, ll, ss)
        c = [r2 * 255, g2 * 255, b2 * 255]
        L = lum((int(c[0]), int(c[1]), int(c[2])))
        lo = low[x, y]
        con = 1 - (1 - a.contrast) * soft
        det = 1 - (1 - a.detail) * soft
        target = (mean + (lo - mean) * con + (L - lo) * det) * (1 - (1 - a.value) * soft)
        k = target / max(L, 1.0)
        c = [v * k for v in c]
        hz = a.haze * soft
        c = [c[i] * (1 - hz) + HAZE[i] * hz for i in range(3)]
        op[x, y] = tuple(max(0, min(255, round(v))) for v in c) + (255,)

    # palette reduction on the opaque body only
    rgb = Image.new("RGB", (w, h), HAZE)
    rgb.paste(out.convert("RGB"), mask=out.split()[3])
    q = rgb.quantize(colors=a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    qp = q.load()
    for x, y in opaque:
        if not near_keep(px[x, y][:3]):  # accent pixels (e.g. the bandage pad) keep their own tone
            op[x, y] = qp[x, y] + (255,)

    def solid(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h and px[x, y][3] >= 128

    # uniform soft limb: silhouette pixels toward LIMB (no lit-side highlight, no hard ink)
    edge = [(x, y) for x, y in opaque if not all(solid(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        c = op[x, y]
        op[x, y] = tuple(round(c[i] * (1 - a.limb) + LIMB[i] * a.limb) for i in range(3)) + (255,)

    out.save(a.out, optimize=True)
    print(f"{a.out}: mean L {mean:.0f}, {len(opaque)} px, {len(edge)} edge px")


if __name__ == "__main__":
    main()
