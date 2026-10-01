"""Build public/assets/characters/rabbit-portrait.png (3 frames, 64x64 each).

Dev tooling only (Python + Pillow). Reuses tools/art/pixelize.py internals so the
normalisation matches the shared pipeline, but processes the idle and happy raws
together so both frames share one crop, one scale and one palette.

  frame 0 idle  : raw/rabbit-portrait-v2.png
  frame 1 blink : frame 0 with the eyes repainted closed (hand-placed pixels below)
  frame 2 happy : frame 0 with the perked upright ear taken from
                  raw/rabbit-portrait-happy-v2.png (a Codex image edit of v2),
                  then (wave 2) the head/ear rows above the scarf rebuilt
                  symmetrically so BOTH ears perk straight up, plus a big
                  open smile. Scarf, cup, paws and body stay pixel-identical.

Usage: python art-src/characters/scripts/build_portrait.py [out.png] [--stage DIR]
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "art"))
import pixelize as px  # noqa: E402

RAW = ROOT / "art-src" / "characters" / "raw"
IDLE_RAW = RAW / "rabbit-portrait-v2.png"
HAPPY_RAW = RAW / "rabbit-portrait-happy-v2.png"
SIZE = 64
COLORS = 32
KEY_TOLERANCE = 120
ALPHA_THRESHOLD = 96
SNAP: str | None = "cge"
INK = (0x1D, 0x1F, 0x33, 255)


def load_keyed(path: Path) -> Image.Image:
    return px.remove_background(Image.open(path), "FF00FF", KEY_TOLERANCE)


def union_bbox(imgs: list[Image.Image]) -> tuple[int, int, int, int]:
    boxes = [i.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox() for i in imgs]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def normalise_pair() -> tuple[Image.Image, Image.Image]:
    idle, happy = load_keyed(IDLE_RAW), load_keyed(HAPPY_RAW)
    box = union_bbox([idle, happy])
    fitted = [px.fit(i.crop(box), (SIZE, SIZE), "contain", Image.Resampling.BOX, "bottom", 0)
              for i in (idle, happy)]
    # one shared palette: quantize both frames side by side
    pair = Image.new("RGBA", (SIZE * 2, SIZE), (0, 0, 0, 0))
    pair.paste(fitted[0], (0, 0))
    pair.paste(fitted[1], (SIZE, 0))
    pair = px.harden_alpha(pair, ALPHA_THRESHOLD, False)
    pair = px.quantize(pair, COLORS, SNAP)
    frames = [pair.crop((0, 0, SIZE, SIZE)), pair.crop((SIZE, 0, SIZE * 2, SIZE))]
    return ink_rim(frames[0]), ink_rim(frames[1])


def ink_rim(img: Image.Image) -> Image.Image:
    """Repaint every silhouette-edge pixel in ink so the 1px outline is clean and unbroken."""
    out = img.copy()
    a = img.getchannel("A").load()
    p = out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if a[x, y] == 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h) or a[nx, ny] == 0:
                    p[x, y] = INK
                    break
    return out


# ---------------------------------------------------------------------------
# Hand-finished face (64px art space). The downscaled raw eyes turn into muddy
# brown blobs at 64x64, so the eye/nose/mouth/blush area is repainted by hand for
# every frame. Everything outside FACE_BOX is untouched pipeline output, which is
# what keeps the three frames pixel-aligned.
FACE_BOX = (15, 33, 43, 42)  # x0, y0, x1, y1 (exclusive)
CX2 = 57  # mirror axis: x' = CX2 - x (face centre between x=28 and x=29)

PLASTER = (0xFB, 0xF7, 0xEC, 255)
AMBER = (0xD4, 0xA0, 0x55, 255)
TERRA_DEEP = (0xA6, 0x61, 0x4A, 255)
NOSE = (0xE3, 0x8F, 0x7E, 255)

# Happy frame: the perked ear is taken from the happy raw (Codex edit of v2).
HAPPY_EAR_BOX = (0, 0, 30, 21)


def mirror(pts: list[tuple[int, int]]) -> list[tuple[int, int]]:
    return pts + [(CX2 - x, y) for x, y in pts]


def face(img: Image.Image, mood: str) -> Image.Image:
    out = img.copy()
    p = out.load()
    cream = p[26, 34]
    lid_shade = p[18, 34] if p[18, 34][0] > 200 and p[18, 34][2] < 190 else cream
    blush = BLUSH
    x0, y0, x1, y1 = FACE_BOX
    for y in range(y0, y1):
        for x in range(x0, x1):
            if p[x, y][3] and p[x, y] != INK:
                p[x, y] = cream

    def put(pts, c):
        for x, y in pts:
            p[x, y] = c

    # blush (bigger and rosier when happy)
    if mood == "happy":
        put(mirror([(16, 38), (17, 38), (18, 38), (19, 38), (16, 39), (17, 39), (18, 39), (19, 39),
                    (17, 40), (18, 40), (17, 37), (18, 37)]), blush)
    else:
        put(mirror([(17, 38), (18, 38), (16, 39), (17, 39), (18, 39), (19, 39), (17, 40), (18, 40)]), blush)

    # eyes
    if mood == "idle":
        put(mirror([(18, 34), (19, 34), (20, 34), (21, 34), (22, 34)]), lid_shade)
        put(mirror([(18, 35), (19, 35), (20, 35), (21, 35), (22, 35), (17, 36)]), INK)
        put([(18, 36), (22, 36), (19, 37), (21, 37), (39, 36), (35, 36), (38, 37), (36, 37)], TERRA_DEEP)
        put([(20, 37), (37, 37), (21, 36), (38, 36)], AMBER)
        put([(20, 36), (37, 36)], INK)
        put([(19, 36), (36, 36)], PLASTER)
    elif mood == "blink":
        put(mirror([(18, 35), (19, 35), (20, 35), (21, 35), (22, 35), (18, 36), (22, 36)]), lid_shade)
        put(mirror([(17, 36), (18, 37), (19, 37), (20, 37), (21, 37), (22, 36)]), INK)
    else:  # happy: closed upward arcs
        put(mirror([(17, 36), (18, 35), (19, 34), (20, 34), (21, 34), (22, 35), (23, 36)]), INK)

    # nose + little cat mouth
    put([(28, 37), (29, 37)], NOSE)
    if mood == "happy":
        put([(25, 38), (28, 38), (29, 38), (32, 38), (26, 39), (27, 39), (30, 39), (31, 39)], TERRA_DEEP)
    else:
        put([(26, 38), (28, 38), (29, 38), (31, 38), (27, 39), (30, 39)], TERRA_DEEP)
    return out


# ---------------------------------------------------------------------------
# Wave 2: happy frame perks BOTH ears. The droopy ear only exists on the right
# half, so every pixel right of the face axis above the scarf is replaced by the
# mirror of the left half (which already carries the perked ear from the happy
# raw). The face itself is symmetric about the same axis, so nothing of the
# idle face is lost; the scarf/cup/paws rows below PERK_ROWS are untouched.
PERK_ROWS = 45  # rows 0..44 are rebuilt; row 45 down is frame-0 pixels
MOUTH_DARK = (0x7A, 0x3B, 0x33, 255)


def perk_both_ears(img: Image.Image) -> Image.Image:
    out = img.copy()
    src = img.load()
    p = out.load()
    half = CX2 // 2 + 1  # first column right of the axis (x = 29)
    for y in range(PERK_ROWS):
        for x in range(half, SIZE):
            mx = CX2 - x
            p[x, y] = src[mx, y] if 0 <= mx < SIZE else (0, 0, 0, 0)
    # the droopy ear tip poked below the head into row 45; drop that orphan
    for x in range(46, SIZE):
        if PERK_ROWS < SIZE:
            p[x, PERK_ROWS] = (0, 0, 0, 0)
    out = ink_rim(out)
    # soft top-left light: the mirrored right rim gets one step darker so the
    # new right side does not glow like the lit left side
    q = out.load()
    a = out.getchannel("A").load()
    for y in range(PERK_ROWS):
        for x in range(half + 6, SIZE):
            if not a[x, y] or q[x, y] == INK:
                continue
            if x + 1 < SIZE and q[x + 1, y] == INK:
                q[x, y] = darker(q[x, y])
    return out


def darker(c: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return (int(c[0] * 0.93), int(c[1] * 0.9), int(c[2] * 0.86), 255)


def happy_mouth(img: Image.Image) -> Image.Image:
    """Open joyful smile: wide top lip, dark mouth with a little pink tongue."""
    out = img.copy()
    p = out.load()
    cream = p[26, 34]
    for x in range(24, 34):
        for y in (38, 39, 40):
            if p[x, y] != INK:
                p[x, y] = cream
    pts = {
        TERRA_DEEP: [(25, 38), (26, 38), (31, 38), (32, 38), (26, 39), (31, 39),
                     (27, 40), (28, 40), (29, 40), (30, 40)],
        MOUTH_DARK: [(27, 38), (28, 38), (29, 38), (30, 38), (27, 39), (30, 39)],
        NOSE: [(28, 39), (29, 39)],
    }
    for c, ps in pts.items():
        for x, y in ps:
            p[x, y] = c
    return out


BLUSH = (0xEC, 0xA5, 0x94, 255)
CUP_BOX = (20, 44, 40, 64)


def warm_strays(img: Image.Image) -> Image.Image:
    """Quantisation leaves a few teal/grey-green pixels on fur edges; warm them up."""
    out = img.copy()
    p = out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = p[x, y]
            in_cup = CUP_BOX[0] <= x < CUP_BOX[2] and CUP_BOX[1] <= y < CUP_BOX[3]
            if a and not in_cup and g > r + 6 and (r, g, b) != INK[:3]:
                lum = (r * 3 + g * 6 + b) // 10
                p[x, y] = (0xC4, 0xA8, 0x80, 255) if lum < 175 else (0xEC, 0xDF, 0xC5, 255)
    return out


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = Path(args[0]) if args else ROOT / "public" / "assets" / "characters" / "rabbit-portrait.png"
    idle, happy = normalise_pair()
    if "--stage" in sys.argv:
        stage = Path(sys.argv[sys.argv.index("--stage") + 1])
        idle.save(stage / "portrait-idle.png")
        happy.save(stage / "portrait-happy.png")
    idle, happy = warm_strays(idle), warm_strays(happy)
    base = idle
    idle_f = face(base, "idle")
    blink = face(base, "blink")
    perked = base.copy()
    perked.paste(happy.crop(HAPPY_EAR_BOX), HAPPY_EAR_BOX[:2])
    happy_f = happy_mouth(face(perk_both_ears(perked), "happy"))
    sheet = Image.new("RGBA", (SIZE * 3, SIZE), (0, 0, 0, 0))
    for i, f in enumerate((idle_f, blink, happy_f)):
        sheet.paste(f, (i * SIZE, 0))
    sheet.save(out, optimize=True)
    print("wrote", out, sheet.size)


if __name__ == "__main__":
    main()
