"""Print nebula layer metrics: uniform 2x2 block ratio (visible), alpha levels, colour count, wrap seam diff."""
import sys
import numpy as np
from PIL import Image
a = np.array(Image.open(sys.argv[1]).convert("RGBA")).astype(int)
H, W = a.shape[:2]
b = a[: H // 2 * 2, : W // 2 * 2]
blocks = b.reshape(H // 2, 2, W // 2, 2, 4)
vis = blocks[..., 3].max(axis=(1, 3)) > 0
uni = (blocks == blocks[:, :1, :, :1]).all(axis=(1, 3, 4))
# offset grid too (catches 2x upscales at odd phase)
b2 = a[1 : 1 + (H - 2) // 2 * 2, 1 : 1 + (W - 2) // 2 * 2]
bl2 = b2.reshape((H - 2) // 2, 2, (W - 2) // 2, 2, 4)
vis2 = bl2[..., 3].max(axis=(1, 3)) > 0
uni2 = (bl2 == bl2[:, :1, :, :1]).all(axis=(1, 3, 4))
al = a[..., 3]
print(f"uniform2x2 visible={uni[vis].mean():.3f} offset={uni2[vis2].mean():.3f}")
print("alpha levels", dict(zip(*np.unique(al, return_counts=True))))
print("opaque-ish(>=127)", (al >= 127).sum(), "visible", (al > 0).sum())
seam = np.abs(a[:, -1, :3] - a[:, 0, :3]).sum(1).mean()
adj = np.abs(a[:, 1:, :3] - a[:, :-1, :3]).sum(2).mean()
print(f"seam diff {seam:.1f} vs mean adjacent {adj:.1f}")
