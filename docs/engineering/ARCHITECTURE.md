# Architecture

Last updated: 2026-10-02 JST (wave-2 integration)

This document records the boundaries of the Tea Moon vertical slice as implemented, the shared contracts every module codes against, and how work is split between parallel builders. It complements `development-standards.md` (rules) and `implementation-checklist.md` (process).

## 1. Stack And Runtime Shape

- Phaser 4.1 + strict TypeScript + Vite 7 + Vitest 3 + CSS + localStorage. No React, backend, accounts, multiplayer, or procedural generation.
- Phaser 4 is not Phaser 3. Check `node_modules/phaser/types/phaser.d.ts` before using an API from memory (FX, tint, NineSlice, particles, and render nodes changed).
- One `Phaser.Game` (`src/main.ts`), fixed logical resolution **1280×720**, `Scale.FIT` + `CENTER_BOTH`, `pixelArt: true`, `roundPixels: true`.
- Dev-only tooling (`src/dev/**`) is gated by `import.meta.env.DEV` and must tree-shake out of `npm run build` / `build:pages`.

## 2. Layer Boundaries

| Layer | Path | Owns | Must not |
| --- | --- | --- | --- |
| Scenes | `src/scenes/` | Phaser lifecycle, composition, input wiring, camera, transitions between scenes | Hold gameplay rules, tuning numbers, or authored copy |
| Systems | `src/systems/` | Rules: movement, docking/arrival, landing physics + classification, collision, package condition, mission results, save, audio engine | Import Phaser display objects (AudioSystem may use Web Audio only) |
| Entities | `src/entities/` | Renderable objects and their immediate visual behaviour (ship, asteroids, pad, rabbit) | Read/write saves, decide outcomes |
| UI | `src/ui/` | Reusable Phaser HUD/menu components (panels, gauges, buttons, keycaps, touch controls, text styles) | Know about missions or physics beyond the values passed in |
| FX | `src/fx/` | Particle emitters, screen feedback (shake, flash, hit-pause), tween recipes | Change gameplay state |
| Data | `src/data/` | Typed authored content, tuning, routes, asset manifest | Call browser APIs |
| Types | `src/types/` | Cross-module domain contracts | Contain logic |
| Game | `src/game/` | Design tokens, fonts, event bus contract | Contain scene logic |
| Dev | `src/dev/` | Showcase states, dev probe, save fixtures, launcher | Ship in production builds |

Rule of thumb: **scenes compose; systems own rules; entities render; typed data owns content and tuning.**

## 3. Coordinates, Units, And Time

- World and screen coordinates are **pixels, +X right, +Y down**. Logical canvas is 1280×720; FlightScene world is 3200×1800 (`flightPrototypeRoute.world`).
- Rotation is **radians, clockwise positive, 0 = ship nose up**. `directionVector(r) = (sin r, -cos r)`; the bottom thruster points along `bottomVector(r) = directionVector(r + π)`.
- Velocities are **px/s**; accelerations **px/s²**; angular velocity **rad/s**.
- Simulation `delta` is converted to **seconds** and clamped (`shipTuning.maxDeltaSeconds`, `landingTuning.maxDeltaSeconds`) before integration.
- Timestamps and durations are **milliseconds** (`scene.time.now`, `*Ms` fields). Tween durations use `motion` tokens (`src/game/designTokens.ts`).
- Depth bands are shared: `depth` in `designTokens.ts` (backdrop 0 … hud 40 … overlay 80, dev 90).

## 4. Scene Flow

```text
BootScene ─► PreloadScene ─► TitleScene ─► FlightScene ─► LandingScene ─► DeliveryResultScene ─► TitleScene | FlightScene
                    │                                         ▲   │ incident → landing-only retry (no route replay)
                    └─ ?showcase=<id> (dev) jumps to any state ┘
```

Scene handoff payloads (`src/types/`):

- `FlightSceneData` — optional `start`, `packageCondition`, `routeCrashes` (retries and showcases).
- `LandingSceneData` → `LandingSceneInit` (adds optional `start` kinematics for showcases).
- `DeliveryResultSceneData` — landing payload + `landingResult`, `landingIncidents`.

- `TitleSceneData` (exported from `TitleScene.ts`) - optional `openPanel: "settings" | "route-log"` (showcases; the route log opens only when a delivery exists).

Hand-off beats: Title -> Flight is a warm fade. Flight -> Landing uses `handoffToScene` (warm flash, then the pixel iris closes on the moon at screen centre). LandingScene opens with its arrival intro (ink fade-in, camera pan, intro card with the waving rabbit; any key or tap skips; skipped when init data has `start`). Landing -> Result and Result -> Title/Flight use an ink warm fade.

Scenes must accept missing/partial init data and fall back to Tea Moon defaults.

## 5. Shared Contracts

### 5.1 Game events (`src/game/events.ts`)

All cross-module signals travel on `game.events` under one name (`GAME_EVENT`) as a typed `GameEvent` union. Use `emitGameEvent(scene, event)` and `onGameEvent(game, listener)` (returns an unsubscribe). Events are fire-and-forget: emitters never assume a listener exists.

Required emitters (owners in parentheses):

| Event | When | Emitter |
| --- | --- | --- |
| `scene:enter` | each scene `create()` | every scene |
| `ui:confirm` / `ui:hover` / `ui:back` | button activation / hover / cancel | Title, Result, UI components |
| `flight:thrust` / `flight:brake` | on change of held state only (edge-triggered) | FlightScene |
| `flight:bump` | soft or dramatic bump / incident collision | FlightScene |
| `flight:respawn` | after incident respawn | FlightScene |
| `flight:arrival-progress` | while landing window holds, progress 0–1 (≤10 Hz) | FlightScene |
| `flight:arrival-complete` | just before starting LandingScene | FlightScene |
| `landing:thrust` / `landing:stabilizer` | on change | LandingScene |
| `landing:touchdown` | soft/bumpy touchdown | LandingScene |
| `landing:incident` | incident classified | LandingScene |
| `landing:retry` | retry begins | LandingScene |
| `result:shown` | result card revealed | DeliveryResultScene |
| `mission:start` / `mission:completed` | route start / save written | Flight / Result |
| `settings:changed` | after any settings write is persisted (`SaveSystem.updateSettings`) | TitleScene settings panel (`src/ui/SettingsPanel`) |
| `audio:mute` | every `M` toggle (in-memory mute) | AudioSystem |

Listeners: `AudioSystem` (sound; reloads volumes on `settings:changed`), `installFxSettings` (reloads reduced motion on `settings:changed`), `installSoundToast` (DOM "sound on / sound off" toast on `audio:mute`), FX helpers may also listen, dev probe logs the last 400 events (`window.__CGE__.events`) so critics can verify feedback without hearing it.

New event variants are added **only by the integrator**.

### 5.2 Asset manifest (`src/data/assetManifest.ts`)

- Every runtime texture has a key in `ASSET`, a path under `public/assets/`, art-pixel size, frame layout, and an `artScale`.
- **Pixel contract:** art is authored at true resolution and displayed at an integer `artScale` (2 for nearly everything: 1 art px = 2 screen px). Use `setScale(entry.artScale)` or multiples; never a non-integer resting scale on pixel art. The ship follows `SHIP_ART` (64x80 canvas, saucer centre at art (32, 34), integer 2x); the only non-integer scales are transient squash-and-stretch tweens (about 400 ms) on bumps. The legacy painted planets were removed in round 1.
- `PreloadScene` loads the manifest. A missing/broken file is replaced by a generated same-size fallback (flat colour shape) and recorded in `window.__CGE__.assetFailures`. Fallbacks keep the app loadable while art is in production; **the shipped slice must have zero fallbacks**.
- Spritesheets are horizontal strips of equal frames. Frame indices for icons/portraits are exported (`UI_ICON_FRAME`, `RABBIT_PORTRAIT_FRAME`).
- Nine-slice insets: `NINE_SLICE`.
- Production code never loads from `references/design-handoff/` or `assets/reference/`.

### 5.3 Design tokens and fonts

- Colours, type scale, motion, depth: `src/game/designTokens.ts` (`colors`, `typeScale`, `motion`, `depth`, `colorNumber()`).
- Fonts are self-hosted OFL woff2 in `public/assets/fonts/`, loaded by `src/game/fonts.ts` during preload (3 s timeout, never blocks). Use `fontStacks.display | ui | mono | pixel` in Phaser text styles.

### 5.4 Save (`src/systems/SaveSystem.ts`, `src/types/save.ts`)

- Versioned `SaveDataV1` in localStorage key `cosmic-gyoza-express.save.v1`.
- All reads are untrusted: malformed, partial, old, or future data must recover to a valid save without throwing. All writes are wrapped (`try/catch`) because quota/privacy modes throw. The game must run with storage unavailable.
- API (static): `load`, `save`, `reset`, `completeMission(missionId, result, memoryRewardId)`, `updateSettings(partial)` (clamped), `isMissionCompleted`, `getBestResult`, `lastLoadOutcome`, `isStorageLocked`, `persistenceStatus()` (`persistent`, or `session-only` with reason `storage-unavailable | newer-save | write-failed`), `diagnostics()` (first/last load outcome, lock, persistence, backup presence), `clearSessionCache`.
- Corrupt JSON is copied to `cosmic-gyoza-express.save.v1.corrupt-backup` before recovery. That first backup is never overwritten; a later, different corrupt text goes to `...corrupt-backup-latest`, and identical text is not backed up twice. A future version is never overwritten (the session runs in memory). Progress earned while storage was unavailable stays in memory and is flushed once a write succeeds again.
- When progress cannot be kept, the result card shows a small italic footnote (`resultCopy.persistenceNotice[reason]`). The title screen does not show one yet.
- Whoever calls `updateSettings` must then emit `settings:changed` so audio and fx re-read the settings.

### 5.5 Audio

- `AudioSystem` (Web Audio, synthesized, no audio files required) subscribes to game events once per `Phaser.Game`.
- The AudioContext is created/resumed only after a user gesture. Missing Web Audio, a suspended context, or a thrown node error must silently degrade to no sound.
- Volumes come from `save.settings.musicVolume`/`sfxVolume`; `M` toggles mute (in memory only, not persisted). Each toggle plays a sound-off/on pluck and emits `audio:mute`; `installSoundToast(game)` (called from `src/main.ts`) shows a DOM toast for it in every scene.
- Mood changes start about 0.05 s after the request (old pads release, new pads swell); held loops dip 6 dB under one-shot feedback. A context that throws while being created or resumed is retried on later gestures (up to 5 times).
- `src/data/audioCues.ts` is the pure, unit-tested `GameEvent` to cue/loop/mood mapper. Dev state `audio` exposes the context state, mood, active loops, the last cues and `analyzeCues`.

### 5.6 FX and reduced motion (`src/fx/`)

- `feedback.ts`: `shakeCamera`, `flashScreen`, `createThrustTrail` (`update`, `setDepth`, `clear()` drops puffs already in flight, `destroy`), `createPixelFlame`, `burstDust | burstSparkles | burstIncident | burstStars` (`BurstOptions.lifespanMs` / `spawnRadius`), `settleBursts(scene, withinMs)`, `createSteam`, `squash`, `liveParticleCount`. The particle budget is 300 live particles per scene.
- Pixel rules: particles render at their integer `artScale` (2), stay fully opaque and pop out at the end of their life (no partial-alpha fades over navy). Thrust, dust and steam use warm-recoloured copies of their sheets (`fxTextures.particleTextureKey`); PreloadScene pre-builds them so no gameplay frame pays for the recolour.
- Shake jitters the camera scroll in 2 px steps, so `scrollFactor 0` HUDs stay still; world layers overscan by `SHAKE_MAX_OFFSET_PX` (`fxPresets.ts`). Shake is skipped under reduced motion. Flash is an additive warm peach pop in 3 hard steps.
- Reduced motion: `setReducedMotion(value: boolean | null)`, where `null` follows the OS `prefers-reduced-motion`. `isReducedMotion()` is the single query. `installFxSettings(game)` (`src/fx/fxSettings.ts`) is called from `src/main.ts` right after `installAudioSystem`. It maps a saved `reducedMotion: true` to `true` and a saved `false` to `null` (defer to the OS), and re-syncs on `settings:changed`.
- `transitions.ts`: `TransitionSpec` = `warm-fade | iris | warp | handoff`; `playExitTransition`, `playEnterTransition`, `transitionToScene(scene, target, data?, spec?)`, `handoffToScene(scene, target, data, focus, durationMs?)`, `isTransitioning`. The iris is a pixel staircase on a 4 px grid; warp is stepped speed lines over an ink veil and never zooms the camera; handoff is a warm flash followed by the iris closing on the focus point. Under reduced motion, iris, warp and handoff collapse to a warm fade, and every promise resolves even if the scene shuts down.

### 5.7 UI kit (`src/ui/index.ts`)

Import shared HUD/menu components from the barrel: `Button` (`primary | secondary | ink`), `DashboardTicker`, `HudPanel`, `Keycap`, `Meter`, `ParchmentCard`, `StatePill`, `TouchControls` / `detectTouchDevice`, `Modal`, `SettingsPanel` (+ pure `settingsModel`), `RouteLogPanel`, `installSoundToast` (+ pure `soundToastModel`), `touchGlyphCells`, `addUiIcon` / `setUiIcon`, the text style helpers, `SURFACE` / `UI_ART_SCALE`, `stateSwatch` / `meterAccentColor`, and the pure layout helpers in `layout.ts` (`truncateToChars`, `monoCharsThatFit`, `hitTestZones`, `formatReadout`, `compactUiScale`, ...).

- `Button`, `Keycap`, `StatePill`, `HudPanel` and `TouchControls` take a `uiScale` option (text renders at the larger size instead of `setScale`); phones use `compactUiScale`.
- Flight and Landing HUDs are built from the kit (`HudPanel`, `Meter`, `StatePill`, `DashboardTicker`, a `Keycap` hint strip, `TouchControls`).
- Icons come straight from the authored `ui-icons` strip; the wave-1 runtime patch of the package and sound frames was retired once the strip was re-exported. The `ICON_OVERRIDES` bitmaps remain only for the DOM mute toast.

### 5.8 Page shell

`index.html` inlines `html, body { margin: 0; background: #0e0f1c }` (`--color-cosmos-deep`), so the first paint is dark before the CSS imported by `main.ts` arrives. Shell CSS lives in `src/styles/` (owner: ui).

Portrait phones get one parchment "rotate your phone" card from the shell for every scene, over a receded (blurred, 22% opacity) canvas, so scenes do not need their own readable portrait layouts.

## 6. Failure Recovery

| Boundary | Failure | Behaviour |
| --- | --- | --- |
| localStorage | missing, throws, corrupt JSON, wrong shape | default save, game continues |
| Assets | 404, decode error | generated fallback texture, logged |
| Fonts | load error / timeout | CSS fallback stack |
| Audio | no Web Audio, autoplay blocked, node error | silent no-op |
| Scene init data | missing/partial | Tea Moon defaults |

## 7. Reproducible Test States

- `src/dev/showcaseStates.ts` defines named states (`?showcase=<id>`), each with scene, init data, save fixture (`fresh | completed | corrupt | future | keep`; `future` seeds `{"version":9}` so storage locks to session-only), optional held keys, settle time, and optional `freezeDuringPerf` (keep the captured frame paused while frame times are sampled).
- `window.__CGE__` (`src/dev/devProbe.ts`) exposes readiness (`isSceneReady`), scene state getters (`getState("flight" | "landing" | "title" | "result" | "audio" | "save" | ...)` registered with `registerDevState`; `save` is registered in BootScene so every scene exposes it), the event log, asset/font failures, `pauseAll/resumeAll`, and an rAF frame sampler.
- The e2e harness seeds `Math.random` (mulberry32) so generated starfields/particles are reproducible.
- Showcase ids: `fx-gallery`, `ui-kit`, `title`, `title-completed`, `title-corrupt-save`, `title-settings`, `title-route-log`, `flight-start`, `flight-cruise`, `flight-approach`, `flight-arrival-ready`, `flight-incident`, `flight-bump`, `landing-descent`, `landing-intro`, `landing-thrust`, `landing-stabilizer`, `landing-settle-soft`, `landing-incident`, `landing-offpad`, `result-soft`, `result-bumpy`, `result-incident`, `result-session-only`.
- `flight-arrival-ready` starts just above the docking speed limit and holds the brake, so the landing window opens only once the harness presses S. The capture shows the progress arc partly filled, not the hand-off. It is `freezeDuringPerf`, so the window cannot complete while frames are sampled.
- `landing-descent` passes the default hand-off kinematics as `start`, which skips the arrival intro and shows the descent HUD; `landing-intro` captures the intro mid-pan.
- Capture JSON: `probe` is read while the screenshot frame is still paused, so it describes the PNG; `probeAfterPerf` is read after keys are released and frames sampled. Both include `save` (SaveSystem diagnostics) and `result` (reveal state) when registered.
- Harness viewports: `desktop` 1280x720, `wide` 1920x1080, `laptop`, `tablet`, `phoneLandscape` 844x390, `phonePortrait` 390x844, and `phoneLandscapeTouch` (844x390 with `hasTouch` + `isMobile`, so touch-pad HUDs render).
- A capture or playtest interrupted by a page reload (Vite HMR: "Execution context was destroyed", missing `__CGE__`) is retried once. `summary.json` reports `retriedCaptures`, and each capture JSON or playtest report records `attempts` or `attempt`.

Commands (dev server on `http://127.0.0.1:5173/`):

```bash
node e2e/capture.mjs --states=all --viewports=desktop,phoneLandscape --label=my-run
node e2e/capture.mjs --states=landing-descent,flight-cruise --viewports=phoneLandscapeTouch --label=my-touch-run
node e2e/playtest.mjs --landing=soft --incident-first=true --label=my-run
node e2e/playtest.mjs --landing=bumpy --incident-first=false --label=my-run
```

Output lands in `e2e/out/<label>/` (gitignored): PNG + JSON per capture (console errors, page errors, failed requests, asset/font failures, recent game events, fps), plus `summary.json`.

## 8. Performance Budget

- Target **60 fps at 1280×720** on a mid-range laptop GPU; harness measures avg fps and p95 frame time per state.
- Pass: avg ≥ 58 fps and p95 frame ≤ 20 ms in every showcase state.
- Per-frame code avoids allocation in stable paths; particle counts are capped (≤ 300 live particles per scene); full-screen layers use `TileSprite` or static images, not per-frame Graphics redraws of large areas.
- Asset budget: total `public/assets` ≤ 6 MB; individual PNG ≤ 400 KB.

## 9. Work Ownership (Tea Moon Polish Program)

Wave 2 kept the wave-1 package split (flight-environment, landing, ui, audio-fx, save-results) plus one asset producer per `public/assets/<folder>/`; `docs/STATUS.json` records the per-wave assignments.

Exactly one owner per file per wave. Shared files are integrator-only; builders request changes through the integrator.

**Integrator-only (all waves):** `src/types/**`, `src/game/**`, `src/data/assetManifest.ts`, `src/data/missions.ts`, `src/gameConfig.ts`, `src/main.ts`, `src/scenes/BootScene.ts`, `src/scenes/PreloadScene.ts`, `src/dev/**`, `e2e/**`, `tools/**`, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `docs/engineering/ARCHITECTURE.md`, `docs/assets/asset-inventory.md`, `docs/STATUS.json`.

**Wave 1 builders**

| Package | Owns |
| --- | --- |
| flight-environment | `src/scenes/FlightScene.ts`, `src/entities/flight/**`, `src/entities/GyozaShip.ts`, `src/data/tuning.ts`, `src/data/flightPrototypeRoute.ts`, `src/data/flightScenery.ts`, `src/systems/{ShipMovementSystem,DockingSystem,ArrivalGateSystem,CollisionSystem}.ts`, matching tests |
| landing | `src/scenes/LandingScene.ts`, `src/entities/landing/**`, `src/data/landingTuning.ts`, `src/data/landingScenery.ts`, `src/systems/LandingSystem.ts`, `tests/landing.test.ts` |
| ui | `src/ui/**`, `src/scenes/TitleScene.ts`, `src/styles/**`, `src/data/uiCopy.ts`, `tests/ui*.test.ts` |
| audio-fx | `src/systems/AudioSystem.ts`, `src/data/audioCues.ts`, `src/fx/**`, `tests/audio*.test.ts`, `tests/fx*.test.ts` |
| save-results | `src/scenes/DeliveryResultScene.ts`, `src/systems/{SaveSystem,MissionResultSystem,PackageConditionSystem}.ts`, `src/data/packageConditionTuning.ts`, `src/data/resultCopy.ts`, `tests/{save,missionResult,packageCondition}.test.ts` |

**Asset producers (Codex, wave 1)** each own one folder: `public/assets/{asteroids,space,lunar,characters,items,particles,ui,celestial}/` plus `art-src/<same>/` for raw generations and provenance. Ship polish owns `public/assets/ship/`.

Later waves re-assign ownership explicitly in `docs/STATUS.json`.

## 10. Validation Loop

1. `npm run typecheck`, `npm test`, `npm run build` (and `build:pages` at the end).
2. `node e2e/capture.mjs` for the module's showcase states at `desktop` and `phoneLandscape` (plus `phonePortrait`/`wide` for UI).
3. `node e2e/playtest.mjs` for flow changes.
4. A separate critic inspects the PNGs and JSON; no visual quality claim is valid without captured evidence. Scores and open issues live in `docs/STATUS.json`.

## 11. Ship Rotation Contract (2026-10-02)

Pixel art is never rotated at runtime. Every ship frame is also baked at `SHIP_ROTATION.angles` (32) clockwise angles by `tools/art/rotsprite.py` (RotSprite-style: Scale2x x3, nearest rotate, centre-sample downscale) into 112×112 cells centred on the saucer pivot (`public/assets/ship/rot/*-rot.png`, 8×4 grids). `GyozaShip.visualRotation` (get/set, radians, 0 = nose up, clockwise) selects the nearest cell and keeps Phaser's `rotation` at 0. Read and tween `visualRotation`, never `rotation`, for the ship. `setKinematicState` clears any scripted override. Regenerate the sheets whenever a ship frame changes:

```bash
python tools/art/rotsprite.py public/assets/ship/gyoza-idle.png public/assets/ship/rot/gyoza-idle-rot.png --pivot 32,34 --cell 112 --angles 32 --columns 8
```
