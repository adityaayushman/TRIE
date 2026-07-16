"""Transportation Perception Engine — vehicles, pedestrians, lanes, signs, lights.

Real implementation: YOLOv11 for detection + a Vision Transformer for scene
context, run over each camera frame with OpenCV for pre/post-processing.
"""
from __future__ import annotations

import numpy as np

from ai.common.types import DetectedObject, PerceptionResult


class PerceptionEngine:
    def __init__(self, model_path: str | None = None) -> None:
        self.model_path = model_path

    def analyze(self, frame: np.ndarray) -> PerceptionResult:
        """Run detection on a single BGR frame. Stub: returns mock detections."""
        return PerceptionResult(
            vehicles=[DetectedObject(label="car", confidence=0.92, bbox=(0.3, 0.4, 0.55, 0.7))],
            pedestrians=[],
            lane_offset_m=0.15,
            traffic_signs=[],
            traffic_light_state="green",
        )
