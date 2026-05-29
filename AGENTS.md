# Codex Project Instructions

Scope: this file applies to the entire repository.

## Required References

Before implementing code changes, read and follow:

- `docs/engineering/development-standards.md`
- `docs/engineering/implementation-checklist.md`
- `docs/engineering/online-reference-map.md` when external stack behavior matters

Also respect the product, design, and deployment docs listed in `docs/README.md`.

## Project Standards

- Keep the locked stack: Phaser, TypeScript, Vite, Vitest, CSS, and localStorage.
- Do not introduce React, a backend, account systems, multiplayer, procedural generation, or major new runtime dependencies unless the user explicitly changes the project direction.
- Keep TypeScript strict. Do not weaken compiler settings or use `any` to bypass type errors.
- Prefer precise domain types, discriminated unions for variant state, `import type` for type-only imports, and named exports.
- Keep scenes focused on Phaser lifecycle and composition.
- Keep gameplay rules in systems, typed data, entities, or utilities according to `docs/engineering/development-standards.md`.
- Keep authored content, tuning, asset IDs, and mission definitions in typed data modules instead of scattering them through scene code.
- Treat localStorage, imported saves, browser APIs, and external data as unreliable boundaries.
- Load Phaser runtime assets through `PreloadScene` from production asset paths, not from `references/design-handoff/`.
- Preserve the cozy handcrafted product direction in `docs/implementation/implementation-plan.md`.

## Validation

Run the relevant checks before handing work back:

- TypeScript changes: `npm run typecheck`
- Logic, save, data, math, utility, or system changes: `npm test`
- Player-facing scenes, assets, Phaser config, Vite config, deployment, or build behavior: `npm run build`

If a relevant check cannot be run, report why and what risk remains.

## Documentation

- Update docs when implementation changes architecture, standards, save schema, asset workflow, deployment, controls, or product scope.
- Keep docs practical and dated when they describe project status.
- Use official docs first for stack behavior. Keep third-party examples subordinate to project standards.
