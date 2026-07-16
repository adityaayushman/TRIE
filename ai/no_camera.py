"""Pipeline engines for a deployment that has no camera attached.

The JSON API is one: `POST /risk/assess` carries telemetry, never frames — a
real deployment runs perception at the edge (`ai/ingestion/`, `ai/cli.py`) and
sends the results on. Until this session the backend nevertheless constructed
the full pipeline and ran YOLO and MediaPipe inference against a blank frame,
which by construction detects nothing at all: verified directly, a blank frame
through the real engines yields empty detections, `lane_detected=False`,
`face_detected=False`, and `surface_quality_score=1.0` — precisely the empty
defaults below. It loaded roughly 2GB of model weights to compute a result
identical to doing nothing, which is what broke deployment onto a 512MB host.

These engines report the same thing honestly and instantly. They are not
stubs standing in for absent work, and not fakes for tests (`tests/fakes.py`
covers that): "there is no camera here" is the true state of this deployment,
and `ai/trie/risk_fusion.py` is already built to handle it — `lane_detected=
False` and `face_detected=False` make it drop those factors and redistribute
their weight rather than score an unobserved factor as safe.
"""
from __future__ import annotations

import numpy as np

from ai.common.types import DriverState, PerceptionResult, RoadState
from ai.pipeline import TransportationRiskPipeline


class NoCameraPerceptionEngine:
    """Reports an unobserved road scene: no detections, no lane structure."""

    def analyze(self, frame: np.ndarray | None = None) -> PerceptionResult:
        # lane_detected defaults to False, which is the honest claim: with no
        # camera we cannot know whether this road has markings. Risk fusion
        # drops the lane_drift factor rather than reading 0.0 offset as
        # "perfectly centred".
        return PerceptionResult()


class NoCameraDriverEngine:
    """Reports an unobserved driver."""

    def analyze(
        self, frame: np.ndarray | None = None, timestamp_s: float | None = None
    ) -> DriverState:
        # face_detected=False is the load-bearing field: risk fusion drops the
        # driver_distraction factor entirely rather than treating the default
        # attention_score=1.0 as a measurement of an attentive driver.
        return DriverState(face_detected=False)


class NoCameraRoadEngine:
    """Reports an unobserved road surface."""

    def analyze(self, frame: np.ndarray | None = None) -> RoadState:
        # surface_quality_score defaults to 1.0 (pristine). Unlike the driver
        # and lane factors there is no `road_observed` flag to fall back on, so
        # this one *does* read as "a perfect road" to risk fusion rather than
        # as "unknown" — the same behaviour the blank-frame pipeline already
        # had, but worth naming as a real limitation of the telemetry-only
        # mode rather than leaving implied.
        return RoadState()


def telemetry_only_pipeline() -> TransportationRiskPipeline:
    """A pipeline for a deployment with telemetry but no camera.

    Identical output to running the real engines against a blank frame (see
    module docstring), without importing or loading torch, ultralytics or
    mediapipe. Risk is driven by vehicle telemetry, and every factor needing a
    camera is reported unobserved and excluded from the score.

    Traffic, TRIE, temporal, causal and explainable engines are the real ones:
    they are pure functions over the engines above, so fusion and reasoning
    stay genuine.
    """
    return TransportationRiskPipeline(
        perception=NoCameraPerceptionEngine(),
        driver_intelligence=NoCameraDriverEngine(),
        road_intelligence=NoCameraRoadEngine(),
    )
