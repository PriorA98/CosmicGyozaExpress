# Asteroids: provenance

Status: wave 2, updated 2026-10-02. Generations dated 2026-10-01. Folder owner: the asteroids asset producer
(Claude + Codex).

## Outputs (match `src/data/assetManifest.ts`)

| File | Canvas | Body (art px) | Raw source | Generations tried |
| --- | --- | --- | --- | --- |
| asteroid-sleepy.png | 76x76 | 68 | raw/asteroid-sleepy-v1.png (the approved probe) | 1 |
| asteroid-rice.png | 92x92 | 84 | raw/asteroid-rice-v1.png | 1 |
| asteroid-tea.png | 100x100 | 92 | raw/asteroid-tea-v1.png | 1 |
| asteroid-mochi.png | 84x84 | 76 | raw/asteroid-mochi-v5.png | 5 (v1-v3 round 1, v4-v5 wave 2) |
| asteroid-crumb.png | 66x66 | 58 | raw/asteroid-crumb-v1.png + scripted flat cut | 3 (v1, v2, v3) |
| asteroid-debris.png | 96x24 (4 x 24x24) | ~20 | raw/asteroid-debris-v1.png -> raw/slices/debris-v1-{1..4}.png | 1 |

All are transparent RGBA. Every rock is built with `--pad 4`, so the body's longest axis equals the canvas
minus 8, which is the route obstacle radius in art px. At the integer 2x display scale, the visible body
diameter equals 2 * radius. Mochi is wider than tall (76x64 bbox) and crumb is cut flat (58x57), so their
widths carry the diameter. Each rock has 34-36 colours after quantizing. The debris strip has 28 colours in
ONE joint palette.

## Sources

- **Codex image_gen via codex-cli 0.159.3** (`codex-companion.mjs task --write`).
  - Round 1 (2026-10-01 14:27-14:37): rice v1, tea v1, mochi v1-v3, crumb v1, debris strip v1. The prompts
    are saved verbatim in `scripts/codex-prompts.txt`.
  - Wave 2 (2026-10-01 21:3x-21:45): two dispatches, for mochi v4 + crumb v2, then mochi v5 + crumb v3.
    The dispatch prompts and the exact `image_gen` calls Codex made (recovered from the `~/.codex/sessions`
    rollouts) are saved verbatim in `scripts/codex-prompts-w2.txt`. Style refs viewed with view_image:
    `art-src/_probe/asteroid-probe.png`, `raw/asteroid-rice-v1.png`, `public/assets/ship/gyoza-idle.png`, and
    the previous mochi and crumb raws.
    - Mochi v4/v5 prompt core: "3 FLAT CLEAN BANDS of colour, absolutely NO dithering, NO checkerboard ...
      6-10 small isolated square powder-sugar specks ... Full continuous dark plum outline (#3B2E4A to
      #1D1F33) ... including the lit top and top-right edge". The v5 prompt added "broad CURVED
      CRESCENT-shaped color bands wrapping with the silhouette", because v4's straight bands read as a
      flat sticker.
    - Crumb v2/v3 prompt core: "lower-left quarter is cut off by one long STRAIGHT flat fracture edge".
      v3 asked for "only ~15-20% of the disc" removed.
- **Sleepy**: `raw/asteroid-sleepy-v1.png` is a byte-identical copy of `art-src/_probe/asteroid-probe.png`.
  No new generation was made.

## Helper scripts (`scripts/`)

- `build_w2.sh [out_dir]` is the exact wave-2 rebuild. Run it from the repo root. It writes intermediates to
  `work/build/`. On 2026-10-02 it was re-run into a scratch dir and matched all six shipped PNGs pixel for
  pixel.
- `flood_key.py` removes magenta with a flood fill from the border only, so the pale pink of mochi survives.
- `close_outline.py` recolours light silhouette-edge pixels to the darkest edge ink, which gives a
  continuous 1 px outline. The silhouette does not grow.
- `restore_blush.py` re-paints sleepy's cheek blush (30 px) from the raw, because quantizing drops it.
- `cut_flat.py` slices a straight chord off a round sprite, re-inks the cut, and paints a flat fracture face.
  In wave 2 it gained `order=inner`: ink, then a shade band, then a lit ridge row innermost.
- `quantize_joint.py` quantizes a whole strip to ONE palette (debris).
- `slice_strip.py` splits the debris strip into padded subjects. `dedither.py` was a wave-2 experiment
  (blurring the v2 dither away) and is not used in the build.

## Exact build commands (from `scripts/build_w2.sh`)

```sh
px() { python tools/art/pixelize.py "$@"; }
R=art-src/asteroids/raw; T=art-src/asteroids/work/build; SC=art-src/asteroids/scripts; O=public/assets/asteroids
px $R/asteroid-sleepy-v1.png $T/sleepy-q.png --size 76x76 --colors 36 --pad 4
python $SC/restore_blush.py $R/asteroid-sleepy-v1.png $T/sleepy-q.png $T/sleepy-b.png 0.3
python $SC/close_outline.py $T/sleepy-b.png $O/asteroid-sleepy.png
px $R/asteroid-rice-v1.png $T/rice-q.png --size 92x92 --colors 36 --pad 4
python $SC/close_outline.py $T/rice-q.png $O/asteroid-rice.png
px $R/asteroid-tea-v1.png $T/tea-q.png --size 100x100 --colors 36 --pad 4
python $SC/close_outline.py $T/tea-q.png $O/asteroid-tea.png
python $SC/flood_key.py $R/asteroid-mochi-v5.png $R/keyed/asteroid-mochi-v5.png 90
px $R/keyed/asteroid-mochi-v5.png $T/mochi-q.png --size 84x84 --colors 36 --pad 4 --key none
python $SC/close_outline.py $T/mochi-q.png $O/asteroid-mochi.png
px $R/asteroid-crumb-v1.png $T/crumb-q.png --size 66x66 --colors 36 --pad 4
python $SC/close_outline.py $T/crumb-q.png $T/crumb-ol.png
python $SC/cut_flat.py $T/crumb-ol.png $O/asteroid-crumb.png 3 35 25 63 4 "#ECD3B0" "#9486AA" inner
S=$R/slices/debris-v1
px $S-1.png $S-2.png $S-3.png $S-4.png --sheet $T/debris-a.png --size 24x24 --colors 48 --pad 2
python $SC/quantize_joint.py $T/debris-a.png $T/debris-q.png 28
python $SC/close_outline.py $T/debris-q.png $O/asteroid-debris.png
```

Every rock is re-normalized from its raw generation at the new size. None of them is a rescale of an
older PNG. All rocks use the same colour count (36) and the same outline pass, so the outline weight is
consistent. The only hand-chosen values are the crumb cut chord, (3,35) to (25,63), and its two facet
colours, which were picked from crumb's own palette. No pixels were hand-painted.

## Wave-2 critic fixes

- **Mochi dither and outline**: v5 is shaded in flat curved bands (warm white, then pale pink, then dusty
  rose, then lavender plum) with about 10 isolated sugar specks. It has no checker dither. The outline is a
  continuous dark plum (#1F0531, with #3F234C on part of the edge) on all 201 edge pixels, including the lit
  top-right. Rejected: v4 (straight diagonal bands, read like a flag) and the de-dithered v2 (muddy).
- **Crumb silhouette**: it keeps the v1 body, whose palette and craters were liked. A straight chord is
  removed on the lower left, then re-inked, then given a 4 px flat plum fracture face (#9486AA) with a cream
  lit ridge (#ECD3B0) where the face meets the crust. In round 2 this face was a pale blue (#B7C8D2) lit
  row, which looked foreign next to the cream palette. That was changed on 2026-10-02. Rejected: crumb v2
  (half-disc cheese wedge) and crumb v3 (turned into a brown cookie that clashed with rice, and its cut was
  barely visible).
- **Debris palette**: the 4 frames are pixelized at 48 colours and then quantized together into one
  28-colour palette. Before, each frame had its own palette, about 100 colours in total.
- **`art-src/_probe/` leftover**: `asteroid-72.png` is archived in `work/probe-archive/`. The 1 MB
  `asteroid-probe.png` is byte-identical to `raw/asteroid-sleepy-v1.png`, so it was not duplicated. The
  original `art-src/_probe/` folder is outside this producer's write scope. Other wave-2 producers also use
  `asteroid-probe.png` as a style reference, so deleting it is left to the integrator (see the integration
  request).

## Housekeeping (2026-10-02)

Redundant intermediates were removed. These were comparison sheets, old `work/rebuild/` copies, unused
de-dither and colour-count trials, and the keyed copies of raws that the build does not use. All of them can
be regenerated from `raw/` and the scripts. Previews (3x, from `pixelize.py --preview`) are in `previews/`.

## Known weaknesses

- Mochi's top-left highlight is a fairly large flat cream patch. It reads as "powdered" but is the softest
  of the five.
- Debris pebbles have a dark-ink outline that is close to the cosmos background colour, so at 2x they read
  by fill colour rather than by outline. They are small transient particles, so this is acceptable.
- Crumb's fracture face is a scripted flat band, not painted facets. It reads clearly at 2x, but at 8x
  zoom it looks more geometric than the rest of the rock.
