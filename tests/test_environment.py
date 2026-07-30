"""Environmental context: time-of-day lighting risk and its fusion effect."""
import pytest

from ai.common.types import (
    DriverState,
    EnvironmentState,
    PerceptionResult,
    RoadState,
    TrafficState,
    VehicleDynamics,
)
from ai.environment.time_of_day import describe_hour, light_risk_for_hour
from ai.trie.risk_fusion import LOW_LIGHT_WEIGHT, RiskFusionEngine, _PERCEPTION_WEIGHTS


class TestTimeOfDayRisk:
    def test_night_is_riskier_than_midday(self):
        assert light_risk_for_hour(1) > light_risk_for_hour(13)
        assert light_risk_for_hour(23) > light_risk_for_hour(12)

    def test_evening_peak_is_the_maximum(self):
        # MoRTH's 18:00-21:00 concentration -> the evening should top the day.
        peak = light_risk_for_hour(19.5)
        assert peak >= light_risk_for_hour(3)
        assert peak > light_risk_for_hour(11)

    def test_bounded_and_continuous(self):
        for h in range(0, 24):
            assert 0.0 <= light_risk_for_hour(h) <= 1.0
        # No cliff edge across the dusk boundary.
        assert abs(light_risk_for_hour(17.9) - light_risk_for_hour(18.1)) < 0.15

    def test_labels(self):
        assert describe_hour(13) == "daylight"
        assert describe_hour(2) == "night"
        assert describe_hour(19.5) == "evening peak"


class TestEnvironmentInFusion:
    def _base(self, engine, environment=None):
        return engine.fuse(
            driver=DriverState(face_detected=False),
            road=RoadState(surface_quality_score=1.0),
            traffic=TrafficState(congestion_level=0.0),
            vehicle=VehicleDynamics(speed_kmh=95),
            perception=PerceptionResult(lane_detected=False),
            environment=environment,
        )

    def test_absent_environment_leaves_the_score_unchanged(self):
        """The weight-scaling invariant: with no environment the six factors
        keep their exact original weights, so the score is identical to the
        pre-environment model."""
        engine = RiskFusionEngine()
        no_env = self._base(engine)
        # Only speed is non-zero; the four always-observed factors redistribute
        # to their ORIGINAL relative weights (the scaling cancels), so speed's
        # effective weight is 0.22 / (0.22+0.13+0.08+0.20) — identical to the
        # pre-environment model.
        speed_mag = min(95 / 120, 1.0)
        expected = round(speed_mag * (0.22 / (0.22 + 0.13 + 0.08 + 0.20)) * 100, 1)
        assert no_env.risk_score == pytest.approx(expected, abs=0.2)
        assert "low_light" in no_env.unobserved_factors

    def test_night_raises_the_score(self):
        engine = RiskFusionEngine()
        day = self._base(engine, EnvironmentState(light_risk=0.12, hour=13, label="daylight"))
        night = self._base(engine, EnvironmentState(light_risk=0.9, hour=23, label="night"))
        assert night.risk_score > day.risk_score
        assert "low_light" in night.contributing_factors
        assert "low_light" not in night.unobserved_factors

    def test_perception_weights_sum_and_scaling(self):
        assert sum(_PERCEPTION_WEIGHTS.values()) == pytest.approx(1.0)
        assert 0.0 < LOW_LIGHT_WEIGHT < 1.0
