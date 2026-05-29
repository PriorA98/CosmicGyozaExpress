# Design Handoff Reference

This directory stores the raw exported handoff from Claude Design.

## Contents

- `Gyoza Animation Handoff.zip`
  - Original archive as received.
- `gyoza-animation/`
  - Extracted prototype project.
- `gyoza-animation/README.md`
  - Original handoff instructions.
- `gyoza-animation/project/Gyoza UI System.html`
  - Primary UI system reference.
- `gyoza-animation/project/colors_and_type.css`
  - Prototype color, typography, spacing, radius, shadow, and motion tokens.
- `gyoza-animation/project/*.jsx`
  - Prototype-only React/Babel component artboards.
- `gyoza-animation/project/Gyoza Delivery.html`
  - Embedded live HUD and delivery shell reference.
- `gyoza-animation/project/Gyoza Ship.html`
  - Ship movement and HUD prototype reference.
- `gyoza-animation/project/Gyoza Animation Sheet.html`
  - Sprite animation reference sheet.

## Usage Policy

Do not edit these raw files for production implementation. Treat this directory as source evidence.

Production code should use:

- `../../docs/design/design-system.md` for official visual direction.
- `../../docs/design/ui-reference.md` for screen mapping.
- `../../docs/assets/asset-inventory.md` for asset usage and optimization notes.
- `../../assets/reference/` for normalized reference copies of reusable PNG assets.
