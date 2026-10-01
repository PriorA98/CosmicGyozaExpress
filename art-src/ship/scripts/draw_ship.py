"""Hand-authored true-resolution pixel art for the Cosmic Gyoza Express hero ship.

Every frame is rasterised directly at art resolution (64x80, displayed at 2x) from a small
set of parametric parts (hull, crimped pleats, glass dome, pilot, legs, nozzle, flame), then
outlined and cleaned pixel by pixel. Because all frames come from one rig, the saucer centre is
exactly at art (32,34) in every frame and swapping frames never shifts the ship.

Usage:  python art-src/ship/scripts/draw_ship.py [--out public/assets/ship] [--art art-src/ship/art]
Dev tooling only (Python 3.10+, Pillow).
"""
from __future__ import annotations

import argparse
import math
from dataclasses import dataclass, field, replace
from pathlib import Path

from PIL import Image

W, H = 64, 80
CX, CY = 32.0, 34.0  # saucer centre (contract: SHIP_ART.saucerCenterX/Y)


def hx(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)


# ---------------------------------------------------------------- palette (32 colours max)
INK = hx("#1D1F33")
INK_SOFT = hx("#2F3149")
BROWN_INK = hx("#4A2A22")

CRUST = [hx("#FFF6DE"), hx("#F8E2AE"), hx("#EFCA86"), hx("#DFAC63"), hx("#C68C4A"), hx("#A46A37"), hx("#774629")]
TOAST = [hx("#E7A85C"), hx("#CF8A44"), hx("#B06A34"), hx("#8A4D28"), hx("#5E3020")]
DOUGH = [hx("#FFF8E8"), hx("#F8E8C6"), hx("#EFD4A4"), hx("#DDB97F"), hx("#C29A62"), hx("#8E6A45")]
GLASS = [hx("#F1F5F2"), hx("#BFD2D8"), hx("#9EB6C4"), hx("#7491A6"), hx("#556C8A"), hx("#3E4C6C")]
PILOT = [hx("#FBF7EC"), hx("#EEDDBF"), hx("#D3B98F")]
BLUSH = hx("#E59A84")
SCARF = [hx("#E07A5F"), hx("#C26954"), hx("#8F4536")]
METAL = [hx("#E4E6EA"), hx("#B4B8C6"), hx("#858AA0"), hx("#5C5F78")]
FLAME = [hx("#FBF7EC"), hx("#F7D77E"), hx("#F0AE55"), hx("#E08A4B"), hx("#C26954")]
STEAM = [hx("#FBF7EC"), hx("#ECDFC5"), hx("#C9BFCF"), hx("#9B8FB8"), hx("#6F6690")]
STAR = [hx("#FBF7EC"), hx("#F2CD72"), hx("#D4A055"), hx("#A6614A")]

CLEAR = (0, 0, 0, 0)


@dataclass(frozen=True)
class Pose:
    sx: float = 1.0  # horizontal scale of the ship rig
    sy: float = 1.0  # vertical scale
    rot: float = 0.0  # degrees, positive = clockwise on screen
    dx: float = 0.0
    dy: float = 0.0
    dome_lift: float = 0.0  # art px the dome pops up
    dome_rot: float = 0.0
    face: str = "happy"  # happy | squint | dizzy | shock
    flame: int = 0  # 0 none, 1 short, 2 medium, 3 long
    flicker: int = 0
    leg_splay: float = 0.0
    nozzle_glow: bool = False


# ---------------------------------------------------------------- geometry helpers
def to_local(px: float, py: float, pose: Pose, pivot_v: float = 0.0) -> tuple[float, float]:
    """Screen art coords -> ship local (u right, v down, origin = saucer centre)."""
    x = px - CX - pose.dx
    y = py - CY - pose.dy
    a = math.radians(-pose.rot)
    ca, sa = math.cos(a), math.sin(a)
    yr = y - pivot_v
    u = x * ca - yr * sa
    v = x * sa + yr * ca + pivot_v
    return u / pose.sx, v / pose.sy


HULL_RX = 26.0
SEAM_H = 6.2  # hump height of the pleated seam above the rim line
BOT_H = 10.0
CRIMPS = 7
CRIMP_SPAN = HULL_RX - 3.5
CRIMP_H = 2.8
DOME_C = (0.0, -11.2)
DOME_R = 11.4
FOLD_US = tuple(-CRIMP_SPAN + j * (2 * CRIMP_SPAN / CRIMPS) for j in range(1, CRIMPS))  # crease roots = crimp valleys


def seam(u: float) -> float:
    """Upper edge: a soft hump (the dumpling's pleated seam) with small crimp scallops."""
    k = max(0.0, 1.0 - (u / HULL_RX) ** 2)
    base = -1.0 - SEAM_H * k ** 0.8
    if abs(u) < CRIMP_SPAN:
        p = ((u + CRIMP_SPAN) / (2 * CRIMP_SPAN / CRIMPS)) % 1.0
        base -= CRIMP_H * math.sin(math.pi * p) ** 0.7 * min(1.0, 1.6 * k)
    return base


def bottom(u: float) -> float:
    """Flat, pan-fried base that rounds up into the ends."""
    k = abs(u) / HULL_RX
    return BOT_H - 6.5 * k ** 3.2


def hull_top(u: float) -> float:
    return seam(u)


def in_hull(u: float, v: float) -> bool:
    if abs(u) >= HULL_RX:
        return False
    if not (seam(u) <= v <= bottom(u)):
        return False
    # round the two ends of the lens
    ex = abs(u) - (HULL_RX - 4.5)
    if ex > 0:
        vm = (seam(HULL_RX - 4.5) + bottom(HULL_RX - 4.5)) / 2 + 0.6
        hh = (bottom(HULL_RX - 4.5) - seam(HULL_RX - 4.5)) / 2
        return (ex / 4.5) ** 2 + ((v - vm) / hh) ** 2 <= 1.0
    return True


def in_dome(u: float, v: float, lift: float, rot: float) -> bool:
    du, dv = u - DOME_C[0], v - (DOME_C[1] - lift)
    if rot:
        a = math.radians(-rot)
        du, dv = du * math.cos(a) - dv * math.sin(a), du * math.sin(a) + dv * math.cos(a)
    if dv > 2.0:
        return False
    return du * du + dv * dv <= DOME_R * DOME_R


def fold_curve(uk: float, t: float) -> tuple[float, float]:
    """Point on the pleat crease rooted at seam position uk, t in [0,1] from seam downward."""
    side = 1.0 if uk > 0 else -1.0
    reach = 1.6 + 0.10 * abs(uk)
    length = 4.6 + 1.4 * (1 - abs(uk) / HULL_RX)
    u = uk + side * reach * t * t
    v = seam(uk) + 0.5 + length * t
    return u, v


def seg_dist(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> tuple[float, float]:
    vx, vy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
    qx, qy = ax + vx * t, ay + vy * t
    return math.hypot(px - qx, py - qy), t


# ---------------------------------------------------------------- layer rasteriser
class Layer:
    def __init__(self) -> None:
        self.px: dict[tuple[int, int], tuple[int, int, int, int]] = {}

    def mask(self) -> set[tuple[int, int]]:
        return set(self.px)


def raster(fn) -> set[tuple[int, int]]:
    out = set()
    for y in range(H):
        for x in range(W):
            if fn(x + 0.5, y + 0.5):
                out.add((x, y))
    return out


def boundary(mask: set[tuple[int, int]]) -> set[tuple[int, int]]:
    b = set()
    for (x, y) in mask:
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) not in mask:
                b.add((x, y))
                break
    return b


def clean_mask(mask: set[tuple[int, int]]) -> set[tuple[int, int]]:
    """Drop pixels with <=1 four-neighbour (spikes, singletons) and fill 1px notches."""
    m = set(mask)
    for _ in range(2):
        drop = []
        for (x, y) in m:
            n = sum((p in m) for p in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
            if n <= 1:
                drop.append((x, y))
        for p in drop:
            m.discard(p)
        add = []
        for y in range(H):
            for x in range(W):
                if (x, y) in m:
                    continue
                n = sum((p in m) for p in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
                if n >= 3:
                    add.append((x, y))
        m.update(add)
    return m


# ---------------------------------------------------------------- parts
def to_screen(u: float, v: float, pose: Pose) -> tuple[int, int]:
    a = math.radians(pose.rot)
    x = CX + pose.dx + (u * pose.sx) * math.cos(a) - (v * pose.sy) * math.sin(a)
    y = CY + pose.dy + (u * pose.sx) * math.sin(a) + (v * pose.sy) * math.cos(a)
    return int(math.floor(x)), int(math.floor(y))


def draw_hull(pose: Pose) -> Layer:
    lay = Layer()
    mask = clean_mask(raster(lambda x, y: in_hull(*to_local(x, y, pose))))
    edge = boundary(mask)
    period = 2 * CRIMP_SPAN / CRIMPS
    for (x, y) in mask:
        u, v = to_local(x + 0.5, y + 0.5, pose)
        top, bot = seam(u), bottom(u)
        env_top = -1.0 - SEAM_H * max(0.0, 1.0 - (u / HULL_RX) ** 2) ** 0.8
        vn = (v - env_top) / max(1.0, bot - env_top)
        fry = 0.52 + 0.06 * math.sin(u * 0.55 + 0.4)
        rel = u / HULL_RX
        if vn >= fry:
            # pan-fried golden-brown base
            band = (vn - fry) / max(0.05, 1 - fry)
            if band < 0.16:
                col = TOAST[0] if rel < 0.25 else TOAST[1]
            else:
                k = 1 + (1 if rel > -0.25 else 0) + (1 if band > 0.78 else 0) + (1 if rel > 0.55 and band > 0.5 else 0)
                col = TOAST[min(4, k)]
            h = (int(math.floor(u)) * 7 + int(math.floor(v)) * 11) % 29
            if h == 2 and abs(u) < 18 and 0.35 < band < 0.75:
                col = TOAST[min(4, TOAST.index(col) + 1)]
        else:
            # pale steamed dough with a frilled, pleated crest
            k = 1 if rel < -0.3 else (2 if rel < 0.4 else 3)
            if vn > fry - 0.09:
                k = min(4, k + 1)  # soft shadow where the dough meets the crisp base
            col = DOUGH[k]
            depth = v - top
            if abs(u) < CRIMP_SPAN:
                ph = (u + CRIMP_SPAN) / period
                j = math.floor(ph)
                p = ph - j
                if depth < 2.2:
                    if p < 0.5:
                        col = DOUGH[0] if (rel < 0.25 and depth < 1.2) else DOUGH[1]
                    elif p > 0.82:
                        col = DOUGH[3]
                    else:
                        col = DOUGH[2] if rel < 0.4 else DOUGH[3]
            # creases from each crimp valley, curving outward as they run down the side
            for uk in FOLD_US:
                tk = v - seam(uk)
                length = 4.2 + 1.6 * (1 - abs(uk) / HULL_RX)
                if tk < 0 or tk > length:
                    continue
                side = 1.0 if uk > 0 else -1.0
                cu = uk + side * (0.06 + 0.012 * abs(uk)) * tk * tk
                d = u - cu
                if -0.5 <= d < 0.5:
                    col = DOUGH[5] if tk < length - 1.5 else DOUGH[4]
                elif 0.5 <= d < 1.5 and tk < length - 1.0:
                    col = DOUGH[min(4, max(3, DOUGH.index(col)))]
        lay.px[(x, y)] = col
    for (x, y) in edge:
        u, v = to_local(x + 0.5, y + 0.5, pose)
        lay.px[(x, y)] = hx("#6B4A30") if v < -1.0 else hx("#3A2120")
    return lay


def draw_collar(pose: Pose) -> Layer:
    """Slate collar the dome sits in, peeking above the pleats."""
    lay = Layer()
    lift = pose.dome_lift

    def inside(x: float, y: float) -> bool:
        u, v = to_local(x, y, pose)
        return (u / 13.0) ** 2 + ((v - (seam(0.0) + 0.2)) / 1.7) ** 2 <= 1.0

    m = clean_mask(raster(inside))
    e = boundary(m)
    for (x, y) in m:
        u, v = to_local(x + 0.5, y + 0.5, pose)
        lay.px[(x, y)] = METAL[1] if u < -3 else METAL[2]
        if v < seam(0.0) - 0.3 and u < 2:
            lay.px[(x, y)] = METAL[0]
    for p in e:
        lay.px[p] = INK
    return lay


def draw_dome(pose: Pose) -> Layer:
    lay = Layer()
    lift, rot = pose.dome_lift, pose.dome_rot
    mask = clean_mask(raster(lambda x, y: in_dome(*to_local(x, y, pose), lift, rot)))
    edge = boundary(mask)
    for (x, y) in mask:
        u, v = to_local(x + 0.5, y + 0.5, pose)
        du, dv = u - DOME_C[0], v - (DOME_C[1] - lift)
        r = math.hypot(du, dv) / DOME_R
        ang = math.degrees(math.atan2(dv, du))  # -90 = top
        s = 2.4 + 1.6 * (du / DOME_R) + 1.5 * (dv / DOME_R) + 0.6 * r
        col = GLASS[int(round(max(1, min(5, s))))]
        # crisp highlight arc on the top-left inner rim
        if 0.66 <= r <= 0.82 and -165 <= ang <= -112:
            col = GLASS[0]
        if 0.42 <= r < 0.58 and -150 <= ang <= -138:
            col = GLASS[0]
        lay.px[(x, y)] = col
    for p in edge:
        lay.px[p] = INK
    # pilot (clipped to inside the dome glass)
    inner = mask - edge
    draw_pilot(lay, inner, pose)
    # metal rim ring at the base of the glass (visible when the dome pops off)
    for (x, y) in inner:
        u, v = to_local(x + 0.5, y + 0.5, pose)
        du, dv = u - DOME_C[0], v - (DOME_C[1] - lift)
        if rot:
            a = math.radians(-rot)
            du, dv = du * math.cos(a) - dv * math.sin(a), du * math.sin(a) + dv * math.cos(a)
        if dv >= 0.0:
            lay.px[(x, y)] = METAL[0] if du < -4 else (METAL[1] if du < 4 else METAL[2])
    return lay


PILOT_MAP = [
    "....OOOO....",
    "..OO0001OO..",
    ".O00000011O.",
    "O0000000112O",
    "O0000000112O",
    "O0000001112O",
    "O0000011122O",
    "O0001111222O",
    ".O11112222O.",
]
# face overlays (col, row) -> colour key, per expression
FACES = {
    "happy": {(3, 4): "e", (7, 4): "e", (2, 5): "b", (8, 5): "b", (5, 5): "m"},
    "squint": {(2, 4): "e", (3, 4): "e", (7, 4): "e", (8, 4): "e", (3, 5): "b", (7, 5): "b"},
    "dizzy": {(3, 3): "e", (2, 4): "e", (4, 4): "e", (7, 3): "e", (6, 4): "e", (8, 4): "e", (5, 6): "m"},
    "shock": {(3, 3): "e", (3, 4): "e", (7, 3): "e", (7, 4): "e", (5, 6): "e", (2, 5): "b", (8, 5): "b"},
}


def draw_pilot(lay: Layer, inner: set[tuple[int, int]], pose: Pose) -> None:
    """Little cream bun pilot, hand-placed pixels, clipped to the dome glass."""
    pal = {"O": INK_SOFT, "0": PILOT[0], "1": PILOT[1], "2": PILOT[2], "e": INK, "b": BLUSH, "m": hx("#B5625A")}
    ox, oy = to_screen(1.0, DOME_C[1] - pose.dome_lift - 7.0, pose)
    face = FACES.get(pose.face, FACES["happy"])
    for r, row in enumerate(PILOT_MAP):
        for c, ch in enumerate(row):
            if ch == ".":
                continue
            key = face.get((c, r), ch)
            p = (ox - 6 + c, oy + r)
            if p in inner:
                lay.px[p] = pal[key]


def draw_legs(pose: Pose, back: bool = False) -> Layer:
    lay = Layer()
    sp = pose.leg_splay
    legs = [
        ((-14.5, 6.0), (-17.0 - sp, 12.8), 2.5, (-17.6 - sp, 14.4), 3.7),
        ((14.5, 6.0), (17.0 + sp, 12.8), 2.5, (17.6 + sp, 14.4), 3.7),
    ]
    for (a, b, th, foot, fr) in legs:

        def inside(x: float, y: float, a=a, b=b, th=th, foot=foot, fr=fr) -> bool:
            u, v = to_local(x, y, pose)
            d, _ = seg_dist(u, v, a[0], a[1], b[0], b[1])
            if d <= th:
                return True
            return ((u - foot[0]) / fr) ** 2 + ((v - foot[1]) / 1.5) ** 2 <= 1.0 and v <= foot[1] + 1.0

        m = clean_mask(raster(inside))
        e = boundary(m)
        for (x, y) in m:
            u, v = to_local(x + 0.5, y + 0.5, pose)
            cx_ = a[0] + (b[0] - a[0]) * max(0.0, min(1.0, (v - a[1]) / (b[1] - a[1])))
            side = u - cx_
            idx = 0 if side < 0.6 else 1
            if v > foot[1] - 0.9:
                idx = 1 if u < foot[0] + 1.0 else 2
                if v < foot[1] - 0.2 and u < foot[0]:
                    idx = 0
            lay.px[(x, y)] = METAL[idx]
        for p in e:
            lay.px[p] = INK
    return lay


NOZZLE_TOP, NOZZLE_BOT = 8.4, 14.2


def nozzle_half_width(v: float) -> float:
    if v < 9.6:
        return 4.6  # flange plate bolted to the hull
    if v < 10.6:
        return 2.6  # short neck
    t = (v - 10.6) / (NOZZLE_BOT - 10.6)
    return 3.0 + 1.9 * t ** 0.8  # flared bell


def draw_nozzle(pose: Pose) -> Layer:
    lay = Layer()

    def inside(x: float, y: float) -> bool:
        u, v = to_local(x, y, pose)
        return NOZZLE_TOP <= v <= NOZZLE_BOT and abs(u) <= nozzle_half_width(v)

    m = clean_mask(raster(inside))
    e = boundary(m)
    for (x, y) in m:
        u, v = to_local(x + 0.5, y + 0.5, pose)
        w = nozzle_half_width(v)
        rel = u / w
        idx = 0 if rel < -0.35 else (1 if rel < 0.3 else 2)
        if v < 10.6:
            idx = min(2, idx + 1)  # neck sits a touch in the hull's shadow
        lay.px[(x, y)] = METAL[idx]
    for p in e:
        lay.px[p] = INK
    rows: dict[int, list[int]] = {}
    for (x, y) in m - e:
        rows.setdefault(y, []).append(x)
    if rows:
        ybot = max(rows)
        for x in rows[ybot]:
            lay.px[(x, ybot)] = FLAME[1] if pose.nozzle_glow else INK_SOFT
    return lay


def draw_flame(pose: Pose) -> Layer:
    lay = Layer()
    if pose.flame <= 0:
        return lay
    length = {1: 8.0, 2: 15.0, 3: 24.0}[pose.flame]
    top = NOZZLE_BOT - 0.6
    fl = pose.flicker

    def width(t: float) -> float:
        # bulb near the nozzle tapering to a soft point
        return 4.6 * (1.0 - t) ** 0.75 * (0.92 + 0.35 * math.sin(math.pi * min(1.0, t * 1.6)))

    def wob(t: float) -> float:
        return 0.9 * math.sin(t * 7.0 + fl * 2.1) * t

    def inside(x: float, y: float, shrink: float = 0.0, lscale: float = 1.0) -> bool:
        u, v = to_local(x, y, pose)
        t = (v - top) / (length * lscale)
        if t < 0 or t > 1:
            return False
        return abs(u - wob(t)) <= width(t) - shrink

    outer = clean_mask(raster(inside))
    mid = clean_mask(raster(lambda x, y: inside(x, y, 1.5, 0.78)))
    core = clean_mask(raster(lambda x, y: inside(x, y, 3.0, 0.5)))
    for p in outer:
        lay.px[p] = FLAME[3]
    for p in boundary(outer):
        x, y = p
        lay.px[p] = FLAME[4]
    for p in mid:
        lay.px[p] = FLAME[2]
    for p in mid - boundary(mid):
        lay.px[p] = FLAME[1]
    for p in core:
        lay.px[p] = FLAME[0]
    return lay


def compose(layers: list[Layer]) -> Image.Image:
    img = Image.new("RGBA", (W, H), CLEAR)
    pix = img.load()
    for lay in layers:
        for (x, y), c in lay.px.items():
            if 0 <= x < W and 0 <= y < H:
                pix[x, y] = c
    return img


def render_ship(pose: Pose) -> Image.Image:
    layers = [draw_flame(pose), draw_legs(pose), draw_dome(pose), draw_hull(pose), draw_nozzle(pose)]
    return compose(layers)


# ---------------------------------------------------------------- incident props
PUFF = [hx("#FFFBF2"), hx("#F4ECDC"), hx("#E2D4C2"), hx("#C3B6BE"), hx("#9C8FAE")]
PUFF_EDGE = hx("#6F6690")


def blob_layer(circles: list[tuple[float, float, float]], ramp=None, outline=None, alpha: int = 255, edge_alpha: int | None = None) -> Layer:
    """Cartoon puff cloud: union of circles, later circles sit in front; each lobe is shaded
    from the top-left and separated from the lobe behind it by a 1px shadow seam."""
    ramp = ramp or PUFF
    outline = outline or PUFF_EDGE
    lay = Layer()

    def owner(x: float, y: float) -> int:
        own = -1
        for i, (cx, cy, r) in enumerate(circles):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                own = i
        return own

    m = clean_mask(raster(lambda x, y: owner(x, y) >= 0))
    e = boundary(m)
    own = {p: owner(p[0] + 0.5, p[1] + 0.5) for p in m}
    for (x, y) in m:
        i = own[(x, y)]
        if i < 0:
            i = 0
        cx, cy, r = circles[i]
        nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
        lit = -(nx * 0.62 + ny * 0.78)
        rr = math.hypot(nx, ny)
        if lit > 0.42 and rr > 0.25:
            k = 0
        elif lit > -0.05:
            k = 1
        elif lit > -0.5:
            k = 2
        else:
            k = 3
        if rr > 0.8 and lit < -0.35:
            k = 4 if len(ramp) > 4 else 3
        # seam against the lobe behind (pixel just outside this lobe belongs to an earlier one)
        for q in ((x + 1, y), (x, y + 1), (x - 1, y), (x, y - 1)):
            j = own.get(q, -1)
            if 0 <= j < i and (q[0] + 0.5 - cx) ** 2 + (q[1] + 0.5 - cy) ** 2 > r * r:
                pass
        for q in ((x - 1, y), (x, y - 1), (x + 1, y), (x, y + 1)):
            j = own.get(q, -2)
            if j > i:  # a lobe in front of us touches this pixel: tuck into its shadow
                k = max(k, 3)
        lay.px[(x, y)] = ramp[min(len(ramp) - 1, k)][:3] + (alpha,)
    for p in e:
        lay.px[p] = outline[:3] + (alpha if edge_alpha is None else edge_alpha,)
    return lay


def star_layer(stars: list[tuple[int, int, int]]) -> Layer:
    """Little 4-point stars. size 1 = plus, size 2 = bigger diamond star."""
    lay = Layer()
    for (x, y, size) in stars:
        if size == 1:
            pts = {(0, 0): STAR[0], (1, 0): STAR[1], (-1, 0): STAR[1], (0, 1): STAR[1], (0, -1): STAR[1]}
        else:
            pts = {(0, 0): STAR[0], (1, 0): STAR[1], (-1, 0): STAR[1], (0, 1): STAR[1], (0, -1): STAR[1],
                   (2, 0): STAR[2], (-2, 0): STAR[2], (0, 2): STAR[2], (0, -2): STAR[2]}
            for ox, oy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
                pts[(ox, oy)] = STAR[3]
        for (ox, oy), c in pts.items():
            lay.px[(x + ox, y + oy)] = c
        if size == 2:
            for ox, oy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
                del lay.px[(x + ox, y + oy)]
            for ox, oy in ((3, 0), (-3, 0), (0, 3), (0, -3)):
                pass
    return lay


def frames() -> dict[str, Image.Image]:
    base = Pose()
    out: dict[str, Image.Image] = {}
    out["gyoza-idle"] = render_ship(base)
    out["gyoza-fly-01"] = render_ship(replace(base, flame=1, flicker=0, nozzle_glow=True))
    out["gyoza-fly-02"] = render_ship(replace(base, flame=2, flicker=1, nozzle_glow=True))
    out["gyoza-fly-03"] = render_ship(replace(base, flame=3, flicker=2, nozzle_glow=True))

    # incident 1: squash (bump) — wider, shorter, legs splayed, eyes squeezed
    out["gyoza-incident-01"] = render_ship(replace(base, sx=1.1, sy=0.82, face="squint", leg_splay=1.6))

    # incident 2: wobble with little dizzy stars
    img = render_ship(replace(base, rot=-9.0, face="dizzy"))
    stars = compose([star_layer([(14, 9, 2), (33, 3, 1), (50, 8, 2)])])
    img.alpha_composite(stars)
    out["gyoza-incident-02"] = img

    # incident 3: dome pops up with steam puffing out of the seam
    steam = blob_layer([(12.5, 11.0, 3.4), (17.0, 17.5, 4.8), (21.5, 22.0, 3.6), (52.0, 9.5, 3.6), (47.5, 16.5, 5.0), (43.0, 21.5, 3.8)])
    ship = render_ship(replace(base, dome_lift=7.0, dome_rot=8.0, face="shock", rot=2.0))
    img = Image.new("RGBA", (W, H), CLEAR)
    img.alpha_composite(compose([steam]))
    img.alpha_composite(ship)
    out["gyoza-incident-03"] = img

    # incident 4: big puff cloud swallows the ship (feet peeking out below)
    legs = compose([draw_legs(replace(base, leg_splay=1.2))])
    cloud = blob_layer(
        [(12.0, 34.0, 6.5), (52.0, 33.0, 6.5), (21.0, 23.0, 8.5), (43.0, 22.0, 9.0), (32.0, 17.0, 9.0),
         (18.0, 38.0, 8.5), (46.0, 38.0, 8.5), (32.0, 31.0, 12.5), (32.0, 42.0, 7.5)],
    )
    img = Image.new("RGBA", (W, H), CLEAR)
    img.alpha_composite(legs)
    img.alpha_composite(compose([cloud, star_layer([(6, 22, 1), (58, 21, 2), (31, 4, 1)])]))
    out["gyoza-incident-04"] = img

    # incident 5: the puff breaks into a few soft lobes drifting apart
    puffs = blob_layer([(15.0, 25.0, 7.0), (48.0, 21.0, 7.5), (24.0, 44.0, 5.5), (45.0, 43.0, 4.8)], outline=PUFF[3], alpha=235, edge_alpha=150)
    out["gyoza-incident-05"] = compose([puffs, star_layer([(32, 14, 1), (8, 37, 1), (57, 32, 1), (34, 33, 1)])])
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
        print(name, len(img.getcolors(4096) or []), "colours")


if __name__ == "__main__":
    main()
