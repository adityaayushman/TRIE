"""Road Intelligence Engine — potholes, cracks, waterlogging, surface quality.

Real implementation, stated honestly: `ai/road_intelligence/damage.py` is a
classical computer-vision baseline (adaptive thresholding + contour shape for
potholes/cracks, texture-and-colour heuristics for waterlogging), not a
learned detector, and it has not been benchmarked against a labelled
road-damage dataset. It is a genuine, responsive signal — not an accuracy
claim. The intended upgrade is a YOLOv11 fine-tuned on a road-damage dataset
(RDD2022 or equivalent Indian data); the `RoadState` contract this returns is
what must survive that swap, not this implementation.
"""
from __future__ import annotations

import numpy as np

from ai.common.types import RoadState
from ai.road_intelligence.damage import detect_damage, detect_waterlogging

# Relative penalty applied per unit of detected damage density and texture
# roughness when computing surface_quality_score. Damage is weighted more
# heavily than raw roughness because a road can be rough (loose gravel) without
# being unsafe, but a pothole is a discrete hazard.
_DAMAGE_AREA_WEIGHT = 4.0
_ROUGHNESS_WEIGHT = 0.5
_WATERLOG_PENALTY = 0.5


class RoadIntelligenceEngine:
    def analyze(self, frame: np.ndarray) -> RoadState:
        """Assess road surface condition from a single forward-facing frame."""
        if frame is None or frame.size == 0:
            return RoadState()

        potholes, cracks, roughness, damage_fraction = detect_damage(frame)
        is_waterlogged = detect_waterlogging(frame)

        penalty = (
            _DAMAGE_AREA_WEIGHT * damage_fraction
            + _ROUGHNESS_WEIGHT * roughness
            + (_WATERLOG_PENALTY if is_waterlogged else 0.0)
        )
        # exp(-penalty) rather than 1-penalty: a linear penalty floor-clips to
        # a flat 0 for any moderately busy real photo (JPEG noise, shadows,
        # texture all add up past 1.0 easily), which makes the score useless
        # for exactly the frames it most needs to discriminate between. The
        # exponential keeps it informative and strictly decreasing everywhere.
        surface_quality_score = float(np.clip(np.exp(-penalty), 0.0, 1.0))

        return RoadState(
            potholes=potholes,
            cracks=cracks,
            is_waterlogged=is_waterlogged,
            surface_quality_score=round(surface_quality_score, 3),
        )
