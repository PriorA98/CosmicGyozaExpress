# Flight Mechanics

Last updated: 2026-05-30 JST

## Purpose

Flight is the broad route-navigation part of the game. It should feel floaty, physical, and funny, but still readable.

The player should learn:

- bottom orientation, thrust, and velocity are different;
- thrust changes velocity away from the ship's bottom thruster;
- braking fights current velocity;
- overshooting is normal;
- recovery is part of the fun.

## Current Model

The current implementation uses:

- custom movement logic in `src/systems/ShipMovementSystem.ts`;
- ship kinematic state in `src/types/flight.ts`;
- tuning in `src/data/tuning.ts`;
- rendering through `src/entities/GyozaShip.ts`;
- route orchestration through `src/scenes/FlightScene.ts`.

The movement model:

- direct rotation;
- thrust along the ship's local up direction, opposite its bottom thruster;
- brake against velocity;
- light damping;
- soft speed cap;
- clamped simulation delta.

Angular inertia is intentionally not part of route flight yet.

## Controls

Keyboard baseline:

- `W` / Up: thrust.
- `S` / Down: brake.
- `A` / Left: rotate left.
- `D` / Right: rotate right.
- `R`: restart current prototype/mission segment.
- `F1` or backtick: debug toggle.

Touch controls are compatibility support, not the primary tuning baseline.

## Route Bounds

Routes are bounded spaces larger than the viewport.

The camera follows the ship. Route bounds should prevent the ship from disappearing into unreachable space, but edge contact should feel like a soft physical boundary, not an arcade wall.

## Obstacles

Phase 1 uses static circular obstacles.

Collision severity:

- soft bump;
- dramatic bump;
- gyoza incident.

The route flight obstacle model is deliberately simple so later routes can add moving obstacles and force zones without rewriting the ship.

## Destination Approach

Flight mode ends near a destination. The current approach model checks:

- distance to destination;
- speed;
- bottom-side alignment.

In Phase 2, a valid approach becomes an arrival gate into the landing scene.

The destination guide marks where the ship's bottom should point. For Tea Moon, that means the player can drift toward the moon while rotating the bottom/thruster side toward the guide, then use thrust in the opposite direction to bleed off speed.

## Dashboard

The flight dashboard should prioritize:

- speed;
- distance;
- bottom-side heading;
- arrival/landing status;
- package condition;
- short dashboard line.

Debug vectors are useful during tuning, but they should be disableable before demo sharing.

## Design Constraints

Do not make route flight a precision race.

Avoid:

- hard timers;
- lives;
- harsh crash penalties;
- narrow tutorial gates;
- scoring language;
- forced perfection.

Route flight should teach the player to approach a destination with enough care to begin landing.
