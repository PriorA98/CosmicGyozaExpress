"""Hand-placed pixel lantern for the Tea Moon landing pad (12x28 x 2 frames: 0 dim, 1 lit).

History: v1 box downscale of the Codex raw (art-src/lunar/raw/lunar-lantern-v1.png) was mushy; v2 hung
from an arm (read as a gallows); v3 (wave 1 final) sat a 12 px wide paper lamp on a centred post.
v4 (wave 2, this file): richer chochin-style lamp traced from the same raw's colours:
  - body narrowed to 10 px so the lit frame has room for a 1 px warm glow frame on every side,
  - three paper ribs with a light catch pixel on the left and a shaded end on the right,
  - tiny brick-red emblem dot on the paper, finial knob and a rope tassel under the bottom cap,
  - lit frame: light core top-left of centre, amber/ember shading to the outline, a glow frame
    (peach F7C27E alpha 190, 1 px; a 2 px ember ring was tried and read muddy brown on the dark sky) around the paper, and warm light spilling onto the post top
    and the stone foot.
  - post: wood with rope wrap, set into a small two-tone stone foot on the bottom row.
Lamp centre stays ~19 art px above the base (landingScenery lampHeightPx: 38 screen px at x2).
Run from repo root:  python art-src/lunar/scripts/build_lantern.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public" / "assets" / "lunar" / "lunar-lantern.png"

MAP = [
    "............",  # 0
    ".....KK.....",  # 1 finial knob
    ".....Kk.....",  # 2
    "...KKTTKK...",  # 3 roof cap
    "..KTTTTTtK..",  # 4
    "..KKKKKKKK..",  # 5 cap rim
    "..OHHPPPpO..",  # 6 paper top
    ".OHrrrrrrRO.",  # 7 rib
    ".OHPLLPPPpO.",  # 8
    ".OHLLLbPPpO.",  # 9 emblem
    ".OHrrrrrrRO.",  # 10 rib
    ".OHPLPPPPpO.",  # 11
    ".OHPPPPPppO.",  # 12
    ".OHrrrrrrRO.",  # 13 rib
    "..OPPPPPpO..",  # 14
    "..KTTTTTtK..",  # 15 bottom cap
    "...KKKKKK...",  # 16
    "....KhwK....",  # 17 post top (catches spill light)
    "....KqqK....",  # 18 rope wrap
    "....KhwK....",  # 19
    "....KhwK....",  # 20
    "....KhwK....",  # 21
    "....KhwK....",  # 22
    "....KhwK....",  # 23
    "....KhwK....",  # 24
    "...KshhzK...",  # 25 stone foot
    "..KssssszK..",  # 26
    "..KKKKKKKK..",  # 27 base row (bottom anchor)
]

COMMON = {
    "K": "1D1F33",  # ink outline
    "h": "B98A5E",  # wood light (top-left)
    "w": "8A5A3C",  # wood shade
    "q": "ECDFC5",  # rope wrap
    "b": "C26954",  # brick emblem
}
UNLIT = {
    "O": "2F3149",  # lamp outline (ink-soft)
    "T": "A6614A",  # caps
    "t": "7E4A3A",  # cap shade
    "k": "A6614A",  # finial
    "H": "ECDFC5",  # paper highlight edge
    "P": "CDBD9C",  # paper
    "L": "D9CBAD",  # paper (slightly lighter centre-left)
    "p": "A08E70",  # paper shade
    "r": "9E8C6E",  # rib
    "R": "7C6C56",  # rib shaded end
    "s": "6E7180",  # stone
    "z": "4A4C5C",  # stone shade
}
LIT = {
    "O": "7A4017",  # warm outline when glowing
    "T": "C97B5A",
    "t": "A6614A",
    "k": "E08A4B",
    "H": "FBF7EC",
    "P": "F7D9A8",
    "L": "FFF6E2",  # light core
    "p": "E08A4B",
    "r": "E8B27E",
    "R": "C47A3E",
    "s": "8C8580",  # stone warmed by the spill
    "z": "5C5660",
}
# extra warm spill on the lit frame: (x, y) -> colour override
LIT_SPILL = {
    (5, 17): "D9A86E",
    (6, 17): "A87048",
    (4, 25): "1D1F33",
    (5, 25): "D4A055",
    (6, 25): "C9925A",
}
BODY = set("OHPLprRb")
HALO = {1: ("F7C27E", 190)}  # light peach inner ring so it reads as glow on the dark sky
HALO_ROWS = range(2, 18)  # glow frame hugs the cap + paper + bottom cap, not the post


def halo_cells() -> list[tuple[int, int, int]]:  # (x, y, distance)
    body = [(x, y) for y, row in enumerate(MAP) for x, ch in enumerate(row) if ch in BODY]
    cells = []
    for y in HALO_ROWS:
        for x, ch in enumerate(MAP[y]):
            if ch != ".":
                continue
            d = min(max(abs(x - bx), abs(y - by)) for bx, by in body)
            if d in HALO:
                cells.append((x, y, d))
    return cells


def rgb(hex_: str) -> tuple[int, int, int]:
    return int(hex_[0:2], 16), int(hex_[2:4], 16), int(hex_[4:6], 16)


def frame(colors: dict[str, str], lit: bool) -> Image.Image:
    img = Image.new("RGBA", (12, 28), (0, 0, 0, 0))
    px = img.load()
    if lit:
        for x, y, d in halo_cells():
            c, a = HALO[d]
            px[x, y] = (*rgb(c), a)
    for y, row in enumerate(MAP):
        assert len(row) == 12, (y, row)
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            px[x, y] = (*rgb(colors.get(ch) or COMMON[ch]), 255)
    if lit:
        for (x, y), c in LIT_SPILL.items():
            px[x, y] = (*rgb(c), 255)
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
