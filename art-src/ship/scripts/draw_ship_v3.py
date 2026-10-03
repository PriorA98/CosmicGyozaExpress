"""Hero ship v3: the player's ORIGINAL design (assets/reference/gyoza-ship/default.png), refined.

The v2 rig (draw_ship.py) drifted into a flat crescent saucer with a small dome and a bun pilot.
v3 returns to the original drawing's silhouette and proportions:
- a tall, rounded glass dome, about two thirds of the hull width, with a dark cockpit console and
  two peaked shapes inside, a light inner rim on the upper left, and a crescent glint;
- a deep bowl-shaped gyoza hull with a crimped tan rim (tips slightly raised), a creamy dough body
  with pleat marks, and a pan-fried toast belly;
- splayed diagonal legs crossing in an X on each side, with little feet;
- a small nozzle stub under the belly.
It keeps the v2 frame contract: 64x80 art px, saucer centre (pivot) at art (32,34) in every frame,
hard alpha on the hull, legs and outline, displayed at integer 2x. The glass interior is a faint
translucent tint, so the sky shows through as it does in the original.

It reuses the v2 helpers (raster, outline, flame, puffs, stars) and replaces only the hull, dome,
legs and nozzle.
Usage:  python art-src/ship/scripts/draw_ship_v3.py [--out public/assets/ship] [--art art-src/ship/art]
"""
from __future__ import annotations

import argparse
import math
import sys
from dataclasses import replace
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import draw_ship as ds  # noqa: E402

W, H = ds.W, ds.H
Pose, Layer = ds.Pose, ds.Layer
hx = ds.hx

OUTLINE = hx("#3A2120")
RIM_INK = ds.BROWN_INK
CRUST = ds.CRUST  # 0 lightest .. 6 darkest
DOUGH = ds.DOUGH
TOAST = ds.TOAST
GLASS = ds.GLASS
PALE = [hx("#FFF6E2"), hx("#F6E4C0"), hx("#E6CB9C")]
CONSOLE = [hx("#6E7389"), hx("#4C5068"), hx("#353850"), hx("#24263A")]
WOOD = [hx("#C9935A"), hx("#A46A37"), hx("#7E4528"), hx("#5E3020")]

# ---------------------------------------------------------------- hull (bowl gyoza)
RX = 27.0  # rim half width (x 5..59)
RIM_C = -6.5  # rim height at the centre
RIM_RISE = 3.4  # tips rise above the centre
BELLY = 9.0  # hull bottom
CRIMPS = 9
CRIMP_H = 1.1
BAND = 3.4  # depth of the tan crimp band below the rim


def rim(u: float) -> float:
    return RIM_C - RIM_RISE * (u / RX) ** 2


def crimp(u: float) -> float:
    period = 2 * RX / CRIMPS
    phase = ((u + RX) % period) / period
    return CRIMP_H * math.sin(math.pi * phase) ** 0.7


def half_width(v: float) -> float:
    t = max(0.0, min(1.0, (v - RIM_C) / (BELLY - RIM_C)))
    hw = RX - 10.5 * t ** 1.35  # convex bowl sides
    if v > BELLY - 3.5:
        hw -= (v - (BELLY - 3.5)) ** 2 * 0.9  # rounded belly corners
    return hw


def in_hull(u: float, v: float) -> bool:
    if v > BELLY or abs(u) > half_width(v):
        return False
    top = rim(u) - crimp(u)
    edge = abs(u) - (RX - 3.5)
    if edge > 0:
        top += edge ** 2 * 0.45  # rounded crimped tips
    return v >= top


def draw_hull(pose: Pose) -> Layer:
    lay = Layer()
    m = ds.clean_mask(ds.raster(lambda x, y: in_hull(*ds.to_local(x, y, pose))))
    edge = ds.boundary(m)
    pleats = (-15.0, -7.5, 0.0, 7.5, 15.0)
    for (x, y) in m:
        u, v = ds.to_local(x + 0.5, y + 0.5, pose)
        depth = v - (rim(u) - crimp(u))
        if depth < BAND:
            # crimp band: each scallop lit on its left facet, shaded on its right
            period = 2 * RX / CRIMPS
            phase = ((u + RX) % period) / period
            k = 2 if phase < 0.45 else 4
            if depth < 1.0:
                k -= 1  # bright crust lip
            if u > RX * 0.55:
                k += 1
            lay.px[(x, y)] = CRUST[min(6, k + 1)]
            continue
        t = (v - RIM_C) / (BELLY - RIM_C)
        if v > BELLY - 2.6:
            # pan-fried toast belly, deeper toward the bottom-right
            k = 1 if u < -6 else (2 if u < 8 else 3)
            lay.px[(x, y)] = TOAST[k]
            continue
        # dough body lit from the top-left
        side = abs(u) / half_width(v)  # 0 centre .. 1 flank
        light = 0.9 - side * 1.5 - t * 0.6 - (0.25 if u > 0 else 0.0)
        k = 0 if light > 0.45 else 1 if light > 0.0 else 2 if light > -0.45 else 3
        lay.px[(x, y)] = (PALE + [CRUST[4]])[k]
    # pleat marks (short creases like the original's front marks)
    for pu in pleats:
        for v10 in range(int((RIM_C + BAND + 0.6) * 10), int((BELLY - 3.4) * 10), 6):
            v = v10 / 10
            bend = 0.10 * (v - RIM_C) * (1 if pu > 0 else -1 if pu < 0 else 0)
            sx, sy = ds.to_screen(pu + bend, v, pose)
            if (sx, sy) in m and (sx, sy) not in edge:
                lay.px[(sx, sy)] = ds.VALLEY
                if (sx - 1, sy) in m and (sx - 1, sy) not in edge:
                    lay.px[(sx - 1, sy)] = DOUGH[0]
    for (x, y) in edge:
        u, v = ds.to_local(x + 0.5, y + 0.5, pose)
        lay.px[(x, y)] = RIM_INK if v < rim(u) + 1.5 else OUTLINE
    return lay


# ---------------------------------------------------------------- dome (tall rounded glass)
DOME_HW = 17.5
DOME_BASE = -3.5  # hidden behind the crimp band
DOME_SHOULDER = -20.5
DOME_CAP = 8.5  # top arc height -> top at v = -29


def dome_local(u: float, v: float, pose: Pose) -> tuple[float, float]:
    """Undo the dome pop (lift + tilt about its base centre)."""
    v = v + pose.dome_lift
    a = math.radians(-pose.dome_rot)
    du, dv = u, v - DOME_BASE
    return du * math.cos(a) - dv * math.sin(a), du * math.sin(a) + dv * math.cos(a) + DOME_BASE


def in_dome(u: float, v: float) -> bool:
    if v > DOME_BASE:
        return False
    if v >= DOME_SHOULDER:
        return abs(u) <= DOME_HW
    return (u / DOME_HW) ** 2 + ((v - DOME_SHOULDER) / DOME_CAP) ** 2 <= 1.0


def draw_dome(pose: Pose) -> Layer:
    lay = Layer()

    def local(x: float, y: float) -> tuple[float, float]:
        return dome_local(*ds.to_local(x, y, pose), pose)

    m = ds.clean_mask(ds.raster(lambda x, y: in_dome(*local(x, y))))
    outer = ds.boundary(m)
    inner = ds.boundary(m - outer)
    for (x, y) in m:
        u, v = local(x + 0.5, y + 0.5)
        # console: a dark cockpit deck along the base with two peaked shapes (as in the original)
        left_peak = v >= -7.0 - 7.5 * max(0.0, 1 - abs(u + 7.5) / 4.6)
        right_peak = v >= -7.0 - 11.5 * max(0.0, 1 - abs(u - 6.0) / 7.0)
        if v >= -7.0 or left_peak or right_peak:
            lit = (left_peak and v < -7.0 and u < -7.0) or (right_peak and v < -7.0 and u < 6.0)
            k = 0 if lit else (2 if v > -5.0 else 1)
            lay.px[(x, y)] = CONSOLE[k]
        else:
            g = GLASS[2]
            lay.px[(x, y)] = (g[0], g[1], g[2], 18)  # nearly clear glass; the sky shows through
    for (x, y) in inner:
        u, v = local(x + 0.5, y + 0.5)
        if lay.px[(x, y)][3] == 255:
            continue  # keep the console colours where they meet the rim
        lay.px[(x, y)] = GLASS[1] if (u < 2 or v < DOME_SHOULDER - 2) else GLASS[3]
    for p in outer:
        lay.px[p] = ds.INK
    # crescent glint on the upper left and a tiny sparkle on the upper right
    for i in range(10):
        v = -26.0 + i * 1.05
        u = -DOME_HW + 4.2 + 0.055 * (v + 21.5) ** 2
        for du in (0.0, 0.9):
            sx, sy = ds.to_screen(*_dome_to_ship(u + du, v, pose), pose)
            if (sx, sy) in m and (sx, sy) not in outer:
                lay.px[(sx, sy)] = GLASS[0]
    for (u, v) in ((10.5, -24.0), (11.5, -23.0)):
        sx, sy = ds.to_screen(*_dome_to_ship(u, v, pose), pose)
        if (sx, sy) in m and (sx, sy) not in outer:
            lay.px[(sx, sy)] = GLASS[0]
    return lay


def _dome_to_ship(u: float, v: float, pose: Pose) -> tuple[float, float]:
    a = math.radians(pose.dome_rot)
    du, dv = u, v - DOME_BASE
    return du * math.cos(a) - dv * math.sin(a), du * math.sin(a) + dv * math.cos(a) + DOME_BASE - pose.dome_lift


# ---------------------------------------------------------------- legs (splayed X struts)
def leg_segments(pose: Pose) -> list[tuple[float, float, float, float, bool]]:
    s_out = 1.0 + pose.leg_splay * 0.35
    segs = []
    for s in (-1.0, 1.0):
        segs.append((s * 13.0, 6.5, s * 21.5 * s_out, 17.5, True))  # main leg: under the belly, out to the foot
        segs.append((s * 20.0, 3.0, s * 14.5 * s_out, 15.5, False))  # brace: from the hull flank, crossing inward
    return segs


def draw_legs(pose: Pose) -> Layer:
    lay = Layer()
    segs = leg_segments(pose)
    feet = [(ax2, by2) for (_, _, ax2, by2, main) in segs if main]

    def inside(x: float, y: float) -> bool:
        u, v = ds.to_local(x, y, pose)
        for (ax, ay, bx, by, main) in segs:
            d, t = ds.seg_dist(u, v, ax, ay, bx, by)
            if d <= (1.9 if main else 1.5) and 0.0 <= t <= 1.0:
                return True
        for (fx, fy) in feet:
            if abs(u - fx) <= 2.6 and fy - 1.0 <= v <= fy + 1.2:
                return True
        return False

    m = ds.clean_mask(ds.raster(inside))
    edge = ds.boundary(m)
    for (x, y) in m:
        u, _ = ds.to_local(x + 0.5, y + 0.5, pose)
        lay.px[(x, y)] = WOOD[0] if (x + y) % 3 == 0 and u < 0 else WOOD[1] if u < 0 else WOOD[2]
    for p in edge:
        lay.px[p] = OUTLINE
    return lay


# ---------------------------------------------------------------- nozzle stub (reuses the v2 flame)
NOZZLE_TOP, NOZZLE_BOT = 8.2, 12.4


def nozzle_half_width(v: float) -> float:
    if v < 9.6:
        return 3.6
    if v < 10.4:
        return 2.2
    return 2.6 + 1.2 * (v - 10.4) / (NOZZLE_BOT - 10.4)


ds.NOZZLE_TOP, ds.NOZZLE_BOT = NOZZLE_TOP, NOZZLE_BOT
ds.nozzle_half_width = nozzle_half_width


def render_ship(pose: Pose) -> Image.Image:
    return ds.compose([ds.draw_flame(pose), draw_legs(pose), draw_dome(pose), draw_hull(pose), ds.draw_nozzle(pose)])


def frames() -> dict[str, Image.Image]:
    base = Pose()
    out: dict[str, Image.Image] = {}
    out["gyoza-idle"] = render_ship(base)
    out["gyoza-fly-01"] = render_ship(replace(base, flame=1, flicker=0, nozzle_glow=True))
    out["gyoza-fly-02"] = render_ship(replace(base, flame=2, flicker=1, nozzle_glow=True))
    out["gyoza-fly-03"] = render_ship(replace(base, flame=3, flicker=2, nozzle_glow=True))

    # incident 1: squash on impact, legs splayed
    out["gyoza-incident-01"] = render_ship(replace(base, sx=1.08, sy=0.84, leg_splay=1.4))

    # incident 2: dizzy wobble with stars and two crumbs knocked off the rim
    img = render_ship(replace(base, rot=-9.0))
    crumbs = ds.blob_layer([(9.0, 22.0, 2.2), (55.0, 19.0, 1.8)], ramp=[CRUST[2], CRUST[3], CRUST[4], CRUST[5], CRUST[6]], outline=OUTLINE)
    img.alpha_composite(ds.compose([crumbs, ds.star_layer([(14, 4, 2), (33, 1, 1), (50, 4, 2)])]))
    out["gyoza-incident-02"] = img

    # incident 3: the dome pops up and steam escapes from the rim
    steam = ds.blob_layer([(11.0, 22.5, 4.8), (15.0, 15.5, 5.0), (53.0, 21.5, 4.8), (49.0, 14.5, 5.2)])
    ship = render_ship(replace(base, dome_lift=6.0, dome_rot=8.0, rot=2.0))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.alpha_composite(ds.compose([steam]))
    img.alpha_composite(ship)
    out["gyoza-incident-03"] = img

    # incident 4: puff cloud with crust crumbs (the original's beige blast), feet peeking out
    legs = ds.compose([draw_legs(replace(base, leg_splay=1.2))])
    cloud = ds.blob_layer(
        [(12.0, 34.0, 6.5), (52.0, 33.0, 6.5), (21.0, 23.0, 8.5), (43.0, 22.0, 9.0), (32.0, 17.0, 9.0),
         (18.0, 38.0, 8.5), (46.0, 38.0, 8.5), (32.0, 31.0, 12.5), (32.0, 42.0, 7.5)],
    )
    chunks = ds.blob_layer([(24.0, 27.0, 1.9), (40.0, 25.0, 2.1), (31.0, 37.0, 1.8), (4.0, 44.0, 1.7)], ramp=[CRUST[3], CRUST[4], CRUST[5], CRUST[6], CRUST[6]], outline=OUTLINE)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.alpha_composite(legs)
    img.alpha_composite(ds.compose([cloud, chunks, ds.star_layer([(6, 22, 1), (58, 21, 2), (31, 4, 1)])]))
    out["gyoza-incident-04"] = img

    # incident 5: the puff breaks into soft drifting lobes
    puffs = ds.blob_layer(
        [(13.0, 27.0, 5.8), (18.5, 23.5, 6.2), (44.0, 22.0, 5.4), (50.0, 19.0, 6.4), (21.0, 44.0, 4.2), (26.0, 42.5, 4.8), (46.0, 42.0, 4.6)],
        outline=ds.PUFF[3], alpha=230, edge_alpha=140,
    )
    out["gyoza-incident-05"] = ds.compose([puffs, ds.star_layer([(32, 14, 1), (8, 37, 1), (57, 32, 1), (34, 33, 1)])])
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="public/assets/ship")
    ap.add_argument("--art", default="art-src/ship/art")
    args = ap.parse_args()
    out_dir, art_dir = Path(args.out), Path(args.art)
    out_dir.mkdir(parents=True, exist_ok=True)
    art_dir.mkdir(parents=True, exist_ok=True)
    for name, img in frames().items():
        assert img.size == (W, H)
        img.save(out_dir / f"{name}.png", optimize=True)
        img.save(art_dir / f"{name}.png", optimize=True)
        print(name, img.getbbox(), len(img.getcolors(4096) or []), "colours")


if __name__ == "__main__":
    main()
