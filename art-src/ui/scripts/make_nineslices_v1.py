"""Author the UI nine-slice textures for Cosmic Gyoza Express at exact art resolution.

Dev tooling only (Python 3.10+, Pillow). Writes:
  public/assets/ui/panel-parchment.png  48x48, 8px insets
  public/assets/ui/panel-dark.png       48x48, 8px insets (soft alpha)
  public/assets/ui/button.png           144x24 (3 x 48x24), 6px insets
  public/assets/ui/keycap.png           32x16  (2 x 16x16), 4px insets

Nine-slice rule followed everywhere: Phaser stretches edges along one axis and the
centre along both, so edge bands are constant along their stretch axis and the
centre is flat. All ornament (stitches, rivets, grain flecks) lives inside the corners.

Usage: python art-src/ui/scripts/make_nineslices.py [out_dir]
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

RGBA = tuple[int, int, int, int]


def hexa(value: str, alpha: int = 255) -> RGBA:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha)


def blend(a: str, b: str, t: float, alpha: int = 255) -> RGBA:
    ca, cb = hexa(a), hexa(b)
    return (
        round(ca[0] + (cb[0] - ca[0]) * t),
        round(ca[1] + (cb[1] - ca[1]) * t),
        round(ca[2] + (cb[2] - ca[2]) * t),
        alpha,
    )


CLEAR: RGBA = (0, 0, 0, 0)
INK = "#1D1F33"


def corner_cut(x: int, y: int, w: int, h: int, radius: int) -> int:
    """Distance-based pixel rounding. Returns 0 outside, 1 on the outline ring, 2 inside."""
    # Map to the nearest corner frame.
    cx = x if x < w / 2 else w - 1 - x
    cy = y if y < h / 2 else h - 1 - y
    if radius == 0 or cx >= radius or cy >= radius:
        return 2 if (cx > 0 and cy > 0) else 1
    # Simple stepped pixel rounding tables.
    tables = {
        1: [[0]],
        2: [[0, 1], [1, 2]],
        3: [[0, 0, 1], [0, 1, 2], [1, 2, 2]],
        4: [[0, 0, 0, 1], [0, 0, 1, 2], [0, 1, 2, 2], [1, 2, 2, 2]],
    }
    if radius == 1:
        return 0 if (cx == 0 and cy == 0) else (1 if cx == 0 or cy == 0 else 2)
    value = tables[radius][cy][cx]
    if value == 2 and (cx == 0 or cy == 0):
        return 1
    return value


def mirror_corner(img: Image.Image, pixels: dict[tuple[int, int], RGBA]) -> None:
    """Place a top-left corner ornament into all four corners (mirrored)."""
    w, h = img.size
    for (x, y), colour in pixels.items():
        for px, py in ((x, y), (w - 1 - x, y), (x, h - 1 - y), (w - 1 - x, h - 1 - y)):
            img.putpixel((px, py), colour)


# --------------------------------------------------------------------------- parchment
def panel_parchment() -> Image.Image:
    size = 48
    img = Image.new("RGBA", (size, size), CLEAR)
    fill = hexa("#F9F3E5")
    border = hexa("#D7CDB5")
    border_dark = hexa("#B9AB8B")
    highlight = hexa("#FDFAF2")
    inner_shade = hexa("#F1E7D3")
    for y in range(size):
        for x in range(size):
            kind = corner_cut(x, y, size, size, 3)
            if kind == 0:
                continue
            if kind == 1:
                img.putpixel((x, y), border)
                continue
            img.putpixel((x, y), fill)
    # 2px bottom edge: darker outer line, warm border line above it.
    for x in range(size):
        if img.getpixel((x, size - 1))[3]:
            img.putpixel((x, size - 1), border_dark)
        if img.getpixel((x, size - 2)) == fill:
            img.putpixel((x, size - 2), border)
    # Bottom rounding pixels pick up the dark edge too.
    for (x, y) in ((1, size - 2), (size - 2, size - 2), (2, size - 2), (size - 3, size - 2)):
        if img.getpixel((x, y)) == border:
            img.putpixel((x, y), border_dark)
    # Soft paper bevel: lit top/left inner line, warm shade on bottom/right inner line.
    for i in range(3, size - 3):
        img.putpixel((i, 1), highlight)
        img.putpixel((1, i), highlight)
        img.putpixel((i, size - 3), inner_shade)
        img.putpixel((size - 2, i), inner_shade)
    img.putpixel((2, 2), highlight)
    img.putpixel((size - 3, size - 4), inner_shade)
    # Corner stitches (terracotta thread, dashed L) + faint paper flecks, corner-only.
    thread = blend("#C97B5A", "#F9F3E5", 0.35)
    thread_soft = blend("#C97B5A", "#F9F3E5", 0.6)
    fleck = hexa("#EFE5D0")
    ornament_tl = {
        (3, 3): thread,
        (4, 3): thread_soft,
        (3, 4): thread_soft,
        (6, 3): thread,
        (3, 6): thread,
        (5, 5): fleck,
    }
    # Top corners use the TL ornament; bottom corners are mirrored, but the bottom
    # edge is 2px thick so shift the bottom ornament up by one pixel.
    for (x, y), colour in ornament_tl.items():
        img.putpixel((x, y), colour)
        img.putpixel((size - 1 - x, y), colour)
        img.putpixel((x, size - 2 - y), colour)
        img.putpixel((size - 1 - x, size - 2 - y), colour)
    return img


# --------------------------------------------------------------------------- dark HUD
def panel_dark() -> Image.Image:
    size = 48
    img = Image.new("RGBA", (size, size), CLEAR)
    fill = hexa("#14162B", 217)  # ~85%
    # Plaster border at ~20% composited over the panel fill, slightly more opaque.
    border = blend("#14162B", "#FBF7EC", 0.20, 224)
    top_glint = blend("#14162B", "#FBF7EC", 0.07, 219)
    for y in range(size):
        for x in range(size):
            kind = corner_cut(x, y, size, size, 4)
            if kind == 0:
                continue
            img.putpixel((x, y), border if kind == 1 else fill)
    # Faint inner glint on the top edge (light from top-left).
    for x in range(4, size - 4):
        img.putpixel((x, 1), top_glint)
    for y in range(4, size - 4):
        img.putpixel((1, y), blend("#14162B", "#FBF7EC", 0.04, 218))
    # Tiny rivets in each corner: lit top-left pixel, body, dark bottom-right.
    rivet = {
        (4, 4): blend("#14162B", "#FBF7EC", 0.42, 235),
        (5, 4): blend("#14162B", "#9EB6C4", 0.30, 230),
        (4, 5): blend("#14162B", "#9EB6C4", 0.30, 230),
        (5, 5): hexa("#0E0F1C", 235),
    }
    mirror_corner(img, rivet)
    return img


# --------------------------------------------------------------------------- button
def button_frame(face_hex: str, face_light_hex: str, face_dark_hex: str, pressed: bool) -> Image.Image:
    w, h = 48, 24
    img = Image.new("RGBA", (w, h), CLEAR)
    ink = hexa(INK)
    shift = 2 if pressed else 0
    shadow_rows = 1 if pressed else 3
    body_top = shift
    body_bottom = h - 1 - shadow_rows  # inclusive last row of the bordered body
    # Hard ink shadow under the body (square corners, inset 1px so the body edge reads).
    for y in range(body_bottom + 1, h):
        for x in range(1, w - 1):
            img.putpixel((x, y), ink)
    for y in range(body_top, body_bottom + 1):
        for x in range(w):
            # 1px notched corners on the outer ink border, otherwise square.
            if (y == body_top or y == body_bottom) and (x == 0 or x == w - 1):
                continue
            on_border = x < 2 or x > w - 3 or y < body_top + 2 or y > body_bottom - 2
            img.putpixel((x, y), ink if on_border else hexa(face_hex))
    # Notch fill: inner corner pixel of the 2px border keeps the shape chunky.
    face_top = body_top + 2
    face_bottom = body_bottom - 2
    # Bevel: lit top row + left column, darker bottom 2 rows + right column.
    light = hexa(face_light_hex)
    dark = hexa(face_dark_hex)
    for x in range(2, w - 2):
        img.putpixel((x, face_top), light)
        img.putpixel((x, face_bottom), dark)
        if not pressed:
            img.putpixel((x, face_bottom - 1), blend(face_hex, face_dark_hex, 0.5))
    for y in range(face_top, face_bottom + 1):
        img.putpixel((2, y), light if y < face_bottom else dark)
        img.putpixel((w - 3, y), dark if y > face_top else light)
    # Little specular glint in the top-left corner (corner-only, so it never stretches).
    glint = hexa("#F4CDB0") if not pressed else light
    img.putpixel((3, face_top + 1), glint)
    img.putpixel((4, face_top + 1), blend(face_light_hex, face_hex, 0.4))
    img.putpixel((3, face_top + 2), blend(face_light_hex, face_hex, 0.4))
    return img


def button_strip() -> Image.Image:
    normal = button_frame("#C97B5A", "#DE9F7F", "#A6614A", pressed=False)
    hover = button_frame("#D98C62", "#EDB48E", "#B56D4D", pressed=False)
    pressed = button_frame("#B86E50", "#C97B5A", "#97573F", pressed=True)
    strip = Image.new("RGBA", (144, 24), CLEAR)
    for i, frame in enumerate((normal, hover, pressed)):
        strip.paste(frame, (i * 48, 0))
    return strip


# --------------------------------------------------------------------------- keycap
def keycap_frame(pressed: bool) -> Image.Image:
    s = 16
    img = Image.new("RGBA", (s, s), CLEAR)
    ink = hexa(INK)
    face = hexa("#FBF7EC")
    face_hi = hexa("#FFFDF7")
    face_lo = hexa("#EFE6D3")
    side = hexa("#D7CDB5")
    side_dark = hexa("#B9AB8B")
    top = 2 if pressed else 0
    # Rows (up):      0 ink | 1 highlight | 2..10 face | 11 face_lo | 12 side | 13 side_dark | 14..15 ink
    # Rows (pressed): 0..1 clear | 2 ink | 3 highlight | 4..11 face | 12 face_lo | 13 side_dark | 14..15 ink
    rows: list[RGBA | str] = []
    rows.append("ink")
    rows.append(face_hi)
    face_rows = 9 if not pressed else 8
    rows.extend([face] * face_rows)
    rows.append(face_lo)
    if not pressed:
        rows.append(side)
    rows.append(side_dark)
    rows.extend(["ink", "ink"])
    for i, row in enumerate(rows):
        y = top + i
        for x in range(s):
            last = y == s - 1
            corner = (x in (0, s - 1)) and (i == 0 or last)
            if corner:
                continue
            if row == "ink" or x == 0 or x == s - 1:
                img.putpixel((x, y), ink)
            else:
                assert not isinstance(row, str)
                colour = row
                if colour in (face, face_hi) and x == 1:
                    colour = face_hi
                if colour == face and x == s - 2:
                    colour = face_lo
                img.putpixel((x, y), colour)
    return img


def keycap_strip() -> Image.Image:
    strip = Image.new("RGBA", (32, 16), CLEAR)
    strip.paste(keycap_frame(False), (0, 0))
    strip.paste(keycap_frame(True), (16, 0))
    return strip


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "public/assets/ui")
    out.mkdir(parents=True, exist_ok=True)
    panel_parchment().save(out / "panel-parchment.png", optimize=True)
    panel_dark().save(out / "panel-dark.png", optimize=True)
    button_strip().save(out / "button.png", optimize=True)
    keycap_strip().save(out / "keycap.png", optimize=True)
    print(f"wrote nine-slices to {out}")


if __name__ == "__main__":
    main()
