# UI Prototype Reference Analysis

Last updated: 2026-05-29 JST

Primary source: `references/design-handoff/gyoza-animation/project/Gyoza UI System.html`

The handoff is a design prototype. It should guide style, component language, asset usage, and screen mood. It should not override the locked game structure or mechanics.

## 1. Source Files Read

Raw handoff files reviewed:

- `references/design-handoff/gyoza-animation/README.md`
- `references/design-handoff/gyoza-animation/project/Gyoza UI System.html`
- `references/design-handoff/gyoza-animation/project/colors_and_type.css`
- `references/design-handoff/gyoza-animation/project/design-canvas.jsx`
- `references/design-handoff/gyoza-animation/project/gyoza-primitives.jsx`
- `references/design-handoff/gyoza-animation/project/gyoza-foundations.jsx`
- `references/design-handoff/gyoza-animation/project/gyoza-components.jsx`
- `references/design-handoff/gyoza-animation/project/gyoza-screens.jsx`
- `references/design-handoff/gyoza-animation/project/Gyoza Delivery.html`
- `references/design-handoff/gyoza-animation/project/game-delivery.js`
- `references/design-handoff/gyoza-animation/project/Gyoza Ship.html`
- `references/design-handoff/gyoza-animation/project/game.js`
- `references/design-handoff/gyoza-animation/project/Gyoza Animation Sheet.html`

## 2. Primary Takeaways

Adopt:

- Warm parchment UI over deep-cosmos gameplay.
- Gyoza ship as brand mark and primary character.
- Pixel art assets with no smoothing.
- Mono technical dashboard readouts.
- Display-font warmth for NPC/dialogue text.
- Compact HUD panels with translucent dark backgrounds.
- Galaxy-map nodes using planet art, status rings, labels, and small badges.
- Delivery result language that accepts imperfect outcomes warmly.
- Crash/respawn screen treatment as a gentle "gyoza incident."

Adapt:

- Prototype title should become `Cosmic Gyoza Express`.
- Prototype route names should be replaced with planned mission names.
- Prototype right-rail HUD can inform dashboard layout, but pantry/topping content should not be included in MVP.
- Prototype mode-select screen can become settings options rather than a required first-run blocker.
- Prototype memory collection can be reduced to one memory reward per main mission.
- Prototype map can be reduced to five delivery nodes plus ending route.

Do not adopt as game requirements:

- Coins or route currency.
- Pantry inventory.
- Upgrade/topping mechanics that affect stats.
- 24 deliveries.
- 60 memories.
- Prototype NPC/location names as locked canon.
- Prototype directional movement as the official ship model.
- React/Babel runtime from the prototype.

## 3. Artboard Mapping

The UI system contains 22 artboards. Their production interpretation is below.

| Prototype Artboard | Production Use |
| --- | --- |
| 01 brand mark | Use as brand direction, but title becomes `Cosmic Gyoza Express`. |
| 02 palette | Adopt as official palette with semantic token names. |
| 03 typography | Adopt font roles and scale, with self-hosting/fallback review. |
| 04 iconography | Adopt pixel-icon style; implement as sprites or generated textures. |
| 05 buttons and inputs | Adopt component patterns. Use lowercase UI labels. |
| 06 state pills | Adopt, renamed to game states. |
| 07 NPC portraits | Adopt as placeholder/final-lite character portrait system. |
| 08 dashboard widgets | Adopt as main cockpit/dashboard reference. |
| 09 galaxy map nodes | Adopt for map node style. |
| 10 cards | Adopt request, mission, and memory card patterns. |
| 11 comm and dialog | Adopt NPC/dashboard voice separation. |
| 12 title screen | Adapt layout and mood. Use official title. |
| 13 mode select | Defer or fold into settings. Cozy Mode can default without blocking play. |
| 14 galaxy map | Adapt visual layout. Replace prototype mission count and names. |
| 15 mission briefing | Adopt modal pattern and content structure. |
| 16 gameplay HUD | Use as HUD/shell reference, not as exact gameplay scope. |
| 17 cockpit dashboard | Adopt widget language. Use only critical widgets in live flight. |
| 18 crash and respawn | Adopt tone and visual direction. |
| 19 delivery success | Adopt report tone. Remove currency unless later approved. |
| 20 memories collection | Adapt as smaller memory collection. |
| 21 pause menu | Adopt compact left-panel structure. |
| 22 ending | Adopt quiet emotional composition and final dashboard joke style. |

## 4. Production Screen Specs

### Title Screen

Reference:

- Artboard 12.

Production direction:

- Dark cozy-cosmos background.
- Large gyoza ship and title.
- Primary CTA: `start delivery` or `continue`.
- Secondary: settings, credits, free drift if included.
- Keep first screen playable/product-focused, not a marketing page.

Required changes:

- Use `Cosmic Gyoza Express`.
- Avoid version/content claims that are not real.

### Galaxy Map

Reference:

- Artboards 09 and 14.

Production direction:

- Sticker-book star map.
- Hand-placed nodes.
- Status rings for hub, open, active, delivered, locked.
- Right-side mission preview can be used if it does not clutter the map.

Required changes:

- Use campaign route names from the game plan.
- Remove currency and inflated progress counters from MVP.

### Mission Briefing

Reference:

- Artboard 15.

Production direction:

- Parchment modal over dimmed map/cosmos.
- Left rail: destination and mission metadata.
- Right panel: request, delivery item, hazards, launch action.
- Short NPC request text.

Required changes:

- Use actual mission data schema.
- Keep hazards to the route mechanics planned for that mission.

### Flight HUD

Reference:

- Artboard 16, `Gyoza Delivery.html`, `Gyoza Ship.html`.

Production direction:

- Phaser canvas is the main stage.
- Overlay only essential live data:
  - current delivery.
  - speed.
  - heading.
  - distance/radar.
  - package condition.
  - docking prompt.
  - dashboard line.
- Keep the active play area clean.

Required changes:

- Do not include pantry/topping panels in MVP.
- Do not copy the prototype input model. The production ship uses facing direction, thrust, braking, and inertia.

### Cockpit Dashboard

Reference:

- Artboards 08 and 17.

Production direction:

- Use as expanded dashboard/pause detail view, or as a lower HUD panel in simplified form.
- Critical live widgets must be visible but not overwhelming.
- Flavor readouts are secondary.

Required changes:

- Prioritize speed, distance, docking, package condition, and warning/chatter over decorative data.

### Crash And Respawn

Reference:

- Artboard 18.

Production direction:

- Dark-cosmos scene with warm incident glow.
- Gyoza damage frames, steam, crumbs, or soft particle poof.
- Short message.
- Retry action.
- Option to return to map.

Required changes:

- Keep respawn time short.
- Avoid terms that feel punitive.

### Delivery Success

Reference:

- Artboard 19.

Production direction:

- Warm success panel.
- NPC reaction.
- Delivery report label such as `smooth delivery`, `chaotic delivery`, or `cozy success`.
- Memory reward.
- Next delivery/map actions.

Required changes:

- Remove coins/bonus unless a later reward system is approved.
- Package condition should change flavor, not gate progress.

### Memories Collection

Reference:

- Artboard 20.

Production direction:

- Parchment scrapbook.
- Small cards with NPC notes, stickers, postcards, or recipe cards.
- Low-pressure completion language.

Required changes:

- Scale to campaign count. Start with one reward per mission.

### Pause And Settings

Reference:

- Artboard 21.

Production direction:

- Left-side parchment pause panel over dimmed gameplay.
- Resume, galaxy map, memories, settings, title.
- Include audio, reduced motion, and Cozy Mode settings.

Required changes:

- Remove menu items that imply unapproved systems.

### Ending

Reference:

- Artboard 22.

Production direction:

- Quiet dark-space scene.
- Centered gyoza ship.
- Incoming package addressed to ship.
- Thank-you notes/memories implied.
- Final dashboard joke after emotional beat.

Required changes:

- Ending requirements should be completing main missions, not total collection completion.

## 5. Mechanics Reference Caveat

The prototype JavaScript demonstrates useful visual and UI behavior, but not the final movement model.

Prototype movement:

- WASD/arrows apply acceleration in screen/world direction.
- Ship rotates toward input direction.
- Drag and soft speed cap are applied.

Production movement:

- Player rotates the ship.
- Thrust applies acceleration in the ship-facing direction.
- Velocity persists.
- Braking/counter-thrust matters.
- Docking uses speed and optional facing checks.

Use prototype values as rough feel references only. The official model is defined in `docs/implementation/implementation-plan.md`.

## 6. Copy And Tone Reference

Adopt:

- Lowercase labels.
- Short NPC lines.
- Technical but warm dashboard voice.
- Funny, low-stakes failure language.
- Food as comfort and care.

Avoid:

- Long monologues.
- Therapy-coded direct lessons.
- Food guilt.
- Harsh scoring.
- Content that makes the player responsible for fixing every NPC.

## 7. Official Reference Priority

When documents conflict, use this order:

1. `Cosmic Gyoza Express.md` for game intent and emotional boundaries.
2. `docs/implementation/implementation-plan.md` for technical scope and production phases.
3. `docs/design/design-system.md` for visual design decisions.
4. `docs/design/ui-reference.md` for how to interpret the handoff.
5. Raw files in `references/design-handoff/` for source inspection only.
