# Phase 1 Flight Feel Prototype Implementation Plan

Last updated: 2026-05-30 JST

Status: ready for Phase 1 implementation.

This document expands the Phase 1 milestone from `docs/implementation/implementation-plan.md` into an implementation-ready plan. It is intentionally limited to the flight-feel prototype: flying, drifting, approaching, bumping, crashing, recovering, and reading useful flight feedback.

## 1. Source Context Read

Canonical docs reviewed before this plan:

- `Cosmic Gyoza Express.md`
  - Movement is the main game feel.
  - The ship should feel floaty, inertial, funny, and learnable.
  - Food and delivery tone must stay warm, caring, and non-punitive.
  - Mistakes should be funny and recoverable.
- `docs/implementation/implementation-plan.md`
  - Locked stack: Phaser, TypeScript, Vite, Vitest, CSS, localStorage.
  - Phase 1 goal: make the gyoza ship fun to fly before building content.
  - Preferred approach: custom movement logic, Phaser rendering, simple collision helpers, typed tuning.
- `docs/gameplay-decisions.md`
  - Phase 1 is the current priority.
  - Use bounded 2D mission spaces with camera follow.
  - Use floaty velocity with direct rotation, not angular inertia yet.
  - Use no lives and no game-over screen.
  - Add gentle docking readiness: zone entry, low speed, broad bottom-side alignment.
  - Add bad-docking bounce, static obstacles, collision severity, crash respawn, restart input, useful dashboard readouts, and debug vectors.
- `docs/implementation/frontend-integration.md`
  - Phaser owns the flight scene.
  - Phase 1 can keep the live HUD in Phaser for simplicity.
  - Do not copy the prototype movement model.
  - Do not import production assets from `references/design-handoff/`.
- `docs/design/design-system.md` and `docs/design/ui-reference.md`
  - Flight HUD should be compact, readable, dark, and mono-styled.
  - Dashboard voice should be useful first, lightly funny second.
  - Crash language should be gentle: "gyoza incident" direction, not harsh failure.
  - Do not include prototype-only economy, pantry, toppings, or inflated progress counters.
- `docs/assets/asset-inventory.md`
  - Production ship and planet copies already belong under `public/assets/`.
  - Ship incident frames exist and should be used for the crash/poof sequence.
  - Missing Phase 1 asset categories can use generated Phaser shapes for now: asteroids, docking indicators, stars, particles, and UI widgets.
- `docs/engineering/development-standards.md`
  - Keep TypeScript strict.
  - Put tuning in `src/data/tuning.ts`.
  - Keep scenes focused on lifecycle, composition, and presentation.
  - Put reusable gameplay decisions in systems, typed data, entities, or utilities.
  - Clamp unusually large deltas before applying simulation.
  - Keep per-frame code allocation-conscious.
- `docs/engineering/implementation-checklist.md`
  - Run `npm run typecheck`, `npm test`, and `npm run build` for player-facing scene and logic changes.
- `docs/engineering/online-reference-map.md`
  - Use official Phaser, Vite, TypeScript, Vitest, and MDN docs first when API behavior matters.
- `docs/deployment.md`
  - Phase 1 is a meaningful GitHub Pages demo checkpoint after local validation.

## 2. Current Project Baseline

The repository already has a usable Phase 0 foundation:

- `src/main.ts` creates one Phaser game.
- `src/gameConfig.ts` defines a 1280x720 Phaser canvas with fit scaling and scenes.
- `src/scenes/BootScene.ts`, `PreloadScene.ts`, `TitleScene.ts`, and `FlightScene.ts` exist.
- `src/entities/GyozaShip.ts` exists and already implements basic custom thrust, braking, direct rotation, soft speed cap, and texture switching.
- `src/data/tuning.ts` centralizes initial ship tuning values.
- `public/assets/ship/` and `public/assets/planets/` already contain production-path copies of reference assets.
- `src/systems/SaveSystem.ts` and `src/types/save.ts` provide a versioned localStorage save model.
- `tests/math.test.ts` and `tests/save.test.ts` provide a minimal Vitest foundation.

Current Phase 1 gaps:

- Flight is still a single viewport, not a bounded scrolling route.
- The camera does not follow the ship through a larger world.
- The ship is clamped to the screen edges instead of moving inside route bounds.
- Movement logic lives directly in `GyozaShip`, which makes it harder to test and tune independently.
- Braking currently allocates a cloned vector in the per-frame path.
- Delta time is not clamped before simulation.
- There is no destination marker, delivery zone, docking state, or docking bounce.
- There are no static obstacles, collision severity tiers, crash state, incident animation, or respawn flow.
- There is no package condition state, even as Phase 1 flavor.
- The HUD is debug text only and does not yet communicate distance, docking readiness, package condition, or incident status.
- There are no debug vectors for bottom side, velocity, docking cone, or obstacle radii.
- Touch controls are currently tied to the single-screen scene; camera follow will require fixed screen-space HUD and input handling.
- `PreloadScene` loads only the first incident frame.

## 3. Phase 1 Goal

Build a playable flight-feel prototype that proves the core physical experience before the project adds the full mission loop.

The prototype should answer these questions:

- Is the gyoza ship satisfying to rotate, thrust, brake, drift, and recover?
- Can a player understand where to go in a larger bounded route?
- Can the player overshoot, laugh, correct, and eventually dock?
- Are bumps and crashes readable without becoming punishing?
- Does the dashboard help the player fly, not just decorate the screen?

## 4. Explicit Non-Goals

Do not implement these during Phase 1:

- Galaxy map.
- Mission briefing.
- Delivery result scene.
- Persistent mission completion.
- Full mission data schema.
- Multiple routes.
- Moving hazards.
- Gravity wells or environmental force zones.
- Final audio pass.
- Final dashboard skin.
- Final route art.
- Gamepad support.
- Save export/import.
- Economy, inventory, upgrades, coins, pantry, toppings, or scoring pressure.

Phase 1 may introduce lightweight data shapes that later mission systems can reuse, but it should not build the full Phase 2/3 content pipeline yet.

## 5. Target Player Experience

The Phase 1 prototype should launch from the title into a bounded Tea Moon-style test field.

Expected flow:

1. Player starts near the left side of a larger space route.
2. Camera follows the ship smoothly.
3. Destination indicator points toward a large delivery ring.
4. Player accelerates with `W`/Up, rotates with `A`/`D` or arrows, brakes with `S`/Down.
5. Player can drift sideways while the ship bottom points another direction.
6. Player can see velocity and bottom-side debug vectors during tuning.
7. Player passes or bumps into simple static obstacles.
8. Low-speed bumps nudge the ship and reduce package condition lightly.
9. High-speed crashes trigger a short gyoza incident, input freeze, and quick respawn.
10. Player approaches the destination and sees clear dashboard states: too far, slow down, align, ready.
11. Bad docking attempts bounce the ship away gently and explain the issue.
12. Ready docking shows a stable success/readiness state, but does not need to enter a result scene yet.
13. `R` restarts the prototype from the start/checkpoint.

## 6. Gameplay Defaults For Phase 1

These values are starting targets, not final tuning locks:

| Area | Starting Target |
| --- | --- |
| World size | About `3200x1800`, tuned after first camera pass |
| Camera | Follow ship, bounded to world, light smoothing |
| Start position | Left/center-left side of route |
| Destination | Right/center-right side of route |
| Delivery zone radius | About `130px` |
| Destination approach radius | About `420px` for dashboard state change |
| Docking max speed | `70px/s`, already present in `shipTuning` |
| Docking max angle | Use `45deg` for the first route unless playtesting proves it too loose |
| Bad docking bounce | Gentle impulse away from destination, cooldown-gated |
| Soft bump threshold | Low speed, nudge only |
| Dramatic bump threshold | Medium speed, stronger bounce, package condition loss |
| Crash threshold | High speed, incident animation and respawn |
| Respawn time | Complete recovery within roughly 2 seconds |
| Package condition | Internal `0-100`, displayed as friendly labels |
| Debug vectors | Visible by default during Phase 1, toggleable before demo handoff |

Docking angle should be data-driven. The destination should define an expected bottom-side direction, and the docking check should compare the ship bottom against that direction with a pure angle-difference helper. The ring visual should make that expected direction readable with a notch, arrow, or highlighted arc.

## 7. Architecture Plan

### 7.1 Keep `FlightScene` As Orchestrator

`FlightScene` should own Phaser lifecycle and composition:

- create world background;
- create route objects;
- create ship entity;
- create HUD and debug graphics;
- read input;
- call pure systems;
- update camera;
- update visuals;
- coordinate crash and respawn state.

It should not own the low-level rules for movement integration, docking readiness, collision classification, or package condition labels.

### 7.2 Extract Pure Flight Logic

Create or extend system modules for logic that can be tested without Phaser rendering:

- `src/systems/ShipMovementSystem.ts`
  - Integrates position, velocity, and rotation from controls and tuning.
  - Clamps large `dt`.
  - Applies thrust, brake, damping, and soft speed cap.
  - Uses plain numbers or small project types so tests do not require a Phaser scene.
- `src/systems/DockingSystem.ts`
  - Computes distance, speed, angle delta, and docking state.
  - Returns a discriminated union such as `too-far`, `approaching`, `slow-down`, `align`, or `ready`.
  - Does not mutate the ship.
- `src/systems/CollisionSystem.ts`
  - Detects circle overlaps for ship-vs-obstacle and ship-vs-world-boundary if needed.
  - Classifies impact severity from speed and tuning.
  - Computes bounce/reflection vectors or response impulses.
- `src/systems/PackageConditionSystem.ts`
  - Tracks condition loss events.
  - Maps numeric condition to warm display labels.
  - Keeps progression-independent tone.

If this feels too heavy while implementing, keep the public API small, but preserve the rule: logic that needs tests should not stay buried in `FlightScene`.

### 7.3 Keep `GyozaShip` Render-Focused

`GyozaShip` should become a renderable wrapper around ship state:

- own sprite texture, scale, origin, animation state, and immediate visual helpers;
- expose or consume a typed `ShipKinematicState`;
- avoid storing hidden gameplay rules that tests cannot reach;
- avoid avoidable allocations in `update()`.

The class can still expose convenience methods such as `speed()` and `setKinematicState()`, but movement math should come from the movement system.

### 7.4 Add Lightweight Route Data

Add a Phase 1-specific route data module rather than the full mission schema:

- Suggested file: `src/data/flightPrototypeRoute.ts`.
- Include world dimensions, start position, checkpoint position, destination, and static obstacles.
- Keep route data typed in `src/types/flight.ts` or a similarly named file.

Example concepts:

```ts
type FlightPrototypeRoute = {
  world: { width: number; height: number };
  start: { x: number; y: number; rotation: number };
  destination: {
    x: number;
    y: number;
    radius: number;
    approachRadius: number;
    requiredBottomFacingRadians: number;
  };
  obstacles: readonly StaticObstacleDefinition[];
};
```

Do not call this a full mission definition yet. That belongs to Phase 2.

### 7.5 Extend Tuning Deliberately

`src/data/tuning.ts` should grow beyond `shipTuning` only where the new values are real tuning controls:

- `movementTuning` or expanded `shipTuning`;
- `dockingTuning`;
- `collisionTuning`;
- `respawnTuning`;
- `packageConditionTuning`;
- `cameraTuning`.

Avoid raw magic numbers in `FlightScene`.

## 8. Detailed Work Packages

### Package A: Flight Domain Types And Tuning

Goal: give implementation a typed foundation before changing scene behavior.

Tasks:

- Add shared point/vector/ship-state types as needed.
- Add `ShipKinematicState` with `x`, `y`, `rotation`, `velocityX`, and `velocityY`.
- Add `DockingState` as a discriminated union.
- Add `CollisionSeverity` as `none`, `soft-bump`, `dramatic-bump`, or `gyoza-incident`.
- Add route data for the Phase 1 test field.
- Expand tuning constants for camera, docking, collision, package condition, and respawn.
- Update `dockingMaxAngleDegrees` from `35` to `45` for Phase 1 unless the first playtest proves `35` better.

Acceptance:

- TypeScript can express all Phase 1 states without `any`.
- Route layout is authored in data, not scattered through `FlightScene`.
- Future tuning changes do not require hunting through scene code.

### Package B: Movement System Refactor

Goal: preserve the current feel while making movement testable, frame-rate-aware, and easier to tune.

Tasks:

- Move thrust/brake/rotation/damping/soft-cap logic into a pure movement function.
- Clamp `dt` before applying simulation, with a reasonable maximum such as `1 / 20` seconds.
- Replace vector clone allocation in braking with direct numeric math or reusable vectors.
- Ensure rotation remains direct and does not add angular inertia.
- Keep thrust convention consistent: current code treats rotation `0` as thrusting upward from a downward-pointing bottom.
- Preserve visible behavior while making tests possible.
- Add tests for:
  - thrust adds velocity away from the ship bottom;
  - release preserves drift except damping;
  - brake reduces speed without instantly stopping;
  - soft speed cap reduces overspeed gradually;
  - large deltas are clamped.

Acceptance:

- Ship can drift sideways while the bottom points another direction.
- Counter-thrust and braking feel different.
- Movement results are stable enough across different frame rates.
- Tests cover the movement rules that are most likely to regress.

### Package C: Bounded World And Camera Follow

Goal: convert the single-screen prototype into a bounded scrolling route.

Tasks:

- Set Phaser camera bounds from route world dimensions.
- Set physics/world bounds only if using Phaser helpers; otherwise enforce route bounds through project logic.
- Replace viewport-only starfield with world-sized starfield generation.
- Move planet/background details into world coordinates.
- Start ship at route start.
- Follow ship with the main camera and light lerp/smoothing.
- Replace `keepShipInBounds()` viewport clamp with route-bound handling.
- Keep HUD, debug text, and touch controls fixed to the screen with `setScrollFactor(0)` or screen-space positioning.
- Verify touch hit areas use screen coordinates, not camera-scrolled world coordinates.

Acceptance:

- Ship can travel beyond the initial viewport.
- Camera follows without losing the ship.
- Route bounds are visible or felt without abrupt screen-edge clamping.
- HUD does not drift with the world.
- Touch controls still work after the camera moves.

### Package D: Destination Marker And Docking System

Goal: make approach and controlled arrival readable.

Tasks:

- Render destination ring and approach radius.
- Render expected bottom-side direction on the ring.
- Add off-screen destination guidance, such as a screen-edge arrow or HUD bearing.
- Implement pure docking readiness checks:
  - distance to destination;
  - speed;
  - angle delta from destination expected bottom direction;
  - resulting docking state.
- Display docking state in the HUD:
  - too far;
  - approaching;
  - slow down;
  - align;
  - ready.
- Add destination ring visual states matching the dashboard.
- Implement bad-docking bounce with cooldown:
  - trigger only when the ship is inside the delivery zone and not ready;
  - apply a gentle impulse away from destination;
  - show reason text;
  - do not reduce package condition unless there is also a collision/crash.

Acceptance:

- Player can tell whether the issue is distance, speed, or alignment.
- Player can intentionally reach `ready` after practice.
- Bad docking communicates the problem without feeling like a fail state.
- Docking logic has unit tests independent of Phaser.

### Package E: Static Obstacles, Collision Severity, And Package Condition

Goal: make bumping and crashing part of the feel prototype without adding punishment.

Tasks:

- Add static circular obstacles from route data.
- Render obstacles with Phaser shapes or simple generated textures.
- Approximate ship collision with a circle radius tuned to the displayed ship scale.
- Detect ship-obstacle overlaps.
- Classify impact severity from speed:
  - soft bump;
  - dramatic bump;
  - gyoza incident.
- Apply collision response:
  - separate overlapping bodies;
  - reflect or dampen velocity;
  - add small spin/wobble only if it stays readable;
  - avoid angular inertia as a core movement model.
- Add package condition state:
  - soft bump: tiny condition loss;
  - dramatic bump: larger condition loss;
  - gyoza incident: clear but non-blocking condition loss;
  - condition never blocks docking in Phase 1.
- Display condition label using warm copy:
  - Perfect;
  - Slightly shaken;
  - Emotionally rotated;
  - Warm but confused;
  - Still delicious;
  - Dramatically rearranged;
  - Basically fine.

Acceptance:

- Low-speed obstacle contact feels like a bump, not a reset.
- High-speed impact clearly triggers an incident.
- Package condition changes tone but does not punish progression.
- Collision and package label logic have focused tests.

### Package F: Gyoza Incident And Respawn

Goal: make crashes funny, fast, and recoverable.

Tasks:

- Load all five incident frames in `PreloadScene`.
- Add a crash/incident state to `FlightScene`.
- Freeze gameplay input briefly during the incident.
- Play a short incident animation or frame sequence.
- Add a steam/confetti/crumb particle placeholder using Phaser shapes or simple particles.
- Respawn at route start or the latest checkpoint.
- Reset velocity on respawn.
- Restore input within roughly 2 seconds.
- Add `R` restart from normal flight and crash states.
- Add one or two dashboard incident lines using gentle language.

Acceptance:

- Crashing does not lead to game over.
- Player is back in control quickly.
- Incident feedback is visible even without final audio.
- `R` reliably restarts the prototype.

### Package G: Dashboard And Debug Visuals

Goal: make Phase 1 tunable and readable.

Tasks:

- Replace raw debug text with a compact Phase 1 dashboard panel.
- Keep essential readouts stable:
  - speed;
  - distance;
  - bottom-side heading;
  - docking state;
  - package condition;
  - last dashboard line.
- Add debug graphics:
  - bottom-side vector;
  - velocity vector;
  - destination zone;
  - docking cone or expected direction;
  - obstacle radii;
  - world bounds if helpful.
- Add a debug toggle key such as `F1` or backtick.
- Keep dashboard and debug visuals from hiding hazards near the ship.
- Use design tokens from `src/game/designTokens.ts`.

Acceptance:

- A developer can tune movement from on-screen information.
- A player can understand destination approach without reading docs.
- Debug visuals can be disabled for demo capture.

### Package H: Input And Pause-Safe Controls

Goal: make control behavior explicit enough for Phase 1 and safe for later growth.

Tasks:

- Keep keyboard baseline:
  - `W`/Up: thrust;
  - `S`/Down: brake;
  - `A`/Left: rotate left;
  - `D`/Right: rotate right;
  - `R`: restart;
  - `F1` or backtick: debug toggle;
  - `Esc`: reserved for pause, but Phase 1 may show a placeholder.
- Preserve current touch pads as demo compatibility.
- Ensure touch pads remain screen-fixed with camera follow.
- Do not add gamepad support yet.
- Keep input ignored during crash freeze.

Acceptance:

- Keyboard controls are stable and documented in the HUD or title prompt.
- Touch controls do not break after camera follow lands.
- Crash and restart states do not accept conflicting movement input.

### Package I: Tuning And Manual Playtest Pass

Goal: tune until the prototype proves the feel, not just the feature list.

Tasks:

- Tune thrust, brake, damping, rotation speed, max soft speed, and overspeed drag.
- Tune camera smoothing and route size.
- Tune obstacle count and placement.
- Tune collision thresholds and bounce strength.
- Tune docking radius, speed threshold, and angle tolerance.
- Tune package condition loss values.
- Run repeated approach attempts from the start and from near-destination recovery.

Manual playtest checklist:

- Can the player identify where to go within 5 seconds?
- Is overshooting common but recoverable?
- Does braking help without becoming an instant stop?
- Can the player dock after 2-3 minutes of practice?
- Does a soft bump feel non-catastrophic?
- Does a high-speed crash read clearly?
- Does respawn complete within roughly 2 seconds?
- Does the dashboard state match what the player sees?
- Are controls readable on desktop and still usable on a mobile demo viewport?

Acceptance:

- The prototype feels like a low-pressure flight toy with a destination.
- Movement tuning is good enough to build Tea Moon around it in Phase 2.

## 9. Suggested Implementation Order

Implement in this order to keep risk visible:

1. Add types, route data, and tuning expansion.
2. Extract and test movement integration.
3. Convert `FlightScene` to bounded world and camera follow.
4. Fix HUD/touch controls for camera scrolling.
5. Add destination ring and docking system tests.
6. Add dashboard states and visual docking feedback.
7. Add static obstacles and collision response.
8. Add package condition labels.
9. Add gyoza incident animation and respawn.
10. Add debug vectors and debug toggle.
11. Tune movement, collision, docking, and camera together.
12. Run full validation and decide whether the demo is ready for `demo` branch promotion.

## 10. Test Plan

Unit tests should cover pure systems:

- `tests/movement.test.ts`
  - thrust direction;
  - drift persistence;
  - braking behavior;
  - damping;
  - soft speed cap;
  - delta clamp.
- `tests/docking.test.ts`
  - too far;
  - approaching but not in zone;
  - in zone but too fast;
  - in zone but misaligned;
  - ready when speed and angle are valid;
  - broad angle tolerance around wraparound boundaries.
- `tests/collision.test.ts`
  - no overlap;
  - overlap separation;
  - severity thresholds;
  - bounce direction.
- `tests/packageCondition.test.ts`
  - condition remains bounded;
  - labels map to friendly states;
  - soft/dramatic/crash losses behave as expected.

Scene-level behavior remains mostly manual for Phase 1 unless an e2e harness is added later.

Required validation before handoff:

```bash
npm run typecheck
npm test
npm run build
```

Also run a browser smoke test through the Vite dev server:

```bash
npm run dev
```

Manual smoke:

- title enters flight scene;
- ship moves and camera follows;
- HUD stays fixed;
- destination can be found;
- docking states update;
- obstacles bump/crash;
- respawn works;
- restart works;
- debug toggle works;
- touch pads still work at least basically.

Before promoting to GitHub Pages demo, also run:

```bash
npm run build:pages
```

## 11. Demo Readiness Definition

Phase 1 is ready to share as a demo when:

- The ship has clear inertia and controllable drift.
- Braking and counter-thrust are both meaningful.
- The route is larger than the viewport and camera follow works.
- Destination feedback clearly communicates too far, slow down, align, and ready.
- Static obstacles produce readable bumps and incidents.
- Crashes recover within roughly 2 seconds.
- Restart works.
- Dashboard information is useful and not cluttered.
- Debug visuals can be disabled.
- Movement is stable across normal desktop frame rates.
- `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:pages` pass.

## 12. Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Movement loses the current pleasant baseline during refactor | Add movement tests first, preserve current tuning as initial values, and change tuning only after behavior is restored. |
| Phaser camera follow breaks HUD or touch controls | Treat HUD/touch as screen-space UI and test after camera movement, not at the end. |
| Collision feels punitive | Start with soft thresholds, generous bounce, and no progression blocking. |
| Docking feels too strict | Start at about `45deg` and wide radius; tune after manual playtest. |
| Scene grows into a rules dump | Extract movement, docking, collision, and package condition into small pure systems. |
| Debug visuals become accidental production UI | Add an explicit toggle and keep debug rendering grouped. |
| Package condition looks like a score grade | Use warm labels only; do not show harsh grades or failure copy. |
| Phase 1 scope leaks into Phase 2 | Do not add briefing, result scene, mission completion, map unlocks, audio polish, or multiple routes in this phase. |

## 13. Files Expected To Change

Likely source files:

- `src/data/tuning.ts`
- `src/data/flightPrototypeRoute.ts`
- `src/entities/GyozaShip.ts`
- `src/game/events.ts`
- `src/scenes/FlightScene.ts`
- `src/scenes/PreloadScene.ts`
- `src/types/flight.ts`
- `src/utils/math.ts`
- `src/systems/ShipMovementSystem.ts`
- `src/systems/DockingSystem.ts`
- `src/systems/CollisionSystem.ts`
- `src/systems/PackageConditionSystem.ts`

Likely tests:

- `tests/movement.test.ts`
- `tests/docking.test.ts`
- `tests/collision.test.ts`
- `tests/packageCondition.test.ts`
- existing `tests/math.test.ts` if new angle helpers are added there.

Docs to update during or after implementation:

- `docs/gameplay-decisions.md` only if playtesting changes the locked Phase 1 decisions.
- `docs/assets/asset-inventory.md` only if new production assets are introduced.
- `docs/implementation/phase-1-flight-feel-prototype-plan.md` if implementation intentionally diverges from this plan.

## 14. Handoff Notes For Phase 2

After Phase 1, Phase 2 should be able to build Tea Moon on top of:

- stable ship movement;
- route world and camera pattern;
- destination/docking logic;
- obstacle and collision primitives;
- package condition state;
- basic dashboard state model;
- incident and respawn flow;
- reusable tuning and tests.

Phase 2 should then add the actual mission loop: briefing, delivery completion, result scene, mission save completion, first memory reward, and Tea Moon content polish.
