# Core Gameplay

Last updated: 2026-05-30 JST

## Player Promise

Cosmic Gyoza Express is a small, cozy, physics-based delivery game.

The player promise is:

> Fly a tiny gyoza ship through soft space, wrestle with funny momentum, land with one stubborn bottom thruster, deliver comforting food, and leave the universe slightly warmer.

The game should feel playful before it feels meaningful. The emotional softness comes from repeated acts of care, forgiving failure, warm reactions, and the absurd dignity of a dumpling ship doing its best.

## Core Loop

The full loop is:

1. Receive a short delivery request.
2. Launch into a handcrafted route.
3. Navigate with inertial flight.
4. Bump, recover, and manage package condition.
5. Reach the destination approach zone.
6. Enter the landing sequence.
7. Perform a short assisted one-thruster landing.
8. Deliver the item.
9. See a warm result and NPC reaction.
10. Save mission completion and return to the next route choice.

Phase 1 currently proves steps 3 through 6 at prototype level. Phase 2 should prove steps 1 through 10 for Tea Moon.

## Main Feel

The game is built around three physical feelings:

- Route flight: floaty, inertial, broad, and recoverable.
- Landing: focused, tactile, goofy, and gentle.
- Failure: comedic, quick, and non-blocking.

The player should think about movement, but not feel punished for imperfect execution.

## Route Structure

Routes are handcrafted bounded spaces, not procedural worlds.

Each route has:

- start position;
- destination approach zone;
- route obstacles or environmental forces;
- optional collectibles later;
- landing or docking target;
- recipient and delivery item;
- result text by package condition.

Tea Moon is the tutorial route. It should be the most forgiving version of every major rule.

## Tone Rules

Food is care, not judgment.

Use:

- warmth;
- comfort;
- sharing;
- hospitality;
- funny technical dashboard language;
- imperfect-but-accepted delivery results.

Avoid:

- calories;
- diet language;
- body jokes;
- moralized food categories;
- harsh grades;
- failure language that shames the player.

## Phase Boundaries

### Phase 1: Flight Feel Prototype

Phase 1 proves:

- inertial ship movement;
- route bounds and camera follow;
- destination approach guidance;
- docking readiness checks;
- static obstacles;
- collision severity;
- package condition labels;
- crash/respawn;
- debug vectors and dashboard readouts.

It does not complete missions.

### Phase 2: Tea Moon Vertical Slice

Phase 2 should add:

- mission/route data for Tea Moon;
- mission start flow;
- arrival gate from route flight into landing;
- one-bottom-thruster landing scene;
- delivery completion;
- delivery result scene;
- mission completion save;
- one memory/reward;
- enough UI/audio placeholders to make the loop understandable.

Phase 2 should not add the full galaxy map, multiple routes, final asset pipeline, complex audio, gamepad support, or save export/import.

## Terminology

Use these terms consistently:

- Flight: route navigation in top-down space.
- Approach: the final region near a destination.
- Arrival gate: the valid condition that transfers the player from route flight to landing.
- Landing: the short lunar-lander-style descent sequence.
- Delivery: the accepted handoff after landing.
- Result: the post-delivery scene with condition-based flavor text and reward.

The current `DockingSystem` name is acceptable for Phase 1 internals, but Phase 2 gameplay language should talk about landing and delivery.
