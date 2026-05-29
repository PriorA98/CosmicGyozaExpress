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
