"""Flatten a generator's checker/crosshatch dither before pixelizing.

Takes an RGBA image (already keyed, e.g. by flood_key.py), blurs the colour inside the
silhouette only (alpha-weighted Gaussian, so the transparent margin does not bleed in),
and keeps the original alpha. pixelize.py --colors N then snaps the smooth result into
flat bands.

Usage: python dedither.py <in.png> <out.png> [radius=10]
"""
import sys
from PIL import Image, ImageFilter, ImageChops

src, dst = sys.argv[1], sys.argv[2]
r = float(sys.argv[3]) if len(sys.argv) > 3 else 10
im = Image.open(src).convert("RGBA")
a = im.getchannel("A")
pre = Image.new("RGB", im.size)
pre.paste(im.convert("RGB"), mask=a)
blur_rgb = pre.filter(ImageFilter.GaussianBlur(r))
blur_a = a.filter(ImageFilter.GaussianBlur(r))
# un-premultiply
bands = []
ba = blur_a.load()
out = Image.new("RGBA", im.size)
bp, op, ap = blur_rgb.load(), out.load(), a.load()
w, h = im.size
for y in range(h):
    for x in range(w):
        if ap[x, y]:
            k = 255 / max(ba[x, y], 1)
            p = bp[x, y]
            op[x, y] = (min(255, int(p[0] * k)), min(255, int(p[1] * k)), min(255, int(p[2] * k)), ap[x, y])
out.save(dst)
print("wrote", dst)
