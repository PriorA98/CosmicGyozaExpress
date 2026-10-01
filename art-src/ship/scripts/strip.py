"""Preview helper: lay the 9 production ship frames side by side (on dark + light) at 3x, with a rim guide line."""
import sys
from PIL import Image, ImageDraw

NAMES = ["gyoza-idle", "gyoza-fly-01", "gyoza-fly-02", "gyoza-fly-03",
         "gyoza-incident-01", "gyoza-incident-02", "gyoza-incident-03", "gyoza-incident-04", "gyoza-incident-05"]
src = sys.argv[1] if len(sys.argv) > 1 else "public/assets/ship"
out = sys.argv[2]
scale = int(sys.argv[3]) if len(sys.argv) > 3 else 2
frames = [Image.open(f"{src}/{n}.png").convert("RGBA") for n in NAMES]
W, H = 144, 160
sheet = Image.new("RGBA", (len(frames) * (W + 4), 2 * H + 4), (0, 0, 0, 255))
for i, f in enumerate(frames):
    for row, bg in enumerate(((26, 27, 46, 255), (244, 236, 220, 255))):
        tile = Image.new("RGBA", (W, H), bg)
        tile.alpha_composite(f.crop((0, 0, W, H)))
        sheet.paste(tile, (i * (W + 4), row * (H + 4)))
sheet = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
d = ImageDraw.Draw(sheet)
for row in range(2):
    y = (row * (H + 4) + 58) * scale
    d.line([(0, y), (sheet.width, y)], fill=(255, 0, 0, 120))
sheet.save(out)
