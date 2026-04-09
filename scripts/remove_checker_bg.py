#!/usr/bin/env python3
"""
Remove checker-pattern background from sprite sheet images.

Strategy:
1. Detect the two checker colors by finding the 2 largest peaks in the
   gray luminance histogram of cell-edge pixels
2. Process each cell in the sprite grid independently
3. Seed BFS from all 4 edges of each cell + already-transparent pixels
4. Flood fill through neutral gray pixels covering the full range
   between the two detected peaks (with margin)
5. Use 8-directional connectivity for diagonal checker patterns
6. Character pixels act as barriers
"""

import glob
import os
from collections import Counter, deque
from typing import Final

import numpy as np
from PIL import Image

SPRITE_DIR: Final[str] = os.path.join(
    os.path.dirname(__file__), '..', 'assets', 'sprites'
)

GRID_COLS: Final[int] = 4
GRID_ROWS: Final[int] = 5

LUMINANCE_MARGIN: Final[int] = 15
MAX_CHANNEL_DIFF: Final[int] = 15
EDGE_SAMPLE_DEPTH: Final[int] = 3
# Bucket size for histogram peak detection
BUCKET_SIZE: Final[int] = 10


def detect_checker_range_from_edges(pixels: np.ndarray) -> tuple[float, float]:
    """Detect checker colors using peak detection on cell-edge histogram.

    Instead of gap-based clustering (which fails when there's noise between
    the two checker colors), we find the two tallest peaks in the histogram.
    """
    h, w = pixels.shape[:2]
    cell_w = w // GRID_COLS
    cell_h = h // GRID_ROWS

    lum_counter: Counter[int] = Counter()

    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            x_start = col * cell_w
            y_start = row * cell_h
            x_end = w if col == GRID_COLS - 1 else x_start + cell_w
            y_end = h if row == GRID_ROWS - 1 else y_start + cell_h

            # Sample top/bottom edge rows
            for x in range(x_start, x_end):
                for d in range(EDGE_SAMPLE_DEPTH):
                    for y in [y_start + d, y_end - 1 - d]:
                        if 0 <= y < h:
                            _collect_gray_lum(pixels, y, x, lum_counter)

            # Sample left/right edge columns
            for y in range(y_start, y_end):
                for d in range(EDGE_SAMPLE_DEPTH):
                    for x in [x_start + d, x_end - 1 - d]:
                        if 0 <= x < w:
                            _collect_gray_lum(pixels, y, x, lum_counter)

    if not lum_counter:
        return (100.0, 120.0)

    # Build histogram with larger buckets for peak detection
    buckets: Counter[int] = Counter()
    for lum, count in lum_counter.items():
        bucket = lum // BUCKET_SIZE * BUCKET_SIZE
        buckets[bucket] += count

    # Find the two highest peaks
    sorted_peaks = buckets.most_common()

    if len(sorted_peaks) < 2:
        peak = sorted_peaks[0][0] + BUCKET_SIZE // 2
        return (peak, peak)

    # Get top 2 peaks that are at least 30 apart (to avoid picking
    # two adjacent buckets of the same peak)
    peak1_bucket = sorted_peaks[0][0]
    peak1_center = peak1_bucket + BUCKET_SIZE // 2
    peak2_center = peak1_center  # default

    for bucket, count in sorted_peaks[1:]:
        center = bucket + BUCKET_SIZE // 2
        if abs(center - peak1_center) >= 30:
            peak2_center = center
            break

    min_peak = min(peak1_center, peak2_center)
    max_peak = max(peak1_center, peak2_center)

    return (float(min_peak), float(max_peak))


def _collect_gray_lum(
    pixels: np.ndarray, y: int, x: int, counter: Counter[int]
) -> None:
    """Add pixel luminance to counter if it's a neutral gray."""
    ri, gi, bi = int(pixels[y, x, 0]), int(pixels[y, x, 1]), int(pixels[y, x, 2])
    if (
        abs(ri - gi) <= MAX_CHANNEL_DIFF
        and abs(gi - bi) <= MAX_CHANNEL_DIFF
        and abs(ri - bi) <= MAX_CHANNEL_DIFF
    ):
        avg = (ri + gi + bi) // 3
        counter[avg] += 1


def remove_checker_background(img_path: str) -> None:
    """Remove checker pattern background from a sprite sheet image."""
    img = Image.open(img_path).convert('RGBA')
    pixels = np.array(img)
    h, w = pixels.shape[:2]

    min_lum, max_lum = detect_checker_range_from_edges(pixels)
    lower = min_lum - LUMINANCE_MARGIN
    upper = max_lum + LUMINANCE_MARGIN

    basename = os.path.basename(img_path)
    print(
        f"  {basename}: peaks [{min_lum:.0f}, {max_lum:.0f}] "
        f"-> range [{lower:.0f}, {upper:.0f}]"
    )

    cell_w = w // GRID_COLS
    cell_h = h // GRID_ROWS

    to_clear = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)

    directions = [
        (-1, 0), (1, 0), (0, -1), (0, 1),
        (-1, -1), (-1, 1), (1, -1), (1, 1),
    ]

    def can_traverse(ny: int, nx: int) -> bool:
        a = int(pixels[ny, nx, 3])
        if a == 0:
            return True
        ri = int(pixels[ny, nx, 0])
        gi = int(pixels[ny, nx, 1])
        bi = int(pixels[ny, nx, 2])
        if abs(ri - gi) > MAX_CHANNEL_DIFF:
            return False
        if abs(gi - bi) > MAX_CHANNEL_DIFF:
            return False
        if abs(ri - bi) > MAX_CHANNEL_DIFF:
            return False
        avg = (ri + gi + bi) / 3
        return lower <= avg <= upper

    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            x_start = col * cell_w
            y_start = row * cell_h
            x_end = w if col == GRID_COLS - 1 else x_start + cell_w
            y_end = h if row == GRID_ROWS - 1 else y_start + cell_h

            queue: deque[tuple[int, int]] = deque()

            # Seed from cell edges
            for x in range(x_start, x_end):
                for y in [y_start, y_end - 1]:
                    if not visited[y, x] and can_traverse(y, x):
                        visited[y, x] = True
                        to_clear[y, x] = True
                        queue.append((x, y))

            for y in range(y_start, y_end):
                for x in [x_start, x_end - 1]:
                    if not visited[y, x] and can_traverse(y, x):
                        visited[y, x] = True
                        to_clear[y, x] = True
                        queue.append((x, y))

            # Seed from already-transparent pixels
            for y in range(y_start, y_end):
                for x in range(x_start, x_end):
                    if not visited[y, x] and pixels[y, x, 3] == 0:
                        visited[y, x] = True
                        to_clear[y, x] = True
                        queue.append((x, y))

            # BFS within cell
            while queue:
                cx, cy = queue.popleft()
                for dx, dy in directions:
                    nx, ny = cx + dx, cy + dy
                    if (
                        x_start <= nx < x_end
                        and y_start <= ny < y_end
                        and not visited[ny, nx]
                        and can_traverse(ny, nx)
                    ):
                        visited[ny, nx] = True
                        to_clear[ny, nx] = True
                        queue.append((nx, ny))

    # Global pass from image edges
    queue = deque()
    for x in range(w):
        for y in [0, h - 1]:
            if not visited[y, x] and can_traverse(y, x):
                visited[y, x] = True
                to_clear[y, x] = True
                queue.append((x, y))
    for y in range(h):
        for x in [0, w - 1]:
            if not visited[y, x] and can_traverse(y, x):
                visited[y, x] = True
                to_clear[y, x] = True
                queue.append((x, y))

    while queue:
        cx, cy = queue.popleft()
        for dx, dy in directions:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx] and can_traverse(ny, nx):
                visited[ny, nx] = True
                to_clear[ny, nx] = True
                queue.append((nx, ny))

    pixels[to_clear, 3] = 0
    result = Image.fromarray(pixels)
    result.save(img_path)

    cleared = int(np.sum(to_clear))
    total = h * w
    print(f"    -> cleared {cleared}/{total} pixels ({100 * cleared / total:.1f}%)")


def main() -> None:
    sprite_dir = os.path.abspath(SPRITE_DIR)
    patterns = [
        'agent_*_sheet.png',
        'agent_*_actions.png',
        'creature_*_sheet.png',
        'creature_*_actions.png',
    ]

    files: list[str] = []
    for pat in patterns:
        files.extend(sorted(glob.glob(os.path.join(sprite_dir, pat))))

    files = sorted(set(files))

    if not files:
        print("No sprite files found.")
        return

    print(f"Processing {len(files)} sprite files...")
    for f in files:
        remove_checker_background(f)

    print("\nVerifying corner pixels...")
    all_ok = True
    for f in files:
        img = Image.open(f)
        p = img.getpixel((0, 0))
        if p[3] == 0:
            status = "OK (transparent)"
        else:
            status = f"FAIL (alpha={p[3]})"
            all_ok = False
        print(f"  {os.path.basename(f)}: (0,0)={p} -> {status}")

    if all_ok:
        print("\nAll corner pixels are transparent.")
    else:
        print("\nWARNING: Some corner pixels are NOT transparent.")


if __name__ == '__main__':
    main()
