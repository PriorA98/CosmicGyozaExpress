# Phase 2 Tea Moon Vertical Slice Implementation Plan

Last updated: 2026-05-30 JST

Status: ready for implementation after Phase 1 flight-feel prototype.

This plan defines the implementation path for the first complete playable delivery loop: Tea Moon mission start, route flight, arrival gate, one-bottom-thruster landing, delivery result, reward, and saved completion.

## 1. Source Context

Read these before implementing Phase 2:

- `docs/gameplay-decisions.md`
  - Phase 2 priority and locked one-bottom-thruster landing model.
- `docs/wiki/core-gameplay.md`
  - Full loop, terminology, and phase boundaries.
- `docs/wiki/mechanics-overview.md`
  - System map from mission setup through delivery result.
- `docs/wiki/flight-mechanics.md`
  - Current route-flight behavior and arrival role.
- `docs/wiki/one-bottom-thruster-landing.md`
  - Locked landing mechanic details.
- `docs/wiki/delivery-results.md`
  - Result tone, package condition use, and save/reward expectations.
- `docs/implementation/phase-1-flight-feel-prototype-plan.md`
  - Current Phase 1 technical foundation.
- `docs/implementation/implementation-plan.md`
  - Overall production phases and MVP direction.
- `docs/design/design-system.md`
  - HUD/result visual language.
- `docs/engineering/development-standards.md`
  - Architecture, testing, TypeScript, and Phaser standards.

## 2. Phase 2 Goal

Build a complete Tea Moon vertical slice that proves the full delivery loop.

The player should be able to:

1. Start Tea Moon from the title or a simple map-lite/start screen.
2. Fly the current bounded route.
3. Reach the arrival gate by slowing and aligning.
4. Transition into a separate landing scene.
5. Land using the gyoza ship's single bottom thruster.
6. Deliver tea and moon mochi.
7. See a warm result scene.
8. Reload and see Tea Moon completion persisted.

## 3. Locked Phase 2 Decisions

### Landing Model

Tea Moon uses a short assisted landing scene inspired by Lunar Lander.

The ship has only one bottom thruster:

- `W` / Up fires the bottom thruster.
- `A` / `D` rotate the ship.
- `S` / Down provides gentle stabilizer assist for Tea Moon.
- Horizontal correction comes from tilting before thrusting.

### Arrival Gate

Current route-flight docking readiness becomes an arrival gate into landing.

Tea Moon arrival requires:

- inside destination zone;
- speed below threshold;
- bottom side pointed within broad tolerance of the landing guide;
- stable ready duration around `0.4-0.6s`.

### Landing Outcome

Landing can be:

- `soft`: valid clean landing.
- `bumpy`: valid rough landing with minor package condition loss.
- `incident`: invalid high-impact or off-pad landing, followed by quick landing retry.

Soft and bumpy landings complete delivery. Incidents do not restart the full route.

### Package Condition

Package condition remains flavor, not a blocker.

Condition affects:

- result label;
- recipient reaction line;
- delivery report copy;
- potential memory/reward flavor later.

It does not block mission completion.

## 4. Non-Goals

Do not add these during Phase 2:

- full galaxy map;
- multiple missions;
- final asset pipeline;
- final audio pass;
- complex collection screen;
- fuel limits;
- hard landing timer;
- high-score ratings;
- side thrusters;
- strict terrain collision;
- gamepad support;
- save export/import.

Phase 2 can use placeholder shapes, generated particles, simple text panels, and existing ship/planet assets.

## 5. Current Technical Baseline

Existing Phase 1 systems to reuse:

- `src/types/flight.ts`
  - flight state, route, docking state, collision/package types.
- `src/data/flightPrototypeRoute.ts`
  - Tea Moon-style prototype route data.
- `src/data/tuning.ts`
  - movement, camera, docking, collision, package, and respawn tuning.
- `src/systems/ShipMovementSystem.ts`
  - route-flight movement integration.
- `src/systems/DockingSystem.ts`
  - current arrival readiness logic.
- `src/systems/CollisionSystem.ts`
  - circle collision and severity helpers.
- `src/systems/PackageConditionSystem.ts`
  - condition loss and friendly labels.
- `src/scenes/FlightScene.ts`
  - route scene, HUD, obstacles, crash/respawn, destination visuals.
- `src/systems/SaveSystem.ts`
  - versioned localStorage save with `completedMissions` and `unlockedMissions`.

Phase 2 should extend these without turning `FlightScene` into a mission/result/landing dump.

## 6. Target Scene Flow

Minimum Phase 2 scene flow:

```text
BootScene
  -> PreloadScene
  -> TitleScene
  -> FlightScene
  -> LandingScene
  -> DeliveryResultScene
  -> TitleScene or FlightScene replay
```

Optional map-lite is allowed if it stays small:

```text
TitleScene -> TeaMoonBriefingScene -> FlightScene
```

If a full briefing scene would slow implementation, title can launch Tea Moon directly and a compact mission panel can appear inside `FlightScene`.

## 7. Architecture Plan

### 7.1 Mission Data

Add Tea Moon mission data without overbuilding the full campaign schema.

Suggested files:

- `src/types/mission.ts`
- `src/data/missions.ts`

Minimum mission fields:

```ts
type MissionDefinition = {
  readonly id: string;
  readonly title: string;
  readonly routeId: string;
  readonly recipientName: string;
  readonly deliveryItemName: string;
  readonly requestText: string;
  readonly memoryRewardId: string;
  readonly resultLines: PackageConditionResultLines;
};
```

Tea Moon mission id should match save data:

```ts
"tea-moon"
```

### 7.2 Flight To Landing Handoff

Add a typed handoff payload from `FlightScene` to `LandingScene`.

Suggested type:

```ts
type LandingSceneData = {
  readonly missionId: string;
  readonly packageCondition: number;
  readonly routeCrashes: number;
  readonly routeDurationMs: number;
};
```

`FlightScene` should start `LandingScene` when arrival readiness has remained stable long enough.

### 7.3 Arrival Gate System

Keep `DockingSystem` for readiness, or rename later to `ArrivalSystem` if implementation touches it heavily.

Add stable-ready behavior outside pure docking readiness:

- `ArrivalGateSystem` or small pure helper;
- tracks how long the current docking state has been `ready`;
- resets timer when state leaves `ready`;
- returns whether transition should happen.

This is testable without Phaser.

### 7.4 Landing System

Add pure landing logic:

- `src/types/landing.ts`
- `src/data/landingTuning.ts` or `landingTuning` in `src/data/tuning.ts`
- `src/systems/LandingSystem.ts`

Core state:

```ts
type LandingKinematicState = {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly angularVelocity: number;
};
```

Controls:

```ts
type LandingControls = {
  readonly thrust: boolean;
  readonly rotateLeft: boolean;
  readonly rotateRight: boolean;
  readonly stabilizer: boolean;
};
```

Landing phase:

```ts
type LandingPhase =
  | { readonly kind: "intro" }
  | { readonly kind: "descending" }
  | { readonly kind: "touching" }
  | { readonly kind: "settling"; readonly startedAtMs: number }
  | { readonly kind: "delivered" }
  | { readonly kind: "incident"; readonly startedAtMs: number; readonly incidentKind: LandingIncidentKind };
```

Pure functions:

- integrate landing movement;
- apply one-bottom-thruster force;
- apply stabilizer assist;
- classify landing incident subtype;
- detect pad contact;
- classify touchdown;
- compute landing result.

### 7.5 Landing Scene

Add `src/scenes/LandingScene.ts`.

Responsibilities:

- render moon surface and landing pad;
- render ship in side-view scale using existing ship sprite;
- switch to existing thrust ship frames while thrusting;
- read keyboard/touch controls;
- call landing system;
- classify touchdown;
- apply incident/retry;
- transition to result scene on delivery.

Keep scene-specific visuals here, but keep physics and classification in systems.

### 7.6 Delivery Result Scene

Add `src/scenes/DeliveryResultScene.ts`.

Responsibilities:

- show recipient reaction;
- show delivery item;
- show friendly package condition label;
- show landing result flavor;
- show memory/reward placeholder;
- persist mission completion;
- offer replay/continue action.

DOM UI is still recommended for final result screens, but Phase 2 can use Phaser text/panels if that keeps the vertical slice focused.

### 7.7 Save Integration

Extend save behavior through existing `SaveSystem`.

Minimum behavior:

- when Tea Moon completes, add `"tea-moon"` to `completedMissions`;
- increment `stats.totalDeliveries`;
- update `stats.bestMissionResults["tea-moon"]`;
- add memory reward id to `collectedMemories`;
- preserve data across reload.

Do not change save version unless the shape changes incompatibly. Existing fields already support Phase 2 minimum save needs.

## 8. Landing Gameplay Tuning Targets

Starting Tea Moon landing values:

| Area | Starting Target |
| --- | --- |
| Landing scene size | `1280x720` fixed logical view |
| Pad width | `260-340px` |
| Gravity | gentle enough for `10-25s` descent |
| Thruster acceleration | strong enough to hover when mostly upright |
| Rotation speed | readable, slightly slower than route flight |
| Stabilizer | reduces angular velocity and nudges toward upright |
| Safe vertical speed | generous, tune by feel |
| Safe horizontal speed | generous, tune by feel |
| Safe angle | broad, around `18-25deg` for Tea Moon |
| Bumpy angle/speed | wider than safe, still accepted |
| Incident retry | recover within about `2s` |

Exact values should be set in tuning and adjusted by manual playtest.

## 9. Work Packages

### Package A: Mission And Scene Flow Foundation

Tasks:

- Add mission types and Tea Moon mission data.
- Register new scenes in `gameConfig.ts`.
- Add scene keys/constants if useful.
- Pass mission id into `FlightScene` or keep Tea Moon as default for Phase 2.
- Update title action text from prototype language to Tea Moon delivery language.

Acceptance:

- Title can start Tea Moon route.
- Mission identity is not hardcoded in every scene.

### Package B: Arrival Gate Stable-Ready Transition

Tasks:

- Add stable-ready timer logic.
- Show dashboard feedback during stable ready, such as `landing window holding`.
- Transition to `LandingScene` after the ready window.
- Pass package condition, crash count, and route duration to landing.
- Keep bad arrival bounce behavior for too-fast attempts; misalignment should be dashboard guidance only.

Acceptance:

- Reaching ready briefly does not accidentally transition.
- Holding ready for the configured time transitions reliably.
- Unit tests cover timer reset and completion.

### Package C: Landing Types, Tuning, And Pure System

Tasks:

- Add landing domain types.
- Add landing tuning constants.
- Implement one-bottom-thruster integration.
- Implement gravity.
- Implement rotation/stabilizer.
- Implement pad contact detection.
- Implement touchdown classification.
- Add tests for thrust direction, tilt tradeoff, stabilizer, safe landing, bumpy landing, incident landing, and incident subtype classification.

Acceptance:

- Landing physics are testable without Phaser.
- Horizontal correction requires tilt plus thrust.
- Safe/bumpy/incident rules are deterministic.
- Failed landing animations can reflect hard drops, skids, tip-overs, and off-pad misses.

### Package D: Landing Scene

Tasks:

- Create `LandingScene`.
- Render moon sky/surface/pad with shapes/placeholders.
- Render ship using idle/thrust frames.
- Add landing HUD.
- Read controls.
- Integrate landing state.
- Handle subtype-specific incident animation and retry.
- Handle soft/bumpy delivery completion.

Acceptance:

- A player can land using only bottom thrust.
- Rough landings are understandable and recoverable.
- Landing does not require full-route replay after incident.

### Package E: Delivery Result Scene

Tasks:

- Create `DeliveryResultScene`.
- Add Tea Moon recipient/item copy.
- Generate result text from package condition and landing result.
- Show memory/reward placeholder.
- Add continue/replay controls.
- Persist save completion.

Acceptance:

- Completing landing reaches result.
- Result tone is warm and accepts imperfect delivery.
- Reload preserves Tea Moon completion.

### Package F: Package Condition And Mission Result Integration

Tasks:

- Carry route package condition into landing.
- Apply condition loss for bumpy landing or landing incident.
- Create `MissionResult` or `DeliveryResult` type.
- Store best result summary in save.
- Add tests for condition/result mapping.

Acceptance:

- Package condition influences result flavor.
- Completion is never blocked by imperfect condition.

### Package G: Polish And Demo Readiness

Tasks:

- Tune route arrival thresholds after landing transition exists.
- Tune landing gravity/thrust/pad width.
- Add simple landing particles.
- Add simple delivery chime placeholder only if audio support already fits browser policy.
- Confirm text fits at target canvas size.
- Disable or hide debug visuals where needed for public demo.

Acceptance:

- Tea Moon can be completed by a new player without external explanation.
- The one-bottom-thruster limitation is visually obvious.
- The loop feels like a complete delivery, not a prototype dead end.

## 10. Test Plan

Add or update tests:

- `tests/arrivalGate.test.ts`
  - ready timer accumulates;
  - timer resets on non-ready;
  - transition threshold works.
- `tests/landing.test.ts`
  - gravity increases downward velocity;
  - upright thrust slows descent;
  - tilted thrust adds horizontal velocity;
  - stabilizer reduces angle/rotation;
  - safe touchdown classification;
  - bumpy touchdown classification;
  - incident touchdown classification;
  - incident subtype classification.
- `tests/missionResult.test.ts`
  - result text/category from condition and landing result;
  - save summary shape.
- Existing tests:
  - keep movement, docking, collision, package condition, math, and save tests passing.

Required validation:

```bash
npm run typecheck
npm test
npm run build
npm run build:pages
```

Manual smoke:

- title starts Tea Moon;
- route flight works;
- arrival gate transitions only after stable ready;
- landing scene loads;
- bottom thruster and tilt are understandable;
- soft and bumpy landings complete delivery;
- landing incident restarts landing, not route;
- result scene appears;
- completion persists after reload.

## 11. Demo Readiness Definition

Phase 2 is demo-ready when:

- Tea Moon can be played from start to result.
- Landing clearly uses one bottom thruster.
- The player can complete delivery without reading docs.
- Incidents are quick and non-punitive.
- Package condition changes result flavor.
- Tea Moon completion persists after reload.
- Build and Pages build pass.
- Result copy avoids shame, grades, diet language, or harsh scoring.

## 12. Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Landing becomes too hard | Use wide pad, strong assist, generous thresholds, and quick retry. |
| Landing feels unrelated to route flight | Keep thrust-direction logic consistent and use arrival gate as a clear transition. |
| Two mechanics overload Tea Moon | Keep landing short, no fuel, no timer, no extra controls. |
| Scene code grows too large | Keep landing physics and classification in pure systems. |
| Package condition feels punitive | Always accept delivery; use condition only for flavor. |
| Result scene blocks momentum | Keep result concise with clear replay/continue actions. |
| Save changes become fragile | Use existing save fields where possible; add tests before changing schema. |

## 13. Expected Files

Likely new files:

- `src/types/mission.ts`
- `src/types/landing.ts`
- `src/data/missions.ts`
- `src/systems/ArrivalGateSystem.ts`
- `src/systems/LandingSystem.ts`
- `src/systems/MissionResultSystem.ts`
- `src/scenes/LandingScene.ts`
- `src/scenes/DeliveryResultScene.ts`
- `tests/arrivalGate.test.ts`
- `tests/landing.test.ts`
- `tests/missionResult.test.ts`

Likely changed files:

- `src/gameConfig.ts`
- `src/scenes/TitleScene.ts`
- `src/scenes/FlightScene.ts`
- `src/data/tuning.ts`
- `src/types/flight.ts`
- `src/systems/SaveSystem.ts`
- `tests/save.test.ts`
- `docs/gameplay-decisions.md` only if playtesting changes a locked decision.

## 14. Recommended Implementation Order

1. Add mission/result/landing types and tuning.
2. Add arrival gate timer and tests.
3. Wire `FlightScene` to transition to placeholder `LandingScene`.
4. Implement pure landing physics and tests.
5. Render landing scene and controls.
6. Implement touchdown classification and retry/delivery transitions.
7. Add result generation and `DeliveryResultScene`.
8. Persist Tea Moon completion and memory reward.
9. Tune landing by manual playtest.
10. Run full validation and prepare Phase 2 demo.

## 15. Handoff To Later Phases

After Phase 2, later phases should be able to reuse:

- mission data shape;
- route-to-landing handoff;
- one-bottom-thruster landing system;
- landing result classification;
- delivery result scene pattern;
- save completion path;
- package condition result flavor.

Phase 3 should harden mission systems so adding Asteroid Bento Belt does not require copying Tea Moon scene internals.
