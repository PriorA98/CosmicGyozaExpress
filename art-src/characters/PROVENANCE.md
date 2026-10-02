# Characters: provenance

Date: 2026-10-01. Character: the Sleepy Moon Rabbit (the Tea Moon recipient).
Production files live in `public/assets/characters/`. Raw generations are in `raw/` and build scripts in `scripts/`.
Both production PNGs are fully rebuilt by the scripts, with no manual pixel edits outside them.

| Output | Size / frames | Source | Build |
| --- | --- | --- | --- |
| `rabbit-portrait.png` | 192x64, 3 frames of 64x64 (idle, blink, happy) | Codex image_gen (codex-cli 0.159.3) + scripted face repaint | `python art-src/characters/scripts/build_portrait.py` |
| `rabbit-sprite.png` | 96x32, 4 frames of 24x32 (idle, breath, wave1, wave2) | Pixel-authored in Python/Pillow, designed from the Codex body raws | `python art-src/characters/scripts/build_sprite.py` |

Both files use binary alpha (0/255) and a transparent background. The portrait has 44 colours (wave 2: extra darkened rim shades on the mirrored ear) and the sprite has 18. Sizes: portrait 5.6 KB, sprite 1.4 KB.

## Codex dispatches (image_gen, magenta #FF00FF background)

### Dispatch 1: job task-mup3efwm-yr4va5 (session 01a0f5ee-98f5-7963-9d3b-bf191629ca58)
Raw files: `raw/rabbit-portrait-v1.png`, `raw/rabbit-body-idle-v1.png`, `raw/rabbit-body-wave-v1.png`

Prompt (abridged):
> STEP 1: view_image gyoza-idle.png, gyoza-fly-02.png and asteroid-probe.png, then match their rendering, outline weight and warmth.
> STEP 2: Make 3 separate images. The Sleepy Moon Rabbit: a cream-white (#F9F3E5 / #ECDFC5 shading) rabbit with one ear upright and the other droopy, sleepy kind half-lidded eyes, small pink blush, a small knitted terracotta (#C97B5A) scarf, and a little teal (#6FA39A) teacup with a wisp of steam. Warm, gentle, drowsy, never cold sci-fi. Chunky pixel art, limited palette, ink #1D1F33 outline. Solid flat magenta #FF00FF background, one centred subject, generous margin, no text, ground or shadow.
> A 'rabbit-portrait': a head-and-shoulders bust holding the teacup, to be downscaled to 64x64.
> B 'rabbit-body-idle': a tiny chibi full body with the cup in both paws, for about 22x30.
> C 'rabbit-body-wave': the same chibi raising one paw to wave.
> STEP 3: Copy the images to art-src/characters/raw/<name>-v1.png.

Iteration notes: the v1 portrait read as smug, with asymmetric eyes, spiky cheek tufts and a cramped crop, so it was rejected. The body raws were good design references, but downscaling them to 24x32 turned them to mush, so they were used only as references for the hand-authored sprite.

### Dispatch 2: job task-mup3l4j4-9dcafo (session 01a0f5f3-6d03-7ea3-b09e-700046b04d4d)
Raw files: `raw/rabbit-portrait-v2.png` (frame 0 base) and `raw/rabbit-portrait-happy-v2.png` (a Codex image edit of v2)

Prompt (abridged):
> view_image gyoza-idle.png, asteroid-probe.png and rabbit-portrait-v1.png (the previous attempt). Generate 'rabbit-portrait-v2'. Keep the cream fur, the upright left ear with pink inner ear, the droopy right ear, the chunky terracotta scarf and the teal teacup in both paws. FIX: the expression must be sleepy and kind, not smug, with symmetric heavy half-closed lids, small dark pupils, a soft 'w' mouth and round blush. Smoother, rounder silhouette with no spiky tufts. A thick, clean ink outline. The bust should fill the square. Warm palette only. Solid magenta background.
> Then 'rabbit-portrait-happy-v2': edit v2 so ONLY the face changes. Happy closed ^ ^ eyes, a bigger smile, stronger blush, and the upright ear perked a bit taller. Everything else identical.

## Normalisation

### rabbit-portrait.png (`scripts/build_portrait.py`)
1. Key out magenta (tolerance 120) on both v2 raws. Crop both to their shared union bbox. Fit each to 64x64 with BOX resampling, bottom-anchored.
2. Quantise idle and happy side by side to one shared 32-colour palette, snapped to the CGE tokens, so the frames match. Harden alpha at 96.
3. Repaint the silhouette rim in ink #1D1F33 to give a clean 1px outline. Warm up the stray teal/grey-green fur pixels, but not the cup.
4. At 64px the downscaled raw eyes turned into brown blobs, so the face box (x15-42, y33-41) is hand-placed in code for every frame. Idle has sleepy lids with amber irises. Blink has closed lid lines. Happy has upward arcs, a wider mouth and bigger blush.
5. Frame 2 = frame 0, with only the upright-ear region (0,0)-(30,21) taken from the happy raw (the taller, perked ear) plus the happy face.
6. Wave 2 (2026-10-01/02, `perk_both_ears` + `happy_mouth`): in frame 2, every pixel right of the face axis (x' = 57 - x) on rows 0-44 is replaced by the mirror of the left half, so BOTH ears stand straight up (the droopy ear is perked for the joyful beat). The orphan droop tip on row 45 is cleared, the rim is re-inked, and the mirrored right-side rim pixels are darkened one step to keep the top-left light. The happy face then gets closed ^ ^ arcs, bigger blush and an open smile (dark mouth, pink tongue, terracotta lip). Rows 45-63 (scarf, cup, paws) are pixel-identical to frame 0.

Frame alignment was checked with an RGBA pixel diff (`ImageChops.difference(...).getbbox(alpha_only=False)`). Frame 0 vs 1 differs only inside (18,34)-(40,38), the eyes. Frame 0 vs 2 differs only inside (7,0)-(56,46), the head and ears above the scarf.

### rabbit-sprite.png (`scripts/build_sprite.py`)
- `scripts/sprite_blockout.py` produced an ellipse blockout as ASCII. It was hand-finished into span tables and detail pixels in `build_sprite.py`, which is the source of truth.
- Palette: ink, plaster, cream, fur shades, inner-ear pink, peach blush, nose, amber/dark eyes, terracotta knit scarf (with ember highlight), teal cup and tea.
- Frames: 0 is idle. 1 is the breath frame, where everything above row 26 drops 1px and the feet stay fixed. 2 and 3 wave the viewer's-left paw (out wide, then up high), with the cup still held. In every frame the foot outline sits on row 31.
- The art faces right. The game flips it (`landingScenery.rabbit.flipX`).
- Wave 2 readability pass (2026-10-01/02, all in `build_sprite.py`, no manual edits outside it): a taller 3px upright ear with a pink inner stripe; the droopy ear rises off the crown, bends and hangs beside the head with a pink underside and a 1px background notch under the bend; heavy-lidded amber eyes, peach cheeks, pink nose and a tiny u smile (replacing the old dark 2px mouth, which read as a gaping mouth at 2x). Frame 2 holds the waving paw out at cheek height. Frame 3 swings it up beside the ear on a chunkier 3px forearm (it was a 2px noodle), with amber motion ticks. The paw has a pink pad. Feet fill rows 28-30 and their outline is on row 31, the bottom row, in all frames.

- Wave 3 edge-margin pass (2026-10-02, critic round 3 nit 9, all in `build_sprite.py`, no manual edits): before this pass, frames 0, 2 and 3 had ear-tip ink on row 0, and frames 2 and 3 had the waving paw outline and motion ticks on column 0. Now:
  - The upright ear starts on row 2, so its tip outline sits on row 1. The ear is 1px shorter, and the pink stripe and shading run on rows 3-7.
  - The waving paw moved 1px right (paw rows now span x2-5 in final coordinates). In frame 2 its right outline is shared with the head outline. In frame 3 it sits right beside the upright ear. The forearm spans are unchanged.
  - The motion ticks moved inside the frame. Frame 2 has a dash at (2-3,7) and a dot at (1,9); the old column-0 dots are gone. Frame 3 has a dash at (1-2,2) and the vertical tick at x5.
  - New frame bboxes are (6,1,24,32), (6,2,24,32), (1,1,24,32) and (1,1,24,32), so row 0 and column 0 are empty in every frame. The feet outline stays on row 31 (bottom anchor), and the 24x32 x4 contract is unchanged. Column 23 still holds the droopy ear's outer outline. There is no room to inset it without shrinking the paw or the ear. The asset loads as a fixed-grid Phaser spritesheet with nearest filtering, and nothing trims or pads it.
  - The wave-2 version is kept as `raw/rabbit-sprite-w2-backup.png`. Before/after previews are `previews/rabbit-sprite-w2.preview.png` and `previews/rabbit-sprite-w3.preview.png`, made with `python tools/art/pixelize.py --preview <png> --scale 8`.
  - In-game check: `node e2e/capture.mjs --states=title,landing-settle-soft --label=w3-r3-assets-characters` gave 0 runtime errors and empty `assetFailures`. The wave frame reads cleanly beside the teahouse.

## Inspection
- Previews were made with `python tools/art/pixelize.py --preview <png> --scale 4/8` and reviewed on cosmos and parchment backgrounds.
- Contact sheet: `python tools/art/contact_sheet.py public/assets/characters --out e2e/out/contact-characters.png`.
- In-game: `node e2e/capture.mjs --states=title,landing-settle-soft,result-soft --label=w1-assets-characters`. No `rabbit-*` keys appear in `probe.assetFailures`. The rabbit reads well beside the teahouse at 2x and in the delivery result card.

## Known weaknesses
- The happy frame's right ear is a mirror of the left ear (re-shaded for the top-left light), so the perked pose is very symmetric.
- At 24x32 the sprite's floppy ear is a folded hook. It reads as a lop ear through its silhouette, but at 1x it can look like a loop.
- Frame 3's raised arm is long for a chibi body, because the paw needs to clear the head outline. Since wave 3, the paw's outline also sits directly against the upright ear's outline, so there is a 2px ink seam where there used to be a gap.
- The sprite's right column (x23) still carries the droopy ear's outline, so there is no margin on that side. After `flipX` in game, that is the left edge.
- The raw generations are about 1 MB each at 1024px. They are kept unmodified because `build_portrait.py` depends on them for exact reproducibility.
