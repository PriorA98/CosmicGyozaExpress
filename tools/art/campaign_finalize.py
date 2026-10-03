"""Normalize Phase 3 campaign raw generations into production assets (dev tooling; Python + Pillow).

Reads art-src/campaign/<group>/raw/*-v<N>.png (latest version wins) and writes public/assets/campaign/*.png
at the dimensions declared in src/data/assetManifest.ts, via tools/art/pixelize.py. Records every command
in art-src/campaign/<group>/scripts/normalize-log.txt for PROVENANCE.

  python tools/art/campaign_finalize.py [--only destinations,characters,items,landing,space]
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art-src" / "campaign"
OUT = ROOT / "public" / "assets" / "campaign"
WORK = SRC / "_work"
PIXELIZE = [sys.executable, str(ROOT / "tools" / "art" / "pixelize.py")]
THEMES = ["bento", "matcha", "bakery", "im-fine", "home"]


def latest(group: str, stem: str) -> Path | None:
    raw = SRC / group / "raw"
    best: tuple[int, Path] | None = None
    for path in raw.glob(f"{stem}-v*.png"):
        match = re.search(r"-v(\d+)\.png$", path.name)
        if match and (best is None or int(match.group(1)) > best[0]):
            best = (int(match.group(1)), path)
    return best[1] if best else None


def run(group: str, args: list[str]) -> None:
    cmd = PIXELIZE + args
    printable = "python tools/art/pixelize.py " + " ".join(str(a).replace(str(ROOT) + "\\", "").replace("\\", "/") for a in args)
    log = SRC / group / "scripts" / "normalize-log.txt"
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as handle:
        handle.write(printable + "\n")
    print(printable)
    subprocess.run(cmd, check=True)


def split_cells(path: Path, cells: int, name: str) -> list[Path]:
    """Splits a horizontal strip into `cells` equal cells (for sheets generated as one image)."""
    WORK.mkdir(parents=True, exist_ok=True)
    image = Image.open(path).convert("RGBA")
    width = image.width // cells
    outputs = []
    for index in range(cells):
        cell = image.crop((index * width, 0, (index + 1) * width, image.height))
        target = WORK / f"{name}-{index}.png"
        cell.save(target)
        outputs.append(target)
    return outputs


def destinations() -> None:
    for theme in THEMES:
        src = latest("destinations", f"destination-{theme}")
        if src:
            run("destinations", [str(src), str(OUT / f"destination-{theme}.png"), "--size", "160x160", "--colors", "28", "--pad", "2"])


def characters() -> None:
    for name in ["mallow", "nori", "pip", "iona"]:
        idle, welcome = latest("characters", f"{name}-idle"), latest("characters", f"{name}-welcome")
        if idle and welcome:
            run("characters", [str(idle), str(welcome), "--sheet", str(OUT / f"portrait-{name}.png"), "--size", "48x48", "--colors", "20", "--anchor", "bottom", "--pad", "0"])


def items() -> None:
    cargo = [latest("items", f"cargo-{n}") for n in ["bento", "flask", "jar", "soup", "parcel"]]
    if all(cargo):
        run("items", [*map(str, cargo), "--sheet", str(OUT / "cargo.png"), "--size", "32x32", "--colors", "16"])
    cards = [latest("items", f"postcard-{t}") for t in THEMES]
    if all(cards):
        run("items", [*map(str, cards), "--sheet", str(OUT / "postcards.png"), "--size", "48x32", "--colors", "20", "--pad", "0"])
    pickups = [latest("items", "pickup-postcard"), latest("items", "pickup-crumb")]
    if all(pickups):
        run("items", [*map(str, pickups), "--sheet", str(OUT / "pickups.png"), "--size", "16x16", "--colors", "8", "--pad", "0"])


def landing() -> None:
    for theme in THEMES:
        sky, hills = latest("landing", f"sky-{theme}"), latest("landing", f"hills-{theme}")
        if sky:
            run("landing", [str(sky), str(OUT / f"landing-sky-{theme}.png"), "--size", "640x360", "--fit", "cover", "--opaque", "--key", "none", "--colors", "40"])
        if hills:
            run("landing", [str(hills), str(OUT / f"landing-hills-{theme}.png"), "--size", "640x96", "--fit", "cover", "--anchor", "bottom", "--colors", "24", "--no-crop"])


def space() -> None:
    for theme in THEMES:
        neb = latest("space", f"nebula-{theme}")
        if neb:
            run("space", [str(neb), str(OUT / f"nebula-{theme}.png"), "--size", "640x360", "--fit", "cover", "--soft-alpha", "--colors", "32", "--no-crop"])
    sock = latest("space", "windsock-sheet")
    if sock:
        cells = split_cells(sock, 4, "windsock")
        run("space", [*map(str, cells), "--sheet", str(OUT / "windsock.png"), "--size", "24x32", "--colors", "10", "--anchor", "bottom", "--pad", "0"])
    arrow = latest("space", "flow-arrow")
    if arrow:
        run("space", [str(arrow), str(OUT / "flow-arrow.png"), "--size", "24x16", "--colors", "8", "--pad", "0"])
    berth = latest("space", "berth-tiles")
    if berth:
        cells = split_cells(berth, 3, "berth")
        run("space", [*map(str, cells), "--sheet", str(OUT / "berth-tiles.png"), "--size", "32x24", "--fit", "cover", "--colors", "14", "--no-crop", "--anchor", "top"])


GROUPS = {"destinations": destinations, "characters": characters, "items": items, "landing": landing, "space": space}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=",".join(GROUPS))
    args = parser.parse_args()
    for group in args.only.split(","):
        GROUPS[group]()


if __name__ == "__main__":
    main()
