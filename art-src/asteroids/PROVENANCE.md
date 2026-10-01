# Asteroids: provenance

Date: 2026-10-01. Folder owner: asteroids asset producer (Claude + Codex).
Outputs: `public/assets/asteroids/asteroid-{sleepy,rice,tea,mochi,crumb}.png` (72x72, transparent) and
`asteroid-debris.png` (96x24 strip, 4 frames of 24x24, transparent). These match `src/data/assetManifest.ts`.

## Sources

- **Codex image_gen via codex-cli 0.159.3** (`codex-companion.mjs task --write`), three Codex threads.
  The full user prompts and the exact `image_gen__imagegen` prompts Codex wrote were recovered from the
  `~/.codex/sessions` rollout files. They are saved verbatim in `scripts/codex-prompts.txt`.
  - Thread 1 (14:27): rice, tea, mochi v1. Style refs viewed: `art-src/_probe/asteroid-probe.png`,
    `public/assets/ship/gyoza-idle.png`, `assets/reference/screenshots/delivery-v2.png`. Codex also ran a
    "background correction only" re-pass on the rice image to get a flat #FF00FF background.
  - Thread 2 (14:32): crumb v1 and the debris strip v1. Refs: probe, rice-v1 (sibling), gyoza-idle.
  - Thread 3 (14:35): mochi v2 and v3, with a critique of v1 (too salmon, not pillowy, broken outline).
- **Sleepy rock**: the approved probe. `raw/asteroid-sleepy-v1.png` is a byte-identical copy of
  `art-src/_probe/asteroid-probe.png`. No new generation.

Shared prompt core (thread 1, abridged): "one pixel-art asteroid sprite ... match the approved
asteroid-probe exactly, chunky ~64 art pixels across, dark plum-ink #1D1F33 outline about one art pixel
thick, soft muted flat pixel shading, warm cream top-left highlights ... SOLID FLAT exact #FF00FF magenta
background, no gradient, no ground shadow, no glow, no stars, no text. Absolutely NO FACE ... Palette: ink,
parchment, parchment-deep, plaster, terracotta, amber, sage, sage-deep, dusk-blue, plum, teal, slate."

## Helper scripts (`scripts/`)

- `flood_key.py <in> <out> [tol=90]` removes magenta by flood-fill from the border only, so pink and plum
  interior shading is not keyed out. Used for mochi only, because its pale pink body was close to the key.
- `slice_strip.py <strip> <prefix> <count>` splits a magenta strip into separate padded subjects (debris).
- `close_outline.py <in> <out> [max_lum=70]` recolours light silhouette-edge pixels to the darkest edge
  ink. This closes outline gaps left by downscaling. The silhouette does not grow.

## Per file (exact rebuild commands, run from the repo root)

All final outputs were re-derived on 2026-10-01 with the commands below. They match the shipped PNGs
pixel for pixel on every non-transparent pixel.

| File | Key | Raw source | Attempts |
| --- | --- | --- | --- |
| asteroid-sleepy.png | asteroid-sleepy | raw/asteroid-sleepy-v1.png (= probe) | 1 (approved probe) |
| asteroid-rice.png | asteroid-rice | raw/asteroid-rice-v1.png | 1 |
| asteroid-tea.png | asteroid-tea | raw/asteroid-tea-v1.png | 1 |
| asteroid-mochi.png | asteroid-mochi | raw/asteroid-mochi-v2.png | 3 generations (v1, v2, v3), v2 kept |
| asteroid-crumb.png | asteroid-crumb | raw/asteroid-crumb-v1.png | 1 |
| asteroid-debris.png | asteroid-debris | raw/asteroid-debris-v1.png -> raw/slices/debris-v1-{1..4}.png | 1 |

```sh
# sleepy, rice, tea, crumb (default magenta key)
for n in sleepy rice tea crumb; do
  python tools/art/pixelize.py art-src/asteroids/raw/asteroid-$n-v1.png tmp.png --size 72x72 --colors 32 --pad 4
  python art-src/asteroids/scripts/close_outline.py tmp.png public/assets/asteroids/asteroid-$n.png
done

# mochi (border flood-key first, so the pink body survives)
python art-src/asteroids/scripts/flood_key.py art-src/asteroids/raw/asteroid-mochi-v2.png art-src/asteroids/raw/keyed/asteroid-mochi-v2.png 90
python tools/art/pixelize.py art-src/asteroids/raw/keyed/asteroid-mochi-v2.png tmp.png --size 72x72 --colors 32 --pad 4 --key none
python art-src/asteroids/scripts/close_outline.py tmp.png public/assets/asteroids/asteroid-mochi.png

# debris strip (4 x 24x24)
python art-src/asteroids/scripts/slice_strip.py art-src/asteroids/raw/asteroid-debris-v1.png art-src/asteroids/raw/slices/debris-v1 4
python tools/art/pixelize.py art-src/asteroids/raw/slices/debris-v1-1.png art-src/asteroids/raw/slices/debris-v1-2.png \
  art-src/asteroids/raw/slices/debris-v1-3.png art-src/asteroids/raw/slices/debris-v1-4.png \
  --sheet tmp.png --size 24x24 --colors 28 --pad 2
python art-src/asteroids/scripts/close_outline.py tmp.png public/assets/asteroids/asteroid-debris.png
```

`--pad 4` puts the rock body in a 64x64 box inside 72x72, which is about 89% of the canvas, as the brief
asks. Sleepy uses 32 colours (the brief's minimum is 28), so the blush and the closed-eye face survive.
The debris frames are quantized per frame, so the strip has about 100 colours in total. Each pebble
still has a small palette.

No manual pixel edits were made. The only post-process is the scripted outline closing.

## Iteration notes

- `raw/keyed/*-v1.png` (flood-keyed rice, tea, crumb and sleepy) were tried as an alternative input.
  The default chroma key in `pixelize.py` gave equal or cleaner edges for those four, so the keyed
  versions were not used.
- Mochi v1 was too salmon-pink and angular, and its outline broke on the upper right. v3 was jagged and
  triangular. v2 was the best: plump, wider than tall, warm white with a pink lower blush and a powdery
  cap. The default key ate part of its pale pink body, which is why it uses `flood_key.py`.
- Outline comparisons (`previews/outline-compare.png`, `previews/cand/*-ol.png`) led to applying
  `close_outline.py` to every output, for a continuous ink outline that matches the hero ship.
- Debris pebbles from left to right: mauve chip with a crater (sleepy-rock stone), cream rice grain, sage
  moss pebble, blue-grey moon shard.

## Known weaknesses

- Mochi: the pink lower half has a fine crosshatch dither from the generator, which reads as "dusty" but
  is a little noisier than its siblings. The powdery top reads only subtly at 2x.
- Crumb: the "flatter broken side" (lower left) is suggested by plum facets more than by the silhouette.
