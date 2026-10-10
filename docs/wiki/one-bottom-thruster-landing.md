# Hover Landing

Last updated: 2026-10-10 JST (landing controls v2).

This page replaces the original Phase 2 tilt-and-thrust design. All six deliveries use a short, forgiving hover descent: place the warm dumpling gently on the lit pad, compensate for wind, and match a moving tray.

## Controls

- W / Up: bottom thruster pushes straight up in world space (270 px/s^2).
- A / Left, D / Right: independent side puffers slide left/right (230 px/s^2); usable without W.
- S / Down: steady assist damps horizontal velocity relative to the pad, capped at 55 px/s^2, and levels the ship.
- R / retry chip: restart only the landing attempt.
- Any key/tap skips the arrival intro. Touch tiles read left, right, thrust and steady.

A/D lean the ship toward the push for readability only: maximum 0.28 radians (16 degrees), following and returning at 4 rad/s. Lean does not redirect the main thruster. Horizontal air drag is 0.6 /s; vertical damping is 0.018 /s. Gravity stays authored per landing. Strong wind beats steady alone, but never a full opposing side puff.

## Scene and outcomes

The route arrival gate enters LandingScene, plays the brief arrival intro, then gives control for descent. Soft and bumpy touchdowns settle on the pad before the delivery result; incidents retry the landing quickly. There is no fuel, timer, lives or route replay penalty.

Touchdown checks whether the ship is over the pad and measures vertical speed, horizontal drift relative to the pad (Tea Moon has a stationary pad), and angle:

| Outcome | Vertical speed | Relative horizontal speed | Angle |
|---|---|---|---|
| Soft | <=84 px/s | <=68 px/s | <=22 degrees |
| Bumpy | <=145 px/s | <=122 px/s | <=36 degrees |
| Incident | Any limit exceeded, or off-pad | | |

The angle check remains for compatibility, although ordinary hover lean cannot exceed either angle threshold. Hard-drop, skid, tilt-tip and off-pad incident presentations stay available. Package condition changes on bumpy/incident results; soft landings keep it intact.

## Teaching and presentation

Tea Moon teaches **W lifts, A/D slide, S steadies**. The HUD shows descent, drift, lean, altitude and package condition; phone layouts retain descent/pad/package. Wind indicators show the current force and gust warning. The ship displays a small puff on the side opposite the push; it shares the subtle thrust sound, while S keeps its gentle steady sound and brackets. Failure stays warm and funny, with dust, steam, a bounce and a quick retry.

Campaign landings layer moving trays, altitude-banded mist, oven pull and alternating squalls onto these same controls. Numeric tuning is in `src/data/landingTuning.ts` and typed campaign landing definitions. See [the implementation and verification note](../implementation/phase-4-challenge-redesign.md#9-landing-controls-rework).
