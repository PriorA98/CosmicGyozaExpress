# Cosmic Gyoza Express

Cosmic Gyoza Express is a small cozy physics-based space delivery game about a tiny gyoza ship carrying warm food, comfort items, and absurd emergency snacks through a soft, funny galaxy.

## Current Status

- Concept documented.
- Stack locked: Phaser + TypeScript + Vite + localStorage.
- Implementation plan documented.
- Gyoza UI prototype handoff analyzed and officialized into design docs.
- Raw design handoff preserved under `references/design-handoff/`.
- Reusable reference assets copied under `assets/reference/`.

## Key Documents

- `Cosmic Gyoza Express.md` - original concept document.
- `docs/implementation/implementation-plan.md` - phased implementation plan.
- `docs/README.md` - documentation index.
- `docs/design/design-system.md` - official design system.
- `docs/design/ui-reference.md` - prototype-to-production UI mapping.
- `docs/assets/asset-inventory.md` - asset catalog and production notes.
- `docs/implementation/frontend-integration.md` - Phaser frontend integration guidance.
- `docs/deployment.md` - GitHub Pages demo and itch.io final deployment plan.

## Reference Material

- `references/design-handoff/` - raw imported prototype bundle.
- `assets/reference/` - normalized reference copies of ship, planet, and screenshot assets.

Production code should not import directly from `references/design-handoff/`. When the Phaser project is initialized, selected optimized assets should move into `public/assets/`.

## Deployment

- Interim demos: GitHub Pages at `https://priora98.github.io/CosmicGyozaExpress/`.
- Final player-facing page: itch.io HTML5.
- Normal static build: `npm run build`.
- GitHub Pages build: `npm run build:pages`.
