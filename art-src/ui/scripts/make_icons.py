"""Author the `ui-icons` strip (16 frames x 16x16 = 256x16) for Cosmic Gyoza Express.

Dev tooling only (Python 3.10+, Pillow). Each glyph is authored as a FILL map (16 rows x 16
chars). A 1px ink (#1D1F33) outline is then added automatically around every filled region
(4-neighbour, which gives the chunky rounded corners), so silhouettes always read on both
dark and parchment backgrounds. Explicit 'k' in a map is interior ink detail.

Alpha is strictly 0 or 255; no anti-aliasing.

Usage: python art-src/ui/scripts/make_icons.py [out_png] [preview_png]
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image

RGBA = tuple[int, int, int, int]


def hexa(value: str) -> RGBA:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)


INK = hexa("#1D1F33")
PALETTE: dict[str, RGBA] = {
    "k": INK,
    "P": hexa("#FBF7EC"),  # plaster
    "W": hexa("#F9F3E5"),  # parchment-warm
    "p": hexa("#F4ECDC"),  # parchment
    "d": hexa("#E3D5B8"),  # parchment-deep (pushed a step darker so it reads at 16px)
    "D": hexa("#C9B995"),  # parchment shadow
    "E": hexa("#A8976F"),  # parchment deep shadow
    "t": hexa("#C97B5A"),  # terracotta
    "T": hexa("#A6614A"),  # terracotta-deep
    "e": hexa("#E08A4B"),  # ember
    "a": hexa("#D4A055"),  # amber
    "A": hexa("#EBC27A"),  # light amber
    "Y": hexa("#F6DEA6"),  # pale amber core
    "o": hexa("#B5823F"),  # amber shade
    "g": hexa("#8DA17A"),  # sage
    "G": hexa("#6B7E5A"),  # sage-deep
    "b": hexa("#9EB6C4"),  # dusk-blue
    "B": hexa("#7F98A8"),  # dusk-blue shade
    "c": hexa("#C6D6DE"),  # dusk-blue light
    "q": hexa("#6FA39A"),  # teal
    "Q": hexa("#55857D"),  # teal deep
    "h": hexa("#93C1B6"),  # teal light
    "r": hexa("#C26954"),  # brick
    "R": hexa("#9E4F3E"),  # brick deep
}

Grid = list[list[str]]


def blank() -> Grid:
    return [["." for _ in range(16)] for _ in range(16)]


def from_rows(rows: list[str]) -> Grid:
    assert len(rows) == 16, f"need 16 rows, got {len(rows)}"
    for i, row in enumerate(rows):
        assert len(row) == 16, f"row {i} has {len(row)} chars: {row!r}"
    return [list(row) for row in rows]


def pad(rows: list[str], top: int) -> list[str]:
    """Place partial rows at a vertical offset inside a 16-row frame."""
    out = ["................"] * top + rows
    out += ["................"] * (16 - len(out))
    return out


# --------------------------------------------------------------------------- hand maps

THRUST = pad([
    "........e.......",
    ".......ee.......",
    ".......eae......",
    "......eaae......",
    "......eAaae.....",
    ".....eaYAae.....",
    ".....eAYYae.....",
    "....eaAYYAae....",
    "....eaAYYAae....",
    "....reaAAaer....",
    ".....rreerr.....",
], 3)

PACKAGE = pad([
    "....tt....tt....",
    "....tet..tet....",
    ".....tettet.....",
    "......tTTt......",
    "....ttTTTTtt....",
    "...tePttttPtT...",
    "...etPtttPttT...",
    "...tttPttttPT...",
    "...tPtttttPTT...",
    "....TTTTTTTT....",
], 3)

DRIFT = pad([
    "..........cc....",
    "...cbbbbbb..b...",
    "..........bB....",
    "................",
    ".....cbbbbbbbB..",
    "................",
    "...cbbbbbb..B...",
    "..........bB....",
], 4)

INCIDENT = pad([
    ".......ee.......",
    "...e...ee...r...",
    "....eeeaaeer....",
    "....eaaAAaar....",
    "...eeaAYYAarr...",
    "...eeaAYYAarr...",
    "....eaaAAaar....",
    "....errarrrr....",
    "...e...rr...r...",
    ".......rr.......",
], 3)

MEMORY = pad([
    ".......YA.......",
    "......aYAa......",
    "......aYAa......",
    "...aAAAYAaaaa...",
    "....aAAAaaao....",
    ".....aAaaao.....",
    ".....aaaaoo.....",
    "....aaao.aoo....",
    "....aao...oo....",
], 3)

TEA = pad([
    "......c..c......",
    ".......c..c.....",
    "......c..c......",
    "................",
    "...WWWWWWWW.....",
    "...hqqqqqqQqq...",
    "...hqqqqqqQ..q..",
    "....hqqqqQQ.q...",
    ".....QQQQQ......",
    "....dddddddd....",
], 3)

PAUSE = pad([
    "....PPp..PPp....",
    "....Ppd..Ppd....",
    "....Ppd..Ppd....",
    "....Ppd..Ppd....",
    "....Ppd..Ppd....",
    "....Ppd..Ppd....",
    "....Ppd..Ppd....",
    "....Ppd..Ppd....",
    "....Ppd..Ppd....",
    "....ddd..ddd....",
], 3)

HOME = pad([
    ".......tt.TT....",
    "......tetTTT....",
    ".....tetttTT....",
    "....tettttttT...",
    "...TTTTTTTTTTT..",
    "....WWWWWWWWd...",
    "....WbbWWaaWd...",
    "....WbbWWaAWd...",
    "....pppppaapd...",
], 3)

SPEAKER_BODY = [
    ".......P........",
    "......PP........",
    ".....PPp........",
    "...PPPpp........",
    "...Pppppp.......",
    "...ppppd........",
    "...dddpd........",
    ".....ddd........",
    "......dd........",
    ".......d........",
]

SOUND_ON = pad([
    ".......P....a...",
    "......PP.....a..",
    ".....PPp..a..a..",
    "...PPPpp...a..a.",
    "...Pppppp..a..a.",
    "...ppppd...a..a.",
    "...dddpd..o..o..",
    ".....ddd.....o..",
    "......dd....o...",
    ".......d........",
], 3)

SOUND_OFF = pad([
    ".......P........",
    "......PP........",
    ".....PPp........",
    "...PPPpp.r..r...",
    "...Pppppp.rr....",
    "...ppppd..rr....",
    "...dddpd.R..R...",
    ".....ddd........",
    "......dd........",
    ".......d........",
], 3)

KEYBOARD = pad([
    "...pppppppppp...",
    "...pPDPDPDPDE...",
    "...DDDDDDDDDE...",
    "...DPDPDPDPDE...",
    "...DDDDDDDDDE...",
    "...DDPPPPPPDE...",
    "...EEEEEEEEEE...",
], 4)

TOUCH = pad([
    "..........A.....",
    ".....PP.........",
    ".....Pp.....A...",
    ".....Pp.........",
    ".....PpDPpDPd...",
    "...PPPpDPpDPd...",
    "...PppppppppD...",
    "....ppppppppD...",
    "....ppppppdD....",
    ".....dddddD.....",
], 3)


# --------------------------------------------------------------------------- procedural maps

def dist(x: int, y: int, cx: float, cy: float) -> float:
    return math.hypot(x + 0.5 - cx, y + 0.5 - cy)


def radar() -> Grid:
    g = blank()
    for y in range(16):
        for x in range(16):
            d = dist(x, y, 8, 8)
            if d < 5.0:
                g[y][x] = "Q"
                if 2.4 < d < 3.4:
                    g[y][x] = "q"
                # top-left rim light, bottom-right rim shade
                if d > 4.0 and (x + y) < 13:
                    g[y][x] = "q"
    for x, y in ((7, 7), (8, 7), (7, 8), (8, 8)):
        g[y][x] = "P"
    for x, y in ((9, 6), (10, 5), (11, 4)):
        g[y][x] = "h"
    g[6][9] = "P"
    g[9][5] = "A"
    g[10][5] = "a"
    return g


def speed() -> Grid:
    g = blank()
    cx, cy = 8.0, 11.0
    for y in range(16):
        for x in range(16):
            d = dist(x, y, cx, cy)
            if y <= 10 and d < 5.4:
                g[y][x] = "W"
                if d > 4.3:
                    # coloured arc: sage -> amber -> brick, left to right
                    if x <= 4:
                        g[y][x] = "g"
                    elif x <= 10:
                        g[y][x] = "a"
                    else:
                        g[y][x] = "r"
    for x in range(3, 13):
        g[11][x] = "d"
    # needle from hub toward upper-right
    for x, y in ((7, 10), (8, 10), (8, 9), (9, 8), (10, 7)):
        g[y][x] = "k"
    g[10][7] = "T"
    g[10][8] = "T"
    return g


def moon() -> Grid:
    g = blank()
    for y in range(16):
        for x in range(16):
            outer = dist(x, y, 8, 8) < 5.1
            bite = dist(x, y, 10.6, 6.6) < 4.3
            if outer and not bite:
                d = dist(x, y, 8, 8)
                g[y][x] = "P" if (x + y) < 12 else ("p" if d < 4.2 else "d")
    g[9][5] = "d"
    g[10][6] = "d"
    return g


def settings() -> Grid:
    g = blank()
    for y in range(16):
        for x in range(16):
            dx, dy = x + 0.5 - 8, y + 0.5 - 8
            d = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            # 8 teeth: angular square wave
            tooth = math.cos(ang * 8) > 0.15
            r_out = 5.1 if tooth else 3.9
            if d < r_out and d >= 1.6:
                light = (x + y) < 14
                if d > 3.6 and tooth:
                    g[y][x] = "A" if light else "o"
                else:
                    g[y][x] = "A" if (light and d > 2.9) else ("a" if light or d < 2.9 else "o")
    return g


# --------------------------------------------------------------------------- assembly

ORDER: list[tuple[str, Grid]] = [
    ("thrust", from_rows(THRUST)),
    ("package", from_rows(PACKAGE)),
    ("radar", radar()),
    ("speed", speed()),
    ("drift", from_rows(DRIFT)),
    ("incident", from_rows(INCIDENT)),
    ("memory", from_rows(MEMORY)),
    ("moon", moon()),
    ("tea", from_rows(TEA)),
    ("pause", from_rows(PAUSE)),
    ("settings", settings()),
    ("home", from_rows(HOME)),
    ("sound-on", from_rows(SOUND_ON)),
    ("sound-off", from_rows(SOUND_OFF)),
    ("keyboard", from_rows(KEYBOARD)),
    ("touch", from_rows(TOUCH)),
]


def outline(g: Grid) -> Grid:
    out = [row[:] for row in g]
    for y in range(16):
        for x in range(16):
            if g[y][x] != ".":
                continue
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < 16 and 0 <= ny < 16 and g[ny][nx] not in (".", "k"):
                    out[y][x] = "k"
                    break
    return out


def render(g: Grid) -> Image.Image:
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            ch = g[y][x]
            if ch != ".":
                img.putpixel((x, y), PALETTE[ch])
    return img


def build() -> Image.Image:
    strip = Image.new("RGBA", (256, 16), (0, 0, 0, 0))
    for i, (_, grid) in enumerate(ORDER):
        strip.paste(render(outline(grid)), (i * 16, 0))
    return strip


def preview(strip: Image.Image, scale: int = 6) -> Image.Image:
    w, h = strip.size
    big = strip.resize((w * scale, h * scale), Image.NEAREST)
    pad_px = 4 * scale
    canvas = Image.new("RGBA", (w * scale + pad_px * 2, (h * scale + pad_px * 2) * 2), (0, 0, 0, 255))
    top = Image.new("RGBA", (canvas.width, canvas.height // 2), hexa("#1A1B2E"))
    bot = Image.new("RGBA", (canvas.width, canvas.height // 2), hexa("#F4ECDC"))
    canvas.paste(top, (0, 0))
    canvas.paste(bot, (0, canvas.height // 2))
    canvas.alpha_composite(big, (pad_px, pad_px))
    canvas.alpha_composite(big, (pad_px, canvas.height // 2 + pad_px))
    return canvas


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "public/assets/ui/icons.png")
    prev = Path(sys.argv[2] if len(sys.argv) > 2 else "art-src/ui/previews/icons.preview.png")
    strip = build()
    out.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out, optimize=True)
    prev.parent.mkdir(parents=True, exist_ok=True)
    preview(strip).save(prev)
    print(f"wrote {out} {strip.size} and {prev}")


if __name__ == "__main__":
    main()
