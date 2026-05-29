# Reference Asset Inventory

Last updated: 2026-05-29 JST

This catalog documents assets imported from the Gyoza animation handoff and normalized into `assets/reference/`.

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
