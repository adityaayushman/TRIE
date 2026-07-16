"""Transportation Risk Intelligence Engine (TRIE) — the core innovation.

Fuses driver, vehicle, road and traffic state into a single dynamic risk
score. Real implementation: a learned fusion model (e.g. gradient-boosted
trees or a small MLP) trained on labeled near-miss/accident telemetry;
weights below are a placeholder rule-based approximation so the rest of the
pipeline (temporal prediction, causal reasoning, explainability) has a real
signal to consume.
"""
from __future__ import annotations

from ai.common.types import (
    DriverState,
    RiskAssessment,
    RiskLevel,
    RoadState,
    TrafficState,
    VehicleDynamics,
)

# Relative contribution of each factor to the fused risk score.
_WEIGHTS = {
    "driver_distraction": 0.35,
    "speed": 0.20,
    "lane_drift": 0.15,
    "road_quality": 0.15,
    "traffic_congestion": 0.15,
}


class RiskFusionEngine:
    def fuse(
        self,
        driver: DriverState,
        road: RoadState,
        traffic: TrafficState,
        vehicle: VehicleDynamics,
        lane_offset_m: float,
    ) -> RiskAssessment:
        driver_distraction = 1.0 - driver.attention_score
        speed_factor = min(vehicle.speed_kmh / 120.0, 1.0)
        lane_drift_factor = min(abs(lane_offset_m) / 1.0, 1.0)
        road_quality_factor = 1.0 - road.surface_quality_score
        congestion_factor = traffic.congestion_level

        factors = {
            "driver_distraction": driver_distraction * _WEIGHTS["driver_distraction"],
            "speed": speed_factor * _WEIGHTS["speed"],
            "lane_drift": lane_drift_factor * _WEIGHTS["lane_drift"],
            "road_quality": road_quality_factor * _WEIGHTS["road_quality"],
            "traffic_congestion": congestion_factor * _WEIGHTS["traffic_congestion"],
        }
        risk_score = round(sum(factors.values()) * 100, 1)

        if risk_score >= 80:
            level = RiskLevel.CRITICAL
        elif risk_score >= 55:
            level = RiskLevel.HIGH
        elif risk_score >= 30:
            level = RiskLevel.MODERATE
        else:
            level = RiskLevel.LOW

        return RiskAssessment(
            risk_score=risk_score,
            risk_level=level,
            contributing_factors=factors,
        )
