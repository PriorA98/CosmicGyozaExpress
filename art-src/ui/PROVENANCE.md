# UI chrome provenance

Date: 2026-10-01. Folder owner: wave-1 UI asset package.

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
