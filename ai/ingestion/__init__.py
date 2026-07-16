"""Frame ingestion — the camera-to-pipeline path.

    from ai.ingestion import VideoFileSource, PipelineRunner, synchronize

    with VideoFileSource("road.mp4") as road, VideoFileSource("cabin.mp4") as cabin:
        for assessment in PipelineRunner().run(synchronize(road, cabin)):
            print(assessment.result.risk.risk_score)
"""
from ai.ingestion.runner import FrameAssessment, PipelineRunner, TelemetryProvider
from ai.ingestion.sources import (
    DEFAULT_FPS,
    CameraSource,
    Frame,
    FrameSource,
    FrameSourceError,
    SyntheticFrameSource,
    VideoFileSource,
)
from ai.ingestion.sync import DEFAULT_MAX_SKEW_S, FramePair, synchronize

__all__ = [
    "CameraSource",
    "DEFAULT_FPS",
    "DEFAULT_MAX_SKEW_S",
    "Frame",
    "FrameAssessment",
    "FramePair",
    "FrameSource",
    "FrameSourceError",
    "PipelineRunner",
    "SyntheticFrameSource",
    "TelemetryProvider",
    "VideoFileSource",
    "synchronize",
]
