"""Tests for the TRIE risk fusion engine — the core scoring logic.

These pin the two design decisions that make the model India-specific: that
vulnerable road users are a first-class risk factor, and that the factor set
adapts to what is observable (no lane weighting without lane markings, no
driver weighting without a visible face), with weight redistributed so the
score always spans a true 0-100.
"""
from __future__ import annotations

import pytest

from ai.common.types import (
    DetectedObject,
    DriverState,
    PerceptionResult,
    RiskLevel,
    RoadState,
    TrafficState,
    VehicleDynamics,
)
from ai.trie.risk_fusion import _BASE_WEIGHTS, RiskFusionEngine


def perception(
    *,
    vehicles=0,
    two_wheelers=0,
    pedestrians=0,
    vru_box=0.02,
    lane_offset_m=0.0,
    lane_detected=False,
) -> PerceptionResult:
    def boxes(n):
        # A centred box of the requested area, repeated n times.
        half = (vru_box**0.5) / 2
        return [
            DetectedObject("x", 0.9, (0.5 - half, 0.5 - half, 0.5 + half, 0.5 + half))
            for _ in range(n)
        ]

    return PerceptionResult(
        vehicles=boxes(vehicles),
        two_wheelers=boxes(two_wheelers),
        pedestrians=boxes(pedestrians),
        lane_offset_m=lane_offset_m,
        lane_detected=lane_detected,
    )


def fuse(
    *,
    driver: DriverState | None = None,
    road: RoadState | None = None,
    traffic: TrafficState | None = None,
    vehicle: VehicleDynamics | None = None,
    scene: PerceptionResult | None = None,
):
    return RiskFusionEngine().fuse(
        driver=driver or DriverState(attention_score=1.0, face_detected=True),
        road=road or RoadState(surface_quality_score=1.0),
        traffic=traffic or TrafficState(congestion_level=0.0),
        vehicle=vehicle or VehicleDynamics(speed_kmh=0.0),
        perception=scene if scene is not None else perception(lane_detected=True),
    )


class TestScoreRange:
    def test_weights_sum_to_one(self):
        assert sum(_BASE_WEIGHTS.values()) == pytest.approx(1.0)

    def test_nominal_conditions_are_zero_risk(self):
        result = fuse()
        assert result.risk_score == 0.0
        assert result.risk_level is RiskLevel.LOW

    def test_worst_case_saturates_at_critical(self):
        """The bug this whole rework fixes: the old model capped at 29.9% and
        could never reach CRITICAL. This must now reach 100."""
        result = fuse(
            driver=DriverState(attention_score=0.0, face_detected=True),
            road=RoadState(surface_quality_score=0.0),
            traffic=TrafficState(congestion_level=1.0),
            vehicle=VehicleDynamics(speed_kmh=200.0),
            scene=perception(
                two_wheelers=6, pedestrians=6, vru_box=0.3, lane_offset_m=3.0, lane_detected=True
            ),
        )
        assert result.risk_score == 100.0
        assert result.risk_level is RiskLevel.CRITICAL

    def test_every_risk_level_is_reachable(self):
        """LOW/MODERATE/HIGH/CRITICAL were all dead code under the old 29.9%
        cap. Each must now be reachable by some real scenario."""
        low = fuse(vehicle=VehicleDynamics(speed_kmh=20))
        moderate = fuse(
            vehicle=VehicleDynamics(speed_kmh=90),
            driver=DriverState(attention_score=0.6, face_detected=True),
            road=RoadState(surface_quality_score=0.6),
        )
        high = fuse(
            vehicle=VehicleDynamics(speed_kmh=110),
            driver=DriverState(attention_score=0.3, face_detected=True),
            road=RoadState(surface_quality_score=0.4),
            scene=perception(two_wheelers=3, vru_box=0.12, lane_detected=True),
        )
        critical = fuse(
            vehicle=VehicleDynamics(speed_kmh=180),
            driver=DriverState(attention_score=0.0, face_detected=True),
            road=RoadState(surface_quality_score=0.1),
            traffic=TrafficState(congestion_level=0.9),
            scene=perception(two_wheelers=6, pedestrians=4, vru_box=0.3, lane_detected=True),
        )
        assert low.risk_level is RiskLevel.LOW
        assert moderate.risk_level is RiskLevel.MODERATE
        assert high.risk_level is RiskLevel.HIGH
        assert critical.risk_level is RiskLevel.CRITICAL


class TestVulnerableRoadUsers:
    def test_vru_exposure_raises_risk_even_with_a_perfect_driver(self):
        """The core India-specific claim: a perfectly alert driver moving
        through a crowd of two-wheelers is still at risk, because the danger is
        to them, not from the driver."""
        alone = fuse(scene=perception(lane_detected=True))
        in_a_crowd = fuse(
            scene=perception(two_wheelers=6, pedestrians=3, vru_box=0.15, lane_detected=True)
        )
        assert in_a_crowd.risk_score > alone.risk_score

    def test_a_close_vru_outweighs_a_distant_crowd(self):
        """Proximity is the more urgent danger — it leaves no time to react."""
        close = fuse(scene=perception(pedestrians=1, vru_box=0.3, lane_detected=True))
        distant_crowd = fuse(scene=perception(two_wheelers=5, vru_box=0.01, lane_detected=True))
        assert close.risk_score > distant_crowd.risk_score

    def test_two_wheelers_count_as_vulnerable_not_as_vehicles(self):
        """A motorcycle is a person exposed, not just another vehicle."""
        as_cars = fuse(scene=perception(vehicles=5, vru_box=0.15, lane_detected=True))
        as_bikes = fuse(scene=perception(two_wheelers=5, vru_box=0.15, lane_detected=True))
        assert as_bikes.risk_score > as_cars.risk_score
        assert "vru_exposure" in as_bikes.contributing_factors


class TestObservabilityAdaptation:
    def test_lane_drift_is_ignored_when_no_lane_is_detected(self):
        """Most Indian roads have no markings. Scoring lane discipline on them
        would be scoring a measurement that does not exist."""
        drifting = perception(lane_offset_m=1.5, lane_detected=False)
        result = fuse(scene=drifting)
        assert "lane_drift" not in result.contributing_factors
        assert "lane_drift" in result.unobserved_factors

    def test_lane_drift_counts_when_a_lane_is_detected(self):
        result = fuse(scene=perception(lane_offset_m=1.5, lane_detected=True))
        assert "lane_drift" in result.contributing_factors
        assert result.contributing_factors["lane_drift"] > 0

    def test_driver_distraction_is_ignored_when_no_face_is_visible(self):
        """A two-wheeler rider has no cabin camera. Reading attention_score as
        1.0 would score them as a perfectly attentive driver who does not
        exist."""
        no_face = DriverState(face_detected=False)
        result = fuse(driver=no_face)
        assert "driver_distraction" not in result.contributing_factors
        assert "driver_distraction" in result.unobserved_factors

    def test_unobserved_factors_do_not_cap_the_score(self):
        """A rider on an unmarked road can have neither lane nor face observed,
        yet must still be able to reach maximum risk."""
        result = RiskFusionEngine().fuse(
            driver=DriverState(face_detected=False),
            road=RoadState(surface_quality_score=0.0),
            traffic=TrafficState(congestion_level=1.0),
            vehicle=VehicleDynamics(speed_kmh=200.0),
            perception=perception(
                two_wheelers=6, pedestrians=6, vru_box=0.3, lane_detected=False
            ),
        )
        assert {"driver_distraction", "lane_drift"} <= set(result.unobserved_factors)
        assert result.risk_score == 100.0

    def test_weight_is_redistributed_not_dropped(self):
        """With two factors unobserved, the remaining four must still be able
        to carry the full weight — their contributions sum to the score."""
        result = fuse(
            driver=DriverState(face_detected=False),
            scene=perception(lane_detected=False),
            vehicle=VehicleDynamics(speed_kmh=120.0),
        )
        assert sum(result.contributing_factors.values()) * 100 == pytest.approx(
            result.risk_score, abs=0.1
        )
        assert result.contributing_factors["speed"] > _BASE_WEIGHTS["speed"]


class TestFactorMechanics:
    def test_speed_saturates_at_the_reference(self):
        at_limit = fuse(vehicle=VehicleDynamics(speed_kmh=120))
        over_limit = fuse(vehicle=VehicleDynamics(speed_kmh=200))
        assert at_limit.contributing_factors["speed"] == pytest.approx(
            over_limit.contributing_factors["speed"]
        )

    def test_lane_drift_is_direction_agnostic(self):
        left = fuse(scene=perception(lane_offset_m=-1.0, lane_detected=True))
        right = fuse(scene=perception(lane_offset_m=1.0, lane_detected=True))
        assert left.risk_score == right.risk_score

    def test_distraction_raises_risk_monotonically(self):
        scores = [
            fuse(driver=DriverState(attention_score=a, face_detected=True)).risk_score
            for a in (1.0, 0.75, 0.5, 0.25, 0.0)
        ]
        assert scores == sorted(scores)

    def test_contributing_factors_are_exactly_additive(self):
        """What makes the model honestly explainable without post-hoc
        attribution: the score is the sum of the parts."""
        result = fuse(
            driver=DriverState(attention_score=0.5, face_detected=True),
            road=RoadState(surface_quality_score=0.5),
            vehicle=VehicleDynamics(speed_kmh=80),
            scene=perception(two_wheelers=2, vru_box=0.1, lane_offset_m=0.5, lane_detected=True),
        )
        assert sum(result.contributing_factors.values()) * 100 == pytest.approx(
            result.risk_score, abs=0.1
        )
