"""
VXT App Icon Generator
Removes white background from the VXT logo and generates
all Android mipmap icon sizes for the vxt-mobile project.
"""
from PIL import Image, ImageDraw
import numpy as np
from pathlib import Path
from collections import deque

SOURCE  = r"C:\VXT\new_logo.jpg"
RES_DIR = r"C:\VXT\vxt-mobile\android\app\src\main\res"

SIZES = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
}

# Adaptive icon foreground is 108dp (vs 48dp base) — same density multipliers
FOREGROUND_SIZES = {
    'mipmap-mdpi':    108,
    'mipmap-hdpi':    162,
    'mipmap-xhdpi':   216,
    'mipmap-xxhdpi':  324,
    'mipmap-xxxhdpi': 432,
}

def remove_white_background(img: Image.Image, threshold: int = 230) -> Image.Image:
    """Flood-fill from every edge pixel and mark near-white pixels transparent."""
    img = img.convert('RGBA')
    data = np.array(img, dtype=np.uint8)
    h, w = data.shape[:2]
    visited = np.zeros((h, w), dtype=bool)

    q: deque = deque()
    # Seed the queue with all border pixels
    for x in range(w):
        q.append((0, x));     q.append((h - 1, x))
    for y in range(1, h - 1):
        q.append((y, 0));     q.append((y, w - 1))

    while q:
        y, x = q.popleft()
        if visited[y, x]:
            continue
        r, g, b = int(data[y, x, 0]), int(data[y, x, 1]), int(data[y, x, 2])
        if r >= threshold and g >= threshold and b >= threshold:
            visited[y, x] = True
            data[y, x, 3] = 0          # make transparent
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                    q.append((ny, nx))

    return Image.fromarray(data, 'RGBA')


def make_circle_mask(img: Image.Image) -> Image.Image:
    """Apply a circular alpha mask so corners are fully transparent."""
    size = img.size[0]
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    result = img.copy().convert('RGBA')
    # Combine existing alpha with circle mask
    existing = result.split()[3]
    combined = Image.fromarray(
        np.minimum(np.array(existing), np.array(mask)), 'L'
    )
    result.putalpha(combined)
    return result


def main():
    print(f"Loading source: {SOURCE}")
    src = Image.open(SOURCE).convert('RGBA')
    print(f"  Original size: {src.size}")

    print("Removing white background...")
    no_bg = remove_white_background(src, threshold=230)

    # Autocrop to the actual logo bounds
    bbox = no_bg.getbbox()
    if bbox:
        no_bg = no_bg.crop(bbox)
        print(f"  Cropped to: {no_bg.size}")

    # Add 4 % padding on each side so the badge doesn't touch the icon edges
    cw, ch = no_bg.size
    side   = max(cw, ch)
    pad    = int(side * 0.04)
    canvas = side + 2 * pad
    padded = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    ox = pad + (canvas - 2 * pad - cw) // 2
    oy = pad + (canvas - 2 * pad - ch) // 2
    padded.paste(no_bg, (ox, oy), no_bg)
    print(f"  Padded canvas: {canvas}x{canvas}")

    for folder, size in SIZES.items():
        dir_path = Path(RES_DIR) / folder
        dir_path.mkdir(parents=True, exist_ok=True)

        # ── ic_launcher.png  (square, transparent background)
        square = padded.resize((size, size), Image.LANCZOS)
        square.save(dir_path / 'ic_launcher.png', optimize=True)

        # ── ic_launcher_round.png  (circular mask)
        round_img = make_circle_mask(square)
        round_img.save(dir_path / 'ic_launcher_round.png', optimize=True)

        # ── ic_launcher_foreground.png  (adaptive icon foreground layer)
        # Canvas is 108dp; safe zone is center 72dp (66.7% of canvas).
        # Place the logo to fill the safe zone with a little breathing room.
        fg_size = FOREGROUND_SIZES[folder]
        safe    = int(fg_size * (72 / 108))          # safe zone in pixels
        logo_px = int(safe * 0.90)                   # 90 % of safe zone
        logo_resized = padded.resize((logo_px, logo_px), Image.LANCZOS)
        fg_canvas = Image.new('RGBA', (fg_size, fg_size), (255, 255, 255, 255))
        ox = (fg_size - logo_px) // 2
        oy = (fg_size - logo_px) // 2
        fg_canvas.paste(logo_resized, (ox, oy), logo_resized)
        fg_canvas.save(dir_path / 'ic_launcher_foreground.png', optimize=True)

        print(f"  ✓ {folder:22s}  {size}×{size} / fg {fg_size}×{fg_size}")

    # ── colors.xml — background colour for adaptive icon
    colors_dir = Path(RES_DIR) / 'values'
    colors_dir.mkdir(parents=True, exist_ok=True)
    colors_xml = colors_dir / 'colors.xml'
    colors_xml.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<resources>\n'
        '    <color name="ic_launcher_background">#FFFFFF</color>\n'
        '</resources>\n'
    )
    print(f"  ✓ values/colors.xml  (white background)")

    print("\nAll icons generated successfully.")


if __name__ == '__main__':
    main()
