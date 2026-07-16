"""Deterministic fake engines for wiring tests.

The real perception and driver engines load YOLO/MediaPipe and run inference,
which is slow and needs the ML stack installed. Tests of the *wiring* — the
pipeline, the ingestion runner, the API — should exercise how the pieces fit
together, not re-test the models. These fakes give stable, frame-independent
output so those tests stay fast, offline, and deterministic. Model quality is
tested separately, against real inputs, in test_perception.py / test_driver.py.
"""
from __future__ import annotations

import numpy as np

from ai.common.types import (
    DetectedObject,
    DriverState,
    PerceptionResult,
    RoadState,
)
from ai.pipeline import TransportationRiskPipeline


class FakePerceptionEngine:
    """A scene with one car, one nearby two-wheeler, and a detected lane."""

    def analyze(self, frame: np.ndarray) -> PerceptionResult:
        return PerceptionResult(
            vehicles=[DetectedObject("car", 0.9, (0.3, 0.4, 0.55, 0.7))],
            two_wheelers=[DetectedObject("motorcycle", 0.8, (0.6, 0.5, 0.72, 0.74))],
            pedestrians=[],
            lane_offset_m=0.15,
            lane_detected=True,
            traffic_light_state="green",
        )


class FakeDriverEngine:
    """A visible, mostly-attentive driver."""

    def analyze(self, frame: np.ndarray, timestamp_s: float | None = None) -> DriverState:
        return DriverState(
            eye_closure_ratio=0.1,
            blink_rate_per_min=15.0,
            perclos=0.05,
            attention_score=0.88,
            face_detected=True,
        )


class FakeRoadEngine:
    def analyze(self, frame: np.ndarray) -> RoadState:
        return RoadState(surface_quality_score=0.82)


class DangerousPerceptionEngine:
    """A crowd of close vulnerable road users — a genuine near-miss scene.

    Used by black-spot tests, which need the pipeline to actually emit HIGH-risk
    assessments so there is something to aggregate.
    """

    def analyze(self, frame: np.ndarray) -> PerceptionResult:
        crowd = [
            DetectedObject("motorcycle", 0.85, (0.3, 0.35, 0.7, 0.9)),
            DetectedObject("motorcycle", 0.82, (0.55, 0.4, 0.85, 0.88)),
            DetectedObject("person", 0.8, (0.1, 0.4, 0.3, 0.9)),
        ]
        return PerceptionResult(
            vehicles=[DetectedObject("car", 0.9, (0.05, 0.5, 0.2, 0.8))],
            two_wheelers=crowd[:2],
            pedestrians=crowd[2:],
            lane_offset_m=0.0,
            lane_detected=False,  # unmarked road, as most Indian roads are
        )


class DangerousRoadEngine:
    def analyze(self, frame: np.ndarray) -> RoadState:
        return RoadState(
            potholes=[DetectedObject("pothole", 0.7, (0.4, 0.6, 0.5, 0.7))],
            cracks=[DetectedObject("crack", 0.6, (0.2, 0.55, 0.6, 0.58))],
            is_waterlogged=False,
            surface_quality_score=0.35,  # broken surface
        )


def fake_pipeline() -> TransportationRiskPipeline:
    """A pipeline whose perception/driver/road engines need no models.

    Traffic, TRIE, temporal, causal and explainable engines are the real ones —
    they are pure functions over the fakes' output, so wiring tests still
    exercise the genuine fusion and reasoning logic.
    """
    return TransportationRiskPipeline(
        perception=FakePerceptionEngine(),
        driver_intelligence=FakeDriverEngine(),
        road_intelligence=FakeRoadEngine(),
    )


def dangerous_pipeline() -> TransportationRiskPipeline:
    """A pipeline that reports HIGH+ risk whenever the vehicle is moving fast —
    a dangerous unmarked road crowded with vulnerable users. For black-spot
    tests, which need real near-misses to aggregate."""
    class _DistractedDriver:
        def analyze(self, frame, timestamp_s=None):
            return DriverState(perclos=0.5, attention_score=0.3, face_detected=True)

    return TransportationRiskPipeline(
        perception=DangerousPerceptionEngine(),
        driver_intelligence=_DistractedDriver(),
        road_intelligence=DangerousRoadEngine(),
    )
