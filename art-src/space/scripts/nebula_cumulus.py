"""Rebuild the nebula as STEPPED CUMULUS at true 640x360 art resolution. Dev tooling only (round 3).

Round-2 (nebula_true.py) kept the raw's soft density as 5 partial-alpha levels, which read as haze.
This keeps the same composition (top + bottom bands, calm empty middle, amber top-left rims on the
left plum clouds) but re-authors the tone as flat cel steps with hard 1 px edges:

  1. Smooth premultiplied source at 640(+overlap)x360 from the raw on black (median + blur erase the
     raw's own pixel grid), seam-quilted exactly like nebula_true.py so x=639 -> x=0 wraps.
  2. Density field D (max channel), blurred wrap-aware, times a scalloped top/bottom envelope so the
     silhouette curls away into rounded cloud tops before the edge (the layer is vertically mirrored
     at runtime, so the edge rows must be empty).
  3. Silhouette = D > t_body. Contours of the blurred field give rounded lobe outlines.
  4. Shading = density + a lighting term from the gradient of a broader blur of D (light from the
     top-left), quantized into 3 flat body steps (shadow / mid / light). A 4th step, the rim, is a
     1-2 px lit lip on every top-left facing edge of the silhouette and of each light lobe.
  5. Hue family (plum / teal / dusk, amber where the raw had warm rims) from the un-premultiplied
     colour, mode-filtered into coherent regions; each family has a hand-picked 4-step ramp.
  6. Cleanup: islands smaller than a few px are absorbed (mode filter on the level map) so every step
     edge is a clean stepped 1 px line, no fuzzy fringe, no dither noise.
  7. Alpha is flat per step (shadow < mid < light = rim <= ALPHA_MAX), never a soft ramp.

    python art-src/space/scripts/nebula_cumulus.py <raw.png> <out.png> [options]
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nebula_true import quilt_seam, smoothstep  # noqa: E402

W, H = 640, 360
ALPHA_MAX = 127

# shadow, mid, light, rim (rgb). Muted, from the design tokens (plum #9B8FB8, dusk-blue #9EB6C4, teal #6FA39A, amber #D4A055).
RAMPS: dict[str, list[tuple[int, int, int]]] = {
    "plum": [(64, 54, 96), (100, 88, 138), (148, 134, 180), (196, 184, 220)],
    "teal": [(40, 72, 84), (66, 110, 114), (106, 158, 150), (164, 206, 192)],
    "dusk": [(52, 64, 94), (88, 108, 138), (142, 168, 186), (200, 218, 228)],
    "amber": [(64, 54, 96), (106, 88, 132), (176, 140, 132), (226, 178, 108)],
}
FAMILIES = ["plum", "teal", "dusk", "amber"]
BACK = (44, 40, 72)


def wrap_blur(arr: np.ndarray, radius: float) -> np.ndarray:
    """Separable Gaussian blur (sigma = radius) that wraps horizontally and clamps vertically."""
    if radius <= 0:
        return arr.astype(np.float64).copy()
    k = int(math.ceil(radius * 3))
    xs = np.arange(-k, k + 1, dtype=np.float64)
    ker = np.exp(-0.5 * (xs / radius) ** 2)
    ker /= ker.sum()
    a = arr.astype(np.float64)
    out = np.zeros_like(a)
    for i, w in zip(range(-k, k + 1), ker):
        out += w * np.roll(a, i, axis=1)
    pad = np.concatenate([np.repeat(out[:1], k, 0), out, np.repeat(out[-1:], k, 0)], axis=0)
    res = np.zeros_like(a)
    for i, w in zip(range(2 * k + 1), ker):
        res += w * pad[i : i + a.shape[0]]
    return res


def wrap_mode(lab: np.ndarray, size: int) -> np.ndarray:
    pad = np.concatenate([lab[:, -16:], lab, lab[:, :16]], axis=1).astype(np.uint8)
    out = np.array(Image.fromarray(pad, mode="L").filter(ImageFilter.ModeFilter(size)))
    return out[:, 16 : 16 + W]


def smooth_source(raw_path: Path, blend: int, median: int, blur: float, squash: float, feather: int) -> np.ndarray:
    raw = Image.open(raw_path).convert("RGB")
    if median > 1:
        raw = raw.filter(ImageFilter.MedianFilter(median))
    if blur > 0:
        raw = raw.filter(ImageFilter.GaussianBlur(blur))
    tw = W + blend
    scale = max(tw / raw.width, H / raw.height)
    nw, nh = round(raw.width * scale), max(H, round(raw.height * scale * squash))
    sm = raw.resize((nw, nh), Image.Resampling.BOX)
    left, top = (nw - tw) // 2, (nh - H) // 2
    sm = sm.crop((left, top, left + tw, top + H))
    src = sm.load()
    path = quilt_seam(src, blend)
    a = np.array(sm, dtype=np.float64)
    out = a[:, :W].copy()
    f = max(1, feather)
    for y in range(H):
        s = path[y]
        for x in range(blend):
            t = smoothstep((x - (s - f)) / (2 * f))
            out[y, x] = a[y, x + W] * (1 - t) + a[y, x] * t
    return out


def scallop(x: np.ndarray, ph: float, n1: int, n2: int) -> np.ndarray:
    t = 2 * math.pi * x / W
    v = 0.6 * np.abs(np.sin(n1 * t + ph)) ** 0.6 + 0.4 * np.abs(np.sin(n2 * t + 1.7 * ph)) ** 0.6
    return np.minimum(1.0, v)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("src", type=Path)
    p.add_argument("out", type=Path)
    p.add_argument("--blend", type=int, default=192)
    p.add_argument("--median", type=int, default=7)
    p.add_argument("--blur", type=float, default=2.5)
    p.add_argument("--squash", type=float, default=0.82)
    p.add_argument("--feather", type=int, default=6)
    p.add_argument("--dblur", type=float, default=2.0, help="blur of the density field (art px) -> roundness of lobes")
    p.add_argument("--lblur", type=float, default=7.0, help="blur used for the lighting normal (art px) -> lobe scale")
    p.add_argument("--t-body", type=float, default=0.30, help="silhouette threshold on normalized density")
    p.add_argument("--t-back", type=float, default=0.0, help="optional dim back-bank threshold (0 = off)")
    p.add_argument("--light-w", type=float, default=0.55, help="weight of the lighting term vs density")
    p.add_argument("--steps", type=str, default="0.42,0.62", help="shade thresholds shadow|mid|light")
    p.add_argument("--edge", type=int, default=22)
    p.add_argument("--edge-wave", type=float, default=9.0)
    p.add_argument("--rim", type=int, default=1, help="rim thickness in px on lit silhouette edges")
    p.add_argument("--inner-rim", action="store_true", help="also rim the top-left edge of light lobes")
    p.add_argument("--mode", type=int, default=5, help="mode filter size for level/hue cleanup")
    p.add_argument("--alphas", type=str, default="104,118,127,127")
    p.add_argument("--back-alpha", type=int, default=70)
    a = p.parse_args()

    S = smooth_source(a.src, a.blend, a.median, a.blur, a.squash, a.feather)
    m = S.max(axis=2)
    # un-premultiplied colour for hue classification
    col = S / np.maximum(m, 1)[..., None]

    # density normalized to 0..1 using the 99th percentile of visible density
    D = wrap_blur(m, a.dblur)
    ref = np.percentile(D[D > 12], 99) if (D > 12).any() else 255
    D = np.clip(D / ref, 0, 1)

    # scalloped envelope: puffs curl away into rounded tops before the mirrored edge
    xs = np.arange(W, dtype=np.float64)
    env = np.ones((H, W))
    for y in range(H):
        d = min(y, H - 1 - y)
        ph = 0.0 if y < H // 2 else 2.4
        off = a.edge_wave * (1 - scallop(xs, ph, 5, 11))
        ramp = max(2.0, a.edge - 2 - a.edge_wave)
        env[y] = 0.0 if d < 3 else np.clip(((d - 3 - off) / ramp), 0, 1)
    env = np.vectorize(smoothstep)(env) if False else env * env * (3 - 2 * env)
    D = D * env

    # lighting from the gradient of a broad blur (normal points down the density slope = outward)
    B = wrap_blur(D * 255, a.lblur) / 255
    gx = (np.roll(B, -1, axis=1) - np.roll(B, 1, axis=1)) * 0.5
    gy = np.zeros_like(B)
    gy[1:-1] = (B[2:] - B[:-2]) * 0.5
    lx, ly = -0.62, -0.78  # toward the light (top-left)
    # outward normal = -grad; facing = n . l
    nrm = np.hypot(gx, gy) + 1e-6
    facing = (-(gx * lx + gy * ly)) / nrm
    strength = np.clip(nrm / (np.percentile(nrm[D > a.t_body], 90) + 1e-6), 0, 1)
    light = 0.5 + 0.5 * facing * strength  # 0..1, 0.5 = flat
    shade = (1 - a.light_w) * D + a.light_w * light

    body = D > a.t_body
    t1, t2 = (float(v) for v in a.steps.split(","))
    lvl = np.full((H, W), -1, dtype=np.int32)
    if a.t_back > 0:
        lvl[(D > a.t_back) & ~body] = 9
    lvl[body] = 0
    lvl[body & (shade > t1)] = 1
    lvl[body & (shade > t2)] = 2

    # hue family from un-premultiplied colour
    r, g, b = col[..., 0], col[..., 1], col[..., 2]
    fam = np.zeros((H, W), dtype=np.int32)  # plum
    teal = (g > r * 1.08) & (g >= b * 0.92)
    dusk = (b > r * 1.12) & ~teal
    warm = (r > b * 1.05) & (r > g * 1.02)
    fam[dusk] = 2
    fam[teal] = 1
    fam[warm] = 3
    fam = wrap_mode(fam, a.mode)
    # amber only near the lit tops: dilate warm areas a bit, keep as its own ramp
    # cleanup level map (shift by 1 so -1 -> 0)
    lv = wrap_mode(lvl + 1, a.mode).astype(np.int32) - 1
    lv[lv == 8] = -1  # guard
    # never let cleanup grow the silhouette outside the body
    lv[(~body) & (lv >= 0) & (lv != 9)] = -1
    lv[body & (lv < 0)] = 0
    lv[(lv == 9) & body] = 0

    # rim: lit top-left edges of the silhouette (neighbour toward the light is outside the body)
    inside = lv >= 0
    inside &= lv != 9
    rim = np.zeros((H, W), dtype=bool)
    for k in range(1, a.rim + 1):
        up = np.zeros_like(inside)
        up[k:] = inside[:-k]
        left = np.roll(inside, k, axis=1)
        diag = np.zeros_like(inside)
        diag[k:] = np.roll(inside, k, axis=1)[:-k]
        edge = inside & (~up | (~left & ~diag))
        rim |= edge & (lv >= 1)
    if a.inner_rim:
        lt = lv == 2
        up = np.zeros_like(lt)
        up[1:] = lt[:-1]
        left = np.roll(lt, 1, axis=1)
        rim |= lt & ~up & ~left
    alphas = [int(v) for v in a.alphas.split(",")]

    out = np.zeros((H, W, 4), dtype=np.uint8)
    for y in range(H):
        for x in range(W):
            L = lv[y, x]
            if L < 0:
                continue
            if L == 9:
                out[y, x] = (*BACK, a.back_alpha)
                continue
            ramp = RAMPS[FAMILIES[fam[y, x]]]
            if rim[y, x]:
                out[y, x] = (*ramp[3], alphas[3])
            else:
                out[y, x] = (*ramp[L], alphas[L])
    img = Image.fromarray(out, mode="RGBA")
    a.out.parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out, optimize=True)
    al = out[..., 3]
    print(f"wrote {a.out} colours={len(img.getcolors(1 << 16) or [])} max_alpha={al.max()} visible={(al > 0).mean():.2f}")


if __name__ == "__main__":
    main()
