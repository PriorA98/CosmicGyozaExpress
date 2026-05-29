# Implementation Checklist

Last updated: 2026-05-29 JST

Use this checklist before, during, and after implementation. It is intentionally short enough to use every time.

## Before Coding

- Read `README.md`, `docs/README.md`, and the relevant implementation/design docs for the area being changed.
- Check `docs/engineering/development-standards.md` and `docs/engineering/online-reference-map.md`.
- Identify the layer being changed: scene, entity, system, data, type, utility, DOM shell, asset, or deployment.
- Confirm the change does not expand scope beyond the locked stack or MVP direction.
- If the change depends on current external behavior, verify it against official docs before implementing.

## During Coding

- Keep TypeScript strict and precise. Do not introduce `any` or broad assertions to bypass compiler feedback.
- Put gameplay rules in systems or typed data, not directly in scenes unless the behavior is scene-specific glue.
- Keep scene code focused on Phaser lifecycle, composition, and presentation.
- Keep entities focused on renderable object behavior and immediate state.
- Put authored constants, tuning, IDs, and content in typed data modules.
- Use Phaser loader keys consistently. Promote repeated string keys to constants when they become shared.
- Avoid avoidable allocation in per-frame `update()` logic.
- Handle browser boundaries defensively: localStorage, audio start, gamepad availability, fullscreen, and imported save data.
- Add tests with the implementation when behavior can be exercised outside the Phaser renderer.

## Before Handoff

- Run `npm run typecheck` for TypeScript changes.
- Run `npm test` for logic, save, utility, data, or system changes.
- Run `npm run build` for player-facing, scene, asset, Vite, deployment, or Phaser config changes.
- Manually smoke-test in the browser when visuals, input, scene flow, canvas sizing, or loaded assets changed.
- Update docs when architecture, standards, save schema, deployment, controls, or asset workflow changed.
- Check `git status --short` and review the final diff before reporting completion.

## Review Questions

- Is the simplest reader-visible behavior clear from the code?
- Can future missions reuse this without copying scene internals?
- Can save data survive malformed, missing, or old stored JSON?
- Are tuning numbers named and centralized?
- Does this still work as a static Vite build?
- Did tests cover the logic that would be annoying to regress manually?
