"""Preview a nebula candidate over the far starfield at 2x, at full file alpha and at a given layer alpha."""
import sys
from PIL import Image
neb = Image.open(sys.argv[1]).convert("RGBA")
out = sys.argv[2]
layer_alpha = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
stars = Image.open("public/assets/space/stars-far.png").convert("RGBA")
bg = Image.new("RGBA", neb.size)
for x in range(0, neb.width, stars.width):
    for y in range(0, neb.height, stars.height):
        bg.paste(stars, (x, y))
rows = []
for la in (1.0, layer_alpha):
    n = neb.copy()
    a = n.getchannel("A").point(lambda v: int(v * la))
    n.putalpha(a)
    rows.append(Image.alpha_composite(bg, n))
sheet = Image.new("RGBA", (neb.width, neb.height * 2))
sheet.paste(rows[0], (0, 0)); sheet.paste(rows[1], (0, neb.height))
sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(out)
