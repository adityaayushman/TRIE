"""Tests for the end-to-end AI pipeline wiring.

These assert that each engine's output actually reaches the next stage and that
the final result is internally consistent — the properties that must hold as
individual engines are swapped from stubs to real models.
"""
from __future__ import annotations

import numpy as np
import pytest

from ai.common.types import RiskLevel, VehicleDynamics

from tests.fakes import fake_pipeline


@pytest.fixture
def frame():
    return np.zeros((480, 640, 3), dtype=np.uint8)


@pytest.fixture
def result(frame):
    pipeline = fake_pipeline()
    return pipeline.run(road_frame=frame, cabin_frame=frame, vehicle=VehicleDynamics(speed_kmh=95))


def test_pipeline_populates_every_stage(result):
    for stage in ("perception", "driver", "road", "traffic", "vehicle", "risk",
                  "forecast", "causal", "recommendation"):
        assert getattr(result, stage) is not None, f"{stage} was not produced"


def test_risk_score_is_within_bounds(result):
    assert 0.0 <= result.risk.risk_score <= 100.0
    assert isinstance(result.risk.risk_level, RiskLevel)


def test_vehicle_telemetry_reaches_the_result_unchanged(result):
    assert result.vehicle.speed_kmh == 95


def test_causal_primary_cause_is_the_largest_contributing_factor(result):
    """The causal engine must explain the score TRIE actually produced."""
    largest = max(result.risk.contributing_factors.items(), key=lambda kv: kv[1])[0]
    assert largest.replace("_", " ") in result.causal.primary_cause.lower()


def test_recommendation_references_the_causal_finding(result):
    assert result.recommendation.actions
    assert result.causal.primary_cause.lower() in result.recommendation.explanation.lower()
    assert result.causal.predicted_event in result.recommendation.explanation


def test_feature_importance_is_a_normalized_distribution(result):
    importance = result.recommendation.feature_importance
    assert set(importance) == set(result.risk.contributing_factors)
    assert sum(importance.values()) == pytest.approx(1.0, abs=0.01)


def test_forecast_probability_is_within_bounds(result):
    assert 0.0 <= result.forecast.collision_probability <= 1.0
    assert 0.0 <= result.forecast.future_risk_score <= 100.0


def test_a_fresh_pipeline_has_no_trend_to_extrapolate(frame):
    """The temporal engine needs at least two samples before it can project a
    trend, so the first forecast must equal the current risk."""
    pipeline = fake_pipeline()
    result = pipeline.run(road_frame=frame, cabin_frame=frame, vehicle=VehicleDynamics(speed_kmh=95))
    assert result.forecast.future_risk_score == result.risk.risk_score
    assert result.forecast.time_to_risk_s is None


def test_rising_risk_produces_a_time_to_risk_estimate(frame):
    """Risk climbing across successive frames should surface a countdown."""
    pipeline = fake_pipeline()
    pipeline.run(road_frame=frame, cabin_frame=frame, vehicle=VehicleDynamics(speed_kmh=30))
    result = pipeline.run(road_frame=frame, cabin_frame=frame, vehicle=VehicleDynamics(speed_kmh=110))

    assert result.forecast.future_risk_score > result.risk.risk_score
    assert result.forecast.time_to_risk_s is not None
    assert result.forecast.time_to_risk_s > 0
