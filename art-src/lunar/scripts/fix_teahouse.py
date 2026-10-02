"""Remove the baked steam wisp above the teahouse chimney (dev tooling; Pillow).

Wave 3 round 3 (2026-10-02): the runtime steam emitter owns the steam, so the static cream squiggle
baked by the v1 normalization (rows 0-11, x 80-93, an island separated from the chimney by the empty
row 12) is cleared to transparent. Source of truth for the pre-fix file: work/lunar-teahouse-w2.png
(identical to `build_props.py teahouse v1` output). Idempotent.

Chimney mouth (art px, image 96x80, origin top-left): rim spans x 77..88 on rows 13..16, mouth top row 13,
mouth centre x 82.5 -> +34.5 art px right of the image centre (48), 67 art px above the bottom row edge.

Run from the repo root:  python art-src/lunar/scripts/fix_teahouse.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "art-src" / "lunar" / "work" / "lunar-teahouse-w2.png"
OUT = ROOT / "public" / "assets" / "lunar" / "lunar-teahouse.png"
WISP = (78, 0, 96, 12)  # x0, y0, x1, y1 (exclusive)


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    px = img.load()
    x0, y0, x1, y1 = WISP
    cleared = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            if px[x, y][3]:
                cleared += 1
            px[x, y] = (0, 0, 0, 0)
    # guard: nothing else above the chimney rim in that column band
    assert all(px[x, 12][3] == 0 for x in range(x0, x1))
    img.save(OUT, optimize=True)
    print(f"cleared {cleared} wisp px -> {OUT}")


if __name__ == "__main__":
    main()
