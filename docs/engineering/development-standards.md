# Development Standards

Last updated: 2026-05-29 JST

These standards apply to production code, tests, assets, and implementation documentation for Cosmic Gyoza Express. They are based on the locked stack in `docs/implementation/implementation-plan.md` and the official references in `docs/engineering/online-reference-map.md`.

## Project Promises

- Keep the locked stack: Phaser, TypeScript, Vite, Vitest, CSS, and localStorage.
- Keep the product small, handcrafted, browser-native, and static-hosting friendly.
- Do not add backend services, accounts, multiplayer, procedural galaxy generation, large inventory systems, or framework UI rewrites unless the project direction explicitly changes.
- Treat the imported prototype under `references/design-handoff/` as reference material only. Production code should not import from it.
- Favor code that is easy to read, easy to test, and hard to misuse over clever abstractions.

## TypeScript Standards

- Keep `strict` TypeScript enabled. Do not weaken `tsconfig.json` to make implementation easier.
- Avoid `any`. Use a real domain type when known, or `unknown` at an input boundary followed by explicit narrowing.
- Prefer `type` for data shapes and unions. Use `interface` only when extension/merging is intentionally useful.
- Use discriminated unions for state machines, mission phases, result states, and events that have variants.
- Use `readonly` arrays/properties for authored data that should not mutate at runtime.
- Keep shared domain types in `src/types/`. Keep file-local types private when they are not part of a module contract.
- Use `import type` for type-only imports.
- Prefer named exports. Default exports are allowed for framework-required config files such as `vite.config.ts`.
- Avoid non-null assertions and broad type assertions. If an assertion seems necessary, first check whether the value can be narrowed or the API wrapper can return a safer type.
- Keep browser and storage boundaries defensive. Data from localStorage, imported JSON, query strings, and future save-import flows must be parsed as untrusted data.

## Module Boundaries

- `src/main.ts` creates exactly one `Phaser.Game`.
- `src/gameConfig.ts` owns Phaser boot configuration, scene ordering, dimensions, scale behavior, and render defaults.
- `src/scenes/` owns Phaser scene lifecycle and composition. Scenes may wire entities, systems, UI, input, and loaded assets, but should not become dumping grounds for business rules.
- `src/entities/` owns renderable game objects and their immediate per-entity behavior. Entities should not read or write saves directly.
- `src/systems/` owns non-rendering gameplay, save, input, audio, collision, mission, and dashboard logic. Prefer pure functions inside systems where practical.
- `src/data/` owns authored static data and tuning constants. It should be typed, side-effect-light, and free of browser API calls.
- `src/types/` owns cross-module domain contracts.
- `src/utils/` owns small pure helpers. Helpers should not know about Phaser scenes unless they are explicitly Phaser utilities.
- `src/styles/` owns DOM shell styling. Keep Phaser canvas presentation in Phaser unless DOM UI is intentionally introduced.
- `tests/` covers pure utilities, save behavior, mission logic, and system decisions. Add scene/browser smoke coverage only when the project has an e2e harness.

## Phaser Standards

- Keep scene responsibilities explicit: boot/setup, preload assets, menu/title, flight/gameplay, results, settings, and ending.
- Load gameplay assets in `PreloadScene` before scenes use them. Asset keys should be constants once the asset list grows beyond prototypes.
- Keep Phaser event subscriptions paired with lifecycle cleanup when they outlive a one-shot handler or can be registered more than once.
- Keep `update()` hot paths allocation-conscious. Avoid creating avoidable objects every frame in stable gameplay systems.
- Use `delta` in seconds for frame-rate-aware movement and clamp unusually large deltas before applying simulation logic.
- Keep tuning numbers in `src/data/tuning.ts` or typed mission/scene config. Avoid unexplained magic numbers in gameplay logic.
- Prefer custom movement for the gyoza ship's floaty feel. Use Arcade Physics for simple overlap/collision helpers when it lowers complexity. Escalate to Matter Physics only for complex body shapes, joints, or constraints.
- Use Phaser's input APIs for gameplay input. Direct DOM event handling should be limited to DOM UI shell concerns.
- Keep touch/gamepad/keyboard controls behind a project input abstraction as the control surface grows.
- Keep debug UI easy to disable. Debug text, collision overlays, and tuning panels should not be mixed into production UX by accident.

## Save And Browser Platform Standards

- Save data must be versioned and migration-friendly.
- Keep localStorage saves small, JSON-serializable, and resilient to missing, malformed, old, or future-version data.
- Wrap storage writes in `try`/`catch` before saves become player-facing, because quota and privacy modes can throw.
- Never assume localStorage is transferable across browser, device, protocol, or domain.
- Add export/import save support before depending on localStorage for long-term player progress.
- Start audio only after player interaction or another browser-allowed path. Browser autoplay policy is part of the design constraint.
- Use capability detection for gamepad, storage, audio, and fullscreen features.

## Vite And Assets Standards

- Keep `npm run build` as `tsc --noEmit && vite build` so production builds cannot skip type checking.
- Use `npm run build:pages` for GitHub Pages because its base path differs from local/static default builds.
- Put Phaser-loaded public assets under `public/assets/` when they require stable runtime paths.
- Import source-owned assets through TypeScript/CSS only when Vite should hash and track them in the module graph.
- Keep raw design/reference files outside the production asset path unless they have been selected, optimized, renamed, and documented.
- Do not add a UI framework unless the product direction explicitly changes. Existing prototype React files are not production stack decisions.

## Testing Standards

- Run `npm run typecheck` after TypeScript changes.
- Run `npm test` after logic, save, data, math, or system changes.
- Run `npm run build` after changes to scenes, assets, Vite config, Phaser config, deployment behavior, or anything player-facing.
- Add or update Vitest coverage for pure logic, save defaults/migrations, data validators, mission rules, scoring/result calculations, and non-trivial math.
- Keep tests deterministic. Avoid real time, random numbers, browser storage, and Phaser runtime dependencies in unit tests unless the test explicitly controls them.
- Prefer small tests that describe behavior over snapshot-style tests for gameplay logic.

## Clean Code Standards

- Name things after gameplay meaning, not implementation mechanics.
- Keep functions short enough that their purpose is visible without scrolling through unrelated concerns.
- Split code by responsibility when a scene or system starts handling unrelated lifecycle, rendering, input, state, and persistence details.
- Do not abstract just because two lines look similar. Abstract when the shared concept has a stable name and reduces real maintenance risk.
- Keep mutable state local and explicit. Avoid hidden global state outside Phaser's normal game/scene managers and documented systems.
- Keep comments sparse and useful. Explain why a decision exists, not what a direct line of code already says.
- Keep authored strings, mission definitions, tuning, and dashboard lines in typed data modules instead of scattering them through scene code.
- Do not swallow errors silently in player-facing systems. Either recover intentionally or surface a clear fallback path.

## Documentation Standards

- Update project docs when implementation changes product scope, architecture, save shape, deployment behavior, asset workflow, or player-facing controls.
- Keep dates explicit and include timezone when adding status-style docs.
- Keep docs practical. Prefer decisions, constraints, checklists, and source links over long essays.
