# One-Bottom-Thruster Landing

Last updated: 2026-05-30 JST

Status: locked Phase 2 landing concept.

## Concept

The gyoza ship has only one thrust source: a small bottom thruster.

Landing should use that goofy limitation as the main mechanic:

> The ship can only push from its bottom, so landing is about keeping the dumpling upright enough that its one stubborn thruster can fight gravity.

This mechanic should feel semi-realistic in the Lunar Lander sense, but short, forgiving, and cozy.

## Why This Is The Right Landing Model

The one-bottom-thruster rule gives the landing sequence a distinct identity:

- It makes the ship's visual design mechanically meaningful.
- It creates comedy from a clear physical limitation.
- It connects to Phase 1 flight because thrust direction still matters.
- It gives deliveries a memorable final ritual.
- It avoids turning delivery into a simple checkpoint touch.

The player is not just landing a spaceship. The player is trying to place a warm dumpling gently onto a moon pad using one questionable burner.

## Scene Flow

Landing starts after the route-flight arrival gate is satisfied.

Recommended flow:

1. Flight scene reaches `ready` arrival state.
2. Player remains ready for `0.4-0.6s`.
3. Camera/scene transitions to the landing screen.
4. Ship appears above the Tea Moon landing pad.
5. Gravity pulls the ship downward.
6. Player tilts and fires the bottom thruster.
7. Ship touches the landing pad.
8. Landing is classified as soft, bumpy, or incident.
9. Delivery completes or landing attempt restarts.

Tea Moon should complete delivery on a valid soft or bumpy landing. A high-severity incident should restart the landing scene quickly, not the whole route.

## Screen Format

Use a separate `LandingScene`.

Recommended presentation:

- side-view or slightly angled 2D view;
- visible moon surface and wide landing pad;
- ship above the pad;
- gravity pulls downward;
- dark cozy sky backdrop;
- compact landing HUD;
- dashboard line remains present but smaller than route-flight HUD.

Do not simulate a full 3D or orbital landing. This is a small 2D descent scene.

## Controls

Keep controls consistent with flight:

- `W` / Up: fire bottom thruster.
- `A` / Left: rotate counterclockwise.
- `D` / Right: rotate clockwise.
- `S` / Down: gentle stabilizer assist for Tea Moon.
- `R`: restart landing attempt.

There are no side thrusters.

Horizontal correction comes from tilting the ship and firing the bottom thruster.

## Physics Model

Landing uses a simple 2D rigid-body-like kinematic model:

- position;
- velocity;
- rotation;
- angular velocity or direct rotation, depending on tuning;
- gravity;
- bottom-thruster acceleration;
- damping/stabilizer assist.

The bottom thruster applies force along the ship's local up direction.

If the ship is upright:

- thrust mostly reduces downward velocity.

If the ship is tilted:

- thrust reduces descent less efficiently;
- thrust also adds horizontal velocity.

If the ship is too tilted:

- the player can create sideways drift and lose vertical control.

This is the central landing tradeoff.

## Tea Moon Assistance

Tea Moon is the tutorial landing. It should be forgiving by default.

Use:

- wide landing pad;
- gentle gravity;
- generous safe vertical speed;
- generous safe horizontal speed;
- broad angle tolerance;
- stabilizer assist on `S`;
- optional automatic mild upright correction when near the pad;
- short retry loop after incidents.

The goal is to teach "tilt plus bottom thrust" without making the player grind.

## Landing States

Use explicit states:

- `intro`: landing scene has just started.
- `descending`: player has control.
- `touching`: ship has contacted surface or pad.
- `settling`: valid landing is being accepted.
- `delivered`: delivery can transition to result.
- `incident`: landing crash/poof and retry.

These states should be a discriminated union in TypeScript.

## Landing Result Classification

Landing should classify touchdown using:

- whether ship touches landing pad;
- vertical speed;
- horizontal speed;
- angle from upright;
- package condition before landing.

Recommended categories:

- `soft`: good landing, best delivery flavor.
- `bumpy`: valid rough landing, accepted with funny flavor.
- `incident`: too fast, too tilted, or off-pad crash.

For Tea Moon:

- `soft` completes delivery.
- `bumpy` completes delivery with minor package condition loss.
- `incident` triggers short retry from landing start or checkpoint.

Landing incidents should classify the shape of the mistake:

- `hard-drop`: vertical impact, squash, dust ring, and thruster cough.
- `skid`: high horizontal drift, surface scrape, dust trail, and spin.
- `tilt-tip`: ship touches down too tilted and tips onto its side.
- `off-pad`: ship sinks into moon dust beside the landing blanket.

Do not fail the whole mission.

## Dashboard Language

Useful readouts:

- vertical speed;
- horizontal drift;
- angle;
- altitude;
- thruster state;
- landing status.

Flavor lines:

- `single-thruster confidence: moderate`
- `dumpling bottom not pointed at problem`
- `please apply soup-facing thrust`
- `technically airborne, emotionally landing`
- `landing blanket engaged`
- `moon pad accepts the snack`

Avoid harsh words such as `failed`, `bad`, `dead`, or `crash penalty` in player-facing text.

## Visual And Audio Direction

Visual priorities:

- one obvious bottom nozzle;
- existing ship thrust frames communicate active firing;
- moon pad has a warm landing glow;
- rough landing gives a soft bounce or poof;
- incident uses dust, steam, squash/skid/tip motion, and the existing gyoza incident frames.

Audio priorities:

- soft thruster puff;
- gentle landing tap;
- rough landing thump;
- delivery chime;
- no loud alarms in Tea Moon.

Placeholders are acceptable in Phase 2.

## Non-Goals

Do not add these for Tea Moon:

- fuel limit;
- hard timer;
- multiple landing pads;
- strict terrain collision;
- complex leg physics;
- destructible ship parts;
- high-score landing ratings;
- side thrusters;
- separate new control scheme.

Later missions may add wind, stronger gravity, moving pads, narrower pads, or gravity interference after Tea Moon proves the model.

## Acceptance Criteria

The landing mechanic works if:

- players understand the ship only thrusts from the bottom;
- tilting to correct horizontal drift feels natural after a few attempts;
- upright thrust visibly slows descent;
- rough landings are funny and accepted or quickly recoverable;
- Tea Moon can be completed without external explanation;
- the landing sequence feels like delivery care, not a punishment test.
