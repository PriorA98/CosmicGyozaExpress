"""Clean a stray dark block sitting on the crest of lunar-hills-far.png (dev tooling; Pillow).

The v1 strip normalization left a 3x4 near-ink block (60,58,81) poking above the crest at
x=32..34, y=36..39 (a leftover of the raw's dark edge after chroma keying). It is cleared to
transparent so the crest continues from row 40. Idempotent. Run from repo root:
    python art-src/lunar/scripts/fix_hills.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
PATH = ROOT / "public" / "assets" / "lunar" / "lunar-hills-far.png"
SPECK = (32, 36, 35, 40)  # x0, y0, x1, y1 (exclusive)


def main() -> None:
    img = Image.open(PATH).convert("RGBA")
    px = img.load()
    x0, y0, x1, y1 = SPECK
    for y in range(y0, y1):
        for x in range(x0, x1):
            px[x, y] = (0, 0, 0, 0)
    img.save(PATH, optimize=True)
    print(f"cleared {(x1 - x0) * (y1 - y0)} px")


if __name__ == "__main__":
    main()
