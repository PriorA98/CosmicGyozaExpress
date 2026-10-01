"""Preview strip: every ship frame at N x on cosmos and parchment, with the saucer centre marked."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
src = Path(sys.argv[1]); out = Path(sys.argv[2]); s = int(sys.argv[3]) if len(sys.argv) > 3 else 4
mark = len(sys.argv) > 4
names = ["gyoza-idle", "gyoza-fly-01", "gyoza-fly-02", "gyoza-fly-03", "gyoza-incident-01",
         "gyoza-incident-02", "gyoza-incident-03", "gyoza-incident-04", "gyoza-incident-05"]
ims = [Image.open(src / f"{n}.png").convert("RGBA") for n in names]
fw, fh = 64 * s, 80 * s
sheet = Image.new("RGBA", (len(ims) * (fw + 8), 2 * fh + 8), (0, 0, 0, 255))
for row, bg in enumerate([(26, 27, 46, 255), (244, 236, 220, 255)]):
    for i, im in enumerate(ims):
        tile = Image.new("RGBA", (fw, fh), bg)
        tile.alpha_composite(im.resize((fw, fh), Image.NEAREST))
        if mark:
            d = ImageDraw.Draw(tile); cx, cy = 32 * s, 34 * s
            d.line([(cx - 4, cy), (cx + 4, cy)], fill=(0, 255, 0, 255)); d.line([(cx, cy - 4), (cx, cy + 4)], fill=(0, 255, 0, 255))
        sheet.paste(tile, (i * (fw + 8), row * (fh + 8)))
sheet.save(out)
print(out, sheet.size)
