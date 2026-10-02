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
# v2 (wave 2): the old button used a 2px ink border plus a 3-5 row pure-ink lip, which vanished
# on the cosmos background (#1A1B2E) so the button lost its depth there. Now a single 1px ink
# OUTER outline wraps the whole silhouette (face + lip, chunky 2px-rounded corners) and the lip
# is a coloured terracotta slab side, so depth reads on dark backgrounds and the outline frames
# it on parchment. Insets unchanged: 6px all round (all ornament lives inside the 6px corners).
def _rounded_outline_mask(w: int, h: int, top: int) -> list[list[int]]:
    """0 = clear, 1 = ink outline, 2 = inside, for a box from row `top` to h-1 with 2px corners."""
    mask = [[0] * w for _ in range(h)]
    for y in range(top, h):
        for x in range(w):
            cx = min(x, w - 1 - x)
            cy = min(y - top, h - 1 - y)
            if cx == 0 and cy == 0 or (cx == 0 and cy == 1) or (cx == 1 and cy == 0):
                continue  # clipped corner
            outer = cx == 0 or cy == 0 or (cx == 1 and cy == 1)
            mask[y][x] = 1 if outer else 2
    return mask


def button_frame(face_hex: str, light_hex: str, shade_hex: str, side_hex: str, side_dark_hex: str,
                 pressed: bool) -> Image.Image:
    w, h = 48, 24
    sink = 2 if pressed else 0
    img = Image.new("RGBA", (w, h), CLEAR)
    mask = _rounded_outline_mask(w, h, sink)
    ink = hexa(INK)
    face, light, shade = hexa(face_hex), hexa(light_hex), hexa(shade_hex)
    side, side_dark = hexa(side_hex), hexa(side_dark_hex)
    face_top = sink + 1
    face_bottom = 18 + sink  # last face row (bevel shade row); idle 18, pressed 20
    for y in range(h):
        for x in range(w):
            m = mask[y][x]
            if m == 0:
                continue
            if m == 1:
                img.putpixel((x, y), ink)
                continue
            if y < face_top:
                continue
            if y <= face_bottom:
                colour = face
                if y == face_top or x == 1:
                    colour = light
                if y == face_bottom or x == w - 2:
                    colour = shade
                if y == face_top and x == w - 2:
                    colour = face
                if x == 1 and y == face_bottom:
                    colour = shade
            else:
                # slab side below the face: side tone, darker last row
                colour = side_dark if y == h - 2 else side
            img.putpixel((x, y), colour)
    # corner-only specular glint (top-left, inside the 6px corner)
    glint = blend(light_hex, "#FBF7EC", 0.55)
    img.putpixel((2, face_top + 1), glint)
    img.putpixel((3, face_top + 1), light)
    img.putpixel((2, face_top + 2), light)
    return img


def button_strip() -> Image.Image:
    normal = button_frame("#C97B5A", "#DE9F7F", "#B66C4E", "#8C503E", "#6E3D30", pressed=False)
    hover = button_frame("#D98C62", "#EDB48E", "#C47A52", "#985843", "#784334", pressed=False)
    pressed = button_frame("#BB7052", "#CD8463", "#A8634B", "#8C503E", "#6E3D30", pressed=True)
    strip = Image.new("RGBA", (144, 24), CLEAR)
    for i, frame in enumerate((normal, hover, pressed)):
        strip.paste(frame, (i * 48, 0))
    return strip


# --------------------------------------------------------------------------- keycap
# v2 (wave 2): same treatment as the button -- 1px ink outer outline around the whole key
# (2px-rounded corners) and a visible warm parchment skirt instead of a 2-row ink bottom, so the
# key holds its shape on cosmos. 4px insets unchanged; pressing sinks the face 2px onto the skirt.
def keycap_frame(pressed: bool) -> Image.Image:
    s = 16
    sink = 2 if pressed else 0
    img = Image.new("RGBA", (s, s), CLEAR)
    mask = _rounded_outline_mask(s, s, sink)
    ink = hexa(INK)
    face = hexa("#FBF7EC")
    face_hi = hexa("#FFFDF7")
    face_lo = hexa("#EFE6D3")
    skirt = hexa("#D7CDB5")
    skirt_dark = hexa("#B9AB8B")
    face_top = sink + 1
    face_bottom = 10 + sink  # idle: face rows 1..10, skirt 11..14; pressed: face 3..12, skirt 13..14
    for y in range(s):
        for x in range(s):
            m = mask[y][x]
            if m == 0:
                continue
            if m == 1:
                img.putpixel((x, y), ink)
                continue
            if y <= face_bottom:
                colour = face
                if y == face_top or x == 1:
                    colour = face_hi
                if y == face_bottom or x == s - 2:
                    colour = face_lo
            else:
                colour = skirt_dark if y == s - 2 else skirt
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
