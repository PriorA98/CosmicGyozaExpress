"""Stage-A placeholder art for the Phase 3 campaign (dev tooling; Python + Pillow).

Writes simple, palette-correct pixel placeholders at the FINAL paths and dimensions declared in
src/data/assetManifest.ts, so Wave D final art replaces bytes in place with zero code change.

  python tools/art/campaign_placeholders.py [--force]

Skips files that already exist unless --force (so final art is never overwritten by accident).
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("public/assets/campaign")
INK = (23, 27, 46, 255)
CREAM = (244, 230, 200, 255)
PEACH = (230, 165, 122, 255)
CLEAR = (0, 0, 0, 0)

PALETTES = {
    "bento": [(214, 154, 87, 255), (111, 142, 131, 255), (185, 108, 88, 255)],
    "matcha": [(128, 150, 107, 255), (183, 198, 154, 255), (214, 197, 140, 255)],
    "bakery": [(201, 133, 87, 255), (229, 189, 118, 255), (128, 108, 145, 255)],
    "im-fine": [(101, 122, 145, 255), (164, 185, 179, 255), (237, 196, 119, 255)],
    "home": [(186, 135, 152, 255), (136, 165, 154, 255), (229, 198, 143, 255)],
}


def disc(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill, outline=INK) -> None:
    draw.ellipse((round(cx - r), round(cy - r), round(cx + r), round(cy + r)), fill=fill, outline=outline, width=2)


def destination(name: str) -> Image.Image:
    a, b, c = PALETTES[name]
    img = Image.new("RGBA", (160, 160), CLEAR)
    d = ImageDraw.Draw(img)
    disc(d, 80, 84, 62, a)
    d.ellipse((34, 50, 96, 92), fill=b)  # soft highlight blob
    disc(d, 80, 84, 62, None)
    # small building / window on top
    d.rectangle((62, 14, 98, 40), fill=c, outline=INK, width=2)
    d.polygon([(58, 16), (80, 4), (102, 16)], fill=a, outline=INK)
    d.rectangle((74, 24, 86, 34), fill=(251, 235, 170, 255), outline=INK)
    # dock ring hint
    d.arc((24, 120, 136, 156), 0, 180, fill=CREAM, width=3)
    return img


def portrait(name: str) -> Image.Image:
    a, b, c = PALETTES[name]
    img = Image.new("RGBA", (96, 48), CLEAR)
    d = ImageDraw.Draw(img)
    for frame in range(2):
        ox = frame * 48
        d.rounded_rectangle((ox + 6, 26, ox + 42, 47), radius=8, fill=b, outline=INK, width=2)
        disc(d, ox + 24, 20, 14, a)
        eye_y = 19 if frame == 0 else 18
        d.rectangle((ox + 18, eye_y, ox + 20, eye_y + 2), fill=INK)
        d.rectangle((ox + 28, eye_y, ox + 30, eye_y + 2), fill=INK)
        if frame == 1:  # welcome: smile + raised hand
            d.arc((ox + 18, 20, ox + 30, 28), 20, 160, fill=INK, width=1)
            disc(d, ox + 40, 28, 4, c)
        else:
            d.line((ox + 21, 26, ox + 27, 26), fill=INK)
    return img


def cargo() -> Image.Image:
    img = Image.new("RGBA", (160, 32), CLEAR)
    d = ImageDraw.Draw(img)
    # bento, flask, jar, soup, parcel
    d.rectangle((4, 8, 28, 26), fill=PALETTES["bento"][0], outline=INK, width=2)
    d.line((4, 15, 28, 15), fill=INK)
    d.rectangle((44, 6, 52, 28), fill=PALETTES["matcha"][0], outline=INK, width=2)
    d.rectangle((45, 3, 51, 6), fill=CREAM, outline=INK)
    d.rounded_rectangle((70, 8, 90, 28), radius=4, fill=PALETTES["bakery"][1], outline=INK, width=2)
    d.rectangle((72, 4, 88, 8), fill=PALETTES["bakery"][2], outline=INK)
    d.chord((98, 10, 126, 30), 0, 180, fill=PALETTES["im-fine"][2], outline=INK, width=2)
    d.line((112, 4, 118, 16), fill=CREAM, width=2)
    d.rectangle((132, 8, 156, 28), fill=PALETTES["home"][0], outline=INK, width=2)
    d.line((144, 8, 144, 28), fill=CREAM, width=2)
    d.line((132, 18, 156, 18), fill=CREAM, width=2)
    return img


def postcards() -> Image.Image:
    img = Image.new("RGBA", (240, 32), CLEAR)
    d = ImageDraw.Draw(img)
    for i, name in enumerate(["bento", "matcha", "bakery", "im-fine", "home"]):
        a, b, c = PALETTES[name]
        ox = i * 48
        d.rectangle((ox + 1, 1, ox + 46, 30), fill=CREAM, outline=INK, width=2)
        d.rectangle((ox + 5, 5, ox + 42, 26), fill=b)
        disc(d, ox + 24, 18, 7, a)
        d.rectangle((ox + 34, 6, ox + 40, 12), fill=c)
    return img


def flow_arrow() -> Image.Image:
    img = Image.new("RGBA", (24, 16), CLEAR)
    d = ImageDraw.Draw(img)
    d.polygon([(1, 5), (14, 5), (14, 1), (23, 8), (14, 15), (14, 11), (1, 11)], fill=PALETTES["matcha"][1], outline=INK)
    return img


def windsock() -> Image.Image:
    img = Image.new("RGBA", (96, 32), CLEAR)
    d = ImageDraw.Draw(img)
    for frame, angle in enumerate([80, 55, 30, 5]):
        ox = frame * 24
        d.rectangle((ox + 5, 4, ox + 6, 31), fill=INK)
        length = 16
        rad = math.radians(angle)
        tip = (ox + 6 + math.sin(rad) * length, 5 + math.cos(rad) * length)
        d.polygon([(ox + 6, 3), (ox + 6, 9), tip], fill=PEACH if frame else CREAM, outline=INK)
    return img


def berth_tiles() -> Image.Image:
    img = Image.new("RGBA", (96, 24), CLEAR)
    d = ImageDraw.Draw(img)
    teal = PALETTES["home"][1]
    for frame in range(3):
        ox = frame * 32
        d.rectangle((ox, 2, ox + 31, 9), fill=CREAM)
        d.line((ox, 2, ox + 31, 2), fill=INK, width=2)
        d.rectangle((ox, 10, ox + 31, 23), fill=teal)
        d.line((ox, 10, ox + 31, 10), fill=INK)
        if frame == 1:
            disc(d, ox + 16, 16, 2, (251, 235, 170, 255), outline=None)
    d.line((0, 2, 0, 23), fill=INK, width=2)
    d.line((95, 2, 95, 23), fill=INK, width=2)
    return img


def fog() -> Image.Image:
    img = Image.new("RGBA", (128, 64), CLEAR)
    d = ImageDraw.Draw(img)
    a, b, _ = PALETTES["matcha"]
    for cx, cy, r, col in [(24, 40, 20, a), (56, 30, 26, b), (92, 38, 22, a), (112, 44, 14, b)]:
        d.ellipse((cx - r, cy - r * 0.7, cx + r, cy + r * 0.7), fill=(col[0], col[1], col[2], 150))
    return img


def pickups() -> Image.Image:
    img = Image.new("RGBA", (32, 16), CLEAR)
    d = ImageDraw.Draw(img)
    d.rectangle((1, 3, 14, 12), fill=CREAM, outline=INK)
    d.line((1, 3, 8, 8, 14, 3), fill=INK)
    d.rectangle((10, 4, 12, 6), fill=PEACH)
    d.polygon([(24, 2), (26, 7), (30, 8), (26, 9), (24, 14), (22, 9), (18, 8), (22, 7)], fill=PEACH, outline=INK)
    return img


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    targets = {f"destination-{n}.png": (lambda n=n: destination(n)) for n in PALETTES}
    targets.update({
        "portrait-mallow.png": lambda: portrait("bento"),
        "portrait-nori.png": lambda: portrait("matcha"),
        "portrait-pip.png": lambda: portrait("bakery"),
        "portrait-iona.png": lambda: portrait("im-fine"),
        "cargo.png": cargo,
        "postcards.png": postcards,
        "flow-arrow.png": flow_arrow,
        "windsock.png": windsock,
        "berth-tiles.png": berth_tiles,
        "fog.png": fog,
        "pickups.png": pickups,
    })
    for name, build in targets.items():
        path = OUT / name
        if path.exists() and not args.force:
            print(f"skip {path}")
            continue
        build().save(path, optimize=True)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
