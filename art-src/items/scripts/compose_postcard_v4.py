"""Compose memory-postcard.png v4 (96x64): the SAME hero ship and Tea Moon the player just flew.

Wave 3 (critic round 2, assets #6): the v3 postcard showed a generic green moon (no teacup crater)
and a flattened saucer whose trail ended in a heart-like puff. v4 keeps v3's Codex sky plate
(dusk gradient, stars, peach/plum clouds, terracotta-teacup stamp) and replaces both subjects
with integer box-downscales of the shipped production sprites:

  * Tea Moon  : public/assets/celestial/tea-moon.png (192x192) -> 1/3 box = 64x64
                (teacup crater, crater ring shading, cottage with chimney, all on-model)
  * Hero ship : public/assets/ship/gyoza-fly-02.png (64x80) -> 1/2 box = 32x40, then tilted with
                tools/art/rotsprite.py (RotSprite, no new colours) so it climbs to the right,
                exactly as the flight scene bakes it. Crimped crescent hull, blue dome, cream pilot.
  * Exhaust   : simple round cream puffs (two tones + ink rim) trailing from the flame.

Hand-clean (deterministic, in code): hard alpha, 1px ink rim only where the sprite meets the sky,
lone-pixel removal. Usage:
  python art-src/items/scripts/compose_postcard_v4.py art-src/items/raw/postcard-v3.png <out.png> [k=v,...]
"""
from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path("tools/art").resolve()))
import compose_postcard_v3 as v3  # noqa: E402
from rotsprite import scale2x  # noqa: E402

W, H, BORDER = v3.W, v3.H, v3.BORDER
IW, IH = v3.IW, v3.IH
INK = v3.INK
CREAM = (0xF9, 0xF3, 0xE5, 255)
CREAM_SH = (0xE3, 0xD2, 0xB6, 255)
CREAM_RIM = (0x8E, 0x7F, 0x9E, 255)  # plum-grey rim so puffs read soft, not inked
WORK = Path("art-src/items/work/w3")
# chimney steam on the 1/3 moon (moon-local art px): small -> larger, drifting up-right
P_STEAM = ((46.5, 10.0, 1), (48.5, 7.5, 1), (51.0, 4.5, 2))
# exhaust trail: (distance behind the flame tip along the ship axis, radius)
P_TRAIL = ((3.0, 2), (7.5, 3), (13.5, 4))

# tunables: moon offset (mx,my), moon downscale divisor (md), ship pos (sx,sy), tilt (deg),
# ship mode (0 = rotsprite small sprite, 1 = box-downscale the baked 112px cell)
P = {"mx": -7, "my": -2, "md": 3, "sx": 49, "sy": 10, "deg": 22, "mode": 1, "rim": 0, "colors": 48, "rimk": 6}


def hard(img: Image.Image, thr: int = 128) -> Image.Image:
    a = np.asarray(img.convert("RGBA")).copy()
    a[..., 3] = np.where(a[..., 3] >= thr, 255, 0)
    a[a[..., 3] == 0] = 0
    return Image.fromarray(a, "RGBA")


def box(img: Image.Image, div: int) -> Image.Image:
    return hard(img.resize((img.width // div, img.height // div), Image.Resampling.BOX))


def rot_small(img: Image.Image, deg: float) -> Image.Image:
    """RotSprite a small sprite: pad, Scale2x x3, nearest rotate, centre-sample downscale."""
    cell = int(math.ceil(max(img.size) * 1.5))
    canvas = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    canvas.paste(img, ((cell - img.width) // 2, (cell - img.height) // 2))
    big = np.asarray(canvas, dtype=np.uint8)
    for _ in range(3):
        big = scale2x(big)
    big_img = Image.fromarray(big, "RGBA").rotate(-deg, resample=Image.Resampling.NEAREST,
                                                  center=(cell * 4, cell * 4))
    arr = np.asarray(big_img)[4::8, 4::8]
    return hard(Image.fromarray(np.ascontiguousarray(arr), "RGBA"))


def despeckle(img: Image.Image) -> Image.Image:
    a = np.asarray(img).copy()
    h, w = a.shape[:2]
    on = a[..., 3] > 0
    for y in range(h):
        for x in range(w):
            if on[y, x]:
                n = sum(on[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                        if 0 <= x + dx < w and 0 <= y + dy < h)
                if n == 0:
                    a[y, x] = 0
    return Image.fromarray(a, "RGBA")


def rim(img: Image.Image, colour=INK) -> Image.Image:
    """1px outline on transparent pixels touching the sprite (sprite edge only)."""
    w, h = img.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(img, (1, 1))
    a = np.asarray(out).copy()
    on = a[..., 3] > 0
    grow = np.zeros_like(on)
    grow[1:, :] |= on[:-1, :]
    grow[:-1, :] |= on[1:, :]
    grow[:, 1:] |= on[:, :-1]
    grow[:, :-1] |= on[:, 1:]
    a[grow & ~on] = colour
    return Image.fromarray(a, "RGBA")


# hand-drawn round puff templates (C = cream, S = shade, lower-right; light from top-left)
PUFFS = {
    1: ["CC",
        "CS"],
    2: ["CC.",
        "CCS",
        ".SS"],
    3: [".CC.",
        "CCCS",
        "CCSS",
        ".SS."],
    4: [".CCC.",
        "CCCCS",
        "CCCSS",
        "CCSSS",
        ".SSS."],
}


def puff(pic: Image.Image, cx: float, cy: float, size: int, rim_colour=CREAM_RIM) -> None:
    """Stamp a round cream puff centred on (cx, cy) with an optional soft plum-grey rim."""
    t = PUFFS[size]
    h, w = len(t), len(t[0])
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    p = pic.load()
    pts = {(x0 + i, y0 + j): ch for j, row in enumerate(t) for i, ch in enumerate(row) if ch != "."}
    for (x, y), ch in pts.items():
        if 0 <= x < pic.width and 0 <= y < pic.height:
            p[x, y] = CREAM if ch == "C" else CREAM_SH
    if rim_colour:
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n not in pts and 0 <= n[0] < pic.width and 0 <= n[1] < pic.height:
                    p[n] = rim_colour


MOON_RIM = (0x3B, 0x4A, 0x3A, 255)  # darker shade of the moon's own sage (not flat ink)


def moon_rim(img: Image.Image) -> Image.Image:
    """Re-ink the silhouette lost in the 1/3 box filter: boundary pixels whose outward side faces
    right/down (shadow side, light from top-left) become a dark sage rim, as on the full sprite."""
    a = np.asarray(img).copy()
    on = a[..., 3] > 0
    h, w = on.shape
    ys, xs = np.nonzero(on[10:])
    cy, cx = ys.mean() + 10, xs.mean()
    for y in range(10, h):
        for x in range(w):
            if not on[y, x]:
                continue
            out = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                   if not (0 <= x + dx < w and 0 <= y + dy < h) or not on[y + dy, x + dx]]
            if out and (x - cx) + (y - cy) > -P["rimk"]:
                a[y, x] = MOON_RIM
    return Image.fromarray(a, "RGBA")


# Hand-placed 12x9 Tea Moon cottage (the 1/3 box filter turns the sprite's cottage into a brown
# blob): domed terracotta roof lit from top-left, cream walls, two amber windows, arched door,
# slate chimney on the right, sage-grey stone footing. Matches public/assets/celestial/tea-moon.png.
COTTAGE = [
    "....oooo.cc.",
    "..ooRRRRocc.",
    ".oRRRRrrrro.",
    "oRRrrrrrdddo",
    "odddddddddoo",
    ".oWWWWWWwwo.",
    ".oWAWWDWAwo.",
    ".oWWWWDWwwo.",
    "osSssSssSsso",
]
COTTAGE_PAL = {
    "o": (0x4A, 0x2E, 0x2C, 255),  # dark shade of terracotta (selective outline)
    "R": (0xE0, 0x8A, 0x4B, 255),  # ember highlight
    "r": (0xC9, 0x7B, 0x5A, 255),  # terracotta
    "d": (0xA6, 0x61, 0x4A, 255),  # terracotta-deep
    "W": (0xF9, 0xF3, 0xE5, 255),  # parchment-warm wall
    "w": (0xE3, 0xD2, 0xB6, 255),  # wall shade
    "A": (0xF0, 0xB8, 0x5C, 255),  # warm lit window
    "D": (0xA6, 0x61, 0x4A, 255),  # door
    "c": (0x9A, 0x96, 0xA6, 255),  # slate chimney
    "s": (0x7E, 0x88, 0x6E, 255),  # stone footing
    "S": (0xA9, 0xB0, 0x92, 255),  # lit stone
}
COTTAGE_AT = (36, 11)          # moon-local top-left of the template (1/3-scale moon px)
MOON_DISC = (30.5, 37.7, 22.6)  # moon disc centre/radius in 1/3-scale px (measured on the sprite)


def recottage(img: Image.Image) -> Image.Image:
    """Clear the blurred sprite cottage (pixels above the moon disc) and stamp the template."""
    a = np.asarray(img).copy()
    cx, cy, r = MOON_DISC
    x0, y0 = COTTAGE_AT
    for y in range(0, y0 + len(COTTAGE) + 1):
        for x in range(x0 - 2, min(a.shape[1], x0 + len(COTTAGE[0]) + 2)):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > (r + 0.3) ** 2:
                a[y, x] = 0
    for j, row in enumerate(COTTAGE):
        for i, ch in enumerate(row):
            if ch != ".":
                a[y0 + j, x0 + i] = COTTAGE_PAL[ch]
    return Image.fromarray(a, "RGBA")


def plate() -> Image.Image:
    raw = Path("art-src/items/raw/postcard-v3.png")
    WORK.mkdir(parents=True, exist_ok=True)
    plate_path = WORK / "postcard-v4-plate.png"
    px_path = WORK / "postcard-v4-plate-px.png"
    v3.paint_out(Image.open(raw)).save(plate_path)
    subprocess.run([sys.executable, "tools/art/pixelize.py", str(plate_path), str(px_path),
                    "--size", f"{IW}x{IH}", "--fit", "cover", "--opaque", "--key", "none",
                    "--no-crop", "--colors", str(P["colors"])], check=True)
    plate_path.unlink()  # 1.5 MB regenerable intermediate
    pic = Image.open(px_path).convert("RGBA")
    k = IW / 1536
    sb = v3.STAMP_BOX
    sw, sh = round((sb[2] - sb[0]) * k), round((sb[3] - sb[1]) * k)
    patch = Image.open(raw).convert("RGB").crop(sb).resize((sw, sh), Image.Resampling.BOX)
    patch = patch.quantize(8, method=Image.Quantize.MEDIANCUT).convert("RGBA")
    pic.paste(patch, (round(sb[0] * k), round(sb[1] * k) - 1))
    return pic


def ship_sprite() -> Image.Image:
    if P["mode"] == 1:
        sheet = Image.open("public/assets/ship/rot/gyoza-fly-02-rot.png").convert("RGBA")
        idx = round(P["deg"] / 11.25) % 32
        cell = sheet.crop(((idx % 8) * 112, (idx // 8) * 112, (idx % 8) * 112 + 112, (idx // 8) * 112 + 112))
        spr = box(cell, 2)
    else:
        spr = rot_small(box(Image.open("public/assets/ship/gyoza-fly-02.png"), 2), P["deg"])
    spr = despeckle(spr)
    return spr.crop(spr.getbbox())


def main() -> None:
    out = Path(sys.argv[2])
    if len(sys.argv) > 3:
        for kv in sys.argv[3].split(","):
            key, val = kv.split("=")
            P[key] = int(val)
    pic = plate()

    moon = box(Image.open("public/assets/celestial/tea-moon.png"), P["md"])
    # the chimney steam breaks into detached specks at 1/3 scale: drop it (rows above the roof)
    # and redraw it as two tiny round puffs after the moon is placed
    ma = np.asarray(moon).copy()
    ma[:10] = 0
    moon = recottage(moon_rim(Image.fromarray(ma, "RGBA")))
    _paste_clipped(pic, moon, P["mx"], P["my"])
    for (mx, my, r) in P_STEAM:
        puff(pic, P["mx"] + mx, P["my"] + my, r, rim_colour=None)

    ship = ship_sprite()
    if P["rim"]:
        ship = rim(ship)
    ship.save(WORK / "postcard-v4-ship.png")
    sx, sy = P["sx"], P["sy"]
    # flame tip = lowest-left opaque warm pixel; trail puffs continue down-left along the tilt
    a = np.asarray(ship)
    warm = [(x, y) for y in range(a.shape[0]) for x in range(a.shape[1])
            if a[y, x, 3] and a[y, x, 0] > 200 and a[y, x, 2] < 110]
    tx, ty = max(warm, key=lambda q: q[1] - q[0]) if warm else (0, ship.height)
    ang = math.radians(P["deg"])
    dx, dy = -math.sin(ang), math.cos(ang)  # backwards along the ship axis
    for dist, r in P_TRAIL:
        puff(pic, sx + tx + dx * dist, sy + ty + dy * dist, r)
    _paste_clipped(pic, ship, sx, sy)
    pic.save(WORK / "postcard-v4-composite-px.png")

    card = Image.new("RGBA", (W, H), v3.PARCH)
    p = card.load()
    for x in range(W):
        for y in range(H):
            if x in (0, W - 1) or y in (0, H - 1):
                p[x, y] = v3.EDGE
            elif x == W - 2 or y == H - 2:
                p[x, y] = v3.SHADE
    for c in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
        p[c] = (0, 0, 0, 0)
    card.paste(pic, (BORDER, BORDER))
    card.save(out, optimize=True)
    print(f"wrote {out} {card.size}")


def _paste_clipped(dst: Image.Image, src: Image.Image, x: int, y: int) -> None:
    x0, y0 = max(0, -x), max(0, -y)
    crop = src.crop((x0, y0, min(src.width, dst.width - x), min(src.height, dst.height - y)))
    dst.alpha_composite(crop, (x + x0, y + y0))


if __name__ == "__main__":
    main()
