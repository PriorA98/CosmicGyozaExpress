"""Wave 3 round 3: reproducible far-planet atmosphere build (writes production PNGs).

Inputs are the wave-2 production PNGs, archived as work/w3/pre-w3-*.png.
Run from the repo root: python art-src/celestial/scripts/build_w3.py
"""
from __future__ import annotations

import subprocess
import sys

W = "art-src/celestial/work/w3"
ATMOS = "art-src/celestial/scripts/atmos_w3.py"
JOBS = [
    (f"{W}/pre-w3-planet-far-plum.png", "public/assets/celestial/planet-far-plum.png",
     ["--contrast", "0.65", "--haze", "0.32", "--sat", "0.65", "--colors", "16", "--limb", "0.5",
      "--value", "0.88", "--detail", "0.55"]),
    (f"{W}/pre-w3-planet-im-fine.png", "public/assets/celestial/planet-im-fine.png",
     ["--contrast", "0.65", "--haze", "0.3", "--sat", "0.7", "--colors", "20", "--limb", "0.55",
      "--value", "0.92", "--detail", "0.6", "--keep", "#E4A271,#FBEED1,#F1DFC2"]),
]
for src, out, args in JOBS:
    subprocess.run([sys.executable, ATMOS, src, out, *args], check=True)
