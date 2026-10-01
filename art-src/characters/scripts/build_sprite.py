"""Build public/assets/characters/rabbit-sprite.png (4 frames, 24x32 each).

Dev tooling only (Python + Pillow). The tiny landing-site rabbit is pixel-authored
here (silhouette spans + hand-placed detail pixels) because image generation can't
hit a clean 24x32 grid. Design follows the Codex reference raws
raw/rabbit-body-idle-v1.png and raw/rabbit-body-wave-v1.png and the colours of the
finished rabbit-portrait.png (warm cream fur, terracotta knit scarf, teal teacup).

Frames:
  0 idle
  1 idle breath (everything above the belly 1px lower, feet + hips fixed)
  2 wave, paw out wide
  3 wave, paw up high
Feet outline sits on the bottom row (y=31) in every frame.

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
    "N": (0xE3, 0x8F, 0x7E),  # nose
    "E": (0xD4, 0xA0, 0x55),  # amber iris
    "e": (0x70, 0x37, 0x2C),  # dark iris
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


# Interior spans (inclusive) per row, frame-0 coordinates. Face centre x=11.5.
HEAD = sp({9: (8, 15), 10: (6, 17), 11: (5, 18), 12: (5, 18), 13: (5, 18), 14: (5, 18),
           15: (5, 18), 16: (5, 18), 17: (6, 17), 18: (7, 16), 19: (9, 14)})
EAR_UP = sp({1: (7, 7), 2: (6, 8), 3: (6, 9), 4: (6, 9), 5: (6, 9), 6: (6, 9), 7: (7, 9),
             8: (7, 9)})
# floppy ear: leaves the crown up-right, folds over and hangs beside the head
EAR_DROOP = sp({7: (14, 16), 8: (13, 18), 9: (15, 20), 10: (17, 21), 11: (18, 21),
                12: (18, 21), 13: (19, 21), 14: (19, 21), 15: (19, 20)})
EAR_ROOT_MAX_Y = 8  # ear cells at/above this row merge into the crown without a line
BODY = sp({20: (7, 16), 21: (6, 17), 22: (6, 17), 23: (5, 18), 24: (5, 18), 25: (5, 18),
           26: (5, 18), 27: (6, 17), 28: (7, 16)})
FEET = sp({29: [(6, 9), (14, 17)], 30: [(6, 9), (14, 17)]})
# Raised waving arm (viewer's left), two poses.
ARM_UP = [
    sp({13: (1, 2), 14: (0, 3), 15: (0, 3), 16: (1, 3), 17: (2, 4), 18: (2, 4), 19: (3, 5),
        20: (4, 6), 21: (5, 6)}),
    sp({10: (2, 3), 11: (1, 4), 12: (1, 4), 13: (2, 4), 14: (2, 4), 15: (3, 4), 16: (3, 4),
        17: (3, 4), 18: (3, 5), 19: (4, 5), 20: (4, 6), 21: (5, 6)}),
]
# Breathing frame: rows above this one shift down 1px; this (plain belly) row is dropped.
BREATH_DROP_ROW = 26

Grid = list[list[str]]


def blank() -> Grid:
    return [["." for _ in range(FW)] for _ in range(FH)]


def cells(spans: Spans) -> set[tuple[int, int]]:
    return {(x, y) for y, row in spans.items() for a, b in row for x in range(a, b + 1)}


def put(g: Grid, pts, ch: str) -> None:
    for x, y in pts:
        if 0 <= y < FH and 0 <= x < FW:
            g[y][x] = ch


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
    put(g, [(9, 29), (9, 30), (17, 29), (17, 30), (6, 30), (14, 30)], "S")
    put(g, [(6, 29), (14, 29)], "W")

    # body
    fill(g, BODY, "C")
    shade_part(g, BODY, hi=False)
    put(g, [(6, 22), (5, 23), (5, 24), (6, 21)], "W")
    put(g, [(17, 27), (16, 28), (8, 28), (9, 28)], "S")
    put(g, [(15, 28), (16, 27)], "D")

    # upright ear
    fill(g, EAR_UP, "C")
    put(g, [(7, 1), (6, 2), (6, 3), (6, 4), (6, 5), (6, 6)], "W")
    put(g, [(7, 3), (7, 4), (8, 4), (7, 5), (8, 5), (8, 6), (8, 7)], "P")
    put(g, [(9, 3), (9, 4), (9, 5), (9, 6), (9, 7), (9, 8)], "S")

    # head
    fill(g, HEAD, "C")
    shade_part(g, HEAD)
    put(g, [(6, 11), (7, 10), (6, 12)], "W")
    put(g, [(17, 17), (16, 18), (14, 19), (15, 18)], "D")

    # floppy ear on top of the head, separated from the cheek by an ink line
    fill(g, EAR_DROOP, "C")
    shade_part(g, EAR_DROOP)
    put(g, [(14, 7), (13, 8), (14, 8), (15, 8)], "W")
    put(g, [(20, 12), (20, 13), (20, 14)], "P")
    put(g, [(17, 9), (18, 9), (19, 10)], "D")  # fold crease
    inner_line(g, EAR_DROOP, HEAD, EAR_ROOT_MAX_Y)

    # face: sleepy half-lidded eyes, rosy cheeks, tiny nose + mouth
    put(g, [(7, 14), (8, 14), (9, 14), (14, 14), (15, 14), (16, 14)], "S")  # heavy lids
    put(g, [(7, 15), (8, 15), (9, 15), (14, 15), (15, 15), (16, 15)], "K")
    put(g, [(8, 16), (15, 16)], "E")
    put(g, [(9, 16), (14, 16)], "e")
    put(g, [(6, 17), (7, 17), (16, 17), (17, 17)], "B")
    put(g, [(11, 16), (12, 16)], "N")
    put(g, [(10, 17), (13, 17)], "D")
    put(g, [(11, 17), (12, 17)], "S")

    # knitted scarf round the neck, knot tail hanging on the viewer's right
    put(g, [(x, 19) for x in range(7, 17)], "R")
    put(g, [(x, 20) for x in range(6, 18)], "r")
    put(g, [(8, 19), (9, 19), (11, 19), (13, 19), (15, 19)], "O")
    put(g, [(7, 20), (9, 20), (12, 20), (15, 20)], "R")
    put(g, [(15, 21), (16, 21), (15, 22), (16, 22), (16, 23), (15, 24), (16, 24)], "R")
    put(g, [(16, 22), (16, 24)], "r")
    put(g, [(15, 21)], "O")

    # teacup held in both paws
    put(g, [(x, y) for y in (22, 23) for x in range(10, 14)] + [(11, 24), (12, 24)], "T")
    put(g, [(10, 21), (11, 21), (12, 21), (13, 21)], "A")
    put(g, [(10, 22), (10, 23)], "L")
    put(g, [(13, 22), (13, 23), (12, 24)], "t")
    put(g, [(9, 21), (14, 21)], "K")  # cup rim edges
    put(g, [(14, 22), (14, 23)], "W")  # right paw
    put(g, [(14, 24)], "S")
    if wave is None:
        put(g, [(8, 22), (9, 22), (8, 23), (9, 23)], "W")  # left paw
        put(g, [(8, 24), (9, 24)], "S")
        put(g, [(7, 23)], "D")

    if wave is not None:
        arm = ARM_UP[wave]
        fill(g, arm, "C")
        shade_part(g, arm)

    outline(g)
    if wave is not None:
        inner_line(g, ARM_UP[wave], BODY)
    # ink between the feet
    put(g, [(10, 29), (13, 29), (10, 30), (11, 30), (12, 30), (13, 30)], "K")

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
