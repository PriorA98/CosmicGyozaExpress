# Cosmic Gyoza Express

Cosmic Gyoza Express is a small cozy physics-based space delivery game about a tiny gyoza ship carrying warm food, comfort items, and absurd emergency snacks through a soft, funny galaxy.

## Current Status

- Concept documented.
- Stack locked: Phaser + TypeScript + Vite + localStorage.
- Implementation plan documented.
- Gameplay wiki added for core loop, flight, landing, and delivery result mechanics.
- Phase 2 landing model locked: a short assisted one-bottom-thruster lunar-lander sequence for Tea Moon.
- Gyoza UI prototype handoff analyzed and officialized into design docs.
- Raw design handoff preserved under `references/design-handoff/`.
- Reusable reference assets copied under `assets/reference/`.

## Key Documents

- `Cosmic Gyoza Express.md` - original concept document.
- `docs/wiki/README.md` - gameplay and mechanics wiki index.
- `docs/implementation/implementation-plan.md` - phased implementation plan.
- `docs/implementation/phase-1-flight-feel-prototype-plan.md` - detailed Phase 1 flight-feel prototype plan.
- `docs/implementation/phase-2-tea-moon-vertical-slice-plan.md` - detailed Phase 2 Tea Moon implementation plan.
- `docs/gameplay-decisions.md` - locked gameplay decisions for Phase 1 and Phase 2.
- `docs/README.md` - documentation index.
- `docs/design/design-system.md` - official design system.
- `docs/design/ui-reference.md` - prototype-to-production UI mapping.
- `docs/assets/asset-inventory.md` - asset catalog and production notes.
- `docs/implementation/frontend-integration.md` - Phaser frontend integration guidance.
- `docs/deployment.md` - GitHub Pages demo and itch.io final deployment plan.
- `docs/engineering/development-standards.md` - clean code and stack-specific implementation standards.
- `docs/engineering/implementation-checklist.md` - practical implementation quality checklist.
- `docs/engineering/online-reference-map.md` - official online references for the locked stack.
- `AGENTS.md` - Codex project instructions for applying these standards during future implementation.

## Reference Material

- `references/design-handoff/` - raw imported prototype bundle.
- `assets/reference/` - normalized reference copies of ship, planet, and screenshot assets.

Production code should not import directly from `references/design-handoff/`. When the Phaser project is initialized, selected optimized assets should move into `public/assets/`.

## Deployment

- Interim demos: GitHub Pages at `https://priora98.github.io/CosmicGyozaExpress/`.
- Final player-facing page: itch.io HTML5.
- Normal static build: `npm run build`.
- GitHub Pages build: `npm run build:pages`.
- GitHub Pages deploys from the `demo` branch only; see `docs/deployment.md`.
