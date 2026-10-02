# Phase 3 Campaign Plan — Cosmic Gyoza Express

Planning date: 2026-10-02  
Status: accepted implementation specification (authored by Codex gpt-6-astra, read-only planning pass; adopted 2026-10-02)  
Target: six handcrafted deliveries, approximately 17–24 minutes on a first playthrough.

This plan preserves the polished Tea Moon slice and builds five deliveries around its existing flight, landing, and package-condition systems. The campaign peaks emotionally at Planet “I’m Fine”; the journey home provides relief and gratitude.

This was a read-only planning pass using the requested source files and targeted hard-coding search. No files changed and no validation commands ran. Proposed interfaces, filenames, showcase states, and CLI flags below are implementation targets, not claims about existing functionality. Builders must read the repository’s required engineering references before implementing.

## 1. Campaign design pillars and difficulty curve

### Design pillars

1. **One new idea per delivery.** Introduce it in a safe space, use it in the route, and echo it during landing. Avoid introducing a separate control skill at the destination.
2. **Difficulty comes from reading the environment.** Keep the established thrust, rotation, braking, landing thresholds, and forgiving arrival gate. Add motion and forces rather than progressively smaller targets.
3. **Everything that affects the ship must announce itself.** Moving rocks show their tracks; currents show arrows; gravity shows rings; gusts show a windsock and a preparation phase. No essential warning depends solely on color or sound.
4. **Recovery preserves the trip.** Flight incidents restore the latest safe checkpoint; landing incidents retry only landing. Neither package condition nor collectibles can block progression.
5. **One ship, one bottom thruster.** Flight rotation remains direct. Landing retains angular momentum and the S stabilizer. Environmental acceleration must never look like a second ship thruster.
6. **A small, authored universe.** Each route has a recognizable silhouette, one recipient, one delivery, and a deliberate emotional purpose. No procedural geography, economies, upgrades, or collectible quotas.
7. **The dashboard translates, not lectures.** One actionable sentence at a time. Live speed, alignment, and landing warnings outrank jokes.
8. **The ending belongs to every player.** Completing deliveries unlocks it. Optional postcards add souvenirs, not a better ending.

Retain the planned order. Steady currents establish external acceleration before radial gravity changes its direction; gusts then vary an already familiar force over time. Moving obstacles introduce observation without also asking the player to counter environmental acceleration.

### Difficulty curve

The “new idea” column is the teaching objective. Collectibles, scenery, and reused interface elements do not receive separate tutorials.

| Level / mission ID | Exactly one new idea | Reused mechanics | Flight challenge | Distinct landing twist | Forgiving assist | Expected first try | “Aha” moment |
|---|---|---|---|---|---|---|---|
| 1. Tea Moon / `tea-moon` | Orient the bottom thruster to control motion | Existing slice | Static rocks and controlled arrival | Existing broad, level lunar pad | Existing brake, stabilizer, upright assist | 3–4 min | “Turning the ship changes where thrust sends me.” |
| 2. Asteroid Bento Belt / `bento-belt` | Read predictable motion | Rotation, brake, static rocks | Two slow crossing rocks; safe outer lane | Pad slides horizontally on a visible rail | Broad pad, slow motion, generous relative-speed thresholds | 3–4 min | “I can aim for where the object is going.” |
| 3. Matcha Nebula Drift / `matcha-nebula` | Account for a steady current | Moving-object observation, braking | One broad current inside decorative fog | Constant, signposted crosswind | Essential markers remain visible; wind is much weaker than thrust | 3–4 min | “My heading and my drift are different.” |
| 4. Black Hole Bakery / `black-hole-bakery` | Gravity pull changes direction with position | Counter-thrust, current reading, moving rocks | Navigate the outer shoulder of one gravity well | Low-gravity station apron | Bounded force, open escape routes, calm arrival pocket | 3–5 min | “The pull follows the bakery’s center; I can steer across it.” |
| 5. Planet “I’m Fine” / `im-fine` | Anticipate a telegraphed change in force | Currents, motion reading, counter-thrust | One intermittent storm band | Gusty descent into a sheltered porch | Two-second warning; wind disappears near the pad | 3–4 min | “The warning gives me time to settle before the gust.” |
| 6. Final Delivery / `home-delivery` | You are allowed to receive care, too | Comfortable flight and landing | Clear route past thank-you beacons | Wide, raised loading berth under a decorative canopy | No active hazard; low gravity and wide pad | 2–3 min | “This package is for me.” |

The final delivery introduces a narrative idea, with no new mechanical demand. This is deliberate: a final control tutorial would undermine the requested homecoming. Its landing twist is spatial and visual—a raised loading berth—using rules the player already knows.

### Common campaign rules

- No lives, fuel limits, mission timers, punitive scoring, or delivery rejection.
- Expected times are design targets and automated-test timeouts, never player deadlines.
- Keep flight thrust `420`, brake `520`, direct rotation `3.7 rad/s`, and soft speed cap `340`.
- Keep arrival requirements at speed `≤70`, bottom-angle error `≤45°`, and stable hold `520 ms`.
- New destinations use radius `150`, approach radius `430`; home uses radius `180`.
- Preserve Tea Moon’s existing radius `132` and every other existing value.
- Keep new flight incidents near the existing `1180 + 240 = 1420 ms` recovery sequence.
- Keep landing incident restart at `1100 ms`; automated ceiling from incident to controllable retry is `2500 ms`.
- S remains available throughout landing. Touch exposes the same action.
- Completed deliveries unlock the next mission regardless of package condition or soft/bumpy outcome.
- An incident is an intermediate failure state, not a delivered outcome.
- One optional postcard per new outward route. No collectible is mandatory.

## 2. Per-level specifications

### Shared specification conventions

Flight positions use world pixels, with positive Y downward. Landing coordinates use the existing `1280×720` scene.

All new flight starts have rotation `Math.PI / 2`, zero velocity, and no environmental force at spawn. Destinations retain the existing `requiredBottomFacingRadians: Math.PI / 2`; do not confuse that value with ship rotation.

Unspecified landing values inherit the existing `landingTuning`:

- Thruster acceleration `270`; rotation acceleration `5.2`.
- Angular damping `1.45`; linear damping `0.018`.
- Stabilizer damping `5.8`, upright strength `3.2`.
- Upright assist below `150 px`, strength `1.1`.
- Ship radius `52`.
- Soft limits: normal speed `84`, tangent speed `68`, angle `22°`.
- Bumpy limits: normal speed `145`, tangent speed `122`, angle `36°`.
- Settle duration `1650 ms`; incident retry `1100 ms`.
- Landing start `(640,150)`, rotation `0`, downward speed `22`.

“Normal” and “tangent” mean relative to the pad; for today’s stationary horizontal pad they equal the existing vertical and horizontal measurements.

Each new outward mission has one silent checkpoint activation strip after its main mechanic. Crossing it records a fixed safe respawn position and shows “Route remembered.” Checkpoints are not additional objectives. Their spawn points must remain clear of every moving obstacle’s complete trajectory.

Copy modules must provide all seven `PackageConditionLabel` keys. To keep authoring lean, the three result lines given per mission map as follows:

- **Careful:** `Perfect`, `Slightly shaken`.
- **Tumbled:** `Emotionally rotated`, `Warm but confused`, `Still delicious`.
- **Rearranged:** `Dramatically rearranged`, `Basically fine`.

Expand these into an exhaustive typed record. Landing lines remain separately authored.

### Level 2 — Asteroid Bento Belt

**Identity**

- Mission: `bento-belt`
- Route: `bento-belt-route`
- Recipient: **Mallow, the lunch-break mechanic**
- Item: **a three-tier asteroid bento**
- Memory: `memory-bento-belt-postcard`
- Unlock: `matcha-nebula`
- Request: “The lunch platform keeps drifting away from my chair. Could you bring lunch to whichever one arrives first?”

Mallow works among gently moving maintenance platforms. The destination’s sliding lunch dock repeats the route’s lesson about predictable motion.

**Route**

World: `3600×1800`.

```text
                  optional postcard
                         *
start → moving crossing → open rest pocket → moving crossing → dock
          \________________ broad lower bypass ______________/
```

| Element | Definition |
|---|---|
| Start | `(320,900)` |
| Destination | `(3260,900)`, radius `150` |
| Static group A | `(800,600,r70)`, `(920,1130,r64)` |
| Moving crossing A | Radius `68`; ping-pong `(1300,650)` ↔ `(1300,1150)`; period `26000 ms` |
| Moving crossing B | Radius `76`; ping-pong `(2080,850)` ↔ `(2440,850)`; period `24000 ms` |
| Optional orbital rock | Radius `56`; center `(2500,560)`, orbit radius `130`, period `22000 ms` |
| Static group B | `(2740,650,r62)` |
| Postcard | `postcard-bento`, `(1800,480)`, pickup radius `36` |
| Rest pocket | Center `(1760,1000)`, clear radius `250` |
| Checkpoint activation | Rectangle `(2780,0,240,1800)` |
| Checkpoint respawn | `(2860,1380)` |
| Calm arrival area | No obstacle path or force within `460 px` of destination |

Ping-pong motion uses cosine easing, not instantaneous reversal. Maximum speeds are approximately `60 px/s` and `47 px/s`. Thin dashed tracks and endpoint bulbs make the complete motion readable before interception.

Authored safe pilot waypoints: `(720,1400)`, `(1500,1420)`, `(2450,1420)`, `(2860,1300)`, destination. They deliberately use the lower bypass. Separate phase-sweep tests exercise direct crossings.

**Landing**

- Pad width `360`, center `(640,612)`.
- Horizontal travel amplitude `64 px`, period `12000 ms`.
- Start phase at the left endpoint; maximum pad speed approximately `34 px/s`.
- Gravity `138`; all classification limits unchanged.
- Rail extends from X `576` to `704`; endpoint bulbs stay visible.
- Classify horizontal speed relative to the moving pad.
- Once accepted, the ship rides the pad during settling.

**Dashboard**

- Approach: “Those rocks follow tracks. Watch one pass, then choose your gap.”
- Bypass: “The long way still arrives at lunch.”
- Landing: “Match the platform’s drift. The rail shows where it goes.”
- Bump: “The bento has requested a seating chart.”

**Result copy**

- Careful: “Every compartment is still enjoying its own lunch.”
- Tumbled: “The side dishes have introduced themselves.”
- Rearranged: “Mallow calls it a sharing platter and means it.”
- Soft landing: “Lunch arrived in step.”
- Bumpy landing: “A little platform percussion. Lunch is welcome.”

**Showcases**

`bento-moving`, `bento-postcard`, `bento-landing`, `bento-result`.

**Acceptance**

- Both direct crossing and bypass are traversable without waiting for a narrow timing window.
- At least one moving rock is visible with its track before reaching collision distance.
- Pad position, rendered rail, collision geometry, and reported velocity agree.
- Generic pilot completes the safe route at four starting motion phases.
- Soft and bumpy landings remain reachable while the pad moves.

### Level 3 — Matcha Nebula Drift

**Identity**

- Mission: `matcha-nebula`
- Route: `matcha-nebula-route`
- Recipient: **Nori, the listening-post moth**
- Item: **a warm matcha flask**
- Memory: `memory-matcha-nebula-postcard`
- Unlock: `black-hole-bakery`
- Request: “The fog is louder than usual. Could you bring something warm enough to hold?”

Fog provides atmosphere, not a second navigation mechanic. The lesson is steady current compensation; the existing destination indicator remains the reliable reference.

**Route**

World: `3800×2000`.

```text
start → clear current preview → matcha fog/current → clear approach → lantern dock
                                  ↓ steady drift
                         optional postcard above the flow
```

| Element | Definition |
|---|---|
| Start | `(320,1120)` |
| Destination | `(3440,820)`, radius `150` |
| Current | Rectangle `(1000,500,1600,1000)`; acceleration `(0,38)` |
| Force edge blend | `160 px` inward from rectangle edges |
| Fog | Rectangle `(760,340,2100,1320)`; maximum opacity `0.32` |
| Static rocks | `(1200,1430,r72)`, `(2180,600,r66)` |
| Reused moving rock | Radius `58`; orbit center `(2820,1360)`, radius `90`, period `28000 ms` |
| Postcard | `postcard-matcha`, `(1900,800)`, radius `36` |
| Checkpoint activation | Rectangle `(2880,0,200,2000)` |
| Checkpoint respawn | `(2940,820)` |
| Calm arrival area | Current ends at X `2600`; destination approach begins at X `3010` |

Pilot waypoints: `(850,1120)`, `(1400,1050)`, `(2200,1000)`, `(2940,820)`, destination. The pilot must compensate through the current instead of bypassing it.

Fog sits behind obstacles, warning tracks, the ship, collectibles, and destination indicators. Avoid a visibility radius, opaque cloud walls, or hidden rocks. No shader or dynamically redrawn mask is required.

**Landing**

- Fixed pad width `340`, center `(640,612)`.
- Gravity `138`.
- Constant horizontal wind acceleration `(14,0)`.
- A windsock is visible before descent begins.
- All outcome thresholds unchanged.
- No additional passive lateral correction. Tilting and firing the existing thruster counters wind.

**Dashboard**

- Entry: “The wisps show the current. Your drift arrow shows what it’s doing.”
- In current: “Point a little against the flow, then check your drift.”
- Landing: “Wind from the left. A small lean left will help.”
- Safe approach: “Clear air. The kettle has stopped navigating.”

**Result copy**

- Careful: “The matcha arrives with its little cloud intact.”
- Tumbled: “Nori says the extra foam looks thoughtful.”
- Rearranged: “Two hands around a warm flask. Nothing else needs explaining.”
- Soft landing: “A quiet arrival through the mist.”
- Bumpy landing: “The porch rattled. The welcome did not.”

**Showcases**

`matcha-current`, `matcha-fog`, `matcha-landing`, `matcha-result`.

**Acceptance**

- Essential objects retain readable silhouettes throughout maximum fog.
- Dashboard reports current direction without covering docking or danger messages.
- Pure integration produces repeatable drift under constant force.
- Pilot completes through the authored current using feedback.
- Landing gauges classify actual wind-driven velocity correctly.
- Reduced motion removes decorative fog drift without removing current cues.

### Level 4 — Black Hole Bakery

**Identity**

- Mission: `black-hole-bakery`
- Route: `black-hole-bakery-route`
- Recipient: **Pip, the very small baker**
- Item: **a jar of patient sourdough starter**
- Memory: `memory-black-hole-bakery-postcard`
- Unlock: `im-fine`
- Request: “Everything is being drawn toward the oven, including me. Please bring the starter around the outside.”

The bakery uses a whimsical, bounded gravity well. There is no event horizon, capture state, or instant-failure center.

**Route**

World: `4000×2200`.

```text
                    postcard
                       *
start → outer gravity shoulder → calm checkpoint → bakery
                  ↘   well   ↙
                   open center
```

| Element | Definition |
|---|---|
| Start | `(320,1500)` |
| Destination | `(3600,780)`, radius `150` |
| Gravity well | Center `(2100,1140)`, radius `900` |
| Peak acceleration | `70 px/s²` |
| Core softening radius | `180 px` |
| Outer edge blend | `140 px` |
| Static rocks | `(1050,1350,r72)`, `(1880,1670,r90)`, `(2830,1310,r70)` |
| Moving rock | Radius `60`; orbit center `(2100,1140)`, radius `490`, period `44000 ms` |
| Postcard | `postcard-bakery`, `(2110,400)`, radius `36` |
| Checkpoint activation | Rectangle `(3120,0,180,2200)` |
| Checkpoint respawn | `(3200,780)` |

Pilot waypoints: `(900,1100)`, `(1350,650)`, `(2110,400)`, `(2750,530)`, `(3200,780)`, destination.

Use three broad rings and inward arrow segments. The center is non-colliding scenery. At the exact center, force is zero; nearby force remains finite. This is authored game gravity, not inverse-square simulation.

The destination is outside the well. Arrival must never require holding against the strongest pull.

**Landing**

- Fixed pad width `340`, center `(640,612)`.
- Gravity `92`, thruster `270`.
- Start downward speed `14`.
- All safe/bumpy thresholds unchanged.
- Landing background shows the bakery on a quiet station apron, with floating flour specks indicating weak gravity.
- Keep the pad level. A rotating or tilted pad would add a second lesson here.

**Dashboard**

- Entry: “The rings point toward the pull. Steer across them.”
- Strong influence: “A little counter-thrust keeps the oven at a polite distance.”
- Landing: “Light gravity here. Short puffs go a long way.”
- Recovery: “The starter is still rising. Mostly emotionally.”

**Result copy**

- Careful: “The starter has arrived with excellent patience.”
- Tumbled: “Pip says a well-traveled starter has character.”
- Rearranged: “The jar is warm. The bakery already smells like tomorrow.”
- Soft landing: “A flour-soft arrival.”
- Bumpy landing: “A small thump, followed by fresh bread.”

**Showcases**

`bakery-gravity`, `bakery-center-safe`, `bakery-landing`, `bakery-result`.

**Acceptance**

- Force is finite and continuous through the soft core and outer blend.
- Full thrust can escape from every sampled point in the well.
- Brake remains useful because environmental acceleration stays well below `520`.
- No radial-center collision, hidden damage, or forced orbit exists.
- Pilot completes the outer route and a dedicated inner-well escape scenario.
- Low-gravity landing remains controllable without changing stabilizer semantics.

### Level 5 — Planet “I’m Fine”

**Identity**

- Mission: `im-fine`
- Route: `im-fine-route`
- Recipient: **Iona, the keeper of one lit window**
- Item: **soup and an extra spoon**
- Memory: `memory-im-fine-postcard`
- Unlock: `home-delivery`
- Request: “I’m fine. If you happen to pass, you could leave something by the door.”

The recipient is not a joke. The ship and dashboard may be gently funny; Iona’s acceptance is direct and unembarrassed.

**Route**

World: `3600×2000`.

```text
start → visible storm warning → gust band → clear porch approach → lit window
                                 ↑
                         broad lower refuge
```

| Element | Definition |
|---|---|
| Start | `(320,1100)` |
| Destination | `(3260,960)`, radius `150` |
| Gust band | Rectangle `(950,500,1750,1100)` |
| Peak acceleration | `(0,-58)` |
| Edge blend | `140 px` |
| Cycle | `10000 ms`: warning `2000`, attack `800`, sustain `2000`, release `1200`, calm `4000` |
| Initial phase | Start of warning |
| Static rocks | `(1240,620,r70)`, `(2260,1460,r82)` |
| Reused moving rock | Radius `56`; ping-pong `(1950,620)` ↔ `(2270,620)`, period `24000 ms` |
| Postcard | `postcard-im-fine`, `(1770,1160)`, radius `36` |
| Refuge | Lower lane around Y `1780`, outside the gust band |
| Checkpoint activation | Rectangle `(2880,0,180,2000)` |
| Checkpoint respawn | `(2960,960)` |

Pilot waypoints: `(820,1100)`, `(1550,1130)`, `(2400,1050)`, `(2960,960)`, destination.

The warning combines a windsock beginning to lift, brighter arrow outlines, and “Gust gathering.” It must work without animated flashing or audio. The gust never reverses direction during a cycle.

**Landing**

- Fixed porch pad width `360`, center `(640,612)`.
- Gravity `138`.
- Horizontal gust peak `(26,0)`, with the same cycle structure.
- Landing clock starts with a full warning period.
- Shelter multiplier: `clamp((altitude - 100) / 80, 0, 1)`.
- Full gust above `180 px`; progressively sheltered below that; no wind in the last `100 px`.
- An awning, windbreak posts, and a calm lower windsock explain shelter.
- Thresholds and stabilizer unchanged.

**Dashboard**

- Warning: “Gust gathering. You have a moment to settle.”
- Active: “Lean gently into it. There is room.”
- Shelter: “The porch blocks the wind. Take your time.”
- After touchdown: “Someone left the light on.”

Allow silence after that last line. Do not immediately replace it with a joke.

**Result copy**

- Careful: “Iona opens the door before you knock.”
- Tumbled: “The soup has traveled. Someone is glad it did.”
- Rearranged: “‘You came,’ Iona says. The bowl arrangement does not come up.”
- Soft landing: “A quiet arrival at the lit window.”
- Bumpy landing: “The porch creaked. Iona brought another chair.”

Recipient closing line: “I said I was fine. I’m glad you came anyway.”

**Showcases**

`im-fine-warning`, `im-fine-gust`, `im-fine-shelter`, `im-fine-result`.

**Acceptance**

- Every active gust is preceded by the complete warning.
- Force and visible windsock use the same sampled phase.
- A player can remain in the route indefinitely; cycles do not create deadlines.
- Pilot completes at warning, attack, sustain, and calm starting phases.
- Landing wind reaches zero before touchdown.
- Touch controls remain unobstructed by the porch and result copy.

### Level 6 — Final Delivery: Package for the Gyoza Ship

**Identity**

- Mission: `home-delivery`
- Route: `home-delivery-route`
- Recipient: **You**
- Item: **a parcel with your name on it**
- Memory: `memory-home-delivery-postcard`
- Unlocks: none
- Request: “One last package. The address looks familiar.”

The ship returns to a familiar home dock. Thank-you messages refer to completed deliveries, never collectible ownership or package quality.

**Route**

World: `2600×1600`.

| Element | Definition |
|---|---|
| Start | `(320,900)` |
| Destination | `(2250,780)`, radius `180` |
| Thank-you beacons | `(760,900)`, `(1230,780)`, `(1710,840)` |
| Obstacles | None |
| Force zones | None |
| Optional pickups | None |
| Pilot waypoints | `(850,900)`, `(1500,820)`, destination |
| Checkpoint | Start is sufficient; no authored hazards |

Beacon messages appear on proximity without stopping the ship:

1. “The kettle is on whenever you need it.”
2. “We saved you a seat.”
3. “Come hungry. Come as you are.”

No additional collectible or interaction tutorial.

**Landing**

- Raised berth center `(640,540)`, width `480`.
- Gravity `110`; start `(640,140)`, downward speed `16`.
- Same thrust, stabilizer, and outcome thresholds.
- Decorative canopy at Y `300`, spanning X `120..380`; no collision and no overlap with the main descent lane.
- Pad edges and underside visibly communicate its elevated surface.
- No moving hazards or wind.

**Dashboard**

- Route: “Destination confirmed. Oh. It’s us.”
- Landing: “Home has left the wide berth open.”
- After the emotional beat: “Contents: snacks, gratitude, one unreasonable amount of ribbon.”

**Result copy**

- Careful: “For the one who kept showing up.”
- Tumbled: “For the one who kept showing up, even sideways.”
- Rearranged: “The parcel was never expecting a perfect journey.”
- Soft landing: “Home, gently.”
- Bumpy landing: “Home, with a familiar little thump.”

Closing text: “You brought warmth to a small corner of the universe. There is some here for you, too.”

**Showcases**

`home-notes`, `home-landing`, `home-ending`.

**Acceptance**

- Complete without collecting any optional item.
- Missing postcards do not alter the ending’s warmth or completeness.
- `endingSeen` updates only after the ending is actually displayed.
- Replay remains available afterward.
- Soft and deliberately bumpy arrivals both reach the same ending.
- No auto-advance timer interrupts reading.

## 3. New mechanics engineering design

### Domain types

Add shared contracts under `src/types/`; only the integrator owns these files.

```ts
type Vector2 = Readonly<{ x: number; y: number }>;

type ZoneShape =
  | Readonly<{
      kind: "circle";
      center: Point;
      radius: number;
    }>
  | Readonly<{
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }>;

type GustCycle = Readonly<{
  warningMs: number;
  attackMs: number;
  sustainMs: number;
  releaseMs: number;
  calmMs: number;
  phaseOffsetMs: number;
}>;

type ForceZoneDefinition =
  | Readonly<{
      kind: "radial-gravity";
      id: string;
      center: Point;
      radius: number;
      coreRadius: number;
      peakAcceleration: number;
      edgeBlendPx: number;
    }>
  | Readonly<{
      kind: "directional-current";
      id: string;
      area: ZoneShape;
      acceleration: Vector2;
      edgeBlendPx: number;
    }>
  | Readonly<{
      kind: "gust";
      id: string;
      area: ZoneShape;
      peakAcceleration: Vector2;
      edgeBlendPx: number;
      cycle: GustCycle;
      telegraph: "windsock-and-arrows";
    }>;

type MotionPathDefinition =
  | Readonly<{
      kind: "ping-pong";
      from: Point;
      to: Point;
      periodMs: number;
      phaseOffsetMs: number;
    }>
  | Readonly<{
      kind: "orbit";
      center: Point;
      radiusX: number;
      radiusY: number;
      periodMs: number;
      phaseRadians: number;
      clockwise: boolean;
    }>;

type MovingObstacleDefinition = Readonly<{
  id: string;
  label: string;
  radius: number;
  textureKey: string;
  path: MotionPathDefinition;
}>;

type CollectibleDefinition = Readonly<{
  id: string;
  kind: "postcard" | "star-crumb";
  position: Point;
  radius: number;
  memoryId: string;
  textureKey: string;
  frame: number;
}>;

type VisibilityDefinition =
  | Readonly<{ kind: "clear" }>
  | Readonly<{
      kind: "fog";
      area: ZoneShape;
      textureKey: string;
      maxAlpha: number;
      driftPixelsPerSecond: Vector2;
    }>;
```

Ship only postcards in this campaign. `star-crumb` is a supported visual variant, not another currency or progression system.

Landing configuration:

```ts
type PadMotionDefinition =
  | Readonly<{ kind: "fixed" }>
  | Readonly<{ kind: "path"; path: MotionPathDefinition }>;

type LandingWindDefinition =
  | Readonly<{ kind: "none" }>
  | Readonly<{
      kind: "steady";
      acceleration: Vector2;
    }>
  | Readonly<{
      kind: "gust";
      peakAcceleration: Vector2;
      cycle: GustCycle;
      shelter: Readonly<{
        calmBelowAltitude: number;
        fullyExposedAltitude: number;
      }> | null;
    }>;

type LandingDefinition = Readonly<{
  id: string;
  tuning: LandingTuning;
  pad: LandingPadDefinition;
  padMotion: PadMotionDefinition;
  surfaceTiltRadians: number;
  wind: LandingWindDefinition;
  collisionModel: "legacy-horizontal" | "relative-pad";
}>;
```

All shipped surfaces have tilt `0`. Support constant tilt in the mathematical pad sampler and its tests so the contract is coherent; do not build rocking-station content or animated surface rotation in this phase.

### Pure systems and signatures

| File | Exports / responsibility |
|---|---|
| `src/systems/ForceFieldSystem.ts` | `sampleForceZone(zone, position, timeMs): ForceSample`; `sampleForceField(zones, position, timeMs, maxAcceleration): ForceFieldSample` |
| `src/systems/MotionPathSystem.ts` | `sampleMotionPath(path, timeMs): MotionSample`, returning position and analytical velocity |
| `src/systems/MovingObstacleSystem.ts` | `sampleMovingObstacles(definitions, timeMs): readonly MovingObstacleState[]` |
| `src/systems/CollectibleSystem.ts` | `collectAlongSegment(previous, current, definitions, collectedIds): CollectionResult` |
| `src/systems/LandingEnvironmentSystem.ts` | `sampleLandingPad(definition, timeMs): LandingPadSample`; `sampleLandingEnvironment(definition, state, timeMs): LandingEnvironmentSample` |
| `src/systems/LandingContactSystem.ts` | `measurePadRelativeTouchdown(state, pad, tuning): LandingTouchdownMetrics`; `findLandingContact(previous, current, previousPad, currentPad, tuning): LandingContact` |
| `src/systems/CampaignSystem.ts` | Mission resolution, next unlocks, board states, completion normalization |

Use explicit exported parameter and return types. No Phaser imports, browser APIs, random numbers, wall-clock reads, or mutable singleton clocks in these systems.

`ForceSample` includes acceleration plus the sampled cue state: `calm`, `warning`, `attack`, `sustain`, or `release`. Renderers and physics consume the same sample. Warning produces zero gust acceleration.

### Force math

For a radial well at distance `d`:

```text
magnitude =
  peakAcceleration
  × clamp(d / coreRadius, 0, 1)
  × smoothstep(0, edgeBlendPx, radius - d)

acceleration = normalized(center - position) × magnitude
```

Return zero outside the radius and at its exact center. There is no singularity.

For rectangles, multiply acceleration by a smoothstep of the nearest interior-edge distance. Outside the shape, return zero. Sum overlapping fields and cap the vector magnitude at `110 px/s²` for campaign flight.

The gust envelope is zero during warning/calm, rises with smoothstep during attack, stays at one during sustain, and falls with smoothstep during release.

### Motion math

For ping-pong paths:

```text
u = 0.5 - 0.5 × cos(2π × phase)
position = from + (to - from) × u
```

Derive velocity analytically. Orbit motion uses sine/cosine with the declared direction and elliptical radii. The same elapsed time must produce identical samples regardless of prior frame history.

Do not drive physical obstacles with Phaser tweens. Tweens may decorate them, but cannot own collision position.

### Movement integration

Extend `integrateShipMovement` with an optional final environmental input:

```ts
integrateShipMovement(
  state,
  controls,
  deltaSeconds,
  tuning,
  environment?: Readonly<{ acceleration: Vector2 }>,
): ShipKinematicState;
```

With no environment, preserve the current arithmetic order exactly. For new missions, add external acceleration after thrust and before brake, damping, and overspeed handling. That keeps the strong brake effective against currents.

Extend landing similarly with sampled acceleration and pad geometry. Keep gravity in the landing tuning; environmental acceleration contains wind only. Avoid adding gravity twice.

For Tea Moon, call the legacy path with no environment argument. Retain `createTeaMoonLandingPad` as a compatibility wrapper until all existing callers and tests are safely migrated.

New missions should advance simulation in bounded substeps of at most `1/120 s`, consuming at most `50 ms` of foreground frame time. Environmental motion and force clocks advance by those same consumed steps. Pause all gameplay clocks while hidden or paused; do not fast-forward storms after tab restoration. Do not change Tea Moon’s stepping in this refactor.

### Moving collisions and landing contact

Moving-rock impacts must use relative ship/rock velocity, including for severity. Resolve against the rock’s sampled normal and avoid repeated damage while separating. Sweep relative segments where necessary to prevent tunneling.

For new pad contact:

- Measure position along the pad tangent.
- Measure altitude along its upward normal.
- Subtract pad velocity before calculating touchdown speed.
- Measure ship rotation relative to the surface normal.
- Detect crossing of the contact plane between simulation samples.
- Store accepted tangent offset; during settling, reconstruct ship position from the sampled pad and that offset.

For a fixed horizontal surface, calculations should agree with existing classification. Tea Moon retains its legacy contact path, including its current center-based pad-width acceptance.

Update new-mission gauges from the same relative metrics used for classification. A green drift gauge cannot use world speed while collision uses pad-relative speed.

### Essential tests

- Zero-field identity against existing ship integration.
- Radial center, boundary, inward direction, overlap cap, and finite outputs.
- Gust phase boundaries, warning lead time, continuity, pause/resume behavior.
- Motion periodicity, endpoint velocities, analytical velocity checks.
- Moving collision severity in the obstacle’s frame.
- Pad-relative soft/bumpy/incident thresholds and moving-pad settling.
- Constant tilted-pad geometry, even though campaign content uses zero tilt.
- Swept collectible pickup, repeat pickup suppression, retry retention.
- Invalid authored values: nonpositive periods, inverted shelter heights, invalid radii, nonfinite values.

## 4. Generalization refactor plan

### MissionDefinition v2

“V2” describes authored mission contracts; it does not require a save-version bump.

```ts
type MissionId =
  | "tea-moon"
  | "bento-belt"
  | "matcha-nebula"
  | "black-hole-bakery"
  | "im-fine"
  | "home-delivery";

type MissionDefinition = Readonly<{
  id: MissionId;
  title: string;
  senderId: string;
  routeId: RouteId;
  landingId: LandingId;
  themeId: ThemeId;
  sceneryId: SceneryId;

  recipientName: string;
  deliveryItemName: string;
  requestText: string;
  memoryRewardId: string;

  resultLines: Readonly<Record<PackageConditionLabel, string>>;
  landingLines: Readonly<Record<LandingResultKind, string>>;
  dashboardCopyId: DashboardCopyId;

  unlocksMissionIds: readonly MissionId[];
  pilotHints: MissionPilotHints;
}>;
```

Use typed IDs to resolve route, landing, theme, scenery, and copy modules. Do not duplicate route objects inside both missions and registries.

`FlightRouteDefinition` replaces `FlightPrototypeRoute` and adds:

- `movingObstacles`
- `forceZones`
- `collectibles`
- `visibility`
- `checkpoints`
- destination camera framing and handoff focus
- explicit scenery references

All empty mechanics use empty arrays or a `kind: "clear"`/`"none"` variant. Avoid scattered optional-property checks in scene update loops.

Keep the existing Tea Moon route ID `phase-1-tea-moon-test-route` as a valid registry entry. Renaming a source file does not justify changing runtime identifiers.

### Proposed content layout

```text
src/data/routes/index.ts
src/data/routes/teaMoonRoute.ts
src/data/campaign/bentoBelt.ts
src/data/campaign/matchaNebula.ts
src/data/campaign/blackHoleBakery.ts
src/data/campaign/imFine.ts
src/data/campaign/homeDelivery.ts
src/data/campaign/teaMoonAdapter.ts
src/data/campaign/pilotDefaults.ts
```

Each campaign module exports its mission content, route, landing, theme, scenery, and pilot hints as typed constants. Integrator-owned registries assemble them.

Keep `src/data/flightPrototypeRoute.ts` temporarily as a re-export. Likewise retain existing tuning exports so legacy tests and fixtures continue compiling.

### Scene and entity changes

- **FlightScene:** resolve the mission once during initialization; use its route, scenery, camera framing, force samples, obstacle samples, and hints.
- **LandingScene:** resolve `LandingDefinition`; pass tuning into every calculation and visual aid. Remove direct global reads from new-mission behavior.
- **DeliveryResultScene:** render the resolved recipient, destination vignette, item, copy, memory, and next unlocked route. Its existing Tea Moon moon-art path becomes a theme adapter.
- **TitleScene:** derive campaign status instead of `teaMoonDelivered`; retain current first-delivery presentation where appropriate.
- **TeaMoon entity:** preserve unchanged behind the Tea Moon scenery adapter. Add `DestinationScenery` for new destinations rather than forcing the elaborate old moon through a generic renderer immediately.
- **LandingAids:** accept resolved tuning and pad-relative readings. The search showed that its gauge thresholds currently import `landingTuning`; changing only LandingScene would leave incorrect gauges.
- **Camera tuning:** move new missions’ framing points into route data. Preserve Tea Moon’s current `(2640,850)` framing point and all blending constants.

Keep gameplay rules out of scenery factories and scenes. Scene-specific presentation exceptions belong in named adapters, not mission-ID checks scattered across update methods.

### Loadable implementation order

1. Record the Tea Moon baseline: tests, captures, event order, scripted kinematic samples, and playtest report.
2. Introduce types and registries containing only Tea Moon.
3. Add compatibility re-exports and a Tea Moon adapter with identical values.
4. Generalize scene resolution while leaving the Tea Moon rendering and integration paths intact.
5. Inject landing tuning into entities and gauges; compare Tea Moon again.
6. Add empty-mechanic defaults and generic destination rendering.
7. Add the first complete new mission behind a development launch option.
8. Register remaining missions after their data-contract tests pass.
9. Enable the delivery board and progression.
10. Remove compatibility wrappers only in a separately validated cleanup, if useful.

“Byte-for-byte the same” means existing Tea Moon authored numbers, copy, IDs, deterministic outputs, and capture pixels remain identical under the same capture environment. It does not mean transpiled JavaScript must have identical bytes.

Existing tests, existing Tea Moon showcase captures, and the existing unqualified playtest command must still pass. New map navigation may change the title’s primary destination, but the original Tea Moon showcase fixtures must retain their original presentation.

## 5. Mission select and save integration

### Delivery board

Add `src/scenes/MissionSelectScene.ts`: a small illustrated delivery board with six fixed nodes, not a navigable galaxy.

At `1280×720`, use two rows:

```text
Tea Moon → Bento Belt → Matcha Nebula
                              ↓
Home     ← I’m Fine   ← Black Hole Bakery
```

Suggested node centers: top `(280,220)`, `(640,220)`, `(1000,220)`; bottom `(280,430)`, `(640,430)`, `(1000,430)`.

Node states:

- **Locked:** dim illustration, lock symbol, “After [previous delivery].”
- **Available:** warm outline, recipient and item.
- **Completed:** small delivered stamp; selection offers replay.

A bottom detail panel contains request text and one launch button. Keyboard arrows move selection; Enter launches; Escape returns. Touch targets must measure at least `44 CSS px` on tested phone landscape layouts. Use the existing compact layout helpers; do not merely shrink desktop text.

No rank badges, completion percentages, collectible counters, or score leaderboards.

### Flow

- Fresh save: Title’s primary action launches Tea Moon; secondary “Delivery board” may preview the route.
- After first completion: Title’s primary action opens the board with the next unlocked mission selected.
- Result actions: “Next delivery,” “Delivery board,” and “Fly again.”
- Final result: “Read the notes again,” “Delivery board,” and “Fly home again.”
- Existing route log remains a secondary history view, not a competing campaign selector.

### Save normalization

Keep `SaveDataV1` and the storage key `cosmic-gyoza-express.save.v1`. Existing arrays and result records already accommodate campaign IDs.

Add a pure campaign normalization step inside the existing save boundary:

1. Validate current schema fields before campaign interpretation.
2. Deduplicate and allowlist known mission IDs.
3. Always unlock `tea-moon`.
4. Ensure every completed mission is itself unlocked.
5. Add each completed mission’s declared immediate unlocks.
6. Preserve valid explicit unlocks; do not infer completion of skipped missions.
7. Validate known result entries: finite nonnegative duration/crashes, valid date, recognized condition label.
8. Filter memory IDs against authored delivery memories and optional postcard IDs.
9. Preserve settings, existing statistics, backup behavior, and session-only recovery.

An existing Tea Moon completion therefore unlocks Bento Belt on load. Loading must not increment deliveries or fabricate results.

Store optional postcards in `collectedMemories` using distinct IDs such as `collectible-bento-postcard`; do not reuse mission reward IDs. Pickup updates the session save immediately and attempts persistence through the existing guarded boundary. Retries retain collected IDs.

Result-scene completion must be committed once per attempt. Recreating a scene or double-tapping a button cannot increment statistics twice. Replays may increment lifetime delivery totals once, while unlock and memory grants remain idempotent.

Preserve the current “best result” policy until its implementation is inspected. If it needs expansion, use package condition and crashes; never make shorter duration a player-facing achievement.

Unknown/future save versions retain the existing protection against overwrite. Storage failures keep the entire campaign playable in memory.

### Development fixtures

Integrator-owned fixtures:

- `campaign-fresh`
- `campaign-after-tea`
- `campaign-all-unlocked`
- `campaign-all-complete`
- `campaign-storage-unavailable`

`campaign-all-unlocked` sets all unlocks without pretending missions were completed. Fixtures use an isolated browser context/session store and must not overwrite a real player save.

New board captures: `board-fresh`, `board-progress`, `board-complete`, `board-phone`.

## 6. Art strategy

### Stage A — final contracts, placeholder art now

Use simple checked-in PNG placeholders at the final production paths. This avoids changing loader semantics or treating intentionally missing art as successful production loading.

Every manifest entry declares final dimensions, frame layout, anchor, and integer art scale. Final art replaces PNG bytes at the same path and key.

New assets live under `public/assets/campaign/`. All dimensions below are **art pixels**, displayed at `2×`. Sheets are horizontal strips; listed dimensions are per frame.

| Final asset key | Frame size | Frames | Anchor | Transparency / use |
|---|---:|---:|---|---|
| `campaign-destination-bento` | `160×160` | 1 | `(0.5,0.5)` | Transparent; route/result station vignette |
| `campaign-destination-matcha` | `160×160` | 1 | `(0.5,0.5)` | Transparent; lantern listening post |
| `campaign-destination-bakery` | `160×160` | 1 | `(0.5,0.5)` | Transparent; bakery station |
| `campaign-destination-im-fine` | `160×160` | 1 | `(0.5,0.5)` | Transparent; storm planet/window |
| `campaign-destination-home` | `160×160` | 1 | `(0.5,0.5)` | Transparent; home station |
| `campaign-portrait-mallow` | `48×48` | 2 | `(0.5,1)` | Transparent; idle/welcome |
| `campaign-portrait-nori` | `48×48` | 2 | `(0.5,1)` | Transparent; idle/welcome |
| `campaign-portrait-pip` | `48×48` | 2 | `(0.5,1)` | Transparent; idle/welcome |
| `campaign-portrait-iona` | `48×48` | 2 | `(0.5,1)` | Transparent; reserved/welcome |
| `campaign-cargo` | `32×32` | 5 | `(0.5,0.5)` | Transparent; bento, flask, jar, soup, parcel |
| `campaign-postcards` | `48×32` | 5 | `(0.5,0.5)` | Transparent border; one image per new delivery |
| `campaign-flow-arrow` | `24×16` | 1 | `(0.5,0.5)` | Transparent; readable current direction |
| `campaign-windsock` | `24×32` | 4 | `(0.25,1)` | Transparent; calm, warning, medium, strong |
| `campaign-berth-tiles` | `32×24` | 3 | `(0,0)` | Transparent; left cap, repeatable center, right cap |
| `campaign-fog` | `128×64` | 1 | `(0,0)` | Transparent cloud fringe; decorative layer |
| `campaign-pickups` | `16×16` | 2 | `(0.5,0.5)` | Transparent; postcard and optional crumb variant |

Sixteen keys total. Reuse existing ship, asteroid, starfield, particles, buttons, frames, fonts, and sound system.

Pad visual width must follow collision width exactly. Tile center art at `2×`, crop the final center tile when needed, and place caps at the declared endpoints. Do not stretch the complete pad sprite to arbitrary widths.

Draw motion rails, radial rings, board connections, checkpoint markers, and force boundaries using simple pixel-aligned graphics. They do not need separate images. Home thanks are text, not rasterized text baked into art.

### Stage B — final art briefs

Use Codex image generation for source art, then the repository’s `tools/art/pixelize.py` normalization workflow. The tool’s actual CLI must be checked by the art owner before use; do not guess flags.

Shared palette foundation: ink `#171B2E`, cream `#F4E6C8`, peach `#E6A57A`. Keep four to six dominant colors per route.

| Key | Size / frames | Route palette additions | Brief | Reference |
|---|---|---|---|---|
| `campaign-destination-bento` | `160×160`, 1 | `#D69A57`, `#6F8E83`, `#B96C58` | Small maintenance station with lunch balcony, rounded bolts, visible docking rail | Existing Tea Moon silhouette/readability; real stacked bento proportions |
| `campaign-destination-matcha` | `160×160`, 1 | `#80966B`, `#B7C69A`, `#D6C58C` | Quiet listening lantern wrapped in soft green cloud curls | Existing celestial art; paper lantern shapes |
| `campaign-destination-bakery` | `160×160`, 1 | `#C98557`, `#E5BD76`, `#806C91` | Tiny lit bakery on an orbital platform; strong oven-window focal point | Tea Moon building scale; neighborhood bakery windows |
| `campaign-destination-im-fine` | `160×160`, 1 | `#657A91`, `#A4B9B3`, `#EDC477` | Blue-gray planet, modest porch, one warm window | Existing lunar warmth; rain-window lighting |
| `campaign-destination-home` | `160×160`, 1 | `#BA8798`, `#88A59A`, `#E5C68F` | Welcoming home station with ribbon and broad berth | Established ship colors and Tea Moon hospitality |
| `campaign-portrait-mallow` | `48×48`, 2 | Bento palette | Round mechanic in an oversized work apron; welcome frame raises lunch lid | Existing rabbit portrait framing |
| `campaign-portrait-nori` | `48×48`, 2 | Matcha palette | Small moth holding a cup with both hands; quiet wing silhouette | Existing portrait contrast and facial scale |
| `campaign-portrait-pip` | `48×48`, 2 | Bakery palette | Tiny baker mostly apron and flour; second frame offers bread | Existing portrait proportions |
| `campaign-portrait-iona` | `48×48`, 2 | Storm palette | Wrapped in a blanket; small change from guarded to relieved | Existing portrait warmth; avoid exaggerated sadness |
| `campaign-cargo` | `32×32`, 5 | Respective route palette | Five clearly distinct silhouettes; no tiny labels | Existing item treatment |
| `campaign-postcards` | `48×32`, 5 | Respective route palette | One simple landmark per card; readable at native size | Corresponding destination art |
| `campaign-flow-arrow` | `24×16`, 1 | `#B7C69A`, cream, ink | Soft-edged but unmistakable arrow with dark separation | Existing HUD arrow language |
| `campaign-windsock` | `24×32`, 4 | Peach, cream, ink | Same pole in every frame; cloth extension communicates force | Simple physical windsock |
| `campaign-berth-tiles` | `32×24`, 3 | Cream, `#6F8E83`, ink | Clean top contact line, soft lamps, repeatable underside | Existing landing pad |
| `campaign-fog` | `128×64`, 1 | `#80966B`, `#B7C69A` | Broad stepped cloud shapes without noisy speckles | Matcha destination cloud shapes |
| `campaign-pickups` | `16×16`, 2 | Cream, peach, ink | Readable envelope/postcard; separate tiny star crumb | Existing UI icon weight |

Art QA must verify exact frame bounds, alpha edges, palette discipline, integer scale, and contact anchors. No generated lettering. Raw generations and provenance belong under `art-src/campaign/`; runtime loading uses only production assets.

Final-art exit requires zero asset failures/fallbacks. Reduced motion freezes decorative animation, not the physical motion needed to understand moving obstacles or pads.

## 7. Parallel builder work packages

### Ownership rule

Exactly one writer per file per wave. Builders request contract changes from the integrator instead of editing shared files.

The integrator owns, throughout:

- `src/types/**`, `src/game/**`
- `src/data/missions.ts`, `src/data/assetManifest.ts`
- Campaign registry/index modules
- `src/scenes/BootScene.ts`, `src/scenes/PreloadScene.ts`
- `src/main.ts`, `src/gameConfig.ts`
- `src/dev/**`, including showcase states
- `e2e/**`, `tools/**`
- Package/build configuration
- Architecture, asset inventory, status, and this campaign plan

This matches the existing architecture ownership model. The integrator also owns the new force/path/collectible systems unless explicitly reassigned in a later wave.

Treat **40 tool calls per package** as a planning allocation: approximately 6 inspection, 20 implementation, 10 validation, 4 report/fix calls. It is not permission to omit required checks. Split an oversized integrator assignment into sequential packages with separate budgets.

### Wave A — foundation and generalization

| Package | Exclusive files | Inputs | Deliverables / exit criteria |
|---|---|---|---|
| **A0 Integrator: contracts and baseline** | Integrator paths; new registry files; `tests/campaignContracts.test.ts` | Existing Tea Moon slice and required engineering docs | Baseline recorded; typed contracts; Tea-only registries; new CLI argument contract; no behavior changes |
| **A1 Flight foundation** | `FlightScene.ts`, `src/entities/flight/**`, `GyozaShip.ts`, `src/data/tuning.ts`, `flightPrototypeRoute.ts`, `flightScenery.ts`, `routes/teaMoonRoute.ts`, `ShipMovementSystem.ts`, `DockingSystem.ts`, `ArrivalGateSystem.ts`, `CollisionSystem.ts`, corresponding named tests | Frozen A0 contracts | Mission-resolved route/camera/scenery; zero-environment compatibility; Tea captures unchanged |
| **A2 Landing foundation** | `LandingScene.ts`, `src/entities/landing/**`, `landingTuning.ts`, `landingScenery.ts`, `LandingSystem.ts`, new landing environment/contact systems, `tests/landing*.test.ts` | Frozen A0 landing contracts | Injected tuning, legacy Tea branch, relative-pad path, gauges agree with outcomes |
| **A3 Results/save foundation** | `DeliveryResultScene.ts`, `SaveSystem.ts`, `MissionResultSystem.ts`, `PackageConditionSystem.ts`, new `CampaignSystem.ts`, `resultCopy.ts`, `packageConditionTuning.ts`, `tests/save*.test.ts`, `tests/missionResult*.test.ts`, `tests/packageCondition*.test.ts`, `tests/campaignProgress.test.ts` | Mission/unlock contracts | Mission-aware results, safe V1 normalization, once-per-attempt save completion |
| **A4 Integrator: pure mechanics** | New force, motion, moving-obstacle, collectible systems and uniquely named tests; dev/e2e integration | Frozen contracts | Deterministic samplers, unit tests, generic read-only probe, working `--mission` dispatch |

A1–A3 may run in parallel after A0. A4 can run alongside them once interfaces are frozen.

Validation per code package:

```text
npm run typecheck
npm test
npm run build
```

Integrator additionally runs existing Tea Moon capture commands and:

```text
node e2e/playtest.mjs
node e2e/playtest.mjs --mission=tea-moon
```

Both must preserve the existing default Tea Moon behavior. Resolve the existing capture IDs during A0; do not rename them.

### Wave B — content and mechanics integration

| Package | Exclusive files | Depends on | Deliverables |
|---|---|---|---|
| **B1 Belt builder** | `src/data/campaign/bentoBelt.ts`, `tests/campaignBento.test.ts` | A0/A4 contracts | Complete Belt content, tuning, copy, pilot hints, data tests |
| **B2 Nebula builder** | `src/data/campaign/matchaNebula.ts`, `tests/campaignMatcha.test.ts` | Force/visibility contracts | Complete current/fog mission |
| **B3 Bakery builder** | `src/data/campaign/blackHoleBakery.ts`, `tests/campaignBakery.test.ts` | Radial/path contracts | Complete well mission and escape fixture definitions |
| **B4 Storm/home builder** | `src/data/campaign/imFine.ts`, `homeDelivery.ts`, `tests/campaignImFine.test.ts`, `tests/campaignHome.test.ts` | Gust, ending, copy contracts | Emotional pair, shelter tuning, final notes |
| **B5 Flight integration** | Same flight ownership as A1 | A4 samplers; B1–B4 modules | Moving rocks, force cues, fog, pickups, checkpoints |
| **B6 Landing integration** | Same landing ownership as A2 | Relative-pad and environment systems | Sliding pad, wind, low gravity, shelter, raised berth |
| **B7 Integrator: registration and placeholders** | Shared registries/manifest/preload/showcases/dev/e2e; temporary ownership of `public/assets/campaign/**` | Content and fixed asset contracts | All missions launch; placeholder assets exist; showcase registrations |

B1–B4 do not edit scenes, shared types, or registry files. B5 and B6 consume submitted modules as they become available. Merge modules through B7 so no registered mission points at missing exports.

Every B package runs typecheck, tests, and build. Integrated mission validation uses:

```text
node e2e/capture.mjs --states=bento-moving,bento-landing,bento-result
node e2e/playtest.mjs --mission=bento-belt
```

Substitute the corresponding mission/state IDs for B2–B4. Data-only builders may depend on the integration snapshot before captures can run; report that dependency rather than claiming validation.

### Wave C — board, polish, and tuning

| Package | Exclusive files | Deliverables | Validation |
|---|---|---|---|
| **C1 Board/UI** | `TitleScene.ts`, `MissionSelectScene.ts`, `src/ui/**`, `src/styles/**`, `src/data/uiCopy.ts`, `tests/ui*.test.ts` | Board, title flow, replay selection, compact layout | Standard checks; board captures; keyboard/touch traversal |
| **C2 Results/save polish** | A3 ownership | Next delivery buttons, ending acknowledgement, persistence notices | Standard checks; save fixtures; ending capture |
| **C3 Flight tuning** | A1/B5 ownership | Readable cues, phone framing, collision recovery, force budgets | Standard checks; all outward route playtests |
| **C4 Landing tuning** | A2/B6 ownership | Relative gauges, windsocks, shelter clarity, touch landings | Standard checks; soft/bumpy/incident matrix |
| **C5 Integrator: campaign gate** | Integrator paths; explicitly transferred ownership of all five campaign content modules after B closes | Tune data from findings; phase sweeps; performance evidence; docs | Full campaign, all showcases, Tea regression |

Do not let C3/C4 simultaneously edit campaign modules. They submit requested values to C5. This keeps cross-scene tuning coordinated.

### Wave D — final art

| Package | Exclusive files | Deliverables | Validation |
|---|---|---|---|
| **D1 Campaign art** | `public/assets/campaign/**`, `art-src/campaign/**`, transferred from B7 | Sixteen final keys, normalized strips, provenance | Dimension/frame/alpha checks; all campaign captures |
| **D2 Integrator art gate** | Manifest/inventory/tooling only | Asset audit, preload verification, no fallback failures | `npm run build`; capture and phone review; Tea regression |

Approximately 40 tool calls per package. Batch image-generation work by shared style, but inspect every final sheet. D1 does not change code to fit unexpected output dimensions.

### Wave E — critics

Critics are read-only and own separate reports:

- **E1 Gameplay critic:** teaching clarity, escape routes, waiting, forgiving recovery.
- **E2 Visual/accessibility critic:** pixel scale, contrast, cue semantics, phone landscape, reduced motion.
- **E3 Technical critic:** saves, phase determinism, event lifecycle, performance, runtime errors.

Reports: `docs/reviews/phase-3-gameplay.md`, `phase-3-visual.md`, `phase-3-technical.md`. Each critic has approximately 40 tool calls.

Use standard checks plus relevant capture/playtest commands. Critics supply reproducible mission, phase, inputs, expected result, and actual result. Original owners fix findings; the integrator approves the final campaign gate.

## 8. Autopilot and playtest extension

### Generic mission hints

Keep authored pilot hints in mission data, not conditionals inside the automation script.

```ts
type MissionPilotHints = Readonly<{
  waypoints: readonly Readonly<{
    position: Point;
    radius: number;
    targetSpeed: number;
  }>[];
  arrivalSpeed: number;
  obstacleLookaheadSeconds: number;
  landing: Readonly<{
    targetRelativeDescent: number;
    targetTangentOffset: number;
    maximumTiltRadians: number;
  }>;
}>;
```

Defaults:

- Waypoint radius `140`.
- Cruise speed `180`; reduce to `110` near moving crossings.
- Arrival speed target `40`.
- Obstacle lookahead `1.5 s`.
- Landing target relative descent `38`.
- Tangent offset `0`.
- Maximum landing correction tilt `0.30 rad`, approximately `17°`.

The dev probe exposes serialized mission definitions/hints, current kinematics, simulation time, sampled force, obstacle position/velocity, pad geometry, wind, and phase. It remains read-only. Automation must fly with keyboard input, not write ship state.

Fixtures may place the ship in an authored starting situation before a test begins. Report those separately from full-route playthroughs.

### Flight controller

Use the existing closed-loop pilot as the base:

1. Select the current waypoint.
2. Compute desired velocity toward it with a distance-based slowing envelope.
3. Compute desired acceleration from velocity error.
4. Subtract sampled environmental acceleration as feed-forward compensation.
5. Convert desired acceleration to rotation using the actual ship convention: `atan2(ax, -ay)`.
6. Rotate, pulse thrust, and brake using the existing discrete keys.
7. Predict closest approach to moving circles over `1.5 s`.
8. Reduce speed or choose a bounded avoidance offset when predicted clearance is below ship radius + obstacle radius + `32 px`.
9. Return to authored waypoints once clear.

Do not cancel a collision by teleporting or use exact future motion to manufacture impossible reflexes. Predicting a visible deterministic path is acceptable, but run delayed-feedback tests as well.

Near the destination, stop translating at low speed and align the **bottom** to the required facing angle. Preserve the existing gate’s continuous `520 ms` ready hold.

### Landing controller

- Aim for predicted pad position `0.4 s` ahead.
- Target tangent velocity equal to pad velocity plus a bounded centering correction.
- Subtract wind from desired horizontal acceleration.
- Choose tilt within `±0.30 rad`; derive thrust timing from required upward acceleration and gravity.
- Reduce target descent toward `38 px/s` close to contact.
- Use S when alignment is close and angular velocity needs damping; avoid fighting it with continuous opposing rotation.
- Sample sheltered wind at the ship’s actual altitude.
- Read surface-relative altitude and velocities.
- After accepted contact, release controls and wait for result transition.

The controller does not branch on mission ID. Different gravity, wind, motion, and waypoints come from data.

### Proposed CLI

```text
node e2e/playtest.mjs --mission=<id>
node e2e/playtest.mjs --mission=<id> --scenario=soft
node e2e/playtest.mjs --mission=<id> --scenario=bumpy
node e2e/playtest.mjs --mission=<id> --scenario=incident-retry
node e2e/playtest.mjs --mission=<id> --phase=0.25
```

These flags must be implemented and documented; they are not assumed to exist today. `--phase` offsets the development simulation clock by a normalized cycle fraction.

### Pass criteria

| Mission | Full-route requirement | Additional checks | Automation timeout |
|---|---|---|---:|
| Tea Moon | Existing pilot still passes | Original captures and trajectory regression | Existing timeout |
| Bento | Complete at four motion phases | Safe bypass; direct crossing fixture; moving-pad soft/bumpy | `180 s` |
| Matcha | Complete through the current | Fog markers visible; wind compensation; reduced motion | `180 s` |
| Bakery | Complete outer route | Inner-well escape; center finite; low-gravity soft/bumpy | `210 s` |
| I’m Fine | Complete at four gust phases | Full warning; force/cue agreement; sheltered touchdown | `210 s` |
| Home | Complete without optional pickups | All notes; raised-pad soft/bumpy; ending/replay | `120 s` |

For every mission:

- Reach the correct result and save completion once.
- Soft and bumpy outcomes are independently reachable using controlled scenarios.
- Incident transitions to a controllable landing retry within `2.5 s`, without revisiting flight.
- Zero uncaught runtime errors, page errors, or asset failures.
- Zero impossible readiness states: no gate hold outside its valid conditions.
- Optional pickup omission never prevents delivery.
- Run one keyboard and one touch landscape smoke test.

Record performance on a named desktop and a named representative phone. Target 60 fps; a useful acceptance envelope is median frame interval `≤16.7 ms`, p95 `≤20 ms`, and average foreground throughput `≥58 fps` over a 30-second active segment. Report browser/device and capture overhead. Headless CI is a regression signal, not proof of phone performance.

Keep at most three moving rocks per route, eight active force definitions, two fog layers, and the existing `300` live-particle ceiling. Avoid per-frame graphics reconstruction, image creation, or event floods. New dashboard/probe telemetry should update at no more than `10 Hz`; physics samples remain per simulation step.

## 9. Risks, cuts, and minimum shippable campaign

### Main risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Tea Moon changes during generalization | The established slice is the quality baseline | Compatibility adapters, unchanged numbers/arithmetic, deterministic regression captures |
| Landing gauges disagree with physics | A “safe” gauge followed by an incident breaks trust | Shared pad-relative metrics for UI and classification |
| Moving obstacles cause repeated incidents | Static collision assumptions may punish the same contact repeatedly | Relative velocity, separation, cooldown, phase-sweep tests |
| Fog hides required information | Atmosphere becomes an unfair second lesson | Draw essential objects above fog; cap opacity |
| Radial force creates a trap | Cozy movement becomes an endurance task | Bounded acceleration, soft center, open escape routes |
| Gusts feel arbitrary | Timing is unreadable without a useful warning | Shared physics/cue sample; full two-second telegraph |
| Save sanitization erases legitimate progress | Existing Tea Moon players must continue cleanly | Preserve V1 protections; tested allowlists and unlock reconciliation |
| Content builders edit shared contracts | Parallel speed becomes merge and behavior risk | Integrator-owned contracts and explicit ownership transfers |
| Art broadens the scope | Five destinations can multiply props and animations | Sixteen new keys; reuse backgrounds/UI; two-frame portraits |
| Final mission feels like another test | Emotional release disappears | No hazards; wide berth; no forced reading timer |

### Cut order

1. **Cut extra cosmetic animation first:** portrait idle loops, secondary ambient particles, animated fog.
2. **Cut optional crumb support from rendering/content:** keep only postcards; no currency UI.
3. **Cut optional orbital rocks:** retain one readable moving crossing in Belt and its sliding landing pad.
4. **Cut postcard pickups and their detours:** retain automatic mission-memory postcards and the complete ending.
5. **Simplify fog to a static translucent layer:** currents and their cues remain.
6. **Cut unshipped geometry flexibility:** defer constant-tilt support if it threatens the main landing refactor; keep the contract at zero and reject nonzero authored values until implemented.
7. **Reduce intermediate route length:** shorten repeated travel, not warning lead times or recovery.
8. **If a whole mission must go, cut Matcha:** add a safe steady-current preview to I’m Fine before its gust band, and revise its single teaching objective to “read changing currents.” Explicitly re-author the lesson and update unlocks, board, saves, notes, and tests.

Do not cut mobile controls, save recovery, relative moving-pad measurements, force telegraphs, landing-only retries, Tea Moon regressions, or the home ending.

Two-stop delivery, rotating stations, moving flight destinations, collision ceilings, collectible economies, procedural weather, and new control schemes are outside this phase.

### Minimum shippable campaign

The preferred release is all six missions above.

The minimum shippable fallback is **five complete deliveries**: Tea Moon → Bento Belt → Black Hole Bakery → Planet “I’m Fine” → Home, with the revised storm lesson described above.

It must include:

- At least one moving-obstacle route and matching moving-pad landing.
- One bounded radial-gravity route and low-gravity landing.
- One clearly telegraphed gust route and sheltered landing.
- A quiet, complete homecoming.
- A readable authored delivery board with unlocks and replay.
- Working existing saves and session-only play when storage fails.
- Keyboard and phone-landscape controls.
- Warm acceptance at every package condition.
- Tested soft/bumpy outcomes and fast landing-only retries.
- Final production assets with zero fallbacks.
- Passing typecheck, tests, build, Tea Moon regressions, campaign playtests, and documented performance checks.

A collection of disconnected showcase scenes is not a shippable campaign. The release unit is the full journey from a fresh save to the home ending, with progress, recovery, and replay working throughout.
