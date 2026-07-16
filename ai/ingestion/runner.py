"""Driving the pipeline over a stream of frames.

ai/pipeline.py assesses a single instant. This turns it into a continuous
process over a live or recorded stream, which is how it actually runs on a
vehicle.
"""
from __future__ import annotations

import time
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass

from ai.common.types import PipelineResult, VehicleDynamics
from ai.ingestion.sync import FramePair
from ai.pipeline import TransportationRiskPipeline
from ai.temporal_prediction.engine import DEFAULT_VEHICLE_ID

# Telemetry is sampled per moment because speed and heading change between
# frames; a plain VehicleDynamics is accepted for the constant case.
TelemetryProvider = Callable[[float], VehicleDynamics]


@dataclass(frozen=True)
class FrameAssessment:
    """One pipeline result, tied back to the moment it came from."""

    result: PipelineResult
    timestamp_s: float
    frame_index: int
    latency_ms: float


def _as_provider(telemetry: TelemetryProvider | VehicleDynamics | None) -> TelemetryProvider:
    if telemetry is None:
        return lambda _timestamp_s: VehicleDynamics()
    if isinstance(telemetry, VehicleDynamics):
        return lambda _timestamp_s: telemetry
    return telemetry


class PipelineRunner:
    """Runs the risk pipeline over synchronized frames.

    `stride` processes every Nth pair. Inference is far slower than capture on
    edge hardware, so a Jetson pulling 30fps off a camera may only be able to
    assess every 5th frame; skipping deliberately is better than falling
    progressively further behind a live stream.
    """

    def __init__(
        self,
        pipeline: TransportationRiskPipeline | None = None,
        telemetry: TelemetryProvider | VehicleDynamics | None = None,
        stride: int = 1,
        vehicle_id: str = DEFAULT_VEHICLE_ID,
    ) -> None:
        if stride < 1:
            raise ValueError(f"stride must be at least 1, got {stride}")

        self.pipeline = pipeline or TransportationRiskPipeline()
        self.stride = stride
        self.vehicle_id = vehicle_id
        self._telemetry = _as_provider(telemetry)

    def run(self, pairs: Iterable[FramePair]) -> Iterator[FrameAssessment]:
        """Assess each (strided) pair, yielding results as they are produced.

        Lazy on purpose: a caller can stop early, and a live stream never ends.
        """
        for position, pair in enumerate(pairs):
            if position % self.stride:
                continue

            started = time.perf_counter()
            result = self.pipeline.run(
                road_frame=pair.road.image,
                cabin_frame=pair.cabin.image,
                vehicle=self._telemetry(pair.timestamp_s),
                timestamp_s=pair.timestamp_s,
                vehicle_id=self.vehicle_id,
            )
            yield FrameAssessment(
                result=result,
                timestamp_s=pair.timestamp_s,
                frame_index=pair.road.index,
                latency_ms=(time.perf_counter() - started) * 1000.0,
            )
