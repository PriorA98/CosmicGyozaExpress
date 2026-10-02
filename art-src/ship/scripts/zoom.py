"""Zoom a few ship frames at N x on cosmos and parchment: zoom.py <dir> <out> <scale> name..."""
import sys
from pathlib import Path
from PIL import Image
src, out, s = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
names = sys.argv[4:]
ims = [Image.open(src / f"{n}.png").convert("RGBA") for n in names]
fw, fh = 64 * s, 80 * s
sheet = Image.new("RGBA", (len(ims) * (fw + 4), 2 * fh + 4), (0, 0, 0, 255))
for row, bg in enumerate([(26, 27, 46, 255), (244, 236, 220, 255)]):
    for i, im in enumerate(ims):
        tile = Image.new("RGBA", (fw, fh), bg)
        tile.alpha_composite(im.resize((fw, fh), Image.NEAREST))
        sheet.paste(tile, (i * (fw + 4), row * (fh + 4)))
sheet.save(out)
