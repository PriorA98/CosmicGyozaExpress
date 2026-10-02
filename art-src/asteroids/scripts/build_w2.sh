#!/usr/bin/env sh
# Rebuild all wave-2 asteroid outputs from the raw generations. Run from the repo root:
#   sh art-src/asteroids/scripts/build_w2.sh [out_dir=public/assets/asteroids]
# Every rock: pixelize --colors 36 --pad 4 (body = canvas - 8 = route radius in art px), then close_outline.
set -e
O=${1:-public/assets/asteroids}
R=art-src/asteroids/raw
T=art-src/asteroids/work/build
SC=art-src/asteroids/scripts
mkdir -p "$O" "$T"
px() { python tools/art/pixelize.py "$@"; }

# sleepy 76 (body 68): + blush restore (quantization drops the small cheek blush)
px $R/asteroid-sleepy-v1.png $T/sleepy-q.png --size 76x76 --colors 36 --pad 4
python $SC/restore_blush.py $R/asteroid-sleepy-v1.png $T/sleepy-q.png $T/sleepy-b.png 0.3
python $SC/close_outline.py $T/sleepy-b.png $O/asteroid-sleepy.png

# rice 92 (body 84), tea 100 (body 92)
px $R/asteroid-rice-v1.png $T/rice-q.png --size 92x92 --colors 36 --pad 4
python $SC/close_outline.py $T/rice-q.png $O/asteroid-rice.png
px $R/asteroid-tea-v1.png $T/tea-q.png --size 100x100 --colors 36 --pad 4
python $SC/close_outline.py $T/tea-q.png $O/asteroid-tea.png

# mochi 84 (body 76): new v5 generation, border flood-key so the pale pink body survives
python $SC/flood_key.py $R/asteroid-mochi-v5.png $R/keyed/asteroid-mochi-v5.png 90
px $R/keyed/asteroid-mochi-v5.png $T/mochi-q.png --size 84x84 --colors 36 --pad 4 --key none
python $SC/close_outline.py $T/mochi-q.png $O/asteroid-mochi.png

# crumb 66 (body 58): v1 generation + scripted chunky broken face on the lower left
px $R/asteroid-crumb-v1.png $T/crumb-q.png --size 66x66 --colors 36 --pad 4
python $SC/close_outline.py $T/crumb-q.png $T/crumb-ol.png
# wave 3: chunky faceted break (polyline), lavender shadow-ramp face, continuous re-ink (replaces cut_flat.py)
python $SC/chunk_cut.py $T/crumb-ol.png $O/asteroid-crumb.png "4,33 9,43 15,47 19,55 28,61" "#575172,#726A92,#88799E,#9486AA" "#C0AEA8"

# debris 96x24 (4 x 24x24): per-frame pixelize at 48 colours, then ONE joint 28-colour palette
S=$R/slices/debris-v1
px $S-1.png $S-2.png $S-3.png $S-4.png --sheet $T/debris-a.png --size 24x24 --colors 48 --pad 2
python $SC/quantize_joint.py $T/debris-a.png $T/debris-q.png 28
python $SC/close_outline.py $T/debris-q.png $O/asteroid-debris.png
