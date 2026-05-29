# Frontend Integration Notes

Last updated: 2026-05-29 JST

Locked stack:

- Phaser
- TypeScript
- Vite
- localStorage

Design source:

- `references/design-handoff/gyoza-animation/project/Gyoza UI System.html`

## 1. Architecture Decision

Use a hybrid frontend architecture:

- Phaser renders the flight/game world.
- TypeScript owns game state, mission data, save data, and scene orchestration.
- HTML/CSS can render high-text UI surfaces such as title, map, briefing, pause/settings, result, memories, and ending.
- Live flight HUD can be Phaser-rendered or DOM-rendered, but it must not interfere with gameplay input.

This keeps the locked stack intact. The prototype's React/Babel files are design medium only; React is not required for production.

## 2. Why Hybrid UI Is Recommended

The prototype's strongest UI ideas depend on:

- Rich text layout.
- Web fonts.
- CSS cards and panels.
- Modal surfaces.
- Form controls for settings.
- Accessible buttons.
- LocalStorage-driven settings.

HTML/CSS is better for those surfaces than drawing every label manually in Phaser. Phaser should focus on the moving game: ship, planets, hazards, particles, docking, camera, and audio timing.

## 3. Proposed Implementation Structure

When the Phaser project is initialized, extend the planned structure with:

```text
src/
  styles/
    tokens.css
    base.css
    components.css
    screens.css
  dom-ui/
    DomRoot.ts
    ScreenRouter.ts
    TitleScreen.ts
    GalaxyMapScreen.ts
    BriefingScreen.ts
    PauseScreen.ts
    SettingsScreen.ts
    ResultScreen.ts
    MemoriesScreen.ts
    EndingScreen.ts
    HudOverlay.ts
  game/
    designTokens.ts
    events.ts
public/
  assets/
    ship/
    planets/
    ui/
    fonts/
```

If the first implementation keeps UI fully in Phaser, still create `designTokens.ts` so colors, fonts, and spacing are not scattered across scenes.

## 4. Event Bridge

Use a small typed event bridge between Phaser and DOM UI.

Example events:

```ts
type GameEvent =
  | { type: "mission:selected"; missionId: string }
  | { type: "mission:start"; missionId: string }
  | { type: "flight:pause" }
  | { type: "flight:resume" }
  | { type: "flight:hud-update"; hud: FlightHudState }
  | { type: "flight:crashed"; summary: CrashSummary }
  | { type: "mission:completed"; result: MissionResult }
  | { type: "settings:changed"; settings: SettingsState };
```

Rules:

- Phaser owns real-time gameplay state.
- DOM UI owns menu focus and form interactions.
- SaveSystem is shared TypeScript logic, not DOM-only or Phaser-only.
- Avoid circular references between scenes and UI components.

## 5. Design Token Translation

Convert prototype CSS variables into production tokens.

Recommended files:

- `src/styles/tokens.css` for DOM UI.
- `src/game/designTokens.ts` for Phaser rendering.

Example:

```ts
export const colors = {
  ink: "#1D1F33",
  cosmos: "#1A1B2E",
  cosmosDeep: "#0E0F1C",
  parchment: "#F4ECDC",
  parchmentWarm: "#F9F3E5",
  plaster: "#FBF7EC",
  terracotta: "#C97B5A",
  ember: "#E08A4B",
  sage: "#8DA17A",
};
```

Keep semantic aliases:

```ts
export const semanticColors = {
  canvasBg: colors.cosmos,
  panelDark: "rgba(20,22,38,0.78)",
  panelLight: colors.parchmentWarm,
  actionPrimary: colors.terracotta,
  stateDelivered: colors.sage,
};
```

## 6. Production Screen Translation

### Title

DOM recommended.

Responsibilities:

- Start/continue.
- Settings.
- Credits.
- Optional free drift.

Phaser can run a passive background scene behind it if desired, but first implementation can use CSS backgrounds and static assets.

### Galaxy Map

DOM or Phaser are both viable.

Recommendation:

- Use DOM/SVG if map nodes are mostly UI selection.
- Use Phaser if animated route paths, parallax, or in-map ship movement becomes important.

Initial choice:

- DOM/SVG map with planet image nodes and typed mission data.

### Briefing

DOM recommended.

Responsibilities:

- Display mission request.
- Display delivery item.
- Display hazards.
- Launch mission.

### Flight

Phaser required.

Responsibilities:

- Ship movement.
- Collision and docking.
- Particles.
- Stars, planets, hazards, force zones.
- Audio reactions.

HUD options:

- Phaser HUD for lowest latency and easier canvas screenshots.
- DOM HUD for easier text layout and CSS reuse.

Initial recommendation:

- Start with Phaser HUD for minimal integration.
- Move high-text dashboard panels to DOM if Phaser text layout becomes slow to iterate.

### Pause, Settings, Result, Memories, Ending

DOM recommended.

Reasons:

- Text-heavy.
- Button/form-heavy.
- Easier keyboard focus management.
- Easier localStorage settings controls.

## 7. Input Management

Potential issue:

- DOM buttons and Phaser keyboard controls can fight for focus.

Rules:

- When DOM modal/menu is open, Phaser input should pause or ignore gameplay keys.
- When FlightScene is active, keyboard focus should return to the game container.
- `Esc` should route to pause/resume consistently.
- Gamepad support should be owned by Phaser first.

## 8. Asset Integration

Reference assets are currently stored in:

- `assets/reference/gyoza-ship/`
- `assets/reference/planets/`

Production steps:

1. Copy selected assets into `public/assets/`.
2. Optimize large planet images.
3. Normalize ship frame canvas size or define exact frame origins.
4. Create Phaser preload keys.
5. Document every asset key in a manifest.

Do not load from:

- `references/design-handoff/`
- `references/design-handoff/gyoza-animation/project/uploads/`

## 9. Save Integration

localStorage remains the official save path.

Design UI should expose:

- Continue/new game.
- Settings.
- Reset save, behind a confirmation.
- Export/import save later.

Save state should not store visual-only DOM state unless it affects gameplay or player settings.

## 10. Prototype Mechanics Not To Copy

Do not copy these directly:

- Screen-direction acceleration as final movement.
- Currency counters.
- Pantry inventory.
- Topping upgrades.
- Large campaign counters.
- Prototype-only route names.

Useful prototype mechanics to adapt:

- Soft speed cap.
- Frame-rate-independent movement update.
- Twinkling stars.
- Asteroid drift.
- Radar visualization.
- Docking prompt when near target and slow enough.
- Short delivery sequence transition.
- Quick respawn after incident.

## 11. Implementation Acceptance Criteria

The design system is correctly integrated when:

- The title, map, briefing, flight HUD, result, pause, and ending visually belong to the same system.
- The gyoza ship asset is central and pixel-crisp.
- Dark gameplay surfaces and parchment UI surfaces are both present.
- Dashboard readouts are readable at desktop browser sizes.
- Prototype-only systems are absent from MVP unless explicitly re-approved.
- localStorage save and settings work across reloads on the hosted URL.
- Reduced motion and audio settings are respected.
