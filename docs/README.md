# Cosmic Gyoza Express Documentation Index

Last updated: 2026-05-29 JST

This folder contains the official project documentation derived from the original concept document, the implementation plan, and the imported Gyoza UI prototype handoff.

## Canonical Documents

- `../Cosmic Gyoza Express.md`
  - Original game concept and tone source.
- `implementation/implementation-plan.md`
  - Technical and production plan for Phaser + TypeScript + Vite + localStorage.
- `design/design-system.md`
  - Official visual design system derived from the UI prototype.
- `design/ui-reference.md`
  - Screen-by-screen reference analysis. This separates reusable style ideas from prototype-only gameplay ideas.
- `assets/asset-inventory.md`
  - Reference asset catalog, dimensions, animation timing, duplication notes, and production recommendations.
- `implementation/frontend-integration.md`
  - How to translate the HTML/CSS/JS prototype language into the actual Phaser implementation.
- `deployment.md`
  - Official deployment plan: GitHub Pages for demos, itch.io HTML5 for final release.

## Reference Material

The raw exported prototype bundle is preserved under:

- `../references/design-handoff/`

Reusable PNG reference assets have been copied to:

- `../assets/reference/`

The raw prototype remains useful for traceability, but production code should not import directly from `references/design-handoff/`. Future implementation should copy optimized assets into the Phaser public asset tree.

## Documentation Rules

- The game title remains `Cosmic Gyoza Express` unless intentionally renamed later.
- Prototype names such as `Gyoza Galaxy Delivery`, `Mossport`, and `Porra Ribbon` are style/content references, not locked product names.
- Prototype systems such as coins, pantry, toppings, 24 deliveries, and 60 memories are non-binding unless promoted by a later design decision.
- The UI prototype is a design reference, not production architecture. React/Babel files in the handoff should not imply that React is part of the locked stack.
