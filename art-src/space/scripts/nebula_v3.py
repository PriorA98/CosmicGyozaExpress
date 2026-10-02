"""Normalize a round-3 stepped-cumulus raw (Codex image_gen, clouds on black) into the nebula layer.

True 640x360 art resolution, 1 art px = 1 file px, hard 1 px stepped edges, flat alpha, no blended
in-between tones. Dev tooling only.

  1. Median filter on the raw, then quantize it AT RAW RESOLUTION to a small palette (median cut over the
     cloud pixels + reserved warm slots for the amber rims) plus an explicit 'sky' label for black.
  2. Label-aware downscale: each label's indicator is Gaussian-blurred (rounds off the raw's ~8 px stair
     grid) and box-resized to (640 + blend) x 360; every output pixel takes the label with the largest
     coverage. Contours therefore re-form as smooth curves with 1 px steps, and no pixel is ever a mix of
     two colours (no dark fringe at the silhouette, no brown band between amber and plum).
  3. Seam: min-cost vertical quilting path (nebula_true.quilt_seam) through the overlap, hard cut, so the
     wrap x=639 -> x=0 is exact. Raws authored with empty black side margins make this cut invisible.
  4. Optional rim thinning: the brightest/warm rim labels are trimmed to --rim px measured from their
     top-left edge, so lit lips read as thin 1-2 px lines like the postcard clouds.
  5. Mode-filter speck cleanup (wrap-aware), flat alpha per label (darkest steps a little lower).

    python art-src/space/scripts/nebula_v3.py <raw.png> <out.png> [options]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nebula_true import quilt_seam  # noqa: E402

W, H = 640, 360
SKY = 255


def palette_cut(pxs: np.ndarray, n: int) -> list[tuple[int, int, int]]:
    if len(pxs) == 0 or n <= 0:
        return []
    im = Image.fromarray(pxs.reshape(1, -1, 3).astype(np.uint8), mode="RGB")
    q = im.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    used = sorted(set(np.array(q).ravel().tolist()))
    flat = q.getpalette() or []
    return [tuple(flat[i * 3 : i * 3 + 3]) for i in used]


def nearest(px: np.ndarray, P: np.ndarray, chunk: int = 400_000) -> np.ndarray:
    out = np.empty(len(px), dtype=np.int32)
    for s in range(0, len(px), chunk):
        d = ((px[s : s + chunk, None, :].astype(np.float32) - P[None].astype(np.float32)) ** 2).sum(2)
        out[s : s + chunk] = d.argmin(1)
    return out


def wrap_mode(lab: np.ndarray, size: int) -> np.ndarray:
    pad = np.concatenate([lab[:, -8:], lab, lab[:, :8]], axis=1).astype(np.uint8)
    f = np.array(Image.fromarray(pad, mode="L").filter(ImageFilter.ModeFilter(size)))
    return f[:, 8 : 8 + lab.shape[1]]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("src", type=Path)
    p.add_argument("out", type=Path)
    p.add_argument("--blend", type=int, default=128, help="overlap columns for the seam (0 = raw already tiles)")
    p.add_argument("--median", type=int, default=5)
    p.add_argument("--soft", type=float, default=3.5, help="raw-px Gaussian on each label indicator")
    p.add_argument("--squash", type=float, default=0.9)
    p.add_argument("--yshift", type=int, default=0, help="extra crop offset (+ = crop more from the top)")
    p.add_argument("--floor", type=int, default=34, help="raw brightness (max channel) below which is sky")
    p.add_argument("--colors", type=int, default=14)
    p.add_argument("--warm", type=int, default=2)
    p.add_argument("--mode", type=int, default=3, help="mode filter size (0 = off)")
    p.add_argument("--rim", type=int, default=0, help="trim warm/brightest rim labels to this many px (0 = off)")
    p.add_argument("--rim-lum", type=float, default=175, help="non-warm labels brighter than this count as rims")
    p.add_argument("--alpha", type=int, default=127)
    p.add_argument("--shadow-alpha", type=int, default=112)
    p.add_argument("--shadow-lum", type=float, default=70)
    p.add_argument("--edge", type=int, default=0, help="rows at top/bottom forced empty")
    a = p.parse_args()

    raw = Image.open(a.src).convert("RGB")
    if a.median > 1:
        raw = raw.filter(ImageFilter.MedianFilter(a.median))
    R = np.array(raw)
    rh, rw = R.shape[:2]
    vis = R.max(axis=2) > a.floor
    vpx = R[vis]
    r, g, b = (vpx[:, i].astype(int) for i in range(3))
    warm_px = vpx[(r > b + 20) & (r > g + 4)]
    use_warm = len(warm_px) > 200 and a.warm > 0
    pal = palette_cut(vpx, a.colors - (a.warm if use_warm else 0))
    if use_warm:
        pal += palette_cut(warm_px, a.warm)
    P = np.array(pal, dtype=np.float64)
    labraw = np.full((rh, rw), len(P), dtype=np.int32)  # last index = sky
    labraw[vis] = nearest(vpx, P)
    nl = len(P) + 1

    # target geometry
    tw = W + a.blend
    scale = max(tw / rw, H / rh)
    nw, nh = round(rw * scale), max(H, round(rh * scale * a.squash))
    left, top = (nw - tw) // 2, (nh - H) // 2 + a.yshift
    best = np.full((H, tw), -1.0)
    lab = np.zeros((H, tw), dtype=np.int32)
    for i in range(nl):
        ind = Image.fromarray(((labraw == i) * 255).astype(np.uint8), mode="L")
        if a.soft > 0:
            ind = ind.filter(ImageFilter.GaussianBlur(a.soft))
        cov = np.array(ind.resize((nw, nh), Image.Resampling.BOX), dtype=np.float64)[top : top + H, left : left + tw]
        better = cov > best
        best[better] = cov[better]
        lab[better] = i

    # seam on the label colours
    colours = np.vstack([P, [[0, 0, 0]]]).astype(np.uint8)
    rgb = colours[lab]
    if a.blend > 0:
        path = quilt_seam(Image.fromarray(rgb, mode="RGB").load(), a.blend)
        final = lab[:, :W].copy()
        for y in range(H):
            s = path[y]
            final[y, :s] = lab[y, W : W + s]
    else:
        path = [0]
        final = lab[:, :W].copy()

    sky = nl - 1
    lum = P @ np.array([0.299, 0.587, 0.114])
    warm_lab = {i for i, c in enumerate(P) if c[0] > c[2] + 20 and c[0] > c[1] + 4}
    rim_lab = warm_lab | {i for i in range(len(P)) if lum[i] > a.rim_lum}

    if a.mode > 1:
        final = wrap_mode(final.astype(np.uint8), a.mode).astype(np.int32)

    if a.rim > 0 and rim_lab:
        is_rim = np.isin(final, list(rim_lab))
        keep = np.zeros_like(is_rim)
        # keep rim px within `rim` px of a non-rim px toward the light (up / left / up-left)
        for k in range(1, a.rim + 1):
            for dy, dx in ((k, 0), (0, k), (k, k)):
                sh = np.roll(is_rim, dx, axis=1)
                sh = np.roll(sh, dy, axis=0)
                if dy:
                    sh[:dy] = False
                keep |= is_rim & ~sh
        trim = is_rim & ~keep
        # replace trimmed px with the nearest non-rim label toward the shadow (down-right), else below
        rep = final.copy()
        for _ in range(12):
            src = np.roll(np.roll(rep, -1, axis=0), -1, axis=1)
            fill = trim & ~np.isin(rep, list(rim_lab))
            rep2 = np.where(trim & np.isin(rep, list(rim_lab)), src, rep)
            rep = rep2
            if not np.isin(rep[trim], list(rim_lab)).any():
                break
            _ = fill
        final = np.where(trim, rep, final)
        final[(final == sky) & trim] = final[(final == sky) & trim]

    if a.edge:
        final[: a.edge] = sky
        final[H - a.edge :] = sky

    res = np.zeros((H, W, 4), dtype=np.uint8)
    for i, c in enumerate(P):
        m = final == i
        res[m, :3] = c.astype(np.uint8)
        res[m, 3] = a.shadow_alpha if lum[i] < a.shadow_lum else a.alpha
    img = Image.fromarray(res, mode="RGBA")
    a.out.parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out, optimize=True)
    al = res[..., 3]
    print(f"wrote {a.out} labels={len(P)} colours={len(img.getcolors(1 << 16) or [])} "
          f"visible={(al > 0).mean():.2f} seam_cols={min(path)}..{max(path)} warm={sorted(warm_lab)}")


if __name__ == "__main__":
    main()
