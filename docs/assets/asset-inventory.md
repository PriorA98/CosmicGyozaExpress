# Reference Asset Inventory

Last updated: 2026-10-01 (section 9 added: production assets)

This catalog documents assets imported from the Gyoza animation handoff and normalized into `assets/reference/` (sections 1-8), and the production runtime assets in `public/assets/` (section 9).

## 1. Directory Policy

Raw source bundle:

- `references/design-handoff/`

Normalized reference assets:

- `assets/reference/`

Future production assets:

- `public/assets/` after the Phaser project is initialized.

Rules:

- Do not import directly from `references/design-handoff/` in production code.
- Do not use `references/design-handoff/gyoza-animation/project/uploads/` as a production source. It duplicates many files and includes older alternate frames.
- Optimize large images before shipping.
- Keep transparent PNGs for ship animation unless final tooling changes.

## 2. Gyoza Ship Assets

Canonical reference path:

- `assets/reference/gyoza-ship/`

| File | Dimensions | Role | Production Notes |
| --- | ---: | --- | --- |
| `default.png` | 143x128 | Idle/default ship | Use as base ship sprite. |
| `fly-1.png` | 144x127 | Flight frame 1 | Loop frame. |
| `fly-2.png` | 144x141 | Flight frame 2 | Loop frame. Height differs; align origin. |
| `fly-3.png` | 144x157 | Flight frame 3 | Loop frame. Height differs; align origin. |
| `dmg-1.png` | 158x135 | Incident frame 1 | One-shot crash/poof sequence. |
| `dmg-2.png` | 158x135 | Incident frame 2 | One-shot crash/poof sequence. |
| `dmg-3.png` | 158x135 | Incident frame 3 | One-shot crash/poof sequence. |
| `dmg-4.png` | 170x149 | Incident frame 4 | Larger frame; align origin. |
| `dmg-5.png` | 144x127 | Incident frame 5 | Final dissipating/settle frame. |

### Animation Timing

From `Gyoza Animation Sheet.html`:

- Idle: one held frame.
- Fly: 3 frames, 150ms per frame, looping. About 450ms per cycle.
- Damage: 5 frames, 100ms per frame, one-shot. About 500ms total.

From `game.js` and `game-delivery.js`:

- Damage sequence is displayed at about 160ms per frame, then respawns after a short linger.

Official recommendation:

- Fly loop: 150ms per frame.
- Gyoza incident: tune between 100ms and 160ms per frame.
- Add 400-700ms comedic pause after the incident before respawn.
- Use a consistent Phaser origin for all ship frames to avoid vertical jitter.

### Production Optimization

Recommended future production path:

```text
public/assets/ship/gyoza-idle.png
public/assets/ship/gyoza-fly-01.png
public/assets/ship/gyoza-fly-02.png
public/assets/ship/gyoza-fly-03.png
public/assets/ship/gyoza-incident-01.png
public/assets/ship/gyoza-incident-02.png
public/assets/ship/gyoza-incident-03.png
public/assets/ship/gyoza-incident-04.png
public/assets/ship/gyoza-incident-05.png
```

Before production:

- Consider packing frames into a spritesheet or texture atlas.
- Ensure all frames share a common canvas size or common anchor metadata.
- Preserve pixel rendering with no smoothing.

## 3. Planet Assets

Canonical reference path:

- `assets/reference/planets/`

All planet images are 1280x1280 PNG images.

| File | Dimensions | Suggested Usage |
| --- | ---: | --- |
| `planet00.png` | 1280x1280 | Tea Moon or title background planet candidate. |
| `planet01.png` | 1280x1280 | Black Hole Bakery or dark-route candidate. |
| `planet02.png` | 1280x1280 | Home station/hub candidate if not replaced by station art. |
| `planet03.png` | 1280x1280 | Green/teal route candidate. |
| `planet04.png` | 1280x1280 | Planet "I'm Fine" candidate due stormy gray/blue mood. |
| `planet05.png` | 1280x1280 | Sleepy Satellite or side node candidate. |
| `planet06.png` | 1280x1280 | Asteroid Bento Belt node candidate. |
| `planet07.png` | 1280x1280 | Matcha Nebula node candidate. |
| `planet08.png` | 1280x1280 | Optional asteroid/anxious route candidate. |
| `planet09.png` | 1280x1280 | Extra route or background candidate. |

Production notes:

- 1280x1280 is too large for many in-game map nodes.
- Generate optimized derivatives for runtime:
  - 128px or 192px for map nodes.
  - 512px for large background planets.
  - 1024px only for hero/title usage if needed.
- Keep originals as source/reference.
- Confirm visual fit per mission before locking planet-to-route mapping.

Recommended future production path:

```text
public/assets/planets/source/
public/assets/planets/map/
public/assets/planets/large/
```

## 4. Screenshots

Canonical reference path:

- `assets/reference/screenshots/`

| File | Reported Data | Role |
| --- | --- | --- |
| `delivery-initial.png` | JPEG data, 1380x806 | Early delivery HUD screenshot reference. |
| `delivery-v2.png` | JPEG data, 1380x806 | Updated delivery HUD screenshot reference. |

Note:

- These files have `.png` extensions but are reported as JPEG data.
- Keep them as visual references only.
- Do not ship them as production UI assets.

## 5. Duplicate Audit

The raw handoff contains two asset sources:

- `project/assets/`
- `project/uploads/`

Findings:

- `default.png` is duplicated exactly.
- `dmg-1.png` through `dmg-5.png` are duplicated exactly under names with spaces.
- `fly-1.png` through `fly-3.png` match `new fly 1.png` through `new fly 3.png`.
- `uploads/fly 1.png`, `uploads/fly 2.png`, and `uploads/fly 3.png` are different older alternates and are not part of the canonical copied reference set.
- `planet00.png` through `planet09.png` are duplicated exactly.

Canonical normalized source:

- `assets/reference/gyoza-ship/`
- `assets/reference/planets/`
- `assets/reference/screenshots/`

## 6. Missing Asset Categories

The current handoff does not provide production-ready assets for:

- Asteroids.
- Delivery zones.
- Docking indicators.
- Stars/nebula background layers.
- NPC final portraits.
- Package/delivery item sprites.
- UI icons as standalone image assets.
- Audio.
- Fonts as local files.
- Particle sprites.
- Home station.
- Route-specific environment props.

These should be produced or generated during later phases.

## 7. Phaser Loading Notes

Initial Phaser preload examples:

```ts
this.load.image("ship-idle", "assets/ship/gyoza-idle.png");
this.load.spritesheet("ship-fly", "assets/ship/gyoza-fly-sheet.png", {
  frameWidth: 170,
  frameHeight: 170,
});
this.load.spritesheet("ship-incident", "assets/ship/gyoza-incident-sheet.png", {
  frameWidth: 180,
  frameHeight: 160,
});
this.load.image("planet-tea-moon", "assets/planets/map/planet00.png");
```

If separate PNG frames are used instead of spritesheets:

- Load each frame individually.
- Create Phaser animations from frame keys.
- Use consistent display origin and size.

## 8. Asset Acceptance Checklist

Before a reference asset becomes production:

- It has an intentional production path under `public/assets/`.
- File dimensions are appropriate for runtime use.
- It has a stable key naming convention.
- It renders with no smoothing when pixel art.
- It has a documented origin/anchor.
- It is covered by a preload manifest.
- Its source/reference location is known.
- It does not depend on the raw prototype directory.

## 9. Production Assets (2026-10-01)

Every runtime texture below is registered in `src/data/assetManifest.ts` and loaded by `PreloadScene`. Sizes are art pixels (`width x height`; spritesheets are horizontal strips, given as `frames x frameW x frameH`). Display scale is `artScale` 2 unless noted. Each folder's full method, prompts, rebuild commands and iteration notes are in `art-src/<folder>/PROVENANCE.md`.

Status at integration (`e2e/out/w1-integration`, desktop, all 19 showcase states): **0 fallbacks in use**, 0 failed requests. Manifest sizes were re-checked against the PNGs with Pillow: all 47 entries match. Total `public/assets` is 3.4 MB (budget 6 MB); the largest PNGs are the two legacy painted planets (279 KB and 335 KB, budget 400 KB).

### Ship (`public/assets/ship/`), polish of the existing frames

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `gyoza-idle.png` | `ship-idle` | 144x160 (artScale 1) | Polish of the original handoff frame (no generation). Frames are registered on the saucer-band alpha mask, then a premultiplied 2x box downscale, a shared 32-colour palette, cleanup, a warm rim light, a 2x nearest upscale. Rim on art row 29 in every frame. |
| `gyoza-fly-01..03.png` | `ship-fly-1..3` | 144x160 each | Same pipeline; flames hang to y~150. |
| `gyoza-incident-01..05.png` | `ship-incident-1..5` | 144x160 each | Same pipeline; 03 is dome-aligned (shift 12px), 04/05 are aligned by centroid; 05 keeps 3 soft alpha levels. |

Originals are backed up unchanged in `art-src/ship/originals/`. Scripts: `art-src/ship/scripts/register.py`, `polish_ship.py`.

### Celestial (`public/assets/celestial/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `tea-moon.png` | `celestial-tea-moon` | 192x192 | Programmatic Python/Pillow pixel painting at art resolution (`build_tea_moon.py`, helper `paint.py`): jade/cream moon, teacup crater, pagoda tea house with steam. Disc centre (90,112), r=72. |
| `planet-far-plum.png` | `planet-far-plum` | 96x96 | Programmatic (`build_planets.py far_plum`): dusty plum disc with a tilted ring. |
| `planet-im-fine.png` | `celestial-im-fine` | 128x128 | Programmatic (`build_planets.py im_fine`): wobbly lavender planet with a cream bandage. |

Codex image generation was attempted and hit the usage limit (log in `art-src/celestial/scripts/`), so these are not model-generated.

### Space layers (`public/assets/space/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `stars-far.png` | `space-stars-far` | 256x256 opaque, tiles both axes | Programmatic (`scripts/starfield.py`, seeded): dithered cosmos base and 78 one-pixel stars. |
| `stars-near.png` | `space-stars-near` | 256x256 transparent, tiles both axes | Programmatic (`starfield.py`, seeded): 30 sparse stars and 4 hand-placed cross sparkles. |
| `nebula.png` | `space-nebula` | 640x360 soft alpha, tiles horizontally | Codex image_gen (`raw/nebula-v1.png`), then normalized by `scripts/nebula.py`. |

### Asteroids (`public/assets/asteroids/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `asteroid-sleepy.png` | `asteroid-sleepy` | 72x72 | Approved probe image, then `pixelize --colors 32 --pad 4` and `close_outline.py`. The only rock with a face. |
| `asteroid-rice.png` | `asteroid-rice` | 72x72 | Codex image_gen, then the same normalization. |
| `asteroid-tea.png` | `asteroid-tea` | 72x72 | Codex image_gen, then the same normalization. |
| `asteroid-mochi.png` | `asteroid-mochi` | 72x72 | Codex image_gen (v2 of 3), `flood_key.py`, then the same normalization. |
| `asteroid-crumb.png` | `asteroid-crumb` | 72x72 | Codex image_gen, then the same normalization. |
| `asteroid-debris.png` | `asteroid-debris` | 4 x 24x24 | Codex image_gen strip, `slice_strip.py`, `pixelize --sheet`; 4 variants, not an animation. |

Every PNG rebuilds pixel for pixel from `art-src/asteroids/raw/` with the commands in PROVENANCE.

### Lunar landing site (`public/assets/lunar/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `lunar-sky.png` | `lunar-sky` | 640x360 opaque | Codex image_gen (prompt A), `pixelize.py --colors 40 --opaque`. |
| `lunar-hills-far.png` | `lunar-hills-far` | 640x96, tiles horizontally | Codex image_gen (A), `lunar_tools.py strip`, `fix_hills.py`. The exact flags were lost in the outage; PROVENANCE gives an approximate rebuild. |
| `lunar-ground.png` | `lunar-ground` | 640x64, tiles horizontally | Codex image_gen (A), `lunar_tools.py strip --surface 8`. Surface at art row 8. |
| `lunar-pad.png` | `lunar-pad` | 176x24 | Codex image_gen (B), `build_props.py pad`. Mat top is exactly row 6 across x 12-163. |
| `lunar-lantern.png` | `lunar-lantern` | 2 x 12x28 (dim, lit) | Hand-placed pixel map (`build_lantern.py`, v3) traced from a Codex raw. Lamp centre is about 19 art px above the base. |
| `lunar-teahouse.png` | `lunar-teahouse` | 96x80 | Codex image_gen (B), `build_props.py teahouse`. |
| `lunar-rocks.png` | `lunar-rocks` | 3 x 32x16 | Codex image_gen (C), `lunar_tools.py split`, `build_props.py rocks`. |

### Characters (`public/assets/characters/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `rabbit-portrait.png` | `rabbit-portrait` | 3 x 64x64 (idle, blink, happy) | Codex image_gen v2 plus a happy-ear edit, normalized by `build_portrait.py`; the face is redrawn pixel by pixel for each frame. Bottom-anchored. |
| `rabbit-sprite.png` | `rabbit-sprite` | 4 x 24x32 (idle x2, wave x2) | Hand-authored pixel map (`build_sprite.py`), using the Codex body images only as reference. Feet on row 31; the art faces right. |

### Items (`public/assets/items/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `tea.png` | `item-tea` | 32x32 | Codex image_gen, `pixelize.py --colors 28 --anchor bottom --outline`. |
| `mochi.png` | `item-mochi` | 32x24 | Codex image_gen, same normalization. |
| `package.png` | `item-package` | 32x32 | Codex image_gen, same normalization. |
| `steam.png` | `item-steam` | 4 x 16x24 | Programmatic (Python/Pillow). |
| `memory-postcard.png` | `memory-postcard` | 96x64 | Codex image_gen (v2) plus a scripted frame. |

### Particles (`public/assets/particles/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `thrust.png` | `fx-thrust` | 8 x 16x24 | Frames 1-3 are Codex-authored glyph grids (`make-particles.ps1`); frames 4-8 are Claude-drawn lobe clouds (`make_particles.py`). |
| `dust.png` | `fx-dust` | 6 x 16x16 | Frames 1-4 Codex glyphs; frames 5-6 Claude round clumps. |
| `sparkle.png` | `fx-sparkle` | 4 x 8x8 | Codex glyphs, ported verbatim. |
| `steam.png` | `fx-steam` | 6 x 12x20 | Frames 1-4 Codex ribbon glyphs; frames 5-6 Claude curls. |
| `star.png` | `fx-star` | 3 x 5x5 | Codex glyphs, ported verbatim. |

No image_gen was used for particles; every pixel is authored at exact art size.

### UI (`public/assets/ui/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `icons.png` | `ui-icons` | 16 x 16x16 | Programmatic Pillow pixel maps (`make_icons.py`) with an automatic 1px ink outline. Codex was blocked by its usage limit. Frame order: `UI_ICON_FRAME`. |
| `panel-parchment.png` | `ui-panel-parchment` | 48x48, nine-slice inset 8 | Programmatic (`make_nineslices.py`). |
| `panel-dark.png` | `ui-panel-dark` | 48x48, nine-slice inset 8 | Programmatic; fill #14162B at alpha 217. |
| `button.png` | `ui-button` | 3 x 48x24 (normal, hover, pressed), inset 6 | Programmatic. |
| `keycap.png` | `ui-keycap` | 2 x 16x16 (up, pressed), inset 4 | Programmatic. |

### Legacy painted planets (still in the manifest)

| File | Key | Size | Note |
| --- | --- | --- | --- |
| `assets/planets/planet00.png` | `planet-tea-moon` | 1280x1280 (artScale 1) | Preloaded, but **nothing renders it**: only `flightPrototypeRoute.backgroundPlanets`, which no scene reads, references it. Candidate for removal (saves about 614 KB of preload together with planet04). |
| `assets/planets/planet04.png` | `planet-im-fine` | 1280x1280 (artScale 1) | Same as above. |

### Known weak assets (from producer reports)

- `asteroid-mochi`: dither noise on the pink half. `asteroid-crumb`: the broken side reads only through shading. `asteroid-debris`: about 100 colours, simple shapes.
- `lunar-ground`: the lower regolith bands are a bit blotchy. `lunar-lantern`: a simple hand redraw.
- `rabbit-portrait`: the happy frame changes only one ear. `rabbit-sprite`: the ear is a small curl.
- `gyoza-incident-05`: thin, noisy smoke. The ship dome ring is slightly uneven at 2x (inherited from the source).
- Celestial bodies and `icons.png` are programmatic because Codex hit its usage limit. Regenerating them is optional.
- `icons.png`: the touch (15) and radar (2) glyphs are the least clear.
