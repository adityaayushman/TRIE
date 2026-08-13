"""Transportation Perception Engine — real YOLO detection on real frames.

Runs YOLOv11 over each road frame and maps COCO classes onto the taxonomy risk
fusion needs, keeping two-wheelers separate from cars because they are the
people who die (46.2% of Indian road deaths; MoRTH 2024).

Accuracy, stated honestly:

* The default weights are COCO-pretrained. COCO is a Western, lane-disciplined,
  car-dominated distribution, and it has **no class for an auto-rickshaw**, no
  concept of a six-person motorcycle, and no cattle. On Indian roads it will
  miss and mislabel. It is a real signal and a legitimate baseline — it is not
  a publishable accuracy claim.
* The upgrade is fine-tuning on the India Driving Dataset and reporting mAP
  against it. `model_path` exists so that swap is a constructor argument, not a
  rewrite.
"""
from __future__ import annotations

import numpy as np

from ai.common.types import DetectedObject, PerceptionResult
from ai.perception.lanes import detect_lane_offset

DEFAULT_MODEL = "yolo11n.pt"
DEFAULT_CONFIDENCE = 0.25

# Class NAME -> our taxonomy, so the same engine works whether the weights are
# COCO-pretrained or IDD-fine-tuned (ai/training/train_perception.py) — their ids
# differ, but the names align. The split is the point: `vehicles` are things with
# a cage around the occupant, `two_wheelers` and `pedestrians` are not. IDD adds
# the Indian classes COCO lacks: autorickshaw, rider (the person on a two-wheeler,
# a VRU), and vehicle fallback. Matched lowercase.
_VEHICLE_NAMES = {
    "car", "bus", "truck", "autorickshaw", "caravan", "trailer", "train", "vehicle fallback",
}
_TWO_WHEELER_NAMES = {"bicycle", "motorcycle"}
_PEDESTRIAN_NAMES = {"person", "rider"}
_TRAFFIC_LIGHT_NAMES = {"traffic light"}
_SIGN_NAMES = {"stop sign", "traffic sign"}

# Colour gates for classifying a cropped traffic light. Red wraps the hue
# origin in OpenCV's 0-179 scale, hence two bands.
_LIGHT_HUE_BANDS = {
    "red": [(0, 10), (170, 179)],
    "yellow": [(15, 35)],
    "green": [(40, 90)],
}


def _classify_traffic_light(frame: np.ndarray, box: tuple[float, float, float, float]) -> str | None:
    """Read a traffic light's state from the dominant hue of its lit lamp.

    YOLO localises the light but says nothing about its colour, so the crop is
    thresholded in HSV. Only reasonably bright, saturated pixels vote, so the
    dark body of the housing cannot outvote the lamp.
    """
    import cv2

    height, width = frame.shape[:2]
    x1, y1, x2, y2 = box
    crop = frame[
        max(0, int(y1 * height)) : min(height, int(y2 * height)),
        max(0, int(x1 * width)) : min(width, int(x2 * width)),
    ]
    if crop.size == 0:
        return None

    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    lit = (hsv[:, :, 1] > 100) & (hsv[:, :, 2] > 100)
    if not lit.any():
        return None

    hues = hsv[:, :, 0][lit]
    scores = {
        state: sum(int(((hues >= low) & (hues <= high)).sum()) for low, high in bands)
        for state, bands in _LIGHT_HUE_BANDS.items()
    }
    state, votes = max(scores.items(), key=lambda kv: kv[1])
    return state if votes > 0 else None


class PerceptionEngine:
    """Detects road users, signs and lights, and estimates lane position.

    Args:
        model_path: YOLO weights. Swap for IDD-fine-tuned weights here.
        confidence: Detection threshold. Lower catches more distant
            two-wheelers at the cost of false positives; the default is
            Ultralytics' own.
        device: "cuda", "cpu", or None to let Ultralytics choose.
    """

    def __init__(
        self,
        model_path: str = DEFAULT_MODEL,
        confidence: float = DEFAULT_CONFIDENCE,
        device: str | None = None,
        detector=None,
    ) -> None:
        self.model_path = model_path
        self.confidence = confidence
        self.device = device
        # Injectable so an edge device can share one loaded YOLO with
        # DriverIntelligenceEngine instead of paying for a second copy.
        self._model = detector

    def _model_or_load(self):
        """Load weights on first use, not at import.

        Constructing the engine must stay cheap: the API builds one at import
        time, and the test suite builds many.
        """
        if self._model is None:
            from ultralytics import YOLO

            self._model = YOLO(self.model_path)
        return self._model

    def analyze(self, frame: np.ndarray) -> PerceptionResult:
        """Detect everything of interest in a single BGR road frame."""
        if frame is None or frame.size == 0:
            return PerceptionResult()

        predictions = self._model_or_load().predict(
            frame,
            conf=self.confidence,
            device=self.device,
            verbose=False,
        )

        vehicles: list[DetectedObject] = []
        pedestrians: list[DetectedObject] = []
        two_wheelers: list[DetectedObject] = []
        signs: list[DetectedObject] = []
        light_state: str | None = None
        best_light_confidence = 0.0

        model = self._model_or_load()
        names = getattr(model, "names", {})

        for prediction in predictions:
            for box in prediction.boxes:
                class_id = int(box.cls)
                confidence = float(box.conf)
                name = str(names.get(class_id, class_id)).lower()
                # xyxyn is already normalised to the frame, so downstream
                # geometry is resolution-independent.
                bounds = tuple(float(value) for value in box.xyxyn[0])

                if name in _VEHICLE_NAMES:
                    vehicles.append(DetectedObject(name, confidence, bounds))
                elif name in _TWO_WHEELER_NAMES:
                    two_wheelers.append(DetectedObject(name, confidence, bounds))
                elif name in _PEDESTRIAN_NAMES:
                    pedestrians.append(DetectedObject(name, confidence, bounds))
                elif name in _SIGN_NAMES:
                    signs.append(DetectedObject(name, confidence, bounds))
                elif name in _TRAFFIC_LIGHT_NAMES and confidence > best_light_confidence:
                    # Several lights may be visible; trust the clearest one.
                    best_light_confidence = confidence
                    light_state = _classify_traffic_light(frame, bounds)

        lane_offset_m, lane_detected = detect_lane_offset(frame)

        return PerceptionResult(
            vehicles=vehicles,
            pedestrians=pedestrians,
            two_wheelers=two_wheelers,
            lane_offset_m=lane_offset_m,
            lane_detected=lane_detected,
            traffic_signs=signs,
            traffic_light_state=light_state,
        )
