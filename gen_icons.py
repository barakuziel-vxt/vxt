"""
VXT App Icon Generator
Removes white background from the VXT logo and generates
all Android mipmap icon sizes for the vxt-mobile project.
"""
from PIL import Image, ImageDraw
import numpy as np
from pathlib import Path
from collections import deque

SOURCE  = r"C:\Users\ASUS\AppData\Roaming\Code\User\workspaceStorage\vscode-chat-images\image-1775306445547.png"
RES_DIR = r"C:\VXT\vxt-mobile\android\app\src\main\res"

SIZES = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
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

        print(f"  ✓ {folder:22s}  {size}×{size}  →  ic_launcher.png + ic_launcher_round.png")

    print("\nAll icons generated successfully.")


if __name__ == '__main__':
    main()
