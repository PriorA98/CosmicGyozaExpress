# Gameplay Decisions

Last updated: 2026-05-29 JST

Status: Phase 1 decisions locked with tailored docking/failure rules unless playtesting proves a problem.

This document captures the gameplay choices that should guide the next implementation work. The goal is to prevent the project from drifting into a bigger or different game before the core flight prototype is proven.

## Current Priority

The next milestone is:

> Finish Phase 1 - Flight Feel Prototype.

This means the project should focus on making flying, bumping, crashing, recovering, and approaching a target feel good before adding the full mission loop, galaxy map, final assets, or audio polish.

## Decision Summary

| Area | Decision | Why |
| --- | --- | --- |
| Route format | Bounded scrolling 2D route with camera follow | Supports handcrafted delivery missions without becoming open-world or infinite-runner scope. |
| Flight feel | Floaty velocity with direct rotation | Keeps inertia funny and skillful while preserving readable controls. |
| Failure model | No lives and no game over | Crashes should be comedic, recoverable, and low-pressure. |
| Docking rule | Mission 1 uses zone entry, low speed, and gentle angle alignment | Teaches controlled arrival and orientation without making the first route harsh. |
| Package condition | Affects flavor and result text, not progression | Keeps delivery warm and forgiving while still rewarding careful play. |
| Difficulty default | Cozy and forgiving by default | Matches the tone and avoids turning the first playable slice into a precision challenge. |
| Mission structure | Handcrafted linear unlocks | Keeps content authored, small, and emotionally directed. |
| Mobile role | Supported for demos, PC keyboard remains baseline | Mobile should work, but it should not dictate the whole game design yet. |

## Locked Gameplay Defaults

### 1. Route Format

Use bounded 2D mission spaces that are larger than the viewport.

The camera follows the ship through a handcrafted route with:

- start position;
- destination zone;
- obstacles;
- optional collectibles;
- optional force zones later;
- off-screen destination guidance.

Do not build:

- infinite runner structure;
- procedural galaxy;
- full open world;
- single-screen arena as the main format.

Implementation implication:

- Phase 1 should introduce a larger test field and camera follow.
- Tea Moon should become the first bounded route.

### 2. Flight Feel

Use floaty momentum, but keep rotation direct.

The ship should:

- accelerate in the direction it faces;
- continue drifting when thrust stops;
- rotate responsively when the player presses left/right;
- brake against current velocity;
- soft-cap speed rather than hard-clamping it.

Do not add angular inertia yet. It can make the ship harder to read and tune before the baseline is fun.

Implementation implication:

- Keep movement tuning centralized in `src/data/tuning.ts`.
- Add debug vector visuals for facing and velocity during Phase 1.

### 3. Failure Model

There are no lives and no game-over screen.

Crashes should trigger:

- quick poof or impact feedback;
- package condition loss;
- funny dashboard line;
- crash stat increment later;
- short input freeze;
- respawn at start or checkpoint.

Failure should cost dignity, not progress.

Implementation implication:

- Phase 1 should add collision severity and respawn.
- The first crash recovery should happen within roughly 2 seconds.

### 4. Docking Rule

Tea Moon docking should require:

- ship inside delivery zone;
- speed below docking threshold;
- facing angle within a broad docking cone, defaulting to roughly 45 degrees.

The first mission should include angle alignment, but it must be forgiving. It is a teaching tool, not a precision challenge.

Later missions may add:

- stricter facing angles;
- hold-to-deliver;
- gravity interference;
- moving delivery target;
- narrower docking zones.

Bad docking attempts should:

- block delivery completion;
- show whether the problem is speed or alignment;
- lightly bounce the ship away from the destination zone;
- avoid package condition loss unless the ship also collides or crashes.

Implementation implication:

- Add docking readiness as a pure logic check that can be tested.
- Show clear dashboard states: too far, slow down, align, ready.
- Use destination ring visuals to match the dashboard state.

### 5. Package Condition

Package condition is flavor, not a blocker.

Every main delivery should be accepted. Better condition changes the result tone and reward flavor, but the player should not need a perfect run to progress.

Recommended labels:

- Perfect.
- Slightly shaken.
- Emotionally rotated.
- Warm but confused.
- Still delicious.
- Dramatically rearranged.
- Basically fine.

Implementation implication:

- Store package condition as internal state.
- Display friendly labels instead of harsh grades.
- Use condition in result scene text during Phase 2.

### 6. Difficulty Default

The default experience should be forgiving.

For Mission 1:

- no hard timer;
- wide docking zone;
- broad docking angle tolerance;
- low crash punishment;
- readable destination direction;
- slow or static hazards;
- short route length;
- no mandatory collectibles.

Cozy Mode should remain available as an explicit setting, but the base game should already feel gentle.

Implementation implication:

- Avoid adding timers or score pressure to Phase 1 and Phase 2.
- Tune docking and crash thresholds around learning, not mastery.

### 7. Mission Structure

Use handcrafted linear mission unlocks.

Recommended campaign order:

1. Tea Moon Tutorial.
2. Asteroid Bento Belt.
3. Matcha Nebula Drift.
4. Black Hole Bakery.
5. Planet "I'm Fine".
6. Final Delivery: Package for the Gyoza Ship.

Do not add procedural route generation or broad mission selection until the handcrafted loop is proven.

Implementation implication:

- Mission data should be authored and typed.
- Phase 2 should only need Tea Moon plus enough unlock state to prove persistence.

### 8. Mobile Role

Mobile controls should work for demo testing, but PC keyboard remains the primary design baseline.

Supported now:

- touch zones for basic flight;
- browser gesture suppression;
- responsive canvas scaling.

Not locked yet:

- mobile-first UI;
- portrait layout;
- virtual joystick;
- final mobile control scheme.

Implementation implication:

- Keep testing deployed demos on mobile.
- Tune final flight feel against keyboard first.
- Treat mobile as compatibility support until the core PC feel is stable.

## Next Phase Scope

Phase 1 should add only what is needed to prove flight feel:

- larger bounded test field;
- camera follow;
- destination marker;
- gentle docking readiness check;
- bad-docking bounce;
- static obstacles;
- collision severity;
- crash respawn;
- restart input;
- useful dashboard readouts;
- debug vectors for tuning.

Avoid during Phase 1:

- galaxy map;
- mission progression;
- final result screen;
- full dashboard skin;
- final audio;
- multiple routes;
- complex asset production.

## Revisit Later

These decisions are intentionally deferred:

| Topic | Revisit When |
| --- | --- |
| Gamepad support | After keyboard flight and docking feel good. |
| Stricter angle-based docking | After Tea Moon is playable with gentle angle docking. |
| Mobile virtual joystick | If touch zones remain uncomfortable after Phase 1. |
| Scoring language | After result scene tone is tested. |
| Save export/import | After localStorage mission completion works. |
| Full asset pipeline | After the gyoza ship and Tea Moon route prove the game feel. |
| Timed challenge or spicy mode | After the full cozy campaign works. |

## Acceptance Criteria For These Decisions

The decisions are working if:

- a new player can understand that they are flying toward a destination;
- overshooting the target is common but recoverable;
- crashing is funny and fast, not frustrating;
- the first delivery can be completed without external explanation;
- the game still feels like a warm delivery experience, not an arcade punishment loop;
- the public demo remains clean and understandable after each milestone deploy.
