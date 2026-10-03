"""Hero ship v4: the player's ORIGINAL drawing, kept as drawn (no redraw, no repaint, no palette change).

Source: art-src/ship/originals/*.png (copies of assets/reference/gyoza-ship/: default, fly-1..3, dmg-1..5).
Steps per frame:
  1. Register against gyoza-idle with art-src/ship/scripts/offsets.json (saucer-band registration from
     register.py), using the same explosion/smoke overrides as the wave-1 pipeline.
  2. Paste onto a common canvas so the saucer centre of the original idle frame, (72, 75) in original
     pixels, lands on the art pivot (32, 34) after scaling.
  3. Downscale by exactly 1/2 (box filter, alpha-correct) to the 64x80 art contract. The game displays
     art at 2x, so the ship appears at the original drawing's own size.
Colours, outlines and soft edges are the original's own.
Run from the repo root:  python art-src/ship/scripts/original_frames.py
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

SRC = Path("art-src/ship/originals")
OUT = [Path("public/assets/ship"), Path("art-src/ship/art")]
W, H = 64, 80
PIVOT_ART = (32, 34)
PIVOT_ORIG = (72, 75)  # saucer centre in the original idle frame

offsets = json.loads(Path("art-src/ship/scripts/offsets.json").read_text(encoding="utf-8"))
offsets["gyoza-incident-04"].update(dx=7, dy=-5)  # explosion centred on the saucer centroid (wave-1 override)
offsets["gyoza-incident-05"].update(dx=-12, dy=7)  # smoke puff centred on the same point (wave-1 override)


def nudge_debris_inside(src: Image.Image, pos: tuple[int, int], big_w: int, big_h: int) -> Image.Image:
    """Paste `src` at `pos`; any detached piece (8-connected alpha component) that would cross the canvas
    edge is moved inward just enough to fit, so no drawn debris is cut in half. The main body never moves."""
    margin = 64
    wide = Image.new("RGBA", (big_w + 2 * margin, big_h + 2 * margin), (0, 0, 0, 0))
    wide.alpha_composite(src, (pos[0] + margin, pos[1] + margin))
    px = wide.load()
    seen: set[tuple[int, int]] = set()
    comps: list[list[tuple[int, int]]] = []
    for y in range(wide.height):
        for x in range(wide.width):
            if px[x, y][3] > 8 and (x, y) not in seen:
                stack, comp = [(x, y)], []
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop()
                    comp.append((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            q = (cx + dx, cy + dy)
                            if 0 <= q[0] < wide.width and 0 <= q[1] < wide.height and q not in seen and px[q][3] > 8:
                                seen.add(q)
                                stack.append(q)
                comps.append(comp)
    comps.sort(key=len, reverse=True)
    out = Image.new("RGBA", wide.size, (0, 0, 0, 0))
    opx = out.load()
    for i, comp in enumerate(comps):
        shift_x = shift_y = 0
        if i > 0:  # never move the largest component (the ship body)
            xs = [c[0] for c in comp]
            ys = [c[1] for c in comp]
            lo_x, hi_x = margin + 2, margin + big_w - 3
            lo_y, hi_y = margin + 2, margin + big_h - 3
            if min(xs) < lo_x:
                shift_x = lo_x - min(xs)
            elif max(xs) > hi_x:
                shift_x = hi_x - max(xs)
            if min(ys) < lo_y:
                shift_y = lo_y - min(ys)
            elif max(ys) > hi_y:
                shift_y = hi_y - max(ys)
        for (x, y) in comp:
            # include the faint fringe around the piece as it moves
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if 0 <= q[0] < wide.width and 0 <= q[1] < wide.height and px[q][3] > 0 and opx[q[0] + shift_x, q[1] + shift_y][3] == 0:
                        opx[q[0] + shift_x, q[1] + shift_y] = px[q]
    return out.crop((margin, margin, margin + big_w, margin + big_h))


def main() -> None:
    big_w, big_h = W * 2, H * 2
    # original idle pixel (0,0) lands here on the 2x canvas
    ox = PIVOT_ART[0] * 2 - PIVOT_ORIG[0]
    oy = PIVOT_ART[1] * 2 - PIVOT_ORIG[1]
    for name, o in offsets.items():
        src = Image.open(SRC / f"{name}.png").convert("RGBA")
        big = nudge_debris_inside(src, (ox - o["dx"], oy - o["dy"]), big_w, big_h)
        art = big.resize((W, H), Image.Resampling.BOX)
        for folder in OUT:
            folder.mkdir(parents=True, exist_ok=True)
            art.save(folder / f"{name}.png", optimize=True)
        clipped = src.getbbox()
        print(name, "art bbox", art.getbbox(), "src bbox", clipped, "paste", (ox - o["dx"], oy - o["dy"]))


if __name__ == "__main__":
    main()
