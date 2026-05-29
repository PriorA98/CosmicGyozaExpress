# Cosmic Gyoza Express Design System

Last updated: 2026-05-29 JST

Source reference: `references/design-handoff/gyoza-animation/project/Gyoza UI System.html`

This document officializes the reusable visual language from the prototype handoff. The prototype is a style reference, not a gameplay contract. The actual game plan remains the small handcrafted delivery game described in the concept document and implementation plan.

## 1. Design Intent

The interface should feel like a tiny food-delivery spacecraft instrument panel wrapped in cozy stationery. The main game canvas can be deep space, but the surrounding UI should feel warm, handmade, readable, and slightly silly.

Core traits:

- Cozy cosmos, not cold sci-fi.
- Warm parchment UI over deep navy playfields.
- Pixel art details without making the whole game visually noisy.
- Small-radius panels and crisp borders.
- Terracotta and ember actions.
- Monospace flight readouts.
- Display-font NPC warmth.
- Soft failure states with no shame language.

## 2. Brand Direction

Official game title:

- `Cosmic Gyoza Express`

Prototype title references:

- `gyoza galaxy delivery`
- `delivery gyoza`
- `gyoza ship`

Use prototype titles only as visual references. The production title should stay `Cosmic Gyoza Express` unless a later product decision changes it.

Brand mark direction:

- Gyoza ship is the primary mark.
- Pixel or pixel-adjacent rendering is preferred for the ship.
- The mark should work on both deep-cosmos backgrounds and parchment UI surfaces.
- The ship should stay readable at small HUD size around 28-36 px and expressive at title-screen size around 140-180 px.

Preferred brand tone:

- Lowercase labels for ordinary UI.
- Short, warm copy.
- Technical readouts that sound precise but remain playful.
- No moralized food, body, or discipline language.

## 3. Color System

The prototype defines a strong warm-cosmos palette. These values should become production design tokens.

### Cosmos And Ink

Use these for game canvas, cockpit panels, map backgrounds, outlines, and text.

| Token | Hex | Usage |
| --- | --- | --- |
| `ink` | `#1D1F33` | Primary text, outlines, pixel borders |
| `cosmos` | `#1A1B2E` | Main deep-space canvas |
| `ink-soft` | `#2F3149` | Secondary dark surfaces |
| `cosmos-deep` | `#0E0F1C` | Deep cockpit/radar areas |
| `cosmos-panel` | `#14162B` | Dashboard panels |
| `slate-700` | `#3D3E4D` | Dark widget surfaces |

### Parchment Surfaces

Use these for menus, cards, side rails, result screens, collection screens, and modals.

| Token | Hex | Usage |
| --- | --- | --- |
| `parchment` | `#F4ECDC` | Main warm page background |
| `parchment-deep` | `#ECDFC5` | Recessed panels and dividers |
| `parchment-warm` | `#F9F3E5` | Primary cards and modals |
| `plaster` | `#FBF7EC` | Highest light, text on dark |
| `wallpaper` | `#E8D9BD` | Secondary warm bands |

### Actions And Accents

Use accent colors sparingly. The UI should not become a one-color orange interface.

| Token | Hex | Usage |
| --- | --- | --- |
| `terracotta` | `#C97B5A` | Primary action buttons, active alerts |
| `terracotta-deep` | `#A6614A` | Button pressed/shadow state |
| `ember` | `#E08A4B` | Prompt, active route, warning warmth |
| `amber` | `#D4A055` | Food, note, route detail accents |
| `sage` | `#8DA17A` | Safe, delivered, cozy state |
| `sage-deep` | `#6B7E5A` | Text on sage-soft |
| `dusk-blue` | `#9EB6C4` | Radar/info accents |
| `plum` | `#9B8FB8` | Thinking, side content, nebula warmth |
| `teal` | `#6FA39A` | Drift, signal, secondary NPC accents |
| `brick` | `#C26954` | Soft crash/error state |

### State Colors

Production state pills should use the prototype semantics, renamed to game states:

| State | Background | Foreground | Dot |
| --- | --- | --- | --- |
| Idle | `#C2CFAE` | `#6B7E5A` | `#8DA17A` |
| Flying | `#C6DCC2` | `#2E5232` | `#5A8B5E` |
| Docking | `#F2C49A` | `#7A4017` | `#E08A4B` |
| Delivering | `#C7BEDE` | `#5E4F7A` | `#9B8FB8` |
| Gyoza Incident | `#E5B0A2` | `#7A2E1F` | `#C26954` |
| Sleeping/Home | `#DDDCE2` | `#5A5C70` | `#76747F` |

## 4. Typography

Prototype font roles:

| Role | Prototype Font | Production Usage |
| --- | --- | --- |
| Display | Bricolage Grotesque | Title, screen headings, NPC speech emphasis |
| UI body | Geist | Menus, body text, labels |
| Mono | JetBrains Mono | Instrument readouts, coordinates, keycaps, dashboard copy |
| Pixel | Silkscreen | Small badges, cockpit buttons, route stamps |

Production recommendation:

- Use web fonts only if they are self-hosted or reliably loaded during preload.
- Keep fallback stacks for every role.
- Do not render essential gameplay text at tiny sizes.
- Preserve lowercase UI style for labels and button text, except pixel labels that intentionally use uppercase.

Official type scale:

| Token | Size | Usage |
| --- | --- | --- |
| `xs` | 11px | Meta labels, keycaps, badges |
| `sm` | 13px | Small body, compact controls |
| `base` | 14px | Default UI |
| `md` | 16px | Dialogue/body emphasis |
| `lg` | 20px | Card titles |
| `xl` | 26px | Panel titles |
| `2xl` | 34px | Screen section title |
| `3xl` | 48px | Large display |

Title screens may exceed this scale when the title is the first-viewport focus. Compact panels should not use hero-scale typography.

## 5. Layout And Surfaces

Preferred screen size reference:

- 1280x720 for full UI layouts.
- 16:9 responsive scaling for desktop browser.
- 800x600 was used in prototypes for internal canvas experiments, but production should not be locked to that size.

Surface rules:

- Use deep-cosmos backgrounds for title, galaxy map, flight, cockpit, crash, success, and ending.
- Use parchment backgrounds for collection, settings, result cards, modals, side panels, and briefing content.
- Use dark translucent panels over gameplay only when they contain live HUD data.
- Avoid large nested cards. Use a panel plus internal rows instead.
- Keep default card radius at 8px or below unless using a larger modal shell.
- Pixel-style buttons may use square corners and hard ink shadows.

Panel styles:

| Surface | Background | Border | Radius | Usage |
| --- | --- | --- | --- | --- |
| Parchment card | `parchment-warm` | `#D7CDB5` | 8px | Requests, result cards, memory cards |
| Recessed panel | `parchment-deep` | `#D7CDB5` | 5px | Side rail areas, stat groups |
| Dark HUD panel | `rgba(20,22,38,0.78)` | `rgba(247,240,220,0.18)` | 8px | Flight HUD, cockpit widgets |
| Pixel action | `terracotta` | `ink` | 0 | Main launch/start buttons |

## 6. Components

### Buttons

Primary buttons:

- Terracotta fill.
- Deep terracotta border/shadow.
- Mono or pixel font depending on context.
- Use for start, launch, accept, continue, retry.

Secondary buttons:

- Parchment surface.
- Warm border.
- Mono text.
- Use for map, log, settings, back.

Ink buttons:

- Dark ink fill.
- Light text.
- Compact icon plus label.
- Use for top bars and utility commands.

Pixel buttons:

- Square corners.
- 2px ink border.
- Hard 3px shadow.
- Use sparingly for high-emphasis cockpit/game actions.

### Keycaps

Use small mono keycaps with:

- Light surface.
- Ink or strong warm border.
- Slightly heavier bottom border.
- Fixed height around 24-28 px.

### State Pills

State pills should be compact, mono, and include a small colored dot. Copy should stay gentle:

- `idle`
- `flying`
- `docking`
- `delivering`
- `gyoza incident`
- `home`

Avoid harsh labels like `failure`, `bad`, or `dead`.

### Dashboard Widgets

Official widget set:

- Velocity.
- Heading.
- Drift angle.
- Distance to destination.
- Docking readiness.
- Package condition.
- Sauce/fuel meter if fuel remains in scope.
- Flavor readout.
- Dashboard chatter.

Visual rules:

- Dark HUD panels.
- Mono labels.
- Ember/sage meter accents.
- Low-contrast divider lines.
- Keep essential readouts stable in position.
- Flavor readouts rotate slowly and never replace critical data.

### Galaxy Map Nodes

Map nodes should use:

- Planet image or station icon.
- Thin status ring.
- Small label.
- Status badge.

Node states:

- Hub.
- Open.
- Active.
- Delivered.
- Locked.
- Side/optional, if optional routes are included.

The prototype's map layout can inspire the map composition, but mission count and location names must follow the game plan.

### NPC Portraits

Prototype portraits use colored square monograms with a small mood dot. This can be used as a low-cost production pattern before final character art exists.

Rules:

- 48px compact portrait for cards.
- 64-76px portrait for dialogue.
- Display-font monogram or simple glyph.
- Background color should reflect character/route mood.
- Mood badge should be subtle and warm.

### Dialogue And Comm Panels

NPC voice:

- Display font.
- Italic allowed.
- Warm parchment panel.
- Short lines.

Dashboard voice:

- Mono font.
- Dark panel.
- Prefix with small indicator or prompt mark.
- Short, technical, lightly funny.

## 7. Iconography

The prototype icon set uses 6x6 pixel-grid glyphs. Production can implement these as:

- Tiny sprites.
- Phaser-generated textures.
- SVG converted to PNG sprites.
- Bitmap-font-like pixel icons.

Icon roles:

- Thrust.
- Fuel/sauce.
- Package.
- Radar.
- Speed.
- Drift.
- Crash/incident.
- Star/memory.
- Soup.
- Moon.
- Cake.
- Blanket.
- Note.
- Cocoa.
- Pause/play/settings/home.

Do not add generic icon filler when a game-specific icon would be clearer.

## 8. Motion

Motion should be calm and tactile.

Prototype timing tokens:

- Fast: 120ms.
- Base: 200ms.
- Slow: 320ms.
- Breath/idle: 2400ms.
- Pixel animation can use stepped timing.

Production rules:

- Reduced motion must disable or soften camera shake, blinking, and heavy pulsing.
- Warnings should pulse gently, not flash aggressively.
- Crash animation should be comedic and short.
- UI transitions should not block input longer than needed.

## 9. Screen Design Direction

Production screen set:

- Title.
- Galaxy map.
- Mission briefing.
- Flight HUD.
- Pause/settings.
- Delivery result.
- Memories/collection.
- Ending.

Prototype screens may visually inspire all of these, but the final content must follow the actual campaign plan: Tea Moon, Asteroid Bento Belt, Matcha Nebula, Black Hole Bakery, Planet "I'm Fine", and the final package.

## 10. Design Do And Do Not

Do:

- Keep the gyoza ship visually central.
- Use parchment UI to warm up dark space scenes.
- Use mono readouts for real gameplay information.
- Use small pixel accents for identity.
- Keep labels compact and readable.
- Keep failures funny and recoverable.

Do not:

- Promote prototype economy, pantry, or upgrade systems into MVP scope.
- Use diet, calorie, body, restriction, or moralized scoring language.
- Depend on long dialogue.
- Use giant card-heavy marketing layouts.
- Let decorative UI obscure hazards or docking information.
- Treat the prototype movement model as the official physics model.

## 11. Production Token Names

Recommended future implementation files:

- `src/styles/tokens.css`
- `src/styles/components.css`
- `src/game/designTokens.ts`

Use semantic names in code:

- `color.bg.canvas`
- `color.bg.surface`
- `color.fg.primary`
- `color.fg.inverse`
- `color.action.primary`
- `color.state.flying`
- `color.state.docking`
- `radius.card`
- `radius.button`
- `shadow.pixel`
- `font.display`
- `font.ui`
- `font.mono`
- `font.pixel`

Avoid scattering raw hex values across gameplay code.
