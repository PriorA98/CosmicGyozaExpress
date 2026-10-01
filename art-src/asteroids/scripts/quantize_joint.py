"""Quantize a whole RGBA sprite/strip to ONE shared palette (alpha kept hard).

Used for the debris strip so all frames share one palette instead of per-frame palettes.

Usage: python quantize_joint.py <in.png> <out.png> <colors>
"""
import sys
from PIL import Image

src, dst, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert("RGBA")
alpha = im.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
rgb = Image.new("RGB", im.size, (0, 0, 0))
rgb.paste(im.convert("RGB"), mask=alpha)
# quantize only opaque pixels: build palette from an opaque-only sample strip
opaque = [p for p, a in zip(im.convert("RGB").getdata(), alpha.getdata()) if a]
sample = Image.new("RGB", (len(opaque), 1))
sample.putdata(opaque)
pal = sample.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
q = rgb.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGBA")
q.putalpha(alpha)
q.save(dst, optimize=True)
cols = {p for p in q.getdata() if p[3]}
print(f"wrote {dst}: {len(cols)} colours")
