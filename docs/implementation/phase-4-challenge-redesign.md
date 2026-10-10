# Phase 4 — Challenge Redesign (analysis and plan)

Date: 2026-10-10. Status: **implemented 2026-10-10** (see §8 for what shipped and how it was verified). Sections 1–7 are the original analysis.
Trigger: player playtest. "Way too easy; the special mechanics are almost completely ignorable; the black hole is so weak and the moving things add nothing."
Inspiration: the planets of Outer Wilds, where each world has one physical idea that the route forces you to engage with and that you can eventually exploit.

## 1. Diagnosis: the numbers confirm the playtest

Measured on the shipped data (2026-10-10). The audit script sampled each route along the straight line from start to dock, at cruise speed 180 px/s, using the worst phase of any gust. Ship thrust is 420 px/s², brake 520, ship radius 42.

| Route | Peak push on straight line | % of thrust | Rock coverage of world | Moving rock speed / period | Moving rock clearance from the pilot line |
|---|---|---|---|---|---|
| Bento Belt | 0 | 0% | 1.3% | 37–60 px/s, 22–26 s | 155 / 432 / 550 px |
| Matcha Nebula | 38 | 9% | 0.5% | 20 px/s, 28 s | 306 px |
| Black Hole Bakery | 70 | 17% | 0.8% | 70 px/s, 44 s | 108 px |
| I'm Fine | 58 (gust) | 14% | 0.6% | 42 px/s, 24 s | 342 px |

| Landing | Twist | % of landing thrust (270) |
|---|---|---|
| Bento Belt | pad slides 34 px/s (safe sideways limit is 68) | — |
| Matcha Nebula | steady wind 14 | 5% |
| Black Hole Bakery | low gravity 92 (no twist that pushes) | 0% |
| I'm Fine | gust 26, sheltered below 100 px | 10% |

Why the mechanics read as "nothing":

1. **Forces are under 20% of thrust.** A push that small is cancelled by an unconscious few-degree lean. It is never a decision. Players start to feel a force at about 35% of thrust and must plan around it above about 50%. The global cap `CAMPAIGN_MAX_ENVIRONMENT_ACCELERATION = 110` would clip any stronger authored value anyway.
2. **Geometry never forces engagement.** Rocks cover about 1% of 7–9 million px² worlds, so there is always an open lane around every mechanic. The gravity well even has a "go around the outside" line, and the request text tells the player to take it.
3. **Motion is too slow to matter.** With periods of 22–44 s, a rock is effectively static during the 2–3 s the ship spends near it. Timing is never required, because waiting is never required.
4. **Mechanics are only taxes.** Nothing gives anything back: there is no slingshot, no current that is a fast lane, and no gust you can ride. A mechanic that only costs effort, and costs very little, gets ignored.
5. **Landings echo the twist at homeopathic strength.** Wind at 5–10% of thrust, and pad drift at half the safe sideways limit, both disappear under the existing stabilizer and upright assist.

## 2. Design rules for Phase 4

- **R1 Strength.** Every signature force reaches **45–75% of thrust** somewhere on the required path, and stays below thrust and brake so escape is always possible. The cap becomes per-route (`maxEnvironmentAcceleration` already lives on each route; stop sharing the constant).
- **R2 Forced engagement.** Rock walls (chains of static rocks, data only) turn each level into 2–3 **chokepoints** that pass through the mechanic. There are no detours around the idea, only a **safe line** (slower, more waiting, more reading) and a **mastery line** (faster, riskier, uses the mechanic). The optional postcard always sits on the mastery line.
- **R3 Readable tempo.** Moving things use **4–9 s periods** and **120–200 px/s**, so the pattern is visible within one breath and timing matters.
- **R4 Every mechanic gives something back.** Currents are fast lanes, gravity slingshots, gusts and tornadoes lift you, and silence lets you pass.
- **R5 Forgiveness is preserved, not challenge removed.** There are still no lives, fuel, timers or score penalties. Failure stays funny and cheap. Add a checkpoint before every chokepoint, roughly every 600–900 px of challenge. Respawn stays about 1.4 s, and landing retries stay landing-only.
- **R6 Layering.** Each level introduces one idea and reuses earlier ideas at moderate strength, so the campaign builds a vocabulary and the later levels combine it.
- **R7 Ignorability test (acceptance).** A "naive pilot" that flies the straight line and ignores the mechanic must **fail** (incident or wall) on every redesigned route. The hinted autopilot must still **succeed**. This makes "the mechanic matters" a measured fact, not a feeling.

## 3. Level redesigns

Tea Moon (tutorial) is unchanged.

### Level 2 — Bento Belt: "The Lunch Rush" (Hourglass Twins' sand column: a moving stream you must cross)

**New idea: timing through moving traffic.**

- **Chopstick gates (chokepoint 1).** A static rock wall spans the full height at x≈1100, with one gap. Two "chopstick" rocks (r 70) ping-pong toward each other across the gap with the same phase, period **5 s**. Gap when open is 360 px; when closed it is shut. It is open about 55% of the cycle, and the ship needs about 120 px.
- **Sushi conveyor (chokepoints 2 and 3).**
  - Two tall elliptical loops (orbit path, radiusX 110, radiusY 820, period **15 s**), each carrying **7 rocks** with evenly spaced phase offsets. That gives rocks at about 195 px/s, about 300 px gaps, and the stream going up one side and down the other.
  - Each loop spans the world's height, so it must be crossed: four lanes in total.
  - Each lane carries a matching **lane current** (70 px/s², 17%, along the stream), so the ship drifts with the traffic while inside a lane. This also previews external force before Matcha.
- **Safe line:** park between the loops (the calm gap) and cross one lane at a time.
- **Mastery line:** thread both loops in one diagonal pass. The postcard sits between the two lanes of loop 2.
- **Checkpoints:** before the gates, after the gates, and between the loops.
- **Landing ("lunch tray on a lazy Susan"):**
  - Pad width 300, sliding 420↔860 over **8 s**, peak about 86 px/s. That is above the safe sideways limit, so the player must truly match the tray's velocity.
  - The relative-pad collision model already scores this correctly.

### Level 3 — Matcha Nebula: "The Quiet River" (Dark Bramble: fog and anglerfish that hunt by sound)

**New idea: thrust has a consequence (noise), and the current is the silent way through.**

- **The river.**
  - The current becomes a **bending river**: 3–4 rect current segments of **110–150 px/s²** (26–36%) pointing right, then down-right, then up-right.
  - It is bounded by static "reed" rock banks.
  - Coasting inside the river carries the ship at speed, and small taps keep it centred.
- **Tea-koi (cozy anglerfish), the new system.**
  - 4–5 sleepy koi with glowing lures rest beside the river.
  - Each koi listens within **480 px**. Sustained thrust (more than about 0.6 s of thrust inside a 1.5 s window) wakes it.
  - Telegraph: the lure brightens, the eye opens and a ripple ring appears.
  - An awake koi glides toward the ship at **170 px/s**, which is slower than the ship's soft cap of 340, so outrunning works but is loud.
  - After **1.6 s of silence** it loses interest and drifts home at 70 px/s.
  - A koi touch is an incident: "a curious nibble". You return to the last lantern.
- **Fog that really hides.**
  - Visibility drops to about a **300 px lantern radius** around the ship.
  - **Lantern buoys** light the river's edges and double as checkpoints.
  - Koi lures always show through the fog (R: everything announces itself).
- **Safe line:** coast the river, tapping only.
- **Mastery line:** a short cut across a koi pool, burning hard enough to outrun. The postcard sits in the pool.
- **Landing ("two-layer mist"):**
  - **Altitude-banded wind**: above 260 px, wind **+75** (28% of landing thrust, pushing right); below 260 px, **−55** (pushing left).
  - Each band has its own wisps and windsock. The player leans one way, then the other.

### Level 4 — Black Hole Bakery: "The Oven" (Brittle Hollow and its black hole → White Hole)

**New idea: gravity bends your path; you can orbit and slingshot.**

- **A real well.**
  - Inverse falloff `a = peak · coreRadius / d` replaces the flat profile.
  - Peak **300** (71% of thrust) at the core edge (200 px), 120 at 500 px and 67 at 900 px.
  - Circular orbit speed at 500 px is about 245 px/s, which is under the soft cap, so real orbits and slingshots exist.
  - The route cap is raised to 320. Escape is still always possible: thrust 420 against 300.
- **The oven core (white-hole toaster), the new system.**
  - Entering the core radius (140 px) is not a death. The ship is **swallowed and popped out of the "toaster"**, a white-hole exit near the start of the well section, with a gentle exit velocity.
  - The package becomes "toasted", and Pip's dashboard line jokes about it.
  - In effect it is a funny warp to a checkpoint.
- **Crust ring (Brittle Hollow).**
  - A ring of **8 crust rocks** orbits the well at 620 px, period **18 s** (about 215 px/s along the ring), with two gaps.
  - The dock is on the far side of the ring. The straight line crosses the well, and static wall rocks close the outer shoulder above and below.
  - So the player must **pass through the ring gap**, inside strong pull.
- **Safe line:** brake at the ring, wait for a gap, cross, then thrust out.
- **Mastery line:** dive inside the ring and **slingshot** half an orbit around the core to exit at speed toward the dock. The postcard sits on that orbit at about 320 px from the centre.
- **Landing ("leaning apron"):**
  - Gravity 100 down plus a steady **sideways pull 60 toward the oven** (22% of landing thrust, reusing the steady-wind contract with "pull" art).
  - Pad width 300.
  - The ship must hang tilted to hold position, then straighten in the last 60 px.

### Level 5 — Planet "I'm Fine": "The Storm Sea" (Giant's Deep tornadoes and islands thrown to space)

**New idea: forces that change over time; read the warning and find shelter.** It reuses lanes (Bento), currents (Matcha) and moving islands.

- **Alternating gusts.**
  - The gust cycle flips direction each cycle (up, then down), peak **210** (50%).
  - Cycle 7.5 s: warning **1.5 s**, attack 0.5 s, sustain 1.8 s, release 0.7 s, calm 3 s.
  - The warning arrows show the **next** direction.
- **Shelter pockets.** The storm is built from several gust rects with gaps behind island rocks. The lee of each island is calm, which teaches "hide, then go".
- **Tornado columns.**
  - Two vertical **current columns** (220 px wide, **−250** upward, 60%), with "islands" (r 60) riding up them on fast ping-pong paths (4 s).
  - Entering a column flings the ship upward.
- **Mastery line:** ride column 1 to the upper sky route. It skips the second storm band and holds the postcard.
- **Safe line:** hop shelter pocket to shelter pocket during calms.
- **Landing ("porch in a squall"):**
  - Alternating gusts **±120** (44% of landing thrust), warning 1.5 s.
  - Shelter calm below 60 px, fully exposed above 150 px.
  - Pad width 300.

### Level 6 — Home (emotional finale, stays gentle)

- **No incidents and no hazards.** Optional "victory lap" echoes that cannot fail:
  - A small "kettle" well (peak 90) the player can slingshot around for fun.
  - A slow, non-colliding conveyor of thank-you lanterns.
  - A tailwind river toward home.
- These are pure joy. The ending stays as is.

## 4. Difficulty curve

| # | Level | New idea | Reused | First try (target) | Expected retries (avg player) |
|---|---|---|---|---|---|
| 1 | Tea Moon | point and thrust | — | 3–4 min | 0–1 |
| 2 | Bento Belt | timing through traffic | static rocks | 4–5 min | 2–4 |
| 3 | Matcha Nebula | noise and silence, ride a strong current | lane currents, timing (koi) | 5–6 min | 3–5 |
| 4 | Black Hole Bakery | position-dependent gravity, orbit and slingshot, warp | moving ring (timing), counter-thrust | 5–7 min | 4–7 |
| 5 | I'm Fine | time-varying forces, shelter | currents (columns), moving islands, timing | 6–7 min | 4–8 |
| 6 | Home | being cared for | gentle echoes of all | 2–3 min | 0 |

Retries are cheap: about 1.4 s back to a checkpoint that is never more than about 900 px behind.

## 5. Engine work required (minimal set, ordered by player impact)

| Pri | Change | Scope | Pilot impact |
|---|---|---|---|
| P0 | **Pure data retune:** strengths, per-route cap, periods, rock walls, checkpoints, landing numbers. Plus a data helper `conveyorRocks(loop, count)` that emits N orbit rocks with spaced phases. | data only | new waypoints; gate and lane waiting |
| P1a | **Inverse gravity falloff** `falloff: "flat" \| "inverse"` on `radial-gravity`. | ForceFieldSystem + tests | pilot must steer through the ring gap |
| P1b | **Core warp:** `warp?: { radius; exit: ShipKinematicState }` on `radial-gravity`. FlightScene relocates the ship with a "toasted" beat and emits a `flight:warp` event. | ForceFieldSystem, FlightScene, events | pilot avoids the core |
| P1c | **Alternating gusts:** `cycle.alternate: boolean` flips the sign on odd cycles. `GustState.direction: 1 \| -1` drives the arrows, which show the next direction during warning. | ForceFieldSystem, LandingEnvironmentSystem, both scenes' telegraphs | waits in the lee during sustain |
| P1d | **Banded landing wind** `{ kind: "bands"; bands: { aboveAltitude; acceleration }[] }`, blended across 40 px. | LandingEnvironmentSystem, LandingScene wisps | landing controller already counters `wind` |
| P2a | **Seeker koi:** `SeekerDefinition { id; home: Point; hearingRadius; wakeThrustMs; windowMs; chaseSpeed; giveUpMs; returnSpeed; radius }`, a pure `stepSeekers(states, ship, thrusting, dtMs)` with the states `sleeping \| alert \| chasing \| returning`, and an entity with lure, eye and ripple. | new SeekerSystem, entity, FlightScene wiring | **highest risk:** pilot needs `coast` segments (thrust off, let the river carry it) |
| P2b | **Fog with visibility radius and lantern buoys** (render-texture mask: fog layer with a soft hole at the ship and each lantern). | FlightScene visual only | none (pilot reads state) |
| P3 | Gust shelter is data (several rects), tornado columns are data (current rects plus fast ping-pong rocks), and the Home echoes are data. | data | waypoints |

Assist checks to keep:

- Full thrust escapes every sampled point.
- Brake 520 exceeds every force.
- Arrival gates stay outside the strongest force.
- Dashboard copy is rewritten for the new actions: "Wait for the gap", "Coast. Koi hear engines", "Dive close to swing around", "Hide behind the island".

## 6. Implementation plan

1. **Wave 0 — data retune (1 builder, cheap, biggest win).**
   - All P0 changes plus P3 data.
   - Update the pilot waypoints and add `waitForClear` and `coast` hints to `PilotWaypoint`.
   - Add `e2e/ignorability.mjs`, the naive straight-line pilot from R7.
   - Exit: the autopilot passes all six missions, and the naive pilot fails Bento, Matcha, Bakery and I'm Fine.
2. **Wave 1 — systems (3 builders, one owner per file).**
   - A: ForceFieldSystem (P1a, P1b, P1c) and its tests.
   - B: LandingEnvironmentSystem and the LandingScene telegraphs (P1c landing, P1d).
   - C: SeekerSystem and the koi entity (P2a).
   - The integrator owns FlightScene, the types and events.
3. **Wave 2 — integration.**
   - FlightScene wiring: warp beat, koi, fog mask (P2b).
   - Autopilot support for coast and wait.
   - Showcase states and save fixtures.
   - Retune from autopilot traces.
4. **Wave 3 — art and audio.**
   - Placeholders first, final art at the end: koi with lure, toaster white hole, tornado column, crust rocks, lantern buoys, pull-arrow art.
   - Audio: gust whoosh, koi wake chime, warp "pop".
5. **Wave 4 — verification.**
   - Ignorability test, autopilot soft and bumpy on all missions, critics (target 8.5), and **a human playtest by the player**, since difficulty must be felt, not just simulated.

Builders: Codex `gpt-6.1-sol` (high) by default, once the Codex usage limit resets. Claude handles integration and review.

## 7. Risks and cut order

Risks:

- **Autopilot coverage of the koi.** Coast segments are new. Fallback: the pilot may outrun, since chase is slower than the cap.
- **Difficulty spike at Bakery.** Tune peak 300 → 240 if human retries exceed about 8.
- **Fog readability on phones.** Keep the lures and buoys at full contrast.
- **Motion clutter in the conveyor.** Keep rock art distinct from the background.
- **Package condition on hard levels will often read "rearranged".** Result copy must stay kind.

Cut order, if time runs short:

1. Home echoes.
2. Fog visibility radius (keep decorative fog with buoys).
3. Crust-ring gaps (use wall plus well only).
4. Koi chase (keep sleeping koi that wake and bump in place).
5. Banded landing wind (use one strong steady wind).

Never cut P0. The retune alone fixes "the mechanics do nothing".

## 8. As implemented (2026-10-10)

Built in this session with Claude (Codex was out of usage). Numbers below are the shipped values; they differ from §3 where tuning in the route simulator showed a better result.

| Level | Shipped mechanic | Key numbers |
|---|---|---|
| Bento Belt | Chopstick gate in a full-height wall; two sushi-conveyor loops (9 rocks each) with lane currents; calm seat between loops | gate 5 s; loops 30 s / 27 s, about 170–190 px/s in the lanes; lane current 70 (flow 170); tray 480↔800, peak 84 px/s, pad 300 |
| Matcha Nebula | Bending river (flow-speed current) between reed banks; still pool at the bottom bend; 5 tea-koi; dense fog with lantern buoys; two-layer landing mist | river 110–140 (flow 200); koi wake after 450 ms of heard thrust (drains over 1.5 s), chase 175 px/s, give up after 1.7 s quiet, leash 700; fog radius 300; mist +75 above 260 px, −42 below |
| Black Hole Bakery | Inverse-falloff well behind crust cliffs; rotating crust ring (12 rocks, three double gaps); oven-mouth warp to the toaster; sideways landing pull | peak 300 at 200 px, cap 320; ring 620 px / 30 s; warp radius 140; landing gravity 100 + pull −60, pad 300 |
| Planet I'm Fine | Three alternating storm strips with sea-stack doorways; calm eyes by lighthouses; tornado column to a sky lane with bobbing islands | gust ±300 (71% of thrust), cycle 7.5 s with 1.5 s warning; doorway about 210 px; tornado −260 (flow 300); landing squall ±140, sheltered below 40 px |
| Home | Gentle tailwind and a small kettle well; no hazards | tailwind 45 (flow 150); kettle 70 |

The naive pilot model in the test is stricter than §2's straight-line idea: it follows the same path but never waits, never goes quiet, never dodges moving things, reacts to forces 350 ms late at 80%, and presses thrust in bursts of at least 450 ms.

Verification:

- `npm test`: 394 tests. `tests/challengeRedesign.test.ts` holds:
  - every redesigned route: the hinted pilot arrives with 0 incidents, 0 warps and ≤ 1 hard bump, and never wakes a koi; the naive pilot is defeated (incident, warp, or two or more hard bumps);
  - every landing: soft and bumpy succeed from six gust and tray phases;
  - ignoring wind or tray motion is soft at most half the time on the four twisted landings.
- Real-keyboard e2e (`e2e/campaign-playtest.mjs`, shared TS pilot):
  - `--mission=all --landing=soft`: all pass, 0 crashes.
  - `--landing=bumpy --incident-first=true --phase=0.5`: all pass, 0 crashes, landing retry about 1.1 s.
  - 60 fps throughout.
- `e2e/capture.mjs --states=all` on desktop and a small phone: 106 captures, 0 runtime errors, 0 failed assets.

Not yet done:

- A human playtest of the new difficulty. Simulated pilots cannot judge how hard it feels.
- Final art for the koi, toaster and lantern buoys. They are code-drawn pixel art in `ChallengeCues.ts`.
- Re-scoring by the module critics.

## 9. Landing controls rework

Date: 2026-10-10 JST. Player feedback: slow angular steering could not counter crosswind or follow the moving tray. This section supersedes the tilt-based landing descriptions and landing numbers in sections 3 and 8.

Every landing now uses the same hover controls:

| Input / property | Shipped value |
|---|---|
| W / bottom thruster | 270 px/s^2 straight up in world space, independent of lean |
| A / D / side puffers | 230 px/s^2 left / right, independent of W |
| Cosmetic lean | maximum 0.28 radians (16 degrees); follows input and returns at 4 rad/s |
| S / steady | horizontal drift damping relative to the moving pad, capped at 55 px/s^2; also levels lean |
| Horizontal air drag | 0.6 /s in world space |
| Vertical damping | existing 0.018 /s |
| Touchdown thresholds | soft 84 vertical / 68 pad-relative horizontal / 22 degrees; bumpy 145 / 122 / 36 |

Gravity per mission stays unchanged. Wind and pad sampling, collision frames, landing-only retry and package rules stay unchanged. Angular acceleration/damping/upright-assist tuning and maximum-tilt pilot hints are removed. The existing rotation field stores lean and angularVelocity stays zero; state/probe/save shape remains compatible. Both side keys cancel; S levels the ship even when a side key is held. Strong wind still requires A/D because steady alone cannot cancel it.

The PD pilot uses position gain 1.8, relative-velocity gain 3, a 10 px/s^2 side-command deadband, and wind/drag feed-forward. It uses S only within 12 px and 8 px/s of matching, with no side command. Soft descent approaches the mission target (38 px/s); bumpy approaches 110 px/s. If off centre below 220 px it slows to 18 px/s before committing. The simulator matches LandingScene's environment clock, world bounds and integration. Its naive pilot aims at the current pad with no wind or pad-velocity feed-forward, uses 80% feedback gain and delays side commands by 350 ms; it retains ordinary descent metering.

Retunes needed to keep the authored twists meaningful under stronger steering:

| Landing | Change | Preserved |
|---|---|---|
| Bento Belt | tray width 300 -> 260 px | endpoints 480/800, period 12 s, peak 83.8 px/s |
| Matcha Nebula | lower band -42 -> -100 px/s^2 | upper band +75, split 260 px, blend 80 px |
| Black Hole Bakery | no physical retune | gravity 100, sideways pull -60, pad width 300 |
| I'm Fine | landing-only cycle: warning 1500 -> 800 ms, sustain 1800 -> 2500 ms, calm 3000 -> 1500 ms (period 6 s) | peak +/-140; attack 500 / release 700 ms; shelter below 40 px, fully exposed above 110 px; route cycle unchanged |
| Tea Moon / Home | no gravity, wind or pad retune | calm tutorial and victory lap |

Verification:

- TypeScript no-emit check and Vite production build succeed using the installed bundled runtime. Vite retains its existing large-bundle warning.
- Vitest: 406 tests across 34 files pass. Physics coverage verifies independent lateral puffers, world-space vertical thrust, capped/returning lean, S relative to moving pads and its acceleration cap, and side thrust overcoming every authored wind sample.
- All 72 landing simulations pass: 6 missions x soft/bumpy x phases [0, 1500, 3000, 4500, 6000, 9000] ms.
- Naive soft counts on those six phases: Bento 1/6, Matcha 0/6, Bakery 0/6, I'm Fine 1/6. Tea Moon and Home remain soft 6/6 each.
- Browser visual/input check: A/D slide with W released, lean +/-0.28, released lean returns to zero, opposite-side exhaust puffs visible, desktop hints and phone touch labels correct; 0 runtime/asset/font errors. Evidence: `e2e/out/lr-hover-ui/`.
- Tea Moon full-loop keyboard playtest `e2e/playtest.mjs --label=lr-tea`: passed, soft delivery, incident-to-retry 1.09 s, save survives reload, 0 runtime/asset/font errors.

Campaign real-keyboard e2e results (`--mission=all` covers the five post-tutorial deliveries; Tea Moon is checked separately above):

- `--mission=all --landing=soft --label=lr-soft`: 5/5 soft, 0 route crashes, 0 runtime/asset/font errors, average FPS 59.85-60.36.
- `--mission=all --landing=bumpy --incident-first=true --phase=0.5 --label=lr-bumpy`: 5/5 bumpy, 0 route crashes, 0 runtime/asset/font errors, landing-only retry 1.059-1.127 s.
- Outputs: `e2e/out/lr-soft/summary.json`, `e2e/out/lr-bumpy/summary.json`, `e2e/out/lr-tea/playtest-soft.json`. The two summary.json top-level lines both read `"passed": true`, and every mission entry does too. Tea Moon's report also reads `"passed": true`.
- Supplied runtime hash 81ea4d5168ddd0a3 was absent; every JS command used installed bundled `C:/Users/alber/AppData/Local/OpenAI/Codex/runtimes/cua_node/cfb32733c877621e/bin/node.exe`. The existing localhost:5173 server was reused.

Human difficulty/feel review remains for the lead; automatic pilots verify controllability and outcomes.

Changed files for this task (33; other builder files excluded):

- `README.md`
- `docs/README.md`
- `docs/engineering/ARCHITECTURE.md`
- `docs/gameplay-decisions.md`
- `docs/implementation/phase-4-challenge-redesign.md`
- `docs/wiki/one-bottom-thruster-landing.md`
- `e2e/playtest.mjs`
- `src/data/campaign/bentoBelt.ts`
- `src/data/campaign/blackHoleBakery.ts`
- `src/data/campaign/campaignHelpers.ts`
- `src/data/campaign/imFine.ts`
- `src/data/campaign/matchaNebula.ts`
- `src/data/campaign/teaMoon.ts`
- `src/data/landingCopy.ts`
- `src/data/landingScenery.ts`
- `src/data/landingTuning.ts`
- `src/dev/landingSim.ts`
- `src/dev/routePilot.ts`
- `src/dev/showcaseStates.ts`
- `src/entities/landing/LandingAids.ts`
- `src/entities/landing/LandingTouchPads.ts`
- `src/entities/landing/campaignPresentation.ts`
- `src/entities/landing/landingReadouts.ts`
- `src/entities/landing/landingTouchLayout.ts`
- `src/scenes/LandingScene.ts`
- `src/systems/LandingSystem.ts`
- `src/types/campaign.ts`
- `src/types/landing.ts`
- `tests/campaignContracts.test.ts`
- `tests/challengeRedesign.test.ts`
- `tests/landing.test.ts`
- `tests/landingAtmosphere.test.ts`
- `tests/landingCampaign.test.ts`
