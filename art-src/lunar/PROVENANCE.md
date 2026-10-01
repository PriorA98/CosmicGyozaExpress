# Lunar (Tea Moon landing site) art provenance

Date: 2026-10-01. Generator: Codex image_gen via codex-cli 0.159.3 (one call per prompt file, `codex-companion.mjs task --write`),
plus a hand-placed pixel redraw for the lantern. Normalization was done on the Claude side with Python + Pillow
(`tools/art/pixelize.py` and the helper scripts in `art-src/lunar/scripts/`). All commands run from the repo root.

Style references shown to Codex with view_image: `public/assets/ship/gyoza-idle.png`, `public/assets/ship/gyoza-fly-02.png`,
`art-src/_probe/asteroid-probe.png`.

## Codex prompts (verbatim in `scripts/`)

| Prompt file | Images produced | Codex log |
| --- | --- | --- |
| `scripts/prompt-a.txt` | `raw/lunar-sky-v1.png`, `raw/lunar-hills-far-v1.png`, `raw/lunar-ground-v1.png` | `scripts/log-a.txt` |
| `scripts/prompt-b.txt` | `raw/lunar-pad-v1.png`, `raw/lunar-teahouse-v1.png`, `raw/lunar-lantern-v1.png` | `scripts/log-b.txt` |
| `scripts/prompt-c.txt` | `raw/lunar-rocks-v1.png` | `scripts/log-c.txt` |

Codex noted that its magenta backgrounds were not exactly #FF00FF and that the terrain strips came out about 3:1 rather than
the panorama ratio requested. Both are handled on the Claude side: chroma key tolerance 60, plus tiling cross-fades.

## Per output file

### `public/assets/lunar/lunar-sky.png` (640x360, opaque)
- Source: `raw/lunar-sky-v1.png` (prompt A, image 1).
- Normalize (verified to reproduce byte-identical pixels):
  `python tools/art/pixelize.py art-src/lunar/raw/lunar-sky-v1.png public/assets/lunar/lunar-sky.png --size 640x360 --colors 40 --opaque --key none`
- Manual edits: none. Ringed terracotta/amber planet sits low right; centre and left are kept calm.

### `public/assets/lunar/lunar-hills-far.png` (640x96, transparent, tileable)
- Source: `raw/lunar-hills-far-v1.png` (prompt A, image 2).
- Normalize: `python art-src/lunar/scripts/lunar_tools.py strip art-src/lunar/raw/lunar-hills-far-v1.png <out> --size 640x96 --colors 28 ...`
  (chroma key, scale to 640+blend wide, cross-fade the right edge into the left for seamless tiling, quantize, hard alpha, despeckle).
  The exact `--vsquash/--top/--blend` values of the original run were lost in the usage-limit outage and could not be
  re-derived by a parameter sweep. The pre-fix normalized result is kept at `art-src/lunar/preview/lunar-hills-far.png`.
- Manual edit: `python art-src/lunar/scripts/fix_hills.py` clears a stray 3x4 dark block on the crest (x 32-34, y 36-39).
- Check: `lunar_tools.py seamcheck` gives an edge diff of 0.9 per row, and the seam is invisible in a 2x tiled preview (`preview/seams.png`).
  Content starts at row 18, so the top is transparent.

### `public/assets/lunar/lunar-ground.png` (640x64, tileable; surface contract row 8)
- Source: `raw/lunar-ground-v1.png` (prompt A, image 3).
- Normalize (verified to reproduce exactly):
  `python art-src/lunar/scripts/lunar_tools.py strip art-src/lunar/raw/lunar-ground-v1.png public/assets/lunar/lunar-ground.png --size 640x64 --surface 8 --colors 28 --blend 64 --vsquash 0.5`
- `--surface 8` puts the first 90%-solid row at art row 8 and fills every transparent hole from row 8 down.
  Result: rows 0-6 are empty, row 7 holds 38 px of pebbles/bumps sitting on the line, and rows 8-63 are fully opaque. Seam edge diff is 2.2 per row.

### `public/assets/lunar/lunar-pad.png` (176x24; landing surface row 6)
- Source: `raw/lunar-pad-v1.png` (prompt B, image 1).
- Normalize (verified to reproduce exactly): `python art-src/lunar/scripts/build_props.py pad v1`.
  Steps: chroma key, scale to 176 wide, quantize 28, align the first 70%-solid row to row 6, then clear rows 0-5 except the outer 12 px on each side (corner posts/tassels).
- Check: across x 12..163 the first opaque row is exactly 6. The corner post knobs reach rows 1-5.

### `public/assets/lunar/lunar-lantern.png` (strip 2 x 12x28; frame 0 dim, frame 1 lit)
- Source: hand-placed pixel map in `scripts/build_lantern.py`, traced from the colours and shape of `raw/lunar-lantern-v1.png`
  (prompt B, image 3). A box downscale of the raw to 12 px wide turned mushy.
- Build: `python art-src/lunar/scripts/build_lantern.py`.
- Iterations: v1 used a box downscale (mushy). v2 was a redraw with the lantern hanging from an arm on a post. v3 (resume pass, final)
  moves the lantern onto the top of a short centred post, because v2 read as a gallows or "[" bracket at 2x. The lamp centre is
  about 19 art px above the base (matches `lampHeightPx: 38` screen px). The lit frame has a computed ember halo with soft alpha
  (130 at 1 px, 55 at 2 px) hugging the paper. The base sits on the bottom row.

### `public/assets/lunar/lunar-teahouse.png` (96x80; base on bottom row)
- Source: `raw/lunar-teahouse-v1.png` (prompt B, image 2).
- Normalize (verified to reproduce exactly): `python art-src/lunar/scripts/build_props.py teahouse v1`
  (key, contain-fit 96x80 bottom-anchored, quantize 32).
- Manual edits: none.

### `public/assets/lunar/lunar-rocks.png` (strip 3 x 32x16; base on bottom row)
- Source: `raw/lunar-rocks-v1.png` (prompt C), split into the three clusters with
  `python art-src/lunar/scripts/lunar_tools.py split art-src/lunar/raw/lunar-rocks-v1.png 3 art-src/lunar/work/rocks-v1`.
- Normalize (verified to reproduce exactly): `python art-src/lunar/scripts/build_props.py rocks v1`
  (each cluster contain-fit into 32x16, bottom-anchored and centred; quantize 28).

## Inspection
- Previews: `python tools/art/pixelize.py --preview <png> --scale 3` (moved into `art-src/lunar/preview/`).
- Contact sheet: `python tools/art/contact_sheet.py public/assets/lunar --out e2e/out/contact-lunar.png`.
- In game: `node e2e/capture.mjs --states=title --label=w1-assets-lunar` reports no lunar keys in `assetFailures`. The
  `landing-descent` and `landing-settle-soft` captures show the full lunar scene.
