# UI chrome provenance

Date: 2026-10-01 (wave 1), revised 2026-10-02 (wave 2 round 2). Folder owner: UI asset package.

All five production files are authored **programmatically at exact art resolution** by
Claude-side Pillow scripts in `art-src/ui/scripts/`. No image-generation output and no
`tools/art/pixelize.py` normalization step is involved: the scripts write the final PNGs
directly (alpha is 0/255 everywhere except `panel-dark.png`, which uses intentional soft alpha).

## Why not Codex

The brief recommended Codex + PowerShell/System.Drawing for exact pixel placement of the
icons. Two Codex dispatches were made with the prompt in `scripts/prompt-icons.txt`:

- `scripts/codex-icons-v1.log`: Codex read the style references, then failed with a usage limit
  before writing any pixels.
- `scripts/codex-icons-v2.log`: retry failed immediately with the same usage limit
  ("try again at 6:33 PM").

Because the work was blocked, the icon pixel maps were authored directly in Python with the
same rules as the Codex prompt (16-row character maps, project palette, auto 1px ink outline,
no anti-aliasing). Nothing exists in `raw/` because no generations were produced.

## Files

| File | Size | Source script | Command |
| --- | --- | --- | --- |
| `public/assets/ui/icons.png` | 256x16, 16 frames of 16x16, transparent | `scripts/make_icons.py` | `python art-src/ui/scripts/make_icons.py public/assets/ui/icons.png art-src/ui/previews/icons.preview.png` |
| `public/assets/ui/panel-parchment.png` | 48x48, 8px nine-slice | `scripts/make_nineslices.py` | `python art-src/ui/scripts/make_nineslices.py public/assets/ui` |
| `public/assets/ui/panel-dark.png` | 48x48, 8px nine-slice, soft alpha | `scripts/make_nineslices.py` | (same command) |
| `public/assets/ui/button.png` | 144x24, 3 frames of 48x24, 6px nine-slice | `scripts/make_nineslices.py` | (same command) |
| `public/assets/ui/keycap.png` | 32x16, 2 frames of 16x16, 4px nine-slice | `scripts/make_nineslices.py` | (same command) |

Note: `make_nineslices.py` takes only a positional output directory (default `public/assets/ui`);
it has no `--help` flag.

## icons.png (`ui-icons`)

Frame order: 0 thrust, 1 package, 2 radar, 3 speed, 4 drift, 5 incident, 6 memory, 7 moon,
8 tea, 9 pause, 10 settings, 11 home, 12 sound-on, 13 sound-off, 14 keyboard, 15 touch.

Method: each glyph is a 16x16 fill map (hand-drawn character rows for most, small procedural
shapes for radar / speed / moon / settings). A 4-neighbour 1px ink `#1D1F33` outline is added
automatically around every filled region so every glyph reads on both cosmos and parchment
backgrounds. Glyphs sit in about x/y 2..13 of each cell. The palette is the design tokens plus
a few in-between shades (light amber `#EBC27A`, pale amber `#F6DEA6`, amber shade `#B5823F`,
parchment shadows `#E3D5B8` / `#C9B995` / `#A8976F`, teal and dusk-blue light and dark steps,
brick deep `#9E4F3E`).

Iteration notes:
- v1 (earlier session): all 16 glyphs drawn. The package looked like a TV with an antenna,
  the keyboard keys were nearly invisible (plaster on parchment), and the touch hand was a blob.
- v2 (this session): the package became a terracotta furoshiki bundle with a bunny-ear knot and
  cream dots. The keyboard now has plaster keys on a darker parchment body with a deep-shadow
  right and bottom edge. The touch hand was redrawn with a raised index finger, separated
  fingers, a thumb, and two separate amber tap sparks that no longer merge into the finger's
  outline.

## Nine-slices (`make_nineslices.py`)

Every edge band is constant along its stretch axis and every centre is flat, so Phaser
nine-slice stretching never smears ornament. All ornament sits inside the corner insets.

- **panel-parchment**: `#F9F3E5` fill, `#D7CDB5` border, darker `#B9AB8B` bottom edge,
  terracotta corner stitches, and faint grain flecks kept inside the 8px corners.
- **panel-dark**: `#14162B` at about 85% alpha, a 1px border that is plaster blended about 20% into the panel colour (baked in, alpha about 88%), and tiny
  rivets in the corners.
- **button**: 2px ink border and a hard 3px ink bottom shadow. Normal face is `#C97B5A`,
  hover is a lighter ember tint `#D98C62`, and the pressed face moves down 2px with a smaller
  shadow. Each face has a top-left highlight and a bottom-right shade.
- **keycap**: plaster face with a heavier bottom border. In the pressed frame the face moves
  down and the bottom lip is smaller.

Validation: the panels and button were stretch-tested with a Pillow nine-slice mock at
120x70, 64x24 and 30x16, on dark and parchment backgrounds, and showed no seams or smearing.
The contact sheet is `e2e/out/contact-ui.png`. The in-game capture
(`e2e/out/w1-assets-ui/title@desktop.json`) lists no `ui-*` keys in `assetFailures`.

Manual edits: none outside the scripts. Previews are in `art-src/ui/previews/`.

## Wave 2 revision (2026-10-02)

Source: programmatic Claude-side Pillow scripts again (no Codex dispatch this wave). These are
1px-exact 16x16 glyphs and nine-slices, which image generation cannot hit cleanly. The
round-1 v1/v2 Codex attempts were blocked by usage limits (see above). Nothing is in `raw/`.
Previous versions are kept for comparison: `scripts/make_icons_v2.py`,
`scripts/make_nineslices_v1.py`, `previews/icons-v2.png`, `previews/button-v1.png`,
`previews/keycap-v1.png`.

Commands (exactly what produced the shipped files):

```
python art-src/ui/scripts/make_icons.py public/assets/ui/icons.png art-src/ui/previews/icons.preview.png
python art-src/ui/scripts/make_nineslices.py public/assets/ui
python tools/art/contact_sheet.py public/assets/ui --out e2e/out/contact-ui.png
```

`panel-parchment.png` and `panel-dark.png` are byte-identical to wave 1 (md5 checked before
and after the rerun).

### icons.png v3 (critic round 1: assets 7.6)

`make_icons.py` now also supports per-glyph **overlays**. These pixels are drawn after the
automatic 4-neighbour ink outline, so thin ink or amber detail does not get its own
outline and turn into a blob.

- **1 package**: redrawn as the `items/package.png` furoshiki. Two broad cloth ears flare out
  of a pinched deep-terracotta knot over a round body. The body has a diagonal deep fold and
  five *scattered* cream dots. The v2 dots sat in an eye-like pair, which made it read as a
  horned bug face.
- **2 radar**: a satellite dish (in v2 it was a teal disc and read as a coin or clock). The dish
  is a 3/4-view ellipse facing up-right: a lit plaster and dusk-blue concave face inside a
  shaded back rim, an ink feed mount, a 1px parchment-shadow feed arm (overlay), an outlined
  amber knob, a stand with a base plate, and two ember signal ticks.
- **12 sound-on**: a narrower speaker with two clean arcs (overlay). Each arc is 1px ink on
  the inner edge and 1px amber on the outer edge, with a clear gap between the speaker, arc 1
  and arc 2. On parchment they read as ink arcs, and on dark HUD panels they read as amber
  arcs. In v2 the waves blurred into a dark burst.
- **15 touch**: a pointing hand. It has a tall index finger, two folded fingers separated by
  shade columns, and a thumb split from the index by a gap. It also has a terracotta cuff and
  three ember tap rays (overlay) around the fingertip.
- Glyphs stay within x 1..14 so neighbouring frames never touch.

### button.png / keycap.png v2 (outer outline for very dark backgrounds)

- In v1 the depth was a 2px ink border plus a 3-5 row pure-ink lip. On cosmos `#1A1B2E` the
  lip disappeared and the button looked flat and floating.
- Now a **single 1px ink outer outline wraps the whole silhouette** (face + lip), with
  chunky 2px-clipped corners. The lip is a coloured slab side, so depth reads on dark
  backgrounds and the outline frames the shape on parchment.
- **Button** (48x24 frames, 6px insets, unchanged sizes):
  - Rows: outline 0, highlight 1, face 2..17, bevel shade 18, side 19..21, side-dark 22,
    outline 23.
  - Pressed sinks the face 2px (outline top at row 2, face to row 20, side shrinks to 1 row +
    side-dark).
  - Sides: normal `#8C503E` / `#6E3D30`, hover `#985843` / `#784334`.
  - Faces: normal `#C97B5A`, hover `#D98C62`, pressed `#BB7052`.
- **Keycap** (16x16 frames, 4px insets, unchanged sizes): 1px ink outer outline, plaster face
  rows 1..10, warm skirt `#D7CDB5` rows 11..13, skirt-dark `#B9AB8B` row 14, outline 15.
  Pressed sinks the face 2px onto the skirt.
- Every edge band is still constant along its stretch axis. The glint is corner-only.

Validation:
- `previews/stretch-test.png`: Pillow nine-slice mock at 64x22, 120x30 and 26x16 on cosmos
  and parchment. No seams or smearing.
- `previews/focus.png`: 12x crops of the redrawn icons.
- `e2e/out/contact-ui.png`: contact sheet.
- `node e2e/capture.mjs --states=title --label=w2-assets-ui`: `probe.assetFailures` is `[]`.
- File sizes are 216 B to 2.1 KB.

Manual edits: none outside the scripts.

Known weaker point: the package ears are still a symmetric pair. The glyph now reads as a
cloth bundle, but at 16 px it can still suggest bunny ears.
