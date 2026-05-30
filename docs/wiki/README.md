# Gameplay Wiki

Last updated: 2026-05-30 JST

This folder is the gameplay and mechanics wiki for Cosmic Gyoza Express. It rewrites the core game concept into smaller implementation-facing pages so future work can reference stable mechanics without rereading the full concept document each time.

## Reading Order

1. `core-gameplay.md`
   - Player promise, game loop, phase boundaries, and tone rules.
2. `mechanics-overview.md`
   - How the major gameplay systems fit together.
3. `flight-mechanics.md`
   - Route flight, inertia, controls, collisions, and current Phase 1 behavior.
4. `one-bottom-thruster-landing.md`
   - Locked Phase 2 landing concept: a short assisted lunar-lander sequence built around the ship's single bottom thruster.
5. `delivery-results.md`
   - How delivery completion, package condition, result copy, save progress, and rewards should work.

## Canonical Priority

When there is a conflict:

1. `../gameplay-decisions.md` for locked gameplay decisions.
2. This wiki for current mechanics interpretation.
3. `../implementation/implementation-plan.md` for production phases.
4. `../../Cosmic Gyoza Express.md` for original tone and emotional boundaries.
5. Raw prototype files under `../../references/design-handoff/` for visual/source inspection only.

## Scope Control

The wiki is allowed to clarify mechanics, naming, and implementation intent. It should not quietly add new product scope such as procedural generation, multiplayer, accounts, economy, upgrades, or diet/scoring language.
