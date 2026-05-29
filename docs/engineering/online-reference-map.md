# Online Reference Map

Last checked: 2026-05-29 JST

This project should use official documentation as the first reference when implementation questions come up. Blog posts, tutorials, and generated snippets can be useful for examples, but they should not override these sources or the project documents in this repository.

## Stack References

| Area | Official reference | Project use |
| --- | --- | --- |
| Phaser overview | https://docs.phaser.io/phaser/getting-started/what-is-phaser | Confirms Phaser as the browser-focused 2D game framework for rendering, assets, input, and scene management. |
| Phaser scenes | https://docs.phaser.io/phaser/concepts/scenes | Use scenes as lifecycle boundaries: boot, preload, title/menu, flight, result, settings, and ending. |
| Phaser loader | https://docs.phaser.io/phaser/concepts/loader | Load runtime assets through `PreloadScene` with stable string keys before scenes consume them. |
| Phaser game objects | https://docs.phaser.io/phaser/concepts/gameobjects | Keep renderable entities as focused Game Objects that own presentation and immediate per-entity state. |
| Phaser input | https://docs.phaser.io/phaser/concepts/input | Use Phaser's unified pointer, keyboard, touch, and gamepad input APIs instead of direct DOM input for gameplay. |
| Phaser physics | https://docs.phaser.io/phaser/concepts/physics | Prefer custom inertial movement plus simple geometry or Arcade Physics. Use Matter Physics only when complex shapes or constraints are required. |
| Vite guide | https://vite.dev/guide/ | Keep the app as a static Vite browser build with local development through the Vite dev server. |
| Vite TypeScript behavior | https://vite.dev/guide/features.html#typescript | Vite transpiles TypeScript but does not type-check it, so `tsc --noEmit` remains a required quality gate. |
| Vite static assets | https://vite.dev/guide/assets.html | Use `public/` for Phaser-loaded assets that need stable URLs, and module imports for source-referenced assets that should be hashed. |
| Vite production build | https://vite.dev/guide/build | Use `vite build` for static deploy output and keep base-path-sensitive deploys explicit. |
| TypeScript strictness | https://www.typescriptlang.org/docs/handbook/2/basic-types.html#strictness | Keep `strict` enabled and treat compiler feedback as design feedback, not noise. |
| TypeScript narrowing | https://www.typescriptlang.org/docs/handbook/2/narrowing.html | Narrow unknown or external data at boundaries before using it as project domain data. |
| Google TypeScript style | https://google.github.io/styleguide/tsguide.html | Use modern TypeScript, clear modules, and simple exported APIs as the general style baseline. |
| TypeScript ESLint rules | https://typescript-eslint.io/rules/no-explicit-any/ | Avoid `any`; use precise domain types or `unknown` with narrowing at boundaries. |
| Vitest writing tests | https://vitest.dev/guide/ | Test pure helpers, save migrations, mission rules, and deterministic system behavior with Vitest. |
| Vitest TypeScript support | https://vitest.dev/guide/features.html | Vitest runs TypeScript through Vite, but test execution does not replace the separate type-check gate. |

## Browser Platform References

| Area | Official reference | Project use |
| --- | --- | --- |
| localStorage API | https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage | Store small versioned saves locally for the same origin and browser. |
| Browser storage quotas | https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria | Handle quota and eviction risks with small saves, `try`/`catch`, and future export/import support. |
| Media autoplay | https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay | Start music and sound only after player interaction or a browser-allowed playback path. |
| Gamepad API | https://developer.mozilla.org/en-US/docs/Games/Techniques/Controls_Gamepad_API | Treat gamepad support as browser capability detection layered behind the project input system. |
| JavaScript modules | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules | Keep ESM imports/exports explicit and side-effect-light. |

## Codex Reference

| Area | Official reference | Project use |
| --- | --- | --- |
| Codex CLI overview | https://help.openai.com/en/articles/11096431-openai-codex-cli-getting-started | Confirms Codex as a local coding agent that can read, modify, and run project code. |
| AGENTS.md behavior | https://openai.com/index/introducing-codex/ | Use `AGENTS.md` as repo-scoped instructions for code style, structure, and checks. |

## Source Selection Rule

When docs disagree, apply this order:

1. Current user request.
2. Project docs and `AGENTS.md`.
3. Official stack documentation above.
4. Existing project code patterns.
5. Third-party examples, only after adapting them to this project.
