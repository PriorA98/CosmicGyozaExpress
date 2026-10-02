# Celestial art provenance

## Wave 2 (2026-10-01/02): Codex image_gen. This is the current production set.

Wave 2 regenerated all three bodies with Codex image generation (codex-cli 0.159.3, native image tool,
1254x1254 raws on flat #FF00FF). The raws were normalized with a pure-Pillow script,
`scripts/normalize_w2.py`. Its steps are: magenta key with a 2 px erosion, exact disc placement
(raw disc centre and diameter to art geometry), BOX downscale with coverage-normalised colour and
hard alpha, an optional top-left Lambert terminator tint, per-region palettes (so the roof, tea and
bandage keep their accent colours), isolated-pixel cleanup on the body only, and a silhouette
re-ink (ink #1D1F33 on the shadow side, a darker local colour on the lit side).
Note: `raw/` is gitignored. The raws stay local only, and the prompts are kept in `scripts/`.

Prompts:
- `scripts/codex-prompt-w2-v1.txt`: tea-moon-v1, planet-far-plum-v1, planet-im-fine-v1. All prompts
  have Codex first view_image the ship idle and fly-02 frames, the asteroid probe, delivery-v2.png and
  `public/assets/lunar/lunar-teahouse.png` (the canonical tea house).
- `scripts/codex-prompt-w2-v2.txt`: planet-far-plum-v2/v3 (ring geometry fixes) and tea-moon-v2
  (fewer craters, calmer surface, round steam puffs in place of a "?" curl).
- `scripts/codex-prompt-w2-v3.txt`: planet-far-plum-body-v4 (the same plum body with no ring).
  The log is in `work/codex-v3.log`. The PNG was saved before the session was interrupted.

### tea-moon.png (192x192, key `celestial-tea-moon`): Codex v2 chosen over the wave-1 programmatic version
- Raw: `raw/tea-moon-v2.png` (v1 rejected: too many mottled craters, and question-mark-shaped steam).
- Command: `python art-src/celestial/scripts/normalize_w2.py tea-moon art-src/celestial/raw/tea-moon-v2.png`
  The raw disc is at (627,677) with d=1014. It maps to the art disc at (90,112) with d=144. Region
  palettes: body 20, house 14, cup 7.
- Manual/scripted edits: the raw's tiny steam puffs (they were about 2 art px and got re-inked) were
  cleared and replaced by 3 soft round painted puffs (`steam`). The two windows were repainted as
  canonical round 5x5 amber windows (`glow_windows`), because the downscale had turned them to mud.
- Why it beats wave 1: the tea house now matches lunar-teahouse.png (round cream cottage, domed
  orange shingle roof, round warm windows, arched door, stone base). Wave 1 had a pagoda house on
  stilts, which was non-canonical. The teacup crater reads as cup + tea + handle carved into the
  surface. The craters are softer and fewer, with lit rims, and the terminator is cleaner.
  Weaker point: the body leans cream more than jade.

### planet-im-fine.png (128x128, key `celestial-im-fine`): Codex v1 chosen over wave 1
- Raw: `raw/planet-im-fine-v1.png`.
- Command: `python art-src/celestial/scripts/normalize_w2.py planet-im-fine`
  The raw disc is at (630,628) with d=1060. It maps to the art disc at (64,64) with d=106. Region
  palettes: body 22, bandage 7. Lambert tint is #5E5586 at strength 0.45.
- Why it beats wave 1: richer, hand-painted-looking teal continents, a readable cream cross bandage
  with a peach pad and a crack peeking out, and a gently wobbly but still round silhouette. Wave 1
  read as a smooth egg with stripy dither bands. Weaker point: the top rim is a little jaggy at 1x.

### planet-far-plum.png (96x96, key `planet-far-plum`): hybrid, Codex body + programmatic ring
- Raws: v1 to v3 all drew the ring with broken geometry (the front band did not join the ring ends,
  or the ring was off-centre). v4 is a ringless body: `raw/planet-far-plum-body-v4.png`.
- Commands:
  `python art-src/celestial/scripts/normalize_w2.py planet-far-plum-body art-src/celestial/raw/planet-far-plum-body-v4.png art-src/celestial/work/plum-body-n1.png`
  This maps the raw disc at (626,626) with d=914 to the art disc at (48,49) with d=60. It uses a body
  palette of 20 and a tint of #5A5078 at 0.35.
  `python art-src/celestial/scripts/compose_plum.py art-src/celestial/work/plum-body-n1.png public/assets/celestial/planet-far-plum.png`
  This draws an exact tilted elliptical ring at art resolution (rx 45, ry 11, tilt -0.30 rad, a
  5-tone lavender-grey ramp lit from the left). The back half is drawn only where the body is
  transparent, and the front half is drawn over the body. It adds a one-notch ring shadow on the
  body and a thin edge under the front band.
- Why it beats wave 1: the body has real soft bands, a top-left highlight, an ink outline on the
  shadow side and a stepped terminator. Wave 1 was a flat, low-detail disc. The body stays fully
  opaque. Weaker point: the ring is programmatic and plainer than the painted body.

### Validation (wave 2)
- Previews: `preview/w2/*.preview.png` (3-4x, dark + parchment). Old vs new comparison:
  `work/cmp0.png` (tea moon) and `work/cmp1.png` (I'm Fine). Contact sheet: `e2e/out/contact-celestial.png`.
- Sizes and modes: 192x192, 96x96 and 128x128 RGBA. All have hard alpha. Files are 11.6 KB, 2.7 KB
  and 6.2 KB.
- The manifest is unchanged (same keys, paths and sizes).

---

## Wave 1 (history, superseded)


Date: 2026-10-01. Folder owner: wave-1 asset producer (celestial + ship polish).

## Source method

The Codex image generation dispatch (`scripts/codex-prompt-v1.txt`, codex-cli 0.159.3) failed right away
with a Codex usage limit ("try again at 6:33 PM"; see `scripts/codex-v1.log`). It produced no images,
so no `raw/` folder exists. Instead, all three bodies are **programmatic pixel art**: Python + Pillow scripts
that paint every pixel directly at art resolution (1 art px = 2 screen px in game). Nothing is
resampled, quantized or generated by a model. Palettes are hand-picked from the design tokens plus
in-between shades. Shading uses top-left Lambert light, banded into ramp tones. A checker dither
appears only in the narrow transition between tones, and only on the shadow side (`dither_below`),
which gives the soft dithered terminator.

Shared helpers: `scripts/paint.py` (ramp picking with limited checker dither, sphere light, ellipse
test, edge recolouring, preview).

Previews (dark + parchment, 3-4x): `preview/*.preview.png`. Contact sheet: `e2e/out/contact-celestial.png`.

## Files

### public/assets/celestial/tea-moon.png (key `celestial-tea-moon`, 192x192, transparent)
- Script: `python art-src/celestial/scripts/build_tea_moon.py [preview.png]`
- The moon disc is centred at (90,112) with r=72. It uses an 8-tone jade/cream ramp
  (3F5459 to FBF7EC), 4 soft maria and 17 craters foreshortened toward the limb. Each crater has a
  dark floor, a lit lower-right inner crescent and a lit upper-left outer rim.
- Teacup crater at (84,112) with r=14: an amber tea surface (7A4017 to F2C49A) with a curved
  reflection arc, a lip and handle in moon tones (it reads as a crater, not a decal), a faint saucer
  ring, and an ink lip on the shadow side.
- The tea house sits on the upper limb. It has plaster walls, timber posts, a two-tier terracotta
  pagoda roof, a warm ember/amber window with a mullion, a door, a hanging lantern, a stone chimney
  and wooden stilts down to the slope. It has an ink outline.
- Steam is 6 soft puffs (alpha 235 to 120, plaster with a dusk-blue shade) that curl up and to the
  right of the chimney.
- Silhouette: an ink edge on the shadow side and a mid-jade edge on the lit limb.
- Iterations: v1 had dither stripes all over the lit side, so dither was limited to the shadow
  steps. The blue porcelain cup looked like a UI decal, so it was moved to moon tones. Crater
  contrast went up. A thin steam line became puffs. Floating eave tips were reattached. A diagonal
  tea glint stripe became a curved arc.

### public/assets/celestial/planet-far-plum.png (key `planet-far-plum`, 96x96, transparent)
- Script: `python art-src/celestial/scripts/build_planets.py [preview_dir]` (function `far_plum`)
- Disc at (48,49) with r=29. It uses a 6-tone dusty plum ramp (4F4566 to B0A6C9) with faint bands
  parallel to the ring (+/- one tone).
- The thin tilted ring (rx 44, ry 10.5, tilt -0.32 rad, 3 to 4 px band in a slate/plum ramp) has a
  back half behind the planet and a front half drawn over it, plus a one-tone ring shadow on the
  disc.
- Low contrast on purpose. The only outline is a deep plum edge on the shadow side.

### public/assets/celestial/planet-im-fine.png (key `celestial-im-fine`, 128x128, transparent)
- Script: `build_planets.py` (function `im_fine`)
- A gently wobbly silhouette (r = 46 + small 2/3/5-lobe sines) in a 7-tone lavender ramp, with
  low-frequency teal continents in a 7-tone teal ramp (colours from planet04.png and the
  teal/plum tokens).
- A cross-shaped cream bandage on the upper-left: two rotated strips, a peach pad, breathing-hole
  dots and a B98A5E edge. Tiny crack lines peek out at both ends.
- Silhouette: ink on the shadow side and a darker local colour on the lit side.
- Iterations: v1 was too lumpy (egg/potato) and the bandage read as a flower. The wobble amplitude
  was halved and the bandage strips were made longer and thinner, with a square pad.

## Validation
- In game: `node e2e/capture.mjs --states=title --label=w1-assets-celestial` gave `assetFailures: []`.
  The tea moon and plum planet render on the title. Flight states (`w1-assets-celestial-extra`) show
  the plum planet and I'm Fine in the parallax with no failures.
- All PNGs are 1.4 to 5.2 KB.

---

## Wave 3, critic round 3 (2026-10-01/02): atmospheric perspective for the far planet layer

Critic issue (flight-environment, minor): the far planets used the same density, saturation, contrast
and outline treatment as the foreground asteroids, so they read as stickers on one plane.

Method: programmatic Pillow post-process (no new Codex generation; the wave-2 Codex paintings are kept).
`scripts/atmos_w3.py` compresses value contrast around the body mean (form shading and surface detail are
scaled separately via a blur split), desaturates, blends toward a navy-plum haze #4B4C70, dims overall
value, reduces the palette, and replaces the silhouette ring (lit-side highlight + ink re-ink) with one
uniform soft haze-dark limb (#2C2C48 blend). Accent pixels listed in `--keep` (the I'm Fine bandage) get
the treatment at quarter strength so the gag still reads. Hard alpha, same canvas sizes, same keys.

Inputs: the wave-2 production PNGs archived as `work/w3/pre-w3-planet-far-plum.png` and
`work/w3/pre-w3-planet-im-fine.png`.

Exact build (reproducible, byte-identical output verified):
`python art-src/celestial/scripts/build_w3.py`, which runs
- `python art-src/celestial/scripts/atmos_w3.py art-src/celestial/work/w3/pre-w3-planet-far-plum.png public/assets/celestial/planet-far-plum.png --contrast 0.65 --haze 0.32 --sat 0.65 --colors 16 --limb 0.5 --value 0.88 --detail 0.55`
- `python art-src/celestial/scripts/atmos_w3.py art-src/celestial/work/w3/pre-w3-planet-im-fine.png public/assets/celestial/planet-im-fine.png --contrast 0.65 --haze 0.3 --sat 0.7 --colors 20 --limb 0.55 --value 0.92 --detail 0.6 --keep "#E4A271,#FBEED1,#F1DFC2"`

Iteration notes:
- a1-a5 (`work/w3/plum-a*.png`, `fine-a*.png`): the interrupted first attempt of this round. a4/a5 were
  shipped briefly, but their exact parameters were not logged, so they are superseded.
- b1 (current production, `work/w3/plum-b1.png`, `fine-b1.png`): slightly stronger push than a4/a5. The bright
  lilac top-left rim on I'm Fine is gone, the bandage is a touch duller but still reads. Comparison at 2x with
  the runtime multiply tint next to two asteroids: `work/w3/cmp-b1.png` (top = a4/a5, bottom = b1), made with
  `scripts/sim_w3.py`.
- tea-moon.png is unchanged (it is the destination and should stay vivid).

Validation: `e2e/out/w3-r3-assets-celestial/` (title, flight-start/cruise/incident, result-bumpy): 0 runtime
errors, `probe.assetFailures` empty. Contact sheet `e2e/out/contact-celestial.png`. Files: 2.2 KB, 5.1 KB.
Layout (ring planet under the route-note pill; asteroids crossing I'm Fine) is scene data in
`src/data/flightScenery.ts` and was passed on as integration requests. It is not changed here.
