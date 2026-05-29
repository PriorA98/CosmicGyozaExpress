# Reference Asset Library

This directory contains normalized copies of reusable PNG assets from the raw design handoff.

These files are reference assets, not final production asset paths. When the Phaser project is initialized, copy optimized production versions into `public/assets/`.

## Directories

- `gyoza-ship/`
  - Idle, flight, and damage frames for the gyoza ship.
- `planets/`
  - Ten 1280x1280 planet images from the prototype.
- `screenshots/`
  - Prototype screenshots for visual comparison.

## Notes

- Keep `references/design-handoff/` as the raw source archive.
- Keep this directory clean and implementation-oriented.
- Do not use the duplicate `uploads/` folder from the raw handoff as a production source.
