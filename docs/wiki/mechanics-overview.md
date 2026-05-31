# Mechanics Overview

Last updated: 2026-05-30 JST

## System Map

The core game has five gameplay layers:

1. Mission setup.
2. Route flight.
3. Arrival gate.
4. One-bottom-thruster landing.
5. Delivery result.

Each layer should be simple on its own. The charm comes from the sequence, not from any one system becoming large.

## Mission Setup

Mission setup defines:

- route title;
- sender and recipient;
- delivery item;
- request text;
- start position;
- destination;
- landing scene settings;
- obstacles;
- dashboard line pools;
- result reactions;
- save unlocks and reward.

Tea Moon should use a minimal mission schema that can later grow into the full campaign mission schema.

## Route Flight

Route flight is top-down or near-top-down space movement.

The ship:

- accelerates away from its bottom thruster;
- continues drifting when thrust stops;
- rotates directly;
- brakes against current velocity;
- uses a soft speed cap;
- can bump, crash, and respawn.

The goal of route flight is to reach the destination approach zone with enough control to start landing.

## Arrival Gate

The arrival gate is the transition from route flight to landing.

For Tea Moon, it should require:

- ship inside destination zone;
- speed below a generous threshold;
- bottom side within a broad cone;
- short stable ready duration, around `0.4-0.6s`.

When the gate is satisfied, the game transitions to the landing scene. It should not instantly complete the delivery.

Bad arrival attempts:

- block transition;
- explain speed or alignment problem;
- gently bounce the ship away only when it is still too fast;
- avoid package loss unless there is an actual collision or crash.

Alignment problems should let the player keep turning inside the ring, because the intended skill is rotating the ship's bottom toward the landing guide while inertia carries the ship through the approach.

## One-Bottom-Thruster Landing

Landing is a separate short scene inspired by Lunar Lander.

The defining rule is:

> The ship has only one thruster on its bottom. Horizontal correction comes from tilting the entire ship before applying thrust.

This turns the gyoza ship's goofy limitation into the central landing mechanic.

Tea Moon landing should be assisted, forgiving, and short.

## Package Condition

Package condition is internal numeric state plus warm labels.

It may be affected by:

- soft bumps;
- dramatic bumps;
- gyoza incidents;
- rough landing;
- landing retries, if needed.

It must not block mission completion in the main campaign.

## Failure And Recovery

There are no lives and no game over.

Failures should:

- trigger a short incident or bounce;
- reduce package condition when appropriate;
- show a funny dashboard line;
- resume quickly;
- keep the player in the mission.

For landing, a crash should restart the landing attempt, not send the player back through the full route.

## Result

Delivery result should communicate:

- the item was accepted;
- package condition flavor;
- recipient reaction;
- memory/reward;
- next action.

Avoid score pressure. Result language should sound like a delivery report written by a cozy, unreliable spaceship dashboard.
