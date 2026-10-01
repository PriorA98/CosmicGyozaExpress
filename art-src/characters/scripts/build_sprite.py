"""Build public/assets/characters/rabbit-sprite.png (4 frames, 24x32 each).

Dev tooling only (Python + Pillow). The tiny landing-site rabbit is pixel-authored
here (silhouette spans + hand-placed detail pixels) because image generation can't
hit a clean 24x32 grid. Design follows the Codex reference raws
raw/rabbit-body-idle-v1.png and raw/rabbit-body-wave-v1.png.

Frames: 0 idle, 1 idle bob (upper body 1px lower, feet fixed), 2-3 waving paw.

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
    "C": (0xF4, 0xEC, 0xDC),  # parchment fur
    "S": (0xE0, 0xCC, 0xAA),  # fur shade
    "D": (0xBF, 0xA2, 0x7C),  # deep fur shade / inner line
    "P": (0xE3, 0x97, 0x86),  # inner ear pink
    "B": (0xEC, 0xA5, 0x94),  # blush
    "R": (0xC9, 0x7B, 0x5A),  # terracotta scarf
    "r": (0xA6, 0x61, 0x4A),  # scarf shade
    "O": (0xE0, 0x8A, 0x4B),  # scarf highlight (ember)
    "T": (0x6F, 0xA3, 0x9A),  # teal cup
    "t": (0x4E, 0x7C, 0x74),  # cup shade
    "L": (0xA9, 0xCF, 0xC3),  # cup highlight
    "A": (0xD4, 0xA0, 0x55),  # tea (amber)
}

Spans = dict[int, list[tuple[int, int]]]


def sp(d: dict[int, tuple[int, int] | list[tuple[int, int]]]) -> Spans:
    return {y: (v if isinstance(v, list) else [v]) for y, v in d.items()}


# Interior spans (inclusive) per row for each part, in frame-0 coordinates. Centre x=12.
HEAD = sp({9: (8, 16), 10: (7, 17), 11: (6, 18), 12: (6, 18), 13: (6, 18), 14: (6, 18),
           15: (6, 18), 16: (6, 18), 17: (7, 17), 18: (8, 16), 19: (9, 15)})
EAR_UP = sp({1: (8, 9), 2: (7, 9), 3: (7, 10), 4: (7, 10), 5: (8, 10), 6: (8, 10), 7: (8, 10),
             8: (8, 10)})
EAR_DROOP = sp({8: (14, 17), 9: (15, 19), 10: (17, 20), 11: (18, 21), 12: (19, 21),
                13: (19, 21), 14: (19, 21), 15: (19, 20)})
BODY = sp({20: (8, 16), 21: (7, 17), 22: (6, 18), 23: (6, 18), 24: (6, 18), 25: (6, 18),
           26: (7, 17), 27: (7, 17), 28: (8, 16)})
FEET = sp({29: [(7, 10), (14, 17)], 30: [(7, 10), (14, 17)]})
# Raised waving arm (viewer's left), two poses: paw out wide, then paw up high.
ARM_UP = [
    sp({13: (2, 3), 14: (1, 4), 15: (1, 4), 16: (2, 4), 17: (3, 4), 18: (3, 5), 19: (4, 5),
        20: (5, 6), 21: (6, 6)}),
    sp({11: (3, 4), 12: (2, 4), 13: (2, 4), 14: (2, 4), 15: (3, 4), 16: (3, 4), 17: (3, 4),
        18: (3, 5), 19: (4, 5), 20: (5, 6), 21: (6, 6)}),
]

Grid = list[list[str]]


def blank() -> Grid:
    return [["." for _ in range(FW)] for _ in range(FH)]


def cells(spans: Spans) -> set[tuple[int, int]]:
    return {(x, y) for y, row in spans.items() for a, b in row for x in range(a, b + 1)}


def put(g: Grid, pts, ch: str, dy: int = 0) -> None:
    for x, y in pts:
        if 0 <= y + dy < FH and 0 <= x < FW:
            g[y + dy][x] = ch


def fill(g: Grid, spans: Spans, ch: str, dy: int = 0) -> None:
    put(g, cells(spans), ch, dy)


def shade_part(g: Grid, spans: Spans, dy: int = 0, hi: bool = True) -> None:
    """Bottom/right rim -> S, top-left rim -> W, using the part's own silhouette."""
    inside = cells(spans)
    for (x, y) in inside:
        if (x + 1, y) not in inside or (x, y + 1) not in inside:
            g[y + dy][x] = "S"
        elif hi and ((x - 1, y) not in inside or (x, y - 1) not in inside):
            g[y + dy][x] = "W"


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


def frame(pose: str) -> Grid:
    g = blank()
    b = 1 if pose == "bob" else 0
    wave = {"wave1": 0, "wave2": 1}.get(pose)

    # feet are pinned to the bottom (their outline lands on row 31)
    fill(g, FEET, "C")
    put(g, [(10, 30), (17, 30), (10, 29), (17, 29)], "S")
    put(g, [(7, 29), (14, 29)], "W")

    # body (bobs)
    fill(g, BODY, "C", b)
    shade_part(g, BODY, b, hi=False)
    put(g, [(7, 22), (7, 23), (7, 24)], "W", b)

    # droopy ear, upright ear, head
    fill(g, EAR_DROOP, "C", b)
    shade_part(g, EAR_DROOP, b, hi=False)
    put(g, [(18, 10), (19, 11), (20, 12), (20, 13)], "P", b)
    fill(g, EAR_UP, "C", b)
    put(g, [(8, 3), (8, 4), (9, 5), (9, 6), (9, 7), (9, 8)], "P", b)
    put(g, [(8, 1), (7, 2), (7, 3), (7, 4), (8, 5)], "W", b)
    put(g, [(10, 5), (10, 6), (10, 7)], "S", b)
    fill(g, HEAD, "C", b)
    shade_part(g, HEAD, b)
    # droopy-ear root sits on the crown; soft inner line where it meets the head
    put(g, [(14, 9), (15, 9), (16, 9), (17, 10), (18, 11)], "C", b)
    put(g, [(13, 9), (14, 10), (15, 10), (16, 10), (17, 11), (18, 12), (18, 13), (18, 14)], "D", b)
    put(g, [(7, 11), (8, 11), (7, 12)], "W", b)

    # face: sleepy lidded eyes, blush, tiny nose and mouth
    put(g, [(8, 14), (9, 14), (10, 14), (9, 15)], "K", b)
    put(g, [(14, 14), (15, 14), (16, 14), (15, 15)], "K", b)
    put(g, [(7, 16), (8, 16), (16, 16), (17, 16)], "B", b)
    put(g, [(12, 15)], "P", b)
    put(g, [(11, 16), (13, 16)], "D", b)

    # knitted scarf across the neck, tail hanging on the viewer's right
    put(g, [(x, y) for y in (19, 20) for x in range(7, 18)], "R", b)
    put(g, [(x, 20) for x in range(7, 18)], "r", b)
    put(g, [(8, 19), (9, 19), (11, 19), (14, 19)], "O", b)
    put(g, [(10, 20), (13, 20), (16, 20)], "R", b)
    put(g, [(17, 21), (18, 21), (17, 22), (18, 22), (17, 23), (18, 24)], "R", b)
    put(g, [(18, 22), (18, 23), (17, 24)], "r", b)

    # cup + paws
    put(g, [(x, y) for y in (21, 22, 23) for x in range(10, 14)] + [(11, 24), (12, 24)], "T", b)
    put(g, [(10, 21), (11, 21), (12, 21), (13, 21)], "A", b)
    put(g, [(10, 22)], "L", b)
    put(g, [(13, 22), (13, 23), (12, 24)], "t", b)
    put(g, [(14, 22), (15, 22), (14, 23), (15, 23)], "W", b)
    put(g, [(16, 23), (15, 24)], "S", b)
    if wave is None:
        put(g, [(8, 22), (9, 22), (8, 23), (9, 23)], "W", b)
        put(g, [(8, 24), (9, 24)], "S", b)

    if wave is not None:
        arm = ARM_UP[wave]
        fill(g, arm, "C", b)
        shade_part(g, arm, b)

    outline(g)

    # ink between the feet
    put(g, [(11, 30), (12, 30), (13, 30), (11, 29), (13, 29)], "K")
    put(g, [(12, 29)], "K") if b == 0 else None
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
    frames = [frame(p) for p in ("idle", "bob", "wave1", "wave2")]
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
