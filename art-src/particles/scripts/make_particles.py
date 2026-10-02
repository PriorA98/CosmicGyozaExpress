"""Build the final particle strips for Cosmic Gyoza Express (v2).

Base: Codex-authored glyph grids from make-particles.ps1 (v1, ported verbatim for the frames
that already read well). Claude replaced the weak frames (blocky thrust puffs, speckled fade-outs)
with round, top-left-lit lobe clouds rendered procedurally at art resolution, then snapped to
the CGE palette with a few crisp alpha levels.

Usage: python art-src/particles/scripts/make_particles.py <out_dir>
Writes thrust.png, dust.png, sparkle.png, steam.png, star.png into <out_dir>.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image

HEX = {
    "W": "FBF7EC", "Y": "FCE7A8", "P": "F4ECDC", "H": "F9F3E5", "D": "ECDFC5",
    "A": "D4A055", "E": "E08A4B", "T": "C97B5A", "R": "A6614A", "B": "C26954",
    "C": "9EB6C4", "L": "9B8FB8", "G": "B2A5AD",
    # in-between shades (Claude): warm taupe smoke and soft dusk shadow
    "K": "C9AE9B", "M": "A79BB0", "S": "C8D3D6",
    # r3 tail shades (Claude): warm desaturated cream -> lavender grey, all well above cosmos value
    "N": "E9E0E6", "V": "CFC4D8", "U": "B8ACC8", "O": "DCCFCB",
}
COL = {k: tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) for k, v in HEX.items()}

Lobe = tuple[float, float, float]  # cx, cy, r (art px, pixel centres at i+0.5)


def new_strip(fw: int, fh: int, n: int) -> Image.Image:
    return Image.new("RGBA", (fw * n, fh), (0, 0, 0, 0))


def glyph(img: Image.Image, fw: int, frame: int, x: int, y: int, pattern: str, alpha: int = 255) -> None:
    px = img.load()
    for r, row in enumerate(pattern.split("/")):
        for c, g in enumerate(row):
            if g == ".":
                continue
            lx, ly = x + c, y + r
            assert 0 <= lx < fw and 0 <= ly < img.height, (frame, lx, ly)
            px[frame * fw + lx, ly] = (*COL[g], alpha)


def cloud(img: Image.Image, fw: int, frame: int, lobes: list[Lobe], bands: str, alpha: int,
          core: list[Lobe] | None = None, core_band: str = "") -> None:
    """Union of round lobes lit from top-left. bands = hi, mid, shade[, deep] glyphs.

    v3 shading: each lobe gets a soft highlight disc offset toward the top-left; the shade band
    is the 1-2px rim facing lower-right (pixels whose lower-right neighbours fall outside the
    union), so clouds read as soft round puffs instead of faceted rocks.
    """
    px = img.load()
    h = img.height

    def inside(x: int, y: int) -> bool:
        cx, cy = x + 0.5, y + 0.5
        return any(math.hypot(cx - lx, cy - ly) <= r for (lx, ly, r) in lobes)

    for y in range(h):
        for x in range(fw):
            if not inside(x, y):
                continue
            cx, cy = x + 0.5, y + 0.5
            g = bands[1]
            mx, my, mr = lobes[0]  # highlight only on the main (first) lobe -> one clear light source
            if math.hypot(cx - (mx - 0.36 * mr), cy - (my - 0.36 * mr)) <= 0.52 * mr:
                g = bands[0]
            rim1 = not inside(x + 1, y + 1) or (not inside(x + 1, y) and not inside(x, y + 1))
            rim2 = not inside(x + 2, y + 2) or (not inside(x, y + 2) and not inside(x + 2, y))
            if rim1:
                g = bands[3] if len(bands) > 3 else bands[2]
            elif rim2:
                g = bands[2]
            if core and core_band:
                for (kx, ky, kr) in core:
                    if math.hypot(cx - kx, cy - ky) <= kr:
                        g = core_band
            assert 0 < x < fw - 1 and 0 < y < h - 1, ("gutter", frame, x, y)
            px[frame * fw + x, y] = (*COL[g], alpha)


def thrust() -> Image.Image:
    fw = 16
    s = new_strip(fw, 24, 8)
    # frames 1-3: Codex v1 flame glyphs (pointing down)
    glyph(s, fw, 0, 5, 2, "..AA../.AYYA./AYWWYE/AYWWYE/AYYYEE/.AYYE./.AEEE./..EE../..EE../..TT..")
    glyph(s, fw, 1, 4, 2, "..AAAA../.AYYYAE./AYWWYYEE/AYWWYYEE/AYWYYYEE/AYYYYEEE/.AYYYEE./.AYYEEE./"
                          ".AAYEET./..AEET../..AEET../...ET.../...TT...")
    glyph(s, fw, 2, 3, 3, "...AAAA.../..AYYYAE../.AYWYYYEE./.AYWYYEEE./AAYYYEEEET/AAYYYEEETT/.AYYEEEET./"
                          ".AAYEEETT./..AEEEET../..AEEETT../...EETT.../...EETT.../...ETT..../....TT..../"
                          "....TT..../....RR....")
    # frames 4-8: round detached puff -> warm smoke -> fade (Claude v2)
    cloud(s, fw, 3, [(8.0, 12.2, 4.6)], "EETR", 255,
          core=[(6.9, 10.9, 2.0)], core_band="A")
    cloud(s, fw, 3, [(6.9, 10.9, 1.25)], "YYYY", 255)
    cloud(s, fw, 4, [(8.0, 14.2, 4.3), (5.2, 15.2, 2.5), (10.9, 15.0, 2.5)], "ETRR", 255)
    # r3: tail cools into warm cream then pale lavender steam (no neutral/dark grey), alpha falls
    # gently so every tail pixel stays lighter than the cosmos sky and the puff fades out, not darker.
    cloud(s, fw, 5, [(7.8, 16.0, 4.2), (4.9, 17.4, 2.7), (10.8, 17.4, 3.0)], "HDOV", 245)
    cloud(s, fw, 6, [(7.6, 17.4, 4.0), (11.0, 18.4, 3.0), (4.4, 18.8, 2.4)], "HNVU", 220)
    cloud(s, fw, 7, [(6.4, 19.0, 2.2), (10.0, 19.6, 2.0)], "NNVV", 230)
    return s


def dust() -> Image.Image:
    fw = 16
    s = new_strip(fw, 16, 6)
    # frames 1-4: Codex v1 glyphs
    glyph(s, fw, 0, 5, 11, "..PP../.PPPD./PPDDDD/.DDDCC")
    glyph(s, fw, 1, 3, 9, "...PPP..../..PPPPD.../.PPPPDDD../PPPPDDDDC/PPDDDDDCC/.DDDDCCC.")
    glyph(s, fw, 2, 2, 7, "..PPP......./.PPPPD..PP../.PPPPDDPPPD./PPPPDDDDDDDC/PPDDDDDDDCCC/"
                          "DDDDDDDDCCCC/.DDDDDDCCCC./..DDDCCCCC..")
    glyph(s, fw, 3, 1, 5, "..PPP........./.PPPPD......../PPPPPPD..PPP../PPPPPPDDPPPPD./PPPPPDDDPPDDDC/"
                          "PPDDDDDDDDDCCC/DDDDDDDDDDDCCC/.DDDDDDDDCCCC./..DDDDDDCCCC../...DDDCCCCC...", 235)
    # frames 5-6: puff splits into drifting round clumps and fades (Claude v2)
    # r3: flour clumps stay cream / lavender-cream with high alpha (no grey ash on navy)
    cloud(s, fw, 4, [(4.0, 10.0, 2.7), (11.8, 9.2, 2.8), (8.0, 13.2, 1.8)], "HPDV", 240)
    cloud(s, fw, 5, [(4.0, 7.0, 2.0), (12.0, 6.0, 2.0), (8.0, 12.0, 1.5)], "HNNV", 230)
    return s


def sparkle() -> Image.Image:
    fw = 8
    s = new_strip(fw, 8, 4)
    glyph(s, fw, 0, 2, 2, ".A./AWA/.A.")
    glyph(s, fw, 1, 1, 1, "..A../.AYA./AYWYA/.AYA./..A..")
    glyph(s, fw, 2, 1, 1, "..AA../..YY../AYWWYA/AYWYYA/..YY../..AA..")
    glyph(s, fw, 3, 2, 2, ".Y./YWY/.Y.", 235)  # r3: pale butter fade, no brown cross on navy
    return s


def steam() -> Image.Image:
    fw = 12
    s = new_strip(fw, 20, 6)
    # frames 1-4: Codex v1 ribbon glyphs
    glyph(s, fw, 0, 4, 15, ".WW./WWWD/WWDC/.DC.", 245)
    glyph(s, fw, 1, 4, 11, "..WW./.WWWD/.WWDC/..WDC/..WDC/.WWC./.WDC.", 245)
    glyph(s, fw, 2, 3, 7, "..WW../.WWWD./.WWDC./..WDC./...WDC/...WDC/..WWC./.WWC../.WDC../..DC..", 240)
    glyph(s, fw, 3, 3, 3, "..WW../.WWWD./.WWDC./.WWC../..WDC./...WDC/...WDC/..WWC./.WWC../.WDC../"
                          ".WDC../..DC..", 235)
    # frames 5-6: wisp thins, top curl detaches and drifts up, then dissolves (Claude v2)
    glyph(s, fw, 4, 3, 1, "..WW../.WWWD./.WWDC./..DC../....../...WD./...WDC/...WDC/..WDC./..DC..", 230)
    glyph(s, fw, 5, 4, 1, ".WW./WWWN/.WNV/..../..../.WN./..NV", 185)
    return s


def star() -> Image.Image:
    fw = 5
    s = new_strip(fw, 5, 3)
    glyph(s, fw, 0, 1, 1, ".C./C.C/.C.", 120)
    glyph(s, fw, 0, 2, 2, "W")
    glyph(s, fw, 1, 1, 1, ".W./WYW/.W.")
    glyph(s, fw, 2, 0, 0, "..C../...../C...C/...../..C..", 140)
    glyph(s, fw, 2, 1, 1, ".P./PWP/.P.")
    return s


def main() -> None:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for name, fn in [("thrust", thrust), ("dust", dust), ("sparkle", sparkle), ("steam", steam), ("star", star)]:
        img = fn()
        img.save(out / f"{name}.png", optimize=True)
        print(f"wrote {out / (name + '.png')} {img.size}")


if __name__ == "__main__":
    main()
