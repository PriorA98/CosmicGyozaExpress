"""Stack all particle strips at 8x over dark space + pale ground backgrounds, with cell gridlines."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
src = Path(sys.argv[1]); out = Path(sys.argv[2]); S = int(sys.argv[3]) if len(sys.argv) > 3 else 8
specs = [("thrust", 16), ("dust", 16), ("sparkle", 8), ("steam", 12), ("star", 5)]
rows = []
for name, fw in specs:
    im = Image.open(src / f"{name}.png").convert("RGBA")
    big = im.resize((im.width * S, im.height * S), Image.NEAREST)
    row = Image.new("RGBA", (big.width * 2 + 16, big.height), (0, 0, 0, 0))
    for i, bg in enumerate([(26, 27, 46, 255), (236, 223, 197, 255)]):
        b = Image.new("RGBA", big.size, bg)
        d = ImageDraw.Draw(b)
        for f in range(1, im.width // fw):
            d.line([(f * fw * S, 0), (f * fw * S, big.height)], fill=(90, 90, 110, 255))
        b.alpha_composite(big)
        row.paste(b, (i * (big.width + 16), 0))
    rows.append(row)
W = max(r.width for r in rows); H = sum(r.height + 8 for r in rows)
sheet = Image.new("RGBA", (W, H), (61, 62, 77, 255)); y = 0
for r in rows:
    sheet.alpha_composite(r, (0, y)); y += r.height + 8
sheet.save(out)
