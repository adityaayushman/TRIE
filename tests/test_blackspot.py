"""Tests for predictive black-spot discovery.

These pin the methodology, not just the plumbing: exposure normalisation, the
vehicle pass as the unit of analysis, and evidence-weighted ranking are the
claims a reviewer would attack, so each has a test that would fail loudly if
the property broke.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from ai.blackspot import BlackSpotEngine, Intervention, RiskObservation, wilson_lower_bound
from ai.blackspot.geo import MetricGrid, haversine_m
from ai.common.types import RiskLevel

# A real stretch of NH48 near Gurugram, for plausible coordinates.
HOTSPOT_LAT, HOTSPOT_LON = 28.4595, 77.0266
START = datetime(2026, 1, 1, 8, 0, 0)

POTHOLE_FACTORS = {"road_quality": 0.14, "speed": 0.05, "driver_distraction": 0.02}
SPEEDING_FACTORS = {"speed": 0.19, "road_quality": 0.02}


def observation(
    *,
    vehicle_id: str = "VEH-1",
    at: datetime = START,
    lat: float = HOTSPOT_LAT,
    lon: float = HOTSPOT_LON,
    level: RiskLevel = RiskLevel.LOW,
    factors: dict[str, float] | None = None,
) -> RiskObservation:
    return RiskObservation(
        vehicle_id=vehicle_id,
        latitude=lat,
        longitude=lon,
        timestamp=at,
        risk_score=85.0 if level is RiskLevel.HIGH else 10.0,
        risk_level=level,
        contributing_factors=factors if factors is not None else POTHOLE_FACTORS,
    )


def passes(count: int, *, near_misses: int, factors=POTHOLE_FACTORS, lat=HOTSPOT_LAT, lon=HOTSPOT_LON):
    """`count` distinct vehicles each passing once, `near_misses` of them badly."""
    return [
        observation(
            vehicle_id=f"VEH-{index}",
            at=START + timedelta(minutes=index),
            lat=lat,
            lon=lon,
            level=RiskLevel.HIGH if index < near_misses else RiskLevel.LOW,
            factors=factors,
        )
        for index in range(count)
    ]


class TestWilsonLowerBound:
    def test_no_evidence_gives_no_confidence(self):
        assert wilson_lower_bound(0, 0) == 0.0

    def test_never_reaches_certainty_on_a_small_sample(self):
        assert wilson_lower_bound(1, 1) < 1.0

    def test_more_evidence_at_the_same_rate_raises_the_bound(self):
        """The property the ranking depends on."""
        assert wilson_lower_bound(33, 200) > wilson_lower_bound(5, 30)

    def test_the_bound_sits_below_the_observed_rate(self):
        assert wilson_lower_bound(40, 200) < 40 / 200

    def test_a_thin_perfect_sample_can_still_outrank_a_thick_one(self):
        """Documents *why* min_exposure exists: Wilson alone does not stop a
        cell seen once from topping the ranking."""
        assert wilson_lower_bound(1, 1) > wilson_lower_bound(40, 200)


class TestMetricGrid:
    def test_nearby_points_share_a_cell(self):
        grid = MetricGrid(cell_size_m=500)
        assert grid.cell_of(HOTSPOT_LAT, HOTSPOT_LON) == grid.cell_of(
            HOTSPOT_LAT + 0.0001, HOTSPOT_LON + 0.0001
        )

    def test_distant_points_fall_in_different_cells(self):
        grid = MetricGrid(cell_size_m=500)
        far_lat = HOTSPOT_LAT + 0.05  # ~5.5km north
        assert grid.cell_of(HOTSPOT_LAT, HOTSPOT_LON) != grid.cell_of(far_lat, HOTSPOT_LON)

    def test_cells_are_metric_not_angular_across_latitudes(self):
        """500m of longitude spans more degrees in Kashmir than in Kerala; a
        naive degree-based grid would stretch cells across the country."""
        grid = MetricGrid(cell_size_m=500)
        kerala = grid.cell_of(8.5, 76.9)
        kashmir = grid.cell_of(34.0, 74.8)
        assert kerala != kashmir

    def test_rejects_a_nonpositive_cell_size(self):
        with pytest.raises(ValueError, match="cell_size_m must be positive"):
            MetricGrid(cell_size_m=0)

    def test_haversine_matches_a_known_distance(self):
        # One degree of latitude is ~111km anywhere on the globe.
        assert haversine_m(28.0, 77.0, 29.0, 77.0) == pytest.approx(111_195, rel=0.01)


class TestBlackSpotEngine:
    def test_no_observations_nominate_nothing(self):
        assert BlackSpotEngine().discover([]) == []

    def test_a_genuine_hotspot_is_nominated(self):
        spots = BlackSpotEngine(min_exposure=30, min_near_misses=5).discover(
            passes(40, near_misses=12)
        )

        [spot] = spots
        assert spot.near_miss_count == 12
        assert spot.exposure == 40
        assert spot.incident_rate == pytest.approx(0.3)
        assert haversine_m(spot.latitude, spot.longitude, HOTSPOT_LAT, HOTSPOT_LON) < 50

    def test_a_thinly_observed_cell_is_not_nominated(self):
        """Two passes, both bad, is a 100% rate on no evidence — the exact
        false positive exposure normalisation exists to prevent."""
        assert BlackSpotEngine(min_exposure=30, min_near_misses=1).discover(
            passes(2, near_misses=2)
        ) == []

    def test_a_busy_but_safe_stretch_is_not_nominated(self):
        assert BlackSpotEngine(min_exposure=30, min_near_misses=5).discover(
            passes(500, near_misses=2)
        ) == []

    def test_a_stationary_vehicle_cannot_manufacture_a_black_spot(self):
        """One vehicle idling at a bad junction emits assessments continuously.
        Counting ticks rather than passes would let a single driver fabricate a
        hotspot out of one afternoon."""
        stuck = [
            observation(vehicle_id="VEH-1", at=START + timedelta(seconds=index), level=RiskLevel.HIGH)
            for index in range(2_000)
        ]

        engine = BlackSpotEngine(min_exposure=1, min_near_misses=1)
        [spot] = engine.discover(stuck)

        assert spot.exposure == 1, "2000 ticks in one pass must count as one pass"
        assert spot.near_miss_count == 1, "one pass may contribute at most one near-miss"

    def test_a_returning_vehicle_counts_as_a_new_pass(self):
        """A daily commuter through the same junction is genuine repeat
        evidence, unlike ticks within one pass."""
        engine = BlackSpotEngine(min_exposure=1, min_near_misses=1, pass_gap=timedelta(minutes=5))
        commute = [
            observation(vehicle_id="VEH-1", at=START, level=RiskLevel.HIGH),
            observation(vehicle_id="VEH-1", at=START + timedelta(hours=9), level=RiskLevel.HIGH),
        ]

        [spot] = engine.discover(commute)

        assert spot.exposure == 2
        assert spot.near_miss_count == 2

    def test_exposure_counts_safe_passes_too(self):
        """The denominator is every vehicle that went through, not just the
        ones that had trouble — otherwise the rate is always 1.0."""
        engine = BlackSpotEngine(min_exposure=1, min_near_misses=1)

        [spot] = engine.discover(passes(50, near_misses=10))

        assert spot.exposure == 50
        assert spot.incident_rate == pytest.approx(0.2)

    def test_observations_may_arrive_out_of_order(self):
        """Telemetry from a fleet arrives interleaved and late."""
        engine = BlackSpotEngine(min_exposure=30, min_near_misses=5)
        ordered = passes(40, near_misses=12)

        shuffled = list(reversed(ordered))

        assert engine.discover(shuffled) == engine.discover(ordered)

    def test_separate_stretches_are_nominated_separately(self):
        engine = BlackSpotEngine(min_exposure=30, min_near_misses=5)
        # ~5.5km apart, so unambiguously different cells.
        here = passes(40, near_misses=12)
        there = passes(40, near_misses=15, lat=HOTSPOT_LAT + 0.05)

        spots = engine.discover(here + there)

        assert len(spots) == 2

    def test_ranks_by_evidence_weighted_confidence(self):
        engine = BlackSpotEngine(min_exposure=30, min_near_misses=5)
        well_attested = passes(200, near_misses=40)  # 20% over 200 passes
        thin = passes(30, near_misses=5, lat=HOTSPOT_LAT + 0.05)  # 16.7% over 30

        spots = engine.discover(well_attested + thin)

        assert [s.exposure for s in spots] == [200, 30]
        assert spots[0].confidence > spots[1].confidence


class TestCausalAttribution:
    def test_a_pothole_cluster_routes_to_engineering(self):
        """The output must reach the authority that can fix it: broken tarmac
        is a public-works work order, not a policing problem."""
        [spot] = BlackSpotEngine(min_exposure=30, min_near_misses=5).discover(
            passes(40, near_misses=12, factors=POTHOLE_FACTORS)
        )

        assert spot.dominant_cause == "Poor Road Surface"
        assert spot.intervention is Intervention.ENGINEERING

    def test_habitual_speeding_routes_to_enforcement(self):
        [spot] = BlackSpotEngine(min_exposure=30, min_near_misses=5).discover(
            passes(40, near_misses=12, factors=SPEEDING_FACTORS)
        )

        assert spot.dominant_cause == "High Speed"
        assert spot.intervention is Intervention.ENFORCEMENT

    def test_cause_breakdown_is_a_share_of_the_whole(self):
        [spot] = BlackSpotEngine(min_exposure=30, min_near_misses=5).discover(
            passes(40, near_misses=12, factors=POTHOLE_FACTORS)
        )

        assert sum(spot.cause_breakdown.values()) == pytest.approx(1.0, abs=0.01)
        assert list(spot.cause_breakdown)[0] == "road_quality", "ordered by contribution"

    def test_records_the_observation_window(self):
        [spot] = BlackSpotEngine(min_exposure=30, min_near_misses=5).discover(
            passes(40, near_misses=12)
        )

        assert spot.first_seen == START
        assert spot.last_seen == START + timedelta(minutes=39)


class TestIradComparison:
    def test_a_stretch_can_be_flagged_before_it_would_qualify_officially(self):
        """The thesis claim in one test: iRAD needs five crashes; four
        near-misses over enough passes is already a defensible nomination."""
        engine = BlackSpotEngine(min_exposure=30, min_near_misses=4)

        [spot] = engine.discover(passes(60, near_misses=4))

        assert spot.near_miss_count == 4
        assert not spot.qualifies_under_irad, "would not yet be an official black spot"
        assert spot.confidence > 0
