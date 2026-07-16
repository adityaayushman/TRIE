"""End-to-end orchestration of every engine, matching the Workflow in
docs/ARCHITECTURE.md:

Camera Feed -> Vehicle Detection -> Driver Monitoring -> Road Hazard
Detection -> Traffic Analysis -> Risk Fusion -> Temporal Prediction ->
Causal Analysis -> Explainable AI -> Recommendation.

This is the single entry point the FastAPI backend calls per frame/tick.
"""
from __future__ import annotations

import numpy as np

from ai.causal_intelligence.engine import CausalIntelligenceEngine
from ai.common.types import PipelineResult, VehicleDynamics
from ai.driver_intelligence.engine import DriverIntelligenceEngine
from ai.explainable_ai.engine import ExplainableAIEngine
from ai.perception.engine import PerceptionEngine
from ai.road_intelligence.engine import RoadIntelligenceEngine
from ai.temporal_prediction.engine import DEFAULT_VEHICLE_ID, TemporalPredictionEngine
from ai.traffic_intelligence.engine import TrafficIntelligenceEngine
from ai.trie.risk_fusion import RiskFusionEngine


class TransportationRiskPipeline:
    """Runs every engine over one moment and returns the fused assessment.

    Engines are injectable. Two reasons, both practical: a Jetson wants to hand
    PerceptionEngine and DriverIntelligenceEngine the *same* loaded YOLO rather
    than two copies of it, and tests need to drive the wiring without
    downloading weights or running inference.
    """

    def __init__(
        self,
        perception: PerceptionEngine | None = None,
        driver_intelligence: DriverIntelligenceEngine | None = None,
        road_intelligence: RoadIntelligenceEngine | None = None,
        traffic_intelligence: TrafficIntelligenceEngine | None = None,
        risk_fusion: RiskFusionEngine | None = None,
        temporal_prediction: TemporalPredictionEngine | None = None,
        causal_intelligence: CausalIntelligenceEngine | None = None,
        explainable_ai: ExplainableAIEngine | None = None,
    ) -> None:
        self.perception = perception or PerceptionEngine()
        self.driver_intelligence = driver_intelligence or DriverIntelligenceEngine()
        self.road_intelligence = road_intelligence or RoadIntelligenceEngine()
        self.traffic_intelligence = traffic_intelligence or TrafficIntelligenceEngine()
        self.risk_fusion = risk_fusion or RiskFusionEngine()
        self.temporal_prediction = temporal_prediction or TemporalPredictionEngine()
        self.causal_intelligence = causal_intelligence or CausalIntelligenceEngine()
        self.explainable_ai = explainable_ai or ExplainableAIEngine()

    def run(
        self,
        road_frame: np.ndarray | None,
        cabin_frame: np.ndarray | None,
        vehicle: VehicleDynamics | None = None,
        timestamp_s: float | None = None,
        vehicle_id: str = DEFAULT_VEHICLE_ID,
    ) -> PipelineResult:
        """Assess one moment.

        Frames may be None: a telemetry-only deployment has no camera (see
        ai/no_camera.py), and every engine reports the relevant factor
        unobserved rather than inventing a measurement.

        `timestamp_s` should come from the frame's own clock. Driver monitoring
        measures PERCLOS over a rolling time window, so replaying recorded
        video faster than real time would corrupt it if the engine fell back to
        the wall clock.

        `vehicle_id` scopes the temporal trend: one pipeline instance can serve
        many vehicles (the API holds a single process-wide pipeline), and
        without this every vehicle's risk history would blend into one shared,
        meaningless trend.
        """
        vehicle = vehicle or VehicleDynamics()

        perception = self.perception.analyze(road_frame)
        driver = self.driver_intelligence.analyze(cabin_frame, timestamp_s=timestamp_s)
        road = self.road_intelligence.analyze(road_frame)
        traffic = self.traffic_intelligence.analyze(perception)

        risk = self.risk_fusion.fuse(
            driver=driver,
            road=road,
            traffic=traffic,
            vehicle=vehicle,
            perception=perception,
        )
        forecast = self.temporal_prediction.predict(risk, vehicle_id=vehicle_id)
        causal = self.causal_intelligence.explain(risk)
        recommendation = self.explainable_ai.explain(risk, causal)

        return PipelineResult(
            perception=perception,
            driver=driver,
            road=road,
            traffic=traffic,
            vehicle=vehicle,
            risk=risk,
            forecast=forecast,
            causal=causal,
            recommendation=recommendation,
        )


if __name__ == "__main__":
    pipeline = TransportationRiskPipeline()
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    result = pipeline.run(road_frame=dummy_frame, cabin_frame=dummy_frame, vehicle=VehicleDynamics(speed_kmh=95))
    print(f"Risk: {result.risk.risk_score}% ({result.risk.risk_level.value})")
    print(f"Primary cause: {result.causal.primary_cause}")
    print(f"Predicted event: {result.causal.predicted_event}")
    print(f"Recommended actions: {result.recommendation.actions}")
