# Dev Tools

Last updated: 2026-10-01 (showcase states and e2e harness added)

## Purpose

Development-only scene launch tools make it faster to test isolated screens without replaying the whole delivery loop.

These tools must never appear in the GitHub Pages demo or production build. Runtime access is gated by `import.meta.env.DEV`, so `npm run build` and `npm run build:pages` hide both the dev panel and hotkeys.

## Current Launches

Available only while running `npm run dev`:

- `Shift+F`: launch `FlightScene`.
- `Shift+L`: launch `LandingScene` with default Tea Moon test data.

The title screen also shows a small dev-only launch panel with the same targets.

## Adding Future Screens

Add future shortcuts in `src/dev/devSceneLaunches.ts`.

Each launch target defines:

- `id`: stable internal id.
- `label`: visible dev label.
- `sceneKey`: Phaser scene key.
- `shortcutLabel`: displayed shortcut.
- `keyCode`: browser keyboard code, such as `KeyL`.
- `description`: short panel description.
- `data`: optional function returning scene init data.

Then call `installDevSceneHotkeys(this)` in the scene's `create()` method. For title or hub-style screens, call `createDevSceneLauncherPanel(this)` to show clickable dev launch buttons.

Do not put user-facing tuning, debug panels, or demo-only UI behind this system unless it should be completely unavailable in production builds.

## Showcase States

Reproducible scene states live in `src/dev/showcaseStates.ts` (integrator-owned). Open one in the dev server with `http://127.0.0.1:5173/?showcase=<id>`. Each state picks a scene, init data, a save fixture (`fresh | completed | corrupt | keep`), optional held keys and a settle time.

Current ids: `fx-gallery`, `ui-kit`, `title`, `title-completed`, `title-corrupt-save`, `flight-start`, `flight-cruise`, `flight-approach`, `flight-arrival-ready`, `flight-incident`, `landing-descent`, `landing-thrust`, `landing-stabilizer`, `landing-settle-soft`, `landing-incident`, `landing-offpad`, `result-soft`, `result-bumpy`, `result-incident`.

`window.__CGE__` (dev probe) exposes `showcases`, `isSceneReady`, `getState(name)`, `events`, `assetFailures`, `fontFailures`, `pauseAll` / `resumeAll` and `sampleFrames`.

## E2E Harness (`e2e/`)

The dev server must already be running (`npm run dev`, `http://127.0.0.1:5173/`); the scripts never start it. Playwright drives headless Chromium.

```bash
# Screenshot + JSON (errors, asset fallbacks, fps) per showcase state and viewport
node e2e/capture.mjs --states=all --viewports=desktop --label=my-run
node e2e/capture.mjs --states=title,ui-kit --viewports=desktop,phoneLandscape,phonePortrait,wide --label=my-ui-run
node e2e/capture.mjs --states=landing-descent --viewports=phoneLandscapeTouch --label=my-touch-run

# Full loop through real keyboard input: title -> flight -> landing -> result -> reload
node e2e/playtest.mjs --label=my-playtest                                  # soft landing, crashes once first
node e2e/playtest.mjs --landing=bumpy --incident-first=false --label=my-playtest
```

- Output goes to `e2e/out/<label>/` (gitignored). Capture writes `<state>@<viewport>.png` + `.json` and `summary.json` (`totals.runtimeErrors`, `failedAssets`, `minAvgFps`, `worstP95FrameMs`, `retriedCaptures`). Playtest writes `playtest-<soft|bumpy>.json` plus step screenshots and exits 1 on any failed check.
- Viewports: `desktop`, `wide`, `laptop`, `tablet`, `phoneLandscape`, `phonePortrait`, `phoneLandscapeTouch` (touch emulation, shows the touch pads).
- A run killed by a page reload under the harness (Vite HMR "Execution context was destroyed") is retried once automatically.
- Other flags: `--seed=7` (seeded `Math.random`), `--url=...`, `--fps-ms=2000` (capture); `--viewport=desktop` (playtest).
