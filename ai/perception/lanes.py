"""Lane detection, and — as importantly — detecting that there are no lanes.

Classical Hough-based detection over an edge map. Chosen deliberately over a
learned lane model for one property: when a road genuinely has no markings, it
returns `detected=False` rather than hallucinating a lane. On Indian roads that
outcome is the common case, not an error — the India Driving Dataset exists
precisely because "well-delineated infrastructure such as lanes" is usually
absent — and `ai/trie/` uses the flag to stop weighting lane discipline on a
road that has none.

Accuracy caveat for any write-up: Hough lane detection is a baseline. It
degrades on curves, worn paint, glare, and night. A learned detector fine-tuned
on IDD would be the upgrade; what must survive that swap is the `detected`
flag, not this implementation.
"""
from __future__ import annotations

import numpy as np

# Indian National Highway lanes are 3.5m (IRC:SP:84). Used to convert the
# pixel offset into metres at the bottom of the frame.
LANE_WIDTH_M = 3.5

_MIN_ABS_SLOPE = 0.4  # reject near-horizontal lines (shadows, road edges, wires)


def _region_of_interest(edges: np.ndarray) -> np.ndarray:
    """Mask everything but the trapezoid of road directly ahead."""
    import cv2

    height, width = edges.shape
    polygon = np.array(
        [[
            (int(0.05 * width), height),
            (int(0.45 * width), int(0.60 * height)),
            (int(0.55 * width), int(0.60 * height)),
            (int(0.95 * width), height),
        ]],
        dtype=np.int32,
    )
    mask = np.zeros_like(edges)
    cv2.fillPoly(mask, polygon, 255)
    return cv2.bitwise_and(edges, mask)


def _x_at_bottom(line: np.ndarray, height: int) -> float | None:
    """Extrapolate a line segment down to the bottom edge of the frame."""
    x1, y1, x2, y2 = line
    if y2 == y1:
        return None
    slope = (x2 - x1) / (y2 - y1)
    return x1 + (height - y1) * slope


def detect_lane_offset(frame: np.ndarray) -> tuple[float, bool]:
    """Estimate lateral offset from lane centre.

    Returns `(offset_m, detected)`. Positive is right of centre. When no lane
    pair is found, returns `(0.0, False)` — callers must branch on the flag
    rather than treating 0.0 as "perfectly centred".
    """
    if frame is None or frame.size == 0:
        return 0.0, False

    # Imported here, not at module scope: a telemetry-only deployment (see
    # ai/no_camera.py) imports ai.pipeline but never calls this, and must not
    # need OpenCV installed at all to start.
    import cv2

    grayscale = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(grayscale, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    height, width = edges.shape
    segments = cv2.HoughLinesP(
        _region_of_interest(edges),
        rho=1,
        theta=np.pi / 180,
        threshold=40,
        minLineLength=height // 8,
        maxLineGap=height // 10,
    )
    if segments is None:
        return 0.0, False

    # Lane markings converge toward the horizon, so the pair we want is one
    # left-leaning and one right-leaning line. Requiring both is what makes a
    # markless road report detected=False instead of an invented offset.
    left_x: list[float] = []
    right_x: list[float] = []
    for segment in segments:
        x1, y1, x2, y2 = segment[0]
        if x2 == x1:
            continue
        slope = (y2 - y1) / (x2 - x1)
        if abs(slope) < _MIN_ABS_SLOPE:
            continue

        bottom_x = _x_at_bottom(segment[0], height)
        if bottom_x is None:
            continue
        (left_x if slope < 0 else right_x).append(bottom_x)

    if not left_x or not right_x:
        return 0.0, False

    left_edge = float(np.median(left_x))
    right_edge = float(np.median(right_x))
    lane_width_px = right_edge - left_edge
    if lane_width_px <= 1:
        return 0.0, False

    lane_centre_px = (left_edge + right_edge) / 2
    offset_px = (width / 2) - lane_centre_px
    # Scale by the detected lane's own width so the estimate survives changes
    # in camera mounting and resolution.
    return float(offset_px / lane_width_px * LANE_WIDTH_M), True
