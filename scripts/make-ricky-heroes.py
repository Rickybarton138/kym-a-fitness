"""Build Rick.Fit's home-screen heroes.

Eight images, from three places, all cropped to the 16:9 the carousel wants:

  1. Face-swapped originals (.private/ricky/out/face-N.png)
     The 7 Sept heroes with Ricky's head in place of the model's. Only stock-1
     and stock-4 had a visible face, so only those two were swapped.

  2. Untouched originals (.private/ricky/stock/stock-N.jpg)
     stock-2 is a close crop of an arm and a dumbbell; stock-3 is an empty gym.
     Neither contains a person to swap. Asked to swap a face anyway the model
     invented a whole new man and a new scene, which is not what was wanted —
     so these two ship exactly as they always were.

  3. Goal renders (.private/ricky/out/goal-*.png)
     Ricky's own physique renders. Portrait 1024x1536, so they need a deliberate
     crop: under object-fit:cover a raw portrait becomes a band across the hips
     and loses the head entirely. A 576-tall window from y=240 holds head,
     shoulders, torso and arms, which is the part of the picture that is the point.

Order interleaves the gym scenes with the physique shots so the carousel does not
run four of one then four of the other.

Run: python scripts/make-ricky-heroes.py
"""

from PIL import Image
from pathlib import Path

ROOT = Path(".private/ricky")
DEST = Path("public/brands/ricky")

# (source, output, crop-window top, crop-window height)
# Landscape sources are cropped a little above centre so heads are not clipped;
# the portrait goal renders use the deliberate y=240 window described above.
SOURCES = [
    (ROOT / "out/face-1.png", "hero-1.jpg", 60, 864),
    (ROOT / "out/goal-v3-lateral-raise.png", "hero-2.jpg", 240, 576),
    (ROOT / "stock/stock-2.jpg", "hero-3.jpg", 50, 720),
    (ROOT / "out/goal-july-16.png", "hero-4.jpg", 240, 576),
    (ROOT / "out/face-4.png", "hero-5.jpg", 60, 864),
    (ROOT / "out/goal-july-16-dumbbells.png", "hero-6.jpg", 240, 576),
    (ROOT / "stock/stock-3.jpg", "hero-7.jpg", 50, 720),
    (ROOT / "out/goal-v2.png", "hero-8.jpg", 240, 576),
]

OUT_W, OUT_H = 1600, 900


def main():
    for src, out_name, top, crop_h in SOURCES:
        if not src.exists():
            raise SystemExit(f"missing source: {src}")
        im = Image.open(src).convert("RGB")
        w, h = im.size
        top = max(0, min(top, h - crop_h))  # never run off the bottom edge
        im = im.crop((0, top, w, top + crop_h)).resize((OUT_W, OUT_H), Image.LANCZOS)
        out = DEST / out_name
        im.save(out, "JPEG", quality=88, optimize=True, progressive=True)
        print(f"{src.name:32} -> {out_name}  ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
