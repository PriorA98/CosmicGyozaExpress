# Reference Asset Inventory

Last updated: 2026-10-02 JST (section 9 refreshed for the wave-2 production assets)

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

## 9. Production Assets (updated 2026-10-02, wave 2)

Every runtime texture below is registered in `src/data/assetManifest.ts` and loaded by `PreloadScene`. Sizes are art pixels (`width x height`; spritesheets are horizontal strips, given as `frames x frameW x frameH`). Display scale is `artScale` 2 for every entry. Each folder's full method, prompts, rebuild commands and iteration notes are in `art-src/<folder>/PROVENANCE.md`.

Status at wave-2 integration (`e2e/out/w2-integration`, desktop + phoneLandscape, all 24 showcase states): **0 fallbacks in use**, 0 failed requests, 0 runtime errors. Manifest sizes were re-checked against the PNGs with Pillow: all 45 entries match, and no PNG under `public/assets/` is unlisted. Total `public/assets` is about 545 KB including fonts (budget 6 MB); the largest PNG is `lunar-sky.png` (54 KB). The legacy painted planets (`public/assets/planets/`, `planet-tea-moon`, `planet-im-fine`) were removed in the round-1 integration.

### Ship (`public/assets/ship/`), wave-2 redraw

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `gyoza-idle.png` | `ship-idle` | 64x80 | One Python/Pillow rig (`art-src/ship/scripts/draw_ship.py`) drawn at true resolution: crescent gyoza hull with 8 crimp scallops, glass dome with a bun pilot, two legs, nozzle bolted under the hull. Crescent silhouette taken from Codex concept v1b (reference only). |
| `gyoza-fly-01..03.png` | `ship-fly-1..3` | 64x80 each | Same rig plus a baked flame (8, 15, 24 px) from the nozzle exit at art (32, 48). |
| `gyoza-incident-01..05.png` | `ship-incident-1..5` | 64x80 each | Same rig: squash, dizzy tilt, popped dome with steam, puff cloud, scattering puffs. |

Contract (`SHIP_ART`): saucer centre at art (32, 34) in every frame, displayed at integer 2x. Every frame is under 2 KB and uses 26-31 colours.

### Celestial (`public/assets/celestial/`), wave 2

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `tea-moon.png` | `celestial-tea-moon` | 192x192 | Codex image_gen (`raw/tea-moon-v2.png`), normalized by `normalize_w2.py tea-moon`; steam puffs and round windows repainted by the script. The house matches `lunar-teahouse.png`; teacup crater. Disc centre (90,112), d=144 (same geometry as wave 1). |
| `planet-far-plum.png` | `planet-far-plum` | 96x96 | Hybrid: Codex image_gen ringless body (`raw/planet-far-plum-body-v4.png`, `normalize_w2.py`) plus a programmatic ring (`compose_plum.py`), because Codex never drew valid ring geometry. |
| `planet-im-fine.png` | `celestial-im-fine` | 128x128 | Codex image_gen (`raw/planet-im-fine-v1.png`), normalized by `normalize_w2.py planet-im-fine`: teal continents, cross bandage with a crack. |

### Space layers (`public/assets/space/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `stars-far.png` | `space-stars-far` | 256x256 opaque, tiles both axes | Programmatic (`scripts/starfield.py`, seeded): dithered cosmos base and 78 one-pixel stars. |
| `stars-near.png` | `space-stars-near` | 256x256 transparent, tiles both axes | Programmatic (`starfield.py`, seeded): 30 sparse stars and 4 hand-placed cross sparkles. |
| `nebula.png` | `space-nebula` | 640x360 soft alpha (max 127), tiles horizontally | Wave 2: the Codex image_gen raw (`raw/nebula-v1.png`) re-normalized at true 1 px resolution by `scripts/nebula_true.py` (stepped colour bands, 5 alpha levels, wavy transparent top/bottom 20 rows, exact horizontal wrap). The round-1 file is kept at `art-src/space/previews/nebula-r1-old.png`. |

### Asteroids (`public/assets/asteroids/`), wave 2

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `asteroid-sleepy.png` | `asteroid-sleepy` | 76x76 | Approved probe raw (`raw/asteroid-sleepy-v1.png`), `pixelize --colors 36 --pad 4`, `restore_blush`, `close_outline`. The only rock with a face. |
| `asteroid-rice.png` | `asteroid-rice` | 92x92 | Codex image_gen raw v1, same normalization. |
| `asteroid-tea.png` | `asteroid-tea` | 100x100 | Codex image_gen raw v1, same normalization. |
| `asteroid-mochi.png` | `asteroid-mochi` | 84x84 | Codex image_gen raw v5, `flood_key`, same normalization: flat pastel bands, full plum outline. |
| `asteroid-crumb.png` | `asteroid-crumb` | 66x66 | Codex image_gen raw v1, same normalization, then `cut_flat` (straight lower-left fracture face with a cream lit ridge). |
| `asteroid-debris.png` | `asteroid-debris` | 4 x 24x24 | Codex image_gen strip, `slice_strip`, `pixelize --sheet`, `quantize_joint` (one 28-colour palette), `close_outline`; 4 variants, not an animation. |

Each canvas is the rock's route radius plus a 4 px pad. Every PNG rebuilds pixel for pixel with `art-src/asteroids/scripts/build_w2.sh`. The `art-src/_probe/` originals are archived in `art-src/asteroids/work/probe-archive/` and still referenced by the items and lunar PROVENANCE files.

### Lunar landing site (`public/assets/lunar/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `lunar-sky.png` | `lunar-sky` | 640x360 opaque | Codex image_gen (prompt A), `pixelize.py --colors 40 --opaque`. |
| `lunar-hills-far.png` | `lunar-hills-far` | 640x96, tiles horizontally | Codex image_gen (A), `lunar_tools.py strip`, `fix_hills.py`. The exact flags were lost in the outage; PROVENANCE gives an approximate rebuild. |
| `lunar-ground.png` | `lunar-ground` | 640x64, tiles horizontally | Wave 2: the wave-1 Codex surface band (`work/lunar-ground-w1.png`) with the lower regolith repainted as four calm strata by `scripts/build_ground.py`. Surface at art row 8 (rows 0-6 transparent, asserted). |
| `lunar-pad.png` | `lunar-pad` | 176x24 | Codex image_gen (B), `build_props.py pad`. Mat top is exactly row 6 across x 12-163. |
| `lunar-lantern.png` | `lunar-lantern` | 2 x 12x28 (dim, lit) | Wave 2 (v4): hand-placed pixel map (`build_lantern.py`) traced from Codex `raw/lunar-lantern-v1.png`: paper ribs, finial, rope wrap, 1 px peach glow on the lit frame. Lamp centre about 19 art px above the base. |
| `lunar-teahouse.png` | `lunar-teahouse` | 96x80 | Codex image_gen (B), `build_props.py teahouse`. |
| `lunar-rocks.png` | `lunar-rocks` | 3 x 32x16 | Codex image_gen (C), `lunar_tools.py split`, `build_props.py rocks`. |

### Characters (`public/assets/characters/`), wave 2

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `rabbit-portrait.png` | `rabbit-portrait` | 3 x 64x64 (idle, blink, happy) | Codex image_gen raws (v2 + happy v2) normalized by `build_portrait.py`; the face is drawn in code. The happy frame stands both ears up (right half mirrored and re-shaded) with ^ ^ eyes and an open smile. Frames are pixel-identical below row 45. |
| `rabbit-sprite.png` | `rabbit-sprite` | 4 x 24x32 (idle x2, wave x2) | Hand-authored pixel map (`build_sprite.py`), designed from the Codex body raws: upright ear with a pink stripe, folded floppy ear, 3 px waving forearm, small u-shaped smile. Feet outline on row 31; the art faces right. |

### Items (`public/assets/items/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `tea.png` | `item-tea` | 32x32 | Codex image_gen, `pixelize.py --colors 28 --anchor bottom --outline` (round 1). |
| `mochi.png` | `item-mochi` | 32x24 | Codex image_gen, same normalization (round 1). |
| `package.png` | `item-package` | 32x32 | Codex image_gen, same normalization (round 1). |
| `steam.png` | `item-steam` | 4 x 16x24 | Wave 2: programmatic (`make_steam.py` v2): stronger plaster core, warm grey rim, clean 4-frame loop. |
| `memory-postcard.png` | `memory-postcard` | 96x64 | Wave 2: Codex image_gen background (`raw/postcard-v3.png`) with its house and ship painted out, pixelized, then the real `lunar-teahouse.png` and the 64x80 `gyoza-idle.png` stamped on, plus a 3 px parchment frame (`compose_postcard_v3.py`). |

### Particles (`public/assets/particles/`) (unchanged in wave 2)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `thrust.png` | `fx-thrust` | 8 x 16x24 | Frames 1-3 are Codex-authored glyph grids (`make-particles.ps1`); frames 4-8 are Claude-drawn lobe clouds (`make_particles.py`). |
| `dust.png` | `fx-dust` | 6 x 16x16 | Frames 1-4 Codex glyphs; frames 5-6 Claude round clumps. |
| `sparkle.png` | `fx-sparkle` | 4 x 8x8 | Codex glyphs, ported verbatim. |
| `steam.png` | `fx-steam` | 6 x 12x20 | Frames 1-4 Codex ribbon glyphs; frames 5-6 Claude curls. |
| `star.png` | `fx-star` | 3 x 5x5 | Codex glyphs, ported verbatim. |

No image_gen was used for particles; every pixel is authored at exact art size. At runtime `src/fx/fxTextures.ts` derives warm-recoloured, hard-alpha copies of thrust, dust and steam (pre-built in `PreloadScene`).

### UI (`public/assets/ui/`)

| File | Key | Size | Provenance |
| --- | --- | --- | --- |
| `icons.png` | `ui-icons` | 16 x 16x16 | Wave 2: programmatic Pillow pixel maps (`make_icons.py` v3: fill maps, automatic ink outline, then thin detail overlays). Redrawn: package (furoshiki, 1), radar dish (2), sound-on arcs (12), pointing hand (15). Frame order: `UI_ICON_FRAME`. Used directly in game; the runtime icon patch was retired. |
| `panel-parchment.png` | `ui-panel-parchment` | 48x48, nine-slice inset 8 | Programmatic (`make_nineslices.py`); byte-identical regen in wave 2. |
| `panel-dark.png` | `ui-panel-dark` | 48x48, nine-slice inset 8 | Programmatic; fill #14162B at alpha 217; byte-identical regen in wave 2. |
| `button.png` | `ui-button` | 3 x 48x24 (normal, hover, pressed), inset 6 | Wave 2 (`make_nineslices.py` v2): 1 px ink outline around the whole shape, clipped corners, dark terracotta slab side; pressed sinks 2 px. |
| `keycap.png` | `ui-keycap` | 2 x 16x16 (up, pressed), inset 4 | Wave 2: 1 px ink outline, warm parchment skirt; pressed sinks 2 px. |

Codex was not called for any asset in the wave-2 continuation; the image_gen raws above come from earlier attempts and are kept under `art-src/<folder>/raw/`.

### Known weak assets (from wave-2 producer reports)

- Ship: the dome glass is opaque tinted glass (reads a little like a helmet); only two legs are visible; the ink outline barely separates from the dark cosmos; incident-03 steam plumes are small.
- `asteroid-mochi` is the softest-looking rock; `asteroid-crumb`'s fracture face is a scripted flat band; debris outlines sit close to the cosmos colour.
- `planet-far-plum`: the programmatic ring is plainer than the body. `tea-moon` reads more cream than jade. `planet-im-fine` has a slightly jaggy top edge.
- `nebula.png`: cloud interiors are smoothed contour bands rather than hand-placed pixels.
- `lunar-ground`: deepest band is plain. `lunar-lantern`: the 1 px glow relies on the code-drawn glow circle for bloom. `lunar-hills-far`: exact rebuild flags lost.
- `rabbit-portrait` happy frame is visibly mirrored; `rabbit-sprite` floppy ear can read as a loop at 1x.
- `memory-postcard`: the stamped cottage and ship are only 22-24 px wide. `item-steam` is a simple blob.
- `icons.png`: the package's two ears can suggest bunny ears; the radar feed arm is subtle on the dark HUD.

## Phase 3 campaign art (2026-10-03)

All under `public/assets/campaign/`, loaded via `ASSET_MANIFEST` (`campaign-*` keys); provenance in `art-src/campaign/PROVENANCE.md`.

- Destinations (160×160): bento, matcha, bakery, im-fine, home.
- Recipient portraits (48×48, frames idle/welcome): mallow, nori, pip, iona.
- Cargo strip (32×32 × 5), postcard strip (48×32 × 5), pickups (16×16 × 2).
- Landing backdrop layers per theme: `landing-sky-<theme>` (640×360 opaque), `landing-hills-<theme>` (640×96), wired through `campaignLandingDecor.<theme>.backdrop` in `src/data/landingScenery.ts`.
- Flight nebula layer per theme: `nebula-<theme>` (640×360 soft alpha), wired through `campaignBackdropMoods.<theme>.layerTextureKeys.nebula` in `src/data/flightScenery.ts`.
- Cues: `windsock` (24×32 × 4: calm, warning, medium, strong), `flow-arrow` (24×16), `berth-tiles` (32×24 × 3: left cap, centre, right cap).
- `fog.png` remains a Stage-A placeholder (unused by flight since round 2; kept for the manifest contract).
