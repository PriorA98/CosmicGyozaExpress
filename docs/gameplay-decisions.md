# Gameplay Decisions

Last updated: 2026-05-30 JST

Status: Phase 1 flight-feel decisions implemented; Phase 2 Tea Moon landing/delivery model locked unless playtesting proves a problem.

This document captures the gameplay choices that should guide the next implementation work. The goal is to prevent the project from drifting into a bigger or different game while the Tea Moon vertical slice proves the complete loop.

## Current Priority

The next milestone is:

> Build Phase 2 - Tea Moon Vertical Slice.

This means the project should keep the proven Phase 1 route-flight feel, then add the first complete delivery loop: Tea Moon mission setup, route approach, one-bottom-thruster landing, delivery result, and localStorage mission completion.

## Decision Summary

| Area | Decision | Why |
| --- | --- | --- |
| Route format | Bounded scrolling 2D route with camera follow | Supports handcrafted delivery missions without becoming open-world or infinite-runner scope. |
| Flight feel | Floaty velocity with direct rotation | Keeps inertia funny and skillful while preserving readable controls. |
| Failure model | No lives and no game over | Crashes should be comedic, recoverable, and low-pressure. |
| Arrival gate | Mission 1 uses zone entry, low speed, gentle angle alignment, and a short stable ready window | Teaches controlled arrival and starts landing without making the first route harsh. |
| Landing model | Tea Moon uses a short assisted one-bottom-thruster lunar-lander sequence | Makes the ship's goofy physical limitation central to delivery while keeping the vertical slice memorable. |
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

- Phase 1 introduced a larger test field and camera follow.
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
- Keep debug vector visuals available for tuning.

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

- Phase 1 added collision severity and respawn.
- The first crash recovery should happen within roughly 2 seconds.

### 4. Arrival Gate

Tea Moon route arrival should require:

- ship inside delivery zone;
- speed below docking threshold;
- facing angle within a broad docking cone, defaulting to roughly 45 degrees.
- short stable ready duration, defaulting to roughly 0.4-0.6 seconds.

The first mission should include angle alignment, but it must be forgiving. It is a teaching tool, not a precision challenge.

When the arrival gate is satisfied, the route should transition into the landing scene. It should not instantly complete the delivery.

Later missions may add:

- stricter facing angles;
- hold-to-deliver;
- gravity interference;
- moving delivery target;
- narrower docking zones.

Bad arrival attempts should:

- block delivery completion;
- show whether the problem is speed or alignment;
- lightly bounce the ship away from the destination zone;
- avoid package condition loss unless the ship also collides or crashes.

Implementation implication:

- Add docking readiness as a pure logic check that can be tested.
- Show clear dashboard states: too far, slow down, align, ready.
- Use destination ring visuals to match the dashboard state.

### 5. One-Bottom-Thruster Landing

Tea Moon landing should use a separate short assisted landing scene inspired by Lunar Lander.

Locked landing concept:

> The gyoza ship has only one thruster on its bottom. Horizontal correction comes from tilting the whole ship before firing that bottom thruster.

Landing should use:

- side-view or slightly angled 2D landing screen;
- gravity pulling downward;
- one visible bottom thruster;
- `W` / Up to fire the bottom thruster;
- `A` / `D` to rotate;
- `S` / Down as a gentle stabilizer assist for Tea Moon;
- wide landing pad;
- generous safe speed and angle thresholds;
- soft, bumpy, and incident landing outcomes.

Tea Moon should be forgiving:

- no fuel limit;
- no hard timer;
- no lives;
- no full-route restart after landing incident;
- bumpy but valid landings still complete delivery.

Landing incidents should:

- trigger a short gyoza incident or bounce;
- reduce package condition when appropriate;
- restart the landing attempt quickly;
- preserve route progress.

Implementation implication:

- Add `LandingScene`.
- Add pure landing logic that can be tested without Phaser rendering.
- Treat current docking readiness as an arrival gate into landing.
- Keep player-facing language focused on landing and delivery rather than scoring.

### 6. Package Condition

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

### 7. Difficulty Default

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

### 8. Mission Structure

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

### 9. Mobile Role

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

Phase 2 should add only what is needed to prove the Tea Moon vertical slice:

- Tea Moon mission data;
- mission start flow from title or map-lite;
- arrival gate stable-ready timer;
- transition from route flight to landing;
- one-bottom-thruster landing scene;
- landing result classification;
- delivery result scene;
- package condition use in result text;
- Tea Moon completion save;
- one memory/reward placeholder;
- useful dashboard/readout updates for landing.

Avoid during Phase 2:

- full galaxy map;
- multiple routes;
- final asset pipeline;
- full dashboard skin;
- final audio;
- complex collectibles;
- economy/upgrades;
- gamepad support;
- save export/import.

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
