"""Preview helper: composite planets at 2x with the runtime multiply tint over cosmos, next to an asteroid.
Usage: python sim_w3.py <out.png> <plum.png> <imfine.png> [--tint-plum #B4AECB] [--tint-fine #C3C1D6]"""
from __future__ import annotations
import sys
from PIL import Image, ImageChops

def hexc(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))

def tinted(path, tint):
    im = Image.open(path).convert('RGBA')
    t = Image.new('RGBA', im.size, hexc(tint) + (255,))
    rgb = ImageChops.multiply(im.convert('RGB'), t.convert('RGB'))
    rgb.putalpha(im.split()[3])
    return rgb.resize((im.width * 2, im.height * 2), Image.NEAREST)

def main():
    out, plum, fine = sys.argv[1:4]
    tp = sys.argv[4] if len(sys.argv) > 4 else '#B4AECB'
    tf = sys.argv[5] if len(sys.argv) > 5 else '#C3C1D6'
    bg = Image.new('RGBA', (640, 360), hexc('#1A1B2E') + (255,))
    bg.alpha_composite(tinted(plum, tp), (40, 20))
    bg.alpha_composite(tinted(fine, tf), (60, 110))
    for i, name in enumerate(['asteroid-sleepy', 'asteroid-crumb']):
        a = Image.open(f'public/assets/asteroids/{name}.png').convert('RGBA')
        a = a.resize((a.width * 2, a.height * 2), Image.NEAREST)
        bg.alpha_composite(a, (330 + i * 150, 60))
    bg.resize((1280, 720), Image.NEAREST).save(out)

main()
