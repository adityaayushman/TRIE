"""Shared data contracts passed between every engine in the pipeline.

Keeping these stable is what lets each engine in ai/*_intelligence/ and
ai/perception/ be swapped from a stub to a real model independently.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class DetectedObject:
    label: str
    confidence: float
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2 (normalized)


@dataclass
class PerceptionResult:
    """Output of ai/perception — vehicles, pedestrians, lanes, signs, lights."""
    vehicles: list[DetectedObject] = field(default_factory=list)
    pedestrians: list[DetectedObject] = field(default_factory=list)
    lane_offset_m: float = 0.0
    traffic_signs: list[DetectedObject] = field(default_factory=list)
    traffic_light_state: Optional[str] = None


@dataclass
class DriverState:
    """Output of ai/driver_intelligence."""
    eye_closure_ratio: float = 0.0
    blink_rate_per_min: float = 0.0
    is_yawning: bool = False
    is_using_phone: bool = False
    head_pose_deg: tuple[float, float, float] = (0.0, 0.0, 0.0)  # yaw, pitch, roll
    attention_score: float = 1.0  # 1.0 = fully attentive, 0.0 = fully distracted


@dataclass
class RoadState:
    """Output of ai/road_intelligence."""
    potholes: list[DetectedObject] = field(default_factory=list)
    cracks: list[DetectedObject] = field(default_factory=list)
    is_waterlogged: bool = False
    surface_quality_score: float = 1.0  # 1.0 = perfect, 0.0 = undrivable


@dataclass
class TrafficState:
    """Output of ai/traffic_intelligence."""
    vehicle_count: int = 0
    congestion_level: float = 0.0  # 0.0 free-flow, 1.0 gridlock
    density_per_km: float = 0.0


@dataclass
class VehicleDynamics:
    speed_kmh: float = 0.0
    acceleration_ms2: float = 0.0
    heading_deg: float = 0.0


@dataclass
class RiskAssessment:
    """Output of ai/trie — fused risk score before temporal/causal reasoning."""
    risk_score: float = 0.0  # 0-100
    risk_level: RiskLevel = RiskLevel.LOW
    contributing_factors: dict[str, float] = field(default_factory=dict)


@dataclass
class TemporalForecast:
    """Output of ai/temporal_prediction."""
    future_risk_score: float = 0.0
    time_to_risk_s: Optional[float] = None
    collision_probability: float = 0.0


@dataclass
class CausalExplanation:
    """Output of ai/causal_intelligence."""
    primary_cause: str = "unknown"
    secondary_causes: list[str] = field(default_factory=list)
    predicted_event: str = "none"


@dataclass
class Recommendation:
    """Output of ai/explainable_ai."""
    actions: list[str] = field(default_factory=list)
    feature_importance: dict[str, float] = field(default_factory=dict)
    explanation: str = ""


@dataclass
class PipelineResult:
    """Final output of ai/pipeline.py — everything the API/dashboard needs."""
    perception: PerceptionResult
    driver: DriverState
    road: RoadState
    traffic: TrafficState
    vehicle: VehicleDynamics
    risk: RiskAssessment
    forecast: TemporalForecast
    causal: CausalExplanation
    recommendation: Recommendation
