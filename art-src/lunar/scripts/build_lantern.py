"""Hand-placed pixel redraw of the lunar lantern (12x28 x 2 frames), traced from the
Codex lantern raw (art-src/lunar/raw/lunar-lantern-v1.png) because a straight box
downscale to 12 px wide turned mushy. v2: shorter hook arm, small foot. v3 (resume pass):
the hanging-from-an-arm design still read as a gallows/bracket at 2x, so the lantern now sits
on top of a short centred post (toro-style); lamp centre ~19 art px above the base. Run from repo root:
    python art-src/lunar/scripts/build_lantern.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public" / "assets" / "lunar" / "lunar-lantern.png"

MAP = [
    "............",
    "............",
    ".....KK.....",
    "...KKTTKK...",
    "..KTTTTTTK..",
    "..KKKKKKKK..",
    "..OHPPPPpO..",
    ".OHHPPPPPpO.",
    ".OrrrrrrrRO.",
    "OHHPLLLPPPpO",
    "OHPLLLLPPPpO",
    ".OrrrrrrrRO.",
    ".OHPPPPPPpO.",
    "..OPPPPPpO..",
    "..KTTTTTTK..",
    "...KKKKKK...",
    "....KhwK....",
    "....KhwK....",
    "....KqqK....",
    "....KhwK....",
    "....KhwK....",
    "....KhwK....",
    "....KhwK....",
    "....KhwK....",
    "....KhwK....",
    "...KhhwwK...",
    "..KhhhwwwK..",
    "..KKKKKKKK..",
]

COMMON = {
    "K": "1D1F33",  # ink outline
    "h": "B98A5E",  # wood light (top-left)
    "w": "8A5A3C",  # wood shade
    "q": "ECDFC5",  # rope wrap
    "c": "3D3E4D",  # hanging cord
}
UNLIT = {
    "O": "2F3149",  # lantern outline
    "T": "A6614A",  # caps
    "t": "A6614A",
    "H": "ECDFC5",  # paper highlight
    "P": "CDBD9C",  # paper
    "L": "CDBD9C",
    "p": "A08E70",  # paper shade
    "r": "B09C7C",  # rib
    "R": "8C7A60",
}
LIT = {
    "O": "7A4017",  # warm outline when glowing
    "T": "C97B5A",
    "t": "E08A4B",
    "H": "FBF7EC",
    "P": "F7D9A8",
    "L": "FBF7EC",
    "p": "E08A4B",
    "r": "F2C49A",
    "R": "D4A055",
}
# soft ember halo for the lit frame: transparent cells hugging the paper body get ember pixels,
# alpha falling off with distance (computed from MAP so it always fits inside the 12x28 frame)
BODY = set("OHPLprR")
HALO_ALPHA = {1: 130, 2: 55}


def halo_cells() -> list[tuple[int, int, int]]:
    body = [(x, y) for y, row in enumerate(MAP) for x, ch in enumerate(row) if ch in BODY]
    cells = []
    for y, row in enumerate(MAP):
        for x, ch in enumerate(row):
            if ch != ".":
                continue
            d = min(max(abs(x - bx), abs(y - by)) for bx, by in body)
            if d in HALO_ALPHA:
                cells.append((x, y, HALO_ALPHA[d]))
    return cells


HALO = halo_cells()


def rgb(hex_: str) -> tuple[int, int, int]:
    return int(hex_[0:2], 16), int(hex_[2:4], 16), int(hex_[4:6], 16)


def frame(colors: dict[str, str], halo: bool) -> Image.Image:
    img = Image.new("RGBA", (12, 28), (0, 0, 0, 0))
    px = img.load()
    if halo:
        for x, y, a in HALO:
            px[x, y] = (*rgb("E08A4B"), a)
    for y, row in enumerate(MAP):
        assert len(row) == 12, (y, row)
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            px[x, y] = (*rgb(colors.get(ch) or COMMON[ch]), 255)
    return img


def main() -> None:
    strip = Image.new("RGBA", (24, 28), (0, 0, 0, 0))
    strip.alpha_composite(frame(UNLIT, False), (0, 0))
    strip.alpha_composite(frame(LIT, True), (12, 0))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    strip.save(OUT, optimize=True)
    print(f"wrote {OUT} {strip.size}")


if __name__ == "__main__":
    main()
