# Ship frame polish provenance

Date: 2026-10-01. Scope: polish only (no redesign) of the 9 existing Gyoza ship frames in
`public/assets/ship/`. File names are unchanged.

## Source
- Originals were copied unchanged to `originals/`. They are ~2x smooth-upscaled pixel art on
  inconsistent canvases (143x128, 144x127/141/157, 158x135, 170x149). They are not on a clean
  2x grid: only ~15-30% of 2x2 blocks are uniform (`scripts/analyze.py`).
- No Codex or image generation was used. The work is fully programmatic (Python + Pillow).

## Pipeline (`python art-src/ship/scripts/register.py` then `python art-src/ship/scripts/polish_ship.py`)
1. **Registration by the saucer, not the bounding box** (`register.py` gives `scripts/offsets.json`):
   the alpha mask of the gyoza-idle saucer band (rows 55-92 = rim + hull) is matched against each
   frame with a brute-force integer shift (+/-25 px) for maximum overlap. Results: fly-01..03
   (-2,-2) at 99.6%, incident-01 (2,5), incident-02 (0,5), incident-03 (12,1), where the dome lines
   up exactly. incident-04 (explosion) and incident-05 (smoke) have no saucer, so they are aligned by
   alpha centroid to the idle centroid: (7,-5) and (-12,7).
2. Every frame is pasted onto one 144x160 canvas with the idle frame origin at (0,-6). That puts
   the dome top at y~12, the rim at canvas y~58 (art row 29) in every frame, and lets the flames hang
   down to y~150. Detached debris that would be clipped by the canvas edge (incident-03 left chunk)
   is nudged inward as a whole component.
3. Premultiplied 2x box downscale to 72x80 art px.
4. Alpha: hard alpha (>=112) everywhere, except pale glass pixels (dome), which keep two soft
   levels (110/180). incident-05 smoke keeps 3 levels (90/170/255).
5. One shared 32-colour palette for all 9 frames (median cut). Each entry is pulled toward the
   nearest design token (60% if within 30 RGB, 30% if within 55).
6. Cleanup: stray single pixels removed, pinholes filled. Dark silhouette pixels are unified to ink
   #1D1F33. Grey outline/highlight mixes on the outer dome ring are re-inked and grey semi-alpha
   dome fringe is dropped. The pale low-saturation halo outside the hull outline and soft fringe on
   the hull and legs are removed.
7. Gentle polish allowed by the brief: a 1px warm rim light on the hull pixels just inside the
   top-left ink outline, and a 1px soft pale glass rim (D9E4E8 @ alpha 96) outside the upper dome
   arc so the dome reads on dark space.
8. 2x nearest upscale to 144x160, then save (with retry, because Windows watchers briefly lock PNGs).

Art-res intermediates (72x80) are in `art/`. Preview strip helper: `scripts/strip.py`.

## Notes / weaker spots
- gyoza-incident-05 (dissipating smoke) was thin and noisy in the original and is still the
  weakest frame.
- The dome ring is inherited from the blurry source, so it is slightly uneven at 2x. Redrawing it
  by hand would be a redesign, which is out of scope.
- In game (`e2e/out/w1-assets-celestial*/`): the title, flight-cruise and flight-incident states
  render all frames with no asset failures.
