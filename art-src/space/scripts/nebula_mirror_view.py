"""Preview the nebula as the runtime draws it: 'mirror' mode (tile + its vertical mirror), wrapped
horizontally, over the far starfield on the cosmos sky, at a given layer alpha, at 2x. Dev tooling only.

    python art-src/space/scripts/nebula_mirror_view.py <nebula.png> <out.png> [layer_alpha=0.5] [crop=x0,y0,x1,y1]
"""
import sys
from PIL import Image
neb = Image.open(sys.argv[1]).convert("RGBA")
la = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
W, H = neb.size
stack = Image.new("RGBA", (W, H * 2))
stack.paste(neb, (0, 0)); stack.paste(neb.transpose(Image.FLIP_TOP_BOTTOM), (0, H))
big = Image.new("RGBA", (W + W // 2, H * 2))
big.paste(stack, (0, 0)); big.paste(stack, (W, 0))
a = big.getchannel("A").point(lambda v: int(v * la))
big.putalpha(a)
sky = Image.new("RGBA", big.size, (26, 27, 46, 255))
stars = Image.open("public/assets/space/stars-far.png").convert("RGBA")
for x in range(0, big.width, stars.width):
    for y in range(0, big.height, stars.height):
        sky.alpha_composite(stars, (x, y))
comp = Image.alpha_composite(sky, big)
if len(sys.argv) > 4:
    comp = comp.crop(tuple(int(v) for v in sys.argv[4].split(",")))
comp.resize((comp.width * 2, comp.height * 2), Image.NEAREST).save(sys.argv[2])
