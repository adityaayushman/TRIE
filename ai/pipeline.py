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
from ai.temporal_prediction.engine import TemporalPredictionEngine
from ai.traffic_intelligence.engine import TrafficIntelligenceEngine
from ai.trie.risk_fusion import RiskFusionEngine


class TransportationRiskPipeline:
    def __init__(self) -> None:
        self.perception = PerceptionEngine()
        self.driver_intelligence = DriverIntelligenceEngine()
        self.road_intelligence = RoadIntelligenceEngine()
        self.traffic_intelligence = TrafficIntelligenceEngine()
        self.risk_fusion = RiskFusionEngine()
        self.temporal_prediction = TemporalPredictionEngine()
        self.causal_intelligence = CausalIntelligenceEngine()
        self.explainable_ai = ExplainableAIEngine()

    def run(
        self,
        road_frame: np.ndarray,
        cabin_frame: np.ndarray,
        vehicle: VehicleDynamics | None = None,
    ) -> PipelineResult:
        vehicle = vehicle or VehicleDynamics()

        perception = self.perception.analyze(road_frame)
        driver = self.driver_intelligence.analyze(cabin_frame)
        road = self.road_intelligence.analyze(road_frame)
        traffic = self.traffic_intelligence.analyze(perception)

        risk = self.risk_fusion.fuse(
            driver=driver,
            road=road,
            traffic=traffic,
            vehicle=vehicle,
            lane_offset_m=perception.lane_offset_m,
        )
        forecast = self.temporal_prediction.predict(risk)
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
