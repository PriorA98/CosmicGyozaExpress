# Deployment Plan

Last updated: 2026-05-29 JST

## Decision

Use two static deployment paths:

- GitHub Pages for interim demos and quick sharing while the game is in development.
- itch.io HTML5 for the final player-facing project page once the Tea Moon vertical slice is ready.

Do not Dockerize the project while it remains a static Phaser/Vite game with localStorage saves.

## GitHub Pages Demo Deploy

GitHub Pages is the development/demo target.

Repo:

- `PriorA98/CosmicGyozaExpress`

Expected demo URL:

- `https://priora98.github.io/CosmicGyozaExpress/`

GitHub Pages for a repository site serves from `/<REPO>/`, so the Pages build uses:

```bash
npm run build:pages
```

That script runs:

```bash
vite build --base=/CosmicGyozaExpress/
```

Normal local/root builds still use:

```bash
npm run build
```

### GitHub Setup Required

In the GitHub repository:

1. Open Settings.
2. Open Pages.
3. Under Build and deployment, set Source to `GitHub Actions`.
4. Push to `main` or manually run `Deploy demo to GitHub Pages` from the Actions tab.

The workflow lives at:

- `.github/workflows/deploy-pages.yml`

It runs:

- `npm ci`
- `npm test`
- `npm run build:pages`
- GitHub Pages artifact upload/deploy

## Branch Strategy

Use milestone-gated demo promotion so the public GitHub Pages build stays clean.

### Branches

`main`

- Stable integration branch.
- Code here should build and pass tests.
- Does not automatically deploy to the public demo URL.

`feature/<phase-or-task>`

- Daily development branches.
- Examples:
  - `feature/phase-1-flight-feel`
  - `feature/gyoza-incident-animation`
  - `feature/tea-moon-vertical-slice`

`demo`

- GitHub Pages deployment branch.
- Only update this branch when a meaningful phase is complete and locally verified.
- Pushing this branch triggers the GitHub Pages workflow.

`release/itch-v0.1`

- Future branch for itch.io release preparation once the Tea Moon vertical slice is complete.
- Add this only when the first itch.io release candidate exists.

### Promotion Flow

1. Work on a `feature/...` branch.
2. Verify locally:

```bash
npm test
npm run typecheck
npm run build
npm run build:pages
```

3. Merge the feature into `main`.
4. When a big phase is complete, merge `main` into `demo`.
5. Push `demo`.
6. GitHub Pages deploys to:

```text
https://priora98.github.io/CosmicGyozaExpress/
```

### Demo Deployment Milestones

Deploy to GitHub Pages only at meaningful checkpoints:

- Phase 1: flight-feel prototype is playable.
- Phase 2: Tea Moon vertical slice is complete.
- Phase 4/5: visual/UI identity pass is complete.
- Phase 6: full campaign is playable end-to-end.
- Release candidate before itch.io upload.

## itch.io Final Deploy

itch.io should become the final shareable game page after the Tea Moon vertical slice is playable:

- title
- briefing or map-lite
- flight route
- docking/delivery
- delivery result
- localStorage completion save

The final itch build should use the normal root build:

```bash
npm run build
```

Then package the contents of `dist/` as an HTML5 game upload.

Add a package script for this later after the vertical slice exists.

## Why No Docker

Docker is unnecessary for now because:

- the game is static after build;
- there is no backend;
- there is no database;
- saves are localStorage;
- GitHub Pages and itch.io both consume static files.

Reconsider Docker only if the project later adds backend APIs, cloud saves, authentication, or a server-only deployment target.
