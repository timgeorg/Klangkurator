"""Generate the Klangkurator grain tiles (deterministic, seamless).

Two 256x256 PNG tiles with transparent backgrounds:
  grain-dark.png   dark specks, laid over paper surfaces
  grain-light.png  light specks, laid over ink surfaces

Fine single-pixel noise plus a faint low-frequency mottle that reads as
paper fibre. Kept quiet on purpose: the brief asks for texture without
roughness. The mottle uses integer-frequency sines, so the tile repeats
without a seam.

Usage: python3 generate-grain.py   (needs Pillow; writes next to this file)
"""

import math
import random
from pathlib import Path

from PIL import Image

SIZE = 256
SEED = 7  # fixed: the tiles must not change between runs


def mottle(x: int, y: int) -> float:
    """Low-frequency, tileable variation in 0..1."""
    t = 2 * math.pi / SIZE
    v = (
        math.sin(3 * x * t) * math.cos(2 * y * t)
        + 0.6 * math.sin(5 * y * t + 1.3) * math.cos(4 * x * t + 0.7)
        + 0.4 * math.sin(7 * (x + y) * t + 2.1)
    )
    return (v / 2.0 + 1.0) / 2.0


def tile(rgb: tuple[int, int, int], max_alpha: int) -> Image.Image:
    rnd = random.Random(SEED)
    img = Image.new("RGBA", (SIZE, SIZE))
    px = img.load()
    for y in range(SIZE):
        for x in range(SIZE):
            fine = rnd.random()
            # sparse specks: most pixels near zero, a few visible
            speck = fine ** 3.2
            a = max_alpha * (0.78 * speck + 0.22 * mottle(x, y) * 0.35)
            px[x, y] = (*rgb, int(round(min(max_alpha, a))))
    return img


def main() -> None:
    here = Path(__file__).resolve().parent
    tile((40, 32, 24), 34).save(here / "grain-dark.png", optimize=True)
    tile((255, 250, 240), 26).save(here / "grain-light.png", optimize=True)
    print("wrote grain-dark.png and grain-light.png")


if __name__ == "__main__":
    main()
