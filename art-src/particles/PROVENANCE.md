# Particles — provenance

Date: 2026-10-01. Folder owner: particles asset producer (Claude + Codex).
Outputs: `public/assets/particles/{thrust,dust,sparkle,steam,star}.png` (transparent horizontal strips).

## Pipeline summary

1. **Codex v1 (programmatic PowerShell + System.Drawing, codex-cli 0.159.3)** — one Codex `task --write`
   call. The prompt is saved verbatim at `scripts/codex-prompt-v1.txt`. Codex viewed the style references
   (ship idle/fly-02, asteroid probe, delivery-v2 screenshot) and authored every pixel as glyph grids in
   `scripts/make-particles.ps1` (exact ARGB SetPixel, no anti-aliasing), writing `raw/<name>-v1.png` and
   `raw/<name>-v1-preview8x.png`. Image generation was not used: the sprites (5x5 to 16x24) are far too small
   to normalize cleanly from image_gen output.
2. **Claude v2-v5 (Python + Pillow)** — `scripts/make_particles.py` ports the strong Codex glyph frames verbatim
   and replaces the weak ones (blocky thrust puffs, speckled fade-out frames) with round lobe clouds rendered
   at art resolution, lit from the top-left, snapped to palette glyphs with a few crisp alpha levels.
   `pixelize.py` was not needed (no downscaling/quantizing — output is authored at exact art size).

Rebuild: `python art-src/particles/scripts/make_particles.py public/assets/particles`
Preview: `python art-src/particles/scripts/preview.py public/assets/particles art-src/particles/previews/final-all.png 8`

Palette glyphs: plaster FBF7EC, butter FCE7A8 (hot core), parchment F4ECDC, parchment-deep ECDFC5, amber D4A055,
ember E08A4B, terracotta C97B5A, terracotta-deep A6614A, dusk-blue 9EB6C4, plus in-between shades
B2A5AD (warm grey, Codex), C9AE9B (warm taupe smoke), A79BB0 (dusk shadow) added by Claude.

## Per file

| File | Key | Size | Frames | Source |
| --- | --- | --- | --- | --- |
| thrust.png | fx-thrust | 128x24 | 8 x 16x24 | f1-3 Codex v1 flame glyphs (pointing down); f4-8 Claude lobe clouds |
| dust.png | fx-dust | 96x16 | 6 x 16x16 | f1-4 Codex v1 glyphs (f4 alpha 235); f5-6 Claude round clumps (alpha 175 / 95) |
| sparkle.png | fx-sparkle | 32x8 | 4 x 8x8 | Codex v1 glyphs (grow-peak-shrink, f4 alpha 140), ported verbatim |
| steam.png | fx-steam | 72x20 | 6 x 12x20 | f1-4 Codex v1 ribbon glyphs (alpha 200-225); f5-6 Claude glyphs (detaching curl, alpha 150 / 85) |
| star.png | fx-star | 15x5 | 3 x 5x5 | Codex v1 glyphs ported verbatim (f3 uses the full 5px cell for its 2px arms) |

Anchors: thrust content is horizontally centred, flame tip points down, puffs drift downward over the
lifecycle (emit from the ship bottom with origin near the top-centre of the frame). Dust sits on the bottom
centre. Steam rises from the bottom centre. Sparkle/star centred.

## Iteration notes

- v1 (Codex): flames, sparkle, star, dust f1-4 and steam f1-4 read well. Thrust f4-5 were faceted
  blocks and f8 / dust f6 / steam f6 were isolated speckles. Preview: `previews/v1-all.png`.
- v2 (Claude): procedural lobe clouds with diagonal light bands for the weak frames. Preview `previews/v2-all.png`:
  thrust f5 read as a bell, smoke frames looked like faceted rocks.
- v3: shading rewritten (offset highlight disc + 1-2px lower-right rim). Rim-precedence bug and multi-lobe
  highlights made lumpy shapes (`previews/thrust-v3-12x.png`).
- v4: highlight restricted to the main lobe, thrust f4 given an amber ring + butter core, f5-8 re-laid out as
  symmetric cloud puffs (`previews/thrust-v4-12x.png`, `previews/v4-all.png`).
- v5: dust f5-6 clumps separated and rim colours softened (`previews/dust-v5-12x.png`). Final: `previews/final-all.png`.

No manual pixel edits outside the scripts. All PNGs < 1 KB.
