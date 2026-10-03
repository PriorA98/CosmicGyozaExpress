# Gyoza ship frames: provenance (wave 2 full redraw)

Date: 2026-10-01 to 2026-10-02. This replaces the wave-1 "polish" pipeline (`polish_ship.py`,
`register.py`, `offsets.json`, `strip.py`). Those scripts are kept for history only and no longer
produce the shipped files.

## Contract
- 9 frames, each 64x80 art px, RGBA with hard alpha (no soft fringe on the ship). Displayed at
  integer scale 2 (`SHIP_ART` in `src/data/assetManifest.ts`).
- Saucer centre (the dumpling body) is at art (32,34) in every frame. All frames come from one
  parametric rig, so the registration is exact, not estimated.
- Hull is 52 art px wide (x 6..57). Ship bbox in the idle frame is (6,16)-(58,49). The longest
  flame (fly-03) ends at y=68, well inside the 80 px canvas.

## Source: `scripts/draw_ship.py` (programmatic true-resolution pixel art, Python + Pillow)
`python art-src/ship/scripts/draw_ship.py` writes `public/assets/ship/*.png` and `art-src/ship/art/*.png`.
Each part is rasterised directly at art resolution (one sample per art pixel at the pixel centre).
There is no resampling or downscaling. Parts are cleaned up as masks: spikes and singletons are
dropped, 1 px notches are filled, and a 1 px outline is taken from the mask boundary. Then the parts
are shaded with hand-picked ramps from the design tokens.
- Hull: a crescent gyoza. The rim is low in the middle, where the dome sits, and rises toward both
  rounded tips. There are 8 crimp scallops along it, each lit on its left facet and shaded on its
  right. A crease runs from each crimp valley down the side and curves outward. The golden dough body
  has a sheen streak at the top-left. The pan-fried toast belly has a wavy fry line, with a lit lip
  and deeper toast toward the bottom-right. Outline: dark brown (#5A3424 on the rim, #3A2120
  elsewhere). The scattered "blister" speckles were removed because the critic flagged isolated pixels.
- Dome: a disc of radius 13.2 with a continuous 1 px ink ring, a dusk-blue glass ramp lit from the
  top-left, and one white highlight arc plus one short glint. Inside it, a cream bun pilot
  (hand-placed 12x9 pixel map) with expressions: happy, squint, dizzy, shock.
- Legs: two angled struts with feet, in a warm slate metal ramp with an ink outline.
- Nozzle: a flange bolted to the hull underside, then a neck and a flared bell. It overlaps the
  hull, so the flame grows from the ship.
- Flame (fly-01..03): lengths 8/15/24 px, with a flicker wobble. Layers are brick edge, ember,
  amber, cream core, plus nozzle glow. It replaces the old "brown heart".
- Incident frames:
  1. Squash: sx 1.1, sy 0.82, legs splayed, squinting pilot.
  2. Wobble: re-rasterised at -9 degrees with a dizzy face and three 4-point stars.
  3. Dome pops up: lifted 7 px and tilted 8 degrees, shocked face, two steam plumes rising from the
     rim gap.
  4. Puff cloud: 9 round cream lobes with a plum outline, round soft shading bands, feet peeking out,
     sparkles.
  5. Dissipating: 4 irregular soft puffs (2 lobes each) at alpha 230 with a 140-alpha edge, plus
     sparkles.
- Colours per frame: 8 to 31 (ship frames 26 to 31). All ramps are listed at the top of `draw_ship.py`.

## Codex image_gen (design exploration only)
- Tool: Codex image_gen via codex-cli 0.159.3. Prompt: `raw/prompt-idle-v1.txt`. Log:
  `raw/codex-idle-v1.log`.
- Raw files: `raw/gyoza-idle-v1a.png` (pilot silhouette), `raw/gyoza-idle-v1b.png` (mountain and moon).
- Normalised test (`work/codex-v1a.png`, `work/codex-v1b.png`): the attempt used
  `python tools/art/pixelize.py raw/gyoza-idle-v1X.png work/codex-v1X.png --size 64x80 --anchor center --colors 32`.
  At 52 px wide, the crust texture turned into noise and the dome ring broke up. The critic had
  rejected exactly these defects, so no Codex pixels are shipped.
- What was taken from it: the crescent hull silhouette, with the dome sitting in the rim dip and
  the tips rising. That shape came from v1b and replaced the earlier lens or saucer hull of the rig.

## Iteration notes
- Rig v1 to v12 (`preview/v*.png`): first a lens-shaped hull with a small dome, too pale and
  pie-like.
- Wave-2 resume: crescent hull, warmer dough ramp, distinct toast ramp
  (#D9944E/#C27A40/#A35F33/#7E4528), bigger dome (R 11.4 -> 13.2), pilot raised so the face clears
  the rim, warmer leg metal, thinner legs.
- Puff shading changed from linear "lit" bands, which made octagonal facets, to round bands around
  a top-left highlight point.
- Steam in incident-03 moved to rise from the dome gap. Incident-05 is irregular two-lobe puffs.
- Preview: `preview/w2-final-3x.png` (all frames at 3x on cosmos and parchment).
  `scripts/zoom.py <dir> <out> <scale> names...` zooms selected frames.

## Weaker spots
- The dome glass is opaque tinted glass, not see-through, so it reads a little like a helmet.
- The pilot's chin is tucked behind the rim (intended "peeking", but tight).
- There are only two visible legs. The centre position is taken by the thruster nozzle, so a third
  leg would be hidden or cluttered.
- On the cosmos background the ink and dark-brown outline has low contrast with the background.
  The silhouette reads from the interior colours.

## Pre-rotated sheets (2026-10-02, integrator)

`public/assets/ship/rot/<frame>-rot.png` for all 9 frames: generated by `tools/art/rotsprite.py --pivot 32,34 --cell 112 --angles 32 --columns 8` from the production frames above. No manual edits. Regenerate after any frame change.

## Wave 3 round 3 polish (2026-10-02, asset producer; dated 2026-10-01 pipeline unchanged)

Source: the same programmatic rig, `scripts/draw_ship.py`. No Codex pixels were used. Each frame keeps
the same canvas, bbox and pivot (32,34) as round 2; this was checked per frame against the backup in
`work/r2-shipped/`.

Fixes for the critic's round-2 nits:
- Crimp pleats: each of the 8 scallops is now a 2-value pair. The lit facet uses DOUGH[0] or DOUGH[1]
  and the shadow facet uses DOUGH[2] or DOUGH[3], depending on the side toward the light. The frill
  band is deeper (2.6 -> 2.9). Each crease now starts with a darker valley colour, `VALLEY #9A6236`
  (tk < 2.2), and has a lit pixel on its right. Creases are about 0.8 px longer.
- Profile readability (flight critic): there is a 1 px darker crust rim (CRUST[5]) just inside the
  outline on the belly and tips, and a TOAST[3]/[4] rim on the fried belly.
- Dome: a second, softer highlight row (GLASS[1], r 0.82-0.97, angle -172 to -98 degrees) sits
  outside the white arc, so the glass reads as a curved dome.
- Rotation: all 9 `rot/*-rot.png` sheets were re-baked with
  `python tools/art/rotsprite.py public/assets/ship/<f>.png public/assets/ship/rot/<f>-rot.png --pivot 32,34 --cell 112 --angles 32 --columns 8`.

Commands: `python art-src/ship/scripts/draw_ship.py --out art-src/ship/work/r3a --art art-src/ship/work/r3a`
(staging), then `python art-src/ship/scripts/draw_ship.py` (production), then the rotsprite loop above.
Previews: `preview/r3-idle12-old.png` and `preview/r3-idle12-a.png` (before/after, 12x),
`preview/r3-idle12-b.png` (final, 12x), `preview/r3-all-4x.png`, `preview/r3-rot-cells-3x.png`,
`preview/r3-rot-zoom.png`.

Remaining weak spots: the pilot face is still about 6 px wide (eyes are single pixels). At 33.75
degrees and above, RotSprite sometimes drops an eye pixel or a pixel of the dome ring. At ship size
this is an accepted cost of baking rotation offline.

## v3 (2026-10-03): back to the player's original design, refined
The player asked for the ship to look like their original drawing (`assets/reference/gyoza-ship/default.png`,
143x128, frames default / fly-1..3 / dmg-1..5), just more refined. The v2 crescent saucer had drifted too far from it.
`scripts/draw_ship_v3.py` reuses the v2 rig helpers (raster, outline, flame, puffs, stars) and replaces the parts
with the original's silhouette:
- a tall rounded glass dome, about 65% of the hull width, kept nearly clear (glass tint alpha 18) so the sky shows
  through as in the original, with a light inner rim, a crescent glint and the dark cockpit console with its two
  peaks;
- a deep convex bowl hull with a raised, crimped tan rim, pale dough with tan flanks, pleat marks and a toast belly;
- sturdy splayed legs crossing in an X on each side, with feet;
- a small nozzle stub.
Same contract as v2: 64x80, pivot (32,34), integer 2x. Incident frames: squash; dizzy tilt with crust crumbs;
dome pop with steam; beige puff with crust chunks (after the original dmg-4); drifting puffs.
Commands:
```
python art-src/ship/scripts/draw_ship_v3.py
for f in gyoza-idle gyoza-fly-01..03 gyoza-incident-01..05: python tools/art/rotsprite.py public/assets/ship/$f.png public/assets/ship/rot/$f-rot.png --pivot 32,34 --cell 112 --angles 32 --columns 8
python art-src/items/scripts/compose_postcard_v4.py art-src/items/raw/postcard-v3.png art-src/items/work/w4/pc-v4-shipv3.png   (re-stamps the memory postcard)
```
