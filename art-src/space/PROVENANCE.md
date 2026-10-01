# Space parallax layers: provenance

Date: 2026-10-01. Producer: Claude (asset pipeline) with Codex (codex-cli 0.159.3, built-in image generation).
Production files are in `public/assets/space/`. Raw generations are in `raw/`, helper scripts in `scripts/`, and inspection previews in `previews/`.

All commands run from the repo root. Python 3 + Pillow (dev tooling only).

## stars-far.png (key `space-stars-far`): 256x256, opaque RGB, tiles on both axes

- **Source:** authored programmatically, pixel by pixel, with `scripts/starfield.py` (seeded `random.Random(20261001)`, deterministic). No image generation.
- **Construction:** the base is three close cosmos shades (#14162B / #17182D / #1A1B2E). They are picked by a low-frequency noise field built only from integer wave counts over 256, so it is exactly periodic. A 4x4 Bayer ordered dither turns that field into very subtle dithered variation. The layer has 78 one-pixel stars in plaster, dusk-blue and amber, with bright and dim variants already muted toward the base. About 12% of them get a barely-visible plus halo (#2B2C42-ish). Every placement wraps modulo 256, so the tile is seamless by construction.
- **Command:** `python art-src/space/scripts/starfield.py` (writes both star layers)
- **Rejected alternative:** Codex image_gen `raw/starfield-v1.png` (prompt below). Its stars are too uniform and evenly spaced, too many are amber, and they are all one size with no dim/bright depth. They would land at about 2px after the downscale, not the 1px the brief asks for. Kept for reference only.
- **Checks:** `previews/space-far-tile.png` (3x3 tiling at 2x, no seams visible) and `previews/stars-far.preview.png`.

## stars-near.png (key `space-stars-near`): 256x256, transparent, tiles on both axes

- **Source:** authored programmatically with `scripts/starfield.py` (seeded `random.Random(611)`). The 4 cross sparkles are hand-placed.
- **Construction:** 30 sparse stars spaced at least 22px apart, measured with wrap-around distance. They are one of three shapes: a single pixel, a 2px twinkle (bright pixel plus a softer neighbour), or a tiny plus with dim arms. Colours are plaster, parchment, light dusk-blue, warm amber and plum. There are 4 cross sparkles: amber (arm 3), dusk-blue (arm 2), plum (arm 3) and dusk/teal (arm 2). The arm-3 sparkles get dim diagonal shoulders so they read round and twinkly. Alpha is hard (0/255). All placements wrap modulo 256.
- **Command:** `python art-src/space/scripts/starfield.py`
- **Checks:** `previews/space-near-tile.png` (3x3 tiling over stars-far at 2x) and `previews/stars-near.preview.png`.

## nebula.png (key `space-nebula`): 640x360, soft alpha (max alpha 127), tiles horizontally

- **Source:** Codex image_gen via codex-cli 0.159.3 → `raw/nebula-v1.png` (1672x941, clouds on flat black).
- **Codex prompt (as reported by Codex):**
  > Asset type: nebula-v1, a background art layer for the cozy pixel-art game Cosmic Gyoza Express. Create one WIDE 16:9 landscape PNG, ideally 1536x864. Cozy handcrafted pixel art: warm, soft, slightly silly, never cold sci-fi. Match the inspected references' chunky pixel silhouettes and softly stepped muted shading, without including any reference objects. Scene: soft puffy rounded space nebula clouds on a SOLID FLAT PURE BLACK #000000 opaque background. Clouds sit ONLY within the top 30% and bottom 30% of the image. The entire middle horizontal 40%, from y=30% to y=70%, must be completely empty pure #000000 black, with no haze, marks or dithering. Clouds extend off both left and right edges; match cloud heights and colors at the two side boundaries for horizontal tiling. Style: painterly-but-pixelated cloud volumes, big visibly square art pixels approximately 4-6 output pixels wide, hard nearest-neighbor edges. Break up cloud edges with chunky ordered pixel dithering. Use a limited muted palette based on plum #9B8FB8, dusk-blue #9EB6C4 and teal #6FA39A, with darker muted shades for low contrast. Only a few faint warm amber #D4A055 highlights along top-left cloud edges. Supporting project palette: sage #8DA17A, plaster #FBF7EC, ink #1D1F33, cosmos #1A1B2E; prioritize the stated cloud colors and keep all exposed background exactly black. Mood: low contrast, dreamy, calm, cozy. No stars, text, UI, planets, ships, characters, faces, galaxies, sparkles, borders, watermark, smooth airbrushed gradients, or transparency. Output a single image, not a contact sheet.

  Before generating, Codex viewed the style references (gyoza-idle.png, gyoza-fly-02.png, asteroid-probe.png, delivery-v2.png) with view_image.
- **Normalization (`scripts/nebula.py`, not `pixelize.py`):** `pixelize.py` chroma-keys a flat colour and hardens alpha, which does not suit soft clouds on black. `nebula.py` reuses `pixelize.quantize` instead:
  `python art-src/space/scripts/nebula.py art-src/space/raw/nebula-v1.png public/assets/space/nebula.png --max-alpha 0.5 --colors 32 --mid-clear 0 --knee 70 --no-snap --seam`
  1. Alpha comes from brightness over black (floor 10, full alpha at +70), and colour is un-premultiplied so faint wisps keep their hue.
  2. Premultiplied box-filter cover-fit to 832x360 (640 plus a 192px overlap), then collapse to a 2x2 art grid.
  3. The horizontal seam uses a min-cost vertical quilting path through the overlap (columns 0..191 against 640..831), with hard cuts and no cross-fade. Left of the path the layer shows the overflow columns, which continue from x=639, so the wrap is exact. This replaced a linear cross-fade, which left a checkered "ghost cloud" near x=0..130.
  4. Overall alpha is scaled to 0.5 max. Alpha is quantized to 5 levels with a 4x4 Bayer ordered dither on the art grid, which gives the dithered pixel edges. Colour is quantized to 32 adaptive colours, with no CGE snap because snapping greyed out the plum.
- **Iteration notes:**
  - First pass (CGE snap, linear alpha, middle-band fade): grey, and Bayer checkerboards inside the cloud bodies. Rejected.
  - Steeper alpha knee and no band fade: clean solid bodies.
  - No snap and alpha 0.5: plum warmth restored.
  - Quilting seam: removed the cross-fade ghosting.
  - `raw/nebula-v2.png` (wispy ribbon variant, same prompt plus "wispier, elongated horizontal ribbon-like clouds..., more plum at the top and more teal and dusk-blue at the bottom") also processed cleanly. It is less cozy and puffy than v1, so it is not used and is kept as an alternate.
- **Checks:** `previews/nebula-tile3x.png` (3x horizontal tiling over stars-far), `previews/nebula-seam-zoom.png` (the wrap edge at 3x: last 200 columns next to the first 200), and `previews/nebula.preview.png`.
- **Known nit:** the quilting cut leaves one short straight vertical edge in the top band near x≈80, where a teal puff meets a plum one. It is only visible when zoomed; at 50% alpha over the dark sky it reads as a cloud overlap.

## Manual edits
None. All outputs are reproducible from the commands above.
