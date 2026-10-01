"""Author the Cosmic Gyoza Express parallax star layers pixel-by-pixel (dev tooling only).

Both layers are seamless by construction: every placement and the base noise wrap modulo 256.

    python art-src/space/scripts/starfield.py
writes public/assets/space/stars-far.png (opaque) and public/assets/space/stars-near.png (transparent).
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public" / "assets" / "space"
SIZE = 256

BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


def hexrgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


# far base: three close cosmos shades, deepest first
BASE = [hexrgb("14162B"), hexrgb("17182D"), hexrgb("1A1B2E")]
# star colours for the far layer: (bright, dim) pairs, already muted toward the base
FAR_STARS = {
    "plaster": [hexrgb("D9D4CC"), hexrgb("8E8C99")],
    "dusk": [hexrgb("8DA3B4"), hexrgb("56637A")],
    "amber": [hexrgb("C49A5C"), hexrgb("7A6448")],
}
FAR_HALO = {"plaster": hexrgb("2B2C42"), "dusk": hexrgb("252B42"), "amber": hexrgb("2C2834")}

NEAR = {
    "plaster": hexrgb("FBF7EC"),
    "parchment": hexrgb("F4ECDC"),
    "dusk": hexrgb("B9CCD6"),
    "dusk-mid": hexrgb("7E95A8"),
    "amber": hexrgb("E6BE7A"),
    "amber-mid": hexrgb("A9845A"),
    "plum": hexrgb("B5A9CF"),
    "plum-mid": hexrgb("7A6F98"),
    "teal-mid": hexrgb("5F8C88"),
}


def tile_noise(x: int, y: int) -> float:
    """Low-frequency noise that is exactly periodic over SIZE on both axes (integer wave counts)."""
    t = 2 * math.pi / SIZE
    v = (
        math.sin(t * (1 * x + 1 * y) + 0.7)
        + 0.8 * math.sin(t * (2 * x - 1 * y) + 2.1)
        + 0.6 * math.cos(t * (1 * x + 2 * y) + 4.0)
        + 0.35 * math.sin(t * (3 * x + 2 * y) + 1.3)
    )
    return (v + 2.75) / 5.5  # ~0..1


def far_layer(rng: random.Random) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE))
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            n = tile_noise(x, y) * 2.0  # 0..2 across three shades
            lo = min(int(n), 1)
            frac = n - lo
            threshold = (BAYER4[y % 4][x % 4] + 0.5) / 16
            idx = lo + (1 if frac > threshold else 0)
            px[x, y] = (*BASE[min(idx, 2)], 255)

    taken: set[tuple[int, int]] = set()

    def free(x: int, y: int, r: int) -> bool:
        return all(((x + dx) % SIZE, (y + dy) % SIZE) not in taken for dx in range(-r, r + 1) for dy in range(-r, r + 1))

    kinds = ["plaster"] * 5 + ["dusk"] * 4 + ["amber"] * 2
    placed = 0
    while placed < 78:
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        if not free(x, y, 6):
            continue
        kind = rng.choice(kinds)
        bright, dim = FAR_STARS[kind]
        roll = rng.random()
        if roll < 0.12:
            # a slightly brighter far star with a barely-there plus halo
            px[x, y] = (*bright, 255)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                px[(x + dx) % SIZE, (y + dy) % SIZE] = (*FAR_HALO[kind], 255)
        elif roll < 0.5:
            px[x, y] = (*bright, 255)
        else:
            px[x, y] = (*dim, 255)
        taken.add((x, y))
        placed += 1
    return img


def put(px, x: int, y: int, rgb: tuple[int, int, int]) -> None:
    px[x % SIZE, y % SIZE] = (*rgb, 255)


def sparkle(px, x: int, y: int, core: str, mid: str, tip: str, arm: int) -> None:
    put(px, x, y, NEAR[core])
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        put(px, x + dx, y + dy, NEAR[mid if arm > 1 else tip])
        if arm >= 2:
            put(px, x + 2 * dx, y + 2 * dy, NEAR[tip])
        if arm >= 3:
            put(px, x + 3 * dx, y + 3 * dy, NEAR[tip])
    if arm >= 3:
        # soft diagonal shoulders so the big sparkles read round and twinkly, not like a plus sign
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            put(px, x + dx, y + dy, NEAR[tip])


def near_layer(rng: random.Random) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    px = img.load()
    taken: list[tuple[int, int]] = []

    def far_enough(x: int, y: int, r: int) -> bool:
        for ox, oy in taken:
            dx = min(abs(x - ox), SIZE - abs(x - ox))
            dy = min(abs(y - oy), SIZE - abs(y - oy))
            if dx * dx + dy * dy < r * r:
                return False
        return True

    # hand-placed cross sparkles: warm and cool, spread across the tile
    sparkles = [
        (54, 70, "plaster", "amber", "amber-mid", 3),
        (186, 38, "plaster", "dusk", "dusk-mid", 2),
        (150, 176, "plaster", "plum", "plum-mid", 3),
        (28, 214, "parchment", "dusk", "teal-mid", 2),
    ]
    for x, y, core, mid, tip, arm in sparkles:
        sparkle(px, x, y, core, mid, tip, arm)
        taken.append((x, y))

    singles = [
        ("plaster", None), ("plaster", None), ("parchment", None),
        ("dusk", None), ("dusk", None), ("amber", None), ("plum", None),
    ]
    placed = 0
    while placed < 30:
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        if not far_enough(x, y, 22):
            continue
        name, _ = rng.choice(singles)
        roll = rng.random()
        if roll < 0.35:
            # 2px star: bright pixel plus one softer neighbour (reads as a twinkle, not a block)
            put(px, x, y, NEAR[name])
            mid = {"dusk": "dusk-mid", "amber": "amber-mid", "plum": "plum-mid"}.get(name, "dusk-mid")
            put(px, x + 1, y, NEAR[mid])
        elif roll < 0.5:
            # tiny plus: dim arms, bright core
            put(px, x, y, NEAR[name])
            mid = {"amber": "amber-mid", "plum": "plum-mid"}.get(name, "dusk-mid")
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put(px, x + dx, y + dy, NEAR[mid])
        else:
            put(px, x, y, NEAR[name])
        taken.append((x, y))
        placed += 1
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    far = far_layer(random.Random(20261001))
    far.convert("RGB").save(OUT / "stars-far.png", optimize=True)
    near = near_layer(random.Random(611))
    near.save(OUT / "stars-near.png", optimize=True)
    print("wrote stars-far.png and stars-near.png")


if __name__ == "__main__":
    main()
