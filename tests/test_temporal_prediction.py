"""Tests for per-vehicle temporal trend tracking.

Regression coverage for a real bug: one pipeline instance serves every
vehicle reporting telemetry (the API holds a single process-wide instance),
but TemporalPredictionEngine's rolling history used to be shared across all
of them. Two vehicles trending in opposite directions would blend into one
meaningless average.
"""
from __future__ import annotations

import pytest

from ai.common.types import RiskAssessment, RiskLevel
from ai.temporal_prediction.engine import TemporalPredictionEngine


def risk(score: float) -> RiskAssessment:
    return RiskAssessment(risk_score=score, risk_level=RiskLevel.LOW)


class TestPerVehicleIsolation:
    def test_two_vehicles_do_not_share_a_trend(self):
        """The bug in one scenario: a calming vehicle and an escalating one
        reporting interleaved must each see only their own history."""
        engine = TemporalPredictionEngine()

        engine.predict(risk(80), vehicle_id="calming")
        engine.predict(risk(20), vehicle_id="escalating")
        engine.predict(risk(60), vehicle_id="calming")
        rising = engine.predict(risk(40), vehicle_id="escalating")
        falling = engine.predict(risk(40), vehicle_id="calming")

        assert rising.future_risk_score > 40, "escalating vehicle's own trend is upward"
        assert falling.future_risk_score < 40, "calming vehicle's own trend is downward"

    def test_a_fresh_vehicle_has_no_trend_regardless_of_others_history(self):
        engine = TemporalPredictionEngine()
        for _ in range(5):
            engine.predict(risk(90), vehicle_id="established")

        forecast = engine.predict(risk(10), vehicle_id="brand-new")

        assert forecast.future_risk_score == 10
        assert forecast.time_to_risk_s is None

    def test_the_default_vehicle_id_is_its_own_bucket(self):
        engine = TemporalPredictionEngine()
        engine.predict(risk(100))
        engine.predict(risk(100))

        forecast = engine.predict(risk(10), vehicle_id="someone-else")

        assert forecast.future_risk_score == 10


class TestLruEviction:
    def test_the_oldest_vehicle_is_evicted_once_the_cap_is_reached(self):
        engine = TemporalPredictionEngine(max_tracked_vehicles=2)
        engine.predict(risk(80), vehicle_id="a")
        engine.predict(risk(80), vehicle_id="a")  # rising trend established
        engine.predict(risk(50), vehicle_id="b")
        engine.predict(risk(50), vehicle_id="c")  # evicts "a", the least recent

        forecast = engine.predict(risk(80), vehicle_id="a")

        assert forecast.future_risk_score == 80, "history for 'a' should have been evicted"

    def test_recently_seen_vehicles_are_not_evicted(self):
        """LRU, not FIFO: touching a vehicle must protect it from eviction."""
        engine = TemporalPredictionEngine(max_tracked_vehicles=2)
        engine.predict(risk(50), vehicle_id="a")
        engine.predict(risk(50), vehicle_id="b")
        engine.predict(risk(80), vehicle_id="a")  # touch "a" again -> trend established, now most recent
        engine.predict(risk(50), vehicle_id="c")  # must evict "b", not "a"

        forecast = engine.predict(risk(80), vehicle_id="a")

        assert forecast.future_risk_score > 80, "a's rising trend (50->80) should have survived"

    def test_rejects_a_nonpositive_capacity(self):
        with pytest.raises(ValueError, match="max_tracked_vehicles must be at least 1"):
            TemporalPredictionEngine(max_tracked_vehicles=0)
