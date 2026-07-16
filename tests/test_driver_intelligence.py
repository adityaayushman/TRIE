"""Regression tests for the real MediaPipe driver-monitoring engine.

Everywhere else in the suite, DriverIntelligenceEngine is faked so the
pipeline/API tests stay fast and offline. These exercise the actual model:
skipped if torch/ultralytics/mediapipe aren't installed, and downloading the
FaceLandmarker bundle + sample images on first run. Marked `model` so CI's
default fast job excludes them.
"""
from __future__ import annotations

from urllib.request import urlretrieve

import numpy as np
import pytest

pytest.importorskip("mediapipe", reason="driver monitoring needs mediapipe")
pytest.importorskip("torch", reason="phone detection needs the torch/ultralytics stack")
pytest.importorskip("ultralytics", reason="phone detection needs the torch/ultralytics stack")

from ai.driver_intelligence.engine import DriverIntelligenceEngine  # noqa: E402

pytestmark = pytest.mark.model


def _fetch(tmp_path_factory, name: str, url: str):
    path = tmp_path_factory.mktemp("images") / name
    try:
        urlretrieve(url, path)
    except OSError:
        pytest.skip("no network access to fetch the validation photo")

    import cv2

    return cv2.imread(str(path))


@pytest.fixture(scope="module")
def frontal_face(tmp_path_factory):
    """A clear, forward-facing face — the geometry a cabin-facing camera
    actually sees, unlike a hard profile shot."""
    return _fetch(
        tmp_path_factory,
        "face.jpg",
        "https://raw.githubusercontent.com/opencv/opencv/master/samples/data/lena.jpg",
    )


def test_a_blank_frame_reports_no_face(tmp_path_factory):
    engine = DriverIntelligenceEngine(min_face_confidence=0.5)
    state = engine.analyze(np.zeros((480, 640, 3), dtype=np.uint8), timestamp_s=0.0)
    assert state.face_detected is False


def test_a_clear_frontal_face_is_detected(frontal_face):
    engine = DriverIntelligenceEngine(min_face_confidence=0.5)
    state = engine.analyze(frontal_face, timestamp_s=0.0)
    assert state.face_detected is True


def test_perclos_accumulates_over_a_rolling_window(frontal_face):
    """Regression: PERCLOS must be measured over time, not instantaneously —
    that is the entire reason it is a better drowsiness signal than a single
    frame's eye-closure ratio."""
    engine = DriverIntelligenceEngine(min_face_confidence=0.5, perclos_window_s=5.0)
    for t in np.linspace(0.0, 4.0, 5):
        state = engine.analyze(frontal_face, timestamp_s=float(t))
    assert 0.0 <= state.perclos <= 1.0


def test_an_empty_frame_does_not_crash():
    engine = DriverIntelligenceEngine()
    state = engine.analyze(np.zeros((0, 0, 3), dtype=np.uint8), timestamp_s=0.0)
    assert state.face_detected is False


def test_a_hard_profile_shot_is_honestly_not_detected(tmp_path_factory):
    """A driver-facing camera sees one frontal face and the engine is
    configured for exactly one (num_faces=1) accordingly. A hard-angle
    profile shot of two people correctly fails to detect at any reasonable
    confidence under that configuration — this is what face_detected=False
    is for, not a bug to threshold away."""
    profile = _fetch(tmp_path_factory, "zidane.jpg", "https://ultralytics.com/images/zidane.jpg")

    state = DriverIntelligenceEngine(min_face_confidence=0.1).analyze(profile, timestamp_s=0.0)

    assert state.face_detected is False
    assert state.attention_score == 1.0  # the neutral default, not a guess
