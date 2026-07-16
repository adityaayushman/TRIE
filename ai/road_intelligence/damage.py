"""Road surface damage detection — potholes, cracks, and waterlogging.

Classical computer vision, not a learned detector: adaptive thresholding finds
dark, irregular blobs against the road surface, and contour shape separates
compact blobs (potholes) from thin elongated ones (cracks). Waterlogging uses
the complementary cue — standing water is comparatively smooth (low local
texture) and desaturated/reflective, where dry asphalt is textured and
uniformly grey.

Stated honestly, because this is exactly the kind of code that looks like a
real detector and is not one: it has not been benchmarked against any labelled
road-damage dataset. It is a genuine signal — it responds to dark, irregular
regions and smooth reflective ones — not a validated accuracy claim, and it
will confuse a strong shadow for a pothole. The upgrade is a YOLOv11 fine-tuned
on a road-damage dataset (RDD2022 or equivalent Indian data); what must
survive that swap is the `DetectedObject` contract this returns, not this
implementation.
"""
from __future__ import annotations

import numpy as np

from ai.common.types import DetectedObject

# OpenCV is imported inside each function rather than at module scope: a
# telemetry-only deployment (see ai/no_camera.py) imports ai.pipeline but
# never calls these, and must not need OpenCV installed at all to start.

# Fraction of the frame height treated as road surface, measured from the
# bottom. A forward-facing dashcam has sky/horizon in the upper portion; there
# is no road damage to find there.
ROAD_ROI_FRACTION = 0.55

# Contour area, as a fraction of the ROI, outside of which a blob is treated
# as noise (too small) or a shadow band/vehicle (too large) rather than damage.
# The lower bound is deliberately not tiny: on a real (JPEG-compressed, busy)
# street photo, a low bound lets compression artefacts, tire marks and text
# stencilled on the road read as dozens of potholes.
_MIN_BLOB_AREA_FRACTION = 0.004
_MAX_BLOB_AREA_FRACTION = 0.12

# A contour whose bounding box is longer than this multiple of its shorter
# side is treated as a crack; more compact blobs are treated as potholes.
_CRACK_ASPECT_RATIO = 2.5

# Waterlogged if at least this fraction of the road ROI reads as smooth and
# desaturated.
_WATERLOG_AREA_FRACTION = 0.15


def _road_roi(frame: np.ndarray) -> tuple[np.ndarray, int]:
    """The lower band of the frame, where the road surface actually is.

    Returns the cropped region and its y-offset, so contour coordinates found
    in it can be translated back to full-frame coordinates.
    """
    height = frame.shape[0]
    y_start = int(height * (1 - ROAD_ROI_FRACTION))
    return frame[y_start:, :], y_start


def _classify_contour(
    contour: np.ndarray, roi_area: float
) -> tuple[str, float, tuple[int, int, int, int], float] | None:
    """Label one dark blob as a pothole or crack, or discard it as noise.

    Returns the label, a heuristic confidence, the pixel bounding box, and the
    contour's *actual* filled area — kept separate from the bounding box
    because a thin diagonal crack's axis-aligned box covers far more empty
    space than the crack itself, and area-based scoring must use the real
    footprint, not the box.
    """
    import cv2

    x, y, w, h = cv2.boundingRect(contour)
    area = cv2.contourArea(contour)
    area_fraction = area / roi_area if roi_area > 0 else 0.0
    if not (_MIN_BLOB_AREA_FRACTION <= area_fraction <= _MAX_BLOB_AREA_FRACTION):
        return None

    # Elongation via the minimum-area *rotated* rectangle, not the axis-
    # aligned bounding box: a diagonal crack's axis-aligned bbox is far more
    # square than the crack itself, which would misclassify it as a pothole.
    (_, _), (rect_w, rect_h), _ = cv2.minAreaRect(contour)
    long_side, short_side = max(rect_w, rect_h), max(min(rect_w, rect_h), 1.0)
    aspect_ratio = long_side / short_side
    label = "crack" if aspect_ratio >= _CRACK_ASPECT_RATIO else "pothole"

    # Larger blobs read as more confidently real damage rather than noise;
    # this is a heuristic ranking, not a calibrated probability.
    confidence = float(np.clip(area_fraction / _MAX_BLOB_AREA_FRACTION, 0.3, 0.95))
    return label, confidence, (x, y, w, h), area


def detect_damage(
    frame: np.ndarray,
) -> tuple[list[DetectedObject], list[DetectedObject], float, float]:
    """Find potholes and cracks, and score overall surface condition.

    Returns `(potholes, cracks, roughness, damage_area_fraction)`.
    `roughness` is 0 (smooth) to 1 (heavily textured), from edge density
    across the road ROI independently of any individual detected blob.
    `damage_area_fraction` is each contour's actual filled area (not its
    bounding box) as a share of the ROI.
    """
    if frame is None or frame.size == 0:
        return [], [], 0.0, 0.0

    import cv2

    height, width = frame.shape[:2]
    roi, y_offset = _road_roi(frame)
    roi_area = roi.shape[0] * roi.shape[1]

    grayscale = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blurred = cv2.medianBlur(grayscale, 5)
    # Inverted so blobs *darker* than their local neighbourhood come out
    # white — potholes and cracks read darker than surrounding asphalt from
    # shadow and depth.
    dark_blobs = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 35, 12
    )
    # A 3x3 opening: enough to remove single-pixel speckle without erasing a
    # genuine thin crack outright, which a larger kernel does.
    dark_blobs = cv2.morphologyEx(dark_blobs, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    contours, _ = cv2.findContours(dark_blobs, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    potholes: list[DetectedObject] = []
    cracks: list[DetectedObject] = []
    damage_area = 0.0
    for contour in contours:
        classified = _classify_contour(contour, roi_area)
        if classified is None:
            continue
        label, confidence, (x, y, w, h), area = classified
        # Translate ROI-local pixel coordinates to full-frame normalised
        # coordinates, matching PerceptionEngine's DetectedObject convention.
        bbox = (
            x / width,
            (y + y_offset) / height,
            (x + w) / width,
            (y + h + y_offset) / height,
        )
        detection = DetectedObject(label, confidence, bbox)
        (cracks if label == "crack" else potholes).append(detection)
        damage_area += area

    edges = cv2.Canny(blurred, 50, 150)
    roughness = float(np.clip((edges > 0).mean() * 4.0, 0.0, 1.0))
    damage_area_fraction = damage_area / roi_area if roi_area > 0 else 0.0

    return potholes, cracks, roughness, damage_area_fraction


def detect_waterlogging(frame: np.ndarray) -> bool:
    """Whether standing water covers a meaningful share of the road surface.

    Standing water is comparatively smooth (low local variance) and
    desaturated/bright relative to textured, pigmented dry asphalt — the
    inverse texture signature from damage, which is why this is scored
    independently of `detect_damage` rather than folded into it.
    """
    if frame is None or frame.size == 0:
        return False

    import cv2

    roi, _ = _road_roi(frame)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    saturation, value = hsv[:, :, 1], hsv[:, :, 2]

    grayscale = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    # Local variance via the difference between the image and a blurred copy
    # of itself: near zero where the surface is smooth, large where it is
    # textured (asphalt grain, cracks, gravel).
    local_texture = cv2.absdiff(grayscale, cv2.GaussianBlur(grayscale, (9, 9), 0))

    # Ordinary dry, grey pavement is already fairly desaturated and fairly
    # smooth in patches — sat<60/tex<6 flagged a plain sidewalk in real photos
    # as often as it flagged water. Standing water needs to be near-mirror
    # smooth and close to achromatic, not merely low-texture-ish, to
    # distinguish it from dry pavement rather than from asphalt grain alone.
    smooth = local_texture < 3
    desaturated_and_bright = (saturation < 40) & (value > 90)
    water_like = smooth & desaturated_and_bright

    return bool(water_like.mean() >= _WATERLOG_AREA_FRACTION)
