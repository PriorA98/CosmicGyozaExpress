# Architecture

Last updated: 2026-10-01 JST

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

Listeners: `AudioSystem` (sound), FX helpers may also listen, dev probe logs the last 400 events (`window.__CGE__.events`) so critics can verify feedback without hearing it.

New event variants are added **only by the integrator**.

### 5.2 Asset manifest (`src/data/assetManifest.ts`)

- Every runtime texture has a key in `ASSET`, a path under `public/assets/`, art-pixel size, frame layout, and an `artScale`.
- **Pixel contract:** art is authored at true resolution and displayed at an integer `artScale` (2 for nearly everything: 1 art px = 2 screen px). Use `setScale(entry.artScale)` or multiples; never non-integer scale on pixel art except the legacy painted planets and the ship (scaled by gameplay size).
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

### 5.5 Audio

- `AudioSystem` (Web Audio, synthesized, no audio files required) subscribes to game events once per `Phaser.Game`.
- The AudioContext is created/resumed only after a user gesture. Missing Web Audio, a suspended context, or a thrown node error must silently degrade to no sound.
- Volumes come from `save.settings.musicVolume`/`sfxVolume`; `M` toggles mute.

## 6. Failure Recovery

| Boundary | Failure | Behaviour |
| --- | --- | --- |
| localStorage | missing, throws, corrupt JSON, wrong shape | default save, game continues |
| Assets | 404, decode error | generated fallback texture, logged |
| Fonts | load error / timeout | CSS fallback stack |
| Audio | no Web Audio, autoplay blocked, node error | silent no-op |
| Scene init data | missing/partial | Tea Moon defaults |

## 7. Reproducible Test States

- `src/dev/showcaseStates.ts` defines named states (`?showcase=<id>`), each with scene, init data, save fixture (`fresh | completed | corrupt | keep`), optional held keys, and settle time.
- `window.__CGE__` (`src/dev/devProbe.ts`) exposes readiness (`isSceneReady`), scene state getters (`getState("flight" | "landing" | "title" | ...)` registered with `registerDevState`), the event log, asset/font failures, `pauseAll/resumeAll`, and an rAF frame sampler.
- The e2e harness seeds `Math.random` (mulberry32) so generated starfields/particles are reproducible.

Commands (dev server on `http://127.0.0.1:5173/`):

```bash
node e2e/capture.mjs --states=all --viewports=desktop,phoneLandscape --label=my-run
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
