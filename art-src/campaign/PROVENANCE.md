# Campaign art provenance (Phase 3)

Date: 2026-10-03. Generator: Codex image generation via the codex-companion runtime (`task --write --model gpt-6.1-sol --effort medium`), one job per group. Normalization was done on the Claude side with Python and Pillow (`tools/art/campaign_finalize.py`, which calls `tools/art/pixelize.py`).

Raw generations are kept locally only, under `art-src/campaign/<group>/raw/`, which is gitignored. The Stage-A placeholders (`tools/art/campaign_placeholders.py`) are backed up locally in `art-src/campaign/_work/placeholders/`.

Style references shown to Codex with view_image:
- `public/assets/ship/gyoza-idle.png`
- `public/assets/celestial/tea-moon.png`
- `public/assets/characters/rabbit-portrait.png`
- `public/assets/lunar/lunar-sky.png`
- `public/assets/lunar/lunar-hills-far.png`
- `public/assets/items/tea.png` and `public/assets/items/mochi.png` (items group only)
- `public/assets/space/nebula.png` and `public/assets/lunar/lunar-pad.png` (space group only)

## Prompts

Every prompt is the shared preamble `art-src/campaign/_common.txt` followed by the group prompt in `art-src/campaign/<group>/scripts/prompt.txt`. The concatenated file sent to Codex is `scripts/full-prompt.txt`.

| Group | Codex job | Raw images | Production outputs (`public/assets/campaign/`) |
| --- | --- | --- | --- |
| destinations | task-murtgdo0-d5t43f | 5 | `destination-{bento,matcha,bakery,im-fine,home}.png` (160×160) |
| characters | task-murtgeqt-cliphe | 8 | `portrait-{mallow,nori,pip,iona}.png` (48×48 × 2 frames: idle, welcome) |
| items | task-murtgg07-uyw40d | 12 | `cargo.png` (32×32 × 5), `postcards.png` (48×32 × 5), `pickups.png` (16×16 × 2) |
| landing | task-murtghe6-obrzsn | 10 | `landing-sky-<theme>.png` (640×360, opaque), `landing-hills-<theme>.png` (640×96) |
| space | task-murtgix2-49cweq | 8 | `nebula-<theme>.png` (640×360, soft alpha), `windsock.png` (24×32 × 4), `flow-arrow.png` (24×16), `berth-tiles.png` (32×24 × 3) |

Deviations Codex reported:
- The magenta backgrounds vary slightly instead of being exact `#FF00FF`. This is handled by the pixelize chroma key at tolerance 60.
- The skies and nebulae came out at about 16:9 (1672×941), and the hill, windsock and berth strips at about 3:1 (2172×724). These are handled by cover-fit to the target size.
- Paired portrait frames differ slightly in shading.
- Tiling seams and windsock pole alignment are approximate.

## Normalization

Every command run is recorded in `art-src/campaign/<group>/scripts/normalize-log.txt`. To reproduce:

```bash
python tools/art/campaign_finalize.py
```

Strips that came out as one wide image are split by `split_cells` into equal cells under `art-src/campaign/_work/` before they are packed into sheets. The windsock is split into 4 cells and the berth into 3 thirds.

`fog.png` is still the Stage-A placeholder. Since critic round 2, flight renders matcha fog as code-drawn soft patches and no longer reads this texture.

## Manual edits

None.
