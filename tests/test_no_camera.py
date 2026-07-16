"""Tests for the telemetry-only (no camera) pipeline.

The load-bearing property here is deployability: the backend image installs
only backend/requirements.txt, so `import ai.pipeline` and a full assessment
must both work with torch, ultralytics, mediapipe and cv2 entirely absent.
Getting this wrong crashes the service on startup with an ImportError, which
is exactly how it failed on Render before ai/no_camera.py existed.
"""
from __future__ import annotations

import subprocess
import sys
import textwrap

import pytest

from ai.common.types import VehicleDynamics
from ai.no_camera import (
    NoCameraDriverEngine,
    NoCameraPerceptionEngine,
    NoCameraRoadEngine,
    telemetry_only_pipeline,
)

BLOCK_ML_STACK = textwrap.dedent(
    """
    import sys
    BLOCKED = {"cv2", "torch", "ultralytics", "mediapipe", "torchvision"}
    class Blocker:
        def find_module(self, name, path=None):
            return self if name.split(".")[0] in BLOCKED else None
        def load_module(self, name):
            raise ImportError("No module named %r (simulated)" % name)
    sys.meta_path.insert(0, Blocker())
    """
)


def run_without_ml_stack(body: str) -> subprocess.CompletedProcess:
    """Run `body` in a subprocess where the ML stack cannot be imported.

    A subprocess, not an in-process meta_path hook: the modules under test are
    already imported in this session, so blocking them here would prove
    nothing about a fresh interpreter — which is what the container runs.
    """
    return subprocess.run(
        [sys.executable, "-c", BLOCK_ML_STACK + textwrap.dedent(body)],
        capture_output=True,
        text=True,
    )


class TestNoCameraEngines:
    def test_perception_reports_nothing_observed(self):
        result = NoCameraPerceptionEngine().analyze(None)
        assert result.vehicles == []
        assert result.pedestrians == []
        assert result.two_wheelers == []

    def test_perception_reports_lane_structure_as_unknown(self):
        """lane_detected=False is what makes risk fusion drop the lane_drift
        factor instead of reading a 0.0 offset as perfectly centred."""
        assert NoCameraPerceptionEngine().analyze(None).lane_detected is False

    def test_driver_reports_no_face(self):
        """face_detected=False makes fusion drop driver_distraction rather
        than treat the default attention_score=1.0 as a real measurement."""
        state = NoCameraDriverEngine().analyze(None, timestamp_s=0.0)
        assert state.face_detected is False

    def test_road_reports_no_damage(self):
        state = NoCameraRoadEngine().analyze(None)
        assert state.potholes == []
        assert state.cracks == []
        assert state.is_waterlogged is False


class TestTelemetryOnlyPipeline:
    def test_camera_factors_are_excluded_from_the_score(self):
        result = telemetry_only_pipeline().run(
            road_frame=None, cabin_frame=None, vehicle=VehicleDynamics(speed_kmh=95)
        )
        assert set(result.risk.unobserved_factors) == {"driver_distraction", "lane_drift"}
        assert "driver_distraction" not in result.risk.contributing_factors
        assert "lane_drift" not in result.risk.contributing_factors

    def test_telemetry_still_drives_the_score(self):
        pipeline = telemetry_only_pipeline()
        slow = pipeline.run(None, None, VehicleDynamics(speed_kmh=20), vehicle_id="A")
        fast = pipeline.run(None, None, VehicleDynamics(speed_kmh=110), vehicle_id="B")
        assert fast.risk.risk_score > slow.risk.risk_score

    def test_the_explanation_names_what_was_not_observed(self):
        result = telemetry_only_pipeline().run(
            road_frame=None, cabin_frame=None, vehicle=VehicleDynamics(speed_kmh=95)
        )
        assert "not observed" in result.recommendation.explanation.lower()

    def test_output_matches_the_real_engines_on_a_blank_frame(self):
        """The justification for the whole module: the real engines detect
        nothing on the blank frame the API used to send, so replacing them
        changes no output -- it only stops loading ~2GB of models to compute
        the same answer. Skipped when the ML stack isn't installed, since
        there is nothing to compare against."""
        pytest.importorskip("torch")
        pytest.importorskip("ultralytics")
        pytest.importorskip("cv2")
        import numpy as np

        from ai.pipeline import TransportationRiskPipeline

        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        real = TransportationRiskPipeline().run(
            road_frame=blank, cabin_frame=blank, vehicle=VehicleDynamics(speed_kmh=95)
        )
        no_camera = telemetry_only_pipeline().run(
            road_frame=None, cabin_frame=None, vehicle=VehicleDynamics(speed_kmh=95)
        )

        assert no_camera.risk.risk_score == real.risk.risk_score
        assert no_camera.risk.risk_level == real.risk.risk_level
        assert no_camera.risk.contributing_factors == real.risk.contributing_factors
        assert sorted(no_camera.risk.unobserved_factors) == sorted(real.risk.unobserved_factors)
        assert no_camera.causal.primary_cause == real.causal.primary_cause


class TestDeployableWithoutTheMlStack:
    """Regression tests for the Render deploy failure: the backend image
    installs no torch/ultralytics/mediapipe/opencv, so these imports must not
    reach for them."""

    def test_ai_pipeline_imports_without_the_ml_stack(self):
        result = run_without_ml_stack(
            """
            import ai.pipeline
            print("ok")
            """
        )
        assert result.returncode == 0, result.stderr
        assert "ok" in result.stdout

    def test_a_full_assessment_runs_without_the_ml_stack(self):
        result = run_without_ml_stack(
            """
            from ai.no_camera import telemetry_only_pipeline
            from ai.common.types import VehicleDynamics
            r = telemetry_only_pipeline().run(
                road_frame=None, cabin_frame=None,
                vehicle=VehicleDynamics(speed_kmh=95))
            print(r.risk.risk_score, r.causal.primary_cause)
            """
        )
        assert result.returncode == 0, result.stderr
        assert "27.6 High Speed" in result.stdout

    def test_the_backend_app_imports_without_the_ml_stack(self):
        """The exact chain that crashed on Render:
        app.main -> app.api.router -> routes.risk -> ai.pipeline -> cv2."""
        result = run_without_ml_stack(
            """
            import sys
            sys.path.insert(0, "backend")
            from app.main import app
            print("routes:", len(app.routes))
            """
        )
        assert result.returncode == 0, result.stderr
        assert "routes:" in result.stdout
