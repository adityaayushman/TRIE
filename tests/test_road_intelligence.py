"""Tests for road surface damage detection.

Classical CV, not a learned detector (see ai/road_intelligence/damage.py for
why). Pure per-pixel synthetic noise turns out to be a poor stand-in for real
asphalt texture — it stays too achromatic and low-variance regardless of
amplitude — so the "clean road" fixture below uses a warm-tinted base plus
noise to avoid accidentally looking like a smooth, saturated-adjacent patch.
The real validation that matters is against a real photo, included here.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest

from ai.road_intelligence.damage import detect_damage, detect_waterlogging
from ai.road_intelligence.engine import RoadIntelligenceEngine


def clean_road(seed: int = 0, size=(480, 640)) -> np.ndarray:
    """A textured but undamaged, dry road surface."""
    rng = np.random.default_rng(seed)
    base = np.array([140, 145, 150], dtype=np.float64)  # BGR, slightly warm
    height, width = size
    return np.clip(base + rng.normal(0, 18, (height, width, 3)), 0, 255).astype(np.uint8)


def with_pothole(img: np.ndarray, center=(320, 400), radius=25) -> np.ndarray:
    out = img.copy()
    cv2.circle(out, center, radius, (40, 40, 40), -1)
    return out


def with_crack(img: np.ndarray, p1=(200, 300), p2=(500, 420)) -> np.ndarray:
    out = img.copy()
    cv2.line(out, p1, p2, (40, 40, 40), 4)
    return out


def with_waterlogged_patch(img: np.ndarray) -> np.ndarray:
    out = img.copy()
    cv2.rectangle(out, (100, 320), (540, 470), (230, 228, 225), -1)
    return out


class TestDamageDetection:
    def test_a_clean_road_has_no_damage(self):
        potholes, cracks, roughness, damage_fraction = detect_damage(clean_road())
        assert potholes == []
        assert cracks == []
        assert damage_fraction == pytest.approx(0.0, abs=1e-6)

    def test_a_dark_compact_blob_is_a_pothole(self):
        potholes, cracks, _, _ = detect_damage(with_pothole(clean_road()))
        assert len(potholes) == 1
        assert cracks == []
        assert potholes[0].label == "pothole"

    def test_a_thin_elongated_mark_is_a_crack_not_a_pothole(self):
        """Regression: an axis-aligned bounding box misjudges a diagonal
        crack's elongation. minAreaRect must be used instead."""
        potholes, cracks, _, _ = detect_damage(with_crack(clean_road()))
        assert len(cracks) == 1
        assert potholes == []
        assert cracks[0].label == "crack"

    def test_detections_stay_within_frame_bounds(self):
        potholes, cracks, _, _ = detect_damage(with_pothole(with_crack(clean_road())))
        for detection in (*potholes, *cracks):
            x1, y1, x2, y2 = detection.bbox
            assert 0.0 <= x1 < x2 <= 1.0
            assert 0.0 <= y1 < y2 <= 1.0

    def test_damage_area_reflects_the_actual_contour_not_its_bounding_box(self):
        """Regression: a diagonal crack's bounding box covers far more empty
        space than the crack itself: using bbox area overcounted a thin 4px
        line as ~22% of the road surface."""
        _, _, _, damage_fraction = detect_damage(with_crack(clean_road()))
        assert damage_fraction < 0.02

    def test_an_empty_frame_reports_no_damage(self):
        assert detect_damage(np.zeros((0, 0, 3), dtype=np.uint8)) == ([], [], 0.0, 0.0)

    def test_a_none_frame_reports_no_damage(self):
        assert detect_damage(None) == ([], [], 0.0, 0.0)


class TestWaterlogging:
    def test_a_clean_dry_road_is_not_waterlogged(self):
        assert detect_waterlogging(clean_road()) is False

    def test_a_large_smooth_bright_desaturated_patch_is_waterlogged(self):
        assert detect_waterlogging(with_waterlogged_patch(clean_road())) is True

    def test_an_empty_frame_is_not_waterlogged(self):
        assert detect_waterlogging(np.zeros((0, 0, 3), dtype=np.uint8)) is False


class TestRoadIntelligenceEngine:
    def test_a_clean_road_scores_near_perfect_quality(self):
        state = RoadIntelligenceEngine().analyze(clean_road())
        assert state.surface_quality_score > 0.9
        assert not state.is_waterlogged

    def test_damage_lowers_the_quality_score(self):
        engine = RoadIntelligenceEngine()
        clean = engine.analyze(clean_road())
        damaged = engine.analyze(with_pothole(with_crack(clean_road())))
        assert damaged.surface_quality_score < clean.surface_quality_score

    def test_quality_score_never_floor_clips_to_a_flat_zero(self):
        """Regression: a linear damage penalty saturated to exactly 0.0 for
        any moderately busy real photo, making the score useless for the
        frames it most needs to discriminate between. The exponential form
        must stay strictly informative."""
        heavily_damaged = clean_road()
        for cx in range(80, 560, 40):
            heavily_damaged = with_pothole(heavily_damaged, center=(cx, 400), radius=15)
        state = RoadIntelligenceEngine().analyze(heavily_damaged)
        assert state.surface_quality_score > 0.0

    def test_quality_score_is_always_bounded(self):
        for frame in (
            clean_road(),
            with_pothole(clean_road()),
            with_crack(clean_road()),
            with_waterlogged_patch(clean_road()),
        ):
            state = RoadIntelligenceEngine().analyze(frame)
            assert 0.0 <= state.surface_quality_score <= 1.0

    def test_an_empty_frame_returns_the_default_state(self):
        state = RoadIntelligenceEngine().analyze(np.zeros((0, 0, 3), dtype=np.uint8))
        assert state.surface_quality_score == 1.0
        assert state.potholes == []


class TestAgainstARealPhoto:
    """The validation that actually matters: synthetic fixtures can only prove
    the mechanics work, not that the heuristic discriminates on a real,
    JPEG-compressed, cluttered street scene."""

    @pytest.fixture(scope="module")
    def real_road_frame(self, tmp_path_factory):
        pytest.importorskip("cv2")
        from urllib.request import urlretrieve

        path = tmp_path_factory.mktemp("images") / "bus.jpg"
        try:
            urlretrieve("https://ultralytics.com/images/bus.jpg", path)
        except OSError:
            pytest.skip("no network access to fetch the validation photo")
        return cv2.imread(str(path))

    def test_runs_without_error_on_a_real_photo(self, real_road_frame):
        state = RoadIntelligenceEngine().analyze(real_road_frame)
        assert 0.0 <= state.surface_quality_score <= 1.0

    def test_ordinary_dry_pavement_is_not_flagged_as_waterlogged(self, real_road_frame):
        """Regression: sat<60 + tex<6 flagged a plain dry sidewalk as
        waterlogged as often as it flagged actual water, because ordinary grey
        pavement is itself fairly desaturated and locally smooth in patches."""
        assert detect_waterlogging(real_road_frame) is False
