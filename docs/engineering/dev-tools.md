# Dev Tools

Last updated: 2026-05-31 JST

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
