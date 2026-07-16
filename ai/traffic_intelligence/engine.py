"""Traffic Intelligence Engine — vehicle counting, congestion, density, flow.

Real implementation: tracks PerceptionEngine vehicle detections across frames
(e.g. ByteTrack) to derive counts, density and congestion trend.
"""
from __future__ import annotations

from ai.common.types import PerceptionResult, TrafficState

# Road users visible in one frame at which the scene reads as fully congested.
_CONGESTED_ROAD_USER_COUNT = 20.0


class TrafficIntelligenceEngine:
    def __init__(self) -> None:
        pass

    def analyze(self, perception: PerceptionResult) -> TrafficState:
        """Derive traffic-flow metrics from the current perception result.

        Two-wheelers count as traffic. A Western model counting only cars would
        read a road packed with motorcycles as empty, when in India that road
        is both congested and lethal — motorcycles filter into gaps a car model
        assumes are free space.
        """
        road_users = perception.vehicles + perception.two_wheelers
        count = len(road_users)
        return TrafficState(
            vehicle_count=count,
            congestion_level=min(count / _CONGESTED_ROAD_USER_COUNT, 1.0),
            density_per_km=count * 25.0,
        )
