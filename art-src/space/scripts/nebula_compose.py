"""Compose the round-3 nebula layer from stand-alone stepped-cumulus clusters. Dev tooling only.

The Codex raws nebula-v5/v6 contain separate rounded cumulus clusters (plum with amber rims, dusk-blue,
teal) on black, each with 3-4 flat value steps lit from the top-left. This script:

  1. Quantizes every raw at RAW resolution to ONE shared palette (median cut over all cloud pixels plus
     reserved warm slots for the amber rims), so all clusters share the same flat value steps.
  2. Cuts each cluster out (connected components per hue family on a 1/4-res mask).
  3. Renders each cluster at the target scale with a label-aware downscale: each label's indicator is
     Gaussian-softened (rounds the raw's ~8 px stair grid) and box-resized, and each output pixel takes
     the label with the largest coverage. Contours become smooth curves with hard 1 px steps and no pixel
     is ever a blend of two colours.
  4. Composes a 640x360 tile in painter's order with horizontal WRAP (x mod 640), so the layer tiles
     exactly with no seam cut at all. A dim back row (the same clusters remapped to the darkest steps,
     lower flat alpha) fills between the front clusters so each band reads as a continuous bank.
  5. Optional rim thinning: amber rim labels are trimmed to N px from their top-left edge.

    python art-src/space/scripts/nebula_compose.py <out.png> [--layout default]
"""

from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

W, H = 640, 360
ROOT = Path(__file__).resolve().parents[1]
FLOOR = 34


def palette_cut(pxs: np.ndarray, n: int) -> list[tuple[int, int, int]]:
    im = Image.fromarray(pxs.reshape(1, -1, 3).astype(np.uint8), mode="RGB")
    q = im.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    used = sorted(set(np.array(q).ravel().tolist()))
    flat = q.getpalette() or []
    return [tuple(flat[i * 3 : i * 3 + 3]) for i in used]


def nearest(px: np.ndarray, P: np.ndarray, chunk: int = 300_000) -> np.ndarray:
    out = np.empty(len(px), dtype=np.int32)
    for s in range(0, len(px), chunk):
        d = ((px[s : s + chunk, None, :].astype(np.float32) - P[None].astype(np.float32)) ** 2).sum(2)
        out[s : s + chunk] = d.argmin(1)
    return out


def family_of(c: np.ndarray) -> str:
    import colorsys
    r, g, b = (float(v) / 255 for v in c)
    h, _, _ = colorsys.rgb_to_hsv(r, g, b)
    if h < 0.16 or h > 0.9:
        return "warm"
    if h > 0.66:
        return "plum"
    if h > 0.545:
        return "dusk"
    return "teal"


@dataclass
class Cluster:
    name: str
    family: str
    labels: np.ndarray  # raw-res label crop (-1 = empty)
    box: tuple[int, int, int, int]


def components(mask: np.ndarray, min_px: int) -> list[tuple[int, int, int, int]]:
    """Bounding boxes of 8-connected components (BFS) of a small boolean mask."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    boxes = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            y0 = y1 = y
            x0 = x1 = x
            n = 0
            while q:
                cy, cx = q.popleft()
                n += 1
                y0, y1, x0, x1 = min(y0, cy), max(y1, cy), min(x0, cx), max(x1, cx)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
            if n >= min_px:
                boxes.append((x0, y0, x1 + 1, y1 + 1))
    return boxes


def load_clusters(raws: list[Path], colors: int, warm: int, median: int) -> tuple[np.ndarray, list[Cluster]]:
    imgs = []
    for p in raws:
        im = Image.open(p).convert("RGB")
        if median > 1:
            im = im.filter(ImageFilter.MedianFilter(median))
        imgs.append(np.array(im))
    allpx = np.concatenate([a[a.max(2) > FLOOR] for a in imgs])
    sample = allpx[:: max(1, len(allpx) // 400_000)]
    # per-pixel hue family, then a fixed number of flat value steps per family
    import colorsys  # noqa: F401
    f = sample.astype(np.float64) / 255
    mx, mn = f.max(1), f.min(1)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = f[:, 0], f[:, 1], f[:, 2]
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    fam = np.where((hue < 0.16) | (hue > 0.9), "warm", np.where(hue > 0.66, "plum", np.where(hue > 0.545, "dusk", "teal")))
    pal: list[tuple[int, int, int]] = []
    for name, n in (("plum", colors), ("dusk", colors), ("teal", colors), ("warm", warm)):
        px = sample[fam == name]
        if len(px) > 100:
            pal += palette_cut(px, n)
    P = np.array(pal, dtype=np.float64)
    fams = [family_of(c) for c in P]
    clusters: list[Cluster] = []
    for p, a in zip(raws, imgs):
        vis = a.max(2) > FLOOR
        lab = np.full(vis.shape, -1, dtype=np.int32)
        lab[vis] = nearest(a[vis], P)
        q = 4
        small_img = Image.fromarray((vis * 255).astype(np.uint8)).resize((a.shape[1] // q, a.shape[0] // q),
                                                                        Image.Resampling.BOX)
        small = np.array(small_img) > 100
        # erode so clusters that only kiss are separated, label, then grow each component back
        er = np.array(Image.fromarray((small * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 0
        for (x0, y0, x1, y1) in components(er, 300):
            comp = np.zeros_like(er)
            comp[y0:y1, x0:x1] = er[y0:y1, x0:x1]
            # keep only the component that seeded this box (boxes can overlap other components)
            grown = np.array(Image.fromarray((comp * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
            grown &= small
            big = np.array(Image.fromarray((grown * 255).astype(np.uint8)).resize((a.shape[1], a.shape[0]),
                                                                                Image.Resampling.NEAREST)) > 0
            big = np.array(Image.fromarray((big * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
            ys, xs = np.nonzero(big & vis)
            if len(ys) == 0:
                continue
            Y0, Y1, X0, X1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            crop = np.where(big[Y0:Y1, X0:X1], lab[Y0:Y1, X0:X1], -1)
            ids, cnt = np.unique(crop[crop >= 0], return_counts=True)
            fam = family_of(P[ids[cnt.argmax()]])
            clusters.append(Cluster(f"{p.stem}@{X0},{Y0}", fam, crop, (int(X0), int(Y0), int(X1), int(Y1))))
    return P, clusters


def render_cluster(c: Cluster, nl: int, scale: float, soft: float) -> np.ndarray:
    """Label map (-1 empty) of the cluster at `scale`, via max-coverage label downscale."""
    h, w = c.labels.shape
    pad = int(soft * 3) + 2
    lab = np.pad(c.labels, pad, constant_values=-1)
    h, w = lab.shape
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    best = np.full((nh, nw), -1.0)
    out = np.full((nh, nw), -1, dtype=np.int32)
    present = sorted(set(np.unique(lab).tolist()))
    for i in present:
        ind = Image.fromarray(((lab == i) * 255).astype(np.uint8), mode="L")
        if soft > 0:
            ind = ind.filter(ImageFilter.GaussianBlur(soft))
        cov = np.array(ind.resize((nw, nh), Image.Resampling.BOX), dtype=np.float64)
        better = cov > best
        best[better] = cov[better]
        out[better] = i
    # trim fully empty borders
    ys, xs = np.nonzero(out >= 0)
    return out[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def mode_clean(lab: np.ndarray, size: int) -> np.ndarray:
    """Wrap-aware mode filter on a label map where -1 is empty (shifted to 255)."""
    m = np.where(lab < 0, 255, lab).astype(np.uint8)
    pad = np.concatenate([m[:, -8:], m, m[:, :8]], axis=1)
    f = np.array(Image.fromarray(pad, mode="L").filter(ImageFilter.ModeFilter(size)))[:, 8:-8].astype(np.int32)
    f[f == 255] = -1
    return f


def thin_rims(lab: np.ndarray, rim_ids: set[int], keep_px: int) -> np.ndarray:
    is_rim = np.isin(lab, list(rim_ids))
    keep = np.zeros_like(is_rim)
    for k in range(1, keep_px + 1):
        for dy, dx in ((k, 0), (0, k), (k, k)):
            sh = np.roll(np.roll(is_rim, dx, axis=1), dy, axis=0)
            sh[:dy] = False if dy else sh[:dy]
            keep |= is_rim & ~sh
    trim = is_rim & ~keep
    rep = lab.copy()
    for _ in range(16):
        nb = np.roll(np.roll(rep, -1, axis=0), -1, axis=1)
        still = trim & np.isin(rep, list(rim_ids))
        if not still.any():
            break
        rep = np.where(still, nb, rep)
    return np.where(trim, rep, lab)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("out", type=Path)
    ap.add_argument("--raws", nargs="+", default=["raw/nebula-v5.png", "raw/nebula-v6.png"])
    ap.add_argument("--colors", type=int, default=4, help="flat value steps per hue family")
    ap.add_argument("--warm", type=int, default=2)
    ap.add_argument("--median", type=int, default=5)
    ap.add_argument("--soft", type=float, default=4.0)
    ap.add_argument("--rim", type=int, default=2)
    ap.add_argument("--mode", type=int, default=3)
    ap.add_argument("--alpha", type=int, default=127)
    ap.add_argument("--shadow-alpha", type=int, default=116)
    ap.add_argument("--back-alpha", type=int, default=84)
    ap.add_argument("--merge-mid-warm", action="store_true")
    ap.add_argument("--edge-rim", action="store_true")
    ap.add_argument("--list", action="store_true", help="print the clusters found and exit")
    ap.add_argument("--layout", type=Path, default=None, help="python file defining LAYOUT")
    a = ap.parse_args()

    raws = [ROOT / r if not Path(r).is_absolute() else Path(r) for r in a.raws]
    P, clusters = load_clusters(raws, a.colors, a.warm, a.median)
    lum = P @ np.array([0.299, 0.587, 0.114])
    if a.list:
        for i, c in enumerate(clusters):
            print(i, c.name, c.labels.shape)
        for i, c in enumerate(P):
            print("label", i, tuple(int(v) for v in c), family_of(c), round(lum[i]))
        return

    ns: dict = {}
    exec((a.layout or Path(__file__).with_name("nebula_layout.py")).read_text(encoding="utf8"), ns)
    layout = ns["LAYOUT"]  # list of (cluster_index, x, y_bottom, scale, "front"|"back")

    nl = len(P)
    fam_ids = {f: sorted((i for i in range(nl) if family_of(P[i]) == f), key=lambda i: lum[i]) for f in ("plum", "dusk", "teal")}
    warm_ids = {i for i in range(nl) if family_of(P[i]) == "warm"}

    canvas = np.full((H, W), -1, dtype=np.int32)
    is_back = np.zeros((H, W), dtype=bool)
    order = np.full((H, W), -1, dtype=np.int32)
    owner_fam = np.full((H, W), "", dtype=object)
    if a.merge_mid_warm:
        # the less saturated warm label is only the raw's anti-aliasing between amber and plum: drop it
        warm = [i for i in range(len(P)) if family_of(P[i]) == "warm"]
        if len(warm) > 1:
            mid = min(warm, key=lambda i: lum[i])
            plum = fam_ids["plum"]
            tgt = min(plum, key=lambda i: ((P[i] - P[mid]) ** 2).sum())
            remap = np.arange(len(P))
            remap[mid] = tgt
            for c in clusters:
                c.labels = np.where(c.labels >= 0, remap[np.clip(c.labels, 0, None)], -1)
    for n_draw, (idx, x, ybot, scale, layer) in enumerate(layout):
        c = clusters[idx]
        lab = render_cluster(c, nl, scale, a.soft)
        if layer == "back":
            # remap to the two darkest steps of the family (lit face -> 2nd darkest, rest -> darkest)
            ids = fam_ids[c.family]
            dark, dark2 = ids[0], ids[min(1, len(ids) - 1)]
            med = np.median(lum[ids])
            m = lab >= 0
            lab = np.where(m, np.where(lum[np.clip(lab, 0, nl - 1)] > med, dark2, dark), -1)
        h, w = lab.shape
        y0 = ybot - h
        for yy in range(h):
            Y = y0 + yy
            if not 0 <= Y < H:
                continue
            row = lab[yy]
            xs = np.nonzero(row >= 0)[0]
            X = (x + xs) % W
            canvas[Y, X] = row[xs]
            is_back[Y, X] = layer == "back"
            order[Y, X] = n_draw
            owner_fam[Y, X] = c.family

    if a.mode > 1:
        cleaned = mode_clean(canvas, a.mode)
        canvas = np.where(canvas >= 0, np.where(cleaned >= 0, cleaned, canvas), -1)
    if a.edge_rim:
        # 1 px lit lip on top-left facing silhouette edges of FRONT clusters (against sky or anything behind)
        up = np.full_like(order, -1); up[1:] = order[:-1]
        left = np.roll(order, 1, axis=1)
        lit = (order >= 0) & ~is_back & ((up < order) | (left < order)) & (canvas >= 0)
        lit &= ~np.isin(canvas, list(warm_ids))
        for fam in ("plum", "dusk", "teal"):
            ids = fam_ids[fam]
            if not ids:
                continue
            m = lit & (owner_fam == fam)
            # only where the lip sits on the lit half (not on shadow undersides): label at/above median
            med = np.median(lum[ids])
            m &= lum[np.clip(canvas, 0, nl - 1)] >= med - 1
            canvas[m] = ids[-1]
    if a.rim > 0 and warm_ids:
        canvas = thin_rims(canvas, warm_ids, a.rim)

    res = np.zeros((H, W, 4), dtype=np.uint8)
    for i in range(nl):
        m = canvas == i
        res[m, :3] = P[i].astype(np.uint8)
        res[m, 3] = a.shadow_alpha if lum[i] < 70 else a.alpha
    res[is_back & (canvas >= 0), 3] = a.back_alpha
    img = Image.fromarray(res, mode="RGBA")
    a.out.parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out, optimize=True)
    al = res[..., 3]
    print(f"wrote {a.out} labels={nl} colours={len(img.getcolors(1 << 16) or [])} visible={(al > 0).mean():.2f}")


if __name__ == "__main__":
    main()
