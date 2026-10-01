"""Build public/assets/characters/rabbit-sprite.png (4 frames, 24x32 each).

Dev tooling only (Python + Pillow). The tiny landing-site rabbit is pixel-authored
here (silhouette spans + hand-placed detail pixels) because image generation can't
hit a clean 24x32 grid. Design follows the Codex reference raws
raw/rabbit-body-idle-v1.png and raw/rabbit-body-wave-v1.png and the colours of the
finished rabbit-portrait.png (warm cream fur, terracotta knit scarf, teal teacup).

Wave 2 redraw (readability pass):
  - upright ear is a tall 3px-wide ear with a pink inner stripe;
  - the droopy ear now rises off the crown, bends over and hangs down beside the
    head with a pink underside, leaving a 1px background notch under the bend so
    the silhouette reads as an ear (not a lump on the head);
  - bigger face: heavy-lidded 2px amber eyes under ink lids, rosy cheeks, pink
    nose and a tiny w mouth;
  - the waving arm leaves the body with a 1px background gap to the head, ending
    in a round paw with a pink pad, plus little motion ticks; frame 2 holds the
    paw out at cheek height, frame 3 swings it up beside the ear.

Frames:
  0 idle (cup in both paws)
  1 idle breath (everything above the hips 1px lower, feet + hips fixed)
  2 wave, paw out at cheek height
  3 wave, paw up high beside the ear
Feet sit on the bottom rows: feet fill rows 28-30, their outline is row 31.

Usage: python art-src/characters/scripts/build_sprite.py [out.png] [--ascii]
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

FW, FH = 24, 32

PAL = {
    "K": (0x1D, 0x1F, 0x33),  # ink outline
    "W": (0xFB, 0xF7, 0xEC),  # plaster highlight
    "C": (0xF8, 0xEF, 0xD6),  # cream fur
    "S": (0xEA, 0xD7, 0xB0),  # fur shade
    "D": (0xC3, 0xA9, 0x7F),  # deep fur shade / inner line
    "P": (0xEC, 0xA5, 0x94),  # inner ear pink
    "B": (0xF3, 0xBA, 0x8B),  # blush (warm peach)
    "N": (0xE3, 0x8F, 0x7E),  # nose / paw pad
    "E": (0xD4, 0xA0, 0x55),  # amber iris / motion ticks
    "e": (0x70, 0x37, 0x2C),  # dark iris / mouth
    "R": (0xCC, 0x68, 0x43),  # terracotta scarf
    "r": (0x94, 0x52, 0x34),  # scarf shade
    "O": (0xE8, 0x8B, 0x4C),  # scarf highlight (ember)
    "T": (0x77, 0xA4, 0x95),  # teal cup
    "t": (0x4E, 0x7C, 0x74),  # cup shade
    "L": (0xA9, 0xCF, 0xC3),  # cup highlight
    "A": (0xAE, 0x88, 0x60),  # tea surface
}

Spans = dict[int, list[tuple[int, int]]]


def sp(d: dict[int, tuple[int, int] | list[tuple[int, int]]]) -> Spans:
    return {y: (v if isinstance(v, list) else [v]) for y, v in d.items()}


# Interior spans (inclusive) per row, frame-0 coordinates. Face axis x=11.5
# (mirror: x' = 23 - x). Head outline sits on x=5 / x=18 at its widest.
HEAD = sp({8: (8, 15), 9: (7, 16), 10: (6, 17), 11: (6, 17), 12: (6, 17), 13: (6, 17),
           14: (6, 17), 15: (6, 17), 16: (7, 16), 17: (8, 15)})
EAR_UP = sp({1: (7, 8), 2: (7, 9), 3: (7, 9), 4: (7, 9), 5: (7, 9), 6: (7, 9), 7: (7, 9),
             8: (7, 9)})
# droopy ear: rises off the crown (x14-15), bends over at rows 2-3 and hangs down
# beside the head (x19-21) to a rounded tip on row 12. Rows 4-6 keep a 1px
# background notch at x=17 between the rising and hanging parts.
EAR_DROOP = sp({2: (15, 18), 3: (14, 20), 4: [(14, 15), (19, 21)], 5: [(14, 15), (19, 21)],
                6: [(14, 15), (19, 21)], 7: [(14, 16), (19, 21)], 8: (19, 21), 9: (19, 21),
                10: (19, 21), 11: (20, 21)})
BODY = sp({18: (7, 16), 19: (6, 17), 20: (6, 17), 21: (6, 17), 22: (6, 17), 23: (6, 17),
           24: (6, 17), 25: (6, 17), 26: (7, 16), 27: (8, 15)})
FEET = sp({28: [(6, 9), (14, 17)], 29: [(6, 9), (14, 17)], 30: [(7, 9), (14, 16)]})
# Raised waving arm (viewer's left), two poses. Interior stops at x<=3 next to
# the head so a 1px background gap (x=4) separates paw and head.
# Arm and ticks are in FINAL coordinates (after the body is shifted DX right).
ARM = [
    # wave1: paw out at cheek height, forearm angled out from the shoulder
    sp({10: (2, 3), 11: (1, 4), 12: (1, 4), 13: (1, 4), 14: (2, 3), 15: (2, 4), 16: (3, 4),
        17: (3, 5), 18: (4, 6), 19: (5, 6)}),
    # wave2: paw up high beside the ear, forearm leaning out
    sp({4: (2, 3), 5: (1, 4), 6: (1, 4), 7: (1, 4), 8: (2, 3), 9: (2, 3), 10: (2, 3),
        11: (2, 3), 12: (2, 3), 13: (2, 3), 14: (2, 3), 15: (2, 4), 16: (3, 4), 17: (3, 5),
        18: (4, 6), 19: (5, 6)}),
]
PAW_PAD = [[(2, 12), (3, 12)], [(2, 6), (3, 6)]]
PAW_HI = [[(2, 11), (1, 12)], [(2, 5), (1, 6)]]
# little motion ticks beside the paw (amber, no outline)
TICKS = [[(1, 8), (2, 8), (0, 10), (0, 14)], [(0, 2), (1, 2), (5, 2), (5, 3)]]
DX = 1  # the body is authored 1px left of its final place, then shifted right
# Breathing frame: rows above this one shift down 1px; this (plain belly) row is dropped.
BREATH_DROP_ROW = 25

Grid = list[list[str]]


def blank() -> Grid:
    return [["." for _ in range(FW)] for _ in range(FH)]


def cells(spans: Spans) -> set[tuple[int, int]]:
    return {(x, y) for y, row in spans.items() for a, b in row for x in range(a, b + 1)}


def put(g: Grid, pts, ch: str) -> None:
    for x, y in pts:
        if 0 <= y < FH and 0 <= x < FW:
            g[y][x] = ch


def mirror(pts: list[tuple[int, int]]) -> list[tuple[int, int]]:
    return pts + [(23 - x, y) for x, y in pts]


def shifted(spans: Spans, dx: int) -> Spans:
    return {y: [(a + dx, b + dx) for a, b in row] for y, row in spans.items()}


def fill(g: Grid, spans: Spans, ch: str) -> None:
    put(g, cells(spans), ch)


def shade_part(g: Grid, spans: Spans, hi: bool = True) -> None:
    """Soft light from top-left: bottom/right rim -> S, top-left rim -> W."""
    inside = cells(spans)
    for (x, y) in inside:
        if (x + 1, y) not in inside or (x, y + 1) not in inside:
            g[y][x] = "S"
        elif hi and ((x - 1, y) not in inside or (x, y - 1) not in inside):
            g[y][x] = "W"


def outline(g: Grid) -> None:
    src = [row[:] for row in g]
    for y in range(FH):
        for x in range(FW):
            if src[y][x] != ".":
                continue
            for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + ddx, y + ddy
                if 0 <= nx < FW and 0 <= ny < FH and src[ny][nx] != ".":
                    g[y][x] = "K"
                    break


def inner_line(g: Grid, part: Spans, under: Spans, skip_rows_upto: int = -1) -> None:
    """Ink line on `under` cells that border `part` (separates overlapping parts)."""
    top, low = cells(part), cells(under)
    for (x, y) in low - top:
        if y <= skip_rows_upto:
            continue
        if any((x + dx, y + dy) in top for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            g[y][x] = "K"


def frame(pose: str) -> Grid:
    g = blank()
    wave = {"wave1": 0, "wave2": 1}.get(pose)

    # feet (outline lands on row 31)
    fill(g, FEET, "C")
    put(g, [(9, 28), (9, 29), (17, 28), (17, 29), (16, 30), (9, 30)], "S")
    put(g, [(6, 28), (14, 28)], "W")
    put(g, [(7, 30), (8, 30), (14, 30), (15, 30)], "S")

    # body
    fill(g, BODY, "C")
    shade_part(g, BODY, hi=False)
    put(g, [(6, 20), (6, 21), (6, 22), (7, 19)], "W")
    put(g, [(15, 26), (16, 25), (14, 27)], "D")

    # upright ear: plaster lit edge, pink inner stripe, shaded right edge
    fill(g, EAR_UP, "C")
    put(g, [(7, 1), (7, 2), (7, 3), (7, 4), (7, 5), (7, 6)], "W")
    put(g, [(8, 2), (8, 3), (8, 4), (8, 5), (8, 6), (8, 7)], "P")
    put(g, [(9, 2), (9, 3), (9, 4), (9, 5), (9, 6), (9, 7)], "S")

    # head
    fill(g, HEAD, "C")
    shade_part(g, HEAD)
    put(g, [(7, 10), (8, 9), (6, 11), (6, 12)], "W")
    put(g, [(17, 15), (16, 16), (15, 17), (14, 17)], "D")

    # droopy ear: lit top of the bend, pink underside on the hanging part
    fill(g, EAR_DROOP, "C")
    shade_part(g, EAR_DROOP)
    put(g, [(15, 2), (16, 2), (17, 2), (14, 3), (14, 4), (14, 5)], "W")
    put(g, [(19, 3), (20, 3)], "C")
    put(g, [(19, 7), (19, 8), (19, 9), (19, 10), (20, 9), (20, 10)], "P")
    put(g, [(20, 4), (20, 5)], "W")
    put(g, [(21, 4), (21, 5), (21, 6), (21, 7), (21, 8), (21, 9), (21, 10), (21, 11),
            (20, 11)], "S")
    put(g, [(16, 7), (15, 7)], "S")

    # face: soft sleepy eyes (lid line with a drooping outer corner, amber iris
    # under it), rosy cheeks, pink nose, tiny mouth
    put(g, mirror([(8, 12), (9, 12), (7, 13)]), "K")
    put(g, mirror([(8, 13)]), "E")
    put(g, mirror([(9, 13)]), "e")
    put(g, mirror([(6, 14), (7, 14)]), "B")
    put(g, [(11, 14), (12, 14)], "N")
    put(g, [(10, 15), (13, 15)], "D")
    put(g, [(11, 15), (12, 15)], "e")

    # knitted scarf round the neck, knot tail hanging on the viewer's right
    put(g, [(x, 18) for x in range(7, 17)], "R")
    put(g, [(x, 19) for x in range(6, 18)], "r")
    put(g, [(8, 18), (10, 18), (12, 18), (14, 18)], "O")
    put(g, [(7, 19), (9, 19), (11, 19), (13, 19), (15, 19)], "R")
    put(g, [(15, 20), (16, 20), (15, 21), (16, 21), (16, 22), (15, 23), (16, 23)], "R")
    put(g, [(16, 21), (16, 23), (15, 22)], "r")
    put(g, [(15, 20)], "O")

    # teacup held in both paws
    put(g, [(x, y) for y in (21, 22) for x in range(10, 14)] + [(11, 23), (12, 23)], "T")
    put(g, [(10, 20), (11, 20), (12, 20), (13, 20)], "A")
    put(g, [(10, 21), (10, 22)], "L")
    put(g, [(13, 21), (13, 22), (12, 23)], "t")
    put(g, [(9, 20), (14, 20)], "K")  # cup rim edges
    put(g, [(14, 21), (14, 22)], "W")  # right paw
    put(g, [(14, 23)], "S")
    if wave is None:
        put(g, [(8, 21), (9, 21), (8, 22), (9, 22)], "W")  # left paw
        put(g, [(8, 23), (9, 23)], "S")
        put(g, [(7, 22)], "D")
    else:
        put(g, [(8, 21), (8, 22), (7, 21)], "C")  # free paw gone: plain chest fur
        put(g, [(9, 21), (9, 22)], "S")

    # shift the authored body right so the waving paw has room for its own
    # outline plus a 1px background gap to the head
    g = [["."] * DX + row[: FW - DX] for row in g]

    if wave is not None:
        arm = ARM[wave]
        fill(g, arm, "C")
        shade_part(g, arm)
        put(g, PAW_HI[wave], "W")
        put(g, PAW_PAD[wave], "N")

    outline(g)
    if wave is not None:
        inner_line(g, ARM[wave], shifted(BODY, DX))
        put(g, TICKS[wave], "E")
    # ink between the feet
    put(g, [(x + DX, y) for x, y in ((10, 28), (13, 28), (10, 29), (13, 29), (10, 30), (11, 30),
                                     (12, 30), (13, 30))], "K")

    if pose == "breath":
        # rows above BREATH_DROP_ROW move down 1px; feet and hips stay put
        for y in range(BREATH_DROP_ROW, 0, -1):
            g[y] = g[y - 1][:]
        g[0] = ["."] * FW
    return g


def to_image(frames: list[Grid]) -> Image.Image:
    img = Image.new("RGBA", (FW * len(frames), FH), (0, 0, 0, 0))
    px = img.load()
    for i, g in enumerate(frames):
        for y in range(FH):
            for x in range(FW):
                c = g[y][x]
                if c != ".":
                    px[i * FW + x, y] = PAL[c] + (255,)
    return img


def main() -> None:
    frames = [frame(p) for p in ("idle", "breath", "wave1", "wave2")]
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--ascii" in sys.argv:
        for i, g in enumerate(frames):
            print(f"frame {i}")
            for row in g:
                print("".join(row))
    out = Path(args[0]) if args else Path("public/assets/characters/rabbit-sprite.png")
    to_image(frames).save(out, optimize=True)
    print("wrote", out)


if __name__ == "__main__":
    main()
