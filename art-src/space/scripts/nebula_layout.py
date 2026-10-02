# Layout for nebula_compose.py: (cluster_index, x_left, y_bottom, scale, layer). Painter's order (first = back).
# Clusters (from --list with raws nebula-v5 + nebula-v6):
#   0 v5 plum+amber (top)   1 v5 teal (top)    2 v5 dusk (top)
#   3 v5 plum+amber (btm)   4 v5 dusk (btm)    5 v5 teal (btm)
#   6 v6 plum+amber, flat left edge   7 v6 teal, flat right edge   8 v6 dusk
#   9 v6 plum+amber, flat left/bottom   10 v6 teal, flat bottom   11 v6 dusk, flat bottom
# Flat edges are always covered by a neighbour drawn later (x wraps modulo 640).
LAYOUT = [
    # --- top band: dim back row peeking above the front clusters ---
    (8, 150, 70, 0.32, "back"),
    (5, 455, 66, 0.30, "back"),
    # --- top band: front ---
    (6, 40, 124, 0.40, "front"),
    (2, 232, 110, 0.40, "front"),
    (1, 402, 120, 0.42, "front"),
    (0, 566, 112, 0.38, "front"),
    # --- bottom band: dim back row ---
    (10, 96, 318, 0.32, "back"),
    (2, 452, 314, 0.30, "back"),
    # --- bottom band: front (bottoms run off the tile; the layer is mirrored vertically at runtime) ---
    (9, 22, 376, 0.42, "front"),
    (5, 196, 378, 0.40, "front"),
    (11, 382, 374, 0.40, "front"),
    (3, 560, 374, 0.38, "front"),
]
