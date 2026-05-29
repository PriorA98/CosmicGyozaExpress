# Cosmic Gyoza Express - Implementation Plan

Last updated: 2026-05-29 JST

Status: stack locked to Phaser + TypeScript + Vite + localStorage.

## 1. Product Direction

Cosmic Gyoza Express should be built as a desktop-browser-first 2D game: playable by opening a link, tuned for keyboard/gamepad on PC, and deployable as a static website. The game can later be wrapped for desktop with Electron or Tauri if a downloadable PC build becomes important, but the first production target should stay browser-native.

The concept is strongest when it stays small, authored, and polished. It should not become a large sim, roguelike, RPG, or procedural galaxy. The core product should be a short, handcrafted physics delivery game with a warm tone and a funny dashboard voice.

Primary player promise:

> Fly a tiny gyoza ship through cozy space, wrestle with funny momentum, deliver comforting food, and leave the universe slightly warmer.

Primary technical promise:

> The game runs from a static URL, saves progress locally in the browser, and does not require login, backend services, or installation.

## 2. Locked Stack

### Runtime and Engine

- Phaser for 2D game scenes, rendering, asset loading, input, animation, audio, and collision helpers.
- TypeScript for strong data contracts, mission definitions, save schemas, and gameplay systems.
- Vite for local dev server, fast iteration, and production bundling.
- localStorage for small local saves: mission progress, settings, unlocked cosmetics, and ending state.

### Why This Stack Fits

Phaser is a good fit because the game is a lightweight 2D experience with scenes, sprites, particles, audio, collision checks, and browser deployment. Vite keeps development and static builds simple. TypeScript is useful because this game will be data-heavy: missions, NPCs, dashboard lines, route configs, collectibles, save state, and tuning constants should be typed rather than scattered as loose strings.

The game should use custom ship movement logic rather than relying entirely on a built-in physics engine. Phaser's Arcade Physics can still handle broad collision and overlap checks for simple circles/rectangles. Matter Physics should be treated as an escalation path only if the project later needs more complex body shapes, joints, or constraint-driven objects.

### Key References

- Phaser installation and TypeScript notes: https://docs.phaser.io/phaser/getting-started/installation
- Phaser physics overview: https://docs.phaser.io/phaser/concepts/physics
- Phaser Matter Physics docs: https://docs.phaser.io/phaser/concepts/physics/matter
- Phaser + TypeScript + Vite template announcement: https://phaser.io/news/2024/01/phaser-vite-typescript-template
- Vite guide: https://vite.dev/guide/
- MDN localStorage behavior: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

### Local Design References

- `docs/design/design-system.md` defines the official visual system derived from the imported UI handoff.
- `docs/design/ui-reference.md` maps prototype screens to production screens and calls out prototype-only systems that should not enter MVP scope.
- `docs/assets/asset-inventory.md` catalogs imported gyoza ship, planet, and screenshot reference assets.
- `docs/implementation/frontend-integration.md` explains how to translate the HTML/CSS prototype into the Phaser + TypeScript implementation.
- `references/design-handoff/` preserves the raw handoff bundle for traceability only.

## 3. Target Platform and Save Strategy

### Target Platform

Primary target:

- Desktop browser.
- Keyboard and controller input.
- Latest stable Chrome, Edge, Firefox, and Safari.
- 16:9 first, with responsive support for common laptop sizes.

Secondary target:

- Tablet or mobile browser only if it falls out naturally.
- No mobile-first control scheme in the initial scope.

### Save Model

Use localStorage with a versioned JSON blob. This is enough because the save data is tiny and does not need server sync.

Important constraint: localStorage is tied to the browser, device, protocol, and domain. A player can keep progress when returning to the same deployed URL in the same browser. Progress will not automatically transfer to another device or another domain.

Recommended key:

```ts
const SAVE_KEY = "cosmic-gyoza-express.save.v1";
```

Initial save shape:

```ts
type SaveDataV1 = {
  version: 1;
  createdAt: string;
  updatedAt: string;
  completedMissions: string[];
  unlockedMissions: string[];
  collectedMemories: string[];
  unlockedCosmetics: string[];
  equippedCosmetics: string[];
  settings: {
    cozyMode: boolean;
    reducedMotion: boolean;
    musicVolume: number;
    sfxVolume: number;
    inputScheme: "keyboard" | "gamepad";
  };
  stats: {
    totalDeliveries: number;
    totalCrashes: number;
    totalSoupAdjacentEvents: number;
    bestMissionResults: Record<string, MissionResultSummary>;
  };
  endingSeen: boolean;
};
```

Add an optional export/import save feature in settings after the MVP. It should copy/download the save JSON and restore from pasted/uploaded JSON. This protects the player from browser data loss without requiring accounts.

## 4. Scope Principles

### Must Preserve

- The gyoza ship is the visual and emotional center.
- Movement must feel inertial, floaty, learnable, and funny.
- Deliveries are short handcrafted routes, not generated content.
- Food is framed as care, comfort, warmth, and connection.
- Failure is comedic and recoverable.
- Dashboard is both useful and a character voice.
- The final delivery gives a small emotional payoff without becoming preachy.

### Must Avoid

- Backend accounts.
- Multiplayer.
- Procedural galaxy generation.
- Economy or upgrade grind.
- Calories, diet language, body jokes, or food shame.
- Long dialogue scenes.
- Complex inventory.
- Large open world.
- Perfectionist scoring.

### MVP Definition

The MVP is not "all planned content." The MVP is a polished vertical slice that proves the game works.

MVP includes:

- Boot/load flow.
- Title/menu.
- One playable delivery route.
- Gyoza ship with tuned inertial movement.
- Obstacles and safe crash/respawn.
- Destination docking/delivery.
- Functional dashboard with useful and funny lines.
- One NPC request and one delivery reaction.
- localStorage save for completed mission and settings.
- Basic audio.
- Static deployment build.

## 5. Recommended Project Structure

Proposed file layout:

```text
cosmic-gyoza-express/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  public/
    assets/
      audio/
      fonts/
      images/
      sprites/
      ui/
  src/
    main.ts
    gameConfig.ts
    scenes/
      BootScene.ts
      PreloadScene.ts
      TitleScene.ts
      GalaxyMapScene.ts
      BriefingScene.ts
      FlightScene.ts
      DeliveryResultScene.ts
      CollectionScene.ts
      SettingsScene.ts
      EndingScene.ts
    systems/
      SaveSystem.ts
      InputSystem.ts
      MissionSystem.ts
      DashboardSystem.ts
      PhysicsTuning.ts
      CollisionSystem.ts
      PackageConditionSystem.ts
      AudioSystem.ts
      AccessibilitySystem.ts
    entities/
      GyozaShip.ts
      DeliveryTarget.ts
      Obstacle.ts
      GravityWell.ts
      Collectible.ts
      ParticleBurst.ts
    data/
      missions.ts
      dashboardLines.ts
      npcs.ts
      cosmetics.ts
      tuning.ts
    types/
      mission.ts
      save.ts
      physics.ts
      assets.ts
    ui/
      DashboardView.ts
      DialoguePanel.ts
      Button.ts
      Meter.ts
      Toast.ts
    dom-ui/
      DomRoot.ts
      ScreenRouter.ts
      HudOverlay.ts
    styles/
      tokens.css
      base.css
      components.css
      screens.css
    utils/
      math.ts
      storage.ts
      random.ts
      assert.ts
  tests/
    movement.test.ts
    save.test.ts
    missionData.test.ts
  e2e/
    smoke.spec.ts
```

Keep the architecture simple. Phaser scenes should orchestrate. Systems should hold reusable logic. Entities should be thin wrappers around sprites plus state. Data files should define content.

## 6. Core Game Flow

### Scene Flow

1. BootScene
   - Configure renderer sizing.
   - Initialize save system.
   - Apply settings.

2. PreloadScene
   - Load images, spritesheets, audio, fonts, and JSON.
   - Display a tiny loading indicator.

3. TitleScene
   - New game / continue.
   - Settings.
   - Credits later.

4. GalaxyMapScene
   - Shows delivery nodes as a sticker-book map.
   - Select unlocked mission.
   - Shows memory/cosmetic progress lightly.

5. BriefingScene
   - Shows sender, request, item, and route theme.
   - Player launches mission.

6. FlightScene
   - Main gameplay.
   - Ship movement, dashboard, obstacles, docking, crash/respawn.

7. DeliveryResultScene
   - Recipient reaction.
   - Mission result label.
   - Memory reward.
   - Unlock next route.

8. CollectionScene
   - Optional memory/sticker viewer.

9. SettingsScene
   - Audio, controls, cozy mode, reduced motion, save export/import later.

10. EndingScene
   - Final package for the gyoza ship.

### Main Player Loop

1. Pick route from map.
2. Read short request.
3. Launch.
4. Navigate with thrust, rotation, braking, and momentum.
5. Watch dashboard for speed, direction, package state, and docking hints.
6. Crash or recover without harsh penalty.
7. Dock or enter delivery zone.
8. Receive short reaction and memory reward.
9. Return to map.

## 7. Mechanics Investigation and Design

### 7.1 Ship Movement

The ship movement is the highest-risk and highest-value mechanic. It should be implemented first and tuned before building many levels.

Movement model:

- Ship has position, velocity, rotation, angular velocity, and tuning constants.
- Pressing thrust adds acceleration in the direction the ship is facing.
- Releasing thrust does not stop the ship.
- Rotation changes facing direction, not velocity direction.
- Braking applies acceleration opposite current velocity, not simply a hard velocity clamp.
- Stabilizer assist can gently reduce drift in Cozy Mode.
- Max speed should be soft-capped, not abruptly clamped.

Suggested tuning variables:

```ts
type ShipTuning = {
  thrustAcceleration: number;
  brakeAcceleration: number;
  rotationSpeed: number;
  angularDamping: number;
  linearDamping: number;
  maxSoftSpeed: number;
  overspeedDrag: number;
  cozyAssistStrength: number;
  collisionDangerSpeed: number;
  dockingMaxSpeed: number;
  dockingMaxAngleDegrees: number;
};
```

Implementation approach:

- Use custom Vector2 math for velocity integration.
- Use Phaser sprites for rendering.
- Use Phaser overlap/collision checks against simple circular/rectangular zones.
- Use delta time consistently so movement does not depend on frame rate.
- Add debug overlays for velocity vector, facing vector, docking zone, and gravity zones.

Acceptance criteria:

- The ship can drift sideways while facing another direction.
- Counter-thrust and braking feel different.
- Overshooting a target is common but recoverable.
- The player can intentionally dock after 2-3 minutes of practice.
- Cozy Mode can make early docking easier without removing the core feel.

### 7.2 Input

Keyboard defaults:

- `W` / Up: thrust.
- `S` / Down: brake or reverse stabilizer.
- `A` / Left: rotate left.
- `D` / Right: rotate right.
- `Space`: short stabilizer burst or confirm, depending on scene.
- `R`: quick retry after crash.
- `Esc`: pause.

Controller defaults:

- Left stick: rotate or aim orientation.
- Right trigger / A: thrust.
- Left trigger / B: brake.
- Start: pause.

Start with keyboard. Add gamepad once the movement prototype is stable. Gamepad support matters for PC comfort but should not block the MVP.

### 7.3 Collision and Failure

Collision should read as physical but forgiving.

Collision categories:

- Soft bump: low speed, bounce or nudge, package condition slightly affected.
- Dramatic bump: medium speed, spin, particles, package state changes.
- Gyoza event: high speed, poof/confetti/steam burst, quick respawn.

Crash logic should consider relative speed and object type.

```ts
if (impactSpeed < softBumpSpeed) {
  applyBump();
} else if (impactSpeed < crashSpeed) {
  applySpinAndPackageDamage();
} else {
  triggerGyozaEvent();
}
```

Respawn should be quick:

- Freeze input briefly.
- Show comedic line.
- Play poof animation.
- Restore ship at last checkpoint or mission start.
- Preserve mission attempt and humor stats.

No lives. No game over.

### 7.4 Docking and Delivery

Docking should require controlled arrival but remain generous.

Docking checks:

- Ship is inside delivery zone.
- Speed is under threshold.
- Facing angle is within threshold.
- Optional: hold confirm for 0.5 seconds to complete.

Early missions should use a generous angle threshold, defaulting to roughly 45 degrees for Tea Moon. Later missions can tighten angle requirements or add gravity influence, environmental currents, moving destinations, or hold-to-deliver timing.

Bad docking attempts should block delivery and communicate the reason. In Tea Moon, a bad docking attempt should lightly bounce the ship away from the delivery zone without package condition loss unless the ship also collides or crashes.

Docking states:

- Too far.
- Approaching.
- Slow down.
- Align.
- Ready.
- Delivering.

Dashboard should surface these states clearly.

### 7.5 Package Condition

Package condition is flavor, not punishment.

Internal numeric state can exist, but display should use warm labels:

- Perfect.
- Slightly shaken.
- Emotionally rotated.
- Warm but confused.
- Still delicious.
- Dramatically rearranged.
- Basically fine.

Condition changes:

- Soft bump: minor condition loss.
- Dramatic bump: bigger condition loss.
- Collision or crash during bad docking: condition loss.
- Gravity hazard: possible temperature wobble.
- Cozy Mode: condition loss reduced.

Delivery should always be accepted in the main campaign.

### 7.6 Gravity Wells and Environmental Forces

Add only after movement and docking are fun.

Force zones:

- Radial gravity pull.
- Nebula drift current.
- Asteroid belt moving obstacle paths.
- Black hole bakery pull.
- Storm currents around Planet "I'm Fine".

Implementation:

- Each force zone applies acceleration to the ship while inside radius/area.
- Show subtle visual indication: particles, rings, current wisps.
- Dashboard reports "local gravity anomaly" or similar.

Keep force zones readable. Invisible forces are frustrating unless clearly telegraphed.

### 7.7 Collectibles and Memories

Collectibles should be optional and low-pressure:

- Star crumbs.
- Route postcards.
- Tiny stickers.
- Dashboard charms.

Collectibles should never be required for emotional ending unless the requirement is very forgiving. The ending should be based on completing main deliveries.

## 8. Gameplay Content Plan

### Campaign Shape

Recommended complete first release:

1. Tea Moon Tutorial
2. Asteroid Bento Belt
3. Matcha Nebula Drift
4. Black Hole Bakery
5. Planet "I'm Fine"
6. Final Delivery: Package for the Gyoza Ship

This is enough content to create a meaningful arc without overscoping.

### Mission Template

Each mission should define:

- ID.
- Title.
- Sender.
- Delivery item.
- Request line.
- Route theme.
- Start position.
- Destination position.
- Obstacles.
- Force zones.
- Collectibles.
- Dashboard flavor pool.
- Recipient reactions by package condition.
- Unlocks.
- Memory reward.

Example shape:

```ts
type MissionDefinition = {
  id: string;
  title: string;
  senderId: string;
  deliveryItemId: string;
  requestText: string;
  theme: "teaMoon" | "bentoBelt" | "matchaNebula" | "blackHoleBakery" | "stormPlanet" | "home";
  start: Point;
  destination: DeliveryDestination;
  obstacles: ObstacleDefinition[];
  forceZones: ForceZoneDefinition[];
  collectibles: CollectibleDefinition[];
  dashboardLinePoolIds: string[];
  reactions: PackageConditionReactions;
  unlocksMissionIds: string[];
  memoryRewardId: string;
};
```

### Level 1 - Tea Moon Tutorial

Purpose:

- Teach thrust, rotation, braking, docking, and delivery.

Features:

- Wide open space.
- Large delivery zone.
- Gentle angle docking with a broad tolerance.
- A few static soft asteroids.
- Very forgiving crash threshold.
- Dashboard calls out speed, distance, and alignment.

Completion reaction:

- Sleepy Moon Rabbit receives hot tea and moon mochi.

### Level 2 - Asteroid Bento Belt

Purpose:

- Teach route planning and moving obstacles.

Features:

- Slow-moving asteroids.
- Wider route with optional safer path.
- First optional collectible.
- Package condition changes become visible.

### Level 3 - Matcha Nebula Drift

Purpose:

- Teach dashboard dependence and low visibility.

Features:

- Nebula fog overlay.
- Direction indicator becomes important.
- Gentle drift currents.
- Fewer physical obstacles, more navigation pressure.

### Level 4 - Black Hole Bakery

Purpose:

- Introduce radial gravity pull.

Features:

- Strong force zone near black hole.
- Counter-thrust challenge.
- Bakery station destination.
- Visual force rings.

### Level 5 - Planet "I'm Fine"

Purpose:

- Emotional centerpiece.

Features:

- Soft storm currents.
- Gentle landing challenge.
- More ambient animation and warmer payoff.
- No harsh fail state.

### Final Delivery - Package for the Gyoza Ship

Purpose:

- Emotional ending and personal dedication.

Features:

- Return to home station.
- No difficult final challenge.
- Thank-you notes from NPCs.
- Dashboard joke after the emotional beat.

## 9. Dashboard and UI Plan

### Dashboard Role

Dashboard must be both functional UI and comedic voice. It should not become a dense simulator panel that competes with gameplay.

Useful readouts:

- Speed.
- Distance to destination.
- Docking status.
- Package condition.
- Fuel/energy, if fuel is included.
- Gravity influence, when relevant.

Flavor readouts:

- Sauce pressure.
- Gyoza crispiness.
- Snack morale.
- Dumpling wobble.
- Pilot confidence.
- Package warmth.

Reactive dashboard lines:

- Normal flight.
- High speed.
- Near destination.
- In gravity zone.
- After soft bump.
- After crash.
- After delivery.

UI layout:

- Main game view occupies most of the screen.
- Dashboard fixed along bottom or lower-left.
- Keep height modest so it does not hide route hazards.
- Use compact labels and meters.
- Use clear iconography for speed, package, destination, and warning states.

Implementation choice:

- Use Phaser for the real-time flight scene, ship, hazards, particles, docking, and audio timing.
- Use HTML/CSS for text-heavy and control-heavy surfaces where it improves readability and implementation speed: title, galaxy map, briefing, pause/settings, delivery result, memories, and ending.
- Keep the live flight HUD minimal. It can start in Phaser for simplicity, then move selected dashboard panels to HTML/CSS if text layout becomes painful.
- Do not add React just because the prototype uses React/Babel. The production stack remains Phaser + TypeScript + Vite.

### Menus

Menus should be functional, not a marketing site.

Required screens:

- Title.
- Galaxy map.
- Briefing.
- Pause.
- Result.
- Settings.

Optional screens:

- Collection/memories.
- Credits.
- Save import/export.

## 10. Asset Investigation and Production Plan

### Visual Style Recommendation

Use 2D hand-drawn or pixel-adjacent sprites with soft edges, simple silhouettes, and warm color accents. The game should feel handmade and cute, but readability matters more than visual density.

Avoid a one-note color palette. Space can be dark, but it should not become only navy/purple. Use varied local themes:

- Tea Moon: warm cream, green tea, moon gold.
- Bento Belt: charcoal space, rice white, salmon pink, nori green.
- Matcha Nebula: matcha green, soft yellow, deep teal.
- Black Hole Bakery: dark violet, pastry pink, warm window orange.
- Planet "I'm Fine": storm gray, soup gold, blanket red, gentle blue.

### Asset Pipeline

Imported reference assets are now documented in `docs/assets/asset-inventory.md` and copied under `assets/reference/`. The raw handoff remains under `references/design-handoff/`.

Initial prototype:

- Use placeholder geometric shapes and simple generated sprites.
- Do not wait for finished art before testing movement.

Vertical slice:

- Produce final-quality gyoza ship sprite and core effects.
- Produce Level 1 destination, obstacle, background, and UI style.

Full release:

- Expand environment assets per mission.
- Add NPC portraits or destination character sprites.
- Add memory reward images/stickers.

Recommended formats:

- PNG for sprites, spritesheets, UI, and pixel/hand-drawn assets.
- WebP for large background illustrations if file size becomes an issue.
- JSON atlas if using packed spritesheets.
- OGG/MP3 audio depending on browser support and asset pipeline.

### Required Asset List

Core ship assets:

- Gyoza ship idle sprite.
- Gyoza ship thrust frames.
- Gyoza ship braking/stabilizer frame.
- Gyoza ship wobble or turn frames.
- Thruster puff particle.
- Steam particle.
- Soy droplet particle.
- Green onion/confetti particle.
- Gyoza poof/explosion spritesheet.
- Shadow/glow sprite.

Environment assets:

- Starfield layers.
- Nebula cloud layers.
- Small planets.
- Moons.
- Asteroids.
- Moving asteroid variants.
- Delivery zone marker.
- Home station.
- Tea Moon destination.
- Bento Belt props.
- Matcha Nebula fog/cloud sprites.
- Black hole visual.
- Bakery station.
- Storm planet.
- Warm station windows.
- Route marker/direction arrow.

UI assets:

- Dashboard panel.
- Meter bars.
- Indicator lights.
- Button states.
- Map node icons.
- Locked/unlocked markers.
- Package condition icons.
- Settings icons.
- Memory/sticker frames.

NPC and content assets:

- Sleepy Moon Rabbit portrait.
- Asteroid Miner portrait.
- Matcha station character or icon.
- Black Hole Baker portrait.
- Tiny Planet "I'm Fine" face/storm expression.
- Final thank-you note/cards.

Audio assets:

- Main menu loop.
- Flight loop.
- Calm route loop or layered ambience.
- Delivery success jingle.
- Crash poof.
- Thruster puff.
- Brake/stabilizer sound.
- Dashboard beep.
- Warning blip.
- Collectible chime.
- Docking click.
- Text advance blip.

### Asset Scope Control

The first final-quality asset must be the gyoza ship. If the ship is charming, simple environments can still work. If the ship is weak, extra backgrounds will not rescue the identity.

For the first playable slice, required final-ish assets are:

- Gyoza ship.
- Thrust/poof particles.
- One destination.
- One obstacle.
- One background set.
- One dashboard skin.

Everything else can remain placeholder until the core feel is proven.

## 11. Audio and Game Feel Plan

Audio should make the ship feel tiny and physical.

Priority sounds:

1. Thruster puff loop or repeated soft one-shot.
2. Brake/stabilizer sound.
3. Gentle collision tap.
4. Crash poof.
5. Dashboard beep/warning.
6. Delivery success jingle.
7. Collectible chime.
8. UI confirm/cancel.

Music:

- Short loop for map/menu.
- Short loop for flight.
- Optional route-specific layers later.

Implementation notes:

- Add global volume settings early.
- Avoid loud alarms.
- Do not tie audio timing to frame rate.
- Add mute support.

Game feel polish:

- Camera follow with slight smoothing.
- Camera shake only for high-speed crash, reduced by reduced-motion setting.
- Speed lines or particles when moving fast.
- Screen-space warning indicator for destination direction.
- Small squash/wobble on ship turn or bump.
- Particle bursts for poof/crash.

## 12. Accessibility and Comfort

Required:

- Cozy Mode toggle.
- Reduced motion toggle.
- Adjustable music and SFX volume.
- Keyboard remapping later if feasible.
- Clear font and high contrast for key UI.
- No tiny essential text.
- No mandatory timers in default mode.
- No harsh fail state.

Cozy Mode changes:

- Lower collision damage.
- Wider docking zones.
- Stronger stabilizer assist.
- Slower moving obstacles.
- More forgiving package condition.
- Optional trajectory/direction hint.

Spicy Mode should wait until the base game is complete.

## 13. Testing and Validation

### Unit Tests

Use Vitest for pure logic:

- Vector math.
- Movement integration.
- Brake force behavior.
- Docking readiness checks.
- Package condition transitions.
- Save migration and validation.
- Mission data validation.

### Browser Smoke Tests

Use Playwright after the game shell exists:

- App loads.
- Title screen renders.
- Start mission enters FlightScene.
- Ship responds to input.
- localStorage save is written after completion.
- Settings persist after reload.
- Build output works from static server.

### Manual Playtest Checklist

For each mission:

- Can a new player understand where to go?
- Can they recover from overshooting?
- Is the docking zone readable?
- Does the dashboard help without cluttering?
- Are crashes funny rather than annoying?
- Does package condition feel gentle?
- Is the route completable in 2-6 minutes?
- Does the NPC payoff land in one or two lines?

## 14. Deployment Plan

### Development

Expected commands:

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
```

### Hosting Options

Best options:

- itch.io HTML5 project.
- Netlify.
- Cloudflare Pages.
- GitHub Pages.

Recommended first release path:

1. Deploy to itch.io as a private/unlisted HTML5 game.
2. Test the exact shared URL on a clean browser profile.
3. Confirm localStorage persists across reloads.
4. Send the link.

### Release Package

Include:

- Built static files.
- Short README for deployment notes.
- Credits/license notes for any third-party assets, fonts, or audio.
- Version number.

## 15. Core Phases

### Phase 0 - Project Foundation

Goal: create the technical skeleton and prove the stack works.

Tasks:

- Initialize Phaser + TypeScript + Vite project.
- Add linting/formatting if desired.
- Add basic scenes: Boot, Preload, Title, Flight.
- Add asset loading placeholders.
- Add resize/scaling configuration.
- Add SaveSystem with versioned localStorage.
- Add Settings model.
- Add debug flag support.
- Add Vitest setup for pure logic.

Deliverables:

- Game boots locally.
- Title scene can enter FlightScene.
- Save system can create/load/reset a save.
- Production build succeeds.

Acceptance criteria:

- `npm run dev` launches the game.
- `npm run build` creates a static build.
- Reloading the page preserves a test save value.

### Phase 1 - Flight Feel Prototype

Goal: make the gyoza ship fun to fly before building content.

Tasks:

- Implement GyozaShip entity.
- Implement custom velocity/thrust/brake/rotation integration.
- Add keyboard input.
- Add debug vectors.
- Add camera follow.
- Add target marker and destination ring.
- Add speed, distance, and alignment readout.
- Add gentle docking readiness checks.
- Add bad-docking bounce.
- Add simple static obstacles.
- Add collision speed detection.
- Add respawn after crash.

Deliverables:

- Empty test field with ship, obstacle, target marker, and restart.
- Movement tuning file.
- First dashboard prototype.

Acceptance criteria:

- Ship movement has clear inertia.
- Braking and counter-thrust are meaningful.
- Destination feedback clearly shows too far, slow down, align, and ready states.
- Crashing is recoverable within 2 seconds.
- Movement is stable across frame rates.

### Phase 2 - Vertical Slice: Tea Moon

Goal: prove the complete player loop with one finished-ish mission.

Tasks:

- Create mission data schema.
- Implement BriefingScene.
- Implement delivery target and generous speed/angle docking checks.
- Add Tea Moon route.
- Add package condition state.
- Add result scene.
- Save mission completion.
- Add one memory reward.
- Add initial audio placeholders.
- Add first pass of gyoza ship art or high-quality placeholder.

Deliverables:

- Playable Tea Moon mission from title/map to result.
- Mission completion persists after reload.
- Basic dashboard gives useful and funny feedback.

Acceptance criteria:

- A player can finish the first delivery without external explanation.
- Delivery result changes based on rough/perfect delivery.
- Restarting the browser shows the mission as completed.

### Phase 3 - Systems Hardening

Goal: make the game easy to expand without rewriting the vertical slice.

Tasks:

- Refactor mission loading into MissionSystem.
- Add typed obstacle and force-zone definitions.
- Add DashboardSystem event routing.
- Add PackageConditionSystem.
- Add pause menu.
- Add settings UI.
- Add save migration guard.
- Add mission data validation tests.

Deliverables:

- New missions can be added mostly through data.
- Settings persist.
- Systems are separated enough for content production.

Acceptance criteria:

- Adding a second mission requires minimal scene code changes.
- Invalid mission data fails a test or logs a clear error.
- Pause/settings work during flight.

### Phase 4 - Asset Pipeline and Visual Identity

Goal: lock the visual language before producing all content.

Tasks:

- Finalize gyoza ship design.
- Define color palette per route.
- Choose sprite dimensions and export workflow.
- Create spritesheet conventions.
- Create dashboard skin.
- Create particle style.
- Create starfield and route background style.
- Add asset naming rules.
- Document asset source files and export paths.

Deliverables:

- Final or near-final gyoza ship.
- Level 1 environment style.
- Dashboard visual style.
- Asset pipeline note.

Acceptance criteria:

- The ship is recognizable at gameplay scale.
- UI remains readable over backgrounds.
- Placeholder assets can be replaced without code changes.

### Phase 5 - Dashboard, Map, and UX Polish

Goal: make the game feel coherent and understandable.

Tasks:

- Build final dashboard layout.
- Add rotating flavor readouts.
- Add reactive warning/status lines.
- Add galaxy map scene.
- Add mission node lock/unlock states.
- Add clear route selection flow.
- Add destination direction indicator.
- Add package condition UI.
- Add settings controls.

Deliverables:

- Usable map-to-mission flow.
- Readable dashboard.
- Settings and pause menus.

Acceptance criteria:

- Player can select missions from map.
- Dashboard communicates speed/docking/package without clutter.
- UI text does not overlap at target desktop sizes.

### Phase 6 - Mission Content Production

Goal: build the remaining campaign missions.

Tasks:

- Implement Asteroid Bento Belt.
- Implement Matcha Nebula Drift.
- Implement Black Hole Bakery.
- Implement Planet "I'm Fine".
- Implement final return-home delivery.
- Add route-specific dashboard line pools.
- Add recipient reactions.
- Add memory rewards.
- Tune each route for 2-6 minute sessions.

Deliverables:

- Full campaign playable end-to-end.
- All missions save completion and unlock correctly.
- Ending can be reached.

Acceptance criteria:

- Complete campaign can be played in one sitting.
- Each mission has a distinct mechanic or emotional purpose.
- No mission requires perfection to progress.

### Phase 7 - Audio and Game Feel Pass

Goal: replace placeholders and make actions satisfying.

Tasks:

- Add final or near-final SFX.
- Add flight and map music loops.
- Add route ambience where useful.
- Add particle effects for thrust, braking, collision, and delivery.
- Add camera smoothing and optional shake.
- Add reduced-motion handling.
- Tune audio mix.

Deliverables:

- Full audio pass.
- Particle and camera polish.
- Settings affect audio and motion.

Acceptance criteria:

- Core actions are readable with sound off and satisfying with sound on.
- No sound is painfully sharp or too loud.
- Reduced motion meaningfully reduces shake/flash effects.

### Phase 8 - Save, Collection, and Personalization

Goal: support the emotional gift angle without bloating the game.

Tasks:

- Add collection/memory screen.
- Add unlocked stickers or dashboard charms.
- Add optional ship cosmetic selection.
- Add personal hidden details.
- Add save export/import if time allows.
- Add credits.

Deliverables:

- Memory collection screen.
- At least one reward per mission.
- Personal details integrated subtly.

Acceptance criteria:

- Rewards are visible and saved.
- Personal content does not interrupt the main game tone.
- Save export/import works if included.

### Phase 9 - QA, Accessibility, and Performance

Goal: prepare for sending the link.

Tasks:

- Test on Chrome, Firefox, Edge, and Safari desktop.
- Test deployed build, not just dev server.
- Test fresh save, continued save, reset save.
- Test keyboard-only flow.
- Test lower laptop resolutions.
- Test audio mute and volume.
- Test reduced motion.
- Check localStorage persistence on the final hosted URL.
- Run unit and smoke tests.
- Fix visual overlap and layout issues.

Deliverables:

- Release candidate build.
- Known issues list.
- Playtest notes.

Acceptance criteria:

- No blocker bugs in the full campaign.
- Game can be completed from a fresh save.
- Refreshing the page does not lose progress.
- Link works from the intended hosting platform.

### Phase 10 - Release

Goal: ship the personal playable link.

Tasks:

- Build production bundle.
- Deploy to chosen host.
- Verify URL.
- Check save behavior on hosted domain.
- Run one final full playthrough.
- Tag release.
- Archive source and build if desired.

Deliverables:

- Final playable URL.
- Versioned release build.
- Short release notes.

Acceptance criteria:

- The intended recipient can open the game from a link and play immediately.
- The first session teaches the controls without outside explanation.
- The ending is reachable.

## 16. Risk Register

### Risk: Movement is not fun

Mitigation:

- Build movement first.
- Delay content expansion until movement feels good.
- Add debug tuning controls during development.

### Risk: Scope grows too large

Mitigation:

- Commit to 5 missions plus ending.
- Keep mission mechanics simple.
- Avoid procedural systems and inventory.

### Risk: Art production blocks progress

Mitigation:

- Prototype with placeholders.
- Finalize gyoza ship first.
- Use reusable background and obstacle components.

### Risk: Browser save expectations are misunderstood

Mitigation:

- Clearly treat localStorage as same-browser/same-domain progress.
- Add export/import if the recipient may switch devices.

### Risk: Dashboard becomes cluttered

Mitigation:

- Separate critical readouts from rotating flavor text.
- Keep only 3-5 essential indicators visible at once.

### Risk: Tone becomes too direct or preachy

Mitigation:

- Keep dialogue short.
- Lead with jokes and specificity.
- Use emotional warmth through situation and reaction, not lectures.

## 17. Recommended Immediate Next Steps

1. Initialize the Phaser + TypeScript + Vite project.
2. Add the base scene flow and save system.
3. Build the flight-feel prototype with placeholder graphics.
4. Tune movement until basic flying is enjoyable.
5. Build Tea Moon as the vertical slice.
6. Only then commit to full asset production.

The first milestone should be "flying the gyoza feels good." Every later system depends on that.
